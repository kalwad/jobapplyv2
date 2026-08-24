// M02-W10 bounded driver DOM helpers.
//
// Everything a driver may physically do to the page funnels through this
// reviewed module: one activation helper (the only direct activation site in
// extension — enforced by apps/extension/test/m02-w10/driver-authority
// tests and the shipped-byte scan), native prototype value setters, the
// minimal input/change event pair real frameworks require, the bounded
// settle window, and the bounded read-only site-acceptance inspection.
// Nothing here navigates, submits, sends bytes off-device, or handles
// account secrets; no helper accepts a selector from the wire.
import { semanticDigest } from "../semantic-identity.ts";
import {
  SETTLE_SIGNAL_ATTRIBUTE,
  type SettlePolicy,
} from "../driver-protocol.ts";

export const SETTLE_POLL_INTERVAL_MS = 25;
/** Bounded wait for widget popups that mount options asynchronously. */
export const WIDGET_POPUP_BUDGET_MS = 2000;

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * The single reviewed native control-activation primitive.
 * performs the browser's native activation behavior (checkbox/radio state,
 * option commit handlers, button activation) exactly as a user click does.
 * Navigation-shaped controls never reach this helper: navigation
 * identification is read-only and the engine has no navigation driver.
 */
export function activateElement(element: HTMLElement): void {
  element.click();
}

type ValueHost = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function nativeValueSetter(element: ValueHost): (value: string) => void {
  const prototype: object =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  // The native accessor is deliberately rebound to the concrete host below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = descriptor?.set;
  if (setter === undefined) {
    throw new Error("driver invariant: native value setter unavailable");
  }
  return (value: string) => {
    Reflect.apply(setter, element, [value]);
  };
}

/**
 * Set a control's value through the native prototype setter, then dispatch
 * the minimal bubbling input+change pair. This is exactly the surface real
 * controlled frameworks (React value tracking, Vue v-model) observe; no
 * other synthetic events are fired.
 */
export function setNativeValue(element: ValueHost, value: string): void {
  nativeValueSetter(element)(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Dispatch only the change notification (file inputs, undo clears). */
export function dispatchChange(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Bounded keyboard signal for widgets that open on ArrowDown. */
export function dispatchArrowDown(element: HTMLElement): void {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
  );
}

/** Close a reviewed editable popup after a reversible query probe. */
export function dispatchEscape(element: HTMLElement): void {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
  );
}

/** Mirror of the W08 scanner's option-value digest seed. */
export async function optionValueDigest(value: string): Promise<string> {
  return semanticDigest(`option-value-v1\0${value}`);
}

export interface SettleOutcome {
  readonly polls: number;
  readonly signalObserved: boolean;
  readonly timedOut: boolean;
}

/**
 * Bounded settle window (spec §5.11.6 rerender wait). Without a signal the
 * window is a fixed bounded delay; with a required page signal the agent
 * polls the page's documentElement attribute until the exact token appears
 * or the budget is exhausted. There is no unbounded wait on any path.
 */
export async function settleWindow(
  document: Document,
  policy: SettlePolicy,
): Promise<SettleOutcome> {
  const signal = policy.require_page_signal;
  if (signal === undefined) {
    await delay(policy.budget_ms);
    return { polls: 1, signalObserved: false, timedOut: false };
  }
  let polls = 0;
  const started = performance.now();
  for (;;) {
    polls += 1;
    if (
      document.documentElement.getAttribute(SETTLE_SIGNAL_ATTRIBUTE) === signal
    ) {
      return { polls, signalObserved: true, timedOut: false };
    }
    if (performance.now() - started >= policy.budget_ms) {
      return { polls, signalObserved: false, timedOut: true };
    }
    await delay(SETTLE_POLL_INTERVAL_MS);
  }
}

/** Bounded poll until `probe` returns non-null or the budget expires. */
export async function pollWithin<T>(
  budgetMs: number,
  probe: () => T | null,
): Promise<T | null> {
  const started = performance.now();
  for (;;) {
    const value = probe();
    if (value !== null) {
      return value;
    }
    if (performance.now() - started >= budgetMs) {
      return null;
    }
    await delay(SETTLE_POLL_INTERVAL_MS);
  }
}

export interface SiteAcceptanceReading {
  readonly acceptance: "ACCEPTED" | "REJECTED" | "UNKNOWN";
  readonly messageDigests: readonly string[];
}

function normalizeMessage(value: string): string {
  return value.normalize("NFKC").replaceAll(/\s+/g, " ").trim();
}

function describedErrorNodes(element: HTMLElement): HTMLElement[] {
  const ids = (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter((value) => value !== "");
  const nodes: HTMLElement[] = [];
  for (const id of ids) {
    const node = element.ownerDocument.getElementById(id);
    if (node?.classList.contains("error") === true) {
      nodes.push(node);
    }
  }
  return nodes;
}

function supportsConstraintValidation(
  element: HTMLElement,
): element is ValueHost {
  return (
    (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement) &&
    element.willValidate
  );
}

/**
 * Bounded read-only site-acceptance inspection (spec §5.11.6 "accepted by
 * the page validation state"). Evidence sources, in rejection-first order:
 * native constraint validity (passively via `validity.valid` — never
 * `checkValidity()`, which dispatches events), `aria-invalid`, and the
 * lab's reviewed error-region convention (`aria-describedby` references
 * with class `error`: non-empty text is a rejection message, present but
 * empty is acceptance evidence). Any rejection wins; otherwise any
 * acceptance evidence yields ACCEPTED; a control with no readable
 * acceptance surface stays UNKNOWN and can never be VERIFIED.
 */
export async function readSiteAcceptance(
  elements: readonly HTMLElement[],
): Promise<SiteAcceptanceReading> {
  let sawAcceptEvidence = false;
  let rejected = false;
  const messages: string[] = [];
  for (const element of elements) {
    if (supportsConstraintValidation(element)) {
      if (element.validity.valid) {
        sawAcceptEvidence = true;
      } else {
        rejected = true;
        const message = normalizeMessage(element.validationMessage);
        if (message !== "") {
          messages.push(message);
        }
      }
    }
    const ariaInvalid = element.getAttribute("aria-invalid");
    if (ariaInvalid === "true") {
      rejected = true;
    } else if (ariaInvalid === "false") {
      sawAcceptEvidence = true;
    }
    if (element.classList.contains("error")) {
      const message = normalizeMessage(element.textContent);
      if (message === "") {
        sawAcceptEvidence = true;
      } else {
        rejected = true;
        messages.push(message);
      }
    }
    const tone = element.getAttribute("data-tone");
    if (tone === "ok") {
      sawAcceptEvidence = true;
    } else if (tone === "error") {
      rejected = true;
      const message = normalizeMessage(element.textContent);
      if (message !== "") {
        messages.push(message);
      }
    }
    const role = element.getAttribute("role");
    if (role === "listbox") {
      if (
        element.querySelectorAll("[role='option'][aria-selected='true']")
          .length === 1
      ) {
        sawAcceptEvidence = true;
      }
    } else if (role === "combobox") {
      const selected = element.ownerDocument.querySelectorAll(
        "[role='option'][aria-selected='true']",
      );
      const activeId = element.getAttribute("aria-activedescendant");
      const active =
        activeId === null
          ? null
          : element.ownerDocument.getElementById(activeId);
      if (
        selected.length === 1 ||
        (active !== null && active.getAttribute("role") === "option")
      ) {
        sawAcceptEvidence = true;
      }
    }
    if (element.getAttribute("data-japp-repeater-valid") === "true") {
      sawAcceptEvidence = true;
    }
    for (const node of describedErrorNodes(element)) {
      const message = normalizeMessage(node.textContent);
      if (message === "") {
        sawAcceptEvidence = true;
      } else {
        rejected = true;
        messages.push(message);
      }
    }
  }
  const uniqueMessages = [...new Set(messages)].slice(0, 8);
  const messageDigests: string[] = [];
  for (const message of uniqueMessages) {
    messageDigests.push(
      await semanticDigest(`driver-validation-message-v1\0${message}`),
    );
  }
  return {
    acceptance: rejected
      ? "REJECTED"
      : sawAcceptEvidence
        ? "ACCEPTED"
        : "UNKNOWN",
    messageDigests,
  };
}

/** Normalized accessible-name evidence for bounded button identification. */
export function normalizedAccessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label");
  const raw =
    ariaLabel !== null && ariaLabel.trim() !== ""
      ? ariaLabel
      : element.textContent;
  return normalizeMessage(raw).toUpperCase();
}
