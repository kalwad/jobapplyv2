import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { measureAnswerAgainstConstraint } from "../../src/answer-metrics.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type {
  AnswerOutcome,
  ExpectedAction,
  FixtureCorpus,
  QuestionIntent,
} from "../../src/model.ts";

interface AnswerTruthOracle {
  readonly reviewed_at: string;
  readonly answer_counts: {
    readonly question_cases: number;
    readonly question_clusters: number;
    readonly answer_constraints: number;
    readonly answer_scenarios: number;
  };
  readonly base_canonical_per_intent: Readonly<Record<QuestionIntent, number>>;
  readonly outcome_counts: Readonly<Record<AnswerOutcome, number>>;
  readonly exercised_policy_kinds: readonly string[];
  readonly exercised_sensitive_concepts: readonly string[];
  readonly stale_decisions: readonly (readonly [
    number,
    string,
    ExpectedAction,
  ])[];
  readonly insufficiency_decisions: readonly (readonly [
    number,
    string,
    AnswerOutcome,
  ])[];
  readonly limit_boundaries: readonly (readonly [
    number,
    string,
    number,
    number,
    boolean,
  ])[];
  readonly explicit_answers: readonly (readonly [number, string, string])[];
  readonly reuse_traps: readonly (readonly [number, number])[];
  readonly projection_sha256: string;
}

const ORACLE = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./oracles/answer-truth.v2.json", import.meta.url)),
    "utf8",
  ),
) as AnswerTruthOracle;

function scenarioNumber(id: string): number {
  return Number.parseInt(id.slice(-8), 10);
}

function answerProjection(corpus: FixtureCorpus) {
  const questions = new Map(
    corpus.questionCases.map((question) => [question.id, question]),
  );
  return corpus.answerScenarios.map((scenario) => ({
    scenario: scenario.id,
    question: scenario.question_ref,
    cluster: questions.get(scenario.question_ref)?.cluster_ref,
    intent: questions.get(scenario.question_ref)?.intent,
    concept: questions.get(scenario.question_ref)?.sensitive_concept ?? null,
    profile: scenario.profile_ref,
    job: scenario.job_ref,
    date: scenario.evaluation_date,
    outcome: scenario.expected_outcome,
    action: scenario.expected_action,
    release: scenario.release_eligible,
    constraint: scenario.constraint_ref ?? null,
    measured: scenario.constraint_evaluation ?? null,
    policy: scenario.field_policy_ref ?? null,
    basis: scenario.policy_basis ?? null,
    default_policy: scenario.default_policy ?? null,
    answer_text: scenario.answer?.text ?? null,
    answer_evidence: scenario.answer?.evidence_refs ?? null,
    reused: scenario.reused_answer_scenario_ref ?? null,
    stale: scenario.stale_reason ?? null,
    insufficiency: scenario.insufficiency_reason ?? null,
    context_refs: scenario.context_refs ?? null,
  }));
}

describe("M02-W02 committed question and answer development matrix", () => {
  test("matches the independent answer-layer counts and manifest inventory", () => {
    const corpus = loadFixtureCorpus();
    expect(corpus.manifest.answer_counts).toEqual(ORACLE.answer_counts);
    expect(corpus.questionCases).toHaveLength(
      ORACLE.answer_counts.question_cases,
    );
    expect(corpus.answerConstraints).toHaveLength(
      ORACLE.answer_counts.answer_constraints,
    );
    expect(corpus.answerScenarios).toHaveLength(
      ORACLE.answer_counts.answer_scenarios,
    );
    expect(corpus.manifest.metadata.reviewed_at).toBe(ORACLE.reviewed_at);
    expect(corpus.manifest.metadata.expected_result_provenance).toBe(
      "M02W02_SYNTHETIC_AUTHORING_REVIEW",
    );
  });

  test("keeps every base intent balanced at exactly two canonical clusters", () => {
    const corpus = loadFixtureCorpus();
    const counts = new Map<string, number>();
    for (const question of corpus.questionCases) {
      if (question.layer === "BASE" && question.case_role === "CANONICAL") {
        counts.set(question.intent, (counts.get(question.intent) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries([...counts].sort())).toEqual(
      ORACLE.base_canonical_per_intent,
    );
  });

  test("keeps every cluster at one canonical case with three meaningful members", () => {
    const corpus = loadFixtureCorpus();
    const clusters = new Map<string, typeof corpus.questionCases>();
    for (const question of corpus.questionCases) {
      const group = clusters.get(question.cluster_ref) ?? [];
      group.push(question);
      clusters.set(question.cluster_ref, group);
    }
    expect(clusters.size).toBe(ORACLE.answer_counts.question_clusters);
    for (const members of clusters.values()) {
      expect(members).toHaveLength(3);
      expect(
        members.filter((member) => member.case_role === "CANONICAL"),
      ).toHaveLength(1);
      expect(new Set(members.map((member) => member.intent)).size).toBe(1);
    }
  });

  test("exercises every cluster through at least one answer scenario", () => {
    const corpus = loadFixtureCorpus();
    const questions = new Map(
      corpus.questionCases.map((question) => [question.id, question]),
    );
    const exercised = new Set(
      corpus.answerScenarios.map(
        (scenario) => questions.get(scenario.question_ref)?.cluster_ref,
      ),
    );
    expect(exercised.size).toBe(ORACLE.answer_counts.question_clusters);
  });

  test("matches the reviewed outcome distribution exactly", () => {
    const corpus = loadFixtureCorpus();
    const counts = new Map<string, number>();
    for (const scenario of corpus.answerScenarios) {
      counts.set(
        scenario.expected_outcome,
        (counts.get(scenario.expected_outcome) ?? 0) + 1,
      );
    }
    expect(Object.fromEntries([...counts].sort())).toEqual(
      ORACLE.outcome_counts,
    );
  });

  test("exercises all six field-policy kinds and all fifteen sensitive concepts", () => {
    const corpus = loadFixtureCorpus();
    const policies = new Map(
      corpus.fieldValuePolicies.map((policy) => [policy.id, policy]),
    );
    const questions = new Map(
      corpus.questionCases.map((question) => [question.id, question]),
    );
    const kinds = new Set<string>();
    const concepts = new Set<string>();
    for (const scenario of corpus.answerScenarios) {
      if (scenario.field_policy_ref !== undefined) {
        const policy = policies.get(scenario.field_policy_ref);
        if (policy !== undefined) {
          kinds.add(policy.policy);
        }
      }
      const concept = questions.get(scenario.question_ref)?.sensitive_concept;
      if (concept !== undefined) {
        concepts.add(concept);
      }
    }
    expect([...kinds].sort()).toEqual([...ORACLE.exercised_policy_kinds]);
    expect([...concepts].sort()).toEqual([
      ...ORACLE.exercised_sensitive_concepts,
    ]);
  });

  test("matches every reviewed stale-context decision", () => {
    const corpus = loadFixtureCorpus();
    const actual = corpus.answerScenarios
      .filter((scenario) => scenario.stale_reason !== undefined)
      .map((scenario) => [
        scenarioNumber(scenario.id),
        scenario.stale_reason,
        scenario.expected_action,
      ]);
    expect(actual).toEqual(ORACLE.stale_decisions.map((row) => [...row]));
    for (const scenario of corpus.answerScenarios) {
      if (scenario.expected_outcome === "STALE_CONTEXT") {
        expect(scenario.release_eligible).toBe(false);
        expect(scenario.answer).toBeUndefined();
      }
    }
  });

  test("matches every reviewed insufficiency decision with no released text", () => {
    const corpus = loadFixtureCorpus();
    const actual = corpus.answerScenarios
      .filter((scenario) => scenario.insufficiency_reason !== undefined)
      .map((scenario) => [
        scenarioNumber(scenario.id),
        scenario.insufficiency_reason,
        scenario.expected_outcome,
      ]);
    expect(actual).toEqual(
      ORACLE.insufficiency_decisions.map((row) => [...row]),
    );
    for (const scenario of corpus.answerScenarios) {
      if (
        scenario.expected_outcome === "INSUFFICIENT_EVIDENCE" ||
        scenario.expected_outcome === "UNSUPPORTED_OR_CONTRADICTED"
      ) {
        expect(scenario.release_eligible).toBe(false);
        expect(scenario.answer).toBeUndefined();
      }
    }
  });

  test("matches every deterministic limit boundary and recomputes it", () => {
    const corpus = loadFixtureCorpus();
    const constraints = new Map(
      corpus.answerConstraints.map((item) => [item.id, item]),
    );
    const rows = corpus.answerScenarios
      .filter((scenario) => scenario.constraint_evaluation?.boundary)
      .map((scenario) => {
        const evaluation = scenario.constraint_evaluation;
        if (
          evaluation === undefined ||
          scenario.constraint_ref === undefined ||
          scenario.answer === undefined
        ) {
          throw new Error("reviewed boundary scenario shape is missing");
        }
        const constraint = constraints.get(scenario.constraint_ref);
        if (constraint === undefined) {
          throw new Error("reviewed boundary constraint is missing");
        }
        const recomputed = measureAnswerAgainstConstraint(
          constraint,
          scenario.answer.text,
        );
        expect(recomputed.measured_words).toBe(evaluation.measured_words);
        expect(recomputed.measured_characters).toBe(
          evaluation.measured_characters,
        );
        expect(recomputed.compliant).toBe(evaluation.compliant);
        expect(scenario.release_eligible).toBe(evaluation.compliant);
        return [
          scenarioNumber(scenario.id),
          evaluation.boundary,
          evaluation.measured_words,
          evaluation.measured_characters,
          evaluation.compliant,
        ];
      });
    expect(rows).toEqual(ORACLE.limit_boundaries.map((row) => [...row]));
  });

  test("matches every explicit-record answer binding literally", () => {
    const corpus = loadFixtureCorpus();
    const actual = corpus.answerScenarios
      .filter(
        (scenario) => scenario.expected_outcome === "EXPLICIT_RECORD_ANSWER",
      )
      .map((scenario) => [
        scenarioNumber(scenario.id),
        scenario.answer?.explicit_source,
        scenario.answer?.text,
      ]);
    expect(actual).toEqual(ORACLE.explicit_answers.map((row) => [...row]));
  });

  test("matches the reviewed verbatim-reuse traps", () => {
    const corpus = loadFixtureCorpus();
    const actual = corpus.answerScenarios
      .filter((scenario) => scenario.reused_answer_scenario_ref !== undefined)
      .map((scenario) => [
        scenarioNumber(scenario.id),
        scenarioNumber(scenario.reused_answer_scenario_ref ?? ""),
      ]);
    expect(actual).toEqual(ORACLE.reuse_traps.map((row) => [...row]));
  });

  test("matches the pinned full answer-layer projection digest", () => {
    const corpus = loadFixtureCorpus();
    const digest = `sha256:${createHash("sha256")
      .update(JSON.stringify(answerProjection(corpus)), "utf8")
      .digest("hex")}`;
    expect(digest).toBe(ORACLE.projection_sha256);
  });

  test("keeps released answers compliant, evidence-bound, and profile-local", () => {
    const corpus = loadFixtureCorpus();
    const evidence = new Map(
      corpus.evidenceArtifacts.map((artifact) => [artifact.id, artifact]),
    );
    for (const scenario of corpus.answerScenarios) {
      if (!scenario.release_eligible) {
        continue;
      }
      expect([
        "EXPLICIT_RECORD_ANSWER",
        "SUPPORTED_NARRATIVE_ANSWER",
      ]).toContain(scenario.expected_outcome);
      const answer = scenario.answer;
      expect(answer).toBeDefined();
      if (answer === undefined) {
        continue;
      }
      for (const reference of answer.evidence_refs) {
        expect(evidence.get(reference)?.profile_ref).toBe(scenario.profile_ref);
      }
      if (
        scenario.expected_outcome === "SUPPORTED_NARRATIVE_ANSWER" &&
        answer.explicit_source === undefined
      ) {
        expect(answer.evidence_refs.length).toBeGreaterThan(0);
      }
    }
  });
});
