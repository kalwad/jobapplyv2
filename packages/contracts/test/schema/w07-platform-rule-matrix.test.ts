import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { SEMANTIC_RULES_V1 } from "../../generated/typescript/semantic/rules.v1.ts";
import { validateSemanticContractV1 } from "../../generated/typescript/semantic/rules.v1.ts";
import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

/**
 * Explicit M01-W07 platform semantic-rule matrices and durable rule-kind
 * coverage (KI-0024).
 *
 * Every matrix below is reviewed source data derived from the canonical
 * specification and the committed contract documentation. Nothing here parses
 * evaluator source, and nothing derives an expectation by running the
 * evaluator first: each expectation is stated independently and then asserted.
 */

const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);
const valuesDocument = JSON.parse(
  readFileSync(
    new URL("../contract/corpus/values.v1.json", import.meta.url),
    "utf8",
  ),
) as { readonly values: Readonly<Record<string, unknown>> };

const VOCABULARY = "urn:japp:schema:platform:vocabulary:v1";
const CAPABILITY_TAXONOMY = "urn:japp:schema:security:capability-taxonomy:v1";
const REDACTION = "urn:japp:schema:common:redaction:v1";

const NATIVE_RESULT = "urn:japp:schema:platform:native-messaging-result:v1";
const PROCESS_PLAN = "urn:japp:schema:platform:process-plan:v1";

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

/** Structural acceptance plus the semantic verdict, as one comparable pair. */
function verdicts(
  schemaRef: string,
  value: Record<string, unknown>,
): { structural: boolean; semantic: boolean } {
  return {
    structural: validator.validateInstance(schemaRef, value).valid,
    semantic: validateSemanticContractV1(schemaRef, value).valid,
  };
}

// ---------------------------------------------------------------------------
// 1. Native-messaging registration result: complete operation/state matrix
// ---------------------------------------------------------------------------

const REGISTRATION_OPERATIONS = [
  "INSTALL",
  "REMOVE",
  "REPAIR",
  "UPDATE",
  "VERIFY",
] as const;

const REGISTRATION_STATES = [
  "ABSENT",
  "CORRUPT",
  "MISMATCHED_IDENTITY",
  "NOT_EVALUATED",
  "PRESENT_STALE",
  "PRESENT_VALID",
] as const;

type RegistrationOperation = (typeof REGISTRATION_OPERATIONS)[number];
type RegistrationState = (typeof REGISTRATION_STATES)[number];

/**
 * The terminal state each operation reaches when it succeeds. Specification
 * §5.14.5 makes install, verify, repair, update, and uninstall idempotent, so
 * a repeat that already observes the terminal state is still a success and
 * simply reports `changed: false`.
 */
const TERMINAL_STATE: Readonly<
  Record<RegistrationOperation, RegistrationState>
> = {
  INSTALL: "PRESENT_VALID",
  REMOVE: "ABSENT",
  REPAIR: "PRESENT_VALID",
  UPDATE: "PRESENT_VALID",
  VERIFY: "PRESENT_VALID",
};

/**
 * The single most coherent reason vocabulary for each non-terminal
 * observation. A state that explains itself through a specific finite reason
 * must carry exactly that reason.
 */
const STATE_REASONS: Readonly<Record<RegistrationState, readonly string[]>> = {
  ABSENT: ["NOT_INSTALLED"],
  CORRUPT: ["CONFIGURATION_INVALID"],
  MISMATCHED_IDENTITY: ["IDENTITY_MISMATCH"],
  NOT_EVALUATED: ["EVALUATION_NOT_RUN"],
  PRESENT_STALE: ["INCOMPATIBLE_RUNTIME_VERSION"],
  PRESENT_VALID: [],
};

/** Only a genuinely present, valid registration carries observed identity. */
const STATES_WITH_IDENTITY: readonly RegistrationState[] = [
  "CORRUPT",
  "MISMATCHED_IDENTITY",
  "PRESENT_STALE",
  "PRESENT_VALID",
];

interface RegistrationCell {
  readonly operation: RegistrationOperation;
  readonly observed_state: RegistrationState;
  readonly changed: boolean;
  readonly idempotent_repeat_safe: boolean;
  readonly reason_codes: readonly string[];
  readonly identity: boolean;
}

function buildRegistrationResult(
  cell: RegistrationCell,
): Record<string, unknown> {
  const value = fixture("w07.native-messaging-result");
  value.operation = cell.operation;
  value.observed_state = cell.observed_state;
  value.changed = cell.changed;
  value.idempotent_repeat_safe = cell.idempotent_repeat_safe;
  value.reason_codes = [...cell.reason_codes];
  if (cell.identity) {
    value.observed_manifest_digest =
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    value.observed_host_version = "1.0.0";
  } else {
    delete value.observed_manifest_digest;
    delete value.observed_host_version;
  }
  return value;
}

/** The canonical representative for one operation/state cell. */
function registrationRepresentative(
  operation: RegistrationOperation,
  observedState: RegistrationState,
): RegistrationCell {
  const succeeds = TERMINAL_STATE[operation] === observedState;
  return {
    operation,
    observed_state: observedState,
    // A verify operation can never report a change, and an unevaluated
    // observation cannot have changed anything either.
    changed:
      operation === "VERIFY" || observedState === "NOT_EVALUATED"
        ? false
        : succeeds,
    idempotent_repeat_safe: succeeds,
    reason_codes: succeeds ? [] : STATE_REASONS[observedState],
    identity: STATES_WITH_IDENTITY.includes(observedState),
  };
}

/**
 * `REMOVE` is the only operation whose terminal state is `ABSENT`, so
 * `REMOVE` observing `PRESENT_VALID` is the one operation/state pair that no
 * coherent representative can rescue: a clean `PRESENT_VALID` observation
 * contradicts a successful removal, and `PRESENT_VALID` never carries a
 * failure reason.
 */
const REJECTED_REGISTRATION_CELLS = new Set(["REMOVE/PRESENT_VALID"]);

describe("M01-W07 native-registration operation/state matrix (KI-0024)", () => {
  const cells = REGISTRATION_OPERATIONS.flatMap((operation) =>
    REGISTRATION_STATES.map(
      (observedState) => [operation, observedState] as const,
    ),
  );

  test("the matrix covers every operation and every observed state", () => {
    expect(enumTokens("registrationOperation")).toEqual([
      ...REGISTRATION_OPERATIONS,
    ]);
    expect(enumTokens("registrationState")).toEqual([...REGISTRATION_STATES]);
    expect(cells).toHaveLength(30);
  });

  test.each(cells)(
    "%s observing %s admits exactly its reviewed representative",
    (operation, observedState) => {
      const cell = registrationRepresentative(operation, observedState);
      const value = buildRegistrationResult(cell);
      const expected = !REJECTED_REGISTRATION_CELLS.has(
        `${operation}/${observedState}`,
      );
      expect(verdicts(NATIVE_RESULT, value)).toEqual({
        structural: true,
        semantic: expected,
      });
    },
  );

  test("a successful removal observing ABSENT is reachable, changed or not", () => {
    for (const changed of [true, false]) {
      const value = buildRegistrationResult({
        operation: "REMOVE",
        observed_state: "ABSENT",
        changed,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: false,
      });
      expect(verdicts(NATIVE_RESULT, value)).toEqual({
        structural: true,
        semantic: true,
      });
    }
  });

  test.each(["INSTALL", "REPAIR", "UPDATE", "VERIFY"] as const)(
    "a successful %s requires observed manifest and host identity",
    (operation) => {
      const base = {
        operation,
        observed_state: "PRESENT_VALID",
        changed: operation !== "VERIFY",
        idempotent_repeat_safe: true,
        reason_codes: [],
      } as const;
      expect(
        verdicts(
          NATIVE_RESULT,
          buildRegistrationResult({ ...base, identity: true }),
        ),
      ).toEqual({ structural: true, semantic: true });
      expect(
        verdicts(
          NATIVE_RESULT,
          buildRegistrationResult({ ...base, identity: false }),
        ),
      ).toEqual({ structural: true, semantic: false });
    },
  );

  const REGISTRATION_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly cell: RegistrationCell;
  }[] = [
    {
      id: "verify reports a mutation",
      cell: {
        operation: "VERIFY",
        observed_state: "PRESENT_VALID",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: true,
      },
    },
    {
      id: "successful removal is not repeat-safe",
      cell: {
        operation: "REMOVE",
        observed_state: "ABSENT",
        changed: true,
        idempotent_repeat_safe: false,
        reason_codes: [],
        identity: false,
      },
    },
    {
      id: "removal claims success while the registration is still valid",
      cell: {
        operation: "REMOVE",
        observed_state: "PRESENT_VALID",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: true,
      },
    },
    {
      id: "install claims success while nothing is registered",
      cell: {
        operation: "INSTALL",
        observed_state: "ABSENT",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: false,
      },
    },
    {
      id: "absent observation still reports a manifest identity",
      cell: {
        operation: "REMOVE",
        observed_state: "ABSENT",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: true,
      },
    },
    {
      id: "unevaluated observation still reports a manifest identity",
      cell: {
        operation: "VERIFY",
        observed_state: "NOT_EVALUATED",
        changed: false,
        idempotent_repeat_safe: true,
        reason_codes: ["EVALUATION_NOT_RUN"],
        identity: true,
      },
    },
    {
      id: "unevaluated observation claims a change",
      cell: {
        operation: "INSTALL",
        observed_state: "NOT_EVALUATED",
        changed: true,
        idempotent_repeat_safe: false,
        reason_codes: ["EVALUATION_NOT_RUN"],
        identity: false,
      },
    },
    {
      id: "mismatched identity without the identity-mismatch reason",
      cell: {
        operation: "VERIFY",
        observed_state: "MISMATCHED_IDENTITY",
        changed: false,
        idempotent_repeat_safe: false,
        reason_codes: ["ADAPTER_ERROR"],
        identity: true,
      },
    },
    {
      id: "identity-mismatch reason without the mismatched-identity state",
      cell: {
        operation: "VERIFY",
        observed_state: "CORRUPT",
        changed: false,
        idempotent_repeat_safe: false,
        reason_codes: ["IDENTITY_MISMATCH"],
        identity: true,
      },
    },
    {
      id: "unevaluated reason without the unevaluated state",
      cell: {
        operation: "VERIFY",
        observed_state: "ABSENT",
        changed: false,
        idempotent_repeat_safe: true,
        reason_codes: ["EVALUATION_NOT_RUN"],
        identity: false,
      },
    },
    {
      id: "unevaluated state without the unevaluated reason",
      cell: {
        operation: "VERIFY",
        observed_state: "NOT_EVALUATED",
        changed: false,
        idempotent_repeat_safe: true,
        reason_codes: ["ADAPTER_ERROR"],
        identity: false,
      },
    },
    {
      id: "a valid registration carries a failure reason",
      cell: {
        operation: "INSTALL",
        observed_state: "PRESENT_VALID",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: ["ADAPTER_ERROR"],
        identity: true,
      },
    },
    {
      id: "a stale registration claims success",
      cell: {
        operation: "UPDATE",
        observed_state: "PRESENT_STALE",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: true,
      },
    },
    {
      id: "a corrupt registration claims success",
      cell: {
        operation: "REPAIR",
        observed_state: "CORRUPT",
        changed: true,
        idempotent_repeat_safe: true,
        reason_codes: [],
        identity: true,
      },
    },
  ];

  test.each(REGISTRATION_CONTRADICTIONS)(
    "rejects a result where $id",
    ({ cell }) => {
      expect(verdicts(NATIVE_RESULT, buildRegistrationResult(cell))).toEqual({
        structural: true,
        semantic: false,
      });
    },
  );

  test("the browser family stays bound to the certified browser", () => {
    const value = buildRegistrationResult(
      registrationRepresentative("INSTALL", "PRESENT_VALID"),
    );
    value.browser_family = "UNKNOWN_BROWSER";
    expect(verdicts(NATIVE_RESULT, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Process spawn plan: native-messaging framing across every stdio channel
// ---------------------------------------------------------------------------

const STDIO_MODES = [
  "BINARY_LENGTH_PREFIXED",
  "INHERIT_NONE",
  "NULL_DEVICE",
  "PIPE_BOUNDED",
] as const;

const PROCESS_PROFILES = [
  "LOCAL_ORCHESTRATOR",
  "MODEL_RUNTIME_HOST",
  "NATIVE_MESSAGING_HOST",
] as const;

const NON_FRAMED_MODES = STDIO_MODES.filter(
  (mode) => mode !== "BINARY_LENGTH_PREFIXED",
);

function buildPlan(
  profile: (typeof PROCESS_PROFILES)[number],
  stdin: string,
  stdout: string,
  stderr: string,
): Record<string, unknown> {
  const value = fixture("w07.process-plan");
  value.profile = profile;
  value.stdin_mode = stdin;
  value.stdout_mode = stdout;
  value.stderr_mode = stderr;
  return value;
}

describe("M01-W07 process-plan stdio framing matrix (KI-0024)", () => {
  test("the matrix covers every stdio mode and every approved profile", () => {
    expect(enumTokens("stdioMode")).toEqual([...STDIO_MODES]);
    expect(enumTokens("processProfileId")).toEqual([...PROCESS_PROFILES]);
  });

  test.each(NON_FRAMED_MODES)(
    "a native-messaging host frames stdin/stdout and leaves stderr as %s",
    (stderr) => {
      expect(
        verdicts(
          PROCESS_PLAN,
          buildPlan(
            "NATIVE_MESSAGING_HOST",
            "BINARY_LENGTH_PREFIXED",
            "BINARY_LENGTH_PREFIXED",
            stderr,
          ),
        ),
      ).toEqual({ structural: true, semantic: true });
    },
  );

  test("a native-messaging host may not frame its diagnostic channel", () => {
    expect(
      verdicts(
        PROCESS_PLAN,
        buildPlan(
          "NATIVE_MESSAGING_HOST",
          "BINARY_LENGTH_PREFIXED",
          "BINARY_LENGTH_PREFIXED",
          "BINARY_LENGTH_PREFIXED",
        ),
      ),
    ).toEqual({ structural: true, semantic: false });
  });

  test.each(["stdin_mode", "stdout_mode"] as const)(
    "a native-messaging host must frame %s",
    (channel) => {
      const value = buildPlan(
        "NATIVE_MESSAGING_HOST",
        "BINARY_LENGTH_PREFIXED",
        "BINARY_LENGTH_PREFIXED",
        "PIPE_BOUNDED",
      );
      value[channel] = "PIPE_BOUNDED";
      expect(verdicts(PROCESS_PLAN, value)).toEqual({
        structural: true,
        semantic: false,
      });
    },
  );

  const NON_NATIVE_PROFILES = PROCESS_PROFILES.filter(
    (profile) => profile !== "NATIVE_MESSAGING_HOST",
  );

  const FRAMED_CHANNEL_CASES = NON_NATIVE_PROFILES.flatMap((profile) =>
    (["stdin_mode", "stdout_mode", "stderr_mode"] as const).map(
      (channel) => [profile, channel] as const,
    ),
  );

  test.each(FRAMED_CHANNEL_CASES)(
    "%s may not use native-message framing on %s",
    (profile, channel) => {
      const value = buildPlan(
        profile,
        "INHERIT_NONE",
        "PIPE_BOUNDED",
        "PIPE_BOUNDED",
      );
      value[channel] = "BINARY_LENGTH_PREFIXED";
      expect(verdicts(PROCESS_PLAN, value)).toEqual({
        structural: true,
        semantic: false,
      });
    },
  );

  test.each(NON_NATIVE_PROFILES)(
    "%s keeps every unframed stdio combination available",
    (profile) => {
      for (const stdin of NON_FRAMED_MODES) {
        for (const stdout of NON_FRAMED_MODES) {
          for (const stderr of NON_FRAMED_MODES) {
            expect(
              verdicts(PROCESS_PLAN, buildPlan(profile, stdin, stdout, stderr)),
            ).toEqual({ structural: true, semantic: true });
          }
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 3. platform_id / architecture coherence across every root that carries both
// ---------------------------------------------------------------------------

/**
 * Specification §5.14.1 binds each certified target to exactly one processor
 * architecture. Every M01-W07 root that records both must agree with it.
 */
const ARCHITECTURE_BY_CERTIFIED_TARGET = {
  MACOS_ARM64: "ARM64",
  UBUNTU_X64: "X86_64",
  WINDOWS_X64: "X86_64",
} as const;

/** Roots that carry both `platform_id` and `architecture`. */
const ARCHITECTURE_BEARING_ROOTS = [
  [
    "urn:japp:schema:platform:certification-input:v1",
    "w07.certification-input",
    "platformId",
  ],
  [
    "urn:japp:schema:platform:evidence-record:v1",
    "w07.evidence-record",
    "platformId",
  ],
  [
    "urn:japp:schema:platform:installer-state:v1",
    "w07.installer-state",
    "certifiedPlatformId",
  ],
  [
    "urn:japp:schema:platform:target-identity:v1",
    "w07.target-identity",
    "platformId",
  ],
  [
    "urn:japp:schema:platform:update-state:v1",
    "w07.update-state",
    "certifiedPlatformId",
  ],
] as const;

describe("M01-W07 platform/architecture coherence (KI-0024)", () => {
  test("the reviewed root list is exactly the roots carrying both fields", () => {
    const bearing = catalog.entries
      .filter((entry) => entry.id.startsWith("urn:japp:schema:platform:"))
      .filter((entry) => {
        const properties = entry.document.properties;
        if (typeof properties !== "object" || properties === null) {
          return false;
        }
        const named = properties as Record<string, unknown>;
        return "platform_id" in named && "architecture" in named;
      })
      .map((entry) => entry.id)
      .sort();
    expect(bearing).toEqual(
      ARCHITECTURE_BEARING_ROOTS.map(([id]) => id).toSorted(),
    );
  });

  test("the reviewed architecture map matches the certified target vocabulary", () => {
    expect(Object.keys(ARCHITECTURE_BY_CERTIFIED_TARGET).toSorted()).toEqual([
      ...enumTokens("certifiedPlatformId"),
    ]);
    for (const architecture of Object.values(
      ARCHITECTURE_BY_CERTIFIED_TARGET,
    )) {
      expect(enumTokens("architecture")).toContain(architecture);
    }
  });

  const coherentCases = ARCHITECTURE_BEARING_ROOTS.flatMap(
    ([schemaRef, valueRef]) =>
      Object.entries(ARCHITECTURE_BY_CERTIFIED_TARGET).map(
        ([platformId, architecture]) =>
          [schemaRef, valueRef, platformId, architecture] as const,
      ),
  );

  test.each(coherentCases)(
    "%s accepts %s with %s/%s",
    (schemaRef, valueRef, platformId, architecture) => {
      const value = fixture(valueRef);
      value.platform_id = platformId;
      value.architecture = architecture;
      expect(verdicts(schemaRef, value)).toEqual({
        structural: true,
        semantic: true,
      });
    },
  );

  const contradictoryCases = ARCHITECTURE_BEARING_ROOTS.flatMap(
    ([schemaRef, valueRef]) =>
      Object.keys(ARCHITECTURE_BY_CERTIFIED_TARGET).flatMap((platformId) =>
        enumTokens("architecture")
          .filter(
            (architecture) =>
              architecture !==
              ARCHITECTURE_BY_CERTIFIED_TARGET[
                platformId as keyof typeof ARCHITECTURE_BY_CERTIFIED_TARGET
              ],
          )
          .map(
            (architecture) =>
              [schemaRef, valueRef, platformId, architecture] as const,
          ),
      ),
  );

  test.each(contradictoryCases)(
    "%s rejects %s claiming %s/%s",
    (schemaRef, valueRef, platformId, architecture) => {
      const value = fixture(valueRef);
      value.platform_id = platformId;
      value.architecture = architecture;
      expect(verdicts(schemaRef, value)).toEqual({
        structural: true,
        semantic: false,
      });
    },
  );

  /**
   * An uncertifiable target is deliberately left unbound so an honest
   * UNKNOWN_ARCHITECTURE observation stays representable. Only the three roots
   * whose `platform_id` accepts an uncertifiable token can express it.
   */
  const UNCERTIFIABLE_ROOTS = ARCHITECTURE_BEARING_ROOTS.filter(
    ([, , vocabulary]) => vocabulary === "platformId",
  );

  test("every uncertifiable-target root uses the wider platform vocabulary", () => {
    expect(UNCERTIFIABLE_ROOTS).toHaveLength(3);
    expect(enumTokens("platformId")).toContain("UNKNOWN_TARGET");
    expect(enumTokens("platformId")).toContain("UNSUPPORTED_TARGET");
    expect(enumTokens("architecture")).toContain("UNKNOWN_ARCHITECTURE");
  });

  test.each(UNCERTIFIABLE_ROOTS)(
    "%s leaves an uncertifiable target's architecture unbound",
    (schemaRef, valueRef) => {
      for (const platformId of ["UNKNOWN_TARGET", "UNSUPPORTED_TARGET"]) {
        const value = fixture(valueRef);
        value.platform_id = platformId;
        value.architecture = "UNKNOWN_ARCHITECTURE";
        // The architecture binding never rejects an uncertifiable target; the
        // record may still be refused for an unrelated certification reason,
        // so only structural representability is asserted here.
        expect(validator.validateInstance(schemaRef, value).valid).toBe(true);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 4. Durable registry for every platform semantic rule kind
// ---------------------------------------------------------------------------

interface PlatformRuleEntry {
  readonly rule_kind: string;
  readonly schema_refs: readonly string[];
  readonly tokens: readonly {
    readonly token: string;
    readonly enum_definition: string;
    readonly schema_id?: string;
  }[];
  /** A structurally valid, semantically contradictory mutation of the root. */
  readonly contradiction: {
    readonly value_ref: string;
    readonly schema_ref: string;
    readonly mutate: (value: Record<string, unknown>) => void;
    readonly description: string;
  };
}

const REQUEST_AUTHORITY_TOKENS = [
  {
    token: "ORCHESTRATOR",
    enum_definition: "principalId",
    schema_id: CAPABILITY_TAXONOMY,
  },
  {
    token: "VERIFICATION_HARNESS",
    enum_definition: "principalId",
    schema_id: CAPABILITY_TAXONOMY,
  },
  {
    token: "PRODUCTION_NO_SUBMIT",
    enum_definition: "authorizationProfileId",
    schema_id: CAPABILITY_TAXONOMY,
  },
  {
    token: "VERIFICATION",
    enum_definition: "authorizationProfileId",
    schema_id: CAPABILITY_TAXONOMY,
  },
] as const;

const CERTIFIED_TARGET_TOKENS = [
  { token: "MACOS_ARM64", enum_definition: "certifiedPlatformId" },
  { token: "UBUNTU_X64", enum_definition: "certifiedPlatformId" },
  { token: "WINDOWS_X64", enum_definition: "certifiedPlatformId" },
] as const;

const CAPABILITY_STATE_TOKENS = [
  { token: "AVAILABLE", enum_definition: "capabilityAvailability" },
  { token: "DEGRADED_LIMITED", enum_definition: "capabilityAvailability" },
  { token: "NOT_EVALUATED", enum_definition: "capabilityAvailability" },
  { token: "NOT_EVALUATED", enum_definition: "evaluationMethod" },
  { token: "EVALUATION_NOT_RUN", enum_definition: "platformReasonCode" },
] as const;

const SUPPORT_CLAIM_TOKENS = [
  { token: "CERTIFIED_CORE", enum_definition: "supportTier" },
  { token: "CERTIFIED_FULL", enum_definition: "supportTier" },
  { token: "UNSUPPORTED", enum_definition: "supportTier" },
  { token: "UNKNOWN_TARGET", enum_definition: "platformId" },
  { token: "UNSUPPORTED_TARGET", enum_definition: "platformId" },
  { token: "REVIEW_COMPLETE", enum_definition: "reviewState" },
] as const;

const ARCHITECTURE_TOKENS = [
  { token: "ARM64", enum_definition: "architecture" },
  { token: "X86_64", enum_definition: "architecture" },
] as const;

const PLATFORM_RULE_REGISTRY: readonly PlatformRuleEntry[] = [
  {
    rule_kind: "PLATFORM_BROWSER_DISCOVERY_SAFETY",
    schema_refs: ["urn:japp:schema:platform:browser-discovery-request:v1"],
    tokens: [
      ...REQUEST_AUTHORITY_TOKENS,
      ...CERTIFIED_TARGET_TOKENS,
      { token: "CHROME", enum_definition: "browserFamily" },
      { token: "STABLE", enum_definition: "browserChannel" },
    ],
    contradiction: {
      value_ref: "w07.browser-discovery-request",
      schema_ref: "urn:japp:schema:platform:browser-discovery-request:v1",
      description: "probes capability on an uncertified target",
      mutate: (value) => {
        value.platform_id = "UNSUPPORTED_TARGET";
        value.include_capability_probe = true;
      },
    },
  },
  {
    rule_kind: "PLATFORM_BROWSER_RECORD_SCOPE",
    schema_refs: ["urn:japp:schema:platform:browser-record:v1"],
    tokens: [
      ...CERTIFIED_TARGET_TOKENS,
      ...CAPABILITY_STATE_TOKENS,
      { token: "CHROME", enum_definition: "browserFamily" },
      { token: "STABLE", enum_definition: "browserChannel" },
      { token: "NATIVE_MESSAGING", enum_definition: "platformCapabilityId" },
      { token: "MEASURED_NATIVE_RUN", enum_definition: "evaluationMethod" },
    ],
    contradiction: {
      value_ref: "w07.browser-record",
      schema_ref: "urn:japp:schema:platform:browser-record:v1",
      description: "certifies a browser that was only statically inspected",
      mutate: (value) => {
        value.certified_for_platform = true;
      },
    },
  },
  {
    rule_kind: "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
    schema_refs: ["urn:japp:schema:platform:capability-report:v1"],
    tokens: [
      ...CAPABILITY_STATE_TOKENS,
      ...SUPPORT_CLAIM_TOKENS,
      { token: "BROWSER_PRESENCE", enum_definition: "platformCapabilityId" },
      { token: "DIAGNOSTICS", enum_definition: "platformCapabilityId" },
      { token: "MODEL_RUNTIME", enum_definition: "platformCapabilityId" },
      { token: "NATIVE_MESSAGING", enum_definition: "platformCapabilityId" },
      {
        token: "PACKAGING_UPDATE_CHANNEL",
        enum_definition: "platformCapabilityId",
      },
      { token: "PLATFORM_PATHS", enum_definition: "platformCapabilityId" },
      { token: "PROCESS_SUPERVISION", enum_definition: "platformCapabilityId" },
      { token: "SECURE_STORE", enum_definition: "platformCapabilityId" },
    ],
    contradiction: {
      value_ref: "w07.capability-report",
      schema_ref: "urn:japp:schema:platform:capability-report:v1",
      description: "reports an available capability without its identity",
      mutate: (value) => {
        const capabilities = value.capabilities as Record<string, unknown>[];
        const available = capabilities.find(
          (state) => state.availability === "AVAILABLE",
        );
        if (available === undefined) {
          throw new Error("fixture has no AVAILABLE capability state");
        }
        delete available.identity_token;
      },
    },
  },
  {
    rule_kind: "PLATFORM_CERTIFICATION_INPUT_SCOPE",
    schema_refs: ["urn:japp:schema:platform:certification-input:v1"],
    tokens: [
      ...SUPPORT_CLAIM_TOKENS,
      ...ARCHITECTURE_TOKENS,
      { token: "RECORDED", enum_definition: "ownerDecisionState" },
    ],
    contradiction: {
      value_ref: "w07.certification-input",
      schema_ref: "urn:japp:schema:platform:certification-input:v1",
      description: "claims an architecture the certified target cannot have",
      mutate: (value) => {
        value.platform_id = "MACOS_ARM64";
        value.architecture = "X86_64";
      },
    },
  },
  {
    rule_kind: "PLATFORM_DIAGNOSTIC_INTEGRITY",
    schema_refs: ["urn:japp:schema:platform:diagnostic-report:v1"],
    tokens: [
      { token: "SECRET_STORE", enum_definition: "platformComponentId" },
      { token: "SECURE_STORE", enum_definition: "platformCapabilityId" },
      { token: "BROWSER_LOCATOR", enum_definition: "platformComponentId" },
      { token: "PLATFORM_PATHS", enum_definition: "platformComponentId" },
      { token: "SUCCESS", enum_definition: "diagnosticResult" },
    ],
    contradiction: {
      value_ref: "w07.diagnostic-report",
      schema_ref: "urn:japp:schema:platform:diagnostic-report:v1",
      description: "reports a component under the wrong capability family",
      mutate: (value) => {
        value.capability = "MODEL_RUNTIME";
      },
    },
  },
  {
    rule_kind: "PLATFORM_EVIDENCE_INTEGRITY",
    schema_refs: ["urn:japp:schema:platform:evidence-record:v1"],
    tokens: [
      ...CERTIFIED_TARGET_TOKENS,
      ...ARCHITECTURE_TOKENS,
      { token: "MEASURED_NATIVE_RUN", enum_definition: "evaluationMethod" },
      { token: "STATIC_INSPECTION", enum_definition: "evaluationMethod" },
      { token: "SYNTHETIC_FIXTURE", enum_definition: "machineClass" },
      { token: "HOSTED_CI_RUNNER", enum_definition: "machineClass" },
      {
        token: "PHYSICAL_DEVELOPMENT_MACHINE",
        enum_definition: "machineClass",
      },
      { token: "REVIEW_COMPLETE", enum_definition: "reviewState" },
      { token: "RECORDED", enum_definition: "ownerDecisionState" },
    ],
    contradiction: {
      value_ref: "w07.evidence-record",
      schema_ref: "urn:japp:schema:platform:evidence-record:v1",
      description: "claims an architecture the certified target cannot have",
      mutate: (value) => {
        value.platform_id = "WINDOWS_X64";
        value.architecture = "ARM64";
      },
    },
  },
  {
    rule_kind: "PLATFORM_MODEL_PROFILE_EVIDENCE",
    schema_refs: ["urn:japp:schema:platform:model-runtime-profile:v1"],
    tokens: [
      ...CERTIFIED_TARGET_TOKENS,
      { token: "APPLE_SILICON_GPU", enum_definition: "acceleratorClass" },
      { token: "NVIDIA_CUDA", enum_definition: "acceleratorClass" },
      { token: "NOT_EVALUATED", enum_definition: "profileAcceptanceState" },
    ],
    contradiction: {
      value_ref: "w07.model-runtime-profile",
      schema_ref: "urn:japp:schema:platform:model-runtime-profile:v1",
      description: "claims Apple Silicon acceleration on a Windows target",
      mutate: (value) => {
        value.platform_id = "WINDOWS_X64";
      },
    },
  },
  {
    rule_kind: "PLATFORM_NATIVE_REGISTRATION_BINDING",
    schema_refs: ["urn:japp:schema:platform:native-messaging-registration:v1"],
    tokens: [
      ...REQUEST_AUTHORITY_TOKENS,
      { token: "CHROME", enum_definition: "browserFamily" },
      { token: "STABLE", enum_definition: "browserChannel" },
      {
        token: "BINARY_LENGTH_PREFIXED",
        enum_definition: "stdioMode",
      },
      { token: "NATIVE_HOST_REGISTRATION", enum_definition: "pathRole" },
      { token: "REMOVE", enum_definition: "registrationOperation" },
      { token: "VERIFY", enum_definition: "registrationOperation" },
    ],
    contradiction: {
      value_ref: "w07.native-messaging-registration",
      schema_ref: "urn:japp:schema:platform:native-messaging-registration:v1",
      description: "a removal still carries an expected manifest digest",
      mutate: (value) => {
        value.operation = "REMOVE";
      },
    },
  },
  {
    rule_kind: "PLATFORM_NATIVE_REGISTRATION_RESULT",
    schema_refs: ["urn:japp:schema:platform:native-messaging-result:v1"],
    tokens: [
      { token: "CHROME", enum_definition: "browserFamily" },
      ...REGISTRATION_OPERATIONS.map((token) => ({
        token,
        enum_definition: "registrationOperation",
      })),
      ...REGISTRATION_STATES.map((token) => ({
        token,
        enum_definition: "registrationState",
      })),
      { token: "IDENTITY_MISMATCH", enum_definition: "platformReasonCode" },
      { token: "EVALUATION_NOT_RUN", enum_definition: "platformReasonCode" },
    ],
    contradiction: {
      value_ref: "w07.native-messaging-result",
      schema_ref: "urn:japp:schema:platform:native-messaging-result:v1",
      description: "a removal claims success while the manifest is still valid",
      mutate: (value) => {
        value.operation = "REMOVE";
      },
    },
  },
  {
    rule_kind: "PLATFORM_PACKAGE_STATE_EVIDENCE",
    schema_refs: [
      "urn:japp:schema:platform:installer-state:v1",
      "urn:japp:schema:platform:update-state:v1",
    ],
    tokens: [
      ...CERTIFIED_TARGET_TOKENS,
      ...ARCHITECTURE_TOKENS,
      { token: "INSTALLED", enum_definition: "installerState" },
      { token: "UNINSTALLED", enum_definition: "installerState" },
      { token: "NOT_INSTALLED", enum_definition: "installerState" },
      { token: "REPAIRED", enum_definition: "installerState" },
      { token: "NO_UPDATE_AVAILABLE", enum_definition: "updateState" },
      { token: "UPDATE_AVAILABLE", enum_definition: "updateState" },
      { token: "UPDATE_INSTALLED", enum_definition: "updateState" },
      { token: "ROLLED_BACK", enum_definition: "updateState" },
      { token: "SIGNATURE_VALID", enum_definition: "signatureState" },
      { token: "SIGNATURE_INVALID", enum_definition: "signatureState" },
      { token: "SIGNATURE_MISSING", enum_definition: "signatureState" },
      {
        token: "SIGNATURE_NOT_VERIFIED",
        enum_definition: "platformReasonCode",
      },
      { token: "INTERRUPTED", enum_definition: "platformReasonCode" },
      { token: "PRESERVED", enum_definition: "userDataPreservation" },
      {
        token: "EXPLICIT_DELETION_REQUESTED",
        enum_definition: "userDataPreservation",
      },
      {
        token: "PRESERVATION_FAILED",
        enum_definition: "userDataPreservation",
      },
      { token: "REMOVED", enum_definition: "nativeHostCleanupState" },
      { token: "NOT_APPLICABLE", enum_definition: "nativeHostCleanupState" },
    ],
    contradiction: {
      value_ref: "w07.installer-state",
      schema_ref: "urn:japp:schema:platform:installer-state:v1",
      description: "claims an architecture the certified target cannot have",
      mutate: (value) => {
        value.platform_id = "UBUNTU_X64";
        value.architecture = "ARM64";
      },
    },
  },
  {
    rule_kind: "PLATFORM_PATH_REQUEST_SAFETY",
    schema_refs: ["urn:japp:schema:platform:path-request:v1"],
    tokens: [
      ...REQUEST_AUTHORITY_TOKENS,
      { token: "SYSTEM", enum_definition: "installationScope" },
      { token: "NATIVE_HOST_REGISTRATION", enum_definition: "pathRole" },
    ],
    contradiction: {
      value_ref: "w07.path-request",
      schema_ref: "urn:japp:schema:platform:path-request:v1",
      description: "requests a system-scoped path outside host registration",
      mutate: (value) => {
        value.scope = "SYSTEM";
      },
    },
  },
  {
    rule_kind: "PLATFORM_PATH_RESOLUTION_SAFETY",
    schema_refs: ["urn:japp:schema:platform:path-resolution:v1"],
    tokens: [
      { token: "RESOLVED", enum_definition: "pathResolutionState" },
      { token: "SYSTEM", enum_definition: "installationScope" },
      { token: "NATIVE_HOST_REGISTRATION", enum_definition: "pathRole" },
      { token: "APPLICATION_DATA", enum_definition: "pathRole" },
    ],
    contradiction: {
      value_ref: "w07.path-resolution",
      schema_ref: "urn:japp:schema:platform:path-resolution:v1",
      description: "a resolved path escapes its declared role prefix",
      mutate: (value) => {
        value.sanitized_path = "<CACHE>/artifacts/resumes";
      },
    },
  },
  {
    rule_kind: "PLATFORM_PROCESS_PLAN_SAFETY",
    schema_refs: ["urn:japp:schema:platform:process-plan:v1"],
    tokens: [
      ...REQUEST_AUTHORITY_TOKENS,
      ...PROCESS_PROFILES.map((token) => ({
        token,
        enum_definition: "processProfileId",
      })),
      ...STDIO_MODES.map((token) => ({
        token,
        enum_definition: "stdioMode",
      })),
      { token: "ONE_SHOT", enum_definition: "lifecycleMode" },
      { token: "NATIVE_HOST_REGISTRATION", enum_definition: "pathRole" },
    ],
    contradiction: {
      value_ref: "w07.process-plan",
      schema_ref: "urn:japp:schema:platform:process-plan:v1",
      description: "a local orchestrator frames its diagnostic channel",
      mutate: (value) => {
        value.stderr_mode = "BINARY_LENGTH_PREFIXED";
      },
    },
  },
  {
    rule_kind: "PLATFORM_PROCESS_STATUS_INTEGRITY",
    schema_refs: ["urn:japp:schema:platform:process-status:v1"],
    tokens: [
      { token: "STARTING", enum_definition: "processState" },
      { token: "RUNNING", enum_definition: "processState" },
      { token: "TERMINATING", enum_definition: "processState" },
      { token: "TERMINATED", enum_definition: "processState" },
      { token: "EXITED", enum_definition: "processState" },
      { token: "ORPHANED", enum_definition: "processState" },
      { token: "UNAVAILABLE", enum_definition: "processState" },
      { token: "NONE", enum_definition: "terminationRequest" },
    ],
    contradiction: {
      value_ref: "w07.process-status",
      schema_ref: "urn:japp:schema:platform:process-status:v1",
      description: "detects an orphan without reporting the orphaned state",
      mutate: (value) => {
        value.orphan_detected = true;
      },
    },
  },
  {
    rule_kind: "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
    schema_refs: ["urn:japp:schema:platform:runtime-capability:v1"],
    tokens: [
      { token: "AVAILABLE", enum_definition: "capabilityAvailability" },
      { token: "NOT_EVALUATED", enum_definition: "capabilityAvailability" },
      { token: "NOT_EVALUATED", enum_definition: "evaluationMethod" },
      { token: "FULL_AI_AVAILABLE", enum_definition: "coreCapabilityBehavior" },
      {
        token: "CORE_PRESERVED_AI_UNAVAILABLE",
        enum_definition: "coreCapabilityBehavior",
      },
    ],
    contradiction: {
      value_ref: "w07.runtime-capability",
      schema_ref: "urn:japp:schema:platform:runtime-capability:v1",
      description: "claims full AI while no runtime was evaluated",
      mutate: (value) => {
        value.core_capability_behavior = "FULL_AI_AVAILABLE";
      },
    },
  },
  {
    rule_kind: "PLATFORM_SECRET_REQUEST_AUTHORITY",
    schema_refs: ["urn:japp:schema:platform:secret-store-request:v1"],
    tokens: [
      ...REQUEST_AUTHORITY_TOKENS,
      { token: "GET", enum_definition: "secretOperation" },
      { token: "PUT", enum_definition: "secretOperation" },
      { token: "DELETE", enum_definition: "secretOperation" },
      { token: "STATUS", enum_definition: "secretOperation" },
      {
        token: "SECRET",
        enum_definition: "sensitivityClass",
        schema_id: REDACTION,
      },
      {
        token: "FORBID_CAPTURE",
        enum_definition: "redactionPolicy",
        schema_id: REDACTION,
      },
    ],
    contradiction: {
      value_ref: "w07.secret-store-request",
      schema_ref: "urn:japp:schema:platform:secret-store-request:v1",
      description: "a verification profile requests a non-STATUS operation",
      mutate: (value) => {
        const context = value.request_context as Record<string, unknown>;
        context.authorization_profile = "VERIFICATION";
      },
    },
  },
  {
    rule_kind: "PLATFORM_SECRET_RESULT_INTEGRITY",
    schema_refs: ["urn:japp:schema:platform:secret-store-result:v1"],
    tokens: [
      { token: "GET", enum_definition: "secretOperation" },
      { token: "PUT", enum_definition: "secretOperation" },
      { token: "DELETE", enum_definition: "secretOperation" },
      { token: "STATUS", enum_definition: "secretOperation" },
      { token: "STORE_AVAILABLE", enum_definition: "secretResultState" },
      { token: "STORE_UNAVAILABLE", enum_definition: "secretResultState" },
      { token: "DENIED_PERMISSION", enum_definition: "secretResultState" },
      { token: "RETRIEVED", enum_definition: "secretResultState" },
      { token: "STORED", enum_definition: "secretResultState" },
      { token: "DELETED", enum_definition: "secretResultState" },
      { token: "PERMISSION_DENIED", enum_definition: "platformReasonCode" },
      { token: "AVAILABLE", enum_definition: "capabilityAvailability" },
      { token: "DEGRADED_LIMITED", enum_definition: "capabilityAvailability" },
      {
        token: "PERMISSION_REQUIRED",
        enum_definition: "capabilityAvailability",
      },
    ],
    contradiction: {
      value_ref: "w07.secret-store-result",
      schema_ref: "urn:japp:schema:platform:secret-store-result:v1",
      description: "a retrieval reports the STATUS-only availability state",
      mutate: (value) => {
        value.result_state = "STORE_AVAILABLE";
      },
    },
  },
  {
    rule_kind: "PLATFORM_TARGET_SUPPORT_CLAIM",
    schema_refs: ["urn:japp:schema:platform:target-identity:v1"],
    tokens: [
      ...SUPPORT_CLAIM_TOKENS,
      ...ARCHITECTURE_TOKENS,
      ...CERTIFIED_TARGET_TOKENS,
      { token: "MEASURED_NATIVE_RUN", enum_definition: "evaluationMethod" },
    ],
    contradiction: {
      value_ref: "w07.target-identity",
      schema_ref: "urn:japp:schema:platform:target-identity:v1",
      description: "claims an architecture the certified target cannot have",
      mutate: (value) => {
        value.architecture = "X86_64";
      },
    },
  },
];

describe("M01-W07 platform semantic-rule registry (KI-0024)", () => {
  test("the registry names every platform rule kind and no others", () => {
    const catalogKinds = [
      ...new Set(
        SEMANTIC_RULES_V1.map((rule) => rule.rule_kind).filter((kind) =>
          kind.startsWith("PLATFORM_"),
        ),
      ),
    ].toSorted();
    const registryKinds = PLATFORM_RULE_REGISTRY.map(
      (entry) => entry.rule_kind,
    ).toSorted();
    expect(registryKinds).toEqual(catalogKinds);
    expect(registryKinds).toHaveLength(18);
  });

  test("every registry entry names the exact roots its rule kind binds", () => {
    for (const entry of PLATFORM_RULE_REGISTRY) {
      const bound = SEMANTIC_RULES_V1.filter(
        (rule) => rule.rule_kind === entry.rule_kind,
      )
        .map((rule) => rule.schema_ref)
        .toSorted();
      expect(entry.schema_refs.toSorted(), entry.rule_kind).toEqual(bound);
    }
  });

  test("every platform root is covered by exactly one registry entry", () => {
    const platformRoots = catalog.entries
      .filter(
        (candidate) =>
          candidate.id.startsWith("urn:japp:schema:platform:") &&
          candidate.id !== VOCABULARY,
      )
      .map((candidate) => candidate.id)
      .toSorted();
    const registered = PLATFORM_RULE_REGISTRY.flatMap(
      (entry) => entry.schema_refs,
    ).toSorted();
    expect(registered).toEqual(platformRoots);
    expect(new Set(registered).size).toBe(registered.length);
  });

  test.each(PLATFORM_RULE_REGISTRY)(
    "$rule_kind only names structurally representable tokens",
    (entry) => {
      expect(entry.tokens.length).toBeGreaterThan(0);
      for (const token of entry.tokens) {
        expect(
          enumTokens(token.enum_definition, token.schema_id ?? VOCABULARY),
          `${entry.rule_kind} token ${token.token} missing from ${token.enum_definition}`,
        ).toContain(token.token);
      }
    },
  );

  test.each(PLATFORM_RULE_REGISTRY)(
    "$rule_kind accepts its committed representative on every bound root",
    (entry) => {
      for (const schemaRef of entry.schema_refs) {
        const rootName = schemaRef.split(":").at(-2) ?? "";
        const valueRef = `w07.${rootName}`;
        expect(verdicts(schemaRef, fixture(valueRef)), schemaRef).toEqual({
          structural: true,
          semantic: true,
        });
      }
    },
  );

  test.each(PLATFORM_RULE_REGISTRY)(
    "$rule_kind rejects a structurally valid contradiction",
    (entry) => {
      const value = fixture(entry.contradiction.value_ref);
      entry.contradiction.mutate(value);
      expect(
        verdicts(entry.contradiction.schema_ref, value),
        `${entry.rule_kind}: ${entry.contradiction.description}`,
      ).toEqual({ structural: true, semantic: false });
    },
  );
});
