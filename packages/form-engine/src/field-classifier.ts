// M02-W09 deterministic field classifier (spec §5.11.4).
//
// Classification operates only on evidence the canonical W08 descriptor
// actually exposes: normalized label/description text, section-context
// tokens, control kind, and option labels/tokens. The score is a
// transparent, bounded rule aggregate — it is NOT a learned probability —
// and every contribution is reported as a typed evidence entry. Negative
// evidence can only lower confidence or defeat a candidate; corroboration
// can only raise it; ties and thin evidence abstain. Abstention is a
// first-class successful result, never an error.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import {
  containsPhrase,
  equalsPhrase,
  isPlaceholderOptionLabel,
  normalizeEvidence,
  sectionTokenMatches,
} from "./evidence-text.ts";
import {
  type ConceptRule,
  type FeasibilityConcept,
  feasibilityCatalog,
} from "./ontology.ts";

/**
 * Deterministic calibration constants. The two thresholds line up with the
 * canonical FIELD_DECISION_AUTHORITY semantic rule: FILL requires >= 0.75
 * classification confidence and < 0.5 is the canonical low-confidence
 * boundary. They are rule anchors, not fixture-tuned values.
 */
export const DETERMINISTIC_ACCEPT_THRESHOLD = 0.75;
export const REVIEW_THRESHOLD = 0.5;
export const AMBIGUITY_MARGIN = 0.2;
export const MAX_RULE_CONFIDENCE = 0.98;

const EXACT_LABEL_SCORE = 0.9;
const ALIAS_PHRASE_SCORE = 0.7;
const DESCRIPTION_ONLY_SCORE = 0.4;
const CORROBORATION_BONUS = 0.05;
const SECTION_CONFLICT_PENALTY = 0.3;

export type ClassificationEvidenceCode =
  | "EXACT_LABEL_MATCH"
  | "ALIAS_PHRASE_MATCH"
  | "DESCRIPTION_ONLY_MATCH"
  | "DESCRIPTION_ALIAS_MATCH"
  | "SECTION_SUPPORT"
  | "SECTION_CONFLICT"
  | "OPTION_SET_SUPPORT"
  | "NEGATIVE_TERM_CONFLICT"
  | "CONTROL_KIND_INCOMPATIBLE";

export interface ClassificationEvidence {
  readonly concept: FeasibilityConcept;
  readonly code: ClassificationEvidenceCode;
  /** Signed score contribution; 0 for hard defeats. */
  readonly delta: number;
}

export interface ConceptCandidate {
  readonly concept: FeasibilityConcept;
  readonly confidence: number;
  readonly defeated: boolean;
  readonly evidence: readonly ClassificationEvidence[];
}

export type ClassificationAbstentionReason =
  | "UNSUPPORTED_CONTROL_KIND"
  | "NO_LABEL_EVIDENCE"
  | "NO_MATCHING_CONCEPT"
  | "NEGATIVE_EVIDENCE_CONFLICT"
  | "TIED_CANDIDATES"
  | "AMBIGUOUS_CANDIDATES";

export type FieldClassification =
  | {
      readonly status: "CLASSIFIED";
      readonly concept: FeasibilityConcept;
      readonly confidence: number;
      readonly band: "DETERMINISTIC" | "REVIEW";
      readonly candidates: readonly ConceptCandidate[];
    }
  | {
      readonly status: "ABSTAINED";
      readonly reason: ClassificationAbstentionReason;
      readonly topConfidence: number;
      readonly candidates: readonly ConceptCandidate[];
    };

function labelEvidence(descriptor: FormFieldDescriptorV1): string {
  return descriptor.label.normalized_text ?? "";
}

function descriptionEvidence(descriptor: FormFieldDescriptorV1): string {
  return descriptor.description?.normalized_text ?? "";
}

function bestAliasMatch(
  rule: ConceptRule,
  text: string,
): "EXACT" | "PHRASE" | "NONE" {
  if (text === "") {
    return "NONE";
  }
  let best: "EXACT" | "PHRASE" | "NONE" = "NONE";
  for (const alias of rule.aliases) {
    if (equalsPhrase(text, alias)) {
      return "EXACT";
    }
    if (containsPhrase(text, alias)) {
      best = "PHRASE";
    }
  }
  return best;
}

function optionSetSupports(
  rule: ConceptRule,
  descriptor: FormFieldDescriptorV1,
): boolean {
  if (rule.optionValues.length === 0 || descriptor.options.length === 0) {
    return false;
  }
  return descriptor.options.some((option) => {
    const optionLabel = option.label.normalized_text ?? "";
    if (optionLabel !== "" && isPlaceholderOptionLabel(optionLabel)) {
      return false;
    }
    return rule.optionValues.some(
      (value) =>
        (optionLabel !== "" &&
          value.acceptedLabels.some((accepted) =>
            equalsPhrase(optionLabel, accepted),
          )) ||
        (option.stable_value_token !== undefined &&
          value.acceptedTokens.includes(option.stable_value_token)),
    );
  });
}

function scoreConcept(
  rule: ConceptRule,
  descriptor: FormFieldDescriptorV1,
): ConceptCandidate {
  const evidence: ClassificationEvidence[] = [];
  const label = labelEvidence(descriptor);
  const description = descriptionEvidence(descriptor);

  if (!rule.compatibleControlKinds.includes(descriptor.control_kind)) {
    evidence.push({
      concept: rule.concept,
      code: "CONTROL_KIND_INCOMPATIBLE",
      delta: 0,
    });
    return { concept: rule.concept, confidence: 0, defeated: true, evidence };
  }

  const negativeTerm = rule.negativeLabelTerms.find(
    (term) =>
      (label !== "" && containsPhrase(label, term)) ||
      (description !== "" && containsPhrase(description, term)),
  );
  if (negativeTerm !== undefined) {
    evidence.push({
      concept: rule.concept,
      code: "NEGATIVE_TERM_CONFLICT",
      delta: 0,
    });
    return { concept: rule.concept, confidence: 0, defeated: true, evidence };
  }

  let score = 0;
  const labelMatch = bestAliasMatch(rule, label);
  const descriptionMatch = bestAliasMatch(rule, description);
  if (labelMatch === "EXACT") {
    score += EXACT_LABEL_SCORE;
    evidence.push({
      concept: rule.concept,
      code: "EXACT_LABEL_MATCH",
      delta: EXACT_LABEL_SCORE,
    });
  } else if (labelMatch === "PHRASE") {
    score += ALIAS_PHRASE_SCORE;
    evidence.push({
      concept: rule.concept,
      code: "ALIAS_PHRASE_MATCH",
      delta: ALIAS_PHRASE_SCORE,
    });
  }
  if (descriptionMatch !== "NONE") {
    if (labelMatch === "NONE") {
      score += DESCRIPTION_ONLY_SCORE;
      evidence.push({
        concept: rule.concept,
        code: "DESCRIPTION_ONLY_MATCH",
        delta: DESCRIPTION_ONLY_SCORE,
      });
    } else {
      score += CORROBORATION_BONUS;
      evidence.push({
        concept: rule.concept,
        code: "DESCRIPTION_ALIAS_MATCH",
        delta: CORROBORATION_BONUS,
      });
    }
  }

  if (score === 0) {
    return { concept: rule.concept, confidence: 0, defeated: false, evidence };
  }

  const sections = descriptor.section_context;
  const supports = sections.some((token) =>
    rule.supportingSections.some((phrase) =>
      sectionTokenMatches(token, phrase),
    ),
  );
  const conflicts = sections.some((token) =>
    rule.conflictingSections.some((phrase) =>
      sectionTokenMatches(token, phrase),
    ),
  );
  if (supports) {
    score += CORROBORATION_BONUS;
    evidence.push({
      concept: rule.concept,
      code: "SECTION_SUPPORT",
      delta: CORROBORATION_BONUS,
    });
  }
  // Section context corroborates or contradicts; it can never overcome
  // strong contradictory field evidence on its own because its magnitude is
  // bounded far below a defeat.
  if (conflicts) {
    score -= SECTION_CONFLICT_PENALTY;
    evidence.push({
      concept: rule.concept,
      code: "SECTION_CONFLICT",
      delta: -SECTION_CONFLICT_PENALTY,
    });
  }

  if (optionSetSupports(rule, descriptor)) {
    score += CORROBORATION_BONUS;
    evidence.push({
      concept: rule.concept,
      code: "OPTION_SET_SUPPORT",
      delta: CORROBORATION_BONUS,
    });
  }

  const confidence = Math.min(Math.max(score, 0), MAX_RULE_CONFIDENCE);
  return { concept: rule.concept, confidence, defeated: false, evidence };
}

/**
 * Deterministically classify one canonical W08 descriptor against the
 * closed feasibility catalog. Identical descriptors always produce the
 * identical result; no time, randomness, or ambient state participates.
 */
export function classifyField(
  descriptor: FormFieldDescriptorV1,
): FieldClassification {
  const candidates = feasibilityCatalog().map((rule) =>
    scoreConcept(rule, descriptor),
  );
  const reported = [...candidates].sort(
    (left, right) =>
      right.confidence - left.confidence ||
      left.concept.localeCompare(right.concept),
  );

  if (
    descriptor.control_kind === "UNKNOWN" ||
    descriptor.control_kind === "FILE"
  ) {
    return {
      status: "ABSTAINED",
      reason: "UNSUPPORTED_CONTROL_KIND",
      topConfidence: 0,
      candidates: reported,
    };
  }

  if (
    normalizeEvidence(labelEvidence(descriptor)) === "" &&
    normalizeEvidence(descriptionEvidence(descriptor)) === ""
  ) {
    return {
      status: "ABSTAINED",
      reason: "NO_LABEL_EVIDENCE",
      topConfidence: 0,
      candidates: reported,
    };
  }

  const qualified = reported.filter(
    (candidate) =>
      !candidate.defeated && candidate.confidence >= REVIEW_THRESHOLD,
  );
  const top = qualified[0];
  if (top === undefined) {
    const negativeDefeat = reported.some((candidate) =>
      candidate.evidence.some(
        (entry) => entry.code === "NEGATIVE_TERM_CONFLICT",
      ),
    );
    return {
      status: "ABSTAINED",
      reason: negativeDefeat
        ? "NEGATIVE_EVIDENCE_CONFLICT"
        : "NO_MATCHING_CONCEPT",
      topConfidence: reported[0]?.confidence ?? 0,
      candidates: reported,
    };
  }

  const runnerUp = qualified[1];
  if (runnerUp !== undefined) {
    if (runnerUp.confidence === top.confidence) {
      // A tied pair never silently selects the first candidate.
      return {
        status: "ABSTAINED",
        reason: "TIED_CANDIDATES",
        topConfidence: top.confidence,
        candidates: reported,
      };
    }
    if (top.confidence - runnerUp.confidence < AMBIGUITY_MARGIN) {
      return {
        status: "ABSTAINED",
        reason: "AMBIGUOUS_CANDIDATES",
        topConfidence: top.confidence,
        candidates: reported,
      };
    }
  }

  return {
    status: "CLASSIFIED",
    concept: top.concept,
    confidence: top.confidence,
    band:
      top.confidence >= DETERMINISTIC_ACCEPT_THRESHOLD
        ? "DETERMINISTIC"
        : "REVIEW",
    candidates: reported,
  };
}
