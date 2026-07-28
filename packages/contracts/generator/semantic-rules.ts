/**
 * Canonical semantic-rule pipeline (M01-W06).
 *
 * JSON Schema remains structural truth. This module validates the single
 * reviewed semantic-rule catalog, rejects any expression/operator/code
 * vocabulary, and emits matching TypeScript/Python evaluators for the finite
 * built-in rule kinds below. Catalog content is data only and is never
 * executed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SchemaCatalog } from "../src/catalog.ts";
import { walkSchemaNodes } from "../src/conventions.ts";
import { isJsonObject, type JsonObject } from "../src/json.ts";
import type { ContractValidator } from "../src/validator.ts";
import type { GeneratedFile } from "./emit-typescript.ts";
import type { LoadedErrorCatalog } from "./error-catalog.ts";
import { pythonStringLiteral } from "./emit-python.ts";

export const SEMANTIC_RULE_CATALOG_SCHEMA_ID =
  "urn:japp:schema:semantic:rule-catalog:v1";
export const SEMANTIC_RULE_CATALOG_FILE = "semantic-rules.v1.json";

export const SUPPORTED_SEMANTIC_RULE_KINDS = [
  "APPLICATION_SESSION_CONSISTENCY",
  "ATOMIC_CLAIM_INTEGRITY",
  "ATS_VARIANT_SCOPE",
  "BENCHMARK_CASE_INTEGRITY",
  "BENCHMARK_RESULT_INTEGRITY",
  "DRIVER_VERIFIED_EVIDENCE",
  "FIELD_ADDRESS_IDENTITY",
  "FIELD_DECISION_AUTHORITY",
  "FIELD_DESCRIPTOR_OBSERVATION",
  "GATE_DECISION_INTEGRITY",
  "GATE_EVIDENCE_COMPLETENESS",
  "GUIDED_RUN_SAFETY",
  "HOLDOUT_MANIFEST_INTEGRITY",
  "INERT_TEXT_SAFETY",
  "LAYOUT_MEASUREMENT_INTEGRITY",
  "NAVIGATION_SAFETY",
  "PAGE_READINESS_INTEGRITY",
  "PLATFORM_BROWSER_DISCOVERY_SAFETY",
  "PLATFORM_BROWSER_RECORD_SCOPE",
  "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
  "PLATFORM_CERTIFICATION_INPUT_SCOPE",
  "PLATFORM_DIAGNOSTIC_INTEGRITY",
  "PLATFORM_EVIDENCE_INTEGRITY",
  "PLATFORM_MODEL_PROFILE_EVIDENCE",
  "PLATFORM_NATIVE_REGISTRATION_BINDING",
  "PLATFORM_NATIVE_REGISTRATION_RESULT",
  "PLATFORM_PACKAGE_STATE_EVIDENCE",
  "PLATFORM_PATH_REQUEST_SAFETY",
  "PLATFORM_PATH_RESOLUTION_SAFETY",
  "PLATFORM_PROCESS_PLAN_SAFETY",
  "PLATFORM_PROCESS_STATUS_INTEGRITY",
  "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
  "PLATFORM_SECRET_REQUEST_AUTHORITY",
  "PLATFORM_SECRET_RESULT_INTEGRITY",
  "PLATFORM_TARGET_SUPPORT_CLAIM",
  "RECONCILIATION_READINESS",
  "RESUME_PLAN_EVIDENCE",
  "WORKDAY_CERTIFICATION_SCOPE",
  "WORKDAY_STEP_BOUNDARY",
  "WORKDAY_TENANT_IDENTITY",
] as const;

export type SemanticRuleKind = (typeof SUPPORTED_SEMANTIC_RULE_KINDS)[number];

export interface SemanticRuleEntryData {
  readonly rule_id: string;
  readonly rule_version: string;
  readonly schema_ref: string;
  readonly rule_kind: SemanticRuleKind;
  readonly failure_error_code: string;
}

export interface LoadedSemanticRules {
  readonly version: string;
  readonly entries: readonly SemanticRuleEntryData[];
  readonly rawText: string;
  readonly repositoryPath: string;
}

export class SemanticRuleCatalogError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      "the canonical semantic-rule catalog violates its contract:\n" +
        violations.map((violation) => `  - ${violation}`).join("\n"),
    );
    this.name = "SemanticRuleCatalogError";
    this.violations = violations;
  }
}

const REQUIRED_RULE_KINDS_BY_SCHEMA = new Map<
  string,
  ReadonlySet<SemanticRuleKind>
>([
  [
    "urn:japp:schema:ats:variant-identity:v1",
    new Set(["ATS_VARIANT_SCOPE", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:benchmark:case:v1",
    new Set(["BENCHMARK_CASE_INTEGRITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:benchmark:holdout-manifest:v1",
    new Set(["HOLDOUT_MANIFEST_INTEGRITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:benchmark:result:v1",
    new Set(["BENCHMARK_RESULT_INTEGRITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:form:driver-result:v1",
    new Set(["DRIVER_VERIFIED_EVIDENCE", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:form:field-address:v1",
    new Set(["FIELD_ADDRESS_IDENTITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:form:field-decision:v1",
    new Set(["FIELD_DECISION_AUTHORITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:form:field-descriptor:v1",
    new Set(["FIELD_DESCRIPTOR_OBSERVATION", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:form:reconciliation-inventory:v1",
    new Set(["INERT_TEXT_SAFETY", "RECONCILIATION_READINESS"]),
  ],
  [
    "urn:japp:schema:gate:decision:v1",
    new Set(["GATE_DECISION_INTEGRITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:gate:evidence-bundle:v1",
    new Set(["GATE_EVIDENCE_COMPLETENESS", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:platform:browser-discovery-request:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_BROWSER_DISCOVERY_SAFETY"]),
  ],
  [
    "urn:japp:schema:platform:browser-record:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_BROWSER_RECORD_SCOPE"]),
  ],
  [
    "urn:japp:schema:platform:capability-report:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_CAPABILITY_REPORT_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:platform:certification-input:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_CERTIFICATION_INPUT_SCOPE"]),
  ],
  [
    "urn:japp:schema:platform:diagnostic-report:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_DIAGNOSTIC_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:platform:evidence-record:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_EVIDENCE_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:platform:installer-state:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PACKAGE_STATE_EVIDENCE"]),
  ],
  [
    "urn:japp:schema:platform:model-runtime-profile:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_MODEL_PROFILE_EVIDENCE"]),
  ],
  [
    "urn:japp:schema:platform:native-messaging-registration:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_NATIVE_REGISTRATION_BINDING"]),
  ],
  [
    "urn:japp:schema:platform:native-messaging-result:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_NATIVE_REGISTRATION_RESULT"]),
  ],
  [
    "urn:japp:schema:platform:path-request:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PATH_REQUEST_SAFETY"]),
  ],
  [
    "urn:japp:schema:platform:path-resolution:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PATH_RESOLUTION_SAFETY"]),
  ],
  [
    "urn:japp:schema:platform:process-plan:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PROCESS_PLAN_SAFETY"]),
  ],
  [
    "urn:japp:schema:platform:process-status:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PROCESS_STATUS_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:platform:runtime-capability:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_RUNTIME_CAPABILITY_FALLBACK"]),
  ],
  [
    "urn:japp:schema:platform:secret-store-request:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_SECRET_REQUEST_AUTHORITY"]),
  ],
  [
    "urn:japp:schema:platform:secret-store-result:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_SECRET_RESULT_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:platform:target-identity:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_TARGET_SUPPORT_CLAIM"]),
  ],
  [
    "urn:japp:schema:platform:update-state:v1",
    new Set(["INERT_TEXT_SAFETY", "PLATFORM_PACKAGE_STATE_EVIDENCE"]),
  ],
  [
    "urn:japp:schema:rendering:layout-measurement:v1",
    new Set(["INERT_TEXT_SAFETY", "LAYOUT_MEASUREMENT_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:resume:atomic-claim:v1",
    new Set(["ATOMIC_CLAIM_INTEGRITY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:resume:plan:v1",
    new Set(["INERT_TEXT_SAFETY", "RESUME_PLAN_EVIDENCE"]),
  ],
  [
    "urn:japp:schema:session:application-session:v1",
    new Set(["APPLICATION_SESSION_CONSISTENCY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:session:guided-run-mode:v1",
    new Set(["GUIDED_RUN_SAFETY", "INERT_TEXT_SAFETY"]),
  ],
  [
    "urn:japp:schema:session:navigation-record:v1",
    new Set(["INERT_TEXT_SAFETY", "NAVIGATION_SAFETY"]),
  ],
  [
    "urn:japp:schema:session:page-readiness-proof:v1",
    new Set(["INERT_TEXT_SAFETY", "PAGE_READINESS_INTEGRITY"]),
  ],
  [
    "urn:japp:schema:workday:certification-record:v1",
    new Set(["INERT_TEXT_SAFETY", "WORKDAY_CERTIFICATION_SCOPE"]),
  ],
  [
    "urn:japp:schema:workday:step-identity:v1",
    new Set(["INERT_TEXT_SAFETY", "WORKDAY_STEP_BOUNDARY"]),
  ],
  [
    "urn:japp:schema:workday:tenant-fingerprint:v1",
    new Set(["INERT_TEXT_SAFETY", "WORKDAY_TENANT_IDENTITY"]),
  ],
]);

const FORBIDDEN_PROPERTY_NAMES = new Set([
  "auth_token",
  "case_bodies",
  "case_body",
  "credential",
  "encryption_key",
  "executable",
  "hidden_case_bodies",
  "html",
  "javascript",
  "password",
  "private_key",
  "raw_selector",
  "script",
  "selector",
  "xpath",
]);

const FORBIDDEN_ENUM_TOKENS = new Set([
  "AUTO_SUBMIT",
  "FINAL_SUBMIT",
  "SUBMIT",
]);

function semanticKindTokens(catalog: SchemaCatalog): string[] {
  const schema = catalog.byId.get(SEMANTIC_RULE_CATALOG_SCHEMA_ID)?.document;
  const defs = schema?.$defs;
  const ruleKind =
    isJsonObject(defs) && isJsonObject(defs.ruleKind) ? defs.ruleKind : null;
  if (ruleKind === null || !Array.isArray(ruleKind.enum)) {
    throw new SemanticRuleCatalogError([
      `${SEMANTIC_RULE_CATALOG_SCHEMA_ID}#/$defs/ruleKind must declare an enum`,
    ]);
  }
  return ruleKind.enum.filter(
    (token): token is string => typeof token === "string",
  );
}

function checkForbiddenSchemaSurface(
  schemaId: string,
  document: JsonObject,
  violations: string[],
): void {
  walkSchemaNodes(document, (node, pointer) => {
    const properties = node.properties;
    if (isJsonObject(properties)) {
      for (const name of Object.keys(properties)) {
        if (FORBIDDEN_PROPERTY_NAMES.has(name)) {
          violations.push(
            `${schemaId}${pointer}: prohibited executable/secret field ${name}`,
          );
        }
      }
    }
    if (Array.isArray(node.enum)) {
      for (const token of node.enum) {
        if (typeof token === "string" && FORBIDDEN_ENUM_TOKENS.has(token)) {
          violations.push(
            `${schemaId}${pointer}: prohibited consequential enum token ${token}`,
          );
        }
      }
    }
  });
}

function sameSet<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

export function loadSemanticRules(options: {
  readonly catalogRoot: string;
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
  readonly errorCatalog: LoadedErrorCatalog;
}): LoadedSemanticRules {
  const absolute = join(options.catalogRoot, SEMANTIC_RULE_CATALOG_FILE);
  let rawText: string;
  try {
    rawText = readFileSync(absolute, "utf8");
  } catch (error) {
    throw new SemanticRuleCatalogError([
      `cannot read ${absolute} (${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new SemanticRuleCatalogError([
      `semantic-rule catalog is not valid JSON (${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  const structural = options.validator.validateInstance(
    SEMANTIC_RULE_CATALOG_SCHEMA_ID,
    parsed,
  );
  if (!structural.valid) {
    throw new SemanticRuleCatalogError(
      structural.errors.map(
        (message) => `schema validation failed: ${message}`,
      ),
    );
  }

  const document = parsed as JsonObject;
  const version = document.catalog_version as string;
  const entries = (document.entries as unknown[]).map(
    (entry) => entry as SemanticRuleEntryData,
  );
  const violations: string[] = [];
  const schemaKinds = semanticKindTokens(options.catalog);
  if (
    JSON.stringify(schemaKinds) !==
    JSON.stringify(SUPPORTED_SEMANTIC_RULE_KINDS)
  ) {
    violations.push(
      "ruleKind schema enum must exactly match the built-in finite evaluator vocabulary",
    );
  }
  const errorCodes = new Set(
    options.errorCatalog.entries.map((entry) => entry.code),
  );
  const seenRuleIds = new Set<string>();
  const seenBindings = new Set<string>();
  const kindsBySchema = new Map<string, Set<SemanticRuleKind>>();
  let previousRuleId = "";
  for (const entry of entries) {
    if (previousRuleId !== "" && previousRuleId >= entry.rule_id) {
      violations.push(
        `${entry.rule_id}: entries must be strictly sorted by rule_id`,
      );
    }
    previousRuleId = entry.rule_id;
    if (seenRuleIds.has(entry.rule_id)) {
      violations.push(`${entry.rule_id}: duplicate rule id`);
    }
    seenRuleIds.add(entry.rule_id);
    if (entry.schema_ref.includes("#")) {
      violations.push(
        `${entry.rule_id}: semantic rules bind only root schemas`,
      );
    }
    const schema = options.catalog.byId.get(entry.schema_ref);
    if (schema?.document.type !== "object") {
      violations.push(
        `${entry.rule_id}: schema_ref must name a committed root object schema`,
      );
    }
    if (!errorCodes.has(entry.failure_error_code)) {
      violations.push(
        `${entry.rule_id}: failure_error_code is absent from the error catalog`,
      );
    }
    const binding = `${entry.schema_ref}/${entry.rule_kind}`;
    if (seenBindings.has(binding)) {
      violations.push(`${entry.rule_id}: duplicate semantic rule binding`);
    }
    seenBindings.add(binding);
    const kinds = kindsBySchema.get(entry.schema_ref) ?? new Set();
    kinds.add(entry.rule_kind);
    kindsBySchema.set(entry.schema_ref, kinds);
  }
  for (const [schemaRef, expectedKinds] of REQUIRED_RULE_KINDS_BY_SCHEMA) {
    const actualKinds = kindsBySchema.get(schemaRef) ?? new Set();
    if (!sameSet(actualKinds, expectedKinds)) {
      violations.push(
        `${schemaRef}: expected rule kinds ${[...expectedKinds].sort().join(", ")}`,
      );
    }
    const document = options.catalog.byId.get(schemaRef)?.document;
    if (document !== undefined) {
      checkForbiddenSchemaSurface(schemaRef, document, violations);
    }
  }
  for (const schemaRef of kindsBySchema.keys()) {
    if (!REQUIRED_RULE_KINDS_BY_SCHEMA.has(schemaRef)) {
      violations.push(`${schemaRef}: semantic rule binding is not implemented`);
    }
  }
  const usedKinds = new Set(entries.map((entry) => entry.rule_kind));
  if (
    !sameSet(
      usedKinds,
      new Set<SemanticRuleKind>(SUPPORTED_SEMANTIC_RULE_KINDS),
    )
  ) {
    violations.push(
      "semantic catalog must exercise every built-in rule kind and no others",
    );
  }
  if (violations.length > 0) {
    throw new SemanticRuleCatalogError(violations);
  }
  return {
    version,
    entries,
    rawText,
    repositoryPath: "packages/contracts/catalog/semantic-rules.v1.json",
  };
}

function tsHeader(): string {
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Regenerate with: pnpm generate:contracts
 *
 * Source of truth: packages/contracts/catalog/semantic-rules.v1.json
 * Validated against: urn:japp:schema:semantic:rule-catalog:v1
 *
 * Structural validation must succeed before these finite semantic rules run.
 * Catalog content is inert data: no expression, path, operator, or code is
 * interpreted.
 */`;
}

function tsEntries(entries: readonly SemanticRuleEntryData[]): string {
  return entries
    .map(
      (entry) => `  Object.freeze({
    rule_id: ${JSON.stringify(entry.rule_id)},
    rule_version: ${JSON.stringify(entry.rule_version)},
    schema_ref: ${JSON.stringify(entry.schema_ref)},
    rule_kind: ${JSON.stringify(entry.rule_kind)},
    failure_error_code: ${JSON.stringify(entry.failure_error_code)},
  }),`,
    )
    .join("\n");
}

const TYPESCRIPT_SEMANTIC_RUNTIME = String.raw`
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
const REGISTRATION_TERMINAL_STATE: Readonly<Record<string, string>> = {
  INSTALL: "PRESENT_VALID",
  REMOVE: "ABSENT",
  REPAIR: "PRESENT_VALID",
  UPDATE: "PRESENT_VALID",
  VERIFY: "PRESENT_VALID",
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

/**
 * A record that names a certified target must report that target's processor
 * architecture from the specification §5.14.1 matrix. An uncertifiable target
 * stays unconstrained so an honest UNKNOWN_ARCHITECTURE observation remains
 * representable.
 */
function platformArchitectureCoherent(value: unknown): boolean {
  const expected = PLATFORM_ARCHITECTURE_BY_ID[text(value, "platform_id") ?? ""];
  return expected === undefined || text(value, "architecture") === expected;
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
  if (!platformArchitectureCoherent(value)) {
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
  const binary = [
    text(value, "stdin_mode"),
    text(value, "stdout_mode"),
    text(value, "stderr_mode"),
  ];
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
    // Specification §5.14.5 places the length-prefixed native-messaging
    // protocol on binary stdin/stdout. stderr stays a diagnostic channel and
    // must never silently become a second protocol stream.
    return (
      text(value, "stdin_mode") === "BINARY_LENGTH_PREFIXED" &&
      text(value, "stdout_mode") === "BINARY_LENGTH_PREFIXED" &&
      text(value, "stderr_mode") !== "BINARY_LENGTH_PREFIXED"
    );
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
  const operation = text(value, "operation") ?? "";
  const observed = text(value, "observed_state");
  const reasons = items(value, "reason_codes");
  const changed = flag(value, "changed");
  const succeeded = reasons.length === 0;
  const manifestDigest = present(value, "observed_manifest_digest");
  const hostVersion = present(value, "observed_host_version");
  if (
    !uniqueStrings(reasons) ||
    text(value, "browser_family") !== "CHROME" ||
    (operation === "VERIFY" && changed !== false)
  ) {
    return false;
  }
  // Each diagnostic reason names the exact state it explains, so neither the
  // state nor its reason may be reported without the other.
  if (
    (observed === "MISMATCHED_IDENTITY") !==
      reasons.includes("IDENTITY_MISMATCH") ||
    (observed === "NOT_EVALUATED") !== reasons.includes("EVALUATION_NOT_RUN")
  ) {
    return false;
  }
  // Observed identity is evidence of a manifest that is really present: it is
  // mandatory for PRESENT_VALID and impossible once nothing is registered or
  // nothing was evaluated.
  if (
    observed === "PRESENT_VALID" &&
    !(manifestDigest && hostVersion && succeeded)
  ) {
    return false;
  }
  if (
    (observed === "ABSENT" || observed === "NOT_EVALUATED") &&
    (manifestDigest || hostVersion)
  ) {
    return false;
  }
  if (observed === "NOT_EVALUATED") {
    return changed === false;
  }
  // Zero reasons is a success claim. It is admissible only in the terminal
  // state the operation is defined to reach, and only when repeating the same
  // intent is guaranteed to be a no-op (specification §5.14.5 idempotency).
  if (succeeded) {
    return (
      observed === REGISTRATION_TERMINAL_STATE[operation] &&
      flag(value, "idempotent_repeat_safe") === true
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
    !platformArchitectureCoherent(value) ||
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
    !platformArchitectureCoherent(value) ||
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
    !platformArchitectureCoherent(value) ||
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
`;

export function emitTypescriptSemanticRules(
  loaded: LoadedSemanticRules,
): GeneratedFile {
  const ruleKinds = SUPPORTED_SEMANTIC_RULE_KINDS.map(
    (kind) => `  | ${JSON.stringify(kind)}`,
  ).join("\n");
  const ruleIds = loaded.entries
    .map((entry) => JSON.stringify(entry.rule_id))
    .join(" | ");
  const content = `${tsHeader()}

import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

export type SemanticRuleKindV1 =
${ruleKinds};

export type SemanticRuleIdV1 = ${ruleIds};

export interface SemanticRuleEntryV1 {
  readonly rule_id: SemanticRuleIdV1;
  readonly rule_version: string;
  readonly schema_ref: string;
  readonly rule_kind: SemanticRuleKindV1;
  readonly failure_error_code: ErrorTaxonomyV1ErrorCode;
}

/** Immutable reviewed semantic-rule bindings, sorted by rule_id. */
export const SEMANTIC_RULES_V1: readonly SemanticRuleEntryV1[] = Object.freeze([
${tsEntries(loaded.entries)}
]);
${TYPESCRIPT_SEMANTIC_RUNTIME}`;
  return { path: "typescript/semantic/rules.v1.ts", content };
}

function pyEntries(entries: readonly SemanticRuleEntryData[]): string {
  return entries
    .map(
      (entry) => `    SemanticRuleEntryV1(
        rule_id=${pythonStringLiteral(entry.rule_id)},
        rule_version=${pythonStringLiteral(entry.rule_version)},
        schema_ref=${pythonStringLiteral(entry.schema_ref)},
        rule_kind=${pythonStringLiteral(entry.rule_kind)},
        failure_error_code=${pythonStringLiteral(entry.failure_error_code)},
    ),`,
    )
    .join("\n");
}

const PYTHON_SEMANTIC_RUNTIME = String.raw`
def _record(value: object) -> dict[str, object] | None:
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return cast("dict[str, object]", value)
    return None


def _member(value: object, name: str) -> object | None:
    record = _record(value)
    return None if record is None else record.get(name)


def _text(value: object, name: str) -> str | None:
    candidate = _member(value, name)
    return candidate if isinstance(candidate, str) else None


def _number(value: object, name: str) -> int | float | None:
    candidate = _member(value, name)
    if type(candidate) is int:
        return candidate
    if type(candidate) is float:
        return candidate
    return None


def _flag(value: object, name: str) -> bool | None:
    candidate = _member(value, name)
    return candidate if type(candidate) is bool else None


def _items(value: object, name: str) -> list[object]:
    candidate = _member(value, name)
    return cast("list[object]", candidate) if isinstance(candidate, list) else []


def _object_member(value: object, name: str) -> dict[str, object] | None:
    return _record(_member(value, name))


def _unique_strings(values: list[object]) -> bool:
    return all(isinstance(value, str) for value in values) and len(
        cast("set[str]", set(values))
    ) == len(values)


def _unique_field(values: list[object], name: str) -> bool:
    selected: list[object] = [_text(value, name) for value in values]
    return all(value is not None for value in selected) and _unique_strings(selected)


def _present(value: object, name: str) -> bool:
    return _member(value, name) is not None


def _text_one_of(value: object, name: str, allowed: frozenset[str]) -> bool:
    candidate = _text(value, name)
    return candidate is not None and candidate in allowed


def _subset_of(inner: list[object], outer: list[object]) -> bool:
    return all(item in outer for item in inner)


def _strictly_sorted_strings(values: list[object]) -> bool:
    return all(isinstance(value, str) for value in values) and all(
        cast("str", values[index - 1]) < cast("str", values[index])
        for index in range(1, len(values))
    )


def _strictly_sorted_field(values: list[object], name: str) -> bool:
    selected: list[object] = [_text(value, name) for value in values]
    return _strictly_sorted_strings(selected)


def _unique_number_field(values: list[object], name: str) -> bool:
    selected = [_number(value, name) for value in values]
    return all(value is not None for value in selected) and len(
        set(cast("list[int | float]", selected))
    ) == len(selected)


def _all_flags(value: object, names: tuple[str, ...]) -> bool:
    return all(_flag(value, name) is True for name in names)


def _utc_timestamp_key(value: object, name: str) -> str | None:
    candidate = _text(value, name)
    if candidate is None:
        return None
    match = re.fullmatch(
        r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z",
        candidate,
    )
    if match is None:
        return None
    return match.group(1) + "." + (match.group(2) or "").ljust(9, "0")


def _timestamp_not_before(
    value: object,
    later_name: str,
    earlier_name: str,
) -> bool:
    later = _utc_timestamp_key(value, later_name)
    earlier = _utc_timestamp_key(value, earlier_name)
    return later is not None and earlier is not None and later >= earlier


def _inert_text_safe(value: object, depth: int = 0) -> bool:
    if depth > 64:
        return False
    if isinstance(value, str):
        lower = value.lower()
        return not (
            value.startswith("/")
            or re.match(r"^[A-Za-z]:[\\/]", value) is not None
            or "<script" in lower
            or "javascript:" in lower
            or "xpath:" in lower
            or "document." in lower
            or "window." in lower
            or "onload=" in lower
            or "onclick=" in lower
            or "password=" in lower
            or "credential=" in lower
            or "token=" in lower
            or "begin private key" in lower
            or "$(" in value
            or "=>" in value
            or "../" in value
            or "..\\" in value
        )
    if isinstance(value, list):
        return all(_inert_text_safe(item, depth + 1) for item in value)
    record = _record(value)
    return record is None or all(
        _inert_text_safe(item, depth + 1) for item in record.values()
    )


def _field_address_identity(value: object) -> bool:
    signals: list[object] = [
        _text(value, "route_signature"),
        _text(value, "application_root_fingerprint"),
        _text(value, "accessible_name_fingerprint"),
        _text(value, "attribute_fingerprint"),
        _text(value, "option_fingerprint"),
        "SECTION_PATH" if _items(value, "section_path") else None,
        "REPEATER_PATH" if _items(value, "repeater_path") else None,
    ]
    return len([signal for signal in signals if signal is not None]) >= 2 and (
        _unique_field(_items(value, "repeater_path"), "stable_item_key")
    )


def _field_descriptor_observation(value: object) -> bool:
    address = _object_member(value, "address")
    label = _object_member(value, "label")
    description = _object_member(value, "description")
    options = _items(value, "options")
    return (
        address is not None
        and _field_address_identity(address)
        and _number(value, "observed_dom_generation")
        == _number(address, "observed_dom_generation")
        and _flag(label, "untrusted") is True
        and (description is None or _flag(description, "untrusted") is True)
        and _unique_field(options, "value_digest")
        and all(
            _flag(_object_member(option, "label"), "untrusted") is True
            for option in options
        )
    )


def _field_decision_authority(value: object) -> bool:
    final_decision = _text(value, "final_decision")
    source = _text(value, "value_source_type")
    policy = _text(value, "policy_decision")
    sensitivity = _text(value, "sensitivity_class")
    confirmation = _text(value, "confirmation_state")
    classification = _number(value, "classification_confidence") or 0
    confidence = _number(value, "value_confidence") or 0
    reasons = _items(value, "reason_codes")
    confirmation_required = (
        policy == "REQUIRE_CONFIRMATION"
        or sensitivity in {"SENSITIVE", "SECRET"}
    )
    confirmation_valid = confirmation == "VALID" and isinstance(
        _member(value, "user_confirmation_ref"), str
    )
    fill_sources = {
        "ANSWER_POLICY",
        "APPROVED_DOCUMENT",
        "DETERMINISTIC_DERIVATION",
        "USER_CONFIRMATION",
        "USER_RECORD",
    }
    proposal_sources = fill_sources | {"MODEL_PROPOSAL"}
    if not _unique_strings(reasons):
        return False
    if confirmation == "VALID" and not confirmation_valid:
        return False
    if policy in {"DENY", "UNSUPPORTED"} and final_decision in {"FILL", "PROPOSE"}:
        return False
    if source in {"MODEL_PROPOSAL", "NONE"} and final_decision == "FILL":
        return False
    if confirmation in {"EXPIRED", "MISSING", "REVOKED"}:
        return final_decision == "PAUSE_FOR_CONFIRMATION"
    if classification < 0.5 and "LOW_CLASSIFICATION_CONFIDENCE" not in reasons:
        return False
    if confidence < 0.5 and "LOW_VALUE_CONFIDENCE" not in reasons:
        return False
    if final_decision == "PROPOSE":
        return source in proposal_sources and isinstance(
            _member(value, "value_source_ref"), str
        )
    if final_decision != "FILL":
        return True
    return (
        source in fill_sources
        and isinstance(_member(value, "value_source_ref"), str)
        and classification >= 0.75
        and confidence >= 0.75
        and (
            policy == "PERMIT"
            or (policy == "REQUIRE_CONFIRMATION" and confirmation_valid)
        )
        and (not confirmation_required or confirmation_valid)
    )


def _driver_verified_evidence(value: object) -> bool:
    address = _object_member(value, "field_address")
    preconditions = _object_member(value, "preconditions")
    intended = _object_member(value, "intended_value")
    immediate = _object_member(value, "observed_value_immediate")
    settled = _object_member(value, "observed_value_settled")
    if (
        address is None
        or not _field_address_identity(address)
        or preconditions is None
        or intended is None
        or immediate is None
        or settled is None
        or _text(value, "session_id") != _text(address, "session_id")
        or _number(value, "starting_dom_generation")
        != _number(address, "observed_dom_generation")
        or not _unique_strings(_items(value, "conditional_field_ids"))
    ):
        return False
    uncertain = (
        _text(value, "resolution_result") != "UNIQUE"
        or _text(value, "site_acceptance") == "UNKNOWN"
    )
    if uncertain and _flag(value, "safe_retry_allowed") is True:
        return False
    if _text(value, "outcome") != "VERIFIED":
        return True
    return (
        _text(value, "resolution_result") == "UNIQUE"
        and _all_flags(
            preconditions,
            ("visible", "enabled", "generation_matched", "policy_permitted"),
        )
        and _text(intended, "semantic_digest")
        == _text(immediate, "semantic_digest")
        == _text(settled, "semantic_digest")
        and _text(intended, "presence")
        == _text(immediate, "presence")
        == _text(settled, "presence")
        and _flag(value, "persistence_verified") is True
        and _text(value, "site_acceptance") == "ACCEPTED"
        and _number(value, "starting_dom_generation")
        == _number(value, "settled_dom_generation")
        and not _items(value, "validation_message_digests")
    )


def _reconciliation_readiness(value: object) -> bool:
    inventory = _items(value, "items")
    counts = _object_member(value, "counts")
    if (
        counts is None
        or not _unique_field(inventory, "item_id")
        or _number(counts, "total") != len(inventory)
    ):
        return False
    categories = {
        "verified_filled": "VERIFIED_FILLED",
        "needs_review": "NEEDS_REVIEW",
        "blocked_sensitive": "BLOCKED_SENSITIVE",
        "unsupported_or_skipped": "UNSUPPORTED_OR_SKIPPED",
        "required_unresolved": "REQUIRED_UNRESOLVED",
        "page_changed_value": "PAGE_CHANGED_VALUE",
    }
    for count_name, category in categories.items():
        if _number(counts, count_name) != len(
            [item for item in inventory if _text(item, "category") == category]
        ):
            return False
    stale = len(
        [item for item in inventory if _text(item, "document_state") == "STALE"]
    )
    unconfirmed = len(
        [
            item
            for item in inventory
            if _text(item, "confirmation_state") in {"EXPIRED", "MISSING", "REVOKED"}
        ]
    )
    uncertain = len(
        [item for item in inventory if _flag(item, "mandatory_uncertain") is True]
    )
    changed = len(
        [item for item in inventory if _flag(item, "changed_value") is True]
    )
    if (
        _number(counts, "page_changed_value") != changed
        or _number(counts, "stale_document") != stale
        or _number(counts, "unconfirmed_consequential") != unconfirmed
        or _number(counts, "mandatory_uncertain") != uncertain
    ):
        return False
    for item in inventory:
        if (
            (_flag(item, "changed_value") is True)
            != (_text(item, "category") == "PAGE_CHANGED_VALUE")
        ):
            return False
        if (
            _flag(item, "required") is True
            and _flag(item, "visible") is True
            and _flag(item, "enabled") is True
            and _text(item, "category")
            not in {
                "VERIFIED_FILLED",
                "REQUIRED_UNRESOLVED",
                "BLOCKED_SENSITIVE",
            }
        ):
            return False
    if _text(value, "readiness") != "READY":
        return True
    return (
        _number(value, "page_generation") == _number(value, "proof_generation")
        and all(
            _number(counts, name) == 0
            for name in (
                "required_unresolved",
                "blocked_sensitive",
                "page_changed_value",
                "stale_document",
                "unconfirmed_consequential",
                "mandatory_uncertain",
            )
        )
    )


def _ats_variant_scope(value: object) -> bool:
    return (
        _text(value, "ats_family") != "UNKNOWN"
        and _text(value, "session_mode") != "UNKNOWN"
        and _text(value, "route_page_family") not in {"ALL", "UNIVERSAL", "UNKNOWN"}
    )


def _workday_tenant_identity(value: object) -> bool:
    controls = _items(value, "control_family_inventory")
    return (
        bool(controls)
        and _unique_strings(controls)
        and _text(value, "hostname_family") != "UNKNOWN"
        and _text(value, "candidate_session_mode") != "UNKNOWN"
        and _text(value, "route_family") not in {"ALL", "UNIVERSAL", "UNKNOWN"}
        and _text(value, "page_sequence_family")
        not in {"ALL", "UNIVERSAL", "UNKNOWN"}
    )


def _workday_step_boundary(value: object) -> bool:
    signals = _items(value, "recognition_signals")
    if (
        len(signals) < 2
        or not _unique_field(signals, "kind")
        or len({_text(signal, "kind") for signal in signals}) < 2
    ):
        return False
    expected = {
        "GUEST_APPLICATION": "ORDINARY_APPLICATION",
        "AUTHENTICATED_APPLICATION": "ORDINARY_APPLICATION",
        "LOGIN": "PROTECTED_AUTHENTICATION",
        "ACCOUNT_CREATION": "PROTECTED_AUTHENTICATION",
        "EMAIL_VERIFICATION": "PROTECTED_AUTHENTICATION",
        "MFA": "PROTECTED_AUTHENTICATION",
        "EXPIRED_SESSION": "PROTECTED_AUTHENTICATION",
        "CAPTCHA": "PROTECTED_HUMAN_VERIFICATION",
        "LEGAL_CONSENT_BOUNDARY": "PROTECTED_LEGAL_OR_CONSENT",
        "FINAL_REVIEW": "FINAL_REVIEW_BOUNDARY",
        "DUPLICATE_APPLICATION": "UNKNOWN_OR_UNSUPPORTED",
        "UNKNOWN_UNSUPPORTED": "UNKNOWN_OR_UNSUPPORTED",
    }
    step_family = _text(value, "step_family")
    return (
        step_family is not None
        and expected.get(step_family) == _text(value, "boundary_class")
    )


def _page_readiness_integrity(value: object) -> bool:
    step = _object_member(value, "step_identity")
    counts = _object_member(value, "blocking_counts")
    if (
        step is None
        or counts is None
        or not _workday_step_boundary(step)
        or _text(value, "session_id") != _text(step, "session_id")
        or _number(value, "page_generation")
        != _number(step, "observed_dom_generation")
    ):
        return False
    if _text(value, "readiness") != "READY":
        return True
    next_control = _object_member(value, "next_control")
    return (
        _text(step, "step_family") != "UNKNOWN_UNSUPPORTED"
        and _text(step, "boundary_class") == "ORDINARY_APPLICATION"
        and _text(value, "site_validation_status") == "ACCEPTED"
        and all(
            _number(counts, name) == 0
            for name in (
                "unresolved_count",
                "changed_value_count",
                "stale_document_count",
                "sensitive_confirmation_count",
                "mandatory_uncertain_count",
            )
        )
        and next_control is not None
        and _text(next_control, "resolution") == "UNIQUE"
    )


def _navigation_safety(value: object) -> bool:
    source = _object_member(value, "source_step_identity")
    control = _object_member(value, "navigation_control")
    postconditions = _object_member(value, "postconditions")
    destination = _object_member(value, "observed_destination_identity")
    allowed = _items(value, "allowed_destination_families")
    if (
        source is None
        or control is None
        or postconditions is None
        or not _workday_step_boundary(source)
        or _text(value, "session_id") != _text(source, "session_id")
        or _number(value, "source_page_generation")
        != _number(source, "observed_dom_generation")
        or _text(control, "resolution") != "UNIQUE"
        or not _unique_strings(allowed)
    ):
        return False
    expected = _text(value, "expected_destination_family")
    if expected is not None and expected not in allowed:
        return False
    outcome = _text(value, "outcome")
    if outcome in {"UNCERTAIN_TRANSITION", "PAUSED_BOUNDARY"} and (
        _flag(value, "safe_retry_allowed") is True
    ):
        return False
    if destination is not None and (
        not _workday_step_boundary(destination)
        or _text(value, "session_id") != _text(destination, "session_id")
    ):
        return False
    if outcome == "PAUSED_BOUNDARY" and (
        destination is None
        or _text(destination, "boundary_class") == "ORDINARY_APPLICATION"
    ):
        return False
    if (
        destination is not None
        and _text(destination, "boundary_class") != "ORDINARY_APPLICATION"
    ):
        return outcome == "PAUSED_BOUNDARY"
    if outcome != "VERIFIED_TRANSITION":
        return True
    return (
        destination is not None
        and _text(source, "boundary_class") == "ORDINARY_APPLICATION"
        and _text(destination, "step_family") in allowed
        and (
            expected is None
            or expected == _text(destination, "step_family")
        )
        and _number(value, "observed_resulting_generation") is not None
        and _number(value, "observed_resulting_generation")
        == _number(destination, "observed_dom_generation")
        and _number(value, "observed_resulting_generation")
        != _number(value, "source_page_generation")
        and _all_flags(
            postconditions,
            (
                "source_generation_changed",
                "destination_recognized",
                "source_control_absent_or_inactive",
            ),
        )
    )


def _guided_run_safety(value: object) -> bool:
    snapshots = _object_member(value, "snapshot_readiness")
    if snapshots is None:
        return False
    allowed = (
        _text(value, "page_eligibility") == "CERTIFIED_APPLICATION_PAGE"
        and all(
            _text(snapshots, name) == "READY"
            for name in ("profile", "document", "answer_policy")
        )
        and _flag(value, "visible_cancel_control") is True
        and _text(value, "revocation_state") == "ACTIVE"
    )
    if _text(value, "start_permission") == "START_ALLOWED" and not allowed:
        return False
    if (
        _text(value, "revocation_state") != "ACTIVE"
        and _text(value, "start_permission") != "START_BLOCKED"
    ):
        return False
    if _text(value, "start_policy") != "AUTO_START_ON_OPEN":
        return True
    return (
        _text(value, "run_kind") == "GUIDED_PRE_SUBMIT"
        and isinstance(_member(value, "prior_opt_in_ref"), str)
        and isinstance(_member(value, "certified_pattern_ref"), str)
        and isinstance(_member(value, "cancelable_start_ref"), str)
        and allowed
    )


def _application_session_consistency(value: object) -> bool:
    step = _object_member(value, "current_step")
    ats = _object_member(value, "ats_variant")
    mode = _object_member(value, "guided_run_mode")
    tenant = _object_member(value, "workday_tenant_fingerprint")
    if (
        step is None
        or ats is None
        or mode is None
        or not _ats_variant_scope(ats)
        or not _guided_run_safety(mode)
        or not _workday_step_boundary(step)
        or (tenant is not None and not _workday_tenant_identity(tenant))
        or _text(value, "session_id") != _text(step, "session_id")
        or _number(value, "current_page_generation")
        != _number(step, "observed_dom_generation")
        or (tenant is not None and _text(ats, "ats_family") != "WORKDAY")
        or not _timestamp_not_before(value, "updated_at", "created_at")
    ):
        return False
    lifecycle = _text(value, "lifecycle_state")
    if lifecycle in {"PAUSED", "CANCELED"} and not isinstance(
        _member(value, "pause_or_cancel_reason"), str
    ):
        return False
    return not (
        _text(mode, "start_permission") == "START_ALLOWED"
        and (
            lifecycle != "ACTIVE"
            or _text(value, "revalidation_state") != "CURRENT"
        )
    )


def _workday_certification_scope(value: object) -> bool:
    tenant = _object_member(value, "tenant_fingerprint")
    metrics = _object_member(value, "metrics")
    routes = _items(value, "route_page_sequence")
    controls = _items(value, "control_families")
    if (
        tenant is None
        or metrics is None
        or not _workday_tenant_identity(tenant)
        or not _unique_strings(routes)
        or not _unique_strings(controls)
        or _text(value, "locale") != _text(tenant, "locale")
        or _text(value, "session_mode") != _text(tenant, "candidate_session_mode")
        or _text(value, "adapter_version") != _text(tenant, "adapter_version")
        or not all(
            control in _items(tenant, "control_family_inventory")
            for control in controls
        )
        or any(str(route) in {"ALL", "UNIVERSAL"} for route in routes)
    ):
        return False
    if _text(value, "certification_state") != "CERTIFIED":
        return True
    return (
        _text(value, "measured_scope_digest")
        == _text(value, "certified_scope_digest")
        and _text(tenant, "hostname_family") != "UNKNOWN"
        and _text(tenant, "candidate_session_mode") != "UNKNOWN"
        and (_number(metrics, "case_count") or 0) > 0
        and bool(_items(value, "evidence_report_refs"))
    )


def _benchmark_case_integrity(value: object) -> bool:
    return (
        _unique_field(_items(value, "thresholds"), "metric_id")
        and _unique_field(_items(value, "input_artifacts"), "artifact_ref")
        and _unique_field(_items(value, "input_artifacts"), "artifact_digest")
        and _unique_strings(_items(value, "applicable_platform_profiles"))
    )


def _benchmark_result_integrity(value: object) -> bool:
    metrics = _items(value, "metric_results")
    failure_errors = _items(value, "failure_error_codes")
    completeness = _text(value, "completeness_state")
    environment = _text(value, "environment_match_state")
    hashes = _text(value, "hash_state")
    holdout = _text(value, "holdout_state")
    if (
        not _unique_field(metrics, "metric_id")
        or _text(value, "case_threshold_set_digest")
        != _text(value, "evaluated_threshold_set_digest")
        or not all(
            _text(metric, "threshold_digest")
            == _text(value, "case_threshold_set_digest")
            for metric in metrics
        )
        or not _timestamp_not_before(value, "ended_at", "started_at")
    ):
        return False
    comparable = (
        completeness == "COMPLETE"
        and environment == "MATCH"
        and hashes == "MATCH"
        and holdout in {"VALID", "NOT_APPLICABLE"}
    )
    if _flag(value, "comparable") is not comparable:
        return False
    outcome = _text(value, "overall_outcome")
    if outcome == "PASS":
        return (
            comparable
            and not failure_errors
            and all(_flag(metric, "passed") is True for metric in metrics)
        )
    if outcome == "FAIL":
        return (
            not comparable
            or bool(failure_errors)
            or any(_flag(metric, "passed") is False for metric in metrics)
        )
    return True


def _holdout_manifest_integrity(value: object) -> bool:
    case_ids = _items(value, "case_ids")
    schema_versions = _items(value, "schema_versions")
    categories = _items(value, "category_counts")
    files = _items(value, "files")
    category_counts = [_number(item, "count") for item in categories]
    file_counts = [_number(item, "case_count") for item in files]
    if any(count is None for count in category_counts + file_counts):
        return False
    category_total = sum(cast("list[int | float]", category_counts))
    file_total = sum(cast("list[int | float]", file_counts))
    return (
        _strictly_sorted_strings(case_ids)
        and _strictly_sorted_field(schema_versions, "schema_ref")
        and _strictly_sorted_field(categories, "category")
        and _strictly_sorted_field(files, "file_id")
        and _unique_field(files, "content_digest")
        and _number(value, "case_count") == len(case_ids)
        and category_total == len(case_ids)
        and file_total == len(case_ids)
        and _flag(value, "synthetic_only") is True
        and (
            _text(value, "storage_policy") == "ENCRYPTED_BUNDLE_REFERENCE"
        )
        is (_object_member(value, "encrypted_bundle") is not None)
    )


def _gate_evidence_completeness(value: object) -> bool:
    inventory = _object_member(value, "completeness_inventory")
    results = _items(value, "benchmark_result_refs")
    if (
        inventory is None
        or not _unique_strings(results)
        or not _unique_strings(_items(value, "raw_artifact_report_digests"))
        or not _unique_strings(_items(value, "manual_inspection_evidence_refs"))
        or _number(inventory, "present_benchmark_count") != len(results)
    ):
        return False
    if _text(value, "bundle_state") != "COMPLETE":
        return True
    return (
        _number(inventory, "required_benchmark_count") == len(results)
        and _all_flags(
            inventory,
            (
                "corpus_valid",
                "holdout_valid",
                "raw_artifacts_complete",
                "manual_inspection_complete",
                "independent_review_complete",
                "owner_decision_complete",
            ),
        )
        and (
            _text(inventory, "owner_decision_requirement") == "REQUIRED"
        )
        is isinstance(_member(value, "owner_decision_ref"), str)
    )


def _gate_decision_integrity(value: object) -> bool:
    summary = _object_member(value, "threshold_evidence_summary")
    if (
        summary is None
        or not _unique_strings(_items(value, "reason_codes"))
        or not _unique_strings(_items(value, "error_codes"))
    ):
        return False
    if _text(value, "decision") == "REDESIGN_REQUIRED" and not isinstance(
        _member(value, "redesign_adr_ref"), str
    ):
        return False
    if _text(value, "decision") != "PASS":
        return True
    return (
        _all_flags(
            summary,
            (
                "evidence_complete",
                "required_benchmark_results_complete",
                "thresholds_passed",
                "corpus_valid",
                "holdout_valid",
            ),
        )
        and _text(value, "independent_review_state") == "COMPLETE"
        and _text(value, "owner_decision_state") in {"COMPLETE", "NOT_REQUIRED"}
        and not _items(value, "error_codes")
    )


def _resume_plan_evidence(value: object) -> bool:
    requirements = _items(value, "ordered_requirements")
    assignments = _items(value, "evidence_assignments")
    gaps = _items(value, "unsupported_gap_refs")
    budget = _object_member(value, "budget")
    if (
        budget is None
        or not _unique_field(requirements, "requirement_ref")
        or not _unique_number_field(requirements, "priority")
        or not _unique_field(assignments, "requirement_ref")
        or not _unique_strings(gaps)
        or not _unique_strings(_items(value, "locked_content_refs"))
        or (_number(budget, "section_word_budget") or 0)
        > (_number(budget, "global_word_budget") or 0)
    ):
        return False
    by_id = {
        requirement_ref: item
        for item in requirements
        if (requirement_ref := _text(item, "requirement_ref")) is not None
    }
    assigned_requirement_refs = {
        assignment_ref
        for assignment in assignments
        if (assignment_ref := _text(assignment, "requirement_ref")) is not None
    }
    gap_requirement_refs = {
        gap for gap in gaps if isinstance(gap, str)
    }
    for assignment in assignments:
        assignment_ref = _text(assignment, "requirement_ref")
        requirement = (
            None if assignment_ref is None else by_id.get(assignment_ref)
        )
        if (
            requirement is None
            or _flag(requirement, "supported") is not True
            or not _unique_strings(_items(assignment, "evidence_refs"))
        ):
            return False
    for requirement in requirements:
        requirement_ref = _text(requirement, "requirement_ref")
        supported = _flag(requirement, "supported")
        if (
            requirement_ref is None
            or supported is None
            or (requirement_ref in assigned_requirement_refs) is not supported
            or (requirement_ref in gap_requirement_refs) is supported
        ):
            return False
    return all(
        by_id.get(str(gap)) is not None
        and _flag(by_id[str(gap)], "supported") is False
        for gap in gaps
    )


def _atomic_claim_integrity(value: object) -> bool:
    status = _text(value, "verification_status")
    eligible = _flag(value, "release_eligible")
    if (
        not _unique_strings(_items(value, "evidence_refs"))
        or not _unique_strings(_items(value, "rejection_error_codes"))
        or _flag(value, "canonical_evidence_mutation") is not False
        or (eligible is True and status != "SUPPORTED")
    ):
        return False
    if status == "SUPPORTED":
        return bool(_items(value, "evidence_refs")) and _text(
            value, "user_action"
        ) == "NONE"
    if status == "PARTIALLY_SUPPORTED":
        return eligible is False and _text(value, "user_action") == "EDIT_AND_APPROVE"
    return eligible is False and _text(value, "user_action") != "NONE"


def _layout_measurement_integrity(value: object) -> bool:
    bounds = _items(value, "page_content_bounds")
    fonts = _items(value, "controlled_fonts")
    missing = _items(value, "missing_font_families")
    dimensions = _object_member(value, "page_dimensions")
    page_count = _number(value, "page_count")
    if (
        dimensions is None
        or page_count is None
        or len(bounds) != page_count
        or not _unique_number_field(bounds, "page_number")
        or not all(
            _number(bound, "page_number") == index
            for index, bound in enumerate(bounds, start=1)
        )
        or not _unique_field(fonts, "font_family")
        or not _unique_strings(missing)
    ):
        return False
    page_width = _number(dimensions, "width_points")
    page_height = _number(dimensions, "height_points")
    bounds_within_page = (
        page_width is not None
        and page_height is not None
        and all(
            (x := _number(bound, "x")) is not None
            and (y := _number(bound, "y")) is not None
            and (width := _number(bound, "width")) is not None
            and (height := _number(bound, "height")) is not None
            and x + width <= page_width
            and y + height <= page_height
            for bound in bounds
        )
    )
    accepted = (
        _flag(value, "renderer_succeeded") is True
        and (page_count or 0) >= 1
        and _flag(value, "overflow_detected") is False
        and _flag(value, "clipping_detected") is False
        and _text(value, "extraction_order_result") == "MATCH"
        and bounds_within_page
        and not missing
        and not _items(value, "error_reason_codes")
    )
    result = _text(value, "layout_result")
    if result == "ACCEPTED":
        return accepted
    if result == "RENDER_FAILED":
        return (
            _flag(value, "renderer_succeeded") is False
            and bool(_items(value, "error_reason_codes"))
        )
    return (page_count or 0) >= 1 and _flag(value, "renderer_succeeded") is True


_CERTIFIED_PLATFORM_IDS: Final = frozenset(
    {"MACOS_ARM64", "UBUNTU_X64", "WINDOWS_X64"}
)
_UNCERTIFIABLE_PLATFORM_IDS: Final = frozenset(
    {"UNKNOWN_TARGET", "UNSUPPORTED_TARGET"}
)
_CERTIFIED_SUPPORT_TIERS: Final = frozenset({"CERTIFIED_CORE", "CERTIFIED_FULL"})
_PLATFORM_CAPABILITY_FAMILIES: Final = frozenset(
    {
        "BROWSER_PRESENCE",
        "DIAGNOSTICS",
        "MODEL_RUNTIME",
        "NATIVE_MESSAGING",
        "PACKAGING_UPDATE_CHANNEL",
        "PLATFORM_PATHS",
        "PROCESS_SUPERVISION",
        "SECURE_STORE",
    }
)
_MANDATORY_CORE_CAPABILITIES: Final = frozenset(
    {
        "BROWSER_PRESENCE",
        "NATIVE_MESSAGING",
        "PLATFORM_PATHS",
        "PROCESS_SUPERVISION",
        "SECURE_STORE",
    }
)
_PLATFORM_REQUEST_PRINCIPALS: Final = frozenset(
    {"ORCHESTRATOR", "VERIFICATION_HARNESS"}
)
_PLATFORM_REQUEST_PROFILES: Final = frozenset(
    {"PRODUCTION_NO_SUBMIT", "VERIFICATION"}
)
_PLATFORM_INTERPRETER_TOKENS: Final = frozenset(
    {
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
    }
)
_PLATFORM_ARCHITECTURE_BY_ID: Final[dict[str, str]] = {
    "MACOS_ARM64": "ARM64",
    "UBUNTU_X64": "X86_64",
    "WINDOWS_X64": "X86_64",
}
_REGISTRATION_TERMINAL_STATE: Final[dict[str, str]] = {
    "INSTALL": "PRESENT_VALID",
    "REMOVE": "ABSENT",
    "REPAIR": "PRESENT_VALID",
    "UPDATE": "PRESENT_VALID",
    "VERIFY": "PRESENT_VALID",
}
_DIAGNOSTIC_CAPABILITY_BY_COMPONENT: Final[dict[str, str]] = {
    "BROWSER_LOCATOR": "BROWSER_PRESENCE",
    "INSTALLER_STATE": "PACKAGING_UPDATE_CHANNEL",
    "MODEL_RUNTIME_PROVIDER": "MODEL_RUNTIME",
    "NATIVE_MESSAGING_REGISTRAR": "NATIVE_MESSAGING",
    "PLATFORM_DIAGNOSTICS": "DIAGNOSTICS",
    "PLATFORM_PATHS": "PLATFORM_PATHS",
    "PROCESS_SUPERVISOR": "PROCESS_SUPERVISION",
    "SECRET_STORE": "SECURE_STORE",
    "UPDATER_PROVIDER": "PACKAGING_UPDATE_CHANNEL",
}
_PACKAGE_SUCCESS_STATES: Final = frozenset(
    {"INSTALLED", "REPAIRED", "ROLLED_BACK", "UNINSTALLED", "UPDATE_INSTALLED"}
)
_PACKAGE_FAILURE_STATES: Final = frozenset(
    {
        "INSTALL_FAILED",
        "INSTALL_INTERRUPTED",
        "REPAIR_FAILED",
        "ROLLBACK_FAILED",
        "UNINSTALL_FAILED",
        "UPDATE_FAILED",
        "UPDATE_INTERRUPTED",
    }
)
_EVIDENCE_REFERENCE_BY_ARTIFACT_KIND: Final[dict[str, str]] = {
    "INSTALL_LAUNCH_REPORT": "installer_state_ref",
    "MODEL_PROFILE_REPORT": "model_profile_ref",
    "NATIVE_HOST_REGISTRATION_REPORT": "native_messaging_result_ref",
    "SECRET_STORE_TEST_REPORT": "secret_store_result_ref",
    "UPDATE_ROLLBACK_REPORT": "update_state_ref",
}
_SERVICE_PORT_RE: Final = re.compile(r"^[0-9]{1,5}$")
_PATH_ROLE_VALUE_RE: Final = re.compile(r"^[A-Z][A-Z0-9_]{1,63}$")


def _platform_request_authority(value: object) -> bool:
    context = _object_member(value, "request_context")
    return (
        context is not None
        and _text_one_of(
            context, "requesting_principal", _PLATFORM_REQUEST_PRINCIPALS
        )
        and _text_one_of(
            context, "authorization_profile", _PLATFORM_REQUEST_PROFILES
        )
    )


def _platform_capability_state_sound(state: object) -> bool:
    availability = _text(state, "availability")
    reasons = _items(state, "reason_codes")
    if not _unique_strings(reasons):
        return False
    if availability == "AVAILABLE":
        return (
            not reasons
            and _present(state, "identity_token")
            and _present(state, "detected_version")
            and _present(state, "evidence_digest")
            and _text(state, "evaluation_method") != "NOT_EVALUATED"
        )
    if not reasons:
        return False
    if availability == "NOT_EVALUATED":
        return (
            _text(state, "evaluation_method") == "NOT_EVALUATED"
            and "EVALUATION_NOT_RUN" in reasons
        )
    if availability == "DEGRADED_LIMITED":
        return _present(state, "identity_token") and _present(
            state, "detected_version"
        )
    return True


def _platform_support_claim_sound(value: object) -> bool:
    claim = _object_member(value, "support_claim")
    platform_id = _text(value, "platform_id")
    if claim is None or platform_id is None:
        return False
    reviewed = _text(claim, "reviewed_tier") or ""
    evidence = _items(claim, "evidence_refs")
    if not _unique_strings(evidence):
        return False
    if platform_id in _UNCERTIFIABLE_PLATFORM_IDS and reviewed != "UNSUPPORTED":
        return False
    if reviewed not in _CERTIFIED_SUPPORT_TIERS:
        return True
    return (
        platform_id in _CERTIFIED_PLATFORM_IDS
        and _text(claim, "review_state") == "REVIEW_COMPLETE"
        and _present(claim, "evaluated_commit")
        and _present(claim, "evaluated_tree")
        and _present(claim, "reviewer_identity_ref")
        and bool(evidence)
    )


def _platform_reviewed_tier_is_certified(value: object) -> bool:
    claim = _object_member(value, "support_claim")
    return (_text(claim, "reviewed_tier") or "") in _CERTIFIED_SUPPORT_TIERS


def _platform_architecture_coherent(value: object) -> bool:
    """A certified target must report its specification §5.14.1 architecture.

    An uncertifiable target stays unconstrained so an honest
    UNKNOWN_ARCHITECTURE observation remains representable.
    """
    expected = _PLATFORM_ARCHITECTURE_BY_ID.get(_text(value, "platform_id") or "")
    return expected is None or _text(value, "architecture") == expected


def _platform_target_support_claim(value: object) -> bool:
    platform_id = _text(value, "platform_id")
    reasons = _items(value, "reason_codes")
    if (
        platform_id is None
        or not _unique_strings(reasons)
        or not _platform_architecture_coherent(value)
        or not _platform_support_claim_sound(value)
    ):
        return False
    if not _platform_reviewed_tier_is_certified(value):
        return bool(reasons)
    return not reasons and _text(value, "detection_method") == "MEASURED_NATIVE_RUN"


def _platform_capability_report_integrity(value: object) -> bool:
    capabilities = _items(value, "capabilities")
    families = {_text(state, "capability") for state in capabilities}
    if (
        not _unique_field(capabilities, "capability")
        or families != _PLATFORM_CAPABILITY_FAMILIES
        or not all(
            _platform_capability_state_sound(state) for state in capabilities
        )
        or not _unique_strings(_items(value, "model_profile_refs"))
        or not _unique_strings(_items(value, "diagnostic_refs"))
        or not _platform_support_claim_sound(value)
    ):
        return False

    def availability_of(family: str) -> str | None:
        for state in capabilities:
            if _text(state, "capability") == family:
                return _text(state, "availability")
        return None

    if (
        _text(value, "packaging_channel") == "RELEASE_STABLE"
        and availability_of("PACKAGING_UPDATE_CHANNEL") != "AVAILABLE"
    ):
        return False
    if not _platform_reviewed_tier_is_certified(value):
        return True
    if not all(
        availability_of(family) == "AVAILABLE"
        for family in _MANDATORY_CORE_CAPABILITIES
    ):
        return False
    claim = _object_member(value, "support_claim")
    if _text(claim, "reviewed_tier") != "CERTIFIED_FULL":
        # A missing or unavailable local-AI profile never downgrades the
        # deterministic core tier; CERTIFIED_CORE deliberately imposes no
        # MODEL_RUNTIME requirement.
        return True
    return availability_of("MODEL_RUNTIME") == "AVAILABLE" and bool(
        _items(value, "model_profile_refs")
    )


def _platform_path_request_safety(value: object) -> bool:
    if not _platform_request_authority(value):
        return False
    return (
        _text(value, "scope") != "SYSTEM"
        or _text(value, "role") == "NATIVE_HOST_REGISTRATION"
    )


def _platform_path_resolution_safety(value: object) -> bool:
    role = _text(value, "role")
    reasons = _items(value, "reason_codes")
    sanitized = _text(value, "sanitized_path")
    if (
        role is None
        or not _unique_strings(reasons)
        or (
            _text(value, "scope") == "SYSTEM"
            and role != "NATIVE_HOST_REGISTRATION"
        )
    ):
        return False
    if _text(value, "resolution_state") != "RESOLVED":
        return (
            sanitized is None
            and not _present(value, "path_digest")
            and _flag(value, "exists") is False
            and _flag(value, "writable") is False
            and bool(reasons)
        )
    return (
        sanitized is not None
        and sanitized.startswith("<" + role + ">")
        and _present(value, "path_digest")
        and not reasons
        and (_flag(value, "writable") is not True or _flag(value, "exists") is True)
    )


def _platform_secret_request_authority(value: object) -> bool:
    context = _object_member(value, "request_context")
    operation = _text(value, "operation")
    redaction = _object_member(value, "redaction")
    if not _platform_request_authority(value):
        return False
    if (
        _text(context, "authorization_profile") == "VERIFICATION"
        and operation != "STATUS"
    ):
        return False
    if redaction is not None and (
        _text(redaction, "sensitivity") != "SECRET"
        or _text(redaction, "policy") != "FORBID_CAPTURE"
    ):
        return False
    if operation == "PUT":
        return _present(value, "material_reference") and _present(
            value, "material_digest"
        )
    return not _present(value, "material_reference") and not _present(
        value, "material_digest"
    )


def _platform_secret_result_integrity(value: object) -> bool:
    operation = _text(value, "operation")
    availability = _text(value, "store_availability")
    state = _text(value, "result_state")
    reasons = _items(value, "reason_codes")
    has_material = _present(value, "material_reference")
    has_digest = _present(value, "material_digest")
    if not _unique_strings(reasons):
        return False
    if availability == "AVAILABLE":
        if not _present(value, "store_identity_token"):
            return False
    elif has_material:
        return False
    store_unavailable_availability = availability is not None and availability not in {
        "AVAILABLE",
        "DEGRADED_LIMITED",
        "PERMISSION_REQUIRED",
    }
    denied_availability = availability in {"PERMISSION_REQUIRED", "UNAVAILABLE"}
    if operation == "STATUS":
        if has_material or has_digest:
            return False
        if state == "STORE_AVAILABLE":
            return availability == "AVAILABLE" and not reasons
        if state == "DENIED_PERMISSION":
            return "PERMISSION_DENIED" in reasons and denied_availability
        if state == "STORE_UNAVAILABLE":
            return bool(reasons) and store_unavailable_availability
        return False
    if state == "STORE_AVAILABLE":
        return False
    if state == "RETRIEVED":
        return (
            operation == "GET"
            and availability == "AVAILABLE"
            and has_material
            and has_digest
            and not reasons
        )
    if state == "STORED":
        return (
            operation == "PUT"
            and availability == "AVAILABLE"
            and has_material
            and not reasons
        )
    if state == "DELETED":
        return (
            operation == "DELETE"
            and availability == "AVAILABLE"
            and not has_material
            and not has_digest
            and not reasons
        )
    if state == "DENIED_PERMISSION":
        return (
            not has_material
            and not has_digest
            and "PERMISSION_DENIED" in reasons
            and denied_availability
        )
    if state == "STORE_UNAVAILABLE":
        return (
            not has_material
            and not has_digest
            and bool(reasons)
            and store_unavailable_availability
        )
    return not has_material and not has_digest and bool(reasons)


def _platform_process_plan_safety(value: object) -> bool:
    profile = _text(value, "profile")
    environment = _items(value, "environment_allowlist")
    command_arguments = _items(value, "arguments")
    binary_modes = [
        _text(value, "stdin_mode"),
        _text(value, "stdout_mode"),
        _text(value, "stderr_mode"),
    ]
    if (
        not _platform_request_authority(value)
        or _flag(value, "inherit_parent_environment") is not False
        or not _present(value, "executable_digest")
        or not _unique_field(environment, "variable")
        or _text(value, "working_directory_role") == "NATIVE_HOST_REGISTRATION"
    ):
        return False
    if any(
        isinstance(argument, str)
        and argument.lower() in _PLATFORM_INTERPRETER_TOKENS
        for argument in command_arguments
    ):
        return False
    for entry in environment:
        variable = _text(entry, "variable")
        entry_value = _text(entry, "value")
        if entry_value is None:
            return False
        if variable == "JAPP_SERVICE_PORT" and not _SERVICE_PORT_RE.match(
            entry_value
        ):
            return False
        if variable == "JAPP_PATH_ROLE" and not _PATH_ROLE_VALUE_RE.match(
            entry_value
        ):
            return False
    if (
        _text(value, "lifecycle_mode") == "ONE_SHOT"
        and _number(value, "max_restart_attempts") != 0
    ):
        return False
    if profile == "NATIVE_MESSAGING_HOST":
        # Specification §5.14.5 places the length-prefixed native-messaging
        # protocol on binary stdin/stdout. stderr stays a diagnostic channel
        # and must never silently become a second protocol stream.
        return (
            _text(value, "stdin_mode") == "BINARY_LENGTH_PREFIXED"
            and _text(value, "stdout_mode") == "BINARY_LENGTH_PREFIXED"
            and _text(value, "stderr_mode") != "BINARY_LENGTH_PREFIXED"
        )
    return all(mode != "BINARY_LENGTH_PREFIXED" for mode in binary_modes)


def _platform_process_status_integrity(value: object) -> bool:
    state = _text(value, "state")
    reasons = _items(value, "reason_codes")
    ended = _present(value, "ended_at")
    started = _present(value, "started_at")
    exited = _present(value, "exit_code")
    orphan = _flag(value, "orphan_detected")
    if not _unique_strings(reasons):
        return False
    if (
        ended
        and started
        and not _timestamp_not_before(value, "ended_at", "started_at")
    ):
        return False
    if orphan is True and state != "ORPHANED":
        return False
    if state in {"STARTING", "RUNNING"}:
        return not ended and not exited and orphan is False
    if state == "TERMINATING":
        return (
            not ended
            and not exited
            and _text(value, "termination_requested") != "NONE"
        )
    if state == "EXITED":
        return started and ended and exited and not reasons
    if state == "TERMINATED":
        return (
            started and ended and _text(value, "termination_requested") != "NONE"
        )
    if state == "ORPHANED":
        return orphan is True and bool(reasons)
    if state == "UNAVAILABLE":
        return not started and not ended and not exited and bool(reasons)
    return bool(reasons)


def _platform_native_registration_binding(value: object) -> bool:
    operation = _text(value, "operation")
    extensions = _items(value, "allowed_extension_ids")
    if (
        not _platform_request_authority(value)
        or _text(value, "browser_family") != "CHROME"
        or _text(value, "browser_channel") != "STABLE"
        or _text(value, "binary_stdio_mode") != "BINARY_LENGTH_PREFIXED"
        or _text(value, "manifest_location_role") != "NATIVE_HOST_REGISTRATION"
        or not _strictly_sorted_strings(extensions)
    ):
        return False
    if operation == "REMOVE":
        return not _present(value, "expected_manifest_digest") and not _present(
            value, "expected_host_binary_digest"
        )
    if operation == "VERIFY":
        return _present(value, "expected_manifest_digest")
    return _present(value, "expected_manifest_digest") and _present(
        value, "expected_host_binary_digest"
    )


def _platform_native_registration_result(value: object) -> bool:
    operation = _text(value, "operation") or ""
    observed = _text(value, "observed_state")
    reasons = _items(value, "reason_codes")
    changed = _flag(value, "changed")
    succeeded = not reasons
    manifest_digest = _present(value, "observed_manifest_digest")
    host_version = _present(value, "observed_host_version")
    if (
        not _unique_strings(reasons)
        or _text(value, "browser_family") != "CHROME"
        or (operation == "VERIFY" and changed is not False)
    ):
        return False
    # Each diagnostic reason names the exact state it explains, so neither the
    # state nor its reason may be reported without the other.
    if (observed == "MISMATCHED_IDENTITY") != ("IDENTITY_MISMATCH" in reasons):
        return False
    if (observed == "NOT_EVALUATED") != ("EVALUATION_NOT_RUN" in reasons):
        return False
    # Observed identity is evidence of a manifest that is really present: it is
    # mandatory for PRESENT_VALID and impossible once nothing is registered or
    # nothing was evaluated.
    if observed == "PRESENT_VALID" and not (
        manifest_digest and host_version and succeeded
    ):
        return False
    if observed in {"ABSENT", "NOT_EVALUATED"} and (manifest_digest or host_version):
        return False
    if observed == "NOT_EVALUATED":
        return changed is False
    # Zero reasons is a success claim. It is admissible only in the terminal
    # state the operation is defined to reach, and only when repeating the same
    # intent is guaranteed to be a no-op (specification §5.14.5 idempotency).
    if succeeded:
        return (
            observed == _REGISTRATION_TERMINAL_STATE.get(operation)
            and _flag(value, "idempotent_repeat_safe") is True
        )
    return True


def _platform_browser_discovery_safety(value: object) -> bool:
    if (
        not _platform_request_authority(value)
        or _text(value, "browser_family") != "CHROME"
        or _text(value, "browser_channel") != "STABLE"
    ):
        return False
    return (
        _flag(value, "include_capability_probe") is not True
        or (_text(value, "platform_id") or "") in _CERTIFIED_PLATFORM_IDS
    )


def _platform_browser_record_scope(value: object) -> bool:
    presence = _text(value, "presence")
    reasons = _items(value, "reason_codes")
    capability = _object_member(value, "native_messaging_capability")
    if (
        not _unique_strings(reasons)
        or capability is None
        or not _platform_capability_state_sound(capability)
        or _text(capability, "capability") != "NATIVE_MESSAGING"
    ):
        return False
    if presence == "AVAILABLE":
        if not _present(value, "detected_version"):
            return False
    elif _present(value, "sanitized_install_location"):
        return False
    if _flag(value, "certified_for_platform") is not True:
        return bool(reasons)
    return (
        not reasons
        and presence == "AVAILABLE"
        and _text(value, "browser_family") == "CHROME"
        and _text(value, "browser_channel") == "STABLE"
        and (_text(value, "platform_id") or "") in _CERTIFIED_PLATFORM_IDS
        and _text(value, "detection_method") == "MEASURED_NATIVE_RUN"
        and _text(capability, "availability") == "AVAILABLE"
        and _present(value, "last_tested_on")
    )


def _platform_model_profile_evidence(value: object) -> bool:
    platform_id = _text(value, "platform_id") or ""
    accelerator = _text(value, "accelerator")
    family = _text(value, "runtime_family")
    reasons = _items(value, "reason_codes")
    evidence = _items(value, "evidence_refs")
    if not _unique_strings(reasons) or not _unique_strings(evidence):
        return False
    if accelerator == "APPLE_SILICON_GPU" and platform_id != "MACOS_ARM64":
        return False
    if accelerator == "NVIDIA_CUDA" and (
        not _present(value, "minimum_vram_mib")
        or not _present(value, "minimum_driver_version")
    ):
        return False
    if accelerator == "CPU_ONLY" and _present(value, "minimum_vram_mib"):
        return False
    if family == "OLLAMA_MLX" and (
        platform_id != "MACOS_ARM64" or accelerator != "APPLE_SILICON_GPU"
    ):
        return False
    if family == "OLLAMA_GGUF" and accelerator == "APPLE_SILICON_GPU":
        return False
    if _text(value, "acceptance_state") != "ACCEPTED":
        return (
            bool(reasons)
            and _text(value, "core_capability_behavior") != "FULL_AI_AVAILABLE"
        )
    return (
        platform_id in _CERTIFIED_PLATFORM_IDS
        and not reasons
        and bool(evidence)
        and _text(value, "availability") == "AVAILABLE"
        and _text(value, "core_capability_behavior") == "FULL_AI_AVAILABLE"
        and _present(value, "structured_output_evidence_ref")
        and _present(value, "factuality_evidence_ref")
        and _present(value, "latency_evidence_ref")
        and _present(value, "memory_evidence_ref")
        and _present(value, "last_tested_on")
    )


def _platform_runtime_capability_fallback(value: object) -> bool:
    available = _items(value, "available_profile_refs")
    accepted = _items(value, "accepted_profile_refs")
    reasons = _items(value, "reason_codes")
    behavior = _text(value, "core_capability_behavior")
    if (
        not _unique_strings(available)
        or not _unique_strings(accepted)
        or not _unique_strings(reasons)
        or not _subset_of(accepted, available)
    ):
        return False
    if (
        _text(value, "detection_method") == "NOT_EVALUATED"
        and _text(value, "runtime_availability") != "NOT_EVALUATED"
    ):
        return False
    if _text(value, "runtime_availability") != "AVAILABLE":
        return (
            not available
            and not accepted
            and bool(reasons)
            and behavior != "FULL_AI_AVAILABLE"
        )
    if (
        not _present(value, "runtime_family")
        or not _present(value, "runtime_version")
        or not _present(value, "accelerator")
    ):
        return False
    return bool(accepted) if behavior == "FULL_AI_AVAILABLE" else not accepted


def _platform_package_state_evidence(value: object) -> bool:
    state = _text(value, "state") or ""
    reasons = _items(value, "reason_codes")
    signature = _text(value, "signature_state")
    interrupted = _flag(value, "interrupted")
    preservation = _text(value, "user_data_preservation")
    if (
        not _unique_strings(reasons)
        or not _unique_strings(_items(value, "evidence_refs"))
        or not _platform_architecture_coherent(value)
        or (interrupted is True and "INTERRUPTED" not in reasons)
        or (_flag(value, "recovery_completed") is True and interrupted is not True)
        or (preservation == "PRESERVATION_FAILED" and not reasons)
    ):
        return False
    if (
        signature in {"SIGNATURE_INVALID", "SIGNATURE_MISSING"}
        and "SIGNATURE_NOT_VERIFIED" not in reasons
    ):
        return False
    if state in _PACKAGE_FAILURE_STATES and not reasons:
        return False
    if state in _PACKAGE_SUCCESS_STATES:
        if (
            signature != "SIGNATURE_VALID"
            or reasons
            or interrupted is not False
            or preservation not in {"EXPLICIT_DELETION_REQUESTED", "PRESERVED"}
            or not _items(value, "evidence_refs")
        ):
            return False
    if state == "UNINSTALLED":
        return _text(value, "native_host_cleanup") in {
            "NOT_APPLICABLE",
            "REMOVED",
        }
    if state == "INSTALLED":
        return _present(value, "installed_version") and _text(
            value, "installed_version"
        ) == _text(value, "package_version")
    if state == "NOT_INSTALLED":
        return not _present(value, "installed_version")
    if state == "NO_UPDATE_AVAILABLE":
        return not _present(value, "available_version")
    if state == "UPDATE_AVAILABLE":
        return _present(value, "available_version")
    if state == "UPDATE_INSTALLED":
        return (
            _present(value, "installed_version")
            and _present(value, "available_version")
            and _present(value, "target_artifact")
        )
    if state == "ROLLED_BACK":
        return (
            _present(value, "rolled_back_to_version")
            and _flag(value, "rollback_available") is True
        )
    return True


def _platform_diagnostic_integrity(value: object) -> bool:
    result = _text(value, "result")
    severity = _text(value, "severity")
    reasons = _items(value, "reason_codes")
    blocking = _flag(value, "blocking")
    component = _text(value, "component") or ""
    expected_capability = _DIAGNOSTIC_CAPABILITY_BY_COMPONENT.get(component)
    if (
        not _unique_strings(reasons)
        or not _unique_strings(_items(value, "evidence_refs"))
        or (
            expected_capability is not None
            and _text(value, "capability") != expected_capability
        )
    ):
        return False
    if (
        _present(value, "user_message")
        and _text(_object_member(value, "redaction"), "policy") != "NONE"
    ):
        return False
    if blocking is True and result not in {"BLOCKED", "FAILURE"}:
        return False
    if result == "SUCCESS":
        return blocking is False and not reasons and severity == "INFO"
    if not reasons:
        return False
    if result == "WARNING":
        return blocking is False and severity in {"INFO", "WARNING"}
    if result == "FAILURE":
        return severity in {"CRITICAL", "ERROR"}
    return blocking is True


def _platform_evidence_integrity(value: object) -> bool:
    reasons = _items(value, "reason_codes")
    method = _text(value, "evaluation_method")
    artifact_kind = _text(value, "artifact_kind") or ""
    required_reference = _EVIDENCE_REFERENCE_BY_ARTIFACT_KIND.get(artifact_kind)
    if (
        not _unique_strings(reasons)
        or not _platform_architecture_coherent(value)
        or _flag(value, "synthetic_only") is not True
        or (
            required_reference is not None
            and not _present(value, required_reference)
        )
        or (
            _present(value, "package_artifact")
            and not _present(value, "signature_state")
        )
    ):
        return False
    if _text(value, "review_state") == "REVIEW_COMPLETE" and not _present(
        value, "reviewer_identity_ref"
    ):
        return False
    if (
        _text(value, "owner_decision_state") == "RECORDED"
        and _text(value, "review_state") != "REVIEW_COMPLETE"
    ):
        return False
    if method == "MEASURED_NATIVE_RUN":
        if (
            not _present(value, "os_version")
            or not _present(value, "os_build")
            or _text(value, "machine_class") == "SYNTHETIC_FIXTURE"
            or (_text(value, "platform_id") or "") not in _CERTIFIED_PLATFORM_IDS
        ):
            return False
    elif _text(value, "machine_class") in {
        "HOSTED_CI_RUNNER",
        "PHYSICAL_DEVELOPMENT_MACHINE",
    }:
        if method != "STATIC_INSPECTION":
            return False
    return not reasons if _text(value, "result") == "SUCCESS" else bool(reasons)


def _platform_certification_input_scope(value: object) -> bool:
    required = _items(value, "required_evidence_kinds")
    present_kinds = _items(value, "present_evidence_kinds")
    records = _items(value, "evidence_record_refs")
    reasons = _items(value, "reason_codes")
    if (
        not _strictly_sorted_strings(required)
        or not _strictly_sorted_strings(present_kinds)
        or not _unique_strings(records)
        or not _unique_strings(reasons)
        or not _platform_architecture_coherent(value)
        or not _platform_support_claim_sound(value)
    ):
        return False
    complete = _subset_of(required, present_kinds) and bool(records)
    if _flag(value, "inventory_complete") is not complete:
        return False
    if (_text(value, "owner_decision_state") == "RECORDED") is not _present(
        value, "owner_decision_ref"
    ):
        return False
    if not _platform_reviewed_tier_is_certified(value):
        return bool(reasons)
    return (
        not reasons
        and complete
        and _text(value, "owner_decision_state") == "RECORDED"
    )


RuleEvaluator = Callable[[object], bool]
RULE_EVALUATORS: Final[dict[str, RuleEvaluator]] = {
    "APPLICATION_SESSION_CONSISTENCY": _application_session_consistency,
    "ATOMIC_CLAIM_INTEGRITY": _atomic_claim_integrity,
    "ATS_VARIANT_SCOPE": _ats_variant_scope,
    "BENCHMARK_CASE_INTEGRITY": _benchmark_case_integrity,
    "BENCHMARK_RESULT_INTEGRITY": _benchmark_result_integrity,
    "DRIVER_VERIFIED_EVIDENCE": _driver_verified_evidence,
    "FIELD_ADDRESS_IDENTITY": _field_address_identity,
    "FIELD_DECISION_AUTHORITY": _field_decision_authority,
    "FIELD_DESCRIPTOR_OBSERVATION": _field_descriptor_observation,
    "GATE_DECISION_INTEGRITY": _gate_decision_integrity,
    "GATE_EVIDENCE_COMPLETENESS": _gate_evidence_completeness,
    "GUIDED_RUN_SAFETY": _guided_run_safety,
    "HOLDOUT_MANIFEST_INTEGRITY": _holdout_manifest_integrity,
    "INERT_TEXT_SAFETY": _inert_text_safe,
    "LAYOUT_MEASUREMENT_INTEGRITY": _layout_measurement_integrity,
    "NAVIGATION_SAFETY": _navigation_safety,
    "PAGE_READINESS_INTEGRITY": _page_readiness_integrity,
    "PLATFORM_BROWSER_DISCOVERY_SAFETY": _platform_browser_discovery_safety,
    "PLATFORM_BROWSER_RECORD_SCOPE": _platform_browser_record_scope,
    "PLATFORM_CAPABILITY_REPORT_INTEGRITY": _platform_capability_report_integrity,
    "PLATFORM_CERTIFICATION_INPUT_SCOPE": _platform_certification_input_scope,
    "PLATFORM_DIAGNOSTIC_INTEGRITY": _platform_diagnostic_integrity,
    "PLATFORM_EVIDENCE_INTEGRITY": _platform_evidence_integrity,
    "PLATFORM_MODEL_PROFILE_EVIDENCE": _platform_model_profile_evidence,
    "PLATFORM_NATIVE_REGISTRATION_BINDING": _platform_native_registration_binding,
    "PLATFORM_NATIVE_REGISTRATION_RESULT": _platform_native_registration_result,
    "PLATFORM_PACKAGE_STATE_EVIDENCE": _platform_package_state_evidence,
    "PLATFORM_PATH_REQUEST_SAFETY": _platform_path_request_safety,
    "PLATFORM_PATH_RESOLUTION_SAFETY": _platform_path_resolution_safety,
    "PLATFORM_PROCESS_PLAN_SAFETY": _platform_process_plan_safety,
    "PLATFORM_PROCESS_STATUS_INTEGRITY": _platform_process_status_integrity,
    "PLATFORM_RUNTIME_CAPABILITY_FALLBACK": _platform_runtime_capability_fallback,
    "PLATFORM_SECRET_REQUEST_AUTHORITY": _platform_secret_request_authority,
    "PLATFORM_SECRET_RESULT_INTEGRITY": _platform_secret_result_integrity,
    "PLATFORM_TARGET_SUPPORT_CLAIM": _platform_target_support_claim,
    "RECONCILIATION_READINESS": _reconciliation_readiness,
    "RESUME_PLAN_EVIDENCE": _resume_plan_evidence,
    "WORKDAY_CERTIFICATION_SCOPE": _workday_certification_scope,
    "WORKDAY_STEP_BOUNDARY": _workday_step_boundary,
    "WORKDAY_TENANT_IDENTITY": _workday_tenant_identity,
}


class SemanticValidationIssueV1(NamedTuple):
    """One deterministic semantic-rule failure."""

    rule_id: str
    rule_kind: str
    error_code: str


class SemanticValidationOutcomeV1(NamedTuple):
    """Ordered semantic result after structural validation."""

    valid: bool
    issues: tuple[SemanticValidationIssueV1, ...]


def validate_semantic_contract_v1(
    schema_ref: str, value: object
) -> SemanticValidationOutcomeV1:
    """Evaluate finite reviewed rules bound to a structurally valid root."""
    issues = tuple(
        SemanticValidationIssueV1(
            rule_id=entry.rule_id,
            rule_kind=entry.rule_kind,
            error_code=entry.failure_error_code,
        )
        for entry in SEMANTIC_RULES_V1
        if entry.schema_ref == schema_ref and not RULE_EVALUATORS[entry.rule_kind](value)
    )
    return SemanticValidationOutcomeV1(valid=not issues, issues=issues)
`;

export function emitPythonSemanticRules(
  loaded: LoadedSemanticRules,
): GeneratedFile {
  const content = `"""GENERATED FILE - DO NOT EDIT BY HAND.

Regenerate with: pnpm generate:contracts

Finite semantic-contract evaluators derived from the reviewed
packages/contracts/catalog/semantic-rules.v1.json data source.

Structural validation must succeed first. Catalog content is inert and no
expression, path, operator, or code is interpreted.
"""

import re
from collections.abc import Callable
from typing import Final, NamedTuple, cast


class SemanticRuleEntryV1(NamedTuple):
    """One immutable reviewed semantic-rule binding."""

    rule_id: str
    rule_version: str
    schema_ref: str
    rule_kind: str
    failure_error_code: str


SEMANTIC_RULES_V1: Final[tuple[SemanticRuleEntryV1, ...]] = (
${pyEntries(loaded.entries)}
)
"""Immutable reviewed semantic-rule bindings, sorted by rule_id."""
${PYTHON_SEMANTIC_RUNTIME}`;
  return {
    path: "python/src/japp_contracts/semantic/rules_v1.py",
    content,
  };
}

export const PYTHON_SEMANTIC_RULE_EXPORTS = [
  "SEMANTIC_RULES_V1",
  "SemanticRuleEntryV1",
  "SemanticValidationIssueV1",
  "SemanticValidationOutcomeV1",
  "validate_semantic_contract_v1",
] as const;
