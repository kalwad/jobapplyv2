/** A legitimate authorized first write must not validate later ownership. */
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  dynExecute,
  dynReconcile,
  reconciled,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";

for (const ownershipTree of ["document", "shadow"] as const) {
  test(`W14 peer: ${ownershipTree} input-handler ownership drift refuses verification and undo authority`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }, testInfo) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await setFixture(
        harness,
        '<form data-japp-application-root="true"><div id="owner-host"></div></form>',
      );
      await harness.page.evaluate((tree) => {
        const host = document.getElementById("owner-host");
        if (host === null) throw new Error("owner host absent");
        const root =
          tree === "shadow" ? host.attachShadow({ mode: "open" }) : host;
        root.innerHTML =
          '<span id="ownership">Your contact</span><label for="first">First name</label><input id="first" name="first" aria-describedby="ownership" required>';
        const input = root.querySelector("input"),
          description = root.querySelector("#ownership");
        if (input === null || description === null)
          throw new Error("fixture missing");
        const meter = { input: 0, change: 0 };
        (
          window as unknown as { peerPostInputMeter: typeof meter }
        ).peerPostInputMeter = meter;
        input.addEventListener("input", () => {
          meter.input++;
          description.textContent = "Employer";
        });
        input.addEventListener("change", () => {
          meter.change++;
        });
      }, ownershipTree);
      const top = foundTopFrame(await scanFrames(harness));
      const before = descriptorByLabel(top.descriptors, "First name");
      expect(before.description?.normalized_text).toBe("Your contact");
      const transaction = await approvedTransaction(
        before,
        `peer-post-input-${ownershipTree}`,
        { kind: "TEXT", text: "Synthetic" },
      );
      expect(transaction.decision.final_decision).toBe("FILL");
      const execution = await dynExecute(harness, [transaction]);
      const changed = descriptorByLabel(
        foundTopFrame(await scanFrames(harness)).descriptors,
        "First name",
      );
      const inventory = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              peerPostInputMeter: { input: number; change: number };
            }
          ).peerPostInputMeter,
      );
      const value = await harness.page.locator("#first").inputValue();
      await testInfo.attach(`w14-post-input-ownership-${ownershipTree}.json`, {
        body: JSON.stringify(
          { before, transaction, execution, changed, inventory, meter, value },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(meter).toEqual({ input: 1, change: 1 });
      expect(value).toBe("Synthetic");
      expect(changed.description?.normalized_text).toBe("Employer");
      expect(execution.items[0]?.status).toBe("EXECUTED");
      if (execution.items[0]?.status === "EXECUTED") {
        expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
        expect(execution.items[0].undo_available).toBe(false);
      }
      expect(inventory.inventory.readiness).toBe("NOT_READY");
      expect(inventory.inventory.counts.required_unresolved).toBe(1);
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}
