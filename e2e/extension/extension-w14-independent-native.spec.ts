import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  dynExecute,
  buildTransaction,
  dynReconcile,
  reconciled,
  runtimeMessage,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";
import {
  countryPolicy,
  firstDriverOutcome,
  nativeSelectPhysical as physical,
  recordIndependentEvidence as record,
  type IndependentEventMeter,
} from "./support/independent-w14-evidence.ts";
import {
  buildUndoTabRequest,
  parseUndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";

for (const stage of ["before-write", "after-verified"] as const) {
  for (const variant of ["opaque-canada", "us-placeholder"] as const) {
    test(`independent option ${stage} ${variant}`, async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }, info) => {
      const h = await openHarness(
        extensionContext,
        extensionId,
        serviceWorker,
        "/native/",
      );
      const witness = await installW14NativeWitness(
        extensionContext,
        h.page,
        extensionId,
      );
      try {
        const approvedValue = variant === "opaque-canada" ? "17" : "US";
        await setFixture(
          h,
          `<form data-japp-application-root="true"><label for="country">Country</label><select id="country" required><option value="">Choose</option><option value="${approvedValue}">United States</option><option value="18">Canada</option></select></form>`,
        );
        await h.page.evaluate(() => {
          const s = document.querySelector("select");
          if (s === null) throw new Error("native select missing");
          const meter = { input: 0, change: 0 };
          (
            window as unknown as { independentMeter: IndependentEventMeter }
          ).independentMeter = meter;
          s.addEventListener("input", () => meter.input++);
          s.addEventListener("change", () => meter.change++);
        });
        const top = foundTopFrame(await scanFrames(h));
        const before = descriptorByLabel(top.descriptors, "Country");
        const approval = await countryPolicy(
          before,
          `independent-${stage}-${variant}`,
          variant === "opaque-canada" ? "United States" : "US",
        );
        expect(approval.status).toBe("RESOLVED");
        if (
          approval.status !== "RESOLVED" ||
          approval.resolution.optionResolution?.status !== "RESOLVED"
        )
          throw new Error("no approval");
        expect(approval.resolution.decision.final_decision).toBe("FILL");
        const tx = await buildTransaction(
          before,
          {
            kind: "OPTION",
            value_digest: approval.resolution.optionResolution.valueDigest,
          },
          approval.resolution.decision,
          `independent-${stage}-${variant}`,
        );
        let initial: Awaited<ReturnType<typeof dynExecute>> | null = null;
        if (stage === "after-verified") {
          initial = await dynExecute(h, [tx]);
          expect(firstDriverOutcome(initial)).toBe("VERIFIED");
        }
        const priorPhysical = await physical(h);
        const priorNative = await witness.snapshot();
        await h.page.evaluate(
          ({ approvedValue, variant }) => {
            const select = document.querySelector("select");
            if (select === null) throw new Error("native select missing");
            const o = [...select.options].find(
              (option) => option.value === approvedValue,
            );
            if (o === undefined) throw new Error("approved option missing");
            o.textContent =
              variant === "opaque-canada" ? "Canada" : "Select a country";
          },
          { approvedValue, variant },
        );
        const changed = descriptorByLabel(
          foundTopFrame(await scanFrames(h)).descriptors,
          "Country",
        );
        const freshPolicy = await countryPolicy(
          changed,
          `independent-fresh-${stage}-${variant}`,
          variant === "opaque-canada" ? "United States" : "US",
        );
        expect(freshPolicy.status).toBe("RESOLVED");
        if (freshPolicy.status !== "RESOLVED")
          throw new Error("invalid fresh policy");
        expect(freshPolicy.resolution.decision.final_decision).not.toBe("FILL");
        const execution =
          stage === "before-write" ? await dynExecute(h, [tx]) : null;
        const inventory = await dynReconcile(h, top.frame_context.frame_id);
        const afterPhysical = await physical(h);
        await record(info, `${stage}-${variant}`, {
          before,
          approval,
          tx,
          initial,
          priorPhysical,
          priorNative,
          changed,
          freshPolicy,
          execution,
          inventory,
          afterPhysical,
          native: await witness.snapshot(),
          browserVersion: extensionContext.browser()?.version(),
        });
        if (stage === "before-write") {
          expect(afterPhysical.meter).toEqual(priorPhysical.meter);
          if (execution === null) throw new Error("execution missing");
          expect(firstDriverOutcome(execution)).not.toBe("VERIFIED");
        } else {
          expect(inventory.status).toBe("RECONCILED");
          expect(reconciled(inventory).inventory.readiness).toBe("NOT_READY");
        }
      } finally {
        await witness.dispose();
        await h.page.close();
        await h.controller.close();
      }
    });
  }
}

test("independent append unselected native option preserves evidence", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, info) => {
  const h = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  const witness = await installW14NativeWitness(
    extensionContext,
    h.page,
    extensionId,
  );
  try {
    await setFixture(
      h,
      '<form data-japp-application-root="true"><label for="country">Country</label><select id="country" required><option value="">Choose</option><option value="US">United States</option><option value="CA">Canada</option></select></form>',
    );
    await h.page.evaluate(() => {
      const s = document.querySelector("select");
      if (s === null) throw new Error("native select missing");
      const meter = { input: 0, change: 0 };
      (
        window as unknown as { independentMeter: IndependentEventMeter }
      ).independentMeter = meter;
      s.addEventListener("input", () => meter.input++);
      s.addEventListener("change", () => meter.change++);
    });
    const top = foundTopFrame(await scanFrames(h));
    const f = descriptorByLabel(top.descriptors, "Country");
    const p = await countryPolicy(f, "append-positive");
    if (
      p.status !== "RESOLVED" ||
      p.resolution.optionResolution?.status !== "RESOLVED"
    )
      throw new Error("approval");
    const tx = await buildTransaction(
      f,
      {
        kind: "OPTION",
        value_digest: p.resolution.optionResolution.valueDigest,
      },
      p.resolution.decision,
      "append-positive",
    );
    const execution = await dynExecute(h, [tx]);
    expect(firstDriverOutcome(execution)).toBe("VERIFIED");
    const before = await physical(h);
    await h.page.evaluate(() => {
      const select = document.querySelector("select");
      if (select === null) throw new Error("native select missing");
      select.add(new Option("Mexico", "MX"));
    });
    const inventory = await dynReconcile(h, top.frame_context.frame_id);
    const after = await physical(h);
    await record(info, "append-positive", {
      execution,
      before,
      inventory,
      after,
      native: await witness.snapshot(),
      browserVersion: extensionContext.browser()?.version(),
    });
    expect(reconciled(inventory).inventory.readiness).toBe("READY");
    expect(after.meter).toEqual(before.meter);
  } finally {
    await witness.dispose();
    await h.page.close();
    await h.controller.close();
  }
});

test("independent undo refuses ownership changed by its own input handler", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, info) => {
  const h = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  const witness = await installW14NativeWitness(
    extensionContext,
    h.page,
    extensionId,
  );
  try {
    await setFixture(
      h,
      '<form data-japp-application-root="true"><span id="ownership">Your contact</span><label for="first">First name</label><input id="first" name="first" aria-describedby="ownership" value="Prior" required></form>',
    );
    const top = foundTopFrame(await scanFrames(h));
    const f = descriptorByLabel(top.descriptors, "First name");
    const tx = await approvedTransaction(f, "independent-undo", {
      kind: "TEXT",
      text: "Synthetic",
    });
    const execution = await dynExecute(h, [tx]);
    expect(firstDriverOutcome(execution)).toBe("VERIFIED");
    await h.page.evaluate(() => {
      const input = document.querySelector("input");
      if (input === null) throw new Error("native input missing");
      const meter = { input: 0, change: 0 };
      (
        window as unknown as { independentMeter: IndependentEventMeter }
      ).independentMeter = meter;
      input.addEventListener("input", () => {
        meter.input++;
        const ownership = document.querySelector("#ownership");
        if (ownership === null)
          throw new Error("ownership description missing");
        ownership.textContent = "Employer";
      });
      input.addEventListener("change", () => meter.change++);
    });
    const undo = parseUndoTabResult(
      await runtimeMessage(
        h.controller,
        buildUndoTabRequest("independent-undo", h.tabId, {
          transaction_id: tx.transaction_id,
          address: tx.address,
          settle: { budget_ms: 75 },
        }),
      ),
    );
    const changed = descriptorByLabel(
      foundTopFrame(await scanFrames(h)).descriptors,
      "First name",
    );
    const freshTx = await approvedTransaction(
      changed,
      "independent-undo-current",
    ).catch((error: unknown) => ({ error: String(error) }));
    const physical = await h.page.evaluate(() => {
      const input = document.querySelector("input");
      const ownership = document.querySelector("#ownership");
      if (input === null || ownership === null)
        throw new Error("native input or ownership description missing");
      return {
        value: input.value,
        description: ownership.textContent,
        meter: (
          window as unknown as { independentMeter: IndependentEventMeter }
        ).independentMeter,
      };
    });
    await record(info, "undo-ownership", {
      before: f,
      tx,
      execution,
      undo,
      changed,
      freshTx,
      physical,
      native: await witness.snapshot(),
      browserVersion: extensionContext.browser()?.version(),
    });
    expect(physical.value).toBe("Prior");
    expect(physical.description).toBe("Employer");
    expect(undo?.outcome.status).toBe("COMPLETED");
    if (undo?.outcome.status === "COMPLETED")
      expect(undo.outcome.result.outcome).not.toBe("VERIFIED");
  } finally {
    await witness.dispose();
    await h.page.close();
    await h.controller.close();
  }
});
