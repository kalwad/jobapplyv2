import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Stats,
} from "node:fs";
import { isAbsolute, join, posix, relative, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fixtureEntityHash,
  fixtureManifestHash,
  sha256Bytes,
  sha256Canonical,
} from "./canonical-json.ts";
import { fixtureSchemaValidator } from "./schema-catalog.ts";
import { parseStrictJson, StrictJsonError } from "./strict-json.ts";
import {
  EXPECTED_SEED_COUNTS,
  FIXTURE_SCHEMA_VERSION,
  SCHEMA_REFS,
  type EvidenceArtifact,
  type ExpectedRequirement,
  type ExpectedSupportedClaim,
  type FieldValuePolicy,
  type FixtureCollection,
  type FixtureCorpus,
  type FixtureEntity,
  type FixtureEntityType,
  type FixtureManifest,
  type ScenarioBundle,
  type SourceResume,
  type SyntheticJob,
  type SyntheticProfile,
  type UnsupportedGap,
} from "./model.ts";

export const COMMITTED_FIXTURE_ROOT = fileURLToPath(
  new URL("../data/development/", import.meta.url),
);

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_CORPUS_BYTES = 16 * 1024 * 1024;
const MANIFEST_FILE = "manifest.v1.json";

interface CollectionSpec {
  readonly file: string;
  readonly entityType: FixtureEntityType;
  readonly schemaRef: FixtureEntity["schema_ref"];
  readonly corpusKey: Exclude<keyof FixtureCorpus, "manifest">;
}

export const COLLECTION_SPECS: readonly CollectionSpec[] = [
  {
    file: "evidence-artifacts.v1.json",
    entityType: "EVIDENCE_ARTIFACT",
    schemaRef: SCHEMA_REFS.EVIDENCE_ARTIFACT,
    corpusKey: "evidenceArtifacts",
  },
  {
    file: "expected-requirements.v1.json",
    entityType: "EXPECTED_REQUIREMENT",
    schemaRef: SCHEMA_REFS.EXPECTED_REQUIREMENT,
    corpusKey: "expectedRequirements",
  },
  {
    file: "expected-supported-claims.v1.json",
    entityType: "EXPECTED_SUPPORTED_CLAIM",
    schemaRef: SCHEMA_REFS.EXPECTED_SUPPORTED_CLAIM,
    corpusKey: "expectedSupportedClaims",
  },
  {
    file: "field-value-policies.v1.json",
    entityType: "FIELD_VALUE_POLICY",
    schemaRef: SCHEMA_REFS.FIELD_VALUE_POLICY,
    corpusKey: "fieldValuePolicies",
  },
  {
    file: "jobs.v1.json",
    entityType: "SYNTHETIC_JOB",
    schemaRef: SCHEMA_REFS.SYNTHETIC_JOB,
    corpusKey: "jobs",
  },
  {
    file: "profiles.v1.json",
    entityType: "SYNTHETIC_PROFILE",
    schemaRef: SCHEMA_REFS.SYNTHETIC_PROFILE,
    corpusKey: "profiles",
  },
  {
    file: "scenario-bundles.v1.json",
    entityType: "SCENARIO_BUNDLE",
    schemaRef: SCHEMA_REFS.SCENARIO_BUNDLE,
    corpusKey: "scenarioBundles",
  },
  {
    file: "source-resumes.v1.json",
    entityType: "SOURCE_RESUME",
    schemaRef: SCHEMA_REFS.SOURCE_RESUME,
    corpusKey: "sourceResumes",
  },
  {
    file: "unsupported-gaps.v1.json",
    entityType: "UNSUPPORTED_GAP",
    schemaRef: SCHEMA_REFS.UNSUPPORTED_GAP,
    corpusKey: "unsupportedGaps",
  },
] as const;

export class FixtureLoadError extends Error {
  public readonly code: string;
  public readonly fixturePath: string;
  public readonly pointer: string;

  public constructor(
    code: string,
    fixturePath: string,
    pointer: string,
    detail: string,
  ) {
    super(`${code} ${fixturePath}${pointer}: ${detail}`);
    this.name = "FixtureLoadError";
    this.code = code;
    this.fixturePath = fixturePath;
    this.pointer = pointer;
  }
}

function fail(
  code: string,
  fixturePath: string,
  pointer: string,
  detail: string,
): never {
  throw new FixtureLoadError(code, fixturePath, pointer, detail);
}

function pointerAt(collection: string, index: number, suffix = ""): string {
  return `${collection}/${String(index)}${suffix}`;
}

function containsForbiddenText(value: string, includeC1: boolean): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      (codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a) ||
      codePoint === 0x7f ||
      (includeC1 && codePoint >= 0x80 && codePoint <= 0x9f) ||
      (codePoint >= 0x200b && codePoint <= 0x200f) ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      codePoint === 0x2060 ||
      (codePoint >= 0x2066 && codePoint <= 0x2069) ||
      codePoint === 0xfeff
    ) {
      return true;
    }
  }
  return false;
}

function checkedStats(
  path: string,
  fixturePath: string,
  kind: "directory" | "file",
): Stats {
  let stats: Stats;
  try {
    stats = lstatSync(path);
  } catch {
    return fail("FIXTURE_PATH_MISSING", fixturePath, "/", `${kind} is missing`);
  }
  if (stats.isSymbolicLink()) {
    return fail(
      "FIXTURE_SYMLINK_REJECTED",
      fixturePath,
      "/",
      "symbolic links are forbidden",
    );
  }
  if (
    (kind === "directory" && !stats.isDirectory()) ||
    (kind === "file" && !stats.isFile())
  ) {
    return fail(
      "FIXTURE_PATH_TYPE",
      fixturePath,
      "/",
      `expected regular ${kind}`,
    );
  }
  return stats;
}

function assertContained(
  rootReal: string,
  pathReal: string,
  fixturePath: string,
): void {
  const rel = relative(rootReal, pathReal);
  if (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  ) {
    return;
  }
  fail(
    "FIXTURE_PATH_ESCAPE",
    fixturePath,
    "/",
    "resolved path leaves the fixture root",
  );
}

function validateRelativePath(
  value: string,
  fixturePath: string,
  pointer: string,
): void {
  const base = posix.basename(value).split(".")[0]?.toUpperCase() ?? "";
  if (
    value === "" ||
    isAbsolute(value) ||
    win32.isAbsolute(value) ||
    value.includes("\\") ||
    value.includes(":") ||
    value.includes("%") ||
    value.includes("~") ||
    value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    value !== value.toLowerCase() ||
    value !== value.normalize("NFC") ||
    posix.normalize(value) !== value ||
    /[ .]$/u.test(value) ||
    /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(base)
  ) {
    fail(
      "FIXTURE_MANIFEST_PATH",
      fixturePath,
      pointer,
      "path is not canonical and relative",
    );
  }
}

function readBoundedFile(
  rootReal: string,
  root: string,
  relativePath: string,
  aggregate: { bytes: number },
): Buffer {
  validateRelativePath(relativePath, relativePath, "/");
  const path = join(root, relativePath);
  const stats = checkedStats(path, relativePath, "file");
  if (stats.nlink > 1) {
    fail(
      "FIXTURE_HARDLINK_REJECTED",
      relativePath,
      "/",
      "hard-linked files are forbidden",
    );
  }
  if (stats.size > MAX_FILE_BYTES) {
    fail(
      "FIXTURE_FILE_TOO_LARGE",
      relativePath,
      "/",
      "file exceeds the 2 MiB ceiling",
    );
  }
  let real: string;
  try {
    real = realpathSync(path);
  } catch {
    return fail(
      "FIXTURE_PATH_IO",
      relativePath,
      "/",
      "path cannot be resolved",
    );
  }
  assertContained(rootReal, real, relativePath);
  aggregate.bytes += stats.size;
  if (aggregate.bytes > MAX_CORPUS_BYTES) {
    fail(
      "FIXTURE_CORPUS_TOO_LARGE",
      relativePath,
      "/",
      "corpus exceeds the 16 MiB ceiling",
    );
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(real);
  } catch {
    return fail("FIXTURE_PATH_IO", relativePath, "/", "file cannot be read");
  }
  const after = checkedStats(path, relativePath, "file");
  if (
    bytes.length !== stats.size ||
    after.dev !== stats.dev ||
    after.ino !== stats.ino ||
    after.size !== stats.size ||
    after.nlink !== stats.nlink
  ) {
    fail(
      "FIXTURE_FILE_CHANGED",
      relativePath,
      "/",
      "file identity changed during bounded read",
    );
  }
  return bytes;
}

function decodeJson(bytes: Buffer, fixturePath: string): unknown {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return fail("FIXTURE_TEXT_BOM", fixturePath, "/", "UTF-8 BOM is forbidden");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail(
      "FIXTURE_TEXT_ENCODING",
      fixturePath,
      "/",
      "content is not strict UTF-8",
    );
  }
  if (text.includes("\r")) {
    fail(
      "FIXTURE_TEXT_NEWLINE",
      fixturePath,
      "/",
      "only LF newlines are accepted",
    );
  }
  if (containsForbiddenText(text, false)) {
    fail(
      "FIXTURE_TEXT_CONTROL",
      fixturePath,
      "/",
      "forbidden control or bidi text detected",
    );
  }
  try {
    const value = parseStrictJson(text);
    const inspect = (child: unknown, pointer: string): void => {
      if (typeof child === "string") {
        if (containsForbiddenText(child, true)) {
          fail(
            "FIXTURE_TEXT_HIDDEN",
            fixturePath,
            pointer,
            "hidden Unicode text is forbidden",
          );
        }
      } else if (Array.isArray(child)) {
        child.forEach((item, index) => {
          inspect(item, pointerAt(pointer, index));
        });
      } else if (typeof child === "object" && child !== null) {
        for (const [key, item] of Object.entries(child)) {
          inspect(
            item,
            `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          );
        }
      }
    };
    inspect(value, "");
    return value;
  } catch (error) {
    if (error instanceof FixtureLoadError) {
      throw error;
    }
    if (error instanceof StrictJsonError) {
      return fail(
        error.code,
        fixturePath,
        error.pointer,
        "strict JSON preflight failed",
      );
    }
    return fail(
      "FIXTURE_JSON_INVALID",
      fixturePath,
      "/",
      "content is not valid JSON",
    );
  }
}

function objectAt(
  value: unknown,
  fixturePath: string,
  pointer: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("FIXTURE_JSON_SHAPE", fixturePath, pointer, "expected object");
  }
  return value as Record<string, unknown>;
}

function validateManifest(value: unknown): FixtureManifest {
  const result = fixtureSchemaValidator().validateInstance(
    SCHEMA_REFS.MANIFEST,
    value,
  );
  if (!result.valid) {
    fail(
      "FIXTURE_MANIFEST_SCHEMA",
      MANIFEST_FILE,
      "/",
      result.errors.join("; "),
    );
  }
  return value as FixtureManifest;
}

function validateCollection(
  value: unknown,
  spec: CollectionSpec,
): readonly FixtureEntity[] {
  const object = objectAt(value, spec.file, "/");
  const exactKeys = ["entity_type", "items", "schema_ref", "schema_version"];
  if (
    Object.keys(object).sort().join("\n") !== exactKeys.join("\n") ||
    object.entity_type !== spec.entityType ||
    object.schema_ref !== spec.schemaRef ||
    object.schema_version !== FIXTURE_SCHEMA_VERSION ||
    !Array.isArray(object.items)
  ) {
    fail(
      "FIXTURE_COLLECTION_HEADER",
      spec.file,
      "/",
      "collection envelope is invalid",
    );
  }
  const items = object.items;
  if (items.length === 0) {
    fail(
      "FIXTURE_COLLECTION_EMPTY",
      spec.file,
      "/items",
      "active fixture collections cannot be empty",
    );
  }
  const validator = fixtureSchemaValidator();
  const ids: string[] = [];
  for (const [index, item] of items.entries()) {
    const result = validator.validateInstance(spec.schemaRef, item);
    if (!result.valid) {
      fail(
        "FIXTURE_ENTITY_SCHEMA",
        spec.file,
        pointerAt("/items", index),
        result.errors.join("; "),
      );
    }
    const entity = item as FixtureEntity;
    ids.push(entity.id);
    if (fixtureEntityHash(entity) !== entity.metadata.historical_content_hash) {
      fail(
        "FIXTURE_ENTITY_HASH",
        spec.file,
        pointerAt("/items", index, "/metadata/historical_content_hash"),
        "immutable hash mismatch",
      );
    }
  }
  const sorted = [...ids].sort();
  if (ids.some((id, index) => id !== sorted[index])) {
    fail(
      "FIXTURE_ORDER",
      spec.file,
      "/items",
      "items are not sorted by stable ID",
    );
  }
  return items as readonly FixtureEntity[];
}

function verifyInventory(root: string): void {
  const expected = [
    MANIFEST_FILE,
    ...COLLECTION_SPECS.map((spec) => spec.file),
  ].sort();
  let actual: string[];
  try {
    actual = readdirSync(root).sort();
  } catch {
    return fail(
      "FIXTURE_PATH_IO",
      ".",
      "/",
      "development directory cannot be read",
    );
  }
  if (actual.join("\n") !== expected.join("\n")) {
    fail(
      "FIXTURE_INVENTORY",
      ".",
      "/",
      "development directory inventory is not exact",
    );
  }
}

function verifyCounts(corpus: FixtureCorpus): void {
  const actual = {
    profiles: corpus.profiles.length,
    evidence_artifacts: corpus.evidenceArtifacts.length,
    source_resumes: corpus.sourceResumes.length,
    jobs: corpus.jobs.length,
    expected_requirements: corpus.expectedRequirements.length,
    expected_supported_claims: corpus.expectedSupportedClaims.length,
    unsupported_gaps: corpus.unsupportedGaps.length,
    field_value_policies: corpus.fieldValuePolicies.length,
    scenario_bundles: corpus.scenarioBundles.length,
    scenario_evaluations: corpus.scenarioBundles.reduce(
      (sum, scenario) => sum + scenario.evaluations.length,
      0,
    ),
  };
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_SEED_COUNTS)) {
    fail(
      "FIXTURE_COUNT",
      MANIFEST_FILE,
      "/counts",
      "loaded counts do not match the seed contract",
    );
  }
  if (JSON.stringify(actual) !== JSON.stringify(corpus.manifest.counts)) {
    fail(
      "FIXTURE_MANIFEST_COUNT",
      MANIFEST_FILE,
      "/counts",
      "manifest counts do not match loaded data",
    );
  }
}

function assignCollection(
  corpus: FixtureCorpus,
  key: CollectionSpec["corpusKey"],
  items: readonly FixtureEntity[],
): void {
  switch (key) {
    case "evidenceArtifacts":
      corpus.evidenceArtifacts = items as EvidenceArtifact[];
      break;
    case "expectedRequirements":
      corpus.expectedRequirements = items as ExpectedRequirement[];
      break;
    case "expectedSupportedClaims":
      corpus.expectedSupportedClaims = items as ExpectedSupportedClaim[];
      break;
    case "fieldValuePolicies":
      corpus.fieldValuePolicies = items as FieldValuePolicy[];
      break;
    case "jobs":
      corpus.jobs = items as SyntheticJob[];
      break;
    case "profiles":
      corpus.profiles = items as SyntheticProfile[];
      break;
    case "scenarioBundles":
      corpus.scenarioBundles = items as ScenarioBundle[];
      break;
    case "sourceResumes":
      corpus.sourceResumes = items as SourceResume[];
      break;
    case "unsupportedGaps":
      corpus.unsupportedGaps = items as UnsupportedGap[];
      break;
  }
}

export function loadFixtureCorpus(
  root = COMMITTED_FIXTURE_ROOT,
): FixtureCorpus {
  checkedStats(root, ".", "directory");
  let rootReal: string;
  try {
    rootReal = realpathSync(root);
  } catch {
    return fail(
      "FIXTURE_PATH_IO",
      ".",
      "/",
      "development directory cannot be resolved",
    );
  }
  verifyInventory(root);
  const aggregate = { bytes: 0 };
  const manifestBytes = readBoundedFile(
    rootReal,
    root,
    MANIFEST_FILE,
    aggregate,
  );
  const manifest = validateManifest(decodeJson(manifestBytes, MANIFEST_FILE));
  if (
    fixtureManifestHash(manifest) !== manifest.metadata.historical_content_hash
  ) {
    fail(
      "FIXTURE_MANIFEST_HASH",
      MANIFEST_FILE,
      "/metadata/historical_content_hash",
      "manifest identity or hash mismatch",
    );
  }
  const expectedFiles = COLLECTION_SPECS.map((spec) => spec.file);
  if (
    manifest.files.map((file) => file.path).join("\n") !==
    expectedFiles.join("\n")
  ) {
    fail(
      "FIXTURE_MANIFEST_ORDER",
      MANIFEST_FILE,
      "/files",
      "manifest files are not in canonical order",
    );
  }

  const corpus: FixtureCorpus = {
    manifest,
    profiles: [],
    evidenceArtifacts: [],
    sourceResumes: [],
    jobs: [],
    expectedRequirements: [],
    expectedSupportedClaims: [],
    unsupportedGaps: [],
    fieldValuePolicies: [],
    scenarioBundles: [],
  };
  const allIds = new Set<string>([manifest.id]);
  for (const [index, spec] of COLLECTION_SPECS.entries()) {
    const entry = manifest.files[index];
    if (entry === undefined) {
      fail(
        "FIXTURE_MANIFEST_ENTRY",
        MANIFEST_FILE,
        pointerAt("/files", index),
        "required entry is missing",
      );
    }
    if (
      entry.path !== spec.file ||
      entry.entity_type !== spec.entityType ||
      entry.schema_ref !== spec.schemaRef
    ) {
      fail(
        "FIXTURE_MANIFEST_ENTRY",
        MANIFEST_FILE,
        pointerAt("/files", index),
        "entry does not match its collection",
      );
    }
    const bytes = readBoundedFile(rootReal, root, spec.file, aggregate);
    if (
      bytes.length !== entry.byte_count ||
      sha256Bytes(bytes) !== entry.sha256
    ) {
      fail(
        "FIXTURE_FILE_DIGEST",
        spec.file,
        "/",
        "byte count or SHA-256 mismatch",
      );
    }
    const items = validateCollection(decodeJson(bytes, spec.file), spec);
    if (items.length !== entry.record_count) {
      fail(
        "FIXTURE_MANIFEST_COUNT",
        MANIFEST_FILE,
        pointerAt("/files", index, "/record_count"),
        "record count mismatch",
      );
    }
    for (const [itemIndex, item] of items.entries()) {
      if (allIds.has(item.id)) {
        fail(
          "FIXTURE_DUPLICATE_ID",
          spec.file,
          pointerAt("/items", itemIndex, "/id"),
          "stable ID is duplicated",
        );
      }
      allIds.add(item.id);
    }
    assignCollection(corpus, spec.corpusKey, items);
  }
  if (sha256Canonical(manifest.files) !== manifest.corpus_digest) {
    fail(
      "FIXTURE_CORPUS_DIGEST",
      MANIFEST_FILE,
      "/corpus_digest",
      "corpus digest mismatch",
    );
  }
  verifyCounts(corpus);
  return corpus;
}

export function fixtureCollection<T extends FixtureEntity>(
  entityType: T["entity_type"],
  schemaRef: T["schema_ref"],
  items: T[],
): FixtureCollection<T> {
  return {
    entity_type: entityType,
    schema_ref: schemaRef,
    schema_version: FIXTURE_SCHEMA_VERSION,
    items,
  };
}
