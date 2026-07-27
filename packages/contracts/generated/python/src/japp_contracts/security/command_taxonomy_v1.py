"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/security/command-taxonomy.v1.schema.json
Schema id: urn:japp:schema:security:command-taxonomy:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, StringConstraints

from japp_contracts._runtime import ContractModel
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaVersion
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode
from japp_contracts.security.capability_taxonomy_v1 import SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1CapabilityId, SecurityCapabilityTaxonomyV1PrincipalId

SecurityCommandTaxonomyV1CommandId = Literal["ARTIFACT_READ_REQUEST", "ARTIFACT_WRITE_REQUEST", "MODEL_INFERENCE_REQUEST", "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS", "PAGE_NAVIGATE_BACK", "PAGE_NAVIGATE_NEXT", "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS", "PAGE_RECONCILE_STATE", "PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE", "PAGE_SCAN_VISIBLE_CONTROLS", "PAGE_UPLOAD_REVIEWED_DOCUMENT", "PAGE_VERIFY_FIELD_VALUES", "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST", "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST", "PLATFORM_PROCESS_SUPERVISION_REQUEST", "PLATFORM_SECRET_STORE_REQUEST", "PRIVATE_DATA_READ_REQUEST", "PRIVATE_DATA_WRITE_REQUEST", "PUBLIC_JOB_INDEX_QUERY", "SUBMISSION_FINAL_SUBMIT", "VERIFICATION_RUN_SYNTHETIC_SUITE", "WORKFLOW_CANCEL", "WORKFLOW_PAUSE"]
"Stable bounded authorization command."

SecurityCommandTaxonomyV1ConsequenceClass = Literal["CONSEQUENTIAL_FINAL_ACTION", "CONTROL_FLOW", "PLATFORM_SERVICE", "READ_ONLY", "REVERSIBLE_MUTATION", "SENSITIVE_SERVICE", "SYNTHETIC_VERIFICATION"]

SecurityCommandTaxonomyV1IdempotencyExpectation = Literal["IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENT", "NOT_REPEATABLE"]

class SecurityCommandTaxonomyV1CommandEntry(ContractModel):
    "Canonical M01-W04 command-catalog shape. Every known command maps to exactly one bounded capability, one final target principal, a closed supported-profile set, one exact encoded-payload byte limit, one consequence class, one idempotency expectation, and one safe denial code from the M01-W03 taxonomy. This taxonomy names authorization classes only; detailed command payloads remain owned by later packages."

    id: SecurityCommandTaxonomyV1CommandId
    required_capability: SecurityCapabilityTaxonomyV1CapabilityId
    intended_target: Annotated[SecurityCapabilityTaxonomyV1PrincipalId, Field(description="Final principal that may execute the command. Intermediate receivers may only proxy an exact authorized route.")]
    supported_profiles: Annotated[Annotated[list[SecurityCapabilityTaxonomyV1AuthorizationProfileId], MinLen(0), MaxLen(4)], Field(description="Closed profiles in which the command may potentially have allow rows. An empty set means known but currently ungrantable.")]
    max_encoded_payload_size_bytes: Annotated[Annotated[int, Ge(0), Le(1048576)], Field(description="Exact inclusive maximum encoded payload size. Authorization compares request metadata to this command-derived limit before dispatch.")]
    consequence_class: SecurityCommandTaxonomyV1ConsequenceClass
    idempotency_expectation: SecurityCommandTaxonomyV1IdempotencyExpectation
    denial_error_code: Annotated[ErrorTaxonomyV1ErrorCode, Field(description="Stable M01-W03 error code returned when a well-formed request lacks an exact allow row.")]
    description: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=400)], Field(description="Bounded authorization represented by the command.")]
    non_goals: Annotated[Annotated[list[Annotated[str, StringConstraints(min_length=1, max_length=260)]], MinLen(1), MaxLen(10)], Field(description="Explicit behavior and payload forms the command does not authorize.")]

class SecurityCommandTaxonomyV1(ContractModel):
    "Canonical M01-W04 command-catalog shape. Every known command maps to exactly one bounded capability, one final target principal, a closed supported-profile set, one exact encoded-payload byte limit, one consequence class, one idempotency expectation, and one safe denial code from the M01-W03 taxonomy. This taxonomy names authorization classes only; detailed command payloads remain owned by later packages."

    catalog_version: CommonSchemaVersionV1SchemaVersion
    commands: Annotated[Annotated[list[SecurityCommandTaxonomyV1CommandEntry], MinLen(24), MaxLen(24)], Field(description="Every declared command, sorted by id.")]
