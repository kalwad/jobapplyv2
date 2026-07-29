/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/runtime-capability.v1.schema.json
 * Schema id: urn:japp:schema:platform:runtime-capability:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1AcceleratorClass, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1CoreCapabilityBehavior, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RuntimeFamily } from "../platform/vocabulary.v1.ts";

/**
 * Detected model-runtime capability
 *
 * The RuntimeCapability record of specification §5.14.2: what the local runtime reports on this target, which profiles are available, and how the deterministic core behaves when full AI is unavailable. Deterministic autofill, profile, matching, tracking, and document workflows must never depend on this record reporting availability.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformRuntimeCapabilityV1 {
  readonly runtime_capability_id: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly runtime_family?: PlatformVocabularyV1RuntimeFamily;
  readonly runtime_version?: PlatformVocabularyV1ProductVersion;
  readonly accelerator?: PlatformVocabularyV1AcceleratorClass;
  readonly runtime_availability: PlatformVocabularyV1CapabilityAvailability;
  readonly detection_method: PlatformVocabularyV1EvaluationMethod;
  readonly detected_ram_mib?: PlatformVocabularyV1MemoryMebibytes;
  readonly detected_vram_mib?: PlatformVocabularyV1MemoryMebibytes;
  /**
   * Profiles this runtime can offer. Only the two non-blocking availability states, AVAILABLE and DEGRADED_LIMITED, may enumerate any.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly available_profile_refs: readonly CommonStableIdV1StableId[];
  /**
   * Subset of available profiles whose acceptance is already recorded. Empty is the honest current state on every target.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly accepted_profile_refs: readonly CommonStableIdV1StableId[];
  readonly core_capability_behavior: PlatformVocabularyV1CoreCapabilityBehavior;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
