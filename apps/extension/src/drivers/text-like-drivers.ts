// M02-W10 text-family drivers: ordinary native text controls and native
// date inputs.
//
// One text driver deliberately owns BOTH the NativeText and the
// FrameworkControlledText architecture families: extension isolated worlds
// cannot observe page-world framework internals (React fibers, Vue
// instances live in a different JS world), so framework detection from
// content-script code is impossible by construction, and the execution
// semantics that satisfy real frameworks — the native prototype value
// setter plus the bubbling input/change pair — are exactly the semantics
// ordinary native controls require. The framework distinction is proven
// behaviorally by the React/Vue rerender-persistence browser matrices, and
// a stale direct DOM write can never satisfy the transaction because the
// settled observation happens after the framework's own rerender.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import type { DriverIntendedValue } from "../driver-protocol.ts";
import {
  dateObservation,
  textObservation,
  type SemanticObservation,
} from "../driver-evidence.ts";
import { setNativeValue } from "./driver-dom.ts";
import type {
  CapturedUndo,
  ControlDriver,
  DriverContext,
  PreconditionOutcome,
} from "./driver-contract.ts";

const TEXT_INPUT_TYPES = new Set([
  "text",
  "email",
  "tel",
  "url",
  "search",
  "number",
]);

function textHost(
  anchor: HTMLElement,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (anchor instanceof HTMLTextAreaElement) {
    return anchor;
  }
  if (
    anchor instanceof HTMLInputElement &&
    TEXT_INPUT_TYPES.has(anchor.type.toLowerCase())
  ) {
    return anchor;
  }
  return null;
}

function requireTextHost(
  context: DriverContext,
): HTMLInputElement | HTMLTextAreaElement {
  const host = textHost(context.target.anchor);
  if (host === null) {
    throw new Error("text driver invariant: anchor is not a text control");
  }
  return host;
}

function intendedText(context: DriverContext): string {
  if (context.intended.kind !== "TEXT") {
    throw new Error("text driver invariant: intended value is not TEXT");
  }
  return context.intended.text;
}

function writeText(
  host: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  // Real focus, framework-observable value change, real blur: the minimal
  // faithful interaction envelope, including site-side blur rewrites.
  host.focus();
  setNativeValue(host, value);
  host.blur();
}

export const textDriver: ControlDriver = {
  driverKey: "TEXT_INPUT_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "TEXT" &&
      (descriptor.control_kind === "TEXT" ||
        descriptor.control_kind === "TEXTAREA") &&
      textHost(anchor) !== null
    );
  },
  checkPreconditions(context: DriverContext): Promise<PreconditionOutcome> {
    const host = requireTextHost(context);
    return Promise.resolve({
      ok: true,
      alreadySatisfied: host.value === intendedText(context),
    });
  },
  captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const prior = requireTextHost(context).value;
    return Promise.resolve({
      restorable: true,
      priorObservation: textObservation(prior),
      payload: prior,
    });
  },
  execute(context: DriverContext): Promise<void> {
    writeText(requireTextHost(context), intendedText(context));
    return Promise.resolve();
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return Promise.resolve(textObservation(requireTextHost(context).value));
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (typeof payload !== "string") {
      throw new Error("text driver invariant: undo payload is not a string");
    }
    writeText(requireTextHost(context), payload);
    return Promise.resolve();
  },
};

function dateHost(anchor: HTMLElement): HTMLInputElement | null {
  return anchor instanceof HTMLInputElement &&
    anchor.type.toLowerCase() === "date"
    ? anchor
    : null;
}

function requireDateHost(context: DriverContext): HTMLInputElement {
  const host = dateHost(context.target.anchor);
  if (host === null) {
    throw new Error("date driver invariant: anchor is not a date input");
  }
  return host;
}

export const dateDriver: ControlDriver = {
  driverKey: "DATE_INPUT_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "DATE" &&
      descriptor.control_kind === "DATE" &&
      dateHost(anchor) !== null
    );
  },
  checkPreconditions(context: DriverContext): Promise<PreconditionOutcome> {
    if (context.intended.kind !== "DATE") {
      return Promise.resolve({ ok: false });
    }
    return Promise.resolve({
      ok: true,
      alreadySatisfied:
        requireDateHost(context).value === context.intended.iso_date,
    });
  },
  captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const prior = requireDateHost(context).value;
    return Promise.resolve({
      restorable: true,
      priorObservation: dateObservation(prior),
      payload: prior,
    });
  },
  execute(context: DriverContext): Promise<void> {
    if (context.intended.kind !== "DATE") {
      throw new Error("date driver invariant: intended value is not DATE");
    }
    // The exact intended ISO date only; no semantic inference or repair.
    // A site-invalid date (for example outside min/max) still executes and
    // is then honestly rejected by the site-acceptance postcondition.
    writeText(requireDateHost(context), context.intended.iso_date);
    return Promise.resolve();
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return Promise.resolve(dateObservation(requireDateHost(context).value));
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (typeof payload !== "string") {
      throw new Error("date driver invariant: undo payload is not a string");
    }
    writeText(requireDateHost(context), payload);
    return Promise.resolve();
  },
};
