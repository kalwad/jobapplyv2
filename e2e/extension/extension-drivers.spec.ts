// M02-W10 real-MV3 transaction proof. Every scenario routes through the
// generated WXT worker, the registered frame content agent, W08 semantic
// re-resolution, a canonical W09 decision, and the control-specific W10
// transaction kernel in bundled Chromium.
import type {
  FormFieldDecisionV1,
  FormFieldDescriptorV1,
} from "../../packages/contracts/generated/typescript/index.ts";
import type { BrowserContext, Page, Worker } from "@playwright/test";

import { fieldAddressDigest } from "../../apps/extension/src/driver-evidence.ts";
import {
  buildExecuteTabRequest,
  buildIdentifyNavTabRequest,
  buildUndoTabRequest,
  parseExecuteTabResult,
  parseIdentifyNavTabResult,
  parseUndoTabResult,
  type DriverIntendedValue,
  type ExecuteTabResult,
  type IdentifyNavTabResult,
  type UndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
import {
  buildScanTabRequest,
  CONTENT_FRAME_SCAN_FOUND,
  parseAggregatedScanResult,
} from "../../apps/extension/src/scanner-protocol.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import {
  semanticDigest,
  stableSemanticId,
} from "../../apps/extension/src/semantic-identity.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
} from "../../packages/form-engine/src/index.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const READY_TIMEOUT_MS = 15_000;
let transactionSequence = 0;

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

async function descriptors(harness: Harness): Promise<FormFieldDescriptorV1[]> {
  const response = await runtimeMessage(
    harness.controller,
    buildScanTabRequest(
      `w10-scan-${String(transactionSequence)}`,
      harness.tabId,
      {
        kind: "APPLICATION_ROOT",
      },
    ),
  );
  const parsed = parseAggregatedScanResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid aggregate").frames.flatMap((frame) =>
    frame.root_status === CONTENT_FRAME_SCAN_FOUND
      ? [...frame.descriptors]
      : [],
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
  const correlationId = await stableSemanticId("cor", `w10-e2e\0${seed}`);
  return {
    decision_id: await stableSemanticId("decision", `w10-e2e\0${seed}`),
    field_id: descriptor.field_id,
    field_address_digest: await fieldAddressDigest(descriptor.address),
    field_concept: "FIRST_NAME",
    classification_confidence: 1,
    value_source_type: "USER_RECORD",
    value_source_ref: await stableSemanticId("record", `w10-e2e\0${seed}`),
    value_confidence: 1,
    sensitivity_class: "PERSONAL",
    policy_decision: "PERMIT",
    final_decision: "FILL",
    confirmation_state: "NOT_REQUIRED",
    reason_codes: ["REVIEWED_SOURCE"],
    provenance: {
      source_kind: "USER_INPUT",
      source_id: await stableSemanticId("source", `w10-e2e\0${seed}`),
      observed_at: "2026-08-24T00:00:00Z",
      confidence: 1,
    },
    correlation_id: correlationId,
  };
}

async function blockedDecision(
  descriptor: FormFieldDescriptorV1,
  seed: string,
): Promise<FormFieldDecisionV1> {
  const base = await fillDecision(descriptor, seed);
  return {
    ...base,
    sensitivity_class: "SENSITIVE",
    policy_decision: "DENY",
    final_decision: "SKIP_OPTIONAL",
    reason_codes: ["POLICY_DENIED"],
  };
}

async function execute(
  harness: Harness,
  descriptor: FormFieldDescriptorV1,
  intended: DriverIntendedValue,
  decision?: FormFieldDecisionV1,
  settleBudgetMs = 75,
): Promise<
  Extract<ExecuteTabResult["outcome"], { readonly status: "COMPLETED" }>
> {
  transactionSequence += 1;
  const resolvedDecision =
    decision ?? (await fillDecision(descriptor, String(transactionSequence)));
  const transactionId = await stableSemanticId(
    "transaction",
    `w10-e2e-transaction\0${String(transactionSequence)}`,
  );
  const response = await runtimeMessage(
    harness.controller,
    buildExecuteTabRequest(
      `execute-${String(transactionSequence)}`,
      harness.tabId,
      {
        transaction_id: transactionId,
        correlation_id: resolvedDecision.correlation_id,
        address: descriptor.address,
        decision: resolvedDecision,
        intended,
        settle: { budget_ms: settleBudgetMs },
      },
    ),
  );
  const parsed = parseExecuteTabResult(response);
  expect(parsed).not.toBeNull();
  const outcome = requireValue(parsed, "invalid execute result").outcome;
  expect(outcome.status).toBe("COMPLETED");
  if (outcome.status !== "COMPLETED") {
    throw new Error("frame unavailable");
  }
  return outcome;
}

async function undo(
  harness: Harness,
  execution: Extract<
    ExecuteTabResult["outcome"],
    { readonly status: "COMPLETED" }
  >,
  settleBudgetMs = 75,
): Promise<UndoTabResult["outcome"]> {
  transactionSequence += 1;
  const transactionId = execution.result.action_attempt.idempotency_key;
  // Transaction IDs are deliberately not echoed in durable DriverResult.
  // The engine derives idempotency from it, so tests retain the original via
  // a companion property installed below by executeWithUndoId.
  const retained = execution as typeof execution & {
    readonly __transactionId?: string;
  };
  const response = await runtimeMessage(
    harness.controller,
    buildUndoTabRequest(`undo-${String(transactionSequence)}`, harness.tabId, {
      transaction_id: retained.__transactionId ?? transactionId,
      address: execution.result.field_address,
      settle: { budget_ms: settleBudgetMs },
    }),
  );
  const parsed = parseUndoTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "invalid undo result").outcome;
}

async function executeWithUndoId(
  harness: Harness,
  descriptor: FormFieldDescriptorV1,
  intended: DriverIntendedValue,
  settleBudgetMs = 75,
): Promise<
  Extract<ExecuteTabResult["outcome"], { readonly status: "COMPLETED" }> & {
    readonly __transactionId: string;
  }
> {
  transactionSequence += 1;
  const sequence = String(transactionSequence);
  const decision = await fillDecision(descriptor, sequence);
  const transactionId = await stableSemanticId(
    "transaction",
    `w10-e2e-transaction\0${sequence}`,
  );
  const response = await runtimeMessage(
    harness.controller,
    buildExecuteTabRequest(`execute-${sequence}`, harness.tabId, {
      transaction_id: transactionId,
      correlation_id: decision.correlation_id,
      address: descriptor.address,
      decision,
      intended,
      settle: { budget_ms: settleBudgetMs },
    }),
  );
  const parsed = parseExecuteTabResult(response);
  expect(parsed?.outcome.status).toBe("COMPLETED");
  const outcome = requireValue(parsed, "invalid execute result").outcome;
  if (outcome.status !== "COMPLETED") {
    throw new Error("frame unavailable");
  }
  return Object.assign(outcome, { __transactionId: transactionId });
}

async function identifyNavigation(
  harness: Harness,
): Promise<
  Extract<IdentifyNavTabResult["outcome"], { readonly status: "COMPLETED" }>
> {
  transactionSequence += 1;
  const response = await runtimeMessage(
    harness.controller,
    buildIdentifyNavTabRequest(
      `nav-${String(transactionSequence)}`,
      harness.tabId,
    ),
  );
  const parsed = parseIdentifyNavTabResult(response);
  expect(parsed?.outcome.status).toBe("COMPLETED");
  const outcome = requireValue(parsed, "invalid navigation result").outcome;
  if (outcome.status !== "COMPLETED") {
    throw new Error("top frame unavailable");
  }
  return outcome;
}

async function replaceBody(harness: Harness, markup: string): Promise<void> {
  await harness.page.locator("body").evaluate((body, value) => {
    body.innerHTML = value;
  }, markup);
}

test("TX1/TEXT1/TEXT2/UNDO1: native text transactions use a real W09 decision, persist, redact, and restore", async ({
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
  const scanned = await descriptors(harness);
  const firstName = descriptorByLabel(scanned, "First name (required)");
  const correlationId = await stableSemanticId("cor", "w10-real-w09");
  const recordId = await stableSemanticId("record", "w10-real-w09");
  const decisionOutcome = await resolveFieldDecision({
    descriptor: firstName,
    records: buildApprovedRecordSet([
      {
        recordId,
        concept: "FIRST_NAME",
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]),
    correlationId,
  });
  expect(decisionOutcome.status).toBe("RESOLVED");
  if (decisionOutcome.status !== "RESOLVED") {
    throw new Error("real W09 decision did not resolve");
  }
  expect(decisionOutcome.resolution.decision.final_decision).toBe("FILL");
  const raw = "Synthetic Avery";
  const firstExecution = await execute(
    harness,
    firstName,
    { kind: "TEXT", text: raw },
    decisionOutcome.resolution.decision,
  );
  expect(firstExecution.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#nat-first-name").inputValue()).toBe(raw);
  expect(JSON.stringify(firstExecution)).not.toContain(raw);

  const summary = descriptorByLabel(scanned, "Short summary (optional)");
  const summaryExecution = await executeWithUndoId(harness, summary, {
    kind: "TEXT",
    text: "Synthetic bounded summary",
  });
  expect(summaryExecution.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#nat-summary").inputValue()).toBe(
    "Synthetic bounded summary",
  );
  const undoOutcome = await undo(harness, summaryExecution);
  expect(undoOutcome.status).toBe("COMPLETED");
  expect(await harness.page.locator("#nat-summary").inputValue()).toBe("");
});

test("SEL1/RAD1/CHK1/DATE1: exact native choice and date drivers verify and checkbox undo restores", async ({
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
  const scanned = await descriptors(harness);
  const select = await execute(
    harness,
    descriptorByLabel(scanned, "Preferred work mode (required)"),
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0remote"),
    },
  );
  expect(select.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#nat-work-mode").inputValue()).toBe(
    "remote",
  );

  const radio = await execute(
    harness,
    descriptorByLabel(scanned, "Employment type (required)"),
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0full-time"),
    },
  );
  expect(radio.result.outcome).toBe("VERIFIED");
  await expect(harness.page.locator("#nat-type-full")).toBeChecked();

  const checkboxDescriptor = descriptorByLabel(
    scanned,
    "Email me synthetic status updates (optional)",
  );
  const consequentialRefusal = await execute(
    harness,
    checkboxDescriptor,
    { kind: "CHECKED", checked: true },
    await blockedDecision(checkboxDescriptor, "consequential-checkbox"),
  );
  expect(consequentialRefusal.result.outcome).toBe("BLOCKED_SENSITIVE");
  await expect(harness.page.locator("#nat-updates")).not.toBeChecked();

  const checkbox = await executeWithUndoId(harness, checkboxDescriptor, {
    kind: "CHECKED",
    checked: true,
  });
  expect(checkbox.result.outcome).toBe("VERIFIED");
  await expect(harness.page.locator("#nat-updates")).toBeChecked();
  expect((await undo(harness, checkbox)).status).toBe("COMPLETED");
  await expect(harness.page.locator("#nat-updates")).not.toBeChecked();

  const date = await execute(
    harness,
    descriptorByLabel(scanned, "Earliest start date (required)"),
    { kind: "DATE", iso_date: "2027-06-15" },
  );
  expect(date.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#nat-start-date").inputValue()).toBe(
    "2027-06-15",
  );
});

test("TX2/TX3/TX4/TX5/TX6: missing, ambiguous, stale, inert, and non-FILL targets perform no action", async ({
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
  await replaceBody(
    harness,
    `<main><form>
      <label for="target">Stable target</label><input id="target" name="stable">
      <label for="blocked">Blocked target</label><input id="blocked" name="blocked">
    </form></main>`,
  );
  let scanned = await descriptors(harness);
  const stable = descriptorByLabel(scanned, "Stable target");
  await harness.page.locator("label[for='target']").evaluate((label) => {
    label.textContent = "Semantic replacement";
  });
  const stale = await execute(harness, stable, {
    kind: "TEXT",
    text: "must-not-appear",
  });
  expect(stale.result.resolution_result).toBe("MISSING");
  expect(await harness.page.locator("#target").inputValue()).toBe("");

  await replaceBody(
    harness,
    `<main><form>
      <label>Ambiguous target <input name="same"></label>
      <label>Ambiguous target <input name="same"></label>
    </form></main>`,
  );
  scanned = await descriptors(harness);
  const ambiguous = await execute(
    harness,
    requireValue(scanned[0], "ambiguous descriptor missing"),
    {
      kind: "TEXT",
      text: "must-not-appear",
    },
  );
  expect(ambiguous.result.resolution_result).toBe("AMBIGUOUS");
  expect(
    await harness.page
      .locator("input")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      ),
  ).toEqual(["", ""]);

  await replaceBody(
    harness,
    `<main><form>
      <label for="disabled">Disabled field</label><input id="disabled" disabled>
      <label for="readonly">Readonly field</label><input id="readonly" readonly>
      <label for="hidden">Hidden field</label><input id="hidden" hidden>
      <label for="sensitive">Sensitive field</label><input id="sensitive">
      <div id="rich" role="textbox" aria-label="Rich text future owner" contenteditable="true" style="width:200px;height:40px"></div>
    </form></main>`,
  );
  scanned = await descriptors(harness);
  for (const label of ["Disabled field", "Readonly field", "Hidden field"]) {
    const outcome = await execute(harness, descriptorByLabel(scanned, label), {
      kind: "TEXT",
      text: "must-not-appear",
    });
    expect(outcome.result.outcome).not.toBe("VERIFIED");
  }
  const sensitive = descriptorByLabel(scanned, "Sensitive field");
  const refused = await execute(
    harness,
    sensitive,
    { kind: "TEXT", text: "must-not-appear" },
    await blockedDecision(sensitive, "sensitive"),
  );
  expect(refused.result.outcome).toBe("BLOCKED_SENSITIVE");
  expect(await harness.page.locator("#sensitive").inputValue()).toBe("");
  const rich = await execute(
    harness,
    descriptorByLabel(scanned, "Rich text future owner"),
    { kind: "TEXT", text: "must-not-appear" },
  );
  expect(rich.result.outcome).toBe("UNSUPPORTED");
  await expect(harness.page.locator("#rich")).toHaveText("");
});

test("FW1/FW2: real React and Vue state accept native-setter events and survive forced rerender", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const react = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/react/",
  );
  let scanned = await descriptors(react);
  await react.page.evaluate(() => {
    window.setTimeout(() => {
      document
        .getElementById("react-rerender")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, 20);
  });
  const reactResult = await executeWithUndoId(
    react,
    descriptorByLabel(scanned, "Full name (required)"),
    { kind: "TEXT", text: "Synthetic React" },
    125,
  );
  expect(reactResult.result.outcome).toBe("VERIFIED");
  await expect(react.page.locator("#react-state-full-name")).toHaveText(
    "Synthetic React",
  );
  await react.page.locator("#react-rerender").dispatchEvent("click");
  expect(await react.page.locator("#react-full-name").inputValue()).toBe(
    "Synthetic React",
  );
  expect((await undo(react, reactResult, 125)).status).toBe("COMPLETED");
  await expect(react.page.locator("#react-state-full-name")).toHaveText("");
  await react.page.locator("#react-rerender").dispatchEvent("click");
  expect(await react.page.locator("#react-full-name").inputValue()).toBe("");

  const vuePage = await extensionContext.newPage();
  await vuePage.goto(`${LAB_ORIGIN}/vue/`);
  await expect(vuePage.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
  );
  const vueTabId = await tabIdForPage(serviceWorker, vuePage);
  const vue: Harness = {
    page: vuePage,
    controller: react.controller,
    tabId: vueTabId,
  };
  scanned = await descriptors(vue);
  await vue.page.evaluate(() => {
    window.setTimeout(() => {
      document
        .getElementById("vue-rerender")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, 20);
  });
  const vueResult = await execute(
    vue,
    descriptorByLabel(scanned, "Full name (required)"),
    { kind: "TEXT", text: "Synthetic Vue" },
    undefined,
    125,
  );
  expect(vueResult.result.outcome).toBe("VERIFIED");
  await expect(vue.page.locator("#vue-state-full-name")).toHaveText(
    "Synthetic Vue",
  );
  await vue.page.locator("#vue-rerender").dispatchEvent("click");
  expect(await vue.page.locator("#vue-full-name").inputValue()).toBe(
    "Synthetic Vue",
  );
});

test("FW3/VAL1/VAL2/DATE2: immediate-only or site-rejected matches never verify", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const react = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/react/",
  );
  const scannedReact = await descriptors(react);
  await react.page.evaluate(() => {
    for (const eventName of ["input", "change"]) {
      document.addEventListener(
        eventName,
        (event) => {
          if ((event.target as HTMLElement).id === "react-full-name") {
            event.stopImmediatePropagation();
          }
        },
        true,
      );
    }
    window.setTimeout(() => {
      document
        .getElementById("react-rerender")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, 20);
  });
  const rollback = await execute(
    react,
    descriptorByLabel(scannedReact, "Full name (required)"),
    { kind: "TEXT", text: "Transient only" },
    undefined,
    125,
  );
  expect(rollback.result.outcome).toBe("FAILED");
  expect(rollback.result.reason_codes).toContain("PERSISTENCE_NOT_VERIFIED");
  expect(await react.page.locator("#react-full-name").inputValue()).toBe("");

  await replaceBody(
    react,
    `<main><form>
      <label for="rejected">Rejected value</label>
      <input id="rejected" aria-describedby="rejected-error">
      <p id="rejected-error" class="error"></p>
      <label for="date">Bounded date</label>
      <input id="date" type="date" min="2030-01-01">
    </form></main>`,
  );
  await react.page.locator("#rejected").evaluate((input) => {
    input.addEventListener("input", () => {
      const error = document.getElementById("rejected-error");
      if (error === null) throw new Error("rejection surface missing");
      error.textContent = "Rejected by synthetic site rule";
    });
  });
  const scanned = await descriptors(react);
  const rejected = await execute(
    react,
    descriptorByLabel(scanned, "Rejected value"),
    { kind: "TEXT", text: "matching-dom-value" },
  );
  expect(rejected.result.outcome).toBe("NEEDS_REVIEW");
  expect(rejected.result.reason_codes).toContain("SITE_REJECTED");
  expect(JSON.stringify(rejected)).not.toContain("matching-dom-value");
  expect(JSON.stringify(rejected)).not.toContain("Rejected by synthetic");

  const invalidDate = await execute(
    react,
    descriptorByLabel(scanned, "Bounded date"),
    { kind: "DATE", iso_date: "2027-01-01" },
  );
  expect(invalidDate.result.outcome).not.toBe("VERIFIED");
  expect(invalidDate.result.site_acceptance).toBe("REJECTED");
});

test("SEL2/SEL3/RAD2: missing, disabled, disappearing, and duplicate semantic options are never guessed", async ({
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
  await replaceBody(
    harness,
    `<main><form>
      <label for="choice">Exact choice</label>
      <select id="choice"><option value="" selected>Choose exactly</option><option value="unrelated">Only unrelated</option><option value="disabled" disabled>Disabled target</option></select>
      <fieldset><legend>Duplicate radio</legend>
        <label><input type="radio" name="dup" value="same"> First</label>
        <label><input type="radio" name="dup" value="same"> Second</label>
      </fieldset>
    </form></main>`,
  );
  const scanned = await descriptors(harness);
  const choice = descriptorByLabel(scanned, "Exact choice");
  const missing = await execute(harness, choice, {
    kind: "OPTION",
    value_digest: await semanticDigest("option-value-v1\0missing"),
  });
  expect(missing.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("#choice").inputValue()).toBe("");
  const disabled = await execute(harness, choice, {
    kind: "OPTION",
    value_digest: await semanticDigest("option-value-v1\0disabled"),
  });
  expect(disabled.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("#choice").inputValue()).toBe("");

  const radio = await execute(
    harness,
    descriptorByLabel(scanned, "Duplicate radio"),
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0same"),
    },
  );
  expect(radio.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("input[type=radio]:checked").count()).toBe(
    0,
  );

  await harness.page.locator("option[value='disabled']").evaluate((option) => {
    option.remove();
  });
  const vanished = await execute(harness, choice, {
    kind: "OPTION",
    value_digest: await semanticDigest("option-value-v1\0disabled"),
  });
  expect(vanished.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("#choice").inputValue()).toBe("");
});

test("COMBO1/COMBO2/COMBO3: ARIA combobox commits exact options, reselects after stale query, and refuses missing/duplicate targets", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/combobox/",
  );
  let scanned = await descriptors(harness);
  let combo = descriptorByLabel(scanned, "Office location");
  const first = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest(
      "option-value-v1\0Fable Crossing (synthetic)",
    ),
  });
  expect(first.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#cbx-input").inputValue()).toBe(
    "Fable Crossing (synthetic)",
  );

  scanned = await descriptors(harness);
  combo = descriptorByLabel(scanned, "Office location");
  const second = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest(
      "option-value-v1\0Harbor Point (synthetic)",
    ),
  });
  expect(second.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("#cbx-input").inputValue()).toBe(
    "Harbor Point (synthetic)",
  );

  const missing = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest("option-value-v1\0Not present"),
  });
  expect(missing.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("#cbx-input").inputValue()).toBe(
    "Harbor Point (synthetic)",
  );

  await harness.page.locator("#cbx-listbox").evaluate((list) => {
    list.removeAttribute("hidden");
    const duplicate = document.createElement("div");
    duplicate.setAttribute("role", "option");
    duplicate.setAttribute("data-value", "Harbor Point (synthetic)");
    duplicate.textContent = "Harbor Point duplicate";
    list.append(duplicate);
  });
  const ambiguous = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest(
      "option-value-v1\0Harbor Point (synthetic)",
    ),
  });
  expect(ambiguous.result.outcome).not.toBe("VERIFIED");
});

test("TX7: immediately-before-action re-resolution blocks semantic replacement, and partial widget failure rolls back", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/combobox/",
  );
  let scanned = await descriptors(harness);
  let combo = descriptorByLabel(scanned, "Office location");
  const priorDisplay = "Fable Crossing (synthetic)";
  const intendedDisplay = "Harbor Point (synthetic)";
  expect(
    (
      await execute(harness, combo, {
        kind: "OPTION",
        value_digest: await semanticDigest(`option-value-v1\0${priorDisplay}`),
      })
    ).result.outcome,
  ).toBe("VERIFIED");
  // Force the reviewed fixture back to its committed-value filtered window;
  // this makes the driver's reversible precondition probe the point where a
  // same-document semantic replacement can race the action.
  await harness.page.locator("#cbx-input").dispatchEvent("input");
  await harness.page.locator("#cbx-input").press("Escape");

  await harness.page.locator("#cbx-input").evaluate((input) => {
    let changed = false;
    input.addEventListener("input", () => {
      if (changed || (input as HTMLInputElement).value !== "") return;
      changed = true;
      const label = document.querySelector("label[for='cbx-input']");
      if (label === null) throw new Error("combobox label missing");
      label.textContent = "Replacement office location";
    });
  });
  const staleAction = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest(`option-value-v1\0${intendedDisplay}`),
  });
  expect(staleAction.result.resolution_result).not.toBe("UNIQUE");
  expect(await harness.page.locator("#cbx-input").inputValue()).toBe(
    priorDisplay,
  );

  await harness.page.locator("label[for='cbx-input']").evaluate((label) => {
    label.textContent = "Office location";
  });
  scanned = await descriptors(harness);
  combo = descriptorByLabel(scanned, "Office location");
  await harness.page.locator("#cbx-input").evaluate((input) => {
    let clearCount = 0;
    input.addEventListener("input", () => {
      if ((input as HTMLInputElement).value !== "") return;
      clearCount += 1;
      if (clearCount !== 3) return;
      document
        .querySelector<HTMLElement>(
          "[role='option'][data-value='Harbor Point (synthetic)']",
        )
        ?.remove();
    });
  });
  const recovered = await execute(harness, combo, {
    kind: "OPTION",
    value_digest: await semanticDigest(`option-value-v1\0${intendedDisplay}`),
  });
  expect(recovered.result.outcome).toBe("FAILED");
  expect(recovered.result.recovery).toMatchObject({
    attempted: true,
    restored: true,
  });
  expect(recovered.undo_available).toBe(false);
  expect(await harness.page.locator("#cbx-input").inputValue()).toBe(
    priorDisplay,
  );
});

test("VIRT1/VIRT2: the 480-row windowed list finds one off-window exact target within a bound and refuses absence", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  // The W10 windowed-listbox driver legitimately walks up to 480 bounded
  // scroll windows with real settle polls, measured at ~25 s green on the
  // reference machine — inside the Playwright 30 s default only by margin.
  // Explicit bounded budget for exactly this scenario (M02-W09 KI-precedent
  // pattern: per-test budget, no global change, no assertion change).
  test.setTimeout(60_000);
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/virtualized/",
  );
  const scanned = await descriptors(harness);
  const listbox = descriptorByLabel(scanned, "Assessment cohort");
  expect(await harness.page.locator("[role=option]").count()).toBeLessThan(30);
  const selected = await execute(
    harness,
    listbox,
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0COHORT-0417"),
    },
    undefined,
    100,
  );
  expect(selected.result.outcome).toBe("VERIFIED");
  await expect(harness.page.locator("#vl-committed")).toHaveText("COHORT-0417");
  expect(await harness.page.locator("[role=option]").count()).toBeLessThan(30);

  const absent = await execute(
    harness,
    listbox,
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0COHORT-9999"),
    },
    undefined,
    25,
  );
  expect(absent.result.outcome).not.toBe("VERIFIED");
  await expect(harness.page.locator("#vl-committed")).toHaveText("COHORT-0417");
});

test("REP1/REP2/REP3: bounded repeater add/edit/remove uses stable labels and undo never uses an index", async ({
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
  await replaceBody(
    harness,
    `<main><form><div data-japp-repeater="EXPERIENCE" data-japp-repeater-valid="true">
      <label for="rep-controller">Experience repeater</label>
      <input id="rep-controller" name="experienceRepeater" data-japp-repeater-controller="EXPERIENCE">
      <button type="button" data-japp-repeater-action="ADD">Add experience</button>
      <div data-japp-repeater-items></div>
    </div></form></main>`,
  );
  await harness.page.locator("[data-japp-repeater]").evaluate((root) => {
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-japp-repeater-action");
      const items = root.querySelector<HTMLElement>(
        "[data-japp-repeater-items]",
      );
      if (items === null) throw new Error("repeater items missing");
      if (action === "ADD") {
        const controller = root.querySelector<HTMLInputElement>(
          "[data-japp-repeater-controller]",
        );
        if (controller === null) throw new Error("repeater controller missing");
        const label = controller.value;
        const item = document.createElement("div");
        item.setAttribute("data-japp-repeater-item", "");
        item.setAttribute("data-japp-item-label", label);
        const editor = document.createElement("input");
        editor.setAttribute("data-japp-repeater-value", "");
        editor.setAttribute("aria-label", `${label} details`);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = `Remove ${label}`;
        remove.setAttribute("data-japp-repeater-action", "REMOVE");
        remove.setAttribute("data-japp-item-label", label);
        item.append(editor, remove);
        items.append(item);
        controller.value = "";
      } else if (action === "REMOVE") {
        target.closest("[data-japp-repeater-item]")?.remove();
      }
    });
  });
  let scanned = await descriptors(harness);
  let controller = descriptorByLabel(scanned, "Experience repeater");
  const added = await executeWithUndoId(harness, controller, {
    kind: "REPEATER_ADD",
    item_label: "Synthetic Role",
  });
  expect(added.result.outcome).toBe("VERIFIED");
  expect(await harness.page.locator("[data-japp-repeater-item]").count()).toBe(
    1,
  );
  expect((await undo(harness, added)).status).toBe("COMPLETED");
  expect(await harness.page.locator("[data-japp-repeater-item]").count()).toBe(
    0,
  );

  scanned = await descriptors(harness);
  controller = descriptorByLabel(scanned, "Experience repeater");
  expect(
    (
      await execute(harness, controller, {
        kind: "REPEATER_ADD",
        item_label: "Synthetic Role",
      })
    ).result.outcome,
  ).toBe("VERIFIED");
  scanned = await descriptors(harness);
  controller = descriptorByLabel(scanned, "Experience repeater");
  expect(
    (
      await execute(harness, controller, {
        kind: "REPEATER_EDIT",
        item_label: "Synthetic Role",
        text: "Edited synthetic details",
      })
    ).result.outcome,
  ).toBe("VERIFIED");
  expect(
    await harness.page.locator("[data-japp-repeater-value]").inputValue(),
  ).toBe("Edited synthetic details");

  await harness.page.locator("[data-japp-repeater-items]").evaluate((items) => {
    const existing = items.querySelector("[data-japp-repeater-item]");
    if (existing !== null) items.append(existing.cloneNode(true));
  });
  scanned = await descriptors(harness);
  controller = descriptorByLabel(scanned, "Experience repeater");
  const ambiguous = await execute(harness, controller, {
    kind: "REPEATER_REMOVE",
    item_label: "Synthetic Role",
  });
  expect(ambiguous.result.outcome).not.toBe("VERIFIED");
  expect(await harness.page.locator("[data-japp-repeater-item]").count()).toBe(
    2,
  );
});

test("UPLOAD1-4: only exact bounded synthetic artifact bytes and metadata verify, and clear undo restores empty", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/upload/",
  );
  const scanned = await descriptors(harness);
  const upload = descriptorByLabel(
    scanned,
    "Synthetic resume document (.pdf or .txt, max 512,000 bytes)",
  );
  const content = "synthetic document bytes";
  const encoded = Buffer.from(content, "utf8").toString("base64");
  const exact = await executeWithUndoId(harness, upload, {
    kind: "FILE",
    file_name: "synthetic.txt",
    media_type: "text/plain",
    size_bytes: Buffer.byteLength(content),
    artifact_digest: await semanticDigest(content),
    content_base64: encoded,
  });
  expect(exact.result.outcome).toBe("VERIFIED");
  await expect(harness.page.locator("#up-status")).toContainText(
    "ACCEPTED_LOCALLY",
  );
  expect((await undo(harness, exact)).status).toBe("COMPLETED");
  await expect(harness.page.locator("#up-status")).toHaveText("NO_FILE");

  const wrongType = await execute(harness, upload, {
    kind: "FILE",
    file_name: "synthetic.png",
    media_type: "image/png",
    size_bytes: Buffer.byteLength(content),
    artifact_digest: await semanticDigest(content),
    content_base64: encoded,
  });
  expect(wrongType.result.outcome).not.toBe("VERIFIED");

  const wrongArtifact = await execute(harness, upload, {
    kind: "FILE",
    file_name: "synthetic.txt",
    media_type: "text/plain",
    size_bytes: Buffer.byteLength(content),
    artifact_digest: `sha256:${"f".repeat(64)}`,
    content_base64: encoded,
  });
  expect(wrongArtifact.result.outcome).not.toBe("VERIFIED");

  const decision = await fillDecision(upload, "oversize");
  const response = await runtimeMessage(harness.controller, {
    kind: "M02_W10_EXECUTE_TAB",
    protocolVersion: 1,
    requestId: "oversize",
    tabId: harness.tabId,
    transaction: {
      transaction_id: await stableSemanticId("transaction", "oversize"),
      correlation_id: decision.correlation_id,
      address: upload.address,
      decision,
      intended: {
        kind: "FILE",
        file_name: "oversize.txt",
        media_type: "text/plain",
        size_bytes: 512_001,
        artifact_digest: await semanticDigest("oversize"),
        content_base64: "",
      },
      settle: { budget_ms: 25 },
    },
  });
  expect(response).toBeUndefined();
  await expect(harness.page.locator("#up-status")).toHaveText("NO_FILE");
});

test("WD1/WD2/WD3: synthetic prompt transacts, while navigation is identification-only and ambiguity/unsafe state never acts", async ({
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
  await replaceBody(
    harness,
    `<main><form><div aria-label="Synthetic Workday prompt" role="combobox" aria-controls="wd-options" aria-expanded="false" tabindex="0" style="display:block;width:240px;height:32px"></div>
      <div id="wd-options" role="listbox" hidden>
        <div id="wd-a" role="option" data-value="PROMPT-A" aria-selected="false">Prompt A</div>
        <div id="wd-b" role="option" data-value="PROMPT-B" aria-selected="false">Prompt B</div>
      </div>
      <button id="next" type="button">Next</button>
    </form></main>`,
  );
  await harness.page.evaluate(() => {
    const prompt = document.querySelector<HTMLElement>("[role=combobox]");
    const list = document.getElementById("wd-options");
    const next = document.getElementById("next");
    if (prompt === null || list === null || next === null) {
      throw new Error("prompt fixture missing");
    }
    prompt.addEventListener("click", () => {
      list.removeAttribute("hidden");
      prompt.setAttribute("aria-expanded", "true");
    });
    list.addEventListener("click", (event) => {
      const option = event.target;
      if (!(option instanceof HTMLElement)) return;
      for (const node of list.querySelectorAll("[role=option]")) {
        node.setAttribute("aria-selected", String(node === option));
      }
      prompt.setAttribute("aria-activedescendant", option.id);
      prompt.setAttribute("aria-expanded", "false");
      list.setAttribute("hidden", "");
    });
    (globalThis as typeof globalThis & { __navClicks?: number }).__navClicks =
      0;
    next.addEventListener("click", () => {
      (globalThis as typeof globalThis & { __navClicks: number }).__navClicks +=
        1;
    });
  });
  const scanned = await descriptors(harness);
  const prompt = await execute(
    harness,
    descriptorByLabel(scanned, "Synthetic Workday prompt"),
    {
      kind: "OPTION",
      value_digest: await semanticDigest("option-value-v1\0PROMPT-B"),
    },
  );
  expect(prompt.result.outcome, JSON.stringify(prompt.result)).toBe("VERIFIED");
  await expect(harness.page.locator("#wd-b")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  expect((await identifyNavigation(harness)).identification.status).toBe(
    "UNIQUE_SAFE_CANDIDATE",
  );
  expect(
    await harness.page.evaluate(
      () =>
        (globalThis as typeof globalThis & { __navClicks?: number })
          .__navClicks,
    ),
  ).toBe(0);

  await harness.page.locator("form").evaluate((form) => {
    const second = document.createElement("button");
    second.type = "button";
    second.textContent = "Continue";
    form.append(second);
  });
  expect((await identifyNavigation(harness)).identification.status).toBe(
    "AMBIGUOUS",
  );
  await harness.page.locator("button").evaluateAll((buttons) => {
    for (const button of buttons) button.remove();
    const unsafe = document.createElement("button");
    unsafe.type = "submit";
    unsafe.textContent = "Submit application";
    const form = document.querySelector("form");
    if (form === null) throw new Error("navigation form missing");
    form.append(unsafe);
  });
  expect((await identifyNavigation(harness)).identification.status).toBe(
    "UNSAFE",
  );
});

test("UNDO2 and frame/document authority: restoration re-resolves, consumes stale attempts, and page world cannot forge controller authority", async ({
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
  const scanned = await descriptors(harness);
  const firstName = descriptorByLabel(scanned, "First name (required)");
  const ambiguousExecution = await executeWithUndoId(harness, firstName, {
    kind: "TEXT",
    text: "Ambiguous undo must not guess",
  });
  await harness.page.locator("#nat-first-name").evaluate((original) => {
    const duplicate = original.cloneNode(false) as HTMLInputElement;
    duplicate.id = "duplicate-first-name";
    duplicate.value = "";
    const duplicateLabel = document.createElement("label");
    duplicateLabel.htmlFor = duplicate.id;
    duplicateLabel.textContent = "First name (required)";
    const row = original.closest(".field");
    if (row === null) throw new Error("native field row missing");
    row.after(duplicateLabel, duplicate);
  });
  const ambiguousDescriptors = (await descriptors(harness)).filter(
    (descriptor) =>
      descriptor.label.normalized_text === "First name (required)",
  );
  expect(ambiguousDescriptors).toHaveLength(2);
  expect(ambiguousDescriptors.map((descriptor) => descriptor.address)).toEqual([
    firstName.address,
    firstName.address,
  ]);
  const ambiguousUndo = await undo(harness, ambiguousExecution);
  expect(ambiguousUndo.status).toBe("COMPLETED");
  if (ambiguousUndo.status === "COMPLETED") {
    expect(ambiguousUndo.result.resolution_result).toBe("AMBIGUOUS");
    expect(ambiguousUndo.result.outcome).not.toBe("VERIFIED");
  }
  expect(await harness.page.locator("#nat-first-name").inputValue()).toBe(
    "Ambiguous undo must not guess",
  );
  expect(await harness.page.locator("#duplicate-first-name").inputValue()).toBe(
    "",
  );
  expect((await undo(harness, ambiguousExecution)).status).toBe(
    "ALREADY_CONSUMED",
  );
  await harness.page
    .locator("#duplicate-first-name,label[for='duplicate-first-name']")
    .evaluateAll((nodes) => {
      for (const node of nodes) node.remove();
    });

  const summary = descriptorByLabel(scanned, "Short summary (optional)");
  const execution = await executeWithUndoId(harness, summary, {
    kind: "TEXT",
    text: "Undo must not guess",
  });
  await harness.page.locator("label[for='nat-summary']").evaluate((label) => {
    label.textContent = "Replacement summary";
  });
  const staleUndo = await undo(harness, execution);
  expect(staleUndo.status).toBe("COMPLETED");
  if (staleUndo.status === "COMPLETED") {
    expect(staleUndo.result.outcome).not.toBe("VERIFIED");
  }
  expect(await harness.page.locator("#nat-summary").inputValue()).toBe(
    "Undo must not guess",
  );
  expect((await undo(harness, execution)).status).toBe("ALREADY_CONSUMED");

  expect(
    await harness.page.evaluate(() => {
      const candidate = globalThis as typeof globalThis & {
        chrome?: { runtime?: { sendMessage?: unknown } };
      };
      return typeof candidate.chrome?.runtime?.sendMessage;
    }),
  ).not.toBe("function");

  const wrongDocument = {
    ...summary,
    address: {
      ...summary.address,
      document_id: await stableSemanticId("document", "wrong-document"),
    },
  };
  const wrong = await execute(harness, wrongDocument, {
    kind: "TEXT",
    text: "wrong document must not act",
  });
  expect(wrong.result.resolution_result).toBe("STALE");
  expect(await harness.page.locator("#nat-summary").inputValue()).toBe(
    "Undo must not guess",
  );

  const wrongFrame = {
    ...summary,
    address: {
      ...summary.address,
      frame_id: await stableSemanticId("frame", "wrong-frame"),
    },
  };
  const wrongFrameDecision = await fillDecision(wrongFrame, "wrong-frame");
  const wrongFrameResponse = parseExecuteTabResult(
    await runtimeMessage(
      harness.controller,
      buildExecuteTabRequest("wrong-frame", harness.tabId, {
        transaction_id: await stableSemanticId("transaction", "wrong-frame"),
        correlation_id: wrongFrameDecision.correlation_id,
        address: wrongFrame.address,
        decision: wrongFrameDecision,
        intended: { kind: "TEXT", text: "wrong frame must not act" },
        settle: { budget_ms: 25 },
      }),
    ),
  );
  expect(wrongFrameResponse?.outcome.status).toBe("FRAME_UNAVAILABLE");
  expect(await harness.page.locator("#nat-summary").inputValue()).toBe(
    "Undo must not guess",
  );

  const timeoutDecision = await fillDecision(firstName, "settle-timeout");
  const timeoutResponse = parseExecuteTabResult(
    await runtimeMessage(
      harness.controller,
      buildExecuteTabRequest("settle-timeout", harness.tabId, {
        transaction_id: await stableSemanticId("transaction", "settle-timeout"),
        correlation_id: timeoutDecision.correlation_id,
        address: firstName.address,
        decision: timeoutDecision,
        intended: { kind: "TEXT", text: "bounded timeout value" },
        settle: { budget_ms: 25, require_page_signal: "NEVER" },
      }),
    ),
  );
  expect(timeoutResponse?.outcome.status).toBe("COMPLETED");
  if (timeoutResponse?.outcome.status === "COMPLETED") {
    expect(timeoutResponse.outcome.result.outcome).toBe("NEEDS_REVIEW");
    expect(timeoutResponse.outcome.result.reason_codes).toContain(
      "PERSISTENCE_NOT_VERIFIED",
    );
    expect(timeoutResponse.outcome.result.persistence_verified).toBe(false);
  }
  expect(await harness.page.locator("#nat-first-name").inputValue()).toBe(
    "bounded timeout value",
  );
});
