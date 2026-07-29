/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/process-status.v1.schema.json
 * Schema id: urn:japp:schema:platform:process-status:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProcessExitCode, PlatformVocabularyV1ProcessProfileId, PlatformVocabularyV1ProcessState, PlatformVocabularyV1TerminationRequest } from "../platform/vocabulary.v1.ts";

/**
 * Platform process handle, lifecycle state, and result
 *
 * A stable supervisor handle plus the observed lifecycle state and exit result for one planned process. Handles are opaque: no operating-system process identifier, thread identifier, executable path, command line, or captured output stream is representable. Termination is a typed intent, never a raw signal value.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformProcessStatusV1 {
  readonly process_status_id: CommonStableIdV1StableId;
  /**
   * Opaque supervisor handle. It is not an operating-system process identifier.
   */
  readonly process_handle: CommonStableIdV1StableId;
  readonly plan_ref: CommonStableIdV1StableId;
  readonly profile: PlatformVocabularyV1ProcessProfileId;
  readonly state: PlatformVocabularyV1ProcessState;
  readonly termination_requested: PlatformVocabularyV1TerminationRequest;
  readonly started_at?: CommonTimestampUtcV1UtcTimestamp;
  readonly ended_at?: CommonTimestampUtcV1UtcTimestamp;
  /**
   * Observed exit status of a child that ended on its own. A non-zero status is always accompanied by at least one finite reason.
   */
  readonly exit_code?: PlatformVocabularyV1ProcessExitCode;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 8.
   */
  readonly restart_count: number;
  /**
   * Historical: this child was observed to have outlived its supervising parent. It stays true on the terminal record of an orphan that was cleaned up or finally seen to exit.
   */
  readonly orphan_detected: boolean;
  readonly idempotency_key?: CommonContractTextV1BoundedToken;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly remediation_message?: PlatformVocabularyV1BoundedUserMessage;
  /**
   * Digest of a redacted out-of-band diagnostic record. Raw child output never travels in this contract.
   */
  readonly diagnostic_digest?: CommonProvenanceV1ContentDigest;
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id?: CommonCorrelationV1CorrelationId;
  readonly provenance: CommonProvenanceV1Provenance;
}
