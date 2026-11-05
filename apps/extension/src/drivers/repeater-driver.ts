// M02-W10 bounded repeater feasibility driver. It recognizes only the
// reviewed synthetic data-japp repeater contract, uses exact stable item
// labels, and never derives identity from DOM order or a caller expression.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import {
  repeaterObservation,
  observationsEquivalent,
  type SemanticObservation,
} from "../driver-evidence.ts";
import type { DriverIntendedValue } from "../driver-protocol.ts";
import {
  isElementEnabled,
  isElementVisible,
  normalizeScannerText,
  type ResolvedFieldTarget,
} from "../field-scanner.ts";
import { activateElement, setNativeValue } from "./driver-dom.ts";
import { mutateCurrent } from "./mutation-guard.ts";
import type {
  CapturedUndo,
  ControlDriver,
  DriverContext,
  PreconditionOutcome,
} from "./driver-contract.ts";

type RepeaterIntended = Extract<
  DriverIntendedValue,
  {
    readonly kind: "REPEATER_ADD" | "REPEATER_EDIT" | "REPEATER_REMOVE";
  }
>;

function repeaterAnchor(anchor: HTMLElement): HTMLInputElement | null {
  return anchor instanceof HTMLInputElement &&
    anchor.hasAttribute("data-japp-repeater-controller")
    ? anchor
    : null;
}

function requireRepeaterAnchor(context: DriverContext): HTMLInputElement {
  const anchor = repeaterAnchor(context.target.anchor);
  if (anchor === null) {
    throw new Error("repeater driver invariant: controller unavailable");
  }
  return anchor;
}

function repeaterRoot(context: DriverContext): HTMLElement {
  const root = requireRepeaterAnchor(context).closest<HTMLElement>(
    "[data-japp-repeater]",
  );
  if (root === null) {
    throw new Error("repeater driver invariant: root unavailable");
  }
  return root;
}

function requireCurrentRepeater(
  current: ResolvedFieldTarget,
  root: HTMLElement,
  action: HTMLElement,
): void {
  if (
    current.anchor.closest("[data-japp-repeater]") !== root ||
    action.closest("[data-japp-repeater]") !== root
  )
    throw new Error("repeater driver invariant: current root changed");
}

function intendedRepeater(context: DriverContext): RepeaterIntended {
  if (!context.intended.kind.startsWith("REPEATER_")) {
    throw new Error(
      "repeater driver invariant: intended operation unavailable",
    );
  }
  return context.intended as RepeaterIntended;
}

function exactItems(root: HTMLElement, itemLabel: string): HTMLElement[] {
  const normalized = normalizeScannerText(itemLabel);
  return [
    ...root.querySelectorAll<HTMLElement>("[data-japp-repeater-item]"),
  ].filter(
    (item) =>
      normalizeScannerText(item.getAttribute("data-japp-item-label")) ===
      normalized,
  );
}

function exactActions(
  root: HTMLElement,
  action: "ADD" | "REMOVE",
  itemLabel: string,
): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      `[data-japp-repeater-action='${action}']`,
    ),
  ].filter((element) => {
    if (action === "ADD") {
      return true;
    }
    return (
      normalizeScannerText(element.getAttribute("data-japp-item-label")) ===
      normalizeScannerText(itemLabel)
    );
  });
}

function editableHost(
  item: HTMLElement,
): HTMLInputElement | HTMLTextAreaElement | null {
  const candidates = [
    ...item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[data-japp-repeater-value],textarea[data-japp-repeater-value]",
    ),
  ];
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function operation(intended: RepeaterIntended): "ADD" | "EDIT" | "REMOVE" {
  return intended.kind.slice("REPEATER_".length) as "ADD" | "EDIT" | "REMOVE";
}

function observeRepeater(context: DriverContext): SemanticObservation {
  const intended = intendedRepeater(context);
  const op = operation(intended);
  const items = exactItems(repeaterRoot(context), intended.item_label);
  if (op === "REMOVE") {
    return repeaterObservation(
      op,
      intended.item_label,
      items.length === 0 ? "\0ABSENT\0" : "PRESENT",
    );
  }
  if (items.length !== 1) {
    return repeaterObservation(
      op,
      intended.item_label,
      items.length === 0 ? "\0ABSENT\0" : "AMBIGUOUS",
    );
  }
  if (op === "ADD") {
    return repeaterObservation(op, intended.item_label, "PRESENT");
  }
  const only = items[0];
  if (only === undefined) {
    throw new Error("repeater driver invariant: unique item unavailable");
  }
  const editor = editableHost(only);
  return repeaterObservation(
    op,
    intended.item_label,
    editor === null ? "\0ABSENT\0" : editor.value,
  );
}

function actionable(element: HTMLElement | undefined): element is HTMLElement {
  return (
    element !== undefined &&
    isElementVisible(element) &&
    isElementEnabled(element)
  );
}

export const repeaterDriver: ControlDriver = {
  driverKey: "SYNTHETIC_REPEATER_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind.startsWith("REPEATER_") &&
      (descriptor.control_kind === "TEXT" ||
        descriptor.control_kind === "TEXTAREA") &&
      repeaterAnchor(anchor) !== null
    );
  },
  checkPreconditions(context: DriverContext): Promise<PreconditionOutcome> {
    const intended = intendedRepeater(context);
    const root = repeaterRoot(context);
    const items = exactItems(root, intended.item_label);
    if (intended.kind === "REPEATER_ADD") {
      const actions = exactActions(root, "ADD", intended.item_label);
      return Promise.resolve(
        items.length === 0 && actions.length === 1 && actionable(actions[0])
          ? { ok: true, alreadySatisfied: false }
          : { ok: false },
      );
    }
    if (items.length !== 1) {
      return Promise.resolve({ ok: false });
    }
    if (intended.kind === "REPEATER_EDIT") {
      const only = items[0];
      if (only === undefined) {
        return Promise.resolve({ ok: false });
      }
      const editor = editableHost(only);
      return Promise.resolve(
        editor !== null && actionable(editor)
          ? { ok: true, alreadySatisfied: editor.value === intended.text }
          : { ok: false },
      );
    }
    const actions = exactActions(root, "REMOVE", intended.item_label);
    return Promise.resolve(
      actions.length === 1 && actionable(actions[0])
        ? { ok: true, alreadySatisfied: false }
        : { ok: false },
    );
  },
  captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const intended = intendedRepeater(context);
    const prior = observeRepeater(context);
    if (intended.kind === "REPEATER_ADD") {
      return Promise.resolve({
        restorable: true,
        priorObservation: prior,
        payload: { kind: "REMOVE_ADDED" },
      });
    }
    if (intended.kind === "REPEATER_EDIT") {
      const item = exactItems(repeaterRoot(context), intended.item_label)[0];
      const editor = item === undefined ? null : editableHost(item);
      return Promise.resolve({
        restorable: editor !== null,
        priorObservation: prior,
        payload: editor?.value ?? null,
      });
    }
    return Promise.resolve({
      restorable: false,
      priorObservation: prior,
      payload: null,
    });
  },
  async execute(context: DriverContext): Promise<void> {
    const intended = intendedRepeater(context);
    const root = repeaterRoot(context);
    if (intended.kind === "REPEATER_ADD") {
      const action = exactActions(root, "ADD", intended.item_label)[0];
      if (!actionable(action)) {
        throw new Error("repeater driver invariant: add action changed");
      }
      const anchor = requireRepeaterAnchor(context);
      await mutateCurrent(context, anchor, (current) => {
        requireCurrentRepeater(current, root, anchor);
        setNativeValue(anchor, intended.item_label);
      });
      await mutateCurrent(context, action, (current) => {
        requireCurrentRepeater(current, root, action);
        const actions = exactActions(root, "ADD", intended.item_label);
        if (actions.length !== 1 || actions[0] !== action)
          throw new Error("repeater driver invariant: add action changed");
        activateElement(action);
      });
      return;
    }
    const item = exactItems(root, intended.item_label)[0];
    if (item === undefined) {
      throw new Error("repeater driver invariant: item changed");
    }
    if (intended.kind === "REPEATER_EDIT") {
      const editor = editableHost(item);
      if (editor === null) {
        throw new Error("repeater driver invariant: editor changed");
      }
      await mutateCurrent(context, editor, (current) => {
        requireCurrentRepeater(current, root, editor);
        const items = exactItems(root, intended.item_label);
        if (
          items.length !== 1 ||
          items[0] !== item ||
          editableHost(item) !== editor
        )
          throw new Error("repeater driver invariant: current editor changed");
        setNativeValue(editor, intended.text);
      });
      return;
    }
    const action = exactActions(root, "REMOVE", intended.item_label)[0];
    if (!actionable(action)) {
      throw new Error("repeater driver invariant: remove action changed");
    }
    await mutateCurrent(context, action, (current) => {
      requireCurrentRepeater(current, root, action);
      const actions = exactActions(root, "REMOVE", intended.item_label);
      if (actions.length !== 1 || actions[0] !== action)
        throw new Error("repeater driver invariant: remove action changed");
      activateElement(action);
    });
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return Promise.resolve(observeRepeater(context));
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const intended = intendedRepeater(context);
    const root = repeaterRoot(context);
    if (
      intended.kind === "REPEATER_ADD" &&
      typeof payload === "object" &&
      payload !== null &&
      (payload as { readonly kind?: unknown }).kind === "REMOVE_ADDED"
    ) {
      const action = exactActions(root, "REMOVE", intended.item_label)[0];
      if (!actionable(action)) {
        throw new Error("repeater driver invariant: undo action unavailable");
      }
      await mutateCurrent(context, action, (current) => {
        requireCurrentRepeater(current, root, action);
        const actions = exactActions(root, "REMOVE", intended.item_label);
        if (actions.length !== 1 || actions[0] !== action)
          throw new Error("repeater driver invariant: undo action changed");
        activateElement(action);
      });
      return;
    }
    if (intended.kind === "REPEATER_EDIT" && typeof payload === "string") {
      const item = exactItems(root, intended.item_label)[0];
      const editor = item === undefined ? null : editableHost(item);
      if (item === undefined || editor === null) {
        throw new Error("repeater driver invariant: undo editor unavailable");
      }
      await mutateCurrent(context, editor, (current) => {
        requireCurrentRepeater(current, root, editor);
        const items = exactItems(root, intended.item_label);
        if (
          items.length !== 1 ||
          items[0] !== item ||
          editableHost(item) !== editor
        )
          throw new Error(
            "repeater driver invariant: current undo editor changed",
          );
        setNativeValue(editor, payload);
      });
      return;
    }
    throw new Error("repeater driver invariant: undo payload malformed");
  },
  captureObservationWitness(context: DriverContext): () => boolean {
    const observed = observeRepeater(context);
    return () => observationsEquivalent(observed, observeRepeater(context));
  },
  acceptanceElements(context: DriverContext): readonly HTMLElement[] {
    return [repeaterRoot(context)];
  },
};
