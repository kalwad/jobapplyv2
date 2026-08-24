// M02-W09 deterministic evidence-text handling.
//
// Every input here is untrusted page-derived data that already passed the
// W08 scanner's bounded normalized-text grammar. These helpers only lower,
// tokenize, and compare; they never execute, interpret, or emit page text
// into a decision value.

const QUALIFIER_SUFFIX = /\s*\((required|optional)\)\s*$/i;

/**
 * Canonical evidence normalization: strip one trailing "(required)" /
 * "(optional)" qualifier, lowercase, and reduce to space-separated word
 * tokens. Deterministic for identical input.
 */
export function normalizeEvidence(value: string): string {
  return value
    .replace(QUALIFIER_SUFFIX, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

export function evidenceWords(value: string): readonly string[] {
  const normalized = normalizeEvidence(value);
  return normalized === "" ? [] : normalized.split(" ");
}

/**
 * True when `phrase` appears in `text` as a contiguous word sequence.
 * Substring matching inside words is deliberately rejected ("cell" must not
 * match "cancellation").
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const textWords = evidenceWords(text);
  const phraseWords = evidenceWords(phrase);
  if (phraseWords.length === 0 || textWords.length < phraseWords.length) {
    return false;
  }
  for (
    let start = 0;
    start + phraseWords.length <= textWords.length;
    start += 1
  ) {
    let matched = true;
    for (let index = 0; index < phraseWords.length; index += 1) {
      if (textWords[start + index] !== phraseWords[index]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}

/** True when the normalized text equals the normalized phrase exactly. */
export function equalsPhrase(text: string, phrase: string): boolean {
  const normalized = normalizeEvidence(text);
  return normalized !== "" && normalized === normalizeEvidence(phrase);
}

/**
 * Compare one W08 section-context enum token (for example
 * `VOLUNTARY_AND_ELIGIBILITY_QUESTIONS`) against a catalog section phrase.
 * The token is treated as an underscore-joined word list; the phrase matches
 * when its words appear as a contiguous subsequence.
 */
export function sectionTokenMatches(
  sectionToken: string,
  phrase: string,
): boolean {
  return containsPhrase(sectionToken.replaceAll("_", " "), phrase);
}

/**
 * Bounded placeholder detection for rendered options. A placeholder such as
 * "Select a work mode" or "Choose..." is never a real answer; nothing else
 * is inferred from it.
 */
export function isPlaceholderOptionLabel(label: string): boolean {
  const words = evidenceWords(label);
  const first = words[0];
  return (
    first !== undefined &&
    ["select", "choose", "pick"].includes(first) &&
    words.length <= 5
  );
}
