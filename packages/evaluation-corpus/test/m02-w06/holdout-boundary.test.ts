import {
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalFile,
  sha256Canonical,
  withoutKey,
} from "../../src/canonical.ts";
import {
  assertManifestMatchesSnapshot,
  exportSanitizedManifest,
  HoldoutBoundaryError,
  validateOwnerMapping,
  validateRelativePath,
  validateSanitizedManifest,
  verifyExportedManifest,
  verifyOwnerHoldout,
} from "../../src/owner-holdout.ts";
import { REPOSITORY_ROOT } from "../../src/corpus.ts";
import {
  CASE_ID_1,
  FILE_ID_1,
  createOwnerRoot,
  rewriteJson,
  validMapping,
} from "./support.ts";

const cleanups: (() => void)[] = [];
function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("missing test value");
  return value;
}
function owner(twoFiles = false): ReturnType<typeof createOwnerRoot> {
  const fixture = createOwnerRoot(twoFiles);
  cleanups.push(fixture.cleanup);
  return fixture;
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("M02-W06 owner-external holdout boundary", () => {
  it("verifies a complete one-read synthetic owner snapshot", () => {
    const fixture = owner();
    const snapshot = verifyOwnerHoldout(fixture.root);
    expect(snapshot.verified_case_count).toBe(1);
    expect(snapshot.verified_file_count).toBe(1);
    expect(snapshot.manifest.case_ids).toEqual([CASE_ID_1]);
    const output = join(
      REPOSITORY_ROOT,
      "benchmarks/holdout-manifests",
      `w06-test-${String(process.pid)}.manifest.json`,
    );
    try {
      const exported = exportSanitizedManifest(output, fixture.root);
      const verified = verifyExportedManifest(output, fixture.root);
      expect(exported.receipt_digest).toBe(verified.receipt_digest);
      expect(verified.manifest).toEqual(snapshot.manifest);
    } finally {
      rmSync(output, { force: true });
    }
  });

  it("derives exact file bytes and self-digest commitments", () => {
    const fixture = owner();
    const { manifest } = verifyOwnerHoldout(fixture.root);
    expect(manifest.files[0]?.byte_count).toBe(
      readFileSync(fixture.bodyPath).byteLength,
    );
    expect(manifest.manifest_digest).toBe(
      sha256Canonical(
        withoutKey(
          manifest as unknown as Record<string, unknown>,
          "manifest_digest",
        ),
      ),
    );
    const snapshot = verifyOwnerHoldout(fixture.root);
    const wrongBytes = structuredClone(manifest) as unknown as Record<
      string,
      unknown
    >;
    first(wrongBytes.files as Record<string, unknown>[]).byte_count = 1;
    wrongBytes.manifest_digest = sha256Canonical(
      withoutKey(wrongBytes, "manifest_digest"),
    );
    expect(() => {
      assertManifestMatchesSnapshot(
        validateSanitizedManifest(wrongBytes),
        snapshot,
      );
    }).toThrow(new HoldoutBoundaryError("HOLDOUT_MANIFEST_INVALID"));
  });

  it("derives sorted schemas categories files and case IDs", () => {
    const fixture = owner(true);
    const { manifest } = verifyOwnerHoldout(fixture.root);
    expect(manifest.case_ids).toEqual([...manifest.case_ids].sort());
    expect(manifest.category_counts.map(({ category }) => category)).toEqual([
      "AUTOFILL_SENSITIVE",
      "AUTOFILL_STANDARD",
    ]);
    expect(manifest.files.map(({ file_id }) => file_id)).toEqual(
      [...manifest.files.map(({ file_id }) => file_id)].sort(),
    );
    expect(manifest.schema_versions).toEqual([
      {
        schema_ref: "urn:japp:schema:benchmark:case:v1",
        schema_version: "1.0.0",
      },
    ]);
  });

  it("requires owner-controlled external storage and owner-reviewer visibility", () => {
    const manifest = verifyOwnerHoldout(owner().root).manifest;
    expect(manifest.storage_policy).toBe("OWNER_CONTROLLED_EXTERNAL");
    expect(manifest.visibility_class).toBe("OWNER_REVIEWER");
    expect(manifest.synthetic_only).toBe(true);
  });

  it("rejects an absent ambient root", () => {
    expect(() => verifyOwnerHoldout("")).toThrow(
      new HoldoutBoundaryError("HOLDOUT_EXTERNAL_ROOT_REQUIRED"),
    );
  });

  it("rejects a relative root", () => {
    expect(() => verifyOwnerHoldout("relative-owner-root")).toThrow(
      new HoldoutBoundaryError("HOLDOUT_EXTERNAL_ROOT_REQUIRED"),
    );
  });

  it.each([
    "/absolute.json",
    "../escape.json",
    "./same.json",
    "cases//double.json",
    "cases\\windows.json",
    "C:/drive.json",
    "cases/%2e%2e.json",
    "cases/nul.json",
    "cases/trailing..json.",
    "cases/trailing.json ",
    "cases/UPPER.json",
    "cases/bi\u202edi.json",
  ])("rejects unsafe mapping path %s", (path) => {
    expect(() => validateRelativePath(path)).toThrow(HoldoutBoundaryError);
  });

  it("rejects duplicate mapping keys before JSON parsing", () => {
    const fixture = owner();
    writeFileSync(
      fixture.mappingPath,
      '{"mapping_format_version":"1.0.0","mapping_format_version":"1.0.0"}',
    );
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("rejects malformed UTF-8 mapping bytes", () => {
    const fixture = owner();
    writeFileSync(fixture.mappingPath, Buffer.from([0xc3, 0x28]));
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("rejects a UTF-8 BOM", () => {
    const fixture = owner();
    writeFileSync(
      fixture.mappingPath,
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        readFileSync(fixture.mappingPath),
      ]),
    );
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("rejects unknown mapping fields", () => {
    const mapping = { ...validMapping(), hidden_path: "private.json" };
    expect(() => validateOwnerMapping(mapping)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"),
    );
  });

  it("rejects duplicate case IDs", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        cases: [...mapping.cases, mapping.cases[0]],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("rejects duplicate relative paths", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        files: [
          ...mapping.files,
          {
            file_id: "file_00000000000000000000000002",
            relative_path: first(mapping.files).relative_path,
          },
        ],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("rejects non-generic stable ID prefixes", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        manifest_id: "employer_00000000000000000000000001",
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("rejects non-generic category labels", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        cases: [{ ...first(mapping.cases), category: "ACME_PRIVATE" }],
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("requires independent generic creation and review provenance", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        review_provenance: mapping.creation_provenance,
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("rejects review time before creation time", () => {
    const mapping = validMapping();
    expect(() =>
      validateOwnerMapping({
        ...mapping,
        review_provenance: {
          ...mapping.review_provenance,
          observed_at: "2026-08-10T15:00:00Z",
        },
      }),
    ).toThrow(new HoldoutBoundaryError("HOLDOUT_MAPPING_INVALID"));
  });

  it("rejects an unexpected external entry", () => {
    const fixture = owner();
    writeFileSync(join(fixture.root, "unexpected.txt"), "sentinel");
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_INVENTORY_INVALID"),
    );
  });

  it("rejects a missing mapped file", () => {
    const fixture = owner();
    rmSync(fixture.bodyPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_INVENTORY_INVALID"),
    );
  });

  it("rejects a directory and, where portable, a FIFO in place of a body", () => {
    const fixture = owner();
    rmSync(fixture.bodyPath);
    mkdirSync(fixture.bodyPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_INVENTORY_INVALID"),
    );
    if (process.platform !== "win32") {
      const fifoFixture = owner();
      rmSync(fifoFixture.bodyPath);
      const created = spawnSync("mkfifo", [fifoFixture.bodyPath]);
      expect(created.status).toBe(0);
      expect(() => verifyOwnerHoldout(fifoFixture.root)).toThrow(
        new HoldoutBoundaryError("HOLDOUT_STORAGE_INVALID"),
      );
    }
  });

  it("rejects a mapping symlink", () => {
    const fixture = owner();
    const target = join(fixture.root, "mapping-target.json");
    writeFileSync(target, readFileSync(fixture.mappingPath));
    rmSync(fixture.mappingPath);
    symlinkSync(target, fixture.mappingPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_STORAGE_INVALID"),
    );
  });

  it("rejects an intermediate directory symlink", () => {
    const fixture = owner();
    const target = join(fixture.root, "real-cases");
    rmSync(join(fixture.root, "cases"), { recursive: true });
    mkdirSync(target);
    writeFileSync(
      join(target, "holdout-a.v1.json"),
      canonicalFile({ format_version: "1.0.0", cases: [] }),
    );
    symlinkSync(target, join(fixture.root, "cases"), "dir");
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      HoldoutBoundaryError,
    );
  });

  it("rejects a final body symlink", () => {
    const fixture = owner();
    const target = join(fixture.root, "body-target.json");
    writeFileSync(target, readFileSync(fixture.bodyPath));
    rmSync(fixture.bodyPath);
    symlinkSync(target, fixture.bodyPath);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      HoldoutBoundaryError,
    );
  });

  it("rejects a final-file hardlink", () => {
    const fixture = owner();
    const extra = join(fixture.root, "hardlink-copy.json");
    linkSync(fixture.bodyPath, extra);
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      HoldoutBoundaryError,
    );
  });

  it("rejects contract-invalid hidden bodies", () => {
    const fixture = owner();
    writeFileSync(
      fixture.bodyPath,
      canonicalFile({
        format_version: "1.0.0",
        cases: [{ case_id: CASE_ID_1 }],
      }),
    );
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_BODY_INVALID"),
    );
  });

  it("rejects hidden body duplicate keys", () => {
    const fixture = owner();
    writeFileSync(
      fixture.bodyPath,
      '{"format_version":"1.0.0","format_version":"1.0.0","cases":[]}',
    );
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_BODY_INVALID"),
    );
  });

  it("rejects case-ID union mismatch", () => {
    const fixture = owner();
    rewriteJson(fixture.bodyPath, (value) => {
      const cases = value.cases as Record<string, unknown>[];
      first(cases).case_id = "case_00000000000000000000000002";
    });
    expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_CASE_MISMATCH"),
    );
  });

  it("rejects a sanitized manifest with a stale self-digest", () => {
    const manifest = structuredClone(
      verifyOwnerHoldout(owner().root).manifest,
    ) as unknown as Record<string, unknown>;
    manifest.case_count = 2;
    expect(() => validateSanitizedManifest(manifest)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MANIFEST_INVALID"),
    );
  });

  it("rejects encrypted storage and a rehashed injected property", () => {
    const manifest = structuredClone(
      verifyOwnerHoldout(owner().root).manifest,
    ) as unknown as Record<string, unknown>;
    manifest.storage_policy = "ENCRYPTED_BUNDLE_REFERENCE";
    manifest.manifest_digest = sha256Canonical(
      withoutKey(manifest, "manifest_digest"),
    );
    expect(() => validateSanitizedManifest(manifest)).toThrow(
      new HoldoutBoundaryError("HOLDOUT_MANIFEST_INVALID"),
    );
  });

  it("never exposes private path or answer sentinels in errors", () => {
    const fixture = owner();
    const sentinel = "SECRET_EXPECTED_ANSWER_7283";
    writeFileSync(join(fixture.root, "unexpected-secret.txt"), sentinel);
    try {
      verifyOwnerHoldout(fixture.root);
      throw new Error("expected rejection");
    } catch (error) {
      const serialized = `${String(error)} ${JSON.stringify(error)} ${error instanceof Error ? (error.stack ?? "") : ""}`;
      expect(serialized).not.toContain(fixture.root);
      expect(serialized).not.toContain(sentinel);
      expect(serialized).not.toContain("unexpected-secret.txt");
    }
  });

  it("returns a frozen sanitized snapshot with no hidden body", () => {
    const snapshot = verifyOwnerHoldout(owner().root);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.case_ids)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.files)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("expected_behavior");
    expect(JSON.stringify(snapshot)).not.toContain("relative_path");
  });

  it("manifest schema cannot represent a filesystem path or key", () => {
    const serialized = JSON.stringify(
      verifyOwnerHoldout(owner().root).manifest,
    );
    expect(serialized).not.toMatch(
      /relative_path|absolute_path|expected_output|secret|credential|key/u,
    );
  });

  it("uses file IDs rather than paths in the visible manifest", () => {
    expect(verifyOwnerHoldout(owner().root).manifest.files[0]?.file_id).toBe(
      FILE_ID_1,
    );
  });
});
