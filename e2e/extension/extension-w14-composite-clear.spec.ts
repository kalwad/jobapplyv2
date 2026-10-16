// Real MV3 regression for the mounted validation failure: stable help plus
// a rejected error component may clear without transferring ownership.
import {
  buildUndoTabRequest,
  parseUndoTabResult,
} from "../../apps/extension/src/driver-protocol.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../packages/form-engine/src/index.ts";
import { test, expect } from "./support/extension-test.ts";
import {
  buildTransaction,
  descriptorByLabel,
  dynExecute,
  dynReconcile,
  foundTopFrame,
  nextId,
  openHarness,
  reconciled,
  requireValue,
  runtimeMessage,
  scanFrames,
  setFixture,
  type Harness,
} from "./support/research-harness.ts";

type Tree = "DOCUMENT" | "SHADOW";
type Drift = "NONE" | "HELP" | "OWNERSHIP" | "REFERENCE";

async function prepare(harness: Harness, tree: Tree, drift: Drift) {
  const markup =
    '<label for="email">Email address</label><input id="email" name="email" type="email" required aria-describedby="help error"><p id="help">Your contact information.</p><p id="error" class="error" role="status">Enter an email address.</p>';
  await setFixture(
    harness,
    "<main data-japp-application-root>" +
      (tree === "DOCUMENT" ? markup : '<div id="host"></div>') +
      "</main>",
  );
  await harness.page.evaluate(
    ({ html, mode, change }) => {
      const host = document.getElementById("host");
      const root =
        mode === "SHADOW" ? host?.attachShadow({ mode: "open" }) : document;
      if (root === undefined) throw new Error("description root absent");
      if (root instanceof ShadowRoot)
        root.replaceChildren(
          document.createRange().createContextualFragment(html),
        );
      const input = root.getElementById("email");
      if (!(input instanceof HTMLInputElement)) throw new Error("email absent");
      document.documentElement.setAttribute("data-description-actions", "0");
      input.addEventListener("input", () => {
        const count = Number(
          document.documentElement.getAttribute("data-description-actions"),
        );
        document.documentElement.setAttribute(
          "data-description-actions",
          String(count + 1),
        );
        const error = root.getElementById("error");
        const help = root.getElementById("help");
        if (error === null || help === null)
          throw new Error("component absent");
        error.textContent = input.validity.valid
          ? ""
          : "Enter an email address.";
        if (change === "HELP")
          help.textContent = "Changed contact information.";
        if (change === "OWNERSHIP")
          help.textContent = "Employer contact information.";
        if (change === "REFERENCE") {
          const replacement = help.cloneNode(true) as HTMLElement;
          replacement.id = "other-help";
          help.after(replacement);
          input.setAttribute("aria-describedby", "other-help error");
        }
      });
    },
    { html: markup, mode: tree, change: drift },
  );
  const top = foundTopFrame(await scanFrames(harness));
  const field = descriptorByLabel(top.descriptors, "Email address");
  expect(field.description?.normalized_text).toBe(
    "Your contact information. Enter an email address.",
  );
  const approval = await resolveFieldDecision({
    descriptor: field,
    records: buildApprovedRecordSet([
      {
        recordId: await stableSemanticId("record", "composite-email"),
        concept: "EMAIL_ADDRESS",
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]),
    correlationId: await stableSemanticId("cor", nextId("composite-email")),
  });
  if (approval.status !== "RESOLVED") throw new Error("email approval absent");
  expect(approval.resolution.decision.final_decision).toBe("FILL");
  const transaction = await buildTransaction(
    field,
    { kind: "TEXT", text: "synthetic@example.invalid" },
    approval.resolution.decision,
    nextId("composite-email"),
  );
  return { top, transaction };
}

for (const tree of ["DOCUMENT", "SHADOW"] as const) {
  test(`W14 ${tree} composite validation clear retains help, W11 proof and undo`, async ({
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
      const { top, transaction } = await prepare(harness, tree, "NONE");
      const execution = requireValue(
        (await dynExecute(harness, [transaction])).items[0],
        "execution absent",
      );
      expect(execution.status).toBe("EXECUTED");
      if (execution.status !== "EXECUTED") throw new Error("execution refused");
      expect(execution.result.outcome).toBe("VERIFIED");
      expect(execution.undo_available).toBe(true);
      await expect(harness.page.locator("#email")).toHaveValue(
        "synthetic@example.invalid",
      );
      await expect(harness.page.locator("#help")).toHaveText(
        "Your contact information.",
      );
      await expect(harness.page.locator("html")).toHaveAttribute(
        "data-description-actions",
        "1",
      );
      const proof = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      expect(proof.inventory.counts.verified_filled).toBe(1);
      expect(proof.inventory.readiness).toBe("READY");
      expect((await dynExecute(harness, [transaction])).items[0]?.status).toBe(
        "STALE_EVIDENCE",
      );
      const undo = requireValue(
        parseUndoTabResult(
          await runtimeMessage(
            harness.controller,
            buildUndoTabRequest(nextId("composite-undo"), harness.tabId, {
              transaction_id: transaction.transaction_id,
              address: transaction.address,
              settle: { budget_ms: 75 },
            }),
          ),
        ),
        "undo response absent",
      );
      expect(undo.outcome.status).toBe("COMPLETED");
      await expect(harness.page.locator("#email")).toHaveValue("");
      await expect(harness.page.locator("html")).toHaveAttribute(
        "data-description-actions",
        "2",
      );
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

for (const [tree, drift] of [
  ["DOCUMENT", "HELP"],
  ["SHADOW", "OWNERSHIP"],
  ["DOCUMENT", "REFERENCE"],
] as const) {
  test(`W14 ${tree} composite clear refuses changed ${drift} components`, async ({
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
      const { top, transaction } = await prepare(harness, tree, drift);
      const execution = requireValue(
        (await dynExecute(harness, [transaction])).items[0],
        "execution absent",
      );
      expect(execution.status).toBe("EXECUTED");
      if (execution.status !== "EXECUTED") throw new Error("execution refused");
      expect(execution.result.outcome).toBe("NEEDS_REVIEW");
      expect(execution.undo_available).toBe(false);
      await expect(harness.page.locator("html")).toHaveAttribute(
        "data-description-actions",
        "1",
      );
      const proof = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      expect(proof.inventory.counts.verified_filled).toBe(0);
      expect(proof.inventory.counts.required_unresolved).toBe(1);
      expect(proof.inventory.readiness).toBe("NOT_READY");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

test("W14 composite clear later reference rebinding removes W11 and undo authority", async ({
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
    const { top, transaction } = await prepare(harness, "DOCUMENT", "NONE");
    const execution = requireValue(
      (await dynExecute(harness, [transaction])).items[0],
      "execution absent",
    );
    if (execution.status !== "EXECUTED") throw new Error("execution refused");
    expect(execution.result.outcome).toBe("VERIFIED");
    await harness.page.locator("#help").evaluate((help) => {
      const replacement = help.cloneNode(true) as HTMLElement;
      replacement.id = "new-help";
      help.after(replacement);
      document
        .getElementById("email")
        ?.setAttribute("aria-describedby", "new-help error");
    });
    const proof = reconciled(
      await dynReconcile(harness, top.frame_context.frame_id),
    );
    expect(proof.inventory.counts.verified_filled).toBe(0);
    expect(proof.inventory.readiness).toBe("NOT_READY");
    const undo = requireValue(
      parseUndoTabResult(
        await runtimeMessage(
          harness.controller,
          buildUndoTabRequest(nextId("composite-undo"), harness.tabId, {
            transaction_id: transaction.transaction_id,
            address: transaction.address,
            settle: { budget_ms: 75 },
          }),
        ),
      ),
      "undo response absent",
    );
    if (undo.outcome.status !== "COMPLETED")
      throw new Error("undo response absent");
    expect(undo.outcome.result.outcome).toBe("NEEDS_REVIEW");
    await expect(harness.page.locator("#email")).toHaveValue(
      "synthetic@example.invalid",
    );
    await expect(harness.page.locator("html")).toHaveAttribute(
      "data-description-actions",
      "1",
    );
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
