/** Peer-authored actual-MV3 probes. No shipped hook or fixture timeout is added. */
import type { CDPSession } from "@playwright/test";
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
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";

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

/** This instrumentation wraps a native digest only inside the chosen test
 * content realm. It preserves the real native digest bytes, introduces no
 * product hook, and pauses the final inventory-id hash after evidence/item
 * construction. The fresh correlation ID prevents hash-cache reuse. */
function installFinalInventoryHashPause(): void {
  const host = globalThis as unknown as {
    __JAPP_W14_TEST_HASH_PAUSE__?: {
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
      Reflect.deleteProperty(host, "__JAPP_W14_TEST_HASH_PAUSE__");
    },
  };
  host.__JAPP_W14_TEST_HASH_PAUSE__ = gate;
  Object.defineProperty(subtle, "digest", {
    configurable: true,
    writable: true,
    value(
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const native = nativeDigest(algorithm, data);
      const seed = new TextDecoder().decode(data);
      if (!gate.reached && seed.startsWith("w11-inventory-v1\0")) {
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

test("W14 peer: required root attached during final inventory hash refuses stale READY publication", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  let session: CDPSession | undefined;
  let contextId: number | undefined;
  let pending: ReturnType<typeof dynReconcile> | undefined;
  try {
    await setFixture(
      harness,
      '<form data-japp-application-root="true"><h2>Application</h2><label for="first">First name</label><input id="first" name="first" required><div id="late-host"></div></form>',
    );
    const top = foundTopFrame(await scanFrames(harness));
    const transaction = await approvedTransaction(
      descriptorByLabel(top.descriptors, "First name"),
      "peer-late-publication",
      { kind: "TEXT", text: "Synthetic" },
    );
    const execution = await dynExecute(harness, [transaction]);
    expect(execution.items[0]?.status).toBe("EXECUTED");
    if (execution.items[0]?.status === "EXECUTED")
      expect(execution.items[0].result.outcome).toBe("VERIFIED");
    expect(
      reconciled(await dynReconcile(harness, top.frame_context.frame_id))
        .inventory.readiness,
    ).toBe("READY");

    session = await extensionContext.newCDPSession(harness.page);
    contextId = await contentExecutionContext(session, extensionId);
    await session.send("Runtime.evaluate", {
      contextId,
      expression: `(${installFinalInventoryHashPause.toString()})()`,
    });
    pending = dynReconcile(harness, top.frame_context.frame_id);
    const activeSession = session;
    const activeContext = contextId;
    await expect
      .poll(
        async () => {
          const response = await activeSession.send("Runtime.evaluate", {
            contextId: activeContext,
            expression:
              "globalThis.__JAPP_W14_TEST_HASH_PAUSE__?.reached === true",
            returnByValue: true,
          });
          const value: unknown = response.result.value;
          return value;
        },
        { timeout: 5000 },
      )
      .toBe(true);
    // The host already existed. attachShadow itself produces no light-DOM
    // mutation, and the pause occurs after the earlier evidence topology check.
    await harness.page.evaluate(() => {
      const host = document.getElementById("late-host");
      if (host === null) throw new Error("late host absent");
      host.attachShadow({ mode: "open" }).innerHTML =
        '<label for="unknown">Emergency contact name (required)</label><input id="unknown" required>';
    });
    await session.send("Runtime.evaluate", {
      contextId,
      expression: "globalThis.__JAPP_W14_TEST_HASH_PAUSE__.release()",
    });
    const changed = await pending;
    pending = undefined;
    expect(changed.status).toBe("ROOT_UNRESOLVED");
    const refreshed = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    ).inventory;
    expect(refreshed.items.filter((item) => item.required)).toHaveLength(2);
    expect(refreshed.counts.required_unresolved).toBeGreaterThanOrEqual(1);
    expect(refreshed.readiness).toBe("NOT_READY");
    await expect(harness.page.locator("#unknown")).toHaveValue("");
  } finally {
    if (session !== undefined && contextId !== undefined) {
      await session.send("Runtime.evaluate", {
        contextId,
        expression: "globalThis.__JAPP_W14_TEST_HASH_PAUSE__?.restore()",
      });
    }
    if (pending !== undefined) await pending;
    await session?.detach();
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 peer: focus slot reassignment to Employer refuses an approved applicant write", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await setFixture(
      harness,
      '<form data-japp-application-root="true"><label for="first">First name</label><div id="slot-host"><input id="first" name="first" slot="own" required></div></form>',
    );
    await harness.page.evaluate(() => {
      const host = document.getElementById("slot-host");
      if (host === null) throw new Error("slot host absent");
      host.attachShadow({ mode: "open" }).innerHTML =
        '<section aria-label="Your contact"><slot name="own"></slot></section><section aria-label="Employer"><slot name="other"></slot></section>';
      const input = document.getElementById("first");
      if (!(input instanceof HTMLInputElement)) throw new Error("input absent");
      const meter = { inputs: 0, focus: 0 };
      (window as unknown as { peerSlotMeter: typeof meter }).peerSlotMeter =
        meter;
      input.addEventListener("input", () => {
        meter.inputs++;
      });
      input.addEventListener(
        "focus",
        () => {
          meter.focus++;
          input.slot = "other";
        },
        { once: true },
      );
    });
    const top = foundTopFrame(await scanFrames(harness));
    const first = descriptorByLabel(top.descriptors, "First name");
    expect(first.section_context).toContain("YOUR_CONTACT");
    const transaction = await approvedTransaction(first, "peer-focus-slot", {
      kind: "TEXT",
      text: "Synthetic",
    });
    const execution = await dynExecute(harness, [transaction]);
    expect(execution.items[0]?.status).toBe("EXECUTED");
    if (execution.items[0]?.status === "EXECUTED")
      expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
    const meter = await harness.page.evaluate(
      () =>
        (
          window as unknown as {
            peerSlotMeter: { inputs: number; focus: number };
          }
        ).peerSlotMeter,
    );
    expect(meter).toEqual({ inputs: 0, focus: 1 });
    await expect(harness.page.locator("#first")).toHaveValue("");
    const after = descriptorByLabel(
      foundTopFrame(await scanFrames(harness)).descriptors,
      "First name",
    );
    expect(after.section_context).toContain("EMPLOYER");
    expect(
      reconciled(await dynReconcile(harness, top.frame_context.frame_id))
        .inventory.readiness,
    ).toBe("NOT_READY");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

for (const mode of ["attached-root", "added-subtree"] as const) {
  test(`W14 peer: incremental ${mode} cannot exceed the absolute eight-root depth`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await setFixture(
        harness,
        '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required><div id="deep-host"></div></form>',
      );
      await harness.page.evaluate(() => {
        let host = document.getElementById("deep-host");
        if (!(host instanceof HTMLElement)) throw new Error("deep host absent");
        let deepest: ShadowRoot | undefined;
        for (let level = 0; level < 7; level++) {
          deepest = host.attachShadow({ mode: "open" });
          const next = document.createElement("div");
          deepest.append(next);
          host = next;
        }
        if (deepest === undefined) throw new Error("deep root absent");
        (
          window as unknown as {
            peerDepth: { host: HTMLElement; root: ShadowRoot };
          }
        ).peerDepth = { host, root: deepest };
      });
      const before = foundTopFrame(await scanFrames(harness));
      expect(before.descriptors).toHaveLength(1);
      await harness.page.evaluate((mode) => {
        const state = (
          window as unknown as {
            peerDepth: { host: HTMLElement; root: ShadowRoot };
          }
        ).peerDepth;
        const newHost = document.createElement("div");
        const root8 =
          mode === "attached-root"
            ? state.host.attachShadow({ mode: "open" })
            : newHost.attachShadow({ mode: "open" });
        const nestedHost = document.createElement("div");
        root8.append(nestedHost);
        const root9 = nestedHost.attachShadow({ mode: "open" });
        root9.innerHTML =
          '<label for="unknown">Emergency contact name (required)</label><input id="unknown" required>';
        if (mode === "added-subtree") state.root.append(newHost);
      }, mode);
      const after = (await scanFrames(harness)).find(
        (frame) => frame.frame_context.is_top_frame,
      );
      expect(after?.root_status).toBe("CAPACITY_EXCEEDED");
      expect(after?.descriptors).toEqual([]);
      expect(
        (await dynReconcile(harness, before.frame_context.frame_id)).status,
      ).toBe("CAPACITY_EXCEEDED");
      await expect(harness.page.locator("#first")).toHaveValue("");
      await expect(harness.page.locator("#unknown")).toHaveValue("");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

/** Native API instrumentation is test-only and tracks exactly the topology
 * observer's id-only options. Other product observers are not counted. */
function installTopologySubscriptionMeter(): void {
  const host = globalThis as unknown as {
    __JAPP_W14_TEST_OBSERVER_METER__?: {
      snapshot(): {
        root_subscriptions: number;
        detached_root_subscriptions: number;
      };
      restore(): void;
    };
  };
  const prototype = MutationObserver.prototype;
  const observe = Object.getOwnPropertyDescriptor(prototype, "observe");
  const disconnect = Object.getOwnPropertyDescriptor(prototype, "disconnect");
  const nativeObserve: unknown = observe?.value;
  const nativeDisconnect: unknown = disconnect?.value;
  if (
    typeof nativeObserve !== "function" ||
    typeof nativeDisconnect !== "function" ||
    observe === undefined ||
    disconnect === undefined
  )
    throw new Error("native observer methods unavailable");
  const subscriptions = new Map<MutationObserver, Set<Node>>();
  Object.defineProperty(prototype, "observe", {
    ...observe,
    value(
      this: MutationObserver,
      target: Node,
      options?: MutationObserverInit,
    ): void {
      Reflect.apply(nativeObserve, this, [target, options]);
      if (
        options?.attributeFilter?.length === 1 &&
        options.attributeFilter[0] === "id"
      ) {
        const targets = subscriptions.get(this) ?? new Set<Node>();
        targets.add(target);
        subscriptions.set(this, targets);
      }
    },
  });
  Object.defineProperty(prototype, "disconnect", {
    ...disconnect,
    value(this: MutationObserver): void {
      Reflect.apply(nativeDisconnect, this, []);
      subscriptions.delete(this);
    },
  });
  host.__JAPP_W14_TEST_OBSERVER_METER__ = {
    snapshot() {
      const roots = [...subscriptions.values()]
        .flatMap((targets) => [...targets])
        .filter((node): node is ShadowRoot => node instanceof ShadowRoot);
      return {
        root_subscriptions: roots.length,
        detached_root_subscriptions: roots.filter(
          (root) => !root.host.isConnected,
        ).length,
      };
    },
    restore() {
      Object.defineProperty(prototype, "observe", observe);
      Object.defineProperty(prototype, "disconnect", disconnect);
      subscriptions.clear();
      Reflect.deleteProperty(host, "__JAPP_W14_TEST_OBSERVER_METER__");
    },
  };
}

test("W14 peer: removed roots lose native topology observer subscriptions", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  let session: CDPSession | undefined;
  let contextId: number | undefined;
  try {
    session = await extensionContext.newCDPSession(harness.page);
    contextId = await contentExecutionContext(session, extensionId);
    await session.send("Runtime.evaluate", {
      contextId,
      expression: `(${installTopologySubscriptionMeter.toString()})()`,
    });
    await setFixture(
      harness,
      '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required><div id="removable-host"></div></form>',
    );
    await harness.page.evaluate(() => {
      const host = document.getElementById("removable-host");
      if (host === null) throw new Error("removable host absent");
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = '<span id="old-id">Unrelated description</span>';
      (window as unknown as { peerRemovedRoot: ShadowRoot }).peerRemovedRoot =
        root;
    });
    foundTopFrame(await scanFrames(harness));
    const before = await session.send("Runtime.evaluate", {
      contextId,
      expression: "globalThis.__JAPP_W14_TEST_OBSERVER_METER__.snapshot()",
      returnByValue: true,
    });
    const initial: unknown = before.result.value;
    expect(initial).toMatchObject({ detached_root_subscriptions: 0 });
    expect(
      (initial as { root_subscriptions: number }).root_subscriptions,
    ).toBeGreaterThanOrEqual(1);
    await harness.page.locator("#removable-host").evaluate((host) => {
      host.remove();
    });
    foundTopFrame(await scanFrames(harness));
    const after = await session.send("Runtime.evaluate", {
      contextId,
      expression: "globalThis.__JAPP_W14_TEST_OBSERVER_METER__.snapshot()",
      returnByValue: true,
    });
    const final: unknown = after.result.value;
    expect(final).toEqual({
      root_subscriptions: 0,
      detached_root_subscriptions: 0,
    });
    // Retain the removed root explicitly, then mutate it: GC cannot make the
    // subscription assertion pass and detached ID updates must stay irrelevant.
    await harness.page.evaluate(() => {
      const root = (window as unknown as { peerRemovedRoot: ShadowRoot })
        .peerRemovedRoot;
      const node = root.getElementById("old-id");
      if (node === null) throw new Error("retained detached node absent");
      node.id = "changed-id";
    });
    foundTopFrame(await scanFrames(harness));
    const later = await session.send("Runtime.evaluate", {
      contextId,
      expression: "globalThis.__JAPP_W14_TEST_OBSERVER_METER__.snapshot()",
      returnByValue: true,
    });
    const subsequent: unknown = later.result.value;
    expect(subsequent).toEqual({
      root_subscriptions: 0,
      detached_root_subscriptions: 0,
    });
    await expect(harness.page.locator("#first")).toHaveValue("");
  } finally {
    if (session !== undefined && contextId !== undefined)
      await session.send("Runtime.evaluate", {
        contextId,
        expression: "globalThis.__JAPP_W14_TEST_OBSERVER_METER__?.restore()",
      });
    await session?.detach();
    await harness.page.close();
    await harness.controller.close();
  }
});

for (const ownershipTree of ["document", "shadow"] as const) {
  test(`W14 peer: ${ownershipTree} description ownership change invalidates an earlier applicant approval`, async ({
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
    try {
      const controls =
        '<span id="ownership">Your contact</span><label for="first">First name</label><input id="first" name="first" aria-describedby="ownership" required>';
      await setFixture(
        harness,
        '<form data-japp-application-root="true"><div id="owner-host"></div></form>',
      );
      await harness.page.evaluate(
        ({ controls, ownershipTree }) => {
          const host = document.getElementById("owner-host");
          if (host === null) throw new Error("owner host absent");
          const root =
            ownershipTree === "shadow"
              ? host.attachShadow({ mode: "open" })
              : host;
          root.innerHTML = controls;
          const input = root.querySelector("input");
          if (input === null) throw new Error("input absent");
          const meter = { input: 0, change: 0 };
          (
            window as unknown as { peerDescriptionMeter: typeof meter }
          ).peerDescriptionMeter = meter;
          input.addEventListener("input", () => {
            meter.input++;
          });
          input.addEventListener("change", () => {
            meter.change++;
          });
        },
        { controls, ownershipTree },
      );
      const top = foundTopFrame(await scanFrames(harness));
      const before = descriptorByLabel(top.descriptors, "First name");
      expect(before.description?.normalized_text).toBe("Your contact");
      const oldApproval = await approvedTransaction(
        before,
        `peer-owner-before-${ownershipTree}`,
        {
          kind: "TEXT",
          text: "Synthetic",
        },
      );
      expect(oldApproval.decision.final_decision).toBe("FILL");
      await harness.page.locator("#ownership").evaluate((node) => {
        node.textContent = "Employer";
      });
      const changed = descriptorByLabel(
        foundTopFrame(await scanFrames(harness)).descriptors,
        "First name",
      );
      expect(changed.description?.normalized_text).toBe("Employer");
      const currentApproval = await approvedTransaction(
        changed,
        `peer-owner-after-${ownershipTree}`,
        {
          kind: "TEXT",
          text: "Synthetic",
        },
      );
      expect(currentApproval.decision.final_decision).not.toBe("FILL");
      const execution = await dynExecute(harness, [oldApproval]);
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              peerDescriptionMeter: { input: number; change: number };
            }
          ).peerDescriptionMeter,
      );
      const value = await harness.page.locator("#first").inputValue();
      await testInfo.attach(`w14-description-ownership-${ownershipTree}.json`, {
        body: JSON.stringify(
          {
            before,
            changed,
            oldApproval,
            currentApproval,
            execution,
            meter,
            value,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(meter).toEqual({ input: 0, change: 0 });
      expect(value).toBe("");
      expect(execution.items[0]?.status).toBe("EXECUTED");
      if (execution.items[0]?.status === "EXECUTED")
        expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

for (const ownershipSource of ["describedby", "title"] as const) {
  test(`W14 peer: delayed prompt ownership change through ${ownershipSource} prevents post-await option commit`, async ({
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
    try {
      await setFixture(
        harness,
        `<form data-japp-application-root="true"><span id="ownership">Your contact</span><div id="country" aria-label="Country" role="combobox" aria-controls="options" aria-expanded="false" ${ownershipSource === "describedby" ? 'aria-describedby="ownership"' : 'title="Your contact"'} aria-required="true" tabindex="0" style="display:block;width:240px;height:32px"></div><div id="options" role="listbox" hidden><div id="country-us" role="option" data-value="US" aria-selected="false">United States</div><div role="option" data-value="CA" aria-selected="false">Canada</div></div></form>`,
      );
      await harness.page.evaluate((source) => {
        const prompt = document.getElementById("country"),
          list = document.getElementById("options"),
          ownership = document.getElementById("ownership");
        if (prompt === null || list === null || ownership === null)
          throw new Error("prompt fixture missing");
        const meter = { opens: 0, commits: 0 };
        (
          window as unknown as { peerPromptMeter: typeof meter }
        ).peerPromptMeter = meter;
        prompt.addEventListener("click", () => {
          meter.opens++;
          prompt.setAttribute("aria-expanded", "true");
          if (source === "describedby") ownership.textContent = "Employer";
          else prompt.setAttribute("title", "Employer");
          setTimeout(() => {
            list.removeAttribute("hidden");
          }, 20);
        });
        list.addEventListener("click", (event) => {
          const option = event.target;
          if (
            !(option instanceof HTMLElement) ||
            option.getAttribute("role") !== "option"
          )
            return;
          meter.commits++;
          option.setAttribute("aria-selected", "true");
          prompt.setAttribute("aria-activedescendant", option.id);
          prompt.setAttribute("aria-expanded", "false");
          list.setAttribute("hidden", "");
        });
      }, ownershipSource);
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "Country");
      const decision = await resolveFieldDecision({
        descriptor: field,
        records: buildApprovedRecordSet([
          {
            recordId: await stableSemanticId("record", "peer-delayed-country"),
            concept: "ADDRESS_COUNTRY",
            valueToken: "US",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: await stableSemanticId("cor", "peer-delayed-country"),
      });
      expect(decision.status).toBe("RESOLVED");
      if (
        decision.status !== "RESOLVED" ||
        decision.resolution.optionResolution?.status !== "RESOLVED"
      )
        throw new Error("approved country option absent");
      expect(decision.resolution.decision.final_decision).toBe("FILL");
      const transaction = await buildTransaction(
        field,
        {
          kind: "OPTION",
          value_digest: decision.resolution.optionResolution.valueDigest,
        },
        decision.resolution.decision,
        "peer-delayed-country",
      );
      const execution = await dynExecute(harness, [transaction]);
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              peerPromptMeter: { opens: number; commits: number };
            }
          ).peerPromptMeter,
      );
      const selected = await harness.page
        .locator("#country-us")
        .getAttribute("aria-selected");
      await testInfo.attach(
        `w14-delayed-prompt-ownership-${ownershipSource}.json`,
        {
          body: JSON.stringify(
            { ownershipSource, field, decision, execution, meter, selected },
            null,
            2,
          ),
          contentType: "application/json",
        },
      );
      expect(meter).toEqual({ opens: 1, commits: 0 });
      expect(selected).toBe("false");
      expect(execution.items[0]?.status).toBe("EXECUTED");
      if (execution.items[0]?.status === "EXECUTED")
        expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}
