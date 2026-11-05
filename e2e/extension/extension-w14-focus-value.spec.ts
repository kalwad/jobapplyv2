/** Independent actual-MV3 undo current-value preservation probes. */
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
  runtimeMessage,
} from "./support/research-harness.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";
import {
  buildUndoTabRequest,
  parseUndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
import {
  firstDriverOutcome,
  recordIndependentEvidence as record,
} from "./support/independent-w14-evidence.ts";

const controls = [
  {
    type: "text",
    label: "First name",
    concept: "FIRST_NAME",
    prior: "Prior",
    intended: "Synthetic",
    newer: "Newer user edit",
  },
  {
    type: "date",
    label: "Earliest start date",
    concept: "EARLIEST_START_DATE",
    prior: "2020-01-01",
    intended: "2021-02-03",
    newer: "2022-03-04",
  },
] as const;

for (const control of controls) {
  for (const operation of ["EXECUTE", "UNDO"] as const) {
    for (const drift of ["unchanged", "focus-handler"] as const) {
      test(`independent ${operation} ${control.type} ${drift} preserves current value`, async ({
        extensionContext,
        extensionId,
        serviceWorker,
      }, info) => {
        test.setTimeout(45_000);
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
        let pending: Promise<unknown> | undefined;
        try {
          await setFixture(
            h,
            `<form data-japp-application-root="true"><label for="target">${control.label}</label><input id="target" name="${control.concept}" type="${control.type}" aria-invalid="false" value="${control.prior}" required></form>`,
          );
          await h.page.evaluate(() => {
            const state = { input: 0, change: 0, focus: 0, blur: 0 };
            (window as unknown as Record<string, unknown>).__undoEventMeter =
              state;
            const input = document.querySelector("input");
            if (input === null) throw new Error("input absent");
            for (const name of ["input", "change", "focus", "blur"] as const)
              input.addEventListener(name, () => {
                state[name] += 1;
              });
          });
          const top = foundTopFrame(await scanFrames(h));
          const field = descriptorByLabel(top.descriptors, control.label);
          const seed = `independent-value-race-${operation}-${control.type}-${drift}`;
          const approval = await resolveFieldDecision({
            descriptor: field,
            records: buildApprovedRecordSet([
              {
                recordId: await stableSemanticId("record", seed),
                concept: control.concept,
                policy: "FILL_FROM_EXPLICIT_RECORD",
                confirmation: { state: "MISSING" },
                valueConfidence: 1,
              },
            ]),
            correlationId: await stableSemanticId("cor", seed),
          });
          if (
            approval.status !== "RESOLVED" ||
            approval.resolution.decision.final_decision !== "FILL"
          )
            throw new Error("actual W09 did not authorize fixture");
          const intended =
            control.type === "date"
              ? { kind: "DATE" as const, iso_date: control.intended }
              : { kind: "TEXT" as const, text: control.intended };
          const tx = await buildTransaction(
            field,
            intended,
            approval.resolution.decision,
            seed,
          );
          const initialExecution =
            operation === "UNDO" ? await dynExecute(h, [tx]) : null;
          if (initialExecution !== null) {
            expect(firstDriverOutcome(initialExecution)).toBe("VERIFIED");
            expect(await h.page.locator("#target").inputValue()).toBe(
              control.intended,
            );
          }
          const beforeNative = await witness.snapshot();
          const beforeEvents = await h.page.evaluate(
            () =>
              (window as unknown as Record<string, unknown>).__undoEventMeter,
          );
          if (drift === "focus-handler") {
            await h.page.evaluate((newer) => {
              const input = document.querySelector("input");
              if (input === null) throw new Error("input absent");
              input.addEventListener(
                "focus",
                () => {
                  const before = input.value;
                  const observer = new MutationObserver(() => undefined);
                  observer.observe(document, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    characterData: true,
                  });
                  input.value = newer;
                  const mutationRecords = observer.takeRecords().length;
                  observer.disconnect();
                  (window as unknown as Record<string, unknown>).__undoDrift = {
                    before,
                    after: input.value,
                    mutationRecords,
                    source: "page-world synchronous focus handler",
                  };
                },
                { once: true },
              );
            }, control.newer);
          }
          pending =
            operation === "EXECUTE"
              ? dynExecute(h, [tx])
              : runtimeMessage(
                  h.controller,
                  buildUndoTabRequest(seed, h.tabId, {
                    transaction_id: tx.transaction_id,
                    address: tx.address,
                    settle: { budget_ms: 75 },
                  }),
                );
          const completed = await pending;
          pending = undefined;
          const physical = await h.page.evaluate(() => ({
            value: document.querySelector("input")?.value,
            drift:
              (window as unknown as Record<string, unknown>).__undoDrift ??
              null,
            events: (window as unknown as Record<string, unknown>)
              .__undoEventMeter,
          }));
          const afterNative = await witness.snapshot();
          await record(info, seed, {
            control,
            operation,
            drift,
            field,
            tx,
            initialExecution,
            completed,
            physical,
            beforeEvents,
            beforeNative,
            afterNative,
            browserVersion: extensionContext.browser()?.version(),
            serviceWorkerUrl: serviceWorker.url(),
          });
          if (operation === "UNDO") {
            const undo = parseUndoTabResult(completed);
            expect(undo?.outcome.status).toBe("COMPLETED");
            if (undo?.outcome.status !== "COMPLETED")
              throw new Error("undo response absent");
            if (drift === "unchanged") {
              expect(undo.outcome.result.outcome).toBe("VERIFIED");
              expect(physical.value).toBe(control.prior);
              expect(
                afterNative.native_mutation_count -
                  beforeNative.native_mutation_count,
              ).toBe(1);
            } else {
              expect(physical.drift).toMatchObject({
                before: control.intended,
                after: control.newer,
                mutationRecords: 0,
              });
              expect
                .soft(physical.value, "undo must preserve the newer edit")
                .toBe(control.newer);
              expect
                .soft(
                  afterNative.native_mutation_count -
                    beforeNative.native_mutation_count,
                  "undo must not write over the newer edit",
                )
                .toBe(0);
              expect.soft(undo.outcome.result.outcome).not.toBe("VERIFIED");
            }
          } else {
            const execution = completed as Awaited<
              ReturnType<typeof dynExecute>
            >;
            const outcome = firstDriverOutcome(execution);
            if (drift === "unchanged") {
              expect(outcome).toBe("VERIFIED");
              expect(physical.value).toBe(control.intended);
              expect(
                afterNative.native_mutation_count -
                  beforeNative.native_mutation_count,
              ).toBe(1);
              expect(physical.events).toMatchObject({ input: 1, change: 1 });
            } else {
              expect(physical.drift).toMatchObject({
                before: control.prior,
                after: control.newer,
                mutationRecords: 0,
              });
              expect
                .soft(
                  physical.value,
                  "execute must preserve the newer focus edit",
                )
                .toBe(control.newer);
              expect
                .soft(
                  afterNative.native_mutation_count -
                    beforeNative.native_mutation_count,
                  "execute must not overwrite or recover over the newer edit",
                )
                .toBe(0);
              expect
                .soft(physical.events)
                .toMatchObject({ input: 0, change: 0 });
              expect.soft(outcome).not.toBe("VERIFIED");
              const item = execution.items[0];
              expect
                .soft(
                  item !== undefined &&
                    "undo_available" in item &&
                    item.undo_available,
                )
                .toBe(false);
            }
          }
        } finally {
          await pending?.catch(() => undefined);
          await witness.dispose();
          await h.page.close();
          await h.controller.close();
        }
      });
    }
  }
}
