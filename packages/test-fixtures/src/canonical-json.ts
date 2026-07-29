import { createHash } from "node:crypto";

import type { ContentDigest, FixtureEntity, FixtureManifest } from "./model.ts";

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

export function sha256Bytes(value: string | Uint8Array): ContentDigest {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256Canonical(value: unknown): ContentDigest {
  return sha256Bytes(canonicalJson(value));
}

export function fixtureEntityHash(entity: FixtureEntity): ContentDigest {
  const { historical_content_hash: _historicalHash, ...metadata } =
    entity.metadata;
  void _historicalHash;
  return sha256Canonical({ ...entity, metadata });
}

export function fixtureManifestHash(manifest: FixtureManifest): ContentDigest {
  const { historical_content_hash: _historicalHash, ...metadata } =
    manifest.metadata;
  void _historicalHash;
  return sha256Canonical({ ...manifest, metadata });
}
