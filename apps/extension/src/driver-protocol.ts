// M02-W10 transactional control-driver protocol (spec §5.11.5, §5.11.6;
// REQ-FORM-015/REQ-FORM-016 feasibility portions).
//
// This is the ONLY privileged wire surface W10 adds: one bounded field
// transaction, one bounded undo of a previously executed transaction, and
// one read-only research navigation-candidate identification. Every message
// is a closed typed record parsed fail-closed exactly like the W08 scanner
// protocol; no selector, script, DOM command, navigation, submission,
// account-secret, filesystem, native-host, database, or model operation is
// representable. A transaction may execute only under a canonical W09
// FormFieldDecisionV1 that this module independently revalidates (structure
// plus the canonical FIELD_DECISION_AUTHORITY rule) and that is bound to the
// transaction's exact FieldAddress through the decision's
// field_address_digest.
import type {
  FormDriverResultV1,
  FormFieldAddressV1,
  FormFieldDecisionV1,
} from "@japp/contracts/generated";

import {
  isCanonicalFieldAddress,
  isCanonicalInertString,
  type FrameContext,
} from "./scanner-protocol.ts";

export const DRIVER_PROTOCOL_VERSION = 1;

export const EXECUTE_TAB_KIND = "M02_W10_EXECUTE_TAB";
export const EXECUTE_FRAME_KIND = "M02_W10_EXECUTE_FRAME";
export const FRAME_EXECUTE_RESULT_KIND = "M02_W10_FRAME_EXECUTE_RESULT";
export const EXECUTE_TAB_RESULT_KIND = "M02_W10_EXECUTE_RESULT";
export const UNDO_TAB_KIND = "M02_W10_UNDO_TAB";
export const UNDO_FRAME_KIND = "M02_W10_UNDO_FRAME";
export const FRAME_UNDO_RESULT_KIND = "M02_W10_FRAME_UNDO_RESULT";
export const UNDO_TAB_RESULT_KIND = "M02_W10_UNDO_RESULT";
export const IDENTIFY_NAV_TAB_KIND = "M02_W10_IDENTIFY_NAV_TAB";
export const IDENTIFY_NAV_FRAME_KIND = "M02_W10_IDENTIFY_NAV_FRAME";
export const FRAME_NAV_RESULT_KIND = "M02_W10_FRAME_NAV_RESULT";
export const IDENTIFY_NAV_TAB_RESULT_KIND = "M02_W10_IDENTIFY_NAV_RESULT";

/** Longest bounded intended text value a transaction may carry. */
export const MAX_INTENDED_TEXT_LENGTH = 512;
/** Strict upper bound of one transaction's settle/rerender window. */
export const MAX_SETTLE_BUDGET_MS = 8000;
/** Synthetic upload artifacts may not exceed the lab's 512,000-byte cap. */
export const MAX_FILE_BYTES = 512_000;
/** Base64 wire bound for MAX_FILE_BYTES (4/3 expansion, padded). */
export const MAX_FILE_BASE64_LENGTH = 682_668;
/** Bounded in-memory undo records retained per frame agent. */
export const MAX_UNDO_RECORDS = 16;
/**
 * Page attribute a test-authority settle signal is delivered through. The
 * frame agent only ever READS this attribute; it is set by the driving test
 * to make rerender-versus-settle ordering deterministic (spec settle policy:
 * "known deterministic fixture settle signals").
 */
export const SETTLE_SIGNAL_ATTRIBUTE = "data-japp-w10-settle";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const STABLE_ID_PATTERN = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/;
const ENUM_TOKEN_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ISO_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9-]{1,64}\/[a-z0-9.+-]{1,64}$/;
const ITEM_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .,'()&-]{0,127}$/;
const UTC_TIMESTAMP_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$/;

export type DriverIntendedValue =
  | { readonly kind: "TEXT"; readonly text: string }
  | { readonly kind: "OPTION"; readonly value_digest: string }
  | { readonly kind: "CHECKED"; readonly checked: boolean }
  | { readonly kind: "DATE"; readonly iso_date: string }
  | {
      readonly kind: "FILE";
      readonly file_name: string;
      readonly media_type: string;
      readonly size_bytes: number;
      readonly artifact_digest: string;
      readonly content_base64: string;
    }
  | {
      readonly kind: "REPEATER_ADD";
      readonly item_label: string;
    }
  | {
      readonly kind: "REPEATER_EDIT";
      readonly item_label: string;
      readonly text: string;
    }
  | {
      readonly kind: "REPEATER_REMOVE";
      readonly item_label: string;
    };

export interface SettlePolicy {
  readonly budget_ms: number;
  /**
   * Optional deterministic settle signal: the frame agent polls the page's
   * documentElement for SETTLE_SIGNAL_ATTRIBUTE equal to this token before
   * taking the settled observation. A signal that never arrives within the
   * budget is a settle timeout: the transaction reports honestly and can
   * never claim verified persistence.
   */
  readonly require_page_signal?: string;
}

export interface DriverTransactionRequest {
  readonly transaction_id: string;
  readonly correlation_id: string;
  readonly address: FormFieldAddressV1;
  readonly decision: FormFieldDecisionV1;
  readonly intended: DriverIntendedValue;
  readonly settle: SettlePolicy;
}

export interface ExecuteTabRequest {
  readonly kind: typeof EXECUTE_TAB_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly transaction: DriverTransactionRequest;
}

export interface ExecuteFrameRequest {
  readonly kind: typeof EXECUTE_FRAME_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly transaction: DriverTransactionRequest;
}

export interface DriverDiagnostics {
  readonly driver_candidate_count: number;
  readonly settle_polls: number;
  readonly settle_signal_observed: boolean;
}

export interface FrameExecuteResult {
  readonly kind: typeof FRAME_EXECUTE_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly result: FormDriverResultV1;
  readonly undo_available: boolean;
  readonly diagnostics: DriverDiagnostics;
}

export interface ExecuteTabResult {
  readonly kind: typeof EXECUTE_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    | {
        readonly status: "COMPLETED";
        readonly result: FormDriverResultV1;
        readonly undo_available: boolean;
        readonly diagnostics: DriverDiagnostics;
      }
    | { readonly status: "FRAME_UNAVAILABLE" };
}

export interface UndoTransactionRequest {
  readonly transaction_id: string;
  readonly address: FormFieldAddressV1;
  readonly settle: SettlePolicy;
}

export interface UndoTabRequest {
  readonly kind: typeof UNDO_TAB_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly undo: UndoTransactionRequest;
}

export interface UndoFrameRequest {
  readonly kind: typeof UNDO_FRAME_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly undo: UndoTransactionRequest;
}

export interface FrameUndoResult {
  readonly kind: typeof FRAME_UNDO_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly outcome:
    | {
        readonly status: "COMPLETED";
        readonly result: FormDriverResultV1;
        readonly diagnostics: DriverDiagnostics;
      }
    | { readonly status: "UNKNOWN_TRANSACTION" }
    | { readonly status: "ALREADY_CONSUMED" };
}

export interface UndoTabResult {
  readonly kind: typeof UNDO_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    | FrameUndoResult["outcome"]
    | {
        readonly status: "FRAME_UNAVAILABLE";
      };
}

export type NavigationCandidateStatus =
  "UNIQUE_SAFE_CANDIDATE" | "AMBIGUOUS" | "MISSING" | "UNSAFE";

export interface NavigationIdentification {
  readonly status: NavigationCandidateStatus;
  readonly candidate_count: number;
  /** Digest of the unique safe candidate's normalized accessible name. */
  readonly candidate_name_digest?: string;
}

export interface IdentifyNavTabRequest {
  readonly kind: typeof IDENTIFY_NAV_TAB_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
}

export interface IdentifyNavFrameRequest {
  readonly kind: typeof IDENTIFY_NAV_FRAME_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
}

export interface FrameNavResult {
  readonly kind: typeof FRAME_NAV_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly identification: NavigationIdentification;
}

export interface IdentifyNavTabResult {
  readonly kind: typeof IDENTIFY_NAV_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DRIVER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    | {
        readonly status: "COMPLETED";
        readonly identification: NavigationIdentification;
      }
    | { readonly status: "FRAME_UNAVAILABLE" };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasClosedKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID_PATTERN.test(value);
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function isEnumToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    ENUM_TOKEN_PATTERN.test(value)
  );
}

function isConfidence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && UTC_TIMESTAMP_PATTERN.test(value);
}

function isBoundedInertText(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(value) &&
    isCanonicalInertString(value)
  );
}

function isRealCalendarIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const thirtyDayMonths = [4, 6, 9, 11];
  if (thirtyDayMonths.includes(month)) {
    return day <= 30;
  }
  if (month !== 2) {
    return day <= 31;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= (leap ? 29 : 28);
}

const VALUE_SOURCE_TYPES = [
  "ANSWER_POLICY",
  "APPROVED_DOCUMENT",
  "DETERMINISTIC_DERIVATION",
  "MODEL_PROPOSAL",
  "NONE",
  "USER_CONFIRMATION",
  "USER_RECORD",
] as const;
const POLICY_DECISIONS = [
  "DENY",
  "PERMIT",
  "REQUIRE_CONFIRMATION",
  "UNSUPPORTED",
] as const;
const FINAL_DECISIONS = [
  "BLOCK_UNSUPPORTED",
  "FILL",
  "PAUSE_FOR_CONFIRMATION",
  "PROPOSE",
  "SKIP_OPTIONAL",
] as const;
const CONFIRMATION_STATES = [
  "EXPIRED",
  "MISSING",
  "NOT_REQUIRED",
  "REVOKED",
  "VALID",
] as const;
const DECISION_REASON_CODES = [
  "CONFIRMATION_EXPIRED",
  "CONFIRMATION_MISSING",
  "CONFIRMATION_REVOKED",
  "DETERMINISTIC_EVIDENCE",
  "LOW_CLASSIFICATION_CONFIDENCE",
  "LOW_VALUE_CONFIDENCE",
  "MODEL_PROPOSAL_ONLY",
  "OPTIONAL_UNANSWERED",
  "POLICY_DENIED",
  "REVIEWED_SOURCE",
  "SENSITIVE_CONFIRMATION_REQUIRED",
  "UNSUPPORTED_FIELD",
] as const;
const SENSITIVITY_CLASSES = [
  "PUBLIC",
  "INTERNAL",
  "PERSONAL",
  "SENSITIVE",
  "SECRET",
] as const;
const PROVENANCE_SOURCE_KINDS = [
  "USER_INPUT",
  "DOCUMENT_IMPORT",
  "PAGE_CAPTURE",
  "EXTERNAL_API",
  "GENERATED",
] as const;

const FILL_VALUE_SOURCES = new Set([
  "ANSWER_POLICY",
  "APPROVED_DOCUMENT",
  "DETERMINISTIC_DERIVATION",
  "USER_CONFIRMATION",
  "USER_RECORD",
]);

function isProvenance(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(
      candidate,
      ["source_kind", "source_id", "observed_at"],
      ["source_digest", "confidence"],
    ) &&
    (PROVENANCE_SOURCE_KINDS as readonly string[]).includes(
      String(candidate.source_kind),
    ) &&
    isStableId(candidate.source_id) &&
    isUtcTimestamp(candidate.observed_at) &&
    (candidate.source_digest === undefined ||
      isDigest(candidate.source_digest)) &&
    (candidate.confidence === undefined || isConfidence(candidate.confidence))
  );
}

/**
 * Mirror of the canonical FIELD_DECISION_AUTHORITY semantic rule
 * (packages/contracts/catalog/semantic-rules.v1.json). A decision that fails
 * this rule is not a canonical W09 decision and grants no authority at all.
 */
export function decisionSatisfiesAuthorityRule(
  decision: FormFieldDecisionV1,
): boolean {
  const reasons = decision.reason_codes;
  if (new Set(reasons).size !== reasons.length) {
    return false;
  }
  const confirmationValid =
    decision.confirmation_state === "VALID" &&
    typeof decision.user_confirmation_ref === "string";
  if (decision.confirmation_state === "VALID" && !confirmationValid) {
    return false;
  }
  if (
    (decision.policy_decision === "DENY" ||
      decision.policy_decision === "UNSUPPORTED") &&
    (decision.final_decision === "FILL" ||
      decision.final_decision === "PROPOSE")
  ) {
    return false;
  }
  if (
    (decision.value_source_type === "MODEL_PROPOSAL" ||
      decision.value_source_type === "NONE") &&
    decision.final_decision === "FILL"
  ) {
    return false;
  }
  if (
    decision.confirmation_state === "EXPIRED" ||
    decision.confirmation_state === "MISSING" ||
    decision.confirmation_state === "REVOKED"
  ) {
    return decision.final_decision === "PAUSE_FOR_CONFIRMATION";
  }
  if (
    decision.classification_confidence < 0.5 &&
    !reasons.includes("LOW_CLASSIFICATION_CONFIDENCE")
  ) {
    return false;
  }
  if (
    decision.value_confidence < 0.5 &&
    !reasons.includes("LOW_VALUE_CONFIDENCE")
  ) {
    return false;
  }
  if (decision.final_decision === "PROPOSE") {
    return (
      (FILL_VALUE_SOURCES.has(decision.value_source_type) ||
        decision.value_source_type === "MODEL_PROPOSAL") &&
      typeof decision.value_source_ref === "string"
    );
  }
  if (decision.final_decision !== "FILL") {
    return true;
  }
  const confirmationRequired =
    decision.policy_decision === "REQUIRE_CONFIRMATION" ||
    decision.sensitivity_class === "SENSITIVE" ||
    decision.sensitivity_class === "SECRET";
  return (
    FILL_VALUE_SOURCES.has(decision.value_source_type) &&
    typeof decision.value_source_ref === "string" &&
    decision.classification_confidence >= 0.75 &&
    decision.value_confidence >= 0.75 &&
    (decision.policy_decision === "PERMIT" ||
      (decision.policy_decision === "REQUIRE_CONFIRMATION" &&
        confirmationValid)) &&
    (!confirmationRequired || confirmationValid)
  );
}

/** Strict closed-record validation of a wire FormFieldDecisionV1. */
export function isCanonicalFieldDecision(
  value: unknown,
): value is FormFieldDecisionV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(
      candidate,
      [
        "decision_id",
        "field_id",
        "field_address_digest",
        "field_concept",
        "classification_confidence",
        "value_source_type",
        "value_confidence",
        "sensitivity_class",
        "policy_decision",
        "final_decision",
        "confirmation_state",
        "reason_codes",
        "provenance",
        "correlation_id",
      ],
      ["value_source_ref", "user_confirmation_ref", "causation_id"],
    ) ||
    !isStableId(candidate.decision_id) ||
    !isStableId(candidate.field_id) ||
    !isDigest(candidate.field_address_digest) ||
    !isEnumToken(candidate.field_concept) ||
    !isConfidence(candidate.classification_confidence) ||
    !(VALUE_SOURCE_TYPES as readonly string[]).includes(
      String(candidate.value_source_type),
    ) ||
    !isConfidence(candidate.value_confidence) ||
    !(SENSITIVITY_CLASSES as readonly string[]).includes(
      String(candidate.sensitivity_class),
    ) ||
    !(POLICY_DECISIONS as readonly string[]).includes(
      String(candidate.policy_decision),
    ) ||
    !(FINAL_DECISIONS as readonly string[]).includes(
      String(candidate.final_decision),
    ) ||
    !(CONFIRMATION_STATES as readonly string[]).includes(
      String(candidate.confirmation_state),
    ) ||
    !Array.isArray(candidate.reason_codes) ||
    candidate.reason_codes.length < 1 ||
    candidate.reason_codes.length > 8 ||
    !candidate.reason_codes.every((code) =>
      (DECISION_REASON_CODES as readonly string[]).includes(String(code)),
    ) ||
    !isProvenance(candidate.provenance) ||
    !isStableId(candidate.correlation_id) ||
    (candidate.value_source_ref !== undefined &&
      !isStableId(candidate.value_source_ref)) ||
    (candidate.user_confirmation_ref !== undefined &&
      !isStableId(candidate.user_confirmation_ref)) ||
    (candidate.causation_id !== undefined &&
      !isStableId(candidate.causation_id))
  ) {
    return false;
  }
  return decisionSatisfiesAuthorityRule(
    candidate as unknown as FormFieldDecisionV1,
  );
}

/**
 * Execution authority: the canonical FILL branch of
 * FIELD_DECISION_AUTHORITY. Everything else — PROPOSE, PAUSE, SKIP, BLOCK,
 * denied or unconfirmed policies, low confidences — never executes.
 */
export function decisionAuthorizesExecution(
  decision: FormFieldDecisionV1,
): boolean {
  return (
    decisionSatisfiesAuthorityRule(decision) &&
    decision.final_decision === "FILL"
  );
}

/**
 * Refusal class for a well-formed but non-executable decision: sensitive or
 * policy-blocked decisions surface as BLOCKED_SENSITIVE, everything else as
 * NEEDS_REVIEW.
 */
export function decisionRefusalClass(
  decision: FormFieldDecisionV1,
): "BLOCKED_SENSITIVE" | "NEEDS_REVIEW" {
  const sensitive =
    decision.sensitivity_class === "SENSITIVE" ||
    decision.sensitivity_class === "SECRET" ||
    decision.policy_decision === "DENY" ||
    decision.reason_codes.includes("SENSITIVE_CONFIRMATION_REQUIRED") ||
    decision.reason_codes.includes("POLICY_DENIED");
  return sensitive ? "BLOCKED_SENSITIVE" : "NEEDS_REVIEW";
}

function isIntendedValue(value: unknown): value is DriverIntendedValue {
  const candidate = record(value);
  if (candidate === null || typeof candidate.kind !== "string") {
    return false;
  }
  switch (candidate.kind) {
    case "TEXT":
      return (
        hasClosedKeys(candidate, ["kind", "text"]) &&
        isBoundedInertText(candidate.text, MAX_INTENDED_TEXT_LENGTH)
      );
    case "OPTION":
      return (
        hasClosedKeys(candidate, ["kind", "value_digest"]) &&
        isDigest(candidate.value_digest)
      );
    case "CHECKED":
      return (
        hasClosedKeys(candidate, ["kind", "checked"]) &&
        typeof candidate.checked === "boolean"
      );
    case "DATE":
      return (
        hasClosedKeys(candidate, ["kind", "iso_date"]) &&
        isRealCalendarIsoDate(candidate.iso_date)
      );
    case "FILE":
      return (
        hasClosedKeys(candidate, [
          "kind",
          "file_name",
          "media_type",
          "size_bytes",
          "artifact_digest",
          "content_base64",
        ]) &&
        typeof candidate.file_name === "string" &&
        FILE_NAME_PATTERN.test(candidate.file_name) &&
        isCanonicalInertString(candidate.file_name) &&
        typeof candidate.media_type === "string" &&
        MEDIA_TYPE_PATTERN.test(candidate.media_type) &&
        isSafeNonNegativeInteger(candidate.size_bytes) &&
        candidate.size_bytes <= MAX_FILE_BYTES &&
        isDigest(candidate.artifact_digest) &&
        typeof candidate.content_base64 === "string" &&
        candidate.content_base64.length <= MAX_FILE_BASE64_LENGTH &&
        BASE64_PATTERN.test(candidate.content_base64)
      );
    case "REPEATER_ADD":
    case "REPEATER_REMOVE":
      return (
        hasClosedKeys(candidate, ["kind", "item_label"]) &&
        typeof candidate.item_label === "string" &&
        ITEM_LABEL_PATTERN.test(candidate.item_label) &&
        isCanonicalInertString(candidate.item_label)
      );
    case "REPEATER_EDIT":
      return (
        hasClosedKeys(candidate, ["kind", "item_label", "text"]) &&
        typeof candidate.item_label === "string" &&
        ITEM_LABEL_PATTERN.test(candidate.item_label) &&
        isCanonicalInertString(candidate.item_label) &&
        isBoundedInertText(candidate.text, MAX_INTENDED_TEXT_LENGTH)
      );
    default:
      return false;
  }
}

function isSettlePolicy(value: unknown): value is SettlePolicy {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["budget_ms"], ["require_page_signal"]) &&
    isSafeNonNegativeInteger(candidate.budget_ms) &&
    candidate.budget_ms <= MAX_SETTLE_BUDGET_MS &&
    (candidate.require_page_signal === undefined ||
      isEnumToken(candidate.require_page_signal))
  );
}

/**
 * Strict closed validation of one wire DriverTransactionRequest. Exported
 * for the M02-W11 dynamic protocol, whose bounded execute-decisions pass
 * carries the exact same transaction records into the same W10 kernel.
 */
export function isCanonicalTransactionRequest(
  value: unknown,
): value is DriverTransactionRequest {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "transaction_id",
      "correlation_id",
      "address",
      "decision",
      "intended",
      "settle",
    ]) &&
    isStableId(candidate.transaction_id) &&
    isStableId(candidate.correlation_id) &&
    isCanonicalFieldAddress(candidate.address) &&
    isCanonicalFieldDecision(candidate.decision) &&
    isIntendedValue(candidate.intended) &&
    isSettlePolicy(candidate.settle)
  );
}

function isUndoRequest(value: unknown): value is UndoTransactionRequest {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["transaction_id", "address", "settle"]) &&
    isStableId(candidate.transaction_id) &&
    isCanonicalFieldAddress(candidate.address) &&
    isSettlePolicy(candidate.settle)
  );
}

function isFrameContextValue(value: unknown): value is FrameContext {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "session_id",
      "frame_id",
      "document_id",
      "document_url_digest",
      "is_top_frame",
    ]) &&
    isStableId(candidate.session_id) &&
    isStableId(candidate.frame_id) &&
    isStableId(candidate.document_id) &&
    isDigest(candidate.document_url_digest) &&
    typeof candidate.is_top_frame === "boolean"
  );
}

const RESOLUTION_RESULTS = ["UNIQUE", "AMBIGUOUS", "MISSING", "STALE"] as const;
const SITE_ACCEPTANCES = ["ACCEPTED", "REJECTED", "UNKNOWN"] as const;
const DRIVER_OUTCOMES = [
  "BLOCKED_SENSITIVE",
  "FAILED",
  "NEEDS_REVIEW",
  "UNSUPPORTED",
  "VERIFIED",
] as const;
const DRIVER_REASON_CODES = [
  "ACTION_FAILED",
  "AMBIGUOUS_RESOLUTION",
  "CONDITIONAL_FIELDS_DISCOVERED",
  "PAGE_GENERATION_CHANGED",
  "PERSISTENCE_NOT_VERIFIED",
  "PRECONDITIONS_FAILED",
  "RESOLUTION_MISSING",
  "RESOLUTION_STALE",
  "SENSITIVE_ACTION_BLOCKED",
  "SITE_ACCEPTANCE_UNKNOWN",
  "SITE_REJECTED",
  "UNSUPPORTED_CONTROL",
  "VALUE_MISMATCH",
  "VERIFIED_PERSISTENCE",
] as const;
const VALUE_PRESENCES = ["ABSENT", "EMPTY", "PRESENT_REDACTED"] as const;

function isValueEvidence(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["semantic_digest", "presence"]) &&
    isDigest(candidate.semantic_digest) &&
    (VALUE_PRESENCES as readonly string[]).includes(String(candidate.presence))
  );
}

function isPreconditions(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "visible",
      "enabled",
      "generation_matched",
      "policy_permitted",
    ]) &&
    typeof candidate.visible === "boolean" &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.generation_matched === "boolean" &&
    typeof candidate.policy_permitted === "boolean"
  );
}

function isActionAttempt(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "attempt_id",
      "attempted_at",
      "action_count",
      "duration_ms",
      "idempotency_key",
    ]) &&
    isStableId(candidate.attempt_id) &&
    isUtcTimestamp(candidate.attempted_at) &&
    Number.isSafeInteger(candidate.action_count) &&
    typeof candidate.action_count === "number" &&
    candidate.action_count >= 1 &&
    candidate.action_count <= 16 &&
    isSafeNonNegativeInteger(candidate.duration_ms) &&
    candidate.duration_ms <= 600_000 &&
    isStableId(candidate.idempotency_key)
  );
}

function isRecovery(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["attempted", "restored", "evidence_digest"]) &&
    typeof candidate.attempted === "boolean" &&
    typeof candidate.restored === "boolean" &&
    isDigest(candidate.evidence_digest)
  );
}

function valueEvidenceEquals(left: unknown, right: unknown): boolean {
  const a = record(left);
  const b = record(right);
  return (
    a !== null &&
    b !== null &&
    a.semantic_digest === b.semantic_digest &&
    a.presence === b.presence
  );
}

/**
 * Strict closed validation of a wire FormDriverResultV1, INCLUDING the
 * canonical DRIVER_VERIFIED_EVIDENCE semantic rule: a VERIFIED outcome must
 * carry unique resolution, all preconditions, intended = immediate = settled
 * evidence, verified persistence, site acceptance, matching generations, and
 * zero validation-message digests; uncertain resolutions or unknown site
 * acceptance can never be safely retryable.
 */
export function isCanonicalDriverResult(
  value: unknown,
): value is FormDriverResultV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(
      candidate,
      [
        "result_id",
        "driver_id",
        "session_id",
        "field_address",
        "resolution_result",
        "preconditions",
        "action_attempt",
        "intended_value",
        "observed_value_immediate",
        "observed_value_settled",
        "site_acceptance",
        "validation_message_digests",
        "conditional_field_ids",
        "starting_dom_generation",
        "settled_dom_generation",
        "persistence_verified",
        "safe_retry_allowed",
        "outcome",
        "reason_codes",
        "correlation_id",
      ],
      ["recovery", "causation_id"],
    ) ||
    !isStableId(candidate.result_id) ||
    !isStableId(candidate.driver_id) ||
    !isStableId(candidate.session_id) ||
    !isCanonicalFieldAddress(candidate.field_address) ||
    !(RESOLUTION_RESULTS as readonly string[]).includes(
      String(candidate.resolution_result),
    ) ||
    !isPreconditions(candidate.preconditions) ||
    !isActionAttempt(candidate.action_attempt) ||
    !isValueEvidence(candidate.intended_value) ||
    !isValueEvidence(candidate.observed_value_immediate) ||
    !isValueEvidence(candidate.observed_value_settled) ||
    !(SITE_ACCEPTANCES as readonly string[]).includes(
      String(candidate.site_acceptance),
    ) ||
    !Array.isArray(candidate.validation_message_digests) ||
    candidate.validation_message_digests.length > 8 ||
    !candidate.validation_message_digests.every(isDigest) ||
    !Array.isArray(candidate.conditional_field_ids) ||
    candidate.conditional_field_ids.length > 64 ||
    !candidate.conditional_field_ids.every(isStableId) ||
    new Set(candidate.conditional_field_ids).size !==
      candidate.conditional_field_ids.length ||
    !isSafeNonNegativeInteger(candidate.starting_dom_generation) ||
    !isSafeNonNegativeInteger(candidate.settled_dom_generation) ||
    typeof candidate.persistence_verified !== "boolean" ||
    typeof candidate.safe_retry_allowed !== "boolean" ||
    !(DRIVER_OUTCOMES as readonly string[]).includes(
      String(candidate.outcome),
    ) ||
    !Array.isArray(candidate.reason_codes) ||
    candidate.reason_codes.length < 1 ||
    candidate.reason_codes.length > 8 ||
    !candidate.reason_codes.every((code) =>
      (DRIVER_REASON_CODES as readonly string[]).includes(String(code)),
    ) ||
    !isStableId(candidate.correlation_id) ||
    (candidate.recovery !== undefined && !isRecovery(candidate.recovery)) ||
    (candidate.causation_id !== undefined &&
      !isStableId(candidate.causation_id))
  ) {
    return false;
  }
  const address = record(candidate.field_address);
  if (
    candidate.session_id !== address?.session_id ||
    candidate.starting_dom_generation !== address.observed_dom_generation
  ) {
    return false;
  }
  // W10 has no retry executor or cross-rescan idempotency authority. Every
  // result on this protocol therefore keeps automatic retry disabled; W11
  // owns the broader duplicate-action state machine.
  if (candidate.safe_retry_allowed) {
    return false;
  }
  if (candidate.outcome !== "VERIFIED") {
    return true;
  }
  const preconditions = record(candidate.preconditions);
  return (
    candidate.resolution_result === "UNIQUE" &&
    preconditions !== null &&
    preconditions.visible === true &&
    preconditions.enabled === true &&
    preconditions.generation_matched === true &&
    preconditions.policy_permitted === true &&
    valueEvidenceEquals(
      candidate.intended_value,
      candidate.observed_value_immediate,
    ) &&
    valueEvidenceEquals(
      candidate.intended_value,
      candidate.observed_value_settled,
    ) &&
    candidate.persistence_verified &&
    candidate.site_acceptance === "ACCEPTED" &&
    candidate.starting_dom_generation === candidate.settled_dom_generation &&
    candidate.validation_message_digests.length === 0
  );
}

/** Strict closed validation of DriverDiagnostics (W11 reuses it). */
export function isCanonicalDriverDiagnostics(
  value: unknown,
): value is DriverDiagnostics {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "driver_candidate_count",
      "settle_polls",
      "settle_signal_observed",
    ]) &&
    isSafeNonNegativeInteger(candidate.driver_candidate_count) &&
    isSafeNonNegativeInteger(candidate.settle_polls) &&
    typeof candidate.settle_signal_observed === "boolean"
  );
}

export function buildExecuteTabRequest(
  requestId: string,
  tabId: number,
  transaction: DriverTransactionRequest,
): ExecuteTabRequest {
  return {
    kind: EXECUTE_TAB_KIND,
    protocolVersion: DRIVER_PROTOCOL_VERSION,
    requestId,
    tabId,
    transaction,
  };
}

export function parseExecuteTabRequest(
  value: unknown,
): ExecuteTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "transaction",
    ]) &&
    candidate.kind === EXECUTE_TAB_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isSafeNonNegativeInteger(candidate.tabId) &&
    isCanonicalTransactionRequest(candidate.transaction)
    ? (candidate as unknown as ExecuteTabRequest)
    : null;
}

export function parseExecuteFrameRequest(
  value: unknown,
): ExecuteFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "transaction",
    ]) &&
    candidate.kind === EXECUTE_FRAME_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isCanonicalTransactionRequest(candidate.transaction)
    ? (candidate as unknown as ExecuteFrameRequest)
    : null;
}

export function parseFrameExecuteResult(
  value: unknown,
): FrameExecuteResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "result",
      "undo_available",
      "diagnostics",
    ]) &&
    candidate.kind === FRAME_EXECUTE_RESULT_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    isCanonicalDriverResult(candidate.result) &&
    typeof candidate.undo_available === "boolean" &&
    isCanonicalDriverDiagnostics(candidate.diagnostics)
    ? (candidate as unknown as FrameExecuteResult)
    : null;
}

export function parseExecuteTabResult(value: unknown): ExecuteTabResult | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "outcome",
    ]) ||
    candidate.kind !== EXECUTE_TAB_RESULT_KIND ||
    candidate.protocolVersion !== DRIVER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId)
  ) {
    return null;
  }
  const outcome = record(candidate.outcome);
  if (outcome === null || typeof outcome.status !== "string") {
    return null;
  }
  if (outcome.status === "FRAME_UNAVAILABLE") {
    return hasClosedKeys(outcome, ["status"])
      ? (candidate as unknown as ExecuteTabResult)
      : null;
  }
  return outcome.status === "COMPLETED" &&
    hasClosedKeys(outcome, [
      "status",
      "result",
      "undo_available",
      "diagnostics",
    ]) &&
    isCanonicalDriverResult(outcome.result) &&
    typeof outcome.undo_available === "boolean" &&
    isCanonicalDriverDiagnostics(outcome.diagnostics)
    ? (candidate as unknown as ExecuteTabResult)
    : null;
}

export function buildUndoTabRequest(
  requestId: string,
  tabId: number,
  undo: UndoTransactionRequest,
): UndoTabRequest {
  return {
    kind: UNDO_TAB_KIND,
    protocolVersion: DRIVER_PROTOCOL_VERSION,
    requestId,
    tabId,
    undo,
  };
}

export function parseUndoTabRequest(value: unknown): UndoTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "undo",
    ]) &&
    candidate.kind === UNDO_TAB_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isSafeNonNegativeInteger(candidate.tabId) &&
    isUndoRequest(candidate.undo)
    ? (candidate as unknown as UndoTabRequest)
    : null;
}

export function parseUndoFrameRequest(value: unknown): UndoFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "undo",
    ]) &&
    candidate.kind === UNDO_FRAME_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isUndoRequest(candidate.undo)
    ? (candidate as unknown as UndoFrameRequest)
    : null;
}

function parseUndoOutcome(value: unknown): boolean {
  const outcome = record(value);
  if (outcome === null || typeof outcome.status !== "string") {
    return false;
  }
  if (
    outcome.status === "UNKNOWN_TRANSACTION" ||
    outcome.status === "ALREADY_CONSUMED"
  ) {
    return hasClosedKeys(outcome, ["status"]);
  }
  return (
    outcome.status === "COMPLETED" &&
    hasClosedKeys(outcome, ["status", "result", "diagnostics"]) &&
    isCanonicalDriverResult(outcome.result) &&
    isCanonicalDriverDiagnostics(outcome.diagnostics)
  );
}

export function parseFrameUndoResult(value: unknown): FrameUndoResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "outcome",
    ]) &&
    candidate.kind === FRAME_UNDO_RESULT_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    parseUndoOutcome(candidate.outcome)
    ? (candidate as unknown as FrameUndoResult)
    : null;
}

export function parseUndoTabResult(value: unknown): UndoTabResult | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "outcome",
    ]) ||
    candidate.kind !== UNDO_TAB_RESULT_KIND ||
    candidate.protocolVersion !== DRIVER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId)
  ) {
    return null;
  }
  const outcome = record(candidate.outcome);
  if (outcome === null) {
    return null;
  }
  if (
    outcome.status === "FRAME_UNAVAILABLE" &&
    hasClosedKeys(outcome, ["status"])
  ) {
    return candidate as unknown as UndoTabResult;
  }
  return parseUndoOutcome(outcome)
    ? (candidate as unknown as UndoTabResult)
    : null;
}

export function buildIdentifyNavTabRequest(
  requestId: string,
  tabId: number,
): IdentifyNavTabRequest {
  return {
    kind: IDENTIFY_NAV_TAB_KIND,
    protocolVersion: DRIVER_PROTOCOL_VERSION,
    requestId,
    tabId,
  };
}

export function parseIdentifyNavTabRequest(
  value: unknown,
): IdentifyNavTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
    ]) &&
    candidate.kind === IDENTIFY_NAV_TAB_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isSafeNonNegativeInteger(candidate.tabId)
    ? (candidate as unknown as IdentifyNavTabRequest)
    : null;
}

export function parseIdentifyNavFrameRequest(
  value: unknown,
): IdentifyNavFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, ["kind", "protocolVersion", "requestId"]) &&
    candidate.kind === IDENTIFY_NAV_FRAME_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId)
    ? (candidate as unknown as IdentifyNavFrameRequest)
    : null;
}

function isNavigationIdentification(
  value: unknown,
): value is NavigationIdentification {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(
      candidate,
      ["status", "candidate_count"],
      ["candidate_name_digest"],
    ) ||
    !isSafeNonNegativeInteger(candidate.candidate_count) ||
    (candidate.candidate_name_digest !== undefined &&
      !isDigest(candidate.candidate_name_digest))
  ) {
    return false;
  }
  switch (candidate.status) {
    case "UNIQUE_SAFE_CANDIDATE":
      return (
        candidate.candidate_count === 1 &&
        candidate.candidate_name_digest !== undefined
      );
    case "AMBIGUOUS":
      return candidate.candidate_count > 1;
    case "MISSING":
      return (
        candidate.candidate_count === 0 &&
        candidate.candidate_name_digest === undefined
      );
    case "UNSAFE":
      return candidate.candidate_count >= 1;
    default:
      return false;
  }
}

export function parseFrameNavResult(value: unknown): FrameNavResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "identification",
    ]) &&
    candidate.kind === FRAME_NAV_RESULT_KIND &&
    candidate.protocolVersion === DRIVER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    isNavigationIdentification(candidate.identification)
    ? (candidate as unknown as FrameNavResult)
    : null;
}

export function parseIdentifyNavTabResult(
  value: unknown,
): IdentifyNavTabResult | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "outcome",
    ]) ||
    candidate.kind !== IDENTIFY_NAV_TAB_RESULT_KIND ||
    candidate.protocolVersion !== DRIVER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId)
  ) {
    return null;
  }
  const outcome = record(candidate.outcome);
  if (outcome === null || typeof outcome.status !== "string") {
    return null;
  }
  if (outcome.status === "FRAME_UNAVAILABLE") {
    return hasClosedKeys(outcome, ["status"])
      ? (candidate as unknown as IdentifyNavTabResult)
      : null;
  }
  return outcome.status === "COMPLETED" &&
    hasClosedKeys(outcome, ["status", "identification"]) &&
    isNavigationIdentification(outcome.identification)
    ? (candidate as unknown as IdentifyNavTabResult)
    : null;
}
