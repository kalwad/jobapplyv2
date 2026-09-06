// Shared W12 harness derived from retained W11 browser proof; original tests remain byte-identical.
// M02-W11 real-MV3 dynamic-state proof. Every scenario routes through the
// generated WXT worker, the registered frame content agent, W08 semantic
// scanning/re-resolution, canonical W09 decisions, the W10 transaction
// kernel, and the W11 dynamic engine — bounded observation, batched
// affected-subtree scanning, conditional discovery/removal, duplicate-action
// suppression, page-changed-value detection, canonical reconciliation, and
// truthful CPU/memory/scan instrumentation — in bundled Chromium.
import type {
  FormFieldDecisionV1,
  FormFieldDescriptorV1,
} from "../../../packages/contracts/generated/typescript/index.ts";
import {
  validateFormReconciliationInventoryV1,
  validateSemanticContractV1,
} from "../../../packages/contracts/generated/typescript/index.ts";
import type { BrowserContext, Page, Worker } from "@playwright/test";

import { fieldAddressDigest } from "../../../apps/extension/src/driver-evidence.ts";
import type {
  DriverIntendedValue,
  DriverTransactionRequest,
} from "../../../apps/extension/src/driver-protocol.ts";
import {
  buildDynamicExecuteTabRequest,
  buildDynamicReconcileTabRequest,
  buildDynamicStartTabRequest,
  buildDynamicStateTabRequest,
  buildDynamicStopTabRequest,
  parseDynamicExecuteTabResult,
  parseDynamicReconcileTabResult,
  parseDynamicStartTabResult,
  parseDynamicStateTabResult,
  parseDynamicStopTabResult,
  type DynamicInstrumentationSnapshot,
  type DynamicReconcileOutcome,
} from "../../../apps/extension/src/dynamic-protocol.ts";
import {
  buildScanTabRequest,
  CONTENT_FRAME_SCAN_FOUND,
  parseAggregatedScanResult,
  type FrameScanReport,
} from "../../../apps/extension/src/scanner-protocol.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../../apps/extension/src/feasibility-protocol.ts";
import { stableSemanticId } from "../../../apps/extension/src/semantic-identity.ts";
import { expect, LAB_ORIGIN } from "./extension-test.ts";

export const READY_TIMEOUT_MS = 15_000;
export const DRAIN_TIMEOUT_MS = 15_000;
export const DRAIN_POLL_MS = 50;
let sequence = 0;

export function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
}

export interface ChromeTab {
  readonly id?: number;
}

export interface Harness {
  readonly page: Page;
  readonly controller: Page;
  readonly tabId: number;
}

export function requireValue<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export async function tabIdForPage(
  serviceWorker: Worker,
  page: Page,
): Promise<number> {
  await page.bringToFront();
  return serviceWorker.evaluate(async () => {
    const runtime = globalThis as unknown as {
      chrome: { tabs: { query(query: object): Promise<ChromeTab[]> } };
    };
    const tabs = await runtime.chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const match = tabs[0];
    if (tabs.length !== 1 || match?.id === undefined) {
      throw new Error("no unique active browser tab");
    }
    return match.id;
  });
}

export async function runtimeMessage(
  controller: Page,
  message: unknown,
): Promise<unknown> {
  return controller.evaluate(async (wireMessage) => {
    const runtime = globalThis as unknown as {
      chrome: { runtime: { sendMessage(value: unknown): Promise<unknown> } };
    };
    return runtime.chrome.runtime.sendMessage(wireMessage);
  }, message);
}

export async function openHarness(
  extensionContext: BrowserContext,
  extensionId: string,
  serviceWorker: Worker,
  route: string,
): Promise<Harness> {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}${route}`);
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: READY_TIMEOUT_MS },
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await extensionContext.newPage();
  await controller.goto(`chrome-extension://${extensionId}/manifest.json`);
  return { page, controller, tabId };
}

export async function setFixture(
  harness: Harness,
  markup: string,
): Promise<void> {
  await harness.page.locator("body").evaluate((body, value) => {
    body.innerHTML = value;
  }, markup);
}

export async function scanFrames(harness: Harness): Promise<FrameScanReport[]> {
  const response = await runtimeMessage(
    harness.controller,
    buildScanTabRequest(nextId("scan"), harness.tabId, {
      kind: "APPLICATION_ROOT",
    }),
  );
  const parsed = parseAggregatedScanResult(response);
  expect(parsed).not.toBeNull();
  return [...requireValue(parsed, "invalid aggregate").frames];
}

export function foundTopFrame(
  frames: readonly FrameScanReport[],
): FrameScanReport {
  return requireValue(
    frames.find(
      (frame) =>
        frame.frame_context.is_top_frame &&
        frame.root_status === CONTENT_FRAME_SCAN_FOUND,
    ),
    "top frame with application root missing",
  );
}

export function descriptorByLabel(
  values: readonly FormFieldDescriptorV1[],
  label: string,
): FormFieldDescriptorV1 {
  return requireValue(
    values.find((value) => value.label.normalized_text === label),
    `descriptor labelled ${label} is missing`,
  );
}

export async function fillDecision(
  descriptor: FormFieldDescriptorV1,
  seed: string,
): Promise<FormFieldDecisionV1> {
  const correlationId = await stableSemanticId("cor", `w12-research\0${seed}`);
  return {
    decision_id: await stableSemanticId("decision", `w12-research\0${seed}`),
    field_id: descriptor.field_id,
    field_address_digest: await fieldAddressDigest(descriptor.address),
    field_concept: "FIRST_NAME",
    classification_confidence: 1,
    value_source_type: "USER_RECORD",
    value_source_ref: await stableSemanticId("record", `w12-research\0${seed}`),
    value_confidence: 1,
    sensitivity_class: "PERSONAL",
    policy_decision: "PERMIT",
    final_decision: "FILL",
    confirmation_state: "NOT_REQUIRED",
    reason_codes: ["REVIEWED_SOURCE"],
    provenance: {
      source_kind: "USER_INPUT",
      source_id: await stableSemanticId("source", `w12-research\0${seed}`),
      observed_at: "2026-08-24T00:00:00Z",
      confidence: 1,
    },
    correlation_id: correlationId,
  };
}

export async function blockedSensitiveDecision(
  descriptor: FormFieldDescriptorV1,
  seed: string,
): Promise<FormFieldDecisionV1> {
  const base = await fillDecision(descriptor, seed);
  return {
    ...base,
    sensitivity_class: "SENSITIVE",
    policy_decision: "REQUIRE_CONFIRMATION",
    final_decision: "PAUSE_FOR_CONFIRMATION",
    confirmation_state: "MISSING",
    reason_codes: ["SENSITIVE_CONFIRMATION_REQUIRED", "CONFIRMATION_MISSING"],
  };
}

export async function buildTransaction(
  descriptor: FormFieldDescriptorV1,
  intended: DriverIntendedValue,
  decision: FormFieldDecisionV1,
  seed: string,
): Promise<DriverTransactionRequest> {
  return {
    transaction_id: await stableSemanticId(
      "transaction",
      `w12-research-transaction\0${seed}`,
    ),
    correlation_id: decision.correlation_id,
    address: descriptor.address,
    decision,
    intended,
    settle: { budget_ms: 75 },
  };
}

export async function dynStart(harness: Harness, frameId: string) {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicStartTabRequest(nextId("start"), harness.tabId, frameId),
  );
  const parsed = parseDynamicStartTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid start result").outcome;
}

export async function dynStop(harness: Harness, frameId: string) {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicStopTabRequest(nextId("stop"), harness.tabId, frameId),
  );
  const parsed = parseDynamicStopTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid stop result").outcome;
}

export async function dynState(
  harness: Harness,
  frameId: string,
): Promise<DynamicInstrumentationSnapshot> {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicStateTabRequest(nextId("state"), harness.tabId, frameId),
  );
  const parsed = parseDynamicStateTabResult(response);
  expect(parsed).not.toBeNull();
  const outcome = requireValue(parsed, "invalid state result").outcome;
  expect(outcome.status).toBe("COMPLETED");
  if (outcome.status !== "COMPLETED") {
    throw new Error("frame unavailable");
  }
  return outcome.snapshot;
}

export async function dynExecute(
  harness: Harness,
  items: readonly DriverTransactionRequest[],
) {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicExecuteTabRequest(nextId("execute"), harness.tabId, [...items]),
  );
  const parsed = parseDynamicExecuteTabResult(response);
  expect(parsed).not.toBeNull();
  const outcome = requireValue(parsed, "invalid execute result").outcome;
  expect(outcome.status).toBe("COMPLETED");
  if (outcome.status !== "COMPLETED") {
    throw new Error("frame unavailable");
  }
  return outcome;
}

export async function dynReconcile(
  harness: Harness,
  frameId: string,
): Promise<DynamicReconcileOutcome | { readonly status: "FRAME_UNAVAILABLE" }> {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicReconcileTabRequest(
      nextId("reconcile"),
      harness.tabId,
      frameId,
      await stableSemanticId("cor", nextId("w11-reconcile-cor")),
    ),
  );
  const parsed = parseDynamicReconcileTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid reconcile result").outcome;
}

export function reconciled(
  outcome: Awaited<ReturnType<typeof dynReconcile>>,
): Extract<DynamicReconcileOutcome, { readonly status: "RECONCILED" }> {
  expect(outcome.status).toBe("RECONCILED");
  if (outcome.status !== "RECONCILED") {
    throw new Error("reconciliation did not complete");
  }
  // Every reconciliation crossing the wire must satisfy the canonical
  // generated contract AND its RECONCILIATION_READINESS semantic rule.
  expect(validateFormReconciliationInventoryV1(outcome.inventory).valid).toBe(
    true,
  );
  expect(
    validateSemanticContractV1(
      "urn:japp:schema:form:reconciliation-inventory:v1",
      outcome.inventory,
    ).valid,
  ).toBe(true);
  return outcome;
}

export function itemFor(
  outcome: Extract<DynamicReconcileOutcome, { readonly status: "RECONCILED" }>,
  fieldId: string,
) {
  return requireValue(
    outcome.inventory.items.find((item) => item.field_id === fieldId),
    `inventory item for ${fieldId} is missing`,
  );
}

export async function waitForDrain(
  harness: Harness,
  frameId: string,
  minimumBatches: number,
): Promise<DynamicInstrumentationSnapshot> {
  const deadline = Date.now() + DRAIN_TIMEOUT_MS;
  for (;;) {
    const snapshot = await dynState(harness, frameId);
    if (
      snapshot.queue_length === 0 &&
      snapshot.batches_processed >= minimumBatches
    ) {
      return snapshot;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `mutation batches did not drain: ${JSON.stringify(snapshot)}`,
      );
    }
    await harness.page.waitForTimeout(DRAIN_POLL_MS);
  }
}
