import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  CORPUS_ROOT,
  expectedCanonicalJson,
  loadCorpus,
} from "./adapters/corpus-loader.ts";
import { canonicalJson } from "./adapters/normalization.ts";
import { parseRawJson } from "./adapters/raw-json.ts";

describe("versioned canonical compatibility corpus", () => {
  test("manifest locks one deterministic 363-case inventory", () => {
    const first = loadCorpus();
    const second = loadCorpus();
    expect(first.manifest.corpus_format_version).toBe("1.0.0");
    expect(first.manifest.case_count).toBe(363);
    expect(first.cases).toHaveLength(363);
    expect(first.canonical_inventory).toBe(second.canonical_inventory);
    expect(first.manifest.files.map((entry) => entry.path)).toEqual([
      "cases.v1.json",
      "raw-wire.v1.json",
      "values.v1.json",
    ]);
    for (const entry of first.manifest.files) {
      const bytes = readFileSync(join(CORPUS_ROOT, entry.path));
      expect(entry.bytes).toBe(bytes.byteLength);
      expect(entry.sha256).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
    }
    expect(first.manifest.language_counts).toEqual({
      python: 358,
      rust: 357,
      typescript: 362,
    });
    expect(first.manifest.operation_counts).toEqual({
      AUTHORIZE: 60,
      ROUND_TRIP: 81,
      VALIDATE: 214,
      VERSION_CHECK: 8,
    });
  });

  test("all cases are sorted, uniquely identified, reasoned, and synthetic", () => {
    const { cases } = loadCorpus();
    const ids = cases.map((corpusCase) => corpusCase.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const corpusCase of cases) {
      expect(corpusCase.id.length).toBeGreaterThan(0);
      expect(corpusCase.schema_ref.length).toBeGreaterThan(0);
      expect(corpusCase.rationale.length).toBeGreaterThan(20);
      expect(corpusCase.synthetic_data).toBe(true);
      expect(corpusCase.languages).toEqual([...corpusCase.languages].sort());
    }
  });

  test("manifest contains no machine identity or nondeterministic metadata", () => {
    const text = readFileSync(join(CORPUS_ROOT, "manifest.v1.json"), "utf8");
    expect(text).not.toMatch(
      /(?:\/Users\/|[A-Za-z]:\\Users\\|hostname|username|generated_at|timestamp)/i,
    );
    expect(text).not.toContain("2026-");
  });

  test("canonical normalization preserves integer, fractional, null, and missing states", () => {
    expect(
      canonicalJson({
        z: null,
        fractional: 0.25,
        integer: 1,
        nested: { present: true },
      }),
    ).toBe(
      '{"fractional":0.25,"integer":1,"nested":{"present":true},"z":null}',
    );
    expect(canonicalJson({ optional: null })).not.toBe(canonicalJson({}));
  });

  test("every valid case resolves an expected canonical wire value", () => {
    const corpus = loadCorpus();
    for (const corpusCase of corpus.cases.filter(
      (candidate) => candidate.expected.valid,
    )) {
      expect(
        expectedCanonicalJson(corpusCase, corpus.stores),
        corpusCase.id,
      ).toBeDefined();
    }
  });

  test("raw parser rejects duplicate keys before constructing an object", () => {
    expect(() => parseRawJson(Buffer.from('{"a":1,"a":2}', "utf8"))).toThrow(
      "DUPLICATE_KEY",
    );
  });

  test("raw parser rejects forbidden prototype keys and unsafe numbers", () => {
    expect(() => parseRawJson(Buffer.from('{"__proto__":{}}', "utf8"))).toThrow(
      "FORBIDDEN_PROPERTY_NAME",
    );
    expect(() => parseRawJson(Buffer.from("9007199254740992", "utf8"))).toThrow(
      "NUMBER_OUT_OF_RANGE",
    );
  });
});
