/**
 * M01-W02 corrective closeout (KI-0018): deterministic failure-injection
 * tests for the transactional, rollback-safe generated-tree replacement.
 *
 * Every failure is injected through the InstallFsOps seam at an exact
 * protocol step, so recovery behavior is proven deterministically on all
 * certified platforms without relying on real filesystem faults and
 * without ever touching the repository's own generated tree.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import type { GeneratedTree } from "../../generator/generate.ts";
import {
  compareGeneratedTree,
  installGeneratedTree,
  InstallRecoveryError,
  InstallRolledBackError,
  listTreeFiles,
  REAL_INSTALL_FS_OPS,
  verifyMaterializedTree,
  type InstallFsOps,
} from "../../generator/fsops.ts";

const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-fsops-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function tree(entries: Record<string, string>): GeneratedTree {
  return { files: new Map(Object.entries(entries)) };
}

const OLD_TREE = tree({
  "README.md": "old tree\n",
  "typescript/index.ts": "export const generation = 1;\n",
  "stale/only-in-old.txt": "stale output of a deleted schema\n",
});

const NEW_TREE = tree({
  "README.md": "new tree\n",
  "typescript/index.ts": "export const generation = 2;\n",
  "python/module.py": "GENERATION = 2\n",
});

/** Install a tree for real and assert it landed byte-exactly. */
function installFixtureTree(target: string, fixture: GeneratedTree): void {
  installGeneratedTree(fixture, target);
  expect(compareGeneratedTree(fixture, target)).toEqual([]);
}

/** Sibling staging/backup leftovers next to the generated root. */
function siblingLeftovers(generatedRoot: string): string[] {
  const parent = dirname(generatedRoot);
  const base = basename(generatedRoot);
  return listSiblings(parent).filter(
    (name) =>
      name.startsWith(`${base}.staging-`) || name.startsWith(`${base}.backup-`),
  );
}

function listSiblings(parent: string): string[] {
  try {
    // listTreeFiles lists files; sibling directories need a plain readdir.
    return readdirSync(parent);
  } catch {
    return [];
  }
}

function opsWith(overrides: Partial<InstallFsOps>): InstallFsOps {
  return { ...REAL_INSTALL_FS_OPS, ...overrides };
}

describe("transactional install protocol", () => {
  test("successful replacement removes stale output and leaves no staging or backup", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    installGeneratedTree(NEW_TREE, generatedRoot);
    expect(compareGeneratedTree(NEW_TREE, generatedRoot)).toEqual([]);
    expect(listTreeFiles(generatedRoot)).not.toContain("stale/only-in-old.txt");
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("first-time install (no existing tree) succeeds and leaves no siblings", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installGeneratedTree(NEW_TREE, generatedRoot);
    expect(compareGeneratedTree(NEW_TREE, generatedRoot)).toEqual([]);
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("a materialization failure leaves the old tree unchanged and cleans staging", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const ops = opsWith({
      materializeTree: () => {
        throw new Error("injected: disk full while staging");
      },
    });
    expect(() => {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    }).toThrow(InstallRolledBackError);
    expect(compareGeneratedTree(OLD_TREE, generatedRoot)).toEqual([]);
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("a staging verification failure leaves the old tree unchanged", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const ops = opsWith({
      materializeTree: (installTree, root) => {
        REAL_INSTALL_FS_OPS.materializeTree(installTree, root);
        // Corrupt one staged byte so verification must reject the staging
        // tree before the existing tree is touched.
        writeFileSync(join(root, "README.md"), "corrupted during staging\n");
      },
    });
    expect(() => {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    }).toThrow(/write-path defect/);
    expect(compareGeneratedTree(OLD_TREE, generatedRoot)).toEqual([]);
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("a failure moving the old tree aside leaves it installed and unchanged", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const ops = opsWith({
      rename: (from: string, to: string) => {
        if (from === generatedRoot) {
          throw new Error("injected: old tree is locked");
        }
        REAL_INSTALL_FS_OPS.rename(from, to);
      },
    });
    expect(() => {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    }).toThrow(/remains installed and unchanged/);
    expect(compareGeneratedTree(OLD_TREE, generatedRoot)).toEqual([]);
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("a failure installing staging restores the old tree exactly", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const ops = opsWith({
      rename: (from: string, to: string) => {
        if (to === generatedRoot && basename(from).includes(".staging-")) {
          throw new Error("injected: Windows file lock on install");
        }
        REAL_INSTALL_FS_OPS.rename(from, to);
      },
    });
    expect(() => {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    }).toThrow(/restored unchanged/);
    expect(compareGeneratedTree(OLD_TREE, generatedRoot)).toEqual([]);
    expect(listTreeFiles(generatedRoot)).toContain("stale/only-in-old.txt");
    expect(siblingLeftovers(generatedRoot)).toEqual([]);
  });

  test("a rollback failure preserves every recoverable path and reports them", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const removed: string[] = [];
    const ops = opsWith({
      rename: (from: string, to: string) => {
        if (to === generatedRoot) {
          // Both the staging install AND the backup rollback fail.
          throw new Error("injected: target path is locked");
        }
        REAL_INSTALL_FS_OPS.rename(from, to);
      },
      removeTree: (path: string) => {
        removed.push(path);
        REAL_INSTALL_FS_OPS.removeTree(path);
      },
    });
    let caught: unknown = null;
    try {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InstallRecoveryError);
    const recovery = caught as InstallRecoveryError;
    // Nothing recoverable was deleted.
    expect(removed).toEqual([]);
    expect(recovery.survivingPaths).toHaveLength(2);
    const [backupPath, stagingPath] = recovery.survivingPaths;
    expect(backupPath).toBeDefined();
    expect(stagingPath).toBeDefined();
    if (backupPath === undefined || stagingPath === undefined) {
      return;
    }
    // The complete old tree survives at the backup path and the complete
    // verified new tree survives at the staging path.
    expect(compareGeneratedTree(OLD_TREE, backupPath)).toEqual([]);
    expect(compareGeneratedTree(NEW_TREE, stagingPath)).toEqual([]);
    expect(existsSync(generatedRoot)).toBe(false);
    // The error message names the exact paths and the manual recovery.
    expect(recovery.message).toContain(backupPath);
    expect(recovery.message).toContain(stagingPath);
    expect(recovery.message).toContain("Manual recovery");
    expect(recovery.message).toContain("Nothing was deleted");
  });

  test("a backup-cleanup failure reports the surviving backup after a successful install", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const ops = opsWith({
      removeTree: (path: string) => {
        if (basename(path).includes(".backup-")) {
          throw new Error("injected: backup directory is locked");
        }
        REAL_INSTALL_FS_OPS.removeTree(path);
      },
    });
    expect(() => {
      installGeneratedTree(NEW_TREE, generatedRoot, ops);
    }).toThrow(
      /installed successfully .* removing the obsolete backup failed/s,
    );
    // The new tree is fully installed despite the cleanup failure.
    expect(compareGeneratedTree(NEW_TREE, generatedRoot)).toEqual([]);
    const leftovers = siblingLeftovers(generatedRoot);
    expect(leftovers).toHaveLength(1);
    expect(leftovers[0]).toContain(".backup-");
  });

  test("unique sibling paths never reuse a leftover directory from an earlier run", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    // Simulate leftovers from a previously failed run.
    const leftoverStaging = `${generatedRoot}.staging-1`;
    const leftoverBackup = `${generatedRoot}.backup-1`;
    mkdirSync(leftoverStaging, { recursive: true });
    writeFileSync(join(leftoverStaging, "keep.txt"), "recoverable\n");
    mkdirSync(leftoverBackup, { recursive: true });
    writeFileSync(join(leftoverBackup, "keep.txt"), "recoverable\n");
    installGeneratedTree(NEW_TREE, generatedRoot);
    expect(compareGeneratedTree(NEW_TREE, generatedRoot)).toEqual([]);
    // The earlier run's directories are untouched (never reused/removed).
    expect(listTreeFiles(leftoverStaging)).toEqual(["keep.txt"]);
    expect(listTreeFiles(leftoverBackup)).toEqual(["keep.txt"]);
  });

  test("the installed path never holds a partial tree at any protocol step", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    installFixtureTree(generatedRoot, OLD_TREE);
    const observed: string[] = [];
    const observe = (): void => {
      if (!existsSync(generatedRoot)) {
        observed.push("ABSENT");
        return;
      }
      const asOld = compareGeneratedTree(OLD_TREE, generatedRoot).length === 0;
      const asNew = compareGeneratedTree(NEW_TREE, generatedRoot).length === 0;
      observed.push(asOld ? "OLD" : asNew ? "NEW" : "PARTIAL");
    };
    const ops = opsWith({
      materializeTree: (installTree, root) => {
        observe();
        REAL_INSTALL_FS_OPS.materializeTree(installTree, root);
        observe();
      },
      rename: (from: string, to: string) => {
        observe();
        REAL_INSTALL_FS_OPS.rename(from, to);
        observe();
      },
      removeTree: (path: string) => {
        observe();
        REAL_INSTALL_FS_OPS.removeTree(path);
        observe();
      },
    });
    installGeneratedTree(NEW_TREE, generatedRoot, ops);
    observe();
    expect(observed).not.toContain("PARTIAL");
    expect(observed.at(-1)).toBe("NEW");
  });

  test("verifyMaterializedTree rejects inventory and content divergence", () => {
    const root = join(makeTemporaryRoot(), "tree");
    REAL_INSTALL_FS_OPS.materializeTree(NEW_TREE, root);
    expect(() => {
      verifyMaterializedTree(NEW_TREE, root);
    }).not.toThrow();
    writeFileSync(join(root, "extra.txt"), "unexpected\n");
    expect(() => {
      verifyMaterializedTree(NEW_TREE, root);
    }).toThrow(/different file inventory/);
    rmSync(join(root, "extra.txt"));
    writeFileSync(join(root, "README.md"), "tampered\n");
    expect(() => {
      verifyMaterializedTree(NEW_TREE, root);
    }).toThrow(/altered README\.md/);
  });
});
