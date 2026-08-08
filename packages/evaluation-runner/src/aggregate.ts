import { compareCanonicalText } from "./canonical.ts";
import { AGGREGATE_FORMAT_VERSION } from "./constants.ts";
import { runnerFail } from "./errors.ts";
import type {
  AggregateCountsV1,
  AggregateSummaryV1,
  BenchmarkCaseV1MetricUnit,
  CaseExecutionRecordV1,
  ErrorTaxonomyV1ErrorCode,
  ImplementationGroupV1,
  MetricAggregateV1,
  PairedCountObservationV1,
} from "./model.ts";
import { countRate, derivePrecisionRecall, wilson95 } from "./statistics.ts";

interface MutableMetricAggregate {
  unit: BenchmarkCaseV1MetricUnit;
  required: number;
  observed: number;
  missing: number;
  passed: number;
  failed: number;
  comparableObserved: number;
  comparablePassed: number;
  environmentMismatchSeen: boolean;
  incomparableSeen: boolean;
  proportionDeclared: boolean | null;
  proportionObservations: number;
  proportionNumerator: number;
  proportionDenominator: number;
  zeroToleranceFailures: number;
}

interface MutableGroup {
  kind: "BASELINE" | "IMPLEMENTATION";
  identity: string;
  version: string;
  source_digest: CaseExecutionRecordV1["implementation"]["source_digest"];
  cases: number;
  pass: number;
  fail: number;
  invalid: number;
}

interface MutablePairedCounts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  environmentMismatchSeen: boolean;
  incomparableSeen: boolean;
}

function safeAdd(left: number, right: number, pointer: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    return runnerFail(
      "RUNNER_AGGREGATE_OVERFLOW",
      pointer,
      "aggregate count exceeds the safe integer range",
    );
  }
  return result;
}

function countBy<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): number {
  return values.reduce((total, value) => total + (predicate(value) ? 1 : 0), 0);
}

function aggregateCounts(
  records: readonly CaseExecutionRecordV1[],
): AggregateCountsV1 {
  return {
    total_cases: records.length,
    complete: countBy(
      records,
      (record) => record.completeness_state === "COMPLETE",
    ),
    partial: countBy(
      records,
      (record) => record.completeness_state === "PARTIAL",
    ),
    failed_setup: countBy(
      records,
      (record) => record.completeness_state === "FAILED_SETUP",
    ),
    comparable: countBy(records, (record) => record.comparable),
    incomparable: countBy(records, (record) => !record.comparable),
    pass: countBy(records, (record) => record.overall_outcome === "PASS"),
    fail: countBy(records, (record) => record.overall_outcome === "FAIL"),
    invalid: countBy(records, (record) => record.overall_outcome === "INVALID"),
    environment_match: countBy(
      records,
      (record) => record.environment_match_state === "MATCH",
    ),
    environment_mismatch: countBy(
      records,
      (record) => record.environment_match_state === "MISMATCH",
    ),
    environment_unknown: countBy(
      records,
      (record) => record.environment_match_state === "UNKNOWN",
    ),
    hash_match: countBy(records, (record) => record.hash_state === "MATCH"),
    hash_mismatch: countBy(
      records,
      (record) => record.hash_state === "MISMATCH",
    ),
    hash_unknown: countBy(records, (record) => record.hash_state === "UNKNOWN"),
    holdout_valid: countBy(
      records,
      (record) => record.holdout_state === "VALID",
    ),
    holdout_not_applicable: countBy(
      records,
      (record) => record.holdout_state === "NOT_APPLICABLE",
    ),
    holdout_unavailable: countBy(
      records,
      (record) => record.holdout_state === "UNAVAILABLE",
    ),
    holdout_invalid: countBy(
      records,
      (record) => record.holdout_state === "INVALID",
    ),
    zero_tolerance_failure_count: records.reduce(
      (total, record) =>
        total +
        record.threshold_results.filter(
          (metric) => metric.zero_tolerance && !metric.passed,
        ).length,
      0,
    ),
  };
}

function aggregateMetrics(
  records: readonly CaseExecutionRecordV1[],
): readonly MetricAggregateV1[] {
  const metrics = new Map<string, MutableMetricAggregate>();
  for (const record of records) {
    const missing = new Set(record.missing_metric_ids);
    for (const required of record.required_metric_units) {
      const existing = metrics.get(required.metric_id);
      if (existing !== undefined && existing.unit !== required.unit) {
        runnerFail(
          "RUNNER_AGGREGATE_UNIT_MIX",
          `/metrics/${required.metric_id}`,
          `cannot aggregate ${existing.unit} with ${required.unit}`,
        );
      }
      const aggregate = existing ?? {
        unit: required.unit,
        required: 0,
        observed: 0,
        missing: 0,
        passed: 0,
        failed: 0,
        comparableObserved: 0,
        comparablePassed: 0,
        environmentMismatchSeen: false,
        incomparableSeen: false,
        proportionDeclared: null,
        proportionObservations: 0,
        proportionNumerator: 0,
        proportionDenominator: 0,
        zeroToleranceFailures: 0,
      };
      aggregate.required += 1;
      if (missing.has(required.metric_id)) {
        aggregate.missing += 1;
      }
      if (!record.comparable) {
        aggregate.incomparableSeen = true;
      }
      if (record.environment_match_state === "MISMATCH") {
        aggregate.environmentMismatchSeen = true;
      }
      metrics.set(required.metric_id, aggregate);
    }
    for (const result of record.threshold_results) {
      const aggregate = metrics.get(result.metric_id);
      if (aggregate === undefined) {
        runnerFail(
          "RUNNER_AGGREGATE_METRIC_INVENTORY",
          `/metrics/${result.metric_id}`,
          "observed metric lacks a required inventory entry",
        );
      }
      if (aggregate.unit !== result.unit) {
        runnerFail(
          "RUNNER_AGGREGATE_METRIC_INVENTORY",
          `/metrics/${result.metric_id}`,
          "observed metric unit differs from the required inventory entry",
        );
      }
      aggregate.observed += 1;
      if (record.comparable) {
        aggregate.comparableObserved += 1;
      } else {
        aggregate.incomparableSeen = true;
      }
      if (record.environment_match_state === "MISMATCH") {
        aggregate.environmentMismatchSeen = true;
      }
      const proportionDeclared = result.proportion !== null;
      if (
        aggregate.proportionDeclared !== null &&
        aggregate.proportionDeclared !== proportionDeclared
      ) {
        runnerFail(
          "RUNNER_AGGREGATE_PROPORTION_SEMANTICS",
          `/metrics/${result.metric_id}`,
          "a metric cannot mix proportion-count and scalar observations",
        );
      }
      aggregate.proportionDeclared = proportionDeclared;
      if (result.proportion !== null) {
        aggregate.proportionObservations += 1;
        aggregate.proportionNumerator = safeAdd(
          aggregate.proportionNumerator,
          result.proportion.numerator,
          `/metrics/${result.metric_id}/proportion_numerator`,
        );
        aggregate.proportionDenominator = safeAdd(
          aggregate.proportionDenominator,
          result.proportion.denominator,
          `/metrics/${result.metric_id}/proportion_denominator`,
        );
      }
      if (result.passed) {
        aggregate.passed += 1;
        if (record.comparable) {
          aggregate.comparablePassed += 1;
        }
      } else {
        aggregate.failed += 1;
        if (result.zero_tolerance) {
          aggregate.zeroToleranceFailures += 1;
        }
      }
    }
  }
  return [...metrics.entries()]
    .sort(([left], [right]) => compareCanonicalText(left, right))
    .map(([metricId, metric]) => {
      const pooledProportion =
        metric.proportionDeclared === true
          ? countRate(metric.proportionNumerator, metric.proportionDenominator)
          : null;
      const proportionUncertainty =
        metric.observed === 0
          ? ({ interval: null, note: "NO_OBSERVATIONS" } as const)
          : metric.proportionDeclared !== true
            ? ({ interval: null, note: "NON_BERNOULLI_METRIC" } as const)
            : metric.environmentMismatchSeen
              ? ({ interval: null, note: "ENVIRONMENT_MISMATCH" } as const)
              : metric.incomparableSeen
                ? ({ interval: null, note: "INCOMPARABLE_RESULT" } as const)
                : wilson95(
                    metric.proportionNumerator,
                    metric.proportionDenominator,
                  );
      return {
        metric_id: metricId,
        unit: metric.unit,
        required_count: metric.required,
        observed_count: metric.observed,
        missing_count: metric.missing,
        pass_count: metric.passed,
        fail_count: metric.failed,
        pass_rate: countRate(metric.passed, metric.observed),
        pass_uncertainty: wilson95(
          metric.comparablePassed,
          metric.comparableObserved,
        ),
        proportion_observation_count: metric.proportionObservations,
        pooled_proportion: pooledProportion,
        proportion_uncertainty: proportionUncertainty,
        uncertainty_notes: [
          ...(metric.environmentMismatchSeen
            ? [{ interval: null, note: "ENVIRONMENT_MISMATCH" as const }]
            : []),
          ...(metric.incomparableSeen
            ? [{ interval: null, note: "INCOMPARABLE_RESULT" as const }]
            : []),
        ],
        zero_tolerance_failure_count: metric.zeroToleranceFailures,
        zero_tolerance_uncertainty: {
          interval: null,
          note: "ZERO_TOLERANCE_COUNT",
        },
      };
    });
}

function aggregateFailureCodes(
  records: readonly CaseExecutionRecordV1[],
): Readonly<Partial<Record<ErrorTaxonomyV1ErrorCode, number>>> {
  const counts = new Map<ErrorTaxonomyV1ErrorCode, number>();
  for (const record of records) {
    for (const code of record.failure_error_codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  const result: Partial<Record<ErrorTaxonomyV1ErrorCode, number>> = {};
  for (const [code, count] of [...counts.entries()].sort(([left], [right]) =>
    compareCanonicalText(left, right),
  )) {
    result[code] = count;
  }
  return result;
}

function aggregateImplementationGroups(
  records: readonly CaseExecutionRecordV1[],
): readonly ImplementationGroupV1[] {
  const groups = new Map<string, MutableGroup>();
  for (const record of records) {
    const implementation = record.implementation;
    const key = [
      implementation.kind,
      implementation.identity,
      implementation.version,
      implementation.source_digest,
    ].join("\u0000");
    const group = groups.get(key) ?? {
      kind: implementation.kind,
      identity: implementation.identity,
      version: implementation.version,
      source_digest: implementation.source_digest,
      cases: 0,
      pass: 0,
      fail: 0,
      invalid: 0,
    };
    group.cases += 1;
    group.pass += record.overall_outcome === "PASS" ? 1 : 0;
    group.fail += record.overall_outcome === "FAIL" ? 1 : 0;
    group.invalid += record.overall_outcome === "INVALID" ? 1 : 0;
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((left, right) =>
      compareCanonicalText(
        `${left.kind}:${left.identity}:${left.version}`,
        `${right.kind}:${right.identity}:${right.version}`,
      ),
    )
    .map((group) => ({
      kind: group.kind,
      identity: group.identity,
      version: group.version,
      source_digest: group.source_digest,
      case_count: group.cases,
      pass_count: group.pass,
      fail_count: group.fail,
      invalid_count: group.invalid,
    }));
}

function addPairedCounts(
  target: MutablePairedCounts,
  source: PairedCountObservationV1,
): void {
  target.truePositive = safeAdd(
    target.truePositive,
    source.true_positive,
    `/paired_counts/${source.group_id}/true_positive`,
  );
  target.falsePositive = safeAdd(
    target.falsePositive,
    source.false_positive,
    `/paired_counts/${source.group_id}/false_positive`,
  );
  target.falseNegative = safeAdd(
    target.falseNegative,
    source.false_negative,
    `/paired_counts/${source.group_id}/false_negative`,
  );
}

function aggregatePairedCounts(records: readonly CaseExecutionRecordV1[]) {
  const groups = new Map<string, MutablePairedCounts>();
  for (const record of records) {
    for (const counts of record.paired_counts) {
      const target = groups.get(counts.group_id) ?? {
        truePositive: 0,
        falsePositive: 0,
        falseNegative: 0,
        environmentMismatchSeen: false,
        incomparableSeen: false,
      };
      addPairedCounts(target, counts);
      target.environmentMismatchSeen ||=
        record.environment_match_state === "MISMATCH";
      target.incomparableSeen ||= !record.comparable;
      groups.set(counts.group_id, target);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareCanonicalText(left, right))
    .map(([groupId, counts]) =>
      derivePrecisionRecall(
        groupId,
        counts.truePositive,
        counts.falsePositive,
        counts.falseNegative,
        [
          ...(counts.environmentMismatchSeen
            ? [{ interval: null, note: "ENVIRONMENT_MISMATCH" as const }]
            : []),
          ...(counts.incomparableSeen
            ? [{ interval: null, note: "INCOMPARABLE_RESULT" as const }]
            : []),
        ],
      ),
    );
}

export function aggregateCaseResults(
  records: readonly CaseExecutionRecordV1[],
): AggregateSummaryV1 {
  const caseIds = records.map((record) => record.case_id);
  if (new Set(caseIds).size !== caseIds.length) {
    runnerFail(
      "RUNNER_AGGREGATE_DUPLICATE_CASE",
      "/records",
      "a finite aggregate cannot contain a case more than once",
    );
  }
  const counts = aggregateCounts(records);
  if (
    counts.complete + counts.partial + counts.failed_setup !==
      counts.total_cases ||
    counts.pass + counts.fail + counts.invalid !== counts.total_cases ||
    counts.comparable + counts.incomparable !== counts.total_cases
  ) {
    runnerFail(
      "RUNNER_AGGREGATE_PARTITION",
      "/counts",
      "derived count partitions do not cover every case exactly once",
    );
  }
  return {
    aggregate_format_version: AGGREGATE_FORMAT_VERSION,
    counts,
    pass_rate: countRate(counts.pass, counts.total_cases),
    comparable_rate: countRate(counts.comparable, counts.total_cases),
    failure_error_code_counts: aggregateFailureCodes(records),
    metric_summaries: aggregateMetrics(records),
    precision_recall_summaries: aggregatePairedCounts(records),
    implementation_groups: aggregateImplementationGroups(records),
  };
}
