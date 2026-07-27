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
} from "./conventions.js";
export type {
  CollectedRef,
  ParsedSchemaId,
  SchemaDocumentInput,
  SchemaVersionTriple,
} from "./conventions.js";
export {
  DEFAULT_SCHEMAS_ROOT,
  SchemaCatalogError,
  loadSchemaCatalog,
} from "./catalog.js";
export type { SchemaCatalog, SchemaCatalogEntry } from "./catalog.js";
export { isJsonObject } from "./json.js";
export type { JsonObject, JsonValue } from "./json.js";
export { buildStrictAjv, createContractValidator } from "./validator.js";
export type {
  ContractValidator,
  InstanceValidationResult,
} from "./validator.js";
export { evaluateVersionCompatibility } from "./versioning.js";
export type {
  VersionCompatibility,
  VersionCompatibilityOutcome,
} from "./versioning.js";
export { ENVELOPED_RECORD_REF, validateEnvelopedRecord } from "./envelope.js";
export type { EnvelopeValidationResult } from "./envelope.js";
