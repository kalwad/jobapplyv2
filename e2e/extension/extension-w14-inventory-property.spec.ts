/** Actual W11 final-inventory publication property-only freshness regression. */
import { test, expect } from "./support/extension-test.ts";
import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
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
import {
  firstDriverOutcome,
  recordIndependentEvidence,
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

test("W14: final inventory hash refuses eventless native value drift", async ({
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
  let pending: ReturnType<typeof dynReconcile> | undefined;
  try {
    await setFixture(
      h,
      '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>',
    );
    const top = foundTopFrame(await scanFrames(h));
    const field = descriptorByLabel(top.descriptors, "First name");
    const tx = await approvedTransaction(field, "final-inventory-property", {
      kind: "TEXT",
      text: "Synthetic",
    });
    const execution = await dynExecute(h, [tx]);
    expect(firstDriverOutcome(execution)).toBe("VERIFIED");
    const baseline = reconciled(
      await dynReconcile(h, top.frame_context.frame_id),
    );
    expect(baseline.inventory.readiness).toBe("READY");
    const priorNative = await witness.snapshot();
    await witness.session.send("Runtime.evaluate", {
      contextId: witness.contextId,
      expression: `(${installResultHashPause.toString()})(${JSON.stringify("w11-inventory-v1\0")})`,
    });
    pending = dynReconcile(h, top.frame_context.frame_id);
    await expect
      .poll(
        async () => {
          const result = await witness.session.send("Runtime.evaluate", {
            contextId: witness.contextId,
            expression:
              "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.reached === true",
            returnByValue: true,
          });
          return result.result.value === true;
        },
        { timeout: 5000 },
      )
      .toBe(true);
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
    const publication = await pending;
    pending = undefined;
    const current = await dynReconcile(h, top.frame_context.frame_id);
    const native = await witness.snapshot();
    const value = await h.page.locator("#first").inputValue();
    await recordIndependentEvidence(info, "inventory-eventless-value", {
      field,
      tx,
      execution,
      baseline,
      priorNative,
      mutationRecords,
      publication,
      current,
      native,
      value,
    });
    expect(mutationRecords).toBe(0);
    expect(value).toBe("Changed by site");
    expect(publication.status).toBe("ROOT_UNRESOLVED");
    expect(reconciled(current).inventory.readiness).toBe("NOT_READY");
    expect(native.native_mutation_count).toBe(
      priorNative.native_mutation_count,
    );
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
