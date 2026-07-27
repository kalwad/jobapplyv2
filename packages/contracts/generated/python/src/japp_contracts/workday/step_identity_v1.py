"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/workday/step-identity.v1.schema.json
Schema id: urn:japp:schema:workday:step-identity:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen

from japp_contracts._runtime import ContractModel
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp

WorkdayStepIdentityV1BoundaryClass = Literal["FINAL_REVIEW_BOUNDARY", "ORDINARY_APPLICATION", "PROTECTED_AUTHENTICATION", "PROTECTED_HUMAN_VERIFICATION", "PROTECTED_LEGAL_OR_CONSENT", "UNKNOWN_OR_UNSUPPORTED"]

WorkdayStepIdentityV1RecognitionSignalKind = Literal["BOUNDARY_INDICATOR", "CONTROL_FAMILY", "HEADING_DIGEST", "PAGE_SEQUENCE", "ROUTE_FAMILY", "VALIDATION_STATE"]

WorkdayStepIdentityV1StepFamily = Literal["ACCOUNT_CREATION", "AUTHENTICATED_APPLICATION", "CAPTCHA", "DUPLICATE_APPLICATION", "EMAIL_VERIFICATION", "EXPIRED_SESSION", "FINAL_REVIEW", "GUEST_APPLICATION", "LEGAL_CONSENT_BOUNDARY", "LOGIN", "MFA", "UNKNOWN_UNSUPPORTED"]

class WorkdayStepIdentityV1RecognitionSignal(ContractModel):
    "Multi-signal identity for an application step or protected boundary, first owned by the Workday-guided contract family. The boundary vocabulary is intentionally ATS-neutral when embedded in ApplicationSession; the Workday name does not claim a tenant certification. A single URL, heading, selector, or attribute is insufficient."

    kind: WorkdayStepIdentityV1RecognitionSignalKind
    signal_digest: CommonProvenanceV1ContentDigest
    confidence: CommonConfidenceV1Confidence

class WorkdayStepIdentityV1(ContractModel):
    "Multi-signal identity for an application step or protected boundary, first owned by the Workday-guided contract family. The boundary vocabulary is intentionally ATS-neutral when embedded in ApplicationSession; the Workday name does not claim a tenant certification. A single URL, heading, selector, or attribute is insufficient."

    step_identity_id: CommonStableIdV1StableId
    session_id: CommonStableIdV1StableId
    step_family: WorkdayStepIdentityV1StepFamily
    boundary_class: WorkdayStepIdentityV1BoundaryClass
    recognition_signals: Annotated[list[WorkdayStepIdentityV1RecognitionSignal], MinLen(2), MaxLen(12)]
    recognition_confidence: CommonConfidenceV1Confidence
    observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger
    recognized_at: CommonTimestampUtcV1UtcTimestamp
    evidence_digest: CommonProvenanceV1ContentDigest
