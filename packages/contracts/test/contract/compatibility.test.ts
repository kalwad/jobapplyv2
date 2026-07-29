import { beforeAll, describe, expect, test } from "vitest";

import {
  expectedCanonicalJson,
  loadCorpus,
  type CorpusCase,
} from "./adapters/corpus-loader.ts";
import type { AdapterLanguage, AdapterResult } from "./adapters/protocol.ts";
import {
  runRealAdapters,
  type RealAdapterRun,
} from "./support/orchestrator.ts";
import { assertLanguageAgreement, resultMap } from "./support/response.ts";

let realRun: RealAdapterRun;
let maps: Readonly<Record<AdapterLanguage, ReadonlyMap<string, AdapterResult>>>;
let historicalMaps: Readonly<
  Record<AdapterLanguage, ReadonlyMap<string, AdapterResult>>
>;

function requiredResult(
  value: AdapterResult | undefined,
  message: string,
): AdapterResult {
  expect(value, message).toBeDefined();
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

beforeAll(() => {
  realRun = runRealAdapters();
  maps = {
    python: resultMap(realRun.responses.python),
    rust: resultMap(realRun.responses.rust),
    typescript: resultMap(realRun.responses.typescript),
  };
  historicalMaps = {
    python: resultMap(realRun.historicalResponses.python),
    rust: resultMap(realRun.historicalResponses.rust),
    typescript: resultMap(realRun.historicalResponses.typescript),
  };
}, 360_000);

function assertExpected(corpusCase: CorpusCase, result: AdapterResult): void {
  expect(result.case_id).toBe(corpusCase.id);
  expect(result.operation).toBe(corpusCase.operation);
  expect(result.validation_verdict).toBe(
    corpusCase.expected.valid ? "VALID" : "INVALID",
  );
  const canonical = expectedCanonicalJson(corpusCase, realRun.corpus.stores);
  expect(result.canonical_json).toBe(canonical);
  if (corpusCase.expected.version_outcome !== undefined) {
    expect(result.version_outcome).toBe(corpusCase.expected.version_outcome);
  }
  if (corpusCase.expected.authorized !== undefined) {
    expect(result.authorization_outcome).toBe(
      corpusCase.expected.authorized ? "ALLOW" : "DENY",
    );
  }
  if (corpusCase.expected.error_code !== undefined) {
    expect(result.error_code).toBe(corpusCase.expected.error_code);
  }
  if (corpusCase.expected.error_category !== undefined) {
    expect(result.error_category).toBe(corpusCase.expected.error_category);
  }
}

describe("real TypeScript, Python, and test-only Rust adapters", () => {
  test("all real adapters execute the exact applicable inventory", () => {
    expect(realRun.responses.typescript.results).toHaveLength(510);
    expect(realRun.responses.python.results).toHaveLength(506);
    expect(realRun.responses.rust.results).toHaveLength(505);
  });

  for (const corpusCase of loadCorpus().cases) {
    test(corpusCase.id, () => {
      for (const language of corpusCase.languages) {
        const result = requiredResult(
          maps[language].get(corpusCase.id),
          `${language} omitted ${corpusCase.id}`,
        );
        assertExpected(corpusCase, result);
      }
    });
  }

  test("every shared case agrees across its applicable languages", () => {
    for (const corpusCase of realRun.corpus.cases) {
      const results = corpusCase.languages.map((language) => {
        return requiredResult(
          maps[language].get(corpusCase.id),
          `${language} omitted ${corpusCase.id}`,
        );
      });
      const first = results[0];
      if (first === undefined) {
        throw new Error(`${corpusCase.id} has no applicable language`);
      }
      for (const result of results.slice(1)) {
        assertLanguageAgreement(first, result);
      }
    }
  });

  test("all 229 canonical historical v1 positives remain executable in every language", () => {
    expect(realRun.historicalInventory.witness_count).toBe(229);
    expect(realRun.historicalInventory.raw_reference_count).toBe(556);
    expect(realRun.historicalInventory.inventory_sha256).toBe(
      "6ce50f164c3b58a1062f43bcca7164cd5a4fcee0d93a6f1525a3c54379688fbc",
    );
    expect(realRun.historicalInventory.acceptance_pattern_counts).toEqual({
      "0001": 17,
      "0011": 2,
      "1110": 2,
      "1111": 208,
    });
    expect(realRun.historicalInventory.endpoint_union).toEqual([
      "6708f1a",
      "860b6e1",
    ]);
    for (const language of ["python", "rust", "typescript"] as const) {
      expect(realRun.historicalResponses[language].results).toHaveLength(229);
    }

    for (const witness of realRun.historicalInventory.witnesses) {
      const results = witness.languages.map((language) => {
        const result = requiredResult(
          historicalMaps[language].get(witness.id),
          `${language} omitted historical witness ${witness.id}`,
        );
        expect(result.case_id).toBe(witness.id);
        expect(result.operation).toBe("VALIDATE");
        expect(result.validation_verdict).toBe("VALID");
        expect(result.canonical_json).toBeUndefined();
        return result;
      });
      const first = results[0];
      if (first === undefined) {
        throw new Error(`${witness.id} has no historical adapter result`);
      }
      for (const result of results.slice(1)) {
        assertLanguageAgreement(first, result);
      }
    }
  });
});
