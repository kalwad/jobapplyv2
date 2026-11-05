/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/gate/evidence-bundle.v2.schema.json
 * Schema id: urn:japp:schema:gate:evidence-bundle:v2
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
export interface GateEvidenceBundleV2CompletenessInventory {
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
export type GateEvidenceBundleV2GateId = "AUTOFILL_FEASIBILITY" | "CROSS_PLATFORM_CORE" | "RESUME_PAGEFIT_FEASIBILITY" | "WORKDAY_GUIDED_PRE_SUBMIT";

/**
 * Exact owner holdout waiver declaration
 */
export interface GateEvidenceBundleV2OwnerHoldoutWaiver {
  /**
   * Pattern: ^ADR-0006$
   * Minimum length: 8.
   * Maximum length: 8.
   */
  readonly adr_ref: string;
  /**
   * Pattern: ^OD-035$
   * Minimum length: 6.
   * Maximum length: 6.
   */
  readonly owner_decision_ref: string;
  /**
   * Pattern: ^docs/DECISIONS\.md$
   * Minimum length: 17.
   * Maximum length: 17.
   */
  readonly source_document_ref: string;
  readonly source_record_digest: CommonProvenanceV1ContentDigest;
}

/**
 * Executed holdout or explicit nonexecution declaration
 */
export interface GateEvidenceBundleV2HoldoutAssessment {
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly state: "EXECUTED" | "NOT_EXECUTED" | "WAIVED_BY_OWNER_ADR_0006";
  readonly execution_performed: boolean;
  readonly execution_result_ref?: CommonStableIdV1StableId;
  readonly owner_waiver?: GateEvidenceBundleV2OwnerHoldoutWaiver;
}

/**
 * Gate evidence bundle v2
 *
 * Exact candidate evidence inventory with an explicit, nonexecuted owner holdout waiver. A typed waiver is a declaration; source-aware repository acceptance must independently bind the accepted owner decision. It does not evaluate repository gate state.
 */
export interface GateEvidenceBundleV2 {
  readonly evidence_bundle_id: CommonStableIdV1StableId;
  readonly gate_id: GateEvidenceBundleV2GateId;
  readonly candidate_commit: CommonContractTextV1GitObjectId;
  readonly candidate_tree: CommonContractTextV1GitObjectId;
  readonly corpus_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly holdout_manifest_digest?: CommonProvenanceV1ContentDigest;
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
  readonly completeness_inventory: GateEvidenceBundleV2CompletenessInventory;
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
  readonly holdout_assessment: GateEvidenceBundleV2HoldoutAssessment;
}
