import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  dynExecute,
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

test("independent undo final result hash refuses later validation rejection", async ({
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
      '<form data-japp-application-root="true"><span id="ownership">Your contact</span><label for="first">First name</label><input id="first" name="first" aria-describedby="ownership" aria-invalid="false" value="Prior" required></form>',
    );
    const top = foundTopFrame(await scanFrames(h));
    const before = descriptorByLabel(top.descriptors, "First name");
    const tx = await approvedTransaction(before, "independent-undo-last-hash", {
      kind: "TEXT",
      text: "Synthetic",
    });
    const execution = await dynExecute(h, [tx]);
    expect(firstDriverOutcome(execution)).toBe("VERIFIED");
    await witness.session.send("Runtime.evaluate", {
      contextId: witness.contextId,
      expression: `(${installResultHashPause.toString()})(${JSON.stringify(`w10-idempotency-v1\0${tx.transaction_id}\0UNDO`)})`,
    });
    pending = runtimeMessage(
      h.controller,
      buildUndoTabRequest("independent-undo-hash", h.tabId, {
        transaction_id: tx.transaction_id,
        address: tx.address,
        settle: { budget_ms: 75 },
      }),
    );
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
    expect(await h.page.locator("#first").inputValue()).toBe("Prior");
    await h.page.locator("#first").evaluate((node) => {
      node.setAttribute("aria-invalid", "true");
    });
    await witness.session.send("Runtime.evaluate", {
      contextId: witness.contextId,
      expression: "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__.release()",
    });
    const undo = parseUndoTabResult(await pending);
    pending = undefined;
    const physical = await h.page.evaluate(() => {
      const input = document.querySelector("input");
      if (input === null) throw new Error("native input missing");
      return {
        value: input.value,
        ariaInvalid: input.getAttribute("aria-invalid"),
      };
    });
    await record(info, "undo-last-hash", {
      before,
      tx,
      execution,
      undo,
      physical,
      native: await witness.snapshot(),
      browserVersion: extensionContext.browser()?.version(),
    });
    expect(undo?.outcome.status).toBe("COMPLETED");
    if (undo?.outcome.status === "COMPLETED")
      expect(undo.outcome.result.outcome).not.toBe("VERIFIED");
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
