/** Explicit synthetic comparison only. No implicit build or public page access. */
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
if (process.env.JAPP_W14_PAIRED_OPTIONS_EVALUATION !== "1")
  throw new Error("W14_PAIRED_OPTIONS_EXPLICIT_OPT_IN_REQUIRED");
const output = process.env.JAPP_W14_PAIRED_OPTIONS_OUTPUT;
if (output === undefined || !isAbsolute(output))
  throw new Error("W14_PAIRED_OPTIONS_ABSOLUTE_OUTPUT_REQUIRED");
const here = fileURLToPath(new URL(".", import.meta.url));
const outputRelative = relative(here, output);
if (
  outputRelative === "" ||
  (!outputRelative.startsWith("..") && !isAbsolute(outputRelative)) ||
  existsSync(output)
)
  throw new Error("W14_PAIRED_OPTIONS_FRESH_OUTSIDE_OUTPUT_REQUIRED");
export default defineConfig({
  testDir: ".",
  testMatch: "paired-options.proof.ts",
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
