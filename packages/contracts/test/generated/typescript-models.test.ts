/**
 * M01-W02 generated-TypeScript behavior: every corpus case validates to its
 * single expected verdict through the typed wrappers (whose runtime truth
 * is the strict canonical Ajv catalog), inputs are never mutated, unknown
 * references fail closed, and the export surface stays complete.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { loadSchemaCatalog } from "../../src/index.ts";
import {
  CONTRACT_SCHEMA_REFS,
  contractRuntime,
  validateContractInstance,
  validateCommonEnvelopeV1EnvelopedRecord,
  validateCommonMoneyV1Money,
  validateFixtureTestRecordV1,
  type GeneratedTypeByRef,
} from "../../generated/typescript/index.ts";

interface CorpusCase {
  readonly label: string;
  readonly ref: string;
  readonly valid: boolean;
  readonly instance: unknown;
}

const corpus = (
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../fixtures/instance-corpus.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as { cases: CorpusCase[] }
).cases;

function asKnownRef(ref: string): keyof GeneratedTypeByRef {
  expect(CONTRACT_SCHEMA_REFS).toContain(ref);
  return ref as keyof GeneratedTypeByRef;
}

describe("corpus verdicts through the typed wrappers", () => {
  test("corpus covers representative positive and negative cases", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(60);
    expect(corpus.some((entry) => entry.valid)).toBe(true);
    expect(corpus.some((entry) => !entry.valid)).toBe(true);
    const labels = corpus.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  for (const corpusCase of corpus) {
    test(corpusCase.label, () => {
      const before = JSON.stringify(corpusCase.instance);
      const outcome = validateContractInstance(
        asKnownRef(corpusCase.ref),
        corpusCase.instance,
      );
      expect(outcome.valid).toBe(corpusCase.valid);
      if (!outcome.valid) {
        expect(outcome.errors.length).toBeGreaterThan(0);
        for (const error of outcome.errors) {
          expect(typeof error).toBe("string");
        }
      }
      // Validation must never coerce, inject defaults, or remove members.
      expect(JSON.stringify(corpusCase.instance)).toBe(before);
    });
  }
});

describe("wrapper narrowing and failure structure", () => {
  test("success narrows to the generated type", () => {
    const outcome = validateCommonMoneyV1Money({
      amount: "42.00",
      currency: "USD",
    });
    expect(outcome.valid).toBe(true);
    if (outcome.valid) {
      // Type-level: outcome.value is CommonMoneyV1Money here.
      expect(outcome.value.amount).toBe("42.00");
      expect(outcome.value.currency).toBe("USD");
    }
  });

  test("failure preserves instance-path error structure", () => {
    const outcome = validateCommonMoneyV1Money({
      amount: 42,
      currency: "usd",
    });
    expect(outcome.valid).toBe(false);
    if (!outcome.valid) {
      expect(outcome.errors.some((error) => error.startsWith("/amount"))).toBe(
        true,
      );
      expect(
        outcome.errors.some((error) => error.startsWith("/currency")),
      ).toBe(true);
    }
  });

  test("frozen input validates without mutation attempts", () => {
    const frozen = Object.freeze({
      amount: "10.00",
      currency: "EUR",
    });
    expect(validateCommonMoneyV1Money(frozen).valid).toBe(true);
  });

  test("an unknown schema reference fails closed at runtime", () => {
    expect(() =>
      validateContractInstance(
        "urn:japp:schema:common:nonexistent:v1" as keyof GeneratedTypeByRef,
        {},
      ),
    ).toThrow(/does not resolve inside/);
  });

  test("enveloped-record wrapper keeps the payload opaque", () => {
    const outcome = validateCommonEnvelopeV1EnvelopedRecord({
      envelope: {
        schema_id: "urn:japp:schema:fixture:test-record:v1",
        schema_version: "1.1.0",
        message_id: "msg_0123456789ABCDEFGHJKMNPQRS",
        created_at: "2026-07-27T04:00:00Z",
      },
      payload: { anything: ["goes", { here: null }] },
    });
    expect(outcome.valid).toBe(true);
    if (outcome.valid) {
      // Type-level: payload is `unknown`, not `any` — using it without
      // narrowing must not typecheck as a concrete shape.
      const payload: unknown = outcome.value.payload;
      expect(payload).toEqual({ anything: ["goes", { here: null }] });
    }
  });

  test("optional-versus-null semantics survive the typed layer", () => {
    const base = {
      record_id: "rec_0123456789ABCDEFGHJKMNPQRS",
      captured_at: "2026-07-27T04:00:00Z",
      effective_date: "2026-07-27",
      budget: { amount: "1.00", currency: "USD" },
      location: { country: "US" },
      provenance: {
        source_kind: "USER_INPUT",
        source_id: "doc_0123456789ABCDEFGHJKMNPQRS",
        observed_at: "2026-07-27T04:00:00Z",
      },
      match_confidence: 0.5,
      redaction: { sensitivity: "PERSONAL", policy: "REDACT_VALUE" },
      status: "ACTIVE",
    };
    expect(
      validateFixtureTestRecordV1({ ...base, superseded_by: null }).valid,
    ).toBe(true);
    expect(validateFixtureTestRecordV1(base).valid).toBe(false);
    expect(
      validateFixtureTestRecordV1({ ...base, superseded_by: null, note: null })
        .valid,
    ).toBe(false);
  });
});

describe("generated surface completeness", () => {
  test("every catalog definition and root payload has a generated ref", () => {
    const catalog = loadSchemaCatalog();
    const expected = new Set<string>();
    for (const entry of catalog.entries) {
      const defs = entry.document.$defs;
      if (defs !== null && typeof defs === "object" && !Array.isArray(defs)) {
        for (const name of Object.keys(defs)) {
          expected.add(`${entry.id}#/$defs/${name}`);
        }
      }
      if (entry.document.type !== undefined) {
        expected.add(entry.id);
      }
    }
    expect(new Set(CONTRACT_SCHEMA_REFS)).toEqual(expected);
  });

  test("the wrapper runtime is the canonical catalog validator", () => {
    const runtime = contractRuntime();
    expect(runtime.catalog.entries.length).toBe(13);
    // The canonical validator rejects references that leave the catalog.
    expect(() =>
      runtime.validator.validateInstance("https://example.invalid/x", {}),
    ).toThrow(/does not resolve inside/);
  });
});
