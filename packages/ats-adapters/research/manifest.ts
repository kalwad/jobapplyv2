/** Small W12-local manifest contract. It does not evolve W06 or benchmark schemas. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixtureHtml } from "./fixture-html.ts";
import {
  ATS_FAMILIES,
  RESEARCH_MATRIX,
  type ResearchAts,
  type ResearchVariant,
} from "./matrix.ts";

export const W06_PARENT = Object.freeze({
  corpusId: "M02_AUTOFILL_DEVELOPMENT_V1",
  corpusVersion: "1.0.0",
  corpusDigest:
    "sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8",
  manifestFileDigest:
    "sha256:b162839ac5cc2654cc6c83c05c25ba91233722861dcf6c06749e6a0e036c6644",
  manifestPath:
    "packages/evaluation-corpus/artifacts/development/M02_AUTOFILL_DEVELOPMENT_V1/1.0.0/corpus.manifest.json",
} as const);
export interface ResearchManifestV1 {
  readonly schema: "M02_W12_RESEARCH_EXPANSION_MANIFEST";
  readonly schemaVersion: "1.0.0";
  readonly expansionId: "M02_ATS_RESEARCH_EXPANSION";
  readonly expansionVersion: "1.0.0";
  readonly classification: readonly [
    "EVALUATION_ONLY",
    "NON_PRODUCTION",
    "PUBLIC_SYNTHETIC",
  ];
  readonly gateAuthority: "NONE";
  readonly productionSupport: false;
  readonly parent: typeof W06_PARENT;
  readonly changePolicy: {
    readonly relationship: "APPEND_ONLY_DEVELOPMENT_EXPANSION";
    readonly parentBytes: "IMMUTABLE";
    readonly historicalExpansionBytes: "IMMUTABLE";
    readonly sameVersionRewrite: "FORBIDDEN";
    readonly nextVersion: "FULL_MAJOR_VERSION_ONLY";
    readonly correctionRecord: "REQUIRED_FOR_CHANGED_EXPECTATIONS";
    readonly affectedEvidence: "INVALIDATE_AND_RERUN_FOR_CHANGED_EXPECTATIONS";
  };
  readonly sourceProvenance: {
    readonly source: "SPECIFICATION_DERIVED_SYNTHETIC";
    readonly implementationOwner: "M02-W12";
    readonly reviewState: "NOT_REVIEWED";
    readonly publicationState: "DEVELOPMENT_ONLY";
    readonly assets: readonly {
      readonly path: string;
      readonly digest: string;
      readonly bytes: number;
    }[];
  };
  readonly variants: readonly {
    readonly id: string;
    readonly family: ResearchAts;
    readonly recipeDigest: string;
    readonly fixtureDigest: string;
    readonly fixtureBytes: number;
    readonly structuralDigest: string;
    readonly expectedDigest: string;
    readonly preparedControls: number;
    readonly sensitiveProhibitedControls: number;
    readonly honeypots: number;
  }[];
  readonly coverage: {
    readonly expansionVariants: number;
    readonly frozenParentVariants: 32;
    readonly cumulativeDevelopmentVariants: number;
    readonly familyVariants: Readonly<Record<ResearchAts, number>>;
    readonly preparedControls: number;
    readonly preparedSensitiveProhibitedControls: number;
    readonly preparedHoneypots: number;
    readonly scoredControls: 0;
    readonly publicNoSubmitExecutions: 0;
    readonly ownerHoldoutExecutions: 0;
    readonly dimensions: Readonly<
      Record<string, Readonly<Record<string, number>>>
    >;
    readonly status: "PREPARED_INVENTORY_NOT_SCORED";
    readonly scoringOwner: "M02-W13";
    readonly executionOwner: "M02-W14";
  };
  readonly digest: string;
}
export function digestBytes(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/** Defense in depth for authored synthetic fragments; provenance is still
 * mandatory because an arbitrary human name cannot be identified by regex. */
export function assertSanitizedResearchHtml(html: string): void {
  if (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|-----BEGIN|\b(?:bearer|session[_-]?token|api[_-]?key|password)\s*[:=]|\b(?:sk_live_|sk_test_|ghp_)[A-Z0-9_]+|<script\b|\bon[a-z]+\s*=/iu.test(
      html,
    )
  )
    throw new Error("W12_UNSANITIZED_RESEARCH_HTML");
}
function normalized(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(normalized);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, normalized(child)]),
    );
  throw new Error("W12_CANONICAL_VALUE");
}
export function canonicalResearchJson(value: unknown): string {
  return JSON.stringify(normalized(value));
}
export function canonicalResearchFile(value: unknown): string {
  return `${JSON.stringify(normalized(value), null, 2)}\n`;
}
function digest(value: unknown): string {
  return digestBytes(canonicalResearchJson(value));
}
/** Remove prose, family metadata, route, locale labels and variant identifiers.
 * Remaining element structure and control semantics must still distinguish cases.
 */
export function structuralSignature(variant: ResearchVariant): string {
  const html = fixtureHtml(variant)
    .replace(/ data-research-[a-z-]+="[^"]*"/gu, "")
    .replace(/ lang="[^"]*"/gu, "")
    .replace(/ class="[^"]*"/gu, "")
    .replace(/ aria-label="[^"]*"/gu, "")
    .replace(/(?<=>)[^<]+(?=<)/gu, "");
  return html.replace(/>\s+</gu, "><").trim();
}
function sourceAssets(): ResearchManifestV1["sourceProvenance"]["assets"] {
  return ["matrix.ts", "fixture-html.ts", "manifest.ts"].map((name) => {
    const bytes = readFileSync(new URL(name, import.meta.url));
    return {
      path: `packages/ats-adapters/research/${name}`,
      digest: digestBytes(bytes),
      bytes: bytes.byteLength,
    };
  });
}
export function computeResearchManifest(): ResearchManifestV1 {
  const variants = RESEARCH_MATRIX.map((variant) => {
    const html = fixtureHtml(variant);
    assertSanitizedResearchHtml(html);
    const count = (
      predicate: (control: ResearchVariant["controls"][number]) => boolean,
    ): number =>
      variant.controls
        .filter(predicate)
        .reduce(
          (sum, control) =>
            sum +
            (control.kind === "radio" ? (control.options?.length ?? 0) : 1),
          0,
        );
    return {
      id: variant.id,
      family: variant.ats,
      recipeDigest: digest(variant),
      fixtureDigest: digestBytes(html),
      fixtureBytes: Buffer.byteLength(html),
      structuralDigest: digestBytes(structuralSignature(variant)),
      expectedDigest: digest(variant.expected),
      preparedControls: count(() => true),
      sensitiveProhibitedControls: count(
        (control) => control.policy === "SENSITIVE_ABSTAIN",
      ),
      honeypots: count((control) => control.policy === "HONEYPOT_ABSTAIN"),
    };
  });
  const dimension = (
    pick: (variant: ResearchVariant) => string,
  ): Readonly<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const variant of RESEARCH_MATRIX) {
      const key = pick(variant);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const dimensions = {
    step: dimension((variant) => variant.step),
    layout: dimension((variant) => variant.layout),
    locale: dimension((variant) => variant.locale),
    session: dimension((variant) => variant.session),
    navigation: dimension((variant) => variant.expected.navigationState),
    parser: dimension((variant) => variant.expected.parserOutcome),
    validation: dimension((variant) => variant.expected.validation),
    dynamics: dimension((variant) => variant.expected.dynamicScenario),
    repeaterRows: dimension((variant) => String(variant.expected.repeaterRows)),
    upload: dimension((variant) =>
      variant.controls.some((control) => control.kind === "file")
        ? "PRESENT"
        : "ABSENT",
    ),
  };
  const payload = {
    schema: "M02_W12_RESEARCH_EXPANSION_MANIFEST" as const,
    schemaVersion: "1.0.0" as const,
    expansionId: "M02_ATS_RESEARCH_EXPANSION" as const,
    expansionVersion: "1.0.0" as const,
    classification: [
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
      "PUBLIC_SYNTHETIC",
    ] as const,
    gateAuthority: "NONE" as const,
    productionSupport: false as const,
    parent: W06_PARENT,
    changePolicy: {
      relationship: "APPEND_ONLY_DEVELOPMENT_EXPANSION" as const,
      parentBytes: "IMMUTABLE" as const,
      historicalExpansionBytes: "IMMUTABLE" as const,
      sameVersionRewrite: "FORBIDDEN" as const,
      nextVersion: "FULL_MAJOR_VERSION_ONLY" as const,
      correctionRecord: "REQUIRED_FOR_CHANGED_EXPECTATIONS" as const,
      affectedEvidence:
        "INVALIDATE_AND_RERUN_FOR_CHANGED_EXPECTATIONS" as const,
    },
    sourceProvenance: {
      source: "SPECIFICATION_DERIVED_SYNTHETIC" as const,
      implementationOwner: "M02-W12" as const,
      reviewState: "NOT_REVIEWED" as const,
      publicationState: "DEVELOPMENT_ONLY" as const,
      assets: sourceAssets(),
    },
    variants,
    coverage: {
      expansionVariants: variants.length,
      frozenParentVariants: 32 as const,
      cumulativeDevelopmentVariants: variants.length + 32,
      familyVariants: Object.fromEntries(
        ATS_FAMILIES.map((family) => [
          family,
          variants.filter((variant) => variant.family === family).length,
        ]),
      ) as Record<ResearchAts, number>,
      preparedControls: variants.reduce(
        (sum, variant) => sum + variant.preparedControls,
        0,
      ),
      preparedSensitiveProhibitedControls: variants.reduce(
        (sum, variant) => sum + variant.sensitiveProhibitedControls,
        0,
      ),
      preparedHoneypots: variants.reduce(
        (sum, variant) => sum + variant.honeypots,
        0,
      ),
      scoredControls: 0 as const,
      publicNoSubmitExecutions: 0 as const,
      ownerHoldoutExecutions: 0 as const,
      dimensions,
      status: "PREPARED_INVENTORY_NOT_SCORED" as const,
      scoringOwner: "M02-W13" as const,
      executionOwner: "M02-W14" as const,
    },
  };
  return { ...payload, digest: digest(payload) };
}
/** Exact shape, digests, counts, recipe semantics and materialized bytes are bound.
 * This proves local integrity, not independent review or browser correctness.
 */
export function validateResearchManifest(value: unknown): ResearchManifestV1 {
  if (
    canonicalResearchJson(value) !==
    canonicalResearchJson(computeResearchManifest())
  )
    throw new Error("W12_EXPANSION_MANIFEST_DRIFT");
  return value as ResearchManifestV1;
}
export function readResearchManifest(): ResearchManifestV1 {
  const bytes = readFileSync(
    new URL("expansion.manifest.v1.json", import.meta.url),
    "utf8",
  );
  const value: unknown = JSON.parse(bytes);
  const validated = validateResearchManifest(value);
  if (bytes !== canonicalResearchFile(validated))
    throw new Error("W12_EXPANSION_NONCANONICAL_BYTES");
  return validated;
}
export const RESEARCH_MANIFEST_V1 = computeResearchManifest();
