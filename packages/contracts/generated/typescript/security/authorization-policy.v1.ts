/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/security/authorization-policy.v1.schema.json
 * Schema id: urn:japp:schema:security:authorization-policy:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";
import type { SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId } from "../security/capability-taxonomy.v1.ts";
import type { SecurityCommandTaxonomyV1CommandId } from "../security/command-taxonomy.v1.ts";

/**
 * Exact authorization allow row
 */
export interface SecurityAuthorizationPolicyV1AuthorizationAllowRow {
  readonly authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly command_id: SecurityCommandTaxonomyV1CommandId;
  readonly originating_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly immediate_sender: SecurityCapabilityTaxonomyV1PrincipalId;
  /**
   * Trusted runtime context for the component evaluating this hop; not caller metadata.
   */
  readonly receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly target_principal: SecurityCapabilityTaxonomyV1PrincipalId;
}

/**
 * Default-deny authorization policy
 *
 * Canonical M01-W04 positive allowlist. Each row authorizes one exact profile, command, preserved origin, immediate sender, trusted receiver, and final target tuple. Absence denies. Wildcards, regexes, inheritance, transitive authority, caller-supplied decisions, and negative rows are not representable. The generator independently enforces architectural prohibitions and complete forwarding routes.
 */
export interface SecurityAuthorizationPolicyV1 {
  readonly policy_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Exact positive rows sorted by profile, command, origin, sender, receiver, and target.
   *
   * Minimum items: 1.
   * Maximum items: 500.
   */
  readonly allow: readonly SecurityAuthorizationPolicyV1AuthorizationAllowRow[];
}
