/** Test-only evaluation baselines (M02-W04); never production authority. */
export const PACKAGE_NAME = "@japp/evaluation-baselines";

export {
  canonicalJson,
  canonicalJsonFileBytes,
  sha256Bytes,
  sha256Canonical,
} from "./canonical-json.ts";
export type { ContentDigest } from "./canonical-json.ts";
export {
  ANSWER_PROMPT_DIGEST,
  BASELINE_CATALOG,
  catalogDigest,
  GATE_AUTHORITY_STATEMENT,
  RESUME_PROMPT_DIGEST,
} from "./catalog.ts";
export { caseMatrixDigest, DEV_CASE_MATRIX } from "./dev-cases.ts";
export {
  keywordOverlap,
  KEYWORD_OVERLAP_ALGORITHM_VERSION,
} from "./keyword-overlap.ts";
export {
  KEYWORD_STUFFING_ALGORITHM_VERSION,
  naiveKeywordStuffing,
} from "./keyword-stuffing.ts";
export {
  BaselineValidationError,
  validateLegacyObservationFile,
} from "./legacy-observation.ts";
export {
  checkBaselineManifest,
  computeBaselineManifest,
  LEGACY_OBSERVATION_FILE,
  loadCommittedLegacyObservations,
  MANIFEST_FILE,
  manifestFileBytes,
  PACKAGE_ROOT,
  readCanonicalJsonFile,
} from "./manifest.ts";
export {
  BASELINE_CATALOG_SCHEMA_VERSION,
  BASELINE_CATALOG_VERSION,
  BASELINE_CLASSIFICATION,
  UNVERIFIED_LABEL,
} from "./model.ts";
export type {
  BaselineCatalog,
  BaselineDefinition,
  BaselineId,
  BaselineManifest,
  ComparisonSlot,
  DevCase,
  DevCaseMatrix,
  DevCaseTextInput,
  KeywordOverlapResult,
  KeywordStuffingResult,
  LegacyBehaviorObservation,
  LegacyObservationFile,
  OneShotGenerationRequest,
  OneShotGenerationResponse,
  OneShotGenerator,
  OneShotRecord,
  OriginalStructuredResult,
  OriginalTextResult,
} from "./model.ts";
export {
  compareTerms,
  NORMALIZATION_CONTRACT,
  normalizeTerms,
} from "./normalize.ts";
export {
  jobProjection,
  ONE_SHOT_ALGORITHM_VERSION,
  profileProjection,
  resumeFactsProjection,
  runOneShotAnswerGeneration,
  runOneShotResumeGeneration,
} from "./one-shot.ts";
export {
  originalUntailoredStructured,
  originalUntailoredText,
  ORIGINAL_UNTAILORED_ALGORITHM_VERSION,
} from "./original-untailored.ts";
export {
  instantiatePrompt,
  ONE_SHOT_ANSWER_PROMPT,
  ONE_SHOT_RESUME_PROMPT,
  promptDigest,
} from "./prompts.ts";
export type { BaselinePrompt } from "./prompts.ts";
