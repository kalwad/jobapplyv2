/** W13 candidate execution. Receives fixture/profile input, never oracle answers. */
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
  type FeasibilityConcept,
} from "../../../packages/form-engine/src/index.ts";
import { normalizeText } from "../../../apps/extension/src/field-scanner.ts";
import { semanticDigest } from "../../../apps/extension/src/semantic-identity.ts";
import type {
  FormDriverResultV1,
  FormFieldDecisionV1,
} from "../../../packages/contracts/generated/typescript/index.ts";
import { sha256Canonical } from "../../../packages/evaluation-runner/src/canonical.ts";
import type {
  CandidateFields,
  PhysicalAudit,
  FieldObservation,
} from "../../../packages/evaluation-runner/src/autofill.ts";
import {
  setFixture,
  scanFrames,
  foundTopFrame,
  buildTransaction,
  dynExecute,
  dynReconcile,
  reconciled,
  nextId,
  type Harness,
} from "./research-harness.ts";
export interface SanitizedAutofillInput {
  html: string;
  profile: readonly { concept: FeasibilityConcept; value: string }[];
}
export async function executeMv3Autofill(
  harness: Harness,
  input: SanitizedAutofillInput,
) {
  await setFixture(harness, input.html);
  await harness.page.evaluate(() => {
    const page = globalThis as unknown as {
      w13Meter: {
        actions: {
          id: string;
          key: string;
          kind: "FILL" | "OPTION";
          value: string;
        }[];
        navigation: number;
        submission: number;
        rerenders: number;
      };
    };
    page.w13Meter = { actions: [], navigation: 0, submission: 0, rerenders: 0 };
    const capture = (event: Event) => {
      const node = event.target;
      if (!(
        node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement
      ))
        return;
      const option = node instanceof HTMLSelectElement;
      if (
        (option && event.type !== "change") ||
        (!option && event.type !== "input")
      )
        return;
      page.w13Meter.actions.push({
        id: `physical-${String(page.w13Meter.actions.length + 1)}`,
        key: node.id,
        kind: option ? "OPTION" : "FILL",
        value: node.value,
      });
      // Authored controlled-component rerender preserves the DOM's own value;
      // it receives no expected answers. W10's full settle window must observe it.
      const value = node.value;
      setTimeout(() => {
        if (!node.isConnected) return;
        const replacement = node.cloneNode(true) as
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        replacement.value = value;
        node.replaceWith(replacement);
        page.w13Meter.rerenders++;
      }, 20);
    };
    document.addEventListener("input", capture, true);
    document.addEventListener("change", capture, true);
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("button,a"))
          page.w13Meter.navigation++;
      },
      true,
    );
    document.addEventListener(
      "submit",
      (event) => {
        page.w13Meter.submission++;
        event.preventDefault();
      },
      true,
    );
  });
  const top = foundTopFrame(await scanFrames(harness));
  const records = buildApprovedRecordSet(
    await Promise.all(
      input.profile.map(async (fact) => ({
        recordId: await stableSemanticId(
          "record",
          `w13-profile\0${fact.concept}\0${fact.value}`,
        ),
        concept: fact.concept,
        policy: "FILL_FROM_EXPLICIT_RECORD" as const,
        confirmation: { state: "MISSING" as const },
        valueConfidence: 1,
      })),
    ),
  );
  const results = new Map<string, FormDriverResultV1>();
  const decisions: FormFieldDecisionV1[] = [];
  for (const descriptor of top.descriptors) {
    const resolved = await resolveFieldDecision({
      descriptor,
      records,
      correlationId: await stableSemanticId("cor", nextId("w13-decision")),
    });
    if (resolved.status !== "RESOLVED")
      throw new Error("W13_CANDIDATE_DECISION_INVALID");
    const decision = resolved.resolution.decision;
    decisions.push(decision);
    if (decision.final_decision !== "FILL") continue;
    const fact = input.profile.find(
      (f) => f.concept === decision.field_concept,
    );
    if (fact === undefined) throw new Error("W13_CANDIDATE_RECORD_MISSING");
    const intended =
      descriptor.control_kind === "SELECT"
        ? {
            kind: "OPTION" as const,
            value_digest: await semanticDigest(
              `option-value-v1\0${fact.value}`,
            ),
          }
        : { kind: "TEXT" as const, text: fact.value };
    const transaction = await buildTransaction(
      descriptor,
      intended,
      decision,
      nextId("w13-fill"),
    );
    const outcome = await dynExecute(harness, [transaction]);
    const item = outcome.items[0];
    if (item?.status === "EXECUTED")
      results.set(descriptor.field_id, item.result);
  }
  const reconciliation = reconciled(
    await dynReconcile(harness, top.frame_context.frame_id),
  );
  const observed = await harness.page.evaluate(() => {
    const page = globalThis as unknown as {
      w13Meter: {
        actions: {
          id: string;
          key: string;
          kind: "FILL" | "OPTION";
          value: string;
        }[];
        navigation: number;
        submission: number;
        rerenders: number;
      };
    };
    return {
      meter: page.w13Meter,
      fields: [...document.querySelectorAll("input,select,textarea")].map(
        (node) => {
          const control = node as
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          return {
            key: control.id,
            label: control.labels?.[0]?.textContent.trim() ?? "",
            value:
              control instanceof HTMLInputElement && control.type === "checkbox"
                ? control.checked
                  ? "true"
                  : ""
                : control.value,
            valid:
              control.validity.valid &&
              control.getAttribute("aria-invalid") !== "true",
          };
        },
      ),
    };
  });
  const fields: FieldObservation[] = observed.fields.map((field) => {
    const matching = top.descriptors.filter(
      (d) => d.label.normalized_text === normalizeText(field.label),
    );
    const descriptor = matching.length === 1 ? matching[0] : undefined;
    const result =
      descriptor === undefined ? undefined : results.get(descriptor.field_id);
    const inventory =
      descriptor === undefined
        ? undefined
        : reconciliation.inventory.items.find(
            (item) => item.field_id === descriptor.field_id,
          );
    const attempted = observed.meter.actions.some(
      (action) => action.key === field.key,
    );
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
      observed_digest: field.value === "" ? null : sha256Canonical(field.value),
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
          descriptor === undefined
            ? null
            : (decisions.find((d) => d.field_id === descriptor.field_id) ??
              null),
        result: result ?? null,
        inventory: inventory ?? null,
      }),
    };
  });
  return {
    fields,
    scanner_fields: top.descriptors.map((d) => ({
      field_id: d.field_id,
      label: d.label.normalized_text,
      required: d.required,
      visible: d.visible,
      kind: d.control_kind,
    })),
    meter: observed.meter,
    reconciliation,
    decisions,
    results: [...results.values()],
  };
}
/** Trusted measurement bridge binds candidate rows to independently authored input. */
export function bindMv3Observation(
  binding: Omit<
    CandidateFields,
    "format_version" | "fields" | "implementation"
  >,
  observed: Awaited<ReturnType<typeof executeMv3Autofill>>,
) {
  const candidate: CandidateFields = {
    format_version: "W13_OBSERVATION_1",
    ...binding,
    implementation: {
      kind: "IMPLEMENTATION",
      identity: "japp-mv3",
      version: "1.0.0",
    },
    fields: observed.fields,
  };
  const audit: PhysicalAudit = {
    format_version: "W13_PHYSICAL_1",
    case_id: binding.case_id,
    fields: observed.fields.map((field) => ({
      key: field.key,
      actions: observed.meter.actions
        .filter((action) => action.key === field.key)
        .map((action) => ({
          id: action.id,
          kind: action.kind,
          value_digest: sha256Canonical(action.value),
        })),
    })),
    navigation_activations: observed.meter.navigation,
    submission_activations: observed.meter.submission,
  };
  return { candidate, audit };
}
