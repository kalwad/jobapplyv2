"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/diagnostic-report.v2.schema.json
Schema id: urn:japp:schema:platform:diagnostic-report:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.redaction_v1 import CommonRedactionV1RedactionAnnotation
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1DiagnosticResult, PlatformVocabularyV1PlatformCapabilityId, PlatformVocabularyV1PlatformComponentId, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1Severity

class PlatformDiagnosticReportV2(ContractModel):
    "A bounded diagnostic for one platform component: finite reason codes, one bounded user-safe message, explicit redaction metadata, severity, the component and capability identity, correlation, and synthetic-safe evidence references. A success result may never carry a blocking reason, and the record cannot contain a raw log, environment dump, registry export, local path, or secret value."

    diagnostic_report_id: CommonStableIdV1StableId
    component: PlatformVocabularyV1PlatformComponentId
    capability: PlatformVocabularyV1PlatformCapabilityId
    platform_id: PlatformVocabularyV1PlatformId
    severity: PlatformVocabularyV1Severity
    result: PlatformVocabularyV1DiagnosticResult
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    blocking: Annotated[bool, Field(description="Whether the reported condition blocks the affected capability. A successful diagnostic can never be blocking.")]
    user_message: PlatformVocabularyV1BoundedUserMessage | None = None
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    redaction: CommonRedactionV1RedactionAnnotation
    detail_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="Digest of a redacted out-of-band detail record. The detail itself never travels in this contract.")] | None = None
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)] | None = None
    evaluated_at: CommonTimestampUtcV1UtcTimestamp
    correlation_id: CommonCorrelationV1CorrelationId
    causation_id: CommonCorrelationV1CausationId | None = None
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("user_message", "remediation_message", "detail_digest", "evidence_refs", "causation_id",),
        )
