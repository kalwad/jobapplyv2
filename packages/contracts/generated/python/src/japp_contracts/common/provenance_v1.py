"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/provenance.v1.schema.json
Schema id: urn:japp:schema:common:provenance:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp

CommonProvenanceV1ContentDigest = Annotated[str, StringConstraints(pattern="^sha256:[0-9a-f]{64}$")]
"SHA-256 digest of the exact observed artifact, rendered as sha256:<64 lowercase hex digits>."

CommonProvenanceV1SourceKind = Literal["USER_INPUT", "DOCUMENT_IMPORT", "PAGE_CAPTURE", "EXTERNAL_API", "GENERATED"]
"Closed set of source families. Additive growth follows the enum evolution rules in urn:japp:schema:common:enum-token:v1."

class CommonProvenanceV1Provenance(ContractModel):
    "Where a fact or record came from and when it was observed. Provenance requires a stable source identity (source_kind plus source_id) and an observation time; it may carry a content digest of the exact observed artifact and a bounded confidence. Provenance never embeds raw captured content, page HTML, or secret values — it references sources by identifier and digest only."

    source_kind: CommonProvenanceV1SourceKind
    source_id: Annotated[CommonStableIdV1StableId, Field(description="Stable identifier of the source entity (for example a document, capture, or import record).")]
    observed_at: Annotated[CommonTimestampUtcV1UtcTimestamp, Field(description="Instant the source content was observed, always UTC.")]
    source_digest: CommonProvenanceV1ContentDigest | None = None
    confidence: Annotated[CommonConfidenceV1Confidence, Field(description="Producer confidence that the referenced source supports the derived value.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("source_digest", "confidence",),
        )
