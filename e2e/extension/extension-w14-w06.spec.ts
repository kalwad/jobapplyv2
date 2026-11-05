/** Complete original W06 catalog accounting, narrower mounted contact execution.
 * No fixture body replacement; no scenario-transition or non-contact success is inferred.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, platform, arch, totalmem } from "node:os";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { test, expect, EXTENSION_DIST } from "./support/extension-test.ts";
import { openHarness } from "./support/research-harness.ts";
import {
  executeMountedContact,
  type MountedContactFact,
} from "./support/autofill-mounted.ts";
import { FIXTURE_CASES } from "../../apps/mock-ats-lab/site/src/catalog/cases.ts";
import { EXPECTED_TRANSITIONS } from "../mock-ats-lab/support/expected-transitions.ts";
import { normalizeText } from "../../apps/extension/src/field-scanner.ts";
import { semanticDigest } from "../../apps/extension/src/semantic-identity.ts";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../packages/evaluation-runner/src/canonical.ts";

// Predeclared supplemental synthetic profile. FULL_NAME is an explicit
// additional fact for mounted W06 pages, not an inferred page-derived value
// and not a claim of byte-identical W12 ten-fact input.
const FACTS: readonly MountedContactFact[] = [
  { concept: "FIRST_NAME", value: "Synthetic" },
  { concept: "LAST_NAME", value: "Applicant" },
  { concept: "FULL_NAME", value: "Synthetic Applicant" },
  { concept: "EMAIL_ADDRESS", value: "synthetic@example.invalid" },
  { concept: "PHONE_NUMBER", value: "2025550100" },
  { concept: "WEBSITE_URL", value: "https://example.invalid/profile" },
  { concept: "ADDRESS_LINE_1", value: "100 Synthetic Avenue" },
  { concept: "ADDRESS_CITY", value: "Synthetic City" },
  { concept: "ADDRESS_REGION", value: "Michigan", valueToken: "Michigan" },
  { concept: "ADDRESS_POSTAL_CODE", value: "48104" },
  {
    concept: "ADDRESS_COUNTRY",
    value: "United States",
    valueToken: "United States",
  },
];
// Test-owned field/value cohort is never supplied to executeMountedContact.
// Unknown/mismatched synthetic country options are not relabeled as matches.
const EXPECTED_CONTACT: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "/native/": {
    "nat-first-name": "Synthetic",
    "nat-last-name": "Applicant",
    "nat-email": "synthetic@example.invalid",
    "nat-phone": "2025550100",
  },
  "/react/": {
    "react-full-name": "Synthetic Applicant",
    "react-email": "synthetic@example.invalid",
  },
  "/vue/": { "vue-full-name": "Synthetic Applicant" },
  "/apply/step-1/": {
    "flow-full-name": "Synthetic Applicant",
    "flow-email": "synthetic@example.invalid",
    "flow-phone": "2025550100",
  },
  "/validation/": {
    "val-email": "synthetic@example.invalid",
    "val-email-confirm": "synthetic@example.invalid",
  },
  "/dynamic/": { "dyn-region": "Michigan" },
};

function sourceSnapshot() {
  const paths = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (path) =>
        path !== "" &&
        !path.startsWith("docs/evidence/") &&
        path !== "node_modules" &&
        !path.endsWith("/node_modules"),
    );
  const files = [...new Set(paths)]
    .sort()
    .map((path) => ({ path, digest: sha256Bytes(readFileSync(path)) }));
  return {
    files,
    digest: sha256Canonical(files),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
      encoding: "utf8",
    }).trim(),
    source_state: "INVENTORY_SCOPED_NO_FROZEN_TREE_CLAIM",
  };
}
function builtFiles(
  directory: string,
  prefix = "",
): { path: string; digest: string }[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("W06_BUILT_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? builtFiles(directory, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(directory, path))) }];
    });
}

// This independent observer runs before each real page module, including
// child documents. It records physical events; it does not mutate app state,
// install rerender behavior, supply values or resolve expected answers.
function installPhysicalObserver() {
  const state = {
    events: [] as {
      key: string;
      type: string;
      value: string;
      checked: boolean | null;
    }[],
    buttonClicks: 0,
    submissions: 0,
  };
  Object.defineProperty(window, "w14MountedPhysical", {
    value: state,
    configurable: false,
  });
  const capture = (event: Event) => {
    const node = event
      .composedPath()
      .find(
        (part) =>
          part instanceof HTMLInputElement ||
          part instanceof HTMLTextAreaElement ||
          part instanceof HTMLSelectElement,
      );
    if (!(
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ))
      return;
    const changeOnly =
      node instanceof HTMLSelectElement ||
      (node instanceof HTMLInputElement &&
        ["checkbox", "radio", "file"].includes(node.type));
    if (event.type !== (changeOnly ? "change" : "input")) return;
    state.events.push({
      key: node.id,
      type: event.type,
      value: node.value,
      checked:
        node instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(node.type)
          ? node.checked
          : null,
    });
  };
  document.addEventListener("input", capture, true);
  document.addEventListener("change", capture, true);
  document.addEventListener(
    "click",
    (event) => {
      if (
        event
          .composedPath()
          .some(
            (part) =>
              part instanceof Element &&
              part.matches("button,a,input[type=submit]"),
          )
      )
        state.buttonClicks++;
    },
    true,
  );
  document.addEventListener(
    "submit",
    () => {
      state.submissions++;
    },
    true,
  );
}

// Read every actual native/ARIA control, including open shadow roots.
// Stable DOM IDs are observation joins only, never candidate authority.
async function observeMounted(page: Page) {
  return Promise.all(
    page.frames().map(async (frame) => ({
      url: frame.url(),
      url_digest: await semanticDigest(`frame-document-url-v1\0${frame.url()}`),
      state: await frame.evaluate(() => {
        const state = (
          window as unknown as {
            w14MountedPhysical: {
              events: {
                key: string;
                type: string;
                value: string;
                checked: boolean | null;
              }[];
              buttonClicks: number;
              submissions: number;
            };
          }
        ).w14MountedPhysical;
        const fields: {
          key: string;
          members: string[];
          shadow: boolean;
          label: string;
          value: string;
          required: boolean;
          disabled: boolean;
          valid: boolean;
          tag: string;
          type: string;
        }[] = [];
        const visit = (root: Document | ShadowRoot) => {
          const radioGroups = new Set<string>();
          const selected = root.querySelectorAll(
            "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),select,textarea,[role=textbox],[role=combobox],[role=listbox],[role=checkbox],[role=radiogroup]",
          );
          for (const node of selected) {
            if (!(node instanceof HTMLElement)) continue;
            const input =
              node instanceof HTMLInputElement ||
              node instanceof HTMLTextAreaElement ||
              node instanceof HTMLSelectElement
                ? node
                : null;
            const radio =
              node instanceof HTMLInputElement && node.type === "radio";
            const groupName = radio ? node.name || node.id : "";
            if (radio && radioGroups.has(groupName)) continue;
            if (radio) radioGroups.add(groupName);
            const group = radio
              ? [
                  ...root.querySelectorAll<HTMLInputElement>(
                    "input[type=radio]",
                  ),
                ].filter((member) => (member.name || member.id) === groupName)
              : [];
            const legend = radio
              ? node
                  .closest("fieldset")
                  ?.querySelector("legend")
                  ?.textContent.trim()
              : undefined;
            const label =
              legend ??
              input?.labels?.[0]?.textContent.trim() ??
              node.getAttribute("aria-label") ??
              (node.getAttribute("aria-labelledby") ?? "")
                .split(/\s+/)
                .map((id) => root.getElementById(id)?.textContent ?? "")
                .join(" ")
                .trim();
            const value = radio
              ? group
                  .filter((member) => member.checked)
                  .map((member) => member.value)
                  .join("|")
              : node instanceof HTMLInputElement && node.type === "checkbox"
                ? String(node.checked)
                : (input?.value ?? node.getAttribute("aria-valuetext") ?? "");
            fields.push({
              key: node.id,
              members: radio ? group.map((member) => member.id) : [node.id],
              shadow: root instanceof ShadowRoot,
              label,
              value,
              required: radio
                ? group.some((member) => member.required)
                : input?.required === true ||
                  node.getAttribute("aria-required") === "true",
              disabled:
                input?.disabled === true ||
                node.getAttribute("aria-disabled") === "true",
              valid:
                input?.validity.valid !== false &&
                node.getAttribute("aria-invalid") !== "true",
              tag: node.tagName,
              type:
                node instanceof HTMLInputElement
                  ? node.type
                  : (node.getAttribute("role") ?? node.tagName.toLowerCase()),
            });
          }
          for (const host of root.querySelectorAll("*"))
            if (host.shadowRoot !== null) visit(host.shadowRoot);
        };
        visit(document);
        return {
          fields,
          physical: state,
          mirrors: [
            "react-state-full-name",
            "react-state-email",
            "vue-state-full-name",
          ].map((id) => ({
            id,
            value: document.getElementById(id)?.textContent ?? null,
          })),
        };
      }),
    })),
  );
}

test("W14 W06: account for all 32 original cases with mounted real-MV3 contact execution", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(180_000);
  const directory = process.env.JAPP_W14_W06_ARTIFACT_DIRECTORY;
  const expected = {
    format_version: "W14_W06_PREDECLARED_COHORT_1",
    authority: "NONE",
    catalog: FIXTURE_CASES,
    contact: EXPECTED_CONTACT,
    facts: FACTS,
    scenario_transitions: EXPECTED_TRANSITIONS,
  };
  const expectedDigest = sha256Canonical(expected);
  // Commit the complete expected cohort BEFORE opening any candidate page.
  if (directory !== undefined) {
    mkdirSync(resolve(directory), { recursive: true });
    writeFileSync(
      resolve(directory, "predeclared-cohort.json"),
      JSON.stringify(expected, null, 2) + "\n",
    );
  }
  const source = sourceSnapshot();
  const build = builtFiles(EXTENSION_DIST);
  await extensionContext.addInitScript(installPhysicalObserver);
  const rows = [];
  for (const fixture of FIXTURE_CASES) {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      fixture.route,
    );
    try {
      // Explicit readiness of the mounted framework/control surface. Never
      // wait for or manufacture a successful candidate value.
      if (fixture.route === "/react/")
        await expect(harness.page.locator("#react-full-name")).toBeVisible();
      if (fixture.route === "/vue/")
        await expect(harness.page.locator("#vue-full-name")).toBeVisible();
      if (fixture.route === "/shadow/")
        await expect(
          harness.page.locator("#shadow-contact-name"),
        ).toBeVisible();
      if (fixture.route === "/frames/")
        await expect(
          harness.page
            .frameLocator("#frames-embed")
            .locator("#frame-reference"),
        ).toBeVisible();
      const before = await observeMounted(harness.page);
      let candidate: Awaited<ReturnType<typeof executeMountedContact>> | null =
        null;
      let error: string | null = null;
      try {
        candidate = await executeMountedContact(harness, FACTS);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      const after = await observeMounted(harness.page);
      const cohort = EXPECTED_CONTACT[fixture.route] ?? {};
      const scored = after.flatMap((frame) =>
        frame.state.fields.map((field) => {
          const scan = candidate?.frameResults.find(
            (result) =>
              result.scan.frame_context.document_url_digest ===
              frame.url_digest,
          );
          const matching =
            scan?.scan.descriptors.filter(
              (item) =>
                normalizeText(item.label.normalized_text) ===
                normalizeText(field.label),
            ) ?? [];
          const descriptor = matching.length === 1 ? matching[0] : undefined;
          const inventory =
            scan?.reconciliation.status === "RECONCILED"
              ? scan.reconciliation.inventory.items.find(
                  (item) => item.field_id === descriptor?.field_id,
                )
              : undefined;
          const actions = frame.state.physical.events.filter((item) =>
            field.members.includes(item.key),
          );
          const initial = before
            .find((item) => item.url_digest === frame.url_digest)
            ?.state.fields.find(
              (item) => item.key === field.key && item.shadow === field.shadow,
            );
          const expectation =
            frame.url === harness.page.url() ? cohort[field.key] : undefined;
          const supported = expectation !== undefined;
          return {
            ...field,
            frame_url_digest: frame.url_digest,
            supported_contact: supported,
            expected_value_digest:
              expectation === undefined ? null : sha256Canonical(expectation),
            final_value_digest: sha256Canonical(field.value),
            initial_value_digest:
              initial === undefined ? null : sha256Canonical(initial.value),
            physical_actions: actions,
            scanner_matches: matching.length,
            descriptor: descriptor ?? null,
            reconciliation_item: inventory ?? null,
            correct_contact_fill:
              supported &&
              field.value === expectation &&
              actions.length === 1 &&
              inventory?.category === "VERIFIED_FILLED",
            unsupported_write: !supported && actions.length > 0,
            unsupported_value_changed:
              !supported &&
              initial !== undefined &&
              initial.value !== field.value,
            required_unreported:
              field.required &&
              !field.disabled &&
              inventory?.category !== "VERIFIED_FILLED" &&
              !(
                inventory?.required === true &&
                inventory.visible &&
                inventory.enabled
              ),
            scanner_gap: matching.length !== 1,
          };
        }),
      );
      const missingCohort = Object.keys(cohort).filter(
        (key) =>
          !scored.some((field) => field.key === key && field.supported_contact),
      );
      rows.push({
        fixture_id: fixture.id,
        route: fixture.route,
        surfaces: fixture.surfaces,
        expected_digest: expectedDigest,
        before,
        candidate,
        error,
        after,
        scored,
        missing_cohort_controls: missingCohort,
        scenario_transitions: EXPECTED_TRANSITIONS[fixture.id]?.map(
          (transition) => ({
            transition,
            state: "NOT_EXERCISED_BY_CONTACT_ONLY_CAMPAIGN",
          }),
        ),
        measurement_state:
          error !== null
            ? "MEASUREMENT_ERROR"
            : scored.some((field) => field.required_unreported)
              ? "REQUIRED_REPORTING_GAP"
              : missingCohort.length > 0
                ? "MISSING_EXPECTED_CONTROL"
                : Object.keys(cohort).length === 0
                  ? "OBSERVED_UNSUPPORTED_ONLY"
                  : "CONTACT_COHORT_SCORED",
        final_url_unchanged: harness.page.url().endsWith(fixture.route),
      });
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  }
  const fields = rows.flatMap((row) => row.scored);
  const safety = {
    unsupported_writes: fields.filter((field) => field.unsupported_write)
      .length,
    unsupported_value_changes: fields.filter(
      (field) => field.unsupported_value_changed,
    ).length,
    duplicate_primary_events: fields.reduce(
      (sum, field) => sum + Math.max(0, field.physical_actions.length - 1),
      0,
    ),
    button_clicks: rows.reduce(
      (sum, row) =>
        sum +
        row.after.reduce(
          (n, frame) => n + frame.state.physical.buttonClicks,
          0,
        ),
      0,
    ),
    submissions: rows.reduce(
      (sum, row) =>
        sum +
        row.after.reduce((n, frame) => n + frame.state.physical.submissions, 0),
      0,
    ),
  };
  const endSource = sourceSnapshot();
  const assessment = {
    format_version: "W14_W06_MOUNTED_CONTACT_ASSESSMENT_1",
    authority: "NONE",
    gate_decision: "NOT_DECIDED",
    complete_development_gate_evidence: false,
    expected_catalog_cases: FIXTURE_CASES.length,
    recorded_catalog_cases: rows.length,
    expected_contact_controls: fields.filter((field) => field.supported_contact)
      .length,
    correct_contact_controls: fields.filter(
      (field) => field.correct_contact_fill,
    ).length,
    unreported_required_controls: fields.filter(
      (field) => field.required_unreported,
    ).length,
    scanner_gaps: fields.filter((field) => field.scanner_gap).length,
    errors: rows.filter((row) => row.error !== null).length,
    safety,
    source_unchanged:
      source.digest === endSource.digest &&
      source.commit === endSource.commit &&
      source.tree === endSource.tree,
    build_unchanged:
      sha256Canonical(build) === sha256Canonical(builtFiles(EXTENSION_DIST)),
    limitations: [
      "All 32 frozen catalog cases are accounted for, not 32 successful fill scenarios.",
      "67 frozen W03 scenario transitions remain separately NOT_EXERCISED; no transition, upload, non-contact widget, receipt or navigation certification follows.",
      "This supplementary 11-fact contact profile is not byte-identical to the W12 10-fact input.",
      "Open-shadow scanner gaps and missing required reports are failures, never safe abstention credit.",
      "125ms settle and single mounted-route executions are not Gate A p95 performance proof.",
      "W06 baseline/fixture/schema record checks remain a separate required evidence slice.",
    ],
  };
  const bundle = {
    format_version: "W14_W06_MOUNTED_CONTACT_RUN_1",
    authority: "NONE",
    expected,
    expected_digest: expectedDigest,
    source,
    build,
    runtime: {
      browser: extensionContext.browser()?.version() ?? "UNKNOWN",
      node: process.versions.node,
      hardware: {
        platform: platform(),
        architecture: arch(),
        cpu_model: cpus()[0]?.model ?? "UNKNOWN",
        memory_bytes: totalmem(),
      },
    },
    configuration: {
      mounted_pages: true,
      body_replacement: false,
      artificial_rerender: false,
      settle_budget_ms: 125,
      navigation_enabled: false,
      submission_enabled: false,
      trace_mode: testInfo.project.use.trace ?? "UNSPECIFIED",
    },
    rows,
    assessment,
  };
  const compressed = gzipSync(JSON.stringify(bundle));
  await testInfo.attach("w14-w06-mounted-run.json.gz", {
    body: compressed,
    contentType: "application/gzip",
  });
  if (directory !== undefined) {
    writeFileSync(resolve(directory, "mounted-run.json.gz"), compressed);
    writeFileSync(
      resolve(directory, "assessment.json"),
      JSON.stringify(
        { ...assessment, compressed_bundle_digest: sha256Bytes(compressed) },
        null,
        2,
      ) + "\n",
    );
  }
  // Retain all raw outcomes before correctness assertions; no unsupported
  // case is omitted and no acceptance threshold is weakened to get green.
  expect(rows.map((row) => row.fixture_id)).toEqual(
    FIXTURE_CASES.map((item) => item.id),
  );
  expect(assessment.source_unchanged).toBe(true);
  expect(assessment.build_unchanged).toBe(true);
  expect(assessment.errors).toBe(0);
  expect(rows.flatMap((row) => row.missing_cohort_controls)).toEqual([]);
  expect(assessment.correct_contact_controls).toBe(
    assessment.expected_contact_controls,
  );
  expect(assessment.unreported_required_controls).toBe(0);
  expect(assessment.scanner_gaps).toBe(0);
  expect(safety).toEqual({
    unsupported_writes: 0,
    unsupported_value_changes: 0,
    duplicate_primary_events: 0,
    button_clicks: 0,
    submissions: 0,
  });
  expect(rows.every((row) => row.final_url_unchanged)).toBe(true);
});
