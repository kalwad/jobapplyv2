import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  validateBenchmarkCaseV1,
  validateBenchmarkHoldoutManifestV1,
  type BenchmarkCaseV1,
  type BenchmarkHoldoutManifestV1,
} from "@japp/contracts/generated";

import {
  canonicalFile,
  compareCodeUnits,
  sha256Bytes,
  sha256Canonical,
  withoutKey,
  type ContentDigest,
} from "./canonical.ts";
import { REPOSITORY_ROOT } from "./corpus.ts";
import { decodeStrictUtf8, parseStrictJson } from "./strict-json.ts";

export const OWNER_ROOT_ENV = "JAPP_HOLDOUT_V1_ROOT" as const;
export const OWNER_MAPPING_V1_FILE = "mapping.v1.json" as const;
export const OWNER_MAPPING_V1_FORMAT_VERSION = "1.0.0" as const;
export const OWNER_MAPPING_FILE = "mapping.v2.json" as const;
export const OWNER_MAPPING_FORMAT_VERSION = "2.0.0" as const;
export const SNAPSHOT_FORMAT_VERSION = "2.0.0" as const;
export const HOLDOUT_FORMAT_VERSION = "1.0.0" as const;
export const HOLDOUT_SCHEMA_REF = "urn:japp:schema:benchmark:case:v1" as const;
export const HOLDOUT_SCHEMA_VERSION = "1.0.0" as const;
export const HOLDOUT_VISIBILITY = "OWNER_REVIEWER" as const;

const MAX_MAPPING_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const STABLE_ID_SUFFIX = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const CONTENT_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const GENERIC_CATEGORIES = new Set([
  "AUTOFILL_ACCESSIBILITY",
  "AUTOFILL_ADVERSARIAL",
  "AUTOFILL_DYNAMIC",
  "AUTOFILL_HONEYPOT",
  "AUTOFILL_SENSITIVE",
  "AUTOFILL_STANDARD",
]);
const RESERVED_SEGMENTS = new Set([
  "aux",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "con",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
  "nul",
  "prn",
]);

export type HoldoutErrorCode =
  | "HOLDOUT_ARTIFACT_CONFLICT"
  | "HOLDOUT_ARTIFACT_DIGEST_MISMATCH"
  | "HOLDOUT_ARTIFACT_MAPPING_INVALID"
  | "HOLDOUT_ARTIFACT_MISSING"
  | "HOLDOUT_BODY_INVALID"
  | "HOLDOUT_CASE_MISMATCH"
  | "HOLDOUT_EXTERNAL_ROOT_REQUIRED"
  | "HOLDOUT_INVENTORY_INVALID"
  | "HOLDOUT_MAPPING_INVALID"
  | "HOLDOUT_MANIFEST_INVALID"
  | "HOLDOUT_PATH_INVALID"
  | "HOLDOUT_RACE_DETECTED"
  | "HOLDOUT_SIZE_LIMIT"
  | "HOLDOUT_STORAGE_INVALID";

export class HoldoutBoundaryError extends Error {
  public readonly code: HoldoutErrorCode;

  public constructor(code: HoldoutErrorCode) {
    super(code);
    this.name = "HoldoutBoundaryError";
    this.code = code;
  }

  public toJSON(): Readonly<{ name: string; code: HoldoutErrorCode }> {
    return { name: this.name, code: this.code };
  }
}

function fail(code: HoldoutErrorCode): never {
  throw new HoldoutBoundaryError(code);
}

interface MappingCaseV1 {
  readonly case_id: string;
  readonly category: string;
  readonly schema_ref: typeof HOLDOUT_SCHEMA_REF;
  readonly schema_version: typeof HOLDOUT_SCHEMA_VERSION;
  readonly file_id: string;
}

interface MappingFileV1 {
  readonly file_id: string;
  readonly relative_path: string;
}

interface MappingArtifactV2 {
  readonly artifact_ref: string;
  readonly relative_path: string;
}

export interface OwnerMappingV1 {
  readonly mapping_format_version: typeof OWNER_MAPPING_V1_FORMAT_VERSION;
  readonly manifest_id: string;
  readonly holdout_format_version: typeof HOLDOUT_FORMAT_VERSION;
  readonly storage_policy: "OWNER_CONTROLLED_EXTERNAL";
  readonly visibility_class: typeof HOLDOUT_VISIBILITY;
  readonly creation_provenance: BenchmarkHoldoutManifestV1["creation_provenance"];
  readonly review_provenance: BenchmarkHoldoutManifestV1["review_provenance"];
  readonly cases: readonly MappingCaseV1[];
  readonly files: readonly MappingFileV1[];
}

export interface OwnerMappingV2 {
  readonly mapping_format_version: typeof OWNER_MAPPING_FORMAT_VERSION;
  readonly manifest_id: string;
  readonly holdout_format_version: typeof HOLDOUT_FORMAT_VERSION;
  readonly storage_policy: "OWNER_CONTROLLED_EXTERNAL";
  readonly visibility_class: typeof HOLDOUT_VISIBILITY;
  readonly creation_provenance: BenchmarkHoldoutManifestV1["creation_provenance"];
  readonly review_provenance: BenchmarkHoldoutManifestV1["review_provenance"];
  readonly cases: readonly MappingCaseV1[];
  readonly files: readonly MappingFileV1[];
  readonly artifacts: readonly MappingArtifactV2[];
}

interface HiddenFileV1 {
  readonly format_version: "1.0.0";
  readonly cases: readonly BenchmarkCaseV1[];
}

export interface VerifiedHoldoutSnapshotV1 {
  readonly snapshot_format_version: "1.0.0";
  readonly manifest: BenchmarkHoldoutManifestV1;
  readonly verified_case_count: number;
  readonly verified_file_count: number;
  readonly verified_total_bytes: number;
  readonly receipt_digest: ContentDigest;
}

export interface VerifiedArtifactV2 {
  readonly artifact_ref: string;
  readonly artifact_digest: ContentDigest;
  readonly schema_ref: string;
  readonly byte_count: number;
}

export interface VerifiedHoldoutSnapshotV2 {
  readonly snapshot_format_version: typeof SNAPSHOT_FORMAT_VERSION;
  readonly manifest: BenchmarkHoldoutManifestV1;
  readonly verified_case_count: number;
  readonly verified_case_file_count: number;
  readonly verified_artifact_count: number;
  readonly verified_case_file_bytes: number;
  readonly verified_artifact_bytes: number;
  readonly verified_total_bytes: number;
  readonly verified_artifacts: readonly VerifiedArtifactV2[];
  readonly receipt_digest: ContentDigest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function genericStableId(
  value: unknown,
  prefix: "artifact" | "case" | "file" | "manifest" | "review" | "source",
): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`${prefix}_`) &&
    STABLE_ID_SUFFIX.test(value.slice(prefix.length + 1))
  );
}

function strictlySortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || value > (values[index - 1] ?? ""),
  );
}

function validProvenance(value: unknown, prefix: "review" | "source"): boolean {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "source_kind",
      "source_id",
      "observed_at",
      "source_digest",
    ])
  )
    return false;
  return (
    value.source_kind === "GENERATED" &&
    genericStableId(value.source_id, prefix) &&
    typeof value.observed_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value.observed_at) &&
    typeof value.source_digest === "string" &&
    CONTENT_DIGEST.test(value.source_digest)
  );
}

function validateMappingCore(
  value: unknown,
  mappingFormatVersion: "1.0.0" | "2.0.0",
  expectedKeys: readonly string[],
): Readonly<{
  record: Record<string, unknown>;
  paths: Set<string>;
}> {
  if (!isRecord(value) || !exactKeys(value, expectedKeys))
    return fail("HOLDOUT_MAPPING_INVALID");
  if (
    value.mapping_format_version !== mappingFormatVersion ||
    value.holdout_format_version !== HOLDOUT_FORMAT_VERSION ||
    value.storage_policy !== "OWNER_CONTROLLED_EXTERNAL" ||
    value.visibility_class !== HOLDOUT_VISIBILITY ||
    !genericStableId(value.manifest_id, "manifest") ||
    !validProvenance(value.creation_provenance, "source") ||
    !validProvenance(value.review_provenance, "review") ||
    !Array.isArray(value.cases) ||
    !Array.isArray(value.files) ||
    value.cases.length === 0 ||
    value.cases.length > 4096 ||
    value.files.length === 0 ||
    value.files.length > 128
  )
    return fail("HOLDOUT_MAPPING_INVALID");
  const created = (
    value.creation_provenance as { readonly observed_at: string }
  ).observed_at;
  const reviewed = (value.review_provenance as { readonly observed_at: string })
    .observed_at;
  if (reviewed < created) return fail("HOLDOUT_MAPPING_INVALID");
  let previousCase = "";
  const caseIds = new Set<string>();
  const fileIdsFromCases = new Set<string>();
  for (const item of value.cases) {
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "case_id",
        "category",
        "schema_ref",
        "schema_version",
        "file_id",
      ])
    )
      return fail("HOLDOUT_MAPPING_INVALID");
    if (
      !genericStableId(item.case_id, "case") ||
      !genericStableId(item.file_id, "file") ||
      typeof item.category !== "string" ||
      !GENERIC_CATEGORIES.has(item.category) ||
      item.schema_ref !== HOLDOUT_SCHEMA_REF ||
      item.schema_version !== HOLDOUT_SCHEMA_VERSION ||
      item.case_id <= previousCase ||
      caseIds.has(item.case_id)
    )
      return fail("HOLDOUT_MAPPING_INVALID");
    previousCase = item.case_id;
    caseIds.add(item.case_id);
    fileIdsFromCases.add(item.file_id);
  }
  let previousFile = "";
  const fileIds = new Set<string>();
  const paths = new Set<string>();
  for (const item of value.files) {
    if (!isRecord(item) || !exactKeys(item, ["file_id", "relative_path"]))
      return fail("HOLDOUT_MAPPING_INVALID");
    if (
      !genericStableId(item.file_id, "file") ||
      typeof item.relative_path !== "string" ||
      item.file_id <= previousFile ||
      fileIds.has(item.file_id) ||
      paths.has(item.relative_path)
    )
      return fail("HOLDOUT_MAPPING_INVALID");
    validateRelativePath(item.relative_path);
    previousFile = item.file_id;
    fileIds.add(item.file_id);
    paths.add(item.relative_path);
  }
  if (
    fileIds.size !== fileIdsFromCases.size ||
    [...fileIds].some((id) => !fileIdsFromCases.has(id))
  )
    return fail("HOLDOUT_MAPPING_INVALID");
  return { record: value, paths };
}

export function validateOwnerMappingV1(value: unknown): OwnerMappingV1 {
  const { record } = validateMappingCore(
    value,
    OWNER_MAPPING_V1_FORMAT_VERSION,
    [
      "mapping_format_version",
      "manifest_id",
      "holdout_format_version",
      "storage_policy",
      "visibility_class",
      "creation_provenance",
      "review_provenance",
      "cases",
      "files",
    ],
  );
  return record as unknown as OwnerMappingV1;
}

function registerNonCollidingPath(
  paths: Set<string>,
  parentsOfMappedPaths: Set<string>,
  candidate: string,
): boolean {
  if (paths.has(candidate) || parentsOfMappedPaths.has(candidate)) return false;
  const parents: string[] = [];
  for (
    let separatorIndex = candidate.indexOf("/");
    separatorIndex !== -1;
    separatorIndex = candidate.indexOf("/", separatorIndex + 1)
  ) {
    const parent = candidate.slice(0, separatorIndex);
    if (paths.has(parent)) return false;
    parents.push(parent);
  }
  paths.add(candidate);
  for (const parent of parents) parentsOfMappedPaths.add(parent);
  return true;
}

export function validateOwnerMappingV2(value: unknown): OwnerMappingV2 {
  const { record, paths: casePaths } = validateMappingCore(
    value,
    OWNER_MAPPING_FORMAT_VERSION,
    [
      "mapping_format_version",
      "manifest_id",
      "holdout_format_version",
      "storage_policy",
      "visibility_class",
      "creation_provenance",
      "review_provenance",
      "cases",
      "files",
      "artifacts",
    ],
  );
  if (
    !Array.isArray(record.artifacts) ||
    record.artifacts.length === 0 ||
    record.artifacts.length > 131_072 ||
    [...casePaths].some(
      (path) => path === OWNER_MAPPING_FILE || path === OWNER_MAPPING_V1_FILE,
    )
  )
    return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
  const paths = new Set<string>();
  const parentsOfMappedPaths = new Set<string>();
  for (const path of casePaths) {
    if (!registerNonCollidingPath(paths, parentsOfMappedPaths, path))
      return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
  }
  let previousArtifact = "";
  const artifactRefs = new Set<string>();
  for (const item of record.artifacts) {
    if (
      !isRecord(item) ||
      !exactKeys(item, ["artifact_ref", "relative_path"]) ||
      !genericStableId(item.artifact_ref, "artifact") ||
      typeof item.relative_path !== "string" ||
      item.artifact_ref <= previousArtifact ||
      artifactRefs.has(item.artifact_ref)
    )
      return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
    const relativePath = item.relative_path;
    validateRelativePath(relativePath);
    if (
      relativePath === OWNER_MAPPING_FILE ||
      relativePath === OWNER_MAPPING_V1_FILE ||
      !registerNonCollidingPath(paths, parentsOfMappedPaths, relativePath)
    )
      return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
    previousArtifact = item.artifact_ref;
    artifactRefs.add(item.artifact_ref);
  }
  return record as unknown as OwnerMappingV2;
}

export function validateOwnerMapping(value: unknown): OwnerMappingV2 {
  return validateOwnerMappingV2(value);
}

export function validateRelativePath(path: string): readonly string[] {
  if (
    path.length === 0 ||
    path.length > 512 ||
    isAbsolute(path) ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes(":") ||
    path.includes("%") ||
    path.normalize("NFC") !== path
  )
    return fail("HOLDOUT_PATH_INVALID");
  const segments = path.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        segment.endsWith(".") ||
        segment.endsWith(" ") ||
        !SAFE_SEGMENT.test(segment) ||
        RESERVED_SEGMENTS.has(segment.split(".")[0] ?? ""),
    )
  )
    return fail("HOLDOUT_PATH_INVALID");
  return segments;
}

interface Identity {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly mode: bigint;
  readonly nlink: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
}

function identity(stats: BigIntStats): Identity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mode: stats.mode,
    nlink: stats.nlink,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  };
}

function sameIdentity(left: Identity, right: Identity): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

interface SafeReadResult {
  readonly bytes: Uint8Array;
  readonly identity: Identity;
}

function safeReadRegularWithIdentity(
  path: string,
  limit: number,
): SafeReadResult {
  let before: BigIntStats;
  try {
    before = lstatSync(path, { bigint: true });
  } catch {
    return fail("HOLDOUT_STORAGE_INVALID");
  }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n)
    return fail("HOLDOUT_STORAGE_INVALID");
  if (before.size > BigInt(limit)) return fail("HOLDOUT_SIZE_LIMIT");
  const platformSafeFlags =
    process.platform === "win32"
      ? 0
      : constants.O_NOFOLLOW | constants.O_NONBLOCK;
  const flags = constants.O_RDONLY | platformSafeFlags;
  let descriptor: number;
  try {
    descriptor = openSync(path, flags);
  } catch {
    return fail("HOLDOUT_STORAGE_INVALID");
  }
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || !sameIdentity(identity(before), identity(opened)))
      return fail("HOLDOUT_RACE_DETECTED");
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) return fail("HOLDOUT_RACE_DETECTED");
      offset += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(identity(opened), identity(after)))
      return fail("HOLDOUT_RACE_DETECTED");
    return { bytes, identity: identity(after) };
  } finally {
    closeSync(descriptor);
  }
}

function safeReadRegular(path: string, limit: number): Uint8Array {
  return safeReadRegularWithIdentity(path, limit).bytes;
}

export interface PathRelationApi {
  readonly isAbsolute: (value: string) => boolean;
  readonly relative: (from: string, to: string) => string;
  readonly sep: string;
}

const NATIVE_PATH_RELATION_API: PathRelationApi = {
  isAbsolute,
  relative,
  sep,
};

function isWithinOrSame(
  base: string,
  candidate: string,
  pathApi: PathRelationApi,
): boolean {
  const relation = pathApi.relative(base, candidate);
  return (
    relation === "" ||
    (!pathApi.isAbsolute(relation) &&
      !relation.startsWith(`..${pathApi.sep}`) &&
      relation !== "..")
  );
}

export function isExternalRootRelation(
  repositoryPath: string,
  rootPath: string,
  pathApi: PathRelationApi = NATIVE_PATH_RELATION_API,
): boolean {
  return (
    !isWithinOrSame(repositoryPath, rootPath, pathApi) &&
    !isWithinOrSame(rootPath, repositoryPath, pathApi)
  );
}

function assertExternalRoot(root: string): {
  readonly absolute: string;
  readonly identity: Identity;
} {
  if (!isAbsolute(root)) return fail("HOLDOUT_EXTERNAL_ROOT_REQUIRED");
  const absolute = resolve(root);
  const repositoryRealPath = realpathSync(REPOSITORY_ROOT);
  const rootRealPath = realpathSync(absolute);
  if (!isExternalRootRelation(repositoryRealPath, rootRealPath))
    return fail("HOLDOUT_EXTERNAL_ROOT_REQUIRED");
  const stats = lstatSync(absolute, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink())
    return fail("HOLDOUT_STORAGE_INVALID");
  return { absolute, identity: identity(stats) };
}

function assertComponents(root: string, segments: readonly string[]): string {
  let current = root;
  for (let index = 0; index < segments.length; index++) {
    current = join(current, segments[index] ?? "");
    let stats: Stats;
    try {
      stats = lstatSync(current);
    } catch {
      return fail("HOLDOUT_STORAGE_INVALID");
    }
    if (stats.isSymbolicLink()) return fail("HOLDOUT_STORAGE_INVALID");
    if (index < segments.length - 1 && !stats.isDirectory())
      return fail("HOLDOUT_STORAGE_INVALID");
  }
  const contained = relative(root, resolve(current));
  if (contained.startsWith("..") || isAbsolute(contained))
    return fail("HOLDOUT_PATH_INVALID");
  return current;
}

function inventory(
  root: string,
  expected: ReadonlySet<string>,
  unexpectedCode: "HOLDOUT_INVENTORY_INVALID" | "HOLDOUT_RACE_DETECTED",
): Set<string> {
  const entries = new Set<string>();
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) return fail("HOLDOUT_STORAGE_INVALID");
      const logical = relative(root, path).split(sep).join("/");
      const entry = stats.isDirectory() ? `${logical}/` : logical;
      if (!expected.has(entry)) return fail(unexpectedCode);
      entries.add(entry);
      if (stats.isDirectory()) visit(path);
      else if (!stats.isFile()) return fail("HOLDOUT_STORAGE_INVALID");
    }
  };
  visit(root);
  return entries;
}

function expectedInventory(mapping: OwnerMappingV2): Set<string> {
  const expected = new Set<string>([OWNER_MAPPING_FILE]);
  for (const { relative_path } of [...mapping.files, ...mapping.artifacts]) {
    const segments = relative_path.split("/");
    for (let index = 1; index < segments.length; index++)
      expected.add(`${segments.slice(0, index).join("/")}/`);
    expected.add(relative_path);
  }
  return expected;
}

function parseHiddenFile(bytes: Uint8Array): HiddenFileV1 {
  let parsed: unknown;
  try {
    parsed = parseStrictJson(decodeStrictUtf8(bytes));
  } catch {
    return fail("HOLDOUT_BODY_INVALID");
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["format_version", "cases"]) ||
    parsed.format_version !== "1.0.0" ||
    !Array.isArray(parsed.cases) ||
    parsed.cases.length === 0
  )
    return fail("HOLDOUT_BODY_INVALID");
  for (const benchmarkCase of parsed.cases) {
    const validation = validateBenchmarkCaseV1(benchmarkCase);
    if (
      !validation.valid ||
      validation.value.benchmark_family !== "AUTOFILL_FEASIBILITY" ||
      validation.value.holdout_visibility !== "OWNER_CONTROLLED_HIDDEN" ||
      !validation.value.synthetic_data ||
      validation.value.input_artifacts.some(
        ({ artifact_ref }) => !genericStableId(artifact_ref, "artifact"),
      )
    )
      return fail("HOLDOUT_BODY_INVALID");
  }
  return parsed as unknown as HiddenFileV1;
}

function buildManifest(
  mapping: OwnerMappingV2,
  fileCommitments: readonly BenchmarkHoldoutManifestV1["files"][number][],
): BenchmarkHoldoutManifestV1 {
  const categories = new Map<string, number>();
  for (const item of mapping.cases)
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
  const payload = {
    manifest_id: mapping.manifest_id,
    holdout_format_version: mapping.holdout_format_version,
    case_ids: mapping.cases.map(({ case_id }) => case_id),
    schema_versions: [
      {
        schema_ref: HOLDOUT_SCHEMA_REF,
        schema_version: HOLDOUT_SCHEMA_VERSION,
      },
    ],
    case_count: mapping.cases.length,
    category_counts: [...categories]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([category, count]) => ({ category, count })),
    files: fileCommitments,
    synthetic_only: true,
    storage_policy: mapping.storage_policy,
    visibility_class: mapping.visibility_class,
    creation_provenance: mapping.creation_provenance,
    review_provenance: mapping.review_provenance,
  };
  return { ...payload, manifest_digest: sha256Canonical(payload) };
}

export function validateSanitizedManifest(
  value: unknown,
): BenchmarkHoldoutManifestV1 {
  const structural = validateBenchmarkHoldoutManifestV1(value);
  if (!structural.valid) return fail("HOLDOUT_MANIFEST_INVALID");
  const manifest = structural.value;
  const record = manifest as unknown as Record<string, unknown>;
  if (
    manifest.holdout_format_version !== HOLDOUT_FORMAT_VERSION ||
    manifest.storage_policy !== "OWNER_CONTROLLED_EXTERNAL" ||
    manifest.visibility_class !== HOLDOUT_VISIBILITY ||
    !manifest.synthetic_only ||
    !genericStableId(manifest.manifest_id, "manifest") ||
    manifest.case_count <= 0 ||
    manifest.case_count !== manifest.case_ids.length ||
    !strictlySortedUnique(manifest.case_ids) ||
    manifest.schema_versions.length !== 1 ||
    manifest.schema_versions[0]?.schema_ref !== HOLDOUT_SCHEMA_REF ||
    manifest.schema_versions[0].schema_version !== HOLDOUT_SCHEMA_VERSION ||
    manifest.case_ids.some((id) => !genericStableId(id, "case")) ||
    !strictlySortedUnique(manifest.files.map(({ file_id }) => file_id)) ||
    manifest.files.some(
      (file) =>
        !genericStableId(file.file_id, "file") ||
        file.byte_count <= 0 ||
        file.case_count <= 0,
    ) ||
    manifest.files.reduce((sum, file) => sum + file.case_count, 0) !==
      manifest.case_count ||
    !strictlySortedUnique(
      manifest.category_counts.map(({ category }) => category),
    ) ||
    manifest.category_counts.some(
      ({ category, count }) => !GENERIC_CATEGORIES.has(category) || count <= 0,
    ) ||
    manifest.category_counts.reduce((sum, item) => sum + item.count, 0) !==
      manifest.case_count ||
    !validProvenance(manifest.creation_provenance, "source") ||
    !validProvenance(manifest.review_provenance, "review") ||
    manifest.review_provenance.observed_at <
      manifest.creation_provenance.observed_at ||
    sha256Canonical(withoutKey(record, "manifest_digest")) !==
      manifest.manifest_digest
  )
    return fail("HOLDOUT_MANIFEST_INVALID");
  return manifest;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function verifyOwnerHoldoutInternal(
  rootValue = process.env[OWNER_ROOT_ENV],
): VerifiedHoldoutSnapshotV2 {
  if (rootValue === undefined || rootValue.length === 0)
    return fail("HOLDOUT_EXTERNAL_ROOT_REQUIRED");
  let root: { readonly absolute: string; readonly identity: Identity };
  try {
    root = assertExternalRoot(rootValue);
  } catch (error) {
    if (error instanceof HoldoutBoundaryError) throw error;
    return fail("HOLDOUT_EXTERNAL_ROOT_REQUIRED");
  }
  if (!existsSync(join(root.absolute, OWNER_MAPPING_FILE)))
    return fail("HOLDOUT_MAPPING_INVALID");
  const mappingPath = assertComponents(root.absolute, [OWNER_MAPPING_FILE]);
  let mapping: OwnerMappingV2;
  let mappingRead: SafeReadResult;
  try {
    mappingRead = safeReadRegularWithIdentity(mappingPath, MAX_MAPPING_BYTES);
    mapping = validateOwnerMapping(
      parseStrictJson(decodeStrictUtf8(mappingRead.bytes)),
    );
  } catch (error) {
    if (error instanceof HoldoutBoundaryError) throw error;
    return fail("HOLDOUT_MAPPING_INVALID");
  }
  const readIdentities = new Map<string, Identity>();
  const inodeKeys = new Set<string>();
  const rememberIdentity = (path: string, value: Identity): void => {
    if (value.ino !== 0n) {
      const key = `${String(value.dev)}:${String(value.ino)}`;
      if (inodeKeys.has(key)) return fail("HOLDOUT_STORAGE_INVALID");
      inodeKeys.add(key);
    }
    readIdentities.set(path, value);
  };
  rememberIdentity(mappingPath, mappingRead.identity);
  const expected = expectedInventory(mapping);
  const actualInventory = inventory(
    root.absolute,
    expected,
    "HOLDOUT_INVENTORY_INVALID",
  );
  if (
    mapping.artifacts.some(
      ({ relative_path }) => !actualInventory.has(relative_path),
    )
  )
    return fail("HOLDOUT_ARTIFACT_MISSING");
  if (
    actualInventory.size !== expected.size ||
    [...actualInventory].some((entry) => !expected.has(entry))
  )
    return fail("HOLDOUT_INVENTORY_INVALID");
  let caseFileBytes = 0;
  const commitments: BenchmarkHoldoutManifestV1["files"][number][] = [];
  const actualCaseIds = new Set<string>();
  const artifactDeclarations = new Map<
    string,
    Readonly<{ artifact_digest: ContentDigest; schema_ref: string }>
  >();
  for (const file of mapping.files) {
    const path = assertComponents(
      root.absolute,
      validateRelativePath(file.relative_path),
    );
    const read = safeReadRegularWithIdentity(path, MAX_FILE_BYTES);
    rememberIdentity(path, read.identity);
    const { bytes } = read;
    caseFileBytes += bytes.byteLength;
    if (caseFileBytes > MAX_TOTAL_BYTES) return fail("HOLDOUT_SIZE_LIMIT");
    const hidden = parseHiddenFile(bytes);
    const expectedCases = mapping.cases
      .filter(({ file_id }) => file_id === file.file_id)
      .map(({ case_id }) => case_id);
    const actualCases = hidden.cases.map(({ case_id }) => case_id).sort();
    if (
      new Set(actualCases).size !== actualCases.length ||
      JSON.stringify(actualCases) !== JSON.stringify(expectedCases)
    )
      return fail("HOLDOUT_CASE_MISMATCH");
    for (const id of actualCases) actualCaseIds.add(id);
    for (const benchmarkCase of hidden.cases) {
      for (const declaration of benchmarkCase.input_artifacts) {
        const existing = artifactDeclarations.get(declaration.artifact_ref);
        if (
          existing !== undefined &&
          (existing.artifact_digest !== declaration.artifact_digest ||
            existing.schema_ref !== declaration.schema_ref)
        )
          return fail("HOLDOUT_ARTIFACT_CONFLICT");
        artifactDeclarations.set(declaration.artifact_ref, {
          artifact_digest: declaration.artifact_digest as ContentDigest,
          schema_ref: declaration.schema_ref,
        });
      }
    }
    commitments.push({
      file_id: file.file_id,
      content_digest: sha256Bytes(bytes),
      byte_count: bytes.byteLength,
      case_count: actualCases.length,
    });
  }
  if (actualCaseIds.size !== mapping.cases.length)
    return fail("HOLDOUT_CASE_MISMATCH");
  const mappedArtifactRefs = new Set(
    mapping.artifacts.map(({ artifact_ref }) => artifact_ref),
  );
  if (
    [...artifactDeclarations].some(
      ([artifactRef]) => !mappedArtifactRefs.has(artifactRef),
    )
  )
    return fail("HOLDOUT_ARTIFACT_MISSING");
  if (
    [...mappedArtifactRefs].some(
      (artifactRef) => !artifactDeclarations.has(artifactRef),
    )
  )
    return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
  let artifactBytes = 0;
  const verifiedArtifacts: VerifiedArtifactV2[] = [];
  for (const artifact of mapping.artifacts) {
    const declaration = artifactDeclarations.get(artifact.artifact_ref);
    if (declaration === undefined)
      return fail("HOLDOUT_ARTIFACT_MAPPING_INVALID");
    const path = assertComponents(
      root.absolute,
      validateRelativePath(artifact.relative_path),
    );
    const read = safeReadRegularWithIdentity(path, MAX_FILE_BYTES);
    rememberIdentity(path, read.identity);
    const { bytes } = read;
    artifactBytes += bytes.byteLength;
    if (caseFileBytes + artifactBytes > MAX_TOTAL_BYTES)
      return fail("HOLDOUT_SIZE_LIMIT");
    if (sha256Bytes(bytes) !== declaration.artifact_digest)
      return fail("HOLDOUT_ARTIFACT_DIGEST_MISMATCH");
    verifiedArtifacts.push({
      artifact_ref: artifact.artifact_ref,
      artifact_digest: declaration.artifact_digest,
      schema_ref: declaration.schema_ref,
      byte_count: bytes.byteLength,
    });
  }
  const finalInventory = inventory(
    root.absolute,
    expected,
    "HOLDOUT_RACE_DETECTED",
  );
  if (
    finalInventory.size !== expected.size ||
    [...finalInventory].some((entry) => !expected.has(entry))
  )
    return fail("HOLDOUT_RACE_DETECTED");
  for (const [path, expectedIdentity] of readIdentities) {
    let current: BigIntStats;
    try {
      current = lstatSync(path, { bigint: true });
    } catch {
      return fail("HOLDOUT_RACE_DETECTED");
    }
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      !sameIdentity(expectedIdentity, identity(current))
    )
      return fail("HOLDOUT_RACE_DETECTED");
  }
  const after = lstatSync(root.absolute, { bigint: true });
  if (!sameIdentity(root.identity, identity(after)))
    return fail("HOLDOUT_RACE_DETECTED");
  const manifest = validateSanitizedManifest(
    buildManifest(mapping, commitments),
  );
  const receiptPayload = {
    snapshot_format_version: SNAPSHOT_FORMAT_VERSION,
    manifest_id: manifest.manifest_id,
    manifest_digest: manifest.manifest_digest,
    verified_case_count: manifest.case_count,
    verified_case_file_count: manifest.files.length,
    verified_artifact_count: verifiedArtifacts.length,
    verified_case_file_bytes: caseFileBytes,
    verified_artifact_bytes: artifactBytes,
    verified_total_bytes: caseFileBytes + artifactBytes,
    verified_artifacts: verifiedArtifacts,
  };
  return deepFreeze({
    snapshot_format_version: SNAPSHOT_FORMAT_VERSION,
    manifest,
    verified_case_count: manifest.case_count,
    verified_case_file_count: manifest.files.length,
    verified_artifact_count: verifiedArtifacts.length,
    verified_case_file_bytes: caseFileBytes,
    verified_artifact_bytes: artifactBytes,
    verified_total_bytes: caseFileBytes + artifactBytes,
    verified_artifacts: verifiedArtifacts,
    receipt_digest: sha256Canonical(receiptPayload),
  });
}

export function verifyOwnerHoldout(
  rootValue = process.env[OWNER_ROOT_ENV],
): VerifiedHoldoutSnapshotV2 {
  try {
    return verifyOwnerHoldoutInternal(rootValue);
  } catch (error) {
    if (error instanceof HoldoutBoundaryError) throw error;
    return fail("HOLDOUT_STORAGE_INVALID");
  }
}

export function exportSanitizedManifest(
  output: string,
  rootValue?: string,
): VerifiedHoldoutSnapshotV2 {
  const snapshot = verifyOwnerHoldout(rootValue);
  const absolute = resolveVisibleManifestPath(output);
  try {
    if (existsSync(absolute)) {
      const stats = lstatSync(absolute);
      if (
        !stats.isFile() ||
        stats.isSymbolicLink() ||
        stats.nlink !== 1 ||
        decodeStrictUtf8(safeReadRegular(absolute, MAX_MAPPING_BYTES)) !==
          canonicalFile(snapshot.manifest)
      )
        return fail("HOLDOUT_STORAGE_INVALID");
    } else
      writeFileSync(absolute, canonicalFile(snapshot.manifest), {
        encoding: "utf8",
        flag: "wx",
      });
  } catch (error) {
    if (error instanceof HoldoutBoundaryError) throw error;
    return fail("HOLDOUT_STORAGE_INVALID");
  }
  return snapshot;
}

function resolveVisibleManifestPath(value: string): string {
  const absolute = resolve(value);
  const allowedRoot = resolve(REPOSITORY_ROOT, "benchmarks/holdout-manifests");
  let rootStats: Stats;
  try {
    rootStats = lstatSync(allowedRoot);
  } catch {
    return fail("HOLDOUT_STORAGE_INVALID");
  }
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink())
    return fail("HOLDOUT_STORAGE_INVALID");
  if (
    dirname(absolute) !== allowedRoot ||
    !/^[a-z0-9][a-z0-9.-]{0,95}\.manifest\.json$/u.test(basename(absolute))
  )
    return fail("HOLDOUT_PATH_INVALID");
  return absolute;
}

export function verifyExportedManifest(
  manifestPath: string,
  rootValue?: string,
): VerifiedHoldoutSnapshotV2 {
  const snapshot = verifyOwnerHoldout(rootValue);
  const absolute = resolveVisibleManifestPath(manifestPath);
  let parsed: unknown;
  try {
    parsed = parseStrictJson(
      decodeStrictUtf8(safeReadRegular(absolute, MAX_MAPPING_BYTES)),
    );
  } catch (error) {
    if (error instanceof HoldoutBoundaryError) throw error;
    return fail("HOLDOUT_MANIFEST_INVALID");
  }
  const manifest = validateSanitizedManifest(parsed);
  assertManifestMatchesSnapshot(manifest, snapshot);
  return snapshot;
}

export function assertManifestMatchesSnapshot(
  manifest: BenchmarkHoldoutManifestV1,
  snapshot: VerifiedHoldoutSnapshotV1 | VerifiedHoldoutSnapshotV2,
): void {
  if (canonicalFile(manifest) !== canonicalFile(snapshot.manifest))
    return fail("HOLDOUT_MANIFEST_INVALID");
}
