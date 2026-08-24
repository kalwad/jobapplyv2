/**
 * Field ontology, resolver, and fill primitives (spec §5.11): M02-W09
 * implements the deterministic feasibility ontology, classifier, option
 * resolver, safety policy, decision resolver, and inert optional
 * AI-proposal boundary. W10 owns control drivers and execution; M18 owns
 * production hardening. Nothing here performs or authorizes a browser
 * action.
 */
export const PACKAGE_NAME = "@japp/form-engine";

export {
  FEASIBILITY_CONCEPTS,
  FEASIBILITY_ONTOLOGY_VERSION,
  FEASIBILITY_VALUE_POLICIES,
  UNKNOWN_CONCEPT,
  conceptRule,
  feasibilityCatalog,
  isFeasibilityConcept,
  isFeasibilityValuePolicy,
  strictestPolicy,
  type ConceptRule,
  type FeasibilityConcept,
  type FeasibilityValuePolicy,
  type OptionValueRule,
} from "./ontology.ts";
export {
  containsPhrase,
  equalsPhrase,
  evidenceWords,
  isPlaceholderOptionLabel,
  normalizeEvidence,
  sectionTokenMatches,
} from "./evidence-text.ts";
export {
  AMBIGUITY_MARGIN,
  DETERMINISTIC_ACCEPT_THRESHOLD,
  MAX_RULE_CONFIDENCE,
  REVIEW_THRESHOLD,
  classifyField,
  type ClassificationAbstentionReason,
  type ClassificationEvidence,
  type ClassificationEvidenceCode,
  type ConceptCandidate,
  type FieldClassification,
} from "./field-classifier.ts";
export {
  resolveIntendedOption,
  type OptionMatchBasis,
  type OptionResolution,
} from "./option-resolver.ts";
export {
  buildApprovedRecordSet,
  type ApprovedRecordConfirmation,
  type ApprovedRecordSet,
  type ApprovedSyntheticRecord,
  type RecordConfirmationState,
} from "./approved-records.ts";
export {
  FILL_CLASSIFICATION_MINIMUM,
  FILL_VALUE_MINIMUM,
  effectivePolicy,
  policyClassOf,
  synthesizePolicy,
  type PolicyClass,
  type PolicySynthesis,
  type PolicySynthesisInput,
} from "./safety-policy.ts";
export {
  resolveFieldDecision,
  type DecisionResolutionOutcome,
  type DecisionResolutionRequest,
  type FieldDecisionResolution,
} from "./decision-resolver.ts";
export {
  FIELD_PROPOSAL_SCHEMA_VERSION,
  MAX_PROPOSAL_TIMEOUT_MS,
  PROPOSAL_CONFIDENCE_CEILING,
  applyOptionalProposal,
  applyOptionalProposalAttempt,
  attemptOptionalProposal,
  conceptAcceptsModelProposal,
  parseFieldProposal,
  type FieldProposal,
  type OptionalProposalAttempt,
  type OptionalProposalOutcome,
} from "./ai-proposal.ts";
export {
  canonicalJson,
  semanticDigest,
  stableSemanticId,
} from "./semantic-digest.ts";
