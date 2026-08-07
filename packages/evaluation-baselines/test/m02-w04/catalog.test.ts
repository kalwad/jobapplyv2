// Catalog, case-matrix, and classification truth for M02-W04, asserted
// against the test-owned literal oracle.
import { describe, expect, test } from "vitest";

import {
  ANSWER_PROMPT_DIGEST,
  BASELINE_CATALOG,
  catalogDigest,
  caseMatrixDigest,
  DEV_CASE_MATRIX,
  GATE_AUTHORITY_STATEMENT,
  RESUME_PROMPT_DIGEST,
} from "../../src/index.ts";
import { corpus, loadOracle } from "./support/inputs.ts";

const oracle = loadOracle();

describe("baseline catalog identity", () => {
  test("catalog version, schema version, and canonical digest match the oracle", () => {
    expect(BASELINE_CATALOG.catalog_version).toBe(
      oracle.catalog.catalog_version,
    );
    expect(BASELINE_CATALOG.schema_version).toBe(oracle.catalog.schema_version);
    expect(catalogDigest()).toBe(oracle.catalog.catalog_digest);
  });

  test("exactly the six reviewed baseline IDs exist, unique, with oracle versions", () => {
    const ids = BASELINE_CATALOG.baselines.map((entry) => entry.baseline_id);
    expect([...ids].sort()).toEqual([...oracle.catalog.baseline_ids]);
    expect(new Set(ids).size).toBe(6);
    for (const entry of BASELINE_CATALOG.baselines) {
      expect(entry.algorithm_version).toBe(
        oracle.catalog.algorithm_versions[entry.baseline_id],
      );
    }
  });

  test("every baseline and the comparison slot carry EVALUATION_ONLY and NON_PRODUCTION", () => {
    for (const entry of [
      ...BASELINE_CATALOG.baselines,
      ...BASELINE_CATALOG.comparison_slots,
    ]) {
      expect([...entry.classification]).toEqual([
        "EVALUATION_ONLY",
        "NON_PRODUCTION",
      ]);
    }
    expect([...BASELINE_CATALOG.classification]).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
  });

  test("no baseline has gate authority and the statement says so explicitly", () => {
    for (const entry of BASELINE_CATALOG.baselines) {
      expect(entry.gate_authority).toBe("NONE");
    }
    expect(BASELINE_CATALOG.gate_authority_statement).toBe(
      GATE_AUTHORITY_STATEMENT,
    );
    expect(GATE_AUTHORITY_STATEMENT).toContain("cannot evaluate");
    expect(GATE_AUTHORITY_STATEMENT).toContain("critical gate");
  });

  test("every baseline carries provenance, limitations, and a distinct contract digest", () => {
    const contractDigests = new Set<string>();
    for (const entry of BASELINE_CATALOG.baselines) {
      expect(entry.provenance.authored_in).toBe("M02-W04");
      expect(entry.provenance.author).not.toBe(entry.provenance.reviewer);
      expect(entry.limitations.length).toBeGreaterThan(0);
      expect(entry.algorithm_contract_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      contractDigests.add(entry.algorithm_contract_digest);
    }
    expect(contractDigests.size).toBe(BASELINE_CATALOG.baselines.length);
  });

  test("one-shot definitions pin prompt identity and the honest no-model execution state", () => {
    const resume = BASELINE_CATALOG.baselines.find(
      (entry) => entry.baseline_id === "baseline_one_shot_resume_generation_v1",
    );
    const answer = BASELINE_CATALOG.baselines.find(
      (entry) => entry.baseline_id === "baseline_one_shot_answer_generation_v1",
    );
    expect(resume?.prompt_id).toBe(oracle.prompts.one_shot_resume.prompt_id);
    expect(resume?.prompt_version).toBe(
      oracle.prompts.one_shot_resume.prompt_version,
    );
    expect(resume?.prompt_digest).toBe(
      oracle.prompts.one_shot_resume.prompt_digest,
    );
    expect(answer?.prompt_id).toBe(oracle.prompts.one_shot_answer.prompt_id);
    expect(answer?.prompt_version).toBe(
      oracle.prompts.one_shot_answer.prompt_version,
    );
    expect(answer?.prompt_digest).toBe(
      oracle.prompts.one_shot_answer.prompt_digest,
    );
    expect(RESUME_PROMPT_DIGEST).toBe(
      oracle.prompts.one_shot_resume.prompt_digest,
    );
    expect(ANSWER_PROMPT_DIGEST).toBe(
      oracle.prompts.one_shot_answer.prompt_digest,
    );
    for (const entry of [resume, answer]) {
      expect(entry?.real_model_execution_state).toBe(
        oracle.catalog.one_shot_execution_state,
      );
      expect(entry?.determinism).toBe("DETERMINISTIC_GIVEN_INJECTED_GENERATOR");
    }
  });

  test("the Simplify comparison slot is truthfully NOT_CAPTURED with its future owners", () => {
    const slot = BASELINE_CATALOG.comparison_slots[0];
    expect(slot.slot_id).toBe(oracle.catalog.simplify_slot.slot_id);
    expect(slot.status).toBe("NOT_CAPTURED");
    expect([...slot.future_execution_owners]).toEqual([
      ...oracle.catalog.simplify_slot.future_execution_owners,
    ]);
    expect(slot.constraints.join(" ")).toContain(
      "no observation is fabricated",
    );
  });
});

describe("development case matrix", () => {
  test("matrix version, exact case count, and canonical digest match the oracle", () => {
    expect(DEV_CASE_MATRIX.matrix_version).toBe(
      oracle.case_matrix.matrix_version,
    );
    expect(DEV_CASE_MATRIX.cases.length).toBe(oracle.case_matrix.case_count);
    expect(caseMatrixDigest()).toBe(oracle.case_matrix.case_matrix_digest);
  });

  test("case IDs are unique, fixed-format ordinals with no time or random identity", () => {
    const ids = DEV_CASE_MATRIX.cases.map((record) => record.case_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [index, id] of ids.entries()) {
      expect(id).toBe(`bcase_${String(index + 1).padStart(26, "0")}`);
    }
  });

  test("every baseline is covered by at least one case and scenarios are unique", () => {
    const covered = new Set(
      DEV_CASE_MATRIX.cases.map((record) => record.baseline_id),
    );
    expect([...covered].sort()).toEqual([...oracle.catalog.baseline_ids]);
    const scenarios = DEV_CASE_MATRIX.cases.map(
      (record) => `${record.kind}:${record.scenario}`,
    );
    expect(new Set(scenarios).size).toBe(scenarios.length);
  });

  test("every fixture binding in the matrix resolves in the committed corpus", () => {
    const loaded = corpus();
    const known = new Set([
      ...loaded.profiles.map((record) => record.id),
      ...loaded.jobs.map((record) => record.id),
      ...loaded.sourceResumes.map((record) => record.id),
      ...loaded.questionCases.map((record) => record.id),
    ]);
    for (const record of DEV_CASE_MATRIX.cases) {
      for (const input of [record.candidate, record.target]) {
        if (input?.source === "FIXTURE") {
          expect(known.has(input.fixture_id)).toBe(true);
        }
      }
      if (record.structured_fixture_id !== undefined) {
        expect(known.has(record.structured_fixture_id)).toBe(true);
      }
      if (record.one_shot !== undefined) {
        expect(known.has(record.one_shot.profile_id)).toBe(true);
        expect(known.has(record.one_shot.job_id)).toBe(true);
        if (record.one_shot.resume_id !== undefined) {
          expect(known.has(record.one_shot.resume_id)).toBe(true);
        }
        if (record.one_shot.question_id !== undefined) {
          expect(known.has(record.one_shot.question_id)).toBe(true);
        }
      }
    }
  });
});
