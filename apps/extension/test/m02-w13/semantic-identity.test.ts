import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  semanticDigest,
  stableSemanticId,
} from "../../src/semantic-identity.ts";

describe("W13 exact-input hashing preserves freshly read evidence", () => {
  it("matches independent SHA-256 for repeated, changed, unicode and NUL evidence", async () => {
    for (const seed of [
      "First name",
      "First name\0required",
      "Second name",
      "Café\0東京",
      "x".repeat(5000),
    ]) {
      const expected = `sha256:${createHash("sha256").update(seed).digest("hex")}`;
      expect(await semanticDigest(seed)).toBe(expected);
      expect(await semanticDigest(seed)).toBe(expected);
    }
    expect(await semanticDigest("First name")).not.toBe(
      await semanticDigest("Second name"),
    );
  });
  it("eviction and distinct stable-ID prefixes cannot reuse stale semantic truth", async () => {
    const original = await stableSemanticId("field", "Synthetic original");
    for (let i = 0; i < 1100; i += 1)
      await semanticDigest(`Synthetic eviction ${String(i)}`);
    expect(await stableSemanticId("field", "Synthetic original")).toBe(
      original,
    );
    expect(await stableSemanticId("field", "Synthetic changed")).not.toBe(
      original,
    );
    expect(await stableSemanticId("item", "Synthetic original")).toBe(
      original.replace("field_", "item_"),
    );
  });
});
