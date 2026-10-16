// W13 development-only cross-W benchmark regressions. No gate authority.
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  buildTransaction,
  fillDecision,
  dynExecute,
  dynReconcile,
  dynStart,
  waitForDrain,
  reconciled,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";

test("W13 J: overlapping equivalent requests perform exactly one physical fill", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/generic/basic",
  );
  await setFixture(
    harness,
    `<form data-japp-application-root="true">
    <label for="first">First name</label><input id="first" name="firstName">
  </form>`,
  );
  await harness.page.evaluate(() => {
    document.documentElement.dataset.physicalFills = "0";
    document.querySelector("input")?.addEventListener("input", () => {
      document.documentElement.dataset.physicalFills = String(
        Number(document.documentElement.dataset.physicalFills) + 1,
      );
    });
  });
  const top = foundTopFrame(await scanFrames(harness));
  const transaction = await approvedTransaction(
    descriptorByLabel(top.descriptors, "First name"),
    "w13-concurrent",
    { kind: "TEXT", text: "Synthetic W13" },
  );
  const outcomes = await Promise.all([
    dynExecute(harness, [transaction]),
    dynExecute(harness, [{ ...transaction }]),
  ]);
  expect(outcomes).toHaveLength(2);
  expect(
    await harness.page.locator("html").getAttribute("data-physical-fills"),
  ).toBe("1");
  await expect(harness.page.locator("#first")).toHaveValue("Synthetic W13");
});

test("W13 L: total scan and re-resolution scaling includes work outside W11", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(120_000);
  const rows = [];
  const sampleCount = Number(process.env.JAPP_W13_PERFORMANCE_SAMPLES ?? "1");
  expect([1, 20]).toContain(sampleCount);
  for (const count of [
    8,
    32,
    ...Array.from({ length: sampleCount }, () => 128),
  ]) {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    await setFixture(
      harness,
      `<form data-japp-application-root="true">${Array.from(
        { length: count },
        (_, i) =>
          `<section aria-label="Section ${String(i)}"><label for="first${String(i)}">First name</label><input id="first${String(i)}" name="first${String(i)}" required></section>`,
      ).join("")}</form>`,
    );
    await harness.page.evaluate(() => {
      document.documentElement.dataset.physicalFills = "0";
      document.querySelector("form")?.addEventListener("input", () => {
        document.documentElement.dataset.physicalFills = String(
          Number(document.documentElement.dataset.physicalFills) + 1,
        );
      });
    });
    const cdp = await extensionContext.newCDPSession(harness.page);
    const browserVersion = await cdp.send("Browser.getVersion");
    await cdp.send("Performance.enable");
    const metrics = async () => {
      const response = await cdp.send("Performance.getMetrics");
      const metric = (name: string) => {
        const value = response.metrics.find(
          (item) => item.name === name,
        )?.value;
        if (value === undefined)
          throw new Error(`CDP metric unavailable: ${name}`);
        return value;
      };
      return {
        task_duration_s: metric("TaskDuration"),
        heap_used_bytes: metric("JSHeapUsedSize"),
      };
    };
    const before = await metrics();
    const started = performance.now();
    const top = foundTopFrame(await scanFrames(harness));
    expect(top.descriptors).toHaveLength(count);
    const transactions = [];
    for (const [i, descriptor] of top.descriptors.entries()) {
      const transaction = await approvedTransaction(
        descriptor,
        `w13-scaling-${String(count)}-${String(i)}`,
        { kind: "TEXT", text: "Synthetic W13" },
      );
      // Minimum accepted settle budget isolates a LOWER BOUND on scanning
      // cost. Final fresh reconciliation still checks every persisted value.
      transactions.push({ ...transaction, settle: { budget_ms: 0 } });
    }
    for (let i = 0; i < transactions.length; i += 32) {
      const outcome = await dynExecute(harness, transactions.slice(i, i + 32));
      for (const item of outcome.items) {
        expect(item.status).toBe("EXECUTED");
        if (item.status === "EXECUTED") {
          expect(item.result.outcome).toBe("VERIFIED");
        }
      }
    }
    const outcome = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    );
    const elapsed = performance.now() - started;
    const after = await metrics();
    expect(outcome.inventory.counts.verified_filled).toBe(count);
    const work = outcome.snapshot.scanner_work;
    expect(work).toBeDefined();
    if (work === undefined) throw new Error("total scanner work missing");
    expect(work.reresolution_calls).toBeGreaterThanOrEqual(4 * count);
    // Complete identity capture is shared only while observer revision and
    // context remain current. Four live target resolutions still run/control.
    expect(work.index_rebuilds).toBe(1);
    expect(work.index_hits).toBeGreaterThanOrEqual(4 * count - 1);
    expect(work.identity_pairs_examined).toBe(count);
    expect(work.candidate_enumerations).toBeLessThanOrEqual(3);
    expect(work.candidates_examined).toBeLessThanOrEqual(3 * count);
    expect(work.descriptors_built).toBe(6 * count);
    const physicalActions = Number(
      await harness.page.locator("html").getAttribute("data-physical-fills"),
    );
    expect(physicalActions).toBe(count);
    expect(outcome.snapshot.actions_executed).toBe(count);
    rows.push({
      control_count: count,
      actions_attempted: outcome.snapshot.actions_executed,
      physical_actions_count: physicalActions,
      total_wall_clock_ms: elapsed,
      scanner_work: work,
      w11_scan_duration_ms: outcome.snapshot.total_scan_duration_ms,
      w11_root_scans: outcome.snapshot.root_rescans,
      w11_subtree_scans: outcome.snapshot.affected_subtree_scans,
      cpu_source: "CHROMIUM_CDP_PERFORMANCE_TASK_DURATION_MAIN_PAGE",
      task_duration_delta_s: after.task_duration_s - before.task_duration_s,
      heap_source: "CHROMIUM_CDP_PERFORMANCE_JS_HEAP_USED_SIZE_MAIN_PAGE",
      heap_before_bytes: before.heap_used_bytes,
      heap_after_bytes: after.heap_used_bytes,
      settle_budget_ms: 0,
      evidence_scope: "LOWER_BOUND_NO_ASYNC_RERENDER_DELAY",
      browser_product: browserVersion.product,
      browser_revision: browserVersion.revision,
    });
    await cdp.detach();
    await harness.page.close();
    await harness.controller.close();
  }
  const samples = rows
    .filter((row) => row.control_count === 128)
    .map((row) => row.total_wall_clock_ms)
    .sort((a, b) => a - b);
  const p95 = samples[Math.ceil(0.95 * samples.length) - 1];
  // Retain all raw observations even when the target assertion fails. This
  // reporting occurs after every timed sample; it cannot change the budget.
  console.log(
    `W13_SCALING ${JSON.stringify({ labels: ["DEVELOPMENT", "HARNESS_VALIDATION", "NOT_GATE_A_FINAL_EVIDENCE"], rows })}`,
  );
  await testInfo.attach("w13-total-scan-scaling", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });
  if (sampleCount === 20) {
    expect(process.platform).toBe("darwin");
    expect(p95).toBeLessThanOrEqual(1500);
  }
  console.log(
    `W13_TARGET_P95 ${JSON.stringify({ samples: samples.length, p95_ms: p95, threshold_ms: 1500, settle_budget_ms: 0, scope: "TARGET_MACHINE_LOWER_BOUND_HARNESS_VALIDATION" })}`,
  );
});

test("W13 J: overlapping delayed repeater operations perform one physical click", async ({
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
    `<form data-japp-application-root="true">
    <section data-japp-repeater="work">
      <label for="repeat">First name</label>
      <input id="repeat" data-japp-repeater-controller="true">
      <button type="button" data-japp-repeater-action="ADD">Add employment</button>
    </section>
  </form>`,
  );
  await harness.page.evaluate(() => {
    document.documentElement.dataset.physicalClicks = "0";
    document.querySelector("button")?.addEventListener("click", () => {
      document.documentElement.dataset.physicalClicks = String(
        Number(document.documentElement.dataset.physicalClicks) + 1,
      );
      setTimeout(() => {
        const item = document.createElement("div");
        item.dataset.jappRepeaterItem = "true";
        item.dataset.jappItemLabel = "Synthetic employment";
        document.querySelector("section")?.append(item);
      }, 30);
    });
  });
  const top = foundTopFrame(await scanFrames(harness));
  const descriptor = descriptorByLabel(top.descriptors, "First name");
  const transaction = await buildTransaction(
    descriptor,
    { kind: "REPEATER_ADD", item_label: "Synthetic employment" },
    await fillDecision(descriptor, "w13-repeater-overlap"),
    "w13-repeater-overlap",
  );
  const outcomes = await Promise.all([
    dynExecute(harness, [transaction]),
    dynExecute(harness, [{ ...transaction }]),
  ]);
  expect(outcomes).toHaveLength(2);
  expect(
    await harness.page.locator("html").getAttribute("data-physical-clicks"),
  ).toBe("1");
});

test("W13 K: required control beyond capacity cannot receive a complete readiness proof", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/generic/basic",
  );
  const controls = Array.from(
    { length: 513 },
    (_, index) =>
      `<label for="field${String(index)}">Field ${String(index)}</label><input id="field${String(index)}" name="field${String(index)}" ${index === 512 ? "required" : ""}>`,
  ).join("");
  await setFixture(
    harness,
    `<form data-japp-application-root="true">${controls}</form>`,
  );
  const frames = await scanFrames(harness);
  const top = frames.find((frame) => frame.frame_context.is_top_frame);
  expect(top).toBeDefined();
  if (top === undefined) throw new Error("top frame unavailable");
  expect(top.root_status).toBe("CAPACITY_EXCEEDED");
  expect(top.descriptors).toHaveLength(0);
  const outcome = await dynReconcile(harness, top.frame_context.frame_id);
  expect(outcome.status).toBe("CAPACITY_EXCEEDED");
  expect("inventory" in outcome).toBe(false);
});

test("W13 K: observation beginning over capacity requires a complete recovery scan", async ({
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
  const controls = Array.from(
    { length: 513 },
    (_, index) =>
      `<section aria-label="Section ${String(index)}"><label for="field${String(index)}">Field ${String(index)}</label><input id="field${String(index)}" name="field${String(index)}" ${index === 512 ? "required" : ""}></section>`,
  ).join("");
  await setFixture(
    harness,
    `<form data-japp-application-root="true"><div id="slot">${controls}</div></form>`,
  );
  const top = (await scanFrames(harness)).find(
    (frame) => frame.frame_context.is_top_frame,
  );
  if (top === undefined) throw new Error("top frame unavailable");
  expect(top.root_status).toBe("CAPACITY_EXCEEDED");
  const frameId = top.frame_context.frame_id;
  expect((await dynStart(harness, frameId)).status).toBe("STARTED");
  await harness.page.evaluate(() =>
    document.getElementById("field0")?.remove(),
  );
  await waitForDrain(harness, frameId, 1);
  const outcome = reconciled(await dynReconcile(harness, frameId));
  expect(outcome.inventory.counts.total).toBe(512);
  expect(outcome.inventory.counts.required_unresolved).toBe(1);
  expect(outcome.inventory.readiness).toBe("NOT_READY");
  // A capacity overflow observed only in a subtree batch must also latch.
  await harness.page.evaluate(() => {
    const extra = document.createElement("input");
    extra.id = "transient-extra";
    document.getElementById("field1")?.closest("section")?.append(extra);
  });
  const overCapacity = await waitForDrain(
    harness,
    frameId,
    outcome.snapshot.batches_processed + 1,
  );
  expect(overCapacity.inventory_size).toBe(0);
  await harness.page.evaluate(() =>
    document.getElementById("transient-extra")?.remove(),
  );
  await waitForDrain(harness, frameId, overCapacity.batches_processed + 1);
  const recovered = reconciled(await dynReconcile(harness, frameId));
  expect(recovered.inventory.counts.total).toBe(512);
  expect(recovered.inventory.counts.required_unresolved).toBe(1);
  expect(recovered.inventory.readiness).toBe("NOT_READY");
});
