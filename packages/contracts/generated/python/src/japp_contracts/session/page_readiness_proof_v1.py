"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/session/page-readiness-proof.v1.schema.json
Schema id: urn:japp:schema:session:page-readiness-proof:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Literal

from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.workday.step_identity_v1 import WorkdayStepIdentityV1

class SessionPageReadinessProofV1BlockingCounts(ContractModel):
    "Hashable strict proof that a page is or is not ready for one bounded navigation decision. It is not a critical-gate decision."

    required_field_count: CommonContractTextV1NonNegativeSafeInteger
    unresolved_count: CommonContractTextV1NonNegativeSafeInteger
    changed_value_count: CommonContractTextV1NonNegativeSafeInteger
    stale_document_count: CommonContractTextV1NonNegativeSafeInteger
    sensitive_confirmation_count: CommonContractTextV1NonNegativeSafeInteger
    mandatory_uncertain_count: CommonContractTextV1NonNegativeSafeInteger

class SessionPageReadinessProofV1NavigationControlIdentity(ContractModel):
    "Hashable strict proof that a page is or is not ready for one bounded navigation decision. It is not a critical-gate decision."

    control_id: CommonStableIdV1StableId
    identity_digest: CommonProvenanceV1ContentDigest
    resolution: Literal["AMBIGUOUS", "MISSING", "UNIQUE"]

SessionPageReadinessProofV1SiteValidationStatus = Literal["ACCEPTED", "REJECTED", "UNKNOWN"]

class SessionPageReadinessProofV1(ContractModel):
    "Hashable strict proof that a page is or is not ready for one bounded navigation decision. It is not a critical-gate decision."

    proof_id: CommonStableIdV1StableId
    proof_version: Literal["PAGE_READINESS_PROOF_V1"]
    session_id: CommonStableIdV1StableId
    page_id: CommonStableIdV1StableId
    step_identity: WorkdayStepIdentityV1
    page_generation: CommonContractTextV1NonNegativeSafeInteger
    reconciliation_digest: CommonProvenanceV1ContentDigest
    blocking_counts: SessionPageReadinessProofV1BlockingCounts
    site_validation_status: SessionPageReadinessProofV1SiteValidationStatus
    next_control: SessionPageReadinessProofV1NavigationControlIdentity | None = None
    back_control: SessionPageReadinessProofV1NavigationControlIdentity | None = None
    created_at: CommonTimestampUtcV1UtcTimestamp
    proof_digest: CommonProvenanceV1ContentDigest
    readiness: Literal["NOT_READY", "READY"]

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("next_control", "back_control",),
        )
