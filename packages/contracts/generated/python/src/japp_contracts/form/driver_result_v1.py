"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/form/driver-result.v1.schema.json
Schema id: urn:japp:schema:form:driver-result:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.form.field_address_v1 import FormFieldAddressV1

class FormDriverResultV1ActionAttempt(ContractModel):
    "Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable."

    attempt_id: CommonStableIdV1StableId
    attempted_at: CommonTimestampUtcV1UtcTimestamp
    action_count: Annotated[int, Ge(1), Le(16)]
    duration_ms: Annotated[int, Ge(0), Le(600000)]
    idempotency_key: CommonStableIdV1StableId

FormDriverResultV1DriverOutcome = Literal["BLOCKED_SENSITIVE", "FAILED", "NEEDS_REVIEW", "UNSUPPORTED", "VERIFIED"]

class FormDriverResultV1PreconditionsResult(ContractModel):
    "Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable."

    visible: bool
    enabled: bool
    generation_matched: bool
    policy_permitted: bool

FormDriverResultV1ReasonCode = Literal["ACTION_FAILED", "AMBIGUOUS_RESOLUTION", "CONDITIONAL_FIELDS_DISCOVERED", "PAGE_GENERATION_CHANGED", "PERSISTENCE_NOT_VERIFIED", "PRECONDITIONS_FAILED", "RESOLUTION_MISSING", "RESOLUTION_STALE", "SENSITIVE_ACTION_BLOCKED", "SITE_ACCEPTANCE_UNKNOWN", "SITE_REJECTED", "UNSUPPORTED_CONTROL", "VALUE_MISMATCH", "VERIFIED_PERSISTENCE"]

class FormDriverResultV1RecoveryResult(ContractModel):
    "Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable."

    attempted: bool
    restored: bool
    evidence_digest: CommonProvenanceV1ContentDigest

FormDriverResultV1ResolutionResult = Literal["UNIQUE", "AMBIGUOUS", "MISSING", "STALE"]

FormDriverResultV1SiteAcceptance = Literal["ACCEPTED", "REJECTED", "UNKNOWN"]

class FormDriverResultV1ValueEvidence(ContractModel):
    "Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable."

    semantic_digest: CommonProvenanceV1ContentDigest
    presence: Literal["ABSENT", "EMPTY", "PRESENT_REDACTED"]

class FormDriverResultV1(ContractModel):
    "Bounded transaction evidence for a future controlled field driver. No selector, script, DOM command, or execution payload is representable."

    result_id: CommonStableIdV1StableId
    driver_id: CommonStableIdV1StableId
    session_id: CommonStableIdV1StableId
    field_address: FormFieldAddressV1
    resolution_result: FormDriverResultV1ResolutionResult
    preconditions: FormDriverResultV1PreconditionsResult
    action_attempt: FormDriverResultV1ActionAttempt
    intended_value: FormDriverResultV1ValueEvidence
    observed_value_immediate: FormDriverResultV1ValueEvidence
    observed_value_settled: FormDriverResultV1ValueEvidence
    site_acceptance: FormDriverResultV1SiteAcceptance
    validation_message_digests: Annotated[list[CommonProvenanceV1ContentDigest], MinLen(0), MaxLen(8)]
    conditional_field_ids: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(64)]
    starting_dom_generation: CommonContractTextV1NonNegativeSafeInteger
    settled_dom_generation: CommonContractTextV1NonNegativeSafeInteger
    persistence_verified: bool
    safe_retry_allowed: bool
    outcome: FormDriverResultV1DriverOutcome
    reason_codes: Annotated[list[FormDriverResultV1ReasonCode], MinLen(1), MaxLen(8)]
    recovery: FormDriverResultV1RecoveryResult | None = None
    correlation_id: CommonCorrelationV1CorrelationId
    causation_id: CommonCorrelationV1CausationId | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("recovery", "causation_id",),
        )
