"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/ats/variant-identity.v1.schema.json
Schema id: urn:japp:schema:ats:variant-identity:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Literal

from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.contract_text_v1 import CommonContractTextV1Locale, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.form.field_address_v1 import FormFieldAddressV1AtsFamily

AtsVariantIdentityV1SessionMode = Literal["AUTHENTICATED", "GUEST", "UNKNOWN"]

class AtsVariantIdentityV1(ContractModel):
    "Evidence-bounded identity for an exact reviewed ATS pattern. It does not claim universal support."

    variant_identity_id: CommonStableIdV1StableId
    ats_family: FormFieldAddressV1AtsFamily
    adapter_id: CommonStableIdV1StableId
    adapter_version: CommonContractTextV1VersionText
    pattern_id: CommonStableIdV1StableId
    locale: CommonContractTextV1Locale
    session_mode: AtsVariantIdentityV1SessionMode
    route_page_family: CommonEnumTokenV1EnumToken
    evidence_digest: CommonProvenanceV1ContentDigest
    last_tested_on: CommonCalendarDateV1CalendarDate | None = None
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("last_tested_on",),
        )
