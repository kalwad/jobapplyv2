import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalJson, type PlainJson } from "../adapters/normalization.ts";
import {
  ADAPTER_LANGUAGES,
  ADAPTER_PROTOCOL_VERSION,
  MAX_ADAPTER_CASES,
  MAX_PROTOCOL_BYTES,
  MAX_RAW_INPUT_BYTES,
  type AdapterBatchRequest,
  type AdapterLanguage,
} from "../adapters/protocol.ts";
import { parseRawJson } from "../adapters/raw-json.ts";

export const HISTORICAL_WITNESS_PATH = fileURLToPath(
  new URL("./historical-platform-v1.json", import.meta.url),
);
export const HISTORICAL_WITNESS_REPOSITORY_PATH =
  "packages/contracts/test/contract/semantic-witnesses/historical-platform-v1.json";
export const HISTORICAL_WITNESS_INVENTORY_SHA256 =
  "6ce50f164c3b58a1062f43bcca7164cd5a4fcee0d93a6f1525a3c54379688fbc";

const EXPECTED_REVISIONS = [
  ["6708f1a", "6708f1a463cf1a452fc149b8ac0c93e506828046"],
  ["12e4062", "12e4062896c8c5b92d5affaf8b0583be0090fb39"],
  ["44827ae", "44827ae73a04d4ef63ccb40cd93fd14b7e304010"],
  ["860b6e1", "860b6e1e27a790668b7dec4fe8014c9f764106be"],
] as const;

const EXPECTED_SOURCE_COUNTS = [
  [41, 0],
  [47, 0],
  [52, 126],
  [62, 228],
] as const;

const EXPECTED_ACCEPTED_CONTENT_ANCHOR_EQUIVALENCE = {
  revision: "0659c13ff046c921ca648c50b40e71330abf2e75",
  tree: "211c4b72cae4404dc277d8b31df240e4abfc717c",
  compared_to_revision: "860b6e1e27a790668b7dec4fe8014c9f764106be",
  checked_files: {
    "packages/contracts/generated/typescript/semantic/rules.v1.ts": {
      byte_identical: true,
      sha256:
        "e12617149c36a234c8baae6b043fb9ce525bb172ffbdba2b4d2b218bee0746fc",
    },
    "packages/contracts/test/contract/corpus/cases.v1.json": {
      byte_identical: true,
      sha256:
        "2a41b0e75382a54e0231700a00bf252ede5a64f998115049745b59c96af981df",
    },
    "packages/contracts/test/contract/corpus/values.v1.json": {
      byte_identical: true,
      sha256:
        "d42842b8a8270bdfbffa123476ec32b757bbbcf55a5fc921272e24e7f0180bea",
    },
    "packages/contracts/test/schema/w07-platform-rule-matrix.test.ts": {
      byte_identical: true,
      sha256:
        "e58100427c7367977d83f4cd2e6dfc19f9ad6a5cd27976e868b212d39b7f4864",
    },
  },
} as const;

const EXPECTED_SCHEMA_COUNTS = new Map<string, number>([
  ["urn:japp:schema:platform:browser-discovery-request:v1", 1],
  ["urn:japp:schema:platform:browser-record:v1", 3],
  ["urn:japp:schema:platform:capability-report:v1", 3],
  ["urn:japp:schema:platform:certification-input:v1", 5],
  ["urn:japp:schema:platform:diagnostic-report:v1", 3],
  ["urn:japp:schema:platform:evidence-record:v1", 18],
  ["urn:japp:schema:platform:installer-state:v1", 26],
  ["urn:japp:schema:platform:model-runtime-profile:v1", 4],
  ["urn:japp:schema:platform:native-messaging-registration:v1", 2],
  ["urn:japp:schema:platform:native-messaging-result:v1", 32],
  ["urn:japp:schema:platform:path-request:v1", 2],
  ["urn:japp:schema:platform:path-resolution:v1", 6],
  ["urn:japp:schema:platform:process-plan:v1", 65],
  ["urn:japp:schema:platform:process-status:v1", 10],
  ["urn:japp:schema:platform:runtime-capability:v1", 12],
  ["urn:japp:schema:platform:secret-store-request:v1", 2],
  ["urn:japp:schema:platform:secret-store-result:v1", 8],
  ["urn:japp:schema:platform:target-identity:v1", 4],
  ["urn:japp:schema:platform:update-state:v1", 23],
]);

export interface HistoricalWitnessProvenance {
  readonly revision: string;
  readonly source: string;
}

export interface HistoricalWitnessSourceRevision {
  readonly revision_name: string;
  readonly revision: string;
  readonly tree: string;
  readonly evaluator_sha256: string;
  readonly corpus_cases_sha256: string;
  readonly corpus_values_sha256: string;
  readonly matrix_sha256: string | null;
  readonly corpus_positive_reference_count: number;
  readonly matrix_positive_reference_count: number;
}

export interface HistoricalWitnessAcceptance {
  readonly "6708f1a": boolean;
  readonly "12e4062": boolean;
  readonly "44827ae": boolean;
  readonly "860b6e1": boolean;
}

export interface HistoricalSemanticWitness {
  readonly id: string;
  readonly schema_ref: string;
  readonly operation: "VALIDATE";
  readonly languages: readonly AdapterLanguage[];
  readonly expected_valid: true;
  readonly input: PlainJson;
  readonly historical_acceptance: HistoricalWitnessAcceptance;
  readonly provenance: readonly HistoricalWitnessProvenance[];
  readonly synthetic_data: true;
}

export interface HistoricalWitnessInventory {
  readonly format_version: "1.0.0";
  readonly description: string;
  readonly source_revisions: readonly HistoricalWitnessSourceRevision[];
  readonly accepted_content_anchor_equivalence: PlainJson;
  readonly raw_reference_count: number;
  readonly witness_count: number;
  readonly insertion_order_sensitive_unique_count: number;
  readonly recursive_key_sort_collapse_count: number;
  readonly acceptance_pattern_counts: Readonly<Record<string, number>>;
  readonly acceptance_pattern_order: readonly string[];
  readonly endpoint_union: readonly string[];
  readonly endpoint_union_uncovered_witness_count: 0;
  readonly witnesses: readonly HistoricalSemanticWitness[];
  readonly synthetic_only: true;
  readonly inventory_sha256: string;
}

export class HistoricalWitnessError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "HistoricalWitnessError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function payload(
  inventory: HistoricalWitnessInventory,
): Omit<HistoricalWitnessInventory, "inventory_sha256"> {
  return {
    format_version: inventory.format_version,
    description: inventory.description,
    source_revisions: inventory.source_revisions,
    accepted_content_anchor_equivalence:
      inventory.accepted_content_anchor_equivalence,
    raw_reference_count: inventory.raw_reference_count,
    witness_count: inventory.witness_count,
    insertion_order_sensitive_unique_count:
      inventory.insertion_order_sensitive_unique_count,
    recursive_key_sort_collapse_count:
      inventory.recursive_key_sort_collapse_count,
    acceptance_pattern_counts: inventory.acceptance_pattern_counts,
    acceptance_pattern_order: inventory.acceptance_pattern_order,
    endpoint_union: inventory.endpoint_union,
    endpoint_union_uncovered_witness_count:
      inventory.endpoint_union_uncovered_witness_count,
    witnesses: inventory.witnesses,
    synthetic_only: inventory.synthetic_only,
  };
}

export function loadHistoricalWitnessInventory(
  path = HISTORICAL_WITNESS_PATH,
): HistoricalWitnessInventory {
  let bytes: Buffer;
  try {
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_ENTRY_INVALID");
    }
    bytes = readFileSync(path);
  } catch (error) {
    if (error instanceof HistoricalWitnessError) {
      throw error;
    }
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_ENTRY_INVALID");
  }
  let parsed: PlainJson;
  try {
    parsed = parseRawJson(bytes, MAX_PROTOCOL_BYTES);
  } catch {
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_JSON_INVALID");
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, [
      "accepted_content_anchor_equivalence",
      "acceptance_pattern_counts",
      "acceptance_pattern_order",
      "description",
      "endpoint_union",
      "endpoint_union_uncovered_witness_count",
      "format_version",
      "inventory_sha256",
      "insertion_order_sensitive_unique_count",
      "raw_reference_count",
      "recursive_key_sort_collapse_count",
      "source_revisions",
      "synthetic_only",
      "witness_count",
      "witnesses",
    ]) ||
    parsed.format_version !== "1.0.0" ||
    typeof parsed.description !== "string" ||
    parsed.description.length === 0 ||
    parsed.synthetic_only !== true ||
    typeof parsed.inventory_sha256 !== "string" ||
    parsed.inventory_sha256 !== HISTORICAL_WITNESS_INVENTORY_SHA256 ||
    parsed.raw_reference_count !== 556 ||
    parsed.witness_count !== 229 ||
    parsed.insertion_order_sensitive_unique_count !== 231 ||
    parsed.recursive_key_sort_collapse_count !== 2 ||
    canonicalJson(parsed.accepted_content_anchor_equivalence) !==
      canonicalJson(EXPECTED_ACCEPTED_CONTENT_ANCHOR_EQUIVALENCE) ||
    parsed.endpoint_union_uncovered_witness_count !== 0 ||
    canonicalJson(parsed.acceptance_pattern_order) !==
      canonicalJson(["6708f1a", "12e4062", "44827ae", "860b6e1"]) ||
    canonicalJson(parsed.endpoint_union) !==
      canonicalJson(["6708f1a", "860b6e1"]) ||
    !isRecord(parsed.acceptance_pattern_counts) ||
    canonicalJson(parsed.acceptance_pattern_counts) !==
      canonicalJson({
        "0001": 17,
        "0011": 2,
        "1110": 2,
        "1111": 208,
      }) ||
    !Array.isArray(parsed.source_revisions) ||
    parsed.source_revisions.length !== 4 ||
    !Number.isSafeInteger(parsed.witness_count) ||
    (parsed.witness_count as number) < 1 ||
    (parsed.witness_count as number) > MAX_ADAPTER_CASES ||
    !Array.isArray(parsed.witnesses) ||
    parsed.witnesses.length !== parsed.witness_count
  ) {
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_INVENTORY_INVALID");
  }

  const revisionNames = EXPECTED_REVISIONS.map(([name]) => name);
  const revisionIds = new Set<string>();
  for (const [index, candidate] of parsed.source_revisions.entries()) {
    const expectedRevision = EXPECTED_REVISIONS[index];
    const expectedCounts = EXPECTED_SOURCE_COUNTS[index];
    if (
      expectedRevision === undefined ||
      expectedCounts === undefined ||
      !isRecord(candidate) ||
      !exactKeys(candidate, [
        "corpus_cases_sha256",
        "corpus_positive_reference_count",
        "corpus_values_sha256",
        "evaluator_sha256",
        "matrix_positive_reference_count",
        "matrix_sha256",
        "revision",
        "revision_name",
        "tree",
      ]) ||
      candidate.revision_name !== expectedRevision[0] ||
      candidate.revision !== expectedRevision[1] ||
      revisionIds.has(candidate.revision) ||
      typeof candidate.tree !== "string" ||
      !/^[0-9a-f]{40}$/.test(candidate.tree) ||
      typeof candidate.evaluator_sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate.evaluator_sha256) ||
      typeof candidate.corpus_cases_sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate.corpus_cases_sha256) ||
      typeof candidate.corpus_values_sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(candidate.corpus_values_sha256) ||
      (candidate.matrix_sha256 !== null &&
        (typeof candidate.matrix_sha256 !== "string" ||
          !/^[0-9a-f]{64}$/.test(candidate.matrix_sha256))) ||
      candidate.corpus_positive_reference_count !== expectedCounts[0] ||
      candidate.matrix_positive_reference_count !== expectedCounts[1]
    ) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_SOURCE_INVALID");
    }
    revisionIds.add(candidate.revision);
  }

  const ids = new Set<string>();
  const inputs = new Set<string>();
  const schemaCounts = new Map<string, number>();
  const observedPatternCounts = new Map<string, number>();
  const provenanceCounts = new Map<
    string,
    { corpus: number; matrix: number }
  >();
  let provenanceCount = 0;
  let previousId = "";
  for (const candidate of parsed.witnesses) {
    if (!isRecord(candidate)) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_ROW_INVALID");
    }
    const historicalAcceptance = candidate.historical_acceptance;
    if (
      !exactKeys(candidate, [
        "expected_valid",
        "historical_acceptance",
        "id",
        "input",
        "languages",
        "operation",
        "provenance",
        "schema_ref",
        "synthetic_data",
      ]) ||
      typeof candidate.id !== "string" ||
      !/^x-w07\.historical-positive\.[0-9a-f]{24}$/.test(candidate.id) ||
      ids.has(candidate.id) ||
      (previousId !== "" && previousId >= candidate.id) ||
      typeof candidate.schema_ref !== "string" ||
      !EXPECTED_SCHEMA_COUNTS.has(candidate.schema_ref) ||
      candidate.operation !== "VALIDATE" ||
      candidate.expected_valid !== true ||
      candidate.synthetic_data !== true ||
      !Array.isArray(candidate.languages) ||
      canonicalJson(candidate.languages) !==
        canonicalJson([...ADAPTER_LANGUAGES]) ||
      !isRecord(candidate.input) ||
      !isRecord(historicalAcceptance) ||
      !exactKeys(historicalAcceptance, revisionNames) ||
      revisionNames.some(
        (revision) => typeof historicalAcceptance[revision] !== "boolean",
      ) ||
      (historicalAcceptance["6708f1a"] !== true &&
        historicalAcceptance["860b6e1"] !== true) ||
      !Array.isArray(candidate.provenance) ||
      candidate.provenance.length === 0
    ) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_ROW_INVALID");
    }
    const acceptancePattern = revisionNames
      .map((revision) => (historicalAcceptance[revision] === true ? "1" : "0"))
      .join("");
    observedPatternCounts.set(
      acceptancePattern,
      (observedPatternCounts.get(acceptancePattern) ?? 0) + 1,
    );
    const inputBytes = Buffer.from(
      canonicalJson(candidate.input as PlainJson),
      "utf8",
    );
    if (inputBytes.byteLength > MAX_RAW_INPUT_BYTES) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_INPUT_TOO_LARGE");
    }
    const inputKey = `${candidate.schema_ref}\n${inputBytes.toString("utf8")}`;
    if (
      inputs.has(inputKey) ||
      candidate.id !==
        `x-w07.historical-positive.${sha256(inputKey).slice(0, 24)}`
    ) {
      throw new HistoricalWitnessError("HISTORICAL_WITNESS_INPUT_DUPLICATE");
    }
    let previousProvenance = "";
    const provenanceKeys = new Set<string>();
    for (const item of candidate.provenance) {
      if (
        !isRecord(item) ||
        !exactKeys(item, ["revision", "source"]) ||
        typeof item.revision !== "string" ||
        !revisionIds.has(item.revision) ||
        typeof item.source !== "string" ||
        item.source.length === 0 ||
        Buffer.byteLength(item.source, "utf8") > MAX_RAW_INPUT_BYTES
      ) {
        throw new HistoricalWitnessError(
          "HISTORICAL_WITNESS_PROVENANCE_INVALID",
        );
      }
      const key = `${item.revision}/${item.source}`;
      if (provenanceKeys.has(key) || previousProvenance >= key) {
        throw new HistoricalWitnessError(
          "HISTORICAL_WITNESS_PROVENANCE_INVALID",
        );
      }
      let source: PlainJson;
      try {
        source = parseRawJson(
          Buffer.from(item.source, "utf8"),
          MAX_RAW_INPUT_BYTES,
        );
      } catch {
        throw new HistoricalWitnessError(
          "HISTORICAL_WITNESS_PROVENANCE_INVALID",
        );
      }
      if (
        !isRecord(source) ||
        canonicalJson(source) !== item.source ||
        (source.source_kind !== "expected-valid-corpus-case" &&
          source.source_kind !== "explicit-matrix-positive")
      ) {
        throw new HistoricalWitnessError(
          "HISTORICAL_WITNESS_PROVENANCE_INVALID",
        );
      }
      const count = provenanceCounts.get(item.revision) ?? {
        corpus: 0,
        matrix: 0,
      };
      if (source.source_kind === "expected-valid-corpus-case") {
        if (
          !exactKeys(source, [
            "case_id",
            "source_kind",
            "source_path",
            "value_ref",
          ]) ||
          source.source_path !==
            "packages/contracts/test/contract/corpus/cases.v1.json" ||
          typeof source.case_id !== "string" ||
          source.case_id.length === 0 ||
          typeof source.value_ref !== "string" ||
          source.value_ref.length === 0
        ) {
          throw new HistoricalWitnessError(
            "HISTORICAL_WITNESS_PROVENANCE_INVALID",
          );
        }
        count.corpus += 1;
      } else {
        if (
          !exactKeys(source, [
            "capture_ordinal",
            "row_arguments",
            "row_index",
            "source_kind",
            "source_path",
            "test_name",
          ]) ||
          source.source_path !==
            "packages/contracts/test/schema/w07-platform-rule-matrix.test.ts" ||
          !Number.isSafeInteger(source.capture_ordinal) ||
          (source.capture_ordinal as number) < 0 ||
          (source.row_index !== null &&
            (!Number.isSafeInteger(source.row_index) ||
              (source.row_index as number) < 0)) ||
          (source.row_arguments !== null &&
            !Array.isArray(source.row_arguments)) ||
          typeof source.test_name !== "string" ||
          source.test_name.length === 0
        ) {
          throw new HistoricalWitnessError(
            "HISTORICAL_WITNESS_PROVENANCE_INVALID",
          );
        }
        count.matrix += 1;
      }
      provenanceCounts.set(item.revision, count);
      provenanceCount += 1;
      provenanceKeys.add(key);
      previousProvenance = key;
    }
    ids.add(candidate.id);
    inputs.add(inputKey);
    schemaCounts.set(
      candidate.schema_ref,
      (schemaCounts.get(candidate.schema_ref) ?? 0) + 1,
    );
    previousId = candidate.id;
  }

  const inventory = parsed as unknown as HistoricalWitnessInventory;
  if (
    provenanceCount !== inventory.raw_reference_count ||
    EXPECTED_REVISIONS.some(([name, revision], index) => {
      const expected = EXPECTED_SOURCE_COUNTS[index];
      const observed = provenanceCounts.get(revision);
      return (
        name !== revisionNames[index] ||
        expected === undefined ||
        observed?.corpus !== expected[0] ||
        observed.matrix !== expected[1]
      );
    })
  ) {
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_PROVENANCE_INVALID");
  }
  if (
    canonicalJson(
      Object.fromEntries(
        [...schemaCounts.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    ) !== canonicalJson(Object.fromEntries(EXPECTED_SCHEMA_COUNTS.entries())) ||
    canonicalJson(
      Object.fromEntries(
        [...observedPatternCounts.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    ) !== canonicalJson(inventory.acceptance_pattern_counts)
  ) {
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_ACCEPTANCE_INVALID");
  }
  if (
    inventory.inventory_sha256 !== sha256(canonicalJson(payload(inventory)))
  ) {
    throw new HistoricalWitnessError("HISTORICAL_WITNESS_DIGEST_MISMATCH");
  }
  return inventory;
}

export function historicalAdapterBatch(
  inventory: HistoricalWitnessInventory,
  language: AdapterLanguage,
): AdapterBatchRequest {
  return {
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    requests: inventory.witnesses
      .filter((witness) => witness.languages.includes(language))
      .map((witness) => ({
        case_id: witness.id,
        schema_ref: witness.schema_ref,
        operation: witness.operation,
        input_bytes_base64: Buffer.from(
          canonicalJson(witness.input),
          "utf8",
        ).toString("base64"),
      })),
  };
}
