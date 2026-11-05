/** Four declared synthetic inputs; one shared-byte legacy component baseline. */
import { readFileSync, readdirSync } from "node:fs";
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
import { executeFrozenLegacyPeer } from "./candidate-kernel.ts";
import {
  installW14NativeWitness,
  nativeMutationWitnesses,
  type W14NativeWitnessHandle,
  type W14NativeWitnessAudit,
} from "../support/autofill-w14-native-witness.ts";
const here = fileURLToPath(new URL(".", import.meta.url));
const nativeOptIn = process.env.JAPP_W14_LEGACY_CANDIDATE_NATIVE_WITNESS;
if (nativeOptIn !== undefined && nativeOptIn !== "0" && nativeOptIn !== "1")
  throw new Error("W14_LEGACY_CANDIDATE_NATIVE_WITNESS_OPT_IN_REFUSED");
const useNativeWitness = nativeOptIn === "1";
const root = fileURLToPath(new URL("../../..", import.meta.url));
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
  canonical_case_digest: string;
  oracle_digest: string;
  ordinary_expectations: {
    key: string;
    concept: string;
    value: string;
    required: boolean;
  }[];
  legacy_final_fields: NativeField[];
  legacy_exact_matches: string[];
  legacy_exact_mismatches: { key: string; value: string }[];
  legacy_empty: string[];
}
const frozenBindingsDigest =
  "sha256:663685f32767af360848bdcbf17dee5a6c6acbaa3e3e6d5a27409d8ea2a880e2";
if (
  sha256Bytes(readFileSync(join(here, "source-bindings.json"))) !==
  frozenBindingsDigest
)
  throw new Error("LEGACY_PEER_EXPECTED_BINDINGS_DRIFT");
const bindings = JSON.parse(
  readFileSync(join(here, "source-bindings.json"), "utf8"),
) as {
  format_version: string;
  sources: { path: string; sha256: string }[];
  cases: FrozenRow[];
  meter_function_sha256: string;
  legacy_browser_version: string;
  legacy_origin: string;
  current_origin: string;
  limitations: string[];
};
if (
  bindings.format_version !== "W14_FROZEN_LEGACY_CANDIDATE_BINDING_1" ||
  bindings.cases.length !== 4
)
  throw new Error("LEGACY_PEER_BINDING_FORMAT_REFUSED");
for (const source of bindings.sources)
  if (sha256Bytes(readFileSync(join(here, source.path))) !== source.sha256)
    throw new Error("LEGACY_PEER_SOURCE_PREIMAGE_DRIFT");
const inputBytes = readFileSync(join(here, "preimages/evaluation-inputs.json"));
const inputs = JSON.parse(inputBytes.toString("utf8")) as {
  case_id: string;
  fixture_id: string;
  input: SanitizedAutofillInput;
}[];
const meterFunction = readFileSync(
  join(here, "preimages/legacy-meter-function.txt"),
  "utf8",
);
if (
  sha256Bytes(meterFunction) !== bindings.meter_function_sha256 ||
  inputs.length !== 4
)
  throw new Error("LEGACY_PEER_METER_OR_INVENTORY_DRIFT");
const declarations = JSON.parse(
  readFileSync(join(here, "preimages/w13-declarations.json"), "utf8"),
) as {
  benchmarkCase: unknown;
  oracle: unknown;
  input: unknown;
}[];
if (declarations.length !== 4)
  throw new Error("LEGACY_PEER_DECLARATION_INVENTORY_DRIFT");
for (const [index, entry] of inputs.entries()) {
  const bound = bindings.cases[index];
  const declaration = declarations[index];
  if (
    bound === undefined ||
    declaration === undefined ||
    sha256Canonical(declaration.benchmarkCase) !==
      bound.canonical_case_digest ||
    sha256Canonical(declaration.oracle) !== bound.oracle_digest ||
    sha256Canonical(declaration.input) !== bound.input_digest
  )
    throw new Error("LEGACY_PEER_CANONICAL_DECLARATION_DRIFT");
  if (
    entry.case_id !== bound.case_id ||
    entry.fixture_id !== bound.fixture_id ||
    sha256Canonical(entry.input) !== bound.input_digest ||
    sha256Bytes(entry.input.html) !== bound.html_digest ||
    sha256Canonical(entry.input.profile) !== bound.profile_digest ||
    Object.keys(entry.input).sort().join() !== "html,profile" ||
    entry.input.profile.some(
      (fact) => Object.keys(fact).sort().join() !== "concept,value",
    )
  )
    throw new Error("LEGACY_PEER_FROZEN_INPUT_DRIFT");
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
        throw new Error("LEGACY_PEER_SOURCE_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? inventory(directory, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(directory, path))) }];
    });
}
function currentBinding() {
  return {
    extension_build: inventory(EXTENSION_DIST),
    current_sources: [
      "apps/extension/src",
      "apps/extension/entrypoints",
      "packages/form-engine/src",
      "packages/contracts/generated",
    ].flatMap((path) =>
      inventory(join(root, path)).map((entry) => ({
        ...entry,
        path: `${path}/${entry.path}`,
      })),
    ),
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
  test(`exact frozen legacy peer: ${frozen.fixture_id}`, async ({
    extensionContext,
    serviceWorker,
    extensionId,
  }, testInfo) => {
    test.setTimeout(60_000);
    const expected = bindings.cases[index];
    if (expected === undefined)
      throw new Error("LEGACY_PEER_DECLARATION_MISSING");
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
      if (useNativeWitness)
        witness = await installW14NativeWitness(
          extensionContext,
          page,
          extensionId,
        );
      const started = performance.now();
      const observed = await executeFrozenLegacyPeer(
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
      if (witness !== undefined) {
        try {
          nativeAudit = await witness.snapshot();
        } catch {
          nativeObservationError = "NATIVE_WITNESS_SNAPSHOT_UNOBSERVED";
        }
      }
      const comparison = expected.ordinary_expectations.map((item) => {
        const current = final.filter((field) => field.key === item.key);
        const legacy = expected.legacy_final_fields.filter(
          (field) => field.key === item.key,
        );
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
        const legacyExact = legacy.length === 1 && prior?.value === item.value;
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
          legacy_value: prior?.value ?? null,
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
            legacy: correction(prior?.value, legacyExact),
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
        format_version: "W14_FROZEN_LEGACY_CANDIDATE_OBSERVATION_1",
        authority: "NONE",
        gate_pass: false,
        mode: "SINGLE_SHARED_LEGACY_COMPONENT_VS_CURRENT_MV3_SYNTHETIC_INPUTS",
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
        profile_enrichment: false,
        rerender_function_digest: sha256Bytes(meterFunction),
        rerender_delay_ms: 20,
        initial,
        final,
        physical,
        candidate_native_witness: nativeAudit,
        candidate_native_observation_error: nativeObservationError,
        candidate_native_observer_requested: useNativeWitness,
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
          legacy_native_surface_observer: "UNOBSERVED",
          transient_eventless_writes:
            nativeAudit === null
              ? "UNOBSERVED_BOTH"
              : "CANDIDATE_INSTALLED_EXTENSION_NATIVE_SURFACES_ONLY_LEGACY_UNOBSERVED",
        },
        observed,
        comparison,
        unexpected_nonordinary_changes: unexpected,
        exact_value_counts: {
          candidate: comparison.filter((item) => item.candidate_exact).length,
          legacy: comparison.filter((item) => item.legacy_exact).length,
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
      await testInfo.attach("frozen-legacy-peer.json", {
        body: JSON.stringify(artifact, null, 2),
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
      if (useNativeWitness) {
        expect(nativeObservationError).toBeNull();
        expect(nativeAudit?.coverage).toBe(
          "COMPLETE_INSTALLED_NATIVE_SURFACES",
        );
        expect(artifact.unexpected_candidate_native_mutations).toEqual([]);
      }
      // Accuracy is recorded, never asserted to improve or used to rewrite truth.
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
