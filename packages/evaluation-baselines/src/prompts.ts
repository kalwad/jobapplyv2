// Versioned baseline-owned prompt templates for the one-shot generation
// baselines (M02-W04). These are EVALUATION_ONLY artifacts: they are not
// production prompts, they are never entered into prompts/registry.yaml
// (the production registry owned by M05 and later AI-feature packages),
// and no model runtime exists in this package.
//
// Each template instructs the model not to invent unsupported facts, but
// the baseline never claims that instruction guarantees truth: every raw
// one-shot output remains UNVERIFIED with no factual authority.
import { sha256Bytes, type ContentDigest } from "./canonical-json.ts";

export interface BaselinePrompt {
  readonly prompt_id: string;
  readonly prompt_version: string;
  readonly template_text: string;
  readonly placeholders: readonly string[];
}

export const ONE_SHOT_RESUME_PROMPT: BaselinePrompt = {
  prompt_id: "baseline_prompt_one_shot_resume",
  prompt_version: "1.0.0",
  template_text: [
    "You are an evaluation-only baseline generator. This output is a",
    "comparison floor, never a production resume.",
    "Write a plain-text resume for the synthetic candidate below, targeting",
    "the synthetic job below, in one pass.",
    "Use only facts stated in the input. Do not invent employers, dates,",
    "metrics, degrees, certifications, tools, or skills.",
    "",
    "[CANDIDATE PROFILE]",
    "{{PROFILE}}",
    "",
    "[TARGET JOB]",
    "{{JOB}}",
    "",
    "[SOURCE RESUME FACTS]",
    "{{FACTS}}",
    "",
    "Return plain text only.",
  ].join("\n"),
  placeholders: ["{{PROFILE}}", "{{JOB}}", "{{FACTS}}"],
};

export const ONE_SHOT_ANSWER_PROMPT: BaselinePrompt = {
  prompt_id: "baseline_prompt_one_shot_answer",
  prompt_version: "1.0.0",
  template_text: [
    "You are an evaluation-only baseline generator. This output is a",
    "comparison floor, never a production application answer.",
    "Answer the application question below for the synthetic candidate and",
    "synthetic job below, in one pass.",
    "Use only facts stated in the input. Do not invent experience, metrics,",
    "authorizations, or personal circumstances.",
    "",
    "[QUESTION]",
    "{{QUESTION}}",
    "",
    "[CANDIDATE PROFILE]",
    "{{PROFILE}}",
    "",
    "[TARGET JOB]",
    "{{JOB}}",
    "",
    "Return plain text only.",
  ].join("\n"),
  placeholders: ["{{QUESTION}}", "{{PROFILE}}", "{{JOB}}"],
};

export function promptDigest(prompt: BaselinePrompt): ContentDigest {
  return sha256Bytes(prompt.template_text);
}

/**
 * Deterministic single-pass template instantiation. Every placeholder must
 * appear exactly once in the template and have exactly one value; unknown or
 * missing placeholders fail closed.
 */
export function instantiatePrompt(
  prompt: BaselinePrompt,
  values: Readonly<Record<string, string>>,
): string {
  const providedKeys = Object.keys(values).sort();
  const expectedKeys = [...prompt.placeholders].sort();
  if (JSON.stringify(providedKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `prompt ${prompt.prompt_id} expects placeholders ${expectedKeys.join(", ")}`,
    );
  }
  let text = prompt.template_text;
  for (const placeholder of prompt.placeholders) {
    const occurrences = text.split(placeholder).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `prompt ${prompt.prompt_id} placeholder ${placeholder} must occur exactly once`,
      );
    }
    const value = values[placeholder];
    if (value === undefined) {
      throw new Error(
        `prompt ${prompt.prompt_id} placeholder ${placeholder} has no value`,
      );
    }
    text = text.replace(placeholder, value);
  }
  return text;
}
