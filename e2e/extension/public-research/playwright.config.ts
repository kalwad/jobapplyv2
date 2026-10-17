/** Explicit controlled proof only; no real public requests or default CI run. */
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "controlled-scope.proof.ts",
  // Each invocation cleans its outputDir; retain the default suite's failures.
  outputDir: "../../../test-results/public-research",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
