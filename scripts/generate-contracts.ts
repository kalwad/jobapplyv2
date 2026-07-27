/**
 * Canonical contract-generator entry point (M01-W02, spec §5.1 §5.2).
 *
 * Regenerates — or, with --check, byte-verifies — the deterministic
 * TypeScript and Pydantic v2 contract trees under
 * packages/contracts/generated/ from the canonical hand-authored JSON
 * Schema catalog in packages/contracts/schemas/.
 *
 * Runs directly under the repository-pinned Node (native type stripping;
 * no shell profile, no Bash wrapper, no compile step):
 *
 *   pnpm generate:contracts            # write mode
 *   pnpm generate:contracts --check    # read-only drift check (contract-gen)
 *
 * The implementation lives in packages/contracts/generator/ so the engine
 * is unit-tested by the package's Vitest suites; this file is only the
 * process boundary.
 */

import { runCli } from "../packages/contracts/generator/cli.ts";

process.exitCode = runCli(process.argv.slice(2), (line: string) => {
  console.log(line);
});
