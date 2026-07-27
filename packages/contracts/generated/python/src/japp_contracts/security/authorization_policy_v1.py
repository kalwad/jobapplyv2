"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/security/authorization-policy.v1.schema.json
Schema id: urn:japp:schema:security:authorization-policy:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field

from japp_contracts._runtime import ContractModel
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaVersion
from japp_contracts.security.capability_taxonomy_v1 import SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId
from japp_contracts.security.command_taxonomy_v1 import SecurityCommandTaxonomyV1CommandId

class SecurityAuthorizationPolicyV1AuthorizationAllowRow(ContractModel):
    "Canonical M01-W04 positive allowlist. Each row authorizes one exact profile, command, preserved origin, immediate sender, trusted receiver, and final target tuple. Absence denies. Wildcards, regexes, inheritance, transitive authority, caller-supplied decisions, and negative rows are not representable. The generator independently enforces architectural prohibitions and complete forwarding routes."

    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    command_id: SecurityCommandTaxonomyV1CommandId
    originating_principal: SecurityCapabilityTaxonomyV1PrincipalId
    immediate_sender: SecurityCapabilityTaxonomyV1PrincipalId
    receiving_principal: Annotated[SecurityCapabilityTaxonomyV1PrincipalId, Field(description="Trusted runtime context for the component evaluating this hop; not caller metadata.")]
    target_principal: SecurityCapabilityTaxonomyV1PrincipalId

class SecurityAuthorizationPolicyV1(ContractModel):
    "Canonical M01-W04 positive allowlist. Each row authorizes one exact profile, command, preserved origin, immediate sender, trusted receiver, and final target tuple. Absence denies. Wildcards, regexes, inheritance, transitive authority, caller-supplied decisions, and negative rows are not representable. The generator independently enforces architectural prohibitions and complete forwarding routes."

    policy_version: CommonSchemaVersionV1SchemaVersion
    allow: Annotated[Annotated[list[SecurityAuthorizationPolicyV1AuthorizationAllowRow], MinLen(1), MaxLen(500)], Field(description="Exact positive rows sorted by profile, command, origin, sender, receiver, and target.")]
