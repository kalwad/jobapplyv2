import { describe, expect, it } from "vitest";
import { sha256Canonical } from "../../src/canonical.ts";
import {
  freezeOracle,
  scoreAutofill,
  worksheet,
  isolateBaseline,
  createAutofillAdapter,
} from "../../src/autofill.ts";
import {
  required,
  makeRequest,
  FixedClock,
  trustedContext,
} from "../m02-w05/support/fixtures.ts";
import { runEvaluation } from "../../src/runner.ts";
import { fixture } from "./support.ts";
const digest = sha256Canonical("synthetic expected");
function scored(f = fixture()) {
  return scoreAutofill(
    f.benchmarkCase,
    freezeOracle(f.oracle),
    f.candidate,
    f.audit,
  );
}
describe("W13 permanent S1-S16 scoring contracts", () => {
  it("S1 S2 exact counts and one primary class", () => {
    const s = scored();
    expect(s.counts.correct_fills).toBe(1);
    expect(s.rates.precision).toEqual({
      numerator: 1,
      denominator: 1,
      rate: 1,
    });
    expect(s.fields.map((f) => f.primary)).toEqual(["CORRECT_FILL"]);
  });
  it("S3 wrong attempt survives claimed abstention", () => {
    const f = fixture();
    required(f.candidate.fields[0], "first fixture item").status = "ABSTAINED";
    required(
      required(f.audit.fields[0], "physical field").actions[0],
      "action",
    ).value_digest = sha256Canonical("wrong");
    expect(scored(f).counts.incorrect_fills).toBe(1);
    expect(scored(f).rates.precision.denominator).toBe(1);
  });
  it("S4 S14 missing required result fails closed", () => {
    const f = fixture();
    f.candidate.fields = [];
    expect(() => scored(f)).toThrow("W13_RESULT_INVENTORY");
  });
  it("S5 unsupported expected abstention excluded from recall, zero rate is null", () => {
    const f = fixture();
    required(f.oracle.fields[0], "first fixture item").supported = false;
    required(f.oracle.fields[0], "first fixture item").expected = "ABSTAIN";
    required(f.oracle.fields[0], "first fixture item").value_digest = null;
    f.candidate.oracle_digest = sha256Canonical(f.oracle);
    Object.assign(
      required(f.benchmarkCase.input_artifacts[0], "first fixture item"),
      {
        artifact_digest: f.candidate.oracle_digest,
      },
    );
    required(f.candidate.fields[0], "first fixture item").status = "ABSTAINED";
    required(f.candidate.fields[0], "first fixture item").observed_digest =
      null;
    required(f.audit.fields[0], "first fixture item").actions = [];
    const s = scored(f);
    expect(s.rates.recall).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
    expect(s.counts.correct_abstentions).toBe(1);
  });
  it.each(["SENSITIVE", "PROHIBITED", "HONEYPOT"] as const)(
    "S6 S7 %s false fill independently visible",
    (className) => {
      const f = fixture();
      Object.assign(required(f.oracle.fields[0], "first fixture item"), {
        class: className,
        expected: "ABSTAIN",
        value_digest: null,
      });
      f.candidate.oracle_digest = sha256Canonical(f.oracle);
      Object.assign(
        required(f.benchmarkCase.input_artifacts[0], "first fixture item"),
        {
          artifact_digest: f.candidate.oracle_digest,
        },
      );
      const s = scored(f);
      expect(s.counts.incorrect_fills).toBe(1);
      expect(
        className === "HONEYPOT"
          ? s.counts.honeypot_fills
          : s.counts.sensitive_fills,
      ).toBe(1);
    },
  );
  it("S8 wrong option catastrophic count survives primary scoring", () => {
    const f = fixture();
    required(f.oracle.fields[0], "first fixture item").option = true;
    f.candidate.oracle_digest = sha256Canonical(f.oracle);
    Object.assign(
      required(f.benchmarkCase.input_artifacts[0], "first fixture item"),
      {
        artifact_digest: f.candidate.oracle_digest,
      },
    );
    required(
      required(f.audit.fields[0], "physical field").actions[0],
      "action",
    ).kind = "OPTION";
    required(
      required(f.audit.fields[0], "physical field").actions[0],
      "action",
    ).value_digest = sha256Canonical("unrelated");
    expect(scored(f).counts.catastrophic_option_errors).toBe(1);
  });
  it("S9 unresolved requires explicit reporting evidence", () => {
    const f = fixture();
    required(f.audit.fields[0], "first fixture item").actions = [];
    Object.assign(required(f.candidate.fields[0], "first fixture item"), {
      status: "UNRESOLVED",
      observed_digest: null,
      persistence: "UNKNOWN",
      site_acceptance: "UNKNOWN",
      reason: "REQUIRED_UNRESOLVED",
    });
    expect(scored(f).counts.required_reported).toBe(1);
    required(f.candidate.fields[0], "first fixture item").report_digest = null;
    expect(scored(f).counts.required_silent).toBe(1);
    expect(scored(f).rates.recall.rate).toBe(0);
  });
  it("S10 physical duplicates survive a single final result", () => {
    const f = fixture();
    required(f.audit.fields[0], "first fixture item").actions.push({
      ...required(
        required(f.audit.fields[0], "physical field").actions[0],
        "action",
      ),
      id: "action-two",
    });
    expect(scored(f).counts.duplicate_actions).toBe(1);
    expect(scored(f).counts.physical_actions).toBe(2);
  });
  it("S11 reverted/unknown cannot count successful", () => {
    for (const persistence of ["REVERTED", "UNKNOWN"] as const) {
      const f = fixture();
      required(f.candidate.fields[0], "first fixture item").persistence =
        persistence;
      expect(scored(f).counts.correct_fills).toBe(0);
    }
  });
  it("S12 rejection/unknown cannot count successful", () => {
    for (const acceptance of ["REJECTED", "UNKNOWN"] as const) {
      const f = fixture();
      required(f.candidate.fields[0], "first fixture item").site_acceptance =
        acceptance;
      expect(scored(f).counts.correct_fills).toBe(0);
    }
  });
  it("S13 determinism", () => {
    expect(scored()).toEqual(scored());
  });
  it("S14 duplicate/conflicting results fail closed", () => {
    const f = fixture();
    f.candidate.fields.push({
      ...required(f.candidate.fields[0], "first fixture item"),
    });
    expect(() => scored(f)).toThrow("W13_RESULT_INVENTORY");
  });
  it("S15 candidate cannot author truth or change oracle binding", () => {
    const f = fixture();
    (f.candidate as unknown as Record<string, unknown>).expected = digest;
    expect(() => scored(f)).toThrow("W13_SHAPE");
    delete (f.candidate as unknown as Record<string, unknown>).expected;
    f.candidate.oracle_digest = sha256Canonical("candidate truth");
    expect(() => scored(f)).toThrow("W13_BINDING");
  });
  it("S16 unknown version/malformed evidence fails closed", () => {
    const f = fixture();
    (f.candidate as unknown as Record<string, unknown>).format_version = "2";
    expect(() => scored(f)).toThrow("W13_VERSION");
  });
  it.each(["oracle_schema", "input_schema", "family", "input_digest"])(
    "S16 canonical case rejects unsupported %s metadata",
    (mutation) => {
      const f = fixture();
      if (mutation === "oracle_schema")
        Object.assign(
          required(f.benchmarkCase.input_artifacts[0], "oracle artifact"),
          {
            schema_ref: "urn:japp:schema:evaluation-artifact:w13-oracle:v999",
          },
        );
      if (mutation === "input_schema")
        Object.assign(
          required(f.benchmarkCase.input_artifacts[1], "input artifact"),
          {
            schema_ref: "urn:japp:schema:evaluation-artifact:w13-input:v999",
          },
        );
      if (mutation === "input_digest")
        Object.assign(
          required(f.benchmarkCase.input_artifacts[1], "input artifact"),
          {
            artifact_digest: sha256Canonical("different input"),
          },
        );
      if (mutation === "family")
        Object.assign(f.benchmarkCase, {
          benchmark_family: "CONTRACT_COMPATIBILITY",
        });
      expect(() => scored(f)).toThrow("W13_CASE_ORACLE_BINDING");
    },
  );
  it.each([
    "case_id",
    "fixture_id",
    "matrix_version",
    "matrix_digest",
    "corpus_version",
    "corpus_digest",
    "profile_digest",
  ] as const)("rejects %s mismatch", (key) => {
    const f = fixture();
    (f.candidate as unknown as Record<string, unknown>)[key] = "bad";
    expect(() => scored(f)).toThrow();
  });
  it("oracle immutable copy and missing provenance refused", () => {
    const f = fixture();
    const frozen = freezeOracle(f.oracle);
    expect(Object.isFrozen(frozen.fields[0])).toBe(true);
    (f.oracle as unknown as Record<string, unknown>).provenance_digest = null;
    expect(() => freezeOracle(f.oracle)).toThrow();
  });
  it("navigation/submission counters remain independent", () => {
    const f = fixture();
    f.audit.navigation_activations = 1;
    f.audit.submission_activations = 2;
    expect(scored(f).counts.navigation_activations).toBe(1);
    expect(scored(f).counts.submission_activations).toBe(2);
  });
  it("worksheet deterministic and competitor strictly unobserved", () => {
    const f = fixture();
    const s = scored(f);
    const meta = {
      browser: "Chromium",
      browser_version: "synthetic-test",
      product_version: "1.0.0",
      observed_at: "2026-09-30T12:00:00Z",
      provenance_digest: sha256Canonical("test"),
    };
    expect(worksheet(f.oracle, s, meta)).toEqual(worksheet(f.oracle, s, meta));
    expect(worksheet(f.oracle, s, meta).rows[0]?.simplify).toBe("NOT_EXECUTED");
  });
  it("M6 baseline has same inputs/scorer but cannot become product authority", () => {
    const f = fixture();
    f.candidate.implementation.kind = "BASELINE";
    f.candidate.implementation.identity =
      "baseline_legacy_behavior_observation_v1";
    f.candidate.implementation.version = "1.0.2";
    expect(() => scored(f)).toThrow("W13_IMPLEMENTATION");
    const isolated = isolateBaseline(
      f.benchmarkCase,
      f.oracle,
      f.candidate,
      f.audit,
      { identity: "baseline_legacy_behavior_observation_v1", version: "1.0.2" },
    );
    expect(isolated.authority).toBe("NONE");
    expect(isolated.score.counts.correct_fills).toBe(1);
    expect(f.oracle.fields[0]?.value_digest).toBe(digest);
  });
  it("accepted W05 runner consumes W13 domain adapter and canonical results", async () => {
    const f = fixture();
    const req = makeRequest([f.benchmarkCase], {
      implementationIdentity: "japp-mv3",
      runtime: { browser: { family: "CHROMIUM", version: "1.2.3" } },
    });
    const adapter = createAutofillAdapter(
      [
        {
          benchmarkCase: f.benchmarkCase,
          oracle: f.oracle,
          input: { profile: "synthetic" },
        },
      ],
      () => Promise.resolve({ candidate: f.candidate, audit: f.audit }),
      req.adapter,
    );
    const execution = await runEvaluation(
      req,
      adapter,
      new FixedClock(),
      trustedContext(req),
    );
    expect(execution.records[0]?.overall_outcome).toBe("PASS");
  });
});

it("S15 wrong candidate observations never become expected truth", () => {
  const f = fixture();
  const wrong = sha256Canonical("wrong candidate answer");
  const field = required(f.candidate.fields[0], "first observation");
  field.observed_digest = wrong;
  required(
    required(f.audit.fields[0], "physical field").actions[0],
    "action",
  ).value_digest = wrong;
  const before = sha256Canonical(f.oracle);
  const score = scored(f);
  expect(score.counts.correct_fills).toBe(0);
  expect(score.counts.incorrect_fills).toBe(1);
  expect(score.oracle_digest).toBe(before);
  expect(sha256Canonical(f.oracle)).toBe(before);
});
