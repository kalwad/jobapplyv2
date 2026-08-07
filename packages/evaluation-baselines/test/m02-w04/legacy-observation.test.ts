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

const ORDINARY_OBSERVATION_PROSE = [
  "The interface displayed three ordinary fields.",
  "The type field remained empty.",
  "Filled three ordinary fields...",
  "The class field was hidden.",
  "The switch control remained off.",
  "The return value was empty.",
  "The interface loaded after navigation.",
  "The type selector showed no value.",
  "The enum field label was visible.",
  "The application displayed one required field.",
  "The operator selected the first option.",
  "Submit (disabled)",
] as const;

const SOURCE_SHAPED_OBSERVATION_TEXT = [
  "const copied = 1;",
  "let value = 2;",
  "var total = 3;",
  "type Result = string;",
  "interface Result { value: string }",
  "class Result { }",
  "enum Result { One }",
  'import value from "module";',
  'import { value } from "module";',
  "import module as alias",
  "export const value = 1;",
  "export default value;",
  "from module import value",
  "module.exports = value;",
  'require("module");',
  "value + 1;",
  "value - 1;",
  "value * 2;",
  "value / 2;",
  "value % 2;",
  "value + 1 + 2;",
  "total = value;",
  "total += 1;",
  "total -= 1;",
  "total *= 2;",
  "total /= 2;",
  "object.field = value;",
  "run(value);",
  "object.run(value);",
  "console.log(value);",
  "return value;",
  "throw error;",
  "if (ready) {",
  "if (ready) { run(); }",
  "while (ready) {",
  "for (item of items) {",
] as const;

const OBSERVATION_FIELDS = [
  "structured_observations",
  "safety_observations",
] as const;

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
    expect(record?.fixture_inputs).toEqual([]);
    expect(record?.observed_output_digest).toBeNull();
    expect(record?.structured_observations.length).toBe(0);
    expect(record?.safety_observations.length).toBe(0);
    expect(record?.regression_fixture_refs).toEqual([]);
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
    expect(record?.fixture_inputs).toEqual([]);
    expect(record?.observed_output_digest).toBeNull();
    expect(record?.structured_observations).toEqual([]);
    expect(record?.safety_observations).toEqual([]);
    expect(record?.regression_fixture_refs).toEqual([]);
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

  test("a CAPTURED record without a source revision is rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).source_revision = null;
      }),
      "LEGACY_OBSERVATION_CAPTURE_REVISION",
    );
  });

  test.each(["main", "HEAD", "c937e366b9f7"])(
    "a CAPTURED record at mutable or short revision %s is rejected",
    (revision) => {
      expectRejection(
        mutate((file) => {
          firstRecord(file).source_revision = revision;
        }),
        "LEGACY_OBSERVATION_SOURCE_REVISION",
      );
    },
  );

  test("a CAPTURED record without its repository coordinate is rejected", () => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).repository_url = null;
      }),
      "LEGACY_OBSERVATION_CAPTURE_REPOSITORY",
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

  test.each([
    "const copied = 1;",
    "import copied from './legacy.js';",
    "function copied() { return legacyValue; }",
  ])("source-code-shaped structured observation is rejected: %s", (snippet) => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).structured_observations = [snippet];
      }),
      "LEGACY_OBSERVATION_SOURCE_SNIPPET",
    );
  });

  test.each([
    "const copied = 1;",
    "import copied from './legacy.js';",
    "function copied() { return legacyValue; }",
  ])("source-code-shaped safety observation is rejected: %s", (snippet) => {
    expectRejection(
      mutate((file) => {
        firstRecord(file).safety_observations = [snippet];
      }),
      "LEGACY_OBSERVATION_SOURCE_SNIPPET",
    );
  });

  test.each(ORDINARY_OBSERVATION_PROSE)(
    "ordinary behavioral prose remains valid: %s",
    (text) => {
      for (const field of OBSERVATION_FIELDS) {
        const file = mutate((candidate) => {
          firstRecord(candidate)[field] = [text];
        });
        expect(() => validateLegacyObservationFile(file)).not.toThrow();
      }
    },
  );

  test.each(SOURCE_SHAPED_OBSERVATION_TEXT)(
    "source-shaped observation text is rejected: %s",
    (text) => {
      for (const field of OBSERVATION_FIELDS) {
        expectRejection(
          mutate((file) => {
            firstRecord(file)[field] = [text];
          }),
          "LEGACY_OBSERVATION_SOURCE_SNIPPET",
        );
      }
    },
  );

  test("ordinary multiline behavioral prose remains valid", () => {
    const text =
      "The interface displayed three fields.\nThe type field remained empty.";
    for (const field of OBSERVATION_FIELDS) {
      const file = mutate((candidate) => {
        firstRecord(candidate)[field] = [text];
      });
      expect(() => validateLegacyObservationFile(file)).not.toThrow();
    }
  });

  test.each([
    "The interface displayed three fields.\nvalue + 1;",
    "The type field remained empty.\nconst copied = 1;",
  ])("source shape hidden on a later line is rejected: %s", (text) => {
    for (const field of OBSERVATION_FIELDS) {
      expectRejection(
        mutate((file) => {
          firstRecord(file)[field] = [text];
        }),
        "LEGACY_OBSERVATION_SOURCE_SNIPPET",
      );
    }
  });

  test.each(["UNAVAILABLE", "UNRUNNABLE", "NOT_ATTEMPTED"])(
    "%s cannot carry a fabricated safety observation",
    (status) => {
      expectRejection(
        mutate((file) => {
          const record = firstRecord(file);
          record.observation_status = status;
          record.fixture_inputs = [];
          record.observed_output_digest = null;
          record.structured_observations = [];
          record.safety_observations = ["Fabricated safety behavior claim"];
          record.regression_fixture_refs = [];
          record.failure_or_unavailability_reason = "not captured";
          record.comparable = false;
        }),
        "LEGACY_OBSERVATION_UNCAPTURED_SAFETY",
      );
    },
  );

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
        record.safety_observations = [];
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

  test.each([
    [
      "fixture_inputs",
      [
        {
          fixture_id: "profile_00000000000000000000000001",
          content_digest: `sha256:${"a".repeat(64)}`,
        },
      ],
      "LEGACY_OBSERVATION_UNCAPTURED_INPUTS",
    ],
    [
      "observed_output_digest",
      `sha256:${"b".repeat(64)}`,
      "LEGACY_OBSERVATION_UNCAPTURED_OUTPUT",
    ],
    [
      "structured_observations",
      ["Fabricated behavioral observation"],
      "LEGACY_OBSERVATION_UNCAPTURED_CONTENT",
    ],
    [
      "safety_observations",
      ["Fabricated safety behavior claim"],
      "LEGACY_OBSERVATION_UNCAPTURED_SAFETY",
    ],
    [
      "regression_fixture_refs",
      ["profile_00000000000000000000000001"],
      "LEGACY_OBSERVATION_UNCAPTURED_REGRESSION",
    ],
  ] as const)(
    "a non-captured record rejects %s payload independently",
    (field, payload, code) => {
      expectRejection(
        mutate((file) => {
          const record = firstRecord(file);
          record.observation_status = "UNAVAILABLE";
          record.fixture_inputs = [];
          record.observed_output_digest = null;
          record.structured_observations = [];
          record.safety_observations = [];
          record.regression_fixture_refs = [];
          record.failure_or_unavailability_reason = "not captured";
          record.comparable = false;
          record[field] = payload;
        }),
        code,
      );
    },
  );

  test("a non-captured record without a reason is rejected", () => {
    expectRejection(
      mutate((file) => {
        const record = firstRecord(file);
        record.observation_status = "UNRUNNABLE";
        record.fixture_inputs = [];
        record.observed_output_digest = null;
        record.structured_observations = [];
        record.safety_observations = [];
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
