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
      "fixture schema inventory must contain exactly eleven regular non-link files",
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
