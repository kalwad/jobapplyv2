// KEYWORD_OVERLAP baseline (M02-W04): a transparent, deliberately simple
// lexical unigram matcher. The result exposes everything needed to reproduce
// the score by hand. Lexical overlap is explicitly NOT semantic matching:
// a matched term proves nothing about supporting evidence.
import { BASELINE_CLASSIFICATION, type KeywordOverlapResult } from "./model.ts";
import { compareTerms, normalizeTerms } from "./normalize.ts";

export const KEYWORD_OVERLAP_ALGORITHM_VERSION = "1.0.0" as const;

export function keywordOverlap(
  candidateText: string,
  targetText: string,
): KeywordOverlapResult {
  const candidateTerms = normalizeTerms(candidateText);
  const targetTerms = normalizeTerms(targetText);
  const candidateSet = new Set(candidateTerms);
  const matched = targetTerms.filter((term) => candidateSet.has(term));
  const missing = targetTerms.filter((term) => !candidateSet.has(term));
  const zeroTargetTerms = targetTerms.length === 0;
  return {
    baseline_id: "baseline_keyword_overlap_v1",
    algorithm_version: KEYWORD_OVERLAP_ALGORITHM_VERSION,
    classification: BASELINE_CLASSIFICATION,
    semantics: "LEXICAL_ONLY_NOT_SEMANTIC_MATCHING",
    normalized_candidate_terms: candidateTerms,
    normalized_target_terms: targetTerms,
    matched_terms: [...matched].sort(compareTerms),
    missing_terms: [...missing].sort(compareTerms),
    candidate_term_count: candidateTerms.length,
    target_term_count: targetTerms.length,
    matched_term_count: matched.length,
    missing_term_count: missing.length,
    score_numerator: matched.length,
    score_denominator: targetTerms.length,
    score: zeroTargetTerms ? 0 : matched.length / targetTerms.length,
    zero_target_terms: zeroTargetTerms,
  };
}
