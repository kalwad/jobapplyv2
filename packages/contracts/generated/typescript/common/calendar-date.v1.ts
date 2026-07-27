/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/calendar-date.v1.schema.json
 * Schema id: urn:japp:schema:common:calendar-date:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Calendar date
 *
 * Format: date (calendar-valid, full assertion).
 * Pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}$
 */
export type CommonCalendarDateV1CalendarDate = string;
