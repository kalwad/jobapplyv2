import { describe, expect, test } from "vitest";

import {
  canonicalJson,
  compareExactDecimals,
  computeThresholdSetDigest,
  evaluateThresholds,
  exactDecimalFromCanonicalText,
  exactDecimalFromNumber,
  exactDecimalToText,
  sha256Canonical,
  validateExecutionRequest,
  type BenchmarkCaseV1,
  type BenchmarkCaseV1MetricUnit,
  type BenchmarkCaseV1ThresholdComparator,
  type EvaluationRunnerError,
} from "../../src/index.ts";
import {
  makeCase,
  makeRequest,
  required,
  semanticClone,
} from "./support/fixtures.ts";

function oneThreshold(
  comparator: BenchmarkCaseV1ThresholdComparator,
  expected: number,
  measured: number,
  unit: BenchmarkCaseV1MetricUnit = "SCORE",
) {
  const benchmarkCase = makeCase({
    thresholds: [
      {
        metric_id: "BOUNDARY_METRIC",
        comparator,
        expected_value: expected,
        unit,
      },
    ],
  });
  return evaluateThresholds(benchmarkCase, [
    {
      metric_id: "BOUNDARY_METRIC",
      measured_value: measured,
      unit,
    },
  ]).results[0];
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("immutable threshold engine", () => {
  test("AT_LEAST passes at its exact boundary", () => {
    expect(oneThreshold("AT_LEAST", 0.8, 0.8)?.passed).toBe(true);
  });

  test("AT_LEAST fails immediately below its boundary", () => {
    expect(oneThreshold("AT_LEAST", 0.8, 0.799999)?.passed).toBe(false);
  });

  test("AT_MOST passes at its exact boundary", () => {
    expect(oneThreshold("AT_MOST", 12, 12, "COUNT")?.passed).toBe(true);
  });

  test("AT_MOST fails above its boundary", () => {
    expect(oneThreshold("AT_MOST", 12, 13, "COUNT")?.passed).toBe(false);
  });

  test("EXACT accepts an exact value", () => {
    expect(oneThreshold("EXACT", 1, 1, "RATIO")?.passed).toBe(true);
  });

  test("EXACT rejects a distinct value", () => {
    expect(oneThreshold("EXACT", 1, 0.999999, "RATIO")?.passed).toBe(false);
  });

  test.each([
    ["BYTES", 1024],
    ["COUNT", 7],
    ["MILLISECONDS", 25],
    ["RATIO", 0.5],
    ["SCORE", 0.75],
  ] as const)("supports the %s unit without conversion", (unit, value) => {
    expect(oneThreshold("EXACT", value, value, unit)?.passed).toBe(true);
  });

  test("unit mismatch rejects instead of coercing", () => {
    const benchmarkCase = makeCase();
    expectCode(
      () =>
        evaluateThresholds(benchmarkCase, [
          {
            metric_id: "QUALITY_SCORE",
            measured_value: 0.8,
            unit: "RATIO",
          },
        ]),
      "RUNNER_METRIC_UNIT_MISMATCH",
    );
  });

  test("duplicate measured metric rejects", () => {
    const benchmarkCase = makeCase();
    const metric = {
      metric_id: "QUALITY_SCORE",
      measured_value: 0.8,
      unit: "SCORE" as const,
    };
    expectCode(
      () => evaluateThresholds(benchmarkCase, [metric, metric]),
      "RUNNER_DUPLICATE_METRIC",
    );
  });

  test("missing metric rejects a COMPLETE observation", () => {
    expectCode(
      () => evaluateThresholds(makeCase(), []),
      "RUNNER_MISSING_METRIC",
    );
  });

  test("missing metric is explicit for a PARTIAL observation", () => {
    const result = evaluateThresholds(makeCase(), [], "PARTIAL");
    expect(result.results).toEqual([]);
    expect(result.missing_metric_ids).toEqual(["QUALITY_SCORE"]);
  });

  test("unknown metric rejects", () => {
    expectCode(
      () =>
        evaluateThresholds(makeCase(), [
          {
            metric_id: "UNEXPECTED_METRIC",
            measured_value: 1,
            unit: "SCORE",
          },
        ]),
      "RUNNER_UNEXPECTED_METRIC",
    );
  });

  test("threshold digest tamper rejects", () => {
    const benchmarkCase = semanticClone(makeCase()) as unknown as Record<
      string,
      unknown
    >;
    benchmarkCase.threshold_set_digest = `sha256:${"f".repeat(64)}`;
    expectCode(
      () => evaluateThresholds(benchmarkCase as never, []),
      "RUNNER_THRESHOLD_DIGEST_MISMATCH",
    );
  });

  test("threshold commitment is independent of input array ordering", () => {
    const thresholds = [
      {
        metric_id: "SECOND_METRIC",
        comparator: "EXACT" as const,
        expected_value: 2,
        unit: "COUNT" as const,
      },
      {
        metric_id: "FIRST_METRIC",
        comparator: "EXACT" as const,
        expected_value: 1,
        unit: "COUNT" as const,
      },
    ];
    const left = makeCase({ thresholds });
    const right = makeCase({ thresholds: [...thresholds].reverse() });
    expect(computeThresholdSetDigest(left)).toBe(
      computeThresholdSetDigest(right),
    );
  });
});

describe("exact bounded decimal behavior", () => {
  test("the 0.1 representation edge is preserved rather than epsilon-equal", () => {
    expect(oneThreshold("EXACT", 0.3, 0.1 + 0.2)?.passed).toBe(false);
    expect(exactDecimalToText(exactDecimalFromNumber(0.1 + 0.2))).toBe(
      "0.30000000000000004",
    );
  });

  test("exact 1.0 is canonical integer one", () => {
    expect(exactDecimalToText(exactDecimalFromNumber(1.0))).toBe("1");
    expect(oneThreshold("EXACT", 1.0, 1)?.passed).toBe(true);
  });

  test("0.999999 stays distinct from one", () => {
    expect(
      compareExactDecimals(
        exactDecimalFromNumber(0.999999),
        exactDecimalFromNumber(1),
      ),
    ).toBe(-1);
  });

  test("zero is exact and declares zero tolerance for EXACT and AT_MOST", () => {
    expect(oneThreshold("EXACT", 0, 0, "COUNT")?.zero_tolerance).toBe(true);
    expect(oneThreshold("AT_MOST", 0, 0, "COUNT")?.zero_tolerance).toBe(true);
    expect(oneThreshold("AT_LEAST", 0, 0, "COUNT")?.zero_tolerance).toBe(false);
  });

  test("negative metric input is rejected by the authoritative case contract", () => {
    const benchmarkCase = semanticClone(makeCase()) as unknown as {
      thresholds: {
        metric_id: string;
        comparator: BenchmarkCaseV1ThresholdComparator;
        expected_value: number;
        unit: BenchmarkCaseV1MetricUnit;
      }[];
      threshold_set_ref: string;
      threshold_set_digest: string;
    };
    required(benchmarkCase.thresholds[0], "negative threshold").expected_value =
      -1;
    benchmarkCase.threshold_set_digest =
      computeThresholdSetDigest(benchmarkCase);
    const request = makeRequest([benchmarkCase as unknown as BenchmarkCaseV1]);
    const mutableRequest = request as unknown as {
      case_commitments: { case_digest: string }[];
    };
    required(
      mutableRequest.case_commitments[0],
      "negative case commitment",
    ).case_digest = sha256Canonical(benchmarkCase);
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_BENCHMARK_CASE_STRUCTURE",
    );
  });

  test("large bounded integer compares exactly", () => {
    expect(
      oneThreshold("EXACT", 1_000_000_000_000, 1_000_000_000_000, "BYTES")
        ?.passed,
    ).toBe(true);
  });

  test("ratio boundary does not round a below-boundary value up", () => {
    expect(
      oneThreshold("AT_LEAST", 0.9, 0.8999999999999999, "RATIO")?.passed,
    ).toBe(false);
  });

  test.each(["01", "1.0", "+1", "1e0", "-0", "0.10"])(
    "noncanonical decimal text %s rejects",
    (text) => {
      expectCode(
        () => exactDecimalFromCanonicalText(text),
        "RUNNER_NONCANONICAL_DECIMAL",
      );
    },
  );

  test("canonical serialization is deterministic", () => {
    const value = { z: 0.1, a: { y: 1, x: 0.999999 } };
    expect(canonicalJson(value)).toBe('{"a":{"x":0.999999,"y":1},"z":0.1}');
    expect(canonicalJson(value)).toBe(canonicalJson(value));
  });
});
