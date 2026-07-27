"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/session/application-session.v1.schema.json
Schema id: urn:japp:schema:session:application-session:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.ats.variant_identity_v1 import AtsVariantIdentityV1
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1VersionText
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.security.capability_taxonomy_v1 import SecurityCapabilityTaxonomyV1AuthorizationProfileId
from japp_contracts.session.guided_run_mode_v1 import SessionGuidedRunModeV1
from japp_contracts.workday.step_identity_v1 import WorkdayStepIdentityV1
from japp_contracts.workday.tenant_fingerprint_v1 import WorkdayTenantFingerprintV1

SessionApplicationSessionV1RevalidationState = Literal["CURRENT", "EXPIRED", "REVALIDATED", "REVALIDATION_REQUIRED"]

class SessionApplicationSessionV1RuntimeMetadata(ContractModel):
    "Bounded application-session identity and lifecycle snapshot. It defines no run execution behavior."

    browser_family: CommonEnumTokenV1EnumToken
    browser_version: CommonContractTextV1BoundedToken
    runtime_family: CommonEnumTokenV1EnumToken
    runtime_version: CommonContractTextV1BoundedToken

SessionApplicationSessionV1SessionLifecycleState = Literal["ACTIVE", "CANCELED", "COMPLETED_PRE_SUBMIT", "EXPIRED", "PAUSED", "REVALIDATION_REQUIRED"]

class SessionApplicationSessionV1SnapshotDigests(ContractModel):
    "Bounded application-session identity and lifecycle snapshot. It defines no run execution behavior."

    profile_digest: CommonProvenanceV1ContentDigest
    document_digest: CommonProvenanceV1ContentDigest
    answer_policy_digest: CommonProvenanceV1ContentDigest

class SessionApplicationSessionV1(ContractModel):
    "Bounded application-session identity and lifecycle snapshot. It defines no run execution behavior."

    session_id: CommonStableIdV1StableId
    job_id: CommonStableIdV1StableId
    application_id: CommonStableIdV1StableId
    ats_variant: AtsVariantIdentityV1
    workday_tenant_fingerprint: WorkdayTenantFingerprintV1 | None = None
    guided_run_mode: SessionGuidedRunModeV1
    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    adapter_version: CommonContractTextV1VersionText
    runtime_metadata: SessionApplicationSessionV1RuntimeMetadata
    snapshot_digests: SessionApplicationSessionV1SnapshotDigests
    current_step: Annotated[WorkdayStepIdentityV1, Field(description="Current multi-signal application/boundary identity. M01-W06 first owns this ATS-neutral boundary vocabulary under the Workday contract family.")]
    current_page_generation: CommonContractTextV1NonNegativeSafeInteger
    correlation_id: CommonCorrelationV1CorrelationId
    lifecycle_state: SessionApplicationSessionV1SessionLifecycleState
    created_at: CommonTimestampUtcV1UtcTimestamp
    updated_at: CommonTimestampUtcV1UtcTimestamp
    pause_or_cancel_reason: CommonEnumTokenV1EnumToken | None = None
    revalidation_state: SessionApplicationSessionV1RevalidationState

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("workday_tenant_fingerprint", "pause_or_cancel_reason",),
        )
