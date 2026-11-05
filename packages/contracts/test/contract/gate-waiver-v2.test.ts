/** Actual bounded adapters validate owner-waiver records without granting authority. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

import { expectedCanonicalJson, loadCorpus } from "./adapters/corpus-loader.ts";
import type { AdapterLanguage, AdapterResult } from "./adapters/protocol.ts";
import {
  runRealAdapters,
  type RealAdapterRun,
} from "./support/orchestrator.ts";
import { assertLanguageAgreement, resultMap } from "./support/response.ts";
import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
} from "./breaking/compatibility-signature.ts";
import { loadBaseline } from "./breaking/baseline.ts";

const ROOT = fileURLToPath(new URL("./gate-waiver-corpus/", import.meta.url));
const corpus = loadCorpus(ROOT);
let run: RealAdapterRun;
let maps: Readonly<Record<AdapterLanguage, ReadonlyMap<string, AdapterResult>>>;
beforeAll(() => {
  run = runRealAdapters(ROOT);
  maps = {
    python: resultMap(run.responses.python),
    rust: resultMap(run.responses.rust),
    typescript: resultMap(run.responses.typescript),
  };
}, 360_000);

describe("additive gate v2 exact owner waiver corpus", () => {
  test("one separate deterministic79-case inventory preserves original511 and512-case bounds", () => {
    expect(corpus.cases).toHaveLength(79);
    expect(corpus.manifest.language_counts).toEqual({
      python: 79,
      rust: 79,
      typescript: 79,
    });
    expect(loadCorpus().cases).toHaveLength(511);
    for (const entry of corpus.manifest.files) {
      const bytes = readFileSync(join(ROOT, entry.path));
      expect(bytes.byteLength).toBe(entry.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        entry.sha256,
      );
    }
    for (const language of ["typescript", "python", "rust"] as const) {
      expect(run.responses[language].results).toHaveLength(79);
    }
  });
  for (const item of corpus.cases) {
    test(item.id, () => {
      const results = item.languages.map((language) => {
        const result = maps[language].get(item.id);
        expect(result, `${language} omitted ${item.id}`).toBeDefined();
        if (result === undefined)
          throw new Error(`${language} omitted ${item.id}`);
        expect(result.operation).toBe(item.operation);
        expect(result.validation_verdict).toBe(
          item.expected.valid ? "VALID" : "INVALID",
        );
        expect(result.canonical_json).toBe(
          expectedCanonicalJson(item, corpus.stores),
        );
        expect(result.error_category).toBe(item.expected.error_category);
        expect(result.error_code).toBe(item.expected.error_code);
        return result;
      });
      const first = results[0];
      if (first === undefined)
        throw new Error("empty gate-v2 language inventory");
      for (const result of results.slice(1))
        assertLanguageAgreement(first, result);
    });
  }
  test("new schemas and executable witnesses are additive against the unchanged breaking baseline", () => {
    const baseline = loadBaseline();
    const signature = buildCompatibilitySignature();
    expect(
      compareCompatibilitySignatures(baseline.signature, signature).compatible,
    ).toBe(true);
    expect(
      signature.semantic_witnesses.some((entry) =>
        entry.id.startsWith("gate-v2."),
      ),
    ).toBe(true);
    for (const historical of baseline.signature.semantic_witnesses) {
      expect(
        signature.semantic_witnesses.find(
          (entry) => entry.id === historical.id,
        ),
      ).toEqual(historical);
    }
  });
});
