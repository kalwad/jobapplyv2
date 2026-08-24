// M02-W10 choice-family drivers: native single select, native radio group,
// and native checkbox.
//
// The intended option arrives from W09 as an inert semantic identity (the
// option's value digest); these drivers verify the exact intended option
// exists, is unambiguous, and is enabled in the CURRENT re-resolved control
// before acting, and never fall back to the first, only, closest, or
// placeholder option.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import type { DriverIntendedValue } from "../driver-protocol.ts";
import {
  checkedObservation,
  optionObservation,
  type SemanticObservation,
} from "../driver-evidence.ts";
import {
  activateElement,
  dispatchChange,
  optionValueDigest,
  setNativeValue,
} from "./driver-dom.ts";
import type {
  CapturedUndo,
  ControlDriver,
  DriverContext,
  PreconditionOutcome,
} from "./driver-contract.ts";

function intendedOptionDigest(intended: DriverIntendedValue): string {
  if (intended.kind !== "OPTION") {
    throw new Error("choice driver invariant: intended value is not OPTION");
  }
  return intended.value_digest;
}

// ------------------------------------------------------------ native select

function selectHost(anchor: HTMLElement): HTMLSelectElement | null {
  return anchor instanceof HTMLSelectElement && !anchor.multiple
    ? anchor
    : null;
}

function requireSelectHost(context: DriverContext): HTMLSelectElement {
  const host = selectHost(context.target.anchor);
  if (host === null) {
    throw new Error("select driver invariant: anchor is not a native select");
  }
  return host;
}

interface SelectMatch {
  readonly value: string;
  readonly enabled: boolean;
}

async function matchSelectOption(
  host: HTMLSelectElement,
  digest: string,
): Promise<SelectMatch | null> {
  const matches: SelectMatch[] = [];
  const seenValues = new Set<string>();
  for (const option of host.options) {
    if (seenValues.has(option.value)) {
      continue;
    }
    seenValues.add(option.value);
    if ((await optionValueDigest(option.value)) === digest) {
      matches.push({
        value: option.value,
        enabled: !(
          option.disabled || option.closest("optgroup:disabled") !== null
        ),
      });
    }
  }
  // The digest is injective over the option value, so more than one entry
  // here is impossible; a missing entry means the intended option is not in
  // the current control.
  return matches[0] ?? null;
}

export const nativeSelectDriver: ControlDriver = {
  driverKey: "NATIVE_SELECT_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "OPTION" &&
      descriptor.control_kind === "SELECT" &&
      selectHost(anchor) !== null
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const host = requireSelectHost(context);
    const match = await matchSelectOption(
      host,
      intendedOptionDigest(context.intended),
    );
    if (!match?.enabled) {
      // Missing or disabled intended option: no fill, no substitute.
      return { ok: false };
    }
    return {
      ok: true,
      alreadySatisfied: host.selectedIndex >= 0 && host.value === match.value,
    };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const host = requireSelectHost(context);
    const priorValue = host.selectedIndex >= 0 ? host.value : null;
    return {
      restorable: true,
      priorObservation: optionObservation(
        priorValue === null ? null : await optionValueDigest(priorValue),
      ),
      payload: priorValue,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    const host = requireSelectHost(context);
    const match = await matchSelectOption(
      host,
      intendedOptionDigest(context.intended),
    );
    if (!match?.enabled) {
      throw new Error("select driver invariant: intended option vanished");
    }
    setNativeValue(host, match.value);
  },
  async observe(context: DriverContext): Promise<SemanticObservation> {
    const host = requireSelectHost(context);
    return optionObservation(
      host.selectedIndex >= 0 ? await optionValueDigest(host.value) : null,
    );
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const host = requireSelectHost(context);
    if (payload === null) {
      setNativeValue(host, "");
      host.selectedIndex = -1;
      return Promise.resolve();
    }
    if (typeof payload !== "string") {
      throw new Error("select driver invariant: undo payload malformed");
    }
    setNativeValue(host, payload);
    return Promise.resolve();
  },
};

// -------------------------------------------------------------- radio group

function radioMembers(context: DriverContext): HTMLInputElement[] | null {
  const members: HTMLInputElement[] = [];
  for (const member of context.target.members) {
    if (
      !(member instanceof HTMLInputElement) ||
      member.type.toLowerCase() !== "radio"
    ) {
      return null;
    }
    members.push(member);
  }
  return members.length > 0 ? members : null;
}

async function matchRadioMembers(
  members: readonly HTMLInputElement[],
  digest: string,
): Promise<HTMLInputElement[]> {
  const matches: HTMLInputElement[] = [];
  for (const member of members) {
    if ((await optionValueDigest(member.value)) === digest) {
      matches.push(member);
    }
  }
  return matches;
}

export const radioGroupDriver: ControlDriver = {
  driverKey: "RADIO_GROUP_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "OPTION" &&
      descriptor.control_kind === "RADIO_GROUP" &&
      anchor instanceof HTMLInputElement &&
      anchor.type.toLowerCase() === "radio"
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const members = radioMembers(context);
    if (members === null) {
      return { ok: false };
    }
    const matches = await matchRadioMembers(
      members,
      intendedOptionDigest(context.intended),
    );
    // Exact option identity: exactly one semantic member, enabled. A
    // duplicated semantic option in the group must not execute.
    if (matches.length !== 1) {
      return { ok: false };
    }
    const member = matches[0];
    if (member === undefined || member.disabled) {
      return { ok: false };
    }
    return { ok: true, alreadySatisfied: member.checked };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const members = radioMembers(context) ?? [];
    const checked = members.find((member) => member.checked);
    return {
      restorable: true,
      priorObservation: optionObservation(
        checked === undefined ? null : await optionValueDigest(checked.value),
      ),
      payload: checked === undefined ? null : checked.value,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    const members = radioMembers(context) ?? [];
    const matches = await matchRadioMembers(
      members,
      intendedOptionDigest(context.intended),
    );
    const member = matches.length === 1 ? matches[0] : undefined;
    if (member === undefined || member.disabled) {
      throw new Error("radio driver invariant: intended member vanished");
    }
    if (!member.checked) {
      activateElement(member);
    }
  },
  async observe(context: DriverContext): Promise<SemanticObservation> {
    const members = radioMembers(context) ?? [];
    const checked = members.find((member) => member.checked);
    return optionObservation(
      checked === undefined ? null : await optionValueDigest(checked.value),
    );
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const members = radioMembers(context) ?? [];
    if (payload === null) {
      for (const member of members) {
        if (member.checked) {
          member.checked = false;
          dispatchChange(member);
        }
      }
      return Promise.resolve();
    }
    if (typeof payload !== "string") {
      throw new Error("radio driver invariant: undo payload malformed");
    }
    const prior = members.find((member) => member.value === payload);
    if (prior === undefined) {
      throw new Error("radio driver invariant: prior member vanished");
    }
    if (!prior.checked) {
      activateElement(prior);
    }
    return Promise.resolve();
  },
};

// ---------------------------------------------------------------- checkbox

function checkboxHost(anchor: HTMLElement): HTMLInputElement | null {
  return anchor instanceof HTMLInputElement &&
    anchor.type.toLowerCase() === "checkbox"
    ? anchor
    : null;
}

function requireCheckboxHost(context: DriverContext): HTMLInputElement {
  const host = checkboxHost(context.target.anchor);
  if (host === null) {
    throw new Error("checkbox driver invariant: anchor is not a checkbox");
  }
  return host;
}

function intendedChecked(context: DriverContext): boolean {
  if (context.intended.kind !== "CHECKED") {
    throw new Error("checkbox driver invariant: intended value is not CHECKED");
  }
  return context.intended.checked;
}

export const checkboxDriver: ControlDriver = {
  driverKey: "CHECKBOX_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "CHECKED" &&
      descriptor.control_kind === "CHECKBOX" &&
      checkboxHost(anchor) !== null
    );
  },
  checkPreconditions(context: DriverContext): Promise<PreconditionOutcome> {
    return Promise.resolve({
      ok: true,
      alreadySatisfied:
        requireCheckboxHost(context).checked === intendedChecked(context),
    });
  },
  captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const prior = requireCheckboxHost(context).checked;
    return Promise.resolve({
      restorable: true,
      priorObservation: checkedObservation(prior),
      payload: prior,
    });
  },
  execute(context: DriverContext): Promise<void> {
    const host = requireCheckboxHost(context);
    if (host.checked !== intendedChecked(context)) {
      activateElement(host);
    }
    return Promise.resolve();
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return Promise.resolve(
      checkedObservation(requireCheckboxHost(context).checked),
    );
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (typeof payload !== "boolean") {
      throw new Error("checkbox driver invariant: undo payload malformed");
    }
    const host = requireCheckboxHost(context);
    if (host.checked !== payload) {
      activateElement(host);
    }
    return Promise.resolve();
  },
};
