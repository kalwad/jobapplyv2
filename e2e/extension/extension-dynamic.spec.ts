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
} from "../../packages/contracts/generated/typescript/index.ts";
import {
  validateFormReconciliationInventoryV1,
  validateSemanticContractV1,
} from "../../packages/contracts/generated/typescript/index.ts";
import type { BrowserContext, Page, Worker } from "@playwright/test";

import { fieldAddressDigest } from "../../apps/extension/src/driver-evidence.ts";
import type {
  DriverIntendedValue,
  DriverTransactionRequest,
} from "../../apps/extension/src/driver-protocol.ts";
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
} from "../../apps/extension/src/dynamic-protocol.ts";
import {
  buildScanTabRequest,
  CONTENT_FRAME_SCAN_FOUND,
  parseAggregatedScanResult,
  type FrameScanReport,
} from "../../apps/extension/src/scanner-protocol.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { stableSemanticId } from "../../apps/extension/src/semantic-identity.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const READY_TIMEOUT_MS = 15_000;
const DRAIN_TIMEOUT_MS = 15_000;
const DRAIN_POLL_MS = 50;
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
}

interface ChromeTab {
  readonly id?: number;
}

interface Harness {
  readonly page: Page;
  readonly controller: Page;
  readonly tabId: number;
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

async function tabIdForPage(
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

async function runtimeMessage(
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

async function openHarness(
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

async function setFixture(harness: Harness, markup: string): Promise<void> {
  await harness.page.locator("body").evaluate((body, value) => {
    body.innerHTML = value;
  }, markup);
}

async function scanFrames(harness: Harness): Promise<FrameScanReport[]> {
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

function foundTopFrame(frames: readonly FrameScanReport[]): FrameScanReport {
  return requireValue(
    frames.find(
      (frame) =>
        frame.frame_context.is_top_frame &&
        frame.root_status === CONTENT_FRAME_SCAN_FOUND,
    ),
    "top frame with application root missing",
  );
}

function descriptorByLabel(
  values: readonly FormFieldDescriptorV1[],
  label: string,
): FormFieldDescriptorV1 {
  return requireValue(
    values.find((value) => value.label.normalized_text === label),
    `descriptor labelled ${label} is missing`,
  );
}

async function fillDecision(
  descriptor: FormFieldDescriptorV1,
  seed: string,
): Promise<FormFieldDecisionV1> {
  const correlationId = await stableSemanticId("cor", `w11-e2e\0${seed}`);
  return {
    decision_id: await stableSemanticId("decision", `w11-e2e\0${seed}`),
    field_id: descriptor.field_id,
    field_address_digest: await fieldAddressDigest(descriptor.address),
    field_concept: "FIRST_NAME",
    classification_confidence: 1,
    value_source_type: "USER_RECORD",
    value_source_ref: await stableSemanticId("record", `w11-e2e\0${seed}`),
    value_confidence: 1,
    sensitivity_class: "PERSONAL",
    policy_decision: "PERMIT",
    final_decision: "FILL",
    confirmation_state: "NOT_REQUIRED",
    reason_codes: ["REVIEWED_SOURCE"],
    provenance: {
      source_kind: "USER_INPUT",
      source_id: await stableSemanticId("source", `w11-e2e\0${seed}`),
      observed_at: "2026-08-24T00:00:00Z",
      confidence: 1,
    },
    correlation_id: correlationId,
  };
}

async function blockedSensitiveDecision(
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

async function buildTransaction(
  descriptor: FormFieldDescriptorV1,
  intended: DriverIntendedValue,
  decision: FormFieldDecisionV1,
  seed: string,
): Promise<DriverTransactionRequest> {
  return {
    transaction_id: await stableSemanticId(
      "transaction",
      `w11-e2e-transaction\0${seed}`,
    ),
    correlation_id: decision.correlation_id,
    address: descriptor.address,
    decision,
    intended,
    settle: { budget_ms: 75 },
  };
}

async function dynStart(harness: Harness, frameId: string) {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicStartTabRequest(nextId("start"), harness.tabId, frameId),
  );
  const parsed = parseDynamicStartTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid start result").outcome;
}

async function dynStop(harness: Harness, frameId: string) {
  const response = await runtimeMessage(
    harness.controller,
    buildDynamicStopTabRequest(nextId("stop"), harness.tabId, frameId),
  );
  const parsed = parseDynamicStopTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid stop result").outcome;
}

async function dynState(
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

async function dynExecute(
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

async function dynReconcile(
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

function reconciled(
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

function itemFor(
  outcome: Extract<DynamicReconcileOutcome, { readonly status: "RECONCILED" }>,
  fieldId: string,
) {
  return requireValue(
    outcome.inventory.items.find((item) => item.field_id === fieldId),
    `inventory item for ${fieldId} is missing`,
  );
}

async function waitForDrain(
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

const BASE_FIXTURE = `
<form data-japp-application-root aria-label="Synthetic W11 application">
  <h2>Synthetic profile</h2>
  <div id="w11-main">
    <label for="w11-first">First name (required)</label>
    <input id="w11-first" name="firstName" type="text" required
      aria-invalid="false" autocomplete="off" />
    <label for="w11-note">Note (optional)</label>
    <input id="w11-note" name="note" type="text" aria-invalid="false"
      autocomplete="off" />
  </div>
  <div id="w11-slot"></div>
  <div id="w11-leaf"><span id="w11-leaf-child">leaf</span></div>
</form>
<div id="w11-outside"><span>outside content</span></div>
`;

test("DYN1/DYN2/DYN3/REC1: conditional fields are discovered by affected-subtree scans, reported REQUIRED_UNRESOLVED, and retired on removal", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;

  // An on-demand reconcile before observation performs one bounded seed
  // scan and stays IDLE — no observer, no timer.
  const idlePass = reconciled(await dynReconcile(harness, frameId));
  expect(idlePass.snapshot.observation_state).toBe("IDLE");
  expect(idlePass.inventory.counts.total).toBe(2);

  const started = await dynStart(harness, frameId);
  expect(started.status).toBe("STARTED");
  const again = await dynStart(harness, frameId);
  expect(again.status).toBe("ALREADY_OBSERVING");
  const baseline = await dynState(harness, frameId);
  expect(baseline.observation_state).toBe("OBSERVING");
  expect(baseline.inventory_size).toBe(2);

  // DYN1/DYN2: a conditional required field appears inside the slot.
  await harness.page.evaluate(() => {
    const slot = document.getElementById("w11-slot");
    if (slot === null) {
      throw new Error("slot missing");
    }
    const label = document.createElement("label");
    label.htmlFor = "w11-referral";
    label.textContent = "Referral code (required)";
    const control = document.createElement("input");
    control.id = "w11-referral";
    control.name = "referralCode";
    control.type = "text";
    control.required = true;
    control.autocomplete = "off";
    control.setAttribute("aria-invalid", "false");
    slot.append(label, control);
  });
  const afterInsert = await waitForDrain(
    harness,
    frameId,
    baseline.batches_processed + 1,
  );
  expect(afterInsert.conditional_fields_discovered).toBe(
    baseline.conditional_fields_discovered + 1,
  );
  expect(afterInsert.full_document_scans).toBe(0);
  expect(afterInsert.root_rescans).toBe(baseline.root_rescans);
  expect(afterInsert.affected_subtree_scans).toBeGreaterThanOrEqual(1);
  expect(afterInsert.inventory_size).toBe(3);

  const discovery = reconciled(await dynReconcile(harness, frameId));
  const referral = descriptorByLabel(
    (await scanFrames(harness)).flatMap((frame) => [...frame.descriptors]),
    "Referral code (required)",
  );
  const referralItem = itemFor(discovery, referral.field_id);
  expect(referralItem.category).toBe("REQUIRED_UNRESOLVED");
  expect(referralItem.required).toBe(true);
  expect(referralItem.visible).toBe(true);
  expect(discovery.inventory.readiness).toBe("NOT_READY");
  // REC1: every visible enabled required control is explicitly accounted.
  expect(discovery.inventory.counts.required_unresolved).toBe(2);
  expect(discovery.inventory.counts.total).toBe(3);

  // DYN3: the conditional field disappears again.
  await harness.page.evaluate(() => {
    document.getElementById("w11-referral")?.previousElementSibling?.remove();
    document.getElementById("w11-referral")?.remove();
  });
  const afterRemove = await waitForDrain(
    harness,
    frameId,
    afterInsert.batches_processed + 1,
  );
  expect(afterRemove.conditional_fields_removed).toBeGreaterThanOrEqual(
    baseline.conditional_fields_removed + 1,
  );
  const removal = reconciled(await dynReconcile(harness, frameId));
  expect(
    removal.inventory.items.find((item) => item.field_id === referral.field_id),
  ).toBeUndefined();
  expect(removal.inventory.counts.total).toBe(2);
});

test("REC2/REC3/REC4/NOACT1: a mixed page reports every required control explicitly and never upgrades blocked or concealed controls", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(
    harness,
    `
<form data-japp-application-root aria-label="Synthetic W11 mixed application">
  <h2>Synthetic mixed page</h2>
  <label for="w11-first">First name (required)</label>
  <input id="w11-first" name="firstName" type="text" required
    aria-invalid="false" autocomplete="off" />
  <label for="w11-skills">Synthetic skills (required)</label>
  <select id="w11-skills" name="skills" multiple required>
    <option value="alpha">Synthetic alpha</option>
    <option value="beta">Synthetic beta</option>
  </select>
  <fieldset role="radiogroup" aria-required="true"
    aria-label="Synthetic work authorization (required)">
    <label><input type="radio" name="workAuth" value="yes" /> Yes</label>
    <label><input type="radio" name="workAuth" value="no" /> No</label>
  </fieldset>
  <div role="listbox" aria-multiselectable="true"
    aria-label="Synthetic tags (optional)">
    <div role="option" data-value="tag-a">Synthetic tag A</div>
    <div role="option" data-value="tag-b">Synthetic tag B</div>
  </div>
  <div id="w11-slot"></div>
</form>
`,
  );
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");

  // A hidden required-looking honeypot arrives dynamically.
  await harness.page.evaluate(() => {
    const slot = document.getElementById("w11-slot");
    if (slot === null) {
      throw new Error("slot missing");
    }
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.position = "absolute";
    wrap.style.left = "-10000px";
    const honeypot = document.createElement("input");
    honeypot.id = "w11-honeypot";
    honeypot.name = "companySite";
    honeypot.type = "text";
    honeypot.required = true;
    honeypot.tabIndex = -1;
    wrap.append(honeypot);
    slot.append(wrap);
  });
  await waitForDrain(harness, frameId, 1);

  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const workAuth = descriptorByLabel(
    descriptors,
    "Synthetic work authorization (required)",
  );

  const fill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Casey" },
    await fillDecision(first, "mixed-first"),
    "mixed-first",
  );
  const blocked = await buildTransaction(
    workAuth,
    { kind: "OPTION", value_digest: `sha256:${"c".repeat(64)}` },
    await blockedSensitiveDecision(workAuth, "mixed-auth"),
    "mixed-auth",
  );
  const execution = await dynExecute(harness, [fill, blocked]);
  expect(execution.items[0]?.status).toBe("EXECUTED");
  const filled = execution.items[0];
  if (filled?.status === "EXECUTED") {
    expect(filled.result.outcome).toBe("VERIFIED");
  }
  const refused = execution.items[1];
  expect(refused?.status).toBe("EXECUTED");
  if (refused?.status === "EXECUTED") {
    expect(refused.result.outcome).toBe("BLOCKED_SENSITIVE");
    expect(refused.result.preconditions.policy_permitted).toBe(false);
  }
  expect(execution.snapshot.actions_executed).toBe(2);

  const pass = reconciled(await dynReconcile(harness, frameId));
  const items = pass.inventory.items;
  expect(itemFor(pass, first.field_id).category).toBe("VERIFIED_FILLED");
  expect(itemFor(pass, workAuth.field_id).category).toBe("BLOCKED_SENSITIVE");
  expect(itemFor(pass, workAuth.field_id).confirmation_state).toBe("MISSING");
  const skills = descriptorByLabel(descriptors, "Synthetic skills (required)");
  expect(itemFor(pass, skills.field_id).category).toBe("REQUIRED_UNRESOLVED");
  const tags = descriptorByLabel(descriptors, "Synthetic tags (optional)");
  expect(itemFor(pass, tags.field_id).category).toBe("UNSUPPORTED_OR_SKIPPED");
  const honeypotItem = requireValue(
    items.find(
      (item) =>
        !item.visible &&
        item.category === "UNSUPPORTED_OR_SKIPPED" &&
        item.required,
    ),
    "hidden honeypot item missing",
  );
  expect(honeypotItem.category).toBe("UNSUPPORTED_OR_SKIPPED");
  expect(pass.inventory.readiness).toBe("NOT_READY");
  expect(pass.inventory.counts.unconfirmed_consequential).toBe(1);
  // §42: no visible enabled required control is silent, and none escaped
  // into an unknown bucket: the counts recompute is already enforced by the
  // canonical validator; assert the explicit membership too.
  for (const item of items) {
    if (item.required && item.visible && item.enabled) {
      expect([
        "VERIFIED_FILLED",
        "REQUIRED_UNRESOLVED",
        "BLOCKED_SENSITIVE",
      ]).toContain(item.category);
    }
  }

  // NOACT1: repeating the blocked decision after rescans never upgrades it.
  const repeat = await dynExecute(harness, [
    {
      ...blocked,
      transaction_id: await stableSemanticId(
        "transaction",
        "w11-e2e-repeat-auth",
      ),
    },
  ]);
  expect(repeat.items[0]?.status).toBe("PRIOR_ATTEMPT_EXISTS");
  if (repeat.items[0]?.status === "PRIOR_ATTEMPT_EXISTS") {
    expect(repeat.items[0].prior_outcome).toBe("BLOCKED_SENSITIVE");
  }
  expect(repeat.snapshot.actions_executed).toBe(2);

  // REC4/§42: the honeypot never received any value.
  expect(
    await harness.page.evaluate(
      () =>
        (document.getElementById("w11-honeypot") as HTMLInputElement | null)
          ?.value,
    ),
  ).toBe("");
  // The radio group never received a selection.
  expect(
    await harness.page.evaluate(
      () => document.querySelectorAll("input[name='workAuth']:checked").length,
    ),
  ).toBe(0);
});

test("DUP1/DUP2/DUP3: framework rerenders and repeated requests cause exactly zero duplicate actions while new decisions stay legitimate", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  // Page-world action meter plus a rerender-style decoration on input.
  await harness.page.evaluate(() => {
    const meter = { input: 0 };
    (window as unknown as { __w11Meter: { input: number } }).__w11Meter = meter;
    const control = document.getElementById("w11-first");
    const leaf = document.getElementById("w11-leaf");
    if (control === null || leaf === null) {
      throw new Error("fixture missing");
    }
    control.addEventListener("input", () => {
      meter.input += 1;
      const decoration = document.createElement("div");
      decoration.className = "decoration";
      decoration.textContent = "rerender decoration";
      leaf.append(decoration);
    });
  });
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");

  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const decision = await fillDecision(first, "dup-first");
  const fill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Alex" },
    decision,
    "dup-first",
  );
  const executed = await dynExecute(harness, [fill]);
  expect(executed.items[0]?.status).toBe("EXECUTED");
  if (executed.items[0]?.status === "EXECUTED") {
    expect(executed.items[0].result.outcome).toBe("VERIFIED");
  }
  const meterAfterFill = await harness.page.evaluate(
    () =>
      (window as unknown as { __w11Meter: { input: number } }).__w11Meter.input,
  );
  expect(meterAfterFill).toBeGreaterThanOrEqual(1);
  const afterFill = await waitForDrain(harness, frameId, 1);
  expect(afterFill.actions_executed).toBe(1);
  // DUP2: the action's own rerender mutations were observed and attributed,
  // and did not replay anything.
  expect(afterFill.records_during_action).toBeGreaterThanOrEqual(1);
  expect(afterFill.batches_action_origin).toBeGreaterThanOrEqual(1);

  // DUP1: rerender-style mutation storms plus identical re-requests.
  for (let round = 0; round < 3; round += 1) {
    await harness.page.evaluate(() => {
      const main = document.getElementById("w11-main");
      if (main === null) {
        throw new Error("fixture missing");
      }
      for (let index = 0; index < 20; index += 1) {
        main.classList.toggle("synthetic-rerender");
      }
    });
    reconciled(await dynReconcile(harness, frameId));
    const resend = await dynExecute(harness, [
      {
        ...fill,
        transaction_id: await stableSemanticId(
          "transaction",
          `w11-e2e-dup-resend\0${String(round)}`,
        ),
      },
    ]);
    expect(resend.items[0]?.status).toBe("DUPLICATE_SUPPRESSED");
    if (resend.items[0]?.status === "DUPLICATE_SUPPRESSED") {
      expect(resend.items[0].prior_outcome).toBe("VERIFIED");
    }
  }
  const afterResends = await dynState(harness, frameId);
  // §41: exactly one action attempt, measured, not "probably once".
  expect(afterResends.actions_executed).toBe(1);
  expect(afterResends.actions_suppressed_duplicate).toBe(3);
  expect(
    await harness.page.evaluate(
      () =>
        (window as unknown as { __w11Meter: { input: number } }).__w11Meter
          .input,
    ),
  ).toBe(meterAfterFill);
  expect(
    await harness.page.evaluate(
      () =>
        (document.getElementById("w11-first") as HTMLInputElement | null)
          ?.value,
    ),
  ).toBe("Synthetic Alex");

  // DUP3: a genuinely new conditional field creates a distinct legitimate
  // action without replaying the original decision.
  await harness.page.evaluate(() => {
    const slot = document.getElementById("w11-slot");
    if (slot === null) {
      throw new Error("slot missing");
    }
    const label = document.createElement("label");
    label.htmlFor = "w11-conditional";
    label.textContent = "Conditional detail (required)";
    const control = document.createElement("input");
    control.id = "w11-conditional";
    control.name = "conditionalDetail";
    control.type = "text";
    control.required = true;
    control.autocomplete = "off";
    control.setAttribute("aria-invalid", "false");
    slot.append(label, control);
  });
  await waitForDrain(harness, frameId, afterResends.batches_processed + 1);
  const conditional = descriptorByLabel(
    (await scanFrames(harness)).flatMap((frame) => [...frame.descriptors]),
    "Conditional detail (required)",
  );
  const conditionalFill = await buildTransaction(
    conditional,
    { kind: "TEXT", text: "Synthetic conditional detail" },
    await fillDecision(conditional, "dup-conditional"),
    "dup-conditional",
  );
  const second = await dynExecute(harness, [conditionalFill]);
  expect(second.items[0]?.status).toBe("EXECUTED");
  expect(second.snapshot.actions_executed).toBe(2);
  expect(second.snapshot.actions_suppressed_duplicate).toBe(3);
});

test("CHG1/CHG2/CHG3: page-changed values and late validation rejection are detected without silent verified state or automatic refill", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const note = descriptorByLabel(descriptors, "Note (optional)");
  const firstFill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Riley" },
    await fillDecision(first, "chg-first"),
    "chg-first",
  );
  const noteFill = await buildTransaction(
    note,
    { kind: "TEXT", text: "Synthetic note" },
    await fillDecision(note, "chg-note"),
    "chg-note",
  );
  const execution = await dynExecute(harness, [firstFill, noteFill]);
  for (const item of execution.items) {
    expect(item.status).toBe("EXECUTED");
    if (item.status === "EXECUTED") {
      expect(item.result.outcome).toBe("VERIFIED");
    }
  }

  // CHG2 plus the canonical READY path: both fields verified and unchanged.
  const clean = reconciled(await dynReconcile(harness, frameId));
  expect(itemFor(clean, first.field_id).category).toBe("VERIFIED_FILLED");
  expect(itemFor(clean, note.field_id).category).toBe("VERIFIED_FILLED");
  expect(clean.inventory.readiness).toBe("READY");
  expect(clean.inventory.page_generation).toBe(
    clean.inventory.proof_generation,
  );

  // CHG1: a page script silently rewrites the optional verified value
  // without any input event.
  await harness.page.evaluate(() => {
    const control = document.getElementById(
      "w11-note",
    ) as HTMLInputElement | null;
    if (control === null) {
      throw new Error("fixture missing");
    }
    control.value = "synthetic page rewrite";
  });
  const changed = reconciled(await dynReconcile(harness, frameId));
  const changedNote = itemFor(changed, note.field_id);
  expect(changedNote.category).toBe("PAGE_CHANGED_VALUE");
  expect(changedNote.changed_value).toBe(true);
  expect(itemFor(changed, first.field_id).category).toBe("VERIFIED_FILLED");
  expect(changed.inventory.readiness).toBe("NOT_READY");
  expect(changed.snapshot.page_changed_detected).toBeGreaterThanOrEqual(1);

  // §17: re-requesting the original decision reports the change first and
  // never automatically replays the fill.
  const resend = await dynExecute(harness, [
    {
      ...noteFill,
      transaction_id: await stableSemanticId(
        "transaction",
        "w11-e2e-chg-resend",
      ),
    },
  ]);
  expect(resend.items[0]?.status).toBe("PAGE_CHANGED_VALUE_DETECTED");
  expect(resend.snapshot.actions_executed).toBe(2);
  expect(
    await harness.page.evaluate(
      () =>
        (document.getElementById("w11-note") as HTMLInputElement | null)?.value,
    ),
  ).toBe("synthetic page rewrite");

  // CHG1 on a required field: the canonical equivalent classification.
  await harness.page.evaluate(() => {
    const control = document.getElementById(
      "w11-first",
    ) as HTMLInputElement | null;
    if (control === null) {
      throw new Error("fixture missing");
    }
    control.value = "";
  });
  const reset = reconciled(await dynReconcile(harness, frameId));
  const resetFirst = itemFor(reset, first.field_id);
  expect(resetFirst.category).toBe("REQUIRED_UNRESOLVED");
  expect(resetFirst.changed_value).toBe(false);
  expect(reset.snapshot.page_changed_detected).toBeGreaterThanOrEqual(2);
  expect(reset.inventory.readiness).toBe("NOT_READY");

  // CHG3: the page restores the intended value but rejects it. The clean
  // verified state must not return.
  await harness.page.evaluate(() => {
    const control = document.getElementById(
      "w11-first",
    ) as HTMLInputElement | null;
    if (control === null) {
      throw new Error("fixture missing");
    }
    control.value = "Synthetic Riley";
    control.setAttribute("aria-invalid", "true");
  });
  await waitForDrain(harness, frameId, 1);
  const rejectedPass = reconciled(await dynReconcile(harness, frameId));
  expect(itemFor(rejectedPass, first.field_id).category).toBe(
    "REQUIRED_UNRESOLVED",
  );
  expect(rejectedPass.inventory.readiness).toBe("NOT_READY");
});

test("BATCH1/BATCH2/PERF1/PERF2/PERF3: a mutation storm coalesces into bounded batches that scan only affected subtrees", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  // A deliberately large sibling section proves affected-subtree locality.
  await harness.page.evaluate(() => {
    const form = document.querySelector("form[data-japp-application-root]");
    if (form === null) {
      throw new Error("fixture missing");
    }
    const big = document.createElement("div");
    big.id = "w11-big";
    for (let index = 0; index < 400; index += 1) {
      const node = document.createElement("span");
      node.textContent = `synthetic filler ${String(index)}`;
      big.append(node);
    }
    form.append(big);
  });
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  const baseline = await dynState(harness, frameId);

  // One synchronous storm: 300 insertions plus 300 overlapping attribute
  // mutations inside the same small leaf subtree.
  await harness.page.evaluate(() => {
    const leaf = document.getElementById("w11-leaf");
    const child = document.getElementById("w11-leaf-child");
    if (leaf === null || child === null) {
      throw new Error("fixture missing");
    }
    for (let index = 0; index < 300; index += 1) {
      const node = document.createElement("div");
      node.textContent = "synthetic storm decoration";
      leaf.append(node);
      child.setAttribute("class", `synthetic-mark-${String(index)}`);
    }
  });
  const after = await waitForDrain(
    harness,
    frameId,
    baseline.batches_processed + 1,
  );
  const records = after.mutation_records - baseline.mutation_records;
  const callbacks = after.mutation_callbacks - baseline.mutation_callbacks;
  const batches = after.batches_processed - baseline.batches_processed;
  const subtreeScans =
    after.affected_subtree_scans - baseline.affected_subtree_scans;
  const nodes = after.nodes_considered - baseline.nodes_considered;
  expect(records).toBeGreaterThanOrEqual(600);
  // BATCH1: bounded coalescing — never one processing pass per record.
  expect(callbacks).toBeLessThanOrEqual(4);
  expect(batches).toBeGreaterThanOrEqual(1);
  expect(batches).toBeLessThanOrEqual(4);
  // BATCH2: the overlapping parent/child regions coalesce; scans stay at
  // most one region per batch here.
  expect(subtreeScans).toBeGreaterThanOrEqual(1);
  expect(subtreeScans).toBeLessThanOrEqual(batches);
  // PERF2/§40: zero document-wide scans, zero root rescans from routine
  // mutations — proven by scope counters, not by duration.
  expect(after.full_document_scans).toBe(0);
  expect(after.root_rescans).toBe(baseline.root_rescans);
  // PERF3: node visitation stayed inside the affected leaf subtree; a
  // per-record or root-wide strategy would exceed this ceiling by orders
  // of magnitude (root holds 400+ filler nodes, the storm 300 records).
  expect(nodes).toBeGreaterThanOrEqual(300);
  expect(nodes).toBeLessThanOrEqual(2500);
  // The storm touched no controls: inventory and decisions are untouched.
  expect(after.inventory_size).toBe(baseline.inventory_size);
  expect(after.descriptors_produced).toBe(baseline.descriptors_produced);
  expect(after.actions_executed).toBe(0);
  // PERF1: real duration accounting moved.
  expect(after.total_scan_duration_ms).toBeGreaterThanOrEqual(
    baseline.total_scan_duration_ms,
  );
  expect(after.max_queue_length).toBeGreaterThanOrEqual(300);
  expect(after.queue_length).toBe(0);
});

test("ROOT1/PERF4: outside-root mutations and idle periods change nothing, and stopping with a queued batch stays safe", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  const baseline = await dynState(harness, frameId);

  // ROOT1/§25: 500 mutations strictly outside the application root.
  await harness.page.evaluate(() => {
    const outside = document.getElementById("w11-outside");
    if (outside === null) {
      throw new Error("fixture missing");
    }
    for (let index = 0; index < 500; index += 1) {
      const node = document.createElement("div");
      node.textContent = "synthetic outside noise";
      outside.append(node);
    }
  });
  await harness.page.waitForTimeout(400);
  const afterOutside = await dynState(harness, frameId);
  expect(afterOutside.mutation_callbacks).toBe(baseline.mutation_callbacks);
  expect(afterOutside.mutation_records).toBe(baseline.mutation_records);
  expect(afterOutside.batches_processed).toBe(baseline.batches_processed);
  expect(afterOutside.affected_subtree_scans).toBe(
    baseline.affected_subtree_scans,
  );
  expect(afterOutside.root_rescans).toBe(baseline.root_rescans);
  expect(afterOutside.actions_executed).toBe(0);

  // PERF4/§23: a deterministic idle window creates no continuing passes.
  await harness.page.waitForTimeout(700);
  const afterIdle = await dynState(harness, frameId);
  expect(afterIdle.mutation_callbacks).toBe(afterOutside.mutation_callbacks);
  expect(afterIdle.batches_processed).toBe(afterOutside.batches_processed);
  expect(afterIdle.reconciliation_passes).toBe(
    afterOutside.reconciliation_passes,
  );
  expect(afterIdle.generations).toEqual(afterOutside.generations);

  // Probe: stop while a batch is queued; the queue drains safely to zero.
  await harness.page.evaluate(() => {
    const leaf = document.getElementById("w11-leaf");
    if (leaf === null) {
      throw new Error("fixture missing");
    }
    const node = document.createElement("div");
    node.textContent = "synthetic queued mutation";
    leaf.append(node);
  });
  const stopped = await dynStop(harness, frameId);
  expect(stopped.status).toBe("STOPPED");
  if (stopped.status !== "STOPPED") {
    throw new Error("stop did not complete");
  }
  expect(stopped.snapshot.observation_state).toBe("IDLE");
  expect(stopped.snapshot.queue_length).toBe(0);
  await harness.page.waitForTimeout(300);
  const afterStop = await dynState(harness, frameId);
  expect(afterStop.batches_processed).toBe(stopped.snapshot.batches_processed);
  expect(afterStop.observation_state).toBe("IDLE");
  const stoppedAgain = await dynStop(harness, frameId);
  expect(stoppedAgain.status).toBe("NOT_OBSERVING");
});

test("ROOT2/GEN2: replacing the application root invalidates old state and stale addresses cannot authorize a current action", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const fill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Jordan" },
    await fillDecision(first, "root-first"),
    "root-first",
  );
  const executed = await dynExecute(harness, [fill]);
  expect(executed.items[0]?.status).toBe("EXECUTED");
  const baseline = await dynState(harness, frameId);
  expect(baseline.generations.page_generation).toBe(0);

  // The page replaces the entire application root.
  await harness.page.evaluate(() => {
    document.querySelector("form[data-japp-application-root]")?.remove();
    const replacement = document.createElement("form");
    replacement.setAttribute("data-japp-application-root", "");
    replacement.setAttribute("aria-label", "Synthetic replacement application");
    const heading = document.createElement("h2");
    heading.textContent = "Synthetic replacement";
    const label = document.createElement("label");
    label.htmlFor = "w11-replacement";
    label.textContent = "Replacement field (required)";
    const control = document.createElement("input");
    control.id = "w11-replacement";
    control.name = "replacementField";
    control.type = "text";
    control.required = true;
    control.autocomplete = "off";
    control.setAttribute("aria-invalid", "false");
    replacement.append(heading, label, control);
    document.body.append(replacement);
  });

  const pass = reconciled(await dynReconcile(harness, frameId));
  const snapshot = pass.snapshot;
  expect(snapshot.generations.root_generation).toBe(
    baseline.generations.root_generation + 1,
  );
  expect(snapshot.generations.page_generation).toBe(
    baseline.generations.page_generation + 1,
  );
  expect(snapshot.root_rescans_root_replaced).toBe(1);
  // The old verified evidence cannot silently authorize the new page: the
  // replacement's required field is unresolved and nothing is VERIFIED.
  expect(pass.inventory.counts.verified_filled).toBe(0);
  expect(pass.inventory.counts.required_unresolved).toBe(1);
  expect(pass.inventory.page_generation).toBe(1);

  // GEN2 / probe 11: replaying the pre-replacement transaction gains no
  // authority — the ledger entry evaporated with its generation and the
  // accepted W10 kernel fails the stale address closed with zero action.
  const replay = await dynExecute(harness, [
    {
      ...fill,
      transaction_id: await stableSemanticId(
        "transaction",
        "w11-e2e-root-replay",
      ),
    },
  ]);
  expect(replay.items[0]?.status).toBe("EXECUTED");
  if (replay.items[0]?.status === "EXECUTED") {
    expect(replay.items[0].result.outcome).toBe("NEEDS_REVIEW");
    expect(replay.items[0].result.reason_codes).toContain("RESOLUTION_MISSING");
    expect(replay.items[0].result.action_attempt.action_count).toBe(1);
    expect(replay.items[0].result.persistence_verified).toBe(false);
  }
  expect(
    await harness.page.evaluate(
      () =>
        (document.getElementById("w11-replacement") as HTMLInputElement | null)
          ?.value,
    ),
  ).toBe("");
  // Fresh descriptors carry the advanced page generation (U1/U3).
  const fresh = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  expect(
    descriptorByLabel(fresh, "Replacement field (required)").address
      .observed_dom_generation,
  ).toBe(1);
});

test("GEN1: an SPA route change advances route and page generations while the browser document identity stays the same", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const frames = await scanFrames(harness);
  const top = foundTopFrame(frames);
  const frameId = top.frame_context.frame_id;
  const documentId = top.frame_context.document_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const fill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Morgan" },
    await fillDecision(first, "spa-first"),
    "spa-first",
  );
  expect((await dynExecute(harness, [fill])).items[0]?.status).toBe("EXECUTED");
  const baseline = await dynState(harness, frameId);

  // Synthetic SPA transition: history route change plus content swap.
  await harness.page.evaluate(() => {
    history.pushState({}, "", "/native/synthetic-step-two");
    const form = document.querySelector("form[data-japp-application-root]");
    if (form === null) {
      throw new Error("fixture missing");
    }
    form.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Synthetic step two";
    const label = document.createElement("label");
    label.htmlFor = "w11-step-two";
    label.textContent = "Step two field (required)";
    const control = document.createElement("input");
    control.id = "w11-step-two";
    control.name = "stepTwoField";
    control.type = "text";
    control.required = true;
    control.autocomplete = "off";
    control.setAttribute("aria-invalid", "false");
    form.append(heading, label, control);
  });

  const pass = reconciled(await dynReconcile(harness, frameId));
  expect(pass.snapshot.generations.route_generation).toBe(
    baseline.generations.route_generation + 1,
  );
  expect(pass.snapshot.generations.page_generation).toBe(
    baseline.generations.page_generation + 1,
  );
  expect(pass.snapshot.root_rescans_route_changed).toBe(1);
  // The browser document did not change: same registered document identity.
  expect(pass.inventory.document_id).toBe(documentId);
  expect(pass.inventory.counts.verified_filled).toBe(0);
  expect(pass.inventory.counts.required_unresolved).toBe(1);

  // No duplicate prior-page action: the stale-route address fails closed.
  const replay = await dynExecute(harness, [
    {
      ...fill,
      transaction_id: await stableSemanticId(
        "transaction",
        "w11-e2e-spa-replay",
      ),
    },
  ]);
  expect(replay.items[0]?.status).toBe("EXECUTED");
  if (replay.items[0]?.status === "EXECUTED") {
    expect(replay.items[0].result.outcome).toBe("NEEDS_REVIEW");
    expect(replay.items[0].result.reason_codes).toContain("RESOLUTION_MISSING");
  }
  expect(
    await harness.page.evaluate(
      () =>
        (document.getElementById("w11-step-two") as HTMLInputElement | null)
          ?.value,
    ),
  ).toBe("");
});

test("FRAME1/FRAME2: dynamic observation stays frame-local and wrong-frame control messages are rejected", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/frames/",
  );
  await expect(
    harness.page.frameLocator("#frames-embed").locator("html"),
  ).toHaveAttribute(CONTENT_READY_ATTRIBUTE, CONTENT_READY_VALUE, {
    timeout: READY_TIMEOUT_MS,
  });
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let frames = await scanFrames(harness);
  while (frames.length < 2 && Date.now() < deadline) {
    await harness.page.waitForTimeout(DRAIN_POLL_MS);
    frames = await scanFrames(harness);
  }
  expect(frames).toHaveLength(2);
  const topFrame = requireValue(
    frames.find((frame) => frame.frame_context.is_top_frame),
    "top frame missing",
  );
  const innerFrame = requireValue(
    frames.find((frame) => !frame.frame_context.is_top_frame),
    "inner frame missing",
  );
  expect(innerFrame.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);

  // The top frame has no application root: a typed refusal, never a scan of
  // some other frame's document.
  const topStart = await dynStart(harness, topFrame.frame_context.frame_id);
  expect(topStart.status).toBe("ROOT_UNRESOLVED");

  const innerId = innerFrame.frame_context.frame_id;
  expect((await dynStart(harness, innerId)).status).toBe("STARTED");
  const baseline = await dynState(harness, innerId);

  // FRAME1: top-document mutations never reach the inner frame's engine.
  await harness.page.evaluate(() => {
    for (let index = 0; index < 100; index += 1) {
      const node = document.createElement("div");
      node.textContent = "synthetic top noise";
      document.body.append(node);
    }
  });
  await harness.page.waitForTimeout(400);
  const after = await dynState(harness, innerId);
  expect(after.mutation_records).toBe(baseline.mutation_records);
  expect(after.batches_processed).toBe(baseline.batches_processed);

  const innerPass = reconciled(await dynReconcile(harness, innerId));
  expect(innerPass.inventory.document_id).toBe(
    innerFrame.frame_context.document_id,
  );
  expect(innerPass.inventory.counts.total).toBe(2);
  expect(innerPass.inventory.counts.required_unresolved).toBe(1);

  // FRAME2: a fabricated frame identity is rejected as unavailable.
  const wrongFrame = await dynReconcile(
    harness,
    "frame_ZZZZZZZZZZZZZZZZZZZZZZZZZZ",
  );
  expect(wrongFrame.status).toBe("FRAME_UNAVAILABLE");
});

test("PERF5/NOACT2: CPU/memory measurement is real at its declared boundaries and no navigation or submit surface exists", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, BASE_FIXTURE);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");

  // Real Chromium CPU/heap metrics through CDP — the declared W11
  // measurement boundary for process metrics.
  const cdp = await extensionContext.newCDPSession(harness.page);
  await cdp.send("Performance.enable");
  const before = await cdp.send("Performance.getMetrics");
  const metric = (
    metrics: { readonly metrics: readonly { name: string; value: number }[] },
    name: string,
  ): number =>
    requireValue(
      metrics.metrics.find((entry) => entry.name === name),
      `CDP metric ${name} missing`,
    ).value;
  await harness.page.evaluate(() => {
    const leaf = document.getElementById("w11-leaf");
    if (leaf === null) {
      throw new Error("fixture missing");
    }
    for (let index = 0; index < 200; index += 1) {
      const node = document.createElement("div");
      node.textContent = "synthetic cpu work";
      leaf.append(node);
    }
  });
  await waitForDrain(harness, frameId, 1);
  reconciled(await dynReconcile(harness, frameId));
  const afterMetrics = await cdp.send("Performance.getMetrics");
  expect(metric(afterMetrics, "TaskDuration")).toBeGreaterThanOrEqual(
    metric(before, "TaskDuration"),
  );
  expect(metric(afterMetrics, "TaskDuration")).toBeGreaterThan(0);
  expect(metric(afterMetrics, "JSHeapUsedSize")).toBeGreaterThan(0);

  // The in-page probe is capability-honest: real numbers when available,
  // an explicit unavailable marker otherwise — never zero-filled, and the
  // wire cannot even represent an in-page CPU number.
  const snapshot = await dynState(harness, frameId);
  if (snapshot.memory.available) {
    expect(snapshot.memory.used_js_heap_bytes).toBeGreaterThan(0);
    expect(snapshot.memory.total_js_heap_bytes).toBeGreaterThanOrEqual(
      snapshot.memory.used_js_heap_bytes,
    );
  } else {
    expect(snapshot.memory).toEqual({ available: false });
  }
  expect(snapshot.cpu).toEqual({
    available: false,
    reason: "NO_IN_PAGE_PROCESS_CPU_SOURCE",
  });
  expect(snapshot.last_batch_duration_ms).toBeGreaterThanOrEqual(0);
  expect(snapshot.last_reconciliation_duration_ms).toBeGreaterThanOrEqual(0);

  // Telemetry redaction: no raw value, markup, or selector crosses the
  // wire in snapshots or inventories.
  const descriptors = (await scanFrames(harness)).flatMap((frame) => [
    ...frame.descriptors,
  ]);
  const first = descriptorByLabel(descriptors, "First name (required)");
  const fill = await buildTransaction(
    first,
    { kind: "TEXT", text: "Synthetic Redaction Probe" },
    await fillDecision(first, "perf-first"),
    "perf-first",
  );
  const executed = await dynExecute(harness, [fill]);
  expect(executed.items[0]?.status).toBe("EXECUTED");
  const pass = reconciled(await dynReconcile(harness, frameId));
  for (const serialized of [
    JSON.stringify(pass.inventory),
    JSON.stringify(pass.snapshot),
    JSON.stringify(await dynState(harness, frameId)),
  ]) {
    expect(serialized).not.toContain("Synthetic Redaction Probe");
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain("querySelector");
    expect(serialized).not.toContain("#w11");
    expect(serialized).not.toContain("nth-of-type");
  }

  // NOACT2: the W11 surface has no navigation/submit message, and unknown
  // dynamic kinds fall through unanswered.
  for (const kind of [
    "M02_W11_NAVIGATE_TAB",
    "M02_W11_SUBMIT_TAB",
    "M02_W11_CLICK_TAB",
  ]) {
    expect(
      await runtimeMessage(harness.controller, {
        kind,
        protocolVersion: 1,
        requestId: "closure-1",
        tabId: harness.tabId,
        frame_id: frameId,
      }),
    ).toBeUndefined();
  }
});
