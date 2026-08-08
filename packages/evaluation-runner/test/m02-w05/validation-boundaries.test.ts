import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  canonicalJsonBytes,
  computeThresholdSetDigest,
  loadCanonicalExecutionRequestFile,
  parseCanonicalExecutionRequestJson,
  runEvaluation,
  sha256Canonical,
  validateExecutionRequest,
  validateLocalArtifactReference,
  type EvaluationRunnerError,
} from "../../src/index.ts";
import {
  adapterReturning,
  digest,
  FixedClock,
  makeCase,
  makeObservation,
  makeRequest,
  required,
  semanticClone,
  trustedContext,
} from "./support/fixtures.ts";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-evaluation-runner-"));
  temporaryRoots.push(root);
  return root;
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

describe("strict execution-request boundary", () => {
  test("canonical positive request validates without mutation", () => {
    const request = makeRequest([makeCase()]);
    const before = canonicalJsonBytes(request);
    const validated = validateExecutionRequest(request);
    expect(canonicalJsonBytes(validated)).toBe(before);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.cases[0]?.thresholds)).toBe(true);
  });

  test("unknown top-level field rejects", () => {
    const request = {
      ...makeRequest([makeCase()]),
      gate_state: "PASS",
    };
    expectCode(() => validateExecutionRequest(request), "RUNNER_UNKNOWN_FIELD");
  });

  test("duplicate case IDs reject", () => {
    const benchmarkCase = makeCase();
    const request = makeRequest([benchmarkCase, benchmarkCase]);
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_DUPLICATE_CASE_COMMITMENT",
    );
  });

  test("duplicate threshold metric IDs reject through contract semantics", () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "DUPLICATE_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
        {
          metric_id: "DUPLICATE_METRIC",
          comparator: "EXACT",
          expected_value: 1,
          unit: "COUNT",
        },
      ],
    });
    expectCode(
      () => validateExecutionRequest(makeRequest([benchmarkCase])),
      "RUNNER_BENCHMARK_CASE_SEMANTIC",
    );
  });

  test("unsupported metric unit rejects through authoritative case schema", () => {
    const raw = semanticClone(makeCase()) as unknown as {
      thresholds: { unit: string }[];
      threshold_set_digest: string;
    };
    required(raw.thresholds[0], "unsupported-unit threshold").unit = "PERCENT";
    raw.threshold_set_digest = computeThresholdSetDigest(raw as never);
    const request = makeRequest([raw as never]);
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_BENCHMARK_CASE_STRUCTURE",
    );
  });

  test("case digest mismatch rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      case_commitments: { case_digest: string }[];
    };
    required(
      request.case_commitments[0],
      "case digest commitment",
    ).case_digest = digest("f");
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_CASE_DIGEST_MISMATCH",
    );
  });

  test("threshold digest mismatch rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      cases: { threshold_set_digest: string }[];
      case_commitments: { case_digest: string }[];
    };
    required(request.cases[0], "threshold digest case").threshold_set_digest =
      digest("f");
    required(
      request.case_commitments[0],
      "threshold digest commitment",
    ).case_digest = sha256Canonical(request.cases[0]);
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_THRESHOLD_DIGEST_MISMATCH",
    );
  });

  test("corpus mismatch rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      corpus: { digest: string };
    };
    request.corpus.digest = digest("a");
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_CORPUS_MISMATCH",
    );
  });

  test("runtime commitment mismatch rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      runtime_commitment_digest: string;
    };
    request.runtime_commitment_digest = digest("a");
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_RUNTIME_DIGEST_MISMATCH",
    );
  });

  test.each([
    ["commit", "abc"],
    ["tree", "A".repeat(40)],
  ] as const)("malformed repository %s rejects", (field, value) => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      repository: Record<string, string>;
    };
    request.repository[field] = value;
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_GIT_OBJECT_FORMAT",
    );
  });

  test("malformed content digest rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      schema: { manifest_digest: string };
    };
    request.schema.manifest_digest = "sha256:1234";
    expectCode(() => validateExecutionRequest(request), "RUNNER_DIGEST_FORMAT");
  });

  test("pre-W06 development mode rejects hidden cases", () => {
    const benchmarkCase = makeCase({
      holdoutVisibility: "OWNER_CONTROLLED_HIDDEN",
    });
    expectCode(
      () => validateExecutionRequest(makeRequest([benchmarkCase])),
      "RUNNER_DEVELOPMENT_HOLDOUT_SCOPE",
    );
  });

  test("wrong pre-W06 development commitment rejects", () => {
    const request = semanticClone(makeRequest([makeCase()])) as unknown as {
      holdout: { development_commitment_digest: string };
    };
    request.holdout.development_commitment_digest = digest("a");
    expectCode(
      () => validateExecutionRequest(request),
      "RUNNER_DEVELOPMENT_HOLDOUT_COMMITMENT",
    );
  });

  test.each([
    { command: "rm" },
    { shell: "bash" },
    { callback: "source code" },
    { endpoint: "remote" },
    { credential: "secret" },
    { employer_url: "live" },
    { gate_pass: true },
  ])("serialized executable/authority member rejects: %j", (extra) => {
    const request = {
      ...makeRequest([makeCase()]),
      adapter: { ...makeRequest([makeCase()]).adapter, ...extra },
    };
    expectCode(() => validateExecutionRequest(request), "RUNNER_UNKNOWN_FIELD");
  });

  test.each([
    "https://employer.example/apply",
    "password=not-allowed",
    "api_key: not-allowed",
    "local output at /Users/example/private/report.json",
    "local output at C:\\private\\report.json",
  ])("remote or credential-shaped report input rejects: %s", (text) => {
    expectCode(
      () =>
        validateExecutionRequest(
          makeRequest([makeCase()], { limitations: [text] }),
        ),
      "RUNNER_REPORT_TEXT_BOUNDARY",
    );
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, "0.8"])(
    "NaN, Infinity, and coercion reject: %s",
    async (value) => {
      const benchmarkCase = makeCase();
      await expectAsyncCode(
        runEvaluation(
          makeRequest([benchmarkCase]),
          adapterReturning((entry) => {
            const observation = semanticClone(
              makeObservation(entry),
            ) as unknown as {
              metrics: { measured_value: unknown }[];
            };
            required(
              observation.metrics[0],
              "mutated metric observation",
            ).measured_value = value;
            return observation as never;
          }),
          new FixedClock(),
          trustedContext(),
        ),
        "RUNNER_METRIC_VALUE",
      );
    },
  );

  test("proportion raw counts must equal the measured ratio exactly", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "PROPORTION_RATIO",
          comparator: "AT_LEAST",
          expected_value: 0,
          unit: "RATIO",
        },
      ],
    });
    await expectAsyncCode(
      runEvaluation(
        makeRequest([benchmarkCase]),
        adapterReturning((entry) =>
          makeObservation(entry, {
            metrics: [
              {
                metric_id: "PROPORTION_RATIO",
                measured_value: 0.5,
                unit: "RATIO",
                proportion_counts: { numerator: 1, denominator: 3 },
              },
            ],
          }),
        ),
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_PROPORTION_VALUE_MISMATCH",
    );
  });

  test("proportion counts reject on a non-ratio metric", async () => {
    const benchmarkCase = makeCase();
    await expectAsyncCode(
      runEvaluation(
        makeRequest([benchmarkCase]),
        adapterReturning((entry) =>
          makeObservation(entry, {
            metrics: [
              {
                metric_id: "QUALITY_SCORE",
                measured_value: 0.8,
                unit: "SCORE",
                proportion_counts: { numerator: 4, denominator: 5 },
              },
            ],
          }),
        ),
        new FixedClock(),
        trustedContext(),
      ),
      "RUNNER_PROPORTION_UNIT",
    );
  });

  test("a zero-denominator proportion remains explicit and not applicable", async () => {
    const benchmarkCase = makeCase({
      thresholds: [
        {
          metric_id: "EMPTY_PROPORTION",
          comparator: "EXACT",
          expected_value: 0,
          unit: "RATIO",
        },
      ],
    });
    const execution = await runEvaluation(
      makeRequest([benchmarkCase]),
      adapterReturning((entry) =>
        makeObservation(entry, {
          metrics: [
            {
              metric_id: "EMPTY_PROPORTION",
              measured_value: 0,
              unit: "RATIO",
              proportion_counts: { numerator: 0, denominator: 0 },
            },
          ],
        }),
      ),
      new FixedClock(),
      trustedContext(),
    );
    expect(execution.records[0]?.threshold_results[0]?.proportion).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
  });
});

describe("canonical JSON and regular local file boundary", () => {
  test("canonical JSON parses and validates", () => {
    const request = makeRequest([makeCase()]);
    expect(
      parseCanonicalExecutionRequestJson(canonicalJsonBytes(request)),
    ).toEqual(request);
  });

  test("noncanonical numeric text rejects", () => {
    const canonical = canonicalJsonBytes(makeRequest([makeCase()]));
    const noncanonical = canonical.replace(
      '"expected_value":0.8',
      '"expected_value":8e-1',
    );
    expect(noncanonical).not.toBe(canonical);
    expectCode(
      () => parseCanonicalExecutionRequestJson(noncanonical),
      "RUNNER_NONCANONICAL_JSON",
    );
  });

  test("duplicate JSON key rejects via canonical-byte mismatch", () => {
    const canonical = canonicalJsonBytes(makeRequest([makeCase()]));
    const duplicate = canonical.replace(
      '"runner_format_version":"1.0.0"',
      '"runner_format_version":"1.0.0","runner_format_version":"1.0.0"',
    );
    expectCode(
      () => parseCanonicalExecutionRequestJson(duplicate),
      "RUNNER_NONCANONICAL_JSON",
    );
  });

  test("regular local canonical file loads", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "requests"));
    writeFileSync(
      join(root, "requests", "run.json"),
      canonicalJsonBytes(makeRequest([makeCase()])),
    );
    expect(
      loadCanonicalExecutionRequestFile(root, "requests/run.json")
        .runner_format_version,
    ).toBe("1.0.0");
  });

  test("symlink input rejects", () => {
    const root = temporaryRoot();
    writeFileSync(
      join(root, "real.json"),
      canonicalJsonBytes(makeRequest([makeCase()])),
    );
    symlinkSync(join(root, "real.json"), join(root, "link.json"), "file");
    expectCode(
      () => loadCanonicalExecutionRequestFile(root, "link.json"),
      "RUNNER_INPUT_SYMLINK",
    );
  });

  test("nonregular final input rejects", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "directory.json"));
    expectCode(
      () => loadCanonicalExecutionRequestFile(root, "directory.json"),
      "RUNNER_INPUT_FILE_TYPE",
    );
  });

  test("invalid UTF-8 request bytes reject instead of replacement decoding", () => {
    const root = temporaryRoot();
    writeFileSync(join(root, "invalid.json"), Buffer.from([0xff, 0xfe]));
    expectCode(
      () => loadCanonicalExecutionRequestFile(root, "invalid.json"),
      "RUNNER_INPUT_ENCODING",
    );
  });

  test.each([
    "../outside.json",
    "/absolute.json",
    "C:\\absolute.json",
    "https://example.test/run.json",
    "file:///tmp/run.json",
    "a/../../run.json",
    "requests/%2e%2e/run.json",
    "requests/CON.json",
    "requests/trailing. ",
  ])("unsafe local reference rejects: %s", (reference) => {
    expectCode(
      () => validateLocalArtifactReference(reference),
      "RUNNER_LOCAL_REFERENCE",
    );
  });
});
