import { aggregateCaseResults } from "./aggregate.ts";
import {
  compareCanonicalText,
  isContentDigest,
  sha256Canonical,
} from "./canonical.ts";
import {
  CANDIDATE_SELECTOR_FORMAT_VERSION,
  METRIC_SEMANTICS_COMMITMENT_V1,
  REGRESSION_FORMAT_VERSION,
  REGRESSION_SOURCE_FORMAT_VERSION,
  SUPPORTED_METRIC_UNITS,
  THRESHOLD_SEMANTICS_COMMITMENT_V1,
} from "./constants.ts";
import { computeExecutionContentDigest } from "./derive.ts";
import {
  absoluteExactDecimal,
  compareExactDecimals,
  exactDecimalFromNumber,
  exactDecimalIsZero,
  exactDecimalToText,
  exactRatioPresentation,
  subtractExactDecimals,
} from "./exact-decimal.ts";
import { runnerFail } from "./errors.ts";
import type {
  CountRateV1,
  RegressionCandidateSelectorV1,
  RegressionCandidateV1,
  RegressionComparisonV1,
  RegressionCompatibilityV1,
  RegressionReferenceV1,
  RunnerExecutionV1,
} from "./model.ts";

const STABLE_ID = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/u;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/u;
const ENUM_TOKEN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

function objectAt(value: unknown, pointer: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return runnerFail(
      "RUNNER_REGRESSION_STRUCTURE",
      pointer,
      "expected an object",
    );
  }
  return value as Record<string, unknown>;
}

function exactKeys(
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
      "RUNNER_REGRESSION_STRUCTURE",
      pointer,
      `unknown=${unknown.sort().join(",") || "NONE"}; missing=${missing.sort().join(",") || "NONE"}`,
    );
  }
}

function stringAt(value: unknown, pointer: string): string {
  if (typeof value !== "string") {
    return runnerFail(
      "RUNNER_REGRESSION_STRUCTURE",
      pointer,
      "expected a string",
    );
  }
  return value;
}

export function regressionReferencePayload(
  reference: Omit<RegressionReferenceV1, "reference_digest">,
): object {
  return reference;
}

export function computeRegressionReferenceDigest(
  reference: Omit<RegressionReferenceV1, "reference_digest">,
) {
  return sha256Canonical(regressionReferencePayload(reference));
}

function committedReferencePayload(
  reference: RegressionReferenceV1,
): Omit<RegressionReferenceV1, "reference_digest"> {
  return {
    regression_format_version: reference.regression_format_version,
    reference_id: reference.reference_id,
    source_run_digest: reference.source_run_digest,
    metric_id: reference.metric_id,
    unit: reference.unit,
    value: reference.value,
    ...(reference.raw_numerator === undefined ||
    reference.raw_denominator === undefined
      ? {}
      : {
          raw_numerator: reference.raw_numerator,
          raw_denominator: reference.raw_denominator,
        }),
    comparator: reference.comparator,
    allowed_regression: reference.allowed_regression,
    compatibility: reference.compatibility,
  };
}

function validateMetricValue(value: unknown, pointer: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000_000
  ) {
    return runnerFail(
      "RUNNER_REGRESSION_VALUE",
      pointer,
      "regression values must be finite benchmark metric values",
    );
  }
  return value;
}

function validateRawCounts(
  numerator: unknown,
  denominator: unknown,
  value: number,
  pointer: string,
): void {
  if ((numerator === undefined) !== (denominator === undefined)) {
    runnerFail(
      "RUNNER_REGRESSION_RAW_COUNTS",
      pointer,
      "raw numerator and denominator must be supplied together",
    );
  }
  if (numerator === undefined || denominator === undefined) {
    return;
  }
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator < 1 ||
    numerator > denominator
  ) {
    runnerFail(
      "RUNNER_REGRESSION_RAW_COUNTS",
      pointer,
      "raw proportion counts require 0 <= numerator <= positive denominator",
    );
  }
  if (
    compareExactDecimals(
      exactDecimalFromNumber(value),
      exactDecimalFromNumber(numerator / denominator),
    ) !== 0
  ) {
    runnerFail(
      "RUNNER_REGRESSION_RAW_RATE_MISMATCH",
      pointer,
      "raw numerator and denominator do not reproduce the supplied value",
    );
  }
}

function validateCompatibility(
  input: unknown,
  pointer: string,
): asserts input is RegressionCompatibilityV1 {
  const compatibility = objectAt(input, pointer);
  exactKeys(
    compatibility,
    [
      "corpus_digest",
      "runtime_commitment_digest",
      "metric_semantics_digest",
      "threshold_semantics_digest",
      "implementation_identity",
      "prompt_digests",
    ],
    ["browser_family", "browser_version"],
    pointer,
  );
  for (const [name, digest] of [
    ["corpus_digest", compatibility.corpus_digest],
    ["runtime_commitment_digest", compatibility.runtime_commitment_digest],
    ["metric_semantics_digest", compatibility.metric_semantics_digest],
    ["threshold_semantics_digest", compatibility.threshold_semantics_digest],
  ] as const) {
    if (!isContentDigest(digest)) {
      runnerFail(
        "RUNNER_REGRESSION_DIGEST",
        `${pointer}/${name}`,
        "compatibility commitments require SHA-256 digests",
      );
    }
  }
  if (
    typeof compatibility.implementation_identity !== "string" ||
    !IDENTITY.test(compatibility.implementation_identity)
  ) {
    runnerFail(
      "RUNNER_REGRESSION_IDENTITY",
      `${pointer}/implementation_identity`,
      "implementation identity is malformed or executable-shaped",
    );
  }
  if (!Array.isArray(compatibility.prompt_digests)) {
    runnerFail(
      "RUNNER_REGRESSION_STRUCTURE",
      `${pointer}/prompt_digests`,
      "prompt digests must be an array",
    );
  }
  const promptDigests = compatibility.prompt_digests as unknown[];
  if (new Set(promptDigests).size !== promptDigests.length) {
    runnerFail(
      "RUNNER_REGRESSION_PROMPT_DUPLICATE",
      `${pointer}/prompt_digests`,
      "prompt commitments must be unique",
    );
  }
  for (const digest of promptDigests) {
    if (!isContentDigest(digest)) {
      runnerFail(
        "RUNNER_REGRESSION_DIGEST",
        `${pointer}/prompt_digests`,
        "prompt commitments require SHA-256 digests",
      );
    }
  }
  const sorted = [...promptDigests].sort((left, right) =>
    compareCanonicalText(String(left), String(right)),
  );
  if (sorted.some((digest, index) => digest !== promptDigests[index])) {
    runnerFail(
      "RUNNER_REGRESSION_PROMPT_ORDER",
      `${pointer}/prompt_digests`,
      "prompt commitments must be in deterministic ascending order",
    );
  }
  if (
    (compatibility.browser_family === undefined) !==
    (compatibility.browser_version === undefined)
  ) {
    runnerFail(
      "RUNNER_REGRESSION_BROWSER_PAIR",
      pointer,
      "browser family and version must be supplied together",
    );
  }
  if (
    compatibility.browser_family !== undefined &&
    (typeof compatibility.browser_family !== "string" ||
      !IDENTITY.test(compatibility.browser_family))
  ) {
    runnerFail(
      "RUNNER_REGRESSION_IDENTITY",
      `${pointer}/browser_family`,
      "browser family is malformed",
    );
  }
  if (
    compatibility.browser_version !== undefined &&
    (typeof compatibility.browser_version !== "string" ||
      !IDENTITY.test(compatibility.browser_version))
  ) {
    runnerFail(
      "RUNNER_REGRESSION_IDENTITY",
      `${pointer}/browser_version`,
      "browser version is malformed",
    );
  }
}

function validateCandidateSelector(
  input: unknown,
  pointer: string,
): asserts input is RegressionCandidateSelectorV1 {
  const raw = objectAt(input, pointer);
  if (raw.selector_format_version !== CANDIDATE_SELECTOR_FORMAT_VERSION) {
    runnerFail(
      "RUNNER_REGRESSION_VERSION",
      `${pointer}/selector_format_version`,
      "unsupported candidate-selector version",
    );
  }
  const source = raw.source;
  switch (source) {
    case "AGGREGATE_PASS_RATE": {
      exactKeys(raw, ["selector_format_version", "source"], [], pointer);
      return;
    }
    case "AGGREGATE_POOLED_PROPORTION": {
      exactKeys(
        raw,
        ["selector_format_version", "source", "metric_id"],
        [],
        pointer,
      );
      if (
        typeof raw.metric_id !== "string" ||
        !ENUM_TOKEN.test(raw.metric_id)
      ) {
        runnerFail(
          "RUNNER_REGRESSION_METRIC_ID",
          `${pointer}/metric_id`,
          "selector metric identity must be an enum token",
        );
      }
      return;
    }
    case "AGGREGATE_PRECISION":
    case "AGGREGATE_RECALL": {
      exactKeys(
        raw,
        ["selector_format_version", "source", "group_id"],
        [],
        pointer,
      );
      if (typeof raw.group_id !== "string" || !ENUM_TOKEN.test(raw.group_id)) {
        runnerFail(
          "RUNNER_REGRESSION_METRIC_ID",
          `${pointer}/group_id`,
          "selector group identity must be an enum token",
        );
      }
      return;
    }
    case "CASE_THRESHOLD_METRIC": {
      exactKeys(
        raw,
        ["selector_format_version", "source", "case_id", "metric_id"],
        [],
        pointer,
      );
      if (typeof raw.case_id !== "string" || !STABLE_ID.test(raw.case_id)) {
        runnerFail(
          "RUNNER_REGRESSION_CANDIDATE_SOURCE",
          `${pointer}/case_id`,
          "selector case identity must be a canonical stable id",
        );
      }
      if (
        typeof raw.metric_id !== "string" ||
        !ENUM_TOKEN.test(raw.metric_id)
      ) {
        runnerFail(
          "RUNNER_REGRESSION_METRIC_ID",
          `${pointer}/metric_id`,
          "selector metric identity must be an enum token",
        );
      }
      return;
    }
    default: {
      runnerFail(
        "RUNNER_REGRESSION_CANDIDATE_SOURCE",
        `${pointer}/source`,
        "unsupported candidate selector source",
      );
    }
  }
}

function candidateRate(
  rate: CountRateV1 | null,
  pointer: string,
): {
  readonly value: number;
  readonly numerator: number;
  readonly denominator: number;
} {
  const value = rate?.rate;
  if (rate === null || value === null || value === undefined) {
    return runnerFail(
      "RUNNER_REGRESSION_CANDIDATE_SOURCE",
      pointer,
      "selected canonical value has no defined rate to compare",
    );
  }
  return {
    value,
    numerator: rate.numerator,
    denominator: rate.denominator,
  };
}

/**
 * Derived compatibility of the current execution. Corpus, runtime,
 * implementation, prompt, and browser commitments come from execution
 * provenance; metric/threshold semantics digests commit this runner's own
 * versioned measurement semantics.
 */
export function deriveExecutionCompatibility(
  execution: RunnerExecutionV1,
): RegressionCompatibilityV1 {
  const promptDigests = [
    ...new Set(
      execution.provenance.prompt_commitments.map((prompt) => prompt.digest),
    ),
  ].sort(compareCanonicalText);
  const browser = execution.provenance.runtime.browser;
  return {
    corpus_digest: execution.provenance.corpus.digest,
    runtime_commitment_digest: execution.provenance.runtime_commitment_digest,
    metric_semantics_digest: sha256Canonical(METRIC_SEMANTICS_COMMITMENT_V1),
    threshold_semantics_digest: sha256Canonical(
      THRESHOLD_SEMANTICS_COMMITMENT_V1,
    ),
    implementation_identity: execution.provenance.implementation.identity,
    prompt_digests: promptDigests,
    ...(browser === undefined
      ? {}
      : {
          browser_family: browser.family,
          browser_version: browser.version,
        }),
  };
}

/**
 * Resolve a regression candidate from canonical execution truth only. The
 * candidate run digest is the current execution content digest, so a
 * serialized comparison can never claim a foreign execution as its source.
 */
export function resolveRegressionCandidate(
  execution: RunnerExecutionV1,
  selector: unknown,
): RegressionCandidateV1 {
  validateCandidateSelector(selector, "/candidate_selector");
  const executionDigest = computeExecutionContentDigest(
    execution.request_digest,
    execution.records.map((record) => record.record_id),
  );
  let resolved: {
    readonly metric_id: string;
    readonly unit: RegressionCandidateV1["unit"];
    readonly value: number;
    readonly raw?: { readonly numerator: number; readonly denominator: number };
  };
  switch (selector.source) {
    case "AGGREGATE_PASS_RATE": {
      const aggregate = aggregateCaseResults(execution.records);
      const rate = candidateRate(
        aggregate.pass_rate,
        "/candidate_selector/pass_rate",
      );
      resolved = {
        metric_id: "AGGREGATE_PASS_RATE",
        unit: "RATIO",
        value: rate.value,
        raw: { numerator: rate.numerator, denominator: rate.denominator },
      };
      break;
    }
    case "AGGREGATE_POOLED_PROPORTION": {
      const aggregate = aggregateCaseResults(execution.records);
      const metric = aggregate.metric_summaries.find(
        (entry) => entry.metric_id === selector.metric_id,
      );
      if (metric === undefined) {
        return runnerFail(
          "RUNNER_REGRESSION_CANDIDATE_SOURCE",
          "/candidate_selector/metric_id",
          "selected metric does not exist in canonical execution truth",
        );
      }
      const rate = candidateRate(
        metric.pooled_proportion,
        "/candidate_selector/pooled_proportion",
      );
      resolved = {
        metric_id: selector.metric_id,
        unit: "RATIO",
        value: rate.value,
        raw: { numerator: rate.numerator, denominator: rate.denominator },
      };
      break;
    }
    case "AGGREGATE_PRECISION":
    case "AGGREGATE_RECALL": {
      const aggregate = aggregateCaseResults(execution.records);
      const summary = aggregate.precision_recall_summaries.find(
        (entry) => entry.group_id === selector.group_id,
      );
      if (summary === undefined) {
        return runnerFail(
          "RUNNER_REGRESSION_CANDIDATE_SOURCE",
          "/candidate_selector/group_id",
          "selected paired-count group does not exist in canonical execution truth",
        );
      }
      const rate = candidateRate(
        selector.source === "AGGREGATE_PRECISION"
          ? summary.precision
          : summary.recall,
        "/candidate_selector/paired_rate",
      );
      resolved = {
        metric_id: selector.source,
        unit: "RATIO",
        value: rate.value,
        raw: { numerator: rate.numerator, denominator: rate.denominator },
      };
      break;
    }
    case "CASE_THRESHOLD_METRIC": {
      const record = execution.records.find(
        (entry) => entry.case_id === selector.case_id,
      );
      if (record === undefined) {
        return runnerFail(
          "RUNNER_REGRESSION_CANDIDATE_SOURCE",
          "/candidate_selector/case_id",
          "selected case does not exist in canonical execution truth",
        );
      }
      const result = record.threshold_results.find(
        (entry) => entry.metric_id === selector.metric_id,
      );
      if (result === undefined) {
        return runnerFail(
          "RUNNER_REGRESSION_CANDIDATE_SOURCE",
          "/candidate_selector/metric_id",
          "selected threshold metric was not measured in canonical execution truth",
        );
      }
      resolved = {
        metric_id: result.metric_id,
        unit: result.unit,
        value: result.measured_value,
        ...(result.proportion !== null && result.proportion.denominator >= 1
          ? {
              raw: {
                numerator: result.proportion.numerator,
                denominator: result.proportion.denominator,
              },
            }
          : {}),
      };
      break;
    }
  }
  return {
    candidate_run_digest: executionDigest,
    metric_id: resolved.metric_id,
    unit: resolved.unit,
    value: resolved.value,
    ...(resolved.raw === undefined
      ? {}
      : {
          raw_numerator: resolved.raw.numerator,
          raw_denominator: resolved.raw.denominator,
        }),
    implementation_version: execution.provenance.implementation.version,
    compatibility: deriveExecutionCompatibility(execution),
  };
}

export function validateRegressionReference(
  input: unknown,
): asserts input is RegressionReferenceV1 {
  const raw = objectAt(input, "/reference");
  exactKeys(
    raw,
    [
      "regression_format_version",
      "reference_id",
      "reference_digest",
      "source_run_digest",
      "metric_id",
      "unit",
      "value",
      "comparator",
      "allowed_regression",
      "compatibility",
    ],
    ["raw_numerator", "raw_denominator"],
    "/reference",
  );
  if (raw.regression_format_version !== REGRESSION_FORMAT_VERSION) {
    runnerFail(
      "RUNNER_REGRESSION_VERSION",
      "/reference/regression_format_version",
      "unsupported regression reference version",
    );
  }
  const referenceId = stringAt(raw.reference_id, "/reference/reference_id");
  if (!STABLE_ID.test(referenceId)) {
    runnerFail(
      "RUNNER_REGRESSION_REFERENCE_ID",
      "/reference/reference_id",
      "reference identity must use the stable-id contract",
    );
  }
  if (
    !isContentDigest(raw.reference_digest) ||
    !isContentDigest(raw.source_run_digest)
  ) {
    runnerFail(
      "RUNNER_REGRESSION_DIGEST",
      "/reference",
      "reference and source-run digests are required",
    );
  }
  const metricId = stringAt(raw.metric_id, "/reference/metric_id");
  if (!ENUM_TOKEN.test(metricId)) {
    runnerFail(
      "RUNNER_REGRESSION_METRIC_ID",
      "/reference/metric_id",
      "metric identity must be an enum token",
    );
  }
  if (
    typeof raw.unit !== "string" ||
    !SUPPORTED_METRIC_UNITS.includes(
      raw.unit as (typeof SUPPORTED_METRIC_UNITS)[number],
    )
  ) {
    runnerFail(
      "RUNNER_REGRESSION_UNIT",
      "/reference/unit",
      "unsupported metric unit",
    );
  }
  if (
    raw.comparator !== "EXACT_WITHIN_ABSOLUTE_TOLERANCE" &&
    raw.comparator !== "HIGHER_IS_BETTER" &&
    raw.comparator !== "LOWER_IS_BETTER"
  ) {
    runnerFail(
      "RUNNER_REGRESSION_COMPARATOR",
      "/reference/comparator",
      "unsupported regression comparator",
    );
  }
  validateCompatibility(raw.compatibility, "/reference/compatibility");
  const reference = raw as unknown as RegressionReferenceV1;
  if (
    computeRegressionReferenceDigest(committedReferencePayload(reference)) !==
    reference.reference_digest
  ) {
    runnerFail(
      "RUNNER_REGRESSION_REFERENCE_TAMPER",
      "/reference/reference_digest",
      "reference digest does not commit the immutable reference payload",
    );
  }
  const value = validateMetricValue(raw.value, "/reference/value");
  validateMetricValue(raw.allowed_regression, "/reference/allowed_regression");
  validateRawCounts(
    raw.raw_numerator,
    raw.raw_denominator,
    value,
    "/reference",
  );
}

function validateRegressionCandidate(
  input: unknown,
): asserts input is RegressionCandidateV1 {
  const raw = objectAt(input, "/candidate");
  exactKeys(
    raw,
    [
      "candidate_run_digest",
      "metric_id",
      "unit",
      "value",
      "implementation_version",
      "compatibility",
    ],
    ["raw_numerator", "raw_denominator"],
    "/candidate",
  );
  if (!isContentDigest(raw.candidate_run_digest)) {
    runnerFail(
      "RUNNER_REGRESSION_DIGEST",
      "/candidate/candidate_run_digest",
      "candidate run digest is required",
    );
  }
  const metricId = stringAt(raw.metric_id, "/candidate/metric_id");
  if (!ENUM_TOKEN.test(metricId)) {
    runnerFail(
      "RUNNER_REGRESSION_METRIC_ID",
      "/candidate/metric_id",
      "metric identity must be an enum token",
    );
  }
  if (
    typeof raw.unit !== "string" ||
    !SUPPORTED_METRIC_UNITS.includes(
      raw.unit as (typeof SUPPORTED_METRIC_UNITS)[number],
    )
  ) {
    runnerFail(
      "RUNNER_REGRESSION_UNIT",
      "/candidate/unit",
      "unsupported metric unit",
    );
  }
  if (
    typeof raw.implementation_version !== "string" ||
    !SEMVER.test(raw.implementation_version)
  ) {
    runnerFail(
      "RUNNER_REGRESSION_VERSION",
      "/candidate/implementation_version",
      "candidate implementation version must be strict semver",
    );
  }
  const value = validateMetricValue(raw.value, "/candidate/value");
  validateRawCounts(
    raw.raw_numerator,
    raw.raw_denominator,
    value,
    "/candidate",
  );
  validateCompatibility(raw.compatibility, "/candidate/compatibility");
}

function compatibilityReasons(
  reference: RegressionReferenceV1,
  candidate: RegressionCandidateV1,
): string[] {
  const reasons: string[] = [];
  if (reference.metric_id !== candidate.metric_id) {
    reasons.push("METRIC_ID_MISMATCH");
  }
  if (reference.unit !== candidate.unit) {
    reasons.push("METRIC_UNIT_MISMATCH");
  }
  const pairs: readonly [keyof RegressionCompatibilityV1, string][] = [
    ["corpus_digest", "CORPUS_MISMATCH"],
    ["runtime_commitment_digest", "RUNTIME_MISMATCH"],
    ["metric_semantics_digest", "METRIC_SEMANTICS_MISMATCH"],
    ["threshold_semantics_digest", "THRESHOLD_SEMANTICS_MISMATCH"],
    ["implementation_identity", "IMPLEMENTATION_IDENTITY_MISMATCH"],
    ["browser_family", "BROWSER_FAMILY_MISMATCH"],
    ["browser_version", "BROWSER_VERSION_MISMATCH"],
  ];
  for (const [key, reason] of pairs) {
    if (reference.compatibility[key] !== candidate.compatibility[key]) {
      reasons.push(reason);
    }
  }
  if (
    reference.compatibility.prompt_digests.length !==
      candidate.compatibility.prompt_digests.length ||
    reference.compatibility.prompt_digests.some(
      (digest, index) =>
        digest !== candidate.compatibility.prompt_digests[index],
    )
  ) {
    reasons.push("PROMPT_COMMITMENT_MISMATCH");
  }
  return reasons.sort();
}

function derivedRegressionPass(
  comparator: RegressionReferenceV1["comparator"],
  candidateValue: number,
  referenceValue: number,
  allowedRegression: number,
): boolean {
  const candidateDecimal = exactDecimalFromNumber(candidateValue);
  const referenceDecimal = exactDecimalFromNumber(referenceValue);
  const delta = subtractExactDecimals(candidateDecimal, referenceDecimal);
  const threshold = exactDecimalFromNumber(allowedRegression);
  const regressionAmount =
    comparator === "HIGHER_IS_BETTER"
      ? delta.coefficient < 0n
        ? absoluteExactDecimal(delta)
        : exactDecimalFromNumber(0)
      : comparator === "LOWER_IS_BETTER"
        ? delta.coefficient > 0n
          ? delta
          : exactDecimalFromNumber(0)
        : absoluteExactDecimal(delta);
  return compareExactDecimals(regressionAmount, threshold) <= 0;
}

function derivedRelativeDelta(candidateValue: number, referenceValue: number) {
  const candidateDecimal = exactDecimalFromNumber(candidateValue);
  const referenceDecimal = exactDecimalFromNumber(referenceValue);
  const delta = subtractExactDecimals(candidateDecimal, referenceDecimal);
  return {
    absoluteDelta: exactDecimalToText(delta),
    relativeDelta: exactDecimalIsZero(referenceDecimal)
      ? null
      : {
          numerator: exactDecimalToText(delta),
          denominator: exactDecimalToText(referenceDecimal),
          presentation:
            exactRatioPresentation(delta, referenceDecimal) ?? "UNDEFINED",
        },
  };
}

const INCOMPARABLE_REASONS = new Set([
  "BROWSER_FAMILY_MISMATCH",
  "BROWSER_VERSION_MISMATCH",
  "CORPUS_MISMATCH",
  "IMPLEMENTATION_IDENTITY_MISMATCH",
  "METRIC_ID_MISMATCH",
  "METRIC_SEMANTICS_MISMATCH",
  "METRIC_UNIT_MISMATCH",
  "PROMPT_COMMITMENT_MISMATCH",
  "RUNTIME_MISMATCH",
  "THRESHOLD_SEMANTICS_MISMATCH",
]);

export function validateRegressionComparison(
  input: unknown,
): asserts input is RegressionComparisonV1 {
  const raw = objectAt(input, "/comparison");
  exactKeys(
    raw,
    [
      "regression_format_version",
      "reference_id",
      "metric_id",
      "unit",
      "candidate_value",
      "reference_value",
      "absolute_delta",
      "relative_delta",
      "threshold",
      "comparator",
      "comparable",
      "incomparable_reasons",
      "passed",
      "candidate_provenance_digest",
      "reference_provenance_digest",
      "reference_digest",
    ],
    [
      "candidate_raw_numerator",
      "candidate_raw_denominator",
      "reference_raw_numerator",
      "reference_raw_denominator",
      "source",
    ],
    "/comparison",
  );
  if (raw.regression_format_version !== REGRESSION_FORMAT_VERSION) {
    runnerFail(
      "RUNNER_REGRESSION_VERSION",
      "/comparison/regression_format_version",
      "unsupported comparison version",
    );
  }
  if (!STABLE_ID.test(stringAt(raw.reference_id, "/comparison/reference_id"))) {
    runnerFail(
      "RUNNER_REGRESSION_REFERENCE_ID",
      "/comparison/reference_id",
      "comparison reference identity is malformed",
    );
  }
  const metricId = stringAt(raw.metric_id, "/comparison/metric_id");
  if (!ENUM_TOKEN.test(metricId)) {
    runnerFail(
      "RUNNER_REGRESSION_METRIC_ID",
      "/comparison/metric_id",
      "metric identity must be an enum token",
    );
  }
  if (
    typeof raw.unit !== "string" ||
    !SUPPORTED_METRIC_UNITS.includes(
      raw.unit as (typeof SUPPORTED_METRIC_UNITS)[number],
    )
  ) {
    runnerFail(
      "RUNNER_REGRESSION_UNIT",
      "/comparison/unit",
      "unsupported comparison unit",
    );
  }
  if (
    raw.comparator !== "EXACT_WITHIN_ABSOLUTE_TOLERANCE" &&
    raw.comparator !== "HIGHER_IS_BETTER" &&
    raw.comparator !== "LOWER_IS_BETTER"
  ) {
    runnerFail(
      "RUNNER_REGRESSION_COMPARATOR",
      "/comparison/comparator",
      "unsupported comparison comparator",
    );
  }
  const candidateValue = validateMetricValue(
    raw.candidate_value,
    "/comparison/candidate_value",
  );
  const referenceValue = validateMetricValue(
    raw.reference_value,
    "/comparison/reference_value",
  );
  const threshold = validateMetricValue(raw.threshold, "/comparison/threshold");
  validateRawCounts(
    raw.candidate_raw_numerator,
    raw.candidate_raw_denominator,
    candidateValue,
    "/comparison/candidate_raw",
  );
  validateRawCounts(
    raw.reference_raw_numerator,
    raw.reference_raw_denominator,
    referenceValue,
    "/comparison/reference_raw",
  );
  const derivedDelta = derivedRelativeDelta(candidateValue, referenceValue);
  if (
    raw.absolute_delta !== derivedDelta.absoluteDelta ||
    sha256Canonical(raw.relative_delta) !==
      sha256Canonical(derivedDelta.relativeDelta)
  ) {
    runnerFail(
      "RUNNER_REGRESSION_DERIVATION",
      "/comparison/absolute_delta",
      "reported deltas differ from candidate and reference values",
    );
  }
  if (!Array.isArray(raw.incomparable_reasons)) {
    runnerFail(
      "RUNNER_REGRESSION_STRUCTURE",
      "/comparison/incomparable_reasons",
      "incomparable reasons must be an array",
    );
  }
  const reasons = raw.incomparable_reasons.map((reason, index) => {
    const text = stringAt(
      reason,
      `/comparison/incomparable_reasons/${String(index)}`,
    );
    if (!INCOMPARABLE_REASONS.has(text)) {
      return runnerFail(
        "RUNNER_REGRESSION_REASON",
        `/comparison/incomparable_reasons/${String(index)}`,
        "unknown incomparable reason",
      );
    }
    return text;
  });
  const sortedReasons = [...reasons].sort(compareCanonicalText);
  if (
    new Set(reasons).size !== reasons.length ||
    reasons.some((reason, index) => reason !== sortedReasons[index])
  ) {
    runnerFail(
      "RUNNER_REGRESSION_REASON",
      "/comparison/incomparable_reasons",
      "incomparable reasons must be unique and canonically sorted",
    );
  }
  if (typeof raw.comparable !== "boolean") {
    runnerFail(
      "RUNNER_REGRESSION_STRUCTURE",
      "/comparison/comparable",
      "comparable must be boolean",
    );
  }
  const expectedPassed = derivedRegressionPass(
    raw.comparator,
    candidateValue,
    referenceValue,
    threshold,
  );
  if (
    (raw.comparable &&
      (reasons.length !== 0 || raw.passed !== expectedPassed)) ||
    (!raw.comparable && (reasons.length === 0 || raw.passed !== null))
  ) {
    runnerFail(
      "RUNNER_REGRESSION_DERIVATION",
      "/comparison/passed",
      "comparability and pass/fail must be derived from values and reasons",
    );
  }
  for (const [field, value] of [
    ["candidate_provenance_digest", raw.candidate_provenance_digest],
    ["reference_provenance_digest", raw.reference_provenance_digest],
    ["reference_digest", raw.reference_digest],
  ] as const) {
    if (!isContentDigest(value)) {
      runnerFail(
        "RUNNER_REGRESSION_DIGEST",
        `/comparison/${field}`,
        "comparison provenance digest is malformed",
      );
    }
  }
  if (raw.source !== undefined) {
    const source = objectAt(raw.source, "/comparison/source");
    exactKeys(
      source,
      ["source_format_version", "reference", "candidate_selector"],
      [],
      "/comparison/source",
    );
    if (source.source_format_version !== REGRESSION_SOURCE_FORMAT_VERSION) {
      runnerFail(
        "RUNNER_REGRESSION_VERSION",
        "/comparison/source/source_format_version",
        "unsupported comparison-source version",
      );
    }
    const reference = source.reference;
    validateRegressionReference(reference);
    const selector = source.candidate_selector;
    validateCandidateSelector(
      selector,
      "/comparison/source/candidate_selector",
    );
    const referenceRawMatches =
      (raw.reference_raw_numerator === undefined
        ? reference.raw_numerator === undefined
        : raw.reference_raw_numerator === reference.raw_numerator) &&
      (raw.reference_raw_denominator === undefined
        ? reference.raw_denominator === undefined
        : raw.reference_raw_denominator === reference.raw_denominator);
    if (
      raw.reference_id !== reference.reference_id ||
      raw.reference_digest !== reference.reference_digest ||
      raw.reference_provenance_digest !== reference.source_run_digest ||
      raw.reference_value !== reference.value ||
      raw.threshold !== reference.allowed_regression ||
      raw.comparator !== reference.comparator ||
      !referenceRawMatches
    ) {
      runnerFail(
        "RUNNER_REGRESSION_SOURCE_MISMATCH",
        "/comparison/source/reference",
        "comparison projection differs from its embedded immutable reference",
      );
    }
  }
}

export function compareRegression(
  reference: RegressionReferenceV1,
  candidate: RegressionCandidateV1,
): RegressionComparisonV1 {
  validateRegressionReference(reference);
  validateRegressionCandidate(candidate);

  const reasons = compatibilityReasons(reference, candidate);
  const derivedDelta = derivedRelativeDelta(candidate.value, reference.value);
  const passed =
    reasons.length === 0
      ? derivedRegressionPass(
          reference.comparator,
          candidate.value,
          reference.value,
          reference.allowed_regression,
        )
      : null;

  const comparison = {
    regression_format_version: REGRESSION_FORMAT_VERSION,
    reference_id: reference.reference_id,
    metric_id: candidate.metric_id,
    unit: candidate.unit,
    candidate_value: candidate.value,
    reference_value: reference.value,
    ...(candidate.raw_numerator === undefined
      ? {}
      : {
          candidate_raw_numerator: candidate.raw_numerator,
          candidate_raw_denominator: candidate.raw_denominator,
        }),
    ...(reference.raw_numerator === undefined
      ? {}
      : {
          reference_raw_numerator: reference.raw_numerator,
          reference_raw_denominator: reference.raw_denominator,
        }),
    absolute_delta: derivedDelta.absoluteDelta,
    relative_delta: derivedDelta.relativeDelta,
    threshold: reference.allowed_regression,
    comparator: reference.comparator,
    comparable: reasons.length === 0,
    incomparable_reasons: reasons,
    passed,
    candidate_provenance_digest: candidate.candidate_run_digest,
    reference_provenance_digest: reference.source_run_digest,
    reference_digest: reference.reference_digest,
  } satisfies RegressionComparisonV1;
  validateRegressionComparison(comparison);
  return comparison;
}

/**
 * Build a report-embeddable comparison whose candidate side is resolved
 * from the supplied execution's canonical truth and whose complete source
 * material (reviewed reference plus candidate selector) travels with it, so
 * replay can independently reconstruct compatibility, comparability, and
 * the comparator result.
 */
export function compareRegressionForExecution(
  reference: RegressionReferenceV1,
  selector: RegressionCandidateSelectorV1,
  execution: RunnerExecutionV1,
): RegressionComparisonV1 {
  const candidate = resolveRegressionCandidate(execution, selector);
  const base = compareRegression(reference, candidate);
  const comparison: RegressionComparisonV1 = {
    ...base,
    source: {
      source_format_version: REGRESSION_SOURCE_FORMAT_VERSION,
      reference,
      candidate_selector: selector,
    },
  };
  validateRegressionComparison(comparison);
  return comparison;
}
