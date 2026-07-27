"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/benchmark/case.v1.schema.json
Schema id: urn:japp:schema:benchmark:case:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1MetricValue, CommonContractTextV1SchemaReference, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

BenchmarkCaseV1BenchmarkFamily = Literal["AUTOFILL_FEASIBILITY", "CONTRACT_COMPATIBILITY", "RESUME_PAGEFIT_FEASIBILITY", "WORKDAY_GUIDED_PRE_SUBMIT"]

class BenchmarkCaseV1EnvironmentRequirements(ContractModel):
    "Immutable expected behavior, threshold, corpus, environment, and provenance contract for one future benchmark case."

    runtime_profile: CommonEnumTokenV1EnumToken
    platform_profile: CommonEnumTokenV1EnumToken
    toolchain_digest: CommonProvenanceV1ContentDigest
    model_profile_ref: CommonStableIdV1StableId | None = None
    adapter_version: CommonContractTextV1VersionText | None = None
    browser_family: CommonEnumTokenV1EnumToken | None = None
    browser_version: CommonContractTextV1BoundedToken | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("model_profile_ref", "adapter_version", "browser_family", "browser_version",),
        )

BenchmarkCaseV1ExpectedBehavior = Literal["ACCEPT", "BLOCK", "MEASURE", "REJECT"]

class BenchmarkCaseV1InputArtifact(ContractModel):
    "Immutable expected behavior, threshold, corpus, environment, and provenance contract for one future benchmark case."

    artifact_ref: CommonStableIdV1StableId
    artifact_digest: CommonProvenanceV1ContentDigest
    schema_ref: CommonContractTextV1SchemaReference

BenchmarkCaseV1MetricUnit = Literal["BYTES", "COUNT", "MILLISECONDS", "RATIO", "SCORE"]

BenchmarkCaseV1ThresholdComparator = Literal["AT_LEAST", "AT_MOST", "EXACT"]

class BenchmarkCaseV1Threshold(ContractModel):
    "Immutable expected behavior, threshold, corpus, environment, and provenance contract for one future benchmark case."

    metric_id: CommonEnumTokenV1EnumToken
    comparator: BenchmarkCaseV1ThresholdComparator
    expected_value: CommonContractTextV1MetricValue
    unit: BenchmarkCaseV1MetricUnit

class BenchmarkCaseV1(ContractModel):
    "Immutable expected behavior, threshold, corpus, environment, and provenance contract for one future benchmark case."

    case_id: CommonStableIdV1StableId
    case_schema_version: Literal["BENCHMARK_CASE_V1"]
    benchmark_family: BenchmarkCaseV1BenchmarkFamily
    corpus_version: CommonContractTextV1VersionText
    corpus_digest: CommonProvenanceV1ContentDigest
    input_artifacts: Annotated[list[BenchmarkCaseV1InputArtifact], MinLen(1), MaxLen(32)]
    expected_behavior: BenchmarkCaseV1ExpectedBehavior
    threshold_set_ref: CommonStableIdV1StableId
    threshold_set_digest: CommonProvenanceV1ContentDigest
    thresholds: Annotated[list[BenchmarkCaseV1Threshold], MinLen(1), MaxLen(64)]
    environment_requirements: BenchmarkCaseV1EnvironmentRequirements
    synthetic_data: bool
    provenance: CommonProvenanceV1Provenance
    holdout_visibility: Literal["OWNER_CONTROLLED_HIDDEN", "PUBLIC_SYNTHETIC", "REVIEWER_ONLY"]
    applicable_platform_profiles: Annotated[list[CommonEnumTokenV1EnumToken], MinLen(1), MaxLen(16)]
