import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");

function workspacePackageFiles(): readonly string[] {
  const files: string[] = [];
  for (const group of ["apps", "packages"] as const) {
    for (const name of readdirSync(join(REPO_ROOT, group))) {
      const manifest = join(REPO_ROOT, group, name, "package.json");
      try {
        readFileSync(manifest);
        files.push(manifest);
      } catch {
        // Non-package scaffold directories are outside workspace discovery.
      }
    }
  }
  return files.sort();
}

describe("M02-W05 package layering and governance boundaries", () => {
  it("adds exactly one reviewed workspace owner and no production dependency on it", () => {
    const manifests = workspacePackageFiles();
    expect(manifests).toHaveLength(14);
    for (const manifest of manifests) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (parsed.name === "@japp/evaluation-runner") {
        continue;
      }
      expect(
        Object.keys(parsed.dependencies ?? {}),
        `${manifest} must not depend on the evaluation runner`,
      ).not.toContain("@japp/evaluation-runner");
      expect(
        Object.keys(parsed.devDependencies ?? {}),
        `${manifest} must not depend on the evaluation runner`,
      ).not.toContain("@japp/evaluation-runner");
    }
  });

  it("keeps W04/fixture integration test-only and runtime ownership contract-only", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([
      "@japp/contracts",
    ]);
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual([
      "@japp/evaluation-baselines",
      "@japp/test-fixtures",
      "@types/node",
      "typescript",
      "vitest",
    ]);
  });

  it("keeps the production model lock and prompt registry at their pre-M05 placeholders", () => {
    const modelLock = JSON.parse(
      readFileSync(join(REPO_ROOT, "model", "model-lock.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(modelLock).sort()).toEqual([
      "locked",
      "note",
      "schema_version",
    ]);
    expect(modelLock.locked).toBe(false);
    expect(String(modelLock.note)).toContain("M05-W02");

    const promptRegistry = readFileSync(
      join(REPO_ROOT, "prompts", "registry.yaml"),
      "utf8",
    );
    expect(promptRegistry).toContain("schema_version: 1");
    expect(promptRegistry).toContain("prompts: []");
    expect(promptRegistry).not.toContain("baseline_prompt_one_shot_resume");
  });

  it("commits no generated result evidence, holdout body, or report golden", () => {
    const committedJson: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(PACKAGE_ROOT, relative), {
        withFileTypes: true,
      })) {
        if (entry.name === "node_modules" || entry.name === ".turbo") {
          continue;
        }
        const child =
          relative === "" ? entry.name : `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(child);
        } else if (child.endsWith(".json")) {
          committedJson.push(child);
        }
        expect(child).not.toMatch(
          /(?:^|\/)(?:holdout|results|reports)(?:\/|$)/iu,
        );
      }
    };
    walk("");
    expect(committedJson.sort()).toEqual(["package.json", "tsconfig.json"]);
  });
});

describe("M02-W05 static source boundary", () => {
  const forbidden: readonly {
    readonly label: string;
    readonly pattern: RegExp;
  }[] = [
    { label: "wall-clock identity", pattern: /Date\.now|new Date\s*\(/u },
    { label: "random identity", pattern: /Math\.random|randomUUID/u },
    { label: "environment-derived behavior", pattern: /process\.env/u },
    {
      label: "network fetch",
      pattern: /\bfetch\s*\(|XMLHttpRequest|WebSocket/u,
    },
    { label: "network modules", pattern: /node:(?:http|https|net|tls|dgram)/u },
    {
      label: "process execution",
      pattern: /child_process|\bexecFile?\s*\(|\bspawn\s*\(/u,
    },
    { label: "dynamic code", pattern: /\beval\s*\(|new Function\s*\(/u },
    { label: "CommonJS dynamic import", pattern: /\brequire\s*\(/u },
    {
      label: "product workspace dependency",
      pattern:
        /@japp\/(?:ats-adapters|domain|evaluation-baselines|form-engine|platform|resume-schema|security|test-fixtures|ui)/u,
    },
  ];

  it("has no network, provider, product, shell, randomness, or ambient-environment path", () => {
    for (const name of readdirSync(join(PACKAGE_ROOT, "src")).sort()) {
      const source = readFileSync(join(PACKAGE_ROOT, "src", name), "utf8");
      for (const rule of forbidden) {
        expect(
          rule.pattern.test(source),
          `src/${name} must not use ${rule.label}`,
        ).toBe(false);
      }
      expect(source).not.toContain("gate/decision");
      expect(source).not.toContain("critical-gates/");
      expect(source).not.toMatch(/writeFile|appendFile|createWriteStream/u);
    }
  });

  it("contains no serialized command, callback, endpoint, credential, or gate-authority request field", () => {
    const modelSource = readFileSync(
      join(PACKAGE_ROOT, "src", "model.ts"),
      "utf8",
    );
    const requestBlock = modelSource.slice(
      modelSource.indexOf("export interface ExecutionRequestV1"),
      modelSource.indexOf("export interface MeasuredMetricV1"),
    );
    expect(requestBlock).not.toMatch(
      /command|callback|endpoint|credential|password|employer_url|gate_state|gate_pass|gate_authority/iu,
    );
  });
});
