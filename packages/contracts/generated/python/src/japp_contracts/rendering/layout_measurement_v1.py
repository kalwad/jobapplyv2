"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/rendering/layout-measurement.v1.schema.json
Schema id: urn:japp:schema:rendering:layout-measurement:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode

class RenderingLayoutMeasurementV1ContentBounds(ContractModel):
    "Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots."

    page_number: Annotated[int, Ge(1), Le(1000)]
    x: Annotated[int, Ge(0), Le(10000)] | Annotated[float, Ge(0), Le(10000)]
    y: Annotated[int, Ge(0), Le(10000)] | Annotated[float, Ge(0), Le(10000)]
    width: Annotated[int, Ge(0), Le(10000)] | Annotated[float, Ge(0), Le(10000)]
    height: Annotated[int, Ge(0), Le(10000)] | Annotated[float, Ge(0), Le(10000)]

class RenderingLayoutMeasurementV1EnvironmentMetadata(ContractModel):
    "Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots."

    platform_profile: CommonEnumTokenV1EnumToken
    toolchain_digest: CommonProvenanceV1ContentDigest

class RenderingLayoutMeasurementV1FontCommitment(ContractModel):
    "Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots."

    font_family: CommonEnumTokenV1EnumToken
    font_digest: CommonProvenanceV1ContentDigest

RenderingLayoutMeasurementV1LayoutResult = Literal["ACCEPTED", "CLIPPED", "EXTRACTION_ORDER_MISMATCH", "FONT_MISSING", "OVERFLOW", "RENDER_FAILED"]

class RenderingLayoutMeasurementV1PageDimensions(ContractModel):
    "Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots."

    width_points: Annotated[int, Ge(1), Le(10000)] | Annotated[float, Ge(1), Le(10000)]
    height_points: Annotated[int, Ge(1), Le(10000)] | Annotated[float, Ge(1), Le(10000)]

class RenderingLayoutMeasurementV1(ContractModel):
    "Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots."

    measurement_id: CommonStableIdV1StableId
    render_artifact_id: CommonStableIdV1StableId
    render_artifact_digest: CommonProvenanceV1ContentDigest
    source_document_ref: CommonStableIdV1StableId
    renderer_version: CommonContractTextV1BoundedToken
    browser_version: CommonContractTextV1BoundedToken
    controlled_fonts: Annotated[list[RenderingLayoutMeasurementV1FontCommitment], MinLen(1), MaxLen(32)]
    page_dimensions: RenderingLayoutMeasurementV1PageDimensions
    page_count: Annotated[Annotated[int, Ge(0), Le(1000)], Field(description="Rendered page count. Zero permits a structurally honest RENDER_FAILED record; its relationship to layout_result is a cross-field semantic invariant.")]
    page_content_bounds: Annotated[Annotated[list[RenderingLayoutMeasurementV1ContentBounds], MinLen(0), MaxLen(1000)], Field(description="One bounded measurement per rendered page. An empty inventory permits RENDER_FAILED evidence; its relationship to page_count and layout_result is a cross-field semantic invariant.")]
    overflow_detected: bool
    clipping_detected: bool
    extraction_order_result: Literal["MATCH", "MISMATCH", "UNKNOWN"]
    missing_font_families: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(0), MaxLen(32)]
    renderer_succeeded: bool
    parseability_score: CommonConfidenceV1Confidence | None = None
    readability_score: CommonConfidenceV1Confidence | None = None
    word_count: CommonContractTextV1NonNegativeSafeInteger
    character_count: CommonContractTextV1NonNegativeSafeInteger
    duration_ms: Annotated[int, Ge(0), Le(86400000)]
    environment_metadata: RenderingLayoutMeasurementV1EnvironmentMetadata
    layout_result: RenderingLayoutMeasurementV1LayoutResult
    error_reason_codes: Annotated[list[ErrorTaxonomyV1ErrorCode], MinLen(0), MaxLen(16)]
    evidence_report_digest: CommonProvenanceV1ContentDigest

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("parseability_score", "readability_score",),
        )
