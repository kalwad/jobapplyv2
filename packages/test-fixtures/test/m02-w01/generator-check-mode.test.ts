import { createHash } from "node:crypto";
import {
  chmodSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { verifyGeneratedSeedAtRootForTest } from "../../scripts/generate-seed.ts";
import { makeCorpusCopy } from "./helpers/corpus-copy.ts";

const parents: string[] = [];

function copy(): string {
  const root = makeCorpusCopy("japp-m02-check-");
  parents.push(dirname(root));
  return root;
}

function digest(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "UNREADABLE";
  }
}

function snapshot(root: string): string[] {
  const rows: string[] = [];
  const walk = (path: string, relative: string): void => {
    const stats = statSync(path);
    rows.push(
      [
        relative || ".",
        stats.isDirectory() ? "directory" : "file",
        String(stats.mode),
        String(stats.size),
        String(stats.mtimeMs),
        stats.isFile() ? digest(path) : "-",
      ].join("|"),
    );
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        walk(
          join(path, entry),
          relative === "" ? entry : `${relative}/${entry}`,
        );
      }
    }
  };
  walk(root, "");
  return rows;
}

function expectObservationalFailure(root: string): Promise<void> {
  const before = snapshot(root);
  return expect(verifyGeneratedSeedAtRootForTest(root))
    .rejects.toThrow()
    .then(() => {
      expect(snapshot(root)).toEqual(before);
    });
}

afterEach(() => {
  for (const parent of parents.splice(0)) {
    const root = join(parent, "corpus");
    try {
      chmodSync(root, 0o755);
      for (const entry of readdirSync(root)) {
        try {
          chmodSync(join(root, entry), 0o644);
        } catch {
          // Missing-state cases intentionally omit members.
        }
      }
    } catch {
      // Missing-root case intentionally has no corpus directory.
    }
    rmSync(parent, { recursive: true, force: true });
  }
});

describe("M02-W01 deterministic seed check is zero-mutation", () => {
  test("leaves an intact fixture root byte- and metadata-identical", async () => {
    const root = copy();
    const before = snapshot(root);
    await expect(
      verifyGeneratedSeedAtRootForTest(root),
    ).resolves.toBeUndefined();
    expect(snapshot(root)).toEqual(before);
  });

  test("does not create a missing fixture root or alter its parent", async () => {
    const root = copy();
    const parent = dirname(root);
    rmSync(root, { recursive: true });
    const before = snapshot(parent);
    await expect(verifyGeneratedSeedAtRootForTest(root)).rejects.toThrow(
      /root is missing/u,
    );
    expect(snapshot(parent)).toEqual(before);
  });

  test("does not restore or touch a missing collection file", async () => {
    const root = copy();
    unlinkSync(join(root, "profiles.v2.json"));
    await expectObservationalFailure(root);
  });

  test("does not remove or touch an unexpected extra file", async () => {
    const root = copy();
    writeFileSync(join(root, "unexpected.json"), "{}\n");
    await expectObservationalFailure(root);
  });

  test("does not rewrite a malformed manifest", async () => {
    const root = copy();
    writeFileSync(join(root, "manifest.v2.json"), "{ malformed\n");
    await expectObservationalFailure(root);
  });

  test("does not chmod or rewrite a read-only drifted fixture tree", async () => {
    const root = copy();
    const profilePath = join(root, "profiles.v2.json");
    writeFileSync(profilePath, "{}\n");
    for (const entry of readdirSync(root)) {
      chmodSync(join(root, entry), 0o444);
    }
    chmodSync(root, 0o555);
    await expectObservationalFailure(root);
  });
});
