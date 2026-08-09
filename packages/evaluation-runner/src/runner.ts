import { sha256Canonical } from "./canonical.ts";
import { REPLAY_WITNESS_FORMAT_VERSION } from "./constants.ts";
import { deriveExecutionFromWitness } from "./derive.ts";
import { EvaluationRunnerError, runnerFail } from "./errors.ts";
import type {
  AdapterObservationV1,
  BenchmarkCaseV1,
  EvaluationAdapterV1,
  ExecutionCaseWitnessV1,
  ExecutionRequestV1,
  RunnerClockV1,
  RunnerExecutionV1,
  RunnerTrustedContextV1,
} from "./model.ts";
import { deriveDurationMilliseconds } from "./time.ts";
import {
  validateAdapterObservation,
  validateExecutionRequest,
  validateTrustedContext,
} from "./validate.ts";

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
): Promise<ExecutionCaseWitnessV1> {
  const caseDigestBefore = sha256Canonical(benchmarkCase);
  const startedAt = clock.now();
  let rawObservation: unknown;
  try {
    rawObservation = await adapter.evaluate(benchmarkCase);
  } catch {
    rawObservation = failedSetupObservation();
  }
  const endedAt = clock.now();
  deriveDurationMilliseconds(startedAt, endedAt, "/clock");
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
  return {
    case_id: benchmarkCase.case_id,
    started_at: startedAt,
    ended_at: endedAt,
    observation,
  };
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

  const caseWitnesses: ExecutionCaseWitnessV1[] = [];
  for (const benchmarkCase of request.cases) {
    caseWitnesses.push(
      await observeCase(benchmarkCase, request, adapter, clock),
    );
  }
  return deriveExecutionFromWitness({
    witness_format_version: REPLAY_WITNESS_FORMAT_VERSION,
    request,
    case_witnesses: caseWitnesses,
  });
}

export function isEvaluationRunnerError(
  error: unknown,
): error is EvaluationRunnerError {
  return error instanceof EvaluationRunnerError;
}
