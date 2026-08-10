import type {
  BenchmarkCaseV1,
  ErrorTaxonomyV1ErrorCode,
} from "@japp/contracts/generated";

import {
  canonicalJson,
  computeThresholdSetDigest,
  DEVELOPMENT_HOLDOUT_COMMITMENT,
  runEvaluation,
  sha256Canonical,
  type AdapterObservationV1,
  type ContentDigest,
  type EvaluationAdapterV1,
  type ExecutionRequestV1,
  type MeasuredMetricV1,
  type PairedCountObservationV1,
  type PromptCommitmentV1,
  type RunnerClockV1,
  type RunnerExecutionV1,
  type RunnerTrustedContextV1,
} from "../../../src/index.ts";

export function digest(character: string): ContentDigest {
  return `sha256:${character.repeat(64)}`;
}

export function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`missing test fixture value: ${label}`);
  }
  return value;
}

export const FIXTURE_COMMIT = "1".repeat(40);
export const FIXTURE_TREE = "2".repeat(40);
export const SCHEMA_DIGEST = digest("3");
export const RUNNER_SOURCE_DIGEST = digest("4");
export const CORPUS_DIGEST = digest("5");
export const TOOLCHAIN_DIGEST = digest("6");
export const ARTIFACT_DIGEST = digest("7");
export const RAW_REPORT_DIGEST = digest("8");

function stableBody(index: number): string {
  return String(index).padStart(26, "0");
}

export interface CaseOptions {
  readonly index?: number;
  readonly thresholds?: BenchmarkCaseV1["thresholds"];
  readonly artifactDigest?: ContentDigest;
  readonly environment?: Partial<BenchmarkCaseV1["environment_requirements"]>;
  readonly corpusDigest?: ContentDigest;
  readonly corpusVersion?: string;
  readonly holdoutVisibility?: BenchmarkCaseV1["holdout_visibility"];
  readonly syntheticData?: boolean;
}

export function makeCase(options: CaseOptions = {}): BenchmarkCaseV1 {
  const index = options.index ?? 1;
  const thresholds = options.thresholds ?? [
    {
      metric_id: "QUALITY_SCORE",
      comparator: "AT_LEAST",
      expected_value: 0.8,
      unit: "SCORE",
    },
  ];
  const thresholdSetRef = `thresholdset_${stableBody(index)}`;
  const thresholdSetDigest = computeThresholdSetDigest({
    threshold_set_ref: thresholdSetRef,
    thresholds,
  });
  return {
    case_id: `benchmarkcase_${stableBody(index)}`,
    case_schema_version: "BENCHMARK_CASE_V1",
    benchmark_family: "CONTRACT_COMPATIBILITY",
    corpus_version: options.corpusVersion ?? "0.3.0",
    corpus_digest: options.corpusDigest ?? CORPUS_DIGEST,
    input_artifacts: [
      {
        artifact_ref: `artifact_${stableBody(index)}`,
        artifact_digest: options.artifactDigest ?? ARTIFACT_DIGEST,
        schema_ref: "urn:japp:schema:fixture:test-record:v1",
      },
    ],
    expected_behavior: "MEASURE",
    threshold_set_ref: thresholdSetRef,
    threshold_set_digest: thresholdSetDigest,
    thresholds,
    environment_requirements: {
      runtime_profile: "NODE",
      platform_profile: "DEVELOPMENT",
      toolchain_digest: TOOLCHAIN_DIGEST,
      adapter_version: "1.0.0",
      ...options.environment,
    },
    synthetic_data: options.syntheticData ?? true,
    provenance: {
      source_kind: "GENERATED",
      source_id: `source_${stableBody(index)}`,
      observed_at: "2026-08-07T20:00:00Z",
      source_digest: options.artifactDigest ?? ARTIFACT_DIGEST,
    },
    holdout_visibility: options.holdoutVisibility ?? "PUBLIC_SYNTHETIC",
    applicable_platform_profiles: ["DEVELOPMENT"],
  };
}

export interface RequestOptions {
  readonly prompts?: readonly PromptCommitmentV1[];
  readonly runtime?: Partial<ExecutionRequestV1["runtime"]>;
  readonly corpus?: ExecutionRequestV1["corpus"];
  readonly reportTitle?: string;
  readonly limitations?: readonly string[];
  readonly implementationIdentity?: string;
  readonly implementationVersion?: string;
  readonly implementationSourceDigest?: ContentDigest;
}

export function makeRequest(
  cases: readonly BenchmarkCaseV1[],
  options: RequestOptions = {},
): ExecutionRequestV1 {
  const runtime = {
    environment_state: "KNOWN" as const,
    runtime_family: "NODE",
    runtime_version: "24.18.0",
    platform_profile: "DEVELOPMENT",
    toolchain_digest: TOOLCHAIN_DIGEST,
    operating_system: "SYNTHETIC_OS",
    architecture: "SYNTHETIC_ARCH",
    ...options.runtime,
  };
  return {
    runner_format_version: "1.0.0",
    cases,
    case_commitments: cases.map((benchmarkCase) => ({
      case_id: benchmarkCase.case_id,
      case_digest: sha256Canonical(benchmarkCase),
    })),
    repository: {
      commit: FIXTURE_COMMIT,
      tree: FIXTURE_TREE,
      runner_source_digest: RUNNER_SOURCE_DIGEST,
    },
    schema: {
      manifest_digest: SCHEMA_DIGEST,
      generator_format_version: "1.5.0",
    },
    corpus: options.corpus ?? {
      id: "manifest_00000000000000000000000001",
      version: "0.3.0",
      digest: CORPUS_DIGEST,
    },
    holdout: {
      policy: "DEVELOPMENT_NOT_APPLICABLE_V1",
      state: "NOT_APPLICABLE",
      development_commitment_digest: sha256Canonical(
        DEVELOPMENT_HOLDOUT_COMMITMENT,
      ),
    },
    runtime,
    runtime_commitment_digest: sha256Canonical(runtime),
    implementation: {
      kind: "BASELINE",
      identity: options.implementationIdentity ?? "synthetic_runner_fixture_v1",
      version: options.implementationVersion ?? "1.0.0",
      source_digest: options.implementationSourceDigest ?? digest("9"),
    },
    adapter: {
      identity: "synthetic_adapter_v1",
      version: "1.0.0",
    },
    clock: {
      identity: "fixed_clock_v1",
      version: "1.0.0",
    },
    prompt_commitments: options.prompts ?? [],
    output_policy: {
      report_format_version: "1.0.0",
      unexpected_metric_policy: "REJECT",
      formats: ["JSON", "MARKDOWN", "HTML"],
      report_title: options.reportTitle ?? "Synthetic W05 runner proof",
      limitations: [
        "Synthetic development data only.",
        ...(options.limitations ?? []),
      ],
    },
  };
}

export interface ObservationOptions {
  readonly status?: AdapterObservationV1["status"];
  readonly metrics?: readonly MeasuredMetricV1[];
  readonly artifactObservations?: AdapterObservationV1["artifact_observations"];
  readonly reportDigests?: readonly ContentDigest[];
  readonly errors?: readonly ErrorTaxonomyV1ErrorCode[];
  readonly usedPromptIds?: readonly string[];
  readonly modelParticipated?: boolean;
  readonly browserParticipated?: boolean;
  readonly peakMemoryBytes?: number | null;
  readonly pairedCounts?: readonly PairedCountObservationV1[];
}

export function makeObservation(
  benchmarkCase: BenchmarkCaseV1,
  options: ObservationOptions = {},
): AdapterObservationV1 {
  const status = options.status ?? "COMPLETE";
  const metrics =
    options.metrics ??
    (status === "FAILED_SETUP"
      ? []
      : benchmarkCase.thresholds.map((threshold) => ({
          metric_id: threshold.metric_id,
          measured_value: threshold.expected_value,
          unit: threshold.unit,
        })));
  const artifacts =
    options.artifactObservations ??
    (status === "FAILED_SETUP"
      ? []
      : benchmarkCase.input_artifacts.map((artifact) => ({
          artifact_ref: artifact.artifact_ref,
          content_digest: artifact.artifact_digest as ContentDigest,
        })));
  return {
    observation_format_version: "1.0.0",
    status,
    metrics,
    artifact_observations: artifacts,
    artifact_report_digests:
      options.reportDigests ??
      (status === "FAILED_SETUP" ? [] : [RAW_REPORT_DIGEST]),
    failure_error_codes:
      options.errors ??
      (status === "FAILED_SETUP" ? ["BENCHMARK_INCOMPLETE_RUN"] : []),
    used_prompt_ids: options.usedPromptIds ?? [],
    model_participated: options.modelParticipated ?? false,
    browser_participated: options.browserParticipated ?? false,
    peak_memory_bytes: options.peakMemoryBytes ?? null,
    paired_counts: options.pairedCounts ?? [],
  };
}

export class FixedClock implements RunnerClockV1 {
  public readonly identity = "fixed_clock_v1";
  public readonly version = "1.0.0";
  private index = 0;

  public now(): string {
    const seconds = this.index;
    this.index += 1;
    return `2026-08-07T20:00:${String(seconds).padStart(2, "0")}.000Z`;
  }
}

export function trustedContext(
  request?: ExecutionRequestV1,
): RunnerTrustedContextV1 {
  const defaultRuntime = {
    environment_state: "KNOWN" as const,
    runtime_family: "NODE",
    runtime_version: "24.18.0",
    platform_profile: "DEVELOPMENT",
    toolchain_digest: TOOLCHAIN_DIGEST,
    operating_system: "SYNTHETIC_OS",
    architecture: "SYNTHETIC_ARCH",
  };
  return {
    repository_commit: FIXTURE_COMMIT,
    repository_tree: FIXTURE_TREE,
    runner_source_digest: RUNNER_SOURCE_DIGEST,
    schema_manifest_digest: SCHEMA_DIGEST,
    generator_format_version: "1.5.0",
    corpus: request?.corpus ?? {
      id: "manifest_00000000000000000000000001",
      version: "0.3.0",
      digest: CORPUS_DIGEST,
    },
    holdout: request?.holdout ?? {
      policy: "DEVELOPMENT_NOT_APPLICABLE_V1",
      state: "NOT_APPLICABLE",
      development_commitment_digest: sha256Canonical(
        DEVELOPMENT_HOLDOUT_COMMITMENT,
      ),
    },
    runtime_commitment_digest:
      request?.runtime_commitment_digest ?? sha256Canonical(defaultRuntime),
    implementation: request?.implementation ?? {
      kind: "BASELINE",
      identity: "synthetic_runner_fixture_v1",
      version: "1.0.0",
      source_digest: digest("9"),
    },
  };
}

export function adapterReturning(
  produce: (benchmarkCase: BenchmarkCaseV1) => AdapterObservationV1,
): EvaluationAdapterV1 {
  return {
    identity: "synthetic_adapter_v1",
    version: "1.0.0",
    evaluate(benchmarkCase) {
      return Promise.resolve(produce(benchmarkCase));
    },
  };
}

export async function runCases(
  cases: readonly BenchmarkCaseV1[],
  produce: (benchmarkCase: BenchmarkCaseV1) => AdapterObservationV1 = (
    benchmarkCase,
  ) => makeObservation(benchmarkCase),
  options: RequestOptions = {},
): Promise<RunnerExecutionV1> {
  const request = makeRequest(cases, options);
  return runEvaluation(
    request,
    adapterReturning(produce),
    new FixedClock(),
    trustedContext(request),
  );
}

export async function runEvaluationWithHoldout(
  holdout: ExecutionRequestV1["holdout"],
): Promise<RunnerExecutionV1> {
  const base = makeRequest([makeCase()]);
  const request = { ...base, holdout };
  return runEvaluation(
    request,
    adapterReturning((benchmarkCase) => makeObservation(benchmarkCase)),
    new FixedClock(),
    trustedContext(request),
  );
}

export function semanticClone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}
