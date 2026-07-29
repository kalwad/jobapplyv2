import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type {
  FieldValuePolicy,
  ExpectedRequirement,
  FixtureCollection,
  ScenarioBundle,
  SourceResume,
  SyntheticJob,
  SyntheticProfile,
} from "../../src/model.ts";
import {
  fullyResignCorpus,
  jsonBytes,
  makeCorpusCopy,
  readJson,
} from "./helpers/corpus-copy.ts";

const roots: string[] = [];

interface CollectionEntityByFile {
  "expected-requirements.v2.json": ExpectedRequirement;
  "field-value-policies.v2.json": FieldValuePolicy;
  "jobs.v2.json": SyntheticJob;
  "profiles.v2.json": SyntheticProfile;
  "scenario-bundles.v2.json": ScenarioBundle;
  "source-resumes.v2.json": SourceResume;
}

function copy(): string {
  const root = makeCorpusCopy("japp-m02-resigned-");
  roots.push(root);
  return root;
}

function mutateCollection<K extends keyof CollectionEntityByFile>(
  root: string,
  file: K,
  mutate: (items: CollectionEntityByFile[K][]) => void,
): void {
  const path = join(root, file);
  const collection = readJson(path) as FixtureCollection;
  mutate(collection.items as CollectionEntityByFile[K][]);
  writeFileSync(path, jsonBytes(collection));
}

function issueCodes(root: string): string[] {
  const loaded = loadFixtureCorpus(root);
  return validateFixtureConsistency(loaded).issues.map((issue) => issue.code);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(dirname(root), { recursive: true, force: true });
  }
});

describe("M02-W01 fully re-signed semantic contradictions", () => {
  test("rejects an authorization status paired with a false sponsorship flag", () => {
    const root = copy();
    mutateCollection(root, "profiles.v2.json", (profiles) => {
      const profile = profiles[0];
      if (profile === undefined) {
        throw new Error("profile mutation input missing");
      }
      profile.work_authorization = {
        country: "US",
        status: "REQUIRES_SPONSORSHIP",
        sponsorship_required: false,
      } as unknown as SyntheticProfile["work_authorization"];
    });
    fullyResignCorpus(root);
    expect(() => loadFixtureCorpus(root)).toThrow(/FIXTURE_ENTITY_SCHEMA/u);
  });

  test("rejects an authorization job that retains relocation requirement semantics", () => {
    const root = copy();
    mutateCollection(root, "jobs.v2.json", (jobs) => {
      const job = jobs.find(
        (candidate) => candidate.eligibility_constraint === "NONE",
      );
      if (job === undefined) {
        throw new Error("job mutation input missing");
      }
      job.eligibility_constraint = "AUTHORIZED_TO_WORK_IN_US";
    });
    fullyResignCorpus(root);
    expect(issueCodes(root)).toContain("JOB_CONSTRAINT_NOT_SOURCE_LINKED");
  });

  test("rejects a salary policy downgraded to personal and non-consequential", () => {
    const root = copy();
    mutateCollection(root, "field-value-policies.v2.json", (policies) => {
      const salary = policies.find(
        (policy) => policy.field_concept === "SALARY_EXPECTATION",
      );
      if (salary === undefined) {
        throw new Error("salary mutation input missing");
      }
      salary.sensitivity = "PERSONAL";
      salary.consequential = false;
    });
    fullyResignCorpus(root);
    expect(issueCodes(root)).toContain("FIELD_POLICY_CONCEPT_MATRIX");
  });

  test("rejects a duplicate nested resume fact identifier", () => {
    const root = copy();
    mutateCollection(root, "source-resumes.v2.json", (resumes) => {
      const resume = resumes[0];
      if (resume?.facts[0] === undefined || resume.facts[1] === undefined) {
        throw new Error("resume mutation input missing");
      }
      resume.facts[1].fact_id = resume.facts[0].fact_id;
    });
    fullyResignCorpus(root);
    expect(issueCodes(root)).toContain("RESUME_FACT_ID_DUPLICATE");
  });

  test("rejects unrelated source prose even when every linked digest is renewed", () => {
    const root = copy();
    const unrelated =
      "Candidates must bring an unrelated synthetic musical instrument.";
    let anchor = "";
    mutateCollection(root, "jobs.v2.json", (jobs) => {
      const block = jobs[0]?.source_blocks[0];
      if (block === undefined) {
        throw new Error("source mutation input missing");
      }
      anchor = block.anchor_id;
      block.text = unrelated;
      // fullyResignCorpus renews entity, file, manifest, and corpus hashes;
      // this source digest is separately part of the semantic link.
      block.text_sha256 =
        `sha256:${createHash("sha256").update(unrelated).digest("hex")}` as const;
    });
    mutateCollection(root, "expected-requirements.v2.json", (requirements) => {
      const requirement = requirements.find(
        (candidate) => candidate.source_anchor_id === anchor,
      );
      if (requirement === undefined) {
        throw new Error("requirement mutation input missing");
      }
      requirement.normalized_text = unrelated;
      const jobs = readJson(join(root, "jobs.v2.json")) as FixtureCollection;
      const block = (jobs.items[0] as SyntheticJob | undefined)
        ?.source_blocks[0];
      if (block === undefined) {
        throw new Error("linked source mutation input missing");
      }
      requirement.source_text_sha256 = block.text_sha256;
    });
    fullyResignCorpus(root);
    expect(issueCodes(root)).toContain("SOURCE_STRUCTURED_SEMANTICS_DRIFT");
  });

  test("independent oracle catches coherent policy drift accepted by consistency checks", () => {
    const root = copy();
    mutateCollection(root, "field-value-policies.v2.json", (policies) => {
      const policy = policies.find(
        (candidate) => candidate.id === "policy_00000000000000000000000001",
      );
      if (policy === undefined) {
        throw new Error("policy drift input missing");
      }
      policy.policy = "BLOCK_AND_EXPLAIN";
      delete policy.recorded_value;
    });
    mutateCollection(root, "scenario-bundles.v2.json", (scenarios) => {
      const scenario = scenarios.find(
        (candidate) => candidate.id === "scenario_00000000000000000000000001",
      );
      const evaluation = scenario?.policy_evaluations.find(
        (candidate) =>
          candidate.policy_ref === "policy_00000000000000000000000001",
      );
      if (scenario === undefined || evaluation === undefined) {
        throw new Error("scenario drift input missing");
      }
      evaluation.expected_action = "BLOCK_AND_EXPLAIN";
      evaluation.release_eligible = false;
      scenario.expected_outcome = "BLOCK_FIELD_POLICY";
    });
    fullyResignCorpus(root);
    const loaded = loadFixtureCorpus(root);
    expect(validateFixtureConsistency(loaded).valid).toBe(true);
    const oracle = JSON.parse(
      readFileSync(
        new URL("oracles/development-truth.v2.json", import.meta.url),
        "utf8",
      ),
    ) as {
      scenarios: { scenario: string; outcome: string }[];
    };
    const expected = oracle.scenarios.find(
      (scenario) => scenario.scenario === "scenario_00000000000000000000000001",
    );
    expect(loaded.scenarioBundles[0]?.expected_outcome).not.toBe(
      expected?.outcome,
    );
  });
});
