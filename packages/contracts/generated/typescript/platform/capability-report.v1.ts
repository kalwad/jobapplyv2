/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/capability-report.v1.schema.json
 * Schema id: urn:japp:schema:platform:capability-report:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1CapabilityState, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1PlatformId, PlatformVocabularyV1SupportClaim } from "../platform/vocabulary.v1.ts";

/**
 * Platform capability report
 *
 * The typed PlatformCapabilities record of specification §5.14.2. It reports one explicit state for every specification-owned platform capability family and never treats an unevaluated capability as success. A missing local-AI profile degrades AI features only; it cannot reduce deterministic core capability below the reviewed core tier.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformCapabilityReportV1 {
  readonly capability_report_id: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly support_claim: PlatformVocabularyV1SupportClaim;
  /**
   * Exactly one state per specification-owned capability family, with no duplicates.
   *
   * Minimum items: 8.
   * Maximum items: 8.
   */
  readonly capabilities: readonly PlatformVocabularyV1CapabilityState[];
  readonly packaging_channel: PlatformVocabularyV1DistributionChannel;
  /**
   * References to platform model-runtime profile records. An empty list is honest; it never downgrades the deterministic core tier.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly model_profile_refs: readonly CommonStableIdV1StableId[];
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly diagnostic_refs: readonly CommonStableIdV1StableId[];
  readonly reported_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly provenance: CommonProvenanceV1Provenance;
}
