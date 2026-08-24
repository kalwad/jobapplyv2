// M02-W09 feasibility value-source boundary (spec §18 of the package
// contract; §7.6 policies).
//
// W09 does NOT implement M06 production profile storage. The only value
// source it understands is an APPROVED SYNTHETIC RECORD drawn from the
// frozen M02 fixture infrastructure. Concept classification and value
// sourcing stay separate: a record can make a decision eligible for FILL,
// but no record — and no page text — may ever change what a field means.
import type { CommonStableIdV1StableId } from "@japp/contracts/generated";

import type { FeasibilityConcept, FeasibilityValuePolicy } from "./ontology.ts";

export type RecordConfirmationState =
  "VALID" | "MISSING" | "EXPIRED" | "REVOKED";

export interface ApprovedRecordConfirmation {
  readonly state: RecordConfirmationState;
  /** Present exactly when state is VALID. */
  readonly confirmationRef?: CommonStableIdV1StableId;
}

export interface ApprovedSyntheticRecord {
  /** Stable identifier of the approved fixture record (value_source_ref). */
  readonly recordId: CommonStableIdV1StableId;
  readonly concept: FeasibilityConcept;
  /**
   * Canonical semantic value token for enumerable concepts (for example
   * "AUTHORIZED"); omitted for free-text concepts, whose decisions carry
   * only the record reference, never a value.
   */
  readonly valueToken?: string;
  /** Reviewed per-record policy; combined with the catalog floor. */
  readonly policy: FeasibilityValuePolicy;
  readonly confirmation: ApprovedRecordConfirmation;
  /** Producer confidence that the record supports this concept's value. */
  readonly valueConfidence: number;
}

export type ApprovedRecordSet = ReadonlyMap<
  FeasibilityConcept,
  ApprovedSyntheticRecord
>;

export function buildApprovedRecordSet(
  records: readonly ApprovedSyntheticRecord[],
): ApprovedRecordSet {
  const map = new Map<FeasibilityConcept, ApprovedSyntheticRecord>();
  for (const record of records) {
    if (map.has(record.concept)) {
      throw new Error(
        `duplicate approved record for concept ${record.concept}`,
      );
    }
    if (record.valueConfidence < 0 || record.valueConfidence > 1) {
      throw new Error(
        `approved record ${record.recordId} has out-of-range confidence`,
      );
    }
    if (
      (record.confirmation.state === "VALID") !==
      (record.confirmation.confirmationRef !== undefined)
    ) {
      throw new Error(
        `approved record ${record.recordId} confirmation ref must accompany VALID exactly`,
      );
    }
    map.set(record.concept, record);
  }
  return map;
}
