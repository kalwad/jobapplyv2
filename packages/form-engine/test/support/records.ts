// Approved synthetic record set built from the frozen M02 fixture corpus
// (@japp/test-fixtures). No second fixture universe: consequential-concept
// records reuse the committed field-value policies verbatim, and ordinary
// contact records reference the committed synthetic profile facts through
// deterministic stable IDs. No real user data exists anywhere here.
import { loadFixtureCorpus } from "@japp/test-fixtures";

import {
  buildApprovedRecordSet,
  type ApprovedRecordSet,
  type ApprovedSyntheticRecord,
} from "../../src/approved-records.ts";
import {
  isFeasibilityConcept,
  isFeasibilityValuePolicy,
  type FeasibilityConcept,
} from "../../src/ontology.ts";
import { stableSemanticId } from "../../src/semantic-digest.ts";

export const FIXTURE_PROFILE_ID = "profile_00000000000000000000000001";

const ORDINARY_CONCEPTS: readonly FeasibilityConcept[] = [
  "FIRST_NAME",
  "LAST_NAME",
  "FULL_NAME",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "ADDRESS_CITY",
  "ADDRESS_COUNTRY",
  "WEBSITE_URL",
  "WORK_MODE_PREFERENCE",
];

const ENUMERABLE_VALUE_TOKENS: Partial<Record<FeasibilityConcept, string>> = {
  WORK_MODE_PREFERENCE: "REMOTE",
};

export interface FixtureRecordOverrides {
  readonly confirmations?: Partial<
    Record<FeasibilityConcept, ApprovedSyntheticRecord["confirmation"]>
  >;
}

/**
 * Build the approved record set for the first frozen synthetic profile.
 * Field-value-policy concepts carry their committed policy and recorded
 * value token; ordinary contact concepts get deterministic record IDs
 * anchored to the committed profile fact they reference.
 */
export async function loadApprovedRecords(
  overrides: FixtureRecordOverrides = {},
): Promise<ApprovedRecordSet> {
  const corpus = loadFixtureCorpus();
  const profile = corpus.profiles.find(
    (entry) => entry.id === FIXTURE_PROFILE_ID,
  );
  if (profile === undefined) {
    throw new Error(`fixture profile ${FIXTURE_PROFILE_ID} is missing`);
  }
  const records: ApprovedSyntheticRecord[] = [];
  for (const policy of corpus.fieldValuePolicies) {
    if (policy.profile_ref !== FIXTURE_PROFILE_ID) {
      continue;
    }
    const concept = policy.field_concept;
    if (!isFeasibilityConcept(concept)) {
      continue;
    }
    if (!isFeasibilityValuePolicy(policy.policy)) {
      throw new Error(`fixture policy ${policy.id} has unknown policy kind`);
    }
    const recordId =
      policy.source_field_record_id ??
      (await stableSemanticId(
        "fieldrecord",
        `w09-fixture-policy\0${policy.id}`,
      ));
    records.push({
      recordId,
      concept,
      ...(policy.recorded_value === undefined
        ? {}
        : { valueToken: policy.recorded_value }),
      policy: policy.policy,
      confirmation: overrides.confirmations?.[concept] ?? { state: "MISSING" },
      valueConfidence: 1,
    });
  }
  for (const concept of ORDINARY_CONCEPTS) {
    const token = ENUMERABLE_VALUE_TOKENS[concept];
    records.push({
      recordId: await stableSemanticId(
        "fieldrecord",
        `w09-fixture-contact\0${profile.id}\0${concept}`,
      ),
      concept,
      ...(token === undefined ? {} : { valueToken: token }),
      policy: "FILL_FROM_EXPLICIT_RECORD",
      confirmation: overrides.confirmations?.[concept] ?? { state: "MISSING" },
      valueConfidence: 1,
    });
  }
  return buildApprovedRecordSet(records);
}

export async function testCorrelationId(): Promise<string> {
  return stableSemanticId("cor", "w09-test-correlation");
}
