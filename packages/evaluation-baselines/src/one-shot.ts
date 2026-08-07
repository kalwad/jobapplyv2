// One-shot generation baselines (M02-W04): one versioned baseline-owned
// prompt and exactly one injected generation call per operation.
//
// This is an injected boundary, not a model runtime: no retry, no repair,
// no second model, no retrieval, no tools, no verification or rewriting of
// the result, no fallback to another baseline, and no factual authority for
// the raw response. Tests and CI use deterministic in-process fakes; no
// provider, network access, model download, or model lock exists here.
import type {
  QuestionCase,
  SourceResume,
  SyntheticJob,
  SyntheticProfile,
} from "@japp/test-fixtures";

import { sha256Bytes, sha256Canonical } from "./canonical-json.ts";
import {
  BASELINE_CLASSIFICATION,
  UNVERIFIED_LABEL,
  type OneShotGenerationRequest,
  type OneShotGenerator,
  type OneShotRecord,
} from "./model.ts";
import {
  instantiatePrompt,
  ONE_SHOT_ANSWER_PROMPT,
  ONE_SHOT_RESUME_PROMPT,
  promptDigest,
} from "./prompts.ts";

export const ONE_SHOT_ALGORITHM_VERSION = "1.0.0" as const;

const FAILURE_MESSAGE_LIMIT = 300;

export function profileProjection(profile: SyntheticProfile): string {
  return [
    `Name: ${profile.contact.full_name}`,
    `Target role: ${profile.target_role}`,
    `Skills: ${profile.skills.join(", ")}`,
    `Work authorization: ${profile.work_authorization.status}`,
    `Relocation: ${profile.constraints.relocation} (${profile.constraints.region})`,
  ].join("\n");
}

export function jobProjection(job: SyntheticJob): string {
  return [
    `Title: ${job.title}`,
    `Employer: ${job.employer}`,
    `Work mode: ${job.work_mode} (${job.location})`,
    ...job.source_blocks.map((block) => `Requirement: ${block.text}`),
  ].join("\n");
}

export function resumeFactsProjection(resume: SourceResume): string {
  return resume.facts.map((fact) => fact.text).join("\n");
}

interface ResumeInputs {
  readonly profile: SyntheticProfile;
  readonly job: SyntheticJob;
  readonly resume: SourceResume;
}

interface AnswerInputs {
  readonly question: QuestionCase;
  readonly profile: SyntheticProfile;
  readonly job: SyntheticJob;
}

function boundedFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > FAILURE_MESSAGE_LIMIT
    ? `${message.slice(0, FAILURE_MESSAGE_LIMIT)}…`
    : message;
}

async function executeExactlyOnce(
  generator: OneShotGenerator,
  request: OneShotGenerationRequest,
  instantiatedPromptDigest: `sha256:${string}`,
): Promise<OneShotRecord> {
  const base = {
    baseline_id: request.baseline_id,
    operation: request.operation,
    algorithm_version: ONE_SHOT_ALGORITHM_VERSION,
    classification: BASELINE_CLASSIFICATION,
    prompt_id: request.prompt_id,
    prompt_version: request.prompt_version,
    prompt_digest: request.prompt_digest,
    instantiated_prompt_digest: instantiatedPromptDigest,
    input_refs: request.input_refs,
    input_digest: request.input_digest,
    attempted_call_count: 1,
    retries: 0,
    fallback_used: false,
  } as const;
  try {
    const response = await generator.generateOnce(request);
    return {
      ...base,
      outcome: "GENERATED",
      raw_output: {
        text: response.raw_text,
        verification_status: UNVERIFIED_LABEL,
        factual_authority: "NONE",
      },
    };
  } catch (error: unknown) {
    return {
      ...base,
      outcome: "GENERATION_FAILED",
      failure: {
        reason_class: "GENERATOR_ERROR",
        message: boundedFailureMessage(error),
      },
    };
  }
}

export async function runOneShotResumeGeneration(
  generator: OneShotGenerator,
  inputs: ResumeInputs,
): Promise<OneShotRecord> {
  const promptText = instantiatePrompt(ONE_SHOT_RESUME_PROMPT, {
    "{{PROFILE}}": profileProjection(inputs.profile),
    "{{JOB}}": jobProjection(inputs.job),
    "{{FACTS}}": resumeFactsProjection(inputs.resume),
  });
  const request: OneShotGenerationRequest = {
    baseline_id: "baseline_one_shot_resume_generation_v1",
    operation: "RESUME_GENERATION",
    prompt_id: ONE_SHOT_RESUME_PROMPT.prompt_id,
    prompt_version: ONE_SHOT_RESUME_PROMPT.prompt_version,
    prompt_digest: promptDigest(ONE_SHOT_RESUME_PROMPT),
    prompt_text: promptText,
    input_refs: [inputs.profile.id, inputs.job.id, inputs.resume.id],
    input_digest: sha256Canonical({
      profile: inputs.profile,
      job: inputs.job,
      resume: inputs.resume,
    }),
  };
  return executeExactlyOnce(generator, request, sha256Bytes(promptText));
}

export async function runOneShotAnswerGeneration(
  generator: OneShotGenerator,
  inputs: AnswerInputs,
): Promise<OneShotRecord> {
  const promptText = instantiatePrompt(ONE_SHOT_ANSWER_PROMPT, {
    "{{QUESTION}}": inputs.question.prompt_text,
    "{{PROFILE}}": profileProjection(inputs.profile),
    "{{JOB}}": jobProjection(inputs.job),
  });
  const request: OneShotGenerationRequest = {
    baseline_id: "baseline_one_shot_answer_generation_v1",
    operation: "ANSWER_GENERATION",
    prompt_id: ONE_SHOT_ANSWER_PROMPT.prompt_id,
    prompt_version: ONE_SHOT_ANSWER_PROMPT.prompt_version,
    prompt_digest: promptDigest(ONE_SHOT_ANSWER_PROMPT),
    prompt_text: promptText,
    input_refs: [inputs.question.id, inputs.profile.id, inputs.job.id],
    input_digest: sha256Canonical({
      question: inputs.question,
      profile: inputs.profile,
      job: inputs.job,
    }),
  };
  return executeExactlyOnce(generator, request, sha256Bytes(promptText));
}
