/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/secret-store-request.v1.schema.json
 * Schema id: urn:japp:schema:platform:secret-store-request:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonRedactionV1RedactionAnnotation } from "../common/redaction.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1InstallationScope, PlatformVocabularyV1RequestContext, PlatformVocabularyV1SecretKeyRole, PlatformVocabularyV1SecretOperation, PlatformVocabularyV1SecretReference } from "../platform/vocabulary.v1.ts";

/**
 * Platform secret-store request
 *
 * A typed secret-store operation over a closed set of reviewed secret roles. No plaintext secret, passphrase, token, key material, keychain service or account, Windows registry location, D-Bus request, file path, or environment-variable fallback is representable. External-provider credentials are deliberately absent and remain future work; nothing here reads or writes an unrelated credential file.
 */
export interface PlatformSecretStoreRequestV1 {
  readonly secret_request_id: CommonStableIdV1StableId;
  readonly request_context: PlatformVocabularyV1RequestContext;
  readonly operation: PlatformVocabularyV1SecretOperation;
  readonly key_role: PlatformVocabularyV1SecretKeyRole;
  readonly scope: PlatformVocabularyV1InstallationScope;
  /**
   * Opaque handle to secret material already held by the trusted local service. A PUT names material by reference; the bytes never cross this contract.
   */
  readonly material_reference?: PlatformVocabularyV1SecretReference;
  /**
   * Digest of the referenced material, used only to prove that a later read returned the same secret.
   */
  readonly material_digest?: CommonProvenanceV1ContentDigest;
  readonly redaction?: CommonRedactionV1RedactionAnnotation;
}
