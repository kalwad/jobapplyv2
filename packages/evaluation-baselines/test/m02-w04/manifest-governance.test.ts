// Manifest integrity, read-only check mode, package layering, production
// boundaries (model lock and prompt registry untouched), and the static
// source policy (no time, randomness, network, provider, or environment
// dependence in baseline sources).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  checkBaselineManifest,
  computeBaselineManifest,
  manifestFileBytes,
  MANIFEST_FILE,
  PACKAGE_ROOT,
  readCanonicalJsonFile,
} from "../../src/index.ts";

const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");

describe("baseline manifest", () => {
  test("the committed manifest matches a fresh recomputation exactly", () => {
    expect(checkBaselineManifest()).toEqual([]);
    const committedBytes = readFileSync(
      join(PACKAGE_ROOT, MANIFEST_FILE),
      "utf8",
    );
    expect(committedBytes).toBe(manifestFileBytes(computeBaselineManifest()));
  });

  test("check mode is read-only: repeated checks leave the committed bytes identical", () => {
    const before = readFileSync(join(PACKAGE_ROOT, MANIFEST_FILE));
    expect(checkBaselineManifest()).toEqual([]);
    expect(checkBaselineManifest()).toEqual([]);
    const after = readFileSync(join(PACKAGE_ROOT, MANIFEST_FILE));
    expect(Buffer.compare(before, after)).toBe(0);
  });

  test("the manifest covers exactly the committed src inventory", () => {
    const manifest = computeBaselineManifest();
    const sourceNames = readdirSync(join(PACKAGE_ROOT, "src")).sort();
    expect(manifest.source_files.map((entry) => entry.path)).toEqual(
      sourceNames.map((name) => `src/${name}`),
    );
    for (const entry of manifest.source_files) {
      expect(entry.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(manifest.case_count).toBe(34);
    expect(manifest.legacy_observation_file.record_count).toBe(2);
  });

  test("committed baseline JSON must be canonical (duplicate keys and reordering rejected)", () => {
    expect(() =>
      readCanonicalJsonFile(join(PACKAGE_ROOT, MANIFEST_FILE)),
    ).not.toThrow();
    expect(() =>
      readCanonicalJsonFile(join(PACKAGE_ROOT, "package.json")),
    ).toThrow(/noncanonical/);
  });
});

describe("package layering and production boundaries", () => {
  test("no other workspace package depends on the baseline owner", () => {
    const workspacePackageFiles: string[] = [];
    for (const group of ["apps", "packages"]) {
      for (const name of readdirSync(join(REPO_ROOT, group))) {
        try {
          const manifestPath = join(REPO_ROOT, group, name, "package.json");
          readFileSync(manifestPath);
          workspacePackageFiles.push(manifestPath);
        } catch {
          // Not a package directory (e.g. scaffold placeholder); skip.
        }
      }
    }
    expect(workspacePackageFiles.length).toBeGreaterThanOrEqual(3);
    for (const manifestPath of workspacePackageFiles) {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (parsed.name === "@japp/evaluation-baselines") {
        continue;
      }
      expect(
        Object.keys(parsed.dependencies ?? {}),
        `${manifestPath} must not depend on the baseline package`,
      ).not.toContain("@japp/evaluation-baselines");
      expect(
        Object.keys(parsed.devDependencies ?? {}),
        `${manifestPath} must not depend on the baseline package`,
      ).not.toContain("@japp/evaluation-baselines");
    }
  });

  test("the baseline package depends only on the fixture package and pinned dev tooling", () => {
    const parsed = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(parsed.dependencies ?? {})).toEqual([
      "@japp/test-fixtures",
    ]);
    expect(Object.keys(parsed.devDependencies ?? {}).sort()).toEqual([
      "@types/node",
      "typescript",
      "vitest",
    ]);
  });

  test("model/model-lock.json remains the truthful M05-W02 placeholder", () => {
    const lock = JSON.parse(
      readFileSync(join(REPO_ROOT, "model", "model-lock.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(lock).sort()).toEqual([
      "locked",
      "note",
      "schema_version",
    ]);
    expect(lock.schema_version).toBe(1);
    expect(lock.locked).toBe(false);
    expect(String(lock.note)).toContain("M05-W02");
  });

  test("prompts/registry.yaml remains the empty production registry without baseline prompts", () => {
    const registry = readFileSync(
      join(REPO_ROOT, "prompts", "registry.yaml"),
      "utf8",
    );
    expect(registry).toContain("schema_version: 1");
    expect(registry).toContain("prompts: []");
    expect(registry).not.toContain("baseline_prompt_one_shot_resume");
    expect(registry).not.toContain("baseline_prompt_one_shot_answer");
  });

  test("the package holds exactly its three committed JSON artifacts and no holdout body", () => {
    const jsonFiles: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(PACKAGE_ROOT, relative), {
        withFileTypes: true,
      })) {
        if (entry.name === "node_modules") {
          continue;
        }
        const child =
          relative === "" ? entry.name : `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(child);
        } else if (child.endsWith(".json")) {
          jsonFiles.push(child);
        }
        expect(child.toLowerCase()).not.toContain("holdout");
      }
    };
    walk("");
    expect(jsonFiles.sort()).toEqual([
      "baseline.manifest.json",
      "data/legacy-observations.v1.json",
      "package.json",
      "test/m02-w04/oracles/baseline-truth.v1.json",
      "tsconfig.json",
    ]);
  });
});

describe("static source policy", () => {
  const FORBIDDEN_EVERYWHERE: readonly { pattern: RegExp; label: string }[] = [
    { pattern: /Date\.now/u, label: "Date.now" },
    { pattern: /Math\.random/u, label: "Math.random" },
    { pattern: /new Date\(/u, label: "new Date(" },
    { pattern: /process\.env/u, label: "process.env" },
    { pattern: /\bfetch\s*\(/u, label: "fetch(" },
    { pattern: /XMLHttpRequest/u, label: "XMLHttpRequest" },
    { pattern: /WebSocket/u, label: "WebSocket" },
    { pattern: /node:https?/u, label: "node:http(s)" },
    { pattern: /node:net|node:tls|node:dgram/u, label: "raw sockets" },
    { pattern: /child_process/u, label: "child_process" },
    { pattern: /\beval\s*\(/u, label: "eval(" },
    { pattern: /new Function\(/u, label: "new Function(" },
    { pattern: /\brequire\s*\(/u, label: "require(" },
    {
      pattern: /@japp\/(?!test-fixtures|evaluation-baselines)/u,
      label: "non-fixture workspace import",
    },
  ];

  test("baseline sources contain no time, randomness, network, provider, or environment dependence", () => {
    const sourceDirectory = join(PACKAGE_ROOT, "src");
    for (const name of readdirSync(sourceDirectory).sort()) {
      const content = readFileSync(join(sourceDirectory, name), "utf8");
      for (const { pattern, label } of FORBIDDEN_EVERYWHERE) {
        expect(pattern.test(content), `src/${name} must not use ${label}`).toBe(
          false,
        );
      }
      if (name !== "cli.ts") {
        expect(
          /writeFileSync|appendFileSync|createWriteStream/u.test(content),
          `src/${name} must not write files`,
        ).toBe(false);
      }
    }
  });

  test("the one-shot runner has no structural path to another baseline (no fallback import)", () => {
    const content = readFileSync(
      join(PACKAGE_ROOT, "src", "one-shot.ts"),
      "utf8",
    );
    expect(content).not.toContain("keyword-stuffing");
    expect(content).not.toContain("keyword-overlap");
    expect(content).not.toContain("original-untailored");
  });

  test("the implementation never imports the test-owned oracle", () => {
    const sourceDirectory = join(PACKAGE_ROOT, "src");
    for (const name of readdirSync(sourceDirectory)) {
      const content = readFileSync(join(sourceDirectory, name), "utf8");
      expect(content).not.toContain("baseline-truth");
      expect(content).not.toContain("oracles/");
    }
  });
});
