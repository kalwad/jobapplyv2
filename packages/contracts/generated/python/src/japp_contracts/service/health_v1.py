"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/service/health.v1.schema.json
Schema id: urn:japp:schema:service:health:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le

from japp_contracts._runtime import ContractModel
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

class ServiceHealthV1(ContractModel):
    "Authenticated local service skeleton state. This reports only service lifecycle and does not certify database, AI, platform or product readiness."

    status: Literal["LIVE"]
    scope: Literal["SERVICE_SKELETON"]
    instance_id: CommonStableIdV1StableId
    generation: Annotated[int, Ge(0), Le(2147483647)]
