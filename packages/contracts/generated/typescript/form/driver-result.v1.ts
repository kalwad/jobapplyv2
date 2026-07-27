/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/form/driver-result.v1.schema.json
 * Schema id: urn:japp:schema:form:driver-result:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { FormFieldAddressV1 } from "../form/field-address.v1.ts";

/**
 * Bounded action-attempt metadata
 */
export interface FormDriverResultV1ActionAttempt {
  readonly attempt_id: CommonStableIdV1StableId;
  readonly attempted_at: CommonTimestampUtcV1UtcTimestamp;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 16.
   */
  readonly action_count: number;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 600000.
   */
  readonly duration_ms: number;
  readonly idempotency_key: CommonStableIdV1StableId;
}

/**
 * Driver result outcome
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormDriverResultV1DriverOutcome = "BLOCKED_SENSITIVE" | "FAILED" | "NEEDS_REVIEW" | "UNSUPPORTED" | "VERIFIED";

/**
 * Driver preconditions
 */
export interface FormDriverResultV1PreconditionsResult {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly generation_matched: boolean;
  readonly policy_permitted: boolean;
}

/**
 * Reviewed driver-result reason
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormDriverResultV1ReasonCode = "ACTION_FAILED" | "AMBIGUOUS_RESOLUTION" | "CONDITIONAL_FIELDS_DISCOVERED" | "PAGE_GENERATION_CHANGED" | "PERSISTENCE_NOT_VERIFIED" | "PRECONDITIONS_FAILED" | "RESOLUTION_MISSING" | "RESOLUTION_STALE" | "SENSITIVE_ACTION_BLOCKED" | "SITE_ACCEPTANCE_UNKNOWN" | "SITE_REJECTED" | "UNSUPPORTED_CONTROL" | "VALUE_MISMATCH" | "VERIFIED_PERSISTENCE";

/**
 * Optional bounded recovery result
 */
export interface FormDriverResultV1RecoveryResult {
  readonly attempted: boolean;
  readonly restored: boolean;
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
}

/**
 * Field resolution result
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormDriverResultV1ResolutionResult = "UNIQUE" | "AMBIGUOUS" | "MISSING" | "STALE";

/**
 * Observed site acceptance
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormDriverResultV1SiteAcceptance = "ACCEPTED" | "REJECTED" | "UNKNOWN";

/**
 * Synthetic-safe semantic value evidence
 */
export interface FormDriverResultV1ValueEvidence {
  readonly semantic_digest: CommonProvenanceV1ContentDigest;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly presence: "ABSENT" | "EMPTY" | "PRESENT_REDACTED";
}

/**
 * Driver verified-fill result
 *
 * Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable.
 */
export interface FormDriverResultV1 {
  readonly result_id: CommonStableIdV1StableId;
  readonly driver_id: CommonStableIdV1StableId;
  readonly session_id: CommonStableIdV1StableId;
  readonly field_address: FormFieldAddressV1;
  readonly resolution_result: FormDriverResultV1ResolutionResult;
  readonly preconditions: FormDriverResultV1PreconditionsResult;
  readonly action_attempt: FormDriverResultV1ActionAttempt;
  readonly intended_value: FormDriverResultV1ValueEvidence;
  readonly observed_value_immediate: FormDriverResultV1ValueEvidence;
  readonly observed_value_settled: FormDriverResultV1ValueEvidence;
  readonly site_acceptance: FormDriverResultV1SiteAcceptance;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly validation_message_digests: readonly CommonProvenanceV1ContentDigest[];
  /**
   * Minimum items: 0.
   * Maximum items: 64.
   */
  readonly conditional_field_ids: readonly CommonStableIdV1StableId[];
  readonly starting_dom_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly settled_dom_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly persistence_verified: boolean;
  readonly safe_retry_allowed: boolean;
  readonly outcome: FormDriverResultV1DriverOutcome;
  /**
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly FormDriverResultV1ReasonCode[];
  readonly recovery?: FormDriverResultV1RecoveryResult;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
}
