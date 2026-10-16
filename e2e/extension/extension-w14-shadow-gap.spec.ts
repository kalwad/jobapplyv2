/** W14 regression on the unchanged frozen W03 mounted open-shadow page.
 * Expected behavior is required-field reporting without an other-party fill.
 * A failed assertion preserves the actual missing-root evidence; it is not PASS.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  scanFrames,
  dynReconcile,
} from "./support/research-harness.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";

test("W14 W06 MAL-SHD-001: open-shadow other-party required field is reported and never filled", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/shadow/",
  );
  try {
    // Playwright's independent locator pierces the OPEN shadow root. The
    // candidate still receives no node reference, selector, or expected answer.
    const actual = await harness.page
      .locator("#shadow-contact-name")
      .evaluate((node) => ({
        id: node.id,
        required: (node as HTMLInputElement).required,
        value: (node as HTMLInputElement).value,
        open_root:
          node.getRootNode() instanceof ShadowRoot &&
          (node.getRootNode() as ShadowRoot).mode === "open",
        owner_label:
          (node as HTMLInputElement).labels?.[0]?.textContent.trim() ?? null,
      }));
    const frames = await scanFrames(harness);
    const top = frames.find((frame) => frame.frame_context.is_top_frame);
    const descriptor = top?.descriptors.find(
      (field) =>
        field.label.normalized_text === "Emergency contact name (required)",
    );
    const decision =
      descriptor === undefined
        ? null
        : await resolveFieldDecision({
            descriptor,
            records: buildApprovedRecordSet([
              {
                recordId: await stableSemanticId(
                  "record",
                  "w14-shadow-applicant-full-name",
                ),
                concept: "FULL_NAME",
                policy: "FILL_FROM_EXPLICIT_RECORD",
                confirmation: { state: "MISSING" },
                valueConfidence: 1,
              },
            ]),
            correlationId: await stableSemanticId(
              "cor",
              "w14-shadow-other-party-required",
            ),
          });
    const reconciliation =
      top === undefined
        ? null
        : await dynReconcile(harness, top.frame_context.frame_id);
    const evidence = {
      format_version: "W14_W06_SHADOW_REPORTING_REGRESSION_1",
      authority: "NONE",
      fixture_id: "MAL-SHD-001",
      expected: {
        required_observed: true,
        candidate_reports_required: true,
        applicant_fill_permitted: false,
      },
      actual,
      frames,
      decision,
      reconciliation,
      application_actions: 0,
      limitations: [
        "Mounted open-shadow fixture only; no closed-shadow claim; no product submit capability.",
      ],
    };
    const text = JSON.stringify(evidence, null, 2) + "\n";
    await testInfo.attach("w14-shadow-required-gap.json", {
      body: text,
      contentType: "application/json",
    });
    const directory = process.env.JAPP_W14_W06_ARTIFACT_DIRECTORY;
    if (directory !== undefined) {
      mkdirSync(resolve(directory), { recursive: true });
      writeFileSync(resolve(directory, "shadow-required-gap.json"), text);
    }
    // Correct product expectations remain assertions, rather than accepting
    // UNAVAILABLE/empty inventory as a successful protected-field abstention.
    expect(actual.open_root).toBe(true);
    expect(actual.required).toBe(true);
    expect(actual.value).toBe("");
    expect(top?.root_status).toBe("FOUND");
    expect(descriptor).toBeDefined();
    expect(descriptor?.required).toBe(true);
    expect(decision?.status).toBe("RESOLVED");
    if (decision?.status === "RESOLVED")
      expect(decision.resolution.decision.final_decision).not.toBe("FILL");
    expect(reconciliation?.status).toBe("RECONCILED");
    if (reconciliation?.status === "RECONCILED") {
      expect(
        reconciliation.inventory.counts.required_unresolved,
      ).toBeGreaterThanOrEqual(1);
      expect(reconciliation.inventory.readiness).toBe("NOT_READY");
    }
    expect(
      await harness.page.locator("#shadow-contact-name").inputValue(),
    ).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
