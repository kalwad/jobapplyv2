/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/money.v1.schema.json
 * Schema id: urn:japp:schema:common:money:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Currency code (syntactic ISO 4217 shape)
 *
 * Pattern: ^[A-Z]{3}$
 */
export type CommonMoneyV1CurrencyCode = string;

/**
 * Decimal amount string
 *
 * Optional leading minus, integer part without leading zeros, optional fraction of 1-6 digits. No exponent, no plus sign, no grouping.
 *
 * Pattern: ^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$
 */
export type CommonMoneyV1DecimalAmount = string;

/**
 * Money value
 */
export interface CommonMoneyV1Money {
  readonly amount: CommonMoneyV1DecimalAmount;
  readonly currency: CommonMoneyV1CurrencyCode;
}
