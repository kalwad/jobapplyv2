import { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Canonical, withoutKey } from "../../src/canonical.ts";
import {
  computeCorpus,
  validateCommittedCoverage,
  validateCommittedManifest,
  validateCorrectionRecord,
  validateVersionIndexAppend,
  type CorrectionRecordV1,
  type VersionIndexV1,
} from "../../src/corpus.ts";
import { validateAppendOnlyLog } from "../../src/log.ts";
import {
  assertManifestMatchesSnapshot,
  validateRelativePath,
  validateSanitizedManifest,
  verifyOwnerHoldout,
} from "../../src/owner-holdout.ts";
import { createOwnerRoot } from "./support.ts";

const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}`;

function corpusRecord(): Record<string, unknown> {
  return structuredClone(computeCorpus().manifest) as unknown as Record<
    string,
    unknown
  >;
}

function rehashCorpus(record: Record<string, unknown>): void {
  record.corpus_digest = sha256Canonical(withoutKey(record, "corpus_digest"));
}

function rehashManifest(record: Record<string, unknown>): void {
  record.manifest_digest = sha256Canonical(
    withoutKey(record, "manifest_digest"),
  );
}

function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("missing test value");
  return value;
}

function correction(
  oldDigest: `sha256:${string}` = digest("1"),
): CorrectionRecordV1 {
  return {
    old_version: "1.0.0",
    old_digest: oldDigest,
    new_version: "2.0.0",
    new_digest: digest("2"),
    reason:
      "Correct semantic truth while preserving immutable historical evidence.",
    owner_role: "CORPUS_OWNER",
    reviewer_role: "INDEPENDENT_REVIEWER",
    affected_comparisons: ["ALL_V1_COMPARISONS"],
    affected_evidence: ["ALL_V1_EVIDENCE"],
    invalidation: "REQUIRED",
    rerun: "REQUIRED",
  };
}

describe("M02-W06 exact core mutation campaign", () => {
  it("01 DEVELOPMENT_FILE_TAMPER: clean control exits zero and changed development bytes reject", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    const artifact = first(
      (mutant.artifacts as Record<string, unknown>[]).filter(
        ({ role }) => role === "PUBLIC_DEVELOPMENT_INPUT",
      ),
    );
    artifact.content_digest = digest("f");
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_SOURCE_MISMATCH",
    );
  });

  it("02 EXPECTED_RESULT_TAMPER: clean control exits zero and rehashed expected truth rejects", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    const artifact = first(
      (mutant.artifacts as Record<string, unknown>[]).filter(
        ({ role }) => role === "PUBLIC_EXPECTED_TRUTH",
      ),
    );
    artifact.content_digest = digest("e");
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_SOURCE_MISMATCH",
    );
  });

  it("03 CASE_ID_REPLACEMENT: clean control exits zero and rehashed stable-ID replacement rejects", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    const artifact = first(
      (mutant.artifacts as Record<string, unknown>[]).filter(
        ({ record_count }) => Number(record_count) > 0,
      ),
    );
    const ids = artifact.record_ids as string[];
    ids[0] = "FOREIGN_CASE_ID";
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_SOURCE_MISMATCH",
    );
  });

  it("04 CORPUS_DIGEST_BYPASS: clean control exits zero and coordinated self-rehash rejects", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    first(mutant.artifacts as Record<string, unknown>[]).byte_count = 1;
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_SOURCE_MISMATCH",
    );
  });

  it("05 COVERAGE_COUNT_DRIFT: clean control exits zero and rehashed raw-count drift rejects", () => {
    const control = structuredClone(
      computeCorpus().coverage,
    ) as unknown as Record<string, unknown>;
    expect(() => validateCommittedCoverage(control)).not.toThrow();
    const mutant = structuredClone(control);
    (mutant.raw_counts as Record<string, unknown>).scored_controls = 1;
    mutant.coverage_digest = sha256Canonical(
      withoutKey(mutant, "coverage_digest"),
    );
    expect(() => validateCommittedCoverage(mutant)).toThrow(
      "COVERAGE_SOURCE_MISMATCH",
    );
  });

  it("06 SAME_VERSION_SEMANTIC_REWRITE: clean control exits zero and rehashed same-version semantics reject", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    (mutant.threshold_policy as Record<string, unknown>).ignored_regions =
      "IGNORE_ALL";
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_SOURCE_MISMATCH",
    );
  });

  it("07 HIDDEN_EXPECTED_OUTPUT_LEAK: clean control exits zero and rehashed visible answer injection rejects", () => {
    const fixture = createOwnerRoot();
    try {
      const control = verifyOwnerHoldout(fixture.root).manifest;
      expect(() => validateSanitizedManifest(control)).not.toThrow();
      const mutant = structuredClone(control) as unknown as Record<
        string,
        unknown
      >;
      mutant.expected_output = "SYNTHETIC_FORBIDDEN_ANSWER";
      rehashManifest(mutant);
      expect(() => validateSanitizedManifest(mutant)).toThrow(
        "HOLDOUT_MANIFEST_INVALID",
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("08 HOLDOUT_CASE_COUNT_DRIFT: clean control exits zero and rehashed case-count drift rejects", () => {
    const fixture = createOwnerRoot();
    try {
      const control = verifyOwnerHoldout(fixture.root).manifest;
      expect(() => validateSanitizedManifest(control)).not.toThrow();
      const mutant = structuredClone(control) as unknown as Record<
        string,
        unknown
      >;
      mutant.case_count = 2;
      rehashManifest(mutant);
      expect(() => validateSanitizedManifest(mutant)).toThrow(
        "HOLDOUT_MANIFEST_INVALID",
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("09 HOLDOUT_MANIFEST_DIGEST_BYPASS: clean control exits zero and coordinated file/self-rehash rejects external truth", () => {
    const fixture = createOwnerRoot();
    try {
      const snapshot = verifyOwnerHoldout(fixture.root);
      expect(() => {
        assertManifestMatchesSnapshot(snapshot.manifest, snapshot);
      }).not.toThrow();
      const mutant = structuredClone(snapshot.manifest) as unknown as Record<
        string,
        unknown
      >;
      first(mutant.files as Record<string, unknown>[]).content_digest =
        digest("f");
      rehashManifest(mutant);
      const internallyValid = validateSanitizedManifest(mutant);
      expect(() => {
        assertManifestMatchesSnapshot(internallyValid, snapshot);
      }).toThrow("HOLDOUT_MANIFEST_INVALID");
    } finally {
      fixture.cleanup();
    }
  });

  it("10 OWNER_PATH_TRAVERSAL: clean control exits zero and parent traversal rejects", () => {
    expect(() => validateRelativePath("cases/holdout-a.v1.json")).not.toThrow();
    expect(() => validateRelativePath("../private/answer.json")).toThrow(
      "HOLDOUT_PATH_INVALID",
    );
  });

  it("11 OWNER_SYMLINK_ESCAPE: clean control exits zero and hidden-file symlink rejects", () => {
    const fixture = createOwnerRoot();
    try {
      expect(() => verifyOwnerHoldout(fixture.root)).not.toThrow();
      const target = join(fixture.root, "symlink-target.json");
      writeFileSync(target, readFileSync(fixture.bodyPath));
      rmSync(fixture.bodyPath);
      symlinkSync(target, fixture.bodyPath);
      expect(() => verifyOwnerHoldout(fixture.root)).toThrow(
        "HOLDOUT_STORAGE_INVALID",
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("12 APPEND_ONLY_ROW_MUTATION: clean append exits zero and historical replacement rejects", () => {
    const header =
      "| Execution ID | Date | Gate | Bundle manifest digest | Commit | Tree | Runner revision | Result artifact digest | Executor role | Outcome |\n|---|---|---|---|---|---|---|---|---|---|\n";
    const row = `| execution_00000000000000000000000001 | 2026-08-10 | AUTOFILL_FEASIBILITY | ${digest("a")} | ${"1".repeat(40)} | ${"2".repeat(40)} | ${"3".repeat(40)} | ${digest("b")} | ROLE_REVIEWER | PASS |\n`;
    expect(() => {
      validateAppendOnlyLog(header, header + row);
    }).not.toThrow();
    expect(() => {
      validateAppendOnlyLog(header + row, header + row.replace("PASS", "FAIL"));
    }).toThrow("HOLDOUT_LOG_PREFIX_MUTATION");
  });

  it("13 HISTORICAL_EXPECTATION_OVERWRITE: clean history append exits zero and old-v1 overwrite rejects", () => {
    const previous = computeCorpus().versionIndex as unknown as VersionIndexV1;
    const current: VersionIndexV1 = {
      ...previous,
      versions: [
        ...previous.versions,
        {
          corpus_id: first(previous.versions).corpus_id,
          corpus_version: "2.0.0",
          corpus_digest: digest("2"),
          source_tree: "4".repeat(40),
          manifest_path: "artifacts/2.0.0/corpus.manifest.json",
        },
      ],
      corrections: [
        ...previous.corrections,
        correction(first(previous.versions).corpus_digest),
      ],
    };
    expect(() => {
      validateVersionIndexAppend(previous, current);
    }).not.toThrow();
    const mutant = structuredClone(current);
    Object.assign(first(mutant.versions), { corpus_digest: digest("f") });
    expect(() => {
      validateVersionIndexAppend(previous, mutant);
    }).toThrow("CORPUS_VERSION_HISTORY_MUTATION");
  });

  it("14 VERSION_BUMP_BYPASS: clean full-major correction exits zero and minor rewrite rejects", () => {
    expect(() => {
      validateCorrectionRecord(correction());
    }).not.toThrow();
    expect(() => {
      validateCorrectionRecord({ ...correction(), new_version: "1.1.0" });
    }).toThrow("CORRECTION_FULL_VERSION");
  });

  it("15 GATE_AUTHORITY_INJECTION: clean control exits zero and rehashed authority injection rejects", () => {
    expect(() => validateCommittedManifest(corpusRecord())).not.toThrow();
    const mutant = corpusRecord();
    mutant.gate_authority = "PASS";
    rehashCorpus(mutant);
    expect(() => validateCommittedManifest(mutant)).toThrow(
      "CORPUS_MANIFEST_PROFILE",
    );
  });
});
