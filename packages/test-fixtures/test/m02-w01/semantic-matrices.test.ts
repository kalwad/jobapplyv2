import { describe, expect, test } from "vitest";

import { sha256Bytes } from "../../src/canonical-json.ts";
import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type {
  FieldConcept,
  FieldValuePolicyKind,
  FixtureCorpus,
  SupportClassification,
  SyntheticProfile,
} from "../../src/model.ts";
import { fixtureSchemaValidator } from "../../src/schema-catalog.ts";

function corpus(): FixtureCorpus {
  return structuredClone(loadFixtureCorpus());
}

function issues(value: FixtureCorpus): string[] {
  return validateFixtureConsistency(value).issues.map((issue) => issue.code);
}

describe("M02-W01 independently reviewed semantic matrices", () => {
  test("enforces the complete work-authorization status and sponsorship matrix", () => {
    const base = corpus().profiles[0];
    if (base === undefined) {
      throw new Error("profile matrix input missing");
    }
    const cases = [
      ["AUTHORIZED", false, true],
      ["AUTHORIZED", true, false],
      ["REQUIRES_SPONSORSHIP", false, false],
      ["REQUIRES_SPONSORSHIP", true, true],
    ] as const;
    for (const [status, sponsorshipRequired, accepted] of cases) {
      const profile = structuredClone(base);
      profile.work_authorization = {
        country: "US",
        status,
        sponsorship_required: sponsorshipRequired,
      } as SyntheticProfile["work_authorization"];
      const schema = fixtureSchemaValidator().validateInstance(
        profile.schema_ref,
        profile,
      );
      expect(schema.valid, `${status}/${String(sponsorshipRequired)}`).toBe(
        accepted,
      );
    }
  });

  test("binds every eligibility constraint to the complete kind, tag, and constraint matrix", () => {
    const value = corpus();
    const expected = {
      AUTHORIZED_TO_WORK_IN_US: [
        "ELIGIBILITY",
        "field:work_authorization",
        "WORK_AUTHORIZATION",
        "AUTHORIZED_TO_WORK_IN_US",
      ],
      LICENSE_REQUIRED: [
        "CERTIFICATION",
        "license:healthcare-operations",
        "CURRENT_LICENSE",
        "CURRENT_AT_EVALUATION_DATE",
      ],
      NO_SPONSORSHIP: [
        "ELIGIBILITY",
        "field:sponsorship_requirement",
        "SPONSORSHIP",
        "NO_SPONSORSHIP",
      ],
      NONE: [
        "LOCATION",
        "field:relocation_preference",
        "WORK_MODE_COMPATIBILITY",
        null,
      ],
    } as const;
    for (const job of value.jobs) {
      const requirement = value.expectedRequirements.find(
        (candidate) =>
          candidate.job_ref === job.id &&
          candidate.source_anchor_id.endsWith(".02"),
      );
      const row = expected[job.eligibility_constraint];
      expect(requirement).toBeDefined();
      expect([
        requirement?.requirement_kind,
        requirement?.requirement_tag,
        requirement?.constraint.kind,
        requirement?.constraint.value,
      ]).toEqual([row[0], row[1], row[2], row[3] ?? job.work_mode]);
    }
  });

  test("enforces the complete concept sensitivity, consequence, and allowed-policy matrix", () => {
    const matrix: Record<
      FieldConcept,
      {
        sensitivity: "PERSONAL" | "SENSITIVE";
        consequential: boolean;
        allowed: readonly FieldValuePolicyKind[];
      }
    > = {
      DEMOGRAPHIC_DISCLOSURE: {
        sensitivity: "SENSITIVE",
        consequential: false,
        allowed: ["NEVER_AUTOFILL", "VOLUNTARY_PREFER_NOT_TO_ANSWER"],
      },
      LICENSE_VALIDITY: {
        sensitivity: "PERSONAL",
        consequential: true,
        allowed: ["BLOCK_AND_EXPLAIN", "CONFIRM_IF_RECORD_EXPIRED"],
      },
      RELOCATION_PREFERENCE: {
        sensitivity: "PERSONAL",
        consequential: true,
        allowed: [
          "BLOCK_AND_EXPLAIN",
          "CONFIRM_IF_RECORD_EXPIRED",
          "CONFIRM_ONCE_PER_JOB",
          "FILL_FROM_EXPLICIT_RECORD",
        ],
      },
      SALARY_EXPECTATION: {
        sensitivity: "SENSITIVE",
        consequential: true,
        allowed: [
          "BLOCK_AND_EXPLAIN",
          "CONFIRM_ONCE_PER_JOB",
          "NEVER_AUTOFILL",
        ],
      },
      SPONSORSHIP_REQUIREMENT: {
        sensitivity: "PERSONAL",
        consequential: true,
        allowed: [
          "BLOCK_AND_EXPLAIN",
          "CONFIRM_ONCE_PER_JOB",
          "FILL_FROM_EXPLICIT_RECORD",
        ],
      },
      WORK_AUTHORIZATION: {
        sensitivity: "PERSONAL",
        consequential: true,
        allowed: [
          "BLOCK_AND_EXPLAIN",
          "CONFIRM_ONCE_PER_JOB",
          "FILL_FROM_EXPLICIT_RECORD",
        ],
      },
    };
    for (const policy of corpus().fieldValuePolicies) {
      const row = matrix[policy.field_concept];
      expect(policy.sensitivity).toBe(row.sensitivity);
      expect(policy.consequential).toBe(row.consequential);
      expect(row.allowed).toContain(policy.policy);
    }
  });

  test("maps every support classification to its evidence relation, result type, action, and release rule", () => {
    const value = corpus();
    const claims = new Map(
      value.expectedSupportedClaims.map((claim) => [claim.id, claim]),
    );
    const gaps = new Map(value.unsupportedGaps.map((gap) => [gap.id, gap]));
    const evidence = new Map(
      value.evidenceArtifacts.map((artifact) => [artifact.id, artifact]),
    );
    const supportedRelations: Record<
      Exclude<
        SupportClassification,
        "CONTRADICTED" | "PARTIAL" | "UNSUPPORTED"
      >,
      string
    > = {
      DIRECT: "DIRECT",
      STRONG_RELATED: "STRONG_RELATED",
      USER_ASSERTED: "USER_ASSERTED",
    };
    for (const scenario of value.scenarioBundles) {
      for (const evaluation of scenario.evaluations) {
        if (evaluation.result_type === "SUPPORTED_CLAIM") {
          const claim = claims.get(evaluation.result_ref);
          expect(claim).toBeDefined();
          expect(claim?.support_classification).toBe(evaluation.classification);
          expect(claim?.release_eligible).toBe(
            evaluation.expected_action === "USE_SUPPORTED_EVIDENCE",
          );
          for (const reference of claim?.evidence_refs ?? []) {
            const relation = evidence
              .get(reference)
              ?.requirement_relations.find(
                (candidate) =>
                  candidate.requirement_ref === evaluation.requirement_ref,
              )?.relation;
            expect(relation).toBe(
              supportedRelations[
                evaluation.classification as keyof typeof supportedRelations
              ],
            );
          }
        } else {
          const gap = gaps.get(evaluation.result_ref);
          expect(gap).toBeDefined();
          expect(gap?.classification).toBe(evaluation.classification);
          expect(gap?.expected_action).toBe(evaluation.expected_action);
          expect(gap?.supporting_evidence_refs).toEqual([]);
          const expectedRelation =
            evaluation.classification === "PARTIAL"
              ? "PARTIAL"
              : evaluation.classification === "CONTRADICTED"
                ? "CONTRADICTS"
                : undefined;
          for (const reference of gap?.related_or_contradicting_evidence_refs ??
            []) {
            expect(
              evidence
                .get(reference)
                ?.requirement_relations.find(
                  (candidate) =>
                    candidate.requirement_ref === evaluation.requirement_ref,
                )?.relation,
            ).toBe(expectedRelation);
          }
        }
      }
    }
  });

  test("binds every source block to one structured expected requirement and canonical rendering", () => {
    const value = corpus();
    for (const job of value.jobs) {
      for (const block of job.source_blocks) {
        const requirement = value.expectedRequirements.filter(
          (candidate) =>
            candidate.job_ref === job.id &&
            candidate.source_anchor_id === block.anchor_id,
        );
        expect(requirement).toHaveLength(1);
        expect(requirement[0]).toMatchObject({
          importance: block.declared_importance,
          requirement_kind: block.requirement_kind,
          requirement_tag: block.requirement_tag,
          constraint: block.constraint,
          normalized_text: block.text,
          source_text_sha256: block.text_sha256,
        });
        expect(block.text).toBe(
          [
            `Requirement ${block.requirement_kind}`,
            `tagged ${block.requirement_tag}`,
            `constraint ${block.constraint.kind}=${block.constraint.value}`,
            `importance ${block.declared_importance}.`,
          ].join("; "),
        );
        expect(block.text_sha256).toBe(sha256Bytes(block.text));
      }
    }
  });

  test("assigns category-specific effective-period meaning to every artifact", () => {
    const expected = {
      CREDENTIAL_RECORD: "CREDENTIAL_VALIDITY",
      EDUCATION_RECORD: "EDUCATION_ATTENDANCE",
      EMPLOYMENT_RECORD: "ACTIVITY_INTERVAL",
      PROJECT_RECORD: "ACTIVITY_INTERVAL",
      USER_ASSERTION: "ASSERTION_FRESHNESS",
    } as const;
    for (const artifact of corpus().evidenceArtifacts) {
      expect(artifact.temporal_semantics).toBe(expected[artifact.category]);
      expect(artifact.education_state !== undefined).toBe(
        artifact.category === "EDUCATION_RECORD",
      );
      expect(artifact.credential_validity_basis !== undefined).toBe(
        artifact.category === "CREDENTIAL_RECORD",
      );
      expect(artifact.assertion_approval === "USER_APPROVED").toBe(
        artifact.category === "USER_ASSERTION",
      );
    }
  });

  test("covers current, expired, not-yet-valid, revoked, and unknown credential decisions", () => {
    const value = corpus();
    const cases = [
      ["evidence_00000000000000000000000039", "CURRENT"],
      ["evidence_00000000000000000000000041", "EXPIRED"],
      ["evidence_00000000000000000000000046", "NOT_YET_VALID"],
      ["evidence_00000000000000000000000047", "REVOKED"],
      ["evidence_00000000000000000000000052", "UNKNOWN"],
    ] as const;
    const stateAt = (id: string): string => {
      const artifact = value.evidenceArtifacts.find(
        (candidate) => candidate.id === id,
      );
      if (artifact === undefined) {
        throw new Error("credential matrix input missing");
      }
      if (
        artifact.revoked_on !== undefined &&
        artifact.revoked_on <= "2026-07-29"
      ) {
        return "REVOKED";
      }
      if (artifact.effective_period.start > "2026-07-29") {
        return "NOT_YET_VALID";
      }
      if (artifact.credential_validity_basis === "UNKNOWN") {
        return "UNKNOWN";
      }
      if (
        artifact.effective_period.end !== undefined &&
        artifact.effective_period.end < "2026-07-29"
      ) {
        return "EXPIRED";
      }
      return "CURRENT";
    };
    expect(cases.map(([id]) => [id, stateAt(id)])).toEqual(cases);
    const decisionMatrix = {
      CURRENT: ["DIRECT", "USE_SUPPORTED_EVIDENCE", true],
      EXPIRED: ["PARTIAL", "REQUIRE_CONFIRMATION", false],
      NOT_YET_VALID: ["CONTRADICTED", "BLOCK_AND_EXPLAIN", false],
      REVOKED: ["CONTRADICTED", "BLOCK_AND_EXPLAIN", false],
      UNKNOWN: ["UNSUPPORTED", "REQUIRE_CONFIRMATION", false],
    } as const;
    expect(Object.keys(decisionMatrix).sort()).toEqual(
      cases.map(([, state]) => state).sort(),
    );
  });

  test("derives record freshness from scenario dates instead of metadata review time", () => {
    const value = corpus();
    const profileId = "profile_00000000000000000000000002";
    const resume = value.sourceResumes.find(
      (candidate) => candidate.profile_ref === profileId,
    );
    if (resume === undefined) {
      throw new Error("clock mutation resume missing");
    }
    resume.as_of = "2028-07-29";
    for (const scenario of value.scenarioBundles.filter(
      (candidate) => candidate.profile_ref === profileId,
    )) {
      scenario.evaluation_date = "2028-07-29";
    }
    expect(issues(value)).toContain("SCENARIO_POLICY_MISMATCH");
  });

  test("enforces global uniqueness across facts, field records, and source anchors", () => {
    const value = corpus();
    const ids = [
      ...value.sourceResumes.flatMap((resume) =>
        resume.facts.map((fact) => fact.fact_id),
      ),
      ...value.evidenceArtifacts.flatMap((artifact) =>
        artifact.field_records.map((record) => record.field_record_id),
      ),
      ...value.jobs.flatMap((job) =>
        job.source_blocks.map((block) => block.anchor_id),
      ),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("requires a substantive exact page boundary for the two-page case", () => {
    const resume = corpus().sourceResumes.find(
      (candidate) => candidate.page_count === 2,
    );
    const breakIndex = resume?.facts.findIndex(
      (fact) => fact.fact_id === resume.page_boundary?.break_after_fact_id,
    );
    expect(resume).toBeDefined();
    expect(resume?.page_boundary?.rationale.length).toBeGreaterThanOrEqual(30);
    expect(
      resume?.facts.filter((fact) => fact.page === 2).length,
    ).toBeGreaterThanOrEqual(3);
    expect(breakIndex).toBeGreaterThanOrEqual(0);
    expect(
      resume?.facts
        .slice((breakIndex ?? -1) + 1)
        .every((fact) => fact.page === 2),
    ).toBe(true);
  });
});
