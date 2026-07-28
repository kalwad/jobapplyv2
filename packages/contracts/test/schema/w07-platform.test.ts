import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { validateSemanticContractV1 } from "../../generated/typescript/semantic/rules.v1.ts";
import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);
const valuesDocument = JSON.parse(
  readFileSync(
    new URL("../contract/corpus/values.v1.json", import.meta.url),
    "utf8",
  ),
) as { readonly values: Readonly<Record<string, unknown>> };

const VOCABULARY = "urn:japp:schema:platform:vocabulary:v1";

/** Every M01-W07 root, paired with the synthetic corpus value that exercises it. */
const PLATFORM_ROOTS = [
  [
    "urn:japp:schema:platform:browser-discovery-request:v1",
    "w07.browser-discovery-request",
  ],
  ["urn:japp:schema:platform:browser-record:v1", "w07.browser-record"],
  ["urn:japp:schema:platform:capability-report:v1", "w07.capability-report"],
  [
    "urn:japp:schema:platform:certification-input:v1",
    "w07.certification-input",
  ],
  ["urn:japp:schema:platform:diagnostic-report:v1", "w07.diagnostic-report"],
  ["urn:japp:schema:platform:evidence-record:v1", "w07.evidence-record"],
  ["urn:japp:schema:platform:installer-state:v1", "w07.installer-state"],
  [
    "urn:japp:schema:platform:model-runtime-profile:v1",
    "w07.model-runtime-profile",
  ],
  [
    "urn:japp:schema:platform:native-messaging-registration:v1",
    "w07.native-messaging-registration",
  ],
  [
    "urn:japp:schema:platform:native-messaging-result:v1",
    "w07.native-messaging-result",
  ],
  ["urn:japp:schema:platform:path-request:v1", "w07.path-request"],
  ["urn:japp:schema:platform:path-resolution:v1", "w07.path-resolution"],
  ["urn:japp:schema:platform:process-plan:v1", "w07.process-plan"],
  ["urn:japp:schema:platform:process-status:v1", "w07.process-status"],
  ["urn:japp:schema:platform:runtime-capability:v1", "w07.runtime-capability"],
  [
    "urn:japp:schema:platform:secret-store-request:v1",
    "w07.secret-store-request",
  ],
  [
    "urn:japp:schema:platform:secret-store-result:v1",
    "w07.secret-store-result",
  ],
  ["urn:japp:schema:platform:target-identity:v1", "w07.target-identity"],
  ["urn:japp:schema:platform:update-state:v1", "w07.update-state"],
] as const;

function fixture(name: string): Record<string, unknown> {
  const value = valuesDocument.values[name];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`missing object fixture ${name}`);
  }
  return structuredClone(value) as Record<string, unknown>;
}

function enumTokens(definition: string): readonly string[] {
  const document = catalog.byId.get(VOCABULARY)?.document;
  const defs = document?.$defs;
  const node =
    typeof defs === "object" && defs !== null && !Array.isArray(defs)
      ? (defs as Record<string, unknown>)[definition]
      : undefined;
  const tokens =
    typeof node === "object" && node !== null && !Array.isArray(node)
      ? (node as Record<string, unknown>).enum
      : undefined;
  if (!Array.isArray(tokens)) {
    throw new Error(`${definition} does not declare an enum`);
  }
  return tokens.filter((token): token is string => typeof token === "string");
}

describe("M01-W07 platform contract inventory", () => {
  test("the canonical catalog carries exactly nineteen platform roots plus one vocabulary", () => {
    const platform = catalog.entries.filter((entry) =>
      entry.id.startsWith("urn:japp:schema:platform:"),
    );
    expect(platform).toHaveLength(PLATFORM_ROOTS.length + 1);
    expect(platform.map((entry) => entry.id)).toContain(VOCABULARY);
    // The vocabulary is definitions-only: it declares no root payload.
    expect(catalog.byId.get(VOCABULARY)?.document.type).toBeUndefined();
  });

  test.each(PLATFORM_ROOTS)(
    "%s validates its synthetic representative structurally and semantically",
    (schemaRef, valueRef) => {
      const value = fixture(valueRef);
      expect(validator.validateInstance(schemaRef, value)).toEqual({
        valid: true,
      });
      expect(validateSemanticContractV1(schemaRef, value)).toEqual({
        valid: true,
        issues: [],
      });
    },
  );
});

describe("M01-W07 certified platform and support vocabularies", () => {
  test("certified targets are exactly the three specification targets", () => {
    expect(enumTokens("certifiedPlatformId")).toEqual([
      "MACOS_ARM64",
      "UBUNTU_X64",
      "WINDOWS_X64",
    ]);
    expect(enumTokens("platformId")).toEqual([
      "MACOS_ARM64",
      "UBUNTU_X64",
      "UNKNOWN_TARGET",
      "UNSUPPORTED_TARGET",
      "WINDOWS_X64",
    ]);
  });

  test("support tiers are exactly the four specification tiers", () => {
    expect(enumTokens("supportTier")).toEqual([
      "CERTIFIED_CORE",
      "CERTIFIED_FULL",
      "EXPERIMENTAL",
      "UNSUPPORTED",
    ]);
  });

  test("capability states can represent every required non-success condition", () => {
    const tokens = enumTokens("capabilityAvailability");
    for (const required of [
      "AVAILABLE",
      "DEGRADED_LIMITED",
      "INCOMPATIBLE_VERSION",
      "NOT_EVALUATED",
      "NOT_INSTALLED",
      "PERMISSION_REQUIRED",
      "UNAVAILABLE",
      "UNKNOWN",
      "UNSUPPORTED_TARGET",
    ]) {
      expect(tokens, required).toContain(required);
    }
  });

  test("only Chrome stable is expressible as a certified browser", () => {
    expect(enumTokens("browserFamily")).toEqual(["CHROME", "UNKNOWN_BROWSER"]);
    expect(enumTokens("browserChannel")).toEqual(["STABLE", "UNKNOWN_CHANNEL"]);
    for (const absent of ["FIREFOX", "SAFARI", "EDGE", "CHROMEOS"]) {
      expect(enumTokens("browserFamily"), absent).not.toContain(absent);
    }
  });

  test("no platform vocabulary grants a submission or auto-start token", () => {
    const document = readFileSync(
      new URL(
        "../../schemas/platform/vocabulary.v1.schema.json",
        import.meta.url,
      ),
      "utf8",
    );
    for (const forbidden of [
      "AUTO_SUBMIT",
      "FINAL_SUBMIT",
      '"SUBMIT"',
      "PLAINTEXT",
    ]) {
      expect(document, forbidden).not.toContain(forbidden);
    }
  });
});

describe("M01-W07 trust-boundary payloads are structurally impossible", () => {
  test("a path request cannot carry an absolute, traversal, UNC, or drive path", () => {
    const request = fixture("w07.path-request");
    for (const segment of [
      "/etc/shadow",
      "..",
      "../secrets",
      "C:\\Windows",
      "\\\\server\\share",
      "$HOME",
      "~",
      "a/b",
    ]) {
      expect(
        validator.validateInstance("urn:japp:schema:platform:path-request:v1", {
          ...request,
          relative_segments: [segment],
        }).valid,
        segment,
      ).toBe(false);
    }
  });

  test("a spawn plan cannot carry shell text, an interpreter flag, or a path", () => {
    const plan = fixture("w07.process-plan");
    for (const argument of [
      "sh -c ls",
      "cmd /c dir",
      "powershell -enc AAA=",
      "serve && curl http://example.invalid",
      "serve | tee /tmp/out",
      "serve > /tmp/out",
      "$(whoami)",
      "/usr/bin/python3",
      "-EncodedCommand",
      "`id`",
    ]) {
      expect(
        validator.validateInstance("urn:japp:schema:platform:process-plan:v1", {
          ...plan,
          arguments: [argument],
        }).valid,
        argument,
      ).toBe(false);
    }
  });

  test("a resolved location must satisfy the sanitized role-anchored grammar", () => {
    const resolution = fixture("w07.path-resolution");
    for (const location of [
      "/Users/example/Library/japp",
      "C:\\Users\\example\\japp",
      "\\\\server\\share\\japp",
      "<APPLICATION_DATA>/../escape",
      "APPLICATION_DATA/artifacts",
      "<APPLICATION_DATA>\\artifacts",
    ]) {
      expect(
        validator.validateInstance(
          "urn:japp:schema:platform:path-resolution:v1",
          { ...resolution, sanitized_path: location },
        ).valid,
        location,
      ).toBe(false);
    }
    expect(
      validator.validateInstance(
        "urn:japp:schema:platform:path-resolution:v1",
        { ...resolution, sanitized_path: "<APPLICATION_DATA>" },
      ),
    ).toEqual({ valid: true });
  });

  test("a secret reference is opaque and secret material has no member", () => {
    const request = fixture("w07.secret-store-request");
    expect(
      validator.validateInstance(
        "urn:japp:schema:platform:secret-store-request:v1",
        { ...request, operation: "PUT", material_reference: "hunter2" },
      ).valid,
    ).toBe(false);
    for (const member of [
      "secret_value",
      "password",
      "private_key",
      "token",
      "keychain_service",
      "registry_key",
      "dbus_request",
    ]) {
      expect(
        validator.validateInstance(
          "urn:japp:schema:platform:secret-store-request:v1",
          { ...request, [member]: "value" },
        ).valid,
        member,
      ).toBe(false);
    }
  });

  test("registration cannot widen the reviewed extension allowlist", () => {
    const intent = fixture("w07.native-messaging-registration");
    for (const extensionId of [
      "*",
      "chrome-extension://abc",
      "ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP",
      "abcdefghijklmnopabcdefghijklmno",
      "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    ]) {
      expect(
        validator.validateInstance(
          "urn:japp:schema:platform:native-messaging-registration:v1",
          { ...intent, allowed_extension_ids: [extensionId] },
        ).valid,
        extensionId,
      ).toBe(false);
    }
  });

  test("optional non-nullable members reject an explicit null", () => {
    const status = fixture("w07.process-status");
    expect(
      validator.validateInstance("urn:japp:schema:platform:process-status:v1", {
        ...status,
        started_at: null,
      }).valid,
    ).toBe(false);
    const withoutStart = { ...status };
    delete withoutStart.started_at;
    expect(
      validator.validateInstance(
        "urn:japp:schema:platform:process-status:v1",
        withoutStart,
      ),
    ).toEqual({ valid: true });
  });
});

describe("M01-W07 semantic invariants that structure cannot express", () => {
  test("a missing local-AI profile never downgrades the reviewed core tier", () => {
    const report = fixture("w07.capability-report");
    const capabilities = report.capabilities as Record<string, unknown>[];
    const modelRuntime = capabilities.find(
      (state) => state.capability === "MODEL_RUNTIME",
    );
    expect(modelRuntime?.availability).toBe("NOT_EVALUATED");
    expect(report.model_profile_refs).toEqual([]);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:platform:capability-report:v1",
        report,
      ).valid,
    ).toBe(true);

    const claimingFull = structuredClone(report);
    (claimingFull.support_claim as Record<string, unknown>).reviewed_tier =
      "CERTIFIED_FULL";
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:platform:capability-report:v1",
        claimingFull,
      ).valid,
    ).toBe(false);
  });

  test("an unsupported target can never carry a certified reviewed tier", () => {
    const identity = fixture("w07.target-identity");
    const unsupported = structuredClone(identity);
    unsupported.platform_id = "UNSUPPORTED_TARGET";
    unsupported.architecture = "UNKNOWN_ARCHITECTURE";
    (unsupported.support_claim as Record<string, unknown>).reviewed_tier =
      "CERTIFIED_CORE";
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:platform:target-identity:v1",
        unsupported,
      ).valid,
    ).toBe(false);
  });

  test("platform requests are unreachable from the page world", () => {
    for (const [schemaRef, valueRef] of [
      ["urn:japp:schema:platform:path-request:v1", "w07.path-request"],
      [
        "urn:japp:schema:platform:secret-store-request:v1",
        "w07.secret-store-request",
      ],
      ["urn:japp:schema:platform:process-plan:v1", "w07.process-plan"],
      [
        "urn:japp:schema:platform:native-messaging-registration:v1",
        "w07.native-messaging-registration",
      ],
      [
        "urn:japp:schema:platform:browser-discovery-request:v1",
        "w07.browser-discovery-request",
      ],
    ] as const) {
      for (const principal of [
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "MODEL_RUNTIME",
        "PUBLIC_JOB_INDEX",
        "DESKTOP_APP",
        "NATIVE_HOST",
        "PLATFORM_ADAPTER",
      ]) {
        const value = fixture(valueRef);
        (
          value.request_context as Record<string, unknown>
        ).requesting_principal = principal;
        expect(
          validateSemanticContractV1(schemaRef, value).valid,
          `${schemaRef} ${principal}`,
        ).toBe(false);
      }
      for (const profile of ["FEASIBILITY", "GUIDED_PRE_SUBMIT"]) {
        const value = fixture(valueRef);
        (
          value.request_context as Record<string, unknown>
        ).authorization_profile = profile;
        expect(
          validateSemanticContractV1(schemaRef, value).valid,
          `${schemaRef} ${profile}`,
        ).toBe(false);
      }
    }
  });

  test("no accepted model profile is expressible without measured evidence", () => {
    const profile = fixture("w07.model-runtime-profile");
    expect(profile.acceptance_state).toBe("NOT_EVALUATED");
    const accepted = structuredClone(profile);
    accepted.acceptance_state = "ACCEPTED";
    accepted.availability = "AVAILABLE";
    accepted.core_capability_behavior = "FULL_AI_AVAILABLE";
    accepted.reason_codes = [];
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:platform:model-runtime-profile:v1",
        accepted,
      ).valid,
    ).toBe(false);
  });
});
