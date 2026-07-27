/**
 * Strict Draft 2020-12 validation for the canonical schema catalog (M01-W01).
 *
 * Configuration is fail-closed and offline:
 * - strict mode rejects unknown keywords, so unsupported custom annotations
 *   fail at compile time (only the registered x-japp-* keywords compile);
 * - every registered document is validated against the 2020-12 meta-schema;
 * - format assertions run in full mode (calendar-correct date/date-time);
 * - there is no loader hook, so any reference that leaves the registered
 *   catalog fails instead of being fetched;
 * - no type coercion and no default injection: data validates exactly as
 *   written or not at all;
 * - only own enumerable properties satisfy object schemas, so prototype
 *   inheritance cannot supply required or optional wire members.
 */

import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

// ajv-formats is CommonJS and publishes the plugin both as module.exports and
// as the default export (module.exports = exports = plugin; exports.default =
// plugin). Reading .default resolves the callable identically under Node ESM
// and bundler interop.
const addFormats = addFormatsModule.default;

import type { SchemaCatalog } from "./catalog.ts";
import {
  DEPRECATED_SINCE_KEYWORD,
  EXTENSION_POINT_KEYWORD,
  REDACTION_KEYWORD,
  REDACTION_POLICIES,
  SCHEMA_VERSION_KEYWORD,
  SCHEMA_VERSION_PATTERN,
  SENSITIVITY_CLASSES,
  SENSITIVITY_KEYWORD,
} from "./conventions.ts";

/** Outcome of validating one instance against one schema reference. */
export type InstanceValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly string[] };

/** Compiled, catalog-backed validator. */
export interface ContractValidator {
  /** The underlying Ajv instance (for compile-time negative tests). */
  readonly ajv: Ajv2020;
  /**
   * Validate data against a catalog reference: either a schema $id or a
   * $id plus JSON-pointer fragment (…#/$defs/name). Throws on references
   * that do not resolve inside the registered catalog.
   */
  readonly validateInstance: (
    ref: string,
    data: unknown,
  ) => InstanceValidationResult;
}

function renderError(error: ErrorObject): string {
  const path = error.instancePath === "" ? "/" : error.instancePath;
  const message = error.message ?? "invalid";
  return `${path} ${message}`;
}

/**
 * Build a strict Ajv 2020 instance with the repository's format assertions
 * and registered annotation keywords, without any schemas.
 */
export function buildStrictAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    strict: true,
    strictSchema: true,
    strictNumbers: true,
    strictTypes: true,
    strictTuples: true,
    allowUnionTypes: false,
    validateFormats: true,
    validateSchema: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    ownProperties: true,
    allErrors: true,
    addUsedSchema: false,
  });
  addFormats(ajv, { mode: "full", formats: ["date", "date-time"] });
  ajv.addKeyword({
    keyword: SCHEMA_VERSION_KEYWORD,
    metaSchema: { type: "string", pattern: SCHEMA_VERSION_PATTERN.source },
  });
  ajv.addKeyword({
    keyword: SENSITIVITY_KEYWORD,
    metaSchema: { type: "string", enum: [...SENSITIVITY_CLASSES] },
  });
  ajv.addKeyword({
    keyword: REDACTION_KEYWORD,
    metaSchema: { type: "string", enum: [...REDACTION_POLICIES] },
  });
  ajv.addKeyword({
    keyword: DEPRECATED_SINCE_KEYWORD,
    metaSchema: { type: "string", pattern: SCHEMA_VERSION_PATTERN.source },
  });
  ajv.addKeyword({
    keyword: EXTENSION_POINT_KEYWORD,
    metaSchema: { const: true },
  });
  return ajv;
}

/**
 * Register the complete catalog on a strict Ajv instance and compile every
 * document eagerly so meta-schema, keyword, and reference problems surface
 * deterministically at construction time.
 */
export function createContractValidator(
  catalog: SchemaCatalog,
): ContractValidator {
  const ajv = buildStrictAjv();
  for (const entry of catalog.entries) {
    ajv.addSchema(entry.document, entry.id);
  }
  const compiled = new Map<string, ValidateFunction>();
  const resolve = (ref: string): ValidateFunction => {
    const existing = compiled.get(ref);
    if (existing !== undefined) {
      return existing;
    }
    const fn = ajv.getSchema(ref);
    if (fn === undefined) {
      throw new Error(
        `schema reference ${JSON.stringify(ref)} does not resolve inside ` +
          `the registered catalog`,
      );
    }
    compiled.set(ref, fn);
    return fn;
  };
  for (const entry of catalog.entries) {
    resolve(entry.id);
  }
  const validateInstance = (
    ref: string,
    data: unknown,
  ): InstanceValidationResult => {
    const fn = resolve(ref);
    if (fn(data)) {
      return { valid: true };
    }
    const errors = (fn.errors ?? []).map(renderError);
    return { valid: false, errors };
  };
  return { ajv, validateInstance };
}
