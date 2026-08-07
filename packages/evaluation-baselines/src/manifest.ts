// Committed manifest computation and read-only checking (M02-W04).
//
// baseline.manifest.json commits canonical digests over the baseline
// catalog, the frozen prompts, the development case matrix, the committed
// legacy-observation records, and every source file in src/. Check mode
// recomputes everything without writing a byte and fails on any drift, so
// no unversioned default can silently change behavior.
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJsonFileBytes,
  sha256Bytes,
  sha256Canonical,
} from "./canonical-json.ts";
import {
  catalogDigest,
  ANSWER_PROMPT_DIGEST,
  RESUME_PROMPT_DIGEST,
} from "./catalog.ts";
import { caseMatrixDigest, DEV_CASE_MATRIX } from "./dev-cases.ts";
import { validateLegacyObservationFile } from "./legacy-observation.ts";
import {
  BASELINE_CATALOG_SCHEMA_VERSION,
  BASELINE_CATALOG_VERSION,
  type BaselineManifest,
  type LegacyObservationFile,
  type ManifestSourceFile,
} from "./model.ts";

export const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const MANIFEST_FILE = "baseline.manifest.json";
export const LEGACY_OBSERVATION_FILE = "data/legacy-observations.v1.json";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function readBoundedRegularFile(absolutePath: string): Buffer {
  const metadata = lstatSync(absolutePath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`not a regular file: ${absolutePath}`);
  }
  if (metadata.size > MAX_FILE_BYTES) {
    throw new Error(`file exceeds the bounded read limit: ${absolutePath}`);
  }
  return readFileSync(absolutePath);
}

/**
 * Committed baseline JSON must be exactly the canonical pretty serialization
 * of its parsed value: this one byte-identity rule rejects duplicate keys,
 * noncanonical ordering, and any hand-edited formatting drift.
 */
export function readCanonicalJsonFile(absolutePath: string): unknown {
  const bytes = readBoundedRegularFile(absolutePath);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(text);
  if (text !== canonicalJsonFileBytes(parsed)) {
    throw new Error(
      `noncanonical committed JSON (ordering, duplicate keys, or formatting): ${absolutePath}`,
    );
  }
  return parsed;
}

export function loadCommittedLegacyObservations(
  root = PACKAGE_ROOT,
): LegacyObservationFile {
  const value = readCanonicalJsonFile(join(root, LEGACY_OBSERVATION_FILE));
  return validateLegacyObservationFile(value);
}

function sourceFiles(root: string): ManifestSourceFile[] {
  const sourceDirectory = join(root, "src");
  const names = readdirSync(sourceDirectory).sort();
  return names.map((name) => {
    if (!name.endsWith(".ts")) {
      throw new Error(`unexpected non-TypeScript source entry: src/${name}`);
    }
    const bytes = readBoundedRegularFile(join(sourceDirectory, name));
    return { path: `src/${name}`, sha256: sha256Bytes(bytes) };
  });
}

export function computeBaselineManifest(root = PACKAGE_ROOT): BaselineManifest {
  const observations = loadCommittedLegacyObservations(root);
  const observationBytes = readBoundedRegularFile(
    join(root, LEGACY_OBSERVATION_FILE),
  );
  const withoutCombined = {
    manifest_version: 1 as const,
    catalog_version: BASELINE_CATALOG_VERSION,
    catalog_schema_version: BASELINE_CATALOG_SCHEMA_VERSION,
    catalog_digest: catalogDigest(),
    case_matrix_version: DEV_CASE_MATRIX.matrix_version,
    case_count: DEV_CASE_MATRIX.cases.length,
    case_matrix_digest: caseMatrixDigest(),
    prompt_digests: {
      one_shot_resume: RESUME_PROMPT_DIGEST,
      one_shot_answer: ANSWER_PROMPT_DIGEST,
    },
    legacy_observation_file: {
      path: LEGACY_OBSERVATION_FILE,
      record_count: observations.records.length,
      sha256: sha256Bytes(observationBytes),
    },
    source_files: sourceFiles(root),
  };
  return {
    ...withoutCombined,
    combined_digest: sha256Canonical(withoutCombined),
  };
}

export function manifestFileBytes(manifest: BaselineManifest): string {
  return canonicalJsonFileBytes(manifest);
}

/**
 * Read-only drift check: recompute the manifest and compare it with the
 * committed file. Returns bounded human-readable failures (empty on
 * success) and never writes.
 */
export function checkBaselineManifest(root = PACKAGE_ROOT): string[] {
  const failures: string[] = [];
  let committed: BaselineManifest | undefined;
  try {
    committed = readCanonicalJsonFile(
      join(root, MANIFEST_FILE),
    ) as BaselineManifest;
  } catch (error: unknown) {
    failures.push(
      `committed manifest unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let computed: BaselineManifest | undefined;
  try {
    computed = computeBaselineManifest(root);
  } catch (error: unknown) {
    failures.push(
      `manifest recomputation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (committed !== undefined && computed !== undefined) {
    const committedCanonical = canonicalJsonFileBytes(committed);
    const computedCanonical = canonicalJsonFileBytes(computed);
    if (committedCanonical !== computedCanonical) {
      const fields: (keyof BaselineManifest)[] = [
        "manifest_version",
        "catalog_version",
        "catalog_schema_version",
        "catalog_digest",
        "case_matrix_version",
        "case_count",
        "case_matrix_digest",
        "prompt_digests",
        "legacy_observation_file",
        "source_files",
        "combined_digest",
      ];
      for (const field of fields) {
        const left = JSON.stringify(committed[field]);
        const right = JSON.stringify(computed[field]);
        if (left !== right) {
          failures.push(`manifest field drift: ${field}`);
        }
      }
      if (failures.length === 0) {
        failures.push("manifest drift: canonical serialization differs");
      }
    }
  }
  return failures;
}
