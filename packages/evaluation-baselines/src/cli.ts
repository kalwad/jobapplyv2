// Explicit check/write entry point for the baseline manifest (M02-W04).
//
//   node src/cli.ts check   read-only: recompute digests, fail on any drift
//   node src/cli.ts write   explicit authoring: rewrite baseline.manifest.json
//
// Check mode never writes a byte. Write mode touches exactly the manifest
// file and nothing else; committed observation records and the catalog are
// authored in source, never rewritten by tooling.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import console from "node:console";
import process from "node:process";

import {
  checkBaselineManifest,
  computeBaselineManifest,
  manifestFileBytes,
  MANIFEST_FILE,
  PACKAGE_ROOT,
} from "./manifest.ts";

const mode = process.argv[2];

if (mode === "check") {
  const failures = checkBaselineManifest();
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 20)) {
      console.error(`baselines:check FAIL — ${failure}`);
    }
    process.exit(1);
  }
  const manifest = computeBaselineManifest();
  console.log(
    `baselines:check OK — catalog v${manifest.catalog_version} (schema ${String(
      manifest.catalog_schema_version,
    )}), ${String(manifest.case_count)} cases, ${String(
      manifest.legacy_observation_file.record_count,
    )} legacy observation records, combined ${manifest.combined_digest}`,
  );
} else if (mode === "write") {
  const manifest = computeBaselineManifest();
  writeFileSync(join(PACKAGE_ROOT, MANIFEST_FILE), manifestFileBytes(manifest));
  console.log(
    `baselines:write OK — wrote ${MANIFEST_FILE} (combined ${manifest.combined_digest})`,
  );
} else {
  console.error("usage: node src/cli.ts <check|write>");
  process.exit(2);
}
