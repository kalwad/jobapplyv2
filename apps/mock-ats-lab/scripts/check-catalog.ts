// Deterministic catalog/manifest check for the mock ATS lab (M02-W03).
//
// Recomputes the canonical catalog digest and verifies it against the
// committed catalog.manifest.json, and proves every catalog route has a
// real HTML entry. Read-only; exits nonzero on any mismatch.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";

import {
  canonicalCatalogSerialization,
  CATALOG_SCHEMA_VERSION,
  CATALOG_VERSION,
  FIXTURE_CASES,
  FIXTURE_ROUTES,
} from "../site/src/catalog/cases.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(packageRoot, "catalog.manifest.json");

const digest = createHash("sha256")
  .update(canonicalCatalogSerialization(), "utf8")
  .digest("hex");

const failures: string[] = [];

for (const route of FIXTURE_ROUTES) {
  const entry = join(
    packageRoot,
    "site",
    ...route.split("/").filter((part) => part !== ""),
    "index.html",
  );
  if (!existsSync(entry)) {
    failures.push(`route ${route} has no HTML entry at ${entry}`);
  }
}

interface Manifest {
  readonly catalogVersion: string;
  readonly schemaVersion: number;
  readonly caseCount: number;
  readonly routeCount: number;
  readonly sha256: string;
}

let manifest: Manifest | undefined;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
} catch (error) {
  failures.push(`catalog.manifest.json unreadable: ${String(error)}`);
}

if (manifest !== undefined) {
  if (manifest.catalogVersion !== CATALOG_VERSION) {
    failures.push(
      `manifest catalogVersion ${manifest.catalogVersion} != ${CATALOG_VERSION}`,
    );
  }
  if (manifest.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    failures.push(
      `manifest schemaVersion ${String(manifest.schemaVersion)} != ${String(CATALOG_SCHEMA_VERSION)}`,
    );
  }
  if (manifest.caseCount !== FIXTURE_CASES.length) {
    failures.push(
      `manifest caseCount ${String(manifest.caseCount)} != ${String(FIXTURE_CASES.length)}`,
    );
  }
  if (manifest.routeCount !== FIXTURE_ROUTES.length) {
    failures.push(
      `manifest routeCount ${String(manifest.routeCount)} != ${String(FIXTURE_ROUTES.length)}`,
    );
  }
  if (manifest.sha256 !== digest) {
    failures.push(`manifest sha256 ${manifest.sha256} != computed ${digest}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`catalog:check FAIL — ${failure}`);
  }
  process.exit(1);
}

console.log(
  `catalog:check OK — v${CATALOG_VERSION} (schema ${String(CATALOG_SCHEMA_VERSION)}), ` +
    `${String(FIXTURE_CASES.length)} cases, ${String(FIXTURE_ROUTES.length)} routes, sha256 ${digest}`,
);
