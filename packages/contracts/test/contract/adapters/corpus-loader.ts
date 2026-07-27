import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson, type PlainJson } from "./normalization.ts";
import {
  ADAPTER_LANGUAGES,
  ADAPTER_OPERATIONS,
  ADAPTER_PROTOCOL_VERSION,
  MAX_ADAPTER_CASES,
  type AdapterBatchRequest,
  type AdapterLanguage,
  type AdapterOperation,
  type AdapterRequest,
} from "./protocol.ts";

export const CORPUS_ROOT = fileURLToPath(
  new URL("../corpus/", import.meta.url),
);
const MANIFEST_NAME = "manifest.v1.json";
const INVENTORY_NAMES = [
  "cases.v1.json",
  "raw-wire.v1.json",
  "values.v1.json",
] as const;

interface PatchOperation {
  readonly op: "remove" | "set";
  readonly path: string;
  readonly value?: PlainJson;
}

interface ValueInput {
  readonly value_ref: string;
  readonly patch?: readonly PatchOperation[];
}

interface RawInput {
  readonly raw_ref: string;
}

interface ScenarioInput {
  readonly adapter_fixture: string;
}

type CaseInput = ValueInput | RawInput | ScenarioInput;

export interface CorpusExpected {
  readonly valid: boolean;
  readonly authorized?: boolean;
  readonly error_category?: string;
  readonly error_code?: string;
  readonly normalized_ref?: string;
  readonly version_outcome?: string;
}

export interface CorpusCase {
  readonly id: string;
  readonly schema_ref: string;
  readonly category: string;
  readonly operation: AdapterOperation;
  readonly input: CaseInput;
  readonly authorization_context?: ValueInput;
  readonly expected: CorpusExpected;
  readonly languages: readonly AdapterLanguage[];
  readonly rationale: string;
  readonly synthetic_data: true;
}

interface FileManifestEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface CorpusManifest {
  readonly corpus_format_version: "1.0.0";
  readonly files: readonly FileManifestEntry[];
  readonly case_count: number;
  readonly category_counts: Readonly<Record<string, number>>;
  readonly language_counts: Readonly<Record<string, number>>;
  readonly operation_counts: Readonly<Record<string, number>>;
  readonly synthetic_only: true;
  readonly manifest_sha256: string;
}

interface LoadedStores {
  readonly values: Readonly<Record<string, PlainJson>>;
  readonly rawValues: Readonly<Record<string, RawValue>>;
}

interface RawValue {
  readonly encoding: "base64" | "repeat" | "utf8";
  readonly text?: string;
  readonly base64?: string;
  readonly prefix?: string;
  readonly repeated?: string;
  readonly count?: number;
  readonly suffix?: string;
}

export interface LoadedCorpus {
  readonly manifest: CorpusManifest;
  readonly cases: readonly CorpusCase[];
  readonly stores: LoadedStores;
  readonly canonical_inventory: string;
}

export class CorpusError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CorpusError";
    this.code = code;
  }
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseObjectFile(path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new CorpusError("CORPUS_JSON_INVALID");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CorpusError("CORPUS_SHAPE_INVALID");
  }
  return parsed as Record<string, unknown>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function countBy(values: readonly string[]): Readonly<Record<string, number>> {
  const result: Record<string, number> = Object.create(null) as Record<
    string,
    number
  >;
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function manifestPayload(
  manifest: Omit<CorpusManifest, "manifest_sha256">,
): string {
  return canonicalJson(manifest);
}

function manifestWithoutDigest(
  value: CorpusManifest,
): Omit<CorpusManifest, "manifest_sha256"> {
  return {
    corpus_format_version: value.corpus_format_version,
    files: value.files,
    case_count: value.case_count,
    category_counts: value.category_counts,
    language_counts: value.language_counts,
    operation_counts: value.operation_counts,
    synthetic_only: value.synthetic_only,
  };
}

function parseCases(value: Record<string, unknown>): readonly CorpusCase[] {
  if (
    !exactKeys(value, ["corpus_format_version", "cases"]) ||
    value.corpus_format_version !== "1.0.0" ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0 ||
    value.cases.length > MAX_ADAPTER_CASES
  ) {
    throw new CorpusError("CASE_INVENTORY_INVALID");
  }
  const cases = value.cases as unknown[];
  const ids = new Set<string>();
  let previous = "";
  for (const candidate of cases) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      throw new CorpusError("CASE_INVENTORY_INVALID");
    }
    const item = candidate as Record<string, unknown>;
    const requiredKeys = [
      "category",
      "expected",
      "id",
      "input",
      "languages",
      "operation",
      "rationale",
      "schema_ref",
      "synthetic_data",
    ];
    const allowedKeys = new Set([...requiredKeys, "authorization_context"]);
    if (
      requiredKeys.some((key) => !(key in item)) ||
      Object.keys(item).some((key) => !allowedKeys.has(key)) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      ids.has(item.id) ||
      (previous !== "" && previous >= item.id) ||
      typeof item.schema_ref !== "string" ||
      typeof item.category !== "string" ||
      !ADAPTER_OPERATIONS.includes(item.operation as AdapterOperation) ||
      typeof item.rationale !== "string" ||
      item.rationale.length === 0 ||
      item.synthetic_data !== true ||
      !Array.isArray(item.languages) ||
      item.languages.length === 0
    ) {
      throw new CorpusError("CASE_INVENTORY_INVALID");
    }
    const languages = item.languages as unknown[];
    if (
      languages.some(
        (language) =>
          typeof language !== "string" ||
          !ADAPTER_LANGUAGES.includes(language as AdapterLanguage),
      ) ||
      JSON.stringify(languages) !== JSON.stringify([...languages].sort()) ||
      new Set(languages).size !== languages.length
    ) {
      throw new CorpusError("CASE_LANGUAGE_SET_INVALID");
    }
    ids.add(item.id);
    previous = item.id;
  }
  return cases as readonly CorpusCase[];
}

function parseStores(
  valuesDocument: Record<string, unknown>,
  rawDocument: Record<string, unknown>,
): LoadedStores {
  if (
    !exactKeys(valuesDocument, ["format_version", "values"]) ||
    valuesDocument.format_version !== "1.0.0" ||
    typeof valuesDocument.values !== "object" ||
    valuesDocument.values === null ||
    Array.isArray(valuesDocument.values) ||
    !exactKeys(rawDocument, ["format_version", "raw_values"]) ||
    rawDocument.format_version !== "1.0.0" ||
    typeof rawDocument.raw_values !== "object" ||
    rawDocument.raw_values === null ||
    Array.isArray(rawDocument.raw_values)
  ) {
    throw new CorpusError("CORPUS_STORE_INVALID");
  }
  return {
    values: valuesDocument.values as Readonly<Record<string, PlainJson>>,
    rawValues: rawDocument.raw_values as Readonly<Record<string, RawValue>>,
  };
}

function actualCorpusFiles(root: string): readonly string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new CorpusError("CORPUS_ENTRY_INVALID");
    }
    names.push(entry.name);
  }
  return names.sort();
}

function readManifest(root: string): CorpusManifest {
  const value = parseObjectFile(join(root, MANIFEST_NAME));
  const keys = [
    "case_count",
    "category_counts",
    "corpus_format_version",
    "files",
    "language_counts",
    "manifest_sha256",
    "operation_counts",
    "synthetic_only",
  ];
  if (
    !exactKeys(value, keys) ||
    value.corpus_format_version !== "1.0.0" ||
    value.synthetic_only !== true ||
    typeof value.manifest_sha256 !== "string" ||
    !Array.isArray(value.files)
  ) {
    throw new CorpusError("CORPUS_MANIFEST_INVALID");
  }
  return value as unknown as CorpusManifest;
}

export function buildCorpusManifest(root = CORPUS_ROOT): CorpusManifest {
  const cases = parseCases(parseObjectFile(join(root, "cases.v1.json")));
  const files = INVENTORY_NAMES.map((path): FileManifestEntry => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
  const withoutDigest: Omit<CorpusManifest, "manifest_sha256"> = {
    corpus_format_version: "1.0.0",
    files,
    case_count: cases.length,
    category_counts: countBy(cases.map((item) => item.category)),
    language_counts: countBy(cases.flatMap((item) => item.languages)),
    operation_counts: countBy(cases.map((item) => item.operation)),
    synthetic_only: true,
  };
  return {
    ...withoutDigest,
    manifest_sha256: sha256(manifestPayload(withoutDigest)),
  };
}

export function updateCorpusManifest(root = CORPUS_ROOT): void {
  const manifest = buildCorpusManifest(root);
  writeFileSync(
    join(root, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

export function loadCorpus(root = CORPUS_ROOT): LoadedCorpus {
  const resolvedRoot = resolve(root);
  const expectedNames = [MANIFEST_NAME, ...INVENTORY_NAMES].sort();
  if (
    JSON.stringify(actualCorpusFiles(resolvedRoot)) !==
    JSON.stringify(expectedNames)
  ) {
    throw new CorpusError("CORPUS_FILE_INVENTORY_MISMATCH");
  }
  for (const name of expectedNames) {
    const path = join(resolvedRoot, name);
    if (lstatSync(path).isSymbolicLink()) {
      throw new CorpusError("CORPUS_ENTRY_INVALID");
    }
    const rel = relative(resolvedRoot, path);
    if (rel.startsWith("..") || rel.includes(`${sep}..${sep}`)) {
      throw new CorpusError("CORPUS_PATH_TRAVERSAL");
    }
  }
  const committed = readManifest(resolvedRoot);
  const computed = buildCorpusManifest(resolvedRoot);
  if (
    committed.manifest_sha256 !==
      sha256(manifestPayload(manifestWithoutDigest(committed))) ||
    canonicalJson(committed) !== canonicalJson(computed)
  ) {
    throw new CorpusError("CORPUS_MANIFEST_MISMATCH");
  }
  const cases = parseCases(
    parseObjectFile(join(resolvedRoot, "cases.v1.json")),
  );
  const stores = parseStores(
    parseObjectFile(join(resolvedRoot, "values.v1.json")),
    parseObjectFile(join(resolvedRoot, "raw-wire.v1.json")),
  );
  // Resolve every reference during load so missing inputs fail before an
  // adapter process is started.
  for (const corpusCase of cases) {
    resolveCaseInput(corpusCase, stores);
    if (corpusCase.authorization_context !== undefined) {
      resolveValueInput(corpusCase.authorization_context, stores.values);
    }
    if (corpusCase.expected.normalized_ref !== undefined) {
      requireValue(stores.values, corpusCase.expected.normalized_ref);
    }
  }
  return {
    manifest: committed,
    cases,
    stores,
    canonical_inventory: canonicalJson(cases),
  };
}

function requireValue(
  values: Readonly<Record<string, PlainJson>>,
  ref: string,
): PlainJson {
  const value = values[ref];
  if (value === undefined) {
    throw new CorpusError("CORPUS_REFERENCE_MISSING");
  }
  return value;
}

function decodePointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function applyPatch(
  value: PlainJson,
  patch: readonly PatchOperation[],
): PlainJson {
  const result = structuredClone(value);
  for (const operation of patch) {
    if (!operation.path.startsWith("/") || operation.path === "/") {
      throw new CorpusError("CORPUS_PATCH_INVALID");
    }
    const parts = operation.path
      .slice(1)
      .split("/")
      .map((part) => decodePointerSegment(part));
    let parent: PlainJson = result;
    for (const part of parts.slice(0, -1)) {
      if (
        typeof parent !== "object" ||
        parent === null ||
        Array.isArray(parent) ||
        !(part in parent)
      ) {
        throw new CorpusError("CORPUS_PATCH_INVALID");
      }
      parent = parent[part] as PlainJson;
    }
    const leaf = parts.at(-1);
    if (
      leaf === undefined ||
      typeof parent !== "object" ||
      parent === null ||
      Array.isArray(parent)
    ) {
      throw new CorpusError("CORPUS_PATCH_INVALID");
    }
    if (operation.op === "remove") {
      if (!(leaf in parent)) {
        throw new CorpusError("CORPUS_PATCH_INVALID");
      }
      Reflect.deleteProperty(parent, leaf);
    } else {
      if (!("value" in operation)) {
        throw new CorpusError("CORPUS_PATCH_INVALID");
      }
      parent[leaf] = structuredClone(operation.value);
    }
  }
  return result;
}

function resolveValueInput(
  input: ValueInput,
  values: Readonly<Record<string, PlainJson>>,
): PlainJson {
  const base = requireValue(values, input.value_ref);
  return applyPatch(base, input.patch ?? []);
}

function rawBytes(raw: RawValue): Uint8Array {
  if (raw.encoding === "utf8" && typeof raw.text === "string") {
    return Buffer.from(raw.text, "utf8");
  }
  if (raw.encoding === "base64" && typeof raw.base64 === "string") {
    return Buffer.from(raw.base64, "base64");
  }
  if (
    raw.encoding === "repeat" &&
    typeof raw.prefix === "string" &&
    typeof raw.repeated === "string" &&
    typeof raw.count === "number" &&
    Number.isSafeInteger(raw.count) &&
    raw.count >= 0 &&
    typeof raw.suffix === "string"
  ) {
    return Buffer.from(
      `${raw.prefix}${raw.repeated.repeat(raw.count)}${raw.suffix}`,
      "utf8",
    );
  }
  throw new CorpusError("CORPUS_RAW_VALUE_INVALID");
}

function resolveCaseInput(
  corpusCase: CorpusCase,
  stores: LoadedStores,
): { readonly bytes: Uint8Array; readonly scenario?: string } {
  if ("value_ref" in corpusCase.input) {
    return {
      bytes: Buffer.from(
        canonicalJson(resolveValueInput(corpusCase.input, stores.values)),
        "utf8",
      ),
    };
  }
  if ("raw_ref" in corpusCase.input) {
    const raw = stores.rawValues[corpusCase.input.raw_ref];
    if (raw === undefined) {
      throw new CorpusError("CORPUS_REFERENCE_MISSING");
    }
    return { bytes: rawBytes(raw) };
  }
  if ("adapter_fixture" in corpusCase.input) {
    return {
      bytes: Buffer.from(
        canonicalJson(requireValue(stores.values, "fixture.full")),
        "utf8",
      ),
      scenario: corpusCase.input.adapter_fixture,
    };
  }
  throw new CorpusError("CORPUS_INPUT_INVALID");
}

export function expectedCanonicalJson(
  corpusCase: CorpusCase,
  stores: LoadedStores,
): string | undefined {
  const ref = corpusCase.expected.normalized_ref;
  if (ref !== undefined) {
    return canonicalJson(requireValue(stores.values, ref));
  }
  // Every schema-valid ordinary wire case resolves its expected normalized
  // form from the same canonical value + patch that produces its raw input.
  // Adapter-only live-object scenarios carry an explicit normalized_ref.
  if (corpusCase.expected.valid && "value_ref" in corpusCase.input) {
    return canonicalJson(resolveValueInput(corpusCase.input, stores.values));
  }
  return undefined;
}

export function adapterBatchFor(
  corpus: LoadedCorpus,
  language: AdapterLanguage,
): AdapterBatchRequest {
  const requests: AdapterRequest[] = [];
  for (const corpusCase of corpus.cases) {
    if (!corpusCase.languages.includes(language)) {
      continue;
    }
    const input = resolveCaseInput(corpusCase, corpus.stores);
    const context =
      corpusCase.authorization_context === undefined
        ? undefined
        : Buffer.from(
            canonicalJson(
              resolveValueInput(
                corpusCase.authorization_context,
                corpus.stores.values,
              ),
            ),
            "utf8",
          ).toString("base64");
    requests.push({
      case_id: corpusCase.id,
      schema_ref: corpusCase.schema_ref,
      operation: corpusCase.operation,
      input_bytes_base64: Buffer.from(input.bytes).toString("base64"),
      ...(context === undefined
        ? {}
        : { trusted_context_bytes_base64: context }),
      ...(input.scenario === undefined ? {} : { scenario: input.scenario }),
    });
  }
  return {
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    requests,
  };
}

export function corpusRootParent(): string {
  return dirname(CORPUS_ROOT);
}
