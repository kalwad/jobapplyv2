import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { BenchmarkCaseV1 } from "@japp/contracts/generated";

import { makeCase } from "../../../evaluation-runner/test/m02-w05/support/fixtures.ts";
import { canonicalFile, sha256Bytes } from "../../src/canonical.ts";
import type { OwnerMappingV1 } from "../../src/owner-holdout.ts";

export const CASE_ID_1 = "case_00000000000000000000000001";
export const CASE_ID_2 = "case_00000000000000000000000002";
export const FILE_ID_1 = "file_00000000000000000000000001";
export const FILE_ID_2 = "file_00000000000000000000000002";
export const MANIFEST_ID = "manifest_00000000000000000000000001";

export function hiddenCase(index = 1): BenchmarkCaseV1 {
  return {
    ...makeCase({ index, holdoutVisibility: "OWNER_CONTROLLED_HIDDEN" }),
    case_id: index === 1 ? CASE_ID_1 : CASE_ID_2,
    benchmark_family: "AUTOFILL_FEASIBILITY",
  };
}

export function validMapping(twoFiles = false): OwnerMappingV1 {
  const cases: OwnerMappingV1["cases"] = [
    {
      case_id: CASE_ID_1,
      category: "AUTOFILL_STANDARD",
      schema_ref: "urn:japp:schema:benchmark:case:v1",
      schema_version: "1.0.0",
      file_id: FILE_ID_1,
    },
    ...(twoFiles
      ? [
          {
            case_id: CASE_ID_2,
            category: "AUTOFILL_SENSITIVE",
            schema_ref: "urn:japp:schema:benchmark:case:v1" as const,
            schema_version: "1.0.0" as const,
            file_id: FILE_ID_2,
          },
        ]
      : []),
  ];
  return {
    mapping_format_version: "1.0.0",
    manifest_id: MANIFEST_ID,
    holdout_format_version: "1.0.0",
    storage_policy: "OWNER_CONTROLLED_EXTERNAL",
    visibility_class: "OWNER_REVIEWER",
    creation_provenance: {
      source_kind: "GENERATED",
      source_id: "source_00000000000000000000000001",
      observed_at: "2026-08-10T16:00:00Z",
      source_digest: sha256Bytes("synthetic owner mapping"),
    },
    review_provenance: {
      source_kind: "GENERATED",
      source_id: "review_00000000000000000000000001",
      observed_at: "2026-08-10T16:05:00Z",
      source_digest: sha256Bytes("independent sanitized review"),
    },
    cases,
    files: [
      { file_id: FILE_ID_1, relative_path: "cases/holdout-a.v1.json" },
      ...(twoFiles
        ? [{ file_id: FILE_ID_2, relative_path: "cases/holdout-b.v1.json" }]
        : []),
    ],
  };
}

export interface OwnerRootFixture {
  readonly root: string;
  readonly mapping: OwnerMappingV1;
  readonly mappingPath: string;
  readonly bodyPath: string;
  readonly cleanup: () => void;
}

export function createOwnerRoot(twoFiles = false): OwnerRootFixture {
  const root = mkdtempSync(join(tmpdir(), "japp-w06-owner-"));
  const mapping = validMapping(twoFiles);
  mkdirSync(join(root, "cases"));
  const bodyPath = join(root, "cases/holdout-a.v1.json");
  writeFileSync(
    bodyPath,
    canonicalFile({ format_version: "1.0.0", cases: [hiddenCase(1)] }),
  );
  if (twoFiles) {
    writeFileSync(
      join(root, "cases/holdout-b.v1.json"),
      canonicalFile({ format_version: "1.0.0", cases: [hiddenCase(2)] }),
    );
  }
  const mappingPath = join(root, "mapping.v1.json");
  writeFileSync(mappingPath, canonicalFile(mapping));
  return {
    root,
    mapping,
    mappingPath,
    bodyPath,
    cleanup: () => {
      rmSync(root, { force: true, recursive: true });
    },
  };
}

export function rewriteJson(
  path: string,
  mutate: (value: Record<string, unknown>) => void,
): void {
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  mutate(value);
  writeFileSync(path, canonicalFile(value));
}
