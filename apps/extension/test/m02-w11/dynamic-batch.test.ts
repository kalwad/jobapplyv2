// M02-W11 pure batching/coalescing proofs (REQ-FORM-018 feasibility
// portion): deterministic region deduplication, parent/child overlap
// coalescing, bounded overflow escalation, and bounded queue behavior —
// all DOM-free.
import { describe, expect, test } from "vitest";

import {
  BATCH_DEBOUNCE_MS,
  BoundedRecordQueue,
  MAX_AFFECTED_REGIONS_PER_BATCH,
  MAX_PENDING_MUTATION_RECORDS,
  planAffectedRegions,
} from "../../src/dynamic-batch.ts";

interface Region {
  readonly name: string;
  readonly parent: Region | null;
}

function region(name: string, parent: Region | null = null): Region {
  return { name, parent };
}

function contains(parent: Region, child: Region): boolean {
  for (let current: Region | null = child; current !== null;) {
    if (current === parent) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

describe("affected-region planning", () => {
  test("bounds are explicit and sane", () => {
    expect(MAX_AFFECTED_REGIONS_PER_BATCH).toBe(24);
    expect(MAX_PENDING_MUTATION_RECORDS).toBe(4096);
    expect(BATCH_DEBOUNCE_MS).toBe(25);
  });

  test("a burst repeating one region coalesces to exactly one region", () => {
    const leaf = region("leaf");
    const plan = planAffectedRegions(
      Array.from({ length: 500 }, () => leaf),
      contains,
    );
    expect(plan.escalateToRoot).toBe(false);
    expect(plan.regions).toEqual([leaf]);
  });

  test("descendants of a selected region are deduplicated away", () => {
    const parent = region("parent");
    const childA = region("childA", parent);
    const grandchild = region("grandchild", childA);
    const sibling = region("sibling");
    const plan = planAffectedRegions(
      [childA, grandchild, parent, sibling, parent, grandchild],
      contains,
    );
    expect(plan.escalateToRoot).toBe(false);
    expect(plan.regions).toEqual([parent, sibling]);
  });

  test("unrelated leaf regions are all preserved in first-seen order", () => {
    const alpha = region("a");
    const beta = region("b");
    const gamma = region("c");
    const plan = planAffectedRegions([gamma, alpha, beta], contains);
    expect(plan.regions.map((entry) => entry.name)).toEqual(["c", "a", "b"]);
  });

  test("identical inputs always produce the identical plan", () => {
    const parent = region("parent");
    const children = Array.from({ length: 8 }, (_, index) =>
      region(`child${String(index)}`, parent),
    );
    const input = [...children, parent];
    const first = planAffectedRegions(input, contains);
    const second = planAffectedRegions(input, contains);
    expect(second).toEqual(first);
    expect(first.regions).toEqual([parent]);
  });

  test("more unique regions than the limit escalates to one root scan", () => {
    const unique = Array.from(
      { length: MAX_AFFECTED_REGIONS_PER_BATCH + 1 },
      (_, index) => region(`r${String(index)}`),
    );
    const plan = planAffectedRegions(unique, contains);
    expect(plan.escalateToRoot).toBe(true);
    expect(plan.regions).toEqual([]);
    const withinLimit = planAffectedRegions(
      unique.slice(0, MAX_AFFECTED_REGIONS_PER_BATCH),
      contains,
    );
    expect(withinLimit.escalateToRoot).toBe(false);
    expect(withinLimit.regions).toHaveLength(MAX_AFFECTED_REGIONS_PER_BATCH);
  });
});

describe("bounded record queue", () => {
  test("enqueue/drain round-trips in order and resets", () => {
    const queue = new BoundedRecordQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    expect(queue.length).toBe(3);
    const first = queue.drain();
    expect(first.records).toEqual([1, 2, 3]);
    expect(first.overflowed).toBe(false);
    expect(queue.length).toBe(0);
    const second = queue.drain();
    expect(second.records).toEqual([]);
    expect(second.overflowed).toBe(false);
  });

  test("overflow drops beyond the hard cap and reports it once", () => {
    const queue = new BoundedRecordQueue<number>();
    for (let index = 0; index < MAX_PENDING_MUTATION_RECORDS + 50; index += 1) {
      queue.enqueue(index);
    }
    expect(queue.length).toBe(MAX_PENDING_MUTATION_RECORDS);
    expect(queue.maxObservedLength).toBe(MAX_PENDING_MUTATION_RECORDS);
    const drained = queue.drain();
    expect(drained.records).toHaveLength(MAX_PENDING_MUTATION_RECORDS);
    expect(drained.overflowed).toBe(true);
    // The overflow marker does not leak into the next quiet batch.
    queue.enqueue(7);
    const next = queue.drain();
    expect(next.records).toEqual([7]);
    expect(next.overflowed).toBe(false);
  });

  test("clear empties pending records and the overflow marker", () => {
    const queue = new BoundedRecordQueue<string>();
    for (let index = 0; index < MAX_PENDING_MUTATION_RECORDS + 1; index += 1) {
      queue.enqueue("record");
    }
    queue.clear();
    expect(queue.length).toBe(0);
    const drained = queue.drain();
    expect(drained.records).toEqual([]);
    expect(drained.overflowed).toBe(false);
  });
});
