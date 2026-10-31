/** Peer-authored option-only evidence drift regression. Actual W09 + MV3. */
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
} from "./support/research-harness.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";

test("W14 peer: appending an unselected native option preserves verified evidence without new writes", async ({
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
      '<form data-japp-application-root="true"><label for="country">Country</label><select id="country" aria-required="true" required><option value="">Choose</option><option value="US">United States</option><option value="CA">Canada</option></select></form>',
    );
    await harness.page.evaluate(() => {
      const country = document.getElementById("country");
      if (!(country instanceof HTMLSelectElement))
        throw new Error("country missing");
      const meter = { input: 0, change: 0 };
      (window as unknown as { peerOptionMeter: typeof meter }).peerOptionMeter =
        meter;
      country.addEventListener("input", () => {
        meter.input++;
      });
      country.addEventListener("change", () => {
        meter.change++;
      });
    });
    const top = foundTopFrame(await scanFrames(harness));
    const field = descriptorByLabel(top.descriptors, "Country");
    const decision = await resolveFieldDecision({
      descriptor: field,
      records: buildApprovedRecordSet([
        {
          recordId: await stableSemanticId("record", "peer-native-options"),
          concept: "ADDRESS_COUNTRY",
          valueToken: "US",
          policy: "FILL_FROM_EXPLICIT_RECORD",
          confirmation: { state: "MISSING" },
          valueConfidence: 1,
        },
      ]),
      correlationId: await stableSemanticId("cor", "peer-native-options"),
    });
    expect(decision.status).toBe("RESOLVED");
    if (
      decision.status !== "RESOLVED" ||
      decision.resolution.optionResolution?.status !== "RESOLVED"
    )
      throw new Error("country approval missing");
    expect(decision.resolution.decision.final_decision).toBe("FILL");
    const transaction = await buildTransaction(
      field,
      {
        kind: "OPTION",
        value_digest: decision.resolution.optionResolution.valueDigest,
      },
      decision.resolution.decision,
      "peer-native-options",
    );
    const execution = await dynExecute(harness, [transaction]);
    expect(execution.items[0]?.status).toBe("EXECUTED");
    if (execution.items[0]?.status === "EXECUTED")
      expect(execution.items[0].result.outcome).toBe("VERIFIED");
    expect(await harness.page.locator("#country").inputValue()).toBe("US");
    const baseline = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    );
    expect(baseline.inventory.readiness).toBe("READY");
    const beforeMeter = await harness.page.evaluate(() => ({
      ...(
        window as unknown as {
          peerOptionMeter: { input: number; change: number };
        }
      ).peerOptionMeter,
    }));
    await harness.page.evaluate(() => {
      const select = document.getElementById("country");
      if (!(select instanceof HTMLSelectElement))
        throw new Error("country missing");
      select.add(new Option("Mexico", "MX"));
    });
    const changedTop = foundTopFrame(await scanFrames(harness));
    const changedField = descriptorByLabel(changedTop.descriptors, "Country");
    expect(changedField.field_id).toBe(field.field_id);
    expect(changedField.address.option_fingerprint).not.toBe(
      field.address.option_fingerprint,
    );
    const after = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    );
    const afterMeter = await harness.page.evaluate(() => ({
      ...(
        window as unknown as {
          peerOptionMeter: { input: number; change: number };
        }
      ).peerOptionMeter,
    }));
    const value = await harness.page.locator("#country").inputValue();
    await testInfo.attach("w14-native-option-evidence-preservation.json", {
      body: JSON.stringify(
        {
          field,
          changedField,
          decision,
          execution,
          baseline,
          after,
          beforeMeter,
          afterMeter,
          value,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    expect(value).toBe("US");
    expect(afterMeter).toEqual(beforeMeter);
    expect(after.inventory.readiness).toBe("READY");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
