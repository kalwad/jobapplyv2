/** Actual selected-option ambiguity after a verified transaction. */
import { test, expect } from "./support/extension-test.ts";
import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  buildTransaction,
  dynExecute,
  dynReconcile,
  reconciled,
} from "./support/research-harness.ts";
import {
  countryPolicy,
  firstDriverOutcome,
  nativeSelectPhysical,
  recordIndependentEvidence,
} from "./support/independent-w14-evidence.ts";

test("W14: a duplicate selected raw value cannot retain verified option meaning", async ({
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
      const select = document.querySelector("select");
      if (select === null) throw new Error("native select missing");
      const meter = { input: 0, change: 0 };
      (
        window as unknown as { independentMeter: typeof meter }
      ).independentMeter = meter;
      select.addEventListener("input", () => {
        meter.input++;
      });
      select.addEventListener("change", () => {
        meter.change++;
      });
    });
    const top = foundTopFrame(await scanFrames(h));
    const field = descriptorByLabel(top.descriptors, "Country");
    const approval = await countryPolicy(field, "post-verified-duplicate");
    if (
      approval.status !== "RESOLVED" ||
      approval.resolution.optionResolution?.status !== "RESOLVED"
    )
      throw new Error("actual W09 option approval missing");
    expect(approval.resolution.decision.final_decision).toBe("FILL");
    const tx = await buildTransaction(
      field,
      {
        kind: "OPTION",
        value_digest: approval.resolution.optionResolution.valueDigest,
      },
      approval.resolution.decision,
      "post-verified-duplicate",
    );
    const execution = await dynExecute(h, [tx]);
    expect(firstDriverOutcome(execution)).toBe("VERIFIED");
    expect(
      reconciled(await dynReconcile(h, top.frame_context.frame_id)).inventory
        .readiness,
    ).toBe("READY");
    const prior = await nativeSelectPhysical(h);
    const priorNative = await witness.snapshot();
    await h.page.evaluate(() => {
      const select = document.querySelector("select");
      if (select === null) throw new Error("native select missing");
      select.add(new Option("Canada", "US"));
      select.selectedIndex = select.options.length - 1;
    });
    const current = await dynReconcile(h, top.frame_context.frame_id);
    const after = await nativeSelectPhysical(h);
    const native = await witness.snapshot();
    await recordIndependentEvidence(info, "selected-duplicate", {
      field,
      approval,
      tx,
      execution,
      prior,
      priorNative,
      current,
      after,
      native,
    });
    expect(after.value).toBe("US");
    expect(after.label).toBe("Canada");
    expect(after.meter).toEqual(prior.meter);
    expect(native.native_mutation_count).toBe(
      priorNative.native_mutation_count,
    );
    expect(reconciled(current).inventory.readiness).toBe("NOT_READY");
    expect(reconciled(current).inventory.counts.required_unresolved).toBe(1);
  } finally {
    await witness.dispose();
    await h.page.close();
    await h.controller.close();
  }
});
