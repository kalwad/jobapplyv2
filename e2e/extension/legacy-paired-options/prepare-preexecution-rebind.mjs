/** Source-only proposal author. Never launches a browser/server or edits sourceRoot. */
import process from "node:process";
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sha256Bytes } from "../../../packages/evaluation-runner/src/canonical.ts";
import { captureRuntimeInventory } from "./runtime-inventory.ts";

export const FROZEN_DATA = Object.freeze({
  "paired-inputs.json":
    "sha256:2d1ce7ba5acf2414f5936b47055e9afd412ffbee0f8a247cd2c6f583548c3812",
  "paired-oracles.json":
    "sha256:96a9fa8780c4b0c5bee78edf9f0b721ea171c598ef3e9cd89cd33ddf8ccb3626",
  "legacy-projections.json":
    "sha256:7c7cd5d546aee296ddaa50455b95b4baf7c32e2984ba1df53ddacf5c445531ed",
});
export const PREVIOUS_LOCK =
  "sha256:561bc786d35c51e9705b0c0659bec6b180e0bbd7c59bc9ea28752e9e690a759d";
const CAMPAIGN_RELATIVE = "e2e/extension/legacy-paired-options";
const NEW_SOURCE_FILES = [
  "runtime-inventory.ts",
  "runtime-inventory.test.mjs",
  "prepare-preexecution-rebind.mjs",
  "PREEXECUTION.md",
  "preexecution-history/revision-3/campaign.lock.json",
  "preexecution-history/revision-3/campaign.lock.sha256",
  "preexecution-history/revision-3/predeclaration.json",
  "preexecution-history/revision-3/source-bindings.json",
];
const MUTABLE_OLD_EXECUTABLES = new Set([
  "campaign.mjs",
  "paired-options.proof.ts",
]);
const jsonBytes = (value) => JSON.stringify(value, null, 2) + "\n";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))
  );
};

export function inspectRebind(sourceRoot, legacyRoot) {
  if (
    ![sourceRoot, legacyRoot].every(
      (path) => typeof path === "string" && isAbsolute(path),
    )
  )
    throw new Error("PAIRED_REBIND_ABSOLUTE_SOURCE_AND_LEGACY_ROOTS_REQUIRED");
  const campaignRoot = join(sourceRoot, CAMPAIGN_RELATIVE);
  const lockBytes = readFileSync(join(campaignRoot, "campaign.lock.json"));
  if (sha256Bytes(lockBytes) !== PREVIOUS_LOCK)
    throw new Error("PAIRED_REBIND_REVIEWED_PREVIOUS_LOCK_REQUIRED");
  const lock = JSON.parse(lockBytes.toString("utf8"));
  if (lock.format_version !== "W14_PAIRED_OPTIONS_CAMPAIGN_LOCK_1")
    throw new Error("PAIRED_REBIND_PREVIOUS_LOCK_FORMAT");
  for (const [path, digest] of Object.entries(FROZEN_DATA)) {
    if (sha256Bytes(readFileSync(join(campaignRoot, path))) !== digest)
      throw new Error("PAIRED_REBIND_FROZEN_DATA_DRIFT:" + path);
  }
  for (const entry of lock.files) {
    if (entry.path.startsWith("/") || entry.path.split("/").includes(".."))
      throw new Error("PAIRED_REBIND_PATH_REFUSED");
    if (
      !MUTABLE_OLD_EXECUTABLES.has(entry.path) &&
      sha256Bytes(readFileSync(join(campaignRoot, entry.path))) !== entry.sha256
    )
      throw new Error(
        "PAIRED_REBIND_UNREVIEWED_OLD_CAMPAIGN_FILE_DRIFT:" + entry.path,
      );
  }
  const bindings = readJson(join(campaignRoot, "source-bindings.json"));
  const predeclaration = readJson(join(campaignRoot, "predeclaration.json"));
  for (const source of bindings.legacy_sources) {
    if (
      sha256Bytes(readFileSync(join(legacyRoot, source.path))) !== source.sha256
    )
      throw new Error("PAIRED_REBIND_LEGACY_SOURCE_DRIFT:" + source.path);
  }
  if (
    sha256Bytes(
      readFileSync(join(sourceRoot, bindings.native_observer.helper_path)),
    ) !== bindings.native_observer.helper_sha256
  )
    throw new Error(
      "PAIRED_REBIND_SYMMETRIC_NATIVE_OBSERVER_CHANGED_REVIEW_REQUIRED",
    );
  for (const name of [
    "campaign.lock.json",
    "campaign.lock.sha256",
    "source-bindings.json",
    "predeclaration.json",
  ]) {
    if (
      sha256Bytes(
        readFileSync(
          join(campaignRoot, "preexecution-history/revision-3", name),
        ),
      ) !== sha256Bytes(readFileSync(join(campaignRoot, name)))
    )
      throw new Error("PAIRED_REBIND_PREVIOUS_LOCK_HISTORY_DRIFT:" + name);
  }
  const inventory = captureRuntimeInventory(sourceRoot);
  return { campaignRoot, lock, bindings, predeclaration, inventory };
}

/** Called only after parent review of the final driver delta and before either run. */
export function proposeRebind({
  sourceRoot,
  legacyRoot,
  output,
  reviewRecord,
  noPairedExecution,
}) {
  if (
    noPairedExecution !== true ||
    typeof reviewRecord !== "string" ||
    reviewRecord.trim() === ""
  )
    throw new Error(
      "PAIRED_REBIND_PREEXECUTION_AND_FINAL_KERNEL_REVIEW_RECORD_REQUIRED",
    );
  if (typeof output !== "string" || !isAbsolute(output) || existsSync(output))
    throw new Error("PAIRED_REBIND_FRESH_ABSOLUTE_OUTSIDE_OUTPUT_REQUIRED");
  const sourceReal = realpathSync(sourceRoot);
  const outputReal = join(
    realpathSync(dirname(output)),
    relative(dirname(output), resolve(output)),
  );
  if (inside(sourceReal, outputReal))
    throw new Error("PAIRED_REBIND_OUTPUT_MUST_BE_OUTSIDE_SOURCE_ROOT");
  const inspected = inspectRebind(sourceRoot, legacyRoot);
  const { campaignRoot, lock, bindings, predeclaration, inventory } = inspected;
  const newDeclaration = {
    ...predeclaration,
    preexecution_source_revision: 4,
    preexecution_source_revision_reason:
      "COMPLETE_DECLARED_RUNTIME_INVENTORY_AFTER_FINAL_DRIVER_KERNEL_REVIEW",
    preexecution_previous_campaign_lock_digest: PREVIOUS_LOCK,
    preexecution_runtime_review_record: reviewRecord,
    preexecution_no_paired_system_run_declared: true,
    preexecution_rebind_prepared_at: new Date().toISOString(),
    preexecution_runtime_inventory_correction:
      "The old 316-path inventory was incomplete for newer runtime helpers and included 98 irrelevant Python bytecode cache files. This pre-execution source revision binds every file in declared source/generated directories, including open-dom, mutation-guard and option-meaning, while excluding only declared dependency/build/cache outputs. No system run under the old inventory is claimed.",
    candidate_runtime_inventory_policy: inventory.policy,
    candidate_runtime_inventory_digest: inventory.digest,
    candidate_runtime_inventory_count: inventory.files.length,
  };
  const declarationBytes = jsonBytes(newDeclaration);
  const newBindings = {
    ...bindings,
    predeclaration_digest: sha256Bytes(declarationBytes),
    candidate_runtime_sources: inventory.files,
    candidate_runtime_inventory_policy: inventory.policy,
    candidate_runtime_inventory_digest: inventory.digest,
  };
  const overrides = new Map([
    ["predeclaration.json", declarationBytes],
    ["source-bindings.json", jsonBytes(newBindings)],
  ]);
  const expectedFiles = new Set([
    ...lock.files.map((entry) => entry.path),
    ...NEW_SOURCE_FILES,
  ]);
  const paths = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isSymbolicLink())
        throw new Error("PAIRED_REBIND_CAMPAIGN_SYMLINK_REFUSED");
      if (entry.isDirectory()) walk(join(directory, entry.name), path + "/");
      else if (
        entry.isFile() &&
        !["campaign.lock.json", "campaign.lock.sha256"].includes(path)
      ) {
        if (!expectedFiles.has(path))
          throw new Error("PAIRED_REBIND_UNREVIEWED_CAMPAIGN_FILE:" + path);
        paths.push(path);
      } else if (!entry.isFile())
        throw new Error("PAIRED_REBIND_REGULAR_CAMPAIGN_FILE_REQUIRED");
    }
  };
  walk(campaignRoot);
  if (paths.length !== expectedFiles.size)
    throw new Error("PAIRED_REBIND_REVIEWED_CAMPAIGN_INVENTORY_MISSING");
  const newLock = {
    ...lock,
    status:
      "FROZEN_BEFORE_EITHER_NEW_RUN_REVISION_4_COMPLETE_RUNTIME_INVENTORY",
    files: paths.sort().map((path) => ({
      path,
      sha256: sha256Bytes(
        overrides.get(path) ?? readFileSync(join(campaignRoot, path)),
      ),
    })),
  };
  const newLockBytes = jsonBytes(newLock);
  overrides.set("campaign.lock.json", newLockBytes);
  overrides.set("campaign.lock.sha256", sha256Bytes(newLockBytes) + "\n");
  mkdirSync(output);
  for (const [path, bytes] of overrides)
    writeFileSync(join(output, path), bytes, { flag: "wx" });
  const patch = [];
  for (const path of overrides.keys()) {
    const result = spawnSync(
      "git",
      [
        "diff",
        "--no-index",
        "--no-prefix",
        "--",
        join(campaignRoot, path),
        join(output, path),
      ],
      { encoding: "utf8", timeout: 10_000, maxBuffer: 4_194_304 },
    );
    if (result.error || ![0, 1].includes(result.status))
      throw new Error("PAIRED_REBIND_PATCH_GENERATION_FAILED");
    patch.push(
      result.stdout
        .split("\n")
        .map((line) =>
          line.startsWith("diff --git ")
            ? `diff --git a/${CAMPAIGN_RELATIVE}/${path} b/${CAMPAIGN_RELATIVE}/${path}`
            : line.startsWith("--- ")
              ? `--- a/${CAMPAIGN_RELATIVE}/${path}`
              : line.startsWith("+++ ")
                ? `+++ b/${CAMPAIGN_RELATIVE}/${path}`
                : line,
        )
        .join("\n"),
    );
  }
  const patchBytes = patch.join("");
  writeFileSync(join(output, "preexecution-rebind.patch"), patchBytes, {
    flag: "wx",
  });
  if (captureRuntimeInventory(sourceRoot).digest !== inventory.digest)
    throw new Error("PAIRED_REBIND_SOURCE_CHANGED_DURING_PROPOSAL");
  for (const [path, digest] of Object.entries(FROZEN_DATA)) {
    if (sha256Bytes(readFileSync(join(campaignRoot, path))) !== digest)
      throw new Error("PAIRED_REBIND_FROZEN_DATA_CHANGED_DURING_PROPOSAL");
  }
  const report = {
    format_version: "W14_PAIRED_PREEXECUTION_SOURCE_REBIND_PROPOSAL_1",
    authority: "NONE",
    status: "PROPOSED_BEFORE_EITHER_NEW_SYSTEM_RUN_NOT_EXECUTED",
    gate_pass: false,
    source_root: sourceRoot,
    legacy_root: legacyRoot,
    previous_lock_digest: PREVIOUS_LOCK,
    proposed_lock_digest: sha256Bytes(newLockBytes),
    proposed_patch_digest: sha256Bytes(patchBytes),
    frozen_data_unchanged: FROZEN_DATA,
    candidate_runtime_inventory_count: inventory.files.length,
    candidate_runtime_inventory_digest: inventory.digest,
    runtime_review_record: reviewRecord,
    candidate_runs_performed_by_rebind_tool: 0,
    legacy_runs_performed_by_rebind_tool: 0,
    note: "Parent must review/apply this proposal and externally commit the exact new lock before a fresh default build and either actual run. Output creation is not execution or a gate pass.",
  };
  writeFileSync(join(output, "rebind-proposal.json"), jsonBytes(report), {
    flag: "wx",
  });
  return report;
}

function main() {
  const [mode, ...args] = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      !key?.startsWith("--") ||
      value === undefined ||
      Object.hasOwn(options, key)
    )
      throw new Error("PAIRED_REBIND_EXACT_OPTIONS_REQUIRED");
    options[key] = value;
  }
  const allowed =
    mode === "inspect"
      ? ["--source-root", "--legacy-root"]
      : [
          "--source-root",
          "--legacy-root",
          "--output",
          "--review-record",
          "--no-paired-execution",
        ];
  if (
    !["inspect", "propose"].includes(mode) ||
    Object.keys(options).some((key) => !allowed.includes(key))
  )
    throw new Error("PAIRED_REBIND_INSPECT_OR_PROPOSE_ONLY");
  if (mode === "inspect") {
    const inspected = inspectRebind(
      options["--source-root"],
      options["--legacy-root"],
    );
    process.stdout.write(
      jsonBytes({
        status: "READ_ONLY_SOURCE_INVENTORY_NOT_A_FINAL_LOCK",
        frozen_data_unchanged: FROZEN_DATA,
        current_runtime_files: inspected.inventory.files.length,
        current_runtime_digest: inspected.inventory.digest,
        previous_runtime_files:
          inspected.bindings.candidate_runtime_sources.length,
        old_inventory_complete: false,
        candidate_runs_performed_by_rebind_tool: 0,
        legacy_runs_performed_by_rebind_tool: 0,
      }),
    );
  } else {
    process.stdout.write(
      jsonBytes(
        proposeRebind({
          sourceRoot: options["--source-root"],
          legacyRoot: options["--legacy-root"],
          output: options["--output"],
          reviewRecord: options["--review-record"],
          noPairedExecution: options["--no-paired-execution"] === "true",
        }),
      ),
    );
  }
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
