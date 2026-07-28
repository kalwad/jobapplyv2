/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/update-state.v1.schema.json
 * Schema id: urn:japp:schema:platform:update-state:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1NativeHostCleanupState, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SignatureState, PlatformVocabularyV1UpdateState, PlatformVocabularyV1UserDataPreservation } from "../platform/vocabulary.v1.ts";

/**
 * Updater state and result
 *
 * Bounded update, rollback, and recovery state: channel, current and available versions, the target artifact digest and signature state, the lifecycle state, interruption and recovery, user-data preservation, native-host cleanup, and finite failure reasons. No download URL, network request, update script, registry modification, or signing key is representable, and this contract updates nothing.
 */
export interface PlatformUpdateStateV1 {
  readonly update_state_id: CommonStableIdV1StableId;
  readonly package_token: CommonContractTextV1BoundedToken;
  readonly platform_id: PlatformVocabularyV1CertifiedPlatformId;
  readonly architecture: PlatformVocabularyV1Architecture;
  readonly channel: PlatformVocabularyV1DistributionChannel;
  readonly current_version: PlatformVocabularyV1ProductVersion;
  readonly available_version?: PlatformVocabularyV1ProductVersion;
  readonly installed_version?: PlatformVocabularyV1ProductVersion;
  readonly rolled_back_to_version?: PlatformVocabularyV1ProductVersion;
  readonly target_artifact?: PlatformVocabularyV1ArtifactIdentity;
  readonly signature_state: PlatformVocabularyV1SignatureState;
  readonly state: PlatformVocabularyV1UpdateState;
  readonly interrupted: boolean;
  readonly recovery_completed?: boolean;
  readonly rollback_available: boolean;
  readonly user_data_preservation: PlatformVocabularyV1UserDataPreservation;
  readonly native_host_cleanup: PlatformVocabularyV1NativeHostCleanupState;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly evidence_refs?: readonly CommonStableIdV1StableId[];
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
