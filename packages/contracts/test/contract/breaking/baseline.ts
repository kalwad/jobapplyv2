import { createHash } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalJson, type PlainJson } from "../adapters/normalization.ts";
import {
  HISTORICAL_WITNESS_INVENTORY_SHA256,
  HISTORICAL_WITNESS_REPOSITORY_PATH,
  loadHistoricalWitnessInventory,
} from "../semantic-witnesses/historical-witness-loader.ts";
import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
  type CompatibilitySignature,
} from "./compatibility-signature.ts";

export const LEGACY_BASELINE_PATH = fileURLToPath(
  new URL("../baseline/structural-signature.v1.json", import.meta.url),
);

export const BASELINE_PATH = fileURLToPath(
  new URL("../baseline/compatibility-signature.v2.json", import.meta.url),
);

export const CURRENT_BASELINE_FORMAT_VERSION = "2.1.0";
const SUPPORTED_BASELINE_FORMAT_VERSIONS = new Set([
  "1.0.0",
  "1.1.0",
  "2.0.0",
  "2.1.0",
]);
const SEMANTIC_CATALOG_PATH =
  "packages/contracts/catalog/semantic-rules.v1.json";

export interface CompatibilityBaseline {
  baseline_format_version: "1.0.0" | "1.1.0" | "2.0.0" | "2.1.0";
  baseline_id: "m01-w05-representative-v1" | "m01-w07-executable-v2";
  source_scope: {
    schemas: "packages/contracts/schemas";
    catalogs: string[];
    corpus_manifest: "packages/contracts/test/contract/corpus/manifest.v1.json";
    historical_witness_inventory?: typeof HISTORICAL_WITNESS_REPOSITORY_PATH;
  };
  signature: CompatibilitySignature;
  integrity_sha256: string;
}

export class BaselineError extends Error {
  readonly code:
    "BASELINE_DIGEST_MISMATCH" | "BASELINE_INVALID" | "BASELINE_UPDATE_REFUSED";

  constructor(
    code:
      | "BASELINE_DIGEST_MISMATCH"
      | "BASELINE_INVALID"
      | "BASELINE_UPDATE_REFUSED",
  ) {
    super(code);
    this.name = "BaselineError";
    this.code = code;
  }
}

function sha256(value: PlainJson): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function payload(
  baseline: CompatibilityBaseline,
): Omit<CompatibilityBaseline, "integrity_sha256"> {
  return {
    baseline_format_version: baseline.baseline_format_version,
    baseline_id: baseline.baseline_id,
    source_scope: baseline.source_scope,
    signature: baseline.signature,
  };
}

export function buildBaseline(
  signature = buildCompatibilitySignature(),
): CompatibilityBaseline {
  const withoutDigest: Omit<CompatibilityBaseline, "integrity_sha256"> = {
    baseline_format_version: CURRENT_BASELINE_FORMAT_VERSION,
    baseline_id: "m01-w07-executable-v2",
    source_scope: {
      schemas: "packages/contracts/schemas",
      catalogs: [
        "packages/contracts/catalog/authorization-policy.v1.json",
        "packages/contracts/catalog/capability-catalog.v1.json",
        "packages/contracts/catalog/command-catalog.v1.json",
        "packages/contracts/catalog/error-catalog.v1.json",
        SEMANTIC_CATALOG_PATH,
      ],
      corpus_manifest:
        "packages/contracts/test/contract/corpus/manifest.v1.json",
      historical_witness_inventory: HISTORICAL_WITNESS_REPOSITORY_PATH,
    },
    signature,
  };
  return {
    ...withoutDigest,
    integrity_sha256: sha256(withoutDigest as unknown as PlainJson),
  };
}

/** Exact deterministic bytes owned by the explicit baseline update tool. */
export function serializeBaseline(baseline: CompatibilityBaseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

export function updateBaseline(
  signature = buildCompatibilitySignature(),
  path = BASELINE_PATH,
): void {
  const previous = loadBaseline(path);
  const candidate = buildBaseline(signature);
  const report = compareCompatibilitySignatures(
    previous.signature,
    candidate.signature,
  );
  if (!report.compatible) {
    throw new BaselineError("BASELINE_UPDATE_REFUSED");
  }
  const temporaryPath = `${path}.tmp`;
  let replaced = false;
  try {
    writeFileSync(temporaryPath, serializeBaseline(candidate), "utf8");
    loadBaseline(temporaryPath);
    renameSync(temporaryPath, path);
    replaced = true;
  } finally {
    if (!replaced) {
      rmSync(temporaryPath, { force: true });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
  );
}

function validSourceScope(value: unknown, formatVersion: string): boolean {
  const expectedKeys =
    formatVersion === "2.1.0"
      ? [
          "catalogs",
          "corpus_manifest",
          "historical_witness_inventory",
          "schemas",
        ]
      : ["catalogs", "corpus_manifest", "schemas"];
  if (
    !isRecord(value) ||
    !hasExactKeys(value, expectedKeys) ||
    value.schemas !== "packages/contracts/schemas" ||
    value.corpus_manifest !==
      "packages/contracts/test/contract/corpus/manifest.v1.json" ||
    !Array.isArray(value.catalogs) ||
    value.catalogs.some((path) => typeof path !== "string") ||
    (formatVersion === "2.1.0" &&
      value.historical_witness_inventory !== HISTORICAL_WITNESS_REPOSITORY_PATH)
  ) {
    return false;
  }
  return (
    formatVersion === "1.0.0" || value.catalogs.includes(SEMANTIC_CATALOG_PATH)
  );
}

function hasHistoricalWitnessInventory(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isRecord(value.historical_witness_inventory) ||
    !Array.isArray(value.semantic_witnesses)
  ) {
    return false;
  }
  const inventory = value.historical_witness_inventory;
  let sourceInventory;
  try {
    sourceInventory = loadHistoricalWitnessInventory();
  } catch {
    return false;
  }
  if (
    !hasExactKeys(inventory, [
      "canonical_sha256",
      "format_version",
      "raw_reference_count",
      "repository_path",
      "witness_count",
    ]) ||
    inventory.repository_path !== HISTORICAL_WITNESS_REPOSITORY_PATH ||
    inventory.format_version !== "1.0.0" ||
    inventory.witness_count !== 229 ||
    inventory.raw_reference_count !== 556 ||
    inventory.canonical_sha256 !== HISTORICAL_WITNESS_INVENTORY_SHA256 ||
    inventory.canonical_sha256 !== sourceInventory.inventory_sha256
  ) {
    return false;
  }
  const historicalWitnesses = value.semantic_witnesses.filter(
    (candidate) =>
      isRecord(candidate) &&
      typeof candidate.id === "string" &&
      candidate.id.startsWith("x-w07.historical-positive."),
  );
  const sourceById = new Map(
    sourceInventory.witnesses.map((witness) => [witness.id, witness]),
  );
  return (
    historicalWitnesses.length === inventory.witness_count &&
    historicalWitnesses.every(
      (candidate) =>
        isRecord(candidate) &&
        sourceById.has(candidate.id as string) &&
        typeof candidate.schema_ref === "string" &&
        /^urn:japp:schema:platform:[a-z0-9-]+:v1$/.test(candidate.schema_ref) &&
        candidate.schema_major === 1 &&
        candidate.operation === "VALIDATE" &&
        JSON.stringify(candidate.languages) ===
          JSON.stringify(["python", "rust", "typescript"]) &&
        candidate.expected_valid === true &&
        candidate.expected_error_code === null &&
        candidate.schema_ref ===
          sourceById.get(candidate.id as string)?.schema_ref &&
        candidate.operation ===
          sourceById.get(candidate.id as string)?.operation &&
        JSON.stringify(candidate.languages) ===
          JSON.stringify(sourceById.get(candidate.id as string)?.languages) &&
        candidate.input_sha256 ===
          sha256(
            sourceById.get(candidate.id as string)
              ?.input as unknown as PlainJson,
          ),
    )
  );
}

function hasCurrentSemanticSignature(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const catalog = value.semantic_rule_catalog;
  const rules = value.semantic_rules;
  if (
    !isRecord(catalog) ||
    !hasExactKeys(catalog, [
      "canonical_sha256",
      "catalog_version",
      "repository_path",
    ]) ||
    catalog.repository_path !== SEMANTIC_CATALOG_PATH ||
    typeof catalog.catalog_version !== "string" ||
    typeof catalog.canonical_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(catalog.canonical_sha256) ||
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    return false;
  }
  const ids = new Set<string>();
  let previous = "";
  for (const rule of rules) {
    if (
      !isRecord(rule) ||
      !hasExactKeys(rule, [
        "failure_error_code",
        "rule_id",
        "rule_kind",
        "rule_version",
        "schema_ref",
      ]) ||
      typeof rule.rule_id !== "string" ||
      typeof rule.rule_version !== "string" ||
      typeof rule.schema_ref !== "string" ||
      typeof rule.rule_kind !== "string" ||
      typeof rule.failure_error_code !== "string" ||
      rule.rule_id.length === 0 ||
      ids.has(rule.rule_id) ||
      (previous !== "" && previous >= rule.rule_id)
    ) {
      return false;
    }
    ids.add(rule.rule_id);
    previous = rule.rule_id;
  }
  return true;
}

function hasExecutableSemanticWitnesses(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !Array.isArray(value.documents) ||
    !Array.isArray(value.semantic_rules) ||
    !Array.isArray(value.semantic_witnesses)
  ) {
    return false;
  }
  const documentMajorById = new Map<string, number>();
  for (const document of value.documents) {
    if (
      !isRecord(document) ||
      typeof document.id !== "string" ||
      !Number.isSafeInteger(document.major)
    ) {
      return false;
    }
    documentMajorById.set(document.id, document.major as number);
  }
  const ruleById = new Map<
    string,
    {
      readonly schema_ref: string;
      readonly rule_major: number;
      readonly error_code: string;
    }
  >();
  for (const rule of value.semantic_rules) {
    if (
      !isRecord(rule) ||
      typeof rule.rule_id !== "string" ||
      typeof rule.schema_ref !== "string" ||
      typeof rule.rule_version !== "string" ||
      typeof rule.failure_error_code !== "string"
    ) {
      return false;
    }
    const majorText = /^([0-9]+)\.[0-9]+\.[0-9]+$/.exec(rule.rule_version)?.[1];
    if (majorText === undefined) {
      return false;
    }
    ruleById.set(rule.rule_id, {
      schema_ref: rule.schema_ref,
      rule_major: Number(majorText),
      error_code: rule.failure_error_code,
    });
  }
  const allowedLanguages = new Set(["python", "rust", "typescript"]);
  const ids = new Set<string>();
  let previous = "";
  for (const witness of value.semantic_witnesses) {
    if (
      !isRecord(witness) ||
      !hasExactKeys(witness, [
        "expected_error_code",
        "expected_valid",
        "id",
        "input_sha256",
        "languages",
        "operation",
        "rule_outcomes",
        "schema_major",
        "schema_ref",
        "semantic_valid",
        "structural_valid",
      ]) ||
      typeof witness.id !== "string" ||
      witness.id.length === 0 ||
      ids.has(witness.id) ||
      (previous !== "" && previous >= witness.id) ||
      typeof witness.schema_ref !== "string" ||
      witness.schema_ref.length === 0 ||
      !Number.isSafeInteger(witness.schema_major) ||
      (witness.schema_major as number) < 1 ||
      (witness.operation !== "VALIDATE" &&
        witness.operation !== "ROUND_TRIP") ||
      !Array.isArray(witness.languages) ||
      witness.languages.length === 0 ||
      witness.languages.some(
        (language) =>
          typeof language !== "string" || !allowedLanguages.has(language),
      ) ||
      JSON.stringify(witness.languages) !==
        JSON.stringify([...new Set(witness.languages as string[])].sort()) ||
      typeof witness.input_sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(witness.input_sha256) ||
      typeof witness.expected_valid !== "boolean" ||
      (witness.expected_error_code !== null &&
        typeof witness.expected_error_code !== "string") ||
      witness.structural_valid !== true ||
      typeof witness.semantic_valid !== "boolean" ||
      !Array.isArray(witness.rule_outcomes) ||
      witness.rule_outcomes.length === 0
    ) {
      return false;
    }
    if (documentMajorById.get(witness.schema_ref) !== witness.schema_major) {
      return false;
    }
    let previousRule = "";
    const ruleIds = new Set<string>();
    for (const outcome of witness.rule_outcomes) {
      if (
        !isRecord(outcome) ||
        !hasExactKeys(outcome, [
          "error_code",
          "passed",
          "rule_id",
          "rule_major",
        ]) ||
        typeof outcome.rule_id !== "string" ||
        outcome.rule_id.length === 0 ||
        ruleIds.has(outcome.rule_id) ||
        (previousRule !== "" && previousRule >= outcome.rule_id) ||
        !Number.isSafeInteger(outcome.rule_major) ||
        (outcome.rule_major as number) < 1 ||
        typeof outcome.error_code !== "string" ||
        outcome.error_code.length === 0 ||
        typeof outcome.passed !== "boolean"
      ) {
        return false;
      }
      const boundRule = ruleById.get(outcome.rule_id);
      if (
        boundRule?.schema_ref !== witness.schema_ref ||
        boundRule.rule_major !== outcome.rule_major ||
        boundRule.error_code !== outcome.error_code
      ) {
        return false;
      }
      ruleIds.add(outcome.rule_id);
      previousRule = outcome.rule_id;
    }
    const expectedRuleIds = [...ruleById.entries()]
      .filter(([, rule]) => rule.schema_ref === witness.schema_ref)
      .map(([ruleId]) => ruleId)
      .sort();
    if (JSON.stringify([...ruleIds]) !== JSON.stringify(expectedRuleIds)) {
      return false;
    }
    const firstFailure = (
      witness.rule_outcomes as Record<string, unknown>[]
    ).find((outcome) => outcome.passed === false);
    const expectationMatches =
      witness.expected_valid === witness.semantic_valid &&
      (witness.expected_valid
        ? witness.expected_error_code === null && firstFailure === undefined
        : typeof witness.expected_error_code === "string" &&
          firstFailure?.error_code === witness.expected_error_code);
    if (!expectationMatches) {
      return false;
    }
    ids.add(witness.id);
    previous = witness.id;
  }
  return ids.size > 0;
}

export function loadBaseline(path = BASELINE_PATH): CompatibilityBaseline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new BaselineError("BASELINE_INVALID");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BaselineError("BASELINE_INVALID");
  }
  const candidate = parsed as Record<string, unknown>;
  const formatVersion = candidate.baseline_format_version;
  const expectedBaselineId =
    formatVersion === "2.0.0" || formatVersion === "2.1.0"
      ? "m01-w07-executable-v2"
      : "m01-w05-representative-v1";
  if (
    typeof formatVersion !== "string" ||
    !SUPPORTED_BASELINE_FORMAT_VERSIONS.has(formatVersion) ||
    candidate.baseline_id !== expectedBaselineId ||
    typeof candidate.integrity_sha256 !== "string" ||
    typeof candidate.signature !== "object" ||
    candidate.signature === null ||
    !hasExactKeys(candidate, [
      "baseline_format_version",
      "baseline_id",
      "integrity_sha256",
      "signature",
      "source_scope",
    ]) ||
    !validSourceScope(candidate.source_scope, formatVersion) ||
    (formatVersion !== "1.0.0" &&
      !hasCurrentSemanticSignature(candidate.signature)) ||
    ((formatVersion === "2.0.0" || formatVersion === "2.1.0") &&
      !hasExecutableSemanticWitnesses(candidate.signature)) ||
    (formatVersion === "2.1.0" &&
      !hasHistoricalWitnessInventory(candidate.signature))
  ) {
    throw new BaselineError("BASELINE_INVALID");
  }
  const baseline = candidate as unknown as CompatibilityBaseline;
  if (
    baseline.integrity_sha256 !==
    sha256(payload(baseline) as unknown as PlainJson)
  ) {
    throw new BaselineError("BASELINE_DIGEST_MISMATCH");
  }
  return baseline;
}
