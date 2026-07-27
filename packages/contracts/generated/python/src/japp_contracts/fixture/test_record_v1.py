"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/fixture/test-record.v1.schema.json
Schema id: urn:japp:schema:fixture:test-record:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.calendar_date_v1 import CommonCalendarDateV1CalendarDate
from japp_contracts.common.confidence_v1 import CommonConfidenceV1Confidence
from japp_contracts.common.location_v1 import CommonLocationV1StructuredLocation
from japp_contracts.common.money_v1 import CommonMoneyV1Money
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.redaction_v1 import CommonRedactionV1RedactionAnnotation
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp

class FixtureTestRecordV1(ContractModel):
    "TEST-ONLY fixture proving that the foundational common definitions compose into a concrete payload schema and flow through the envelope. The fixture namespace never carries product data and no product component may depend on it. Version history (illustrative): 1.0.0 defined every required field; 1.1.0 added the optional note field (additive MINOR change) and deprecated legacy_tag. Real payload contracts (profile, resume, application, field, Workday, benchmark, platform) are future packages."

    record_id: Annotated[CommonStableIdV1StableId, Field(description="Stable identity of this fixture record.")]
    captured_at: CommonTimestampUtcV1UtcTimestamp
    effective_date: CommonCalendarDateV1CalendarDate
    budget: CommonMoneyV1Money
    location: CommonLocationV1StructuredLocation
    provenance: CommonProvenanceV1Provenance
    match_confidence: CommonConfidenceV1Confidence
    redaction: CommonRedactionV1RedactionAnnotation
    status: Annotated[Literal["ACTIVE", "ARCHIVED"], Field(description="Closed fixture status set; undeclared tokens are rejected.")]
    superseded_by: Annotated[CommonStableIdV1StableId | None, Field(description="Identifier of the replacing record, or null when this record is explicitly known to have no successor. Null (known-none) and missing (not provided) are distinct by convention; this field is required precisely so producers must state the known-none case.")]
    note: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=500)], Field(description="Optional free-text note added in 1.1.0. Optional and non-nullable: omit it when absent; null is rejected. Sensitivity (x-japp-sensitivity): PERSONAL. Redaction (x-japp-redaction): REDACT_VALUE.")] | None = None
    legacy_tag: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=64)], Field(description="[deprecated since schema version 1.1.0] Deprecated fixture field retained for minor-compatibility; removal requires the next major.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("note", "legacy_tag",),
        )
