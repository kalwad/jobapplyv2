/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/path-resolution.v1.schema.json
 * Schema id: urn:japp:schema:platform:path-resolution:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1PathResolutionState, PlatformVocabularyV1PathRole, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1RedactedPathReference } from "../platform/vocabulary.v1.ts";

/**
 * Trusted platform path resolution result
 *
 * A trusted adapter result. It is deliberately a different contract from a request: it may report a location only as a sanitized role-anchored reference plus a digest, so an ordinary diagnostic, telemetry record, holdout, or evidence bundle never exposes a private local path.
 */
export interface PlatformPathResolutionV1 {
  readonly path_resolution_id: CommonStableIdV1StableId;
  readonly request_ref: CommonStableIdV1StableId;
  readonly role: PlatformVocabularyV1PathRole;
  readonly scope: PlatformVocabularyV1InstallationScope;
  readonly resolution_state: PlatformVocabularyV1PathResolutionState;
  /**
   * Role-anchored sanitized reference. Present only for a resolved location.
   */
  readonly sanitized_path?: PlatformVocabularyV1RedactedPathReference;
  /**
   * Digest of the exact resolved location, so two records can be correlated without revealing either location.
   */
  readonly path_digest?: CommonProvenanceV1ContentDigest;
  readonly exists: boolean;
  readonly writable: boolean;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly resolved_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
