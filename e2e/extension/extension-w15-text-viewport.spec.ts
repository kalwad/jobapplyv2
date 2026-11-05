/** Native text and textarea focus preserve viewport and real events. */
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

const controls = [
  {
    type: "text",
    label: "First name",
    concept: "FIRST_NAME",
    prior: "Prior",
    intended: "Synthetic",
  },
  {
    type: "textarea",
    label: "Professional summary",
    concept: "PROFESSIONAL_SUMMARY",
    prior: "Prior multiline",
    intended: "Synthetic multiline",
  },
] as const;

for (const control of controls) {
  for (const operation of ["EXECUTE", "UNDO"] as const) {
    test(`W15 text viewport ${operation} ${control.type} preserves real focus`, async ({
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
      let pending: Promise<unknown> | undefined;
      try {
        await setFixture(
          h,
          `<form data-japp-application-root="true"><div style="height:2500px"></div><label for="target">${control.label}</label>${
            control.type === "textarea"
              ? `<textarea id="target" name="${control.concept}" aria-invalid="false" required>${control.prior}</textarea>`
              : `<input id="target" name="${control.concept}" type="text" aria-invalid="false" value="${control.prior}" required>`
          }</form>`,
        );
        const top = foundTopFrame(await scanFrames(h));
        const field = descriptorByLabel(top.descriptors, control.label);
        expect(field.control_kind).toBe(
          control.type === "textarea" ? "TEXTAREA" : "TEXT",
        );
        const seed = `w15-text-viewport-${control.type}-${operation}`;
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
        const intended = { kind: "TEXT" as const, text: control.intended };
        const tx = await buildTransaction(
          field,
          intended,
          approval.resolution.decision,
          seed,
        );
        if (operation === "UNDO") {
          const initial = await dynExecute(h, [tx]);
          expect(initial.items).toHaveLength(1);
          const item = initial.items[0];
          expect(item?.status).toBe("EXECUTED");
          if (item?.status !== "EXECUTED")
            throw new Error("initial execution absent");
          expect(item.result.outcome).toBe("VERIFIED");
          expect(item.undo_available).toBe(true);
        }
        const before = await h.page.evaluate(() => {
          const target = document.querySelector<
            HTMLInputElement | HTMLTextAreaElement
          >("input,textarea");
          if (target === null) throw new Error("target absent");
          const events = {
            focus: 0,
            blur: 0,
            input: 0,
            change: 0,
            active_at_focus: false,
            trusted_focus: false,
          };
          (window as unknown as Record<string, unknown>).__viewportFocusEvents =
            events;
          target.addEventListener("focus", (event) => {
            events.focus += 1;
            events.active_at_focus = document.activeElement === target;
            events.trusted_focus = event.isTrusted;
          });
          for (const name of ["blur", "input", "change"] as const)
            target.addEventListener(name, () => {
              events[name] += 1;
            });
          window.scrollTo(0, 400);
          return {
            viewport: { x: window.scrollX, y: window.scrollY },
            viewport_height: window.innerHeight,
            target_document_top:
              target.getBoundingClientRect().top + window.scrollY,
          };
        });
        expect(before.viewport).toEqual({ x: 0, y: 400 });
        expect(before.target_document_top).toBeGreaterThan(
          before.viewport.y + before.viewport_height,
        );
        const beforeNative = await witness.snapshot();
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
        const afterNative = await witness.snapshot();
        const after = await h.page.evaluate(() => ({
          value: document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            "input,textarea",
          )?.value,
          viewport: { x: window.scrollX, y: window.scrollY },
          events: (window as unknown as Record<string, unknown>)
            .__viewportFocusEvents,
        }));
        await info.attach("native-focus-viewport", {
          body: JSON.stringify(
            {
              control,
              operation,
              before,
              after,
              beforeNative,
              afterNative,
              completed,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        if (operation === "EXECUTE") {
          const outcome = completed as Awaited<ReturnType<typeof dynExecute>>;
          expect(outcome.items).toHaveLength(1);
          const item = outcome.items[0];
          expect(item?.status).toBe("EXECUTED");
          if (item?.status !== "EXECUTED") throw new Error("execution absent");
          expect(item.result.outcome).toBe("VERIFIED");
        } else {
          const outcome = parseUndoTabResult(completed);
          expect(outcome?.outcome.status).toBe("COMPLETED");
          if (outcome?.outcome.status !== "COMPLETED")
            throw new Error("undo absent");
          expect(outcome.outcome.result.outcome).toBe("VERIFIED");
        }
        expect(after.value).toBe(
          operation === "EXECUTE" ? control.intended : control.prior,
        );
        expect(after.viewport).toEqual(before.viewport);
        expect(after.events).toEqual({
          focus: 1,
          blur: 1,
          input: 1,
          change: 1,
          active_at_focus: true,
          trusted_focus: true,
        });
        expect(
          afterNative.native_mutation_count -
            beforeNative.native_mutation_count,
        ).toBe(1);
      } finally {
        await pending?.catch(() => undefined);
        await witness.dispose();
        await h.page.close();
        await h.controller.close();
      }
    });
  }
}
