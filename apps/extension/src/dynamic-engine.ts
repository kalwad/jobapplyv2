// M02-W11 frame-local dynamic reconciliation engine (REQ-FORM-018 and
// REQ-FORM-024 feasibility portions; spec §5.11 M02-W11).
//
// One engine instance belongs to exactly one frame agent, beside its W10
// DriverTransactionEngine. It implements the bounded incremental loop:
// observe the accepted W08 application root, coalesce mutation bursts into
// bounded batches, rescan only affected subtrees through the accepted W08
// scanner semantics, maintain the current descriptor inventory, discover
// and retire conditional fields, suppress duplicate actions over the
// accepted W10 transaction boundary, detect page-changed values against
// verified W10 evidence, reconcile every currently inventoried control into
// the canonical generated reconciliation-inventory contract, and record
// truthful bounded instrumentation.
//
// Authority boundaries it never crosses: field identity and re-resolution
// stay W08 (`resolveFieldTarget`); classification/policy/decision authority
// stays W09 (decisions arrive fully formed and are revalidated by the W10
// protocol); every action crosses the accepted W10 transaction kernel — the
// engine has no second fill path and mutates no form control itself. Hidden
// or disabled controls are never actionable and never become unresolved
// requirements. When the page is idle the engine is fully event-driven: no
// polling loop, no periodic rescan, no timer without a queued batch.
import type { FormReconciliationInventoryV1InventoryItem } from "@japp/contracts/generated";

import {
  BATCH_DEBOUNCE_MS,
  BoundedRecordQueue,
  planAffectedRegions,
} from "./dynamic-batch.ts";
import {
  MAX_EXECUTE_ITEMS,
  MAX_INVENTORY_ITEMS,
  MAX_LEDGER_ENTRIES,
  MAX_REGISTRY_ENTRIES,
  isCanonicalInstrumentationSnapshot,
  isCanonicalReconciliationInventory,
  type DynamicExecuteItemOutcome,
  type DynamicInstrumentationSnapshot,
  type DynamicReconcileOutcome,
  type DynamicStartOutcome,
  type DynamicStopOutcome,
  type MemoryProbe,
  type ObservationState,
} from "./dynamic-protocol.ts";
import {
  canonicalEvidenceOrder,
  classifyField,
  computeInventoryCounts,
  computeReadiness,
  type CurrentValueComparison,
  type ReconcileFieldEvidence,
} from "./dynamic-reconcile.ts";
import {
  canonicalJson,
  evidenceFromObservation,
  fieldAddressDigest,
  type SemanticValueEvidence,
} from "./driver-evidence.ts";
import {
  DriverTransactionEngine,
  defaultControlDrivers,
  intendedSemanticObservation,
  matchingControlDrivers,
  type DriverExecution,
} from "./driver-engine.ts";
import type { DriverTransactionRequest } from "./driver-protocol.ts";
import { readSiteAcceptance } from "./drivers/driver-dom.ts";
import {
  advanceDomGeneration,
  currentDomGeneration,
  detectApplicationRoot,
  resolveFieldTarget,
  scanCandidatePairs,
  type ScannedFieldPair,
} from "./field-scanner.ts";
import type { FrameContext } from "./scanner-protocol.ts";
import { semanticDigest, stableSemanticId } from "./semantic-identity.ts";

/** Observer configuration: bounded to structure/visibility/validation. */
const OBSERVED_ATTRIBUTES = [
  "aria-disabled",
  "aria-hidden",
  "aria-invalid",
  "aria-label",
  "aria-labelledby",
  "aria-required",
  "class",
  "disabled",
  "hidden",
  "inert",
  "required",
  "style",
  "type",
  "value",
] as const;

interface InventoryEntry {
  readonly fieldId: string;
  readonly addressDigest: string;
  descriptor: ScannedFieldPair["descriptor"];
  anchor: HTMLElement;
}

interface RegistryEntry {
  readonly transaction: DriverTransactionRequest;
  readonly outcome:
    | "BLOCKED_SENSITIVE"
    | "FAILED"
    | "NEEDS_REVIEW"
    | "UNSUPPORTED"
    | "VERIFIED";
  readonly settledEvidence: SemanticValueEvidence;
  readonly pageGeneration: number;
}

interface LedgerEntry {
  readonly outcome: RegistryEntry["outcome"];
  readonly pageGeneration: number;
}

type RootScanReason =
  "ROUTE_CHANGED" | "ROOT_REPLACED" | "OVERFLOW" | "OBSERVATION_START";

type CurrentObservation =
  | {
      readonly status: "OBSERVED";
      readonly evidence: SemanticValueEvidence;
      readonly validationRejected: boolean;
    }
  | { readonly status: "UNRESOLVED"; readonly resolution: "MISSING" | "STALE" }
  | { readonly status: "AMBIGUOUS" };

interface MutableCounters {
  mutation_callbacks: number;
  mutation_records: number;
  records_during_action: number;
  batches_processed: number;
  batches_action_origin: number;
  affected_subtree_scans: number;
  root_rescans: number;
  root_rescans_route_changed: number;
  root_rescans_root_replaced: number;
  root_rescans_overflow: number;
  root_rescans_observation_start: number;
  full_document_scans: number;
  nodes_considered: number;
  descriptors_produced: number;
  conditional_fields_discovered: number;
  conditional_fields_removed: number;
  actions_considered: number;
  actions_executed: number;
  actions_suppressed_duplicate: number;
  page_changed_detected: number;
  reconciliation_passes: number;
  last_batch_duration_ms: number;
  last_reconciliation_duration_ms: number;
  total_scan_duration_ms: number;
}

function freshCounters(): MutableCounters {
  return {
    mutation_callbacks: 0,
    mutation_records: 0,
    records_during_action: 0,
    batches_processed: 0,
    batches_action_origin: 0,
    affected_subtree_scans: 0,
    root_rescans: 0,
    root_rescans_route_changed: 0,
    root_rescans_root_replaced: 0,
    root_rescans_overflow: 0,
    root_rescans_observation_start: 0,
    full_document_scans: 0,
    nodes_considered: 0,
    descriptors_produced: 0,
    conditional_fields_discovered: 0,
    conditional_fields_removed: 0,
    actions_considered: 0,
    actions_executed: 0,
    actions_suppressed_duplicate: 0,
    page_changed_detected: 0,
    reconciliation_passes: 0,
    last_batch_duration_ms: 0,
    last_reconciliation_duration_ms: 0,
    total_scan_duration_ms: 0,
  };
}

function boundedMs(started: number): number {
  return Math.min(
    600_000,
    Math.max(0, Math.round(performance.now() - started)),
  );
}

/**
 * Truthful heap capability: real Chromium `performance.memory` numbers when
 * present, and an explicit unavailable marker otherwise. Unavailability is
 * never reported as zero.
 */
function memoryProbe(): MemoryProbe {
  const perf = performance as {
    memory?: { usedJSHeapSize?: unknown; totalJSHeapSize?: unknown };
  };
  const memory = perf.memory;
  if (
    memory !== undefined &&
    typeof memory.usedJSHeapSize === "number" &&
    Number.isSafeInteger(memory.usedJSHeapSize) &&
    memory.usedJSHeapSize >= 0 &&
    typeof memory.totalJSHeapSize === "number" &&
    Number.isSafeInteger(memory.totalJSHeapSize) &&
    memory.totalJSHeapSize >= 0
  ) {
    return {
      available: true,
      used_js_heap_bytes: memory.usedJSHeapSize,
      total_js_heap_bytes: memory.totalJSHeapSize,
    };
  }
  return { available: false };
}

function boundedMapSet<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  cap: number,
): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    map.delete(oldest);
  }
}

/**
 * Semantic duplicate-action authority key. Deliberately derived only from
 * canonical evidence — decision identity, decision↔address binding digest,
 * redacted intended-value digest, current page generation, and document
 * identity — never from a CSS selector, DOM index, or element object
 * identity. A page-generation advance therefore deliberately retires every
 * older key, and a genuinely new reviewed decision or intended value forms
 * a distinct key.
 */
export async function deriveDuplicateAuthorityKey(
  decisionId: string,
  decisionAddressDigest: string,
  intendedEvidenceDigest: string,
  pageGeneration: number,
  documentId: string,
): Promise<string> {
  return stableSemanticId(
    "dupkey",
    [
      "w11-authority-v1",
      decisionId,
      decisionAddressDigest,
      intendedEvidenceDigest,
      String(pageGeneration),
      documentId,
    ].join("\0"),
  );
}

/** One dynamic engine instance belongs to exactly one frame agent. */
export class DynamicFrameEngine {
  readonly #driverEngine: DriverTransactionEngine;
  readonly #drivers = defaultControlDrivers();
  readonly #queue = new BoundedRecordQueue<MutationRecord>();
  readonly #inventory = new Map<string, InventoryEntry>();
  readonly #registry = new Map<string, RegistryEntry>();
  readonly #ledger = new Map<string, LedgerEntry>();
  readonly #counters = freshCounters();
  #observer: MutationObserver | null = null;
  #observedRoot: HTMLElement | null = null;
  #routeSeed: string | null = null;
  #state: ObservationState = "IDLE";
  #routeGeneration = 0;
  #rootGeneration = 0;
  #domObservationGeneration = 0;
  #batchTimer: ReturnType<typeof setTimeout> | null = null;
  #batchHadActionOrigin = false;
  #actionDepth = 0;
  #processing: Promise<void> = Promise.resolve();
  #observedDocument: Document | null = null;

  constructor(driverEngine: DriverTransactionEngine) {
    this.#driverEngine = driverEngine;
  }

  /** Mark a W10 action window so its own mutations are attributed. */
  beginAction(): void {
    this.#actionDepth += 1;
  }

  endAction(): void {
    this.#actionDepth = Math.max(0, this.#actionDepth - 1);
  }

  /**
   * Record a transaction executed through the plain W10 wire path so
   * reconciliation still accounts for it. Read-only bookkeeping; no
   * authority is added or altered.
   */
  async noteExternalExecution(
    transaction: DriverTransactionRequest,
    execution: DriverExecution,
  ): Promise<void> {
    await this.#recordTransaction(
      transaction,
      execution,
      this.#observedDocument,
    );
  }

  /** Forget verified evidence for an address whose undo completed. */
  noteExternalUndo(addressDigest: string): void {
    this.#registry.delete(addressDigest);
  }

  #routeSeedOf(document: Document): string {
    return `${document.location.origin}${document.location.pathname}`;
  }

  async #recordTransaction(
    transaction: DriverTransactionRequest,
    execution: DriverExecution,
    document: Document | null,
  ): Promise<void> {
    const addressDigest = await fieldAddressDigest(transaction.address);
    const pageGeneration =
      document === null ? 0 : currentDomGeneration(document);
    boundedMapSet(
      this.#registry,
      addressDigest,
      {
        transaction,
        outcome: execution.result.outcome,
        settledEvidence: {
          semantic_digest:
            execution.result.observed_value_settled.semantic_digest,
          presence: execution.result.observed_value_settled.presence,
        },
        pageGeneration,
      },
      MAX_REGISTRY_ENTRIES,
    );
  }

  // -------------------------------------------------------------------
  // Observation lifecycle
  // -------------------------------------------------------------------

  async start(
    document: Document,
    frameContext: FrameContext,
  ): Promise<DynamicStartOutcome> {
    if (this.#state === "OBSERVING") {
      return {
        status: "ALREADY_OBSERVING",
        snapshot: this.snapshot(document),
      };
    }
    const root = detectApplicationRoot(document);
    if (root.status === "UNRESOLVED") {
      return {
        status: "ROOT_UNRESOLVED",
        candidate_count: 0,
        snapshot: this.snapshot(document),
      };
    }
    if (root.status === "AMBIGUOUS") {
      return {
        status: "ROOT_AMBIGUOUS",
        candidate_count: root.candidateCount,
        snapshot: this.snapshot(document),
      };
    }
    this.#observedDocument = document;
    this.#routeSeed = this.#routeSeedOf(document);
    this.#attachObserver(document, frameContext, root.root);
    await this.#rootScan(
      document,
      frameContext,
      root.root,
      "OBSERVATION_START",
    );
    this.#state = "OBSERVING";
    return { status: "STARTED", snapshot: this.snapshot(document) };
  }

  stop(document: Document): DynamicStopOutcome {
    if (this.#state !== "OBSERVING") {
      return { status: "NOT_OBSERVING", snapshot: this.snapshot(document) };
    }
    this.#detachObserver();
    this.#queue.clear();
    if (this.#batchTimer !== null) {
      clearTimeout(this.#batchTimer);
      this.#batchTimer = null;
    }
    this.#state = "IDLE";
    return { status: "STOPPED", snapshot: this.snapshot(document) };
  }

  #attachObserver(
    document: Document,
    frameContext: FrameContext,
    root: HTMLElement,
  ): void {
    this.#detachObserver();
    const observer = new MutationObserver((records) => {
      this.#counters.mutation_callbacks += 1;
      this.#counters.mutation_records += records.length;
      if (this.#actionDepth > 0) {
        this.#counters.records_during_action += records.length;
        this.#batchHadActionOrigin = true;
      }
      for (const record of records) {
        this.#queue.enqueue(record);
      }
      if (this.#batchTimer === null) {
        this.#batchTimer = setTimeout(() => {
          this.#batchTimer = null;
          this.#processing = this.#processing.then(() =>
            this.#processBatch(document, frameContext),
          );
        }, BATCH_DEBOUNCE_MS);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...OBSERVED_ATTRIBUTES],
      characterData: true,
    });
    this.#observer = observer;
    this.#observedRoot = root;
  }

  #detachObserver(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observedRoot = null;
  }

  /** Flush any queued batch deterministically before a synchronous read. */
  async #flushPendingBatch(
    document: Document,
    frameContext: FrameContext,
  ): Promise<void> {
    if (this.#batchTimer !== null) {
      clearTimeout(this.#batchTimer);
      this.#batchTimer = null;
      this.#processing = this.#processing.then(() =>
        this.#processBatch(document, frameContext),
      );
    }
    await this.#processing;
    if (this.#queue.length > 0) {
      // Records that arrived after the flush began.
      this.#processing = this.#processing.then(() =>
        this.#processBatch(document, frameContext),
      );
      await this.#processing;
    }
  }

  // -------------------------------------------------------------------
  // Structural revalidation and bounded scanning
  // -------------------------------------------------------------------

  /**
   * Minimal structural validity check: route seed comparison plus root
   * connectivity. A full root rediscovery runs only when one of those two
   * explicitly invalidates — never as routine batch work.
   */
  async #revalidateStructure(
    document: Document,
    frameContext: FrameContext,
  ): Promise<"UNCHANGED" | "INVALIDATED" | "ROOT_LOST"> {
    const routeChanged =
      this.#routeSeed !== null &&
      this.#routeSeed !== this.#routeSeedOf(document);
    const rootDisconnected =
      this.#observedRoot !== null && !this.#observedRoot.isConnected;
    const rootMissing = this.#observedRoot === null;
    if (!routeChanged && !rootDisconnected && !rootMissing) {
      return "UNCHANGED";
    }
    const reason: RootScanReason = routeChanged
      ? "ROUTE_CHANGED"
      : "ROOT_REPLACED";
    if (routeChanged || rootDisconnected) {
      // A repeated failed rediscovery (rootMissing) is not a new
      // invalidation event and must not advance generations again.
      this.#invalidatePageState(document, routeChanged);
    }
    const root = detectApplicationRoot(document);
    if (root.status !== "FOUND") {
      this.#detachObserver();
      this.#queue.clear();
      this.#inventory.clear();
      return "ROOT_LOST";
    }
    this.#rootGeneration += 1;
    if (this.#state === "OBSERVING") {
      this.#attachObserver(document, frameContext, root.root);
    } else {
      this.#observedRoot = root.root;
    }
    await this.#rootScan(document, frameContext, root.root, reason);
    return "INVALIDATED";
  }

  #invalidatePageState(document: Document, routeChanged: boolean): void {
    advanceDomGeneration(document);
    if (routeChanged) {
      this.#routeGeneration += 1;
      this.#routeSeed = this.#routeSeedOf(document);
    }
    const pageGeneration = currentDomGeneration(document);
    // Older-generation duplicate-action authority evaporates deliberately.
    for (const [key, entry] of [...this.#ledger]) {
      if (entry.pageGeneration !== pageGeneration) {
        this.#ledger.delete(key);
      }
    }
    this.#queue.clear();
  }

  async #rootScan(
    document: Document,
    frameContext: FrameContext,
    root: HTMLElement,
    reason: RootScanReason,
  ): Promise<void> {
    const started = performance.now();
    this.#counters.root_rescans += 1;
    switch (reason) {
      case "ROUTE_CHANGED":
        this.#counters.root_rescans_route_changed += 1;
        break;
      case "ROOT_REPLACED":
        this.#counters.root_rescans_root_replaced += 1;
        break;
      case "OVERFLOW":
        this.#counters.root_rescans_overflow += 1;
        break;
      case "OBSERVATION_START":
        this.#counters.root_rescans_observation_start += 1;
        break;
    }
    this.#counters.nodes_considered += 1 + root.querySelectorAll("*").length;
    const pairs = await scanCandidatePairs(document, root, root, frameContext);
    this.#counters.descriptors_produced += pairs.length;
    const previousIds = new Set(this.#inventory.keys());
    const seed = reason === "OBSERVATION_START";
    this.#inventory.clear();
    for (const pair of pairs) {
      if (this.#inventory.size >= MAX_INVENTORY_ITEMS) {
        break;
      }
      const fieldId = pair.descriptor.field_id;
      if (!seed && !previousIds.has(fieldId)) {
        this.#counters.conditional_fields_discovered += 1;
      }
      this.#inventory.set(fieldId, {
        fieldId,
        addressDigest: await fieldAddressDigest(pair.descriptor.address),
        descriptor: pair.descriptor,
        anchor: pair.candidate.anchor,
      });
    }
    if (!seed) {
      for (const previousId of previousIds) {
        if (!this.#inventory.has(previousId)) {
          this.#counters.conditional_fields_removed += 1;
        }
      }
    }
    this.#counters.total_scan_duration_ms += boundedMs(started);
    this.#domObservationGeneration += 1;
  }

  async #processBatch(
    document: Document,
    frameContext: FrameContext,
  ): Promise<void> {
    const started = performance.now();
    const { records, overflowed } = this.#queue.drain();
    const actionOrigin = this.#batchHadActionOrigin;
    this.#batchHadActionOrigin = false;
    if (this.#state !== "OBSERVING") {
      return;
    }
    this.#counters.batches_processed += 1;
    if (actionOrigin) {
      this.#counters.batches_action_origin += 1;
    }
    const structure = await this.#revalidateStructure(document, frameContext);
    if (structure !== "UNCHANGED") {
      this.#counters.last_batch_duration_ms = boundedMs(started);
      return;
    }
    const root = this.#observedRoot;
    if (root === null) {
      return;
    }
    const regionCandidates: Element[] = [];
    for (const mutationRecord of records) {
      const target = mutationRecord.target;
      const region = target instanceof Element ? target : target.parentElement;
      if (
        region === null ||
        !region.isConnected ||
        (region !== root && !root.contains(region))
      ) {
        continue;
      }
      regionCandidates.push(region);
    }
    const plan = planAffectedRegions(
      regionCandidates,
      (parent, child) => parent === child || parent.contains(child),
    );
    if (overflowed || plan.escalateToRoot) {
      await this.#rootScan(document, frameContext, root, "OVERFLOW");
    } else {
      let relevant = false;
      for (const region of plan.regions) {
        this.#counters.affected_subtree_scans += 1;
        this.#counters.nodes_considered +=
          1 + region.querySelectorAll("*").length;
        const pairs = await scanCandidatePairs(
          document,
          root,
          region instanceof HTMLElement ? region : root,
          frameContext,
        );
        this.#counters.descriptors_produced += pairs.length;
        this.#mergeRegion(region, pairs, await this.#digestsFor(pairs));
        relevant = true;
      }
      this.#pruneDisconnectedInventory(root);
      if (relevant) {
        this.#domObservationGeneration += 1;
      }
    }
    const elapsed = boundedMs(started);
    this.#counters.last_batch_duration_ms = elapsed;
    this.#counters.total_scan_duration_ms += elapsed;
  }

  async #digestsFor(
    pairs: readonly ScannedFieldPair[],
  ): Promise<ReadonlyMap<string, string>> {
    const digests = new Map<string, string>();
    for (const pair of pairs) {
      digests.set(
        pair.descriptor.field_id,
        await fieldAddressDigest(pair.descriptor.address),
      );
    }
    return digests;
  }

  #mergeRegion(
    region: Element,
    pairs: readonly ScannedFieldPair[],
    digests: ReadonlyMap<string, string>,
  ): void {
    const currentIds = new Set(pairs.map((pair) => pair.descriptor.field_id));
    for (const [fieldId, entry] of [...this.#inventory]) {
      const inRegion = region === entry.anchor || region.contains(entry.anchor);
      if (inRegion && !currentIds.has(fieldId)) {
        this.#inventory.delete(fieldId);
        this.#counters.conditional_fields_removed += 1;
      }
    }
    for (const pair of pairs) {
      const fieldId = pair.descriptor.field_id;
      const existing = this.#inventory.get(fieldId);
      if (existing !== undefined) {
        existing.descriptor = pair.descriptor;
        existing.anchor = pair.candidate.anchor;
        continue;
      }
      if (this.#inventory.size >= MAX_INVENTORY_ITEMS) {
        continue;
      }
      const addressDigest = digests.get(fieldId);
      if (addressDigest === undefined) {
        continue;
      }
      this.#inventory.set(fieldId, {
        fieldId,
        addressDigest,
        descriptor: pair.descriptor,
        anchor: pair.candidate.anchor,
      });
      this.#counters.conditional_fields_discovered += 1;
    }
  }

  #pruneDisconnectedInventory(root: HTMLElement): void {
    for (const [fieldId, entry] of [...this.#inventory]) {
      if (!entry.anchor.isConnected || !root.contains(entry.anchor)) {
        this.#inventory.delete(fieldId);
        this.#counters.conditional_fields_removed += 1;
      }
    }
  }

  // -------------------------------------------------------------------
  // Duplicate-suppressed decision execution
  // -------------------------------------------------------------------

  async executeDecisions(
    document: Document,
    frameContext: FrameContext,
    items: readonly DriverTransactionRequest[],
  ): Promise<readonly DynamicExecuteItemOutcome[]> {
    this.#observedDocument = document;
    if (this.#state === "OBSERVING") {
      await this.#flushPendingBatch(document, frameContext);
      await this.#revalidateStructure(document, frameContext);
    }
    const outcomes: DynamicExecuteItemOutcome[] = [];
    for (const transaction of items.slice(0, MAX_EXECUTE_ITEMS)) {
      outcomes.push(
        await this.#executeOne(document, frameContext, transaction),
      );
    }
    return outcomes;
  }

  async #authorityKey(
    document: Document,
    frameContext: FrameContext,
    transaction: DriverTransactionRequest,
  ): Promise<string> {
    const intendedEvidence = await evidenceFromObservation(
      intendedSemanticObservation(transaction.intended),
    );
    return deriveDuplicateAuthorityKey(
      transaction.decision.decision_id,
      transaction.decision.field_address_digest,
      intendedEvidence.semantic_digest,
      currentDomGeneration(document),
      frameContext.document_id,
    );
  }

  async #executeOne(
    document: Document,
    frameContext: FrameContext,
    transaction: DriverTransactionRequest,
  ): Promise<DynamicExecuteItemOutcome> {
    this.#counters.actions_considered += 1;
    const key = await this.#authorityKey(document, frameContext, transaction);
    const prior = this.#ledger.get(key);
    if (prior !== undefined) {
      if (prior.outcome !== "VERIFIED") {
        this.#counters.actions_suppressed_duplicate += 1;
        return { status: "PRIOR_ATTEMPT_EXISTS", prior_outcome: prior.outcome };
      }
      const observation = await this.#observeCurrent(
        document,
        frameContext,
        transaction,
      );
      if (observation.status === "AMBIGUOUS") {
        return { status: "STALE_EVIDENCE", resolution: "AMBIGUOUS" };
      }
      if (observation.status === "UNRESOLVED") {
        return { status: "STALE_EVIDENCE", resolution: observation.resolution };
      }
      const addressDigest = await fieldAddressDigest(transaction.address);
      const settled = this.#registry.get(addressDigest)?.settledEvidence;
      if (
        settled?.semantic_digest === observation.evidence.semantic_digest &&
        settled.presence === observation.evidence.presence
      ) {
        this.#counters.actions_suppressed_duplicate += 1;
        return { status: "DUPLICATE_SUPPRESSED", prior_outcome: "VERIFIED" };
      }
      this.#counters.page_changed_detected += 1;
      return { status: "PAGE_CHANGED_VALUE_DETECTED" };
    }
    this.#counters.actions_executed += 1;
    this.beginAction();
    let execution: DriverExecution;
    try {
      execution = await this.#driverEngine.execute(
        document,
        frameContext,
        transaction,
      );
    } finally {
      this.endAction();
    }
    boundedMapSet(
      this.#ledger,
      key,
      {
        outcome: execution.result.outcome,
        pageGeneration: currentDomGeneration(document),
      },
      MAX_LEDGER_ENTRIES,
    );
    await this.#recordTransaction(transaction, execution, document);
    return {
      status: "EXECUTED",
      result: execution.result,
      undo_available: execution.undoAvailable,
      diagnostics: execution.diagnostics,
    };
  }

  /**
   * Current-value observation through the exact accepted W08 re-resolution
   * and the exact W10 driver observation for the transaction's control
   * family. Read-only: no driver execute path is reachable from here.
   */
  async #observeCurrent(
    document: Document,
    frameContext: FrameContext,
    transaction: DriverTransactionRequest,
  ): Promise<CurrentObservation> {
    const resolved = await resolveFieldTarget(
      document,
      frameContext,
      transaction.address,
    );
    if (resolved.status === "AMBIGUOUS") {
      return { status: "AMBIGUOUS" };
    }
    if (resolved.status === "UNRESOLVED") {
      return {
        status: "UNRESOLVED",
        resolution: resolved.reason === "NO_MATCH" ? "MISSING" : "STALE",
      };
    }
    const target = resolved.target;
    const candidates = matchingControlDrivers(
      this.#drivers,
      target.descriptor,
      target.anchor,
      transaction.intended,
    );
    const driver = candidates[0];
    if (candidates.length !== 1 || driver === undefined) {
      return { status: "UNRESOLVED", resolution: "STALE" };
    }
    const context = { document, target, intended: transaction.intended };
    const observation = await driver.observe(context);
    const acceptance = await readSiteAcceptance(
      driver.acceptanceElements?.(context) ?? [
        target.anchor,
        ...target.members,
      ],
    );
    return {
      status: "OBSERVED",
      evidence: await evidenceFromObservation(observation),
      validationRejected: acceptance.acceptance === "REJECTED",
    };
  }

  // -------------------------------------------------------------------
  // Reconciliation
  // -------------------------------------------------------------------

  async reconcile(
    document: Document,
    frameContext: FrameContext,
    correlationId: string,
  ): Promise<DynamicReconcileOutcome> {
    const started = performance.now();
    this.#observedDocument = document;
    this.#counters.reconciliation_passes += 1;
    if (this.#state === "OBSERVING") {
      await this.#flushPendingBatch(document, frameContext);
      const structure = await this.#revalidateStructure(document, frameContext);
      if (structure === "ROOT_LOST") {
        const root = detectApplicationRoot(document);
        return {
          status:
            root.status === "AMBIGUOUS" ? "ROOT_AMBIGUOUS" : "ROOT_UNRESOLVED",
          candidate_count:
            root.status === "AMBIGUOUS" ? root.candidateCount : 0,
          snapshot: this.snapshot(document),
        };
      }
    } else {
      // On-demand pass without observation: one bounded root scan seeds the
      // current inventory; no observer or timer is created.
      const root = detectApplicationRoot(document);
      if (root.status !== "FOUND") {
        return {
          status:
            root.status === "AMBIGUOUS" ? "ROOT_AMBIGUOUS" : "ROOT_UNRESOLVED",
          candidate_count:
            root.status === "AMBIGUOUS" ? root.candidateCount : 0,
          snapshot: this.snapshot(document),
        };
      }
      this.#observedRoot = root.root;
      this.#routeSeed = this.#routeSeedOf(document);
      this.#inventory.clear();
      await this.#rootScan(
        document,
        frameContext,
        root.root,
        "OBSERVATION_START",
      );
    }
    const proofGeneration = currentDomGeneration(document);
    const evidenceList: ReconcileFieldEvidence[] = [];
    for (const entry of this.#inventory.values()) {
      evidenceList.push(
        await this.#evidenceFor(document, frameContext, entry, proofGeneration),
      );
    }
    evidenceList.sort(canonicalEvidenceOrder);
    const pageGeneration = currentDomGeneration(document);
    const items: FormReconciliationInventoryV1InventoryItem[] = [];
    for (const evidence of evidenceList.slice(0, MAX_INVENTORY_ITEMS)) {
      const classified = classifyField(evidence);
      if (classified.pageChangedDetected) {
        this.#counters.page_changed_detected += 1;
      }
      items.push({
        item_id: await stableSemanticId(
          "item",
          [
            "w11-item-v1",
            frameContext.document_id,
            String(pageGeneration),
            evidence.fieldAddressDigest,
            evidence.fieldId,
          ].join("\0"),
        ),
        field_id: evidence.fieldId,
        field_address_digest: evidence.fieldAddressDigest,
        required: evidence.required,
        visible: evidence.visible,
        enabled: evidence.enabled,
        category: classified.category,
        document_state: classified.document_state,
        changed_value: classified.changed_value,
        confirmation_state: classified.confirmation_state,
        mandatory_uncertain: classified.mandatory_uncertain,
      });
    }
    const counts = computeInventoryCounts(items);
    const readiness = computeReadiness(counts, pageGeneration, proofGeneration);
    const evidenceDigest = await semanticDigest(
      `w11-evidence-v1\0${canonicalJson({ counts, items, readiness })}`,
    );
    const pageId = await stableSemanticId(
      "page",
      [
        "w11-page-v1",
        frameContext.document_id,
        this.#routeSeed ?? this.#routeSeedOf(document),
        String(pageGeneration),
      ].join("\0"),
    );
    const inventory = {
      inventory_id: await stableSemanticId(
        "inv",
        `w11-inventory-v1\0${evidenceDigest}\0${correlationId}`,
      ),
      session_id: frameContext.session_id,
      page_id: pageId,
      document_id: frameContext.document_id,
      page_generation: pageGeneration,
      proof_generation: proofGeneration,
      items,
      counts,
      readiness,
      evidence_digest: evidenceDigest,
      correlation_id: correlationId,
    };
    if (!isCanonicalReconciliationInventory(inventory)) {
      throw new Error(
        "dynamic invariant: constructed inventory is not canonical",
      );
    }
    this.#counters.last_reconciliation_duration_ms = boundedMs(started);
    return {
      status: "RECONCILED",
      inventory,
      snapshot: this.snapshot(document),
    };
  }

  async #evidenceFor(
    document: Document,
    frameContext: FrameContext,
    entry: InventoryEntry,
    pageGeneration: number,
  ): Promise<ReconcileFieldEvidence> {
    const descriptor = entry.descriptor;
    const base = {
      fieldId: entry.fieldId,
      fieldAddressDigest: entry.addressDigest,
      required: descriptor.required,
      visible: descriptor.visible,
      enabled: descriptor.enabled,
    };
    const registryEntry = this.#registry.get(entry.addressDigest);
    if (registryEntry === undefined) {
      return { ...base, validationRejected: false };
    }
    const generationCurrent = registryEntry.pageGeneration === pageGeneration;
    let currentValue: CurrentValueComparison = "NOT_CHECKED";
    let validationRejected = false;
    if (registryEntry.outcome === "VERIFIED" && generationCurrent) {
      const observation = await this.#observeCurrent(
        document,
        frameContext,
        registryEntry.transaction,
      );
      if (observation.status === "OBSERVED") {
        validationRejected = observation.validationRejected;
        const settled = registryEntry.settledEvidence;
        currentValue =
          observation.evidence.semantic_digest === settled.semantic_digest &&
          observation.evidence.presence === settled.presence
            ? "MATCHES_SETTLED"
            : "DIFFERS";
      } else if (observation.status === "AMBIGUOUS") {
        currentValue = "AMBIGUOUS";
      } else {
        currentValue = "UNRESOLVED";
      }
    }
    return {
      ...base,
      validationRejected,
      transaction: {
        outcome: registryEntry.outcome,
        decisionConfirmation:
          registryEntry.transaction.decision.confirmation_state,
        generationCurrent,
        currentValue,
      },
    };
  }

  // -------------------------------------------------------------------
  // Instrumentation
  // -------------------------------------------------------------------

  snapshot(document: Document): DynamicInstrumentationSnapshot {
    const snapshot: DynamicInstrumentationSnapshot = {
      observation_state: this.#state,
      generations: {
        route_generation: this.#routeGeneration,
        page_generation: currentDomGeneration(document),
        dom_observation_generation: this.#domObservationGeneration,
        root_generation: this.#rootGeneration,
      },
      memory: memoryProbe(),
      cpu: { available: false, reason: "NO_IN_PAGE_PROCESS_CPU_SOURCE" },
      ...this.#counters,
      inventory_size: this.#inventory.size,
      ledger_size: this.#ledger.size,
      registry_size: this.#registry.size,
      queue_length: this.#queue.length,
      max_queue_length: this.#queue.maxObservedLength,
    };
    if (!isCanonicalInstrumentationSnapshot(snapshot)) {
      throw new Error(
        "dynamic invariant: constructed snapshot is not canonical",
      );
    }
    return snapshot;
  }
}
