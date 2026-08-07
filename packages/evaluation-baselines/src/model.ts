// Closed type model for the M02-W04 evaluation baselines.
//
// Everything in this package is EVALUATION_ONLY and NON_PRODUCTION: a
// reproducible comparison floor for later M02/M05 evaluation packages
// (spec §8.4), never a product resume, answer, matching, or autofill
// feature, and never critical-gate authority (gate execution belongs to
// M02-W14 and the M02-W15 decision; the evaluation runner to M02-W05).
import type { ContentDigest } from "./canonical-json.ts";

export const BASELINE_CATALOG_VERSION = "1.0.1" as const;
export const BASELINE_CATALOG_SCHEMA_VERSION = 1 as const;

/** Classification labels every baseline artifact must carry. */
export const BASELINE_CLASSIFICATION = [
  "EVALUATION_ONLY",
  "NON_PRODUCTION",
] as const;
export type BaselineClassification = (typeof BASELINE_CLASSIFICATION)[number];

/** One-shot raw output and naive transformations are never verified truth. */
export const UNVERIFIED_LABEL = "UNVERIFIED" as const;

export type BaselineId =
  | "baseline_keyword_overlap_v1"
  | "baseline_legacy_behavior_observation_v1"
  | "baseline_naive_keyword_stuffing_v1"
  | "baseline_one_shot_answer_generation_v1"
  | "baseline_one_shot_resume_generation_v1"
  | "baseline_original_untailored_v1";

export type BaselineKind =
  | "DETERMINISTIC_MATCHER"
  | "DETERMINISTIC_PASSTHROUGH"
  | "DETERMINISTIC_TRANSFORM"
  | "INJECTED_ONE_SHOT_GENERATION"
  | "ISOLATED_OBSERVATION_CONTRACT";

export type BaselineArtifactType =
  | "ANSWER_TEXT"
  | "LEGACY_BEHAVIOR_RECORD"
  | "RESUME_TEXT"
  | "STRUCTURED_FIXTURE_RECORD";

export interface BaselineProvenance {
  readonly authored_in: "M02-W04";
  readonly author: string;
  readonly reviewer: string;
  readonly reviewed_on: string;
}

export interface BaselineDefinition {
  readonly baseline_id: BaselineId;
  readonly title: string;
  readonly kind: BaselineKind;
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly artifact_types: readonly BaselineArtifactType[];
  readonly input_contract: string;
  readonly output_contract: string;
  readonly determinism:
    | "BYTE_DETERMINISTIC"
    | "DETERMINISTIC_GIVEN_INJECTED_GENERATOR"
    | "RECORD_VALIDATION_ONLY";
  /** Digest over the frozen algorithm/prompt parameter contract object. */
  readonly algorithm_contract_digest: ContentDigest;
  readonly prompt_id?: string;
  readonly prompt_version?: string;
  readonly prompt_digest?: ContentDigest;
  /**
   * One-shot baselines carry the honest real-model execution state: no
   * approved model lock or runtime exists (model/model-lock.json remains the
   * M05-W02 placeholder), so no real generation has been executed.
   */
  readonly real_model_execution_state?: "NOT_EXECUTED_NO_APPROVED_MODEL_LOCK";
  readonly limitations: readonly string[];
  readonly gate_authority: "NONE";
  readonly provenance: BaselineProvenance;
}

/**
 * Spec §8.4 names manually captured Simplify behavior/output as a comparison
 * baseline. M02-W04 owns only this closed slot; the actual manual capture is
 * owned by M02-W13/M02-W14 (autofill worksheets and side-by-side runs) and
 * M05-W11 (resume outputs). Nothing here fabricates an observation.
 */
export interface ComparisonSlot {
  readonly slot_id: "baseline_simplify_comparison_slot_v1";
  readonly kind: "COMPARISON_SLOT";
  readonly subject: "SIMPLIFY_MANUAL_CAPTURE";
  readonly status: "NOT_CAPTURED";
  readonly future_execution_owners: readonly ["M02-W13", "M02-W14", "M05-W11"];
  readonly constraints: readonly string[];
  readonly classification: readonly BaselineClassification[];
  readonly provenance: BaselineProvenance;
}

export interface BaselineCatalog {
  readonly catalog_version: typeof BASELINE_CATALOG_VERSION;
  readonly schema_version: typeof BASELINE_CATALOG_SCHEMA_VERSION;
  readonly classification: readonly BaselineClassification[];
  readonly gate_authority_statement: string;
  readonly baselines: readonly BaselineDefinition[];
  readonly comparison_slots: readonly [ComparisonSlot];
}

// ---------------------------------------------------------------------------
// Keyword overlap
// ---------------------------------------------------------------------------

export interface KeywordOverlapResult {
  readonly baseline_id: "baseline_keyword_overlap_v1";
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly semantics: "LEXICAL_ONLY_NOT_SEMANTIC_MATCHING";
  readonly normalized_candidate_terms: readonly string[];
  readonly normalized_target_terms: readonly string[];
  readonly matched_terms: readonly string[];
  readonly missing_terms: readonly string[];
  readonly candidate_term_count: number;
  readonly target_term_count: number;
  readonly matched_term_count: number;
  readonly missing_term_count: number;
  readonly score_numerator: number;
  readonly score_denominator: number;
  readonly score: number;
  readonly zero_target_terms: boolean;
}

// ---------------------------------------------------------------------------
// Original untailored passthrough
// ---------------------------------------------------------------------------

export interface OriginalTextResult {
  readonly baseline_id: "baseline_original_untailored_v1";
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly artifact_type: "ANSWER_TEXT" | "RESUME_TEXT";
  readonly candidate_text: string;
  readonly byte_identical_to_input: true;
}

export interface OriginalStructuredResult<T> {
  readonly baseline_id: "baseline_original_untailored_v1";
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly artifact_type: "STRUCTURED_FIXTURE_RECORD";
  readonly candidate_record: T;
  readonly input_content_digest: ContentDigest;
  readonly output_content_digest: ContentDigest;
}

// ---------------------------------------------------------------------------
// Naive keyword stuffing
// ---------------------------------------------------------------------------

export interface KeywordStuffingResult {
  readonly baseline_id: "baseline_naive_keyword_stuffing_v1";
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly transformation: "NAIVE_KEYWORD_STUFFING";
  readonly verification_status: typeof UNVERIFIED_LABEL;
  readonly original_text: string;
  readonly transformed_text: string;
  readonly inserted_terms: readonly string[];
  readonly already_present_terms: readonly string[];
  readonly insertion_position: "DOCUMENT_END";
  readonly insertion_format: "EVALUATION_ONLY_UNGROUNDED_TARGET_TERMS_ANNOTATION";
  readonly grounded_in_evidence: false;
}

// ---------------------------------------------------------------------------
// One-shot generation (injected generator boundary; no model runtime here)
// ---------------------------------------------------------------------------

export type OneShotOperation = "ANSWER_GENERATION" | "RESUME_GENERATION";

export interface OneShotGenerationRequest {
  readonly baseline_id:
    | "baseline_one_shot_answer_generation_v1"
    | "baseline_one_shot_resume_generation_v1";
  readonly operation: OneShotOperation;
  readonly prompt_id: string;
  readonly prompt_version: string;
  readonly prompt_digest: ContentDigest;
  readonly prompt_text: string;
  readonly input_refs: readonly string[];
  readonly input_digest: ContentDigest;
}

export interface OneShotGenerationResponse {
  readonly raw_text: string;
}

/**
 * The injected generation boundary. Tests and CI use deterministic
 * in-process fakes only; no provider, network, model runtime, or model lock
 * exists in this package.
 */
export interface OneShotGenerator {
  generateOnce(
    request: OneShotGenerationRequest,
  ): Promise<OneShotGenerationResponse>;
}

export interface OneShotRecord {
  readonly baseline_id:
    | "baseline_one_shot_answer_generation_v1"
    | "baseline_one_shot_resume_generation_v1";
  readonly operation: OneShotOperation;
  readonly algorithm_version: string;
  readonly classification: readonly BaselineClassification[];
  readonly prompt_id: string;
  readonly prompt_version: string;
  readonly prompt_digest: ContentDigest;
  readonly instantiated_prompt_digest: ContentDigest;
  readonly input_refs: readonly string[];
  readonly input_digest: ContentDigest;
  readonly attempted_call_count: 1;
  readonly retries: 0;
  readonly fallback_used: false;
  readonly outcome: "GENERATED" | "GENERATION_FAILED";
  readonly raw_output?: {
    readonly text: string;
    readonly verification_status: typeof UNVERIFIED_LABEL;
    readonly factual_authority: "NONE";
  };
  readonly failure?: {
    readonly reason_class: "GENERATOR_ERROR";
    readonly message: string;
  };
}

// ---------------------------------------------------------------------------
// Legacy behavior observation (isolated; no legacy code import)
// ---------------------------------------------------------------------------

export type LegacySystemId = "CAREERPULSE" | "LEGACY_JOBAPPLY";

export type LegacyObservationStatus =
  "CAPTURED" | "NOT_ATTEMPTED" | "UNAVAILABLE" | "UNRUNNABLE";

export interface LegacyFixtureInput {
  readonly fixture_id: string;
  readonly content_digest: ContentDigest;
}

export interface LegacyBehaviorObservation {
  readonly id: string;
  readonly record_version: "1.0.0";
  readonly system: LegacySystemId;
  readonly system_display_name: string;
  readonly repository_url: string | null;
  readonly source_revision: string | null;
  readonly observation_status: LegacyObservationStatus;
  /** Authored evidence date (YYYY-MM-DD), never runtime identity. */
  readonly observation_date: string;
  readonly observer: string;
  readonly environment: string;
  readonly procedure: readonly string[];
  readonly fixture_inputs: readonly LegacyFixtureInput[];
  readonly observed_output_digest: ContentDigest | null;
  readonly structured_observations: readonly string[];
  readonly safety_observations: readonly string[];
  readonly failure_or_unavailability_reason: string | null;
  readonly source_code_viewed: boolean;
  readonly code_copied: false;
  readonly comparable: boolean;
  readonly classification: "NON_PRODUCTION";
  readonly license_provenance: string;
  /**
   * Clean-room regression fixtures derived from a CAPTURED observation
   * (REQ-GATE-008). Empty unless the observation was actually captured.
   */
  readonly regression_fixture_refs: readonly string[];
  readonly provenance: BaselineProvenance;
}

export interface LegacyObservationFile {
  readonly file_version: "1.0.0";
  readonly classification: readonly BaselineClassification[];
  readonly isolation_statement: string;
  readonly records: readonly LegacyBehaviorObservation[];
}

// ---------------------------------------------------------------------------
// Development case matrix
// ---------------------------------------------------------------------------

export type DevCaseKind =
  | "KEYWORD_OVERLAP"
  | "LEGACY_OBSERVATION"
  | "NAIVE_KEYWORD_STUFFING"
  | "ONE_SHOT_ANSWER"
  | "ONE_SHOT_RESUME"
  | "ORIGINAL_UNTAILORED";

export interface InlineTextInput {
  readonly source: "INLINE";
  readonly text: string;
}

export interface FixtureTextInput {
  readonly source: "FIXTURE";
  readonly fixture_type:
    "QUESTION_CASE" | "SOURCE_RESUME" | "SYNTHETIC_JOB" | "SYNTHETIC_PROFILE";
  readonly fixture_id: string;
  readonly projection:
    | "JOB_SOURCE_BLOCK_TEXT_JOINED"
    | "PROFILE_SKILLS_JOINED"
    | "QUESTION_PROMPT_TEXT"
    | "RESUME_FACT_TEXT_JOINED";
}

export type DevCaseTextInput = FixtureTextInput | InlineTextInput;

export interface DevCase {
  readonly case_id: string;
  readonly baseline_id: BaselineId;
  readonly kind: DevCaseKind;
  readonly scenario: string;
  readonly candidate?: DevCaseTextInput;
  readonly target?: DevCaseTextInput;
  readonly structured_fixture_id?: string;
  readonly one_shot?: {
    readonly profile_id: string;
    readonly job_id: string;
    readonly resume_id?: string;
    readonly question_id?: string;
    readonly fake: "DETERMINISTIC_TEXT" | "FABRICATED_METRIC_TEXT" | "THROWS";
  };
  readonly notes: string;
}

export interface DevCaseMatrix {
  readonly matrix_version: "1.0.0";
  readonly classification: readonly BaselineClassification[];
  readonly cases: readonly DevCase[];
}

// ---------------------------------------------------------------------------
// Committed manifest (write mode authors it; check mode is read-only)
// ---------------------------------------------------------------------------

export interface ManifestSourceFile {
  readonly path: string;
  readonly sha256: ContentDigest;
}

export interface BaselineManifest {
  readonly manifest_version: 1;
  readonly catalog_version: typeof BASELINE_CATALOG_VERSION;
  readonly catalog_schema_version: typeof BASELINE_CATALOG_SCHEMA_VERSION;
  readonly catalog_digest: ContentDigest;
  readonly case_matrix_version: "1.0.0";
  readonly case_count: number;
  readonly case_matrix_digest: ContentDigest;
  readonly prompt_digests: {
    readonly one_shot_resume: ContentDigest;
    readonly one_shot_answer: ContentDigest;
  };
  readonly legacy_observation_file: {
    readonly path: string;
    readonly record_count: number;
    readonly sha256: ContentDigest;
  };
  readonly source_files: readonly ManifestSourceFile[];
  readonly combined_digest: ContentDigest;
}
