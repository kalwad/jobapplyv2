"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/browser-record.v2.schema.json
Schema id: urn:japp:schema:platform:browser-record:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1CapabilityState, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RedactedPathReference

class PlatformBrowserRecordV2(ContractModel):
    "A sanitized record of one observed browser: family, channel, version, sanitized install location, and native-messaging capability. Only Chrome stable on a certified platform may ever be marked certified; the contract deliberately cannot express Firefox, Safari, ChromeOS, ARM Windows, Intel macOS, or another Linux distribution as certified. It contains no executable path, launch argument, profile directory, or browsing data."

    browser_record_id: CommonStableIdV1StableId
    request_ref: CommonStableIdV1StableId | None = None
    platform_id: PlatformVocabularyV1PlatformId
    browser_family: PlatformVocabularyV1BrowserFamily
    browser_channel: PlatformVocabularyV1BrowserChannel
    detected_version: PlatformVocabularyV1ProductVersion | None = None
    detection_method: PlatformVocabularyV1EvaluationMethod
    presence: PlatformVocabularyV1CapabilityAvailability
    sanitized_install_location: Annotated[PlatformVocabularyV1RedactedPathReference, Field(description="Role-anchored sanitized reference only. A real installation path is never represented.")] | None = None
    certified_for_platform: Annotated[bool, Field(description="Whether this observation is inside the certified browser matrix. Only Chrome stable on a certified platform, with a measured detection method and an observed version, may be true.")]
    native_messaging_capability: PlatformVocabularyV1CapabilityState
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    last_tested_on: CommonCalendarDateV1CalendarDate | None = None
    observed_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("request_ref", "detected_version", "sanitized_install_location", "last_tested_on",),
        )
