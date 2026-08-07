// LEGACY_BEHAVIOR_OBSERVATION contract: the committed truthful records
// validate, a synthetic CAPTURED record validates, and every isolation
// violation (copied code, missing provenance, inconsistent states,
// credentials, traversal, nondeterministic identity) fails closed.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  BaselineValidationError,
  LEGACY_OBSERVATION_FILE,
  loadCommittedLegacyObservations,
  PACKAGE_ROOT,
  sha256Bytes,
  validateLegacyObservationFile,
} from "../../src/index.ts";
import { loadOracle } from "./support/inputs.ts";

const oracle = loadOracle();

function validCapturedFile(): Record<string, unknown> {
  return {
    file_version: "1.0.0",
    classification: ["EVALUATION_ONLY", "NON_PRODUCTION"],
    isolation_statement:
      "Synthetic in-memory positive control for the capture contract; no legacy code is present.",
    records: [
      {
        id: "legacyobs_00000000000000000000000009",
        record_version: "1.0.0",
        system: "LEGACY_JOBAPPLY",
        system_display_name: "kalwad/JobApply (isolated test double)",
        repository_url: "https://github.com/kalwad/JobApply",
        source_revision: "c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd",
        observation_status: "CAPTURED",
        observation_date: "2026-08-07",
        observer: "m02w04-lead-author",
        environment:
          "Temporary isolated checkout outside the writer repository; synthetic fixtures only.",
        procedure: [
          "Loaded the synthetic development form fixture in the isolated environment and recorded field outcomes manually.",
        ],
        fixture_inputs: [
          {
            fixture_id: "profile_00000000000000000000000001",
            content_digest: `sha256:${"a".repeat(64)}`,
          },
        ],
        observed_output_digest: `sha256:${"b".repeat(64)}`,
        structured_observations: [
          "Filled 3 of 5 ordinary synthetic fields; skipped both selects without reporting them.",
        ],
        safety_observations: [
          "Selected the only visible option although it did not match the approved value.",
        ],
        failure_or_unavailability_reason: null,
        source_code_viewed: false,
        code_copied: false,
        comparable: true,
        classification: "NON_PRODUCTION",
        license_provenance:
          "License NOASSERTION; behavior observed only, no source viewed or copied (REQ-GATE-007).",
        regression_fixture_refs: [],
        provenance: {
          authored_in: "M02-W04",
          author: "m02w04-lead-author",
          reviewer: "m02w04-baseline-reviewer",
          reviewed_on: "2026-08-07",
        },
      },
    ],
  };
}

function mutate(
  transform: (file: Record<string, unknown>) => void,
): Record<string, unknown> {
  const file = validCapturedFile();
  transform(file);
  return file;
}

function firstRecord(file: Record<string, unknown>): Record<string, unknown> {
  const records = file.records as Record<string, unknown>[];
  const record = records[0];
  if (record === undefined) {
    throw new Error("test file has no record");
  }
  return record;
}

function expectRejection(file: Record<string, unknown>, code: string): void {
  try {
    validateLegacyObservationFile(file);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BaselineValidationError);
    expect((error as BaselineValidationError).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection with ${code}`);
}

describe("committed legacy observation records", () => {
  test("the committed file validates with exactly the oracle's records", () => {
    const file = loadCommittedLegacyObservations();
    expect(file.records.length).toBe(oracle.legacy_observations.record_count);
    const bytes = readFileSync(join(PACKAGE_ROOT, LEGACY_OBSERVATION_FILE));
    expect(sha256Bytes(bytes)).toBe(oracle.legacy_observations.file_sha256);
  });

  test("the CareerPulse record is truthfully UNAVAILABLE with an explicit reason", () => {
    const file = loadCommittedLegacyObservations();
    const record = file.records.find((entry) => entry.system === "CAREERPULSE");
    const truth = oracle.legacy_observations.careerpulse;
    expect(record?.id).toBe(truth.id);
    expect(record?.observation_status).toBe(truth.observation_status);
    expect(record?.repository_url).toBe(truth.repository_url);
    expect(record?.source_revision).toBe(truth.source_revision);
    expect(record?.source_code_viewed).toBe(false);
    expect(record?.code_copied).toBe(false);
    expect(record?.comparable).toBe(false);
    expect(record?.failure_or_unavailability_reason).toContain("M02-W13");
    expect(record?.structured_observations.length).toBe(0);
  });

  test("the legacy JobApply record pins probed identity while capture stays NOT_ATTEMPTED", () => {
    const file = loadCommittedLegacyObservations();
    const record = file.records.find(
      (entry) => entry.system === "LEGACY_JOBAPPLY",
    );
    const truth = oracle.legacy_observations.legacy_jobapply;
    expect(record?.id).toBe(truth.id);
    expect(record?.observation_status).toBe("NOT_ATTEMPTED");
    expect(record?.repository_url).toBe(truth.repository_url);
    expect(record?.source_revision).toBe(truth.source_revision);
    expect(record?.source_code_viewed).toBe(false);
    expect(record?.code_copied).toBe(false);
    expect(record?.comparable).toBe(false);
    expect(record?.license_provenance).toContain("NOASSERTION");
    expect(record?.procedure.join(" ")).toContain("metadata only");
    expect(record?.observed_output_digest).toBeNull();
  });
});

describe("legacy observation validation", () => {
  test("a complete synthetic CAPTURED record validates", () => {
    const file = validateLegacyObservationFile(validCapturedFile());
    expect(file.records.length).toBe(1);
    expect(file.records[0]?.observation_status).toBe("CAPTURED");
    expect(file.records[0]?.comparable).toBe(true);
  });

  test("malformed provenance is rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).provenance = {
          authored_in: "M02-W04",
          author: "m02w04-lead-author",
        };
      }),
      "LEGACY_OBSERVATION_KEY_SET",
    );
  });

  test("a CAPTURED record without an exact source revision is rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).source_revision = null;
      }),
      "LEGACY_OBSERVATION_CAPTURE_REVISION",
    );
  });

  test("copied source snippets are rejected in every free-text field", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).structured_observations = [
          "const fill = (element) => element.value = approved;",
        ];
      }),
      "LEGACY_OBSERVATION_SOURCE_SNIPPET",
    );
    expectRejection(
      mutate((file) => {
        firstRecord(file).environment = "captured via require('./legacy')";
      }),
      "LEGACY_OBSERVATION_SOURCE_SNIPPET",
    );
    expectRejection(
      mutate((file) => {
        firstRecord(file).procedure = ["```js copied legacy block```"];
      }),
      "LEGACY_OBSERVATION_SOURCE_SNIPPET",
    );
  });

  test("code_copied can never be true", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).code_copied = true;
      }),
      "LEGACY_OBSERVATION_CODE_COPIED",
    );
  });

  test("inconsistent comparability is rejected for non-captured records", () => {
    expectRejection(
      mutate((file) => {
        const record = firstRecord(file);
        record.observation_status = "UNAVAILABLE";
        record.fixture_inputs = [];
        record.observed_output_digest = null;
        record.structured_observations = [];
        record.failure_or_unavailability_reason = "not runnable in session";
        record.comparable = true;
      }),
      "LEGACY_OBSERVATION_COMPARABILITY",
    );
  });

  test("a non-captured record with observation payload is rejected", () => {
    expectRejection(
      mutate((file) => {
        const record = firstRecord(file);
        record.observation_status = "NOT_ATTEMPTED";
        record.comparable = false;
        record.failure_or_unavailability_reason = "not attempted";
      }),
      "LEGACY_OBSERVATION_UNCAPTURED_INPUTS",
    );
  });

  test("a non-captured record without a reason is rejected", () => {
    expectRejection(
      mutate((file) => {
        const record = firstRecord(file);
        record.observation_status = "UNRUNNABLE";
        record.fixture_inputs = [];
        record.observed_output_digest = null;
        record.structured_observations = [];
        record.comparable = false;
        record.failure_or_unavailability_reason = null;
      }),
      "LEGACY_OBSERVATION_MISSING_REASON",
    );
  });

  test("unknown fields, duplicate ids, and unknown enums are rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).extra_field = "x";
      }),
      "LEGACY_OBSERVATION_KEY_SET",
    );
    expectRejection(
      mutate((file) => {
        file.records = [firstRecord(file), firstRecord(validCapturedFile())];
      }),
      "LEGACY_OBSERVATION_DUPLICATE_ID",
    );
    expectRejection(
      mutate((file) => {
        firstRecord(file).observation_status = "MAYBE_CAPTURED";
      }),
      "LEGACY_OBSERVATION_STATUS",
    );
    expectRejection(
      mutate((file) => {
        firstRecord(file).system = "SOME_OTHER_PRODUCT";
      }),
      "LEGACY_OBSERVATION_SYSTEM",
    );
  });

  test("unsafe fixture identifiers and traversal are rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).fixture_inputs = [
          {
            fixture_id: "../../etc/passwd",
            content_digest: `sha256:${"a".repeat(64)}`,
          },
        ];
      }),
      "LEGACY_OBSERVATION_FIXTURE_ID",
    );
  });

  test("credential-shaped text is rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).environment = "auth used token=abc123 secret";
      }),
      "LEGACY_OBSERVATION_CREDENTIAL",
    );
  });

  test("time-derived or random identity shapes are rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).id = "legacyobs_1754580000000";
      }),
      "LEGACY_OBSERVATION_ID",
    );
  });
});
