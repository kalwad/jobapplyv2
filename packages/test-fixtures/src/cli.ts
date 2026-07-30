import { lstatSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertFixtureConsistency } from "./consistency.ts";
import { safeUnknownErrorMessage } from "./diagnostics.ts";
import { loadFixtureCorpus } from "./loader.ts";
import { assertCommittedPlatformVersions } from "./platform-version-guard.ts";
import { assertCommittedFixturePrivacy } from "./privacy.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));

function count(value: number): string {
  return String(value);
}

function validate(): void {
  const corpus = loadFixtureCorpus();
  assertFixtureConsistency(corpus);
  console.log(
    `fixture validation passed: ${count(corpus.profiles.length)} profiles, ${count(corpus.evidenceArtifacts.length)} evidence artifacts, ${count(corpus.sourceResumes.length)} resumes, ${count(corpus.jobs.length)} jobs, ${count(corpus.expectedRequirements.length)} requirements, ${count(corpus.scenarioBundles.length)} scenarios/${count(corpus.manifest.counts.scenario_evaluations)} evaluations, ${count(corpus.expectedSupportedClaims.length)} claims, ${count(corpus.unsupportedGaps.length)} gaps, ${count(corpus.fieldValuePolicies.length)} policies`,
  );
}

function privacy(): void {
  const report = assertCommittedFixturePrivacy();
  console.log(
    `fixture privacy passed: ${count(report.filesScanned)} files and ${count(report.fieldsScanned)} scalar fields in the committed producer surface (src/test excluded); no real-looking PII, secrets, local identities, hidden text, or prompt injection`,
  );
}

function platformV1(): void {
  const report = assertCommittedPlatformVersions();
  console.log(
    `fixture platform-version guard passed: derived ${count(report.deprecatedRoots.length)} deprecated v1/v2 sibling roots and scanned ${count(report.filesScanned)} producer files`,
  );
}

function discover(): void {
  const root = join(PACKAGE_ROOT, "test", "m02-w01");
  const testFiles = readdirSync(root)
    .filter((file) => file.endsWith(".test.ts"))
    .sort();
  if (testFiles.length === 0) {
    throw new Error("M02 test discovery failed: no focused test files");
  }
  for (const file of testFiles) {
    const stats = lstatSync(join(root, file));
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(
        `M02 test discovery failed: ${file} is not a regular file`,
      );
    }
  }
  const corpus = loadFixtureCorpus();
  const fixtureRecords =
    corpus.profiles.length +
    corpus.evidenceArtifacts.length +
    corpus.sourceResumes.length +
    corpus.jobs.length +
    corpus.expectedRequirements.length +
    corpus.expectedSupportedClaims.length +
    corpus.unsupportedGaps.length +
    corpus.fieldValuePolicies.length +
    corpus.scenarioBundles.length;
  console.log(
    `fixture discovery passed: 9 non-empty collections, ${count(fixtureRecords)} records, ${count(corpus.manifest.counts.scenario_evaluations)} scenario evaluations, ${count(testFiles.length)} focused test files; exact zero-skip count is enforced independently by the root verification registry`,
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new Error(
      "usage: node src/cli.ts <validate|privacy|platform-v1|discover>",
    );
  }
  switch (args[0]) {
    case "validate":
      validate();
      break;
    case "privacy":
      privacy();
      break;
    case "platform-v1":
      platformV1();
      break;
    case "discover":
      discover();
      break;
    default:
      throw new Error(
        "usage: node src/cli.ts <validate|privacy|platform-v1|discover>",
      );
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  try {
    main();
  } catch {
    console.error(`fixture command failed: ${safeUnknownErrorMessage()}`);
    process.exitCode = 1;
  }
}
