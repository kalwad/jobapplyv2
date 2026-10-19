import { performance } from "node:perf_hooks";
import { test, expect } from "./support/extension-test.ts";
import {
  buildTransaction,
  dynExecute,
  dynReconcile,
  dynState,
  foundTopFrame,
  nextId,
  openHarness,
  reconciled,
  requireValue,
  runtimeMessage,
  scanFrames,
  setFixture,
} from "./support/research-harness.ts";
import {
  buildReresolveTabRequest,
  parseReresolveTabResult,
} from "../../apps/extension/src/scanner-protocol.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";

test("W14 topology: warm native128 identities retain bounded captures with unrelated host scaling", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(120_000);
  const rows = [];
  for (const unrelated of [0, 1024, 4096]) {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await setFixture(
        harness,
        '<form data-japp-application-root="true">' +
          Array.from(
            { length: 128 },
            (_, i) =>
              `<section aria-label="Section ${String(i)}"><label for="first${String(i)}">First name</label><input id="first${String(i)}" name="first${String(i)}" required></section>`,
          ).join("") +
          "</form><aside>" +
          Array.from({ length: unrelated }, () => "<div></div>").join("") +
          "</aside>",
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
      expect(top.descriptors).toHaveLength(128);
      const first = requireValue(top.descriptors[0], "first descriptor absent");
      const resolve = async () => {
        const parsed = parseReresolveTabResult(
          await runtimeMessage(
            harness.controller,
            buildReresolveTabRequest(
              nextId("topology-warm"),
              harness.tabId,
              first.address,
            ),
          ),
        );
        expect(
          requireValue(parsed, "invalid warm resolution").resolution.status,
        ).toBe("RESOLVED");
      };
      await resolve();
      const before = requireValue(
        (await dynState(harness, top.frame_context.frame_id)).scanner_work,
        "before work missing",
      );
      for (let i = 0; i < 32; i++) await resolve();
      const warmed = requireValue(
        (await dynState(harness, top.frame_context.frame_id)).scanner_work,
        "warm work missing",
      );
      expect(warmed.topology_full_captures).toBe(before.topology_full_captures);
      expect(warmed.index_rebuilds).toBe(before.index_rebuilds);
      const records = buildApprovedRecordSet([
        {
          recordId: await stableSemanticId("record", "topology-first-name"),
          concept: "FIRST_NAME",
          policy: "FILL_FROM_EXPLICIT_RECORD",
          confirmation: { state: "MISSING" },
          valueConfidence: 1,
        },
      ]);
      const transactions = [];
      const started = performance.now();
      for (const descriptor of top.descriptors) {
        const decision = await resolveFieldDecision({
          descriptor,
          records,
          correlationId: await stableSemanticId(
            "cor",
            nextId("topology-decision"),
          ),
        });
        expect(decision.status).toBe("RESOLVED");
        if (decision.status !== "RESOLVED") throw new Error("decision missing");
        expect(decision.resolution.decision.final_decision).toBe("FILL");
        transactions.push({
          ...(await buildTransaction(
            descriptor,
            { kind: "TEXT", text: "Synthetic W13" },
            decision.resolution.decision,
            nextId("topology-transaction"),
          )),
          settle: { budget_ms: 0 },
        });
      }
      for (let i = 0; i < transactions.length; i += 32) {
        const outcome = await dynExecute(
          harness,
          transactions.slice(i, i + 32),
        );
        for (const item of outcome.items) {
          expect(item.status).toBe("EXECUTED");
          if (item.status === "EXECUTED")
            expect(item.result.outcome).toBe("VERIFIED");
        }
      }
      const outcome = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      const elapsed = performance.now() - started;
      expect(outcome.inventory.counts.verified_filled).toBe(128);
      expect(outcome.snapshot.actions_executed).toBe(128);
      expect(
        Number(
          await harness.page
            .locator("html")
            .getAttribute("data-physical-fills"),
        ),
      ).toBe(128);
      const final = requireValue(
        outcome.snapshot.scanner_work,
        "final work missing",
      );
      expect(
        final.reresolution_calls - warmed.reresolution_calls,
      ).toBeGreaterThanOrEqual(512);
      expect(final.index_rebuilds).toBe(1);
      rows.push({
        unrelated_possible_hosts: unrelated,
        native_controls: 128,
        physical_fills: 128,
        fresh_resolutions: final.reresolution_calls - warmed.reresolution_calls,
        wall_ms: elapsed,
        settle_ms: 0,
        scope: "LOWER_BOUND_SYNTHETIC_TOPOLOGY_SCALING_NOT_GATE_A",
        warm_full_capture_delta:
          warmed.topology_full_captures - before.topology_full_captures,
        work: final,
      });
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  }
  console.log(`W14_TOPOLOGY_SCALING ${JSON.stringify(rows)}`);
  await testInfo.attach("w14-topology-scaling.json", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });
});
