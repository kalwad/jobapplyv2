// Test-only WXT variant for the ACK-causality proof. It reuses the production
// content entrypoint verbatim and substitutes only an isolated invalid-ACK
// worker; this config is never a production command or manifest capability.
import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

export default defineConfig({
  root: fileURLToPath(new URL("../../../../", import.meta.url)),
  entrypointsDir: fileURLToPath(new URL("./entrypoints", import.meta.url)),
  imports: false,
  outDir: "dist/invalid-ack",
  manifest: {
    name: "M02-W07 invalid-ACK causal test extension",
    description:
      "Test-only invalid ACK transport for readiness causality proof.",
  },
});
