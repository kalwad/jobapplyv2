// NAIVE_KEYWORD_STUFFING baseline (M02-W04): one deliberately simplistic,
// intentionally weak deterministic transformation. It exists to demonstrate
// why raw keyword insertion is inadequate — the inserted terms are bare
// lexical tokens from the target text, appended without evidence, grounding,
// or any truth claim. The record labels the output UNVERIFIED and preserves
// the original input separately. No achievement, employer, date, metric,
// certification, tool, or experience claim is ever invented: only the
// missing lexical terms themselves are appended.
import { keywordOverlap } from "./keyword-overlap.ts";
import {
  BASELINE_CLASSIFICATION,
  UNVERIFIED_LABEL,
  type KeywordStuffingResult,
} from "./model.ts";

export const KEYWORD_STUFFING_ALGORITHM_VERSION = "1.0.0" as const;

/**
 * Frozen transformation rule: compute the overlap baseline's missing-term
 * set, then append exactly one `Skills:` line at the document end with the
 * missing terms in normalized sort order, comma-separated. When nothing is
 * missing the original text is returned byte-identical. Terms already
 * present are never re-inserted, and repeated application is idempotent
 * because a term appended once is no longer missing.
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
      : `${originalText}\n\nSkills: ${inserted.join(", ")}`;
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
    insertion_format: "SKILLS_LINE_COMMA_SEPARATED",
    grounded_in_evidence: false,
  };
}
