/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/benchmark/case.v1.schema.json
 * Schema id: urn:japp:schema:benchmark:case:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken, CommonContractTextV1MetricValue, CommonContractTextV1SchemaReference, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Benchmark family
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkCaseV1BenchmarkFamily = "AUTOFILL_FEASIBILITY" | "CONTRACT_COMPATIBILITY" | "RESUME_PAGEFIT_FEASIBILITY" | "WORKDAY_GUIDED_PRE_SUBMIT";

/**
 * Bounded benchmark environment requirements
 */
export interface BenchmarkCaseV1EnvironmentRequirements {
  readonly runtime_profile: CommonEnumTokenV1EnumToken;
  readonly platform_profile: CommonEnumTokenV1EnumToken;
  readonly toolchain_digest: CommonProvenanceV1ContentDigest;
  readonly model_profile_ref?: CommonStableIdV1StableId;
  readonly adapter_version?: CommonContractTextV1VersionText;
  readonly browser_family?: CommonEnumTokenV1EnumToken;
  readonly browser_version?: CommonContractTextV1BoundedToken;
}

/**
 * Expected case behavior
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkCaseV1ExpectedBehavior = "ACCEPT" | "BLOCK" | "MEASURE" | "REJECT";

/**
 * Benchmark input artifact commitment
 */
export interface BenchmarkCaseV1InputArtifact {
  readonly artifact_ref: CommonStableIdV1StableId;
  readonly artifact_digest: CommonProvenanceV1ContentDigest;
  readonly schema_ref: CommonContractTextV1SchemaReference;
}

/**
 * Metric unit
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkCaseV1MetricUnit = "BYTES" | "COUNT" | "MILLISECONDS" | "RATIO" | "SCORE";

/**
 * Threshold comparator
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type BenchmarkCaseV1ThresholdComparator = "AT_LEAST" | "AT_MOST" | "EXACT";

/**
 * One immutable expected threshold
 */
export interface BenchmarkCaseV1Threshold {
  readonly metric_id: CommonEnumTokenV1EnumToken;
  readonly comparator: BenchmarkCaseV1ThresholdComparator;
  readonly expected_value: CommonContractTextV1MetricValue;
  readonly unit: BenchmarkCaseV1MetricUnit;
}

/**
 * Benchmark case
 *
 * Immutable expected behavior, threshold, corpus, environment, and provenance contract for one future benchmark case.
 */
export interface BenchmarkCaseV1 {
  readonly case_id: CommonStableIdV1StableId;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly case_schema_version: "BENCHMARK_CASE_V1";
  readonly benchmark_family: BenchmarkCaseV1BenchmarkFamily;
  readonly corpus_version: CommonContractTextV1VersionText;
  readonly corpus_digest: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 1.
   * Maximum items: 32.
   */
  readonly input_artifacts: readonly BenchmarkCaseV1InputArtifact[];
  readonly expected_behavior: BenchmarkCaseV1ExpectedBehavior;
  readonly threshold_set_ref: CommonStableIdV1StableId;
  readonly threshold_set_digest: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly thresholds: readonly BenchmarkCaseV1Threshold[];
  readonly environment_requirements: BenchmarkCaseV1EnvironmentRequirements;
  readonly synthetic_data: boolean;
  readonly provenance: CommonProvenanceV1Provenance;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly holdout_visibility: "OWNER_CONTROLLED_HIDDEN" | "PUBLIC_SYNTHETIC" | "REVIEWER_ONLY";
  /**
   * Minimum items: 1.
   * Maximum items: 16.
   */
  readonly applicable_platform_profiles: readonly CommonEnumTokenV1EnumToken[];
}
