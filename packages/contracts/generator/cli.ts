/**
 * Command-line driver for the contract generator (M01-W02).
 *
 * Modes:
 * - write (default): regenerate `packages/contracts/generated/` through
 *   the transactional, rollback-safe whole-tree replacement in fsops.ts
 *   (staging is verified before the existing tree is touched, the
 *   existing tree is preserved as a backup until the new tree is
 *   installed, and failures restore or preserve the previous tree).
 * - --check: regenerate into an isolated temporary directory outside the
 *   repository, verify the materialized bytes, and byte-compare the
 *   complete inventory against the committed tree. Read-only with respect
 *   to the working tree; exits nonzero with actionable paths on any drift.
 *
 * --schemas-root / --generated-root are explicit tooling/test overrides so
 * negative paths can run against fixture trees without touching the
 * repository. Exit codes: 0 success, 1 drift, 2 usage/generation failure.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareGeneratedTree,
  installGeneratedTree,
  REAL_INSTALL_FS_OPS,
  verifyMaterializedTree,
  type DriftFinding,
} from "./fsops.ts";
import { generateContracts, type GeneratedTree } from "./generate.ts";

/** Default generated root: packages/contracts/generated. */
export const DEFAULT_GENERATED_ROOT = fileURLToPath(
  new URL("../generated", import.meta.url),
);

export interface CliOptions {
  readonly check: boolean;
  readonly schemasRoot: string | undefined;
  readonly catalogRoot: string | undefined;
  readonly generatedRoot: string;
}

export class CliUsageError extends Error {}

export function parseCliArguments(argv: readonly string[]): CliOptions {
  let check = false;
  let schemasRoot: string | undefined;
  let catalogRoot: string | undefined;
  let generatedRoot = DEFAULT_GENERATED_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      check = true;
    } else if (
      argument === "--schemas-root" ||
      argument === "--catalog-root" ||
      argument === "--generated-root"
    ) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliUsageError(`${argument} requires a directory argument`);
      }
      if (argument === "--schemas-root") {
        schemasRoot = value;
      } else if (argument === "--catalog-root") {
        catalogRoot = value;
      } else {
        generatedRoot = value;
      }
      index += 1;
    } else {
      throw new CliUsageError(
        `unknown argument ${JSON.stringify(argument ?? "")}; usage: ` +
          "generate-contracts [--check] [--schemas-root <dir>] " +
          "[--catalog-root <dir>] [--generated-root <dir>]",
      );
    }
  }
  return { check, schemasRoot, catalogRoot, generatedRoot };
}

function renderFinding(finding: DriftFinding): string {
  return `${finding.kind.padEnd(8)} ${finding.path}\n         ${finding.detail}`;
}

/**
 * Materialize the tree into a fresh temporary directory and prove the
 * bytes on disk equal the in-memory tree (write-path self check). Returns
 * the temporary root; the caller removes it.
 */
function materializeToTemporary(tree: GeneratedTree): string {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "japp-contract-gen-"));
  const materializedRoot = join(temporaryRoot, "generated");
  REAL_INSTALL_FS_OPS.materializeTree(tree, materializedRoot);
  verifyMaterializedTree(tree, materializedRoot);
  return temporaryRoot;
}

/** Run the generator CLI; returns the process exit code. */
export function runCli(
  argv: readonly string[],
  log: (line: string) => void,
): number {
  let options: CliOptions;
  try {
    options = parseCliArguments(argv);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 2;
  }
  let generation;
  try {
    generation = generateContracts({
      ...(options.schemasRoot === undefined
        ? {}
        : { schemasRoot: options.schemasRoot }),
      ...(options.catalogRoot === undefined
        ? {}
        : { catalogRoot: options.catalogRoot }),
    });
  } catch (error) {
    log("contract generation failed (fail closed):");
    log(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const { tree } = generation;

  if (!options.check) {
    try {
      installGeneratedTree(tree, options.generatedRoot);
    } catch (error) {
      log("failed to install the generated tree:");
      log(error instanceof Error ? error.message : String(error));
      return 2;
    }
    log(
      `generated ${String(tree.files.size)} files into ${options.generatedRoot}`,
    );
    return 0;
  }

  let temporaryRoot: string | null = null;
  let findings: DriftFinding[];
  try {
    temporaryRoot = materializeToTemporary(tree);
    findings = compareGeneratedTree(tree, options.generatedRoot);
  } catch (error) {
    log("contract check failed (fail closed):");
    log(error instanceof Error ? error.message : String(error));
    return 2;
  } finally {
    if (temporaryRoot !== null) {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
  if (findings.length > 0) {
    log(
      `generated-contract drift: ${String(findings.length)} finding(s) ` +
        `against ${options.generatedRoot}`,
    );
    for (const finding of findings) {
      log(renderFinding(finding));
    }
    return 1;
  }
  log(
    `generated contracts are up to date (${String(tree.files.size)} files, ` +
      "byte-identical)",
  );
  return 0;
}
