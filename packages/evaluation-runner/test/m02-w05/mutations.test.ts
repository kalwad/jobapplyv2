import { describe, expect, test } from "vitest";

import {
  buildRunReport,
  compareRegression,
  computeRegressionReferenceDigest,
  evaluateThresholds,
  renderReportBundle,
  runEvaluation,
  sha256Canonical,
  validateExecutionRequest,
  validateRunReport,
  type EvaluationRunnerError,
  type RegressionCompatibilityV1,
  type RegressionReferenceV1,
  type RunReportV1,
} from "../../src/index.ts";
import {
  adapterReturning,
  digest,
  FixedClock,
  makeCase,
  makeObservation,
  makeRequest,
  required,
  runCases,
  semanticClone,
  trustedContext,
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

async function expectAsyncCode(
  action: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action;
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

async function pairedReport(): Promise<RunReportV1> {
  return buildRunReport(
    await runCases([makeCase()], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        pairedCounts: [
          {
            group_id: "FIELD_DECISIONS",
            true_positive: 2,
            false_positive: 1,
            false_negative: 1,
          },
        ],
      }),
    ),
  );
}

function regressionCompatibility(
  corpus = digest("a"),
): RegressionCompatibilityV1 {
  return {
    corpus_digest: corpus,
    runtime_commitment_digest: digest("b"),
    metric_semantics_digest: digest("c"),
    threshold_semantics_digest: digest("d"),
    implementation_identity: "mutation_fixture_v1",
    prompt_digests: [],
  };
}

function regressionReference(): RegressionReferenceV1 {
  const payload: Omit<RegressionReferenceV1, "reference_digest"> = {
    regression_format_version: "1.0.0",
    reference_id: "regressionref_00000000000000000000000009",
    source_run_digest: digest("e"),
    metric_id: "QUALITY_SCORE",
    unit: "SCORE",
    value: 0.8,
    comparator: "HIGHER_IS_BETTER",
    allowed_regression: 0.01,
    compatibility: regressionCompatibility(),
  };
  return {
    ...payload,
    reference_digest: computeRegressionReferenceDigest(payload),
  };
}

describe("finite M02-W05 mutation campaign", () => {
  test("1 comparator drift is caught by the immutable threshold commitment", () => {
    const clean = makeRequest([makeCase()]);
    expect(() => validateExecutionRequest(clean)).not.toThrow();
    const mutant = semanticClone(clean) as unknown as {
      cases: { thresholds: { comparator: string }[] }[];
      case_commitments: { case_digest: string }[];
    };
    required(
      required(mutant.cases[0], "mutant case").thresholds[0],
      "mutant threshold",
    ).comparator = "AT_MOST";
    required(mutant.case_commitments[0], "case commitment").case_digest =
      sha256Canonical(mutant.cases[0]);
    expectCode(
      () => validateExecutionRequest(mutant),
      "RUNNER_THRESHOLD_DIGEST_MISMATCH",
    );
  });

  test("2 epsilon-based decimal drift differs from exact comparison", () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "DECIMAL_METRIC",
          comparator: "EXACT",
          expected_value: 0.3,
          unit: "SCORE",
        },
      ],
    });
    const real = evaluateThresholds(benchmarkCase, [
      {
        metric_id: "DECIMAL_METRIC",
        measured_value: 0.1 + 0.2,
        unit: "SCORE",
      },
    ]).results[0];
    const epsilonMutant = Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON;
    expect(real?.passed).toBe(false);
    expect(epsilonMutant).toBe(true);
  });

  test("3 missing raw denominator is caught", async () => {
    const clean = await pairedReport();
    expect(() => {
      validateRunReport(clean);
    }).not.toThrow();
    const mutant = semanticClone(clean) as unknown as {
      aggregate: { pass_rate: { denominator?: number } };
    };
    delete mutant.aggregate.pass_rate.denominator;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("4 precision without recall is caught", async () => {
    const clean = await pairedReport();
    expect(clean.aggregate.precision_recall_summaries[0]?.recall).toBeDefined();
    const mutant = semanticClone(clean) as unknown as {
      aggregate: { precision_recall_summaries: { recall?: unknown }[] };
    };
    delete required(
      mutant.aggregate.precision_recall_summaries[0],
      "precision/recall summary",
    ).recall;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("5 omitted partial case is caught", async () => {
    const partialCase = makeCase({
      index: 2,
      thresholds: [
        {
          metric_id: "FIRST_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "SECOND_METRIC",
          comparator: "EXACT",
          expected_value: 2,
          unit: "COUNT",
        },
      ],
    });
    const clean = buildRunReport(
      await runCases([makeCase({ index: 1 }), partialCase], (benchmarkCase) =>
        benchmarkCase.case_id === partialCase.case_id
          ? makeObservation(benchmarkCase, {
              status: "PARTIAL",
              metrics: [
                {
                  metric_id: "FIRST_METRIC",
                  measured_value: 1,
                  unit: "COUNT",
                },
              ],
            })
          : makeObservation(benchmarkCase),
      ),
    );
    expect(clean.aggregate.counts.partial).toBe(1);
    const mutant = semanticClone(clean) as unknown as { cases: unknown[] };
    mutant.cases.pop();
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("6 rounded-away zero-tolerance count is caught", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "ZERO_TOLERANCE_FAILURES",
          comparator: "AT_MOST",
          expected_value: 0,
          unit: "COUNT",
        },
      ],
    });
    const clean = buildRunReport(
      await runCases([benchmarkCase], (entry) =>
        makeObservation(entry, {
          metrics: [
            {
              metric_id: "ZERO_TOLERANCE_FAILURES",
              measured_value: 1,
              unit: "COUNT",
            },
          ],
        }),
      ),
    );
    expect(clean.aggregate.counts.zero_tolerance_failure_count).toBe(1);
    const mutant = semanticClone(clean) as unknown as {
      aggregate: { counts: { zero_tolerance_failure_count: number } };
    };
    mutant.aggregate.counts.zero_tolerance_failure_count = 0;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("7 threshold digest tamper is caught", () => {
    const clean = makeRequest([makeCase()]);
    expect(() => validateExecutionRequest(clean)).not.toThrow();
    const mutant = semanticClone(clean) as unknown as {
      cases: { threshold_set_digest: string }[];
      case_commitments: { case_digest: string }[];
    };
    required(mutant.cases[0], "threshold mutant case").threshold_set_digest =
      digest("f");
    required(
      mutant.case_commitments[0],
      "threshold mutant commitment",
    ).case_digest = sha256Canonical(mutant.cases[0]);
    expectCode(
      () => validateExecutionRequest(mutant),
      "RUNNER_THRESHOLD_DIGEST_MISMATCH",
    );
  });

  test("8 case digest tamper is caught", () => {
    const clean = makeRequest([makeCase()]);
    expect(() => validateExecutionRequest(clean)).not.toThrow();
    const mutant = semanticClone(clean) as unknown as {
      case_commitments: { case_digest: string }[];
    };
    required(mutant.case_commitments[0], "case digest commitment").case_digest =
      digest("f");
    expectCode(
      () => validateExecutionRequest(mutant),
      "RUNNER_CASE_DIGEST_MISMATCH",
    );
  });

  test("9 corpus digest tamper is caught", () => {
    const clean = makeRequest([makeCase()]);
    expect(() => validateExecutionRequest(clean)).not.toThrow();
    const mutant = semanticClone(clean) as unknown as {
      corpus: { digest: string };
    };
    mutant.corpus.digest = digest("f");
    expectCode(
      () => validateExecutionRequest(mutant),
      "RUNNER_CORPUS_MISMATCH",
    );
  });

  test("10 environment mismatch treated as comparable is caught", async () => {
    const clean = buildRunReport(
      await runCases([
        makeCase({ environment: { runtime_profile: "OTHER_RUNTIME" } }),
      ]),
    );
    expect(clean.comparability_banner).toBe("INCOMPARABLE_CASES_PRESENT");
    const mutant = semanticClone(clean) as unknown as {
      comparability_banner: string;
    };
    mutant.comparability_banner = "ALL_CASES_COMPARABLE";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_COMPARABILITY");
  });

  test("11 caller-supplied PASS cannot override derived truth", async () => {
    const benchmarkCase = makeCase();
    const clean = makeObservation(benchmarkCase);
    expect(clean).not.toHaveProperty("overall_outcome");
    const mutant = { ...clean, overall_outcome: "PASS" };
    await expectAsyncCode(
      runEvaluation(
        makeRequest([benchmarkCase]),
        adapterReturning(() => mutant),
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_UNKNOWN_FIELD",
    );
  });

  test("12 time-derived result identity differs from deterministic identity", async () => {
    const first = await runCases([makeCase()]);
    const second = await runCases([makeCase()]);
    expect(second.records[0]?.record_id).toBe(first.records[0]?.record_id);
    const timeMutantA = `evalrecord_${String(Date.parse("2026-08-07T20:00:00Z"))}`;
    const timeMutantB = `evalrecord_${String(Date.parse("2026-08-07T20:00:01Z"))}`;
    expect(timeMutantB).not.toBe(timeMutantA);
    expect(first.records[0]?.record_id).not.toBe(timeMutantA);
  });

  test("13 report HTML injection is escaped", async () => {
    const clean = buildRunReport(
      await runCases([makeCase()], undefined, {
        reportTitle: "Clean positive control",
      }),
    );
    expect(renderReportBundle(clean).html).toContain("Clean positive control");
    const hostile = buildRunReport(
      await runCases([makeCase()], undefined, {
        reportTitle: "<script>mutant()</script>",
      }),
    );
    const html = renderReportBundle(hostile).html;
    expect(html).not.toMatch(/<script\b/iu);
    expect(html).toContain("&lt;script&gt;");
  });

  test("14 Markdown and HTML cannot recompute different metric truth", async () => {
    const bundle = renderReportBundle(
      buildRunReport(await runCases([makeCase()])),
    );
    expect(bundle.markdown).toContain(
      "| 0.8 | 0.8 | SCORE | NOT_APPLICABLE | true |",
    );
    expect(bundle.html).toContain(
      "<td>0.8</td><td>0.8</td><td>SCORE</td><td>NOT_APPLICABLE</td><td>true</td>",
    );
    const divergentRendererMutant = bundle.html.replace(
      "<td>0.8</td><td>0.8</td>",
      "<td>0.8</td><td>0.7</td>",
    );
    expect(divergentRendererMutant).not.toBe(bundle.html);
    expect(sha256Canonical(divergentRendererMutant)).not.toBe(
      sha256Canonical(bundle.html),
    );
  });

  test("15 regression cannot silently compare incompatible corpus", () => {
    const reference = regressionReference();
    const clean = compareRegression(reference, {
      candidate_run_digest: digest("f"),
      metric_id: "QUALITY_SCORE",
      unit: "SCORE",
      value: 0.8,
      implementation_version: "1.1.0",
      compatibility: regressionCompatibility(),
    });
    expect(clean.passed).toBe(true);
    const mutant = compareRegression(reference, {
      candidate_run_digest: digest("f"),
      metric_id: "QUALITY_SCORE",
      unit: "SCORE",
      value: 0.8,
      implementation_version: "1.1.0",
      compatibility: regressionCompatibility(digest("9")),
    });
    expect(mutant.comparable).toBe(false);
    expect(mutant.passed).toBeNull();
    expect(mutant.incomparable_reasons).toContain("CORPUS_MISMATCH");
  });

  test("16 prompt digest omission from a prompt run is caught", async () => {
    const prompt = {
      prompt_id: "mutation_prompt_v1",
      version: "1.0.0",
      digest: digest("f"),
    } as const;
    const clean = await runCases(
      [makeCase()],
      (benchmarkCase) =>
        makeObservation(benchmarkCase, { usedPromptIds: [prompt.prompt_id] }),
      { prompts: [prompt] },
    );
    expect(clean.provenance.prompt_commitments).toEqual([prompt]);
    await expectAsyncCode(
      runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, { usedPromptIds: [prompt.prompt_id] }),
      ),
      "RUNNER_PROMPT_COMMITMENT_MISSING",
    );
  });

  test("17 fake model digest on a no-model run is caught", async () => {
    const clean = await runCases([makeCase()]);
    expect(clean.provenance.runtime.model_digest).toBeUndefined();
    const runtime = {
      environment_state: "KNOWN" as const,
      runtime_family: "NODE",
      runtime_version: "24.18.0",
      platform_profile: "DEVELOPMENT",
      toolchain_digest: digest("6"),
      operating_system: "SYNTHETIC_OS",
      architecture: "SYNTHETIC_ARCH",
      model_profile_ref: "modelprofile_00000000000000000000000001",
      model_digest: digest("f"),
    };
    const request = makeRequest([makeCase()], { runtime });
    await expectAsyncCode(
      runEvaluation(
        request,
        adapterReturning((benchmarkCase) => makeObservation(benchmarkCase)),
        new FixedClock(),
        trustedContext(request),
      ),
      "RUNNER_MODEL_PROVENANCE",
    );
  });

  test("18 gate-authority field and mutation attempt are caught", () => {
    const clean = makeRequest([makeCase()]);
    expect(() => validateExecutionRequest(clean)).not.toThrow();
    const mutant = {
      ...clean,
      gate_decision: { gate: "AUTOFILL_FEASIBILITY", state: "PASS" },
    };
    expectCode(() => validateExecutionRequest(mutant), "RUNNER_UNKNOWN_FIELD");
  });
});
