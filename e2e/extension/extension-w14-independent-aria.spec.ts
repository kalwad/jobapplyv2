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
} from "./support/research-harness.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";
import {
  firstDriverOutcome,
  recordIndependentEvidence as record,
} from "./support/independent-w14-evidence.ts";

test("independent opaque ARIA prompt held W09 approval refuses relabelled option", async ({
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
      '<form data-japp-application-root="true"><div id="mode" role="combobox" aria-label="Work mode" aria-controls="options" aria-expanded="false" aria-invalid="false" tabindex="0">Choose</div><div id="options" role="listbox" style="display:none"><div id="remote" role="option" data-value="17" aria-selected="false"><span id="remote-label">Remote</span></div><div id="hybrid" role="option" data-value="18" aria-selected="false">Hybrid</div></div></form>',
    );
    await h.page.evaluate(() => {
      const host = document.querySelector("#mode");
      const list = document.querySelector<HTMLElement>("#options");
      if (host === null || list === null)
        throw new Error("ARIA fixture missing");
      host.addEventListener("click", () => {
        host.setAttribute("aria-expanded", "true");
        list.style.display = "block";
      });
      for (const option of document.querySelectorAll<HTMLElement>(
        "[role=option]",
      ))
        option.addEventListener("click", () => {
          for (const o of document.querySelectorAll("[role=option]"))
            o.setAttribute("aria-selected", "false");
          option.setAttribute("aria-selected", "true");
          host.setAttribute("aria-activedescendant", option.id);
          host.setAttribute("aria-expanded", "false");
          list.style.display = "none";
        });
    });
    const top = foundTopFrame(await scanFrames(h));
    const before = descriptorByLabel(top.descriptors, "Work mode");
    const records = buildApprovedRecordSet([
      {
        recordId: await stableSemanticId("record", "independent-aria"),
        concept: "WORK_MODE_PREFERENCE",
        valueToken: "REMOTE",
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]);
    const approval = await resolveFieldDecision({
      descriptor: before,
      records,
      correlationId: await stableSemanticId("cor", "aria-held"),
    });
    if (
      approval.status !== "RESOLVED" ||
      approval.resolution.optionResolution?.status !== "RESOLVED"
    )
      throw new Error("ARIA approval prerequisite");
    expect(approval.resolution.decision.final_decision).toBe("FILL");
    const tx = await buildTransaction(
      before,
      {
        kind: "OPTION",
        value_digest: approval.resolution.optionResolution.valueDigest,
      },
      approval.resolution.decision,
      "aria-held",
    );
    await h.page
      .locator("#remote-label")
      .evaluate((node) => (node.textContent = "Onsite"));
    const changed = descriptorByLabel(
      foundTopFrame(await scanFrames(h)).descriptors,
      "Work mode",
    );
    const freshPolicy = await resolveFieldDecision({
      descriptor: changed,
      records,
      correlationId: await stableSemanticId("cor", "aria-fresh"),
    });
    expect(freshPolicy.status).toBe("RESOLVED");
    if (freshPolicy.status === "RESOLVED")
      expect(freshPolicy.resolution.decision.final_decision).not.toBe("FILL");
    const execution = await dynExecute(h, [tx]);
    const inventory = await dynReconcile(h, top.frame_context.frame_id);
    const physical = await h.page.evaluate(() => {
      const host = document.querySelector("#mode");
      if (host === null) throw new Error("ARIA host missing");
      return {
        activeId: host.getAttribute("aria-activedescendant"),
        selected: [
          ...document.querySelectorAll<HTMLElement>("[aria-selected=true]"),
        ].map((o) => ({
          id: o.id,
          value: o.getAttribute("data-value"),
          label: o.textContent,
        })),
      };
    });
    const native = await witness.snapshot();
    await record(info, "aria-before-write", {
      before,
      approval,
      tx,
      changed,
      freshPolicy,
      execution,
      inventory,
      physical,
      native,
      browserVersion: extensionContext.browser()?.version(),
    });
    expect(native.native_mutation_count).toBe(0);
    expect(firstDriverOutcome(execution)).not.toBe("VERIFIED");
  } finally {
    await witness.dispose();
    await h.page.close();
    await h.controller.close();
  }
});
