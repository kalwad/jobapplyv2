import { describe, expect, test } from "vitest";

import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type { AnswerScenario, FixtureCorpus } from "../../src/model.ts";

function corpus(): FixtureCorpus {
  return structuredClone(loadFixtureCorpus());
}

function issueCodes(value: FixtureCorpus): string[] {
  return validateFixtureConsistency(value).issues.map((issue) => issue.code);
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("reviewed answer mutation input is missing");
  }
  return value;
}

function scenarioByOutcome(
  value: FixtureCorpus,
  outcome: AnswerScenario["expected_outcome"],
): AnswerScenario {
  return required(
    value.answerScenarios.find(
      (scenario) => scenario.expected_outcome === outcome,
    ),
  );
}

describe("M02-W02 independently authored answer-layer mutations", () => {
  test("rejects a question moved to a different intent inside its cluster", () => {
    const value = corpus();
    required(value.questionCases[1]).intent = "OTHER_NARRATIVE";
    expect(issueCodes(value)).toContain("QUESTION_CLUSTER_MIXED");
  });

  test("rejects a cluster whose canonical case is demoted", () => {
    const value = corpus();
    required(
      value.questionCases.find(
        (question) => question.case_role === "CANONICAL",
      ),
    ).case_role = "PARAPHRASE";
    expect(issueCodes(value)).toContain("QUESTION_CLUSTER_SHAPE");
  });

  test("rejects duplicate cluster membership created by re-pointing a case", () => {
    const value = corpus();
    const [first, , , fourth] = value.questionCases;
    required(fourth).cluster_ref = required(first).cluster_ref;
    expect(issueCodes(value)).toContain("QUESTION_CLUSTER_SHAPE");
  });

  test("rejects a word-order-only pseudo paraphrase", () => {
    const value = corpus();
    const canonical = required(
      value.questionCases.find(
        (question) => question.case_role === "CANONICAL",
      ),
    );
    const paraphrase = required(
      value.questionCases.find(
        (question) =>
          question.cluster_ref === canonical.cluster_ref &&
          question.case_role === "PARAPHRASE",
      ),
    );
    paraphrase.prompt_text = canonical.prompt_text
      .split(" ")
      .reverse()
      .join(" ");
    expect(issueCodes(value)).toContain("PARAPHRASE_NOT_MEANINGFUL");
  });

  test("rejects unbalanced base intents when a canonical case changes layer", () => {
    const value = corpus();
    const canonical = required(
      value.questionCases.find(
        (question) =>
          question.case_role === "CANONICAL" &&
          question.layer === "BASE" &&
          question.intent === "STRENGTH",
      ),
    );
    const cluster = value.questionCases.filter(
      (question) => question.cluster_ref === canonical.cluster_ref,
    );
    for (const member of cluster) {
      member.layer = "SENSITIVE_OVERLAY";
      member.sensitive_concept = "SECURITY_CLEARANCE";
    }
    expect(issueCodes(value)).toContain("INTENT_BALANCE");
  });

  test("rejects an ordinary base question that claims a sensitive concept", () => {
    const value = corpus();
    required(
      value.questionCases.find(
        (question) =>
          question.layer === "BASE" && question.intent === "MOTIVATION_COMPANY",
      ),
    ).sensitive_concept = "SALARY_EXPECTATION_UNITS";
    expect(issueCodes(value)).toContain("QUESTION_SENSITIVITY_INCOHERENT");
  });

  test("rejects a prohibited sensitive auto-answer on a blocked scenario", () => {
    const value = corpus();
    const blocked = scenarioByOutcome(value, "BLOCKED_BY_POLICY");
    blocked.answer = {
      text: "An invented sensitive value.",
      evidence_refs: [],
    };
    expect(issueCodes(value)).toContain("ANSWER_TEXT_FORBIDDEN");
  });

  test("rejects a released answer on a voluntary-decline scenario", () => {
    const value = corpus();
    const declined = scenarioByOutcome(value, "VOLUNTARY_DECLINE");
    declined.answer = { text: "Declined but answered.", evidence_refs: [] };
    expect(issueCodes(value)).toContain("ANSWER_TEXT_FORBIDDEN");
  });

  test("rejects sensitive outcome drift away from the bound field policy", () => {
    const value = corpus();
    const confirm = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.expected_outcome === "CONFIRMATION_REQUIRED" &&
          scenario.policy_basis === "FIELD_VALUE_POLICY",
      ),
    );
    confirm.expected_outcome = "EXPLICIT_RECORD_ANSWER";
    confirm.expected_action = "USE_SUPPORTED_EVIDENCE";
    expect(issueCodes(value)).toContain("ANSWER_POLICY_DECISION_MISMATCH");
  });

  test("rejects a concept-default outside the reviewed matrix", () => {
    const value = corpus();
    const criminal = required(
      value.answerScenarios.find(
        (scenario) => scenario.default_policy === "BLOCK_AND_EXPLAIN",
      ),
    );
    criminal.default_policy = "FILL_FROM_EXPLICIT_RECORD";
    expect(issueCodes(value)).toContain("ANSWER_POLICY_INCOHERENT");
  });

  test("rejects a policy binding on an ordinary question", () => {
    const value = corpus();
    const narrative = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" &&
          scenario.policy_basis === undefined,
      ),
    );
    narrative.policy_basis = "CONCEPT_DEFAULT";
    narrative.default_policy = "NEVER_AUTOFILL";
    expect(issueCodes(value)).toContain("ANSWER_POLICY_INCOHERENT");
  });

  test("rejects a stale scenario marked releasable", () => {
    const value = corpus();
    const stale = scenarioByOutcome(value, "STALE_CONTEXT");
    stale.release_eligible = true;
    expect(issueCodes(value)).toContain("STALE_RELEASE_FORBIDDEN");
  });

  test("rejects a reuse trap pointing at a different cluster's answer", () => {
    const value = corpus();
    const trap = required(
      value.answerScenarios.find(
        (scenario) => scenario.stale_reason === "WRONG_COMPANY",
      ),
    );
    trap.reused_answer_scenario_ref = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.release_eligible &&
          scenario.answer !== undefined &&
          value.questionCases.find((q) => q.id === scenario.question_ref)
            ?.cluster_ref !==
            value.questionCases.find((q) => q.id === trap.question_ref)
              ?.cluster_ref,
      ),
    ).id;
    expect(issueCodes(value)).toContain("STALE_REUSE_UNPROVEN");
  });

  test("rejects a wrong-company trap whose employer does not actually differ", () => {
    const value = corpus();
    const trap = required(
      value.answerScenarios.find(
        (scenario) => scenario.stale_reason === "WRONG_COMPANY",
      ),
    );
    const source = required(
      value.answerScenarios.find(
        (scenario) => scenario.id === trap.reused_answer_scenario_ref,
      ),
    );
    trap.job_ref = source.job_ref;
    const job = required(
      value.jobs.find((candidate) => candidate.id === source.job_ref),
    );
    trap.context = {
      company: job.employer,
      role: job.title,
      location: job.location,
      jurisdiction: "US_FIXTURE",
    };
    expect(issueCodes(value)).toContain("STALE_REUSE_UNPROVEN");
  });

  test("rejects a record-based stale reason with its citations removed", () => {
    const value = corpus();
    const expired = required(
      value.answerScenarios.find(
        (scenario) => scenario.stale_reason === "EXPIRED_SOURCE_RECORD",
      ),
    );
    delete expired.context_refs;
    expect(issueCodes(value)).toContain("STALE_CONTEXT_UNPROVEN");
  });

  test("rejects an insufficiency result that releases an answer", () => {
    const value = corpus();
    const insufficient = scenarioByOutcome(value, "INSUFFICIENT_EVIDENCE");
    insufficient.answer = {
      text: "A polished unsupported answer.",
      evidence_refs: [],
    };
    expect(issueCodes(value)).toContain("ANSWER_TEXT_FORBIDDEN");
  });

  test("rejects an unsupported numeric metric inside a narrative answer", () => {
    const value = corpus();
    const narrative = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" &&
          scenario.answer !== undefined &&
          scenario.constraint_evaluation?.boundary === undefined,
      ),
    );
    required(narrative.answer).text += " Improved throughput by 45%.";
    const codes = issueCodes(value);
    expect(codes).toContain("NARRATIVE_ANSWER_UNSUPPORTED");
  });

  test("rejects declared limit measurements that drift from the metric", () => {
    const value = corpus();
    const measured = required(
      value.answerScenarios.find(
        (scenario) => scenario.constraint_evaluation !== undefined,
      ),
    );
    required(measured.constraint_evaluation).measured_words += 1;
    expect(issueCodes(value)).toContain("CONSTRAINT_EVALUATION_INCOHERENT");
  });

  test("rejects a mislabeled boundary case", () => {
    const value = corpus();
    const atLimit = required(
      value.answerScenarios.find(
        (scenario) => scenario.constraint_evaluation?.boundary === "AT_LIMIT",
      ),
    );
    required(atLimit.constraint_evaluation).boundary = "ONE_BELOW_LIMIT";
    expect(issueCodes(value)).toContain("CONSTRAINT_BOUNDARY_INCOHERENT");
  });

  test("rejects releasing a non-compliant constrained answer", () => {
    const value = corpus();
    const over = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.constraint_evaluation?.boundary === "ONE_ABOVE_LIMIT",
      ),
    );
    over.release_eligible = true;
    expect(issueCodes(value)).toContain("CONSTRAINT_RELEASE_INCOHERENT");
  });

  test("rejects an explicit-record answer that mutates the approved disclosure", () => {
    const value = corpus();
    const explicit = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.expected_outcome === "EXPLICIT_RECORD_ANSWER" &&
          scenario.answer?.explicit_source === "FIELD_RECORD",
      ),
    );
    required(explicit.answer).text = "A reworded sensitive disclosure.";
    expect(issueCodes(value)).toContain("EXPLICIT_ANSWER_SOURCE_MISMATCH");
  });

  test("rejects a profile-website answer that drifts from the profile", () => {
    const value = corpus();
    const website = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.answer?.explicit_source === "PROFILE_CONTACT_WEBSITE",
      ),
    );
    required(website.answer).text = "https://other.example.test/profile";
    expect(issueCodes(value)).toContain("EXPLICIT_ANSWER_SOURCE_MISMATCH");
  });

  test("rejects cross-profile evidence in a narrative answer", () => {
    const value = corpus();
    const narrative = required(
      value.answerScenarios.find(
        (scenario) =>
          scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" &&
          scenario.answer !== undefined &&
          scenario.answer.evidence_refs.length > 0,
      ),
    );
    const foreign = required(
      value.evidenceArtifacts.find(
        (artifact) => artifact.profile_ref !== narrative.profile_ref,
      ),
    );
    required(narrative.answer).evidence_refs = [foreign.id];
    expect(issueCodes(value)).toContain("CROSS_PROFILE_EVIDENCE");
  });

  test("rejects an answer scenario whose context drifts from its job", () => {
    const value = corpus();
    required(value.answerScenarios[0]).context.company =
      "Synthetic Employer 99-J";
    expect(issueCodes(value)).toContain("ANSWER_CONTEXT_MISMATCH");
  });

  test("rejects duplicate question-profile-job-date scenario combinations", () => {
    const value = corpus();
    const [first, second] = value.answerScenarios;
    const template = required(first);
    const target = required(second);
    target.question_ref = template.question_ref;
    target.profile_ref = template.profile_ref;
    target.job_ref = template.job_ref;
    target.evaluation_date = template.evaluation_date;
    expect(issueCodes(value)).toContain("ANSWER_SCENARIO_DUPLICATE");
  });

  test("rejects an orphaned cluster when its only scenario is re-pointed", () => {
    const value = corpus();
    const veteranQuestion = required(
      value.questionCases.find(
        (question) => question.sensitive_concept === "VETERAN_STATUS",
      ),
    );
    const veteranScenario = required(
      value.answerScenarios.find((scenario) =>
        value.questionCases.some(
          (question) =>
            question.id === scenario.question_ref &&
            question.cluster_ref === veteranQuestion.cluster_ref,
        ),
      ),
    );
    const raceQuestion = required(
      value.questionCases.find(
        (question) => question.sensitive_concept === "RACE_ETHNICITY",
      ),
    );
    veteranScenario.question_ref = raceQuestion.id;
    const codes = issueCodes(value);
    expect(codes).toContain("QUESTION_CLUSTER_ORPHANED");
  });

  test("rejects an orphaned answer constraint", () => {
    const value = corpus();
    const minChars = required(
      value.answerConstraints.find((item) => item.min_characters === 20),
    );
    for (const scenario of value.answerScenarios) {
      if (scenario.constraint_ref === minChars.id) {
        delete scenario.constraint_ref;
        delete scenario.constraint_evaluation;
      }
    }
    expect(issueCodes(value)).toContain("ANSWER_CONSTRAINT_ORPHANED");
  });

  test("rejects a dangling question reference", () => {
    const value = corpus();
    required(value.answerScenarios[0]).question_ref =
      "question_99999999999999999999999999";
    expect(issueCodes(value)).toContain("REFERENCE_DANGLING");
  });

  test("rejects an impossible constraint combination", () => {
    const value = corpus();
    const bounded = required(
      value.answerConstraints.find(
        (item) => item.min_words === 5 && item.max_words === 60,
      ),
    );
    bounded.min_words = 61;
    expect(issueCodes(value)).toContain("CONSTRAINT_IMPOSSIBLE");
  });

  test("rejects a W02 record rebound to the wrong review event", () => {
    const value = corpus();
    required(value.questionCases[0]).metadata.reviewed_at =
      "2026-07-29T08:55:00Z";
    expect(issueCodes(value)).toContain("REVIEW_DATE_DIVERGENCE");
  });

  test("rejects duplicate stable IDs across the answer layer", () => {
    const value = corpus();
    const [first, second] = value.answerScenarios;
    required(second).id = required(first).id;
    expect(issueCodes(value)).toContain("GLOBAL_STABLE_ID_DUPLICATE");
  });
});
