// Deterministic receipt issuance and duplicate detection (M02-W03).
//
// Receipt identity is a fixed prefix plus the zero-padded submission
// ordinal within the current browsing session — never time- or
// randomness-derived. A second submission of the same synthetic
// application key yields a duplicate warning instead of a new receipt.

import { RECEIPT_PREFIX } from "./constants.ts";
import type { FlowFields } from "./flow-state.ts";

export interface ReceiptRecord {
  readonly id: string;
  readonly applicationKey: string;
}

export interface ReceiptState {
  readonly version: 1;
  readonly issued: readonly ReceiptRecord[];
}

export interface SubmissionOutcome {
  readonly state: ReceiptState;
  readonly kind: "ISSUED" | "DUPLICATE";
  readonly receipt: ReceiptRecord;
}

export function initialReceiptState(): ReceiptState {
  return { version: 1, issued: [] };
}

/** RCPT-MOCK-0001, RCPT-MOCK-0002, … */
export function receiptIdFor(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 9999) {
    throw new Error(
      `receipt ordinal out of deterministic range: ${String(ordinal)}`,
    );
  }
  return `${RECEIPT_PREFIX}${String(ordinal).padStart(4, "0")}`;
}

/** Synthetic application identity: applicant email plus position. */
export function applicationKeyFor(fields: FlowFields): string {
  return `${fields.email.trim().toLowerCase()}|${fields.position}`;
}

/** Issue a receipt, or report the duplicate that already holds the key. */
export function recordSubmission(
  state: ReceiptState,
  applicationKey: string,
): SubmissionOutcome {
  const existing = state.issued.find(
    (record) => record.applicationKey === applicationKey,
  );
  if (existing !== undefined) {
    return { state, kind: "DUPLICATE", receipt: existing };
  }
  const receipt: ReceiptRecord = {
    id: receiptIdFor(state.issued.length + 1),
    applicationKey,
  };
  return {
    state: { version: 1, issued: [...state.issued, receipt] },
    kind: "ISSUED",
    receipt,
  };
}
