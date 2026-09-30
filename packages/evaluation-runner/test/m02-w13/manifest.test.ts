import { expect, it } from "vitest";
import { fixture } from "./support.ts";
import {
  freezeOracle,
  scoreAutofill,
  createAutofillAdapter,
} from "../../src/autofill.ts";
import {
  buildAutofillRunManifest,
  type AutofillRunMetadata,
} from "../../src/autofill-manifest.ts";
import { sha256Canonical } from "../../src/canonical.ts";
import {
  makeRequest,
  trustedContext,
  FixedClock,
} from "../m02-w05/support/fixtures.ts";
import { runEvaluation } from "../../src/runner.ts";
import { computeThresholdSetDigest } from "../../src/thresholds.ts";
import { deriveExecutionFromWitness } from "../../src/derive.ts";
async function setup() {
  const f = fixture();
  const request = makeRequest([f.benchmarkCase], {
    implementationIdentity: "japp-mv3",
    runtime: { browser: { family: "CHROMIUM", version: "1.2.3" } },
  });
  const adapter = createAutofillAdapter(
    [
      {
        benchmarkCase: f.benchmarkCase,
        oracle: f.oracle,
        input: { profile: "synthetic" },
      },
    ],
    () => Promise.resolve({ candidate: f.candidate, audit: f.audit }),
    request.adapter,
  );
  const execution = await runEvaluation(
    request,
    adapter,
    new FixedClock(),
    trustedContext(request),
  );
  const score = scoreAutofill(
    f.benchmarkCase,
    freezeOracle(f.oracle),
    f.candidate,
    f.audit,
  );
  const metadata: AutofillRunMetadata = {
    matrix: {
      version: f.oracle.matrix_version,
      digest: f.oracle.matrix_digest,
    },
    extension_build_digest: sha256Canonical("synthetic build"),
    source_state: "DIRTY_SOURCE",
    source_inventory_digest: sha256Canonical("source inventory"),
    hardware: {
      platform: "SYNTHETIC",
      architecture: "SYNTHETIC",
      cpu_model: "SYNTHETIC",
      logical_cpus: 1,
      memory_bytes: 1024,
    },
    configuration: {
      settle_budget_ms: 75,
      rerender_delay_ms: 20,
      ai_enabled: false,
      navigation_enabled: false,
      submission_enabled: false,
    },
  };
  return { f, execution, score, metadata };
}
it("run manifest binds replay, raw observations, independently rescored oracle and hardware", async () => {
  const f = await setup();
  const manifest = buildAutofillRunManifest(
    f.execution,
    f.metadata,
    [{ candidate: f.f.candidate, audit: f.f.audit }],
    [f.score],
    [f.f.oracle],
  );
  expect(manifest.field_count).toBe(1);
  expect(manifest.labels).toContain("NOT_GATE_A_FINAL_EVIDENCE");
  expect(manifest.raw_result_digest).toBe(
    sha256Canonical([{ candidate: f.f.candidate, audit: f.f.audit }]),
  );
});
it("manifest rejects a coherent replay whose metrics contradict its committed raw score", async () => {
  const f = await setup();
  const witness = structuredClone(f.execution.replay_witness);
  const observation = witness.case_witnesses[0]?.observation;
  if (observation?.metrics[0] === undefined)
    throw new Error("test observation absent");
  Object.assign(observation.metrics[0], { measured_value: 0 });
  const contradictory = deriveExecutionFromWitness(witness);
  expect(contradictory.records[0]?.overall_outcome).toBe("FAIL");
  expect(() =>
    buildAutofillRunManifest(
      contradictory,
      f.metadata,
      [{ candidate: f.f.candidate, audit: f.f.audit }],
      [f.score],
      [f.f.oracle],
    ),
  ).toThrow("W13_MANIFEST_OBSERVATION_DRIFT");
});
it.each(["score", "raw", "matrix", "case_inventory", "mode"])(
  "manifest rejects %s drift",
  async (mutation) => {
    const f = await setup();
    const raw = [{ candidate: f.f.candidate, audit: f.f.audit }];
    let scores = [f.score];
    let metadata = f.metadata;
    switch (mutation) {
      case "score":
        scores = [
          { ...f.score, counts: { ...f.score.counts, correct_fills: 0 } },
        ];
        break;
      case "raw":
        f.f.candidate.fields = [];
        break;
      case "matrix":
        metadata = {
          ...metadata,
          matrix: { ...metadata.matrix, digest: sha256Canonical("other") },
        };
        break;
      case "case_inventory":
        scores = [];
        break;
      case "mode":
        metadata = {
          ...metadata,
          configuration: { ...metadata.configuration, ai_enabled: true },
        };
        break;
    }
    expect(() =>
      buildAutofillRunManifest(f.execution, metadata, raw, scores, [
        f.f.oracle,
      ]),
    ).toThrow();
  },
);
it("canonical ratio metric carries exact counts, zero denominator stays unavailable", async () => {
  const f = fixture();
  const thresholds = [
    {
      metric_id: "PRECISION",
      unit: "RATIO" as const,
      comparator: "EXACT" as const,
      expected_value: 1,
    },
  ];
  const benchmarkCase = {
    ...f.benchmarkCase,
    thresholds,
    threshold_set_digest: computeThresholdSetDigest({
      threshold_set_ref: f.benchmarkCase.threshold_set_ref,
      thresholds,
    }),
  };
  const adapter = createAutofillAdapter(
    [{ benchmarkCase, oracle: f.oracle, input: { profile: "synthetic" } }],
    () => Promise.resolve({ candidate: f.candidate, audit: f.audit }),
    { identity: "test_adapter", version: "1.0.0" },
  );
  const filled = await adapter.evaluate(benchmarkCase);
  expect(filled.metrics[0]?.proportion_counts).toEqual({
    numerator: 1,
    denominator: 1,
  });
  f.audit.fields[0]?.actions.splice(0);
  const missing = await adapter.evaluate(benchmarkCase);
  expect(missing.metrics).toEqual([]);
  expect(missing.status).toBe("FAILED_SETUP");
});
