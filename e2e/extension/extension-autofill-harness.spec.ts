import { execFileSync } from "node:child_process";
import { cpus, totalmem, platform, arch } from "node:os";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { test, expect } from "./support/extension-test.ts";
import { openHarness, requireValue } from "./support/research-harness.ts";
import {
  executeMv3Autofill,
  bindMv3Observation,
  type SanitizedAutofillInput,
} from "./support/autofill-benchmark.ts";
import {
  RESEARCH_MATRIX,
  ATS_FAMILIES,
} from "../../packages/ats-adapters/research/matrix.ts";
import { fixtureHtml } from "../../packages/ats-adapters/research/fixture-html.ts";
import {
  sha256Canonical,
  sha256Bytes,
  stableIdFromDigest,
  type ContentDigest,
} from "../../packages/evaluation-runner/src/canonical.ts";
import {
  freezeOracle,
  createAutofillAdapter,
  scoreAutofill,
  worksheet,
  type AutofillOracle,
  type OracleField,
} from "../../packages/evaluation-runner/src/autofill.ts";
import { buildAutofillRunManifest } from "../../packages/evaluation-runner/src/autofill-manifest.ts";
import { compareAutofillBaseline } from "../../packages/evaluation-runner/test/support/autofill-baseline.ts";
import { loadCommittedLegacyObservations } from "../../packages/evaluation-baselines/src/index.ts";
import { runEvaluation } from "../../packages/evaluation-runner/src/runner.ts";
import {
  buildRunReport,
  renderReportBundle,
} from "../../packages/evaluation-runner/src/report.ts";
import { computeThresholdSetDigest } from "../../packages/evaluation-runner/src/thresholds.ts";
import { DEVELOPMENT_HOLDOUT_COMMITMENT } from "../../packages/evaluation-runner/src/constants.ts";
import type {
  BenchmarkCaseV1,
  ExecutionRequestV1,
  RunnerTrustedContextV1,
} from "../../packages/evaluation-runner/src/model.ts";
import type { FeasibilityConcept } from "../../packages/form-engine/src/index.ts";
const FACTS = [
  { concept: "FIRST_NAME", value: "Synthetic" },
  { concept: "LAST_NAME", value: "Applicant" },
  { concept: "EMAIL_ADDRESS", value: "synthetic@example.invalid" },
  { concept: "PHONE_NUMBER", value: "2025550100" },
  { concept: "WEBSITE_URL", value: "https://example.invalid/profile" },
  { concept: "ADDRESS_LINE_1", value: "100 Synthetic Avenue" },
  { concept: "ADDRESS_CITY", value: "Synthetic City" },
  { concept: "ADDRESS_REGION", value: "Michigan" },
  { concept: "ADDRESS_POSTAL_CODE", value: "48104" },
  { concept: "ADDRESS_COUNTRY", value: "United States" },
] satisfies SanitizedAutofillInput["profile"];
// Independently authored recipe/control concepts; never learned from candidate.
const CONCEPTS: Record<string, FeasibilityConcept> = {
  "first-name": "FIRST_NAME",
  "last-name": "LAST_NAME",
  email: "EMAIL_ADDRESS",
  phone: "PHONE_NUMBER",
  website: "WEBSITE_URL",
  "street-address": "ADDRESS_LINE_1",
  city: "ADDRESS_CITY",
  state: "ADDRESS_REGION",
  "postal-code": "ADDRESS_POSTAL_CODE",
  country: "ADDRESS_COUNTRY",
};
const CORPUS = {
  id: "M02_AUTOFILL_DEVELOPMENT_V1",
  version: "1.0.0",
  digest:
    "sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8" as ContentDigest,
};
function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}
function sourceFacts() {
  const paths = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (p) =>
        p !== "" &&
        !p.startsWith("docs/evidence/") &&
        /\.(ts|json|yaml|toml|py|lock)$/.test(p),
    );
  const inventory = [...new Set(paths)]
    .sort()
    .map((path) => ({ path, digest: sha256Bytes(readFileSync(path)) }));
  return {
    commit: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
    inventory,
    digest: sha256Canonical(inventory),
    dirty: git("status", "--porcelain") !== "",
  };
}
test("W13 A-I M-N: W12 four-family MV3 candidate, independent oracle, accepted runner and deterministic worksheet", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(120000);
  const facts = sourceFacts();
  const toolchain = sha256Canonical({
    package: sha256Bytes(readFileSync("package.json")),
    lock: sha256Bytes(readFileSync("pnpm-lock.yaml")),
  });
  const matrixDigest = sha256Canonical(RESEARCH_MATRIX);
  const variants = ATS_FAMILIES.map((ats) => {
    const variant = RESEARCH_MATRIX.find(
      (v) =>
        v.ats === ats &&
        v.locale === "en-US" &&
        v.layout === "GROUPED" &&
        v.expected.validation === "CLEAR" &&
        !v.expected.sessionBoundary &&
        v.expected.repeaterRows === 0 &&
        v.controls.every((c) => !c.id.startsWith("employer")),
    );
    if (variant === undefined) throw new Error("W13_W12_VARIANT_MISSING");
    return variant;
  });
  const cases = variants.map((variant) => {
    const input: SanitizedAutofillInput = {
      html: fixtureHtml(variant),
      profile: FACTS,
    };
    const caseId = stableIdFromDigest(
      "benchmarkcase",
      sha256Canonical({ variant: variant.id, input }),
    );
    const fields: OracleField[] = variant.controls.map((control) => {
      const concept = CONCEPTS[control.id];
      const fact = FACTS.find((f) => f.concept === concept);
      const safety =
        control.policy === "SENSITIVE_ABSTAIN" ||
        control.policy === "HONEYPOT_ABSTAIN";
      const supported = !safety && fact !== undefined;
      return {
        key: control.id,
        concept: concept ?? "UNKNOWN",
        required: control.required,
        visible: control.policy !== "HONEYPOT_ABSTAIN",
        enabled: true,
        class:
          control.policy === "SENSITIVE_ABSTAIN"
            ? "SENSITIVE"
            : control.policy === "HONEYPOT_ABSTAIN"
              ? "HONEYPOT"
              : supported
                ? "ORDINARY"
                : "UNSUPPORTED",
        supported,
        expected: supported ? "FILL" : "ABSTAIN",
        value_digest: supported ? sha256Canonical(fact.value) : null,
        option: control.kind === "select",
      };
    });
    const oracle = freezeOracle({
      format_version: "W13_ORACLE_1",
      case_id: caseId,
      fixture_id: variant.id,
      matrix_version: "1.0.0",
      matrix_digest: matrixDigest,
      corpus_version: CORPUS.version,
      corpus_digest: CORPUS.digest,
      profile_digest: sha256Canonical(input),
      provenance_digest: sha256Canonical({
        author: "W13_SYNTHETIC_PROFILE_RECIPE",
        concepts: CONCEPTS,
        facts: FACTS,
        variant,
      }),
      fields,
    } satisfies AutofillOracle);
    const thresholds: BenchmarkCaseV1["thresholds"] = [
      {
        metric_id: "CORRECT_FILLS",
        unit: "COUNT",
        comparator: "AT_LEAST",
        expected_value: 1,
      },
      ...(
        [
          "SENSITIVE_FILLS",
          "HONEYPOT_FILLS",
          "CATASTROPHIC_OPTION_ERRORS",
          "DUPLICATE_ACTIONS",
          "NAVIGATION_ACTIVATIONS",
          "SUBMISSION_ACTIVATIONS",
          "REQUIRED_SILENT",
        ] as const
      ).map((metric_id) => ({
        metric_id,
        unit: "COUNT" as const,
        comparator: "EXACT" as const,
        expected_value: 0,
      })),
    ];
    const thresholdRef = stableIdFromDigest(
      "thresholdset",
      sha256Canonical(thresholds),
    );
    const benchmarkCase: BenchmarkCaseV1 = {
      case_id: caseId,
      case_schema_version: "BENCHMARK_CASE_V1",
      benchmark_family: "AUTOFILL_FEASIBILITY",
      corpus_version: CORPUS.version,
      corpus_digest: CORPUS.digest,
      input_artifacts: [
        {
          artifact_ref: stableIdFromDigest("artifact", sha256Canonical(oracle)),
          artifact_digest: sha256Canonical(oracle),
          schema_ref: "urn:japp:schema:evaluation-artifact:w13-oracle:v1",
        },
        {
          artifact_ref: stableIdFromDigest("artifact", sha256Canonical(input)),
          artifact_digest: sha256Canonical(input),
          schema_ref: "urn:japp:schema:evaluation-artifact:w13-input:v1",
        },
      ],
      expected_behavior: "MEASURE",
      threshold_set_ref: thresholdRef,
      threshold_set_digest: computeThresholdSetDigest({
        threshold_set_ref: thresholdRef,
        thresholds,
      }),
      thresholds,
      environment_requirements: {
        runtime_profile: "NODE",
        platform_profile: "DEVELOPMENT",
        toolchain_digest: toolchain,
        adapter_version: "1.0.0",
      },
      synthetic_data: true,
      provenance: {
        source_kind: "GENERATED",
        source_id: stableIdFromDigest("source", oracle.provenance_digest),
        observed_at: "2026-09-30T12:00:00Z",
        source_digest: oracle.provenance_digest,
      },
      holdout_visibility: "PUBLIC_SYNTHETIC",
      applicable_platform_profiles: ["DEVELOPMENT"],
    };
    return { benchmarkCase, oracle, input };
  });
  const browserVersion = extensionContext.browser()?.version();
  if (browserVersion === undefined)
    throw new Error("W13_BROWSER_VERSION_ABSENT");
  const runtime = {
    environment_state: "KNOWN" as const,
    runtime_family: "NODE",
    runtime_version: process.versions.node,
    platform_profile: "DEVELOPMENT",
    toolchain_digest: toolchain,
    operating_system: platform().toUpperCase(),
    architecture: arch().toUpperCase(),
    browser: { family: "CHROMIUM", version: browserVersion },
  };
  const schemaManifest = JSON.parse(
    readFileSync("packages/contracts/generated/MANIFEST.json", "utf8"),
  ) as { formatVersion: string };
  const request: ExecutionRequestV1 = {
    runner_format_version: "1.0.0",
    cases: cases.map((c) => c.benchmarkCase),
    case_commitments: cases.map((c) => ({
      case_id: c.benchmarkCase.case_id,
      case_digest: sha256Canonical(c.benchmarkCase),
    })),
    repository: {
      commit: facts.commit,
      tree: facts.tree,
      runner_source_digest: facts.digest,
    },
    schema: {
      manifest_digest: sha256Bytes(
        readFileSync("packages/contracts/generated/MANIFEST.json"),
      ),
      generator_format_version: schemaManifest.formatVersion,
    },
    corpus: CORPUS,
    holdout: {
      policy: "DEVELOPMENT_NOT_APPLICABLE_V1",
      state: "NOT_APPLICABLE",
      development_commitment_digest: sha256Canonical(
        DEVELOPMENT_HOLDOUT_COMMITMENT,
      ),
    },
    runtime,
    runtime_commitment_digest: sha256Canonical(runtime),
    implementation: {
      kind: "IMPLEMENTATION",
      identity: "japp-mv3",
      version: "1.0.0",
      source_digest: facts.digest,
    },
    adapter: { identity: "w13_real_mv3_autofill", version: "1.0.0" },
    clock: { identity: "node_utc_clock", version: "1.0.0" },
    prompt_commitments: [],
    output_policy: {
      report_format_version: "1.0.0",
      unexpected_metric_policy: "REJECT",
      formats: ["JSON", "MARKDOWN", "HTML"],
      report_title:
        "W13 DEVELOPMENT HARNESS_VALIDATION NOT_GATE_A_FINAL_EVIDENCE",
      limitations: [
        "Four declared public W12 recipes; not the W14 final evaluation.",
        "Synthetic profile; no owner holdout, Simplify or live ATS execution.",
        "Git coordinates are the published ancestor; source inventory binds dirty candidate bytes.",
      ],
    },
  };
  const trusted: RunnerTrustedContextV1 = {
    repository_commit: facts.commit,
    repository_tree: facts.tree,
    runner_source_digest: facts.digest,
    schema_manifest_digest: request.schema.manifest_digest,
    generator_format_version: request.schema.generator_format_version,
    corpus: CORPUS,
    holdout: request.holdout,
    runtime_commitment_digest: request.runtime_commitment_digest,
    implementation: request.implementation,
  };
  const raw: ReturnType<typeof bindMv3Observation>[] = [];
  type Observation = Awaited<ReturnType<typeof executeMv3Autofill>>;
  const browserEvidence: {
    case_id: string;
    reconciliation: Observation["reconciliation"];
    decisions: Observation["decisions"];
    results: Observation["results"];
    rerenders: number;
  }[] = [];
  const adapter = createAutofillAdapter(
    cases,
    async (input, binding) => {
      const entry = cases.find((c) => c.oracle.case_id === binding.case_id);
      if (entry === undefined) throw new Error("W13_CASE_JOIN");
      const harness = await openHarness(
        extensionContext,
        extensionId,
        serviceWorker,
        "/native/",
      );
      const observed = await executeMv3Autofill(
        harness,
        input as SanitizedAutofillInput,
      );
      expect(observed.meter.rerenders).toBe(observed.meter.actions.length);

      const artifact = bindMv3Observation(
        {
          case_id: binding.case_id,
          fixture_id: binding.fixture_id,
          oracle_digest: sha256Canonical(entry.oracle),
          matrix_version: entry.oracle.matrix_version,
          matrix_digest: entry.oracle.matrix_digest,
          corpus_version: entry.oracle.corpus_version,
          corpus_digest: entry.oracle.corpus_digest,
          profile_digest: entry.oracle.profile_digest,
        },
        observed,
      );
      raw.push(artifact);
      browserEvidence.push({
        case_id: binding.case_id,
        reconciliation: observed.reconciliation,
        decisions: observed.decisions,
        results: observed.results,
        rerenders: observed.meter.rerenders,
      });
      await harness.page.close();
      await harness.controller.close();
      return artifact;
    },
    request.adapter,
  );
  const execution = await runEvaluation(
    request,
    adapter,
    { ...request.clock, now: () => new Date().toISOString() },
    trusted,
  );

  expect(execution.records).toHaveLength(4);
  const scores = cases.map((entry) => {
    const observed = raw.find(
      (r) => r.candidate.case_id === entry.oracle.case_id,
    );
    if (observed === undefined) throw new Error("W13_MISSING_RAW");
    return scoreAutofill(
      entry.benchmarkCase,
      entry.oracle,
      observed.candidate,
      observed.audit,
    );
  });

  expect(execution.records.map((r) => r.overall_outcome)).toEqual([
    "PASS",
    "PASS",
    "PASS",
    "PASS",
  ]);
  for (const result of raw) {
    const resume = result.candidate.fields.find((f) => f.key === "resume");
    expect(resume?.status).toBe("UNRESOLVED");
    expect(resume?.reason).toBe("REQUIRED_UNRESOLVED");
    expect(resume?.report_digest).not.toBeNull();
  }
  const worksheets = cases.map((entry, index) =>
    worksheet(entry.oracle, requireValue(scores[index], "score absent"), {
      browser: "Chromium",
      browser_version: browserVersion,
      product_version: "1.0.0",
      observed_at: requireValue(
        execution.replay_witness.case_witnesses.find(
          (witness) => witness.case_id === entry.oracle.case_id,
        ),
        "window absent",
      ).ended_at,
      provenance_digest: facts.digest,
    }),
  );
  for (const sheet of worksheets) {
    expect(sheet.observed_at).toBe(
      requireValue(
        execution.replay_witness.case_witnesses.find(
          (witness) => witness.case_id === sheet.case_id,
        ),
        "worksheet case window absent",
      ).ended_at,
    );
  }
  const baselines = cases.flatMap((entry) =>
    (["CAREERPULSE", "LEGACY_JOBAPPLY"] as const).map((system) =>
      compareAutofillBaseline({
        legacy_file: loadCommittedLegacyObservations(),
        system,
        sanitized_input: entry.input,
        benchmark_case: entry.benchmarkCase,
        oracle: entry.oracle,
      }),
    ),
  );
  const buildFiles = readdirSync("apps/extension/dist/chrome-mv3")
    .filter((f) => f.endsWith(".js") || f.endsWith(".json"))
    .sort()
    .map((path) => ({
      path,
      digest: sha256Bytes(
        readFileSync(join("apps/extension/dist/chrome-mv3", path)),
      ),
    }));
  buildFiles.push({
    path: "content-scripts/feasibility.js",
    digest: sha256Bytes(
      readFileSync(
        "apps/extension/dist/chrome-mv3/content-scripts/feasibility.js",
      ),
    ),
  });
  const manifest = buildAutofillRunManifest(
    execution,
    {
      matrix: { version: "1.0.0", digest: matrixDigest },
      extension_build_digest: sha256Canonical(buildFiles),
      source_state: facts.dirty ? "DIRTY_SOURCE" : "CLEAN",
      source_inventory_digest: facts.digest,
      hardware: {
        platform: platform(),
        architecture: arch(),
        cpu_model: cpus()[0]?.model ?? "UNKNOWN",
        logical_cpus: cpus().length,
        memory_bytes: totalmem(),
      },
      configuration: {
        settle_budget_ms: 75,
        rerender_delay_ms: 20,
        ai_enabled: false,
        navigation_enabled: false,
        submission_enabled: false,
      },
    },
    raw,
    scores,
    cases.map((c) => c.oracle),
  );
  const report = renderReportBundle(buildRunReport(execution));
  const artifact = {
    labels: ["DEVELOPMENT", "HARNESS_VALIDATION", "NOT_GATE_A_FINAL_EVIDENCE"],
    manifest,
    source_inventory: facts.inventory,
    build_inventory: buildFiles,
    cases,
    raw,
    scores,
    worksheets,
    baselines,
    browser_evidence: browserEvidence,
    execution,
    report,
  };
  await testInfo.attach("w13-development-benchmark", {
    body: JSON.stringify(artifact, null, 2),
    contentType: "application/json",
  });
  const output = process.env.JAPP_W13_ARTIFACT_DIRECTORY;
  if (output !== undefined) {
    if (!isAbsolute(output))
      throw new Error("W13_EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
    mkdirSync(output, { recursive: true });
    writeFileSync(
      resolve(output, "development-run.json"),
      JSON.stringify(artifact, null, 2) + "\n",
    );
  }
  console.log(
    `W13_DEVELOPMENT ${JSON.stringify({ labels: artifact.labels, manifest, scores: scores.map((s) => ({ case_id: s.case_id, counts: s.counts, rates: s.rates })), simplify: "NOT_EXECUTED", baseline_status: baselines.map((b) => ({ system: b.system, status: b.status })) })}`,
  );
});
