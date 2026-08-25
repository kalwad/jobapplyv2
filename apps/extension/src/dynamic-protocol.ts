// M02-W11 dynamic-state/reconciliation protocol (spec §5.11 M02-W11;
// REQ-FORM-018/REQ-FORM-024 feasibility portions).
//
// This is the ONLY privileged wire surface W11 adds, and every function is
// bounded: start/stop of the frame's application-root observation, one
// bounded already-authorized decision-execution pass routed through the
// accepted W10 transaction boundary with duplicate-action suppression, one
// reconciliation pass reported through the canonical generated
// reconciliation-inventory contract, and one read-only instrumentation
// snapshot. Every message is a closed typed record parsed fail-closed
// exactly like the W08/W10 protocols; no selector, script, DOM command,
// arbitrary observer configuration, navigation, submission, filesystem,
// native-host, database, or model operation is representable. Snapshots
// carry only counters, enum tokens, and generation integers — never a raw
// applicant value, label, selector, or DOM fragment.
import type {
  FormDriverResultV1,
  FormReconciliationInventoryV1,
} from "@japp/contracts/generated";

import {
  isCanonicalDriverDiagnostics,
  isCanonicalDriverResult,
  isCanonicalTransactionRequest,
  type DriverDiagnostics,
  type DriverTransactionRequest,
} from "./driver-protocol.ts";
import type { FrameContext } from "./scanner-protocol.ts";

export const DYNAMIC_PROTOCOL_VERSION = 1;

export const DYNAMIC_START_TAB_KIND = "M02_W11_START_TAB";
export const DYNAMIC_START_FRAME_KIND = "M02_W11_START_FRAME";
export const DYNAMIC_FRAME_START_RESULT_KIND = "M02_W11_FRAME_START_RESULT";
export const DYNAMIC_START_TAB_RESULT_KIND = "M02_W11_START_RESULT";
export const DYNAMIC_STOP_TAB_KIND = "M02_W11_STOP_TAB";
export const DYNAMIC_STOP_FRAME_KIND = "M02_W11_STOP_FRAME";
export const DYNAMIC_FRAME_STOP_RESULT_KIND = "M02_W11_FRAME_STOP_RESULT";
export const DYNAMIC_STOP_TAB_RESULT_KIND = "M02_W11_STOP_RESULT";
export const DYNAMIC_EXECUTE_TAB_KIND = "M02_W11_EXECUTE_TAB";
export const DYNAMIC_EXECUTE_FRAME_KIND = "M02_W11_EXECUTE_FRAME";
export const DYNAMIC_FRAME_EXECUTE_RESULT_KIND = "M02_W11_FRAME_EXECUTE_RESULT";
export const DYNAMIC_EXECUTE_TAB_RESULT_KIND = "M02_W11_EXECUTE_RESULT";
export const DYNAMIC_RECONCILE_TAB_KIND = "M02_W11_RECONCILE_TAB";
export const DYNAMIC_RECONCILE_FRAME_KIND = "M02_W11_RECONCILE_FRAME";
export const DYNAMIC_FRAME_RECONCILE_RESULT_KIND =
  "M02_W11_FRAME_RECONCILE_RESULT";
export const DYNAMIC_RECONCILE_TAB_RESULT_KIND = "M02_W11_RECONCILE_RESULT";
export const DYNAMIC_STATE_TAB_KIND = "M02_W11_STATE_TAB";
export const DYNAMIC_STATE_FRAME_KIND = "M02_W11_STATE_FRAME";
export const DYNAMIC_FRAME_STATE_RESULT_KIND = "M02_W11_FRAME_STATE_RESULT";
export const DYNAMIC_STATE_TAB_RESULT_KIND = "M02_W11_STATE_RESULT";

/** Transactions one bounded execute-decisions pass may carry. */
export const MAX_EXECUTE_ITEMS = 32;
/** Bounded duplicate-action ledger entries retained per frame agent. */
export const MAX_LEDGER_ENTRIES = 128;
/** Bounded executed-transaction registry entries retained per frame agent. */
export const MAX_REGISTRY_ENTRIES = 128;
/** Items one canonical reconciliation inventory may carry (schema bound). */
export const MAX_INVENTORY_ITEMS = 512;

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const STABLE_ID_PATTERN = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

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

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
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

// ---------------------------------------------------------------------------
// Instrumentation snapshot
// ---------------------------------------------------------------------------

export type ObservationState = "IDLE" | "OBSERVING";

export interface DynamicGenerations {
  readonly route_generation: number;
  readonly page_generation: number;
  readonly dom_observation_generation: number;
  readonly root_generation: number;
}

/**
 * Truthful memory capability: real Chromium heap numbers when the runtime
 * exposes them, and an explicit unavailable marker otherwise. Unavailable is
 * NEVER converted into zero.
 */
export type MemoryProbe =
  | {
      readonly available: true;
      readonly used_js_heap_bytes: number;
      readonly total_js_heap_bytes: number;
    }
  | { readonly available: false };

/**
 * Truthful in-page CPU capability. A Manifest V3 content script has no real
 * process-CPU API, so the in-page probe honestly reports unavailable; real
 * CPU measurement for the W11 feasibility evidence comes from the harness
 * boundary (Playwright CDP `Performance.getMetrics` TaskDuration) and is
 * recorded in the browser matrix, never fabricated here.
 */
export interface CpuProbe {
  readonly available: false;
  readonly reason: "NO_IN_PAGE_PROCESS_CPU_SOURCE";
}

const SNAPSHOT_COUNTER_KEYS = [
  "mutation_callbacks",
  "mutation_records",
  "records_during_action",
  "batches_processed",
  "batches_action_origin",
  "affected_subtree_scans",
  "root_rescans",
  "root_rescans_route_changed",
  "root_rescans_root_replaced",
  "root_rescans_overflow",
  "root_rescans_observation_start",
  "full_document_scans",
  "nodes_considered",
  "descriptors_produced",
  "conditional_fields_discovered",
  "conditional_fields_removed",
  "inventory_size",
  "ledger_size",
  "registry_size",
  "queue_length",
  "max_queue_length",
  "actions_considered",
  "actions_executed",
  "actions_suppressed_duplicate",
  "page_changed_detected",
  "reconciliation_passes",
  "last_batch_duration_ms",
  "last_reconciliation_duration_ms",
  "total_scan_duration_ms",
] as const;

export type SnapshotCounterKey = (typeof SNAPSHOT_COUNTER_KEYS)[number];

export type DynamicInstrumentationSnapshot = {
  readonly observation_state: ObservationState;
  readonly generations: DynamicGenerations;
  readonly memory: MemoryProbe;
  readonly cpu: CpuProbe;
} & Readonly<Record<SnapshotCounterKey, number>>;

function isGenerations(value: unknown): value is DynamicGenerations {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "route_generation",
      "page_generation",
      "dom_observation_generation",
      "root_generation",
    ]) &&
    isCount(candidate.route_generation) &&
    isCount(candidate.page_generation) &&
    isCount(candidate.dom_observation_generation) &&
    isCount(candidate.root_generation)
  );
}

function isMemoryProbe(value: unknown): value is MemoryProbe {
  const candidate = record(value);
  if (candidate === null) {
    return false;
  }
  if (candidate.available === false) {
    return hasClosedKeys(candidate, ["available"]);
  }
  return (
    candidate.available === true &&
    hasClosedKeys(candidate, [
      "available",
      "used_js_heap_bytes",
      "total_js_heap_bytes",
    ]) &&
    isCount(candidate.used_js_heap_bytes) &&
    isCount(candidate.total_js_heap_bytes)
  );
}

function isCpuProbe(value: unknown): value is CpuProbe {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["available", "reason"]) &&
    candidate.available === false &&
    candidate.reason === "NO_IN_PAGE_PROCESS_CPU_SOURCE"
  );
}

export function isCanonicalInstrumentationSnapshot(
  value: unknown,
): value is DynamicInstrumentationSnapshot {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "observation_state",
      "generations",
      "memory",
      "cpu",
      ...SNAPSHOT_COUNTER_KEYS,
    ]) ||
    !["IDLE", "OBSERVING"].includes(String(candidate.observation_state)) ||
    !isGenerations(candidate.generations) ||
    !isMemoryProbe(candidate.memory) ||
    !isCpuProbe(candidate.cpu) ||
    !SNAPSHOT_COUNTER_KEYS.every((key) => isCount(candidate[key]))
  ) {
    return false;
  }
  // Every bounded root rescan carries exactly one recorded reason.
  const reasons =
    Number(candidate.root_rescans_route_changed) +
    Number(candidate.root_rescans_root_replaced) +
    Number(candidate.root_rescans_overflow) +
    Number(candidate.root_rescans_observation_start);
  return candidate.root_rescans === reasons;
}

// ---------------------------------------------------------------------------
// Canonical reconciliation inventory (fail-closed mirror)
// ---------------------------------------------------------------------------

const RECONCILIATION_CATEGORIES = [
  "BLOCKED_SENSITIVE",
  "NEEDS_REVIEW",
  "PAGE_CHANGED_VALUE",
  "REQUIRED_UNRESOLVED",
  "UNSUPPORTED_OR_SKIPPED",
  "VERIFIED_FILLED",
] as const;
const CONFIRMATION_STATES = [
  "CONFIRMED",
  "EXPIRED",
  "MISSING",
  "NOT_APPLICABLE",
  "REVOKED",
] as const;
const DOCUMENT_STATES = ["CURRENT", "NOT_APPLICABLE", "STALE"] as const;

function isInventoryItem(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "item_id",
      "field_id",
      "field_address_digest",
      "required",
      "visible",
      "enabled",
      "category",
      "document_state",
      "changed_value",
      "confirmation_state",
      "mandatory_uncertain",
    ]) &&
    isStableId(candidate.item_id) &&
    isStableId(candidate.field_id) &&
    isDigest(candidate.field_address_digest) &&
    typeof candidate.required === "boolean" &&
    typeof candidate.visible === "boolean" &&
    typeof candidate.enabled === "boolean" &&
    (RECONCILIATION_CATEGORIES as readonly string[]).includes(
      String(candidate.category),
    ) &&
    (DOCUMENT_STATES as readonly string[]).includes(
      String(candidate.document_state),
    ) &&
    typeof candidate.changed_value === "boolean" &&
    (CONFIRMATION_STATES as readonly string[]).includes(
      String(candidate.confirmation_state),
    ) &&
    typeof candidate.mandatory_uncertain === "boolean"
  );
}

/**
 * Strict closed validation of a wire FormReconciliationInventoryV1,
 * INCLUDING the canonical RECONCILIATION_READINESS semantic rule
 * (packages/contracts/generator/semantic-rules.ts): every claimed count is
 * recomputed from the items, `changed_value` is true exactly for
 * PAGE_CHANGED_VALUE items, a required visible enabled item is only ever
 * VERIFIED_FILLED / REQUIRED_UNRESOLVED / BLOCKED_SENSITIVE, and READY
 * additionally requires page_generation == proof_generation with zero
 * required-unresolved, blocked-sensitive, page-changed, stale-document,
 * unconfirmed-consequential, and mandatory-uncertain items. The permanent
 * unit matrix pins agreement with the generated canonical validator and
 * semantic-rule evaluator.
 */
export function isCanonicalReconciliationInventory(
  value: unknown,
): value is FormReconciliationInventoryV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "inventory_id",
      "session_id",
      "page_id",
      "document_id",
      "page_generation",
      "proof_generation",
      "items",
      "counts",
      "readiness",
      "evidence_digest",
      "correlation_id",
    ]) ||
    !isStableId(candidate.inventory_id) ||
    !isStableId(candidate.session_id) ||
    !isStableId(candidate.page_id) ||
    !isStableId(candidate.document_id) ||
    !isCount(candidate.page_generation) ||
    !isCount(candidate.proof_generation) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length > MAX_INVENTORY_ITEMS ||
    !candidate.items.every(isInventoryItem) ||
    !["NOT_READY", "READY"].includes(String(candidate.readiness)) ||
    !isDigest(candidate.evidence_digest) ||
    !isStableId(candidate.correlation_id)
  ) {
    return false;
  }
  const items = candidate.items as Record<string, unknown>[];
  const itemIds = items.map((item) => item.item_id);
  if (new Set(itemIds).size !== itemIds.length) {
    return false;
  }
  const counts = record(candidate.counts);
  if (
    counts === null ||
    !hasClosedKeys(counts, [
      "total",
      "verified_filled",
      "needs_review",
      "blocked_sensitive",
      "unsupported_or_skipped",
      "required_unresolved",
      "page_changed_value",
      "stale_document",
      "unconfirmed_consequential",
      "mandatory_uncertain",
    ]) ||
    !Object.values(counts).every(isCount)
  ) {
    return false;
  }
  const byCategory = (category: string): number =>
    items.filter((item) => item.category === category).length;
  if (
    counts.total !== items.length ||
    counts.verified_filled !== byCategory("VERIFIED_FILLED") ||
    counts.needs_review !== byCategory("NEEDS_REVIEW") ||
    counts.blocked_sensitive !== byCategory("BLOCKED_SENSITIVE") ||
    counts.unsupported_or_skipped !== byCategory("UNSUPPORTED_OR_SKIPPED") ||
    counts.required_unresolved !== byCategory("REQUIRED_UNRESOLVED") ||
    counts.page_changed_value !== byCategory("PAGE_CHANGED_VALUE") ||
    counts.stale_document !==
      items.filter((item) => item.document_state === "STALE").length ||
    counts.unconfirmed_consequential !==
      items.filter((item) =>
        ["EXPIRED", "MISSING", "REVOKED"].includes(
          String(item.confirmation_state),
        ),
      ).length ||
    counts.mandatory_uncertain !==
      items.filter((item) => item.mandatory_uncertain === true).length ||
    counts.page_changed_value !==
      items.filter((item) => item.changed_value === true).length
  ) {
    return false;
  }
  for (const item of items) {
    if (
      (item.changed_value === true) !==
      (item.category === "PAGE_CHANGED_VALUE")
    ) {
      return false;
    }
    if (
      item.required === true &&
      item.visible === true &&
      item.enabled === true &&
      item.category !== "VERIFIED_FILLED" &&
      item.category !== "REQUIRED_UNRESOLVED" &&
      item.category !== "BLOCKED_SENSITIVE"
    ) {
      return false;
    }
  }
  if (candidate.readiness !== "READY") {
    return true;
  }
  return (
    candidate.page_generation === candidate.proof_generation &&
    counts.required_unresolved === 0 &&
    counts.blocked_sensitive === 0 &&
    counts.page_changed_value === 0 &&
    counts.stale_document === 0 &&
    counts.unconfirmed_consequential === 0 &&
    counts.mandatory_uncertain === 0
  );
}

// ---------------------------------------------------------------------------
// Start / stop observation
// ---------------------------------------------------------------------------

export interface DynamicStartTabRequest {
  readonly kind: typeof DYNAMIC_START_TAB_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly frame_id: string;
}

export interface DynamicStartFrameRequest {
  readonly kind: typeof DYNAMIC_START_FRAME_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
}

export type DynamicStartOutcome =
  | {
      readonly status: "STARTED" | "ALREADY_OBSERVING";
      readonly snapshot: DynamicInstrumentationSnapshot;
    }
  | {
      readonly status: "ROOT_UNRESOLVED" | "ROOT_AMBIGUOUS";
      readonly candidate_count: number;
      readonly snapshot: DynamicInstrumentationSnapshot;
    };

export interface DynamicFrameStartResult {
  readonly kind: typeof DYNAMIC_FRAME_START_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly outcome: DynamicStartOutcome;
}

export interface DynamicStartTabResult {
  readonly kind: typeof DYNAMIC_START_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    DynamicStartOutcome | { readonly status: "FRAME_UNAVAILABLE" };
}

export interface DynamicStopTabRequest {
  readonly kind: typeof DYNAMIC_STOP_TAB_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly frame_id: string;
}

export interface DynamicStopFrameRequest {
  readonly kind: typeof DYNAMIC_STOP_FRAME_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
}

export interface DynamicStopOutcome {
  readonly status: "STOPPED" | "NOT_OBSERVING";
  readonly snapshot: DynamicInstrumentationSnapshot;
}

export interface DynamicFrameStopResult {
  readonly kind: typeof DYNAMIC_FRAME_STOP_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly outcome: DynamicStopOutcome;
}

export interface DynamicStopTabResult {
  readonly kind: typeof DYNAMIC_STOP_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    DynamicStopOutcome | { readonly status: "FRAME_UNAVAILABLE" };
}

// ---------------------------------------------------------------------------
// Execute already-authorized decisions with duplicate suppression
// ---------------------------------------------------------------------------

export interface DynamicExecuteTabRequest {
  readonly kind: typeof DYNAMIC_EXECUTE_TAB_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly items: readonly DriverTransactionRequest[];
}

export interface DynamicExecuteFrameRequest {
  readonly kind: typeof DYNAMIC_EXECUTE_FRAME_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
  readonly items: readonly DriverTransactionRequest[];
}

export type DynamicExecuteItemOutcome =
  | {
      readonly status: "EXECUTED";
      readonly result: FormDriverResultV1;
      readonly undo_available: boolean;
      readonly diagnostics: DriverDiagnostics;
    }
  | {
      readonly status: "DUPLICATE_SUPPRESSED" | "PRIOR_ATTEMPT_EXISTS";
      readonly prior_outcome: FormDriverResultV1["outcome"];
    }
  | { readonly status: "PAGE_CHANGED_VALUE_DETECTED" }
  | {
      readonly status: "STALE_EVIDENCE";
      readonly resolution: "AMBIGUOUS" | "MISSING" | "STALE";
    };

export interface DynamicFrameExecuteResult {
  readonly kind: typeof DYNAMIC_FRAME_EXECUTE_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly items: readonly DynamicExecuteItemOutcome[];
  readonly snapshot: DynamicInstrumentationSnapshot;
}

export interface DynamicExecuteTabResult {
  readonly kind: typeof DYNAMIC_EXECUTE_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    | {
        readonly status: "COMPLETED";
        readonly items: readonly DynamicExecuteItemOutcome[];
        readonly snapshot: DynamicInstrumentationSnapshot;
      }
    | { readonly status: "FRAME_UNAVAILABLE" };
}

// ---------------------------------------------------------------------------
// Reconcile / read state
// ---------------------------------------------------------------------------

export interface DynamicReconcileTabRequest {
  readonly kind: typeof DYNAMIC_RECONCILE_TAB_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly frame_id: string;
  readonly correlation_id: string;
}

export interface DynamicReconcileFrameRequest {
  readonly kind: typeof DYNAMIC_RECONCILE_FRAME_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
  readonly correlation_id: string;
}

export type DynamicReconcileOutcome =
  | {
      readonly status: "RECONCILED";
      readonly inventory: FormReconciliationInventoryV1;
      readonly snapshot: DynamicInstrumentationSnapshot;
    }
  | {
      readonly status: "ROOT_UNRESOLVED" | "ROOT_AMBIGUOUS";
      readonly candidate_count: number;
      readonly snapshot: DynamicInstrumentationSnapshot;
    };

export interface DynamicFrameReconcileResult {
  readonly kind: typeof DYNAMIC_FRAME_RECONCILE_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly outcome: DynamicReconcileOutcome;
}

export interface DynamicReconcileTabResult {
  readonly kind: typeof DYNAMIC_RECONCILE_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    DynamicReconcileOutcome | { readonly status: "FRAME_UNAVAILABLE" };
}

export interface DynamicStateTabRequest {
  readonly kind: typeof DYNAMIC_STATE_TAB_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly frame_id: string;
}

export interface DynamicStateFrameRequest {
  readonly kind: typeof DYNAMIC_STATE_FRAME_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
}

export interface DynamicFrameStateResult {
  readonly kind: typeof DYNAMIC_FRAME_STATE_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly snapshot: DynamicInstrumentationSnapshot;
}

export interface DynamicStateTabResult {
  readonly kind: typeof DYNAMIC_STATE_TAB_RESULT_KIND;
  readonly protocolVersion: typeof DYNAMIC_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly outcome:
    | {
        readonly status: "COMPLETED";
        readonly snapshot: DynamicInstrumentationSnapshot;
      }
    | { readonly status: "FRAME_UNAVAILABLE" };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildDynamicStartTabRequest(
  requestId: string,
  tabId: number,
  frameId: string,
): DynamicStartTabRequest {
  return {
    kind: DYNAMIC_START_TAB_KIND,
    protocolVersion: DYNAMIC_PROTOCOL_VERSION,
    requestId,
    tabId,
    frame_id: frameId,
  };
}

export function buildDynamicStopTabRequest(
  requestId: string,
  tabId: number,
  frameId: string,
): DynamicStopTabRequest {
  return {
    kind: DYNAMIC_STOP_TAB_KIND,
    protocolVersion: DYNAMIC_PROTOCOL_VERSION,
    requestId,
    tabId,
    frame_id: frameId,
  };
}

export function buildDynamicExecuteTabRequest(
  requestId: string,
  tabId: number,
  items: readonly DriverTransactionRequest[],
): DynamicExecuteTabRequest {
  return {
    kind: DYNAMIC_EXECUTE_TAB_KIND,
    protocolVersion: DYNAMIC_PROTOCOL_VERSION,
    requestId,
    tabId,
    items,
  };
}

export function buildDynamicReconcileTabRequest(
  requestId: string,
  tabId: number,
  frameId: string,
  correlationId: string,
): DynamicReconcileTabRequest {
  return {
    kind: DYNAMIC_RECONCILE_TAB_KIND,
    protocolVersion: DYNAMIC_PROTOCOL_VERSION,
    requestId,
    tabId,
    frame_id: frameId,
    correlation_id: correlationId,
  };
}

export function buildDynamicStateTabRequest(
  requestId: string,
  tabId: number,
  frameId: string,
): DynamicStateTabRequest {
  return {
    kind: DYNAMIC_STATE_TAB_KIND,
    protocolVersion: DYNAMIC_PROTOCOL_VERSION,
    requestId,
    tabId,
    frame_id: frameId,
  };
}

// ---------------------------------------------------------------------------
// Parsers (fail-closed)
// ---------------------------------------------------------------------------

function parseFrameTargetedTabRequest(
  value: unknown,
  kind: string,
): Record<string, unknown> | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "frame_id",
    ]) &&
    candidate.kind === kind &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isCount(candidate.tabId) &&
    isStableId(candidate.frame_id)
    ? candidate
    : null;
}

function parseDocumentScopedFrameRequest(
  value: unknown,
  kind: string,
): Record<string, unknown> | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "expected_document_id",
    ]) &&
    candidate.kind === kind &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isStableId(candidate.expected_document_id)
    ? candidate
    : null;
}

export function parseDynamicStartTabRequest(
  value: unknown,
): DynamicStartTabRequest | null {
  return parseFrameTargetedTabRequest(
    value,
    DYNAMIC_START_TAB_KIND,
  ) as DynamicStartTabRequest | null;
}

export function parseDynamicStartFrameRequest(
  value: unknown,
): DynamicStartFrameRequest | null {
  return parseDocumentScopedFrameRequest(
    value,
    DYNAMIC_START_FRAME_KIND,
  ) as DynamicStartFrameRequest | null;
}

export function parseDynamicStopTabRequest(
  value: unknown,
): DynamicStopTabRequest | null {
  return parseFrameTargetedTabRequest(
    value,
    DYNAMIC_STOP_TAB_KIND,
  ) as DynamicStopTabRequest | null;
}

export function parseDynamicStopFrameRequest(
  value: unknown,
): DynamicStopFrameRequest | null {
  return parseDocumentScopedFrameRequest(
    value,
    DYNAMIC_STOP_FRAME_KIND,
  ) as DynamicStopFrameRequest | null;
}

export function parseDynamicStateTabRequest(
  value: unknown,
): DynamicStateTabRequest | null {
  return parseFrameTargetedTabRequest(
    value,
    DYNAMIC_STATE_TAB_KIND,
  ) as DynamicStateTabRequest | null;
}

export function parseDynamicStateFrameRequest(
  value: unknown,
): DynamicStateFrameRequest | null {
  return parseDocumentScopedFrameRequest(
    value,
    DYNAMIC_STATE_FRAME_KIND,
  ) as DynamicStateFrameRequest | null;
}

function isSameFrameTransactionList(
  value: unknown,
): value is readonly DriverTransactionRequest[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_EXECUTE_ITEMS ||
    !value.every(isCanonicalTransactionRequest)
  ) {
    return false;
  }
  const transactions: readonly DriverTransactionRequest[] = value;
  const first = transactions[0];
  if (first === undefined) {
    return false;
  }
  const transactionIds = transactions.map(
    (transaction) => transaction.transaction_id,
  );
  return (
    new Set(transactionIds).size === transactionIds.length &&
    transactions.every(
      (transaction) =>
        transaction.address.session_id === first.address.session_id &&
        transaction.address.frame_id === first.address.frame_id &&
        transaction.address.document_id === first.address.document_id,
    )
  );
}

export function parseDynamicExecuteTabRequest(
  value: unknown,
): DynamicExecuteTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "items",
    ]) &&
    candidate.kind === DYNAMIC_EXECUTE_TAB_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isCount(candidate.tabId) &&
    isSameFrameTransactionList(candidate.items)
    ? (candidate as unknown as DynamicExecuteTabRequest)
    : null;
}

export function parseDynamicExecuteFrameRequest(
  value: unknown,
): DynamicExecuteFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "expected_document_id",
      "items",
    ]) &&
    candidate.kind === DYNAMIC_EXECUTE_FRAME_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isStableId(candidate.expected_document_id) &&
    isSameFrameTransactionList(candidate.items)
    ? (candidate as unknown as DynamicExecuteFrameRequest)
    : null;
}

export function parseDynamicReconcileTabRequest(
  value: unknown,
): DynamicReconcileTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "frame_id",
      "correlation_id",
    ]) &&
    candidate.kind === DYNAMIC_RECONCILE_TAB_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isCount(candidate.tabId) &&
    isStableId(candidate.frame_id) &&
    isStableId(candidate.correlation_id)
    ? (candidate as unknown as DynamicReconcileTabRequest)
    : null;
}

export function parseDynamicReconcileFrameRequest(
  value: unknown,
): DynamicReconcileFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "expected_document_id",
      "correlation_id",
    ]) &&
    candidate.kind === DYNAMIC_RECONCILE_FRAME_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isStableId(candidate.expected_document_id) &&
    isStableId(candidate.correlation_id)
    ? (candidate as unknown as DynamicReconcileFrameRequest)
    : null;
}

function isStartOutcome(value: unknown): value is DynamicStartOutcome {
  const outcome = record(value);
  if (outcome === null || typeof outcome.status !== "string") {
    return false;
  }
  if (outcome.status === "STARTED" || outcome.status === "ALREADY_OBSERVING") {
    return (
      hasClosedKeys(outcome, ["status", "snapshot"]) &&
      isCanonicalInstrumentationSnapshot(outcome.snapshot)
    );
  }
  return (
    (outcome.status === "ROOT_UNRESOLVED" ||
      outcome.status === "ROOT_AMBIGUOUS") &&
    hasClosedKeys(outcome, ["status", "candidate_count", "snapshot"]) &&
    isCount(outcome.candidate_count) &&
    isCanonicalInstrumentationSnapshot(outcome.snapshot)
  );
}

function isStopOutcome(value: unknown): value is DynamicStopOutcome {
  const outcome = record(value);
  return (
    outcome !== null &&
    (outcome.status === "STOPPED" || outcome.status === "NOT_OBSERVING") &&
    hasClosedKeys(outcome, ["status", "snapshot"]) &&
    isCanonicalInstrumentationSnapshot(outcome.snapshot)
  );
}

function isExecuteItemOutcome(
  value: unknown,
): value is DynamicExecuteItemOutcome {
  const outcome = record(value);
  if (outcome === null || typeof outcome.status !== "string") {
    return false;
  }
  switch (outcome.status) {
    case "EXECUTED":
      return (
        hasClosedKeys(outcome, [
          "status",
          "result",
          "undo_available",
          "diagnostics",
        ]) &&
        isCanonicalDriverResult(outcome.result) &&
        typeof outcome.undo_available === "boolean" &&
        isCanonicalDriverDiagnostics(outcome.diagnostics)
      );
    case "DUPLICATE_SUPPRESSED":
    case "PRIOR_ATTEMPT_EXISTS":
      return (
        hasClosedKeys(outcome, ["status", "prior_outcome"]) &&
        [
          "BLOCKED_SENSITIVE",
          "FAILED",
          "NEEDS_REVIEW",
          "UNSUPPORTED",
          "VERIFIED",
        ].includes(String(outcome.prior_outcome))
      );
    case "PAGE_CHANGED_VALUE_DETECTED":
      return hasClosedKeys(outcome, ["status"]);
    case "STALE_EVIDENCE":
      return (
        hasClosedKeys(outcome, ["status", "resolution"]) &&
        ["AMBIGUOUS", "MISSING", "STALE"].includes(String(outcome.resolution))
      );
    default:
      return false;
  }
}

function isReconcileOutcome(value: unknown): value is DynamicReconcileOutcome {
  const outcome = record(value);
  if (outcome === null || typeof outcome.status !== "string") {
    return false;
  }
  if (outcome.status === "RECONCILED") {
    return (
      hasClosedKeys(outcome, ["status", "inventory", "snapshot"]) &&
      isCanonicalReconciliationInventory(outcome.inventory) &&
      isCanonicalInstrumentationSnapshot(outcome.snapshot)
    );
  }
  return (
    (outcome.status === "ROOT_UNRESOLVED" ||
      outcome.status === "ROOT_AMBIGUOUS") &&
    hasClosedKeys(outcome, ["status", "candidate_count", "snapshot"]) &&
    isCount(outcome.candidate_count) &&
    isCanonicalInstrumentationSnapshot(outcome.snapshot)
  );
}

function parseFrameResult(
  value: unknown,
  kind: string,
  outcomeValid: (outcome: unknown) => boolean,
): Record<string, unknown> | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "outcome",
    ]) &&
    candidate.kind === kind &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    outcomeValid(candidate.outcome)
    ? candidate
    : null;
}

export function parseDynamicFrameStartResult(
  value: unknown,
): DynamicFrameStartResult | null {
  return parseFrameResult(
    value,
    DYNAMIC_FRAME_START_RESULT_KIND,
    isStartOutcome,
  ) as DynamicFrameStartResult | null;
}

export function parseDynamicFrameStopResult(
  value: unknown,
): DynamicFrameStopResult | null {
  return parseFrameResult(
    value,
    DYNAMIC_FRAME_STOP_RESULT_KIND,
    isStopOutcome,
  ) as DynamicFrameStopResult | null;
}

export function parseDynamicFrameExecuteResult(
  value: unknown,
): DynamicFrameExecuteResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "items",
      "snapshot",
    ]) &&
    candidate.kind === DYNAMIC_FRAME_EXECUTE_RESULT_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    Array.isArray(candidate.items) &&
    candidate.items.length >= 1 &&
    candidate.items.length <= MAX_EXECUTE_ITEMS &&
    candidate.items.every(isExecuteItemOutcome) &&
    isCanonicalInstrumentationSnapshot(candidate.snapshot)
    ? (candidate as unknown as DynamicFrameExecuteResult)
    : null;
}

export function parseDynamicFrameReconcileResult(
  value: unknown,
): DynamicFrameReconcileResult | null {
  return parseFrameResult(
    value,
    DYNAMIC_FRAME_RECONCILE_RESULT_KIND,
    isReconcileOutcome,
  ) as DynamicFrameReconcileResult | null;
}

export function parseDynamicFrameStateResult(
  value: unknown,
): DynamicFrameStateResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "snapshot",
    ]) &&
    candidate.kind === DYNAMIC_FRAME_STATE_RESULT_KIND &&
    candidate.protocolVersion === DYNAMIC_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isFrameContextValue(candidate.frame_context) &&
    isCanonicalInstrumentationSnapshot(candidate.snapshot)
    ? (candidate as unknown as DynamicFrameStateResult)
    : null;
}

function parseTabResult(
  value: unknown,
  kind: string,
  outcomeValid: (outcome: unknown) => boolean,
): Record<string, unknown> | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "outcome",
    ]) ||
    candidate.kind !== kind ||
    candidate.protocolVersion !== DYNAMIC_PROTOCOL_VERSION ||
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
    return candidate;
  }
  return outcomeValid(candidate.outcome) ? candidate : null;
}

export function parseDynamicStartTabResult(
  value: unknown,
): DynamicStartTabResult | null {
  return parseTabResult(
    value,
    DYNAMIC_START_TAB_RESULT_KIND,
    isStartOutcome,
  ) as DynamicStartTabResult | null;
}

export function parseDynamicStopTabResult(
  value: unknown,
): DynamicStopTabResult | null {
  return parseTabResult(
    value,
    DYNAMIC_STOP_TAB_RESULT_KIND,
    isStopOutcome,
  ) as DynamicStopTabResult | null;
}

export function parseDynamicExecuteTabResult(
  value: unknown,
): DynamicExecuteTabResult | null {
  return parseTabResult(value, DYNAMIC_EXECUTE_TAB_RESULT_KIND, (outcome) => {
    const completed = record(outcome);
    return (
      completed !== null &&
      completed.status === "COMPLETED" &&
      hasClosedKeys(completed, ["status", "items", "snapshot"]) &&
      Array.isArray(completed.items) &&
      completed.items.length >= 1 &&
      completed.items.length <= MAX_EXECUTE_ITEMS &&
      completed.items.every(isExecuteItemOutcome) &&
      isCanonicalInstrumentationSnapshot(completed.snapshot)
    );
  }) as DynamicExecuteTabResult | null;
}

export function parseDynamicReconcileTabResult(
  value: unknown,
): DynamicReconcileTabResult | null {
  return parseTabResult(
    value,
    DYNAMIC_RECONCILE_TAB_RESULT_KIND,
    isReconcileOutcome,
  ) as DynamicReconcileTabResult | null;
}

export function parseDynamicStateTabResult(
  value: unknown,
): DynamicStateTabResult | null {
  return parseTabResult(value, DYNAMIC_STATE_TAB_RESULT_KIND, (outcome) => {
    const completed = record(outcome);
    return (
      completed !== null &&
      completed.status === "COMPLETED" &&
      hasClosedKeys(completed, ["status", "snapshot"]) &&
      isCanonicalInstrumentationSnapshot(completed.snapshot)
    );
  }) as DynamicStateTabResult | null;
}
