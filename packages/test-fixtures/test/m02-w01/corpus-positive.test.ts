import { describe, expect, test } from "vitest";

import {
  fixtureEntityHash,
  fixtureManifestHash,
} from "../../src/canonical-json.ts";
import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import {
  EXPECTED_SEED_COUNTS,
  type EvidenceCategory,
  type RoleFamily,
} from "../../src/model.ts";

describe("M02-W01 committed development corpus", () => {
  test("loads and passes every semantic consistency invariant", () => {
    const corpus = loadFixtureCorpus();
    expect(validateFixtureConsistency(corpus)).toEqual({
      valid: true,
      issues: [],
      counts: EXPECTED_SEED_COUNTS,
    });
  });

  test("locks the exact initial seed inventory", () => {
    expect(loadFixtureCorpus().manifest.counts).toEqual(EXPECTED_SEED_COUNTS);
  });

  test("covers all nine role families with the reviewed distribution", () => {
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
  });

  test("contains at least twelve records in every major evidence category", () => {
    const counts = loadFixtureCorpus().manifest.evidence_category_counts;
    const categories: EvidenceCategory[] = [
      "CREDENTIAL_RECORD",
      "EDUCATION_RECORD",
      "EMPLOYMENT_RECORD",
      "PROJECT_RECORD",
      "USER_ASSERTION",
    ];
    expect(categories.map((category) => counts[category])).toEqual([
      12, 12, 24, 12, 12,
    ]);
  });

  test("balances remote, hybrid, and on-site jobs", () => {
    const modes = loadFixtureCorpus().jobs.reduce(
      (counts, job) => {
        counts[job.work_mode] += 1;
        return counts;
      },
      { HYBRID: 0, ON_SITE: 0, REMOTE: 0 },
    );
    expect(modes).toEqual({ HYBRID: 8, ON_SITE: 8, REMOTE: 8 });
  });

  test("covers all six support and abstention classifications", () => {
    const corpus = loadFixtureCorpus();
    const classifications = new Set(
      corpus.scenarioBundles.flatMap((scenario) =>
        scenario.evaluations.map((evaluation) => evaluation.classification),
      ),
    );
    expect([...classifications].sort()).toEqual([
      "CONTRADICTED",
      "DIRECT",
      "PARTIAL",
      "STRONG_RELATED",
      "UNSUPPORTED",
      "USER_ASSERTED",
    ]);
    const policies = new Map(
      corpus.fieldValuePolicies.map((policy) => [policy.id, policy]),
    );
    const userClaims = corpus.expectedSupportedClaims.filter(
      (claim) => claim.support_classification === "USER_ASSERTED",
    );
    expect(userClaims.length).toBeGreaterThan(0);
    expect(
      userClaims.every((claim) => policies.has(claim.field_policy_ref ?? "")),
    ).toBe(true);
    expect(
      corpus.scenarioBundles.some(
        (scenario) => scenario.expected_outcome === "REQUIRE_CONFIRMATION",
      ),
    ).toBe(true);
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

  test("contains reviewed adversarial, abstention, and ineligibility cases", () => {
    const corpus = loadFixtureCorpus();
    const tags = new Set(
      corpus.profiles.flatMap((profile) => profile.coverage_tags),
    );
    expect([...tags]).toEqual(
      expect.arrayContaining([
        "CAREER_SWITCHER",
        "EMPLOYMENT_GAP",
        "NONTRADITIONAL_EDUCATION",
        "RELOCATION_CONSTRAINT",
        "REQUIRES_SPONSORSHIP",
        "SENSITIVE_NEVER_AUTOFILL",
        "EXPLICIT_CONTRADICTION",
        "TWO_PAGE_RESUME",
        "STRONGEST_OUTCOME_ABSTENTION",
      ]),
    );
    expect(
      corpus.scenarioBundles.some(
        (scenario) => scenario.expected_outcome === "ABSTAIN",
      ),
    ).toBe(true);
    expect(
      corpus.scenarioBundles.filter(
        (scenario) => scenario.expected_outcome === "BLOCK_INELIGIBLE",
      ),
    ).toHaveLength(2);
  });
});
