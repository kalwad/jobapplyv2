import type {
  BenchmarkCaseV1,
  BenchmarkCaseV1MetricUnit,
  BenchmarkCaseV1ThresholdComparator,
  BenchmarkResultV1,
  BenchmarkResultV1CompletenessState,
  BenchmarkResultV1EnvironmentMatchState,
  BenchmarkResultV1HashState,
  BenchmarkResultV1HoldoutState,
  BenchmarkResultV1RuntimeMetadata,
  ErrorTaxonomyV1ErrorCode,
} from "@japp/contracts/generated";

import type { ContentDigest } from "./canonical.ts";

export type {
  BenchmarkCaseV1,
  BenchmarkCaseV1MetricUnit,
  BenchmarkCaseV1ThresholdComparator,
  BenchmarkResultV1,
  BenchmarkResultV1CompletenessState,
  BenchmarkResultV1EnvironmentMatchState,
  BenchmarkResultV1HashState,
  BenchmarkResultV1HoldoutState,
  BenchmarkResultV1RuntimeMetadata,
  ErrorTaxonomyV1ErrorCode,
};

export interface CaseCommitmentV1 {
  readonly case_id: string;
  readonly case_digest: ContentDigest;
}

export interface RepositoryCommitmentV1 {
  readonly commit: string;
  readonly tree: string;
  readonly runner_source_digest: ContentDigest;
}

export interface SchemaCommitmentV1 {
  readonly manifest_digest: ContentDigest;
  readonly generator_format_version: string;
}

export interface CorpusCommitmentV1 {
  readonly id: string;
  readonly version: string;
  readonly digest: ContentDigest;
}

export type HoldoutMetadataV1 =
  | {
      readonly policy: "DEVELOPMENT_NOT_APPLICABLE_V1";
      readonly state: "NOT_APPLICABLE";
      readonly development_commitment_digest: ContentDigest;
    }
  | {
      readonly policy: "FROZEN_PUBLIC_NO_HOLDOUT_V1";
      readonly state: "NOT_APPLICABLE";
      readonly frozen_public_commitment_digest: ContentDigest;
    }
  | {
      readonly policy: "CALLER_SUPPLIED_MANIFEST_V1";
      readonly state: "INVALID" | "UNAVAILABLE" | "VALID";
      readonly manifest_id: string;
      readonly manifest_digest: ContentDigest;
    };

export interface RuntimeCommitmentV1 {
  readonly environment_state: "KNOWN" | "UNKNOWN";
  readonly runtime_family: string;
  readonly runtime_version: string;
  readonly platform_profile: string;
  readonly toolchain_digest: ContentDigest;
  readonly operating_system: string;
  readonly architecture: string;
  readonly model_profile_ref?: string;
  readonly model_digest?: ContentDigest;
  readonly browser?: {
    readonly family: string;
    readonly version: string;
  };
}

export interface ImplementationCommitmentV1 {
  readonly kind: "BASELINE" | "IMPLEMENTATION";
  readonly identity: string;
  readonly version: string;
  readonly source_digest: ContentDigest;
}

export interface AdapterCommitmentV1 {
  readonly identity: string;
  readonly version: string;
}

export interface ClockCommitmentV1 {
  readonly identity: string;
  readonly version: string;
}

export interface PromptCommitmentV1 {
  readonly prompt_id: string;
  readonly version: string;
  readonly digest: ContentDigest;
}

export interface OutputPolicyV1 {
  readonly report_format_version: "1.0.0";
  readonly unexpected_metric_policy: "REJECT";
  readonly formats: readonly ["JSON", "MARKDOWN", "HTML"];
  readonly report_title: string;
  readonly limitations: readonly string[];
}

export interface ExecutionRequestV1 {
  readonly runner_format_version: "1.0.0";
  readonly cases: readonly BenchmarkCaseV1[];
  readonly case_commitments: readonly CaseCommitmentV1[];
  readonly repository: RepositoryCommitmentV1;
  readonly schema: SchemaCommitmentV1;
  readonly corpus: CorpusCommitmentV1;
  readonly holdout: HoldoutMetadataV1;
  readonly runtime: RuntimeCommitmentV1;
  readonly runtime_commitment_digest: ContentDigest;
  readonly implementation: ImplementationCommitmentV1;
  readonly adapter: AdapterCommitmentV1;
  readonly clock: ClockCommitmentV1;
  readonly prompt_commitments: readonly PromptCommitmentV1[];
  readonly output_policy: OutputPolicyV1;
}

export interface MeasuredMetricV1 {
  readonly metric_id: string;
  readonly measured_value: number;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly proportion_counts?: {
    readonly numerator: number;
    readonly denominator: number;
  };
}

export interface ArtifactObservationV1 {
  readonly artifact_ref: string;
  readonly content_digest: ContentDigest;
}

export interface PairedCountObservationV1 {
  readonly group_id: string;
  readonly true_positive: number;
  readonly false_positive: number;
  readonly false_negative: number;
}

export interface AdapterObservationV1 {
  readonly observation_format_version: "1.0.0";
  readonly status: "COMPLETE" | "FAILED_SETUP" | "PARTIAL";
  readonly metrics: readonly MeasuredMetricV1[];
  readonly artifact_observations: readonly ArtifactObservationV1[];
  readonly artifact_report_digests: readonly ContentDigest[];
  readonly failure_error_codes: readonly ErrorTaxonomyV1ErrorCode[];
  readonly used_prompt_ids: readonly string[];
  readonly model_participated: boolean;
  readonly browser_participated: boolean;
  readonly peak_memory_bytes: number | null;
  readonly paired_counts: readonly PairedCountObservationV1[];
}

export interface EvaluationAdapterV1 {
  readonly identity: string;
  readonly version: string;
  evaluate(
    benchmarkCase: Readonly<BenchmarkCaseV1>,
  ): Promise<AdapterObservationV1>;
}

export interface RunnerClockV1 {
  readonly identity: string;
  readonly version: string;
  now(): string;
}

/** Trusted in-process facts measured outside serialized request data. */
export interface RunnerTrustedContextV1 {
  readonly repository_commit: string;
  readonly repository_tree: string;
  readonly runner_source_digest: ContentDigest;
  readonly schema_manifest_digest: ContentDigest;
  readonly generator_format_version: string;
  readonly corpus: CorpusCommitmentV1;
  readonly holdout: HoldoutMetadataV1;
  readonly runtime_commitment_digest: ContentDigest;
  readonly implementation: ImplementationCommitmentV1;
}

export interface ThresholdEvaluationV1 {
  readonly metric_id: string;
  readonly comparator: BenchmarkCaseV1ThresholdComparator;
  readonly expected_value: number;
  readonly measured_value: number;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly threshold_set_digest: ContentDigest;
  readonly proportion: CountRateV1 | null;
  readonly zero_tolerance: boolean;
  readonly passed: boolean;
}

export type DerivedOutcomeV1 = "FAIL" | "INVALID" | "PASS";

export interface CaseExecutionRecordV1 {
  readonly record_format_version: "1.0.0";
  readonly record_id: string;
  readonly case_id: string;
  readonly case_digest: ContentDigest;
  readonly threshold_set_digest: ContentDigest;
  readonly implementation: ImplementationCommitmentV1;
  readonly adapter: AdapterCommitmentV1;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly completeness_state: BenchmarkResultV1CompletenessState;
  readonly environment_match_state: BenchmarkResultV1EnvironmentMatchState;
  readonly hash_state: BenchmarkResultV1HashState;
  readonly holdout_state: BenchmarkResultV1HoldoutState;
  readonly comparable: boolean;
  readonly overall_outcome: DerivedOutcomeV1;
  readonly required_metric_units: readonly {
    readonly metric_id: string;
    readonly unit: BenchmarkCaseV1MetricUnit;
  }[];
  readonly threshold_results: readonly ThresholdEvaluationV1[];
  readonly missing_metric_ids: readonly string[];
  readonly failure_error_codes: readonly ErrorTaxonomyV1ErrorCode[];
  readonly artifact_report_digests: readonly ContentDigest[];
  readonly used_prompt_commitments: readonly PromptCommitmentV1[];
  readonly model_participated: boolean;
  readonly browser_participated: boolean;
  readonly peak_memory_bytes: number | null;
  readonly paired_counts: readonly PairedCountObservationV1[];
  readonly observation_digest: ContentDigest;
  readonly canonical_result?: BenchmarkResultV1;
}

/**
 * Immutable per-case replay source: the exact wall-clock window and the
 * canonical validated normalized adapter observation actually measured for
 * one case. It never serializes adapter code, callbacks, commands, shell
 * text, credentials, remote targets, or hidden holdout bodies.
 */
export interface ExecutionCaseWitnessV1 {
  readonly case_id: string;
  readonly started_at: string;
  readonly ended_at: string;
  readonly observation: AdapterObservationV1;
}

/**
 * Authoritative replay source for one execution: the canonical validated
 * ExecutionRequestV1 plus one case witness per request case in canonical
 * case order. Every derived execution, record, aggregate, and report field
 * must be independently reconstructible from this witness alone.
 */
export interface ExecutionReplayWitnessV1 {
  readonly witness_format_version: "1.0.0";
  readonly request: ExecutionRequestV1;
  readonly case_witnesses: readonly ExecutionCaseWitnessV1[];
}

export interface ExecutionProvenanceV1 {
  readonly repository: RepositoryCommitmentV1;
  readonly schema: SchemaCommitmentV1;
  readonly corpus: CorpusCommitmentV1;
  readonly holdout: HoldoutMetadataV1;
  readonly runtime: RuntimeCommitmentV1;
  readonly runtime_commitment_digest: ContentDigest;
  readonly implementation: ImplementationCommitmentV1;
  readonly adapter: AdapterCommitmentV1;
  readonly clock: ClockCommitmentV1;
  readonly prompt_commitments: readonly PromptCommitmentV1[];
}

export interface RunnerExecutionV1 {
  readonly execution_format_version: "1.0.0";
  readonly runner_version: "1.0.0";
  readonly execution_id: string;
  readonly request_digest: ContentDigest;
  readonly records: readonly CaseExecutionRecordV1[];
  readonly provenance: ExecutionProvenanceV1;
  readonly output_policy: OutputPolicyV1;
  readonly replay_witness: ExecutionReplayWitnessV1;
}

export interface CountRateV1 {
  readonly numerator: number;
  readonly denominator: number;
  readonly rate: number | null;
}

export interface WilsonIntervalV1 {
  readonly method: "WILSON_SCORE";
  readonly confidence_level: 0.95;
  readonly numerator: number;
  readonly denominator: number;
  readonly lower_bound: string | null;
  readonly upper_bound: string | null;
  readonly note: "NO_OBSERVATIONS" | "SMALL_SAMPLE_N_1" | null;
}

export interface UncertaintyNoteV1 {
  readonly interval: null;
  readonly note:
    | "ENVIRONMENT_MISMATCH"
    | "INCOMPARABLE_RESULT"
    | "NON_BERNOULLI_METRIC"
    | "NO_OBSERVATIONS"
    | "ZERO_TOLERANCE_COUNT";
}

export interface PrecisionRecallSummaryV1 {
  readonly group_id: string;
  readonly true_positive: number;
  readonly false_positive: number;
  readonly false_negative: number;
  readonly precision: CountRateV1;
  readonly recall: CountRateV1;
  readonly precision_uncertainty: WilsonIntervalV1 | UncertaintyNoteV1;
  readonly recall_uncertainty: WilsonIntervalV1 | UncertaintyNoteV1;
  readonly uncertainty_notes: readonly UncertaintyNoteV1[];
}

export interface MetricAggregateV1 {
  readonly metric_id: string;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly required_count: number;
  readonly observed_count: number;
  readonly missing_count: number;
  readonly pass_count: number;
  readonly fail_count: number;
  readonly pass_rate: CountRateV1;
  readonly pass_uncertainty: WilsonIntervalV1;
  readonly proportion_observation_count: number;
  readonly pooled_proportion: CountRateV1 | null;
  readonly proportion_uncertainty: WilsonIntervalV1 | UncertaintyNoteV1;
  readonly uncertainty_notes: readonly UncertaintyNoteV1[];
  readonly zero_tolerance_failure_count: number;
  readonly zero_tolerance_uncertainty: UncertaintyNoteV1;
}

export interface ImplementationGroupV1 {
  readonly kind: "BASELINE" | "IMPLEMENTATION";
  readonly identity: string;
  readonly version: string;
  readonly source_digest: ContentDigest;
  readonly case_count: number;
  readonly pass_count: number;
  readonly fail_count: number;
  readonly invalid_count: number;
}

export interface AggregateCountsV1 {
  readonly total_cases: number;
  readonly complete: number;
  readonly partial: number;
  readonly failed_setup: number;
  readonly comparable: number;
  readonly incomparable: number;
  readonly pass: number;
  readonly fail: number;
  readonly invalid: number;
  readonly environment_match: number;
  readonly environment_mismatch: number;
  readonly environment_unknown: number;
  readonly hash_match: number;
  readonly hash_mismatch: number;
  readonly hash_unknown: number;
  readonly holdout_valid: number;
  readonly holdout_not_applicable: number;
  readonly holdout_unavailable: number;
  readonly holdout_invalid: number;
  readonly zero_tolerance_failure_count: number;
}

export interface AggregateSummaryV1 {
  readonly aggregate_format_version: "1.0.0";
  readonly counts: AggregateCountsV1;
  readonly pass_rate: CountRateV1;
  readonly comparable_rate: CountRateV1;
  readonly failure_error_code_counts: Readonly<
    Partial<Record<ErrorTaxonomyV1ErrorCode, number>>
  >;
  readonly metric_summaries: readonly MetricAggregateV1[];
  readonly precision_recall_summaries: readonly PrecisionRecallSummaryV1[];
  readonly implementation_groups: readonly ImplementationGroupV1[];
}

export interface RegressionCompatibilityV1 {
  readonly corpus_digest: ContentDigest;
  readonly runtime_commitment_digest: ContentDigest;
  readonly metric_semantics_digest: ContentDigest;
  readonly threshold_semantics_digest: ContentDigest;
  readonly implementation_identity: string;
  readonly prompt_digests: readonly ContentDigest[];
  readonly browser_family?: string;
  readonly browser_version?: string;
}

export interface RegressionReferenceV1 {
  readonly regression_format_version: "1.0.0";
  readonly reference_id: string;
  readonly reference_digest: ContentDigest;
  readonly source_run_digest: ContentDigest;
  readonly metric_id: string;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly value: number;
  readonly raw_numerator?: number;
  readonly raw_denominator?: number;
  readonly comparator:
    "EXACT_WITHIN_ABSOLUTE_TOLERANCE" | "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  readonly allowed_regression: number;
  readonly compatibility: RegressionCompatibilityV1;
}

export interface RegressionCandidateV1 {
  readonly candidate_run_digest: ContentDigest;
  readonly metric_id: string;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly value: number;
  readonly raw_numerator?: number;
  readonly raw_denominator?: number;
  readonly implementation_version: string;
  readonly compatibility: RegressionCompatibilityV1;
}

/**
 * Versioned identity of the canonical execution value a regression
 * candidate was resolved from. Only these explicitly supported W05 sources
 * exist; an unsupported or ambiguous selector rejects instead of guessing.
 */
export type RegressionCandidateSelectorV1 =
  | {
      readonly selector_format_version: "1.0.0";
      readonly source: "AGGREGATE_PASS_RATE";
    }
  | {
      readonly selector_format_version: "1.0.0";
      readonly source: "AGGREGATE_POOLED_PROPORTION";
      readonly metric_id: string;
    }
  | {
      readonly selector_format_version: "1.0.0";
      readonly source: "AGGREGATE_PRECISION";
      readonly group_id: string;
    }
  | {
      readonly selector_format_version: "1.0.0";
      readonly source: "AGGREGATE_RECALL";
      readonly group_id: string;
    }
  | {
      readonly selector_format_version: "1.0.0";
      readonly source: "CASE_THRESHOLD_METRIC";
      readonly case_id: string;
      readonly metric_id: string;
    };

/**
 * Complete immutable source material of a serialized regression comparison:
 * the full reviewed reference payload and the candidate selector that binds
 * the candidate side to the embedding report's own execution truth.
 */
export interface RegressionComparisonSourceV1 {
  readonly source_format_version: "1.0.0";
  readonly reference: RegressionReferenceV1;
  readonly candidate_selector: RegressionCandidateSelectorV1;
}

export interface RegressionComparisonV1 {
  readonly regression_format_version: "1.0.0";
  readonly reference_id: string;
  readonly metric_id: string;
  readonly unit: BenchmarkCaseV1MetricUnit;
  readonly candidate_value: number;
  readonly reference_value: number;
  readonly candidate_raw_numerator?: number;
  readonly candidate_raw_denominator?: number;
  readonly reference_raw_numerator?: number;
  readonly reference_raw_denominator?: number;
  readonly absolute_delta: string;
  readonly relative_delta: {
    readonly numerator: string;
    readonly denominator: string;
    readonly presentation: string;
  } | null;
  readonly threshold: number;
  readonly comparator: RegressionReferenceV1["comparator"];
  readonly comparable: boolean;
  readonly incomparable_reasons: readonly string[];
  readonly passed: boolean | null;
  readonly candidate_provenance_digest: ContentDigest;
  readonly reference_provenance_digest: ContentDigest;
  readonly reference_digest: ContentDigest;
  readonly source?: RegressionComparisonSourceV1;
}

export interface RunReportV1 {
  readonly report_format_version: "1.0.0";
  readonly runner_version: "1.0.0";
  readonly execution_id: string;
  readonly request_digest: ContentDigest;
  readonly title: string;
  readonly authority_statement: "THIS REPORT HAS NO CRITICAL-GATE AUTHORITY";
  readonly comparability_banner:
    "ALL_CASES_COMPARABLE" | "INCOMPARABLE_CASES_PRESENT";
  readonly aggregate: AggregateSummaryV1;
  readonly cases: readonly CaseExecutionRecordV1[];
  readonly regression_comparisons: readonly RegressionComparisonV1[];
  readonly provenance: ExecutionProvenanceV1;
  readonly limitations: readonly string[];
  readonly artifact_digest_policy: "OUT_OF_BAND_MANIFEST_AVOIDS_SELF_REFERENCE";
  readonly replay_witness: ExecutionReplayWitnessV1;
}

export interface ReportArtifactCommitmentV1 {
  readonly format: "HTML" | "JSON" | "MARKDOWN";
  readonly digest: ContentDigest;
  readonly byte_count: number;
}

export interface ReportBundleManifestV1 {
  readonly manifest_format_version: "1.0.0";
  readonly report_format_version: "1.0.0";
  readonly execution_id: string;
  readonly artifacts: readonly ReportArtifactCommitmentV1[];
}

export interface ReportBundleV1 {
  readonly json: string;
  readonly markdown: string;
  readonly html: string;
  readonly manifest: ReportBundleManifestV1;
}
