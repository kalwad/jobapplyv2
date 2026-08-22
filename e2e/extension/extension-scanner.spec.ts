import {
  validateFormFieldDescriptorV1,
  validateSemanticContractV1,
} from "../../packages/contracts/generated/typescript/index.ts";
import type { BrowserContext, Page, Worker } from "@playwright/test";

import {
  buildReresolveTabRequest,
  buildScanTabRequest,
  CONTENT_FRAME_SCAN_FOUND,
  type FrameScanReport,
  parseAggregatedScanResult,
  parseReresolveTabResult,
  type ReresolveTabResult,
  type ScanScope,
} from "../../apps/extension/src/scanner-protocol.ts";
import type { FormFieldDescriptorV1 } from "../../packages/contracts/generated/typescript/index.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import {
  CROSS_FRAME_ORIGIN,
  expect,
  LAB_ORIGIN,
  test,
} from "./support/extension-test.ts";

const READY_TIMEOUT_MS = 15_000;

interface ChromeTab {
  readonly id?: number;
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

async function tabIdForPage(
  serviceWorker: Worker,
  page: Page,
): Promise<number> {
  await page.bringToFront();
  const targetUrl = page.url();
  return serviceWorker.evaluate(async (url) => {
    const runtime = globalThis as unknown as {
      chrome: { tabs: { query(query: object): Promise<ChromeTab[]> } };
    };
    const tabs = await runtime.chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const match = tabs[0];
    if (tabs.length !== 1 || match?.id === undefined) {
      throw new Error(`no unique active browser tab found for ${url}`);
    }
    return match.id;
  }, targetUrl);
}

async function runtimeMessage(
  controller: Page,
  message: unknown,
): Promise<unknown> {
  return controller.evaluate(async (wireMessage) => {
    const runtime = globalThis as unknown as {
      chrome: { runtime: { sendMessage(value: unknown): Promise<unknown> } };
    };
    return runtime.chrome.runtime.sendMessage(wireMessage);
  }, message);
}

async function scannerController(
  extensionContext: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await extensionContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/manifest.json`);
  return page;
}

async function scanTab(
  controller: Page,
  tabId: number,
  scope: ScanScope = { kind: "APPLICATION_ROOT" },
): Promise<readonly FrameScanReport[]> {
  const response = await runtimeMessage(
    controller,
    buildScanTabRequest("browser-scan", tabId, scope),
  );
  const parsed = parseAggregatedScanResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "worker returned an invalid aggregate").frames;
}

async function waitForFrames(
  controller: Page,
  tabId: number,
  expectedCount: number,
  scope: ScanScope = { kind: "APPLICATION_ROOT" },
): Promise<readonly FrameScanReport[]> {
  let reports: readonly FrameScanReport[] = [];
  await expect
    .poll(
      async () => {
        reports = await scanTab(controller, tabId, scope);
        return reports.length;
      },
      { timeout: READY_TIMEOUT_MS },
    )
    .toBe(expectedCount);
  return reports;
}

function foundDescriptors(
  reports: readonly FrameScanReport[],
): FormFieldDescriptorV1[] {
  return reports.flatMap((report) =>
    report.root_status === CONTENT_FRAME_SCAN_FOUND
      ? [...report.descriptors]
      : [],
  );
}

function descriptorByLabel(
  descriptors: readonly FormFieldDescriptorV1[],
  label: string,
): FormFieldDescriptorV1 {
  const descriptor = descriptors.find(
    (candidate) => candidate.label.normalized_text === label,
  );
  expect(descriptor, `descriptor labelled ${label}`).toBeDefined();
  return requireValue(descriptor, `descriptor labelled ${label} is missing`);
}

async function setScannerFixture(page: Page, body: string): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: READY_TIMEOUT_MS },
  );
  await page.locator("body").evaluate((element, markup) => {
    element.innerHTML = markup;
  }, body);
}

test("W08 extracts canonical label, ARIA, section, option, visibility, enabled, and required evidence", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main aria-labelledby="application-title">
      <h1 id="application-title">Synthetic application</h1>
      <form id="application-form">
        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact details</h2>
          <label for="native-name">Native name</label>
          <input id="native-name" name="nativeName" required>
          <label>Wrapped name <input name="wrappedName"></label>
          <span id="aria-name">ARIA name</span>
          <span id="aria-help">Use synthetic text only</span>
          <input name="ariaName" aria-labelledby="aria-name" aria-describedby="aria-help">
          <label for="work-mode">Work mode</label>
          <select id="work-mode" name="workMode" required>
            <option value="">Choose</option>
            <option value="remote">Remote</option>
            <option value="closed" disabled>Closed</option>
            <option value="javascript:evil">Hostile token</option>
          </select>
          <fieldset>
            <legend>Schedule</legend>
            <label><input type="radio" name="schedule" value="full" required> Full time</label>
            <label><input type="radio" name="schedule" value="part"> Part time</label>
          </fieldset>
          <label for="hidden-field">Hidden field</label>
          <input id="hidden-field" name="hiddenField" hidden>
          <label for="offscreen-field">Offscreen field</label>
          <input id="offscreen-field" name="offscreenField" style="position:absolute;left:-10000px;width:1px;height:1px">
          <label for="disabled-field">Disabled field</label>
          <input id="disabled-field" name="disabledField" disabled>
          <div role="textbox" aria-label="ARIA disabled" aria-disabled="true"></div>
          <div role="textbox" aria-label="ARIA required" aria-required="true" tabindex="0">value</div>
          <label for="optional-field">Optional field</label>
          <input id="optional-field" name="optionalField">
        </section>
      </form>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  const descriptors = foundDescriptors(reports);

  for (const descriptor of descriptors) {
    expect(validateFormFieldDescriptorV1(descriptor).valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-descriptor:v1",
        descriptor,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(descriptor.address).not.toHaveProperty("raw_selector");
    expect(JSON.stringify(descriptor.address)).not.toContain("nth-of-type");
  }

  const native = descriptorByLabel(descriptors, "Native name");
  expect(native.control_kind).toBe("TEXT");
  expect(native.required).toBe(true);
  expect(native.visible).toBe(true);
  expect(native.enabled).toBe(true);
  expect(native.section_context).toContain("CONTACT_DETAILS");

  expect(descriptorByLabel(descriptors, "Wrapped name").required).toBe(false);
  const aria = descriptorByLabel(descriptors, "ARIA name");
  expect(aria.description?.normalized_text).toBe("Use synthetic text only");

  const select = descriptorByLabel(descriptors, "Work mode");
  expect(select.control_kind).toBe("SELECT");
  expect(select.options.map((option) => option.label.normalized_text)).toEqual([
    "Choose",
    "Remote",
    "Closed",
    "Hostile token",
  ]);
  expect(select.options.map((option) => option.disabled)).toEqual([
    false,
    false,
    true,
    false,
  ]);
  expect(select.options[3]).not.toHaveProperty("stable_value_token");

  const radio = descriptorByLabel(descriptors, "Schedule");
  expect(radio.control_kind).toBe("RADIO_GROUP");
  expect(radio.required).toBe(true);
  expect(radio.options.map((option) => option.label.normalized_text)).toEqual([
    "Full time",
    "Part time",
  ]);

  expect(descriptorByLabel(descriptors, "Hidden field").visible).toBe(false);
  expect(descriptorByLabel(descriptors, "Offscreen field").visible).toBe(false);
  expect(descriptorByLabel(descriptors, "Disabled field").enabled).toBe(false);
  expect(descriptorByLabel(descriptors, "ARIA disabled").enabled).toBe(false);
  expect(descriptorByLabel(descriptors, "ARIA required").required).toBe(true);
  expect(descriptorByLabel(descriptors, "Optional field").required).toBe(false);
});

test("C1: a unique native form is not widened to its semantic main ancestor", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main>
      <label>Newsletter email <input name="newsletter"></label>
      <form id="job-application">
        <label>Applicant name <input name="applicant"></label>
      </form>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Applicant name"]);
});

test("C2: unrelated controls surrounding a unique form stay outside its descriptor inventory", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main>
      <label>Newsletter email <input name="newsletter"></label>
      <label>Site search <input name="search"></label>
      <form id="job-application">
        <label>Applicant name <input name="applicant"></label>
      </form>
      <label>Contact sales <input name="sales"></label>
      <label>Footer feedback <textarea name="feedback"></textarea></label>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Applicant name"]);
});

test("C3: a stronger explicit application root includes controls outside its native form", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><div data-japp-application-root>
      <label>Application-level external control
        <input name="outsideNativeForm">
      </label>
      <form>
        <label>Applicant name <input name="applicant"></label>
      </form>
    </div></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Application-level external control", "Applicant name"]);
});

test("C4: a unique semantic main remains the fallback when no form qualifies", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main>
      <label>Applicant name <input name="applicant"></label>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Applicant name"]);
});

test("C5: two qualifying forms remain ambiguous instead of selecting either form", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main>
      <form><label>First form <input name="first"></label></form>
      <form><label>Second form <input name="second"></label></form>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]).toMatchObject({
    root_status: "AMBIGUOUS",
    root_candidate_count: 2,
    descriptors: [],
  });
});

test("C6: a unique role=form root is not widened to its semantic main ancestor", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main>
      <label>Newsletter email <input name="newsletter"></label>
      <div role="form">
        <label>Applicant name <input name="applicant"></label>
      </div>
    </main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1);
  expect(reports[0]?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Applicant name"]);
});

test("M3: targeted subtree scanning never escapes the requested application subtree", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form>
      <section data-japp-scan-scope="TARGET_SECTION">
        <h2>Target section</h2>
        <label>Inside target <input name="inside"></label>
      </section>
      <section><h2>Other section</h2>
        <label>Outside target <input name="outside"></label>
      </section>
    </form></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 1, {
    kind: "SUBTREE",
    subtreeToken: "TARGET_SECTION",
  });
  expect(
    foundDescriptors(reports).map((item) => item.label.normalized_text),
  ).toEqual(["Inside target"]);
});

test("repeat scans are deterministic apart from the truthful observation time", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form><h2>Identity</h2><label>Repeatable field <input name="repeatable"></label></form></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const first = foundDescriptors(await waitForFrames(controller, tabId, 1));
  const second = foundDescriptors(await scanTab(controller, tabId));
  const withoutTime = (values: readonly FormFieldDescriptorV1[]) =>
    values.map((value) => ({ ...value, observed_at: "<ignored>" }));
  expect(withoutTime(second)).toEqual(withoutTime(first));
});

test("M2: same-origin child agents remain frame-local and aggregation preserves frame identity", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/frames/`);
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: READY_TIMEOUT_MS },
  );
  await expect(
    page.frameLocator("#frames-embed").locator("html"),
  ).toHaveAttribute(CONTENT_READY_ATTRIBUTE, CONTENT_READY_VALUE, {
    timeout: READY_TIMEOUT_MS,
  });
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 2);
  expect(
    new Set(reports.map((report) => report.frame_context.frame_id)).size,
  ).toBe(2);
  expect(
    reports.filter((report) => report.frame_context.is_top_frame),
  ).toHaveLength(1);
  const child = reports.find((report) => !report.frame_context.is_top_frame);
  expect(child?.root_status).toBe(CONTENT_FRAME_SCAN_FOUND);
  expect(child?.descriptors.map((item) => item.label.normalized_text)).toEqual([
    "Synthetic reference number (required)",
    "I confirm this synthetic section (optional)",
  ]);
  expect(
    reports.find((report) => report.frame_context.is_top_frame)?.descriptors,
  ).toEqual([]);
});

test("cross-origin permitted child agents report through the worker without parent traversal", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  await extensionContext.route(`${CROSS_FRAME_ORIGIN}/frame`, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><main><form>
        <h1>Cross origin frame</h1>
        <label>Cross origin field <input name="crossOrigin"></label>
      </form></main></body></html>`,
    });
  });
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form><label>Top frame field <input name="top"></label></form>
      <iframe id="cross-frame" src="${CROSS_FRAME_ORIGIN}/frame"></iframe>
    </main>`,
  );
  await expect(
    page.frameLocator("#cross-frame").locator("html"),
  ).toHaveAttribute(CONTENT_READY_ATTRIBUTE, CONTENT_READY_VALUE, {
    timeout: READY_TIMEOUT_MS,
  });
  expect(
    await page.locator("#cross-frame").evaluate((frame) => {
      const iframe = frame as HTMLIFrameElement;
      try {
        return iframe.contentDocument?.body.textContent ?? null;
      } catch (error) {
        return error instanceof DOMException ? error.name : "ERROR";
      }
    }),
  ).toBeNull();

  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const reports = await waitForFrames(controller, tabId, 2);
  expect(
    reports.map((report) => ({
      frame: report.frame_context.frame_id,
      top: report.frame_context.is_top_frame,
      labels: report.descriptors.map((item) => item.label.normalized_text),
    })),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ top: true, labels: ["Top frame field"] }),
      expect.objectContaining({ top: false, labels: ["Cross origin field"] }),
    ]),
  );
});

async function reresolve(
  controller: Page,
  tabId: number,
  address: FormFieldDescriptorV1["address"],
): Promise<ReresolveTabResult> {
  const response = await runtimeMessage(
    controller,
    buildReresolveTabRequest("browser-reresolve", tabId, address),
  );
  const parsed = parseReresolveTabResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "worker returned an invalid resolution");
}

test("legitimate semantic rerender re-resolves the unique current control", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form id="rerender-form"><h2>Contact</h2>
      <label for="before-id">Professional email</label>
      <input id="before-id" name="professionalEmail" type="email">
    </form></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const before = requireValue(
    foundDescriptors(await waitForFrames(controller, tabId, 1))[0],
    "initial descriptor is missing",
  );
  await page.locator("#rerender-form").evaluate((form) => {
    form.innerHTML = `<h2>Contact</h2>
      <label for="after-id">Professional email</label>
      <input id="after-id" name="professionalEmail" type="email">`;
  });
  const result = await reresolve(controller, tabId, before.address);
  expect(result.resolution.status).toBe("RESOLVED");
  if (result.resolution.status === "RESOLVED") {
    expect(result.resolution.descriptor.field_id).toBe(before.field_id);
    expect(result.resolution.descriptor.label.normalized_text).toBe(
      "Professional email",
    );
  }
});

test("M4: stale semantic replacement is unresolved even when it reuses the old ID and index", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form id="stale-form"><h2>Contact</h2>
      <label for="reused-id">Professional email</label>
      <input id="reused-id" name="professionalEmail" type="email">
    </form></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const before = requireValue(
    foundDescriptors(await waitForFrames(controller, tabId, 1))[0],
    "initial descriptor is missing",
  );
  await page.locator("#stale-form").evaluate((form) => {
    form.innerHTML = `<h2>Contact</h2>
      <label for="reused-id">Portfolio URL</label>
      <input id="reused-id" name="portfolioUrl" type="url">`;
  });
  const result = await reresolve(controller, tabId, before.address);
  expect(result.resolution).toEqual({
    status: "UNRESOLVED",
    reason: "NO_MATCH",
  });
});

test("M4: multiple current semantic matches return ambiguous and never pick the first", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main><form id="ambiguous-form"><h2>Contact</h2>
      <label>Professional email <input name="professionalEmail" type="email"></label>
    </form></main>`,
  );
  const tabId = await tabIdForPage(serviceWorker, page);
  const controller = await scannerController(extensionContext, extensionId);
  const before = requireValue(
    foundDescriptors(await waitForFrames(controller, tabId, 1))[0],
    "initial descriptor is missing",
  );
  await page.locator("#ambiguous-form").evaluate((form) => {
    form.innerHTML = `<h2>Contact</h2>
      <label>Professional email <input name="professionalEmail" type="email"></label>
      <label>Professional email <input name="professionalEmail" type="email"></label>`;
  });
  const result = await reresolve(controller, tabId, before.address);
  expect(result.resolution).toEqual({
    status: "AMBIGUOUS",
    candidate_count: 2,
  });
});
