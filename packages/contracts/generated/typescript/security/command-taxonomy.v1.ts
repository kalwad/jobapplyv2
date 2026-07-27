/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/security/command-taxonomy.v1.schema.json
 * Schema id: urn:japp:schema:security:command-taxonomy:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";
import type { SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1CapabilityId, SecurityCapabilityTaxonomyV1PrincipalId } from "../security/capability-taxonomy.v1.ts";

/**
 * Command identifier
 *
 * Stable bounded authorization command.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCommandTaxonomyV1CommandId = "ARTIFACT_READ_REQUEST" | "ARTIFACT_WRITE_REQUEST" | "MODEL_INFERENCE_REQUEST" | "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS" | "PAGE_NAVIGATE_BACK" | "PAGE_NAVIGATE_NEXT" | "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS" | "PAGE_RECONCILE_STATE" | "PAGE_REPORT_FINAL_REVIEW" | "PAGE_REPORT_STATE" | "PAGE_SCAN_VISIBLE_CONTROLS" | "PAGE_UPLOAD_REVIEWED_DOCUMENT" | "PAGE_VERIFY_FIELD_VALUES" | "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST" | "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST" | "PLATFORM_PROCESS_SUPERVISION_REQUEST" | "PLATFORM_SECRET_STORE_REQUEST" | "PRIVATE_DATA_READ_REQUEST" | "PRIVATE_DATA_WRITE_REQUEST" | "PUBLIC_JOB_INDEX_QUERY" | "SUBMISSION_FINAL_SUBMIT" | "VERIFICATION_RUN_SYNTHETIC_SUITE" | "WORKFLOW_CANCEL" | "WORKFLOW_PAUSE";

/**
 * Command consequence class
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCommandTaxonomyV1ConsequenceClass = "CONSEQUENTIAL_FINAL_ACTION" | "CONTROL_FLOW" | "PLATFORM_SERVICE" | "READ_ONLY" | "REVERSIBLE_MUTATION" | "SENSITIVE_SERVICE" | "SYNTHETIC_VERIFICATION";

/**
 * Command idempotency expectation
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SecurityCommandTaxonomyV1IdempotencyExpectation = "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENT" | "NOT_REPEATABLE";

/**
 * Command catalog entry
 */
export interface SecurityCommandTaxonomyV1CommandEntry {
  readonly id: SecurityCommandTaxonomyV1CommandId;
  readonly required_capability: SecurityCapabilityTaxonomyV1CapabilityId;
  /**
   * Final principal that may execute the command. Intermediate receivers may only proxy an exact authorized route.
   */
  readonly intended_target: SecurityCapabilityTaxonomyV1PrincipalId;
  /**
   * Closed profiles in which the command may potentially have allow rows. An empty set means known but currently ungrantable.
   *
   * Minimum items: 0.
   * Maximum items: 4.
   */
  readonly supported_profiles: readonly SecurityCapabilityTaxonomyV1AuthorizationProfileId[];
  /**
   * Exact inclusive maximum encoded payload size. Authorization compares request metadata to this command-derived limit before dispatch.
   *
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 1048576.
   */
  readonly max_encoded_payload_size_bytes: number;
  readonly consequence_class: SecurityCommandTaxonomyV1ConsequenceClass;
  readonly idempotency_expectation: SecurityCommandTaxonomyV1IdempotencyExpectation;
  /**
   * Stable M01-W03 error code returned when a well-formed request lacks an exact allow row.
   */
  readonly denial_error_code: ErrorTaxonomyV1ErrorCode;
  /**
   * Bounded authorization represented by the command.
   *
   * Minimum length: 1.
   * Maximum length: 400.
   */
  readonly description: string;
  /**
   * Explicit behavior and payload forms the command does not authorize.
   *
   * Minimum items: 1.
   * Maximum items: 10.
   */
  readonly non_goals: readonly string[];
}

/**
 * Bounded command taxonomy and catalog
 *
 * Canonical M01-W04 command-catalog shape. Every known command maps to exactly one bounded capability, one final target principal, a closed supported-profile set, one exact encoded-payload byte limit, one consequence class, one idempotency expectation, and one safe denial code from the M01-W03 taxonomy. This taxonomy names authorization classes only; detailed command payloads remain owned by later packages.
 */
export interface SecurityCommandTaxonomyV1 {
  readonly catalog_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Every declared command, sorted by id.
   *
   * Minimum items: 24.
   * Maximum items: 24.
   */
  readonly commands: readonly SecurityCommandTaxonomyV1CommandEntry[];
}
