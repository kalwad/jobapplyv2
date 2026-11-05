import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { test, expect, EXTENSION_DIST } from "./support/extension-test.ts";
import { openHarness } from "./support/research-harness.ts";
import {
  installW14NativeWitness,
  W14_NATIVE_WITNESS_SOURCE,
} from "./support/autofill-w14-native-witness.ts";
import { bindMv3Observation } from "./support/autofill-benchmark.ts";
import {
  measureW14Candidate,
  w14Recipe,
  W14_CONTACT_COHORT,
  W14_SITE_RUNTIME_VERSION,
  logicalControls,
  type W14SanitizedInput,
} from "./support/autofill-w14.ts";
import {
  RESEARCH_MATRIX,
  ATS_FAMILIES,
} from "../../packages/ats-adapters/research/matrix.ts";
import {
  createAutofillAdapter,
  worksheet,
  type AutofillScore,
} from "../../packages/evaluation-runner/src/autofill.ts";
import {
  freezeW14InitialStateOracle,
  scoreW14Preservation,
  W14_INITIAL_STATE_SCHEMA_REF,
  type W14PreservationScore,
  type W14StateObservation,
} from "../../packages/evaluation-runner/src/autofill-preservation.ts";
import {
  sha256Bytes,
  sha256Canonical,
  stableIdFromDigest,
  type ContentDigest,
} from "../../packages/evaluation-runner/src/canonical.ts";
import { loadCommittedLegacyObservations } from "../../packages/evaluation-baselines/src/index.ts";
import { buildAutofillRunManifest } from "../../packages/evaluation-runner/src/autofill-manifest.ts";
import { DEVELOPMENT_HOLDOUT_COMMITMENT } from "../../packages/evaluation-runner/src/constants.ts";
import { runEvaluation } from "../../packages/evaluation-runner/src/runner.ts";
import {
  buildRunReport,
  renderReportBundle,
} from "../../packages/evaluation-runner/src/report.ts";
import type {
  ExecutionRequestV1,
  RunnerTrustedContextV1,
} from "../../packages/evaluation-runner/src/model.ts";

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
    .filter((path) => path !== "" && !path.startsWith("docs/evidence/"));
  const inventory = [...new Set(paths)]
    .sort()
    .map((path) => ({ path, digest: sha256Bytes(readFileSync(path)) }));
  const status = git("status", "--porcelain");
  return {
    commit: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
    source_state: status === "" ? "CLEAN" : "DIRTY_SOURCE",
    status,
    inventory,
    digest: sha256Canonical(inventory),
  };
}

function buildInventory(
  root: string,
  prefix = "",
): { path: string; digest: ContentDigest }[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("W14_BUILD_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? buildInventory(root, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(root, path))) }];
    });
}

type Measurement = Awaited<ReturnType<typeof measureW14Candidate>>;
interface CaseResult {
  case_id: string;
  fixture_id: string;
  ats: (typeof ATS_FAMILIES)[number];
  started_at: string;
  ended_at: string;
  measurement_state: "SCORED" | "REFUSED_INPUT_MODEL" | "MEASUREMENT_ERROR";
  measurement_issues: string[];
  observation: Measurement | null;
  artifact: ReturnType<typeof bindMv3Observation> | null;
  score: AutofillScore | null;
  preservation: W14PreservationScore | null;
  state_observation: W14StateObservation | null;
  worksheet: ReturnType<typeof worksheet> | null;
}

function exactRate(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

function metrics(rows: readonly CaseResult[]) {
  const scores = rows.flatMap((row) => (row.score === null ? [] : [row.score]));
  const fields = scores.flatMap((score) => score.fields);
  const ordinary = fields.filter(
    (field) => field.expected_class === "ORDINARY" && field.supported,
  );
  const attempted = ordinary.filter((field) => field.attempted);
  const sum = (name: keyof AutofillScore["counts"]) =>
    scores.reduce((count, score) => count + score.counts[name], 0);
  const timings = rows
    .flatMap((row) =>
      row.observation === null
        ? []
        : [row.observation.observed.scan_fill_duration_ms],
    )
    .sort((a, b) => a - b);
  return {
    executed_cases: rows.filter((row) => row.observation !== null).length,
    scored_cases: scores.length,
    refused_cases: rows.filter(
      (row) => row.measurement_state === "REFUSED_INPUT_MODEL",
    ).length,
    measurement_error_cases: rows.filter(
      (row) => row.measurement_state === "MEASUREMENT_ERROR",
    ).length,
    scored_logical_controls: fields.length,
    preservation: {
      expected: rows.reduce(
        (n, row) => n + (row.preservation?.counts.expected_preservations ?? 0),
        0,
      ),
      correct: rows.reduce(
        (n, row) => n + (row.preservation?.counts.correct_preservations ?? 0),
        0,
      ),
      violations: rows.reduce(
        (n, row) => n + (row.preservation?.counts.preservation_violations ?? 0),
        0,
      ),
      empty_abstention_violations: rows.reduce(
        (n, row) => n + (row.preservation?.counts.abstention_violations ?? 0),
        0,
      ),
    },
    ordinary_attempted_precision: exactRate(
      attempted.filter((field) => field.primary === "CORRECT_FILL").length,
      attempted.length,
    ),
    required_ordinary_recall: exactRate(
      sum("correct_required_fills"),
      sum("expected_required_fills"),
    ),
    required_reporting: exactRate(
      sum("required_reported"),
      sum("required_unresolved"),
    ),
    observed_persistence: exactRate(sum("persisted"), sum("attempted_fills")),
    counts: {
      required_silent: sum("required_silent"),
      sensitive_fills: sum("sensitive_fills"),
      honeypot_fills: sum("honeypot_fills"),
      catastrophic_option_errors: sum("catastrophic_option_errors"),
      duplicate_actions: sum("duplicate_actions"),
    },
    full_settle_scan_fill_timing: {
      sample_count: timings.length,
      p95_ms:
        timings.length === 0
          ? null
          : timings[Math.ceil(timings.length * 0.95) - 1],
      scope:
        "ONE_EXECUTION_PER_DIFFERENT_W12_PAGE_75MS_SETTLEMENT_20MS_RERENDER",
      includes_fixture_setup: false,
      includes_browser_setup: false,
      includes_reporting: false,
    },
  };
}

test("W14: execute all 200 immutable W12 recipes and preserve incomplete measurement evidence", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(600_000);
  const output = process.env.JAPP_W14_ARTIFACT_DIRECTORY;
  if (output !== undefined && !isAbsolute(output))
    throw new Error("W14_EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
  const startedAt = new Date().toISOString();
  const facts = sourceFacts();
  const buildFiles = buildInventory(EXTENSION_DIST);
  const matrixDigest = sha256Canonical(RESEARCH_MATRIX);
  const toolchainDigest = sha256Canonical({
    package: sha256Bytes(readFileSync("package.json")),
    lock: sha256Bytes(readFileSync("pnpm-lock.yaml")),
    runtime: process.versions,
  });
  const corpus = {
    id: "M02_AUTOFILL_DEVELOPMENT_V1",
    version: "1.0.0",
    digest:
      "sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8" as ContentDigest,
  };
  // Freeze every recipe and its expected truth before the first candidate run.
  const declarationPage = await extensionContext.newPage();
  const cases = [];
  try {
    for (const variant of RESEARCH_MATRIX) {
      const recipe = w14Recipe(variant, matrixDigest, corpus, toolchainDigest);
      const initialFields = await logicalControls(
        { page: declarationPage },
        recipe.input.html,
      );
      const initialOracle = freezeW14InitialStateOracle(
        {
          format_version: "W14_INITIAL_STATE_ORACLE_1",
          case_id: recipe.oracle.case_id,
          oracle_digest: sha256Canonical(recipe.oracle),
          input_digest: recipe.oracle.profile_digest,
          fields: initialFields.map((field) => ({
            key: field.key,
            initial_digest: field.value_digest,
          })),
        },
        recipe.oracle,
      );
      const initialDigest = sha256Canonical(initialOracle);
      const benchmarkCase = {
        ...recipe.benchmarkCase,
        input_artifacts: [
          ...recipe.benchmarkCase.input_artifacts,
          {
            artifact_ref: stableIdFromDigest("artifact", initialDigest),
            artifact_digest: initialDigest,
            schema_ref: W14_INITIAL_STATE_SCHEMA_REF,
          },
        ],
      };
      cases.push({
        variant,
        ...recipe,
        benchmarkCase,
        initial_oracle: initialOracle,
      });
    }
  } finally {
    await declarationPage.close();
  }
  const browserVersion = extensionContext.browser()?.version();
  if (browserVersion === undefined)
    throw new Error("W14_BROWSER_VERSION_ABSENT");
  const hardware = {
    platform: platform(),
    release: release(),
    architecture: arch(),
    cpu_model: cpus()[0]?.model ?? "UNKNOWN",
    logical_cpus: cpus().length,
    memory_bytes: totalmem(),
  };
  const declaredCasesDigest = sha256Canonical(cases);
  const casesById = new Map(
    cases.map((entry) => [entry.oracle.case_id, entry]),
  );
  const runtime: ExecutionRequestV1["runtime"] = {
    environment_state: "KNOWN",
    runtime_family: "NODE",
    runtime_version: process.versions.node,
    platform_profile: "DEVELOPMENT",
    toolchain_digest: toolchainDigest,
    operating_system: hardware.platform.toUpperCase(),
    architecture: hardware.architecture.toUpperCase(),
    browser: { family: "CHROMIUM", version: browserVersion },
  };
  const schemaManifest = JSON.parse(
    readFileSync("packages/contracts/generated/MANIFEST.json", "utf8"),
  ) as { formatVersion: string };
  const request: ExecutionRequestV1 = {
    runner_format_version: "1.0.0",
    cases: cases.map((entry) => entry.benchmarkCase),
    case_commitments: cases.map((entry) => ({
      case_id: entry.benchmarkCase.case_id,
      case_digest: sha256Canonical(entry.benchmarkCase),
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
    corpus,
    // This public development run does not assert execution of a hidden set.
    // The owner's holdout waiver is additional W14 metadata, not a new W05
    // holdout policy or a claim that a caller-supplied holdout was executed.
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
    adapter: { identity: "w14_real_mv3_autofill", version: "1.0.0" },
    clock: { identity: "node_utc_clock", version: "1.0.0" },
    prompt_commitments: [],
    output_policy: {
      report_format_version: "1.0.0",
      unexpected_metric_policy: "REJECT",
      formats: ["JSON", "MARKDOWN", "HTML"],
      report_title: "W14 DEVELOPMENT ACCEPTED_RUNNER PARTIAL_GATE_EVIDENCE",
      limitations: [
        "Canonical per-case thresholds measure the declared zero-tolerance safety counts only.",
        "Accuracy, required reporting, preservation and scan/fill performance are separate W14 measurements and assertions.",
        "Public W12 expansion with the declared synthetic contact profile; the W06 parent corpus is not wholly executed here.",
        "No hidden holdout, public employer form, Simplify or live legacy comparison was executed by this run.",
        "The holdout waiver is recorded separately under owner ADR-0006; canonical holdout metadata remains development not applicable.",
        "Git coordinates identify the committed ancestor; the source inventory binds the actual candidate bytes.",
        "This report has no critical-gate authority and is incomplete Gate A evidence.",
      ],
    },
  };
  const trusted: RunnerTrustedContextV1 = {
    repository_commit: facts.commit,
    repository_tree: facts.tree,
    runner_source_digest: facts.digest,
    schema_manifest_digest: request.schema.manifest_digest,
    generator_format_version: request.schema.generator_format_version,
    corpus,
    holdout: request.holdout,
    runtime_commitment_digest: request.runtime_commitment_digest,
    implementation: request.implementation,
  };
  const rowsById = new Map<string, CaseResult>(
    cases.map((entry) => [
      entry.oracle.case_id,
      {
        case_id: entry.oracle.case_id,
        fixture_id: entry.variant.id,
        ats: entry.variant.ats,
        started_at: "",
        ended_at: "",
        measurement_state: "MEASUREMENT_ERROR",
        measurement_issues: [],
        observation: null,
        artifact: null,
        score: null,
        preservation: null,
        state_observation: null,
        worksheet: null,
      },
    ]),
  );
  const invokedCaseIds = new Set<string>();
  const adapter = createAutofillAdapter(
    cases,
    async (sanitizedInput, binding) => {
      const entry = casesById.get(binding.case_id);
      const row = rowsById.get(binding.case_id);
      if (
        entry === undefined ||
        row === undefined ||
        binding.fixture_id !== entry.oracle.fixture_id
      )
        throw new Error("W14_CASE_JOIN");
      if (invokedCaseIds.has(binding.case_id))
        throw new Error("W14_DUPLICATE_CASE_EXECUTION");
      invokedCaseIds.add(binding.case_id);
      row.started_at = new Date().toISOString();
      let harness: Awaited<ReturnType<typeof openHarness>> | undefined;
      try {
        if (sha256Canonical(sanitizedInput) !== entry.oracle.profile_digest)
          throw new Error("W14_INPUT_BINDING");
        harness = await openHarness(
          extensionContext,
          extensionId,
          serviceWorker,
          "/native/",
        );
        // The actual live candidate runs inside accepted runEvaluation's
        // real wall-clock window. Nothing here replays a prior measurement.
        const measuredHarness = harness;
        row.observation = await measureW14Candidate(
          harness,
          sanitizedInput as W14SanitizedInput,
          () =>
            installW14NativeWitness(
              extensionContext,
              measuredHarness.page,
              extensionId,
            ),
        );
        if (
          output !== undefined &&
          entry.variant.id === "W12-WORKDAY-GROUPED-en-US-MY_INFORMATION"
        ) {
          mkdirSync(output, { recursive: true });
          await harness.page.screenshot({
            path: resolve(output, "workday-en-us-contact.png"),
            fullPage: true,
          });
        }
        row.measurement_issues = [...row.observation.measurement_issues];
        row.artifact = bindMv3Observation(
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
          row.observation.observed,
        );
        if (row.measurement_issues.length > 0) {
          row.measurement_state = row.measurement_issues.some((issue) =>
            issue.startsWith("MEASUREMENT_ERROR:"),
          )
            ? "MEASUREMENT_ERROR"
            : "REFUSED_INPUT_MODEL";
        } else {
          try {
            row.state_observation = {
              format_version: "W14_STATE_OBSERVATION_1",
              case_id: binding.case_id,
              initial_oracle_digest: sha256Canonical(entry.initial_oracle),
              candidate_digest: sha256Canonical(row.artifact.candidate),
              physical_digest: sha256Canonical(row.artifact.audit),
              initial: row.observation.initial.map((field) => ({
                key: field.key,
                observed_digest: field.value_digest,
              })),
              final: row.observation.final.map((field) => ({
                key: field.key,
                observed_digest: field.value_digest,
              })),
            };
            const scored = scoreW14Preservation(
              entry.benchmarkCase,
              entry.oracle,
              entry.initial_oracle,
              row.state_observation,
              row.artifact.candidate,
              row.artifact.audit,
            );
            row.score = scored.canonical_score;
            row.preservation = scored.preservation;
            row.measurement_state = "SCORED";
          } catch (error) {
            const code =
              error instanceof Error &&
              /^W(?:13|14)_[A-Z_0-9]{1,80}$/.test(error.message)
                ? error.message
                : "UNKNOWN_SCORER_ERROR";
            row.measurement_issues.push(
              `MEASUREMENT_ERROR:SCORER_REFUSED:${code}`,
            );
          }
        }
      } catch (error) {
        row.measurement_issues.push(
          `MEASUREMENT_ERROR:CANDIDATE_EXECUTION_FAILED:${error instanceof Error && /^W(?:13|14)_[A-Z_0-9]{1,80}$/.test(error.message) ? error.message : error instanceof Error && ["TimeoutError", "AssertionError"].includes(error.name) ? error.name : "UNKNOWN_EXECUTION_ERROR"}`,
        );
      } finally {
        if (harness !== undefined) {
          await harness.page.close();
          await harness.controller.close();
        }
        row.ended_at = new Date().toISOString();
        if (invokedCaseIds.size % 25 === 0)
          console.log(
            `W14_PROGRESS ${String(invokedCaseIds.size)}/${String(cases.length)}`,
          );
      }
      // Refused/incomplete measurements remain in rowsById and become a real
      // failed-setup witness in W05; they cannot earn canonical safety PASS.
      if (row.measurement_state !== "SCORED" || row.artifact === null)
        throw new Error("W14_MEASUREMENT_REFUSED");
      return row.artifact;
    },
    request.adapter,
  );
  const execution = await runEvaluation(
    request,
    adapter,
    { ...request.clock, now: () => new Date().toISOString() },
    trusted,
  );
  const witnessesById = new Map(
    execution.replay_witness.case_witnesses.map((witness) => [
      witness.case_id,
      witness,
    ]),
  );
  // W05 canonicalizes case order. All evidence joins use case_id, including
  // worksheets, rather than relying on declaration or execution positions.
  const rows = execution.records.map((record) => {
    const row = rowsById.get(record.case_id);
    const entry = casesById.get(record.case_id);
    const witness = witnessesById.get(record.case_id);
    if (row === undefined || entry === undefined || witness === undefined)
      throw new Error("W14_CANONICAL_CASE_JOIN");
    row.started_at = witness.started_at;
    row.ended_at = witness.ended_at;
    if (!invokedCaseIds.has(record.case_id))
      row.measurement_issues.push(
        "MEASUREMENT_ERROR:CANONICAL_ADAPTER_NOT_EXECUTED",
      );
    if (
      row.score !== null &&
      row.artifact !== null &&
      (!record.artifact_report_digests.includes(sha256Canonical(row.score)) ||
        !record.artifact_report_digests.includes(sha256Canonical(row.artifact)))
    ) {
      row.measurement_state = "MEASUREMENT_ERROR";
      row.measurement_issues.push(
        "MEASUREMENT_ERROR:CANONICAL_RAW_SCORE_BINDING",
      );
    }
    if (row.score !== null)
      row.worksheet = worksheet(entry.oracle, row.score, {
        browser: "Chromium",
        browser_version: browserVersion,
        product_version: "1.0.0",
        observed_at: witness.ended_at,
        provenance_digest: facts.digest,
      });
    return row;
  });
  const runReport = buildRunReport(execution);
  // This renderer independently replays the canonical witness and checks
  // report projections, retaining W05's accepted derivation authority.
  const report = renderReportBundle(runReport);
  let manifest: ReturnType<typeof buildAutofillRunManifest> | null = null;
  const manifestIssues: string[] = [];
  if (
    rows.every(
      (row) =>
        row.measurement_state === "SCORED" &&
        row.artifact !== null &&
        row.score !== null,
    )
  ) {
    try {
      manifest = buildAutofillRunManifest(
        execution,
        {
          matrix: { version: "1.0.0", digest: matrixDigest },
          extension_build_digest: sha256Canonical(buildFiles),
          source_state:
            facts.source_state === "CLEAN" ? "CLEAN" : "DIRTY_SOURCE",
          source_inventory_digest: facts.digest,
          hardware: {
            platform: hardware.platform,
            architecture: hardware.architecture,
            cpu_model: hardware.cpu_model,
            logical_cpus: hardware.logical_cpus,
            memory_bytes: hardware.memory_bytes,
          },
          configuration: {
            settle_budget_ms: 75,
            rerender_delay_ms: 20,
            ai_enabled: false,
            navigation_enabled: false,
            submission_enabled: false,
          },
        },
        rows.flatMap((row) => (row.artifact === null ? [] : [row.artifact])),
        rows.flatMap((row) => (row.score === null ? [] : [row.score])),
        execution.records.map((record) => {
          const entry = casesById.get(record.case_id);
          if (entry === undefined) throw new Error("W14_CANONICAL_CASE_JOIN");
          return entry.oracle;
        }),
      );
    } catch (error) {
      manifestIssues.push(
        error instanceof Error &&
          /^W(?:13|14)_[A-Z_0-9]{1,80}$/.test(error.message)
          ? error.message
          : "UNKNOWN_MANIFEST_ERROR",
      );
    }
  } else {
    manifestIssues.push("INCOMPLETE_CANONICAL_RAW_SCORE_INVENTORY");
  }
  // Independent physical counters cover refused cases too. Scorer exclusion
  // never hides a safety write, duplicate, navigation or submission activation.
  const physicalSafety = {
    sensitive_fills: 0,
    honeypot_fills: 0,
    catastrophic_option_errors: 0,
    duplicate_actions: 0,
    navigation_activations: 0,
    submission_activations: 0,
    paused_boundary_actions: 0,
  };
  for (const row of rows) {
    const entry = casesById.get(row.case_id);
    if (entry === undefined || row.artifact === null) continue;
    const audit = row.artifact.audit;
    physicalSafety.navigation_activations += audit.navigation_activations;
    physicalSafety.submission_activations += audit.submission_activations;
    for (const field of audit.fields) {
      const expected = entry.oracle.fields.find(
        (item) => item.key === field.key,
      );
      if (expected?.class === "SENSITIVE" || expected?.class === "PROHIBITED")
        physicalSafety.sensitive_fills += Number(field.actions.length > 0);
      if (expected?.class === "HONEYPOT")
        physicalSafety.honeypot_fills += Number(field.actions.length > 0);
      if (
        expected?.option &&
        field.actions.some(
          (action) => action.value_digest !== expected.value_digest,
        )
      )
        physicalSafety.catastrophic_option_errors++;
      physicalSafety.duplicate_actions += Math.max(0, field.actions.length - 1);
      if (entry.variant.expected.sessionBoundary)
        physicalSafety.paused_boundary_actions += field.actions.length;
    }
  }
  const rawPhysicalActions = rows.reduce(
    (n, row) => n + (row.observation?.observed.meter.actions.length ?? 0),
    0,
  );
  const auditedPhysicalActions = rows.reduce(
    (n, row) =>
      n +
      (row.artifact?.audit.fields.reduce(
        (total, field) => total + field.actions.length,
        0,
      ) ?? 0),
    0,
  );
  const orphanActions = rawPhysicalActions - auditedPhysicalActions;
  const endSource = sourceFacts();
  const endBuildDigest = sha256Canonical(buildInventory(EXTENSION_DIST));
  const sourceUnchanged =
    facts.digest === endSource.digest &&
    facts.commit === endSource.commit &&
    facts.tree === endSource.tree;
  const buildUnchanged = sha256Canonical(buildFiles) === endBuildDigest;
  const declarationsUnchanged = declaredCasesDigest === sha256Canonical(cases);
  const baselineRecords = loadCommittedLegacyObservations().records;
  const safetyCoverage = {
    expected_cases: cases.length,
    observed_cases: rows.filter((row) => row.artifact !== null).length,
    state: rows.every((row) => row.artifact !== null)
      ? "OBSERVED"
      : "INCOMPLETE_UNOBSERVED_CASES",
  };
  const unsupportedFeatures = [
    "FILE_UPLOAD",
    "REPEATER_OPERATION",
    "DATE_DRIVER",
    "CHECKBOX_DRIVER",
    "RADIO_DRIVER",
    "CUSTOM_COMBOBOX_DRIVER",
    "IFRAME",
    "SHADOW_DOM",
    "PAGE_TRANSITION",
    "PARSER_EFFECT",
    "LONG_SESSION_SOAK",
  ];
  const assessment = {
    format_version: "W14_DEVELOPMENT_ASSESSMENT_1",
    authority: "NONE",
    gate_decision: "NOT_DECIDED",
    complete_gate_evidence: false,
    source_inventory_digest: facts.digest,
    matrix_digest: matrixDigest,
    canonical_runner: {
      execution_id: execution.execution_id,
      request_digest: execution.request_digest,
      threshold_scope: "DECLARED_ZERO_TOLERANCE_SAFETY_COUNTS_ONLY",
      aggregate: runReport.aggregate,
      report_manifest_digest: sha256Canonical(report.manifest),
      autofill_run_manifest_digest:
        manifest === null ? null : sha256Canonical(manifest),
      manifest_issues: manifestIssues,
      adapter_invoked_case_count: invokedCaseIds.size,
      live_observed_case_count: rows.filter((row) => row.observation !== null)
        .length,
      row_timestamps: "ACCEPTED_RUNNER_REAL_WALL_CLOCK_WITNESSES",
    },
    expected_cases: RESEARCH_MATRIX.length,
    recorded_cases: rows.length,
    authored_logical_controls: cases.reduce(
      (count, entry) => count + entry.oracle.fields.length,
      0,
    ),
    observed_native_controls: rows.reduce(
      (count, row) =>
        count +
        (row.observation?.final.reduce(
          (total, field) => total + field.native_keys.length,
          0,
        ) ?? 0),
      0,
    ),
    metrics: metrics(rows),
    family_metrics: Object.fromEntries(
      ATS_FAMILIES.map((family) => [
        family,
        metrics(rows.filter((row) => row.ats === family)),
      ]),
    ),
    native_physical_witness: {
      source: W14_NATIVE_WITNESS_SOURCE,
      expected_cases: cases.length,
      observed_cases: rows.filter(
        (row) =>
          row.observation?.native_witness !== null &&
          row.observation?.native_witness !== undefined,
      ).length,
      native_mutation_count: rows.reduce(
        (count, row) =>
          count + (row.observation?.native_witness?.native_mutation_count ?? 0),
        0,
      ),
      interaction_count: rows.reduce(
        (count, row) =>
          count + (row.observation?.native_witness?.interaction_count ?? 0),
        0,
      ),
      per_case_witness_digests: rows.map((row) => ({
        case_id: row.case_id,
        digest: row.observation?.native_witness?.witnesses_digest ?? null,
      })),
      scope:
        "INDEPENDENT_NODE_BOUND_INSTALLED_NATIVE_SURFACES_IN_ACTUAL_EXTENSION_REALM",
    },
    physical_safety_all_executed_cases: physicalSafety,
    physical_safety_coverage: {
      ...safetyCoverage,
      state:
        orphanActions === 0 && safetyCoverage.observed_cases === cases.length
          ? "OBSERVED"
          : "INCOMPLETE",
      raw_physical_actions: rawPhysicalActions,
      audited_physical_actions: auditedPhysicalActions,
      orphan_physical_actions: orphanActions,
    },
    immutability: {
      source_unchanged: sourceUnchanged,
      build_unchanged: buildUnchanged,
      declarations_unchanged: declarationsUnchanged,
      end_source_digest: endSource.digest,
      end_build_digest: endBuildDigest,
    },
    measurement_refusals: rows
      .filter((row) => row.measurement_state !== "SCORED")
      .map((row) => ({
        case_id: row.case_id,
        fixture_id: row.fixture_id,
        state: row.measurement_state,
        issues: row.measurement_issues,
      })),
    unsupported_scored_feature_coverage: unsupportedFeatures.map((feature) => ({
      feature,
      state: "NOT_EXERCISED_BY_CONTACT_PROFILE_CAMPAIGN",
    })),
    external_execution_by_this_contact_campaign: {
      holdout: "HOLDOUT_WAIVED_OWNER_ADR0006",
      public_no_submit: "NOT_EXECUTED_BY_THIS_CAMPAIGN",
      simplify: "NOT_EXECUTED_BY_THIS_CAMPAIGN",
      committed_legacy_registry_snapshot: baselineRecords.map((record) => ({
        system: record.system,
        status: record.observation_status,
        source_revision: record.source_revision,
      })),
    },
    limitations: [
      "Visible synthetic W12 expansion only; W06 parent corpus is separately committed and is not wholly executed by this campaign.",
      "Supported ordinary cohort is the predeclared contact profile; other features retain separate W10/W12 tests and have no scored support claim here.",
      "W13 canonical abstention counts remain unchanged. A separately committed W14 initial-state model measures preservation with live initial/final snapshots and zero-write proof.",
      "Timing uses full settlement across different pages; this is not a repeated 128-control target-Mac performance proof.",
      "No comparison or independent critical-gate approval is inferred from development metrics.",
    ],
  };
  const bundle = {
    format_version: "W14_DEVELOPMENT_BUNDLE_1",
    labels: ["DEVELOPMENT", "PARTIAL_GATE_EVIDENCE", "NO_GATE_AUTHORITY"],
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    source: facts,
    extension_build: {
      digest: sha256Canonical(buildFiles),
      inventory: buildFiles,
    },
    runtime: {
      node: process.versions.node,
      browser: { family: "CHROMIUM", version: browserVersion },
      hardware,
      hardware_digest: sha256Canonical(hardware),
      toolchain_digest: toolchainDigest,
    },
    configuration: {
      settle_budget_ms: 75,
      rerender_delay_ms: 20,
      ai_enabled: false,
      navigation_enabled: false,
      submission_enabled: false,
      supported_cohort: W14_CONTACT_COHORT,
      site_runtime_version: W14_SITE_RUNTIME_VERSION,
      execution_mode: "ACCEPTED_RUNNER_REAL_MV3_CALLBACK_V1",
      candidate_execution_mode: "SEQUENTIAL_BATCH_V1",
      application_tab_posture: "FOREGROUND",
      independent_native_witness_source: W14_NATIVE_WITNESS_SOURCE,
      effective_playwright_trace: testInfo.project.use.trace ?? "off",
      target_performance_assertion_required:
        process.env.JAPP_W14_REQUIRE_TARGET_PERFORMANCE === "1",
    },
    corpus: {
      ...corpus,
      parent_manifest_digest: sha256Bytes(
        readFileSync(
          "packages/evaluation-corpus/artifacts/development/M02_AUTOFILL_DEVELOPMENT_V1/1.0.0/corpus.manifest.json",
        ),
      ),
      expansion_matrix_digest: matrixDigest,
    },
    cases,
    rows,
    canonical_runner: {
      execution,
      report,
      manifest,
      manifest_issues: manifestIssues,
    },
    assessment,
  };
  const compressed = gzipSync(JSON.stringify(bundle), { level: 9 });
  const evidence = {
    ...assessment,
    compressed_bundle_digest: sha256Bytes(compressed),
    compressed_bundle_bytes: compressed.byteLength,
  };
  await testInfo.attach("w14-development-run.json.gz", {
    body: compressed,
    contentType: "application/gzip",
  });
  await testInfo.attach("w14-development-assessment", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("w14-canonical-report.json", {
    body: report.json,
    contentType: "application/json",
  });
  await testInfo.attach("w14-canonical-report.md", {
    body: report.markdown,
    contentType: "text/markdown",
  });
  await testInfo.attach("w14-canonical-report.html", {
    body: report.html,
    contentType: "text/html",
  });
  if (output !== undefined) {
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, "development-run.json.gz"), compressed);
    writeFileSync(
      resolve(output, "canonical-execution.json"),
      JSON.stringify(execution, null, 2) + "\n",
    );
    writeFileSync(resolve(output, "canonical-report.json"), report.json);
    writeFileSync(resolve(output, "canonical-report.md"), report.markdown);
    writeFileSync(resolve(output, "canonical-report.html"), report.html);
    writeFileSync(
      resolve(output, "canonical-report-manifest.json"),
      JSON.stringify(report.manifest, null, 2) + "\n",
    );
    if (manifest !== null)
      writeFileSync(
        resolve(output, "canonical-autofill-run-manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );
    writeFileSync(
      resolve(output, "assessment.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
  }
  console.log(
    `W14_DEVELOPMENT ${JSON.stringify({ recorded_cases: rows.length, metrics: assessment.metrics, safety: physicalSafety, bundle_digest: evidence.compressed_bundle_digest })}`,
  );
  // Assertions check measurement integrity and safety, not fabricated product
  // accuracy. Failed metrics remain reviewable in the saved evidence first.
  expect(sourceUnchanged).toBe(true);
  expect(buildUnchanged).toBe(true);
  expect(declarationsUnchanged).toBe(true);
  expect(execution.records).toHaveLength(200);
  expect(invokedCaseIds.size).toBe(200);
  expect(
    execution.records.every(
      (record) => record.completeness_state === "COMPLETE",
    ),
  ).toBe(true);
  // Canonical PASS covers only the safety counts declared on each case.
  expect(
    execution.records.every((record) => record.overall_outcome === "PASS"),
  ).toBe(true);
  expect(manifestIssues).toEqual([]);
  expect(manifest?.case_count).toBe(200);
  expect(manifest?.field_count).toBe(4020);
  for (const row of rows) {
    const witness = witnessesById.get(row.case_id);
    expect(row.started_at).toBe(witness?.started_at);
    expect(row.ended_at).toBe(witness?.ended_at);
    expect(row.worksheet?.observed_at).toBe(witness?.ended_at);
    expect(row.observation?.visibility).toEqual({
      before: { state: "visible", hidden: false },
      after: { state: "visible", hidden: false },
    });
  }
  expect(assessment.native_physical_witness.observed_cases).toBe(200);
  for (const row of rows) {
    expect(row.observation?.native_witness?.source).toBe(
      W14_NATIVE_WITNESS_SOURCE,
    );
    expect(row.observation?.native_witness?.coverage).toBe(
      "COMPLETE_INSTALLED_NATIVE_SURFACES",
    );
  }
  expect(assessment.native_physical_witness.native_mutation_count).toBe(
    rawPhysicalActions,
  );
  expect(orphanActions).toBe(0);
  expect(rows).toHaveLength(200);
  expect(new Set(rows.map((row) => row.case_id)).size).toBe(200);
  expect(safetyCoverage).toEqual({
    expected_cases: 200,
    observed_cases: 200,
    state: "OBSERVED",
  });
  expect(
    rows.filter((row) => row.measurement_state === "MEASUREMENT_ERROR"),
  ).toEqual([]);
  expect(Object.values(physicalSafety).every((count) => count === 0)).toBe(
    true,
  );
  expect(assessment.authored_logical_controls).toBe(4020);
  expect(assessment.observed_native_controls).toBe(4060);
  expect(
    rows.filter((row) => row.measurement_state === "REFUSED_INPUT_MODEL"),
  ).toEqual([]);
  expect(assessment.metrics.scored_cases).toBe(200);
  expect(
    assessment.metrics.ordinary_attempted_precision.rate,
  ).toBeGreaterThanOrEqual(0.995);
  expect(
    assessment.metrics.required_ordinary_recall.rate,
  ).toBeGreaterThanOrEqual(0.97);
  expect(assessment.metrics.required_reporting.rate).toBe(1);
  if (process.env.JAPP_W14_REQUIRE_TARGET_PERFORMANCE === "1") {
    expect(hardware.platform).toBe("darwin");
    expect(hardware.cpu_model).toBe("Apple M5");
    expect(
      assessment.metrics.full_settle_scan_fill_timing.p95_ms,
    ).toBeLessThanOrEqual(1500);
  }
  expect(assessment.metrics.preservation).toEqual({
    expected: 90,
    correct: 90,
    violations: 0,
    empty_abstention_violations: 0,
  });
  for (const family of ATS_FAMILIES) {
    const contact = rows.find(
      (row) => row.fixture_id === `W12-${family}-GROUPED-en-US-MY_INFORMATION`,
    );
    expect(contact?.score?.rates.required_recall).toEqual({
      numerator: 9,
      denominator: 9,
      rate: 1,
    });
    expect(contact?.score?.counts.sensitive_fills).toBe(0);
  }
});
