/** W04 observation bridge. No legacy execution, selectors, or product authority. */
import {
  validateLegacyObservationFile,
  LEGACY_OBSERVATION_ALGORITHM_VERSION,
} from "@japp/evaluation-baselines";
import { sha256Canonical } from "../../src/canonical.ts";
import { freezeOracle, isolateBaseline } from "../../src/autofill.ts";
export function compareAutofillBaseline(input: {
  legacy_file: unknown;
  system: "CAREERPULSE" | "LEGACY_JOBAPPLY";
  sanitized_input: unknown;
  benchmark_case: unknown;
  oracle: unknown;
  observed?: { candidate: unknown; audit: unknown };
}) {
  const records = validateLegacyObservationFile(input.legacy_file).records;
  const matches = records.filter((record) => record.system === input.system);
  if (matches.length !== 1) throw new Error("W13_BASELINE_IDENTITY");
  const record = matches[0];
  if (record === undefined) throw new Error("W13_BASELINE_IDENTITY");
  const oracle = freezeOracle(input.oracle);
  const inputDigest = sha256Canonical(input.sanitized_input);
  if (inputDigest !== oracle.profile_digest)
    throw new Error("W13_BASELINE_INPUT");
  const identity = {
    identity: "baseline_legacy_behavior_observation_v1",
    version: LEGACY_OBSERVATION_ALGORITHM_VERSION,
  };
  if (record.observation_status !== "CAPTURED") {
    if (input.observed !== undefined)
      throw new Error("W13_BASELINE_UNAVAILABLE_OUTPUT");
    return {
      format_version: "W13_BASELINE_COMPARISON_1",
      authority: "NONE",
      identity,
      system: input.system,
      status: record.observation_status,
      input_digest: inputDigest,
      record_digest: sha256Canonical(record),
      result: null,
    };
  }
  if (
    input.observed === undefined ||
    record.observed_output_digest !== sha256Canonical(input.observed) ||
    !record.fixture_inputs.some((f) => f.content_digest === inputDigest) ||
    !record.comparable
  )
    throw new Error("W13_BASELINE_BINDING");
  return {
    format_version: "W13_BASELINE_COMPARISON_1",
    authority: "NONE",
    identity,
    system: input.system,
    status: "CAPTURED",
    input_digest: inputDigest,
    record_digest: sha256Canonical(record),
    result: isolateBaseline(
      input.benchmark_case,
      oracle,
      input.observed.candidate,
      input.observed.audit,
      identity,
    ),
  };
}
