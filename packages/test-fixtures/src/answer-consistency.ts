import {
  boundaryLimit,
  measureAnswerAgainstConstraint,
} from "./answer-metrics.ts";
import type { FixtureValidationIssue } from "./consistency.ts";
import { safeDiagnosticPointer, safeDiagnosticToken } from "./diagnostics.ts";
import type {
  AnswerConstraint,
  AnswerOutcome,
  AnswerScenario,
  EvidenceArtifact,
  ExpectedAction,
  FieldConcept,
  FieldValuePolicy,
  FieldValuePolicyKind,
  FixtureCorpus,
  InsufficiencyReason,
  QuestionCase,
  QuestionIntent,
  SensitiveConcept,
  StaleReason,
  SyntheticJob,
  SyntheticProfile,
} from "./model.ts";
import { policyDecisionAt } from "./temporal-policy.ts";

export const QUESTION_INTENTS: readonly QuestionIntent[] = [
  "AVAILABILITY",
  "CAREER_GOAL",
  "CONFLICT",
  "DEMOGRAPHIC_VOLUNTARY",
  "EXPERIENCE_EXAMPLE",
  "EXPORT_CONTROL",
  "FAILURE_LEARNING",
  "LEADERSHIP",
  "LEGAL_COMPLIANCE",
  "LOCATION_RELOCATION",
  "MOTIVATION_COMPANY",
  "MOTIVATION_ROLE",
  "OTHER_FACTUAL",
  "OTHER_NARRATIVE",
  "PORTFOLIO_LINK",
  "PROJECT_EXAMPLE",
  "SALARY",
  "SPONSORSHIP",
  "STRENGTH",
  "WORK_AUTHORIZATION",
];

export const SENSITIVE_CONCEPTS: readonly SensitiveConcept[] = [
  "AGE_DATE_OF_BIRTH",
  "CONFLICT_OF_INTEREST",
  "CRIMINAL_LEGAL_DISCLOSURE",
  "DISABILITY_STATUS",
  "EMPLOYEE_IDENTIFIER",
  "EXPORT_CONTROL_STATUS",
  "GENDER_IDENTITY",
  "NONCOMPETE_RESTRICTION",
  "RACE_ETHNICITY",
  "RELOCATION_COMMITMENT",
  "SALARY_EXPECTATION_UNITS",
  "SECURITY_CLEARANCE",
  "VETERAN_STATUS",
  "VISA_SPONSORSHIP",
  "WORK_AUTHORIZATION_STATUS",
];

/** BASE intents whose canonical clusters are themselves sensitive concepts. */
export const BASE_INTENT_SENSITIVE_CONCEPTS: Readonly<
  Partial<Record<QuestionIntent, SensitiveConcept>>
> = {
  EXPORT_CONTROL: "EXPORT_CONTROL_STATUS",
  LOCATION_RELOCATION: "RELOCATION_COMMITMENT",
  SALARY: "SALARY_EXPECTATION_UNITS",
  SPONSORSHIP: "VISA_SPONSORSHIP",
  WORK_AUTHORIZATION: "WORK_AUTHORIZATION_STATUS",
};

/** Sensitive concepts backed by an explicit M02-W01 field-value policy. */
export const CONCEPT_FIELD_POLICY_MAP: Readonly<
  Partial<Record<SensitiveConcept, FieldConcept>>
> = {
  DISABILITY_STATUS: "DEMOGRAPHIC_DISCLOSURE",
  GENDER_IDENTITY: "DEMOGRAPHIC_DISCLOSURE",
  RACE_ETHNICITY: "DEMOGRAPHIC_DISCLOSURE",
  RELOCATION_COMMITMENT: "RELOCATION_PREFERENCE",
  SALARY_EXPECTATION_UNITS: "SALARY_EXPECTATION",
  VETERAN_STATUS: "DEMOGRAPHIC_DISCLOSURE",
  VISA_SPONSORSHIP: "SPONSORSHIP_REQUIREMENT",
  WORK_AUTHORIZATION_STATUS: "WORK_AUTHORIZATION",
};

/** Reviewed fixture-only default policies for concepts without W01 records. */
export const CONCEPT_DEFAULT_POLICY_MATRIX: Readonly<
  Partial<Record<SensitiveConcept, readonly FieldValuePolicyKind[]>>
> = {
  AGE_DATE_OF_BIRTH: ["NEVER_AUTOFILL"],
  CONFLICT_OF_INTEREST: ["BLOCK_AND_EXPLAIN", "CONFIRM_ONCE_PER_JOB"],
  CRIMINAL_LEGAL_DISCLOSURE: ["BLOCK_AND_EXPLAIN"],
  DISABILITY_STATUS: ["NEVER_AUTOFILL", "VOLUNTARY_PREFER_NOT_TO_ANSWER"],
  EMPLOYEE_IDENTIFIER: ["NEVER_AUTOFILL"],
  EXPORT_CONTROL_STATUS: ["BLOCK_AND_EXPLAIN"],
  GENDER_IDENTITY: ["NEVER_AUTOFILL", "VOLUNTARY_PREFER_NOT_TO_ANSWER"],
  NONCOMPETE_RESTRICTION: ["BLOCK_AND_EXPLAIN", "CONFIRM_ONCE_PER_JOB"],
  RACE_ETHNICITY: ["NEVER_AUTOFILL", "VOLUNTARY_PREFER_NOT_TO_ANSWER"],
  SECURITY_CLEARANCE: [],
  VETERAN_STATUS: ["NEVER_AUTOFILL", "VOLUNTARY_PREFER_NOT_TO_ANSWER"],
};

const STALE_ACTIONS: Readonly<Record<StaleReason, ExpectedAction>> = {
  AUTHORIZATION_CONTEXT_CHANGED: "BLOCK_AND_EXPLAIN",
  COMPENSATION_CONTEXT_CHANGED: "ABSTAIN",
  EXPIRED_SOURCE_RECORD: "REQUIRE_CONFIRMATION",
  SUPERSEDED_PROFILE_FACT: "ABSTAIN",
  WRONG_COMPANY: "ABSTAIN",
  WRONG_JURISDICTION: "ABSTAIN",
  WRONG_LOCATION: "ABSTAIN",
  WRONG_ROLE: "ABSTAIN",
};

const INSUFFICIENCY_OUTCOMES: Readonly<
  Record<
    InsufficiencyReason,
    { outcome: AnswerOutcome; action: ExpectedAction }
  >
> = {
  EVIDENCE_CONTRADICTS_REQUEST: {
    outcome: "UNSUPPORTED_OR_CONTRADICTED",
    action: "BLOCK_AND_EXPLAIN",
  },
  EVIDENCE_STALE_AT_EVALUATION: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "REQUIRE_CONFIRMATION",
  },
  EVIDENCE_SUPPORTS_NARROWER_ANSWER: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "ABSTAIN",
  },
  METRIC_NEVER_RECORDED: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "ABSTAIN",
  },
  NO_RELEVANT_EVIDENCE: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "ABSTAIN",
  },
  PRESUPPOSED_EXPERIENCE_ABSENT: {
    outcome: "UNSUPPORTED_OR_CONTRADICTED",
    action: "ABSTAIN",
  },
  SENSITIVE_RECORD_MISSING: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "ABSTAIN",
  },
  WEAK_RELATED_EVIDENCE_ONLY: {
    outcome: "INSUFFICIENT_EVIDENCE",
    action: "ABSTAIN",
  },
};

const POLICY_OUTCOME_BY_ACTION: Readonly<
  Record<ExpectedAction, AnswerOutcome>
> = {
  ABSTAIN: "VOLUNTARY_DECLINE",
  BLOCK_AND_EXPLAIN: "BLOCKED_BY_POLICY",
  REQUIRE_CONFIRMATION: "CONFIRMATION_REQUIRED",
  USE_SUPPORTED_EVIDENCE: "EXPLICIT_RECORD_ANSWER",
};

const DEFAULT_POLICY_ACTIONS: Readonly<
  Partial<Record<FieldValuePolicyKind, ExpectedAction>>
> = {
  BLOCK_AND_EXPLAIN: "BLOCK_AND_EXPLAIN",
  CONFIRM_ONCE_PER_JOB: "REQUIRE_CONFIRMATION",
  NEVER_AUTOFILL: "BLOCK_AND_EXPLAIN",
  VOLUNTARY_PREFER_NOT_TO_ANSWER: "ABSTAIN",
};

function pushIssue(
  issues: FixtureValidationIssue[],
  code: string,
  entityId: string,
  pointer: string,
  detail: string,
): void {
  issues.push({
    code,
    entityId: safeDiagnosticToken(entityId),
    pointer: safeDiagnosticPointer(pointer),
    detail,
  });
}

function paraphraseSignature(text: string): string {
  const tokens = text
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replaceAll(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/u)
    .filter((token) => token !== "");
  return [...tokens].sort().join(" ");
}

function checkQuestionClusters(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): Map<string, QuestionCase[]> {
  const clusters = new Map<string, QuestionCase[]>();
  for (const question of corpus.questionCases) {
    const group = clusters.get(question.cluster_ref) ?? [];
    group.push(question);
    clusters.set(question.cluster_ref, group);
    const expectedBaseConcept = BASE_INTENT_SENSITIVE_CONCEPTS[question.intent];
    const demographicConcepts: readonly SensitiveConcept[] = [
      "DISABILITY_STATUS",
      "GENDER_IDENTITY",
      "RACE_ETHNICITY",
      "VETERAN_STATUS",
    ];
    if (question.layer === "SENSITIVE_OVERLAY") {
      if (question.sensitive_concept === undefined) {
        pushIssue(
          issues,
          "QUESTION_SENSITIVITY_INCOHERENT",
          question.id,
          "/sensitive_concept",
          "sensitive-overlay questions must name their sensitive concept",
        );
      }
    } else if (expectedBaseConcept !== undefined) {
      if (question.sensitive_concept !== expectedBaseConcept) {
        pushIssue(
          issues,
          "QUESTION_SENSITIVITY_INCOHERENT",
          question.id,
          "/sensitive_concept",
          "base sensitive intents must carry their exact reviewed concept",
        );
      }
    } else if (question.intent === "DEMOGRAPHIC_VOLUNTARY") {
      if (
        question.sensitive_concept === undefined ||
        !demographicConcepts.includes(question.sensitive_concept)
      ) {
        pushIssue(
          issues,
          "QUESTION_SENSITIVITY_INCOHERENT",
          question.id,
          "/sensitive_concept",
          "voluntary demographic questions must name one reviewed demographic concept",
        );
      }
    } else if (question.sensitive_concept !== undefined) {
      pushIssue(
        issues,
        "QUESTION_SENSITIVITY_INCOHERENT",
        question.id,
        "/sensitive_concept",
        "ordinary base questions must not claim a sensitive concept",
      );
    }
    if (!/^qcluster_[0-9]{26}$/u.test(question.cluster_ref)) {
      pushIssue(
        issues,
        "QUESTION_CLUSTER_REF",
        question.id,
        "/cluster_ref",
        "cluster reference must use the qcluster prefix",
      );
    }
  }
  for (const [clusterRef, members] of clusters) {
    const canonical = members.filter(
      (member) => member.case_role === "CANONICAL",
    );
    if (members.length < 3 || canonical.length !== 1) {
      pushIssue(
        issues,
        "QUESTION_CLUSTER_SHAPE",
        clusterRef,
        "/",
        "every cluster requires exactly one canonical case and at least three members",
      );
    }
    const intents = new Set(members.map((member) => member.intent));
    const layers = new Set(members.map((member) => member.layer));
    const concepts = new Set(
      members.map((member) => member.sensitive_concept ?? "NONE"),
    );
    if (intents.size !== 1 || layers.size !== 1 || concepts.size !== 1) {
      pushIssue(
        issues,
        "QUESTION_CLUSTER_MIXED",
        clusterRef,
        "/",
        "cluster members must share one intent, layer, and sensitivity",
      );
    }
    const signatures = members.map((member) =>
      paraphraseSignature(member.prompt_text),
    );
    if (new Set(signatures).size !== members.length) {
      pushIssue(
        issues,
        "PARAPHRASE_NOT_MEANINGFUL",
        clusterRef,
        "/",
        "punctuation, case, whitespace, or word-order-only variants are not independent paraphrases",
      );
    }
  }
  const baseCanonicalByIntent = new Map<QuestionIntent, number>();
  for (const question of corpus.questionCases) {
    if (question.layer === "BASE" && question.case_role === "CANONICAL") {
      baseCanonicalByIntent.set(
        question.intent,
        (baseCanonicalByIntent.get(question.intent) ?? 0) + 1,
      );
    }
  }
  for (const intent of QUESTION_INTENTS) {
    if ((baseCanonicalByIntent.get(intent) ?? 0) !== 2) {
      pushIssue(
        issues,
        "INTENT_BALANCE",
        corpus.manifest.id,
        "/answer_counts",
        `intent ${intent} must have exactly two base canonical question cases`,
      );
    }
  }
  const questionConcepts = new Set(
    corpus.questionCases.flatMap((question) =>
      question.sensitive_concept === undefined
        ? []
        : [question.sensitive_concept],
    ),
  );
  for (const concept of SENSITIVE_CONCEPTS) {
    if (!questionConcepts.has(concept)) {
      pushIssue(
        issues,
        "SENSITIVE_CONCEPT_COVERAGE",
        corpus.manifest.id,
        "/answer_counts",
        `sensitive concept ${concept} has no question case`,
      );
    }
  }
  return clusters;
}

function checkConstraintShapes(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): void {
  for (const constraint of corpus.answerConstraints) {
    if (
      (constraint.min_words !== undefined &&
        constraint.max_words !== undefined &&
        constraint.min_words > constraint.max_words) ||
      (constraint.min_characters !== undefined &&
        constraint.max_characters !== undefined &&
        constraint.min_characters > constraint.max_characters)
    ) {
      pushIssue(
        issues,
        "CONSTRAINT_IMPOSSIBLE",
        constraint.id,
        "/",
        "minimum bounds cannot exceed maximum bounds",
      );
    }
    if (
      constraint.exact_format !== undefined &&
      (constraint.line_policy !== "SINGLE_LINE" ||
        constraint.max_words !== undefined ||
        constraint.min_words !== undefined ||
        constraint.max_characters !== undefined ||
        constraint.min_characters !== undefined)
    ) {
      pushIssue(
        issues,
        "CONSTRAINT_IMPOSSIBLE",
        constraint.id,
        "/exact_format",
        "exact-format constraints are single-line and carry no numeric bounds",
      );
    }
  }
}

interface AnswerLayerLookups {
  readonly profiles: ReadonlyMap<string, SyntheticProfile>;
  readonly jobs: ReadonlyMap<string, SyntheticJob>;
  readonly evidence: ReadonlyMap<string, EvidenceArtifact>;
  readonly policies: ReadonlyMap<string, FieldValuePolicy>;
  readonly questions: ReadonlyMap<string, QuestionCase>;
  readonly constraints: ReadonlyMap<string, AnswerConstraint>;
  readonly scenarios: ReadonlyMap<string, AnswerScenario>;
}

function resolveRef<T>(
  map: ReadonlyMap<string, T>,
  ref: string,
  issues: FixtureValidationIssue[],
  ownerId: string,
  pointer: string,
  expected: string,
): T | undefined {
  const found = map.get(ref);
  if (found === undefined) {
    pushIssue(
      issues,
      "REFERENCE_DANGLING",
      ownerId,
      pointer,
      `reference must resolve to ${expected}`,
    );
  }
  return found;
}

function checkAnswerPolicyBinding(
  scenario: AnswerScenario,
  question: QuestionCase,
  lookups: AnswerLayerLookups,
  issues: FixtureValidationIssue[],
): void {
  const concept = question.sensitive_concept;
  if (concept === undefined) {
    if (
      scenario.policy_basis !== undefined ||
      scenario.field_policy_ref !== undefined ||
      scenario.default_policy !== undefined
    ) {
      pushIssue(
        issues,
        "ANSWER_POLICY_INCOHERENT",
        scenario.id,
        "/policy_basis",
        "ordinary questions must not carry sensitive policy bindings",
      );
    }
    return;
  }
  const policyOutcome = [
    "BLOCKED_BY_POLICY",
    "CONFIRMATION_REQUIRED",
    "EXPLICIT_RECORD_ANSWER",
    "VOLUNTARY_DECLINE",
  ].includes(scenario.expected_outcome);
  if (scenario.policy_basis === undefined) {
    if (policyOutcome) {
      pushIssue(
        issues,
        "ANSWER_POLICY_INCOHERENT",
        scenario.id,
        "/policy_basis",
        "sensitive policy outcomes require an explicit policy basis",
      );
    }
    return;
  }
  const mappedConcept = CONCEPT_FIELD_POLICY_MAP[concept];
  if (scenario.policy_basis === "FIELD_VALUE_POLICY") {
    if (
      mappedConcept === undefined ||
      scenario.field_policy_ref === undefined
    ) {
      pushIssue(
        issues,
        "ANSWER_POLICY_INCOHERENT",
        scenario.id,
        "/field_policy_ref",
        "field-policy basis requires a concept with an explicit W01 policy record",
      );
      return;
    }
    const policy = resolveRef(
      lookups.policies,
      scenario.field_policy_ref,
      issues,
      scenario.id,
      "/field_policy_ref",
      "FIELD_VALUE_POLICY",
    );
    if (policy === undefined) {
      return;
    }
    if (
      policy.profile_ref !== scenario.profile_ref ||
      policy.field_concept !== mappedConcept
    ) {
      pushIssue(
        issues,
        "ANSWER_POLICY_INCOHERENT",
        scenario.id,
        "/field_policy_ref",
        "referenced policy must belong to the scenario profile and mapped concept",
      );
      return;
    }
    if (!policyOutcome) {
      return;
    }
    const source = lookups.evidence.get(policy.source_evidence_ref);
    if (source === undefined) {
      return;
    }
    const decision = policyDecisionAt(policy, source, scenario.evaluation_date);
    if (
      scenario.expected_action !== decision.action ||
      scenario.expected_outcome !== POLICY_OUTCOME_BY_ACTION[decision.action] ||
      scenario.release_eligible !== decision.releaseEligible
    ) {
      pushIssue(
        issues,
        "ANSWER_POLICY_DECISION_MISMATCH",
        scenario.id,
        "/expected_outcome",
        "sensitive outcome, action, and release must derive from the referenced policy at the evaluation date",
      );
    }
    return;
  }
  if (mappedConcept !== undefined) {
    pushIssue(
      issues,
      "ANSWER_POLICY_INCOHERENT",
      scenario.id,
      "/policy_basis",
      "concepts with explicit W01 policies must use the field-policy basis",
    );
    return;
  }
  const allowed = CONCEPT_DEFAULT_POLICY_MATRIX[concept] ?? [];
  if (
    scenario.default_policy === undefined ||
    !allowed.includes(scenario.default_policy)
  ) {
    pushIssue(
      issues,
      "ANSWER_POLICY_INCOHERENT",
      scenario.id,
      "/default_policy",
      "concept-default basis requires a reviewed allowed default policy",
    );
    return;
  }
  if (!policyOutcome) {
    return;
  }
  const derivedAction = DEFAULT_POLICY_ACTIONS[scenario.default_policy];
  if (
    derivedAction === undefined ||
    scenario.expected_action !== derivedAction ||
    scenario.expected_outcome !== POLICY_OUTCOME_BY_ACTION[derivedAction] ||
    scenario.release_eligible
  ) {
    pushIssue(
      issues,
      "ANSWER_POLICY_DECISION_MISMATCH",
      scenario.id,
      "/expected_outcome",
      "concept-default outcomes must derive from the reviewed default-policy matrix and never release",
    );
  }
}

function checkStaleScenario(
  scenario: AnswerScenario,
  question: QuestionCase,
  job: SyntheticJob | undefined,
  lookups: AnswerLayerLookups,
  issues: FixtureValidationIssue[],
): void {
  const reason = scenario.stale_reason;
  if (reason === undefined) {
    pushIssue(
      issues,
      "STALE_REASON_MISSING",
      scenario.id,
      "/stale_reason",
      "stale-context scenarios require an explicit stale reason",
    );
    return;
  }
  if (
    scenario.expected_action !== STALE_ACTIONS[reason] ||
    scenario.release_eligible ||
    scenario.answer !== undefined
  ) {
    pushIssue(
      issues,
      "STALE_RELEASE_FORBIDDEN",
      scenario.id,
      "/release_eligible",
      "stale or incompatible context never releases an answer and must use its reviewed action",
    );
  }
  const reuseReasons: readonly StaleReason[] = [
    "WRONG_COMPANY",
    "WRONG_LOCATION",
    "WRONG_ROLE",
  ];
  if (reuseReasons.includes(reason)) {
    if (scenario.reused_answer_scenario_ref === undefined) {
      pushIssue(
        issues,
        "STALE_REUSE_UNPROVEN",
        scenario.id,
        "/reused_answer_scenario_ref",
        "context-mismatch traps must cite the released answer they may not reuse",
      );
      return;
    }
    const source = resolveRef(
      lookups.scenarios,
      scenario.reused_answer_scenario_ref,
      issues,
      scenario.id,
      "/reused_answer_scenario_ref",
      "ANSWER_SCENARIO",
    );
    if (source === undefined || job === undefined) {
      return;
    }
    const sourceQuestion = lookups.questions.get(source.question_ref);
    const sourceJob = lookups.jobs.get(source.job_ref);
    const dimensionDiffers =
      sourceJob !== undefined &&
      (reason === "WRONG_COMPANY"
        ? sourceJob.employer !== job.employer
        : reason === "WRONG_ROLE"
          ? sourceJob.title !== job.title
          : sourceJob.location !== job.location);
    if (
      !source.release_eligible ||
      source.answer === undefined ||
      source.profile_ref !== scenario.profile_ref ||
      sourceQuestion?.cluster_ref !== question.cluster_ref ||
      !dimensionDiffers
    ) {
      pushIssue(
        issues,
        "STALE_REUSE_UNPROVEN",
        scenario.id,
        "/reused_answer_scenario_ref",
        "reuse trap must cite a released same-profile answer from the same cluster whose named context dimension genuinely differs",
      );
    }
    return;
  }
  if (reason === "WRONG_JURISDICTION") {
    if (scenario.context.jurisdiction !== "NON_US_FIXTURE") {
      pushIssue(
        issues,
        "STALE_CONTEXT_UNPROVEN",
        scenario.id,
        "/context/jurisdiction",
        "jurisdiction traps must ask in the non-US fixture jurisdiction",
      );
    }
    return;
  }
  const cited = (scenario.context_refs ?? []).flatMap((ref) => {
    const artifact = lookups.evidence.get(ref);
    return artifact?.profile_ref !== scenario.profile_ref ? [] : [artifact];
  });
  if ((scenario.context_refs ?? []).length === 0 || cited.length === 0) {
    pushIssue(
      issues,
      "STALE_CONTEXT_UNPROVEN",
      scenario.id,
      "/context_refs",
      "record-based stale reasons must cite the governing same-profile records",
    );
    return;
  }
  const staleProven =
    reason === "EXPIRED_SOURCE_RECORD"
      ? cited.some((artifact) =>
          artifact.field_records.some(
            (record) =>
              record.valid_through !== undefined &&
              record.valid_through < scenario.evaluation_date,
          ),
        )
      : reason === "SUPERSEDED_PROFILE_FACT"
        ? cited.some((artifact) =>
            artifact.fact_keys.includes("career:transition"),
          )
        : reason === "COMPENSATION_CONTEXT_CHANGED"
          ? cited.some((artifact) =>
              artifact.field_records.some(
                (record) => record.field_concept === "SALARY_EXPECTATION",
              ),
            )
          : job?.eligibility_constraint === "NO_SPONSORSHIP" &&
            cited.some((artifact) =>
              artifact.field_records.some(
                (record) =>
                  record.field_concept === "SPONSORSHIP_REQUIREMENT" &&
                  record.recorded_value === "REQUIRED",
              ),
            );
  if (!staleProven) {
    pushIssue(
      issues,
      "STALE_CONTEXT_UNPROVEN",
      scenario.id,
      "/context_refs",
      "cited records do not prove the declared stale reason",
    );
  }
}

const METRIC_TOKEN = /\d+(?:\.\d+)?%|\$\d[\d,]*/gu;

function checkAnswerContent(
  scenario: AnswerScenario,
  profile: SyntheticProfile | undefined,
  lookups: AnswerLayerLookups,
  issues: FixtureValidationIssue[],
): void {
  const answer = scenario.answer;
  const releasable =
    scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" ||
    scenario.expected_outcome === "EXPLICIT_RECORD_ANSWER";
  if (!releasable) {
    if (answer !== undefined) {
      pushIssue(
        issues,
        "ANSWER_TEXT_FORBIDDEN",
        scenario.id,
        "/answer",
        "prohibited, blocked, stale, confirmation, declined, or insufficient results carry no releasable answer text",
      );
    }
    return;
  }
  if (answer === undefined) {
    pushIssue(
      issues,
      "ANSWER_TEXT_MISSING",
      scenario.id,
      "/answer",
      "supported and explicit-record outcomes require the reviewed answer",
    );
    return;
  }
  const citedEvidence = answer.evidence_refs.flatMap((ref) => {
    const artifact = resolveRef(
      lookups.evidence,
      ref,
      issues,
      scenario.id,
      "/answer/evidence_refs",
      "EVIDENCE_ARTIFACT",
    );
    return artifact === undefined ? [] : [artifact];
  });
  for (const artifact of citedEvidence) {
    if (artifact.profile_ref !== scenario.profile_ref) {
      pushIssue(
        issues,
        "CROSS_PROFILE_EVIDENCE",
        scenario.id,
        "/answer/evidence_refs",
        "answer evidence belongs to another profile",
      );
    }
  }
  if (scenario.expected_outcome === "EXPLICIT_RECORD_ANSWER") {
    if (answer.explicit_source === "PROFILE_CONTACT_WEBSITE") {
      if (
        answer.evidence_refs.length !== 0 ||
        answer.text !== profile?.contact.website
      ) {
        pushIssue(
          issues,
          "EXPLICIT_ANSWER_SOURCE_MISMATCH",
          scenario.id,
          "/answer/text",
          "profile-website answers must equal the bound profile website exactly",
        );
      }
      return;
    }
    if (
      answer.explicit_source !== "FIELD_RECORD" ||
      answer.source_field_record_id === undefined
    ) {
      pushIssue(
        issues,
        "EXPLICIT_ANSWER_SOURCE_MISMATCH",
        scenario.id,
        "/answer/explicit_source",
        "explicit-record answers must name their explicit source",
      );
      return;
    }
    const record = citedEvidence
      .flatMap((artifact) => artifact.field_records)
      .find(
        (candidate) =>
          candidate.field_record_id === answer.source_field_record_id,
      );
    if (answer.text !== record?.disclosure_text) {
      pushIssue(
        issues,
        "EXPLICIT_ANSWER_SOURCE_MISMATCH",
        scenario.id,
        "/answer/text",
        "explicit-record answers must reproduce the cited approved disclosure exactly",
      );
    }
    return;
  }
  if (answer.explicit_source !== undefined) {
    pushIssue(
      issues,
      "EXPLICIT_ANSWER_SOURCE_MISMATCH",
      scenario.id,
      "/answer/explicit_source",
      "narrative answers do not carry an explicit-record source",
    );
  }
  if (
    citedEvidence.length === 0 ||
    citedEvidence.some((artifact) => artifact.category === "USER_ASSERTION")
  ) {
    pushIssue(
      issues,
      "NARRATIVE_ANSWER_UNSUPPORTED",
      scenario.id,
      "/answer/evidence_refs",
      "narrative answers require at least one reviewed non-assertion evidence artifact",
    );
  }
  METRIC_TOKEN.lastIndex = 0;
  for (const match of answer.text.matchAll(METRIC_TOKEN)) {
    if (
      !citedEvidence.some((artifact) => artifact.statement.includes(match[0]))
    ) {
      pushIssue(
        issues,
        "NARRATIVE_ANSWER_UNSUPPORTED",
        scenario.id,
        "/answer/text",
        "numeric metrics in a narrative answer must appear in cited evidence",
      );
    }
  }
}

function checkConstraintBinding(
  scenario: AnswerScenario,
  lookups: AnswerLayerLookups,
  issues: FixtureValidationIssue[],
): void {
  if (scenario.constraint_ref === undefined) {
    if (scenario.constraint_evaluation !== undefined) {
      pushIssue(
        issues,
        "CONSTRAINT_EVALUATION_INCOHERENT",
        scenario.id,
        "/constraint_evaluation",
        "constraint measurements require a bound constraint",
      );
    }
    return;
  }
  const constraint = resolveRef(
    lookups.constraints,
    scenario.constraint_ref,
    issues,
    scenario.id,
    "/constraint_ref",
    "ANSWER_CONSTRAINT",
  );
  if (constraint === undefined) {
    return;
  }
  if (scenario.answer === undefined) {
    if (scenario.constraint_evaluation !== undefined) {
      pushIssue(
        issues,
        "CONSTRAINT_EVALUATION_INCOHERENT",
        scenario.id,
        "/constraint_evaluation",
        "constraint measurements require an authored answer",
      );
    }
    return;
  }
  const measured = measureAnswerAgainstConstraint(
    constraint,
    scenario.answer.text,
  );
  const declared = scenario.constraint_evaluation;
  if (
    declared?.measured_words !== measured.measured_words ||
    declared.measured_characters !== measured.measured_characters ||
    declared.measured_lines !== measured.measured_lines ||
    declared.compliant !== measured.compliant
  ) {
    pushIssue(
      issues,
      "CONSTRAINT_EVALUATION_INCOHERENT",
      scenario.id,
      "/constraint_evaluation",
      "declared measurements must equal the deterministic fixture metric",
    );
    return;
  }
  if (declared.boundary !== undefined) {
    const limit = boundaryLimit(constraint);
    const measuredValue =
      limit?.dimension === "WORDS"
        ? declared.measured_words
        : declared.measured_characters;
    const expectedValue =
      limit === undefined
        ? undefined
        : declared.boundary === "AT_LIMIT"
          ? limit.limit
          : declared.boundary === "ONE_BELOW_LIMIT"
            ? limit.limit - 1
            : limit.limit + 1;
    if (limit === undefined || measuredValue !== expectedValue) {
      pushIssue(
        issues,
        "CONSTRAINT_BOUNDARY_INCOHERENT",
        scenario.id,
        "/constraint_evaluation/boundary",
        "boundary labels must match the single-dimension limit exactly",
      );
    }
  }
  if (
    scenario.release_eligible &&
    (!measured.compliant ||
      scenario.expected_outcome === "STALE_CONTEXT" ||
      scenario.expected_outcome === "INSUFFICIENT_EVIDENCE")
  ) {
    pushIssue(
      issues,
      "CONSTRAINT_RELEASE_INCOHERENT",
      scenario.id,
      "/release_eligible",
      "a constrained answer releases only when the deterministic metric is compliant",
    );
  }
}

function checkAnswerScenarios(
  corpus: FixtureCorpus,
  clusters: ReadonlyMap<string, QuestionCase[]>,
  issues: FixtureValidationIssue[],
): void {
  const lookups: AnswerLayerLookups = {
    profiles: new Map(corpus.profiles.map((value) => [value.id, value])),
    jobs: new Map(corpus.jobs.map((value) => [value.id, value])),
    evidence: new Map(
      corpus.evidenceArtifacts.map((value) => [value.id, value]),
    ),
    policies: new Map(
      corpus.fieldValuePolicies.map((value) => [value.id, value]),
    ),
    questions: new Map(corpus.questionCases.map((value) => [value.id, value])),
    constraints: new Map(
      corpus.answerConstraints.map((value) => [value.id, value]),
    ),
    scenarios: new Map(
      corpus.answerScenarios.map((value) => [value.id, value]),
    ),
  };
  const exercisedClusters = new Set<string>();
  const exercisedConstraints = new Set<string>();
  const seenPairs = new Set<string>();
  const seenPolicyKinds = new Set<FieldValuePolicyKind>();
  const seenConcepts = new Set<SensitiveConcept>();
  const seenStale = new Set<StaleReason>();
  const seenInsufficiency = new Set<InsufficiencyReason>();
  const seenBoundaries = new Set<string>();
  let reuseTraps = 0;
  for (const scenario of corpus.answerScenarios) {
    const question = resolveRef(
      lookups.questions,
      scenario.question_ref,
      issues,
      scenario.id,
      "/question_ref",
      "QUESTION_CASE",
    );
    const profile = resolveRef(
      lookups.profiles,
      scenario.profile_ref,
      issues,
      scenario.id,
      "/profile_ref",
      "SYNTHETIC_PROFILE",
    );
    const job = resolveRef(
      lookups.jobs,
      scenario.job_ref,
      issues,
      scenario.id,
      "/job_ref",
      "SYNTHETIC_JOB",
    );
    if (question !== undefined) {
      exercisedClusters.add(question.cluster_ref);
      if (question.sensitive_concept !== undefined) {
        seenConcepts.add(question.sensitive_concept);
      }
    }
    if (scenario.constraint_ref !== undefined) {
      exercisedConstraints.add(scenario.constraint_ref);
    }
    if (scenario.field_policy_ref !== undefined) {
      const policy = lookups.policies.get(scenario.field_policy_ref);
      if (policy !== undefined) {
        seenPolicyKinds.add(policy.policy);
      }
    }
    const pairKey = [
      scenario.question_ref,
      scenario.profile_ref,
      scenario.job_ref,
      scenario.evaluation_date,
    ].join("|");
    if (seenPairs.has(pairKey)) {
      pushIssue(
        issues,
        "ANSWER_SCENARIO_DUPLICATE",
        scenario.id,
        "/",
        "question, profile, job, and evaluation date must be a unique combination",
      );
    }
    seenPairs.add(pairKey);
    if (
      job !== undefined &&
      (scenario.context.company !== job.employer ||
        scenario.context.role !== job.title ||
        scenario.context.location !== job.location)
    ) {
      pushIssue(
        issues,
        "ANSWER_CONTEXT_MISMATCH",
        scenario.id,
        "/context",
        "context company, role, and location must equal the bound job identity",
      );
    }
    if (
      scenario.context.jurisdiction === "NON_US_FIXTURE" &&
      scenario.stale_reason !== "WRONG_JURISDICTION"
    ) {
      pushIssue(
        issues,
        "ANSWER_CONTEXT_MISMATCH",
        scenario.id,
        "/context/jurisdiction",
        "only the jurisdiction stale trap asks outside the US fixture jurisdiction",
      );
    }
    if (
      scenario.stale_reason !== undefined &&
      scenario.expected_outcome !== "STALE_CONTEXT"
    ) {
      pushIssue(
        issues,
        "STALE_RELEASE_FORBIDDEN",
        scenario.id,
        "/stale_reason",
        "stale reasons belong only to stale-context outcomes",
      );
    }
    if (scenario.expected_outcome === "STALE_CONTEXT") {
      if (question !== undefined) {
        checkStaleScenario(scenario, question, job, lookups, issues);
      }
      if (scenario.stale_reason !== undefined) {
        seenStale.add(scenario.stale_reason);
        if (
          ["WRONG_COMPANY", "WRONG_LOCATION", "WRONG_ROLE"].includes(
            scenario.stale_reason,
          )
        ) {
          reuseTraps += 1;
        }
      }
    } else if (
      scenario.expected_outcome === "INSUFFICIENT_EVIDENCE" ||
      scenario.expected_outcome === "UNSUPPORTED_OR_CONTRADICTED"
    ) {
      const reason = scenario.insufficiency_reason;
      if (reason === undefined) {
        pushIssue(
          issues,
          "INSUFFICIENCY_REASON_MISSING",
          scenario.id,
          "/insufficiency_reason",
          "insufficient or contradicted results require an explicit reason",
        );
      } else {
        seenInsufficiency.add(reason);
        const expected = INSUFFICIENCY_OUTCOMES[reason];
        const citedOk =
          ![
            "EVIDENCE_CONTRADICTS_REQUEST",
            "EVIDENCE_STALE_AT_EVALUATION",
            "EVIDENCE_SUPPORTS_NARROWER_ANSWER",
            "WEAK_RELATED_EVIDENCE_ONLY",
          ].includes(reason) ||
          (scenario.context_refs ?? []).some((ref) => {
            const artifact = lookups.evidence.get(ref);
            return artifact?.profile_ref === scenario.profile_ref;
          });
        if (
          scenario.expected_outcome !== expected.outcome ||
          scenario.expected_action !== expected.action ||
          scenario.release_eligible ||
          !citedOk
        ) {
          pushIssue(
            issues,
            "INSUFFICIENCY_INCOHERENT",
            scenario.id,
            "/insufficiency_reason",
            "insufficiency reason, outcome, action, citations, and no-release state must agree",
          );
        }
      }
    } else if (scenario.insufficiency_reason !== undefined) {
      pushIssue(
        issues,
        "INSUFFICIENCY_INCOHERENT",
        scenario.id,
        "/insufficiency_reason",
        "insufficiency reasons belong only to insufficient or contradicted outcomes",
      );
    }
    if (
      (scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" ||
        scenario.expected_outcome === "EXPLICIT_RECORD_ANSWER") &&
      scenario.expected_action !== "USE_SUPPORTED_EVIDENCE"
    ) {
      pushIssue(
        issues,
        "ANSWER_ACTION_INCOHERENT",
        scenario.id,
        "/expected_action",
        "released answers use supported evidence",
      );
    }
    if (
      scenario.release_eligible &&
      scenario.expected_outcome !== "SUPPORTED_NARRATIVE_ANSWER" &&
      scenario.expected_outcome !== "EXPLICIT_RECORD_ANSWER"
    ) {
      pushIssue(
        issues,
        "ANSWER_ACTION_INCOHERENT",
        scenario.id,
        "/release_eligible",
        "only supported or explicit-record outcomes may release",
      );
    }
    if (question !== undefined) {
      checkAnswerPolicyBinding(scenario, question, lookups, issues);
    }
    checkAnswerContent(scenario, profile, lookups, issues);
    checkConstraintBinding(scenario, lookups, issues);
    if (scenario.constraint_evaluation?.boundary !== undefined) {
      const constraint =
        scenario.constraint_ref === undefined
          ? undefined
          : lookups.constraints.get(scenario.constraint_ref);
      const limit =
        constraint === undefined ? undefined : boundaryLimit(constraint);
      if (limit !== undefined) {
        seenBoundaries.add(
          `${limit.dimension}:${scenario.constraint_evaluation.boundary}`,
        );
      }
    }
  }
  for (const clusterRef of clusters.keys()) {
    if (!exercisedClusters.has(clusterRef)) {
      pushIssue(
        issues,
        "QUESTION_CLUSTER_ORPHANED",
        clusterRef,
        "/",
        "every paraphrase cluster must be exercised by at least one answer scenario",
      );
    }
  }
  for (const constraint of corpus.answerConstraints) {
    if (!exercisedConstraints.has(constraint.id)) {
      pushIssue(
        issues,
        "ANSWER_CONSTRAINT_ORPHANED",
        constraint.id,
        "/",
        "every committed answer constraint must be exercised by a scenario",
      );
    }
  }
  const requiredPolicyKinds: readonly FieldValuePolicyKind[] = [
    "BLOCK_AND_EXPLAIN",
    "CONFIRM_IF_RECORD_EXPIRED",
    "CONFIRM_ONCE_PER_JOB",
    "FILL_FROM_EXPLICIT_RECORD",
    "NEVER_AUTOFILL",
    "VOLUNTARY_PREFER_NOT_TO_ANSWER",
  ];
  for (const kind of requiredPolicyKinds) {
    if (!seenPolicyKinds.has(kind)) {
      pushIssue(
        issues,
        "ANSWER_POLICY_KIND_COVERAGE",
        corpus.manifest.id,
        "/answer_counts",
        `field-policy kind ${kind} is not exercised by an answer scenario`,
      );
    }
  }
  for (const concept of SENSITIVE_CONCEPTS) {
    if (!seenConcepts.has(concept)) {
      pushIssue(
        issues,
        "SENSITIVE_CONCEPT_COVERAGE",
        corpus.manifest.id,
        "/answer_counts",
        `sensitive concept ${concept} is not exercised by an answer scenario`,
      );
    }
  }
  const staleReasons: readonly StaleReason[] = [
    "AUTHORIZATION_CONTEXT_CHANGED",
    "COMPENSATION_CONTEXT_CHANGED",
    "EXPIRED_SOURCE_RECORD",
    "SUPERSEDED_PROFILE_FACT",
    "WRONG_COMPANY",
    "WRONG_JURISDICTION",
    "WRONG_LOCATION",
    "WRONG_ROLE",
  ];
  for (const reason of staleReasons) {
    if (!seenStale.has(reason)) {
      pushIssue(
        issues,
        "STALE_COVERAGE_MISSING",
        corpus.manifest.id,
        "/answer_counts",
        `stale-context reason ${reason} is absent`,
      );
    }
  }
  const insufficiencyReasons: readonly InsufficiencyReason[] = [
    "EVIDENCE_CONTRADICTS_REQUEST",
    "EVIDENCE_STALE_AT_EVALUATION",
    "EVIDENCE_SUPPORTS_NARROWER_ANSWER",
    "METRIC_NEVER_RECORDED",
    "NO_RELEVANT_EVIDENCE",
    "PRESUPPOSED_EXPERIENCE_ABSENT",
    "SENSITIVE_RECORD_MISSING",
    "WEAK_RELATED_EVIDENCE_ONLY",
  ];
  for (const reason of insufficiencyReasons) {
    if (!seenInsufficiency.has(reason)) {
      pushIssue(
        issues,
        "INSUFFICIENCY_COVERAGE_MISSING",
        corpus.manifest.id,
        "/answer_counts",
        `insufficient-evidence reason ${reason} is absent`,
      );
    }
  }
  for (const expected of [
    "CHARACTERS:AT_LIMIT",
    "CHARACTERS:ONE_ABOVE_LIMIT",
    "CHARACTERS:ONE_BELOW_LIMIT",
    "WORDS:AT_LIMIT",
    "WORDS:ONE_ABOVE_LIMIT",
    "WORDS:ONE_BELOW_LIMIT",
  ]) {
    if (!seenBoundaries.has(expected)) {
      pushIssue(
        issues,
        "CONSTRAINT_BOUNDARY_COVERAGE",
        corpus.manifest.id,
        "/answer_counts",
        `deterministic limit boundary ${expected} is absent`,
      );
    }
  }
  if (reuseTraps < 1) {
    pushIssue(
      issues,
      "STALE_COVERAGE_MISSING",
      corpus.manifest.id,
      "/answer_counts",
      "at least one verbatim cross-context reuse trap is required",
    );
  }
}

export function checkAnswerLayer(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): void {
  const clusters = checkQuestionClusters(corpus, issues);
  checkConstraintShapes(corpus, issues);
  checkAnswerScenarios(corpus, clusters, issues);
}
