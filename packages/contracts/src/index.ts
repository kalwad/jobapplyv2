/**
 * @japp/contracts — canonical JSON Schema source and validation conventions.
 *
 * M01-W01 owns the hand-authored Draft 2020-12 schema source under schemas/,
 * the identifier/versioning conventions, and this strict offline validation
 * layer. Generated TypeScript/Python models are exclusively M01-W02 and do
 * not exist yet.
 */
export const PACKAGE_NAME = "@japp/contracts";

export {
  ANNOTATION_KEYWORDS,
  DEPRECATED_SINCE_KEYWORD,
  ENUM_TOKEN_PATTERN,
  EXTENSION_KEY_PATTERN,
  EXTENSION_POINT_KEYWORD,
  JSON_SCHEMA_DIALECT,
  PROHIBITED_KEYWORDS,
  REDACTION_KEYWORD,
  REDACTION_POLICIES,
  SCHEMA_ID_PATTERN,
  SCHEMA_VERSION_KEYWORD,
  SCHEMA_VERSION_PATTERN,
  SENSITIVITY_CLASSES,
  SENSITIVITY_KEYWORD,
  checkSchemaCatalogDocuments,
  checkSchemaDocument,
  collectRefs,
  expectedIdForPath,
  parseSchemaId,
  parseSchemaVersion,
  walkSchemaNodes,
} from "./conventions.ts";
export type {
  CollectedRef,
  ParsedSchemaId,
  SchemaDocumentInput,
  SchemaVersionTriple,
} from "./conventions.ts";
export {
  DEFAULT_SCHEMAS_ROOT,
  SchemaCatalogError,
  loadSchemaCatalog,
} from "./catalog.ts";
export type { SchemaCatalog, SchemaCatalogEntry } from "./catalog.ts";
export { isJsonObject } from "./json.ts";
export type { JsonObject, JsonValue } from "./json.ts";
export { buildStrictAjv, createContractValidator } from "./validator.ts";
export type {
  ContractValidator,
  InstanceValidationResult,
} from "./validator.ts";
export { evaluateVersionCompatibility } from "./versioning.ts";
export type {
  VersionCompatibility,
  VersionCompatibilityOutcome,
} from "./versioning.ts";
export { ENVELOPED_RECORD_REF, validateEnvelopedRecord } from "./envelope.ts";
export type { EnvelopeValidationResult } from "./envelope.ts";
