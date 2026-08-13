// M02-W07 proofs C/D — no product action occurs. The explicit readiness
// marker is outside this state equality. WXT 0.20.27 necessarily emits a
// reviewed lifecycle CustomEvent when this content-script context is created;
// its exact non-sensitive shape and the absence of any window message are
// asserted for each tested injection.
import type { Page } from "@playwright/test";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const MARKER_TIMEOUT_MS = 15_000;
const SETTLE_MS = 1_000;

interface PageWorldObservation {
  events: {
    type: string;
    isCustomEvent: boolean;
    detail: unknown;
  }[];
  messages: number;
}

interface NativeFormSnapshot {
  formHtml: string;
  formValidation: {
    noValidate: boolean;
    valid: boolean;
    invalid: boolean;
  };
  controls: unknown[];
  statusAndErrors: unknown[];
  honeypotValue: string | null;
  sessionStorage: [string, string][];
  localStorage: [string, string][];
  route: {
    url: string;
    historyLength: number;
    historyState: unknown;
  };
}

interface FlowPageSnapshot {
  bodyHtml: string;
  sessionStorage: [string, string][];
  localStorage: [string, string][];
  flowState: string | null;
  receiptState: string | null;
  route: {
    url: string;
    historyLength: number;
    historyState: unknown;
  };
}

async function installPageWorldObserver(
  page: Page,
  extensionId: string,
): Promise<void> {
  const lifecycleType = `${extensionId}:feasibility:wxt:content-script-started`;
  await page.addInitScript((expectedType) => {
    const observation: PageWorldObservation = { events: [], messages: 0 };
    (
      window as typeof window & {
        __japp_w07_page_world_observation__?: PageWorldObservation;
      }
    ).__japp_w07_page_world_observation__ = observation;
    document.addEventListener(expectedType, (event) => {
      observation.events.push({
        type: event.type,
        isCustomEvent: event instanceof CustomEvent,
        detail: event instanceof CustomEvent ? event.detail : null,
      });
    });
    // Count every page-world message regardless of its type or data shape.
    window.addEventListener("message", () => {
      observation.messages += 1;
    });
  }, lifecycleType);
}

async function pageWorldObservation(page: Page): Promise<PageWorldObservation> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __japp_w07_page_world_observation__: PageWorldObservation;
        }
      ).__japp_w07_page_world_observation__,
  );
}

function expectReviewedLifecycleArtifact(
  observation: PageWorldObservation,
  extensionId: string,
): void {
  const expectedType = `${extensionId}:feasibility:wxt:content-script-started`;
  expect(observation.messages, "WXT postMessage must remain suppressed").toBe(
    0,
  );
  expect(observation.events).toHaveLength(1);
  const [event] = observation.events;
  expect(event).toBeDefined();
  expect(event?.type).toBe(expectedType);
  expect(event?.isCustomEvent).toBe(true);
  expect(event?.detail).toEqual({
    contentScriptName: "feasibility",
    // Exact WXT 0.20.27 source uses Math.random().toString(36).slice(2).
    // Do not invent a minimum length that the framework does not guarantee.
    messageId: expect.stringMatching(/^[a-z0-9]*$/),
  });
  expect(Object.keys(event?.detail as Record<string, unknown>).sort()).toEqual([
    "contentScriptName",
    "messageId",
  ]);
}

async function snapshotNativeForm(page: Page): Promise<NativeFormSnapshot> {
  return page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#nat-form");
    if (form === null) {
      throw new Error("#nat-form missing from native fixture");
    }
    const attributesOf = (element: Element): [string, string][] =>
      [...element.attributes]
        .map((attribute): [string, string] => [attribute.name, attribute.value])
        .sort(([left], [right]) => left.localeCompare(right));
    const validityOf = (
      control:
        | HTMLButtonElement
        | HTMLFieldSetElement
        | HTMLInputElement
        | HTMLObjectElement
        | HTMLOutputElement
        | HTMLSelectElement
        | HTMLTextAreaElement,
    ): Record<string, boolean> => ({
      badInput: control.validity.badInput,
      customError: control.validity.customError,
      patternMismatch: control.validity.patternMismatch,
      rangeOverflow: control.validity.rangeOverflow,
      rangeUnderflow: control.validity.rangeUnderflow,
      stepMismatch: control.validity.stepMismatch,
      tooLong: control.validity.tooLong,
      tooShort: control.validity.tooShort,
      typeMismatch: control.validity.typeMismatch,
      valid: control.validity.valid,
      valueMissing: control.validity.valueMissing,
    });
    const controls = [...form.elements].map((element, index) => {
      const base = {
        index,
        tag: element.tagName.toLowerCase(),
        id: element.id,
        name: "name" in element ? String(element.name) : "",
        type: "type" in element ? String(element.type) : "",
        attributes: attributesOf(element),
        disabled: "disabled" in element ? Boolean(element.disabled) : false,
        effectivelyDisabled: element.matches(":disabled"),
      };
      if (element instanceof HTMLInputElement) {
        return {
          ...base,
          value: element.value,
          defaultValue: element.defaultValue,
          checked: element.checked,
          defaultChecked: element.defaultChecked,
          indeterminate: element.indeterminate,
          required: element.required,
          readOnly: element.readOnly,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLTextAreaElement) {
        return {
          ...base,
          value: element.value,
          defaultValue: element.defaultValue,
          required: element.required,
          readOnly: element.readOnly,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLSelectElement) {
        return {
          ...base,
          value: element.value,
          selectedIndex: element.selectedIndex,
          selectedIndices: [...element.options]
            .map((option, optionIndex) => (option.selected ? optionIndex : -1))
            .filter((optionIndex) => optionIndex >= 0),
          selectedValues: [...element.selectedOptions].map(
            (option) => option.value,
          ),
          options: [...element.options].map((option) => ({
            value: option.value,
            text: option.text,
            selected: option.selected,
            defaultSelected: option.defaultSelected,
            disabled: option.disabled,
          })),
          required: element.required,
          multiple: element.multiple,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLButtonElement) {
        return {
          ...base,
          value: element.value,
          formNoValidate: element.formNoValidate,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLFieldSetElement) {
        return {
          ...base,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLOutputElement) {
        return {
          ...base,
          value: element.value,
          defaultValue: element.defaultValue,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      if (element instanceof HTMLObjectElement) {
        return {
          ...base,
          data: element.data,
          willValidate: element.willValidate,
          validity: validityOf(element),
          validationMessage: element.validationMessage,
          ariaInvalid: element.getAttribute("aria-invalid"),
        };
      }
      throw new Error(
        `unhandled form-listed control ${element.tagName.toLowerCase()}#${element.id}`,
      );
    });
    const statusAndErrors = [
      ...document.querySelectorAll<HTMLElement>(
        '#nat-form [id$="-error"], #nat-form [role="status"], #nat-form [role="alert"], #nat-form [aria-live]',
      ),
    ].map((element) => ({
      id: element.id,
      tag: element.tagName.toLowerCase(),
      text: element.textContent,
      hidden: element.hidden,
      attributes: attributesOf(element),
    }));
    const storageEntries = (storage: Storage): [string, string][] =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => key !== null)
        .sort()
        .map((key): [string, string] => [key, storage.getItem(key) ?? ""]);
    return {
      // Structural equality makes a newly-added/removed/reordered fixture
      // control visible even before the generic state map is consulted.
      formHtml: form.innerHTML,
      formValidation: {
        noValidate: form.noValidate,
        valid: form.matches(":valid"),
        invalid: form.matches(":invalid"),
      },
      controls,
      statusAndErrors,
      honeypotValue:
        form.querySelector<HTMLInputElement>("#nat-company-site")?.value ??
        null,
      sessionStorage: storageEntries(window.sessionStorage),
      localStorage: storageEntries(window.localStorage),
      route: {
        url: window.location.href,
        historyLength: window.history.length,
        historyState: window.history.state as unknown,
      },
    };
  });
}

async function snapshotFlowPage(page: Page): Promise<FlowPageSnapshot> {
  return page.evaluate(() => {
    const storageEntries = (storage: Storage): [string, string][] =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => key !== null)
        .sort()
        .map((key): [string, string] => [key, storage.getItem(key) ?? ""]);
    return {
      // The readiness attribute lives on <html>, so complete body equality is
      // a truthful no-product-action assertion rather than excluding controls.
      bodyHtml: document.body.innerHTML,
      sessionStorage: storageEntries(window.sessionStorage),
      localStorage: storageEntries(window.localStorage),
      flowState: window.sessionStorage.getItem("japp-mock-ats-lab.flow.v1"),
      receiptState: window.sessionStorage.getItem(
        "japp-mock-ats-lab.receipts.v1",
      ),
      route: {
        url: window.location.href,
        historyLength: window.history.length,
        historyState: window.history.state as unknown,
      },
    };
  });
}

test("W07 preserves the complete live native form before/after activation and reload", async ({
  page: pristinePage,
  extensionContext,
  extensionId,
}) => {
  await pristinePage.goto(`${LAB_ORIGIN}/native/`);
  const pristine = await snapshotNativeForm(pristinePage);
  expect(pristine.controls.length).toBeGreaterThan(0);
  expect(pristine.honeypotValue).toBe("");
  expect(pristine.sessionStorage).toEqual([]);

  const extensionPage = await extensionContext.newPage();
  await installPageWorldObserver(extensionPage, extensionId);
  await extensionPage.goto(`${LAB_ORIGIN}/native/`);
  await expect(extensionPage.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await extensionPage.waitForTimeout(SETTLE_MS);
  expect(await snapshotNativeForm(extensionPage)).toEqual(pristine);
  expectReviewedLifecycleArtifact(
    await pageWorldObservation(extensionPage),
    extensionId,
  );

  await extensionPage.reload();
  await expect(extensionPage.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await extensionPage.waitForTimeout(SETTLE_MS);
  expect(await snapshotNativeForm(extensionPage)).toEqual(pristine);
  expectReviewedLifecycleArtifact(
    await pageWorldObservation(extensionPage),
    extensionId,
  );
});

test("W07 preserves route, flow, receipt, storage, and body state across activation and reload", async ({
  page: pristinePage,
  extensionContext,
}) => {
  await pristinePage.goto(`${LAB_ORIGIN}/apply/step-1/`);
  const pristine = await snapshotFlowPage(pristinePage);
  expect(pristine.flowState).toBeNull();
  expect(pristine.receiptState).toBeNull();

  const extensionPage = await extensionContext.newPage();
  await extensionPage.goto(`${LAB_ORIGIN}/apply/step-1/`);
  await expect(extensionPage.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await extensionPage.waitForTimeout(SETTLE_MS);
  expect(await snapshotFlowPage(extensionPage)).toEqual(pristine);

  await extensionPage.reload();
  await expect(extensionPage.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: MARKER_TIMEOUT_MS },
  );
  await extensionPage.waitForTimeout(SETTLE_MS);
  expect(await snapshotFlowPage(extensionPage)).toEqual(pristine);
});

test("the extension context issues only loopback and browser-internal traffic across lab navigation", async ({
  extensionContext,
}) => {
  const page = await extensionContext.newPage();
  for (const path of ["/", "/native/", "/apply/step-1/"]) {
    await page.goto(`${LAB_ORIGIN}${path}`);
    await expect(page.locator("html")).toHaveAttribute(
      CONTENT_READY_ATTRIBUTE,
      CONTENT_READY_VALUE,
      { timeout: MARKER_TIMEOUT_MS },
    );
  }
});
