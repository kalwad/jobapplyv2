"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/installer-state.v2.schema.json
Schema id: urn:japp:schema:platform:installer-state:v2

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
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1InstallerState, PlatformVocabularyV1NativeHostCleanupState, PlatformVocabularyV1PackageFormat, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1SignatureState, PlatformVocabularyV1UserDataPreservation

class PlatformInstallerStateV2(ContractModel):
    "Bounded installer state for a packaged build: package identity, version, platform, architecture, format, artifact digest and signature state, channel, installed version, lifecycle state, interruption and recovery state, user-data preservation, native-host cleanup, and finite failure reasons. No installer command, script, registry modification, download URL, network request, signing key, or filesystem path is representable, and this contract installs nothing."

    installer_state_id: CommonStableIdV1StableId
    package_token: CommonContractTextV1BoundedToken
    package_version: PlatformVocabularyV1ProductVersion
    platform_id: PlatformVocabularyV1CertifiedPlatformId
    architecture: PlatformVocabularyV1Architecture
    package_format: PlatformVocabularyV1PackageFormat
    artifact: PlatformVocabularyV1ArtifactIdentity
    signature_state: PlatformVocabularyV1SignatureState
    channel: PlatformVocabularyV1DistributionChannel
    scope: PlatformVocabularyV1InstallationScope
    state: PlatformVocabularyV1InstallerState
    installed_version: PlatformVocabularyV1ProductVersion | None = None
    interrupted: Annotated[bool, Field(description="Historical: this install, repair, or uninstall was interrupted at some point. The unresolved terminal outcome is reported as INSTALL_INTERRUPTED, never by this flag alone.")]
    recovery_completed: Annotated[bool, Field(description="Whether the recorded interruption was subsequently resolved. Meaningless without an interruption, so it may appear only when `interrupted` is true.")] | None = None
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
            ("installed_version", "recovery_completed", "remediation_message", "evidence_refs",),
        )
