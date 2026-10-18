/** STRUCTURAL_TEST_ONLY: invented in-memory rows. Never paired-run evidence. */
import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { buildPairedWorksheet } from "./compare-paired.mjs";
import { canonicalSha } from "./campaign.mjs";
const STAMP = "STRUCTURAL_TEST_ONLY";
const surfaces = ["STRUCTURAL_TEST_ONLY_NATIVE_SURFACE"];
const audit = () => ({
  coverage: "COMPLETE_INSTALLED_NATIVE_SURFACES",
  source: "STRUCTURAL_TEST_ONLY_OBSERVER",
  realm: "ACTUAL_EXTENSION_CONTENT_SCRIPT",
  surfaces,
  witnesses: [],
  witnesses_digest: canonicalSha([]),
});
const expectation = (index) => ({
  key: "STRUCTURAL_TEST_ONLY_FIELD_" + index,
  concept:
    index === 3 ? "PHONE_NUMBER" : "STRUCTURAL_TEST_ONLY_CONCEPT_" + index,
  value: index === 3 ? "2025550100" : "STRUCTURAL_TEST_ONLY_VALUE_" + index,
  required: true,
});
function fixture() {
  const profile = [
    {
      concept: "STRUCTURAL_TEST_ONLY_FACT",
      value: "STRUCTURAL_TEST_ONLY_VALUE",
    },
  ];
  const cases = Array.from({ length: 4 }, (_, index) => ({
    case_id: "STRUCTURAL_TEST_ONLY_CASE_" + index,
    fixture_id: "STRUCTURAL_TEST_ONLY_FIXTURE_" + index,
    input_digest: canonicalSha({ stamp: STAMP, index }),
    oracle_digest: canonicalSha({ oracle: STAMP, index }),
    profile_digest: canonicalSha(profile),
    ordinary_expectations: Array.from({ length: 10 }, (_, field) =>
      expectation(field),
    ),
  }));
  const campaign = {
    evidence_kind: STAMP,
    lock_digest: canonicalSha({ stamp: STAMP }),
    bindings: {
      cases,
      native_observer: {
        helper_sha256: canonicalSha({ observer: STAMP }),
        source: "STRUCTURAL_TEST_ONLY_OBSERVER",
        realm: "ACTUAL_EXTENSION_CONTENT_SCRIPT",
        surfaces,
      },
      limitations: [
        "STRUCTURAL_TEST_ONLY: no product, browser, source campaign or observation was executed.",
      ],
    },
  };
  const nativeFields = () =>
    Array.from({ length: 18 }, (_, index) => ({
      key: "STRUCTURAL_TEST_ONLY_FIELD_" + index,
      value: index < 10 ? expectation(index).value : "",
      checked: null,
      valid: true,
      aria_invalid: "false",
    }));
  const physical = () => ({ events: [], navigation: [], submissions: 0 });
  const candidates = cases.map((bound) => ({
    path: "/STRUCTURAL_TEST_ONLY/" + bound.case_id + ".json",
    bytes: Buffer.from("STRUCTURAL_TEST_ONLY_INVENTED_ARTIFACT"),
    value: {
      evidence_kind: STAMP,
      format_version: "W14_PAIRED_OPTIONS_CANDIDATE_OBSERVATION_1",
      case_id: bound.case_id,
      input_digest: bound.input_digest,
      campaign_lock_digest: campaign.lock_digest,
      source_build_stable: true,
      native_observer_helper_digest:
        campaign.bindings.native_observer.helper_sha256,
      candidate_native_before: audit(),
      candidate_native_witness: audit(),
      final: nativeFields(),
      physical: physical(),
      unexpected_nonordinary_changes: [],
      comparison: bound.ordinary_expectations.map((expected) => ({
        key: expected.key,
        concept: expected.concept,
        expected_value: expected.value,
        candidate_value: expected.value,
        candidate_exact: true,
        phone_digits_equivalence_disclosure:
          expected.concept === "PHONE_NUMBER"
            ? { candidate: true }
            : "NOT_APPLICABLE",
        candidate_worksheet: { stamp: STAMP },
      })),
    },
  }));
  const legacy = {
    evidence_kind: STAMP,
    format_version: "W14_PAIRED_OPTIONS_LEGACY_OBSERVATION_1",
    campaign_lock_digest: campaign.lock_digest,
    complete: true,
    source_stability: true,
    native_observer_helper_digest:
      campaign.bindings.native_observer.helper_sha256,
    results: cases.map((bound) => ({
      evidence_kind: STAMP,
      case_id: bound.case_id,
      input_digest: bound.input_digest,
      status: "OBSERVED",
      profile_input: profile,
      initial: nativeFields(),
      fields: nativeFields(),
      native_before: audit(),
      native_witness: audit(),
      physical: physical(),
      unexpected_native_mutations: [],
    })),
  };
  return {
    campaign,
    candidates,
    legacy,
    legacyPath: "/STRUCTURAL_TEST_ONLY/legacy.json",
    legacyBytes: Buffer.from("STRUCTURAL_TEST_ONLY_INVENTED_LEGACY_ARTIFACT"),
    createdAt: "STRUCTURAL_TEST_ONLY_NOT_A_RUN_TIMESTAMP",
    structuralTestOnly: true,
  };
}
function changeCandidateValue(input, fieldIndex, value) {
  input.candidates[0].value.comparison[fieldIndex].candidate_value = value;
  input.candidates[0].value.final[fieldIndex].value = value;
}

test("STRUCTURAL_TEST_ONLY positive join recomputes counts and references actual legacy rows", () => {
  const input = fixture();
  input.legacy.results.reverse();
  const report = buildPairedWorksheet(input);
  assert.equal(report.evidence_kind, STAMP);
  assert.equal(
    report.format_version,
    "W14_PAIRED_OPTIONS_STRUCTURAL_TEST_WORKSHEET_1",
  );
  assert.deepEqual(report.totals, {
    candidate_exact: 40,
    legacy_exact: 40,
    ordinary: 40,
  });
  assert.deepEqual(
    report.cases.map((row) => row.declared_case_index),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    report.cases.map((row) => row.legacy_artifact.row),
    [3, 2, 1, 0],
  );
  assert.equal(report.acceptance, null);
});
test("STRUCTURAL_TEST_ONLY supplied exact booleans cannot inflate or suppress counts", () => {
  const input = fixture();
  changeCandidateValue(input, 0, "STRUCTURAL_TEST_ONLY_WRONG_VALUE");
  input.candidates[0].value.comparison[1].candidate_exact = false;
  const report = buildPairedWorksheet(input);
  assert.equal(report.totals.candidate_exact, 39);
  const fields = report.cases[0].fields;
  assert.equal(fields[0].candidate_exact, false);
  assert.equal(fields[1].candidate_exact, true);
  assert.equal(
    fields[0].accuracy_recomputation.supplied_candidate_exact_agrees,
    false,
  );
  assert.equal(
    fields[1].accuracy_recomputation.supplied_candidate_exact_agrees,
    false,
  );
});
test("STRUCTURAL_TEST_ONLY phone formatting equivalence remains separate from exact", () => {
  const input = fixture();
  changeCandidateValue(input, 3, "(202) 555-0100");
  const report = buildPairedWorksheet(input);
  const phone = report.cases[0].fields[3];
  assert.equal(report.totals.candidate_exact, 39);
  assert.equal(report.cases[0].digits_equivalent_counts.candidate, 10);
  assert.equal(phone.candidate_exact, false);
  assert.equal(phone.phone_digits_equivalence_disclosure.candidate, true);
  assert.equal(
    phone.manual_correction_review.candidate,
    "EXACT_FORMAT_DIFFERENCE_ONLY",
  );
});
test("STRUCTURAL_TEST_ONLY false phone equivalence claim cannot inflate counts", () => {
  const input = fixture();
  changeCandidateValue(input, 3, "9995550100");
  const report = buildPairedWorksheet(input);
  const phone = report.cases[0].fields[3];
  assert.equal(report.cases[0].digits_equivalent_counts.candidate, 9);
  assert.equal(phone.phone_digits_equivalence_disclosure.candidate, false);
  assert.equal(
    phone.accuracy_recomputation
      .supplied_candidate_phone_digits_equivalent_agrees,
    false,
  );
});
const negatives = [
  [
    "wrong candidate lock",
    (x) => {
      x.candidates[0].value.campaign_lock_digest =
        "STRUCTURAL_TEST_ONLY_WRONG_LOCK";
    },
    /CASE_BINDING_MISMATCH/,
  ],
  [
    "wrong legacy lock",
    (x) => {
      x.legacy.campaign_lock_digest = "STRUCTURAL_TEST_ONLY_WRONG_LOCK";
    },
    /FRESH_COMPLETE_PAIR_REQUIRED/,
  ],
  [
    "duplicate candidate case",
    (x) => {
      x.candidates[1].value.case_id = x.candidates[0].value.case_id;
    },
    /CASE_PAIR_MISSING_OR_AMBIGUOUS/,
  ],
  [
    "missing candidate artifact",
    (x) => {
      x.candidates.pop();
    },
    /FRESH_COMPLETE_PAIR_REQUIRED/,
  ],
  [
    "duplicate legacy case",
    (x) => {
      x.legacy.results[1].case_id = x.legacy.results[0].case_id;
    },
    /CASE_PAIR_MISSING_OR_AMBIGUOUS/,
  ],
  [
    "missing legacy row",
    (x) => {
      x.legacy.results.pop();
    },
    /FRESH_COMPLETE_PAIR_REQUIRED/,
  ],
  [
    "old candidate artifact",
    (x) => {
      x.candidates[0].value.format_version =
        "W14_FROZEN_LEGACY_CANDIDATE_OBSERVATION_1";
    },
    /CASE_BINDING_MISMATCH/,
  ],
  [
    "old legacy artifact",
    (x) => {
      x.legacy.format_version = "LEGACY_COMPONENT_CAPTURE_1";
    },
    /FRESH_COMPLETE_PAIR_REQUIRED/,
  ],
  [
    "candidate native value disagrees",
    (x) => {
      x.candidates[0].value.final[0].value =
        "STRUCTURAL_TEST_ONLY_DIFFERENT_NATIVE_VALUE";
    },
    /FIELD_JOIN_REFUSED/,
  ],
  [
    "missing native surface",
    (x) => {
      x.legacy.results[0].native_witness.surfaces = [];
    },
    /NATIVE_SCOPE_OR_INTEGRITY_REFUSED/,
  ],
];
for (const [name, mutate, reason] of negatives)
  test("STRUCTURAL_TEST_ONLY rejects " + name, () => {
    const input = fixture();
    mutate(input);
    assert.throws(() => buildPairedWorksheet(input), reason);
  });
test("STRUCTURAL_TEST_ONLY fixtures are rejected by actual default join mode", () => {
  const input = fixture();
  input.structuralTestOnly = false;
  assert.throws(
    () => buildPairedWorksheet(input),
    /STRUCTURAL_FIXTURES_ARE_NOT_RUN_EVIDENCE/,
  );
});
