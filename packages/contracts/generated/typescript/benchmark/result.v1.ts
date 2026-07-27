/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/benchmark/result.v1.schema.json
 * Schema id: urn:japp:schema:benchmark:result:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { BenchmarkCaseV1MetricUnit } from "../benchmark/case.v1.ts";
import type { CommonContractTextV1BoundedToken, CommonContractTextV1GitObjectId, CommonContractTextV1MetricValue, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

/**
 * Benchmark completeness
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkResultV1CompletenessState = "COMPLETE" | "FAILED_SETUP" | "PARTIAL";

/**
 * Environment comparison state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkResultV1EnvironmentMatchState = "MATCH" | "MISMATCH" | "UNKNOWN";

/**
 * Artifact hash state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkResultV1HashState = "MATCH" | "MISMATCH" | "UNKNOWN";

/**
 * Holdout state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkResultV1HoldoutState = "INVALID" | "NOT_APPLICABLE" | "UNAVAILABLE" | "VALID";

/**
 * One deterministic measured metric
 */
export interface BenchmarkResultV1MetricResult {
  readonly metric_id: CommonEnumTokenV1EnumToken;
  readonly measured_value: CommonContractTextV1MetricValue;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly threshold_digest: CommonProvenanceV1ContentDigest;
  readonly passed: boolean;
}

/**
 * Bounded measured runtime metadata
 */
export interface BenchmarkResultV1RuntimeMetadata {
  readonly runtime_family: CommonEnumTokenV1EnumToken;
  readonly runtime_version: CommonContractTextV1BoundedToken;
  readonly toolchain_digest: CommonProvenanceV1ContentDigest;
  readonly platform_profile: CommonEnumTokenV1EnumToken;
  readonly model_digest?: CommonProvenanceV1ContentDigest;
  readonly adapter_version?: CommonContractTextV1VersionText;
  readonly browser_family?: CommonEnumTokenV1EnumToken;
  readonly browser_version?: CommonContractTextV1BoundedToken;
  readonly operating_system?: CommonEnumTokenV1EnumToken;
  readonly architecture?: CommonEnumTokenV1EnumToken;
}

/**
 * Benchmark result
 *
 * Measured result for one immutable benchmark case. A result cannot alter thresholds or change a critical gate.
 */
export interface BenchmarkResultV1 {
  readonly result_id: CommonStableIdV1StableId;
  readonly case_id: CommonStableIdV1StableId;
  readonly case_digest: CommonProvenanceV1ContentDigest;
  readonly repository_commit: CommonContractTextV1GitObjectId;
  readonly repository_tree: CommonContractTextV1GitObjectId;
  readonly schema_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly generator_format_version: CommonContractTextV1VersionText;
  readonly corpus_digest: CommonProvenanceV1ContentDigest;
  readonly holdout_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly runtime_metadata: BenchmarkResultV1RuntimeMetadata;
  readonly started_at: CommonTimestampUtcV1UtcTimestamp;
  readonly ended_at: CommonTimestampUtcV1UtcTimestamp;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 86400000.
   */
  readonly duration_ms: number;
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly metric_results: readonly BenchmarkResultV1MetricResult[];
  readonly case_threshold_set_digest: CommonProvenanceV1ContentDigest;
  readonly evaluated_threshold_set_digest: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly failure_error_codes: readonly ErrorTaxonomyV1ErrorCode[];
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly artifact_report_digests: readonly CommonProvenanceV1ContentDigest[];
  readonly completeness_state: BenchmarkResultV1CompletenessState;
  readonly environment_match_state: BenchmarkResultV1EnvironmentMatchState;
  readonly hash_state: BenchmarkResultV1HashState;
  readonly holdout_state: BenchmarkResultV1HoldoutState;
  readonly comparable: boolean;
  readonly comparison_baseline_ref?: CommonStableIdV1StableId;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly overall_outcome: "FAIL" | "INVALID" | "PASS";
}
