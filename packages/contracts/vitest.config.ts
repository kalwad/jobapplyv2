import { defineConfig } from "vitest/config";

/**
 * M01-W07 grew the contract catalog and compatibility signature work enough
 * that several Vitest cases that rebuild signatures or spawn full generator
 * CLI passes routinely approach or exceed the 5s default on slower Windows
 * hosted runners. Assertions are unchanged; only the default wall-clock
 * budget matches the work. Contract files are also deliberately serialized:
 * several independent matrix suites build and execute the same test-only Rust
 * harness, and process-local build memoization cannot coordinate parallel
 * Vitest workers against one shared Windows target directory.
 */
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
