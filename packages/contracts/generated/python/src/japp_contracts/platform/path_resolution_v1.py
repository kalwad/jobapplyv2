"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/path-resolution.v1.schema.json
Schema id: urn:japp:schema:platform:path-resolution:v1

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
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1InstallationScope, PlatformVocabularyV1PathResolutionState, PlatformVocabularyV1PathRole, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1RedactedPathReference

class PlatformPathResolutionV1(ContractModel):
    "A trusted adapter result. It is deliberately a different contract from a request: it may report a location only as a sanitized role-anchored reference plus a digest, so an ordinary diagnostic, telemetry record, holdout, or evidence bundle never exposes a private local path."

    path_resolution_id: CommonStableIdV1StableId
    request_ref: CommonStableIdV1StableId
    role: PlatformVocabularyV1PathRole
    scope: PlatformVocabularyV1InstallationScope
    resolution_state: PlatformVocabularyV1PathResolutionState
    sanitized_path: Annotated[PlatformVocabularyV1RedactedPathReference, Field(description="Role-anchored sanitized reference. Present only for a resolved location.")] | None = None
    path_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="Digest of the exact resolved location, so two records can be correlated without revealing either location.")] | None = None
    exists: bool
    writable: bool
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    resolved_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("sanitized_path", "path_digest", "remediation_message",),
        )
