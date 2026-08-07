// LEGACY_BEHAVIOR_OBSERVATION contract (M02-W04, REQ-GATE-007/REQ-GATE-008,
// spec §5.13 legacy baseline isolation, §0(16)).
//
// CareerPulse and legacy JobApply are isolated behavioral baselines. This
// module validates closed observation records; it never imports, copies,
// links, or depends on legacy source code, and any runnable legacy
// inspection must occur outside this repository in a temporary isolated
// checkout. Records with source snippets, copied code, credentials, or
// inconsistent capture states fail closed.
import {
  BASELINE_CLASSIFICATION,
  type LegacyBehaviorObservation,
  type LegacyObservationFile,
} from "./model.ts";

export const LEGACY_OBSERVATION_ALGORITHM_VERSION = "1.0.2" as const;

export class BaselineValidationError extends Error {
  public readonly code: string;
  public readonly pointer: string;

  public constructor(code: string, pointer: string) {
    super(`${code} ${pointer}`);
    this.name = "BaselineValidationError";
    this.code = code;
    this.pointer = pointer;
  }
}

const RECORD_KEYS = [
  "id",
  "record_version",
  "system",
  "system_display_name",
  "repository_url",
  "source_revision",
  "observation_status",
  "observation_date",
  "observer",
  "environment",
  "procedure",
  "fixture_inputs",
  "observed_output_digest",
  "structured_observations",
  "safety_observations",
  "failure_or_unavailability_reason",
  "source_code_viewed",
  "code_copied",
  "comparable",
  "classification",
  "license_provenance",
  "regression_fixture_refs",
  "provenance",
] as const;

const FILE_KEYS = [
  "file_version",
  "classification",
  "isolation_statement",
  "records",
] as const;

const SYSTEMS = new Set(["CAREERPULSE", "LEGACY_JOBAPPLY"]);
const STATUSES = new Set([
  "CAPTURED",
  "NOT_ATTEMPTED",
  "UNAVAILABLE",
  "UNRUNNABLE",
]);

const ID_PATTERN = /^legacyobs_[0-9]{26}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const FIXTURE_ID_PATTERN = /^[a-z]+_[0-9a-z]{1,40}$/;
const REPOSITORY_URL_PATTERN = /^https:\/\/[A-Za-z0-9./_-]+$/;
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/u;

/**
 * Bounded refusal patterns: legacy source snippets and secrets are not
 * representable in an observation record (clean-room isolation).
 */
const SOURCE_SNIPPET_PATTERNS: readonly RegExp[] = [
  /```/u,
  /=>/u,
  /\bfunction\s*\(/u,
  /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/u,
  /\brequire\s*\(/u,
  /\bimport\s*\(/u,
  /\beval\s*\(/u,
  /<script/iu,
  /\bmodule\.exports\b/u,
  /\bdocument\.querySelector\b/u,
];
/**
 * Observation payloads have a deliberately narrower grammar than general
 * procedure/provenance prose: they describe behavior in plain language and
 * cannot carry source-code-shaped text. This is a bounded clean-room
 * boundary, not a general programming-language detector.
 */
const OBSERVATION_WHOLE_TEXT_SOURCE_SHAPE_PATTERNS: readonly RegExp[] = [
  /`/u,
  /=>/u,
];

const OBSERVATION_LINE_SOURCE_SHAPE_PATTERNS: readonly RegExp[] = [
  /^(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=;]+)?\s*(?:=|;|$)/u,
  /^type\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]+>)?\s*=/u,
  /^(?:interface|class|enum)\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)?(?:\s+implements\s+[A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)?\s*\{/u,
  /^import\s+(?:(?:type\s+)?(?:[A-Za-z_$][\w$]*|\*\s+as\s+[A-Za-z_$][\w$]*|\{[^{}]+\})\s+from\s+)?["'][^"']+["']\s*;?$/u,
  /^import\s+[A-Za-z_][\w.]*(?:\s+as\s+[A-Za-z_][\w]*)?(?:\s*,\s*[A-Za-z_][\w.]*(?:\s+as\s+[A-Za-z_][\w]*)?)*\s*;?$/u,
  /^export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\b/u,
  /^export\s+default\s+\S(?:.*\S)?\s*;?$/u,
  /^export\s*(?:\{[^{}]+\}|\*)\s*(?:from\s+["'][^"']+["'])?\s*;?$/u,
  /^from\s+[A-Za-z_][\w.]*\s+import\s+(?:[A-Za-z_*][\w*]*(?:\s+as\s+[A-Za-z_][\w]*)?|\([^()]+\))(?:\s*,\s*[A-Za-z_*][\w*]*)*\s*;?$/u,
  /^(?:async\s+)?def\s+[A-Za-z_][\w]*\s*\([^)]*\)\s*:?$/u,
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*\s*(?:\+=|-=|\*=|\/=|%=|=(?!=))\s*\S.*;?$/u,
  /^(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\d+(?:\.\d+)?)(?:\s*[+\-*/%]\s*(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\d+(?:\.\d+)?|["'][^"']*["']))+\s*;?$/u,
  /^(?:await\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\([^()]*\)\s*;?$/u,
  /^(?:await\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s+\([^()]*\)\s*;$/u,
  /^(?:if|for|while|switch|catch)\s*\([^)]*\)\s*(?:\{.*\}|[;{])?$/u,
  /^(?:return|throw)\b[^.!?]*;$/u,
  /^(?:break|continue)\s*;$/u,
  /^(?:\{|\})\s*;?$|^\{[^{}]*\}\s*;?$|^(?:else|try|finally|do)\s*\{$/u,
];
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /\bBearer\s+\S+/iu,
  /\bsk-[A-Za-z0-9_-]{8,}/u,
  /\bghp_[A-Za-z0-9]{8,}/u,
  /\b(?:password|passwd|secret|token)\s*[:=]/iu,
];
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/gu;

function fail(code: string, pointer: string): never {
  throw new BaselineValidationError(code, pointer);
}

function asObject(
  value: unknown,
  pointer: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("LEGACY_OBSERVATION_NOT_OBJECT", pointer);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("LEGACY_OBSERVATION_KEY_SET", pointer);
  }
  return record;
}

function boundedString(
  value: unknown,
  pointer: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("LEGACY_OBSERVATION_STRING", pointer);
  }
  if (value.length > maxLength) {
    fail("LEGACY_OBSERVATION_STRING_LENGTH", pointer);
  }
  return value;
}

function checkFreeText(value: string, pointer: string): void {
  for (const pattern of SOURCE_SNIPPET_PATTERNS) {
    if (pattern.test(value)) {
      fail("LEGACY_OBSERVATION_SOURCE_SNIPPET", pointer);
    }
  }
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(value)) {
      fail("LEGACY_OBSERVATION_CREDENTIAL", pointer);
    }
  }
  for (const match of value.matchAll(EMAIL_PATTERN)) {
    if (!match[0].toLowerCase().endsWith("@example.test")) {
      fail("LEGACY_OBSERVATION_EMAIL", pointer);
    }
  }
}

function boundedFreeText(
  value: unknown,
  pointer: string,
  maxLength: number,
): string {
  const text = boundedString(value, pointer, maxLength);
  checkFreeText(text, pointer);
  return text;
}

function freeTextArray(
  value: unknown,
  pointer: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    fail("LEGACY_OBSERVATION_ARRAY", pointer);
  }
  return value.map((item, index) =>
    boundedFreeText(item, `${pointer}/${String(index)}`, maxLength),
  );
}

function observationTextArray(
  value: unknown,
  pointer: string,
  maxItems: number,
  maxLength: number,
): string[] {
  const items = freeTextArray(value, pointer, maxItems, maxLength);
  for (const [index, item] of items.entries()) {
    const wholeTextSourceShape =
      OBSERVATION_WHOLE_TEXT_SOURCE_SHAPE_PATTERNS.some((pattern) =>
        pattern.test(item),
      );
    const lineSourceShape = item
      .split(/\r\n?|\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .some((line) =>
        OBSERVATION_LINE_SOURCE_SHAPE_PATTERNS.some((pattern) =>
          pattern.test(line),
        ),
      );
    if (wholeTextSourceShape || lineSourceShape) {
      fail("LEGACY_OBSERVATION_SOURCE_SNIPPET", `${pointer}/${String(index)}`);
    }
  }
  return items;
}

function validateRecord(
  value: unknown,
  pointer: string,
): LegacyBehaviorObservation {
  const record = asObject(value, pointer, RECORD_KEYS);
  const id = boundedString(record.id, `${pointer}/id`, 40);
  if (!ID_PATTERN.test(id)) {
    fail("LEGACY_OBSERVATION_ID", `${pointer}/id`);
  }
  if (record.record_version !== "1.0.0") {
    fail("LEGACY_OBSERVATION_VERSION", `${pointer}/record_version`);
  }
  const system = boundedString(record.system, `${pointer}/system`, 40);
  if (!SYSTEMS.has(system)) {
    fail("LEGACY_OBSERVATION_SYSTEM", `${pointer}/system`);
  }
  boundedFreeText(
    record.system_display_name,
    `${pointer}/system_display_name`,
    120,
  );
  if (record.repository_url !== null) {
    const url = boundedString(
      record.repository_url,
      `${pointer}/repository_url`,
      200,
    );
    if (!REPOSITORY_URL_PATTERN.test(url)) {
      fail("LEGACY_OBSERVATION_REPOSITORY_URL", `${pointer}/repository_url`);
    }
  }
  if (record.source_revision !== null) {
    const revision = boundedString(
      record.source_revision,
      `${pointer}/source_revision`,
      64,
    );
    if (!SOURCE_REVISION_PATTERN.test(revision)) {
      fail("LEGACY_OBSERVATION_SOURCE_REVISION", `${pointer}/source_revision`);
    }
  }
  const status = boundedString(
    record.observation_status,
    `${pointer}/observation_status`,
    20,
  );
  if (!STATUSES.has(status)) {
    fail("LEGACY_OBSERVATION_STATUS", `${pointer}/observation_status`);
  }
  const date = boundedString(
    record.observation_date,
    `${pointer}/observation_date`,
    10,
  );
  if (!DATE_PATTERN.test(date)) {
    fail("LEGACY_OBSERVATION_DATE", `${pointer}/observation_date`);
  }
  boundedFreeText(record.observer, `${pointer}/observer`, 120);
  boundedFreeText(record.environment, `${pointer}/environment`, 500);
  const procedure = freeTextArray(
    record.procedure,
    `${pointer}/procedure`,
    16,
    300,
  );
  if (procedure.length === 0) {
    fail("LEGACY_OBSERVATION_PROCEDURE", `${pointer}/procedure`);
  }
  if (
    !Array.isArray(record.fixture_inputs) ||
    record.fixture_inputs.length > 64
  ) {
    fail("LEGACY_OBSERVATION_ARRAY", `${pointer}/fixture_inputs`);
  }
  const fixtureInputs = record.fixture_inputs.map((item, index) => {
    const itemPointer = `${pointer}/fixture_inputs/${String(index)}`;
    const input = asObject(item, itemPointer, ["fixture_id", "content_digest"]);
    const fixtureId = boundedString(
      input.fixture_id,
      `${itemPointer}/fixture_id`,
      64,
    );
    if (!FIXTURE_ID_PATTERN.test(fixtureId)) {
      fail("LEGACY_OBSERVATION_FIXTURE_ID", `${itemPointer}/fixture_id`);
    }
    const digest = boundedString(
      input.content_digest,
      `${itemPointer}/content_digest`,
      80,
    );
    if (!DIGEST_PATTERN.test(digest)) {
      fail("LEGACY_OBSERVATION_DIGEST", `${itemPointer}/content_digest`);
    }
    return { fixture_id: fixtureId, content_digest: digest } as const;
  });
  if (
    record.observed_output_digest !== null &&
    (typeof record.observed_output_digest !== "string" ||
      !DIGEST_PATTERN.test(record.observed_output_digest))
  ) {
    fail("LEGACY_OBSERVATION_DIGEST", `${pointer}/observed_output_digest`);
  }
  const structured = observationTextArray(
    record.structured_observations,
    `${pointer}/structured_observations`,
    32,
    500,
  );
  const safety = observationTextArray(
    record.safety_observations,
    `${pointer}/safety_observations`,
    32,
    500,
  );
  if (record.failure_or_unavailability_reason !== null) {
    boundedFreeText(
      record.failure_or_unavailability_reason,
      `${pointer}/failure_or_unavailability_reason`,
      500,
    );
  }
  if (typeof record.source_code_viewed !== "boolean") {
    fail("LEGACY_OBSERVATION_BOOLEAN", `${pointer}/source_code_viewed`);
  }
  if (record.code_copied !== false) {
    fail("LEGACY_OBSERVATION_CODE_COPIED", `${pointer}/code_copied`);
  }
  if (typeof record.comparable !== "boolean") {
    fail("LEGACY_OBSERVATION_BOOLEAN", `${pointer}/comparable`);
  }
  if (record.classification !== "NON_PRODUCTION") {
    fail("LEGACY_OBSERVATION_CLASSIFICATION", `${pointer}/classification`);
  }
  boundedFreeText(
    record.license_provenance,
    `${pointer}/license_provenance`,
    300,
  );
  const regressionRefs = freeTextArray(
    record.regression_fixture_refs,
    `${pointer}/regression_fixture_refs`,
    32,
    64,
  );
  for (const [index, ref] of regressionRefs.entries()) {
    if (!FIXTURE_ID_PATTERN.test(ref)) {
      fail(
        "LEGACY_OBSERVATION_FIXTURE_ID",
        `${pointer}/regression_fixture_refs/${String(index)}`,
      );
    }
  }
  const provenance = asObject(record.provenance, `${pointer}/provenance`, [
    "authored_in",
    "author",
    "reviewer",
    "reviewed_on",
  ]);
  if (provenance.authored_in !== "M02-W04") {
    fail("LEGACY_OBSERVATION_PROVENANCE", `${pointer}/provenance/authored_in`);
  }
  boundedFreeText(provenance.author, `${pointer}/provenance/author`, 120);
  boundedFreeText(provenance.reviewer, `${pointer}/provenance/reviewer`, 120);
  const reviewedOn = boundedString(
    provenance.reviewed_on,
    `${pointer}/provenance/reviewed_on`,
    10,
  );
  if (!DATE_PATTERN.test(reviewedOn)) {
    fail("LEGACY_OBSERVATION_DATE", `${pointer}/provenance/reviewed_on`);
  }

  const captured = status === "CAPTURED";
  if (captured) {
    if (record.repository_url === null) {
      fail(
        "LEGACY_OBSERVATION_CAPTURE_REPOSITORY",
        `${pointer}/repository_url`,
      );
    }
    if (fixtureInputs.length === 0) {
      fail("LEGACY_OBSERVATION_CAPTURE_INPUTS", `${pointer}/fixture_inputs`);
    }
    if (record.observed_output_digest === null) {
      fail(
        "LEGACY_OBSERVATION_CAPTURE_OUTPUT",
        `${pointer}/observed_output_digest`,
      );
    }
    if (record.source_revision === null) {
      fail("LEGACY_OBSERVATION_CAPTURE_REVISION", `${pointer}/source_revision`);
    }
    if (record.failure_or_unavailability_reason !== null) {
      fail(
        "LEGACY_OBSERVATION_CAPTURE_REASON",
        `${pointer}/failure_or_unavailability_reason`,
      );
    }
    if (structured.length === 0) {
      fail(
        "LEGACY_OBSERVATION_CAPTURE_CONTENT",
        `${pointer}/structured_observations`,
      );
    }
  } else {
    if (fixtureInputs.length !== 0) {
      fail("LEGACY_OBSERVATION_UNCAPTURED_INPUTS", `${pointer}/fixture_inputs`);
    }
    if (record.observed_output_digest !== null) {
      fail(
        "LEGACY_OBSERVATION_UNCAPTURED_OUTPUT",
        `${pointer}/observed_output_digest`,
      );
    }
    if (structured.length !== 0) {
      fail(
        "LEGACY_OBSERVATION_UNCAPTURED_CONTENT",
        `${pointer}/structured_observations`,
      );
    }
    if (safety.length !== 0) {
      fail(
        "LEGACY_OBSERVATION_UNCAPTURED_SAFETY",
        `${pointer}/safety_observations`,
      );
    }
    if (regressionRefs.length !== 0) {
      fail(
        "LEGACY_OBSERVATION_UNCAPTURED_REGRESSION",
        `${pointer}/regression_fixture_refs`,
      );
    }
    if (record.failure_or_unavailability_reason === null) {
      fail(
        "LEGACY_OBSERVATION_MISSING_REASON",
        `${pointer}/failure_or_unavailability_reason`,
      );
    }
    if (record.comparable) {
      fail("LEGACY_OBSERVATION_COMPARABILITY", `${pointer}/comparable`);
    }
  }
  return value as LegacyBehaviorObservation;
}

export function validateLegacyObservationFile(
  value: unknown,
): LegacyObservationFile {
  const file = asObject(value, "/", FILE_KEYS);
  if (file.file_version !== "1.0.0") {
    fail("LEGACY_OBSERVATION_VERSION", "/file_version");
  }
  if (
    JSON.stringify(file.classification) !==
    JSON.stringify(BASELINE_CLASSIFICATION)
  ) {
    fail("LEGACY_OBSERVATION_CLASSIFICATION", "/classification");
  }
  boundedFreeText(file.isolation_statement, "/isolation_statement", 500);
  if (
    !Array.isArray(file.records) ||
    file.records.length === 0 ||
    file.records.length > 32
  ) {
    fail("LEGACY_OBSERVATION_ARRAY", "/records");
  }
  const ids = new Set<string>();
  const records = file.records.map((record, index) => {
    const validated = validateRecord(record, `/records/${String(index)}`);
    if (ids.has(validated.id)) {
      fail("LEGACY_OBSERVATION_DUPLICATE_ID", `/records/${String(index)}/id`);
    }
    ids.add(validated.id);
    return validated;
  });
  return {
    file_version: "1.0.0",
    classification: BASELINE_CLASSIFICATION,
    isolation_statement: file.isolation_statement as string,
    records,
  };
}
