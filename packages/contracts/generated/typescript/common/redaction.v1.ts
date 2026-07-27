/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/redaction.v1.schema.json
 * Schema id: urn:japp:schema:common:redaction:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Redaction policy
 *
 * NONE: value may appear verbatim in diagnostics. REDACT_VALUE: value must be replaced by a fixed placeholder. HASH_ONLY: only a digest of the value may appear. FORBID_CAPTURE: the value must never be captured into diagnostics, logs, analytics, or error reports at all.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type CommonRedactionV1RedactionPolicy = "NONE" | "REDACT_VALUE" | "HASH_ONLY" | "FORBID_CAPTURE";

/**
 * Sensitivity class
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type CommonRedactionV1SensitivityClass = "PUBLIC" | "INTERNAL" | "PERSONAL" | "SENSITIVE" | "SECRET";

/**
 * Redaction annotation
 */
export interface CommonRedactionV1RedactionAnnotation {
  readonly sensitivity: CommonRedactionV1SensitivityClass;
  readonly policy: CommonRedactionV1RedactionPolicy;
}
