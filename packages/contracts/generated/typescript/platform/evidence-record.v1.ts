/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/evidence-record.v1.schema.json
 * Schema id: urn:japp:schema:platform:evidence-record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BuildToken, PlatformVocabularyV1DiagnosticResult, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1EvidenceArtifactKind, PlatformVocabularyV1MachineClass, PlatformVocabularyV1OwnerDecisionState, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1ReviewState, PlatformVocabularyV1SignatureState } from "../platform/vocabulary.v1.ts";

/**
 * Cross-platform evidence record
 *
 * One future per-platform evidence element for the Cross-Platform Core Gate bundle: operating-system build and architecture, machine class, package identity and signature state, browser and WebView versions, native-host registration, secret-store test, model profile, document matrix, backup/restore, update/rollback, and synthetic-safe log, screenshot, or trace references. Every artifact is a digest reference; raw secrets, unrestricted logs, raw local paths, complete environment dumps, registry exports, and machine-specific identity are structurally unrepresentable. M01-W07 creates no certification bundle and evaluates no gate.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformEvidenceRecordV1 {
  readonly evidence_record_id: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly architecture: PlatformVocabularyV1Architecture;
  readonly os_version?: PlatformVocabularyV1ProductVersion;
  readonly os_build?: PlatformVocabularyV1BuildToken;
  /**
   * Coarse machine class only. Hostnames, serial numbers, user names, and network identity are never represented.
   */
  readonly machine_class: PlatformVocabularyV1MachineClass;
  /**
   * Coarse hosted-runner image label. It identifies a hosted CI runner and nothing else, and a measured native run on a hosted runner must name it.
   */
  readonly runner_image_token?: CommonContractTextV1BoundedToken;
  readonly artifact_kind: PlatformVocabularyV1EvidenceArtifactKind;
  /**
   * How the artifact was produced. Independent of `machine_class`, which records where: any machine class may execute synthetic fixtures or static inspection, and only a non-synthetic machine may execute a measured native run.
   */
  readonly evaluation_method: PlatformVocabularyV1EvaluationMethod;
  /**
   * Always true: every committed platform evidence artifact contains synthetic data only.
   */
  readonly synthetic_only: boolean;
  readonly artifact_digest: CommonProvenanceV1ContentDigest;
  readonly package_artifact?: PlatformVocabularyV1ArtifactIdentity;
  readonly signature_state?: PlatformVocabularyV1SignatureState;
  readonly browser_version?: PlatformVocabularyV1ProductVersion;
  readonly webview_version?: PlatformVocabularyV1ProductVersion;
  readonly native_messaging_result_ref?: CommonStableIdV1StableId;
  readonly secret_store_result_ref?: CommonStableIdV1StableId;
  readonly model_profile_ref?: CommonStableIdV1StableId;
  readonly installer_state_ref?: CommonStableIdV1StableId;
  readonly update_state_ref?: CommonStableIdV1StableId;
  readonly result: PlatformVocabularyV1DiagnosticResult;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly reviewer_identity_ref?: CommonStableIdV1StableId;
  readonly review_state?: PlatformVocabularyV1ReviewState;
  readonly owner_decision_state?: PlatformVocabularyV1OwnerDecisionState;
  readonly recorded_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
