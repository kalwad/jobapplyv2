"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/session/navigation-record.v1.schema.json
Schema id: urn:japp:schema:session:navigation-record:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.session.guided_run_mode_v1 import SessionGuidedRunModeV1RunKind, SessionGuidedRunModeV1StartPolicy
from japp_contracts.session.page_readiness_proof_v1 import SessionPageReadinessProofV1NavigationControlIdentity
from japp_contracts.workday.step_identity_v1 import WorkdayStepIdentityV1, WorkdayStepIdentityV1StepFamily

SessionNavigationRecordV1NavigationAction = Literal["BACK", "NEXT"]

SessionNavigationRecordV1NavigationOutcome = Literal["FAILED", "NO_TRANSITION", "PAUSED_BOUNDARY", "UNCERTAIN_TRANSITION", "VERIFIED_TRANSITION"]

SessionNavigationRecordV1ReasonCode = Literal["CONTROL_RESOLUTION_FAILED", "DESTINATION_NOT_ALLOWED", "DESTINATION_NOT_RECOGNIZED", "NAVIGATION_ATTEMPT_FAILED", "NO_TRANSITION_OBSERVED", "POSTCONDITIONS_INCOMPLETE", "POSTCONDITIONS_VERIFIED", "PROTECTED_BOUNDARY_PAUSE", "READINESS_PROOF_INVALID", "SOURCE_GENERATION_MISMATCH", "TRANSITION_UNCERTAIN"]

class SessionNavigationRecordV1TransitionPostconditions(ContractModel):
    "Auditable evidence for one bounded next/back navigation attempt. Clicks alone are not transition evidence and final submission is not representable."

    source_generation_changed: bool
    destination_recognized: bool
    source_control_absent_or_inactive: bool

class SessionNavigationRecordV1(ContractModel):
    "Auditable evidence for one bounded next/back navigation attempt. Clicks alone are not transition evidence and final submission is not representable."

    navigation_record_id: CommonStableIdV1StableId
    session_id: CommonStableIdV1StableId
    source_step_identity: WorkdayStepIdentityV1
    expected_destination_family: WorkdayStepIdentityV1StepFamily | None = None
    allowed_destination_families: Annotated[list[WorkdayStepIdentityV1StepFamily], MinLen(1), MaxLen(12)]
    source_page_generation: CommonContractTextV1NonNegativeSafeInteger
    readiness_proof_ref: CommonStableIdV1StableId
    readiness_proof_digest: CommonProvenanceV1ContentDigest
    navigation_control: SessionPageReadinessProofV1NavigationControlIdentity
    action: SessionNavigationRecordV1NavigationAction
    idempotency_key: CommonStableIdV1StableId
    initiating_run_kind: SessionGuidedRunModeV1RunKind
    initiating_start_policy: SessionGuidedRunModeV1StartPolicy
    attempted_at: CommonTimestampUtcV1UtcTimestamp
    postconditions: SessionNavigationRecordV1TransitionPostconditions
    observed_destination_identity: WorkdayStepIdentityV1 | None = None
    observed_resulting_generation: CommonContractTextV1NonNegativeSafeInteger | None = None
    safe_retry_allowed: bool
    outcome: SessionNavigationRecordV1NavigationOutcome
    reason_codes: Annotated[list[SessionNavigationRecordV1ReasonCode], MinLen(1), MaxLen(8)]
    correlation_id: CommonCorrelationV1CorrelationId

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("expected_destination_family", "observed_destination_identity", "observed_resulting_generation",),
        )
