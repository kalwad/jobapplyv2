import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";

import {
  fixtureManifestHash,
  sha256Bytes,
  sha256Canonical,
} from "../../src/canonical-json.ts";
import { COMMITTED_FIXTURE_ROOT, loadFixtureCorpus } from "../../src/loader.ts";
import type { FixtureCollection, FixtureManifest } from "../../src/model.ts";

const temporaryRoots: string[] = [];

function corpusCopy(): string {
  const base = mkdtempSync(join(tmpdir(), "japp-m02-loader-"));
  temporaryRoots.push(base);
  const root = join(base, "corpus");
  cpSync(COMMITTED_FIXTURE_ROOT, root, { recursive: true });
  return root;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test mutation input is missing");
  }
  return value;
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeManifest(root: string, manifest: FixtureManifest): void {
  manifest.metadata.historical_content_hash = fixtureManifestHash(manifest);
  writeFileSync(join(root, "manifest.v1.json"), jsonBytes(manifest));
}

function resignCollection(
  root: string,
  file: string,
  collection: FixtureCollection,
): void {
  const bytes = jsonBytes(collection);
  writeFileSync(join(root, file), bytes);
  const manifest = readJson(join(root, "manifest.v1.json")) as FixtureManifest;
  const entry = manifest.files.find((candidate) => candidate.path === file);
  if (entry === undefined) {
    throw new Error("test mutation manifest entry missing");
  }
  entry.byte_count = bytes.length;
  entry.record_count = collection.items.length;
  entry.sha256 = sha256Bytes(bytes);
  manifest.corpus_digest = sha256Canonical(manifest.files);
  writeManifest(root, manifest);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("M02-W01 fail-closed loader mutations", () => {
  test("accepts an exact committed corpus copy", () => {
    expect(loadFixtureCorpus(corpusCopy()).profiles).toHaveLength(12);
  });

  test("rejects duplicate stable IDs after byte manifests are valid", () => {
    const root = corpusCopy();
    const path = join(root, "profiles.v1.json");
    const collection = readJson(path) as FixtureCollection;
    collection.items.splice(
      1,
      0,
      structuredClone(required(collection.items[0])),
    );
    resignCollection(root, "profiles.v1.json", collection);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_DUPLICATE_ID/u);
  });

  test("rejects a stale entity schema version", () => {
    const root = corpusCopy();
    const path = join(root, "profiles.v1.json");
    const collection = readJson(path) as FixtureCollection;
    const first = collection.items[0] as unknown as {
      schema_version: string;
    };
    first.schema_version = "0.9.0";
    resignCollection(root, "profiles.v1.json", collection);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_ENTITY_SCHEMA/u);
  });

  test("rejects a manifest aggregate count mismatch", () => {
    const root = corpusCopy();
    const manifest = readJson(
      join(root, "manifest.v1.json"),
    ) as FixtureManifest;
    manifest.counts.profiles = 13;
    writeManifest(root, manifest);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_MANIFEST_COUNT/u);
  });

  test("rejects a file digest mismatch before parsing changed content", () => {
    const root = corpusCopy();
    const path = join(root, "profiles.v1.json");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        '"target_role": "Software Engineer"',
        '"target_role": "Changed Engineer"',
      ),
    );
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_FILE_DIGEST/u);
  });

  test("rejects a validly signed manifest with the wrong corpus digest", () => {
    const root = corpusCopy();
    const manifest = readJson(
      join(root, "manifest.v1.json"),
    ) as FixtureManifest;
    manifest.corpus_digest = `sha256:${"0".repeat(64)}`;
    writeManifest(root, manifest);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_CORPUS_DIGEST/u);
  });

  test("rejects nondeterministic entity ordering", () => {
    const root = corpusCopy();
    const path = join(root, "profiles.v1.json");
    const collection = readJson(path) as FixtureCollection;
    const first = collection.items[0];
    const second = collection.items[1];
    if (first === undefined || second === undefined) {
      throw new Error("test corpus unexpectedly empty");
    }
    collection.items[0] = second;
    collection.items[1] = first;
    resignCollection(root, "profiles.v1.json", collection);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_ORDER/u);
  });

  test("rejects traversal syntax in a manifest path", () => {
    const root = corpusCopy();
    const manifest = readJson(
      join(root, "manifest.v1.json"),
    ) as FixtureManifest;
    const first = manifest.files[0];
    if (first === undefined) {
      throw new Error("test manifest unexpectedly empty");
    }
    first.path = "../evidence-artifacts.v1.json";
    writeManifest(root, manifest);
    expect(() => loadFixtureCorpus(root)).toThrow(
      /FIXTURE_MANIFEST_SCHEMA|FIXTURE_MANIFEST_PATH/u,
    );
  });

  test("rejects a symlink escape without exposing its target", () => {
    const root = corpusCopy();
    const outside = join(root, "..", "outside.json");
    const target = join(root, "profiles.v1.json");
    writeFileSync(outside, "{}\n");
    rmSync(target);
    symlinkSync(outside, target, "file");
    let message = "";
    try {
      loadFixtureCorpus(root);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("FIXTURE_SYMLINK_REJECTED");
    expect(message).not.toContain(outside);
  });

  test("rejects duplicate JSON object keys before JSON.parse can collapse them", () => {
    const root = corpusCopy();
    const path = join(root, "manifest.v1.json");
    const text = readFileSync(path, "utf8").replace(
      '  "schema_ref":',
      '  "schema_ref": "urn:japp:schema:test-fixture:manifest:v1",\n  "schema_ref":',
    );
    writeFileSync(path, text);
    expect(() => loadFixtureCorpus(root)).toThrow(
      /FIXTURE_JSON_DUPLICATE_KEY/u,
    );
  });
});
