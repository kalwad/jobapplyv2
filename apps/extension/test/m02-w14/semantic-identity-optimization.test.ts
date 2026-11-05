import { createHash } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Exact pre-optimization reference, intentionally using independent BigInt. */
function referenceId(prefix: string, bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes.slice(0, 16)) value = (value << 8n) | BigInt(byte);
  let body = "";
  for (let index = 0; index < 26; index++) {
    body = CROCKFORD.charAt(Number(value & 31n)) + body;
    value >>= 5n;
  }
  return `${prefix}_${body}`;
}
function referenceHex(bytes: Uint8Array): string {
  return `sha256:${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
async function freshIdentity() {
  vi.resetModules();
  return import("../../src/semantic-identity.ts");
}
afterEach(() => {
  vi.restoreAllMocks();
});

describe("pure SHA helper preserves reference bytes and failure channels", () => {
  test("real SHA agrees across namespaces, NUL, Unicode and cache length boundaries", async () => {
    const identity = await freshIdentity();
    const seeds = [
      "",
      "First name",
      "first\0required",
      "Café\0東京",
      "e\u0301",
      "é",
      "\ud800",
      "😀".repeat(2048),
      "x".repeat(4095),
      "x".repeat(4096),
      "x".repeat(4097),
      "x".repeat(5000),
    ];
    const prefixes = [
      "ab",
      "a0",
      "field",
      "item",
      "result",
      "session",
      `n${"0".repeat(23)}`,
    ];
    for (const seed of seeds) {
      const bytes = new Uint8Array(createHash("sha256").update(seed).digest());
      expect(await identity.semanticDigest(seed)).toBe(referenceHex(bytes));
      for (const prefix of prefixes)
        expect(await identity.stableSemanticId(prefix, seed)).toBe(
          referenceId(prefix, bytes),
        );
    }
  });
  test("all 256 byte values, every digest bit and short/full/prefix boundaries match exact old encoding", async () => {
    const identity = await freshIdentity();
    let bytes = new Uint8Array(32);
    vi.spyOn(crypto.subtle, "digest").mockImplementation(() =>
      Promise.resolve(new Uint8Array(bytes).buffer),
    );
    const patterns: Uint8Array<ArrayBuffer>[] = [];
    for (let byte = 0; byte < 256; byte++)
      patterns.push(new Uint8Array(32).fill(byte));
    for (let bit = 0; bit < 256; bit++) {
      const pattern = new Uint8Array(32);
      pattern[Math.floor(bit / 8)] = 1 << (bit % 8);
      patterns.push(pattern);
    }
    for (const length of [0, 1, 2, 15, 16, 17, 31, 32, 33])
      patterns.push(
        Uint8Array.from({ length }, (_, index) => (index * 37 + 129) & 255),
      );
    for (const [index, pattern] of patterns.entries()) {
      bytes = pattern;
      const seed = `encoding-pattern-${String(index)}`;
      expect(await identity.semanticDigest(seed)).toBe(referenceHex(pattern));
      expect(await identity.stableSemanticId("field", seed)).toBe(
        referenceId("field", pattern),
      );
    }
    bytes = new Uint8Array(32).fill(255);
    expect(
      await identity.stableSemanticId("item", "explicit-leading-zero-bits"),
    ).toBe(`item_7${"Z".repeat(25)}`);
  });
  test("equal in-flight seeds share one native Promise across digest and namespace consumers", async () => {
    const identity = await freshIdentity();
    let release: ((buffer: ArrayBuffer) => void) | undefined;
    const pending = new Promise<ArrayBuffer>((resolve) => {
      release = resolve;
    });
    const native = vi.spyOn(crypto.subtle, "digest").mockReturnValue(pending);
    const first = identity.semanticDigest("inflight-cache");
    const second = identity.semanticDigest("inflight-cache");
    const field = identity.stableSemanticId("field", "inflight-cache");
    const item = identity.stableSemanticId("item", "inflight-cache");
    expect(native).toHaveBeenCalledTimes(1);
    const bytes = new Uint8Array(32).fill(165);
    release?.(bytes.buffer);
    expect(await first).toBe(referenceHex(bytes));
    expect(await second).toBe(referenceHex(bytes));
    expect(await field).toBe(referenceId("field", bytes));
    expect(await item).toBe(referenceId("item", bytes));
    expect(await identity.semanticDigest("inflight-cache")).toBe(
      referenceHex(bytes),
    );
    expect(native).toHaveBeenCalledTimes(1);
  });
  test("the unchanged 4096 seed cap and 512 KiB payload bound evict without stale results", async () => {
    const identity = await freshIdentity();
    const realDigest = crypto.subtle.digest.bind(crypto.subtle);
    const native = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementation(realDigest);
    const boundary = "a".repeat(4096);
    expect(await identity.semanticDigest(boundary)).toBe(
      await identity.semanticDigest(boundary),
    );
    expect(native).toHaveBeenCalledTimes(1);
    await identity.semanticDigest("a".repeat(4097));
    await identity.semanticDigest("a".repeat(4097));
    expect(native).toHaveBeenCalledTimes(3);
    const original = "0000" + "b".repeat(4092);
    const expected = await identity.semanticDigest(original);
    for (let index = 1; index <= 64; index++)
      await identity.semanticDigest(
        String(index).padStart(4, "0") + "b".repeat(4092),
      );
    const before = native.mock.calls.length;
    expect(await identity.semanticDigest(original)).toBe(expected);
    expect(native.mock.calls.length).toBe(before + 1);
  });
  test("native synchronous throws are rejected Promises and cannot poison retry", async () => {
    const identity = await freshIdentity();
    const error = new Error("synthetic native synchronous failure");
    const realDigest = crypto.subtle.digest.bind(crypto.subtle);
    const native = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockImplementation(realDigest);
    const promise = identity.semanticDigest("sync-native-failure");
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toBe(error);
    expect(await identity.semanticDigest("sync-native-failure")).toBe(
      `sha256:${createHash("sha256").update("sync-native-failure").digest("hex")}`,
    );
    expect(native).toHaveBeenCalledTimes(2);
  });
  test("non-Error synchronous rejection identity is preserved too", async () => {
    const identity = await freshIdentity();
    const reason = Symbol("synthetic native rejection reason");
    vi.spyOn(crypto.subtle, "digest").mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Intentionally model a native non-Error throw to verify exact rejection identity.
      throw reason;
    });
    const promise = identity.semanticDigest("non-error-native-failure");
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toBe(reason);
  });
  test("native asynchronous rejection retires failed shared evidence before retry", async () => {
    const identity = await freshIdentity();
    const error = new Error("synthetic native asynchronous failure");
    const realDigest = crypto.subtle.digest.bind(crypto.subtle);
    const native = vi
      .spyOn(crypto.subtle, "digest")
      .mockRejectedValueOnce(error)
      .mockImplementation(realDigest);
    await expect(
      identity.stableSemanticId("field", "async-native-failure"),
    ).rejects.toBe(error);
    expect(await identity.semanticDigest("async-native-failure")).toBe(
      `sha256:${createHash("sha256").update("async-native-failure").digest("hex")}`,
    );
    expect(native).toHaveBeenCalledTimes(2);
  });
  test("synchronous seed encoding failure stays in rejected-Promise channel for both APIs", async () => {
    const identity = await freshIdentity();
    const error = new Error("synthetic encoder failure");
    vi.spyOn(TextEncoder.prototype, "encode").mockImplementation(() => {
      throw error;
    });
    const digest = identity.semanticDigest("encoder-failure-digest");
    const stable = identity.stableSemanticId("field", "encoder-failure-id");
    expect(digest).toBeInstanceOf(Promise);
    expect(stable).toBeInstanceOf(Promise);
    await expect(digest).rejects.toBe(error);
    await expect(stable).rejects.toBe(error);
  });
  test("invalid namespaces still reject before any native hash call", async () => {
    const identity = await freshIdentity();
    const native = vi.spyOn(crypto.subtle, "digest");
    for (const prefix of [
      "a",
      "A0",
      "0a",
      "a_",
      "field-name",
      "αa",
      "n".repeat(25),
    ])
      await expect(
        identity.stableSemanticId(prefix, "rejected-namespace"),
      ).rejects.toThrow("invalid stable ID prefix");
    expect(native).not.toHaveBeenCalled();
  });
});
