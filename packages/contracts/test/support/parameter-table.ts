const MAX_PARAMETER_TABLE_CASES = 10_000;

/**
 * Snapshot a derived parameter table before Vitest registers its cases.
 *
 * The captured `forEach` visits the same occupied slots Vitest visits for
 * array parameter tables. The returned dense copy therefore preserves every
 * generated case while making later mutation of the source array irrelevant.
 */
export function assertNonEmptyParameterTable<T>(
  rows: readonly T[],
): readonly T[] {
  if (!Array.isArray(rows) || rows.length > MAX_PARAMETER_TABLE_CASES) {
    throw new Error("parameter table is not a bounded array");
  }
  const snapshot: T[] = [];
  Array.prototype.forEach.call(rows, (row: T) =>
    Array.prototype.push.call(snapshot, row),
  );
  if (snapshot.length === 0) {
    throw new Error("parameter table has no occupied cases");
  }
  return Object.freeze(snapshot);
}
