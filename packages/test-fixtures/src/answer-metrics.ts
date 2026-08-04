import type { AnswerConstraint, AnswerConstraintEvaluation } from "./model.ts";

/**
 * TEST-ONLY closed answer-limit metric for M02-W02 fixtures.
 *
 * Normalization: CRLF and lone CR become LF, then leading and trailing
 * Unicode whitespace is trimmed. Interior whitespace is preserved.
 * Words: maximal runs of non-whitespace in the normalized text.
 * Characters: Unicode code points of the normalized text (interior
 * whitespace and each LF count as one code point; UTF-16 surrogate pairs
 * count once). Lines: LF-separated segments of the normalized text.
 * This metric is fixture truth for the development corpus only; it is not
 * the production M16 counting contract.
 */
export function normalizeAnswerText(raw: string): string {
  return raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

export function countAnswerWords(raw: string): number {
  const normalized = normalizeAnswerText(raw);
  if (normalized === "") {
    return 0;
  }
  return normalized.split(/\s+/u).filter((part) => part !== "").length;
}

export function countAnswerCodePoints(raw: string): number {
  // The fixture metric deliberately counts Unicode code points, not UTF-16
  // units and not grapheme clusters; string iteration is exactly that.
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  return [...normalizeAnswerText(raw)].length;
}

export function countAnswerLines(raw: string): number {
  const normalized = normalizeAnswerText(raw);
  return normalized === "" ? 0 : normalized.split("\n").length;
}

const HTTPS_URL_FORMAT =
  /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.example\.test(?:\/[A-Za-z0-9._/-]*)?$/u;

export function answerFormatSatisfied(
  format: NonNullable<AnswerConstraint["exact_format"]>,
  raw: string,
): boolean {
  const normalized = normalizeAnswerText(raw);
  if (format === "HTTPS_URL") {
    return HTTPS_URL_FORMAT.test(normalized);
  }
  return normalized === "Yes" || normalized === "No";
}

export function measureAnswerAgainstConstraint(
  constraint: AnswerConstraint,
  raw: string,
): AnswerConstraintEvaluation {
  const words = countAnswerWords(raw);
  const characters = countAnswerCodePoints(raw);
  const lines = countAnswerLines(raw);
  const compliant =
    (constraint.max_words === undefined || words <= constraint.max_words) &&
    (constraint.min_words === undefined || words >= constraint.min_words) &&
    (constraint.max_characters === undefined ||
      characters <= constraint.max_characters) &&
    (constraint.min_characters === undefined ||
      characters >= constraint.min_characters) &&
    (constraint.line_policy !== "SINGLE_LINE" || lines <= 1) &&
    (constraint.exact_format === undefined ||
      answerFormatSatisfied(constraint.exact_format, raw));
  return {
    measured_words: words,
    measured_characters: characters,
    measured_lines: lines,
    compliant,
  };
}

/**
 * The labeled boundary dimension of a trio constraint: exactly one of
 * max_words or max_characters. Returns undefined when the constraint does
 * not define a single boundary dimension.
 */
export function boundaryLimit(
  constraint: AnswerConstraint,
): { dimension: "CHARACTERS" | "WORDS"; limit: number } | undefined {
  if (
    constraint.max_words !== undefined &&
    constraint.max_characters === undefined
  ) {
    return { dimension: "WORDS", limit: constraint.max_words };
  }
  if (
    constraint.max_characters !== undefined &&
    constraint.max_words === undefined
  ) {
    return { dimension: "CHARACTERS", limit: constraint.max_characters };
  }
  return undefined;
}
