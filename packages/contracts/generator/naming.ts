/**
 * Deterministic identity mapping for generated contracts (M01-W02).
 *
 * Every generated artifact name derives from the schema catalog identity
 * alone: URN segments (already constrained to lowercase kebab-case by the
 * M01-W01 conventions), the pinned major version, and the camelCase $defs
 * name. No environment data, hashing, or insertion order participates, so
 * the mapping is stable across machines and regenerations, and collisions
 * are structurally impossible while identifiers stay unique.
 */

import type { IrDocument } from "./ir.ts";

const KEBAB_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DEF_NAME = /^[a-z][A-Za-z0-9]*$/;

/** PascalCase one kebab-case URN segment: "stable-id" -> "StableId". */
function pascalFromKebab(segment: string): string {
  if (!KEBAB_SEGMENT.test(segment)) {
    throw new Error(
      `cannot derive a generated name from segment ${JSON.stringify(segment)}`,
    );
  }
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Snake_case one kebab-case URN segment: "stable-id" -> "stable_id". */
export function snakeFromKebab(segment: string): string {
  if (!KEBAB_SEGMENT.test(segment)) {
    throw new Error(
      `cannot derive a python module name from ${JSON.stringify(segment)}`,
    );
  }
  return segment.replaceAll("-", "_");
}

/** PascalCase a camelCase $defs name: "decimalAmount" -> "DecimalAmount". */
function pascalFromCamel(name: string): string {
  if (!DEF_NAME.test(name)) {
    throw new Error(
      `cannot derive a generated name from $defs name ${JSON.stringify(name)}`,
    );
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Fully-qualified generated type name for a document, e.g.
 * common/money v1 -> "CommonMoneyV1". Shared by TypeScript and Python so
 * the cross-language identity is one string.
 */
export function documentTypePrefix(document: IrDocument): string {
  return (
    document.segments.map(pascalFromKebab).join("") +
    `V${String(document.major)}`
  );
}

/** Generated type name for one $defs entry, or the root when def is null. */
export function typeName(document: IrDocument, def: string | null): string {
  const prefix = documentTypePrefix(document);
  return def === null ? prefix : prefix + pascalFromCamel(def);
}

/**
 * TypeScript module path (POSIX, relative to the typescript output root)
 * mirroring the schema layout: common/money.v1.schema.json -> common/money.v1.ts.
 */
export function typescriptModulePath(document: IrDocument): string {
  const directories = document.segments.slice(0, -1);
  const name = document.segments[document.segments.length - 1];
  if (name === undefined) {
    throw new Error(`document ${document.id} has no name segment`);
  }
  return [...directories, `${name}.v${String(document.major)}.ts`].join("/");
}

/**
 * Python module path (POSIX, relative to the python source root), e.g.
 * common/stable-id v1 -> japp_contracts/common/stable_id_v1.py.
 */
export function pythonModulePath(document: IrDocument): string {
  const directories = document.segments.slice(0, -1).map(snakeFromKebab);
  const name = document.segments[document.segments.length - 1];
  if (name === undefined) {
    throw new Error(`document ${document.id} has no name segment`);
  }
  return [
    "japp_contracts",
    ...directories,
    `${snakeFromKebab(name)}_v${String(document.major)}.py`,
  ].join("/");
}

/** Dotted Python module name for imports, derived from the module path. */
export function pythonModuleName(document: IrDocument): string {
  return pythonModulePath(document).replace(/\.py$/, "").replaceAll("/", ".");
}

/** Catalog reference string for a document root or one of its $defs. */
export function schemaRef(document: IrDocument, def: string | null): string {
  return def === null ? document.id : `${document.id}#/$defs/${def}`;
}
