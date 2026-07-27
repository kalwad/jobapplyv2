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
  MAX_PROTOCOL_BYTES,
  type AdapterBatchResponse,
  type AdapterLanguage,
} from "../adapters/protocol.ts";
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
}

function expectedIds(
  corpus: LoadedCorpus,
  language: AdapterLanguage,
): readonly string[] {
  return corpus.cases
    .filter((corpusCase) => corpusCase.languages.includes(language))
    .map((corpusCase) => corpusCase.id);
}

function buildRustHarness(): void {
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
  });
}

function runAdapter(
  language: AdapterLanguage,
  corpus: LoadedCorpus,
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
  return validateAdapterResponse(
    output,
    language,
    expectedIds(corpus, language),
  );
}

export function runRealAdapters(): RealAdapterRun {
  const corpus = loadCorpus();
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
      writeFileSync(
        requestPath,
        `${canonicalJson(adapterBatchFor(corpus, language))}\n`,
        "utf8",
      );
      responses[language] = runAdapter(language, corpus, requestPath);
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
      )} rust-build=locked-offline\n`,
    );
    return { corpus, responses };
  } finally {
    // The target is a path returned by mkdtempSync and is never derived from
    // input or an environment variable.
    if (basename(temporaryRoot).startsWith("japp-contract-v1-")) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}
