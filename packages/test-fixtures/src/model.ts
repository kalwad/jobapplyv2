export const FIXTURE_SCHEMA_VERSION = "2.0.0" as const;
export const CORPUS_VERSION = "0.2.0" as const;

export const SCHEMA_REFS = {
  EVIDENCE_ARTIFACT: "urn:japp:schema:test-fixture:evidence-artifact:v2",
  EXPECTED_REQUIREMENT: "urn:japp:schema:test-fixture:expected-requirement:v2",
  EXPECTED_SUPPORTED_CLAIM:
    "urn:japp:schema:test-fixture:expected-supported-claim:v2",
  FIELD_VALUE_POLICY: "urn:japp:schema:test-fixture:field-value-policy:v2",
  MANIFEST: "urn:japp:schema:test-fixture:manifest:v2",
  SCENARIO_BUNDLE: "urn:japp:schema:test-fixture:scenario-bundle:v2",
  SOURCE_RESUME: "urn:japp:schema:test-fixture:source-resume:v2",
  SYNTHETIC_JOB: "urn:japp:schema:test-fixture:synthetic-job:v2",
  SYNTHETIC_PROFILE: "urn:japp:schema:test-fixture:synthetic-profile:v2",
  UNSUPPORTED_GAP: "urn:japp:schema:test-fixture:unsupported-gap:v2",
} as const;

export type FixtureEntityType = Exclude<keyof typeof SCHEMA_REFS, "MANIFEST">;
export type SchemaRef = (typeof SCHEMA_REFS)[keyof typeof SCHEMA_REFS];
export type ContentDigest = `sha256:${string}`;

export type RoleFamily =
  | "BUSINESS"
  | "DATA"
  | "EDUCATION"
  | "ENTRY_LEVEL"
  | "FINANCE"
  | "HEALTHCARE"
  | "OPERATIONS"
  | "SALES"
  | "SOFTWARE";

export type CareerStage = "EARLY" | "MID" | "SENIOR";
export type WorkMode = "HYBRID" | "ON_SITE" | "REMOTE";
export type RequirementImportance = "MUST_HAVE" | "PREFERRED";
export type SupportClassification =
  | "CONTRADICTED"
  | "DIRECT"
  | "PARTIAL"
  | "STRONG_RELATED"
  | "UNSUPPORTED"
  | "USER_ASSERTED";
export type SupportedClassification =
  "DIRECT" | "STRONG_RELATED" | "USER_ASSERTED";
export type GapClassification = "CONTRADICTED" | "PARTIAL" | "UNSUPPORTED";
export type EvidenceRelation =
  "CONTRADICTS" | "DIRECT" | "PARTIAL" | "STRONG_RELATED" | "USER_ASSERTED";
export type FieldValuePolicyKind =
  | "BLOCK_AND_EXPLAIN"
  | "CONFIRM_IF_RECORD_EXPIRED"
  | "CONFIRM_ONCE_PER_JOB"
  | "FILL_FROM_EXPLICIT_RECORD"
  | "NEVER_AUTOFILL"
  | "VOLUNTARY_PREFER_NOT_TO_ANSWER";
export type FieldConcept =
  | "DEMOGRAPHIC_DISCLOSURE"
  | "LICENSE_VALIDITY"
  | "RELOCATION_PREFERENCE"
  | "SALARY_EXPECTATION"
  | "SPONSORSHIP_REQUIREMENT"
  | "WORK_AUTHORIZATION";
export type RequirementKind =
  | "CERTIFICATION"
  | "EDUCATION"
  | "ELIGIBILITY"
  | "EXPERIENCE"
  | "LOCATION"
  | "SKILL";
export type ExpectedAction =
  | "ABSTAIN"
  | "BLOCK_AND_EXPLAIN"
  | "REQUIRE_CONFIRMATION"
  | "USE_SUPPORTED_EVIDENCE";

export interface FixtureMetadata {
  author: string;
  reviewer: string;
  reviewed_at: string;
  expected_result_provenance: "M02W01_SYNTHETIC_AUTHORING_REVIEW";
  synthetic_data: true;
  redaction_state: "SYNTHETIC_RESERVED";
  historical_content_hash: ContentDigest;
}

export interface BaseFixture {
  id: string;
  entity_type: FixtureEntityType;
  schema_ref: SchemaRef;
  schema_version: typeof FIXTURE_SCHEMA_VERSION;
  metadata: FixtureMetadata;
}

export interface SyntheticAddress {
  line1: string;
  city: string;
  region: string;
  postal_code: string;
  country: "US";
  synthetic_marker: "FIXTURE_ONLY";
}

export interface SyntheticContact {
  full_name: string;
  email: string;
  phone: string;
  website: string;
  address: SyntheticAddress;
}

export interface SyntheticProfile extends BaseFixture {
  entity_type: "SYNTHETIC_PROFILE";
  schema_ref: typeof SCHEMA_REFS.SYNTHETIC_PROFILE;
  role_family: RoleFamily;
  career_stage: CareerStage;
  target_role: string;
  contact: SyntheticContact;
  skills: string[];
  career_start: string;
  education_path:
    "BOOTCAMP" | "CERTIFICATE" | "SELF_DIRECTED" | "TRADITIONAL_DEGREE";
  work_authorization:
    | {
        country: "US";
        status: "AUTHORIZED";
        sponsorship_required: false;
      }
    | {
        country: "US";
        status: "REQUIRES_SPONSORSHIP";
        sponsorship_required: true;
      };
  constraints: {
    relocation: "OPEN" | "REGION_ONLY" | "REMOTE_ONLY";
    region: string;
  };
  coverage_tags: string[];
}

export type EvidenceCategory =
  | "CREDENTIAL_RECORD"
  | "EDUCATION_RECORD"
  | "EMPLOYMENT_RECORD"
  | "PROJECT_RECORD"
  | "USER_ASSERTION";

export interface EvidenceSupportRelation {
  requirement_ref: string;
  relation: EvidenceRelation;
}

export interface ExplicitFieldRecord {
  field_record_id: string;
  field_concept: Exclude<FieldConcept, "LICENSE_VALIDITY">;
  recorded_value?: string;
  disclosure_text: string;
  recorded_on: string;
  valid_through?: string;
}

export interface EvidenceArtifact extends BaseFixture {
  entity_type: "EVIDENCE_ARTIFACT";
  schema_ref: typeof SCHEMA_REFS.EVIDENCE_ARTIFACT;
  profile_ref: string;
  category: EvidenceCategory;
  organization: string;
  statement: string;
  fact_keys: string[];
  effective_period: {
    start: string;
    end?: string;
  };
  temporal_semantics:
    | "ACTIVITY_INTERVAL"
    | "ASSERTION_FRESHNESS"
    | "CREDENTIAL_VALIDITY"
    | "EDUCATION_ATTENDANCE";
  education_state?: "COMPLETED" | "IN_PROGRESS" | "WITHDRAWN";
  credential_validity_basis?: "BOUNDED" | "NON_EXPIRING" | "UNKNOWN";
  revoked_on?: string;
  assertion_approval: "NOT_APPLICABLE" | "USER_APPROVED";
  field_records: ExplicitFieldRecord[];
  concurrency_group?: string;
  requirement_relations: EvidenceSupportRelation[];
}

export interface ResumeFact {
  fact_id: string;
  page: 1 | 2;
  text: string;
  fact_keys: string[];
  evidence_refs: string[];
}

export interface SourceResume extends BaseFixture {
  entity_type: "SOURCE_RESUME";
  schema_ref: typeof SCHEMA_REFS.SOURCE_RESUME;
  profile_ref: string;
  as_of: string;
  page_count: 1 | 2;
  page_boundary?: {
    break_after_fact_id: string;
    rationale: string;
  };
  facts: ResumeFact[];
}

export interface RequirementConstraint {
  kind:
    | "CURRENT_LICENSE"
    | "MINIMUM_EXPERIENCE_YEARS"
    | "NONE"
    | "SPONSORSHIP"
    | "WORK_AUTHORIZATION"
    | "WORK_MODE_COMPATIBILITY";
  value: string;
}

export interface JobSourceBlock {
  anchor_id: string;
  declared_importance: RequirementImportance;
  requirement_kind: RequirementKind;
  requirement_tag: string;
  constraint: RequirementConstraint;
  text: string;
  text_sha256: ContentDigest;
}

export interface SyntheticJob extends BaseFixture {
  entity_type: "SYNTHETIC_JOB";
  schema_ref: typeof SCHEMA_REFS.SYNTHETIC_JOB;
  role_family: RoleFamily;
  title: string;
  employer: string;
  work_mode: WorkMode;
  location: string;
  minimum_experience_years: number;
  eligibility_constraint:
    "AUTHORIZED_TO_WORK_IN_US" | "LICENSE_REQUIRED" | "NO_SPONSORSHIP" | "NONE";
  source_blocks: JobSourceBlock[];
}

export interface ExpectedRequirement extends BaseFixture {
  entity_type: "EXPECTED_REQUIREMENT";
  schema_ref: typeof SCHEMA_REFS.EXPECTED_REQUIREMENT;
  job_ref: string;
  importance: RequirementImportance;
  requirement_kind: RequirementKind;
  normalized_text: string;
  source_anchor_id: string;
  source_text_sha256: ContentDigest;
  requirement_tag: string;
  constraint: RequirementConstraint;
}

export interface ExpectedSupportedClaim extends BaseFixture {
  entity_type: "EXPECTED_SUPPORTED_CLAIM";
  schema_ref: typeof SCHEMA_REFS.EXPECTED_SUPPORTED_CLAIM;
  scenario_ref: string;
  profile_ref: string;
  requirement_ref: string;
  support_classification: SupportedClassification;
  claim_text: string;
  evidence_refs: string[];
  field_policy_ref?: string;
  release_eligible: boolean;
  canonical_evidence_mutation: false;
  support_review_rationale: string;
}

export interface UnsupportedGap extends BaseFixture {
  entity_type: "UNSUPPORTED_GAP";
  schema_ref: typeof SCHEMA_REFS.UNSUPPORTED_GAP;
  scenario_ref: string;
  profile_ref: string;
  requirement_ref: string;
  classification: GapClassification;
  supporting_evidence_refs: string[];
  related_or_contradicting_evidence_refs: string[];
  expected_action: Exclude<ExpectedAction, "USE_SUPPORTED_EVIDENCE">;
  reason_code:
    | "CREDENTIAL_EXPIRED"
    | "CREDENTIAL_NOT_CURRENT"
    | "CONTRADICTED_BY_EXPLICIT_RECORD"
    | "INSUFFICIENT_DIRECT_EVIDENCE"
    | "NO_SUPPORTING_EVIDENCE";
  support_review_rationale: string;
}

export interface FieldValuePolicy extends BaseFixture {
  entity_type: "FIELD_VALUE_POLICY";
  schema_ref: typeof SCHEMA_REFS.FIELD_VALUE_POLICY;
  profile_ref: string;
  field_concept: FieldConcept;
  sensitivity: "PERSONAL" | "SENSITIVE";
  consequential: boolean;
  policy: FieldValuePolicyKind;
  source_evidence_ref: string;
  source_field_record_id?: string;
  recorded_value?: string;
  explanation_code: string;
}

export interface ScenarioEvaluation {
  requirement_ref: string;
  classification: SupportClassification;
  result_type: "SUPPORTED_CLAIM" | "UNSUPPORTED_GAP";
  result_ref: string;
  expected_action: ExpectedAction;
}

export interface PolicyEvaluation {
  policy_ref: string;
  field_concept: FieldConcept;
  source_evidence_ref: string;
  expected_action: ExpectedAction;
  release_eligible: boolean;
}

export interface ScenarioBundle extends BaseFixture {
  entity_type: "SCENARIO_BUNDLE";
  schema_ref: typeof SCHEMA_REFS.SCENARIO_BUNDLE;
  profile_ref: string;
  resume_ref: string;
  job_ref: string;
  evaluation_date: string;
  expected_outcome:
    | "ABSTAIN"
    | "BLOCK_FIELD_POLICY"
    | "BLOCK_INELIGIBLE"
    | "PROCEED_WITH_GAPS"
    | "REQUIRE_CONFIRMATION";
  evaluations: ScenarioEvaluation[];
  policy_evaluations: PolicyEvaluation[];
  coverage_tags: string[];
}

export type FixtureEntity =
  | EvidenceArtifact
  | ExpectedRequirement
  | ExpectedSupportedClaim
  | FieldValuePolicy
  | ScenarioBundle
  | SourceResume
  | SyntheticJob
  | SyntheticProfile
  | UnsupportedGap;

export interface FixtureCollection<T extends FixtureEntity = FixtureEntity> {
  schema_ref: T["schema_ref"];
  schema_version: typeof FIXTURE_SCHEMA_VERSION;
  entity_type: T["entity_type"];
  items: T[];
}

export interface FixtureManifestFile {
  path: string;
  entity_type: FixtureEntityType;
  schema_ref: SchemaRef;
  schema_version: typeof FIXTURE_SCHEMA_VERSION;
  record_count: number;
  byte_count: number;
  sha256: ContentDigest;
}

export interface FixtureCounts {
  profiles: number;
  evidence_artifacts: number;
  source_resumes: number;
  jobs: number;
  expected_requirements: number;
  expected_supported_claims: number;
  unsupported_gaps: number;
  field_value_policies: number;
  scenario_bundles: number;
  scenario_evaluations: number;
}

export interface FixtureManifest {
  id: string;
  schema_ref: typeof SCHEMA_REFS.MANIFEST;
  schema_version: typeof FIXTURE_SCHEMA_VERSION;
  corpus_version: typeof CORPUS_VERSION;
  corpus_state: "DEVELOPMENT_MUTABLE";
  holdout_content_present: false;
  metadata: FixtureMetadata;
  files: FixtureManifestFile[];
  counts: FixtureCounts;
  evidence_category_counts: Record<EvidenceCategory, number>;
  role_family_counts: Record<RoleFamily, number>;
  corpus_digest: ContentDigest;
}

export interface FixtureCorpus {
  manifest: FixtureManifest;
  profiles: SyntheticProfile[];
  evidenceArtifacts: EvidenceArtifact[];
  sourceResumes: SourceResume[];
  jobs: SyntheticJob[];
  expectedRequirements: ExpectedRequirement[];
  expectedSupportedClaims: ExpectedSupportedClaim[];
  unsupportedGaps: UnsupportedGap[];
  fieldValuePolicies: FieldValuePolicy[];
  scenarioBundles: ScenarioBundle[];
}
