// M02-W11 pure batching/coalescing model (REQ-FORM-018 feasibility portion).
//
// DOM-free by construction: the frame engine hands this module opaque region
// handles plus a containment relation, and receives back the minimal
// deduplicated affected-region plan for one bounded batch. Keeping the
// arithmetic here pure lets the permanent unit matrix prove coalescing,
// overlap deduplication, and overflow escalation without any browser.

/** Regions per processed batch before escalating to one bounded root scan. */
export const MAX_AFFECTED_REGIONS_PER_BATCH = 24;

/** Queued MutationRecords retained before the queue escalates and drops. */
export const MAX_PENDING_MUTATION_RECORDS = 4096;

/** Task-boundary debounce for one coalesced batch. */
export const BATCH_DEBOUNCE_MS = 25;

export interface AffectedRegionPlan<T> {
  /**
   * Minimal region set: duplicates removed, and every region that is a
   * descendant of another selected region removed, in first-seen order.
   */
  readonly regions: readonly T[];
  /**
   * True when the batch must be one bounded application-root rescan instead
   * of per-region subtree scans (region overflow). Escalation is to the
   * application root only — never to the whole document.
   */
  readonly escalateToRoot: boolean;
}

/**
 * Coalesce one batch's affected regions.
 *
 * `contains(a, b)` must be true when `b` is inside `a` (strict or equal);
 * the DOM adapter is `(a, b) => a === b || a.contains(b)`. The relation is
 * only ever consulted pairwise on the bounded deduplicated set, so one
 * batch's planning cost is O(min(n, limit)^2) with a hard cap.
 */
export function planAffectedRegions<T>(
  candidates: readonly T[],
  contains: (parent: T, child: T) => boolean,
  limit: number = MAX_AFFECTED_REGIONS_PER_BATCH,
): AffectedRegionPlan<T> {
  const unique: T[] = [];
  const seen = new Set<T>();
  for (const candidate of candidates) {
    if (!seen.has(candidate)) {
      seen.add(candidate);
      unique.push(candidate);
    }
  }
  if (unique.length > limit) {
    return { regions: [], escalateToRoot: true };
  }
  const selected: T[] = [];
  for (const candidate of unique) {
    if (
      !unique.some((other) => other !== candidate && contains(other, candidate))
    ) {
      selected.push(candidate);
    }
  }
  return { regions: selected, escalateToRoot: false };
}

/**
 * Bounded pending-record queue for one frame observer. Enqueue never grows
 * beyond MAX_PENDING_MUTATION_RECORDS: overflow drops the record, remembers
 * that it did, and the next processed batch escalates to one bounded root
 * rescan so no dropped evidence is silently lost.
 */
export class BoundedRecordQueue<T> {
  #records: T[] = [];
  #overflowed = false;
  #maxObservedLength = 0;

  enqueue(record: T): void {
    if (this.#records.length >= MAX_PENDING_MUTATION_RECORDS) {
      this.#overflowed = true;
      return;
    }
    this.#records.push(record);
    if (this.#records.length > this.#maxObservedLength) {
      this.#maxObservedLength = this.#records.length;
    }
  }

  /** Drain every queued record and the overflow marker for one batch. */
  drain(): { records: readonly T[]; overflowed: boolean } {
    const records = this.#records;
    const overflowed = this.#overflowed;
    this.#records = [];
    this.#overflowed = false;
    return { records, overflowed };
  }

  clear(): void {
    this.#records = [];
    this.#overflowed = false;
  }

  get length(): number {
    return this.#records.length;
  }

  get maxObservedLength(): number {
    return this.#maxObservedLength;
  }
}
