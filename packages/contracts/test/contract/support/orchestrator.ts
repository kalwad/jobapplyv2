import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  adapterBatchFor,
  loadCorpus,
  type LoadedCorpus,
} from "../adapters/corpus-loader.ts";
import { canonicalJson } from "../adapters/normalization.ts";
import {
  ADAPTER_PROTOCOL_VERSION,
  MAX_ADAPTER_CASES,
  MAX_PROTOCOL_BYTES,
  type AdapterBatchRequest,
  type AdapterBatchResponse,
  type AdapterLanguage,
  type AdapterResult,
} from "../adapters/protocol.ts";
import {
  historicalAdapterBatch,
  loadHistoricalWitnessInventory,
  type HistoricalWitnessInventory,
} from "../semantic-witnesses/historical-witness-loader.ts";
import { runChild } from "./process.ts";
import { validateAdapterResponse } from "./response.ts";

export const REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../../", import.meta.url),
);
const CONTRACT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const RUST_ROOT = join(CONTRACT_ROOT, "rust-harness");
const RUST_MANIFEST = join(RUST_ROOT, "Cargo.toml");
const TS_ADAPTER = join(CONTRACT_ROOT, "adapters", "typescript-adapter.ts");
const PYTHON_ADAPTER = join(CONTRACT_ROOT, "adapters", "python_adapter.py");
const RUST_BINARY_NAME = `japp-contract-compat-harness${
  process.platform === "win32" ? ".exe" : ""
}`;
const RUST_BINARY = join(RUST_ROOT, "target", "debug", RUST_BINARY_NAME);
const PYTHON = join(
  REPOSITORY_ROOT,
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

export interface RealAdapterRun {
  readonly corpus: LoadedCorpus;
  readonly responses: Readonly<Record<AdapterLanguage, AdapterBatchResponse>>;
  readonly historicalInventory: HistoricalWitnessInventory;
  readonly historicalResponses: Readonly<
    Record<AdapterLanguage, AdapterBatchResponse>
  >;
}

export interface SemanticMatrixCase {
  readonly caseId: string;
  readonly schemaRef: string;
  readonly value: unknown;
}

export interface SemanticMatrixAdapterRun {
  readonly responses: Readonly<
    Record<AdapterLanguage, readonly AdapterResult[]>
  >;
}

let rustHarnessBuilt = false;

function expectedIds(
  corpus: LoadedCorpus,
  language: AdapterLanguage,
): readonly string[] {
  return corpus.cases
    .filter((corpusCase) => corpusCase.languages.includes(language))
    .map((corpusCase) => corpusCase.id);
}

function buildRustHarness(): void {
  if (rustHarnessBuilt) {
    return;
  }
  runChild({
    executable: "cargo",
    args: [
      "build",
      "--quiet",
      "--locked",
      "--offline",
      "--manifest-path",
      RUST_MANIFEST,
    ],
    cwd: REPOSITORY_ROOT,
    timeoutMs: 300_000,
    maxOutputBytes: MAX_PROTOCOL_BYTES,
    allowStderr: true,
  });
  rustHarnessBuilt = true;
}

function writeAdapterRequest(path: string, batch: AdapterBatchRequest): void {
  const serialized = `${canonicalJson(batch)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_PROTOCOL_BYTES) {
    throw new Error("adapter request exceeds MAX_PROTOCOL_BYTES");
  }
  writeFileSync(path, serialized, "utf8");
}

function runAdapter(
  language: AdapterLanguage,
  expectedCaseIds: readonly string[],
  requestPath: string,
): AdapterBatchResponse {
  let executable: string;
  let args: readonly string[];
  if (language === "typescript") {
    executable = process.execPath;
    args = [TS_ADAPTER, "--request", requestPath];
  } else if (language === "python") {
    executable = PYTHON;
    args = [PYTHON_ADAPTER, "--request", requestPath];
  } else {
    executable = RUST_BINARY;
    args = ["--request", requestPath, "--repo-root", REPOSITORY_ROOT];
  }
  const output = runChild({
    executable,
    args,
    cwd: REPOSITORY_ROOT,
    timeoutMs: 120_000,
    maxOutputBytes: MAX_PROTOCOL_BYTES,
  });
  return validateAdapterResponse(output, language, expectedCaseIds);
}

/**
 * Execute independently declared semantic-matrix values through every real
 * language adapter. Chunks stay well below both protocol bounds, while case
 * identifiers and input bytes use the same fail-closed wire path as the
 * compatibility corpus.
 */
export function runSemanticMatrixAdapters(
  matrixCases: readonly SemanticMatrixCase[],
): SemanticMatrixAdapterRun {
  if (matrixCases.length === 0) {
    throw new Error("semantic matrix must contain at least one case");
  }
  const orderedCases = [...matrixCases].sort((left, right) =>
    left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0,
  );
  if (
    new Set(orderedCases.map((matrixCase) => matrixCase.caseId)).size !==
      orderedCases.length ||
    orderedCases.some(
      (matrixCase) =>
        matrixCase.caseId.length === 0 || matrixCase.schemaRef.length === 0,
    )
  ) {
    throw new Error("semantic matrix case identifiers must be unique");
  }
  const batchFor = (
    cases: readonly SemanticMatrixCase[],
  ): AdapterBatchRequest => ({
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    requests: cases.map((matrixCase) => ({
      case_id: matrixCase.caseId,
      schema_ref: matrixCase.schemaRef,
      operation: "VALIDATE",
      input_bytes_base64: Buffer.from(
        canonicalJson(matrixCase.value),
        "utf8",
      ).toString("base64"),
    })),
  });
  const serializedBytes = (cases: readonly SemanticMatrixCase[]): number =>
    Buffer.byteLength(`${canonicalJson(batchFor(cases))}\n`, "utf8");
  const chunks: SemanticMatrixCase[][] = [];
  let pending: SemanticMatrixCase[] = [];
  for (const matrixCase of orderedCases) {
    const candidate = [...pending, matrixCase];
    if (
      candidate.length > MAX_ADAPTER_CASES ||
      serializedBytes(candidate) > MAX_PROTOCOL_BYTES
    ) {
      if (pending.length === 0) {
        throw new Error(
          `semantic matrix case exceeds protocol bounds: ${matrixCase.caseId}`,
        );
      }
      chunks.push(pending);
      pending = [matrixCase];
      if (serializedBytes(pending) > MAX_PROTOCOL_BYTES) {
        throw new Error(
          `semantic matrix case exceeds protocol bounds: ${matrixCase.caseId}`,
        );
      }
    } else {
      pending = candidate;
    }
  }
  if (pending.length > 0) {
    chunks.push(pending);
  }

  buildRustHarness();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "japp-semantic-matrix-"));
  try {
    const responses = {
      python: [],
      rust: [],
      typescript: [],
    } as Record<AdapterLanguage, AdapterResult[]>;
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const batch = batchFor(chunk);
      for (const language of [
        "typescript",
        "python",
        "rust",
      ] as const satisfies readonly AdapterLanguage[]) {
        const requestPath = join(
          temporaryRoot,
          `${language}.${String(chunkIndex)}.request.json`,
        );
        writeAdapterRequest(requestPath, batch);
        const response = runAdapter(
          language,
          chunk.map((matrixCase) => matrixCase.caseId),
          requestPath,
        );
        responses[language].push(...response.results);
      }
    }
    process.stdout.write(
      `semantic-matrix-adapters cases=${String(
        orderedCases.length,
      )} chunks=${String(
        chunks.length,
      )} languages=typescript,python,rust rust-build=locked-offline\n`,
    );
    return { responses };
  } finally {
    // The target is a path returned by mkdtempSync and is never derived from
    // input or an environment variable.
    if (basename(temporaryRoot).startsWith("japp-semantic-matrix-")) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

export function runRealAdapters(): RealAdapterRun {
  const corpus = loadCorpus();
  const historicalInventory = loadHistoricalWitnessInventory();
  buildRustHarness();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "japp-contract-v1-"));
  try {
    const responses = {} as Record<AdapterLanguage, AdapterBatchResponse>;
    for (const language of [
      "typescript",
      "python",
      "rust",
    ] as const satisfies readonly AdapterLanguage[]) {
      const requestPath = join(temporaryRoot, `${language}.request.json`);
      writeAdapterRequest(requestPath, adapterBatchFor(corpus, language));
      responses[language] = runAdapter(
        language,
        expectedIds(corpus, language),
        requestPath,
      );
    }
    const historicalResponses = {} as Record<
      AdapterLanguage,
      AdapterBatchResponse
    >;
    for (const language of [
      "typescript",
      "python",
      "rust",
    ] as const satisfies readonly AdapterLanguage[]) {
      const requestPath = join(
        temporaryRoot,
        `${language}.historical.request.json`,
      );
      writeAdapterRequest(
        requestPath,
        historicalAdapterBatch(historicalInventory, language),
      );
      historicalResponses[language] = runAdapter(
        language,
        historicalInventory.witnesses
          .filter((witness) => witness.languages.includes(language))
          .map((witness) => witness.id),
        requestPath,
      );
    }
    const counts = Object.fromEntries(
      Object.entries(responses).map(([language, response]) => [
        language,
        response.results.length,
      ]),
    );
    process.stdout.write(
      `contract-adapters protocol=1 typescript=${String(
        counts.typescript,
      )} python=${String(counts.python)} rust=${String(
        counts.rust,
      )} historical-typescript=${String(
        historicalResponses.typescript.results.length,
      )} historical-python=${String(
        historicalResponses.python.results.length,
      )} historical-rust=${String(
        historicalResponses.rust.results.length,
      )} rust-build=locked-offline\n`,
    );
    return {
      corpus,
      responses,
      historicalInventory,
      historicalResponses,
    };
  } finally {
    // The target is a path returned by mkdtempSync and is never derived from
    // input or an environment variable.
    if (basename(temporaryRoot).startsWith("japp-contract-v1-")) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}
