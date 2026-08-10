import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { loadFixtureCorpus } from "../../src/loader.ts";
import { SCHEMA_REFS } from "../../src/model.ts";
import {
  FIXTURE_SCHEMAS_ROOT,
  fixtureSchemaValidator,
} from "../../src/schema-catalog.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const EXPECTED_TEST_FILES = [
  "consistency-mutations.test.ts",
  "corpus-positive.test.ts",
  "generator-check-mode.test.ts",
  "governance-discovery.test.ts",
  "loader-mutations.test.ts",
  "privacy-security.test.ts",
  "resigned-contradictions.test.ts",
  "semantic-matrices.test.ts",
] as const;
// This test-layer value is deliberately duplicated, not imported by the
// generator, loader, validator, CLI, or root verifier. Since M02-W02 the
// registry proof counts the combined m02-w01 plus m02-w02 focused suites.
const EXPECTED_FOCUSED_TEST_COUNT = 165;

describe("M02-W01 fail-closed discovery and ownership", () => {
  test("eagerly compiles the exact fourteen-schema v2 test-only catalog", () => {
    expect(() => fixtureSchemaValidator()).not.toThrow();
    expect(
      readdirSync(join(FIXTURE_SCHEMAS_ROOT, "test-fixture")).sort(),
    ).toEqual([
      "answer-constraint.v2.schema.json",
      "answer-scenario.v2.schema.json",
      "common.v2.schema.json",
      "evidence-artifact.v2.schema.json",
      "expected-requirement.v2.schema.json",
      "expected-supported-claim.v2.schema.json",
      "field-value-policy.v2.schema.json",
      "manifest.v2.schema.json",
      "question-case.v2.schema.json",
      "scenario-bundle.v2.schema.json",
      "source-resume.v2.schema.json",
      "synthetic-job.v2.schema.json",
      "synthetic-profile.v2.schema.json",
      "unsupported-gap.v2.schema.json",
    ]);
  });

  test("locks all thirteen fixture schema identifiers to explicit v2 roots", () => {
    expect(Object.values(SCHEMA_REFS)).toEqual([
      "urn:japp:schema:test-fixture:answer-constraint:v2",
      "urn:japp:schema:test-fixture:answer-scenario:v2",
      "urn:japp:schema:test-fixture:evidence-artifact:v2",
      "urn:japp:schema:test-fixture:expected-requirement:v2",
      "urn:japp:schema:test-fixture:expected-supported-claim:v2",
      "urn:japp:schema:test-fixture:field-value-policy:v2",
      "urn:japp:schema:test-fixture:manifest:v2",
      "urn:japp:schema:test-fixture:question-case:v2",
      "urn:japp:schema:test-fixture:scenario-bundle:v2",
      "urn:japp:schema:test-fixture:source-resume:v2",
      "urn:japp:schema:test-fixture:synthetic-job:v2",
      "urn:japp:schema:test-fixture:synthetic-profile:v2",
      "urn:japp:schema:test-fixture:unsupported-gap:v2",
    ]);
  });

  test("labels the mutable development corpus with no holdout body", () => {
    const manifest = loadFixtureCorpus().manifest;
    expect(manifest.corpus_state).toBe("DEVELOPMENT_MUTABLE");
    expect(manifest.holdout_content_present).toBe(false);
    expect(manifest.corpus_version).toBe("0.3.0");
    expect(manifest.schema_version).toBe("2.0.0");
  });

  test("discovers the independently enumerated focused test-file inventory", () => {
    const actual = readdirSync(join(PACKAGE_ROOT, "test", "m02-w01"))
      .filter((file) => file.endsWith(".test.ts"))
      .sort();
    expect(actual).toEqual([...EXPECTED_TEST_FILES].sort());
  });

  test("duplicates the exact count only across independent test and verifier controls", () => {
    const registry = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "scripts", "verification-suites.json"),
        "utf8",
      ),
    ) as {
      suites: {
        id: string;
        proofs: { kind: string; min: number }[];
      }[];
    };
    const suite = registry.suites.find(
      (candidate) => candidate.id === "fixture-corpus",
    );
    const proof = suite?.proofs.find(
      (candidate) => candidate.kind === "vitest_exact_tests",
    );
    expect(proof?.min).toBe(EXPECTED_FOCUSED_TEST_COUNT);
  });

  test("keeps the independent truth oracle out of implementation source", () => {
    const implementationFiles = [
      ...readdirSync(join(PACKAGE_ROOT, "src")).filter((file) =>
        file.endsWith(".ts"),
      ),
      ...readdirSync(join(PACKAGE_ROOT, "scripts"))
        .filter((file) => file.endsWith(".ts"))
        .map((file) => `../scripts/${file}`),
    ];
    const references = implementationFiles.filter((file) => {
      const path = file.startsWith("../scripts/")
        ? join(PACKAGE_ROOT, file.slice(3))
        : join(PACKAGE_ROOT, "src", file);
      return readFileSync(path, "utf8").includes("development-truth.v2");
    });
    expect(references).toEqual([]);
  });

  test("keeps the fixture package outside every product dependency graph", () => {
    const consumers: string[] = [];
    for (const workspaceRoot of ["apps", "packages"]) {
      for (const entry of readdirSync(join(REPO_ROOT, workspaceRoot), {
        withFileTypes: true,
      })) {
        if (!entry.isDirectory() || entry.name === "test-fixtures") {
          continue;
        }
        const manifestPath = join(
          REPO_ROOT,
          workspaceRoot,
          entry.name,
          "package.json",
        );
        try {
          if (
            readFileSync(manifestPath, "utf8").includes("@japp/test-fixtures")
          ) {
            consumers.push(`${workspaceRoot}/${entry.name}`);
          }
        } catch {
          continue;
        }
      }
    }
    // The exact reviewed consumers are the M02-W04 baseline owner and the
    // M02-W05 runner's development-only integration proof. Both must remain
    // private, explicitly NON_PRODUCTION evaluation packages; no product
    // package may consume fixtures. The exact NON_PRODUCTION token is the
    // pre-W05 invariant and must not be weakened to a generic word.
    expect(consumers).toEqual([
      "packages/evaluation-baselines",
      "packages/evaluation-runner",
    ]);
    const expected = new Map([
      ["evaluation-baselines", "@japp/evaluation-baselines"],
      ["evaluation-runner", "@japp/evaluation-runner"],
    ]);
    for (const [directory, name] of expected) {
      const consumerManifest = JSON.parse(
        readFileSync(
          join(REPO_ROOT, "packages", directory, "package.json"),
          "utf8",
        ),
      ) as { name?: string; private?: boolean; description?: string };
      expect(consumerManifest.name).toBe(name);
      expect(consumerManifest.private).toBe(true);
      expect(consumerManifest.description).toContain("NON_PRODUCTION");
      expect(consumerManifest.description?.toLowerCase()).toContain(
        "evaluation",
      );
    }
    expect(readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8")).toContain(
      "test/evaluation data only",
    );
  });
});
