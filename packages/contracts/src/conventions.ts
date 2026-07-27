/**
 * JSON Schema conventions for the canonical contract source (M01-W01).
 *
 * Normative rules live in packages/contracts/README.md; this module is the
 * executable form. Every check here is deterministic, offline, and operates
 * on parsed schema documents — no network access and no environment
 * dependence.
 */

import { isJsonObject, type JsonObject, type JsonValue } from "./json.ts";

/** The only supported JSON Schema dialect for hand-authored contract schemas. */
export const JSON_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema";

/** Canonical schema-identifier grammar: urn:japp:schema:<segments…>:v<major>. */
export const SCHEMA_ID_PATTERN =
  /^urn:japp:schema:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*:v(0|[1-9][0-9]*)$/;

/** Strict MAJOR.MINOR.PATCH triple; no prerelease or build metadata. */
export const SCHEMA_VERSION_PATTERN =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** UPPER_SNAKE_CASE grammar every enum token must satisfy. */
export const ENUM_TOKEN_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Namespaced extension-surface property names: x- followed by kebab-case. */
export const EXTENSION_KEY_PATTERN = /^x-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Root annotation carrying the full document version. */
export const SCHEMA_VERSION_KEYWORD = "x-japp-schema-version";
/** Field-level sensitivity annotation (redaction vocabulary). */
export const SENSITIVITY_KEYWORD = "x-japp-sensitivity";
/** Field-level diagnostics/redaction handling annotation. */
export const REDACTION_KEYWORD = "x-japp-redaction";
/** Version in which a deprecated member was deprecated. */
export const DEPRECATED_SINCE_KEYWORD = "x-japp-deprecated-since";
/** Marks a deliberately open object as the explicit extension surface. */
export const EXTENSION_POINT_KEYWORD = "x-japp-extension-point";

/** Closed sensitivity vocabulary shared with urn:japp:schema:common:redaction:v1. */
export const SENSITIVITY_CLASSES = [
  "PUBLIC",
  "INTERNAL",
  "PERSONAL",
  "SENSITIVE",
  "SECRET",
] as const;

/** Closed redaction-policy vocabulary shared with urn:japp:schema:common:redaction:v1. */
export const REDACTION_POLICIES = [
  "NONE",
  "REDACT_VALUE",
  "HASH_ONLY",
  "FORBID_CAPTURE",
] as const;

/**
 * The complete allowlist of custom annotation keywords. Any other x-… key in
 * a schema document is a convention violation, and the strict validator
 * additionally rejects it at compile time.
 */
export const ANNOTATION_KEYWORDS = [
  SCHEMA_VERSION_KEYWORD,
  SENSITIVITY_KEYWORD,
  REDACTION_KEYWORD,
  DEPRECATED_SINCE_KEYWORD,
  EXTENSION_POINT_KEYWORD,
] as const;

/**
 * Structural keywords prohibited in hand-authored contract schemas.
 *
 * - $anchor/$dynamicAnchor/$dynamicRef: all references must be explicit
 *   JSON-pointer or catalog-URN references so resolution stays deterministic.
 * - $vocabulary: dialect customization is not supported.
 * - definitions: legacy draft-07 spelling; use $defs.
 * - default: schemas never inject defaults; absent means absent
 *   (no-silent-defaults policy).
 */
export const PROHIBITED_KEYWORDS = [
  "$anchor",
  "$dynamicAnchor",
  "$dynamicRef",
  "$vocabulary",
  "definitions",
  "default",
] as const;

const SCHEMA_MAP_KEYWORDS = [
  "$defs",
  "properties",
  "patternProperties",
  "dependentSchemas",
] as const;

const SCHEMA_VALUE_KEYWORDS = [
  "additionalProperties",
  "items",
  "contains",
  "propertyNames",
  "if",
  "then",
  "else",
  "not",
  "unevaluatedProperties",
  "unevaluatedItems",
] as const;

const SCHEMA_ARRAY_KEYWORDS = [
  "allOf",
  "anyOf",
  "oneOf",
  "prefixItems",
] as const;

export interface SchemaVersionTriple {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export interface ParsedSchemaId {
  readonly segments: readonly string[];
  readonly major: number;
}

/** Parse a canonical schema identifier; null when the grammar does not match. */
export function parseSchemaId(value: string): ParsedSchemaId | null {
  if (!SCHEMA_ID_PATTERN.test(value)) {
    return null;
  }
  const parts = value.split(":");
  const versionPart = parts[parts.length - 1] ?? "";
  return {
    segments: parts.slice(3, -1),
    major: Number(versionPart.slice(1)),
  };
}

/** Parse a strict MAJOR.MINOR.PATCH triple; null when malformed. */
export function parseSchemaVersion(value: string): SchemaVersionTriple | null {
  if (!SCHEMA_VERSION_PATTERN.test(value)) {
    return null;
  }
  const [major = "", minor = "", patch = ""] = value.split(".");
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}

/** One hand-authored schema document with its repository location. */
export interface SchemaDocumentInput {
  /** POSIX-style path relative to the schemas root, e.g. common/money.v1.schema.json. */
  readonly relativePath: string;
  /** The parsed JSON document. */
  readonly document: JsonObject;
}

const FILE_SUFFIX_PATTERN =
  /^(?<name>[a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.v(?<major>0|[1-9][0-9]*)\.schema\.json$/;

/**
 * Derive the required $id for a schema file from its repository path.
 * Returns null when the path itself violates the layout convention.
 */
export function expectedIdForPath(relativePath: string): string | null {
  const parts = relativePath.split("/");
  const fileName = parts[parts.length - 1] ?? "";
  const match = FILE_SUFFIX_PATTERN.exec(fileName);
  if (match?.groups === undefined) {
    return null;
  }
  const directories = parts.slice(0, -1);
  const segmentPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  if (!directories.every((directory) => segmentPattern.test(directory))) {
    return null;
  }
  const name = match.groups.name ?? "";
  const major = match.groups.major ?? "";
  const segments = [...directories, name];
  return `urn:japp:schema:${segments.join(":")}:v${major}`;
}

function isSchemaNode(
  value: JsonValue | undefined,
): value is JsonObject | boolean {
  return typeof value === "boolean" || isJsonObject(value);
}

/** Visit every schema node (root plus nested subschemas) in document order. */
export function walkSchemaNodes(
  root: JsonObject,
  visit: (node: JsonObject, pointer: string) => void,
): void {
  const visitNode = (node: JsonObject | boolean, pointer: string): void => {
    if (typeof node === "boolean") {
      return;
    }
    visit(node, pointer);
    for (const keyword of SCHEMA_MAP_KEYWORDS) {
      const map = node[keyword];
      if (isJsonObject(map)) {
        for (const [key, child] of Object.entries(map)) {
          if (isSchemaNode(child)) {
            visitNode(child, `${pointer}/${keyword}/${key}`);
          }
        }
      }
    }
    for (const keyword of SCHEMA_VALUE_KEYWORDS) {
      const child = node[keyword];
      if (isSchemaNode(child)) {
        visitNode(child, `${pointer}/${keyword}`);
      }
    }
    for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
      const children = node[keyword];
      if (Array.isArray(children)) {
        children.forEach((child, index) => {
          if (isSchemaNode(child)) {
            visitNode(child, `${pointer}/${keyword}/${String(index)}`);
          }
        });
      }
    }
  };
  visitNode(root, "#");
}

/** A $ref discovered inside a document, with its schema-node location. */
export interface CollectedRef {
  readonly pointer: string;
  readonly ref: string;
}

/** Collect every $ref value declared by the document's schema nodes. */
export function collectRefs(document: JsonObject): CollectedRef[] {
  const refs: CollectedRef[] = [];
  walkSchemaNodes(document, (node, pointer) => {
    const ref = node.$ref;
    if (typeof ref === "string") {
      refs.push({ pointer, ref });
    }
  });
  return refs;
}

/** Split a catalog reference into its URN and optional JSON-pointer fragment. */
function splitRef(ref: string): { base: string; fragment: string | null } {
  const hashIndex = ref.indexOf("#");
  if (hashIndex === -1) {
    return { base: ref, fragment: null };
  }
  return { base: ref.slice(0, hashIndex), fragment: ref.slice(hashIndex) };
}

const LOCAL_POINTER_PATTERN = /^#(\/[^\s#]*)?$/;

function checkNodeAnnotations(
  node: JsonObject,
  pointer: string,
  violations: string[],
): void {
  for (const key of Object.keys(node)) {
    if (!key.startsWith("x-")) {
      continue;
    }
    if (!(ANNOTATION_KEYWORDS as readonly string[]).includes(key)) {
      violations.push(
        `${pointer}: unsupported custom annotation keyword ${key}; ` +
          `allowed: ${ANNOTATION_KEYWORDS.join(", ")}`,
      );
      continue;
    }
    const value = node[key];
    if (key === SENSITIVITY_KEYWORD) {
      if (
        typeof value !== "string" ||
        !(SENSITIVITY_CLASSES as readonly string[]).includes(value)
      ) {
        violations.push(
          `${pointer}: ${key} must be one of ${SENSITIVITY_CLASSES.join(", ")}`,
        );
      }
    } else if (key === REDACTION_KEYWORD) {
      if (
        typeof value !== "string" ||
        !(REDACTION_POLICIES as readonly string[]).includes(value)
      ) {
        violations.push(
          `${pointer}: ${key} must be one of ${REDACTION_POLICIES.join(", ")}`,
        );
      }
    } else if (key === DEPRECATED_SINCE_KEYWORD) {
      if (typeof value !== "string" || parseSchemaVersion(value) === null) {
        violations.push(
          `${pointer}: ${key} must be a MAJOR.MINOR.PATCH version string`,
        );
      }
      if (node.deprecated !== true) {
        violations.push(
          `${pointer}: ${key} requires a sibling "deprecated": true`,
        );
      }
    } else if (key === EXTENSION_POINT_KEYWORD) {
      if (value !== true) {
        violations.push(`${pointer}: ${key} must be exactly true`);
      }
    }
  }
}

function checkNodeStructure(
  node: JsonObject,
  pointer: string,
  violations: string[],
): void {
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (keyword in node) {
      violations.push(`${pointer}: prohibited keyword ${keyword}`);
    }
  }
  if (node.type === "object") {
    const closed = node.additionalProperties === false;
    const extensionPoint = node[EXTENSION_POINT_KEYWORD] === true;
    if (!closed && !extensionPoint) {
      violations.push(
        `${pointer}: object schemas are closed by default; set ` +
          `"additionalProperties": false or mark a deliberate extension ` +
          `surface with "${EXTENSION_POINT_KEYWORD}": true`,
      );
    }
    if (closed && extensionPoint) {
      violations.push(
        `${pointer}: ${EXTENSION_POINT_KEYWORD} contradicts ` +
          `"additionalProperties": false`,
      );
    }
  }
  const enumValues = node.enum;
  if (enumValues !== undefined) {
    if (!Array.isArray(enumValues) || enumValues.length === 0) {
      violations.push(`${pointer}: enum must be a non-empty array`);
    } else {
      if (node.type !== "string") {
        violations.push(
          `${pointer}: enums are closed string-token sets and must declare ` +
            `"type": "string"`,
        );
      }
      const seen = new Set<string>();
      for (const token of enumValues) {
        if (typeof token !== "string" || !ENUM_TOKEN_PATTERN.test(token)) {
          violations.push(
            `${pointer}: enum value ${JSON.stringify(token)} violates the ` +
              `UPPER_SNAKE_CASE token grammar`,
          );
        } else if (seen.has(token)) {
          violations.push(`${pointer}: duplicate enum value ${token}`);
        } else {
          seen.add(token);
        }
      }
    }
  }
}

function checkNodeRef(
  node: JsonObject,
  pointer: string,
  violations: string[],
): void {
  const ref = node.$ref;
  if (ref === undefined) {
    return;
  }
  if (typeof ref !== "string") {
    violations.push(`${pointer}: $ref must be a string`);
    return;
  }
  if (LOCAL_POINTER_PATTERN.test(ref)) {
    return;
  }
  const { base, fragment } = splitRef(ref);
  if (parseSchemaId(base) === null) {
    violations.push(
      `${pointer}: $ref ${JSON.stringify(ref)} is not a local JSON pointer ` +
        `or a catalog urn:japp:schema reference; remote, relative, and ` +
        `file references are prohibited`,
    );
    return;
  }
  if (fragment !== null && !LOCAL_POINTER_PATTERN.test(fragment)) {
    violations.push(
      `${pointer}: $ref fragment ${JSON.stringify(fragment)} must be a ` +
        `JSON pointer`,
    );
  }
}

/**
 * Check one document against every single-document convention.
 * Returns human-readable violations prefixed with the document path.
 */
export function checkSchemaDocument(input: SchemaDocumentInput): string[] {
  const violations: string[] = [];
  const { relativePath, document } = input;
  const label = relativePath;

  const dialect = document.$schema;
  if (dialect !== JSON_SCHEMA_DIALECT) {
    violations.push(
      `${label}: $schema must be ${JSON_SCHEMA_DIALECT}, found ` +
        JSON.stringify(dialect),
    );
  }

  const id = document.$id;
  const parsedId = typeof id === "string" ? parseSchemaId(id) : null;
  if (typeof id !== "string" || parsedId === null) {
    violations.push(
      `${label}: $id must match ${SCHEMA_ID_PATTERN.source}, found ` +
        JSON.stringify(id),
    );
  }

  const expectedId = expectedIdForPath(relativePath);
  if (expectedId === null) {
    violations.push(
      `${label}: file path violates the <segments…>/<name>.v<major>.schema.json ` +
        `layout convention`,
    );
  } else if (typeof id === "string" && id !== expectedId) {
    violations.push(
      `${label}: $id ${JSON.stringify(id)} does not match the path-derived ` +
        `identifier ${JSON.stringify(expectedId)}`,
    );
  }

  for (const metadataKey of ["title", "description"] as const) {
    const value = document[metadataKey];
    if (typeof value !== "string" || value.trim() === "") {
      violations.push(`${label}: ${metadataKey} must be a non-empty string`);
    }
  }

  const declaredVersion = document[SCHEMA_VERSION_KEYWORD];
  const parsedVersion =
    typeof declaredVersion === "string"
      ? parseSchemaVersion(declaredVersion)
      : null;
  if (typeof declaredVersion !== "string" || parsedVersion === null) {
    violations.push(
      `${label}: ${SCHEMA_VERSION_KEYWORD} must declare a strict ` +
        `MAJOR.MINOR.PATCH version`,
    );
  } else if (parsedId !== null && parsedVersion.major !== parsedId.major) {
    violations.push(
      `${label}: ${SCHEMA_VERSION_KEYWORD} major ${String(parsedVersion.major)} ` +
        `disagrees with the $id major v${String(parsedId.major)}`,
    );
  }

  walkSchemaNodes(document, (node, pointer) => {
    checkNodeAnnotations(node, `${label}:${pointer}`, violations);
    checkNodeStructure(node, `${label}:${pointer}`, violations);
    checkNodeRef(node, `${label}:${pointer}`, violations);
  });

  return violations;
}

/**
 * Check cross-document conventions: unique $id values and repository-local
 * resolvability of every catalog reference.
 */
export function checkSchemaCatalogDocuments(
  inputs: readonly SchemaDocumentInput[],
): string[] {
  const violations: string[] = [];
  const byId = new Map<string, string>();
  for (const input of inputs) {
    violations.push(...checkSchemaDocument(input));
    const id = input.document.$id;
    if (typeof id !== "string") {
      continue;
    }
    const existing = byId.get(id);
    if (existing !== undefined) {
      violations.push(
        `${input.relativePath}: duplicate $id ${JSON.stringify(id)} already ` +
          `declared by ${existing}`,
      );
    } else {
      byId.set(id, input.relativePath);
    }
  }
  for (const input of inputs) {
    for (const { pointer, ref } of collectRefs(input.document)) {
      if (LOCAL_POINTER_PATTERN.test(ref)) {
        continue;
      }
      const { base } = splitRef(ref);
      if (parseSchemaId(base) !== null && !byId.has(base)) {
        violations.push(
          `${input.relativePath}:${pointer}: $ref target ` +
            `${JSON.stringify(base)} is not a committed catalog schema`,
        );
      }
    }
  }
  return violations;
}
