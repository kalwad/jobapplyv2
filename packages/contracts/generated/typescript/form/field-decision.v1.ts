/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/form/field-decision.v1.schema.json
 * Schema id: urn:japp:schema:form:field-decision:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonRedactionV1SensitivityClass } from "../common/redaction.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * User-confirmation state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDecisionV1ConfirmationState = "EXPIRED" | "MISSING" | "NOT_REQUIRED" | "REVOKED" | "VALID";

/**
 * Final field decision
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDecisionV1FinalDecision = "BLOCK_UNSUPPORTED" | "FILL" | "PAUSE_FOR_CONFIRMATION" | "PROPOSE" | "SKIP_OPTIONAL";

/**
 * Policy decision
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDecisionV1PolicyDecision = "DENY" | "PERMIT" | "REQUIRE_CONFIRMATION" | "UNSUPPORTED";

/**
 * Stable field-decision reason
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDecisionV1ReasonCode = "CONFIRMATION_EXPIRED" | "CONFIRMATION_MISSING" | "CONFIRMATION_REVOKED" | "DETERMINISTIC_EVIDENCE" | "LOW_CLASSIFICATION_CONFIDENCE" | "LOW_VALUE_CONFIDENCE" | "MODEL_PROPOSAL_ONLY" | "OPTIONAL_UNANSWERED" | "POLICY_DENIED" | "REVIEWED_SOURCE" | "SENSITIVE_CONFIRMATION_REQUIRED" | "UNSUPPORTED_FIELD";

/**
 * Value source type
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDecisionV1ValueSourceType = "ANSWER_POLICY" | "APPROVED_DOCUMENT" | "DETERMINISTIC_DERIVATION" | "MODEL_PROPOSAL" | "NONE" | "USER_CONFIRMATION" | "USER_RECORD";

/**
 * FieldDecision
 *
 * Canonical reviewed decision for one field. It records policy evidence but does not implement a resolver or grant authority from model output.
 */
export interface FormFieldDecisionV1 {
  readonly decision_id: CommonStableIdV1StableId;
  readonly field_id: CommonStableIdV1StableId;
  readonly field_address_digest: CommonProvenanceV1ContentDigest;
  readonly field_concept: CommonEnumTokenV1EnumToken;
  readonly classification_confidence: CommonConfidenceV1Confidence;
  readonly value_source_type: FormFieldDecisionV1ValueSourceType;
  readonly value_source_ref?: CommonStableIdV1StableId;
  readonly value_confidence: CommonConfidenceV1Confidence;
  readonly sensitivity_class: CommonRedactionV1SensitivityClass;
  readonly policy_decision: FormFieldDecisionV1PolicyDecision;
  readonly final_decision: FormFieldDecisionV1FinalDecision;
  readonly confirmation_state: FormFieldDecisionV1ConfirmationState;
  readonly user_confirmation_ref?: CommonStableIdV1StableId;
  /**
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly FormFieldDecisionV1ReasonCode[];
  readonly provenance: CommonProvenanceV1Provenance;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
}
