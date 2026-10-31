"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/gate/decision.v2.schema.json
Schema id: urn:japp:schema:gate:decision:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1GitObjectId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode
from japp_contracts.gate.evidence_bundle_v1 import GateEvidenceBundleV1GateId
from japp_contracts.gate.evidence_bundle_v2 import GateEvidenceBundleV2HoldoutAssessment

GateDecisionV2GateDecision = Literal["BLOCKED", "PASS", "REDESIGN_REQUIRED"]

GateDecisionV2IndependentReviewState = Literal["COMPLETE", "MISSING", "REJECTED"]

GateDecisionV2OwnerDecisionState = Literal["COMPLETE", "MISSING", "NOT_REQUIRED", "REJECTED"]

GateDecisionV2ReasonCode = Literal["CORPUS_INVALID", "ERROR_STATE_PRESENT", "HOLDOUT_INVALID", "INDEPENDENT_REVIEW_INCOMPLETE", "MISSING_EVIDENCE", "OWNER_DECISION_INCOMPLETE", "REQUIRED_BENCHMARK_RESULTS_INCOMPLETE", "REVIEWED_PASS", "REVIEWED_REDESIGN_REQUIRED", "THRESHOLD_FAILED"]

class GateDecisionV2ThresholdEvidenceSummary(ContractModel):
    "Exact candidate decision with explicit holdout execution or a separately authorized owner waiver. PASS never relabels a waived holdout as valid or executed; all other threshold, independent-review and owner-decision obligations remain."

    evidence_complete: bool
    required_benchmark_results_complete: bool
    thresholds_passed: bool
    corpus_valid: bool
    holdout_valid: bool

class GateDecisionV2(ContractModel):
    "Exact candidate decision with explicit holdout execution or a separately authorized owner waiver. PASS never relabels a waived holdout as valid or executed; all other threshold, independent-review and owner-decision obligations remain."

    decision_record_id: CommonStableIdV1StableId
    gate_id: GateEvidenceBundleV1GateId
    candidate_commit: CommonContractTextV1GitObjectId
    candidate_tree: CommonContractTextV1GitObjectId
    evidence_bundle_digest: CommonProvenanceV1ContentDigest
    decision: GateDecisionV2GateDecision
    threshold_evidence_summary: GateDecisionV2ThresholdEvidenceSummary
    independent_review_state: GateDecisionV2IndependentReviewState
    owner_decision_state: GateDecisionV2OwnerDecisionState
    decided_at: CommonTimestampUtcV1UtcTimestamp
    reason_codes: Annotated[list[GateDecisionV2ReasonCode], MinLen(1), MaxLen(16)]
    error_codes: Annotated[list[ErrorTaxonomyV1ErrorCode], MinLen(0), MaxLen(16)]
    redesign_adr_ref: CommonStableIdV1StableId | None = None
    holdout_assessment: GateEvidenceBundleV2HoldoutAssessment

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("redesign_adr_ref",),
        )
