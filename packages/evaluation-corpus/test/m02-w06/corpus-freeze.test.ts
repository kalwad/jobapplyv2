import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalFile,
  sha256Bytes,
  sha256Canonical,
  withoutKey,
} from "../../src/canonical.ts";
import {
  CORPUS_MANIFEST_FILE,
  COVERAGE_SUMMARY_FILE,
  REPOSITORY_ROOT,
  VERSION_INDEX_FILE,
  checkCorpus,
  checkPublicPrivacy,
  computeArtifacts,
  computeCorpus,
  sourceInventory,
  validateCommittedManifest,
  validateVisibleHoldoutInventory,
} from "../../src/corpus.ts";
import { CORPUS_ID, CORPUS_VERSION } from "../../src/model.ts";
import { parseStrictJson } from "../../src/strict-json.ts";

describe("M02-W06 frozen public corpus", () => {
  it("uses the exact immutable corpus identity", () => {
    const { manifest } = computeCorpus();
    expect(manifest.corpus_id).toBe("M02_AUTOFILL_DEVELOPMENT_V1");
    expect(manifest.corpus_version).toBe("1.0.0");
    expect(manifest.corpus_state).toBe("FROZEN");
  });

  it("has no critical-gate authority", () => {
    expect(computeCorpus().manifest.gate_authority).toBe("NONE");
  });

  it("is evaluation-only and non-production", () => {
    const { manifest } = computeCorpus();
    expect(manifest.classification).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
    expect(manifest.data_classification).toEqual(["PUBLIC", "SYNTHETIC"]);
    expect(manifest.benchmark_family).toBe("AUTOFILL_FEASIBILITY");
    expect(manifest.provenance).toEqual({
      owner: "M02-W06",
      freeze_source: "EXACT_REPOSITORY_TREE",
      generator_package: "@japp/evaluation-corpus",
      generator_version: "0.0.1",
      checker_version: "1.0.0",
    });
  });

  it("commits the exact starting source tree", () => {
    expect(computeCorpus().manifest.source_tree).toBe(
      "2d52740dc164c51d7b3741b91045095bf92c8441",
    );
  });

  it("wraps rather than rewrites the W01/W02 mutable source commitment", () => {
    expect(computeCorpus().manifest.source_fixture_commitment).toEqual({
      id: "manifest_00000000000000000000000001",
      version: "0.3.0",
      digest:
        "sha256:122cb8275fab93c9cdd92dda8eb8bbe3ab28b2ced44a5cf2cf90a5787f8fe35f",
    });
  });

  it("recomputes the corpus digest from the complete payload", () => {
    const { manifest } = computeCorpus();
    expect(manifest.corpus_digest).toBe(
      sha256Canonical(
        withoutKey(
          manifest as unknown as Record<string, unknown>,
          "corpus_digest",
        ),
      ),
    );
  });

  it("commits the coverage digest without a circular corpus back-reference", () => {
    const { manifest, coverage } = computeCorpus();
    expect(manifest.coverage_summary_digest).toBe(coverage.coverage_digest);
    expect("corpus_digest" in coverage).toBe(false);
  });

  it("has a strictly sorted unique artifact inventory", () => {
    const paths = computeArtifacts().map(({ path }) => path);
    expect(paths).toEqual([...paths].sort());
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("hashes exact source bytes", () => {
    for (const artifact of computeArtifacts()) {
      expect(artifact.content_digest).toBe(
        sha256Bytes(readFileSync(join(REPOSITORY_ROOT, artifact.path))),
      );
      expect(artifact.byte_count).toBe(
        readFileSync(join(REPOSITORY_ROOT, artifact.path)).byteLength,
      );
    }
  });

  it("directly includes both fixture truth oracles", () => {
    const paths = new Set(sourceInventory().map(({ path }) => path));
    expect(
      paths.has(
        "packages/test-fixtures/test/m02-w01/oracles/development-truth.v2.json",
      ),
    ).toBe(true);
    expect(
      paths.has(
        "packages/test-fixtures/test/m02-w02/oracles/answer-truth.v2.json",
      ),
    ).toBe(true);
  });

  it("directly includes mock expected transitions and all 44 semantic site files", () => {
    const inventory = sourceInventory();
    expect(
      inventory.some(
        ({ path }) =>
          path === "e2e/mock-ats-lab/support/expected-transitions.ts",
      ),
    ).toBe(true);
    expect(
      inventory.filter(({ role }) => role === "PUBLIC_FORM_VARIANT"),
    ).toHaveLength(44);
  });

  it("excludes the mock favicon and built output", () => {
    const paths = sourceInventory().map(({ path }) => path);
    expect(
      paths.some(
        (path) => path.includes("favicon.svg") || path.includes("/dist/"),
      ),
    ).toBe(false);
  });

  it("directly includes the W04 literal oracle and source manifest", () => {
    const paths = new Set(sourceInventory().map(({ path }) => path));
    expect(
      paths.has(
        "packages/evaluation-baselines/test/m02-w04/oracles/baseline-truth.v1.json",
      ),
    ).toBe(true);
    expect(
      paths.has("packages/evaluation-baselines/baseline.manifest.json"),
    ).toBe(true);
  });

  it("includes the transitive benchmark schema closure and semantic rules", () => {
    const { manifest } = computeCorpus();
    const paths = sourceInventory().map(({ path }) => path);
    expect(paths).toContain(
      "packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json",
    );
    expect(paths).toContain("packages/contracts/generator/semantic-rules.ts");
    expect(manifest.schema_versions).toHaveLength(24);
    expect(manifest.schema_versions).toContainEqual({
      schema_ref: "urn:japp:schema:benchmark:case:v1",
      schema_version: "1.0.0",
    });
    expect(
      manifest.artifacts.filter(
        ({ applicable_schema }) => applicable_schema.state === "APPLICABLE",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("excludes runner, model-lock, prompt registry, and hidden bodies", () => {
    const paths = sourceInventory().map(({ path }) => path);
    expect(
      paths.some(
        (path) =>
          path.includes("evaluation-runner") ||
          path.includes("model-lock") ||
          path.includes("prompts/registry") ||
          path.includes("holdout-manifests"),
      ),
    ).toBe(false);
  });

  it("commits 683 unique producer-owned record identities", () => {
    const artifacts = computeArtifacts();
    const ids = artifacts.flatMap(({ record_ids }) => record_ids);
    expect(ids).toHaveLength(683);
    expect(new Set(ids).size).toBe(683);
  });

  it("keeps expected-truth flags bound to expected-truth roles", () => {
    const { manifest } = computeCorpus();
    for (const artifact of manifest.artifacts) {
      expect(artifact.expected_truth).toBe(
        artifact.role === "PUBLIC_EXPECTED_TRUTH",
      );
    }
    expect(manifest.artifact_role_counts).toEqual({
      PUBLIC_BASELINE: 16,
      PUBLIC_DEVELOPMENT_INPUT: 6,
      PUBLIC_EXPECTED_TRUTH: 12,
      PUBLIC_FORM_VARIANT: 44,
      SCHEMA_SEMANTICS: 25,
    });
  });

  it("keeps generated artifacts byte-canonical and read-only check clean", () => {
    expect(() => {
      checkCorpus();
    }).not.toThrow();
    expect(() => {
      checkPublicPrivacy();
    }).not.toThrow();
    expect(readFileSync(CORPUS_MANIFEST_FILE, "utf8")).toBe(
      canonicalFile(computeCorpus().manifest),
    );
    expect(readFileSync(COVERAGE_SUMMARY_FILE, "utf8")).toBe(
      canonicalFile(computeCorpus().coverage),
    );
    expect(readFileSync(VERSION_INDEX_FILE, "utf8")).toBe(
      canonicalFile(computeCorpus().versionIndex),
    );
  });

  it("rejects both historical and executable owner mappings from the public directory", () => {
    for (const mappingFile of ["mapping.v1.json", "mapping.v2.json"]) {
      expect(() => {
        validateVisibleHoldoutInventory([mappingFile]);
      }).toThrow("CORPUS_PRIVACY_MAPPING_COMMITTED");
    }
  });

  it("strictly parses the committed manifest and validates its self-digest", () => {
    const parsed = parseStrictJson(readFileSync(CORPUS_MANIFEST_FILE, "utf8"));
    expect(validateCommittedManifest(parsed).corpus_id).toBe(CORPUS_ID);
    expect(validateCommittedManifest(parsed).corpus_version).toBe(
      CORPUS_VERSION,
    );
  });
});
