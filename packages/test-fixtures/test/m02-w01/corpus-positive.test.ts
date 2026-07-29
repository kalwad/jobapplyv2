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
  readonly counts: FixtureCounts;
  readonly evidence_category_counts: Record<EvidenceCategory, number>;
  readonly credential_states_at_2026_07_29: readonly (readonly [
    string,
    "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "REVOKED" | "UNKNOWN",
  ])[];
  readonly scenarios: readonly {
    readonly scenario: string;
    readonly outcome: string;
    readonly evaluations: readonly (readonly [
      string,
      string,
      string,
      string,
      string,
    ])[];
    readonly policies: readonly (readonly [string, string, string, boolean])[];
  }[];
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
    const manifest = loadFixtureCorpus().manifest;
    expect(manifest.counts).toEqual(ORACLE.counts);
    expect(manifest.evidence_category_counts).toEqual(
      ORACLE.evidence_category_counts,
    );
  });

  test("matches all 36 independently enumerated scenario outcomes and 108 evaluations", () => {
    const actual = loadFixtureCorpus().scenarioBundles.map((scenario) => ({
      scenario: scenario.id,
      outcome: scenario.expected_outcome,
      evaluations: scenario.evaluations.map((evaluation) => [
        evaluation.requirement_ref,
        evaluation.classification,
        evaluation.expected_action,
        evaluation.result_type,
        evaluation.result_ref,
      ]),
      policies: scenario.policy_evaluations.map((evaluation) => [
        evaluation.policy_ref,
        evaluation.field_concept,
        evaluation.expected_action,
        evaluation.release_eligible,
      ]),
    }));
    expect(actual).toEqual(ORACLE.scenarios);
    expect(actual.flatMap((scenario) => scenario.evaluations)).toHaveLength(
      108,
    );
  });

  test("matches every independently enumerated credential state at the evaluation date", () => {
    const credentials = loadFixtureCorpus().evidenceArtifacts.filter(
      (artifact) => artifact.category === "CREDENTIAL_RECORD",
    );
    expect(
      credentials.map((artifact) => [
        artifact.id,
        credentialState(artifact, "2026-07-29"),
      ]),
    ).toEqual(ORACLE.credential_states_at_2026_07_29);
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
    const multi = corpus.expectedSupportedClaims.filter(
      (claim) => claim.evidence_refs.length >= 2,
    );
    expect(topology.size).toBeGreaterThanOrEqual(4);
    expect(new Set(resumeCounts).size).toBeGreaterThanOrEqual(4);
    expect(
      Math.max(...resumeCounts) - Math.min(...resumeCounts),
    ).toBeGreaterThanOrEqual(3);
    expect(jobShapes.size).toBeGreaterThanOrEqual(12);
    expect(multi.length).toBeGreaterThanOrEqual(8);
    expect(
      multi.filter((claim) => claim.evidence_refs.length >= 3).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      corpus.scenarioBundles.filter(
        (scenario) => scenario.expected_outcome === "BLOCK_FIELD_POLICY",
      ).length,
    ).toBeGreaterThanOrEqual(3);
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
