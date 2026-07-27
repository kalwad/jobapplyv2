/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/resume/atomic-claim.v1.schema.json
 * Schema id: urn:japp:schema:resume:atomic-claim:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NormalizedText } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

/**
 * Atomic claim type
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type ResumeAtomicClaimV1ClaimType = "ACHIEVEMENT" | "EXPERIENCE" | "QUALIFICATION" | "RESPONSIBILITY" | "SKILL";

/**
 * Required user action
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type ResumeAtomicClaimV1UserAction = "EDIT_AND_APPROVE" | "NONE" | "PROVIDE_EVIDENCE" | "REJECT_CLAIM";

/**
 * Atomic claim verification status
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type ResumeAtomicClaimV1VerificationStatus = "CONTRADICTED" | "NEEDS_USER_INPUT" | "PARTIALLY_SUPPORTED" | "SUPPORTED" | "UNSUPPORTED";

/**
 * Atomic resume claim
 *
 * One bounded generated or shortened claim with explicit evidence and verification state. Model output cannot mutate canonical evidence.
 */
export interface ResumeAtomicClaimV1 {
  readonly claim_id: CommonStableIdV1StableId;
  readonly claim_type: ResumeAtomicClaimV1ClaimType;
  readonly claim_text: CommonContractTextV1NormalizedText;
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly evidence_refs: readonly CommonStableIdV1StableId[];
  readonly verification_status: ResumeAtomicClaimV1VerificationStatus;
  readonly prompt_version_ref: CommonStableIdV1StableId;
  readonly model_digest: CommonProvenanceV1ContentDigest;
  readonly model_profile_ref: CommonStableIdV1StableId;
  readonly verified_at: CommonTimestampUtcV1UtcTimestamp;
  readonly verification_result_digest: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly rejection_error_codes: readonly ErrorTaxonomyV1ErrorCode[];
  readonly release_eligible: boolean;
  readonly user_action: ResumeAtomicClaimV1UserAction;
  readonly canonical_evidence_mutation: boolean;
}
