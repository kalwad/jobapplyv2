/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/desktop/service-request.v1.schema.json
 * Schema id: urn:japp:schema:desktop:service-request:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Finite native service request
 *
 * Closed desktop command payload. Its opaque identifier correlates cancellation; it conveys no service URL, token, port, executable path or arbitrary operation.
 */
export interface DesktopServiceRequestV1 {
  /**
   * Pattern: ^req_[0-9A-HJKMNP-TV-Z]{26}$
   * Minimum length: 30.
   * Maximum length: 30.
   */
  readonly request_id: string;
}
