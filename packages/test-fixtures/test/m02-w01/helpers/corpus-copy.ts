import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fixtureEntityHash,
  fixtureManifestHash,
  sha256Bytes,
  sha256Canonical,
} from "../../../src/canonical-json.ts";
import {
  COLLECTION_SPECS,
  COMMITTED_FIXTURE_ROOT,
} from "../../../src/loader.ts";
import type { FixtureCollection, FixtureManifest } from "../../../src/model.ts";

export function makeCorpusCopy(prefix = "japp-m02-corpus-"): string {
  const parent = mkdtempSync(join(tmpdir(), prefix));
  const root = join(parent, "corpus");
  cpSync(COMMITTED_FIXTURE_ROOT, root, { recursive: true });
  return root;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function fullyResignCorpus(root: string): void {
  const manifestPath = join(root, "manifest.v2.json");
  const manifest = readJson(manifestPath) as FixtureManifest;
  for (const spec of COLLECTION_SPECS) {
    const path = join(root, spec.file);
    const collection = readJson(path) as FixtureCollection;
    for (const entity of collection.items) {
      entity.metadata.historical_content_hash = fixtureEntityHash(entity);
    }
    const bytes = jsonBytes(collection);
    writeFileSync(path, bytes);
    const entry = manifest.files.find(
      (candidate) => candidate.path === spec.file,
    );
    if (entry === undefined) {
      throw new Error("test re-sign manifest entry is missing");
    }
    entry.byte_count = bytes.length;
    entry.record_count = collection.items.length;
    entry.sha256 = sha256Bytes(bytes);
  }
  manifest.corpus_digest = sha256Canonical(manifest.files);
  manifest.metadata.historical_content_hash = fixtureManifestHash(manifest);
  writeFileSync(manifestPath, jsonBytes(manifest));
}
