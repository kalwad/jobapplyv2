import type { BenchmarkCaseV1 } from "@japp/contracts/generated";

import {
  compareCanonicalText,
  sha256Canonical,
  type ContentDigest,
} from "./canonical.ts";
import {
  SUPPORTED_METRIC_UNITS,
  THRESHOLD_COMMITMENT_VERSION,
} from "./constants.ts";
import {
  compareExactDecimals,
  exactDecimalFromNumber,
  exactDecimalIsZero,
} from "./exact-decimal.ts";
import { runnerFail } from "./errors.ts";
import type {
  CountRateV1,
  MeasuredMetricV1,
  ThresholdEvaluationV1,
} from "./model.ts";
import { countRate } from "./statistics.ts";

function boundedValue(value: unknown, pointer: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000_000
  ) {
    return runnerFail(
      "RUNNER_METRIC_VALUE",
      pointer,
      "metric values must be finite numbers from 0 through 1000000000000",
    );
  }
  return value;
}

function supportedUnit(value: unknown, pointer: string): void {
  if (
    typeof value !== "string" ||
    !SUPPORTED_METRIC_UNITS.includes(
      value as (typeof SUPPORTED_METRIC_UNITS)[number],
    )
  ) {
    runnerFail("RUNNER_METRIC_UNIT", pointer, "unsupported metric unit");
  }
}

function comparatorResult(
  comparator: unknown,
  comparison: -1 | 0 | 1,
  pointer: string,
): boolean {
  switch (comparator) {
    case "AT_LEAST":
      return comparison >= 0;
    case "AT_MOST":
      return comparison <= 0;
    case "EXACT":
      return comparison === 0;
    default:
      return runnerFail(
        "RUNNER_THRESHOLD_COMPARATOR",
        pointer,
        "unsupported threshold comparator",
      );
  }
}

export function measuredProportion(
  metric: MeasuredMetricV1,
  pointer: string,
): CountRateV1 | null {
  const counts = metric.proportion_counts;
  if (counts === undefined) {
    return null;
  }
  if (metric.unit !== "RATIO") {
    return runnerFail(
      "RUNNER_PROPORTION_UNIT",
      `${pointer}/proportion_counts`,
      "proportion counts are supported only for RATIO metrics",
    );
  }
  const rate = countRate(counts.numerator, counts.denominator);
  if (rate.rate === null) {
    if (metric.measured_value !== 0) {
      return runnerFail(
        "RUNNER_PROPORTION_ZERO_DENOMINATOR",
        `${pointer}/measured_value`,
        "a zero-denominator proportion must use measured value zero and remain NOT_APPLICABLE as a rate",
      );
    }
    return rate;
  }
  if (
    compareExactDecimals(
      exactDecimalFromNumber(metric.measured_value),
      exactDecimalFromNumber(rate.rate),
    ) !== 0
  ) {
    return runnerFail(
      "RUNNER_PROPORTION_VALUE_MISMATCH",
      `${pointer}/measured_value`,
      "measured ratio does not equal its raw numerator divided by denominator",
    );
  }
  return rate;
}

export function thresholdCommitmentPayload(
  benchmarkCase: Pick<BenchmarkCaseV1, "threshold_set_ref" | "thresholds">,
): object {
  return {
    commitment_version: THRESHOLD_COMMITMENT_VERSION,
    threshold_set_ref: benchmarkCase.threshold_set_ref,
    thresholds: [...benchmarkCase.thresholds]
      .sort((left, right) =>
        compareCanonicalText(left.metric_id, right.metric_id),
      )
      .map((threshold) => ({
        metric_id: threshold.metric_id,
        comparator: threshold.comparator,
        expected_value: threshold.expected_value,
        unit: threshold.unit,
      })),
  };
}

export function computeThresholdSetDigest(
  benchmarkCase: Pick<BenchmarkCaseV1, "threshold_set_ref" | "thresholds">,
): ContentDigest {
  return sha256Canonical(thresholdCommitmentPayload(benchmarkCase));
}

export function evaluateThresholds(
  benchmarkCase: BenchmarkCaseV1,
  metrics: readonly MeasuredMetricV1[],
  completeness: "COMPLETE" | "PARTIAL" = "COMPLETE",
): {
  readonly results: readonly ThresholdEvaluationV1[];
  readonly missing_metric_ids: readonly string[];
} {
  const expectedDigest = computeThresholdSetDigest(benchmarkCase);
  if (benchmarkCase.threshold_set_digest !== expectedDigest) {
    return runnerFail(
      "RUNNER_THRESHOLD_DIGEST_MISMATCH",
      `/cases/${benchmarkCase.case_id}/threshold_set_digest`,
      "case threshold-set digest does not match the immutable threshold payload",
    );
  }

  const observed = new Map<string, MeasuredMetricV1>();
  for (const [index, metric] of metrics.entries()) {
    if (observed.has(metric.metric_id)) {
      return runnerFail(
        "RUNNER_DUPLICATE_METRIC",
        `/metrics/${String(index)}/metric_id`,
        `duplicate measured metric ${metric.metric_id}`,
      );
    }
    boundedValue(
      metric.measured_value,
      `/metrics/${String(index)}/measured_value`,
    );
    supportedUnit(metric.unit, `/metrics/${String(index)}/unit`);
    measuredProportion(metric, `/metrics/${String(index)}`);
    observed.set(metric.metric_id, metric);
  }

  const thresholds = new Map(
    benchmarkCase.thresholds.map((threshold) => [
      threshold.metric_id,
      threshold,
    ]),
  );
  if (thresholds.size !== benchmarkCase.thresholds.length) {
    return runnerFail(
      "RUNNER_DUPLICATE_THRESHOLD",
      `/cases/${benchmarkCase.case_id}/thresholds`,
      "threshold metric identities must be unique",
    );
  }
  for (const metric of metrics) {
    if (!thresholds.has(metric.metric_id)) {
      return runnerFail(
        "RUNNER_UNEXPECTED_METRIC",
        `/metrics/${metric.metric_id}`,
        "unexpected metrics are rejected by runner format 1.0.0",
      );
    }
  }

  const missing = [...thresholds.keys()]
    .filter((metricId) => !observed.has(metricId))
    .sort();
  if (completeness === "COMPLETE" && missing.length > 0) {
    return runnerFail(
      "RUNNER_MISSING_METRIC",
      "/metrics",
      `complete observation lacks required metrics: ${missing.join(",")}`,
    );
  }

  const results: ThresholdEvaluationV1[] = [];
  for (const threshold of [...benchmarkCase.thresholds].sort((left, right) =>
    compareCanonicalText(left.metric_id, right.metric_id),
  )) {
    const metric = observed.get(threshold.metric_id);
    if (metric === undefined) {
      continue;
    }
    if (metric.unit !== threshold.unit) {
      return runnerFail(
        "RUNNER_METRIC_UNIT_MISMATCH",
        `/metrics/${metric.metric_id}/unit`,
        `measured ${metric.unit} does not match threshold ${threshold.unit}`,
      );
    }
    supportedUnit(
      threshold.unit,
      `/cases/${benchmarkCase.case_id}/thresholds/${threshold.metric_id}/unit`,
    );
    const measured = exactDecimalFromNumber(
      boundedValue(metric.measured_value, `/metrics/${metric.metric_id}/value`),
    );
    const expected = exactDecimalFromNumber(
      boundedValue(
        threshold.expected_value,
        `/cases/${benchmarkCase.case_id}/thresholds/${threshold.metric_id}/expected_value`,
      ),
    );
    const comparison = compareExactDecimals(measured, expected);
    const passed = comparatorResult(
      threshold.comparator,
      comparison,
      `/cases/${benchmarkCase.case_id}/thresholds/${threshold.metric_id}/comparator`,
    );
    results.push({
      metric_id: threshold.metric_id,
      comparator: threshold.comparator,
      expected_value: threshold.expected_value,
      measured_value: metric.measured_value,
      unit: threshold.unit,
      threshold_set_digest: expectedDigest,
      proportion: measuredProportion(metric, `/metrics/${metric.metric_id}`),
      zero_tolerance:
        exactDecimalIsZero(expected) &&
        (threshold.comparator === "AT_MOST" ||
          threshold.comparator === "EXACT"),
      passed,
    });
  }
  return { results, missing_metric_ids: missing };
}
