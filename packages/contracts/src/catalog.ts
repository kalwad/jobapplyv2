/**
 * Deterministic loader for the canonical hand-authored schema source
 * (packages/contracts/schemas, M01-W01).
 *
 * Loading is offline and fail-closed: every committed document must parse,
 * satisfy the repository conventions, and resolve its references inside the
 * repository. Any violation throws SchemaCatalogError listing every problem.
 * Iteration order is the sorted POSIX relative path, so catalog behavior is
 * identical on macOS, Windows, and Ubuntu.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkSchemaCatalogDocuments,
  parseSchemaId,
  parseSchemaVersion,
  SCHEMA_VERSION_KEYWORD,
  type SchemaDocumentInput,
  type SchemaVersionTriple,
} from "./conventions.js";
import { isJsonObject, type JsonObject, type JsonValue } from "./json.js";

/** Default schemas root: packages/contracts/schemas. */
export const DEFAULT_SCHEMAS_ROOT = fileURLToPath(
  new URL("../schemas/", import.meta.url),
);

/** One loaded catalog document. */
export interface SchemaCatalogEntry {
  /** POSIX-style path relative to the schemas root. */
  readonly relativePath: string;
  /** Canonical identifier (also the document's $id). */
  readonly id: string;
  /** Parsed x-japp-schema-version triple. */
  readonly version: SchemaVersionTriple;
  /** The parsed schema document. */
  readonly document: JsonObject;
}

/** The complete, convention-checked schema catalog. */
export interface SchemaCatalog {
  readonly entries: readonly SchemaCatalogEntry[];
  readonly byId: ReadonlyMap<string, SchemaCatalogEntry>;
}

/** Raised when the committed schema source violates the conventions. */
export class SchemaCatalogError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      `schema catalog violates the repository conventions:\n` +
        violations.map((violation) => `  - ${violation}`).join("\n"),
    );
    this.name = "SchemaCatalogError";
    this.violations = violations;
  }
}

function listSchemaFiles(root: string): {
  files: string[];
  problems: string[];
} {
  const problems: string[] = [];
  const entries = readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const absolute = join(entry.parentPath, entry.name);
    const relativePosix = relative(root, absolute).split(sep).join("/");
    if (entry.name.endsWith(".schema.json")) {
      files.push(relativePosix);
    } else {
      problems.push(
        `${relativePosix}: only *.schema.json documents may live under the ` +
          `schemas root`,
      );
    }
  }
  files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return { files, problems };
}

function parseDocument(
  root: string,
  relativePath: string,
): { document: JsonObject | null; problems: string[] } {
  const absolute = join(root, ...relativePath.split("/"));
  let text: string;
  try {
    text = readFileSync(absolute, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      document: null,
      problems: [`${relativePath}: unreadable schema file (${message})`],
    };
  }
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(text) as JsonValue;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      document: null,
      problems: [`${relativePath}: invalid JSON (${message})`],
    };
  }
  if (!isJsonObject(parsed)) {
    return {
      document: null,
      problems: [`${relativePath}: schema document root must be a JSON object`],
    };
  }
  return { document: parsed, problems: [] };
}

/**
 * Load and convention-check the schema catalog. Throws SchemaCatalogError on
 * any violation; never fetches anything remotely.
 */
export function loadSchemaCatalog(
  options: { readonly schemasRoot?: string } = {},
): SchemaCatalog {
  const root = options.schemasRoot ?? DEFAULT_SCHEMAS_ROOT;
  const { files, problems } = listSchemaFiles(root);
  const violations: string[] = [...problems];
  const inputs: SchemaDocumentInput[] = [];
  for (const relativePath of files) {
    const { document, problems: parseProblems } = parseDocument(
      root,
      relativePath,
    );
    violations.push(...parseProblems);
    if (document !== null) {
      inputs.push({ relativePath, document });
    }
  }
  if (inputs.length === 0) {
    violations.push(
      `schemas root ${root} contains no schema documents; the canonical ` +
        `source must not be empty`,
    );
  }
  violations.push(...checkSchemaCatalogDocuments(inputs));
  if (violations.length > 0) {
    throw new SchemaCatalogError(violations);
  }

  const entries: SchemaCatalogEntry[] = inputs.map((input) => {
    const id = input.document.$id;
    const declaredVersion = input.document[SCHEMA_VERSION_KEYWORD];
    if (typeof id !== "string" || parseSchemaId(id) === null) {
      throw new SchemaCatalogError([
        `${input.relativePath}: internal error: $id survived convention checks invalid`,
      ]);
    }
    const version =
      typeof declaredVersion === "string"
        ? parseSchemaVersion(declaredVersion)
        : null;
    if (version === null) {
      throw new SchemaCatalogError([
        `${input.relativePath}: internal error: ${SCHEMA_VERSION_KEYWORD} ` +
          `survived convention checks invalid`,
      ]);
    }
    return {
      relativePath: input.relativePath,
      id,
      version,
      document: input.document,
    };
  });
  const byId = new Map<string, SchemaCatalogEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  return { entries, byId };
}
