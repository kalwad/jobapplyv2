/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/service/health.v1.schema.json
 * Schema id: urn:japp:schema:service:health:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Service health payload
 *
 * Authenticated local service skeleton state. This reports only service lifecycle and does not certify database, AI, platform or product readiness.
 */
export interface ServiceHealthV1 {
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly status: "LIVE";
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly scope: "SERVICE_SKELETON";
  readonly instance_id: CommonStableIdV1StableId;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 2147483647.
   */
  readonly generation: number;
}
