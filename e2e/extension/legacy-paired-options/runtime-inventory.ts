/** Complete declared source directories, never cache/build/dependency outputs. */
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../../packages/evaluation-runner/src/canonical.ts";

export const CANDIDATE_RUNTIME_POLICY = {
  format_version: "W14_PAIRED_CANDIDATE_RUNTIME_INVENTORY_1",
  directories: [
    "apps/extension/entrypoints",
    "apps/extension/src",
    "e2e/extension/support",
    "packages/contracts/generated",
    "packages/contracts/schemas",
    "packages/contracts/src",
    "packages/evaluation-runner/src",
    "packages/form-engine/src",
  ],
  files: [
    ".nvmrc",
    "apps/extension/package.json",
    "apps/extension/tsconfig.json",
    "apps/extension/tsconfig.typecheck.json",
    "apps/extension/wxt.config.ts",
    "package.json",
    "packages/contracts/package.json",
    "packages/evaluation-runner/package.json",
    "packages/form-engine/package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "tsconfig.json",
  ],
  excluded_directory_names: [
    ".git",
    ".turbo",
    ".wxt",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
  ],
  excluded_file_suffixes: [".pyc", ".pyo", ".tsbuildinfo"],
  required_runtime_paths: [
    "apps/extension/entrypoints/background.ts",
    "apps/extension/entrypoints/feasibility.content.ts",
    "apps/extension/src/driver-engine.ts",
    "apps/extension/src/drivers/choice-drivers.ts",
    "apps/extension/src/drivers/mutation-guard.ts",
    "apps/extension/src/open-dom.ts",
    "apps/extension/src/option-meaning.ts",
    "e2e/extension/support/autofill-w14-native-witness.ts",
    "e2e/extension/support/extension-test.ts",
    "e2e/extension/support/research-harness.ts",
    "packages/contracts/generated/MANIFEST.json",
    "packages/contracts/generated/typescript/index.ts",
    "packages/form-engine/src/option-resolver.ts",
  ],
  max_files: 16_384,
  max_total_bytes: 134_217_728,
  non_source_limits:
    "Installed third-party dependencies are bound by toolchain/package/lock files; actual extension bundle bytes require separate fresh-build provenance and start/end build inventories.",
} as const;

export interface RuntimeSourceFile {
  path: string;
  sha256: string;
}
export interface RuntimeInventoryBinding {
  candidate_runtime_inventory_policy: typeof CANDIDATE_RUNTIME_POLICY;
  candidate_runtime_inventory_digest: string;
  candidate_runtime_sources: RuntimeSourceFile[];
}

/** Every file in a declared directory is included, including newly added helpers. */
export function captureRuntimeInventory(root: string) {
  if (!isAbsolute(root))
    throw new Error("PAIRED_OPTIONS_ABSOLUTE_CANDIDATE_ROOT_REQUIRED");
  const files: RuntimeSourceFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  const add = (path: string) => {
    const stat = lstatSync(join(root, path));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("PAIRED_OPTIONS_RUNTIME_REGULAR_SOURCE_REQUIRED:" + path);
    if (seen.has(path))
      throw new Error("PAIRED_OPTIONS_RUNTIME_DUPLICATE_PATH:" + path);
    if (
      files.length >= CANDIDATE_RUNTIME_POLICY.max_files ||
      totalBytes + stat.size > CANDIDATE_RUNTIME_POLICY.max_total_bytes
    )
      throw new Error("PAIRED_OPTIONS_RUNTIME_INVENTORY_CAPACITY");
    seen.add(path);
    totalBytes += stat.size;
    files.push({ path, sha256: sha256Bytes(readFileSync(join(root, path))) });
  };
  const walk = (path: string) => {
    const stat = lstatSync(join(root, path));
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("PAIRED_OPTIONS_RUNTIME_DIRECTORY_REQUIRED:" + path);
    for (const entry of readdirSync(join(root, path), {
      withFileTypes: true,
    }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      // Names exclude actual artifact directories only; an ordinary source
      // file named dist or __pycache__ still belongs to this inventory.
      if (
        entry.isDirectory() &&
        (
          CANDIDATE_RUNTIME_POLICY.excluded_directory_names as readonly string[]
        ).includes(entry.name)
      )
        continue;
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(
          "PAIRED_OPTIONS_RUNTIME_SOURCE_SYMLINK_REFUSED:" + child,
        );
      if (entry.isDirectory()) walk(child);
      else if (
        entry.isFile() &&
        !CANDIDATE_RUNTIME_POLICY.excluded_file_suffixes.some((suffix) =>
          entry.name.endsWith(suffix),
        )
      )
        add(child);
      else if (!entry.isFile())
        throw new Error(
          "PAIRED_OPTIONS_RUNTIME_REGULAR_SOURCE_REQUIRED:" + child,
        );
    }
  };
  for (const directory of CANDIDATE_RUNTIME_POLICY.directories) walk(directory);
  for (const file of CANDIDATE_RUNTIME_POLICY.files) add(file);
  for (const path of CANDIDATE_RUNTIME_POLICY.required_runtime_paths) {
    if (!seen.has(path))
      throw new Error("PAIRED_OPTIONS_REQUIRED_RUNTIME_PATH_UNBOUND:" + path);
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    policy: CANDIDATE_RUNTIME_POLICY,
    files,
    digest: sha256Canonical(files),
    total_bytes: totalBytes,
  };
}

/** Reject additions/deletions as well as changed bytes, before either actor runs. */
export function assertRuntimeInventory(
  root: string,
  binding: Partial<RuntimeInventoryBinding>,
) {
  if (
    binding.candidate_runtime_inventory_policy === undefined ||
    sha256Canonical(binding.candidate_runtime_inventory_policy) !==
      sha256Canonical(CANDIDATE_RUNTIME_POLICY)
  )
    throw new Error(
      "PAIRED_OPTIONS_RUNTIME_INVENTORY_POLICY_MISSING_OR_DRIFTED",
    );
  const current = captureRuntimeInventory(root);
  if (
    current.digest !== binding.candidate_runtime_inventory_digest ||
    current.digest !== sha256Canonical(binding.candidate_runtime_sources)
  )
    throw new Error("PAIRED_OPTIONS_CANDIDATE_RUNTIME_INVENTORY_DRIFT");
  return current;
}
