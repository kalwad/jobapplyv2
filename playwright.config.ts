// Playwright configuration (M00-W03 browser-toolchain smoke; M02-W03 mock
// ATS lab): deterministic settings for the real pinned-Chromium suites.
// The mock ATS lab is built and served for every run on a fixed loopback
// port; the original infrastructure smoke test keeps running unchanged.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // R10 structural Node tests require their separately bound Node runner.
  // Keep these Node-only modules outside default browser discovery.
  testIgnore: ["**/extension/legacy-paired-options-r10/*.test.mjs"],
  // M02-W07: build the real @japp/extension MV3 output before any test
  // runs, so the canonical `playwright test` command always exercises the
  // freshly built extension. Playwright skips global setup for `--list`,
  // so discovery performs no build or filesystem mutation.
  globalSetup: "./e2e/extension/support/global-setup.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    // Every lab route is loopback-only; specs navigate by relative path.
    baseURL: "http://127.0.0.1:4761",
    // Artifacts only when something fails (spec §1.5: no noise, no
    // content retention beyond diagnostics).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      // Deterministic build + preview of apps/mock-ats-lab on 127.0.0.1:4761.
      // --strictPort (in the package script) refuses to drift to another
      // port, and reuseExistingServer: false refuses to attach to any
      // already-running process on it.
      command: "pnpm --filter @japp/mock-ats-lab e2e-server",
      url: "http://127.0.0.1:4761/",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter @japp/desktop e2e-server",
      url: "http://127.0.0.1:4762/",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [{ name: "chromium" }],
});
