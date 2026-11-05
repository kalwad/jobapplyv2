/** W14 visible development measurement. No gate or private-holdout authority. */
import { semanticDigest } from "../../../apps/extension/src/semantic-identity.ts";
import { normalizeText } from "../../../apps/extension/src/field-scanner.ts";
import type { ResearchVariant } from "../../../packages/ats-adapters/research/matrix.ts";
import { fixtureHtml } from "../../../packages/ats-adapters/research/fixture-html.ts";
import {
  freezeOracle,
  type AutofillOracle,
  type FieldObservation,
} from "../../../packages/evaluation-runner/src/autofill.ts";
import {
  sha256Canonical,
  stableIdFromDigest,
  type ContentDigest,
} from "../../../packages/evaluation-runner/src/canonical.ts";
import { computeThresholdSetDigest } from "../../../packages/evaluation-runner/src/thresholds.ts";
import type { BenchmarkCaseV1 } from "../../../packages/evaluation-runner/src/model.ts";
import type { FeasibilityConcept } from "../../../packages/form-engine/src/index.ts";
import {
  executeMv3Autofill,
  type SanitizedAutofillInput,
} from "./autofill-benchmark.ts";
import type { Harness } from "./research-harness.ts";
import {
  nativeMutationWitnesses,
  type W14NativeWitnessHandle,
  type W14NativeWitnessAudit,
} from "./autofill-w14-native-witness.ts";

export const W14_SITE_RUNTIME_VERSION = "1.0.0";
export type W14SanitizedInput = SanitizedAutofillInput & {
  site_runtime: "RECOVERABLE_NATIVE_REQUIRED_V1" | "STATIC_REJECTION_V1";
};

/** Site-owned validation behavior. It has no oracle/profile/expected-value input. */
export async function installW14SiteRuntime(
  harness: Harness,
  mode: W14SanitizedInput["site_runtime"],
) {
  await harness.page.evaluate((runtimeMode) => {
    if (runtimeMode !== "RECOVERABLE_NATIVE_REQUIRED_V1") return;
    const validate = (event: Event) => {
      const node = event.target;
      if (!(node instanceof HTMLInputElement) || node.type !== "email") return;
      const error = document.getElementById("email-error");
      if (
        error?.textContent !== "Email address is required." ||
        !node
          .getAttribute("aria-describedby")
          ?.split(/\s+/u)
          .includes("email-error")
      )
        return;
      node.setAttribute("aria-invalid", String(!node.validity.valid));
      error.hidden = node.validity.valid;
    };
    document.addEventListener("input", validate, true);
    document.addEventListener("change", validate, true);
  }, mode);
}

// This cohort is declared before execution. The executor receives only HTML
// and approved synthetic facts, never these expected classes or value digests.
export const W14_CONTACT_COHORT: Readonly<Record<string, FeasibilityConcept>> =
  {
    "first-name": "FIRST_NAME",
    "last-name": "LAST_NAME",
    email: "EMAIL_ADDRESS",
    phone: "PHONE_NUMBER",
    website: "WEBSITE_URL",
    "street-address": "ADDRESS_LINE_1",
    city: "ADDRESS_CITY",
    state: "ADDRESS_REGION",
    province: "ADDRESS_REGION",
    county: "ADDRESS_REGION",
    "postal-code": "ADDRESS_POSTAL_CODE",
    country: "ADDRESS_COUNTRY",
  };

/** Independently declared locale examples, not values inferred from options. */
export function w14Profile(
  locale: ResearchVariant["locale"],
): SanitizedAutofillInput["profile"] {
  const address = (
    {
      "en-US": ["United States", "Michigan", "48104"],
      "en-GB": ["United Kingdom", "Greater London", "SW1A 1AA"],
      "de-DE": ["Germany", "Berlin", "10115"],
      "fr-CA": ["Canada", "Québec", "H2Y 1C6"],
    } as const
  )[locale];
  return [
    { concept: "FIRST_NAME", value: "Synthetic" },
    { concept: "LAST_NAME", value: "Applicant" },
    { concept: "EMAIL_ADDRESS", value: "synthetic@example.invalid" },
    { concept: "PHONE_NUMBER", value: "2025550100" },
    { concept: "WEBSITE_URL", value: "https://example.invalid/profile" },
    { concept: "ADDRESS_LINE_1", value: "100 Synthetic Avenue" },
    { concept: "ADDRESS_CITY", value: "Synthetic City" },
    { concept: "ADDRESS_REGION", value: address[1], valueToken: address[1] },
    { concept: "ADDRESS_POSTAL_CODE", value: address[2] },
    { concept: "ADDRESS_COUNTRY", value: address[0], valueToken: address[0] },
  ];
}

export function w14Recipe(
  variant: ResearchVariant,
  matrixDigest: ContentDigest,
  corpus: { version: string; digest: ContentDigest },
  toolchainDigest: ContentDigest,
) {
  const input: W14SanitizedInput = {
    execution_mode: "SEQUENTIAL_BATCH_V1",
    site_runtime:
      variant.expected.validation === "REQUIRED_MISSING"
        ? "RECOVERABLE_NATIVE_REQUIRED_V1"
        : "STATIC_REJECTION_V1",
    html: fixtureHtml(variant),
    profile: w14Profile(variant.locale),
  };
  const caseId = stableIdFromDigest(
    "benchmarkcase",
    sha256Canonical({ variant: variant.id, input }),
  );
  const oracle = freezeOracle({
    format_version: "W13_ORACLE_1",
    case_id: caseId,
    fixture_id: variant.id,
    matrix_version: "1.0.0",
    matrix_digest: matrixDigest,
    corpus_version: corpus.version,
    corpus_digest: corpus.digest,
    profile_digest: sha256Canonical(input),
    provenance_digest: sha256Canonical({
      author: "W14_PREDECLARED_CONTACT_RECIPE",
      cohort: W14_CONTACT_COHORT,
      profile: input.profile,
      variant,
    }),
    fields: variant.controls.map((control) => {
      const concept = W14_CONTACT_COHORT[control.id];
      const fact = input.profile.find((f) => f.concept === concept);
      const sensitive = control.policy === "SENSITIVE_ABSTAIN";
      const honeypot = control.policy === "HONEYPOT_ABSTAIN";
      const supported = !sensitive && !honeypot && fact !== undefined;
      const fill = supported && !variant.expected.sessionBoundary;
      return {
        key: control.id,
        concept: concept ?? "UNKNOWN",
        required: control.required,
        visible: !honeypot,
        enabled: !variant.expected.sessionBoundary,
        class: sensitive
          ? "SENSITIVE"
          : honeypot
            ? "HONEYPOT"
            : supported
              ? "ORDINARY"
              : "UNSUPPORTED",
        supported,
        expected: fill ? "FILL" : "ABSTAIN",
        value_digest: fill ? sha256Canonical(fact.value) : null,
        option: control.kind === "select",
      };
    }),
  } satisfies AutofillOracle);
  // MEASURE preserves raw failures. These thresholds concern safety only;
  // no PASS from this development case is a Gate A decision.
  const thresholds: BenchmarkCaseV1["thresholds"] = [
    "SENSITIVE_FILLS",
    "HONEYPOT_FILLS",
    "CATASTROPHIC_OPTION_ERRORS",
    "DUPLICATE_ACTIONS",
    "NAVIGATION_ACTIVATIONS",
    "SUBMISSION_ACTIVATIONS",
  ].map((metric_id) => ({
    metric_id,
    unit: "COUNT",
    comparator: "EXACT",
    expected_value: 0,
  }));
  const thresholdRef = stableIdFromDigest(
    "thresholdset",
    sha256Canonical(thresholds),
  );
  const benchmarkCase: BenchmarkCaseV1 = {
    case_id: caseId,
    case_schema_version: "BENCHMARK_CASE_V1",
    benchmark_family: "AUTOFILL_FEASIBILITY",
    corpus_version: corpus.version,
    corpus_digest: corpus.digest,
    input_artifacts: [
      {
        artifact_ref: stableIdFromDigest("artifact", sha256Canonical(oracle)),
        artifact_digest: sha256Canonical(oracle),
        schema_ref: "urn:japp:schema:evaluation-artifact:w13-oracle:v1",
      },
      {
        artifact_ref: stableIdFromDigest("artifact", sha256Canonical(input)),
        artifact_digest: sha256Canonical(input),
        schema_ref: "urn:japp:schema:evaluation-artifact:w13-input:v1",
      },
    ],
    expected_behavior: "MEASURE",
    threshold_set_ref: thresholdRef,
    threshold_set_digest: computeThresholdSetDigest({
      threshold_set_ref: thresholdRef,
      thresholds,
    }),
    thresholds,
    environment_requirements: {
      runtime_profile: "NODE",
      platform_profile: "DEVELOPMENT",
      toolchain_digest: toolchainDigest,
      adapter_version: "1.0.0",
    },
    synthetic_data: true,
    provenance: {
      source_kind: "GENERATED",
      source_id: stableIdFromDigest("source", oracle.provenance_digest),
      observed_at: "2026-10-16T00:00:00Z",
      source_digest: oracle.provenance_digest,
    },
    holdout_visibility: "PUBLIC_SYNTHETIC",
    applicable_platform_profiles: ["DEVELOPMENT"],
  };
  return { benchmarkCase, oracle, input };
}

export async function logicalControls(
  harness: Pick<Harness, "page">,
  markup?: string,
) {
  const controls = await harness.page.evaluate((html) => {
    const root =
      html === null
        ? document
        : new DOMParser().parseFromString(html, "text/html");
    const seen = new Set<string>();
    return [
      ...root.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea"),
    ].flatMap((node) => {
      const radio = node instanceof HTMLInputElement && node.type === "radio";
      const group = radio ? node.closest("fieldset") : null;
      const key = group?.id ?? node.id;
      if (seen.has(key)) return [];
      seen.add(key);
      const members =
        group === null
          ? [node]
          : [...group.querySelectorAll<HTMLInputElement>("input[type=radio]")];
      const selected = members.find(
        (member) => member instanceof HTMLInputElement && member.checked,
      );
      const value = radio
        ? (selected?.value ?? "")
        : node instanceof HTMLInputElement && node.type === "checkbox"
          ? node.checked
            ? "true"
            : ""
          : node.value;
      const scannerKind = radio
        ? "RADIO_GROUP"
        : node.getAttribute("role") === "combobox"
          ? "COMBOBOX"
          : node instanceof HTMLTextAreaElement
            ? "TEXTAREA"
            : node instanceof HTMLSelectElement
              ? node.multiple
                ? "MULTI_SELECT"
                : "SELECT"
              : node.type === "date"
                ? "DATE"
                : node.type === "file"
                  ? "FILE"
                  : node.type === "checkbox"
                    ? "CHECKBOX"
                    : "TEXT";
      // Measurement join only. This disposable DOM association never enters
      // a decision or transaction, whose semantic address remains authoritative.
      const attributeSeed = [
        "field-attributes-v1",
        scannerKind,
        node.tagName.toLowerCase(),
        node.getAttribute("role") ?? "",
        node instanceof HTMLInputElement ? node.type.toLowerCase() : "",
        node.getAttribute("name") ?? "",
        node.getAttribute("autocomplete") ?? "",
        node.getAttribute("placeholder") ?? "",
        node.getAttribute("aria-multiline") ?? "",
        node instanceof HTMLSelectElement && node.multiple ? "multiple" : "",
      ].join("\0");
      return [
        {
          attributeSeed,
          key,
          native_keys: members.map((member) => member.id),
          label:
            group?.querySelector("legend")?.textContent ??
            node.labels?.[0]?.textContent ??
            "",
          value,
          valid: members.every(
            (member) =>
              member.validity.valid &&
              member.getAttribute("aria-invalid") !== "true",
          ),
          required: members.some((member) => member.required),
          disabled: members.every((member) => member.disabled),
          kind: radio
            ? "radio"
            : node.getAttribute("role") === "combobox"
              ? "combobox"
              : node instanceof HTMLInputElement
                ? node.type
                : node.tagName.toLowerCase(),
        },
      ];
    });
  }, markup ?? null);
  return Promise.all(
    controls.map(async ({ value, attributeSeed, ...control }) => ({
      ...control,
      attribute_fingerprint: await semanticDigest(attributeSeed),
      value_digest: value === "" ? null : sha256Canonical(value),
    })),
  );
}

/** Candidate has no oracle input. Only this observer normalizes logical radios. */
export async function measureW14Candidate(
  harness: Harness,
  input: W14SanitizedInput,
  installNativeWitness?: () => Promise<W14NativeWitnessHandle>,
) {
  // Declare a foreground user-tab measurement. The extension-origin
  // controller stays available for IPC without owning the active tab.
  await harness.page.bringToFront();
  const declaredInitial = await logicalControls(harness, input.html);
  let initial: Awaited<ReturnType<typeof logicalControls>> | undefined;
  let initialVisibility:
    { state: DocumentVisibilityState; hidden: boolean } | undefined;
  let nativeHandle: W14NativeWitnessHandle | undefined;
  let nativeAudit: W14NativeWitnessAudit | null = null;
  let candidate: Awaited<ReturnType<typeof executeMv3Autofill>>;
  try {
    candidate = await executeMv3Autofill(harness, input, async () => {
      await installW14SiteRuntime(harness, input.site_runtime);
      initial = await logicalControls(harness);
      initialVisibility = await harness.page.evaluate(() => ({
        state: document.visibilityState,
        hidden: document.hidden,
      }));
      nativeHandle = await installNativeWitness?.();
    });
    if (nativeHandle !== undefined) nativeAudit = await nativeHandle.snapshot();
  } finally {
    await nativeHandle?.dispose();
  }
  if (initial === undefined) throw new Error("W14_INITIAL_OBSERVATION_MISSING");
  if (initialVisibility === undefined)
    throw new Error("W14_VISIBILITY_OBSERVATION_MISSING");
  const finalVisibility = await harness.page.evaluate(() => ({
    state: document.visibilityState,
    hidden: document.hidden,
  }));
  const final = await logicalControls(harness);
  const issues: string[] = [];

  if (
    initial
      .map((f) => f.key)
      .sort()
      .join() !==
    final
      .map((f) => f.key)
      .sort()
      .join()
  )
    issues.push("MEASUREMENT_ERROR:CHANGED_CONTROL_INVENTORY");
  const actions = candidate.meter.actions.map((action) => {
    const field = final.find((item) => item.native_keys.includes(action.key));
    if (field === undefined)
      issues.push("MEASUREMENT_ERROR:UNJOINED_PHYSICAL_ACTION");
    return { ...action, key: field?.key ?? action.key };
  });
  if (nativeAudit !== null) {
    const nativeActions = nativeMutationWitnesses(nativeAudit);
    for (const action of nativeActions) {
      if (
        !["INPUT_VALUE", "TEXTAREA_VALUE", "SELECT_VALUE"].includes(
          action.surface,
        )
      )
        issues.push("MEASUREMENT_ERROR:UNSUPPORTED_NATIVE_MUTATION_SURFACE");
      if (!action.succeeded)
        issues.push("MEASUREMENT_ERROR:FAILED_NATIVE_MUTATION");
      if (!final.some((item) => item.native_keys.includes(action.key)))
        issues.push("MEASUREMENT_ERROR:UNJOINED_NATIVE_MUTATION");
    }
    for (const field of final) {
      const orderedNative = nativeActions.filter((action) =>
        field.native_keys.includes(action.key),
      );
      const orderedEvents = actions.filter(
        (action) => action.key === field.key,
      );
      if (orderedNative.length !== orderedEvents.length)
        issues.push("MEASUREMENT_ERROR:NATIVE_EVENT_ACTION_COUNT_MISMATCH");
      if (
        orderedNative.some((action, index) => {
          const event = orderedEvents[index];
          return (
            event !== undefined &&
            (action.value_digest !== sha256Canonical(event.value) ||
              (action.surface === "SELECT_VALUE"
                ? event.kind !== "OPTION"
                : event.kind !== "FILL"))
          );
        })
      )
        issues.push("MEASUREMENT_ERROR:NATIVE_EVENT_ACTION_VALUE_MISMATCH");
    }
  }
  const fields: FieldObservation[] = final.map((field) => {
    const matches = candidate.scanner_fields.filter(
      (descriptor) =>
        descriptor.label === normalizeText(field.label) &&
        descriptor.attribute_fingerprint === field.attribute_fingerprint,
    );
    if (matches.length > 1)
      issues.push("REFUSED_INPUT_MODEL:DUPLICATE_SEMANTIC_JOIN");
    const descriptor = matches.length === 1 ? matches[0] : undefined;
    const decision = candidate.decisions.find(
      (item) => item.field_id === descriptor?.field_id,
    );
    const result =
      decision === undefined
        ? undefined
        : candidate.results.find(
            (item) => item.correlation_id === decision.correlation_id,
          );
    const inventory =
      descriptor === undefined
        ? undefined
        : candidate.reconciliation.inventory.items.find(
            (item) => item.field_id === descriptor.field_id,
          );
    const attempted = actions.some((action) => action.key === field.key);
    const unresolved =
      inventory !== undefined &&
      inventory.required &&
      inventory.visible &&
      inventory.enabled &&
      inventory.category !== "VERIFIED_FILLED";
    const filled =
      result?.outcome === "VERIFIED" &&
      inventory?.category === "VERIFIED_FILLED";
    return {
      key: field.key,
      status: filled ? "FILLED" : unresolved ? "UNRESOLVED" : "ABSTAINED",
      observed_digest: field.value_digest,
      persistence: attempted
        ? result?.persistence_verified === true && !inventory?.changed_value
          ? "PERSISTED"
          : "REVERTED"
        : "UNKNOWN",
      site_acceptance: attempted
        ? result?.site_acceptance === "ACCEPTED" && field.valid
          ? "ACCEPTED"
          : "REJECTED"
        : "UNKNOWN",
      reason: filled
        ? "VERIFIED"
        : unresolved
          ? "REQUIRED_UNRESOLVED"
          : attempted
            ? "SITE_REJECTED"
            : "POLICY_ABSTAIN",
      report_digest: sha256Canonical({
        decision:
          candidate.decisions.find(
            (d) => d.field_id === descriptor?.field_id,
          ) ?? null,
        result: result ?? null,
        inventory: inventory ?? null,
      }),
    };
  });
  return {
    native_witness: nativeAudit,
    visibility: { before: initialVisibility, after: finalVisibility },
    declared_initial: declaredInitial,
    initial,
    final,
    measurement_issues: [...new Set(issues)].sort(),
    observed: { ...candidate, fields, meter: { ...candidate.meter, actions } },
  };
}
