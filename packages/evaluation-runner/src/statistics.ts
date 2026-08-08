import { runnerFail } from "./errors.ts";
import type {
  CountRateV1,
  PrecisionRecallSummaryV1,
  UncertaintyNoteV1,
  WilsonIntervalV1,
} from "./model.ts";

const WILSON_95_Z = 1.959963984540054;
const PRESENTATION_DIGITS = 12;

function assertCount(value: number, pointer: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    runnerFail(
      "RUNNER_COUNT_VALUE",
      pointer,
      "expected a non-negative safe integer",
    );
  }
}

function stableDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    return runnerFail(
      "RUNNER_INTERVAL_NONFINITE",
      "/uncertainty",
      "uncertainty calculation produced a non-finite value",
    );
  }
  const fixed = value.toFixed(PRESENTATION_DIGITS);
  return fixed.replace(/(?:\.0+|(?<=[0-9])0+)$/u, "").replace(/\.$/u, "");
}

export function countRate(numerator: number, denominator: number): CountRateV1 {
  assertCount(numerator, "/numerator");
  assertCount(denominator, "/denominator");
  if (numerator > denominator) {
    runnerFail(
      "RUNNER_RATE_COUNTS",
      "/numerator",
      "rate numerator cannot exceed its denominator",
    );
  }
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

/** Fixed 95% Wilson score interval for a Bernoulli proportion. */
export function wilson95(
  numerator: number,
  denominator: number,
): WilsonIntervalV1 {
  const rate = countRate(numerator, denominator);
  if (denominator === 0 || rate.rate === null) {
    return {
      method: "WILSON_SCORE",
      confidence_level: 0.95,
      numerator,
      denominator,
      lower_bound: null,
      upper_bound: null,
      note: "NO_OBSERVATIONS",
    };
  }
  const zSquared = WILSON_95_Z * WILSON_95_Z;
  const center = rate.rate + zSquared / (2 * denominator);
  const spread =
    WILSON_95_Z *
    Math.sqrt(
      (rate.rate * (1 - rate.rate) + zSquared / (4 * denominator)) /
        denominator,
    );
  const denominatorAdjustment = 1 + zSquared / denominator;
  const lower = Math.max(0, (center - spread) / denominatorAdjustment);
  const upper = Math.min(1, (center + spread) / denominatorAdjustment);
  return {
    method: "WILSON_SCORE",
    confidence_level: 0.95,
    numerator,
    denominator,
    lower_bound: stableDecimal(lower),
    upper_bound: stableDecimal(upper),
    note: denominator === 1 ? "SMALL_SAMPLE_N_1" : null,
  };
}

export function derivePrecisionRecall(
  groupId: string,
  truePositive: number,
  falsePositive: number,
  falseNegative: number,
  uncertaintyNotes: readonly UncertaintyNoteV1[] = [],
): PrecisionRecallSummaryV1 {
  assertCount(truePositive, "/true_positive");
  assertCount(falsePositive, "/false_positive");
  assertCount(falseNegative, "/false_negative");
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const blockingUncertainty = uncertaintyNotes[0];
  return {
    group_id: groupId,
    true_positive: truePositive,
    false_positive: falsePositive,
    false_negative: falseNegative,
    precision: countRate(truePositive, precisionDenominator),
    recall: countRate(truePositive, recallDenominator),
    precision_uncertainty:
      blockingUncertainty ?? wilson95(truePositive, precisionDenominator),
    recall_uncertainty:
      blockingUncertainty ?? wilson95(truePositive, recallDenominator),
    uncertainty_notes: uncertaintyNotes,
  };
}

/** Micro/pooled proportion. It never averages already-computed case ratios. */
export function pooledProportion(
  observations: readonly {
    readonly numerator: number;
    readonly denominator: number;
  }[],
): CountRateV1 {
  let numerator = 0;
  let denominator = 0;
  for (const [index, observation] of observations.entries()) {
    assertCount(
      observation.numerator,
      `/observations/${String(index)}/numerator`,
    );
    assertCount(
      observation.denominator,
      `/observations/${String(index)}/denominator`,
    );
    if (observation.numerator > observation.denominator) {
      runnerFail(
        "RUNNER_RATE_COUNTS",
        `/observations/${String(index)}`,
        "rate numerator cannot exceed its denominator",
      );
    }
    numerator += observation.numerator;
    denominator += observation.denominator;
    if (
      !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator)
    ) {
      runnerFail(
        "RUNNER_AGGREGATE_OVERFLOW",
        "/observations",
        "pooled counts exceed the safe integer range",
      );
    }
  }
  return countRate(numerator, denominator);
}
