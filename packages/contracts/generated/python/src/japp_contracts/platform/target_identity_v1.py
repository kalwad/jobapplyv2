"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/target-identity.v1.schema.json
Schema id: urn:japp:schema:platform:target-identity:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1Architecture, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1BuildToken, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SupportClaim

class PlatformTargetIdentityV1(ContractModel):
    "Detected platform identity separated from any claimed or reviewed support tier. This record cannot certify a platform: certification requires a completed independent review, an evaluated revision, and evidence references, none of which exist for any target today."

    target_identity_id: CommonStableIdV1StableId
    platform_id: PlatformVocabularyV1PlatformId
    architecture: PlatformVocabularyV1Architecture
    os_version: Annotated[PlatformVocabularyV1ProductVersion, Field(description="Observed operating-system release version. It is an observation, not a support claim.")]
    os_build: PlatformVocabularyV1BuildToken | None = None
    detection_method: PlatformVocabularyV1EvaluationMethod
    detected_at: CommonTimestampUtcV1UtcTimestamp
    support_claim: PlatformVocabularyV1SupportClaim
    reason_codes: Annotated[Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)], Field(description="Finite reasons explaining why the reviewed tier is not certified. Empty only when the reviewed tier is certified.")]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("os_build", "remediation_message",),
        )
