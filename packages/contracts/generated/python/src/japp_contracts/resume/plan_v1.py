"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/resume/plan.v1.schema.json
Schema id: urn:japp:schema:resume:plan:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

class ResumePlanV1Budget(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    section_word_budget: Annotated[int, Ge(1), Le(5000)]
    global_word_budget: Annotated[int, Ge(1), Le(20000)]
    page_budget: Annotated[int, Ge(1), Le(20)]

class ResumePlanV1EditDecision(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    content_ref: CommonStableIdV1StableId
    decision: Literal["KEEP", "LOCK", "REMOVE", "REORDER"]
    reason_code: CommonEnumTokenV1EnumToken

class ResumePlanV1EvidenceAssignment(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    requirement_ref: CommonStableIdV1StableId
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(1), MaxLen(32)]

class ResumePlanV1RequirementEntry(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    requirement_ref: CommonStableIdV1StableId
    priority: Annotated[int, Ge(1), Le(1000)]
    supported: bool

class ResumePlanV1TerminologyDecision(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    term: CommonContractTextV1BoundedToken
    decision: Literal["AVOID", "REVIEW", "USE"]
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)]

class ResumePlanV1(ContractModel):
    "Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence."

    plan_id: CommonStableIdV1StableId
    plan_schema_version: Literal["RESUME_PLAN_V1"]
    job_ref: CommonStableIdV1StableId
    job_version_ref: CommonStableIdV1StableId
    resume_source_ref: CommonStableIdV1StableId
    resume_version_ref: CommonStableIdV1StableId
    ordered_requirements: Annotated[list[ResumePlanV1RequirementEntry], MinLen(1), MaxLen(256)]
    evidence_assignments: Annotated[list[ResumePlanV1EvidenceAssignment], MinLen(0), MaxLen(256)]
    unsupported_gap_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(256)]
    locked_content_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(256)]
    budget: ResumePlanV1Budget
    terminology_decisions: Annotated[list[ResumePlanV1TerminologyDecision], MinLen(0), MaxLen(128)]
    edit_decisions: Annotated[list[ResumePlanV1EditDecision], MinLen(0), MaxLen(256)]
    expected_verification_checks: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(1), MaxLen(64)]
    prompt_version_ref: CommonStableIdV1StableId | None = None
    model_profile_ref: CommonStableIdV1StableId | None = None
    provenance: CommonProvenanceV1Provenance
    correlation_id: CommonCorrelationV1CorrelationId

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("prompt_version_ref", "model_profile_ref",),
        )
