// M02-W09 deterministic identity helpers.
//
// Same canonical wire grammars as the verified W08 extension helpers
// (apps/extension/src/semantic-identity.ts): SHA-256 content digests in the
// canonical `sha256:<64 hex>` form and opaque Crockford-base32 stable IDs.
// WebCrypto (`globalThis.crypto.subtle`) is used so the identical bytes run
// in Node test processes today and inside the MV3 extension when W10
// consumes this library; no Node-only crypto API is referenced.
import type {
  CommonProvenanceV1ContentDigest,
  CommonStableIdV1StableId,
} from "@japp/contracts/generated";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const STABLE_ID_PREFIX = /^[a-z][a-z0-9]{1,23}$/;

async function sha256Bytes(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

function hexadecimal(bytes: Uint8Array<ArrayBuffer>): string {
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

/** Compute the canonical SHA-256 wire representation used by M01 contracts. */
export async function semanticDigest(
  value: string,
): Promise<CommonProvenanceV1ContentDigest> {
  return `sha256:${hexadecimal(await sha256Bytes(value))}`;
}

/**
 * Derive an opaque deterministic stable ID from semantic evidence. The
 * 128-bit digest prefix is encoded as a 26-character Crockford base32 body
 * (the canonical StableId body grammar); callers cannot recover or
 * interpret the seed from the resulting ID.
 */
export async function stableSemanticId(
  prefix: string,
  seed: string,
): Promise<CommonStableIdV1StableId> {
  if (!STABLE_ID_PREFIX.test(prefix)) {
    throw new Error(`invalid stable ID prefix: ${prefix}`);
  }
  const bytes = await sha256Bytes(seed);
  let value = 0n;
  for (const byte of bytes.slice(0, 16)) {
    value = (value << 8n) | BigInt(byte);
  }
  let body = "";
  for (let index = 0; index < 26; index += 1) {
    body = CROCKFORD_BASE32.charAt(Number(value & 31n)) + body;
    value >>= 5n;
  }
  return `${prefix}_${body}`;
}

/**
 * Canonical deterministic JSON serialization: object keys sorted at every
 * depth, arrays kept in order, no whitespace. Used so digests over contract
 * values never depend on runtime property-insertion order.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(",")}}`;
  }
  if (value === undefined) {
    return "null";
  }
  return JSON.stringify(value);
}
