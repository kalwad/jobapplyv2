import { describe, expect, test } from "vitest";

import {
  answerFormatSatisfied,
  boundaryLimit,
  countAnswerCodePoints,
  countAnswerLines,
  countAnswerWords,
  measureAnswerAgainstConstraint,
  normalizeAnswerText,
} from "../../src/answer-metrics.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";

describe("M02-W02 deterministic answer metric", () => {
  test("normalizes CRLF and lone CR to LF and trims only outer whitespace", () => {
    expect(normalizeAnswerText("  a\r\nb\rc  ")).toBe("a\nb\nc");
    expect(normalizeAnswerText(" padded ")).toBe("padded");
    expect(normalizeAnswerText("keep  inner\tspacing")).toBe(
      "keep  inner\tspacing",
    );
  });

  test("counts words as maximal non-whitespace runs after normalization", () => {
    expect(countAnswerWords("one two  three\nfour")).toBe(4);
    expect(countAnswerWords("  \r\n  ")).toBe(0);
    expect(countAnswerWords("hyphen-stays one")).toBe(2);
    expect(
      countAnswerWords(
        "My strength is applying TypeScript and Node.js in supported delivery work.",
      ),
    ).toBe(11);
  });

  test("counts characters as Unicode code points, not UTF-16 units", () => {
    expect(countAnswerCodePoints("abc")).toBe(3);
    expect(countAnswerCodePoints("a\u{1F600}b")).toBe(3);
    expect("a\u{1F600}b".length).toBe(4);
    expect(countAnswerCodePoints("line\nbreak")).toBe(10);
    expect(
      countAnswerCodePoints("Advance as a distributed systems leader."),
    ).toBe(40);
    expect(
      countAnswerCodePoints("Grow as a distributed systems engineer."),
    ).toBe(39);
  });

  test("counts lines from normalized LF segments", () => {
    expect(countAnswerLines("one line")).toBe(1);
    expect(countAnswerLines("two\r\nlines")).toBe(2);
    expect(countAnswerLines("")).toBe(0);
  });

  test("accepts only the reserved synthetic HTTPS URL format and exact Yes or No", () => {
    expect(
      answerFormatSatisfied(
        "HTTPS_URL",
        "https://candidate01.example.test/profile",
      ),
    ).toBe(true);
    expect(answerFormatSatisfied("HTTPS_URL", "https://example.com/site")).toBe(
      false,
    );
    expect(answerFormatSatisfied("HTTPS_URL", "http://x.example.test")).toBe(
      false,
    );
    expect(answerFormatSatisfied("YES_NO", "Yes")).toBe(true);
    expect(answerFormatSatisfied("YES_NO", "No")).toBe(true);
    expect(answerFormatSatisfied("YES_NO", "Yes.")).toBe(false);
    expect(answerFormatSatisfied("YES_NO", "yes")).toBe(false);
  });

  test("derives the single boundary dimension only for one-sided limits", () => {
    const corpus = loadFixtureCorpus();
    const wordConstraint = corpus.answerConstraints.find(
      (item) =>
        item.max_words !== undefined && item.max_characters === undefined,
    );
    const charConstraint = corpus.answerConstraints.find(
      (item) =>
        item.max_characters !== undefined && item.max_words === undefined,
    );
    expect(
      wordConstraint === undefined ? undefined : boundaryLimit(wordConstraint),
    ).toEqual({ dimension: "WORDS", limit: 12 });
    expect(
      charConstraint === undefined ? undefined : boundaryLimit(charConstraint),
    ).toEqual({ dimension: "CHARACTERS", limit: 40 });
  });

  test("measures compliance across word, character, line, and format rules", () => {
    const corpus = loadFixtureCorpus();
    const single = corpus.answerConstraints.find(
      (item) =>
        item.line_policy === "SINGLE_LINE" && item.max_characters === 120,
    );
    if (single === undefined) {
      throw new Error("reviewed single-line constraint is missing");
    }
    expect(measureAnswerAgainstConstraint(single, "fits on one line")).toEqual({
      measured_words: 4,
      measured_characters: 16,
      measured_lines: 1,
      compliant: true,
    });
    expect(
      measureAnswerAgainstConstraint(single, "breaks\nacross lines").compliant,
    ).toBe(false);
    const minimum = corpus.answerConstraints.find(
      (item) => item.min_words === 5,
    );
    if (minimum === undefined) {
      throw new Error("reviewed minimum-words constraint is missing");
    }
    expect(
      measureAnswerAgainstConstraint(minimum, "far too short").compliant,
    ).toBe(false);
    expect(
      measureAnswerAgainstConstraint(minimum, "exactly five words are here")
        .compliant,
    ).toBe(true);
  });
});
