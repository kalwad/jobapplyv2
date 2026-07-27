"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/form/field-descriptor.v1.schema.json
Schema id: urn:japp:schema:form:field-descriptor:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.form.field_address_v1 import FormFieldAddressV1

FormFieldDescriptorV1ControlKind = Literal["CHECKBOX", "COMBOBOX", "DATE", "FILE", "MULTI_SELECT", "RADIO_GROUP", "SELECT", "TEXT", "TEXTAREA", "UNKNOWN"]

class FormFieldDescriptorV1ObservedValue(ContractModel):
    "Only a bounded semantic token and/or digest is exchanged; credentials and raw sensitive values are not representable."

    semantic_token: CommonContractTextV1BoundedToken | None = None
    value_digest: CommonProvenanceV1ContentDigest
    presence: Literal["ABSENT", "EMPTY", "PRESENT_REDACTED"]

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("semantic_token",),
        )

class FormFieldDescriptorV1UntrustedTextRepresentation(ContractModel):
    "Bounded observed-field description. Page-derived text is explicitly untrusted data and never executable authority or a system message."

    normalized_text: CommonContractTextV1NormalizedText | None = None
    text_digest: CommonProvenanceV1ContentDigest
    untrusted: bool

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("normalized_text",),
        )

class FormFieldDescriptorV1ValidationState(ContractModel):
    "Bounded observed-field description. Page-derived text is explicitly untrusted data and never executable authority or a system message."

    state: Literal["ACCEPTED", "REJECTED", "UNKNOWN", "NOT_APPLICABLE"]
    message_digests: Annotated[list[CommonProvenanceV1ContentDigest], MinLen(0), MaxLen(8)]

class FormFieldDescriptorV1OptionSemantic(ContractModel):
    "Bounded observed-field description. Page-derived text is explicitly untrusted data and never executable authority or a system message."

    stable_value_token: CommonContractTextV1BoundedToken | None = None
    value_digest: CommonProvenanceV1ContentDigest
    label: FormFieldDescriptorV1UntrustedTextRepresentation
    disabled: bool

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("stable_value_token",),
        )

class FormFieldDescriptorV1(ContractModel):
    "Bounded observed-field description. Page-derived text is explicitly untrusted data and never executable authority or a system message."

    field_id: CommonStableIdV1StableId
    address: FormFieldAddressV1
    control_kind: FormFieldDescriptorV1ControlKind
    visible: bool
    enabled: bool
    required: bool
    sensitive_candidate: bool
    label: FormFieldDescriptorV1UntrustedTextRepresentation
    description: FormFieldDescriptorV1UntrustedTextRepresentation | None = None
    section_context: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(0), MaxLen(16)]
    options: Annotated[list[FormFieldDescriptorV1OptionSemantic], MinLen(0), MaxLen(256)]
    current_value: FormFieldDescriptorV1ObservedValue | None = None
    validation_state: FormFieldDescriptorV1ValidationState
    observed_at: CommonTimestampUtcV1UtcTimestamp
    observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("description", "current_value",),
        )
