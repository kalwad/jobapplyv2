/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Regenerate with: pnpm generate:contracts
 *
 * Source of truth: packages/contracts/catalog/semantic-rules.v1.json
 * Validated against: urn:japp:schema:semantic:rule-catalog:v1
 *
 * Structural validation must succeed before these finite semantic rules run.
 * Catalog content is inert data: no expression, path, operator, or code is
 * interpreted.
 */

import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

export type SemanticRuleKindV1 =
  | "APPLICATION_SESSION_CONSISTENCY"
  | "ATOMIC_CLAIM_INTEGRITY"
  | "ATS_VARIANT_SCOPE"
  | "BENCHMARK_CASE_INTEGRITY"
  | "BENCHMARK_RESULT_INTEGRITY"
  | "DRIVER_VERIFIED_EVIDENCE"
  | "FIELD_ADDRESS_IDENTITY"
  | "FIELD_DECISION_AUTHORITY"
  | "FIELD_DESCRIPTOR_OBSERVATION"
  | "GATE_DECISION_INTEGRITY"
  | "GATE_EVIDENCE_COMPLETENESS"
  | "GUIDED_RUN_SAFETY"
  | "HOLDOUT_MANIFEST_INTEGRITY"
  | "INERT_TEXT_SAFETY"
  | "LAYOUT_MEASUREMENT_INTEGRITY"
  | "NAVIGATION_SAFETY"
  | "PAGE_READINESS_INTEGRITY"
  | "PLATFORM_BROWSER_DISCOVERY_SAFETY"
  | "PLATFORM_BROWSER_RECORD_SCOPE"
  | "PLATFORM_CAPABILITY_REPORT_INTEGRITY"
  | "PLATFORM_CERTIFICATION_INPUT_SCOPE"
  | "PLATFORM_DIAGNOSTIC_INTEGRITY"
  | "PLATFORM_EVIDENCE_INTEGRITY"
  | "PLATFORM_MODEL_PROFILE_EVIDENCE"
  | "PLATFORM_NATIVE_REGISTRATION_BINDING"
  | "PLATFORM_NATIVE_REGISTRATION_RESULT"
  | "PLATFORM_PACKAGE_STATE_EVIDENCE"
  | "PLATFORM_PATH_REQUEST_SAFETY"
  | "PLATFORM_PATH_RESOLUTION_SAFETY"
  | "PLATFORM_PROCESS_PLAN_SAFETY"
  | "PLATFORM_PROCESS_STATUS_INTEGRITY"
  | "PLATFORM_RUNTIME_CAPABILITY_FALLBACK"
  | "PLATFORM_SECRET_REQUEST_AUTHORITY"
  | "PLATFORM_SECRET_RESULT_INTEGRITY"
  | "PLATFORM_TARGET_SUPPORT_CLAIM"
  | "RECONCILIATION_READINESS"
  | "RESUME_PLAN_EVIDENCE"
  | "WORKDAY_CERTIFICATION_SCOPE"
  | "WORKDAY_STEP_BOUNDARY"
  | "WORKDAY_TENANT_IDENTITY";

export type SemanticRuleIdV1 = "APPLICATION_SESSION_CONSISTENCY" | "APPLICATION_SESSION_INERT_TEXT" | "ATOMIC_CLAIM_INERT_TEXT" | "ATOMIC_CLAIM_INTEGRITY" | "ATS_VARIANT_INERT_TEXT" | "ATS_VARIANT_SCOPE" | "BENCHMARK_CASE_INERT_TEXT" | "BENCHMARK_CASE_INTEGRITY" | "BENCHMARK_RESULT_INERT_TEXT" | "BENCHMARK_RESULT_INTEGRITY" | "DRIVER_RESULT_INERT_TEXT" | "DRIVER_VERIFIED_EVIDENCE" | "FIELD_ADDRESS_IDENTITY" | "FIELD_ADDRESS_INERT_TEXT" | "FIELD_DECISION_AUTHORITY" | "FIELD_DECISION_INERT_TEXT" | "FIELD_DESCRIPTOR_INERT_TEXT" | "FIELD_DESCRIPTOR_OBSERVATION" | "GATE_DECISION_INERT_TEXT" | "GATE_DECISION_INTEGRITY" | "GATE_EVIDENCE_COMPLETENESS" | "GATE_EVIDENCE_INERT_TEXT" | "GUIDED_RUN_INERT_TEXT" | "GUIDED_RUN_SAFETY" | "HOLDOUT_MANIFEST_INERT_TEXT" | "HOLDOUT_MANIFEST_INTEGRITY" | "LAYOUT_MEASUREMENT_INERT_TEXT" | "LAYOUT_MEASUREMENT_INTEGRITY" | "NAVIGATION_INERT_TEXT" | "NAVIGATION_SAFETY" | "PAGE_READINESS_INERT_TEXT" | "PAGE_READINESS_INTEGRITY" | "PLATFORM_BROWSER_DISCOVERY_INERT_TEXT" | "PLATFORM_BROWSER_DISCOVERY_SAFETY" | "PLATFORM_BROWSER_RECORD_INERT_TEXT" | "PLATFORM_BROWSER_RECORD_SCOPE" | "PLATFORM_CAPABILITY_REPORT_INERT_TEXT" | "PLATFORM_CAPABILITY_REPORT_INTEGRITY" | "PLATFORM_CERTIFICATION_INPUT_INERT_TEXT" | "PLATFORM_CERTIFICATION_INPUT_SCOPE" | "PLATFORM_DIAGNOSTIC_INERT_TEXT" | "PLATFORM_DIAGNOSTIC_INTEGRITY" | "PLATFORM_EVIDENCE_INERT_TEXT" | "PLATFORM_EVIDENCE_INTEGRITY" | "PLATFORM_INSTALLER_STATE_EVIDENCE" | "PLATFORM_INSTALLER_STATE_INERT_TEXT" | "PLATFORM_MODEL_PROFILE_EVIDENCE" | "PLATFORM_MODEL_PROFILE_INERT_TEXT" | "PLATFORM_NATIVE_REGISTRATION_BINDING" | "PLATFORM_NATIVE_REGISTRATION_INERT_TEXT" | "PLATFORM_NATIVE_REGISTRATION_RESULT" | "PLATFORM_NATIVE_REGISTRATION_RESULT_INERT_TEXT" | "PLATFORM_PATH_REQUEST_INERT_TEXT" | "PLATFORM_PATH_REQUEST_SAFETY" | "PLATFORM_PATH_RESOLUTION_INERT_TEXT" | "PLATFORM_PATH_RESOLUTION_SAFETY" | "PLATFORM_PROCESS_PLAN_INERT_TEXT" | "PLATFORM_PROCESS_PLAN_SAFETY" | "PLATFORM_PROCESS_STATUS_INERT_TEXT" | "PLATFORM_PROCESS_STATUS_INTEGRITY" | "PLATFORM_RUNTIME_CAPABILITY_FALLBACK" | "PLATFORM_RUNTIME_CAPABILITY_INERT_TEXT" | "PLATFORM_SECRET_REQUEST_AUTHORITY" | "PLATFORM_SECRET_REQUEST_INERT_TEXT" | "PLATFORM_SECRET_RESULT_INERT_TEXT" | "PLATFORM_SECRET_RESULT_INTEGRITY" | "PLATFORM_TARGET_IDENTITY_INERT_TEXT" | "PLATFORM_TARGET_SUPPORT_CLAIM" | "PLATFORM_UPDATE_STATE_EVIDENCE" | "PLATFORM_UPDATE_STATE_INERT_TEXT" | "RECONCILIATION_INERT_TEXT" | "RECONCILIATION_READINESS" | "RESUME_PLAN_EVIDENCE" | "RESUME_PLAN_INERT_TEXT" | "WORKDAY_CERTIFICATION_INERT_TEXT" | "WORKDAY_CERTIFICATION_SCOPE" | "WORKDAY_STEP_BOUNDARY" | "WORKDAY_STEP_INERT_TEXT" | "WORKDAY_TENANT_IDENTITY" | "WORKDAY_TENANT_INERT_TEXT";

export interface SemanticRuleEntryV1 {
  readonly rule_id: SemanticRuleIdV1;
  readonly rule_version: string;
  readonly schema_ref: string;
  readonly rule_kind: SemanticRuleKindV1;
  readonly failure_error_code: ErrorTaxonomyV1ErrorCode;
}

/** Immutable reviewed semantic-rule bindings, sorted by rule_id. */
export const SEMANTIC_RULES_V1: readonly SemanticRuleEntryV1[] = Object.freeze([
  Object.freeze({
    rule_id: "APPLICATION_SESSION_CONSISTENCY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:application-session:v1",
    rule_kind: "APPLICATION_SESSION_CONSISTENCY",
    failure_error_code: "VALIDATION_CONSTRAINT_VIOLATION",
  }),
  Object.freeze({
    rule_id: "APPLICATION_SESSION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:application-session:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "ATOMIC_CLAIM_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:resume:atomic-claim:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "ATOMIC_CLAIM_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:resume:atomic-claim:v1",
    rule_kind: "ATOMIC_CLAIM_INTEGRITY",
    failure_error_code: "MODEL_VALIDATION_FAILED",
  }),
  Object.freeze({
    rule_id: "ATS_VARIANT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:ats:variant-identity:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "ATS_VARIANT_SCOPE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:ats:variant-identity:v1",
    rule_kind: "ATS_VARIANT_SCOPE",
    failure_error_code: "UNSUPPORTED_SITE_PATTERN",
  }),
  Object.freeze({
    rule_id: "BENCHMARK_CASE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:case:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "BENCHMARK_CASE_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:case:v1",
    rule_kind: "BENCHMARK_CASE_INTEGRITY",
    failure_error_code: "BENCHMARK_INVALID_CORPUS",
  }),
  Object.freeze({
    rule_id: "BENCHMARK_RESULT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:result:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "BENCHMARK_RESULT_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:result:v1",
    rule_kind: "BENCHMARK_RESULT_INTEGRITY",
    failure_error_code: "BENCHMARK_THRESHOLD_FAILED",
  }),
  Object.freeze({
    rule_id: "DRIVER_RESULT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:driver-result:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "DRIVER_VERIFIED_EVIDENCE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:driver-result:v1",
    rule_kind: "DRIVER_VERIFIED_EVIDENCE",
    failure_error_code: "SITE_VALIDATION_REJECTED",
  }),
  Object.freeze({
    rule_id: "FIELD_ADDRESS_IDENTITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-address:v1",
    rule_kind: "FIELD_ADDRESS_IDENTITY",
    failure_error_code: "SITE_AMBIGUOUS_CONTROL",
  }),
  Object.freeze({
    rule_id: "FIELD_ADDRESS_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-address:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "FIELD_DECISION_AUTHORITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-decision:v1",
    rule_kind: "FIELD_DECISION_AUTHORITY",
    failure_error_code: "SENSITIVE_CONFIRMATION_REQUIRED",
  }),
  Object.freeze({
    rule_id: "FIELD_DECISION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-decision:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "FIELD_DESCRIPTOR_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-descriptor:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "FIELD_DESCRIPTOR_OBSERVATION",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:field-descriptor:v1",
    rule_kind: "FIELD_DESCRIPTOR_OBSERVATION",
    failure_error_code: "VALIDATION_CONSTRAINT_VIOLATION",
  }),
  Object.freeze({
    rule_id: "GATE_DECISION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:gate:decision:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "GATE_DECISION_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:gate:decision:v1",
    rule_kind: "GATE_DECISION_INTEGRITY",
    failure_error_code: "GATE_THRESHOLD_FAILED",
  }),
  Object.freeze({
    rule_id: "GATE_EVIDENCE_COMPLETENESS",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:gate:evidence-bundle:v1",
    rule_kind: "GATE_EVIDENCE_COMPLETENESS",
    failure_error_code: "GATE_EVIDENCE_MISSING",
  }),
  Object.freeze({
    rule_id: "GATE_EVIDENCE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:gate:evidence-bundle:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "GUIDED_RUN_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:guided-run-mode:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "GUIDED_RUN_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:guided-run-mode:v1",
    rule_kind: "GUIDED_RUN_SAFETY",
    failure_error_code: "SENSITIVE_AUTOMATION_PROHIBITED",
  }),
  Object.freeze({
    rule_id: "HOLDOUT_MANIFEST_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:holdout-manifest:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "HOLDOUT_MANIFEST_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:benchmark:holdout-manifest:v1",
    rule_kind: "HOLDOUT_MANIFEST_INTEGRITY",
    failure_error_code: "BENCHMARK_INVALID_HOLDOUT_STATE",
  }),
  Object.freeze({
    rule_id: "LAYOUT_MEASUREMENT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:rendering:layout-measurement:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "LAYOUT_MEASUREMENT_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:rendering:layout-measurement:v1",
    rule_kind: "LAYOUT_MEASUREMENT_INTEGRITY",
    failure_error_code: "RENDERING_FAILURE",
  }),
  Object.freeze({
    rule_id: "NAVIGATION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:navigation-record:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "NAVIGATION_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:navigation-record:v1",
    rule_kind: "NAVIGATION_SAFETY",
    failure_error_code: "SITE_UNCERTAIN_TRANSITION",
  }),
  Object.freeze({
    rule_id: "PAGE_READINESS_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:page-readiness-proof:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PAGE_READINESS_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:session:page-readiness-proof:v1",
    rule_kind: "PAGE_READINESS_INTEGRITY",
    failure_error_code: "SITE_VALIDATION_REJECTED",
  }),
  Object.freeze({
    rule_id: "PLATFORM_BROWSER_DISCOVERY_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:browser-discovery-request:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_BROWSER_DISCOVERY_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:browser-discovery-request:v1",
    rule_kind: "PLATFORM_BROWSER_DISCOVERY_SAFETY",
    failure_error_code: "TRANSPORT_FORBIDDEN",
  }),
  Object.freeze({
    rule_id: "PLATFORM_BROWSER_RECORD_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:browser-record:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_BROWSER_RECORD_SCOPE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:browser-record:v1",
    rule_kind: "PLATFORM_BROWSER_RECORD_SCOPE",
    failure_error_code: "UNSUPPORTED_PLATFORM",
  }),
  Object.freeze({
    rule_id: "PLATFORM_CAPABILITY_REPORT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:capability-report:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:capability-report:v1",
    rule_kind: "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
    failure_error_code: "UNSUPPORTED_CAPABILITY",
  }),
  Object.freeze({
    rule_id: "PLATFORM_CERTIFICATION_INPUT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:certification-input:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_CERTIFICATION_INPUT_SCOPE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:certification-input:v1",
    rule_kind: "PLATFORM_CERTIFICATION_INPUT_SCOPE",
    failure_error_code: "GATE_EVIDENCE_MISSING",
  }),
  Object.freeze({
    rule_id: "PLATFORM_DIAGNOSTIC_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:diagnostic-report:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_DIAGNOSTIC_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:diagnostic-report:v1",
    rule_kind: "PLATFORM_DIAGNOSTIC_INTEGRITY",
    failure_error_code: "VALIDATION_CONSTRAINT_VIOLATION",
  }),
  Object.freeze({
    rule_id: "PLATFORM_EVIDENCE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:evidence-record:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_EVIDENCE_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:evidence-record:v1",
    rule_kind: "PLATFORM_EVIDENCE_INTEGRITY",
    failure_error_code: "GATE_EVIDENCE_MISSING",
  }),
  Object.freeze({
    rule_id: "PLATFORM_INSTALLER_STATE_EVIDENCE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:installer-state:v1",
    rule_kind: "PLATFORM_PACKAGE_STATE_EVIDENCE",
    failure_error_code: "STORAGE_INTEGRITY_FAILURE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_INSTALLER_STATE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:installer-state:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_MODEL_PROFILE_EVIDENCE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:model-runtime-profile:v1",
    rule_kind: "PLATFORM_MODEL_PROFILE_EVIDENCE",
    failure_error_code: "UNSUPPORTED_RUNTIME_PROFILE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_MODEL_PROFILE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:model-runtime-profile:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_NATIVE_REGISTRATION_BINDING",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:native-messaging-registration:v1",
    rule_kind: "PLATFORM_NATIVE_REGISTRATION_BINDING",
    failure_error_code: "TRANSPORT_FORBIDDEN",
  }),
  Object.freeze({
    rule_id: "PLATFORM_NATIVE_REGISTRATION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:native-messaging-registration:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_NATIVE_REGISTRATION_RESULT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:native-messaging-result:v1",
    rule_kind: "PLATFORM_NATIVE_REGISTRATION_RESULT",
    failure_error_code: "CONFLICT_INCOMPATIBLE_STATE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_NATIVE_REGISTRATION_RESULT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:native-messaging-result:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PATH_REQUEST_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:path-request:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PATH_REQUEST_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:path-request:v1",
    rule_kind: "PLATFORM_PATH_REQUEST_SAFETY",
    failure_error_code: "TRANSPORT_FORBIDDEN",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PATH_RESOLUTION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:path-resolution:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PATH_RESOLUTION_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:path-resolution:v1",
    rule_kind: "PLATFORM_PATH_RESOLUTION_SAFETY",
    failure_error_code: "STORAGE_IO_FAILURE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PROCESS_PLAN_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:process-plan:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PROCESS_PLAN_SAFETY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:process-plan:v1",
    rule_kind: "PLATFORM_PROCESS_PLAN_SAFETY",
    failure_error_code: "SENSITIVE_AUTOMATION_PROHIBITED",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PROCESS_STATUS_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:process-status:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_PROCESS_STATUS_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:process-status:v1",
    rule_kind: "PLATFORM_PROCESS_STATUS_INTEGRITY",
    failure_error_code: "CONFLICT_INCOMPATIBLE_STATE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:runtime-capability:v1",
    rule_kind: "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
    failure_error_code: "UNSUPPORTED_RUNTIME_PROFILE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_RUNTIME_CAPABILITY_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:runtime-capability:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_SECRET_REQUEST_AUTHORITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:secret-store-request:v1",
    rule_kind: "PLATFORM_SECRET_REQUEST_AUTHORITY",
    failure_error_code: "TRANSPORT_FORBIDDEN",
  }),
  Object.freeze({
    rule_id: "PLATFORM_SECRET_REQUEST_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:secret-store-request:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_SECRET_RESULT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:secret-store-result:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_SECRET_RESULT_INTEGRITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:secret-store-result:v1",
    rule_kind: "PLATFORM_SECRET_RESULT_INTEGRITY",
    failure_error_code: "STORAGE_SECURE_STORE_UNAVAILABLE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_TARGET_IDENTITY_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:target-identity:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_TARGET_SUPPORT_CLAIM",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:target-identity:v1",
    rule_kind: "PLATFORM_TARGET_SUPPORT_CLAIM",
    failure_error_code: "UNSUPPORTED_PLATFORM",
  }),
  Object.freeze({
    rule_id: "PLATFORM_UPDATE_STATE_EVIDENCE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:update-state:v1",
    rule_kind: "PLATFORM_PACKAGE_STATE_EVIDENCE",
    failure_error_code: "STORAGE_INTEGRITY_FAILURE",
  }),
  Object.freeze({
    rule_id: "PLATFORM_UPDATE_STATE_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:platform:update-state:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "RECONCILIATION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:reconciliation-inventory:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "RECONCILIATION_READINESS",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:form:reconciliation-inventory:v1",
    rule_kind: "RECONCILIATION_READINESS",
    failure_error_code: "VALIDATION_CONSTRAINT_VIOLATION",
  }),
  Object.freeze({
    rule_id: "RESUME_PLAN_EVIDENCE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:resume:plan:v1",
    rule_kind: "RESUME_PLAN_EVIDENCE",
    failure_error_code: "MODEL_VALIDATION_FAILED",
  }),
  Object.freeze({
    rule_id: "RESUME_PLAN_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:resume:plan:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "WORKDAY_CERTIFICATION_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:certification-record:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "WORKDAY_CERTIFICATION_SCOPE",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:certification-record:v1",
    rule_kind: "WORKDAY_CERTIFICATION_SCOPE",
    failure_error_code: "BENCHMARK_INVALID_COMPARISON_EVIDENCE",
  }),
  Object.freeze({
    rule_id: "WORKDAY_STEP_BOUNDARY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:step-identity:v1",
    rule_kind: "WORKDAY_STEP_BOUNDARY",
    failure_error_code: "SENSITIVE_AUTOMATION_PROHIBITED",
  }),
  Object.freeze({
    rule_id: "WORKDAY_STEP_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:step-identity:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
  Object.freeze({
    rule_id: "WORKDAY_TENANT_IDENTITY",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:tenant-fingerprint:v1",
    rule_kind: "WORKDAY_TENANT_IDENTITY",
    failure_error_code: "SITE_UNSUPPORTED_STRUCTURE",
  }),
  Object.freeze({
    rule_id: "WORKDAY_TENANT_INERT_TEXT",
    rule_version: "1.0.0",
    schema_ref: "urn:japp:schema:workday:tenant-fingerprint:v1",
    rule_kind: "INERT_TEXT_SAFETY",
    failure_error_code: "TRANSPORT_MALFORMED_MESSAGE",
  }),
]);

type JsonRecord = Readonly<Record<string, unknown>>;
type RuleEvaluator = (value: unknown) => boolean;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function member(value: unknown, name: string): unknown {
  return record(value)?.[name];
}

function text(value: unknown, name: string): string | null {
  const candidate = member(value, name);
  return typeof candidate === "string" ? candidate : null;
}

function numberValue(value: unknown, name: string): number | null {
  const candidate = member(value, name);
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function flag(value: unknown, name: string): boolean | null {
  const candidate = member(value, name);
  return typeof candidate === "boolean" ? candidate : null;
}

function items(value: unknown, name: string): readonly unknown[] {
  const candidate = member(value, name);
  return Array.isArray(candidate) ? candidate : [];
}

function objectMember(value: unknown, name: string): JsonRecord | null {
  return record(member(value, name));
}

function uniqueStrings(values: readonly unknown[]): boolean {
  if (!values.every((value) => typeof value === "string")) {
    return false;
  }
  return new Set(values).size === values.length;
}

function present(value: unknown, name: string): boolean {
  const candidate = member(value, name);
  return candidate !== undefined && candidate !== null;
}

function textOneOf(
  value: unknown,
  name: string,
  allowed: readonly string[],
): boolean {
  const candidate = text(value, name);
  return candidate !== null && allowed.includes(candidate);
}

function subsetOf(
  inner: readonly unknown[],
  outer: readonly unknown[],
): boolean {
  return inner.every((item) => outer.includes(item));
}

function uniqueField(values: readonly unknown[], name: string): boolean {
  const selected = values.map((value) => text(value, name));
  return selected.every((value) => value !== null) && uniqueStrings(selected);
}

function strictlySortedStrings(values: readonly unknown[]): boolean {
  if (!values.every((value) => typeof value === "string")) {
    return false;
  }
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      typeof previous !== "string" ||
      typeof current !== "string" ||
      previous >= current
    ) {
      return false;
    }
  }
  return true;
}

function strictlySortedField(
  values: readonly unknown[],
  name: string,
): boolean {
  return strictlySortedStrings(values.map((value) => text(value, name)));
}

function uniqueNumberField(values: readonly unknown[], name: string): boolean {
  const selected = values.map((value) => numberValue(value, name));
  return (
    selected.every((value) => value !== null) &&
    new Set(selected).size === selected.length
  );
}

function allFlags(value: unknown, names: readonly string[]): boolean {
  return names.every((name) => flag(value, name) === true);
}

function utcTimestampKey(value: unknown, name: string): string | null {
  const candidate = text(value, name);
  if (candidate === null) {
    return null;
  }
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(
      candidate,
    );
  if (match === null) {
    return null;
  }
  const wholeSeconds = match[1];
  return wholeSeconds === undefined
    ? null
    : wholeSeconds + "." + (match[2] ?? "").padEnd(9, "0");
}

function timestampNotBefore(
  value: unknown,
  laterName: string,
  earlierName: string,
): boolean {
  const later = utcTimestampKey(value, laterName);
  const earlier = utcTimestampKey(value, earlierName);
  return later !== null && earlier !== null && later >= earlier;
}

function inertTextSafe(value: unknown, depth = 0): boolean {
  if (depth > 64) {
    return false;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return !(
      value.startsWith("/") ||
      /^[A-Za-z]:[\\/]/.test(value) ||
      lower.includes("<script") ||
      lower.includes("javascript:") ||
      lower.includes("xpath:") ||
      lower.includes("document.") ||
      lower.includes("window.") ||
      lower.includes("onload=") ||
      lower.includes("onclick=") ||
      lower.includes("password=") ||
      lower.includes("credential=") ||
      lower.includes("token=") ||
      lower.includes("begin private key") ||
      value.includes("$(") ||
      value.includes("=>") ||
      value.includes("../") ||
      value.includes("..\\")
    );
  }
  if (Array.isArray(value)) {
    return value.every((item) => inertTextSafe(item, depth + 1));
  }
  const object = record(value);
  return (
    object === null ||
    Object.values(object).every((item) => inertTextSafe(item, depth + 1))
  );
}

function fieldAddressIdentity(value: unknown): boolean {
  const signalCount = [
    text(value, "route_signature"),
    text(value, "application_root_fingerprint"),
    text(value, "accessible_name_fingerprint"),
    text(value, "attribute_fingerprint"),
    text(value, "option_fingerprint"),
    items(value, "section_path").length > 0 ? "SECTION_PATH" : null,
    items(value, "repeater_path").length > 0 ? "REPEATER_PATH" : null,
  ].filter((signal) => signal !== null).length;
  return (
    signalCount >= 2 &&
    uniqueField(items(value, "repeater_path"), "stable_item_key")
  );
}

function fieldDescriptorObservation(value: unknown): boolean {
  const address = objectMember(value, "address");
  const label = objectMember(value, "label");
  const description = objectMember(value, "description");
  const options = items(value, "options");
  return (
    address !== null &&
    fieldAddressIdentity(address) &&
    numberValue(value, "observed_dom_generation") ===
      numberValue(address, "observed_dom_generation") &&
    flag(label, "untrusted") === true &&
    (description === null || flag(description, "untrusted") === true) &&
    uniqueField(options, "value_digest") &&
    options.every(
      (option) => flag(objectMember(option, "label"), "untrusted") === true,
    )
  );
}

function fieldDecisionAuthority(value: unknown): boolean {
  const finalDecision = text(value, "final_decision");
  const source = text(value, "value_source_type");
  const policy = text(value, "policy_decision");
  const sensitivity = text(value, "sensitivity_class");
  const confirmation = text(value, "confirmation_state");
  const classification = numberValue(value, "classification_confidence");
  const confidence = numberValue(value, "value_confidence");
  const reasons = items(value, "reason_codes");
  const confirmationRequired =
    policy === "REQUIRE_CONFIRMATION" ||
    sensitivity === "SENSITIVE" ||
    sensitivity === "SECRET";
  const confirmationValid =
    confirmation === "VALID" &&
    typeof member(value, "user_confirmation_ref") === "string";
  const fillSources = new Set([
    "ANSWER_POLICY",
    "APPROVED_DOCUMENT",
    "DETERMINISTIC_DERIVATION",
    "USER_CONFIRMATION",
    "USER_RECORD",
  ]);
  const proposalSources = new Set([...fillSources, "MODEL_PROPOSAL"]);
  if (!uniqueStrings(reasons)) {
    return false;
  }
  if (confirmation === "VALID" && !confirmationValid) {
    return false;
  }
  if (
    (policy === "DENY" || policy === "UNSUPPORTED") &&
    (finalDecision === "FILL" || finalDecision === "PROPOSE")
  ) {
    return false;
  }
  if (
    (source === "MODEL_PROPOSAL" || source === "NONE") &&
    finalDecision === "FILL"
  ) {
    return false;
  }
  if (
    confirmation === "EXPIRED" ||
    confirmation === "MISSING" ||
    confirmation === "REVOKED"
  ) {
    return finalDecision === "PAUSE_FOR_CONFIRMATION";
  }
  if (
    (classification ?? 0) < 0.5 &&
    !reasons.includes("LOW_CLASSIFICATION_CONFIDENCE")
  ) {
    return false;
  }
  if (
    (confidence ?? 0) < 0.5 &&
    !reasons.includes("LOW_VALUE_CONFIDENCE")
  ) {
    return false;
  }
  if (finalDecision === "PROPOSE") {
    return (
      proposalSources.has(source ?? "") &&
      typeof member(value, "value_source_ref") === "string"
    );
  }
  if (finalDecision !== "FILL") {
    return true;
  }
  return (
    fillSources.has(source ?? "") &&
    typeof member(value, "value_source_ref") === "string" &&
    (classification ?? 0) >= 0.75 &&
    (confidence ?? 0) >= 0.75 &&
    (policy === "PERMIT" ||
      (policy === "REQUIRE_CONFIRMATION" && confirmationValid)) &&
    (!confirmationRequired || confirmationValid)
  );
}

function driverVerifiedEvidence(value: unknown): boolean {
  const address = objectMember(value, "field_address");
  const preconditions = objectMember(value, "preconditions");
  const intended = objectMember(value, "intended_value");
  const immediate = objectMember(value, "observed_value_immediate");
  const settled = objectMember(value, "observed_value_settled");
  if (
    address === null ||
    !fieldAddressIdentity(address) ||
    preconditions === null ||
    intended === null ||
    immediate === null ||
    settled === null ||
    text(value, "session_id") !== text(address, "session_id") ||
    numberValue(value, "starting_dom_generation") !==
      numberValue(address, "observed_dom_generation") ||
    !uniqueStrings(items(value, "conditional_field_ids"))
  ) {
    return false;
  }
  const uncertain =
    text(value, "resolution_result") !== "UNIQUE" ||
    text(value, "site_acceptance") === "UNKNOWN";
  if (uncertain && flag(value, "safe_retry_allowed") === true) {
    return false;
  }
  if (text(value, "outcome") !== "VERIFIED") {
    return true;
  }
  return (
    text(value, "resolution_result") === "UNIQUE" &&
    allFlags(preconditions, [
      "visible",
      "enabled",
      "generation_matched",
      "policy_permitted",
    ]) &&
    text(intended, "semantic_digest") === text(immediate, "semantic_digest") &&
    text(intended, "semantic_digest") === text(settled, "semantic_digest") &&
    text(intended, "presence") === text(immediate, "presence") &&
    text(intended, "presence") === text(settled, "presence") &&
    flag(value, "persistence_verified") === true &&
    text(value, "site_acceptance") === "ACCEPTED" &&
    numberValue(value, "starting_dom_generation") ===
      numberValue(value, "settled_dom_generation") &&
    items(value, "validation_message_digests").length === 0
  );
}

function reconciliationReadiness(value: unknown): boolean {
  const inventory = items(value, "items");
  const counts = objectMember(value, "counts");
  if (
    counts === null ||
    !uniqueField(inventory, "item_id") ||
    numberValue(counts, "total") !== inventory.length
  ) {
    return false;
  }
  const categories: Readonly<Record<string, string>> = {
    verified_filled: "VERIFIED_FILLED",
    needs_review: "NEEDS_REVIEW",
    blocked_sensitive: "BLOCKED_SENSITIVE",
    unsupported_or_skipped: "UNSUPPORTED_OR_SKIPPED",
    required_unresolved: "REQUIRED_UNRESOLVED",
    page_changed_value: "PAGE_CHANGED_VALUE",
  };
  for (const [countName, category] of Object.entries(categories)) {
    if (
      numberValue(counts, countName) !==
      inventory.filter((item) => text(item, "category") === category).length
    ) {
      return false;
    }
  }
  const stale = inventory.filter(
    (item) => text(item, "document_state") === "STALE",
  ).length;
  const unconfirmed = inventory.filter((item) =>
    ["EXPIRED", "MISSING", "REVOKED"].includes(
      text(item, "confirmation_state") ?? "",
    ),
  ).length;
  const uncertain = inventory.filter(
    (item) => flag(item, "mandatory_uncertain") === true,
  ).length;
  const changed = inventory.filter(
    (item) => flag(item, "changed_value") === true,
  ).length;
  if (
    numberValue(counts, "page_changed_value") !== changed ||
    numberValue(counts, "stale_document") !== stale ||
    numberValue(counts, "unconfirmed_consequential") !== unconfirmed ||
    numberValue(counts, "mandatory_uncertain") !== uncertain
  ) {
    return false;
  }
  for (const item of inventory) {
    if (
      (flag(item, "changed_value") === true) !==
      (text(item, "category") === "PAGE_CHANGED_VALUE")
    ) {
      return false;
    }
    if (
      flag(item, "required") === true &&
      flag(item, "visible") === true &&
      flag(item, "enabled") === true &&
      text(item, "category") !== "VERIFIED_FILLED" &&
      text(item, "category") !== "REQUIRED_UNRESOLVED" &&
      text(item, "category") !== "BLOCKED_SENSITIVE"
    ) {
      return false;
    }
  }
  if (text(value, "readiness") !== "READY") {
    return true;
  }
  return (
    numberValue(value, "page_generation") ===
      numberValue(value, "proof_generation") &&
    [
      "required_unresolved",
      "blocked_sensitive",
      "page_changed_value",
      "stale_document",
      "unconfirmed_consequential",
      "mandatory_uncertain",
    ].every((name) => numberValue(counts, name) === 0)
  );
}

function atsVariantScope(value: unknown): boolean {
  return (
    text(value, "ats_family") !== "UNKNOWN" &&
    text(value, "session_mode") !== "UNKNOWN" &&
    !["ALL", "UNIVERSAL", "UNKNOWN"].includes(
      text(value, "route_page_family") ?? "",
    )
  );
}

function workdayTenantIdentity(value: unknown): boolean {
  const controls = items(value, "control_family_inventory");
  return (
    controls.length > 0 &&
    uniqueStrings(controls) &&
    text(value, "hostname_family") !== "UNKNOWN" &&
    text(value, "candidate_session_mode") !== "UNKNOWN" &&
    !["ALL", "UNIVERSAL", "UNKNOWN"].includes(
      text(value, "route_family") ?? "",
    ) &&
    !["ALL", "UNIVERSAL", "UNKNOWN"].includes(
      text(value, "page_sequence_family") ?? "",
    )
  );
}

function workdayStepBoundary(value: unknown): boolean {
  const signals = items(value, "recognition_signals");
  if (
    signals.length < 2 ||
    !uniqueField(signals, "kind") ||
    new Set(signals.map((signal) => text(signal, "kind"))).size < 2
  ) {
    return false;
  }
  const expected: Readonly<Record<string, string>> = {
    GUEST_APPLICATION: "ORDINARY_APPLICATION",
    AUTHENTICATED_APPLICATION: "ORDINARY_APPLICATION",
    LOGIN: "PROTECTED_AUTHENTICATION",
    ACCOUNT_CREATION: "PROTECTED_AUTHENTICATION",
    EMAIL_VERIFICATION: "PROTECTED_AUTHENTICATION",
    MFA: "PROTECTED_AUTHENTICATION",
    EXPIRED_SESSION: "PROTECTED_AUTHENTICATION",
    CAPTCHA: "PROTECTED_HUMAN_VERIFICATION",
    LEGAL_CONSENT_BOUNDARY: "PROTECTED_LEGAL_OR_CONSENT",
    FINAL_REVIEW: "FINAL_REVIEW_BOUNDARY",
    DUPLICATE_APPLICATION: "UNKNOWN_OR_UNSUPPORTED",
    UNKNOWN_UNSUPPORTED: "UNKNOWN_OR_UNSUPPORTED",
  };
  return (
    expected[text(value, "step_family") ?? ""] ===
    text(value, "boundary_class")
  );
}

function pageReadinessIntegrity(value: unknown): boolean {
  const step = objectMember(value, "step_identity");
  const counts = objectMember(value, "blocking_counts");
  if (
    step === null ||
    counts === null ||
    !workdayStepBoundary(step) ||
    text(value, "session_id") !== text(step, "session_id") ||
    numberValue(value, "page_generation") !==
      numberValue(step, "observed_dom_generation")
  ) {
    return false;
  }
  if (text(value, "readiness") !== "READY") {
    return true;
  }
  const next = objectMember(value, "next_control");
  return (
    text(step, "step_family") !== "UNKNOWN_UNSUPPORTED" &&
    text(step, "boundary_class") === "ORDINARY_APPLICATION" &&
    text(value, "site_validation_status") === "ACCEPTED" &&
    [
      "unresolved_count",
      "changed_value_count",
      "stale_document_count",
      "sensitive_confirmation_count",
      "mandatory_uncertain_count",
    ].every((name) => numberValue(counts, name) === 0) &&
    next !== null &&
    text(next, "resolution") === "UNIQUE"
  );
}

function navigationSafety(value: unknown): boolean {
  const source = objectMember(value, "source_step_identity");
  const control = objectMember(value, "navigation_control");
  const postconditions = objectMember(value, "postconditions");
  const destination = objectMember(value, "observed_destination_identity");
  const allowed = items(value, "allowed_destination_families");
  if (
    source === null ||
    control === null ||
    postconditions === null ||
    !workdayStepBoundary(source) ||
    text(value, "session_id") !== text(source, "session_id") ||
    numberValue(value, "source_page_generation") !==
      numberValue(source, "observed_dom_generation") ||
    text(control, "resolution") !== "UNIQUE" ||
    !uniqueStrings(allowed)
  ) {
    return false;
  }
  const expected = text(value, "expected_destination_family");
  if (expected !== null && !allowed.includes(expected)) {
    return false;
  }
  const outcome = text(value, "outcome");
  if (
    (outcome === "UNCERTAIN_TRANSITION" ||
      outcome === "PAUSED_BOUNDARY") &&
    flag(value, "safe_retry_allowed") === true
  ) {
    return false;
  }
  if (destination !== null) {
    if (
      !workdayStepBoundary(destination) ||
      text(value, "session_id") !== text(destination, "session_id")
    ) {
      return false;
    }
  }
  if (
    outcome === "PAUSED_BOUNDARY" &&
    (destination === null ||
      text(destination, "boundary_class") === "ORDINARY_APPLICATION")
  ) {
    return false;
  }
  if (
    destination !== null &&
    text(destination, "boundary_class") !== "ORDINARY_APPLICATION"
  ) {
    return outcome === "PAUSED_BOUNDARY";
  }
  if (outcome !== "VERIFIED_TRANSITION") {
    return true;
  }
  return (
    destination !== null &&
    text(source, "boundary_class") === "ORDINARY_APPLICATION" &&
    allowed.includes(text(destination, "step_family") ?? "") &&
    (expected === null ||
      expected === text(destination, "step_family")) &&
    typeof member(value, "observed_resulting_generation") === "number" &&
    numberValue(value, "observed_resulting_generation") ===
      numberValue(destination, "observed_dom_generation") &&
    numberValue(value, "observed_resulting_generation") !==
      numberValue(value, "source_page_generation") &&
    allFlags(postconditions, [
      "source_generation_changed",
      "destination_recognized",
      "source_control_absent_or_inactive",
    ])
  );
}

function guidedRunSafety(value: unknown): boolean {
  const snapshots = objectMember(value, "snapshot_readiness");
  if (snapshots === null) {
    return false;
  }
  const allowed =
    text(value, "page_eligibility") === "CERTIFIED_APPLICATION_PAGE" &&
    ["profile", "document", "answer_policy"].every(
      (name) => text(snapshots, name) === "READY",
    ) &&
    flag(value, "visible_cancel_control") === true &&
    text(value, "revocation_state") === "ACTIVE";
  if (text(value, "start_permission") === "START_ALLOWED" && !allowed) {
    return false;
  }
  if (
    text(value, "revocation_state") !== "ACTIVE" &&
    text(value, "start_permission") !== "START_BLOCKED"
  ) {
    return false;
  }
  if (text(value, "start_policy") !== "AUTO_START_ON_OPEN") {
    return true;
  }
  return (
    text(value, "run_kind") === "GUIDED_PRE_SUBMIT" &&
    typeof member(value, "prior_opt_in_ref") === "string" &&
    typeof member(value, "certified_pattern_ref") === "string" &&
    typeof member(value, "cancelable_start_ref") === "string" &&
    allowed
  );
}

function applicationSessionConsistency(value: unknown): boolean {
  const step = objectMember(value, "current_step");
  const ats = objectMember(value, "ats_variant");
  const mode = objectMember(value, "guided_run_mode");
  const tenant = objectMember(value, "workday_tenant_fingerprint");
  if (
    step === null ||
    ats === null ||
    mode === null ||
    !atsVariantScope(ats) ||
    !guidedRunSafety(mode) ||
    !workdayStepBoundary(step) ||
    (tenant !== null && !workdayTenantIdentity(tenant)) ||
    text(value, "session_id") !== text(step, "session_id") ||
    numberValue(value, "current_page_generation") !==
      numberValue(step, "observed_dom_generation") ||
    (tenant !== null && text(ats, "ats_family") !== "WORKDAY") ||
    !timestampNotBefore(value, "updated_at", "created_at")
  ) {
    return false;
  }
  const lifecycle = text(value, "lifecycle_state");
  if (
    ["PAUSED", "CANCELED"].includes(lifecycle ?? "") &&
    typeof member(value, "pause_or_cancel_reason") !== "string"
  ) {
    return false;
  }
  return !(
    text(mode, "start_permission") === "START_ALLOWED" &&
    (lifecycle !== "ACTIVE" || text(value, "revalidation_state") !== "CURRENT")
  );
}

function workdayCertificationScope(value: unknown): boolean {
  const tenant = objectMember(value, "tenant_fingerprint");
  const metrics = objectMember(value, "metrics");
  const routes = items(value, "route_page_sequence");
  const controls = items(value, "control_families");
  if (
    tenant === null ||
    metrics === null ||
    !workdayTenantIdentity(tenant) ||
    !uniqueStrings(routes) ||
    !uniqueStrings(controls) ||
    text(value, "locale") !== text(tenant, "locale") ||
    text(value, "session_mode") !== text(tenant, "candidate_session_mode") ||
    text(value, "adapter_version") !== text(tenant, "adapter_version") ||
    !controls.every((control) =>
      items(tenant, "control_family_inventory").includes(control),
    ) ||
    routes.some((route) => ["ALL", "UNIVERSAL"].includes(String(route)))
  ) {
    return false;
  }
  if (text(value, "certification_state") !== "CERTIFIED") {
    return true;
  }
  return (
    text(value, "measured_scope_digest") ===
      text(value, "certified_scope_digest") &&
    text(tenant, "hostname_family") !== "UNKNOWN" &&
    text(tenant, "candidate_session_mode") !== "UNKNOWN" &&
    (numberValue(metrics, "case_count") ?? 0) > 0 &&
    items(value, "evidence_report_refs").length > 0
  );
}

function benchmarkCaseIntegrity(value: unknown): boolean {
  const thresholds = items(value, "thresholds");
  const artifacts = items(value, "input_artifacts");
  const platforms = items(value, "applicable_platform_profiles");
  return (
    uniqueField(thresholds, "metric_id") &&
    uniqueField(artifacts, "artifact_ref") &&
    uniqueField(artifacts, "artifact_digest") &&
    uniqueStrings(platforms)
  );
}

function benchmarkResultIntegrity(value: unknown): boolean {
  const metrics = items(value, "metric_results");
  const failureErrors = items(value, "failure_error_codes");
  const completeness = text(value, "completeness_state");
  const environment = text(value, "environment_match_state");
  const hashes = text(value, "hash_state");
  const holdout = text(value, "holdout_state");
  if (
    !uniqueField(metrics, "metric_id") ||
    text(value, "case_threshold_set_digest") !==
      text(value, "evaluated_threshold_set_digest") ||
    !metrics.every(
      (metric) =>
        text(metric, "threshold_digest") ===
        text(value, "case_threshold_set_digest"),
    ) ||
    !timestampNotBefore(value, "ended_at", "started_at")
  ) {
    return false;
  }
  const comparable =
    completeness === "COMPLETE" &&
    environment === "MATCH" &&
    hashes === "MATCH" &&
    (holdout === "VALID" || holdout === "NOT_APPLICABLE");
  if (flag(value, "comparable") !== comparable) {
    return false;
  }
  const outcome = text(value, "overall_outcome");
  if (outcome === "PASS") {
    return (
      comparable &&
      failureErrors.length === 0 &&
      metrics.every((metric) => flag(metric, "passed") === true)
    );
  }
  if (outcome === "FAIL") {
    return (
      !comparable ||
      failureErrors.length > 0 ||
      metrics.some((metric) => flag(metric, "passed") === false)
    );
  }
  return true;
}

function holdoutManifestIntegrity(value: unknown): boolean {
  const caseIds = items(value, "case_ids");
  const schemaVersions = items(value, "schema_versions");
  const categories = items(value, "category_counts");
  const files = items(value, "files");
  const categoryCounts = categories.map((item) => numberValue(item, "count"));
  const fileCounts = files.map((item) => numberValue(item, "case_count"));
  if (
    categoryCounts.some((count) => count === null) ||
    fileCounts.some((count) => count === null)
  ) {
    return false;
  }
  let categoryTotal = 0;
  for (const count of categoryCounts) {
    categoryTotal += count ?? 0;
  }
  let fileTotal = 0;
  for (const count of fileCounts) {
    fileTotal += count ?? 0;
  }
  return (
    strictlySortedStrings(caseIds) &&
    strictlySortedField(schemaVersions, "schema_ref") &&
    strictlySortedField(categories, "category") &&
    strictlySortedField(files, "file_id") &&
    uniqueField(files, "content_digest") &&
    numberValue(value, "case_count") === caseIds.length &&
    categoryTotal === caseIds.length &&
    fileTotal === caseIds.length &&
    flag(value, "synthetic_only") === true &&
    (text(value, "storage_policy") === "ENCRYPTED_BUNDLE_REFERENCE") ===
      (objectMember(value, "encrypted_bundle") !== null)
  );
}

function gateEvidenceCompleteness(value: unknown): boolean {
  const inventory = objectMember(value, "completeness_inventory");
  const results = items(value, "benchmark_result_refs");
  if (
    inventory === null ||
    !uniqueStrings(results) ||
    !uniqueStrings(items(value, "raw_artifact_report_digests")) ||
    !uniqueStrings(items(value, "manual_inspection_evidence_refs")) ||
    numberValue(inventory, "present_benchmark_count") !== results.length
  ) {
    return false;
  }
  if (text(value, "bundle_state") !== "COMPLETE") {
    return true;
  }
  return (
    numberValue(inventory, "required_benchmark_count") === results.length &&
    allFlags(inventory, [
      "corpus_valid",
      "holdout_valid",
      "raw_artifacts_complete",
      "manual_inspection_complete",
      "independent_review_complete",
      "owner_decision_complete",
    ]) &&
    (text(inventory, "owner_decision_requirement") === "REQUIRED") ===
      (typeof member(value, "owner_decision_ref") === "string")
  );
}

function gateDecisionIntegrity(value: unknown): boolean {
  const summary = objectMember(value, "threshold_evidence_summary");
  if (
    summary === null ||
    !uniqueStrings(items(value, "reason_codes")) ||
    !uniqueStrings(items(value, "error_codes"))
  ) {
    return false;
  }
  if (
    text(value, "decision") === "REDESIGN_REQUIRED" &&
    typeof member(value, "redesign_adr_ref") !== "string"
  ) {
    return false;
  }
  if (text(value, "decision") !== "PASS") {
    return true;
  }
  return (
    allFlags(summary, [
      "evidence_complete",
      "required_benchmark_results_complete",
      "thresholds_passed",
      "corpus_valid",
      "holdout_valid",
    ]) &&
    text(value, "independent_review_state") === "COMPLETE" &&
    ["COMPLETE", "NOT_REQUIRED"].includes(
      text(value, "owner_decision_state") ?? "",
    ) &&
    items(value, "error_codes").length === 0
  );
}

function resumePlanEvidence(value: unknown): boolean {
  const requirements = items(value, "ordered_requirements");
  const assignments = items(value, "evidence_assignments");
  const gaps = items(value, "unsupported_gap_refs");
  const budget = objectMember(value, "budget");
  const sectionBudget = numberValue(budget, "section_word_budget");
  const globalBudget = numberValue(budget, "global_word_budget");
  if (
    budget === null ||
    sectionBudget === null ||
    globalBudget === null ||
    !uniqueField(requirements, "requirement_ref") ||
    !uniqueNumberField(requirements, "priority") ||
    !uniqueField(assignments, "requirement_ref") ||
    !uniqueStrings(gaps) ||
    !uniqueStrings(items(value, "locked_content_refs")) ||
    sectionBudget > globalBudget
  ) {
    return false;
  }
  const byId = new Map(
    requirements.map((item) => [text(item, "requirement_ref"), item]),
  );
  const assignedRequirementRefs = new Set(
    assignments.map((item) => text(item, "requirement_ref")),
  );
  const gapRequirementRefs = new Set(
    gaps.map((item) => (typeof item === "string" ? item : null)),
  );
  for (const assignment of assignments) {
    const requirement = byId.get(text(assignment, "requirement_ref"));
    if (
      requirement === undefined ||
      flag(requirement, "supported") !== true ||
      !uniqueStrings(items(assignment, "evidence_refs"))
    ) {
      return false;
    }
  }
  for (const requirement of requirements) {
    const requirementRef = text(requirement, "requirement_ref");
    const supported = flag(requirement, "supported");
    if (
      requirementRef === null ||
      supported === null ||
      assignedRequirementRefs.has(requirementRef) !== supported ||
      gapRequirementRefs.has(requirementRef) === supported
    ) {
      return false;
    }
  }
  return gaps.every((gap) => {
    const requirement = byId.get(String(gap));
    return requirement !== undefined && flag(requirement, "supported") === false;
  });
}

function atomicClaimIntegrity(value: unknown): boolean {
  const status = text(value, "verification_status");
  const eligible = flag(value, "release_eligible");
  if (
    !uniqueStrings(items(value, "evidence_refs")) ||
    !uniqueStrings(items(value, "rejection_error_codes")) ||
    flag(value, "canonical_evidence_mutation") !== false ||
    (eligible === true && status !== "SUPPORTED")
  ) {
    return false;
  }
  if (status === "SUPPORTED") {
    return (
      items(value, "evidence_refs").length > 0 &&
      text(value, "user_action") === "NONE"
    );
  }
  if (status === "PARTIALLY_SUPPORTED") {
    return eligible === false && text(value, "user_action") === "EDIT_AND_APPROVE";
  }
  return eligible === false && text(value, "user_action") !== "NONE";
}

function layoutMeasurementIntegrity(value: unknown): boolean {
  const bounds = items(value, "page_content_bounds");
  const fonts = items(value, "controlled_fonts");
  const missing = items(value, "missing_font_families");
  const dimensions = objectMember(value, "page_dimensions");
  const pageCount = numberValue(value, "page_count");
  if (
    dimensions === null ||
    pageCount === null ||
    bounds.length !== pageCount ||
    !uniqueNumberField(bounds, "page_number") ||
    !bounds.every(
      (bound, index) => numberValue(bound, "page_number") === index + 1,
    ) ||
    !uniqueField(fonts, "font_family") ||
    !uniqueStrings(missing)
  ) {
    return false;
  }
  const boundsWithinPage = bounds.every((bound) => {
    const x = numberValue(bound, "x");
    const y = numberValue(bound, "y");
    const width = numberValue(bound, "width");
    const height = numberValue(bound, "height");
    const pageWidth = numberValue(dimensions, "width_points");
    const pageHeight = numberValue(dimensions, "height_points");
    return (
      x !== null &&
      y !== null &&
      width !== null &&
      height !== null &&
      pageWidth !== null &&
      pageHeight !== null &&
      x + width <= pageWidth &&
      y + height <= pageHeight
    );
  });
  const accepted =
    flag(value, "renderer_succeeded") === true &&
    (pageCount ?? 0) >= 1 &&
    flag(value, "overflow_detected") === false &&
    flag(value, "clipping_detected") === false &&
    text(value, "extraction_order_result") === "MATCH" &&
    boundsWithinPage &&
    missing.length === 0 &&
    items(value, "error_reason_codes").length === 0;
  const result = text(value, "layout_result");
  if (result === "ACCEPTED") {
    return accepted;
  }
  if (result === "RENDER_FAILED") {
    return (
      flag(value, "renderer_succeeded") === false &&
      items(value, "error_reason_codes").length > 0
    );
  }
  return (pageCount ?? 0) >= 1 && flag(value, "renderer_succeeded") === true;
}

const CERTIFIED_PLATFORM_IDS = ["MACOS_ARM64", "UBUNTU_X64", "WINDOWS_X64"];
const UNCERTIFIABLE_PLATFORM_IDS = ["UNKNOWN_TARGET", "UNSUPPORTED_TARGET"];
const CERTIFIED_SUPPORT_TIERS = ["CERTIFIED_CORE", "CERTIFIED_FULL"];
const PLATFORM_CAPABILITY_FAMILIES = [
  "BROWSER_PRESENCE",
  "DIAGNOSTICS",
  "MODEL_RUNTIME",
  "NATIVE_MESSAGING",
  "PACKAGING_UPDATE_CHANNEL",
  "PLATFORM_PATHS",
  "PROCESS_SUPERVISION",
  "SECURE_STORE",
];
const MANDATORY_CORE_CAPABILITIES = [
  "BROWSER_PRESENCE",
  "NATIVE_MESSAGING",
  "PLATFORM_PATHS",
  "PROCESS_SUPERVISION",
  "SECURE_STORE",
];
const PLATFORM_REQUEST_PRINCIPALS = ["ORCHESTRATOR", "VERIFICATION_HARNESS"];
const PLATFORM_REQUEST_PROFILES = ["PRODUCTION_NO_SUBMIT", "VERIFICATION"];
const PLATFORM_INTERPRETER_TOKENS = [
  "bash",
  "cmd",
  "cscript",
  "eval",
  "exec",
  "powershell",
  "pwsh",
  "sh",
  "wscript",
  "zsh",
];
const PLATFORM_ARCHITECTURE_BY_ID: Readonly<Record<string, string>> = {
  MACOS_ARM64: "ARM64",
  UBUNTU_X64: "X86_64",
  WINDOWS_X64: "X86_64",
};
const DIAGNOSTIC_CAPABILITY_BY_COMPONENT: Readonly<Record<string, string>> = {
  BROWSER_LOCATOR: "BROWSER_PRESENCE",
  INSTALLER_STATE: "PACKAGING_UPDATE_CHANNEL",
  MODEL_RUNTIME_PROVIDER: "MODEL_RUNTIME",
  NATIVE_MESSAGING_REGISTRAR: "NATIVE_MESSAGING",
  PLATFORM_DIAGNOSTICS: "DIAGNOSTICS",
  PLATFORM_PATHS: "PLATFORM_PATHS",
  PROCESS_SUPERVISOR: "PROCESS_SUPERVISION",
  SECRET_STORE: "SECURE_STORE",
  UPDATER_PROVIDER: "PACKAGING_UPDATE_CHANNEL",
};
const PACKAGE_SUCCESS_STATES = [
  "INSTALLED",
  "REPAIRED",
  "ROLLED_BACK",
  "UNINSTALLED",
  "UPDATE_INSTALLED",
];
const PACKAGE_FAILURE_STATES = [
  "INSTALL_FAILED",
  "INSTALL_INTERRUPTED",
  "REPAIR_FAILED",
  "ROLLBACK_FAILED",
  "UNINSTALL_FAILED",
  "UPDATE_FAILED",
  "UPDATE_INTERRUPTED",
];
const EVIDENCE_REFERENCE_BY_ARTIFACT_KIND: Readonly<Record<string, string>> = {
  INSTALL_LAUNCH_REPORT: "installer_state_ref",
  MODEL_PROFILE_REPORT: "model_profile_ref",
  NATIVE_HOST_REGISTRATION_REPORT: "native_messaging_result_ref",
  SECRET_STORE_TEST_REPORT: "secret_store_result_ref",
  UPDATE_ROLLBACK_REPORT: "update_state_ref",
};

function platformRequestAuthority(value: unknown): boolean {
  const context = objectMember(value, "request_context");
  return (
    context !== null &&
    textOneOf(context, "requesting_principal", PLATFORM_REQUEST_PRINCIPALS) &&
    textOneOf(context, "authorization_profile", PLATFORM_REQUEST_PROFILES)
  );
}

function platformCapabilityStateSound(state: unknown): boolean {
  const availability = text(state, "availability");
  const reasons = items(state, "reason_codes");
  if (!uniqueStrings(reasons)) {
    return false;
  }
  if (availability === "AVAILABLE") {
    return (
      reasons.length === 0 &&
      present(state, "identity_token") &&
      present(state, "detected_version") &&
      present(state, "evidence_digest") &&
      text(state, "evaluation_method") !== "NOT_EVALUATED"
    );
  }
  if (reasons.length === 0) {
    return false;
  }
  if (availability === "NOT_EVALUATED") {
    return (
      text(state, "evaluation_method") === "NOT_EVALUATED" &&
      reasons.includes("EVALUATION_NOT_RUN")
    );
  }
  if (availability === "DEGRADED_LIMITED") {
    return present(state, "identity_token") && present(state, "detected_version");
  }
  return true;
}

function platformSupportClaimSound(value: unknown): boolean {
  const claim = objectMember(value, "support_claim");
  const platformId = text(value, "platform_id");
  if (claim === null || platformId === null) {
    return false;
  }
  const reviewed = text(claim, "reviewed_tier") ?? "";
  const evidence = items(claim, "evidence_refs");
  if (!uniqueStrings(evidence)) {
    return false;
  }
  if (
    UNCERTIFIABLE_PLATFORM_IDS.includes(platformId) &&
    reviewed !== "UNSUPPORTED"
  ) {
    return false;
  }
  if (!CERTIFIED_SUPPORT_TIERS.includes(reviewed)) {
    return true;
  }
  return (
    CERTIFIED_PLATFORM_IDS.includes(platformId) &&
    text(claim, "review_state") === "REVIEW_COMPLETE" &&
    present(claim, "evaluated_commit") &&
    present(claim, "evaluated_tree") &&
    present(claim, "reviewer_identity_ref") &&
    evidence.length > 0
  );
}

function platformReviewedTierIsCertified(value: unknown): boolean {
  const claim = objectMember(value, "support_claim");
  return CERTIFIED_SUPPORT_TIERS.includes(text(claim, "reviewed_tier") ?? "");
}

function platformTargetSupportClaim(value: unknown): boolean {
  const platformId = text(value, "platform_id");
  const reasons = items(value, "reason_codes");
  if (
    platformId === null ||
    !uniqueStrings(reasons) ||
    !platformSupportClaimSound(value)
  ) {
    return false;
  }
  const expectedArchitecture = PLATFORM_ARCHITECTURE_BY_ID[platformId];
  if (
    expectedArchitecture !== undefined &&
    text(value, "architecture") !== expectedArchitecture
  ) {
    return false;
  }
  if (!platformReviewedTierIsCertified(value)) {
    return reasons.length > 0;
  }
  return (
    reasons.length === 0 &&
    text(value, "detection_method") === "MEASURED_NATIVE_RUN"
  );
}

function platformCapabilityReportIntegrity(value: unknown): boolean {
  const capabilities = items(value, "capabilities");
  if (
    !uniqueField(capabilities, "capability") ||
    capabilities.length !== PLATFORM_CAPABILITY_FAMILIES.length ||
    !PLATFORM_CAPABILITY_FAMILIES.every((family) =>
      capabilities.some((state) => text(state, "capability") === family),
    ) ||
    !capabilities.every(platformCapabilityStateSound) ||
    !uniqueStrings(items(value, "model_profile_refs")) ||
    !uniqueStrings(items(value, "diagnostic_refs")) ||
    !platformSupportClaimSound(value)
  ) {
    return false;
  }
  const availabilityOf = (family: string): string | null => {
    const found = capabilities.find(
      (state) => text(state, "capability") === family,
    );
    return found === undefined ? null : text(found, "availability");
  };
  if (
    text(value, "packaging_channel") === "RELEASE_STABLE" &&
    availabilityOf("PACKAGING_UPDATE_CHANNEL") !== "AVAILABLE"
  ) {
    return false;
  }
  if (!platformReviewedTierIsCertified(value)) {
    return true;
  }
  if (
    !MANDATORY_CORE_CAPABILITIES.every(
      (family) => availabilityOf(family) === "AVAILABLE",
    )
  ) {
    return false;
  }
  const claim = objectMember(value, "support_claim");
  if (text(claim, "reviewed_tier") !== "CERTIFIED_FULL") {
    // A missing or unavailable local-AI profile never downgrades the
    // deterministic core tier; CERTIFIED_CORE deliberately imposes no
    // MODEL_RUNTIME requirement.
    return true;
  }
  return (
    availabilityOf("MODEL_RUNTIME") === "AVAILABLE" &&
    items(value, "model_profile_refs").length > 0
  );
}

function platformPathRequestSafety(value: unknown): boolean {
  if (!platformRequestAuthority(value)) {
    return false;
  }
  return (
    text(value, "scope") !== "SYSTEM" ||
    text(value, "role") === "NATIVE_HOST_REGISTRATION"
  );
}

function platformPathResolutionSafety(value: unknown): boolean {
  const role = text(value, "role");
  const reasons = items(value, "reason_codes");
  const sanitized = text(value, "sanitized_path");
  if (
    role === null ||
    !uniqueStrings(reasons) ||
    (text(value, "scope") === "SYSTEM" && role !== "NATIVE_HOST_REGISTRATION")
  ) {
    return false;
  }
  if (text(value, "resolution_state") !== "RESOLVED") {
    return (
      sanitized === null &&
      !present(value, "path_digest") &&
      flag(value, "exists") === false &&
      flag(value, "writable") === false &&
      reasons.length > 0
    );
  }
  return (
    sanitized !== null &&
    sanitized.startsWith("<" + role + ">") &&
    present(value, "path_digest") &&
    reasons.length === 0 &&
    (flag(value, "writable") !== true || flag(value, "exists") === true)
  );
}

function platformSecretRequestAuthority(value: unknown): boolean {
  const context = objectMember(value, "request_context");
  const operation = text(value, "operation");
  const redaction = objectMember(value, "redaction");
  if (!platformRequestAuthority(value)) {
    return false;
  }
  if (
    text(context, "authorization_profile") === "VERIFICATION" &&
    operation !== "STATUS"
  ) {
    return false;
  }
  if (
    redaction !== null &&
    (text(redaction, "sensitivity") !== "SECRET" ||
      text(redaction, "policy") !== "FORBID_CAPTURE")
  ) {
    return false;
  }
  if (operation === "PUT") {
    return (
      present(value, "material_reference") && present(value, "material_digest")
    );
  }
  return (
    !present(value, "material_reference") && !present(value, "material_digest")
  );
}

function platformSecretResultIntegrity(value: unknown): boolean {
  const operation = text(value, "operation");
  const availability = text(value, "store_availability");
  const state = text(value, "result_state");
  const reasons = items(value, "reason_codes");
  const hasMaterial = present(value, "material_reference");
  const hasDigest = present(value, "material_digest");
  if (!uniqueStrings(reasons)) {
    return false;
  }
  if (availability === "AVAILABLE") {
    if (!present(value, "store_identity_token")) {
      return false;
    }
  } else if (hasMaterial) {
    return false;
  }
  const storeUnavailableAvailability =
    availability !== null &&
    ![
      "AVAILABLE",
      "DEGRADED_LIMITED",
      "PERMISSION_REQUIRED",
    ].includes(availability);
  const deniedAvailability = ["PERMISSION_REQUIRED", "UNAVAILABLE"].includes(
    availability ?? "",
  );
  if (operation === "STATUS") {
    if (hasMaterial || hasDigest) {
      return false;
    }
    if (state === "STORE_AVAILABLE") {
      return availability === "AVAILABLE" && reasons.length === 0;
    }
    if (state === "DENIED_PERMISSION") {
      return reasons.includes("PERMISSION_DENIED") && deniedAvailability;
    }
    if (state === "STORE_UNAVAILABLE") {
      return reasons.length > 0 && storeUnavailableAvailability;
    }
    return false;
  }
  if (state === "STORE_AVAILABLE") {
    return false;
  }
  if (state === "RETRIEVED") {
    return (
      operation === "GET" &&
      availability === "AVAILABLE" &&
      hasMaterial &&
      hasDigest &&
      reasons.length === 0
    );
  }
  if (state === "STORED") {
    return (
      operation === "PUT" &&
      availability === "AVAILABLE" &&
      hasMaterial &&
      reasons.length === 0
    );
  }
  if (state === "DELETED") {
    return (
      operation === "DELETE" &&
      availability === "AVAILABLE" &&
      !hasMaterial &&
      !hasDigest &&
      reasons.length === 0
    );
  }
  if (state === "DENIED_PERMISSION") {
    return (
      !hasMaterial &&
      !hasDigest &&
      reasons.includes("PERMISSION_DENIED") &&
      deniedAvailability
    );
  }
  if (state === "STORE_UNAVAILABLE") {
    return (
      !hasMaterial &&
      !hasDigest &&
      reasons.length > 0 &&
      storeUnavailableAvailability
    );
  }
  return !hasMaterial && !hasDigest && reasons.length > 0;
}

function platformProcessPlanSafety(value: unknown): boolean {
  const profile = text(value, "profile");
  const environment = items(value, "environment_allowlist");
  const commandArguments = items(value, "arguments");
  const binary = [text(value, "stdin_mode"), text(value, "stdout_mode")];
  if (
    !platformRequestAuthority(value) ||
    flag(value, "inherit_parent_environment") !== false ||
    !present(value, "executable_digest") ||
    !uniqueField(environment, "variable") ||
    text(value, "working_directory_role") === "NATIVE_HOST_REGISTRATION"
  ) {
    return false;
  }
  if (
    commandArguments.some(
      (argument) =>
        typeof argument === "string" &&
        PLATFORM_INTERPRETER_TOKENS.includes(argument.toLowerCase()),
    )
  ) {
    return false;
  }
  for (const entry of environment) {
    const variable = text(entry, "variable");
    const entryValue = text(entry, "value");
    if (entryValue === null) {
      return false;
    }
    if (variable === "JAPP_SERVICE_PORT" && !/^[0-9]{1,5}$/.test(entryValue)) {
      return false;
    }
    if (
      variable === "JAPP_PATH_ROLE" &&
      !/^[A-Z][A-Z0-9_]{1,63}$/.test(entryValue)
    ) {
      return false;
    }
  }
  if (
    text(value, "lifecycle_mode") === "ONE_SHOT" &&
    numberValue(value, "max_restart_attempts") !== 0
  ) {
    return false;
  }
  if (profile === "NATIVE_MESSAGING_HOST") {
    return binary.every((mode) => mode === "BINARY_LENGTH_PREFIXED");
  }
  return binary.every((mode) => mode !== "BINARY_LENGTH_PREFIXED");
}

function platformProcessStatusIntegrity(value: unknown): boolean {
  const state = text(value, "state");
  const reasons = items(value, "reason_codes");
  const ended = present(value, "ended_at");
  const started = present(value, "started_at");
  const exited = present(value, "exit_code");
  const orphan = flag(value, "orphan_detected");
  if (!uniqueStrings(reasons)) {
    return false;
  }
  if (ended && started && !timestampNotBefore(value, "ended_at", "started_at")) {
    return false;
  }
  if (orphan === true && state !== "ORPHANED") {
    return false;
  }
  if (state === "STARTING" || state === "RUNNING") {
    return !ended && !exited && orphan === false;
  }
  if (state === "TERMINATING") {
    return (
      !ended && !exited && text(value, "termination_requested") !== "NONE"
    );
  }
  if (state === "EXITED") {
    return started && ended && exited && reasons.length === 0;
  }
  if (state === "TERMINATED") {
    return (
      started && ended && text(value, "termination_requested") !== "NONE"
    );
  }
  if (state === "ORPHANED") {
    return orphan === true && reasons.length > 0;
  }
  if (state === "UNAVAILABLE") {
    return !started && !ended && !exited && reasons.length > 0;
  }
  return reasons.length > 0;
}

function platformNativeRegistrationBinding(value: unknown): boolean {
  const operation = text(value, "operation");
  const extensions = items(value, "allowed_extension_ids");
  if (
    !platformRequestAuthority(value) ||
    text(value, "browser_family") !== "CHROME" ||
    text(value, "browser_channel") !== "STABLE" ||
    text(value, "binary_stdio_mode") !== "BINARY_LENGTH_PREFIXED" ||
    text(value, "manifest_location_role") !== "NATIVE_HOST_REGISTRATION" ||
    !strictlySortedStrings(extensions)
  ) {
    return false;
  }
  if (operation === "REMOVE") {
    return (
      !present(value, "expected_manifest_digest") &&
      !present(value, "expected_host_binary_digest")
    );
  }
  if (operation === "VERIFY") {
    return present(value, "expected_manifest_digest");
  }
  return (
    present(value, "expected_manifest_digest") &&
    present(value, "expected_host_binary_digest")
  );
}

function platformNativeRegistrationResult(value: unknown): boolean {
  const operation = text(value, "operation");
  const observed = text(value, "observed_state");
  const reasons = items(value, "reason_codes");
  const changed = flag(value, "changed");
  if (
    !uniqueStrings(reasons) ||
    text(value, "browser_family") !== "CHROME" ||
    (operation === "VERIFY" && changed !== false)
  ) {
    return false;
  }
  if (observed === "PRESENT_VALID") {
    if (
      !present(value, "observed_manifest_digest") ||
      !present(value, "observed_host_version") ||
      reasons.length > 0
    ) {
      return false;
    }
  } else if (reasons.length === 0) {
    return false;
  }
  if (observed === "MISMATCHED_IDENTITY" && !reasons.includes("IDENTITY_MISMATCH")) {
    return false;
  }
  if (observed === "NOT_EVALUATED") {
    return changed === false && reasons.includes("EVALUATION_NOT_RUN");
  }
  if (reasons.length === 0) {
    const expected = operation === "REMOVE" ? "ABSENT" : "PRESENT_VALID";
    return (
      observed === expected && flag(value, "idempotent_repeat_safe") === true
    );
  }
  return true;
}

function platformBrowserDiscoverySafety(value: unknown): boolean {
  if (
    !platformRequestAuthority(value) ||
    text(value, "browser_family") !== "CHROME" ||
    text(value, "browser_channel") !== "STABLE"
  ) {
    return false;
  }
  return (
    flag(value, "include_capability_probe") !== true ||
    CERTIFIED_PLATFORM_IDS.includes(text(value, "platform_id") ?? "")
  );
}

function platformBrowserRecordScope(value: unknown): boolean {
  const presence = text(value, "presence");
  const reasons = items(value, "reason_codes");
  const capability = objectMember(value, "native_messaging_capability");
  if (
    !uniqueStrings(reasons) ||
    capability === null ||
    !platformCapabilityStateSound(capability) ||
    text(capability, "capability") !== "NATIVE_MESSAGING"
  ) {
    return false;
  }
  if (presence === "AVAILABLE") {
    if (!present(value, "detected_version")) {
      return false;
    }
  } else if (present(value, "sanitized_install_location")) {
    return false;
  }
  if (flag(value, "certified_for_platform") !== true) {
    return reasons.length > 0;
  }
  return (
    reasons.length === 0 &&
    presence === "AVAILABLE" &&
    text(value, "browser_family") === "CHROME" &&
    text(value, "browser_channel") === "STABLE" &&
    CERTIFIED_PLATFORM_IDS.includes(text(value, "platform_id") ?? "") &&
    text(value, "detection_method") === "MEASURED_NATIVE_RUN" &&
    text(capability, "availability") === "AVAILABLE" &&
    present(value, "last_tested_on")
  );
}

function platformModelProfileEvidence(value: unknown): boolean {
  const platformId = text(value, "platform_id") ?? "";
  const accelerator = text(value, "accelerator");
  const family = text(value, "runtime_family");
  const reasons = items(value, "reason_codes");
  const evidence = items(value, "evidence_refs");
  if (!uniqueStrings(reasons) || !uniqueStrings(evidence)) {
    return false;
  }
  if (accelerator === "APPLE_SILICON_GPU" && platformId !== "MACOS_ARM64") {
    return false;
  }
  if (
    accelerator === "NVIDIA_CUDA" &&
    (!present(value, "minimum_vram_mib") ||
      !present(value, "minimum_driver_version"))
  ) {
    return false;
  }
  if (accelerator === "CPU_ONLY" && present(value, "minimum_vram_mib")) {
    return false;
  }
  if (
    family === "OLLAMA_MLX" &&
    (platformId !== "MACOS_ARM64" || accelerator !== "APPLE_SILICON_GPU")
  ) {
    return false;
  }
  if (family === "OLLAMA_GGUF" && accelerator === "APPLE_SILICON_GPU") {
    return false;
  }
  if (text(value, "acceptance_state") !== "ACCEPTED") {
    return (
      reasons.length > 0 &&
      text(value, "core_capability_behavior") !== "FULL_AI_AVAILABLE"
    );
  }
  return (
    CERTIFIED_PLATFORM_IDS.includes(platformId) &&
    reasons.length === 0 &&
    evidence.length > 0 &&
    text(value, "availability") === "AVAILABLE" &&
    text(value, "core_capability_behavior") === "FULL_AI_AVAILABLE" &&
    present(value, "structured_output_evidence_ref") &&
    present(value, "factuality_evidence_ref") &&
    present(value, "latency_evidence_ref") &&
    present(value, "memory_evidence_ref") &&
    present(value, "last_tested_on")
  );
}

function platformRuntimeCapabilityFallback(value: unknown): boolean {
  const available = items(value, "available_profile_refs");
  const accepted = items(value, "accepted_profile_refs");
  const reasons = items(value, "reason_codes");
  const behavior = text(value, "core_capability_behavior");
  if (
    !uniqueStrings(available) ||
    !uniqueStrings(accepted) ||
    !uniqueStrings(reasons) ||
    !subsetOf(accepted, available)
  ) {
    return false;
  }
  if (
    text(value, "detection_method") === "NOT_EVALUATED" &&
    text(value, "runtime_availability") !== "NOT_EVALUATED"
  ) {
    return false;
  }
  if (text(value, "runtime_availability") !== "AVAILABLE") {
    return (
      available.length === 0 &&
      accepted.length === 0 &&
      reasons.length > 0 &&
      behavior !== "FULL_AI_AVAILABLE"
    );
  }
  if (
    !present(value, "runtime_family") ||
    !present(value, "runtime_version") ||
    !present(value, "accelerator")
  ) {
    return false;
  }
  return behavior === "FULL_AI_AVAILABLE"
    ? accepted.length > 0
    : accepted.length === 0;
}

function platformPackageStateEvidence(value: unknown): boolean {
  const state = text(value, "state") ?? "";
  const reasons = items(value, "reason_codes");
  const signature = text(value, "signature_state");
  const interrupted = flag(value, "interrupted");
  const preservation = text(value, "user_data_preservation");
  if (
    !uniqueStrings(reasons) ||
    !uniqueStrings(items(value, "evidence_refs")) ||
    (interrupted === true && !reasons.includes("INTERRUPTED")) ||
    (flag(value, "recovery_completed") === true && interrupted !== true) ||
    (preservation === "PRESERVATION_FAILED" && reasons.length === 0)
  ) {
    return false;
  }
  if (
    (signature === "SIGNATURE_INVALID" || signature === "SIGNATURE_MISSING") &&
    !reasons.includes("SIGNATURE_NOT_VERIFIED")
  ) {
    return false;
  }
  if (PACKAGE_FAILURE_STATES.includes(state) && reasons.length === 0) {
    return false;
  }
  if (PACKAGE_SUCCESS_STATES.includes(state)) {
    if (
      signature !== "SIGNATURE_VALID" ||
      reasons.length > 0 ||
      interrupted !== false ||
      !["EXPLICIT_DELETION_REQUESTED", "PRESERVED"].includes(
        preservation ?? "",
      ) ||
      items(value, "evidence_refs").length === 0
    ) {
      return false;
    }
  }
  if (state === "UNINSTALLED") {
    return ["NOT_APPLICABLE", "REMOVED"].includes(
      text(value, "native_host_cleanup") ?? "",
    );
  }
  if (state === "INSTALLED") {
    return (
      present(value, "installed_version") &&
      text(value, "installed_version") === text(value, "package_version")
    );
  }
  if (state === "NOT_INSTALLED") {
    return !present(value, "installed_version");
  }
  if (state === "NO_UPDATE_AVAILABLE") {
    return !present(value, "available_version");
  }
  if (state === "UPDATE_AVAILABLE") {
    return present(value, "available_version");
  }
  if (state === "UPDATE_INSTALLED") {
    return (
      present(value, "installed_version") &&
      present(value, "available_version") &&
      present(value, "target_artifact")
    );
  }
  if (state === "ROLLED_BACK") {
    return (
      present(value, "rolled_back_to_version") &&
      flag(value, "rollback_available") === true
    );
  }
  return true;
}

function platformDiagnosticIntegrity(value: unknown): boolean {
  const result = text(value, "result");
  const severity = text(value, "severity");
  const reasons = items(value, "reason_codes");
  const blocking = flag(value, "blocking");
  const component = text(value, "component") ?? "";
  const expectedCapability = DIAGNOSTIC_CAPABILITY_BY_COMPONENT[component];
  if (
    !uniqueStrings(reasons) ||
    !uniqueStrings(items(value, "evidence_refs")) ||
    (expectedCapability !== undefined &&
      text(value, "capability") !== expectedCapability)
  ) {
    return false;
  }
  if (
    present(value, "user_message") &&
    text(objectMember(value, "redaction"), "policy") !== "NONE"
  ) {
    return false;
  }
  if (blocking === true && result !== "BLOCKED" && result !== "FAILURE") {
    return false;
  }
  if (result === "SUCCESS") {
    return blocking === false && reasons.length === 0 && severity === "INFO";
  }
  if (reasons.length === 0) {
    return false;
  }
  if (result === "WARNING") {
    return blocking === false && ["INFO", "WARNING"].includes(severity ?? "");
  }
  if (result === "FAILURE") {
    return ["CRITICAL", "ERROR"].includes(severity ?? "");
  }
  return blocking === true;
}

function platformEvidenceIntegrity(value: unknown): boolean {
  const reasons = items(value, "reason_codes");
  const method = text(value, "evaluation_method");
  const artifactKind = text(value, "artifact_kind") ?? "";
  const requiredReference = EVIDENCE_REFERENCE_BY_ARTIFACT_KIND[artifactKind];
  if (
    !uniqueStrings(reasons) ||
    flag(value, "synthetic_only") !== true ||
    (requiredReference !== undefined && !present(value, requiredReference)) ||
    (present(value, "package_artifact") && !present(value, "signature_state"))
  ) {
    return false;
  }
  if (
    text(value, "review_state") === "REVIEW_COMPLETE" &&
    !present(value, "reviewer_identity_ref")
  ) {
    return false;
  }
  if (
    text(value, "owner_decision_state") === "RECORDED" &&
    text(value, "review_state") !== "REVIEW_COMPLETE"
  ) {
    return false;
  }
  if (method === "MEASURED_NATIVE_RUN") {
    if (
      !present(value, "os_version") ||
      !present(value, "os_build") ||
      text(value, "machine_class") === "SYNTHETIC_FIXTURE" ||
      !CERTIFIED_PLATFORM_IDS.includes(text(value, "platform_id") ?? "")
    ) {
      return false;
    }
  } else if (
    text(value, "machine_class") === "PHYSICAL_DEVELOPMENT_MACHINE" ||
    text(value, "machine_class") === "HOSTED_CI_RUNNER"
  ) {
    if (method !== "STATIC_INSPECTION") {
      return false;
    }
  }
  return text(value, "result") === "SUCCESS"
    ? reasons.length === 0
    : reasons.length > 0;
}

function platformCertificationInputScope(value: unknown): boolean {
  const required = items(value, "required_evidence_kinds");
  const presentKinds = items(value, "present_evidence_kinds");
  const records = items(value, "evidence_record_refs");
  const reasons = items(value, "reason_codes");
  if (
    !strictlySortedStrings(required) ||
    !strictlySortedStrings(presentKinds) ||
    !uniqueStrings(records) ||
    !uniqueStrings(reasons) ||
    !platformSupportClaimSound(value)
  ) {
    return false;
  }
  const complete = subsetOf(required, presentKinds) && records.length > 0;
  if (flag(value, "inventory_complete") !== complete) {
    return false;
  }
  if (
    (text(value, "owner_decision_state") === "RECORDED") !==
    present(value, "owner_decision_ref")
  ) {
    return false;
  }
  if (!platformReviewedTierIsCertified(value)) {
    return reasons.length > 0;
  }
  return (
    reasons.length === 0 &&
    complete &&
    text(value, "owner_decision_state") === "RECORDED"
  );
}

const RULE_EVALUATORS: Readonly<Record<SemanticRuleKindV1, RuleEvaluator>> =
  Object.freeze({
    APPLICATION_SESSION_CONSISTENCY: applicationSessionConsistency,
    ATOMIC_CLAIM_INTEGRITY: atomicClaimIntegrity,
    ATS_VARIANT_SCOPE: atsVariantScope,
    BENCHMARK_CASE_INTEGRITY: benchmarkCaseIntegrity,
    BENCHMARK_RESULT_INTEGRITY: benchmarkResultIntegrity,
    DRIVER_VERIFIED_EVIDENCE: driverVerifiedEvidence,
    FIELD_ADDRESS_IDENTITY: fieldAddressIdentity,
    FIELD_DECISION_AUTHORITY: fieldDecisionAuthority,
    FIELD_DESCRIPTOR_OBSERVATION: fieldDescriptorObservation,
    GATE_DECISION_INTEGRITY: gateDecisionIntegrity,
    GATE_EVIDENCE_COMPLETENESS: gateEvidenceCompleteness,
    GUIDED_RUN_SAFETY: guidedRunSafety,
    HOLDOUT_MANIFEST_INTEGRITY: holdoutManifestIntegrity,
    INERT_TEXT_SAFETY: inertTextSafe,
    LAYOUT_MEASUREMENT_INTEGRITY: layoutMeasurementIntegrity,
    NAVIGATION_SAFETY: navigationSafety,
    PAGE_READINESS_INTEGRITY: pageReadinessIntegrity,
    PLATFORM_BROWSER_DISCOVERY_SAFETY: platformBrowserDiscoverySafety,
    PLATFORM_BROWSER_RECORD_SCOPE: platformBrowserRecordScope,
    PLATFORM_CAPABILITY_REPORT_INTEGRITY: platformCapabilityReportIntegrity,
    PLATFORM_CERTIFICATION_INPUT_SCOPE: platformCertificationInputScope,
    PLATFORM_DIAGNOSTIC_INTEGRITY: platformDiagnosticIntegrity,
    PLATFORM_EVIDENCE_INTEGRITY: platformEvidenceIntegrity,
    PLATFORM_MODEL_PROFILE_EVIDENCE: platformModelProfileEvidence,
    PLATFORM_NATIVE_REGISTRATION_BINDING: platformNativeRegistrationBinding,
    PLATFORM_NATIVE_REGISTRATION_RESULT: platformNativeRegistrationResult,
    PLATFORM_PACKAGE_STATE_EVIDENCE: platformPackageStateEvidence,
    PLATFORM_PATH_REQUEST_SAFETY: platformPathRequestSafety,
    PLATFORM_PATH_RESOLUTION_SAFETY: platformPathResolutionSafety,
    PLATFORM_PROCESS_PLAN_SAFETY: platformProcessPlanSafety,
    PLATFORM_PROCESS_STATUS_INTEGRITY: platformProcessStatusIntegrity,
    PLATFORM_RUNTIME_CAPABILITY_FALLBACK: platformRuntimeCapabilityFallback,
    PLATFORM_SECRET_REQUEST_AUTHORITY: platformSecretRequestAuthority,
    PLATFORM_SECRET_RESULT_INTEGRITY: platformSecretResultIntegrity,
    PLATFORM_TARGET_SUPPORT_CLAIM: platformTargetSupportClaim,
    RECONCILIATION_READINESS: reconciliationReadiness,
    RESUME_PLAN_EVIDENCE: resumePlanEvidence,
    WORKDAY_CERTIFICATION_SCOPE: workdayCertificationScope,
    WORKDAY_STEP_BOUNDARY: workdayStepBoundary,
    WORKDAY_TENANT_IDENTITY: workdayTenantIdentity,
  });

export interface SemanticValidationIssueV1 {
  readonly rule_id: SemanticRuleIdV1;
  readonly rule_kind: SemanticRuleKindV1;
  readonly error_code: ErrorTaxonomyV1ErrorCode;
}

export type SemanticValidationOutcomeV1 =
  | { readonly valid: true; readonly issues: readonly [] }
  | {
      readonly valid: false;
      readonly issues: readonly SemanticValidationIssueV1[];
    };

/**
 * Evaluate every reviewed semantic rule bound to a structurally valid root.
 * Entries and issues are ordered by canonical rule_id. Unbound schemas have
 * no second-phase rules and return valid; unknown schema references still
 * fail structural validation before this helper may be called.
 */
export function validateSemanticContractV1(
  schemaRef: string,
  value: unknown,
): SemanticValidationOutcomeV1 {
  const issues: SemanticValidationIssueV1[] = [];
  for (const entry of SEMANTIC_RULES_V1) {
    if (
      entry.schema_ref === schemaRef &&
      !RULE_EVALUATORS[entry.rule_kind](value)
    ) {
      issues.push({
        rule_id: entry.rule_id,
        rule_kind: entry.rule_kind,
        error_code: entry.failure_error_code,
      });
    }
  }
  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}
