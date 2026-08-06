// Vitest configuration for the mock ATS lab package (M02-W03).
//
// Deliberately independent of the Vite build configuration
// (vite.lab.config.ts, reached only via explicit --config flags): the app
// build roots itself at site/, while the unit suite runs from the package
// root over test/**. Tests are pure Node (catalog, state machines, static
// source policy) — browser behavior is owned by the root Playwright suite.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
