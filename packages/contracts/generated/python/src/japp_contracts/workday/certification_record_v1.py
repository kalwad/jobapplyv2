"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/workday/certification-record.v1.schema.json
Schema id: urn:japp:schema:workday:certification-record:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen

from japp_contracts._runtime import ContractModel
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1Locale, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText, CommonContractTextV1PositiveSafeInteger, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.workday.tenant_fingerprint_v1 import WorkdayTenantFingerprintV1, WorkdayTenantFingerprintV1CandidateSessionMode

class WorkdayCertificationRecordV1CertificationMetrics(ContractModel):
    "Future evidence record for one exact measured Workday pattern tuple. This schema creates no current certification."

    case_count: CommonContractTextV1PositiveSafeInteger
    fill_accuracy: CommonConfidenceV1Confidence
    verified_fill_rate: CommonConfidenceV1Confidence
    navigation_success_rate: CommonConfidenceV1Confidence
    progression_success_rate: CommonConfidenceV1Confidence
    manual_correction_count: CommonContractTextV1NonNegativeSafeInteger
    failure_count: CommonContractTextV1NonNegativeSafeInteger
    intervention_count: CommonContractTextV1NonNegativeSafeInteger

WorkdayCertificationRecordV1CertificationState = Literal["CERTIFIED", "DRAFT_EVIDENCE", "EXPIRED", "MEASURED_CANDIDATE", "REJECTED", "REVOKED"]

class WorkdayCertificationRecordV1PlatformProfile(ContractModel):
    "Future evidence record for one exact measured Workday pattern tuple. This schema creates no current certification."

    operating_system: Literal["MACOS", "UBUNTU", "WINDOWS"]
    architecture: Literal["ARM64", "X86_64"]

class WorkdayCertificationRecordV1(ContractModel):
    "Future evidence record for one exact measured Workday pattern tuple. This schema creates no current certification."

    certification_record_id: CommonStableIdV1StableId
    tenant_fingerprint: WorkdayTenantFingerprintV1
    locale: CommonContractTextV1Locale
    session_mode: WorkdayTenantFingerprintV1CandidateSessionMode
    route_page_sequence: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(1), MaxLen(32)]
    control_families: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(1), MaxLen(64)]
    adapter_version: CommonContractTextV1VersionText
    browser_version: CommonContractTextV1BoundedToken
    platform_profile: WorkdayCertificationRecordV1PlatformProfile
    corpus_manifest_digest: CommonProvenanceV1ContentDigest
    holdout_manifest_digest: CommonProvenanceV1ContentDigest
    metrics: WorkdayCertificationRecordV1CertificationMetrics
    last_tested_on: CommonCalendarDateV1CalendarDate
    known_limitations: Annotated[list[CommonContractTextV1NormalizedText], MinLen(0), MaxLen(32)]
    evidence_report_refs: Annotated[list[CommonStableIdV1StableId], MinLen(1), MaxLen(32)]
    measured_scope_digest: CommonProvenanceV1ContentDigest
    certified_scope_digest: CommonProvenanceV1ContentDigest
    certification_state: WorkdayCertificationRecordV1CertificationState
    provenance: CommonProvenanceV1Provenance
