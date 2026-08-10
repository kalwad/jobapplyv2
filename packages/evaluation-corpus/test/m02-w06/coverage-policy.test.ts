import { describe, expect, it } from "vitest";

import { computeCorpus, computeCoverage } from "../../src/corpus.ts";

describe("M02-W06 coverage and policy honesty", () => {
  const coverage = computeCoverage();
  const counts = coverage.raw_counts;
  const count = (name: string): number => {
    const value = counts[name];
    if (value === undefined) throw new Error(`missing coverage count ${name}`);
    return value;
  };

  it("reports all 617 top-level fixture records", () => {
    expect(
      count("profiles") +
        count("evidence_artifacts") +
        count("source_resumes") +
        count("jobs") +
        count("expected_requirements") +
        count("expected_supported_claims") +
        count("unsupported_gaps") +
        count("field_value_policies") +
        count("scenario_bundles") +
        count("question_cases") +
        count("answer_constraints") +
        count("answer_scenarios"),
    ).toBe(617);
  });

  it.each([
    ["profiles", 12],
    ["evidence_artifacts", 72],
    ["source_resumes", 12],
    ["jobs", 24],
    ["expected_requirements", 72],
    ["expected_supported_claims", 77],
    ["unsupported_gaps", 31],
    ["field_value_policies", 69],
    ["scenario_bundles", 36],
    ["scenario_evaluations", 108],
    ["question_cases", 144],
    ["question_clusters", 48],
    ["answer_constraints", 10],
    ["answer_scenarios", 58],
  ] as const)("reports raw %s = %i", (name, value) => {
    expect(counts[name]).toBe(value);
  });

  it("reports exact fixture collection bytes", () => {
    expect(counts.fixture_collection_bytes).toBe(865_045);
  });

  it("reports evidence category counts", () => {
    expect([
      counts.evidence_category_credential_record,
      counts.evidence_category_education_record,
      counts.evidence_category_employment_record,
      counts.evidence_category_project_record,
      counts.evidence_category_user_assertion,
    ]).toEqual([15, 12, 19, 14, 12]);
  });

  it("reports policy facts without relabeling them scored controls", () => {
    expect([
      counts.policy_personal_records,
      counts.policy_sensitive_records,
      counts.policy_consequential_records,
    ]).toEqual([45, 24, 57]);
    expect(counts.scored_controls).toBe(0);
    expect(counts.scored_control_families).toBe(0);
  });

  it("reports exact mock ATS raw coverage", () => {
    expect([
      counts.mock_ats_cases,
      counts.mock_ats_routes,
      counts.mock_ats_surface_tags,
      counts.mock_expected_transition_clauses,
    ]).toEqual([32, 16, 37, 67]);
  });

  it("distinguishes one tagged honeypot from zero scored honeypot controls", () => {
    expect(counts.mock_honeypot_tagged_cases).toBe(1);
    expect(counts.honeypot_scored_controls).toBe(0);
  });

  it("reports 34 finite baseline cases", () => {
    expect(counts.baseline_cases).toBe(34);
  });

  it("records the form-variant shortfall under W12", () => {
    expect(coverage.future_gate_a_targets[0]).toEqual({
      metric: "form_variants",
      current: 32,
      target: 200,
      shortfall: 168,
      owner: "M02-W12",
      state: "NOT_YET_APPLICABLE",
    });
    for (const metric of [
      "greenhouse_structural_variants",
      "lever_structural_variants",
      "ashby_structural_variants",
    ]) {
      expect(
        coverage.future_gate_a_targets.find(
          (target) => target.metric === metric,
        ),
      ).toMatchObject({
        current: 0,
        target: "REQUIRED",
        shortfall: "UNAVAILABLE",
        owner: "M02-W12",
      });
    }
  });

  it("records the 2500-control shortfall under W13", () => {
    expect(
      coverage.future_gate_a_targets.find(
        ({ metric }) => metric === "scored_controls",
      ),
    ).toMatchObject({
      current: 0,
      target: 2500,
      shortfall: 2500,
      owner: "M02-W13",
    });
  });

  it("records sensitive and honeypot shortfalls under W13", () => {
    expect(
      coverage.future_gate_a_targets
        .filter(({ metric }) => metric.includes("scored_controls"))
        .map(({ shortfall }) => shortfall),
    ).toEqual([2500, 100, 50]);
  });

  it("records public no-submit execution as W14 not-yet-applicable", () => {
    expect(
      coverage.future_gate_a_targets.find(
        ({ metric }) => metric === "public_no_submit_variants",
      ),
    ).toMatchObject({
      current: 0,
      target: 30,
      owner: "M02-W14",
      state: "NOT_YET_APPLICABLE",
    });
  });

  it("does not fabricate a hidden ratio", () => {
    expect(
      coverage.future_gate_a_targets.find(
        ({ metric }) => metric === "genuine_hidden_ratio",
      ),
    ).toMatchObject({ current: "UNAVAILABLE", shortfall: "UNAVAILABLE" });
  });

  it("records thresholds tolerances and ignored regions as not yet applicable", () => {
    expect(computeCorpus().manifest.threshold_policy).toEqual({
      frozen_existing_truth: true,
      field_scoring_thresholds: "NOT_YET_APPLICABLE",
      tolerances: "NOT_YET_APPLICABLE",
      ignored_regions: "NOT_YET_APPLICABLE",
      future_owner: "M02-W13",
    });
  });

  it("requires full-version corrections and evidence reruns", () => {
    expect(computeCorpus().manifest.change_policy).toMatchObject({
      versioning: "FULL_MAJOR_VERSION_ONLY",
      same_version_rewrite: "FORBIDDEN",
      correction_record_required: true,
      invalidation_and_rerun_required: true,
    });
  });
});
