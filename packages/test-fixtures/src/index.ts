/** Test-only synthetic development fixtures; never product storage authority. */
export const PACKAGE_NAME = "@japp/test-fixtures";

export {
  assertFixtureConsistency,
  validateFixtureConsistency,
} from "./consistency.ts";
export { loadFixtureCorpus } from "./loader.ts";
export { assertCommittedPlatformVersions } from "./platform-version-guard.ts";
export { assertCommittedFixturePrivacy } from "./privacy.ts";
export {
  CORPUS_VERSION,
  FIXTURE_SCHEMA_VERSION,
  SCHEMA_REFS,
} from "./model.ts";
export type {
  AnswerConstraint,
  AnswerScenario,
  EvidenceArtifact,
  ExpectedRequirement,
  ExpectedSupportedClaim,
  FieldValuePolicy,
  FixtureCorpus,
  FixtureManifest,
  QuestionCase,
  ScenarioBundle,
  SourceResume,
  SyntheticJob,
  SyntheticProfile,
  UnsupportedGap,
} from "./model.ts";
