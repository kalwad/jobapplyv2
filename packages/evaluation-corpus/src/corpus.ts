import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { DEV_CASE_MATRIX } from "@japp/evaluation-baselines";

import { FIXTURE_CASES } from "../../../apps/mock-ats-lab/site/src/catalog/cases.ts";
import { EXPECTED_TRANSITIONS } from "../../../e2e/mock-ats-lab/support/expected-transitions.ts";

import {
  canonicalFile,
  compareCodeUnits,
  sha256Bytes,
  sha256Canonical,
  withoutKey,
  type ContentDigest,
} from "./canonical.ts";
import {
  CORPUS_FORMAT_VERSION,
  CORPUS_ID,
  CORPUS_VERSION,
  type ArtifactRole,
  type ArtifactSchemaV1,
  type CorpusArtifactV1,
  type CorpusManifestV1,
  type CoverageSummaryV1,
} from "./model.ts";
import { decodeStrictUtf8, parseStrictJson } from "./strict-json.ts";

export const REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../", import.meta.url),
);
export const CORPUS_DIRECTORY = join(
  REPOSITORY_ROOT,
  "packages/evaluation-corpus/artifacts/development",
  CORPUS_ID,
  CORPUS_VERSION,
);
export const CORPUS_MANIFEST_FILE = join(
  CORPUS_DIRECTORY,
  "corpus.manifest.json",
);
export const COVERAGE_SUMMARY_FILE = join(
  CORPUS_DIRECTORY,
  "coverage-summary.json",
);
export const VERSION_INDEX_FILE = join(
  REPOSITORY_ROOT,
  "packages/evaluation-corpus/artifacts/development/corpus-versions.v1.json",
);

const SOURCE_TREE = "2d52740dc164c51d7b3741b91045095bf92c8441";
const FIXTURE_ROOT = "packages/test-fixtures/data/development";
const FIXTURE_SCHEMA_ROOT = "packages/test-fixtures/schemas";
const MOCK_SITE_ROOT = "apps/mock-ats-lab/site";
const CONTRACT_SCHEMA_ROOT = "packages/contracts/schemas";

interface SourceSpec {
  readonly path: string;
  readonly role: ArtifactRole;
}

interface FixtureSchemaBinding {
  readonly path: string;
  readonly schema_ref: string;
  readonly schema_version: string;
}

function walkFiles(
  root: string,
  accepted: (path: string) => boolean,
): string[] {
  const absolute = join(REPOSITORY_ROOT, root);
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) throw new Error("CORPUS_SOURCE_SYMLINK");
      if (stats.isDirectory()) visit(path);
      else if (stats.isFile()) {
        const logical = relative(REPOSITORY_ROOT, path).split(sep).join("/");
        if (accepted(logical)) output.push(logical);
      } else throw new Error("CORPUS_SOURCE_NONREGULAR");
    }
  };
  visit(absolute);
  return output.sort();
}

function contractSchemaClosure(): string[] {
  const files = walkFiles(CONTRACT_SCHEMA_ROOT, (path) =>
    path.endsWith(".schema.json"),
  );
  const byId = new Map<string, string>();
  for (const path of files) {
    const value = parseJsonFile(path) as { readonly $id?: unknown };
    if (typeof value.$id === "string") byId.set(value.$id, path);
  }
  const roots = [
    "packages/contracts/schemas/benchmark/case.v1.schema.json",
    "packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json",
    "packages/contracts/schemas/benchmark/result.v1.schema.json",
  ];
  const selected = new Set<string>();
  const visit = (path: string): void => {
    if (selected.has(path)) return;
    selected.add(path);
    const text = readText(path);
    for (const match of text.matchAll(
      /"\$ref"\s*:\s*"(urn:japp:schema:[^"#]+)(?:#[^"]*)?"/gu,
    )) {
      const dependency = byId.get(match[1] ?? "");
      if (dependency !== undefined) visit(dependency);
    }
  };
  for (const root of roots) visit(root);
  return [...selected].sort();
}

export function sourceInventory(): readonly SourceSpec[] {
  const fixtureData = walkFiles(FIXTURE_ROOT, (path) => path.endsWith(".json"));
  const fixtureSchemas = walkFiles(FIXTURE_SCHEMA_ROOT, (path) =>
    path.endsWith(".json"),
  );
  const mockSite = walkFiles(
    MOCK_SITE_ROOT,
    (path) =>
      !path.endsWith("/public/favicon.svg") &&
      (path.endsWith(".html") || path.endsWith(".ts") || path.endsWith(".css")),
  );
  const baselineSources = walkFiles(
    "packages/evaluation-baselines/src",
    (path) => path.endsWith(".ts"),
  );
  const specs: SourceSpec[] = [
    ...fixtureData.map((path) => ({ path, role: roleForFixture(path) })),
    ...fixtureSchemas.map((path) => ({
      path,
      role: "SCHEMA_SEMANTICS" as const,
    })),
    {
      path: "packages/test-fixtures/test/m02-w01/oracles/development-truth.v2.json",
      role: "PUBLIC_EXPECTED_TRUTH",
    },
    {
      path: "packages/test-fixtures/test/m02-w02/oracles/answer-truth.v2.json",
      role: "PUBLIC_EXPECTED_TRUTH",
    },
    ...mockSite.map((path) => ({ path, role: "PUBLIC_FORM_VARIANT" as const })),
    {
      path: "apps/mock-ats-lab/catalog.manifest.json",
      role: "PUBLIC_EXPECTED_TRUTH",
    },
    {
      path: "e2e/mock-ats-lab/support/expected-transitions.ts",
      role: "PUBLIC_EXPECTED_TRUTH",
    },
    ...baselineSources.map((path) => ({
      path,
      role: "PUBLIC_BASELINE" as const,
    })),
    {
      path: "packages/evaluation-baselines/baseline.manifest.json",
      role: "PUBLIC_BASELINE",
    },
    {
      path: "packages/evaluation-baselines/data/legacy-observations.v1.json",
      role: "PUBLIC_BASELINE",
    },
    {
      path: "packages/evaluation-baselines/test/m02-w04/oracles/baseline-truth.v1.json",
      role: "PUBLIC_EXPECTED_TRUTH",
    },
    ...contractSchemaClosure().map((path) => ({
      path,
      role: "SCHEMA_SEMANTICS" as const,
    })),
    {
      path: "packages/contracts/generator/semantic-rules.ts",
      role: "SCHEMA_SEMANTICS",
    },
  ];
  const ordered = specs.sort((left, right) =>
    compareCodeUnits(left.path, right.path),
  );
  if (new Set(ordered.map(({ path }) => path)).size !== ordered.length) {
    throw new Error("CORPUS_DUPLICATE_SOURCE");
  }
  return ordered;
}

function fixtureSchemaBindings(): ReadonlyMap<string, FixtureSchemaBinding> {
  const manifest = parseJsonFile(`${FIXTURE_ROOT}/manifest.v2.json`) as {
    readonly schema_ref: string;
    readonly schema_version: string;
    readonly files: readonly FixtureSchemaBinding[];
  };
  return new Map([
    [
      `${FIXTURE_ROOT}/manifest.v2.json`,
      {
        path: "manifest.v2.json",
        schema_ref: manifest.schema_ref,
        schema_version: manifest.schema_version,
      },
    ],
    ...manifest.files.map(
      (binding) => [`${FIXTURE_ROOT}/${binding.path}`, binding] as const,
    ),
  ]);
}

function applicableSchema(
  path: string,
  fixtureBindings: ReadonlyMap<string, FixtureSchemaBinding>,
): ArtifactSchemaV1 {
  const fixture = fixtureBindings.get(path);
  if (fixture !== undefined) {
    return {
      state: "APPLICABLE",
      schema_ref: fixture.schema_ref,
      schema_version: fixture.schema_version,
    };
  }
  if (path.endsWith(".schema.json")) {
    const schema = parseJsonFile(path) as {
      readonly $id?: unknown;
      readonly "x-japp-schema-version"?: unknown;
    };
    if (
      typeof schema.$id !== "string" ||
      typeof schema["x-japp-schema-version"] !== "string"
    ) {
      throw new Error("CORPUS_SCHEMA_METADATA");
    }
    return {
      state: "APPLICABLE",
      schema_ref: schema.$id,
      schema_version: schema["x-japp-schema-version"],
    };
  }
  return { state: "NOT_APPLICABLE" };
}

function roleForFixture(path: string): ArtifactRole {
  if (
    /(?:expected-requirements|expected-supported-claims|unsupported-gaps|field-value-policies|scenario-bundles|answer-constraints|answer-scenarios)\.v2\.json$/u.test(
      path,
    )
  )
    return "PUBLIC_EXPECTED_TRUTH";
  return "PUBLIC_DEVELOPMENT_INPUT";
}

function readText(logicalPath: string): string {
  return decodeStrictUtf8(readFileSync(join(REPOSITORY_ROOT, logicalPath)));
}

function parseJsonFile(logicalPath: string): unknown {
  return parseStrictJson(readText(logicalPath));
}

function recordIds(path: string, text: string): readonly string[] {
  if (
    path.startsWith(`${FIXTURE_ROOT}/`) &&
    !path.endsWith("manifest.v2.json")
  ) {
    const parsed = parseStrictJson(text) as {
      readonly items?: readonly { readonly id?: unknown }[];
    };
    const ids = (parsed.items ?? []).map((item) => {
      if (typeof item.id !== "string") throw new Error("CORPUS_RECORD_ID");
      return item.id;
    });
    return assertSortedUnique(ids);
  }
  if (path === "apps/mock-ats-lab/site/src/catalog/cases.ts") {
    return assertSortedUnique(FIXTURE_CASES.map(({ id }) => id));
  }
  if (path === "packages/evaluation-baselines/src/dev-cases.ts") {
    return assertSortedUnique(
      DEV_CASE_MATRIX.cases.map(({ case_id }) => case_id),
    );
  }
  return [];
}

function assertSortedUnique(values: readonly string[]): readonly string[] {
  const ordered = [...values].sort();
  if (new Set(ordered).size !== ordered.length)
    throw new Error("CORPUS_DUPLICATE_ID");
  return ordered;
}

export function computeArtifacts(): readonly CorpusArtifactV1[] {
  const fixtureBindings = fixtureSchemaBindings();
  return sourceInventory().map(({ path, role }) => {
    const bytes = readFileSync(join(REPOSITORY_ROOT, path));
    const text = decodeStrictUtf8(bytes);
    const ids = recordIds(path, text);
    return {
      path,
      role,
      content_digest: sha256Bytes(bytes),
      byte_count: bytes.byteLength,
      applicable_schema: applicableSchema(path, fixtureBindings),
      record_ids: ids,
      record_count: ids.length,
      expected_truth: role === "PUBLIC_EXPECTED_TRUTH",
    };
  });
}

function schemaInventory(
  artifacts: readonly CorpusArtifactV1[],
): readonly { readonly schema_ref: string; readonly schema_version: string }[] {
  const schemas = new Map<
    string,
    { readonly schema_ref: string; readonly schema_version: string }
  >();
  for (const artifact of artifacts) {
    if (artifact.applicable_schema.state === "APPLICABLE") {
      const { schema_ref, schema_version } = artifact.applicable_schema;
      schemas.set(`${schema_ref}\0${schema_version}`, {
        schema_ref,
        schema_version,
      });
    }
  }
  return [...schemas.values()].sort((left, right) =>
    compareCodeUnits(
      `${left.schema_ref}\0${left.schema_version}`,
      `${right.schema_ref}\0${right.schema_version}`,
    ),
  );
}

function numberRecord(value: unknown): Readonly<Record<string, number>> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("CORPUS_COUNT_OBJECT");
  const output: Record<string, number> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!Number.isSafeInteger(child) || (child as number) < 0)
      throw new Error("CORPUS_COUNT_VALUE");
    output[key] = child as number;
  }
  return output;
}

export function computeCoverage(
  artifacts = computeArtifacts(),
): CoverageSummaryV1 {
  const fixtureManifest = parseJsonFile(`${FIXTURE_ROOT}/manifest.v2.json`) as {
    readonly counts: unknown;
    readonly answer_counts: unknown;
    readonly evidence_category_counts: unknown;
    readonly role_family_counts: unknown;
    readonly files: readonly { readonly byte_count: number }[];
  };
  const policies = parseJsonFile(
    `${FIXTURE_ROOT}/field-value-policies.v2.json`,
  ) as {
    readonly items: readonly {
      readonly sensitivity: string;
      readonly consequential: boolean;
    }[];
  };
  const rawCounts: Record<string, number> = {
    ...numberRecord(fixtureManifest.counts),
    ...numberRecord(fixtureManifest.answer_counts),
    artifact_files: artifacts.length,
    committed_record_identities: artifacts.reduce(
      (sum, artifact) => sum + artifact.record_count,
      0,
    ),
    fixture_collection_bytes: fixtureManifest.files.reduce(
      (sum, file) => sum + file.byte_count,
      0,
    ),
    mock_ats_cases: FIXTURE_CASES.length,
    mock_ats_routes: new Set(FIXTURE_CASES.map(({ route }) => route)).size,
    mock_ats_surface_tags: new Set(
      FIXTURE_CASES.flatMap(({ surfaces }) => surfaces),
    ).size,
    mock_expected_transition_clauses: Object.values(
      EXPECTED_TRANSITIONS,
    ).reduce((sum, transitions) => sum + transitions.length, 0),
    mock_honeypot_tagged_cases: FIXTURE_CASES.filter(({ surfaces }) =>
      surfaces.includes("honeypot"),
    ).length,
    mock_sensitive_tagged_cases: FIXTURE_CASES.filter(({ surfaces }) =>
      surfaces.includes("sensitive-fields"),
    ).length,
    baseline_cases: DEV_CASE_MATRIX.cases.length,
    policy_personal_records: policies.items.filter(
      ({ sensitivity }) => sensitivity === "PERSONAL",
    ).length,
    policy_sensitive_records: policies.items.filter(
      ({ sensitivity }) => sensitivity === "SENSITIVE",
    ).length,
    policy_consequential_records: policies.items.filter(
      ({ consequential }) => consequential,
    ).length,
    workday_like_variants: 0,
    greenhouse_structural_variants: 0,
    lever_structural_variants: 0,
    ashby_structural_variants: 0,
    public_no_submit_variants: 0,
    scored_controls: 0,
    sensitive_prohibited_scored_controls: 0,
    honeypot_scored_controls: 0,
    scored_control_families: 0,
  };
  for (const [key, value] of Object.entries(
    numberRecord(fixtureManifest.evidence_category_counts),
  )) {
    rawCounts[`evidence_category_${key.toLowerCase()}`] = value;
  }
  for (const [key, value] of Object.entries(
    numberRecord(fixtureManifest.role_family_counts),
  )) {
    rawCounts[`role_family_${key.toLowerCase()}`] = value;
  }
  const payload = {
    format_version: "1.0.0" as const,
    corpus_id: CORPUS_ID,
    corpus_version: CORPUS_VERSION,
    raw_counts: rawCounts,
    schema_versions: schemaInventory(artifacts),
    future_gate_a_targets: [
      target("form_variants", 32, 200, 168, "M02-W12"),
      target("scored_controls", 0, 2500, 2500, "M02-W13"),
      target("sensitive_prohibited_scored_controls", 0, 100, 100, "M02-W13"),
      target("honeypot_scored_controls", 0, 50, 50, "M02-W13"),
      target("workday_like_variants", 0, 50, 50, "M02-W12"),
      target(
        "greenhouse_structural_variants",
        0,
        "REQUIRED",
        "UNAVAILABLE",
        "M02-W12",
      ),
      target(
        "lever_structural_variants",
        0,
        "REQUIRED",
        "UNAVAILABLE",
        "M02-W12",
      ),
      target(
        "ashby_structural_variants",
        0,
        "REQUIRED",
        "UNAVAILABLE",
        "M02-W12",
      ),
      target(
        "required_scored_control_families",
        0,
        "REQUIRED",
        "UNAVAILABLE",
        "M02-W13",
      ),
      target("public_no_submit_variants", 0, 30, 30, "M02-W14"),
      target(
        "genuine_hidden_ratio",
        "UNAVAILABLE",
        "REQUIRED",
        "UNAVAILABLE",
        "M02-W14",
      ),
    ],
  };
  return { ...payload, coverage_digest: sha256Canonical(payload) };
}

function target(
  metric: string,
  current: number | "UNAVAILABLE",
  expected: number | "REQUIRED",
  shortfall: number | "UNAVAILABLE",
  owner: "M02-W12" | "M02-W13" | "M02-W14",
): CoverageSummaryV1["future_gate_a_targets"][number] {
  return {
    metric,
    current,
    target: expected,
    shortfall,
    owner,
    state: "NOT_YET_APPLICABLE",
  };
}

export function computeCorpus(): {
  readonly manifest: CorpusManifestV1;
  readonly coverage: CoverageSummaryV1;
  readonly versionIndex: Readonly<Record<string, unknown>>;
} {
  const artifacts = computeArtifacts();
  const coverage = computeCoverage(artifacts);
  const artifactRoles = [
    "PUBLIC_BASELINE",
    "PUBLIC_DEVELOPMENT_INPUT",
    "PUBLIC_EXPECTED_TRUTH",
    "PUBLIC_FORM_VARIANT",
    "SCHEMA_SEMANTICS",
  ] as const satisfies readonly ArtifactRole[];
  const fixtureManifest = parseJsonFile(`${FIXTURE_ROOT}/manifest.v2.json`) as {
    readonly id: string;
    readonly corpus_version: string;
    readonly corpus_digest: ContentDigest;
  };
  const payload = {
    format_version: CORPUS_FORMAT_VERSION,
    corpus_id: CORPUS_ID,
    corpus_version: CORPUS_VERSION,
    corpus_state: "FROZEN" as const,
    benchmark_family: "AUTOFILL_FEASIBILITY" as const,
    classification: ["EVALUATION_ONLY", "NON_PRODUCTION"] as const,
    data_classification: ["PUBLIC", "SYNTHETIC"] as const,
    gate_authority: "NONE" as const,
    source_tree: SOURCE_TREE,
    provenance: {
      owner: "M02-W06" as const,
      freeze_source: "EXACT_REPOSITORY_TREE" as const,
      generator_package: "@japp/evaluation-corpus" as const,
      generator_version: "0.0.1" as const,
      checker_version: "1.0.0" as const,
    },
    source_fixture_commitment: {
      id: fixtureManifest.id,
      version: fixtureManifest.corpus_version,
      digest: fixtureManifest.corpus_digest,
    },
    artifacts,
    artifact_count: artifacts.length,
    artifact_role_counts: Object.fromEntries(
      artifactRoles.map((role) => [
        role,
        artifacts.filter((artifact) => artifact.role === role).length,
      ]),
    ) as Readonly<Record<ArtifactRole, number>>,
    record_count: artifacts.reduce(
      (sum, artifact) => sum + artifact.record_count,
      0,
    ),
    schema_versions: schemaInventory(artifacts),
    coverage_summary_digest: coverage.coverage_digest,
    expected_truth_policy:
      "Exact W01/W02 oracle bytes, W03 transition truth, and W04 literal oracle bytes are direct commitments; hidden expected outputs remain owner-external.",
    threshold_policy: {
      frozen_existing_truth: true as const,
      field_scoring_thresholds: "NOT_YET_APPLICABLE" as const,
      tolerances: "NOT_YET_APPLICABLE" as const,
      ignored_regions: "NOT_YET_APPLICABLE" as const,
      future_owner: "M02-W13" as const,
    },
    change_policy: {
      versioning: "FULL_MAJOR_VERSION_ONLY" as const,
      same_version_rewrite: "FORBIDDEN" as const,
      history_policy: "PRESERVE_GIT_BLOB_AND_VERSION_PATH" as const,
      correction_record_required: true as const,
      invalidation_and_rerun_required: true as const,
    },
  };
  const manifest: CorpusManifestV1 = {
    ...payload,
    corpus_digest: sha256Canonical(payload),
  };
  const versionIndex = {
    format_version: "1.0.0",
    policy: "APPEND_ONLY_FULL_MAJOR_VERSIONS",
    versions: [
      {
        corpus_id: CORPUS_ID,
        corpus_version: CORPUS_VERSION,
        corpus_digest: manifest.corpus_digest,
        source_tree: SOURCE_TREE,
        manifest_path: relative(REPOSITORY_ROOT, CORPUS_MANIFEST_FILE)
          .split(sep)
          .join("/"),
      },
    ],
    corrections: [],
  };
  return { manifest, coverage, versionIndex };
}

function expectedFiles(): readonly [string, string][] {
  const computed = computeCorpus();
  return [
    [CORPUS_MANIFEST_FILE, canonicalFile(computed.manifest)],
    [COVERAGE_SUMMARY_FILE, canonicalFile(computed.coverage)],
    [VERSION_INDEX_FILE, canonicalFile(computed.versionIndex)],
  ];
}

export function writeCorpus(): "CREATED" | "UNCHANGED" {
  const files = expectedFiles();
  const existing = files.filter(([path]) => existsSync(path));
  if (existing.length !== 0 && existing.length !== files.length)
    throw new Error("CORPUS_PARTIAL_VERSION");
  if (existing.length === files.length) {
    checkCorpus();
    return "UNCHANGED";
  }
  mkdirSync(CORPUS_DIRECTORY, { recursive: true });
  mkdirSync(resolve(VERSION_INDEX_FILE, ".."), { recursive: true });
  for (const [path, bytes] of files)
    writeFileSync(path, bytes, { encoding: "utf8", flag: "wx" });
  return "CREATED";
}

export function checkCorpus(): void {
  for (const [path, expected] of expectedFiles()) {
    if (!existsSync(path)) throw new Error("CORPUS_ARTIFACT_MISSING");
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink())
      throw new Error("CORPUS_ARTIFACT_TYPE");
    if (readFileSync(path, "utf8") !== expected)
      throw new Error("CORPUS_DRIFT");
    if (path === VERSION_INDEX_FILE) assertHistoricalVersionIndexAppend(path);
    else assertHistoricalBlobUnchanged(path);
  }
}

function assertHistoricalBlobUnchanged(path: string): void {
  const logical = relative(REPOSITORY_ROOT, path).split(sep).join("/");
  const log = spawnSync(
    "git",
    ["log", "--follow", "--format=%H", "--", logical],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    },
  );
  if (log.status !== 0) throw new Error("CORPUS_HISTORY_UNAVAILABLE");
  const commits = log.stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (commits.length < 1) return;
  const first = commits.at(-1);
  if (first === undefined) return;
  const original = spawnSync("git", ["show", `${first}:${logical}`], {
    cwd: REPOSITORY_ROOT,
    encoding: "buffer",
  });
  if (original.status !== 0 || !readFileSync(path).equals(original.stdout)) {
    throw new Error("CORPUS_HISTORY_REWRITE");
  }
}

function assertHistoricalVersionIndexAppend(path: string): void {
  const logical = relative(REPOSITORY_ROOT, path).split(sep).join("/");
  const log = spawnSync(
    "git",
    ["log", "--follow", "--reverse", "--format=%H", "--", logical],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  if (log.status !== 0) throw new Error("CORPUS_HISTORY_UNAVAILABLE");
  let previous: VersionIndexV1 | undefined;
  for (const commit of log.stdout.trim().split(/\r?\n/u).filter(Boolean)) {
    const historical = spawnSync("git", ["show", `${commit}:${logical}`], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });
    if (historical.status !== 0) throw new Error("CORPUS_HISTORY_UNAVAILABLE");
    const current = parseStrictJson(historical.stdout) as VersionIndexV1;
    if (previous !== undefined) validateVersionIndexAppend(previous, current);
    previous = current;
  }
  const worktree = parseStrictJson(
    readFileSync(path, "utf8"),
  ) as VersionIndexV1;
  if (previous !== undefined) validateVersionIndexAppend(previous, worktree);
}

export interface CorrectionRecordV1 {
  readonly old_version: string;
  readonly old_digest: ContentDigest;
  readonly new_version: string;
  readonly new_digest: ContentDigest;
  readonly reason: string;
  readonly owner_role: string;
  readonly reviewer_role: string;
  readonly affected_comparisons: readonly string[];
  readonly affected_evidence: readonly string[];
  readonly invalidation: "REQUIRED";
  readonly rerun: "REQUIRED";
}

export function validateCorrectionRecord(record: CorrectionRecordV1): void {
  if (
    !/^\d+\.0\.0$/u.test(record.old_version) ||
    !/^\d+\.0\.0$/u.test(record.new_version)
  )
    throw new Error("CORRECTION_FULL_VERSION");
  if (
    Number.parseInt(record.new_version, 10) <=
    Number.parseInt(record.old_version, 10)
  )
    throw new Error("CORRECTION_ORDER");
  if (record.old_digest === record.new_digest)
    throw new Error("CORRECTION_DIGEST");
  if (
    !/^sha256:[0-9a-f]{64}$/u.test(record.old_digest) ||
    !/^sha256:[0-9a-f]{64}$/u.test(record.new_digest)
  )
    throw new Error("CORRECTION_DIGEST");
  if (
    record.reason.trim().length < 20 ||
    record.owner_role === record.reviewer_role
  )
    throw new Error("CORRECTION_REVIEW");
  if (
    record.affected_comparisons.length === 0 ||
    record.affected_evidence.length === 0 ||
    record.affected_comparisons.some(
      (value) => typeof value !== "string" || value.length === 0,
    ) ||
    record.affected_evidence.some(
      (value) => typeof value !== "string" || value.length === 0,
    )
  )
    throw new Error("CORRECTION_IMPACT");
  const runtimeRecord = record as unknown as {
    readonly invalidation?: unknown;
    readonly rerun?: unknown;
  };
  if (
    runtimeRecord.invalidation !== "REQUIRED" ||
    runtimeRecord.rerun !== "REQUIRED"
  )
    throw new Error("CORRECTION_INVALIDATION");
}

export interface VersionIndexV1 {
  readonly format_version: "1.0.0";
  readonly policy: "APPEND_ONLY_FULL_MAJOR_VERSIONS";
  readonly versions: readonly {
    readonly corpus_id: string;
    readonly corpus_version: string;
    readonly corpus_digest: ContentDigest;
    readonly source_tree: string;
    readonly manifest_path: string;
  }[];
  readonly corrections: readonly CorrectionRecordV1[];
}

export function appendFullVersion(
  previous: VersionIndexV1,
  next: VersionIndexV1["versions"][number],
  correction: CorrectionRecordV1,
): VersionIndexV1 {
  validateCorrectionRecord(correction);
  const prior = previous.versions.at(-1);
  const priorVersion = prior?.corpus_version;
  const priorDigest = prior?.corpus_digest;
  const priorId = prior?.corpus_id;
  if (
    priorVersion !== correction.old_version ||
    priorDigest !== correction.old_digest ||
    next.corpus_version !== correction.new_version ||
    next.corpus_digest !== correction.new_digest ||
    next.corpus_id !== priorId ||
    previous.versions.some(
      ({ corpus_version }) => corpus_version === next.corpus_version,
    )
  ) {
    throw new Error("CORRECTION_VERSION_BINDING");
  }
  return {
    format_version: "1.0.0",
    policy: "APPEND_ONLY_FULL_MAJOR_VERSIONS",
    versions: [...previous.versions, next],
    corrections: [...previous.corrections, correction],
  };
}

export function validateVersionIndexAppend(
  previous: VersionIndexV1,
  current: VersionIndexV1,
): void {
  if (
    current.versions.length < previous.versions.length ||
    current.corrections.length < previous.corrections.length ||
    canonicalFile(current.versions.slice(0, previous.versions.length)) !==
      canonicalFile(previous.versions) ||
    canonicalFile(current.corrections.slice(0, previous.corrections.length)) !==
      canonicalFile(previous.corrections)
  ) {
    throw new Error("CORPUS_VERSION_HISTORY_MUTATION");
  }
}

export function validateCommittedManifest(value: unknown): CorpusManifestV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("CORPUS_MANIFEST_SHAPE");
  const record = value as Record<string, unknown>;
  const digest = record.corpus_digest;
  if (
    typeof digest !== "string" ||
    sha256Canonical(withoutKey(record, "corpus_digest")) !== digest
  )
    throw new Error("CORPUS_MANIFEST_DIGEST");
  if (
    record.corpus_id !== CORPUS_ID ||
    record.corpus_version !== CORPUS_VERSION ||
    record.gate_authority !== "NONE"
  )
    throw new Error("CORPUS_MANIFEST_PROFILE");
  if (canonicalFile(value) !== canonicalFile(computeCorpus().manifest))
    throw new Error("CORPUS_MANIFEST_SOURCE_MISMATCH");
  return value as CorpusManifestV1;
}

export function validateCommittedCoverage(value: unknown): CoverageSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("COVERAGE_SHAPE");
  const record = value as Record<string, unknown>;
  const digest = record.coverage_digest;
  if (
    typeof digest !== "string" ||
    sha256Canonical(withoutKey(record, "coverage_digest")) !== digest
  )
    throw new Error("COVERAGE_DIGEST");
  if (canonicalFile(value) !== canonicalFile(computeCorpus().coverage))
    throw new Error("COVERAGE_SOURCE_MISMATCH");
  return value as unknown as CoverageSummaryV1;
}

export function checkPublicPrivacy(): void {
  const visibleRoot = join(REPOSITORY_ROOT, "benchmarks/holdout-manifests");
  const visibleFiles = readdirSync(visibleRoot).sort();
  const allowed = new Set([
    "README.md",
    "status.v1.json",
    "m02-autofill-v1.manifest.json",
  ]);
  if (visibleFiles.some((name) => !allowed.has(name))) {
    throw new Error("CORPUS_PRIVACY_UNEXPECTED_HOLDOUT_FILE");
  }
  if (visibleFiles.includes("mapping.v1.json")) {
    throw new Error("CORPUS_PRIVACY_MAPPING_COMMITTED");
  }
  for (const path of [
    CORPUS_MANIFEST_FILE,
    COVERAGE_SUMMARY_FILE,
    VERSION_INDEX_FILE,
  ]) {
    const text = readFileSync(path, "utf8");
    if (
      /(?:\/Users\/|\/home\/|[A-Za-z]:[\\/]|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\bBearer\s+[A-Za-z0-9._-]+|\b(?:api[_-]?key|password|credential|secret)\s*[:=])/iu.test(
        text,
      )
    ) {
      throw new Error("CORPUS_PRIVACY_FORBIDDEN_TEXT");
    }
  }
}
