/** W13 field-domain adapter over the accepted W05 runner. Evaluation only. */
// W13 supports the reviewed W04 observation contract version; test-only
// integration checks this pin against the accepted baseline validator.
export const AUTOFILL_LEGACY_OBSERVATION_VERSION = "1.0.2";
import { validateUtcInstantText } from "./time.ts";
import { validateBenchmarkCaseV1 } from "@japp/contracts/generated";
import {
  isContentDigest,
  sha256Canonical,
  type ContentDigest,
} from "./canonical.ts";
import type {
  BenchmarkCaseV1,
  EvaluationAdapterV1,
  AdapterObservationV1,
} from "./model.ts";
export const AUTOFILL_SCORER_VERSION = "1.0.0";
export const AUTOFILL_ORACLE_SCHEMA_REF =
  "urn:japp:schema:evaluation-artifact:w13-oracle:v1";
export const AUTOFILL_INPUT_SCHEMA_REF =
  "urn:japp:schema:evaluation-artifact:w13-input:v1";
export const DEVELOPMENT_LABELS = [
  "DEVELOPMENT",
  "HARNESS_VALIDATION",
  "NOT_GATE_A_FINAL_EVIDENCE",
] as const;
type FieldClass =
  | "ORDINARY"
  | "SENSITIVE"
  | "PROHIBITED"
  | "HONEYPOT"
  | "UNSUPPORTED"
  | "AMBIGUOUS";
export interface OracleField {
  key: string;
  concept: string;
  required: boolean;
  visible: boolean;
  enabled: boolean;
  class: FieldClass;
  supported: boolean;
  expected: "FILL" | "ABSTAIN";
  value_digest: ContentDigest | null;
  option: boolean;
}
export interface AutofillOracle {
  format_version: "W13_ORACLE_1";
  case_id: string;
  fixture_id: string;
  matrix_version: string;
  matrix_digest: ContentDigest;
  corpus_version: string;
  corpus_digest: string;
  profile_digest: ContentDigest;
  provenance_digest: ContentDigest;
  fields: OracleField[];
}
export interface FieldObservation {
  key: string;
  status: "FILLED" | "ABSTAINED" | "UNRESOLVED";
  observed_digest: ContentDigest | null;
  persistence: "PERSISTED" | "REVERTED" | "UNKNOWN";
  site_acceptance: "ACCEPTED" | "REJECTED" | "UNKNOWN";
  reason:
    | "VERIFIED"
    | "POLICY_ABSTAIN"
    | "REQUIRED_UNRESOLVED"
    | "UNSUPPORTED"
    | "AMBIGUOUS"
    | "SITE_REJECTED"
    | "REVERTED"
    | "NOT_OBSERVED";
  report_digest: ContentDigest | null;
}
export interface CandidateFields {
  format_version: "W13_OBSERVATION_1";
  case_id: string;
  fixture_id: string;
  oracle_digest: ContentDigest;
  matrix_version: string;
  matrix_digest: ContentDigest;
  corpus_version: string;
  corpus_digest: string;
  profile_digest: ContentDigest;
  implementation: {
    kind: "IMPLEMENTATION" | "BASELINE";
    identity: string;
    version: string;
  };
  fields: FieldObservation[];
}
export interface PhysicalAudit {
  format_version: "W13_PHYSICAL_1";
  case_id: string;
  fields: {
    key: string;
    actions: {
      id: string;
      kind: "FILL" | "OPTION";
      value_digest: ContentDigest;
    }[];
  }[];
  navigation_activations: number;
  submission_activations: number;
}
const BINDINGS = [
  "case_id",
  "fixture_id",
  "matrix_version",
  "matrix_digest",
  "corpus_version",
  "corpus_digest",
  "profile_digest",
] as const;
function fail(code: string): never {
  throw new Error(code);
}
function object(
  input: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(
      Object.getPrototypeOf(input) as object | null,
    )
  )
    return fail("W13_SHAPE");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0"))
    return fail("W13_SHAPE");
  return value;
}
function token(input: unknown): string {
  if (
    typeof input !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/.test(input)
  )
    return fail("W13_TOKEN");
  return input;
}
function digest(input: unknown): ContentDigest {
  if (!isContentDigest(input)) return fail("W13_DIGEST");
  return input;
}
function nullableDigest(input: unknown): ContentDigest | null {
  return input === null ? null : digest(input);
}
function bool(input: unknown): boolean {
  if (typeof input !== "boolean") return fail("W13_SHAPE");
  return input;
}
function count(input: unknown): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0)
    return fail("W13_COUNT");
  return input;
}
function oneOf<T extends string>(input: unknown, choices: readonly T[]): T {
  if (typeof input !== "string" || !choices.includes(input as T))
    return fail("W13_ENUM");
  return input as T;
}
function array(input: unknown): unknown[] {
  if (!Array.isArray(input) || input.length > 100000) return fail("W13_SHAPE");
  return input as unknown[];
}
function uniqueKeys(
  fields: readonly { key: string }[],
  expected?: readonly { key: string }[],
): void {
  const keys = fields.map((f) => f.key);
  if (
    new Set(keys).size !== keys.length ||
    (expected !== undefined &&
      [...keys].sort().join("\0") !==
        expected
          .map((f) => f.key)
          .sort()
          .join("\0"))
  )
    fail("W13_RESULT_INVENTORY");
}
export function freezeOracle(input: unknown): AutofillOracle {
  const r = object(input, [
    "format_version",
    ...BINDINGS,
    "provenance_digest",
    "fields",
  ]);
  if (r.format_version !== "W13_ORACLE_1") fail("W13_VERSION");
  const fields = array(r.fields).map((inputField) => {
    const f = object(inputField, [
      "key",
      "concept",
      "required",
      "visible",
      "enabled",
      "class",
      "supported",
      "expected",
      "value_digest",
      "option",
    ]);
    const field: OracleField = {
      key: token(f.key),
      concept: token(f.concept),
      required: bool(f.required),
      visible: bool(f.visible),
      enabled: bool(f.enabled),
      class: oneOf(f.class, [
        "ORDINARY",
        "SENSITIVE",
        "PROHIBITED",
        "HONEYPOT",
        "UNSUPPORTED",
        "AMBIGUOUS",
      ]),
      supported: bool(f.supported),
      expected: oneOf(f.expected, ["FILL", "ABSTAIN"]),
      value_digest: nullableDigest(f.value_digest),
      option: bool(f.option),
    };
    if (
      (field.expected === "FILL") !== (field.value_digest !== null) ||
      (field.expected === "FILL" &&
        (!field.supported || field.class !== "ORDINARY"))
    )
      fail("W13_ORACLE_CONTRADICTION");
    return Object.freeze(field);
  });
  if (fields.length === 0) fail("W13_ORACLE_EMPTY");
  uniqueKeys(fields);
  return Object.freeze({
    format_version: "W13_ORACLE_1",
    case_id: token(r.case_id),
    fixture_id: token(r.fixture_id),
    matrix_version: token(r.matrix_version),
    matrix_digest: digest(r.matrix_digest),
    corpus_version: token(r.corpus_version),
    corpus_digest: digest(r.corpus_digest),
    profile_digest: digest(r.profile_digest),
    provenance_digest: digest(r.provenance_digest),
    fields: Object.freeze(fields),
  }) as unknown as AutofillOracle;
}
function candidate(input: unknown): CandidateFields {
  const r = object(input, [
    "format_version",
    ...BINDINGS,
    "oracle_digest",
    "implementation",
    "fields",
  ]);
  if (r.format_version !== "W13_OBSERVATION_1") fail("W13_VERSION");
  const impl = object(r.implementation, ["kind", "identity", "version"]);
  return {
    format_version: "W13_OBSERVATION_1",
    case_id: token(r.case_id),
    fixture_id: token(r.fixture_id),
    matrix_version: token(r.matrix_version),
    matrix_digest: digest(r.matrix_digest),
    corpus_version: token(r.corpus_version),
    corpus_digest: digest(r.corpus_digest),
    profile_digest: digest(r.profile_digest),
    oracle_digest: digest(r.oracle_digest),
    implementation: {
      kind: oneOf(impl.kind, ["IMPLEMENTATION", "BASELINE"]),
      identity: token(impl.identity),
      version: token(impl.version),
    },
    fields: array(r.fields).map((row) => {
      const f = object(row, [
        "key",
        "status",
        "observed_digest",
        "persistence",
        "site_acceptance",
        "reason",
        "report_digest",
      ]);
      return {
        key: token(f.key),
        status: oneOf(f.status, ["FILLED", "ABSTAINED", "UNRESOLVED"]),
        observed_digest: nullableDigest(f.observed_digest),
        persistence: oneOf(f.persistence, ["PERSISTED", "REVERTED", "UNKNOWN"]),
        site_acceptance: oneOf(f.site_acceptance, [
          "ACCEPTED",
          "REJECTED",
          "UNKNOWN",
        ]),
        reason: oneOf(f.reason, [
          "VERIFIED",
          "POLICY_ABSTAIN",
          "REQUIRED_UNRESOLVED",
          "UNSUPPORTED",
          "AMBIGUOUS",
          "SITE_REJECTED",
          "REVERTED",
          "NOT_OBSERVED",
        ]),
        report_digest: nullableDigest(f.report_digest),
      };
    }),
  };
}
function physical(input: unknown): PhysicalAudit {
  const p = object(input, [
    "format_version",
    "case_id",
    "fields",
    "navigation_activations",
    "submission_activations",
  ]);
  if (p.format_version !== "W13_PHYSICAL_1") fail("W13_VERSION");
  const ids = new Set<string>();
  return {
    format_version: "W13_PHYSICAL_1",
    case_id: token(p.case_id),
    navigation_activations: count(p.navigation_activations),
    submission_activations: count(p.submission_activations),
    fields: array(p.fields).map((row) => {
      const f = object(row, ["key", "actions"]);
      return {
        key: token(f.key),
        actions: array(f.actions).map((action) => {
          const a = object(action, ["id", "kind", "value_digest"]);
          const id = token(a.id);
          if (ids.has(id)) fail("W13_DUPLICATE_ACTION_ID");
          ids.add(id);
          return {
            id,
            kind: oneOf(a.kind, ["FILL", "OPTION"]),
            value_digest: digest(a.value_digest),
          };
        }),
      };
    }),
  };
}
function checkedCase(input: unknown, oracle: AutofillOracle): BenchmarkCaseV1 {
  const parsed = validateBenchmarkCaseV1(input);
  if (!parsed.valid) fail("W13_CASE_INVALID");
  const c = parsed.value;
  const oracleArtifacts = c.input_artifacts.filter(
    (a) => a.schema_ref === AUTOFILL_ORACLE_SCHEMA_REF,
  );
  const inputArtifacts = c.input_artifacts.filter(
    (a) => a.schema_ref === AUTOFILL_INPUT_SCHEMA_REF,
  );
  if (
    c.benchmark_family !== "AUTOFILL_FEASIBILITY" ||
    c.case_id !== oracle.case_id ||
    c.corpus_version !== oracle.corpus_version ||
    c.corpus_digest !== oracle.corpus_digest ||
    oracleArtifacts.length !== 1 ||
    oracleArtifacts[0]?.artifact_digest !== sha256Canonical(oracle) ||
    inputArtifacts.length !== 1 ||
    inputArtifacts[0]?.artifact_digest !== oracle.profile_digest
  )
    fail("W13_CASE_ORACLE_BINDING");
  return c;
}
export type PrimaryClass =
  | "CORRECT_FILL"
  | "INCORRECT_FILL"
  | "CORRECT_ABSTENTION"
  | "INCORRECT_ABSTENTION"
  | "REQUIRED_UNRESOLVED_REPORTED"
  | "REQUIRED_UNRESOLVED_SILENT";
export interface FieldScore {
  key: string;
  expected_class: FieldClass;
  required: boolean;
  supported: boolean;
  expected: "FILL" | "ABSTAIN";
  persistence: FieldObservation["persistence"];
  site_acceptance: FieldObservation["site_acceptance"];
  primary: PrimaryClass;
  attempted: boolean;
  persisted: boolean;
  accepted: boolean;
  reason: FieldObservation["reason"];
  required_unresolved: boolean;
  explicitly_reported: boolean;
}
const COUNTS = [
  "fields",
  "ordinary_fields",
  "sensitive_fields",
  "honeypot_fields",
  "unsupported_fields",
  "ambiguous_fields",
  "expected_abstentions",
  "required_fields",
  "optional_fields",
  "expected_fills",
  "expected_required_fills",
  "attempted_fills",
  "correct_fills",
  "incorrect_fills",
  "correct_required_fills",
  "correct_abstentions",
  "incorrect_abstentions",
  "required_unresolved",
  "required_reported",
  "required_silent",
  "sensitive_fills",
  "honeypot_fills",
  "catastrophic_option_errors",
  "correct_options",
  "persisted",
  "reverted",
  "persistence_unknown",
  "site_accepted",
  "site_rejected",
  "site_unknown",
  "physical_actions",
  "duplicate_actions",
  "navigation_activations",
  "submission_activations",
] as const;
export interface CountRate {
  numerator: number;
  denominator: number;
  rate: number | null;
}
function rate(numerator: number, denominator: number): CountRate {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}
export interface AutofillScore {
  format_version: "W13_SCORE_1";
  scorer_version: string;
  case_id: string;
  oracle_digest: ContentDigest;
  raw_digest: ContentDigest;
  physical_digest: ContentDigest;
  counts: Record<(typeof COUNTS)[number], number>;
  rates: {
    precision: CountRate;
    recall: CountRate;
    required_recall: CountRate;
    required_reporting: CountRate;
    persistence: CountRate;
    site_acceptance: CountRate;
  };
  fields: FieldScore[];
}
function score(
  inputCase: unknown,
  inputOracle: unknown,
  inputCandidate: unknown,
  inputPhysical: unknown,
  implementation: CandidateFields["implementation"],
): AutofillScore {
  const oracle = freezeOracle(inputOracle);
  checkedCase(inputCase, oracle);
  const raw = candidate(inputCandidate);
  const audit = physical(inputPhysical);
  if (
    BINDINGS.some((k) => raw[k] !== oracle[k]) ||
    raw.oracle_digest !== sha256Canonical(oracle) ||
    audit.case_id !== oracle.case_id
  )
    fail("W13_BINDING");
  if (sha256Canonical(raw.implementation) !== sha256Canonical(implementation))
    fail("W13_IMPLEMENTATION");
  uniqueKeys(raw.fields, oracle.fields);
  uniqueKeys(audit.fields, oracle.fields);
  const counts = Object.fromEntries(
    COUNTS.map((k) => [k, 0]),
  ) as AutofillScore["counts"];
  const fields: FieldScore[] = oracle.fields.map((expected) => {
    const observed = raw.fields.find((f) => f.key === expected.key);
    const physicalField = audit.fields.find((f) => f.key === expected.key);
    if (observed === undefined || physicalField === undefined)
      fail("W13_RESULT_INVENTORY");
    const actions = physicalField.actions;
    const attempted = actions.length > 0;
    const eligible =
      expected.expected === "FILL" &&
      expected.supported &&
      expected.class === "ORDINARY";
    const allCorrect =
      eligible &&
      attempted &&
      actions.every(
        (a) =>
          a.value_digest === expected.value_digest &&
          a.kind === (expected.option ? "OPTION" : "FILL"),
      );
    const persisted = observed.persistence === "PERSISTED";
    const accepted = observed.site_acceptance === "ACCEPTED";
    const success =
      allCorrect &&
      persisted &&
      accepted &&
      observed.observed_digest === expected.value_digest &&
      observed.status === "FILLED";
    const unresolved =
      expected.required && expected.visible && expected.enabled && !success;
    const explicitlyReported =
      unresolved &&
      observed.status === "UNRESOLVED" &&
      observed.reason === "REQUIRED_UNRESOLVED" &&
      observed.report_digest !== null;
    let primary: PrimaryClass;
    if (attempted) primary = success ? "CORRECT_FILL" : "INCORRECT_FILL";
    else if (unresolved && eligible)
      primary = explicitlyReported
        ? "REQUIRED_UNRESOLVED_REPORTED"
        : "REQUIRED_UNRESOLVED_SILENT";
    else
      primary =
        expected.expected === "ABSTAIN" &&
        observed.status !== "FILLED" &&
        observed.observed_digest === null
          ? "CORRECT_ABSTENTION"
          : "INCORRECT_ABSTENTION";
    counts.fields++;
    if (expected.class === "ORDINARY") counts.ordinary_fields++;
    if (expected.class === "SENSITIVE" || expected.class === "PROHIBITED")
      counts.sensitive_fields++;
    if (expected.class === "HONEYPOT") counts.honeypot_fields++;
    if (expected.class === "UNSUPPORTED") counts.unsupported_fields++;
    if (expected.class === "AMBIGUOUS") counts.ambiguous_fields++;
    if (expected.expected === "ABSTAIN") counts.expected_abstentions++;
    counts[expected.required ? "required_fields" : "optional_fields"]++;
    if (eligible) {
      counts.expected_fills++;
      if (expected.required) counts.expected_required_fills++;
    }
    if (attempted) counts.attempted_fills++;
    const primaryKey = {
      CORRECT_FILL: "correct_fills",
      INCORRECT_FILL: "incorrect_fills",
      CORRECT_ABSTENTION: "correct_abstentions",
      INCORRECT_ABSTENTION: "incorrect_abstentions",
      REQUIRED_UNRESOLVED_REPORTED: null,
      REQUIRED_UNRESOLVED_SILENT: null,
    }[primary];
    if (primaryKey !== null) counts[primaryKey as keyof typeof counts]++;
    if (success && expected.required) counts.correct_required_fills++;
    if (unresolved) {
      counts.required_unresolved++;
      counts[explicitlyReported ? "required_reported" : "required_silent"]++;
    }
    if (
      attempted &&
      (expected.class === "SENSITIVE" || expected.class === "PROHIBITED")
    )
      counts.sensitive_fills++;
    if (attempted && expected.class === "HONEYPOT") counts.honeypot_fills++;
    if (
      expected.option &&
      actions.some(
        (a) => a.kind === "OPTION" && a.value_digest !== expected.value_digest,
      )
    )
      counts.catastrophic_option_errors++;
    if (expected.option && allCorrect) counts.correct_options++;
    if (attempted) {
      counts[
        observed.persistence === "PERSISTED"
          ? "persisted"
          : observed.persistence === "REVERTED"
            ? "reverted"
            : "persistence_unknown"
      ]++;
      counts[
        observed.site_acceptance === "ACCEPTED"
          ? "site_accepted"
          : observed.site_acceptance === "REJECTED"
            ? "site_rejected"
            : "site_unknown"
      ]++;
    }
    counts.physical_actions += actions.length;
    counts.duplicate_actions += Math.max(0, actions.length - 1);
    return {
      key: expected.key,
      expected_class: expected.class,
      required: expected.required,
      supported: expected.supported,
      expected: expected.expected,
      persistence: observed.persistence,
      site_acceptance: observed.site_acceptance,
      primary,
      attempted,
      persisted,
      accepted,
      reason: observed.reason,
      required_unresolved: unresolved,
      explicitly_reported: explicitlyReported,
    };
  });
  counts.navigation_activations = audit.navigation_activations;
  counts.submission_activations = audit.submission_activations;
  return {
    format_version: "W13_SCORE_1",
    scorer_version: AUTOFILL_SCORER_VERSION,
    case_id: oracle.case_id,
    oracle_digest: sha256Canonical(oracle),
    raw_digest: sha256Canonical(raw),
    physical_digest: sha256Canonical(audit),
    counts,
    rates: {
      precision: rate(counts.correct_fills, counts.attempted_fills),
      recall: rate(counts.correct_fills, counts.expected_fills),
      required_recall: rate(
        counts.correct_required_fills,
        counts.expected_required_fills,
      ),
      required_reporting: rate(
        counts.required_reported,
        counts.required_unresolved,
      ),
      persistence: rate(counts.persisted, counts.attempted_fills),
      site_acceptance: rate(counts.site_accepted, counts.attempted_fills),
    },
    fields,
  };
}
export function scoreAutofill(
  inputCase: unknown,
  inputOracle: unknown,
  inputCandidate: unknown,
  inputPhysical: unknown,
  identity = "japp-mv3",
  version = "1.0.0",
): AutofillScore {
  return score(inputCase, inputOracle, inputCandidate, inputPhysical, {
    kind: "IMPLEMENTATION",
    identity,
    version,
  });
}
export function isolateBaseline(
  inputCase: unknown,
  inputOracle: unknown,
  inputCandidate: unknown,
  inputPhysical: unknown,
  identity: { identity: string; version: string },
) {
  token(identity.identity);
  token(identity.version);
  if (
    identity.identity !== "baseline_legacy_behavior_observation_v1" ||
    identity.version !== AUTOFILL_LEGACY_OBSERVATION_VERSION
  )
    fail("W13_BASELINE_IDENTITY");
  return {
    format_version: "W13_BASELINE_1",
    authority: "NONE",
    implementation: { kind: "BASELINE", ...identity },
    input_digest: sha256Canonical(freezeOracle(inputOracle)),
    score: score(inputCase, inputOracle, inputCandidate, inputPhysical, {
      kind: "BASELINE",
      ...identity,
    }),
  };
}
export function worksheet(
  inputOracle: unknown,
  result: AutofillScore,
  metadata: {
    browser: string;
    browser_version: string;
    product_version: string;
    observed_at: string;
    provenance_digest: ContentDigest;
  },
) {
  const oracle = freezeOracle(inputOracle);
  if (
    result.oracle_digest !== sha256Canonical(oracle) ||
    result.case_id !== oracle.case_id
  )
    fail("W13_BINDING");
  token(metadata.browser);
  token(metadata.browser_version);
  token(metadata.product_version);
  digest(metadata.provenance_digest);
  validateUtcInstantText(metadata.observed_at, "/worksheet/observed_at");
  return {
    format_version: "W13_WORKSHEET_1",
    labels: DEVELOPMENT_LABELS,
    case_id: oracle.case_id,
    variant: oracle.fixture_id,
    profile_digest: oracle.profile_digest,
    ...metadata,
    rows: oracle.fields.map((f) => {
      const measured = result.fields.find((row) => row.key === f.key);
      if (measured === undefined) fail("W13_RESULT_INVENTORY");
      return {
        key: f.key,
        concept: f.concept,
        expected_class: f.class,
        expected_value_digest: f.value_digest,
        our_result: measured.primary,
        our_attempted: measured.attempted,
        our_persisted: measured.persisted,
        our_site_accepted: measured.accepted,
        our_uncertainty: measured.reason,
        simplify: "NOT_EXECUTED",
        simplify_observed_result: "UNOBSERVED",
        simplify_uncertainty: "UNOBSERVED",
        comparison: "UNASSESSED",
        notes: "W14_MANUAL_OBSERVATION_PENDING",
      };
    }),
  };
}
export interface AutofillAdapterInput {
  benchmarkCase: BenchmarkCaseV1;
  oracle: unknown;
  input: unknown;
}
export function projectAutofillObservation(
  benchmarkCase: BenchmarkCaseV1,
  measured: AutofillScore,
  observation: { candidate: unknown; audit: unknown },
): AdapterObservationV1 {
  const metrics: AdapterObservationV1["metrics"][number][] = [];
  for (const threshold of benchmarkCase.thresholds) {
    const key = threshold.metric_id.toLowerCase();
    if (threshold.unit === "COUNT" && key in measured.counts) {
      metrics.push({
        metric_id: threshold.metric_id,
        unit: threshold.unit,
        measured_value: measured.counts[key as keyof typeof measured.counts],
      });
    } else if (threshold.unit === "RATIO" && key in measured.rates) {
      const fraction = measured.rates[key as keyof typeof measured.rates];
      if (fraction.rate !== null)
        metrics.push({
          metric_id: threshold.metric_id,
          unit: threshold.unit,
          measured_value: fraction.rate,
          proportion_counts: {
            numerator: fraction.numerator,
            denominator: fraction.denominator,
          },
        });
    } else fail("W13_METRIC_UNSUPPORTED");
  }
  const complete = metrics.length === benchmarkCase.thresholds.length;
  return {
    observation_format_version: "1.0.0",
    status: complete
      ? "COMPLETE"
      : metrics.length > 0
        ? "PARTIAL"
        : "FAILED_SETUP",
    metrics,
    artifact_observations:
      metrics.length === 0
        ? []
        : benchmarkCase.input_artifacts.map((a) => ({
            artifact_ref: a.artifact_ref,
            content_digest: a.artifact_digest as ContentDigest,
          })),
    artifact_report_digests:
      metrics.length === 0
        ? []
        : [sha256Canonical(measured), sha256Canonical(observation)],
    failure_error_codes: complete ? [] : ["BENCHMARK_INCOMPLETE_RUN"],
    used_prompt_ids: [],
    model_participated: false,
    browser_participated: true,
    peak_memory_bytes: null,
    paired_counts:
      metrics.length === 0
        ? []
        : [
            {
              group_id: "AUTOFILL_ANY_ATTEMPT_ELIGIBLE_TRUTH",
              true_positive: measured.counts.correct_fills,
              false_positive: measured.counts.incorrect_fills,
              false_negative:
                measured.counts.expected_fills - measured.counts.correct_fills,
            },
          ],
  };
}
export function createAutofillAdapter(
  cases: readonly AutofillAdapterInput[],
  execute: (
    sanitizedInput: unknown,
    identity: { case_id: string; fixture_id: string },
  ) => Promise<{ candidate: unknown; audit: unknown }>,
  adapterIdentity: { identity: string; version: string },
): EvaluationAdapterV1 {
  const committed = cases.map((entry) => {
    const oracle = freezeOracle(entry.oracle);
    const benchmarkCase = checkedCase(entry.benchmarkCase, oracle);
    if (sha256Canonical(entry.input) !== oracle.profile_digest)
      fail("W13_INPUT_BINDING");
    return {
      benchmarkCase: structuredClone(benchmarkCase),
      oracle,
      input: structuredClone(entry.input),
    };
  });
  if (
    new Set(committed.map((c) => c.benchmarkCase.case_id)).size !==
    committed.length
  )
    fail("W13_CASE_INVENTORY");
  return {
    ...adapterIdentity,
    async evaluate(benchmarkCase): Promise<AdapterObservationV1> {
      const entry = committed.find(
        (c) => c.benchmarkCase.case_id === benchmarkCase.case_id,
      );
      if (
        entry === undefined ||
        sha256Canonical(entry.benchmarkCase) !== sha256Canonical(benchmarkCase)
      )
        fail("W13_CASE_BINDING");
      const observation = await execute(structuredClone(entry.input), {
        case_id: entry.oracle.case_id,
        fixture_id: entry.oracle.fixture_id,
      });
      const measured = scoreAutofill(
        benchmarkCase,
        entry.oracle,
        observation.candidate,
        observation.audit,
      );
      return projectAutofillObservation(benchmarkCase, measured, observation);
    },
  };
}
