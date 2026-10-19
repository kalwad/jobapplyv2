import { test, expect } from "@playwright/test";
import { PUBLIC_SOURCES } from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  buildScanTabRequest,
  parseAggregatedScanResult,
} from "../../../apps/extension/src/scanner-protocol.ts";
import { buildExecuteTabRequest } from "../../../apps/extension/src/driver-protocol.ts";
import { fillDecision, buildTransaction } from "../support/research-harness.ts";
import {
  launchInspection,
  scanPublicPage,
  runtimeMessage,
  tabIdForPage,
  DEFAULT_EXTENSION_DIST,
} from "./inspection-harness.ts";

const HTML =
  '<!doctype html><html><body><form><label for="first">First name</label><input id="first" required><button type="submit">Submit application</button></form></body></html>';

test("public inspect-only build observes a real registered frame but refuses a valid field transaction and a changed URL", async () => {
  const session = await launchInspection();
  try {
    const source = PUBLIC_SOURCES.find((row) => row.ats === "GREENHOUSE");
    if (source === undefined) throw new Error("scope empty");
    const page = await session.context.newPage();
    await page.route("**/*", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: HTML }),
    );
    await page.goto(source.url);
    const observed = await scanPublicPage(session, page, "scope-positive");
    expect(observed.state).toBe("FOUND");
    expect(observed.scan?.frames).toHaveLength(1);
    const frame = observed.scan?.frames[0];
    const descriptor = frame?.descriptors[0];
    if (descriptor === undefined) throw new Error("descriptor absent");
    const transaction = await buildTransaction(
      descriptor,
      { kind: "TEXT", text: "Synthetic negative probe" },
      await fillDecision(descriptor, "public-refusal"),
      "public-refusal",
    );
    const tabId = await tabIdForPage(session.worker, page);
    let reply: unknown;
    try {
      reply = await runtimeMessage(
        session.controller,
        buildExecuteTabRequest("denied", tabId, transaction),
      );
    } catch {
      reply = undefined;
    }
    expect(reply).toBeUndefined();
    await expect(page.locator("input")).toHaveValue("");
    expect(
      await page
        .locator("html")
        .getAttribute("data-japp-m02-w07-extension-ready"),
    ).toBeNull();
    await page.evaluate(() => {
      history.replaceState(null, "", "/another-job/apply");
    });
    const changed = parseAggregatedScanResult(
      await runtimeMessage(
        session.controller,
        buildScanTabRequest("scope-changed", tabId, {
          kind: "APPLICATION_ROOT",
        }),
      ),
    );
    expect(changed?.frames).toEqual([]);
    const other = PUBLIC_SOURCES.find(
      (row) =>
        row.url !== source.url &&
        new URL(row.url).origin === new URL(source.url).origin,
    );
    if (other === undefined) throw new Error("same-origin sibling absent");
    await page.evaluate((url) => {
      history.replaceState(null, "", url);
    }, other.url);
    const movedToAnotherApprovedJob = parseAggregatedScanResult(
      await runtimeMessage(
        session.controller,
        buildScanTabRequest("scope-other-approved", tabId, {
          kind: "APPLICATION_ROOT",
        }),
      ),
    );
    expect(movedToAnotherApprovedJob?.frames).toEqual([]);
    await expect(page.locator("input")).toHaveValue("");
  } finally {
    await session.cleanup();
  }
});

test("default loopback build never registers an intercepted public URL", async () => {
  const session = await launchInspection(DEFAULT_EXTENSION_DIST);
  try {
    const source = PUBLIC_SOURCES[0];
    const page = await session.context.newPage();
    await page.route("**/*", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: HTML }),
    );
    await page.goto(source.url);
    const tabId = await tabIdForPage(session.worker, page);
    const observed = parseAggregatedScanResult(
      await runtimeMessage(
        session.controller,
        buildScanTabRequest("default-public-denied", tabId, {
          kind: "APPLICATION_ROOT",
        }),
      ),
    );
    expect(observed?.frames).toEqual([]);
    await expect(page.locator("input")).toHaveValue("");
  } finally {
    await session.cleanup();
  }
});
