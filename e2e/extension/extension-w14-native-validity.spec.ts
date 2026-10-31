/** Fresh independent actual-MV3 native validity publication probes. */
import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
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
  runtimeMessage,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";
import {
  buildUndoTabRequest,
  parseUndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
import {
  firstDriverOutcome,
  recordIndependentEvidence as record,
} from "./support/independent-w14-evidence.ts";
function installResultHashPause(prefix: string): void {
  const host = globalThis as unknown as {
    __JAPP_W14_TEST_RESULT_HASH_PAUSE__?: {
      reached: boolean;
      release(): void;
      restore(): void;
    };
  };
  const subtle = crypto.subtle;
  const prior = Object.getOwnPropertyDescriptor(subtle, "digest");
  const nativeDigest = subtle.digest.bind(subtle);
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const gate = {
    reached: false,
    release() {
      release?.();
    },
    restore() {
      release?.();
      if (prior === undefined) Reflect.deleteProperty(subtle, "digest");
      else Object.defineProperty(subtle, "digest", prior);
      Reflect.deleteProperty(host, "__JAPP_W14_TEST_RESULT_HASH_PAUSE__");
    },
  };
  host.__JAPP_W14_TEST_RESULT_HASH_PAUSE__ = gate;
  Object.defineProperty(subtle, "digest", {
    configurable: true,
    writable: true,
    value(
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const native = nativeDigest(algorithm, data);
      const seed = new TextDecoder().decode(data);
      if (!gate.reached && seed.startsWith(prefix)) {
        gate.reached = true;
        return native.then(async (digest) => {
          await wait;
          return digest;
        });
      }
      return native;
    },
  });
}

for (const operation of ["EXECUTE", "UNDO", "W11"] as const) {
  for (const lateRejection of [false, true]) {
    test(`fresh native validity ${operation} ${lateRejection ? "late rejection" : "unchanged positive"}`, async ({
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
          '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" aria-invalid="false" value="Prior" required></form>',
        );
        const top = foundTopFrame(await scanFrames(h));
        const field = descriptorByLabel(top.descriptors, "First name");
        const tx = await approvedTransaction(
          field,
          `fresh-native-validity-${operation}-${String(lateRejection)}`,
          { kind: "TEXT", text: "Synthetic" },
        );
        const initial =
          operation === "EXECUTE" ? null : await dynExecute(h, [tx]);
        if (initial !== null)
          expect(firstDriverOutcome(initial)).toBe("VERIFIED");
        const baseline =
          operation === "W11"
            ? reconciled(await dynReconcile(h, top.frame_context.frame_id))
            : null;
        if (baseline !== null)
          expect(baseline.inventory.readiness).toBe("READY");
        const prefix =
          operation === "W11"
            ? "w11-inventory-v1\0"
            : `w10-idempotency-v1\0${tx.transaction_id}\0${operation}`;
        await witness.session.send("Runtime.evaluate", {
          contextId: witness.contextId,
          expression: `(${installResultHashPause.toString()})(${JSON.stringify(prefix)})`,
        });
        const operationPromise =
          operation === "EXECUTE"
            ? dynExecute(h, [tx])
            : operation === "UNDO"
              ? runtimeMessage(
                  h.controller,
                  buildUndoTabRequest("fresh-native-validity-undo", h.tabId, {
                    transaction_id: tx.transaction_id,
                    address: tx.address,
                    settle: { budget_ms: 75 },
                  }),
                )
              : dynReconcile(h, top.frame_context.frame_id);
        pending = operationPromise;
        await expect
          .poll(
            async () => {
              const response = await witness.session.send("Runtime.evaluate", {
                contextId: witness.contextId,
                expression:
                  "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.reached === true",
                returnByValue: true,
              });
              return response.result.value === true;
            },
            { timeout: 5000 },
          )
          .toBe(true);
        const physical = await h.page.evaluate((reject) => {
          const input = document.querySelector("input");
          if (input === null) throw new Error("native input missing");
          const read = () => ({
            value: input.value,
            valid: input.validity.valid,
            customError: input.validity.customError,
            willValidate: input.willValidate,
            validationMessage: input.validationMessage,
            ariaInvalid: input.getAttribute("aria-invalid"),
          });
          const before = read();
          const observer = new MutationObserver(() => undefined);
          observer.observe(document, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          if (reject) input.setCustomValidity("Late synthetic site rejection");
          const records = observer.takeRecords().length;
          observer.disconnect();
          return { before, after: read(), mutationRecords: records };
        }, lateRejection);
        await witness.session.send("Runtime.evaluate", {
          contextId: witness.contextId,
          expression:
            "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__.release()",
        });
        const completed = await operationPromise;
        pending = undefined;
        const current =
          operation === "W11"
            ? await dynReconcile(h, top.frame_context.frame_id)
            : null;
        await record(
          info,
          `fresh-native-validity-${operation}-${String(lateRejection)}`,
          {
            operation,
            lateRejection,
            field,
            tx,
            initial,
            baseline,
            physical,
            completed,
            current,
            native: await witness.snapshot(),
            browserVersion: extensionContext.browser()?.version(),
            serviceWorkerUrl: serviceWorker.url(),
          },
        );
        expect(physical.mutationRecords).toBe(0);
        expect(physical.after.value).toBe(physical.before.value);
        expect(physical.after.valid).toBe(!lateRejection);
        expect(physical.after.customError).toBe(lateRejection);
        if (operation === "EXECUTE") {
          const execution = completed as Awaited<ReturnType<typeof dynExecute>>;
          if (lateRejection)
            expect(firstDriverOutcome(execution)).not.toBe("VERIFIED");
          else {
            expect(firstDriverOutcome(execution)).toBe("VERIFIED");
            const item = execution.items[0];
            expect(
              item !== undefined &&
                "undo_available" in item &&
                item.undo_available,
            ).toBe(true);
          }
        } else if (operation === "UNDO") {
          const undo = parseUndoTabResult(completed);
          expect(undo?.outcome.status).toBe("COMPLETED");
          if (undo?.outcome.status !== "COMPLETED")
            throw new Error("undo result absent");
          if (lateRejection)
            expect(undo.outcome.result.outcome).not.toBe("VERIFIED");
          else expect(undo.outcome.result.outcome).toBe("VERIFIED");
          expect(physical.after.value).toBe("Prior");
        } else {
          const publication = completed as Awaited<
            ReturnType<typeof dynReconcile>
          >;
          if (current === null)
            throw new Error("current reconciliation missing");
          if (lateRejection) {
            expect(reconciled(current).inventory.readiness).toBe("NOT_READY");
            expect(
              publication.status === "RECONCILED" &&
                publication.inventory.readiness === "READY",
            ).toBe(false);
          } else {
            expect(reconciled(publication).inventory.readiness).toBe("READY");
            expect(reconciled(current).inventory.readiness).toBe("READY");
          }
        }
      } finally {
        await witness.session.send("Runtime.evaluate", {
          contextId: witness.contextId,
          expression:
            "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.restore()",
        });
        await pending?.catch(() => undefined);
        await witness.dispose();
        await h.page.close();
        await h.controller.close();
      }
    });
  }
}
