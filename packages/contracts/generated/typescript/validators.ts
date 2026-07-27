/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/ (complete catalog)
 * Schema id: typed validation wrappers
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import {
  createContractValidator,
  loadSchemaCatalog,
  type ContractValidator,
  type SchemaCatalog,
} from "../../src/index.ts";
import type {
  CommonCalendarDateV1CalendarDate,
} from "./common/calendar-date.v1.ts";
import type {
  CommonConfidenceV1Confidence,
} from "./common/confidence.v1.ts";
import type {
  CommonCorrelationV1CausationId,
  CommonCorrelationV1CorrelationId,
} from "./common/correlation.v1.ts";
import type {
  CommonEnumTokenV1EnumToken,
} from "./common/enum-token.v1.ts";
import type {
  CommonEnvelopeV1EnvelopeMetadata,
  CommonEnvelopeV1EnvelopedRecord,
  CommonEnvelopeV1ExtensionKey,
  CommonEnvelopeV1Extensions,
} from "./common/envelope.v1.ts";
import type {
  CommonLocationV1CountryCode,
  CommonLocationV1StructuredLocation,
} from "./common/location.v1.ts";
import type {
  CommonMoneyV1CurrencyCode,
  CommonMoneyV1DecimalAmount,
  CommonMoneyV1Money,
} from "./common/money.v1.ts";
import type {
  CommonProvenanceV1ContentDigest,
  CommonProvenanceV1Provenance,
  CommonProvenanceV1SourceKind,
} from "./common/provenance.v1.ts";
import type {
  CommonRedactionV1RedactionAnnotation,
  CommonRedactionV1RedactionPolicy,
  CommonRedactionV1SensitivityClass,
} from "./common/redaction.v1.ts";
import type {
  CommonSchemaVersionV1SchemaId,
  CommonSchemaVersionV1SchemaVersion,
} from "./common/schema-version.v1.ts";
import type {
  CommonStableIdV1IdPrefix,
  CommonStableIdV1StableId,
} from "./common/stable-id.v1.ts";
import type {
  CommonTimestampUtcV1UtcTimestamp,
} from "./common/timestamp-utc.v1.ts";
import type {
  ErrorCatalogV1,
  ErrorCatalogV1CatalogEntry,
} from "./error/catalog.v1.ts";
import type {
  ErrorRecordV1,
} from "./error/record.v1.ts";
import type {
  ErrorTaxonomyV1ErrorCode,
  ErrorTaxonomyV1ErrorFamily,
  ErrorTaxonomyV1ErrorOrigin,
  ErrorTaxonomyV1ErrorSeverity,
  ErrorTaxonomyV1MessageKey,
  ErrorTaxonomyV1RetryDisposition,
  ErrorTaxonomyV1UserSafeMessage,
} from "./error/taxonomy.v1.ts";
import type {
  FixtureTestRecordV1,
} from "./fixture/test-record.v1.ts";

/**
 * Typed validation outcome. Failures preserve the structured error list
 * produced by the canonical validator (instance path plus message); nothing
 * is coerced, defaulted, or removed on either path.
 */
export type ContractValidationOutcome<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly errors: readonly string[] };

/**
 * Generated mapping from catalog schema reference to generated type
 * identity. Only meaningful references appear: every $defs entry plus the
 * root payload schema of documents that declare one. A definitions-only
 * document id is deliberately absent — its bare id compiles to an
 * unconstrained schema and validating against it would be meaningless.
 */
export interface GeneratedTypeByRef {
  readonly "urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate": CommonCalendarDateV1CalendarDate;
  readonly "urn:japp:schema:common:confidence:v1#/$defs/confidence": CommonConfidenceV1Confidence;
  readonly "urn:japp:schema:common:correlation:v1#/$defs/causationId": CommonCorrelationV1CausationId;
  readonly "urn:japp:schema:common:correlation:v1#/$defs/correlationId": CommonCorrelationV1CorrelationId;
  readonly "urn:japp:schema:common:enum-token:v1#/$defs/enumToken": CommonEnumTokenV1EnumToken;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata": CommonEnvelopeV1EnvelopeMetadata;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord": CommonEnvelopeV1EnvelopedRecord;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/extensionKey": CommonEnvelopeV1ExtensionKey;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/extensions": CommonEnvelopeV1Extensions;
  readonly "urn:japp:schema:common:location:v1#/$defs/countryCode": CommonLocationV1CountryCode;
  readonly "urn:japp:schema:common:location:v1#/$defs/structuredLocation": CommonLocationV1StructuredLocation;
  readonly "urn:japp:schema:common:money:v1#/$defs/currencyCode": CommonMoneyV1CurrencyCode;
  readonly "urn:japp:schema:common:money:v1#/$defs/decimalAmount": CommonMoneyV1DecimalAmount;
  readonly "urn:japp:schema:common:money:v1#/$defs/money": CommonMoneyV1Money;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/contentDigest": CommonProvenanceV1ContentDigest;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/provenance": CommonProvenanceV1Provenance;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/sourceKind": CommonProvenanceV1SourceKind;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation": CommonRedactionV1RedactionAnnotation;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy": CommonRedactionV1RedactionPolicy;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass": CommonRedactionV1SensitivityClass;
  readonly "urn:japp:schema:common:schema-version:v1#/$defs/schemaId": CommonSchemaVersionV1SchemaId;
  readonly "urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion": CommonSchemaVersionV1SchemaVersion;
  readonly "urn:japp:schema:common:stable-id:v1#/$defs/idPrefix": CommonStableIdV1IdPrefix;
  readonly "urn:japp:schema:common:stable-id:v1#/$defs/stableId": CommonStableIdV1StableId;
  readonly "urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp": CommonTimestampUtcV1UtcTimestamp;
  readonly "urn:japp:schema:error:catalog:v1": ErrorCatalogV1;
  readonly "urn:japp:schema:error:catalog:v1#/$defs/catalogEntry": ErrorCatalogV1CatalogEntry;
  readonly "urn:japp:schema:error:record:v1": ErrorRecordV1;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorCode": ErrorTaxonomyV1ErrorCode;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily": ErrorTaxonomyV1ErrorFamily;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin": ErrorTaxonomyV1ErrorOrigin;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity": ErrorTaxonomyV1ErrorSeverity;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/messageKey": ErrorTaxonomyV1MessageKey;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition": ErrorTaxonomyV1RetryDisposition;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage": ErrorTaxonomyV1UserSafeMessage;
  readonly "urn:japp:schema:fixture:test-record:v1": FixtureTestRecordV1;
}

/** Every generated catalog reference, sorted. */
export const CONTRACT_SCHEMA_REFS: readonly (keyof GeneratedTypeByRef)[] = [
  "urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate",
  "urn:japp:schema:common:confidence:v1#/$defs/confidence",
  "urn:japp:schema:common:correlation:v1#/$defs/causationId",
  "urn:japp:schema:common:correlation:v1#/$defs/correlationId",
  "urn:japp:schema:common:enum-token:v1#/$defs/enumToken",
  "urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata",
  "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord",
  "urn:japp:schema:common:envelope:v1#/$defs/extensionKey",
  "urn:japp:schema:common:envelope:v1#/$defs/extensions",
  "urn:japp:schema:common:location:v1#/$defs/countryCode",
  "urn:japp:schema:common:location:v1#/$defs/structuredLocation",
  "urn:japp:schema:common:money:v1#/$defs/currencyCode",
  "urn:japp:schema:common:money:v1#/$defs/decimalAmount",
  "urn:japp:schema:common:money:v1#/$defs/money",
  "urn:japp:schema:common:provenance:v1#/$defs/contentDigest",
  "urn:japp:schema:common:provenance:v1#/$defs/provenance",
  "urn:japp:schema:common:provenance:v1#/$defs/sourceKind",
  "urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation",
  "urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy",
  "urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass",
  "urn:japp:schema:common:schema-version:v1#/$defs/schemaId",
  "urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion",
  "urn:japp:schema:common:stable-id:v1#/$defs/idPrefix",
  "urn:japp:schema:common:stable-id:v1#/$defs/stableId",
  "urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp",
  "urn:japp:schema:error:catalog:v1",
  "urn:japp:schema:error:catalog:v1#/$defs/catalogEntry",
  "urn:japp:schema:error:record:v1",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorCode",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity",
  "urn:japp:schema:error:taxonomy:v1#/$defs/messageKey",
  "urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition",
  "urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage",
  "urn:japp:schema:fixture:test-record:v1",
];

let runtimeSingleton: {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} | null = null;

/**
 * Lazily construct the canonical strict validator (M01-W01 catalog loader
 * plus Ajv 2020 in strict offline mode). The generated layer never
 * re-implements or weakens validation rules — runtime truth stays in the
 * hand-authored canonical layer.
 */
export function contractRuntime(): {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} {
  if (runtimeSingleton === null) {
    const catalog = loadSchemaCatalog();
    runtimeSingleton = {
      catalog,
      validator: createContractValidator(catalog),
    };
  }
  return runtimeSingleton;
}

/**
 * Validate unknown input against a known catalog reference. Unknown
 * references are unrepresentable in the type system and throw at runtime
 * inside the canonical validator (fail closed, never guess).
 */
export function validateContractInstance<R extends keyof GeneratedTypeByRef>(
  ref: R,
  data: unknown,
): ContractValidationOutcome<GeneratedTypeByRef[R]> {
  const result = contractRuntime().validator.validateInstance(ref, data);
  if (result.valid) {
    return { valid: true, value: data as GeneratedTypeByRef[R] };
  }
  return { valid: false, errors: result.errors };
}

/**
 * Validate unknown input against urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCalendarDateV1CalendarDate type only after validation succeeds.
 */
export function validateCommonCalendarDateV1CalendarDate(
  data: unknown,
): ContractValidationOutcome<CommonCalendarDateV1CalendarDate> {
  return validateContractInstance("urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:confidence:v1#/$defs/confidence
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonConfidenceV1Confidence type only after validation succeeds.
 */
export function validateCommonConfidenceV1Confidence(
  data: unknown,
): ContractValidationOutcome<CommonConfidenceV1Confidence> {
  return validateContractInstance("urn:japp:schema:common:confidence:v1#/$defs/confidence", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:correlation:v1#/$defs/causationId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCorrelationV1CausationId type only after validation succeeds.
 */
export function validateCommonCorrelationV1CausationId(
  data: unknown,
): ContractValidationOutcome<CommonCorrelationV1CausationId> {
  return validateContractInstance("urn:japp:schema:common:correlation:v1#/$defs/causationId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:correlation:v1#/$defs/correlationId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCorrelationV1CorrelationId type only after validation succeeds.
 */
export function validateCommonCorrelationV1CorrelationId(
  data: unknown,
): ContractValidationOutcome<CommonCorrelationV1CorrelationId> {
  return validateContractInstance("urn:japp:schema:common:correlation:v1#/$defs/correlationId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:enum-token:v1#/$defs/enumToken
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnumTokenV1EnumToken type only after validation succeeds.
 */
export function validateCommonEnumTokenV1EnumToken(
  data: unknown,
): ContractValidationOutcome<CommonEnumTokenV1EnumToken> {
  return validateContractInstance("urn:japp:schema:common:enum-token:v1#/$defs/enumToken", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1EnvelopeMetadata type only after validation succeeds.
 */
export function validateCommonEnvelopeV1EnvelopeMetadata(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1EnvelopeMetadata> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1EnvelopedRecord type only after validation succeeds.
 */
export function validateCommonEnvelopeV1EnvelopedRecord(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1EnvelopedRecord> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/extensionKey
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1ExtensionKey type only after validation succeeds.
 */
export function validateCommonEnvelopeV1ExtensionKey(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1ExtensionKey> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/extensionKey", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/extensions
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1Extensions type only after validation succeeds.
 */
export function validateCommonEnvelopeV1Extensions(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1Extensions> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/extensions", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:location:v1#/$defs/countryCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonLocationV1CountryCode type only after validation succeeds.
 */
export function validateCommonLocationV1CountryCode(
  data: unknown,
): ContractValidationOutcome<CommonLocationV1CountryCode> {
  return validateContractInstance("urn:japp:schema:common:location:v1#/$defs/countryCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:location:v1#/$defs/structuredLocation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonLocationV1StructuredLocation type only after validation succeeds.
 */
export function validateCommonLocationV1StructuredLocation(
  data: unknown,
): ContractValidationOutcome<CommonLocationV1StructuredLocation> {
  return validateContractInstance("urn:japp:schema:common:location:v1#/$defs/structuredLocation", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/currencyCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1CurrencyCode type only after validation succeeds.
 */
export function validateCommonMoneyV1CurrencyCode(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1CurrencyCode> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/currencyCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/decimalAmount
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1DecimalAmount type only after validation succeeds.
 */
export function validateCommonMoneyV1DecimalAmount(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1DecimalAmount> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/decimalAmount", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/money
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1Money type only after validation succeeds.
 */
export function validateCommonMoneyV1Money(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1Money> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/money", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/contentDigest
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1ContentDigest type only after validation succeeds.
 */
export function validateCommonProvenanceV1ContentDigest(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1ContentDigest> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/contentDigest", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/provenance
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1Provenance type only after validation succeeds.
 */
export function validateCommonProvenanceV1Provenance(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1Provenance> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/provenance", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/sourceKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1SourceKind type only after validation succeeds.
 */
export function validateCommonProvenanceV1SourceKind(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1SourceKind> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/sourceKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1RedactionAnnotation type only after validation succeeds.
 */
export function validateCommonRedactionV1RedactionAnnotation(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1RedactionAnnotation> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1RedactionPolicy type only after validation succeeds.
 */
export function validateCommonRedactionV1RedactionPolicy(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1RedactionPolicy> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1SensitivityClass type only after validation succeeds.
 */
export function validateCommonRedactionV1SensitivityClass(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1SensitivityClass> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:schema-version:v1#/$defs/schemaId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonSchemaVersionV1SchemaId type only after validation succeeds.
 */
export function validateCommonSchemaVersionV1SchemaId(
  data: unknown,
): ContractValidationOutcome<CommonSchemaVersionV1SchemaId> {
  return validateContractInstance("urn:japp:schema:common:schema-version:v1#/$defs/schemaId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonSchemaVersionV1SchemaVersion type only after validation succeeds.
 */
export function validateCommonSchemaVersionV1SchemaVersion(
  data: unknown,
): ContractValidationOutcome<CommonSchemaVersionV1SchemaVersion> {
  return validateContractInstance("urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:stable-id:v1#/$defs/idPrefix
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonStableIdV1IdPrefix type only after validation succeeds.
 */
export function validateCommonStableIdV1IdPrefix(
  data: unknown,
): ContractValidationOutcome<CommonStableIdV1IdPrefix> {
  return validateContractInstance("urn:japp:schema:common:stable-id:v1#/$defs/idPrefix", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:stable-id:v1#/$defs/stableId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonStableIdV1StableId type only after validation succeeds.
 */
export function validateCommonStableIdV1StableId(
  data: unknown,
): ContractValidationOutcome<CommonStableIdV1StableId> {
  return validateContractInstance("urn:japp:schema:common:stable-id:v1#/$defs/stableId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonTimestampUtcV1UtcTimestamp type only after validation succeeds.
 */
export function validateCommonTimestampUtcV1UtcTimestamp(
  data: unknown,
): ContractValidationOutcome<CommonTimestampUtcV1UtcTimestamp> {
  return validateContractInstance("urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:catalog:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorCatalogV1 type only after validation succeeds.
 */
export function validateErrorCatalogV1(
  data: unknown,
): ContractValidationOutcome<ErrorCatalogV1> {
  return validateContractInstance("urn:japp:schema:error:catalog:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:catalog:v1#/$defs/catalogEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorCatalogV1CatalogEntry type only after validation succeeds.
 */
export function validateErrorCatalogV1CatalogEntry(
  data: unknown,
): ContractValidationOutcome<ErrorCatalogV1CatalogEntry> {
  return validateContractInstance("urn:japp:schema:error:catalog:v1#/$defs/catalogEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorRecordV1 type only after validation succeeds.
 */
export function validateErrorRecordV1(
  data: unknown,
): ContractValidationOutcome<ErrorRecordV1> {
  return validateContractInstance("urn:japp:schema:error:record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorCode type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorCode(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorCode> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorFamily type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorFamily(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorFamily> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorOrigin type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorOrigin(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorOrigin> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorSeverity type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorSeverity(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorSeverity> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/messageKey
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1MessageKey type only after validation succeeds.
 */
export function validateErrorTaxonomyV1MessageKey(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1MessageKey> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/messageKey", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1RetryDisposition type only after validation succeeds.
 */
export function validateErrorTaxonomyV1RetryDisposition(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1RetryDisposition> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1UserSafeMessage type only after validation succeeds.
 */
export function validateErrorTaxonomyV1UserSafeMessage(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1UserSafeMessage> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage", data);
}

/**
 * Validate unknown input against urn:japp:schema:fixture:test-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FixtureTestRecordV1 type only after validation succeeds.
 */
export function validateFixtureTestRecordV1(
  data: unknown,
): ContractValidationOutcome<FixtureTestRecordV1> {
  return validateContractInstance("urn:japp:schema:fixture:test-record:v1", data);
}
