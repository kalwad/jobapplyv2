import { describe, expect, test } from "vitest";

import {
  compareRegression,
  computeRegressionReferenceDigest,
  validateRegressionComparison,
  type EvaluationRunnerError,
  type RegressionCandidateV1,
  type RegressionCompatibilityV1,
  type RegressionReferenceV1,
} from "../../src/index.ts";
import { digest, semanticClone } from "./support/fixtures.ts";

function compatibility(
  overrides: Partial<RegressionCompatibilityV1> = {},
): RegressionCompatibilityV1 {
  return {
    corpus_digest: digest("1"),
    runtime_commitment_digest: digest("2"),
    metric_semantics_digest: digest("3"),
    threshold_semantics_digest: digest("4"),
    implementation_identity: "synthetic_implementation_v1",
    prompt_digests: [digest("5")],
    browser_family: "CHROMIUM",
    browser_version: "140.0.0.0",
    ...overrides,
  };
}

function reference(
  overrides: Partial<Omit<RegressionReferenceV1, "reference_digest">> = {},
): RegressionReferenceV1 {
  const payload: Omit<RegressionReferenceV1, "reference_digest"> = {
    regression_format_version: "1.0.0",
    reference_id: "regressionref_00000000000000000000000001",
    source_run_digest: digest("6"),
    metric_id: "QUALITY_SCORE",
    unit: "SCORE",
    value: 1,
    raw_numerator: 10,
    raw_denominator: 10,
    comparator: "HIGHER_IS_BETTER",
    allowed_regression: 0.05,
    compatibility: compatibility(),
    ...overrides,
  };
  return {
    ...payload,
    reference_digest: computeRegressionReferenceDigest(payload),
  };
}

function candidate(
  overrides: Partial<RegressionCandidateV1> = {},
): RegressionCandidateV1 {
  return {
    candidate_run_digest: digest("7"),
    metric_id: "QUALITY_SCORE",
    unit: "SCORE",
    value: 1,
    raw_numerator: 10,
    raw_denominator: 10,
    implementation_version: "1.1.0",
    compatibility: compatibility(),
    ...overrides,
  };
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("immutable reviewed regression comparison", () => {
  test("exact match passes with zero delta", () => {
    const result = compareRegression(reference(), candidate());
    expect(result.comparable).toBe(true);
    expect(result.absolute_delta).toBe("0");
    expect(result.relative_delta).toEqual({
      numerator: "0",
      denominator: "1",
      presentation: "0",
    });
    expect(result.passed).toBe(true);
  });

  test("higher-is-better improvement passes", () => {
    const result = compareRegression(
      reference({ value: 0.8, raw_numerator: 8 }),
      candidate({ value: 0.9, raw_numerator: 9 }),
    );
    expect(result.absolute_delta).toBe("0.1");
    expect(result.passed).toBe(true);
  });

  test("allowed regression passes at the exact tolerance boundary", () => {
    const result = compareRegression(
      reference({ value: 1, allowed_regression: 0.05 }),
      candidate({ value: 0.95, raw_numerator: 95, raw_denominator: 100 }),
    );
    expect(result.absolute_delta).toBe("-0.05");
    expect(result.passed).toBe(true);
  });

  test("threshold-breaking regression fails", () => {
    const result = compareRegression(
      reference({ value: 1, allowed_regression: 0.05 }),
      candidate({
        value: 0.949999,
        raw_numerator: 949_999,
        raw_denominator: 1_000_000,
      }),
    );
    expect(result.passed).toBe(false);
  });

  test("lower-is-better honors direction without changing the reference", () => {
    const result = compareRegression(
      reference({
        comparator: "LOWER_IS_BETTER",
        value: 1,
        allowed_regression: 0.05,
      }),
      candidate({ value: 0.9, raw_numerator: 9 }),
    );
    expect(result.absolute_delta).toBe("-0.1");
    expect(result.passed).toBe(true);
  });

  test("exact comparator uses absolute tolerance", () => {
    const result = compareRegression(
      reference({
        comparator: "EXACT_WITHIN_ABSOLUTE_TOLERANCE",
        value: 1,
        allowed_regression: 0.1,
      }),
      candidate({ value: 0.9, raw_numerator: 9 }),
    );
    expect(result.passed).toBe(true);
  });

  test("zero reference omits meaningless relative delta", () => {
    const result = compareRegression(
      reference({
        value: 0,
        raw_numerator: 0,
        raw_denominator: 10,
      }),
      candidate({ value: 0, raw_numerator: 0, raw_denominator: 10 }),
    );
    expect(result.relative_delta).toBeNull();
  });

  test("raw proportion counts remain beside both values", () => {
    const result = compareRegression(reference(), candidate());
    expect(result).toMatchObject({
      candidate_raw_numerator: 10,
      candidate_raw_denominator: 10,
      reference_raw_numerator: 10,
      reference_raw_denominator: 10,
    });
  });

  test.each([
    ["CORPUS_MISMATCH", { corpus_digest: digest("a") }],
    ["RUNTIME_MISMATCH", { runtime_commitment_digest: digest("a") }],
    ["METRIC_SEMANTICS_MISMATCH", { metric_semantics_digest: digest("a") }],
    [
      "THRESHOLD_SEMANTICS_MISMATCH",
      { threshold_semantics_digest: digest("a") },
    ],
    [
      "IMPLEMENTATION_IDENTITY_MISMATCH",
      { implementation_identity: "other_impl" },
    ],
    ["BROWSER_VERSION_MISMATCH", { browser_version: "141.0.0.0" }],
  ] as const)("%s marks comparison incomparable", (reason, override) => {
    const result = compareRegression(
      reference(),
      candidate({ compatibility: compatibility(override) }),
    );
    expect(result.comparable).toBe(false);
    expect(result.passed).toBeNull();
    expect(result.incomparable_reasons).toContain(reason);
  });

  test("incompatible prompt commitments never compare", () => {
    const result = compareRegression(
      reference(),
      candidate({
        compatibility: compatibility({ prompt_digests: [digest("a")] }),
      }),
    );
    expect(result.incomparable_reasons).toEqual(["PROMPT_COMMITMENT_MISMATCH"]);
    expect(result.passed).toBeNull();
  });

  test("incompatible unit never compares", () => {
    const result = compareRegression(reference(), candidate({ unit: "RATIO" }));
    expect(result.incomparable_reasons).toContain("METRIC_UNIT_MISMATCH");
    expect(result.passed).toBeNull();
  });

  test("reference digest tamper rejects", () => {
    const tampered = semanticClone(reference()) as unknown as {
      value: number;
    } & RegressionReferenceV1;
    tampered.value = 0.9;
    expectCode(
      () => compareRegression(tampered, candidate()),
      "RUNNER_REGRESSION_REFERENCE_TAMPER",
    );
  });

  test("malformed reference digest rejects", () => {
    const malformed = {
      ...reference(),
      reference_digest: "sha256:not-a-digest",
    } as RegressionReferenceV1;
    expectCode(
      () => compareRegression(malformed, candidate()),
      "RUNNER_REGRESSION_DIGEST",
    );
  });

  test("both candidate and reviewed reference provenance digests are reported", () => {
    const result = compareRegression(reference(), candidate());
    expect(result.candidate_provenance_digest).toBe(digest("7"));
    expect(result.reference_provenance_digest).toBe(digest("6"));
    expect(result.reference_digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  test("derived comparison validation rejects a caller-flipped pass result", () => {
    const clean = compareRegression(reference(), candidate());
    expect(() => {
      validateRegressionComparison(clean);
    }).not.toThrow();
    const mutant = { ...clean, passed: false };
    expectCode(() => {
      validateRegressionComparison(mutant);
    }, "RUNNER_REGRESSION_DERIVATION");
  });

  test("derived comparison validation rejects a missing raw denominator", () => {
    const clean = compareRegression(reference(), candidate());
    const mutant = semanticClone(clean) as unknown as {
      candidate_raw_denominator?: number;
    };
    delete mutant.candidate_raw_denominator;
    expectCode(() => {
      validateRegressionComparison(mutant);
    }, "RUNNER_REGRESSION_RAW_COUNTS");
  });

  test("regression reference unknown fields reject", () => {
    const mutant = { ...reference(), latest: true };
    expectCode(
      () => compareRegression(mutant, candidate()),
      "RUNNER_REGRESSION_STRUCTURE",
    );
  });
});
