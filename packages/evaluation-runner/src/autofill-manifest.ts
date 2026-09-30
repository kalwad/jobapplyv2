import {
  sha256Canonical,
  isContentDigest,
  type ContentDigest,
} from "./canonical.ts";
import { deriveExecutionFromWitness } from "./derive.ts";
import { aggregateCaseResults } from "./aggregate.ts";
import {
  DEVELOPMENT_LABELS,
  type AutofillScore,
  freezeOracle,
  scoreAutofill,
  projectAutofillObservation,
} from "./autofill.ts";
import { validateAdapterObservation } from "./validate.ts";
import type { RunnerExecutionV1 } from "./model.ts";
export interface AutofillRunMetadata {
  readonly matrix: { version: string; digest: ContentDigest };
  readonly extension_build_digest: ContentDigest;
  readonly source_state: "CLEAN" | "DIRTY_SOURCE";
  readonly source_inventory_digest: ContentDigest;
  readonly hardware: {
    platform: string;
    architecture: string;
    cpu_model: string;
    logical_cpus: number;
    memory_bytes: number;
  };
  readonly configuration: {
    settle_budget_ms: number;
    rerender_delay_ms: number;
    ai_enabled: boolean;
    navigation_enabled: boolean;
    submission_enabled: boolean;
  };
}
export function buildAutofillRunManifest(
  execution: RunnerExecutionV1,
  metadata: AutofillRunMetadata,
  raw: readonly { candidate: unknown; audit: unknown }[],
  scores: readonly AutofillScore[],
  oracles: readonly unknown[],
) {
  const replay = deriveExecutionFromWitness(execution.replay_witness);
  if (sha256Canonical(replay) !== sha256Canonical(execution))
    throw new Error("W13_REPLAY_DRIFT");
  if (
    !isContentDigest(metadata.matrix.digest) ||
    !isContentDigest(metadata.extension_build_digest) ||
    !isContentDigest(metadata.source_inventory_digest) ||
    !Number.isSafeInteger(metadata.hardware.logical_cpus) ||
    metadata.hardware.logical_cpus <= 0 ||
    !Number.isSafeInteger(metadata.hardware.memory_bytes) ||
    metadata.hardware.memory_bytes <= 0
  )
    throw new Error("W13_MANIFEST_FACTS");
  if (
    metadata.configuration.ai_enabled ||
    metadata.configuration.navigation_enabled ||
    metadata.configuration.submission_enabled ||
    !Number.isInteger(metadata.configuration.settle_budget_ms) ||
    metadata.configuration.settle_budget_ms < 0 ||
    !Number.isInteger(metadata.configuration.rerender_delay_ms) ||
    metadata.configuration.rerender_delay_ms < 0 ||
    execution.provenance.runtime.browser === undefined
  )
    throw new Error("W13_MANIFEST_MODE");
  const cases = execution.replay_witness.request.cases;
  if (
    cases.some((c) => c.holdout_visibility !== "PUBLIC_SYNTHETIC") ||
    execution.provenance.holdout.policy !== "DEVELOPMENT_NOT_APPLICABLE_V1"
  )
    throw new Error("W13_MANIFEST_PRIVATE_INPUT");
  const trustedOracles = oracles.map(freezeOracle);
  if (
    trustedOracles.length !== cases.length ||
    new Set(trustedOracles.map((o) => o.case_id)).size !== cases.length
  )
    throw new Error("W13_MANIFEST_INVENTORY");
  if (
    scores.length !== cases.length ||
    raw.length !== cases.length ||
    new Set(scores.map((s) => s.case_id)).size !== scores.length
  )
    throw new Error("W13_MANIFEST_INVENTORY");
  for (const score of scores) {
    const index = raw.findIndex(
      (r) =>
        sha256Canonical(r.candidate) === score.raw_digest &&
        sha256Canonical(r.audit) === score.physical_digest,
    );
    if (
      index < 0 ||
      !cases.some(
        (c) =>
          c.case_id === score.case_id &&
          c.input_artifacts.some(
            (a) => a.artifact_digest === score.oracle_digest,
          ),
      )
    )
      throw new Error("W13_MANIFEST_BINDING");
  }
  for (const score of scores) {
    const oracle = trustedOracles.find((o) => o.case_id === score.case_id);
    const benchmarkCase = cases.find((c) => c.case_id === score.case_id);
    const observation = raw.find(
      (r) => sha256Canonical(r.candidate) === score.raw_digest,
    );
    if (
      oracle === undefined ||
      benchmarkCase === undefined ||
      observation === undefined ||
      oracle.matrix_digest !== metadata.matrix.digest ||
      oracle.matrix_version !== metadata.matrix.version
    )
      throw new Error("W13_MANIFEST_BINDING");
    const verified = scoreAutofill(
      benchmarkCase,
      oracle,
      observation.candidate,
      observation.audit,
    );
    const record = execution.records.find((r) => r.case_id === score.case_id);
    if (
      sha256Canonical(verified) !== sha256Canonical(score) ||
      !record?.artifact_report_digests.includes(sha256Canonical(score))
    )
      throw new Error("W13_MANIFEST_SCORE_DRIFT");
    const projected = validateAdapterObservation(
      projectAutofillObservation(benchmarkCase, verified, observation),
      execution.replay_witness.request,
      benchmarkCase,
    );
    const witness = execution.replay_witness.case_witnesses.find(
      (w) => w.case_id === score.case_id,
    );
    if (
      witness === undefined ||
      sha256Canonical(projected) !== sha256Canonical(witness.observation)
    )
      throw new Error("W13_MANIFEST_OBSERVATION_DRIFT");
  }
  const windows = execution.replay_witness.case_witnesses;
  return {
    format_version: "W13_RUN_MANIFEST_1",
    labels: DEVELOPMENT_LABELS,
    authority: "NONE",
    scorer_version: "1.0.0",
    candidate: execution.provenance.implementation,
    repository: execution.provenance.repository,
    source_state: metadata.source_state,
    source_inventory_digest: metadata.source_inventory_digest,
    matrix: metadata.matrix,
    corpus: execution.provenance.corpus,
    case_inventory_digest: sha256Canonical(
      execution.replay_witness.request.case_commitments,
    ),
    extension_build_digest: metadata.extension_build_digest,
    runtime: execution.provenance.runtime,
    hardware: metadata.hardware,
    configuration: metadata.configuration,
    started_at: windows[0]?.started_at ?? null,
    ended_at: windows.at(-1)?.ended_at ?? null,
    case_count: cases.length,
    field_count: scores.reduce((n, s) => n + s.counts.fields, 0),
    raw_result_digest: sha256Canonical(raw),
    field_score_digest: sha256Canonical(scores),
    aggregate_digest: sha256Canonical(aggregateCaseResults(execution.records)),
    execution_digest: sha256Canonical(execution),
  };
}
