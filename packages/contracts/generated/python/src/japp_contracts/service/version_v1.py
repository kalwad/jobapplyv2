"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/service/version.v1.schema.json
Schema id: urn:japp:schema:service:version:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le
from pydantic import StringConstraints

from japp_contracts._runtime import ContractModel
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaVersion
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

class ServiceVersionV1(ContractModel):
    "Actual installed orchestrator distribution version and the exact local API version. No platform or AI capability is inferred."

    service_version: CommonSchemaVersionV1SchemaVersion
    api_version: Annotated[str, StringConstraints(pattern="^1\\.0\\.0$", min_length=5, max_length=5)]
    instance_id: CommonStableIdV1StableId
    generation: Annotated[int, Ge(0), Le(2147483647)]
