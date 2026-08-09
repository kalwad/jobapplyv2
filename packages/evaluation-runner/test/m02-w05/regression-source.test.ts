import { describe, expect, test } from "vitest";

import {
  buildRunReport,
  compareRegression,
  compareRegressionForExecution,
  computeRegressionReferenceDigest,
  deriveExecutionCompatibility,
  resolveRegressionCandidate,
  validateRunReport,
  type EvaluationRunnerError,
  type RegressionCandidateSelectorV1,
  type RegressionComparisonV1,
  type RegressionReferenceV1,
  type RunnerExecutionV1,
} from "../../src/index.ts";
import {
  digest,
  makeCase,
  makeObservation,
  required,
  runCases,
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

function referenceFor(
  execution: RunnerExecutionV1,
  overrides: Partial<Omit<RegressionReferenceV1, "reference_digest">> = {},
): RegressionReferenceV1 {
  const payload: Omit<RegressionReferenceV1, "reference_digest"> = {
    regression_format_version: "1.0.0",
    reference_id: "regressionref_00000000000000000000000021",
    source_run_digest: digest("e"),
    metric_id: "QUALITY_SCORE",
    unit: "SCORE",
    value: 0.8,
    comparator: "HIGHER_IS_BETTER",
    allowed_regression: 0.01,
    compatibility: deriveExecutionCompatibility(execution),
    ...overrides,
  };
  return {
    ...payload,
    reference_digest: computeRegressionReferenceDigest(payload),
  };
}

function caseSelector(
  execution: RunnerExecutionV1,
): RegressionCandidateSelectorV1 {
  const caseId = execution.records[0]?.case_id;
  if (caseId === undefined) {
    throw new Error("missing execution record for selector fixture");
  }
  return {
    selector_format_version: "1.0.0",
    source: "CASE_THRESHOLD_METRIC",
    case_id: caseId,
    metric_id: "QUALITY_SCORE",
  };
}

async function pairedExecution(): Promise<RunnerExecutionV1> {
  return runCases([makeCase()], (benchmarkCase) =>
    makeObservation(benchmarkCase, {
      pairedCounts: [
        {
          group_id: "FIELD_DECISIONS",
          true_positive: 4,
          false_positive: 1,
          false_negative: 2,
        },
      ],
    }),
  );
}

describe("regression comparison source reconstruction", () => {
  test("clean compatible comparison succeeds inside its own report", async () => {
    const execution = await runCases([makeCase()]);
    const comparison = compareRegressionForExecution(
      referenceFor(execution),
      caseSelector(execution),
      execution,
    );
    expect(comparison.comparable).toBe(true);
    expect(comparison.passed).toBe(true);
    expect(comparison.source?.candidate_selector.source).toBe(
      "CASE_THRESHOLD_METRIC",
    );
    const report = buildRunReport(execution, [comparison]);
    expect(() => {
      validateRunReport(semanticClone(report));
    }).not.toThrow();
  });

  test("clean incompatible comparison stays incomparable and null", async () => {
    const execution = await runCases([makeCase()]);
    const foreignCorpus = referenceFor(execution, {
      compatibility: {
        ...deriveExecutionCompatibility(execution),
        corpus_digest: digest("9"),
      },
    });
    const comparison = compareRegressionForExecution(
      foreignCorpus,
      caseSelector(execution),
      execution,
    );
    expect(comparison.comparable).toBe(false);
    expect(comparison.incomparable_reasons).toEqual(["CORPUS_MISMATCH"]);
    expect(comparison.passed).toBeNull();
    const report = buildRunReport(execution, [comparison]);
    expect(() => {
      validateRunReport(semanticClone(report));
    }).not.toThrow();
  });

  test("candidate bound to an unrelated execution rejects", async () => {
    const first = await runCases([makeCase()], undefined, {
      reportTitle: "Candidate origin execution",
    });
    const second = await runCases([makeCase()], undefined, {
      reportTitle: "Embedding execution",
    });
    const foreign = compareRegressionForExecution(
      referenceFor(first),
      caseSelector(first),
      first,
    );
    expectCode(() => {
      buildRunReport(second, [foreign]);
    }, "RUNNER_REGRESSION_SOURCE_MISMATCH");
  });

  test("sourceless serialized comparison cannot enter a report", async () => {
    const execution = await runCases([makeCase()]);
    const sourceless = compareRegression(referenceFor(execution), {
      candidate_run_digest: digest("f"),
      metric_id: "QUALITY_SCORE",
      unit: "SCORE",
      value: 0.8,
      implementation_version: "1.0.0",
      compatibility: deriveExecutionCompatibility(execution),
    });
    expectCode(() => {
      buildRunReport(execution, [sourceless]);
    }, "RUNNER_REGRESSION_SOURCE_REQUIRED");
  });

  test("candidate value differing from the selected source rejects", async () => {
    const execution = await runCases([makeCase()]);
    const reference = referenceFor(execution);
    const selector = caseSelector(execution);
    const genuine = compareRegressionForExecution(
      reference,
      selector,
      execution,
    );
    const forgedCandidate = {
      ...resolveRegressionCandidate(execution, selector),
      value: 0.81,
    };
    const forged: RegressionComparisonV1 = {
      ...compareRegression(reference, forgedCandidate),
      source: required(genuine.source, "comparison source"),
    };
    expectCode(() => {
      buildRunReport(execution, [forged]);
    }, "RUNNER_REGRESSION_SOURCE_MISMATCH");
  });

  test("candidate raw counts differing from the selected source reject", async () => {
    const ratioCase = makeCase({
      thresholds: [
        {
          metric_id: "OVERLAP_RATIO",
          comparator: "AT_LEAST",
          expected_value: 0.5,
          unit: "RATIO",
        },
      ],
    });
    const execution = await runCases([ratioCase], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        metrics: [
          {
            metric_id: "OVERLAP_RATIO",
            measured_value: 0.8,
            unit: "RATIO",
            proportion_counts: { numerator: 4, denominator: 5 },
          },
        ],
      }),
    );
    const reference = referenceFor(execution, {
      metric_id: "OVERLAP_RATIO",
      unit: "RATIO",
      raw_numerator: 4,
      raw_denominator: 5,
    });
    const selector: RegressionCandidateSelectorV1 = {
      selector_format_version: "1.0.0",
      source: "CASE_THRESHOLD_METRIC",
      case_id: ratioCase.case_id,
      metric_id: "OVERLAP_RATIO",
    };
    const genuine = compareRegressionForExecution(
      reference,
      selector,
      execution,
    );
    expect(genuine.candidate_raw_numerator).toBe(4);
    const forgedCandidate = {
      ...resolveRegressionCandidate(execution, selector),
      raw_numerator: 8,
      raw_denominator: 10,
    };
    const forged: RegressionComparisonV1 = {
      ...compareRegression(reference, forgedCandidate),
      source: required(genuine.source, "comparison source"),
    };
    expectCode(() => {
      buildRunReport(execution, [forged]);
    }, "RUNNER_REGRESSION_SOURCE_MISMATCH");
  });

  test("corpus mismatch relabeled comparable/passed rejects in a report", async () => {
    const execution = await runCases([makeCase()]);
    const foreignCorpus = referenceFor(execution, {
      compatibility: {
        ...deriveExecutionCompatibility(execution),
        corpus_digest: digest("9"),
      },
    });
    const genuine = compareRegressionForExecution(
      foreignCorpus,
      caseSelector(execution),
      execution,
    );
    const relabeled = semanticClone(genuine) as unknown as {
      comparable: boolean;
      incomparable_reasons: string[];
      passed: boolean | null;
    };
    relabeled.comparable = true;
    relabeled.incomparable_reasons = [];
    relabeled.passed = true;
    expectCode(() => {
      buildRunReport(execution, [
        relabeled as unknown as RegressionComparisonV1,
      ]);
    }, "RUNNER_REGRESSION_SOURCE_MISMATCH");
  });

  test("embedded reference compatibility modification is detected", async () => {
    const execution = await runCases([makeCase()]);
    const comparison = compareRegressionForExecution(
      referenceFor(execution),
      caseSelector(execution),
      execution,
    );
    const mutant = semanticClone(comparison) as unknown as {
      source: { reference: { compatibility: { corpus_digest: string } } };
    };
    mutant.source.reference.compatibility.corpus_digest = digest("9");
    expectCode(() => {
      buildRunReport(execution, [mutant as unknown as RegressionComparisonV1]);
    }, "RUNNER_REGRESSION_REFERENCE_TAMPER");
  });

  test("reference digest modification is detected", async () => {
    const execution = await runCases([makeCase()]);
    const comparison = compareRegressionForExecution(
      referenceFor(execution),
      caseSelector(execution),
      execution,
    );
    const mutant = semanticClone(comparison) as unknown as {
      reference_digest: string;
      source: { reference: { reference_digest: string } };
    };
    mutant.reference_digest = digest("f");
    mutant.source.reference.reference_digest = digest("f");
    expectCode(() => {
      buildRunReport(execution, [mutant as unknown as RegressionComparisonV1]);
    }, "RUNNER_REGRESSION_REFERENCE_TAMPER");
  });

  test("changed pass/null state rejects in a report", async () => {
    const execution = await runCases([makeCase()], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        metrics: [
          { metric_id: "QUALITY_SCORE", measured_value: 0.7, unit: "SCORE" },
        ],
      }),
    );
    const comparison = compareRegressionForExecution(
      referenceFor(execution),
      caseSelector(execution),
      execution,
    );
    expect(comparison.passed).toBe(false);
    const mutant = semanticClone(comparison) as unknown as {
      passed: boolean | null;
    };
    mutant.passed = true;
    expectCode(() => {
      buildRunReport(execution, [mutant as unknown as RegressionComparisonV1]);
    }, "RUNNER_REGRESSION_DERIVATION");
  });

  test("aggregate pass-rate, precision, and recall selectors resolve canonically", async () => {
    const execution = await pairedExecution();
    const passRate = resolveRegressionCandidate(execution, {
      selector_format_version: "1.0.0",
      source: "AGGREGATE_PASS_RATE",
    });
    expect(passRate).toMatchObject({
      metric_id: "AGGREGATE_PASS_RATE",
      unit: "RATIO",
      value: 1,
      raw_numerator: 1,
      raw_denominator: 1,
    });
    const precision = resolveRegressionCandidate(execution, {
      selector_format_version: "1.0.0",
      source: "AGGREGATE_PRECISION",
      group_id: "FIELD_DECISIONS",
    });
    expect(precision).toMatchObject({
      metric_id: "AGGREGATE_PRECISION",
      value: 0.8,
      raw_numerator: 4,
      raw_denominator: 5,
    });
    const recall = resolveRegressionCandidate(execution, {
      selector_format_version: "1.0.0",
      source: "AGGREGATE_RECALL",
      group_id: "FIELD_DECISIONS",
    });
    expect(recall).toMatchObject({
      metric_id: "AGGREGATE_RECALL",
      value: 4 / 6,
      raw_numerator: 4,
      raw_denominator: 6,
    });
    const reference = referenceFor(execution, {
      metric_id: "AGGREGATE_PRECISION",
      unit: "RATIO",
      value: 0.8,
      raw_numerator: 4,
      raw_denominator: 5,
    });
    const report = buildRunReport(execution, [
      compareRegressionForExecution(
        reference,
        {
          selector_format_version: "1.0.0",
          source: "AGGREGATE_PRECISION",
          group_id: "FIELD_DECISIONS",
        },
        execution,
      ),
    ]);
    expect(() => {
      validateRunReport(semanticClone(report));
    }).not.toThrow();
  });

  test("pooled-proportion selector resolves pooled raw counts", async () => {
    const ratioCase = makeCase({
      thresholds: [
        {
          metric_id: "POOLED_RATIO",
          comparator: "AT_LEAST",
          expected_value: 0,
          unit: "RATIO",
        },
      ],
    });
    const execution = await runCases([ratioCase], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        metrics: [
          {
            metric_id: "POOLED_RATIO",
            measured_value: 0.5,
            unit: "RATIO",
            proportion_counts: { numerator: 1, denominator: 2 },
          },
        ],
      }),
    );
    const pooled = resolveRegressionCandidate(execution, {
      selector_format_version: "1.0.0",
      source: "AGGREGATE_POOLED_PROPORTION",
      metric_id: "POOLED_RATIO",
    });
    expect(pooled).toMatchObject({
      metric_id: "POOLED_RATIO",
      unit: "RATIO",
      value: 0.5,
      raw_numerator: 1,
      raw_denominator: 2,
    });
  });

  test.each([
    [
      "unsupported selector source",
      { selector_format_version: "1.0.0", source: "LATEST_RUN" },
    ],
    [
      "nonexistent case",
      {
        selector_format_version: "1.0.0",
        source: "CASE_THRESHOLD_METRIC",
        case_id: "benchmarkcase_00000000000000000000000099",
        metric_id: "QUALITY_SCORE",
      },
    ],
    [
      "unmeasured metric",
      {
        selector_format_version: "1.0.0",
        source: "AGGREGATE_POOLED_PROPORTION",
        metric_id: "MISSING_METRIC",
      },
    ],
    [
      "nonexistent paired group",
      {
        selector_format_version: "1.0.0",
        source: "AGGREGATE_PRECISION",
        group_id: "MISSING_GROUP",
      },
    ],
  ])(
    "unresolvable candidate selector rejects: %s",
    async (_label, selector) => {
      const execution = await runCases([makeCase()]);
      expectCode(
        () => resolveRegressionCandidate(execution, selector),
        "RUNNER_REGRESSION_CANDIDATE_SOURCE",
      );
    },
  );
});
