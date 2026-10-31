/** Bounded pure option observations. The W09-bound full fingerprint selects
 * evidence only; the canonical decision and live driver fences grant authority.
 * No elements, raw applicant values, selectors or action capability are cached. */
import type { FormFieldDescriptorV1OptionSemantic } from "@japp/contracts/generated";

export interface OptionMeaningApproval {
  readonly valueDigest: string;
  readonly labelDigest: string;
  readonly disabled: boolean;
}
export const MAX_OPTION_MEANING_SNAPSHOTS = 64;
export const MAX_OPTION_MEANING_BYTES = 256 * 1024;
const MAX_OPTIONS = 128;
const snapshots = new Map<
  string,
  {
    readonly options: readonly OptionMeaningApproval[];
    readonly bytes: number;
  }
>();
let retainedBytes = 0;

function retire(fingerprint: string): void {
  const prior = snapshots.get(fingerprint);
  if (prior !== undefined) retainedBytes -= prior.bytes;
  snapshots.delete(fingerprint);
}
export function rememberOptionMeaningSnapshot(
  fingerprint: string | undefined,
  options: readonly FormFieldDescriptorV1OptionSemantic[],
): void {
  if (fingerprint === undefined || options.length > MAX_OPTIONS) return;
  const prior = snapshots.get(fingerprint);
  if (prior !== undefined) {
    snapshots.delete(fingerprint);
    snapshots.set(fingerprint, prior);
    return;
  }
  const evidence = Object.freeze(
    options.map((option) =>
      Object.freeze({
        valueDigest: option.value_digest,
        labelDigest: option.label.text_digest,
        disabled: option.disabled,
      }),
    ),
  );
  // Account retained UTF-16 digest strings and a fixed per-entry payload
  // allowance. Entry/option counts independently bound container overhead.
  const bytes =
    2 * fingerprint.length +
    32 +
    evidence.reduce(
      (sum, option) =>
        sum + 2 * (option.valueDigest.length + option.labelDigest.length) + 16,
      0,
    );
  if (bytes > MAX_OPTION_MEANING_BYTES) return;
  snapshots.set(fingerprint, { options: evidence, bytes });
  retainedBytes += bytes;
  while (
    snapshots.size > MAX_OPTION_MEANING_SNAPSHOTS ||
    retainedBytes > MAX_OPTION_MEANING_BYTES
  ) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    retire(oldest);
  }
}
/** null means unavailable evidence, not an absent intended option. An address
 * without an option fingerprint explicitly observed an empty option inventory. */
export function approvedOptionMeaningSnapshot(
  fingerprint: string | undefined,
): readonly OptionMeaningApproval[] | null {
  if (fingerprint === undefined) return [];
  return snapshots.get(fingerprint)?.options ?? null;
}
export function optionMeaningSnapshotCapacity(): {
  entries: number;
  retained_bytes: number;
} {
  return { entries: snapshots.size, retained_bytes: retainedBytes };
}

/** A duplicated value never becomes either one selected meaning or known absence. */
export function selectOptionMeaning(
  snapshot: readonly OptionMeaningApproval[],
  valueDigest: string,
): OptionMeaningApproval | null | undefined {
  const matches = snapshot.filter(
    (option) => option.valueDigest === valueDigest,
  );
  return matches.length > 1 ? null : matches[0];
}
