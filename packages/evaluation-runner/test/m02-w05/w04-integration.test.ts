import { describe, expect, it } from "vitest";

import {
  caseMatrixDigest,
  computeBaselineManifest,
  DEV_CASE_MATRIX,
  keywordOverlap,
  loadCommittedLegacyObservations,
  naiveKeywordStuffing,
  ONE_SHOT_RESUME_PROMPT,
  originalUntailoredText,
  RESUME_PROMPT_DIGEST,
  resumeFactsProjection,
  runOneShotResumeGeneration,
  type DevCase,
  type OneShotGenerator,
} from "@japp/evaluation-baselines";
import { loadFixtureCorpus } from "@japp/test-fixtures";
import {
  runEvaluation,
  type AdapterObservationV1,
  type EvaluationAdapterV1,
} from "../../src/index.ts";
import {
  FixedClock,
  makeCase,
  makeObservation,
  makeRequest,
  trustedContext,
} from "./support/fixtures.ts";

function selectedCase(kind: DevCase["kind"], scenario: string): DevCase {
  const selected = DEV_CASE_MATRIX.cases.find(
    (entry) => entry.kind === kind && entry.scenario === scenario,
  );
  if (selected === undefined) {
    throw new Error(
      `missing reviewed W04 development case ${kind}/${scenario}`,
    );
  }
  return selected;
}

describe("M02-W05 W04 development integration", () => {
  it("measures a finite public W04 subset without promoting it to W13 or gate evidence", async () => {
    const fixtureCorpus = loadFixtureCorpus();
    const baselineManifest = computeBaselineManifest();
    const matrixDigest = caseMatrixDigest();
    const originalDevCase = selectedCase(
      "ORIGINAL_UNTAILORED",
      "TEXT_IDENTITY",
    );
    const overlapDevCase = selectedCase("KEYWORD_OVERLAP", "NO_OVERLAP");
    const stuffingDevCase = selectedCase(
      "NAIVE_KEYWORD_STUFFING",
      "ONE_MISSING_TERM",
    );
    const oneShotDevCase = selectedCase(
      "ONE_SHOT_RESUME",
      "SUCCESSFUL_DETERMINISTIC_FAKE",
    );
    const legacyRecords = loadCommittedLegacyObservations().records;

    expect(originalDevCase.candidate?.source).toBe("FIXTURE");
    expect(overlapDevCase.candidate?.source).toBe("INLINE");
    expect(overlapDevCase.target?.source).toBe("INLINE");
    expect(stuffingDevCase.candidate?.source).toBe("INLINE");
    expect(stuffingDevCase.target?.source).toBe("INLINE");
    expect(oneShotDevCase.one_shot).toBeDefined();
    expect(legacyRecords.map((record) => record.observation_status)).toEqual([
      "UNAVAILABLE",
      "NOT_ATTEMPTED",
    ]);

    const common = {
      artifactDigest: matrixDigest,
      corpusDigest: fixtureCorpus.manifest.corpus_digest,
      corpusVersion: fixtureCorpus.manifest.corpus_version,
    } as const;
    const cases = [
      makeCase({
        ...common,
        index: 201,
        thresholds: [
          {
            metric_id: "ORIGINAL_BYTE_IDENTICAL",
            comparator: "EXACT",
            expected_value: 1,
            unit: "COUNT",
          },
        ],
      }),
      makeCase({
        ...common,
        index: 202,
        thresholds: [
          {
            metric_id: "MATCHED_TERM_COUNT",
            comparator: "EXACT",
            expected_value: 0,
            unit: "COUNT",
          },
          {
            metric_id: "TARGET_TERM_COUNT",
            comparator: "EXACT",
            expected_value: 3,
            unit: "COUNT",
          },
          {
            metric_id: "OVERLAP_RATIO",
            comparator: "EXACT",
            expected_value: 0,
            unit: "RATIO",
          },
        ],
      }),
      makeCase({
        ...common,
        index: 203,
        thresholds: [
          {
            metric_id: "INSERTED_UNVERIFIED_TERM_COUNT",
            comparator: "EXACT",
            expected_value: 1,
            unit: "COUNT",
          },
          {
            metric_id: "GROUNDED_IN_EVIDENCE",
            comparator: "EXACT",
            expected_value: 0,
            unit: "COUNT",
          },
        ],
      }),
      makeCase({
        ...common,
        index: 204,
        thresholds: [
          {
            metric_id: "ONE_SHOT_CALL_COUNT",
            comparator: "EXACT",
            expected_value: 1,
            unit: "COUNT",
          },
          {
            metric_id: "ONE_SHOT_RETRY_COUNT",
            comparator: "EXACT",
            expected_value: 0,
            unit: "COUNT",
          },
          {
            metric_id: "RAW_OUTPUT_UNVERIFIED",
            comparator: "EXACT",
            expected_value: 1,
            unit: "COUNT",
          },
        ],
      }),
      makeCase({
        ...common,
        index: 205,
        thresholds: [
          {
            metric_id: "CAPTURED_LEGACY_OBSERVATION_COUNT",
            comparator: "AT_LEAST",
            expected_value: 1,
            unit: "COUNT",
          },
        ],
      }),
    ] as const;

    const [originalCase, overlapCase, stuffingCase, oneShotCase, legacyCase] =
      cases;
    const resumeId = oneShotDevCase.one_shot?.resume_id;
    const profileId = oneShotDevCase.one_shot?.profile_id;
    const jobId = oneShotDevCase.one_shot?.job_id;
    const resume = fixtureCorpus.sourceResumes.find(
      (item) => item.id === resumeId,
    );
    const profile = fixtureCorpus.profiles.find(
      (item) => item.id === profileId,
    );
    const job = fixtureCorpus.jobs.find((item) => item.id === jobId);
    if (resume === undefined || profile === undefined || job === undefined) {
      throw new Error(
        "reviewed W04 one-shot development fixture binding is missing",
      );
    }

    let fakeCallCount = 0;
    const deterministicFake: OneShotGenerator = {
      generateOnce() {
        fakeCallCount += 1;
        return Promise.resolve({
          raw_text: "DETERMINISTIC W04 DEVELOPMENT OUTPUT",
        });
      },
    };

    const adapter: EvaluationAdapterV1 = {
      identity: "synthetic_adapter_v1",
      version: "1.0.0",
      async evaluate(benchmarkCase): Promise<AdapterObservationV1> {
        if (benchmarkCase.case_id === originalCase.case_id) {
          const sourceText = resumeFactsProjection(resume);
          const result = originalUntailoredText(sourceText, "RESUME_TEXT");
          expect(result.byte_identical_to_input).toBe(true);
          return makeObservation(benchmarkCase, {
            metrics: [
              {
                metric_id: "ORIGINAL_BYTE_IDENTICAL",
                measured_value: result.candidate_text === sourceText ? 1 : 0,
                unit: "COUNT",
              },
            ],
            reportDigests: [baselineManifest.combined_digest],
          });
        }
        if (benchmarkCase.case_id === overlapCase.case_id) {
          if (
            overlapDevCase.candidate?.source !== "INLINE" ||
            overlapDevCase.target?.source !== "INLINE"
          ) {
            throw new Error("W04 overlap development case is not inline text");
          }
          const result = keywordOverlap(
            overlapDevCase.candidate.text,
            overlapDevCase.target.text,
          );
          return makeObservation(benchmarkCase, {
            metrics: [
              {
                metric_id: "MATCHED_TERM_COUNT",
                measured_value: result.matched_term_count,
                unit: "COUNT",
              },
              {
                metric_id: "TARGET_TERM_COUNT",
                measured_value: result.target_term_count,
                unit: "COUNT",
              },
              {
                metric_id: "OVERLAP_RATIO",
                measured_value: result.score,
                unit: "RATIO",
                proportion_counts: {
                  numerator: result.score_numerator,
                  denominator: result.score_denominator,
                },
              },
            ],
            reportDigests: [baselineManifest.combined_digest],
          });
        }
        if (benchmarkCase.case_id === stuffingCase.case_id) {
          if (
            stuffingDevCase.candidate?.source !== "INLINE" ||
            stuffingDevCase.target?.source !== "INLINE"
          ) {
            throw new Error("W04 stuffing development case is not inline text");
          }
          const result = naiveKeywordStuffing(
            stuffingDevCase.candidate.text,
            stuffingDevCase.target.text,
          );
          expect(result.verification_status).toBe("UNVERIFIED");
          expect(result.classification).toEqual([
            "EVALUATION_ONLY",
            "NON_PRODUCTION",
          ]);
          expect(result.grounded_in_evidence).toBe(false);
          return makeObservation(benchmarkCase, {
            metrics: [
              {
                metric_id: "INSERTED_UNVERIFIED_TERM_COUNT",
                measured_value: result.inserted_terms.length,
                unit: "COUNT",
              },
              {
                metric_id: "GROUNDED_IN_EVIDENCE",
                measured_value: 0,
                unit: "COUNT",
              },
            ],
            reportDigests: [baselineManifest.combined_digest],
          });
        }
        if (benchmarkCase.case_id === oneShotCase.case_id) {
          const result = await runOneShotResumeGeneration(deterministicFake, {
            profile,
            job,
            resume,
          });
          return makeObservation(benchmarkCase, {
            metrics: [
              {
                metric_id: "ONE_SHOT_CALL_COUNT",
                measured_value: result.attempted_call_count,
                unit: "COUNT",
              },
              {
                metric_id: "ONE_SHOT_RETRY_COUNT",
                measured_value: result.retries,
                unit: "COUNT",
              },
              {
                metric_id: "RAW_OUTPUT_UNVERIFIED",
                measured_value:
                  result.raw_output?.verification_status === "UNVERIFIED"
                    ? 1
                    : 0,
                unit: "COUNT",
              },
            ],
            usedPromptIds: [result.prompt_id],
            reportDigests: [baselineManifest.combined_digest],
          });
        }
        if (benchmarkCase.case_id === legacyCase.case_id) {
          const captured = legacyRecords.filter(
            (record) => record.observation_status === "CAPTURED",
          ).length;
          return makeObservation(benchmarkCase, {
            status: "PARTIAL",
            metrics: [
              {
                metric_id: "CAPTURED_LEGACY_OBSERVATION_COUNT",
                measured_value: captured,
                unit: "COUNT",
              },
            ],
            errors: ["BENCHMARK_INVALID_COMPARISON_EVIDENCE"],
            reportDigests: [baselineManifest.combined_digest],
          });
        }
        throw new Error(`unexpected integration case ${benchmarkCase.case_id}`);
      },
    };

    const request = makeRequest(cases, {
      corpus: {
        version: fixtureCorpus.manifest.corpus_version,
        digest: fixtureCorpus.manifest.corpus_digest,
      },
      implementationIdentity: "w04_development_subset_v1",
      implementationVersion: "1.0.2",
      implementationSourceDigest: baselineManifest.combined_digest,
      prompts: [
        {
          prompt_id: ONE_SHOT_RESUME_PROMPT.prompt_id,
          version: ONE_SHOT_RESUME_PROMPT.prompt_version,
          digest: RESUME_PROMPT_DIGEST,
        },
      ],
      limitations: [
        "Finite public W04 development cases only; not a W06 corpus freeze, W13 harness, W14 execution, or W15 decision.",
      ],
    });
    const execution = await runEvaluation(
      request,
      adapter,
      new FixedClock(),
      trustedContext(request),
    );

    expect(fakeCallCount).toBe(1);
    expect(execution.records).toHaveLength(5);
    expect(
      execution.records.filter((record) => record.overall_outcome === "PASS"),
    ).toHaveLength(4);
    const legacyRecord = execution.records.find(
      (record) => record.case_id === legacyCase.case_id,
    );
    expect(legacyRecord).toMatchObject({
      completeness_state: "PARTIAL",
      comparable: false,
      overall_outcome: "INVALID",
    });
    expect(legacyRecord?.threshold_results[0]?.passed).toBe(false);
    expect(legacyRecord?.canonical_result?.overall_outcome).toBe("INVALID");
    expect(execution.provenance.holdout).toMatchObject({
      policy: "DEVELOPMENT_NOT_APPLICABLE_V1",
      state: "NOT_APPLICABLE",
    });
    expect(execution.provenance.runtime.model_digest).toBeUndefined();
    expect(
      execution.records.flatMap((record) => record.used_prompt_commitments),
    ).toHaveLength(1);
  });
});
