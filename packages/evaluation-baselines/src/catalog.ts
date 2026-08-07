// Versioned baseline catalog (M02-W04). Six distinct baseline concepts plus
// the closed Simplify comparison slot. The canonical digest of this catalog
// is committed in baseline.manifest.json; `baselines:check` recomputes it
// read-only and fails on any drift. Nothing in this catalog can evaluate or
// change a critical gate.
import { sha256Canonical, type ContentDigest } from "./canonical-json.ts";
import { KEYWORD_OVERLAP_ALGORITHM_VERSION } from "./keyword-overlap.ts";
import {
  KEYWORD_STUFFING_ALGORITHM_VERSION,
  KEYWORD_STUFFING_ANNOTATION_TEMPLATE,
} from "./keyword-stuffing.ts";
import { LEGACY_OBSERVATION_ALGORITHM_VERSION } from "./legacy-observation.ts";
import {
  BASELINE_CATALOG_SCHEMA_VERSION,
  BASELINE_CATALOG_VERSION,
  BASELINE_CLASSIFICATION,
  type BaselineCatalog,
  type BaselineProvenance,
} from "./model.ts";
import { NORMALIZATION_CONTRACT } from "./normalize.ts";
import { ONE_SHOT_ALGORITHM_VERSION } from "./one-shot.ts";
import { ORIGINAL_UNTAILORED_ALGORITHM_VERSION } from "./original-untailored.ts";
import {
  ONE_SHOT_ANSWER_PROMPT,
  ONE_SHOT_RESUME_PROMPT,
  promptDigest,
} from "./prompts.ts";

export const GATE_AUTHORITY_STATEMENT =
  "Baselines are an evaluation comparison floor only. They carry no product, factual, or gate authority: they cannot evaluate, change, or satisfy any critical gate, threshold, or compatibility claim. Gate execution belongs to M02-W14 and the M02-W15 decision; the evaluation runner belongs to M02-W05.";

const PROVENANCE: BaselineProvenance = {
  authored_in: "M02-W04",
  author: "m02w04-lead-author",
  reviewer: "m02w04-baseline-reviewer",
  reviewed_on: "2026-08-07",
};

const ORIGINAL_CONTRACT = {
  algorithm_version: ORIGINAL_UNTAILORED_ALGORITHM_VERSION,
  behavior: "IDENTITY_PASSTHROUGH",
  text_rule: "candidate text is byte-identical to the input text",
  structured_rule:
    "distinct output object with canonical content digest equal to the input digest; ordering preserved; input never mutated",
  metadata_rule:
    "evaluation metadata is emitted beside, never inside, the artifact",
} as const;

const OVERLAP_CONTRACT = {
  algorithm_version: KEYWORD_OVERLAP_ALGORITHM_VERSION,
  normalization: NORMALIZATION_CONTRACT,
  exposure:
    "normalized candidate terms, normalized target terms, matched terms, missing terms, counts, exact numerator/denominator score",
} as const;

const STUFFING_CONTRACT = {
  algorithm_version: KEYWORD_STUFFING_ALGORITHM_VERSION,
  source_of_terms: "keyword-overlap missing-term result over the same texts",
  insertion_position: "DOCUMENT_END",
  insertion_format: KEYWORD_STUFFING_ANNOTATION_TEMPLATE,
  term_order: "normalized ascending code-unit order",
  no_missing_terms_rule: "output is byte-identical to the original text",
  duplicate_rule:
    "only missing terms are inserted; repeated application is idempotent",
  truth_rule:
    "target-only terms are visibly EVALUATION-ONLY and UNGROUNDED, expressly not candidate skills or experience; no achievement, employer, date, metric, certification, tool, qualification, or experience claim is invented; output is UNVERIFIED and not grounded",
} as const;

function oneShotContract(promptId: string, digest: ContentDigest) {
  return {
    algorithm_version: ONE_SHOT_ALGORITHM_VERSION,
    calls: "exactly one injected generateOnce call",
    retries: 0,
    repair: "NONE",
    second_model: "NONE",
    retrieval: "NONE",
    tools: "NONE",
    verification: "NONE — raw response is preserved UNVERIFIED",
    fallback:
      "NONE — a failed call produces GENERATION_FAILED, never another baseline",
    prompt_id: promptId,
    prompt_digest: digest,
  } as const;
}

const LEGACY_CONTRACT = {
  record_version: "1.0.0",
  statuses: ["CAPTURED", "NOT_ATTEMPTED", "UNAVAILABLE", "UNRUNNABLE"],
  isolation:
    "no legacy dependency, submodule, import, vendored file, or copied source; runnable inspection only outside this repository in a temporary isolated checkout",
  capture_rule:
    "CAPTURED requires a repository URL, full lowercase 40-hex Git commit SHA, synthetic fixture inputs with digests, an observed output digest, and bounded plain-language observations",
  unavailable_rule:
    "non-captured records carry an explicit reason, comparable=false, and no fixture inputs, output digest, structured observations, safety observations, or regression fixture references",
  observation_text_rule:
    "structured and safety observations are clean-room plain-language behavior only; bounded whole-text markers and line-oriented syntax-shaped declarations, imports, modules, assignments, operators, delimiters, calls, and control statements fail closed without treating reserved words in ordinary prose as code",
  regression_rule:
    "clean-room regression fixtures may derive only from CAPTURED observations (REQ-GATE-008)",
} as const;

export const RESUME_PROMPT_DIGEST = promptDigest(ONE_SHOT_RESUME_PROMPT);
export const ANSWER_PROMPT_DIGEST = promptDigest(ONE_SHOT_ANSWER_PROMPT);

export const BASELINE_CATALOG: BaselineCatalog = {
  catalog_version: BASELINE_CATALOG_VERSION,
  schema_version: BASELINE_CATALOG_SCHEMA_VERSION,
  classification: BASELINE_CLASSIFICATION,
  gate_authority_statement: GATE_AUTHORITY_STATEMENT,
  baselines: [
    {
      baseline_id: "baseline_original_untailored_v1",
      title: "Original untailored passthrough",
      kind: "DETERMINISTIC_PASSTHROUGH",
      algorithm_version: ORIGINAL_UNTAILORED_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: [
        "RESUME_TEXT",
        "ANSWER_TEXT",
        "STRUCTURED_FIXTURE_RECORD",
      ],
      input_contract:
        "synthetic fixture text or structured fixture record from the public W01/W02 development corpus",
      output_contract:
        "identical artifact (byte-identical text; digest-identical structured record) plus separate evaluation metadata",
      determinism: "BYTE_DETERMINISTIC",
      algorithm_contract_digest: sha256Canonical(ORIGINAL_CONTRACT),
      limitations: [
        "No tailoring occurs by definition; this is the untouched floor every later system must beat.",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
    {
      baseline_id: "baseline_keyword_overlap_v1",
      title: "Keyword overlap (lexical unigram matcher)",
      kind: "DETERMINISTIC_MATCHER",
      algorithm_version: KEYWORD_OVERLAP_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: ["RESUME_TEXT", "ANSWER_TEXT"],
      input_contract: "candidate text and target/job text",
      output_contract:
        "reproducible term sets, matched/missing terms, counts, and exact numerator/denominator score in [0,1]",
      determinism: "BYTE_DETERMINISTIC",
      algorithm_contract_digest: sha256Canonical(OVERLAP_CONTRACT),
      limitations: [
        "Lexical only: a matched term proves no supporting evidence, and a missing term proves no absent skill (this is not semantic matching).",
        "Unigrams only: multi-word phrases, stemming, and synonyms are deliberately out of scope.",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
    {
      baseline_id: "baseline_naive_keyword_stuffing_v1",
      title: "Naive keyword stuffing (intentionally weak)",
      kind: "DETERMINISTIC_TRANSFORM",
      algorithm_version: KEYWORD_STUFFING_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: ["RESUME_TEXT"],
      input_contract: "original synthetic text and target/job text",
      output_contract: `original text preserved separately plus transformed text with one appended ${KEYWORD_STUFFING_ANNOTATION_TEMPLATE}, labeled UNVERIFIED and explicitly not a candidate claim`,
      determinism: "BYTE_DETERMINISTIC",
      algorithm_contract_digest: sha256Canonical(STUFFING_CONTRACT),
      limitations: [
        "Deliberately inadequate: inserted target terms are ungrounded lexical annotations with no evidence, truthfulness, ATS-safety, readability, candidate-skill, or experience claim.",
        "Exists to demonstrate why raw keyword insertion is not tailoring.",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
    {
      baseline_id: "baseline_one_shot_resume_generation_v1",
      title: "One-shot resume generation (injected single call)",
      kind: "INJECTED_ONE_SHOT_GENERATION",
      algorithm_version: ONE_SHOT_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: ["RESUME_TEXT"],
      input_contract:
        "synthetic profile, job, and source resume fixture records plus an injected generateOnce implementation",
      output_contract:
        "one raw UNVERIFIED response (or GENERATION_FAILED) with prompt version/digest, input refs/digest, and exactly-one-call accounting",
      determinism: "DETERMINISTIC_GIVEN_INJECTED_GENERATOR",
      algorithm_contract_digest: sha256Canonical(
        oneShotContract(ONE_SHOT_RESUME_PROMPT.prompt_id, RESUME_PROMPT_DIGEST),
      ),
      prompt_id: ONE_SHOT_RESUME_PROMPT.prompt_id,
      prompt_version: ONE_SHOT_RESUME_PROMPT.prompt_version,
      prompt_digest: RESUME_PROMPT_DIGEST,
      real_model_execution_state: "NOT_EXECUTED_NO_APPROVED_MODEL_LOCK",
      limitations: [
        "The prompt instructs against inventing facts, but nothing verifies the raw response; it stays UNVERIFIED with no factual authority.",
        "CI uses deterministic in-process fakes only; no approved model lock or runtime exists (model/model-lock.json remains the M05-W02 placeholder).",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
    {
      baseline_id: "baseline_one_shot_answer_generation_v1",
      title: "One-shot short-answer generation (injected single call)",
      kind: "INJECTED_ONE_SHOT_GENERATION",
      algorithm_version: ONE_SHOT_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: ["ANSWER_TEXT"],
      input_contract:
        "synthetic question, profile, and job fixture records plus an injected generateOnce implementation",
      output_contract:
        "one raw UNVERIFIED response (or GENERATION_FAILED) with prompt version/digest, input refs/digest, and exactly-one-call accounting",
      determinism: "DETERMINISTIC_GIVEN_INJECTED_GENERATOR",
      algorithm_contract_digest: sha256Canonical(
        oneShotContract(ONE_SHOT_ANSWER_PROMPT.prompt_id, ANSWER_PROMPT_DIGEST),
      ),
      prompt_id: ONE_SHOT_ANSWER_PROMPT.prompt_id,
      prompt_version: ONE_SHOT_ANSWER_PROMPT.prompt_version,
      prompt_digest: ANSWER_PROMPT_DIGEST,
      real_model_execution_state: "NOT_EXECUTED_NO_APPROVED_MODEL_LOCK",
      limitations: [
        "A poor, unsupported, or fabricated raw fake response is preserved verbatim as UNVERIFIED rather than silently corrected.",
        "CI uses deterministic in-process fakes only; no approved model lock or runtime exists (model/model-lock.json remains the M05-W02 placeholder).",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
    {
      baseline_id: "baseline_legacy_behavior_observation_v1",
      title:
        "Isolated legacy behavior observation (CareerPulse / legacy JobApply)",
      kind: "ISOLATED_OBSERVATION_CONTRACT",
      algorithm_version: LEGACY_OBSERVATION_ALGORITHM_VERSION,
      classification: BASELINE_CLASSIFICATION,
      artifact_types: ["LEGACY_BEHAVIOR_RECORD"],
      input_contract:
        "closed observation records authored from isolated, out-of-repository inspection only",
      output_contract:
        "validated records with explicit CAPTURED/UNAVAILABLE/UNRUNNABLE/NOT_ATTEMPTED states, provenance, and clean-room isolation proofs",
      determinism: "RECORD_VALIDATION_ONLY",
      algorithm_contract_digest: sha256Canonical(LEGACY_CONTRACT),
      limitations: [
        "No behavior has been captured yet: committed records are truthful non-captured states; the measured clean-room capture harness is owned by M02-W13.",
        "Copying legacy code remains prohibited without license/provenance review and an approved ADR (REQ-GATE-007).",
      ],
      gate_authority: "NONE",
      provenance: PROVENANCE,
    },
  ],
  comparison_slots: [
    {
      slot_id: "baseline_simplify_comparison_slot_v1",
      kind: "COMPARISON_SLOT",
      subject: "SIMPLIFY_MANUAL_CAPTURE",
      status: "NOT_CAPTURED",
      future_execution_owners: ["M02-W13", "M02-W14", "M05-W11"],
      constraints: [
        "Manual, terms-compliant capture on the same synthetic profile and content examples only (spec §5.13, §8.4).",
        "No live employer workflow is automated to populate this slot, and no observation is fabricated.",
      ],
      classification: BASELINE_CLASSIFICATION,
      provenance: PROVENANCE,
    },
  ],
};

export function catalogDigest(): ContentDigest {
  return sha256Canonical(BASELINE_CATALOG);
}
