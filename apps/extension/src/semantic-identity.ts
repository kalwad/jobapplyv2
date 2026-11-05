import type {
  CommonProvenanceV1ContentDigest,
  CommonStableIdV1StableId,
} from "@japp/contracts/generated";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HEXADECIMAL = "0123456789abcdef";
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

function sha256Bytes(value: string): Promise<Uint8Array<ArrayBuffer>> {
  try {
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
  } catch (error: unknown) {
    // Preserve the async helper's exact rejection identity, even for a native
    // or encoder that synchronously throws a non-Error value.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject(error);
  }
}

function hexadecimal(bytes: Uint8Array<ArrayBuffer>): string {
  let result = "";
  for (const value of bytes) {
    result += HEXADECIMAL.charAt(value >>> 4) + HEXADECIMAL.charAt(value & 15);
  }
  return result;
}

/** The existing 26-digit body represents 128 bits with TWO leading zero bits.
 * A small integer buffer replaces BigInt allocation; no right-padding occurs.
 * The short-buffer branch preserves the reference's left padding defensively. */
function stableBody(bytes: Uint8Array<ArrayBuffer>): string {
  const length = Math.min(bytes.length, 16);
  let bits = 130 - length * 8;
  let body = "0".repeat(Math.floor(bits / 5));
  bits %= 5;
  let buffer = 0;
  for (let index = 0; index < length; index += 1) {
    buffer = (buffer << 8) | (bytes[index] ?? 0);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      body += CROCKFORD_BASE32.charAt((buffer >>> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }
  return body;
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
  return `${prefix}_${stableBody(bytes)}`;
}
