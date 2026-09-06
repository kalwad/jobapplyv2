// M02-W12 research expansion: actual built MV3 W08→W09→W10→W11.
// All pages are deterministic local synthetic fixtures. The pure research
// classifier adds no privileged wire command or navigation capability.
import {
  RESEARCH_MATRIX,
  type ResearchVariant,
} from "../../packages/ats-adapters/research/matrix.ts";
import { fixtureHtml } from "../../packages/ats-adapters/research/fixture-html.ts";
import {
  createResearchAdapter,
  RESEARCH_FAMILIES,
} from "../../packages/ats-adapters/src/research-adapter.ts";
import {
  buildIdentifyNavTabRequest,
  parseIdentifyNavTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
import { semanticDigest } from "../../packages/form-engine/src/semantic-digest.ts";
import { expect, test } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  foundTopFrame,
  scanFrames,
  dynStart,
  dynStop,
  dynState,
  dynExecute,
  dynReconcile,
  reconciled,
  descriptorByLabel,
  buildTransaction,
  fillDecision,
  runtimeMessage,
  nextId,
  waitForDrain,
  type Harness,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";

async function observedEvidence(harness: Harness) {
  return harness.page.evaluate(() => {
    const root = document.querySelector("[data-japp-application-root]");
    const token = (text: string | null | undefined) =>
      text?.trim().toUpperCase().replaceAll(/\s+/gu, "_") ?? "UNKNOWN";
    const routeFamily =
      location.pathname.split("/")[2]?.toUpperCase() ?? "UNKNOWN";
    const sessionSignals = [
      root?.getAttribute("data-research-session") ?? "UNKNOWN",
    ];
    for (const boundary of document.querySelectorAll(
      "[data-session-boundary]",
    )) {
      sessionSignals.push(
        boundary.getAttribute("data-session-boundary") ?? "UNKNOWN",
      );
    }
    if (document.querySelector('input[type="password"]'))
      sessionSignals.push("SIGN_IN");
    if (document.querySelector('[data-research-challenge="CAPTCHA"]'))
      sessionSignals.push("CAPTCHA_OR_BOT_CHALLENGE");
    return {
      familySignals: [
        { source: "ROUTE", family: routeFamily },
        {
          source: "SHELL",
          family: root?.getAttribute("data-research-family") ?? "UNKNOWN",
        },
      ],
      stepSignals: [
        {
          source: "ROUTE",
          step: token(location.pathname.split("/")[3]?.replaceAll("_", " ")),
        },
        {
          source: "HEADING",
          step: token(document.querySelector("h1")?.textContent),
        },
        {
          source: "PROGRESS",
          step: token(
            document.querySelector('[aria-current="step"]')?.textContent,
          ),
        },
      ],
      sessionSignals,
    };
  });
}

async function guardNavigation(harness: Harness): Promise<void> {
  await harness.page.evaluate(() => {
    document.documentElement.dataset.researchNavigationActivations = "0";
    document.addEventListener("click", (event) => {
      if (
        event.target instanceof HTMLElement &&
        /\b(next|continue|submit)\b|review application/iu.test(
          event.target.textContent.trim(),
        )
      ) {
        document.documentElement.dataset.researchNavigationActivations = String(
          Number(
            document.documentElement.dataset.researchNavigationActivations,
          ) + 1,
        );
      }
    });
    document.addEventListener("submit", (event) => {
      event.preventDefault();
      document.documentElement.dataset.researchNavigationActivations = "999";
    });
  });
}

async function exerciseVariantDynamics(
  harness: Harness,
  frameId: string,
  variant: ResearchVariant,
) {
  const before = await dynState(harness, frameId);
  await harness.page.evaluate(
    ({ scenario, boundary }) => {
      const slot = document.querySelector("#dynamic-slot");
      const input = document.querySelector<HTMLInputElement>("#first-name");
      if (!slot || !input) throw new Error("research dynamic surface absent");
      if (scenario === "DELAYED_RERENDER") {
        setTimeout(() => {
          input.replaceWith(input.cloneNode(true));
          slot.setAttribute("data-rerender-complete", "true");
        }, 40);
      } else if (scenario === "CONDITIONAL_INSERTION") {
        const label = document.createElement("label");
        label.textContent = "Conditional research question";
        const field = document.createElement("input");
        field.required = true;
        field.disabled = boundary;
        label.append(field);
        slot.append(label);
      } else if (scenario === "PAGE_GENERATION_CHANGE") {
        history.replaceState(null, "", `${location.pathname}/generation-two`);
        slot.append(document.createElement("span"));
      } else {
        for (let index = 0; index < 80; index += 1) {
          const leaf = document.createElement("span");
          leaf.textContent = "Bounded synthetic burst";
          slot.append(leaf);
        }
      }
    },
    {
      scenario: variant.expected.dynamicScenario,
      boundary: variant.expected.sessionBoundary,
    },
  );
  if (variant.expected.dynamicScenario === "DELAYED_RERENDER")
    await expect(harness.page.locator("#dynamic-slot")).toHaveAttribute(
      "data-rerender-complete",
      "true",
    );
  await waitForDrain(harness, frameId, before.batches_processed + 1);
  const after = reconciled(await dynReconcile(harness, frameId));
  expect(after.snapshot.full_document_scans).toBe(0);
  expect(after.snapshot.actions_executed).toBe(before.actions_executed);
  expect(after.snapshot.queue_length).toBe(0);
  if (variant.expected.dynamicScenario === "CONDITIONAL_INSERTION")
    expect(after.inventory.counts.required_unresolved).toBeGreaterThan(0);
  if (variant.expected.dynamicScenario === "PAGE_GENERATION_CHANGE")
    expect(after.snapshot.generations.page_generation).toBeGreaterThan(
      before.generations.page_generation,
    );
}

async function exerciseParserVariant(
  harness: Harness,
  frameId: string,
  variant: ResearchVariant,
) {
  if (variant.expected.parserOutcome === "NOT_APPLICABLE") return;
  if (variant.expected.sessionBoundary) {
    // Session posture dominates upload research. Rejection is separately
    // executed in the safe-session upload test; no file enters this boundary.
    await expect(harness.page.locator("#resume")).toBeDisabled();
    return;
  }
  const before = reconciled(await dynReconcile(harness, frameId));
  await harness.page.evaluate(() => {
    const slot = document.querySelector("#dynamic-slot");
    if (!slot) throw new Error("parser slot missing");
    slot.innerHTML =
      '<div data-japp-repeater="EXPERIENCE" data-japp-repeater-valid="true"><label for="parser-controller">Parsed experience repeater</label><input id="parser-controller" data-japp-repeater-controller="EXPERIENCE"><button type="button" data-japp-repeater-action="ADD">Add parsed experience</button><div data-japp-repeater-items id="parsed-items"></div></div>';
    setTimeout(() => {
      const items = document.querySelector("#parsed-items");
      if (!items) throw new Error("parser target missing");
      items.innerHTML =
        '<fieldset data-japp-repeater-item data-japp-item-label="Synthetic Parsed Role"><legend>Synthetic parsed role</legend><label>Parsed employer<input required data-japp-repeater-value value="Synthetic tenant"></label><label>Unresolved parsed detail<input required></label></fieldset>';
    }, 35);
  });
  await expect(
    harness.page.locator("#parsed-items [data-japp-repeater-item]"),
  ).toHaveCount(1);
  const parsed = reconciled(await dynReconcile(harness, frameId));
  expect(parsed.inventory.counts.total).toBeGreaterThan(
    before.inventory.counts.total,
  );
  expect(parsed.inventory.counts.required_unresolved).toBeGreaterThan(0);
  if (variant.expected.parserOutcome === "PARSER_DUPLICATE_EXISTING_ROW") {
    const controller = descriptorByLabel(
      foundTopFrame(await scanFrames(harness)).descriptors,
      "Parsed experience repeater",
    );
    const seed = `${variant.id}-parser-duplicate`;
    const tx = await buildTransaction(
      controller,
      { kind: "REPEATER_ADD", item_label: "Synthetic Parsed Role" },
      await fillDecision(controller, seed),
      seed,
    );
    const result = (await dynExecute(harness, [tx])).items[0];
    expect(result?.status).toBe("EXECUTED");
    if (result?.status === "EXECUTED")
      expect(result.result.outcome).toBe("NEEDS_REVIEW");
    expect((await dynExecute(harness, [tx])).items[0]?.status).toBe(
      "PRIOR_ATTEMPT_EXISTS",
    );
    await expect(
      harness.page.locator("#parsed-items [data-japp-repeater-item]"),
    ).toHaveCount(1);
  }
}

for (const family of RESEARCH_FAMILIES) {
  test(`W12 ${family}: complete research variant matrix through real generic core`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    test.setTimeout(240_000);
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    await guardNavigation(harness);
    let exercised = 0;
    let paused = 0;
    let filled = 0;
    for (const variant of RESEARCH_MATRIX.filter(
      (item) => item.ats === family,
    )) {
      await setFixture(harness, fixtureHtml(variant));
      await harness.page.evaluate((route) => {
        history.replaceState(null, "", route);
      }, variant.route);
      const evidence = await observedEvidence(harness);
      const assessment = createResearchAdapter(family).analyze(evidence);
      expect(assessment.posture, variant.id).toBe(
        variant.expected.sessionBoundary
          ? "PAUSE"
          : "ELIGIBLE_FOR_GENERIC_CORE",
      );
      expect(assessment.productionSupport).toBe(false);
      for (const otherFamily of RESEARCH_FAMILIES.filter(
        (entry) => entry !== family,
      )) {
        expect(
          createResearchAdapter(otherFamily).analyze(evidence).posture,
        ).toBe("PAUSE");
      }
      const top = foundTopFrame(await scanFrames(harness));
      const frameId = top.frame_context.frame_id;
      expect(top.descriptors.length, variant.id).toBeGreaterThan(0);
      expect((await dynStart(harness, frameId)).status).toBe("STARTED");
      const before = await dynState(harness, frameId);
      if (assessment.posture === "ELIGIBLE_FOR_GENERIC_CORE") {
        expect(assessment.step).toBe(variant.step);
        const first = descriptorByLabel(top.descriptors, "First name");
        const transaction = await approvedTransaction(first, variant.id);
        expect(transaction.decision.final_decision, variant.id).toBe("FILL");
        const execution = await dynExecute(harness, [transaction]);
        expect(execution.items[0]?.status, variant.id).toBe("EXECUTED");
        const outcome = execution.items[0];
        if (outcome?.status !== "EXECUTED")
          throw new Error("execution missing");
        expect(outcome.result.outcome, variant.id).toBe("VERIFIED");
        await expect(harness.page.locator("#first-name")).toHaveValue(
          "Synthetic W12",
        );
        expect(
          (await dynExecute(harness, [transaction])).items[0]?.status,
        ).toBe("DUPLICATE_SUPPRESSED");
        filled += 1;
      } else {
        await expect(harness.page.locator("#first-name")).toHaveValue("");
        paused += 1;
      }
      const inventory = reconciled(await dynReconcile(harness, frameId));
      if (assessment.posture === "ELIGIBLE_FOR_GENERIC_CORE")
        expect(inventory.inventory.readiness).toBe("NOT_READY");
      expect(inventory.snapshot.full_document_scans).toBe(0);
      expect(
        inventory.snapshot.actions_executed - before.actions_executed,
      ).toBe(assessment.posture === "PAUSE" ? 0 : 1);
      expect(inventory.snapshot.ledger_size).toBeLessThanOrEqual(128);
      await expect(harness.page.locator("#honeypot")).toHaveValue("");
      await expect(harness.page.locator("#sensitive-disclosure")).toHaveValue(
        "",
      );
      const navigation = parseIdentifyNavTabResult(
        await runtimeMessage(
          harness.controller,
          buildIdentifyNavTabRequest(nextId("research-nav"), harness.tabId),
        ),
      );
      expect(navigation?.outcome.status).toBe("COMPLETED");
      if (navigation?.outcome.status !== "COMPLETED")
        throw new Error("navigation identification missing");
      const states = {
        UNIQUE: "UNIQUE_SAFE_CANDIDATE",
        AMBIGUOUS: "AMBIGUOUS",
        UNSAFE: "UNSAFE",
        MISSING: "MISSING",
      } as const;
      expect(navigation.outcome.identification.status, variant.id).toBe(
        states[variant.expected.navigationState],
      );
      await expect(harness.page.locator("html")).toHaveAttribute(
        "data-research-navigation-activations",
        "0",
      );
      await exerciseParserVariant(harness, frameId, variant);
      await exerciseVariantDynamics(harness, frameId, variant);
      expect((await dynStop(harness, frameId)).status).toBe("STOPPED");
      exercised += 1;
    }
    console.log(
      "W12_MATRIX",
      JSON.stringify({
        family,
        exercised,
        paused,
        filled,
        navigationActivations: 0,
        scoredControls: 0,
      }),
    );
  });
}

const DYNAMIC_FIXTURE = `<form data-japp-application-root data-research-family="WORKDAY" data-research-session="GUEST">
<h1>My information</h1><p aria-current="step">My information</p>
<section><label for="first-name">First name</label><input id="first-name" required aria-invalid="false"></section>
<section id="dynamic-slot"></section><div id="noise"><span>bounded leaf</span></div>
<div data-japp-repeater="EXPERIENCE" data-japp-repeater-valid="true">
<label for="rep-controller">Experience repeater</label><input id="rep-controller" data-japp-repeater-controller="EXPERIENCE">
<button type="button" data-japp-repeater-action="ADD">Add experience</button><div data-japp-repeater-items></div></div>
<label for="upload">Synthetic document</label><input id="upload" type="file" accept="text/plain">
<button type="button">Next</button></form>`;

test("P8 regression: actual matrix work, education and language repeaters create, reorder, rerender and reject ambiguity through W10/W11", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  test.setTimeout(120_000);
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await guardNavigation(harness);
  for (const family of RESEARCH_FAMILIES) {
    for (const repeaterFamily of [
      "WORK_EXPERIENCE",
      "EDUCATION",
      "SKILLS_OR_LANGUAGES",
    ] as const) {
      const variant = RESEARCH_MATRIX.find(
        (item) =>
          item.ats === family &&
          item.expected.repeaterFamily === repeaterFamily &&
          !item.expected.sessionBoundary,
      );
      if (!variant)
        throw new Error(`missing ${family}/${repeaterFamily} research variant`);
      await setFixture(harness, fixtureHtml(variant));
      await harness.page.evaluate((route) => {
        history.replaceState(null, "", route);
      }, variant.route);
      await harness.page.locator("#experience-repeater").evaluate((root) => {
        root.addEventListener("click", (event) => {
          if (
            !(event.target instanceof HTMLElement) ||
            event.target.getAttribute("data-japp-repeater-action") !== "ADD"
          )
            return;
          const controller = root.querySelector<HTMLInputElement>(
            "[data-japp-repeater-controller]",
          );
          const items = root.querySelector("[data-japp-repeater-items]");
          if (!controller || !items)
            throw new Error("actual matrix repeater unavailable");
          const item = document.createElement("fieldset");
          item.setAttribute("data-japp-repeater-item", "");
          item.setAttribute("data-japp-item-label", controller.value);
          const legend = document.createElement("legend");
          legend.textContent = controller.value;
          const input = document.createElement("input");
          input.setAttribute("data-japp-repeater-value", "");
          input.setAttribute("aria-label", `${controller.value} details`);
          input.required = true;
          item.append(legend, input);
          items.append(item);
          controller.value = "";
        });
      });
      const top = foundTopFrame(await scanFrames(harness));
      const frameId = top.frame_context.frame_id;
      await dynStart(harness, frameId);
      const act = async (
        suffix: string,
        intended: Parameters<typeof buildTransaction>[1],
      ) => {
        const descriptor = descriptorByLabel(
          foundTopFrame(await scanFrames(harness)).descriptors,
          "Research repeater",
        );
        const seed = `${variant.id}-${suffix}`;
        return buildTransaction(
          descriptor,
          intended,
          await fillDecision(descriptor, seed),
          seed,
        );
      };
      const existingLabel = `${repeaterFamily.replaceAll("_", " ")} Synthetic 1`;
      const edited = (
        await dynExecute(harness, [
          await act("existing", {
            kind: "REPEATER_EDIT",
            item_label: existingLabel,
            text: "Synthetic existing record reviewed",
          }),
        ])
      ).items[0];
      expect(edited?.status).toBe("EXECUTED");
      if (edited?.status === "EXECUTED")
        expect(edited.result.outcome).toBe("VERIFIED");
      const newLabel = `${repeaterFamily.replaceAll("_", " ")} Synthetic new`;
      const add = await act("new", {
        kind: "REPEATER_ADD",
        item_label: newLabel,
      });
      const created = (await dynExecute(harness, [add])).items[0];
      expect(created?.status).toBe("EXECUTED");
      if (created?.status === "EXECUTED")
        expect(created.result.outcome).toBe("VERIFIED");
      expect((await dynExecute(harness, [add])).items[0]?.status).toBe(
        "DUPLICATE_SUPPRESSED",
      );
      const items = harness.page.locator(
        "#experience-repeater [data-japp-repeater-item]",
      );
      await expect(items).toHaveCount(variant.expected.repeaterRows + 1);
      await harness.page
        .locator("#experience-repeater [data-japp-repeater-items]")
        .evaluate((container) => {
          const children = [...container.children];
          for (const child of children.reverse()) container.append(child);
          // Framework rerender preserves semantic item labels, replacing all nodes.
          for (const child of [...container.children])
            child.replaceWith(child.cloneNode(true));
        });
      const reordered = (
        await dynExecute(harness, [
          await act("reordered", {
            kind: "REPEATER_EDIT",
            item_label: newLabel,
            text: "Synthetic reordered record",
          }),
        ])
      ).items[0];
      expect(reordered?.status).toBe("EXECUTED");
      if (reordered?.status === "EXECUTED")
        expect(reordered.result.outcome).toBe("VERIFIED");
      await harness.page
        .locator("#experience-repeater [data-japp-repeater-items]")
        .evaluate((container, label) => {
          const originals = [
            ...container.querySelectorAll<HTMLElement>(
              "[data-japp-item-label]",
            ),
          ].filter(
            (item) => item.getAttribute("data-japp-item-label") === label,
          );
          if (originals.length !== 1 || !originals[0])
            throw new Error("unique item missing");
          // Site parser introduces a semantically duplicate-looking row.
          container.append(originals[0].cloneNode(true));
        }, newLabel);
      const ambiguous = (
        await dynExecute(harness, [
          await act("ambiguous", {
            kind: "REPEATER_EDIT",
            item_label: newLabel,
            text: "MUST NOT WRITE",
          }),
        ])
      ).items[0];
      expect(ambiguous?.status).toBe("EXECUTED");
      if (ambiguous?.status === "EXECUTED")
        expect(ambiguous.result.outcome).toBe("NEEDS_REVIEW");
      expect(
        await items
          .locator("[data-japp-repeater-value]")
          .evaluateAll((elements) =>
            elements.some(
              (element) =>
                element instanceof HTMLInputElement &&
                element.value === "MUST NOT WRITE",
            ),
          ),
      ).toBe(false);
      expect(
        reconciled(await dynReconcile(harness, frameId)).inventory.readiness,
      ).toBe("NOT_READY");
      expect((await dynState(harness, frameId)).full_document_scans).toBe(0);
      await expect(harness.page.locator("html")).toHaveAttribute(
        "data-research-navigation-activations",
        "0",
      );
      await dynStop(harness, frameId);
    }
  }
});

test("WD1–WD10/XATS: observed contradictory, single-signal, login, CAPTCHA and unknown surfaces pause without action", async ({
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
  await setFixture(harness, DYNAMIC_FIXTURE);
  await guardNavigation(harness);
  await harness.page.evaluate(() => {
    history.replaceState(null, "", "/research/workday/my_information");
  });
  expect(
    createResearchAdapter("WORKDAY").analyze(await observedEvidence(harness))
      .posture,
  ).toBe("ELIGIBLE_FOR_GENERIC_CORE");
  for (const boundary of [
    "SIGN_IN",
    "CREATE_ACCOUNT",
    "EMAIL_VERIFICATION",
    "MFA",
    "CAPTCHA_OR_BOT_CHALLENGE",
    "SESSION_EXPIRED",
    "DUPLICATE_APPLICATION",
    "PRIVACY_OR_TERMS",
    "UNKNOWN",
  ] as const) {
    await setFixture(harness, DYNAMIC_FIXTURE);
    await harness.page.evaluate((state) => {
      const overlay = document.createElement("section");
      overlay.setAttribute("data-session-boundary", state);
      overlay.setAttribute("role", "alert");
      overlay.textContent = `Synthetic ${state} boundary`;
      document.body.append(overlay);
    }, boundary);
    expect(
      createResearchAdapter("WORKDAY").analyze(await observedEvidence(harness))
        .posture,
      boundary,
    ).toBe("PAUSE");
    await expect(harness.page.locator("#first-name")).toHaveValue("");
  }
  for (const scenario of [
    "CONTRADICTORY_HEADING",
    "SINGLE_ROUTE",
    "LOGIN",
    "CAPTCHA",
    "UNKNOWN_FAMILY",
  ] as const) {
    await setFixture(harness, DYNAMIC_FIXTURE);
    await harness.page.evaluate((kind) => {
      if (kind === "CONTRADICTORY_HEADING")
        document.querySelector("h1")?.replaceChildren("Review");
      else if (kind === "SINGLE_ROUTE") {
        document.querySelector("h1")?.remove();
        document.querySelector('[aria-current="step"]')?.remove();
      } else if (kind === "LOGIN") {
        const password = document.createElement("input");
        password.type = "password";
        document.body.append(password);
      } else if (kind === "CAPTCHA") {
        const challenge = document.createElement("section");
        challenge.setAttribute("data-research-challenge", "CAPTCHA");
        challenge.textContent = "Synthetic challenge";
        document.body.append(challenge);
      } else
        document
          .querySelector("[data-research-family]")
          ?.removeAttribute("data-research-family");
    }, scenario);
    expect(
      createResearchAdapter("WORKDAY").analyze(await observedEvidence(harness))
        .posture,
      scenario,
    ).toBe("PAUSE");
    await expect(harness.page.locator("#first-name")).toHaveValue("");
    await expect(harness.page.locator("html")).toHaveAttribute(
      "data-research-navigation-activations",
      "0",
    );
  }
});

test("WD12–WD17/M5: delayed parser, duplicate prevention, validation, rerender and stale generation", async ({
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
  await setFixture(harness, DYNAMIC_FIXTURE);
  await guardNavigation(harness);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  await dynStart(harness, frameId);
  const first = descriptorByLabel(top.descriptors, "First name");
  const transaction = await approvedTransaction(first, "parser-contact");
  expect((await dynExecute(harness, [transaction])).items[0]?.status).toBe(
    "EXECUTED",
  );
  await harness.page.evaluate(() => {
    // Synthetic site-side parser effect; this is fixture behavior, not adapter authority.
    setTimeout(() => {
      const items = document.querySelector("[data-japp-repeater-items]");
      if (!items) throw new Error("items missing");
      items.innerHTML =
        '<section data-japp-repeater-item data-japp-item-label="Synthetic Role"><label>Employer<input required data-japp-repeater-value value="Synthetic Tenant"></label></section>';
    }, 80);
  });
  await expect(harness.page.locator("[data-japp-repeater-item]")).toHaveCount(
    1,
  );
  const afterParser = reconciled(await dynReconcile(harness, frameId));
  expect(afterParser.inventory.counts.total).toBeGreaterThan(
    top.descriptors.length,
  );
  expect((await dynExecute(harness, [transaction])).items[0]?.status).toBe(
    "DUPLICATE_SUPPRESSED",
  );
  const controller = descriptorByLabel(
    foundTopFrame(await scanFrames(harness)).descriptors,
    "Experience repeater",
  );
  const duplicateAdd = await buildTransaction(
    controller,
    { kind: "REPEATER_ADD", item_label: "Synthetic Role" },
    await fillDecision(controller, "parsed-existing"),
    "parsed-existing",
  );
  const duplicate = await dynExecute(harness, [duplicateAdd]);
  expect(duplicate.items[0]?.status).toBe("EXECUTED");
  if (duplicate.items[0]?.status === "EXECUTED")
    expect(duplicate.items[0].result.outcome).not.toBe("VERIFIED");
  await expect(harness.page.locator("[data-japp-repeater-item]")).toHaveCount(
    1,
  );
  await harness.page.evaluate(() => {
    const item = document.querySelector("[data-japp-repeater-item]");
    if (!item) throw new Error("parsed item missing");
    item.replaceWith(item.cloneNode(true));
    const input = document.querySelector<HTMLInputElement>("#first-name");
    if (!input) throw new Error("input missing");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", "validation-error");
    const error = document.createElement("p");
    error.id = "validation-error";
    error.setAttribute("role", "alert");
    error.textContent = "Synthetic site rejection";
    input.after(error);
  });
  const rejected = reconciled(await dynReconcile(harness, frameId));
  expect(
    rejected.inventory.items.find((item) => item.field_id === first.field_id)
      ?.category,
  ).not.toBe("VERIFIED_FILLED");
  await harness.page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("#first-name");
    if (!input) throw new Error("input missing");
    input.setAttribute("aria-invalid", "false");
    input.removeAttribute("aria-describedby");
    document.querySelector("#validation-error")?.remove();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const changed = reconciled(await dynReconcile(harness, frameId));
  expect(
    changed.inventory.items.some(
      (item) =>
        item.category === "PAGE_CHANGED_VALUE" ||
        item.category === "REQUIRED_UNRESOLVED",
    ),
  ).toBe(true);
  await harness.page.evaluate(() => {
    history.pushState(null, "", "/research/workday/review");
    document.querySelector("#noise")?.append(document.createElement("span"));
  });
  const stale = await dynExecute(harness, [transaction]);
  // EXECUTED is the W11 protocol dispatch status. The W10 result carries
  // success/rejection, exactly as in retained W11 GEN1.
  expect(stale.items[0]?.status).toBe("EXECUTED");
  if (stale.items[0]?.status === "EXECUTED")
    expect(stale.items[0].result.outcome).toBe("NEEDS_REVIEW");
  await expect(harness.page.locator("#first-name")).toHaveValue("");
  expect((await dynState(harness, frameId)).full_document_scans).toBe(0);
  await expect(harness.page.locator("html")).toHaveAttribute(
    "data-research-navigation-activations",
    "0",
  );
});

test("WD15: actual synthetic upload rejected by site never becomes VERIFIED", async ({
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
  await setFixture(harness, DYNAMIC_FIXTURE);
  await harness.page.locator("#upload").evaluate((element) => {
    element.addEventListener("change", () => {
      element.setAttribute("aria-invalid", "true");
    });
  });
  const top = foundTopFrame(await scanFrames(harness));
  await dynStart(harness, top.frame_context.frame_id);
  const upload = descriptorByLabel(top.descriptors, "Synthetic document");
  const content = "Synthetic W12 document; no applicant data.";
  const transaction = await buildTransaction(
    upload,
    {
      kind: "FILE",
      file_name: "synthetic-w12.txt",
      media_type: "text/plain",
      size_bytes: Buffer.byteLength(content),
      content_base64: Buffer.from(content).toString("base64"),
      artifact_digest: await semanticDigest(content),
    },
    await fillDecision(upload, "upload-reject"),
    "upload-reject",
  );
  const outcome = (await dynExecute(harness, [transaction])).items[0];
  expect(outcome?.status).toBe("EXECUTED");
  if (outcome?.status === "EXECUTED")
    expect(outcome.result.outcome).not.toBe("VERIFIED");
  expect(
    reconciled(await dynReconcile(harness, top.frame_context.frame_id))
      .inventory.readiness,
  ).toBe("NOT_READY");
});

test("WD21–WD23: 256 route cycles bound observation, queues, ledgers, scans and measured heap", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}, testInfo) => {
  test.setTimeout(180_000);
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  await setFixture(harness, DYNAMIC_FIXTURE);
  await guardNavigation(harness);
  const top = foundTopFrame(await scanFrames(harness));
  const frameId = top.frame_context.frame_id;
  await dynStart(harness, frameId);
  const cdp = await extensionContext.newCDPSession(harness.page);
  await cdp.send("Performance.enable");
  const samples: {
    iteration: number;
    cpuSeconds: number;
    heapBytes: number;
    snapshot: Awaited<ReturnType<typeof dynState>>;
  }[] = [];
  const sample = async (iteration: number) => {
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = (await cdp.send("Performance.getMetrics")).metrics;
    const metric = (name: string) => {
      const item = metrics.find((value) => value.name === name);
      if (!item) throw new Error(`metric ${name} unavailable`);
      return item.value;
    };
    samples.push({
      iteration,
      cpuSeconds: metric("TaskDuration"),
      heapBytes: metric("JSHeapUsedSize"),
      snapshot: await dynState(harness, frameId),
    });
  };
  const started = Date.now();
  await sample(0);
  for (let iteration = 1; iteration <= 256; iteration += 1) {
    await harness.page.evaluate((cycle) => {
      history.replaceState(
        null,
        "",
        `/research/workday/cycle-${String(cycle)}`,
      );
      const root = document.querySelector("#dynamic-slot");
      if (!root) throw new Error("slot missing");
      root.innerHTML =
        "<label>Conditional research field<input required></label>";
      const noise = document.querySelector("#noise");
      if (!noise) throw new Error("noise missing");
      for (let n = 0; n < 25; n += 1) {
        const leaf = document.createElement("span");
        leaf.textContent = "synthetic mutation";
        noise.append(leaf);
      }
      while (noise.childNodes.length > 30) noise.firstChild?.remove();
    }, iteration);
    await waitForDrain(harness, frameId, iteration);
    const inventory = reconciled(await dynReconcile(harness, frameId));
    expect(inventory.inventory.readiness).toBe("NOT_READY");
    const current = descriptorByLabel(
      foundTopFrame(await scanFrames(harness)).descriptors,
      "First name",
    );
    const tx = await approvedTransaction(current, `soak-${String(iteration)}`, {
      kind: "TEXT",
      text: `Synthetic cycle ${String(iteration)}`,
    });
    const action = await dynExecute(harness, [tx]);
    expect(action.items[0]?.status).toBe("EXECUTED");
    expect((await dynExecute(harness, [tx])).items[0]?.status).toBe(
      "DUPLICATE_SUPPRESSED",
    );
    if (iteration % 32 === 0) await sample(iteration);
  }
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last) throw new Error("samples missing");
  expect(last.snapshot.full_document_scans).toBe(0);
  expect(last.snapshot.actions_executed).toBe(256);
  expect(last.snapshot.actions_suppressed_duplicate).toBe(256);
  expect(last.snapshot.ledger_size).toBeLessThanOrEqual(128);
  expect(last.snapshot.registry_size).toBeLessThanOrEqual(128);
  expect(last.snapshot.queue_length).toBe(0);
  expect(last.snapshot.root_rescans).toBeLessThanOrEqual(258);
  expect(last.heapBytes - first.heapBytes).toBeLessThan(16 * 1024 * 1024);
  expect(last.cpuSeconds).toBeGreaterThan(first.cpuSeconds);
  const report = {
    scope: "M02_W12_BOUNDED_RESEARCH_NOT_PRODUCTION_SOAK",
    iterations: 256,
    durationMs: Date.now() - started,
    cpuSource: "Chromium CDP Performance.TaskDuration",
    memorySource: "Chromium CDP JSHeapUsedSize after explicit GC",
    peakHeapBytes: Math.max(...samples.map((entry) => entry.heapBytes)),
    samples,
  };
  await testInfo.attach("w12-long-session.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
  console.log("W12_LONG_SESSION", JSON.stringify(report));
  await expect(harness.page.locator("html")).toHaveAttribute(
    "data-research-navigation-activations",
    "0",
  );
});
