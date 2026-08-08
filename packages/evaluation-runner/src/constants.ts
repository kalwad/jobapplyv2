export const EVALUATION_RUNNER_VERSION = "1.0.0" as const;
export const EXECUTION_REQUEST_FORMAT_VERSION = "1.0.0" as const;
export const EXECUTION_RECORD_FORMAT_VERSION = "1.0.0" as const;
export const AGGREGATE_FORMAT_VERSION = "1.0.0" as const;
export const REGRESSION_FORMAT_VERSION = "1.0.0" as const;
export const REPORT_FORMAT_VERSION = "1.0.0" as const;
export const REPORT_BUNDLE_MANIFEST_VERSION = "1.0.0" as const;
export const THRESHOLD_COMMITMENT_VERSION = "1.0.0" as const;

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
