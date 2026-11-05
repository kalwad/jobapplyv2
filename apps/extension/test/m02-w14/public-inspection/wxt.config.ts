/** Explicit opt-in evaluation build; never selected by the default build. */
import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

if (process.env.JAPP_W14_PUBLIC_INSPECTION !== "1") {
  throw new Error("W14_PUBLIC_INSPECTION_EXPLICIT_OPT_IN_REQUIRED");
}

export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  entrypointsDir: fileURLToPath(new URL("./entrypoints", import.meta.url)),
  imports: false,
  outDir: "dist/w14-public-inspection",
  manifest: {
    name: "M02-W14 public inspection (evaluation-only)",
    description:
      "Explicit exact-URL public inspection through the actual feasibility scanner and reconciliation engine. No field execution, navigation, account, challenge, upload, or final-action messages are routed.",
  },
});
