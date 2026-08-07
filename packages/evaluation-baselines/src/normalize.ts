// Frozen lexical normalization for the keyword-overlap and keyword-stuffing
// baselines (M02-W04). Every rule is explicit and versioned; there are no
// hidden weights, no embeddings, no stemming, no stop words, and no model
// calls. Lexical overlap is NOT semantic matching.

/**
 * The complete frozen normalization contract. The digest of this object is
 * committed in the baseline manifest; changing any rule without a reviewed
 * manifest update fails `baselines:check`.
 */
export const NORMALIZATION_CONTRACT = {
  contract_version: "1.0.0",
  unicode_normalization: "NFKC",
  case_normalization: "UNICODE_DEFAULT_LOWERCASE",
  token_kind: "UNIGRAM_TERMS_ONLY",
  phrase_semantics: "NONE",
  stop_word_policy: "NONE",
  stemming: "NONE",
  duplicate_handling: "UNIQUE_TERM_SET",
  kept_characters: "a-z 0-9 + # & . (after NFKC and lowercasing)",
  separator_rule:
    "every character outside the kept set separates tokens; ASCII hyphen-minus and slash always separate",
  trailing_dot_rule: "trailing '.' runs are stripped from each token",
  ordering: "ascending UTF-16 code-unit order (ASCII-safe for kept tokens)",
  score_definition: "unique matched terms / unique target terms",
  zero_denominator_rule: "empty target term set scores 0 with an explicit flag",
  score_range: "[0, 1]",
  tie_rule: "no ranking; equal terms are ordered by the same code-unit sort",
} as const;

const KEPT = new Set("abcdefghijklmnopqrstuvwxyz0123456789+#&.");

export function compareTerms(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Tokenize text into the frozen unique, sorted unigram term set:
 * NFKC → Unicode default lowercase → keep [a-z0-9+#&.] (hyphen and slash
 * always separate) → strip trailing '.' runs → drop empties → unique → sort.
 */
export function normalizeTerms(text: string): string[] {
  const lowered = text.normalize("NFKC").toLowerCase();
  const tokens: string[] = [];
  let current = "";
  const flush = (): void => {
    let token = current;
    current = "";
    while (token.endsWith(".")) {
      token = token.slice(0, -1);
    }
    if (token.length > 0) {
      tokens.push(token);
    }
  };
  for (const character of lowered) {
    if (KEPT.has(character)) {
      current += character;
    } else {
      flush();
    }
  }
  flush();
  return [...new Set(tokens)].sort(compareTerms);
}
