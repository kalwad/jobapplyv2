/**
 * M01-W04 capability/command allowlist proof.
 *
 * This is generator/policy evidence, not the M01-W05 cross-language
 * compatibility suite. It proves canonical catalog agreement, every positive
 * allow row, default denial, trusted hop context, confused-deputy prevention,
 * immutable generated surfaces, and fail-closed tamper handling.
 */

import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

import {
  AUTHORIZATION_POLICY_V1,
  AUTHORIZATION_PROFILE_CATALOG_V1,
  AUTHORIZATION_PROFILES_V1,
  CAPABILITY_CATALOG_V1,
  CAPABILITY_IDS_V1,
  COMMAND_CATALOG_V1,
  COMMAND_IDS_V1,
  ERROR_CATALOG_V1,
  PRINCIPAL_CATALOG_V1,
  PRINCIPAL_IDS_V1,
  allowedCommandsForV1,
  authorizeCommandRequestV1,
  isCapabilityIdV1,
  isCommandIdV1,
  isPrincipalIdV1,
  requireCapabilityEntryV1,
  requireCommandEntryV1,
  validateSecurityAuthorizationRequestV1,
  type AuthorizationRuntimeContextV1,
  type SecurityAuthorizationPolicyV1AuthorizationAllowRow,
  type SecurityAuthorizationRequestV1,
  type SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  type SecurityCapabilityTaxonomyV1PrincipalId,
} from "../../generated/typescript/index.ts";
import { generateContracts } from "../../generator/generate.ts";
import { SecurityPolicyError } from "../../generator/security-policy.ts";
import { runBoundedCliProcess } from "./support/bounded-cli.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const CATALOG_ROOT = fileURLToPath(new URL("../../catalog", import.meta.url));
const CLI_PATH = join(REPO_ROOT, "scripts", "generate-contracts.ts");

interface CapabilityCatalogJson {
  catalog_version: string;
  principals: {
    id: string;
    description: string;
    non_goals: string[];
  }[];
  profiles: {
    id: string;
    description: string;
    non_goals: string[];
  }[];
  capabilities: {
    id: string;
    description: string;
    non_goals: string[];
  }[];
}

interface CommandCatalogJson {
  catalog_version: string;
  commands: {
    id: string;
    required_capability: string;
    intended_target: string;
    supported_profiles: string[];
    max_encoded_payload_size_bytes: number;
    consequence_class: string;
    idempotency_expectation: string;
    denial_error_code: string;
    description: string;
    non_goals: string[];
  }[];
}

interface PolicyJson {
  policy_version: string;
  allow: SecurityAuthorizationPolicyV1AuthorizationAllowRow[];
}

const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-policytest-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    }
  }
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function catalogDocument(file: string): unknown {
  return readJson(join(CATALOG_ROOT, file));
}

function rowSortKey(
  row: SecurityAuthorizationPolicyV1AuthorizationAllowRow,
): string {
  return JSON.stringify([
    row.authorization_profile,
    row.command_id,
    row.originating_principal,
    row.immediate_sender,
    row.receiving_principal,
    row.target_principal,
  ]);
}

function sortPolicyRows(rows: Record<string, unknown>[]): void {
  rows.sort((left, right) => {
    const key = (row: Record<string, unknown>) =>
      JSON.stringify([
        row.authorization_profile,
        row.command_id,
        row.originating_principal,
        row.immediate_sender,
        row.receiving_principal,
        row.target_principal,
      ]);
    const leftKey = key(left);
    const rightKey = key(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function copyAndMutateCatalog(
  file: string,
  mutate: (document: Record<string, unknown>) => void,
): string {
  const root = join(makeTemporaryRoot(), "catalog");
  cpSync(CATALOG_ROOT, root, { recursive: true });
  const path = join(root, file);
  const document = readJson(path) as Record<string, unknown>;
  mutate(document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  return root;
}

function copyAndMutateCatalogs(
  mutations: readonly [
    file: string,
    mutate: (document: Record<string, unknown>) => void,
  ][],
): string {
  const root = join(makeTemporaryRoot(), "catalog");
  cpSync(CATALOG_ROOT, root, { recursive: true });
  for (const [file, mutate] of mutations) {
    const path = join(root, file);
    const document = readJson(path) as Record<string, unknown>;
    mutate(document);
    writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  }
  return root;
}

function expectTamperFailure(
  file: string,
  mutate: (document: Record<string, unknown>) => void,
  expected: RegExp,
): void {
  const catalogRoot = copyAndMutateCatalog(file, mutate);
  expect(() => generateContracts({ catalogRoot })).toThrow(SecurityPolicyError);
  expect(() => generateContracts({ catalogRoot })).toThrow(expected);
}

function expectCoordinatedTamperFailure(
  mutations: readonly [
    file: string,
    mutate: (document: Record<string, unknown>) => void,
  ][],
  expected: RegExp,
): void {
  const catalogRoot = copyAndMutateCatalogs(mutations);
  expect(() => generateContracts({ catalogRoot })).toThrow(SecurityPolicyError);
  expect(() => generateContracts({ catalogRoot })).toThrow(expected);
}

function context(
  receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId,
  authenticated_sender_principal: SecurityCapabilityTaxonomyV1PrincipalId,
  active_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  authenticated_originating_principal: SecurityCapabilityTaxonomyV1PrincipalId = authenticated_sender_principal,
  observed_payload_size_bytes = 0,
): AuthorizationRuntimeContextV1 {
  return {
    receiving_principal,
    authenticated_sender_principal,
    authenticated_originating_principal,
    active_profile,
    observed_payload_size_bytes,
  };
}

const BASE_REQUEST = {
  request_version: "AUTHORIZATION_REQUEST_V1",
  request_id: "req_0123456789ABCDEFGHJKMNPQRS",
  occurred_at: "2026-07-27T08:00:00Z",
  correlation_id: "wf_0123456789ABCDEFGHJKMNPQRS",
  payload_size_bytes: 0,
} as const;

function requestForRow(
  row: SecurityAuthorizationPolicyV1AuthorizationAllowRow,
): SecurityAuthorizationRequestV1 {
  const command = COMMAND_CATALOG_V1[row.command_id];
  return {
    ...BASE_REQUEST,
    command_id: row.command_id,
    originating_principal: row.originating_principal,
    immediate_sender: row.immediate_sender,
    target_principal: row.target_principal,
    authorization_profile: row.authorization_profile,
    ...(command.idempotency_expectation === "IDEMPOTENCY_KEY_REQUIRED"
      ? { idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS" }
      : {}),
  };
}

function authorize(
  request: unknown,
  receiving: SecurityCapabilityTaxonomyV1PrincipalId,
  sender: SecurityCapabilityTaxonomyV1PrincipalId,
  profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
) {
  const record =
    typeof request === "object" && request !== null
      ? (request as Record<string, unknown>)
      : {};
  const origin = isPrincipalIdV1(record.originating_principal)
    ? record.originating_principal
    : sender;
  const observedPayloadSize =
    typeof record.payload_size_bytes === "number"
      ? record.payload_size_bytes
      : 0;
  return authorizeCommandRequestV1(
    request,
    context(receiving, sender, profile, origin, observedPayloadSize),
  );
}

describe("canonical catalog and generated-surface integrity", () => {
  const capabilities = catalogDocument(
    "capability-catalog.v1.json",
  ) as CapabilityCatalogJson;
  const commands = catalogDocument(
    "command-catalog.v1.json",
  ) as CommandCatalogJson;
  const policy = catalogDocument("authorization-policy.v1.json") as PolicyJson;

  test("generated values exactly match all canonical security data", () => {
    expect(Object.values(PRINCIPAL_CATALOG_V1)).toEqual(
      capabilities.principals,
    );
    expect(Object.values(AUTHORIZATION_PROFILE_CATALOG_V1)).toEqual(
      capabilities.profiles,
    );
    expect(Object.values(CAPABILITY_CATALOG_V1)).toEqual(
      capabilities.capabilities,
    );
    expect(Object.values(COMMAND_CATALOG_V1)).toEqual(commands.commands);
    expect(AUTHORIZATION_POLICY_V1).toEqual(policy.allow);
  });

  test("closed principal, profile, capability, and command inventories are exact", () => {
    expect(PRINCIPAL_IDS_V1).toEqual(
      capabilities.principals.map((entry) => entry.id),
    );
    expect(AUTHORIZATION_PROFILES_V1).toEqual(
      capabilities.profiles.map((entry) => entry.id),
    );
    expect(CAPABILITY_IDS_V1).toEqual(
      capabilities.capabilities.map((entry) => entry.id),
    );
    expect(COMMAND_IDS_V1).toEqual(commands.commands.map((entry) => entry.id));
    expect(PRINCIPAL_IDS_V1).toHaveLength(9);
    expect(new Set(PRINCIPAL_IDS_V1).size).toBe(PRINCIPAL_IDS_V1.length);
    expect(CAPABILITY_IDS_V1).toHaveLength(18);
    expect(new Set(CAPABILITY_IDS_V1).size).toBe(CAPABILITY_IDS_V1.length);
    expect(COMMAND_IDS_V1).toHaveLength(24);
    expect(new Set(COMMAND_IDS_V1).size).toBe(COMMAND_IDS_V1.length);
    expect(AUTHORIZATION_PROFILES_V1).toEqual([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ]);
    expect(new Set(AUTHORIZATION_PROFILES_V1).size).toBe(
      AUTHORIZATION_PROFILES_V1.length,
    );
    expect(AUTHORIZATION_PROFILES_V1).not.toContain("AUTO_SUBMIT");
  });

  test("every command has one existing capability, target, integer limit, and safe denial", () => {
    for (const command of Object.values(COMMAND_CATALOG_V1)) {
      expect(isCapabilityIdV1(command.required_capability), command.id).toBe(
        true,
      );
      expect(PRINCIPAL_IDS_V1, command.id).toContain(command.intended_target);
      expect(Number.isSafeInteger(command.max_encoded_payload_size_bytes)).toBe(
        true,
      );
      expect(command.max_encoded_payload_size_bytes).toBeGreaterThanOrEqual(0);
      const denial = ERROR_CATALOG_V1[command.denial_error_code];
      expect(denial, command.id).toBeDefined();
      expect(denial.retry_disposition, command.id).not.toBe("SAFE_RETRY");
    }
  });

  test("supported profiles equal profiles with at least one exact allow row", () => {
    for (const command of Object.values(COMMAND_CATALOG_V1)) {
      const policyProfiles = [
        ...new Set(
          AUTHORIZATION_POLICY_V1.filter(
            (row) => row.command_id === command.id,
          ).map((row) => row.authorization_profile),
        ),
      ].sort();
      expect(policyProfiles, command.id).toEqual(command.supported_profiles);
    }
  });

  test("policy rows are unique, deterministically sorted, and exact-targeted", () => {
    const keys = AUTHORIZATION_POLICY_V1.map(rowSortKey);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of AUTHORIZATION_POLICY_V1) {
      expect(COMMAND_CATALOG_V1[row.command_id].intended_target).toBe(
        row.target_principal,
      );
    }
  });

  test("final submit and abstract platform commands are known but have zero grants", () => {
    const knownDenied = [
      "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
      "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
      "PLATFORM_PROCESS_SUPERVISION_REQUEST",
      "PLATFORM_SECRET_STORE_REQUEST",
      "SUBMISSION_FINAL_SUBMIT",
    ] as const;
    for (const commandId of knownDenied) {
      expect(isCommandIdV1(commandId)).toBe(true);
      expect(COMMAND_CATALOG_V1[commandId].supported_profiles).toEqual([]);
      expect(
        AUTHORIZATION_POLICY_V1.some((row) => row.command_id === commandId),
      ).toBe(false);
    }
  });

  test("both generated runtimes retain the independent platform-capability hard stop", () => {
    const typescript = readFileSync(
      join(
        REPO_ROOT,
        "packages/contracts/generated/typescript/security/policy-data.v1.ts",
      ),
      "utf8",
    );
    const python = readFileSync(
      join(
        REPO_ROOT,
        "packages/contracts/generated/python/src/japp_contracts/security/policy_data_v1.py",
      ),
      "utf8",
    );
    expect(typescript).toContain(
      'command.required_capability.startsWith("PLATFORM_")',
    );
    expect(python).toContain(
      'command.required_capability.startswith("PLATFORM_")',
    );
  });

  test("protected authentication and consent operations are unrepresentable", () => {
    for (const hostile of [
      "PASSWORD_FILL",
      "ACCOUNT_CREATE",
      "EMAIL_VERIFY",
      "MFA_COMPLETE",
      "CAPTCHA_SOLVE",
      "LEGAL_CONSENT_ACCEPT",
      "UNAPPROVED_CONSEQUENTIAL_ANSWER",
      "EXECUTE_ANYTHING",
      "RUN_COMMAND",
    ]) {
      expect(isCommandIdV1(hostile)).toBe(false);
      expect(isCapabilityIdV1(hostile)).toBe(false);
    }
  });

  test("generated mappings and every nested entry/array are frozen", () => {
    expect(Object.isFrozen(PRINCIPAL_CATALOG_V1)).toBe(true);
    for (const entry of Object.values(PRINCIPAL_CATALOG_V1)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.non_goals)).toBe(true);
    }
    expect(Object.isFrozen(AUTHORIZATION_PROFILE_CATALOG_V1)).toBe(true);
    for (const entry of Object.values(AUTHORIZATION_PROFILE_CATALOG_V1)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.non_goals)).toBe(true);
    }
    expect(Object.isFrozen(CAPABILITY_CATALOG_V1)).toBe(true);
    for (const entry of Object.values(CAPABILITY_CATALOG_V1)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.non_goals)).toBe(true);
    }
    expect(Object.isFrozen(COMMAND_CATALOG_V1)).toBe(true);
    for (const entry of Object.values(COMMAND_CATALOG_V1)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.non_goals)).toBe(true);
      expect(Object.isFrozen(entry.supported_profiles)).toBe(true);
    }
    expect(Object.isFrozen(AUTHORIZATION_POLICY_V1)).toBe(true);
    expect(AUTHORIZATION_POLICY_V1.every((row) => Object.isFrozen(row))).toBe(
      true,
    );
    expect(Object.isFrozen(COMMAND_IDS_V1)).toBe(true);
  });

  test("lookups fail closed without echoing hostile values", () => {
    expect(requireCapabilityEntryV1("PAGE_INSPECT")).toBe(
      CAPABILITY_CATALOG_V1.PAGE_INSPECT,
    );
    expect(requireCommandEntryV1("PAGE_REPORT_STATE")).toBe(
      COMMAND_CATALOG_V1.PAGE_REPORT_STATE,
    );
    for (const hostile of ["__proto__", "constructor", "<script>x</script>"]) {
      expect(isCapabilityIdV1(hostile)).toBe(false);
      expect(isCommandIdV1(hostile)).toBe(false);
      expect(() => requireCapabilityEntryV1(hostile)).toThrow(
        "unknown capability id",
      );
      try {
        requireCommandEntryV1(hostile);
      } catch (error) {
        expect(String(error)).not.toContain(hostile);
      }
    }
  });
});

describe("authorization positive rows and bounded route behavior", () => {
  test("every committed positive policy row authorizes in its trusted hop context", () => {
    for (const row of AUTHORIZATION_POLICY_V1) {
      const request = requestForRow(row);
      const outcome = authorize(
        request,
        row.receiving_principal,
        row.immediate_sender,
        row.authorization_profile,
      );
      expect(outcome.authorized, rowSortKey(row)).toBe(true);
      if (outcome.authorized) {
        expect(outcome.command_id).toBe(row.command_id);
        expect(outcome.required_capability).toBe(
          COMMAND_CATALOG_V1[row.command_id].required_capability,
        );
      }
    }
  });

  test("desktop service, orchestrator model, and synthetic harness requests authorize only on reviewed rows", () => {
    const examples = [
      {
        command_id: "PRIVATE_DATA_READ_REQUEST",
        origin: "DESKTOP_APP",
        sender: "DESKTOP_APP",
        receiver: "ORCHESTRATOR",
        target: "ORCHESTRATOR",
        profile: "PRODUCTION_NO_SUBMIT",
      },
      {
        command_id: "MODEL_INFERENCE_REQUEST",
        origin: "ORCHESTRATOR",
        sender: "ORCHESTRATOR",
        receiver: "MODEL_RUNTIME",
        target: "MODEL_RUNTIME",
        profile: "PRODUCTION_NO_SUBMIT",
      },
      {
        command_id: "VERIFICATION_RUN_SYNTHETIC_SUITE",
        origin: "VERIFICATION_HARNESS",
        sender: "VERIFICATION_HARNESS",
        receiver: "VERIFICATION_HARNESS",
        target: "VERIFICATION_HARNESS",
        profile: "VERIFICATION",
      },
      {
        command_id: "PUBLIC_JOB_INDEX_QUERY",
        origin: "ORCHESTRATOR",
        sender: "ORCHESTRATOR",
        receiver: "PUBLIC_JOB_INDEX",
        target: "PUBLIC_JOB_INDEX",
        profile: "PRODUCTION_NO_SUBMIT",
      },
    ] as const;
    for (const example of examples) {
      const command = COMMAND_CATALOG_V1[example.command_id];
      const request = {
        ...BASE_REQUEST,
        command_id: example.command_id,
        originating_principal: example.origin,
        immediate_sender: example.sender,
        target_principal: example.target,
        authorization_profile: example.profile,
        ...(command.idempotency_expectation === "IDEMPOTENCY_KEY_REQUIRED"
          ? { idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS" }
          : {}),
      };
      expect(
        authorize(request, example.receiver, example.sender, example.profile)
          .authorized,
        example.command_id,
      ).toBe(true);
    }
  });

  test.each([
    "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    "PAGE_VERIFY_FIELD_VALUES",
    "PAGE_NAVIGATE_NEXT",
    "PAGE_NAVIGATE_BACK",
  ] as const)(
    "GUIDED_PRE_SUBMIT explicitly authorizes reviewed %s hops",
    (commandId) => {
      const rows = AUTHORIZATION_POLICY_V1.filter(
        (row) =>
          row.authorization_profile === "GUIDED_PRE_SUBMIT" &&
          row.command_id === commandId,
      );
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(
          authorize(
            requestForRow(row),
            row.receiving_principal,
            row.immediate_sender,
            row.authorization_profile,
          ).authorized,
        ).toBe(true);
      }
    },
  );

  test("FEASIBILITY explicitly authorizes the bounded synthetic fill route", () => {
    const rows = AUTHORIZATION_POLICY_V1.filter(
      (row) =>
        row.authorization_profile === "FEASIBILITY" &&
        row.command_id === "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS" &&
        row.originating_principal === "VERIFICATION_HARNESS",
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(
        authorize(
          requestForRow(row),
          row.receiving_principal,
          row.immediate_sender,
          row.authorization_profile,
        ).authorized,
      ).toBe(true);
    }
  });

  test("content-script page reporting traverses service worker, native host, and orchestrator with preserved origin", () => {
    const rows = AUTHORIZATION_POLICY_V1.filter(
      (row) =>
        row.authorization_profile === "GUIDED_PRE_SUBMIT" &&
        row.command_id === "PAGE_REPORT_STATE",
    );
    expect(
      rows.map((row) => [
        row.originating_principal,
        row.immediate_sender,
        row.receiving_principal,
      ]),
    ).toEqual([
      [
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
      ],
      ["EXTENSION_CONTENT_SCRIPT", "EXTENSION_SERVICE_WORKER", "NATIVE_HOST"],
      ["EXTENSION_CONTENT_SCRIPT", "NATIVE_HOST", "ORCHESTRATOR"],
    ]);
  });

  test("reverse browser operations traverse orchestrator to native host to service worker to content script", () => {
    const rows = AUTHORIZATION_POLICY_V1.filter(
      (row) =>
        row.authorization_profile === "GUIDED_PRE_SUBMIT" &&
        row.command_id === "PAGE_SCAN_VISIBLE_CONTROLS",
    );
    expect(
      rows.map((row) => [
        row.originating_principal,
        row.immediate_sender,
        row.receiving_principal,
      ]),
    ).toEqual([
      ["ORCHESTRATOR", "EXTENSION_SERVICE_WORKER", "EXTENSION_CONTENT_SCRIPT"],
      ["ORCHESTRATOR", "NATIVE_HOST", "EXTENSION_SERVICE_WORKER"],
      ["ORCHESTRATOR", "ORCHESTRATOR", "NATIVE_HOST"],
    ]);
  });

  test("allowedCommandsForV1 requires all exact route dimensions", () => {
    expect(
      allowedCommandsForV1(
        "GUIDED_PRE_SUBMIT",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "NATIVE_HOST",
        "ORCHESTRATOR",
      ),
    ).toEqual(["PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE"]);
    expect(
      allowedCommandsForV1(
        "GUIDED_PRE_SUBMIT",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_CONTENT_SCRIPT",
        "NATIVE_HOST",
        "ORCHESTRATOR",
      ),
    ).toEqual([]);
    expect(
      allowedCommandsForV1(
        "__proto__",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "ORCHESTRATOR",
      ),
    ).toEqual([]);
  });

  test("exact command payload limit passes and one byte over denies before dispatch", () => {
    const command = COMMAND_CATALOG_V1.PAGE_SCAN_VISIBLE_CONTROLS;
    const request = {
      ...BASE_REQUEST,
      command_id: command.id,
      originating_principal: "ORCHESTRATOR",
      immediate_sender: "EXTENSION_SERVICE_WORKER",
      target_principal: "EXTENSION_CONTENT_SCRIPT",
      authorization_profile: "GUIDED_PRE_SUBMIT",
      payload_size_bytes: command.max_encoded_payload_size_bytes,
    };
    expect(
      authorize(
        request,
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "GUIDED_PRE_SUBMIT",
      ).authorized,
    ).toBe(true);
    expect(
      authorize(
        {
          ...request,
          payload_size_bytes: command.max_encoded_payload_size_bytes + 1,
        },
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "GUIDED_PRE_SUBMIT",
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_PAYLOAD_TOO_LARGE",
    });
  });

  test("idempotency-key-required commands deny a missing key", () => {
    const request = {
      ...BASE_REQUEST,
      command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
      originating_principal: "ORCHESTRATOR",
      immediate_sender: "EXTENSION_SERVICE_WORKER",
      target_principal: "EXTENSION_CONTENT_SCRIPT",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    expect(
      authorize(
        request,
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "GUIDED_PRE_SUBMIT",
      ),
    ).toEqual({
      authorized: false,
      error_code: "VALIDATION_MISSING_REQUIRED_DATA",
    });
  });
});

describe("default denial and confused-deputy prevention", () => {
  test("a content-script private-data request stays denied through both forwarders", () => {
    for (const [sender, receiver] of [
      ["EXTENSION_SERVICE_WORKER", "NATIVE_HOST"],
      ["NATIVE_HOST", "ORCHESTRATOR"],
    ] as const) {
      const request = {
        ...BASE_REQUEST,
        command_id: "PRIVATE_DATA_READ_REQUEST",
        originating_principal: "EXTENSION_CONTENT_SCRIPT",
        immediate_sender: sender,
        target_principal: "ORCHESTRATOR",
        authorization_profile: "PRODUCTION_NO_SUBMIT",
      };
      expect(
        authorize(request, receiver, sender, "PRODUCTION_NO_SUBMIT"),
      ).toEqual({
        authorized: false,
        error_code: "TRANSPORT_FORBIDDEN",
      });
    }
  });

  test.each([
    [
      "MODEL_INFERENCE_REQUEST",
      "MODEL_RUNTIME",
      "EXTENSION_SERVICE_WORKER",
      "NATIVE_HOST",
    ],
    ["ARTIFACT_READ_REQUEST", "ORCHESTRATOR", "NATIVE_HOST", "ORCHESTRATOR"],
    [
      "PLATFORM_SECRET_STORE_REQUEST",
      "PLATFORM_ADAPTER",
      "NATIVE_HOST",
      "PLATFORM_ADAPTER",
    ],
  ] as const)(
    "content-script origin cannot escalate to %s through forwarding",
    (command_id, target_principal, immediate_sender, receiving_principal) => {
      const request = {
        ...BASE_REQUEST,
        command_id,
        originating_principal: "EXTENSION_CONTENT_SCRIPT",
        immediate_sender,
        target_principal,
        authorization_profile: "PRODUCTION_NO_SUBMIT",
      };
      expect(
        authorize(
          request,
          receiving_principal,
          immediate_sender,
          "PRODUCTION_NO_SUBMIT",
        ),
      ).toEqual({
        authorized: false,
        error_code: "TRANSPORT_FORBIDDEN",
      });
    },
  );

  test.each([
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
    "PLATFORM_PROCESS_SUPERVISION_REQUEST",
    "PLATFORM_SECRET_STORE_REQUEST",
  ] as const)(
    "abstract platform command %s is denied by runtime policy",
    (command_id) => {
      const request = {
        ...BASE_REQUEST,
        command_id,
        originating_principal: "ORCHESTRATOR",
        immediate_sender: "ORCHESTRATOR",
        target_principal: "PLATFORM_ADAPTER",
        authorization_profile: "PRODUCTION_NO_SUBMIT",
        idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS",
      };
      expect(
        authorize(
          request,
          "PLATFORM_ADAPTER",
          "ORCHESTRATOR",
          "PRODUCTION_NO_SUBMIT",
        ),
      ).toEqual({
        authorized: false,
        error_code: "TRANSPORT_FORBIDDEN",
      });
    },
  );

  test("final submission is specifically denied in every current profile", () => {
    for (const profile of AUTHORIZATION_PROFILES_V1) {
      const request = {
        ...BASE_REQUEST,
        command_id: "SUBMISSION_FINAL_SUBMIT",
        originating_principal: "EXTENSION_CONTENT_SCRIPT",
        immediate_sender: "EXTENSION_SERVICE_WORKER",
        target_principal: "EXTENSION_CONTENT_SCRIPT",
        authorization_profile: profile,
      };
      expect(
        authorize(
          request,
          "EXTENSION_CONTENT_SCRIPT",
          "EXTENSION_SERVICE_WORKER",
          profile,
        ),
      ).toEqual({
        authorized: false,
        error_code: "SUBMISSION_PROHIBITED_FINAL_ACTION",
      });
    }
  });

  test.each([
    [
      "NATIVE_HOST",
      "PRIVATE_DATA_READ_REQUEST",
      "ORCHESTRATOR",
      "NATIVE_HOST",
      "ORCHESTRATOR",
      "PRODUCTION_NO_SUBMIT",
    ],
    [
      "MODEL_RUNTIME",
      "PAGE_SCAN_VISIBLE_CONTROLS",
      "EXTENSION_CONTENT_SCRIPT",
      "MODEL_RUNTIME",
      "EXTENSION_CONTENT_SCRIPT",
      "PRODUCTION_NO_SUBMIT",
    ],
    [
      "PUBLIC_JOB_INDEX",
      "PRIVATE_DATA_READ_REQUEST",
      "ORCHESTRATOR",
      "PUBLIC_JOB_INDEX",
      "ORCHESTRATOR",
      "PRODUCTION_NO_SUBMIT",
    ],
    [
      "PLATFORM_ADAPTER",
      "PAGE_SCAN_VISIBLE_CONTROLS",
      "EXTENSION_CONTENT_SCRIPT",
      "PLATFORM_ADAPTER",
      "EXTENSION_CONTENT_SCRIPT",
      "PRODUCTION_NO_SUBMIT",
    ],
    [
      "VERIFICATION_HARNESS",
      "PRIVATE_DATA_READ_REQUEST",
      "ORCHESTRATOR",
      "VERIFICATION_HARNESS",
      "ORCHESTRATOR",
      "VERIFICATION",
    ],
    [
      "DESKTOP_APP",
      "PLATFORM_SECRET_STORE_REQUEST",
      "PLATFORM_ADAPTER",
      "DESKTOP_APP",
      "PLATFORM_ADAPTER",
      "PRODUCTION_NO_SUBMIT",
    ],
  ] as const)(
    "%s cannot originate %s",
    (
      originating_principal,
      command_id,
      target_principal,
      immediate_sender,
      receiving_principal,
      authorization_profile,
    ) => {
      const request = {
        ...BASE_REQUEST,
        command_id,
        originating_principal,
        immediate_sender,
        target_principal,
        authorization_profile,
      };
      expect(
        authorize(
          request,
          receiving_principal,
          immediate_sender,
          authorization_profile,
        ),
      ).toEqual({
        authorized: false,
        error_code: "TRANSPORT_FORBIDDEN",
      });
    },
  );

  test.each([
    ["PRIVATE_DATA_READ_REQUEST", "ORCHESTRATOR"],
    ["MODEL_INFERENCE_REQUEST", "MODEL_RUNTIME"],
    ["ARTIFACT_READ_REQUEST", "ORCHESTRATOR"],
    ["PLATFORM_SECRET_STORE_REQUEST", "PLATFORM_ADAPTER"],
    ["SUBMISSION_FINAL_SUBMIT", "EXTENSION_CONTENT_SCRIPT"],
  ] as const)(
    "native host cannot originate %s",
    (command_id, target_principal) => {
      const request = {
        ...BASE_REQUEST,
        command_id,
        originating_principal: "NATIVE_HOST",
        immediate_sender: "NATIVE_HOST",
        target_principal,
        authorization_profile: "PRODUCTION_NO_SUBMIT",
      };
      const outcome = authorize(
        request,
        target_principal,
        "NATIVE_HOST",
        "PRODUCTION_NO_SUBMIT",
      );
      expect(outcome.authorized).toBe(false);
    },
  );

  test("orchestrator and verification harness cannot acquire submission authority", () => {
    for (const origin of ["ORCHESTRATOR", "VERIFICATION_HARNESS"] as const) {
      const request = {
        ...BASE_REQUEST,
        command_id: "SUBMISSION_FINAL_SUBMIT",
        originating_principal: origin,
        immediate_sender: origin,
        target_principal: "EXTENSION_CONTENT_SCRIPT",
        authorization_profile:
          origin === "ORCHESTRATOR" ? "PRODUCTION_NO_SUBMIT" : "VERIFICATION",
      } as const;
      expect(
        authorize(
          request,
          "EXTENSION_CONTENT_SCRIPT",
          origin,
          request.authorization_profile,
        ),
      ).toEqual({
        authorized: false,
        error_code: "SUBMISSION_PROHIBITED_FINAL_ACTION",
      });
    }
  });

  test("a direct content-script to native-host shortcut is denied", () => {
    const request = {
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "ORCHESTRATOR",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    expect(
      authorize(
        request,
        "NATIVE_HOST",
        "EXTENSION_CONTENT_SCRIPT",
        "GUIDED_PRE_SUBMIT",
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_FORBIDDEN",
    });
  });

  test("trusted sender and active profile cannot be spoofed by wire metadata", () => {
    const row = AUTHORIZATION_POLICY_V1.find(
      (candidate) =>
        candidate.authorization_profile === "GUIDED_PRE_SUBMIT" &&
        candidate.command_id === "PAGE_REPORT_STATE" &&
        candidate.receiving_principal === "NATIVE_HOST",
    );
    expect(row).toBeDefined();
    if (row === undefined) {
      return;
    }
    const request = requestForRow(row);
    expect(
      authorizeCommandRequestV1(
        request,
        context("NATIVE_HOST", "EXTENSION_CONTENT_SCRIPT", "GUIDED_PRE_SUBMIT"),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_FORBIDDEN",
    });
    expect(
      authorizeCommandRequestV1(
        request,
        context(
          "NATIVE_HOST",
          "EXTENSION_SERVICE_WORKER",
          "PRODUCTION_NO_SUBMIT",
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_FORBIDDEN",
    });
  });

  test("trusted preserved origin and receiver-observed payload size cannot be spoofed", () => {
    const request = {
      ...BASE_REQUEST,
      command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
      originating_principal: "ORCHESTRATOR",
      immediate_sender: "NATIVE_HOST",
      target_principal: "EXTENSION_CONTENT_SCRIPT",
      authorization_profile: "GUIDED_PRE_SUBMIT",
      idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS",
    };
    expect(
      authorizeCommandRequestV1(
        request,
        context(
          "EXTENSION_SERVICE_WORKER",
          "NATIVE_HOST",
          "GUIDED_PRE_SUBMIT",
          "ORCHESTRATOR",
          0,
        ),
      ).authorized,
    ).toBe(true);
    expect(
      authorizeCommandRequestV1(
        request,
        context(
          "EXTENSION_SERVICE_WORKER",
          "NATIVE_HOST",
          "GUIDED_PRE_SUBMIT",
          "EXTENSION_CONTENT_SCRIPT",
          0,
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_FORBIDDEN",
    });
    expect(
      authorizeCommandRequestV1(
        request,
        context(
          "EXTENSION_SERVICE_WORKER",
          "NATIVE_HOST",
          "GUIDED_PRE_SUBMIT",
          "ORCHESTRATOR",
          1,
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });
    for (const observed_payload_size_bytes of [
      -1,
      1.5,
      true,
      "0",
      9_007_199_254_740_992,
    ]) {
      expect(
        authorizeCommandRequestV1(request, {
          receiving_principal: "EXTENSION_SERVICE_WORKER",
          authenticated_sender_principal: "NATIVE_HOST",
          authenticated_originating_principal: "ORCHESTRATOR",
          active_profile: "GUIDED_PRE_SUBMIT",
          observed_payload_size_bytes,
        }),
      ).toEqual({
        authorized: false,
        error_code: "TRANSPORT_MALFORMED_MESSAGE",
      });
    }
  });

  test("wrong final target, malformed context, and hostile input fail without echo", () => {
    const wrongTarget = {
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "NATIVE_HOST",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    expect(
      authorize(
        wrongTarget,
        "EXTENSION_SERVICE_WORKER",
        "EXTENSION_CONTENT_SCRIPT",
        "GUIDED_PRE_SUBMIT",
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_FORBIDDEN",
    });

    const hostile = {
      ...wrongTarget,
      command_id: "<script>alert(1)</script>",
      target_principal: "ORCHESTRATOR",
    };
    const outcome = authorizeCommandRequestV1(hostile, {
      receiving_principal: "__proto__",
      authenticated_sender_principal: "EXTENSION_CONTENT_SCRIPT",
      active_profile: "GUIDED_PRE_SUBMIT",
    });
    expect(outcome).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });
    expect(JSON.stringify(outcome)).not.toContain("script");
  });

  test("unknown principals/profiles deny and authorization never mutates inputs", () => {
    const valid = Object.freeze({
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "ORCHESTRATOR",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    });
    const before = JSON.stringify(valid);
    const validContext = Object.freeze({
      receiving_principal: "EXTENSION_SERVICE_WORKER",
      authenticated_sender_principal: "EXTENSION_CONTENT_SCRIPT",
      authenticated_originating_principal: "EXTENSION_CONTENT_SCRIPT",
      active_profile: "GUIDED_PRE_SUBMIT",
      observed_payload_size_bytes: 0,
    });
    expect(authorizeCommandRequestV1(valid, validContext).authorized).toBe(
      true,
    );
    expect(JSON.stringify(valid)).toBe(before);
    for (const changed of [
      { ...valid, originating_principal: "ADMIN" },
      { ...valid, authorization_profile: "AUTO_SUBMIT" },
    ]) {
      expect(authorizeCommandRequestV1(changed, validContext)).toEqual({
        authorized: false,
        error_code: "TRANSPORT_MALFORMED_MESSAGE",
      });
    }
  });

  test("the strict request record excludes payload, capability, decision, and denial text", () => {
    const valid = {
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "ORCHESTRATOR",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    expect(validateSecurityAuthorizationRequestV1(valid).valid).toBe(true);
    const { request_id: _requestId, ...missingRequestId } = valid;
    expect(_requestId).toBeDefined();
    expect(validateSecurityAuthorizationRequestV1(missingRequestId).valid).toBe(
      false,
    );
    for (const [field, value] of [
      ["payload", { selector: "#submit" }],
      ["required_capability", "PRIVATE_DATA_READ"],
      ["decision", "ALLOW"],
      ["denial_message", "<script>allow</script>"],
      ["filesystem_path", "/tmp/private"],
      ["shell_command", "run anything"],
      ["sql", "SELECT private_data"],
      ["selector", "#submit"],
      ["url", "https://example.invalid"],
      ["html", "<button>Submit</button>"],
      ["javascript", "document.forms[0].submit()"],
      ["causation_id", null],
      ["payload_digest", null],
      ["idempotency_key", null],
    ] as const) {
      expect(
        validateSecurityAuthorizationRequestV1({
          ...valid,
          [field]: value,
        }).valid,
        field,
      ).toBe(false);
    }
  });

  test("prototype inheritance and hostile own property names cannot supply authorization metadata", () => {
    const valid = {
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "ORCHESTRATOR",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    const inheritedOnly = Object.create(valid) as unknown;
    expect(validateSecurityAuthorizationRequestV1(inheritedOnly).valid).toBe(
      false,
    );
    expect(
      authorizeCommandRequestV1(
        inheritedOnly,
        context(
          "EXTENSION_SERVICE_WORKER",
          "EXTENSION_CONTENT_SCRIPT",
          "GUIDED_PRE_SUBMIT",
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });

    const inheritedIdempotency = Object.assign(
      Object.create({
        idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS",
      }) as Record<string, unknown>,
      {
        ...valid,
        command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal: "ORCHESTRATOR",
        immediate_sender: "EXTENSION_SERVICE_WORKER",
        target_principal: "EXTENSION_CONTENT_SCRIPT",
      },
    );
    expect(
      authorizeCommandRequestV1(
        inheritedIdempotency,
        context(
          "EXTENSION_CONTENT_SCRIPT",
          "EXTENSION_SERVICE_WORKER",
          "GUIDED_PRE_SUBMIT",
          "ORCHESTRATOR",
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });

    for (const property of ["__proto__", "constructor"]) {
      const hostile = { ...valid, [property]: "ALLOW" };
      expect(Object.hasOwn(hostile, property)).toBe(true);
      expect(validateSecurityAuthorizationRequestV1(hostile).valid).toBe(false);
    }
  });

  test("stateful accessors and descriptor-trapping proxies cannot create authorization TOCTOU drift", () => {
    const stable = {
      ...BASE_REQUEST,
      command_id: "PAGE_REPORT_STATE",
      originating_principal: "EXTENSION_CONTENT_SCRIPT",
      immediate_sender: "EXTENSION_CONTENT_SCRIPT",
      target_principal: "ORCHESTRATOR",
      authorization_profile: "GUIDED_PRE_SUBMIT",
    };
    const accessorRequest = { ...stable } as Record<string, unknown>;
    delete accessorRequest.command_id;
    let commandReads = 0;
    Object.defineProperty(accessorRequest, "command_id", {
      enumerable: true,
      get() {
        commandReads += 1;
        return commandReads < 4
          ? "PAGE_REPORT_STATE"
          : "PRIVATE_DATA_READ_REQUEST";
      },
    });
    expect(
      authorizeCommandRequestV1(
        accessorRequest,
        context(
          "EXTENSION_SERVICE_WORKER",
          "EXTENSION_CONTENT_SCRIPT",
          "GUIDED_PRE_SUBMIT",
          "EXTENSION_CONTENT_SCRIPT",
          0,
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });
    expect(commandReads).toBe(0);

    const descriptorTrap = new Proxy(stable, {
      ownKeys() {
        throw new Error("untrusted descriptor trap");
      },
    });
    expect(() =>
      authorizeCommandRequestV1(
        descriptorTrap,
        context(
          "EXTENSION_SERVICE_WORKER",
          "EXTENSION_CONTENT_SCRIPT",
          "GUIDED_PRE_SUBMIT",
          "EXTENSION_CONTENT_SCRIPT",
          0,
        ),
      ),
    ).not.toThrow();
    expect(
      authorizeCommandRequestV1(
        descriptorTrap,
        context(
          "EXTENSION_SERVICE_WORKER",
          "EXTENSION_CONTENT_SCRIPT",
          "GUIDED_PRE_SUBMIT",
          "EXTENSION_CONTENT_SCRIPT",
          0,
        ),
      ),
    ).toEqual({
      authorized: false,
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    });
  });
});

describe("fail-closed canonical-data tampering", () => {
  test("duplicate allow rows fail", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        allow.push(structuredClone(allow[0] ?? {}));
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /duplicate authorization allow row/,
    );
  });

  test("wildcards and unknown policy values fail schema validation", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        const first = allow[0];
        if (first !== undefined) {
          first.originating_principal = "*";
        }
      },
      /schema validation failed/,
    );
  });

  test("final-submit rows fail", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        allow.push({
          authorization_profile: "GUIDED_PRE_SUBMIT",
          command_id: "SUBMISSION_FINAL_SUBMIT",
          originating_principal: "ORCHESTRATOR",
          immediate_sender: "EXTENSION_SERVICE_WORKER",
          receiving_principal: "EXTENSION_CONTENT_SCRIPT",
          target_principal: "EXTENSION_CONTENT_SCRIPT",
        });
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /final submission has no current authority/,
    );
  });

  test("target and supported-profile mismatches fail", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        const first = allow[0];
        if (first !== undefined) {
          first.target_principal = "ORCHESTRATOR";
        }
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /target disagrees with command target/,
    );
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        allow.push({
          authorization_profile: "FEASIBILITY",
          command_id: "PAGE_NAVIGATE_NEXT",
          originating_principal: "VERIFICATION_HARNESS",
          immediate_sender: "VERIFICATION_HARNESS",
          receiving_principal: "ORCHESTRATOR",
          target_principal: "EXTENSION_CONTENT_SCRIPT",
        });
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /profile is absent from the command supported-profile set/,
    );
  });

  test("missing one forwarding row fails the complete-route invariant", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        const index = allow.findIndex(
          (row) =>
            row.authorization_profile === "GUIDED_PRE_SUBMIT" &&
            row.command_id === "PAGE_REPORT_STATE" &&
            row.immediate_sender === "EXTENSION_SERVICE_WORKER",
        );
        expect(index).toBeGreaterThanOrEqual(0);
        allow.splice(index, 1);
      },
      /route must contain exactly the complete reviewed hop sequence/,
    );
  });

  test("coordinated catalog edits cannot expand immutable profile capability ceilings", () => {
    expectCoordinatedTamperFailure(
      [
        [
          "command-catalog.v1.json",
          (document) => {
            const commands = document.commands as Record<string, unknown>[];
            const model = commands.find(
              (command) => command.id === "MODEL_INFERENCE_REQUEST",
            );
            expect(model).toBeDefined();
            if (model !== undefined) {
              model.supported_profiles = [
                "GUIDED_PRE_SUBMIT",
                "PRODUCTION_NO_SUBMIT",
              ];
            }
          },
        ],
        [
          "authorization-policy.v1.json",
          (document) => {
            const allow = document.allow as Record<string, unknown>[];
            allow.push({
              authorization_profile: "GUIDED_PRE_SUBMIT",
              command_id: "MODEL_INFERENCE_REQUEST",
              originating_principal: "ORCHESTRATOR",
              immediate_sender: "ORCHESTRATOR",
              receiving_principal: "MODEL_RUNTIME",
              target_principal: "MODEL_RUNTIME",
            });
            sortPolicyRows(allow);
          },
        ],
      ],
      /GUIDED_PRE_SUBMIT exceeds its immutable capability ceiling/,
    );

    expectCoordinatedTamperFailure(
      [
        [
          "command-catalog.v1.json",
          (document) => {
            const commands = document.commands as Record<string, unknown>[];
            const navigation = commands.find(
              (command) => command.id === "PAGE_NAVIGATE_NEXT",
            );
            expect(navigation).toBeDefined();
            if (navigation !== undefined) {
              navigation.supported_profiles = [
                "FEASIBILITY",
                "GUIDED_PRE_SUBMIT",
                "PRODUCTION_NO_SUBMIT",
                "VERIFICATION",
              ];
            }
          },
        ],
        [
          "authorization-policy.v1.json",
          (document) => {
            const allow = document.allow as Record<string, unknown>[];
            allow.push({
              authorization_profile: "FEASIBILITY",
              command_id: "PAGE_NAVIGATE_NEXT",
              originating_principal: "VERIFICATION_HARNESS",
              immediate_sender: "VERIFICATION_HARNESS",
              receiving_principal: "ORCHESTRATOR",
              target_principal: "EXTENSION_CONTENT_SCRIPT",
            });
            sortPolicyRows(allow);
          },
        ],
      ],
      /FEASIBILITY exceeds its immutable capability ceiling/,
    );
  });

  test("reviewed command capability and target boundaries reject semantic disguise", () => {
    expectTamperFailure(
      "command-catalog.v1.json",
      (document) => {
        const commands = document.commands as Record<string, unknown>[];
        const scan = commands.find(
          (command) => command.id === "PAGE_SCAN_VISIBLE_CONTROLS",
        );
        expect(scan).toBeDefined();
        if (scan !== undefined) {
          scan.required_capability = "SUBMISSION_FINAL";
        }
      },
      /final-submission capability has no current authority/,
    );

    expectCoordinatedTamperFailure(
      [
        [
          "command-catalog.v1.json",
          (document) => {
            const commands = document.commands as Record<string, unknown>[];
            const apply = commands.find(
              (command) => command.id === "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
            );
            expect(apply).toBeDefined();
            if (apply !== undefined) {
              apply.intended_target = "ORCHESTRATOR";
            }
          },
        ],
        [
          "authorization-policy.v1.json",
          (document) => {
            const allow = document.allow as Record<string, unknown>[];
            for (const row of allow) {
              if (row.command_id === "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS") {
                row.target_principal = "ORCHESTRATOR";
              }
            }
            sortPolicyRows(allow);
          },
        ],
      ],
      /required capability and intended target must match the reviewed command boundary/,
    );
  });

  test("security-critical idempotency and final-action metadata cannot be weakened", () => {
    expectTamperFailure(
      "command-catalog.v1.json",
      (document) => {
        const commands = document.commands as Record<string, unknown>[];
        const navigation = commands.find(
          (command) => command.id === "PAGE_NAVIGATE_NEXT",
        );
        expect(navigation).toBeDefined();
        if (navigation !== undefined) {
          navigation.idempotency_expectation = "IDEMPOTENT";
        }
      },
      /idempotency expectation contradicts the reviewed command semantics/,
    );
    expectTamperFailure(
      "command-catalog.v1.json",
      (document) => {
        const commands = document.commands as Record<string, unknown>[];
        const scan = commands.find(
          (command) => command.id === "PAGE_SCAN_VISIBLE_CONTROLS",
        );
        expect(scan).toBeDefined();
        if (scan !== undefined) {
          scan.consequence_class = "CONSEQUENTIAL_FINAL_ACTION";
        }
      },
      /final-action consequence classification is reserved/,
    );
  });

  test("content-script capability escalation fails independently of policy data", () => {
    expectTamperFailure(
      "command-catalog.v1.json",
      (document) => {
        const commands = document.commands as Record<string, unknown>[];
        const report = commands.find(
          (command) => command.id === "PAGE_REPORT_STATE",
        );
        if (report !== undefined) {
          report.required_capability = "PRIVATE_DATA_READ";
        }
      },
      /content-script origin cannot acquire privileged/,
    );
  });

  test("adding a content-script private-data row fails even when references exist", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        allow.push({
          authorization_profile: "PRODUCTION_NO_SUBMIT",
          command_id: "PRIVATE_DATA_READ_REQUEST",
          originating_principal: "EXTENSION_CONTENT_SCRIPT",
          immediate_sender: "NATIVE_HOST",
          receiving_principal: "ORCHESTRATOR",
          target_principal: "ORCHESTRATOR",
        });
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /content-script origin cannot acquire privileged/,
    );
  });

  test("platform authority remains impossible even if a row is added", () => {
    expectTamperFailure(
      "authorization-policy.v1.json",
      (document) => {
        const allow = document.allow as Record<string, unknown>[];
        allow.push({
          authorization_profile: "PRODUCTION_NO_SUBMIT",
          command_id: "PLATFORM_SECRET_STORE_REQUEST",
          originating_principal: "ORCHESTRATOR",
          immediate_sender: "ORCHESTRATOR",
          receiving_principal: "PLATFORM_ADAPTER",
          target_principal: "PLATFORM_ADAPTER",
        });
        allow.sort((left, right) => {
          const leftKey = JSON.stringify(Object.values(left));
          const rightKey = JSON.stringify(Object.values(right));
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        });
      },
      /platform commands are declared abstractly but have no current authority before M01-W07/,
    );
  });

  test("a valid catalog text edit without regeneration fails real check mode", () => {
    const catalogRoot = copyAndMutateCatalog(
      "capability-catalog.v1.json",
      (document) => {
        const capabilities = document.capabilities as Record<string, unknown>[];
        const first = capabilities[0];
        if (first !== undefined) {
          first.description = `${String(first.description)} Reviewed edit.`;
        }
      },
    );
    const result = runBoundedCliProcess(
      process.execPath,
      [CLI_PATH, "--check", "--catalog-root", catalogRoot],
      REPO_ROOT,
    );
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("MODIFIED");
    expect(result.output).toContain("MANIFEST.json");
  });
});
