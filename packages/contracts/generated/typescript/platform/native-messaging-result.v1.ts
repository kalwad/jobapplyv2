/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/native-messaging-result.v1.schema.json
 * Schema id: urn:japp:schema:platform:native-messaging-result:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1NativeHostName, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RegistrationOperation, PlatformVocabularyV1RegistrationState } from "../platform/vocabulary.v1.ts";

/**
 * Native-messaging registration result
 *
 * The idempotent outcome of one registration intent, including the observed registration state, whether the operation changed anything, the observed manifest identity digest, finite remediation reasons, and an evidence reference. It never contains a registry export, a manifest body, a filesystem path, or an executable name.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformNativeMessagingResultV1 {
  readonly registration_result_id: CommonStableIdV1StableId;
  readonly intent_ref: CommonStableIdV1StableId;
  readonly operation: PlatformVocabularyV1RegistrationOperation;
  readonly platform_id: PlatformVocabularyV1CertifiedPlatformId;
  readonly browser_family: PlatformVocabularyV1BrowserFamily;
  readonly host_name: PlatformVocabularyV1NativeHostName;
  /**
   * The registration state observed after the operation ran. It is not a claim that the operation succeeded: a removal refused by permission still observes PRESENT_VALID. Success is carried by an empty `reason_codes`.
   */
  readonly observed_state: PlatformVocabularyV1RegistrationState;
  readonly observed_manifest_digest?: CommonProvenanceV1ContentDigest;
  readonly observed_host_version?: PlatformVocabularyV1ProductVersion;
  /**
   * Whether this execution modified registration state. A verify operation can never report a change.
   */
  readonly changed: boolean;
  /**
   * Whether repeating the same intent is guaranteed to be a no-op.
   */
  readonly idempotent_repeat_safe: boolean;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly evidence_ref?: CommonStableIdV1StableId;
  readonly completed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
