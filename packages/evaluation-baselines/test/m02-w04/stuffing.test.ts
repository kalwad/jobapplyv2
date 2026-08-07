// NAIVE_KEYWORD_STUFFING baseline: exact frozen outputs, duplicate
// prevention, determinism, and honest UNVERIFIED labeling.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  BASELINE_CATALOG,
  KEYWORD_STUFFING_ANNOTATION_LABEL,
  KEYWORD_STUFFING_ANNOTATION_TEMPLATE,
  KEYWORD_STUFFING_INSERTION_FORMAT,
  naiveKeywordStuffing,
  PACKAGE_ROOT,
  sha256Bytes,
} from "../../src/index.ts";
import { devCase, loadOracle, resolveTextInput } from "./support/inputs.ts";

const oracle = loadOracle();
const CLAIM_BEARING_HEADING =
  /(?:^|\n)(?:Skills|Experience|Qualifications|Technologies)\s*:/iu;

function expectedAnnotation(terms: readonly string[]): string {
  return `\n\n[${KEYWORD_STUFFING_ANNOTATION_LABEL}: ${terms.join(", ")}]`;
}

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
    expect(result.insertion_format).toBe(KEYWORD_STUFFING_INSERTION_FORMAT);
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
      expectedAnnotation(truth.inserted_terms),
    );
    expect([...result.inserted_terms]).toEqual(
      [...result.inserted_terms].sort(),
    );
    expect(result.original_text).toBe(candidate);
  });

  test("the exact audit case marks target-only sql as ungrounded evaluation text, never a candidate claim", () => {
    const original = "Analyst with Excel experience.";
    const result = naiveKeywordStuffing(original, "SQL");
    expect(result.transformed_text).toContain("sql");
    expect(result.transformed_text).not.toContain("Skills: sql");
    expect(result.transformed_text).toContain("EVALUATION-ONLY");
    expect(result.transformed_text).toContain("UNGROUNDED TARGET TERMS");
    expect(result.transformed_text).toContain(
      "NOT CANDIDATE SKILLS OR EXPERIENCE: sql",
    );
    expect(result.original_text).toBe(original);
    expect(result.grounded_in_evidence).toBe(false);
  });

  test("multiple target-only terms retain deterministic normalized order", () => {
    const result = naiveKeywordStuffing(
      "Analyst with Excel experience.",
      "Zulu SQL Alpha",
    );
    expect([...result.inserted_terms]).toEqual(["alpha", "sql", "zulu"]);
    expect(
      result.transformed_text.endsWith(
        expectedAnnotation(result.inserted_terms),
      ),
    ).toBe(true);
  });

  test("already-present terms are not duplicated", () => {
    const result = naiveKeywordStuffing("SQL analyst.", "SQL SQL Python");
    expect([...result.already_present_terms]).toEqual(["sql"]);
    expect([...result.inserted_terms]).toEqual(["python"]);
    expect(result.transformed_text).toBe(
      `SQL analyst.${expectedAnnotation(["python"])}`,
    );
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

  test("target-only terms appear only in the explicit non-claiming annotation", () => {
    const { candidate, target } = scenarioTexts(
      "SEVERAL_MISSING_TERMS_FIXTURE",
    );
    const result = naiveKeywordStuffing(candidate, target);
    const suffix = result.transformed_text.slice(result.original_text.length);
    expect(suffix).toBe(expectedAnnotation(result.inserted_terms));
    expect(suffix).not.toMatch(CLAIM_BEARING_HEADING);
    expect(suffix).toContain("EVALUATION-ONLY UNGROUNDED TARGET TERMS");
    expect(suffix).toContain("NOT CANDIDATE SKILLS OR EXPERIENCE");
    for (const term of result.inserted_terms) {
      expect(term).toMatch(/^[a-z0-9+#&.]+$/);
    }
  });

  test("implementation, catalog, README, and literal oracle pin the same insertion format", () => {
    const truth = oracle.keyword_stuffing;
    expect(KEYWORD_STUFFING_INSERTION_FORMAT).toBe(truth.insertion_format);
    expect(KEYWORD_STUFFING_ANNOTATION_TEMPLATE).toBe(
      truth.annotation_template.replaceAll("\n", "\\n"),
    );

    const definition = BASELINE_CATALOG.baselines.find(
      (entry) => entry.baseline_id === "baseline_naive_keyword_stuffing_v1",
    );
    expect(definition?.output_contract).toContain(
      KEYWORD_STUFFING_ANNOTATION_TEMPLATE,
    );
    const readme = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");
    expect(readme).toContain(`\`${KEYWORD_STUFFING_ANNOTATION_TEMPLATE}\``);

    const result = naiveKeywordStuffing("Analyst.", "SQL");
    expect(result.insertion_format).toBe(truth.insertion_format);
    expect(result.transformed_text.slice(result.original_text.length)).toBe(
      truth.annotation_template.replace(
        "<missing terms joined by ', '>",
        "sql",
      ),
    );
  });
});
