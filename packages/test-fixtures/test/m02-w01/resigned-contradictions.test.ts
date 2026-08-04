import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { validateFixtureConsistency } from "../../src/consistency.ts";
import { loadFixtureCorpus } from "../../src/loader.ts";
import type {
  AnswerScenario,
  EvidenceArtifact,
  ExpectedSupportedClaim,
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
  "answer-scenarios.v2.json": AnswerScenario;
  "evidence-artifacts.v2.json": EvidenceArtifact;
  "expected-requirements.v2.json": ExpectedRequirement;
  "expected-supported-claims.v2.json": ExpectedSupportedClaim;
  "field-value-policies.v2.json": FieldValuePolicy;
  "jobs.v2.json": SyntheticJob;
  "profiles.v2.json": SyntheticProfile;
  "scenario-bundles.v2.json": ScenarioBundle;
  "source-resumes.v2.json": SourceResume;
}

interface OracleTruth {
  critical_results: {
    scenario: string;
    requirement: string;
    classification: string;
    action: string;
    result_type: string;
    result: string;
    release_eligible: boolean;
    evidence_refs: string[];
    reason_code: string | null;
    rationale: string;
  }[];
  stale_policies: {
    scenario: string;
    policy: string;
    action: string;
    release_eligible: boolean;
  }[];
  profile_field_control: {
    profile: string;
    authorization_status: string;
    sponsorship_required: boolean;
    relocation: string;
    assertion: string;
    assertion_effective_start: string;
    work_authorization_record: string;
    work_authorization_value: string;
    work_authorization_disclosure: string;
    sponsorship_record: string;
    sponsorship_value: string;
    sponsorship_disclosure: string;
  };
  resume_11: {
    resume: string;
    rationale: string;
  };
}

function oracleTruth(): OracleTruth {
  return JSON.parse(
    readFileSync(
      new URL("oracles/development-truth.v2.json", import.meta.url),
      "utf8",
    ),
  ) as OracleTruth;
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

function criticalResultSnapshot(
  root: string,
  scenarioId: string,
  requirementId: string,
): OracleTruth["critical_results"][number] {
  const loaded = loadFixtureCorpus(root);
  const scenario = loaded.scenarioBundles.find(
    (candidate) => candidate.id === scenarioId,
  );
  const evaluation = scenario?.evaluations.find(
    (candidate) => candidate.requirement_ref === requirementId,
  );
  const claim = loaded.expectedSupportedClaims.find(
    (candidate) => candidate.id === evaluation?.result_ref,
  );
  const gap = loaded.unsupportedGaps.find(
    (candidate) => candidate.id === evaluation?.result_ref,
  );
  const result = claim ?? gap;
  if (
    scenario === undefined ||
    evaluation === undefined ||
    result === undefined
  ) {
    throw new Error("critical oracle mutation input missing");
  }
  return {
    scenario: scenario.id,
    requirement: evaluation.requirement_ref,
    classification: evaluation.classification,
    action: evaluation.expected_action,
    result_type: evaluation.result_type,
    result: evaluation.result_ref,
    release_eligible: claim?.release_eligible ?? false,
    evidence_refs:
      claim?.evidence_refs ?? gap?.related_or_contradicting_evidence_refs ?? [],
    reason_code: gap?.reason_code ?? null,
    rationale: result.support_review_rationale,
  };
}

function expectedCriticalResult(
  scenarioId: string,
  requirementId: string,
): OracleTruth["critical_results"][number] {
  const expected = oracleTruth().critical_results.find(
    (candidate) =>
      candidate.scenario === scenarioId &&
      candidate.requirement === requirementId,
  );
  if (expected === undefined) {
    throw new Error("critical oracle expectation missing");
  }
  return expected;
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
    // Since M02-W02 the same policy also backs an explicit answer scenario;
    // the coherent drift must carry through that layer to stay
    // validator-accepted, which is exactly what the oracle then catches.
    mutateCollection(root, "answer-scenarios.v2.json", (scenarios) => {
      const scenario = scenarios.find(
        (candidate) =>
          candidate.id === "ansscenario_00000000000000000000000032",
      );
      if (scenario === undefined) {
        throw new Error("answer scenario drift input missing");
      }
      scenario.expected_outcome = "BLOCKED_BY_POLICY";
      scenario.expected_action = "BLOCK_AND_EXPLAIN";
      scenario.release_eligible = false;
      delete scenario.answer;
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
      coherent_policy_control: {
        scenario: string;
        outcome: string;
        policy: string;
        kind: string;
        action: string;
        release_eligible: boolean;
      };
    };
    const scenario = loaded.scenarioBundles.find(
      (candidate) => candidate.id === oracle.coherent_policy_control.scenario,
    );
    const policy = loaded.fieldValuePolicies.find(
      (candidate) => candidate.id === oracle.coherent_policy_control.policy,
    );
    const evaluation = scenario?.policy_evaluations.find(
      (candidate) =>
        candidate.policy_ref === oracle.coherent_policy_control.policy,
    );
    expect({
      scenario: scenario?.id,
      outcome: scenario?.expected_outcome,
      policy: policy?.id,
      kind: policy?.policy,
      action: evaluation?.expected_action,
      release_eligible: evaluation?.release_eligible,
    }).not.toEqual(oracle.coherent_policy_control);
  });

  test("independent oracle catches every repaired acceptance-critical mutation", () => {
    const claim71Root = copy();
    mutateCollection(
      claim71Root,
      "expected-supported-claims.v2.json",
      (claims) => {
        const claim = claims.find(
          (candidate) =>
            candidate.scenario_ref === "scenario_00000000000000000000000033" &&
            candidate.requirement_ref ===
              "requirement_00000000000000000000000031",
        );
        if (claim === undefined) {
          throw new Error("claim 71 oracle mutation input missing");
        }
        claim.evidence_refs = ["evidence_00000000000000000000000062"];
      },
    );
    fullyResignCorpus(claim71Root);
    expect(
      criticalResultSnapshot(
        claim71Root,
        "scenario_00000000000000000000000033",
        "requirement_00000000000000000000000031",
      ),
    ).not.toEqual(
      expectedCriticalResult(
        "scenario_00000000000000000000000033",
        "requirement_00000000000000000000000031",
      ),
    );

    const claim15Root = copy();
    mutateCollection(claim15Root, "scenario-bundles.v2.json", (scenarios) => {
      const scenario = scenarios.find(
        (candidate) => candidate.id === "scenario_00000000000000000000000006",
      );
      const evaluation = scenario?.evaluations.find(
        (candidate) =>
          candidate.requirement_ref ===
          "requirement_00000000000000000000000025",
      );
      if (evaluation === undefined) {
        throw new Error("claim 15 oracle mutation input missing");
      }
      evaluation.classification = "STRONG_RELATED";
      evaluation.expected_action = "USE_SUPPORTED_EVIDENCE";
    });
    fullyResignCorpus(claim15Root);
    expect(
      criticalResultSnapshot(
        claim15Root,
        "scenario_00000000000000000000000006",
        "requirement_00000000000000000000000025",
      ),
    ).not.toEqual(
      expectedCriticalResult(
        "scenario_00000000000000000000000006",
        "requirement_00000000000000000000000025",
      ),
    );

    const rationaleRoot = copy();
    mutateCollection(
      rationaleRoot,
      "expected-supported-claims.v2.json",
      (claims) => {
        const claim = claims.find(
          (candidate) =>
            candidate.scenario_ref === "scenario_00000000000000000000000033" &&
            candidate.requirement_ref ===
              "requirement_00000000000000000000000031",
        );
        if (claim === undefined) {
          throw new Error("rationale oracle mutation input missing");
        }
        claim.support_review_rationale =
          "This coherent-length mutation no longer describes the cited evidence.";
      },
    );
    fullyResignCorpus(rationaleRoot);
    expect(
      criticalResultSnapshot(
        rationaleRoot,
        "scenario_00000000000000000000000033",
        "requirement_00000000000000000000000031",
      ),
    ).not.toEqual(
      expectedCriticalResult(
        "scenario_00000000000000000000000033",
        "requirement_00000000000000000000000031",
      ),
    );

    const staleRoot = copy();
    mutateCollection(staleRoot, "scenario-bundles.v2.json", (scenarios) => {
      const scenario = scenarios.find(
        (candidate) => candidate.id === "scenario_00000000000000000000000007",
      );
      const evaluation = scenario?.policy_evaluations.find(
        (candidate) =>
          candidate.policy_ref === "policy_00000000000000000000000015",
      );
      if (evaluation === undefined) {
        throw new Error("stale policy oracle mutation input missing");
      }
      evaluation.expected_action = "USE_SUPPORTED_EVIDENCE";
      evaluation.release_eligible = true;
    });
    fullyResignCorpus(staleRoot);
    const staleLoaded = loadFixtureCorpus(staleRoot);
    const staleScenario = staleLoaded.scenarioBundles.find(
      (candidate) => candidate.id === "scenario_00000000000000000000000007",
    );
    const staleEvaluation = staleScenario?.policy_evaluations.find(
      (candidate) =>
        candidate.policy_ref === "policy_00000000000000000000000015",
    );
    const staleExpected = oracleTruth().stale_policies.find(
      (candidate) => candidate.policy === "policy_00000000000000000000000015",
    );
    expect({
      scenario: staleScenario?.id,
      policy: staleEvaluation?.policy_ref,
      action: staleEvaluation?.expected_action,
      release_eligible: staleEvaluation?.release_eligible,
    }).not.toEqual({
      scenario: staleExpected?.scenario,
      policy: staleExpected?.policy,
      action: staleExpected?.action,
      release_eligible: staleExpected?.release_eligible,
    });

    const couplingRoot = copy();
    mutateCollection(couplingRoot, "profiles.v2.json", (profiles) => {
      const profile = profiles.find(
        (candidate) => candidate.id === "profile_00000000000000000000000001",
      );
      if (profile === undefined) {
        throw new Error("coupling oracle mutation input missing");
      }
      profile.work_authorization.status = "REQUIRES_SPONSORSHIP";
      profile.work_authorization.sponsorship_required = true;
    });
    mutateCollection(
      couplingRoot,
      "evidence-artifacts.v2.json",
      (artifacts) => {
        const assertion = artifacts.find(
          (candidate) => candidate.id === "evidence_00000000000000000000000006",
        );
        const authorization = assertion?.field_records.find(
          (candidate) => candidate.field_concept === "WORK_AUTHORIZATION",
        );
        const sponsorship = assertion?.field_records.find(
          (candidate) => candidate.field_concept === "SPONSORSHIP_REQUIREMENT",
        );
        if (authorization === undefined || sponsorship === undefined) {
          throw new Error("coupling field oracle mutation input missing");
        }
        authorization.recorded_value = "REQUIRES_SPONSORSHIP";
        authorization.disclosure_text =
          "Synthetic Candidate 01 explicitly approved work authorization value REQUIRES_SPONSORSHIP.";
        sponsorship.recorded_value = "REQUIRED";
        sponsorship.disclosure_text =
          "Synthetic Candidate 01 explicitly approved sponsorship requirement value REQUIRED.";
      },
    );
    fullyResignCorpus(couplingRoot);
    const couplingLoaded = loadFixtureCorpus(couplingRoot);
    const coupledProfile = couplingLoaded.profiles.find(
      (candidate) =>
        candidate.id === oracleTruth().profile_field_control.profile,
    );
    expect({
      profile: coupledProfile?.id,
      authorization_status: coupledProfile?.work_authorization.status,
      sponsorship_required:
        coupledProfile?.work_authorization.sponsorship_required,
    }).not.toEqual({
      profile: oracleTruth().profile_field_control.profile,
      authorization_status:
        oracleTruth().profile_field_control.authorization_status,
      sponsorship_required:
        oracleTruth().profile_field_control.sponsorship_required,
    });

    const futureRoot = copy();
    mutateCollection(futureRoot, "evidence-artifacts.v2.json", (artifacts) => {
      const assertion = artifacts.find(
        (candidate) => candidate.id === "evidence_00000000000000000000000006",
      );
      if (assertion === undefined) {
        throw new Error("future assertion oracle mutation input missing");
      }
      assertion.effective_period.start = "2026-07-30";
    });
    fullyResignCorpus(futureRoot);
    const futureAssertion = loadFixtureCorpus(
      futureRoot,
    ).evidenceArtifacts.find(
      (candidate) =>
        candidate.id === oracleTruth().profile_field_control.assertion,
    );
    expect(futureAssertion?.effective_period.start).not.toBe(
      oracleTruth().profile_field_control.assertion_effective_start,
    );

    const pageRoot = copy();
    mutateCollection(pageRoot, "source-resumes.v2.json", (resumes) => {
      const resume = resumes.find(
        (candidate) => candidate.id === oracleTruth().resume_11.resume,
      );
      if (resume?.page_boundary === undefined) {
        throw new Error("page-boundary oracle mutation input missing");
      }
      resume.page_boundary.rationale =
        "This plausible-length mutation falsely describes the reviewed page split.";
    });
    fullyResignCorpus(pageRoot);
    const pageResume = loadFixtureCorpus(pageRoot).sourceResumes.find(
      (candidate) => candidate.id === oracleTruth().resume_11.resume,
    );
    expect(pageResume?.page_boundary?.rationale).not.toBe(
      oracleTruth().resume_11.rationale,
    );

    const contradictionRoot = copy();
    mutateCollection(
      contradictionRoot,
      "scenario-bundles.v2.json",
      (scenarios) => {
        const scenario = scenarios.find(
          (candidate) => candidate.id === "scenario_00000000000000000000000029",
        );
        const evaluation = scenario?.evaluations.find(
          (candidate) =>
            candidate.requirement_ref ===
            "requirement_00000000000000000000000059",
        );
        if (scenario === undefined || evaluation === undefined) {
          throw new Error("scenario 29 oracle mutation input missing");
        }
        evaluation.classification = "USER_ASSERTED";
        evaluation.expected_action = "USE_SUPPORTED_EVIDENCE";
        scenario.expected_outcome = "ABSTAIN";
      },
    );
    fullyResignCorpus(contradictionRoot);
    expect(
      criticalResultSnapshot(
        contradictionRoot,
        "scenario_00000000000000000000000029",
        "requirement_00000000000000000000000059",
      ),
    ).not.toEqual(
      expectedCriticalResult(
        "scenario_00000000000000000000000029",
        "requirement_00000000000000000000000059",
      ),
    );
  });
});
