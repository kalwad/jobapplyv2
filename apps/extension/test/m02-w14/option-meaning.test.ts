import { describe, expect, test } from "vitest";
import {
  approvedOptionMeaningSnapshot,
  rememberOptionMeaningSnapshot,
  optionMeaningSnapshotCapacity,
  MAX_OPTION_MEANING_BYTES,
  MAX_OPTION_MEANING_SNAPSHOTS,
  selectOptionMeaning,
} from "../../src/option-meaning.ts";

const digest = (seed: number) =>
  `sha256:${seed.toString(16).padStart(64, "0")}`;
function option(seed: number) {
  return {
    value_digest: digest(seed),
    label: { text_digest: digest(seed + 10000), untrusted: true as const },
    disabled: false,
  };
}

describe("W14 bounded original option evidence", () => {
  test("an old approved fingerprint retains its exact label after caller and newer observation changes", () => {
    const original = option(100);
    rememberOptionMeaningSnapshot(digest(1000), [original]);
    original.label.text_digest = digest(9999);
    rememberOptionMeaningSnapshot(digest(1001), [original]);
    expect(approvedOptionMeaningSnapshot(digest(1000))).toEqual([
      { valueDigest: digest(100), labelDigest: digest(10100), disabled: false },
    ]);
    expect(approvedOptionMeaningSnapshot(digest(1001))?.[0]?.labelDigest).toBe(
      digest(9999),
    );
    expect(
      Object.isFrozen(approvedOptionMeaningSnapshot(digest(1000))?.[0]),
    ).toBe(true);
  });
  test("duplicate selected tuples fail closed rather than becoming known absence", () => {
    const selected = {
      valueDigest: digest(6000),
      labelDigest: digest(6001),
      disabled: false,
    };
    expect(
      selectOptionMeaning(
        [selected, { ...selected, labelDigest: digest(6002) }],
        selected.valueDigest,
      ),
    ).toBeNull();
    expect(selectOptionMeaning([selected], digest(6003))).toBeUndefined();
    expect(selectOptionMeaning([selected], selected.valueDigest)).toEqual(
      selected,
    );
  });
  test("unknown or evicted evidence never becomes known absent evidence", () => {
    expect(approvedOptionMeaningSnapshot(undefined)).toEqual([]);
    expect(approvedOptionMeaningSnapshot(digest(999999))).toBeNull();
    for (let seed = 2000; seed <= 2000 + MAX_OPTION_MEANING_SNAPSHOTS; seed++)
      rememberOptionMeaningSnapshot(digest(seed), [option(seed)]);
    expect(approvedOptionMeaningSnapshot(digest(2000))).toBeNull();
    expect(
      approvedOptionMeaningSnapshot(
        digest(2000 + MAX_OPTION_MEANING_SNAPSHOTS),
      ),
    ).toHaveLength(1);
    expect(optionMeaningSnapshotCapacity().entries).toBeLessThanOrEqual(
      MAX_OPTION_MEANING_SNAPSHOTS,
    );
  });
  test("byte pressure evicts whole observations and oversized option prefixes are never retained", () => {
    const options = Array.from({ length: 128 }, (_, index) =>
      option(3000 + index),
    );
    for (let seed = 4000; seed < 4020; seed++)
      rememberOptionMeaningSnapshot(digest(seed), options);
    expect(approvedOptionMeaningSnapshot(digest(4000))).toBeNull();
    expect(approvedOptionMeaningSnapshot(digest(4019))).toHaveLength(128);
    expect(optionMeaningSnapshotCapacity().retained_bytes).toBeLessThanOrEqual(
      MAX_OPTION_MEANING_BYTES,
    );
    rememberOptionMeaningSnapshot(digest(5000), [...options, option(5000)]);
    expect(approvedOptionMeaningSnapshot(digest(5000))).toBeNull();
  });
});
