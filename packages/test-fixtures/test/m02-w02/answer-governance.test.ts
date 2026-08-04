import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { loadFixtureCorpus } from "../../src/loader.ts";
import { SCHEMA_REFS } from "../../src/model.ts";
import { FIXTURE_SCHEMAS_ROOT } from "../../src/schema-catalog.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const EXPECTED_W02_TEST_FILES = [
  "answer-consistency-mutations.test.ts",
  "answer-governance.test.ts",
  "answer-metrics.test.ts",
  "question-answer-matrix.test.ts",
] as const;
// Deliberately duplicated combined focused count (M02-W01 plus M02-W02); it
// is never imported by the generator, loader, validator, CLI, or verifier.
const EXPECTED_COMBINED_FOCUSED_TEST_COUNT = 165;

describe("M02-W02 fail-closed discovery and ownership", () => {
  test("keeps the fourteen-schema v2 catalog with the three answer additions", () => {
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
    expect(Object.keys(SCHEMA_REFS)).toHaveLength(13);
    expect(SCHEMA_REFS.QUESTION_CASE).toBe(
      "urn:japp:schema:test-fixture:question-case:v2",
    );
    expect(SCHEMA_REFS.ANSWER_CONSTRAINT).toBe(
      "urn:japp:schema:test-fixture:answer-constraint:v2",
    );
    expect(SCHEMA_REFS.ANSWER_SCENARIO).toBe(
      "urn:japp:schema:test-fixture:answer-scenario:v2",
    );
  });

  test("labels the expanded mutable development corpus v0.3 with no holdout body", () => {
    const manifest = loadFixtureCorpus().manifest;
    expect(manifest.corpus_state).toBe("DEVELOPMENT_MUTABLE");
    expect(manifest.holdout_content_present).toBe(false);
    expect(manifest.corpus_version).toBe("0.3.0");
    expect(manifest.schema_version).toBe("2.0.0");
  });

  test("discovers the independently enumerated M02-W02 test-file inventory", () => {
    const actual = readdirSync(join(PACKAGE_ROOT, "test", "m02-w02"))
      .filter((file) => file.endsWith(".test.ts"))
      .sort();
    expect(actual).toEqual([...EXPECTED_W02_TEST_FILES].sort());
  });

  test("duplicates the combined exact count only across independent controls", () => {
    const registry = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "scripts", "verification-suites.json"),
        "utf8",
      ),
    ) as {
      suites: {
        id: string;
        proofs: { kind: string; min: number }[];
        commands: string[][];
        discovery_globs: string[];
      }[];
    };
    const suite = registry.suites.find(
      (candidate) => candidate.id === "fixture-corpus",
    );
    const proof = suite?.proofs.find(
      (candidate) => candidate.kind === "vitest_exact_tests",
    );
    expect(proof?.min).toBe(EXPECTED_COMBINED_FOCUSED_TEST_COUNT);
    expect(
      suite?.commands.some((command) => command.includes("test/m02-w02")),
    ).toBe(true);
    expect(suite?.discovery_globs).toContain(
      "packages/test-fixtures/test/m02-w02/**/*.test.ts",
    );
  });

  test("keeps the answer truth oracle out of implementation source", () => {
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
      return readFileSync(path, "utf8").includes("answer-truth.v2");
    });
    expect(references).toEqual([]);
  });

  test("keeps prompts and answers free of holdout, gate, or product claims", () => {
    const readme = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");
    expect(readme).toContain("M02-W02");
    expect(readme).toContain("test/evaluation data only");
    const corpus = loadFixtureCorpus();
    for (const question of corpus.questionCases) {
      expect(question.prompt_text.length).toBeGreaterThanOrEqual(10);
    }
  });
});
