// Deterministic Vite build for the mock ATS lab (M02-W03, spec §8.2).
//
// Every HTML entry is listed explicitly and the emitted file names carry no
// content hashes, so two builds of the same tree produce byte-identical
// output. The lab binds to 127.0.0.1 only (see package.json scripts); no
// plugin, CDN, or remote asset is involved.
//
// Deliberately NOT named vite.config.*: Vitest auto-loads that name, and
// the repository verifier correctly requires every auto-loadable Vitest
// configuration to be the minimal static test shape (vitest.config.ts
// here). This build config is reached only through the explicit
// `--config vite.lab.config.ts` flags in package.json, so it can never
// influence the test channel.
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const site = (relative: string): string =>
  fileURLToPath(new URL(`site/${relative}`, import.meta.url));

export default defineConfig({
  root: "site",
  // The lab is always served from the origin root by `vite preview`.
  base: "/",
  clearScreen: false,
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // Readable, hash-free, unminified output keeps the built fixture
    // inspectable and byte-stable across identical builds.
    minify: false,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        "apply-receipt": site("apply/receipt/index.html"),
        "apply-review": site("apply/review/index.html"),
        "apply-step-1": site("apply/step-1/index.html"),
        "apply-step-2": site("apply/step-2/index.html"),
        "apply-step-3": site("apply/step-3/index.html"),
        combobox: site("combobox/index.html"),
        datephone: site("datephone/index.html"),
        dynamic: site("dynamic/index.html"),
        frames: site("frames/index.html"),
        "frames-inner": site("frames/inner/index.html"),
        index: site("index.html"),
        native: site("native/index.html"),
        react: site("react/index.html"),
        shadow: site("shadow/index.html"),
        upload: site("upload/index.html"),
        validation: site("validation/index.html"),
        virtualized: site("virtualized/index.html"),
        vue: site("vue/index.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/chunk-[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  define: {
    // The Vue fixture uses render functions only; disabling the options API
    // and devtools branches keeps the runtime deterministic and small.
    __VUE_OPTIONS_API__: "false",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
});
