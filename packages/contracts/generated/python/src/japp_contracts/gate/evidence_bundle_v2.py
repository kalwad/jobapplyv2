"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/gate/evidence-bundle.v2.schema.json
Schema id: urn:japp:schema:gate:evidence-bundle:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.benchmark.result_v1 import BenchmarkResultV1RuntimeMetadata
from japp_contracts.common.contract_text_v1 import CommonContractTextV1GitObjectId, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText, CommonContractTextV1PositiveSafeInteger
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

class GateEvidenceBundleV2CompletenessInventory(ContractModel):
    "Exact candidate evidence inventory with an explicit, nonexecuted owner holdout waiver. A typed waiver is a declaration; source-aware repository acceptance must independently bind the accepted owner decision. It does not evaluate repository gate state."

    required_benchmark_count: CommonContractTextV1PositiveSafeInteger
    present_benchmark_count: CommonContractTextV1NonNegativeSafeInteger
    corpus_valid: bool
    holdout_valid: bool
    raw_artifacts_complete: bool
    manual_inspection_complete: bool
    independent_review_complete: bool
    owner_decision_requirement: Literal["NOT_REQUIRED", "REQUIRED"]
    owner_decision_complete: bool

GateEvidenceBundleV2GateId = Literal["AUTOFILL_FEASIBILITY", "CROSS_PLATFORM_CORE", "RESUME_PAGEFIT_FEASIBILITY", "WORKDAY_GUIDED_PRE_SUBMIT"]

class GateEvidenceBundleV2OwnerHoldoutWaiver(ContractModel):
    "Exact candidate evidence inventory with an explicit, nonexecuted owner holdout waiver. A typed waiver is a declaration; source-aware repository acceptance must independently bind the accepted owner decision. It does not evaluate repository gate state."

    adr_ref: Annotated[str, StringConstraints(pattern="^ADR-0006$", min_length=8, max_length=8)]
    owner_decision_ref: Annotated[str, StringConstraints(pattern="^OD-035$", min_length=6, max_length=6)]
    source_document_ref: Annotated[str, StringConstraints(pattern="^docs/DECISIONS\\.md$", min_length=17, max_length=17)]
    source_record_digest: CommonProvenanceV1ContentDigest

class GateEvidenceBundleV2HoldoutAssessment(ContractModel):
    "Exact candidate evidence inventory with an explicit, nonexecuted owner holdout waiver. A typed waiver is a declaration; source-aware repository acceptance must independently bind the accepted owner decision. It does not evaluate repository gate state."

    state: Literal["EXECUTED", "NOT_EXECUTED", "WAIVED_BY_OWNER_ADR_0006"]
    execution_performed: bool
    execution_result_ref: CommonStableIdV1StableId | None = None
    owner_waiver: GateEvidenceBundleV2OwnerHoldoutWaiver | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("execution_result_ref", "owner_waiver",),
        )

class GateEvidenceBundleV2(ContractModel):
    "Exact candidate evidence inventory with an explicit, nonexecuted owner holdout waiver. A typed waiver is a declaration; source-aware repository acceptance must independently bind the accepted owner decision. It does not evaluate repository gate state."

    evidence_bundle_id: CommonStableIdV1StableId
    gate_id: GateEvidenceBundleV2GateId
    candidate_commit: CommonContractTextV1GitObjectId
    candidate_tree: CommonContractTextV1GitObjectId
    corpus_manifest_digest: CommonProvenanceV1ContentDigest
    holdout_manifest_digest: CommonProvenanceV1ContentDigest | None = None
    runtime_metadata: BenchmarkResultV1RuntimeMetadata
    benchmark_result_refs: Annotated[list[CommonStableIdV1StableId], MinLen(1), MaxLen(128)]
    raw_artifact_report_digests: Annotated[list[CommonProvenanceV1ContentDigest], MinLen(1), MaxLen(128)]
    manual_inspection_evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(1), MaxLen(64)]
    independent_review_ref: CommonStableIdV1StableId
    reviewer_identity_ref: CommonStableIdV1StableId
    owner_decision_ref: CommonStableIdV1StableId | None = None
    completeness_inventory: GateEvidenceBundleV2CompletenessInventory
    known_limitations: Annotated[list[CommonContractTextV1NormalizedText], MinLen(0), MaxLen(32)]
    bundle_state: Literal["COMPLETE", "INCOMPLETE", "INVALID"]
    evidence_bundle_digest: CommonProvenanceV1ContentDigest
    provenance: CommonProvenanceV1Provenance
    holdout_assessment: GateEvidenceBundleV2HoldoutAssessment

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("holdout_manifest_digest", "owner_decision_ref",),
        )
