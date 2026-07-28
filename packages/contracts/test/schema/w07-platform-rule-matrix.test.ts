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
 *
 * `PRESENT_VALID` is deliberately empty here because a healthy registration
 * has nothing wrong with it. That is a fact about the *state*, not about the
 * *operation*: when an operation fails and leaves a healthy registration
 * behind, the failure is explained by an operation-level reason instead
 * (`OPERATION_FAILURE_REASON` below).
 */
const STATE_REASONS: Readonly<Record<RegistrationState, readonly string[]>> = {
  ABSENT: ["NOT_INSTALLED"],
  CORRUPT: ["CONFIGURATION_INVALID"],
  MISMATCHED_IDENTITY: ["IDENTITY_MISMATCH"],
  NOT_EVALUATED: ["EVALUATION_NOT_RUN"],
  PRESENT_STALE: ["INCOMPATIBLE_RUNTIME_VERSION"],
  PRESENT_VALID: [],
};

/**
 * Why an operation can fail while leaving a state that is healthy in itself.
 * A `REMOVE` refused by the operating system — an unelevated `HKLM` registry
 * key on Windows, a system-scope manifest on macOS or Linux — is the ordinary
 * instance: the removal did not happen, so the registration it was asked to
 * delete is still present and valid.
 */
const OPERATION_FAILURE_REASON = "PERMISSION_DENIED";

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
  // `observed_state` is the registration state observed *after* the operation
  // ran, never a claim that the operation succeeded. A non-terminal
  // observation is therefore a failure, and it must be explained: by the
  // reason its own state implies where one exists, and otherwise by an
  // operation-level reason.
  const stateReasons = STATE_REASONS[observedState];
  const reasonCodes = succeeds
    ? []
    : stateReasons.length > 0
      ? stateReasons
      : [OPERATION_FAILURE_REASON];
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
    reason_codes: reasonCodes,
    identity: STATES_WITH_IDENTITY.includes(observedState),
  };
}

/**
 * Every operation/state cell is reachable. `observed_state` is an observation
 * of the registration, not an outcome of the operation, so any of the five
 * operations may end up observing any of the six states — including `REMOVE`
 * observing `PRESENT_VALID`, which is exactly what a removal refused by the
 * operating system leaves behind. KI-0025 (F6) records that the previous
 * matrix rejected that cell only because its representative model keyed
 * reasons by observed state alone and therefore never offered an
 * operation-level failure reason. The false-success direction stays refused by
 * the contradiction table below, not by removing a cell.
 */
const REJECTED_REGISTRATION_CELLS = new Set<string>();

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
      // An identity verdict must carry the identity evidence it is about.
      id: "a mismatched identity omits the observed manifest digest",
      cell: {
        operation: "VERIFY",
        observed_state: "MISMATCHED_IDENTITY",
        changed: false,
        idempotent_repeat_safe: false,
        reason_codes: ["IDENTITY_MISMATCH"],
        identity: false,
      },
    },
    {
      id: "a stale registration omits the observed host version",
      cell: {
        operation: "UPDATE",
        observed_state: "PRESENT_STALE",
        changed: false,
        idempotent_repeat_safe: false,
        reason_codes: ["INCOMPATIBLE_RUNTIME_VERSION"],
        identity: false,
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

  /**
   * KI-0025 (F6). The boundary is between *explaining a failure* and
   * *claiming a success*, not between healthy and unhealthy states.
   */
  test("a refused removal reports the registration it failed to remove", () => {
    const refused = buildRegistrationResult({
      operation: "REMOVE",
      observed_state: "PRESENT_VALID",
      changed: false,
      idempotent_repeat_safe: false,
      reason_codes: [OPERATION_FAILURE_REASON],
      identity: true,
    });
    expect(verdicts(NATIVE_RESULT, refused)).toEqual({
      structural: true,
      semantic: true,
    });

    // The same observation with the failure removed becomes a false success
    // claim — a removal that reports the registration is still there — and
    // stays refused.
    const claimed = structuredClone(refused);
    claimed.reason_codes = [];
    claimed.idempotent_repeat_safe = true;
    expect(verdicts(NATIVE_RESULT, claimed)).toEqual({
      structural: true,
      semantic: false,
    });
  });

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

/**
 * Specification §5.14.8 binds each certified target to its package formats:
 * a signed macOS bundle/DMG, a signed Windows installer, and a `.deb` with
 * AppImage as the additional Ubuntu convenience artifact. A representative
 * that moves a packaging record to another target must move its format too,
 * otherwise it is not a coherent positive.
 */
const PACKAGE_FORMAT_BY_CERTIFIED_TARGET = {
  MACOS_ARM64: "APPLE_DISK_IMAGE",
  UBUNTU_X64: "DEBIAN_PACKAGE",
  WINDOWS_X64: "WINDOWS_INSTALLER",
} as const;

type CertifiedTarget = keyof typeof ARCHITECTURE_BY_CERTIFIED_TARGET;

/** Retarget one record coherently across every reviewed target binding. */
function retarget(
  value: Record<string, unknown>,
  platformId: CertifiedTarget,
  architecture: string,
): Record<string, unknown> {
  value.platform_id = platformId;
  value.architecture = architecture;
  if ("package_format" in value) {
    value.package_format = PACKAGE_FORMAT_BY_CERTIFIED_TARGET[platformId];
  }
  return value;
}

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
      const value = retarget(
        fixture(valueRef),
        platformId as CertifiedTarget,
        architecture,
      );
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
      const value = retarget(
        fixture(valueRef),
        platformId as CertifiedTarget,
        architecture,
      );
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

// ---------------------------------------------------------------------------
// 5. KI-0025 exhaustive platform state matrices
//
// Every expectation below is declared from the canonical specification and the
// committed vocabulary before it is asserted. Nothing here runs the evaluator
// to discover what it should expect.
// ---------------------------------------------------------------------------

const INSTALLER_STATE = "urn:japp:schema:platform:installer-state:v1";
const UPDATE_STATE = "urn:japp:schema:platform:update-state:v1";
const EVIDENCE_RECORD = "urn:japp:schema:platform:evidence-record:v1";
const RUNTIME_CAPABILITY = "urn:japp:schema:platform:runtime-capability:v1";
const PATH_RESOLUTION = "urn:japp:schema:platform:path-resolution:v1";
const PROCESS_STATUS = "urn:japp:schema:platform:process-status:v1";

const EVIDENCE_REF = "evid_0123456789ABCDEFGHJKMNPQRS";
const MODEL_PROFILE_REF = "modelprof_0123456789ABCDEFGHJKMNPQRS";
const SYNTHETIC_DIGEST =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222";
const SYNTHETIC_ARTIFACT = {
  artifact_token: "desktop-shell-artifact",
  artifact_digest: SYNTHETIC_DIGEST,
};

// ---------------------------------------------------------------------------
// 5a. Package interruption and recovery (KI-0025 F1)
//
// Specification §5.14.8 requires every certified target to pass install, first
// launch, upgrade, rollback, interrupted update, repair, uninstall,
// native-host cleanup, and user-data preservation. A recovered interruption is
// therefore an outcome the contract must be able to report as the success it
// is. `interrupted` is historical ("this operation was interrupted");
// `recovery_completed` says the interruption was resolved; and the *unresolved*
// outcome is carried by the INSTALL_INTERRUPTED / UPDATE_INTERRUPTED states.
// ---------------------------------------------------------------------------

const INSTALLER_STATES = [
  "INSTALLED",
  "INSTALL_FAILED",
  "INSTALL_INTERRUPTED",
  "NOT_INSTALLED",
  "REPAIRED",
  "REPAIR_FAILED",
  "UNINSTALLED",
  "UNINSTALL_FAILED",
] as const;

const UPDATE_STATES = [
  "NO_UPDATE_AVAILABLE",
  "ROLLBACK_FAILED",
  "ROLLED_BACK",
  "UPDATE_AVAILABLE",
  "UPDATE_FAILED",
  "UPDATE_INSTALLED",
  "UPDATE_INTERRUPTED",
] as const;

/** States that report a completed operation and therefore claim success. */
const PACKAGE_SUCCESS_STATES = [
  "INSTALLED",
  "REPAIRED",
  "ROLLED_BACK",
  "UNINSTALLED",
  "UPDATE_INSTALLED",
] as const;

/** States whose whole meaning is "the interruption is still unresolved". */
const PACKAGE_INTERRUPTED_STATES = [
  "INSTALL_INTERRUPTED",
  "UPDATE_INTERRUPTED",
] as const;

/** States that report a failed operation and therefore need an explanation. */
const PACKAGE_FAILURE_STATES = [
  "INSTALL_FAILED",
  "INSTALL_INTERRUPTED",
  "REPAIR_FAILED",
  "ROLLBACK_FAILED",
  "UNINSTALL_FAILED",
  "UPDATE_FAILED",
  "UPDATE_INTERRUPTED",
] as const;

type InterruptionShape = "CLEAN" | "UNRECOVERED" | "RECOVERED";

const INTERRUPTION_SHAPES: readonly InterruptionShape[] = [
  "CLEAN",
  "UNRECOVERED",
  "RECOVERED",
];

/**
 * The reviewed expectation, stated from the semantics above:
 *  - a success state cannot carry an interruption that was never resolved;
 *  - a terminal interrupted state cannot claim it was never interrupted;
 *  - every other observation is independent of the interruption history.
 */
function packageStateAdmitted(
  state: string,
  shape: InterruptionShape,
): boolean {
  if ((PACKAGE_SUCCESS_STATES as readonly string[]).includes(state)) {
    return shape !== "UNRECOVERED";
  }
  if ((PACKAGE_INTERRUPTED_STATES as readonly string[]).includes(state)) {
    return shape !== "CLEAN";
  }
  return true;
}

function buildPackageState(
  root: "installer" | "update",
  state: string,
  shape: InterruptionShape,
): Record<string, unknown> {
  const value = fixture(
    root === "installer" ? "w07.installer-state" : "w07.update-state",
  );
  value.state = state;
  value.signature_state = "SIGNATURE_VALID";
  value.user_data_preservation = "PRESERVED";
  value.native_host_cleanup =
    state === "UNINSTALLED" ? "REMOVED" : "NOT_APPLICABLE";
  value.evidence_refs = [EVIDENCE_REF];

  const reasons: string[] = [];
  if (shape === "CLEAN") {
    value.interrupted = false;
    delete value.recovery_completed;
  } else {
    value.interrupted = true;
    value.recovery_completed = shape === "RECOVERED";
    reasons.push("INTERRUPTED");
  }
  // A failure state always needs an explanation of its own; the interruption
  // reason alone explains only the two interrupted states.
  if (
    (PACKAGE_FAILURE_STATES as readonly string[]).includes(state) &&
    !(PACKAGE_INTERRUPTED_STATES as readonly string[]).includes(state) &&
    reasons.length === 0
  ) {
    reasons.push("ADAPTER_ERROR");
  }
  value.reason_codes = reasons;

  // Per-state members the reviewed rule requires independently.
  if (state === "INSTALLED" || state === "REPAIRED") {
    value.installed_version = value.package_version;
  }
  if (state === "NOT_INSTALLED" || state === "UNINSTALLED") {
    delete value.installed_version;
  }
  if (state === "UPDATE_AVAILABLE") {
    value.available_version = "1.1.0";
  }
  if (state === "NO_UPDATE_AVAILABLE") {
    delete value.available_version;
  }
  if (state === "UPDATE_INSTALLED") {
    value.installed_version = "1.1.0";
    value.available_version = "1.1.0";
    value.target_artifact = structuredClone(SYNTHETIC_ARTIFACT);
  }
  if (state === "ROLLED_BACK") {
    value.rolled_back_to_version = "0.0.9";
    value.rollback_available = true;
  }
  return value;
}

describe("M01-W07 package interruption and recovery matrix (KI-0025 F1)", () => {
  test("the matrix covers every installer and update state", () => {
    expect(enumTokens("installerState")).toEqual([...INSTALLER_STATES]);
    expect(enumTokens("updateState")).toEqual([...UPDATE_STATES]);
  });

  const cells = [
    ...INSTALLER_STATES.map((state) => ["installer", state] as const),
    ...UPDATE_STATES.map((state) => ["update", state] as const),
  ].flatMap(([root, state]) =>
    INTERRUPTION_SHAPES.map((shape) => [root, state, shape] as const),
  );

  test("the matrix visits every state and interruption shape", () => {
    expect(cells).toHaveLength(
      (INSTALLER_STATES.length + UPDATE_STATES.length) *
        INTERRUPTION_SHAPES.length,
    );
  });

  test.each(cells)("%s %s is %s-representable", (root, state, shape) => {
    const schemaRef = root === "installer" ? INSTALLER_STATE : UPDATE_STATE;
    expect(verdicts(schemaRef, buildPackageState(root, state, shape))).toEqual({
      structural: true,
      semantic: packageStateAdmitted(state, shape),
    });
  });

  test("a recovered interruption is a success and an unrecovered one is not", () => {
    const recovered = buildPackageState(
      "update",
      "UPDATE_INSTALLED",
      "RECOVERED",
    );
    expect(verdicts(UPDATE_STATE, recovered)).toEqual({
      structural: true,
      semantic: true,
    });
    expect(recovered.reason_codes).toEqual(["INTERRUPTED"]);

    const unrecovered = structuredClone(recovered);
    unrecovered.recovery_completed = false;
    expect(verdicts(UPDATE_STATE, unrecovered)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  const PACKAGE_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly root: "installer" | "update";
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      id: "recovery is claimed without an interruption",
      root: "installer",
      mutate: (value) => {
        value.interrupted = false;
        value.recovery_completed = true;
        value.reason_codes = [];
      },
    },
    {
      id: "recovery is denied without an interruption",
      root: "installer",
      mutate: (value) => {
        value.interrupted = false;
        value.recovery_completed = false;
        value.reason_codes = [];
      },
    },
    {
      id: "the interruption reason appears without an interruption",
      root: "installer",
      mutate: (value) => {
        value.interrupted = false;
        value.reason_codes = ["INTERRUPTED"];
      },
    },
    {
      id: "an interruption carries no interruption reason",
      root: "installer",
      mutate: (value) => {
        value.interrupted = true;
        value.reason_codes = ["ADAPTER_ERROR"];
      },
    },
    {
      id: "a success carries an unrelated reason alongside the interruption",
      root: "installer",
      mutate: (value) => {
        value.reason_codes = ["INTERRUPTED", "ADAPTER_ERROR"];
      },
    },
    {
      id: "a macOS package reports a Debian format",
      root: "installer",
      mutate: (value) => {
        value.package_format = "DEBIAN_PACKAGE";
      },
    },
    {
      id: "an installed update differs from the update that was offered",
      root: "update",
      mutate: (value) => {
        value.available_version = "1.2.0";
      },
    },
  ];

  test.each(PACKAGE_CONTRADICTIONS)("rejects a record where $id", (entry) => {
    const state = entry.root === "installer" ? "INSTALLED" : "UPDATE_INSTALLED";
    const value = buildPackageState(entry.root, state, "RECOVERED");
    entry.mutate(value);
    expect(
      verdicts(
        entry.root === "installer" ? INSTALLER_STATE : UPDATE_STATE,
        value,
      ),
    ).toEqual({ structural: true, semantic: false });
  });
});

// ---------------------------------------------------------------------------
// 5b. Evidence machine class x evaluation method (KI-0025 F2)
//
// `machine_class` records *where* an artifact was produced; `evaluation_method`
// records *how*. The vocabulary describes them as independent, and this
// repository's own three-OS evidence is the exact shape the fused rule refused:
// synthetic fixtures executed on a hosted CI runner.
// ---------------------------------------------------------------------------

const MACHINE_CLASSES = [
  "HOSTED_CI_RUNNER",
  "PHYSICAL_DEVELOPMENT_MACHINE",
  "SYNTHETIC_FIXTURE",
] as const;

const EVALUATION_METHODS = [
  "DECLARED_PLAN",
  "MEASURED_NATIVE_RUN",
  "NOT_EVALUATED",
  "STATIC_INSPECTION",
  "SYNTHETIC_FIXTURE",
] as const;

function buildEvidenceRecord(
  machineClass: string,
  method: string,
): Record<string, unknown> {
  const value = fixture("w07.evidence-record");
  value.machine_class = machineClass;
  value.evaluation_method = method;
  if (machineClass === "HOSTED_CI_RUNNER") {
    value.runner_image_token = "macos-15";
  } else {
    delete value.runner_image_token;
  }
  if (method === "MEASURED_NATIVE_RUN") {
    value.platform_id = "MACOS_ARM64";
    value.architecture = "ARM64";
    value.os_version = "15.2";
    value.os_build = "24C101";
  } else {
    delete value.os_build;
  }
  // NOT_EVALUATED and DECLARED_PLAN are never measured evidence, so they never
  // report a passing result.
  if (method === "NOT_EVALUATED") {
    value.result = "BLOCKED";
    value.reason_codes = ["EVALUATION_NOT_RUN"];
  } else if (method === "DECLARED_PLAN") {
    value.result = "BLOCKED";
    value.reason_codes = ["EVALUATION_NOT_RUN"];
  } else {
    value.result = "SUCCESS";
    value.reason_codes = [];
  }
  return value;
}

describe("M01-W07 evidence machine/method matrix (KI-0025 F2)", () => {
  test("the matrix covers every machine class and evaluation method", () => {
    expect(enumTokens("machineClass")).toEqual([...MACHINE_CLASSES]);
    expect(enumTokens("evaluationMethod")).toEqual([...EVALUATION_METHODS]);
  });

  const cells = MACHINE_CLASSES.flatMap((machineClass) =>
    EVALUATION_METHODS.map((method) => [machineClass, method] as const),
  );

  test.each(cells)("%s executing %s", (machineClass, method) => {
    // The only refused combination: a synthetic machine cannot execute a run
    // on the actual operating-system family and architecture.
    const admitted = !(
      machineClass === "SYNTHETIC_FIXTURE" && method === "MEASURED_NATIVE_RUN"
    );
    expect(
      verdicts(EVIDENCE_RECORD, buildEvidenceRecord(machineClass, method)),
    ).toEqual({ structural: true, semantic: admitted });
  });

  const EVIDENCE_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly machine_class: string;
    readonly method: string;
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      id: "a hosted measured run does not name its runner image",
      machine_class: "HOSTED_CI_RUNNER",
      method: "MEASURED_NATIVE_RUN",
      mutate: (value) => {
        delete value.runner_image_token;
      },
    },
    {
      id: "a runner image is attached to a physical machine",
      machine_class: "PHYSICAL_DEVELOPMENT_MACHINE",
      method: "STATIC_INSPECTION",
      mutate: (value) => {
        value.runner_image_token = "macos-15";
      },
    },
    {
      id: "a declared plan reports a passing result",
      machine_class: "SYNTHETIC_FIXTURE",
      method: "DECLARED_PLAN",
      mutate: (value) => {
        value.result = "SUCCESS";
        value.reason_codes = [];
      },
    },
    {
      id: "an unevaluated record reports an operating-system build",
      machine_class: "SYNTHETIC_FIXTURE",
      method: "NOT_EVALUATED",
      mutate: (value) => {
        value.os_build = "24C101";
      },
    },
    {
      id: "an unevaluated record omits the evaluation-not-run reason",
      machine_class: "SYNTHETIC_FIXTURE",
      method: "NOT_EVALUATED",
      mutate: (value) => {
        value.reason_codes = ["ADAPTER_ERROR"];
      },
    },
    {
      id: "a passing record carries an unverified package signature",
      machine_class: "SYNTHETIC_FIXTURE",
      method: "SYNTHETIC_FIXTURE",
      mutate: (value) => {
        value.package_artifact = structuredClone(SYNTHETIC_ARTIFACT);
        value.signature_state = "SIGNATURE_INVALID";
      },
    },
    {
      id: "a measured run reports an uncertified target",
      machine_class: "PHYSICAL_DEVELOPMENT_MACHINE",
      method: "MEASURED_NATIVE_RUN",
      mutate: (value) => {
        value.platform_id = "UNKNOWN_TARGET";
        value.architecture = "UNKNOWN_ARCHITECTURE";
      },
    },
  ];

  test.each(EVIDENCE_CONTRADICTIONS)("rejects a record where $id", (entry) => {
    const value = buildEvidenceRecord(entry.machine_class, entry.method);
    entry.mutate(value);
    expect(verdicts(EVIDENCE_RECORD, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 5c. Runtime availability (KI-0025 F3)
//
// The vocabulary states that AVAILABLE and DEGRADED_LIMITED are the only
// non-blocking availability states, and specification §5.14.1 describes
// CERTIFIED_CORE as "AI unavailable or below performance tier". A runtime that
// is present but below the tier therefore still reports what it is and what it
// offers; it simply accepts nothing and never claims full AI.
// ---------------------------------------------------------------------------

const RUNTIME_AVAILABILITY_STATES = [
  "AVAILABLE",
  "DEGRADED_LIMITED",
  "INCOMPATIBLE_VERSION",
  "NOT_EVALUATED",
  "NOT_INSTALLED",
  "PERMISSION_REQUIRED",
  "UNAVAILABLE",
  "UNKNOWN",
  "UNSUPPORTED_TARGET",
] as const;

/** The two states in which a runtime was actually detected. */
const OPERABLE_AVAILABILITY: readonly string[] = [
  "AVAILABLE",
  "DEGRADED_LIMITED",
];

/** The states that observed nothing at all and so report no identity. */
const UNOBSERVED_AVAILABILITY: readonly string[] = [
  "NOT_EVALUATED",
  "UNSUPPORTED_TARGET",
];

function buildRuntimeCapability(
  availability: string,
  withProfiles: boolean,
): Record<string, unknown> {
  const value = fixture("w07.runtime-capability");
  value.platform_id = "MACOS_ARM64";
  value.runtime_availability = availability;
  value.detection_method =
    availability === "NOT_EVALUATED" ? "NOT_EVALUATED" : "MEASURED_NATIVE_RUN";
  value.available_profile_refs = withProfiles ? [MODEL_PROFILE_REF] : [];
  value.accepted_profile_refs = [];
  value.core_capability_behavior = OPERABLE_AVAILABILITY.includes(availability)
    ? "CORE_PRESERVED_AI_DEGRADED"
    : "CORE_PRESERVED_AI_UNAVAILABLE";
  value.reason_codes =
    availability === "NOT_EVALUATED"
      ? ["EVALUATION_NOT_RUN"]
      : ["INSUFFICIENT_HARDWARE"];
  if (UNOBSERVED_AVAILABILITY.includes(availability)) {
    delete value.runtime_family;
    delete value.runtime_version;
    delete value.accelerator;
  } else {
    value.runtime_family = "OLLAMA_MLX";
    value.runtime_version = "0.5.0";
    value.accelerator = "APPLE_SILICON_GPU";
  }
  return value;
}

describe("M01-W07 runtime availability matrix (KI-0025 F3)", () => {
  test("the matrix covers every capability availability state", () => {
    expect(enumTokens("capabilityAvailability")).toEqual([
      ...RUNTIME_AVAILABILITY_STATES,
    ]);
  });

  const cells = RUNTIME_AVAILABILITY_STATES.flatMap((availability) =>
    [true, false].map((withProfiles) => [availability, withProfiles] as const),
  );

  test.each(cells)(
    "%s with available profiles = %s",
    (availability, withProfiles) => {
      // Only a runtime that was actually detected may enumerate usable
      // profiles; every other state has nothing to offer.
      const admitted =
        !withProfiles || OPERABLE_AVAILABILITY.includes(availability);
      expect(
        verdicts(
          RUNTIME_CAPABILITY,
          buildRuntimeCapability(availability, withProfiles),
        ),
      ).toEqual({ structural: true, semantic: admitted });
    },
  );

  test("a degraded runtime reports its identity and its profiles", () => {
    const degraded = buildRuntimeCapability("DEGRADED_LIMITED", true);
    expect(verdicts(RUNTIME_CAPABILITY, degraded)).toEqual({
      structural: true,
      semantic: true,
    });
    expect(degraded.core_capability_behavior).toBe(
      "CORE_PRESERVED_AI_DEGRADED",
    );
    expect(degraded.accepted_profile_refs).toEqual([]);
  });

  test("full AI is exactly an accepted profile on an available certified runtime", () => {
    const full = buildRuntimeCapability("AVAILABLE", true);
    full.accepted_profile_refs = [MODEL_PROFILE_REF];
    full.core_capability_behavior = "FULL_AI_AVAILABLE";
    full.reason_codes = [];
    expect(verdicts(RUNTIME_CAPABILITY, full)).toEqual({
      structural: true,
      semantic: true,
    });
  });

  const RUNTIME_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly availability: string;
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      id: "full AI carries a blocking reason",
      availability: "AVAILABLE",
      mutate: (value) => {
        value.accepted_profile_refs = [MODEL_PROFILE_REF];
        value.core_capability_behavior = "FULL_AI_AVAILABLE";
        value.reason_codes = ["SERVICE_UNAVAILABLE"];
      },
    },
    {
      id: "full AI is claimed on a degraded runtime",
      availability: "DEGRADED_LIMITED",
      mutate: (value) => {
        value.accepted_profile_refs = [MODEL_PROFILE_REF];
        value.core_capability_behavior = "FULL_AI_AVAILABLE";
        value.reason_codes = [];
      },
    },
    {
      id: "full AI is claimed on an uncertified target",
      availability: "AVAILABLE",
      mutate: (value) => {
        value.platform_id = "UNKNOWN_TARGET";
        value.runtime_family = "OLLAMA_GGUF";
        value.accelerator = "CPU_ONLY";
        value.accepted_profile_refs = [MODEL_PROFILE_REF];
        value.core_capability_behavior = "FULL_AI_AVAILABLE";
        value.reason_codes = [];
      },
    },
    {
      id: "a measured detection reports an unevaluated runtime",
      availability: "NOT_EVALUATED",
      mutate: (value) => {
        value.detection_method = "MEASURED_NATIVE_RUN";
      },
    },
    {
      id: "an unevaluated runtime reports a detected identity",
      availability: "NOT_EVALUATED",
      mutate: (value) => {
        value.runtime_family = "OLLAMA_MLX";
        value.runtime_version = "0.5.0";
        value.accelerator = "APPLE_SILICON_GPU";
      },
    },
    {
      id: "a Windows target reports an Apple Silicon runtime",
      availability: "AVAILABLE",
      mutate: (value) => {
        value.platform_id = "WINDOWS_X64";
      },
    },
    {
      id: "an accepted profile is not an available profile",
      availability: "AVAILABLE",
      mutate: (value) => {
        value.available_profile_refs = [];
        value.accepted_profile_refs = [MODEL_PROFILE_REF];
        value.core_capability_behavior = "FULL_AI_AVAILABLE";
        value.reason_codes = [];
      },
    },
  ];

  test.each(RUNTIME_CONTRADICTIONS)("rejects a record where $id", (entry) => {
    const value = buildRuntimeCapability(entry.availability, true);
    entry.mutate(value);
    expect(verdicts(RUNTIME_CAPABILITY, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 5d. Path resolution states (KI-0025 F4)
//
// The privacy guarantee is that a location is disclosed only by a resolution
// that succeeded. That is independent of whether the location exists: a
// permission error is itself an observation that something is there, and the
// contract must be able to record it without revealing where.
// ---------------------------------------------------------------------------

const PATH_RESOLUTION_STATES = [
  "DENIED_PERMISSION",
  "NOT_EVALUATED",
  "RESOLVED",
  "UNAVAILABLE",
] as const;

const PATH_STATE_REASONS: Readonly<Record<string, readonly string[]>> = {
  DENIED_PERMISSION: ["PERMISSION_DENIED"],
  NOT_EVALUATED: ["EVALUATION_NOT_RUN"],
  RESOLVED: [],
  UNAVAILABLE: ["SERVICE_UNAVAILABLE"],
};

function buildPathResolution(
  state: string,
  exists: boolean,
): Record<string, unknown> {
  const value = fixture("w07.path-resolution");
  value.resolution_state = state;
  value.exists = exists;
  value.reason_codes = [...(PATH_STATE_REASONS[state] ?? [])];
  if (state === "RESOLVED") {
    value.writable = exists;
  } else {
    delete value.sanitized_path;
    delete value.path_digest;
    value.writable = false;
  }
  return value;
}

describe("M01-W07 path resolution matrix (KI-0025 F4)", () => {
  test("the matrix covers every resolution state", () => {
    expect(enumTokens("pathResolutionState")).toEqual([
      ...PATH_RESOLUTION_STATES,
    ]);
  });

  const cells = PATH_RESOLUTION_STATES.flatMap((state) =>
    [true, false].map((exists) => [state, exists] as const),
  );

  test.each(cells)("%s reporting exists = %s", (state, exists) => {
    // A resolved location exists. A refused resolution may report either, since
    // a permission error proves the location is there while ENOENT does not.
    // A state that evaluated nothing, or reached nothing, observed nothing.
    const admitted =
      state === "RESOLVED" || state === "DENIED_PERMISSION" ? true : !exists;
    expect(
      verdicts(PATH_RESOLUTION, buildPathResolution(state, exists)),
    ).toEqual({ structural: true, semantic: admitted });
  });

  test("a refusal reports an existing location without disclosing it", () => {
    const denied = buildPathResolution("DENIED_PERMISSION", true);
    expect(verdicts(PATH_RESOLUTION, denied)).toEqual({
      structural: true,
      semantic: true,
    });
    expect(denied.sanitized_path).toBeUndefined();
    expect(denied.path_digest).toBeUndefined();
    expect(denied.writable).toBe(false);
  });

  const PATH_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly state: string;
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      id: "a refusal reports the location it refused",
      state: "DENIED_PERMISSION",
      mutate: (value) => {
        value.sanitized_path = "<APPLICATION_DATA>/artifacts";
        value.path_digest = SYNTHETIC_DIGEST;
      },
    },
    {
      id: "a refusal reports a writable location",
      state: "DENIED_PERMISSION",
      mutate: (value) => {
        value.writable = true;
      },
    },
    {
      id: "a refusal omits the permission-denied reason",
      state: "DENIED_PERMISSION",
      mutate: (value) => {
        value.reason_codes = ["SERVICE_UNAVAILABLE"];
      },
    },
    {
      id: "an unevaluated resolution omits the evaluation-not-run reason",
      state: "NOT_EVALUATED",
      mutate: (value) => {
        value.reason_codes = ["ADAPTER_ERROR"];
      },
    },
    {
      id: "an unreachable resolution carries no reason at all",
      state: "UNAVAILABLE",
      mutate: (value) => {
        value.reason_codes = [];
      },
    },
  ];

  test.each(PATH_CONTRADICTIONS)("rejects a resolution where $id", (entry) => {
    const value = buildPathResolution(entry.state, false);
    entry.mutate(value);
    expect(verdicts(PATH_RESOLUTION, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 5e. Process lifecycle states (KI-0025 F5)
//
// Specification §5.14.4 requires signal/termination semantics, parent death,
// and orphan detection to be covered on every certified platform. An exit
// status is only useful if the record can also say why: a clean exit explains
// itself, and any other exit must carry a finite reason. `orphan_detected` is
// historical, exactly like the package `interrupted` flag, so the terminal
// record of an orphan that was cleaned up remains representable.
// ---------------------------------------------------------------------------

const PROCESS_STATES = [
  "EXITED",
  "FAILED",
  "ORPHANED",
  "RUNNING",
  "STARTING",
  "TERMINATED",
  "TERMINATING",
  "UNAVAILABLE",
] as const;

const STARTED_AT = "2026-07-28T04:00:00Z";
const ENDED_AT = "2026-07-28T04:10:00Z";

/** The reviewed representative for each lifecycle state. */
function buildProcessStatus(state: string): Record<string, unknown> {
  const value = fixture("w07.process-status");
  value.state = state;
  value.started_at = STARTED_AT;
  value.termination_requested = "NONE";
  value.orphan_detected = false;
  value.reason_codes = [];
  delete value.ended_at;
  delete value.exit_code;
  switch (state) {
    case "STARTING":
    case "RUNNING":
      break;
    case "TERMINATING":
      value.termination_requested = "GRACEFUL_STOP";
      break;
    case "EXITED":
      value.ended_at = ENDED_AT;
      value.exit_code = 0;
      break;
    case "TERMINATED":
      value.termination_requested = "GRACEFUL_STOP";
      value.ended_at = ENDED_AT;
      break;
    case "ORPHANED":
      value.orphan_detected = true;
      value.reason_codes = ["ADAPTER_ERROR"];
      break;
    case "UNAVAILABLE":
      delete value.started_at;
      value.reason_codes = ["ADAPTER_ERROR"];
      break;
    default:
      // FAILED: supervision itself failed, so there is no observed exit status.
      value.reason_codes = ["ADAPTER_ERROR"];
      break;
  }
  return value;
}

describe("M01-W07 process lifecycle matrix (KI-0025 F5)", () => {
  test("the matrix covers every process state", () => {
    expect(enumTokens("processState")).toEqual([...PROCESS_STATES]);
  });

  test.each(PROCESS_STATES)(
    "%s admits its reviewed representative",
    (state) => {
      expect(verdicts(PROCESS_STATUS, buildProcessStatus(state))).toEqual({
        structural: true,
        semantic: true,
      });
    },
  );

  test("a non-zero exit is explainable and a clean exit is not explained away", () => {
    const clean = buildProcessStatus("EXITED");
    expect(verdicts(PROCESS_STATUS, clean)).toEqual({
      structural: true,
      semantic: true,
    });

    const failed = structuredClone(clean);
    failed.exit_code = 1;
    failed.reason_codes = ["ADAPTER_ERROR"];
    failed.diagnostic_digest = SYNTHETIC_DIGEST;
    expect(verdicts(PROCESS_STATUS, failed)).toEqual({
      structural: true,
      semantic: true,
    });

    // An unexplained non-zero exit and an explained clean exit are both refused.
    const unexplained = structuredClone(clean);
    unexplained.exit_code = 1;
    expect(verdicts(PROCESS_STATUS, unexplained)).toEqual({
      structural: true,
      semantic: false,
    });

    const overExplained = structuredClone(clean);
    overExplained.reason_codes = ["ADAPTER_ERROR"];
    expect(verdicts(PROCESS_STATUS, overExplained)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  test("an orphan that was cleaned up keeps its historical detection", () => {
    const cleanedUp = buildProcessStatus("TERMINATED");
    cleanedUp.orphan_detected = true;
    cleanedUp.termination_requested = "IMMEDIATE_STOP";
    cleanedUp.reason_codes = ["ADAPTER_ERROR"];
    expect(verdicts(PROCESS_STATUS, cleanedUp)).toEqual({
      structural: true,
      semantic: true,
    });

    // A running process is not an orphan, whatever the flag says.
    const running = buildProcessStatus("RUNNING");
    running.orphan_detected = true;
    running.reason_codes = ["ADAPTER_ERROR"];
    expect(verdicts(PROCESS_STATUS, running)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  const PROCESS_CONTRADICTIONS: readonly {
    readonly id: string;
    readonly state: string;
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      id: "a process ends without ever starting",
      state: "EXITED",
      mutate: (value) => {
        delete value.started_at;
      },
    },
    {
      id: "an exited child is credited to a termination request",
      state: "EXITED",
      mutate: (value) => {
        value.termination_requested = "GRACEFUL_STOP";
      },
    },
    {
      id: "a diagnostic digest explains nothing",
      state: "EXITED",
      mutate: (value) => {
        value.diagnostic_digest = SYNTHETIC_DIGEST;
      },
    },
    {
      id: "a restart is counted for a process that never started",
      state: "UNAVAILABLE",
      mutate: (value) => {
        value.restart_count = 2;
      },
    },
    {
      id: "an orphan has already been seen to exit",
      state: "ORPHANED",
      mutate: (value) => {
        value.ended_at = ENDED_AT;
        value.exit_code = 0;
      },
    },
    {
      id: "a failed supervision reports an observed exit status",
      state: "FAILED",
      mutate: (value) => {
        value.exit_code = 3;
      },
    },
    {
      id: "an unobservable process reports timestamps",
      state: "UNAVAILABLE",
      mutate: (value) => {
        value.started_at = STARTED_AT;
      },
    },
    {
      id: "a running process reports no start",
      state: "RUNNING",
      mutate: (value) => {
        delete value.started_at;
      },
    },
    {
      id: "a termination is requested but not recorded",
      state: "TERMINATED",
      mutate: (value) => {
        value.termination_requested = "NONE";
      },
    },
  ];

  test.each(PROCESS_CONTRADICTIONS)("rejects a status where $id", (entry) => {
    const value = buildProcessStatus(entry.state);
    entry.mutate(value);
    expect(verdicts(PROCESS_STATUS, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 5f. Remaining KI-0025 fail-open repairs (F7 through F13)
//
// Each of these admitted a payload asserting something untrue. The positive
// alongside every negative proves the repair narrowed the contract without
// making an ordinary outcome unreachable.
// ---------------------------------------------------------------------------

const REGISTRATION_INTENT =
  "urn:japp:schema:platform:native-messaging-registration:v1";
const CAPABILITY_REPORT = "urn:japp:schema:platform:capability-report:v1";
const MODEL_PROFILE = "urn:japp:schema:platform:model-runtime-profile:v1";
const BROWSER_RECORD = "urn:japp:schema:platform:browser-record:v1";
const DIAGNOSTIC_REPORT = "urn:japp:schema:platform:diagnostic-report:v1";
const CERTIFICATION_INPUT = "urn:japp:schema:platform:certification-input:v1";

describe("M01-W07 spawn-plan argument and environment safety (KI-0025 F7)", () => {
  /**
   * The reviewed interpreter vocabulary, refused whether or not it is spelled
   * with an executable suffix, plus the privilege launchers the schema
   * describes as structurally unrepresentable.
   */
  const REFUSED_COMMAND_TOKENS = [
    "bash",
    "cmd",
    "cscript",
    "eval",
    "exec",
    "powershell",
    "pwsh",
    "sh",
    "wscript",
    "zsh",
    "doas",
    "pkexec",
    "runas",
    "su",
    "sudo",
  ] as const;

  const EXECUTABLE_SUFFIXES = [".bat", ".cmd", ".com", ".exe", ".ps1", ".sh"];

  const spellings = REFUSED_COMMAND_TOKENS.flatMap((token) => [
    token,
    token.toUpperCase(),
    ...EXECUTABLE_SUFFIXES.map((suffix) => token + suffix),
  ]);

  test.each(spellings)("refuses the argument %s", (argument) => {
    const value = fixture("w07.process-plan");
    value.arguments = [argument];
    expect(verdicts(PROCESS_PLAN, value)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  test("an ordinary argument is still admitted", () => {
    const value = fixture("w07.process-plan");
    value.arguments = ["serve", "mode=loopback"];
    expect(verdicts(PROCESS_PLAN, value)).toEqual({
      structural: true,
      semantic: true,
    });
  });

  const ENVIRONMENT_CASES: readonly {
    readonly variable: string;
    readonly value: string;
    readonly admitted: boolean;
  }[] = [
    // A service port is a real port: no zero, no leading zero, no overflow.
    { variable: "JAPP_SERVICE_PORT", value: "8420", admitted: true },
    { variable: "JAPP_SERVICE_PORT", value: "1", admitted: true },
    { variable: "JAPP_SERVICE_PORT", value: "65535", admitted: true },
    { variable: "JAPP_SERVICE_PORT", value: "0", admitted: false },
    { variable: "JAPP_SERVICE_PORT", value: "007", admitted: false },
    { variable: "JAPP_SERVICE_PORT", value: "65536", admitted: false },
    { variable: "JAPP_SERVICE_PORT", value: "99999", admitted: false },
    // The path role is the closed vocabulary, minus the registration role the
    // same rule refuses on the working directory.
    { variable: "JAPP_PATH_ROLE", value: "APPLICATION_DATA", admitted: true },
    { variable: "JAPP_PATH_ROLE", value: "TEMPORARY", admitted: true },
    {
      variable: "JAPP_PATH_ROLE",
      value: "NATIVE_HOST_REGISTRATION",
      admitted: false,
    },
    { variable: "JAPP_PATH_ROLE", value: "NOT_A_ROLE", admitted: false },
    // REQ-PLAT-003 binds local services to loopback.
    { variable: "JAPP_SERVICE_BIND_HOST", value: "127.0.0.1", admitted: true },
    { variable: "JAPP_SERVICE_BIND_HOST", value: "localhost", admitted: true },
    { variable: "JAPP_SERVICE_BIND_HOST", value: "0.0.0.0", admitted: false },
    {
      variable: "JAPP_SERVICE_BIND_HOST",
      value: "192.168.1.10",
      admitted: false,
    },
  ];

  test.each(ENVIRONMENT_CASES)(
    "$variable = $value is admitted: $admitted",
    (entry) => {
      const value = fixture("w07.process-plan");
      value.environment_allowlist = [
        { variable: entry.variable, value: entry.value },
      ];
      expect(verdicts(PROCESS_PLAN, value)).toEqual({
        structural: true,
        semantic: entry.admitted,
      });
    },
  );
});

describe("M01-W07 remaining platform fail-open repairs (KI-0025 F8-F13)", () => {
  test("a registration intent must carry its message-size limit (F8)", () => {
    const intent = fixture("w07.native-messaging-registration");
    expect(verdicts(REGISTRATION_INTENT, intent)).toEqual({
      structural: true,
      semantic: true,
    });
    delete intent.max_message_bytes;
    expect(verdicts(REGISTRATION_INTENT, intent)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  test("a certified tier requires measured core capabilities (F9)", () => {
    const measured = fixture("w07.capability-report");
    expect(verdicts(CAPABILITY_REPORT, measured)).toEqual({
      structural: true,
      semantic: true,
    });

    const declared = fixture("w07.capability-report");
    declared.capabilities = (
      declared.capabilities as Record<string, unknown>[]
    ).map((capability) =>
      capability.availability === "AVAILABLE"
        ? { ...capability, evaluation_method: "SYNTHETIC_FIXTURE" }
        : capability,
    );
    expect(verdicts(CAPABILITY_REPORT, declared)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  const MODEL_PROFILE_CASES: readonly {
    readonly id: string;
    readonly admitted: boolean;
    readonly mutate: (value: Record<string, unknown>) => void;
  }[] = [
    {
      // The committed representative is already the reviewed positive, so this
      // row deliberately changes nothing.
      id: "an accepted Apple Silicon MLX profile",
      admitted: true,
      mutate: (value) => {
        value.profile_token = "macos-arm64-mlx";
      },
    },
    {
      id: "an accepted Windows CUDA profile",
      admitted: true,
      mutate: (value) => {
        value.platform_id = "WINDOWS_X64";
        value.profile_token = "windows-x64-nvidia";
        value.runtime_family = "OLLAMA_GGUF";
        value.accelerator = "NVIDIA_CUDA";
        value.minimum_vram_mib = 24576;
        value.minimum_driver_version = "550.54.14";
      },
    },
    {
      id: "an accepted macOS CUDA profile",
      admitted: false,
      mutate: (value) => {
        value.profile_token = "macos-arm64-nvidia";
        value.runtime_family = "OLLAMA_GGUF";
        value.accelerator = "NVIDIA_CUDA";
        value.minimum_vram_mib = 24576;
        value.minimum_driver_version = "550.54.14";
      },
    },
    {
      id: "a CPU-only profile carrying a GPU driver bound",
      admitted: false,
      mutate: (value) => {
        value.platform_id = "UBUNTU_X64";
        value.profile_token = "ubuntu-x64-cpu";
        value.runtime_family = "OLLAMA_GGUF";
        value.accelerator = "CPU_ONLY";
        value.minimum_driver_version = "550.54.14";
      },
    },
  ];

  test.each(MODEL_PROFILE_CASES)(
    "$id is admitted: $admitted (F10)",
    (entry) => {
      const value = fixture("w07.model-runtime-profile");
      Object.assign(value, {
        availability: "AVAILABLE",
        acceptance_state: "ACCEPTED",
        core_capability_behavior: "FULL_AI_AVAILABLE",
        reason_codes: [],
        evidence_refs: [EVIDENCE_REF],
        structured_output_evidence_ref: EVIDENCE_REF,
        factuality_evidence_ref: EVIDENCE_REF,
        latency_evidence_ref: EVIDENCE_REF,
        memory_evidence_ref: EVIDENCE_REF,
        last_tested_on: "2026-07-01",
      });
      entry.mutate(value);
      expect(verdicts(MODEL_PROFILE, value)).toEqual({
        structural: true,
        semantic: entry.admitted,
      });
    },
  );

  test("a browser presence is an observation, not a guess (F11)", () => {
    const found = fixture("w07.browser-record");
    expect(verdicts(BROWSER_RECORD, found)).toEqual({
      structural: true,
      semantic: true,
    });

    const unevaluated = fixture("w07.browser-record");
    unevaluated.detection_method = "NOT_EVALUATED";
    expect(verdicts(BROWSER_RECORD, unevaluated)).toEqual({
      structural: true,
      semantic: false,
    });

    const absent = fixture("w07.browser-record");
    absent.presence = "NOT_INSTALLED";
    delete absent.sanitized_install_location;
    expect(verdicts(BROWSER_RECORD, absent)).toEqual({
      structural: true,
      semantic: false,
    });

    const absentHonest = structuredClone(absent);
    delete absentHonest.detected_version;
    expect(verdicts(BROWSER_RECORD, absentHonest)).toEqual({
      structural: true,
      semantic: true,
    });
  });

  test("a blocking diagnostic is never informational (F12)", () => {
    const blocked = fixture("w07.diagnostic-report");
    Object.assign(blocked, {
      result: "BLOCKED",
      blocking: true,
      severity: "WARNING",
      reason_codes: ["POLICY_DISABLED"],
    });
    delete blocked.user_message;
    expect(verdicts(DIAGNOSTIC_REPORT, blocked)).toEqual({
      structural: true,
      semantic: true,
    });

    const informational = structuredClone(blocked);
    informational.severity = "INFO";
    expect(verdicts(DIAGNOSTIC_REPORT, informational)).toEqual({
      structural: true,
      semantic: false,
    });
  });

  test("a certified proposal names the evidence it required (F13)", () => {
    const value = fixture("w07.certification-input");
    Object.assign(value, {
      support_claim: {
        claimed_tier: "CERTIFIED_CORE",
        reviewed_tier: "CERTIFIED_CORE",
        review_state: "REVIEW_COMPLETE",
        evaluated_commit: "0123456789abcdef0123456789abcdef01234567",
        evaluated_tree: "1111111111111111111111111111111111111111",
        evidence_refs: [EVIDENCE_REF],
        reviewer_identity_ref: "reviewer_0123456789ABCDEFGHJKMNPQRS",
      },
      required_evidence_kinds: ["INSTALL_LAUNCH_REPORT"],
      present_evidence_kinds: ["INSTALL_LAUNCH_REPORT"],
      evidence_record_refs: [EVIDENCE_REF],
      inventory_complete: true,
      owner_decision_state: "RECORDED",
      owner_decision_ref: "ownerdec_0123456789ABCDEFGHJKMNPQRS",
      reason_codes: [],
    });
    expect(verdicts(CERTIFICATION_INPUT, value)).toEqual({
      structural: true,
      semantic: true,
    });

    const vacuous = structuredClone(value);
    vacuous.required_evidence_kinds = [];
    vacuous.present_evidence_kinds = [];
    expect(verdicts(CERTIFICATION_INPUT, vacuous)).toEqual({
      structural: true,
      semantic: false,
    });
  });
});
