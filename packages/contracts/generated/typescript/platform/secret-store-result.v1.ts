/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/secret-store-result.v1.schema.json
 * Schema id: urn:japp:schema:platform:secret-store-result:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1SecretKeyRole, PlatformVocabularyV1SecretOperation, PlatformVocabularyV1SecretReference, PlatformVocabularyV1SecretResultState } from "../platform/vocabulary.v1.ts";

/**
 * Platform secret-store result and availability state
 *
 * The result of one typed secret-store operation plus the store's explicit availability and permission state. Secret bytes, passphrases, recovered values, and derived key material can never appear here, in diagnostics, or in an evidence bundle; a retrieval reports only an opaque reference and a digest. There is no plaintext, file, or environment-variable fallback state. Version 1.1.0 aligns STATUS with the STORE_AVAILABLE vocabulary token and the complete availability/reason truth table.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformSecretStoreResultV1 {
  readonly secret_result_id: CommonStableIdV1StableId;
  readonly request_ref: CommonStableIdV1StableId;
  readonly operation: PlatformVocabularyV1SecretOperation;
  readonly key_role: PlatformVocabularyV1SecretKeyRole;
  /**
   * Explicit availability and permission state of the platform secure store itself.
   */
  readonly store_availability: PlatformVocabularyV1CapabilityAvailability;
  /**
   * Bounded identity of the native store family that answered, without naming a service, account, registry location, or bus address.
   */
  readonly store_identity_token?: CommonContractTextV1BoundedToken;
  readonly result_state: PlatformVocabularyV1SecretResultState;
  /**
   * Opaque handle returned for a successful retrieval or storage. It is not the secret.
   */
  readonly material_reference?: PlatformVocabularyV1SecretReference;
  readonly material_digest?: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly completed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
