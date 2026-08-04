import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  fixtureEntityHash,
  fixtureManifestHash,
} from "../../src/canonical-json.ts";
import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type {
  EvidenceArtifact,
  EvidenceCategory,
  FixtureCounts,
  RoleFamily,
} from "../../src/model.ts";

interface TruthOracle {
  readonly reviewed_at: string;
  readonly counts: FixtureCounts;
  readonly evidence_category_counts: Record<EvidenceCategory, number>;
  readonly projection_hashes: {
    readonly scenarios: string;
    readonly resumes: string;
    readonly profile_field_couplings: string;
    readonly credentials: string;
  };
  readonly credential_state_cases: readonly (readonly [
    string,
    string,
    "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "REVOKED" | "UNKNOWN",
  ])[];
  readonly critical_results: readonly {
    readonly scenario: string;
    readonly requirement: string;
    readonly classification: string;
    readonly action: string;
    readonly result_type: string;
    readonly result: string;
    readonly release_eligible: boolean;
    readonly evidence_refs: readonly string[];
    readonly reason_code: string | null;
    readonly rationale: string;
  }[];
  readonly stale_policies: readonly {
    readonly scenario: string;
    readonly policy: string;
    readonly source_evidence: string;
    readonly source_field_record: string;
    readonly recorded_on: string;
    readonly valid_through: string;
    readonly evaluation_date: string;
    readonly action: string;
    readonly release_eligible: boolean;
  }[];
  readonly profile_field_control: {
    readonly profile: string;
    readonly authorization_status: string;
    readonly sponsorship_required: boolean;
    readonly relocation: string;
    readonly assertion: string;
    readonly assertion_effective_start: string;
    readonly work_authorization_record: string;
    readonly work_authorization_value: string;
    readonly work_authorization_disclosure: string;
    readonly sponsorship_record: string;
    readonly sponsorship_value: string;
    readonly sponsorship_disclosure: string;
  };
  readonly coherent_policy_control: {
    readonly scenario: string;
    readonly outcome: string;
    readonly policy: string;
    readonly kind: string;
    readonly action: string;
    readonly release_eligible: boolean;
  };
  readonly resume_11: {
    readonly resume: string;
    readonly profile: string;
    readonly page_count: number;
    readonly break_after_fact_id: string;
    readonly rationale: string;
    readonly page_one: readonly (readonly [string, string])[];
    readonly page_two: readonly (readonly [string, string])[];
  };
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function resultProjection(corpus: ReturnType<typeof loadFixtureCorpus>) {
  const claims = new Map(
    corpus.expectedSupportedClaims.map((claim) => [claim.id, claim]),
  );
  const gaps = new Map(corpus.unsupportedGaps.map((gap) => [gap.id, gap]));
  const requirements = new Map(
    corpus.expectedRequirements.map((requirement) => [
      requirement.id,
      requirement,
    ]),
  );
  const policies = new Map(
    corpus.fieldValuePolicies.map((policy) => [policy.id, policy]),
  );
  const evidence = new Map(
    corpus.evidenceArtifacts.map((artifact) => [artifact.id, artifact]),
  );
  return corpus.scenarioBundles.map((scenario) => ({
    scenario: scenario.id,
    profile: scenario.profile_ref,
    resume: scenario.resume_ref,
    job: scenario.job_ref,
    evaluation_date: scenario.evaluation_date,
    outcome: scenario.expected_outcome,
    evaluations: scenario.evaluations.map((evaluation) => {
      const requirement = requirements.get(evaluation.requirement_ref);
      const claim = claims.get(evaluation.result_ref);
      const gap = gaps.get(evaluation.result_ref);
      const result = claim ?? gap;
      return {
        requirement: evaluation.requirement_ref,
        kind: requirement?.requirement_kind,
        tag: requirement?.requirement_tag,
        importance: requirement?.importance,
        constraint: requirement?.constraint,
        classification: evaluation.classification,
        action: evaluation.expected_action,
        result_type: evaluation.result_type,
        result: evaluation.result_ref,
        release_eligible: claim?.release_eligible ?? false,
        evidence_refs:
          claim?.evidence_refs ??
          gap?.related_or_contradicting_evidence_refs ??
          [],
        reason_code: gap?.reason_code ?? null,
        rationale: result?.support_review_rationale,
      };
    }),
    policies: scenario.policy_evaluations.map((evaluation) => {
      const policy = policies.get(evaluation.policy_ref);
      const source = evidence.get(evaluation.source_evidence_ref);
      const record = source?.field_records.find(
        (candidate) =>
          candidate.field_record_id === policy?.source_field_record_id,
      );
      return {
        policy: evaluation.policy_ref,
        kind: policy?.policy,
        concept: evaluation.field_concept,
        consequential: policy?.consequential,
        recorded_value: policy?.recorded_value ?? null,
        source_evidence: evaluation.source_evidence_ref,
        source_field_record: policy?.source_field_record_id ?? null,
        effective_start: source?.effective_period.start,
        effective_end: source?.effective_period.end ?? null,
        recorded_on: record?.recorded_on ?? null,
        valid_through: record?.valid_through ?? null,
        action: evaluation.expected_action,
        release_eligible: evaluation.release_eligible,
      };
    }),
  }));
}

function resumeProjection(corpus: ReturnType<typeof loadFixtureCorpus>) {
  return corpus.sourceResumes.map((resume) => ({
    resume: resume.id,
    profile: resume.profile_ref,
    as_of: resume.as_of,
    page_count: resume.page_count,
    boundary: resume.page_boundary ?? null,
    facts: resume.facts.map((fact) => ({
      fact: fact.fact_id,
      page: fact.page,
      text: fact.text,
      fact_keys: fact.fact_keys,
      evidence_refs: fact.evidence_refs,
    })),
  }));
}

function couplingProjection(corpus: ReturnType<typeof loadFixtureCorpus>) {
  return corpus.profiles.map((profile) => {
    const assertion = corpus.evidenceArtifacts.find(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "USER_ASSERTION",
    );
    return {
      profile: profile.id,
      authorization: profile.work_authorization,
      relocation: profile.constraints.relocation,
      assertion: assertion?.id,
      approval: assertion?.assertion_approval,
      effective_period: assertion?.effective_period,
      field_records: assertion?.field_records,
      policies: corpus.fieldValuePolicies
        .filter((policy) => policy.profile_ref === profile.id)
        .map((policy) => ({
          policy: policy.id,
          kind: policy.policy,
          concept: policy.field_concept,
          value: policy.recorded_value ?? null,
          source_evidence: policy.source_evidence_ref,
          source_field_record: policy.source_field_record_id ?? null,
        })),
    };
  });
}

function credentialProjection(corpus: ReturnType<typeof loadFixtureCorpus>) {
  return corpus.evidenceArtifacts
    .filter((artifact) => artifact.category === "CREDENTIAL_RECORD")
    .map((artifact) => ({
      evidence: artifact.id,
      profile: artifact.profile_ref,
      fact_keys: artifact.fact_keys,
      effective_period: artifact.effective_period,
      validity_basis: artifact.credential_validity_basis,
      revoked_on: artifact.revoked_on ?? null,
    }));
}

const ORACLE = JSON.parse(
  readFileSync(
    new URL("oracles/development-truth.v2.json", import.meta.url),
    "utf8",
  ),
) as TruthOracle;

function credentialState(
  artifact: EvidenceArtifact,
  date: string,
): "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "REVOKED" | "UNKNOWN" {
  if (artifact.revoked_on !== undefined && artifact.revoked_on <= date) {
    return "REVOKED";
  }
  if (artifact.effective_period.start > date) {
    return "NOT_YET_VALID";
  }
  if (artifact.credential_validity_basis === "UNKNOWN") {
    return "UNKNOWN";
  }
  if (
    artifact.credential_validity_basis === "BOUNDED" &&
    artifact.effective_period.end !== undefined &&
    artifact.effective_period.end < date
  ) {
    return "EXPIRED";
  }
  return "CURRENT";
}

describe("M02-W01 committed development corpus", () => {
  test("passes every validator invariant with independently enumerated counts", () => {
    const report = validateFixtureConsistency(loadFixtureCorpus());
    expect(report).toEqual({
      valid: true,
      issues: [],
      counts: ORACLE.counts,
    });
  });

  test("matches independent collection and evidence-category inventories", () => {
    const corpus = loadFixtureCorpus();
    const manifest = corpus.manifest;
    const w01Records = [
      ...corpus.profiles,
      ...corpus.evidenceArtifacts,
      ...corpus.sourceResumes,
      ...corpus.jobs,
      ...corpus.expectedRequirements,
      ...corpus.expectedSupportedClaims,
      ...corpus.unsupportedGaps,
      ...corpus.fieldValuePolicies,
      ...corpus.scenarioBundles,
    ];
    for (const record of w01Records) {
      expect(record.metadata.expected_result_provenance).toBe(
        "M02W01_SYNTHETIC_AUTHORING_REVIEW",
      );
      expect(record.metadata.reviewed_at).toBe(ORACLE.reviewed_at);
    }
    expect(manifest.counts).toEqual(ORACLE.counts);
    expect(manifest.evidence_category_counts).toEqual(
      ORACLE.evidence_category_counts,
    );
  });

  test("matches hand-reviewed full-surface projections for all scenarios, results, policies, resumes, couplings, and credentials", () => {
    const corpus = loadFixtureCorpus();
    const scenarios = resultProjection(corpus);
    expect(scenarios).toHaveLength(36);
    expect(scenarios.flatMap((scenario) => scenario.evaluations)).toHaveLength(
      108,
    );
    expect({
      scenarios: digest(scenarios),
      resumes: digest(resumeProjection(corpus)),
      profile_field_couplings: digest(couplingProjection(corpus)),
      credentials: digest(credentialProjection(corpus)),
    }).toEqual(ORACLE.projection_hashes);
  });

  test("matches explicit critical result bindings, rationales, releases, and temporal policy truth", () => {
    const corpus = loadFixtureCorpus();
    const scenarios = resultProjection(corpus);
    const actualResults = ORACLE.critical_results.map((expected) => {
      const scenario = scenarios.find(
        (candidate) => candidate.scenario === expected.scenario,
      );
      const evaluation = scenario?.evaluations.find(
        (candidate) => candidate.requirement === expected.requirement,
      );
      return {
        scenario: scenario?.scenario,
        requirement: evaluation?.requirement,
        classification: evaluation?.classification,
        action: evaluation?.action,
        result_type: evaluation?.result_type,
        result: evaluation?.result,
        release_eligible: evaluation?.release_eligible,
        evidence_refs: evaluation?.evidence_refs,
        reason_code: evaluation?.reason_code,
        rationale: evaluation?.rationale,
      };
    });
    expect(actualResults).toEqual(ORACLE.critical_results);

    const stale = ORACLE.stale_policies.map((expected) => {
      const scenario = corpus.scenarioBundles.find(
        (candidate) => candidate.id === expected.scenario,
      );
      const evaluation = scenario?.policy_evaluations.find(
        (candidate) => candidate.policy_ref === expected.policy,
      );
      const policy = corpus.fieldValuePolicies.find(
        (candidate) => candidate.id === expected.policy,
      );
      const source = corpus.evidenceArtifacts.find(
        (candidate) => candidate.id === evaluation?.source_evidence_ref,
      );
      const record = source?.field_records.find(
        (candidate) =>
          candidate.field_record_id === policy?.source_field_record_id,
      );
      return {
        scenario: scenario?.id,
        policy: policy?.id,
        source_evidence: source?.id,
        source_field_record: record?.field_record_id,
        recorded_on: record?.recorded_on,
        valid_through: record?.valid_through,
        evaluation_date: scenario?.evaluation_date,
        action: evaluation?.expected_action,
        release_eligible: evaluation?.release_eligible,
      };
    });
    expect(stale).toEqual(ORACLE.stale_policies);

    const profile = corpus.profiles.find(
      (candidate) => candidate.id === ORACLE.profile_field_control.profile,
    );
    const assertion = corpus.evidenceArtifacts.find(
      (candidate) => candidate.id === ORACLE.profile_field_control.assertion,
    );
    const authorization = assertion?.field_records.find(
      (record) => record.field_concept === "WORK_AUTHORIZATION",
    );
    const sponsorship = assertion?.field_records.find(
      (record) => record.field_concept === "SPONSORSHIP_REQUIREMENT",
    );
    expect({
      profile: profile?.id,
      authorization_status: profile?.work_authorization.status,
      sponsorship_required: profile?.work_authorization.sponsorship_required,
      relocation: profile?.constraints.relocation,
      assertion: assertion?.id,
      assertion_effective_start: assertion?.effective_period.start,
      work_authorization_record: authorization?.field_record_id,
      work_authorization_value: authorization?.recorded_value,
      work_authorization_disclosure: authorization?.disclosure_text,
      sponsorship_record: sponsorship?.field_record_id,
      sponsorship_value: sponsorship?.recorded_value,
      sponsorship_disclosure: sponsorship?.disclosure_text,
    }).toEqual(ORACLE.profile_field_control);

    const controlScenario = corpus.scenarioBundles.find(
      (candidate) => candidate.id === ORACLE.coherent_policy_control.scenario,
    );
    const controlPolicy = corpus.fieldValuePolicies.find(
      (candidate) => candidate.id === ORACLE.coherent_policy_control.policy,
    );
    const controlEvaluation = controlScenario?.policy_evaluations.find(
      (candidate) =>
        candidate.policy_ref === ORACLE.coherent_policy_control.policy,
    );
    expect({
      scenario: controlScenario?.id,
      outcome: controlScenario?.expected_outcome,
      policy: controlPolicy?.id,
      kind: controlPolicy?.policy,
      action: controlEvaluation?.expected_action,
      release_eligible: controlEvaluation?.release_eligible,
    }).toEqual(ORACLE.coherent_policy_control);
  });

  test("matches independently enumerated credential states at multiple temporal boundaries", () => {
    const corpus = loadFixtureCorpus();
    expect(
      ORACLE.credential_state_cases.map(([id, date]) => {
        const artifact = corpus.evidenceArtifacts.find(
          (candidate) => candidate.id === id,
        );
        if (artifact === undefined) {
          throw new Error("oracle credential input missing");
        }
        return [id, date, credentialState(artifact, date)];
      }),
    ).toEqual(ORACLE.credential_state_cases);
  });

  test("matches the hand-reviewed two-page identity, unique evidence split, and literal rationale", () => {
    const corpus = loadFixtureCorpus();
    const resume = corpus.sourceResumes.find(
      (candidate) => candidate.id === ORACLE.resume_11.resume,
    );
    const rows = (page: 1 | 2) =>
      resume?.facts
        .filter((fact) => fact.page === page)
        .map((fact) => [fact.fact_id, fact.evidence_refs[0]] as const);
    expect({
      resume: resume?.id,
      profile: resume?.profile_ref,
      page_count: resume?.page_count,
      break_after_fact_id: resume?.page_boundary?.break_after_fact_id,
      rationale: resume?.page_boundary?.rationale,
      page_one: rows(1),
      page_two: rows(2),
    }).toEqual(ORACLE.resume_11);
  });

  test("preserves the expired-license adversary while scenario 20 refuses direct release", () => {
    const corpus = loadFixtureCorpus();
    const expired = corpus.evidenceArtifacts.find(
      (artifact) => artifact.id === "evidence_00000000000000000000000041",
    );
    const resume = corpus.sourceResumes.find(
      (item) => item.id === "resume_00000000000000000000000007",
    );
    const scenario = corpus.scenarioBundles.find(
      (item) => item.id === "scenario_00000000000000000000000020",
    );
    const evaluation = scenario?.evaluations.find(
      (item) =>
        item.requirement_ref === "requirement_00000000000000000000000041",
    );
    expect(expired).toMatchObject({
      credential_validity_basis: "BOUNDED",
      effective_period: { start: "2020-01-01", end: "2020-12-31" },
    });
    expect(expired?.statement).toContain("held");
    if (expired === undefined) {
      throw new Error("expired credential fixture is missing");
    }
    expect(
      resume?.facts.some((fact) => fact.evidence_refs.includes(expired.id)),
    ).toBe(true);
    expect(evaluation).toMatchObject({
      classification: "PARTIAL",
      expected_action: "REQUIRE_CONFIRMATION",
      result_type: "UNSUPPORTED_GAP",
    });
    expect(scenario?.expected_outcome).toBe("REQUIRE_CONFIRMATION");
  });

  test("covers all nine role families and all support classifications", () => {
    const corpus = loadFixtureCorpus();
    const expected: Record<RoleFamily, number> = {
      BUSINESS: 1,
      DATA: 2,
      EDUCATION: 1,
      ENTRY_LEVEL: 2,
      FINANCE: 1,
      HEALTHCARE: 1,
      OPERATIONS: 1,
      SALES: 1,
      SOFTWARE: 2,
    };
    expect(corpus.manifest.role_family_counts).toEqual(expected);
    expect(
      [
        ...new Set(
          corpus.scenarioBundles.flatMap((scenario) =>
            scenario.evaluations.map((evaluation) => evaluation.classification),
          ),
        ),
      ].sort(),
    ).toEqual([
      "CONTRADICTED",
      "DIRECT",
      "PARTIAL",
      "STRONG_RELATED",
      "UNSUPPORTED",
      "USER_ASSERTED",
    ]);
  });

  test("materially diversifies topology, resumes, jobs, evidence aggregation, and policy outcomes", () => {
    const corpus = loadFixtureCorpus();
    const topology = new Set(
      corpus.profiles.map((profile) =>
        (
          [
            "EMPLOYMENT_RECORD",
            "PROJECT_RECORD",
            "CREDENTIAL_RECORD",
            "EDUCATION_RECORD",
            "USER_ASSERTION",
          ] as const
        )
          .map(
            (category) =>
              `${category}:${String(
                corpus.evidenceArtifacts.filter(
                  (artifact) =>
                    artifact.profile_ref === profile.id &&
                    artifact.category === category,
                ).length,
              )}`,
          )
          .join("|"),
      ),
    );
    const resumeCounts = corpus.sourceResumes.map(
      (resume) => resume.facts.length,
    );
    const jobShapes = new Set(
      corpus.jobs.map((job) =>
        job.source_blocks
          .map(
            (block) =>
              `${block.requirement_kind}:${block.declared_importance}:${block.constraint.kind}:${block.constraint.value}`,
          )
          .join("|"),
      ),
    );
    const scenarioSignatures = new Set(
      corpus.scenarioBundles.map((scenario) =>
        [
          scenario.expected_outcome,
          ...scenario.evaluations.map(
            (evaluation) =>
              `${evaluation.classification}:${evaluation.expected_action}:${evaluation.result_type}`,
          ),
          ...scenario.policy_evaluations.map(
            (evaluation) =>
              `${evaluation.field_concept}:${evaluation.expected_action}:${String(evaluation.release_eligible)}`,
          ),
        ].join("|"),
      ),
    );
    const multi = corpus.expectedSupportedClaims.filter(
      (claim) => claim.evidence_refs.length >= 2,
    );
    expect(topology.size).toBe(5);
    expect([...new Set(resumeCounts)].sort()).toEqual([4, 5, 6]);
    expect(jobShapes.size).toBe(22);
    expect(scenarioSignatures.size).toBe(31);
    expect(multi).toHaveLength(18);
    expect(
      multi.filter((claim) => claim.evidence_refs.length >= 3),
    ).toHaveLength(16);
    expect(
      corpus.scenarioBundles.filter(
        (scenario) => scenario.expected_outcome === "BLOCK_FIELD_POLICY",
      ),
    ).toHaveLength(20);
    expect(
      corpus.scenarioBundles.flatMap((scenario) => scenario.policy_evaluations),
    ).toHaveLength(69);
    expect(
      new Set(
        corpus.scenarioBundles.flatMap((scenario) => [
          ...scenario.evaluations.map(
            (evaluation) => evaluation.expected_action,
          ),
          ...scenario.policy_evaluations.map(
            (evaluation) => evaluation.expected_action,
          ),
        ]),
      ),
    ).toEqual(
      new Set([
        "ABSTAIN",
        "BLOCK_AND_EXPLAIN",
        "REQUIRE_CONFIRMATION",
        "USE_SUPPORTED_EVIDENCE",
      ]),
    );
  });

  test("reproduces every immutable entity and manifest content hash", () => {
    const corpus = loadFixtureCorpus();
    const entities = [
      ...corpus.profiles,
      ...corpus.evidenceArtifacts,
      ...corpus.sourceResumes,
      ...corpus.jobs,
      ...corpus.expectedRequirements,
      ...corpus.expectedSupportedClaims,
      ...corpus.unsupportedGaps,
      ...corpus.fieldValuePolicies,
      ...corpus.scenarioBundles,
    ];
    expect(
      entities.every(
        (entity) =>
          fixtureEntityHash(entity) === entity.metadata.historical_content_hash,
      ),
    ).toBe(true);
    expect(fixtureManifestHash(corpus.manifest)).toBe(
      corpus.manifest.metadata.historical_content_hash,
    );
  });
});
