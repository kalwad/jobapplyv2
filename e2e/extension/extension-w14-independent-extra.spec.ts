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

function undoDriverOutcome(result: ReturnType<typeof parseUndoTabResult>) {
  if (result?.outcome.status !== "COMPLETED")
    throw new Error("undo driver result missing");
  return result.outcome.result.outcome;
}

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

for (const operation of ["EXECUTE", "UNDO"] as const) {
  test(`independent ${operation} final hash eventless value drift`, async ({
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
    let pending: ReturnType<typeof runtimeMessage> | undefined;
    try {
      await setFixture(
        h,
        '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" aria-invalid="false" value="Prior" required></form>',
      );
      const top = foundTopFrame(await scanFrames(h));
      const before = descriptorByLabel(top.descriptors, "First name");
      const tx = await approvedTransaction(
        before,
        `independent-value-${operation}`,
        { kind: "TEXT", text: "Synthetic" },
      );
      const initial = operation === "UNDO" ? await dynExecute(h, [tx]) : null;
      if (initial) expect(firstDriverOutcome(initial)).toBe("VERIFIED");
      await witness.session.send("Runtime.evaluate", {
        contextId: witness.contextId,
        expression: `(${installResultHashPause.toString()})(${JSON.stringify(`w10-idempotency-v1\0${tx.transaction_id}\0${operation}`)})`,
      });
      const pendingResult =
        operation === "EXECUTE"
          ? { operation: "EXECUTE" as const, promise: dynExecute(h, [tx]) }
          : {
              operation: "UNDO" as const,
              promise: runtimeMessage(
                h.controller,
                buildUndoTabRequest("independent-value-undo", h.tabId, {
                  transaction_id: tx.transaction_id,
                  address: tx.address,
                  settle: { budget_ms: 75 },
                }),
              ),
            };
      pending = pendingResult.promise;
      await expect
        .poll(
          async () => {
            const r = await witness.session.send("Runtime.evaluate", {
              contextId: witness.contextId,
              expression:
                "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.reached === true",
              returnByValue: true,
            });
            return r.result.value === true;
          },
          { timeout: 5000 },
        )
        .toBe(true);
      const observedBeforeDrift = await h.page.locator("#first").inputValue();
      const mutationRecords = await h.page.evaluate(() => {
        const observer = new MutationObserver(() => undefined);
        observer.observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        const input = document.querySelector("input");
        if (input === null) throw new Error("native input missing");
        input.value = "Changed by site";
        const count = observer.takeRecords().length;
        observer.disconnect();
        return count;
      });
      await witness.session.send("Runtime.evaluate", {
        contextId: witness.contextId,
        expression: "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__.release()",
      });
      const completed =
        pendingResult.operation === "EXECUTE"
          ? {
              operation: "EXECUTE" as const,
              result: await pendingResult.promise,
            }
          : {
              operation: "UNDO" as const,
              result: parseUndoTabResult(await pendingResult.promise),
            };
      pending = undefined;
      const result = completed.result;
      const physical = await h.page.evaluate(() => {
        const input = document.querySelector("input");
        if (input === null) throw new Error("native input missing");
        return {
          value: input.value,
          ariaInvalid: input.getAttribute("aria-invalid"),
        };
      });
      await record(info, `eventless-value-${operation}`, {
        operation,
        before,
        tx,
        initial,
        observedBeforeDrift,
        mutationRecords,
        result,
        physical,
        native: await witness.snapshot(),
        browserVersion: extensionContext.browser()?.version(),
      });
      expect(mutationRecords).toBe(0);
      expect(physical.value).toBe("Changed by site");
      const outcome =
        completed.operation === "EXECUTE"
          ? firstDriverOutcome(completed.result)
          : undoDriverOutcome(completed.result);
      expect(outcome).not.toBe("VERIFIED");
    } finally {
      await witness.session.send("Runtime.evaluate", {
        contextId: witness.contextId,
        expression: "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.restore()",
      });
      await pending?.catch(() => undefined);
      await witness.dispose();
      await h.page.close();
      await h.controller.close();
    }
  });
}
for (const stage of ["before-write", "after-verified"] as const) {
  test(`independent opaque radio label drift ${stage}`, async ({
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
        '<form data-japp-application-root="true"><fieldset><legend>Work mode</legend><label><input id="remote" type="radio" name="mode" value="17" required><span id="remote-label">Remote</span></label><label><input id="hybrid" type="radio" name="mode" value="18"><span>Hybrid</span></label></fieldset></form>',
      );
      const top = foundTopFrame(await scanFrames(h));
      const before = descriptorByLabel(top.descriptors, "Work mode");
      const records = buildApprovedRecordSet([
        {
          recordId: await stableSemanticId("record", "independent-radio"),
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
        correlationId: await stableSemanticId("cor", `radio-${stage}`),
      });
      if (
        approval.status !== "RESOLVED" ||
        approval.resolution.optionResolution?.status !== "RESOLVED"
      )
        throw new Error("radio approval prerequisite");
      expect(approval.resolution.decision.final_decision).toBe("FILL");
      const tx = await buildTransaction(
        before,
        {
          kind: "OPTION",
          value_digest: approval.resolution.optionResolution.valueDigest,
        },
        approval.resolution.decision,
        `radio-${stage}`,
      );
      const initial =
        stage === "after-verified" ? await dynExecute(h, [tx]) : null;
      if (initial) expect(firstDriverOutcome(initial)).toBe("VERIFIED");
      const priorNative = await witness.snapshot();
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
        correlationId: await stableSemanticId("cor", `radio-fresh-${stage}`),
      });
      expect(freshPolicy.status).toBe("RESOLVED");
      if (freshPolicy.status === "RESOLVED")
        expect(freshPolicy.resolution.decision.final_decision).not.toBe("FILL");
      const execution =
        stage === "before-write" ? await dynExecute(h, [tx]) : null;
      const inventory = await dynReconcile(h, top.frame_context.frame_id);
      const physical = await h.page.evaluate(() => ({
        selected: [
          ...document.querySelectorAll<HTMLInputElement>("input:checked"),
        ].map((input) => {
          const label = input.closest("label");
          if (label === null) throw new Error("radio label missing");
          return { id: input.id, value: input.value, label: label.textContent };
        }),
      }));
      const native = await witness.snapshot();
      await record(info, `radio-${stage}`, {
        stage,
        before,
        approval,
        tx,
        initial,
        priorNative,
        changed,
        freshPolicy,
        execution,
        inventory,
        physical,
        native,
        browserVersion: extensionContext.browser()?.version(),
      });
      if (stage === "before-write") {
        expect(native.native_mutation_count).toBe(
          priorNative.native_mutation_count,
        );
        if (execution === null) throw new Error("execution missing");
        expect(firstDriverOutcome(execution)).not.toBe("VERIFIED");
      } else {
        expect(reconciled(inventory).inventory.readiness).toBe("NOT_READY");
      }
    } finally {
      await witness.dispose();
      await h.page.close();
      await h.controller.close();
    }
  });
}
