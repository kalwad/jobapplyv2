import {
  checkCorpus,
  checkPublicPrivacy,
  computeCorpus,
  writeCorpus,
} from "./corpus.ts";
import { checkHoldoutLogHistory } from "./log.ts";
import {
  exportSanitizedManifest,
  HoldoutBoundaryError,
  verifyExportedManifest,
  verifyOwnerHoldout,
} from "./owner-holdout.ts";

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error("CLI_ARGUMENT_REQUIRED");
  return value;
}

function receipt(snapshot: ReturnType<typeof verifyOwnerHoldout>): string {
  return [
    "HOLDOUT_VERIFIED",
    `manifest_id=${snapshot.manifest.manifest_id}`,
    `manifest_digest=${snapshot.manifest.manifest_digest}`,
    `case_count=${String(snapshot.verified_case_count)}`,
    `case_file_count=${String(snapshot.verified_case_file_count)}`,
    `artifact_count=${String(snapshot.verified_artifact_count)}`,
    `case_file_bytes=${String(snapshot.verified_case_file_bytes)}`,
    `artifact_bytes=${String(snapshot.verified_artifact_bytes)}`,
    `total_bytes=${String(snapshot.verified_total_bytes)}`,
    `receipt_digest=${snapshot.receipt_digest}`,
  ].join(" ");
}

function main(): void {
  const command = process.argv[2];
  if (command === "corpus-write") {
    console.log(
      `CORPUS_${writeCorpus()} id=${computeCorpus().manifest.corpus_id} version=${computeCorpus().manifest.corpus_version}`,
    );
  } else if (command === "corpus-check") {
    checkCorpus();
    const { manifest } = computeCorpus();
    console.log(
      `CORPUS_OK id=${manifest.corpus_id} version=${manifest.corpus_version} digest=${manifest.corpus_digest}`,
    );
  } else if (command === "coverage-check") {
    checkCorpus();
    const { coverage } = computeCorpus();
    console.log(
      `COVERAGE_OK digest=${coverage.coverage_digest} raw_metrics=${String(Object.keys(coverage.raw_counts).length)}`,
    );
  } else if (command === "privacy-check") {
    checkPublicPrivacy();
    console.log("CORPUS_PRIVACY_OK");
  } else if (command === "log-check") {
    checkHoldoutLogHistory();
    console.log("HOLDOUT_LOG_OK");
  } else if (command === "holdout-export") {
    console.log(receipt(exportSanitizedManifest(option("--output"))));
  } else if (command === "holdout-verify") {
    console.log(receipt(verifyExportedManifest(option("--manifest"))));
  } else throw new Error("CLI_COMMAND_INVALID");
}

try {
  main();
} catch (error) {
  const code =
    error instanceof HoldoutBoundaryError
      ? error.code
      : error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";
  console.error(`EVALUATION_CORPUS_ERROR ${code}`);
  process.exitCode = 1;
}
