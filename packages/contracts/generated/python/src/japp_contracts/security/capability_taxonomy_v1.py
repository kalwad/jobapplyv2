"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/security/capability-taxonomy.v1.schema.json
Schema id: urn:japp:schema:security:capability-taxonomy:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import Field, StringConstraints

from japp_contracts._runtime import ContractModel
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaVersion

SecurityCapabilityTaxonomyV1AuthorizationProfileId = Literal["FEASIBILITY", "GUIDED_PRE_SUBMIT", "PRODUCTION_NO_SUBMIT", "VERIFICATION"]
"Closed policy context. This is not an application-plan, guided-run, benchmark, or platform-profile schema."

SecurityCapabilityTaxonomyV1CapabilityId = Literal["ARTIFACT_READ", "ARTIFACT_WRITE", "MODEL_INFERENCE", "PAGE_DOCUMENT_UPLOAD", "PAGE_INSPECT", "PAGE_MUTATE_BOUNDED", "PAGE_NAVIGATE_BOUNDED", "PAGE_VALIDATE_RECONCILE_REVIEW", "PLATFORM_BROWSER_RUNTIME_DISCOVERY", "PLATFORM_NATIVE_MESSAGING_REGISTRATION", "PLATFORM_PROCESS_SUPERVISION", "PLATFORM_SECRET_STORE_ACCESS", "PRIVATE_DATA_READ", "PRIVATE_DATA_WRITE", "PUBLIC_JOB_INDEX_READ", "SUBMISSION_FINAL", "VERIFICATION_EXECUTION", "WORKFLOW_CONTROL"]
"Stable visibly namespaced UPPER_SNAKE_CASE authority class."

SecurityCapabilityTaxonomyV1PrincipalId = Literal["DESKTOP_APP", "EXTENSION_CONTENT_SCRIPT", "EXTENSION_SERVICE_WORKER", "MODEL_RUNTIME", "NATIVE_HOST", "ORCHESTRATOR", "PLATFORM_ADAPTER", "PUBLIC_JOB_INDEX", "VERIFICATION_HARNESS"]
"Closed vocabulary for actual architectural components. The user is intentionally not an omnipotent software principal."

class SecurityCapabilityTaxonomyV1CapabilityEntry(ContractModel):
    "Closed M01-W04 vocabulary and canonical catalog shape for software principals, authorization profiles, and bounded authority classes. The committed capability-catalog.v1.json instance must agree exactly with these enums. Capabilities name one narrow authority class and never carry paths, selectors, scripts, shell commands, SQL, registry data, secrets, or other executable payloads."

    id: SecurityCapabilityTaxonomyV1CapabilityId
    description: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=300)], Field(description="Bounded authority represented by the capability.")]
    non_goals: Annotated[Annotated[list[Annotated[str, StringConstraints(min_length=1, max_length=240)]], MinLen(1), MaxLen(8)], Field(description="Explicit authorities or payload forms this capability does not grant.")]

class SecurityCapabilityTaxonomyV1PrincipalEntry(ContractModel):
    "Closed M01-W04 vocabulary and canonical catalog shape for software principals, authorization profiles, and bounded authority classes. The committed capability-catalog.v1.json instance must agree exactly with these enums. Capabilities name one narrow authority class and never carry paths, selectors, scripts, shell commands, SQL, registry data, secrets, or other executable payloads."

    id: SecurityCapabilityTaxonomyV1PrincipalId
    description: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=300)], Field(description="Architectural component represented by the principal.")]
    non_goals: Annotated[Annotated[list[Annotated[str, StringConstraints(min_length=1, max_length=240)]], MinLen(1), MaxLen(8)], Field(description="Authority the principal does not acquire merely by existing or forwarding.")]

class SecurityCapabilityTaxonomyV1ProfileEntry(ContractModel):
    "Closed M01-W04 vocabulary and canonical catalog shape for software principals, authorization profiles, and bounded authority classes. The committed capability-catalog.v1.json instance must agree exactly with these enums. Capabilities name one narrow authority class and never carry paths, selectors, scripts, shell commands, SQL, registry data, secrets, or other executable payloads."

    id: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    description: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=300)], Field(description="Bounded policy context represented by the profile.")]
    non_goals: Annotated[Annotated[list[Annotated[str, StringConstraints(min_length=1, max_length=240)]], MinLen(1), MaxLen(8)], Field(description="Authority the profile deliberately does not enable.")]

class SecurityCapabilityTaxonomyV1(ContractModel):
    "Closed M01-W04 vocabulary and canonical catalog shape for software principals, authorization profiles, and bounded authority classes. The committed capability-catalog.v1.json instance must agree exactly with these enums. Capabilities name one narrow authority class and never carry paths, selectors, scripts, shell commands, SQL, registry data, secrets, or other executable payloads."

    catalog_version: CommonSchemaVersionV1SchemaVersion
    principals: Annotated[Annotated[list[SecurityCapabilityTaxonomyV1PrincipalEntry], MinLen(9), MaxLen(9)], Field(description="Every declared software principal, sorted by id.")]
    profiles: Annotated[Annotated[list[SecurityCapabilityTaxonomyV1ProfileEntry], MinLen(4), MaxLen(4)], Field(description="Every current authorization profile, sorted by id.")]
    capabilities: Annotated[Annotated[list[SecurityCapabilityTaxonomyV1CapabilityEntry], MinLen(18), MaxLen(18)], Field(description="Every bounded capability, sorted by id.")]
