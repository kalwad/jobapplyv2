import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, win32 } from "node:path";

import { buildStrictAjv } from "@japp/contracts";
import { validateBenchmarkHoldoutManifestV1 } from "@japp/contracts/generated";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalFile,
  sha256Bytes,
  sha256Canonical,
  withoutKey,
} from "../../src/canonical.ts";
import { REPOSITORY_ROOT } from "../../src/corpus.ts";
import {
  exportSanitizedManifest,
  HoldoutBoundaryError,
  isExternalRootRelation,
  validateOwnerMapping,
  validateOwnerMappingV1,
  validateOwnerMappingV2,
  verifyExportedManifest,
  verifyOwnerHoldout,
} from "../../src/owner-holdout.ts";
import {
  ARTIFACT_BODY_1,
  ARTIFACT_BODY_2,
  ARTIFACT_REF_1,
  ARTIFACT_REF_2,
  createOwnerRoot,
  hiddenCase,
  rewriteJson,
  validMapping,
} from "./support.ts";

const cleanups: (() => void)[] = [];
let exportIndex = 0;
const STABLE_BODY = "00000000000000000000000001";
const PENDING_W06_PACKAGE_VERIFICATION =
  "PENDING_FINAL_INDEPENDENT_VERIFICATION";
const FINAL_W06_PACKAGE_VERIFICATION_CLEAR =
  "FINAL_INDEPENDENT_VERIFICATION_CLEAR";
const POST_W06_W07_STATES = new Set([
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "IMPLEMENTED",
  "VERIFIED",
  "ACCEPTED",
]);
const HISTORICAL_V1_STABLE_ID =
  /^[a-z][a-z0-9_]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/u;

const V1_ID_ROLES = [
  { role: "manifest", prefix: "manifest" },
  { role: "case", prefix: "case" },
  { role: "file", prefix: "file" },
  { role: "source", prefix: "source" },
  { role: "review", prefix: "review" },
] as const;

const V2_ID_ROLES = [
  ...V1_ID_ROLES,
  { role: "artifact", prefix: "artifact" },
] as const;

type MappingIdRole = (typeof V2_ID_ROLES)[number]["role"];

function projectPackageState(packageId: "M02-W06" | "M02-W07"): string {
  const status = readFileSync(
    join(REPOSITORY_ROOT, "docs/PROJECT_STATUS.md"),
    "utf8",
  );
  const pattern = new RegExp(
    `^\\| \\x60${packageId}\\x60 \\| ([A-Z_]+) \\|`,
    "gmu",
  );
  const matches = [...status.matchAll(pattern)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error(`M02_W06_PROJECT_STATUS_LIFECYCLE_INVALID:${packageId}`);
  }
  return matches[0][1];
}

function expectedPackageVerificationState(): string {
  const w06 = projectPackageState("M02-W06");
  const w07 = projectPackageState("M02-W07");
  if (w06 === "IN_PROGRESS" && w07 === "NOT_STARTED") {
    return PENDING_W06_PACKAGE_VERIFICATION;
  }
  if (w06 === "VERIFIED" && POST_W06_W07_STATES.has(w07)) {
    return FINAL_W06_PACKAGE_VERIFICATION_CLEAR;
  }
  throw new Error(
    `M02_W06_PACKAGE_VERIFICATION_LIFECYCLE_INVALID:${w06}/${w07}`,
  );
}

function ownerMappingV1(): Record<string, unknown> {
  const mapping = structuredClone(validMapping()) as unknown as Record<
    string,
    unknown
  >;
  mapping.mapping_format_version = "1.0.0";
  delete mapping.artifacts;
  return mapping;
}

function setMappingId(
  mapping: Record<string, unknown>,
  role: MappingIdRole,
  value: unknown,
): void {
  const cases = mapping.cases as Record<string, unknown>[];
  const files = mapping.files as Record<string, unknown>[];
  const creation = mapping.creation_provenance as Record<string, unknown>;
  const review = mapping.review_provenance as Record<string, unknown>;
  if (role === "manifest") mapping.manifest_id = value;
  if (role === "case") first(cases).case_id = value;
  if (role === "file") {
    first(cases).file_id = value;
    first(files).file_id = value;
  }
  if (role === "source") creation.source_id = value;
  if (role === "review") review.source_id = value;
  if (role === "artifact") {
    const artifacts = mapping.artifacts as Record<string, unknown>[];
    first(artifacts).artifact_ref = value;
  }
}

function withMappingId(
  mapping: Record<string, unknown>,
  role: MappingIdRole,
  value: unknown,
): Record<string, unknown> {
  const candidate = structuredClone(mapping);
  setMappingId(candidate, role, value);
  return candidate;
}

function accepts(
  validator: (value: unknown) => unknown,
  value: unknown,
): boolean {
  try {
    validator(value);
    return true;
  } catch {
    return false;
  }
}

function historicalV1Oracle(value: unknown, prefix: string): boolean {
  return (
    typeof value === "string" &&
    HISTORICAL_V1_STABLE_ID.test(value) &&
    value.startsWith(`${prefix}_`)
  );
}

function ownerMappingSchema(version: "v1" | "v2") {
  const schema = JSON.parse(
    readFileSync(
      join(
        REPOSITORY_ROOT,
        `packages/evaluation-corpus/schemas/owner-mapping.${version}.schema.json`,
      ),
      "utf8",
    ),
  ) as object;
  return buildStrictAjv().compile(schema);
}

const validateOwnerMappingV1Schema = ownerMappingSchema("v1");
const validateOwnerMappingV2Schema = ownerMappingSchema("v2");

function owner(twoFiles = false): ReturnType<typeof createOwnerRoot> {
  const fixture = createOwnerRoot(twoFiles);
  cleanups.push(fixture.cleanup);
  return fixture;
}

function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("missing test fixture value");
  return value;
}

function secondBodyPath(root: string): string {
  return join(root, "cases/holdout-b.v1.json");
}

function exportedPath(): string {
  exportIndex += 1;
  return join(
    REPOSITORY_ROOT,
    "benchmarks/holdout-manifests",
    `artifact-correction-${String(process.pid)}-${String(exportIndex)}.manifest.json`,
  );
}

function reuseFirstArtifact(
  fixture: ReturnType<typeof createOwnerRoot>,
  mutate?: (artifact: Record<string, unknown>) => void,
): void {
  const benchmarkCase = structuredClone(hiddenCase(2)) as unknown as Record<
    string,
    unknown
  >;
  const artifact = first(
    benchmarkCase.input_artifacts as Record<string, unknown>[],
  );
  artifact.artifact_ref = ARTIFACT_REF_1;
  artifact.artifact_digest = sha256Bytes(ARTIFACT_BODY_1);
  mutate?.(artifact);
  writeFileSync(
    secondBodyPath(fixture.root),
    canonicalFile({ format_version: "1.0.0", cases: [benchmarkCase] }),
  );
  rmSync(join(fixture.root, "artifacts/artifact-b.bin"));
  writeFileSync(
    fixture.mappingPath,
    canonicalFile({
      ...fixture.mapping,
      artifacts: [first(fixture.mapping.artifacts)],
    }),
  );
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("M02-W06 artifact-preimage correction", () => {
  it("01 rejects a legacy v1 bundle with no artifact preimages as final evidence", () => {
    const fixture = owner();
    const legacy = {
      ...fixture.mapping,
      mapping_format_version: "1.0.0",
    } as Record<string, unknown>;
    delete legacy.artifacts;
    writeFileSync(join(fixture.root, "mapping.v1.json"), canonicalFile(legacy));
    rmSync(fixture.mappingPath);
    rmSync(join(fixture.root, "artifacts"), { recursive: true });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("02 verifies one clean v2 case against one real artifact preimage", () => {
    const snapshot = verifyOwnerHoldout(owner().root);
    expect(snapshot.snapshot_format_version).toBe("2.0.0");
    expect(snapshot.verified_case_count).toBe(1);
    expect(snapshot.verified_artifact_count).toBe(1);
    expect(snapshot.verified_artifacts[0]).toMatchObject({
      artifact_ref: ARTIFACT_REF_1,
      artifact_digest: sha256Bytes(ARTIFACT_BODY_1),
      schema_ref: "urn:japp:schema:fixture:test-record:v1",
    });
  });

  it("03 requires every declared input artifact to have a mapping", () => {
    const fixture = owner();
    rewriteJson(fixture.bodyPath, (value) => {
      const benchmarkCase = first(value.cases as Record<string, unknown>[]);
      const artifacts = benchmarkCase.input_artifacts as Record<
        string,
        unknown
      >[];
      artifacts.push({
        artifact_ref: ARTIFACT_REF_2,
        artifact_digest: sha256Bytes(ARTIFACT_BODY_2),
        schema_ref: "urn:japp:schema:fixture:test-record:v1",
      });
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MISSING"),
    );
  });

  it("04 rejects every mapped artifact that no case references", () => {
    const fixture = owner();
    writeFileSync(
      join(fixture.root, "artifacts/artifact-b.bin"),
      ARTIFACT_BODY_2,
    );
    writeFileSync(
      fixture.mappingPath,
      canonicalFile({
        ...fixture.mapping,
        artifacts: [
          ...fixture.mapping.artifacts,
          {
            artifact_ref: ARTIFACT_REF_2,
            relative_path: "artifacts/artifact-b.bin",
          },
        ],
      }),
    );
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"),
    );
  });

  it("05 rejects a missing mapped artifact file", () => {
    const fixture = owner();
    rmSync(fixture.artifactPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MISSING"),
    );
  });

  it("06 rejects artifact bytes whose digest differs from the case declaration", () => {
    const fixture = owner();
    writeFileSync(fixture.artifactPath, ARTIFACT_BODY_2);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_DIGEST_MISMATCH"),
    );
  });

  it("07 rejects mismatch even after the case container is coordinately rehashed", () => {
    const fixture = owner();
    rewriteJson(fixture.bodyPath, (value) => {
      const benchmarkCase = first(value.cases as Record<string, unknown>[]);
      first(
        benchmarkCase.input_artifacts as Record<string, unknown>[],
      ).artifact_digest = sha256Bytes("different declared bytes");
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_DIGEST_MISMATCH"),
    );
  });

  it("08 rejects artifact-ref replacement while the old mapping and bytes remain", () => {
    const fixture = owner();
    rewriteJson(fixture.bodyPath, (value) => {
      const benchmarkCase = first(value.cases as Record<string, unknown>[]);
      first(
        benchmarkCase.input_artifacts as Record<string, unknown>[],
      ).artifact_ref = ARTIFACT_REF_2;
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MISSING"),
    );
  });

  it("09 allows two cases to reuse one ref only with identical digest and schema", () => {
    const fixture = owner(true);
    reuseFirstArtifact(fixture);
    const snapshot = verifyOwnerHoldout(fixture.root);
    expect(snapshot.verified_case_count).toBe(2);
    expect(snapshot.verified_artifact_count).toBe(1);
  });

  it("10 rejects a conflicting digest under a reused artifact ref", () => {
    const fixture = owner(true);
    reuseFirstArtifact(fixture, (artifact) => {
      artifact.artifact_digest = sha256Bytes(ARTIFACT_BODY_2);
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_CONFLICT"),
    );
  });

  it("11 rejects a conflicting schema under a reused artifact ref", () => {
    const fixture = owner(true);
    reuseFirstArtifact(fixture, (artifact) => {
      artifact.schema_ref = "urn:japp:schema:fixture:other-record:v1";
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_ARTIFACT_CONFLICT"),
    );
  });

  it("12 rejects duplicate artifact-ref mapping entries", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [...mapping.artifacts, first(mapping.artifacts)],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [
          {
            ...first(mapping.artifacts),
            artifact_ref: "artifact_acme_00000000000000000000000001",
          },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
  });

  it("13 rejects duplicate artifact relative paths", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [
          ...mapping.artifacts,
          {
            artifact_ref: ARTIFACT_REF_2,
            relative_path: first(mapping.artifacts).relative_path,
          },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
  });

  it("14 rejects an absolute artifact mapping path", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [
          { ...first(mapping.artifacts), relative_path: "/private/input.bin" },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_PATH_INVALID"));
  });

  it("15 rejects artifact mapping traversal", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [
          {
            ...first(mapping.artifacts),
            relative_path: "../private/input.bin",
          },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_PATH_INVALID"));
  });

  it("16 rejects an artifact-file symlink", () => {
    const fixture = owner();
    rmSync(fixture.artifactPath);
    symlinkSync(fixture.bodyPath, fixture.artifactPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_STORAGE_INVALID"),
    );
  });

  it("17 rejects an artifact-file hardlink alias", () => {
    const fixture = owner();
    const external = mkdtempSync(join(tmpdir(), "japp-w06-hardlink-"));
    cleanups.push(() => {
      rmSync(external, { recursive: true, force: true });
    });
    const externalArtifact = join(external, "artifact.bin");
    writeFileSync(externalArtifact, ARTIFACT_BODY_1);
    rmSync(fixture.artifactPath);
    linkSync(externalArtifact, fixture.artifactPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_STORAGE_INVALID"),
    );
  });

  it("18 rejects a directory in place of an artifact file", () => {
    const fixture = owner();
    rmSync(fixture.artifactPath);
    mkdirSync(fixture.artifactPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      HoldoutBoundaryError,
    );
  });

  it("19 rejects an artifact path escaping through an intermediate symlink", () => {
    const fixture = owner();
    const external = mkdtempSync(join(tmpdir(), "japp-w06-escape-"));
    cleanups.push(() => {
      rmSync(external, { recursive: true, force: true });
    });
    writeFileSync(join(external, "artifact-a.bin"), ARTIFACT_BODY_1);
    rmSync(join(fixture.root, "artifacts"), { recursive: true });
    symlinkSync(external, join(fixture.root, "artifacts"), "dir");
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_STORAGE_INVALID"),
    );
  });

  it("20 rejects an unexpected artifact in the closed inventory", () => {
    const fixture = owner();
    writeFileSync(join(fixture.root, "artifacts/unmapped.bin"), "unmapped");
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_INVENTORY_INVALID"),
    );
  });

  it("21 recomputes artifact counts, byte counts, totals, and receipt", () => {
    const snapshot = verifyOwnerHoldout(owner().root);
    expect(snapshot.verified_artifact_bytes).toBe(ARTIFACT_BODY_1.byteLength);
    expect(snapshot.verified_total_bytes).toBe(
      snapshot.verified_case_file_bytes + snapshot.verified_artifact_bytes,
    );
    expect(snapshot.verified_artifacts[0]?.byte_count).toBe(
      ARTIFACT_BODY_1.byteLength,
    );
    expect(snapshot.receipt_digest).toBe(
      sha256Canonical({
        snapshot_format_version: snapshot.snapshot_format_version,
        manifest_id: snapshot.manifest.manifest_id,
        manifest_digest: snapshot.manifest.manifest_digest,
        verified_case_count: snapshot.verified_case_count,
        verified_case_file_count: snapshot.verified_case_file_count,
        verified_artifact_count: snapshot.verified_artifact_count,
        verified_case_file_bytes: snapshot.verified_case_file_bytes,
        verified_artifact_bytes: snapshot.verified_artifact_bytes,
        verified_total_bytes: snapshot.verified_total_bytes,
        verified_artifacts: snapshot.verified_artifacts,
      }),
    );
  });

  it("22 keeps artifact content and private paths out of safe errors", () => {
    const fixture = owner();
    const sentinel = "SECRET_ARTIFACT_CONTENT_92381";
    writeFileSync(fixture.artifactPath, sentinel);
    try {
      verifyOwnerHoldout(fixture.root);
      throw new Error("expected artifact rejection");
    } catch (error) {
      const serialized = `${String(error)} ${JSON.stringify(error)} ${
        error instanceof Error ? (error.stack ?? "") : ""
      }`;
      expect(serialized).not.toContain(sentinel);
      expect(serialized).not.toContain(fixture.root);
      expect(serialized).not.toContain(fixture.artifactPath);
    }
  });

  it("23 exports no artifact path or body in the sanitized manifest", () => {
    const fixture = owner();
    const output = exportedPath();
    try {
      exportSanitizedManifest(output, fixture.root);
      const serialized = readFileSync(output, "utf8");
      expect(serialized).not.toContain("relative_path");
      expect(serialized).not.toContain("artifact-a.bin");
      expect(serialized).not.toContain(ARTIFACT_BODY_1.toString("utf8").trim());
      expect(serialized).not.toContain(ARTIFACT_REF_1);
    } finally {
      rmSync(output, { force: true });
    }
  });

  it("24 keeps clean v2 output valid under benchmark holdout-manifest v1", () => {
    const manifest = verifyOwnerHoldout(owner().root).manifest;
    const result = validateBenchmarkHoldoutManifestV1(manifest);
    expect(result.valid).toBe(true);
    expect(manifest.holdout_format_version).toBe("1.0.0");
  });

  it("25 re-verifies artifact preimages before trusting an exported manifest", () => {
    const fixture = owner();
    const output = exportedPath();
    try {
      exportSanitizedManifest(output, fixture.root);
      writeFileSync(fixture.artifactPath, ARTIFACT_BODY_2);
      expect(() => verifyExportedManifest(output, fixture.root)).toThrow(
        new HoldoutBoundaryError("HOLDOUT_ARTIFACT_DIGEST_MISMATCH"),
      );
    } finally {
      rmSync(output, { force: true });
    }
  });

  it("26 preserves the historical owner-mapping v1 schema byte-for-byte", () => {
    const bytes = readFileSync(
      join(
        REPOSITORY_ROOT,
        "packages/evaluation-corpus/schemas/owner-mapping.v1.schema.json",
      ),
    );
    expect(sha256Bytes(bytes)).toBe(
      "sha256:04361a9abecded3b6a1545df144149f796ea52790b3f65fb872ad09a3b5b8d4b",
    );
  });

  it("27 never mistakes a v1 mapping file for executable v2 evidence", () => {
    const fixture = owner();
    const legacy = structuredClone(fixture.mapping) as unknown as Record<
      string,
      unknown
    >;
    legacy.mapping_format_version = "1.0.0";
    delete legacy.artifacts;
    writeFileSync(join(fixture.root, "mapping.v1.json"), canonicalFile(legacy));
    rmSync(fixture.mappingPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("28 preserves Windows cross-volume external-root semantics with v2", () => {
    const relation = win32.relative("D:\\repo", "C:\\owner");
    expect(win32.isAbsolute(relation)).toBe(true);
    expect(isExternalRootRelation("D:\\repo", "C:\\owner", win32)).toBe(true);
    expect(isExternalRootRelation("D:\\repo", "D:\\repo\\owner", win32)).toBe(
      false,
    );
    const fixture = owner();
    expect(isAbsolute(fixture.root)).toBe(true);
    expect(() => verifyOwnerHoldout(fixture.root)).not.toThrow();
  });

  it("29 retains case-file symlink and path controls", () => {
    const fixture = owner();
    const target = join(fixture.root, "case-target.json");
    writeFileSync(target, readFileSync(fixture.bodyPath));
    rmSync(fixture.bodyPath);
    symlinkSync(target, fixture.bodyPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      HoldoutBoundaryError,
    );
  });

  it("30a commits exactly the reviewed sanitized owner manifest", () => {
    const directory = join(REPOSITORY_ROOT, "benchmarks/holdout-manifests");
    const manifestFiles = readdirSync(directory).filter((name) =>
      name.endsWith(".manifest.json"),
    );
    expect(manifestFiles).toEqual(["m02-autofill-v1.manifest.json"]);
  });

  it("30b validates the committed manifest against the public v1 contract", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as unknown;
    expect(validateBenchmarkHoldoutManifestV1(manifest).valid).toBe(true);
  });

  it("30c verifies the committed manifest self digest", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(manifest.manifest_digest).toBe(
      sha256Canonical(withoutKey(manifest, "manifest_digest")),
    );
  });

  it("30d locks the reviewed sanitized case count", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(manifest.case_count).toBe(14);
  });

  it("30e locks the reviewed sanitized category counts", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(manifest.category_counts).toEqual([
      { category: "AUTOFILL_ACCESSIBILITY", count: 2 },
      { category: "AUTOFILL_ADVERSARIAL", count: 3 },
      { category: "AUTOFILL_DYNAMIC", count: 3 },
      { category: "AUTOFILL_HONEYPOT", count: 2 },
      { category: "AUTOFILL_SENSITIVE", count: 2 },
      { category: "AUTOFILL_STANDARD", count: 2 },
    ]);
  });

  it("30f locks the reviewed case-container commitment count", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(manifest.files).toHaveLength(4);
  });

  it("30g fails closed on fields outside the sanitized contract surface", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(Object.keys(manifest).sort()).toEqual(
      [
        "case_count",
        "case_ids",
        "category_counts",
        "creation_provenance",
        "files",
        "holdout_format_version",
        "manifest_digest",
        "manifest_id",
        "review_provenance",
        "schema_versions",
        "storage_policy",
        "synthetic_only",
        "visibility_class",
      ].sort(),
    );
  });

  it("30h excludes private and external filesystem paths", () => {
    const serialized = readFileSync(
      join(
        REPOSITORY_ROOT,
        "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
      ),
      "utf8",
    );
    expect(serialized).not.toMatch(
      /(?:\/Users\/|\/home\/|[A-Z]:\\|file:\/\/|\.jobapplyv2-eval)/u,
    );
  });

  it("30i excludes private mapping material", () => {
    const serialized = readFileSync(
      join(
        REPOSITORY_ROOT,
        "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
      ),
      "utf8",
    );
    expect(serialized).not.toMatch(
      /(?:mapping\.v[12]\.json|mapping_format_version|relative_path|artifact_ref)/u,
    );
  });

  it("30j excludes hidden inputs and expected truth", () => {
    const serialized = readFileSync(
      join(
        REPOSITORY_ROOT,
        "benchmarks/holdout-manifests/m02-autofill-v1.manifest.json",
      ),
      "utf8",
    );
    expect(serialized).not.toMatch(
      /(?:input_artifacts|expected_behavior|expected_output|hidden_answer|reviewer_notes)/u,
    );
  });

  it("30k binds reviewed availability to the canonical W06 lifecycle", () => {
    const directory = join(REPOSITORY_ROOT, "benchmarks/holdout-manifests");
    const status = JSON.parse(
      readFileSync(join(directory, "status.v1.json"), "utf8"),
    ) as Record<string, unknown>;
    const manifest = JSON.parse(
      readFileSync(join(directory, "m02-autofill-v1.manifest.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(status).sort()).toEqual(
      [
        "correction_verification_state",
        "format_version",
        "future_decision_owner",
        "future_execution_owner",
        "hidden_content_in_repository",
        "m02_w06_package_verification_state",
        "owner_holdout_review_state",
        "owner_manifest_state",
        "placeholder_manifest_forbidden",
        "public_corpus_independent",
        "required_owner_mapping_version",
        "sanitized_manifest_digest",
      ].sort(),
    );
    expect(status.owner_manifest_state).toBe(
      "OWNER_HOLDOUT_MANIFEST_AVAILABLE",
    );
    expect(status.owner_holdout_review_state).toBe(
      "OWNER_HOLDOUT_V2_REVIEW_CLEAR",
    );
    expect(status.correction_verification_state).toBe(
      "SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS",
    );
    expect(status.m02_w06_package_verification_state).toBe(
      expectedPackageVerificationState(),
    );
    expect(status.sanitized_manifest_digest).toBe(manifest.manifest_digest);
    expect(status.required_owner_mapping_version).toBe("2.0.0");
    expect(status.public_corpus_independent).toBe(true);
    expect(status.placeholder_manifest_forbidden).toBe(true);
    expect(status.hidden_content_in_repository).toBe(false);
  });

  it("30l preserves M02-W14 as the future holdout execution owner", () => {
    const status = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, "benchmarks/holdout-manifests/status.v1.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(status.future_execution_owner).toBe("M02-W14");
  });

  it("30m preserves M02-W15 as the future gate-decision owner", () => {
    const status = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, "benchmarks/holdout-manifests/status.v1.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(status.future_decision_owner).toBe("M02-W15");
  });

  it("31 rejects one relative path serving both case and artifact roles", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [
          {
            ...first(mapping.artifacts),
            relative_path: first(mapping.files).relative_path,
          },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
  });

  it("32 rejects mapped file and ancestor path collisions", () => {
    const mapping = validMapping();
    const boundedLargeInventory = Array.from({ length: 4096 }, (_, index) => {
      const suffix = String(index + 1).padStart(26, "0");
      return {
        artifact_ref: `artifact_${suffix}`,
        relative_path: `artifacts/preimage-${suffix}.bin`,
      };
    });
    expect(
      validateOwnerMapping({ ...mapping, artifacts: boundedLargeInventory })
        .artifacts,
    ).toHaveLength(boundedLargeInventory.length);
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        artifacts: [{ ...first(mapping.artifacts), relative_path: "cases" }],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
  });

  it("33 reserves both mapping filenames from mapped artifact paths", () => {
    const mapping = validMapping();
    for (const relativePath of ["mapping.v1.json", "mapping.v2.json"]) {
      expect(() =>
        validateOwnerMapping({
          ...mapping,
          artifacts: [
            { ...first(mapping.artifacts), relative_path: relativePath },
          ],
        }),
      ).toThrow(new HoldoutBoundaryError("HOLDOUT_ARTIFACT_MAPPING_INVALID"));
    }
  });

  it("34 refuses to label a non-autofill or nonsynthetic case as sanitized", () => {
    for (const mutation of [
      { benchmark_family: "CONTRACT_COMPATIBILITY" },
      { synthetic_data: false },
      { holdout_visibility: "REVIEWER_ONLY" },
    ]) {
      const fixture = owner();
      rewriteJson(fixture.bodyPath, (value) => {
        Object.assign(
          first(value.cases as Record<string, unknown>[]),
          mutation,
        );
      });
      expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
        new HoldoutBoundaryError("HOLDOUT_BODY_INVALID"),
      );
    }
  });

  it("35 preserves the public holdout-manifest v1 schema bytes", () => {
    const bytes = readFileSync(
      join(
        REPOSITORY_ROOT,
        "packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json",
      ),
    );
    expect(sha256Bytes(bytes)).toBe(
      "sha256:139441d5b1bbcd44b35dafe8103d671825b6e9cfb79008a3dfd94d9b4927c738",
    );
  });

  it("36 verifies an empty opaque preimage as exact bytes", () => {
    const fixture = owner();
    writeFileSync(fixture.artifactPath, Buffer.alloc(0));
    rewriteJson(fixture.bodyPath, (value) => {
      const benchmarkCase = first(value.cases as Record<string, unknown>[]);
      first(
        benchmarkCase.input_artifacts as Record<string, unknown>[],
      ).artifact_digest = sha256Bytes(Buffer.alloc(0));
    });
    const snapshot = verifyOwnerHoldout(fixture.root);
    expect(snapshot.verified_artifact_bytes).toBe(0);
    expect(snapshot.verified_artifacts[0]?.byte_count).toBe(0);
  });

  it("37 preserves an explicit historical v1 validator without executing it", () => {
    const legacy = structuredClone(validMapping()) as unknown as Record<
      string,
      unknown
    >;
    legacy.mapping_format_version = "1.0.0";
    delete legacy.artifacts;
    expect(validateOwnerMappingV1(legacy).mapping_format_version).toBe("1.0.0");
    expect(() => validateOwnerMapping(legacy)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("38 rejects a broad owner root that is an ancestor of the repository", () => {
    expect(() => verifyOwnerHoldout(dirname(REPOSITORY_ROOT))).toThrow(
      new HoldoutBoundaryError("HOLDOUT_EXTERNAL_ROOT_REQUIRED"),
    );
  });

  it.each(V1_ID_ROLES)(
    "39 preserves the canonical historical v1 $role ID",
    ({ role, prefix }) => {
      const id = `${prefix}_${STABLE_BODY}`;
      const candidate = withMappingId(ownerMappingV1(), role, id);
      expect(historicalV1Oracle(id, prefix)).toBe(true);
      expect(accepts(validateOwnerMappingV1, candidate)).toBe(true);
    },
  );

  it.each(V1_ID_ROLES)(
    "40 preserves every reviewed historical v1 $role extension form",
    ({ role, prefix }) => {
      const reviewedAcceptedIds = [
        `${prefix}_acme_${STABLE_BODY}`,
        `${prefix}__${STABLE_BODY}`,
        `${prefix}_9__x2_${STABLE_BODY}`,
        `${prefix}_${"a".repeat(23 - prefix.length)}_${STABLE_BODY}`,
      ];
      for (const id of reviewedAcceptedIds) {
        expect(historicalV1Oracle(id, prefix)).toBe(true);
        expect(
          accepts(
            validateOwnerMappingV1,
            withMappingId(ownerMappingV1(), role, id),
          ),
        ).toBe(true);
      }
    },
  );

  it.each(V1_ID_ROLES)(
    "41 preserves historical v1 rejection boundaries for $role IDs",
    ({ role, prefix }) => {
      const otherPrefix = prefix === "manifest" ? "case" : "manifest";
      const reviewedRejectedIds: readonly unknown[] = [
        `${prefix}_${"a".repeat(24 - prefix.length)}_${STABLE_BODY}`,
        `${prefix}_${STABLE_BODY.slice(1)}`,
        `${prefix}_${STABLE_BODY}2`,
        `${prefix}_I${STABLE_BODY.slice(1)}`,
        `${prefix}_Acme_${STABLE_BODY}`,
        `${prefix}_acme${STABLE_BODY}`,
        `${otherPrefix}_${STABLE_BODY}`,
        17,
      ];
      for (const id of reviewedRejectedIds) {
        expect(historicalV1Oracle(id, prefix)).toBe(false);
        expect(
          accepts(
            validateOwnerMappingV1,
            withMappingId(ownerMappingV1(), role, id),
          ),
        ).toBe(false);
      }
    },
  );

  it("42 accepts a complete historical v1 mapping with all five extended ID roles", () => {
    const mapping = ownerMappingV1();
    for (const { role, prefix } of V1_ID_ROLES) {
      setMappingId(mapping, role, `${prefix}_9__x2_${STABLE_BODY}`);
    }
    expect(accepts(validateOwnerMappingV1, mapping)).toBe(true);
    expect(validateOwnerMappingV1Schema(mapping)).toBe(false);
  });

  it("43 records the pre-existing v1 schema/runtime distinction literally", () => {
    const id = `manifest_acme_${STABLE_BODY}`;
    const mapping = withMappingId(ownerMappingV1(), "manifest", id);
    expect(historicalV1Oracle(id, "manifest")).toBe(true);
    expect(validateOwnerMappingV1Schema(mapping)).toBe(false);
    expect(accepts(validateOwnerMappingV1, mapping)).toBe(true);
  });

  it("44 keeps a historically accepted v1 owner root non-executable as final evidence", () => {
    const fixture = owner();
    const legacy = ownerMappingV1();
    for (const { role, prefix } of V1_ID_ROLES) {
      setMappingId(legacy, role, `${prefix}_acme_${STABLE_BODY}`);
    }
    expect(accepts(validateOwnerMappingV1, legacy)).toBe(true);
    writeFileSync(join(fixture.root, "mapping.v1.json"), canonicalFile(legacy));
    rmSync(fixture.mappingPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it.each(V2_ID_ROLES)(
    "45 rejects the historical-only extension in the v2 $role role",
    ({ role, prefix }) => {
      const mapping = withMappingId(
        structuredClone(validMapping()) as unknown as Record<string, unknown>,
        role,
        `${prefix}_acme_${STABLE_BODY}`,
      );
      expect(validateOwnerMappingV2Schema(mapping)).toBe(false);
      expect(accepts(validateOwnerMappingV2, mapping)).toBe(false);
    },
  );

  it.each(V2_ID_ROLES)(
    "46 keeps v2 runtime/schema agreement for representative $role boundaries",
    ({ role, prefix }) => {
      const variants = [
        { id: `${prefix}_${STABLE_BODY}`, expected: true },
        { id: `other_${STABLE_BODY}`, expected: false },
        { id: `${prefix}_${STABLE_BODY.slice(1)}`, expected: false },
        { id: `${prefix}_${STABLE_BODY}2`, expected: false },
        { id: `${prefix}_I${STABLE_BODY.slice(1)}`, expected: false },
      ];
      for (const { id, expected } of variants) {
        const mapping = withMappingId(
          structuredClone(validMapping()) as unknown as Record<string, unknown>,
          role,
          id,
        );
        expect(validateOwnerMappingV2Schema(mapping)).toBe(expected);
        expect(accepts(validateOwnerMappingV2, mapping)).toBe(expected);
      }
    },
  );

  it("47 keeps clean artifact-backed v2 evidence schema-valid and executable", () => {
    const fixture = owner();
    expect(validateOwnerMappingV2Schema(fixture.mapping)).toBe(true);
    const snapshot = verifyOwnerHoldout(fixture.root);
    expect(snapshot.verified_case_count).toBe(1);
    expect(snapshot.verified_artifact_count).toBe(1);
  });
});
