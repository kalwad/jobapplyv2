/**
 * Canonical error-catalog pipeline (M01-W03).
 *
 * The committed catalog instance (packages/contracts/catalog/
 * error-catalog.v1.json) is the single source of truth for every error
 * code's metadata. This module loads it, validates it against
 * urn:japp:schema:error:catalog:v1 through the strict canonical validator,
 * enforces catalog integrity fail-closed (exact agreement with the
 * taxonomy errorCode enum, family-prefix consistency, deterministic
 * message keys, user-safe message lint, sorted order, and the family
 * invariant matrix), and emits the generated TypeScript and Python
 * catalog-data surfaces so no per-language handwritten catalog can exist.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SchemaCatalog } from "../src/catalog.ts";
import type { ContractValidator } from "../src/validator.ts";
import { isJsonObject, type JsonObject } from "../src/json.ts";
import type { GeneratedFile } from "./emit-typescript.ts";
import { pythonStringLiteral } from "./emit-python.ts";

export const ERROR_CATALOG_SCHEMA_ID = "urn:japp:schema:error:catalog:v1";
export const ERROR_TAXONOMY_SCHEMA_ID = "urn:japp:schema:error:taxonomy:v1";
export const ERROR_CATALOG_FILE = "error-catalog.v1.json";

/** Default catalog root: packages/contracts/catalog. */
export const DEFAULT_CATALOG_ROOT = fileURLToPath(
  new URL("../catalog", import.meta.url),
);

/** Raised when the committed catalog violates its contract. */
export class ErrorCatalogError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      "the canonical error catalog violates its contract:\n" +
        violations.map((violation) => `  - ${violation}`).join("\n"),
    );
    this.name = "ErrorCatalogError";
    this.violations = violations;
  }
}

/** One validated catalog entry (schema-shaped, statically typed here). */
export interface ErrorCatalogEntryData {
  readonly code: string;
  readonly family: string;
  readonly message_key: string;
  readonly default_message: string;
  readonly remediation?: string;
  readonly severity: string;
  readonly retry_disposition: string;
  readonly user_action_required: boolean;
  readonly transient: boolean;
  readonly diagnostic_policy: string;
  readonly owning_boundary?: string;
  readonly added_in: string;
  readonly deprecated_since?: string;
}

export interface LoadedErrorCatalog {
  readonly version: string;
  readonly entries: readonly ErrorCatalogEntryData[];
  /** Exact committed bytes, for provenance hashing. */
  readonly rawText: string;
  /** Repository-relative path of the catalog instance. */
  readonly repositoryPath: string;
}

/** Deterministic message key derived from a code: see taxonomy schema. */
export function deriveMessageKey(code: string): string {
  const separator = code.indexOf("_");
  const family = separator === -1 ? code : code.slice(0, separator);
  const rest = separator === -1 ? "" : code.slice(separator + 1);
  return `error.${family.toLowerCase()}.${rest.toLowerCase()}`;
}

/**
 * User-safe message lint beyond the schema's charset/bounds: reject URL,
 * path, and stack-trace shapes that the allowed characters could still
 * spell. Fail closed; messages are catalog data, never caller input.
 */
export function lintUserSafeMessage(text: string): string[] {
  const problems: string[] = [];
  if (
    text.includes("://") ||
    /\bwww\./i.test(text) ||
    /\.(com|net|org|io)\b/i.test(text)
  ) {
    problems.push("must not contain URLs or hostnames");
  }
  if (text.startsWith("/") || text.includes(" /") || text.includes("~")) {
    problems.push("must not contain filesystem paths");
  }
  if (/traceback|stack trace|\bexception\b/i.test(text)) {
    problems.push("must not reference stack traces or raw exceptions");
  }
  if (text.includes("  ")) {
    problems.push("must not contain doubled spaces");
  }
  if (text.trim() !== text) {
    problems.push("must not have leading or trailing whitespace");
  }
  return problems;
}

const DISPOSITIONS_WITHOUT_BLIND_RETRY = new Set([
  "RETRY_AFTER_REMEDIATION",
  "PAUSE_FOR_USER",
  "NO_RETRY_PROHIBITED",
  "NO_RETRY_TERMINAL",
]);

function checkFamilyInvariants(
  entry: ErrorCatalogEntryData,
  violations: string[],
): void {
  const label = entry.code;
  if (entry.transient && entry.retry_disposition !== "SAFE_RETRY") {
    violations.push(
      `${label}: transient conditions must use SAFE_RETRY (found ` +
        `${entry.retry_disposition})`,
    );
  }
  if (
    (entry.retry_disposition === "PAUSE_FOR_USER" ||
      entry.retry_disposition === "NO_RETRY_PROHIBITED") &&
    !entry.user_action_required
  ) {
    violations.push(
      `${label}: ${entry.retry_disposition} requires user_action_required`,
    );
  }
  if (entry.family === "SENSITIVE") {
    if (
      !entry.user_action_required ||
      !(
        entry.retry_disposition === "PAUSE_FOR_USER" ||
        entry.retry_disposition === "NO_RETRY_PROHIBITED"
      )
    ) {
      violations.push(
        `${label}: SENSITIVE errors must require user action and pause or ` +
          "prohibit retry (never fall back to guessing)",
      );
    }
  }
  if (entry.family === "SITE" && entry.retry_disposition !== "PAUSE_FOR_USER") {
    violations.push(
      `${label}: SITE errors must pause for the user instead of guessing ` +
        "or repeating consequential actions",
    );
  }
  if (
    (entry.family === "UNSUPPORTED" ||
      entry.family === "SENSITIVE" ||
      entry.family === "GATE" ||
      entry.family === "BENCHMARK" ||
      entry.family === "SUBMISSION") &&
    !DISPOSITIONS_WITHOUT_BLIND_RETRY.has(entry.retry_disposition)
  ) {
    violations.push(
      `${label}: ${entry.family} errors must never be blind-retried ` +
        "(SAFE_RETRY is prohibited for this family)",
    );
  }
  if (
    (entry.family === "GATE" || entry.family === "BENCHMARK") &&
    entry.transient
  ) {
    violations.push(`${label}: ${entry.family} conditions are never transient`);
  }
}

function enumTokens(
  catalog: SchemaCatalog,
  schemaId: string,
  defName: string,
): string[] {
  const entry = catalog.byId.get(schemaId);
  const defs = entry?.document.$defs;
  if (entry === undefined || !isJsonObject(defs)) {
    throw new ErrorCatalogError([
      `taxonomy document ${schemaId} is missing from the schema catalog`,
    ]);
  }
  const definition = defs[defName];
  if (!isJsonObject(definition) || !Array.isArray(definition.enum)) {
    throw new ErrorCatalogError([
      `${schemaId}#/$defs/${defName} does not declare an enum`,
    ]);
  }
  return definition.enum.filter(
    (token): token is string => typeof token === "string",
  );
}

/**
 * Load and fully validate the canonical catalog instance. Throws
 * ErrorCatalogError listing every violation; never partially succeeds.
 */
export function loadErrorCatalog(options: {
  readonly catalogRoot?: string;
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
}): LoadedErrorCatalog {
  const root = options.catalogRoot ?? DEFAULT_CATALOG_ROOT;
  const absolute = join(root, ERROR_CATALOG_FILE);
  let rawText: string;
  try {
    rawText = readFileSync(absolute, "utf8");
  } catch (error) {
    throw new ErrorCatalogError([
      `cannot read the canonical error catalog at ${absolute} ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new ErrorCatalogError([
      `the canonical error catalog is not valid JSON ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  const schemaResult = options.validator.validateInstance(
    ERROR_CATALOG_SCHEMA_ID,
    parsed,
  );
  if (!schemaResult.valid) {
    throw new ErrorCatalogError(
      schemaResult.errors.map(
        (message) => `schema validation failed: ${message}`,
      ),
    );
  }

  const document = parsed as JsonObject;
  const version = document.catalog_version as string;
  const entries = (document.entries as unknown[]).map(
    (item) => item as ErrorCatalogEntryData,
  );

  const violations: string[] = [];
  const declaredCodes = enumTokens(
    options.catalog,
    ERROR_TAXONOMY_SCHEMA_ID,
    "errorCode",
  );
  const declaredFamilies = new Set(
    enumTokens(options.catalog, ERROR_TAXONOMY_SCHEMA_ID, "errorFamily"),
  );

  const seenCodes = new Set<string>();
  const seenMessageKeys = new Set<string>();
  let previousCode: string | null = null;
  for (const entry of entries) {
    if (seenCodes.has(entry.code)) {
      violations.push(`${entry.code}: duplicate catalog entry`);
    }
    seenCodes.add(entry.code);
    if (previousCode !== null && !(previousCode < entry.code)) {
      violations.push(
        `${entry.code}: entries must be sorted by code (follows ` +
          `${previousCode})`,
      );
    }
    previousCode = entry.code;
    const prefix = entry.code.split("_", 1)[0] ?? "";
    if (!declaredFamilies.has(prefix)) {
      violations.push(
        `${entry.code}: code prefix ${prefix} is not a declared family`,
      );
    }
    if (entry.family !== prefix) {
      violations.push(
        `${entry.code}: recorded family ${entry.family} disagrees with the ` +
          `code prefix ${prefix}`,
      );
    }
    const expectedKey = deriveMessageKey(entry.code);
    if (entry.message_key !== expectedKey) {
      violations.push(
        `${entry.code}: message_key must be the derived key ${expectedKey}`,
      );
    }
    if (seenMessageKeys.has(entry.message_key)) {
      violations.push(`${entry.code}: duplicate message_key`);
    }
    seenMessageKeys.add(entry.message_key);
    for (const problem of lintUserSafeMessage(entry.default_message)) {
      violations.push(`${entry.code}: default_message ${problem}`);
    }
    if (entry.remediation !== undefined) {
      for (const problem of lintUserSafeMessage(entry.remediation)) {
        violations.push(`${entry.code}: remediation ${problem}`);
      }
    }
    checkFamilyInvariants(entry, violations);
  }

  const missing = declaredCodes.filter((code) => !seenCodes.has(code));
  const extra = [...seenCodes].filter((code) => !declaredCodes.includes(code));
  if (missing.length > 0) {
    violations.push(
      `catalog is missing entries for declared codes: ${missing.join(", ")}`,
    );
  }
  if (extra.length > 0) {
    violations.push(
      `catalog defines codes absent from the taxonomy enum: ${extra.join(", ")}`,
    );
  }

  if (violations.length > 0) {
    throw new ErrorCatalogError(violations);
  }
  return {
    version,
    entries,
    rawText,
    repositoryPath: "packages/contracts/catalog/error-catalog.v1.json",
  };
}

const ENTRY_KEY_ORDER = [
  "code",
  "family",
  "message_key",
  "default_message",
  "remediation",
  "severity",
  "retry_disposition",
  "user_action_required",
  "transient",
  "diagnostic_policy",
  "owning_boundary",
  "added_in",
  "deprecated_since",
] as const;

function tsHeader(): string {
  return [
    "/**",
    " * GENERATED FILE — DO NOT EDIT BY HAND.",
    " *",
    " * Source of truth: packages/contracts/catalog/error-catalog.v1.json",
    " * Validated against: urn:japp:schema:error:catalog:v1",
    " *",
    " * Regenerate: pnpm generate:contracts",
    " * Verify:     pnpm generate:contracts --check",
    " * Manual edits are prohibited and fail the contract-gen drift suite.",
    " */",
  ].join("\n");
}

/** Emit the generated TypeScript catalog-data module. */
export function emitTypescriptCatalogData(
  loaded: LoadedErrorCatalog,
): GeneratedFile {
  const entryLiterals = loaded.entries
    .map((entry) => {
      const lines: string[] = [`  ${entry.code}: Object.freeze({`];
      for (const key of ENTRY_KEY_ORDER) {
        const value = (entry as unknown as Record<string, unknown>)[key];
        if (value === undefined) {
          continue;
        }
        lines.push(`    ${key}: ${JSON.stringify(value)},`);
      }
      lines.push("  }),");
      return lines.join("\n");
    })
    .join("\n");
  const codes = loaded.entries
    .map((entry) => `  ${JSON.stringify(entry.code)},`)
    .join("\n");
  const content = `${tsHeader()}

import type { ErrorCatalogV1CatalogEntry } from "./catalog.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "./taxonomy.v1.ts";

/**
 * Canonical catalog metadata for every v1 error code, keyed by code.
 * Derived from the validated catalog instance; the taxonomy enum and this
 * map always agree exactly (the generator fails closed otherwise).
 */
export const ERROR_CATALOG_V1: Readonly<
  Record<ErrorTaxonomyV1ErrorCode, ErrorCatalogV1CatalogEntry>
> = Object.freeze({
${entryLiterals}
});

/** Every v1 error code, sorted ascending. */
export const ERROR_CODES_V1: readonly ErrorTaxonomyV1ErrorCode[] =
  Object.freeze([
${codes}
  ]);

/** Type guard: true when the value is a member of the v1 error catalog. */
export function isErrorCodeV1(
  value: unknown,
): value is ErrorTaxonomyV1ErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ERROR_CATALOG_V1, value)
  );
}

/**
 * Canonical metadata lookup for unknown input. Unknown codes fail closed;
 * the untrusted value is never echoed into the error message.
 */
export function requireErrorCatalogEntryV1(
  value: unknown,
): ErrorCatalogV1CatalogEntry {
  if (!isErrorCodeV1(value)) {
    throw new Error(
      "unknown error code: not a member of the v1 error catalog",
    );
  }
  return ERROR_CATALOG_V1[value];
}

/** Safe default English user message for a known code. */
export function errorDefaultMessageV1(
  code: ErrorTaxonomyV1ErrorCode,
): string {
  return ERROR_CATALOG_V1[code].default_message;
}
`;
  return { path: "typescript/error/catalog-data.v1.ts", content };
}

function pyValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "string") {
    return pythonStringLiteral(value);
  }
  throw new Error(
    `unsupported catalog value type for python emission: ${typeof value}`,
  );
}

/** Emit the generated Python catalog-data module. */
export function emitPythonCatalogData(
  loaded: LoadedErrorCatalog,
): GeneratedFile {
  const entryLiterals = loaded.entries
    .map((entry) => {
      const lines: string[] = [
        `    ${pythonStringLiteral(entry.code)}: ErrorCatalogV1CatalogEntry(`,
      ];
      for (const key of ENTRY_KEY_ORDER) {
        const value = (entry as unknown as Record<string, unknown>)[key];
        if (value === undefined) {
          continue;
        }
        lines.push(`        ${key}=${pyValue(value)},`);
      }
      lines.push("    ),");
      return lines.join("\n");
    })
    .join("\n");
  const codes = loaded.entries
    .map((entry) => `    ${pythonStringLiteral(entry.code)},`)
    .join("\n");
  const content = `"""GENERATED FILE - DO NOT EDIT BY HAND.

Canonical error-catalog data derived from
packages/contracts/catalog/error-catalog.v1.json (validated against
urn:japp:schema:error:catalog:v1).

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Final, cast

from japp_contracts.error.catalog_v1 import ErrorCatalogV1CatalogEntry
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode

ERROR_CATALOG_V1: Final[
    dict[ErrorTaxonomyV1ErrorCode, ErrorCatalogV1CatalogEntry]
] = {
${entryLiterals}
}
"""Canonical catalog metadata for every v1 error code, keyed by code."""

ERROR_CODES_V1: Final[tuple[ErrorTaxonomyV1ErrorCode, ...]] = (
${codes}
)
"""Every v1 error code, sorted ascending."""


def is_error_code_v1(value: object) -> bool:
    """True when the value is a member of the v1 error catalog."""
    return isinstance(value, str) and value in ERROR_CATALOG_V1


def require_error_catalog_entry_v1(value: object) -> ErrorCatalogV1CatalogEntry:
    """Canonical metadata lookup; unknown codes fail closed.

    The untrusted value is never echoed into the raised message.
    """
    if not is_error_code_v1(value):
        msg = "unknown error code: not a member of the v1 error catalog"
        raise KeyError(msg)
    return ERROR_CATALOG_V1[cast("ErrorTaxonomyV1ErrorCode", value)]


def error_default_message_v1(value: object) -> str:
    """Safe default English user message for a known code."""
    return require_error_catalog_entry_v1(value).default_message
`;
  return {
    path: "python/src/japp_contracts/error/catalog_data_v1.py",
    content,
  };
}

/** Names the Python data module contributes to the package export surface. */
export const PYTHON_CATALOG_DATA_EXPORTS = [
  "ERROR_CATALOG_V1",
  "ERROR_CODES_V1",
  "error_default_message_v1",
  "is_error_code_v1",
  "require_error_catalog_entry_v1",
] as const;
