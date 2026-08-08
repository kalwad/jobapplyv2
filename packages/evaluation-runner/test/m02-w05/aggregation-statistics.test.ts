import { describe, expect, test } from "vitest";

import {
  aggregateCaseResults,
  derivePrecisionRecall,
  pooledProportion,
  wilson95,
  type CaseExecutionRecordV1,
  type EvaluationRunnerError,
} from "../../src/index.ts";
import {
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

describe("raw-count aggregation", () => {
  test("all-pass aggregate reports raw denominator beside rate", async () => {
    const execution = await runCases([
      makeCase({ index: 1 }),
      makeCase({ index: 2 }),
    ]);
    const aggregate = aggregateCaseResults(execution.records);
    expect(aggregate.counts.total_cases).toBe(2);
    expect(aggregate.counts.pass).toBe(2);
    expect(aggregate.pass_rate).toEqual({
      numerator: 2,
      denominator: 2,
      rate: 1,
    });
  });

  test("mixed pass/fail remains a visible partition", async () => {
    const execution = await runCases(
      [makeCase({ index: 1 }), makeCase({ index: 2 })],
      (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          metrics: [
            {
              metric_id: "QUALITY_SCORE",
              measured_value: benchmarkCase.case_id.endsWith("1") ? 0.8 : 0.7,
              unit: "SCORE",
            },
          ],
        }),
    );
    const aggregate = aggregateCaseResults(execution.records);
    expect(aggregate.counts.pass).toBe(1);
    expect(aggregate.counts.fail).toBe(1);
    expect(aggregate.counts.invalid).toBe(0);
    expect(aggregate.pass_rate.denominator).toBe(2);
  });

  test("partial and invalid cases cannot disappear from totals", async () => {
    const complete = makeCase({ index: 1 });
    const partial = makeCase({
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
    const execution = await runCases([complete, partial], (benchmarkCase) =>
      benchmarkCase.case_id === partial.case_id
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
    );
    const aggregate = aggregateCaseResults(execution.records);
    expect(aggregate.counts.total_cases).toBe(2);
    expect(aggregate.counts.partial).toBe(1);
    expect(aggregate.counts.invalid).toBe(1);
    expect(aggregate.counts.incomparable).toBe(1);
    expect(aggregate.pass_rate).toEqual({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
    });
    const second = aggregate.metric_summaries.find(
      (metric) => metric.metric_id === "SECOND_METRIC",
    );
    expect(second?.required_count).toBe(1);
    expect(second?.observed_count).toBe(0);
    expect(second?.missing_count).toBe(1);
  });

  test("failed setup is counted and its error is not hidden", async () => {
    const execution = await runCases([makeCase()], (benchmarkCase) =>
      makeObservation(benchmarkCase, { status: "FAILED_SETUP" }),
    );
    const aggregate = aggregateCaseResults(execution.records);
    expect(aggregate.counts.failed_setup).toBe(1);
    expect(aggregate.counts.invalid).toBe(1);
    expect(aggregate.failure_error_code_counts.BENCHMARK_INCOMPLETE_RUN).toBe(
      1,
    );
  });

  test("zero-tolerance failures remain raw integer counts", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "SAFETY_FAILURE_COUNT",
          comparator: "AT_MOST",
          expected_value: 0,
          unit: "COUNT",
        },
      ],
    });
    const execution = await runCases([benchmarkCase], (entry) =>
      makeObservation(entry, {
        metrics: [
          {
            metric_id: "SAFETY_FAILURE_COUNT",
            measured_value: 1,
            unit: "COUNT",
          },
        ],
      }),
    );
    const aggregate = aggregateCaseResults(execution.records);
    expect(aggregate.counts.zero_tolerance_failure_count).toBe(1);
    expect(aggregate.metric_summaries[0]?.zero_tolerance_failure_count).toBe(1);
    expect(aggregate.metric_summaries[0]?.zero_tolerance_uncertainty).toEqual({
      interval: null,
      note: "ZERO_TOLERANCE_COUNT",
    });
  });

  test("multiple metric groups retain separate units and denominators", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "BYTE_SIZE",
          comparator: "AT_MOST",
          expected_value: 100,
          unit: "BYTES",
        },
        {
          metric_id: "QUALITY_RATIO",
          comparator: "AT_LEAST",
          expected_value: 0.8,
          unit: "RATIO",
        },
      ],
    });
    const execution = await runCases([benchmarkCase]);
    const aggregate = aggregateCaseResults(execution.records);
    expect(
      aggregate.metric_summaries.map((metric) => [
        metric.metric_id,
        metric.unit,
      ]),
    ).toEqual([
      ["BYTE_SIZE", "BYTES"],
      ["QUALITY_RATIO", "RATIO"],
    ]);
    expect(
      aggregate.metric_summaries.every((metric) => metric.required_count === 1),
    ).toBe(true);
  });

  test("declared proportion metrics pool raw numerators and denominators", async () => {
    const cases = [
      makeCase({
        index: 31,
        thresholds: [
          {
            metric_id: "POOLED_RATIO",
            comparator: "AT_LEAST",
            expected_value: 0,
            unit: "RATIO",
          },
        ],
      }),
      makeCase({
        index: 32,
        thresholds: [
          {
            metric_id: "POOLED_RATIO",
            comparator: "AT_LEAST",
            expected_value: 0,
            unit: "RATIO",
          },
        ],
      }),
    ];
    const execution = await runCases(cases, (benchmarkCase) => {
      const first = benchmarkCase.case_id === cases[0]?.case_id;
      const numerator = first ? 1 : 9;
      const denominator = first ? 2 : 10;
      return makeObservation(benchmarkCase, {
        metrics: [
          {
            metric_id: "POOLED_RATIO",
            measured_value: numerator / denominator,
            unit: "RATIO",
            proportion_counts: { numerator, denominator },
          },
        ],
      });
    });
    const metric = aggregateCaseResults(execution.records).metric_summaries[0];
    expect(metric?.proportion_observation_count).toBe(2);
    expect(metric?.pooled_proportion).toEqual({
      numerator: 10,
      denominator: 12,
      rate: 10 / 12,
    });
    expect(metric?.pooled_proportion?.rate).not.toBe((0.5 + 0.9) / 2);
    expect(metric?.proportion_uncertainty).toMatchObject({
      method: "WILSON_SCORE",
      numerator: 10,
      denominator: 12,
    });
  });

  test("non-proportion scalar metrics carry an explicit uncertainty note", async () => {
    const metric = aggregateCaseResults((await runCases([makeCase()])).records)
      .metric_summaries[0];
    expect(metric?.pooled_proportion).toBeNull();
    expect(metric?.proportion_uncertainty).toEqual({
      interval: null,
      note: "NON_BERNOULLI_METRIC",
    });
  });

  test("mixing units under one metric ID rejects", async () => {
    const first = required(
      (await runCases([makeCase({ index: 1 })])).records[0],
      "first aggregate record",
    );
    const second = semanticClone(first) as unknown as CaseExecutionRecordV1 & {
      case_id: string;
      required_metric_units: { metric_id: string; unit: "RATIO" }[];
      threshold_results: { unit: "RATIO" }[];
    };
    second.case_id = makeCase({ index: 2 }).case_id;
    required(second.required_metric_units[0], "required metric").unit = "RATIO";
    required(second.threshold_results[0], "threshold result").unit = "RATIO";
    expectCode(
      () => aggregateCaseResults([first, second]),
      "RUNNER_AGGREGATE_UNIT_MIX",
    );
  });

  test("duplicate case identities reject", async () => {
    const record = required(
      (await runCases([makeCase()])).records[0],
      "duplicate aggregate record",
    );
    expectCode(
      () => aggregateCaseResults([record, record]),
      "RUNNER_AGGREGATE_DUPLICATE_CASE",
    );
  });

  test("environment-mismatched observations carry explicit uncertainty notes", async () => {
    const execution = await runCases([
      makeCase({ environment: { runtime_profile: "OTHER_RUNTIME" } }),
    ]);
    const aggregate = aggregateCaseResults(execution.records);
    const metric = aggregate.metric_summaries[0];
    expect(metric?.pass_uncertainty.denominator).toBe(0);
    expect(metric?.pass_uncertainty.note).toBe("NO_OBSERVATIONS");
    expect(metric?.uncertainty_notes.map((note) => note.note)).toEqual([
      "ENVIRONMENT_MISMATCH",
      "INCOMPARABLE_RESULT",
    ]);
  });

  test("implementation/baseline groups are explicit", async () => {
    const execution = await runCases([makeCase()]);
    const groups = aggregateCaseResults(
      execution.records,
    ).implementation_groups;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: "BASELINE",
      identity: "synthetic_runner_fixture_v1",
      case_count: 1,
      pass_count: 1,
    });
  });
});

describe("precision/recall and pooled-count discipline", () => {
  test("normal TP/FP/FN derives precision and recall together", () => {
    const summary = derivePrecisionRecall("FIELD_DECISIONS", 8, 2, 4);
    expect(summary.precision).toEqual({
      numerator: 8,
      denominator: 10,
      rate: 0.8,
    });
    expect(summary.recall).toEqual({
      numerator: 8,
      denominator: 12,
      rate: 8 / 12,
    });
  });

  test("fill-nothing style case exposes zero recall with undefined precision", () => {
    const summary = derivePrecisionRecall("FILL_NOTHING", 0, 0, 5);
    expect(summary.precision.rate).toBeNull();
    expect(summary.precision.denominator).toBe(0);
    expect(summary.recall).toEqual({
      numerator: 0,
      denominator: 5,
      rate: 0,
    });
  });

  test("zero precision denominator is explicit", () => {
    const summary = derivePrecisionRecall(
      "ZERO_PRECISION_DENOMINATOR",
      0,
      0,
      1,
    );
    expect(summary.precision.rate).toBeNull();
    expect(summary.precision_uncertainty.note).toBe("NO_OBSERVATIONS");
  });

  test("zero recall denominator is explicit", () => {
    const summary = derivePrecisionRecall("ZERO_RECALL_DENOMINATOR", 0, 1, 0);
    expect(summary.recall.rate).toBeNull();
    expect(summary.recall_uncertainty.note).toBe("NO_OBSERVATIONS");
  });

  test("case paired counts pool raw TP/FP/FN before derivation", async () => {
    const execution = await runCases(
      [makeCase({ index: 1 }), makeCase({ index: 2 })],
      (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          pairedCounts: [
            {
              group_id: "FIELD_DECISIONS",
              true_positive: benchmarkCase.case_id.endsWith("1") ? 1 : 3,
              false_positive: 1,
              false_negative: 2,
            },
          ],
        }),
    );
    const summary = aggregateCaseResults(execution.records)
      .precision_recall_summaries[0];
    expect(summary).toMatchObject({
      true_positive: 4,
      false_positive: 2,
      false_negative: 4,
    });
    expect(summary?.precision.denominator).toBe(6);
    expect(summary?.recall.denominator).toBe(8);
  });

  test("incomparable paired counts keep raw truth but emit notes instead of an interval", async () => {
    const execution = await runCases(
      [makeCase({ environment: { runtime_profile: "OTHER_RUNTIME" } })],
      (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          pairedCounts: [
            {
              group_id: "FIELD_DECISIONS",
              true_positive: 1,
              false_positive: 1,
              false_negative: 1,
            },
          ],
        }),
    );
    const summary = aggregateCaseResults(execution.records)
      .precision_recall_summaries[0];
    expect(summary).toMatchObject({
      true_positive: 1,
      false_positive: 1,
      false_negative: 1,
      precision_uncertainty: {
        interval: null,
        note: "ENVIRONMENT_MISMATCH",
      },
      recall_uncertainty: {
        interval: null,
        note: "ENVIRONMENT_MISMATCH",
      },
    });
    expect(summary?.uncertainty_notes.map((note) => note.note)).toEqual([
      "ENVIRONMENT_MISMATCH",
      "INCOMPARABLE_RESULT",
    ]);
  });

  test("pooled proportions do not average per-case ratios blindly", () => {
    const pooled = pooledProportion([
      { numerator: 1, denominator: 1 },
      { numerator: 1, denominator: 9 },
    ]);
    expect(pooled).toEqual({ numerator: 2, denominator: 10, rate: 0.2 });
    expect(pooled.rate).not.toBe((1 + 1 / 9) / 2);
  });
});

describe("fixed 95% Wilson uncertainty", () => {
  test("ordinary sample records method, raw counts, and bounds", () => {
    const interval = wilson95(8, 10);
    expect(interval.method).toBe("WILSON_SCORE");
    expect(interval.confidence_level).toBe(0.95);
    expect(interval.numerator).toBe(8);
    expect(interval.denominator).toBe(10);
    expect(Number(interval.lower_bound)).toBeLessThan(0.8);
    expect(Number(interval.upper_bound)).toBeGreaterThan(0.8);
  });

  test("0/n remains bounded and keeps raw denominator", () => {
    const interval = wilson95(0, 10);
    expect(interval.lower_bound).toBe("0");
    expect(Number(interval.upper_bound)).toBeGreaterThan(0);
    expect(interval.denominator).toBe(10);
  });

  test("n/n remains bounded and keeps raw denominator", () => {
    const interval = wilson95(10, 10);
    expect(Number(interval.lower_bound)).toBeLessThan(1);
    expect(interval.upper_bound).toBe("1");
    expect(interval.numerator).toBe(10);
  });

  test("n=1 emits its small-sample note", () => {
    const interval = wilson95(1, 1);
    expect(interval.note).toBe("SMALL_SAMPLE_N_1");
    expect(interval.lower_bound).not.toBeNull();
    expect(interval.upper_bound).toBe("1");
  });

  test("n=0 emits an explicit note and no fake interval", () => {
    expect(wilson95(0, 0)).toEqual({
      method: "WILSON_SCORE",
      confidence_level: 0.95,
      numerator: 0,
      denominator: 0,
      lower_bound: null,
      upper_bound: null,
      note: "NO_OBSERVATIONS",
    });
  });
});
