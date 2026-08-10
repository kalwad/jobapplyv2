import { describe, expect, test } from "vitest";

import {
  MAX_FIXED_REPORT_LIMITATIONS,
  MAX_REPORT_LIMITATIONS,
  MAX_USER_LIMITATIONS,
  aggregateCaseResults,
  buildRunReport,
  deriveDurationMilliseconds,
  renderReportBundle,
  runEvaluation,
  utcInstantEpochMilliseconds,
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

  test("the leap-second instant projects to the next minute boundary end to end", async () => {
    // Documented leap-table-free Unix-style projection: second 60 shares the
    // epoch millisecond of the following 00:00:00, so this duration is 0.
    const execution = await runWithClock(
      new SequenceClock(["2026-06-30T23:59:60Z", "2026-07-01T00:00:00Z"]),
    );
    expect(execution.records[0]?.duration_ms).toBe(0);
    expect(() => {
      validateRunReport(semanticClone(buildRunReport(execution)));
    }).not.toThrow();
  });
});

describe("proleptic-Gregorian whole-domain UTC projection", () => {
  // Test-only reference calendar. Deliberately structured unlike the
  // implementation: leap days are accumulated by direct per-year iteration
  // instead of closed-form division, so a shared arithmetic mistake cannot
  // hide in both sides.
  function referenceIsLeap(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  const REFERENCE_MONTH_LENGTHS = [
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ] as const;
  const referenceCumulativeYearDays: number[] = [0];
  for (let year = 0; year < 10_000; year += 1) {
    referenceCumulativeYearDays.push(
      (referenceCumulativeYearDays[year] ?? 0) +
        (referenceIsLeap(year) ? 366 : 365),
    );
  }
  function referenceEpochMilliseconds(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): number {
    let dayOfYear = 0;
    for (let m = 1; m < month; m += 1) {
      dayOfYear += REFERENCE_MONTH_LENGTHS[m - 1] ?? 0;
      if (m === 2 && referenceIsLeap(year)) {
        dayOfYear += 1;
      }
    }
    dayOfYear += day - 1;
    const epochDays =
      (referenceCumulativeYearDays[year] ?? 0) +
      dayOfYear -
      (referenceCumulativeYearDays[1970] ?? 0);
    return (
      epochDays * 86_400_000 +
      hour * 3_600_000 +
      minute * 60_000 +
      second * 1_000
    );
  }
  function pad(value: number, width: number): string {
    return String(value).padStart(width, "0");
  }
  function instantText(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): string {
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}Z`;
  }

  test.each([
    "0000-01-01T00:00:00Z",
    "0000-02-29T00:00:00Z",
    "0001-01-01T00:00:00Z",
    "0004-02-29T00:00:00Z",
    "0099-12-31T23:59:59Z",
    "0100-01-01T00:00:00Z",
    "0400-02-29T00:00:00Z",
    "2000-02-29T00:00:00Z",
    "9999-12-31T23:59:59Z",
  ])(
    "contract-valid low- and high-year instant remains accepted: %s",
    (text) => {
      expect(validateUtcInstantText(text, "/test")).toBe(text);
    },
  );

  test.each([
    "0001-02-29T00:00:00Z",
    "0100-02-29T00:00:00Z",
    "1900-02-29T00:00:00Z",
  ])("century and common-year leap days remain rejected: %s", (text) => {
    expectCode(
      () => validateUtcInstantText(text, "/test"),
      "RUNNER_CLOCK_TIMESTAMP",
    );
  });

  test("reviewed literal epoch anchors hold across the year domain", () => {
    // Literal expected values reviewed against an external proleptic
    // Gregorian calculation; the production arithmetic is never its own
    // oracle here.
    const anchors: readonly [string, number][] = [
      ["0000-01-01T00:00:00Z", -62_167_219_200_000],
      ["0000-02-29T00:00:00Z", -62_162_121_600_000],
      ["0000-03-01T12:00:00Z", -62_161_992_000_000],
      ["0001-01-01T00:00:00Z", -62_135_596_800_000],
      ["0099-12-31T23:59:59Z", -59_011_459_201_000],
      ["0100-01-01T00:00:00Z", -59_011_459_200_000],
      ["1970-01-01T00:00:00Z", 0],
      ["2000-02-29T00:00:00Z", 951_782_400_000],
      ["9999-12-31T23:59:59Z", 253_402_300_799_000],
    ];
    for (const [text, expected] of anchors) {
      expect(utcInstantEpochMilliseconds(text, "/test")).toBe(expected);
      expect(Number.isSafeInteger(expected)).toBe(true);
    }
  });

  test("the complete 0000-9999 domain matches the independent reference", () => {
    for (let year = 0; year < 10_000; year += 1) {
      const samples: [number, number][] = [
        [1, 1],
        [2, 28],
        [3, 1],
        [12, 31],
      ];
      if (referenceIsLeap(year)) {
        samples.push([2, 29]);
      }
      for (const [month, day] of samples) {
        const text = instantText(year, month, day, 12, 34, 56);
        expect(utcInstantEpochMilliseconds(text, "/test")).toBe(
          referenceEpochMilliseconds(year, month, day, 12, 34, 56),
        );
      }
      // Second 60 at every year-end 23:59Z projects onto the next minute
      // boundary under the documented leap-table-free Unix-style mapping.
      const yearEndLeapSecond = utcInstantEpochMilliseconds(
        instantText(year, 12, 31, 23, 59, 60),
        "/test",
      );
      const nextMinuteBoundary =
        year < 9_999
          ? utcInstantEpochMilliseconds(
              instantText(year + 1, 1, 1, 0, 0, 0),
              "/test",
            )
          : referenceEpochMilliseconds(9_999, 12, 31, 23, 59, 60);
      expect(yearEndLeapSecond).toBe(nextMinuteBoundary);
    }
  });

  test.each([
    ["0000-01-01T00:00:00Z", "0000-01-01T00:00:01Z", 1_000],
    ["0000-02-28T00:00:00Z", "0000-02-29T00:00:00Z", 86_400_000],
    ["0000-02-29T00:00:00Z", "0000-03-01T00:00:00Z", 86_400_000],
    ["0099-12-31T23:59:59Z", "0100-01-01T00:00:00Z", 1_000],
    ["0100-02-28T00:00:00Z", "0100-03-01T00:00:00Z", 86_400_000],
    ["0400-02-28T00:00:00Z", "0400-02-29T00:00:00Z", 86_400_000],
    ["0400-02-29T00:00:00Z", "0400-03-01T00:00:00Z", 86_400_000],
    ["1900-02-28T00:00:00Z", "1900-03-01T00:00:00Z", 86_400_000],
    ["2000-02-28T00:00:00Z", "2000-02-29T00:00:00Z", 86_400_000],
    ["2000-02-29T00:00:00Z", "2000-03-01T00:00:00Z", 86_400_000],
    ["9999-12-31T23:59:58Z", "9999-12-31T23:59:59Z", 1_000],
  ])(
    "calendar-boundary duration %s -> %s is exactly %d ms",
    (started, ended, expected) => {
      expect(deriveDurationMilliseconds(started, ended, "/test")).toBe(
        expected,
      );
    },
  );

  test("the 36-hour year-zero window rejects from its true duration end to end", async () => {
    // Contract-valid 0000-02-29T00:00:00Z -> 0000-03-01T12:00:00Z spans
    // 129600000 ms; it must reject against the 86400000 ms bound instead of
    // being remapped into a 12-hour 1900 window.
    await expectAsyncCode(
      runWithClock(
        new SequenceClock(["0000-02-29T00:00:00Z", "0000-03-01T12:00:00Z"]),
      ),
      "RUNNER_CLOCK_DURATION",
    );
  });

  test("low-year execution and report replay derive identical duration truth", async () => {
    const execution = await runWithClock(
      new SequenceClock(["0099-12-31T23:59:59Z", "0100-01-01T00:00:00Z"]),
    );
    expect(execution.records[0]?.duration_ms).toBe(1000);
    expect(execution.records[0]?.canonical_result?.duration_ms).toBe(1000);
    const report = buildRunReport(execution);
    expect(report.cases[0]?.duration_ms).toBe(1000);
    expect(() => {
      validateRunReport(semanticClone(report));
    }).not.toThrow();
  });

  test("fractional low-year instants keep deterministic millisecond truncation", async () => {
    const execution = await runWithClock(
      new SequenceClock([
        "0000-01-01T00:00:00.123456789Z",
        "0000-01-01T00:00:01.123456789Z",
      ]),
    );
    expect(execution.records[0]?.duration_ms).toBe(1000);
    expect(
      deriveDurationMilliseconds(
        "0000-01-01T00:00:00.9999Z",
        "0000-01-01T00:00:01Z",
        "/test",
      ),
    ).toBe(1);
    // Short fractions pad to milliseconds (.5 is 500 ms, .05 is 50 ms),
    // never re-scale (.5 must not become 5 ms).
    const base = utcInstantEpochMilliseconds("0000-01-01T00:00:00Z", "/test");
    expect(utcInstantEpochMilliseconds("0000-01-01T00:00:00.5Z", "/test")).toBe(
      base + 500,
    );
    expect(
      utcInstantEpochMilliseconds("0000-01-01T00:00:00.05Z", "/test"),
    ).toBe(base + 50);
    expect(
      deriveDurationMilliseconds(
        "0000-01-01T00:00:00.5Z",
        "0000-01-01T00:00:01.5Z",
        "/test",
      ),
    ).toBe(1000);
  });

  test("a witness-only low-year timestamp edit rejects during replay", async () => {
    const clean = buildRunReport(
      await runWithClock(
        new SequenceClock(["0000-01-01T00:00:00Z", "0000-01-01T00:00:01Z"]),
      ),
    );
    const mutant = semanticClone(clean) as unknown as {
      replay_witness: {
        case_witnesses: { started_at: string; ended_at: string }[];
      };
    };
    const witnessed = required(
      mutant.replay_witness.case_witnesses[0],
      "low-year case witness",
    );
    witnessed.started_at = "0000-01-01T00:01:00Z";
    witnessed.ended_at = "0000-01-01T00:01:01Z";
    expectCode(() => {
      validateRunReport(mutant);
    }, "RUNNER_REPORT_REPLAY_MISMATCH");
  });

  test("a low-year semantic timestamp change changes the replayed report truth", async () => {
    const first = renderReportBundle(
      buildRunReport(
        await runWithClock(
          new SequenceClock(["0000-01-01T00:00:00Z", "0000-01-01T00:00:01Z"]),
        ),
      ),
    );
    const shifted = renderReportBundle(
      buildRunReport(
        await runWithClock(
          new SequenceClock(["0000-01-01T00:00:00Z", "0000-01-01T00:00:02Z"]),
        ),
      ),
    );
    const identical = renderReportBundle(
      buildRunReport(
        await runWithClock(
          new SequenceClock(["0000-01-01T00:00:00Z", "0000-01-01T00:00:01Z"]),
        ),
      ),
    );
    expect(shifted.json).not.toBe(first.json);
    expect(identical.json).toBe(first.json);
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
