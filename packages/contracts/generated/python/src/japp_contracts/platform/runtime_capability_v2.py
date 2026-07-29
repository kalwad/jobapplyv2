"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/runtime-capability.v2.schema.json
Schema id: urn:japp:schema:platform:runtime-capability:v2

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
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1AcceleratorClass, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1CoreCapabilityBehavior, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RuntimeFamily

class PlatformRuntimeCapabilityV2(ContractModel):
    "The RuntimeCapability record of specification §5.14.2: what the local runtime reports on this target, which profiles are available, and how the deterministic core behaves when full AI is unavailable. Deterministic autofill, profile, matching, tracking, and document workflows must never depend on this record reporting availability."

    runtime_capability_id: CommonStableIdV1StableId
    platform_id: PlatformVocabularyV1PlatformId
    runtime_family: PlatformVocabularyV1RuntimeFamily | None = None
    runtime_version: PlatformVocabularyV1ProductVersion | None = None
    accelerator: PlatformVocabularyV1AcceleratorClass | None = None
    runtime_availability: PlatformVocabularyV1CapabilityAvailability
    detection_method: PlatformVocabularyV1EvaluationMethod
    detected_ram_mib: PlatformVocabularyV1MemoryMebibytes | None = None
    detected_vram_mib: PlatformVocabularyV1MemoryMebibytes | None = None
    available_profile_refs: Annotated[Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)], Field(description="Profiles this runtime can offer. Only the two non-blocking availability states, AVAILABLE and DEGRADED_LIMITED, may enumerate any.")]
    accepted_profile_refs: Annotated[Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)], Field(description="Subset of available profiles whose acceptance is already recorded. Empty is the honest current state on every target.")]
    core_capability_behavior: PlatformVocabularyV1CoreCapabilityBehavior
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    observed_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("runtime_family", "runtime_version", "accelerator", "detected_ram_mib", "detected_vram_mib", "remediation_message",),
        )
