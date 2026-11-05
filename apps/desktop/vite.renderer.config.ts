import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./test/renderer", import.meta.url)),
  esbuild: { jsx: "automatic" },
  build: {
    outDir: "../../dist-renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        shell: fileURLToPath(
          new URL("./test/renderer/index.html", import.meta.url),
        ),
        service: fileURLToPath(
          new URL("./test/renderer/service.html", import.meta.url),
        ),
        catalog: fileURLToPath(
          new URL("./test/renderer/catalog.html", import.meta.url),
        ),
      },
    },
  },
});
