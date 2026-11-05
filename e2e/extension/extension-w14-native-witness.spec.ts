/** Actual MV3 native-surface evidence; this fixture alone injects a fault. */
import { test, expect } from "./support/extension-test.ts";
import { openHarness, setFixture } from "./support/research-harness.ts";
import {
  measureW14Candidate,
  type W14SanitizedInput,
} from "./support/autofill-w14.ts";
import { installW14NativeWitness } from "./support/autofill-w14-native-witness.ts";
import { fixture } from "../../packages/evaluation-runner/test/m02-w13/support.ts";
import { sha256Canonical } from "../../packages/evaluation-runner/src/canonical.ts";
import {
  freezeW14InitialStateOracle,
  scoreW14Preservation,
  W14_INITIAL_STATE_SCHEMA_REF,
} from "../../packages/evaluation-runner/src/autofill-preservation.ts";

test("W14 native witness: eventless protected write and restore cannot claim zero-write preservation", async ({
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
    const input: W14SanitizedInput = {
      html: '<form data-japp-application-root="true"><label for="first">Employer</label><input id="first" name="employer" value="Synthetic existing record"></form>',
      profile: [],
      site_runtime: "STATIC_REJECTION_V1",
    };
    // Commit the protected initial state and the complete same-input case
    // before the injected fault or any candidate execution.
    const f = fixture();
    const expectedValue = sha256Canonical("Synthetic existing record");
    const oracle = {
      ...f.oracle,
      profile_digest: sha256Canonical(input),
      fields: f.oracle.fields.map((field) => ({
        ...field,
        class: "UNSUPPORTED" as const,
        supported: false,
        expected: "ABSTAIN" as const,
        required: false,
        value_digest: null,
      })),
    };
    const initial = freezeW14InitialStateOracle(
      {
        format_version: "W14_INITIAL_STATE_ORACLE_1",
        case_id: oracle.case_id,
        oracle_digest: sha256Canonical(oracle),
        input_digest: oracle.profile_digest,
        fields: [{ key: "first", initial_digest: expectedValue }],
      },
      oracle,
    );
    const benchmarkCase = {
      ...f.benchmarkCase,
      input_artifacts: [
        {
          ...f.benchmarkCase.input_artifacts[0],
          artifact_digest: sha256Canonical(oracle),
        },
        {
          ...f.benchmarkCase.input_artifacts[1],
          artifact_digest: oracle.profile_digest,
        },
        {
          artifact_ref: "artifact_00000000000000000000000003",
          artifact_digest: sha256Canonical(initial),
          schema_ref: W14_INITIAL_STATE_SCHEMA_REF,
        },
      ],
    };
    const measurement = await measureW14Candidate(harness, input, async () => {
      const witness = await installW14NativeWitness(
        extensionContext,
        harness.page,
        extensionId,
      );
      // Inject only into the actual content-script realm, using the native
      // value accessor exactly as the reviewed driver does, without events.
      const response = await witness.session.send("Runtime.evaluate", {
        contextId: witness.contextId,
        returnByValue: true,
        expression: `(() => {
          const node = document.getElementById("first");
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          Reflect.apply(setter, node, ["Wrong temporary record"]);
          Reflect.apply(setter, node, ["Synthetic existing record"]);
        })()`,
      });
      if (response.exceptionDetails !== undefined)
        throw new Error("test injection failed");
      return witness;
    });
    expect(measurement.observed.meter.actions).toEqual([]);
    expect(measurement.observed.meter.rerenders).toBe(0);
    expect(measurement.initial[0]?.value_digest).toBe(
      measurement.final[0]?.value_digest,
    );
    expect(measurement.native_witness?.native_mutation_count).toBe(2);
    expect(
      measurement.native_witness?.witnesses.filter(
        (item) => item.surface === "INPUT_VALUE",
      ),
    ).toHaveLength(2);
    expect(measurement.measurement_issues).toContain(
      "MEASUREMENT_ERROR:NATIVE_EVENT_ACTION_COUNT_MISMATCH",
    );

    // Show the specific pre-supplement false-zero failure: frozen W13/W14
    // scorers correctly trust their supplied physical audit, which an event
    // meter alone would incorrectly populate with no actions.
    const candidate = {
      ...f.candidate,
      profile_digest: oracle.profile_digest,
      oracle_digest: sha256Canonical(oracle),
      fields: measurement.observed.fields,
    };
    const audit = { ...f.audit, fields: [{ key: "first", actions: [] }] };
    expect(measurement.initial[0]?.value_digest).toBe(expectedValue);
    expect(measurement.final[0]?.value_digest).toBe(expectedValue);
    const oldEventOnlyScore = scoreW14Preservation(
      benchmarkCase,
      oracle,
      initial,
      {
        format_version: "W14_STATE_OBSERVATION_1",
        case_id: oracle.case_id,
        initial_oracle_digest: sha256Canonical(initial),
        candidate_digest: sha256Canonical(candidate),
        physical_digest: sha256Canonical(audit),
        initial: measurement.initial.map((field) => ({
          key: field.key,
          observed_digest: field.value_digest,
        })),
        final: measurement.final.map((field) => ({
          key: field.key,
          observed_digest: field.value_digest,
        })),
      },
      candidate,
      audit,
    );
    expect(oldEventOnlyScore.preservation.counts.correct_preservations).toBe(1);
    expect(
      oldEventOnlyScore.preservation.counts.protected_physical_actions,
    ).toBe(0);
    await testInfo.attach("w14-native-eventless-write-restore.json", {
      body: JSON.stringify({ measurement, oldEventOnlyScore }, null, 2),
      contentType: "application/json",
    });
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 native witness: real driver writes retain framework events and controlled rerenders", async ({
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
    const measurement = await measureW14Candidate(
      harness,
      {
        html: '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>',
        profile: [{ concept: "FIRST_NAME", value: "Synthetic" }],
        site_runtime: "STATIC_REJECTION_V1",
      },
      () =>
        installW14NativeWitness(extensionContext, harness.page, extensionId),
    );
    expect(measurement.measurement_issues).toEqual([]);
    expect(measurement.native_witness?.native_mutation_count).toBe(1);
    expect(
      measurement.native_witness?.witnesses.filter(
        (item) => item.surface === "INPUT_VALUE",
      ),
    ).toHaveLength(1);
    expect(measurement.observed.meter.actions).toHaveLength(1);
    expect(measurement.observed.meter.rerenders).toBe(1);
    expect(measurement.observed.results[0]?.outcome).toBe("VERIFIED");
    expect(
      measurement.observed.results[0]?.action_attempt.duration_ms,
    ).toBeGreaterThanOrEqual(75);
    expect(await harness.page.locator("#first").inputValue()).toBe("Synthetic");
    await testInfo.attach("w14-native-real-driver.json", {
      body: JSON.stringify(measurement, null, 2),
      contentType: "application/json",
    });
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 native witness: every installed setter and interaction surface reaches the independent collector", async ({
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
      '<form data-japp-application-root="true"><input id="text"><textarea id="area"></textarea><select id="select"><option value="">Choose</option><option value="US">United States</option></select><input id="check" type="checkbox"><input id="file" type="file"><button id="button" type="button">Local action</button><div id="scroll" style="height:20px;overflow:auto"><div style="height:100px"></div></div></form>',
    );
    const handle = await installW14NativeWitness(
      extensionContext,
      harness.page,
      extensionId,
    );
    try {
      const injected = await handle.session.send("Runtime.evaluate", {
        contextId: handle.contextId,
        returnByValue: true,
        expression: `(() => {
          const text = document.getElementById("text");
          const area = document.getElementById("area");
          const select = document.getElementById("select");
          const check = document.getElementById("check");
          const file = document.getElementById("file");
          text.value = "Synthetic";
          area.value = "Synthetic";
          select.value = "US";
          check.checked = true;
          file.files = new DataTransfer().files;
          select.selectedIndex = -1;
          document.getElementById("button").click();
          document.getElementById("scroll").scrollTop = 20;
          text.focus();
          text.blur();
          text.dispatchEvent(new Event("input", { bubbles: true }));
        })()`,
      });
      expect(injected.exceptionDetails).toBeUndefined();
      const audit = await handle.snapshot();
      expect(audit.coverage).toBe("COMPLETE_INSTALLED_NATIVE_SURFACES");
      expect(audit.native_mutation_count).toBe(7);
      expect(audit.interaction_count).toBe(4);
      expect(audit.witnesses.map((item) => item.surface).sort()).toEqual(
        audit.surfaces.toSorted(),
      );
      expect(audit.witnesses.every((item) => item.succeeded)).toBe(true);
      expect(JSON.stringify(audit)).not.toContain("Synthetic");
      await testInfo.attach("w14-native-installed-surface-coverage.json", {
        body: JSON.stringify(audit, null, 2),
        contentType: "application/json",
      });
    } finally {
      await handle.dispose();
    }
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});

test("W14 native witness: equal native and framework counts cannot hide a different event value", async ({
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
    const measurement = await measureW14Candidate(
      harness,
      {
        html: '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="first" required></form>',
        profile: [{ concept: "FIRST_NAME", value: "Synthetic" }],
        site_runtime: "STATIC_REJECTION_V1",
      },
      async () => {
        const witness = await installW14NativeWitness(
          extensionContext,
          harness.page,
          extensionId,
        );
        // A page-owned handler changes the value before the independent event
        // meter observes it. The single extension setter still records Synthetic.
        await harness.page.evaluate(() => {
          document.addEventListener(
            "input",
            (event) => {
              if (
                event.target instanceof HTMLInputElement &&
                event.target.id === "first"
              )
                event.target.value = "Different event value";
            },
            true,
          );
        });
        return witness;
      },
    );
    expect(measurement.native_witness?.native_mutation_count).toBe(1);
    expect(measurement.observed.meter.actions).toHaveLength(1);
    expect(measurement.measurement_issues).not.toContain(
      "MEASUREMENT_ERROR:NATIVE_EVENT_ACTION_COUNT_MISMATCH",
    );
    expect(measurement.measurement_issues).toContain(
      "MEASUREMENT_ERROR:NATIVE_EVENT_ACTION_VALUE_MISMATCH",
    );
    await testInfo.attach("w14-native-event-value-disagreement.json", {
      body: JSON.stringify(measurement, null, 2),
      contentType: "application/json",
    });
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
