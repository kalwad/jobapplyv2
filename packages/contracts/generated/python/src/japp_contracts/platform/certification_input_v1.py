"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/certification-input.v1.schema.json
Schema id: urn:japp:schema:platform:certification-input:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NormalizedText
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1Architecture, PlatformVocabularyV1EvidenceArtifactKind, PlatformVocabularyV1OwnerDecisionState, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1SupportClaim

class PlatformCertificationInputV1(ContractModel):
    "The evidence inventory a future owner decision would consume before a platform support tier could be published. It is an input, never a decision: a certified proposal requires a certified target, a completed independent review, an evaluated revision, a complete evidence inventory, and a recorded owner decision. M01-W07 certifies no platform and changes no critical-gate state."

    certification_input_id: CommonStableIdV1StableId
    platform_id: PlatformVocabularyV1PlatformId
    architecture: PlatformVocabularyV1Architecture
    support_claim: PlatformVocabularyV1SupportClaim
    capability_report_ref: CommonStableIdV1StableId
    browser_record_ref: CommonStableIdV1StableId | None = None
    runtime_capability_ref: CommonStableIdV1StableId | None = None
    evidence_record_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(64)]
    required_evidence_kinds: Annotated[Annotated[list[PlatformVocabularyV1EvidenceArtifactKind], MinLen(0), MaxLen(16)], Field(description="Strictly sorted, unique kinds the reviewed policy requires for the proposed tier.")]
    present_evidence_kinds: Annotated[Annotated[list[PlatformVocabularyV1EvidenceArtifactKind], MinLen(0), MaxLen(16)], Field(description="Strictly sorted, unique kinds actually attached. A complete inventory requires every required kind to be present.")]
    inventory_complete: bool
    owner_decision_state: PlatformVocabularyV1OwnerDecisionState
    owner_decision_ref: CommonStableIdV1StableId | None = None
    known_limitations: Annotated[list[CommonContractTextV1NormalizedText], MinLen(0), MaxLen(16)] | None = None
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    last_tested_on: CommonCalendarDateV1CalendarDate | None = None
    prepared_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("browser_record_ref", "runtime_capability_ref", "owner_decision_ref", "known_limitations", "last_tested_on",),
        )
