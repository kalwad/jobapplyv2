import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
} from "./compatibility-signature.ts";
import { BaselineError, loadBaseline, updateBaseline } from "./baseline.ts";
import { canonicalJson } from "../adapters/normalization.ts";

function check(): number {
  const baseline = loadBaseline();
  const report = compareCompatibilitySignatures(
    baseline.signature,
    buildCompatibilitySignature(),
  );
  process.stdout.write(`${canonicalJson(report)}\n`);
  return report.compatible ? 0 : 1;
}

try {
  if (process.argv.length !== 3) {
    process.exitCode = 2;
  } else if (process.argv[2] === "--check") {
    process.exitCode = check();
  } else if (process.argv[2] === "--update-baseline") {
    updateBaseline();
    process.stdout.write("updated executable compatibility baseline\n");
  } else {
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof BaselineError ? error.code : "COMPATIBILITY_TOOL_FAILED"}\n`,
  );
  process.exitCode = 2;
}
