import type { FormFieldDescriptorV1 } from "../../../packages/contracts/generated/typescript/index.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../../packages/form-engine/src/index.ts";
import type { DriverIntendedValue } from "../../../apps/extension/src/driver-protocol.ts";
import { buildTransaction } from "./research-harness.ts";

/** Actual W09 decision resolver, using synthetic approved FIRST_NAME policy.
 * Test fixture values are user-record stand-ins, never page-derived answers. */
export async function approvedTransaction(
  descriptor: FormFieldDescriptorV1,
  seed: string,
  intended: DriverIntendedValue = { kind: "TEXT", text: "Synthetic W12" },
) {
  const result = await resolveFieldDecision({
    descriptor,
    records: buildApprovedRecordSet([
      {
        recordId: await stableSemanticId("record", "w12-synthetic-first-name"),
        concept: "FIRST_NAME",
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]),
    correlationId: await stableSemanticId("cor", seed),
  });
  if (result.status !== "RESOLVED")
    throw new Error("W09 rejected scanned descriptor");
  return buildTransaction(
    descriptor,
    intended,
    result.resolution.decision,
    seed,
  );
}
