/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/semantic/rule-catalog.v1.schema.json
 * Schema id: urn:japp:schema:semantic:rule-catalog:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1SchemaReference, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

/**
 * Finite semantic rule kind
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SemanticRuleCatalogV1RuleKind = "APPLICATION_SESSION_CONSISTENCY" | "ATOMIC_CLAIM_INTEGRITY" | "ATS_VARIANT_SCOPE" | "BENCHMARK_CASE_INTEGRITY" | "BENCHMARK_RESULT_INTEGRITY" | "DRIVER_VERIFIED_EVIDENCE" | "FIELD_ADDRESS_IDENTITY" | "FIELD_DECISION_AUTHORITY" | "FIELD_DESCRIPTOR_OBSERVATION" | "GATE_DECISION_INTEGRITY" | "GATE_EVIDENCE_COMPLETENESS" | "GUIDED_RUN_SAFETY" | "HOLDOUT_MANIFEST_INTEGRITY" | "INERT_TEXT_SAFETY" | "LAYOUT_MEASUREMENT_INTEGRITY" | "NAVIGATION_SAFETY" | "PAGE_READINESS_INTEGRITY" | "PLATFORM_BROWSER_DISCOVERY_SAFETY" | "PLATFORM_BROWSER_RECORD_SCOPE" | "PLATFORM_CAPABILITY_REPORT_INTEGRITY" | "PLATFORM_CERTIFICATION_INPUT_SCOPE" | "PLATFORM_DIAGNOSTIC_INTEGRITY" | "PLATFORM_EVIDENCE_INTEGRITY" | "PLATFORM_MODEL_PROFILE_EVIDENCE" | "PLATFORM_NATIVE_REGISTRATION_BINDING" | "PLATFORM_NATIVE_REGISTRATION_RESULT" | "PLATFORM_PACKAGE_STATE_EVIDENCE" | "PLATFORM_PATH_REQUEST_SAFETY" | "PLATFORM_PATH_RESOLUTION_SAFETY" | "PLATFORM_PROCESS_PLAN_SAFETY" | "PLATFORM_PROCESS_STATUS_INTEGRITY" | "PLATFORM_RUNTIME_CAPABILITY_FALLBACK" | "PLATFORM_SECRET_REQUEST_AUTHORITY" | "PLATFORM_SECRET_RESULT_INTEGRITY" | "PLATFORM_TARGET_SUPPORT_CLAIM" | "RECONCILIATION_READINESS" | "RESUME_PLAN_EVIDENCE" | "WORKDAY_CERTIFICATION_SCOPE" | "WORKDAY_STEP_BOUNDARY" | "WORKDAY_TENANT_IDENTITY";

/**
 * One semantic rule binding
 */
export interface SemanticRuleCatalogV1RuleEntry {
  readonly rule_id: CommonEnumTokenV1EnumToken;
  readonly rule_version: CommonContractTextV1VersionText;
  readonly schema_ref: CommonContractTextV1SchemaReference;
  readonly rule_kind: SemanticRuleCatalogV1RuleKind;
  readonly failure_error_code: ErrorTaxonomyV1ErrorCode;
}

/**
 * Semantic rule catalog
 *
 * Closed reviewed mapping from contract roots to finite built-in semantic rule kinds. It contains no paths, operators, expressions, code, or executable content.
 */
export interface SemanticRuleCatalogV1 {
  readonly catalog_version: CommonContractTextV1VersionText;
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly entries: readonly SemanticRuleCatalogV1RuleEntry[];
}
