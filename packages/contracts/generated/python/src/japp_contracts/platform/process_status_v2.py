"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/process-status.v2.schema.json
Schema id: urn:japp:schema:platform:process-status:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProcessExitCode, PlatformVocabularyV1ProcessProfileId, PlatformVocabularyV1ProcessState, PlatformVocabularyV1TerminationRequest

class PlatformProcessStatusV2(ContractModel):
    "A stable supervisor handle plus the observed lifecycle state and exit result for one planned process. Handles are opaque: no operating-system process identifier, thread identifier, executable path, command line, or captured output stream is representable. Termination is a typed intent, never a raw signal value."

    process_status_id: CommonStableIdV1StableId
    process_handle: Annotated[CommonStableIdV1StableId, Field(description="Opaque supervisor handle. It is not an operating-system process identifier.")]
    plan_ref: CommonStableIdV1StableId
    profile: PlatformVocabularyV1ProcessProfileId
    state: PlatformVocabularyV1ProcessState
    termination_requested: PlatformVocabularyV1TerminationRequest
    started_at: CommonTimestampUtcV1UtcTimestamp | None = None
    ended_at: CommonTimestampUtcV1UtcTimestamp | None = None
    exit_code: Annotated[PlatformVocabularyV1ProcessExitCode, Field(description="Observed exit status of a child that ended on its own. A non-zero status is always accompanied by at least one finite reason.")] | None = None
    restart_count: Annotated[int, Ge(0), Le(8)]
    orphan_detected: Annotated[bool, Field(description="Historical: this child was observed to have outlived its supervising parent. It stays true on the terminal record of an orphan that was cleaned up or finally seen to exit.")]
    idempotency_key: CommonContractTextV1BoundedToken | None = None
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    diagnostic_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="Digest of a redacted out-of-band diagnostic record. Raw child output never travels in this contract.")] | None = None
    observed_at: CommonTimestampUtcV1UtcTimestamp
    correlation_id: CommonCorrelationV1CorrelationId | None = None
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("started_at", "ended_at", "exit_code", "idempotency_key", "remediation_message", "diagnostic_digest", "correlation_id",),
        )
