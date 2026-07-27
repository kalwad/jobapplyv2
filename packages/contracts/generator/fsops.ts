/**
 * Filesystem operations for the contract generator (M01-W02).
 *
 * Write mode performs a TRANSACTIONAL, ROLLBACK-SAFE whole-tree
 * replacement — deliberately not described as "atomic", because no single
 * indivisible multi-directory filesystem operation exists portably across
 * macOS, Windows, and Ubuntu. The guarantee is:
 *
 *   1. the new tree is fully materialized AND byte-verified in a unique
 *      sibling staging directory before the existing tree is touched;
 *   2. the existing tree is renamed aside to a unique sibling backup —
 *      never deleted — before the staging tree is renamed into place;
 *   3. if installing the staging tree fails, the backup is automatically
 *      restored, so a complete previously-valid tree survives every
 *      single-step failure;
 *   4. if even the rollback rename fails, nothing recoverable is deleted:
 *      the error names the exact surviving directories and the manual
 *      recovery action;
 *   5. the installed path only ever transitions between complete trees
 *      (each transition is one directory rename), so a partially written
 *      generated tree can never appear at the installed path;
 *   6. on success no staging or backup directory from this run remains.
 *
 * Check mode is read-only over the committed tree: it byte-compares the
 * COMPLETE expected inventory against the COMPLETE on-disk tree, so
 * missing, stale, modified, and unexpected extra files are all detected
 * and reported with actionable paths.
 *
 * The primitive filesystem steps (materialize, rename, remove) sit behind
 * the small InstallFsOps seam so failure-injection tests can prove every
 * recovery path deterministically without relying on real filesystem
 * faults.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, sep } from "node:path";

import type { GeneratedTree } from "./generate.ts";

/** One check-mode finding, sorted and printable. */
export interface DriftFinding {
  readonly kind: "MISSING" | "MODIFIED" | "EXTRA";
  /** POSIX path relative to the generated root. */
  readonly path: string;
  readonly detail: string;
}

/**
 * List every file below `root` as sorted POSIX-relative paths.
 *
 * CPython bytecode caches (`__pycache__/`) are excluded: importing the
 * generated `japp_contracts` package inevitably materializes them inside
 * the generated tree, they are interpreter-managed caches rather than
 * generator outputs, and they are git-ignored repository-wide. Everything
 * else below the root is part of the compared inventory.
 */
export function listTreeFiles(root: string): string[] {
  let entries;
  try {
    entries = readdirSync(root, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const absolute = join(entry.parentPath, entry.name);
    const parts = absolute
      .slice(root.length)
      .split(sep)
      .filter((part) => part !== "");
    if (parts.includes("__pycache__")) {
      continue;
    }
    files.push(parts.join("/"));
  }
  files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return files;
}

function writeTreeInto(tree: GeneratedTree, root: string): void {
  for (const [relative, content] of tree.files) {
    const absolute = join(root, ...relative.split("/"));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, { encoding: "utf8" });
  }
}

/**
 * Prove the tree materialized at `root` is byte-identical to the
 * in-memory tree (same complete inventory, same bytes). Throws on any
 * divergence — a write-path defect must never be installed.
 */
export function verifyMaterializedTree(
  tree: GeneratedTree,
  root: string,
): void {
  const materialized = listTreeFiles(root);
  const expected = [...tree.files.keys()].sort();
  if (
    materialized.length !== expected.length ||
    materialized.some((path, index) => path !== expected[index])
  ) {
    throw new Error(
      "staged materialization produced a different file inventory than " +
        "the in-memory generation (write-path defect)",
    );
  }
  for (const relative of expected) {
    const content = readFileSync(join(root, ...relative.split("/")), "utf8");
    if (content !== tree.files.get(relative)) {
      throw new Error(
        `staged materialization altered ${relative} (write-path defect)`,
      );
    }
  }
}

/**
 * Injectable primitive operations used by the install transaction.
 * Defaults perform the real filesystem work; tests inject failures at
 * exact protocol steps to prove every recovery path.
 */
export interface InstallFsOps {
  /** Materialize the complete tree below `root` (creating directories). */
  readonly materializeTree: (tree: GeneratedTree, root: string) => void;
  /** Rename a directory (same volume; either completes or leaves `from`). */
  readonly rename: (from: string, to: string) => void;
  /** Recursively remove a path; must succeed silently when absent. */
  readonly removeTree: (path: string) => void;
}

export const REAL_INSTALL_FS_OPS: InstallFsOps = {
  materializeTree: writeTreeInto,
  rename: (from: string, to: string) => {
    renameSync(from, to);
  },
  removeTree: (path: string) => {
    rmSync(path, { recursive: true, force: true });
  },
};

/**
 * Raised when installation fails but the previously valid tree was
 * preserved (either never touched, or automatically restored).
 */
export class InstallRolledBackError extends Error {}

/**
 * Raised when installation failed AND automatic rollback failed. Nothing
 * recoverable was deleted; the message names every surviving directory
 * and the manual recovery action.
 */
export class InstallRecoveryError extends Error {
  readonly survivingPaths: readonly string[];

  constructor(message: string, survivingPaths: readonly string[]) {
    super(message);
    this.name = "InstallRecoveryError";
    this.survivingPaths = survivingPaths;
  }
}

/**
 * Choose a sibling path `<root>.<role>-<n>` that does not currently
 * exist. Unique per run so a leftover directory from an earlier failed
 * run is never silently destroyed or reused.
 */
function uniqueSiblingPath(root: string, role: string): string {
  const parent = dirname(root);
  const base = basename(root);
  for (let counter = 1; ; counter += 1) {
    const candidate = join(parent, `${base}.${role}-${String(counter)}`);
    if (!existsSync(candidate)) {
      return candidate;
    }
  }
}

function bestEffortRemove(ops: InstallFsOps, path: string): string | null {
  try {
    ops.removeTree(path);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Install the generated tree at `generatedRoot` through the transactional
 * protocol documented at the top of this module. Throws
 * InstallRolledBackError when the previous tree survived (untouched or
 * restored) and InstallRecoveryError when manual recovery is required;
 * in the latter case no recoverable directory has been deleted.
 */
export function installGeneratedTree(
  tree: GeneratedTree,
  generatedRoot: string,
  ops: InstallFsOps = REAL_INSTALL_FS_OPS,
): void {
  const parent = dirname(generatedRoot);
  mkdirSync(parent, { recursive: true });

  // Step 1: materialize and verify the complete new tree in a unique
  // sibling staging directory. The existing tree is untouched until the
  // staging tree is proven byte-identical to the in-memory generation.
  const stagingRoot = uniqueSiblingPath(generatedRoot, "staging");
  try {
    ops.materializeTree(tree, stagingRoot);
    verifyMaterializedTree(tree, stagingRoot);
  } catch (error) {
    const removalFailure = bestEffortRemove(ops, stagingRoot);
    const reason = error instanceof Error ? error.message : String(error);
    throw new InstallRolledBackError(
      `staging the new generated tree failed before the existing tree was ` +
        `touched: ${reason}` +
        (removalFailure === null
          ? ""
          : `; additionally, removing the staging directory failed ` +
            `(${removalFailure}) — remove ${stagingRoot} manually`),
    );
  }

  // Step 2: move the existing tree aside to a unique backup (never
  // deleted first). A rename either completes or leaves the source in
  // place, so a failure here leaves the old tree installed.
  const hadExistingTree = existsSync(generatedRoot);
  const backupRoot = hadExistingTree
    ? uniqueSiblingPath(generatedRoot, "backup")
    : null;
  if (backupRoot !== null) {
    try {
      ops.rename(generatedRoot, backupRoot);
    } catch (error) {
      const removalFailure = bestEffortRemove(ops, stagingRoot);
      const reason = error instanceof Error ? error.message : String(error);
      throw new InstallRolledBackError(
        `could not move the existing generated tree aside; it remains ` +
          `installed and unchanged at ${generatedRoot}: ${reason}` +
          (removalFailure === null
            ? ""
            : `; additionally, removing the staging directory failed ` +
              `(${removalFailure}) — remove ${stagingRoot} manually`),
      );
    }
  }

  // Step 3: install the verified staging tree. On failure, restore the
  // backup automatically; if even that fails, delete nothing and report
  // every surviving path.
  try {
    ops.rename(stagingRoot, generatedRoot);
  } catch (installError) {
    const installReason =
      installError instanceof Error
        ? installError.message
        : String(installError);
    if (backupRoot !== null) {
      try {
        ops.rename(backupRoot, generatedRoot);
      } catch (rollbackError) {
        const rollbackReason =
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError);
        throw new InstallRecoveryError(
          `installing the new generated tree failed (${installReason}) AND ` +
            `automatic rollback failed (${rollbackReason}). Nothing was ` +
            `deleted. Surviving directories: previous valid tree at ` +
            `${backupRoot}; verified new tree at ${stagingRoot}; ` +
            `${generatedRoot} is currently absent. Manual recovery: rename ` +
            `${backupRoot} back to ${generatedRoot} (or rename ` +
            `${stagingRoot} to ${generatedRoot} to adopt the new tree), ` +
            `then remove the other directory.`,
          [backupRoot, stagingRoot],
        );
      }
    }
    const removalFailure = bestEffortRemove(ops, stagingRoot);
    throw new InstallRolledBackError(
      `installing the new generated tree failed: ${installReason}; the ` +
        `previous generated tree was ${
          backupRoot === null ? "never present" : "restored unchanged"
        } at ${generatedRoot}` +
        (removalFailure === null
          ? ""
          : `; additionally, removing the staging directory failed ` +
            `(${removalFailure}) — remove ${stagingRoot} manually`),
    );
  }

  // Step 4: the new tree is installed; only now is the backup removed.
  if (backupRoot !== null) {
    try {
      ops.removeTree(backupRoot);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InstallRolledBackError(
        `the new generated tree was installed successfully at ` +
          `${generatedRoot}, but removing the obsolete backup failed ` +
          `(${reason}); remove ${backupRoot} manually`,
      );
    }
  }
}

/**
 * Compare the committed generated tree against the expected in-memory
 * tree. Read-only: the committed tree is never modified. Returns sorted
 * findings; an empty list means the trees are byte-identical.
 */
export function compareGeneratedTree(
  expected: GeneratedTree,
  generatedRoot: string,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const onDisk = listTreeFiles(generatedRoot);
  const onDiskSet = new Set(onDisk);
  for (const [relative, content] of expected.files) {
    if (!onDiskSet.has(relative)) {
      findings.push({
        kind: "MISSING",
        path: relative,
        detail:
          "expected generated output is missing; run `pnpm generate:contracts`",
      });
      continue;
    }
    const absolute = join(generatedRoot, ...relative.split("/"));
    let actual: string;
    try {
      actual = readFileSync(absolute, "utf8");
    } catch (error) {
      findings.push({
        kind: "MISSING",
        path: relative,
        detail: `expected generated output is unreadable (${String(error)})`,
      });
      continue;
    }
    if (actual !== content) {
      findings.push({
        kind: "MODIFIED",
        path: relative,
        detail:
          "committed content differs from regeneration (stale schema " +
          "change or manual edit); run `pnpm generate:contracts`",
      });
    }
  }
  for (const relative of onDisk) {
    if (!expected.files.has(relative)) {
      findings.push({
        kind: "EXTRA",
        path: relative,
        detail:
          "file is not part of the expected generated inventory; remove " +
          "it or regenerate with `pnpm generate:contracts`",
      });
    }
  }
  findings.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  return findings;
}
