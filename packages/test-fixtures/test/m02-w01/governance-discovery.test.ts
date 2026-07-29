import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { EXPECTED_M02_TEST_COUNT, M02_TEST_FILES } from "../../src/cli.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import { SCHEMA_REFS } from "../../src/model.ts";
import {
  FIXTURE_SCHEMAS_ROOT,
  fixtureSchemaValidator,
} from "../../src/schema-catalog.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

describe("M02-W01 fail-closed discovery and ownership", () => {
  test("eagerly compiles the exact eleven-schema test-only catalog", () => {
    expect(() => fixtureSchemaValidator()).not.toThrow();
    expect(
      readdirSync(join(FIXTURE_SCHEMAS_ROOT, "test-fixture")).sort(),
    ).toEqual([
      "common.v1.schema.json",
      "evidence-artifact.v1.schema.json",
      "expected-requirement.v1.schema.json",
      "expected-supported-claim.v1.schema.json",
      "field-value-policy.v1.schema.json",
      "manifest.v1.schema.json",
      "scenario-bundle.v1.schema.json",
      "source-resume.v1.schema.json",
      "synthetic-job.v1.schema.json",
      "synthetic-profile.v1.schema.json",
      "unsupported-gap.v1.schema.json",
    ]);
  });

  test("locks all ten fixture schema identifiers to explicit v1 roots", () => {
    expect(Object.values(SCHEMA_REFS)).toEqual([
      "urn:japp:schema:test-fixture:evidence-artifact:v1",
      "urn:japp:schema:test-fixture:expected-requirement:v1",
      "urn:japp:schema:test-fixture:expected-supported-claim:v1",
      "urn:japp:schema:test-fixture:field-value-policy:v1",
      "urn:japp:schema:test-fixture:manifest:v1",
      "urn:japp:schema:test-fixture:scenario-bundle:v1",
      "urn:japp:schema:test-fixture:source-resume:v1",
      "urn:japp:schema:test-fixture:synthetic-job:v1",
      "urn:japp:schema:test-fixture:synthetic-profile:v1",
      "urn:japp:schema:test-fixture:unsupported-gap:v1",
    ]);
  });

  test("labels this corpus mutable development data with no holdout body", () => {
    const manifest = loadFixtureCorpus().manifest;
    expect(manifest.corpus_state).toBe("DEVELOPMENT_MUTABLE");
    expect(manifest.holdout_content_present).toBe(false);
    expect(manifest.corpus_version).toBe("0.1.0");
  });

  test("discovers exactly five focused files and requires exactly fifty tests", () => {
    const actual = readdirSync(join(PACKAGE_ROOT, "test", "m02-w01")).sort();
    expect(actual).toEqual([...M02_TEST_FILES].sort());
    expect(EXPECTED_M02_TEST_COUNT).toBe(50);
    const forbidden = [
      ["pass", "WithNoTests"].join(""),
      ["--pass", "-with-no-tests"].join(""),
      ["test", ".only"].join(""),
      ["describe", ".skip"].join(""),
    ];
    const source = actual
      .map((file) =>
        readFileSync(join(PACKAGE_ROOT, "test", "m02-w01", file), "utf8"),
      )
      .join("\n");
    expect(forbidden.filter((token) => source.includes(token))).toEqual([]);
  });

  test("keeps the fixture package outside every product dependency graph", () => {
    const workspaceRoots = ["apps", "packages"];
    const consumers: string[] = [];
    for (const workspaceRoot of workspaceRoots) {
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
    expect(consumers).toEqual([]);
    expect(readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8")).toContain(
      "test/evaluation data only",
    );
  });
});
