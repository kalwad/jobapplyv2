import type {
  CommonProvenanceV1ContentDigest,
  CommonStableIdV1StableId,
} from "@japp/contracts/generated";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const STABLE_ID_PREFIX = /^[a-z][a-z0-9]{1,23}$/;

// Pure exact-input memoization; current DOM evidence is still reread at every
// resolution. The cache grants no field, selector, generation or action
// authority. It lives only in the current extension execution realm.
const MAX_HASH_CACHE_ENTRIES = 1024;
const MAX_HASH_CACHE_BYTES = 512 * 1024;
const MAX_HASH_CACHE_SEED_LENGTH = 4096;
const hashCache = new Map<
  string,
  { bytes: number; promise: Promise<Uint8Array<ArrayBuffer>> }
>();
let hashCacheBytes = 0;

function evictHash(value: string): void {
  const entry = hashCache.get(value);
  if (entry !== undefined) {
    hashCacheBytes -= entry.bytes;
    hashCache.delete(value);
  }
}

async function sha256Bytes(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const cached = hashCache.get(value);
  if (cached !== undefined) {
    hashCache.delete(value);
    hashCache.set(value, cached);
    return cached.promise;
  }
  const bytes = new TextEncoder().encode(value);
  const promise = crypto.subtle
    .digest("SHA-256", bytes)
    .then((digest) => new Uint8Array(digest))
    .catch((error: unknown) => {
      if (hashCache.get(value)?.promise === promise) evictHash(value);
      throw error;
    });
  if (value.length <= MAX_HASH_CACHE_SEED_LENGTH) {
    const retainedBytes = 2 * value.length + 32;
    hashCache.set(value, { bytes: retainedBytes, promise });
    hashCacheBytes += retainedBytes;
    while (
      hashCache.size > MAX_HASH_CACHE_ENTRIES ||
      hashCacheBytes > MAX_HASH_CACHE_BYTES
    ) {
      const oldest = hashCache.keys().next().value;
      if (oldest === undefined) break;
      evictHash(oldest);
    }
  }
  return promise;
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
 * Derive an opaque deterministic stable ID from semantic evidence.
 *
 * The 128-bit digest prefix is encoded as a 26-character Crockford base32
 * body (the same bounded body grammar as the canonical StableId contract).
 * Callers cannot recover or interpret the seed from the resulting ID.
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
