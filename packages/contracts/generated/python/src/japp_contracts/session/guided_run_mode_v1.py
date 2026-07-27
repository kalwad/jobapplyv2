"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/session/guided-run-mode.v1.schema.json
Schema id: urn:japp:schema:session:guided-run-mode:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Literal

from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

SessionGuidedRunModeV1PageEligibility = Literal["CERTIFIED_APPLICATION_PAGE", "EXPIRED_SESSION", "HUMAN_VERIFICATION", "LOGIN_OR_ACCOUNT", "PROTECTED_BOUNDARY", "STALE_PAGE", "UNCERTIFIED_PATTERN", "UNKNOWN_PAGE"]

SessionGuidedRunModeV1RevocationState = Literal["ACTIVE", "DISABLED", "REVOKED"]

SessionGuidedRunModeV1RunKind = Literal["DRY_RUN", "FEASIBILITY", "GUIDED_PRE_SUBMIT"]

SessionGuidedRunModeV1SnapshotState = Literal["MISSING", "READY", "STALE"]

SessionGuidedRunModeV1StartPolicy = Literal["AUTO_START_ON_OPEN", "MANUAL_START"]

class SessionGuidedRunModeV1SnapshotReadiness(ContractModel):
    "Bounded future run-mode and start-policy vocabulary. AUTO_SUBMIT and final-submit authority are deliberately absent."

    profile: SessionGuidedRunModeV1SnapshotState
    document: SessionGuidedRunModeV1SnapshotState
    answer_policy: SessionGuidedRunModeV1SnapshotState

class SessionGuidedRunModeV1(ContractModel):
    "Bounded future run-mode and start-policy vocabulary. AUTO_SUBMIT and final-submit authority are deliberately absent."

    run_mode_id: CommonStableIdV1StableId
    run_kind: SessionGuidedRunModeV1RunKind
    start_policy: SessionGuidedRunModeV1StartPolicy
    prior_opt_in_ref: CommonStableIdV1StableId | None = None
    certified_pattern_ref: CommonStableIdV1StableId | None = None
    snapshot_readiness: SessionGuidedRunModeV1SnapshotReadiness
    cancelable_start_ref: CommonStableIdV1StableId | None = None
    visible_cancel_control: bool
    revocation_state: SessionGuidedRunModeV1RevocationState
    page_eligibility: SessionGuidedRunModeV1PageEligibility
    start_permission: Literal["START_ALLOWED", "START_BLOCKED"]

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("prior_opt_in_ref", "certified_pattern_ref", "cancelable_start_ref",),
        )
