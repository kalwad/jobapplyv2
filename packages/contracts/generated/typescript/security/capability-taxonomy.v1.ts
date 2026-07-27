/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/security/capability-taxonomy.v1.schema.json
 * Schema id: urn:japp:schema:security:capability-taxonomy:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";

/**
 * Authorization profile identifier
 *
 * Closed policy context. This is not an application-plan, guided-run, benchmark, or platform-profile schema.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCapabilityTaxonomyV1AuthorizationProfileId = "FEASIBILITY" | "GUIDED_PRE_SUBMIT" | "PRODUCTION_NO_SUBMIT" | "VERIFICATION";

/**
 * Capability identifier
 *
 * Stable visibly namespaced UPPER_SNAKE_CASE authority class.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCapabilityTaxonomyV1CapabilityId = "ARTIFACT_READ" | "ARTIFACT_WRITE" | "MODEL_INFERENCE" | "PAGE_DOCUMENT_UPLOAD" | "PAGE_INSPECT" | "PAGE_MUTATE_BOUNDED" | "PAGE_NAVIGATE_BOUNDED" | "PAGE_VALIDATE_RECONCILE_REVIEW" | "PLATFORM_BROWSER_RUNTIME_DISCOVERY" | "PLATFORM_NATIVE_MESSAGING_REGISTRATION" | "PLATFORM_PROCESS_SUPERVISION" | "PLATFORM_SECRET_STORE_ACCESS" | "PRIVATE_DATA_READ" | "PRIVATE_DATA_WRITE" | "PUBLIC_JOB_INDEX_READ" | "SUBMISSION_FINAL" | "VERIFICATION_EXECUTION" | "WORKFLOW_CONTROL";

/**
 * Software principal identifier
 *
 * Closed vocabulary for actual architectural components. The user is intentionally not an omnipotent software principal.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCapabilityTaxonomyV1PrincipalId = "DESKTOP_APP" | "EXTENSION_CONTENT_SCRIPT" | "EXTENSION_SERVICE_WORKER" | "MODEL_RUNTIME" | "NATIVE_HOST" | "ORCHESTRATOR" | "PLATFORM_ADAPTER" | "PUBLIC_JOB_INDEX" | "VERIFICATION_HARNESS";

/**
 * Capability catalog entry
 */
export interface SecurityCapabilityTaxonomyV1CapabilityEntry {
  readonly id: SecurityCapabilityTaxonomyV1CapabilityId;
  /**
   * Bounded authority represented by the capability.
   *
   * Minimum length: 1.
   * Maximum length: 300.
   */
  readonly description: string;
  /**
   * Explicit authorities or payload forms this capability does not grant.
   *
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly non_goals: readonly string[];
}

/**
 * Principal catalog entry
 */
export interface SecurityCapabilityTaxonomyV1PrincipalEntry {
  readonly id: SecurityCapabilityTaxonomyV1PrincipalId;
  /**
   * Architectural component represented by the principal.
   *
   * Minimum length: 1.
   * Maximum length: 300.
   */
  readonly description: string;
  /**
   * Authority the principal does not acquire merely by existing or forwarding.
   *
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly non_goals: readonly string[];
}

/**
 * Authorization-profile catalog entry
 */
export interface SecurityCapabilityTaxonomyV1ProfileEntry {
  readonly id: SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  /**
   * Bounded policy context represented by the profile.
   *
   * Minimum length: 1.
   * Maximum length: 300.
   */
  readonly description: string;
  /**
   * Authority the profile deliberately does not enable.
   *
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly non_goals: readonly string[];
}

/**
 * Capability, principal, and authorization-profile taxonomy
 *
 * Closed M01-W04 vocabulary and canonical catalog shape for software principals, authorization profiles, and bounded authority classes. The committed capability-catalog.v1.json instance must agree exactly with these enums. Capabilities name one narrow authority class and never carry paths, selectors, scripts, shell commands, SQL, registry data, secrets, or other executable payloads.
 */
export interface SecurityCapabilityTaxonomyV1 {
  readonly catalog_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Every declared software principal, sorted by id.
   *
   * Minimum items: 9.
   * Maximum items: 9.
   */
  readonly principals: readonly SecurityCapabilityTaxonomyV1PrincipalEntry[];
  /**
   * Every current authorization profile, sorted by id.
   *
   * Minimum items: 4.
   * Maximum items: 4.
   */
  readonly profiles: readonly SecurityCapabilityTaxonomyV1ProfileEntry[];
  /**
   * Every bounded capability, sorted by id.
   *
   * Minimum items: 18.
   * Maximum items: 18.
   */
  readonly capabilities: readonly SecurityCapabilityTaxonomyV1CapabilityEntry[];
}
