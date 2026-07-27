/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/gate/decision.v1.schema.json
 * Schema id: urn:japp:schema:gate:decision:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1GitObjectId } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";
import type { GateEvidenceBundleV1GateId } from "../gate/evidence-bundle.v1.ts";

/**
 * Reviewed gate decision
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type GateDecisionV1GateDecision = "BLOCKED" | "PASS" | "REDESIGN_REQUIRED";

/**
 * Independent review state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type GateDecisionV1IndependentReviewState = "COMPLETE" | "MISSING" | "REJECTED";

/**
 * Owner decision state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type GateDecisionV1OwnerDecisionState = "COMPLETE" | "MISSING" | "NOT_REQUIRED" | "REJECTED";

/**
 * Reviewed gate-decision reason
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type GateDecisionV1ReasonCode = "CORPUS_INVALID" | "ERROR_STATE_PRESENT" | "HOLDOUT_INVALID" | "INDEPENDENT_REVIEW_INCOMPLETE" | "MISSING_EVIDENCE" | "OWNER_DECISION_INCOMPLETE" | "REQUIRED_BENCHMARK_RESULTS_INCOMPLETE" | "REVIEWED_PASS" | "REVIEWED_REDESIGN_REQUIRED" | "THRESHOLD_FAILED";

/**
 * Threshold and evidence completeness summary
 */
export interface GateDecisionV1ThresholdEvidenceSummary {
  readonly evidence_complete: boolean;
  readonly required_benchmark_results_complete: boolean;
  readonly thresholds_passed: boolean;
  readonly corpus_valid: boolean;
  readonly holdout_valid: boolean;
}

/**
 * Gate decision artifact
 *
 * Reviewed future decision artifact for one exact candidate and evidence bundle. It is distinct from current repository gate status.
 */
export interface GateDecisionV1 {
  readonly decision_record_id: CommonStableIdV1StableId;
  readonly gate_id: GateEvidenceBundleV1GateId;
  readonly candidate_commit: CommonContractTextV1GitObjectId;
  readonly candidate_tree: CommonContractTextV1GitObjectId;
  readonly evidence_bundle_digest: CommonProvenanceV1ContentDigest;
  readonly decision: GateDecisionV1GateDecision;
  readonly threshold_evidence_summary: GateDecisionV1ThresholdEvidenceSummary;
  readonly independent_review_state: GateDecisionV1IndependentReviewState;
  readonly owner_decision_state: GateDecisionV1OwnerDecisionState;
  readonly decided_at: CommonTimestampUtcV1UtcTimestamp;
  /**
   * Minimum items: 1.
   * Maximum items: 16.
   */
  readonly reason_codes: readonly GateDecisionV1ReasonCode[];
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly error_codes: readonly ErrorTaxonomyV1ErrorCode[];
  readonly redesign_adr_ref?: CommonStableIdV1StableId;
}
