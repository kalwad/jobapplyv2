import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { format } from "prettier";

import {
  fixtureEntityHash,
  fixtureManifestHash,
  sha256Bytes,
  sha256Canonical,
} from "../src/canonical-json.ts";
import {
  COLLECTION_SPECS,
  COMMITTED_FIXTURE_ROOT,
  fixtureCollection,
} from "../src/loader.ts";
import {
  CORPUS_VERSION,
  EXPECTED_SEED_COUNTS,
  FIXTURE_SCHEMA_VERSION,
  SCHEMA_REFS,
  type CareerStage,
  type EvidenceArtifact,
  type EvidenceCategory,
  type EvidenceRelation,
  type ExpectedRequirement,
  type ExpectedSupportedClaim,
  type FieldValuePolicy,
  type FieldValuePolicyKind,
  type FixtureEntity,
  type FixtureManifest,
  type FixtureManifestFile,
  type FixtureMetadata,
  type GapClassification,
  type RoleFamily,
  type ScenarioBundle,
  type SourceResume,
  type SupportedClassification,
  type SyntheticJob,
  type SyntheticProfile,
  type UnsupportedGap,
  type WorkMode,
} from "../src/model.ts";
import { fixtureSchemaValidator } from "../src/schema-catalog.ts";

const CHECK_MODE = process.argv.slice(2).includes("--check");
const ZERO_DIGEST = `sha256:${"0".repeat(64)}` as const;
const REVIEWED_AT = "2026-07-29T08:55:00Z";

interface ProfileSeed {
  readonly roleFamily: RoleFamily;
  readonly careerStage: CareerStage;
  readonly targetRole: string;
  readonly skills: readonly [string, string, string];
  readonly careerStart: string;
  readonly educationPath: SyntheticProfile["education_path"];
  readonly sponsorship: boolean;
  readonly relocation: SyntheticProfile["constraints"]["relocation"];
  readonly coverageTags: readonly string[];
}

const PROFILE_SEEDS: readonly ProfileSeed[] = [
  {
    roleFamily: "SOFTWARE",
    careerStage: "MID",
    targetRole: "Software Engineer",
    skills: ["TypeScript", "Node.js", "API Design"],
    careerStart: "2017-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["BASELINE_DIRECT_SUPPORT"],
  },
  {
    roleFamily: "SOFTWARE",
    careerStage: "SENIOR",
    targetRole: "Senior Platform Engineer",
    skills: ["Distributed Systems", "Node.js", "Cloud Architecture"],
    careerStart: "2012-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["SENIOR_STAGE"],
  },
  {
    roleFamily: "DATA",
    careerStage: "MID",
    targetRole: "Analytics Engineer",
    skills: ["SQL", "Data Modeling", "Python"],
    careerStart: "2018-01-01",
    educationPath: "SELF_DIRECTED",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["CAREER_SWITCHER", "NONTRADITIONAL_EDUCATION"],
  },
  {
    roleFamily: "DATA",
    careerStage: "SENIOR",
    targetRole: "Senior Data Scientist",
    skills: ["Experiment Design", "Machine Learning", "Statistical Analysis"],
    careerStart: "2014-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["EMPLOYMENT_GAP"],
  },
  {
    roleFamily: "BUSINESS",
    careerStage: "MID",
    targetRole: "Business Analyst",
    skills: [
      "Process Mapping",
      "Stakeholder Analysis",
      "Requirements Analysis",
    ],
    careerStart: "2019-01-01",
    educationPath: "BOOTCAMP",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["NONTRADITIONAL_EDUCATION"],
  },
  {
    roleFamily: "OPERATIONS",
    careerStage: "EARLY",
    targetRole: "Operations Coordinator",
    skills: ["Scheduling", "Inventory Control", "Process Improvement"],
    careerStart: "2022-01-01",
    educationPath: "CERTIFICATE",
    sponsorship: false,
    relocation: "REGION_ONLY",
    coverageTags: ["RELOCATION_CONSTRAINT"],
  },
  {
    roleFamily: "HEALTHCARE",
    careerStage: "MID",
    targetRole: "Healthcare Operations Analyst",
    skills: ["Clinical Operations", "Quality Reporting", "Data Privacy"],
    careerStart: "2017-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["LICENSE_CONSTRAINT"],
  },
  {
    roleFamily: "EDUCATION",
    careerStage: "EARLY",
    targetRole: "Learning Program Coordinator",
    skills: ["Curriculum Design", "Facilitation", "Learning Analytics"],
    careerStart: "2021-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: true,
    relocation: "OPEN",
    coverageTags: ["REQUIRES_SPONSORSHIP"],
  },
  {
    roleFamily: "SALES",
    careerStage: "MID",
    targetRole: "Sales Operations Specialist",
    skills: ["Pipeline Analysis", "CRM Administration", "Forecasting"],
    careerStart: "2018-01-01",
    educationPath: "CERTIFICATE",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["SENSITIVE_NEVER_AUTOFILL"],
  },
  {
    roleFamily: "FINANCE",
    careerStage: "SENIOR",
    targetRole: "Senior Financial Analyst",
    skills: ["Financial Modeling", "Variance Analysis", "Risk Reporting"],
    careerStart: "2013-01-01",
    educationPath: "TRADITIONAL_DEGREE",
    sponsorship: false,
    relocation: "REMOTE_ONLY",
    coverageTags: ["EXPLICIT_CONTRADICTION", "RELOCATION_CONSTRAINT"],
  },
  {
    roleFamily: "ENTRY_LEVEL",
    careerStage: "EARLY",
    targetRole: "Junior Project Coordinator",
    skills: ["Documentation", "Task Tracking", "Team Communication"],
    careerStart: "2023-01-01",
    educationPath: "BOOTCAMP",
    sponsorship: false,
    relocation: "OPEN",
    coverageTags: ["TWO_PAGE_RESUME", "NONTRADITIONAL_EDUCATION"],
  },
  {
    roleFamily: "ENTRY_LEVEL",
    careerStage: "EARLY",
    targetRole: "Entry Level Support Analyst",
    skills: ["Issue Triage", "Knowledge Management", "Customer Support"],
    careerStart: "2024-01-01",
    educationPath: "SELF_DIRECTED",
    sponsorship: false,
    relocation: "REGION_ONLY",
    coverageTags: ["STRONGEST_OUTCOME_ABSTENTION", "NONTRADITIONAL_EDUCATION"],
  },
] as const;

function twoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function stableId(prefix: string, value: number): string {
  return `${prefix}_${value.toString().padStart(26, "0")}`;
}

function metadata(): FixtureMetadata {
  return {
    author: "m02w01-lead-author",
    reviewer: "m02w01-fixture-reviewer",
    reviewed_at: REVIEWED_AT,
    expected_result_provenance: "M02W01_INDEPENDENT_SYNTHETIC_REVIEW",
    synthetic_data: true,
    redaction_state: "SYNTHETIC_RESERVED",
    historical_content_hash: ZERO_DIGEST,
  };
}

function skillKey(skill: string): string {
  return `skill:${skill.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}`;
}

function requiredSkill(profile: SyntheticProfile, index: number): string {
  const skill = profile.skills[index];
  if (skill === undefined) {
    throw new Error("profile seed lacks a required skill");
  }
  return skill;
}

function yearOf(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10);
}

function seal<T extends FixtureEntity>(entity: T): T {
  entity.metadata.historical_content_hash = fixtureEntityHash(entity);
  return entity;
}

function addRelation(
  evidence: EvidenceArtifact,
  requirementRef: string,
  relation: EvidenceRelation,
): void {
  if (
    evidence.requirement_relations.some(
      (item) => item.requirement_ref === requirementRef,
    )
  ) {
    throw new Error("generator attempted a duplicate evidence relation");
  }
  evidence.requirement_relations.push({
    requirement_ref: requirementRef,
    relation,
  });
}

function makeProfiles(): SyntheticProfile[] {
  return PROFILE_SEEDS.map((seed, index) => {
    const number = index + 1;
    const suffix = twoDigits(number);
    return {
      id: stableId("profile", number),
      entity_type: "SYNTHETIC_PROFILE",
      schema_ref: SCHEMA_REFS.SYNTHETIC_PROFILE,
      schema_version: FIXTURE_SCHEMA_VERSION,
      metadata: metadata(),
      role_family: seed.roleFamily,
      career_stage: seed.careerStage,
      target_role: seed.targetRole,
      contact: {
        full_name: `Synthetic Candidate ${suffix}`,
        email: `candidate${suffix}@example.test`,
        phone: `+1-202-555-01${suffix}`,
        website: `https://candidate${suffix}.example.test/profile`,
        address: {
          line1: `${String(100 + number)} Fixture Way`,
          city: "Exampleville",
          region: "MI",
          postal_code: "00000",
          country: "US",
          synthetic_marker: "FIXTURE_ONLY",
        },
      },
      skills: [...seed.skills],
      career_start: seed.careerStart,
      education_path: seed.educationPath,
      work_authorization: {
        country: "US",
        status: seed.sponsorship ? "REQUIRES_SPONSORSHIP" : "AUTHORIZED",
        sponsorship_required: seed.sponsorship,
      },
      constraints: {
        relocation: seed.relocation,
        region: "Exampleville Region",
      },
      coverage_tags: [...seed.coverageTags].sort(),
    };
  });
}

function makeEvidence(
  profiles: readonly SyntheticProfile[],
): EvidenceArtifact[] {
  const evidence: EvidenceArtifact[] = [];
  for (const [index, profile] of profiles.entries()) {
    const number = index + 1;
    const suffix = twoDigits(number);
    const startYear = yearOf(profile.career_start);
    const primaryExperienceYears =
      profile.career_stage === "SENIOR"
        ? 7
        : profile.career_stage === "MID"
          ? 3
          : 1;
    const firstEndYear = startYear + primaryExperienceYears;
    const secondStart = profile.coverage_tags.includes("EMPLOYMENT_GAP")
      ? `${String(firstEndYear + 2)}-01-01`
      : `${String(firstEndYear)}-07-01`;
    const records: readonly {
      category: EvidenceCategory;
      organization: string;
      statement: string;
      factKeys: string[];
      start: string;
      end: string;
      approval: EvidenceArtifact["assertion_approval"];
      fieldRecords: EvidenceArtifact["field_records"];
    }[] = [
      {
        category: "EMPLOYMENT_RECORD",
        organization: `Synthetic Employer ${suffix}-A`,
        statement:
          number === 3
            ? `Synthetic Candidate ${suffix} transitioned from operations process work into data analytics and applied ${requiredSkill(profile, 0)} at Synthetic Employer ${suffix}-A.`
            : `Synthetic Candidate ${suffix} applied ${requiredSkill(profile, 0)} to deliver reviewed work at Synthetic Employer ${suffix}-A.`,
        factKeys: [
          skillKey(requiredSkill(profile, 0)),
          "experience:primary",
          ...(number === 3
            ? ["career:prior-non-data-role", "career:transition"]
            : []),
        ],
        start: profile.career_start,
        end: `${String(firstEndYear)}-06-30`,
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      },
      {
        category: "EMPLOYMENT_RECORD",
        organization: `Synthetic Employer ${suffix}-B`,
        statement: `Synthetic Candidate ${suffix} used ${requiredSkill(profile, 1)} in a separately reviewed role at Synthetic Employer ${suffix}-B.`,
        factKeys: [skillKey(requiredSkill(profile, 1)), "experience:secondary"],
        start: secondStart,
        end: "2026-06-30",
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      },
      {
        category: "EDUCATION_RECORD",
        organization: `Synthetic Institute ${suffix}`,
        statement: `Synthetic Candidate ${suffix} completed a synthetic ${profile.education_path.toLowerCase().replaceAll("_", " ")} program at Synthetic Institute ${suffix}.`,
        factKeys: ["education:completed"],
        start: `${String(startYear - 4)}-01-01`,
        end: `${String(startYear - 1)}-06-30`,
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      },
      {
        category: "PROJECT_RECORD",
        organization: `Synthetic Project ${suffix}`,
        statement: `Synthetic Candidate ${suffix} demonstrated ${requiredSkill(profile, 2)} in Synthetic Project ${suffix}.`,
        factKeys: [skillKey(requiredSkill(profile, 2)), "project:reviewed"],
        start: `${String(Math.max(startYear, 2020))}-02-01`,
        end: `${String(Math.max(startYear, 2020))}-11-30`,
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      },
      {
        category: "CREDENTIAL_RECORD",
        organization: `Synthetic Institute ${suffix}-C`,
        statement:
          number === 7
            ? `Synthetic Candidate ${suffix} holds Synthetic Healthcare Operations License 07 after a reviewed assessment.`
            : `Synthetic Candidate ${suffix} earned Synthetic Credential ${suffix} after a reviewed assessment.`,
        factKeys: [
          "credential:synthetic-foundation",
          ...(number === 7 ? ["license:healthcare-operations"] : []),
        ],
        start: `${String(Math.max(startYear, 2020))}-01-01`,
        end: `${String(Math.max(startYear, 2020))}-12-31`,
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      },
      {
        category: "USER_ASSERTION",
        organization: `Synthetic Candidate Record ${suffix}`,
        statement: `Synthetic Candidate ${suffix} recorded four independently reviewed field decisions.`,
        factKeys: [
          "assertion:approved",
          "field:demographic_disclosure",
          "field:relocation_preference",
          "field:salary_expectation",
          "field:work_authorization",
        ],
        start: "2026-07-29",
        end: "2026-07-29",
        approval: "USER_APPROVED",
        fieldRecords: [
          {
            field_concept: "WORK_AUTHORIZATION",
            recorded_value: profile.work_authorization.status,
            disclosure_text: `Synthetic Candidate ${suffix} explicitly approved work authorization value ${profile.work_authorization.status}.`,
          },
          {
            field_concept: "RELOCATION_PREFERENCE",
            recorded_value: profile.constraints.relocation,
            disclosure_text: `Synthetic Candidate ${suffix} explicitly approved relocation preference ${profile.constraints.relocation}.`,
          },
          {
            field_concept: "SALARY_EXPECTATION",
            recorded_value: `FIXTURE_COMPENSATION_BAND_${suffix}`,
            disclosure_text: `Synthetic Candidate ${suffix} explicitly recorded synthetic compensation band ${suffix}.`,
          },
          {
            field_concept: "DEMOGRAPHIC_DISCLOSURE",
            disclosure_text: `Synthetic Candidate ${suffix} chose not to provide a demographic disclosure value.`,
          },
        ],
      },
    ];
    for (const [recordIndex, record] of records.entries()) {
      evidence.push({
        id: stableId("evidence", index * 6 + recordIndex + 1),
        entity_type: "EVIDENCE_ARTIFACT",
        schema_ref: SCHEMA_REFS.EVIDENCE_ARTIFACT,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        profile_ref: profile.id,
        category: record.category,
        organization: record.organization,
        statement: record.statement,
        fact_keys: [...record.factKeys].sort(),
        effective_period: { start: record.start, end: record.end },
        assertion_approval: record.approval,
        field_records: record.fieldRecords,
        requirement_relations: [],
      });
    }
  }
  return evidence;
}

function makeResumes(
  profiles: readonly SyntheticProfile[],
  evidence: readonly EvidenceArtifact[],
): SourceResume[] {
  return profiles.map((profile, index) => {
    const profileEvidence = evidence.filter(
      (artifact) => artifact.profile_ref === profile.id,
    );
    return {
      id: stableId("resume", index + 1),
      entity_type: "SOURCE_RESUME",
      schema_ref: SCHEMA_REFS.SOURCE_RESUME,
      schema_version: FIXTURE_SCHEMA_VERSION,
      metadata: metadata(),
      profile_ref: profile.id,
      as_of: "2026-07-29",
      page_count: profile.coverage_tags.includes("TWO_PAGE_RESUME") ? 2 : 1,
      facts: profileEvidence.slice(0, 5).map((artifact, factIndex) => ({
        fact_id: stableId("resumefact", index * 5 + factIndex + 1),
        page:
          profile.coverage_tags.includes("TWO_PAGE_RESUME") && factIndex >= 3
            ? 2
            : 1,
        text: artifact.statement,
        fact_keys: [...artifact.fact_keys],
        evidence_refs: [artifact.id],
      })),
    };
  });
}

function makeJobsAndRequirements(profiles: readonly SyntheticProfile[]): {
  jobs: SyntheticJob[];
  requirements: ExpectedRequirement[];
} {
  const jobs: SyntheticJob[] = [];
  const requirements: ExpectedRequirement[] = [];
  const modes: readonly WorkMode[] = ["REMOTE", "HYBRID", "ON_SITE"];
  for (const [profileIndex, profile] of profiles.entries()) {
    for (let localJob = 0; localJob < 2; localJob += 1) {
      const jobNumber = profileIndex * 2 + localJob + 1;
      const suffix = twoDigits(jobNumber);
      const workMode =
        jobNumber === 19
          ? "ON_SITE"
          : jobNumber === 20
            ? "REMOTE"
            : jobNumber === 21
              ? "HYBRID"
              : (modes[(jobNumber - 1) % modes.length] ?? "REMOTE");
      const minimumExperienceYears =
        localJob === 1
          ? profile.career_stage === "EARLY"
            ? 1
            : 3
          : profile.career_stage === "SENIOR"
            ? 7
            : profile.career_stage === "MID"
              ? 3
              : 1;
      const eligibility: SyntheticJob["eligibility_constraint"] =
        jobNumber === 14
          ? "LICENSE_REQUIRED"
          : jobNumber === 15
            ? "NO_SPONSORSHIP"
            : "NONE";
      const secondText =
        eligibility === "LICENSE_REQUIRED"
          ? "Applicants must hold Synthetic Healthcare Operations License 07."
          : eligibility === "NO_SPONSORSHIP"
            ? "Applicants must already be authorized to work in the United States without sponsorship."
            : jobNumber === 19
              ? "Applicants must be available for regular on-site work in Exampleville, MI."
              : `Applicants must confirm an explicit reviewed relocation preference compatible with ${workMode.toLowerCase().replaceAll("_", " ")} work.`;
      const blockTexts = [
        `Must demonstrate at least ${String(minimumExperienceYears)} ${minimumExperienceYears === 1 ? "year" : "years"} of reviewed experience using ${requiredSkill(profile, localJob)}.`,
        secondText,
        `Preferred: hold Synthetic Advanced Credential ${suffix}; keyword overlap alone is insufficient.`,
      ];
      const sourceBlocks = blockTexts.map((text, blockIndex) => ({
        anchor_id: `job-${suffix}.requirements.${twoDigits(blockIndex + 1)}`,
        declared_importance:
          blockIndex === 2 ? ("PREFERRED" as const) : ("MUST_HAVE" as const),
        text,
        text_sha256: sha256Bytes(text),
      }));
      const job: SyntheticJob = {
        id: stableId("job", jobNumber),
        entity_type: "SYNTHETIC_JOB",
        schema_ref: SCHEMA_REFS.SYNTHETIC_JOB,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        role_family: profile.role_family,
        title: `${localJob === 0 ? "Primary" : "Alternate"} ${profile.target_role}`,
        employer: `Synthetic Employer ${suffix}-J`,
        work_mode: workMode,
        location:
          workMode === "REMOTE" ? "Remote - United States" : "Exampleville, MI",
        minimum_experience_years: minimumExperienceYears,
        eligibility_constraint: eligibility,
        source_blocks: sourceBlocks,
      };
      jobs.push(job);
      const kinds: readonly ExpectedRequirement["requirement_kind"][] = [
        "EXPERIENCE",
        eligibility === "LICENSE_REQUIRED"
          ? "CERTIFICATION"
          : eligibility === "NO_SPONSORSHIP"
            ? "ELIGIBILITY"
            : "LOCATION",
        "CERTIFICATION",
      ];
      sourceBlocks.forEach((block, blockIndex) => {
        const requirementNumber = (jobNumber - 1) * 3 + blockIndex + 1;
        requirements.push({
          id: stableId("requirement", requirementNumber),
          entity_type: "EXPECTED_REQUIREMENT",
          schema_ref: SCHEMA_REFS.EXPECTED_REQUIREMENT,
          schema_version: FIXTURE_SCHEMA_VERSION,
          metadata: metadata(),
          job_ref: job.id,
          importance: block.declared_importance,
          requirement_kind: kinds[blockIndex] ?? "SKILL",
          normalized_text: block.text,
          source_anchor_id: block.anchor_id,
          source_text_sha256: block.text_sha256,
          requirement_tag:
            blockIndex === 0
              ? skillKey(requiredSkill(profile, localJob))
              : blockIndex === 1
                ? eligibility === "LICENSE_REQUIRED"
                  ? "license:healthcare-operations"
                  : eligibility === "NO_SPONSORSHIP"
                    ? "field:work_authorization"
                    : "field:relocation_preference"
                : `credential:synthetic-advanced-${suffix}`,
          keyword_trap: blockIndex === 2,
          related_evidence_trap: blockIndex === 0,
        });
      });
    }
  }
  return { jobs, requirements };
}

function makeGap(
  idNumber: number,
  scenarioRef: string,
  profileRef: string,
  requirementRef: string,
  classification: GapClassification,
  relatedEvidence: readonly string[],
  rationale: string,
): UnsupportedGap {
  return {
    id: stableId("gap", idNumber),
    entity_type: "UNSUPPORTED_GAP",
    schema_ref: SCHEMA_REFS.UNSUPPORTED_GAP,
    schema_version: FIXTURE_SCHEMA_VERSION,
    metadata: metadata(),
    scenario_ref: scenarioRef,
    profile_ref: profileRef,
    requirement_ref: requirementRef,
    classification,
    supporting_evidence_refs: [],
    related_or_contradicting_evidence_refs: [...relatedEvidence],
    expected_action: "ABSTAIN",
    reason_code:
      classification === "CONTRADICTED"
        ? "CONTRADICTED_BY_EXPLICIT_RECORD"
        : classification === "PARTIAL"
          ? "INSUFFICIENT_DIRECT_EVIDENCE"
          : "NO_SUPPORTING_EVIDENCE",
    support_review_rationale: rationale,
  };
}

interface CrossScenarioDesign {
  readonly jobIndex: number;
  readonly classification: "PARTIAL" | "STRONG_RELATED" | "UNSUPPORTED";
  readonly evidenceOffset?: 0 | 1 | 3;
  readonly rationale: string;
}

const CROSS_SCENARIO_DESIGNS: readonly CrossScenarioDesign[] = [
  {
    jobIndex: 5,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "API design is relevant to data modeling work, but it does not directly prove the required data-modeling experience.",
  },
  {
    jobIndex: 0,
    classification: "STRONG_RELATED",
    evidenceOffset: 1,
    rationale:
      "Reviewed Node.js platform work is strongly related to TypeScript software work without being an exact TypeScript record.",
  },
  {
    jobIndex: 7,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Reviewed Python project work is relevant to machine-learning implementation, but its duration is insufficient for the anchored three-year experience requirement.",
  },
  {
    jobIndex: 4,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Statistical analysis is relevant to SQL-based data work but does not directly prove reviewed SQL experience.",
  },
  {
    jobIndex: 10,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Requirements analysis is relevant to scheduling operations, but the evidence does not directly establish scheduling experience.",
  },
  {
    jobIndex: 8,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Process-improvement work is relevant to process mapping, but its duration is insufficient for the anchored three-year experience requirement.",
  },
  {
    jobIndex: 6,
    classification: "PARTIAL",
    evidenceOffset: 1,
    rationale:
      "Quality reporting contributes to experiment design, but it is insufficient to prove direct experiment-design experience.",
  },
  {
    jobIndex: 4,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Learning analytics is relevant to SQL analysis but does not directly establish reviewed SQL experience.",
  },
  {
    jobIndex: 18,
    classification: "PARTIAL",
    evidenceOffset: 3,
    rationale:
      "Forecasting work is relevant to financial modeling, but its duration is insufficient for the anchored seven-year experience requirement.",
  },
  {
    jobIndex: 0,
    classification: "UNSUPPORTED",
    rationale:
      "Financial-analysis evidence does not support the TypeScript experience requirement, so the expected action is abstention.",
  },
  {
    jobIndex: 10,
    classification: "STRONG_RELATED",
    evidenceOffset: 1,
    rationale:
      "Task-tracking work is strongly related to operational scheduling while remaining distinct from direct scheduling evidence.",
  },
  {
    jobIndex: 13,
    classification: "UNSUPPORTED",
    rationale:
      "The entry-level support profile has no healthcare license or related experience evidence for this cross-role job.",
  },
] as const;

function fieldRecordForRequirement(
  artifact: EvidenceArtifact,
  requirement: ExpectedRequirement,
): EvidenceArtifact["field_records"][number] | undefined {
  const concept = requirement.requirement_tag
    .slice("field:".length)
    .toUpperCase();
  return artifact.field_records.find(
    (record) => record.field_concept === concept,
  );
}

function policyAllowsRelease(policy: FieldValuePolicy): boolean {
  if (policy.policy === "FILL_FROM_EXPLICIT_RECORD") {
    return true;
  }
  return (
    policy.policy === "CONFIRM_IF_RECORD_EXPIRED" &&
    policy.record_expires_on !== undefined &&
    policy.record_expires_on >= REVIEWED_AT.slice(0, 10)
  );
}

function actionForPolicy(
  policy: FieldValuePolicy,
): ScenarioBundle["evaluations"][number]["expected_action"] {
  if (policyAllowsRelease(policy)) {
    return "USE_SUPPORTED_EVIDENCE";
  }
  return policy.policy === "BLOCK_AND_EXPLAIN"
    ? "BLOCK_AND_EXPLAIN"
    : "REQUIRE_CONFIRMATION";
}

function makeScenariosAndResults(
  profiles: readonly SyntheticProfile[],
  resumes: readonly SourceResume[],
  jobs: readonly SyntheticJob[],
  requirements: readonly ExpectedRequirement[],
  evidence: EvidenceArtifact[],
  policies: readonly FieldValuePolicy[],
): {
  scenarios: ScenarioBundle[];
  claims: ExpectedSupportedClaim[];
  gaps: UnsupportedGap[];
} {
  const scenarios: ScenarioBundle[] = [];
  const claims: ExpectedSupportedClaim[] = [];
  const gaps: UnsupportedGap[] = [];
  let claimNumber = 0;
  let gapNumber = 0;
  for (const [profileIndex, profile] of profiles.entries()) {
    const ownJobIndexes = [profileIndex * 2, profileIndex * 2 + 1];
    const crossDesign = CROSS_SCENARIO_DESIGNS[profileIndex];
    if (crossDesign === undefined) {
      throw new Error("generator cross-scenario design missing");
    }
    const crossJobIndex = crossDesign.jobIndex;
    const scenarioJobIndexes = [...ownJobIndexes, crossJobIndex];
    for (const [localScenario, jobIndex] of scenarioJobIndexes.entries()) {
      const scenarioNumber = profileIndex * 3 + localScenario + 1;
      const scenarioId = stableId("scenario", scenarioNumber);
      const job = jobs[jobIndex];
      const resume = resumes[profileIndex];
      if (job === undefined || resume === undefined) {
        throw new Error("generator scenario input missing");
      }
      const jobRequirements = requirements
        .filter((requirement) => requirement.job_ref === job.id)
        .sort((left, right) => left.id.localeCompare(right.id));
      if (jobRequirements.length !== 3) {
        throw new Error("generator requires exactly three job requirements");
      }
      const profileEvidence = evidence.filter(
        (artifact) => artifact.profile_ref === profile.id,
      );
      const assertionEvidence = profileEvidence.find(
        (artifact) => artifact.category === "USER_ASSERTION",
      );
      if (assertionEvidence === undefined) {
        throw new Error("generator evidence input missing");
      }
      const evaluations: ScenarioBundle["evaluations"] = [];
      for (const [requirementIndex, requirement] of jobRequirements.entries()) {
        let classification: SupportedClassification | GapClassification;
        let selectedEvidence: EvidenceArtifact | undefined;
        if (localScenario < 2) {
          if (requirementIndex === 0) {
            classification = "DIRECT";
            selectedEvidence = profileEvidence.find(
              (artifact) =>
                artifact.category === "EMPLOYMENT_RECORD" &&
                artifact.fact_keys.includes(requirement.requirement_tag),
            );
          } else if (requirementIndex === 1) {
            if (job.eligibility_constraint === "LICENSE_REQUIRED") {
              selectedEvidence = profileEvidence.find((artifact) =>
                artifact.fact_keys.includes(requirement.requirement_tag),
              );
              classification =
                selectedEvidence === undefined ? "UNSUPPORTED" : "DIRECT";
            } else {
              selectedEvidence = assertionEvidence;
              const sponsorshipConflict =
                job.eligibility_constraint === "NO_SPONSORSHIP" &&
                profile.work_authorization.sponsorship_required;
              const relocationConflict =
                job.eligibility_constraint === "NONE" &&
                job.work_mode !== "REMOTE" &&
                profile.constraints.relocation === "REMOTE_ONLY";
              classification =
                sponsorshipConflict || relocationConflict
                  ? "CONTRADICTED"
                  : "USER_ASSERTED";
            }
          } else {
            classification = "UNSUPPORTED";
          }
        } else if (requirementIndex === 0) {
          classification = crossDesign.classification;
          selectedEvidence =
            crossDesign.evidenceOffset === undefined
              ? undefined
              : profileEvidence[crossDesign.evidenceOffset];
        } else if (requirementIndex === 1) {
          if (job.eligibility_constraint === "LICENSE_REQUIRED") {
            selectedEvidence = profileEvidence.find((artifact) =>
              artifact.fact_keys.includes(requirement.requirement_tag),
            );
            classification =
              selectedEvidence === undefined ? "UNSUPPORTED" : "DIRECT";
          } else {
            selectedEvidence = assertionEvidence;
            const sponsorshipConflict =
              job.eligibility_constraint === "NO_SPONSORSHIP" &&
              profile.work_authorization.sponsorship_required;
            const relocationConflict =
              job.eligibility_constraint === "NONE" &&
              job.work_mode !== "REMOTE" &&
              profile.constraints.relocation === "REMOTE_ONLY";
            classification =
              sponsorshipConflict || relocationConflict
                ? "CONTRADICTED"
                : "USER_ASSERTED";
          }
        } else {
          classification = "UNSUPPORTED";
        }

        if (
          classification === "DIRECT" ||
          classification === "STRONG_RELATED" ||
          classification === "USER_ASSERTED"
        ) {
          if (selectedEvidence === undefined) {
            throw new Error("supported result lacks generator evidence");
          }
          addRelation(selectedEvidence, requirement.id, classification);
          const fieldRecord =
            classification === "USER_ASSERTED"
              ? fieldRecordForRequirement(selectedEvidence, requirement)
              : undefined;
          if (classification === "USER_ASSERTED" && fieldRecord === undefined) {
            throw new Error("user-asserted claim lacks an atomic field record");
          }
          const fieldPolicy =
            fieldRecord === undefined
              ? undefined
              : policies.find(
                  (policy) =>
                    policy.profile_ref === profile.id &&
                    policy.field_concept === fieldRecord.field_concept,
                );
          if (classification === "USER_ASSERTED" && fieldPolicy === undefined) {
            throw new Error("user-asserted claim lacks a field policy");
          }
          const releaseEligible =
            fieldPolicy === undefined || policyAllowsRelease(fieldPolicy);
          const expectedAction =
            fieldPolicy === undefined
              ? "USE_SUPPORTED_EVIDENCE"
              : actionForPolicy(fieldPolicy);
          claimNumber += 1;
          const claim: ExpectedSupportedClaim = {
            id: stableId("claim", claimNumber),
            entity_type: "EXPECTED_SUPPORTED_CLAIM",
            schema_ref: SCHEMA_REFS.EXPECTED_SUPPORTED_CLAIM,
            schema_version: FIXTURE_SCHEMA_VERSION,
            metadata: metadata(),
            scenario_ref: scenarioId,
            profile_ref: profile.id,
            requirement_ref: requirement.id,
            support_classification: classification,
            claim_text:
              fieldRecord?.disclosure_text ?? selectedEvidence.statement,
            evidence_refs: [selectedEvidence.id],
            ...(fieldPolicy === undefined
              ? {}
              : { field_policy_ref: fieldPolicy.id }),
            release_eligible: releaseEligible,
            canonical_evidence_mutation: false,
            support_review_rationale:
              classification === "DIRECT"
                ? "The reviewed evidence carries the exact normalized requirement tag and directly supports the anchored requirement."
                : classification === "USER_ASSERTED"
                  ? "An atomic, explicitly approved field record matches the anchored field concept without releasing unrelated values."
                  : crossDesign.rationale,
          };
          claims.push(claim);
          evaluations.push({
            requirement_ref: requirement.id,
            classification,
            result_type: "SUPPORTED_CLAIM",
            result_ref: claim.id,
            expected_action: expectedAction,
          });
        } else {
          if (
            classification !== "UNSUPPORTED" &&
            selectedEvidence === undefined
          ) {
            throw new Error("related gap lacks generator evidence");
          }
          if (selectedEvidence !== undefined) {
            addRelation(
              selectedEvidence,
              requirement.id,
              classification === "PARTIAL" ? "PARTIAL" : "CONTRADICTS",
            );
          }
          gapNumber += 1;
          const gap = makeGap(
            gapNumber,
            scenarioId,
            profile.id,
            requirement.id,
            classification,
            selectedEvidence === undefined ? [] : [selectedEvidence.id],
            classification === "PARTIAL"
              ? crossDesign.rationale
              : classification === "CONTRADICTED"
                ? "An explicit approved field record conflicts with the anchored job constraint, so the scenario must block or abstain."
                : requirementIndex === 0 && localScenario === 2
                  ? crossDesign.rationale
                  : "No reviewed evidence supports the anchored requirement, so the expected action is abstention.",
          );
          gaps.push(gap);
          evaluations.push({
            requirement_ref: requirement.id,
            classification,
            result_type: "UNSUPPORTED_GAP",
            result_ref: gap.id,
            expected_action: "ABSTAIN",
          });
        }
      }
      const blockedByEligibility = evaluations.some(
        (evaluation) => evaluation.classification === "CONTRADICTED",
      );
      const blockedByFieldPolicy = evaluations.some(
        (evaluation) => evaluation.expected_action === "BLOCK_AND_EXPLAIN",
      );
      const requiresConfirmation = evaluations.some(
        (evaluation) => evaluation.expected_action === "REQUIRE_CONFIRMATION",
      );
      scenarios.push({
        id: scenarioId,
        entity_type: "SCENARIO_BUNDLE",
        schema_ref: SCHEMA_REFS.SCENARIO_BUNDLE,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        profile_ref: profile.id,
        resume_ref: resume.id,
        job_ref: job.id,
        expected_outcome: blockedByEligibility
          ? "BLOCK_INELIGIBLE"
          : blockedByFieldPolicy
            ? "BLOCK_FIELD_POLICY"
            : evaluations.every(
                  (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
                )
              ? "ABSTAIN"
              : requiresConfirmation
                ? "REQUIRE_CONFIRMATION"
                : "PROCEED_WITH_GAPS",
        evaluations,
        coverage_tags: [
          "COMPLETE_REQUIREMENT_EVALUATION",
          localScenario === 2 ? "CROSS_ROLE_EVIDENCE_TRAP" : "OWN_ROLE",
          ...(blockedByEligibility ? ["INELIGIBLE_DESPITE_SKILL_MATCH"] : []),
          ...(blockedByFieldPolicy ? ["FIELD_POLICY_BLOCK"] : []),
          ...(requiresConfirmation ? ["FIELD_CONFIRMATION_REQUIRED"] : []),
        ].sort(),
      });
    }
  }
  return { scenarios, claims, gaps };
}

function policyValue(
  profile: SyntheticProfile,
  concept: FieldValuePolicy["field_concept"],
  suffix: string,
): string {
  if (concept === "WORK_AUTHORIZATION") {
    return profile.work_authorization.status;
  }
  if (concept === "RELOCATION_PREFERENCE") {
    return profile.constraints.relocation;
  }
  return `FIXTURE_COMPENSATION_BAND_${suffix}`;
}

function makeFieldPolicies(
  profiles: readonly SyntheticProfile[],
  evidence: readonly EvidenceArtifact[],
): FieldValuePolicy[] {
  const policies: FieldValuePolicy[] = [];
  for (const [index, profile] of profiles.entries()) {
    const number = index + 1;
    const suffix = twoDigits(number);
    const assertion = evidence.find(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "USER_ASSERTION",
    );
    if (assertion === undefined) {
      throw new Error("generator policy source missing");
    }
    const variants: readonly {
      concept: FieldValuePolicy["field_concept"];
      sensitivity: FieldValuePolicy["sensitivity"];
      consequential: boolean;
      policy: FieldValuePolicyKind;
    }[] = [
      {
        concept: "WORK_AUTHORIZATION",
        sensitivity: "PERSONAL",
        consequential: true,
        policy:
          number % 3 === 1
            ? "FILL_FROM_EXPLICIT_RECORD"
            : number % 3 === 2
              ? "CONFIRM_ONCE_PER_JOB"
              : "BLOCK_AND_EXPLAIN",
      },
      {
        concept: "RELOCATION_PREFERENCE",
        sensitivity: "PERSONAL",
        consequential: true,
        policy:
          number % 3 === 1
            ? "CONFIRM_ONCE_PER_JOB"
            : number % 3 === 2
              ? "CONFIRM_IF_RECORD_EXPIRED"
              : "FILL_FROM_EXPLICIT_RECORD",
      },
      {
        concept: "SALARY_EXPECTATION",
        sensitivity: "SENSITIVE",
        consequential: true,
        policy: number % 2 === 0 ? "BLOCK_AND_EXPLAIN" : "CONFIRM_ONCE_PER_JOB",
      },
      {
        concept: "DEMOGRAPHIC_DISCLOSURE",
        sensitivity: "SENSITIVE",
        consequential: false,
        policy:
          number % 2 === 1
            ? "NEVER_AUTOFILL"
            : "VOLUNTARY_PREFER_NOT_TO_ANSWER",
      },
    ];
    variants.forEach((variant, variantIndex) => {
      const needsValue =
        variant.policy === "FILL_FROM_EXPLICIT_RECORD" ||
        variant.policy === "CONFIRM_ONCE_PER_JOB" ||
        variant.policy === "CONFIRM_IF_RECORD_EXPIRED";
      policies.push({
        id: stableId("policy", index * 4 + variantIndex + 1),
        entity_type: "FIELD_VALUE_POLICY",
        schema_ref: SCHEMA_REFS.FIELD_VALUE_POLICY,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        profile_ref: profile.id,
        field_concept: variant.concept,
        sensitivity: variant.sensitivity,
        consequential: variant.consequential,
        policy: variant.policy,
        source_evidence_ref: assertion.id,
        ...(needsValue
          ? {
              recorded_value: policyValue(profile, variant.concept, suffix),
            }
          : {}),
        ...(variant.policy === "CONFIRM_IF_RECORD_EXPIRED"
          ? { record_expires_on: "2027-07-29" }
          : {}),
        explanation_code: `FIXTURE_${variant.policy}`,
      });
    });
  }
  return policies;
}

async function serialize(value: unknown): Promise<Buffer> {
  const formatted = await format(JSON.stringify(value), {
    parser: "json",
    endOfLine: "lf",
  });
  return Buffer.from(formatted, "utf8");
}

function validateEntities(entities: readonly FixtureEntity[]): void {
  const validator = fixtureSchemaValidator();
  for (const entity of entities) {
    const result = validator.validateInstance(entity.schema_ref, entity);
    if (!result.valid) {
      throw new Error(
        `generated ${entity.entity_type} ${entity.id} failed schema: ${result.errors.join("; ")}`,
      );
    }
  }
}

function writeOrCheck(path: string, bytes: Buffer): void {
  if (CHECK_MODE) {
    let committed: Buffer;
    try {
      committed = readFileSync(path);
    } catch {
      throw new Error(`seed drift: expected committed file ${basename(path)}`);
    }
    if (!committed.equals(bytes)) {
      throw new Error(
        `seed drift: ${basename(path)} differs from deterministic output`,
      );
    }
  } else {
    writeFileSync(path, bytes);
  }
}

async function main(): Promise<void> {
  const profiles = makeProfiles();
  const evidence = makeEvidence(profiles);
  const resumes = makeResumes(profiles, evidence);
  const { jobs, requirements } = makeJobsAndRequirements(profiles);
  const policies = makeFieldPolicies(profiles, evidence);
  const { scenarios, claims, gaps } = makeScenariosAndResults(
    profiles,
    resumes,
    jobs,
    requirements,
    evidence,
    policies,
  );
  for (const artifact of evidence) {
    artifact.requirement_relations.sort((left, right) =>
      left.requirement_ref.localeCompare(right.requirement_ref),
    );
  }
  const collections = new Map<string, FixtureEntity[]>([
    ["evidence-artifacts.v1.json", evidence],
    ["expected-requirements.v1.json", requirements],
    ["expected-supported-claims.v1.json", claims],
    ["field-value-policies.v1.json", policies],
    ["jobs.v1.json", jobs],
    ["profiles.v1.json", profiles],
    ["scenario-bundles.v1.json", scenarios],
    ["source-resumes.v1.json", resumes],
    ["unsupported-gaps.v1.json", gaps],
  ]);
  const all = [...collections.values()].flat();
  all.forEach((entity) => seal(entity));
  validateEntities(all);
  mkdirSync(COMMITTED_FIXTURE_ROOT, { recursive: true });
  const files: FixtureManifestFile[] = [];
  for (const spec of COLLECTION_SPECS) {
    const items = collections.get(spec.file);
    if (items === undefined) {
      throw new Error(`generator collection missing: ${spec.file}`);
    }
    items.sort((left, right) => left.id.localeCompare(right.id));
    const envelope = fixtureCollection(spec.entityType, spec.schemaRef, items);
    const bytes = await serialize(envelope);
    files.push({
      path: spec.file,
      entity_type: spec.entityType,
      schema_ref: spec.schemaRef,
      schema_version: FIXTURE_SCHEMA_VERSION,
      record_count: items.length,
      byte_count: bytes.length,
      sha256: sha256Bytes(bytes),
    });
    writeOrCheck(join(COMMITTED_FIXTURE_ROOT, spec.file), bytes);
  }
  const evidenceCategoryCounts = {
    CREDENTIAL_RECORD: evidence.filter(
      (item) => item.category === "CREDENTIAL_RECORD",
    ).length,
    EDUCATION_RECORD: evidence.filter(
      (item) => item.category === "EDUCATION_RECORD",
    ).length,
    EMPLOYMENT_RECORD: evidence.filter(
      (item) => item.category === "EMPLOYMENT_RECORD",
    ).length,
    PROJECT_RECORD: evidence.filter(
      (item) => item.category === "PROJECT_RECORD",
    ).length,
    USER_ASSERTION: evidence.filter(
      (item) => item.category === "USER_ASSERTION",
    ).length,
  };
  const roleFamilyCounts = {
    BUSINESS: profiles.filter((item) => item.role_family === "BUSINESS").length,
    DATA: profiles.filter((item) => item.role_family === "DATA").length,
    EDUCATION: profiles.filter((item) => item.role_family === "EDUCATION")
      .length,
    ENTRY_LEVEL: profiles.filter((item) => item.role_family === "ENTRY_LEVEL")
      .length,
    FINANCE: profiles.filter((item) => item.role_family === "FINANCE").length,
    HEALTHCARE: profiles.filter((item) => item.role_family === "HEALTHCARE")
      .length,
    OPERATIONS: profiles.filter((item) => item.role_family === "OPERATIONS")
      .length,
    SALES: profiles.filter((item) => item.role_family === "SALES").length,
    SOFTWARE: profiles.filter((item) => item.role_family === "SOFTWARE").length,
  };
  const manifest: FixtureManifest = {
    id: stableId("manifest", 1),
    schema_ref: SCHEMA_REFS.MANIFEST,
    schema_version: FIXTURE_SCHEMA_VERSION,
    corpus_version: CORPUS_VERSION,
    corpus_state: "DEVELOPMENT_MUTABLE",
    holdout_content_present: false,
    metadata: metadata(),
    files,
    counts: EXPECTED_SEED_COUNTS,
    evidence_category_counts: evidenceCategoryCounts,
    role_family_counts: roleFamilyCounts,
    corpus_digest: sha256Canonical(files),
  };
  manifest.metadata.historical_content_hash = fixtureManifestHash(manifest);
  const manifestValidation = fixtureSchemaValidator().validateInstance(
    SCHEMA_REFS.MANIFEST,
    manifest,
  );
  if (!manifestValidation.valid) {
    throw new Error(
      `generated manifest failed schema: ${manifestValidation.errors.join("; ")}`,
    );
  }
  writeOrCheck(
    join(COMMITTED_FIXTURE_ROOT, "manifest.v1.json"),
    await serialize(manifest),
  );
  const mode = CHECK_MODE ? "verified" : "wrote";
  const profileCount = String(profiles.length);
  const evidenceCount = String(evidence.length);
  const resumeCount = String(resumes.length);
  const jobCount = String(jobs.length);
  const requirementCount = String(requirements.length);
  const scenarioCount = String(scenarios.length);
  const evaluationCount = String(EXPECTED_SEED_COUNTS.scenario_evaluations);
  const claimCount = String(claims.length);
  const gapCount = String(gaps.length);
  const policyCount = String(policies.length);
  console.log(
    `fixture seed ${mode}: ${profileCount} profiles, ${evidenceCount} evidence artifacts, ${resumeCount} resumes, ${jobCount} jobs, ${requirementCount} requirements, ${scenarioCount} scenarios/${evaluationCount} evaluations, ${claimCount} claims, ${gapCount} gaps, ${policyCount} policies`,
  );
}

await main();
