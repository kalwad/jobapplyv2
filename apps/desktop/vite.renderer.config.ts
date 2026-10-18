import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./test/renderer", import.meta.url)),
  esbuild: { jsx: "automatic" },
  build: { outDir: "../../dist-renderer", emptyOutDir: true },
});
