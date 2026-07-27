/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/error/catalog.v1.schema.json
 * Schema id: urn:japp:schema:error:catalog:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonRedactionV1RedactionPolicy } from "../common/redaction.v1.ts";
import type { CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";
import type { ErrorTaxonomyV1ErrorCode, ErrorTaxonomyV1ErrorFamily, ErrorTaxonomyV1ErrorOrigin, ErrorTaxonomyV1ErrorSeverity, ErrorTaxonomyV1MessageKey, ErrorTaxonomyV1RetryDisposition, ErrorTaxonomyV1UserSafeMessage } from "../error/taxonomy.v1.ts";

/**
 * Error-catalog entry
 */
export interface ErrorCatalogV1CatalogEntry {
  /**
   * Stable family-prefixed error code this entry defines.
   */
  readonly code: ErrorTaxonomyV1ErrorCode;
  /**
   * Owning family; must equal the code's prefix (enforced by the generator).
   */
  readonly family: ErrorTaxonomyV1ErrorFamily;
  /**
   * Stable localization key deterministically derived from the code.
   */
  readonly message_key: ErrorTaxonomyV1MessageKey;
  /**
   * Safe default English user message; linted against interpolation, HTML, URLs, paths, stack traces, and control characters.
   */
  readonly default_message: ErrorTaxonomyV1UserSafeMessage;
  /**
   * Optional actionable, non-deceptive remediation description shown alongside the default message.
   */
  readonly remediation?: ErrorTaxonomyV1UserSafeMessage;
  readonly severity: ErrorTaxonomyV1ErrorSeverity;
  readonly retry_disposition: ErrorTaxonomyV1RetryDisposition;
  /**
   * Whether safe progress requires an explicit user action.
   */
  readonly user_action_required: boolean;
  /**
   * Whether the condition is expected to clear on its own.
   */
  readonly transient: boolean;
  /**
   * How diagnostics/logging must treat details of this condition; reuses the canonical redaction vocabulary. Internal diagnostic data is separate, redacted, and bounded — it never becomes user-facing text automatically.
   */
  readonly diagnostic_policy: CommonRedactionV1RedactionPolicy;
  /**
   * Component or trust boundary that primarily raises this code, where one applies.
   */
  readonly owning_boundary?: ErrorTaxonomyV1ErrorOrigin;
  /**
   * Catalog version that introduced this entry.
   */
  readonly added_in: CommonSchemaVersionV1SchemaVersion;
  /**
   * Catalog version that deprecated this entry; the code remains defined for the rest of its major version.
   */
  readonly deprecated_since?: CommonSchemaVersionV1SchemaVersion;
}

/**
 * Canonical error-catalog document
 *
 * Structure of the canonical machine-readable error catalog (M01-W03). The single committed instance lives at packages/contracts/catalog/error-catalog.v1.json and is the one source of truth for every error code's metadata: stable message key, safe default English user message, optional remediation, severity, retry/recovery disposition, user-action and transience flags, diagnostic/logging policy, optional owning boundary, and version/deprecation metadata. The contract generator validates the instance against this schema through the strict catalog validator, enforces catalog integrity (unique codes, exact agreement with the taxonomy errorCode enum, family-prefix consistency, deterministic message keys, user-safe message lint, family invariants), and derives the generated TypeScript and Python catalog surfaces from it — independent handwritten per-language catalogs are prohibited. Entry evolution: adding an entry (with its code) is a MINOR change; removing, renaming, or semantically reassigning an entry is a MAJOR change; a deprecated entry keeps deprecated_since and remains defined for the rest of its major version.
 */
export interface ErrorCatalogV1 {
  /**
   * Version triple of this catalog instance; its major must match this schema's major.
   */
  readonly catalog_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Every catalog entry, exactly one per taxonomy error code, sorted by code in ascending code-point order.
   *
   * Minimum items: 1.
   */
  readonly entries: readonly ErrorCatalogV1CatalogEntry[];
}
