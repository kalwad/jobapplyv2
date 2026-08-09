export const EVALUATION_RUNNER_VERSION = "1.0.0" as const;
export const EXECUTION_REQUEST_FORMAT_VERSION = "1.0.0" as const;
export const EXECUTION_RECORD_FORMAT_VERSION = "1.0.0" as const;
export const REPLAY_WITNESS_FORMAT_VERSION = "1.0.0" as const;
export const AGGREGATE_FORMAT_VERSION = "1.0.0" as const;
export const REGRESSION_FORMAT_VERSION = "1.0.0" as const;
export const REGRESSION_SOURCE_FORMAT_VERSION = "1.0.0" as const;
export const CANDIDATE_SELECTOR_FORMAT_VERSION = "1.0.0" as const;
export const REPORT_FORMAT_VERSION = "1.0.0" as const;
export const REPORT_BUNDLE_MANIFEST_VERSION = "1.0.0" as const;
export const THRESHOLD_COMMITMENT_VERSION = "1.0.0" as const;

/**
 * Shared limitation bounds. A request may commit at most 32 caller
 * limitations; the report prepends at most 3 fixed runner limitations, so a
 * legitimate maximal development report carries 35 entries. Both boundaries
 * derive from these constants; no other numeric limitation bound may exist.
 */
export const MAX_USER_LIMITATIONS = 32;
export const MAX_FIXED_REPORT_LIMITATIONS = 3;
export const MAX_REPORT_LIMITATIONS =
  MAX_USER_LIMITATIONS + MAX_FIXED_REPORT_LIMITATIONS;

export const NO_GATE_AUTHORITY_STATEMENT =
  "THIS REPORT HAS NO CRITICAL-GATE AUTHORITY" as const;

export const DEVELOPMENT_HOLDOUT_POLICY =
  "DEVELOPMENT_NOT_APPLICABLE_V1" as const;

export const DEVELOPMENT_HOLDOUT_COMMITMENT = Object.freeze({
  commitment_version: "1.0.0",
  owner: "M02-W05",
  purpose: "PUBLIC_SYNTHETIC_DEVELOPMENT_EXECUTION_ONLY",
  holdout_state: "NOT_APPLICABLE",
  explicitly_not: "M02-W06_HOLDOUT_MANIFEST_OR_GATE_EVIDENCE",
} as const);

export const SUPPORTED_METRIC_UNITS = Object.freeze([
  "BYTES",
  "COUNT",
  "MILLISECONDS",
  "RATIO",
  "SCORE",
] as const);

export const SUPPORTED_THRESHOLD_COMPARATORS = Object.freeze([
  "AT_LEAST",
  "AT_MOST",
  "EXACT",
] as const);

/**
 * Versioned descriptors of the runner's own measurement semantics. Their
 * canonical digests are the metric/threshold semantics commitments carried
 * by execution-derived regression candidates, so a semantics change breaks
 * comparability instead of silently comparing different algorithms.
 */
export const METRIC_SEMANTICS_COMMITMENT_V1 = Object.freeze({
  semantics_version: "1.0.0",
  owner: "M02-W05",
  numeric_model: "EXACT_SHORTEST_DECIMAL_BIGINT_RATIONAL",
  supported_units: SUPPORTED_METRIC_UNITS,
  proportion_pooling: "MICRO_POOLED_RAW_COUNTS",
  uncertainty: {
    method: "WILSON_SCORE",
    confidence_level: 0.95,
    z: "1.959963984540054",
  },
} as const);

export const THRESHOLD_SEMANTICS_COMMITMENT_V1 = Object.freeze({
  semantics_version: "1.0.0",
  owner: "M02-W05",
  commitment_version: THRESHOLD_COMMITMENT_VERSION,
  comparators: SUPPORTED_THRESHOLD_COMPARATORS,
  comparison: "EXACT_DECIMAL_CROSS_SCALED",
  zero_tolerance: "ZERO_EXPECTED_AT_MOST_OR_EXACT",
} as const);
