/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/session/page-readiness-proof.v1.schema.json
 * Schema id: urn:japp:schema:session:page-readiness-proof:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { WorkdayStepIdentityV1 } from "../workday/step-identity.v1.ts";

/**
 * Readiness blocker counts
 */
export interface SessionPageReadinessProofV1BlockingCounts {
  readonly required_field_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly unresolved_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly changed_value_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly stale_document_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly sensitive_confirmation_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly mandatory_uncertain_count: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Bounded navigation-control identity
 */
export interface SessionPageReadinessProofV1NavigationControlIdentity {
  readonly control_id: CommonStableIdV1StableId;
  readonly identity_digest: CommonProvenanceV1ContentDigest;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly resolution: "AMBIGUOUS" | "MISSING" | "UNIQUE";
}

/**
 * Site validation status
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionPageReadinessProofV1SiteValidationStatus = "ACCEPTED" | "REJECTED" | "UNKNOWN";

/**
 * PageReadinessProof
 *
 * Hashable strict proof that a page is or is not ready for one bounded navigation decision. It is not a critical-gate decision.
 */
export interface SessionPageReadinessProofV1 {
  readonly proof_id: CommonStableIdV1StableId;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly proof_version: "PAGE_READINESS_PROOF_V1";
  readonly session_id: CommonStableIdV1StableId;
  readonly page_id: CommonStableIdV1StableId;
  readonly step_identity: WorkdayStepIdentityV1;
  readonly page_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly reconciliation_digest: CommonProvenanceV1ContentDigest;
  readonly blocking_counts: SessionPageReadinessProofV1BlockingCounts;
  readonly site_validation_status: SessionPageReadinessProofV1SiteValidationStatus;
  readonly next_control?: SessionPageReadinessProofV1NavigationControlIdentity;
  readonly back_control?: SessionPageReadinessProofV1NavigationControlIdentity;
  readonly created_at: CommonTimestampUtcV1UtcTimestamp;
  readonly proof_digest: CommonProvenanceV1ContentDigest;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly readiness: "NOT_READY" | "READY";
}
