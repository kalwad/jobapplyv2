"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/browser-discovery-request.v1.schema.json
Schema id: urn:japp:schema:platform:browser-discovery-request:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1PlatformId, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RequestContext

class PlatformBrowserDiscoveryRequestV1(ContractModel):
    "A request to report whether a reviewed browser family and channel are present on a certified platform. It cannot name an executable, search a path, launch a URL, invoke a shell, or pass browser arguments."

    browser_discovery_request_id: CommonStableIdV1StableId
    request_context: PlatformVocabularyV1RequestContext
    platform_id: PlatformVocabularyV1PlatformId
    browser_family: PlatformVocabularyV1BrowserFamily
    browser_channel: PlatformVocabularyV1BrowserChannel
    include_capability_probe: Annotated[bool, Field(description="Whether the adapter should additionally report native-messaging capability. A probe never launches the browser.")]
    minimum_version: PlatformVocabularyV1ProductVersion | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("minimum_version",),
        )
