/** Actual MV3 stale-authority probe at result publication, no product hook. */
import type { CDPSession } from "@playwright/test";
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
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";
interface ExecutionContext {
  id: number;
}

async function contentExecutionContext(
  session: CDPSession,
  extensionId: string,
): Promise<number> {
  const contexts: ExecutionContext[] = [];
  session.on("Runtime.executionContextCreated", (event: unknown) => {
    if (event === null || typeof event !== "object") return;
    const context = (event as { context?: unknown }).context;
    if (context === null || typeof context !== "object") return;
    const id = (context as { id?: unknown }).id;
    if (typeof id === "number") contexts.push({ id });
  });
  await session.send("Runtime.enable");
  const matches: number[] = [];
  for (const context of contexts) {
    const response = await session.send("Runtime.evaluate", {
      contextId: context.id,
      expression:
        "typeof chrome !== 'undefined' && chrome.runtime?.id === " +
        JSON.stringify(extensionId),
      returnByValue: true,
    });
    const value: unknown = response.result.value;
    if (value === true) matches.push(context.id);
  }
  expect(
    matches,
    "exactly one actual extension content execution realm",
  ).toHaveLength(1);
  const id = matches[0];
  if (id === undefined) throw new Error("extension content realm missing");
  return id;
}

/** Pause a fresh result metadata hash after settlement, preserving native bytes. */
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

for (const drift of ["description", "aria-invalid"] as const) {
  test(`W14 peer: ${drift} drift during final result metadata hash refuses direct verification and undo authority`, async ({
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
    let session: CDPSession | undefined;
    let contextId: number | undefined;
    let pending: ReturnType<typeof dynExecute> | undefined;
    try {
      await setFixture(
        harness,
        '<form data-japp-application-root="true"><span id="ownership">Your contact</span><label for="first">First name</label><input id="first" name="first" aria-describedby="ownership" aria-invalid="false" required></form>',
      );
      await harness.page.evaluate(() => {
        const input = document.getElementById("first");
        if (input === null) throw new Error("input missing");
        const meter = { input: 0, change: 0 };
        (
          window as unknown as { peerResultMeter: typeof meter }
        ).peerResultMeter = meter;
        input.addEventListener("input", () => {
          meter.input++;
        });
        input.addEventListener("change", () => {
          meter.change++;
        });
      });
      const top = foundTopFrame(await scanFrames(harness));
      const descriptor = descriptorByLabel(top.descriptors, "First name");
      const transaction = await approvedTransaction(
        descriptor,
        `peer-result-hash-${drift}`,
        { kind: "TEXT", text: "Synthetic" },
      );
      expect(transaction.decision.final_decision).toBe("FILL");
      session = await extensionContext.newCDPSession(harness.page);
      contextId = await contentExecutionContext(session, extensionId);
      await session.send("Runtime.evaluate", {
        contextId,
        expression: `(${installResultHashPause.toString()})(${JSON.stringify(`w10-idempotency-v1\0${transaction.transaction_id}\0EXECUTE`)})`,
      });
      pending = dynExecute(harness, [transaction]);
      const activeSession = session,
        activeContext = contextId;
      await expect
        .poll(
          async () => {
            const response = await activeSession.send("Runtime.evaluate", {
              contextId: activeContext,
              expression:
                "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.reached === true",
              returnByValue: true,
            });
            return response.result.value as unknown;
          },
          { timeout: 5000 },
        )
        .toBe(true);
      expect(await harness.page.locator("#first").inputValue()).toBe(
        "Synthetic",
      );
      if (drift === "description") {
        await harness.page.locator("#ownership").evaluate((node) => {
          node.textContent = "Employer";
        });
      } else {
        await harness.page.locator("#first").evaluate((node) => {
          node.setAttribute("aria-invalid", "true");
        });
      }
      await session.send("Runtime.evaluate", {
        contextId,
        expression: "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__.release()",
      });
      const execution = await pending;
      pending = undefined;
      const inventory = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              peerResultMeter: { input: number; change: number };
            }
          ).peerResultMeter,
      );
      await testInfo.attach(`w14-result-hash-${drift}.json`, {
        body: JSON.stringify(
          { drift, descriptor, transaction, execution, inventory, meter },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(meter).toEqual({ input: 1, change: 1 });
      expect(execution.items[0]?.status).toBe("EXECUTED");
      if (execution.items[0]?.status === "EXECUTED") {
        expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
        expect(execution.items[0].undo_available).toBe(false);
      }
      expect(inventory.inventory.readiness).toBe("NOT_READY");
    } finally {
      if (session !== undefined && contextId !== undefined)
        await session.send("Runtime.evaluate", {
          contextId,
          expression:
            "globalThis.__JAPP_W14_TEST_RESULT_HASH_PAUSE__?.restore()",
        });
      await pending?.catch(() => undefined);
      await session?.detach();
      await harness.page.close();
      await harness.controller.close();
    }
  });
}
