// M02-W10 ARIA widget drivers: editable ARIA combobox, scrollable/windowed
// ARIA listbox (the virtualized-search feasibility family), and the
// research Workday-like prompt.
//
// All three operate against current ARIA semantics: the option inventory is
// re-read live (anchor descendants plus aria-controls/aria-owns
// references, exactly the W08 scanner's option surface), the intended
// option is matched only by its exact inert value digest, disabled or
// missing or duplicated candidates refuse, and the currently highlighted
// or only-rendered option is never chosen for being convenient.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import type { DriverIntendedValue } from "../driver-protocol.ts";
import {
  optionObservation,
  type SemanticObservation,
} from "../driver-evidence.ts";
import { normalizeScannerText } from "../field-scanner.ts";
import {
  activateElement,
  delay,
  dispatchArrowDown,
  dispatchEscape,
  optionValueDigest,
  setNativeValue,
  SETTLE_POLL_INTERVAL_MS,
  WIDGET_POPUP_BUDGET_MS,
} from "./driver-dom.ts";
import type {
  CapturedUndo,
  ControlDriver,
  DriverContext,
  PreconditionOutcome,
} from "./driver-contract.ts";

function intendedDigest(intended: DriverIntendedValue): string {
  if (intended.kind !== "OPTION") {
    throw new Error("widget driver invariant: intended value is not OPTION");
  }
  return intended.value_digest;
}

/** Mirror of the W08 scanner's semantic option value extraction. */
function optionSemanticValue(option: HTMLElement): string {
  return (
    option.getAttribute("data-value") ??
    option.getAttribute("value") ??
    normalizeScannerText(option.textContent)
  );
}

function optionDisabled(option: HTMLElement): boolean {
  return (
    option.getAttribute("aria-disabled") === "true" ||
    option.hasAttribute("disabled")
  );
}

/** Mirror of the W08 scanner's option-element surface for one anchor. */
function liveOptionElements(anchor: HTMLElement): HTMLElement[] {
  const options: HTMLElement[] = [
    ...anchor.querySelectorAll<HTMLElement>("[role='option']"),
  ];
  for (const attribute of ["aria-controls", "aria-owns"]) {
    for (const id of (anchor.getAttribute(attribute) ?? "")
      .split(/\s+/)
      .filter((value) => value !== "")) {
      const referenced = anchor.ownerDocument.getElementById(id);
      if (referenced !== null) {
        options.push(
          ...referenced.querySelectorAll<HTMLElement>("[role='option']"),
        );
        if (referenced.getAttribute("role") === "option") {
          options.push(referenced);
        }
      }
    }
  }
  return [...new Set(options)];
}

async function matchOptionElements(
  anchor: HTMLElement,
  digest: string,
): Promise<HTMLElement[]> {
  const matches: HTMLElement[] = [];
  for (const option of liveOptionElements(anchor)) {
    if ((await optionValueDigest(optionSemanticValue(option))) === digest) {
      matches.push(option);
    }
  }
  return matches;
}

async function uniqueEnabledMatch(
  anchor: HTMLElement,
  digest: string,
): Promise<HTMLElement | null> {
  const matches = await matchOptionElements(anchor, digest);
  const match = matches.length === 1 ? matches[0] : undefined;
  if (match === undefined || optionDisabled(match)) {
    return null;
  }
  return match;
}

async function matchState(
  anchor: HTMLElement,
  digest: string,
): Promise<"UNIQUE_ENABLED" | "MISSING" | "AMBIGUOUS_OR_DISABLED"> {
  const matches = await matchOptionElements(anchor, digest);
  if (matches.length === 0) {
    return "MISSING";
  }
  const only = matches[0];
  return matches.length === 1 && only !== undefined && !optionDisabled(only)
    ? "UNIQUE_ENABLED"
    : "AMBIGUOUS_OR_DISABLED";
}

/**
 * Bounded poll for the exact intended option to become actionable (unique,
 * enabled, and rendered — popups reveal asynchronously). Never resolves to
 * a different option than the intended digest.
 */
async function pollForActionableMatch(
  anchor: HTMLElement,
  digest: string,
): Promise<HTMLElement | null> {
  const deadline = performance.now() + WIDGET_POPUP_BUDGET_MS;
  for (;;) {
    const match = await uniqueEnabledMatch(anchor, digest);
    if (match !== null && match.offsetParent !== null) {
      return match;
    }
    if (performance.now() >= deadline) {
      return null;
    }
    await delay(SETTLE_POLL_INTERVAL_MS);
  }
}

async function selectedOptionDigest(
  anchor: HTMLElement,
): Promise<string | null> {
  const selected = liveOptionElements(anchor).filter(
    (option) => option.getAttribute("aria-selected") === "true",
  );
  const only = selected.length === 1 ? selected[0] : undefined;
  return only === undefined
    ? null
    : optionValueDigest(optionSemanticValue(only));
}

function findClearControl(anchor: HTMLElement): HTMLElement | null {
  if (anchor.id === "") {
    return null;
  }
  const root = anchor.ownerDocument;
  const controls = [
    ...root.querySelectorAll<HTMLElement>("button[aria-controls]"),
  ].filter(
    (button) =>
      (button.getAttribute("aria-controls") ?? "")
        .split(/\s+/)
        .includes(anchor.id) &&
      normalizeScannerText(
        button.getAttribute("aria-label") ?? button.textContent,
      )
        .toUpperCase()
        .startsWith("CLEAR"),
  );
  return controls.length === 1 ? (controls[0] ?? null) : null;
}

// ------------------------------------------------------------ ARIA combobox

function comboboxHost(anchor: HTMLElement): HTMLInputElement | null {
  return anchor instanceof HTMLInputElement &&
    anchor.getAttribute("role") === "combobox"
    ? anchor
    : null;
}

function requireComboboxHost(context: DriverContext): HTMLInputElement {
  const host = comboboxHost(context.target.anchor);
  if (host === null) {
    throw new Error("combobox driver invariant: anchor is not a combobox");
  }
  return host;
}

async function observeCombobox(
  host: HTMLInputElement,
): Promise<SemanticObservation> {
  const display = normalizeScannerText(host.value);
  if (display === "") {
    return optionObservation(null);
  }
  const labelled = liveOptionElements(host).filter(
    (option) => normalizeScannerText(option.textContent) === display,
  );
  const match = labelled.length === 1 ? labelled[0] : undefined;
  const value = match === undefined ? host.value : optionSemanticValue(match);
  return optionObservation(await optionValueDigest(value));
}

async function commitComboboxOption(
  host: HTMLInputElement,
  digest: string,
): Promise<void> {
  if (host.getAttribute("aria-expanded") !== "true") {
    if (host.value !== "") {
      // A committed display value would act as filter text and narrow the
      // rendered inventory; clearing the text box is ordinary supported
      // widget behavior and re-opens the full list.
      setNativeValue(host, "");
    } else {
      // Open through the widget's own keyboard affordance; never type
      // filter text.
      dispatchArrowDown(host);
    }
  }
  const target = await pollForActionableMatch(host, digest);
  if (target === null) {
    throw new Error("combobox driver invariant: intended option vanished");
  }
  activateElement(target);
}

export const ariaComboboxDriver: ControlDriver = {
  driverKey: "ARIA_COMBOBOX_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "OPTION" &&
      descriptor.control_kind === "COMBOBOX" &&
      comboboxHost(anchor) !== null
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const host = requireComboboxHost(context);
    const digest = intendedDigest(context.intended);
    const state = await matchState(host, digest);
    if (state === "AMBIGUOUS_OR_DISABLED") {
      return { ok: false };
    }
    const committed = await observeCombobox(host);
    const alreadySatisfied =
      committed.presence === "PRESENT_REDACTED" &&
      committed.parts[0] === digest;
    if (state === "MISSING") {
      if (host.value === "" || alreadySatisfied) {
        return { ok: false };
      }
      // The reviewed editable fixture may expose only the previous committed
      // value as its current filtered window. Probe the unfiltered inventory,
      // then restore the prior display and close without committing anything.
      const priorDisplay = host.value;
      setNativeValue(host, "");
      const expandedState = await matchState(host, digest);
      setNativeValue(host, priorDisplay);
      dispatchEscape(host);
      if (expandedState !== "UNIQUE_ENABLED") {
        return { ok: false };
      }
    }
    return {
      ok: true,
      alreadySatisfied,
    };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const host = requireComboboxHost(context);
    const prior = await observeCombobox(host);
    const priorDigest =
      prior.presence === "PRESENT_REDACTED" ? (prior.parts[0] ?? null) : null;
    return {
      restorable: true,
      priorObservation: prior,
      payload: priorDigest,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    await commitComboboxOption(
      requireComboboxHost(context),
      intendedDigest(context.intended),
    );
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return observeCombobox(requireComboboxHost(context));
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (payload === null) {
      setNativeValue(requireComboboxHost(context), "");
      return;
    }
    if (typeof payload !== "string") {
      throw new Error("combobox driver invariant: undo payload malformed");
    }
    await commitComboboxOption(requireComboboxHost(context), payload);
  },
  acceptanceElements(context: DriverContext): readonly HTMLElement[] {
    const host = requireComboboxHost(context);
    const errors = [
      ...context.target.applicationRoot.querySelectorAll<HTMLElement>(
        ".error[role='status']",
      ),
    ];
    return [host, ...errors];
  },
};

// -------------------------------------------------- scrollable ARIA listbox

function listboxHost(anchor: HTMLElement): HTMLElement | null {
  return !(anchor instanceof HTMLSelectElement) &&
    anchor.getAttribute("role") === "listbox"
    ? anchor
    : null;
}

function requireListboxHost(context: DriverContext): HTMLElement {
  const host = listboxHost(context.target.anchor);
  if (host === null) {
    throw new Error("listbox driver invariant: anchor is not a listbox");
  }
  return host;
}

function scrollContainer(host: HTMLElement): HTMLElement {
  let current: HTMLElement | null = host;
  while (current !== null) {
    if (current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return host;
}

function scrollOptionIntoWindow(host: HTMLElement, option: HTMLElement): void {
  const scroller = scrollContainer(host);
  if (scroller.scrollHeight <= scroller.clientHeight) {
    return;
  }
  const offset = option.offsetTop - Math.floor(scroller.clientHeight / 2);
  scroller.scrollTop = Math.max(0, Math.min(offset, scroller.scrollHeight));
}

const MAX_VIRTUAL_WINDOWS = 64;

/** Traverse every bounded window and reject duplicate semantic positions. */
async function findWindowedOption(
  host: HTMLElement,
  digest: string,
): Promise<HTMLElement | null> {
  const initial = await matchOptionElements(host, digest);
  const scroller = scrollContainer(host);
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  if (maxScroll === 0) {
    const only = initial[0];
    return initial.length === 1 && only !== undefined && !optionDisabled(only)
      ? only
      : null;
  }

  let winningTop: number | null = null;
  const semanticPositions = new Set<string>();
  for (let attempt = 0; attempt <= MAX_VIRTUAL_WINDOWS; attempt += 1) {
    scroller.scrollTop = Math.round(
      (maxScroll * attempt) / MAX_VIRTUAL_WINDOWS,
    );
    await delay(SETTLE_POLL_INTERVAL_MS);
    const matches = await matchOptionElements(host, digest);
    for (const match of matches) {
      if (optionDisabled(match)) {
        return null;
      }
      semanticPositions.add(
        match.getAttribute("aria-posinset") ??
          `${String(scroller.scrollTop)}:${optionSemanticValue(match)}`,
      );
      winningTop ??= scroller.scrollTop;
    }
    if (semanticPositions.size > 1) {
      return null;
    }
  }
  if (winningTop === null) {
    return null;
  }
  scroller.scrollTop = winningTop;
  await delay(SETTLE_POLL_INTERVAL_MS);
  return uniqueEnabledMatch(host, digest);
}

async function commitListboxOption(
  host: HTMLElement,
  digest: string,
): Promise<void> {
  const target =
    (await uniqueEnabledMatch(host, digest)) ??
    (await findWindowedOption(host, digest));
  if (target === null) {
    throw new Error("listbox driver invariant: intended option vanished");
  }
  scrollOptionIntoWindow(host, target);
  // Confirm exact semantic identity again after the scroll before
  // committing; a re-rendered row that no longer carries the intended
  // semantics must not be clicked.
  const confirmed = await uniqueEnabledMatch(host, digest);
  if (confirmed === null) {
    throw new Error("listbox driver invariant: option lost after scroll");
  }
  activateElement(confirmed);
}

export const scrollListboxDriver: ControlDriver = {
  driverKey: "SCROLL_LISTBOX_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "OPTION" &&
      descriptor.control_kind === "SELECT" &&
      listboxHost(anchor) !== null
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const host = requireListboxHost(context);
    const digest = intendedDigest(context.intended);
    if ((await findWindowedOption(host, digest)) === null) {
      return { ok: false };
    }
    return {
      ok: true,
      alreadySatisfied: (await selectedOptionDigest(host)) === digest,
    };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const host = requireListboxHost(context);
    const prior = await selectedOptionDigest(host);
    return {
      restorable: prior !== null || findClearControl(host) !== null,
      priorObservation: optionObservation(prior),
      payload: prior,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    await commitListboxOption(
      requireListboxHost(context),
      intendedDigest(context.intended),
    );
  },
  async observe(context: DriverContext): Promise<SemanticObservation> {
    return optionObservation(
      await selectedOptionDigest(requireListboxHost(context)),
    );
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const host = requireListboxHost(context);
    if (payload === null) {
      const clear = findClearControl(host);
      if (clear === null) {
        throw new Error("listbox driver invariant: no clear affordance");
      }
      activateElement(clear);
      return;
    }
    if (typeof payload !== "string") {
      throw new Error("listbox driver invariant: undo payload malformed");
    }
    await commitListboxOption(host, payload);
  },
  acceptanceElements(context: DriverContext): readonly HTMLElement[] {
    return [requireListboxHost(context)];
  },
};

// ------------------------------------------- research Workday-like prompt

function promptHost(anchor: HTMLElement): HTMLElement | null {
  return !(anchor instanceof HTMLInputElement) &&
    !(anchor instanceof HTMLSelectElement) &&
    anchor.getAttribute("role") === "combobox"
    ? anchor
    : null;
}

function requirePromptHost(context: DriverContext): HTMLElement {
  const host = promptHost(context.target.anchor);
  if (host === null) {
    throw new Error("prompt driver invariant: anchor is not a prompt");
  }
  return host;
}

async function observePrompt(host: HTMLElement): Promise<SemanticObservation> {
  const committedId = host.getAttribute("aria-activedescendant");
  if (committedId === null || committedId === "") {
    return optionObservation(null);
  }
  const option = host.ownerDocument.getElementById(committedId);
  if (option?.getAttribute("role") !== "option") {
    return optionObservation(null);
  }
  return optionObservation(
    await optionValueDigest(optionSemanticValue(option)),
  );
}

async function commitPromptOption(
  host: HTMLElement,
  digest: string,
): Promise<void> {
  if (host.getAttribute("aria-expanded") !== "true") {
    activateElement(host);
  }
  // Workday-like prompts reveal their popup after a bounded async delay:
  // poll for the exact intended option to become actionable, never for
  // "any option".
  const option = await pollForActionableMatch(host, digest);
  if (option === null) {
    throw new Error("prompt driver invariant: intended option never mounted");
  }
  activateElement(option);
}

export const workdayPromptResearchDriver: ControlDriver = {
  driverKey: "WORKDAY_PROMPT_RESEARCH_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "OPTION" &&
      descriptor.control_kind === "COMBOBOX" &&
      promptHost(anchor) !== null
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const host = requirePromptHost(context);
    const digest = intendedDigest(context.intended);
    // The prompt's popup keeps its option semantics mounted while
    // concealed; the intended option must exist, be unique, and be enabled
    // before any interaction begins.
    if ((await uniqueEnabledMatch(host, digest)) === null) {
      return { ok: false };
    }
    const committed = await observePrompt(host);
    return {
      ok: true,
      alreadySatisfied:
        committed.presence === "PRESENT_REDACTED" &&
        committed.parts[0] === digest,
    };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const host = requirePromptHost(context);
    const prior = await observePrompt(host);
    const priorDigest =
      prior.presence === "PRESENT_REDACTED" ? (prior.parts[0] ?? null) : null;
    return {
      restorable: priorDigest !== null || findClearControl(host) !== null,
      priorObservation: prior,
      payload: priorDigest,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    await commitPromptOption(
      requirePromptHost(context),
      intendedDigest(context.intended),
    );
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return observePrompt(requirePromptHost(context));
  },
  async applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    const host = requirePromptHost(context);
    if (payload === null) {
      const clear = findClearControl(host);
      if (clear === null) {
        throw new Error("prompt driver invariant: no clear affordance");
      }
      activateElement(clear);
      return;
    }
    if (typeof payload !== "string") {
      throw new Error("prompt driver invariant: undo payload malformed");
    }
    await commitPromptOption(host, payload);
  },
  acceptanceElements(context: DriverContext): readonly HTMLElement[] {
    return [requirePromptHost(context)];
  },
};
