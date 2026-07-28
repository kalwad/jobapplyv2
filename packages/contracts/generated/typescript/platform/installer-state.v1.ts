/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/installer-state.v1.schema.json
 * Schema id: urn:japp:schema:platform:installer-state:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1InstallerState, PlatformVocabularyV1NativeHostCleanupState, PlatformVocabularyV1PackageFormat, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SignatureState, PlatformVocabularyV1UserDataPreservation } from "../platform/vocabulary.v1.ts";

/**
 * Installer state and result
 *
 * Bounded installer state for a packaged build: package identity, version, platform, architecture, format, artifact digest and signature state, channel, installed version, lifecycle state, interruption and recovery state, user-data preservation, native-host cleanup, and finite failure reasons. No installer command, script, registry modification, download URL, network request, signing key, or filesystem path is representable, and this contract installs nothing.
 */
export interface PlatformInstallerStateV1 {
  readonly installer_state_id: CommonStableIdV1StableId;
  readonly package_token: CommonContractTextV1BoundedToken;
  readonly package_version: PlatformVocabularyV1ProductVersion;
  readonly platform_id: PlatformVocabularyV1CertifiedPlatformId;
  readonly architecture: PlatformVocabularyV1Architecture;
  readonly package_format: PlatformVocabularyV1PackageFormat;
  readonly artifact: PlatformVocabularyV1ArtifactIdentity;
  readonly signature_state: PlatformVocabularyV1SignatureState;
  readonly channel: PlatformVocabularyV1DistributionChannel;
  readonly scope: PlatformVocabularyV1InstallationScope;
  readonly state: PlatformVocabularyV1InstallerState;
  readonly installed_version?: PlatformVocabularyV1ProductVersion;
  readonly interrupted: boolean;
  readonly recovery_completed?: boolean;
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
