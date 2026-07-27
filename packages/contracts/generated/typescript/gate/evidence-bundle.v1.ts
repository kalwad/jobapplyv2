/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/gate/evidence-bundle.v1.schema.json
 * Schema id: urn:japp:schema:gate:evidence-bundle:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { BenchmarkResultV1RuntimeMetadata } from "../benchmark/result.v1.ts";
import type { CommonContractTextV1GitObjectId, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText, CommonContractTextV1PositiveSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Gate evidence completeness inventory
 */
export interface GateEvidenceBundleV1CompletenessInventory {
  readonly required_benchmark_count: CommonContractTextV1PositiveSafeInteger;
  readonly present_benchmark_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly corpus_valid: boolean;
  readonly holdout_valid: boolean;
  readonly raw_artifacts_complete: boolean;
  readonly manual_inspection_complete: boolean;
  readonly independent_review_complete: boolean;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly owner_decision_requirement: "NOT_REQUIRED" | "REQUIRED";
  readonly owner_decision_complete: boolean;
}

/**
 * Critical gate identifier
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type GateEvidenceBundleV1GateId = "AUTOFILL_FEASIBILITY" | "CROSS_PLATFORM_CORE" | "RESUME_PAGEFIT_FEASIBILITY" | "WORKDAY_GUIDED_PRE_SUBMIT";

/**
 * Gate evidence bundle
 *
 * Hashable future critical-gate evidence inventory. It does not evaluate or modify repository gate state.
 */
export interface GateEvidenceBundleV1 {
  readonly evidence_bundle_id: CommonStableIdV1StableId;
  readonly gate_id: GateEvidenceBundleV1GateId;
  readonly candidate_commit: CommonContractTextV1GitObjectId;
  readonly candidate_tree: CommonContractTextV1GitObjectId;
  readonly corpus_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly holdout_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly runtime_metadata: BenchmarkResultV1RuntimeMetadata;
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly benchmark_result_refs: readonly CommonStableIdV1StableId[];
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly raw_artifact_report_digests: readonly CommonProvenanceV1ContentDigest[];
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly manual_inspection_evidence_refs: readonly CommonStableIdV1StableId[];
  readonly independent_review_ref: CommonStableIdV1StableId;
  readonly reviewer_identity_ref: CommonStableIdV1StableId;
  readonly owner_decision_ref?: CommonStableIdV1StableId;
  readonly completeness_inventory: GateEvidenceBundleV1CompletenessInventory;
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly known_limitations: readonly CommonContractTextV1NormalizedText[];
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly bundle_state: "COMPLETE" | "INCOMPLETE" | "INVALID";
  readonly evidence_bundle_digest: CommonProvenanceV1ContentDigest;
  readonly provenance: CommonProvenanceV1Provenance;
}
