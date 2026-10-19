import { test, expect } from "./support/extension-test.ts";
import { openHarness } from "./support/research-harness.ts";
import { RESEARCH_MATRIX } from "../../packages/ats-adapters/research/matrix.ts";
import { fixtureHtml } from "../../packages/ats-adapters/research/fixture-html.ts";
import { executeMv3Autofill } from "./support/autofill-benchmark.ts";
import {
  installW14SiteRuntime,
  measureW14Candidate,
  w14Profile,
  type W14SanitizedInput,
} from "./support/autofill-w14.ts";

const source = RESEARCH_MATRIX.find(
  (v) =>
    v.expected.validation === "REQUIRED_MISSING" && !v.expected.sessionBoundary,
);
if (source === undefined) throw new Error("W14_VALIDATION_RECIPE_ABSENT");
const html = fixtureHtml(source);
const scenarios = [
  {
    name: "native-valid email clears the recoverable site error and survives controlled replacement",
    email: "synthetic@example.invalid",
    mode: "RECOVERABLE_NATIVE_REQUIRED_V1",
    expected: "FILLED",
    restoreRejection: false,
  },
  {
    name: "malformed email retains native and ARIA rejection",
    email: "invalid-email",
    mode: "RECOVERABLE_NATIVE_REQUIRED_V1",
    expected: "UNRESOLVED",
    restoreRejection: false,
  },
  {
    name: "persistent site rejection remains rejected despite native validity",
    email: "synthetic@example.invalid",
    mode: "STATIC_REJECTION_V1",
    expected: "UNRESOLVED",
    restoreRejection: false,
  },
  {
    name: "a rerender restoring rejection prevents a verified-fill claim",
    email: "synthetic@example.invalid",
    mode: "RECOVERABLE_NATIVE_REQUIRED_V1",
    expected: "UNRESOLVED",
    restoreRejection: true,
  },
] as const;

for (const scenario of scenarios) {
  test(`W14 site runtime: ${scenario.name}`, async ({
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
      expect(await harness.page.evaluate(() => document.visibilityState)).toBe(
        "visible",
      );
      const input: W14SanitizedInput = {
        html,
        site_runtime: scenario.mode,
        profile: [{ concept: "EMAIL_ADDRESS", value: scenario.email }],
      };
      const observed = await executeMv3Autofill(harness, input, async () => {
        await installW14SiteRuntime(harness, input.site_runtime);
        if (scenario.restoreRejection)
          await harness.page.evaluate(() => {
            document.addEventListener(
              "input",
              (event) => {
                const node = event.target;
                if (node instanceof HTMLInputElement && node.type === "email")
                  setTimeout(() => {
                    node.setAttribute("aria-invalid", "true");
                  }, 10);
              },
              true,
            );
          });
      });
      expect(
        observed.fields.find((field) => field.key === "email")?.status,
      ).toBe(scenario.expected);
      expect(observed.meter.actions).toHaveLength(1);
      expect(observed.meter.rerenders).toBe(1);
      expect(
        observed.results[0]?.action_attempt.duration_ms,
      ).toBeGreaterThanOrEqual(75);
      expect(observed.meter.navigation).toBe(0);
      expect(observed.meter.submission).toBe(0);
      if (scenario.expected === "UNRESOLVED") {
        expect(
          observed.fields.find((field) => field.key === "email")?.reason,
        ).toBe("REQUIRED_UNRESOLVED");
        expect(
          observed.reconciliation.inventory.counts.required_unresolved,
        ).toBeGreaterThan(0);
        expect(observed.reconciliation.inventory.readiness).toBe("NOT_READY");
      } else {
        expect(
          observed.fields.find((field) => field.key === "email")?.persistence,
        ).toBe("PERSISTED");
        expect(
          observed.fields.find((field) => field.key === "email")
            ?.site_acceptance,
        ).toBe("ACCEPTED");
      }
    } finally {
      await harness.page.close();
      await harness.controller.close();
    }
  });
}

test("W14 foreground contact campaign retains ten native writes through full settlement", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const contact = RESEARCH_MATRIX.find(
    (variant) => variant.id === "W12-WORKDAY-GROUPED-en-US-MY_INFORMATION",
  );
  if (contact === undefined) throw new Error("W14_CONTACT_RECIPE_ABSENT");
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    const observed = await measureW14Candidate(harness, {
      html: fixtureHtml(contact),
      site_runtime: "STATIC_REJECTION_V1",
      execution_mode: "SEQUENTIAL_BATCH_V1",
      profile: w14Profile("en-US"),
    });
    expect(observed.visibility).toEqual({
      before: { state: "visible", hidden: false },
      after: { state: "visible", hidden: false },
    });
    expect(observed.measurement_issues).toEqual([]);
    expect(observed.observed.meter.actions).toHaveLength(10);
    expect(observed.observed.meter.rerenders).toBe(10);
    expect(observed.observed.meter.navigation).toBe(0);
    expect(observed.observed.meter.submission).toBe(0);
    expect(observed.observed.results).toHaveLength(10);
    for (const result of observed.observed.results) {
      expect(result.action_attempt.duration_ms).toBeGreaterThanOrEqual(75);
      expect(result.outcome).toBe("VERIFIED");
      expect(result.persistence_verified).toBe(true);
      expect(result.site_acceptance).toBe("ACCEPTED");
    }
    const { phase_timings_ms: phases, scan_fill_duration_ms: duration } =
      observed.observed;
    expect(
      Object.values(phases).every((ms) => Number.isFinite(ms) && ms >= 0),
    ).toBe(true);
    expect(Object.values(phases).reduce((a, b) => a + b, 0)).toBeCloseTo(
      duration,
      6,
    );
    console.log(
      `W14_FOREGROUND_DIAGNOSTIC ${JSON.stringify({ duration_ms: duration, phases, driver_durations_ms: observed.observed.results.map((result) => result.action_attempt.duration_ms) })}`,
    );
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
