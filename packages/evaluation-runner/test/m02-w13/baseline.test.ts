import { sha256Canonical } from "../../src/canonical.ts";
import { expect, it } from "vitest";
import { AUTOFILL_LEGACY_OBSERVATION_VERSION } from "../../src/autofill.ts";
import {
  loadCommittedLegacyObservations,
  LEGACY_OBSERVATION_ALGORITHM_VERSION,
} from "@japp/evaluation-baselines";
import { compareAutofillBaseline } from "../support/autofill-baseline.ts";
import { fixture } from "./support.ts";
it.each(["CAREERPULSE", "LEGACY_JOBAPPLY"] as const)(
  "W04 %s unavailable baseline is truthful and isolated",
  (system) => {
    const f = fixture();
    const input = {
      legacy_file: loadCommittedLegacyObservations(),
      system,
      sanitized_input: { profile: "synthetic" },
      benchmark_case: f.benchmarkCase,
      oracle: f.oracle,
    };
    const result = compareAutofillBaseline(input);
    expect(result.authority).toBe("NONE");
    expect(result.status).not.toBe("CAPTURED");
    expect(result.result).toBeNull();
    expect(() =>
      compareAutofillBaseline({
        ...input,
        observed: { candidate: f.candidate, audit: f.audit },
      }),
    ).toThrow("W13_BASELINE_UNAVAILABLE_OUTPUT");
    expect(() =>
      compareAutofillBaseline({
        ...input,
        sanitized_input: { profile: "different" },
      }),
    ).toThrow("W13_BASELINE_INPUT");
  },
);

it("captured synthetic baseline uses identical sanitized input and scorer with separate authority", () => {
  const f = fixture();
  const candidate = {
    ...f.candidate,
    implementation: {
      kind: "BASELINE" as const,
      identity: "baseline_legacy_behavior_observation_v1",
      version: "1.0.2",
    },
  };
  const observed = { candidate, audit: f.audit };
  const input = { profile: "synthetic" };
  const file = structuredClone(loadCommittedLegacyObservations());
  const record = file.records.find((r) => r.system === "LEGACY_JOBAPPLY");
  if (record === undefined) throw new Error("synthetic record missing");
  Object.assign(record, {
    observation_status: "CAPTURED",
    environment: "Temporary isolated synthetic stand-in; no legacy execution.",
    procedure: [
      "Manually recorded a synthetic stand-in field observation in the isolated test environment.",
    ],
    fixture_inputs: [
      {
        fixture_id: "profile_00000000000000000000000001",
        content_digest: sha256Canonical(input),
      },
    ],
    observed_output_digest: sha256Canonical(observed),
    structured_observations: [
      "The synthetic first name field persisted and was accepted.",
    ],
    safety_observations: [
      "No sensitive field, navigation or submission action occurred.",
    ],
    failure_or_unavailability_reason: null,
    comparable: true,
  });
  const args = {
    legacy_file: file,
    system: "LEGACY_JOBAPPLY" as const,
    sanitized_input: input,
    benchmark_case: f.benchmarkCase,
    oracle: f.oracle,
    observed,
  };
  const result = compareAutofillBaseline(args);
  expect(result.authority).toBe("NONE");
  expect(result.result?.score.counts.correct_fills).toBe(1);
  expect(() =>
    compareAutofillBaseline({
      ...args,
      observed: { candidate: { ...candidate, fields: [] }, audit: f.audit },
    }),
  ).toThrow("W13_BASELINE_BINDING");
  expect(() =>
    compareAutofillBaseline({
      ...args,
      observed: { candidate: f.candidate, audit: f.audit },
    }),
  ).toThrow("W13_BASELINE_BINDING");
});

it("baseline contract version remains pinned to W04", () => {
  expect(AUTOFILL_LEGACY_OBSERVATION_VERSION).toBe(
    LEGACY_OBSERVATION_ALGORITHM_VERSION,
  );
});
