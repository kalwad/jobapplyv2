import { createHash } from "node:crypto";

import { runnerFail } from "./errors.ts";

export type ContentDigest = `sha256:${string}`;
export type CanonicalValue =
  | boolean
  | null
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

function canonicalize(value: unknown, pointer: string): CanonicalValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return runnerFail(
        "RUNNER_NONFINITE_NUMBER",
        pointer,
        "NaN and Infinity are not canonical JSON values",
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      canonicalize(entry, `${pointer}/${String(index)}`),
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      return runnerFail(
        "RUNNER_NONCANONICAL_OBJECT",
        pointer,
        "only ordinary JSON objects are accepted",
      );
    }
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        return runnerFail(
          "RUNNER_UNDEFINED_VALUE",
          `${pointer}/${key}`,
          "undefined is not a JSON value",
        );
      }
      result[key] = canonicalize(entry, `${pointer}/${key}`);
    }
    return result;
  }
  return runnerFail(
    "RUNNER_NONJSON_VALUE",
    pointer,
    `unsupported ${typeof value} value`,
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value, ""));
}

export function canonicalJsonBytes(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

export function sha256Bytes(value: string | Uint8Array): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256Canonical(value: unknown): ContentDigest {
  return sha256Bytes(canonicalJson(value));
}

export function isContentDigest(value: unknown): value is ContentDigest {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

/** Locale-independent UTF-16 code-unit ordering for canonical projections. */
export function compareCanonicalText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Build an opaque stable-id body from the first 128 digest bits. The leading
 * Crockford digit is therefore at most 7, matching a 128-bit ULID-shaped body,
 * but no timestamp or randomness participates.
 */
export function stableIdFromDigest(
  prefix: string,
  digest: ContentDigest,
): string {
  if (!/^[a-z][a-z0-9]{1,23}$/u.test(prefix)) {
    return runnerFail(
      "RUNNER_STABLE_ID_PREFIX",
      "/prefix",
      "stable-id prefix is outside the canonical contract grammar",
    );
  }
  if (!isContentDigest(digest)) {
    return runnerFail(
      "RUNNER_DIGEST_FORMAT",
      "/digest",
      "stable-id derivation requires a SHA-256 content digest",
    );
  }
  let value = BigInt(`0x${digest.slice(7, 39)}`);
  let body = "";
  for (let index = 0; index < 26; index += 1) {
    const digit = CROCKFORD.at(Number(value & 31n));
    if (digit === undefined) {
      return runnerFail(
        "RUNNER_STABLE_ID_ENCODING",
        "/digest",
        "stable-id digest chunk is outside Crockford base32",
      );
    }
    body = digit + body;
    value >>= 5n;
  }
  return `${prefix}_${body}`;
}
