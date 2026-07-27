/**
 * Test-only M01-W05 historical compatibility signature and comparator.
 *
 * The signature is derived from the canonical schema IR, validated catalogs,
 * and canonical corpus. It is evidence about the accepted v1 surface, never a
 * second contract source and never a production migration API.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createContractValidator,
  loadSchemaCatalog,
} from "../../../src/index.ts";
import {
  loadErrorCatalog,
  type ErrorCatalogEntryData,
} from "../../../generator/error-catalog.ts";
import {
  buildIrCatalog,
  type IrMetadata,
  type IrType,
} from "../../../generator/ir.ts";
import {
  loadSecurityPolicy,
  type AuthorizationAllowRowData,
  type CommandEntryData,
} from "../../../generator/security-policy.ts";
import {
  loadSemanticRules,
  type SemanticRuleEntryData,
} from "../../../generator/semantic-rules.ts";
import { adapterBatchFor, loadCorpus } from "../adapters/corpus-loader.ts";
import { canonicalJson, type PlainJson } from "../adapters/normalization.ts";

export const REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../../", import.meta.url),
);

export interface PropertySignature {
  required: boolean;
  node: NodeSignature;
}

/**
 * Uniform exhaustive representation of every current IR variant.
 *
 * Fields that do not apply to a kind are null/empty. This makes baseline
 * parsing closed and future IR additions compile-fail until intentionally
 * represented.
 */
export interface NodeSignature {
  kind: IrType["kind"];
  deprecated: boolean;
  deprecated_since: string | null;
  sensitivity: string | null;
  redaction: string | null;
  pattern: string | null;
  format: string | null;
  min_length: number | null;
  max_length: number | null;
  minimum: number | null;
  maximum: number | null;
  tokens: string[];
  items: NodeSignature | null;
  min_items: number | null;
  max_items: number | null;
  ref_id: string | null;
  ref_definition: string | null;
  inner: NodeSignature | null;
  properties: Record<string, PropertySignature>;
  extension_point: boolean | null;
  property_names: NodeSignature | null;
  max_properties: number | null;
}

export interface DocumentSignature {
  path: string;
  id: string;
  major: number;
  version: string;
  definitions: Record<string, NodeSignature>;
  root: NodeSignature | null;
}

export interface ErrorBindingSignature {
  code: string;
  family: string;
  message_key: string;
  severity: string;
  retry_disposition: string;
  user_action_required: boolean;
  transient: boolean;
  diagnostic_policy: string;
  owning_boundary: string | null;
  added_in: string;
  deprecated_since: string | null;
}

export interface CommandSignature {
  id: string;
  required_capability: string;
  intended_target: string;
  supported_profiles: string[];
  max_encoded_payload_size_bytes: number;
  consequence_class: string;
  idempotency_expectation: string;
  denial_error_code: string;
}

export interface AllowRowSignature {
  authorization_profile: string;
  command_id: string;
  originating_principal: string;
  immediate_sender: string;
  receiving_principal: string;
  target_principal: string;
}

export interface SupportedCaseSignature {
  id: string;
  schema_ref: string;
  operation: string;
  languages: string[];
  semantic_sha256: string;
}

export interface SemanticRuleSignature {
  rule_id: string;
  rule_version: string;
  schema_ref: string;
  rule_kind: string;
  failure_error_code: string;
}

export interface SemanticRuleCatalogSignature {
  repository_path: string;
  catalog_version: string;
  canonical_sha256: string;
}

export interface CompatibilitySignature {
  documents: DocumentSignature[];
  error_bindings: ErrorBindingSignature[];
  principal_ids: string[];
  profile_ids: string[];
  capability_ids: string[];
  commands: CommandSignature[];
  allow_rows: AllowRowSignature[];
  semantic_rule_catalog: SemanticRuleCatalogSignature;
  semantic_rules: SemanticRuleSignature[];
  supported_valid_cases: SupportedCaseSignature[];
}

export interface CompatibilityFinding {
  code: string;
  subject: string;
}

export interface CompatibilityReport {
  compatible: boolean;
  findings: CompatibilityFinding[];
  additive_changes: CompatibilityFinding[];
}

function digest(value: PlainJson): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function metadata(
  node: IrMetadata,
): Pick<
  NodeSignature,
  "deprecated" | "deprecated_since" | "redaction" | "sensitivity"
> {
  return {
    deprecated: node.deprecated,
    deprecated_since: node.deprecatedSince,
    sensitivity: node.sensitivity,
    redaction: node.redaction,
  };
}

function emptyNode(
  kind: NodeSignature["kind"],
  nodeMetadata: IrMetadata,
): NodeSignature {
  return {
    kind,
    ...metadata(nodeMetadata),
    pattern: null,
    format: null,
    min_length: null,
    max_length: null,
    minimum: null,
    maximum: null,
    tokens: [],
    items: null,
    min_items: null,
    max_items: null,
    ref_id: null,
    ref_definition: null,
    inner: null,
    properties: {},
    extension_point: null,
    property_names: null,
    max_properties: null,
  };
}

function nodeSignature(node: IrType): NodeSignature {
  const result = emptyNode(node.kind, node.metadata);
  switch (node.kind) {
    case "string":
      return {
        ...result,
        pattern: node.pattern,
        format: node.format,
        min_length: node.minLength,
        max_length: node.maxLength,
      };
    case "enum":
      return { ...result, tokens: [...node.tokens] };
    case "number":
    case "integer":
      return {
        ...result,
        minimum: node.minimum,
        maximum: node.maximum,
      };
    case "boolean":
    case "any":
      return result;
    case "array":
      return {
        ...result,
        items: nodeSignature(node.items),
        min_items: node.minItems,
        max_items: node.maxItems,
      };
    case "ref":
      return {
        ...result,
        ref_id: node.targetId,
        ref_definition: node.targetDef,
      };
    case "nullable":
      return { ...result, inner: nodeSignature(node.inner) };
    case "object":
      return {
        ...result,
        properties: Object.fromEntries(
          [...node.properties]
            .sort((left, right) =>
              left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
            )
            .map((property) => [
              property.name,
              {
                required: property.required,
                node: nodeSignature(property.type),
              },
            ]),
        ),
        extension_point: node.extensionPoint,
        property_names:
          node.propertyNames === null
            ? null
            : nodeSignature(node.propertyNames),
        max_properties: node.maxProperties,
      };
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function renderVersion(version: {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}): string {
  return `${String(version.major)}.${String(version.minor)}.${String(
    version.patch,
  )}`;
}

function errorSignature(entry: ErrorCatalogEntryData): ErrorBindingSignature {
  return {
    code: entry.code,
    family: entry.family,
    message_key: entry.message_key,
    severity: entry.severity,
    retry_disposition: entry.retry_disposition,
    user_action_required: entry.user_action_required,
    transient: entry.transient,
    diagnostic_policy: entry.diagnostic_policy,
    owning_boundary: entry.owning_boundary ?? null,
    added_in: entry.added_in,
    deprecated_since: entry.deprecated_since ?? null,
  };
}

function commandSignature(entry: CommandEntryData): CommandSignature {
  return {
    id: entry.id,
    required_capability: entry.required_capability,
    intended_target: entry.intended_target,
    supported_profiles: [...entry.supported_profiles],
    max_encoded_payload_size_bytes: entry.max_encoded_payload_size_bytes,
    consequence_class: entry.consequence_class,
    idempotency_expectation: entry.idempotency_expectation,
    denial_error_code: entry.denial_error_code,
  };
}

function allowRowSignature(
  entry: AuthorizationAllowRowData,
): AllowRowSignature {
  return {
    authorization_profile: entry.authorization_profile,
    command_id: entry.command_id,
    originating_principal: entry.originating_principal,
    immediate_sender: entry.immediate_sender,
    receiving_principal: entry.receiving_principal,
    target_principal: entry.target_principal,
  };
}

function semanticRuleSignature(
  entry: SemanticRuleEntryData,
): SemanticRuleSignature {
  return {
    rule_id: entry.rule_id,
    rule_version: entry.rule_version,
    schema_ref: entry.schema_ref,
    rule_kind: entry.rule_kind,
    failure_error_code: entry.failure_error_code,
  };
}

function rowKey(row: AllowRowSignature): string {
  return canonicalJson(row);
}

function readJson(path: string): PlainJson {
  return JSON.parse(readFileSync(path, "utf8")) as PlainJson;
}

/** Build the complete compatibility-sensitive signature from canonical truth. */
export function buildCompatibilitySignature(
  repoRoot = REPOSITORY_ROOT,
): CompatibilitySignature {
  const schemasRoot = join(repoRoot, "packages/contracts/schemas");
  const catalogRoot = join(repoRoot, "packages/contracts/catalog");
  const catalog = loadSchemaCatalog({ schemasRoot });
  const validator = createContractValidator(catalog);
  const ir = buildIrCatalog(catalog);
  const errorCatalog = loadErrorCatalog({
    catalogRoot,
    catalog,
    validator,
  });
  const semanticRules = loadSemanticRules({
    catalogRoot,
    catalog,
    validator,
    errorCatalog,
  });
  const security = loadSecurityPolicy({
    catalogRoot,
    catalog,
    validator,
    errorCatalog,
  });
  const corpus = loadCorpus(
    join(repoRoot, "packages/contracts/test/contract/corpus"),
  );
  const requests = {
    python: new Map(
      adapterBatchFor(corpus, "python").requests.map((request) => [
        request.case_id,
        request,
      ]),
    ),
    rust: new Map(
      adapterBatchFor(corpus, "rust").requests.map((request) => [
        request.case_id,
        request,
      ]),
    ),
    typescript: new Map(
      adapterBatchFor(corpus, "typescript").requests.map((request) => [
        request.case_id,
        request,
      ]),
    ),
  };
  const supportedCases: SupportedCaseSignature[] = [];
  for (const corpusCase of corpus.cases) {
    if (!corpusCase.expected.valid) {
      continue;
    }
    const language = corpusCase.languages[0];
    if (language === undefined) {
      throw new Error("validated corpus case has no language");
    }
    const request = requests[language].get(corpusCase.id);
    if (request === undefined) {
      throw new Error("validated corpus case has no adapter request");
    }
    supportedCases.push({
      id: corpusCase.id,
      schema_ref: corpusCase.schema_ref,
      operation: corpusCase.operation,
      languages: [...corpusCase.languages],
      semantic_sha256: digest({
        request: request as unknown as PlainJson,
        expected: corpusCase.expected as unknown as PlainJson,
      }),
    });
  }
  return {
    documents: ir.documents.map((document) => ({
      path: document.relativePath,
      id: document.id,
      major: document.major,
      version: renderVersion(document.version),
      definitions: Object.fromEntries(
        document.definitions.map((definition) => [
          definition.name,
          nodeSignature(definition.type),
        ]),
      ),
      root: document.root === null ? null : nodeSignature(document.root),
    })),
    error_bindings: errorCatalog.entries.map((entry) => errorSignature(entry)),
    principal_ids: security.principals.map((entry) => entry.id),
    profile_ids: security.profiles.map((entry) => entry.id),
    capability_ids: security.capabilities.map((entry) => entry.id),
    commands: security.commands.map((entry) => commandSignature(entry)),
    allow_rows: security.allow.map((entry) => allowRowSignature(entry)),
    semantic_rule_catalog: {
      repository_path: semanticRules.repositoryPath,
      catalog_version: semanticRules.version,
      canonical_sha256: digest(JSON.parse(semanticRules.rawText) as PlainJson),
    },
    semantic_rules: semanticRules.entries.map((entry) =>
      semanticRuleSignature(entry),
    ),
    supported_valid_cases: supportedCases,
  };
}

function asMap<T>(
  values: readonly T[],
  key: (value: T) => string,
): ReadonlyMap<string, T> {
  return new Map(values.map((value) => [key(value), value]));
}

function finding(
  findings: CompatibilityFinding[],
  code: string,
  subject: string,
): void {
  findings.push({ code, subject });
}

function sameNode(left: NodeSignature, right: NodeSignature): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function compareConstraint(
  baseline: number | null,
  current: number | null,
  tightening: "higher" | "lower",
): boolean {
  if (baseline === current) {
    return false;
  }
  if (current === null) {
    return false;
  }
  if (baseline === null) {
    return true;
  }
  return tightening === "higher" ? current > baseline : current < baseline;
}

function compareNode(
  baseline: NodeSignature,
  current: NodeSignature,
  subject: string,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): boolean {
  let structuralAddition = false;
  if (baseline.kind !== current.kind) {
    const code =
      baseline.kind === "nullable" || current.kind === "nullable"
        ? "NULLABILITY_CHANGED"
        : "TYPE_CHANGED";
    finding(findings, code, subject);
    return false;
  }
  if (
    baseline.deprecated &&
    (!current.deprecated ||
      baseline.deprecated_since !== current.deprecated_since)
  ) {
    finding(findings, "CONSTRAINT_CHANGED", subject);
  } else if (!baseline.deprecated && current.deprecated) {
    finding(additive, "DEPRECATION_ADDED", subject);
  }
  if (
    baseline.sensitivity !== current.sensitivity ||
    baseline.redaction !== current.redaction
  ) {
    finding(findings, "CONSTRAINT_CHANGED", subject);
  }
  if (baseline.kind === "ref") {
    if (
      baseline.ref_id !== current.ref_id ||
      baseline.ref_definition !== current.ref_definition
    ) {
      finding(findings, "REFERENCE_TARGET_CHANGED", subject);
    }
  } else if (baseline.kind === "nullable") {
    if (baseline.inner !== null && current.inner !== null) {
      structuralAddition =
        compareNode(
          baseline.inner,
          current.inner,
          `${subject}/nullable`,
          findings,
          additive,
        ) || structuralAddition;
    }
  } else if (baseline.kind === "enum") {
    for (const token of baseline.tokens) {
      if (!current.tokens.includes(token)) {
        finding(findings, "ENUM_TOKEN_REMOVED", `${subject}/${token}`);
      }
    }
    for (const token of current.tokens) {
      if (!baseline.tokens.includes(token)) {
        structuralAddition = true;
        finding(additive, "ENUM_TOKEN_ADDED", `${subject}/${token}`);
      }
    }
  } else if (baseline.kind === "object") {
    if (
      baseline.extension_point !== current.extension_point ||
      baseline.max_properties !== current.max_properties ||
      canonicalJson(baseline.property_names) !==
        canonicalJson(current.property_names)
    ) {
      finding(findings, "OBJECT_OPENNESS_CHANGED", subject);
    }
    const removed = Object.keys(baseline.properties).filter(
      (name) => !(name in current.properties),
    );
    const added = Object.keys(current.properties).filter(
      (name) => !(name in baseline.properties),
    );
    for (const name of removed) {
      finding(findings, "PROPERTY_REMOVED", `${subject}/${name}`);
    }
    for (const oldName of removed) {
      const oldProperty = baseline.properties[oldName];
      if (oldProperty === undefined) {
        continue;
      }
      for (const newName of added) {
        const newProperty = current.properties[newName];
        if (
          newProperty?.required === oldProperty.required &&
          sameNode(oldProperty.node, newProperty.node)
        ) {
          finding(
            findings,
            "POSSIBLE_PROPERTY_RENAME",
            `${subject}/${oldName}->${newName}`,
          );
        }
      }
    }
    for (const name of added) {
      const property = current.properties[name];
      if (property?.required === true) {
        finding(findings, "PROPERTY_BECAME_REQUIRED", `${subject}/${name}`);
      } else {
        structuralAddition = true;
        finding(additive, "OPTIONAL_PROPERTY_ADDED", `${subject}/${name}`);
      }
    }
    for (const [name, property] of Object.entries(baseline.properties)) {
      const currentProperty = current.properties[name];
      if (currentProperty === undefined) {
        continue;
      }
      if (!property.required && currentProperty.required) {
        finding(findings, "PROPERTY_BECAME_REQUIRED", `${subject}/${name}`);
      }
      structuralAddition =
        compareNode(
          property.node,
          currentProperty.node,
          `${subject}/${name}`,
          findings,
          additive,
        ) || structuralAddition;
    }
  } else if (baseline.kind === "array") {
    if (baseline.items !== null && current.items !== null) {
      structuralAddition =
        compareNode(
          baseline.items,
          current.items,
          `${subject}/items`,
          findings,
          additive,
        ) || structuralAddition;
    }
  }
  if (baseline.pattern !== current.pattern) {
    finding(findings, "PATTERN_TIGHTENED", subject);
  }
  const tightened =
    compareConstraint(baseline.minimum, current.minimum, "higher") ||
    compareConstraint(baseline.maximum, current.maximum, "lower") ||
    compareConstraint(baseline.min_length, current.min_length, "higher") ||
    compareConstraint(baseline.max_length, current.max_length, "lower") ||
    compareConstraint(baseline.min_items, current.min_items, "higher") ||
    compareConstraint(baseline.max_items, current.max_items, "lower");
  if (tightened) {
    finding(findings, "CONSTRAINT_TIGHTENED", subject);
  } else if (
    baseline.minimum !== current.minimum ||
    baseline.maximum !== current.maximum ||
    baseline.min_length !== current.min_length ||
    baseline.max_length !== current.max_length ||
    baseline.min_items !== current.min_items ||
    baseline.max_items !== current.max_items ||
    baseline.format !== current.format
  ) {
    finding(findings, "CONSTRAINT_CHANGED", subject);
  }
  return structuralAddition;
}

function versionParts(value: string): [number, number, number] {
  const parts = value.split(".").map((part) => Number(part));
  return [parts[0] ?? -1, parts[1] ?? -1, parts[2] ?? -1];
}

function compareDocuments(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  const currentByPath = asMap(current.documents, (document) => document.path);
  const baselinePaths = new Set(
    baseline.documents.map((document) => document.path),
  );
  for (const document of baseline.documents) {
    const candidate = currentByPath.get(document.path);
    if (candidate === undefined) {
      finding(findings, "SCHEMA_REMOVED", document.id);
      continue;
    }
    if (candidate.id !== document.id) {
      finding(findings, "SCHEMA_ID_CHANGED", document.path);
      if (candidate.major !== document.major) {
        finding(findings, "MAJOR_REPLACEMENT_WITHOUT_MIGRATION", document.path);
      }
      continue;
    }
    const baselineVersion = versionParts(document.version);
    const currentVersion = versionParts(candidate.version);
    if (
      currentVersion[0] < baselineVersion[0] ||
      (currentVersion[0] === baselineVersion[0] &&
        currentVersion[1] < baselineVersion[1]) ||
      (currentVersion[0] === baselineVersion[0] &&
        currentVersion[1] === baselineVersion[1] &&
        currentVersion[2] < baselineVersion[2])
    ) {
      finding(findings, "VERSION_REGRESSED", document.id);
    }
    let structuralAddition = false;
    for (const [name, definition] of Object.entries(document.definitions)) {
      const currentDefinition = candidate.definitions[name];
      if (currentDefinition === undefined) {
        finding(
          findings,
          "DEFINITION_REMOVED",
          `${document.id}#/$defs/${name}`,
        );
      } else {
        structuralAddition =
          compareNode(
            definition,
            currentDefinition,
            `${document.id}#/$defs/${name}`,
            findings,
            additive,
          ) || structuralAddition;
      }
    }
    for (const name of Object.keys(candidate.definitions)) {
      if (!(name in document.definitions)) {
        structuralAddition = true;
        finding(additive, "DEFINITION_ADDED", `${document.id}#/$defs/${name}`);
      }
    }
    if (document.root === null && candidate.root !== null) {
      // A definitions-only document's bare $id currently accepts any value.
      // Adding a root makes that same stable reference constrained, so this
      // is incompatible even when the definitions themselves are additive.
      finding(findings, "ROOT_SCHEMA_ADDED", document.id);
    } else if (document.root !== null && candidate.root === null) {
      finding(findings, "ROOT_SHAPE_CHANGED", document.id);
    } else if (document.root !== null && candidate.root !== null) {
      structuralAddition =
        compareNode(
          document.root,
          candidate.root,
          document.id,
          findings,
          additive,
        ) || structuralAddition;
    }
    if (
      structuralAddition &&
      (currentVersion[0] !== baselineVersion[0] ||
        currentVersion[1] <= baselineVersion[1])
    ) {
      finding(findings, "MINOR_BUMP_REQUIRED", document.id);
    }
  }
  for (const document of current.documents) {
    if (!baselinePaths.has(document.path)) {
      finding(additive, "SCHEMA_ADDED", document.id);
    }
  }
}

function compareErrors(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  const currentMap = asMap(current.error_bindings, (entry) => entry.code);
  const baselineCodes = new Set(
    baseline.error_bindings.map((entry) => entry.code),
  );
  for (const entry of baseline.error_bindings) {
    const candidate = currentMap.get(entry.code);
    if (candidate === undefined) {
      finding(findings, "ENUM_TOKEN_REMOVED", `error/${entry.code}`);
    } else if (canonicalJson(entry) !== canonicalJson(candidate)) {
      finding(findings, "ENUM_SEMANTIC_REASSIGNED", `error/${entry.code}`);
    }
  }
  for (const entry of current.error_bindings) {
    if (!baselineCodes.has(entry.code)) {
      finding(additive, "ERROR_CODE_ADDED", entry.code);
    }
  }
}

function compareCommands(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  const currentMap = asMap(current.commands, (command) => command.id);
  const baselineIds = new Set(baseline.commands.map((command) => command.id));
  for (const command of baseline.commands) {
    const candidate = currentMap.get(command.id);
    if (candidate === undefined) {
      finding(findings, "COMMAND_REMOVED", command.id);
      continue;
    }
    if (command.required_capability !== candidate.required_capability) {
      finding(findings, "COMMAND_CAPABILITY_CHANGED", command.id);
    }
    if (command.intended_target !== candidate.intended_target) {
      finding(findings, "COMMAND_TARGET_CHANGED", command.id);
    }
    if (command.denial_error_code !== candidate.denial_error_code) {
      finding(findings, "COMMAND_DENIAL_CODE_CHANGED", command.id);
    }
    if (
      candidate.max_encoded_payload_size_bytes <
      command.max_encoded_payload_size_bytes
    ) {
      finding(findings, "PAYLOAD_LIMIT_REDUCED", command.id);
    }
    for (const profile of command.supported_profiles) {
      if (!candidate.supported_profiles.includes(profile)) {
        finding(
          findings,
          "COMMAND_PROFILE_REMOVED",
          `${command.id}/${profile}`,
        );
      }
    }
    if (
      command.consequence_class !== candidate.consequence_class ||
      command.idempotency_expectation !== candidate.idempotency_expectation
    ) {
      finding(findings, "ENUM_SEMANTIC_REASSIGNED", `command/${command.id}`);
    }
  }
  for (const command of current.commands) {
    if (!baselineIds.has(command.id)) {
      finding(additive, "COMMAND_ADDED", command.id);
    }
  }
}

function compareAuthority(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
): void {
  const baselineRows = new Set(baseline.allow_rows.map((row) => rowKey(row)));
  const currentRows = new Set(current.allow_rows.map((row) => rowKey(row)));
  const commands = asMap(current.commands, (command) => command.id);
  for (const row of baseline.allow_rows) {
    if (!currentRows.has(rowKey(row))) {
      finding(
        findings,
        "ALLOW_ROW_REMOVED",
        `${row.authorization_profile}/${row.command_id}`,
      );
    }
  }
  for (const row of current.allow_rows) {
    if (baselineRows.has(rowKey(row))) {
      continue;
    }
    const command = commands.get(row.command_id);
    if (
      row.command_id === "SUBMISSION_FINAL_SUBMIT" ||
      command?.required_capability === "SUBMISSION_FINAL"
    ) {
      finding(
        findings,
        "FINAL_SUBMIT_AUTHORITY_ADDED",
        row.authorization_profile,
      );
    } else if (command?.required_capability.startsWith("PLATFORM_")) {
      finding(
        findings,
        "PLATFORM_AUTHORITY_ADDED",
        `${row.authorization_profile}/${row.command_id}`,
      );
    } else {
      finding(
        findings,
        "PROFILE_AUTHORITY_BROADENED",
        `${row.authorization_profile}/${row.command_id}`,
      );
    }
  }
}

function compareVocabulary(
  label: string,
  baseline: readonly string[],
  current: readonly string[],
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  for (const value of baseline) {
    if (!current.includes(value)) {
      finding(findings, "ENUM_TOKEN_REMOVED", `${label}/${value}`);
    }
  }
  for (const value of current) {
    if (!baseline.includes(value)) {
      finding(additive, "ENUM_TOKEN_ADDED", `${label}/${value}`);
    }
  }
}

function semanticCatalogOf(
  signature: CompatibilitySignature,
): SemanticRuleCatalogSignature | null {
  const legacyCompatible: Partial<CompatibilitySignature> = signature;
  return legacyCompatible.semantic_rule_catalog ?? null;
}

function semanticRulesOf(
  signature: CompatibilitySignature,
): readonly SemanticRuleSignature[] {
  const legacyCompatible: Partial<CompatibilitySignature> = signature;
  return legacyCompatible.semantic_rules ?? [];
}

/**
 * Compare the finite semantic-rule bindings introduced in M01-W06.
 *
 * A legacy M01-W05 baseline has no semantic section. Its first reviewed
 * semantic catalog is therefore an additive baseline extension. Once the
 * section exists, removing or changing a rule changes accepted v1 meaning
 * and is breaking. A rule accompanying an entirely new schema remains an
 * additive contract introduction.
 */
function compareSemanticRules(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  const baselineCatalog = semanticCatalogOf(baseline);
  const currentCatalog = semanticCatalogOf(current);
  const baselineRules = semanticRulesOf(baseline);
  const currentRules = semanticRulesOf(current);

  if (baselineCatalog === null) {
    if (currentCatalog !== null) {
      finding(
        additive,
        "SEMANTIC_RULE_CATALOG_ADDED",
        currentCatalog.repository_path,
      );
      for (const rule of currentRules) {
        finding(additive, "SEMANTIC_RULE_ADDED", rule.rule_id);
      }
    }
    return;
  }
  if (currentCatalog === null) {
    finding(
      findings,
      "SEMANTIC_RULE_CATALOG_REMOVED",
      baselineCatalog.repository_path,
    );
    for (const rule of baselineRules) {
      finding(findings, "SEMANTIC_RULE_REMOVED", rule.rule_id);
    }
    return;
  }

  if (baselineCatalog.repository_path !== currentCatalog.repository_path) {
    finding(
      findings,
      "SEMANTIC_RULE_CATALOG_PATH_CHANGED",
      baselineCatalog.repository_path,
    );
  }
  if (baselineCatalog.catalog_version !== currentCatalog.catalog_version) {
    finding(
      findings,
      "SEMANTIC_RULE_CATALOG_VERSION_CHANGED",
      baselineCatalog.repository_path,
    );
  }

  const currentById = asMap(currentRules, (rule) => rule.rule_id);
  const baselineIds = new Set(baselineRules.map((rule) => rule.rule_id));
  for (const rule of baselineRules) {
    const candidate = currentById.get(rule.rule_id);
    if (candidate === undefined) {
      finding(findings, "SEMANTIC_RULE_REMOVED", rule.rule_id);
      continue;
    }
    if (rule.schema_ref !== candidate.schema_ref) {
      finding(findings, "SEMANTIC_RULE_SCHEMA_REBOUND", rule.rule_id);
    }
    if (rule.rule_kind !== candidate.rule_kind) {
      finding(findings, "SEMANTIC_RULE_KIND_CHANGED", rule.rule_id);
    }
    if (rule.failure_error_code !== candidate.failure_error_code) {
      finding(findings, "SEMANTIC_RULE_ERROR_CODE_CHANGED", rule.rule_id);
    }
    if (rule.rule_version !== candidate.rule_version) {
      finding(findings, "SEMANTIC_RULE_VERSION_CHANGED", rule.rule_id);
    }
  }

  const baselineSchemaIds = new Set(
    baseline.documents.map((document) => document.id),
  );
  for (const rule of currentRules) {
    if (!baselineIds.has(rule.rule_id)) {
      finding(
        baselineSchemaIds.has(rule.schema_ref) ? findings : additive,
        "SEMANTIC_RULE_ADDED",
        rule.rule_id,
      );
    }
  }

  const bindingsUnchanged =
    canonicalJson(baselineRules) === canonicalJson(currentRules);
  if (
    bindingsUnchanged &&
    baselineCatalog.repository_path === currentCatalog.repository_path &&
    baselineCatalog.catalog_version === currentCatalog.catalog_version &&
    baselineCatalog.canonical_sha256 !== currentCatalog.canonical_sha256
  ) {
    finding(
      findings,
      "SEMANTIC_RULE_CATALOG_HASH_CHANGED",
      baselineCatalog.repository_path,
    );
  }
}

function compareCases(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
  findings: CompatibilityFinding[],
  additive: CompatibilityFinding[],
): void {
  const currentMap = asMap(
    current.supported_valid_cases,
    (corpusCase) => corpusCase.id,
  );
  const baselineIds = new Set(
    baseline.supported_valid_cases.map((corpusCase) => corpusCase.id),
  );
  for (const corpusCase of baseline.supported_valid_cases) {
    const candidate = currentMap.get(corpusCase.id);
    if (candidate === undefined) {
      finding(findings, "SUPPORTED_WIRE_CASE_REMOVED", corpusCase.id);
    } else if (canonicalJson(corpusCase) !== canonicalJson(candidate)) {
      finding(findings, "SUPPORTED_WIRE_CASE_CHANGED", corpusCase.id);
    }
  }
  for (const corpusCase of current.supported_valid_cases) {
    if (!baselineIds.has(corpusCase.id)) {
      finding(additive, "SUPPORTED_WIRE_CASE_ADDED", corpusCase.id);
    }
  }
}

/** Compare historical accepted evidence to a current derived signature. */
export function compareCompatibilitySignatures(
  baseline: CompatibilitySignature,
  current: CompatibilitySignature,
): CompatibilityReport {
  const findings: CompatibilityFinding[] = [];
  const additive: CompatibilityFinding[] = [];
  compareDocuments(baseline, current, findings, additive);
  compareErrors(baseline, current, findings, additive);
  compareCommands(baseline, current, findings, additive);
  compareAuthority(baseline, current, findings);
  compareVocabulary(
    "principal",
    baseline.principal_ids,
    current.principal_ids,
    findings,
    additive,
  );
  compareVocabulary(
    "profile",
    baseline.profile_ids,
    current.profile_ids,
    findings,
    additive,
  );
  compareVocabulary(
    "capability",
    baseline.capability_ids,
    current.capability_ids,
    findings,
    additive,
  );
  compareSemanticRules(baseline, current, findings, additive);
  compareCases(baseline, current, findings, additive);
  const sorter = (
    left: CompatibilityFinding,
    right: CompatibilityFinding,
  ): number =>
    left.code < right.code
      ? -1
      : left.code > right.code
        ? 1
        : left.subject < right.subject
          ? -1
          : left.subject > right.subject
            ? 1
            : 0;
  findings.sort(sorter);
  additive.sort(sorter);
  return {
    compatible: findings.length === 0,
    findings,
    additive_changes: additive,
  };
}

export function currentCanonicalInputHashes(): Readonly<
  Record<string, string>
> {
  return {
    authorization_policy: digest(
      readJson(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/authorization-policy.v1.json",
        ),
      ),
    ),
    capability_catalog: digest(
      readJson(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/capability-catalog.v1.json",
        ),
      ),
    ),
    command_catalog: digest(
      readJson(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/command-catalog.v1.json",
        ),
      ),
    ),
    error_catalog: digest(
      readJson(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/error-catalog.v1.json",
        ),
      ),
    ),
    semantic_rule_catalog: digest(
      readJson(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/semantic-rules.v1.json",
        ),
      ),
    ),
  };
}
