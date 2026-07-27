/**
 * Two-phase enveloped-record validation (M01-W01).
 *
 * Phase 1 validates the envelope shape against
 * urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord. Phase 2 resolves
 * the payload schema by envelope.schema_id in the catalog, applies the
 * version-compatibility policy to envelope.schema_version, and validates the
 * payload against the current catalog schema. Every failure is a typed,
 * fail-closed outcome — nothing is coerced, defaulted, or guessed.
 */

import type { SchemaCatalog } from "./catalog.js";
import { isJsonObject, type JsonObject } from "./json.js";
import type { ContractValidator } from "./validator.js";
import { evaluateVersionCompatibility } from "./versioning.js";

/** Catalog reference of the enveloped-record shape. */
export const ENVELOPED_RECORD_REF =
  "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord";

export type EnvelopeValidationResult =
  | {
      readonly valid: true;
      readonly schemaId: string;
      readonly declaredVersion: string;
    }
  | {
      readonly valid: false;
      readonly reason: "ENVELOPE_INVALID";
      readonly errors: readonly string[];
    }
  | {
      readonly valid: false;
      readonly reason: "UNKNOWN_SCHEMA_ID";
      readonly schemaId: string;
    }
  | {
      readonly valid: false;
      readonly reason: "UNKNOWN_MAJOR_VERSION" | "UPGRADE_REQUIRED_NEWER_MINOR";
      readonly schemaId: string;
      readonly declaredVersion: string;
      readonly supportedVersion: string;
    }
  | {
      readonly valid: false;
      readonly reason: "PAYLOAD_INVALID";
      readonly schemaId: string;
      readonly errors: readonly string[];
    };

function renderTriple(triple: {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}): string {
  return `${String(triple.major)}.${String(triple.minor)}.${String(triple.patch)}`;
}

/**
 * Validate one enveloped record end to end. The record's payload is accepted
 * only when the envelope is valid, the payload schema is a committed catalog
 * schema, the declared version is compatible under the documented policy,
 * and the payload validates against the current schema.
 */
export function validateEnvelopedRecord(
  record: unknown,
  dependencies: {
    readonly catalog: SchemaCatalog;
    readonly validator: ContractValidator;
  },
): EnvelopeValidationResult {
  const { catalog, validator } = dependencies;
  const envelopeResult = validator.validateInstance(
    ENVELOPED_RECORD_REF,
    record,
  );
  if (!envelopeResult.valid) {
    return {
      valid: false,
      reason: "ENVELOPE_INVALID",
      errors: envelopeResult.errors,
    };
  }
  const recordObject = record as JsonObject;
  const envelope = recordObject.envelope;
  if (!isJsonObject(envelope)) {
    return {
      valid: false,
      reason: "ENVELOPE_INVALID",
      errors: ["/envelope envelope metadata must be an object"],
    };
  }
  const schemaId = envelope.schema_id;
  const declaredVersion = envelope.schema_version;
  if (typeof schemaId !== "string" || typeof declaredVersion !== "string") {
    return {
      valid: false,
      reason: "ENVELOPE_INVALID",
      errors: ["/envelope schema_id and schema_version must be strings"],
    };
  }
  const entry = catalog.byId.get(schemaId);
  if (entry === undefined) {
    return { valid: false, reason: "UNKNOWN_SCHEMA_ID", schemaId };
  }
  const compatibility = evaluateVersionCompatibility(
    declaredVersion,
    entry.version,
  );
  if (compatibility.outcome === "REJECTED_MALFORMED") {
    return {
      valid: false,
      reason: "ENVELOPE_INVALID",
      errors: [
        "/envelope/schema_version malformed version escaped envelope validation",
      ],
    };
  }
  if (compatibility.outcome === "REJECTED_UNKNOWN_MAJOR") {
    return {
      valid: false,
      reason: "UNKNOWN_MAJOR_VERSION",
      schemaId,
      declaredVersion,
      supportedVersion: renderTriple(entry.version),
    };
  }
  if (compatibility.outcome === "UPGRADE_REQUIRED_NEWER_MINOR") {
    return {
      valid: false,
      reason: "UPGRADE_REQUIRED_NEWER_MINOR",
      schemaId,
      declaredVersion,
      supportedVersion: renderTriple(entry.version),
    };
  }
  const payloadResult = validator.validateInstance(
    schemaId,
    recordObject.payload,
  );
  if (!payloadResult.valid) {
    return {
      valid: false,
      reason: "PAYLOAD_INVALID",
      schemaId,
      errors: payloadResult.errors,
    };
  }
  return { valid: true, schemaId, declaredVersion };
}
