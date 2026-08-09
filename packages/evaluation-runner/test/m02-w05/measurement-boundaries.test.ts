import { describe, expect, test } from "vitest";

import {
  MAX_FIXED_REPORT_LIMITATIONS,
  MAX_REPORT_LIMITATIONS,
  MAX_USER_LIMITATIONS,
  aggregateCaseResults,
  buildRunReport,
  renderReportBundle,
  runEvaluation,
  validateRunReport,
  validateUtcInstantText,
  type CaseExecutionRecordV1,
  type EvaluationRunnerError,
  type RunnerClockV1,
} from "../../src/index.ts";
import {
  adapterReturning,
  makeCase,
  makeObservation,
  makeRequest,
  required,
  runCases,
  semanticClone,
  trustedContext,
} from "./support/fixtures.ts";

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

async function expectAsyncCode(
  action: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action;
  } catch (error: unknown) {
    expect((error as EvaluationRunnerError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

class SequenceClock implements RunnerClockV1 {
  public readonly identity = "fixed_clock_v1";
  public readonly version = "1.0.0";
  private index = 0;

  public constructor(private readonly values: readonly string[]) {}

  public now(): string {
    const value = this.values[this.index];
    this.index += 1;
    if (value === undefined) {
      throw new Error("sequence clock exhausted");
    }
    return value;
  }
}

function runWithClock(clock: RunnerClockV1) {
  const request = makeRequest([makeCase()]);
  return runEvaluation(
    request,
    adapterReturning((benchmarkCase) => makeObservation(benchmarkCase)),
    clock,
    trustedContext(request),
  );
}

describe("failed-setup measurement boundary", () => {
  test("paired counts reject at the raw adapter observation boundary", async () => {
    await expectAsyncCode(
      runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          status: "FAILED_SETUP",
          pairedCounts: [
            {
              group_id: "FIELD_DECISIONS",
              true_positive: 7,
              false_positive: 1,
              false_negative: 2,
            },
          ],
        }),
      ),
      "RUNNER_SETUP_PAIRED_COUNT_PAYLOAD",
    );
  });

  test("an equivalent modified serialized report rejects during replay", async () => {
    const clean = buildRunReport(
      await runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, { status: "FAILED_SETUP" }),
      ),
    );
    const mutant = semanticClone(clean) as unknown as {
      cases: { paired_counts: unknown[] }[];
      replay_witness: {
        case_witnesses: { observation: { paired_counts: unknown[] } }[];
      };
    };
    const forgedCounts = [
      {
        group_id: "FIELD_DECISIONS",
        true_positive: 7,
        false_positive: 1,
        false_negative: 2,
      },
    ];
    required(mutant.cases[0], "failed-setup record").paired_counts =
      forgedCounts;
    required(
      mutant.replay_witness.case_witnesses[0],
      "failed-setup witness",
    ).observation.paired_counts = forgedCounts;
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_AGGREGATE_SETUP_PAIRED_COUNTS");
  });

  test("a witness-only paired-count forgery rejects at the shared boundary", async () => {
    const clean = buildRunReport(
      await runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, { status: "FAILED_SETUP" }),
      ),
    );
    const mutant = semanticClone(clean) as unknown as {
      replay_witness: {
        case_witnesses: { observation: { paired_counts: unknown[] } }[];
      };
    };
    required(
      mutant.replay_witness.case_witnesses[0],
      "failed-setup witness",
    ).observation.paired_counts = [
      {
        group_id: "FIELD_DECISIONS",
        true_positive: 7,
        false_positive: 1,
        false_negative: 2,
      },
    ];
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_SETUP_PAIRED_COUNT_PAYLOAD");
  });

  test("aggregation rejects a failed-setup record carrying paired counts", async () => {
    const complete = required(
      (
        await runCases([makeCase()], (benchmarkCase) =>
          makeObservation(benchmarkCase, {
            pairedCounts: [
              {
                group_id: "FIELD_DECISIONS",
                true_positive: 7,
                false_positive: 1,
                false_negative: 2,
              },
            ],
          }),
        )
      ).records[0],
      "complete paired record",
    );
    const forged = semanticClone(complete) as unknown as {
      completeness_state: string;
    };
    forged.completeness_state = "FAILED_SETUP";
    expectCode(
      () => aggregateCaseResults([forged as unknown as CaseExecutionRecordV1]),
      "RUNNER_AGGREGATE_SETUP_PAIRED_COUNTS",
    );
  });

  test("failed setup contributes no precision or recall to the aggregate", async () => {
    const measured = makeCase({ index: 1 });
    const failed = makeCase({ index: 2 });
    const execution = await runCases([measured, failed], (benchmarkCase) =>
      benchmarkCase.case_id === failed.case_id
        ? makeObservation(benchmarkCase, { status: "FAILED_SETUP" })
        : makeObservation(benchmarkCase, {
            pairedCounts: [
              {
                group_id: "FIELD_DECISIONS",
                true_positive: 2,
                false_positive: 1,
                false_negative: 1,
              },
            ],
          }),
    );
    const summaries = aggregateCaseResults(
      execution.records,
    ).precision_recall_summaries;
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      true_positive: 2,
      false_positive: 1,
      false_negative: 1,
    });
    expect(
      execution.records.find((record) => record.case_id === failed.case_id)
        ?.canonical_result,
    ).toBeUndefined();
  });
});

describe("shared contract-authoritative UTC instants", () => {
  test.each([
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-00-01T00:00:00Z",
    "2026-01-00T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-08-09T00:00:00z",
    "2026-08-09T00:00:00+02:00",
    "2026-08-09T24:00:00Z",
    "2026-08-09T12:00:60Z",
  ])("calendar-invalid instant rejects: %s", (text) => {
    expectCode(
      () => validateUtcInstantText(text, "/test"),
      "RUNNER_CLOCK_TIMESTAMP",
    );
  });

  test.each([
    "2024-02-29T00:00:00Z",
    "2026-08-09T12:34:56Z",
    "2026-08-09T12:34:56.123456789Z",
    "2026-06-30T23:59:60Z",
  ])("contract-accepted instant remains accepted: %s", (text) => {
    expect(validateUtcInstantText(text, "/test")).toBe(text);
  });

  test("a February 30 execution clock rejects", async () => {
    await expectAsyncCode(
      runWithClock(
        new SequenceClock(["2026-02-30T00:00:00Z", "2026-02-30T00:00:01Z"]),
      ),
      "RUNNER_CLOCK_TIMESTAMP",
    );
  });

  test("a February 30 instant rejects during report replay", async () => {
    const clean = buildRunReport(await runCases([makeCase()]));
    const mutant = semanticClone(clean) as unknown as {
      replay_witness: {
        case_witnesses: { started_at: string; ended_at: string }[];
      };
    };
    const witnessed = required(
      mutant.replay_witness.case_witnesses[0],
      "case witness",
    );
    witnessed.started_at = "2026-02-30T00:00:00Z";
    witnessed.ended_at = "2026-02-30T00:00:01Z";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_CLOCK_TIMESTAMP");
  });

  test("identical semantics apply to COMPLETE, PARTIAL, and FAILED_SETUP", async () => {
    const partialCase = makeCase({
      thresholds: [
        {
          metric_id: "FIRST_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "SECOND_METRIC",
          comparator: "EXACT",
          expected_value: 2,
          unit: "COUNT",
        },
      ],
    });
    const observations = {
      COMPLETE: (benchmarkCase: Parameters<typeof makeObservation>[0]) =>
        makeObservation(benchmarkCase),
      PARTIAL: () =>
        makeObservation(partialCase, {
          status: "PARTIAL",
          metrics: [
            { metric_id: "FIRST_METRIC", measured_value: 1, unit: "COUNT" },
          ],
        }),
      FAILED_SETUP: (benchmarkCase: Parameters<typeof makeObservation>[0]) =>
        makeObservation(benchmarkCase, { status: "FAILED_SETUP" }),
    } as const;
    for (const [status, produce] of Object.entries(observations)) {
      const benchmarkCase = status === "PARTIAL" ? partialCase : makeCase();
      const request = makeRequest([benchmarkCase]);
      await expectAsyncCode(
        runEvaluation(
          request,
          adapterReturning(produce),
          new SequenceClock(["2026-02-30T00:00:00Z", "2026-02-30T00:00:01Z"]),
          trustedContext(request),
        ),
        "RUNNER_CLOCK_TIMESTAMP",
      );
    }
  });

  test("a valid leap day passes end to end", async () => {
    const execution = await runWithClock(
      new SequenceClock(["2024-02-29T00:00:00Z", "2024-02-29T00:00:01Z"]),
    );
    expect(execution.records[0]?.duration_ms).toBe(1000);
    expect(() => {
      validateRunReport(semanticClone(buildRunReport(execution)));
    }).not.toThrow();
  });

  test("the corpus leap-second control passes end to end", async () => {
    const execution = await runWithClock(
      new SequenceClock(["2026-06-30T23:59:59Z", "2026-06-30T23:59:60Z"]),
    );
    expect(execution.records[0]?.started_at).toBe("2026-06-30T23:59:59Z");
    expect(execution.records[0]?.ended_at).toBe("2026-06-30T23:59:60Z");
    expect(execution.records[0]?.duration_ms).toBe(1000);
    expect(() => {
      validateRunReport(semanticClone(buildRunReport(execution)));
    }).not.toThrow();
  });

  test("fractional instants keep deterministic millisecond durations", async () => {
    const execution = await runWithClock(
      new SequenceClock([
        "2026-08-07T20:00:00.123456789Z",
        "2026-08-07T20:00:01.123456789Z",
      ]),
    );
    expect(execution.records[0]?.duration_ms).toBe(1000);
  });
});

describe("shared limitation bounds", () => {
  const userLimitations = Array.from(
    { length: MAX_USER_LIMITATIONS },
    (_, index) =>
      `Public synthetic development limitation ${String(index + 1)} recorded for the maximal-count boundary proof.`,
  );

  test("shared constants bind the request and report boundaries together", () => {
    expect(MAX_USER_LIMITATIONS).toBe(32);
    expect(MAX_FIXED_REPORT_LIMITATIONS).toBe(3);
    expect(MAX_REPORT_LIMITATIONS).toBe(
      MAX_USER_LIMITATIONS + MAX_FIXED_REPORT_LIMITATIONS,
    );
  });

  test("a 32-user-limitation request produces a 35-limitation report", async () => {
    const execution = await runCases([makeCase()], undefined, {
      limitations: userLimitations.slice(1),
    });
    expect(execution.output_policy.limitations).toHaveLength(
      MAX_USER_LIMITATIONS,
    );
    const report = buildRunReport(execution);
    expect(report.limitations).toHaveLength(MAX_REPORT_LIMITATIONS);
    expect(report.limitations.slice(MAX_FIXED_REPORT_LIMITATIONS)).toEqual(
      execution.output_policy.limitations,
    );
    const bundle = renderReportBundle(report);
    expect(() => {
      validateRunReport(JSON.parse(bundle.json));
    }).not.toThrow();
  });

  test("a 33-user-limitation request rejects", async () => {
    await expectAsyncCode(
      runCases([makeCase()], undefined, {
        limitations: userLimitations,
      }),
      "RUNNER_LIMITATION_COUNT",
    );
  });

  test.each([
    ["removal", (limitations: string[]): string[] => limitations.slice(1)],
    [
      "replacement",
      (limitations: string[]): string[] => [
        "This runner is fully authoritative for critical gates.",
        ...limitations.slice(1),
      ],
    ],
    [
      "reorder",
      (limitations: string[]): string[] => [
        ...(limitations[1] === undefined ? [] : [limitations[1]]),
        ...(limitations[0] === undefined ? [] : [limitations[0]]),
        ...limitations.slice(2),
      ],
    ],
    [
      "invention",
      (limitations: string[]): string[] => [
        ...limitations,
        "Invented limitation that the canonical request never committed.",
      ],
    ],
  ])(
    "fixed limitation %s rejects during report replay",
    async (_label, mutate) => {
      const clean = buildRunReport(await runCases([makeCase()]));
      const mutant = semanticClone(clean) as unknown as {
        limitations: string[];
      };
      mutant.limitations = mutate([...mutant.limitations]);
      expectCode(() => {
        validateRunReport(mutant);
      }, "RUNNER_REPORT_REPLAY_MISMATCH");
    },
  );
});
