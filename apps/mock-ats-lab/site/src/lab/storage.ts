// sessionStorage persistence for the multipage flow and receipts
// (M02-W03). sessionStorage is scoped to the browsing context, so every
// fresh Playwright context starts from the exact initial state; the lab
// additionally exposes an explicit reset action.

import { FLOW_STORAGE_KEY, RECEIPT_STORAGE_KEY } from "./constants.ts";
import { initialFlowState, type FlowState } from "./flow-state.ts";
import { initialReceiptState, type ReceiptState } from "./receipts.ts";

function readJson(key: string): unknown {
  const raw = window.sessionStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function loadFlowState(): FlowState {
  const parsed = readJson(FLOW_STORAGE_KEY);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { version?: unknown }).version === 1
  ) {
    return parsed as FlowState;
  }
  return initialFlowState();
}

export function saveFlowState(state: FlowState): void {
  window.sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(state));
}

export function loadReceiptState(): ReceiptState {
  const parsed = readJson(RECEIPT_STORAGE_KEY);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { version?: unknown }).version === 1
  ) {
    return parsed as ReceiptState;
  }
  return initialReceiptState();
}

export function saveReceiptState(state: ReceiptState): void {
  window.sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(state));
}

/** Deterministic full reset of every lab-owned session key. */
export function resetLabSession(): void {
  window.sessionStorage.removeItem(FLOW_STORAGE_KEY);
  window.sessionStorage.removeItem(RECEIPT_STORAGE_KEY);
}
