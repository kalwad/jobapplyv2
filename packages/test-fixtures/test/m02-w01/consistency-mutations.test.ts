import { describe, expect, test } from "vitest";

import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type { FixtureCorpus } from "../../src/model.ts";

function corpus(): FixtureCorpus {
  return structuredClone(loadFixtureCorpus());
}

function issueCodes(value: FixtureCorpus): string[] {
  return validateFixtureConsistency(value).issues.map((issue) => issue.code);
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("reviewed consistency mutation input is missing");
  }
  return value;
}

describe("M02-W01 independently authored consistency mutations", () => {
  test("rejects direct evidence that lacks the normalized requirement tag", () => {
    const value = corpus();
    const claim = value.expectedSupportedClaims.find(
      (item) => item.support_classification === "DIRECT",
    );
    const requirement = value.expectedRequirements.find(
      (item) => item.id === claim?.requirement_ref,
    );
    const replacement = value.evidenceArtifacts.find(
      (artifact) =>
        artifact.profile_ref === claim?.profile_ref &&
        requirement !== undefined &&
        !artifact.fact_keys.includes(requirement.requirement_tag),
    );
    if (claim === undefined || replacement === undefined) {
      throw new Error("reviewed direct-support mutation input is missing");
    }
    claim.evidence_refs = [replacement.id];
    expect(issueCodes(value)).toContain("DIRECT_REQUIREMENT_TAG_MISMATCH");
  });

  test("rejects a dangling reference", () => {
    const value = corpus();
    required(value.scenarioBundles[0]).resume_ref =
      "resume_7ZZZZZZZZZZZZZZZZZZZZZZZZZ";
    expect(issueCodes(value)).toContain("REFERENCE_DANGLING");
  });

  test("rejects a reference that resolves to the wrong entity type", () => {
    const value = corpus();
    required(value.scenarioBundles[0]).job_ref = required(value.profiles[0]).id;
    expect(issueCodes(value)).toContain("REFERENCE_WRONG_TYPE");
  });

  test("rejects cross-profile evidence leakage", () => {
    const value = corpus();
    const otherProfile = required(value.profiles[1]);
    required(value.expectedSupportedClaims[0]).evidence_refs = [
      required(
        value.evidenceArtifacts.find(
          (artifact) => artifact.profile_ref === otherProfile.id,
        ),
      ).id,
    ];
    expect(issueCodes(value)).toContain("CROSS_PROFILE_EVIDENCE");
  });

  test("rejects a resume fact with no supporting evidence", () => {
    const value = corpus();
    const resume = required(value.sourceResumes[0]);
    required(resume.facts[0]).evidence_refs = [];
    expect(issueCodes(value)).toContain("RESUME_FACT_UNSUPPORTED");
  });

  test("rejects a supported claim with an empty evidence set", () => {
    const value = corpus();
    required(value.expectedSupportedClaims[0]).evidence_refs = [];
    expect(issueCodes(value)).toContain("CLAIM_EVIDENCE_EMPTY");
  });

  test("rejects a gap that declares supporting evidence", () => {
    const value = corpus();
    required(value.unsupportedGaps[0]).supporting_evidence_refs.push(
      required(value.evidenceArtifacts[0]).id,
    );
    expect(issueCodes(value)).toContain("GAP_HAS_SUPPORTING_EVIDENCE");
  });

  test("rejects a must-have/preferred mismatch", () => {
    const value = corpus();
    required(value.expectedRequirements[0]).importance = "PREFERRED";
    expect(issueCodes(value)).toContain("REQUIREMENT_IMPORTANCE_MISMATCH");
  });

  test("rejects source-anchor drift", () => {
    const value = corpus();
    required(value.expectedRequirements[0]).source_anchor_id =
      "job-24.requirements.03";
    expect(issueCodes(value)).toContain("SOURCE_ANCHOR_DRIFT");
  });

  test("rejects a reversed evidence chronology", () => {
    const value = corpus();
    required(value.evidenceArtifacts[0]).effective_period.start = "2030-01-01";
    expect(issueCodes(value)).toContain("CHRONOLOGY_REVERSED");
  });

  test("rejects overlapping employment without a concurrency group", () => {
    const value = corpus();
    const profile = required(value.profiles[0]);
    const employment = value.evidenceArtifacts.filter(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "EMPLOYMENT_RECORD",
    );
    required(employment[1]).effective_period.start = required(
      required(employment[0]).effective_period.end,
    );
    expect(issueCodes(value)).toContain("EMPLOYMENT_OVERLAP");
  });

  test("rejects education ending after the declared career start", () => {
    const value = corpus();
    const profile = required(value.profiles[0]);
    const education = value.evidenceArtifacts.find(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "EDUCATION_RECORD",
    );
    required(education).effective_period.end = "2030-01-01";
    expect(issueCodes(value)).toContain("EDUCATION_DATE_INCONSISTENT");
  });

  test("rejects unsafe policy defaults and unconfirmed claim release", () => {
    const value = corpus();
    const policy = value.fieldValuePolicies.find(
      (item) => item.policy === "NEVER_AUTOFILL",
    );
    required(policy).recorded_value = "FIXTURE_SILENT_DEFAULT";
    const confirmPolicy = value.fieldValuePolicies.find(
      (item) => item.policy === "CONFIRM_ONCE_PER_JOB",
    );
    const claim = value.expectedSupportedClaims.find(
      (item) => item.field_policy_ref === confirmPolicy?.id,
    );
    required(claim).release_eligible = true;
    const codes = issueCodes(value);
    expect(codes).toContain("INVALID_SENSITIVE_POLICY");
    expect(codes).toContain("CLAIM_POLICY_RELEASE_MISMATCH");
  });

  test("rejects a consequential value without an explicit source", () => {
    const value = corpus();
    const policy = value.fieldValuePolicies.find((item) => item.consequential);
    required(policy).source_evidence_ref =
      "evidence_7ZZZZZZZZZZZZZZZZZZZZZZZZZ";
    expect(issueCodes(value)).toContain("CONSEQUENTIAL_VALUE_WITHOUT_SOURCE");
  });

  test("rejects keyword-only skill injection", () => {
    const value = corpus();
    required(value.profiles[0]).skills.push("Unbacked Keyword Skill");
    expect(issueCodes(value)).toContain("KEYWORD_ONLY_SKILL");
  });

  test("rejects missing author, reviewer, or expected-result provenance", () => {
    const value = corpus();
    const profile = required(value.profiles[0]);
    profile.metadata.author = "";
    (
      profile.metadata as {
        expected_result_provenance: string;
      }
    ).expected_result_provenance = "";
    expect(issueCodes(value)).toContain("REVIEW_METADATA_MISSING");
  });

  test("rejects author and reviewer identity reuse", () => {
    const value = corpus();
    const profile = required(value.profiles[0]);
    profile.metadata.reviewer = profile.metadata.author;
    expect(issueCodes(value)).toContain("AUTHOR_REVIEWER_ROLE_REUSED");
  });
});
