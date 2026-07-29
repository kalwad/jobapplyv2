/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/diagnostic-report.v2.schema.json
 * Schema id: urn:japp:schema:platform:diagnostic-report:v2
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonRedactionV1RedactionAnnotation } from "../common/redaction.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1DiagnosticResult, PlatformVocabularyV1PlatformCapabilityId, PlatformVocabularyV1PlatformComponentId, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1Severity } from "../platform/vocabulary.v1.ts";

/**
 * Platform diagnostic report
 *
 * A bounded diagnostic for one platform component: finite reason codes, one bounded user-safe message, explicit redaction metadata, severity, the component and capability identity, correlation, and synthetic-safe evidence references. A success result may never carry a blocking reason, and the record cannot contain a raw log, environment dump, registry export, local path, or secret value.
 */
export interface PlatformDiagnosticReportV2 {
  readonly diagnostic_report_id: CommonStableIdV1StableId;
  readonly component: PlatformVocabularyV1PlatformComponentId;
  readonly capability: PlatformVocabularyV1PlatformCapabilityId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly severity: PlatformVocabularyV1Severity;
  readonly result: PlatformVocabularyV1DiagnosticResult;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  /**
   * Whether the reported condition blocks the affected capability. A successful diagnostic can never be blocking.
   */
  readonly blocking: boolean;
  readonly user_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  readonly redaction: CommonRedactionV1RedactionAnnotation;
  /**
   * Digest of a redacted out-of-band detail record. The detail itself never travels in this contract.
   */
  readonly detail_digest?: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly evidence_refs?: readonly CommonStableIdV1StableId[];
  readonly evaluated_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
  readonly provenance: CommonProvenanceV1Provenance;
}
