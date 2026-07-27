import { describe, expect, it } from "vitest";

import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);

function valid(ref: string, data: unknown): boolean {
  return validator.validateInstance(ref, data).valid;
}

const STABLE_ID = "urn:japp:schema:common:stable-id:v1#/$defs/stableId";
const SCHEMA_ID = "urn:japp:schema:common:schema-version:v1#/$defs/schemaId";
const SCHEMA_VERSION =
  "urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion";
const UTC_TIMESTAMP =
  "urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp";
const CALENDAR_DATE =
  "urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate";
const MONEY = "urn:japp:schema:common:money:v1#/$defs/money";
const DECIMAL_AMOUNT = "urn:japp:schema:common:money:v1#/$defs/decimalAmount";
const CURRENCY = "urn:japp:schema:common:money:v1#/$defs/currencyCode";
const CONFIDENCE = "urn:japp:schema:common:confidence:v1#/$defs/confidence";
const LOCATION = "urn:japp:schema:common:location:v1#/$defs/structuredLocation";
const PROVENANCE = "urn:japp:schema:common:provenance:v1#/$defs/provenance";
const REDACTION =
  "urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation";
const CORRELATION_ID =
  "urn:japp:schema:common:correlation:v1#/$defs/correlationId";
const ENUM_TOKEN = "urn:japp:schema:common:enum-token:v1#/$defs/enumToken";

const GOOD_ID = "clm_01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("stable namespaced identifiers", () => {
  it("accepts conventional identifiers", () => {
    expect(valid(STABLE_ID, GOOD_ID)).toBe(true);
    expect(valid(STABLE_ID, "ev_01BX5ZZKBKACTAV9WEVGEMMVRZ")).toBe(true);
    expect(valid(STABLE_ID, "elig2_01BX5ZZKBKACTAV9WEVGEMMVRZ")).toBe(true);
    expect(valid(CORRELATION_ID, "cor_01BX5ZZKBKACTAV9WEVGEMMVRZ")).toBe(true);
  });

  it("rejects malformed identifiers", () => {
    for (const bad of [
      "clm01ARZ3NDEKTSV4RRFFQ69G5FAV", // missing underscore
      "CLM_01ARZ3NDEKTSV4RRFFQ69G5FAV", // uppercase prefix
      "c_01ARZ3NDEKTSV4RRFFQ69G5FAV", // one-character prefix
      "1lm_01ARZ3NDEKTSV4RRFFQ69G5FAV", // digit-leading prefix
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FA", // 25-character body
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FAVX", // 27-character body
      "clm_01arz3ndektsv4rrffq69g5fav", // lowercase body
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FAI", // I is not in the Crockford alphabet
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FAL", // L is not in the Crockford alphabet
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FAO", // O is not in the Crockford alphabet
      "clm_01ARZ3NDEKTSV4RRFFQ69G5FAU", // U is not in the Crockford alphabet
      "clm_", // empty body
      "", // empty string
      "clm__01ARZ3NDEKTSV4RRFFQ69G5FA", // double underscore
    ]) {
      expect(valid(STABLE_ID, bad), bad).toBe(false);
    }
    expect(valid(STABLE_ID, 42)).toBe(false);
    expect(valid(STABLE_ID, null)).toBe(false);
  });
});

describe("schema identifiers and versions", () => {
  it("accepts conventional schema identifiers and versions", () => {
    expect(valid(SCHEMA_ID, "urn:japp:schema:common:money:v1")).toBe(true);
    expect(valid(SCHEMA_ID, "urn:japp:schema:fixture:test-record:v1")).toBe(
      true,
    );
    expect(valid(SCHEMA_ID, "urn:japp:schema:workday:step-identity:v12")).toBe(
      true,
    );
    expect(valid(SCHEMA_VERSION, "1.0.0")).toBe(true);
    expect(valid(SCHEMA_VERSION, "0.1.0")).toBe(true);
    expect(valid(SCHEMA_VERSION, "12.34.56")).toBe(true);
  });

  it("rejects malformed schema identifiers and versions", () => {
    for (const bad of [
      "urn:japp:schema:common:money", // missing version segment
      "urn:japp:schema:common:money:v01", // zero-padded major
      "urn:japp:schema:Common:money:v1", // uppercase segment
      "urn:japp:schema::money:v1", // empty segment
      "https://example.com/schemas/money/v1", // not a catalog URN
      "urn:japp:schema:v1", // no name segments
    ]) {
      expect(valid(SCHEMA_ID, bad), bad).toBe(false);
    }
    for (const bad of [
      "1.0",
      "1",
      "01.0.0",
      "1.0.0-beta",
      "1.0.0+build",
      "v1.0.0",
    ]) {
      expect(valid(SCHEMA_VERSION, bad), bad).toBe(false);
    }
  });
});

describe("RFC 3339 UTC timestamps", () => {
  it("accepts UTC instants including fractional seconds and leap days", () => {
    expect(valid(UTC_TIMESTAMP, "2026-07-26T12:34:56Z")).toBe(true);
    expect(valid(UTC_TIMESTAMP, "2026-07-26T12:34:56.123Z")).toBe(true);
    expect(valid(UTC_TIMESTAMP, "2026-07-26T12:34:56.123456789Z")).toBe(true);
    expect(valid(UTC_TIMESTAMP, "2024-02-29T00:00:00Z")).toBe(true);
  });

  it("rejects missing offsets, non-UTC offsets, and invalid calendar dates", () => {
    for (const bad of [
      "2026-07-26T12:34:56", // missing offset
      "2026-07-26T12:34:56+02:00", // non-UTC offset
      "2026-07-26T12:34:56-00:00", // explicit negative-zero offset
      "2026-07-26t12:34:56z", // lowercase separators
      "2026-07-26 12:34:56Z", // space separator
      "2026-02-30T00:00:00Z", // February 30
      "2026-02-29T00:00:00Z", // 2026 is not a leap year
      "2026-13-01T00:00:00Z", // month 13
      "2026-07-26T24:00:00Z", // hour 24
      "2026-07-26", // calendar date is not a timestamp
      "2026-07-26T12:34:56.Z", // empty fraction
      "2026-07-26T12:34:56.1234567890Z", // ten fractional digits
    ]) {
      expect(valid(UTC_TIMESTAMP, bad), bad).toBe(false);
    }
  });
});

describe("calendar dates", () => {
  it("accepts civil dates", () => {
    expect(valid(CALENDAR_DATE, "2026-07-26")).toBe(true);
    expect(valid(CALENDAR_DATE, "2024-02-29")).toBe(true);
  });

  it("rejects timestamps and invalid dates", () => {
    for (const bad of [
      "2026-07-26T00:00:00Z", // timestamps are a distinct type
      "2026-02-30", // February 30
      "2026-02-29", // not a leap year
      "2026-13-01", // month 13
      "2026-00-10", // month 0
      "2026-01-00", // day 0
      "20260726", // missing separators
      "26-07-2026", // wrong order
    ]) {
      expect(valid(CALENDAR_DATE, bad), bad).toBe(false);
    }
  });
});

describe("money", () => {
  it("accepts documented decimal representations", () => {
    for (const amount of ["0", "7", "0.5", "1234.56", "-12.30", "10.123456"]) {
      expect(valid(DECIMAL_AMOUNT, amount), amount).toBe(true);
    }
    expect(valid(MONEY, { amount: "1234.56", currency: "USD" })).toBe(true);
    expect(valid(MONEY, { amount: "-12.30", currency: "EUR" })).toBe(true);
  });

  it("accepts syntactically valid currency codes without claiming ISO catalog validation", () => {
    // "ZZZ" is not an ISO 4217 currency, but the documented policy is a
    // syntactic shape check only — the repository maintains no ISO catalog.
    expect(valid(CURRENCY, "USD")).toBe(true);
    expect(valid(CURRENCY, "ZZZ")).toBe(true);
  });

  it("rejects binary floats, exponents, and ambiguous decimal spellings", () => {
    expect(valid(MONEY, { amount: 1234.56, currency: "USD" })).toBe(false);
    expect(valid(MONEY, { amount: "1234.56" })).toBe(false);
    for (const bad of [
      "1e3",
      "1E3",
      "01.00", // leading zero
      ".5", // missing integer part
      "1.", // trailing decimal point
      "+1.00", // explicit plus sign
      "-0.1234567", // seven fractional digits
      "1,000.00", // grouping separator
      "NaN",
      "Infinity",
      "0x10",
    ]) {
      expect(valid(DECIMAL_AMOUNT, bad), bad).toBe(false);
    }
    for (const bad of ["usd", "USDT", "US", "U1D", ""]) {
      expect(valid(CURRENCY, bad), bad).toBe(false);
    }
  });

  it("rejects unknown properties on the closed money object", () => {
    expect(
      valid(MONEY, { amount: "1.00", currency: "USD", rounding: "HALF_UP" }),
    ).toBe(false);
  });
});

describe("confidence", () => {
  it("accepts the boundary values and interior values", () => {
    expect(valid(CONFIDENCE, 0)).toBe(true);
    expect(valid(CONFIDENCE, 0.5)).toBe(true);
    expect(valid(CONFIDENCE, 1)).toBe(true);
  });

  it("rejects out-of-bounds and non-numeric values", () => {
    expect(valid(CONFIDENCE, -0.001)).toBe(false);
    expect(valid(CONFIDENCE, 1.001)).toBe(false);
    expect(valid(CONFIDENCE, "0.5")).toBe(false);
    expect(valid(CONFIDENCE, null)).toBe(false);
  });
});

describe("structured locations", () => {
  it("accepts the documented minimum and full optional shape", () => {
    expect(valid(LOCATION, { country: "US" })).toBe(true);
    expect(
      valid(LOCATION, {
        country: "GB",
        region: "England",
        locality: "London",
        postal_code: "SW1A 1AA",
      }),
    ).toBe(true);
    expect(valid(LOCATION, { country: "CA", postal_code: "K1A-0B1" })).toBe(
      true,
    );
  });

  it("enforces the required country and optional-field constraints", () => {
    expect(valid(LOCATION, {})).toBe(false);
    expect(valid(LOCATION, { region: "California" })).toBe(false);
    expect(valid(LOCATION, { country: "USA" })).toBe(false);
    expect(valid(LOCATION, { country: "us" })).toBe(false);
    expect(valid(LOCATION, { country: "US", region: "" })).toBe(false);
    expect(valid(LOCATION, { country: "US", locality: "" })).toBe(false);
    expect(valid(LOCATION, { country: "US", postal_code: " 94103" })).toBe(
      false,
    );
    expect(
      valid(LOCATION, { country: "US", postal_code: "12345678901234567" }),
    ).toBe(false);
    expect(valid(LOCATION, { country: "US", street: "1 Main St" })).toBe(false);
  });
});

describe("provenance", () => {
  const base = {
    source_kind: "DOCUMENT_IMPORT",
    source_id: "doc_01BX5ZZKBKACTAV9WEVGEMMVRZ",
    observed_at: "2026-07-26T12:00:00Z",
  };

  it("accepts complete provenance records", () => {
    expect(valid(PROVENANCE, base)).toBe(true);
    expect(
      valid(PROVENANCE, {
        ...base,
        source_digest: `sha256:${"a".repeat(64)}`,
        confidence: 0.75,
      }),
    ).toBe(true);
  });

  it("requires the mandatory source identity and observation time", () => {
    for (const required of ["source_kind", "source_id", "observed_at"]) {
      const incomplete = Object.fromEntries(
        Object.entries(base).filter(([key]) => key !== required),
      );
      expect(valid(PROVENANCE, incomplete), required).toBe(false);
    }
  });

  it("rejects undeclared source kinds, malformed digests, and unknown properties", () => {
    expect(valid(PROVENANCE, { ...base, source_kind: "SCRAPED" })).toBe(false);
    expect(
      valid(PROVENANCE, { ...base, source_digest: `md5:${"a".repeat(32)}` }),
    ).toBe(false);
    expect(
      valid(PROVENANCE, { ...base, source_digest: `sha256:${"A".repeat(64)}` }),
    ).toBe(false);
    expect(valid(PROVENANCE, { ...base, confidence: 1.5 })).toBe(false);
    expect(valid(PROVENANCE, { ...base, raw_html: "<html>" })).toBe(false);
    expect(
      valid(PROVENANCE, { ...base, observed_at: "2026-07-26T12:00:00+01:00" }),
    ).toBe(false);
  });
});

describe("redaction annotations", () => {
  it("accepts only the defined vocabulary", () => {
    expect(
      valid(REDACTION, { sensitivity: "PERSONAL", policy: "REDACT_VALUE" }),
    ).toBe(true);
    expect(valid(REDACTION, { sensitivity: "PUBLIC", policy: "NONE" })).toBe(
      true,
    );
    expect(
      valid(REDACTION, { sensitivity: "SECRET", policy: "FORBID_CAPTURE" }),
    ).toBe(true);
  });

  it("rejects undefined vocabulary values and incomplete annotations", () => {
    expect(
      valid(REDACTION, { sensitivity: "TOP_SECRET", policy: "NONE" }),
    ).toBe(false);
    expect(valid(REDACTION, { sensitivity: "PERSONAL", policy: "SHRED" })).toBe(
      false,
    );
    expect(valid(REDACTION, { sensitivity: "PERSONAL" })).toBe(false);
    expect(valid(REDACTION, { policy: "NONE" })).toBe(false);
    expect(
      valid(REDACTION, {
        sensitivity: "PERSONAL",
        policy: "NONE",
        note: "extra",
      }),
    ).toBe(false);
  });
});

describe("enum token grammar", () => {
  it("accepts UPPER_SNAKE_CASE tokens and rejects everything else", () => {
    expect(valid(ENUM_TOKEN, "ACTIVE")).toBe(true);
    expect(valid(ENUM_TOKEN, "GUIDED_PRE_SUBMIT")).toBe(true);
    for (const bad of ["active", "Active", "_ACTIVE", "ACTIVE_", "A B", ""]) {
      expect(valid(ENUM_TOKEN, bad), bad).toBe(false);
    }
  });
});
