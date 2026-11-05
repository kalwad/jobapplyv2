/** Explicit synthetic comparison only. No implicit build or public page access. */
import { defineConfig, devices } from "@playwright/test";
import { isAbsolute } from "node:path";
if (process.env.JAPP_W14_LEGACY_CANDIDATE_EVALUATION !== "1")
  throw new Error("W14_LEGACY_CANDIDATE_EXPLICIT_OPT_IN_REQUIRED");
const output = process.env.JAPP_W14_LEGACY_CANDIDATE_OUTPUT;
if (output === undefined || !isAbsolute(output))
  throw new Error("W14_LEGACY_CANDIDATE_ABSOLUTE_OUTPUT_REQUIRED");
export default defineConfig({
  testDir: ".",
  testMatch: "frozen-legacy-candidate.proof.ts",
  outputDir: output,
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
