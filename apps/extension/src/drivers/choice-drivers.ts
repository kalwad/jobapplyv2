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
import { normalizeText } from "../field-scanner.ts";
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
  OptionMeaningApproval,
} from "./driver-contract.ts";
import { mutateCurrent } from "./mutation-guard.ts";

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

/** Kernel-private meaning of a W09-approved static native choice. A raw
 * value alone is insufficient when an ATS uses opaque option values. */

export function optionMeaningApproval(
  descriptor: FormFieldDescriptorV1,
  intended: DriverIntendedValue,
): OptionMeaningApproval | undefined {
  if (intended.kind !== "OPTION") return undefined;
  const matches = descriptor.options.filter(
    (option) => option.value_digest === intended.value_digest,
  );
  const option = matches.length === 1 ? matches[0] : undefined;
  return option === undefined
    ? undefined
    : {
        valueDigest: option.value_digest,
        labelDigest: option.label.text_digest,
        disabled: option.disabled,
      };
}

export function optionMeaningApprovalMatches(
  approval: OptionMeaningApproval,
  descriptor: FormFieldDescriptorV1,
): boolean {
  const current = optionMeaningApproval(descriptor, {
    kind: "OPTION",
    value_digest: approval.valueDigest,
  });
  return (
    current?.labelDigest === approval.labelDigest &&
    current.disabled === approval.disabled
  );
}

interface SelectMatch {
  readonly value: string;
  readonly label: string;
  readonly enabled: boolean;
}

async function matchSelectOption(
  host: HTMLSelectElement,
  digest: string,
): Promise<SelectMatch | null> {
  const matches: SelectMatch[] = [];
  const seenValues = new Set<string>();
  for (const option of host.options) {
    const value = option.value;
    if (seenValues.has(value)) {
      // A repeated raw value cannot identify one physical option safely.
      if (matches.some((match) => match.value === value)) return null;
      continue;
    }
    seenValues.add(value);
    if ((await optionValueDigest(value)) === digest && option.value === value) {
      matches.push({
        value,
        label: normalizeText(option.textContent),
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
    const prior = host.selectedIndex >= 0 ? host.selectedOptions[0] : undefined;
    const snapshot =
      prior === undefined
        ? null
        : {
            value: prior.value,
            label: normalizeText(prior.textContent),
            disabled:
              prior.disabled || prior.closest("optgroup:disabled") !== null,
          };
    const priorObservation = optionObservation(
      snapshot === null ? null : await optionValueDigest(snapshot.value),
    );
    return {
      restorable:
        snapshot === null ||
        (prior?.value === snapshot.value &&
          normalizeText(prior.textContent) === snapshot.label &&
          (prior.disabled || prior.closest("optgroup:disabled") !== null) ===
            snapshot.disabled),
      priorObservation,
      payload: snapshot,
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
    await mutateCurrent(context, host, () => {
      const options = [...host.options].filter(
        (item) => item.value === match.value,
      );
      const option = options.length === 1 ? options[0] : undefined;
      if (
        option === undefined ||
        normalizeText(option.textContent) !== match.label ||
        option.disabled ||
        option.closest("optgroup:disabled") !== null
      )
        throw new Error("select driver invariant: intended option changed");
      setNativeValue(host, match.value);
    });
  },
  captureObservationWitness(context: DriverContext): () => boolean {
    const host = requireSelectHost(context);
    return () => {
      const selected = host.selectedOptions[0];
      return (
        selected === undefined ||
        [...host.options].filter((option) => option.value === selected.value)
          .length === 1
      );
    };
  },
  async observe(context: DriverContext): Promise<SemanticObservation> {
    const host = requireSelectHost(context);
    return optionObservation(
      host.selectedIndex >= 0 ? await optionValueDigest(host.value) : null,
    );
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const host = requireSelectHost(context);
    if (payload === null) {
      await mutateCurrent(context, host, () => {
        setNativeValue(host, "");
      });
      await mutateCurrent(context, host, () => {
        host.selectedIndex = -1;
      });
      return;
    }
    if (
      typeof payload !== "object" ||
      !("value" in payload) ||
      typeof payload.value !== "string" ||
      !("label" in payload) ||
      typeof payload.label !== "string" ||
      !("disabled" in payload) ||
      typeof payload.disabled !== "boolean"
    ) {
      throw new Error("select driver invariant: undo payload malformed");
    }
    const priorValue = payload.value;
    await mutateCurrent(context, host, () => {
      const options = [...host.options].filter(
        (item) => item.value === priorValue,
      );
      const option = options.length === 1 ? options[0] : undefined;
      if (
        option === undefined ||
        normalizeText(option.textContent) !== payload.label ||
        option.disabled ||
        option.closest("optgroup:disabled") !== null ||
        payload.disabled
      )
        throw new Error("select driver invariant: prior option changed");
      setNativeValue(host, priorValue);
    });
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
    const value = member.value;
    if (
      (await optionValueDigest(value)) !==
      intendedOptionDigest(context.intended)
    )
      throw new Error("radio driver invariant: intended member changed");
    await mutateCurrent(context, member, (current) => {
      const currentMembers = radioMembers({ ...context, target: current });
      if (
        currentMembers === null ||
        !currentMembers.includes(member) ||
        member.value !== value ||
        currentMembers.filter((item) => item.value === value).length !== 1
      )
        throw new Error("radio driver invariant: intended member changed");
      if (!member.checked) activateElement(member);
    });
  },
  captureObservationWitness(context: DriverContext): () => boolean {
    return () => {
      const members = radioMembers(context) ?? [];
      const checked = members.filter((member) => member.checked);
      const selected = checked.length === 1 ? checked[0] : undefined;
      return (
        checked.length <= 1 &&
        (selected === undefined ||
          members.filter((member) => member.value === selected.value).length ===
            1)
      );
    };
  },
  async observe(context: DriverContext): Promise<SemanticObservation> {
    const members = radioMembers(context) ?? [];
    const checked = members.find((member) => member.checked);
    return optionObservation(
      checked === undefined ? null : await optionValueDigest(checked.value),
    );
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const members = radioMembers(context) ?? [];
    if (payload === null) {
      for (const member of members) {
        if (member.checked) {
          await mutateCurrent(context, member, (current) => {
            const currentMembers = radioMembers({
              ...context,
              target: current,
            });
            if (!currentMembers?.includes(member))
              throw new Error(
                "radio driver invariant: prior member left group",
              );
            if (member.checked) {
              member.checked = false;
              dispatchChange(member);
            }
          });
        }
      }
      return;
    }
    if (typeof payload !== "string") {
      throw new Error("radio driver invariant: undo payload malformed");
    }
    const prior = members.find((member) => member.value === payload);
    if (prior === undefined) {
      throw new Error("radio driver invariant: prior member vanished");
    }
    if (!prior.checked) {
      await mutateCurrent(context, prior, (current) => {
        const currentMembers = radioMembers({ ...context, target: current });
        if (
          currentMembers === null ||
          !currentMembers.includes(prior) ||
          prior.value !== payload ||
          currentMembers.filter((item) => item.value === payload).length !== 1
        )
          throw new Error("radio driver invariant: prior member changed");
        if (!prior.checked) activateElement(prior);
      });
    }
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
  async execute(context: DriverContext): Promise<void> {
    const host = requireCheckboxHost(context);
    if (host.checked !== intendedChecked(context)) {
      await mutateCurrent(context, host, () => {
        if (host.checked !== intendedChecked(context)) activateElement(host);
      });
    }
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return Promise.resolve(
      checkedObservation(requireCheckboxHost(context).checked),
    );
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (typeof payload !== "boolean") {
      throw new Error("checkbox driver invariant: undo payload malformed");
    }
    const host = requireCheckboxHost(context);
    if (host.checked !== payload) {
      await mutateCurrent(context, host, () => {
        if (host.checked !== payload) activateElement(host);
      });
    }
  },
};
