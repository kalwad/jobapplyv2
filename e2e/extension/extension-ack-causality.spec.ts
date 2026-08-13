// M02-W07 proof B — the readiness marker is caused by a valid worker ACK.
// A built test-only WXT variant re-exports the actual production content
// entrypoint but returns a structurally invalid ACK from its isolated worker.
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const PROBE_COUNT_KEY = "__JAPP_M02_W07_INVALID_ACK_PROBE_COUNT__";
const PROBE_TIMEOUT_MS = 15_000;
const SETTLE_MS = 1_000;

test("the actual content entrypoint leaves readiness absent after an invalid worker ACK", async ({
  invalidAckExtensionContext,
  invalidAckServiceWorker,
}) => {
  const page = await invalidAckExtensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);

  await expect
    .poll(
      () =>
        invalidAckServiceWorker.evaluate(
          (key) => Number((globalThis as Record<string, unknown>)[key]),
          PROBE_COUNT_KEY,
        ),
      { timeout: PROBE_TIMEOUT_MS },
    )
    .toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(SETTLE_MS);

  expect(
    await page.locator("html").getAttribute(CONTENT_READY_ATTRIBUTE),
  ).not.toBe(CONTENT_READY_VALUE);
  expect(
    await page.locator("html").getAttribute(CONTENT_READY_ATTRIBUTE),
  ).toBeNull();
});
