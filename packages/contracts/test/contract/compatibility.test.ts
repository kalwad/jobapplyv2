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
    expect(realRun.responses.typescript.results).toHaveLength(112);
    expect(realRun.responses.python.results).toHaveLength(108);
    expect(realRun.responses.rust.results).toHaveLength(107);
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
});
