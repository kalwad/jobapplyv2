/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/location.v1.schema.json
 * Schema id: urn:japp:schema:common:location:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Country code (syntactic ISO 3166-1 alpha-2 shape)
 *
 * Pattern: ^[A-Z]{2}$
 */
export type CommonLocationV1CountryCode = string;

/**
 * Structured location
 */
export interface CommonLocationV1StructuredLocation {
  readonly country: CommonLocationV1CountryCode;
  /**
   * State, province, or first-level administrative division name.
   *
   * Minimum length: 1.
   * Maximum length: 100.
   */
  readonly region?: string;
  /**
   * City, town, or equivalent locality name.
   *
   * Minimum length: 1.
   * Maximum length: 100.
   */
  readonly locality?: string;
  /**
   * Postal or ZIP code; shape-checked only.
   *
   * Pattern: ^[A-Za-z0-9][A-Za-z0-9 -]{0,15}$
   */
  readonly postal_code?: string;
}
