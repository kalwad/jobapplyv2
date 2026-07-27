/**
 * Canonical M01-W04 capability, command, and authorization-policy pipeline.
 *
 * Three committed data documents are validated through the strict canonical
 * schema catalog and then cross-checked here. The cross-checks are deliberately
 * independent of the editable policy JSON: exact vocabulary agreement,
 * deterministic ordering, command metadata integrity, positive-row integrity,
 * complete forwarding routes, and mandatory architectural prohibitions all
 * fail closed before either language surface is emitted.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SchemaCatalog } from "../src/catalog.ts";
import { isJsonObject, type JsonObject, type JsonValue } from "../src/json.ts";
import type { ContractValidator } from "../src/validator.ts";
import type { GeneratedFile } from "./emit-typescript.ts";
import { pythonStringLiteral } from "./emit-python.ts";
import {
  DEFAULT_CATALOG_ROOT,
  type LoadedErrorCatalog,
} from "./error-catalog.ts";

export const CAPABILITY_TAXONOMY_SCHEMA_ID =
  "urn:japp:schema:security:capability-taxonomy:v1";
export const COMMAND_TAXONOMY_SCHEMA_ID =
  "urn:japp:schema:security:command-taxonomy:v1";
export const AUTHORIZATION_POLICY_SCHEMA_ID =
  "urn:japp:schema:security:authorization-policy:v1";

export const CAPABILITY_CATALOG_FILE = "capability-catalog.v1.json";
export const COMMAND_CATALOG_FILE = "command-catalog.v1.json";
export const AUTHORIZATION_POLICY_FILE = "authorization-policy.v1.json";

/** Raised when canonical security data violates schema or integrity rules. */
export class SecurityPolicyError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      "the canonical security policy violates its contract:\n" +
        violations.map((violation) => `  - ${violation}`).join("\n"),
    );
    this.name = "SecurityPolicyError";
    this.violations = violations;
  }
}

export interface PrincipalEntryData {
  readonly id: string;
  readonly description: string;
  readonly non_goals: readonly string[];
}

export interface ProfileEntryData {
  readonly id: string;
  readonly description: string;
  readonly non_goals: readonly string[];
}

export interface CapabilityEntryData {
  readonly id: string;
  readonly description: string;
  readonly non_goals: readonly string[];
}

export interface CommandEntryData {
  readonly id: string;
  readonly required_capability: string;
  readonly intended_target: string;
  readonly supported_profiles: readonly string[];
  readonly max_encoded_payload_size_bytes: number;
  readonly consequence_class: string;
  readonly idempotency_expectation: string;
  readonly denial_error_code: string;
  readonly description: string;
  readonly non_goals: readonly string[];
}

export interface AuthorizationAllowRowData {
  readonly authorization_profile: string;
  readonly command_id: string;
  readonly originating_principal: string;
  readonly immediate_sender: string;
  readonly receiving_principal: string;
  readonly target_principal: string;
}

export interface SecurityDataInput {
  readonly repositoryPath: string;
  readonly schemaId: string;
  readonly version: string;
  readonly rawText: string;
}

export interface LoadedSecurityPolicy {
  readonly principals: readonly PrincipalEntryData[];
  readonly profiles: readonly ProfileEntryData[];
  readonly capabilities: readonly CapabilityEntryData[];
  readonly commands: readonly CommandEntryData[];
  readonly allow: readonly AuthorizationAllowRowData[];
  readonly dataInputs: readonly SecurityDataInput[];
}

interface ParsedDataDocument {
  readonly document: JsonObject;
  readonly rawText: string;
  readonly repositoryPath: string;
}

function loadDataDocument(options: {
  readonly root: string;
  readonly file: string;
  readonly repositoryPath: string;
  readonly schemaId: string;
  readonly label: string;
  readonly validator: ContractValidator;
}): ParsedDataDocument {
  const absolute = join(options.root, options.file);
  let rawText: string;
  try {
    rawText = readFileSync(absolute, "utf8");
  } catch (error) {
    throw new SecurityPolicyError([
      `cannot read ${options.label} at ${absolute} ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new SecurityPolicyError([
      `${options.label} is not valid JSON ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  const result = options.validator.validateInstance(options.schemaId, parsed);
  if (!result.valid) {
    throw new SecurityPolicyError(
      result.errors.map(
        (message) => `${options.label} schema validation failed: ${message}`,
      ),
    );
  }
  if (!isJsonObject(parsed as JsonValue)) {
    throw new SecurityPolicyError([`${options.label} must be an object`]);
  }
  return {
    document: parsed as JsonObject,
    rawText,
    repositoryPath: options.repositoryPath,
  };
}

function enumTokens(
  catalog: SchemaCatalog,
  schemaId: string,
  defName: string,
): string[] {
  const entry = catalog.byId.get(schemaId);
  const defs = entry?.document.$defs;
  if (entry === undefined || !isJsonObject(defs)) {
    throw new SecurityPolicyError([
      `taxonomy document ${schemaId} is missing from the schema catalog`,
    ]);
  }
  const definition = defs[defName];
  if (!isJsonObject(definition) || !Array.isArray(definition.enum)) {
    throw new SecurityPolicyError([
      `${schemaId}#/$defs/${defName} does not declare an enum`,
    ]);
  }
  return definition.enum.filter(
    (token): token is string => typeof token === "string",
  );
}

function checkExactSortedIds(
  label: string,
  actual: readonly string[],
  declared: readonly string[],
  violations: string[],
): void {
  const seen = new Set<string>();
  let previous: string | null = null;
  for (const id of actual) {
    if (seen.has(id)) {
      violations.push(`${label}: duplicate id ${id}`);
    }
    seen.add(id);
    if (previous !== null && !(previous < id)) {
      violations.push(
        `${label}: ids must be sorted (found ${id} after ${previous})`,
      );
    }
    previous = id;
  }
  const missing = declared.filter((id) => !seen.has(id));
  const extra = [...seen].filter((id) => !declared.includes(id));
  if (missing.length > 0) {
    violations.push(`${label}: missing declared ids: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    violations.push(`${label}: undeclared ids: ${extra.join(", ")}`);
  }
}

function checkSortedUniqueStrings(
  label: string,
  values: readonly string[],
  violations: string[],
): void {
  const seen = new Set<string>();
  let previous: string | null = null;
  for (const value of values) {
    if (seen.has(value)) {
      violations.push(`${label}: duplicate value ${value}`);
    }
    seen.add(value);
    if (previous !== null && !(previous < value)) {
      violations.push(
        `${label}: values must be sorted (found ${value} after ${previous})`,
      );
    }
    previous = value;
  }
}

const CONTENT_ORIGIN_COMMANDS = new Set([
  "PAGE_REPORT_FINAL_REVIEW",
  "PAGE_REPORT_STATE",
]);

const DESKTOP_ORIGIN_COMMANDS = new Set([
  "ARTIFACT_READ_REQUEST",
  "ARTIFACT_WRITE_REQUEST",
  "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
  "PRIVATE_DATA_READ_REQUEST",
  "PRIVATE_DATA_WRITE_REQUEST",
  "WORKFLOW_CANCEL",
  "WORKFLOW_PAUSE",
]);

const ORCHESTRATOR_ORIGIN_COMMANDS = new Set([
  "MODEL_INFERENCE_REQUEST",
  "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
  "PAGE_NAVIGATE_BACK",
  "PAGE_NAVIGATE_NEXT",
  "PAGE_RECONCILE_STATE",
  "PAGE_SCAN_VISIBLE_CONTROLS",
  "PAGE_UPLOAD_REVIEWED_DOCUMENT",
  "PAGE_VERIFY_FIELD_VALUES",
  "PUBLIC_JOB_INDEX_QUERY",
]);

const IDEMPOTENCY_KEY_REQUIRED_COMMANDS = new Set([
  "ARTIFACT_WRITE_REQUEST",
  "MODEL_INFERENCE_REQUEST",
  "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
  "PAGE_NAVIGATE_BACK",
  "PAGE_NAVIGATE_NEXT",
  "PAGE_UPLOAD_REVIEWED_DOCUMENT",
  "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
  "PLATFORM_PROCESS_SUPERVISION_REQUEST",
  "PLATFORM_SECRET_STORE_REQUEST",
  "PRIVATE_DATA_WRITE_REQUEST",
]);

const VERIFICATION_CAPABILITIES = new Set([
  "PAGE_DOCUMENT_UPLOAD",
  "PAGE_INSPECT",
  "PAGE_MUTATE_BOUNDED",
  "PAGE_NAVIGATE_BOUNDED",
  "PAGE_VALIDATE_RECONCILE_REVIEW",
  "VERIFICATION_EXECUTION",
  "WORKFLOW_CONTROL",
]);

const PROFILE_CAPABILITY_CEILINGS = new Map<string, ReadonlySet<string>>([
  [
    "FEASIBILITY",
    new Set([
      "PAGE_INSPECT",
      "PAGE_MUTATE_BOUNDED",
      "PAGE_VALIDATE_RECONCILE_REVIEW",
      "VERIFICATION_EXECUTION",
      "WORKFLOW_CONTROL",
    ]),
  ],
  [
    "GUIDED_PRE_SUBMIT",
    new Set([
      "PAGE_DOCUMENT_UPLOAD",
      "PAGE_INSPECT",
      "PAGE_MUTATE_BOUNDED",
      "PAGE_NAVIGATE_BOUNDED",
      "PAGE_VALIDATE_RECONCILE_REVIEW",
      "WORKFLOW_CONTROL",
    ]),
  ],
  [
    "PRODUCTION_NO_SUBMIT",
    new Set([
      "ARTIFACT_READ",
      "ARTIFACT_WRITE",
      "MODEL_INFERENCE",
      "PAGE_DOCUMENT_UPLOAD",
      "PAGE_INSPECT",
      "PAGE_MUTATE_BOUNDED",
      "PAGE_NAVIGATE_BOUNDED",
      "PAGE_VALIDATE_RECONCILE_REVIEW",
      "PRIVATE_DATA_READ",
      "PRIVATE_DATA_WRITE",
      "PUBLIC_JOB_INDEX_READ",
      "WORKFLOW_CONTROL",
    ]),
  ],
  [
    "VERIFICATION",
    new Set([
      "PAGE_DOCUMENT_UPLOAD",
      "PAGE_INSPECT",
      "PAGE_MUTATE_BOUNDED",
      "PAGE_NAVIGATE_BOUNDED",
      "PAGE_VALIDATE_RECONCILE_REVIEW",
      "VERIFICATION_EXECUTION",
      "WORKFLOW_CONTROL",
    ]),
  ],
]);

const REVIEWED_COMMAND_BOUNDARIES = new Map<
  string,
  readonly [requiredCapability: string, intendedTarget: string]
>([
  ["ARTIFACT_READ_REQUEST", ["ARTIFACT_READ", "ORCHESTRATOR"]],
  ["ARTIFACT_WRITE_REQUEST", ["ARTIFACT_WRITE", "ORCHESTRATOR"]],
  ["MODEL_INFERENCE_REQUEST", ["MODEL_INFERENCE", "MODEL_RUNTIME"]],
  [
    "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    ["PAGE_MUTATE_BOUNDED", "EXTENSION_CONTENT_SCRIPT"],
  ],
  ["PAGE_NAVIGATE_BACK", ["PAGE_NAVIGATE_BOUNDED", "EXTENSION_CONTENT_SCRIPT"]],
  ["PAGE_NAVIGATE_NEXT", ["PAGE_NAVIGATE_BOUNDED", "EXTENSION_CONTENT_SCRIPT"]],
  [
    "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    ["PAGE_MUTATE_BOUNDED", "ORCHESTRATOR"],
  ],
  [
    "PAGE_RECONCILE_STATE",
    ["PAGE_VALIDATE_RECONCILE_REVIEW", "EXTENSION_CONTENT_SCRIPT"],
  ],
  [
    "PAGE_REPORT_FINAL_REVIEW",
    ["PAGE_VALIDATE_RECONCILE_REVIEW", "ORCHESTRATOR"],
  ],
  ["PAGE_REPORT_STATE", ["PAGE_INSPECT", "ORCHESTRATOR"]],
  ["PAGE_SCAN_VISIBLE_CONTROLS", ["PAGE_INSPECT", "EXTENSION_CONTENT_SCRIPT"]],
  [
    "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    ["PAGE_DOCUMENT_UPLOAD", "EXTENSION_CONTENT_SCRIPT"],
  ],
  [
    "PAGE_VERIFY_FIELD_VALUES",
    ["PAGE_VALIDATE_RECONCILE_REVIEW", "EXTENSION_CONTENT_SCRIPT"],
  ],
  [
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
    ["PLATFORM_BROWSER_RUNTIME_DISCOVERY", "PLATFORM_ADAPTER"],
  ],
  [
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
    ["PLATFORM_NATIVE_MESSAGING_REGISTRATION", "PLATFORM_ADAPTER"],
  ],
  [
    "PLATFORM_PROCESS_SUPERVISION_REQUEST",
    ["PLATFORM_PROCESS_SUPERVISION", "PLATFORM_ADAPTER"],
  ],
  [
    "PLATFORM_SECRET_STORE_REQUEST",
    ["PLATFORM_SECRET_STORE_ACCESS", "PLATFORM_ADAPTER"],
  ],
  ["PRIVATE_DATA_READ_REQUEST", ["PRIVATE_DATA_READ", "ORCHESTRATOR"]],
  ["PRIVATE_DATA_WRITE_REQUEST", ["PRIVATE_DATA_WRITE", "ORCHESTRATOR"]],
  ["PUBLIC_JOB_INDEX_QUERY", ["PUBLIC_JOB_INDEX_READ", "PUBLIC_JOB_INDEX"]],
  ["SUBMISSION_FINAL_SUBMIT", ["SUBMISSION_FINAL", "EXTENSION_CONTENT_SCRIPT"]],
  [
    "VERIFICATION_RUN_SYNTHETIC_SUITE",
    ["VERIFICATION_EXECUTION", "VERIFICATION_HARNESS"],
  ],
  ["WORKFLOW_CANCEL", ["WORKFLOW_CONTROL", "ORCHESTRATOR"]],
  ["WORKFLOW_PAUSE", ["WORKFLOW_CONTROL", "ORCHESTRATOR"]],
]);

const PRIVILEGED_CONTENT_CAPABILITIES = new Set([
  "ARTIFACT_READ",
  "ARTIFACT_WRITE",
  "MODEL_INFERENCE",
  "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
  "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
  "PLATFORM_PROCESS_SUPERVISION",
  "PLATFORM_SECRET_STORE_ACCESS",
  "PRIVATE_DATA_READ",
  "PRIVATE_DATA_WRITE",
  "PUBLIC_JOB_INDEX_READ",
  "SUBMISSION_FINAL",
]);

/**
 * Mandatory architecture rules independent of policy JSON. Returning a
 * violation here means no positive row can make the tuple legal.
 */
function architecturalViolation(
  row: AuthorizationAllowRowData,
  command: CommandEntryData,
): string | null {
  const origin = row.originating_principal;
  if (command.id === "SUBMISSION_FINAL_SUBMIT") {
    return "final submission has no current authority";
  }
  if (command.required_capability === "SUBMISSION_FINAL") {
    return "final-submission capability has no current authority";
  }
  if (command.required_capability.startsWith("PLATFORM_")) {
    return "platform commands are declared abstractly but have no current authority before M01-W07";
  }
  if (
    !PROFILE_CAPABILITY_CEILINGS.get(row.authorization_profile)?.has(
      command.required_capability,
    )
  ) {
    return `${row.authorization_profile} exceeds its immutable capability ceiling`;
  }
  if (
    origin === "EXTENSION_CONTENT_SCRIPT" &&
    PRIVILEGED_CONTENT_CAPABILITIES.has(command.required_capability)
  ) {
    return "content-script origin cannot acquire privileged service or submission authority";
  }
  if (
    origin === "EXTENSION_CONTENT_SCRIPT" &&
    !CONTENT_ORIGIN_COMMANDS.has(command.id)
  ) {
    return "content-script origin may only report bounded page state or final review";
  }
  if (
    origin === "EXTENSION_SERVICE_WORKER" ||
    origin === "NATIVE_HOST" ||
    origin === "MODEL_RUNTIME" ||
    origin === "PLATFORM_ADAPTER" ||
    origin === "PUBLIC_JOB_INDEX"
  ) {
    return `${origin} may forward or serve bounded requests but may not originate product commands`;
  }
  if (origin === "DESKTOP_APP") {
    if (!DESKTOP_ORIGIN_COMMANDS.has(command.id)) {
      return "desktop origin is limited to typed orchestrator service and workflow requests";
    }
    if (row.target_principal === "PLATFORM_ADAPTER") {
      return "desktop origin cannot target platform adapters directly";
    }
  }
  if (
    origin === "ORCHESTRATOR" &&
    !ORCHESTRATOR_ORIGIN_COMMANDS.has(command.id)
  ) {
    return "orchestrator origin is outside its bounded page-dispatch and service authority";
  }
  if (origin === "VERIFICATION_HARNESS") {
    if (
      row.authorization_profile !== "FEASIBILITY" &&
      row.authorization_profile !== "VERIFICATION"
    ) {
      return "verification-harness origin is restricted to synthetic profiles";
    }
    if (!VERIFICATION_CAPABILITIES.has(command.required_capability)) {
      return "verification-harness origin cannot acquire production-data, platform, model, or submission authority";
    }
  }
  return null;
}

const ROW_FIELDS = [
  "authorization_profile",
  "command_id",
  "originating_principal",
  "immediate_sender",
  "receiving_principal",
  "target_principal",
] as const;

function rowKey(row: AuthorizationAllowRowData): string {
  return JSON.stringify(ROW_FIELDS.map((field) => row[field]));
}

function routeGroupKey(row: AuthorizationAllowRowData): string {
  return JSON.stringify([
    row.authorization_profile,
    row.command_id,
    row.originating_principal,
    row.target_principal,
  ]);
}

type Hop = readonly [sender: string, receiver: string];

function expectedHops(origin: string, target: string): readonly Hop[] {
  if (origin === "EXTENSION_CONTENT_SCRIPT" && target === "ORCHESTRATOR") {
    return [
      ["EXTENSION_CONTENT_SCRIPT", "EXTENSION_SERVICE_WORKER"],
      ["EXTENSION_SERVICE_WORKER", "NATIVE_HOST"],
      ["NATIVE_HOST", "ORCHESTRATOR"],
    ];
  }
  if (origin === "ORCHESTRATOR" && target === "EXTENSION_CONTENT_SCRIPT") {
    return [
      ["ORCHESTRATOR", "NATIVE_HOST"],
      ["NATIVE_HOST", "EXTENSION_SERVICE_WORKER"],
      ["EXTENSION_SERVICE_WORKER", "EXTENSION_CONTENT_SCRIPT"],
    ];
  }
  if (
    origin === "VERIFICATION_HARNESS" &&
    target === "EXTENSION_CONTENT_SCRIPT"
  ) {
    return [
      ["VERIFICATION_HARNESS", "ORCHESTRATOR"],
      ["ORCHESTRATOR", "NATIVE_HOST"],
      ["NATIVE_HOST", "EXTENSION_SERVICE_WORKER"],
      ["EXTENSION_SERVICE_WORKER", "EXTENSION_CONTENT_SCRIPT"],
    ];
  }
  return [[origin, target]];
}

function checkCompleteRoutes(
  rows: readonly AuthorizationAllowRowData[],
  violations: string[],
): void {
  const groups = new Map<string, AuthorizationAllowRowData[]>();
  for (const row of rows) {
    const key = routeGroupKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const expected = expectedHops(
      first.originating_principal,
      first.target_principal,
    ).map((hop) => JSON.stringify(hop));
    const actual = group.map((row) =>
      JSON.stringify([row.immediate_sender, row.receiving_principal]),
    );
    const missing = expected.filter((hop) => !actual.includes(hop));
    const extra = actual.filter((hop) => !expected.includes(hop));
    if (
      missing.length > 0 ||
      extra.length > 0 ||
      actual.length !== expected.length
    ) {
      violations.push(
        `${key}: route must contain exactly the complete reviewed hop sequence`,
      );
    }
  }
}

/**
 * Load and fully validate all canonical M01-W04 data inputs.
 */
export function loadSecurityPolicy(options: {
  readonly catalogRoot?: string;
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
  readonly errorCatalog: LoadedErrorCatalog;
}): LoadedSecurityPolicy {
  const root = options.catalogRoot ?? DEFAULT_CATALOG_ROOT;
  const capabilityDocument = loadDataDocument({
    root,
    file: CAPABILITY_CATALOG_FILE,
    repositoryPath: "packages/contracts/catalog/capability-catalog.v1.json",
    schemaId: CAPABILITY_TAXONOMY_SCHEMA_ID,
    label: "capability catalog",
    validator: options.validator,
  });
  const commandDocument = loadDataDocument({
    root,
    file: COMMAND_CATALOG_FILE,
    repositoryPath: "packages/contracts/catalog/command-catalog.v1.json",
    schemaId: COMMAND_TAXONOMY_SCHEMA_ID,
    label: "command catalog",
    validator: options.validator,
  });
  const policyDocument = loadDataDocument({
    root,
    file: AUTHORIZATION_POLICY_FILE,
    repositoryPath: "packages/contracts/catalog/authorization-policy.v1.json",
    schemaId: AUTHORIZATION_POLICY_SCHEMA_ID,
    label: "authorization policy",
    validator: options.validator,
  });

  const principals = (capabilityDocument.document.principals as unknown[]).map(
    (entry) => entry as PrincipalEntryData,
  );
  const profiles = (capabilityDocument.document.profiles as unknown[]).map(
    (entry) => entry as ProfileEntryData,
  );
  const capabilities = (
    capabilityDocument.document.capabilities as unknown[]
  ).map((entry) => entry as CapabilityEntryData);
  const commands = (commandDocument.document.commands as unknown[]).map(
    (entry) => entry as CommandEntryData,
  );
  const allow = (policyDocument.document.allow as unknown[]).map(
    (entry) => entry as AuthorizationAllowRowData,
  );

  const violations: string[] = [];
  const declaredPrincipals = enumTokens(
    options.catalog,
    CAPABILITY_TAXONOMY_SCHEMA_ID,
    "principalId",
  );
  const declaredProfiles = enumTokens(
    options.catalog,
    CAPABILITY_TAXONOMY_SCHEMA_ID,
    "authorizationProfileId",
  );
  const declaredCapabilities = enumTokens(
    options.catalog,
    CAPABILITY_TAXONOMY_SCHEMA_ID,
    "capabilityId",
  );
  const declaredCommands = enumTokens(
    options.catalog,
    COMMAND_TAXONOMY_SCHEMA_ID,
    "commandId",
  );

  checkExactSortedIds(
    "principal catalog",
    principals.map((entry) => entry.id),
    declaredPrincipals,
    violations,
  );
  checkExactSortedIds(
    "profile catalog",
    profiles.map((entry) => entry.id),
    declaredProfiles,
    violations,
  );
  checkExactSortedIds(
    "capability catalog",
    capabilities.map((entry) => entry.id),
    declaredCapabilities,
    violations,
  );
  checkExactSortedIds(
    "command catalog",
    commands.map((entry) => entry.id),
    declaredCommands,
    violations,
  );

  const capabilityIds = new Set(capabilities.map((entry) => entry.id));
  const principalIds = new Set(principals.map((entry) => entry.id));
  const profileIds = new Set(profiles.map((entry) => entry.id));
  const errorByCode = new Map(
    options.errorCatalog.entries.map((entry) => [entry.code, entry] as const),
  );
  const commandById = new Map(
    commands.map((entry) => [entry.id, entry] as const),
  );

  for (const command of commands) {
    const reviewedBoundary = REVIEWED_COMMAND_BOUNDARIES.get(command.id);
    const [reviewedCapability, reviewedTarget] = reviewedBoundary ?? [];
    if (
      command.required_capability !== reviewedCapability ||
      command.intended_target !== reviewedTarget
    ) {
      violations.push(
        `${command.id}: required capability and intended target must match the reviewed command boundary`,
      );
    }
    if (!capabilityIds.has(command.required_capability)) {
      violations.push(
        `${command.id}: unknown required capability ${command.required_capability}`,
      );
    }
    if (!principalIds.has(command.intended_target)) {
      violations.push(
        `${command.id}: unknown intended target ${command.intended_target}`,
      );
    }
    checkSortedUniqueStrings(
      `${command.id} supported_profiles`,
      command.supported_profiles,
      violations,
    );
    for (const profile of command.supported_profiles) {
      if (!profileIds.has(profile)) {
        violations.push(`${command.id}: unknown supported profile ${profile}`);
      }
    }
    if (
      !Number.isSafeInteger(command.max_encoded_payload_size_bytes) ||
      command.max_encoded_payload_size_bytes < 0
    ) {
      violations.push(
        `${command.id}: payload-size limit must be a safe nonnegative integer`,
      );
    }
    const expectedIdempotency = IDEMPOTENCY_KEY_REQUIRED_COMMANDS.has(
      command.id,
    )
      ? "IDEMPOTENCY_KEY_REQUIRED"
      : command.id === "SUBMISSION_FINAL_SUBMIT"
        ? "NOT_REPEATABLE"
        : "IDEMPOTENT";
    if (command.idempotency_expectation !== expectedIdempotency) {
      violations.push(
        `${command.id}: idempotency expectation contradicts the reviewed command semantics`,
      );
    }
    if (
      (command.id === "SUBMISSION_FINAL_SUBMIT") !==
      (command.consequence_class === "CONSEQUENTIAL_FINAL_ACTION")
    ) {
      violations.push(
        `${command.id}: final-action consequence classification is reserved for the known final-submit command`,
      );
    }
    const denial = errorByCode.get(command.denial_error_code);
    if (denial === undefined) {
      violations.push(
        `${command.id}: denial code ${command.denial_error_code} is not in M01-W03`,
      );
    } else if (denial.retry_disposition === "SAFE_RETRY") {
      violations.push(
        `${command.id}: authorization denial code must not invite blind retry`,
      );
    }
  }

  const seenRows = new Set<string>();
  let previousRow: string | null = null;
  for (const row of allow) {
    const key = rowKey(row);
    if (seenRows.has(key)) {
      violations.push(`${key}: duplicate authorization allow row`);
    }
    seenRows.add(key);
    if (previousRow !== null && !(previousRow < key)) {
      violations.push(`${key}: allow rows must be sorted deterministically`);
    }
    previousRow = key;
    const command = commandById.get(row.command_id);
    if (command === undefined) {
      violations.push(`${key}: references an unknown command`);
      continue;
    }
    if (row.target_principal !== command.intended_target) {
      violations.push(
        `${key}: target disagrees with command target ${command.intended_target}`,
      );
    }
    if (!command.supported_profiles.includes(row.authorization_profile)) {
      violations.push(
        `${key}: profile is absent from the command supported-profile set`,
      );
    }
    const architectural = architecturalViolation(row, command);
    if (architectural !== null) {
      violations.push(`${key}: ${architectural}`);
    }
  }

  if (allow.some((row) => row.command_id === "SUBMISSION_FINAL_SUBMIT")) {
    violations.push("final submission must have zero current allow rows");
  }
  for (const command of commands) {
    const policyProfiles = [
      ...new Set(
        allow
          .filter((row) => row.command_id === command.id)
          .map((row) => row.authorization_profile),
      ),
    ].sort();
    if (
      JSON.stringify(policyProfiles) !==
      JSON.stringify(command.supported_profiles)
    ) {
      violations.push(
        `${command.id}: supported_profiles must equal the profiles with ` +
          "at least one exact allow row",
      );
    }
  }
  checkCompleteRoutes(allow, violations);

  if (violations.length > 0) {
    throw new SecurityPolicyError(violations);
  }

  return {
    principals,
    profiles,
    capabilities,
    commands,
    allow,
    dataInputs: [
      {
        repositoryPath: capabilityDocument.repositoryPath,
        schemaId: CAPABILITY_TAXONOMY_SCHEMA_ID,
        version: capabilityDocument.document.catalog_version as string,
        rawText: capabilityDocument.rawText,
      },
      {
        repositoryPath: commandDocument.repositoryPath,
        schemaId: COMMAND_TAXONOMY_SCHEMA_ID,
        version: commandDocument.document.catalog_version as string,
        rawText: commandDocument.rawText,
      },
      {
        repositoryPath: policyDocument.repositoryPath,
        schemaId: AUTHORIZATION_POLICY_SCHEMA_ID,
        version: policyDocument.document.policy_version as string,
        rawText: policyDocument.rawText,
      },
    ],
  };
}

function typescriptHeader(): string {
  return [
    "/**",
    " * GENERATED FILE — DO NOT EDIT BY HAND.",
    " *",
    " * Sources of truth:",
    " * - packages/contracts/catalog/capability-catalog.v1.json",
    " * - packages/contracts/catalog/command-catalog.v1.json",
    " * - packages/contracts/catalog/authorization-policy.v1.json",
    " *",
    " * Regenerate: pnpm generate:contracts",
    " * Verify:     pnpm generate:contracts --check",
    " */",
  ].join("\n");
}

function tsStringArray(values: readonly string[], indent: string): string {
  if (values.length === 0) {
    return "Object.freeze([] as const)";
  }
  return [
    "Object.freeze([",
    ...values.map((value) => `${indent}${JSON.stringify(value)},`),
    `${indent.slice(2)}] as const)`,
  ].join("\n");
}

function tsProfileCapabilityCeilings(): string {
  return [...PROFILE_CAPABILITY_CEILINGS]
    .map(([profile, capabilities]) =>
      [
        `  ${JSON.stringify(profile)}: Object.freeze([`,
        ...[...capabilities].map(
          (capability) => `    ${JSON.stringify(capability)},`,
        ),
        "  ] as const),",
      ].join("\n"),
    )
    .join("\n");
}

function tsDescribedEntries(
  entries: readonly (
    PrincipalEntryData | ProfileEntryData | CapabilityEntryData
  )[],
): string {
  return entries
    .map((entry) =>
      [
        `  ${JSON.stringify(entry.id)}: Object.freeze({`,
        `    id: ${JSON.stringify(entry.id)},`,
        `    description: ${JSON.stringify(entry.description)},`,
        `    non_goals: ${tsStringArray(entry.non_goals, "      ")},`,
        "  }),",
      ].join("\n"),
    )
    .join("\n");
}

function tsCommandEntries(entries: readonly CommandEntryData[]): string {
  return entries
    .map((entry) =>
      [
        `  ${JSON.stringify(entry.id)}: Object.freeze({`,
        `    id: ${JSON.stringify(entry.id)},`,
        `    required_capability: ${JSON.stringify(entry.required_capability)},`,
        `    intended_target: ${JSON.stringify(entry.intended_target)},`,
        `    supported_profiles: ${tsStringArray(entry.supported_profiles, "      ")},`,
        `    max_encoded_payload_size_bytes: ${String(entry.max_encoded_payload_size_bytes)},`,
        `    consequence_class: ${JSON.stringify(entry.consequence_class)},`,
        `    idempotency_expectation: ${JSON.stringify(entry.idempotency_expectation)},`,
        `    denial_error_code: ${JSON.stringify(entry.denial_error_code)},`,
        `    description: ${JSON.stringify(entry.description)},`,
        `    non_goals: ${tsStringArray(entry.non_goals, "      ")},`,
        "  }),",
      ].join("\n"),
    )
    .join("\n");
}

function tsPolicyRows(rows: readonly AuthorizationAllowRowData[]): string {
  return rows
    .map((row) =>
      [
        "  Object.freeze({",
        ...ROW_FIELDS.map(
          (field) => `    ${field}: ${JSON.stringify(row[field])},`,
        ),
        "  }),",
      ].join("\n"),
    )
    .join("\n");
}

/** Emit immutable TypeScript catalogs and fail-closed authorization helpers. */
export function emitTypescriptSecurityPolicy(
  loaded: LoadedSecurityPolicy,
): GeneratedFile {
  const principals = loaded.principals
    .map((entry) => `  ${JSON.stringify(entry.id)},`)
    .join("\n");
  const profiles = loaded.profiles
    .map((entry) => `  ${JSON.stringify(entry.id)},`)
    .join("\n");
  const capabilities = loaded.capabilities
    .map((entry) => `  ${JSON.stringify(entry.id)},`)
    .join("\n");
  const commands = loaded.commands
    .map((entry) => `  ${JSON.stringify(entry.id)},`)
    .join("\n");

  const content = `${typescriptHeader()}

import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";
import type {
  SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  SecurityCapabilityTaxonomyV1CapabilityEntry,
  SecurityCapabilityTaxonomyV1CapabilityId,
  SecurityCapabilityTaxonomyV1PrincipalEntry,
  SecurityCapabilityTaxonomyV1PrincipalId,
  SecurityCapabilityTaxonomyV1ProfileEntry,
} from "./capability-taxonomy.v1.ts";
import type {
  SecurityCommandTaxonomyV1CommandEntry,
  SecurityCommandTaxonomyV1CommandId,
} from "./command-taxonomy.v1.ts";
import type { SecurityAuthorizationPolicyV1AuthorizationAllowRow } from "./authorization-policy.v1.ts";
import type { SecurityAuthorizationRequestV1 } from "./authorization-request.v1.ts";
import { validateSecurityAuthorizationRequestV1 } from "../validators.ts";

export const PRINCIPAL_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1PrincipalId,
    SecurityCapabilityTaxonomyV1PrincipalEntry
  >
> = Object.freeze({
${tsDescribedEntries(loaded.principals)}
});

export const AUTHORIZATION_PROFILE_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    SecurityCapabilityTaxonomyV1ProfileEntry
  >
> = Object.freeze({
${tsDescribedEntries(loaded.profiles)}
});

export const CAPABILITY_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1CapabilityId,
    SecurityCapabilityTaxonomyV1CapabilityEntry
  >
> = Object.freeze({
${tsDescribedEntries(loaded.capabilities)}
});

export const COMMAND_CATALOG_V1: Readonly<
  Record<
    SecurityCommandTaxonomyV1CommandId,
    SecurityCommandTaxonomyV1CommandEntry
  >
> = Object.freeze({
${tsCommandEntries(loaded.commands)}
});

export const AUTHORIZATION_POLICY_V1:
  readonly SecurityAuthorizationPolicyV1AuthorizationAllowRow[] =
    Object.freeze([
${tsPolicyRows(loaded.allow)}
    ]);

export const PRINCIPAL_IDS_V1:
  readonly SecurityCapabilityTaxonomyV1PrincipalId[] = Object.freeze([
${principals}
]);

export const AUTHORIZATION_PROFILES_V1:
  readonly SecurityCapabilityTaxonomyV1AuthorizationProfileId[] =
    Object.freeze([
${profiles}
    ]);

export const CAPABILITY_IDS_V1:
  readonly SecurityCapabilityTaxonomyV1CapabilityId[] = Object.freeze([
${capabilities}
]);

export const COMMAND_IDS_V1:
  readonly SecurityCommandTaxonomyV1CommandId[] = Object.freeze([
${commands}
]);

export function isPrincipalIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1PrincipalId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRINCIPAL_CATALOG_V1, value)
  );
}

export function isAuthorizationProfileIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1AuthorizationProfileId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(AUTHORIZATION_PROFILE_CATALOG_V1, value)
  );
}

export function isCapabilityIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1CapabilityId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CAPABILITY_CATALOG_V1, value)
  );
}

export function isCommandIdV1(
  value: unknown,
): value is SecurityCommandTaxonomyV1CommandId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(COMMAND_CATALOG_V1, value)
  );
}

export function requireCapabilityEntryV1(
  value: unknown,
): SecurityCapabilityTaxonomyV1CapabilityEntry {
  if (!isCapabilityIdV1(value)) {
    throw new Error(
      "unknown capability id: not a member of the v1 capability catalog",
    );
  }
  return CAPABILITY_CATALOG_V1[value];
}

export function requireCommandEntryV1(
  value: unknown,
): SecurityCommandTaxonomyV1CommandEntry {
  if (!isCommandIdV1(value)) {
    throw new Error(
      "unknown command id: not a member of the v1 command catalog",
    );
  }
  return COMMAND_CATALOG_V1[value];
}

function policyKey(
  profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  command: SecurityCommandTaxonomyV1CommandId,
  origin: SecurityCapabilityTaxonomyV1PrincipalId,
  sender: SecurityCapabilityTaxonomyV1PrincipalId,
  receiver: SecurityCapabilityTaxonomyV1PrincipalId,
  target: SecurityCapabilityTaxonomyV1PrincipalId,
): string {
  return JSON.stringify([profile, command, origin, sender, receiver, target]);
}

const POLICY_KEYS = new Set(
  AUTHORIZATION_POLICY_V1.map((row) =>
    policyKey(
      row.authorization_profile,
      row.command_id,
      row.originating_principal,
      row.immediate_sender,
      row.receiving_principal,
      row.target_principal,
    ),
  ),
);

export function allowedCommandsForV1(
  profile: unknown,
  origin: unknown,
  sender: unknown,
  receiver: unknown,
  target: unknown,
): readonly SecurityCommandTaxonomyV1CommandId[] {
  if (
    !isAuthorizationProfileIdV1(profile) ||
    !isPrincipalIdV1(origin) ||
    !isPrincipalIdV1(sender) ||
    !isPrincipalIdV1(receiver) ||
    !isPrincipalIdV1(target)
  ) {
    return Object.freeze([]);
  }
  return Object.freeze(
    COMMAND_IDS_V1.filter((command) =>
      POLICY_KEYS.has(
        policyKey(profile, command, origin, sender, receiver, target),
      ),
    ),
  );
}

export interface AuthorizationRuntimeContextV1 {
  readonly receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authenticated_sender_principal:
    SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authenticated_originating_principal:
    SecurityCapabilityTaxonomyV1PrincipalId;
  readonly active_profile:
    SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly observed_payload_size_bytes: number;
}

export interface AuthorizationAllowedV1 {
  readonly authorized: true;
  readonly command_id: SecurityCommandTaxonomyV1CommandId;
  readonly required_capability: SecurityCapabilityTaxonomyV1CapabilityId;
}

export interface AuthorizationDeniedV1 {
  readonly authorized: false;
  readonly error_code: ErrorTaxonomyV1ErrorCode;
}

export type AuthorizationOutcomeV1 =
  | AuthorizationAllowedV1
  | AuthorizationDeniedV1;

function snapshotPlainDataRecordV1(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") {
        return null;
      }
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isRuntimeContextV1(
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> &
  AuthorizationRuntimeContextV1 {
  const keys = Object.keys(value).sort();
  return (
    JSON.stringify(keys) ===
      JSON.stringify([
        "active_profile",
        "authenticated_originating_principal",
        "authenticated_sender_principal",
        "observed_payload_size_bytes",
        "receiving_principal",
      ]) &&
    isPrincipalIdV1(value.receiving_principal) &&
    isPrincipalIdV1(value.authenticated_sender_principal) &&
    isPrincipalIdV1(value.authenticated_originating_principal) &&
    isAuthorizationProfileIdV1(value.active_profile) &&
    typeof value.observed_payload_size_bytes === "number" &&
    Number.isSafeInteger(value.observed_payload_size_bytes) &&
    value.observed_payload_size_bytes >= 0
  );
}

const CONTENT_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>(["PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE"]);

const DESKTOP_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
  "ARTIFACT_READ_REQUEST",
  "ARTIFACT_WRITE_REQUEST",
  "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
  "PRIVATE_DATA_READ_REQUEST",
  "PRIVATE_DATA_WRITE_REQUEST",
  "WORKFLOW_CANCEL",
  "WORKFLOW_PAUSE",
]);

const ORCHESTRATOR_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
  "MODEL_INFERENCE_REQUEST",
  "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
  "PAGE_NAVIGATE_BACK",
  "PAGE_NAVIGATE_NEXT",
  "PAGE_RECONCILE_STATE",
  "PAGE_SCAN_VISIBLE_CONTROLS",
  "PAGE_UPLOAD_REVIEWED_DOCUMENT",
  "PAGE_VERIFY_FIELD_VALUES",
  "PUBLIC_JOB_INDEX_QUERY",
]);

const IDEMPOTENCY_KEY_REQUIRED_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
${[...IDEMPOTENCY_KEY_REQUIRED_COMMANDS]
  .map((command) => `  ${JSON.stringify(command)},`)
  .join("\n")}
]);

const VERIFICATION_CAPABILITIES = new Set<
  SecurityCapabilityTaxonomyV1CapabilityId
>([
  "PAGE_DOCUMENT_UPLOAD",
  "PAGE_INSPECT",
  "PAGE_MUTATE_BOUNDED",
  "PAGE_NAVIGATE_BOUNDED",
  "PAGE_VALIDATE_RECONCILE_REVIEW",
  "VERIFICATION_EXECUTION",
  "WORKFLOW_CONTROL",
]);

const PROFILE_CAPABILITY_CEILINGS: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    readonly SecurityCapabilityTaxonomyV1CapabilityId[]
  >
> = Object.freeze({
${tsProfileCapabilityCeilings()}
});

const PRIVILEGED_CONTENT_CAPABILITIES = new Set<
  SecurityCapabilityTaxonomyV1CapabilityId
>([
  "ARTIFACT_READ",
  "ARTIFACT_WRITE",
  "MODEL_INFERENCE",
  "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
  "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
  "PLATFORM_PROCESS_SUPERVISION",
  "PLATFORM_SECRET_STORE_ACCESS",
  "PRIVATE_DATA_READ",
  "PRIVATE_DATA_WRITE",
  "PUBLIC_JOB_INDEX_READ",
  "SUBMISSION_FINAL",
]);

function isArchitecturallyForbidden(
  request: SecurityAuthorizationRequestV1,
  command: SecurityCommandTaxonomyV1CommandEntry,
): boolean {
  const origin = request.originating_principal;
  if (command.id === "SUBMISSION_FINAL_SUBMIT") {
    return true;
  }
  if (command.required_capability === "SUBMISSION_FINAL") {
    return true;
  }
  if (command.required_capability.startsWith("PLATFORM_")) {
    return true;
  }
  if (
    !PROFILE_CAPABILITY_CEILINGS[
      request.authorization_profile
    ].includes(command.required_capability)
  ) {
    return true;
  }
  if (
    origin === "EXTENSION_CONTENT_SCRIPT" &&
    (PRIVILEGED_CONTENT_CAPABILITIES.has(command.required_capability) ||
      !CONTENT_ORIGIN_COMMANDS.has(command.id))
  ) {
    return true;
  }
  if (
    origin === "EXTENSION_SERVICE_WORKER" ||
    origin === "NATIVE_HOST" ||
    origin === "MODEL_RUNTIME" ||
    origin === "PLATFORM_ADAPTER" ||
    origin === "PUBLIC_JOB_INDEX"
  ) {
    return true;
  }
  if (
    origin === "DESKTOP_APP" &&
    (!DESKTOP_ORIGIN_COMMANDS.has(command.id) ||
      request.target_principal === "PLATFORM_ADAPTER")
  ) {
    return true;
  }
  if (
    origin === "ORCHESTRATOR" &&
    !ORCHESTRATOR_ORIGIN_COMMANDS.has(command.id)
  ) {
    return true;
  }
  if (
    origin === "VERIFICATION_HARNESS" &&
    ((request.authorization_profile !== "FEASIBILITY" &&
      request.authorization_profile !== "VERIFICATION") ||
      !VERIFICATION_CAPABILITIES.has(command.required_capability))
  ) {
    return true;
  }
  return false;
}

function deny(error_code: ErrorTaxonomyV1ErrorCode): AuthorizationDeniedV1 {
  return Object.freeze({ authorized: false, error_code });
}

export function authorizeCommandRequestV1(
  value: unknown,
  contextValue: unknown,
): AuthorizationOutcomeV1 {
  const context = snapshotPlainDataRecordV1(contextValue);
  if (context === null || !isRuntimeContextV1(context)) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const requestSnapshot = snapshotPlainDataRecordV1(value);
  if (requestSnapshot === null) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const validation = validateSecurityAuthorizationRequestV1(requestSnapshot);
  if (!validation.valid) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const request = validation.value;
  if (
    request.immediate_sender !==
      context.authenticated_sender_principal ||
    request.originating_principal !==
      context.authenticated_originating_principal ||
    request.authorization_profile !== context.active_profile
  ) {
    return deny("TRANSPORT_FORBIDDEN");
  }
  if (request.payload_size_bytes !== context.observed_payload_size_bytes) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const command = COMMAND_CATALOG_V1[request.command_id];
  if (command.id === "SUBMISSION_FINAL_SUBMIT") {
    return deny("SUBMISSION_PROHIBITED_FINAL_ACTION");
  }
  if (
    request.target_principal !== command.intended_target ||
    isArchitecturallyForbidden(request, command)
  ) {
    return deny("TRANSPORT_FORBIDDEN");
  }
  if (!command.supported_profiles.includes(request.authorization_profile)) {
    return deny(command.denial_error_code);
  }
  if (
    context.observed_payload_size_bytes > command.max_encoded_payload_size_bytes
  ) {
    return deny("TRANSPORT_PAYLOAD_TOO_LARGE");
  }
  if (
    IDEMPOTENCY_KEY_REQUIRED_COMMANDS.has(command.id) &&
    request.idempotency_key === undefined
  ) {
    return deny("VALIDATION_MISSING_REQUIRED_DATA");
  }
  const key = policyKey(
    request.authorization_profile,
    request.command_id,
    request.originating_principal,
    request.immediate_sender,
    context.receiving_principal,
    request.target_principal,
  );
  if (!POLICY_KEYS.has(key)) {
    return deny(command.denial_error_code);
  }
  return Object.freeze({
    authorized: true,
    command_id: command.id,
    required_capability: command.required_capability,
  });
}
`;
  return { path: "typescript/security/policy-data.v1.ts", content };
}

function pyStringTuple(values: readonly string[], indent: string): string {
  if (values.length === 0) {
    return "()";
  }
  return [
    "(",
    ...values.map((value) => `${indent}${pythonStringLiteral(value)},`),
    `${indent.slice(4)})`,
  ].join("\n");
}

function pyProfileCapabilityCeilings(): string {
  return [...PROFILE_CAPABILITY_CEILINGS]
    .map(([profile, capabilities]) =>
      [
        `    ${pythonStringLiteral(profile)}: frozenset({`,
        ...[...capabilities].map(
          (capability) => `        ${pythonStringLiteral(capability)},`,
        ),
        "    }),",
      ].join("\n"),
    )
    .join("\n");
}

function pyDescribedEntries(
  entries: readonly (
    PrincipalEntryData | ProfileEntryData | CapabilityEntryData
  )[],
  className: string,
): string {
  return entries
    .map((entry) =>
      [
        `    ${pythonStringLiteral(entry.id)}: ${className}(`,
        `        id=${pythonStringLiteral(entry.id)},`,
        `        description=${pythonStringLiteral(entry.description)},`,
        `        non_goals=${pyStringTuple(entry.non_goals, "            ")},`,
        "    ),",
      ].join("\n"),
    )
    .join("\n");
}

function pyCommandEntries(entries: readonly CommandEntryData[]): string {
  return entries
    .map((entry) =>
      [
        `    ${pythonStringLiteral(entry.id)}: CommandCatalogEntryV1(`,
        `        id=${pythonStringLiteral(entry.id)},`,
        `        required_capability=${pythonStringLiteral(entry.required_capability)},`,
        `        intended_target=${pythonStringLiteral(entry.intended_target)},`,
        `        supported_profiles=${pyStringTuple(entry.supported_profiles, "            ")},`,
        `        max_encoded_payload_size_bytes=${String(entry.max_encoded_payload_size_bytes)},`,
        `        consequence_class=${pythonStringLiteral(entry.consequence_class)},`,
        `        idempotency_expectation=${pythonStringLiteral(entry.idempotency_expectation)},`,
        `        denial_error_code=${pythonStringLiteral(entry.denial_error_code)},`,
        `        description=${pythonStringLiteral(entry.description)},`,
        `        non_goals=${pyStringTuple(entry.non_goals, "            ")},`,
        "    ),",
      ].join("\n"),
    )
    .join("\n");
}

function pyPolicyRows(rows: readonly AuthorizationAllowRowData[]): string {
  return rows
    .map((row) =>
      [
        "    AuthorizationPolicyRowV1(",
        ...ROW_FIELDS.map(
          (field) => `        ${field}=${pythonStringLiteral(row[field])},`,
        ),
        "    ),",
      ].join("\n"),
    )
    .join("\n");
}

/** Emit immutable Python catalogs and fail-closed authorization helpers. */
export function emitPythonSecurityPolicy(
  loaded: LoadedSecurityPolicy,
): GeneratedFile {
  const principalIds = loaded.principals
    .map((entry) => `    ${pythonStringLiteral(entry.id)},`)
    .join("\n");
  const profileIds = loaded.profiles
    .map((entry) => `    ${pythonStringLiteral(entry.id)},`)
    .join("\n");
  const capabilityIds = loaded.capabilities
    .map((entry) => `    ${pythonStringLiteral(entry.id)},`)
    .join("\n");
  const commandIds = loaded.commands
    .map((entry) => `    ${pythonStringLiteral(entry.id)},`)
    .join("\n");

  const content = `"""GENERATED FILE - DO NOT EDIT BY HAND.

Canonical M01-W04 security data derived from capability-catalog.v1.json,
command-catalog.v1.json, and authorization-policy.v1.json.

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Final, Literal, Mapping, NamedTuple, cast

from pydantic import ValidationError

from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode
from japp_contracts.security.authorization_request_v1 import (
    SecurityAuthorizationRequestV1,
)
from japp_contracts.security.capability_taxonomy_v1 import (
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    SecurityCapabilityTaxonomyV1CapabilityId,
    SecurityCapabilityTaxonomyV1PrincipalId,
)
from japp_contracts.security.command_taxonomy_v1 import (
    SecurityCommandTaxonomyV1CommandId,
    SecurityCommandTaxonomyV1ConsequenceClass,
    SecurityCommandTaxonomyV1IdempotencyExpectation,
)


@dataclass(frozen=True, slots=True)
class PrincipalCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1PrincipalId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class AuthorizationProfileCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CapabilityCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1CapabilityId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CommandCatalogEntryV1:
    id: SecurityCommandTaxonomyV1CommandId
    required_capability: SecurityCapabilityTaxonomyV1CapabilityId
    intended_target: SecurityCapabilityTaxonomyV1PrincipalId
    supported_profiles: tuple[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId, ...
    ]
    max_encoded_payload_size_bytes: int
    consequence_class: SecurityCommandTaxonomyV1ConsequenceClass
    idempotency_expectation: SecurityCommandTaxonomyV1IdempotencyExpectation
    denial_error_code: ErrorTaxonomyV1ErrorCode
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class AuthorizationPolicyRowV1:
    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    command_id: SecurityCommandTaxonomyV1CommandId
    originating_principal: SecurityCapabilityTaxonomyV1PrincipalId
    immediate_sender: SecurityCapabilityTaxonomyV1PrincipalId
    receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId
    target_principal: SecurityCapabilityTaxonomyV1PrincipalId


PRINCIPAL_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1PrincipalId,
        PrincipalCatalogEntryV1,
    ]
] = MappingProxyType({
${pyDescribedEntries(loaded.principals, "PrincipalCatalogEntryV1")}
})

AUTHORIZATION_PROFILE_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId,
        AuthorizationProfileCatalogEntryV1,
    ]
] = MappingProxyType({
${pyDescribedEntries(loaded.profiles, "AuthorizationProfileCatalogEntryV1")}
})

CAPABILITY_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1CapabilityId,
        CapabilityCatalogEntryV1,
    ]
] = MappingProxyType({
${pyDescribedEntries(loaded.capabilities, "CapabilityCatalogEntryV1")}
})

COMMAND_CATALOG_V1: Final[
    Mapping[
        SecurityCommandTaxonomyV1CommandId,
        CommandCatalogEntryV1,
    ]
] = MappingProxyType({
${pyCommandEntries(loaded.commands)}
})

AUTHORIZATION_POLICY_V1: Final[tuple[AuthorizationPolicyRowV1, ...]] = (
${pyPolicyRows(loaded.allow)}
)

PRINCIPAL_IDS_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1PrincipalId, ...]
] = (
${principalIds}
)
AUTHORIZATION_PROFILES_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1AuthorizationProfileId, ...]
] = (
${profileIds}
)
CAPABILITY_IDS_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1CapabilityId, ...]
] = (
${capabilityIds}
)
COMMAND_IDS_V1: Final[tuple[SecurityCommandTaxonomyV1CommandId, ...]] = (
${commandIds}
)


def is_principal_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in PRINCIPAL_CATALOG_V1


def is_authorization_profile_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in AUTHORIZATION_PROFILE_CATALOG_V1


def is_capability_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in CAPABILITY_CATALOG_V1


def is_command_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in COMMAND_CATALOG_V1


def require_capability_entry_v1(value: object) -> CapabilityCatalogEntryV1:
    if not is_capability_id_v1(value):
        msg = "unknown capability id: not a member of the v1 capability catalog"
        raise KeyError(msg)
    return CAPABILITY_CATALOG_V1[
        cast("SecurityCapabilityTaxonomyV1CapabilityId", value)
    ]


def require_command_entry_v1(value: object) -> CommandCatalogEntryV1:
    if not is_command_id_v1(value):
        msg = "unknown command id: not a member of the v1 command catalog"
        raise KeyError(msg)
    return COMMAND_CATALOG_V1[
        cast("SecurityCommandTaxonomyV1CommandId", value)
    ]


def _policy_key(
    profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    command: SecurityCommandTaxonomyV1CommandId,
    origin: SecurityCapabilityTaxonomyV1PrincipalId,
    sender: SecurityCapabilityTaxonomyV1PrincipalId,
    receiver: SecurityCapabilityTaxonomyV1PrincipalId,
    target: SecurityCapabilityTaxonomyV1PrincipalId,
) -> tuple[str, str, str, str, str, str]:
    return (profile, command, origin, sender, receiver, target)


_POLICY_KEYS: Final = frozenset(
    _policy_key(
        row.authorization_profile,
        row.command_id,
        row.originating_principal,
        row.immediate_sender,
        row.receiving_principal,
        row.target_principal,
    )
    for row in AUTHORIZATION_POLICY_V1
)


def allowed_commands_for_v1(
    profile: object,
    origin: object,
    sender: object,
    receiver: object,
    target: object,
) -> tuple[SecurityCommandTaxonomyV1CommandId, ...]:
    if not (
        is_authorization_profile_id_v1(profile)
        and is_principal_id_v1(origin)
        and is_principal_id_v1(sender)
        and is_principal_id_v1(receiver)
        and is_principal_id_v1(target)
    ):
        return ()
    typed_profile = cast("SecurityCapabilityTaxonomyV1AuthorizationProfileId", profile)
    typed_origin = cast("SecurityCapabilityTaxonomyV1PrincipalId", origin)
    typed_sender = cast("SecurityCapabilityTaxonomyV1PrincipalId", sender)
    typed_receiver = cast("SecurityCapabilityTaxonomyV1PrincipalId", receiver)
    typed_target = cast("SecurityCapabilityTaxonomyV1PrincipalId", target)
    return tuple(
        command
        for command in COMMAND_IDS_V1
        if _policy_key(
            typed_profile,
            command,
            typed_origin,
            typed_sender,
            typed_receiver,
            typed_target,
        )
        in _POLICY_KEYS
    )


@dataclass(frozen=True, slots=True)
class AuthorizationRuntimeContextV1:
    receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId
    authenticated_sender_principal: SecurityCapabilityTaxonomyV1PrincipalId
    authenticated_originating_principal: SecurityCapabilityTaxonomyV1PrincipalId
    active_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    observed_payload_size_bytes: int


class AuthorizationAllowedV1(NamedTuple):
    authorized: Literal[True]
    command_id: SecurityCommandTaxonomyV1CommandId
    required_capability: SecurityCapabilityTaxonomyV1CapabilityId


class AuthorizationDeniedV1(NamedTuple):
    authorized: Literal[False]
    error_code: ErrorTaxonomyV1ErrorCode


AuthorizationOutcomeV1 = AuthorizationAllowedV1 | AuthorizationDeniedV1

_CONTENT_ORIGIN_COMMANDS: Final = frozenset(
    {"PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE"}
)
_DESKTOP_ORIGIN_COMMANDS: Final = frozenset(
    {
        "ARTIFACT_READ_REQUEST",
        "ARTIFACT_WRITE_REQUEST",
        "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        "PRIVATE_DATA_READ_REQUEST",
        "PRIVATE_DATA_WRITE_REQUEST",
        "WORKFLOW_CANCEL",
        "WORKFLOW_PAUSE",
    }
)
_ORCHESTRATOR_ORIGIN_COMMANDS: Final = frozenset(
    {
        "MODEL_INFERENCE_REQUEST",
        "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "PAGE_NAVIGATE_BACK",
        "PAGE_NAVIGATE_NEXT",
        "PAGE_RECONCILE_STATE",
        "PAGE_SCAN_VISIBLE_CONTROLS",
        "PAGE_UPLOAD_REVIEWED_DOCUMENT",
        "PAGE_VERIFY_FIELD_VALUES",
        "PUBLIC_JOB_INDEX_QUERY",
    }
)
_IDEMPOTENCY_KEY_REQUIRED_COMMANDS: Final = frozenset(
    {
${[...IDEMPOTENCY_KEY_REQUIRED_COMMANDS]
  .map((command) => `        ${pythonStringLiteral(command)},`)
  .join("\n")}
    }
)
_VERIFICATION_CAPABILITIES: Final = frozenset(
    {
        "PAGE_DOCUMENT_UPLOAD",
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_NAVIGATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "VERIFICATION_EXECUTION",
        "WORKFLOW_CONTROL",
    }
)
_PROFILE_CAPABILITY_CEILINGS: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId,
        frozenset[SecurityCapabilityTaxonomyV1CapabilityId],
    ]
] = MappingProxyType({
${pyProfileCapabilityCeilings()}
})
_PRIVILEGED_CONTENT_CAPABILITIES: Final = frozenset(
    {
        "ARTIFACT_READ",
        "ARTIFACT_WRITE",
        "MODEL_INFERENCE",
        "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
        "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
        "PLATFORM_PROCESS_SUPERVISION",
        "PLATFORM_SECRET_STORE_ACCESS",
        "PRIVATE_DATA_READ",
        "PRIVATE_DATA_WRITE",
        "PUBLIC_JOB_INDEX_READ",
        "SUBMISSION_FINAL",
    }
)


def _architecturally_forbidden(
    request: SecurityAuthorizationRequestV1,
    command: CommandCatalogEntryV1,
) -> bool:
    origin = request.originating_principal
    if command.id == "SUBMISSION_FINAL_SUBMIT":
        return True
    if command.required_capability == "SUBMISSION_FINAL":
        return True
    if command.required_capability.startswith("PLATFORM_"):
        return True
    if (
        command.required_capability
        not in _PROFILE_CAPABILITY_CEILINGS[request.authorization_profile]
    ):
        return True
    if origin == "EXTENSION_CONTENT_SCRIPT" and (
        command.required_capability in _PRIVILEGED_CONTENT_CAPABILITIES
        or command.id not in _CONTENT_ORIGIN_COMMANDS
    ):
        return True
    if origin in {
        "EXTENSION_SERVICE_WORKER",
        "NATIVE_HOST",
        "MODEL_RUNTIME",
        "PLATFORM_ADAPTER",
        "PUBLIC_JOB_INDEX",
    }:
        return True
    if origin == "DESKTOP_APP" and (
        command.id not in _DESKTOP_ORIGIN_COMMANDS
        or request.target_principal == "PLATFORM_ADAPTER"
    ):
        return True
    if (
        origin == "ORCHESTRATOR"
        and command.id not in _ORCHESTRATOR_ORIGIN_COMMANDS
    ):
        return True
    return bool(
        origin == "VERIFICATION_HARNESS"
        and (
            request.authorization_profile not in {"FEASIBILITY", "VERIFICATION"}
            or command.required_capability not in _VERIFICATION_CAPABILITIES
        )
    )


def _deny(error_code: ErrorTaxonomyV1ErrorCode) -> AuthorizationDeniedV1:
    return AuthorizationDeniedV1(False, error_code)


def authorize_command_request_v1(
    value: object,
    context: object,
) -> AuthorizationOutcomeV1:
    if not isinstance(context, AuthorizationRuntimeContextV1):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    if not (
        is_principal_id_v1(context.receiving_principal)
        and is_principal_id_v1(context.authenticated_sender_principal)
        and is_principal_id_v1(context.authenticated_originating_principal)
        and is_authorization_profile_id_v1(context.active_profile)
        and type(context.observed_payload_size_bytes) is int
        and 0 <= context.observed_payload_size_bytes <= 9_007_199_254_740_991
    ):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    try:
        wire_value: object
        if isinstance(value, SecurityAuthorizationRequestV1):
            wire_value = SecurityAuthorizationRequestV1.model_dump(
                value,
                mode="python",
                exclude_unset=True,
                warnings="error",
            )
        else:
            wire_value = value
        request = SecurityAuthorizationRequestV1.model_validate(wire_value)
    except (ValidationError, TypeError, ValueError):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    if (
        request.immediate_sender != context.authenticated_sender_principal
        or request.originating_principal
        != context.authenticated_originating_principal
        or request.authorization_profile != context.active_profile
    ):
        return _deny("TRANSPORT_FORBIDDEN")
    if request.payload_size_bytes != context.observed_payload_size_bytes:
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    command = COMMAND_CATALOG_V1[request.command_id]
    if command.id == "SUBMISSION_FINAL_SUBMIT":
        return _deny("SUBMISSION_PROHIBITED_FINAL_ACTION")
    if (
        request.target_principal != command.intended_target
        or _architecturally_forbidden(request, command)
    ):
        return _deny("TRANSPORT_FORBIDDEN")
    if request.authorization_profile not in command.supported_profiles:
        return _deny(command.denial_error_code)
    if (
        context.observed_payload_size_bytes
        > command.max_encoded_payload_size_bytes
    ):
        return _deny("TRANSPORT_PAYLOAD_TOO_LARGE")
    if (
        command.id in _IDEMPOTENCY_KEY_REQUIRED_COMMANDS
        and request.idempotency_key is None
    ):
        return _deny("VALIDATION_MISSING_REQUIRED_DATA")
    key = _policy_key(
        request.authorization_profile,
        request.command_id,
        request.originating_principal,
        request.immediate_sender,
        context.receiving_principal,
        request.target_principal,
    )
    if key not in _POLICY_KEYS:
        return _deny(command.denial_error_code)
    return AuthorizationAllowedV1(
        True,
        command.id,
        command.required_capability,
    )
`;
  return {
    path: "python/src/japp_contracts/security/policy_data_v1.py",
    content,
  };
}

export const PYTHON_SECURITY_POLICY_EXPORTS = [
  "AUTHORIZATION_POLICY_V1",
  "AUTHORIZATION_PROFILE_CATALOG_V1",
  "AUTHORIZATION_PROFILES_V1",
  "AuthorizationAllowedV1",
  "AuthorizationDeniedV1",
  "AuthorizationOutcomeV1",
  "AuthorizationPolicyRowV1",
  "AuthorizationProfileCatalogEntryV1",
  "AuthorizationRuntimeContextV1",
  "CAPABILITY_CATALOG_V1",
  "CAPABILITY_IDS_V1",
  "COMMAND_CATALOG_V1",
  "COMMAND_IDS_V1",
  "CapabilityCatalogEntryV1",
  "CommandCatalogEntryV1",
  "PRINCIPAL_CATALOG_V1",
  "PRINCIPAL_IDS_V1",
  "PrincipalCatalogEntryV1",
  "allowed_commands_for_v1",
  "authorize_command_request_v1",
  "is_authorization_profile_id_v1",
  "is_capability_id_v1",
  "is_command_id_v1",
  "is_principal_id_v1",
  "require_capability_entry_v1",
  "require_command_entry_v1",
] as const;
