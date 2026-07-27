"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/security/authorization-request.v1.schema.json
Schema id: urn:japp:schema:security:authorization-request:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le
from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.security.capability_taxonomy_v1 import SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId
from japp_contracts.security.command_taxonomy_v1 import SecurityCommandTaxonomyV1CommandId

class SecurityAuthorizationRequestV1(ContractModel):
    "Strict closed M01-W04 request envelope containing authorization metadata only. Required capability, decision, and denial text are derived from canonical catalogs and cannot be supplied by callers. The receiver principal is trusted runtime context passed separately to authorization and is deliberately absent from this untrusted wire record."

    request_version: Annotated[Literal["AUTHORIZATION_REQUEST_V1"], Field(description="Authorization-request record version.")]
    request_id: CommonStableIdV1StableId
    command_id: SecurityCommandTaxonomyV1CommandId
    originating_principal: Annotated[SecurityCapabilityTaxonomyV1PrincipalId, Field(description="Original software requester. Forwarders must preserve this value unchanged and authorization requires equality with trusted authenticated-origin context.")]
    immediate_sender: Annotated[SecurityCapabilityTaxonomyV1PrincipalId, Field(description="Principal sending this exact hop; never substitutes for the origin when deciding authority.")]
    target_principal: Annotated[SecurityCapabilityTaxonomyV1PrincipalId, Field(description="Final executing principal; must equal the command catalog's intended target.")]
    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    occurred_at: CommonTimestampUtcV1UtcTimestamp
    correlation_id: CommonCorrelationV1CorrelationId
    causation_id: CommonCorrelationV1CausationId | None = None
    payload_size_bytes: Annotated[Annotated[int, Ge(0), Le(9007199254740991)], Field(description="Exact encoded payload size metadata. The payload itself is not permitted in this record; authorization requires equality with the receiving transport's independently observed byte count.")]
    payload_digest: Annotated[Annotated[str, StringConstraints(pattern="^sha256:[0-9a-f]{64}$")], Field(description="Optional lowercase SHA-256 digest label for integrity correlation; never authorization authority.")] | None = None
    idempotency_key: Annotated[CommonStableIdV1StableId, Field(description="Optional opaque key required only when the command catalog says so.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("causation_id", "payload_digest", "idempotency_key",),
        )
