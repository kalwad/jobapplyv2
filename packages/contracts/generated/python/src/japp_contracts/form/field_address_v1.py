"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/form/field-address.v1.schema.json
Schema id: urn:japp:schema:form:field-address:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

FormFieldAddressV1AtsFamily = Literal["ASHBY", "GREENHOUSE", "ICIMS", "LEVER", "OTHER_REVIEWED", "SMARTRECRUITERS", "SUCCESSFACTORS", "TALEO", "UNKNOWN", "WORKDAY"]

class FormFieldAddressV1RepeaterPathEntry(ContractModel):
    "Durable semantic and structural identity for one observed field. Resolution hints are inert hints and never authority."

    semantic_concept: CommonEnumTokenV1EnumToken
    stable_item_key: CommonStableIdV1StableId

FormFieldAddressV1ResolutionHintKind = Literal["ACCESSIBLE_NAME_DIGEST", "ATTRIBUTE_DIGEST", "CONTROL_KIND", "OPTION_DIGEST", "ROLE_TOKEN", "SECTION_TOKEN"]

FormFieldAddressV1StabilityClass = Literal["SESSION_STABLE", "PAGE_STABLE", "OBSERVATION_ONLY"]

class FormFieldAddressV1ResolutionHint(ContractModel):
    "A non-executable hint. CSS selectors, XPath, JavaScript, HTML, and caller-supplied expressions are not representable."

    kind: FormFieldAddressV1ResolutionHintKind
    value_fingerprint: CommonProvenanceV1ContentDigest
    stability_class: FormFieldAddressV1StabilityClass

class FormFieldAddressV1(ContractModel):
    "Durable semantic and structural identity for one observed field. Resolution hints are inert hints and never authority."

    address_schema_version: Literal["FIELD_ADDRESS_V1"]
    session_id: CommonStableIdV1StableId
    frame_id: CommonStableIdV1StableId
    document_id: CommonStableIdV1StableId
    ats_family: FormFieldAddressV1AtsFamily
    tenant_pattern_id: CommonStableIdV1StableId | None = None
    route_signature: CommonProvenanceV1ContentDigest | None = None
    application_root_fingerprint: CommonProvenanceV1ContentDigest | None = None
    section_path: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(0), MaxLen(16)]
    repeater_path: Annotated[list[FormFieldAddressV1RepeaterPathEntry], MinLen(0), MaxLen(16)]
    accessible_name_fingerprint: CommonProvenanceV1ContentDigest | None = None
    attribute_fingerprint: CommonProvenanceV1ContentDigest | None = None
    option_fingerprint: CommonProvenanceV1ContentDigest | None = None
    resolution_hints: Annotated[list[FormFieldAddressV1ResolutionHint], MinLen(0), MaxLen(12)]
    observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("tenant_pattern_id", "route_signature", "application_root_fingerprint", "accessible_name_fingerprint", "attribute_fingerprint", "option_fingerprint",),
        )
