import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalJson, type PlainJson } from "../adapters/normalization.ts";
import {
  buildCompatibilitySignature,
  type CompatibilitySignature,
} from "./compatibility-signature.ts";

export const BASELINE_PATH = fileURLToPath(
  new URL("../baseline/structural-signature.v1.json", import.meta.url),
);

export const CURRENT_BASELINE_FORMAT_VERSION = "1.1.0";
const SUPPORTED_BASELINE_FORMAT_VERSIONS = new Set(["1.0.0", "1.1.0"]);
const SEMANTIC_CATALOG_PATH =
  "packages/contracts/catalog/semantic-rules.v1.json";

export interface CompatibilityBaseline {
  baseline_format_version: "1.0.0" | "1.1.0";
  baseline_id: "m01-w05-representative-v1";
  source_scope: {
    schemas: "packages/contracts/schemas";
    catalogs: string[];
    corpus_manifest: "packages/contracts/test/contract/corpus/manifest.v1.json";
  };
  signature: CompatibilitySignature;
  integrity_sha256: string;
}

export class BaselineError extends Error {
  readonly code: "BASELINE_DIGEST_MISMATCH" | "BASELINE_INVALID";

  constructor(code: "BASELINE_DIGEST_MISMATCH" | "BASELINE_INVALID") {
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

export function buildBaseline(): CompatibilityBaseline {
  const withoutDigest: Omit<CompatibilityBaseline, "integrity_sha256"> = {
    baseline_format_version: CURRENT_BASELINE_FORMAT_VERSION,
    baseline_id: "m01-w05-representative-v1",
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
    },
    signature: buildCompatibilitySignature(),
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

export function updateBaseline(): void {
  writeFileSync(BASELINE_PATH, serializeBaseline(buildBaseline()), "utf8");
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
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["catalogs", "corpus_manifest", "schemas"]) ||
    value.schemas !== "packages/contracts/schemas" ||
    value.corpus_manifest !==
      "packages/contracts/test/contract/corpus/manifest.v1.json" ||
    !Array.isArray(value.catalogs) ||
    value.catalogs.some((path) => typeof path !== "string")
  ) {
    return false;
  }
  return (
    formatVersion === "1.0.0" || value.catalogs.includes(SEMANTIC_CATALOG_PATH)
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
  if (
    typeof formatVersion !== "string" ||
    !SUPPORTED_BASELINE_FORMAT_VERSIONS.has(formatVersion) ||
    candidate.baseline_id !== "m01-w05-representative-v1" ||
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
    (formatVersion === CURRENT_BASELINE_FORMAT_VERSION &&
      !hasCurrentSemanticSignature(candidate.signature))
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
