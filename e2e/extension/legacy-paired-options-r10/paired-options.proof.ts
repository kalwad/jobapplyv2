/** Four declared synthetic inputs; one shared-byte legacy component baseline. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { assertR10Bound } from "./r10-readiness.mjs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { arch, cpus, platform, release } from "node:os";
import {
  test,
  expect,
  EXTENSION_DIST,
  LAB_ORIGIN,
} from "../support/extension-test.ts";
import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../../apps/extension/src/feasibility-protocol.ts";
import { tabIdForPage } from "../support/research-harness.ts";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../../packages/evaluation-runner/src/canonical.ts";
import type { SanitizedAutofillInput } from "../support/autofill-benchmark.ts";
import { executePairedOptionsPeer } from "./candidate-kernel.ts";
import {
  assertRuntimeInventory,
  type RuntimeInventoryBinding,
} from "./runtime-inventory.ts";
import {
  installW14NativeWitness,
  nativeMutationWitnesses,
  type W14NativeWitnessHandle,
  type W14NativeWitnessAudit,
} from "../support/autofill-w14-native-witness.ts";
interface NativeField {
  key: string;
  value: string;
  checked: boolean | null;
  valid: boolean;
  aria_invalid: string | null;
}
interface Meter {
  events: { key: string; type: string; value: string; at_ms: number }[];
  navigation: string[];
  submissions: number;
  rerenders: number;
}
interface FrozenRow {
  index: number;
  case_id: string;
  fixture_id: string;
  input_digest: string;
  html_digest: string;
  profile_digest: string;
  original_canonical_case_digest: string;
  oracle_digest: string;
  ordinary_expectations: {
    key: string;
    concept: string;
    value: string;
    required: boolean;
  }[];
}
assertR10Bound();
const here = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));
const expectedLock = process.env.JAPP_W14_PAIRED_EXPECTED_LOCK;
const lockBytes = readFileSync(join(here, "campaign.lock.json"));
if (expectedLock === undefined || sha256Bytes(lockBytes) !== expectedLock)
  throw new Error("PAIRED_OPTIONS_LOCK_COMMITMENT_REQUIRED_OR_DRIFTED");
const lock = JSON.parse(lockBytes.toString("utf8")) as {
  format_version: string;
  files: { path: string; sha256: string }[];
};
if (lock.format_version !== "W14_PAIRED_OPTIONS_CAMPAIGN_LOCK_1")
  throw new Error("PAIRED_OPTIONS_LOCK_FORMAT_REFUSED");
for (const file of lock.files)
  if (sha256Bytes(readFileSync(join(here, file.path))) !== file.sha256)
    throw new Error("PAIRED_OPTIONS_SOURCE_DRIFT");
const bindings = JSON.parse(
  readFileSync(join(here, "source-bindings.json"), "utf8"),
) as {
  format_version: string;
  cases: FrozenRow[];
  meter_function_sha256: string;
  legacy_browser_version: string;
  legacy_origin: string;
  current_origin: string;
  limitations: string[];
  native_observer: {
    coverage: string;
    helper_sha256: string;
    source: string;
    realm: string;
    surfaces: string[];
  };
} & RuntimeInventoryBinding;
if (
  bindings.format_version !== "W14_PAIRED_OPTIONS_SOURCE_BINDING_1" ||
  bindings.cases.length !== 4
)
  throw new Error("PAIRED_OPTIONS_BINDING_FORMAT_REFUSED");
assertRuntimeInventory(root, bindings);
const inputs = JSON.parse(
  readFileSync(join(here, "paired-inputs.json"), "utf8"),
) as {
  case_id: string;
  fixture_id: string;
  input: SanitizedAutofillInput;
}[];
const original = JSON.parse(
  readFileSync(join(here, "preimages/evaluation-inputs.json"), "utf8"),
) as typeof inputs;
const oracles = JSON.parse(
  readFileSync(join(here, "paired-oracles.json"), "utf8"),
) as unknown[];
const meterFunction = readFileSync(
  join(here, "preimages/legacy-meter-function.txt"),
  "utf8",
);
if (
  inputs.length !== 4 ||
  oracles.length !== 4 ||
  sha256Bytes(meterFunction) !== bindings.meter_function_sha256
)
  throw new Error("PAIRED_OPTIONS_INVENTORY_OR_METER_DRIFT");
for (const [index, entry] of inputs.entries()) {
  const bound = bindings.cases[index];
  const old = original[index];
  if (
    bound === undefined ||
    old === undefined ||
    entry.case_id !== bound.case_id ||
    entry.fixture_id !== bound.fixture_id ||
    entry.case_id === old.case_id ||
    sha256Canonical(entry.input) !== bound.input_digest ||
    sha256Bytes(entry.input.html) !== bound.html_digest ||
    sha256Canonical(entry.input.profile) !== bound.profile_digest ||
    sha256Canonical(oracles[index]) !== bound.oracle_digest ||
    entry.input.html !== old.input.html ||
    Object.keys(entry.input).sort().join() !== "html,profile" ||
    entry.input.profile.length !== old.input.profile.length
  )
    throw new Error("PAIRED_OPTIONS_INPUT_OR_ORACLE_DRIFT");
  for (const [factIndex, fact] of entry.input.profile.entries()) {
    const prior = old.input.profile[factIndex];
    const token =
      fact.concept === "ADDRESS_COUNTRY"
        ? "United States"
        : fact.concept === "ADDRESS_REGION"
          ? "Michigan"
          : undefined;
    if (
      prior?.concept !== fact.concept ||
      prior.value !== fact.value ||
      fact.valueToken !== token ||
      Object.keys(fact).sort().join() !==
        (token === undefined ? "concept,value" : "concept,value,valueToken")
    )
      throw new Error("PAIRED_OPTIONS_NONDECLARED_PROFILE_DELTA");
  }
}
function requireNativeAudit(audit: W14NativeWitnessAudit): void {
  if (
    audit.coverage !== bindings.native_observer.coverage ||
    audit.source !== bindings.native_observer.source ||
    audit.realm !== bindings.native_observer.realm ||
    sha256Canonical([...audit.surfaces].sort()) !==
      sha256Canonical([...bindings.native_observer.surfaces].sort())
  )
    throw new Error("PAIRED_OPTIONS_NATIVE_SCOPE_OR_INTEGRITY_REFUSED");
}
function inventory(
  directory: string,
  prefix = "",
): { path: string; digest: string }[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error("PAIRED_OPTIONS_SOURCE_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? inventory(directory, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(directory, path))) }];
    });
}
function currentBinding() {
  return {
    extension_build: inventory(EXTENSION_DIST),
    current_runtime_inventory: assertRuntimeInventory(root, bindings),
    comparison_sources: inventory(here),
    research_harness: sha256Bytes(
      readFileSync(join(root, "e2e/extension/support/research-harness.ts")),
    ),
    native_witness_harness: sha256Bytes(
      readFileSync(
        join(root, "e2e/extension/support/autofill-w14-native-witness.ts"),
      ),
    ),
    extension_fixture: sha256Bytes(
      readFileSync(join(root, "e2e/extension/support/extension-test.ts")),
    ),
  };
}
for (const [index, frozen] of inputs.entries()) {
  test(`paired explicit approved options: ${frozen.fixture_id}`, async ({
    extensionContext,
    serviceWorker,
    extensionId,
  }, testInfo) => {
    test.setTimeout(60_000);
    const expected = bindings.cases[index];
    if (expected === undefined)
      throw new Error("PAIRED_OPTIONS_DECLARATION_MISSING");
    const startBinding = currentBinding();
    const fixtureUrl = `${LAB_ORIGIN}/fixture/${String(index)}`;
    const refusedRequests: {
      method: string;
      origin: string;
      path_digest: string;
    }[] = [];
    await extensionContext.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.url() === fixtureUrl) {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: `<!doctype html><html><head><meta charset=utf-8></head><body>${frozen.input.html}</body></html>`,
        });
      } else if (
        ["about:", "chrome:", "chrome-extension:", "blob:", "data:"].includes(
          url.protocol,
        )
      ) {
        await route.continue();
      } else {
        refusedRequests.push({
          method: request.method(),
          origin: url.origin,
          path_digest: sha256Canonical(`${url.pathname}${url.search}`),
        });
        await route.abort("blockedbyclient");
      }
    });
    await extensionContext.addInitScript({
      content: `(${meterFunction})(20);`,
    });
    const page = await extensionContext.newPage();
    const controller = await extensionContext.newPage();
    let witness: W14NativeWitnessHandle | undefined;
    let nativeBefore: W14NativeWitnessAudit | null = null;
    try {
      await page.goto(fixtureUrl);
      await expect(page.locator("html")).toHaveAttribute(
        CONTENT_READY_ATTRIBUTE,
        CONTENT_READY_VALUE,
      );
      await page.waitForTimeout(750);
      const observeFields = () =>
        page
          .locator(
            "[data-japp-application-root] input,[data-japp-application-root] select,[data-japp-application-root] textarea",
          )
          .evaluateAll((nodes) =>
            nodes.map((element) => {
              const node = element as
                HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              return {
                key: node.id,
                value: node.value,
                checked: node instanceof HTMLInputElement ? node.checked : null,
                valid: node.validity.valid,
                aria_invalid: node.getAttribute("aria-invalid"),
                // Read-only association evidence; never supplied to the runtime.
                label_text: [...(node.labels ?? [])]
                  .map((label) => label.textContent.trim())
                  .join(" "),
                attribute_evidence: [
                  "field-attributes-v1",
                  node instanceof HTMLSelectElement
                    ? node.multiple
                      ? "MULTI_SELECT"
                      : "SELECT"
                    : node instanceof HTMLTextAreaElement
                      ? "TEXTAREA"
                      : node.getAttribute("role") === "combobox"
                        ? "COMBOBOX"
                        : node.type === "file"
                          ? "FILE"
                          : node.type === "date"
                            ? "DATE"
                            : node.type === "checkbox"
                              ? "CHECKBOX"
                              : "TEXT",
                  node.tagName.toLowerCase(),
                  node.getAttribute("role") ?? "",
                  node instanceof HTMLInputElement
                    ? node.type.toLowerCase()
                    : "",
                  node.getAttribute("name") ?? "",
                  node.getAttribute("autocomplete") ?? "",
                  node.getAttribute("placeholder") ?? "",
                  node.getAttribute("aria-multiline") ?? "",
                  node instanceof HTMLSelectElement && node.multiple
                    ? "multiple"
                    : "",
                ].join("\0"),
              };
            }),
          );
      const initial = await observeFields();
      const tabId = await tabIdForPage(serviceWorker, page);
      await controller.goto(`chrome-extension://${extensionId}/manifest.json`);
      await page.bringToFront();
      witness = await installW14NativeWitness(
        extensionContext,
        page,
        extensionId,
      );
      nativeBefore = await witness.snapshot();
      requireNativeAudit(nativeBefore);
      const started = performance.now();
      const observed = await executePairedOptionsPeer(
        { page, controller, tabId },
        frozen.input,
        frozen.case_id,
      );
      const elapsed = performance.now() - started;
      await page.waitForTimeout(150);
      const final = await observeFields();
      const physical = await page.evaluate(
        () =>
          (globalThis as unknown as { legacyPhysicalMeter: Meter })
            .legacyPhysicalMeter,
      );
      let nativeAudit: W14NativeWitnessAudit | null = null;
      let nativeObservationError: string | null = null;
      try {
        nativeAudit = await witness.snapshot();
        requireNativeAudit(nativeAudit);
      } catch {
        nativeObservationError = "NATIVE_WITNESS_SNAPSHOT_UNOBSERVED";
      }
      const comparison = expected.ordinary_expectations.map((item) => {
        const current = final.filter((field) => field.key === item.key);
        // No historical legacy result is the result of this new campaign.
        const legacy: NativeField[] = [];
        const before = initial.filter((field) => field.key === item.key);
        const native = current.length === 1 ? current[0] : undefined;
        const prior = legacy.length === 1 ? legacy[0] : undefined;
        const descriptors =
          before.length === 1
            ? observed.scanner.descriptors.filter(
                (descriptor) =>
                  descriptor.label.normalized_text === before[0]?.label_text &&
                  descriptor.address.attribute_fingerprint ===
                    sha256Bytes(before[0]?.attribute_evidence ?? ""),
              )
            : [];
        const descriptor =
          descriptors.length === 1 ? descriptors[0] : undefined;
        const decisions =
          descriptor === undefined
            ? []
            : observed.decisions.filter(
                (decision) => decision.field_id === descriptor.field_id,
              );
        const decision = decisions.length === 1 ? decisions[0] : undefined;
        const attempts =
          descriptor === undefined
            ? []
            : observed.results.filter(
                (result) => result.field_id === descriptor.field_id,
              );
        const attempt = attempts.length === 1 ? attempts[0] : undefined;
        const execution =
          attempt?.outcome.items.length === 1
            ? attempt.outcome.items[0]
            : undefined;
        const driver =
          execution?.status === "EXECUTED" &&
          decision !== undefined &&
          descriptor !== undefined &&
          execution.result.correlation_id === decision.correlation_id &&
          sha256Canonical(execution.result.field_address) ===
            sha256Canonical(descriptor.address)
            ? execution.result
            : undefined;
        const reports =
          descriptor === undefined
            ? []
            : observed.reconciliation.inventory.items.filter(
                (report) => report.field_id === descriptor.field_id,
              );
        const report = reports.length === 1 ? reports[0] : undefined;
        const witnesses =
          before.length === 1 && current.length === 1
            ? physical.events.filter((event) => event.key === item.key)
            : [];
        const candidateExact =
          current.length === 1 && native?.value === item.value;
        const legacyExact =
          legacy.length === 1 ? prior?.value === item.value : "UNOBSERVED";
        const digitsEquivalent = (value: string | undefined) =>
          value === undefined
            ? "UNOBSERVED"
            : value.replaceAll(/[^0-9]/g, "") ===
              item.value.replaceAll(/[^0-9]/g, "");
        const correction = (value: string | undefined, exact: boolean) =>
          value === undefined
            ? "UNOBSERVED"
            : exact
              ? "NONE_FOR_EXACT_VALUE"
              : item.concept === "PHONE_NUMBER" &&
                  digitsEquivalent(value) === true
                ? "EXACT_FORMAT_DIFFERENCE_ONLY"
                : "VALUE_CORRECTION_REQUIRED_FOR_EXACT_EXPECTATION";
        return {
          key: item.key,
          concept: item.concept,
          required: item.required,
          expected_value: item.value,
          candidate_value: native?.value ?? null,
          legacy_value: prior?.value ?? "UNOBSERVED",
          candidate_exact: candidateExact,
          legacy_exact: legacyExact,
          phone_digits_equivalence_disclosure:
            item.concept === "PHONE_NUMBER"
              ? {
                  method: "ASCII_DIGITS_ONLY_SEPARATE_FROM_EXACT_MATCH",
                  candidate: digitsEquivalent(native?.value),
                  legacy: digitsEquivalent(prior?.value),
                  changes_exact_metric: false,
                  site_acceptance_inference: "NONE",
                }
              : "NOT_APPLICABLE",
          manual_correction_review: {
            scope: "FINAL_VALUE_VS_FROZEN_EXPECTATION_ONLY_NOT_SITE_ACCEPTANCE",
            candidate: correction(native?.value, candidateExact),
            legacy: correction(prior?.value, legacyExact === true),
          },
          candidate_worksheet: {
            join: {
              status: descriptor === undefined ? "UNOBSERVED" : "UNIQUE",
              method:
                "INITIAL_EXACT_NATIVE_LABEL_AND_ATTRIBUTE_FINGERPRINT_THEN_OPAQUE_FIELD_ID",
              field_id: descriptor?.field_id ?? null,
              expected_concept: item.concept,
              resolved_concept: decision?.field_concept ?? "UNOBSERVED",
            },
            decision: decision ?? "UNOBSERVED",
            intended: attempt?.intended ?? "UNOBSERVED",
            driver_execution_status: execution?.status ?? "UNOBSERVED",
            driver_result: driver ?? "UNOBSERVED",
            installed_native_surface_witnesses:
              nativeAudit === null
                ? "UNOBSERVED"
                : nativeAudit.witnesses.filter(
                    (entry) => entry.key === item.key,
                  ),
            driver_value_evidence:
              driver === undefined
                ? "UNOBSERVED"
                : {
                    intended: driver.intended_value,
                    immediate: driver.observed_value_immediate,
                    settled: driver.observed_value_settled,
                    persistence_verified: driver.persistence_verified,
                  },
            immediate_event_witness: {
              scope: "EVENT_WITNESS_ONLY_NOT_NATIVE_IMMEDIATE_OBSERVATION",
              status: witnesses.length === 0 ? "UNOBSERVED" : "OBSERVED",
              first: witnesses[0] ?? null,
              all: witnesses,
            },
            native_final_post_authored_rerender:
              native === undefined
                ? "UNOBSERVED"
                : {
                    scope:
                      "FINAL_NATIVE_SNAPSHOT_AFTER_RUNTIME_AND_150MS_SETTLE_WITH_LITERAL_20MS_RERENDER",
                    value: native.value,
                    checked: native.checked,
                    native_validity: native.valid,
                    aria_invalid: native.aria_invalid,
                    rerender_witness_count: physical.rerenders,
                    per_field_rerender_completion: "UNOBSERVED",
                  },
            site_validation: {
              driver_state: driver?.site_acceptance ?? "UNOBSERVED",
              driver_message_digests:
                driver?.validation_message_digests ?? "UNOBSERVED",
              scanner_initial_state:
                descriptor?.validation_state ?? "UNOBSERVED",
              native_validity_implies_site_acceptance: false,
            },
            unresolved_report:
              report === undefined
                ? "UNOBSERVED"
                : {
                    item: report,
                    unresolved: report.category !== "VERIFIED_FILLED",
                    required_visible_enabled:
                      report.required && report.visible && report.enabled,
                  },
          },
        };
      });
      const ordinary = new Set(
        expected.ordinary_expectations.map((item) => item.key),
      );
      const unexpected = final
        .filter((field) => !ordinary.has(field.key))
        .filter((field) => {
          const before = initial.find((item) => item.key === field.key);
          return (
            before?.value !== field.value || before.checked !== field.checked
          );
        });
      const endBinding = currentBinding();
      const artifact = {
        format_version: "W14_PAIRED_OPTIONS_CANDIDATE_OBSERVATION_1",
        authority: "NONE",
        gate_pass: false,
        acceptance: null,
        mode: "NEW_PAIRED_PLAIN_VALUE_TOKENS_SHARED_LEGACY_COMPONENT_VS_CURRENT_MV3",
        case_id: frozen.case_id,
        fixture_id: frozen.fixture_id,
        input_digest: sha256Canonical(frozen.input),
        source_bindings: sha256Bytes(
          readFileSync(join(here, "source-bindings.json")),
        ),
        runtime: {
          node: process.version,
          platform: platform(),
          release: release(),
          architecture: arch(),
          cpu_model: cpus()[0]?.model ?? "UNKNOWN",
          logical_cpus: cpus().length,
        },
        browser: {
          candidate: extensionContext.browser()?.version() ?? null,
          legacy: bindings.legacy_browser_version,
        },
        origins: {
          candidate: fixtureUrl,
          legacy: `${bindings.legacy_origin}/fixture/${String(index)}`,
          equal: false,
        },
        profile_enrichment: "EXPLICIT_PLAIN_VALUE_OPTION_TOKENS_ONLY",
        campaign_lock_digest: sha256Bytes(lockBytes),
        expected_legacy_result: "UNOBSERVED_SEPARATE_NEW_RUN_REQUIRED",
        rerender_function_digest: sha256Bytes(meterFunction),
        rerender_delay_ms: 20,
        initial,
        final,
        physical,
        native_observer_actor: "CANDIDATE_DEFAULT_MV3",
        native_observer_helper_digest: bindings.native_observer.helper_sha256,
        candidate_native_before: nativeBefore,
        candidate_native_witness: nativeAudit,
        candidate_native_observation_error: nativeObservationError,
        candidate_native_observer_requested: true,
        unexpected_candidate_native_mutations:
          nativeAudit === null
            ? null
            : nativeMutationWitnesses(nativeAudit).filter(
                (entry) => !ordinary.has(entry.key),
              ),
        physical_observation_scope: {
          event_meter:
            "LITERAL_LEGACY_INPUT_CHANGE_NAVIGATION_SUBMIT_WITNESSES",
          final_native_values: "OBSERVED",
          candidate_native_surface_observer:
            nativeAudit === null ? "UNOBSERVED" : nativeAudit.coverage,
          legacy_native_surface_observer:
            "REQUIRED_SEPARATE_NEW_PAIRED_ARTIFACT",
          transient_eventless_writes:
            nativeAudit === null
              ? "UNOBSERVED_BOTH"
              : "INSTALLED_EXTENSION_REALM_NATIVE_SURFACES_ONLY_BOTH_SYSTEMS_REQUIRE_SEPARATE_ARTIFACTS",
        },
        observed,
        comparison,
        unexpected_nonordinary_changes: unexpected,
        exact_value_counts: {
          candidate: comparison.filter((item) => item.candidate_exact).length,
          legacy: "UNOBSERVED_NEW_PAIRED_RUN_REQUIRED",
          ordinary: comparison.length,
        },
        elapsed_ms_descriptive_only: elapsed,
        refused_requests: refusedRequests,
        start_binding: startBinding,
        end_binding: endBinding,
        source_build_stable:
          sha256Canonical(startBinding) === sha256Canonical(endBinding),
        limitations: [
          ...bindings.limitations,
          "Current source/build hashes establish run stability, not the provenance of a fresh build; root must record its build command before execution.",
          "This observer reuses the literal legacy meter, not the separate W13/W14 wrapper meter or validation repair runtime.",
          "Worksheet joins are review-only. Missing or ambiguous descriptor/result/reconciliation associations remain UNOBSERVED; native validity never establishes site acceptance.",
          "Phone digits equivalence and exact-format correction disclosure do not change frozen expectations, exact booleans/counts, or establish a decisive formatting win.",
        ],
      };
      const artifactPath = testInfo.outputPath("paired-options-candidate.json");
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
      await testInfo.attach("paired-options-candidate.json", {
        path: artifactPath,
        contentType: "application/json",
      });
      expect(artifact.source_build_stable).toBe(true);
      expect(comparison).toHaveLength(10);
      expect(initial).toHaveLength(18);
      expect(final.map((field) => field.key).sort()).toEqual(
        initial.map((field) => field.key).sort(),
      );
      expect(refusedRequests).toEqual([]);
      expect(physical.navigation).toEqual([]);
      expect(physical.submissions).toBe(0);
      expect(unexpected).toEqual([]);
      expect(nativeObservationError).toBeNull();
      expect(nativeAudit?.coverage).toBe("COMPLETE_INSTALLED_NATIVE_SURFACES");
      expect(artifact.unexpected_candidate_native_mutations).toEqual([]);
      // Accuracy is recorded, never asserted to improve or used to rewrite truth.
    } catch (error) {
      let errorNativeAudit: W14NativeWitnessAudit | "UNOBSERVED" = "UNOBSERVED";
      try {
        if (witness !== undefined) errorNativeAudit = await witness.snapshot();
      } catch {
        /* Explicitly incomplete. */
      }
      const errorArtifact = {
        format_version: "W14_PAIRED_OPTIONS_CANDIDATE_ERROR_1",
        authority: "NONE",
        acceptance: null,
        case_id: frozen.case_id,
        input_digest: sha256Canonical(frozen.input),
        campaign_lock_digest: sha256Bytes(lockBytes),
        native_observer_actor: "CANDIDATE_DEFAULT_MV3",
        native_before: nativeBefore ?? "UNOBSERVED",
        native_after_error: errorNativeAudit,
        complete: false,
        code:
          error instanceof Error &&
          /^(W14_NATIVE_|PAIRED_OPTIONS_)/.test(error.message)
            ? error.message
            : "CANDIDATE_ROW_ERROR",
      };
      const errorPath = testInfo.outputPath(
        "paired-options-candidate-error.json",
      );
      writeFileSync(errorPath, `${JSON.stringify(errorArtifact, null, 2)}\n`);
      await testInfo.attach("paired-options-candidate-error.json", {
        path: errorPath,
        contentType: "application/json",
      });
      throw error;
    } finally {
      try {
        await witness?.dispose();
      } finally {
        await page.close();
        await controller.close();
      }
    }
  });
}
