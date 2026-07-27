/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/timestamp-utc.v1.schema.json
 * Schema id: urn:japp:schema:common:timestamp-utc:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * UTC timestamp
 *
 * Format: date-time (calendar-valid, full assertion).
 * Pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$
 */
export type CommonTimestampUtcV1UtcTimestamp = string;
