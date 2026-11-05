/** Mounted W06 candidate: real W08 -> W09 -> W10/W11; no oracle or DOM injection. */
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
  type FeasibilityConcept,
} from "../../../packages/form-engine/src/index.ts";
import {
  buildTransaction,
  dynExecute,
  dynReconcile,
  nextId,
  scanFrames,
  runtimeMessage,
  type Harness,
} from "./research-harness.ts";
import {
  buildReresolveTabRequest,
  parseReresolveTabResult,
} from "../../../apps/extension/src/scanner-protocol.ts";

export interface MountedContactFact {
  readonly concept: FeasibilityConcept;
  readonly value: string;
  readonly valueToken?: string;
}

export async function executeMountedContact(
  harness: Harness,
  facts: readonly MountedContactFact[],
) {
  const started = performance.now();
  const records = buildApprovedRecordSet(
    await Promise.all(
      facts.map(async (fact) => ({
        recordId: await stableSemanticId(
          "record",
          `w14-mounted-explicit\0${fact.concept}\0${fact.value}`,
        ),
        concept: fact.concept,
        ...(fact.valueToken === undefined
          ? {}
          : { valueToken: fact.valueToken }),
        policy: "FILL_FROM_EXPLICIT_RECORD" as const,
        confirmation: { state: "MISSING" as const },
        valueConfidence: 1,
      })),
    ),
  );
  const frames = await scanFrames(harness);
  const frameResults = [];
  for (const frame of frames) {
    const decisions = [];
    const outcomes = [];
    const localRefusals = [];
    if (frame.root_status === "FOUND") {
      for (const initialDescriptor of frame.descriptors) {
        // Earlier fills can change another field's validation description.
        // Refresh only this accepted W08 target through its current index;
        // neither an initial batch descriptor nor an observation ordinal is
        // fresh W09 authority. Missing/duplicate/changed documents refuse.
        const refreshed = parseReresolveTabResult(
          await runtimeMessage(
            harness.controller,
            buildReresolveTabRequest(
              nextId("w14-mounted-current"),
              harness.tabId,
              initialDescriptor.address,
            ),
          ),
        );
        const descriptor =
          refreshed?.resolution.status === "RESOLVED"
            ? refreshed.resolution.descriptor
            : undefined;
        if (
          descriptor?.field_id !== initialDescriptor.field_id ||
          descriptor.address.session_id !== frame.frame_context.session_id ||
          descriptor.address.frame_id !== frame.frame_context.frame_id ||
          descriptor.address.document_id !== frame.frame_context.document_id
        ) {
          localRefusals.push({
            field_id: initialDescriptor.field_id,
            reason: "W08_CURRENT_TARGET_NOT_UNIQUE",
          });
          continue;
        }
        const resolved = await resolveFieldDecision({
          descriptor,
          records,
          correlationId: await stableSemanticId(
            "cor",
            nextId("w14-mounted-decision"),
          ),
        });
        decisions.push({ field_id: descriptor.field_id, descriptor, resolved });
        if (resolved.status !== "RESOLVED") {
          localRefusals.push({
            field_id: descriptor.field_id,
            reason: "W09_INVALID_RESULT",
          });
          continue;
        }
        const decision = resolved.resolution.decision;
        if (decision.final_decision !== "FILL") continue;
        const fact = facts.find(
          (item) => item.concept === decision.field_concept,
        );
        if (fact === undefined) {
          localRefusals.push({
            field_id: descriptor.field_id,
            reason: "NO_EXPLICIT_CONTACT_FACT",
          });
          continue;
        }
        const choice = ["SELECT", "RADIO_GROUP", "COMBOBOX"].includes(
          descriptor.control_kind,
        );
        const option = resolved.resolution.optionResolution;
        if (choice && option?.status !== "RESOLVED") {
          localRefusals.push({
            field_id: descriptor.field_id,
            reason: "OPTION_NOT_EXACTLY_RESOLVED",
          });
          continue;
        }
        // Contact facts authorize TEXT or an exact semantic choice only.
        // DATE/CHECKED/FILE/repeater and unrelated widgets remain unclaimed.
        if (!choice && descriptor.control_kind !== "TEXT") {
          localRefusals.push({
            field_id: descriptor.field_id,
            reason: "NON_CONTACT_DRIVER_NOT_EXERCISED",
          });
          continue;
        }
        const intended =
          choice && option?.status === "RESOLVED"
            ? { kind: "OPTION" as const, value_digest: option.valueDigest }
            : { kind: "TEXT" as const, text: fact.value };
        // A longer explicit settle budget observes the real fixture's
        // controlled runtime; no synthetic replacement is installed.
        const transaction = {
          ...(await buildTransaction(
            descriptor,
            intended,
            decision,
            nextId("w14-mounted-fill"),
          )),
          settle: { budget_ms: 125 },
        };
        const outcome = await dynExecute(harness, [transaction]);
        outcomes.push({ field_id: descriptor.field_id, outcome });
      }
    }
    const reconciliation = await dynReconcile(
      harness,
      frame.frame_context.frame_id,
    );
    frameResults.push({
      scan: frame,
      decisions,
      outcomes,
      localRefusals,
      reconciliation,
    });
  }
  return {
    format_version: "W14_MOUNTED_CONTACT_OBSERVATION_1",
    authority: "NONE",
    scan_fill_duration_ms: performance.now() - started,
    frameResults,
    limitations: [
      "Mounted page only; no body replacement or synthetic rerender handler.",
      "Contact facts only; non-contact drivers and W03 scenario transitions are not implied.",
      "No navigation, submit, challenge resolution, credentials or consent interaction.",
    ],
  };
}
