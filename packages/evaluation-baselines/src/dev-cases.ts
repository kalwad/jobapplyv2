// Finite development-only baseline case matrix (M02-W04). Cases bind the
// public synthetic W01/W02 development corpus (via @japp/test-fixtures) or
// small inline lexical edge texts. This matrix is NOT a frozen benchmark
// corpus, holdout body, or threshold set: corpus freezing belongs to
// M02-W06 and result issuance to M02-W05. Expected values live in the
// test-owned literal oracle, never here.
import { sha256Canonical, type ContentDigest } from "./canonical-json.ts";
import {
  BASELINE_CLASSIFICATION,
  type DevCase,
  type DevCaseMatrix,
} from "./model.ts";

function caseId(ordinal: number): string {
  return `bcase_${String(ordinal).padStart(26, "0")}`;
}

const PROFILE_1 = "profile_00000000000000000000000001";
const PROFILE_2 = "profile_00000000000000000000000002";
const PROFILE_3 = "profile_00000000000000000000000003";
const RESUME_1 = "resume_00000000000000000000000001";
const JOB_1 = "job_00000000000000000000000001";
const JOB_3 = "job_00000000000000000000000003";
const JOB_5 = "job_00000000000000000000000005";
const JOB_8 = "job_00000000000000000000000008";
const QUESTION_MOTIVATION = "question_00000000000000000000000001";
const QUESTION_ML_EXPERIENCE = "question_00000000000000000000000016";
const QUESTION_SALARY = "question_00000000000000000000000061";
const QUESTION_RELOCATION = "question_00000000000000000000000067";

const RESUME_1_FACTS = {
  source: "FIXTURE",
  fixture_type: "SOURCE_RESUME",
  fixture_id: RESUME_1,
  projection: "RESUME_FACT_TEXT_JOINED",
} as const;

const JOB_1_BLOCKS = {
  source: "FIXTURE",
  fixture_type: "SYNTHETIC_JOB",
  fixture_id: JOB_1,
  projection: "JOB_SOURCE_BLOCK_TEXT_JOINED",
} as const;

const CASES: readonly DevCase[] = [
  // -------------------------------------------------------------- overlap
  {
    case_id: caseId(1),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "NO_OVERLAP",
    candidate: { source: "INLINE", text: "alpha bravo charlie" },
    target: { source: "INLINE", text: "delta echo foxtrot" },
    notes: "Disjoint term sets score exactly 0/3.",
  },
  {
    case_id: caseId(2),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "COMPLETE_OVERLAP",
    candidate: { source: "INLINE", text: "TypeScript and Node.js" },
    target: { source: "INLINE", text: "typescript node.js" },
    notes: "Every unique target term is present; score is exactly 1.",
  },
  {
    case_id: caseId(3),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "PARTIAL_OVERLAP_FIXTURE",
    candidate: RESUME_1_FACTS,
    target: JOB_1_BLOCKS,
    notes:
      "Real W01 corpus binding: resume 1 fact text against job 1 requirement blocks.",
  },
  {
    case_id: caseId(4),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "DUPLICATE_TERMS_UNIQUE_SET",
    candidate: { source: "INLINE", text: "python python PYTHON python" },
    target: { source: "INLINE", text: "python sql python" },
    notes: "Duplicates collapse to unique term sets on both sides (1/2).",
  },
  {
    case_id: caseId(5),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "PUNCTUATION_CASE_WHITESPACE_VARIANTS",
    candidate: { source: "INLINE", text: "  TypeScript,   NODE.JS!  " },
    target: { source: "INLINE", text: "typescript node.js" },
    notes:
      "Case, punctuation, and whitespace variants normalize to identical terms.",
  },
  {
    case_id: caseId(6),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "HYPHEN_SLASH_SEPARATION",
    candidate: { source: "INLINE", text: "node-js ci/cd" },
    target: { source: "INLINE", text: "node js CD CI" },
    notes: "Hyphen and slash always separate tokens on both sides.",
  },
  {
    case_id: caseId(7),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "EMPTY_CANDIDATE",
    candidate: { source: "INLINE", text: "" },
    target: { source: "INLINE", text: "python sql" },
    notes: "Empty candidate matches nothing; every target term is missing.",
  },
  {
    case_id: caseId(8),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "EMPTY_TARGET_ZERO_DENOMINATOR",
    candidate: { source: "INLINE", text: "python" },
    target: { source: "INLINE", text: "" },
    notes: "Empty target term set scores 0 with the explicit zero flag.",
  },
  {
    case_id: caseId(9),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "MISLEADING_LEXICAL_OVERLAP_WITHOUT_EVIDENCE",
    candidate: {
      source: "INLINE",
      text: "I hope to learn TypeScript someday.",
    },
    target: { source: "INLINE", text: "TypeScript" },
    notes:
      "Lexical match without supporting evidence: the score is 1 while nothing demonstrates the skill — lexical overlap is not semantic matching.",
  },
  {
    case_id: caseId(10),
    baseline_id: "baseline_keyword_overlap_v1",
    kind: "KEYWORD_OVERLAP",
    scenario: "STABLE_TIE_AND_ORDER",
    candidate: { source: "INLINE", text: "beta zeta" },
    target: { source: "INLINE", text: "zeta alpha zeta beta" },
    notes:
      "Matched and missing term arrays use the frozen ascending code-unit order regardless of input order.",
  },
  // ------------------------------------------------------------- original
  {
    case_id: caseId(11),
    baseline_id: "baseline_original_untailored_v1",
    kind: "ORIGINAL_UNTAILORED",
    scenario: "STRUCTURED_RECORD_IDENTITY",
    structured_fixture_id: RESUME_1,
    notes:
      "Structured passthrough of the full source-resume record: distinct object, identical canonical digest.",
  },
  {
    case_id: caseId(12),
    baseline_id: "baseline_original_untailored_v1",
    kind: "ORIGINAL_UNTAILORED",
    scenario: "TEXT_IDENTITY",
    candidate: RESUME_1_FACTS,
    notes: "Text passthrough is byte-identical to the input projection.",
  },
  {
    case_id: caseId(13),
    baseline_id: "baseline_original_untailored_v1",
    kind: "ORIGINAL_UNTAILORED",
    scenario: "INPUT_NON_MUTATION",
    structured_fixture_id: RESUME_1,
    notes:
      "The input record's canonical digest is unchanged after the passthrough executes.",
  },
  // ------------------------------------------------------------- stuffing
  {
    case_id: caseId(14),
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    kind: "NAIVE_KEYWORD_STUFFING",
    scenario: "NO_MISSING_TERMS",
    candidate: { source: "INLINE", text: "python sql modeling" },
    target: { source: "INLINE", text: "python sql" },
    notes: "Nothing is missing, so the output is byte-identical to the input.",
  },
  {
    case_id: caseId(15),
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    kind: "NAIVE_KEYWORD_STUFFING",
    scenario: "ONE_MISSING_TERM",
    candidate: { source: "INLINE", text: "python experience" },
    target: { source: "INLINE", text: "python sql" },
    notes: "Exactly one missing term is appended in the frozen format.",
  },
  {
    case_id: caseId(16),
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    kind: "NAIVE_KEYWORD_STUFFING",
    scenario: "SEVERAL_MISSING_TERMS_FIXTURE",
    candidate: RESUME_1_FACTS,
    target: JOB_1_BLOCKS,
    notes:
      "Real W01 corpus binding: the job's missing lexical terms are appended, unsupported and UNVERIFIED.",
  },
  {
    case_id: caseId(17),
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    kind: "NAIVE_KEYWORD_STUFFING",
    scenario: "DUPLICATE_PREVENTION_IDEMPOTENT",
    candidate: RESUME_1_FACTS,
    target: JOB_1_BLOCKS,
    notes:
      "Applying the transformation to its own output inserts nothing further: already-present terms are never duplicated.",
  },
  {
    case_id: caseId(18),
    baseline_id: "baseline_naive_keyword_stuffing_v1",
    kind: "NAIVE_KEYWORD_STUFFING",
    scenario: "DETERMINISTIC_REPLAY_UNVERIFIED",
    candidate: RESUME_1_FACTS,
    target: JOB_1_BLOCKS,
    notes:
      "Repeated execution on identical input is byte-identical, and every inserted term remains explicitly UNVERIFIED.",
  },
  // ------------------------------------------------------ one-shot resume
  {
    case_id: caseId(19),
    baseline_id: "baseline_one_shot_resume_generation_v1",
    kind: "ONE_SHOT_RESUME",
    scenario: "SUCCESSFUL_DETERMINISTIC_FAKE",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      resume_id: RESUME_1,
      fake: "DETERMINISTIC_TEXT",
    },
    notes: "One injected call returns a deterministic fake resume text.",
  },
  {
    case_id: caseId(20),
    baseline_id: "baseline_one_shot_resume_generation_v1",
    kind: "ONE_SHOT_RESUME",
    scenario: "FAILED_GENERATOR_CALL",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      resume_id: RESUME_1,
      fake: "THROWS",
    },
    notes:
      "A failed call produces GENERATION_FAILED with no retry, no repair, and no fallback.",
  },
  {
    case_id: caseId(21),
    baseline_id: "baseline_one_shot_resume_generation_v1",
    kind: "ONE_SHOT_RESUME",
    scenario: "EXACTLY_ONE_CALL_ENFORCED",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      resume_id: RESUME_1,
      fake: "DETERMINISTIC_TEXT",
    },
    notes: "A strict fake that rejects a second call observes exactly one.",
  },
  {
    case_id: caseId(22),
    baseline_id: "baseline_one_shot_resume_generation_v1",
    kind: "ONE_SHOT_RESUME",
    scenario: "PROMPT_AND_INPUT_DIGEST_STABILITY",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      resume_id: RESUME_1,
      fake: "DETERMINISTIC_TEXT",
    },
    notes:
      "Prompt digest, instantiated prompt digest, and input digest are identical across repeated runs.",
  },
  // ------------------------------------------------------ one-shot answer
  {
    case_id: caseId(23),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "NARRATIVE_QUESTION",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      question_id: QUESTION_MOTIVATION,
      fake: "DETERMINISTIC_TEXT",
    },
    notes: "Narrative motivation question answered by one injected call.",
  },
  {
    case_id: caseId(24),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "FACTUAL_QUESTION",
    one_shot: {
      profile_id: PROFILE_2,
      job_id: JOB_3,
      question_id: QUESTION_RELOCATION,
      fake: "DETERMINISTIC_TEXT",
    },
    notes:
      "Factual relocation question: the raw one-shot output carries no factual authority even when it looks factual.",
  },
  {
    case_id: caseId(25),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "INSUFFICIENT_EVIDENCE_RAW_PRESERVED",
    one_shot: {
      profile_id: PROFILE_3,
      job_id: JOB_8,
      question_id: QUESTION_ML_EXPERIENCE,
      fake: "FABRICATED_METRIC_TEXT",
    },
    notes:
      "The corpus marks this question insufficient-evidence; the fake fabricates a metric anyway and the record preserves it verbatim as UNVERIFIED instead of silently correcting it.",
  },
  {
    case_id: caseId(26),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "SENSITIVE_CONSEQUENTIAL_QUESTION",
    one_shot: {
      profile_id: PROFILE_3,
      job_id: JOB_5,
      question_id: QUESTION_SALARY,
      fake: "DETERMINISTIC_TEXT",
    },
    notes:
      "Sensitive salary question: the raw response stays UNVERIFIED with no authority; sensitive-field policy enforcement is deliberately outside this baseline.",
  },
  {
    case_id: caseId(27),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "FAILED_GENERATOR_CALL",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      question_id: QUESTION_MOTIVATION,
      fake: "THROWS",
    },
    notes:
      "A failed call produces GENERATION_FAILED with no retry and no fallback to another baseline.",
  },
  {
    case_id: caseId(28),
    baseline_id: "baseline_one_shot_answer_generation_v1",
    kind: "ONE_SHOT_ANSWER",
    scenario: "EXACTLY_ONE_CALL_ENFORCED",
    one_shot: {
      profile_id: PROFILE_1,
      job_id: JOB_1,
      question_id: QUESTION_MOTIVATION,
      fake: "DETERMINISTIC_TEXT",
    },
    notes: "A strict fake that rejects a second call observes exactly one.",
  },
  // ---------------------------------------------------- legacy observation
  {
    case_id: caseId(29),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "VALID_CAPTURED_RECORD",
    notes:
      "A synthetic in-memory CAPTURED record with fixture inputs, digests, revision, and observations validates.",
  },
  {
    case_id: caseId(30),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "TRUTHFUL_UNAVAILABLE_RECORD",
    notes:
      "The committed CareerPulse record is truthfully UNAVAILABLE with an explicit reason and no fabricated behavior.",
  },
  {
    case_id: caseId(31),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "MALFORMED_PROVENANCE_REJECTED",
    notes: "A record without complete provenance fails closed.",
  },
  {
    case_id: caseId(32),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "MISSING_SOURCE_REVISION_REJECTED",
    notes: "A CAPTURED record without an exact source revision fails closed.",
  },
  {
    case_id: caseId(33),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "COPIED_SOURCE_SNIPPET_REJECTED",
    notes:
      "A record carrying legacy source code or snippets fails closed (clean-room isolation).",
  },
  {
    case_id: caseId(34),
    baseline_id: "baseline_legacy_behavior_observation_v1",
    kind: "LEGACY_OBSERVATION",
    scenario: "INCONSISTENT_COMPARABILITY_REJECTED",
    notes: "A non-captured record claiming comparability fails closed.",
  },
];

export const DEV_CASE_MATRIX: DevCaseMatrix = {
  matrix_version: "1.0.0",
  classification: BASELINE_CLASSIFICATION,
  cases: CASES,
};

export function caseMatrixDigest(): ContentDigest {
  return sha256Canonical(DEV_CASE_MATRIX);
}
