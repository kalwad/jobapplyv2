import {
  validateBenchmarkResultV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";

import {
  compareCanonicalText,
  sha256Canonical,
  stableIdFromDigest,
  type ContentDigest,
} from "./canonical.ts";
import {
  EVALUATION_RUNNER_VERSION,
  EXECUTION_RECORD_FORMAT_VERSION,
} from "./constants.ts";
import { EvaluationRunnerError, runnerFail } from "./errors.ts";
import type {
  AdapterObservationV1,
  BenchmarkCaseV1,
  BenchmarkResultV1,
  BenchmarkResultV1EnvironmentMatchState,
  BenchmarkResultV1HashState,
  BenchmarkResultV1HoldoutState,
  CaseExecutionRecordV1,
  DerivedOutcomeV1,
  ErrorTaxonomyV1ErrorCode,
  EvaluationAdapterV1,
  ExecutionRequestV1,
  RunnerClockV1,
  RunnerExecutionV1,
  RunnerTrustedContextV1,
} from "./model.ts";
import { computeThresholdSetDigest, evaluateThresholds } from "./thresholds.ts";
import {
  deepFreeze,
  validateAdapterObservation,
  validateExecutionRequest,
  validateTrustedContext,
} from "./validate.ts";

const UTC_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$/u;

function timestampMilliseconds(value: string, pointer: string): number {
  if (!UTC_TIMESTAMP.test(value)) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "clock must return a canonical UTC timestamp",
    );
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "clock timestamp is not a real calendar instant",
    );
  }
  return milliseconds;
}

function deriveDuration(startedAt: string, endedAt: string): number {
  const started = timestampMilliseconds(startedAt, "/clock/started_at");
  const ended = timestampMilliseconds(endedAt, "/clock/ended_at");
  const duration = ended - started;
  if (
    !Number.isSafeInteger(duration) ||
    duration < 0 ||
    duration > 86_400_000
  ) {
    return runnerFail(
      "RUNNER_CLOCK_DURATION",
      "/clock",
      "duration must be an integer from 0 through 86400000 milliseconds",
    );
  }
  return duration;
}

function deriveEnvironmentState(
  request: ExecutionRequestV1,
  benchmarkCase: BenchmarkCaseV1,
): BenchmarkResultV1EnvironmentMatchState {
  if (request.runtime.environment_state === "UNKNOWN") {
    return "UNKNOWN";
  }
  const required = benchmarkCase.environment_requirements;
  const actual = request.runtime;
  const mismatch =
    required.runtime_profile !== actual.runtime_family ||
    required.platform_profile !== actual.platform_profile ||
    required.toolchain_digest !== actual.toolchain_digest ||
    (required.adapter_version !== undefined &&
      required.adapter_version !== request.adapter.version) ||
    (required.browser_family !== undefined &&
      required.browser_family !== actual.browser?.family) ||
    (required.browser_version !== undefined &&
      required.browser_version !== actual.browser?.version) ||
    (required.model_profile_ref !== undefined &&
      required.model_profile_ref !== actual.model_profile_ref);
  return mismatch ? "MISMATCH" : "MATCH";
}

function deriveHashState(
  benchmarkCase: BenchmarkCaseV1,
  observation: AdapterObservationV1,
): BenchmarkResultV1HashState {
  if (observation.status === "FAILED_SETUP") {
    return "UNKNOWN";
  }
  const actual = new Map(
    observation.artifact_observations.map((artifact) => [
      artifact.artifact_ref,
      artifact.content_digest,
    ]),
  );
  if (
    benchmarkCase.input_artifacts.some(
      (artifact) =>
        actual.has(artifact.artifact_ref) &&
        actual.get(artifact.artifact_ref) !== artifact.artifact_digest,
    )
  ) {
    return "MISMATCH";
  }
  return benchmarkCase.input_artifacts.every(
    (artifact) =>
      actual.get(artifact.artifact_ref) === artifact.artifact_digest,
  )
    ? "MATCH"
    : "UNKNOWN";
}

function deriveHoldoutState(
  request: ExecutionRequestV1,
): BenchmarkResultV1HoldoutState {
  return request.holdout.state;
}

function addCode(
  codes: Set<ErrorTaxonomyV1ErrorCode>,
  condition: boolean,
  code: ErrorTaxonomyV1ErrorCode,
): void {
  if (condition) {
    codes.add(code);
  }
}

function deriveFailureCodes(
  observation: AdapterObservationV1,
  environment: BenchmarkResultV1EnvironmentMatchState,
  hashes: BenchmarkResultV1HashState,
  holdout: BenchmarkResultV1HoldoutState,
  thresholdFailed: boolean,
): readonly ErrorTaxonomyV1ErrorCode[] {
  const codes = new Set(observation.failure_error_codes);
  addCode(codes, observation.status !== "COMPLETE", "BENCHMARK_INCOMPLETE_RUN");
  addCode(codes, environment === "MISMATCH", "BENCHMARK_ENVIRONMENT_MISMATCH");
  addCode(codes, hashes === "MISMATCH", "BENCHMARK_HASH_MISMATCH");
  addCode(
    codes,
    holdout === "INVALID" || holdout === "UNAVAILABLE",
    "BENCHMARK_INVALID_HOLDOUT_STATE",
  );
  addCode(codes, thresholdFailed, "BENCHMARK_THRESHOLD_FAILED");
  return [...codes].sort();
}

function deriveComparable(
  completeness: AdapterObservationV1["status"],
  environment: BenchmarkResultV1EnvironmentMatchState,
  hashes: BenchmarkResultV1HashState,
  holdout: BenchmarkResultV1HoldoutState,
): boolean {
  return (
    completeness === "COMPLETE" &&
    environment === "MATCH" &&
    hashes === "MATCH" &&
    (holdout === "VALID" || holdout === "NOT_APPLICABLE")
  );
}

function deriveOutcome(
  observation: AdapterObservationV1,
  comparable: boolean,
  thresholdFailed: boolean,
  failureCodes: readonly ErrorTaxonomyV1ErrorCode[],
): DerivedOutcomeV1 {
  if (observation.status !== "COMPLETE" || !comparable) {
    return "INVALID";
  }
  return thresholdFailed || failureCodes.length > 0 ? "FAIL" : "PASS";
}

function runtimeMetadata(
  request: ExecutionRequestV1,
  observation: AdapterObservationV1,
) {
  return {
    runtime_family: request.runtime.runtime_family,
    runtime_version: request.runtime.runtime_version,
    toolchain_digest: request.runtime.toolchain_digest,
    platform_profile: request.runtime.platform_profile,
    adapter_version: request.adapter.version,
    ...(observation.model_participated &&
    request.runtime.model_digest !== undefined
      ? { model_digest: request.runtime.model_digest }
      : {}),
    ...(observation.browser_participated &&
    request.runtime.browser !== undefined
      ? {
          browser_family: request.runtime.browser.family,
          browser_version: request.runtime.browser.version,
        }
      : {}),
    operating_system: request.runtime.operating_system,
    architecture: request.runtime.architecture,
  };
}

function holdoutDigest(request: ExecutionRequestV1): ContentDigest {
  return request.holdout.policy === "DEVELOPMENT_NOT_APPLICABLE_V1"
    ? request.holdout.development_commitment_digest
    : request.holdout.manifest_digest;
}

function validateCanonicalResult(result: BenchmarkResultV1): BenchmarkResultV1 {
  const structural = validateBenchmarkResultV1(result);
  if (!structural.valid) {
    return runnerFail(
      "RUNNER_BENCHMARK_RESULT_STRUCTURE",
      "/result",
      structural.errors.join("; "),
    );
  }
  const semantic = validateSemanticContractV1(
    "urn:japp:schema:benchmark:result:v1",
    structural.value,
  );
  if (!semantic.valid) {
    return runnerFail(
      "RUNNER_BENCHMARK_RESULT_SEMANTIC",
      "/result",
      semantic.issues.map((issue) => issue.rule_id).join(","),
    );
  }
  return structural.value;
}

interface TimedObservation {
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly observation: AdapterObservationV1;
}

function failedSetupObservation(): AdapterObservationV1 {
  return {
    observation_format_version: "1.0.0",
    status: "FAILED_SETUP",
    metrics: [],
    artifact_observations: [],
    artifact_report_digests: [],
    failure_error_codes: ["BENCHMARK_INCOMPLETE_RUN"],
    used_prompt_ids: [],
    model_participated: false,
    browser_participated: false,
    peak_memory_bytes: null,
    paired_counts: [],
  };
}

async function observeCase(
  benchmarkCase: BenchmarkCaseV1,
  request: ExecutionRequestV1,
  adapter: EvaluationAdapterV1,
  clock: RunnerClockV1,
): Promise<TimedObservation> {
  const caseDigestBefore = sha256Canonical(benchmarkCase);
  const startedAt = clock.now();
  let rawObservation: unknown;
  try {
    rawObservation = await adapter.evaluate(benchmarkCase);
  } catch {
    rawObservation = failedSetupObservation();
  }
  const endedAt = clock.now();
  const durationMs = deriveDuration(startedAt, endedAt);
  if (sha256Canonical(benchmarkCase) !== caseDigestBefore) {
    return runnerFail(
      "RUNNER_CASE_MUTATION",
      `/cases/${benchmarkCase.case_id}`,
      "adapter attempted to mutate the immutable case or thresholds",
    );
  }
  const observation = validateAdapterObservation(
    rawObservation,
    request,
    benchmarkCase,
  );
  return { startedAt, endedAt, durationMs, observation };
}

function buildCaseRecord(
  request: ExecutionRequestV1,
  benchmarkCase: BenchmarkCaseV1,
  timed: TimedObservation,
): CaseExecutionRecordV1 {
  const { observation } = timed;
  const caseCommitment = request.case_commitments.find(
    (entry) => entry.case_id === benchmarkCase.case_id,
  );
  if (caseCommitment === undefined) {
    return runnerFail(
      "RUNNER_CASE_COMMITMENT_MISSING",
      `/cases/${benchmarkCase.case_id}`,
      "validated request lost its case commitment",
    );
  }
  const thresholdEvaluation =
    observation.status === "FAILED_SETUP"
      ? {
          results: [],
          missing_metric_ids: benchmarkCase.thresholds
            .map((entry) => entry.metric_id)
            .sort(),
        }
      : evaluateThresholds(
          benchmarkCase,
          observation.metrics,
          observation.status === "COMPLETE" ? "COMPLETE" : "PARTIAL",
        );
  const environment = deriveEnvironmentState(request, benchmarkCase);
  const hashes = deriveHashState(benchmarkCase, observation);
  const holdout = deriveHoldoutState(request);
  const comparable = deriveComparable(
    observation.status,
    environment,
    hashes,
    holdout,
  );
  const thresholdFailed = thresholdEvaluation.results.some(
    (result) => !result.passed,
  );
  const failureCodes = deriveFailureCodes(
    observation,
    environment,
    hashes,
    holdout,
    thresholdFailed,
  );
  const outcome = deriveOutcome(
    observation,
    comparable,
    thresholdFailed,
    failureCodes,
  );
  const observationDigest = sha256Canonical(observation);
  const identityDigest = sha256Canonical({
    identity_version: "1.0.0",
    request_digest: sha256Canonical(request),
    case_id: benchmarkCase.case_id,
    case_digest: caseCommitment.case_digest,
    observation_digest: observationDigest,
  });
  const usedPrompts = observation.used_prompt_ids
    .map((id) => {
      const prompt = request.prompt_commitments.find(
        (commitment) => commitment.prompt_id === id,
      );
      if (prompt === undefined) {
        return runnerFail(
          "RUNNER_PROMPT_COMMITMENT_MISSING",
          `/prompts/${id}`,
          "used prompt has no commitment",
        );
      }
      return prompt;
    })
    .sort((left, right) =>
      compareCanonicalText(left.prompt_id, right.prompt_id),
    );

  let canonicalResult: BenchmarkResultV1 | undefined;
  if (observation.status !== "FAILED_SETUP") {
    canonicalResult = validateCanonicalResult({
      result_id: stableIdFromDigest("evalresult", identityDigest),
      case_id: benchmarkCase.case_id,
      case_digest: caseCommitment.case_digest,
      repository_commit: request.repository.commit,
      repository_tree: request.repository.tree,
      schema_manifest_digest: request.schema.manifest_digest,
      generator_format_version: request.schema.generator_format_version,
      corpus_digest: request.corpus.digest,
      holdout_manifest_digest: holdoutDigest(request),
      runtime_metadata: runtimeMetadata(request, observation),
      started_at: timed.startedAt,
      ended_at: timed.endedAt,
      duration_ms: timed.durationMs,
      metric_results: thresholdEvaluation.results.map((result) => ({
        metric_id: result.metric_id,
        measured_value: result.measured_value,
        unit: result.unit,
        threshold_digest: result.threshold_set_digest,
        passed: result.passed,
      })),
      case_threshold_set_digest: benchmarkCase.threshold_set_digest,
      evaluated_threshold_set_digest: benchmarkCase.threshold_set_digest,
      failure_error_codes: failureCodes,
      artifact_report_digests: observation.artifact_report_digests,
      completeness_state: observation.status,
      environment_match_state: environment,
      hash_state: hashes,
      holdout_state: holdout,
      comparable,
      overall_outcome: outcome,
    });
  }

  const record: CaseExecutionRecordV1 = {
    record_format_version: EXECUTION_RECORD_FORMAT_VERSION,
    record_id: stableIdFromDigest("evalrecord", identityDigest),
    case_id: benchmarkCase.case_id,
    case_digest: caseCommitment.case_digest,
    threshold_set_digest: computeThresholdSetDigest(benchmarkCase),
    implementation: request.implementation,
    adapter: request.adapter,
    started_at: timed.startedAt,
    ended_at: timed.endedAt,
    duration_ms: timed.durationMs,
    completeness_state: observation.status,
    environment_match_state: environment,
    hash_state: hashes,
    holdout_state: holdout,
    comparable,
    overall_outcome: outcome,
    required_metric_units: [...benchmarkCase.thresholds]
      .sort((left, right) =>
        compareCanonicalText(left.metric_id, right.metric_id),
      )
      .map((threshold) => ({
        metric_id: threshold.metric_id,
        unit: threshold.unit,
      })),
    threshold_results: thresholdEvaluation.results,
    missing_metric_ids: thresholdEvaluation.missing_metric_ids,
    failure_error_codes: failureCodes,
    artifact_report_digests: observation.artifact_report_digests,
    used_prompt_commitments: usedPrompts,
    model_participated: observation.model_participated,
    browser_participated: observation.browser_participated,
    peak_memory_bytes: observation.peak_memory_bytes,
    paired_counts: observation.paired_counts,
    observation_digest: observationDigest,
    ...(canonicalResult === undefined
      ? {}
      : { canonical_result: canonicalResult }),
  };
  return deepFreeze(record);
}

function assertParticipationProvenance(
  request: ExecutionRequestV1,
  records: readonly CaseExecutionRecordV1[],
): void {
  const modelParticipated = records.some((record) => record.model_participated);
  if (modelParticipated !== (request.runtime.model_digest !== undefined)) {
    runnerFail(
      "RUNNER_MODEL_PROVENANCE",
      "/runtime/model_digest",
      modelParticipated
        ? "an actual model participated but no model digest was committed"
        : "a model digest was supplied although no model participated",
    );
  }
  const browserParticipated = records.some(
    (record) => record.browser_participated,
  );
  if (browserParticipated !== (request.runtime.browser !== undefined)) {
    runnerFail(
      "RUNNER_BROWSER_PROVENANCE",
      "/runtime/browser",
      browserParticipated
        ? "browser participation requires exact browser metadata"
        : "browser metadata was supplied although no browser participated",
    );
  }
  const usedPromptIds = new Set(
    records.flatMap((record) =>
      record.used_prompt_commitments.map((prompt) => prompt.prompt_id),
    ),
  );
  const committedPromptIds = new Set(
    request.prompt_commitments.map((prompt) => prompt.prompt_id),
  );
  if (
    usedPromptIds.size !== committedPromptIds.size ||
    [...committedPromptIds].some((id) => !usedPromptIds.has(id))
  ) {
    runnerFail(
      "RUNNER_PROMPT_PROVENANCE",
      "/prompt_commitments",
      "prompt commitments must be exactly the prompts that participated",
    );
  }
}

export async function runEvaluation(
  input: unknown,
  adapter: EvaluationAdapterV1,
  clock: RunnerClockV1,
  trustedContext: RunnerTrustedContextV1,
): Promise<RunnerExecutionV1> {
  const request = validateExecutionRequest(input);
  validateTrustedContext(request, trustedContext);
  if (
    adapter.identity !== request.adapter.identity ||
    adapter.version !== request.adapter.version
  ) {
    runnerFail(
      "RUNNER_ADAPTER_IDENTITY_MISMATCH",
      "/adapter",
      "trusted in-process adapter differs from the serialized commitment",
    );
  }
  if (
    clock.identity !== request.clock.identity ||
    clock.version !== request.clock.version
  ) {
    runnerFail(
      "RUNNER_CLOCK_IDENTITY_MISMATCH",
      "/clock",
      "trusted timing provider differs from the serialized commitment",
    );
  }

  const requestDigest = sha256Canonical(request);
  const records: CaseExecutionRecordV1[] = [];
  for (const benchmarkCase of [...request.cases].sort((left, right) =>
    compareCanonicalText(left.case_id, right.case_id),
  )) {
    const timed = await observeCase(benchmarkCase, request, adapter, clock);
    records.push(buildCaseRecord(request, benchmarkCase, timed));
  }
  assertParticipationProvenance(request, records);
  const executionDigest = sha256Canonical({
    identity_version: "1.0.0",
    request_digest: requestDigest,
    record_ids: records.map((record) => record.record_id),
  });
  return deepFreeze({
    execution_format_version: "1.0.0",
    runner_version: EVALUATION_RUNNER_VERSION,
    execution_id: stableIdFromDigest("evalrun", executionDigest),
    request_digest: requestDigest,
    records,
    provenance: {
      repository: request.repository,
      schema: request.schema,
      corpus: request.corpus,
      holdout: request.holdout,
      runtime: request.runtime,
      runtime_commitment_digest: request.runtime_commitment_digest,
      implementation: request.implementation,
      adapter: request.adapter,
      clock: request.clock,
      prompt_commitments: request.prompt_commitments,
    },
    output_policy: request.output_policy,
  });
}

export function isEvaluationRunnerError(
  error: unknown,
): error is EvaluationRunnerError {
  return error instanceof EvaluationRunnerError;
}
