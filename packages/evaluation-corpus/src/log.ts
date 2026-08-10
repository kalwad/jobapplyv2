import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { REPOSITORY_ROOT } from "./corpus.ts";

export const HOLDOUT_LOG_PATH = "docs/gates/HOLDOUT_EXECUTION_LOG.md" as const;

export interface HoldoutExecutionRowV1 {
  readonly execution_id: string;
  readonly date: string;
  readonly gate: string;
  readonly bundle_manifest_digest: string;
  readonly commit: string;
  readonly tree: string;
  readonly runner_revision: string;
  readonly result_artifact_digest: string;
  readonly executor_role: string;
  readonly outcome: string;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SHA = /^[0-9a-f]{40}$/u;
const EXECUTION_ID = /^execution_[0-9A-HJKMNP-TV-Z]{26}$/u;
const GATE =
  /^(AUTOFILL_FEASIBILITY|CROSS_PLATFORM_CORE|RESUME_PAGEFIT_FEASIBILITY|WORKDAY_GUIDED_PRE_SUBMIT)$/u;

export function parseHoldoutLog(
  text: string,
): readonly HoldoutExecutionRowV1[] {
  const rows: HoldoutExecutionRowV1[] = [];
  const lines = text.split(/\r?\n/u);
  for (const line of lines) {
    if (
      !line.startsWith("| ") ||
      line.startsWith("| ---") ||
      line.includes("Execution ID") ||
      line.includes("| Date |")
    )
      continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.every((cell) => cell === "—" || cell.startsWith("(none yet")))
      continue;
    if (cells.length !== 10) throw new Error("HOLDOUT_LOG_ROW_SHAPE");
    const [
      execution_id,
      date,
      gate,
      bundle_manifest_digest,
      commit,
      tree,
      runner_revision,
      result_artifact_digest,
      executor_role,
      outcome,
    ] = cells;
    if (
      execution_id === undefined ||
      !EXECUTION_ID.test(execution_id) ||
      date === undefined ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      gate === undefined ||
      !GATE.test(gate) ||
      bundle_manifest_digest === undefined ||
      !DIGEST.test(bundle_manifest_digest) ||
      commit === undefined ||
      !SHA.test(commit) ||
      tree === undefined ||
      !SHA.test(tree) ||
      runner_revision === undefined ||
      !SHA.test(runner_revision) ||
      result_artifact_digest === undefined ||
      !DIGEST.test(result_artifact_digest) ||
      executor_role === undefined ||
      !/^ROLE_[A-Z_]{3,48}$/u.test(executor_role) ||
      outcome === undefined ||
      !/^(FAIL|INVALID|PASS|REDESIGN_REQUIRED)$/u.test(outcome)
    )
      throw new Error("HOLDOUT_LOG_ROW_INVALID");
    rows.push({
      execution_id,
      date,
      gate,
      bundle_manifest_digest,
      commit,
      tree,
      runner_revision,
      result_artifact_digest,
      executor_role,
      outcome,
    });
  }
  assertNoDuplicateRows(rows);
  return rows;
}

function assertNoDuplicateRows(rows: readonly HoldoutExecutionRowV1[]): void {
  const executionIds = new Set<string>();
  const revisionResults = new Set<string>();
  for (const row of rows) {
    const revisionResult = `${row.commit}:${row.tree}:${row.runner_revision}:${row.result_artifact_digest}`;
    if (executionIds.has(row.execution_id))
      throw new Error("HOLDOUT_LOG_DUPLICATE_EXECUTION");
    if (revisionResults.has(revisionResult))
      throw new Error("HOLDOUT_LOG_DUPLICATE_REVISION_RESULT");
    executionIds.add(row.execution_id);
    revisionResults.add(revisionResult);
  }
}

export function validateAppendOnlyLog(previous: string, current: string): void {
  const oldRows = parseHoldoutLog(previous);
  const newRows = parseHoldoutLog(current);
  if (newRows.length < oldRows.length) throw new Error("HOLDOUT_LOG_DELETION");
  for (let index = 0; index < oldRows.length; index++) {
    if (JSON.stringify(oldRows[index]) !== JSON.stringify(newRows[index]))
      throw new Error("HOLDOUT_LOG_PREFIX_MUTATION");
  }
}

export function checkHoldoutLogHistory(): void {
  const revisions = spawnSync(
    "git",
    ["rev-list", "--first-parent", "--reverse", "HEAD", "--", HOLDOUT_LOG_PATH],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  if (revisions.status !== 0)
    throw new Error("HOLDOUT_LOG_HISTORY_UNAVAILABLE");
  let previous: string | undefined;
  for (const revision of revisions.stdout
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)) {
    const snapshot = spawnSync(
      "git",
      ["show", `${revision}:${HOLDOUT_LOG_PATH}`],
      {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
      },
    );
    if (snapshot.status !== 0)
      throw new Error("HOLDOUT_LOG_HISTORY_UNAVAILABLE");
    if (previous !== undefined)
      validateAppendOnlyLog(previous, snapshot.stdout);
    previous = snapshot.stdout;
  }
  const worktree = readFileSync(
    join(REPOSITORY_ROOT, HOLDOUT_LOG_PATH),
    "utf8",
  );
  if (previous !== undefined) validateAppendOnlyLog(previous, worktree);
  else parseHoldoutLog(worktree);
}
