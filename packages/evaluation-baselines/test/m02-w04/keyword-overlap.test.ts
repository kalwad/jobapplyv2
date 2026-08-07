// KEYWORD_OVERLAP baseline: every committed development case is executed and
// compared against the literal oracle — exact term sets, matches, misses,
// numerator/denominator, and zero-denominator behavior.
import { describe, expect, test } from "vitest";

import {
  keywordOverlap,
  sha256Bytes,
  DEV_CASE_MATRIX,
} from "../../src/index.ts";
import { devCase, loadOracle, resolveTextInput } from "./support/inputs.ts";

const oracle = loadOracle();

const OVERLAP_SCENARIOS = [
  "NO_OVERLAP",
  "COMPLETE_OVERLAP",
  "PARTIAL_OVERLAP_FIXTURE",
  "DUPLICATE_TERMS_UNIQUE_SET",
  "PUNCTUATION_CASE_WHITESPACE_VARIANTS",
  "HYPHEN_SLASH_SEPARATION",
  "EMPTY_CANDIDATE",
  "EMPTY_TARGET_ZERO_DENOMINATOR",
  "MISLEADING_LEXICAL_OVERLAP_WITHOUT_EVIDENCE",
  "STABLE_TIE_AND_ORDER",
] as const;

function runScenario(scenario: string) {
  const record = devCase("KEYWORD_OVERLAP", scenario);
  if (record.candidate === undefined || record.target === undefined) {
    throw new Error(`overlap case ${scenario} is missing inputs`);
  }
  return keywordOverlap(
    resolveTextInput(record.candidate),
    resolveTextInput(record.target),
  );
}

describe("keyword overlap against the literal oracle", () => {
  for (const scenario of OVERLAP_SCENARIOS) {
    test(`${scenario} reproduces the exact oracle term sets and score`, () => {
      const truth = oracle.keyword_overlap[scenario];
      if (truth === undefined) {
        throw new Error(`oracle is missing overlap scenario ${scenario}`);
      }
      const result = runScenario(scenario);
      expect([...result.normalized_candidate_terms]).toEqual([
        ...truth.candidate_terms,
      ]);
      expect([...result.normalized_target_terms]).toEqual([
        ...truth.target_terms,
      ]);
      expect([...result.matched_terms]).toEqual([...truth.matched]);
      expect([...result.missing_terms]).toEqual([...truth.missing]);
      expect(result.score_numerator).toBe(truth.numerator);
      expect(result.score_denominator).toBe(truth.denominator);
      expect(result.zero_target_terms).toBe(truth.zero_target_terms);
      expect(result.score).toBe(
        truth.zero_target_terms ? 0 : truth.numerator / truth.denominator,
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.matched_term_count + result.missing_term_count).toBe(
        result.target_term_count,
      );
    });
  }

  test("the oracle covers every committed overlap case exactly once", () => {
    const committed = DEV_CASE_MATRIX.cases
      .filter((record) => record.kind === "KEYWORD_OVERLAP")
      .map((record) => record.scenario)
      .sort();
    expect(committed).toEqual([...OVERLAP_SCENARIOS].sort());
    expect(Object.keys(oracle.keyword_overlap).sort()).toEqual(
      [...OVERLAP_SCENARIOS].sort(),
    );
  });

  test("results are labeled evaluation-only, non-production, and lexical-only", () => {
    const result = runScenario("PARTIAL_OVERLAP_FIXTURE");
    expect([...result.classification]).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
    expect(result.semantics).toBe("LEXICAL_ONLY_NOT_SEMANTIC_MATCHING");
    expect(result.baseline_id).toBe("baseline_keyword_overlap_v1");
    expect(result.algorithm_version).toBe("1.0.0");
  });

  test("misleading lexical overlap scores 1 while proving nothing semantically", () => {
    const result = runScenario("MISLEADING_LEXICAL_OVERLAP_WITHOUT_EVIDENCE");
    expect(result.score).toBe(1);
    expect(result.semantics).toBe("LEXICAL_ONLY_NOT_SEMANTIC_MATCHING");
  });

  test("repeated execution on identical input is structurally identical", () => {
    const first = runScenario("PARTIAL_OVERLAP_FIXTURE");
    const second = runScenario("PARTIAL_OVERLAP_FIXTURE");
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("fixture projections still match the pinned oracle binding digests", () => {
    const partial = devCase("KEYWORD_OVERLAP", "PARTIAL_OVERLAP_FIXTURE");
    if (partial.candidate === undefined || partial.target === undefined) {
      throw new Error("fixture case is missing inputs");
    }
    expect(sha256Bytes(resolveTextInput(partial.candidate))).toBe(
      oracle.fixture_bindings.resume_1_projection_sha256,
    );
    expect(sha256Bytes(resolveTextInput(partial.target))).toBe(
      oracle.fixture_bindings.job_1_blocks_projection_sha256,
    );
  });
});
