import { sha256Canonical } from "../../src/canonical.ts";
import type {
  AutofillOracle,
  CandidateFields,
  PhysicalAudit,
} from "../../src/autofill.ts";
import { makeCase, required } from "../m02-w05/support/fixtures.ts";
const digest = sha256Canonical("synthetic expected");
export function fixture() {
  const benchmarkCase = makeCase({
    thresholds: [
      {
        metric_id: "CORRECT_FILLS",
        unit: "COUNT",
        comparator: "AT_LEAST",
        expected_value: 1,
      },
    ],
  });
  const oracle: AutofillOracle = {
    format_version: "W13_ORACLE_1",
    case_id: benchmarkCase.case_id,
    fixture_id: "synthetic-w13",
    matrix_version: "1.0.0",
    matrix_digest: sha256Canonical("matrix"),
    corpus_version: benchmarkCase.corpus_version,
    corpus_digest: benchmarkCase.corpus_digest,
    profile_digest: sha256Canonical({ profile: "synthetic" }),
    provenance_digest: sha256Canonical("reviewed synthetic recipe"),
    fields: [
      {
        key: "first",
        concept: "FIRST_NAME",
        required: true,
        visible: true,
        enabled: true,
        class: "ORDINARY",
        supported: true,
        expected: "FILL",
        value_digest: digest,
        option: false,
      },
    ],
  };
  Object.assign(
    required(benchmarkCase.input_artifacts[0], "first fixture item"),
    {
      artifact_digest: sha256Canonical(oracle),
    },
  );
  Object.assign(benchmarkCase, {
    benchmark_family: "AUTOFILL_FEASIBILITY",
    input_artifacts: [
      {
        ...required(benchmarkCase.input_artifacts[0], "first fixture item"),
        schema_ref: "urn:japp:schema:evaluation-artifact:w13-oracle:v1",
      },
      {
        artifact_ref: "artifact_00000000000000000000000002",
        artifact_digest: oracle.profile_digest,
        schema_ref: "urn:japp:schema:evaluation-artifact:w13-input:v1",
      },
    ],
  });
  const candidate: CandidateFields = {
    format_version: "W13_OBSERVATION_1",
    case_id: oracle.case_id,
    oracle_digest: sha256Canonical(oracle),
    fixture_id: oracle.fixture_id,
    matrix_version: oracle.matrix_version,
    matrix_digest: oracle.matrix_digest,
    corpus_version: oracle.corpus_version,
    corpus_digest: oracle.corpus_digest,
    profile_digest: oracle.profile_digest,
    implementation: {
      kind: "IMPLEMENTATION",
      identity: "japp-mv3",
      version: "1.0.0",
    },
    fields: [
      {
        key: "first",
        status: "FILLED",
        observed_digest: digest,
        persistence: "PERSISTED",
        site_acceptance: "ACCEPTED",
        reason: "VERIFIED",
        report_digest: sha256Canonical("actual result"),
      },
    ],
  };
  const audit: PhysicalAudit = {
    format_version: "W13_PHYSICAL_1",
    case_id: oracle.case_id,
    fields: [
      {
        key: "first",
        actions: [{ id: "action-one", kind: "FILL", value_digest: digest }],
      },
    ],
    navigation_activations: 0,
    submission_activations: 0,
  };
  return { benchmarkCase, oracle, candidate, audit };
}
