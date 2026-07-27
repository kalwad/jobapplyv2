/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/security/authorization-request.v1.schema.json
 * Schema id: urn:japp:schema:security:authorization-request:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId } from "../security/capability-taxonomy.v1.ts";
import type { SecurityCommandTaxonomyV1CommandId } from "../security/command-taxonomy.v1.ts";

/**
 * Authorization request metadata
 *
 * Strict closed M01-W04 request envelope containing authorization metadata only. Required capability, decision, and denial text are derived from canonical catalogs and cannot be supplied by callers. The receiver principal is trusted runtime context passed separately to authorization and is deliberately absent from this untrusted wire record.
 */
export interface SecurityAuthorizationRequestV1 {
  /**
   * Authorization-request record version.
   *
   * Closed token set; undeclared tokens are rejected.
   */
  readonly request_version: "AUTHORIZATION_REQUEST_V1";
  readonly request_id: CommonStableIdV1StableId;
  readonly command_id: SecurityCommandTaxonomyV1CommandId;
  /**
   * Original software requester. Forwarders must preserve this value unchanged and authorization requires equality with trusted authenticated-origin context.
   */
  readonly originating_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  /**
   * Principal sending this exact hop; never substitutes for the origin when deciding authority.
   */
  readonly immediate_sender: SecurityCapabilityTaxonomyV1PrincipalId;
  /**
   * Final executing principal; must equal the command catalog's intended target.
   */
  readonly target_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly occurred_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
  /**
   * Exact encoded payload size metadata. The payload itself is not permitted in this record; authorization requires equality with the receiving transport's independently observed byte count.
   *
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 9007199254740991.
   */
  readonly payload_size_bytes: number;
  /**
   * Optional lowercase SHA-256 digest label for integrity correlation; never authorization authority.
   *
   * Pattern: ^sha256:[0-9a-f]{64}$
   */
  readonly payload_digest?: string;
  /**
   * Optional opaque key required only when the command catalog says so.
   */
  readonly idempotency_key?: CommonStableIdV1StableId;
}
