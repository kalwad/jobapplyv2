// One-shot generation baselines: exactly one injected call, no retry, no
// fallback, raw output preserved verbatim as UNVERIFIED, and deterministic
// prompt/input digests pinned by the literal oracle.
import { describe, expect, test } from "vitest";

import {
  runOneShotAnswerGeneration,
  runOneShotResumeGeneration,
} from "../../src/index.ts";
import {
  countingFake,
  devCase,
  loadOracle,
  oneShotInputs,
  strictSingleCallFake,
  throwingFake,
} from "./support/inputs.ts";

const oracle = loadOracle();

function resumeBinding(scenario: string) {
  const inputs = oneShotInputs(devCase("ONE_SHOT_RESUME", scenario));
  if (inputs.resume === undefined) {
    throw new Error(`resume case ${scenario} lacks a resume binding`);
  }
  return { profile: inputs.profile, job: inputs.job, resume: inputs.resume };
}

function answerBinding(scenario: string) {
  const inputs = oneShotInputs(devCase("ONE_SHOT_ANSWER", scenario));
  if (inputs.question === undefined) {
    throw new Error(`answer case ${scenario} lacks a question binding`);
  }
  return {
    question: inputs.question,
    profile: inputs.profile,
    job: inputs.job,
  };
}

describe("one-shot resume generation", () => {
  test("a successful deterministic fake produces one GENERATED record with pinned digests", async () => {
    const fake = countingFake(oracle.one_shot.fake_success_text);
    const record = await runOneShotResumeGeneration(
      fake,
      resumeBinding("SUCCESSFUL_DETERMINISTIC_FAKE"),
    );
    expect(fake.calls.length).toBe(1);
    expect(record.outcome).toBe("GENERATED");
    expect(record.attempted_call_count).toBe(1);
    expect(record.retries).toBe(0);
    expect(record.fallback_used).toBe(false);
    expect(record.raw_output?.text).toBe(oracle.one_shot.fake_success_text);
    expect(record.raw_output?.verification_status).toBe("UNVERIFIED");
    expect(record.raw_output?.factual_authority).toBe("NONE");
    expect(record.prompt_digest).toBe(oracle.one_shot.resume.prompt_digest);
    expect(record.instantiated_prompt_digest).toBe(
      oracle.one_shot.resume.instantiated_prompt_digest,
    );
    expect([...record.input_refs]).toEqual([
      ...oracle.one_shot.resume.input_refs,
    ]);
    expect(record.input_digest).toBe(oracle.one_shot.resume.input_digest);
    expect([...record.classification]).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
  });

  test("a failed generator call fails once with no retry and no fallback", async () => {
    const fake = throwingFake("injected deterministic generator failure");
    const record = await runOneShotResumeGeneration(
      fake,
      resumeBinding("FAILED_GENERATOR_CALL"),
    );
    expect(fake.calls.length).toBe(1);
    expect(record.outcome).toBe(oracle.one_shot.failure_expectation.outcome);
    expect(record.failure?.reason_class).toBe(
      oracle.one_shot.failure_expectation.reason_class,
    );
    expect(record.retries).toBe(oracle.one_shot.failure_expectation.retries);
    expect(record.fallback_used).toBe(
      oracle.one_shot.failure_expectation.fallback_used,
    );
    expect(record.raw_output).toBeUndefined();
    expect(record.failure?.message).toContain("injected deterministic");
  });

  test("a strict single-call fake observes exactly one invocation", async () => {
    const fake = strictSingleCallFake(oracle.one_shot.fake_success_text);
    const record = await runOneShotResumeGeneration(
      fake,
      resumeBinding("EXACTLY_ONE_CALL_ENFORCED"),
    );
    expect(record.outcome).toBe("GENERATED");
    expect(fake.calls.length).toBe(1);
  });

  test("prompt and input digests are identical across repeated runs", async () => {
    const binding = resumeBinding("PROMPT_AND_INPUT_DIGEST_STABILITY");
    const first = await runOneShotResumeGeneration(
      countingFake(oracle.one_shot.fake_success_text),
      binding,
    );
    const second = await runOneShotResumeGeneration(
      countingFake(oracle.one_shot.fake_success_text),
      binding,
    );
    expect(second.prompt_digest).toBe(first.prompt_digest);
    expect(second.instantiated_prompt_digest).toBe(
      first.instantiated_prompt_digest,
    );
    expect(second.input_digest).toBe(first.input_digest);
    expect(first.instantiated_prompt_digest).toBe(
      oracle.one_shot.resume.instantiated_prompt_digest,
    );
  });
});

describe("one-shot answer generation", () => {
  const ANSWER_SCENARIOS = [
    "NARRATIVE_QUESTION",
    "FACTUAL_QUESTION",
    "SENSITIVE_CONSEQUENTIAL_QUESTION",
  ] as const;

  for (const scenario of ANSWER_SCENARIOS) {
    test(`${scenario} produces one GENERATED record with pinned digests and no authority`, async () => {
      const truth = oracle.one_shot.answers[scenario];
      if (truth === undefined) {
        throw new Error(`oracle is missing answer scenario ${scenario}`);
      }
      const fake = countingFake(oracle.one_shot.fake_success_text);
      const record = await runOneShotAnswerGeneration(
        fake,
        answerBinding(scenario),
      );
      expect(fake.calls.length).toBe(1);
      expect(record.outcome).toBe("GENERATED");
      expect(record.instantiated_prompt_digest).toBe(
        truth.instantiated_prompt_digest,
      );
      expect([...record.input_refs]).toEqual([...truth.input_refs]);
      expect(record.input_digest).toBe(truth.input_digest);
      expect(record.raw_output?.verification_status).toBe("UNVERIFIED");
      expect(record.raw_output?.factual_authority).toBe("NONE");
    });
  }

  test("an unsupported fabricated response is preserved verbatim as UNVERIFIED", async () => {
    const truth = oracle.one_shot.answers.INSUFFICIENT_EVIDENCE_RAW_PRESERVED;
    if (truth === undefined) {
      throw new Error("oracle is missing the insufficient-evidence scenario");
    }
    const fake = countingFake(oracle.one_shot.fabricated_metric_text);
    const record = await runOneShotAnswerGeneration(
      fake,
      answerBinding("INSUFFICIENT_EVIDENCE_RAW_PRESERVED"),
    );
    expect(record.outcome).toBe("GENERATED");
    // The corpus marks this question insufficient-evidence, and the fake
    // fabricates a metric anyway: the baseline must preserve the poor raw
    // response exactly rather than silently correcting or blocking it.
    expect(record.raw_output?.text).toBe(
      oracle.one_shot.fabricated_metric_text,
    );
    expect(record.raw_output?.verification_status).toBe("UNVERIFIED");
    expect(record.raw_output?.factual_authority).toBe("NONE");
    expect(record.instantiated_prompt_digest).toBe(
      truth.instantiated_prompt_digest,
    );
    expect(record.input_digest).toBe(truth.input_digest);
  });

  test("a failed answer call fails once with no retry and no fallback", async () => {
    const fake = throwingFake("injected deterministic generator failure");
    const record = await runOneShotAnswerGeneration(
      fake,
      answerBinding("FAILED_GENERATOR_CALL"),
    );
    expect(fake.calls.length).toBe(1);
    expect(record.outcome).toBe("GENERATION_FAILED");
    expect(record.raw_output).toBeUndefined();
    expect(record.fallback_used).toBe(false);
    expect(record.retries).toBe(0);
  });

  test("a strict single-call fake observes exactly one answer invocation", async () => {
    const fake = strictSingleCallFake(oracle.one_shot.fake_success_text);
    const record = await runOneShotAnswerGeneration(
      fake,
      answerBinding("EXACTLY_ONE_CALL_ENFORCED"),
    );
    expect(record.outcome).toBe("GENERATED");
    expect(fake.calls.length).toBe(1);
  });

  test("the request passed to the generator carries the versioned baseline prompt", async () => {
    const fake = countingFake(oracle.one_shot.fake_success_text);
    await runOneShotAnswerGeneration(fake, answerBinding("NARRATIVE_QUESTION"));
    const request = fake.calls[0];
    expect(request?.prompt_id).toBe(oracle.prompts.one_shot_answer.prompt_id);
    expect(request?.prompt_version).toBe(
      oracle.prompts.one_shot_answer.prompt_version,
    );
    expect(request?.prompt_digest).toBe(
      oracle.prompts.one_shot_answer.prompt_digest,
    );
    expect(request?.prompt_text).toContain("Do not invent");
    expect(request?.prompt_text).toContain(
      "Why do you want to work at our company?",
    );
  });
});
