import { describe, expect, test } from "vitest";

import {
  aggregateCaseResults,
  buildRunReport,
  canonicalJson,
  renderReportBundle,
  sha256Bytes,
  validateRunReport,
  type EvaluationRunnerError,
  type RunReportV1,
} from "../../src/index.ts";
import {
  makeCase,
  makeObservation,
  required,
  runCases,
  semanticClone,
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

async function reportWithHostileText(): Promise<RunReportV1> {
  const execution = await runCases(
    [makeCase()],
    (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        pairedCounts: [
          {
            group_id: "FIELD_DECISIONS",
            true_positive: 4,
            false_positive: 1,
            false_negative: 2,
          },
        ],
      }),
    {
      reportTitle: '<script>alert("runner")</script> & report',
      limitations: ['Hostile <img src=x onerror="alert(1)"> is inert text.'],
    },
  );
  return buildRunReport(execution);
}

describe("canonical JSON, Markdown, and standalone HTML projections", () => {
  test("all three outputs are byte-deterministic", async () => {
    const report = await reportWithHostileText();
    const first = renderReportBundle(report);
    const second = renderReportBundle(report);
    expect(second).toEqual(first);
    expect(second.json).toBe(first.json);
    expect(second.markdown).toBe(first.markdown);
    expect(second.html).toBe(first.html);
  });

  test("JSON is the canonical machine truth", async () => {
    const report = await reportWithHostileText();
    const bundle = renderReportBundle(report);
    expect(JSON.parse(bundle.json)).toEqual(JSON.parse(canonicalJson(report)));
    expect(bundle.json.endsWith("\n")).toBe(true);
    expect(bundle.json).not.toContain("\r");
  });

  test("Markdown and HTML carry the mandatory no-gate-authority statement", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    expect(bundle.markdown).toContain(
      "THIS REPORT HAS NO CRITICAL-GATE AUTHORITY",
    );
    expect(bundle.html).toContain("THIS REPORT HAS NO CRITICAL-GATE AUTHORITY");
  });

  test("hostile untrusted text is escaped in both human projections", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    expect(bundle.markdown).not.toContain("<script>");
    expect(bundle.markdown).toContain("&lt;script&gt;");
    expect(bundle.html).not.toMatch(/<script\b/iu);
    expect(bundle.html).not.toMatch(/<img\b/iu);
    expect(bundle.html).toContain("&lt;script&gt;");
    expect(bundle.html).toContain("&lt;img");
  });

  test("Markdown link and structural syntax remains inert text", async () => {
    const report = buildRunReport(
      await runCases([makeCase()], undefined, {
        reportTitle: "[click](javascript:alert(1)) # heading",
        limitations: ["![image](data:text/plain,unsafe) *emphasis*"],
      }),
    );
    const markdown = renderReportBundle(report).markdown;
    expect(markdown).toContain(
      "\\[click\\]\\(javascript:alert\\(1\\)\\) \\# heading",
    );
    expect(markdown).toContain(
      "\\!\\[image\\]\\(data:text/plain,unsafe\\) \\*emphasis\\*",
    );
    expect(markdown).not.toContain("[click](javascript:");
  });

  test("HTML has no remote resource, script, analytics, external font, or hidden content", async () => {
    const html = renderReportBundle(await reportWithHostileText()).html;
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).not.toMatch(/https?:\/\//iu);
    expect(html).not.toMatch(/<script\b/iu);
    expect(html).not.toMatch(/<link\b/iu);
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("analytics");
    expect(html).not.toMatch(/\bhidden\b/iu);
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("@font-face");
  });

  test("raw denominators accompany every displayed percentage", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    expect(bundle.markdown).toContain("100.00% (1/1)");
    expect(bundle.markdown).toContain("80.00% (4/5)");
    expect(bundle.markdown).toContain("66.67% (4/6)");
    expect(bundle.html).toContain("100.00% (1/1)");
  });

  test("threshold, precision/recall, uncertainty, provenance, and limitations share one truth", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    for (const output of [bundle.markdown, bundle.html]) {
      expect(output).toContain("QUALITY_SCORE");
      expect(output).toContain("FIELD_DECISIONS");
      expect(output).toContain("WILSON_SCORE");
      expect(output).toContain("Repository commit");
      expect(output).toContain("Synthetic development data only");
      expect(output).toContain("NOT_APPLICABLE");
    }
  });

  test("case and metric sections sort stably", async () => {
    const first = makeCase({ index: 1 });
    const second = makeCase({ index: 2 });
    const report = buildRunReport(await runCases([second, first]));
    const markdown = renderReportBundle(report).markdown;
    expect(markdown.indexOf(first.case_id)).toBeLessThan(
      markdown.indexOf(second.case_id),
    );
  });

  test("artifact manifest commits exact bytes for all projections", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    expect(
      bundle.manifest.artifacts.map((artifact) => artifact.format),
    ).toEqual(["JSON", "MARKDOWN", "HTML"]);
    expect(bundle.manifest.artifacts[0]?.digest).toBe(sha256Bytes(bundle.json));
    expect(bundle.manifest.artifacts[1]?.digest).toBe(
      sha256Bytes(bundle.markdown),
    );
    expect(bundle.manifest.artifacts[2]?.digest).toBe(sha256Bytes(bundle.html));
    expect(bundle.manifest.artifacts[2]?.byte_count).toBe(
      Buffer.byteLength(bundle.html, "utf8"),
    );
  });

  test("report digest changes on a semantic change", async () => {
    const first = renderReportBundle(await reportWithHostileText());
    const execution = await runCases([makeCase()], (benchmarkCase) =>
      makeObservation(benchmarkCase, {
        metrics: [
          {
            metric_id: "QUALITY_SCORE",
            measured_value: 0.7,
            unit: "SCORE",
          },
        ],
      }),
    );
    const second = renderReportBundle(buildRunReport(execution));
    expect(second.manifest.artifacts[0]?.digest).not.toBe(
      first.manifest.artifacts[0]?.digest,
    );
  });

  test("human renderers display canonical metric truth without recomputation", async () => {
    const report = await reportWithHostileText();
    const metric = report.cases[0]?.threshold_results[0];
    const bundle = renderReportBundle(report);
    expect(metric?.measured_value).toBe(0.8);
    expect(bundle.markdown).toContain(
      "| 0.8 | 0.8 | SCORE | NOT_APPLICABLE | true |",
    );
    expect(bundle.html).toContain(
      "<td>0.8</td><td>0.8</td><td>SCORE</td><td>NOT_APPLICABLE</td><td>true</td>",
    );
  });

  test("outputs contain no environment-specific absolute path", async () => {
    const bundle = renderReportBundle(await reportWithHostileText());
    for (const output of [bundle.json, bundle.markdown, bundle.html]) {
      expect(output).not.toContain("/Users/");
      expect(output).not.toMatch(/[A-Z]:\\/u);
    }
  });
});

describe("report derivation mutation guards", () => {
  test("missing raw denominator rejects", async () => {
    const mutated = semanticClone(await reportWithHostileText()) as unknown as {
      aggregate: { pass_rate: { denominator?: number } };
    };
    delete mutated.aggregate.pass_rate.denominator;
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("precision without paired recall rejects", async () => {
    const mutated = semanticClone(await reportWithHostileText()) as unknown as {
      aggregate: {
        precision_recall_summaries: { recall?: unknown }[];
      };
    };
    delete required(
      mutated.aggregate.precision_recall_summaries[0],
      "precision/recall summary",
    ).recall;
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("omitting a failed or partial case rejects", async () => {
    const partial = makeCase({
      index: 2,
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
    const execution = await runCases(
      [makeCase({ index: 1 }), partial],
      (benchmarkCase) =>
        benchmarkCase.case_id === partial.case_id
          ? makeObservation(benchmarkCase, {
              status: "PARTIAL",
              metrics: [
                {
                  metric_id: "FIRST_METRIC",
                  measured_value: 1,
                  unit: "COUNT",
                },
              ],
            })
          : makeObservation(benchmarkCase),
    );
    const mutated = semanticClone(buildRunReport(execution)) as unknown as {
      cases: unknown[];
    } & RunReportV1;
    mutated.cases.pop();
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("rounding away a zero-tolerance failure rejects", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "SAFETY_FAILURE_COUNT",
          comparator: "AT_MOST",
          expected_value: 0,
          unit: "COUNT",
        },
      ],
    });
    const report = buildRunReport(
      await runCases([benchmarkCase], (entry) =>
        makeObservation(entry, {
          metrics: [
            {
              metric_id: "SAFETY_FAILURE_COUNT",
              measured_value: 1,
              unit: "COUNT",
            },
          ],
        }),
      ),
    );
    const mutated = semanticClone(report) as unknown as {
      aggregate: {
        counts: { zero_tolerance_failure_count: number };
      };
    };
    mutated.aggregate.counts.zero_tolerance_failure_count = 0;
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_DERIVATION_MISMATCH");
  });

  test("environment mismatch cannot be relabeled comparable", async () => {
    const report = buildRunReport(
      await runCases([
        makeCase({ environment: { runtime_profile: "OTHER_RUNTIME" } }),
      ]),
    );
    const mutated = semanticClone(report) as unknown as {
      comparability_banner: string;
    };
    mutated.comparability_banner = "ALL_CASES_COMPARABLE";
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_COMPARABILITY");
  });

  test("case PASS and metric truth cannot be rewritten during report replay", async () => {
    const report = buildRunReport(
      await runCases([makeCase()], (benchmarkCase) =>
        makeObservation(benchmarkCase, {
          metrics: [
            {
              metric_id: "QUALITY_SCORE",
              measured_value: 0.7,
              unit: "SCORE",
            },
          ],
        }),
      ),
    );
    const mutated = semanticClone(report) as unknown as {
      aggregate: RunReportV1["aggregate"];
      cases: {
        overall_outcome: string;
        threshold_results: { passed: boolean }[];
      }[];
    };
    const record = required(mutated.cases[0], "report record");
    record.overall_outcome = "PASS";
    required(record.threshold_results[0], "threshold result").passed = true;
    mutated.aggregate = aggregateCaseResults(
      mutated.cases as unknown as RunReportV1["cases"],
    );
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_CASE_DERIVATION");
  });

  test("nested gate-authority fields cannot hide inside a case record", async () => {
    const mutated = semanticClone(await reportWithHostileText()) as unknown as {
      cases: ({ gate_state?: string } & Record<string, unknown>)[];
    };
    required(mutated.cases[0], "report record").gate_state = "PASS";
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_STRUCTURE");
  });

  test("content-derived record identity cannot be replaced", async () => {
    const mutated = semanticClone(await reportWithHostileText()) as unknown as {
      cases: { record_id: string }[];
    };
    required(mutated.cases[0], "report record").record_id =
      "evalrecord_00000000000000000000000000";
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_IDENTITY");
  });

  test("runtime commitment tamper cannot survive report replay", async () => {
    const mutated = semanticClone(await reportWithHostileText()) as unknown as {
      provenance: { runtime: { runtime_version: string } };
    };
    mutated.provenance.runtime.runtime_version = "24.18.1";
    expectCode(() => {
      validateRunReport(mutated);
    }, "RUNNER_REPORT_PROVENANCE");
  });
});
