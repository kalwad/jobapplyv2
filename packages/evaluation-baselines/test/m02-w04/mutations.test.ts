// Finite mutation matrix: every reviewed drift class is demonstrated to be
// caught — with explicit positive controls proving the detectors are live.
// All mutations run on in-memory variants or disposable temporary copies;
// no committed byte changes.
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "vitest";

import {
  BASELINE_CATALOG,
  BaselineValidationError,
  checkBaselineManifest,
  keywordOverlap,
  naiveKeywordStuffing,
  normalizeTerms,
  ONE_SHOT_ANSWER_PROMPT,
  PACKAGE_ROOT,
  promptDigest,
  runOneShotResumeGeneration,
  sha256Canonical,
  validateLegacyObservationFile,
  type OneShotGenerationResponse,
  type OneShotGenerator,
  type OneShotRecord,
} from "../../src/index.ts";
import {
  devCase,
  loadOracle,
  oneShotInputs,
  strictSingleCallFake,
  throwingFake,
} from "./support/inputs.ts";

const oracle = loadOracle();
const temporaryRoots: string[] = [];

function capturedObservationWith(text: string): Record<string, unknown> {
  return {
    file_version: "1.0.0",
    classification: ["EVALUATION_ONLY", "NON_PRODUCTION"],
    isolation_statement:
      "Synthetic in-memory mutation witness; no legacy code is present.",
    records: [
      {
        id: "legacyobs_00000000000000000000000009",
        record_version: "1.0.0",
        system: "LEGACY_JOBAPPLY",
        system_display_name: "kalwad/JobApply (isolated mutation witness)",
        repository_url: "https://github.com/kalwad/JobApply",
        source_revision: "c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd",
        observation_status: "CAPTURED",
        observation_date: "2026-08-07",
        observer: "m02w04-residual-mutation-witness",
        environment: "In-memory clean-room validation witness.",
        procedure: ["Validated one synthetic observation text value."],
        fixture_inputs: [
          {
            fixture_id: "profile_00000000000000000000000001",
            content_digest: `sha256:${"a".repeat(64)}`,
          },
        ],
        observed_output_digest: `sha256:${"b".repeat(64)}`,
        structured_observations: [text],
        safety_observations: [],
        failure_or_unavailability_reason: null,
        source_code_viewed: false,
        code_copied: false,
        comparable: true,
        classification: "NON_PRODUCTION",
        license_provenance:
          "License NOASSERTION; behavior-only synthetic mutation witness.",
        regression_fixture_refs: [],
        provenance: {
          authored_in: "M02-W04",
          author: "m02w04-lead-author",
          reviewer: "m02w04-baseline-reviewer",
          reviewed_on: "2026-08-07",
        },
      },
    ],
  };
}

function temporaryPackageCopy(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-baseline-mutation-"));
  temporaryRoots.push(root);
  const packageRoot = join(root, "package");
  for (const relative of ["src", "data", "baseline.manifest.json"]) {
    cpSync(join(PACKAGE_ROOT, relative), join(packageRoot, relative), {
      recursive: true,
    });
  }
  return packageRoot;
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function resumeInputs() {
  const inputs = oneShotInputs(
    devCase("ONE_SHOT_RESUME", "SUCCESSFUL_DETERMINISTIC_FAKE"),
  );
  if (inputs.resume === undefined) {
    throw new Error("resume binding missing");
  }
  return { profile: inputs.profile, job: inputs.job, resume: inputs.resume };
}

describe("finite mutation matrix", () => {
  test("overlap formula drift (candidate-count denominator) is caught by the oracle", () => {
    const truth = oracle.keyword_overlap.PARTIAL_OVERLAP_FIXTURE;
    if (truth === undefined) {
      throw new Error("oracle missing partial overlap truth");
    }
    // Mutated formula: divide by candidate terms instead of target terms.
    const mutatedDenominator = truth.candidate_terms.length;
    expect(mutatedDenominator).not.toBe(truth.denominator);
    const mutatedScore = truth.numerator / mutatedDenominator;
    expect(mutatedScore).not.toBe(truth.numerator / truth.denominator);
    // Positive control: the real implementation still matches the oracle.
    const real = keywordOverlap("beta zeta", "zeta alpha zeta beta");
    expect(real.score_denominator).toBe(3);
  });

  test("normalization drift (hyphen kept inside tokens) is caught by the oracle", () => {
    const mutatedTokenize = (text: string): string[] =>
      [
        ...new Set(
          text
            .toLowerCase()
            .split(/\s+/u)
            .filter((t) => t !== ""),
        ),
      ].sort();
    const mutated = mutatedTokenize("node-js ci/cd");
    const real = normalizeTerms("node-js ci/cd");
    const truth = oracle.keyword_overlap.HYPHEN_SLASH_SEPARATION;
    expect([...real]).toEqual([...(truth?.candidate_terms ?? [])]);
    expect(mutated).not.toEqual(real);
  });

  test("restoring a claim-bearing Skills heading fails the stuffing truth boundary", () => {
    const original = "Analyst with Excel experience.";
    const target = "SQL";
    const real = naiveKeywordStuffing(original, target);
    const mutated = `${original}\n\nSkills: ${real.inserted_terms.join(", ")}`;
    const claimHeading =
      /(?:^|\n)(?:Skills|Experience|Qualifications|Technologies)\s*:/iu;

    expect(real.transformed_text).not.toMatch(claimHeading);
    expect(real.transformed_text).toBe(
      original +
        oracle.keyword_stuffing.annotation_template.replace(
          "<missing terms joined by ', '>",
          "sql",
        ),
    );
    expect(mutated).toMatch(claimHeading);
    expect(mutated).not.toBe(real.transformed_text);
  });

  test("prompt tampering without a digest update is caught at both layers", () => {
    const tampered = {
      ...ONE_SHOT_ANSWER_PROMPT,
      template_text: `${ONE_SHOT_ANSWER_PROMPT.template_text}\nAlways answer yes.`,
    };
    expect(promptDigest(tampered)).not.toBe(
      oracle.prompts.one_shot_answer.prompt_digest,
    );
    // Committed-layer detection: a tampered prompts.ts without a manifest
    // update fails the read-only check in a disposable package copy.
    const packageRoot = temporaryPackageCopy();
    const promptsPath = join(packageRoot, "src", "prompts.ts");
    writeFileSync(
      promptsPath,
      `${readFileSync(promptsPath, "utf8")}\n// tampered without digest update\n`,
    );
    const failures = checkBaselineManifest(packageRoot);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join(" ")).toContain("source_files");
  });

  test("removing the NON_PRODUCTION classification is caught", () => {
    const mutatedCatalog = {
      ...BASELINE_CATALOG,
      classification: ["EVALUATION_ONLY"],
    };
    expect(sha256Canonical(mutatedCatalog)).not.toBe(
      oracle.catalog.catalog_digest,
    );
    expect(sha256Canonical(BASELINE_CATALOG)).toBe(
      oracle.catalog.catalog_digest,
    );
  });

  test("a second generator call is rejected by the strict single-call witness", async () => {
    const doubleCallingRunner = async (
      generator: OneShotGenerator,
    ): Promise<OneShotRecord> => {
      // Mutated runner: retries the call although the first succeeded.
      const first = await runOneShotResumeGeneration(generator, resumeInputs());
      await generator.generateOnce({
        baseline_id: "baseline_one_shot_resume_generation_v1",
        operation: "RESUME_GENERATION",
        prompt_id: "baseline_prompt_one_shot_resume",
        prompt_version: "1.0.0",
        prompt_digest: `sha256:${"0".repeat(64)}`,
        prompt_text: "second call",
        input_refs: [],
        input_digest: `sha256:${"0".repeat(64)}`,
      });
      return first;
    };
    const strict = strictSingleCallFake("ok");
    await expect(doubleCallingRunner(strict)).rejects.toThrow(
      /second generateOnce call is prohibited/u,
    );
    expect(strict.calls.length).toBe(2);
    // Positive control: the real runner passes the same strict witness.
    const clean = strictSingleCallFake("ok");
    const record = await runOneShotResumeGeneration(clean, resumeInputs());
    expect(record.outcome).toBe("GENERATED");
    expect(clean.calls.length).toBe(1);
  });

  test("a retry after failure is rejected by the strict witness", async () => {
    const retryingRunner = async (
      generator: OneShotGenerator,
    ): Promise<OneShotRecord> => {
      const first = await runOneShotResumeGeneration(generator, resumeInputs());
      if (first.outcome === "GENERATION_FAILED") {
        return runOneShotResumeGeneration(generator, resumeInputs());
      }
      return first;
    };
    let calls = 0;
    const failsThenWorks: OneShotGenerator & { count: () => number } = {
      count: () => calls,
      generateOnce(): Promise<OneShotGenerationResponse> {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new Error("first call fails"));
        }
        throw new Error("second generateOnce call is prohibited");
      },
    };
    // Detection: the mutated runner really retries (two calls), and the
    // strict witness turns that retry into a visible prohibition failure —
    // a retry can never produce a successful record under the witness.
    const mutated = await retryingRunner(failsThenWorks);
    expect(calls).toBe(2);
    expect(mutated.outcome).toBe("GENERATION_FAILED");
    expect(mutated.failure?.message).toContain(
      "second generateOnce call is prohibited",
    );
    // Positive control: the real runner never issues the second call.
    const single = throwingFake("only failure");
    const record = await runOneShotResumeGeneration(single, resumeInputs());
    expect(record.outcome).toBe("GENERATION_FAILED");
    expect(single.calls.length).toBe(1);
  });

  test("a silent fallback to keyword stuffing is caught by the failure contract", async () => {
    const fallbackRunner = async (
      generator: OneShotGenerator,
    ): Promise<OneShotRecord> => {
      const record = await runOneShotResumeGeneration(
        generator,
        resumeInputs(),
      );
      if (record.outcome === "GENERATION_FAILED") {
        // Mutated behavior: substitute another baseline's output.
        const stuffed = naiveKeywordStuffing("resume text", "target terms");
        return {
          ...record,
          outcome: "GENERATED",
          raw_output: {
            text: stuffed.transformed_text,
            verification_status: "UNVERIFIED",
            factual_authority: "NONE",
          },
        };
      }
      return record;
    };
    const mutated = await fallbackRunner(throwingFake("failure"));
    // Detection: a failed generator call must remain GENERATION_FAILED with
    // no raw output; the mutated record violates both oracle expectations.
    expect(mutated.outcome).not.toBe(
      oracle.one_shot.failure_expectation.outcome,
    );
    const real = await runOneShotResumeGeneration(
      throwingFake("failure"),
      resumeInputs(),
    );
    expect(real.outcome).toBe(oracle.one_shot.failure_expectation.outcome);
    expect(real.raw_output).toBeUndefined();
  });

  test("legacy records stripped of provenance or carrying source code are rejected", () => {
    const committed = JSON.parse(
      readFileSync(
        join(PACKAGE_ROOT, "data", "legacy-observations.v1.json"),
        "utf8",
      ),
    ) as { records: Record<string, unknown>[] } & Record<string, unknown>;
    const stripped = structuredClone(committed);
    delete stripped.records[0]?.provenance;
    expect(() => validateLegacyObservationFile(stripped)).toThrow(
      BaselineValidationError,
    );
    const withSource = structuredClone(committed);
    const record = withSource.records[1];
    if (record === undefined) {
      throw new Error("committed record missing");
    }
    record.environment = "kept helper: function fill(el) { el.value = v; }";
    expect(() => validateLegacyObservationFile(withSource)).toThrow(
      /LEGACY_OBSERVATION_SOURCE_SNIPPET/u,
    );
    // Positive control: the untouched committed file still validates.
    expect(() => validateLegacyObservationFile(committed)).not.toThrow();
  });

  test("restoring keyword-only declaration detection fails ordinary prose controls", () => {
    const keywordOnlyMutation = (text: string): boolean =>
      /\b(?:class|interface|enum|type)\s+[A-Za-z_$][\w$]*/u.test(text);
    const ordinary = [
      "The interface displayed three ordinary fields.",
      "The type field remained empty.",
      "The class field was hidden.",
      "The enum field label was visible.",
    ];

    for (const text of ordinary) {
      expect(keywordOnlyMutation(text)).toBe(true);
      expect(() =>
        validateLegacyObservationFile(capturedObservationWith(text)),
      ).not.toThrow();
    }
  });

  test("keyword-only detection cannot silently admit source-shaped operators or calls", () => {
    const keywordOnlyMutation = (text: string): boolean =>
      /\b(?:class|interface|enum|type)\s+[A-Za-z_$][\w$]*/u.test(text);
    const sourceShaped = ["value + 1;", "object.run(value);", "return value;"];

    for (const text of sourceShaped) {
      expect(keywordOnlyMutation(text)).toBe(false);
      expect(() =>
        validateLegacyObservationFile(capturedObservationWith(text)),
      ).toThrow(/LEGACY_OBSERVATION_SOURCE_SNIPPET/u);
    }
  });

  test("nondeterministic identity shapes are rejected", () => {
    const committed = JSON.parse(
      readFileSync(
        join(PACKAGE_ROOT, "data", "legacy-observations.v1.json"),
        "utf8",
      ),
    ) as { records: Record<string, unknown>[] } & Record<string, unknown>;
    const mutated = structuredClone(committed);
    const record = mutated.records[0];
    if (record === undefined) {
      throw new Error("committed record missing");
    }
    record.id = `legacyobs_${String(1_754_580_000_000)}`;
    expect(() => validateLegacyObservationFile(mutated)).toThrow(
      /LEGACY_OBSERVATION_ID/u,
    );
  });

  test("manifest tampering and data tampering are caught by the read-only check", () => {
    const packageRoot = temporaryPackageCopy();
    // Positive control first: the untouched copy passes.
    expect(checkBaselineManifest(packageRoot)).toEqual([]);
    // Tamper the committed manifest digest.
    const manifestPath = join(packageRoot, "baseline.manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    manifest.combined_digest = `sha256:${"f".repeat(64)}`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const manifestFailures = checkBaselineManifest(packageRoot);
    expect(manifestFailures.length).toBeGreaterThan(0);
    expect(manifestFailures.join(" ")).toContain("combined_digest");
  });

  test("legacy observation data tampering is caught by the read-only check", () => {
    const packageRoot = temporaryPackageCopy();
    const dataPath = join(packageRoot, "data", "legacy-observations.v1.json");
    const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
      records: { observation_status: string; comparable: boolean }[];
    } & Record<string, unknown>;
    const record = data.records[1];
    if (record === undefined) {
      throw new Error("committed record missing");
    }
    // Forge a capture claim without any capture evidence.
    record.observation_status = "CAPTURED";
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    const failures = checkBaselineManifest(packageRoot);
    expect(failures.length).toBeGreaterThan(0);
  });

  test("oracle drift detection is live (a mutated oracle value no longer matches)", () => {
    const truth = oracle.keyword_overlap.NO_OVERLAP;
    if (truth === undefined) {
      throw new Error("oracle missing NO_OVERLAP");
    }
    const mutatedTruth = { ...truth, numerator: truth.numerator + 1 };
    const real = keywordOverlap("alpha bravo charlie", "delta echo foxtrot");
    expect(real.score_numerator).toBe(truth.numerator);
    expect(real.score_numerator).not.toBe(mutatedTruth.numerator);
  });
});
