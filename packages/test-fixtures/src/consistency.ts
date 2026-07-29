import { sha256Bytes } from "./canonical-json.ts";
import {
  EXPECTED_SEED_COUNTS,
  type EvidenceArtifact,
  type EvidenceRelation,
  type ExpectedSupportedClaim,
  type FieldValuePolicy,
  type FixtureCorpus,
  type FixtureEntity,
  type FixtureEntityType,
  type FixtureCounts,
  type RoleFamily,
  type ScenarioBundle,
  type SupportClassification,
  type SupportedClassification,
} from "./model.ts";

export interface FixtureValidationIssue {
  readonly code: string;
  readonly entityId: string;
  readonly pointer: string;
  readonly detail: string;
}

export interface FixtureValidationReport {
  readonly valid: boolean;
  readonly issues: readonly FixtureValidationIssue[];
  readonly counts: FixtureCounts;
}

export class FixtureConsistencyError extends Error {
  public readonly issues: readonly FixtureValidationIssue[];

  public constructor(issues: readonly FixtureValidationIssue[]) {
    super(
      `fixture consistency failed with ${String(issues.length)} issue(s): ${issues
        .slice(0, 8)
        .map((issue) => `${issue.code} ${issue.entityId}${issue.pointer}`)
        .join(", ")}`,
    );
    this.name = "FixtureConsistencyError";
    this.issues = issues;
  }
}

function pointerAt(collection: string, index: number, suffix = ""): string {
  return `${collection}/${String(index)}${suffix}`;
}

function issue(
  issues: FixtureValidationIssue[],
  code: string,
  entityId: string,
  pointer: string,
  detail: string,
): void {
  issues.push({ code, entityId, pointer, detail });
}

function allEntities(corpus: FixtureCorpus): FixtureEntity[] {
  return [
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
}

function exactReference<T extends FixtureEntity>(
  target: string,
  expectedType: FixtureEntityType,
  typed: ReadonlyMap<string, T>,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
  ownerId: string,
  pointer: string,
): T | undefined {
  const found = typed.get(target);
  if (found !== undefined) {
    return found;
  }
  issue(
    issues,
    global.has(target) ? "REFERENCE_WRONG_TYPE" : "REFERENCE_DANGLING",
    ownerId,
    pointer,
    `reference must resolve to ${expectedType}`,
  );
  return undefined;
}

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function overlaps(left: EvidenceArtifact, right: EvidenceArtifact): boolean {
  return (
    dateValue(left.effective_period.start) <=
      dateValue(right.effective_period.end) &&
    dateValue(right.effective_period.start) <=
      dateValue(left.effective_period.end)
  );
}

function monthGap(previousEnd: string, nextStart: string): number {
  return (
    (dateValue(nextStart) - dateValue(previousEnd)) / (1000 * 60 * 60 * 24)
  );
}

function checkMetadata(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): void {
  const values = [corpus.manifest, ...allEntities(corpus)];
  for (const value of values) {
    if (
      value.metadata.author === "" ||
      value.metadata.reviewer === "" ||
      (value.metadata as { expected_result_provenance: string })
        .expected_result_provenance !== "M02W01_INDEPENDENT_SYNTHETIC_REVIEW"
    ) {
      issue(
        issues,
        "REVIEW_METADATA_MISSING",
        value.id,
        "/metadata",
        "review metadata is required",
      );
    }
    if (value.metadata.author === value.metadata.reviewer) {
      issue(
        issues,
        "REVIEW_NOT_INDEPENDENT",
        value.id,
        "/metadata/reviewer",
        "author and reviewer must differ",
      );
    }
  }
}

function checkProfileEvidenceAndResumes(
  corpus: FixtureCorpus,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
): void {
  const profiles = new Map(corpus.profiles.map((value) => [value.id, value]));
  const evidence = new Map(
    corpus.evidenceArtifacts.map((value) => [value.id, value]),
  );
  const resumes = new Map(
    corpus.sourceResumes.map((value) => [value.id, value]),
  );
  const evidenceByProfile = new Map<string, EvidenceArtifact[]>();
  for (const artifact of corpus.evidenceArtifacts) {
    exactReference(
      artifact.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      artifact.id,
      "/profile_ref",
    );
    if (
      dateValue(artifact.effective_period.start) >
      dateValue(artifact.effective_period.end)
    ) {
      issue(
        issues,
        "CHRONOLOGY_REVERSED",
        artifact.id,
        "/effective_period",
        "start must not follow end",
      );
    }
    if (
      (artifact.category === "USER_ASSERTION" &&
        artifact.assertion_approval !== "USER_APPROVED") ||
      (artifact.category !== "USER_ASSERTION" &&
        artifact.assertion_approval !== "NOT_APPLICABLE")
    ) {
      issue(
        issues,
        "ASSERTION_APPROVAL_INCOHERENT",
        artifact.id,
        "/assertion_approval",
        "approval state must match evidence category",
      );
    }
    if (artifact.category === "USER_ASSERTION") {
      const concepts = artifact.field_records.map(
        (record) => record.field_concept,
      );
      if (
        concepts.length !== 4 ||
        new Set(concepts).size !== 4 ||
        !artifact.fact_keys.includes("assertion:approved")
      ) {
        issue(
          issues,
          "ATOMIC_FIELD_RECORDS_INCOMPLETE",
          artifact.id,
          "/field_records",
          "approved user assertion must contain four unique atomic field records",
        );
      }
    } else if (artifact.field_records.length !== 0) {
      issue(
        issues,
        "FIELD_RECORD_ON_NON_ASSERTION",
        artifact.id,
        "/field_records",
        "only user assertions may carry atomic field records",
      );
    }
    const group = evidenceByProfile.get(artifact.profile_ref) ?? [];
    group.push(artifact);
    evidenceByProfile.set(artifact.profile_ref, group);
  }

  for (const profile of corpus.profiles) {
    const artifacts = evidenceByProfile.get(profile.id) ?? [];
    const factKeys = new Set(
      artifacts.flatMap((artifact) => artifact.fact_keys),
    );
    for (const [index, skill] of profile.skills.entries()) {
      const expectedKey = `skill:${skill.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}`;
      if (!factKeys.has(expectedKey)) {
        issue(
          issues,
          "KEYWORD_ONLY_SKILL",
          profile.id,
          pointerAt("/skills", index),
          "skill lacks a matching evidence fact",
        );
      }
    }
    const employment = artifacts
      .filter((artifact) => artifact.category === "EMPLOYMENT_RECORD")
      .sort((left, right) =>
        left.effective_period.start.localeCompare(right.effective_period.start),
      );
    for (let leftIndex = 0; leftIndex < employment.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < employment.length;
        rightIndex += 1
      ) {
        const left = employment[leftIndex];
        const right = employment[rightIndex];
        if (left === undefined || right === undefined) {
          continue;
        }
        if (
          overlaps(left, right) &&
          (left.concurrency_group === undefined ||
            right.concurrency_group === undefined ||
            left.concurrency_group !== right.concurrency_group)
        ) {
          issue(
            issues,
            "EMPLOYMENT_OVERLAP",
            profile.id,
            "/career_start",
            "employment periods overlap without a shared concurrency group",
          );
        }
      }
    }
    if (profile.coverage_tags.includes("EMPLOYMENT_GAP")) {
      const hasGap = employment.slice(1).some((item, index) => {
        const previous = employment[index];
        return (
          previous !== undefined &&
          monthGap(
            previous.effective_period.end,
            item.effective_period.start,
          ) >= 180
        );
      });
      if (!hasGap) {
        issue(
          issues,
          "EMPLOYMENT_GAP_MISSING",
          profile.id,
          "/coverage_tags",
          "tag requires a gap of at least 180 days",
        );
      }
    }
    for (const education of artifacts.filter(
      (artifact) => artifact.category === "EDUCATION_RECORD",
    )) {
      if (
        dateValue(education.effective_period.end) >
        dateValue(profile.career_start)
      ) {
        issue(
          issues,
          "EDUCATION_DATE_INCONSISTENT",
          education.id,
          "/effective_period/end",
          "seed education must conclude by career start",
        );
      }
    }
  }

  const resumeCountByProfile = new Map<string, number>();
  for (const resume of corpus.sourceResumes) {
    const profile = exactReference(
      resume.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      resume.id,
      "/profile_ref",
    );
    resumeCountByProfile.set(
      resume.profile_ref,
      (resumeCountByProfile.get(resume.profile_ref) ?? 0) + 1,
    );
    for (const [index, fact] of resume.facts.entries()) {
      if (fact.page > resume.page_count) {
        issue(
          issues,
          "RESUME_PAGE_BOUNDARY",
          resume.id,
          pointerAt("/facts", index, "/page"),
          "fact page exceeds declared resume page count",
        );
      }
      if (fact.evidence_refs.length === 0) {
        issue(
          issues,
          "RESUME_FACT_UNSUPPORTED",
          resume.id,
          pointerAt("/facts", index, "/evidence_refs"),
          "resume fact requires evidence",
        );
      }
      for (const reference of fact.evidence_refs) {
        const artifact = exactReference(
          reference,
          "EVIDENCE_ARTIFACT",
          evidence,
          global,
          issues,
          resume.id,
          pointerAt("/facts", index, "/evidence_refs"),
        );
        if (artifact === undefined) {
          continue;
        }
        if (artifact.profile_ref !== resume.profile_ref) {
          issue(
            issues,
            "CROSS_PROFILE_EVIDENCE",
            resume.id,
            pointerAt("/facts", index, "/evidence_refs"),
            "evidence belongs to another profile",
          );
        }
        if (artifact.statement !== fact.text) {
          issue(
            issues,
            "RESUME_FACT_MUTATED",
            resume.id,
            pointerAt("/facts", index, "/text"),
            "resume text must reproduce canonical evidence",
          );
        }
        if (fact.fact_keys.some((key) => !artifact.fact_keys.includes(key))) {
          issue(
            issues,
            "RESUME_FACT_KEY_UNSUPPORTED",
            resume.id,
            pointerAt("/facts", index, "/fact_keys"),
            "fact key is absent from referenced evidence",
          );
        }
        if (
          dateValue(artifact.effective_period.end) > dateValue(resume.as_of)
        ) {
          issue(
            issues,
            "RESUME_AS_OF_CONTRADICTION",
            resume.id,
            pointerAt("/facts", index, "/evidence_refs"),
            "resume cites evidence after its as-of date",
          );
        }
      }
    }
    const pages = new Set(resume.facts.map((fact) => fact.page));
    if (
      (resume.page_count === 2 && (!pages.has(1) || !pages.has(2))) ||
      (resume.page_count === 1 && pages.size !== 1)
    ) {
      issue(
        issues,
        "RESUME_PAGE_BOUNDARY",
        resume.id,
        "/facts",
        "fact pages do not substantiate the declared page count",
      );
    }
    if (
      profile?.coverage_tags.includes("TWO_PAGE_RESUME") === true &&
      resume.page_count !== 2
    ) {
      issue(
        issues,
        "TWO_PAGE_COVERAGE_MISSING",
        resume.id,
        "/page_count",
        "coverage-tagged resume must have two pages",
      );
    }
  }
  for (const profile of corpus.profiles) {
    if ((resumeCountByProfile.get(profile.id) ?? 0) !== 1) {
      issue(
        issues,
        "PROFILE_RESUME_CARDINALITY",
        profile.id,
        "/",
        "profile must have exactly one resume",
      );
    }
  }
  void resumes;
}

function checkJobsAndRequirements(
  corpus: FixtureCorpus,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
): void {
  const jobs = new Map(corpus.jobs.map((value) => [value.id, value]));
  const requirementsByJob = new Map<
    string,
    typeof corpus.expectedRequirements
  >();
  for (const job of corpus.jobs) {
    if (job.source_blocks.length !== 3) {
      issue(
        issues,
        "JOB_SOURCE_BLOCK_COUNT",
        job.id,
        "/source_blocks",
        "job must declare exactly three source blocks",
      );
    }
    for (const [index, block] of job.source_blocks.entries()) {
      if (sha256Bytes(block.text) !== block.text_sha256) {
        issue(
          issues,
          "SOURCE_TEXT_DIGEST",
          job.id,
          pointerAt("/source_blocks", index, "/text_sha256"),
          "source text digest mismatch",
        );
      }
    }
    if (
      new Set(job.source_blocks.map((block) => block.anchor_id)).size !==
      job.source_blocks.length
    ) {
      issue(
        issues,
        "SOURCE_ANCHOR_DUPLICATE",
        job.id,
        "/source_blocks",
        "source anchors must be unique",
      );
    }
  }
  for (const requirement of corpus.expectedRequirements) {
    const job = exactReference(
      requirement.job_ref,
      "SYNTHETIC_JOB",
      jobs,
      global,
      issues,
      requirement.id,
      "/job_ref",
    );
    const group = requirementsByJob.get(requirement.job_ref) ?? [];
    group.push(requirement);
    requirementsByJob.set(requirement.job_ref, group);
    if (job === undefined) {
      continue;
    }
    const block = job.source_blocks.find(
      (candidate) => candidate.anchor_id === requirement.source_anchor_id,
    );
    if (block === undefined) {
      issue(
        issues,
        "SOURCE_ANCHOR_DRIFT",
        requirement.id,
        "/source_anchor_id",
        "source anchor does not exist on the job",
      );
    } else {
      if (block.text_sha256 !== requirement.source_text_sha256) {
        issue(
          issues,
          "SOURCE_ANCHOR_DIGEST_DRIFT",
          requirement.id,
          "/source_text_sha256",
          "requirement source hash differs from job source",
        );
      }
      if (block.declared_importance !== requirement.importance) {
        issue(
          issues,
          "REQUIREMENT_IMPORTANCE_MISMATCH",
          requirement.id,
          "/importance",
          "importance differs from source declaration",
        );
      }
    }
  }
  for (const job of corpus.jobs) {
    const jobRequirements = requirementsByJob.get(job.id) ?? [];
    const anchors = jobRequirements.map((item) => item.source_anchor_id).sort();
    const sourceAnchors = job.source_blocks
      .map((item) => item.anchor_id)
      .sort();
    if (
      jobRequirements.length !== 3 ||
      !jobRequirements.some((item) => item.importance === "MUST_HAVE") ||
      !jobRequirements.some((item) => item.importance === "PREFERRED")
    ) {
      issue(
        issues,
        "JOB_REQUIREMENT_COVERAGE",
        job.id,
        "/",
        "job needs three requirements with must-have and preferred coverage",
      );
    }
    if (anchors.join("\n") !== sourceAnchors.join("\n")) {
      issue(
        issues,
        "SOURCE_REQUIREMENT_BIJECTION",
        job.id,
        "/source_blocks",
        "each source block must own exactly one requirement",
      );
    }
    const ordered = [...jobRequirements].sort((left, right) =>
      left.source_anchor_id.localeCompare(right.source_anchor_id),
    );
    const experience = ordered[0];
    const constraint = ordered[1];
    const experienceIsSourceLinked =
      experience?.requirement_kind === "EXPERIENCE" &&
      experience.normalized_text.includes(
        `${String(job.minimum_experience_years)} ${job.minimum_experience_years === 1 ? "year" : "years"}`,
      );
    if (!experienceIsSourceLinked) {
      issue(
        issues,
        "EXPERIENCE_CONSTRAINT_NOT_SOURCE_LINKED",
        job.id,
        "/minimum_experience_years",
        "numeric experience threshold must be represented by the first anchored requirement",
      );
    }
    const expectedConstraint =
      job.eligibility_constraint === "LICENSE_REQUIRED"
        ? {
            kind: "CERTIFICATION",
            tag: "license:healthcare-operations",
            text: "License",
          }
        : job.eligibility_constraint === "NO_SPONSORSHIP"
          ? {
              kind: "ELIGIBILITY",
              tag: "field:work_authorization",
              text: "without sponsorship",
            }
          : {
              kind: "LOCATION",
              tag: "field:relocation_preference",
              text: job.work_mode.toLowerCase().replaceAll("_", ""),
            };
    const constraintIsSourceLinked =
      constraint?.requirement_kind === expectedConstraint.kind &&
      constraint.requirement_tag === expectedConstraint.tag &&
      constraint.normalized_text
        .toLowerCase()
        .replaceAll(/[-_ ]/gu, "")
        .includes(
          expectedConstraint.text.toLowerCase().replaceAll(/[-_ ]/gu, ""),
        );
    if (!constraintIsSourceLinked) {
      issue(
        issues,
        "JOB_CONSTRAINT_NOT_SOURCE_LINKED",
        job.id,
        "/eligibility_constraint",
        "eligibility or location constraint must match the second anchored requirement",
      );
    }
  }
}

function checkEvidenceRelations(
  corpus: FixtureCorpus,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
): void {
  const requirements = new Map(
    corpus.expectedRequirements.map((value) => [value.id, value]),
  );
  for (const artifact of corpus.evidenceArtifacts) {
    const seen = new Set<string>();
    for (const [index, relation] of artifact.requirement_relations.entries()) {
      exactReference(
        relation.requirement_ref,
        "EXPECTED_REQUIREMENT",
        requirements,
        global,
        issues,
        artifact.id,
        pointerAt("/requirement_relations", index, "/requirement_ref"),
      );
      if (seen.has(relation.requirement_ref)) {
        issue(
          issues,
          "EVIDENCE_RELATION_DUPLICATE",
          artifact.id,
          pointerAt("/requirement_relations", index),
          "requirement relation is duplicated",
        );
      }
      seen.add(relation.requirement_ref);
      if (
        relation.relation === "USER_ASSERTED" &&
        (artifact.category !== "USER_ASSERTION" ||
          artifact.assertion_approval !== "USER_APPROVED")
      ) {
        issue(
          issues,
          "USER_ASSERTION_NOT_APPROVED",
          artifact.id,
          pointerAt("/requirement_relations", index, "/relation"),
          "user-asserted support requires approved user assertion evidence",
        );
      }
    }
  }
}

function relationFor(
  artifact: EvidenceArtifact,
  requirementRef: string,
): EvidenceRelation | undefined {
  return artifact.requirement_relations.find(
    (relation) => relation.requirement_ref === requirementRef,
  )?.relation;
}

function policyAllowsClaimRelease(
  policy: FieldValuePolicy,
  reviewedAt: string,
): boolean {
  if (policy.policy === "FILL_FROM_EXPLICIT_RECORD") {
    return true;
  }
  return (
    policy.policy === "CONFIRM_IF_RECORD_EXPIRED" &&
    policy.record_expires_on !== undefined &&
    policy.record_expires_on >= reviewedAt.slice(0, 10)
  );
}

function actionForClaim(
  claim: ExpectedSupportedClaim,
  policy: FieldValuePolicy | undefined,
): ScenarioBundle["evaluations"][number]["expected_action"] {
  if (claim.release_eligible) {
    return "USE_SUPPORTED_EVIDENCE";
  }
  return policy?.policy === "BLOCK_AND_EXPLAIN"
    ? "BLOCK_AND_EXPLAIN"
    : "REQUIRE_CONFIRMATION";
}

function checkScenariosAndResults(
  corpus: FixtureCorpus,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
): void {
  const profiles = new Map(corpus.profiles.map((value) => [value.id, value]));
  const evidence = new Map(
    corpus.evidenceArtifacts.map((value) => [value.id, value]),
  );
  const resumes = new Map(
    corpus.sourceResumes.map((value) => [value.id, value]),
  );
  const jobs = new Map(corpus.jobs.map((value) => [value.id, value]));
  const requirements = new Map(
    corpus.expectedRequirements.map((value) => [value.id, value]),
  );
  const claims = new Map(
    corpus.expectedSupportedClaims.map((value) => [value.id, value]),
  );
  const gaps = new Map(
    corpus.unsupportedGaps.map((value) => [value.id, value]),
  );
  const policies = new Map(
    corpus.fieldValuePolicies.map((value) => [value.id, value]),
  );
  const scenarios = new Map(
    corpus.scenarioBundles.map((value) => [value.id, value]),
  );
  const requirementsByJob = new Map<string, string[]>();
  const resultUseCounts = new Map<string, number>();
  for (const requirement of corpus.expectedRequirements) {
    const refs = requirementsByJob.get(requirement.job_ref) ?? [];
    refs.push(requirement.id);
    requirementsByJob.set(requirement.job_ref, refs);
  }

  for (const claim of corpus.expectedSupportedClaims) {
    const scenario = exactReference(
      claim.scenario_ref,
      "SCENARIO_BUNDLE",
      scenarios,
      global,
      issues,
      claim.id,
      "/scenario_ref",
    );
    exactReference(
      claim.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      claim.id,
      "/profile_ref",
    );
    const requirement = exactReference(
      claim.requirement_ref,
      "EXPECTED_REQUIREMENT",
      requirements,
      global,
      issues,
      claim.id,
      "/requirement_ref",
    );
    const policy =
      claim.field_policy_ref === undefined
        ? undefined
        : exactReference(
            claim.field_policy_ref,
            "FIELD_VALUE_POLICY",
            policies,
            global,
            issues,
            claim.id,
            "/field_policy_ref",
          );
    if (claim.support_classification === "USER_ASSERTED") {
      const expectedConcept = requirement?.requirement_tag
        .slice("field:".length)
        .toUpperCase();
      const policyIsLinked =
        policy?.profile_ref === claim.profile_ref &&
        policy.field_concept === expectedConcept &&
        claim.evidence_refs.includes(policy.source_evidence_ref);
      if (!policyIsLinked) {
        issue(
          issues,
          "CLAIM_POLICY_LINK_MISMATCH",
          claim.id,
          "/field_policy_ref",
          "user-asserted claim must link the matching profile, concept, and source policy",
        );
      }
      if (
        policy !== undefined &&
        claim.release_eligible !==
          policyAllowsClaimRelease(policy, claim.metadata.reviewed_at)
      ) {
        issue(
          issues,
          "CLAIM_POLICY_RELEASE_MISMATCH",
          claim.id,
          "/release_eligible",
          "claim release state must be derived from the linked field policy and review date",
        );
      }
    } else if (
      claim.field_policy_ref !== undefined ||
      !claim.release_eligible
    ) {
      issue(
        issues,
        "CLAIM_POLICY_LINK_MISMATCH",
        claim.id,
        "/release_eligible",
        "non-field evidence claims are release eligible and must not link a field policy",
      );
    }
    if (claim.evidence_refs.length === 0) {
      issue(
        issues,
        "CLAIM_EVIDENCE_EMPTY",
        claim.id,
        "/evidence_refs",
        "supported claim requires evidence",
      );
    }
    if (
      (claim as { canonical_evidence_mutation: boolean })
        .canonical_evidence_mutation
    ) {
      issue(
        issues,
        "CLAIM_MUTATES_EVIDENCE",
        claim.id,
        "/canonical_evidence_mutation",
        "generated text may not mutate canonical evidence",
      );
    }
    let exactStatement = false;
    for (const reference of claim.evidence_refs) {
      const artifact = exactReference(
        reference,
        "EVIDENCE_ARTIFACT",
        evidence,
        global,
        issues,
        claim.id,
        "/evidence_refs",
      );
      if (artifact === undefined) {
        continue;
      }
      if (artifact.profile_ref !== claim.profile_ref) {
        issue(
          issues,
          "CROSS_PROFILE_EVIDENCE",
          claim.id,
          "/evidence_refs",
          "claim evidence belongs to another profile",
        );
      }
      const atomicFieldRecord =
        claim.support_classification === "USER_ASSERTED" &&
        requirement?.requirement_tag.startsWith("field:") === true
          ? artifact.field_records.find(
              (record) =>
                record.field_concept ===
                requirement.requirement_tag
                  .slice("field:".length)
                  .toUpperCase(),
            )
          : undefined;
      if (
        (claim.support_classification === "USER_ASSERTED" &&
          atomicFieldRecord?.disclosure_text === claim.claim_text) ||
        (claim.support_classification !== "USER_ASSERTED" &&
          artifact.statement === claim.claim_text)
      ) {
        exactStatement = true;
      }
      if (
        relationFor(artifact, claim.requirement_ref) !==
        claim.support_classification
      ) {
        issue(
          issues,
          "CLAIM_CLASSIFICATION_INCOHERENT",
          claim.id,
          "/support_classification",
          "evidence relation does not support classification",
        );
      }
      if (
        claim.support_classification === "DIRECT" &&
        requirement !== undefined &&
        !artifact.fact_keys.includes(requirement.requirement_tag)
      ) {
        issue(
          issues,
          "DIRECT_REQUIREMENT_TAG_MISMATCH",
          claim.id,
          "/evidence_refs",
          "direct evidence does not encode the normalized requirement tag",
        );
      }
      if (
        claim.support_classification === "DIRECT" &&
        requirement?.requirement_kind === "EXPERIENCE"
      ) {
        const job = jobs.get(requirement.job_ref);
        const durationDays =
          (dateValue(artifact.effective_period.end) -
            dateValue(artifact.effective_period.start)) /
          (1000 * 60 * 60 * 24);
        if (
          job === undefined ||
          durationDays + 1 < job.minimum_experience_years * 365
        ) {
          issue(
            issues,
            "DIRECT_EXPERIENCE_THRESHOLD_MISMATCH",
            claim.id,
            "/evidence_refs",
            "dated direct evidence does not meet the anchored experience threshold",
          );
        }
      }
      if (
        claim.support_classification === "STRONG_RELATED" &&
        requirement !== undefined &&
        artifact.fact_keys.includes(requirement.requirement_tag)
      ) {
        issue(
          issues,
          "STRONG_RELATED_IS_DIRECT",
          claim.id,
          "/support_classification",
          "strong-related evidence must remain distinct from exact direct support",
        );
      }
    }
    if (!exactStatement) {
      issue(
        issues,
        "CLAIM_TEXT_MUTATED",
        claim.id,
        "/claim_text",
        "claim must reproduce canonical evidence or one matching atomic approved field disclosure",
      );
    }
    if (scenario !== undefined && scenario.profile_ref !== claim.profile_ref) {
      issue(
        issues,
        "RESULT_SCENARIO_PROFILE_MISMATCH",
        claim.id,
        "/profile_ref",
        "claim profile differs from scenario",
      );
    }
  }

  const positiveRelations: readonly EvidenceRelation[] = [
    "DIRECT",
    "STRONG_RELATED",
    "USER_ASSERTED",
  ];
  for (const gap of corpus.unsupportedGaps) {
    const scenario = exactReference(
      gap.scenario_ref,
      "SCENARIO_BUNDLE",
      scenarios,
      global,
      issues,
      gap.id,
      "/scenario_ref",
    );
    exactReference(
      gap.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      gap.id,
      "/profile_ref",
    );
    exactReference(
      gap.requirement_ref,
      "EXPECTED_REQUIREMENT",
      requirements,
      global,
      issues,
      gap.id,
      "/requirement_ref",
    );
    if (gap.supporting_evidence_refs.length !== 0) {
      issue(
        issues,
        "GAP_HAS_SUPPORTING_EVIDENCE",
        gap.id,
        "/supporting_evidence_refs",
        "gap cannot list supporting evidence",
      );
    }
    const expectedReason =
      gap.classification === "CONTRADICTED"
        ? "CONTRADICTED_BY_EXPLICIT_RECORD"
        : gap.classification === "PARTIAL"
          ? "INSUFFICIENT_DIRECT_EVIDENCE"
          : "NO_SUPPORTING_EVIDENCE";
    if (gap.reason_code !== expectedReason) {
      issue(
        issues,
        "GAP_REASON_INCOHERENT",
        gap.id,
        "/reason_code",
        "reason code does not match classification",
      );
    }
    if (
      (gap.classification === "UNSUPPORTED" &&
        gap.related_or_contradicting_evidence_refs.length !== 0) ||
      (gap.classification !== "UNSUPPORTED" &&
        gap.related_or_contradicting_evidence_refs.length === 0)
    ) {
      issue(
        issues,
        "GAP_EVIDENCE_CARDINALITY",
        gap.id,
        "/related_or_contradicting_evidence_refs",
        "related evidence cardinality does not match classification",
      );
    }
    for (const reference of gap.related_or_contradicting_evidence_refs) {
      const artifact = exactReference(
        reference,
        "EVIDENCE_ARTIFACT",
        evidence,
        global,
        issues,
        gap.id,
        "/related_or_contradicting_evidence_refs",
      );
      if (artifact === undefined) {
        continue;
      }
      if (artifact.profile_ref !== gap.profile_ref) {
        issue(
          issues,
          "CROSS_PROFILE_EVIDENCE",
          gap.id,
          "/related_or_contradicting_evidence_refs",
          "gap evidence belongs to another profile",
        );
      }
      const relation = relationFor(artifact, gap.requirement_ref);
      const expected =
        gap.classification === "PARTIAL"
          ? "PARTIAL"
          : gap.classification === "CONTRADICTED"
            ? "CONTRADICTS"
            : undefined;
      if (relation !== expected) {
        issue(
          issues,
          "GAP_CLASSIFICATION_INCOHERENT",
          gap.id,
          "/classification",
          "related evidence relation does not match gap classification",
        );
      }
    }
    const profileEvidence = corpus.evidenceArtifacts.filter(
      (artifact) => artifact.profile_ref === gap.profile_ref,
    );
    if (
      profileEvidence.some((artifact) => {
        const relation = relationFor(artifact, gap.requirement_ref);
        return relation !== undefined && positiveRelations.includes(relation);
      })
    ) {
      issue(
        issues,
        "GAP_HAS_SUPPORTING_EVIDENCE",
        gap.id,
        "/requirement_ref",
        "positive supporting relation exists for a declared gap",
      );
    }
    if (scenario !== undefined && scenario.profile_ref !== gap.profile_ref) {
      issue(
        issues,
        "RESULT_SCENARIO_PROFILE_MISMATCH",
        gap.id,
        "/profile_ref",
        "gap profile differs from scenario",
      );
    }
  }

  const scenariosByProfile = new Map<string, number>();
  for (const scenario of corpus.scenarioBundles) {
    const profile = exactReference(
      scenario.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      scenario.id,
      "/profile_ref",
    );
    const resume = exactReference(
      scenario.resume_ref,
      "SOURCE_RESUME",
      resumes,
      global,
      issues,
      scenario.id,
      "/resume_ref",
    );
    const job = exactReference(
      scenario.job_ref,
      "SYNTHETIC_JOB",
      jobs,
      global,
      issues,
      scenario.id,
      "/job_ref",
    );
    scenariosByProfile.set(
      scenario.profile_ref,
      (scenariosByProfile.get(scenario.profile_ref) ?? 0) + 1,
    );
    if (resume !== undefined && resume.profile_ref !== scenario.profile_ref) {
      issue(
        issues,
        "SCENARIO_RESUME_PROFILE_MISMATCH",
        scenario.id,
        "/resume_ref",
        "resume belongs to another profile",
      );
    }
    const expectedRequirementRefs = [
      ...(requirementsByJob.get(scenario.job_ref) ?? []),
    ].sort();
    const actualRequirementRefs = scenario.evaluations.map(
      (evaluation) => evaluation.requirement_ref,
    );
    if (
      actualRequirementRefs.join("\n") !== expectedRequirementRefs.join("\n")
    ) {
      issue(
        issues,
        "SCENARIO_REQUIREMENT_SET",
        scenario.id,
        "/evaluations",
        "evaluations must exactly cover sorted job requirements",
      );
    }
    for (const [index, evaluation] of scenario.evaluations.entries()) {
      resultUseCounts.set(
        evaluation.result_ref,
        (resultUseCounts.get(evaluation.result_ref) ?? 0) + 1,
      );
      const requirement = exactReference(
        evaluation.requirement_ref,
        "EXPECTED_REQUIREMENT",
        requirements,
        global,
        issues,
        scenario.id,
        pointerAt("/evaluations", index, "/requirement_ref"),
      );
      if (
        requirement !== undefined &&
        requirement.job_ref !== scenario.job_ref
      ) {
        issue(
          issues,
          "SCENARIO_REQUIREMENT_JOB_MISMATCH",
          scenario.id,
          pointerAt("/evaluations", index, "/requirement_ref"),
          "requirement belongs to another job",
        );
      }
      if (
        requirement !== undefined &&
        job !== undefined &&
        profile !== undefined &&
        (requirement.requirement_tag === "license:healthcare-operations" ||
          requirement.requirement_tag === "field:work_authorization" ||
          requirement.requirement_tag === "field:relocation_preference")
      ) {
        let expectedClassification: SupportClassification;
        if (requirement.requirement_tag === "license:healthcare-operations") {
          expectedClassification = corpus.evidenceArtifacts.some(
            (artifact) =>
              artifact.profile_ref === profile.id &&
              artifact.fact_keys.includes("license:healthcare-operations"),
          )
            ? "DIRECT"
            : "UNSUPPORTED";
        } else if (requirement.requirement_tag === "field:work_authorization") {
          expectedClassification =
            job.eligibility_constraint === "NO_SPONSORSHIP" &&
            profile.work_authorization.sponsorship_required
              ? "CONTRADICTED"
              : "USER_ASSERTED";
        } else {
          expectedClassification =
            job.work_mode !== "REMOTE" &&
            profile.constraints.relocation === "REMOTE_ONLY"
              ? "CONTRADICTED"
              : "USER_ASSERTED";
        }
        if (evaluation.classification !== expectedClassification) {
          issue(
            issues,
            "SCENARIO_CONSTRAINT_CLASSIFICATION",
            scenario.id,
            pointerAt("/evaluations", index, "/classification"),
            "classification disagrees with the explicit profile and job constraint records",
          );
        }
      }
      if (evaluation.result_type === "SUPPORTED_CLAIM") {
        const claim = exactReference(
          evaluation.result_ref,
          "EXPECTED_SUPPORTED_CLAIM",
          claims,
          global,
          issues,
          scenario.id,
          pointerAt("/evaluations", index, "/result_ref"),
        );
        const claimPolicy =
          claim?.field_policy_ref === undefined
            ? undefined
            : policies.get(claim.field_policy_ref);
        if (
          claim !== undefined &&
          (claim.scenario_ref !== scenario.id ||
            claim.requirement_ref !== evaluation.requirement_ref ||
            claim.support_classification !==
              (evaluation.classification as SupportedClassification) ||
            evaluation.expected_action !== actionForClaim(claim, claimPolicy))
        ) {
          issue(
            issues,
            "SCENARIO_RESULT_MISMATCH",
            scenario.id,
            pointerAt("/evaluations", index),
            "supported result link is incoherent",
          );
        }
      } else {
        const gap = exactReference(
          evaluation.result_ref,
          "UNSUPPORTED_GAP",
          gaps,
          global,
          issues,
          scenario.id,
          pointerAt("/evaluations", index, "/result_ref"),
        );
        if (
          gap !== undefined &&
          (gap.scenario_ref !== scenario.id ||
            gap.requirement_ref !== evaluation.requirement_ref ||
            gap.classification !== evaluation.classification ||
            evaluation.expected_action !== "ABSTAIN")
        ) {
          issue(
            issues,
            "SCENARIO_RESULT_MISMATCH",
            scenario.id,
            pointerAt("/evaluations", index),
            "gap result link is incoherent",
          );
        }
      }
    }
    const gapEvaluations = scenario.evaluations.filter(
      (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
    );
    const derivedOutcome = scenario.evaluations.some(
      (evaluation) => evaluation.classification === "CONTRADICTED",
    )
      ? "BLOCK_INELIGIBLE"
      : scenario.evaluations.some(
            (evaluation) => evaluation.expected_action === "BLOCK_AND_EXPLAIN",
          )
        ? "BLOCK_FIELD_POLICY"
        : scenario.evaluations.every(
              (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
            )
          ? "ABSTAIN"
          : scenario.evaluations.some(
                (evaluation) =>
                  evaluation.expected_action === "REQUIRE_CONFIRMATION",
              )
            ? "REQUIRE_CONFIRMATION"
            : "PROCEED_WITH_GAPS";
    if (scenario.expected_outcome !== derivedOutcome) {
      issue(
        issues,
        "SCENARIO_OUTCOME_INCOHERENT",
        scenario.id,
        "/expected_outcome",
        "outcome must be derived from contradiction and abstention composition",
      );
    }
    if (
      scenario.expected_outcome === "PROCEED_WITH_GAPS" &&
      gapEvaluations.length === 0
    ) {
      issue(
        issues,
        "SCENARIO_OUTCOME_INCOHERENT",
        scenario.id,
        "/expected_outcome",
        "proceed-with-gaps requires at least one explicit gap",
      );
    }
    if (
      scenario.expected_outcome === "ABSTAIN" &&
      scenario.evaluations.some(
        (evaluation) => evaluation.result_type === "SUPPORTED_CLAIM",
      )
    ) {
      issue(
        issues,
        "SCENARIO_OUTCOME_INCOHERENT",
        scenario.id,
        "/expected_outcome",
        "strongest-abstention scenario cannot contain a supported claim",
      );
    }
    if (
      profile !== undefined &&
      job !== undefined &&
      scenario.expected_outcome === "BLOCK_INELIGIBLE"
    ) {
      const sponsorshipBlock =
        job.eligibility_constraint === "NO_SPONSORSHIP" &&
        profile.work_authorization.sponsorship_required;
      const relocationBlock =
        job.work_mode !== "REMOTE" &&
        profile.constraints.relocation === "REMOTE_ONLY";
      if (!sponsorshipBlock && !relocationBlock) {
        issue(
          issues,
          "INELIGIBILITY_OUTCOME_INCOHERENT",
          scenario.id,
          "/expected_outcome",
          "profile is not blocked by a declared job constraint",
        );
      }
    }
  }
  for (const profile of corpus.profiles) {
    if ((scenariosByProfile.get(profile.id) ?? 0) !== 3) {
      issue(
        issues,
        "PROFILE_SCENARIO_CARDINALITY",
        profile.id,
        "/",
        "profile must have exactly three scenarios",
      );
    }
  }
  for (const result of [
    ...corpus.expectedSupportedClaims,
    ...corpus.unsupportedGaps,
  ]) {
    if ((resultUseCounts.get(result.id) ?? 0) !== 1) {
      issue(
        issues,
        "RESULT_OWNERSHIP",
        result.id,
        "/",
        "expected result must be referenced by exactly one evaluation",
      );
    }
  }
}

function checkFieldPolicies(
  corpus: FixtureCorpus,
  global: ReadonlyMap<string, FixtureEntity>,
  issues: FixtureValidationIssue[],
): void {
  const profiles = new Map(corpus.profiles.map((value) => [value.id, value]));
  const evidence = new Map(
    corpus.evidenceArtifacts.map((value) => [value.id, value]),
  );
  const counts = new Map<string, number>();
  const concepts = new Set<string>();
  for (const policy of corpus.fieldValuePolicies) {
    exactReference(
      policy.profile_ref,
      "SYNTHETIC_PROFILE",
      profiles,
      global,
      issues,
      policy.id,
      "/profile_ref",
    );
    const source = exactReference(
      policy.source_evidence_ref,
      "EVIDENCE_ARTIFACT",
      evidence,
      global,
      issues,
      policy.id,
      "/source_evidence_ref",
    );
    counts.set(policy.profile_ref, (counts.get(policy.profile_ref) ?? 0) + 1);
    const conceptKey = `${policy.profile_ref}:${policy.field_concept}`;
    if (concepts.has(conceptKey)) {
      issue(
        issues,
        "FIELD_POLICY_DUPLICATE",
        policy.id,
        "/field_concept",
        "profile field policy is duplicated",
      );
    }
    concepts.add(conceptKey);
    if (source !== undefined && source.profile_ref !== policy.profile_ref) {
      issue(
        issues,
        "CROSS_PROFILE_POLICY_SOURCE",
        policy.id,
        "/source_evidence_ref",
        "policy source belongs to another profile",
      );
    }
    const needsValue =
      policy.policy === "FILL_FROM_EXPLICIT_RECORD" ||
      policy.policy === "CONFIRM_ONCE_PER_JOB" ||
      policy.policy === "CONFIRM_IF_RECORD_EXPIRED";
    if (
      needsValue &&
      (policy.recorded_value === undefined || policy.recorded_value === "")
    ) {
      issue(
        issues,
        "CONSEQUENTIAL_VALUE_WITHOUT_SOURCE",
        policy.id,
        "/recorded_value",
        "policy requires an explicit recorded value",
      );
    }
    const forbidsValue =
      policy.policy === "NEVER_AUTOFILL" ||
      policy.policy === "VOLUNTARY_PREFER_NOT_TO_ANSWER" ||
      policy.policy === "BLOCK_AND_EXPLAIN";
    if (forbidsValue && policy.recorded_value !== undefined) {
      issue(
        issues,
        "INVALID_SENSITIVE_POLICY",
        policy.id,
        "/recorded_value",
        "non-fill policy cannot carry a silent default",
      );
    }
    if (
      policy.policy === "CONFIRM_IF_RECORD_EXPIRED" &&
      policy.record_expires_on === undefined
    ) {
      issue(
        issues,
        "EXPIRING_POLICY_WITHOUT_EXPIRY",
        policy.id,
        "/record_expires_on",
        "expiry confirmation requires a date",
      );
    }
    if (
      policy.policy !== "CONFIRM_IF_RECORD_EXPIRED" &&
      policy.record_expires_on !== undefined
    ) {
      issue(
        issues,
        "INVALID_SENSITIVE_POLICY",
        policy.id,
        "/record_expires_on",
        "only expiry-confirmation policy may carry an expiry",
      );
    }
    const expectedFactKey = `field:${policy.field_concept.toLowerCase()}`;
    if (source !== undefined && !source.fact_keys.includes(expectedFactKey)) {
      issue(
        issues,
        "POLICY_SOURCE_CONCEPT_MISMATCH",
        policy.id,
        "/source_evidence_ref",
        "source evidence does not encode the field concept",
      );
    }
    const fieldRecord = source?.field_records.find(
      (record) => record.field_concept === policy.field_concept,
    );
    if (
      source !== undefined &&
      (source.category !== "USER_ASSERTION" || fieldRecord === undefined)
    ) {
      issue(
        issues,
        "POLICY_SOURCE_CONCEPT_MISMATCH",
        policy.id,
        "/source_evidence_ref",
        "policy source lacks one matching atomic approved field record",
      );
    }
    if (
      policy.recorded_value !== undefined &&
      fieldRecord?.recorded_value !== policy.recorded_value
    ) {
      issue(
        issues,
        "POLICY_SOURCE_VALUE_MISMATCH",
        policy.id,
        "/recorded_value",
        "recorded value differs from the matching atomic source record",
      );
    }
    if (policy.consequential && source === undefined) {
      issue(
        issues,
        "CONSEQUENTIAL_VALUE_WITHOUT_SOURCE",
        policy.id,
        "/source_evidence_ref",
        "consequential policy requires explicit evidence",
      );
    }
  }
  for (const profile of corpus.profiles) {
    if ((counts.get(profile.id) ?? 0) !== 4) {
      issue(
        issues,
        "PROFILE_POLICY_CARDINALITY",
        profile.id,
        "/",
        "profile must have four field policies",
      );
    }
  }
}

function checkCoverage(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): void {
  const requiredFamilies: readonly RoleFamily[] = [
    "BUSINESS",
    "DATA",
    "EDUCATION",
    "ENTRY_LEVEL",
    "FINANCE",
    "HEALTHCARE",
    "OPERATIONS",
    "SALES",
    "SOFTWARE",
  ];
  for (const family of requiredFamilies) {
    if (!corpus.profiles.some((profile) => profile.role_family === family)) {
      issue(
        issues,
        "ROLE_FAMILY_MISSING",
        corpus.manifest.id,
        "/role_family_counts",
        `required role family ${family} is absent`,
      );
    }
  }
  const requiredTags = [
    "CAREER_SWITCHER",
    "EMPLOYMENT_GAP",
    "NONTRADITIONAL_EDUCATION",
    "RELOCATION_CONSTRAINT",
    "REQUIRES_SPONSORSHIP",
    "SENSITIVE_NEVER_AUTOFILL",
    "EXPLICIT_CONTRADICTION",
    "TWO_PAGE_RESUME",
    "STRONGEST_OUTCOME_ABSTENTION",
  ];
  const tags = new Set(
    corpus.profiles.flatMap((profile) => profile.coverage_tags),
  );
  for (const tag of requiredTags) {
    if (!tags.has(tag)) {
      issue(
        issues,
        "ADVERSARIAL_COVERAGE_MISSING",
        corpus.manifest.id,
        "/counts",
        `required coverage tag ${tag} is absent`,
      );
    }
  }
  const careerSwitcher = corpus.profiles.find((profile) =>
    profile.coverage_tags.includes("CAREER_SWITCHER"),
  );
  if (
    careerSwitcher === undefined ||
    !corpus.evidenceArtifacts.some(
      (artifact) =>
        artifact.profile_ref === careerSwitcher.id &&
        artifact.fact_keys.includes("career:prior-non-data-role") &&
        artifact.fact_keys.includes("career:transition"),
    )
  ) {
    issue(
      issues,
      "CAREER_SWITCH_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "career-switch coverage requires an explicit prior-role transition record",
    );
  }
  const licenseProfile = corpus.profiles.find((profile) =>
    profile.coverage_tags.includes("LICENSE_CONSTRAINT"),
  );
  if (
    licenseProfile === undefined ||
    !corpus.evidenceArtifacts.some(
      (artifact) =>
        artifact.profile_ref === licenseProfile.id &&
        artifact.fact_keys.includes("license:healthcare-operations"),
    ) ||
    !corpus.jobs.some(
      (job) => job.eligibility_constraint === "LICENSE_REQUIRED",
    )
  ) {
    issue(
      issues,
      "LICENSE_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "license coverage requires both an explicit credential and an anchored job constraint",
    );
  }
  const sensitiveProfile = corpus.profiles.find((profile) =>
    profile.coverage_tags.includes("SENSITIVE_NEVER_AUTOFILL"),
  );
  if (
    sensitiveProfile === undefined ||
    !corpus.fieldValuePolicies.some(
      (policy) =>
        policy.profile_ref === sensitiveProfile.id &&
        policy.sensitivity === "SENSITIVE" &&
        policy.policy === "NEVER_AUTOFILL",
    )
  ) {
    issue(
      issues,
      "SENSITIVE_NEVER_AUTOFILL_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "coverage tag requires a matching sensitive never-autofill policy",
    );
  }
  const workModes = new Set(corpus.jobs.map((job) => job.work_mode));
  if (workModes.size !== 3) {
    issue(
      issues,
      "WORK_MODE_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "remote, hybrid, and on-site jobs are required",
    );
  }
  const actualEvidenceCounts = {
    CREDENTIAL_RECORD: corpus.evidenceArtifacts.filter(
      (item) => item.category === "CREDENTIAL_RECORD",
    ).length,
    EDUCATION_RECORD: corpus.evidenceArtifacts.filter(
      (item) => item.category === "EDUCATION_RECORD",
    ).length,
    EMPLOYMENT_RECORD: corpus.evidenceArtifacts.filter(
      (item) => item.category === "EMPLOYMENT_RECORD",
    ).length,
    PROJECT_RECORD: corpus.evidenceArtifacts.filter(
      (item) => item.category === "PROJECT_RECORD",
    ).length,
    USER_ASSERTION: corpus.evidenceArtifacts.filter(
      (item) => item.category === "USER_ASSERTION",
    ).length,
  };
  if (
    JSON.stringify(actualEvidenceCounts) !==
    JSON.stringify(corpus.manifest.evidence_category_counts)
  ) {
    issue(
      issues,
      "MANIFEST_EVIDENCE_COUNTS",
      corpus.manifest.id,
      "/evidence_category_counts",
      "manifest evidence category counts do not match data",
    );
  }
  const actualRoleCounts = Object.fromEntries(
    requiredFamilies.map((family) => [
      family,
      corpus.profiles.filter((profile) => profile.role_family === family)
        .length,
    ]),
  );
  if (
    JSON.stringify(actualRoleCounts) !==
    JSON.stringify(corpus.manifest.role_family_counts)
  ) {
    issue(
      issues,
      "MANIFEST_ROLE_COUNTS",
      corpus.manifest.id,
      "/role_family_counts",
      "manifest role family counts do not match data",
    );
  }
  if (
    new Set(corpus.profiles.map((profile) => profile.career_stage)).size < 2
  ) {
    issue(
      issues,
      "CAREER_STAGE_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "at least two career stages are required",
    );
  }
  if (
    new Set(
      corpus.scenarioBundles.map(
        (scenario) => `${scenario.profile_ref}:${scenario.job_ref}`,
      ),
    ).size !== corpus.scenarioBundles.length
  ) {
    issue(
      issues,
      "SCENARIO_PAIR_DUPLICATE",
      corpus.manifest.id,
      "/counts",
      "profile-job scenario pairs must be unique",
    );
  }
  const usedJobs = new Set(
    corpus.scenarioBundles.map((scenario) => scenario.job_ref),
  );
  if (usedJobs.size !== corpus.jobs.length) {
    issue(
      issues,
      "JOB_SCENARIO_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "every job must appear in a scenario",
    );
  }
  const classifications = new Set(
    corpus.scenarioBundles.flatMap((scenario) =>
      scenario.evaluations.map((evaluation) => evaluation.classification),
    ),
  );
  for (const expected of [
    "DIRECT",
    "STRONG_RELATED",
    "PARTIAL",
    "USER_ASSERTED",
    "UNSUPPORTED",
    "CONTRADICTED",
  ]) {
    if (!classifications.has(expected as never)) {
      issue(
        issues,
        "CLASSIFICATION_COVERAGE",
        corpus.manifest.id,
        "/counts",
        `classification ${expected} is absent`,
      );
    }
  }
  if (
    !corpus.scenarioBundles.some(
      (scenario) => scenario.expected_outcome === "ABSTAIN",
    )
  ) {
    issue(
      issues,
      "ABSTENTION_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "an abstention outcome is required",
    );
  }
}

export function validateFixtureConsistency(
  corpus: FixtureCorpus,
): FixtureValidationReport {
  const issues: FixtureValidationIssue[] = [];
  const entities = allEntities(corpus);
  const global = new Map(entities.map((entity) => [entity.id, entity]));
  checkMetadata(corpus, issues);
  checkProfileEvidenceAndResumes(corpus, global, issues);
  checkJobsAndRequirements(corpus, global, issues);
  checkEvidenceRelations(corpus, global, issues);
  checkScenariosAndResults(corpus, global, issues);
  checkFieldPolicies(corpus, global, issues);
  checkCoverage(corpus, issues);
  const counts = {
    profiles: corpus.profiles.length,
    evidence_artifacts: corpus.evidenceArtifacts.length,
    source_resumes: corpus.sourceResumes.length,
    jobs: corpus.jobs.length,
    expected_requirements: corpus.expectedRequirements.length,
    expected_supported_claims: corpus.expectedSupportedClaims.length,
    unsupported_gaps: corpus.unsupportedGaps.length,
    field_value_policies: corpus.fieldValuePolicies.length,
    scenario_bundles: corpus.scenarioBundles.length,
    scenario_evaluations: corpus.scenarioBundles.reduce(
      (sum, scenario) => sum + scenario.evaluations.length,
      0,
    ),
  };
  if (JSON.stringify(counts) !== JSON.stringify(EXPECTED_SEED_COUNTS)) {
    issue(
      issues,
      "EXACT_SEED_COUNT",
      corpus.manifest.id,
      "/counts",
      "exact development seed counts changed",
    );
  }
  return { valid: issues.length === 0, issues, counts };
}

export function assertFixtureConsistency(corpus: FixtureCorpus): void {
  const report = validateFixtureConsistency(corpus);
  if (!report.valid) {
    throw new FixtureConsistencyError(report.issues);
  }
}
