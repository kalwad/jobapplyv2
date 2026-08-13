// M02-W07 global setup: build the real @japp/extension WXT output before
// any Playwright test runs. This makes the canonical `playwright test`
// command self-sufficient — the browser suite always exercises the freshly
// built Manifest V3 extension (REQ-FORM-020) — while `playwright test
// --list` performs no build or filesystem mutation because Playwright skips
// global setup during listing.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const EXTENSION_ROOT = join(REPO_ROOT, "apps", "extension");
const BUILD_TIMEOUT_MS = 180_000;

function resolveWxtBin(): string {
  const packageRequire = createRequire(join(EXTENSION_ROOT, "package.json"));
  const wxtEntry = packageRequire.resolve("wxt");
  // dist/index.mjs -> ../bin/wxt.mjs within the installed wxt package.
  const wxtBin = join(dirname(wxtEntry), "..", "bin", "wxt.mjs");
  if (!existsSync(wxtBin)) {
    throw new Error(
      `wxt CLI entry not found at ${wxtBin}; run 'pnpm install --frozen-lockfile' first`,
    );
  }
  return wxtBin;
}

function buildExtension(config?: string): void {
  // Real pinned WXT build through the current Node binary: argv array, no
  // shell, portable across macOS/Windows/Ubuntu runners.
  const args = [resolveWxtBin(), "build", "-b", "chrome"];
  if (config !== undefined) {
    args.push("-c", config);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: EXTENSION_ROOT,
    stdio: "inherit",
    timeout: BUILD_TIMEOUT_MS,
  });
  if (result.status !== 0) {
    // Preserve every child-outcome detail: a 180s timeout kill arrives as
    // {status: null, signal: 'SIGTERM', error: ETIMEDOUT} and must be
    // distinguishable from an immediate crash or a spawn failure.
    throw new Error(
      `@japp/extension WXT build${config ? ` (${config})` : ""} failed: ` +
        `status ${String(result.status)}, ` +
        `signal ${String(result.signal)}, error ${String(result.error)}`,
    );
  }
}

export default function globalSetup(): void {
  buildExtension();
  buildExtension("test/m02-w07/fixtures/invalid-ack/wxt.config.ts");

  const manifestPath = join(
    EXTENSION_ROOT,
    "dist",
    "chrome-mv3",
    "manifest.json",
  );
  if (!existsSync(manifestPath)) {
    throw new Error(
      `@japp/extension build completed but ${manifestPath} is missing`,
    );
  }
  const invalidAckManifestPath = join(
    EXTENSION_ROOT,
    "dist",
    "invalid-ack",
    "chrome-mv3",
    "manifest.json",
  );
  if (!existsSync(invalidAckManifestPath)) {
    throw new Error(
      `invalid-ACK causal build completed but ${invalidAckManifestPath} is missing`,
    );
  }
}
