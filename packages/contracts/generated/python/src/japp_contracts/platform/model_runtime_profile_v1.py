"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/model-runtime-profile.v1.schema.json
Schema id: urn:japp:schema:platform:model-runtime-profile:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1AcceleratorClass, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1ContextTokens, PlatformVocabularyV1CoreCapabilityBehavior, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1ProfileAcceptanceState, PlatformVocabularyV1RuntimeFamily

class PlatformModelRuntimeProfileV1(ContractModel):
    "Platform-scoped runtime and artifact metadata for a local model profile, including exact artifact digest, runtime family and version, accelerator and driver bounds, context, quantization, memory requirements, license and provenance, evidence references, and the deterministic-core fallback behavior. A profile may be ACCEPTED only on a certified target with artifact and runtime evidence; no Windows or Ubuntu profile is accepted today. This contract does not invoke, download, select, or control any model runtime, and it does not change the model lock."

    model_profile_id: CommonStableIdV1StableId
    profile_token: Annotated[CommonContractTextV1BoundedToken, Field(description="Stable profile name such as the macos-arm64-mlx, windows-x64-nvidia, or ubuntu-x64-cpu families named by the specification.")]
    platform_id: PlatformVocabularyV1PlatformId
    runtime_family: PlatformVocabularyV1RuntimeFamily
    runtime_version: PlatformVocabularyV1ProductVersion
    accelerator: PlatformVocabularyV1AcceleratorClass
    minimum_driver_version: PlatformVocabularyV1ProductVersion | None = None
    artifact: PlatformVocabularyV1ArtifactIdentity
    context_tokens: PlatformVocabularyV1ContextTokens
    quantization_token: CommonContractTextV1BoundedToken
    minimum_ram_mib: PlatformVocabularyV1MemoryMebibytes
    minimum_vram_mib: PlatformVocabularyV1MemoryMebibytes | None = None
    license_token: CommonContractTextV1BoundedToken
    structured_output_evidence_ref: CommonStableIdV1StableId | None = None
    factuality_evidence_ref: CommonStableIdV1StableId | None = None
    latency_evidence_ref: CommonStableIdV1StableId | None = None
    memory_evidence_ref: CommonStableIdV1StableId | None = None
    core_capability_behavior: PlatformVocabularyV1CoreCapabilityBehavior
    availability: PlatformVocabularyV1CapabilityAvailability
    acceptance_state: PlatformVocabularyV1ProfileAcceptanceState
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)]
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    last_tested_on: CommonCalendarDateV1CalendarDate | None = None
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("minimum_driver_version", "minimum_vram_mib", "structured_output_evidence_ref", "factuality_evidence_ref", "latency_evidence_ref", "memory_evidence_ref", "last_tested_on",),
        )
