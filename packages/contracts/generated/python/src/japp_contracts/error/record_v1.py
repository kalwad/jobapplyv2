"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/error/record.v1.schema.json
Schema id: urn:japp:schema:error:record:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode, ErrorTaxonomyV1ErrorOrigin

class ErrorRecordV1(ContractModel):
    "Strict versioned error record exchanged across trust boundaries (M01-W03). The record serializes ONLY the stable error code plus occurrence identity/trace data; family, severity, retry disposition, user-action state, transience, diagnostic policy, and the user-safe message are derived by the consumer from the canonical error catalog, so a caller can never pair a code with contradictory metadata and free-form user-facing message text is unrepresentable on the wire. The record is a closed object with no extension surface; when transported inside the standard envelope, envelope-level versioning applies (schema_id urn:japp:schema:error:record:v1). Internal diagnostic detail travels out of band, redacted and bounded, referenced here only by an optional content digest — it never becomes UI text automatically."

    error_id: Annotated[CommonStableIdV1StableId, Field(description="Stable identity of this error occurrence.")]
    code: Annotated[ErrorTaxonomyV1ErrorCode, Field(description="Stable taxonomy code; the only classification data on the wire.")]
    occurred_at: Annotated[CommonTimestampUtcV1UtcTimestamp, Field(description="Instant the condition was observed, always UTC.")]
    origin: Annotated[ErrorTaxonomyV1ErrorOrigin, Field(description="Component or trust boundary reporting the error.")]
    correlation_id: Annotated[CommonCorrelationV1CorrelationId, Field(description="Workflow the occurrence belongs to.")]
    causation_id: Annotated[CommonCorrelationV1CausationId, Field(description="Message or event that directly produced this error, when known.")] | None = None
    diagnostic_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="SHA-256 digest of the separately stored, redacted, bounded diagnostic artifact for this occurrence, where one exists.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("causation_id", "diagnostic_digest",),
        )
