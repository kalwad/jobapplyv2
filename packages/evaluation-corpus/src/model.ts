import type { ContentDigest } from "./canonical.ts";

export const CORPUS_ID = "M02_AUTOFILL_DEVELOPMENT_V1" as const;
export const CORPUS_VERSION = "1.0.0" as const;
export const CORPUS_FORMAT_VERSION = "1.0.0" as const;

export type ArtifactRole =
  | "PUBLIC_BASELINE"
  | "PUBLIC_DEVELOPMENT_INPUT"
  | "PUBLIC_EXPECTED_TRUTH"
  | "PUBLIC_FORM_VARIANT"
  | "SCHEMA_SEMANTICS";

export type ArtifactSchemaV1 =
  | {
      readonly state: "APPLICABLE";
      readonly schema_ref: string;
      readonly schema_version: string;
    }
  | { readonly state: "NOT_APPLICABLE" };

export interface CorpusArtifactV1 {
  readonly path: string;
  readonly role: ArtifactRole;
  readonly content_digest: ContentDigest;
  readonly byte_count: number;
  readonly applicable_schema: ArtifactSchemaV1;
  readonly record_ids: readonly string[];
  readonly record_count: number;
  readonly expected_truth: boolean;
}

export interface CoverageSummaryV1 {
  readonly format_version: "1.0.0";
  readonly corpus_id: typeof CORPUS_ID;
  readonly corpus_version: typeof CORPUS_VERSION;
  readonly raw_counts: Readonly<Record<string, number>>;
  readonly schema_versions: readonly {
    readonly schema_ref: string;
    readonly schema_version: string;
  }[];
  readonly future_gate_a_targets: readonly {
    readonly metric: string;
    readonly current: number | "UNAVAILABLE";
    readonly target: number | "REQUIRED";
    readonly shortfall: number | "UNAVAILABLE";
    readonly owner: "M02-W12" | "M02-W13" | "M02-W14";
    readonly state: "NOT_YET_APPLICABLE";
  }[];
  readonly coverage_digest: ContentDigest;
}

export interface CorpusManifestV1 {
  readonly format_version: "1.0.0";
  readonly corpus_id: typeof CORPUS_ID;
  readonly corpus_version: typeof CORPUS_VERSION;
  readonly corpus_state: "FROZEN";
  readonly benchmark_family: "AUTOFILL_FEASIBILITY";
  readonly classification: readonly ["EVALUATION_ONLY", "NON_PRODUCTION"];
  readonly data_classification: readonly ["PUBLIC", "SYNTHETIC"];
  readonly gate_authority: "NONE";
  readonly source_tree: string;
  readonly provenance: {
    readonly owner: "M02-W06";
    readonly freeze_source: "EXACT_REPOSITORY_TREE";
    readonly generator_package: "@japp/evaluation-corpus";
    readonly generator_version: "0.0.1";
    readonly checker_version: "1.0.0";
  };
  readonly source_fixture_commitment: {
    readonly id: string;
    readonly version: string;
    readonly digest: ContentDigest;
  };
  readonly artifacts: readonly CorpusArtifactV1[];
  readonly artifact_count: number;
  readonly artifact_role_counts: Readonly<Record<ArtifactRole, number>>;
  readonly record_count: number;
  readonly schema_versions: readonly {
    readonly schema_ref: string;
    readonly schema_version: string;
  }[];
  readonly coverage_summary_digest: ContentDigest;
  readonly expected_truth_policy: string;
  readonly threshold_policy: {
    readonly frozen_existing_truth: true;
    readonly field_scoring_thresholds: "NOT_YET_APPLICABLE";
    readonly tolerances: "NOT_YET_APPLICABLE";
    readonly ignored_regions: "NOT_YET_APPLICABLE";
    readonly future_owner: "M02-W13";
  };
  readonly change_policy: {
    readonly versioning: "FULL_MAJOR_VERSION_ONLY";
    readonly same_version_rewrite: "FORBIDDEN";
    readonly history_policy: "PRESERVE_GIT_BLOB_AND_VERSION_PATH";
    readonly correction_record_required: true;
    readonly invalidation_and_rerun_required: true;
  };
  readonly corpus_digest: ContentDigest;
}
