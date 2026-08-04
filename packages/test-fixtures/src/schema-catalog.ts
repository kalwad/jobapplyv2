import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createContractValidator,
  loadSchemaCatalog,
  type ContractValidator,
} from "@japp/contracts";

export const FIXTURE_SCHEMAS_ROOT = fileURLToPath(
  new URL("../schemas/", import.meta.url),
);

let cachedValidator: ContractValidator | undefined;

const EXPECTED_SCHEMA_FILES = [
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
] as const;

function verifyFixtureSchemaInventory(): void {
  try {
    const root = lstatSync(FIXTURE_SCHEMAS_ROOT);
    const fixtureRoot = join(FIXTURE_SCHEMAS_ROOT, "test-fixture");
    const fixtureStats = lstatSync(fixtureRoot);
    if (
      root.isSymbolicLink() ||
      !root.isDirectory() ||
      fixtureStats.isSymbolicLink() ||
      !fixtureStats.isDirectory() ||
      readdirSync(FIXTURE_SCHEMAS_ROOT).join("\n") !== "test-fixture"
    ) {
      throw new Error("invalid fixture schema directory");
    }
    const actual = readdirSync(fixtureRoot).sort();
    if (actual.join("\n") !== [...EXPECTED_SCHEMA_FILES].sort().join("\n")) {
      throw new Error("fixture schema inventory drift");
    }
    for (const file of actual) {
      const stats = lstatSync(join(fixtureRoot, file));
      if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink > 1) {
        throw new Error("fixture schema file is not a unique regular file");
      }
    }
  } catch {
    throw new Error(
      "fixture schema inventory must contain exactly fourteen regular non-link files",
    );
  }
}

export function fixtureSchemaValidator(): ContractValidator {
  verifyFixtureSchemaInventory();
  cachedValidator ??= createContractValidator(
    loadSchemaCatalog({ schemasRoot: FIXTURE_SCHEMAS_ROOT }),
  );
  return cachedValidator;
}
