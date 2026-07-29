"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/native-messaging-registration.v2.schema.json
Schema id: urn:japp:schema:platform:native-messaging-registration:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CertifiedPlatformId, PlatformVocabularyV1ExtensionId, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1NativeHostName, PlatformVocabularyV1PathRole, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RegistrationOperation, PlatformVocabularyV1RequestContext, PlatformVocabularyV1StdioMode

class PlatformNativeMessagingRegistrationV2(ContractModel):
    "A typed install, verify, repair, update, or remove intent that binds a certified platform, a certified browser and channel, an allowlisted extension identifier set, the host identity and version, an installation scope, and the expected manifest digest. Arbitrary registry keys or values, manifest JSON bodies, executable paths, shell commands, and unreviewed extension identifiers are structurally unrepresentable. No registry, manifest, browser, or filesystem modification occurs in M01-W07."

    registration_intent_id: CommonStableIdV1StableId
    request_context: PlatformVocabularyV1RequestContext
    operation: PlatformVocabularyV1RegistrationOperation
    platform_id: PlatformVocabularyV1CertifiedPlatformId
    browser_family: PlatformVocabularyV1BrowserFamily
    browser_channel: PlatformVocabularyV1BrowserChannel
    host_name: PlatformVocabularyV1NativeHostName
    host_version: PlatformVocabularyV1ProductVersion
    allowed_extension_ids: Annotated[Annotated[list[PlatformVocabularyV1ExtensionId], MinLen(1), MaxLen(4)], Field(description="Reviewed extension-identifier allowlist. Registration cannot widen it and cannot express a wildcard.")]
    scope: PlatformVocabularyV1InstallationScope
    manifest_location_role: Annotated[PlatformVocabularyV1PathRole, Field(description="Typed location role for the platform-appropriate manifest or registry entry. It is never a literal path or registry key.")]
    expected_manifest_digest: CommonProvenanceV1ContentDigest | None = None
    expected_host_binary_digest: CommonProvenanceV1ContentDigest | None = None
    binary_stdio_mode: Annotated[PlatformVocabularyV1StdioMode, Field(description="Windows-safe transport requirement. Length-prefixed binary stdio is mandatory so newline translation cannot corrupt messages.")]
    max_message_bytes: Annotated[int, Ge(1), Le(1048576)] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("expected_manifest_digest", "expected_host_binary_digest", "max_message_bytes",),
        )
