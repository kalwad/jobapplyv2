import { readFileSync } from "node:fs";

import {
  FROZEN_PUBLIC_NO_HOLDOUT_COMMITMENT,
  buildRunReport,
  renderReportHtml,
  renderReportJson,
  renderReportMarkdown,
  runEvaluation,
  sha256Canonical,
} from "@japp/evaluation-runner";
import { describe, expect, it } from "vitest";

import {
  REPOSITORY_ROOT,
  appendFullVersion,
  computeCorpus,
  validateCorrectionRecord,
} from "../../src/corpus.ts";
import { join } from "node:path";
import {
  checkHoldoutLogHistory,
  parseHoldoutLog,
  validateAppendOnlyLog,
} from "../../src/log.ts";
import { CORPUS_ID, CORPUS_VERSION } from "../../src/model.ts";
import {
  FixedClock,
  adapterReturning,
  makeCase,
  makeObservation,
  makeRequest,
  trustedContext,
} from "../../../evaluation-runner/test/m02-w05/support/fixtures.ts";

const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}`;
const row = (
  id = "execution_00000000000000000000000001",
  commit = "1".repeat(40),
  result = digest("a"),
): string =>
  `| ${id} | 2026-08-10 | AUTOFILL_FEASIBILITY | ${digest("b")} | ${commit} | ${"2".repeat(40)} | ${"3".repeat(40)} | ${result} | ROLE_INDEPENDENT_EVALUATOR | PASS |`;
const log = (...rows: readonly string[]): string =>
  [
    "# Holdout Execution Log",
    "| Execution ID | Date | Gate | Bundle manifest digest | Commit | Tree | Runner revision | Result artifact digest | Executor role | Outcome |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...(rows.length === 0
      ? ["| — | — | — | — | — | — | — | — | — | (none yet) |"]
      : rows),
    "",
  ].join("\n");

function frozenRequest(
  corpusOverride: Readonly<{
    id: string;
    version: string;
    digest: `sha256:${string}`;
  }> | null = null,
) {
  const { manifest } = computeCorpus();
  const corpus = corpusOverride ?? {
    id: CORPUS_ID,
    version: CORPUS_VERSION,
    digest: manifest.corpus_digest,
  };
  const benchmarkCase = makeCase({
    corpusVersion: corpus.version,
    corpusDigest: corpus.digest,
  });
  const base = makeRequest([benchmarkCase], {
    corpus,
  });
  return {
    ...base,
    holdout: {
      policy: "FROZEN_PUBLIC_NO_HOLDOUT_V1" as const,
      state: "NOT_APPLICABLE" as const,
      frozen_public_commitment_digest: sha256Canonical(
        FROZEN_PUBLIC_NO_HOLDOUT_COMMITMENT,
      ),
    },
  };
}

describe("M02-W06 versioning, log, and W05 identity integration", () => {
  it("accepts a complete reviewed full-version correction record", () => {
    const record = {
      old_version: "1.0.0",
      old_digest: computeCorpus().manifest.corpus_digest,
      new_version: "2.0.0",
      new_digest: digest("2"),
      reason: "Correct reviewed semantic truth without rewriting version one.",
      owner_role: "CORPUS_OWNER",
      reviewer_role: "INDEPENDENT_REVIEWER",
      affected_comparisons: ["ALL_V1_COMPARISONS"],
      affected_evidence: ["ALL_V1_EVIDENCE"],
      invalidation: "REQUIRED" as const,
      rerun: "REQUIRED" as const,
    };
    expect(() => {
      validateCorrectionRecord(record);
    }).not.toThrow();
    const previous = computeCorpus().versionIndex as unknown as Parameters<
      typeof appendFullVersion
    >[0];
    const next = appendFullVersion(
      previous,
      {
        corpus_id: "M02_AUTOFILL_DEVELOPMENT_V1",
        corpus_version: "2.0.0",
        corpus_digest: digest("2"),
        source_tree: "4".repeat(40),
        manifest_path:
          "packages/evaluation-corpus/artifacts/development/M02_AUTOFILL_DEVELOPMENT_V1/2.0.0/corpus.manifest.json",
      },
      record,
    );
    expect(next.versions.slice(0, previous.versions.length)).toEqual(
      previous.versions,
    );
    expect(next.corrections).toEqual([record]);
  });

  it("rejects a same-version correction", () => {
    expect(() => {
      validateCorrectionRecord({
        old_version: "1.0.0",
        old_digest: digest("1"),
        new_version: "1.0.0",
        new_digest: digest("2"),
        reason: "A sufficiently detailed correction rationale.",
        owner_role: "OWNER",
        reviewer_role: "REVIEWER",
        affected_comparisons: ["A"],
        affected_evidence: ["B"],
        invalidation: "REQUIRED",
        rerun: "REQUIRED",
      });
    }).toThrow("CORRECTION_ORDER");
  });

  it("rejects minor-version truth rewriting", () => {
    expect(() => {
      validateCorrectionRecord({
        old_version: "1.0.0",
        old_digest: digest("1"),
        new_version: "1.1.0",
        new_digest: digest("2"),
        reason: "A sufficiently detailed correction rationale.",
        owner_role: "OWNER",
        reviewer_role: "REVIEWER",
        affected_comparisons: ["A"],
        affected_evidence: ["B"],
        invalidation: "REQUIRED",
        rerun: "REQUIRED",
      });
    }).toThrow("CORRECTION_FULL_VERSION");
  });

  it("rejects a correction without independent review", () => {
    expect(() => {
      validateCorrectionRecord({
        old_version: "1.0.0",
        old_digest: digest("1"),
        new_version: "2.0.0",
        new_digest: digest("2"),
        reason: "A sufficiently detailed correction rationale.",
        owner_role: "OWNER",
        reviewer_role: "OWNER",
        affected_comparisons: ["A"],
        affected_evidence: ["B"],
        invalidation: "REQUIRED",
        rerun: "REQUIRED",
      });
    }).toThrow("CORRECTION_REVIEW");
  });

  it("rejects a correction without affected evidence", () => {
    expect(() => {
      validateCorrectionRecord({
        old_version: "1.0.0",
        old_digest: digest("1"),
        new_version: "2.0.0",
        new_digest: digest("2"),
        reason: "A sufficiently detailed correction rationale.",
        owner_role: "OWNER",
        reviewer_role: "REVIEWER",
        affected_comparisons: ["A"],
        affected_evidence: [],
        invalidation: "REQUIRED",
        rerun: "REQUIRED",
      });
    }).toThrow("CORRECTION_IMPACT");
    expect(() => {
      validateCorrectionRecord({
        old_version: "1.0.0",
        old_digest: digest("1"),
        new_version: "2.0.0",
        new_digest: digest("2"),
        reason: "A sufficiently detailed correction rationale.",
        owner_role: "OWNER",
        reviewer_role: "REVIEWER",
        affected_comparisons: ["A"],
        affected_evidence: ["B"],
        invalidation: "NOT_REQUIRED",
        rerun: "NOT_REQUIRED",
      } as unknown as Parameters<typeof validateCorrectionRecord>[0]);
    }).toThrow("CORRECTION_INVALIDATION");
  });

  it("accepts a valid append", () => {
    expect(() => {
      validateAppendOnlyLog(log(), log(row()));
    }).not.toThrow();
  });

  it("rejects deletion", () => {
    expect(() => {
      validateAppendOnlyLog(log(row()), log());
    }).toThrow("HOLDOUT_LOG_DELETION");
  });

  it("rejects mutation", () => {
    expect(() => {
      validateAppendOnlyLog(log(row()), log(row().replace("PASS", "FAIL")));
    }).toThrow("HOLDOUT_LOG_PREFIX_MUTATION");
  });

  it("rejects reordering", () => {
    const second = row(
      "execution_00000000000000000000000002",
      "4".repeat(40),
      digest("c"),
    );
    expect(() => {
      validateAppendOnlyLog(log(row(), second), log(second, row()));
    }).toThrow("HOLDOUT_LOG_PREFIX_MUTATION");
  });

  it("rejects replacement", () => {
    expect(() => {
      validateAppendOnlyLog(
        log(row()),
        log(row("execution_00000000000000000000000002")),
      );
    }).toThrow("HOLDOUT_LOG_PREFIX_MUTATION");
  });

  it("rejects duplicate execution IDs", () => {
    expect(() =>
      parseHoldoutLog(log(row(), row(undefined, "4".repeat(40), digest("c")))),
    ).toThrow("HOLDOUT_LOG_DUPLICATE_EXECUTION");
  });

  it("rejects duplicate revision/result identities", () => {
    expect(() =>
      parseHoldoutLog(log(row(), row("execution_00000000000000000000000002"))),
    ).toThrow("HOLDOUT_LOG_DUPLICATE_REVISION_RESULT");
  });

  it("passes the canonical first-parent execution-log check with no W06 row", () => {
    expect(() => {
      checkHoldoutLogHistory();
    }).not.toThrow();
    expect(
      parseHoldoutLog(
        readFileSync(
          join(REPOSITORY_ROOT, "docs/gates/HOLDOUT_EXECUTION_LOG.md"),
          "utf8",
        ),
      ),
    ).toHaveLength(0);
  });

  it("carries exact W06 corpus ID/version/digest through execution replay report and renderers", async () => {
    const request = frozenRequest();
    const execution = await runEvaluation(
      request,
      adapterReturning(makeObservation),
      new FixedClock(),
      trustedContext(request),
    );
    const report = buildRunReport(execution);
    expect(execution.provenance.corpus).toEqual(request.corpus);
    expect(execution.replay_witness.request.corpus).toEqual(request.corpus);
    expect(report.provenance.corpus).toEqual(request.corpus);
    for (const rendered of [
      renderReportJson(report),
      renderReportMarkdown(report),
      renderReportHtml(report),
    ]) {
      expect(rendered).toContain(CORPUS_ID);
      expect(rendered).toContain(computeCorpus().manifest.corpus_digest);
    }
  });

  it("rejects coordinated foreign corpus-ID substitution even when request and trust agree", async () => {
    const { manifest } = computeCorpus();
    const request = frozenRequest({
      id: "FOREIGN_CORPUS_V1",
      version: CORPUS_VERSION,
      digest: manifest.corpus_digest,
    });
    await expect(
      runEvaluation(
        request,
        adapterReturning(makeObservation),
        new FixedClock(),
        trustedContext(request),
      ),
    ).rejects.toMatchObject({
      code: "RUNNER_FROZEN_PUBLIC_CORPUS_COMMITMENT",
    });
  });

  it("rejects coordinated foreign corpus-digest substitution even when case request and trust agree", async () => {
    const request = frozenRequest({
      id: CORPUS_ID,
      version: CORPUS_VERSION,
      digest: digest("f"),
    });
    await expect(
      runEvaluation(
        request,
        adapterReturning(makeObservation),
        new FixedClock(),
        trustedContext(request),
      ),
    ).rejects.toMatchObject({
      code: "RUNNER_FROZEN_PUBLIC_CORPUS_COMMITMENT",
    });
  });

  it("uses truthful frozen-public no-holdout limitations", async () => {
    const request = frozenRequest();
    const execution = await runEvaluation(
      request,
      adapterReturning(makeObservation),
      new FixedClock(),
      trustedContext(request),
    );
    const report = buildRunReport(execution);
    expect(report.limitations.join(" ")).toContain("frozen public W06 corpus");
    expect(report.limitations.join(" ")).not.toContain(
      "pre-W06 development run",
    );
  });

  it("never places owner hidden cases in the W05 path", () => {
    const request = frozenRequest();
    expect(
      request.cases.every(
        ({ holdout_visibility }) => holdout_visibility === "PUBLIC_SYNTHETIC",
      ),
    ).toBe(true);
    expect(JSON.stringify(request)).not.toContain("OWNER_CONTROLLED_HIDDEN");
  });
});
