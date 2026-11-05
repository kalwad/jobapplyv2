/** Explicit synthetic comparison only. No implicit build or public page access. */
import { defineConfig, devices } from "@playwright/test";
import { assertR10Bound } from "./r10-readiness.mjs";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
assertR10Bound();
if (process.env.JAPP_W14_PAIRED_OPTIONS_EVALUATION !== "1")
  throw new Error("W14_PAIRED_OPTIONS_EXPLICIT_OPT_IN_REQUIRED");
const output = process.env.JAPP_W14_PAIRED_OPTIONS_OUTPUT;
if (output === undefined || !isAbsolute(output))
  throw new Error("W14_PAIRED_OPTIONS_ABSOLUTE_OUTPUT_REQUIRED");
const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const declaration = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./predeclaration.json", import.meta.url)),
    "utf8",
  ),
) as {
  preexecution_source_revision: number;
  preexecution_previous_campaign_lock_digest: string;
};
if (
  declaration.preexecution_source_revision !== 10 ||
  declaration.preexecution_previous_campaign_lock_digest !==
    "sha256:72a68f2929823583c878a20dc8c9b57414f65a5ca59cf21b144c5e1af6466a5a"
)
  throw new Error("W14_PAIRED_OPTIONS_DECLARATION_REVISION_REQUIRED");
const outputRelative = relative(sourceRoot, output);
if (
  outputRelative === "" ||
  (!outputRelative.startsWith("..") && !isAbsolute(outputRelative)) ||
  (existsSync(output) && process.env.TEST_WORKER_INDEX === undefined)
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
