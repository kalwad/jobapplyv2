/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/schema-version.v1.schema.json
 * Schema id: urn:japp:schema:common:schema-version:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Canonical schema identifier
 *
 * Repository-controlled URN naming one schema document and its major version.
 *
 * Pattern: ^urn:japp:schema:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*:v(0|[1-9][0-9]*)$
 */
export type CommonSchemaVersionV1SchemaId = string;

/**
 * Schema version triple
 *
 * Strict MAJOR.MINOR.PATCH with no leading zeros, prerelease tags, or build metadata.
 *
 * Pattern: ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$
 */
export type CommonSchemaVersionV1SchemaVersion = string;
