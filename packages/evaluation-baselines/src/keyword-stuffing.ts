// NAIVE_KEYWORD_STUFFING baseline (M02-W04): one deliberately simplistic,
// intentionally weak deterministic transformation. It exists to demonstrate
// why raw keyword insertion is inadequate. Target-only terms are appended
// only inside an explicit evaluation-only, ungrounded annotation that denies
// candidate-skill or experience authority. The record labels the output
// UNVERIFIED and preserves the original input separately.
import { keywordOverlap } from "./keyword-overlap.ts";
import {
  BASELINE_CLASSIFICATION,
  UNVERIFIED_LABEL,
  type KeywordStuffingResult,
} from "./model.ts";

export const KEYWORD_STUFFING_ALGORITHM_VERSION = "1.0.1" as const;
export const KEYWORD_STUFFING_INSERTION_FORMAT =
  "EVALUATION_ONLY_UNGROUNDED_TARGET_TERMS_ANNOTATION" as const;
export const KEYWORD_STUFFING_ANNOTATION_LABEL =
  "EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE" as const;
export const KEYWORD_STUFFING_ANNOTATION_TEMPLATE =
  "\\n\\n[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: <missing terms joined by ', '>]" as const;

/**
 * Frozen transformation rule: compute the overlap baseline's missing-term
 * set, then append exactly one explicit ungrounded-target annotation at the
 * document end with the missing terms in normalized sort order,
 * comma-separated. The annotation expressly denies candidate-skill or
 * experience authority. When nothing is missing the original text is
 * returned byte-identical. Terms already present are never re-inserted, and
 * repeated application is idempotent because a term appended once is no
 * longer missing.
 */
export function naiveKeywordStuffing(
  originalText: string,
  targetText: string,
): KeywordStuffingResult {
  const overlap = keywordOverlap(originalText, targetText);
  const inserted = overlap.missing_terms;
  const transformed =
    inserted.length === 0
      ? originalText
      : `${originalText}\n\n[${KEYWORD_STUFFING_ANNOTATION_LABEL}: ${inserted.join(", ")}]`;
  return {
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    algorithm_version: KEYWORD_STUFFING_ALGORITHM_VERSION,
    classification: BASELINE_CLASSIFICATION,
    transformation: "NAIVE_KEYWORD_STUFFING",
    verification_status: UNVERIFIED_LABEL,
    original_text: originalText,
    transformed_text: transformed,
    inserted_terms: inserted,
    already_present_terms: overlap.matched_terms,
    insertion_position: "DOCUMENT_END",
    insertion_format: KEYWORD_STUFFING_INSERTION_FORMAT,
    grounded_in_evidence: false,
  };
}
