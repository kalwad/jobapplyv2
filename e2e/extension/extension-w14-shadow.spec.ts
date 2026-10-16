import {
  buildUndoTabRequest,
  parseUndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
/** W14 regression on the unchanged frozen W03 mounted open-shadow page.
 * Expected behavior is required-field reporting without an other-party fill.
 * A failed assertion preserves the actual missing-root evidence; it is not PASS.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  scanFrames,
  dynReconcile,
} from "./support/research-harness.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";

test("W14 W06 MAL-SHD-001: open-shadow other-party required field is reported and never filled", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/shadow/",
  );
  try {
    // Playwright's independent locator pierces the OPEN shadow root. The
    // candidate still receives no node reference, selector, or expected answer.
    const actual = await harness.page
      .locator("#shadow-contact-name")
      .evaluate((node) => ({
        id: node.id,
        required: (node as HTMLInputElement).required,
        value: (node as HTMLInputElement).value,
        open_root:
          node.getRootNode() instanceof ShadowRoot &&
          (node.getRootNode() as ShadowRoot).mode === "open",
        owner_label:
          ((node as HTMLInputElement).labels?.[0]?.textContent ?? "").trim() ||
          null,
      }));
    const frames = await scanFrames(harness);
    const top = frames.find((frame) => frame.frame_context.is_top_frame);
    const descriptor = top?.descriptors.find(
      (field) =>
        field.label.normalized_text === "Emergency contact name (required)",
    );
    const decision =
      descriptor === undefined
        ? null
        : await resolveFieldDecision({
            descriptor,
            records: buildApprovedRecordSet([
              {
                recordId: await stableSemanticId(
                  "record",
                  "w14-shadow-applicant-full-name",
                ),
                concept: "FULL_NAME",
                policy: "FILL_FROM_EXPLICIT_RECORD",
                confirmation: { state: "MISSING" },
                valueConfidence: 1,
              },
            ]),
            correlationId: await stableSemanticId(
              "cor",
              "w14-shadow-other-party-required",
            ),
          });
    const reconciliation =
      top === undefined
        ? null
        : await dynReconcile(harness, top.frame_context.frame_id);
    const evidence = {
      format_version: "W14_W06_SHADOW_REPORTING_REGRESSION_1",
      authority: "NONE",
      fixture_id: "MAL-SHD-001",
      expected: {
        required_observed: true,
        candidate_reports_required: true,
        applicant_fill_permitted: false,
      },
      actual,
      frames,
      decision,
      reconciliation,
      application_actions: 0,
      limitations: [
        "Mounted open-shadow fixture only; no closed-shadow claim; no product submit capability.",
      ],
    };
    const text = JSON.stringify(evidence, null, 2) + "\n";
    await testInfo.attach("w14-shadow-required-gap.json", {
      body: text,
      contentType: "application/json",
    });
    const directory = process.env.JAPP_W14_W06_ARTIFACT_DIRECTORY;
    if (directory !== undefined) {
      mkdirSync(resolve(directory), { recursive: true });
      writeFileSync(resolve(directory, "shadow-required-gap.json"), text);
    }
    // Correct product expectations remain assertions, rather than accepting
    // UNAVAILABLE/empty inventory as a successful protected-field abstention.
    expect(actual.open_root).toBe(true);
    expect(actual.required).toBe(true);
    expect(actual.value).toBe("");
    expect(top?.root_status).toBe("FOUND");
    expect(descriptor).toBeDefined();
    expect(descriptor?.required).toBe(true);
    expect(decision?.status).toBe("RESOLVED");
    if (decision?.status === "RESOLVED")
      expect(decision.resolution.decision.final_decision).not.toBe("FILL");
    expect(reconciliation?.status).toBe("RECONCILED");
    if (reconciliation?.status === "RECONCILED") {
      expect(
        reconciliation.inventory.counts.required_unresolved,
      ).toBeGreaterThanOrEqual(1);
      expect(reconciliation.inventory.readiness).toBe("NOT_READY");
    }
    expect(
      await harness.page.locator("#shadow-contact-name").inputValue(),
    ).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

// All writes below are approved through the real W09 resolver. These are
// synthetic contact facts, never a forced decision or selector-based target.
import type { FormFieldDescriptorV1 } from "../../packages/contracts/generated/typescript/index.ts";
import {
  buildTransaction,
  descriptorByLabel,
  dynExecute,
  dynStart,
  foundTopFrame,
  reconciled,
  requireValue,
  runtimeMessage,
  nextId,
  setFixture,
  type Harness,
} from "./support/research-harness.ts";

async function ownFirstNameTransaction(
  field: FormFieldDescriptorV1,
  seed: string,
) {
  const resolved = await resolveFieldDecision({
    descriptor: field,
    records: buildApprovedRecordSet([
      {
        recordId: await stableSemanticId("record", "w14-shadow-own-first-name"),
        concept: "FIRST_NAME",
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]),
    correlationId: await stableSemanticId("cor", seed),
  });
  expect(resolved.status).toBe("RESOLVED");
  if (resolved.status !== "RESOLVED")
    throw new Error("shadow decision refused");
  expect(resolved.resolution.decision.final_decision).toBe("FILL");
  return buildTransaction(
    field,
    { kind: "TEXT", text: "Synthetic" },
    resolved.resolution.decision,
    seed,
  );
}

async function createShadow(harness: Harness, markup: string, hosts = 1) {
  await setFixture(
    harness,
    `<main data-japp-application-root aria-label="Application"><h1>Contact</h1>${Array.from({ length: hosts }, (_, i) => `<div id="host-${String(i)}"></div>`).join("")}</main>`,
  );
  await harness.page.evaluate(
    ({ html, count }) => {
      for (let i = 0; i < count; i++)
        document
          .getElementById(`host-${String(i)}`)
          ?.attachShadow({ mode: "open" })
          .replaceChildren(
            document.createRange().createContextualFragment(html),
          );
    },
    { html: markup, count: hosts },
  );
}
const OWN =
  '<label for="given">First name</label><input id="given" name="given" required aria-describedby="error"><p id="error" class="error"></p>';

for (const scenario of [
  "approved",
  "duplicate",
  "late-duplicate",
  "rerender",
  "removed",
  "removed-host",
  "hidden-host",
  "transparent-host",
  "disabled-host",
  "local-error",
  "local-aria",
  "focus-duplicate",
  "during-action-duplicate",
] as const) {
  test(`W14 open shadow: ${scenario}`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await harness.page.bringToFront();
      await createShadow(
        harness,
        scenario === "local-aria"
          ? '<span id="accessible">First name</span><input id="given" name="given" required aria-labelledby="accessible" aria-describedby="error"><p id="error" class="error"></p>'
          : OWN,
        scenario === "duplicate" ? 2 : 1,
      );
      await harness.page.evaluate(() => {
        const host = document.createElement("div");
        host.id = "boundary-host";
        document.querySelector("main")?.append(host);
      });
      // Same ID outside the local tree must never label/validate shadow fields.
      await harness.page.evaluate(() => {
        document.body.insertAdjacentHTML(
          "beforeend",
          '<label for="given">Employer first name</label><p id="error" class="error">Wrong global error</p><span id="accessible">Employer first name</span>',
        );
      });
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "First name");
      expect(field.required).toBe(true);
      let transaction = await ownFirstNameTransaction(
        field,
        `shadow-${scenario}`,
      );
      // Build the current semantic index once before a silent root attachment.
      await dynReconcile(harness, top.frame_context.frame_id);
      if (scenario === "late-duplicate")
        await harness.page.evaluate(() => {
          const host = document.createElement("div");
          host.id = "late-host";
          document.querySelector("main")?.append(host);
          // Let the light DOM observer drain before attaching the previously empty host.
          (window as unknown as { lateHost: HTMLElement }).lateHost = host;
        });
      if (scenario === "late-duplicate") {
        await dynReconcile(harness, top.frame_context.frame_id);
        await harness.page.evaluate(
          (html) =>
            ((
              window as unknown as { lateHost: HTMLElement }
            ).lateHost.attachShadow({ mode: "open" }).innerHTML = html),
          OWN,
        );
      }
      await harness.page.evaluate(
        ({ scenario }) => {
          const root = requireRoot();
          function requireRoot() {
            const value = document.getElementById("host-0")?.shadowRoot;
            if (!value) throw new Error("root absent");
            return value;
          }
          const meter = { inputs: 0, rerenders: 0 };
          (window as unknown as { shadowMeter: typeof meter }).shadowMeter =
            meter;
          root.addEventListener(
            "focus",
            () => {
              if (scenario === "focus-duplicate")
                document
                  .getElementById("boundary-host")
                  ?.attachShadow({ mode: "open" })
                  .replaceChildren(
                    document
                      .createRange()
                      .createContextualFragment(
                        '<label for="given">First name</label><input id="given" name="given" required>',
                      ),
                  );
            },
            { capture: true, once: true },
          );
          root.addEventListener(
            "input",
            (event) => {
              if (!(event.target instanceof HTMLInputElement)) return;
              meter.inputs++;
              if (scenario === "during-action-duplicate")
                document
                  .getElementById("boundary-host")
                  ?.attachShadow({ mode: "open" })
                  .replaceChildren(
                    document
                      .createRange()
                      .createContextualFragment(
                        '<label for="given">First name</label><input id="given" name="given" required>',
                      ),
                  );
              const node = event.target;
              const value = node.value;
              if (
                scenario === "rerender" ||
                scenario === "removed" ||
                scenario === "removed-host"
              )
                setTimeout(() => {
                  if (scenario === "removed") node.remove();
                  else if (scenario === "removed-host")
                    document.getElementById("host-0")?.remove();
                  else {
                    const replacement = node.cloneNode(
                      true,
                    ) as HTMLInputElement;
                    replacement.value = value;
                    node.replaceWith(replacement);
                  }
                  meter.rerenders++;
                }, 20);
            },
            true,
          );
          if (scenario === "hidden-host")
            document
              .getElementById("host-0")
              ?.setAttribute("aria-hidden", "true");
          if (scenario === "transparent-host") {
            const host = document.getElementById("host-0");
            if (host) host.style.opacity = "0";
          }
          if (scenario === "disabled-host") {
            const host = document.getElementById("host-0");
            if (host) {
              const fieldset = document.createElement("fieldset");
              fieldset.disabled = true;
              host.replaceWith(fieldset);
              fieldset.append(host);
            }
          }
          if (scenario === "local-error") {
            const error = root.getElementById("error");
            if (error) error.textContent = "Site rejects this value";
          }
        },
        { scenario },
      );
      if (scenario === "local-error") {
        const current = descriptorByLabel(
          foundTopFrame(await scanFrames(harness)).descriptors,
          "First name",
        );
        transaction = await ownFirstNameTransaction(
          current,
          "shadow-local-error-current-description",
        );
      }
      const result = requireValue(
        (await dynExecute(harness, [transaction])).items[0],
        "missing result",
      );
      expect(result.status).toBe("EXECUTED");
      if (result.status !== "EXECUTED")
        throw new Error("missing driver result");
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              shadowMeter: { inputs: number; rerenders: number };
            }
          ).shadowMeter,
      );
      if (
        scenario === "duplicate" ||
        scenario === "late-duplicate" ||
        scenario === "hidden-host" ||
        scenario === "transparent-host" ||
        scenario === "disabled-host" ||
        scenario === "focus-duplicate"
      ) {
        expect(meter.inputs).toBe(0);
        expect(result.result.outcome).not.toBe("VERIFIED");
        if (scenario === "duplicate" || scenario === "late-duplicate")
          expect(result.result.resolution_result).toBe("AMBIGUOUS");
      } else {
        expect(meter.inputs).toBe(1);
        expect(result.result.action_attempt.duration_ms).toBeGreaterThanOrEqual(
          75,
        );
        if (
          scenario === "removed" ||
          scenario === "removed-host" ||
          scenario === "local-error" ||
          scenario === "during-action-duplicate"
        )
          expect(result.result.outcome).not.toBe("VERIFIED");
        else {
          expect(result.result.outcome).toBe("VERIFIED");
          expect(result.result.persistence_verified).toBe(true);
          expect(result.result.site_acceptance).toBe("ACCEPTED");
          expect(await harness.page.locator("#given").inputValue()).toBe(
            "Synthetic",
          );
        }
      }
      if (
        scenario === "duplicate" ||
        scenario === "late-duplicate" ||
        scenario === "focus-duplicate" ||
        scenario === "during-action-duplicate"
      ) {
        expect(
          (await dynReconcile(harness, top.frame_context.frame_id)).status,
        ).toBe("ROOT_AMBIGUOUS");
      }
      if (
        scenario === "rerender" ||
        scenario === "removed" ||
        scenario === "removed-host"
      )
        expect(meter.rerenders).toBe(1);
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

test("W14 open shadow: late attached unknown required control joins active reconciliation", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN);
    await harness.page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "late-host";
      document.querySelector("main")?.append(host);
    });
    const top = foundTopFrame(await scanFrames(harness));
    expect((await dynStart(harness, top.frame_context.frame_id)).status).toBe(
      "STARTED",
    );
    await dynReconcile(harness, top.frame_context.frame_id);
    await harness.page.evaluate(() => {
      const host = document.getElementById("late-host");
      if (!host) throw new Error("host absent");
      host.attachShadow({ mode: "open" }).innerHTML =
        '<label for="unknown">Emergency contact name (required)</label><input id="unknown" required>';
    });
    const inventory = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    ).inventory;
    expect(inventory.items.filter((item) => item.required)).toHaveLength(2);
    expect(inventory.counts.required_unresolved).toBe(2);
    expect(inventory.readiness).toBe("NOT_READY");
    expect(await harness.page.locator("#unknown").inputValue()).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 open shadow: root capacity refuses complete-inventory claims", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN, 65);
    const top = (await scanFrames(harness)).find(
      (frame) => frame.frame_context.is_top_frame,
    );
    expect(top?.root_status).toBe("CAPACITY_EXCEEDED");
    expect(top?.descriptors).toEqual([]);
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

for (const owner of ["Employer", "Recruiter"] as const) {
  test(`W14 open shadow: host ${owner} context prevents applicant fill`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await createShadow(harness, OWN);
      await harness.page.evaluate((owner) => {
        const host = document.getElementById("host-0");
        if (!host) throw new Error("host absent");
        const section = document.createElement("section");
        section.setAttribute("aria-label", owner);
        host.replaceWith(section);
        section.append(host);
      }, owner);
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "First name");
      expect(field.address.section_path).toContain(owner.toUpperCase());
      const decision = await resolveFieldDecision({
        descriptor: field,
        records: buildApprovedRecordSet([
          {
            recordId: await stableSemanticId(
              "record",
              "shadow-own-contact-context",
            ),
            concept: "FIRST_NAME",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: await stableSemanticId("cor", `shadow-${owner}`),
      });
      expect(decision.status).toBe("RESOLVED");
      if (decision.status === "RESOLVED")
        expect(decision.resolution.decision.final_decision).not.toBe("FILL");
      const inventory = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      ).inventory;
      expect(inventory.counts.required_unresolved).toBe(1);
      expect(inventory.readiness).toBe("NOT_READY");
      expect(await harness.page.locator("#given").inputValue()).toBe("");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

test("W14 open shadow: native select remains inventoried and refuses unsupported shadow action", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(
      harness,
      '<label for="country">Country</label><select id="country" name="country" required><option value="">Choose</option><option value="US">United States</option></select>',
    );
    const top = foundTopFrame(await scanFrames(harness));
    const field = descriptorByLabel(top.descriptors, "Country");
    expect(field.control_kind).toBe("SELECT");
    expect(field.required).toBe(true);
    const decision = await resolveFieldDecision({
      descriptor: field,
      records: buildApprovedRecordSet([
        {
          recordId: await stableSemanticId("record", "shadow-select"),
          concept: "ADDRESS_COUNTRY",
          valueToken: "US",
          policy: "FILL_FROM_EXPLICIT_RECORD",
          confirmation: { state: "MISSING" },
          valueConfidence: 1,
        },
      ]),
      correlationId: await stableSemanticId("cor", "shadow-select"),
    });
    expect(decision.status).toBe("RESOLVED");
    if (
      decision.status !== "RESOLVED" ||
      decision.resolution.optionResolution?.status !== "RESOLVED"
    )
      throw new Error("approved country option missing");
    expect(decision.resolution.decision.final_decision).toBe("FILL");
    const transaction = await buildTransaction(
      field,
      {
        kind: "OPTION",
        value_digest: decision.resolution.optionResolution.valueDigest,
      },
      decision.resolution.decision,
      "shadow-select",
    );
    const result = requireValue(
      (await dynExecute(harness, [transaction])).items[0],
      "missing unsupported result",
    );
    expect(result.status).toBe("EXECUTED");
    if (result.status === "EXECUTED")
      expect(result.result.outcome).toBe("UNSUPPORTED");
    const inventory = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    ).inventory;
    expect(inventory.counts.required_unresolved).toBe(1);
    expect(inventory.readiness).toBe("NOT_READY");
    expect(await harness.page.locator("#country").inputValue()).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 open shadow: new required root during action remains unresolved after settlement", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN);
    await harness.page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "conditional-host";
      document.querySelector("main")?.append(host);
    });
    const top = foundTopFrame(await scanFrames(harness));
    const transaction = await ownFirstNameTransaction(
      descriptorByLabel(top.descriptors, "First name"),
      "shadow-conditional",
    );
    expect((await dynStart(harness, top.frame_context.frame_id)).status).toBe(
      "STARTED",
    );
    await harness.page.evaluate(() => {
      document.getElementById("host-0")?.shadowRoot?.addEventListener(
        "input",
        () => {
          const host = document.getElementById("conditional-host");
          if (!host) throw new Error("host absent");
          host.attachShadow({ mode: "open" }).innerHTML =
            '<label for="conditional">Emergency contact name (required)</label><input id="conditional" required>';
        },
        { once: true },
      );
    });
    const result = requireValue(
      (await dynExecute(harness, [transaction])).items[0],
      "missing conditional result",
    );
    expect(result.status).toBe("EXECUTED");
    if (result.status === "EXECUTED")
      expect(result.result.conditional_field_ids.length).toBeGreaterThan(0);
    const inventory = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    ).inventory;
    expect(inventory.items.filter((item) => item.required)).toHaveLength(2);
    expect(inventory.counts.required_unresolved).toBeGreaterThanOrEqual(1);
    expect(inventory.readiness).toBe("NOT_READY");
    expect(await harness.page.locator("#conditional").inputValue()).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 open shadow: duplicate local validation IDs prevent verified acceptance", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN);
    const top = foundTopFrame(await scanFrames(harness));
    const transaction = await ownFirstNameTransaction(
      descriptorByLabel(top.descriptors, "First name"),
      "shadow-duplicate-error",
    );
    await harness.page.evaluate(() => {
      document
        .getElementById("host-0")
        ?.shadowRoot?.append(
          document
            .createRange()
            .createContextualFragment(
              '<p id="error" class="error">Site rejects the input</p>',
            ),
        );
    });
    const result = requireValue(
      (await dynExecute(harness, [transaction])).items[0],
      "missing duplicate error result",
    );
    expect(result.status).toBe("EXECUTED");
    if (result.status === "EXECUTED") {
      expect(result.result.outcome).not.toBe("VERIFIED");
      expect(result.result.site_acceptance).toBe("UNKNOWN");
    }
    expect(await harness.page.locator("#given").inputValue()).toBe("");
    expect(
      reconciled(await dynReconcile(harness, top.frame_context.frame_id))
        .inventory.readiness,
    ).toBe("NOT_READY");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 open shadow: duplicate local label IDs do not gain applicant authority", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(
      harness,
      '<span id="label">First name</span><span id="label">Employer first name</span><input id="ambiguous-label" name="first_name" aria-labelledby="label" required>',
    );
    const top = foundTopFrame(await scanFrames(harness));
    expect(top.descriptors).toHaveLength(1);
    const field = requireValue(
      top.descriptors[0],
      "missing ambiguous-label field",
    );
    expect(field.label.normalized_text).toBeUndefined();
    const decision = await resolveFieldDecision({
      descriptor: field,
      records: buildApprovedRecordSet([
        {
          recordId: await stableSemanticId("record", "shadow-label"),
          concept: "FIRST_NAME",
          policy: "FILL_FROM_EXPLICIT_RECORD",
          confirmation: { state: "MISSING" },
          valueConfidence: 1,
        },
      ]),
      correlationId: await stableSemanticId("cor", "shadow-label"),
    });
    expect(decision.status).toBe("RESOLVED");
    if (decision.status === "RESOLVED")
      expect(decision.resolution.decision.final_decision).not.toBe("FILL");
    expect(
      reconciled(await dynReconcile(harness, top.frame_context.frame_id))
        .inventory.counts.required_unresolved,
    ).toBe(1);
    expect(await harness.page.locator("#ambiguous-label").inputValue()).toBe(
      "",
    );
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 open shadow: duplicate identities introduced together in one observed subtree refuse readiness", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN);
    const top = foundTopFrame(await scanFrames(harness));
    expect((await dynStart(harness, top.frame_context.frame_id)).status).toBe(
      "STARTED",
    );
    await dynReconcile(harness, top.frame_context.frame_id);
    await harness.page.evaluate(() => {
      const root = document.getElementById("host-0")?.shadowRoot;
      if (!root) throw new Error("root absent");
      root.innerHTML =
        '<input aria-label="First name" name="given" required><input aria-label="First name" name="given" required>';
    });
    const result = await dynReconcile(harness, top.frame_context.frame_id);
    expect(result.status).toBe("ROOT_AMBIGUOUS");
    if (result.status === "ROOT_AMBIGUOUS")
      expect(result.candidate_count).toBe(2);
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

for (const local of ["DOCUMENT", "SHADOW"] as const) {
  for (const ownership of ["DESCRIPTION", "SECTION"] as const) {
    test(`W14 ${local} ambiguous ${ownership} ownership never fills applicant fact`, async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      const harness = await openHarness(
        extensionContext,
        extensionId,
        serviceWorker,
        "/native/",
      );
      try {
        const duplicates =
          '<span id="owner">Own contact</span><span id="owner">Employer contact</span>';
        const markup =
          ownership === "DESCRIPTION"
            ? duplicates +
              '<label for="ambiguous">First name</label><input id="ambiguous" name="given" aria-describedby="owner" required>'
            : '<section aria-labelledby="owner">' +
              duplicates +
              '<label for="ambiguous">First name</label><input id="ambiguous" name="given" required></section>';
        if (local === "SHADOW") await createShadow(harness, markup);
        else
          await setFixture(
            harness,
            '<main data-japp-application-root aria-label="Application">' +
              markup +
              "</main>",
          );
        const top = foundTopFrame(await scanFrames(harness));
        expect(top.descriptors).toHaveLength(1);
        const field = requireValue(
          top.descriptors[0],
          "ambiguous ownership missing",
        );
        const decision = await resolveFieldDecision({
          descriptor: field,
          records: buildApprovedRecordSet([
            {
              recordId: await stableSemanticId("record", "ambiguous-ownership"),
              concept: "FIRST_NAME",
              policy: "FILL_FROM_EXPLICIT_RECORD",
              confirmation: { state: "MISSING" },
              valueConfidence: 1,
            },
          ]),
          correlationId: await stableSemanticId("cor", `${local}-${ownership}`),
        });
        expect(decision.status).toBe("RESOLVED");
        if (decision.status === "RESOLVED")
          expect(decision.resolution.decision.final_decision).not.toBe("FILL");
        expect(await harness.page.locator("#ambiguous").inputValue()).toBe("");
        expect(
          reconciled(await dynReconcile(harness, top.frame_context.frame_id))
            .inventory.counts.required_unresolved,
        ).toBe(1);
      } finally {
        await harness.page.close();
        await harness.controller.close();
      }
    });
  }
}

test("W14 cached outside host: silently attached competing application refuses previous field authority", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await createShadow(harness, OWN);
    await harness.page.evaluate(() => {
      const host = document.createElement("aside");
      host.id = "outside-host";
      document.body.append(host);
    });
    const top = foundTopFrame(await scanFrames(harness));
    const transaction = await ownFirstNameTransaction(
      descriptorByLabel(top.descriptors, "First name"),
      "outside-root",
    );
    await dynReconcile(harness, top.frame_context.frame_id);
    await harness.page.evaluate(() => {
      document
        .getElementById("outside-host")
        ?.attachShadow({ mode: "open" })
        .replaceChildren(
          document
            .createRange()
            .createContextualFragment(
              '<main data-japp-application-root><label for="competitor">First name</label><input id="competitor" name="given" required></main>',
            ),
        );
    });
    const outcome = requireValue(
      (await dynExecute(harness, [transaction])).items[0],
      "missing outside root outcome",
    );
    expect(outcome.status).toBe("EXECUTED");
    if (outcome.status === "EXECUTED")
      expect(outcome.result.outcome).not.toBe("VERIFIED");
    expect(await harness.page.locator("#given").inputValue()).toBe("");
    expect(await harness.page.locator("#competitor").inputValue()).toBe("");
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

for (const local of ["DOCUMENT", "SHADOW"] as const) {
  test(`W14 ${local} SVG description retains Employer negative evidence`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      const markup =
        '<svg><text id="svg-owner">Employer contact</text></svg><label for="svg-field">First name</label><input id="svg-field" name="given" required aria-describedby="svg-owner">';
      if (local === "SHADOW") await createShadow(harness, markup);
      else
        await setFixture(
          harness,
          "<main data-japp-application-root>" + markup + "</main>",
        );
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "First name");
      expect(field.description?.normalized_text).toBe("Employer contact");
      const decision = await resolveFieldDecision({
        descriptor: field,
        records: buildApprovedRecordSet([
          {
            recordId: await stableSemanticId("record", "svg-owner"),
            concept: "FIRST_NAME",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: await stableSemanticId("cor", `svg-${local}`),
      });
      expect(decision.status).toBe("RESOLVED");
      if (decision.status === "RESOLVED")
        expect(decision.resolution.decision.final_decision).not.toBe("FILL");
      expect(await harness.page.locator("#svg-field").inputValue()).toBe("");
      expect(
        reconciled(await dynReconcile(harness, top.frame_context.frame_id))
          .inventory.counts.required_unresolved,
      ).toBe(1);
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

for (const tree of ["DOCUMENT", "SHADOW"] as const) {
  test(`W14 ${tree} required email validation clearing retains verified W11 evidence without replay authority`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      const markup =
        '<label for="email">Email address</label><input id="email" name="email" type="email" required aria-describedby="email-error"><p id="email-error" class="error">Please enter an email address</p>';
      if (tree === "SHADOW") await createShadow(harness, markup);
      else
        await setFixture(
          harness,
          "<main data-japp-application-root>" + markup + "</main>",
        );
      await harness.page.evaluate(() => {
        const field =
          document.getElementById("email") ??
          document
            .getElementById("host-0")
            ?.shadowRoot?.getElementById("email");
        if (!(field instanceof HTMLInputElement))
          throw new Error("email absent");
        field.addEventListener("input", () => {
          const root = field.getRootNode() as Document | ShadowRoot;
          const error = root.getElementById("email-error");
          if (error && field.validity.valid) error.textContent = "";
        });
      });
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "Email address");
      const decision = await resolveFieldDecision({
        descriptor: field,
        records: buildApprovedRecordSet([
          {
            recordId: await stableSemanticId("record", "email-clear"),
            concept: "EMAIL_ADDRESS",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: await stableSemanticId("cor", `email-clear-${tree}`),
      });
      expect(decision.status).toBe("RESOLVED");
      if (decision.status !== "RESOLVED")
        throw new Error("email approval absent");
      expect(decision.resolution.decision.final_decision).toBe("FILL");
      const transaction = await buildTransaction(
        field,
        { kind: "TEXT", text: "synthetic@example.invalid" },
        decision.resolution.decision,
        `email-clear-${tree}`,
      );
      const execution = requireValue(
        (await dynExecute(harness, [transaction])).items[0],
        "email result absent",
      );
      expect(execution.status).toBe("EXECUTED");
      if (execution.status === "EXECUTED") {
        expect(execution.result.outcome).toBe("VERIFIED");
        expect(execution.result.site_acceptance).toBe("ACCEPTED");
        expect(execution.result.persistence_verified).toBe(true);
      }
      const proof = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      expect(proof.inventory.counts.verified_filled).toBe(1);
      expect(proof.inventory.counts.required_unresolved).toBe(0);
      expect(proof.inventory.readiness).toBe("READY");
      const replay = await dynExecute(harness, [transaction]);
      expect(replay.items[0]?.status).toBe("STALE_EVIDENCE");
      // A later ownership change is never covered by that narrow clearing proof.
      await harness.page.locator("#email-error").evaluate((node) => {
        node.textContent = "Employer contact";
        node.classList.remove("error");
      });
      const changed = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      expect(changed.inventory.counts.required_unresolved).toBe(1);
      expect(changed.inventory.readiness).toBe("NOT_READY");
      expect((await dynExecute(harness, [transaction])).items[0]?.status).toBe(
        "STALE_EVIDENCE",
      );
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

for (const tree of ["DOCUMENT", "SHADOW"] as const) {
  test(`W14 ${tree} verified validation clear can restore captured undo state`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      const markup =
        '<label for="undo-email">Email address</label><input id="undo-email" name="email" type="email" required aria-describedby="undo-error"><p id="undo-error" class="error">Please enter an email address</p>';
      if (tree === "SHADOW") await createShadow(harness, markup);
      else
        await setFixture(
          harness,
          "<main data-japp-application-root>" + markup + "</main>",
        );
      await harness.page.evaluate(() => {
        const field =
          document.getElementById("undo-email") ??
          document
            .getElementById("host-0")
            ?.shadowRoot?.getElementById("undo-email");
        if (!(field instanceof HTMLInputElement))
          throw new Error("email missing");
        field.addEventListener("input", () => {
          const root = field.getRootNode() as Document | ShadowRoot;
          const error = root.getElementById("undo-error");
          if (error)
            error.textContent = field.validity.valid
              ? ""
              : "Please enter an email address";
        });
      });
      const top = foundTopFrame(await scanFrames(harness));
      const field = descriptorByLabel(top.descriptors, "Email address");
      const decision = await resolveFieldDecision({
        descriptor: field,
        records: buildApprovedRecordSet([
          {
            recordId: await stableSemanticId("record", "undo-clear"),
            concept: "EMAIL_ADDRESS",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: await stableSemanticId("cor", `undo-clear-${tree}`),
      });
      if (decision.status !== "RESOLVED")
        throw new Error("undo approval absent");
      expect(decision.resolution.decision.final_decision).toBe("FILL");
      const transaction = await buildTransaction(
        field,
        { kind: "TEXT", text: "synthetic@example.invalid" },
        decision.resolution.decision,
        `undo-clear-${tree}`,
      );
      const execution = requireValue(
        (await dynExecute(harness, [transaction])).items[0],
        "undo result absent",
      );
      expect(execution.status).toBe("EXECUTED");
      if (execution.status === "EXECUTED") {
        expect(execution.result.outcome).toBe("VERIFIED");
        expect(execution.undo_available).toBe(true);
      }
      const response = parseUndoTabResult(
        await runtimeMessage(
          harness.controller,
          buildUndoTabRequest(nextId("clear-undo"), harness.tabId, {
            transaction_id: transaction.transaction_id,
            address: transaction.address,
            settle: { budget_ms: 75 },
          }),
        ),
      );
      const outcome = requireValue(response, "undo response missing").outcome;
      expect(outcome.status).toBe("COMPLETED");
      expect(await harness.page.locator("#undo-email").inputValue()).toBe("");
      expect(
        reconciled(await dynReconcile(harness, top.frame_context.frame_id))
          .inventory.readiness,
      ).toBe("NOT_READY");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}
