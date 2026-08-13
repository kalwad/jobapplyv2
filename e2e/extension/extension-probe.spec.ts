// M02-W07 proof C/E/F — the real built content script executes on the
// loopback mock ATS origin only, its readiness marker requires a valid
// round-trip through the actual service worker, and a reload re-establishes
// the probe through the real extension runtime (REQ-FORM-020).
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const MARKER_TIMEOUT_MS = 15_000;
const NEGATIVE_SETTLE_MS = 1_000;

test("the real content script establishes the probe round-trip and sets the namespaced readiness marker", async ({
  extensionContext,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/`);
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  // The marker can only follow a strictly valid ACK from the service
  // worker; the worker observed by Playwright is the one that answered.
  expect(serviceWorker.url()).toContain("chrome-extension://");
});

test("the readiness marker comes from the extension runtime, never from the lab page itself", async ({
  page,
}) => {
  // Negative control: the default Playwright context has no extension
  // loaded. The same lab page must never carry the marker on its own, so
  // the marker in the extension context is real extension evidence.
  await page.goto(`${LAB_ORIGIN}/`);
  await expect(page.locator("[data-lab-notice]").first()).toBeVisible();
  await page.waitForTimeout(NEGATIVE_SETTLE_MS);
  expect(
    await page.evaluate(
      (attribute) => document.documentElement.getAttribute(attribute),
      CONTENT_READY_ATTRIBUTE,
    ),
  ).toBeNull();
});

test("the content script does not execute on a non-matching document", async ({
  extensionContext,
}) => {
  const page = await extensionContext.newPage();
  await page.goto("about:blank");
  await page.waitForTimeout(NEGATIVE_SETTLE_MS);
  expect(
    await page.evaluate(
      (attribute) => document.documentElement.getAttribute(attribute),
      CONTENT_READY_ATTRIBUTE,
    ),
  ).toBeNull();
});

test("a reload re-establishes the probe through the real extension runtime", async ({
  extensionContext,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await page.reload();
  // The reload produced a fresh document without the marker; only a fresh
  // probe round-trip through the actual extension runtime can restore it.
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  expect(
    extensionContext
      .serviceWorkers()
      .some((worker) => worker.url().startsWith("chrome-extension://")),
  ).toBe(true);
});
