/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/native-messaging-registration.v1.schema.json
 * Schema id: urn:japp:schema:platform:native-messaging-registration:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1ExtensionId, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1NativeHostName, PlatformVocabularyV1PathRole, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RegistrationOperation, PlatformVocabularyV1RequestContext, PlatformVocabularyV1StdioMode } from "../platform/vocabulary.v1.ts";

/**
 * Native-messaging registration intent
 *
 * A typed install, verify, repair, update, or remove intent that binds a certified platform, a certified browser and channel, an allowlisted extension identifier set, the host identity and version, an installation scope, and the expected manifest digest. Arbitrary registry keys or values, manifest JSON bodies, executable paths, shell commands, and unreviewed extension identifiers are structurally unrepresentable. No registry, manifest, browser, or filesystem modification occurs in M01-W07.
 */
export interface PlatformNativeMessagingRegistrationV1 {
  readonly registration_intent_id: CommonStableIdV1StableId;
  readonly request_context: PlatformVocabularyV1RequestContext;
  readonly operation: PlatformVocabularyV1RegistrationOperation;
  readonly platform_id: PlatformVocabularyV1CertifiedPlatformId;
  readonly browser_family: PlatformVocabularyV1BrowserFamily;
  readonly browser_channel: PlatformVocabularyV1BrowserChannel;
  readonly host_name: PlatformVocabularyV1NativeHostName;
  readonly host_version: PlatformVocabularyV1ProductVersion;
  /**
   * Reviewed extension-identifier allowlist. Registration cannot widen it and cannot express a wildcard.
   *
   * Minimum items: 1.
   * Maximum items: 4.
   */
  readonly allowed_extension_ids: readonly PlatformVocabularyV1ExtensionId[];
  readonly scope: PlatformVocabularyV1InstallationScope;
  /**
   * Typed location role for the platform-appropriate manifest or registry entry. It is never a literal path or registry key.
   */
  readonly manifest_location_role: PlatformVocabularyV1PathRole;
  readonly expected_manifest_digest?: CommonProvenanceV1ContentDigest;
  readonly expected_host_binary_digest?: CommonProvenanceV1ContentDigest;
  /**
   * Windows-safe transport requirement. Length-prefixed binary stdio is mandatory so newline translation cannot corrupt messages.
   */
  readonly binary_stdio_mode: PlatformVocabularyV1StdioMode;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 1048576.
   */
  readonly max_message_bytes?: number;
}
