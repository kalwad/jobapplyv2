import { createHash } from "node:crypto";

export type ContentDigest = `sha256:${string}`;

function normalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("CORPUS_CANONICAL_NUMBER");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) {
        output[key] = normalize(child);
      }
    }
    return output;
  }
  throw new TypeError("CORPUS_CANONICAL_TYPE");
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function canonicalFile(value: unknown): string {
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

export function sha256Bytes(value: string | Uint8Array): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256Canonical(value: unknown): ContentDigest {
  return sha256Bytes(canonicalJson(value));
}

export function withoutKey(
  value: Readonly<Record<string, unknown>>,
  omitted: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== omitted),
  );
}
