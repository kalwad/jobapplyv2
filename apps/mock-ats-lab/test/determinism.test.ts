// Determinism contract for the mock ATS lab (M02-W03): fixed delays,
// loopback-only serving configuration, and agreement between the shared
// constants, the package scripts, and the root Playwright webServer.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DELAYED_INSERTION_MS,
  DELAYED_RERENDER_MS,
  DELAYED_VALIDATION_MS,
  FLOW_STORAGE_KEY,
  LAB_DEV_PORT,
  LAB_E2E_PORT,
  LAB_HOST,
  RECEIPT_DELAY_MS,
  RECEIPT_PREFIX,
  RECEIPT_STORAGE_KEY,
} from "../site/src/lab/constants.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));

describe("fixed deterministic delays", () => {
  it("pins every lab delay to its reviewed constant", () => {
    expect(DELAYED_INSERTION_MS).toBe(400);
    expect(DELAYED_RERENDER_MS).toBe(500);
    expect(DELAYED_VALIDATION_MS).toBe(500);
    expect(RECEIPT_DELAY_MS).toBe(600);
  });

  it("pins receipt and storage identity", () => {
    expect(RECEIPT_PREFIX).toBe("RCPT-MOCK-");
    expect(FLOW_STORAGE_KEY).toBe("japp-mock-ats-lab.flow.v1");
    expect(RECEIPT_STORAGE_KEY).toBe("japp-mock-ats-lab.receipts.v1");
  });
});

describe("loopback-only serving configuration", () => {
  it("binds only 127.0.0.1 with strict fixed ports", () => {
    expect(LAB_HOST).toBe("127.0.0.1");
    expect(LAB_E2E_PORT).toBe(4761);
    expect(LAB_DEV_PORT).toBe(4760);
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts["e2e-server"]).toContain("--host 127.0.0.1");
    expect(manifest.scripts["e2e-server"]).toContain(
      `--port ${String(LAB_E2E_PORT)}`,
    );
    expect(manifest.scripts["e2e-server"]).toContain("--strictPort");
    expect(manifest.scripts.dev).toContain("--host 127.0.0.1");
    expect(manifest.scripts.dev).toContain(`--port ${String(LAB_DEV_PORT)}`);
    expect(manifest.scripts.dev).toContain("--strictPort");
  });

  it("agrees with the root Playwright webServer contract", () => {
    const config = readFileSync(join(repoRoot, "playwright.config.ts"), "utf8");
    expect(config).toContain(`http://${LAB_HOST}:${String(LAB_E2E_PORT)}/`);
    expect(config).toContain("reuseExistingServer: false");
    expect(config).toContain("@japp/mock-ats-lab");
  });
});
