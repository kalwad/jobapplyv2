// Frozen normalization semantics (Unicode, case, punctuation, hyphen/slash,
// whitespace, duplicates, ordering) with exact literal expectations.
import { describe, expect, test } from "vitest";

import { NORMALIZATION_CONTRACT, normalizeTerms } from "../../src/index.ts";

describe("frozen lexical normalization", () => {
  test("NFKC folds fullwidth forms and case folds to lowercase", () => {
    expect(normalizeTerms("Ｔｙｐｅｓｃｒｉｐｔ")).toEqual(["typescript"]);
    expect(normalizeTerms("TYPESCRIPT TypeScript typescript")).toEqual([
      "typescript",
    ]);
  });

  test("punctuation separates tokens and trailing dot runs are stripped", () => {
    expect(normalizeTerms("Python.")).toEqual(["python"]);
    expect(normalizeTerms("uses node.js!")).toEqual(["node.js", "uses"]);
    expect(normalizeTerms("alpha, beta; gamma?")).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  test("hyphen and slash always separate tokens", () => {
    expect(normalizeTerms("node-js ci/cd")).toEqual(["cd", "ci", "js", "node"]);
    expect(normalizeTerms("full-stack")).toEqual(["full", "stack"]);
  });

  test("kept specials survive: c++, c#, .net, r&d", () => {
    expect(normalizeTerms("C++ C# .NET R&D")).toEqual([
      ".net",
      "c#",
      "c++",
      "r&d",
    ]);
  });

  test("duplicates collapse to a unique sorted set", () => {
    expect(normalizeTerms("beta alpha beta ALPHA")).toEqual(["alpha", "beta"]);
  });

  test("empty, whitespace-only, and punctuation-only inputs produce no terms", () => {
    expect(normalizeTerms("")).toEqual([]);
    expect(normalizeTerms("   \t\n  ")).toEqual([]);
    expect(normalizeTerms("!!! ,,, ---")).toEqual([]);
    expect(normalizeTerms("...")).toEqual([]);
  });

  test("ordering is ascending code-unit order regardless of input order", () => {
    expect(normalizeTerms("zeta beta alpha")).toEqual([
      "alpha",
      "beta",
      "zeta",
    ]);
  });

  test("the frozen contract declares no stop words, no stemming, no phrases", () => {
    expect(NORMALIZATION_CONTRACT.contract_version).toBe("1.0.0");
    expect(NORMALIZATION_CONTRACT.stop_word_policy).toBe("NONE");
    expect(NORMALIZATION_CONTRACT.stemming).toBe("NONE");
    expect(NORMALIZATION_CONTRACT.phrase_semantics).toBe("NONE");
    expect(NORMALIZATION_CONTRACT.unicode_normalization).toBe("NFKC");
    expect(NORMALIZATION_CONTRACT.duplicate_handling).toBe("UNIQUE_TERM_SET");
  });
});
