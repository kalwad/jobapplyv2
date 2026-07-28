/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/target-identity.v1.schema.json
 * Schema id: urn:japp:schema:platform:target-identity:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1Architecture, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1BuildToken, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SupportClaim } from "../platform/vocabulary.v1.ts";

/**
 * Certified platform target identity and support claim
 *
 * Detected platform identity separated from any claimed or reviewed support tier. This record cannot certify a platform: certification requires a completed independent review, an evaluated revision, and evidence references, none of which exist for any target today.
 */
export interface PlatformTargetIdentityV1 {
  readonly target_identity_id: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly architecture: PlatformVocabularyV1Architecture;
  /**
   * Observed operating-system release version. It is an observation, not a support claim.
   */
  readonly os_version: PlatformVocabularyV1ProductVersion;
  readonly os_build?: PlatformVocabularyV1BuildToken;
  readonly detection_method: PlatformVocabularyV1EvaluationMethod;
  readonly detected_at: CommonTimestampUtcV1UtcTimestamp;
  readonly support_claim: PlatformVocabularyV1SupportClaim;
  /**
   * Finite reasons explaining why the reviewed tier is not certified. Empty only when the reviewed tier is certified.
   *
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly provenance: CommonProvenanceV1Provenance;
}
