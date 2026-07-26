// Playwright configuration (M00-W03): deterministic settings for the
// browser-toolchain infrastructure smoke test only. There is no web server,
// no product URL, and no product behavior to test yet — e2e suites for real
// features arrive with their owning milestones, and the aggregate
// test:e2e/test:visual commands arrive in M00-W04.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    // Artifacts only when something fails (spec §1.5: no noise, no
    // content retention beyond diagnostics).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
});
