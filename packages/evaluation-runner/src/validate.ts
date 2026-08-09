import {
  validateBenchmarkCaseV1,
  validateErrorTaxonomyV1ErrorCode,
  validateSemanticContractV1,
} from "@japp/contracts/generated";

import {
  canonicalJsonBytes,
  compareCanonicalText,
  isContentDigest,
  sha256Canonical,
  type ContentDigest,
} from "./canonical.ts";
import {
  DEVELOPMENT_HOLDOUT_COMMITMENT,
  EXECUTION_REQUEST_FORMAT_VERSION,
  MAX_USER_LIMITATIONS,
  REPORT_FORMAT_VERSION,
  SUPPORTED_METRIC_UNITS,
} from "./constants.ts";
import { runnerFail } from "./errors.ts";
import type {
  AdapterObservationV1,
  BenchmarkCaseV1,
  ErrorTaxonomyV1ErrorCode,
  ExecutionRequestV1,
  RunnerTrustedContextV1,
} from "./model.ts";
import { computeThresholdSetDigest, measuredProportion } from "./thresholds.ts";

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_OBJECT = /^[0-9a-f]{40}$/u;
const STABLE_ID = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/u;
const ENUM_TOKEN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const INERT_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/u;
const FORBIDDEN_REPORT_VALUE =
  /(?:https?:\/\/|(?:^|[\s("'`])(?:\/(?:Users|home|root|tmp|private|var|etc|opt)\/|[A-Za-z]:[\\/])|\b(?:password|passwd|credential|secret|api[_ -]?key|bearer)\s*[:=])/iu;

function containsForbiddenControl(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 0x08 ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f) ||
      codePoint === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

function objectAt(value: unknown, pointer: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return runnerFail("RUNNER_TYPE_MISMATCH", pointer, "expected an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  pointer: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !(key in record));
  if (unknown.length > 0) {
    runnerFail(
      "RUNNER_UNKNOWN_FIELD",
      pointer,
      `unknown fields: ${unknown.sort().join(",")}`,
    );
  }
  if (missing.length > 0) {
    runnerFail(
      "RUNNER_MISSING_FIELD",
      pointer,
      `missing fields: ${missing.sort().join(",")}`,
    );
  }
}

function stringAt(value: unknown, pointer: string): string {
  if (typeof value !== "string") {
    return runnerFail("RUNNER_TYPE_MISMATCH", pointer, "expected a string");
  }
  return value;
}

function booleanAt(value: unknown, pointer: string): boolean {
  if (typeof value !== "boolean") {
    return runnerFail("RUNNER_TYPE_MISMATCH", pointer, "expected a boolean");
  }
  return value;
}

function arrayAt(value: unknown, pointer: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return runnerFail("RUNNER_TYPE_MISMATCH", pointer, "expected an array");
  }
  return value;
}

function literalAt<T extends string>(
  value: unknown,
  allowed: readonly T[],
  pointer: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return runnerFail(
      "RUNNER_UNSUPPORTED_VALUE",
      pointer,
      `expected one of ${allowed.join(",")}`,
    );
  }
  return value as T;
}

function digestAt(value: unknown, pointer: string): ContentDigest {
  if (!isContentDigest(value)) {
    return runnerFail(
      "RUNNER_DIGEST_FORMAT",
      pointer,
      "expected sha256 followed by 64 lowercase hexadecimal digits",
    );
  }
  return value;
}

function semverAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!SEMVER.test(text)) {
    return runnerFail(
      "RUNNER_VERSION_FORMAT",
      pointer,
      "expected strict semantic version text",
    );
  }
  return text;
}

function gitObjectAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!GIT_OBJECT.test(text)) {
    return runnerFail(
      "RUNNER_GIT_OBJECT_FORMAT",
      pointer,
      "expected a full 40-character lowercase Git object id",
    );
  }
  return text;
}

function stableIdAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!STABLE_ID.test(text)) {
    return runnerFail(
      "RUNNER_STABLE_ID_FORMAT",
      pointer,
      "expected a canonical namespaced stable id",
    );
  }
  return text;
}

function enumTokenAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (text.length > 64 || !ENUM_TOKEN.test(text)) {
    return runnerFail(
      "RUNNER_ENUM_TOKEN_FORMAT",
      pointer,
      "expected an uppercase enum token",
    );
  }
  return text;
}

function identityAt(value: unknown, pointer: string): string {
  const text = stringAt(value, pointer);
  if (!INERT_IDENTITY.test(text)) {
    return runnerFail(
      "RUNNER_IDENTITY_FORMAT",
      pointer,
      "identity must be inert and cannot contain a path, URL, or command",
    );
  }
  return text;
}

function reportTextAt(
  value: unknown,
  pointer: string,
  maximum: number,
): string {
  const text = stringAt(value, pointer);
  if (
    text.length < 1 ||
    text.length > maximum ||
    containsForbiddenControl(text) ||
    FORBIDDEN_REPORT_VALUE.test(text)
  ) {
    return runnerFail(
      "RUNNER_REPORT_TEXT_BOUNDARY",
      pointer,
      "report text is empty, oversized, contains controls, a remote URL, an environment-specific absolute path, or credential-shaped data",
    );
  }
  return text;
}

function boundedMetricAt(value: unknown, pointer: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000_000
  ) {
    return runnerFail(
      "RUNNER_METRIC_VALUE",
      pointer,
      "metric must be a finite number from 0 through 1000000000000",
    );
  }
  return value;
}

function countAt(value: unknown, pointer: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return runnerFail(
      "RUNNER_COUNT_VALUE",
      pointer,
      "count must be a non-negative safe integer",
    );
  }
  return value;
}

function assertUnique(
  values: readonly string[],
  pointer: string,
  code: string,
): void {
  if (new Set(values).size !== values.length) {
    runnerFail(code, pointer, "duplicate identities are forbidden");
  }
}

function validateRuntime(value: unknown): void {
  const runtime = objectAt(value, "/runtime");
  exactKeys(
    runtime,
    [
      "environment_state",
      "runtime_family",
      "runtime_version",
      "platform_profile",
      "toolchain_digest",
      "operating_system",
      "architecture",
    ],
    ["model_profile_ref", "model_digest", "browser"],
    "/runtime",
  );
  literalAt(
    runtime.environment_state,
    ["KNOWN", "UNKNOWN"],
    "/runtime/environment_state",
  );
  enumTokenAt(runtime.runtime_family, "/runtime/runtime_family");
  identityAt(runtime.runtime_version, "/runtime/runtime_version");
  enumTokenAt(runtime.platform_profile, "/runtime/platform_profile");
  digestAt(runtime.toolchain_digest, "/runtime/toolchain_digest");
  enumTokenAt(runtime.operating_system, "/runtime/operating_system");
  enumTokenAt(runtime.architecture, "/runtime/architecture");
  if (runtime.model_profile_ref !== undefined) {
    stableIdAt(runtime.model_profile_ref, "/runtime/model_profile_ref");
  }
  if (runtime.model_digest !== undefined) {
    digestAt(runtime.model_digest, "/runtime/model_digest");
  }
  if (
    (runtime.model_profile_ref === undefined) !==
    (runtime.model_digest === undefined)
  ) {
    runnerFail(
      "RUNNER_MODEL_METADATA_PAIR",
      "/runtime",
      "model profile reference and digest must be committed together",
    );
  }
  if (runtime.browser !== undefined) {
    const browser = objectAt(runtime.browser, "/runtime/browser");
    exactKeys(browser, ["family", "version"], [], "/runtime/browser");
    enumTokenAt(browser.family, "/runtime/browser/family");
    identityAt(browser.version, "/runtime/browser/version");
  }
}

function validateHoldout(value: unknown): void {
  const holdout = objectAt(value, "/holdout");
  const policy = literalAt(
    holdout.policy,
    ["DEVELOPMENT_NOT_APPLICABLE_V1", "CALLER_SUPPLIED_MANIFEST_V1"],
    "/holdout/policy",
  );
  if (policy === "DEVELOPMENT_NOT_APPLICABLE_V1") {
    exactKeys(
      holdout,
      ["policy", "state", "development_commitment_digest"],
      [],
      "/holdout",
    );
    literalAt(holdout.state, ["NOT_APPLICABLE"], "/holdout/state");
    const actual = digestAt(
      holdout.development_commitment_digest,
      "/holdout/development_commitment_digest",
    );
    const expected = sha256Canonical(DEVELOPMENT_HOLDOUT_COMMITMENT);
    if (actual !== expected) {
      runnerFail(
        "RUNNER_DEVELOPMENT_HOLDOUT_COMMITMENT",
        "/holdout/development_commitment_digest",
        "development NOT_APPLICABLE commitment does not match the reviewed W05 policy",
      );
    }
    return;
  }
  exactKeys(
    holdout,
    ["policy", "state", "manifest_id", "manifest_digest"],
    [],
    "/holdout",
  );
  literalAt(
    holdout.state,
    ["INVALID", "UNAVAILABLE", "VALID"],
    "/holdout/state",
  );
  stableIdAt(holdout.manifest_id, "/holdout/manifest_id");
  digestAt(holdout.manifest_digest, "/holdout/manifest_digest");
}

function validateOutputPolicy(value: unknown): void {
  const policy = objectAt(value, "/output_policy");
  exactKeys(
    policy,
    [
      "report_format_version",
      "unexpected_metric_policy",
      "formats",
      "report_title",
      "limitations",
    ],
    [],
    "/output_policy",
  );
  literalAt(
    policy.report_format_version,
    [REPORT_FORMAT_VERSION],
    "/output_policy/report_format_version",
  );
  literalAt(
    policy.unexpected_metric_policy,
    ["REJECT"],
    "/output_policy/unexpected_metric_policy",
  );
  const formats = arrayAt(policy.formats, "/output_policy/formats");
  if (
    formats.length !== 3 ||
    formats[0] !== "JSON" ||
    formats[1] !== "MARKDOWN" ||
    formats[2] !== "HTML"
  ) {
    runnerFail(
      "RUNNER_OUTPUT_FORMATS",
      "/output_policy/formats",
      "runner format 1.0.0 emits JSON, MARKDOWN, and HTML in that order",
    );
  }
  reportTextAt(policy.report_title, "/output_policy/report_title", 160);
  const limitations = arrayAt(policy.limitations, "/output_policy/limitations");
  if (limitations.length > MAX_USER_LIMITATIONS) {
    runnerFail(
      "RUNNER_LIMITATION_COUNT",
      "/output_policy/limitations",
      `at most ${String(MAX_USER_LIMITATIONS)} limitations are accepted`,
    );
  }
  limitations.forEach((entry, index) =>
    reportTextAt(entry, `/output_policy/limitations/${String(index)}`, 512),
  );
}

export function validateExecutionRequest(input: unknown): ExecutionRequestV1 {
  const root = objectAt(input, "");
  exactKeys(
    root,
    [
      "runner_format_version",
      "cases",
      "case_commitments",
      "repository",
      "schema",
      "corpus",
      "holdout",
      "runtime",
      "runtime_commitment_digest",
      "implementation",
      "adapter",
      "clock",
      "prompt_commitments",
      "output_policy",
    ],
    [],
    "",
  );
  literalAt(
    root.runner_format_version,
    [EXECUTION_REQUEST_FORMAT_VERSION],
    "/runner_format_version",
  );

  const repository = objectAt(root.repository, "/repository");
  exactKeys(
    repository,
    ["commit", "tree", "runner_source_digest"],
    [],
    "/repository",
  );
  gitObjectAt(repository.commit, "/repository/commit");
  gitObjectAt(repository.tree, "/repository/tree");
  digestAt(repository.runner_source_digest, "/repository/runner_source_digest");

  const schema = objectAt(root.schema, "/schema");
  exactKeys(
    schema,
    ["manifest_digest", "generator_format_version"],
    [],
    "/schema",
  );
  digestAt(schema.manifest_digest, "/schema/manifest_digest");
  semverAt(schema.generator_format_version, "/schema/generator_format_version");

  const corpus = objectAt(root.corpus, "/corpus");
  exactKeys(corpus, ["version", "digest"], [], "/corpus");
  semverAt(corpus.version, "/corpus/version");
  digestAt(corpus.digest, "/corpus/digest");

  validateHoldout(root.holdout);
  validateRuntime(root.runtime);
  const runtimeDigest = digestAt(
    root.runtime_commitment_digest,
    "/runtime_commitment_digest",
  );
  if (runtimeDigest !== sha256Canonical(root.runtime)) {
    runnerFail(
      "RUNNER_RUNTIME_DIGEST_MISMATCH",
      "/runtime_commitment_digest",
      "runtime commitment digest does not match runtime metadata",
    );
  }

  const implementation = objectAt(root.implementation, "/implementation");
  exactKeys(
    implementation,
    ["kind", "identity", "version", "source_digest"],
    [],
    "/implementation",
  );
  literalAt(
    implementation.kind,
    ["BASELINE", "IMPLEMENTATION"],
    "/implementation/kind",
  );
  identityAt(implementation.identity, "/implementation/identity");
  semverAt(implementation.version, "/implementation/version");
  digestAt(implementation.source_digest, "/implementation/source_digest");

  const adapter = objectAt(root.adapter, "/adapter");
  exactKeys(adapter, ["identity", "version"], [], "/adapter");
  identityAt(adapter.identity, "/adapter/identity");
  semverAt(adapter.version, "/adapter/version");

  const clock = objectAt(root.clock, "/clock");
  exactKeys(clock, ["identity", "version"], [], "/clock");
  identityAt(clock.identity, "/clock/identity");
  semverAt(clock.version, "/clock/version");

  const promptCommitments = arrayAt(
    root.prompt_commitments,
    "/prompt_commitments",
  );
  if (promptCommitments.length > 64) {
    runnerFail(
      "RUNNER_PROMPT_COUNT",
      "/prompt_commitments",
      "at most 64 prompt commitments are accepted",
    );
  }
  const promptIds: string[] = [];
  for (const [index, entry] of promptCommitments.entries()) {
    const prompt = objectAt(entry, `/prompt_commitments/${String(index)}`);
    exactKeys(
      prompt,
      ["prompt_id", "version", "digest"],
      [],
      `/prompt_commitments/${String(index)}`,
    );
    promptIds.push(
      identityAt(
        prompt.prompt_id,
        `/prompt_commitments/${String(index)}/prompt_id`,
      ),
    );
    semverAt(prompt.version, `/prompt_commitments/${String(index)}/version`);
    digestAt(prompt.digest, `/prompt_commitments/${String(index)}/digest`);
  }
  assertUnique(promptIds, "/prompt_commitments", "RUNNER_DUPLICATE_PROMPT");

  validateOutputPolicy(root.output_policy);

  const cases = arrayAt(root.cases, "/cases");
  const commitments = arrayAt(root.case_commitments, "/case_commitments");
  if (cases.length < 1 || cases.length > 10_000) {
    runnerFail(
      "RUNNER_CASE_COUNT",
      "/cases",
      "execution requests require 1 through 10000 finite cases",
    );
  }
  if (commitments.length !== cases.length) {
    runnerFail(
      "RUNNER_CASE_COMMITMENT_COUNT",
      "/case_commitments",
      "every case requires exactly one commitment",
    );
  }
  const commitmentMap = new Map<string, ContentDigest>();
  for (const [index, entry] of commitments.entries()) {
    const commitment = objectAt(entry, `/case_commitments/${String(index)}`);
    exactKeys(
      commitment,
      ["case_id", "case_digest"],
      [],
      `/case_commitments/${String(index)}`,
    );
    const id = stableIdAt(
      commitment.case_id,
      `/case_commitments/${String(index)}/case_id`,
    );
    if (commitmentMap.has(id)) {
      runnerFail(
        "RUNNER_DUPLICATE_CASE_COMMITMENT",
        `/case_commitments/${String(index)}/case_id`,
        `duplicate case commitment ${id}`,
      );
    }
    commitmentMap.set(
      id,
      digestAt(
        commitment.case_digest,
        `/case_commitments/${String(index)}/case_digest`,
      ),
    );
  }

  const caseIds: string[] = [];
  for (const [index, rawCase] of cases.entries()) {
    const structural = validateBenchmarkCaseV1(rawCase);
    if (!structural.valid) {
      runnerFail(
        "RUNNER_BENCHMARK_CASE_STRUCTURE",
        `/cases/${String(index)}`,
        structural.errors.join("; "),
      );
    }
    const semantic = validateSemanticContractV1(
      "urn:japp:schema:benchmark:case:v1",
      structural.value,
    );
    if (!semantic.valid) {
      runnerFail(
        "RUNNER_BENCHMARK_CASE_SEMANTIC",
        `/cases/${String(index)}`,
        semantic.issues.map((issue) => issue.rule_id).join(","),
      );
    }
    const benchmarkCase = structural.value;
    caseIds.push(benchmarkCase.case_id);
    if (
      benchmarkCase.corpus_version !== corpus.version ||
      benchmarkCase.corpus_digest !== corpus.digest
    ) {
      runnerFail(
        "RUNNER_CORPUS_MISMATCH",
        `/cases/${String(index)}/corpus_digest`,
        "case corpus identity differs from the execution commitment",
      );
    }
    const thresholdDigest = computeThresholdSetDigest(benchmarkCase);
    if (thresholdDigest !== benchmarkCase.threshold_set_digest) {
      runnerFail(
        "RUNNER_THRESHOLD_DIGEST_MISMATCH",
        `/cases/${String(index)}/threshold_set_digest`,
        "threshold payload differs from its immutable commitment",
      );
    }
    const caseDigest = sha256Canonical(benchmarkCase);
    if (commitmentMap.get(benchmarkCase.case_id) !== caseDigest) {
      runnerFail(
        "RUNNER_CASE_DIGEST_MISMATCH",
        `/case_commitments/${benchmarkCase.case_id}`,
        "case bytes differ from the supplied commitment",
      );
    }
    const holdout = objectAt(root.holdout, "/holdout");
    if (
      holdout.policy === "DEVELOPMENT_NOT_APPLICABLE_V1" &&
      (!benchmarkCase.synthetic_data ||
        benchmarkCase.holdout_visibility !== "PUBLIC_SYNTHETIC")
    ) {
      runnerFail(
        "RUNNER_DEVELOPMENT_HOLDOUT_SCOPE",
        `/cases/${String(index)}/holdout_visibility`,
        "pre-W06 NOT_APPLICABLE mode accepts public synthetic cases only",
      );
    }
  }
  assertUnique(caseIds, "/cases", "RUNNER_DUPLICATE_CASE_ID");
  if (commitmentMap.size !== caseIds.length) {
    runnerFail(
      "RUNNER_ORPHAN_CASE_COMMITMENT",
      "/case_commitments",
      "a commitment does not bind an execution case",
    );
  }

  const validated = structuredClone(root) as unknown as ExecutionRequestV1;
  return deepFreeze({
    ...validated,
    cases: [...validated.cases].sort((left, right) =>
      compareCanonicalText(left.case_id, right.case_id),
    ),
    case_commitments: [...validated.case_commitments].sort((left, right) =>
      compareCanonicalText(left.case_id, right.case_id),
    ),
    prompt_commitments: [...validated.prompt_commitments].sort((left, right) =>
      compareCanonicalText(left.prompt_id, right.prompt_id),
    ),
  });
}

export function validateTrustedContext(
  request: ExecutionRequestV1,
  context: RunnerTrustedContextV1,
): void {
  gitObjectAt(context.repository_commit, "/trusted/repository_commit");
  gitObjectAt(context.repository_tree, "/trusted/repository_tree");
  digestAt(context.runner_source_digest, "/trusted/runner_source_digest");
  digestAt(context.schema_manifest_digest, "/trusted/schema_manifest_digest");
  semverAt(
    context.generator_format_version,
    "/trusted/generator_format_version",
  );
  semverAt(context.corpus.version, "/trusted/corpus/version");
  digestAt(context.corpus.digest, "/trusted/corpus/digest");
  validateHoldout(context.holdout);
  digestAt(
    context.runtime_commitment_digest,
    "/trusted/runtime_commitment_digest",
  );
  identityAt(
    context.implementation.identity,
    "/trusted/implementation/identity",
  );
  semverAt(context.implementation.version, "/trusted/implementation/version");
  digestAt(
    context.implementation.source_digest,
    "/trusted/implementation/source_digest",
  );
  const mismatches = [
    request.repository.commit === context.repository_commit
      ? null
      : "repository_commit",
    request.repository.tree === context.repository_tree
      ? null
      : "repository_tree",
    request.repository.runner_source_digest === context.runner_source_digest
      ? null
      : "runner_source_digest",
    request.schema.manifest_digest === context.schema_manifest_digest
      ? null
      : "schema_manifest_digest",
    request.schema.generator_format_version === context.generator_format_version
      ? null
      : "generator_format_version",
    sha256Canonical(request.corpus) === sha256Canonical(context.corpus)
      ? null
      : "corpus",
    sha256Canonical(request.holdout) === sha256Canonical(context.holdout)
      ? null
      : "holdout",
    request.runtime_commitment_digest === context.runtime_commitment_digest
      ? null
      : "runtime_commitment_digest",
    sha256Canonical(request.implementation) ===
    sha256Canonical(context.implementation)
      ? null
      : "implementation",
  ].filter((entry): entry is string => entry !== null);
  if (mismatches.length > 0) {
    runnerFail(
      "RUNNER_TRUSTED_CONTEXT_MISMATCH",
      "/trusted",
      `serialized provenance differs from trusted context: ${mismatches.join(",")}`,
    );
  }
}

export function parseCanonicalExecutionRequestJson(
  source: string,
): ExecutionRequestV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return runnerFail(
      "RUNNER_JSON_PARSE",
      "",
      "execution request is not valid JSON",
    );
  }
  if (source !== canonicalJsonBytes(parsed)) {
    return runnerFail(
      "RUNNER_NONCANONICAL_JSON",
      "",
      "request JSON must use sorted keys, canonical numeric text, UTF-8-compatible text, and one LF",
    );
  }
  return validateExecutionRequest(parsed);
}

export function validateAdapterObservation(
  input: unknown,
  request: ExecutionRequestV1,
  benchmarkCase: BenchmarkCaseV1,
): AdapterObservationV1 {
  const root = objectAt(input, "/observation");
  exactKeys(
    root,
    [
      "observation_format_version",
      "status",
      "metrics",
      "artifact_observations",
      "artifact_report_digests",
      "failure_error_codes",
      "used_prompt_ids",
      "model_participated",
      "browser_participated",
      "peak_memory_bytes",
      "paired_counts",
    ],
    [],
    "/observation",
  );
  literalAt(
    root.observation_format_version,
    ["1.0.0"],
    "/observation/observation_format_version",
  );
  const status = literalAt(
    root.status,
    ["COMPLETE", "FAILED_SETUP", "PARTIAL"],
    "/observation/status",
  );

  const metrics = arrayAt(root.metrics, "/observation/metrics");
  if (metrics.length > 128) {
    runnerFail(
      "RUNNER_METRIC_COUNT",
      "/observation/metrics",
      "at most 128 metrics are accepted",
    );
  }
  const metricIds: string[] = [];
  const thresholdMap = new Map(
    benchmarkCase.thresholds.map((threshold) => [
      threshold.metric_id,
      threshold,
    ]),
  );
  for (const [index, entry] of metrics.entries()) {
    const metric = objectAt(entry, `/observation/metrics/${String(index)}`);
    exactKeys(
      metric,
      ["metric_id", "measured_value", "unit"],
      ["proportion_counts"],
      `/observation/metrics/${String(index)}`,
    );
    const id = enumTokenAt(
      metric.metric_id,
      `/observation/metrics/${String(index)}/metric_id`,
    );
    metricIds.push(id);
    const measuredValue = boundedMetricAt(
      metric.measured_value,
      `/observation/metrics/${String(index)}/measured_value`,
    );
    const unit = literalAt(
      metric.unit,
      SUPPORTED_METRIC_UNITS,
      `/observation/metrics/${String(index)}/unit`,
    );
    let proportionCounts:
      { readonly numerator: number; readonly denominator: number } | undefined;
    if (metric.proportion_counts !== undefined) {
      const counts = objectAt(
        metric.proportion_counts,
        `/observation/metrics/${String(index)}/proportion_counts`,
      );
      exactKeys(
        counts,
        ["numerator", "denominator"],
        [],
        `/observation/metrics/${String(index)}/proportion_counts`,
      );
      proportionCounts = {
        numerator: countAt(
          counts.numerator,
          `/observation/metrics/${String(index)}/proportion_counts/numerator`,
        ),
        denominator: countAt(
          counts.denominator,
          `/observation/metrics/${String(index)}/proportion_counts/denominator`,
        ),
      };
    }
    measuredProportion(
      {
        metric_id: id,
        measured_value: measuredValue,
        unit,
        ...(proportionCounts === undefined
          ? {}
          : { proportion_counts: proportionCounts }),
      },
      `/observation/metrics/${String(index)}`,
    );
    const threshold = thresholdMap.get(id);
    if (threshold === undefined) {
      runnerFail(
        "RUNNER_UNEXPECTED_METRIC",
        `/observation/metrics/${String(index)}/metric_id`,
        "unexpected metrics are rejected",
      );
    }
    if (threshold.unit !== unit) {
      runnerFail(
        "RUNNER_METRIC_UNIT_MISMATCH",
        `/observation/metrics/${String(index)}/unit`,
        "measured and threshold units differ",
      );
    }
  }
  assertUnique(metricIds, "/observation/metrics", "RUNNER_DUPLICATE_METRIC");
  if (status === "FAILED_SETUP" && metrics.length !== 0) {
    runnerFail(
      "RUNNER_SETUP_METRIC_PAYLOAD",
      "/observation/metrics",
      "failed setup cannot claim measured metrics",
    );
  }
  if (status === "PARTIAL" && metrics.length === 0) {
    runnerFail(
      "RUNNER_PARTIAL_WITHOUT_METRIC",
      "/observation/metrics",
      "zero measured metrics is FAILED_SETUP, not PARTIAL",
    );
  }
  if (
    status === "COMPLETE" &&
    (metricIds.length !== thresholdMap.size ||
      [...thresholdMap.keys()].some((id) => !metricIds.includes(id)))
  ) {
    runnerFail(
      "RUNNER_MISSING_METRIC",
      "/observation/metrics",
      "complete observation requires exactly one value for every threshold",
    );
  }

  const artifacts = arrayAt(
    root.artifact_observations,
    "/observation/artifact_observations",
  );
  const artifactRefs: string[] = [];
  const expectedArtifacts = new Set(
    benchmarkCase.input_artifacts.map((artifact) => artifact.artifact_ref),
  );
  for (const [index, entry] of artifacts.entries()) {
    const artifact = objectAt(
      entry,
      `/observation/artifact_observations/${String(index)}`,
    );
    exactKeys(
      artifact,
      ["artifact_ref", "content_digest"],
      [],
      `/observation/artifact_observations/${String(index)}`,
    );
    const ref = stableIdAt(
      artifact.artifact_ref,
      `/observation/artifact_observations/${String(index)}/artifact_ref`,
    );
    if (!expectedArtifacts.has(ref)) {
      runnerFail(
        "RUNNER_UNEXPECTED_ARTIFACT",
        `/observation/artifact_observations/${String(index)}/artifact_ref`,
        "observation references an artifact outside the immutable case",
      );
    }
    artifactRefs.push(ref);
    digestAt(
      artifact.content_digest,
      `/observation/artifact_observations/${String(index)}/content_digest`,
    );
  }
  assertUnique(
    artifactRefs,
    "/observation/artifact_observations",
    "RUNNER_DUPLICATE_ARTIFACT",
  );
  if (status === "FAILED_SETUP" && artifacts.length !== 0) {
    runnerFail(
      "RUNNER_SETUP_ARTIFACT_PAYLOAD",
      "/observation/artifact_observations",
      "failed setup cannot claim observed input hashes",
    );
  }
  if (
    status === "COMPLETE" &&
    (artifactRefs.length !== expectedArtifacts.size ||
      [...expectedArtifacts].some((ref) => !artifactRefs.includes(ref)))
  ) {
    runnerFail(
      "RUNNER_MISSING_ARTIFACT_HASH",
      "/observation/artifact_observations",
      "complete observation requires every case artifact hash",
    );
  }

  const reportDigests = arrayAt(
    root.artifact_report_digests,
    "/observation/artifact_report_digests",
  );
  const reportValues = reportDigests.map((entry, index) =>
    digestAt(entry, `/observation/artifact_report_digests/${String(index)}`),
  );
  assertUnique(
    reportValues,
    "/observation/artifact_report_digests",
    "RUNNER_DUPLICATE_REPORT_DIGEST",
  );
  if (
    reportValues.length > 64 ||
    (status !== "FAILED_SETUP" && reportValues.length < 1)
  ) {
    runnerFail(
      "RUNNER_REPORT_DIGEST_COUNT",
      "/observation/artifact_report_digests",
      "measured observations require 1 through 64 raw report commitments",
    );
  }

  const failureCodes = arrayAt(
    root.failure_error_codes,
    "/observation/failure_error_codes",
  );
  const codes: ErrorTaxonomyV1ErrorCode[] = [];
  for (const [index, entry] of failureCodes.entries()) {
    const validation = validateErrorTaxonomyV1ErrorCode(entry);
    if (!validation.valid) {
      runnerFail(
        "RUNNER_ERROR_CODE",
        `/observation/failure_error_codes/${String(index)}`,
        validation.errors.join("; "),
      );
    }
    if (validation.value.startsWith("GATE_")) {
      runnerFail(
        "RUNNER_GATE_AUTHORITY_FORBIDDEN",
        `/observation/failure_error_codes/${String(index)}`,
        "evaluation adapters cannot inject critical-gate state or authority",
      );
    }
    codes.push(validation.value);
  }
  assertUnique(
    codes,
    "/observation/failure_error_codes",
    "RUNNER_DUPLICATE_ERROR_CODE",
  );
  if (status === "FAILED_SETUP" && codes.length < 1) {
    runnerFail(
      "RUNNER_SETUP_ERROR_REQUIRED",
      "/observation/failure_error_codes",
      "failed setup requires a visible error code",
    );
  }

  const usedPrompts = arrayAt(
    root.used_prompt_ids,
    "/observation/used_prompt_ids",
  );
  const allowedPrompts = new Set(
    request.prompt_commitments.map((prompt) => prompt.prompt_id),
  );
  const usedPromptIds = usedPrompts.map((entry, index) => {
    const id = identityAt(
      entry,
      `/observation/used_prompt_ids/${String(index)}`,
    );
    if (!allowedPrompts.has(id)) {
      runnerFail(
        "RUNNER_PROMPT_COMMITMENT_MISSING",
        `/observation/used_prompt_ids/${String(index)}`,
        "a participating prompt lacks a committed digest",
      );
    }
    return id;
  });
  assertUnique(
    usedPromptIds,
    "/observation/used_prompt_ids",
    "RUNNER_DUPLICATE_PROMPT_USE",
  );

  booleanAt(root.model_participated, "/observation/model_participated");
  booleanAt(root.browser_participated, "/observation/browser_participated");
  if (root.peak_memory_bytes !== null) {
    countAt(root.peak_memory_bytes, "/observation/peak_memory_bytes");
  }

  const pairedCounts = arrayAt(
    root.paired_counts,
    "/observation/paired_counts",
  );
  const groupIds: string[] = [];
  for (const [index, entry] of pairedCounts.entries()) {
    const counts = objectAt(
      entry,
      `/observation/paired_counts/${String(index)}`,
    );
    exactKeys(
      counts,
      ["group_id", "true_positive", "false_positive", "false_negative"],
      [],
      `/observation/paired_counts/${String(index)}`,
    );
    groupIds.push(
      enumTokenAt(
        counts.group_id,
        `/observation/paired_counts/${String(index)}/group_id`,
      ),
    );
    countAt(
      counts.true_positive,
      `/observation/paired_counts/${String(index)}/true_positive`,
    );
    countAt(
      counts.false_positive,
      `/observation/paired_counts/${String(index)}/false_positive`,
    );
    countAt(
      counts.false_negative,
      `/observation/paired_counts/${String(index)}/false_negative`,
    );
  }
  assertUnique(
    groupIds,
    "/observation/paired_counts",
    "RUNNER_DUPLICATE_PAIRED_GROUP",
  );
  if (status === "FAILED_SETUP" && pairedCounts.length !== 0) {
    runnerFail(
      "RUNNER_SETUP_PAIRED_COUNT_PAYLOAD",
      "/observation/paired_counts",
      "failed setup occurs before measurement and cannot claim paired TP/FP/FN counts",
    );
  }

  const validated = structuredClone(root) as unknown as AdapterObservationV1;
  return deepFreeze({
    ...validated,
    metrics: [...validated.metrics].sort((left, right) =>
      compareCanonicalText(left.metric_id, right.metric_id),
    ),
    artifact_observations: [...validated.artifact_observations].sort(
      (left, right) =>
        compareCanonicalText(left.artifact_ref, right.artifact_ref),
    ),
    artifact_report_digests: [...validated.artifact_report_digests].sort(
      compareCanonicalText,
    ),
    failure_error_codes: [...validated.failure_error_codes].sort(
      compareCanonicalText,
    ),
    used_prompt_ids: [...validated.used_prompt_ids].sort(compareCanonicalText),
    paired_counts: [...validated.paired_counts].sort((left, right) =>
      compareCanonicalText(left.group_id, right.group_id),
    ),
  });
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
  }
  return value;
}
