import {
  validateBenchmarkResultV1,
  validateErrorTaxonomyV1ErrorCode,
  validateSemanticContractV1,
} from "@japp/contracts/generated";

import { aggregateCaseResults } from "./aggregate.ts";
import {
  canonicalJson,
  canonicalJsonBytes,
  compareCanonicalText,
  isContentDigest,
  sha256Canonical,
  sha256Bytes,
  stableIdFromDigest,
} from "./canonical.ts";
import {
  DEVELOPMENT_HOLDOUT_COMMITMENT,
  EVALUATION_RUNNER_VERSION,
  MAX_REPORT_LIMITATIONS,
  NO_GATE_AUTHORITY_STATEMENT,
  REPORT_BUNDLE_MANIFEST_VERSION,
  REPORT_FORMAT_VERSION,
  SUPPORTED_METRIC_UNITS,
  SUPPORTED_THRESHOLD_COMPARATORS,
} from "./constants.ts";
import { deriveExecutionFromWitness } from "./derive.ts";
import { EvaluationRunnerError, runnerFail } from "./errors.ts";
import {
  compareExactDecimals,
  exactDecimalFromNumber,
  exactDecimalIsZero,
} from "./exact-decimal.ts";
import {
  compareRegressionForExecution,
  validateRegressionComparison,
} from "./regression.ts";
import type {
  AggregateCountsV1,
  AggregateSummaryV1,
  CaseExecutionRecordV1,
  CountRateV1,
  RegressionComparisonV1,
  ReportBundleV1,
  RunReportV1,
  RunnerExecutionV1,
  UncertaintyNoteV1,
  WilsonIntervalV1,
} from "./model.ts";
import { countRate } from "./statistics.ts";
import { deriveDurationMilliseconds } from "./time.ts";

const STABLE_ID = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/u;
const GIT_OBJECT = /^[0-9a-f]{40}$/u;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const ENUM_TOKEN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

function reportObject(
  value: unknown,
  pointer: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return runnerFail("RUNNER_REPORT_STRUCTURE", pointer, "expected an object");
  }
  return value as Record<string, unknown>;
}

function reportExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  pointer: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !(key in value));
  if (unknown.length > 0 || missing.length > 0) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      pointer,
      `unknown=${unknown.sort().join(",") || "NONE"}; missing=${missing.sort().join(",") || "NONE"}`,
    );
  }
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || compareCanonicalText(values[index - 1] ?? "", value) < 0,
  );
}

function reportCount(value: unknown, pointer: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      pointer,
      "expected a non-negative safe integer",
    );
  }
  return value;
}

function reportMetric(value: unknown, pointer: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000_000
  ) {
    return runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      pointer,
      "expected a finite bounded benchmark metric",
    );
  }
  return value;
}

function validateRecordTime(record: CaseExecutionRecordV1): void {
  const duration = deriveDurationMilliseconds(
    record.started_at,
    record.ended_at,
    "/cases/timestamps",
  );
  if (
    !Number.isSafeInteger(record.duration_ms) ||
    record.duration_ms !== duration
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      "/cases/duration_ms",
      "case duration must equal the bounded contract-valid timestamp difference",
    );
  }
}

function validateCaseRecordTruth(
  value: unknown,
  index: number,
  report: RunReportV1,
): void {
  const pointer = `/cases/${String(index)}`;
  const raw = reportObject(value, pointer);
  reportExactKeys(
    raw,
    [
      "record_format_version",
      "record_id",
      "case_id",
      "case_digest",
      "threshold_set_digest",
      "implementation",
      "adapter",
      "started_at",
      "ended_at",
      "duration_ms",
      "completeness_state",
      "environment_match_state",
      "hash_state",
      "holdout_state",
      "comparable",
      "overall_outcome",
      "required_metric_units",
      "threshold_results",
      "missing_metric_ids",
      "failure_error_codes",
      "artifact_report_digests",
      "used_prompt_commitments",
      "model_participated",
      "browser_participated",
      "peak_memory_bytes",
      "paired_counts",
      "observation_digest",
    ],
    ["canonical_result"],
    pointer,
  );
  const record = raw as unknown as CaseExecutionRecordV1;
  if (raw.record_format_version !== "1.0.0") {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/record_format_version`,
      "unsupported case-record version",
    );
  }
  validateRecordTime(record);
  if (
    canonicalJson(record.implementation) !==
      canonicalJson(report.provenance.implementation) ||
    canonicalJson(record.adapter) !== canonicalJson(report.provenance.adapter)
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/implementation`,
      "record implementation or adapter differs from run provenance",
    );
  }
  if (
    !Array.isArray(record.required_metric_units) ||
    !Array.isArray(record.threshold_results) ||
    !Array.isArray(record.missing_metric_ids) ||
    !Array.isArray(record.failure_error_codes) ||
    !Array.isArray(record.artifact_report_digests) ||
    !Array.isArray(record.used_prompt_commitments) ||
    !Array.isArray(record.paired_counts)
  ) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      pointer,
      "case record collections must be arrays",
    );
  }
  if (
    !isContentDigest(record.threshold_set_digest) ||
    !isContentDigest(record.observation_digest) ||
    typeof record.model_participated !== "boolean" ||
    typeof record.browser_participated !== "boolean" ||
    (record.peak_memory_bytes !== null &&
      (!Number.isSafeInteger(record.peak_memory_bytes) ||
        record.peak_memory_bytes < 0))
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      pointer,
      "record commitments, participation, or memory metadata are malformed",
    );
  }
  const artifactDigests = record.artifact_report_digests.filter(
    (digest): digest is `sha256:${string}` => isContentDigest(digest),
  );
  if (
    artifactDigests.length !== record.artifact_report_digests.length ||
    !sortedUnique(artifactDigests) ||
    (record.completeness_state !== "FAILED_SETUP" && artifactDigests.length < 1)
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/artifact_report_digests`,
      "artifact report commitments must be present, unique, and sorted for measured records",
    );
  }
  const promptIds: string[] = [];
  for (const [promptIndex, value] of record.used_prompt_commitments.entries()) {
    const promptPointer = `${pointer}/used_prompt_commitments/${String(promptIndex)}`;
    const prompt = reportObject(value, promptPointer);
    reportExactKeys(
      prompt,
      ["prompt_id", "version", "digest"],
      [],
      promptPointer,
    );
    if (
      typeof prompt.prompt_id !== "string" ||
      typeof prompt.version !== "string" ||
      !SEMVER.test(prompt.version) ||
      !isContentDigest(prompt.digest) ||
      !report.provenance.prompt_commitments.some(
        (commitment) => canonicalJson(commitment) === canonicalJson(prompt),
      )
    ) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        promptPointer,
        "used prompt lacks an exact run-level provenance commitment",
      );
    }
    promptIds.push(prompt.prompt_id);
  }
  if (!sortedUnique(promptIds)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/used_prompt_commitments`,
      "used prompts must be unique and canonically sorted",
    );
  }
  const pairedGroupIds: string[] = [];
  for (const [pairedIndex, value] of record.paired_counts.entries()) {
    const pairedPointer = `${pointer}/paired_counts/${String(pairedIndex)}`;
    const paired = reportObject(value, pairedPointer);
    reportExactKeys(
      paired,
      ["group_id", "true_positive", "false_positive", "false_negative"],
      [],
      pairedPointer,
    );
    if (
      typeof paired.group_id !== "string" ||
      !ENUM_TOKEN.test(paired.group_id)
    ) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        `${pairedPointer}/group_id`,
        "paired-count group identity is malformed",
      );
    }
    reportCount(paired.true_positive, `${pairedPointer}/true_positive`);
    reportCount(paired.false_positive, `${pairedPointer}/false_positive`);
    reportCount(paired.false_negative, `${pairedPointer}/false_negative`);
    pairedGroupIds.push(paired.group_id);
  }
  if (!sortedUnique(pairedGroupIds)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/paired_counts`,
      "paired-count groups must be unique and canonically sorted",
    );
  }

  const requiredMetricIds: string[] = [];
  const requiredUnits = new Map<string, string>();
  for (const [requiredIndex, value] of record.required_metric_units.entries()) {
    const required = reportObject(
      value,
      `${pointer}/required_metric_units/${String(requiredIndex)}`,
    );
    reportExactKeys(
      required,
      ["metric_id", "unit"],
      [],
      `${pointer}/required_metric_units/${String(requiredIndex)}`,
    );
    if (
      typeof required.metric_id !== "string" ||
      !ENUM_TOKEN.test(required.metric_id) ||
      typeof required.unit !== "string" ||
      !SUPPORTED_METRIC_UNITS.includes(
        required.unit as (typeof SUPPORTED_METRIC_UNITS)[number],
      )
    ) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        `${pointer}/required_metric_units/${String(requiredIndex)}`,
        "required metric identity or unit is invalid",
      );
    }
    requiredMetricIds.push(required.metric_id);
    requiredUnits.set(required.metric_id, required.unit);
  }
  if (!sortedUnique(requiredMetricIds)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/required_metric_units`,
      "required metrics must be unique and canonically sorted",
    );
  }

  const observedMetricIds: string[] = [];
  let thresholdFailed = false;
  for (const [metricIndex, value] of record.threshold_results.entries()) {
    const metricPointer = `${pointer}/threshold_results/${String(metricIndex)}`;
    const metric = reportObject(value, metricPointer);
    reportExactKeys(
      metric,
      [
        "metric_id",
        "comparator",
        "expected_value",
        "measured_value",
        "unit",
        "threshold_set_digest",
        "proportion",
        "zero_tolerance",
        "passed",
      ],
      [],
      metricPointer,
    );
    if (
      typeof metric.metric_id !== "string" ||
      !ENUM_TOKEN.test(metric.metric_id) ||
      typeof metric.comparator !== "string" ||
      !SUPPORTED_THRESHOLD_COMPARATORS.includes(
        metric.comparator as (typeof SUPPORTED_THRESHOLD_COMPARATORS)[number],
      ) ||
      typeof metric.unit !== "string" ||
      !SUPPORTED_METRIC_UNITS.includes(
        metric.unit as (typeof SUPPORTED_METRIC_UNITS)[number],
      ) ||
      metric.threshold_set_digest !== record.threshold_set_digest ||
      !isContentDigest(metric.threshold_set_digest) ||
      requiredUnits.get(metric.metric_id) !== metric.unit
    ) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        metricPointer,
        "threshold metric identity, unit, or commitment is inconsistent",
      );
    }
    const expected = reportMetric(
      metric.expected_value,
      `${metricPointer}/expected_value`,
    );
    const measured = reportMetric(
      metric.measured_value,
      `${metricPointer}/measured_value`,
    );
    const comparison = compareExactDecimals(
      exactDecimalFromNumber(measured),
      exactDecimalFromNumber(expected),
    );
    const expectedPassed =
      metric.comparator === "AT_LEAST"
        ? comparison >= 0
        : metric.comparator === "AT_MOST"
          ? comparison <= 0
          : comparison === 0;
    const expectedZeroTolerance =
      exactDecimalIsZero(exactDecimalFromNumber(expected)) &&
      (metric.comparator === "AT_MOST" || metric.comparator === "EXACT");
    if (
      metric.passed !== expectedPassed ||
      metric.zero_tolerance !== expectedZeroTolerance
    ) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        metricPointer,
        "threshold pass/fail or zero-tolerance state differs from exact truth",
      );
    }
    if (metric.proportion !== null) {
      const proportion = reportObject(
        metric.proportion,
        `${metricPointer}/proportion`,
      );
      reportExactKeys(
        proportion,
        ["numerator", "denominator", "rate"],
        [],
        `${metricPointer}/proportion`,
      );
      const recomputed = countRate(
        reportCount(
          proportion.numerator,
          `${metricPointer}/proportion/numerator`,
        ),
        reportCount(
          proportion.denominator,
          `${metricPointer}/proportion/denominator`,
        ),
      );
      if (
        metric.unit !== "RATIO" ||
        canonicalJson(proportion) !== canonicalJson(recomputed) ||
        (recomputed.rate === null
          ? measured !== 0
          : compareExactDecimals(
              exactDecimalFromNumber(measured),
              exactDecimalFromNumber(recomputed.rate),
            ) !== 0)
      ) {
        runnerFail(
          "RUNNER_REPORT_CASE_DERIVATION",
          `${metricPointer}/proportion`,
          "raw proportion counts do not reproduce the measured ratio",
        );
      }
    }
    thresholdFailed ||= !expectedPassed;
    observedMetricIds.push(metric.metric_id);
  }
  if (!sortedUnique(observedMetricIds)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/threshold_results`,
      "threshold results must be unique and canonically sorted",
    );
  }
  const expectedMissing = requiredMetricIds.filter(
    (metricId) => !observedMetricIds.includes(metricId),
  );
  if (
    !record.missing_metric_ids.every(
      (metricId): metricId is string => typeof metricId === "string",
    ) ||
    !sortedUnique(record.missing_metric_ids) ||
    canonicalJson(record.missing_metric_ids) !== canonicalJson(expectedMissing)
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/missing_metric_ids`,
      "missing metrics must be the exact sorted complement of observed metrics",
    );
  }

  const completenessValue = raw.completeness_state;
  if (
    (completenessValue !== "COMPLETE" &&
      completenessValue !== "PARTIAL" &&
      completenessValue !== "FAILED_SETUP") ||
    (completenessValue === "COMPLETE" && expectedMissing.length !== 0) ||
    (completenessValue === "PARTIAL" && observedMetricIds.length === 0) ||
    (completenessValue === "FAILED_SETUP" && observedMetricIds.length !== 0)
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/completeness_state`,
      "completeness does not match the visible metric inventory",
    );
  }
  const completeness = completenessValue;
  if (
    !["MATCH", "MISMATCH", "UNKNOWN"].includes(
      record.environment_match_state,
    ) ||
    !["MATCH", "MISMATCH", "UNKNOWN"].includes(record.hash_state) ||
    !["INVALID", "NOT_APPLICABLE", "UNAVAILABLE", "VALID"].includes(
      record.holdout_state,
    )
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      pointer,
      "environment, hash, or holdout state is unsupported",
    );
  }
  const comparable =
    completeness === "COMPLETE" &&
    record.environment_match_state === "MATCH" &&
    record.hash_state === "MATCH" &&
    (record.holdout_state === "VALID" ||
      record.holdout_state === "NOT_APPLICABLE");
  if (record.comparable !== comparable) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/comparable`,
      "case comparability differs from its visible states",
    );
  }
  const failureCodes: string[] = [];
  for (const [codeIndex, code] of record.failure_error_codes.entries()) {
    const validation = validateErrorTaxonomyV1ErrorCode(code);
    if (!validation.valid || validation.value.startsWith("GATE_")) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        `${pointer}/failure_error_codes/${String(codeIndex)}`,
        "case failure code is invalid or asserts gate authority",
      );
    }
    failureCodes.push(validation.value);
  }
  if (!sortedUnique(failureCodes)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/failure_error_codes`,
      "failure codes must be unique and canonically sorted",
    );
  }
  const mandatoryCodes = [
    ...(completeness === "COMPLETE" ? [] : ["BENCHMARK_INCOMPLETE_RUN"]),
    ...(record.environment_match_state === "MISMATCH"
      ? ["BENCHMARK_ENVIRONMENT_MISMATCH"]
      : []),
    ...(record.hash_state === "MISMATCH" ? ["BENCHMARK_HASH_MISMATCH"] : []),
    ...(record.holdout_state === "INVALID" ||
    record.holdout_state === "UNAVAILABLE"
      ? ["BENCHMARK_INVALID_HOLDOUT_STATE"]
      : []),
    ...(thresholdFailed ? ["BENCHMARK_THRESHOLD_FAILED"] : []),
  ];
  if (mandatoryCodes.some((code) => !failureCodes.includes(code))) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/failure_error_codes`,
      "case omits a failure code required by its visible state",
    );
  }
  const expectedOutcome =
    completeness !== "COMPLETE" || !comparable
      ? "INVALID"
      : thresholdFailed || failureCodes.length > 0
        ? "FAIL"
        : "PASS";
  if (record.overall_outcome !== expectedOutcome) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/overall_outcome`,
      "case outcome differs from derived measurement truth",
    );
  }

  if (completeness === "FAILED_SETUP") {
    if (record.paired_counts.length !== 0) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        `${pointer}/paired_counts`,
        "failed setup occurs before measurement and cannot carry paired TP/FP/FN counts",
      );
    }
    if (record.canonical_result !== undefined) {
      runnerFail(
        "RUNNER_REPORT_CASE_DERIVATION",
        `${pointer}/canonical_result`,
        "failed setup cannot issue a fabricated canonical result",
      );
    }
    return;
  }
  const structural = validateBenchmarkResultV1(record.canonical_result);
  if (
    !structural.valid ||
    !validateSemanticContractV1(
      "urn:japp:schema:benchmark:result:v1",
      record.canonical_result,
    ).valid
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/canonical_result`,
      "canonical result is structurally or semantically invalid",
    );
  }
  const result = structural.value;
  const runtime = report.provenance.runtime;
  if (
    (record.model_participated && runtime.model_digest === undefined) ||
    (record.browser_participated && runtime.browser === undefined)
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/canonical_result/runtime_metadata`,
      "participating model or browser lacks committed runtime metadata",
    );
  }
  const expectedRuntimeMetadata = {
    runtime_family: runtime.runtime_family,
    runtime_version: runtime.runtime_version,
    toolchain_digest: runtime.toolchain_digest,
    platform_profile: runtime.platform_profile,
    adapter_version: report.provenance.adapter.version,
    ...(record.model_participated && runtime.model_digest !== undefined
      ? { model_digest: runtime.model_digest }
      : {}),
    ...(record.browser_participated && runtime.browser !== undefined
      ? {
          browser_family: runtime.browser.family,
          browser_version: runtime.browser.version,
        }
      : {}),
    operating_system: runtime.operating_system,
    architecture: runtime.architecture,
  };
  const holdoutDigest =
    report.provenance.holdout.policy === "DEVELOPMENT_NOT_APPLICABLE_V1"
      ? report.provenance.holdout.development_commitment_digest
      : report.provenance.holdout.manifest_digest;
  const resultProjection = {
    result_id: result.result_id,
    case_id: result.case_id,
    case_digest: result.case_digest,
    repository_commit: result.repository_commit,
    repository_tree: result.repository_tree,
    schema_manifest_digest: result.schema_manifest_digest,
    generator_format_version: result.generator_format_version,
    corpus_digest: result.corpus_digest,
    holdout_manifest_digest: result.holdout_manifest_digest,
    runtime_metadata: result.runtime_metadata,
    started_at: result.started_at,
    ended_at: result.ended_at,
    duration_ms: result.duration_ms,
    metric_results: result.metric_results,
    case_threshold_set_digest: result.case_threshold_set_digest,
    evaluated_threshold_set_digest: result.evaluated_threshold_set_digest,
    failure_error_codes: result.failure_error_codes,
    artifact_report_digests: result.artifact_report_digests,
    completeness_state: result.completeness_state,
    environment_match_state: result.environment_match_state,
    hash_state: result.hash_state,
    holdout_state: result.holdout_state,
    comparable: result.comparable,
    overall_outcome: result.overall_outcome,
  };
  const recordProjection = {
    result_id: stableIdFromDigest(
      "evalresult",
      sha256Canonical({
        identity_version: "1.0.0",
        request_digest: report.request_digest,
        case_id: record.case_id,
        case_digest: record.case_digest,
        observation_digest: record.observation_digest,
      }),
    ),
    case_id: record.case_id,
    case_digest: record.case_digest,
    repository_commit: report.provenance.repository.commit,
    repository_tree: report.provenance.repository.tree,
    schema_manifest_digest: report.provenance.schema.manifest_digest,
    generator_format_version: report.provenance.schema.generator_format_version,
    corpus_digest: report.provenance.corpus.digest,
    holdout_manifest_digest: holdoutDigest,
    runtime_metadata: expectedRuntimeMetadata,
    started_at: record.started_at,
    ended_at: record.ended_at,
    duration_ms: record.duration_ms,
    metric_results: (
      record.threshold_results as CaseExecutionRecordV1["threshold_results"]
    ).map((metric) => ({
      metric_id: metric.metric_id,
      measured_value: metric.measured_value,
      unit: metric.unit,
      threshold_digest: metric.threshold_set_digest,
      passed: metric.passed,
    })),
    case_threshold_set_digest: record.threshold_set_digest,
    evaluated_threshold_set_digest: record.threshold_set_digest,
    failure_error_codes: record.failure_error_codes,
    artifact_report_digests: record.artifact_report_digests,
    completeness_state: record.completeness_state,
    environment_match_state: record.environment_match_state,
    hash_state: record.hash_state,
    holdout_state: record.holdout_state,
    comparable: record.comparable,
    overall_outcome: record.overall_outcome,
  };
  if (canonicalJson(resultProjection) !== canonicalJson(recordProjection)) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      `${pointer}/canonical_result`,
      "canonical result differs from the versioned case execution record",
    );
  }
}

function validateReportIdentityAndProvenance(
  report: Record<string, unknown>,
  cases: readonly unknown[],
): void {
  if (
    report.runner_version !== EVALUATION_RUNNER_VERSION ||
    report.artifact_digest_policy !==
      "OUT_OF_BAND_MANIFEST_AVOIDS_SELF_REFERENCE"
  ) {
    runnerFail(
      "RUNNER_REPORT_VERSION",
      "/runner_version",
      "runner version or report artifact-digest policy is unsupported",
    );
  }
  if (!isContentDigest(report.request_digest)) {
    runnerFail(
      "RUNNER_REPORT_DIGEST",
      "/request_digest",
      "request digest is malformed",
    );
  }
  if (
    typeof report.execution_id !== "string" ||
    !STABLE_ID.test(report.execution_id)
  ) {
    runnerFail(
      "RUNNER_REPORT_IDENTITY",
      "/execution_id",
      "execution identity is malformed",
    );
  }
  if (typeof report.title !== "string" || report.title.length > 160) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      "/title",
      "report title must be bounded text",
    );
  }
  if (
    !Array.isArray(report.limitations) ||
    report.limitations.length > MAX_REPORT_LIMITATIONS ||
    report.limitations.some(
      (limitation) => typeof limitation !== "string" || limitation.length > 512,
    )
  ) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      "/limitations",
      "report limitations must be bounded text entries",
    );
  }

  const recordIds: string[] = [];
  const caseIds: string[] = [];
  for (const [index, value] of cases.entries()) {
    const record = reportObject(value, `/cases/${String(index)}`);
    const caseId = record.case_id;
    const recordId = record.record_id;
    if (
      typeof caseId !== "string" ||
      !STABLE_ID.test(caseId) ||
      typeof recordId !== "string" ||
      !STABLE_ID.test(recordId) ||
      !isContentDigest(record.case_digest) ||
      !isContentDigest(record.observation_digest)
    ) {
      runnerFail(
        "RUNNER_REPORT_IDENTITY",
        `/cases/${String(index)}`,
        "case record identity or digest is malformed",
      );
    }
    const identityDigest = sha256Canonical({
      identity_version: "1.0.0",
      request_digest: report.request_digest,
      case_id: caseId,
      case_digest: record.case_digest,
      observation_digest: record.observation_digest,
    });
    if (recordId !== stableIdFromDigest("evalrecord", identityDigest)) {
      runnerFail(
        "RUNNER_REPORT_IDENTITY",
        `/cases/${String(index)}/record_id`,
        "record identity differs from its committed request, case, and observation",
      );
    }
    if (record.canonical_result !== undefined) {
      const canonicalResult = reportObject(
        record.canonical_result,
        `/cases/${String(index)}/canonical_result`,
      );
      if (
        canonicalResult.result_id !==
        stableIdFromDigest("evalresult", identityDigest)
      ) {
        runnerFail(
          "RUNNER_REPORT_IDENTITY",
          `/cases/${String(index)}/canonical_result/result_id`,
          "canonical result identity differs from its committed inputs",
        );
      }
    }
    recordIds.push(recordId);
    caseIds.push(caseId);
  }
  if (
    caseIds.some(
      (caseId, index) =>
        index > 0 &&
        compareCanonicalText(caseIds[index - 1] ?? "", caseId) >= 0,
    )
  ) {
    runnerFail(
      "RUNNER_REPORT_ORDER",
      "/cases",
      "report cases must have unique canonically sorted identities",
    );
  }
  const executionDigest = sha256Canonical({
    identity_version: "1.0.0",
    request_digest: report.request_digest,
    record_ids: recordIds,
  });
  if (report.execution_id !== stableIdFromDigest("evalrun", executionDigest)) {
    runnerFail(
      "RUNNER_REPORT_IDENTITY",
      "/execution_id",
      "execution identity differs from its request and records",
    );
  }

  const provenance = reportObject(report.provenance, "/provenance");
  reportExactKeys(
    provenance,
    [
      "repository",
      "schema",
      "corpus",
      "holdout",
      "runtime",
      "runtime_commitment_digest",
      "implementation",
      "adapter",
      "clock",
      "prompt_commitments",
    ],
    [],
    "/provenance",
  );
  const repository = reportObject(
    provenance.repository,
    "/provenance/repository",
  );
  reportExactKeys(
    repository,
    ["commit", "tree", "runner_source_digest"],
    [],
    "/provenance/repository",
  );
  const schema = reportObject(provenance.schema, "/provenance/schema");
  reportExactKeys(
    schema,
    ["manifest_digest", "generator_format_version"],
    [],
    "/provenance/schema",
  );
  const corpus = reportObject(provenance.corpus, "/provenance/corpus");
  reportExactKeys(corpus, ["version", "digest"], [], "/provenance/corpus");
  const holdout = reportObject(provenance.holdout, "/provenance/holdout");
  if (holdout.policy === "DEVELOPMENT_NOT_APPLICABLE_V1") {
    reportExactKeys(
      holdout,
      ["policy", "state", "development_commitment_digest"],
      [],
      "/provenance/holdout",
    );
    if (
      holdout.state !== "NOT_APPLICABLE" ||
      holdout.development_commitment_digest !==
        sha256Canonical(DEVELOPMENT_HOLDOUT_COMMITMENT)
    ) {
      runnerFail(
        "RUNNER_REPORT_PROVENANCE",
        "/provenance/holdout",
        "development holdout provenance is malformed",
      );
    }
  } else if (holdout.policy === "CALLER_SUPPLIED_MANIFEST_V1") {
    reportExactKeys(
      holdout,
      ["policy", "state", "manifest_id", "manifest_digest"],
      [],
      "/provenance/holdout",
    );
    if (
      !["INVALID", "UNAVAILABLE", "VALID"].includes(String(holdout.state)) ||
      typeof holdout.manifest_id !== "string" ||
      !STABLE_ID.test(holdout.manifest_id) ||
      !isContentDigest(holdout.manifest_digest)
    ) {
      runnerFail(
        "RUNNER_REPORT_PROVENANCE",
        "/provenance/holdout",
        "caller-supplied holdout provenance is malformed",
      );
    }
  } else {
    runnerFail(
      "RUNNER_REPORT_PROVENANCE",
      "/provenance/holdout/policy",
      "holdout provenance policy is unsupported",
    );
  }
  const runtime = reportObject(provenance.runtime, "/provenance/runtime");
  reportExactKeys(
    runtime,
    [
      "environment_state",
      "runtime_family",
      "runtime_version",
      "platform_profile",
      "toolchain_digest",
      "operating_system",
      "architecture",
    ],
    ["model_profile_ref", "model_digest", "browser"],
    "/provenance/runtime",
  );
  if (runtime.browser !== undefined) {
    reportExactKeys(
      reportObject(runtime.browser, "/provenance/runtime/browser"),
      ["family", "version"],
      [],
      "/provenance/runtime/browser",
    );
  }
  if (
    (runtime.model_profile_ref === undefined) !==
    (runtime.model_digest === undefined)
  ) {
    runnerFail(
      "RUNNER_REPORT_PROVENANCE",
      "/provenance/runtime",
      "model profile and digest must be committed together",
    );
  }
  const implementation = reportObject(
    provenance.implementation,
    "/provenance/implementation",
  );
  reportExactKeys(
    implementation,
    ["kind", "identity", "version", "source_digest"],
    [],
    "/provenance/implementation",
  );
  const adapter = reportObject(provenance.adapter, "/provenance/adapter");
  reportExactKeys(adapter, ["identity", "version"], [], "/provenance/adapter");
  const clock = reportObject(provenance.clock, "/provenance/clock");
  reportExactKeys(clock, ["identity", "version"], [], "/provenance/clock");
  if (!Array.isArray(provenance.prompt_commitments)) {
    runnerFail(
      "RUNNER_REPORT_PROVENANCE",
      "/provenance/prompt_commitments",
      "prompt commitments must be an array",
    );
  }
  for (const [index, value] of provenance.prompt_commitments.entries()) {
    const prompt = reportObject(
      value,
      `/provenance/prompt_commitments/${String(index)}`,
    );
    reportExactKeys(
      prompt,
      ["prompt_id", "version", "digest"],
      [],
      `/provenance/prompt_commitments/${String(index)}`,
    );
    if (
      typeof prompt.prompt_id !== "string" ||
      typeof prompt.version !== "string" ||
      !SEMVER.test(prompt.version) ||
      !isContentDigest(prompt.digest)
    ) {
      runnerFail(
        "RUNNER_REPORT_PROVENANCE",
        `/provenance/prompt_commitments/${String(index)}`,
        "prompt commitment is malformed",
      );
    }
  }
  if (
    typeof repository.commit !== "string" ||
    !GIT_OBJECT.test(repository.commit) ||
    typeof repository.tree !== "string" ||
    !GIT_OBJECT.test(repository.tree) ||
    !isContentDigest(repository.runner_source_digest) ||
    !isContentDigest(schema.manifest_digest) ||
    typeof schema.generator_format_version !== "string" ||
    !SEMVER.test(schema.generator_format_version) ||
    typeof corpus.version !== "string" ||
    !SEMVER.test(corpus.version) ||
    !isContentDigest(corpus.digest) ||
    !isContentDigest(provenance.runtime_commitment_digest) ||
    provenance.runtime_commitment_digest !== sha256Canonical(runtime) ||
    !isContentDigest(implementation.source_digest) ||
    (implementation.kind !== "BASELINE" &&
      implementation.kind !== "IMPLEMENTATION") ||
    typeof implementation.version !== "string" ||
    !SEMVER.test(implementation.version) ||
    typeof adapter.version !== "string" ||
    !SEMVER.test(adapter.version) ||
    typeof clock.version !== "string" ||
    !SEMVER.test(clock.version)
  ) {
    runnerFail(
      "RUNNER_REPORT_PROVENANCE",
      "/provenance",
      "report provenance is malformed or internally mismatched",
    );
  }
}

function rateText(rate: CountRateV1): string {
  return rate.rate === null
    ? `NOT_APPLICABLE (${String(rate.numerator)}/${String(rate.denominator)})`
    : `${(rate.rate * 100).toFixed(2)}% (${String(rate.numerator)}/${String(rate.denominator)})`;
}

function intervalText(interval: WilsonIntervalV1): string {
  if (interval.lower_bound === null || interval.upper_bound === null) {
    return `${interval.method} 95%: ${interval.note ?? "NOT_APPLICABLE"} (${String(interval.numerator)}/${String(interval.denominator)})`;
  }
  return `${interval.method} 95% [${interval.lower_bound}, ${interval.upper_bound}] (${String(interval.numerator)}/${String(interval.denominator)})${interval.note === null ? "" : `; ${interval.note}`}`;
}

function uncertaintyText(
  uncertainty: WilsonIntervalV1 | UncertaintyNoteV1,
): string {
  return "method" in uncertainty
    ? intervalText(uncertainty)
    : `NOT_APPLICABLE: ${uncertainty.note}`;
}

function optionalRateText(rate: CountRateV1 | null): string {
  return rate === null
    ? "NOT_APPLICABLE (no raw proportion counts)"
    : rateText(rate);
}

function optionalRawCounts(
  numerator: number | undefined,
  denominator: number | undefined,
): string {
  return numerator === undefined || denominator === undefined
    ? "NOT_APPLICABLE"
    : `${String(numerator)}/${String(denominator)}`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdown(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("!", "\\!")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("#", "\\#")
    .replaceAll("*", "\\*")
    .replaceAll("|", "\\|")
    .replaceAll("`", "\\`")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function countRows(counts: AggregateCountsV1): readonly [string, number][] {
  return [
    ["Total cases", counts.total_cases],
    ["Complete", counts.complete],
    ["Partial", counts.partial],
    ["Failed setup", counts.failed_setup],
    ["Comparable", counts.comparable],
    ["Incomparable", counts.incomparable],
    ["Pass", counts.pass],
    ["Fail", counts.fail],
    ["Invalid", counts.invalid],
    ["Environment match", counts.environment_match],
    ["Environment mismatch", counts.environment_mismatch],
    ["Environment unknown", counts.environment_unknown],
    ["Hash match", counts.hash_match],
    ["Hash mismatch", counts.hash_mismatch],
    ["Hash unknown", counts.hash_unknown],
    ["Holdout valid", counts.holdout_valid],
    ["Holdout not applicable", counts.holdout_not_applicable],
    ["Holdout unavailable", counts.holdout_unavailable],
    ["Holdout invalid", counts.holdout_invalid],
    ["Zero-tolerance failures", counts.zero_tolerance_failure_count],
  ];
}

function fixedLimitations(execution: RunnerExecutionV1): readonly string[] {
  return [
    "This runner measures supplied cases; it cannot make or mutate a critical-gate decision.",
    "Wilson intervals characterize bounded Bernoulli uncertainty and do not establish superiority, non-inferiority, or product quality by themselves.",
    ...(execution.provenance.holdout.policy === "DEVELOPMENT_NOT_APPLICABLE_V1"
      ? [
          "This is a public synthetic pre-W06 development run. The NOT_APPLICABLE commitment is not an M02-W06 holdout manifest or holdout evidence.",
        ]
      : []),
  ];
}

function composeRunReport(
  execution: RunnerExecutionV1,
  regressionComparisons: readonly RegressionComparisonV1[],
): RunReportV1 {
  const aggregate = aggregateCaseResults(execution.records);
  return {
    report_format_version: REPORT_FORMAT_VERSION,
    runner_version: execution.runner_version,
    execution_id: execution.execution_id,
    request_digest: execution.request_digest,
    title: execution.output_policy.report_title,
    authority_statement: NO_GATE_AUTHORITY_STATEMENT,
    comparability_banner:
      aggregate.counts.incomparable === 0
        ? "ALL_CASES_COMPARABLE"
        : "INCOMPARABLE_CASES_PRESENT",
    aggregate,
    cases: [...execution.records].sort((left, right) =>
      compareCanonicalText(left.case_id, right.case_id),
    ),
    regression_comparisons: [...regressionComparisons].sort((left, right) =>
      compareCanonicalText(
        `${left.reference_id}:${left.metric_id}`,
        `${right.reference_id}:${right.metric_id}`,
      ),
    ),
    provenance: execution.provenance,
    limitations: [
      ...fixedLimitations(execution),
      ...execution.output_policy.limitations,
    ],
    artifact_digest_policy: "OUT_OF_BAND_MANIFEST_AVOIDS_SELF_REFERENCE",
    replay_witness: execution.replay_witness,
  };
}

export function buildRunReport(
  execution: RunnerExecutionV1,
  regressionComparisons: readonly RegressionComparisonV1[] = [],
): RunReportV1 {
  const report = composeRunReport(execution, regressionComparisons);
  validateRunReport(report);
  return report;
}

export function validateRunReport(
  input: unknown,
): asserts input is RunReportV1 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    runnerFail("RUNNER_REPORT_STRUCTURE", "", "report must be an object");
  }
  const report = input as Record<string, unknown>;
  const expectedKeys = [
    "aggregate",
    "artifact_digest_policy",
    "authority_statement",
    "cases",
    "comparability_banner",
    "execution_id",
    "limitations",
    "provenance",
    "regression_comparisons",
    "replay_witness",
    "report_format_version",
    "request_digest",
    "runner_version",
    "title",
  ];
  if (
    canonicalJson(Object.keys(report).sort()) !== canonicalJson(expectedKeys)
  ) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      "",
      "report has an unknown or missing top-level field",
    );
  }
  if (
    report.report_format_version !== REPORT_FORMAT_VERSION ||
    report.authority_statement !== NO_GATE_AUTHORITY_STATEMENT
  ) {
    runnerFail(
      "RUNNER_REPORT_AUTHORITY",
      "/authority_statement",
      "report version or no-gate-authority statement is missing",
    );
  }
  if (
    !Array.isArray(report.cases) ||
    !Array.isArray(report.regression_comparisons)
  ) {
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      "/cases",
      "report cases and regression comparisons must be arrays",
    );
  }
  const cases = report.cases as unknown[];
  const comparisons = report.regression_comparisons as unknown[];
  let recomputed: AggregateSummaryV1;
  try {
    recomputed = aggregateCaseResults(
      cases as unknown as readonly CaseExecutionRecordV1[],
    );
  } catch (error: unknown) {
    if (error instanceof EvaluationRunnerError) {
      throw error;
    }
    runnerFail(
      "RUNNER_REPORT_STRUCTURE",
      "/cases",
      "report cases are not valid execution records",
    );
  }
  if (canonicalJson(recomputed) !== canonicalJson(report.aggregate)) {
    runnerFail(
      "RUNNER_REPORT_DERIVATION_MISMATCH",
      "/aggregate",
      "report counts, rates, precision/recall, or uncertainty differ from case truth",
    );
  }
  const expectedBanner =
    recomputed.counts.incomparable === 0
      ? "ALL_CASES_COMPARABLE"
      : "INCOMPARABLE_CASES_PRESENT";
  if (report.comparability_banner !== expectedBanner) {
    runnerFail(
      "RUNNER_REPORT_COMPARABILITY",
      "/comparability_banner",
      "comparability banner hides an incomparable result",
    );
  }
  validateReportIdentityAndProvenance(report, cases);
  const typedReport = report as unknown as RunReportV1;
  cases.forEach((record, index) => {
    validateCaseRecordTruth(record, index, typedReport);
  });
  const typedCases = cases as unknown as readonly CaseExecutionRecordV1[];
  const modelParticipated = typedCases.some(
    (record) => record.model_participated,
  );
  const browserParticipated = typedCases.some(
    (record) => record.browser_participated,
  );
  const usedPromptIds = new Set(
    typedCases.flatMap((record) =>
      record.used_prompt_commitments.map((prompt) => prompt.prompt_id),
    ),
  );
  const committedPromptIds = typedReport.provenance.prompt_commitments.map(
    (prompt) => prompt.prompt_id,
  );
  if (
    modelParticipated !==
      (typedReport.provenance.runtime.model_digest !== undefined) ||
    browserParticipated !==
      (typedReport.provenance.runtime.browser !== undefined) ||
    !sortedUnique(committedPromptIds) ||
    committedPromptIds.length !== usedPromptIds.size ||
    committedPromptIds.some((promptId) => !usedPromptIds.has(promptId))
  ) {
    runnerFail(
      "RUNNER_REPORT_CASE_DERIVATION",
      "/provenance",
      "model, browser, or prompt provenance differs from actual case participation",
    );
  }
  const comparisonKeys: string[] = [];
  for (const [index, value] of comparisons.entries()) {
    try {
      validateRegressionComparison(value);
    } catch (error: unknown) {
      if (error instanceof EvaluationRunnerError) {
        throw error;
      }
      runnerFail(
        "RUNNER_REPORT_STRUCTURE",
        `/regression_comparisons/${String(index)}`,
        "regression comparison is malformed",
      );
    }
    comparisonKeys.push(`${value.reference_id}:${value.metric_id}`);
  }
  if (
    comparisonKeys.some(
      (key, index) =>
        index > 0 &&
        compareCanonicalText(comparisonKeys[index - 1] ?? "", key) >= 0,
    )
  ) {
    runnerFail(
      "RUNNER_REPORT_ORDER",
      "/regression_comparisons",
      "regression comparisons must have unique canonically sorted identities",
    );
  }

  /*
   * Authoritative source replay. Everything above validated projections;
   * from here the report must be independently re-derivable from its
   * canonical replay witness through the same pure derivation path the
   * live execution used, so no serialized field survives on internal
   * consistency alone.
   */
  const derivedExecution = deriveExecutionFromWitness(report.replay_witness);
  if (typedReport.request_digest !== derivedExecution.request_digest) {
    runnerFail(
      "RUNNER_REPORT_SOURCE_BINDING",
      "/request_digest",
      "report request digest does not commit the witnessed canonical request",
    );
  }
  const derivedComparisons = (
    comparisons as readonly RegressionComparisonV1[]
  ).map((comparison, index) => {
    const source = comparison.source;
    if (source === undefined) {
      return runnerFail(
        "RUNNER_REGRESSION_SOURCE_REQUIRED",
        `/regression_comparisons/${String(index)}/source`,
        "a report-embedded comparison must carry its immutable reference and candidate selector",
      );
    }
    const derived = compareRegressionForExecution(
      source.reference,
      source.candidate_selector,
      derivedExecution,
    );
    if (canonicalJson(derived) !== canonicalJson(comparison)) {
      return runnerFail(
        "RUNNER_REGRESSION_SOURCE_MISMATCH",
        `/regression_comparisons/${String(index)}`,
        "serialized comparison differs from the comparison reconstructed from its source material and this execution",
      );
    }
    return derived;
  });
  const derivedReport = composeRunReport(derivedExecution, derivedComparisons);
  if (canonicalJson(derivedReport) !== canonicalJson(report)) {
    runnerFail(
      "RUNNER_REPORT_REPLAY_MISMATCH",
      "",
      "serialized report differs from the report derived from its canonical replay witness",
    );
  }
}

export function renderReportJson(report: RunReportV1): string {
  validateRunReport(report);
  return canonicalJsonBytes(report);
}

export function renderReportMarkdown(report: RunReportV1): string {
  validateRunReport(report);
  const semanticJsonDigest = sha256Bytes(renderReportJson(report));
  const lines: string[] = [
    `# ${escapeMarkdown(report.title)}`,
    "",
    `> ${report.authority_statement}`,
    "",
    `Comparability: **${report.comparability_banner}**`,
    "",
    "## Execution identity",
    "",
    `- Execution ID: \`${escapeMarkdown(report.execution_id)}\``,
    `- Request digest: \`${escapeMarkdown(report.request_digest)}\``,
    `- Canonical JSON digest: \`${semanticJsonDigest}\``,
    `- Runner version: \`${escapeMarkdown(report.runner_version)}\``,
    "",
    "## Raw case counts",
    "",
    "| State | Count |",
    "|---|---:|",
    ...countRows(report.aggregate.counts).map(
      ([label, count]) => `| ${escapeMarkdown(label)} | ${String(count)} |`,
    ),
    "",
    `Pass rate: ${rateText(report.aggregate.pass_rate)}`,
    "",
    `Comparable rate: ${rateText(report.aggregate.comparable_rate)}`,
    "",
    "## Metric counts, rates, and uncertainty",
    "",
    "| Metric | Unit | Required | Observed | Missing | Pass | Fail | Pass rate | 95% comparable-case uncertainty | Proportion observations | Pooled numerator/denominator/rate | Proportion uncertainty | Uncertainty notes | Zero-tolerance failures |",
    "|---|---|---:|---:|---:|---:|---:|---|---|---:|---|---|---|---:|",
    ...report.aggregate.metric_summaries.map(
      (metric) =>
        `| ${escapeMarkdown(metric.metric_id)} | ${escapeMarkdown(metric.unit)} | ${String(metric.required_count)} | ${String(metric.observed_count)} | ${String(metric.missing_count)} | ${String(metric.pass_count)} | ${String(metric.fail_count)} | ${rateText(metric.pass_rate)} | ${escapeMarkdown(intervalText(metric.pass_uncertainty))} | ${String(metric.proportion_observation_count)} | ${escapeMarkdown(optionalRateText(metric.pooled_proportion))} | ${escapeMarkdown(uncertaintyText(metric.proportion_uncertainty))} | ${metric.uncertainty_notes.length === 0 ? "NONE" : metric.uncertainty_notes.map((note) => note.note).join(", ")} | ${String(metric.zero_tolerance_failure_count)} |`,
    ),
    "",
    "## Threshold results",
    "",
  ];
  for (const record of report.cases) {
    lines.push(
      `### ${escapeMarkdown(record.case_id)}`,
      "",
      `Case digest: \`${record.case_digest}\`; threshold-set digest: \`${record.threshold_set_digest}\`.`,
      "",
      `Outcome: **${record.overall_outcome}**; completeness: **${record.completeness_state}**; comparable: **${String(record.comparable)}**.`,
      "",
      "| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |",
      "|---|---|---:|---:|---|---|---|",
      ...record.threshold_results.map(
        (metric) =>
          `| ${escapeMarkdown(metric.metric_id)} | ${escapeMarkdown(metric.comparator)} | ${String(metric.expected_value)} | ${String(metric.measured_value)} | ${escapeMarkdown(metric.unit)} | ${metric.proportion === null ? "NOT_APPLICABLE" : escapeMarkdown(rateText(metric.proportion))} | ${String(metric.passed)} |`,
      ),
      "",
      `Missing required metrics: ${record.missing_metric_ids.length === 0 ? "NONE" : record.missing_metric_ids.map(escapeMarkdown).join(", ")}.`,
      "",
    );
  }
  lines.push("## Precision and recall", "");
  if (report.aggregate.precision_recall_summaries.length === 0) {
    lines.push(
      "NOT_APPLICABLE — no paired TP/FP/FN observations were supplied.",
      "",
    );
  } else {
    lines.push(
      "| Group | TP | FP | FN | Precision | Recall | Precision 95% / note | Recall 95% / note | Uncertainty notes |",
      "|---|---:|---:|---:|---|---|---|---|---|",
      ...report.aggregate.precision_recall_summaries.map(
        (summary) =>
          `| ${escapeMarkdown(summary.group_id)} | ${String(summary.true_positive)} | ${String(summary.false_positive)} | ${String(summary.false_negative)} | ${rateText(summary.precision)} | ${rateText(summary.recall)} | ${escapeMarkdown(uncertaintyText(summary.precision_uncertainty))} | ${escapeMarkdown(uncertaintyText(summary.recall_uncertainty))} | ${summary.uncertainty_notes.length === 0 ? "NONE" : summary.uncertainty_notes.map((note) => note.note).join(", ")} |`,
      ),
      "",
    );
  }
  lines.push("## Failure/error-code counts", "");
  const failures = Object.entries(report.aggregate.failure_error_code_counts);
  if (failures.length === 0) {
    lines.push("NONE", "");
  } else {
    lines.push(
      "| Error code | Cases |",
      "|---|---:|",
      ...failures.map(
        ([code, count]) => `| ${escapeMarkdown(code)} | ${String(count)} |`,
      ),
      "",
    );
  }
  lines.push("## Regression comparison", "");
  if (report.regression_comparisons.length === 0) {
    lines.push(
      "NOT_APPLICABLE — no explicit reviewed regression reference was supplied.",
      "",
    );
  } else {
    lines.push(
      "| Reference | Metric | Candidate | Candidate raw | Reference value | Reference raw | Delta | Relative delta | Comparator | Threshold | Comparable | Passed | Reasons |",
      "|---|---|---:|---|---:|---|---:|---|---|---:|---|---|---|",
      ...report.regression_comparisons.map(
        (comparison) =>
          `| ${escapeMarkdown(comparison.reference_id)} | ${escapeMarkdown(comparison.metric_id)} | ${String(comparison.candidate_value)} | ${optionalRawCounts(comparison.candidate_raw_numerator, comparison.candidate_raw_denominator)} | ${String(comparison.reference_value)} | ${optionalRawCounts(comparison.reference_raw_numerator, comparison.reference_raw_denominator)} | ${escapeMarkdown(comparison.absolute_delta)} | ${comparison.relative_delta === null ? "NOT_MEANINGFUL" : escapeMarkdown(comparison.relative_delta.presentation)} | ${escapeMarkdown(comparison.comparator)} | ${String(comparison.threshold)} | ${String(comparison.comparable)} | ${comparison.passed === null ? "INCOMPARABLE" : String(comparison.passed)} | ${comparison.incomparable_reasons.length === 0 ? "NONE" : comparison.incomparable_reasons.map(escapeMarkdown).join(", ")} |`,
      ),
      "",
    );
  }
  const provenance = report.provenance;
  lines.push(
    "## Provenance",
    "",
    "| Commitment | Value |",
    "|---|---|",
    `| Repository commit | \`${escapeMarkdown(provenance.repository.commit)}\` |`,
    `| Repository tree | \`${escapeMarkdown(provenance.repository.tree)}\` |`,
    `| Runner source | \`${escapeMarkdown(provenance.repository.runner_source_digest)}\` |`,
    `| Schema manifest | \`${escapeMarkdown(provenance.schema.manifest_digest)}\` |`,
    `| Generator format | \`${escapeMarkdown(provenance.schema.generator_format_version)}\` |`,
    `| Corpus | \`${escapeMarkdown(provenance.corpus.version)}\` / \`${escapeMarkdown(provenance.corpus.digest)}\` |`,
    `| Holdout state | \`${escapeMarkdown(provenance.holdout.state)}\` |`,
    `| Runtime/toolchain | \`${escapeMarkdown(provenance.runtime_commitment_digest)}\` |`,
    `| Operating system / architecture | \`${escapeMarkdown(provenance.runtime.operating_system)}\` / \`${escapeMarkdown(provenance.runtime.architecture)}\` |`,
    `| Browser | ${provenance.runtime.browser === undefined ? "NOT_APPLICABLE" : `\`${escapeMarkdown(provenance.runtime.browser.family)} ${escapeMarkdown(provenance.runtime.browser.version)}\``} |`,
    `| Model digest | ${provenance.runtime.model_digest === undefined ? "NOT_APPLICABLE" : `\`${escapeMarkdown(provenance.runtime.model_digest)}\``} |`,
    `| Implementation | \`${escapeMarkdown(provenance.implementation.identity)}@${escapeMarkdown(provenance.implementation.version)}\` / \`${escapeMarkdown(provenance.implementation.source_digest)}\` |`,
    `| Adapter | \`${escapeMarkdown(provenance.adapter.identity)}@${escapeMarkdown(provenance.adapter.version)}\` |`,
    `| Clock | \`${escapeMarkdown(provenance.clock.identity)}@${escapeMarkdown(provenance.clock.version)}\` |`,
    `| Prompt digests | ${provenance.prompt_commitments.length === 0 ? "NOT_APPLICABLE" : provenance.prompt_commitments.map((prompt) => `\`${escapeMarkdown(prompt.digest)}\``).join(", ")} |`,
    "",
    "## Limitations",
    "",
    ...report.limitations.map(
      (limitation) => `- ${escapeMarkdown(limitation)}`,
    ),
    "",
    report.authority_statement,
    "",
  );
  return lines.join("\n");
}

export function renderReportHtml(report: RunReportV1): string {
  validateRunReport(report);
  const semanticJsonDigest = sha256Bytes(renderReportJson(report));
  const countTable = countRows(report.aggregate.counts)
    .map(
      ([label, count]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${String(count)}</td></tr>`,
    )
    .join("");
  const metricTable = report.aggregate.metric_summaries
    .map(
      (metric) =>
        `<tr><th scope="row">${escapeHtml(metric.metric_id)}</th><td>${escapeHtml(metric.unit)}</td><td>${String(metric.required_count)}</td><td>${String(metric.observed_count)}</td><td>${String(metric.missing_count)}</td><td>${String(metric.pass_count)}</td><td>${String(metric.fail_count)}</td><td>${escapeHtml(rateText(metric.pass_rate))}</td><td>${escapeHtml(intervalText(metric.pass_uncertainty))}</td><td>${String(metric.proportion_observation_count)}</td><td>${escapeHtml(optionalRateText(metric.pooled_proportion))}</td><td>${escapeHtml(uncertaintyText(metric.proportion_uncertainty))}</td><td>${metric.uncertainty_notes.length === 0 ? "NONE" : escapeHtml(metric.uncertainty_notes.map((note) => note.note).join(", "))}</td><td>${String(metric.zero_tolerance_failure_count)}</td></tr>`,
    )
    .join("");
  const cases = report.cases
    .map((record) => {
      const thresholds = record.threshold_results
        .map(
          (metric) =>
            `<tr><th scope="row">${escapeHtml(metric.metric_id)}</th><td>${escapeHtml(metric.comparator)}</td><td>${String(metric.expected_value)}</td><td>${String(metric.measured_value)}</td><td>${escapeHtml(metric.unit)}</td><td>${metric.proportion === null ? "NOT_APPLICABLE" : escapeHtml(rateText(metric.proportion))}</td><td>${String(metric.passed)}</td></tr>`,
        )
        .join("");
      return `<section><h3>${escapeHtml(record.case_id)}</h3><p>Case digest: <code>${escapeHtml(record.case_digest)}</code>; threshold-set digest: <code>${escapeHtml(record.threshold_set_digest)}</code>.</p><p>Outcome: <strong>${escapeHtml(record.overall_outcome)}</strong>; completeness: <strong>${escapeHtml(record.completeness_state)}</strong>; comparable: <strong>${String(record.comparable)}</strong>.</p><table><thead><tr><th>Metric</th><th>Comparator</th><th>Expected</th><th>Measured</th><th>Unit</th><th>Raw proportion</th><th>Passed</th></tr></thead><tbody>${thresholds}</tbody></table><p>Missing required metrics: ${record.missing_metric_ids.length === 0 ? "NONE" : record.missing_metric_ids.map(escapeHtml).join(", ")}.</p><p>Peak memory bytes: ${record.peak_memory_bytes === null ? "NOT_MEASURED" : String(record.peak_memory_bytes)}.</p></section>`;
    })
    .join("");
  const precision =
    report.aggregate.precision_recall_summaries.length === 0
      ? "<p>NOT_APPLICABLE — no paired TP/FP/FN observations were supplied.</p>"
      : `<table><thead><tr><th>Group</th><th>TP</th><th>FP</th><th>FN</th><th>Precision</th><th>Recall</th><th>Precision 95% / note</th><th>Recall 95% / note</th><th>Uncertainty notes</th></tr></thead><tbody>${report.aggregate.precision_recall_summaries
          .map(
            (summary) =>
              `<tr><th scope="row">${escapeHtml(summary.group_id)}</th><td>${String(summary.true_positive)}</td><td>${String(summary.false_positive)}</td><td>${String(summary.false_negative)}</td><td>${escapeHtml(rateText(summary.precision))}</td><td>${escapeHtml(rateText(summary.recall))}</td><td>${escapeHtml(uncertaintyText(summary.precision_uncertainty))}</td><td>${escapeHtml(uncertaintyText(summary.recall_uncertainty))}</td><td>${summary.uncertainty_notes.length === 0 ? "NONE" : escapeHtml(summary.uncertainty_notes.map((note) => note.note).join(", "))}</td></tr>`,
          )
          .join("")}</tbody></table>`;
  const failures = Object.entries(report.aggregate.failure_error_code_counts);
  const failureSection =
    failures.length === 0
      ? "<p>NONE</p>"
      : `<table><thead><tr><th>Error code</th><th>Cases</th></tr></thead><tbody>${failures
          .map(
            ([code, count]) =>
              `<tr><th scope="row">${escapeHtml(code)}</th><td>${String(count)}</td></tr>`,
          )
          .join("")}</tbody></table>`;
  const regressions =
    report.regression_comparisons.length === 0
      ? "<p>NOT_APPLICABLE — no explicit reviewed regression reference was supplied.</p>"
      : `<table><thead><tr><th>Reference</th><th>Metric</th><th>Candidate</th><th>Candidate raw</th><th>Reference value</th><th>Reference raw</th><th>Delta</th><th>Relative delta</th><th>Comparator</th><th>Threshold</th><th>Comparable</th><th>Passed</th><th>Reasons</th></tr></thead><tbody>${report.regression_comparisons
          .map(
            (comparison) =>
              `<tr><th scope="row">${escapeHtml(comparison.reference_id)}</th><td>${escapeHtml(comparison.metric_id)}</td><td>${String(comparison.candidate_value)}</td><td>${escapeHtml(optionalRawCounts(comparison.candidate_raw_numerator, comparison.candidate_raw_denominator))}</td><td>${String(comparison.reference_value)}</td><td>${escapeHtml(optionalRawCounts(comparison.reference_raw_numerator, comparison.reference_raw_denominator))}</td><td>${escapeHtml(comparison.absolute_delta)}</td><td>${comparison.relative_delta === null ? "NOT_MEANINGFUL" : escapeHtml(comparison.relative_delta.presentation)}</td><td>${escapeHtml(comparison.comparator)}</td><td>${String(comparison.threshold)}</td><td>${String(comparison.comparable)}</td><td>${comparison.passed === null ? "INCOMPARABLE" : String(comparison.passed)}</td><td>${comparison.incomparable_reasons.length === 0 ? "NONE" : escapeHtml(comparison.incomparable_reasons.join(", "))}</td></tr>`,
          )
          .join("")}</tbody></table>`;
  const provenance = report.provenance;
  const promptDigests =
    provenance.prompt_commitments.length === 0
      ? "NOT_APPLICABLE"
      : provenance.prompt_commitments
          .map((prompt) => escapeHtml(prompt.digest))
          .join(", ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<style>body{font-family:system-ui,sans-serif;line-height:1.45;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#17202a}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #aeb6bf;padding:.45rem;text-align:left;vertical-align:top}thead{background:#edf2f7}.authority,.banner{border:2px solid #7d3c98;padding:.75rem;font-weight:700}.invalid{color:#922b21}code{overflow-wrap:anywhere}</style>
</head>
<body>
<header><h1>${escapeHtml(report.title)}</h1><p class="authority">${report.authority_statement}</p><p class="banner">Comparability: ${report.comparability_banner}</p></header>
<main>
<section><h2>Execution identity</h2><dl><dt>Execution ID</dt><dd><code>${escapeHtml(report.execution_id)}</code></dd><dt>Request digest</dt><dd><code>${escapeHtml(report.request_digest)}</code></dd><dt>Canonical JSON digest</dt><dd><code>${escapeHtml(semanticJsonDigest)}</code></dd><dt>Runner version</dt><dd><code>${escapeHtml(report.runner_version)}</code></dd></dl></section>
<section><h2>Raw case counts</h2><table><tbody>${countTable}</tbody></table><p>Pass rate: ${escapeHtml(rateText(report.aggregate.pass_rate))}</p><p>Comparable rate: ${escapeHtml(rateText(report.aggregate.comparable_rate))}</p></section>
<section><h2>Metric counts, rates, and uncertainty</h2><table><thead><tr><th>Metric</th><th>Unit</th><th>Required</th><th>Observed</th><th>Missing</th><th>Pass</th><th>Fail</th><th>Pass rate</th><th>95% comparable-case uncertainty</th><th>Proportion observations</th><th>Pooled numerator/denominator/rate</th><th>Proportion uncertainty</th><th>Uncertainty notes</th><th>Zero-tolerance failures</th></tr></thead><tbody>${metricTable}</tbody></table></section>
<section><h2>Threshold results</h2>${cases}</section>
<section><h2>Precision and recall</h2>${precision}</section>
<section><h2>Failure/error-code counts</h2>${failureSection}</section>
<section><h2>Regression comparison</h2>${regressions}</section>
<section><h2>Provenance</h2><table><tbody><tr><th scope="row">Repository commit</th><td><code>${escapeHtml(provenance.repository.commit)}</code></td></tr><tr><th scope="row">Repository tree</th><td><code>${escapeHtml(provenance.repository.tree)}</code></td></tr><tr><th scope="row">Runner source</th><td><code>${escapeHtml(provenance.repository.runner_source_digest)}</code></td></tr><tr><th scope="row">Schema manifest</th><td><code>${escapeHtml(provenance.schema.manifest_digest)}</code></td></tr><tr><th scope="row">Generator format</th><td>${escapeHtml(provenance.schema.generator_format_version)}</td></tr><tr><th scope="row">Corpus</th><td>${escapeHtml(provenance.corpus.version)} / <code>${escapeHtml(provenance.corpus.digest)}</code></td></tr><tr><th scope="row">Holdout state</th><td>${escapeHtml(provenance.holdout.state)}</td></tr><tr><th scope="row">Runtime/toolchain</th><td><code>${escapeHtml(provenance.runtime_commitment_digest)}</code></td></tr><tr><th scope="row">Operating system / architecture</th><td>${escapeHtml(provenance.runtime.operating_system)} / ${escapeHtml(provenance.runtime.architecture)}</td></tr><tr><th scope="row">Browser</th><td>${provenance.runtime.browser === undefined ? "NOT_APPLICABLE" : `${escapeHtml(provenance.runtime.browser.family)} ${escapeHtml(provenance.runtime.browser.version)}`}</td></tr><tr><th scope="row">Model digest</th><td>${provenance.runtime.model_digest === undefined ? "NOT_APPLICABLE" : `<code>${escapeHtml(provenance.runtime.model_digest)}</code>`}</td></tr><tr><th scope="row">Implementation</th><td>${escapeHtml(provenance.implementation.identity)}@${escapeHtml(provenance.implementation.version)} / <code>${escapeHtml(provenance.implementation.source_digest)}</code></td></tr><tr><th scope="row">Adapter</th><td>${escapeHtml(provenance.adapter.identity)}@${escapeHtml(provenance.adapter.version)}</td></tr><tr><th scope="row">Clock</th><td>${escapeHtml(provenance.clock.identity)}@${escapeHtml(provenance.clock.version)}</td></tr><tr><th scope="row">Prompt digests</th><td>${promptDigests}</td></tr></tbody></table></section>
<section><h2>Limitations</h2><ul>${report.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul></section>
</main>
<footer><p class="authority">${report.authority_statement}</p></footer>
</body>
</html>
`;
}

export function renderReportBundle(report: RunReportV1): ReportBundleV1 {
  const json = renderReportJson(report);
  const jsonDigest = sha256Bytes(json);
  const markdown = renderReportMarkdown(report);
  const html = renderReportHtml(report);
  return {
    json,
    markdown,
    html,
    manifest: {
      manifest_format_version: REPORT_BUNDLE_MANIFEST_VERSION,
      report_format_version: REPORT_FORMAT_VERSION,
      execution_id: report.execution_id,
      artifacts: [
        {
          format: "JSON",
          digest: jsonDigest,
          byte_count: Buffer.byteLength(json, "utf8"),
        },
        {
          format: "MARKDOWN",
          digest: sha256Bytes(markdown),
          byte_count: Buffer.byteLength(markdown, "utf8"),
        },
        {
          format: "HTML",
          digest: sha256Bytes(html),
          byte_count: Buffer.byteLength(html, "utf8"),
        },
      ],
    },
  };
}
