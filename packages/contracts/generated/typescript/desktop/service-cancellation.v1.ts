/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/desktop/service-cancellation.v1.schema.json
 * Schema id: urn:japp:schema:desktop:service-cancellation:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Finite service cancellation receipt
 *
 * Native acknowledges a cancellation request, including a cancellation arriving before read registration. It never claims a completed cancellation merely because a command was delivered.
 */
export interface DesktopServiceCancellationV1 {
  /**
   * Pattern: ^req_[0-9A-HJKMNP-TV-Z]{26}$
   * Minimum length: 30.
   * Maximum length: 30.
   */
  readonly request_id: string;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly outcome: "CANCELLATION_REQUESTED" | "ALREADY_FINISHED";
}
