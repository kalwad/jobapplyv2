// ORIGINAL_UNTAILORED baseline (M02-W04): exact passthrough. The original
// synthetic artifact is returned without tailoring — no added, removed,
// rewritten, or inferred fact. Evaluation metadata lives beside the
// candidate artifact, never inside it.
import { sha256Canonical } from "./canonical-json.ts";
import {
  BASELINE_CLASSIFICATION,
  type OriginalStructuredResult,
  type OriginalTextResult,
} from "./model.ts";

export const ORIGINAL_UNTAILORED_ALGORITHM_VERSION = "1.0.0" as const;

export function originalUntailoredText(
  text: string,
  artifactType: "ANSWER_TEXT" | "RESUME_TEXT",
): OriginalTextResult {
  return {
    baseline_id: "baseline_original_untailored_v1",
    algorithm_version: ORIGINAL_UNTAILORED_ALGORITHM_VERSION,
    classification: BASELINE_CLASSIFICATION,
    artifact_type: artifactType,
    candidate_text: text,
    byte_identical_to_input: true,
  };
}

function deepCloneJson<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => deepCloneJson(item)) as T;
  }
  const source = value as Record<string, unknown>;
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    clone[key] = deepCloneJson(source[key]);
  }
  return clone as T;
}

/**
 * Structured passthrough: a distinct output object (the language requires a
 * copy to prove non-mutation) whose canonical content digest must equal the
 * input's. Key and array ordering are preserved exactly as authored.
 */
export function originalUntailoredStructured<T>(
  record: T,
): OriginalStructuredResult<T> {
  const inputDigest = sha256Canonical(record);
  const clone = deepCloneJson(record);
  return {
    baseline_id: "baseline_original_untailored_v1",
    algorithm_version: ORIGINAL_UNTAILORED_ALGORITHM_VERSION,
    classification: BASELINE_CLASSIFICATION,
    artifact_type: "STRUCTURED_FIXTURE_RECORD",
    candidate_record: clone,
    input_content_digest: inputDigest,
    output_content_digest: sha256Canonical(clone),
  };
}
