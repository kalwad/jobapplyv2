/** Offline worksheet only: never launches a browser or calls either product. */
import process from "node:process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCampaign,
  canonicalSha,
  sha,
  requireNativeAudit,
} from "./campaign.mjs";

const STRUCTURAL = "STRUCTURAL_TEST_ONLY";
const digits = (value) => value.replaceAll(/[^0-9]/g, "");
const correction = (value, expected, phone) =>
  value === expected
    ? "NONE_FOR_EXACT_VALUE"
    : phone && digits(value) === digits(expected)
      ? "EXACT_FORMAT_DIFFERENCE_ONLY"
      : "VALUE_CORRECTION_REQUIRED_FOR_EXACT_EXPECTATION";

/**
 * Pure join. Structural mode is only for stamped offline test data and emits
 * a distinct format; the actual CLI never enables it. Supplied accuracy flags
 * are consistency claims only. Counts always use independently recomputed values.
 */
export function buildPairedWorksheet({
  campaign,
  candidates,
  legacy,
  legacyPath,
  legacyBytes,
  createdAt,
  structuralTestOnly = false,
}) {
  const sources = [campaign, legacy, ...candidates.map((item) => item.value)];
  if (structuralTestOnly) {
    if (!sources.every((item) => item.evidence_kind === STRUCTURAL))
      throw new Error("PAIRED_OPTIONS_STRUCTURAL_FIXTURE_STAMP_REQUIRED");
  } else if (sources.some((item) => item.evidence_kind === STRUCTURAL)) {
    throw new Error("PAIRED_OPTIONS_STRUCTURAL_FIXTURES_ARE_NOT_RUN_EVIDENCE");
  }
  if (
    !Array.isArray(campaign.bindings.cases) ||
    campaign.bindings.cases.length !== 4 ||
    legacy.format_version !== "W14_PAIRED_OPTIONS_LEGACY_OBSERVATION_1" ||
    legacy.campaign_lock_digest !== campaign.lock_digest ||
    legacy.complete !== true ||
    legacy.source_stability !== true ||
    !Array.isArray(legacy.results) ||
    legacy.results.length !== 4 ||
    candidates.length !== 4
  )
    throw new Error("PAIRED_OPTIONS_FRESH_COMPLETE_PAIR_REQUIRED");
  if (new Set(campaign.bindings.cases.map((item) => item.case_id)).size !== 4)
    throw new Error("PAIRED_OPTIONS_DECLARED_CASES_MISSING_OR_AMBIGUOUS");
  if (
    legacy.native_observer_helper_digest !==
    campaign.bindings.native_observer.helper_sha256
  )
    throw new Error("PAIRED_OPTIONS_SHARED_NATIVE_OBSERVER_REQUIRED");
  const cases = campaign.bindings.cases.map((bound, index) => {
    const candidateMatches = candidates.filter(
      (item) => item.value.case_id === bound.case_id,
    );
    const legacyMatches = legacy.results.filter(
      (item) => item.case_id === bound.case_id,
    );
    if (candidateMatches.length !== 1 || legacyMatches.length !== 1)
      throw new Error("PAIRED_OPTIONS_CASE_PAIR_MISSING_OR_AMBIGUOUS");
    const candidate = candidateMatches[0];
    const baseline = legacyMatches[0];
    if (
      candidate.value.format_version !==
        "W14_PAIRED_OPTIONS_CANDIDATE_OBSERVATION_1" ||
      candidate.value.input_digest !== bound.input_digest ||
      candidate.value.campaign_lock_digest !== campaign.lock_digest ||
      candidate.value.source_build_stable !== true ||
      baseline.input_digest !== bound.input_digest ||
      baseline.status !== "OBSERVED" ||
      canonicalSha(baseline.profile_input) !== bound.profile_digest ||
      !Array.isArray(candidate.value.final) ||
      candidate.value.final.length !== 18 ||
      !Array.isArray(baseline.fields) ||
      baseline.fields.length !== 18 ||
      !Array.isArray(baseline.initial) ||
      baseline.initial.length !== 18 ||
      !Array.isArray(candidate.value.comparison) ||
      candidate.value.comparison.length !== bound.ordinary_expectations.length
    )
      throw new Error("PAIRED_OPTIONS_CASE_BINDING_MISMATCH");
    if (
      candidate.value.native_observer_helper_digest !==
      campaign.bindings.native_observer.helper_sha256
    )
      throw new Error("PAIRED_OPTIONS_SHARED_NATIVE_OBSERVER_REQUIRED");
    requireNativeAudit(candidate.value.candidate_native_before, campaign);
    requireNativeAudit(candidate.value.candidate_native_witness, campaign);
    requireNativeAudit(baseline.native_before, campaign);
    requireNativeAudit(baseline.native_witness, campaign);
    const fields = bound.ordinary_expectations.map((expected) => {
      const candidateFields = candidate.value.comparison.filter(
        (item) =>
          item.key === expected.key && item.concept === expected.concept,
      );
      const candidateNativeFields = candidate.value.final.filter(
        (item) => item.key === expected.key,
      );
      const legacyFields = baseline.fields.filter(
        (item) => item.key === expected.key,
      );
      if (
        candidateFields.length !== 1 ||
        candidateNativeFields.length !== 1 ||
        legacyFields.length !== 1 ||
        candidateFields[0].expected_value !== expected.value ||
        typeof candidateFields[0].candidate_value !== "string" ||
        typeof legacyFields[0].value !== "string" ||
        candidateNativeFields[0].value !== candidateFields[0].candidate_value
      )
        throw new Error("PAIRED_OPTIONS_FIELD_JOIN_REFUSED");
      const cand = candidateFields[0];
      const old = legacyFields[0];
      const candidateExact = cand.candidate_value === expected.value;
      const legacyExact = old.value === expected.value;
      const phone = expected.concept === "PHONE_NUMBER";
      const candidateDigitsEquivalent =
        phone && digits(cand.candidate_value) === digits(expected.value);
      const legacyDigitsEquivalent =
        phone && digits(old.value) === digits(expected.value);
      const suppliedPhone = cand.phone_digits_equivalence_disclosure;
      return {
        ...cand,
        candidate_exact: candidateExact,
        legacy_value: old.value,
        legacy_exact: legacyExact,
        accuracy_recomputation: {
          basis: "OBSERVED_STRING_VS_FROZEN_EXPECTED_VALUE",
          candidate_final_native_value_agrees: true,
          supplied_candidate_exact:
            typeof cand.candidate_exact === "boolean"
              ? cand.candidate_exact
              : "UNOBSERVED",
          supplied_candidate_exact_agrees:
            cand.candidate_exact === candidateExact,
          supplied_candidate_phone_digits_equivalent:
            phone && typeof suppliedPhone?.candidate === "boolean"
              ? suppliedPhone.candidate
              : "NOT_APPLICABLE_OR_UNOBSERVED",
          supplied_candidate_phone_digits_equivalent_agrees: phone
            ? suppliedPhone?.candidate === candidateDigitsEquivalent
            : "NOT_APPLICABLE",
        },
        phone_digits_equivalence_disclosure: phone
          ? {
              method: "ASCII_DIGITS_ONLY_SEPARATE_FROM_EXACT_MATCH",
              candidate: candidateDigitsEquivalent,
              legacy: legacyDigitsEquivalent,
              changes_exact_metric: false,
              site_acceptance_inference: "NONE",
            }
          : "NOT_APPLICABLE",
        manual_correction_review: {
          scope: "FINAL_VALUE_VS_FROZEN_EXPECTATION_ONLY_NOT_SITE_ACCEPTANCE",
          candidate: correction(cand.candidate_value, expected.value, phone),
          legacy: correction(old.value, expected.value, phone),
        },
        legacy_worksheet: {
          final_native: old,
          immediate_event_witness: {
            scope: "EVENT_WITNESS_ONLY_NOT_NATIVE_IMMEDIATE_OBSERVATION",
            events: baseline.physical.events.filter(
              (event) => event.key === expected.key,
            ),
          },
          intended: "UNOBSERVED_LEGACY_INTERFACE",
          site_acceptance: "UNOBSERVED",
          unresolved_report: "UNOBSERVED_LEGACY_INTERFACE",
          native_validity_implies_site_acceptance: false,
        },
      };
    });
    const ordinary = new Set(
      bound.ordinary_expectations.map((item) => item.key),
    );
    const unexpected = baseline.fields
      .filter((field) => !ordinary.has(field.key))
      .filter((field) => {
        const before = baseline.initial.filter(
          (item) => item.key === field.key,
        );
        return (
          before.length !== 1 ||
          before[0].value !== field.value ||
          before[0].checked !== field.checked
        );
      });
    return {
      declared_case_index: index,
      case_id: bound.case_id,
      fixture_id: bound.fixture_id,
      input_digest: bound.input_digest,
      oracle_digest: bound.oracle_digest,
      candidate_artifact: {
        path: candidate.path,
        sha256: sha(candidate.bytes),
      },
      legacy_artifact: {
        path: legacyPath,
        sha256: sha(legacyBytes),
        row: legacy.results.indexOf(baseline),
      },
      fields,
      exact_value_counts: {
        candidate: fields.filter((field) => field.candidate_exact).length,
        legacy: fields.filter((field) => field.legacy_exact).length,
        ordinary: fields.length,
      },
      digits_equivalent_counts: {
        candidate: fields.filter(
          (field) =>
            field.candidate_exact ||
            (field.concept === "PHONE_NUMBER" &&
              field.phone_digits_equivalence_disclosure.candidate === true),
        ).length,
        legacy: fields.filter(
          (field) =>
            field.legacy_exact ||
            (field.concept === "PHONE_NUMBER" &&
              field.phone_digits_equivalence_disclosure.legacy === true),
        ).length,
        ordinary: fields.length,
      },
      native_observer_scope: campaign.bindings.native_observer,
      candidate_native_witness: candidate.value.candidate_native_witness,
      legacy_native_witness: baseline.native_witness,
      legacy_unexpected_native_mutations: baseline.unexpected_native_mutations,
      legacy_unexpected_nonordinary_final_changes: unexpected,
      legacy_navigation_event_witnesses: baseline.physical.navigation,
      legacy_submission_event_witness_count: baseline.physical.submissions,
      candidate_navigation_event_witnesses: candidate.value.physical.navigation,
      candidate_submission_event_witness_count:
        candidate.value.physical.submissions,
      candidate_unexpected_nonordinary_final_changes:
        candidate.value.unexpected_nonordinary_changes,
    };
  });
  return {
    format_version: structuralTestOnly
      ? "W14_PAIRED_OPTIONS_STRUCTURAL_TEST_WORKSHEET_1"
      : "W14_PAIRED_OPTIONS_REVIEW_WORKSHEET_1",
    evidence_kind: structuralTestOnly ? STRUCTURAL : "PAIRED_RUN_REVIEW_ONLY",
    authority: "NONE",
    gate_pass: false,
    acceptance: null,
    campaign_lock_digest: campaign.lock_digest,
    created_at: createdAt,
    cases,
    totals: {
      candidate_exact: cases.reduce(
        (sum, row) => sum + row.exact_value_counts.candidate,
        0,
      ),
      legacy_exact: cases.reduce(
        (sum, row) => sum + row.exact_value_counts.legacy,
        0,
      ),
      ordinary: cases.reduce((sum, row) => sum + row.fields.length, 0),
    },
    limitations: campaign.bindings.limitations,
  };
}

function main() {
  const [candidateDirectory, legacyPath, outputPath] = process.argv.slice(2);
  if (
    process.argv.length !== 5 ||
    ![candidateDirectory, legacyPath, outputPath].every(
      (path) => typeof path === "string" && isAbsolute(path),
    )
  )
    throw new Error("PAIRED_OPTIONS_THREE_ABSOLUTE_PATHS_REQUIRED");
  // Actual CLI always validates the externally reviewed lock and every frozen
  // campaign file. Importing the pure join performs no filesystem operation.
  const campaign = loadCampaign();
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(directory, entry.name))
        : entry.isFile() && entry.name === "paired-options-candidate.json"
          ? [join(directory, entry.name)]
          : [],
    );
  const candidates = walk(candidateDirectory).map((path) => {
    const bytes = readFileSync(path);
    return { path, bytes, value: JSON.parse(bytes.toString("utf8")) };
  });
  const legacyBytes = readFileSync(legacyPath);
  const report = buildPairedWorksheet({
    campaign,
    candidates,
    legacy: JSON.parse(legacyBytes.toString("utf8")),
    legacyPath,
    legacyBytes,
    createdAt: new Date().toISOString(),
  });
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  globalThis.console.log(
    JSON.stringify({
      output: outputPath,
      totals: report.totals,
      campaign_lock_digest: campaign.lock_digest,
    }),
  );
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
