import {
  validateBenchmarkResultV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";

import {
  canonicalJson,
  compareCanonicalText,
  sha256Canonical,
  stableIdFromDigest,
  type ContentDigest,
} from "./canonical.ts";
import {
  EVALUATION_RUNNER_VERSION,
  EXECUTION_RECORD_FORMAT_VERSION,
  REPLAY_WITNESS_FORMAT_VERSION,
} from "./constants.ts";
import { runnerFail } from "./errors.ts";
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
  ExecutionCaseWitnessV1,
  ExecutionReplayWitnessV1,
  ExecutionRequestV1,
  RunnerExecutionV1,
} from "./model.ts";
import { computeThresholdSetDigest, evaluateThresholds } from "./thresholds.ts";
import { deriveDurationMilliseconds, validateUtcInstantText } from "./time.ts";
import {
  deepFreeze,
  validateAdapterObservation,
  validateExecutionRequest,
} from "./validate.ts";

/**
 * Single derivation authority for M02-W05 executions. `runEvaluation` and
 * report replay both call `deriveExecutionFromWitness`, so serialized
 * execution truth is only ever accepted when it is independently
 * re-derivable from the canonical replay witness — the validated request
 * plus every case's actual timing window and normalized observation.
 */

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

function deriveCaseRecord(
  request: ExecutionRequestV1,
  requestDigest: ContentDigest,
  benchmarkCase: BenchmarkCaseV1,
  caseWitness: ExecutionCaseWitnessV1,
): CaseExecutionRecordV1 {
  const observation = caseWitness.observation;
  const durationMs = deriveDurationMilliseconds(
    caseWitness.started_at,
    caseWitness.ended_at,
    `/case_witnesses/${benchmarkCase.case_id}`,
  );
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
    request_digest: requestDigest,
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
      started_at: caseWitness.started_at,
      ended_at: caseWitness.ended_at,
      duration_ms: durationMs,
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
    started_at: caseWitness.started_at,
    ended_at: caseWitness.ended_at,
    duration_ms: durationMs,
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

function witnessObject(
  value: unknown,
  pointer: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return runnerFail(
      "RUNNER_WITNESS_STRUCTURE",
      pointer,
      "expected an object",
    );
  }
  return value as Record<string, unknown>;
}

function witnessExactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  pointer: string,
): void {
  const allowed = new Set(required);
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !(key in record));
  if (unknown.length > 0 || missing.length > 0) {
    runnerFail(
      "RUNNER_WITNESS_STRUCTURE",
      pointer,
      `unknown=${unknown.sort().join(",") || "NONE"}; missing=${missing.sort().join(",") || "NONE"}`,
    );
  }
}

/**
 * Fail-closed validation of a replay witness. The request re-runs the full
 * execution-request boundary and must already be in canonical validated
 * form; every case witness must cover exactly the request cases in
 * canonical order, carry contract-valid UTC instants, and hold the
 * canonical normalized form of its adapter observation, so set-like
 * observation ordering is deterministic and non-canonical replay source is
 * rejected instead of being silently repaired.
 */
export function validateReplayWitness(
  input: unknown,
): ExecutionReplayWitnessV1 {
  const root = witnessObject(input, "/replay_witness");
  witnessExactKeys(
    root,
    ["witness_format_version", "request", "case_witnesses"],
    "/replay_witness",
  );
  if (root.witness_format_version !== REPLAY_WITNESS_FORMAT_VERSION) {
    runnerFail(
      "RUNNER_WITNESS_STRUCTURE",
      "/replay_witness/witness_format_version",
      "unsupported replay-witness version",
    );
  }
  const request = validateExecutionRequest(root.request);
  if (canonicalJson(root.request) !== canonicalJson(request)) {
    runnerFail(
      "RUNNER_WITNESS_NONCANONICAL",
      "/replay_witness/request",
      "witness request is not in canonical validated form",
    );
  }
  if (!Array.isArray(root.case_witnesses)) {
    return runnerFail(
      "RUNNER_WITNESS_STRUCTURE",
      "/replay_witness/case_witnesses",
      "expected an array of case witnesses",
    );
  }
  if (root.case_witnesses.length !== request.cases.length) {
    runnerFail(
      "RUNNER_WITNESS_CASE_COVERAGE",
      "/replay_witness/case_witnesses",
      "witness must cover exactly the request cases",
    );
  }
  const caseWitnesses: ExecutionCaseWitnessV1[] = [];
  for (const [index, entry] of root.case_witnesses.entries()) {
    const pointer = `/replay_witness/case_witnesses/${String(index)}`;
    const witness = witnessObject(entry, pointer);
    witnessExactKeys(
      witness,
      ["case_id", "started_at", "ended_at", "observation"],
      pointer,
    );
    const benchmarkCase = request.cases[index];
    if (benchmarkCase === undefined) {
      return runnerFail(
        "RUNNER_WITNESS_CASE_COVERAGE",
        pointer,
        "witness case index is outside the request case inventory",
      );
    }
    if (witness.case_id !== benchmarkCase.case_id) {
      runnerFail(
        "RUNNER_WITNESS_CASE_COVERAGE",
        `${pointer}/case_id`,
        "case witnesses must match the canonical sorted request case order",
      );
    }
    const startedAt = validateUtcInstantText(
      witness.started_at,
      `${pointer}/started_at`,
    );
    const endedAt = validateUtcInstantText(
      witness.ended_at,
      `${pointer}/ended_at`,
    );
    const observation = validateAdapterObservation(
      witness.observation,
      request,
      benchmarkCase,
    );
    if (canonicalJson(witness.observation) !== canonicalJson(observation)) {
      runnerFail(
        "RUNNER_WITNESS_NONCANONICAL",
        `${pointer}/observation`,
        "witness observation is not in canonical normalized form",
      );
    }
    caseWitnesses.push({
      case_id: benchmarkCase.case_id,
      started_at: startedAt,
      ended_at: endedAt,
      observation,
    });
  }
  return deepFreeze({
    witness_format_version: REPLAY_WITNESS_FORMAT_VERSION,
    request,
    case_witnesses: caseWitnesses,
  });
}

/** Content digest binding an execution to its request and derived records. */
export function computeExecutionContentDigest(
  requestDigest: ContentDigest,
  recordIds: readonly string[],
): ContentDigest {
  return sha256Canonical({
    identity_version: "1.0.0",
    request_digest: requestDigest,
    record_ids: recordIds,
  });
}

/**
 * The one pure derivation path from canonical replay source to execution
 * truth. Both live execution and report replay must call this function;
 * every digest, identity, state, and derived field is recomputed here from
 * the witness alone.
 */
export function deriveExecutionFromWitness(input: unknown): RunnerExecutionV1 {
  const witness = validateReplayWitness(input);
  const request = witness.request;
  const requestDigest = sha256Canonical(request);
  const records = request.cases.map((benchmarkCase, index) => {
    const caseWitness = witness.case_witnesses[index];
    if (caseWitness === undefined) {
      return runnerFail(
        "RUNNER_WITNESS_CASE_COVERAGE",
        `/replay_witness/case_witnesses/${String(index)}`,
        "validated witness lost a case witness",
      );
    }
    return deriveCaseRecord(request, requestDigest, benchmarkCase, caseWitness);
  });
  assertParticipationProvenance(request, records);
  const executionDigest = computeExecutionContentDigest(
    requestDigest,
    records.map((record) => record.record_id),
  );
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
    replay_witness: witness,
  });
}
