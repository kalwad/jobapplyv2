/**
 * W14 initial-state preservation supplement over the frozen W13 scorer.
 * Evaluation only: this artifact grants no critical-gate authority.
 *
 * Freeze the expected initial-state artifact before candidate execution. The
 * actual initial snapshot must observe the installed page before candidate
 * work; parsing fixture HTML alone is not an actual-page observation.
 */
import {
  freezeOracle,
  scoreAutofill,
  type AutofillOracle,
  type AutofillScore,
  type CandidateFields,
  type PhysicalAudit,
} from "./autofill.ts";
import {
  isContentDigest,
  sha256Canonical,
  type ContentDigest,
} from "./canonical.ts";
import type { BenchmarkCaseV1 } from "./model.ts";

export const W14_PRESERVATION_SCORER_VERSION = "1.0.0";
export const W14_INITIAL_STATE_SCHEMA_REF =
  "urn:japp:schema:evaluation-artifact:w14-initial-state-oracle:v1";
export const W14_STATE_OBSERVATION_SCHEMA_REF =
  "urn:japp:schema:evaluation-artifact:w14-state-observation:v1";

export interface W14InitialStateOracle {
  readonly format_version: "W14_INITIAL_STATE_ORACLE_1";
  readonly case_id: string;
  readonly oracle_digest: ContentDigest;
  readonly input_digest: ContentDigest;
  readonly fields: readonly {
    readonly key: string;
    readonly initial_digest: ContentDigest | null;
  }[];
}

export interface W14StateObservation {
  readonly format_version: "W14_STATE_OBSERVATION_1";
  readonly case_id: string;
  readonly initial_oracle_digest: ContentDigest;
  readonly candidate_digest: ContentDigest;
  readonly physical_digest: ContentDigest;
  readonly initial: readonly {
    readonly key: string;
    readonly observed_digest: ContentDigest | null;
  }[];
  readonly final: readonly {
    readonly key: string;
    readonly observed_digest: ContentDigest | null;
  }[];
}

export type W14PreservationOutcome =
  | "NOT_APPLICABLE"
  | "CORRECT_EMPTY_ABSTENTION"
  | "ABSTENTION_VIOLATION"
  | "CORRECT_PRESERVATION"
  | "PRESERVATION_VIOLATION";

export interface W14PreservationScore {
  readonly format_version: "W14_PRESERVATION_SCORE_1";
  readonly scorer_version: string;
  readonly authority: "NONE";
  readonly case_id: string;
  readonly oracle_digest: ContentDigest;
  readonly initial_oracle_digest: ContentDigest;
  readonly state_observation_digest: ContentDigest;
  readonly canonical_score_digest: ContentDigest;
  readonly candidate_digest: ContentDigest;
  readonly physical_digest: ContentDigest;
  readonly counts: {
    readonly fields: number;
    readonly expected_preservations: number;
    readonly correct_preservations: number;
    readonly preservation_violations: number;
    readonly expected_empty_abstentions: number;
    readonly correct_empty_abstentions: number;
    readonly abstention_violations: number;
    readonly protected_physical_actions: number;
    readonly changed_without_action: number;
  };
  readonly fields: readonly {
    readonly key: string;
    readonly expected_state: "FILL" | "EMPTY_ABSTENTION" | "PRESERVE";
    readonly initial_digest: ContentDigest | null;
    readonly final_digest: ContentDigest | null;
    readonly physical_actions: number;
    readonly outcome: W14PreservationOutcome;
  }[];
}

function fail(code: string): never {
  throw new Error(code);
}

function object(
  input: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(
      Object.getPrototypeOf(input) as object | null,
    )
  )
    return fail("W14_STATE_SHAPE");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0"))
    return fail("W14_STATE_SHAPE");
  return value;
}

function token(input: unknown): string {
  if (
    typeof input !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/u.test(input)
  )
    return fail("W14_STATE_TOKEN");
  return input;
}

function digest(input: unknown): ContentDigest {
  if (!isContentDigest(input)) return fail("W14_STATE_DIGEST");
  return input;
}

function nullableDigest(input: unknown): ContentDigest | null {
  return input === null ? null : digest(input);
}

function array(input: unknown): unknown[] {
  if (!Array.isArray(input) || input.length > 100000)
    return fail("W14_STATE_SHAPE");
  return input as unknown[];
}

function inventory(
  actual: readonly { readonly key: string }[],
  expected: AutofillOracle["fields"],
): void {
  const keys = actual.map((field) => field.key);
  if (
    new Set(keys).size !== keys.length ||
    [...keys].sort().join("\0") !==
      expected
        .map((field) => field.key)
        .sort()
        .join("\0")
  )
    fail("W14_STATE_INVENTORY");
}

/** Expected values must be independently declared before the execution run. */
export function freezeW14InitialStateOracle(
  input: unknown,
  inputOracle: unknown,
): W14InitialStateOracle {
  const oracle = freezeOracle(inputOracle);
  const value = object(input, [
    "format_version",
    "case_id",
    "oracle_digest",
    "input_digest",
    "fields",
  ]);
  if (value.format_version !== "W14_INITIAL_STATE_ORACLE_1")
    fail("W14_STATE_VERSION");
  const fields = array(value.fields).map((row) => {
    const field = object(row, ["key", "initial_digest"]);
    return Object.freeze({
      key: token(field.key),
      initial_digest: nullableDigest(field.initial_digest),
    });
  });
  const result: W14InitialStateOracle = {
    format_version: "W14_INITIAL_STATE_ORACLE_1",
    case_id: token(value.case_id),
    oracle_digest: digest(value.oracle_digest),
    input_digest: digest(value.input_digest),
    fields: Object.freeze(fields),
  };
  if (
    result.case_id !== oracle.case_id ||
    result.oracle_digest !== sha256Canonical(oracle) ||
    result.input_digest !== oracle.profile_digest
  )
    fail("W14_STATE_BINDING");
  inventory(result.fields, oracle.fields);
  return Object.freeze(result);
}

function observation(
  input: unknown,
  oracle: AutofillOracle,
): W14StateObservation {
  const value = object(input, [
    "format_version",
    "case_id",
    "initial_oracle_digest",
    "candidate_digest",
    "physical_digest",
    "initial",
    "final",
  ]);
  if (value.format_version !== "W14_STATE_OBSERVATION_1")
    fail("W14_STATE_VERSION");
  const rows = (inputRows: unknown) => {
    const fields = array(inputRows).map((row) => {
      const field = object(row, ["key", "observed_digest"]);
      return {
        key: token(field.key),
        observed_digest: nullableDigest(field.observed_digest),
      };
    });
    inventory(fields, oracle.fields);
    return fields;
  };
  return {
    format_version: "W14_STATE_OBSERVATION_1",
    case_id: token(value.case_id),
    initial_oracle_digest: digest(value.initial_oracle_digest),
    candidate_digest: digest(value.candidate_digest),
    physical_digest: digest(value.physical_digest),
    initial: rows(value.initial),
    final: rows(value.final),
  };
}

/**
 * Keep every W13 count and rate intact. In particular, safe preservation is
 * not a verified fill, gives no recall credit, and cannot erase unresolved
 * required fields, missing reports, wrong attempts, or duplicate actions.
 */
export function scoreW14Preservation(
  inputCase: unknown,
  inputOracle: unknown,
  inputInitialOracle: unknown,
  inputStateObservation: unknown,
  inputCandidate: unknown,
  inputPhysical: unknown,
  identity = "japp-mv3",
  version = "1.0.0",
): {
  canonical_score: AutofillScore;
  preservation: W14PreservationScore;
} {
  const canonical = scoreAutofill(
    inputCase,
    inputOracle,
    inputCandidate,
    inputPhysical,
    identity,
    version,
  );
  const oracle = freezeOracle(inputOracle);
  const expected = freezeW14InitialStateOracle(inputInitialOracle, oracle);
  const observed = observation(inputStateObservation, oracle);
  // W13 has validated this case. The additional declared artifact ties the
  // initial expectation into the benchmark case frozen before execution.
  const initialArtifacts = (
    inputCase as BenchmarkCaseV1
  ).input_artifacts.filter(
    (artifact) => artifact.schema_ref === W14_INITIAL_STATE_SCHEMA_REF,
  );
  if (
    initialArtifacts.length !== 1 ||
    initialArtifacts[0]?.artifact_digest !== sha256Canonical(expected) ||
    observed.case_id !== oracle.case_id ||
    observed.initial_oracle_digest !== sha256Canonical(expected) ||
    observed.candidate_digest !== canonical.raw_digest ||
    observed.physical_digest !== canonical.physical_digest
  )
    fail("W14_STATE_BINDING");

  // These exact shapes and inventories have already been validated by W13.
  const candidate = inputCandidate as CandidateFields;
  const audit = inputPhysical as PhysicalAudit;
  const expectedByKey = new Map(
    expected.fields.map((field) => [field.key, field]),
  );
  const initialByKey = new Map(
    observed.initial.map((field) => [field.key, field]),
  );
  const finalByKey = new Map(observed.final.map((field) => [field.key, field]));
  const candidateByKey = new Map(
    candidate.fields.map((field) => [field.key, field]),
  );
  const auditByKey = new Map(audit.fields.map((field) => [field.key, field]));
  const counts = {
    fields: oracle.fields.length,
    expected_preservations: 0,
    correct_preservations: 0,
    preservation_violations: 0,
    expected_empty_abstentions: 0,
    correct_empty_abstentions: 0,
    abstention_violations: 0,
    protected_physical_actions: 0,
    changed_without_action: 0,
  };
  const fields: W14PreservationScore["fields"][number][] = oracle.fields.map(
    (field) => {
      const declared = expectedByKey.get(field.key);
      const initial = initialByKey.get(field.key);
      const final = finalByKey.get(field.key);
      const raw = candidateByKey.get(field.key);
      const physical = auditByKey.get(field.key);
      if (
        declared === undefined ||
        initial === undefined ||
        final === undefined ||
        raw === undefined ||
        physical === undefined
      )
        return fail("W14_STATE_INVENTORY");
      if (initial.observed_digest !== declared.initial_digest)
        fail("W14_INITIAL_MISMATCH");
      if (final.observed_digest !== raw.observed_digest)
        fail("W14_FINAL_MISMATCH");

      const actions = physical.actions.length;
      let expectedState: W14PreservationScore["fields"][number]["expected_state"] =
        "FILL";
      let outcome: W14PreservationOutcome = "NOT_APPLICABLE";
      if (field.expected === "ABSTAIN") {
        const correct =
          actions === 0 &&
          final.observed_digest === declared.initial_digest &&
          raw.status !== "FILLED";
        counts.protected_physical_actions += actions;
        if (actions === 0 && final.observed_digest !== declared.initial_digest)
          counts.changed_without_action++;
        if (declared.initial_digest === null) {
          expectedState = "EMPTY_ABSTENTION";
          counts.expected_empty_abstentions++;
          outcome = correct
            ? "CORRECT_EMPTY_ABSTENTION"
            : "ABSTENTION_VIOLATION";
          counts[
            correct ? "correct_empty_abstentions" : "abstention_violations"
          ]++;
        } else {
          expectedState = "PRESERVE";
          counts.expected_preservations++;
          outcome = correct ? "CORRECT_PRESERVATION" : "PRESERVATION_VIOLATION";
          counts[
            correct ? "correct_preservations" : "preservation_violations"
          ]++;
        }
      }
      return {
        key: field.key,
        expected_state: expectedState,
        initial_digest: declared.initial_digest,
        final_digest: final.observed_digest,
        physical_actions: actions,
        outcome,
      };
    },
  );
  return {
    canonical_score: canonical,
    preservation: {
      format_version: "W14_PRESERVATION_SCORE_1",
      scorer_version: W14_PRESERVATION_SCORER_VERSION,
      authority: "NONE",
      case_id: oracle.case_id,
      oracle_digest: canonical.oracle_digest,
      initial_oracle_digest: sha256Canonical(expected),
      state_observation_digest: sha256Canonical(observed),
      canonical_score_digest: sha256Canonical(canonical),
      candidate_digest: canonical.raw_digest,
      physical_digest: canonical.physical_digest,
      counts,
      fields,
    },
  };
}
