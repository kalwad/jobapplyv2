import {
  DEVELOPMENT_HOLDOUT_COMMITMENT,
  buildRunReport,
  canonicalJson,
  computeThresholdSetDigest,
  renderReportBundle,
  runEvaluation,
  sha256Canonical,
  type BenchmarkCaseV1,
  type EvaluationAdapterV1,
  type ExecutionRequestV1,
  type RunnerClockV1,
} from "./index.ts";

const commit = "1".repeat(40);
const tree = "2".repeat(40);
const runnerSourceDigest = sha256Canonical({
  development_check: "evaluation-runner-1.0.0",
});
const schemaManifestDigest = sha256Canonical({
  development_schema_manifest: "benchmark-v1",
});
const corpusDigest = sha256Canonical({
  development_corpus: "w05-cli-single-public-synthetic-case",
});
const artifactDigest = sha256Canonical({
  development_artifact: "bounded-synthetic-measurement",
});
const toolchainDigest = sha256Canonical({
  node: "24.18.0",
  pnpm: "11.17.0",
});

const thresholds: BenchmarkCaseV1["thresholds"] = [
  {
    metric_id: "CHECK_COUNT",
    comparator: "EXACT",
    expected_value: 1,
    unit: "COUNT",
  },
];
const thresholdSetRef = "thresholdset_00000000000000000000000001";
const benchmarkCase: BenchmarkCaseV1 = {
  case_id: "benchmarkcase_00000000000000000000000001",
  case_schema_version: "BENCHMARK_CASE_V1",
  benchmark_family: "CONTRACT_COMPATIBILITY",
  corpus_version: "1.0.0",
  corpus_digest: corpusDigest,
  input_artifacts: [
    {
      artifact_ref: "artifact_00000000000000000000000001",
      artifact_digest: artifactDigest,
      schema_ref: "urn:japp:schema:fixture:test-record:v1",
    },
  ],
  expected_behavior: "MEASURE",
  threshold_set_ref: thresholdSetRef,
  threshold_set_digest: computeThresholdSetDigest({
    threshold_set_ref: thresholdSetRef,
    thresholds,
  }),
  thresholds,
  environment_requirements: {
    runtime_profile: "NODE",
    platform_profile: "DEVELOPMENT",
    toolchain_digest: toolchainDigest,
    adapter_version: "1.0.0",
  },
  synthetic_data: true,
  provenance: {
    source_kind: "GENERATED",
    source_id: "source_00000000000000000000000001",
    observed_at: "2026-08-07T20:00:00Z",
    source_digest: artifactDigest,
  },
  holdout_visibility: "PUBLIC_SYNTHETIC",
  applicable_platform_profiles: ["DEVELOPMENT"],
};

const runtime = {
  environment_state: "KNOWN" as const,
  runtime_family: "NODE",
  runtime_version: "24.18.0",
  platform_profile: "DEVELOPMENT",
  toolchain_digest: toolchainDigest,
  operating_system: "SYNTHETIC_OS",
  architecture: "SYNTHETIC_ARCH",
};
const request: ExecutionRequestV1 = {
  runner_format_version: "1.0.0",
  cases: [benchmarkCase],
  case_commitments: [
    {
      case_id: benchmarkCase.case_id,
      case_digest: sha256Canonical(benchmarkCase),
    },
  ],
  repository: {
    commit,
    tree,
    runner_source_digest: runnerSourceDigest,
  },
  schema: {
    manifest_digest: schemaManifestDigest,
    generator_format_version: "1.5.0",
  },
  corpus: {
    id: "DEVELOPMENT_MUTABLE_PRE_W06",
    version: benchmarkCase.corpus_version,
    digest: corpusDigest,
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
    identity: "w05_cli_synthetic_check_v1",
    version: "1.0.0",
    source_digest: sha256Canonical({ implementation: "constant-one" }),
  },
  adapter: {
    identity: "w05_cli_synthetic_adapter_v1",
    version: "1.0.0",
  },
  clock: {
    identity: "w05_cli_fixed_clock_v1",
    version: "1.0.0",
  },
  prompt_commitments: [],
  output_policy: {
    report_format_version: "1.0.0",
    unexpected_metric_policy: "REJECT",
    formats: ["JSON", "MARKDOWN", "HTML"],
    report_title: "W05 deterministic runner self-check",
    limitations: ["Public synthetic development check only."],
  },
};

const adapter: EvaluationAdapterV1 = {
  identity: request.adapter.identity,
  version: request.adapter.version,
  evaluate() {
    return Promise.resolve({
      observation_format_version: "1.0.0",
      status: "COMPLETE",
      metrics: [
        {
          metric_id: "CHECK_COUNT",
          measured_value: 1,
          unit: "COUNT",
        },
      ],
      artifact_observations: [
        {
          artifact_ref: benchmarkCase.input_artifacts[0]?.artifact_ref ?? "",
          content_digest: artifactDigest,
        },
      ],
      artifact_report_digests: [sha256Canonical({ raw: "check" })],
      failure_error_codes: [],
      used_prompt_ids: [],
      model_participated: false,
      browser_participated: false,
      peak_memory_bytes: null,
      paired_counts: [],
    });
  },
};

class FixedCheckClock implements RunnerClockV1 {
  public readonly identity = request.clock.identity;
  public readonly version = request.clock.version;
  private index = 0;

  public now(): string {
    const value = this.index;
    this.index += 1;
    return `2026-08-07T20:00:0${String(value)}.000Z`;
  }
}

async function produceBundle() {
  const execution = await runEvaluation(
    request,
    adapter,
    new FixedCheckClock(),
    {
      repository_commit: commit,
      repository_tree: tree,
      runner_source_digest: runnerSourceDigest,
      schema_manifest_digest: schemaManifestDigest,
      generator_format_version: "1.5.0",
      corpus: request.corpus,
      holdout: request.holdout,
      runtime_commitment_digest: request.runtime_commitment_digest,
      implementation: request.implementation,
    },
  );
  return renderReportBundle(buildRunReport(execution));
}

async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== "--check") {
    throw new Error("usage: node src/cli.ts --check");
  }
  const first = await produceBundle();
  const second = await produceBundle();
  if (canonicalJson(first) !== canonicalJson(second)) {
    throw new Error("deterministic report replay mismatch");
  }
  if (!first.html.includes("THIS REPORT HAS NO CRITICAL-GATE AUTHORITY")) {
    throw new Error("no-critical-gate-authority statement is missing");
  }
  process.stdout.write(
    "evaluation-runner check: deterministic JSON/Markdown/HTML PASS\n",
  );
}

await main();
