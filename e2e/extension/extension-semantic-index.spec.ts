import type { FormFieldDescriptorV1 } from "../../packages/contracts/generated/typescript/index.ts";
import {
  buildReresolveTabRequest,
  parseReresolveTabResult,
} from "../../apps/extension/src/scanner-protocol.ts";
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  runtimeMessage,
  nextId,
  requireValue,
  dynExecute,
  dynReconcile,
  reconciled,
  dynState,
  type Harness,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";

async function resolve(harness: Harness, descriptor: FormFieldDescriptorV1) {
  const parsed = parseReresolveTabResult(
    await runtimeMessage(
      harness.controller,
      buildReresolveTabRequest(
        nextId("index-proof"),
        harness.tabId,
        descriptor.address,
      ),
    ),
  );
  return requireValue(parsed, "invalid current semantic resolution").resolution;
}

test("W13 index: warm identities invalidate external associations, sections and duplicate candidates", async ({
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
    `<label id="external" for="first">First name</label>
    <span id="aria">Family name</span><form data-japp-application-root="true">
    <h2 id="heading">Application</h2><section id="section" aria-label="Identity">
    <input id="first" name="firstName" required><input id="family" name="familyName" aria-labelledby="aria">
    </section></form>`,
  );
  const top = foundTopFrame(await scanFrames(harness));
  const first = descriptorByLabel(top.descriptors, "First name");
  const family = descriptorByLabel(top.descriptors, "Family name");
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  expect((await resolve(harness, family)).status).toBe("RESOLVED");
  await harness.page.locator("#external").evaluate((label) => {
    label.textContent = "Changed name";
  });
  expect((await resolve(harness, first)).status).toBe("UNRESOLVED");
  await harness.page.locator("#external").evaluate((label) => {
    label.textContent = "First name";
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  await harness.page.locator("#external").evaluate((label) => {
    label.setAttribute("for", "family");
  });
  expect((await resolve(harness, first)).status).toBe("UNRESOLVED");
  await harness.page.locator("#external").evaluate((label) => {
    label.setAttribute("for", "first");
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  // An earlier duplicate ID outside the application root re-associates the
  // native external label. The index must observe the whole document.
  await harness.page.evaluate(() => {
    const outside = document.createElement("input");
    outside.id = "first";
    outside.dataset.indexProofOutside = "true";
    document.body.prepend(outside);
  });
  expect((await resolve(harness, first)).status).toBe("UNRESOLVED");
  await harness.page.locator("[data-index-proof-outside]").evaluate((node) => {
    node.remove();
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  await harness.page.locator("#aria").evaluate((node) => {
    node.textContent = "Changed family";
  });
  expect((await resolve(harness, family)).status).toBe("UNRESOLVED");
  await harness.page.locator("#aria").evaluate((node) => {
    node.textContent = "Family name";
  });
  expect((await resolve(harness, family)).status).toBe("RESOLVED");
  await harness.page.locator("#heading").evaluate((node) => {
    node.textContent = "Different application";
  });
  expect((await resolve(harness, first)).status).toBe("UNRESOLVED");
  await harness.page.locator("#heading").evaluate((node) => {
    node.textContent = "Application";
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  await harness.page.locator("#section").evaluate((node) => {
    node.setAttribute("aria-label", "Other identity");
  });
  expect((await resolve(harness, first)).status).toBe("UNRESOLVED");
  await harness.page.locator("#section").evaluate((node) => {
    node.setAttribute("aria-label", "Identity");
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  await harness.page.evaluate(() => {
    const duplicate = document.createElement("input");
    duplicate.id = "duplicate";
    duplicate.name = "firstName";
    duplicate.required = true;
    const label = document.createElement("label");
    label.htmlFor = duplicate.id;
    label.id = "duplicate-label";
    label.textContent = "First name";
    document.getElementById("section")?.append(label, duplicate);
  });
  expect(await resolve(harness, first)).toEqual({
    status: "AMBIGUOUS",
    candidate_count: 2,
  });
  await harness.page.evaluate(() => {
    document.getElementById("duplicate")?.remove();
    document.getElementById("duplicate-label")?.remove();
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  const snapshot = await dynState(harness, top.frame_context.frame_id);
  expect(snapshot.scanner_work?.index_invalidations).toBeGreaterThanOrEqual(12);
  expect(snapshot.actions_executed).toBe(0);
  await expect(harness.page.locator("#first")).toHaveValue("");
});

test("W13 index: semantic rerender and property-only state never inherit stale node authority", async ({
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
    `<style id="css"></style><form data-japp-application-root="true">
    <label for="first">First name</label><input id="first" name="firstName" required></form>`,
  );
  await harness.page.evaluate(() => {
    document.documentElement.dataset.physicalFills = "0";
    document.querySelector("form")?.addEventListener("input", () => {
      document.documentElement.dataset.physicalFills = String(
        Number(document.documentElement.dataset.physicalFills) + 1,
      );
    });
  });
  const top = foundTopFrame(await scanFrames(harness));
  const first = descriptorByLabel(top.descriptors, "First name");
  const transaction = await approvedTransaction(first, "index-warm", {
    kind: "TEXT",
    text: "Synthetic warm",
  });
  const initial = await dynExecute(harness, [
    { ...transaction, settle: { budget_ms: 0 } },
  ]);
  expect(initial.items[0]?.status).toBe("EXECUTED");
  await harness.page.locator("#first").evaluate((node) => {
    const old = node as HTMLInputElement;
    const page = globalThis as unknown as { indexProofOld: HTMLInputElement };
    page.indexProofOld = old;
    const replacement = old.cloneNode(false) as HTMLInputElement;
    replacement.value = "";
    old.replaceWith(replacement);
  });
  expect((await resolve(harness, first)).status).toBe("RESOLVED");
  const fresh = await approvedTransaction(first, "index-fresh", {
    kind: "TEXT",
    text: "Synthetic fresh",
  });
  const rerender = await dynExecute(harness, [
    { ...fresh, settle: { budget_ms: 0 } },
  ]);
  expect(rerender.items[0]?.status).toBe("EXECUTED");
  await expect(harness.page.locator("#first")).toHaveValue("Synthetic fresh");
  expect(
    await harness.page.evaluate(
      () =>
        (globalThis as unknown as { indexProofOld: HTMLInputElement })
          .indexProofOld.value,
    ),
  ).toBe("Synthetic warm");
  expect(
    await harness.page.locator("html").getAttribute("data-physical-fills"),
  ).toBe("2");
  // CSSOM and property setters need not emit any attribute/text mutation.
  const before = await dynState(harness, top.frame_context.frame_id);
  await harness.page.evaluate(() => {
    const style = document.getElementById("css") as HTMLStyleElement;
    style.sheet?.insertRule("#first { display: none; }");
  });
  const hidden = await resolve(harness, first);
  expect(hidden.status).toBe("RESOLVED");
  if (hidden.status === "RESOLVED")
    expect(hidden.descriptor.visible).toBe(false);
  const after = await dynState(harness, top.frame_context.frame_id);
  expect(after.scanner_work?.index_rebuilds).toBe(
    before.scanner_work?.index_rebuilds,
  );
  await harness.page.evaluate(() =>
    (document.getElementById("css") as HTMLStyleElement).sheet?.deleteRule(0),
  );
  await harness.page.locator("#first").evaluate((node) => {
    (node as HTMLInputElement).value = "";
  });
  const missing = reconciled(
    await dynReconcile(harness, top.frame_context.frame_id),
  );
  expect(missing.inventory.counts.required_unresolved).toBe(1);
  expect(missing.inventory.readiness).toBe("NOT_READY");
  await harness.page.locator("#first").evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "Synthetic fresh";
    input.setCustomValidity("Synthetic site rejection");
  });
  const rejected = reconciled(
    await dynReconcile(harness, top.frame_context.frame_id),
  );
  expect(rejected.inventory.counts.required_unresolved).toBe(1);
  expect(rejected.inventory.readiness).toBe("NOT_READY");
  expect(
    await harness.page.locator("html").getAttribute("data-physical-fills"),
  ).toBe("2");
});

test("W13 index: mutation during awaited descriptor hashing refuses obsolete global uniqueness", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  test.setTimeout(120_000);
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(
    harness,
    `<form data-japp-application-root="true"><label for="choice">First name</label>
    <select id="choice" name="firstName" required></select></form>`,
  );
  await harness.page.evaluate(() => {
    const select = document.getElementById("choice") as HTMLSelectElement;
    const option = document.createElement("option");
    option.textContent = "Synthetic option";
    option.value = "x".repeat(8192);
    select.append(option);
  });
  const top = foundTopFrame(await scanFrames(harness));
  const choice = descriptorByLabel(top.descriptors, "First name");
  expect((await resolve(harness, choice)).status).toBe("RESOLVED");
  // Inject latency into the actual isolated-world WebCrypto dependency. A
  // controlled barrier proves the awaited race without timing assumptions or
  // production test hooks. All hashes still use the original native method.
  const cdp = await extensionContext.newCDPSession(harness.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on("Runtime.executionContextCreated", ({ context }) => {
    worlds.push({ id: context.id, origin: context.origin });
  });
  await cdp.send("Runtime.enable");
  const world = worlds.find(
    (context) => context.origin === `chrome-extension://${extensionId}`,
  );
  expect(world).toBeDefined();
  if (world === undefined) throw new Error("extension isolated world absent");
  const evaluate = async (expression: string) =>
    cdp.send("Runtime.evaluate", {
      contextId: world.id,
      expression,
      returnByValue: true,
    });
  await evaluate(`globalThis.__w13HashBarrier = { original: SubtleCrypto.prototype.digest, armed: true, entered: false };
    SubtleCrypto.prototype.digest = async function(algorithm, data) {
      const gate = globalThis.__w13HashBarrier;
      if (gate.armed && data.byteLength > 4096) {
        gate.armed = false; gate.entered = true;
        await new Promise(resolve => { gate.release = resolve; });
      }
      return gate.original.call(this, algorithm, data);
    };`);
  const pending = resolve(harness, choice);
  try {
    let entered = false;
    for (let probe = 0; probe < 64; probe += 1) {
      const result = await evaluate("globalThis.__w13HashBarrier.entered");
      if (result.result.value === true) {
        entered = true;
        break;
      }
    }
    expect(entered).toBe(true);
    const during = await dynState(harness, top.frame_context.frame_id);
    expect(during.scanner_work?.descriptor_builds_started).toBeGreaterThan(
      during.scanner_work?.descriptors_built ?? 0,
    );
    await harness.page.evaluate(() => {
      const duplicate = document.createElement("select");
      duplicate.id = "duplicate-choice";
      duplicate.name = "firstName";
      duplicate.required = true;
      const label = document.createElement("label");
      label.htmlFor = duplicate.id;
      label.textContent = "First name";
      document.querySelector("form")?.append(label, duplicate);
    });
    await evaluate("globalThis.__w13HashBarrier.release()");
    expect((await pending).status).toBe("UNRESOLVED");
    expect(await resolve(harness, choice)).toEqual({
      status: "AMBIGUOUS",
      candidate_count: 2,
    });
  } finally {
    await evaluate(
      "globalThis.__w13HashBarrier.release?.(); SubtleCrypto.prototype.digest = globalThis.__w13HashBarrier.original; delete globalThis.__w13HashBarrier;",
    );
    await cdp.detach();
  }
  expect(
    (await dynState(harness, top.frame_context.frame_id)).actions_executed,
  ).toBe(0);
});
