"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/error/catalog.v1.schema.json
Schema id: urn:japp:schema:error:catalog:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.redaction_v1 import CommonRedactionV1RedactionPolicy
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaVersion
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode, ErrorTaxonomyV1ErrorFamily, ErrorTaxonomyV1ErrorOrigin, ErrorTaxonomyV1ErrorSeverity, ErrorTaxonomyV1MessageKey, ErrorTaxonomyV1RetryDisposition, ErrorTaxonomyV1UserSafeMessage

class ErrorCatalogV1CatalogEntry(ContractModel):
    "Structure of the canonical machine-readable error catalog (M01-W03). The single committed instance lives at packages/contracts/catalog/error-catalog.v1.json and is the one source of truth for every error code's metadata: stable message key, safe default English user message, optional remediation, severity, retry/recovery disposition, user-action and transience flags, diagnostic/logging policy, optional owning boundary, and version/deprecation metadata. The contract generator validates the instance against this schema through the strict catalog validator, enforces catalog integrity (unique codes, exact agreement with the taxonomy errorCode enum, family-prefix consistency, deterministic message keys, user-safe message lint, family invariants), and derives the generated TypeScript and Python catalog surfaces from it — independent handwritten per-language catalogs are prohibited. Entry evolution: adding an entry (with its code) is a MINOR change; removing, renaming, or semantically reassigning an entry is a MAJOR change; a deprecated entry keeps deprecated_since and remains defined for the rest of its major version."

    code: Annotated[ErrorTaxonomyV1ErrorCode, Field(description="Stable family-prefixed error code this entry defines.")]
    family: Annotated[ErrorTaxonomyV1ErrorFamily, Field(description="Owning family; must equal the code's prefix (enforced by the generator).")]
    message_key: Annotated[ErrorTaxonomyV1MessageKey, Field(description="Stable localization key deterministically derived from the code.")]
    default_message: Annotated[ErrorTaxonomyV1UserSafeMessage, Field(description="Safe default English user message; linted against interpolation, HTML, URLs, paths, stack traces, and control characters.")]
    remediation: Annotated[ErrorTaxonomyV1UserSafeMessage, Field(description="Optional actionable, non-deceptive remediation description shown alongside the default message.")] | None = None
    severity: ErrorTaxonomyV1ErrorSeverity
    retry_disposition: ErrorTaxonomyV1RetryDisposition
    user_action_required: Annotated[bool, Field(description="Whether safe progress requires an explicit user action.")]
    transient: Annotated[bool, Field(description="Whether the condition is expected to clear on its own.")]
    diagnostic_policy: Annotated[CommonRedactionV1RedactionPolicy, Field(description="How diagnostics/logging must treat details of this condition; reuses the canonical redaction vocabulary. Internal diagnostic data is separate, redacted, and bounded — it never becomes user-facing text automatically.")]
    owning_boundary: Annotated[ErrorTaxonomyV1ErrorOrigin, Field(description="Component or trust boundary that primarily raises this code, where one applies.")] | None = None
    added_in: Annotated[CommonSchemaVersionV1SchemaVersion, Field(description="Catalog version that introduced this entry.")]
    deprecated_since: Annotated[CommonSchemaVersionV1SchemaVersion, Field(description="Catalog version that deprecated this entry; the code remains defined for the rest of its major version.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("remediation", "owning_boundary", "deprecated_since",),
        )

class ErrorCatalogV1(ContractModel):
    "Structure of the canonical machine-readable error catalog (M01-W03). The single committed instance lives at packages/contracts/catalog/error-catalog.v1.json and is the one source of truth for every error code's metadata: stable message key, safe default English user message, optional remediation, severity, retry/recovery disposition, user-action and transience flags, diagnostic/logging policy, optional owning boundary, and version/deprecation metadata. The contract generator validates the instance against this schema through the strict catalog validator, enforces catalog integrity (unique codes, exact agreement with the taxonomy errorCode enum, family-prefix consistency, deterministic message keys, user-safe message lint, family invariants), and derives the generated TypeScript and Python catalog surfaces from it — independent handwritten per-language catalogs are prohibited. Entry evolution: adding an entry (with its code) is a MINOR change; removing, renaming, or semantically reassigning an entry is a MAJOR change; a deprecated entry keeps deprecated_since and remains defined for the rest of its major version."

    catalog_version: Annotated[CommonSchemaVersionV1SchemaVersion, Field(description="Version triple of this catalog instance; its major must match this schema's major.")]
    entries: Annotated[Annotated[list[ErrorCatalogV1CatalogEntry], MinLen(1)], Field(description="Every catalog entry, exactly one per taxonomy error code, sorted by code in ascending code-point order.")]
