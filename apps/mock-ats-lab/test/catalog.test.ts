// Catalog integrity for the mock ATS lab (M02-W03): schema/version shape,
// unique stable identity, complete required-surface inventory, real HTML
// entries for every route, and the committed manifest digest.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  canonicalCatalogSerialization,
  CATALOG_SCHEMA_VERSION,
  CATALOG_VERSION,
  FIXTURE_CASES,
  FIXTURE_ROUTES,
  type SurfaceTag,
} from "../site/src/catalog/cases.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Test-owned copy of the complete required-surface vocabulary. */
const REQUIRED_SURFACES: readonly SurfaceTag[] = [
  "aria-combobox",
  "aria-listbox",
  "captcha-pause",
  "catalog-index",
  "confirmation-review",
  "cross-field-validation",
  "custom-validation",
  "date-widget",
  "delayed-insertion",
  "delayed-receipt",
  "delayed-rerender",
  "delayed-validation",
  "dependent-required",
  "duplicate-warning",
  "dynamic-insertion",
  "dynamic-removal",
  "file-upload",
  "honeypot",
  "iframe",
  "multipage-flow",
  "native-controls",
  "native-validation",
  "node-replacement",
  "phone-widget",
  "prompt-injection",
  "react-controlled",
  "required-optional",
  "rerender-persistence",
  "reset",
  "sensitive-fields",
  "shadow-dom",
  "site-rewrite",
  "stable-identity",
  "stale-dom-rejection",
  "validation-blocked-navigation",
  "virtualized-listbox",
  "vue-controlled",
];

describe("catalog schema and versioning", () => {
  it("carries the reviewed catalog and schema versions", () => {
    expect(CATALOG_VERSION).toBe("1.0.0");
    expect(CATALOG_SCHEMA_VERSION).toBe(1);
  });

  it("declares synthetic provenance on every case", () => {
    for (const entry of FIXTURE_CASES) {
      expect(entry.syntheticData).toBe(true);
      expect(entry.provenance.author).toContain("M02-W03");
      expect(entry.provenance.reviewer).toContain("M02-W03");
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });
});

describe("catalog identity", () => {
  it("has unique, stable, well-formed case IDs in sorted order", () => {
    const ids = FIXTURE_CASES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^MAL-[A-Z]{3}-\d{3}$/);
    }
    expect([...ids].sort((a, b) => (a < b ? -1 : 1))).toEqual(ids);
  });

  it("uses only routes with a real committed HTML entry", () => {
    for (const entry of FIXTURE_CASES) {
      expect(entry.route.startsWith("/")).toBe(true);
      expect(entry.route.endsWith("/")).toBe(true);
    }
    for (const route of FIXTURE_ROUTES) {
      const parts = route.split("/").filter((part) => part !== "");
      const file = join(packageRoot, "site", ...parts, "index.html");
      expect(existsSync(file), `missing HTML entry for ${route}`).toBe(true);
    }
  });

  it("matches the committed case and route counts", () => {
    expect(FIXTURE_CASES.length).toBe(32);
    expect(FIXTURE_ROUTES.length).toBe(16);
  });
});

describe("required surface inventory", () => {
  it("covers every required surface with at least one case", () => {
    const covered = new Set<SurfaceTag>(
      FIXTURE_CASES.flatMap((entry) => [...entry.surfaces]),
    );
    for (const surface of REQUIRED_SURFACES) {
      expect(covered.has(surface), `no case covers ${surface}`).toBe(true);
    }
  });

  it("gives every case at least one surface tag", () => {
    for (const entry of FIXTURE_CASES) {
      expect(entry.surfaces.length).toBeGreaterThan(0);
    }
  });
});

describe("catalog manifest digest", () => {
  it("matches the committed catalog.manifest.json exactly", () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, "catalog.manifest.json"), "utf8"),
    ) as {
      catalogVersion: string;
      schemaVersion: number;
      caseCount: number;
      routeCount: number;
      sha256: string;
    };
    const digest = createHash("sha256")
      .update(canonicalCatalogSerialization(), "utf8")
      .digest("hex");
    expect(manifest.catalogVersion).toBe(CATALOG_VERSION);
    expect(manifest.schemaVersion).toBe(CATALOG_SCHEMA_VERSION);
    expect(manifest.caseCount).toBe(FIXTURE_CASES.length);
    expect(manifest.routeCount).toBe(FIXTURE_ROUTES.length);
    expect(manifest.sha256).toBe(digest);
  });

  it("serializes canonically and deterministically", () => {
    expect(canonicalCatalogSerialization()).toBe(
      canonicalCatalogSerialization(),
    );
    const parsed = JSON.parse(canonicalCatalogSerialization()) as {
      cases: unknown[];
    };
    expect(parsed.cases.length).toBe(FIXTURE_CASES.length);
  });
});
