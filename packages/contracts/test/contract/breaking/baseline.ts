import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalJson, type PlainJson } from "../adapters/normalization.ts";
import {
  buildCompatibilitySignature,
  type CompatibilitySignature,
} from "./compatibility-signature.ts";

export const BASELINE_PATH = fileURLToPath(
  new URL("../baseline/structural-signature.v1.json", import.meta.url),
);

export interface CompatibilityBaseline {
  baseline_format_version: "1.0.0";
  baseline_id: "m01-w05-representative-v1";
  source_scope: {
    schemas: "packages/contracts/schemas";
    catalogs: string[];
    corpus_manifest: "packages/contracts/test/contract/corpus/manifest.v1.json";
  };
  signature: CompatibilitySignature;
  integrity_sha256: string;
}

export class BaselineError extends Error {
  readonly code: "BASELINE_DIGEST_MISMATCH" | "BASELINE_INVALID";

  constructor(code: "BASELINE_DIGEST_MISMATCH" | "BASELINE_INVALID") {
    super(code);
    this.name = "BaselineError";
    this.code = code;
  }
}

function sha256(value: PlainJson): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function payload(
  baseline: CompatibilityBaseline,
): Omit<CompatibilityBaseline, "integrity_sha256"> {
  return {
    baseline_format_version: baseline.baseline_format_version,
    baseline_id: baseline.baseline_id,
    source_scope: baseline.source_scope,
    signature: baseline.signature,
  };
}

export function buildBaseline(): CompatibilityBaseline {
  const withoutDigest: Omit<CompatibilityBaseline, "integrity_sha256"> = {
    baseline_format_version: "1.0.0",
    baseline_id: "m01-w05-representative-v1",
    source_scope: {
      schemas: "packages/contracts/schemas",
      catalogs: [
        "packages/contracts/catalog/authorization-policy.v1.json",
        "packages/contracts/catalog/capability-catalog.v1.json",
        "packages/contracts/catalog/command-catalog.v1.json",
        "packages/contracts/catalog/error-catalog.v1.json",
      ],
      corpus_manifest:
        "packages/contracts/test/contract/corpus/manifest.v1.json",
    },
    signature: buildCompatibilitySignature(),
  };
  return {
    ...withoutDigest,
    integrity_sha256: sha256(withoutDigest as unknown as PlainJson),
  };
}

export function updateBaseline(): void {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(buildBaseline(), null, 2)}\n`,
    "utf8",
  );
}

export function loadBaseline(path = BASELINE_PATH): CompatibilityBaseline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new BaselineError("BASELINE_INVALID");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BaselineError("BASELINE_INVALID");
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    candidate.baseline_format_version !== "1.0.0" ||
    candidate.baseline_id !== "m01-w05-representative-v1" ||
    typeof candidate.integrity_sha256 !== "string" ||
    typeof candidate.signature !== "object" ||
    candidate.signature === null ||
    Object.keys(candidate).sort().join(",") !==
      [
        "baseline_format_version",
        "baseline_id",
        "integrity_sha256",
        "signature",
        "source_scope",
      ]
        .sort()
        .join(",")
  ) {
    throw new BaselineError("BASELINE_INVALID");
  }
  const baseline = candidate as unknown as CompatibilityBaseline;
  if (
    baseline.integrity_sha256 !==
    sha256(payload(baseline) as unknown as PlainJson)
  ) {
    throw new BaselineError("BASELINE_DIGEST_MISMATCH");
  }
  return baseline;
}
