import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";
if (process.env.JAPP_W14_PUBLIC_CONTACT_EVALUATION !== "1")
  throw new Error("W14_PUBLIC_CONTACT_EXPLICIT_OPT_IN_REQUIRED");
export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  entrypointsDir: fileURLToPath(new URL("./entrypoints", import.meta.url)),
  imports: false,
  outDir: "dist/w14-public-contact",
  manifest: {
    name: "M02-W14 contact evaluation (network closed)",
    description:
      "Exact public URLs and synthetic contact facts only. Writes require a frozen before-fill plan, actual deterministic policy and live control transactions. All action-phase site network is closed by the explicit evaluation harness; no final, session, upload, consent or challenge actions.",
  },
});
