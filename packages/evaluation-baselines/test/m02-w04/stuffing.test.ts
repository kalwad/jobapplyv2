// NAIVE_KEYWORD_STUFFING baseline: exact frozen outputs, duplicate
// prevention, determinism, and honest UNVERIFIED labeling.
import { describe, expect, test } from "vitest";

import { naiveKeywordStuffing, sha256Bytes } from "../../src/index.ts";
import { devCase, loadOracle, resolveTextInput } from "./support/inputs.ts";

const oracle = loadOracle();

function scenarioTexts(scenario: string): {
  candidate: string;
  target: string;
} {
  const record = devCase("NAIVE_KEYWORD_STUFFING", scenario);
  if (record.candidate === undefined || record.target === undefined) {
    throw new Error(`stuffing case ${scenario} is missing inputs`);
  }
  return {
    candidate: resolveTextInput(record.candidate),
    target: resolveTextInput(record.target),
  };
}

describe("naive keyword stuffing", () => {
  test("no missing terms leaves the text byte-identical", () => {
    const { candidate, target } = scenarioTexts("NO_MISSING_TERMS");
    const result = naiveKeywordStuffing(candidate, target);
    expect(result.transformed_text).toBe(
      oracle.keyword_stuffing.NO_MISSING_TERMS_text,
    );
    expect(result.transformed_text).toBe(candidate);
    expect([...result.inserted_terms]).toEqual([]);
  });

  test("one missing term is appended in the exact frozen format", () => {
    const { candidate, target } = scenarioTexts("ONE_MISSING_TERM");
    const result = naiveKeywordStuffing(candidate, target);
    expect(result.transformed_text).toBe(
      oracle.keyword_stuffing.ONE_MISSING_TERM_text,
    );
    expect([...result.inserted_terms]).toEqual(["sql"]);
    expect(result.insertion_position).toBe("DOCUMENT_END");
    expect(result.insertion_format).toBe("SKILLS_LINE_COMMA_SEPARATED");
  });

  test("the fixture case appends exactly the oracle's missing terms as one suffix", () => {
    const { candidate, target } = scenarioTexts(
      "SEVERAL_MISSING_TERMS_FIXTURE",
    );
    const truth = oracle.keyword_stuffing.SEVERAL_MISSING_TERMS_FIXTURE;
    const result = naiveKeywordStuffing(candidate, target);
    expect([...result.inserted_terms]).toEqual([...truth.inserted_terms]);
    expect(sha256Bytes(result.transformed_text)).toBe(truth.transformed_sha256);
    expect(result.transformed_text).toBe(candidate + truth.appended_suffix);
    expect(truth.appended_suffix).toBe(
      `\n\nSkills: ${truth.inserted_terms.join(", ")}`,
    );
    expect(result.original_text).toBe(candidate);
  });

  test("repeated application is idempotent: already-present terms are never duplicated", () => {
    const { candidate, target } = scenarioTexts(
      "DUPLICATE_PREVENTION_IDEMPOTENT",
    );
    const first = naiveKeywordStuffing(candidate, target);
    const second = naiveKeywordStuffing(first.transformed_text, target);
    expect([...second.inserted_terms]).toEqual([
      ...oracle.keyword_stuffing.idempotent_second_pass.inserted_terms,
    ]);
    expect(second.transformed_text === first.transformed_text).toBe(
      oracle.keyword_stuffing.idempotent_second_pass.identical,
    );
  });

  test("execution on identical input is byte-identical across runs", () => {
    const { candidate, target } = scenarioTexts(
      "DETERMINISTIC_REPLAY_UNVERIFIED",
    );
    const first = naiveKeywordStuffing(candidate, target);
    const second = naiveKeywordStuffing(candidate, target);
    expect(second.transformed_text).toBe(first.transformed_text);
    expect([...second.inserted_terms]).toEqual([...first.inserted_terms]);
  });

  test("the transformation is labeled UNVERIFIED, non-production, and ungrounded", () => {
    const { candidate, target } = scenarioTexts(
      "SEVERAL_MISSING_TERMS_FIXTURE",
    );
    const result = naiveKeywordStuffing(candidate, target);
    expect(result.verification_status).toBe("UNVERIFIED");
    expect(result.transformation).toBe("NAIVE_KEYWORD_STUFFING");
    expect([...result.classification]).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
    expect(result.grounded_in_evidence).toBe(false);
  });

  test("no invented claims: the appended suffix contains only bare missing terms", () => {
    const { candidate, target } = scenarioTexts(
      "SEVERAL_MISSING_TERMS_FIXTURE",
    );
    const result = naiveKeywordStuffing(candidate, target);
    const suffix = result.transformed_text.slice(result.original_text.length);
    expect(suffix).toBe(`\n\nSkills: ${result.inserted_terms.join(", ")}`);
    // Bare lexical tokens only — no sentence, metric, date, or employer text.
    for (const term of result.inserted_terms) {
      expect(term).toMatch(/^[a-z0-9+#&.]+$/);
    }
  });
});
