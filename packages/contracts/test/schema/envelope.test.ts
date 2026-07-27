import { describe, expect, it } from "vitest";

import {
  createContractValidator,
  ENVELOPED_RECORD_REF,
  evaluateVersionCompatibility,
  loadSchemaCatalog,
  validateEnvelopedRecord,
  type JsonObject,
} from "../../src/index.ts";

const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);
const dependencies = { catalog, validator };

const FIXTURE_SCHEMA_ID = "urn:japp:schema:fixture:test-record:v1";

function envelope(overrides: JsonObject = {}): JsonObject {
  return {
    schema_id: FIXTURE_SCHEMA_ID,
    schema_version: "1.1.0",
    message_id: "msg_01BX5ZZKBKACTAV9WEVGEMMVRZ",
    created_at: "2026-07-26T12:00:00Z",
    ...overrides,
  };
}

function payload(overrides: JsonObject = {}): JsonObject {
  return {
    record_id: "rec_01BX5ZZKBKACTAV9WEVGEMMVRZ",
    captured_at: "2026-07-26T11:59:59Z",
    effective_date: "2026-08-01",
    budget: { amount: "120000.00", currency: "USD" },
    location: { country: "US", region: "California", locality: "San Jose" },
    provenance: {
      source_kind: "USER_INPUT",
      source_id: "src_01BX5ZZKBKACTAV9WEVGEMMVRZ",
      observed_at: "2026-07-26T11:58:00Z",
    },
    match_confidence: 0.93,
    redaction: { sensitivity: "PERSONAL", policy: "REDACT_VALUE" },
    status: "ACTIVE",
    superseded_by: null,
    ...overrides,
  };
}

function record(
  envelopeOverrides: JsonObject = {},
  payloadOverrides: JsonObject = {},
): JsonObject {
  return {
    envelope: envelope(envelopeOverrides),
    payload: payload(payloadOverrides),
  };
}

describe("composition fixture", () => {
  it("composes the shared definitions and envelope into one valid record", () => {
    const result = validateEnvelopedRecord(record(), dependencies);
    expect(result).toEqual({
      valid: true,
      schemaId: FIXTURE_SCHEMA_ID,
      declaredVersion: "1.1.0",
    });
  });

  it("accepts an instance that also uses the optional and deprecated members", () => {
    const result = validateEnvelopedRecord(
      record(
        {},
        {
          note: "synthetic fixture note",
          legacy_tag: "fixture-tag",
          superseded_by: "rec_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        },
      ),
      dependencies,
    );
    expect(result.valid).toBe(true);
  });
});

describe("envelope metadata", () => {
  it("requires schema identity, version, message identity, and creation time", () => {
    for (const required of [
      "schema_id",
      "schema_version",
      "message_id",
      "created_at",
    ]) {
      const envelopeObject = Object.fromEntries(
        Object.entries(envelope()).filter(([key]) => key !== required),
      );
      const result = validateEnvelopedRecord(
        { envelope: envelopeObject, payload: payload() },
        dependencies,
      );
      expect(result.valid, required).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("ENVELOPE_INVALID");
      }
    }
  });

  it("supports correlation and causation identifiers", () => {
    const result = validateEnvelopedRecord(
      record({
        correlation_id: "cor_01BX5ZZKBKACTAV9WEVGEMMVRZ",
        causation_id: "cse_01BX5ZZKBKACTAV9WEVGEMMVRZ",
      }),
      dependencies,
    );
    expect(result.valid).toBe(true);

    const malformed = validateEnvelopedRecord(
      record({ correlation_id: "not-a-stable-id" }),
      dependencies,
    );
    expect(malformed.valid).toBe(false);
  });

  it("rejects unknown envelope properties because the envelope is closed", () => {
    const result = validateEnvelopedRecord(
      record({ routing_hint: "priority" }),
      dependencies,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("ENVELOPE_INVALID");
    }
  });

  it("rejects non-UTC creation times", () => {
    const result = validateEnvelopedRecord(
      record({ created_at: "2026-07-26T12:00:00+02:00" }),
      dependencies,
    );
    expect(result.valid).toBe(false);
  });
});

describe("explicit extension mechanism", () => {
  it("accepts namespaced extension keys with opaque values", () => {
    const result = validateEnvelopedRecord(
      record({
        extensions: {
          "x-vendor-tag": { nested: [1, 2, 3] },
          "x-trace": "opaque",
        },
      }),
      dependencies,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects extension keys outside the namespaced grammar", () => {
    for (const badKey of ["vendor-tag", "X-Vendor", "x-Vendor", "x_", "x-"]) {
      const result = validateEnvelopedRecord(
        record({ extensions: { [badKey]: true } }),
        dependencies,
      );
      expect(result.valid, badKey).toBe(false);
    }
  });

  it("does not open closed objects: unknown data is rejected outside the extension surface", () => {
    const viaPayload = validateEnvelopedRecord(
      record({}, { unknown_field: "surprise" }),
      dependencies,
    );
    expect(viaPayload.valid).toBe(false);
    if (!viaPayload.valid) {
      expect(viaPayload.reason).toBe("PAYLOAD_INVALID");
    }

    const viaMoney = validateEnvelopedRecord(
      record({}, { budget: { amount: "1.00", currency: "USD", "x-hint": 1 } }),
      dependencies,
    );
    expect(viaMoney.valid).toBe(false);
  });
});

describe("version compatibility policy", () => {
  it("accepts the exact supported version and documented older minors", () => {
    expect(
      validateEnvelopedRecord(record({ schema_version: "1.1.0" }), dependencies)
        .valid,
    ).toBe(true);
    // A 1.0.0 producer never wrote note/legacy_tag; minors are additive-only,
    // so its instances stay valid against the current 1.1.0 schema.
    const olderMinor = validateEnvelopedRecord(
      { envelope: envelope({ schema_version: "1.0.0" }), payload: payload() },
      dependencies,
    );
    expect(olderMinor).toEqual({
      valid: true,
      schemaId: FIXTURE_SCHEMA_ID,
      declaredVersion: "1.0.0",
    });
  });

  it("ignores patch differences for acceptance", () => {
    const patchOnly = validateEnvelopedRecord(
      record({ schema_version: "1.1.9" }),
      dependencies,
    );
    expect(patchOnly.valid).toBe(true);
  });

  it("fails closed with an upgrade signal on newer minors", () => {
    const result = validateEnvelopedRecord(
      record({ schema_version: "1.2.0" }),
      dependencies,
    );
    expect(result).toEqual({
      valid: false,
      reason: "UPGRADE_REQUIRED_NEWER_MINOR",
      schemaId: FIXTURE_SCHEMA_ID,
      declaredVersion: "1.2.0",
      supportedVersion: "1.1.0",
    });
  });

  it("rejects unknown major versions outright", () => {
    for (const major of ["2.0.0", "0.9.0"]) {
      const result = validateEnvelopedRecord(
        record({ schema_version: major }),
        dependencies,
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("UNKNOWN_MAJOR_VERSION");
      }
    }
  });

  it("rejects malformed declared versions at the envelope boundary", () => {
    for (const bad of ["1.1", "1", "1.1.0-beta", "latest"]) {
      const result = validateEnvelopedRecord(
        record({ schema_version: bad }),
        dependencies,
      );
      expect(result.valid, bad).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("ENVELOPE_INVALID");
      }
    }
  });

  it("rejects payload schemas that are not committed catalog schemas", () => {
    const result = validateEnvelopedRecord(
      record({ schema_id: "urn:japp:schema:fixture:unknown-record:v1" }),
      dependencies,
    );
    expect(result).toEqual({
      valid: false,
      reason: "UNKNOWN_SCHEMA_ID",
      schemaId: "urn:japp:schema:fixture:unknown-record:v1",
    });
  });

  it("evaluates version compatibility deterministically at the unit level", () => {
    const supported = { major: 1, minor: 1, patch: 0 };
    expect(evaluateVersionCompatibility("1.1.0", supported).outcome).toBe(
      "COMPATIBLE",
    );
    expect(evaluateVersionCompatibility("1.0.5", supported).outcome).toBe(
      "COMPATIBLE",
    );
    expect(evaluateVersionCompatibility("1.1.9", supported).outcome).toBe(
      "COMPATIBLE",
    );
    expect(evaluateVersionCompatibility("1.2.0", supported).outcome).toBe(
      "UPGRADE_REQUIRED_NEWER_MINOR",
    );
    expect(evaluateVersionCompatibility("2.0.0", supported).outcome).toBe(
      "REJECTED_UNKNOWN_MAJOR",
    );
    expect(evaluateVersionCompatibility("0.9.9", supported).outcome).toBe(
      "REJECTED_UNKNOWN_MAJOR",
    );
    expect(evaluateVersionCompatibility("1.1", supported).outcome).toBe(
      "REJECTED_MALFORMED",
    );
    expect(evaluateVersionCompatibility("1.1.0-rc.1", supported).outcome).toBe(
      "REJECTED_MALFORMED",
    );
  });
});

describe("payload validation", () => {
  it("reports payload violations with schema context", () => {
    const result = validateEnvelopedRecord(
      record({}, { status: "DELETED" }),
      dependencies,
    );
    expect(result.valid).toBe(false);
    if (!result.valid && result.reason === "PAYLOAD_INVALID") {
      expect(result.schemaId).toBe(FIXTURE_SCHEMA_ID);
      expect(result.errors.join("\n")).toContain("/status");
    } else {
      throw new Error("expected PAYLOAD_INVALID");
    }
  });

  it("rejects undeclared enum values without any compatibility escape", () => {
    const result = validateEnvelopedRecord(
      record({}, { status: "PENDING" }),
      dependencies,
    );
    expect(result.valid).toBe(false);
  });

  it("keeps null and missing distinct for optional non-nullable fields", () => {
    // note is optional and non-nullable: omitted passes, null fails.
    expect(validateEnvelopedRecord(record(), dependencies).valid).toBe(true);
    const nullNote = validateEnvelopedRecord(
      record({}, { note: null }),
      dependencies,
    );
    expect(nullNote.valid).toBe(false);
  });

  it("keeps null and missing distinct for required nullable fields", () => {
    // superseded_by is required and nullable: null passes, omitted fails.
    const payloadObject = Object.fromEntries(
      Object.entries(payload()).filter(([key]) => key !== "superseded_by"),
    );
    const missing = validateEnvelopedRecord(
      { envelope: envelope(), payload: payloadObject },
      dependencies,
    );
    expect(missing.valid).toBe(false);
    expect(
      validateEnvelopedRecord(record({}, { superseded_by: null }), dependencies)
        .valid,
    ).toBe(true);
  });
});

describe("no coercion and no defaults", () => {
  it("rejects string-typed numbers and number-typed strings without coercion", () => {
    expect(
      validateEnvelopedRecord(
        record({}, { match_confidence: "0.93" }),
        dependencies,
      ).valid,
    ).toBe(false);
    expect(
      validateEnvelopedRecord(
        record({}, { budget: { amount: 120000, currency: "USD" } }),
        dependencies,
      ).valid,
    ).toBe(false);
  });

  it("never injects values: a valid record is returned exactly as provided", () => {
    const input = record();
    const snapshot = JSON.stringify(input);
    const result = validateEnvelopedRecord(input, dependencies);
    expect(result.valid).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("direct envelope shape validation", () => {
  it("validates the enveloped-record shape by catalog reference", () => {
    expect(
      validator.validateInstance(ENVELOPED_RECORD_REF, record()).valid,
    ).toBe(true);
    expect(
      validator.validateInstance(ENVELOPED_RECORD_REF, { envelope: {} }).valid,
    ).toBe(false);
  });

  it("throws on references outside the registered catalog", () => {
    expect(() =>
      validator.validateInstance("urn:japp:schema:common:missing:v1", {}),
    ).toThrow(/does not resolve inside/);
  });
});
