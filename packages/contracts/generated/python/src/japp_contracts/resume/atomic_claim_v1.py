"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/resume/atomic-claim.v1.schema.json
Schema id: urn:japp:schema:resume:atomic-claim:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen

from japp_contracts._runtime import ContractModel
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NormalizedText
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode

ResumeAtomicClaimV1ClaimType = Literal["ACHIEVEMENT", "EXPERIENCE", "QUALIFICATION", "RESPONSIBILITY", "SKILL"]

ResumeAtomicClaimV1UserAction = Literal["EDIT_AND_APPROVE", "NONE", "PROVIDE_EVIDENCE", "REJECT_CLAIM"]

ResumeAtomicClaimV1VerificationStatus = Literal["CONTRADICTED", "NEEDS_USER_INPUT", "PARTIALLY_SUPPORTED", "SUPPORTED", "UNSUPPORTED"]

class ResumeAtomicClaimV1(ContractModel):
    "One bounded generated or shortened claim with explicit evidence and verification state. Model output cannot mutate canonical evidence."

    claim_id: CommonStableIdV1StableId
    claim_type: ResumeAtomicClaimV1ClaimType
    claim_text: CommonContractTextV1NormalizedText
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(32)]
    verification_status: ResumeAtomicClaimV1VerificationStatus
    prompt_version_ref: CommonStableIdV1StableId
    model_digest: CommonProvenanceV1ContentDigest
    model_profile_ref: CommonStableIdV1StableId
    verified_at: CommonTimestampUtcV1UtcTimestamp
    verification_result_digest: CommonProvenanceV1ContentDigest
    rejection_error_codes: Annotated[list[ErrorTaxonomyV1ErrorCode], MinLen(0), MaxLen(16)]
    release_eligible: bool
    user_action: ResumeAtomicClaimV1UserAction
    canonical_evidence_mutation: bool
