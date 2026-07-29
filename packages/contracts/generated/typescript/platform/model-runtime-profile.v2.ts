/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/model-runtime-profile.v2.schema.json
 * Schema id: urn:japp:schema:platform:model-runtime-profile:v2
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1AcceleratorClass, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1ContextTokens, PlatformVocabularyV1CoreCapabilityBehavior, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1ProfileAcceptanceState, PlatformVocabularyV1RuntimeFamily } from "../platform/vocabulary.v1.ts";

/**
 * Versioned v2 platform model-runtime profile
 *
 * Platform-scoped runtime and artifact metadata for a local model profile, including exact artifact digest, runtime family and version, accelerator and driver bounds, context, quantization, memory requirements, license and provenance, evidence references, and the deterministic-core fallback behavior. A profile may be ACCEPTED only on a certified target with artifact and runtime evidence; no Windows or Ubuntu profile is accepted today. This contract does not invoke, download, select, or control any model runtime, and it does not change the model lock.
 */
export interface PlatformModelRuntimeProfileV2 {
  readonly model_profile_id: CommonStableIdV1StableId;
  /**
   * Stable profile name such as the macos-arm64-mlx, windows-x64-nvidia, or ubuntu-x64-cpu families named by the specification.
   */
  readonly profile_token: CommonContractTextV1BoundedToken;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly runtime_family: PlatformVocabularyV1RuntimeFamily;
  readonly runtime_version: PlatformVocabularyV1ProductVersion;
  readonly accelerator: PlatformVocabularyV1AcceleratorClass;
  readonly minimum_driver_version?: PlatformVocabularyV1ProductVersion;
  readonly artifact: PlatformVocabularyV1ArtifactIdentity;
  readonly context_tokens: PlatformVocabularyV1ContextTokens;
  readonly quantization_token: CommonContractTextV1BoundedToken;
  readonly minimum_ram_mib: PlatformVocabularyV1MemoryMebibytes;
  readonly minimum_vram_mib?: PlatformVocabularyV1MemoryMebibytes;
  readonly license_token: CommonContractTextV1BoundedToken;
  readonly structured_output_evidence_ref?: CommonStableIdV1StableId;
  readonly factuality_evidence_ref?: CommonStableIdV1StableId;
  readonly latency_evidence_ref?: CommonStableIdV1StableId;
  readonly memory_evidence_ref?: CommonStableIdV1StableId;
  readonly core_capability_behavior: PlatformVocabularyV1CoreCapabilityBehavior;
  readonly availability: PlatformVocabularyV1CapabilityAvailability;
  readonly acceptance_state: PlatformVocabularyV1ProfileAcceptanceState;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly evidence_refs: readonly CommonStableIdV1StableId[];
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly last_tested_on?: CommonCalendarDateV1CalendarDate;
  readonly provenance: CommonProvenanceV1Provenance;
}
