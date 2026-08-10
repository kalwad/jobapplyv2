/** Public frozen-corpus surface. Owner holdout access is intentionally absent. */
export const PACKAGE_NAME = "@japp/evaluation-corpus";
export const CLASSIFICATION = ["EVALUATION_ONLY", "NON_PRODUCTION"] as const;
export const GATE_AUTHORITY = "NONE" as const;

export {
  CORPUS_DIRECTORY,
  CORPUS_MANIFEST_FILE,
  COVERAGE_SUMMARY_FILE,
  VERSION_INDEX_FILE,
  appendFullVersion,
  checkCorpus,
  checkPublicPrivacy,
  computeArtifacts,
  computeCorpus,
  computeCoverage,
  sourceInventory,
  validateCommittedManifest,
  validateCommittedCoverage,
  validateCorrectionRecord,
  validateVersionIndexAppend,
} from "./corpus.ts";
export { CORPUS_FORMAT_VERSION, CORPUS_ID, CORPUS_VERSION } from "./model.ts";
export type {
  ArtifactRole,
  CorpusArtifactV1,
  CorpusManifestV1,
  CoverageSummaryV1,
} from "./model.ts";
