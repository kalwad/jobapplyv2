/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/desktop/service-diagnostics.v1.schema.json
 * Schema id: urn:japp:schema:desktop:service-diagnostics:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";

/**
 * Point-in-time native local service diagnostics
 *
 * Closed secret-free native observation. READY requires authenticated health/readiness/version on one proven native stream. Other states reflect actual native lifecycle or cancellation; browser preview never synthesizes READY. Standard envelope metadata carries native correlation and creation time.
 */
export type DesktopServiceDiagnosticsV1 = {
  /**
   * Pattern: ^req_[0-9A-HJKMNP-TV-Z]{26}$
   * Minimum length: 30.
   * Maximum length: 30.
   */
  readonly request_id: string;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly state: "READY";
  readonly service_version: CommonContractTextV1VersionText;
  readonly api_version: CommonContractTextV1VersionText;
} | {
  /**
   * Pattern: ^req_[0-9A-HJKMNP-TV-Z]{26}$
   * Minimum length: 30.
   * Maximum length: 30.
   */
  readonly request_id: string;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly state: "UNAVAILABLE" | "STARTING" | "STOPPING" | "STOPPED" | "FAILED" | "CLEANUP_FAILED" | "CANCELLED";
};
