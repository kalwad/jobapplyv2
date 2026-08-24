// M02-W09 real-MV3 descriptor-to-decision proof (spec §5.11.4, §5.11.7;
// REQ-FORM-017/REQ-FORM-023 feasibility portions).
//
// The REAL built W08 extension scans the mock ATS lab in bundled Playwright
// Chromium; the W09 deterministic resolver then consumes those canonical
// descriptors in the test process. The resolver is a typed internal
// library, so no new privileged wire command exists for it — exactly the
// boundary W10 will consume later. Nothing here fills, clicks, uploads,
// navigates, or submits, and the page state is proven unchanged.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Page, Worker } from "@playwright/test";

import {
  validateFormFieldDecisionV1,
  validateSemanticContractV1,
} from "../../packages/contracts/generated/typescript/index.ts";
import type { FormFieldDescriptorV1 } from "../../packages/contracts/generated/typescript/index.ts";
import {
  buildScanTabRequest,
  CONTENT_FRAME_SCAN_FOUND,
  parseAggregatedScanResult,
  type FrameScanReport,
} from "../../apps/extension/src/scanner-protocol.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import {
  buildApprovedRecordSet,
  isFeasibilityConcept,
  isFeasibilityValuePolicy,
  resolveFieldDecision,
  stableSemanticId,
  type ApprovedRecordSet,
  type ApprovedSyntheticRecord,
  type FieldDecisionResolution,
} from "../../packages/form-engine/src/index.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const READY_TIMEOUT_MS = 15_000;
const FIXTURE_PROFILE_ID = "profile_00000000000000000000000001";
const POLICIES_PATH = fileURLToPath(
  new URL(
    "../../packages/test-fixtures/data/development/field-value-policies.v2.json",
    import.meta.url,
  ),
);

interface FixtureFieldValuePolicy {
  readonly profile_ref: string;
  readonly field_concept: string;
  readonly policy: string;
  readonly source_field_record_id?: string;
  readonly recorded_value?: string;
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/**
 * Approved synthetic records for the first frozen profile: committed
 * field-value policies verbatim from the frozen corpus, plus deterministic
 * ordinary contact records anchored to the same profile. No second fixture
 * universe and no real user data.
 */
async function loadApprovedRecords(): Promise<ApprovedRecordSet> {
  const parsed = JSON.parse(readFileSync(POLICIES_PATH, "utf8")) as {
    readonly items: readonly FixtureFieldValuePolicy[];
  };
  const records: ApprovedSyntheticRecord[] = [];
  for (const policy of parsed.items) {
    if (
      policy.profile_ref !== FIXTURE_PROFILE_ID ||
      !isFeasibilityConcept(policy.field_concept)
    ) {
      continue;
    }
    if (!isFeasibilityValuePolicy(policy.policy)) {
      throw new Error(`unknown fixture policy kind: ${policy.policy}`);
    }
    records.push({
      recordId:
        policy.source_field_record_id ??
        (await stableSemanticId(
          "fieldrecord",
          `w09-e2e-policy\0${policy.field_concept}`,
        )),
      concept: policy.field_concept,
      ...(policy.recorded_value === undefined
        ? {}
        : { valueToken: policy.recorded_value }),
      policy: policy.policy,
      confirmation: { state: "MISSING" },
      valueConfidence: 1,
    });
  }
  const ordinary = [
    { concept: "FIRST_NAME", token: undefined },
    { concept: "LAST_NAME", token: undefined },
    { concept: "EMAIL_ADDRESS", token: undefined },
    { concept: "PHONE_NUMBER", token: undefined },
    { concept: "WORK_MODE_PREFERENCE", token: "REMOTE" },
  ] as const;
  for (const entry of ordinary) {
    records.push({
      recordId: await stableSemanticId(
        "fieldrecord",
        `w09-e2e-contact\0${FIXTURE_PROFILE_ID}\0${entry.concept}`,
      ),
      concept: entry.concept,
      ...(entry.token === undefined ? {} : { valueToken: entry.token }),
      policy: "FILL_FROM_EXPLICIT_RECORD",
      confirmation: { state: "MISSING" },
      valueConfidence: 1,
    });
  }
  return buildApprovedRecordSet(records);
}

interface ChromeTab {
  readonly id?: number;
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

async function scannerController(
  extensionContext: Parameters<
    Parameters<typeof test>[2]
  >[0]["extensionContext"],
  extensionId: string,
): Promise<Page> {
  const page = await extensionContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/manifest.json`);
  return page;
}

async function scanTab(
  controller: Page,
  tabId: number,
): Promise<readonly FrameScanReport[]> {
  const response = await controller.evaluate(
    async (wireMessage) => {
      const runtime = globalThis as unknown as {
        chrome: { runtime: { sendMessage(value: unknown): Promise<unknown> } };
      };
      return runtime.chrome.runtime.sendMessage(wireMessage);
    },
    buildScanTabRequest("w09-resolver-scan", tabId, {
      kind: "APPLICATION_ROOT",
    }),
  );
  const parsed = parseAggregatedScanResult(response);
  expect(parsed).not.toBeNull();
  return requireValue(parsed, "worker returned an invalid aggregate").frames;
}

async function scannedDescriptors(
  controller: Page,
  tabId: number,
): Promise<FormFieldDescriptorV1[]> {
  let reports: readonly FrameScanReport[] = [];
  await expect
    .poll(
      async () => {
        reports = await scanTab(controller, tabId);
        return reports.length;
      },
      { timeout: READY_TIMEOUT_MS },
    )
    .toBe(1);
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
  return requireValue(descriptor, `descriptor labelled ${label} is missing`);
}

async function waitForReady(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute(
    CONTENT_READY_ATTRIBUTE,
    CONTENT_READY_VALUE,
    { timeout: READY_TIMEOUT_MS },
  );
}

async function setScannerFixture(page: Page, body: string): Promise<void> {
  await waitForReady(page);
  await page.locator("body").evaluate((element, markup) => {
    element.innerHTML = markup;
  }, body);
}

interface PageStateSnapshot {
  readonly url: string;
  readonly values: Record<string, string>;
  readonly checked: Record<string, boolean>;
}

interface PageActionSnapshot {
  clicks: number;
  inputs: number;
  changes: number;
  submits: number;
}

async function installActionMonitor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counts: PageActionSnapshot = {
      clicks: 0,
      inputs: 0,
      changes: 0,
      submits: 0,
    };
    const runtime = globalThis as typeof globalThis & {
      __jappW09ActionCounts?: PageActionSnapshot;
    };
    runtime.__jappW09ActionCounts = counts;
    document.addEventListener("click", () => (counts.clicks += 1), true);
    document.addEventListener("input", () => (counts.inputs += 1), true);
    document.addEventListener("change", () => (counts.changes += 1), true);
    document.addEventListener("submit", () => (counts.submits += 1), true);
  });
}

async function snapshotPageActions(page: Page): Promise<PageActionSnapshot> {
  return page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __jappW09ActionCounts?: PageActionSnapshot;
    };
    const counts = runtime.__jappW09ActionCounts;
    if (counts === undefined) {
      throw new Error("W09 action monitor is missing");
    }
    return { ...counts };
  });
}

async function snapshotPageState(page: Page): Promise<PageStateSnapshot> {
  return page.evaluate(() => {
    const values: Record<string, string> = {};
    const checked: Record<string, boolean> = {};
    const controls = document.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");
    controls.forEach((control, index) => {
      const key = `${String(index)}:${control.getAttribute("name") ?? ""}`;
      values[key] = control.value;
      if (control instanceof HTMLInputElement) {
        checked[key] = control.checked;
      }
    });
    return { url: document.location.href, values, checked };
  });
}

async function resolveAll(
  descriptors: readonly FormFieldDescriptorV1[],
  records: ApprovedRecordSet,
): Promise<Map<string, FieldDecisionResolution>> {
  const correlationId = await stableSemanticId("cor", "w09-e2e-resolver");
  const resolutions = new Map<string, FieldDecisionResolution>();
  for (const descriptor of descriptors) {
    const outcome = await resolveFieldDecision({
      descriptor,
      records,
      correlationId,
    });
    expect(outcome.status).toBe("RESOLVED");
    if (outcome.status !== "RESOLVED") {
      throw new Error("descriptor from the real scanner must be canonical");
    }
    resolutions.set(
      descriptor.label.normalized_text ?? descriptor.field_id,
      outcome.resolution,
    );
  }
  return resolutions;
}

function resolutionFor(
  resolutions: ReadonlyMap<string, FieldDecisionResolution>,
  label: string,
): FieldDecisionResolution {
  return requireValue(resolutions.get(label), `no resolution for ${label}`);
}

test("W09 turns real scanned native-lab descriptors into canonical safe decisions without any browser action", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await waitForReady(page);
  await installActionMonitor(page);
  const before = await snapshotPageState(page);
  const controller = await scannerController(extensionContext, extensionId);
  const tabId = await tabIdForPage(serviceWorker, page);
  const descriptors = await scannedDescriptors(controller, tabId);
  const records = await loadApprovedRecords();
  const resolutions = await resolveAll(descriptors, records);

  // Every decision derived from real built-extension descriptors is
  // canonical, structurally and under FIELD_DECISION_AUTHORITY.
  for (const resolution of resolutions.values()) {
    expect(validateFormFieldDecisionV1(resolution.decision).valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-decision:v1",
        resolution.decision,
      ).valid,
    ).toBe(true);
  }

  // Representative ordinary concept resolves deterministically to FILL.
  const email = resolutionFor(resolutions, "Email address (required)");
  expect(email.decision.field_concept).toBe("EMAIL_ADDRESS");
  expect(email.decision.final_decision).toBe("FILL");
  expect(email.decision.value_source_type).toBe("USER_RECORD");

  // The intended select option is chosen semantically, matching the real
  // rendered option's inert digest.
  const workMode = resolutionFor(resolutions, "Preferred work mode (required)");
  expect(workMode.decision.field_concept).toBe("WORK_MODE_PREFERENCE");
  expect(workMode.decision.final_decision).toBe("FILL");
  const workModeDescriptor = descriptorByLabel(
    descriptors,
    "Preferred work mode (required)",
  );
  const remoteOption = workModeDescriptor.options.find(
    (option) => option.label.normalized_text === "Remote",
  );
  expect(workMode.optionResolution).toEqual({
    status: "RESOLVED",
    valueDigest: requireValue(remoteOption, "Remote option missing")
      .value_digest,
    matchedBy: "EXACT_LABEL",
  });

  // Representative consequential concept follows its explicit-record
  // policy, selecting the semantically matching real option.
  const authorization = resolutionFor(
    resolutions,
    "Are you legally authorized to work in the country of this synthetic posting? (required)",
  );
  expect(authorization.decision.field_concept).toBe("WORK_AUTHORIZATION");
  expect(authorization.decision.final_decision).toBe("FILL");
  expect(authorization.decision.value_source_ref).toBe(
    "fieldrecord_00000000000000000000000001",
  );
  expect(authorization.optionResolution?.status).toBe("RESOLVED");

  // Representative sensitive concept receives deny policy: voluntary
  // demographics are never auto-answered.
  const veteran = resolutionFor(
    resolutions,
    "Voluntary veteran status (optional)",
  );
  expect(veteran.decision.field_concept).toBe("DEMOGRAPHIC_DISCLOSURE");
  expect(veteran.decision.sensitivity_class).toBe("SENSITIVE");
  expect(veteran.decision.policy_decision).toBe("DENY");
  expect(veteran.decision.final_decision).toBe("SKIP_OPTIONAL");

  // The concealed honeypot is blocked, never filled.
  const honeypot = resolutionFor(resolutions, "Company website");
  expect(honeypot.decision.final_decision).toBe("BLOCK_UNSUPPORTED");

  // A required field without an approved record is reported, not guessed.
  const startDate = resolutionFor(
    resolutions,
    "Earliest start date (required)",
  );
  expect(startDate.decision.final_decision).toBe("PAUSE_FOR_CONFIRMATION");
  expect(startDate.decision.value_source_type).toBe("NONE");

  // Exactly the approved-record-backed controls are FILL-eligible; nothing
  // sensitive, concealed, or unsupported is.
  const fillLabels = [...resolutions.entries()]
    .filter(([, value]) => value.decision.final_decision === "FILL")
    .map(([label]) => label)
    .sort();
  expect(fillLabels).toEqual([
    "Are you legally authorized to work in the country of this synthetic posting? (required)",
    "Email address (required)",
    "First name (required)",
    "Last name (required)",
    "Phone (optional)",
    "Preferred work mode (required)",
  ]);

  // Deciding performed no fill, click, or navigation: the page state is
  // byte-identical.
  const after = await snapshotPageState(page);
  expect(after).toEqual(before);
  expect(await snapshotPageActions(page)).toEqual({
    clicks: 0,
    inputs: 0,
    changes: 0,
    submits: 0,
  });
});

test("W09 abstains on single-option fields instead of selecting the only rendered option", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const page = await extensionContext.newPage();
  await page.goto(`${LAB_ORIGIN}/native/`);
  await setScannerFixture(
    page,
    `<main aria-labelledby="single-option-title">
      <h1 id="single-option-title">Synthetic single option lab</h1>
      <form id="single-option-form">
        <label for="so-work-mode">Preferred work mode</label>
        <select id="so-work-mode" name="soWorkMode" required>
          <option value="gold-tier">Gold tier</option>
        </select>
        <label for="so-mascot">Favorite synthetic mascot</label>
        <select id="so-mascot" name="soMascot">
          <option value="blue-heron">Blue heron (synthetic)</option>
        </select>
        <fieldset>
          <legend>Reference 1</legend>
          <label for="so-reference-email">Email</label>
          <input id="so-reference-email" name="soReferenceEmail" type="email" required>
        </fieldset>
      </form>
    </main>`,
  );
  await installActionMonitor(page);
  const before = await snapshotPageState(page);
  const controller = await scannerController(extensionContext, extensionId);
  const tabId = await tabIdForPage(serviceWorker, page);
  const descriptors = await scannedDescriptors(controller, tabId);
  const records = await loadApprovedRecords();
  const resolutions = await resolveAll(descriptors, records);

  // Known concept, approved value REMOTE, one unrelated rendered option:
  // the resolver abstains for review; it never selects "Gold tier".
  const workMode = resolutionFor(resolutions, "Preferred work mode");
  expect(workMode.decision.field_concept).toBe("WORK_MODE_PREFERENCE");
  expect(workMode.optionResolution).toEqual({
    status: "ABSTAINED",
    reason: "NO_SEMANTIC_MATCH",
  });
  expect(workMode.decision.final_decision).toBe("PAUSE_FOR_CONFIRMATION");
  expect(workMode.decision.final_decision).not.toBe("FILL");

  // Unknown concept with a single rendered option abstains outright.
  const mascot = resolutionFor(resolutions, "Favorite synthetic mascot");
  expect(mascot.decision.field_concept).toBe("UNKNOWN");
  expect(mascot.decision.final_decision).toBe("BLOCK_UNSUPPORTED");

  // Real W08 section extraction emits singular numbered REFERENCE_1. That
  // contradictory other-party context lowers applicant-email classification
  // below deterministic authority, so the resolver can only propose review.
  const referenceDescriptor = descriptorByLabel(descriptors, "Email");
  expect(referenceDescriptor.section_context).toContain("REFERENCE_1");
  const referenceEmail = resolutionFor(resolutions, "Email");
  expect(referenceEmail.decision.field_concept).toBe("EMAIL_ADDRESS");
  expect(referenceEmail.decision.classification_confidence).toBeLessThan(0.75);
  expect(referenceEmail.decision.final_decision).toBe("PROPOSE");
  expect(referenceEmail.decision.final_decision).not.toBe("FILL");

  const after = await snapshotPageState(page);
  expect(after).toEqual(before);
  expect(await snapshotPageActions(page)).toEqual({
    clicks: 0,
    inputs: 0,
    changes: 0,
    submits: 0,
  });
});
