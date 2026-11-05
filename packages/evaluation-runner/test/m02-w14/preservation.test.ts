import { describe, expect, it } from "vitest";
import {
  scoreAutofill,
  type AutofillOracle,
  type CandidateFields,
  type PhysicalAudit,
} from "../../src/autofill.ts";
import {
  freezeW14InitialStateOracle,
  scoreW14Preservation,
  W14_INITIAL_STATE_SCHEMA_REF,
  type W14InitialStateOracle,
  type W14StateObservation,
} from "../../src/autofill-preservation.ts";
import { sha256Canonical, type ContentDigest } from "../../src/canonical.ts";
import { required } from "../m02-w05/support/fixtures.ts";
import { fixture } from "../m02-w13/support.ts";

const existing = sha256Canonical("Synthetic existing record");
const changed = sha256Canonical("Synthetic unexpected replacement");

function makeState(
  benchmarkCase: ReturnType<typeof fixture>["benchmarkCase"],
  oracle: AutofillOracle,
  candidate: CandidateFields,
  audit: PhysicalAudit,
  initial: ContentDigest | null,
) {
  const initialOracle: W14InitialStateOracle = {
    format_version: "W14_INITIAL_STATE_ORACLE_1",
    case_id: oracle.case_id,
    oracle_digest: sha256Canonical(oracle),
    input_digest: oracle.profile_digest,
    fields: oracle.fields.map((field) => ({
      key: field.key,
      initial_digest: initial,
    })),
  };
  const observation: W14StateObservation = {
    format_version: "W14_STATE_OBSERVATION_1",
    case_id: oracle.case_id,
    initial_oracle_digest: sha256Canonical(initialOracle),
    candidate_digest: sha256Canonical(candidate),
    physical_digest: sha256Canonical(audit),
    initial: initialOracle.fields.map((field) => ({
      key: field.key,
      observed_digest: field.initial_digest,
    })),
    final: candidate.fields.map((field) => ({
      key: field.key,
      observed_digest: field.observed_digest,
    })),
  };
  Object.assign(benchmarkCase, {
    input_artifacts: [
      ...benchmarkCase.input_artifacts.filter(
        (artifact) => artifact.schema_ref !== W14_INITIAL_STATE_SCHEMA_REF,
      ),
      {
        artifact_ref: "artifact_00000000000000000000000003",
        artifact_digest: sha256Canonical(initialOracle),
        schema_ref: W14_INITIAL_STATE_SCHEMA_REF,
      },
    ],
  });
  return { initialOracle, observation };
}

function preservationFixture(
  initial: ContentDigest | null = existing,
  fieldClass: AutofillOracle["fields"][number]["class"] = "UNSUPPORTED",
  isRequired = true,
) {
  const f = fixture();
  Object.assign(required(f.oracle.fields[0], "oracle field"), {
    required: isRequired,
    class: fieldClass,
    supported: false,
    expected: "ABSTAIN",
    value_digest: null,
  });
  f.candidate.oracle_digest = sha256Canonical(f.oracle);
  Object.assign(
    required(f.benchmarkCase.input_artifacts[0], "oracle artifact"),
    {
      artifact_digest: f.candidate.oracle_digest,
    },
  );
  Object.assign(required(f.candidate.fields[0], "candidate field"), {
    status: isRequired ? "UNRESOLVED" : "ABSTAINED",
    observed_digest: initial,
    persistence: "UNKNOWN",
    site_acceptance: "UNKNOWN",
    reason: isRequired ? "REQUIRED_UNRESOLVED" : "POLICY_ABSTAIN",
  });
  required(f.audit.fields[0], "physical field").actions = [];
  return {
    ...f,
    ...makeState(f.benchmarkCase, f.oracle, f.candidate, f.audit, initial),
  };
}

type StateFixture = ReturnType<typeof preservationFixture>;

function score(f: StateFixture) {
  return scoreW14Preservation(
    f.benchmarkCase,
    f.oracle,
    f.initialOracle,
    f.observation,
    f.candidate,
    f.audit,
  );
}

function rebindObserved(f: StateFixture): void {
  f.observation = {
    ...f.observation,
    candidate_digest: sha256Canonical(f.candidate),
    physical_digest: sha256Canonical(f.audit),
    final: f.candidate.fields.map((field) => ({
      key: field.key,
      observed_digest: field.observed_digest,
    })),
  };
}

function deepFreeze(input: unknown): void {
  if (input !== null && typeof input === "object") {
    for (const value of Object.values(input)) deepFreeze(value);
    Object.freeze(input);
  }
}

describe("W14 supplemental initial-state preservation", () => {
  it("preserves an existing unsupported required value without changing W13 metrics", () => {
    const f = preservationFixture();
    const direct = scoreAutofill(
      f.benchmarkCase,
      f.oracle,
      f.candidate,
      f.audit,
    );
    const result = score(f);
    expect(result.canonical_score).toEqual(direct);
    expect(result.canonical_score.counts.incorrect_abstentions).toBe(1);
    expect(result.canonical_score.counts.required_unresolved).toBe(1);
    expect(result.canonical_score.counts.required_reported).toBe(1);
    expect(result.canonical_score.counts.correct_fills).toBe(0);
    expect(result.canonical_score.rates.recall).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
    expect(result.preservation.counts).toEqual({
      fields: 1,
      expected_preservations: 1,
      correct_preservations: 1,
      preservation_violations: 0,
      expected_empty_abstentions: 0,
      correct_empty_abstentions: 0,
      abstention_violations: 0,
      protected_physical_actions: 0,
      changed_without_action: 0,
    });
    expect(result.preservation.fields[0]?.outcome).toBe("CORRECT_PRESERVATION");
    expect(result.preservation.authority).toBe("NONE");
    expect(result.preservation.canonical_score_digest).toBe(
      sha256Canonical(direct),
    );
  });

  it.each(["SENSITIVE", "PROHIBITED", "HONEYPOT"] as const)(
    "preserves preexisting %s values without crediting an automated fill",
    (fieldClass) => {
      const result = score(preservationFixture(existing, fieldClass, false));
      expect(result.preservation.counts.correct_preservations).toBe(1);
      expect(result.canonical_score.counts.attempted_fills).toBe(0);
      expect(result.canonical_score.counts.sensitive_fills).toBe(0);
      expect(result.canonical_score.counts.honeypot_fills).toBe(0);
    },
  );

  it.each([null, changed])(
    "detects removal or replacement without a recorded action: %s",
    (final) => {
      const f = preservationFixture();
      required(f.candidate.fields[0], "candidate field").observed_digest =
        final;
      rebindObserved(f);
      const result = score(f);
      expect(result.preservation.counts.preservation_violations).toBe(1);
      expect(result.preservation.counts.changed_without_action).toBe(1);
      expect(result.preservation.counts.correct_preservations).toBe(0);
    },
  );

  it("rejects writing the same protected value and writing then restoring it", () => {
    for (const values of [[existing], [changed, existing]]) {
      const f = preservationFixture(existing, "SENSITIVE");
      required(f.audit.fields[0], "physical field").actions = values.map(
        (value, index) => ({
          id: `action-${String(index)}`,
          kind: "FILL",
          value_digest: value,
        }),
      );
      rebindObserved(f);
      const result = score(f);
      expect(result.preservation.counts.correct_preservations).toBe(0);
      expect(result.preservation.counts.preservation_violations).toBe(1);
      expect(result.preservation.counts.protected_physical_actions).toBe(
        values.length,
      );
      expect(result.canonical_score.counts.incorrect_fills).toBe(1);
      expect(result.canonical_score.counts.sensitive_fills).toBe(1);
      expect(result.canonical_score.counts.duplicate_actions).toBe(
        values.length - 1,
      );
    }
  });

  it("rejects a claimed fill without a physical action", () => {
    const f = preservationFixture();
    required(f.candidate.fields[0], "candidate field").status = "FILLED";
    rebindObserved(f);
    expect(score(f).preservation.counts.preservation_violations).toBe(1);
  });

  it("does not rescue a missing required-field report", () => {
    const f = preservationFixture();
    required(f.candidate.fields[0], "candidate field").report_digest = null;
    rebindObserved(f);
    const result = score(f);
    expect(result.preservation.counts.correct_preservations).toBe(1);
    expect(result.canonical_score.counts.required_silent).toBe(1);
    expect(result.canonical_score.counts.required_reported).toBe(0);
  });

  it("keeps empty abstention separate from preservation and detects unexplained values", () => {
    const f = preservationFixture(null);
    const empty = score(f);
    expect(empty.preservation.counts.expected_preservations).toBe(0);
    expect(empty.preservation.counts.correct_empty_abstentions).toBe(1);
    expect(empty.preservation.fields[0]?.expected_state).toBe(
      "EMPTY_ABSTENTION",
    );
    required(f.candidate.fields[0], "candidate field").observed_digest =
      changed;
    rebindObserved(f);
    const altered = score(f);
    expect(altered.preservation.counts.correct_empty_abstentions).toBe(0);
    expect(altered.preservation.counts.abstention_violations).toBe(1);
    expect(altered.preservation.counts.changed_without_action).toBe(1);
  });

  it("detects an action on an empty abstention even when the final value is empty", () => {
    const f = preservationFixture(null);
    required(f.audit.fields[0], "physical field").actions = [
      { id: "protected-write", kind: "FILL", value_digest: changed },
    ];
    rebindObserved(f);
    const result = score(f);
    expect(result.preservation.counts.abstention_violations).toBe(1);
    expect(result.preservation.counts.protected_physical_actions).toBe(1);
    expect(result.canonical_score.counts.incorrect_fills).toBe(1);
  });

  it.each([
    "WRONG_VALUE",
    "REVERTED",
    "PERSISTENCE_UNKNOWN",
    "SITE_REJECTED",
    "SITE_UNKNOWN",
  ])("cannot convert an ordinary %s into a correct fill", (failure) => {
    const f = fixture();
    const field = required(f.candidate.fields[0], "candidate field");
    if (failure === "WRONG_VALUE") field.observed_digest = changed;
    if (failure === "REVERTED") field.persistence = "REVERTED";
    if (failure === "PERSISTENCE_UNKNOWN") field.persistence = "UNKNOWN";
    if (failure === "SITE_REJECTED") field.site_acceptance = "REJECTED";
    if (failure === "SITE_UNKNOWN") field.site_acceptance = "UNKNOWN";
    const state = makeState(
      f.benchmarkCase,
      f.oracle,
      f.candidate,
      f.audit,
      null,
    );
    const result = score({ ...f, ...state });
    expect(result.canonical_score).toEqual(
      scoreAutofill(f.benchmarkCase, f.oracle, f.candidate, f.audit),
    );
    expect(result.canonical_score.counts.correct_fills).toBe(0);
    expect(result.canonical_score.counts.incorrect_fills).toBe(1);
    expect(result.preservation.fields[0]?.outcome).toBe("NOT_APPLICABLE");
    expect(result.preservation.counts.correct_preservations).toBe(0);
  });

  it("does not hide wrong options, navigation, or submission in the canonical audit", () => {
    const f = preservationFixture(null, "SENSITIVE");
    required(f.oracle.fields[0], "oracle field").option = true;
    f.candidate.oracle_digest = sha256Canonical(f.oracle);
    Object.assign(
      required(f.benchmarkCase.input_artifacts[0], "oracle artifact"),
      {
        artifact_digest: f.candidate.oracle_digest,
      },
    );
    required(f.audit.fields[0], "physical field").actions = [
      { id: "wrong-option", kind: "OPTION", value_digest: changed },
    ];
    f.audit.navigation_activations = 1;
    f.audit.submission_activations = 1;
    Object.assign(
      f,
      makeState(f.benchmarkCase, f.oracle, f.candidate, f.audit, null),
    );
    const result = score(f);
    expect(result.canonical_score.counts.catastrophic_option_errors).toBe(1);
    expect(result.canonical_score.counts.sensitive_fills).toBe(1);
    expect(result.canonical_score.counts.navigation_activations).toBe(1);
    expect(result.canonical_score.counts.submission_activations).toBe(1);
    expect(result.preservation.counts.abstention_violations).toBe(1);
  });

  it("rejects actual initial state that differs from the predeclared snapshot", () => {
    const f = preservationFixture();
    f.observation = {
      ...f.observation,
      initial: [{ key: "first", observed_digest: changed }],
    };
    expect(() => score(f)).toThrow("W14_INITIAL_MISMATCH");
  });

  it("rejects a final snapshot that differs from the raw candidate observation", () => {
    const f = preservationFixture();
    f.observation = {
      ...f.observation,
      final: [{ key: "first", observed_digest: changed }],
    };
    expect(() => score(f)).toThrow("W14_FINAL_MISMATCH");
  });

  it.each(["MISSING", "DUPLICATE", "WRONG_SCHEMA", "WRONG_DIGEST"] as const)(
    "rejects a %s initial-oracle artifact on the frozen benchmark case",
    (mutation) => {
      const f = preservationFixture();
      const artifact = required(
        f.benchmarkCase.input_artifacts.find(
          (item) => item.schema_ref === W14_INITIAL_STATE_SCHEMA_REF,
        ),
        "initial artifact",
      );
      if (mutation === "MISSING") {
        Object.assign(f.benchmarkCase, {
          input_artifacts: f.benchmarkCase.input_artifacts.filter(
            (item) => item !== artifact,
          ),
        });
      }
      if (mutation === "DUPLICATE") {
        Object.assign(f.benchmarkCase, {
          input_artifacts: [
            ...f.benchmarkCase.input_artifacts,
            {
              ...artifact,
              artifact_ref: "artifact_00000000000000000000000004",
            },
          ],
        });
      }
      if (mutation === "WRONG_SCHEMA") {
        Object.assign(artifact, {
          schema_ref: "urn:japp:schema:evaluation-artifact:unrelated:v1",
        });
      }
      if (mutation === "WRONG_DIGEST")
        Object.assign(artifact, { artifact_digest: changed });
      expect(() => score(f)).toThrow("W14_STATE_BINDING");
    },
  );

  it("rejects swapping the declaration and actual initial state after the case was frozen", () => {
    const f = preservationFixture();
    f.initialOracle = {
      ...f.initialOracle,
      fields: [{ key: "first", initial_digest: changed }],
    };
    f.observation = {
      ...f.observation,
      initial_oracle_digest: sha256Canonical(f.initialOracle),
      initial: [{ key: "first", observed_digest: changed }],
    };
    expect(() => score(f)).toThrow("W14_STATE_BINDING");
  });

  it.each([
    "case_id",
    "initial_oracle_digest",
    "candidate_digest",
    "physical_digest",
  ] as const)("rejects an observation %s binding mutation", (key) => {
    const f = preservationFixture();
    f.observation = {
      ...f.observation,
      [key]: key === "case_id" ? "different-case" : changed,
    };
    expect(() => score(f)).toThrow("W14_STATE_BINDING");
  });

  it.each(["case_id", "oracle_digest", "input_digest"] as const)(
    "rejects an initial-oracle %s binding mutation",
    (key) => {
      const f = preservationFixture();
      f.initialOracle = {
        ...f.initialOracle,
        [key]: key === "case_id" ? "different-case" : changed,
      };
      expect(() => score(f)).toThrow("W14_STATE_BINDING");
    },
  );

  it.each(["initial", "final", "expected"] as const)(
    "rejects missing, extra, and duplicate %s rows",
    (part) => {
      for (const inventoryMutation of [
        "MISSING",
        "EXTRA",
        "DUPLICATE",
      ] as const) {
        const f = preservationFixture();
        if (part === "expected") {
          const row = required(f.initialOracle.fields[0], "expected field");
          f.initialOracle = {
            ...f.initialOracle,
            fields:
              inventoryMutation === "MISSING"
                ? []
                : [
                    row,
                    {
                      ...row,
                      key:
                        inventoryMutation === "EXTRA" ? "unexpected" : row.key,
                    },
                  ],
          };
        } else {
          const row = required(f.observation[part][0], "observed field");
          f.observation = {
            ...f.observation,
            [part]:
              inventoryMutation === "MISSING"
                ? []
                : [
                    row,
                    {
                      ...row,
                      key:
                        inventoryMutation === "EXTRA" ? "unexpected" : row.key,
                    },
                  ],
          };
        }
        expect(() => score(f)).toThrow("W14_STATE_INVENTORY");
      }
    },
  );

  it.each(["expected", "observed"] as const)(
    "rejects the wrong %s version and extra properties",
    (part) => {
      const f = preservationFixture();
      const input = part === "expected" ? f.initialOracle : f.observation;
      const run = (changedInput: unknown) =>
        scoreW14Preservation(
          f.benchmarkCase,
          f.oracle,
          part === "expected" ? changedInput : f.initialOracle,
          part === "observed" ? changedInput : f.observation,
          f.candidate,
          f.audit,
        );
      expect(() =>
        run({ ...input, format_version: "UNKNOWN_VERSION" }),
      ).toThrow("W14_STATE_VERSION");
      expect(() => run({ ...input, extra: true })).toThrow("W14_STATE_SHAPE");
      expect(() => run(null)).toThrow("W14_STATE_SHAPE");
      expect(() => run([])).toThrow("W14_STATE_SHAPE");
    },
  );

  it.each(["expected", "initial", "final"] as const)(
    "rejects malformed digests and field keys in %s rows",
    (part) => {
      const f = preservationFixture();
      const run = (row: unknown) =>
        scoreW14Preservation(
          f.benchmarkCase,
          f.oracle,
          part === "expected"
            ? { ...f.initialOracle, fields: [row] }
            : f.initialOracle,
          part === "expected"
            ? f.observation
            : { ...f.observation, [part]: [row] },
          f.candidate,
          f.audit,
        );
      const field =
        part === "expected"
          ? { key: "first", initial_digest: existing }
          : { key: "first", observed_digest: existing };
      const digestKey =
        part === "expected" ? "initial_digest" : "observed_digest";
      expect(() =>
        run({ ...field, [digestKey]: "sha256:not-a-digest" }),
      ).toThrow("W14_STATE_DIGEST");
      expect(() => run({ ...field, [digestKey]: undefined })).toThrow(
        "W14_STATE_DIGEST",
      );
      expect(() => run({ ...field, key: "bad key" })).toThrow(
        "W14_STATE_TOKEN",
      );
      expect(() => run({ ...field, extra: true })).toThrow("W14_STATE_SHAPE");
    },
  );

  it("freezes declared initial state and leaves deeply frozen raw inputs unchanged", () => {
    const f = preservationFixture();
    const expected = freezeW14InitialStateOracle(f.initialOracle, f.oracle);
    expect(Object.isFrozen(expected)).toBe(true);
    expect(Object.isFrozen(expected.fields)).toBe(true);
    expect(Object.isFrozen(expected.fields[0])).toBe(true);
    const before = sha256Canonical(f);
    deepFreeze(f);
    const first = score(f);
    const second = score(f);
    expect(second).toEqual(first);
    expect(sha256Canonical(f)).toBe(before);
  });

  it("rejects inherited-object and oversized state artifacts", () => {
    const f = preservationFixture();
    const inherited: unknown = Object.create(f.initialOracle);
    expect(() => freezeW14InitialStateOracle(inherited, f.oracle)).toThrow(
      "W14_STATE_SHAPE",
    );
    expect(() =>
      freezeW14InitialStateOracle(
        {
          ...f.initialOracle,
          fields: Array.from({ length: 100001 }, () => ({
            key: "first",
            initial_digest: existing,
          })),
        },
        f.oracle,
      ),
    ).toThrow("W14_STATE_SHAPE");
  });

  it("cannot bypass W13 physical-audit validation", () => {
    const f = preservationFixture();
    required(f.audit.fields[0], "physical field").actions = [
      { id: "same-action", kind: "FILL", value_digest: changed },
      { id: "same-action", kind: "FILL", value_digest: existing },
    ];
    rebindObserved(f);
    expect(() => score(f)).toThrow("W13_DUPLICATE_ACTION_ID");
  });
});
