/** Current W09/W10/W11 runtime; receives only the frozen HTML/profile input. */
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../../packages/form-engine/src/index.ts";
import {
  buildTransaction,
  dynExecute,
  dynReconcile,
  foundTopFrame,
  reconciled,
  scanFrames,
  type Harness,
} from "../support/research-harness.ts";
import type { SanitizedAutofillInput } from "../support/autofill-benchmark.ts";

/** Fixture and the literal legacy meter are installed by the observer beforehand. */
export async function executePairedOptionsPeer(
  harness: Harness,
  input: SanitizedAutofillInput,
  seed: string,
) {
  const top = foundTopFrame(await scanFrames(harness));
  const records = buildApprovedRecordSet(
    await Promise.all(
      input.profile.map(async (fact) => ({
        recordId: await stableSemanticId(
          "record",
          `w13-profile\0${fact.concept}\0${fact.value}`,
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
  const decisions = [];
  const results = [];
  for (const descriptor of top.descriptors) {
    const resolution = await resolveFieldDecision({
      descriptor,
      records,
      correlationId: await stableSemanticId(
        "cor",
        `w14-legacy-peer\0${seed}\0${descriptor.field_id}`,
      ),
    });
    if (resolution.status !== "RESOLVED")
      throw new Error("PAIRED_OPTIONS_POLICY_DESCRIPTOR_REFUSED");
    const decision = resolution.resolution.decision;
    decisions.push(decision);
    if (decision.final_decision !== "FILL") continue;
    const fact = input.profile.find(
      (item) => item.concept === decision.field_concept,
    );
    if (fact === undefined)
      throw new Error("PAIRED_OPTIONS_APPROVED_RECORD_MISSING");
    const option = resolution.resolution.optionResolution;
    if (descriptor.control_kind === "SELECT" && option?.status !== "RESOLVED")
      throw new Error("PAIRED_OPTIONS_OPTION_RESOLUTION_REFUSED");
    const intended =
      descriptor.control_kind === "SELECT" && option?.status === "RESOLVED"
        ? { kind: "OPTION" as const, value_digest: option.valueDigest }
        : { kind: "TEXT" as const, text: fact.value };
    const transaction = await buildTransaction(
      descriptor,
      intended,
      decision,
      `${seed}-${descriptor.field_id}`,
    );
    const outcome = await dynExecute(harness, [transaction]);
    results.push({ field_id: descriptor.field_id, intended, outcome });
  }
  const reconciliation = reconciled(
    await dynReconcile(harness, top.frame_context.frame_id),
  );
  return { scanner: top, decisions, results, reconciliation };
}
