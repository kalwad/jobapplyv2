import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { validateSemanticContractV1 } from "../../generated/typescript/semantic/rules.v1.ts";
import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

/**
 * Explicit M01-W07 secret-store result truth table and structural/semantic
 * token-closure checks (KI-0023). The matrix is intentional source data, not
 * a fragile parser of evaluator source.
 */

const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);
const valuesDocument = JSON.parse(
  readFileSync(
    new URL("../contract/corpus/values.v1.json", import.meta.url),
    "utf8",
  ),
) as { readonly values: Readonly<Record<string, unknown>> };
const casesDocument = JSON.parse(
  readFileSync(
    new URL("../contract/corpus/cases.v1.json", import.meta.url),
    "utf8",
  ),
) as { readonly cases: readonly { readonly id: string }[] };

const SECRET_RESULT = "urn:japp:schema:platform:secret-store-result:v1";
const VOCABULARY = "urn:japp:schema:platform:vocabulary:v1";

const SECRET_RESULT_STATES = [
  "DELETED",
  "DENIED_PERMISSION",
  "NOT_FOUND",
  "OPERATION_FAILED",
  "RETRIEVED",
  "STORED",
  "STORE_AVAILABLE",
  "STORE_UNAVAILABLE",
] as const;

const SECRET_OPERATIONS = ["DELETE", "GET", "PUT", "STATUS"] as const;

const STORE_UNAVAILABLE_AVAILABILITY = [
  "INCOMPATIBLE_VERSION",
  "NOT_EVALUATED",
  "NOT_INSTALLED",
  "UNAVAILABLE",
  "UNKNOWN",
  "UNSUPPORTED_TARGET",
] as const;

interface TruthBranch {
  readonly id: string;
  readonly operation: (typeof SECRET_OPERATIONS)[number];
  readonly result_state: (typeof SECRET_RESULT_STATES)[number];
  readonly store_availability: string;
  readonly identity: boolean;
  readonly material: boolean;
  readonly digest: boolean;
  readonly reasons: readonly string[];
  readonly expect_valid: boolean;
  readonly corpus_case_id?: string;
}

const TRUTH_TABLE: readonly TruthBranch[] = [
  {
    id: "status-store-available",
    operation: "STATUS",
    result_state: "STORE_AVAILABLE",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-status-store-available",
  },
  {
    id: "status-denied-permission",
    operation: "STATUS",
    result_state: "DENIED_PERMISSION",
    store_availability: "PERMISSION_REQUIRED",
    identity: false,
    material: false,
    digest: false,
    reasons: ["PERMISSION_DENIED"],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-status-denied-permission",
  },
  {
    id: "status-store-unavailable",
    operation: "STATUS",
    result_state: "STORE_UNAVAILABLE",
    store_availability: "UNAVAILABLE",
    identity: false,
    material: false,
    digest: false,
    reasons: ["SERVICE_UNAVAILABLE"],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-store-unavailable",
  },
  {
    id: "get-retrieved",
    operation: "GET",
    result_state: "RETRIEVED",
    store_availability: "AVAILABLE",
    identity: true,
    material: true,
    digest: true,
    reasons: [],
    expect_valid: true,
    corpus_case_id: "x-w07.round-trip-secret-store-result",
  },
  {
    id: "put-stored",
    operation: "PUT",
    result_state: "STORED",
    store_availability: "AVAILABLE",
    identity: true,
    material: true,
    digest: false,
    reasons: [],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-put-stored",
  },
  {
    id: "delete-deleted",
    operation: "DELETE",
    result_state: "DELETED",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-delete-deleted",
  },
  {
    id: "get-not-found",
    operation: "GET",
    result_state: "NOT_FOUND",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: ["DEPENDENCY_MISSING"],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-get-not-found",
  },
  {
    id: "get-operation-failed",
    operation: "GET",
    result_state: "OPERATION_FAILED",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: ["SERVICE_UNAVAILABLE"],
    expect_valid: true,
    corpus_case_id: "x-w07.secret-store-result-operation-failed",
  },
  {
    id: "status-unavailable-with-available",
    operation: "STATUS",
    result_state: "STORE_UNAVAILABLE",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: false,
    corpus_case_id:
      "x-w07.secret-store-result-status-unavailable-with-available",
  },
  {
    id: "status-denied-with-available",
    operation: "STATUS",
    result_state: "DENIED_PERMISSION",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: false,
    corpus_case_id: "x-w07.secret-store-result-status-denied-with-available",
  },
  {
    id: "status-available-nonavailable",
    operation: "STATUS",
    result_state: "STORE_AVAILABLE",
    store_availability: "UNAVAILABLE",
    identity: false,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: false,
    corpus_case_id: "x-w07.secret-store-result-status-available-nonavailable",
  },
  {
    id: "store-available-on-get",
    operation: "GET",
    result_state: "STORE_AVAILABLE",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: false,
    corpus_case_id: "x-w07.secret-store-result-store-available-on-get",
  },
  {
    id: "status-unavailable-without-reason",
    operation: "STATUS",
    result_state: "STORE_UNAVAILABLE",
    store_availability: "UNAVAILABLE",
    identity: false,
    material: false,
    digest: false,
    reasons: [],
    expect_valid: false,
    corpus_case_id:
      "x-w07.secret-store-result-status-unavailable-without-reason",
  },
  {
    id: "status-with-retrieved",
    operation: "STATUS",
    result_state: "RETRIEVED",
    store_availability: "AVAILABLE",
    identity: true,
    material: true,
    digest: true,
    reasons: [],
    expect_valid: false,
    corpus_case_id: "x-w07.secret-store-result-status-with-retrieved",
  },
  {
    id: "unavailable-with-available-on-get",
    operation: "GET",
    result_state: "STORE_UNAVAILABLE",
    store_availability: "AVAILABLE",
    identity: true,
    material: false,
    digest: false,
    reasons: ["SERVICE_UNAVAILABLE"],
    expect_valid: false,
    corpus_case_id:
      "x-w07.secret-store-result-unavailable-with-available-on-get",
  },
];

/** Semantic tokens each M01-W07 platform rule kind depends on, with their structural enum homes. */
const PLATFORM_RULE_TOKEN_CLOSURE: readonly {
  readonly rule_kind: string;
  readonly tokens: readonly {
    readonly token: string;
    readonly enum_definition: string;
    readonly schema_id?: string;
  }[];
}[] = [
  {
    rule_kind: "PLATFORM_SECRET_RESULT_INTEGRITY",
    tokens: [
      ...SECRET_RESULT_STATES.map((token) => ({
        token,
        enum_definition: "secretResultState",
      })),
      ...SECRET_OPERATIONS.map((token) => ({
        token,
        enum_definition: "secretOperation",
      })),
      {
        token: "AVAILABLE",
        enum_definition: "capabilityAvailability",
      },
      {
        token: "DEGRADED_LIMITED",
        enum_definition: "capabilityAvailability",
      },
      {
        token: "PERMISSION_REQUIRED",
        enum_definition: "capabilityAvailability",
      },
      {
        token: "UNAVAILABLE",
        enum_definition: "capabilityAvailability",
      },
      {
        token: "PERMISSION_DENIED",
        enum_definition: "platformReasonCode",
      },
      ...STORE_UNAVAILABLE_AVAILABILITY.map((token) => ({
        token,
        enum_definition: "capabilityAvailability",
      })),
    ],
  },
  {
    rule_kind: "PLATFORM_SECRET_REQUEST_AUTHORITY",
    tokens: [
      ...SECRET_OPERATIONS.map((token) => ({
        token,
        enum_definition: "secretOperation",
      })),
      {
        token: "VERIFICATION",
        enum_definition: "authorizationProfileId",
        schema_id: "urn:japp:schema:security:capability-taxonomy:v1",
      },
    ],
  },
];

function fixture(name: string): Record<string, unknown> {
  const value = valuesDocument.values[name];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`missing object fixture ${name}`);
  }
  return structuredClone(value) as Record<string, unknown>;
}

function enumTokens(
  definition: string,
  schemaId = VOCABULARY,
): readonly string[] {
  const document = catalog.byId.get(schemaId)?.document;
  const defs = document?.$defs;
  const node =
    typeof defs === "object" && defs !== null && !Array.isArray(defs)
      ? (defs as Record<string, unknown>)[definition]
      : undefined;
  const tokens =
    typeof node === "object" && node !== null && !Array.isArray(node)
      ? (node as Record<string, unknown>).enum
      : undefined;
  if (!Array.isArray(tokens) || !tokens.every((t) => typeof t === "string")) {
    throw new Error(`missing enum ${schemaId}#/$defs/${definition}`);
  }
  return tokens;
}

function buildResult(branch: TruthBranch): Record<string, unknown> {
  const value = fixture("w07.secret-store-result");
  value.operation = branch.operation;
  value.result_state = branch.result_state;
  value.store_availability = branch.store_availability;
  value.reason_codes = [...branch.reasons];
  if (branch.identity) {
    value.store_identity_token = "platform-secure-store";
  } else {
    delete value.store_identity_token;
  }
  if (branch.material) {
    value.material_reference = "secref_0123456789ABCDEFGHJKMNPQRS";
  } else {
    delete value.material_reference;
  }
  if (branch.digest) {
    value.material_digest =
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  } else {
    delete value.material_digest;
  }
  return value;
}

describe("M01-W07 secret-store STATUS truth table and token closure (KI-0023)", () => {
  test("secretResultState structurally includes STORE_AVAILABLE", () => {
    expect(enumTokens("secretResultState")).toEqual([...SECRET_RESULT_STATES]);
  });

  test.each(TRUTH_TABLE)(
    "truth-table branch $id structural+semantic verdict",
    (branch) => {
      const value = buildResult(branch);
      const structural = validator.validateInstance(SECRET_RESULT, value);
      expect(structural.valid, JSON.stringify(structural)).toBe(true);
      const semantic = validateSemanticContractV1(SECRET_RESULT, value);
      expect(semantic.valid, JSON.stringify(semantic)).toBe(
        branch.expect_valid,
      );
    },
  );

  test("every documented positive/negative branch has a corpus case id", () => {
    const caseIds = new Set(casesDocument.cases.map((entry) => entry.id));
    for (const branch of TRUTH_TABLE) {
      const corpusCaseId = branch.corpus_case_id;
      expect(corpusCaseId, branch.id).toBeTruthy();
      if (corpusCaseId === undefined) {
        continue;
      }
      expect(caseIds.has(corpusCaseId), corpusCaseId).toBe(true);
    }
  });

  test("platform rule semantic tokens are structurally representable", () => {
    for (const rule of PLATFORM_RULE_TOKEN_CLOSURE) {
      for (const entry of rule.tokens) {
        const tokens = enumTokens(entry.enum_definition, entry.schema_id);
        expect(
          tokens,
          `${rule.rule_kind} token ${entry.token} missing from ${entry.enum_definition}`,
        ).toContain(entry.token);
      }
    }
  });

  test("STORE_AVAILABLE is rejected under every non-STATUS operation", () => {
    for (const operation of ["GET", "PUT", "DELETE"] as const) {
      const value = buildResult({
        id: `store-available-on-${operation.toLowerCase()}`,
        operation,
        result_state: "STORE_AVAILABLE",
        store_availability: "AVAILABLE",
        identity: true,
        material: false,
        digest: false,
        reasons: [],
        expect_valid: false,
      });
      expect(validator.validateInstance(SECRET_RESULT, value).valid).toBe(true);
      expect(validateSemanticContractV1(SECRET_RESULT, value).valid).toBe(
        false,
      );
    }
  });

  test("STORE_UNAVAILABLE accepts only reviewed non-available availability states", () => {
    for (const availability of STORE_UNAVAILABLE_AVAILABILITY) {
      const value = buildResult({
        id: `status-unavailable-${availability}`,
        operation: "STATUS",
        result_state: "STORE_UNAVAILABLE",
        store_availability: availability,
        identity: false,
        material: false,
        digest: false,
        reasons: ["SERVICE_UNAVAILABLE"],
        expect_valid: true,
      });
      expect(validator.validateInstance(SECRET_RESULT, value).valid).toBe(true);
      expect(validateSemanticContractV1(SECRET_RESULT, value).valid).toBe(true);
    }
    for (const availability of [
      "AVAILABLE",
      "DEGRADED_LIMITED",
      "PERMISSION_REQUIRED",
    ] as const) {
      const value = buildResult({
        id: `status-unavailable-bad-${availability}`,
        operation: "STATUS",
        result_state: "STORE_UNAVAILABLE",
        store_availability: availability,
        identity: availability === "AVAILABLE",
        material: false,
        digest: false,
        reasons: ["SERVICE_UNAVAILABLE"],
        expect_valid: false,
      });
      expect(validator.validateInstance(SECRET_RESULT, value).valid).toBe(true);
      expect(validateSemanticContractV1(SECRET_RESULT, value).valid).toBe(
        false,
      );
    }
  });
});
