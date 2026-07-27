"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/form/field-decision.v1.schema.json
Schema id: urn:japp:schema:form:field-decision:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.redaction_v1 import CommonRedactionV1SensitivityClass
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

FormFieldDecisionV1ConfirmationState = Literal["EXPIRED", "MISSING", "NOT_REQUIRED", "REVOKED", "VALID"]

FormFieldDecisionV1FinalDecision = Literal["BLOCK_UNSUPPORTED", "FILL", "PAUSE_FOR_CONFIRMATION", "PROPOSE", "SKIP_OPTIONAL"]

FormFieldDecisionV1PolicyDecision = Literal["DENY", "PERMIT", "REQUIRE_CONFIRMATION", "UNSUPPORTED"]

FormFieldDecisionV1ReasonCode = Literal["CONFIRMATION_EXPIRED", "CONFIRMATION_MISSING", "CONFIRMATION_REVOKED", "DETERMINISTIC_EVIDENCE", "LOW_CLASSIFICATION_CONFIDENCE", "LOW_VALUE_CONFIDENCE", "MODEL_PROPOSAL_ONLY", "OPTIONAL_UNANSWERED", "POLICY_DENIED", "REVIEWED_SOURCE", "SENSITIVE_CONFIRMATION_REQUIRED", "UNSUPPORTED_FIELD"]

FormFieldDecisionV1ValueSourceType = Literal["ANSWER_POLICY", "APPROVED_DOCUMENT", "DETERMINISTIC_DERIVATION", "MODEL_PROPOSAL", "NONE", "USER_CONFIRMATION", "USER_RECORD"]

class FormFieldDecisionV1(ContractModel):
    "Canonical reviewed decision for one field. It records policy evidence but does not implement a resolver or grant authority from model output."

    decision_id: CommonStableIdV1StableId
    field_id: CommonStableIdV1StableId
    field_address_digest: CommonProvenanceV1ContentDigest
    field_concept: CommonEnumTokenV1EnumToken
    classification_confidence: CommonConfidenceV1Confidence
    value_source_type: FormFieldDecisionV1ValueSourceType
    value_source_ref: CommonStableIdV1StableId | None = None
    value_confidence: CommonConfidenceV1Confidence
    sensitivity_class: CommonRedactionV1SensitivityClass
    policy_decision: FormFieldDecisionV1PolicyDecision
    final_decision: FormFieldDecisionV1FinalDecision
    confirmation_state: FormFieldDecisionV1ConfirmationState
    user_confirmation_ref: CommonStableIdV1StableId | None = None
    reason_codes: Annotated[list[FormFieldDecisionV1ReasonCode], MinLen(1), MaxLen(8)]
    provenance: CommonProvenanceV1Provenance
    correlation_id: CommonCorrelationV1CorrelationId
    causation_id: CommonCorrelationV1CausationId | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("value_source_ref", "user_confirmation_ref", "causation_id",),
        )
