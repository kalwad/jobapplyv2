import { sha256Bytes } from "./canonical-json.ts";
import { safeDiagnosticPointer, safeDiagnosticToken } from "./diagnostics.ts";
import {
  type EvidenceArtifact,
  type EvidenceRelation,
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
  issues.push({
    code,
    entityId: safeDiagnosticToken(entityId),
    pointer: safeDiagnosticPointer(pointer),
    detail,
  });
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

function checkNestedStableIds(
  corpus: FixtureCorpus,
  issues: FixtureValidationIssue[],
): void {
  const seen = new Map<string, string>();
  const register = (
    id: string,
    ownerId: string,
    pointer: string,
    code: string,
  ): void => {
    const prior = seen.get(id);
    if (prior !== undefined) {
      issue(
        issues,
        code,
        ownerId,
        pointer,
        "nested stable ID is already owned by another reviewed member",
      );
    } else {
      seen.set(id, `${ownerId}${pointer}`);
    }
  };
  for (const resume of corpus.sourceResumes) {
    resume.facts.forEach((fact, index) => {
      register(
        fact.fact_id,
        resume.id,
        pointerAt("/facts", index, "/fact_id"),
        "RESUME_FACT_ID_DUPLICATE",
      );
    });
  }
  for (const artifact of corpus.evidenceArtifacts) {
    artifact.field_records.forEach((record, index) => {
      register(
        record.field_record_id,
        artifact.id,
        pointerAt("/field_records", index, "/field_record_id"),
        "FIELD_RECORD_ID_DUPLICATE",
      );
    });
  }
  for (const job of corpus.jobs) {
    job.source_blocks.forEach((block, index) => {
      register(
        block.anchor_id,
        job.id,
        pointerAt("/source_blocks", index, "/anchor_id"),
        "SOURCE_ANCHOR_DUPLICATE",
      );
    });
  }
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
  const leftEnd = left.effective_period.end;
  const rightEnd = right.effective_period.end;
  if (leftEnd === undefined || rightEnd === undefined) {
    return false;
  }
  return (
    dateValue(left.effective_period.start) <= dateValue(rightEnd) &&
    dateValue(right.effective_period.start) <= dateValue(leftEnd)
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
        .expected_result_provenance !== "M02W01_SYNTHETIC_AUTHORING_REVIEW"
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
        "AUTHOR_REVIEWER_ROLE_REUSED",
        value.id,
        "/metadata/reviewer",
        "fixture author and recorded reviewer role labels must differ; this is provenance hygiene, not independent certification",
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
  for (const profile of corpus.profiles) {
    const status: string = profile.work_authorization.status;
    const sponsorshipRequired: boolean =
      profile.work_authorization.sponsorship_required;
    const pairIsCoherent =
      (status === "AUTHORIZED" && !sponsorshipRequired) ||
      (status === "REQUIRES_SPONSORSHIP" && sponsorshipRequired);
    if (!pairIsCoherent) {
      issue(
        issues,
        "WORK_AUTHORIZATION_COUPLING",
        profile.id,
        "/work_authorization",
        "authorization status and sponsorship boolean must be the reviewed pair",
      );
    }
  }
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
      artifact.effective_period.end !== undefined &&
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
    const expectedTemporal =
      artifact.category === "CREDENTIAL_RECORD"
        ? "CREDENTIAL_VALIDITY"
        : artifact.category === "EDUCATION_RECORD"
          ? "EDUCATION_ATTENDANCE"
          : artifact.category === "USER_ASSERTION"
            ? "ASSERTION_FRESHNESS"
            : "ACTIVITY_INTERVAL";
    if (artifact.temporal_semantics !== expectedTemporal) {
      issue(
        issues,
        "TEMPORAL_SEMANTICS_CATEGORY_MISMATCH",
        artifact.id,
        "/temporal_semantics",
        "temporal semantics must be category specific",
      );
    }
    if (
      artifact.category === "CREDENTIAL_RECORD" &&
      (artifact.credential_validity_basis === undefined ||
        (artifact.credential_validity_basis === "BOUNDED" &&
          artifact.effective_period.end === undefined) ||
        (artifact.credential_validity_basis !== "BOUNDED" &&
          artifact.effective_period.end !== undefined))
    ) {
      issue(
        issues,
        "CREDENTIAL_VALIDITY_SHAPE",
        artifact.id,
        "/credential_validity_basis",
        "bounded credentials require an end; non-expiring and unknown credentials must not invent one",
      );
    }
    if (
      artifact.category === "EDUCATION_RECORD" &&
      artifact.education_state === undefined
    ) {
      issue(
        issues,
        "EDUCATION_STATE_MISSING",
        artifact.id,
        "/education_state",
        "education attendance requires an explicit completion state",
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
        concepts.length !== 5 ||
        new Set(concepts).size !== 5 ||
        new Set(artifact.field_records.map((record) => record.field_record_id))
          .size !== 5 ||
        !artifact.fact_keys.includes("assertion:approved")
      ) {
        issue(
          issues,
          "ATOMIC_FIELD_RECORDS_INCOMPLETE",
          artifact.id,
          "/field_records",
          "approved user assertion must contain five unique atomic field records",
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
        const previousEnd = employment[index]?.effective_period.end;
        return (
          previousEnd !== undefined &&
          monthGap(previousEnd, item.effective_period.start) >= 180
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
        education.effective_period.end !== undefined &&
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
        if (!fact.text.startsWith(artifact.statement)) {
          issue(
            issues,
            "RESUME_FACT_MUTATED",
            resume.id,
            pointerAt("/facts", index, "/text"),
            "resume text must begin with canonical evidence and may only add reviewed fixture detail",
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
          dateValue(artifact.effective_period.start) > dateValue(resume.as_of)
        ) {
          issue(
            issues,
            "RESUME_AS_OF_CONTRADICTION",
            resume.id,
            pointerAt("/facts", index, "/evidence_refs"),
            "resume cites evidence that did not yet exist at its as-of date",
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
    if (resume.page_count === 2) {
      const pageTwoFacts = resume.facts.filter((fact) => fact.page === 2);
      const breakIndex = resume.facts.findIndex(
        (fact) => fact.fact_id === resume.page_boundary?.break_after_fact_id,
      );
      if (
        resume.page_boundary === undefined ||
        resume.page_boundary.rationale.length < 30 ||
        pageTwoFacts.length < 3 ||
        breakIndex < 0 ||
        resume.facts.slice(0, breakIndex + 1).some((fact) => fact.page !== 1) ||
        resume.facts.slice(breakIndex + 1).some((fact) => fact.page !== 2)
      ) {
        issue(
          issues,
          "RESUME_PAGE_BOUNDARY_RATIONALE",
          resume.id,
          "/page_boundary",
          "two-page resume requires an exact break, rationale, and at least three substantive page-two facts",
        );
      }
    } else if (resume.page_boundary !== undefined) {
      issue(
        issues,
        "RESUME_PAGE_BOUNDARY_RATIONALE",
        resume.id,
        "/page_boundary",
        "one-page resume must not declare a page boundary",
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
  const canonicalSourceText = (
    block: (typeof corpus.jobs)[number]["source_blocks"][number],
  ): string =>
    [
      `Requirement ${block.requirement_kind}`,
      `tagged ${block.requirement_tag}`,
      `constraint ${block.constraint.kind}=${block.constraint.value}`,
      `importance ${block.declared_importance}.`,
    ].join("; ");
  for (const job of corpus.jobs) {
    if (
      (job.work_mode === "REMOTE" &&
        job.location !== "Remote - United States") ||
      (job.work_mode !== "REMOTE" && job.location !== "Exampleville, MI")
    ) {
      issue(
        issues,
        "WORK_MODE_LOCATION_COUPLING",
        job.id,
        "/location",
        "remote and place-based work modes require their reviewed location pair",
      );
    }
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
      if (block.text !== canonicalSourceText(block)) {
        issue(
          issues,
          "SOURCE_STRUCTURED_SEMANTICS_DRIFT",
          job.id,
          pointerAt("/source_blocks", index, "/text"),
          "source prose must be the canonical rendering of structured semantics",
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
      if (
        block.requirement_kind !== requirement.requirement_kind ||
        block.requirement_tag !== requirement.requirement_tag ||
        block.text !== requirement.normalized_text ||
        JSON.stringify(block.constraint) !==
          JSON.stringify(requirement.constraint)
      ) {
        issue(
          issues,
          "SOURCE_STRUCTURED_SEMANTICS_MISMATCH",
          requirement.id,
          "/requirement_kind",
          "expected requirement must exactly bind source kind, tag, constraint, and canonical text",
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
      !jobRequirements.some((item) => item.importance === "MUST_HAVE")
    ) {
      issue(
        issues,
        "JOB_REQUIREMENT_COVERAGE",
        job.id,
        "/",
        "job needs three requirements and at least one must-have",
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
      experience.constraint.kind === "MINIMUM_EXPERIENCE_YEARS" &&
      experience.constraint.value === String(job.minimum_experience_years);
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
            constraintKind: "CURRENT_LICENSE",
            constraintValue: "CURRENT_AT_EVALUATION_DATE",
          }
        : job.eligibility_constraint === "NO_SPONSORSHIP"
          ? {
              kind: "ELIGIBILITY",
              tag: "field:sponsorship_requirement",
              constraintKind: "SPONSORSHIP",
              constraintValue: "NO_SPONSORSHIP",
            }
          : job.eligibility_constraint === "AUTHORIZED_TO_WORK_IN_US"
            ? {
                kind: "ELIGIBILITY",
                tag: "field:work_authorization",
                constraintKind: "WORK_AUTHORIZATION",
                constraintValue: "AUTHORIZED_TO_WORK_IN_US",
              }
            : {
                kind: "LOCATION",
                tag: "field:relocation_preference",
                constraintKind: "WORK_MODE_COMPATIBILITY",
                constraintValue: job.work_mode,
              };
    const constraintIsSourceLinked =
      constraint?.requirement_kind === expectedConstraint.kind &&
      constraint.requirement_tag === expectedConstraint.tag &&
      constraint.constraint.kind === expectedConstraint.constraintKind &&
      constraint.constraint.value === expectedConstraint.constraintValue;
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

type CredentialState =
  "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "REVOKED" | "UNKNOWN";

function credentialStateAt(
  artifact: EvidenceArtifact,
  evaluationDate: string,
): CredentialState | undefined {
  if (
    artifact.category !== "CREDENTIAL_RECORD" ||
    artifact.credential_validity_basis === undefined
  ) {
    return undefined;
  }
  if (
    artifact.revoked_on !== undefined &&
    artifact.revoked_on <= evaluationDate
  ) {
    return "REVOKED";
  }
  if (evaluationDate < artifact.effective_period.start) {
    return "NOT_YET_VALID";
  }
  if (artifact.credential_validity_basis === "UNKNOWN") {
    return "UNKNOWN";
  }
  if (
    artifact.credential_validity_basis === "BOUNDED" &&
    artifact.effective_period.end !== undefined &&
    evaluationDate > artifact.effective_period.end
  ) {
    return "EXPIRED";
  }
  return "CURRENT";
}

function policyExpectedAction(
  policy: FieldValuePolicy,
  source: EvidenceArtifact,
  evaluationDate: string,
): ScenarioBundle["evaluations"][number]["expected_action"] {
  if (policy.policy === "FILL_FROM_EXPLICIT_RECORD") {
    return "USE_SUPPORTED_EVIDENCE";
  }
  if (policy.policy === "CONFIRM_ONCE_PER_JOB") {
    return "REQUIRE_CONFIRMATION";
  }
  if (
    policy.policy === "BLOCK_AND_EXPLAIN" ||
    policy.policy === "NEVER_AUTOFILL"
  ) {
    return "BLOCK_AND_EXPLAIN";
  }
  if (policy.policy === "VOLUNTARY_PREFER_NOT_TO_ANSWER") {
    return "ABSTAIN";
  }
  if (policy.field_concept === "LICENSE_VALIDITY") {
    return credentialStateAt(source, evaluationDate) === "CURRENT"
      ? "USE_SUPPORTED_EVIDENCE"
      : "REQUIRE_CONFIRMATION";
  }
  const record = source.field_records.find(
    (item) => item.field_record_id === policy.source_field_record_id,
  );
  return record?.valid_through !== undefined &&
    record.valid_through >= evaluationDate
    ? "USE_SUPPORTED_EVIDENCE"
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
  const policyUseCounts = new Map<string, number>();
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
      if (policy !== undefined && scenario !== undefined) {
        const source = evidence.get(policy.source_evidence_ref);
        const expectedAction =
          source === undefined
            ? undefined
            : policyExpectedAction(policy, source, scenario.evaluation_date);
        if (
          expectedAction !== undefined &&
          claim.release_eligible !==
            (expectedAction === "USE_SUPPORTED_EVIDENCE")
        ) {
          issue(
            issues,
            "CLAIM_POLICY_RELEASE_MISMATCH",
            claim.id,
            "/release_eligible",
            "claim release state must be derived from source freshness at the scenario evaluation date",
          );
        }
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
    const resolvedClaimEvidence: EvidenceArtifact[] = [];
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
      resolvedClaimEvidence.push(artifact);
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
    if (
      claim.support_classification === "DIRECT" &&
      requirement?.requirement_kind === "EXPERIENCE"
    ) {
      const job = jobs.get(requirement.job_ref);
      const scenarioDate = scenario?.evaluation_date;
      const intervals = resolvedClaimEvidence
        .flatMap((artifact) => {
          const end = artifact.effective_period.end;
          if (artifact.category !== "EMPLOYMENT_RECORD" || end === undefined) {
            return [];
          }
          return [
            {
              start: dateValue(artifact.effective_period.start),
              end: dateValue(
                scenarioDate === undefined || end < scenarioDate
                  ? end
                  : scenarioDate,
              ),
            },
          ];
        })
        .sort((left, right) => left.start - right.start);
      let coveredDays = 0;
      let cursorStart: number | undefined;
      let cursorEnd: number | undefined;
      for (const interval of intervals) {
        if (cursorStart === undefined || cursorEnd === undefined) {
          cursorStart = interval.start;
          cursorEnd = interval.end;
        } else if (interval.start <= cursorEnd) {
          cursorEnd = Math.max(cursorEnd, interval.end);
        } else {
          coveredDays += (cursorEnd - cursorStart) / (1000 * 60 * 60 * 24) + 1;
          cursorStart = interval.start;
          cursorEnd = interval.end;
        }
      }
      if (cursorStart !== undefined && cursorEnd !== undefined) {
        coveredDays += (cursorEnd - cursorStart) / (1000 * 60 * 60 * 24) + 1;
      }
      if (
        job === undefined ||
        coveredDays < job.minimum_experience_years * 365
      ) {
        issue(
          issues,
          "DIRECT_EXPERIENCE_THRESHOLD_MISMATCH",
          claim.id,
          "/evidence_refs",
          "non-overlapping dated direct evidence does not meet the anchored experience threshold",
        );
      }
    }
    if (
      claim.support_classification === "DIRECT" &&
      requirement?.requirement_kind === "CERTIFICATION" &&
      scenario !== undefined &&
      resolvedClaimEvidence.some(
        (artifact) =>
          credentialStateAt(artifact, scenario.evaluation_date) !== "CURRENT",
      )
    ) {
      issue(
        issues,
        "DIRECT_CREDENTIAL_NOT_CURRENT",
        claim.id,
        "/evidence_refs",
        "direct credential evidence must be current at the scenario evaluation date",
      );
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
    const reasonIsCoherent =
      (gap.reason_code === "CREDENTIAL_EXPIRED" &&
        gap.classification === "PARTIAL" &&
        gap.expected_action === "REQUIRE_CONFIRMATION") ||
      (gap.reason_code === "CREDENTIAL_NOT_CURRENT" &&
        (gap.classification === "CONTRADICTED" ||
          gap.classification === "UNSUPPORTED") &&
        (gap.expected_action === "BLOCK_AND_EXPLAIN" ||
          gap.expected_action === "REQUIRE_CONFIRMATION")) ||
      (gap.reason_code === "CONTRADICTED_BY_EXPLICIT_RECORD" &&
        gap.classification === "CONTRADICTED" &&
        gap.expected_action === "BLOCK_AND_EXPLAIN") ||
      (gap.reason_code === "INSUFFICIENT_DIRECT_EVIDENCE" &&
        gap.classification === "PARTIAL" &&
        gap.expected_action === "ABSTAIN") ||
      (gap.reason_code === "NO_SUPPORTING_EVIDENCE" &&
        gap.classification === "UNSUPPORTED" &&
        gap.expected_action === "ABSTAIN");
    if (!reasonIsCoherent) {
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
        gap.reason_code !== "CREDENTIAL_NOT_CURRENT" &&
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
    if (resume !== undefined && scenario.evaluation_date !== resume.as_of) {
      issue(
        issues,
        "SCENARIO_EVALUATION_DATE_MISMATCH",
        scenario.id,
        "/evaluation_date",
        "scenario evaluation date must equal the bound resume as-of date",
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
        (requirement.constraint.kind === "CURRENT_LICENSE" ||
          requirement.constraint.kind === "WORK_AUTHORIZATION" ||
          requirement.constraint.kind === "SPONSORSHIP" ||
          requirement.constraint.kind === "WORK_MODE_COMPATIBILITY")
      ) {
        let expectedClassification: SupportClassification;
        if (requirement.constraint.kind === "CURRENT_LICENSE") {
          const matching = corpus.evidenceArtifacts.filter(
            (artifact) =>
              artifact.profile_ref === profile.id &&
              artifact.category === "CREDENTIAL_RECORD" &&
              artifact.fact_keys.includes(requirement.requirement_tag),
          );
          const states = matching.map((artifact) =>
            credentialStateAt(artifact, scenario.evaluation_date),
          );
          expectedClassification = states.includes("CURRENT")
            ? "DIRECT"
            : matching.length === 0
              ? "UNSUPPORTED"
              : states.includes("EXPIRED")
                ? "PARTIAL"
                : states.includes("UNKNOWN")
                  ? "UNSUPPORTED"
                  : "CONTRADICTED";
        } else if (requirement.constraint.kind === "WORK_AUTHORIZATION") {
          expectedClassification =
            profile.work_authorization.status !== "AUTHORIZED"
              ? "CONTRADICTED"
              : "USER_ASSERTED";
        } else if (requirement.constraint.kind === "SPONSORSHIP") {
          expectedClassification = profile.work_authorization
            .sponsorship_required
            ? "CONTRADICTED"
            : "USER_ASSERTED";
        } else {
          expectedClassification =
            requirement.constraint.value !== "REMOTE" &&
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
        const claimPolicySource =
          claimPolicy === undefined
            ? undefined
            : evidence.get(claimPolicy.source_evidence_ref);
        const expectedAction =
          claimPolicy === undefined || claimPolicySource === undefined
            ? "USE_SUPPORTED_EVIDENCE"
            : policyExpectedAction(
                claimPolicy,
                claimPolicySource,
                scenario.evaluation_date,
              );
        if (
          claim !== undefined &&
          (claim.scenario_ref !== scenario.id ||
            claim.requirement_ref !== evaluation.requirement_ref ||
            claim.support_classification !==
              (evaluation.classification as SupportedClassification) ||
            evaluation.expected_action !== expectedAction ||
            claim.release_eligible !==
              (expectedAction === "USE_SUPPORTED_EVIDENCE"))
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
            evaluation.expected_action !== gap.expected_action)
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
    const seenPolicyRefs = new Set<string>();
    for (const [index, evaluation] of scenario.policy_evaluations.entries()) {
      policyUseCounts.set(
        evaluation.policy_ref,
        (policyUseCounts.get(evaluation.policy_ref) ?? 0) + 1,
      );
      const policy = exactReference(
        evaluation.policy_ref,
        "FIELD_VALUE_POLICY",
        policies,
        global,
        issues,
        scenario.id,
        pointerAt("/policy_evaluations", index, "/policy_ref"),
      );
      const source =
        policy === undefined
          ? undefined
          : exactReference(
              evaluation.source_evidence_ref,
              "EVIDENCE_ARTIFACT",
              evidence,
              global,
              issues,
              scenario.id,
              pointerAt("/policy_evaluations", index, "/source_evidence_ref"),
            );
      if (seenPolicyRefs.has(evaluation.policy_ref)) {
        issue(
          issues,
          "SCENARIO_POLICY_DUPLICATE",
          scenario.id,
          pointerAt("/policy_evaluations", index),
          "a policy may be evaluated once per scenario",
        );
      }
      seenPolicyRefs.add(evaluation.policy_ref);
      if (
        policy !== undefined &&
        source !== undefined &&
        (policy.profile_ref !== scenario.profile_ref ||
          policy.source_evidence_ref !== source.id ||
          policy.field_concept !== evaluation.field_concept ||
          evaluation.expected_action !==
            policyExpectedAction(policy, source, scenario.evaluation_date) ||
          evaluation.release_eligible !==
            (evaluation.expected_action === "USE_SUPPORTED_EVIDENCE"))
      ) {
        issue(
          issues,
          "SCENARIO_POLICY_MISMATCH",
          scenario.id,
          pointerAt("/policy_evaluations", index),
          "policy decision must bind the profile, source, concept, freshness, action, and release state",
        );
      }
    }
    const gapEvaluations = scenario.evaluations.filter(
      (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
    );
    const allActions = [
      ...scenario.evaluations.map((evaluation) => evaluation.expected_action),
      ...scenario.policy_evaluations.map(
        (evaluation) => evaluation.expected_action,
      ),
    ];
    const derivedOutcome = scenario.evaluations.some(
      (evaluation) => evaluation.classification === "CONTRADICTED",
    )
      ? "BLOCK_INELIGIBLE"
      : allActions.includes("BLOCK_AND_EXPLAIN")
        ? "BLOCK_FIELD_POLICY"
        : scenario.evaluations.every(
              (evaluation) => evaluation.result_type === "UNSUPPORTED_GAP",
            ) &&
            scenario.policy_evaluations.every(
              (evaluation) => evaluation.expected_action === "ABSTAIN",
            )
          ? "ABSTAIN"
          : allActions.includes("REQUIRE_CONFIRMATION")
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
      const authorizationBlock =
        job.eligibility_constraint === "AUTHORIZED_TO_WORK_IN_US" &&
        profile.work_authorization.status !== "AUTHORIZED";
      const licenseRequirement = corpus.expectedRequirements.find(
        (requirement) =>
          requirement.job_ref === job.id &&
          requirement.constraint.kind === "CURRENT_LICENSE",
      );
      const licenseBlock =
        licenseRequirement !== undefined &&
        corpus.evidenceArtifacts.some(
          (artifact) =>
            artifact.profile_ref === profile.id &&
            artifact.fact_keys.includes(licenseRequirement.requirement_tag) &&
            ["NOT_YET_VALID", "REVOKED"].includes(
              credentialStateAt(artifact, scenario.evaluation_date) ?? "",
            ),
        );
      if (
        !sponsorshipBlock &&
        !relocationBlock &&
        !authorizationBlock &&
        !licenseBlock
      ) {
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
  for (const policy of corpus.fieldValuePolicies) {
    if ((policyUseCounts.get(policy.id) ?? 0) !== 1) {
      issue(
        issues,
        "POLICY_EXERCISE_CARDINALITY",
        policy.id,
        "/",
        "every committed field policy must be exercised by exactly one scenario policy evaluation",
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
  const conceptMatrix = {
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
      allowed: ["BLOCK_AND_EXPLAIN", "CONFIRM_ONCE_PER_JOB", "NEVER_AUTOFILL"],
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
  } as const;
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
    const expectedPolicy = conceptMatrix[policy.field_concept];
    if (
      policy.sensitivity !== expectedPolicy.sensitivity ||
      policy.consequential !== expectedPolicy.consequential ||
      !expectedPolicy.allowed.includes(policy.policy as never)
    ) {
      issue(
        issues,
        "FIELD_POLICY_CONCEPT_MATRIX",
        policy.id,
        "/field_concept",
        "field concept must use its exact sensitivity, consequence, and allowed-policy matrix",
      );
    }
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
      policy.field_concept !== "LICENSE_VALIDITY" &&
      (policy.policy === "FILL_FROM_EXPLICIT_RECORD" ||
        policy.policy === "CONFIRM_ONCE_PER_JOB" ||
        policy.policy === "CONFIRM_IF_RECORD_EXPIRED");
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
    const expectedFactKey = `field:${policy.field_concept.toLowerCase()}`;
    const fieldRecord = source?.field_records.find(
      (record) => record.field_record_id === policy.source_field_record_id,
    );
    const sourceIsCoherent =
      policy.field_concept === "LICENSE_VALIDITY"
        ? source?.category === "CREDENTIAL_RECORD" &&
          policy.source_field_record_id === undefined &&
          source.credential_validity_basis !== undefined
        : source?.category === "USER_ASSERTION" &&
          source.fact_keys.includes(expectedFactKey) &&
          fieldRecord?.field_concept === policy.field_concept;
    if (source !== undefined && !sourceIsCoherent) {
      issue(
        issues,
        "POLICY_SOURCE_CONCEPT_MISMATCH",
        policy.id,
        "/source_evidence_ref",
        "policy source lacks one matching atomic approved field record",
      );
    }
    if (
      policy.policy === "CONFIRM_IF_RECORD_EXPIRED" &&
      policy.field_concept !== "LICENSE_VALIDITY" &&
      fieldRecord?.valid_through === undefined
    ) {
      issue(
        issues,
        "EXPIRING_POLICY_WITHOUT_EXPIRY",
        policy.id,
        "/source_field_record_id",
        "expiry confirmation requires source-record freshness",
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
    const hasCredential = corpus.evidenceArtifacts.some(
      (artifact) =>
        artifact.profile_ref === profile.id &&
        artifact.category === "CREDENTIAL_RECORD",
    );
    const expectedCount = hasCredential ? 6 : 5;
    if ((counts.get(profile.id) ?? 0) !== expectedCount) {
      issue(
        issues,
        "PROFILE_POLICY_CARDINALITY",
        profile.id,
        "/",
        `profile must have ${String(expectedCount)} reviewed concept policies`,
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
  const topologySignatures = new Set(
    corpus.profiles.map((profile) => {
      const profileEvidence = corpus.evidenceArtifacts.filter(
        (artifact) => artifact.profile_ref === profile.id,
      );
      return [
        "EMPLOYMENT_RECORD",
        "PROJECT_RECORD",
        "CREDENTIAL_RECORD",
        "EDUCATION_RECORD",
        "USER_ASSERTION",
      ]
        .map(
          (category) =>
            `${category}:${String(
              profileEvidence.filter(
                (artifact) => artifact.category === category,
              ).length,
            )}`,
        )
        .join("|");
    }),
  );
  if (topologySignatures.size < 4) {
    issue(
      issues,
      "EVIDENCE_TOPOLOGY_DIVERSITY",
      corpus.manifest.id,
      "/counts",
      "at least four materially distinct evidence topologies are required",
    );
  }
  const resumeFactCounts = corpus.sourceResumes.map(
    (resume) => resume.facts.length,
  );
  if (
    new Set(resumeFactCounts).size < 4 ||
    Math.max(...resumeFactCounts) - Math.min(...resumeFactCounts) < 3
  ) {
    issue(
      issues,
      "RESUME_FACT_DIVERSITY",
      corpus.manifest.id,
      "/counts",
      "resume fact counts require at least four sizes spanning three facts",
    );
  }
  const jobShapeSignatures = new Set(
    corpus.jobs.map((job) =>
      job.source_blocks
        .map(
          (block) =>
            `${block.requirement_kind}:${block.declared_importance}:${block.constraint.kind}:${block.constraint.value}`,
        )
        .join("|"),
    ),
  );
  if (jobShapeSignatures.size < 12) {
    issue(
      issues,
      "JOB_SHAPE_DIVERSITY",
      corpus.manifest.id,
      "/counts",
      "twenty-four jobs require at least twelve structured requirement shapes",
    );
  }
  const multiEvidenceClaims = corpus.expectedSupportedClaims.filter(
    (claim) => claim.evidence_refs.length >= 2,
  );
  if (
    multiEvidenceClaims.length < 8 ||
    multiEvidenceClaims.filter((claim) => claim.evidence_refs.length >= 3)
      .length < 2
  ) {
    issue(
      issues,
      "MULTI_EVIDENCE_CLAIM_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "at least eight multi-evidence claims and two three-evidence claims are required",
    );
  }
  const policyConcepts = new Set(
    corpus.fieldValuePolicies.map((policy) => policy.field_concept),
  );
  for (const concept of [
    "DEMOGRAPHIC_DISCLOSURE",
    "LICENSE_VALIDITY",
    "RELOCATION_PREFERENCE",
    "SALARY_EXPECTATION",
    "SPONSORSHIP_REQUIREMENT",
    "WORK_AUTHORIZATION",
  ]) {
    if (!policyConcepts.has(concept as never)) {
      issue(
        issues,
        "POLICY_CONCEPT_COVERAGE",
        corpus.manifest.id,
        "/counts",
        `policy concept ${concept} is absent`,
      );
    }
  }
  const policyKinds = new Set(
    corpus.fieldValuePolicies.map((policy) => policy.policy),
  );
  for (const kind of [
    "NEVER_AUTOFILL",
    "BLOCK_AND_EXPLAIN",
    "CONFIRM_ONCE_PER_JOB",
    "CONFIRM_IF_RECORD_EXPIRED",
    "FILL_FROM_EXPLICIT_RECORD",
    "VOLUNTARY_PREFER_NOT_TO_ANSWER",
  ]) {
    if (!policyKinds.has(kind as never)) {
      issue(
        issues,
        "POLICY_KIND_COVERAGE",
        corpus.manifest.id,
        "/counts",
        `policy kind ${kind} is absent`,
      );
    }
  }
  const actions = new Set(
    corpus.scenarioBundles.flatMap((scenario) => [
      ...scenario.evaluations.map((evaluation) => evaluation.expected_action),
      ...scenario.policy_evaluations.map(
        (evaluation) => evaluation.expected_action,
      ),
    ]),
  );
  for (const action of [
    "ABSTAIN",
    "BLOCK_AND_EXPLAIN",
    "REQUIRE_CONFIRMATION",
    "USE_SUPPORTED_EVIDENCE",
  ]) {
    if (!actions.has(action as never)) {
      issue(
        issues,
        "EXPECTED_ACTION_COVERAGE",
        corpus.manifest.id,
        "/counts",
        `expected action ${action} is absent`,
      );
    }
  }
  if (
    corpus.scenarioBundles.filter(
      (scenario) => scenario.expected_outcome === "BLOCK_FIELD_POLICY",
    ).length < 3
  ) {
    issue(
      issues,
      "BLOCK_FIELD_POLICY_COVERAGE",
      corpus.manifest.id,
      "/counts",
      "at least three genuine field-policy blocks are required",
    );
  }
  const credentialStates = new Set<CredentialState>();
  for (const scenario of corpus.scenarioBundles) {
    for (const artifact of corpus.evidenceArtifacts.filter(
      (item) => item.category === "CREDENTIAL_RECORD",
    )) {
      const state = credentialStateAt(artifact, scenario.evaluation_date);
      if (state !== undefined) {
        credentialStates.add(state);
      }
    }
  }
  for (const state of [
    "CURRENT",
    "EXPIRED",
    "NOT_YET_VALID",
    "REVOKED",
    "UNKNOWN",
  ] as const) {
    if (!credentialStates.has(state)) {
      issue(
        issues,
        "CREDENTIAL_STATE_COVERAGE",
        corpus.manifest.id,
        "/counts",
        `credential state ${state} is absent`,
      );
    }
  }
}

export function validateFixtureConsistency(
  corpus: FixtureCorpus,
): FixtureValidationReport {
  const issues: FixtureValidationIssue[] = [];
  const entities = allEntities(corpus);
  const global = new Map(entities.map((entity) => [entity.id, entity]));
  checkMetadata(corpus, issues);
  checkNestedStableIds(corpus, issues);
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
  return { valid: issues.length === 0, issues, counts };
}

export function assertFixtureConsistency(corpus: FixtureCorpus): void {
  const report = validateFixtureConsistency(corpus);
  if (!report.valid) {
    throw new FixtureConsistencyError(report.issues);
  }
}
