/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/certification-input.v1.schema.json
 * Schema id: urn:japp:schema:platform:certification-input:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonContractTextV1NormalizedText } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1Architecture, PlatformVocabularyV1EvidenceArtifactKind, PlatformVocabularyV1OwnerDecisionState, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1SupportClaim } from "../platform/vocabulary.v1.ts";

/**
 * Platform certification input record
 *
 * The evidence inventory a future owner decision would consume before a platform support tier could be published. It is an input, never a decision: a certified proposal requires a certified target, a completed independent review, an evaluated revision, a complete evidence inventory, and a recorded owner decision. M01-W07 certifies no platform and changes no critical-gate state.
 */
export interface PlatformCertificationInputV1 {
  readonly certification_input_id: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly architecture: PlatformVocabularyV1Architecture;
  readonly support_claim: PlatformVocabularyV1SupportClaim;
  readonly capability_report_ref: CommonStableIdV1StableId;
  readonly browser_record_ref?: CommonStableIdV1StableId;
  readonly runtime_capability_ref?: CommonStableIdV1StableId;
  /**
   * Minimum items: 0.
   * Maximum items: 64.
   */
  readonly evidence_record_refs: readonly CommonStableIdV1StableId[];
  /**
   * Strictly sorted, unique kinds the reviewed policy requires for the proposed tier.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly required_evidence_kinds: readonly PlatformVocabularyV1EvidenceArtifactKind[];
  /**
   * Strictly sorted, unique kinds actually attached. A complete inventory requires every required kind to be present.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly present_evidence_kinds: readonly PlatformVocabularyV1EvidenceArtifactKind[];
  readonly inventory_complete: boolean;
  readonly owner_decision_state: PlatformVocabularyV1OwnerDecisionState;
  readonly owner_decision_ref?: CommonStableIdV1StableId;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly known_limitations?: readonly CommonContractTextV1NormalizedText[];
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly last_tested_on?: CommonCalendarDateV1CalendarDate;
  readonly prepared_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
