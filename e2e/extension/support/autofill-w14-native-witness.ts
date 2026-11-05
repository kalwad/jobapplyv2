/** W14 test instrumentation only; never imported by a shipped entrypoint. */
import { randomUUID } from "node:crypto";
import type { BrowserContext, CDPSession, Page } from "@playwright/test";
import { sha256Canonical } from "../../../packages/evaluation-runner/src/canonical.ts";

export const W14_NATIVE_WITNESS_SOURCE =
  "CDP_EXTENSION_ISOLATED_REALM_NATIVE_1";
const MAX_WITNESSES = 100000;
const MUTATION_SURFACES = new Set([
  "INPUT_VALUE",
  "TEXTAREA_VALUE",
  "SELECT_VALUE",
  "INPUT_CHECKED",
  "INPUT_FILES",
  "SELECT_INDEX",
  "ACTIVATION",
]);
export interface W14NativeWitness {
  sequence: number;
  surface: string;
  key: string;
  tag: string;
  type: string;
  succeeded: boolean;
  value_digest: string | null;
}
export interface W14NativeWitnessAudit {
  format_version: "W14_NATIVE_WITNESS_1";
  source: typeof W14_NATIVE_WITNESS_SOURCE;
  realm: "ACTUAL_EXTENSION_CONTENT_SCRIPT";
  coverage: "COMPLETE_INSTALLED_NATIVE_SURFACES";
  surfaces: string[];
  native_mutation_count: number;
  interaction_count: number;
  witnesses: W14NativeWitness[];
  witnesses_digest: string;
  limitations: string[];
}
export interface W14NativeWitnessHandle {
  /** Exposed only for actual isolated-world regression injection. */
  readonly session: CDPSession;
  readonly contextId: number;
  snapshot(): Promise<W14NativeWitnessAudit>;
  dispose(): Promise<void>;
}

/** Serialized into the selected isolated realm. All references stay local. */
function installInRealm(bindingName: string, stateName: string): void {
  const global = globalThis as unknown as Record<string, unknown>;
  if (global[stateName] !== undefined)
    throw new Error("W14_NATIVE_ALREADY_INSTALLED");
  const send = global[bindingName];
  if (typeof send !== "function") throw new Error("W14_NATIVE_BINDING_MISSING");
  const restorers: (() => void)[] = [];
  const checks: (() => boolean)[] = [];
  const surfaces: string[] = [];
  let sequence = 0;
  const emit = (
    element: unknown,
    surface: string,
    value: unknown,
    succeeded: boolean,
    number: number,
  ) => {
    const node = element instanceof Element ? element : null;
    // Native setter values are immediately hashed by the independent Node
    // collector; no raw value is retained in the artifact or browser state.
    Reflect.apply(send, globalThis, [
      JSON.stringify({
        sequence: number,
        surface,
        key: node?.id ?? "",
        tag: node?.tagName ?? "",
        type: node instanceof HTMLInputElement ? node.type : "",
        succeeded,
        value:
          typeof value === "string" ||
          typeof value === "boolean" ||
          typeof value === "number"
            ? value
            : null,
      }),
    ]);
  };
  const setter = (prototype: object, property: string, surface: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    // The captured native accessor is deliberately rebound to each host.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const native = descriptor?.set;
    if (
      descriptor === undefined ||
      native === undefined ||
      !descriptor.configurable
    )
      throw new Error("W14_NATIVE_SETTER_UNAVAILABLE");
    const wrapped = function (this: unknown, value: unknown) {
      const number = ++sequence;
      let succeeded = false;
      try {
        Reflect.apply(native, this, [value]);
        succeeded = true;
      } finally {
        emit(this, surface, value, succeeded, number);
      }
    };
    Object.defineProperty(prototype, property, { ...descriptor, set: wrapped });
    checks.push(
      () =>
        Object.getOwnPropertyDescriptor(prototype, property)?.set === wrapped,
    );
    restorers.push(() => {
      if (Object.getOwnPropertyDescriptor(prototype, property)?.set === wrapped)
        Object.defineProperty(prototype, property, descriptor);
    });
    surfaces.push(surface);
  };
  const method = (prototype: object, property: string, surface: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    const native: unknown = descriptor?.value;
    if (
      descriptor === undefined ||
      typeof native !== "function" ||
      !descriptor.configurable
    )
      throw new Error("W14_NATIVE_METHOD_UNAVAILABLE");
    const wrapped = function (this: unknown, ...args: unknown[]) {
      const number = ++sequence;
      let succeeded = false;
      try {
        const result: unknown = Reflect.apply(native, this, args);
        succeeded = true;
        return result;
      } finally {
        emit(this, surface, null, succeeded, number);
      }
    };
    Object.defineProperty(prototype, property, {
      ...descriptor,
      value: wrapped,
    });
    checks.push(
      () =>
        Object.getOwnPropertyDescriptor(prototype, property)?.value === wrapped,
    );
    restorers.push(() => {
      if (
        Object.getOwnPropertyDescriptor(prototype, property)?.value === wrapped
      )
        Object.defineProperty(prototype, property, descriptor);
    });
    surfaces.push(surface);
  };
  try {
    setter(HTMLInputElement.prototype, "value", "INPUT_VALUE");
    setter(HTMLTextAreaElement.prototype, "value", "TEXTAREA_VALUE");
    setter(HTMLSelectElement.prototype, "value", "SELECT_VALUE");
    setter(HTMLInputElement.prototype, "checked", "INPUT_CHECKED");
    setter(HTMLInputElement.prototype, "files", "INPUT_FILES");
    setter(HTMLSelectElement.prototype, "selectedIndex", "SELECT_INDEX");
    setter(Element.prototype, "scrollTop", "SCROLL_TOP");
    method(HTMLElement.prototype, "click", "ACTIVATION");
    method(HTMLElement.prototype, "focus", "FOCUS");
    method(HTMLElement.prototype, "blur", "BLUR");
    method(EventTarget.prototype, "dispatchEvent", "EVENT_DISPATCH");
    global[stateName] = {
      snapshot: () => ({
        sequence,
        surfaces,
        intact: checks.every((check) => check()),
      }),
      restore: () => {
        for (const restore of restorers.reverse()) restore();
        Reflect.deleteProperty(global, stateName);
      },
    };
  } catch (error) {
    for (const restore of restorers.reverse()) restore();
    throw error;
  }
}

function parsedWitness(payload: string): W14NativeWitness {
  const raw: unknown = JSON.parse(payload);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("W14_NATIVE_WITNESS_SHAPE");
  const value = raw as Record<string, unknown>;
  if (
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 1 ||
    typeof value.surface !== "string" ||
    typeof value.key !== "string" ||
    typeof value.tag !== "string" ||
    typeof value.type !== "string" ||
    typeof value.succeeded !== "boolean" ||
    value.key.length > 1024 ||
    value.surface.length > 64 ||
    value.tag.length > 64 ||
    value.type.length > 64 ||
    !(
      value.value === null ||
      typeof value.value === "string" ||
      typeof value.value === "boolean" ||
      typeof value.value === "number"
    )
  )
    throw new Error("W14_NATIVE_WITNESS_SHAPE");
  return {
    sequence: Number(value.sequence),
    surface: value.surface,
    key: value.key,
    tag: value.tag,
    type: value.type,
    succeeded: value.succeeded,
    value_digest: value.value === null ? null : sha256Canonical(value.value),
  };
}

export async function installW14NativeWitness(
  browser: BrowserContext,
  page: Page,
  extensionId: string,
): Promise<W14NativeWitnessHandle> {
  const session = await browser.newCDPSession(page);
  const contextIds: number[] = [];
  session.on(
    "Runtime.executionContextCreated",
    (event: { context: { id: number } }) => contextIds.push(event.context.id),
  );
  await session.send("Runtime.enable");
  const matches: number[] = [];
  for (const contextId of contextIds) {
    const response = await session.send("Runtime.evaluate", {
      contextId,
      expression: `typeof chrome !== 'undefined' && chrome.runtime?.id === ${JSON.stringify(extensionId)}`,
      returnByValue: true,
    });
    if (response.result.value === true) matches.push(contextId);
  }
  const contextId = matches[0];
  if (matches.length !== 1 || contextId === undefined) {
    await session.detach();
    throw new Error("W14_NATIVE_EXACT_EXTENSION_REALM_REQUIRED");
  }
  const suffix = randomUUID().replaceAll("-", "");
  const bindingName = `jappW14NativeWitness${suffix}`;
  const stateName = `jappW14NativeState${suffix}`;
  const witnesses: W14NativeWitness[] = [];
  let failure: Error | undefined;
  session.on(
    "Runtime.bindingCalled",
    (event: { name: string; payload: string; executionContextId: number }) => {
      if (event.name !== bindingName || event.executionContextId !== contextId)
        return;
      try {
        if (witnesses.length >= MAX_WITNESSES)
          throw new Error("W14_NATIVE_WITNESS_CAPACITY");
        witnesses.push(parsedWitness(event.payload));
      } catch (error) {
        failure =
          error instanceof Error
            ? error
            : new Error("W14_NATIVE_WITNESS_SHAPE");
      }
    },
  );
  const evaluate = async (expression: string) => {
    const response = await session.send("Runtime.evaluate", {
      contextId,
      expression,
      returnByValue: true,
    });
    if (response.exceptionDetails !== undefined)
      throw new Error("W14_NATIVE_REALM_EXECUTION_FAILED");
    return response.result.value as unknown;
  };
  await session.send("Runtime.addBinding", {
    name: bindingName,
    executionContextId: contextId,
  });
  try {
    await evaluate(
      `(${installInRealm.toString()})(${JSON.stringify(bindingName)},${JSON.stringify(stateName)})`,
    );
  } catch (error) {
    await session.send("Runtime.removeBinding", { name: bindingName });
    await session.detach();
    throw error;
  }
  return {
    session,
    contextId,
    async snapshot() {
      const raw = await evaluate(
        `globalThis[${JSON.stringify(stateName)}].snapshot()`,
      );
      if (failure !== undefined) throw failure;
      if (raw === null || typeof raw !== "object")
        throw new Error("W14_NATIVE_WITNESS_INCOMPLETE");
      const state = raw as {
        sequence?: unknown;
        intact?: unknown;
        surfaces?: unknown;
      };
      const ordered = [...witnesses].sort((a, b) => a.sequence - b.sequence);
      if (
        state.intact !== true ||
        state.sequence !== ordered.length ||
        ordered.some((item, index) => item.sequence !== index + 1) ||
        !Array.isArray(state.surfaces) ||
        !state.surfaces.every((surface: unknown) => typeof surface === "string")
      )
        throw new Error("W14_NATIVE_WITNESS_INCOMPLETE");
      return {
        format_version: "W14_NATIVE_WITNESS_1",
        source: W14_NATIVE_WITNESS_SOURCE,
        realm: "ACTUAL_EXTENSION_CONTENT_SCRIPT",
        coverage: "COMPLETE_INSTALLED_NATIVE_SURFACES",
        surfaces: [...state.surfaces] as string[],
        native_mutation_count: ordered.filter((item) =>
          MUTATION_SURFACES.has(item.surface),
        ).length,
        interaction_count: ordered.filter(
          (item) => !MUTATION_SURFACES.has(item.surface),
        ).length,
        witnesses: ordered,
        witnesses_digest: sha256Canonical(ordered),
        limitations: [
          "Test-only prototype wrappers in the single actual extension realm; main-world page mutations are separate site behavior.",
          "Counts attempted calls to installed native surfaces; browser-internal effects of an activation are represented by that activation.",
          "No claim covers retained pre-install native references, other realms, uninstalled mutation APIs, closed shadow roots, or live employer forms.",
        ],
      };
    },
    async dispose() {
      try {
        await evaluate(`globalThis[${JSON.stringify(stateName)}]?.restore()`);
      } finally {
        await session.send("Runtime.removeBinding", { name: bindingName });
        await session.detach();
      }
    },
  };
}

/** Exact W14 native-action subset; framework event counts stay unchanged. */
export function nativeMutationWitnesses(
  audit: W14NativeWitnessAudit,
): W14NativeWitness[] {
  return audit.witnesses.filter((item) => MUTATION_SURFACES.has(item.surface));
}
