// Versioned deterministic fixture-case catalog for the mock ATS lab
// (M02-W03, spec §8.2). This module is pure data: page code renders only
// case identity from it, and the committed catalog.manifest.json pins its
// canonical SHA-256 digest. Expected state transitions deliberately live on
// the test side (e2e/mock-ats-lab/support/expected-transitions.ts) so no
// expected result leaks into the served DOM.

/** Catalog schema major version; bump only with a reviewed change. */
export const CATALOG_SCHEMA_VERSION = 1;

/** Content version of the committed case set. */
export const CATALOG_VERSION = "1.0.0";

/** Surfaces a fixture case exercises (finite reviewed vocabulary). */
export type SurfaceTag =
  | "aria-combobox"
  | "aria-listbox"
  | "captcha-pause"
  | "catalog-index"
  | "confirmation-review"
  | "cross-field-validation"
  | "custom-validation"
  | "date-widget"
  | "delayed-insertion"
  | "delayed-receipt"
  | "delayed-rerender"
  | "delayed-validation"
  | "dependent-required"
  | "duplicate-warning"
  | "dynamic-insertion"
  | "dynamic-removal"
  | "file-upload"
  | "honeypot"
  | "iframe"
  | "multipage-flow"
  | "native-controls"
  | "native-validation"
  | "node-replacement"
  | "phone-widget"
  | "prompt-injection"
  | "react-controlled"
  | "required-optional"
  | "rerender-persistence"
  | "reset"
  | "sensitive-fields"
  | "shadow-dom"
  | "site-rewrite"
  | "stable-identity"
  | "stale-dom-rejection"
  | "validation-blocked-navigation"
  | "virtualized-listbox"
  | "vue-controlled";

export interface FixtureCase {
  /** Stable case identity; never renumbered. */
  readonly id: string;
  /** Human title shown on the catalog index. */
  readonly title: string;
  /** Deterministic route serving the case. */
  readonly route: string;
  /** Surface categories the case exercises. */
  readonly surfaces: readonly SurfaceTag[];
  /** Authoring provenance (synthetic fixture, single implementation pass). */
  readonly provenance: {
    readonly author: string;
    readonly reviewer: string;
  };
  /** Every value in the lab is synthetic reserved data. */
  readonly syntheticData: true;
}

const PROVENANCE = {
  author: "M02-W03 implementation agent (Claude Fable 5 Max)",
  reviewer: "M02-W03 finite package review",
} as const;

const fixtureCase = (
  id: string,
  title: string,
  route: string,
  surfaces: readonly SurfaceTag[],
): FixtureCase => ({
  id,
  title,
  route,
  surfaces,
  provenance: PROVENANCE,
  syntheticData: true,
});

/** The committed v1 case set, ordered by case ID. */
export const FIXTURE_CASES: readonly FixtureCase[] = [
  fixtureCase(
    "MAL-CBX-001",
    "ARIA combobox with filtering and empty state",
    "/combobox/",
    ["aria-combobox", "custom-validation"],
  ),
  fixtureCase(
    "MAL-CBX-002",
    "ARIA listbox with keyboard selection",
    "/combobox/",
    ["aria-listbox"],
  ),
  fixtureCase(
    "MAL-DTP-001",
    "Composite date widget with normalization",
    "/datephone/",
    ["date-widget", "custom-validation"],
  ),
  fixtureCase(
    "MAL-DTP-002",
    "Composite phone widget with normalization",
    "/datephone/",
    ["phone-widget", "custom-validation"],
  ),
  fixtureCase(
    "MAL-DYN-001",
    "Conditional insertion, removal, dependent required",
    "/dynamic/",
    ["dynamic-insertion", "dynamic-removal", "dependent-required"],
  ),
  fixtureCase("MAL-DYN-002", "Delayed deterministic insertion", "/dynamic/", [
    "delayed-insertion",
  ]),
  fixtureCase(
    "MAL-DYN-003",
    "Node replacement beside a stable control",
    "/dynamic/",
    ["node-replacement", "stable-identity"],
  ),
  fixtureCase(
    "MAL-FLW-001",
    "Three-step application flow with persistence",
    "/apply/step-1/",
    ["multipage-flow", "required-optional"],
  ),
  fixtureCase(
    "MAL-FLW-002",
    "Validation-blocked step navigation",
    "/apply/step-1/",
    ["validation-blocked-navigation", "native-validation"],
  ),
  fixtureCase(
    "MAL-FLW-003",
    "CAPTCHA placeholder pause before review",
    "/apply/step-3/",
    ["captcha-pause"],
  ),
  fixtureCase(
    "MAL-FLW-004",
    "Confirmation review of persisted answers",
    "/apply/review/",
    ["confirmation-review", "multipage-flow"],
  ),
  fixtureCase(
    "MAL-FLW-005",
    "Deterministic delayed local receipt",
    "/apply/review/",
    ["delayed-receipt"],
  ),
  fixtureCase(
    "MAL-FLW-006",
    "Duplicate application warning",
    "/apply/review/",
    ["duplicate-warning"],
  ),
  fixtureCase(
    "MAL-FLW-007",
    "Deterministic lab state reset",
    "/apply/receipt/",
    ["reset"],
  ),
  fixtureCase(
    "MAL-FLW-008",
    "Inert prompt-injection job description",
    "/apply/step-1/",
    ["prompt-injection"],
  ),
  fixtureCase(
    "MAL-FRM-001",
    "Same-origin iframe application section",
    "/frames/",
    ["iframe", "native-validation"],
  ),
  fixtureCase("MAL-IDX-001", "Catalog index of every fixture case", "/", [
    "catalog-index",
  ]),
  fixtureCase("MAL-NAT-001", "Native control matrix", "/native/", [
    "native-controls",
    "required-optional",
  ]),
  fixtureCase("MAL-NAT-002", "Native validation behavior", "/native/", [
    "native-validation",
  ]),
  fixtureCase(
    "MAL-NAT-003",
    "Sensitive and consequential native fields",
    "/native/",
    ["sensitive-fields"],
  ),
  fixtureCase(
    "MAL-NAT-004",
    "Hidden honeypot that rejects when populated",
    "/native/",
    ["honeypot"],
  ),
  fixtureCase("MAL-NAT-005", "Inert prompt-injection help text", "/native/", [
    "prompt-injection",
  ]),
  fixtureCase(
    "MAL-REA-001",
    "React-controlled group surviving rerender",
    "/react/",
    ["react-controlled", "rerender-persistence"],
  ),
  fixtureCase(
    "MAL-REA-002",
    "React rejects stale direct DOM mutation",
    "/react/",
    ["react-controlled", "stale-dom-rejection"],
  ),
  fixtureCase(
    "MAL-REA-003",
    "React site-side rewrite and delayed rerender",
    "/react/",
    ["react-controlled", "site-rewrite", "delayed-rerender"],
  ),
  fixtureCase("MAL-SHD-001", "Open shadow-root contact control", "/shadow/", [
    "shadow-dom",
    "custom-validation",
  ]),
  fixtureCase(
    "MAL-UPL-001",
    "Local file upload accept and reject",
    "/upload/",
    ["file-upload"],
  ),
  fixtureCase(
    "MAL-VAL-001",
    "Custom, cross-field, and delayed validation",
    "/validation/",
    ["custom-validation", "cross-field-validation", "delayed-validation"],
  ),
  fixtureCase(
    "MAL-VIR-001",
    "Virtualized listbox with bounded DOM window",
    "/virtualized/",
    ["virtualized-listbox", "rerender-persistence"],
  ),
  fixtureCase(
    "MAL-VUE-001",
    "Vue-controlled group surviving rerender",
    "/vue/",
    ["vue-controlled", "rerender-persistence"],
  ),
  fixtureCase("MAL-VUE-002", "Vue rejects stale direct DOM mutation", "/vue/", [
    "vue-controlled",
    "stale-dom-rejection",
  ]),
  fixtureCase("MAL-VUE-003", "Vue site-side rewrite normalization", "/vue/", [
    "vue-controlled",
    "site-rewrite",
  ]),
];

/** All distinct routes served by the lab, sorted. */
export const FIXTURE_ROUTES: readonly string[] = [
  ...new Set(FIXTURE_CASES.map((entry) => entry.route)),
].sort((left, right) => (left < right ? -1 : 1));

/**
 * Canonical JSON serialization the committed manifest digest is computed
 * over (stable key order, no whitespace variance).
 */
export function canonicalCatalogSerialization(): string {
  return JSON.stringify({
    catalogVersion: CATALOG_VERSION,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    cases: FIXTURE_CASES.map((entry) => ({
      id: entry.id,
      title: entry.title,
      route: entry.route,
      surfaces: entry.surfaces,
      provenance: entry.provenance,
      syntheticData: entry.syntheticData,
    })),
  });
}
