"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/benchmark/result.v1.schema.json
Schema id: urn:japp:schema:benchmark:result:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.benchmark.case_v1 import BenchmarkCaseV1MetricUnit
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1GitObjectId, CommonContractTextV1MetricValue, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode

BenchmarkResultV1CompletenessState = Literal["COMPLETE", "FAILED_SETUP", "PARTIAL"]

BenchmarkResultV1EnvironmentMatchState = Literal["MATCH", "MISMATCH", "UNKNOWN"]

BenchmarkResultV1HashState = Literal["MATCH", "MISMATCH", "UNKNOWN"]

BenchmarkResultV1HoldoutState = Literal["INVALID", "NOT_APPLICABLE", "UNAVAILABLE", "VALID"]

class BenchmarkResultV1MetricResult(ContractModel):
    "Measured result for one immutable benchmark case. A result cannot alter thresholds or change a critical gate."

    metric_id: CommonEnumTokenV1EnumToken
    measured_value: CommonContractTextV1MetricValue
    unit: BenchmarkCaseV1MetricUnit
    threshold_digest: CommonProvenanceV1ContentDigest
    passed: bool

class BenchmarkResultV1RuntimeMetadata(ContractModel):
    "Measured result for one immutable benchmark case. A result cannot alter thresholds or change a critical gate."

    runtime_family: CommonEnumTokenV1EnumToken
    runtime_version: CommonContractTextV1BoundedToken
    toolchain_digest: CommonProvenanceV1ContentDigest
    platform_profile: CommonEnumTokenV1EnumToken
    model_digest: CommonProvenanceV1ContentDigest | None = None
    adapter_version: CommonContractTextV1VersionText | None = None
    browser_family: CommonEnumTokenV1EnumToken | None = None
    browser_version: CommonContractTextV1BoundedToken | None = None
    operating_system: CommonEnumTokenV1EnumToken | None = None
    architecture: CommonEnumTokenV1EnumToken | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("model_digest", "adapter_version", "browser_family", "browser_version", "operating_system", "architecture",),
        )

class BenchmarkResultV1(ContractModel):
    "Measured result for one immutable benchmark case. A result cannot alter thresholds or change a critical gate."

    result_id: CommonStableIdV1StableId
    case_id: CommonStableIdV1StableId
    case_digest: CommonProvenanceV1ContentDigest
    repository_commit: CommonContractTextV1GitObjectId
    repository_tree: CommonContractTextV1GitObjectId
    schema_manifest_digest: CommonProvenanceV1ContentDigest
    generator_format_version: CommonContractTextV1VersionText
    corpus_digest: CommonProvenanceV1ContentDigest
    holdout_manifest_digest: CommonProvenanceV1ContentDigest
    runtime_metadata: BenchmarkResultV1RuntimeMetadata
    started_at: CommonTimestampUtcV1UtcTimestamp
    ended_at: CommonTimestampUtcV1UtcTimestamp
    duration_ms: Annotated[int, Ge(0), Le(86400000)]
    metric_results: Annotated[list[BenchmarkResultV1MetricResult], MinLen(1), MaxLen(128)]
    case_threshold_set_digest: CommonProvenanceV1ContentDigest
    evaluated_threshold_set_digest: CommonProvenanceV1ContentDigest
    failure_error_codes: Annotated[list[ErrorTaxonomyV1ErrorCode], MinLen(0), MaxLen(16)]
    artifact_report_digests: Annotated[list[CommonProvenanceV1ContentDigest], MinLen(1), MaxLen(64)]
    completeness_state: BenchmarkResultV1CompletenessState
    environment_match_state: BenchmarkResultV1EnvironmentMatchState
    hash_state: BenchmarkResultV1HashState
    holdout_state: BenchmarkResultV1HoldoutState
    comparable: bool
    comparison_baseline_ref: CommonStableIdV1StableId | None = None
    overall_outcome: Literal["FAIL", "INVALID", "PASS"]

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("comparison_baseline_ref",),
        )
