// M02-W07 proof D — the feasibility extension is inert except for its
// namespaced readiness marker: it changes no input value, checks no
// control, selects no option, clicks no navigation, submits nothing, and
// creates no receipt, before or after activation and reload (spec §1.5 "no
// product behavior in W07"; REQ-FORM-025). Network isolation is asserted
// automatically for every extension-context test by the shared fixture.
import type { Page } from "@playwright/test";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const MARKER_TIMEOUT_MS = 15_000;
const SETTLE_MS = 1_000;

// Every user-facing control on the richest plain-DOM lab form, plus the
// hidden honeypot (#nat-company-site) that must never be filled.
const NATIVE_VALUE_CONTROL_IDS = [
  "nat-first-name",
  "nat-last-name",
  "nat-email",
  "nat-phone",
  "nat-notice-years",
  "nat-summary",
  "nat-work-mode",
  "nat-start-date",
  "nat-company-site",
] as const;
const NATIVE_CHECKED_CONTROL_IDS = [
  "nat-type-full",
  "nat-type-part",
  "nat-type-contract",
  "nat-updates",
  "nat-auth-yes",
  "nat-auth-no",
  "nat-disclosure",
] as const;

interface NativeFormSnapshot {
  values: Record<string, string>;
  checked: Record<string, boolean>;
  statusText: string;
  flowState: string | null;
  receiptState: string | null;
}

async function snapshotNativeForm(page: Page): Promise<NativeFormSnapshot> {
  return page.evaluate(
    ({ valueIds, checkedIds }) => {
      const values: Record<string, string> = {};
      for (const id of valueIds) {
        const control = document.getElementById(id);
        if (
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement ||
          control instanceof HTMLSelectElement
        ) {
          values[id] = control.value;
        } else {
          values[id] = "<missing control>";
        }
      }
      const checked: Record<string, boolean> = {};
      for (const id of checkedIds) {
        const control = document.getElementById(id);
        checked[id] =
          control instanceof HTMLInputElement ? control.checked : false;
      }
      return {
        values,
        checked,
        statusText: document.getElementById("nat-status")?.textContent ?? "",
        flowState: window.sessionStorage.getItem("japp-mock-ats-lab.flow.v1"),
        receiptState: window.sessionStorage.getItem(
          "japp-mock-ats-lab.receipts.v1",
        ),
      };
    },
    {
      valueIds: [...NATIVE_VALUE_CONTROL_IDS],
      checkedIds: [...NATIVE_CHECKED_CONTROL_IDS],
    },
  );
}

function expectPristine(snapshot: NativeFormSnapshot): void {
  // Every control resolved (guards against silently-renamed fixtures) and
  // every value is untouched: empty strings for text controls, unchecked
  // boxes, empty honeypot, and no flow or receipt state.
  for (const id of NATIVE_VALUE_CONTROL_IDS) {
    expect(snapshot.values[id], `#${id} must exist`).not.toBe(
      "<missing control>",
    );
    if (id !== "nat-work-mode") {
      expect(snapshot.values[id], `#${id} must stay empty`).toBe("");
    }
  }
  for (const id of NATIVE_CHECKED_CONTROL_IDS) {
    expect(snapshot.checked[id], `#${id} must stay unchecked`).toBe(false);
  }
  expect(snapshot.receiptState).toBeNull();
}

test("W07 changes no control on the native form before or after activation and reload", async ({
  extensionContext,
}) => {
  const page = await extensionContext.newPage();
  // Page-world observation: the extension must not be page-observable
  // through window messages. WXT's default content-script-started
  // postMessage broadcast is suppressed in the entrypoint; this collector
  // proves the suppression holds on every navigation.
  await page.addInitScript(() => {
    const collected: string[] = [];
    (window as unknown as Record<string, unknown>).__japp_observed_messages__ =
      collected;
    window.addEventListener("message", (event: MessageEvent) => {
      const data: unknown = event.data;
      const type =
        typeof data === "object" && data !== null && "type" in data
          ? String((data as Record<string, unknown>).type)
          : typeof data === "string"
            ? data
            : "";
      collected.push(type);
    });
  });
  await page.goto(`${LAB_ORIGIN}/native/`);
  const beforeActivation = await snapshotNativeForm(page);
  expectPristine(beforeActivation);

  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
  const afterActivation = await snapshotNativeForm(page);
  expectPristine(afterActivation);
  expect(afterActivation).toEqual(beforeActivation);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
  const afterReload = await snapshotNativeForm(page);
  expectPristine(afterReload);
  expect(afterReload).toEqual(beforeActivation);

  const observedMessages = await page.evaluate(
    () =>
      (window as unknown as Record<string, unknown>)
        .__japp_observed_messages__ as string[],
  );
  expect(
    observedMessages.filter((type) => type.includes("content-script-started")),
    "the extension must not broadcast page-observable injection messages",
  ).toEqual([]);
});

test("W07 performs no navigation and creates no receipt on the multipage application flow", async ({
  extensionContext,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/apply/step-1/`);
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
  // Still on step 1: nothing clicked Next, nothing advanced the flow, and
  // no receipt exists anywhere in the session.
  expect(new URL(page.url()).pathname).toBe("/apply/step-1/");
  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("japp-mock-ats-lab.receipts.v1"),
    ),
  ).toBeNull();
});

test("the extension context issues only loopback and browser-internal traffic across lab navigation", async ({
  extensionContext,
}) => {
  // The shared fixture records every request in this context and fails the
  // test on any non-local URL at teardown; this test drives a
  // representative navigation set through that assertion.
  const page = await extensionContext.newPage();
  for (const path of ["/", "/native/", "/apply/step-1/"]) {
    await page.goto(`${LAB_ORIGIN}${path}`);
    await expect(page.locator("html")).toHaveAttribute(
      CONTENT_READY_ATTRIBUTE,
      CONTENT_READY_VALUE,
      { timeout: MARKER_TIMEOUT_MS },
    );
  }
});
