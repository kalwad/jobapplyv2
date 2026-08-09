import { describe, expect, test } from "vitest";

import {
  aggregateCaseResults,
  buildRunReport,
  renderReportBundle,
  renderReportJson,
  sha256Canonical,
  validateRunReport,
  type EvaluationRunnerError,
  type RunReportV1,
} from "../../src/index.ts";
import {
  digest,
  makeCase,
  makeObservation,
  required,
  runCases,
  runEvaluationWithHoldout,
  semanticClone,
} from "./support/fixtures.ts";

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

async function failingReport(): Promise<RunReportV1> {
  return buildRunReport(
    await runCases([makeCase()], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        metrics: [
          { metric_id: "QUALITY_SCORE", measured_value: 0.7, unit: "SCORE" },
        ],
      }),
    ),
  );
}

interface MutableRecordProjection {
  overall_outcome: string;
  failure_error_codes: string[];
  holdout_state: string;
  comparable: boolean;
  paired_counts: { true_positive: number }[];
  threshold_results: { measured_value: number; passed: boolean }[];
  canonical_result: {
    overall_outcome: string;
    failure_error_codes: string[];
    holdout_state: string;
    comparable: boolean;
    metric_results: { measured_value: number; passed: boolean }[];
    repository_commit: string;
    repository_tree: string;
    runtime_metadata: { runtime_version: string };
  };
}

interface MutableReportProjection {
  aggregate: RunReportV1["aggregate"];
  comparability_banner: string;
  request_digest: string;
  cases: MutableRecordProjection[];
  provenance: {
    holdout: { state: string };
    repository: { commit: string; tree: string };
    runtime: { runtime_version: string };
    runtime_commitment_digest: string;
  };
  replay_witness: {
    request: {
      output_policy: { report_title: string; limitations: string[] };
    };
    case_witnesses: {
      started_at: string;
      ended_at: string;
      observation: {
        failure_error_codes: string[];
        metrics: { measured_value: number }[];
        paired_counts: { true_positive: number }[];
        status: string;
      };
    }[];
  };
}

describe("authoritative report replay source binding", () => {
  test("clean serialized report replays from its own JSON bytes", async () => {
    const report = await failingReport();
    const parsed = JSON.parse(renderReportJson(report)) as unknown;
    expect(() => {
      validateRunReport(parsed);
    }).not.toThrow();
  });

  test("coordinated FAIL-to-PASS projection modification rejects", async () => {
    const clean = await failingReport();
    expect(clean.cases[0]?.overall_outcome).toBe("FAIL");
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    const record = required(mutant.cases[0], "mutant record");
    required(record.threshold_results[0], "threshold").measured_value = 0.8;
    required(record.threshold_results[0], "threshold").passed = true;
    record.overall_outcome = "PASS";
    record.failure_error_codes = [];
    required(
      record.canonical_result.metric_results[0],
      "metric result",
    ).measured_value = 0.8;
    required(
      record.canonical_result.metric_results[0],
      "metric result",
    ).passed = true;
    record.canonical_result.overall_outcome = "PASS";
    record.canonical_result.failure_error_codes = [];
    mutant.aggregate = aggregateCaseResults(
      mutant.cases as unknown as RunReportV1["cases"],
    );
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_REPLAY_MISMATCH");
  });

  test("UNAVAILABLE holdout relabeled VALID/comparable/PASS rejects", async () => {
    const clean = buildRunReport(
      await runEvaluationWithHoldout({
        policy: "CALLER_SUPPLIED_MANIFEST_V1",
        state: "UNAVAILABLE",
        manifest_id: "holdoutmanifest_00000000000000000000000001",
        manifest_digest: digest("a"),
      }),
    );
    expect(clean.cases[0]?.holdout_state).toBe("UNAVAILABLE");
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    mutant.provenance.holdout.state = "VALID";
    const record = required(mutant.cases[0], "mutant record");
    record.holdout_state = "VALID";
    record.comparable = true;
    record.overall_outcome = "PASS";
    record.failure_error_codes = [];
    record.canonical_result.holdout_state = "VALID";
    record.canonical_result.comparable = true;
    record.canonical_result.overall_outcome = "PASS";
    record.canonical_result.failure_error_codes = [];
    mutant.aggregate = aggregateCaseResults(
      mutant.cases as unknown as RunReportV1["cases"],
    );
    mutant.comparability_banner = "ALL_CASES_COMPARABLE";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_REPLAY_MISMATCH");
  });

  test("coordinated repository/runtime provenance replacement rejects", async () => {
    const clean = buildRunReport(await runCases([makeCase()]));
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    mutant.provenance.repository.commit = "f".repeat(40);
    mutant.provenance.repository.tree = "e".repeat(40);
    mutant.provenance.runtime.runtime_version = "26.0.0";
    mutant.provenance.runtime_commitment_digest = sha256Canonical(
      mutant.provenance.runtime,
    );
    const result = required(mutant.cases[0], "mutant record").canonical_result;
    result.repository_commit = "f".repeat(40);
    result.repository_tree = "e".repeat(40);
    result.runtime_metadata.runtime_version = "26.0.0";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_REPLAY_MISMATCH");
  });

  test("request-source change under the old request digest rejects", async () => {
    const clean = buildRunReport(await runCases([makeCase()]));
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    mutant.replay_witness.request.output_policy.report_title =
      "Replaced source title";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_SOURCE_BINDING");
  });

  test("request-source change cannot keep old record identities", async () => {
    const clean = buildRunReport(await runCases([makeCase()]));
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    mutant.replay_witness.request.output_policy.report_title =
      "Replaced source title";
    mutant.request_digest = sha256Canonical(mutant.replay_witness.request);
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_IDENTITY");
  });

  test("observation-source change under old observation identity rejects", async () => {
    const clean = await failingReport();
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    const witnessed = required(
      mutant.replay_witness.case_witnesses[0],
      "case witness",
    );
    required(
      witnessed.observation.metrics[0],
      "witness metric",
    ).measured_value = 0.8;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_REPLAY_MISMATCH");
  });

  test("non-canonical set-like witness observation order rejects", async () => {
    const clean = buildRunReport(
      await runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          metrics: [
            {
              metric_id: "QUALITY_SCORE",
              measured_value: 0.8,
              unit: "SCORE",
            },
          ],
          errors: ["BENCHMARK_HASH_MISMATCH", "BENCHMARK_THRESHOLD_FAILED"],
        }),
      ),
    );
    const mutant = semanticClone(clean) as unknown as MutableReportProjection;
    const witnessed = required(
      mutant.replay_witness.case_witnesses[0],
      "case witness",
    );
    witnessed.observation.failure_error_codes = [
      ...witnessed.observation.failure_error_codes,
    ].reverse();
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_WITNESS_NONCANONICAL");
  });

  test("a legitimate semantic source change produces new identities", async () => {
    const first = buildRunReport(
      await runCases([makeCase()], undefined, {
        reportTitle: "First semantic source",
      }),
    );
    const second = buildRunReport(
      await runCases([makeCase()], undefined, {
        reportTitle: "Second semantic source",
      }),
    );
    expect(() => {
      validateRunReport(semanticClone(first));
      validateRunReport(semanticClone(second));
    }).not.toThrow();
    expect(second.request_digest).not.toBe(first.request_digest);
    expect(second.execution_id).not.toBe(first.execution_id);
    expect(second.cases[0]?.record_id).not.toBe(first.cases[0]?.record_id);
    expect(second.cases[0]?.canonical_result?.result_id).not.toBe(
      first.cases[0]?.canonical_result?.result_id,
    );
  });

  test("a report without its replay witness rejects", async () => {
    const clean = await failingReport();
    const mutant = semanticClone(clean) as unknown as Record<string, unknown>;
    delete mutant.replay_witness;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_STRUCTURE");
  });

  test("rendered projections still replay after bundle round trips", async () => {
    const report = await failingReport();
    const bundle = renderReportBundle(report);
    const parsed = JSON.parse(bundle.json) as unknown;
    expect(() => {
      validateRunReport(parsed);
    }).not.toThrow();
    expect(renderReportBundle(parsed as RunReportV1).json).toBe(bundle.json);
  });
});
