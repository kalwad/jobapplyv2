/** Other-party ownership outside the selected application root remains evidence. */
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  dynExecute,
  dynReconcile,
  reconciled,
} from "./support/research-harness.ts";
import { approvedTransaction } from "./support/research-core.ts";

for (const tree of ["document", "shadow"] as const) {
  for (const phase of ["initial", "before-execute", "focus"] as const) {
    test(`W14 peer: ${tree} outside-root Employer ownership at ${phase} prevents applicant writes`, async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }, testInfo) => {
      const harness = await openHarness(
        extensionContext,
        extensionId,
        serviceWorker,
        "/native/",
      );
      try {
        await setFixture(
          harness,
          '<section id="outside-owner" aria-label="Your contact"><div id="owner-host"></div></section>',
        );
        await harness.page.evaluate(
          ({ tree, phase }) => {
            const outer = document.getElementById("outside-owner"),
              host = document.getElementById("owner-host");
            if (outer === null || host === null)
              throw new Error("outer owner fixture missing");
            outer.setAttribute(
              "aria-label",
              phase === "initial" ? "Employer" : "Your contact",
            );
            const root =
              tree === "shadow" ? host.attachShadow({ mode: "open" }) : host;
            root.innerHTML =
              '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>';
            const input = root.querySelector("input");
            if (input === null) throw new Error("input fixture missing");
            const meter = { focus: 0, input: 0, change: 0 };
            (
              window as unknown as { peerOutsideOwnerMeter: typeof meter }
            ).peerOutsideOwnerMeter = meter;
            input.addEventListener("focus", () => {
              meter.focus++;
              if (phase === "focus")
                outer.setAttribute("aria-label", "Employer");
            });
            input.addEventListener("input", () => {
              meter.input++;
            });
            input.addEventListener("change", () => {
              meter.change++;
            });
          },
          { tree, phase },
        );
        const top = foundTopFrame(await scanFrames(harness));
        const before = descriptorByLabel(top.descriptors, "First name");
        const transaction = await approvedTransaction(
          before,
          `peer-outside-owner-${tree}-${phase}`,
          { kind: "TEXT", text: "Synthetic" },
        );
        if (phase === "before-execute")
          await harness.page.locator("#outside-owner").evaluate((node) => {
            node.setAttribute("aria-label", "Employer");
          });
        // Preserve the actual erroneous before behavior only when real W09
        // permits it. No forged FILL decision or authority enters this probe.
        const execution =
          transaction.decision.final_decision === "FILL"
            ? await dynExecute(harness, [transaction])
            : null;
        const changed = descriptorByLabel(
          foundTopFrame(await scanFrames(harness)).descriptors,
          "First name",
        );
        const currentDecision = await approvedTransaction(
          changed,
          `peer-outside-owner-after-${tree}-${phase}`,
          { kind: "TEXT", text: "Synthetic" },
        );
        const inventory = reconciled(
          await dynReconcile(harness, top.frame_context.frame_id),
        );
        const meter = await harness.page.evaluate(
          () =>
            (
              window as unknown as {
                peerOutsideOwnerMeter: {
                  focus: number;
                  input: number;
                  change: number;
                };
              }
            ).peerOutsideOwnerMeter,
        );
        const value = await harness.page.locator("#first").inputValue();
        await testInfo.attach(`w14-outside-owner-${tree}-${phase}.json`, {
          body: JSON.stringify(
            {
              tree,
              phase,
              before,
              transaction,
              changed,
              currentDecision,
              execution,
              inventory,
              meter,
              value,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        if (phase === "initial")
          expect(transaction.decision.final_decision).not.toBe("FILL");
        else expect(transaction.decision.final_decision).toBe("FILL");
        expect(currentDecision.decision.final_decision).not.toBe("FILL");
        expect(meter.input).toBe(0);
        expect(meter.change).toBe(0);
        expect(value).toBe("");
        if (phase === "focus") expect(meter.focus).toBe(1);
        if (execution?.items[0]?.status === "EXECUTED")
          expect(execution.items[0].result.outcome).not.toBe("VERIFIED");
        expect(inventory.inventory.readiness).toBe("NOT_READY");
      } finally {
        await harness.page.close();
        await harness.controller.close();
      }
    });
  }
}

for (const tree of ["document", "shadow"] as const) {
  test(`W14 peer: ${tree} outside-root ancestry depth270 refuses positive authority and reports required field`, async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }, testInfo) => {
    const harness = await openHarness(
      extensionContext,
      extensionId,
      serviceWorker,
      "/native/",
    );
    try {
      await setFixture(
        harness,
        `<section aria-label="Employer">${"<div>".repeat(270)}<div id="deep-owner-host"></div>${"</div>".repeat(270)}</section>`,
      );
      await harness.page.evaluate((tree) => {
        const host = document.getElementById("deep-owner-host");
        if (host === null) throw new Error("deep host missing");
        const root =
          tree === "shadow" ? host.attachShadow({ mode: "open" }) : host;
        root.innerHTML =
          '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>';
        const input = root.querySelector("input");
        if (input === null) throw new Error("deep input missing");
        const meter = { input: 0, change: 0 };
        (
          window as unknown as { peerDeepOwnerMeter: typeof meter }
        ).peerDeepOwnerMeter = meter;
        input.addEventListener("input", () => {
          meter.input++;
        });
        input.addEventListener("change", () => {
          meter.change++;
        });
      }, tree);
      const top = foundTopFrame(await scanFrames(harness));
      const descriptor = top.descriptors[0];
      if (descriptor === undefined)
        throw new Error("required field must be inventoried");
      const transaction = await approvedTransaction(
        descriptor,
        `peer-deep-owner-${tree}`,
        { kind: "TEXT", text: "Synthetic" },
      );
      const execution =
        transaction.decision.final_decision === "FILL"
          ? await dynExecute(harness, [transaction])
          : null;
      const inventory = reconciled(
        await dynReconcile(harness, top.frame_context.frame_id),
      );
      const meter = await harness.page.evaluate(
        () =>
          (
            window as unknown as {
              peerDeepOwnerMeter: { input: number; change: number };
            }
          ).peerDeepOwnerMeter,
      );
      const value = await harness.page.locator("#first").inputValue();
      await testInfo.attach(`w14-outside-owner-depth270-${tree}.json`, {
        body: JSON.stringify(
          { descriptor, transaction, execution, inventory, meter, value },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(top.descriptors).toHaveLength(1);
      expect(descriptor.required).toBe(true);
      expect(transaction.decision.final_decision).not.toBe("FILL");
      expect(meter).toEqual({ input: 0, change: 0 });
      expect(value).toBe("");
      expect(inventory.inventory.counts.required_unresolved).toBe(1);
      expect(inventory.inventory.readiness).toBe("NOT_READY");
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

for (const tree of ["document", "shadow"] as const) {
  for (const ambiguity of [
    "duplicate-idref",
    "section-token-overflow",
  ] as const) {
    test(`W14 peer: ${tree} outside-root ${ambiguity} refuses partial owner evidence`, async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }, testInfo) => {
      const harness = await openHarness(
        extensionContext,
        extensionId,
        serviceWorker,
        "/native/",
      );
      try {
        // Outer-to-inner semantic order puts Employer beyond the canonical
        // sixteen-token prefix. Every section remains outside the form.
        const sections = Array.from(
          { length: 16 },
          (_, index) => `<section aria-label="Context ${String(index + 1)}">`,
        ).join("");
        const markup =
          ambiguity === "duplicate-idref"
            ? '<p id="owner-name">Your contact</p><p id="owner-name">Employer</p><section aria-labelledby="owner-name"><div id="ambiguous-owner-host"></div></section>'
            : `${sections}<section aria-label="Employer"><div id="ambiguous-owner-host"></div></section>${"</section>".repeat(16)}`;
        await setFixture(harness, markup);
        await harness.page.evaluate((tree) => {
          const host = document.getElementById("ambiguous-owner-host");
          if (host === null) throw new Error("ambiguous host missing");
          const root =
            tree === "shadow" ? host.attachShadow({ mode: "open" }) : host;
          root.innerHTML =
            '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>';
          const input = root.querySelector("input");
          if (input === null) throw new Error("ambiguous input missing");
          const meter = { input: 0, change: 0 };
          (
            window as unknown as { peerAmbiguousOwnerMeter: typeof meter }
          ).peerAmbiguousOwnerMeter = meter;
          input.addEventListener("input", () => {
            meter.input++;
          });
          input.addEventListener("change", () => {
            meter.change++;
          });
        }, tree);
        const top = foundTopFrame(await scanFrames(harness));
        const descriptor = top.descriptors[0];
        if (descriptor === undefined)
          throw new Error("ambiguous required field must be inventoried");
        const transaction = await approvedTransaction(
          descriptor,
          `peer-ambiguous-owner-${tree}-${ambiguity}`,
          { kind: "TEXT", text: "Synthetic" },
        );
        const execution =
          transaction.decision.final_decision === "FILL"
            ? await dynExecute(harness, [transaction])
            : null;
        const inventory = reconciled(
          await dynReconcile(harness, top.frame_context.frame_id),
        );
        const meter = await harness.page.evaluate(
          () =>
            (
              window as unknown as {
                peerAmbiguousOwnerMeter: { input: number; change: number };
              }
            ).peerAmbiguousOwnerMeter,
        );
        const value = await harness.page.locator("#first").inputValue();
        await testInfo.attach(`w14-outside-owner-${ambiguity}-${tree}.json`, {
          body: JSON.stringify(
            {
              tree,
              ambiguity,
              descriptor,
              transaction,
              execution,
              inventory,
              meter,
              value,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        expect(top.descriptors).toHaveLength(1);
        expect(descriptor.required).toBe(true);
        expect(transaction.decision.final_decision).not.toBe("FILL");
        expect(meter).toEqual({ input: 0, change: 0 });
        expect(value).toBe("");
        expect(inventory.inventory.counts.required_unresolved).toBe(1);
        expect(inventory.inventory.readiness).toBe("NOT_READY");
        if (ambiguity === "section-token-overflow") {
          expect(descriptor.address.section_path).toHaveLength(16);
          expect(descriptor.address.section_path).not.toContain("EMPLOYER");
        }
      } finally {
        await harness.page.close();
        await harness.controller.close();
      }
    });
  }
}
