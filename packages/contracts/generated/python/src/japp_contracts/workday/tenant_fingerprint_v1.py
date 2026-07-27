"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/workday/tenant-fingerprint.v1.schema.json
Schema id: urn:japp:schema:workday:tenant-fingerprint:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1Locale, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

WorkdayTenantFingerprintV1BrowserFamily = Literal["CHROMIUM", "EDGE_CHROMIUM", "UNKNOWN"]

WorkdayTenantFingerprintV1CandidateSessionMode = Literal["AUTHENTICATED", "GUEST", "UNKNOWN"]

WorkdayTenantFingerprintV1HostnameFamily = Literal["REVIEWED_ALIAS_FAMILY", "UNKNOWN", "WORKDAY_CANONICAL_FAMILY", "WORKDAY_TENANT_FAMILY"]

class WorkdayTenantFingerprintV1BrowserCompatibility(ContractModel):
    "Independent bounded signals identifying one exact Workday tenant-pattern family. Authentication material and universal-support claims are not representable."

    browser_family: WorkdayTenantFingerprintV1BrowserFamily
    minimum_version: CommonContractTextV1BoundedToken
    maximum_tested_version: CommonContractTextV1BoundedToken
    evidence_digest: CommonProvenanceV1ContentDigest

class WorkdayTenantFingerprintV1(ContractModel):
    "Independent bounded signals identifying one exact Workday tenant-pattern family. Authentication material and universal-support claims are not representable."

    tenant_fingerprint_id: CommonStableIdV1StableId
    hostname_family: WorkdayTenantFingerprintV1HostnameFamily
    locale: CommonContractTextV1Locale
    candidate_session_mode: WorkdayTenantFingerprintV1CandidateSessionMode
    route_family: CommonEnumTokenV1EnumToken
    page_sequence_family: CommonEnumTokenV1EnumToken
    control_family_inventory: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(1), MaxLen(64)]
    control_family_fingerprint: CommonProvenanceV1ContentDigest
    tenant_pattern_version: CommonContractTextV1VersionText
    adapter_version: CommonContractTextV1VersionText
    browser_compatibility: WorkdayTenantFingerprintV1BrowserCompatibility
    evidence_digest: CommonProvenanceV1ContentDigest
    last_tested_on: CommonCalendarDateV1CalendarDate | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("last_tested_on",),
        )
