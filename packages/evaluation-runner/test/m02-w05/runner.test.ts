import { describe, expect, test } from "vitest";

import {
  validateBenchmarkResultV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";

import {
  runEvaluation,
  sha256Canonical,
  type EvaluationAdapterV1,
  type EvaluationRunnerError,
  type RunnerClockV1,
} from "../../src/index.ts";
import {
  adapterReturning,
  ARTIFACT_DIGEST,
  digest,
  FixedClock,
  makeCase,
  makeObservation,
  makeRequest,
  required,
  runCases,
  semanticClone,
  trustedContext,
} from "./support/fixtures.ts";

async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("derived per-case result states", () => {
  test("complete exact measurement derives PASS and a canonical result", async () => {
    const execution = await runCases([makeCase()]);
    const record = execution.records[0];
    expect(record?.completeness_state).toBe("COMPLETE");
    expect(record?.comparable).toBe(true);
    expect(record?.overall_outcome).toBe("PASS");
    expect(record?.failure_error_codes).toEqual([]);
    expect(record?.canonical_result?.overall_outcome).toBe("PASS");
    expect(record?.canonical_result?.holdout_state).toBe("NOT_APPLICABLE");
    expect(
      record?.canonical_result?.runtime_metadata.model_digest,
    ).toBeUndefined();
    expect(
      record?.canonical_result?.runtime_metadata.browser_family,
    ).toBeUndefined();
    const structural = validateBenchmarkResultV1(record?.canonical_result);
    expect(structural.valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:benchmark:result:v1",
        record?.canonical_result,
      ).valid,
    ).toBe(true);
  });

  test("complete threshold failure derives FAIL without caller authority", async () => {
    const benchmarkCase = makeCase();
    const execution = await runCases([benchmarkCase], (entry) =>
      makeObservation(entry, {
        metrics: [
          {
            metric_id: "QUALITY_SCORE",
            measured_value: 0.79,
            unit: "SCORE",
          },
        ],
      }),
    );
    const record = execution.records[0];
    expect(record?.overall_outcome).toBe("FAIL");
    expect(record?.comparable).toBe(true);
    expect(record?.failure_error_codes).toEqual(["BENCHMARK_THRESHOLD_FAILED"]);
    expect(record?.threshold_results[0]?.passed).toBe(false);
  });

  test("failed setup is visible, INVALID, and cannot issue a fake canonical result", async () => {
    const execution = await runCases([makeCase()], (entry) =>
      makeObservation(entry, { status: "FAILED_SETUP" }),
    );
    const record = execution.records[0];
    expect(record?.completeness_state).toBe("FAILED_SETUP");
    expect(record?.overall_outcome).toBe("INVALID");
    expect(record?.comparable).toBe(false);
    expect(record?.missing_metric_ids).toEqual(["QUALITY_SCORE"]);
    expect(record?.failure_error_codes).toContain("BENCHMARK_INCOMPLETE_RUN");
    expect(record?.canonical_result).toBeUndefined();
  });

  test("an adapter exception becomes a visible failed-setup record", async () => {
    const adapter: EvaluationAdapterV1 = {
      identity: "synthetic_adapter_v1",
      version: "1.0.0",
      evaluate() {
        return Promise.reject(new Error("hostile secret must not be echoed"));
      },
    };
    const request = makeRequest([makeCase()]);
    const execution = await runEvaluation(
      request,
      adapter,
      new FixedClock(),
      trustedContext(),
    );
    expect(execution.records[0]?.completeness_state).toBe("FAILED_SETUP");
    expect(JSON.stringify(execution)).not.toContain("hostile secret");
  });

  test("partial result remains visible and canonical only for observed metrics", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "FIRST_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "SECOND_METRIC",
          comparator: "EXACT",
          expected_value: 2,
          unit: "COUNT",
        },
      ],
    });
    const execution = await runCases([benchmarkCase], (entry) =>
      makeObservation(entry, {
        status: "PARTIAL",
        metrics: [
          {
            metric_id: "FIRST_METRIC",
            measured_value: 1,
            unit: "COUNT",
          },
        ],
      }),
    );
    const record = execution.records[0];
    expect(record?.completeness_state).toBe("PARTIAL");
    expect(record?.overall_outcome).toBe("INVALID");
    expect(record?.missing_metric_ids).toEqual(["SECOND_METRIC"]);
    expect(record?.canonical_result?.metric_results).toHaveLength(1);
    expect(record?.canonical_result?.overall_outcome).toBe("INVALID");
  });

  test("environment mismatch is INVALID and incomparable", async () => {
    const benchmarkCase = makeCase({
      environment: { runtime_profile: "OTHER_RUNTIME" },
    });
    const execution = await runCases([benchmarkCase]);
    const record = execution.records[0];
    expect(record?.environment_match_state).toBe("MISMATCH");
    expect(record?.comparable).toBe(false);
    expect(record?.overall_outcome).toBe("INVALID");
    expect(record?.failure_error_codes).toContain(
      "BENCHMARK_ENVIRONMENT_MISMATCH",
    );
  });

  test("unknown environment is explicit and incomparable", async () => {
    const execution = await runCases([makeCase()], undefined, {
      runtime: { environment_state: "UNKNOWN" },
    });
    expect(execution.records[0]?.environment_match_state).toBe("UNKNOWN");
    expect(execution.records[0]?.overall_outcome).toBe("INVALID");
  });

  test("artifact hash mismatch is INVALID and cannot become PASS", async () => {
    const execution = await runCases([makeCase()], (entry) =>
      makeObservation(entry, {
        artifactObservations: [
          {
            artifact_ref: required(
              entry.input_artifacts[0],
              "case input artifact",
            ).artifact_ref,
            content_digest: digest("a"),
          },
        ],
      }),
    );
    const record = execution.records[0];
    expect(record?.hash_state).toBe("MISMATCH");
    expect(record?.overall_outcome).toBe("INVALID");
    expect(record?.failure_error_codes).toContain("BENCHMARK_HASH_MISMATCH");
  });

  test("partial missing artifact hash is UNKNOWN", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "FIRST_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "SECOND_METRIC",
          comparator: "EXACT",
          expected_value: 2,
          unit: "COUNT",
        },
      ],
    });
    const execution = await runCases([benchmarkCase], (entry) =>
      makeObservation(entry, {
        status: "PARTIAL",
        metrics: [
          {
            metric_id: "FIRST_METRIC",
            measured_value: 1,
            unit: "COUNT",
          },
        ],
        artifactObservations: [],
      }),
    );
    expect(execution.records[0]?.hash_state).toBe("UNKNOWN");
  });

  test("development holdout is honestly NOT_APPLICABLE", async () => {
    const execution = await runCases([makeCase()]);
    expect(execution.provenance.holdout.policy).toBe(
      "DEVELOPMENT_NOT_APPLICABLE_V1",
    );
    expect(execution.records[0]?.holdout_state).toBe("NOT_APPLICABLE");
    expect(execution.records[0]?.canonical_result?.holdout_state).toBe(
      "NOT_APPLICABLE",
    );
  });

  test("measured peak memory is recorded without fabrication", async () => {
    const measured = await runCases([makeCase()], (entry) =>
      makeObservation(entry, { peakMemoryBytes: 1_234_567 }),
    );
    const unmeasured = await runCases([makeCase()]);
    expect(measured.records[0]?.peak_memory_bytes).toBe(1_234_567);
    expect(unmeasured.records[0]?.peak_memory_bytes).toBeNull();
  });
});

describe("provenance, identity, and trusted boundaries", () => {
  test("result and run identities are deterministic and not clock-derived", async () => {
    class ShiftedClock implements RunnerClockV1 {
      public readonly identity = "fixed_clock_v1";
      public readonly version = "1.0.0";
      private index = 0;

      public now(): string {
        const second = 20 + this.index;
        this.index += 1;
        return `2026-08-07T21:00:${String(second).padStart(2, "0")}.000Z`;
      }
    }
    const benchmarkCase = makeCase();
    const request = makeRequest([benchmarkCase]);
    const adapter = adapterReturning((entry) => makeObservation(entry));
    const first = await runEvaluation(
      request,
      adapter,
      new FixedClock(),
      trustedContext(),
    );
    const second = await runEvaluation(
      request,
      adapter,
      new ShiftedClock(),
      trustedContext(),
    );
    expect(second.execution_id).toBe(first.execution_id);
    expect(second.records[0]?.record_id).toBe(first.records[0]?.record_id);
    expect(second.records[0]?.canonical_result?.result_id).toBe(
      first.records[0]?.canonical_result?.result_id,
    );
    expect(second.records[0]?.started_at).not.toBe(
      first.records[0]?.started_at,
    );
  });

  test("case execution order and output sorting are deterministic", async () => {
    const firstCase = makeCase({ index: 1 });
    const secondCase = makeCase({ index: 2 });
    const execution = await runCases([secondCase, firstCase]);
    expect(execution.records.map((record) => record.case_id)).toEqual([
      firstCase.case_id,
      secondCase.case_id,
    ]);
    const canonicalOrder = await runCases([firstCase, secondCase]);
    expect(execution.request_digest).toBe(canonicalOrder.request_digest);
    expect(execution.execution_id).toBe(canonicalOrder.execution_id);
  });

  test("set-like adapter observations normalize before identity derivation", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "ALPHA_COUNT",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "OMEGA_COUNT",
          comparator: "EXACT",
          expected_value: 2,
          unit: "COUNT",
        },
      ],
    });
    const canonical = makeObservation(benchmarkCase, {
      reportDigests: [digest("a"), digest("b")],
      errors: ["BENCHMARK_HASH_MISMATCH", "BENCHMARK_THRESHOLD_FAILED"],
      pairedCounts: [
        {
          group_id: "ALPHA_GROUP",
          true_positive: 1,
          false_positive: 0,
          false_negative: 0,
        },
        {
          group_id: "OMEGA_GROUP",
          true_positive: 2,
          false_positive: 1,
          false_negative: 1,
        },
      ],
    });
    const reversed = {
      ...canonical,
      metrics: [...canonical.metrics].reverse(),
      artifact_report_digests: [...canonical.artifact_report_digests].reverse(),
      failure_error_codes: [...canonical.failure_error_codes].reverse(),
      paired_counts: [...canonical.paired_counts].reverse(),
    };
    const first = await runCases([benchmarkCase], () => canonical);
    const second = await runCases([benchmarkCase], () => reversed);
    expect(second).toEqual(first);
  });

  test("trusted schema-manifest mismatch rejects", async () => {
    const context = trustedContext();
    await expectCode(
      runEvaluation(
        makeRequest([makeCase()]),
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        { ...context, schema_manifest_digest: digest("a") },
      ),
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
    );
  });

  test("trusted repository commit mismatch rejects", async () => {
    await expectCode(
      runEvaluation(
        makeRequest([makeCase()]),
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        { ...trustedContext(), repository_commit: "f".repeat(40) },
      ),
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
    );
  });

  test("trusted runtime commitment mismatch rejects before measurement", async () => {
    const request = makeRequest([makeCase()]);
    await expectCode(
      runEvaluation(
        request,
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        { ...trustedContext(request), runtime_commitment_digest: digest("a") },
      ),
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
    );
  });

  test("trusted corpus commitment mismatch rejects before measurement", async () => {
    const request = makeRequest([makeCase()]);
    await expectCode(
      runEvaluation(
        request,
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        {
          ...trustedContext(request),
          corpus: { ...request.corpus, digest: digest("a") },
        },
      ),
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
    );
  });

  test("caller-supplied unavailable holdout metadata remains trusted and INVALID", async () => {
    const base = makeRequest([makeCase()]);
    const request = {
      ...base,
      holdout: {
        policy: "CALLER_SUPPLIED_MANIFEST_V1" as const,
        state: "UNAVAILABLE" as const,
        manifest_id: "holdoutmanifest_00000000000000000000000001",
        manifest_digest: digest("a"),
      },
    };
    await expectCode(
      runEvaluation(
        request,
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
    );
    const execution = await runEvaluation(
      request,
      adapterReturning((entry) => makeObservation(entry)),
      new FixedClock(),
      trustedContext(request),
    );
    expect(execution.records[0]).toMatchObject({
      holdout_state: "UNAVAILABLE",
      comparable: false,
      overall_outcome: "INVALID",
    });
    expect(execution.records[0]?.failure_error_codes).toContain(
      "BENCHMARK_INVALID_HOLDOUT_STATE",
    );
  });

  test("adapter identity mismatch rejects before execution", async () => {
    const adapter = adapterReturning((entry) => makeObservation(entry));
    await expectCode(
      runEvaluation(
        makeRequest([makeCase()]),
        { ...adapter, identity: "wrong_adapter" },
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_ADAPTER_IDENTITY_MISMATCH",
    );
  });

  test("fake model digest on a no-model run rejects", async () => {
    const runtime = {
      environment_state: "KNOWN" as const,
      runtime_family: "NODE",
      runtime_version: "24.18.0",
      platform_profile: "DEVELOPMENT",
      toolchain_digest: digest("6"),
      operating_system: "SYNTHETIC_OS",
      architecture: "SYNTHETIC_ARCH",
      model_profile_ref: "modelprofile_00000000000000000000000001",
      model_digest: digest("a"),
    };
    const request = makeRequest([makeCase()], { runtime });
    await expectCode(
      runEvaluation(
        request,
        adapterReturning((entry) => makeObservation(entry)),
        new FixedClock(),
        trustedContext(request),
      ),
      "RUNNER_MODEL_PROVENANCE",
    );
  });

  test("model participation without a model digest rejects", async () => {
    await expectCode(
      runEvaluation(
        makeRequest([makeCase()]),
        adapterReturning((entry) =>
          makeObservation(entry, { modelParticipated: true }),
        ),
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_MODEL_PROVENANCE",
    );
  });

  test("prompt participation requires and preserves its exact digest", async () => {
    const prompt = {
      prompt_id: "synthetic_prompt_v1",
      version: "1.0.0",
      digest: digest("a"),
    } as const;
    const execution = await runCases(
      [makeCase()],
      (entry) => makeObservation(entry, { usedPromptIds: [prompt.prompt_id] }),
      { prompts: [prompt] },
    );
    expect(execution.records[0]?.used_prompt_commitments[0]?.digest).toBe(
      prompt.digest,
    );
    expect(execution.provenance.prompt_commitments).toEqual([prompt]);
  });

  test("unused prompt commitment rejects instead of fabricating participation", async () => {
    await expectCode(
      runCases([makeCase()], undefined, {
        prompts: [
          {
            prompt_id: "unused_prompt_v1",
            version: "1.0.0",
            digest: digest("a"),
          },
        ],
      }),
      "RUNNER_PROMPT_PROVENANCE",
    );
  });

  test("browser metadata is absent when no browser participated", async () => {
    const execution = await runCases([makeCase()]);
    expect(execution.provenance.runtime.browser).toBeUndefined();
    expect(
      execution.records[0]?.canonical_result?.runtime_metadata.browser_family,
    ).toBeUndefined();
  });

  test("case digest changes on any committed case semantic change", () => {
    const benchmarkCase = makeCase();
    const mutated = semanticClone(benchmarkCase) as unknown as {
      expected_behavior: string;
    };
    mutated.expected_behavior = "REJECT";
    expect(sha256Canonical(mutated)).not.toBe(sha256Canonical(benchmarkCase));
  });

  test("artifact commitment stays exact in the positive control", async () => {
    const execution = await runCases([makeCase()]);
    expect(execution.records[0]?.hash_state).toBe("MATCH");
    expect(ARTIFACT_DIGEST).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
