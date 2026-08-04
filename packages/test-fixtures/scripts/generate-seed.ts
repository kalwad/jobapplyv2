import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  fixtureEntityHash,
  fixtureManifestHash,
  sha256Bytes,
  sha256Canonical,
} from "../src/canonical-json.ts";
import { validateFixtureConsistency } from "../src/consistency.ts";
import { safeUnknownErrorMessage } from "../src/diagnostics.ts";
import {
  COLLECTION_SPECS,
  COMMITTED_FIXTURE_ROOT,
  fixtureCollection,
} from "../src/loader.ts";
import {
  CORPUS_VERSION,
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
  type FixtureCorpus,
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
import {
  expectedReviewRationale,
  TWO_PAGE_RESUME_RATIONALE,
} from "../src/review-rationale.ts";
import { fixtureSchemaValidator } from "../src/schema-catalog.ts";
import {
  experienceCoverageDays,
  requiredExperienceDays,
  reviewedExperienceRelation,
  selectExactlyOneEvidence,
  type SemanticEvidenceSelector,
} from "../src/semantic-evidence.ts";
import { credentialStateAt, policyDecisionAt } from "../src/temporal-policy.ts";
import { makeAnswerFixtures, W02_REVIEWED_AT } from "./generate-answer-seed.ts";

const ZERO_DIGEST = `sha256:${"0".repeat(64)}` as const;
const REVIEWED_AT = "2026-07-29T08:55:00Z";

function w02ManifestMetadata(): FixtureMetadata {
  return {
    author: "m02w02-lead-author",
    reviewer: "m02w02-fixture-reviewer",
    reviewed_at: W02_REVIEWED_AT,
    expected_result_provenance: "M02W02_SYNTHETIC_AUTHORING_REVIEW",
    synthetic_data: true,
    redaction_state: "SYNTHETIC_RESERVED",
    historical_content_hash: ZERO_DIGEST,
  };
}

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
    expected_result_provenance: "M02W01_SYNTHETIC_AUTHORING_REVIEW",
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

function required<T>(value: T | undefined, detail: string): T {
  if (value === undefined) {
    throw new Error(detail);
  }
  return value;
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
      work_authorization: seed.sponsorship
        ? {
            country: "US",
            status: "REQUIRES_SPONSORSHIP",
            sponsorship_required: true,
          }
        : {
            country: "US",
            status: "AUTHORIZED",
            sponsorship_required: false,
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
    const topology = Math.floor(index / 3);
    const topologyCounts = [
      { employment: 3, education: 1, project: 0, credential: 1 },
      { employment: 1, education: 0, project: 3, credential: 1 },
      { employment: 1, education: 0, project: 1, credential: 3 },
      { employment: 1, education: 3, project: 1, credential: 0 },
    ] as const;
    const counts = profile.coverage_tags.includes("EMPLOYMENT_GAP")
      ? { employment: 2, education: 0, project: 2, credential: 1 }
      : topologyCounts[topology];
    if (counts === undefined) {
      throw new Error("generator evidence topology missing");
    }
    const records: {
      category: EvidenceCategory;
      organization: string;
      statement: string;
      factKeys: string[];
      start: string;
      end?: string;
      temporalSemantics: EvidenceArtifact["temporal_semantics"];
      educationState?: EvidenceArtifact["education_state"];
      credentialBasis?: EvidenceArtifact["credential_validity_basis"];
      revokedOn?: string;
      approval: EvidenceArtifact["assertion_approval"];
      fieldRecords: EvidenceArtifact["field_records"];
    }[] = [];
    for (
      let recordIndex = 0;
      recordIndex < counts.employment;
      recordIndex += 1
    ) {
      const recordStartYear =
        startYear +
        recordIndex *
          (profile.coverage_tags.includes("EMPLOYMENT_GAP") ? 3 : 2);
      const recordEndYear =
        recordIndex === counts.employment - 1
          ? 2026
          : Math.min(recordStartYear + 1, 2025);
      records.push({
        category: "EMPLOYMENT_RECORD",
        organization: `Synthetic Employer ${suffix}-${String.fromCharCode(65 + recordIndex)}`,
        statement:
          number === 3 && recordIndex === 0
            ? `Synthetic Candidate ${suffix} transitioned from operations process work into data analytics and applied ${requiredSkill(profile, 0)} at Synthetic Employer ${suffix}-A.`
            : `Synthetic Candidate ${suffix} applied ${requiredSkill(profile, 0)} and ${requiredSkill(profile, 1)} in reviewed employment record ${String(recordIndex + 1)}.`,
        factKeys: [
          skillKey(requiredSkill(profile, 0)),
          skillKey(requiredSkill(profile, 1)),
          `experience:employment-${String(recordIndex + 1)}`,
          ...(number === 3 && recordIndex === 0
            ? ["career:prior-non-data-role", "career:transition"]
            : []),
        ],
        start: `${String(recordStartYear)}-01-01`,
        end: `${String(recordEndYear)}-${recordIndex === counts.employment - 1 ? "06-30" : "12-31"}`,
        temporalSemantics: "ACTIVITY_INTERVAL",
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      });
    }
    for (
      let recordIndex = 0;
      recordIndex < counts.education;
      recordIndex += 1
    ) {
      const educationStart = startYear - (counts.education - recordIndex) * 2;
      records.push({
        category: "EDUCATION_RECORD",
        organization: `Synthetic Institute ${suffix}-${String.fromCharCode(65 + recordIndex)}`,
        statement: `Synthetic Candidate ${suffix} completed reviewed synthetic education program ${String(recordIndex + 1)} before beginning the declared career.`,
        factKeys: [
          "education:completed",
          `education:program-${String(recordIndex + 1)}`,
          ...(topology === 0 ? [skillKey(requiredSkill(profile, 2))] : []),
        ],
        start: `${String(educationStart)}-01-01`,
        end: `${String(educationStart + 1)}-06-30`,
        temporalSemantics: "EDUCATION_ATTENDANCE",
        educationState: "COMPLETED",
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      });
    }
    for (let recordIndex = 0; recordIndex < counts.project; recordIndex += 1) {
      const projectYear = Math.max(startYear, 2020) + recordIndex;
      records.push({
        category: "PROJECT_RECORD",
        organization: `Synthetic Project ${suffix}-${String.fromCharCode(65 + recordIndex)}`,
        statement: `Synthetic Candidate ${suffix} demonstrated ${requiredSkill(profile, 2)} in reviewed project ${String(recordIndex + 1)}.`,
        factKeys: [
          skillKey(requiredSkill(profile, 2)),
          `project:reviewed-${String(recordIndex + 1)}`,
        ],
        start: `${String(projectYear)}-02-01`,
        end: `${String(projectYear)}-11-30`,
        temporalSemantics: "ACTIVITY_INTERVAL",
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      });
    }
    for (
      let recordIndex = 0;
      recordIndex < counts.credential;
      recordIndex += 1
    ) {
      const credential: (typeof records)[number] = {
        category: "CREDENTIAL_RECORD",
        organization: `Synthetic Institute ${suffix}-${String.fromCharCode(70 + recordIndex)}`,
        statement: `Synthetic Candidate ${suffix} earned reviewed Synthetic Foundation Credential ${String(recordIndex + 1)}.`,
        factKeys: [
          recordIndex === 0
            ? "credential:synthetic-foundation"
            : `credential:synthetic-specialist-${String(recordIndex + 1)}`,
        ],
        start: `${String(Math.max(startYear, 2020))}-01-01`,
        temporalSemantics: "CREDENTIAL_VALIDITY",
        credentialBasis: "NON_EXPIRING",
        approval: "NOT_APPLICABLE",
        fieldRecords: [],
      };
      if (number === 7 && recordIndex === 1) {
        credential.statement =
          "Synthetic Candidate 07 holds a separate Synthetic Healthcare Quality License valid through 2030.";
        credential.factKeys = ["license:healthcare-quality-current"];
        credential.start = "2024-01-01";
        credential.end = "2030-12-31";
        credential.credentialBasis = "BOUNDED";
      } else if (number === 7 && recordIndex === 2) {
        credential.statement =
          "Synthetic Candidate 07 held Synthetic Healthcare Operations License 07 during 2020; the reviewed record is expired.";
        credential.factKeys = ["license:healthcare-operations"];
        credential.start = "2020-01-01";
        credential.end = "2020-12-31";
        credential.credentialBasis = "BOUNDED";
      } else if (number === 8 && recordIndex === 1) {
        credential.statement =
          "Synthetic Candidate 08 has a reviewed credential whose validity begins in 2027.";
        credential.factKeys = ["credential:not-yet-valid"];
        credential.start = "2027-01-01";
        credential.end = "2030-12-31";
        credential.credentialBasis = "BOUNDED";
      } else if (number === 8 && recordIndex === 2) {
        credential.statement =
          "Synthetic Candidate 08 has a reviewed credential revoked in 2025.";
        credential.factKeys = ["credential:revoked"];
        credential.start = "2020-01-01";
        credential.end = "2030-12-31";
        credential.credentialBasis = "BOUNDED";
        credential.revokedOn = "2025-01-01";
      } else if (number === 9 && recordIndex === 1) {
        credential.statement =
          "Synthetic Candidate 09 has a credential record with unknown current validity.";
        credential.factKeys = ["credential:unknown-validity"];
        credential.start = "2020-01-01";
        credential.credentialBasis = "UNKNOWN";
      } else if (number === 9 && recordIndex === 2) {
        credential.statement =
          "Synthetic Candidate 09 holds a reviewed bounded specialist credential valid through 2030.";
        credential.factKeys = ["credential:current-specialist"];
        credential.start = "2024-01-01";
        credential.end = "2030-12-31";
        credential.credentialBasis = "BOUNDED";
      }
      records.push(credential);
    }
    const assertionRecordBase = index * 5;
    const assertionDate = "2026-07-29";
    const assertionValidThrough = "2027-07-29";
    records.push({
      category: "USER_ASSERTION",
      organization: `Synthetic Candidate Record ${suffix}`,
      statement: `Synthetic Candidate ${suffix} recorded five reviewed field decisions for fixture evaluation.`,
      factKeys: [
        "assertion:approved",
        "field:demographic_disclosure",
        "field:relocation_preference",
        "field:salary_expectation",
        "field:sponsorship_requirement",
        "field:work_authorization",
      ],
      start: assertionDate,
      end: assertionDate,
      temporalSemantics: "ASSERTION_FRESHNESS",
      approval: "USER_APPROVED",
      fieldRecords: [
        {
          field_record_id: stableId("fieldrecord", assertionRecordBase + 1),
          field_concept: "WORK_AUTHORIZATION",
          recorded_value: profile.work_authorization.status,
          disclosure_text: `Synthetic Candidate ${suffix} explicitly approved work authorization value ${profile.work_authorization.status}.`,
          recorded_on: assertionDate,
          valid_through: assertionValidThrough,
        },
        {
          field_record_id: stableId("fieldrecord", assertionRecordBase + 2),
          field_concept: "SPONSORSHIP_REQUIREMENT",
          recorded_value: profile.work_authorization.sponsorship_required
            ? "REQUIRED"
            : "NOT_REQUIRED",
          disclosure_text: `Synthetic Candidate ${suffix} explicitly approved sponsorship requirement value ${
            profile.work_authorization.sponsorship_required
              ? "REQUIRED"
              : "NOT_REQUIRED"
          }.`,
          recorded_on: assertionDate,
          valid_through: assertionValidThrough,
        },
        {
          field_record_id: stableId("fieldrecord", assertionRecordBase + 3),
          field_concept: "RELOCATION_PREFERENCE",
          recorded_value: profile.constraints.relocation,
          disclosure_text: `Synthetic Candidate ${suffix} explicitly approved relocation preference ${profile.constraints.relocation}.`,
          recorded_on: assertionDate,
          valid_through:
            number % 3 === 0 ? "2026-06-30" : assertionValidThrough,
        },
        {
          field_record_id: stableId("fieldrecord", assertionRecordBase + 4),
          field_concept: "SALARY_EXPECTATION",
          recorded_value: `FIXTURE_COMPENSATION_BAND_${suffix}`,
          disclosure_text: `Synthetic Candidate ${suffix} explicitly recorded synthetic compensation band ${suffix}.`,
          recorded_on: assertionDate,
        },
        {
          field_record_id: stableId("fieldrecord", assertionRecordBase + 5),
          field_concept: "DEMOGRAPHIC_DISCLOSURE",
          disclosure_text: `Synthetic Candidate ${suffix} chose not to provide a demographic disclosure value.`,
          recorded_on: assertionDate,
        },
      ],
    });
    if (records.length !== 6) {
      throw new Error("generator evidence topology must contain six records");
    }
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
        effective_period: {
          start: record.start,
          ...(record.end === undefined ? {} : { end: record.end }),
        },
        temporal_semantics: record.temporalSemantics,
        ...(record.educationState === undefined
          ? {}
          : { education_state: record.educationState }),
        ...(record.credentialBasis === undefined
          ? {}
          : { credential_validity_basis: record.credentialBasis }),
        ...(record.revokedOn === undefined
          ? {}
          : { revoked_on: record.revokedOn }),
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
    const asOf = "2026-07-29";
    const profileEvidence = evidence.filter(
      (artifact) => artifact.profile_ref === profile.id,
    );
    const resumeEvidence = profileEvidence.filter(
      (artifact) => artifact.effective_period.start <= asOf,
    );
    const factCounts = [4, 5, 6, 6, 5, 6, 5, 5, 6, 5, 5, 6] as const;
    const factCount = factCounts[index];
    if (factCount === undefined) {
      throw new Error("generator resume fact-count design missing");
    }
    const twoPage = profile.coverage_tags.includes("TWO_PAGE_RESUME");
    const orderedEvidence = twoPage
      ? [
          ...resumeEvidence.filter(
            (artifact) => artifact.category === "EMPLOYMENT_RECORD",
          ),
          required(
            resumeEvidence.find(
              (artifact) => artifact.category === "EDUCATION_RECORD",
            ),
            "two-page resume first education evidence is missing",
          ),
          ...resumeEvidence
            .filter((artifact) => artifact.category === "EDUCATION_RECORD")
            .slice(1),
          ...resumeEvidence.filter(
            (artifact) => artifact.category === "PROJECT_RECORD",
          ),
        ]
      : resumeEvidence;
    if (
      orderedEvidence.length < factCount ||
      new Set(orderedEvidence.map((artifact) => artifact.id)).size !==
        orderedEvidence.length
    ) {
      throw new Error("generator resume design requires unique evidence facts");
    }
    const facts = Array.from({ length: factCount }, (_, factIndex) => {
      const artifact = orderedEvidence[factIndex];
      if (artifact === undefined) {
        throw new Error("generator resume evidence missing");
      }
      return {
        fact_id: stableId("resumefact", index * 10 + factIndex + 1),
        page: twoPage && factIndex >= 2 ? (2 as const) : (1 as const),
        text: artifact.statement,
        fact_keys: [...artifact.fact_keys],
        evidence_refs: [artifact.id],
      };
    });
    return {
      id: stableId("resume", index + 1),
      entity_type: "SOURCE_RESUME",
      schema_ref: SCHEMA_REFS.SOURCE_RESUME,
      schema_version: FIXTURE_SCHEMA_VERSION,
      metadata: metadata(),
      profile_ref: profile.id,
      as_of: asOf,
      page_count: twoPage ? 2 : 1,
      ...(twoPage
        ? {
            page_boundary: {
              break_after_fact_id: facts[1]?.fact_id ?? "",
              rationale: TWO_PAGE_RESUME_RATIONALE,
            },
          }
        : {}),
      facts,
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
  const shapeEligibility: readonly SyntheticJob["eligibility_constraint"][] = [
    "NONE",
    "AUTHORIZED_TO_WORK_IN_US",
    "NO_SPONSORSHIP",
    "LICENSE_REQUIRED",
    "AUTHORIZED_TO_WORK_IN_US",
    "NO_SPONSORSHIP",
    "LICENSE_REQUIRED",
    "NONE",
    "NO_SPONSORSHIP",
    "LICENSE_REQUIRED",
    "NONE",
    "AUTHORIZED_TO_WORK_IN_US",
  ];
  const reviewedJobEligibility = new Map<
    string,
    SyntheticJob["eligibility_constraint"]
  >([[stableId("job", 20), "NONE"]]);
  for (const [profileIndex, profile] of profiles.entries()) {
    for (let localJob = 0; localJob < 2; localJob += 1) {
      const jobNumber = profileIndex * 2 + localJob + 1;
      const suffix = twoDigits(jobNumber);
      const shapeIndex = Math.floor((jobNumber - 1) / 2);
      const workMode = modes[(jobNumber - 1) % modes.length] ?? "REMOTE";
      const minimumExperienceYears =
        profile.career_stage === "SENIOR"
          ? 7
          : profile.career_stage === "MID"
            ? localJob === 0
              ? 3
              : 5
            : localJob === 0
              ? 1
              : 2;
      const jobRef = stableId("job", jobNumber);
      const eligibility =
        reviewedJobEligibility.get(jobRef) ?? shapeEligibility[shapeIndex];
      if (eligibility === undefined) {
        throw new Error("generator job-shape eligibility missing");
      }
      const thirdKind = (
        shapeIndex < 4
          ? "CERTIFICATION"
          : shapeIndex < 8
            ? "SKILL"
            : "EDUCATION"
      ) satisfies ExpectedRequirement["requirement_kind"];
      const constraintSemantics =
        eligibility === "LICENSE_REQUIRED"
          ? {
              requirementKind: "CERTIFICATION" as const,
              requirementTag: "license:healthcare-operations",
              constraint: {
                kind: "CURRENT_LICENSE" as const,
                value: "CURRENT_AT_EVALUATION_DATE",
              },
            }
          : eligibility === "NO_SPONSORSHIP"
            ? {
                requirementKind: "ELIGIBILITY" as const,
                requirementTag: "field:sponsorship_requirement",
                constraint: {
                  kind: "SPONSORSHIP" as const,
                  value: "NO_SPONSORSHIP",
                },
              }
            : eligibility === "AUTHORIZED_TO_WORK_IN_US"
              ? {
                  requirementKind: "ELIGIBILITY" as const,
                  requirementTag: "field:work_authorization",
                  constraint: {
                    kind: "WORK_AUTHORIZATION" as const,
                    value: "AUTHORIZED_TO_WORK_IN_US",
                  },
                }
              : {
                  requirementKind: "LOCATION" as const,
                  requirementTag: "field:relocation_preference",
                  constraint: {
                    kind: "WORK_MODE_COMPATIBILITY" as const,
                    value: workMode,
                  },
                };
      const thirdSemantics =
        jobNumber === 13
          ? {
              requirementKind: "CERTIFICATION" as const,
              requirementTag: "license:healthcare-quality-current",
            }
          : thirdKind === "CERTIFICATION"
            ? {
                requirementKind: thirdKind,
                requirementTag: "credential:synthetic-foundation",
              }
            : thirdKind === "SKILL"
              ? {
                  requirementKind: thirdKind,
                  requirementTag: skillKey(requiredSkill(profile, 2)),
                }
              : {
                  requirementKind: thirdKind,
                  requirementTag: "education:completed",
                };
      const semantics = [
        {
          declaredImportance: "MUST_HAVE" as const,
          requirementKind: "EXPERIENCE" as const,
          requirementTag: skillKey(requiredSkill(profile, localJob)),
          constraint: {
            kind: "MINIMUM_EXPERIENCE_YEARS" as const,
            value: String(minimumExperienceYears),
          },
        },
        {
          declaredImportance: "MUST_HAVE" as const,
          ...constraintSemantics,
        },
        {
          declaredImportance:
            shapeIndex % 2 === 0
              ? ("PREFERRED" as const)
              : ("MUST_HAVE" as const),
          ...thirdSemantics,
          constraint: {
            kind: "NONE" as const,
            value: "NONE",
          },
        },
      ];
      const sourceBlocks = semantics.map((semantic, blockIndex) => {
        const text = [
          `Requirement ${semantic.requirementKind}`,
          `tagged ${semantic.requirementTag}`,
          `constraint ${semantic.constraint.kind}=${semantic.constraint.value}`,
          `importance ${semantic.declaredImportance}.`,
        ].join("; ");
        return {
          anchor_id: `job-${suffix}.requirements.${twoDigits(blockIndex + 1)}`,
          declared_importance: semantic.declaredImportance,
          requirement_kind:
            semantic.requirementKind as ExpectedRequirement["requirement_kind"],
          requirement_tag: semantic.requirementTag,
          constraint: semantic.constraint,
          text,
          text_sha256: sha256Bytes(text),
        };
      });
      const job: SyntheticJob = {
        id: jobRef,
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
          requirement_kind: block.requirement_kind,
          normalized_text: block.text,
          source_anchor_id: block.anchor_id,
          source_text_sha256: block.text_sha256,
          requirement_tag: block.requirement_tag,
          constraint: block.constraint,
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
  expectedAction: UnsupportedGap["expected_action"] = "ABSTAIN",
  reasonCode?: UnsupportedGap["reason_code"],
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
    expected_action: expectedAction,
    reason_code:
      reasonCode ??
      (classification === "CONTRADICTED"
        ? "CONTRADICTED_BY_EXPLICIT_RECORD"
        : classification === "PARTIAL"
          ? "INSUFFICIENT_DIRECT_EVIDENCE"
          : "NO_SUPPORTING_EVIDENCE"),
    support_review_rationale: rationale,
  };
}

interface CrossScenarioDesign {
  readonly profileRef: string;
  readonly jobRef: string;
  readonly requirementTag: string;
  readonly classification: "PARTIAL" | "STRONG_RELATED" | "UNSUPPORTED";
  readonly selector?: SemanticEvidenceSelector;
}

const CROSS_SCENARIO_DESIGNS: readonly CrossScenarioDesign[] = [
  {
    profileRef: stableId("profile", 1),
    jobRef: stableId("job", 6),
    requirementTag: "skill:data-modeling",
    classification: "UNSUPPORTED",
  },
  {
    profileRef: stableId("profile", 2),
    jobRef: stableId("job", 9),
    requirementTag: "skill:process-mapping",
    classification: "UNSUPPORTED",
  },
  {
    profileRef: stableId("profile", 3),
    jobRef: stableId("job", 8),
    requirementTag: "skill:machine-learning",
    classification: "UNSUPPORTED",
  },
  {
    profileRef: stableId("profile", 4),
    jobRef: stableId("job", 5),
    requirementTag: "skill:sql",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 22),
      category: "PROJECT_RECORD",
      fact_keys: ["skill:statistical-analysis", "project:reviewed-2"],
    },
  },
  {
    profileRef: stableId("profile", 5),
    jobRef: stableId("job", 11),
    requirementTag: "skill:scheduling",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 28),
      category: "PROJECT_RECORD",
      fact_keys: ["skill:requirements-analysis", "project:reviewed-3"],
    },
  },
  {
    profileRef: stableId("profile", 6),
    jobRef: stableId("job", 9),
    requirementTag: "skill:process-mapping",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 34),
      category: "PROJECT_RECORD",
      fact_keys: ["skill:process-improvement", "project:reviewed-3"],
    },
  },
  {
    profileRef: stableId("profile", 7),
    jobRef: stableId("job", 7),
    requirementTag: "skill:experiment-design",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 37),
      category: "EMPLOYMENT_RECORD",
      fact_keys: ["skill:quality-reporting", "experience:employment-1"],
    },
  },
  {
    profileRef: stableId("profile", 8),
    jobRef: stableId("job", 5),
    requirementTag: "skill:sql",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 44),
      category: "PROJECT_RECORD",
      fact_keys: ["skill:learning-analytics", "project:reviewed-1"],
    },
  },
  {
    profileRef: stableId("profile", 9),
    jobRef: stableId("job", 19),
    requirementTag: "skill:financial-modeling",
    classification: "PARTIAL",
    selector: {
      id: stableId("evidence", 50),
      category: "PROJECT_RECORD",
      fact_keys: ["skill:forecasting", "project:reviewed-1"],
    },
  },
  {
    profileRef: stableId("profile", 10),
    jobRef: stableId("job", 1),
    requirementTag: "skill:typescript",
    classification: "UNSUPPORTED",
  },
  {
    profileRef: stableId("profile", 11),
    jobRef: stableId("job", 11),
    requirementTag: "skill:scheduling",
    classification: "STRONG_RELATED",
    selector: {
      id: stableId("evidence", 61),
      category: "EMPLOYMENT_RECORD",
      fact_keys: ["skill:task-tracking", "experience:employment-1"],
    },
  },
  {
    profileRef: stableId("profile", 12),
    jobRef: stableId("job", 14),
    requirementTag: "skill:quality-reporting",
    classification: "UNSUPPORTED",
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
    const crossDesign = CROSS_SCENARIO_DESIGNS.find(
      (design) => design.profileRef === profile.id,
    );
    if (crossDesign === undefined) {
      throw new Error("generator cross-scenario design missing");
    }
    const crossJobIndex = jobs.findIndex(
      (candidate) => candidate.id === crossDesign.jobRef,
    );
    if (crossJobIndex < 0) {
      throw new Error("generator cross-scenario job is missing");
    }
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
        let selectedEvidence: EvidenceArtifact[] = [];
        let gapAction: UnsupportedGap["expected_action"] = "ABSTAIN";
        let gapReason: UnsupportedGap["reason_code"] | undefined;
        if (localScenario === 2 && requirementIndex === 0) {
          if (requirement.requirement_tag !== crossDesign.requirementTag) {
            throw new Error(
              `${scenarioId}/${requirement.id}: cross-scenario requirement tag drifted from its reviewed design`,
            );
          }
          classification = crossDesign.classification;
          selectedEvidence =
            crossDesign.selector === undefined
              ? []
              : [
                  selectExactlyOneEvidence(
                    profileEvidence,
                    crossDesign.selector,
                    `${scenarioId}/${requirement.id}`,
                  ),
                ];
          const reviewedRelation = selectedEvidence[0]
            ? reviewedExperienceRelation(requirement, selectedEvidence[0])
            : undefined;
          if (
            (classification === "PARTIAL" && reviewedRelation !== "PARTIAL") ||
            (classification === "STRONG_RELATED" &&
              reviewedRelation !== "STRONG_RELATED") ||
            (classification === "UNSUPPORTED" && selectedEvidence.length !== 0)
          ) {
            throw new Error(
              `${scenarioId}/${requirement.id}: cross-scenario semantic relation does not match its reviewed classification`,
            );
          }
        } else if (requirement.requirement_kind === "EXPERIENCE") {
          selectedEvidence = profileEvidence.filter(
            (artifact) =>
              artifact.category === "EMPLOYMENT_RECORD" &&
              artifact.fact_keys.includes(requirement.requirement_tag),
          );
          const threshold = requiredExperienceDays(requirement);
          const covered = experienceCoverageDays(
            selectedEvidence,
            resume.as_of,
          );
          classification =
            selectedEvidence.length === 0
              ? "UNSUPPORTED"
              : threshold !== undefined && covered < threshold
                ? "PARTIAL"
                : "DIRECT";
        } else if (
          requirement.requirement_kind === "ELIGIBILITY" ||
          requirement.requirement_kind === "LOCATION"
        ) {
          selectedEvidence = [assertionEvidence];
          const sponsorshipConflict =
            requirement.constraint.kind === "SPONSORSHIP" &&
            profile.work_authorization.sponsorship_required;
          const authorizationConflict =
            requirement.constraint.kind === "WORK_AUTHORIZATION" &&
            profile.work_authorization.status !== "AUTHORIZED";
          const relocationConflict =
            requirement.constraint.kind === "WORK_MODE_COMPATIBILITY" &&
            requirement.constraint.value !== "REMOTE" &&
            profile.constraints.relocation === "REMOTE_ONLY";
          classification =
            sponsorshipConflict || authorizationConflict || relocationConflict
              ? "CONTRADICTED"
              : "USER_ASSERTED";
          if (classification === "CONTRADICTED") {
            gapAction = "BLOCK_AND_EXPLAIN";
          }
        } else if (requirement.requirement_kind === "CERTIFICATION") {
          const matching = profileEvidence.filter(
            (artifact) =>
              artifact.category === "CREDENTIAL_RECORD" &&
              artifact.fact_keys.includes(requirement.requirement_tag),
          );
          const current = matching.filter(
            (artifact) =>
              credentialStateAt(artifact, resume.as_of) === "CURRENT",
          );
          if (current.length > 0) {
            selectedEvidence = current;
            classification = "DIRECT";
          } else if (matching.length === 0) {
            classification = "UNSUPPORTED";
          } else {
            selectedEvidence = [
              required(matching[0], "matching credential evidence is missing"),
            ];
            const state = credentialStateAt(
              required(
                selectedEvidence[0],
                "selected credential evidence is missing",
              ),
              resume.as_of,
            );
            if (state === "EXPIRED") {
              classification = "PARTIAL";
              gapAction = "REQUIRE_CONFIRMATION";
              gapReason = "CREDENTIAL_EXPIRED";
            } else if (state === "UNKNOWN") {
              classification = "UNSUPPORTED";
              gapAction = "REQUIRE_CONFIRMATION";
              gapReason = "CREDENTIAL_NOT_CURRENT";
            } else {
              classification = "CONTRADICTED";
              gapAction = "BLOCK_AND_EXPLAIN";
              gapReason = "CREDENTIAL_NOT_CURRENT";
            }
          }
        } else if (requirement.requirement_kind === "EDUCATION") {
          selectedEvidence = profileEvidence.filter(
            (artifact) =>
              artifact.category === "EDUCATION_RECORD" &&
              artifact.education_state === "COMPLETED" &&
              artifact.fact_keys.includes(requirement.requirement_tag),
          );
          classification =
            selectedEvidence.length === 0 ? "UNSUPPORTED" : "DIRECT";
        } else {
          selectedEvidence = profileEvidence.filter(
            (artifact) =>
              artifact.category !== "USER_ASSERTION" &&
              artifact.fact_keys.includes(requirement.requirement_tag),
          );
          classification =
            selectedEvidence.length === 0 ? "UNSUPPORTED" : "DIRECT";
        }

        if (
          classification === "DIRECT" ||
          classification === "STRONG_RELATED" ||
          classification === "USER_ASSERTED"
        ) {
          if (selectedEvidence.length === 0) {
            throw new Error("supported result lacks generator evidence");
          }
          for (const artifact of selectedEvidence) {
            addRelation(artifact, requirement.id, classification);
          }
          const fieldRecord =
            classification === "USER_ASSERTED"
              ? fieldRecordForRequirement(
                  required(
                    selectedEvidence[0],
                    "selected field evidence is missing",
                  ),
                  requirement,
                )
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
          const decision =
            fieldPolicy === undefined
              ? {
                  action: "USE_SUPPORTED_EVIDENCE" as const,
                  releaseEligible: true,
                }
              : policyDecisionAt(
                  fieldPolicy,
                  required(
                    selectedEvidence[0],
                    "selected policy evidence is missing",
                  ),
                  resume.as_of,
                );
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
              fieldRecord?.disclosure_text ??
              required(
                selectedEvidence[0],
                "selected claim evidence is missing",
              ).statement,
            evidence_refs: selectedEvidence.map((artifact) => artifact.id),
            ...(fieldPolicy === undefined
              ? {}
              : { field_policy_ref: fieldPolicy.id }),
            release_eligible: decision.releaseEligible,
            canonical_evidence_mutation: false,
            support_review_rationale: expectedReviewRationale({
              classification,
              requirement,
              evidence: selectedEvidence,
              evaluationDate: resume.as_of,
            }),
          };
          claims.push(claim);
          evaluations.push({
            requirement_ref: requirement.id,
            classification,
            result_type: "SUPPORTED_CLAIM",
            result_ref: claim.id,
            expected_action: decision.action,
          });
        } else {
          if (
            classification !== "UNSUPPORTED" &&
            selectedEvidence.length === 0
          ) {
            throw new Error("related gap lacks generator evidence");
          }
          if (classification !== "UNSUPPORTED") {
            for (const artifact of selectedEvidence) {
              addRelation(
                artifact,
                requirement.id,
                classification === "PARTIAL" ? "PARTIAL" : "CONTRADICTS",
              );
            }
          }
          gapNumber += 1;
          const resolvedReason =
            gapReason ??
            (classification === "CONTRADICTED"
              ? "CONTRADICTED_BY_EXPLICIT_RECORD"
              : classification === "PARTIAL"
                ? "INSUFFICIENT_DIRECT_EVIDENCE"
                : "NO_SUPPORTING_EVIDENCE");
          const gap = makeGap(
            gapNumber,
            scenarioId,
            profile.id,
            requirement.id,
            classification,
            selectedEvidence.map((artifact) => artifact.id),
            expectedReviewRationale({
              classification,
              requirement,
              evidence: selectedEvidence,
              evaluationDate: resume.as_of,
              reasonCode: resolvedReason,
            }),
            gapAction,
            resolvedReason,
          );
          gaps.push(gap);
          evaluations.push({
            requirement_ref: requirement.id,
            classification,
            result_type: "UNSUPPORTED_GAP",
            result_ref: gap.id,
            expected_action: gap.expected_action,
          });
        }
      }
      const profilePolicies = policies.filter(
        (policy) => policy.profile_ref === profile.id,
      );
      const policyIndexesByScenario = [
        [0, 2],
        [1, 3],
        [4, 5],
      ] as const;
      const assignedPolicies = (
        policyIndexesByScenario[localScenario] ?? []
      ).flatMap((policyIndex) => {
        const policy = profilePolicies[policyIndex];
        return policy === undefined ? [] : [policy];
      });
      const policyEvaluations: ScenarioBundle["policy_evaluations"] =
        assignedPolicies.map((policy) => {
          const source = evidence.find(
            (artifact) => artifact.id === policy.source_evidence_ref,
          );
          if (source === undefined) {
            throw new Error("generator policy evaluation source missing");
          }
          const decision = policyDecisionAt(policy, source, resume.as_of);
          return {
            policy_ref: policy.id,
            field_concept: policy.field_concept,
            source_evidence_ref: source.id,
            expected_action: decision.action,
            release_eligible: decision.releaseEligible,
          };
        });
      if (policyEvaluations.length === 0) {
        throw new Error("generator scenario policy assignment missing");
      }
      const blockedByEligibility = evaluations.some(
        (evaluation) => evaluation.classification === "CONTRADICTED",
      );
      const allActions = [
        ...evaluations.map((evaluation) => evaluation.expected_action),
        ...policyEvaluations.map((evaluation) => evaluation.expected_action),
      ];
      const blockedByFieldPolicy = allActions.includes("BLOCK_AND_EXPLAIN");
      const requiresConfirmation = allActions.includes("REQUIRE_CONFIRMATION");
      scenarios.push({
        id: scenarioId,
        entity_type: "SCENARIO_BUNDLE",
        schema_ref: SCHEMA_REFS.SCENARIO_BUNDLE,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        profile_ref: profile.id,
        resume_ref: resume.id,
        job_ref: job.id,
        evaluation_date: resume.as_of,
        expected_outcome: blockedByEligibility
          ? "BLOCK_INELIGIBLE"
          : blockedByFieldPolicy
            ? "BLOCK_FIELD_POLICY"
            : evaluations.every(
                  (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
                ) &&
                policyEvaluations.every(
                  (evaluation) => evaluation.expected_action === "ABSTAIN",
                )
              ? "ABSTAIN"
              : requiresConfirmation
                ? "REQUIRE_CONFIRMATION"
                : "PROCEED_WITH_GAPS",
        evaluations,
        policy_evaluations: policyEvaluations,
        coverage_tags: [
          "COMPLETE_REQUIREMENT_EVALUATION",
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
  if (concept === "SPONSORSHIP_REQUIREMENT") {
    return profile.work_authorization.sponsorship_required
      ? "REQUIRED"
      : "NOT_REQUIRED";
  }
  return `FIXTURE_COMPENSATION_BAND_${suffix}`;
}

function requiredFieldRecordId(
  artifact: EvidenceArtifact,
  concept: Exclude<FieldValuePolicy["field_concept"], "LICENSE_VALIDITY">,
): string {
  const record = artifact.field_records.find(
    (item) => item.field_concept === concept,
  );
  if (record === undefined) {
    throw new Error("generator required policy field record missing");
  }
  return record.field_record_id;
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
    const variants: {
      concept: FieldValuePolicy["field_concept"];
      sensitivity: FieldValuePolicy["sensitivity"];
      consequential: boolean;
      policy: FieldValuePolicyKind;
      source: EvidenceArtifact;
      sourceFieldRecordId?: string;
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
        source: assertion,
        sourceFieldRecordId: requiredFieldRecordId(
          assertion,
          "WORK_AUTHORIZATION",
        ),
      },
      {
        concept: "SPONSORSHIP_REQUIREMENT",
        sensitivity: "PERSONAL",
        consequential: true,
        policy:
          number % 3 === 1
            ? "CONFIRM_ONCE_PER_JOB"
            : number % 3 === 2
              ? "BLOCK_AND_EXPLAIN"
              : "FILL_FROM_EXPLICIT_RECORD",
        source: assertion,
        sourceFieldRecordId: requiredFieldRecordId(
          assertion,
          "SPONSORSHIP_REQUIREMENT",
        ),
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
        source: assertion,
        sourceFieldRecordId: requiredFieldRecordId(
          assertion,
          "RELOCATION_PREFERENCE",
        ),
      },
      {
        concept: "SALARY_EXPECTATION",
        sensitivity: "SENSITIVE",
        consequential: true,
        policy:
          number % 3 === 0
            ? "NEVER_AUTOFILL"
            : number % 2 === 0
              ? "BLOCK_AND_EXPLAIN"
              : "CONFIRM_ONCE_PER_JOB",
        source: assertion,
        sourceFieldRecordId: requiredFieldRecordId(
          assertion,
          "SALARY_EXPECTATION",
        ),
      },
      {
        concept: "DEMOGRAPHIC_DISCLOSURE",
        sensitivity: "SENSITIVE",
        consequential: false,
        policy:
          number % 2 === 1
            ? "NEVER_AUTOFILL"
            : "VOLUNTARY_PREFER_NOT_TO_ANSWER",
        source: assertion,
        sourceFieldRecordId: requiredFieldRecordId(
          assertion,
          "DEMOGRAPHIC_DISCLOSURE",
        ),
      },
    ];
    const profileCredentials = evidence.filter(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "CREDENTIAL_RECORD",
    );
    const consequentialCredentialTag =
      number === 7
        ? "license:healthcare-operations"
        : number === 8
          ? "credential:revoked"
          : number === 9
            ? "credential:unknown-validity"
            : undefined;
    const credential =
      profileCredentials.find(
        (artifact) =>
          consequentialCredentialTag !== undefined &&
          artifact.fact_keys.includes(consequentialCredentialTag),
      ) ?? profileCredentials[0];
    if (credential !== undefined) {
      variants.push({
        concept: "LICENSE_VALIDITY",
        sensitivity: "PERSONAL",
        consequential: true,
        policy: "CONFIRM_IF_RECORD_EXPIRED",
        source: credential,
      });
    }
    variants.forEach((variant) => {
      if (
        variant.concept !== "LICENSE_VALIDITY" &&
        variant.sourceFieldRecordId === undefined
      ) {
        throw new Error("generator policy field record missing");
      }
      const needsValue =
        variant.concept !== "LICENSE_VALIDITY" &&
        (variant.policy === "FILL_FROM_EXPLICIT_RECORD" ||
          variant.policy === "CONFIRM_ONCE_PER_JOB" ||
          variant.policy === "CONFIRM_IF_RECORD_EXPIRED");
      policies.push({
        id: stableId("policy", policies.length + 1),
        entity_type: "FIELD_VALUE_POLICY",
        schema_ref: SCHEMA_REFS.FIELD_VALUE_POLICY,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: metadata(),
        profile_ref: profile.id,
        field_concept: variant.concept,
        sensitivity: variant.sensitivity,
        consequential: variant.consequential,
        policy: variant.policy,
        source_evidence_ref: variant.source.id,
        ...(variant.sourceFieldRecordId === undefined
          ? {}
          : { source_field_record_id: variant.sourceFieldRecordId }),
        ...(needsValue
          ? {
              recorded_value: policyValue(profile, variant.concept, suffix),
            }
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

function writeOrCheck(path: string, bytes: Buffer, checkMode: boolean): void {
  if (checkMode) {
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

function verifyCheckInventory(rootPath: string): void {
  let root;
  try {
    root = lstatSync(rootPath);
  } catch {
    throw new Error("seed drift: committed fixture root is missing");
  }
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error("seed drift: committed fixture root is not a directory");
  }
  const expected = [
    "manifest.v2.json",
    ...COLLECTION_SPECS.map((spec) => spec.file),
  ].sort();
  const actual = readdirSync(rootPath).sort();
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error("seed drift: committed fixture inventory differs");
  }
}

async function runSeed(rootPath: string, checkMode: boolean): Promise<void> {
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
  const { questionCases, answerConstraints, answerScenarios } =
    makeAnswerFixtures({ profiles, evidence, jobs, policies });
  const collections = new Map<string, FixtureEntity[]>([
    ["answer-constraints.v2.json", answerConstraints],
    ["answer-scenarios.v2.json", answerScenarios],
    ["evidence-artifacts.v2.json", evidence],
    ["expected-requirements.v2.json", requirements],
    ["expected-supported-claims.v2.json", claims],
    ["field-value-policies.v2.json", policies],
    ["jobs.v2.json", jobs],
    ["profiles.v2.json", profiles],
    ["question-cases.v2.json", questionCases],
    ["scenario-bundles.v2.json", scenarios],
    ["source-resumes.v2.json", resumes],
    ["unsupported-gaps.v2.json", gaps],
  ]);
  const all = [...collections.values()].flat();
  all.forEach((entity) => seal(entity));
  validateEntities(all);
  if (checkMode) {
    verifyCheckInventory(rootPath);
  } else {
    mkdirSync(rootPath, { recursive: true });
  }
  const files: FixtureManifestFile[] = [];
  const serializedFiles = new Map<string, Buffer>();
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
    serializedFiles.set(spec.file, bytes);
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
  const counts = {
    profiles: profiles.length,
    evidence_artifacts: evidence.length,
    source_resumes: resumes.length,
    jobs: jobs.length,
    expected_requirements: requirements.length,
    expected_supported_claims: claims.length,
    unsupported_gaps: gaps.length,
    field_value_policies: policies.length,
    scenario_bundles: scenarios.length,
    scenario_evaluations: scenarios.reduce(
      (sum, scenario) => sum + scenario.evaluations.length,
      0,
    ),
  };
  const answerCounts = {
    question_cases: questionCases.length,
    question_clusters: new Set(
      questionCases.map((question) => question.cluster_ref),
    ).size,
    answer_constraints: answerConstraints.length,
    answer_scenarios: answerScenarios.length,
  };
  const manifest: FixtureManifest = {
    id: stableId("manifest", 1),
    schema_ref: SCHEMA_REFS.MANIFEST,
    schema_version: FIXTURE_SCHEMA_VERSION,
    corpus_version: CORPUS_VERSION,
    corpus_state: "DEVELOPMENT_MUTABLE",
    holdout_content_present: false,
    metadata: w02ManifestMetadata(),
    files,
    counts,
    answer_counts: answerCounts,
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
  const generatedCorpus: FixtureCorpus = {
    manifest,
    profiles,
    evidenceArtifacts: evidence,
    sourceResumes: resumes,
    jobs,
    expectedRequirements: requirements,
    expectedSupportedClaims: claims,
    unsupportedGaps: gaps,
    fieldValuePolicies: policies,
    scenarioBundles: scenarios,
    questionCases,
    answerConstraints,
    answerScenarios,
  };
  const consistency = validateFixtureConsistency(generatedCorpus);
  if (!consistency.valid) {
    throw new Error(
      `generated corpus failed consistency: ${consistency.issues
        .slice(0, 12)
        .map((entry) => entry.code)
        .join(", ")}`,
    );
  }
  for (const spec of COLLECTION_SPECS) {
    const bytes = serializedFiles.get(spec.file);
    if (bytes === undefined) {
      throw new Error(`generator serialized collection missing: ${spec.file}`);
    }
    writeOrCheck(join(rootPath, spec.file), bytes, checkMode);
  }
  writeOrCheck(
    join(rootPath, "manifest.v2.json"),
    await serialize(manifest),
    checkMode,
  );
  const mode = checkMode ? "verified" : "wrote";
  const profileCount = String(profiles.length);
  const evidenceCount = String(evidence.length);
  const resumeCount = String(resumes.length);
  const jobCount = String(jobs.length);
  const requirementCount = String(requirements.length);
  const scenarioCount = String(scenarios.length);
  const evaluationCount = String(counts.scenario_evaluations);
  const claimCount = String(claims.length);
  const gapCount = String(gaps.length);
  const policyCount = String(policies.length);
  const questionCount = String(questionCases.length);
  const clusterCount = String(answerCounts.question_clusters);
  const constraintCount = String(answerConstraints.length);
  const answerScenarioCount = String(answerScenarios.length);
  console.log(
    `fixture seed ${mode}: ${profileCount} profiles, ${evidenceCount} evidence artifacts, ${resumeCount} resumes, ${jobCount} jobs, ${requirementCount} requirements, ${scenarioCount} scenarios/${evaluationCount} evaluations, ${claimCount} claims, ${gapCount} gaps, ${policyCount} policies, ${questionCount} questions/${clusterCount} clusters, ${constraintCount} constraints, ${answerScenarioCount} answer scenarios`,
  );
}

/**
 * Test-only entry point for proving that check mode is observational.
 * It never enables write mode and is intentionally not exposed by package.json.
 */
export async function verifyGeneratedSeedAtRootForTest(
  rootPath: string,
): Promise<void> {
  await runSeed(rootPath, true);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error("usage: node scripts/generate-seed.ts [--check]");
  }
  await runSeed(COMMITTED_FIXTURE_ROOT, args[0] === "--check");
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  try {
    await main();
  } catch {
    console.error(`fixture seed failed: ${safeUnknownErrorMessage()}`);
    process.exitCode = 1;
  }
}
