/** Explicit authorized W13/W14 caller interface. Never discovers an owner root. */
import { validateBenchmarkCaseV1 } from "@japp/contracts/generated";
import { sha256Bytes, sha256Canonical } from "./canonical.ts";
import {
  validateSanitizedManifest,
  verifyOwnerHoldout,
  assertManifestMatchesSnapshot,
} from "./owner-holdout.ts";
import { runEvaluation } from "../../evaluation-runner/src/runner.ts";
import type {
  BenchmarkCaseV1,
  EvaluationAdapterV1,
  ExecutionRequestV1,
  RunnerClockV1,
  RunnerTrustedContextV1,
} from "../../evaluation-runner/src/model.ts";
import { aggregateCaseResults } from "../../evaluation-runner/src/aggregate.ts";
import { canonicalJson } from "../../evaluation-runner/src/canonical.ts";
export interface AuthorizedHoldoutInput {
  readonly authorized_root: string;
  readonly manifest: unknown;
  readonly case_files: readonly { file_id: string; bytes: Uint8Array }[];
  readonly artifacts: readonly { artifact_ref: string; bytes: Uint8Array }[];
  readonly request: ExecutionRequestV1;
  readonly trusted_context: RunnerTrustedContextV1;
}
function fail(): never {
  throw new Error("W13_HOLDOUT_REFUSED");
}
/**
 * The owner-only adapter factory receives verified preimages. It owns oracle /
 * sanitized candidate separation. Only a redacted aggregate leaves this call;
 * no logger, network client, raw report writer or ambient fallback is present.
 */
export async function executeAuthorizedHoldout(
  input: AuthorizedHoldoutInput,
  createTrustedAdapter: (
    cases: readonly BenchmarkCaseV1[],
    artifacts: ReadonlyMap<string, Uint8Array>,
  ) => EvaluationAdapterV1,
  clock: RunnerClockV1,
) {
  try {
    // This guard MUST precede W06 verification (whose original CLI permits env).
    if (
      typeof input.authorized_root !== "string" ||
      input.authorized_root.length === 0
    )
      fail();
    const manifest = validateSanitizedManifest(input.manifest);
    const snapshot = verifyOwnerHoldout(input.authorized_root);
    assertManifestMatchesSnapshot(manifest, snapshot);
    if (
      input.case_files.length !== manifest.files.length ||
      new Set(input.case_files.map((f) => f.file_id)).size !==
        input.case_files.length
    )
      fail();
    const cases: BenchmarkCaseV1[] = [];
    for (const file of manifest.files) {
      const supplied = input.case_files.find((f) => f.file_id === file.file_id);
      if (
        supplied?.bytes.byteLength !== file.byte_count ||
        sha256Bytes(supplied.bytes) !== file.content_digest
      )
        fail();
      const parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(supplied.bytes),
      ) as unknown;
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      )
        fail();
      const body = parsed as Record<string, unknown>;
      if (
        Object.keys(body).sort().join() !== "cases,format_version" ||
        body.format_version !== "1.0.0" ||
        !Array.isArray(body.cases) ||
        body.cases.length !== file.case_count
      )
        fail();
      for (const raw of body.cases as unknown[]) {
        const checked = validateBenchmarkCaseV1(raw);
        if (
          !checked.valid ||
          checked.value.holdout_visibility !== "OWNER_CONTROLLED_HIDDEN"
        )
          fail();
        cases.push(checked.value);
      }
    }
    const ids = cases.map((c) => c.case_id).sort();
    if (
      new Set(ids).size !== ids.length ||
      ids.join() !== manifest.case_ids.join()
    )
      fail();
    if (
      sha256Canonical(
        [...cases].sort((a, b) => a.case_id.localeCompare(b.case_id)),
      ) !==
      sha256Canonical(
        [...input.request.cases].sort((a, b) =>
          a.case_id.localeCompare(b.case_id),
        ),
      )
    )
      fail();
    const artifacts = new Map<string, Uint8Array>();
    if (input.artifacts.length !== snapshot.verified_artifacts.length) fail();
    for (const declaration of snapshot.verified_artifacts) {
      const supplied = input.artifacts.find(
        (a) => a.artifact_ref === declaration.artifact_ref,
      );
      if (
        supplied === undefined ||
        artifacts.has(supplied.artifact_ref) ||
        sha256Bytes(supplied.bytes) !== declaration.artifact_digest ||
        supplied.bytes.byteLength !== declaration.byte_count
      )
        fail();
      artifacts.set(supplied.artifact_ref, Uint8Array.from(supplied.bytes));
    }
    if (
      input.request.holdout.policy !== "CALLER_SUPPLIED_MANIFEST_V1" ||
      input.request.holdout.state !== "VALID" ||
      input.request.holdout.manifest_id !== manifest.manifest_id ||
      input.request.holdout.manifest_digest !== manifest.manifest_digest
    )
      fail();
    const caseCopy = JSON.parse(canonicalJson(cases)) as BenchmarkCaseV1[];
    const adapter = createTrustedAdapter(caseCopy, artifacts);
    const execution = await runEvaluation(
      input.request,
      adapter,
      clock,
      input.trusted_context,
    );
    // Repeat storage and manifest verification after execution to detect drift.
    const finalSnapshot = verifyOwnerHoldout(input.authorized_root);
    if (finalSnapshot.receipt_digest !== snapshot.receipt_digest) fail();
    const aggregate = aggregateCaseResults(execution.records);
    return Object.freeze({
      format_version: "W13_HOLDOUT_AGGREGATE_1",
      authority: "NONE",
      mode: "AUTHORIZED_HOLDOUT_INTERFACE",
      manifest_digest: manifest.manifest_digest,
      receipt_digest: snapshot.receipt_digest,
      candidate_commit: input.request.repository.commit,
      candidate_tree: input.request.repository.tree,
      run_digest: sha256Canonical(execution),
      counts: aggregate.counts,
      metric_summaries: aggregate.metric_summaries,
    });
  } catch {
    return fail();
  }
}
