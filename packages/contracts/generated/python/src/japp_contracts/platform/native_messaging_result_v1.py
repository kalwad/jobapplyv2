"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/native-messaging-result.v1.schema.json
Schema id: urn:japp:schema:platform:native-messaging-result:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1NativeHostName, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RegistrationOperation, PlatformVocabularyV1RegistrationState

class PlatformNativeMessagingResultV1(ContractModel):
    "The idempotent outcome of one registration intent, including the observed registration state, whether the operation changed anything, the observed manifest identity digest, finite remediation reasons, and an evidence reference. It never contains a registry export, a manifest body, a filesystem path, or an executable name."

    registration_result_id: CommonStableIdV1StableId
    intent_ref: CommonStableIdV1StableId
    operation: PlatformVocabularyV1RegistrationOperation
    platform_id: PlatformVocabularyV1CertifiedPlatformId
    browser_family: PlatformVocabularyV1BrowserFamily
    host_name: PlatformVocabularyV1NativeHostName
    observed_state: Annotated[PlatformVocabularyV1RegistrationState, Field(description="The registration state observed after the operation ran. It is not a claim that the operation succeeded: a removal refused by permission still observes PRESENT_VALID. Success is carried by an empty `reason_codes`.")]
    observed_manifest_digest: CommonProvenanceV1ContentDigest | None = None
    observed_host_version: PlatformVocabularyV1ProductVersion | None = None
    changed: Annotated[bool, Field(description="Whether this execution modified registration state. A verify operation can never report a change.")]
    idempotent_repeat_safe: Annotated[bool, Field(description="Whether repeating the same intent is guaranteed to be a no-op.")]
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    evidence_ref: CommonStableIdV1StableId | None = None
    completed_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("observed_manifest_digest", "observed_host_version", "remediation_message", "evidence_ref",),
        )
