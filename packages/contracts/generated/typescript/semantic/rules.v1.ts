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
  | "RECONCILIATION_READINESS"
  | "RESUME_PLAN_EVIDENCE"
  | "WORKDAY_CERTIFICATION_SCOPE"
  | "WORKDAY_STEP_BOUNDARY"
  | "WORKDAY_TENANT_IDENTITY";

export type SemanticRuleIdV1 = "APPLICATION_SESSION_CONSISTENCY" | "APPLICATION_SESSION_INERT_TEXT" | "ATOMIC_CLAIM_INERT_TEXT" | "ATOMIC_CLAIM_INTEGRITY" | "ATS_VARIANT_INERT_TEXT" | "ATS_VARIANT_SCOPE" | "BENCHMARK_CASE_INERT_TEXT" | "BENCHMARK_CASE_INTEGRITY" | "BENCHMARK_RESULT_INERT_TEXT" | "BENCHMARK_RESULT_INTEGRITY" | "DRIVER_RESULT_INERT_TEXT" | "DRIVER_VERIFIED_EVIDENCE" | "FIELD_ADDRESS_IDENTITY" | "FIELD_ADDRESS_INERT_TEXT" | "FIELD_DECISION_AUTHORITY" | "FIELD_DECISION_INERT_TEXT" | "FIELD_DESCRIPTOR_INERT_TEXT" | "FIELD_DESCRIPTOR_OBSERVATION" | "GATE_DECISION_INERT_TEXT" | "GATE_DECISION_INTEGRITY" | "GATE_EVIDENCE_COMPLETENESS" | "GATE_EVIDENCE_INERT_TEXT" | "GUIDED_RUN_INERT_TEXT" | "GUIDED_RUN_SAFETY" | "HOLDOUT_MANIFEST_INERT_TEXT" | "HOLDOUT_MANIFEST_INTEGRITY" | "LAYOUT_MEASUREMENT_INERT_TEXT" | "LAYOUT_MEASUREMENT_INTEGRITY" | "NAVIGATION_INERT_TEXT" | "NAVIGATION_SAFETY" | "PAGE_READINESS_INERT_TEXT" | "PAGE_READINESS_INTEGRITY" | "RECONCILIATION_INERT_TEXT" | "RECONCILIATION_READINESS" | "RESUME_PLAN_EVIDENCE" | "RESUME_PLAN_INERT_TEXT" | "WORKDAY_CERTIFICATION_INERT_TEXT" | "WORKDAY_CERTIFICATION_SCOPE" | "WORKDAY_STEP_BOUNDARY" | "WORKDAY_STEP_INERT_TEXT" | "WORKDAY_TENANT_IDENTITY" | "WORKDAY_TENANT_INERT_TEXT";

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
