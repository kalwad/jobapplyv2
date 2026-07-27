/**
 * Filesystem operations for the contract generator (M01-W02).
 *
 * Write mode: materialize the in-memory generated tree into a same-volume
 * staging directory, then swap it into place with a directory rename so the
 * installed tree is always a complete generation — never a partial mix of
 * old and new files. Whole-tree replacement also removes stale outputs of
 * deleted schemas by construction.
 *
 * Check mode: byte-compare the committed generated tree against a freshly
 * generated one file by file, without touching the committed tree. The
 * comparison walks the COMPLETE expected inventory and the COMPLETE
 * on-disk tree, so missing, stale, modified, and unexpected extra files are
 * all detected and reported with actionable paths.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, sep } from "node:path";

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
 * Install the generated tree at `generatedRoot`, replacing whatever was
 * there. The staging directory lives next to the target (same volume) so
 * the final installation is a single directory rename.
 */
export function installGeneratedTree(
  tree: GeneratedTree,
  generatedRoot: string,
): void {
  const stagingRoot = `${generatedRoot}.staging`;
  rmSync(stagingRoot, { recursive: true, force: true });
  try {
    writeTreeInto(tree, stagingRoot);
    rmSync(generatedRoot, { recursive: true, force: true });
    renameSync(stagingRoot, generatedRoot);
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
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
