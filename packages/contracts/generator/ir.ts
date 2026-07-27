/**
 * Intermediate representation for contract generation (M01-W02).
 *
 * Converts convention-checked catalog documents (M01-W01) into a normalized,
 * explicitly-supported model. The extraction is fail-closed keyword by
 * keyword: every schema node is checked against an exact allowlist for its
 * construct, and anything outside the supported set raises
 * UnsupportedConstructError carrying the document path and JSON pointer.
 * Constraints are never silently dropped — a keyword the IR cannot represent
 * is an error, not an omission.
 */

import type { SchemaCatalog, SchemaCatalogEntry } from "../src/catalog.ts";
import {
  DEPRECATED_SINCE_KEYWORD,
  ENUM_TOKEN_PATTERN,
  EXTENSION_POINT_KEYWORD,
  parseSchemaId,
  REDACTION_KEYWORD,
  SENSITIVITY_KEYWORD,
  type SchemaVersionTriple,
} from "../src/conventions.ts";
import { isJsonObject, type JsonObject, type JsonValue } from "../src/json.ts";

/** Raised when a schema uses a construct outside the supported M01-W02 set. */
export class UnsupportedConstructError extends Error {
  readonly documentPath: string;
  readonly pointer: string;

  constructor(documentPath: string, pointer: string, reason: string) {
    super(
      `unsupported schema construct in ${documentPath} at ${pointer}: ` +
        `${reason} (the generator fails closed instead of silently ` +
        `dropping constraints; extend the generator deliberately)`,
    );
    this.name = "UnsupportedConstructError";
    this.documentPath = documentPath;
    this.pointer = pointer;
  }
}

/** Documentation/annotation metadata shared by every IR node. */
export interface IrMetadata {
  readonly title: string | null;
  readonly description: string | null;
  readonly comment: string | null;
  readonly deprecated: boolean;
  readonly deprecatedSince: string | null;
  readonly sensitivity: string | null;
  readonly redaction: string | null;
}

export interface IrStringType {
  readonly kind: "string";
  readonly metadata: IrMetadata;
  readonly pattern: string | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly format: "date" | "date-time" | null;
}

export interface IrEnumType {
  readonly kind: "enum";
  readonly metadata: IrMetadata;
  readonly tokens: readonly string[];
}

export interface IrNumberType {
  readonly kind: "number";
  readonly metadata: IrMetadata;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export interface IrBooleanType {
  readonly kind: "boolean";
  readonly metadata: IrMetadata;
}

export interface IrArrayType {
  readonly kind: "array";
  readonly metadata: IrMetadata;
  readonly items: IrType;
  readonly minItems: number | null;
  readonly maxItems: number | null;
}

export interface IrRefType {
  readonly kind: "ref";
  readonly metadata: IrMetadata;
  /** Absolute catalog document id the reference resolves in. */
  readonly targetId: string;
  /** $defs name inside the target document, or null for its root schema. */
  readonly targetDef: string | null;
}

export interface IrNullableType {
  readonly kind: "nullable";
  readonly metadata: IrMetadata;
  readonly inner: IrType;
}

/** The boolean schema `true`: any JSON value (used for opaque payloads). */
export interface IrAnyType {
  readonly kind: "any";
  readonly metadata: IrMetadata;
}

export interface IrProperty {
  readonly name: string;
  readonly required: boolean;
  readonly type: IrType;
}

export interface IrObjectType {
  readonly kind: "object";
  readonly metadata: IrMetadata;
  readonly properties: readonly IrProperty[];
  /**
   * Closed objects (additionalProperties: false) reject unknown members.
   * Extension objects (x-japp-extension-point: true) are deliberately open.
   */
  readonly extensionPoint: boolean;
  /** Extension objects: constrained property-name schema, if declared. */
  readonly propertyNames: IrType | null;
  /** Extension objects: maximum member count, if declared. */
  readonly maxProperties: number | null;
}

export type IrType =
  | IrStringType
  | IrEnumType
  | IrNumberType
  | IrBooleanType
  | IrArrayType
  | IrRefType
  | IrNullableType
  | IrAnyType
  | IrObjectType;

export interface IrDefinition {
  readonly name: string;
  readonly type: IrType;
}

export interface IrDocument {
  readonly id: string;
  readonly relativePath: string;
  /** Directory segments plus document name (the URN segments). */
  readonly segments: readonly string[];
  readonly major: number;
  readonly version: SchemaVersionTriple;
  readonly title: string;
  readonly description: string;
  readonly definitions: readonly IrDefinition[];
  /** Root payload schema, when the document root is itself a schema. */
  readonly root: IrType | null;
}

export interface IrCatalog {
  readonly documents: readonly IrDocument[];
}

const METADATA_KEYWORDS = new Set([
  "title",
  "description",
  "$comment",
  "deprecated",
  DEPRECATED_SINCE_KEYWORD,
  SENSITIVITY_KEYWORD,
  REDACTION_KEYWORD,
]);

const ROOT_ONLY_KEYWORDS = new Set([
  "$schema",
  "$id",
  "x-japp-schema-version",
  "$defs",
]);

function optionalString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function extractMetadata(node: JsonObject): IrMetadata {
  return {
    title: optionalString(node.title),
    description: optionalString(node.description),
    comment: optionalString(node.$comment),
    deprecated: node.deprecated === true,
    deprecatedSince: optionalString(node[DEPRECATED_SINCE_KEYWORD]),
    sensitivity: optionalString(node[SENSITIVITY_KEYWORD]),
    redaction: optionalString(node[REDACTION_KEYWORD]),
  };
}

interface NodeContext {
  readonly documentPath: string;
  readonly pointer: string;
}

function fail(context: NodeContext, reason: string): never {
  throw new UnsupportedConstructError(
    context.documentPath,
    context.pointer,
    reason,
  );
}

function child(context: NodeContext, ...steps: string[]): NodeContext {
  return {
    documentPath: context.documentPath,
    pointer: `${context.pointer}/${steps.join("/")}`,
  };
}

/**
 * Assert the node declares no keyword outside `allowed` (metadata keywords
 * are always permitted; root-only keywords are permitted only at the root).
 */
function assertOnlyKeywords(
  node: JsonObject,
  context: NodeContext,
  allowed: ReadonlySet<string>,
  options: { readonly isRoot?: boolean } = {},
): void {
  for (const key of Object.keys(node)) {
    if (METADATA_KEYWORDS.has(key) || allowed.has(key)) {
      continue;
    }
    if (options.isRoot === true && ROOT_ONLY_KEYWORDS.has(key)) {
      continue;
    }
    fail(context, `keyword "${key}" is not supported on this construct`);
  }
}

function requireInteger(
  value: JsonValue | undefined,
  context: NodeContext,
  keyword: string,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(context, `${keyword} must be a non-negative integer`);
  }
  return value;
}

function requireNumber(
  value: JsonValue | undefined,
  context: NodeContext,
  keyword: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(context, `${keyword} must be a finite number`);
  }
  return value;
}

function extractEnum(node: JsonObject, context: NodeContext): IrEnumType {
  assertOnlyKeywords(node, context, new Set(["type", "enum"]));
  if (node.type !== "string") {
    fail(context, 'enums must declare "type": "string"');
  }
  const tokens = node.enum;
  if (!Array.isArray(tokens) || tokens.length === 0) {
    fail(context, "enum must be a non-empty array");
  }
  const extracted: string[] = [];
  for (const token of tokens) {
    if (typeof token !== "string" || !ENUM_TOKEN_PATTERN.test(token)) {
      fail(
        context,
        `enum token ${JSON.stringify(token)} violates the token grammar`,
      );
    }
    extracted.push(token);
  }
  return { kind: "enum", metadata: extractMetadata(node), tokens: extracted };
}

function extractString(node: JsonObject, context: NodeContext): IrStringType {
  assertOnlyKeywords(
    node,
    context,
    new Set(["type", "pattern", "minLength", "maxLength", "format"]),
  );
  const format = node.format;
  if (format !== undefined && format !== "date" && format !== "date-time") {
    fail(
      context,
      `string format ${JSON.stringify(format)} is not supported ` +
        `(supported: "date", "date-time")`,
    );
  }
  const pattern = node.pattern;
  if (pattern !== undefined && typeof pattern !== "string") {
    fail(context, "pattern must be a string");
  }
  return {
    kind: "string",
    metadata: extractMetadata(node),
    pattern: typeof pattern === "string" ? pattern : null,
    minLength:
      node.minLength === undefined
        ? null
        : requireInteger(node.minLength, context, "minLength"),
    maxLength:
      node.maxLength === undefined
        ? null
        : requireInteger(node.maxLength, context, "maxLength"),
    format: format ?? null,
  };
}

function extractNumber(node: JsonObject, context: NodeContext): IrNumberType {
  assertOnlyKeywords(node, context, new Set(["type", "minimum", "maximum"]));
  return {
    kind: "number",
    metadata: extractMetadata(node),
    minimum:
      node.minimum === undefined
        ? null
        : requireNumber(node.minimum, context, "minimum"),
    maximum:
      node.maximum === undefined
        ? null
        : requireNumber(node.maximum, context, "maximum"),
  };
}

function extractBoolean(node: JsonObject, context: NodeContext): IrBooleanType {
  assertOnlyKeywords(node, context, new Set(["type"]));
  return { kind: "boolean", metadata: extractMetadata(node) };
}

function extractArray(
  node: JsonObject,
  context: NodeContext,
  documentId: string,
): IrArrayType {
  assertOnlyKeywords(
    node,
    context,
    new Set(["type", "items", "minItems", "maxItems"]),
  );
  const itemsNode = node.items;
  if (!isJsonObject(itemsNode)) {
    fail(
      context,
      "arrays require a single object items schema (tuples/prefixItems are " +
        "not supported)",
    );
  }
  return {
    kind: "array",
    metadata: extractMetadata(node),
    items: extractType(itemsNode, child(context, "items"), documentId),
    minItems:
      node.minItems === undefined
        ? null
        : requireInteger(node.minItems, context, "minItems"),
    maxItems:
      node.maxItems === undefined
        ? null
        : requireInteger(node.maxItems, context, "maxItems"),
  };
}

const LOCAL_DEFS_POINTER = /^#\/\$defs\/([A-Za-z][A-Za-z0-9]*)$/;

function extractRef(
  node: JsonObject,
  context: NodeContext,
  documentId: string,
): IrRefType {
  assertOnlyKeywords(node, context, new Set(["$ref"]));
  const ref = node.$ref;
  if (typeof ref !== "string") {
    fail(context, "$ref must be a string");
  }
  const metadata = extractMetadata(node);
  const localMatch = LOCAL_DEFS_POINTER.exec(ref);
  if (localMatch !== null) {
    const targetDef = localMatch[1];
    if (targetDef === undefined) {
      fail(context, `local $ref ${JSON.stringify(ref)} has no $defs name`);
    }
    return { kind: "ref", metadata, targetId: documentId, targetDef };
  }
  if (ref.startsWith("#")) {
    fail(
      context,
      `local $ref ${JSON.stringify(ref)} must point at #/$defs/<name>`,
    );
  }
  const hashIndex = ref.indexOf("#");
  const base = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? null : ref.slice(hashIndex);
  if (parseSchemaId(base) === null) {
    fail(context, `$ref ${JSON.stringify(ref)} is not a catalog reference`);
  }
  if (fragment === null) {
    return { kind: "ref", metadata, targetId: base, targetDef: null };
  }
  const fragmentMatch = LOCAL_DEFS_POINTER.exec(fragment);
  const targetDef = fragmentMatch?.[1];
  if (targetDef === undefined) {
    fail(
      context,
      `$ref fragment ${JSON.stringify(fragment)} must be #/$defs/<name>`,
    );
  }
  return { kind: "ref", metadata, targetId: base, targetDef };
}

function extractNullable(
  node: JsonObject,
  context: NodeContext,
  documentId: string,
): IrNullableType {
  assertOnlyKeywords(node, context, new Set(["anyOf"]));
  const members = node.anyOf;
  if (!Array.isArray(members) || members.length !== 2) {
    fail(
      context,
      "anyOf is supported only as the two-member nullability form " +
        "[<schema>, {type: null}]",
    );
  }
  const isNullSchema = (member: JsonValue): boolean =>
    isJsonObject(member) &&
    member.type === "null" &&
    Object.keys(member).every(
      (key) => key === "type" || METADATA_KEYWORDS.has(key),
    );
  const nullIndex = members.findIndex(isNullSchema);
  if (nullIndex === -1) {
    fail(
      context,
      "anyOf is supported only for nullability and requires exactly one " +
        '{"type": "null"} member',
    );
  }
  const innerIndex = nullIndex === 0 ? 1 : 0;
  const innerNode = members[innerIndex];
  if (!isJsonObject(innerNode) || isNullSchema(innerNode)) {
    fail(
      context,
      "anyOf nullability requires exactly one non-null member schema",
    );
  }
  const inner = extractType(
    innerNode,
    child(context, "anyOf", String(innerIndex)),
    documentId,
  );
  return { kind: "nullable", metadata: extractMetadata(node), inner };
}

function extractObject(
  node: JsonObject,
  context: NodeContext,
  documentId: string,
): IrObjectType {
  const extensionPoint = node[EXTENSION_POINT_KEYWORD] === true;
  if (extensionPoint) {
    assertOnlyKeywords(
      node,
      context,
      new Set([
        "type",
        EXTENSION_POINT_KEYWORD,
        "propertyNames",
        "maxProperties",
      ]),
    );
    const propertyNamesNode = node.propertyNames;
    let propertyNames: IrType | null = null;
    if (propertyNamesNode !== undefined) {
      if (!isJsonObject(propertyNamesNode)) {
        fail(context, "propertyNames must be a schema object");
      }
      propertyNames = extractType(
        propertyNamesNode,
        child(context, "propertyNames"),
        documentId,
      );
    }
    return {
      kind: "object",
      metadata: extractMetadata(node),
      properties: [],
      extensionPoint: true,
      propertyNames,
      maxProperties:
        node.maxProperties === undefined
          ? null
          : requireInteger(node.maxProperties, context, "maxProperties"),
    };
  }

  assertOnlyKeywords(
    node,
    context,
    new Set(["type", "additionalProperties", "required", "properties"]),
  );
  if (node.additionalProperties !== false) {
    fail(
      context,
      'closed objects must declare "additionalProperties": false ' +
        "(open objects are only the marked extension surface)",
    );
  }
  const propertiesNode = node.properties;
  if (propertiesNode !== undefined && !isJsonObject(propertiesNode)) {
    fail(context, "properties must be an object");
  }
  const requiredNode = node.required;
  const required = new Set<string>();
  if (requiredNode !== undefined) {
    if (!Array.isArray(requiredNode)) {
      fail(context, "required must be an array of property names");
    }
    for (const name of requiredNode) {
      if (typeof name !== "string") {
        fail(context, "required entries must be strings");
      }
      required.add(name);
    }
  }
  const properties: IrProperty[] = [];
  const propertyNames = propertiesNode ? Object.keys(propertiesNode) : [];
  for (const name of required) {
    if (!propertyNames.includes(name)) {
      fail(
        context,
        `required property ${JSON.stringify(name)} is not declared under ` +
          "properties",
      );
    }
  }
  for (const name of propertyNames) {
    const value = propertiesNode?.[name];
    const propertyContext = child(context, "properties", name);
    if (value === true) {
      properties.push({
        name,
        required: required.has(name),
        type: {
          kind: "any",
          metadata: {
            title: null,
            description: null,
            comment: null,
            deprecated: false,
            deprecatedSince: null,
            sensitivity: null,
            redaction: null,
          },
        },
      });
      continue;
    }
    if (!isJsonObject(value)) {
      fail(
        propertyContext,
        "property schemas must be objects (or the boolean schema true for " +
          "deliberately opaque payloads)",
      );
    }
    properties.push({
      name,
      required: required.has(name),
      type: extractType(value, propertyContext, documentId),
    });
  }
  return {
    kind: "object",
    metadata: extractMetadata(node),
    properties,
    extensionPoint: false,
    propertyNames: null,
    maxProperties: null,
  };
}

function extractType(
  node: JsonObject,
  context: NodeContext,
  documentId: string,
): IrType {
  if (node.$ref !== undefined) {
    return extractRef(node, context, documentId);
  }
  if (node.anyOf !== undefined) {
    return extractNullable(node, context, documentId);
  }
  if (node.enum !== undefined) {
    return extractEnum(node, context);
  }
  const type = node.type;
  if (type === "string") {
    return extractString(node, context);
  }
  if (type === "number") {
    return extractNumber(node, context);
  }
  if (type === "boolean") {
    return extractBoolean(node, context);
  }
  if (type === "array") {
    return extractArray(node, context, documentId);
  }
  if (type === "object") {
    return extractObject(node, context, documentId);
  }
  fail(
    context,
    type === undefined
      ? "schema node declares no supported construct " +
          "($ref, anyOf-nullability, enum, string, number, boolean, array, " +
          "or object)"
      : `type ${JSON.stringify(type)} is not supported`,
  );
}

const DEF_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

function extractDocument(entry: SchemaCatalogEntry): IrDocument {
  const parsed = parseSchemaId(entry.id);
  if (parsed === null) {
    throw new UnsupportedConstructError(
      entry.relativePath,
      "#",
      "catalog entry id failed to parse after convention checks",
    );
  }
  const context: NodeContext = {
    documentPath: entry.relativePath,
    pointer: "#",
  };
  const title = entry.document.title;
  const description = entry.document.description;
  if (typeof title !== "string" || typeof description !== "string") {
    fail(context, "documents must carry a root title and description");
  }
  const definitions: IrDefinition[] = [];
  const defs = entry.document.$defs;
  if (defs !== undefined) {
    if (!isJsonObject(defs)) {
      fail(context, "$defs must be an object");
    }
    for (const name of Object.keys(defs).sort()) {
      if (!DEF_NAME_PATTERN.test(name)) {
        fail(
          child(context, "$defs", name),
          `$defs name ${JSON.stringify(name)} must be a camelCase identifier`,
        );
      }
      const value = defs[name];
      if (!isJsonObject(value)) {
        fail(
          child(context, "$defs", name),
          "definition schemas must be objects",
        );
      }
      definitions.push({
        name,
        type: extractType(value, child(context, "$defs", name), entry.id),
      });
    }
  }

  // Root payload schema: the document root doubles as a schema when it
  // declares structural keywords beyond identity/metadata/$defs. The
  // identity keywords are stripped from a shallow copy so the type
  // extractor sees a plain schema node.
  const structural = Object.keys(entry.document).filter(
    (key) => !METADATA_KEYWORDS.has(key) && !ROOT_ONLY_KEYWORDS.has(key),
  );
  let root: IrType | null = null;
  if (structural.length > 0) {
    const rootNode: JsonObject = {};
    for (const [key, value] of Object.entries(entry.document)) {
      if (!ROOT_ONLY_KEYWORDS.has(key)) {
        rootNode[key] = value;
      }
    }
    root = extractType(rootNode, context, entry.id);
  }

  return {
    id: entry.id,
    relativePath: entry.relativePath,
    segments: parsed.segments,
    major: parsed.major,
    version: entry.version,
    title,
    description,
    definitions,
    root,
  };
}

/**
 * Resolve every reference in the IR against the extracted documents and
 * fail on danglers (defense in depth behind the catalog checks).
 */
function assertResolvable(documents: readonly IrDocument[]): void {
  const defsById = new Map<string, Set<string>>();
  const rootsById = new Map<string, boolean>();
  for (const document of documents) {
    defsById.set(
      document.id,
      new Set(document.definitions.map((definition) => definition.name)),
    );
    rootsById.set(document.id, document.root !== null);
  }
  const visit = (document: IrDocument, type: IrType, pointer: string): void => {
    if (type.kind === "ref") {
      const targetDefs = defsById.get(type.targetId);
      if (targetDefs === undefined) {
        throw new UnsupportedConstructError(
          document.relativePath,
          pointer,
          `$ref target ${type.targetId} is not a generated catalog document`,
        );
      }
      if (type.targetDef !== null && !targetDefs.has(type.targetDef)) {
        throw new UnsupportedConstructError(
          document.relativePath,
          pointer,
          `$ref target ${type.targetId}#/$defs/${type.targetDef} does not ` +
            "exist",
        );
      }
      if (type.targetDef === null && rootsById.get(type.targetId) !== true) {
        throw new UnsupportedConstructError(
          document.relativePath,
          pointer,
          `$ref target ${type.targetId} has no root payload schema`,
        );
      }
      return;
    }
    if (type.kind === "nullable") {
      visit(document, type.inner, `${pointer}/anyOf`);
      return;
    }
    if (type.kind === "array") {
      visit(document, type.items, `${pointer}/items`);
      return;
    }
    if (type.kind === "object") {
      for (const property of type.properties) {
        visit(
          document,
          property.type,
          `${pointer}/properties/${property.name}`,
        );
      }
      if (type.propertyNames !== null) {
        visit(document, type.propertyNames, `${pointer}/propertyNames`);
      }
    }
  };
  for (const document of documents) {
    for (const definition of document.definitions) {
      visit(document, definition.type, `#/$defs/${definition.name}`);
    }
    if (document.root !== null) {
      visit(document, document.root, "#");
    }
  }
}

function collectIntraDocumentDependencies(
  documentId: string,
  type: IrType,
  out: Set<string>,
): void {
  if (type.kind === "ref") {
    if (type.targetId === documentId && type.targetDef !== null) {
      out.add(type.targetDef);
    }
    return;
  }
  if (type.kind === "nullable") {
    collectIntraDocumentDependencies(documentId, type.inner, out);
    return;
  }
  if (type.kind === "array") {
    collectIntraDocumentDependencies(documentId, type.items, out);
    return;
  }
  if (type.kind === "object") {
    for (const property of type.properties) {
      collectIntraDocumentDependencies(documentId, property.type, out);
    }
    if (type.propertyNames !== null) {
      collectIntraDocumentDependencies(documentId, type.propertyNames, out);
    }
  }
}

/**
 * Order a document's definitions so every intra-document dependency is
 * declared before its dependents (required for Python's eager name
 * resolution; also the readable order). Deterministic: candidates are
 * taken alphabetically; a dependency cycle fails closed.
 */
function orderDefinitions(document: IrDocument): IrDocument {
  const byName = new Map(
    document.definitions.map((definition) => [definition.name, definition]),
  );
  const dependencies = new Map<string, Set<string>>();
  for (const definition of document.definitions) {
    const collected = new Set<string>();
    collectIntraDocumentDependencies(document.id, definition.type, collected);
    collected.delete(definition.name);
    dependencies.set(definition.name, collected);
  }
  const ordered: IrDefinition[] = [];
  const placed = new Set<string>();
  const names = [...byName.keys()].sort();
  while (placed.size < names.length) {
    const ready = names.filter(
      (name) =>
        !placed.has(name) &&
        [...(dependencies.get(name) ?? [])].every(
          (dependency) => placed.has(dependency) || !byName.has(dependency),
        ),
    );
    if (ready.length === 0) {
      const remaining = names.filter((name) => !placed.has(name)).join(", ");
      throw new UnsupportedConstructError(
        document.relativePath,
        "#/$defs",
        `definition dependency cycle among: ${remaining} (recursive types ` +
          "are not supported)",
      );
    }
    for (const name of ready) {
      const definition = byName.get(name);
      if (definition !== undefined) {
        ordered.push(definition);
        placed.add(name);
      }
    }
  }
  return { ...document, definitions: ordered };
}

/**
 * Build the IR catalog from a convention-checked schema catalog. Document
 * order is normalized to sorted `$id` order so emission never depends on
 * filesystem enumeration order, and each document's definitions are
 * dependency-ordered deterministically.
 */
export function buildIrCatalog(catalog: SchemaCatalog): IrCatalog {
  const entries = [...catalog.entries].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const documents = entries.map(extractDocument).map(orderDefinitions);
  assertResolvable(documents);
  return { documents };
}
