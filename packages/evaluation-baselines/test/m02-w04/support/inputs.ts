// Test-owned support helpers for the M02-W04 baseline suite. Test side only:
// nothing in src/ imports this file or the literal oracle.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadFixtureCorpus, type FixtureCorpus } from "@japp/test-fixtures";

import {
  DEV_CASE_MATRIX,
  jobProjection,
  profileProjection,
  resumeFactsProjection,
  type DevCase,
  type DevCaseTextInput,
  type OneShotGenerationRequest,
  type OneShotGenerationResponse,
  type OneShotGenerator,
} from "../../../src/index.ts";

export const ORACLE_PATH = fileURLToPath(
  new URL("../oracles/baseline-truth.v1.json", import.meta.url),
);

export interface OverlapTruth {
  readonly candidate_terms: readonly string[];
  readonly target_terms: readonly string[];
  readonly matched: readonly string[];
  readonly missing: readonly string[];
  readonly numerator: number;
  readonly denominator: number;
  readonly zero_target_terms: boolean;
}

export interface OneShotTruth {
  readonly instantiated_prompt_digest: string;
  readonly input_refs: readonly string[];
  readonly input_digest: string;
}

export interface BaselineOracle {
  readonly oracle_version: string;
  readonly authored_note: string;
  readonly catalog: {
    readonly catalog_version: string;
    readonly schema_version: number;
    readonly catalog_digest: string;
    readonly classification: readonly string[];
    readonly baseline_ids: readonly string[];
    readonly algorithm_versions: Readonly<Record<string, string>>;
    readonly one_shot_execution_state: string;
    readonly simplify_slot: {
      readonly slot_id: string;
      readonly status: string;
      readonly future_execution_owners: readonly string[];
    };
  };
  readonly prompts: Readonly<
    Record<
      "one_shot_answer" | "one_shot_resume",
      {
        readonly prompt_id: string;
        readonly prompt_version: string;
        readonly prompt_digest: string;
      }
    >
  >;
  readonly case_matrix: {
    readonly matrix_version: string;
    readonly case_count: number;
    readonly case_matrix_digest: string;
  };
  readonly fixture_bindings: {
    readonly resume_1_id: string;
    readonly resume_1_projection_sha256: string;
    readonly resume_1_record_digest: string;
    readonly job_1_id: string;
    readonly job_1_blocks_projection_sha256: string;
  };
  readonly keyword_overlap: Readonly<Record<string, OverlapTruth>>;
  readonly keyword_stuffing: {
    readonly NO_MISSING_TERMS_text: string;
    readonly ONE_MISSING_TERM_text: string;
    readonly SEVERAL_MISSING_TERMS_FIXTURE: {
      readonly inserted_terms: readonly string[];
      readonly transformed_sha256: string;
      readonly appended_suffix: string;
    };
    readonly idempotent_second_pass: {
      readonly inserted_terms: readonly string[];
      readonly identical: boolean;
    };
  };
  readonly one_shot: {
    readonly fake_success_text: string;
    readonly fabricated_metric_text: string;
    readonly failure_expectation: {
      readonly outcome: string;
      readonly reason_class: string;
      readonly retries: number;
      readonly fallback_used: boolean;
    };
    readonly resume: OneShotTruth & { readonly prompt_digest: string };
    readonly answers: Readonly<Record<string, OneShotTruth>>;
  };
  readonly legacy_observations: {
    readonly file_sha256: string;
    readonly record_count: number;
    readonly careerpulse: Readonly<Record<string, unknown>>;
    readonly legacy_jobapply: Readonly<Record<string, unknown>>;
  };
}

export function loadOracle(): BaselineOracle {
  return JSON.parse(readFileSync(ORACLE_PATH, "utf8")) as BaselineOracle;
}

let cachedCorpus: FixtureCorpus | undefined;

export function corpus(): FixtureCorpus {
  cachedCorpus ??= loadFixtureCorpus();
  return cachedCorpus;
}

export function devCase(kind: DevCase["kind"], scenario: string): DevCase {
  const matches = DEV_CASE_MATRIX.cases.filter(
    (candidate) => candidate.kind === kind && candidate.scenario === scenario,
  );
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new Error(`expected exactly one dev case for ${kind}:${scenario}`);
  }
  return matches[0];
}

export function resolveTextInput(input: DevCaseTextInput): string {
  if (input.source === "INLINE") {
    return input.text;
  }
  const loaded = corpus();
  switch (input.projection) {
    case "RESUME_FACT_TEXT_JOINED": {
      const resume = loaded.sourceResumes.find(
        (record) => record.id === input.fixture_id,
      );
      if (resume === undefined) {
        throw new Error(`unknown resume fixture ${input.fixture_id}`);
      }
      return resumeFactsProjection(resume);
    }
    case "JOB_SOURCE_BLOCK_TEXT_JOINED": {
      const job = loaded.jobs.find((record) => record.id === input.fixture_id);
      if (job === undefined) {
        throw new Error(`unknown job fixture ${input.fixture_id}`);
      }
      return job.source_blocks.map((block) => block.text).join("\n");
    }
    case "PROFILE_SKILLS_JOINED": {
      const profile = loaded.profiles.find(
        (record) => record.id === input.fixture_id,
      );
      if (profile === undefined) {
        throw new Error(`unknown profile fixture ${input.fixture_id}`);
      }
      return profile.skills.join(", ");
    }
    case "QUESTION_PROMPT_TEXT": {
      const question = loaded.questionCases.find(
        (record) => record.id === input.fixture_id,
      );
      if (question === undefined) {
        throw new Error(`unknown question fixture ${input.fixture_id}`);
      }
      return question.prompt_text;
    }
    default:
      throw new Error("unreachable projection");
  }
}

export function oneShotInputs(caseRecord: DevCase): {
  profile: FixtureCorpus["profiles"][number];
  job: FixtureCorpus["jobs"][number];
  resume?: FixtureCorpus["sourceResumes"][number];
  question?: FixtureCorpus["questionCases"][number];
} {
  const binding = caseRecord.one_shot;
  if (binding === undefined) {
    throw new Error(`case ${caseRecord.case_id} has no one-shot binding`);
  }
  const loaded = corpus();
  const profile = loaded.profiles.find(
    (record) => record.id === binding.profile_id,
  );
  const job = loaded.jobs.find((record) => record.id === binding.job_id);
  if (profile === undefined || job === undefined) {
    throw new Error(`case ${caseRecord.case_id} binds unknown fixtures`);
  }
  const resume =
    binding.resume_id === undefined
      ? undefined
      : loaded.sourceResumes.find((record) => record.id === binding.resume_id);
  const question =
    binding.question_id === undefined
      ? undefined
      : loaded.questionCases.find(
          (record) => record.id === binding.question_id,
        );
  return {
    profile,
    job,
    ...(resume === undefined ? {} : { resume }),
    ...(question === undefined ? {} : { question }),
  };
}

export interface CountingGenerator extends OneShotGenerator {
  readonly calls: OneShotGenerationRequest[];
}

/** Deterministic fake returning a fixed text; records every request. */
export function countingFake(rawText: string): CountingGenerator {
  const calls: OneShotGenerationRequest[] = [];
  return {
    calls,
    generateOnce(
      request: OneShotGenerationRequest,
    ): Promise<OneShotGenerationResponse> {
      calls.push(request);
      return Promise.resolve({ raw_text: rawText });
    },
  };
}

/** Strict fake: any call beyond the first throws (exactly-once witness). */
export function strictSingleCallFake(rawText: string): CountingGenerator {
  const calls: OneShotGenerationRequest[] = [];
  return {
    calls,
    generateOnce(
      request: OneShotGenerationRequest,
    ): Promise<OneShotGenerationResponse> {
      calls.push(request);
      if (calls.length > 1) {
        throw new Error("second generateOnce call is prohibited");
      }
      return Promise.resolve({ raw_text: rawText });
    },
  };
}

/** Fake whose every call fails deterministically; records every request. */
export function throwingFake(message: string): CountingGenerator {
  const calls: OneShotGenerationRequest[] = [];
  return {
    calls,
    generateOnce(request: OneShotGenerationRequest): Promise<never> {
      calls.push(request);
      return Promise.reject(new Error(message));
    },
  };
}

export { jobProjection, profileProjection, resumeFactsProjection };
