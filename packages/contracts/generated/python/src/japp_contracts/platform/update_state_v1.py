"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/update-state.v1.schema.json
Schema id: urn:japp:schema:platform:update-state:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1NativeHostCleanupState, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SignatureState, PlatformVocabularyV1UpdateState, PlatformVocabularyV1UserDataPreservation

class PlatformUpdateStateV1(ContractModel):
    "Bounded update, rollback, and recovery state: channel, current and available versions, the target artifact digest and signature state, the lifecycle state, interruption and recovery, user-data preservation, native-host cleanup, and finite failure reasons. No download URL, network request, update script, registry modification, or signing key is representable, and this contract updates nothing."

    update_state_id: CommonStableIdV1StableId
    package_token: CommonContractTextV1BoundedToken
    platform_id: PlatformVocabularyV1CertifiedPlatformId
    architecture: PlatformVocabularyV1Architecture
    channel: PlatformVocabularyV1DistributionChannel
    current_version: PlatformVocabularyV1ProductVersion
    available_version: PlatformVocabularyV1ProductVersion | None = None
    installed_version: PlatformVocabularyV1ProductVersion | None = None
    rolled_back_to_version: PlatformVocabularyV1ProductVersion | None = None
    target_artifact: PlatformVocabularyV1ArtifactIdentity | None = None
    signature_state: PlatformVocabularyV1SignatureState
    state: PlatformVocabularyV1UpdateState
    interrupted: Annotated[bool, Field(description="Historical: this update or rollback was interrupted at some point. The unresolved terminal outcome is reported as UPDATE_INTERRUPTED, never by this flag alone.")]
    recovery_completed: Annotated[bool, Field(description="Whether the recorded interruption was subsequently resolved. Meaningless without an interruption, so it may appear only when `interrupted` is true.")] | None = None
    rollback_available: bool
    user_data_preservation: PlatformVocabularyV1UserDataPreservation
    native_host_cleanup: PlatformVocabularyV1NativeHostCleanupState
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)] | None = None
    observed_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("available_version", "installed_version", "rolled_back_to_version", "target_artifact", "recovery_completed", "remediation_message", "evidence_refs",),
        )
