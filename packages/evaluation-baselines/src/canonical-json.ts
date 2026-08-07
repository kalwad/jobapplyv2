// Canonical JSON serialization and content digests for the evaluation
// baselines (M02-W04). Same canonical form as the fixture package: sorted
// object keys, safe integers only, undefined members dropped, and
// `sha256:<hex>` digests over the UTF-8 canonical serialization.
import { createHash } from "node:crypto";

export type ContentDigest = `sha256:${string}`;

function normalizeJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new TypeError("canonical JSON accepts only safe integers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(object).sort()) {
      const child = object[key];
      if (child !== undefined) {
        normalized[key] = normalizeJson(child);
      }
    }
    return normalized;
  }
  throw new TypeError(`canonical JSON rejects ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

/** Pretty canonical form for committed baseline JSON files (LF, EOF newline). */
export function canonicalJsonFileBytes(value: unknown): string {
  return `${JSON.stringify(normalizeJson(value), null, 2)}\n`;
}

export function sha256Bytes(value: string | Uint8Array): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256Canonical(value: unknown): ContentDigest {
  return sha256Bytes(canonicalJson(value));
}
