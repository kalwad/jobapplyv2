// M02-W11 closed dynamic-protocol proofs: fail-closed parsing, truthful
// instrumentation capability (no zero-filled CPU/memory), byte-level
// agreement of the frame-local reconciliation-inventory mirror with the
// canonical generated validator plus RECONCILIATION_READINESS semantic
// rule, semantic duplicate-authority keys, and telemetry redaction.
import type {
  FormFieldAddressV1,
  FormFieldDecisionV1,
  FormReconciliationInventoryV1,
} from "@japp/contracts/generated";
import {
  validateFormReconciliationInventoryV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";
import { describe, expect, test } from "vitest";

import { deriveDuplicateAuthorityKey } from "../../src/dynamic-engine.ts";
import {
  DYNAMIC_PROTOCOL_VERSION,
  MAX_EXECUTE_ITEMS,
  buildDynamicExecuteTabRequest,
  buildDynamicReconcileTabRequest,
  buildDynamicStartTabRequest,
  buildDynamicStateTabRequest,
  buildDynamicStopTabRequest,
  isCanonicalInstrumentationSnapshot,
  isCanonicalReconciliationInventory,
  parseDynamicExecuteTabRequest,
  parseDynamicFrameReconcileResult,
  parseDynamicFrameStartResult,
  parseDynamicReconcileTabRequest,
  parseDynamicStartTabRequest,
  parseDynamicStateTabRequest,
  parseDynamicStopTabRequest,
  type DynamicInstrumentationSnapshot,
} from "../../src/dynamic-protocol.ts";
import { fieldAddressDigest } from "../../src/driver-evidence.ts";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const SESSION_ID = "session_0123456789ABCDEFGHJKMNPQRS";
const FRAME_ID = "frame_0123456789ABCDEFGHJKMNPQRS";
const DOCUMENT_ID = "document_0123456789ABCDEFGHJKMNPQRS";
const FIELD_ID = "field_0123456789ABCDEFGHJKMNPQRS";
const CORRELATION_ID = "cor_0123456789ABCDEFGHJKMNPQRS";

const address: FormFieldAddressV1 = {
  address_schema_version: "FIELD_ADDRESS_V1",
  session_id: SESSION_ID,
  frame_id: FRAME_ID,
  document_id: DOCUMENT_ID,
  ats_family: "UNKNOWN",
  route_signature: DIGEST_A,
  application_root_fingerprint: DIGEST_B,
  section_path: [],
  repeater_path: [],
  accessible_name_fingerprint: DIGEST_A,
  attribute_fingerprint: DIGEST_B,
  resolution_hints: [
    {
      kind: "CONTROL_KIND",
      value_fingerprint: DIGEST_B,
      stability_class: "PAGE_STABLE",
    },
  ],
  observed_dom_generation: 0,
};

async function canonicalDecision(): Promise<FormFieldDecisionV1> {
  return {
    decision_id: "decision_0123456789ABCDEFGHJKMNPQRS",
    field_id: FIELD_ID,
    field_address_digest: await fieldAddressDigest(address),
    field_concept: "FIRST_NAME",
    classification_confidence: 1,
    value_source_type: "USER_RECORD",
    value_source_ref: "record_0123456789ABCDEFGHJKMNPQRS",
    value_confidence: 1,
    sensitivity_class: "PERSONAL",
    policy_decision: "PERMIT",
    final_decision: "FILL",
    confirmation_state: "NOT_REQUIRED",
    reason_codes: ["REVIEWED_SOURCE"],
    provenance: {
      source_kind: "USER_INPUT",
      source_id: "source_0123456789ABCDEFGHJKMNPQRS",
      observed_at: "2026-08-24T00:00:00Z",
      confidence: 1,
    },
    correlation_id: CORRELATION_ID,
  };
}

async function transaction(
  transactionId = "transaction_0123456789ABCDEFGHJKMNPQRS",
) {
  return {
    transaction_id: transactionId,
    correlation_id: CORRELATION_ID,
    address,
    decision: await canonicalDecision(),
    intended: { kind: "TEXT" as const, text: "Synthetic value" },
    settle: { budget_ms: 25 },
  };
}

function canonicalSnapshot(
  overrides: Partial<DynamicInstrumentationSnapshot> = {},
): DynamicInstrumentationSnapshot {
  return {
    observation_state: "OBSERVING",
    generations: {
      route_generation: 1,
      page_generation: 2,
      dom_observation_generation: 9,
      root_generation: 1,
    },
    memory: {
      available: true,
      used_js_heap_bytes: 11_534_336,
      total_js_heap_bytes: 25_165_824,
    },
    cpu: { available: false, reason: "NO_IN_PAGE_PROCESS_CPU_SOURCE" },
    mutation_callbacks: 5,
    mutation_records: 512,
    records_during_action: 12,
    batches_processed: 4,
    batches_action_origin: 1,
    affected_subtree_scans: 6,
    root_rescans: 3,
    root_rescans_route_changed: 1,
    root_rescans_root_replaced: 1,
    root_rescans_overflow: 0,
    root_rescans_observation_start: 1,
    full_document_scans: 0,
    nodes_considered: 240,
    descriptors_produced: 18,
    conditional_fields_discovered: 2,
    conditional_fields_removed: 1,
    inventory_size: 8,
    ledger_size: 3,
    registry_size: 3,
    queue_length: 0,
    max_queue_length: 500,
    actions_considered: 5,
    actions_executed: 3,
    actions_suppressed_duplicate: 2,
    page_changed_detected: 1,
    reconciliation_passes: 2,
    last_batch_duration_ms: 7,
    last_reconciliation_duration_ms: 12,
    total_scan_duration_ms: 40,
    ...overrides,
  };
}

interface InventoryItemInit {
  readonly suffix: string;
  readonly required?: boolean;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly category?: FormReconciliationInventoryV1["items"][number]["category"];
  readonly document_state?: "CURRENT" | "NOT_APPLICABLE" | "STALE";
  readonly changed_value?: boolean;
  readonly confirmation_state?: FormReconciliationInventoryV1["items"][number]["confirmation_state"];
  readonly mandatory_uncertain?: boolean;
}

function inventoryItem(init: InventoryItemInit) {
  return {
    item_id: `item_${init.suffix}123456789ABCDEFGHJKMNPQRS`,
    field_id: FIELD_ID,
    field_address_digest: DIGEST_A,
    required: init.required ?? true,
    visible: init.visible ?? true,
    enabled: init.enabled ?? true,
    category: init.category ?? "VERIFIED_FILLED",
    document_state: init.document_state ?? "CURRENT",
    changed_value: init.changed_value ?? false,
    confirmation_state: init.confirmation_state ?? "NOT_APPLICABLE",
    mandatory_uncertain: init.mandatory_uncertain ?? false,
  };
}

function inventoryOf(
  items: readonly ReturnType<typeof inventoryItem>[],
  readiness: "READY" | "NOT_READY",
  pageGeneration = 2,
  proofGeneration = 2,
): FormReconciliationInventoryV1 {
  const byCategory = (category: string): number =>
    items.filter((item) => item.category === category).length;
  return {
    inventory_id: "inv_0123456789ABCDEFGHJKMNPQRS",
    session_id: SESSION_ID,
    page_id: "page_0123456789ABCDEFGHJKMNPQRS",
    document_id: DOCUMENT_ID,
    page_generation: pageGeneration,
    proof_generation: proofGeneration,
    items: [...items],
    counts: {
      total: items.length,
      verified_filled: byCategory("VERIFIED_FILLED"),
      needs_review: byCategory("NEEDS_REVIEW"),
      blocked_sensitive: byCategory("BLOCKED_SENSITIVE"),
      unsupported_or_skipped: byCategory("UNSUPPORTED_OR_SKIPPED"),
      required_unresolved: byCategory("REQUIRED_UNRESOLVED"),
      page_changed_value: byCategory("PAGE_CHANGED_VALUE"),
      stale_document: items.filter((item) => item.document_state === "STALE")
        .length,
      unconfirmed_consequential: items.filter((item) =>
        ["EXPIRED", "MISSING", "REVOKED"].includes(item.confirmation_state),
      ).length,
      mandatory_uncertain: items.filter((item) => item.mandatory_uncertain)
        .length,
    },
    readiness,
    evidence_digest: DIGEST_B,
    correlation_id: CORRELATION_ID,
  };
}

/** Canonical verdict: structural validator AND bound semantic rules. */
function canonicalVerdict(value: unknown): boolean {
  const structural = validateFormReconciliationInventoryV1(value);
  if (!structural.valid) {
    return false;
  }
  return validateSemanticContractV1(
    "urn:japp:schema:form:reconciliation-inventory:v1",
    value,
  ).valid;
}

describe("instrumentation snapshot honesty", () => {
  test("a canonical snapshot validates", () => {
    expect(isCanonicalInstrumentationSnapshot(canonicalSnapshot())).toBe(true);
  });

  test.each([
    ["an extra key", { extra: 1 }],
    ["a negative counter", { mutation_records: -1 }],
    ["a non-integer duration", { last_batch_duration_ms: 1.5 }],
    ["an unknown state", { observation_state: "SPINNING" }],
  ])("rejects %s", (_label, overrides) => {
    expect(
      isCanonicalInstrumentationSnapshot({
        ...canonicalSnapshot(),
        ...overrides,
      }),
    ).toBe(false);
  });

  test("root rescans must reconcile with their recorded reasons", () => {
    expect(
      isCanonicalInstrumentationSnapshot(
        canonicalSnapshot({ root_rescans: 4 }),
      ),
    ).toBe(false);
  });

  test("the wire cannot express a fabricated in-page CPU number", () => {
    const snapshot = canonicalSnapshot();
    expect(
      isCanonicalInstrumentationSnapshot({
        ...snapshot,
        cpu: { available: true, task_duration_ms: 12 },
      }),
    ).toBe(false);
    expect(
      isCanonicalInstrumentationSnapshot({
        ...snapshot,
        cpu: { available: false, reason: "SOMETHING_ELSE" },
      }),
    ).toBe(false);
  });

  test("unavailable memory carries no zero-filled heap numbers", () => {
    const snapshot = canonicalSnapshot();
    expect(
      isCanonicalInstrumentationSnapshot({
        ...snapshot,
        memory: { available: false },
      }),
    ).toBe(true);
    expect(
      isCanonicalInstrumentationSnapshot({
        ...snapshot,
        memory: {
          available: false,
          used_js_heap_bytes: 0,
          total_js_heap_bytes: 0,
        },
      }),
    ).toBe(false);
  });

  test("snapshot serialization carries no raw value, selector, or markup", () => {
    const serialized = JSON.stringify(canonicalSnapshot());
    for (const forbidden of [
      "<",
      "Synthetic",
      "querySelector",
      "#dyn-",
      "http://",
      "nth-of-type",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("reconciliation-inventory mirror agrees with the canonical contract", () => {
  const validNotReady = inventoryOf(
    [
      inventoryItem({ suffix: "A" }),
      inventoryItem({ suffix: "B", category: "REQUIRED_UNRESOLVED" }),
      inventoryItem({
        suffix: "C",
        required: false,
        category: "PAGE_CHANGED_VALUE",
        changed_value: true,
      }),
      inventoryItem({
        suffix: "D",
        category: "BLOCKED_SENSITIVE",
        confirmation_state: "MISSING",
      }),
      inventoryItem({
        suffix: "E",
        required: false,
        category: "NEEDS_REVIEW",
        document_state: "STALE",
      }),
      inventoryItem({
        suffix: "F",
        visible: false,
        category: "UNSUPPORTED_OR_SKIPPED",
        document_state: "NOT_APPLICABLE",
      }),
    ],
    "NOT_READY",
  );
  const validReady = inventoryOf(
    [
      inventoryItem({ suffix: "A" }),
      inventoryItem({ suffix: "B", required: false, category: "NEEDS_REVIEW" }),
      inventoryItem({
        suffix: "C",
        visible: false,
        required: true,
        category: "UNSUPPORTED_OR_SKIPPED",
        document_state: "NOT_APPLICABLE",
      }),
    ],
    "READY",
  );
  const cases: readonly [string, unknown, boolean][] = [
    ["a complete NOT_READY inventory", validNotReady, true],
    ["a clean READY inventory", validReady, true],
    ["an empty READY inventory", inventoryOf([], "READY"), true],
    [
      "a claimed count that contradicts the items",
      {
        ...validNotReady,
        counts: { ...validNotReady.counts, required_unresolved: 0 },
      },
      false,
    ],
    [
      "changed_value without PAGE_CHANGED_VALUE",
      inventoryOf(
        [inventoryItem({ suffix: "A", changed_value: true })],
        "NOT_READY",
      ),
      false,
    ],
    [
      "a required visible enabled NEEDS_REVIEW item",
      inventoryOf(
        [inventoryItem({ suffix: "A", category: "NEEDS_REVIEW" })],
        "NOT_READY",
      ),
      false,
    ],
    [
      "READY with an unresolved required item",
      inventoryOf(
        [inventoryItem({ suffix: "A", category: "REQUIRED_UNRESOLVED" })],
        "READY",
      ),
      false,
    ],
    [
      "READY across differing generations",
      inventoryOf([inventoryItem({ suffix: "A" })], "READY", 3, 2),
      false,
    ],
    [
      "duplicate item ids",
      inventoryOf(
        [inventoryItem({ suffix: "A" }), inventoryItem({ suffix: "A" })],
        "NOT_READY",
      ),
      false,
    ],
    ["an extra root key", { ...validReady, extra: true }, false],
  ];

  test.each(cases)("%s", (_label, value, expected) => {
    expect(isCanonicalReconciliationInventory(value)).toBe(expected);
    expect(canonicalVerdict(value)).toBe(expected);
  });

  test("the mirror and the canonical contract agree on every case", () => {
    for (const [, value] of cases) {
      expect(isCanonicalReconciliationInventory(value)).toBe(
        canonicalVerdict(value),
      );
    }
  });
});

describe("closed dynamic wire protocol", () => {
  test("round-trips every canonical tab request", async () => {
    const start = buildDynamicStartTabRequest("start-1", 7, FRAME_ID);
    expect(parseDynamicStartTabRequest(start)).toEqual(start);
    const stop = buildDynamicStopTabRequest("stop-1", 7, FRAME_ID);
    expect(parseDynamicStopTabRequest(stop)).toEqual(stop);
    const state = buildDynamicStateTabRequest("state-1", 7, FRAME_ID);
    expect(parseDynamicStateTabRequest(state)).toEqual(state);
    const reconcile = buildDynamicReconcileTabRequest(
      "reconcile-1",
      7,
      FRAME_ID,
      CORRELATION_ID,
    );
    expect(parseDynamicReconcileTabRequest(reconcile)).toEqual(reconcile);
    const execute = buildDynamicExecuteTabRequest("execute-1", 7, [
      await transaction(),
    ]);
    expect(parseDynamicExecuteTabRequest(execute)).toEqual(execute);
  });

  test.each([
    ["an untyped command", { command: "observe" }],
    ["an arbitrary selector", { selector: "#anything" }],
    ["an arbitrary observer config", { observe: { subtree: true } }],
  ])("rejects %s on the start request", (_label, extra) => {
    expect(
      parseDynamicStartTabRequest({
        ...buildDynamicStartTabRequest("start-x", 7, FRAME_ID),
        ...extra,
      }),
    ).toBeNull();
  });

  test("rejects a wrong protocol version and a malformed frame id", () => {
    const start = buildDynamicStartTabRequest("start-y", 7, FRAME_ID);
    expect(
      parseDynamicStartTabRequest({ ...start, protocolVersion: 2 }),
    ).toBeNull();
    expect(
      parseDynamicStartTabRequest({ ...start, frame_id: "frame-7" }),
    ).toBeNull();
    expect(DYNAMIC_PROTOCOL_VERSION).toBe(1);
  });

  test("rejects execute batches that are empty, oversized, duplicated, or cross-frame", async () => {
    const base = await transaction();
    expect(
      parseDynamicExecuteTabRequest(
        buildDynamicExecuteTabRequest("execute-empty", 7, []),
      ),
    ).toBeNull();
    const oversized = [];
    for (let index = 0; index <= MAX_EXECUTE_ITEMS; index += 1) {
      oversized.push(
        await transaction(
          `transaction_${String(index).padStart(2, "0")}23456789ABCDEFGHJKMNPQRS`.slice(
            0,
            38,
          ),
        ),
      );
    }
    expect(
      parseDynamicExecuteTabRequest(
        buildDynamicExecuteTabRequest("execute-oversized", 7, oversized),
      ),
    ).toBeNull();
    expect(
      parseDynamicExecuteTabRequest(
        buildDynamicExecuteTabRequest("execute-duplicate", 7, [base, base]),
      ),
    ).toBeNull();
    const crossFrame = {
      ...base,
      transaction_id: "transaction_1123456789ABCDEFGHJKMNPQRS",
      address: { ...address, frame_id: "frame_1123456789ABCDEFGHJKMNPQRS" },
    };
    expect(
      parseDynamicExecuteTabRequest(
        buildDynamicExecuteTabRequest("execute-cross", 7, [base, crossFrame]),
      ),
    ).toBeNull();
  });

  test("frame results parse fail-closed", () => {
    const frameContext = {
      session_id: SESSION_ID,
      frame_id: FRAME_ID,
      document_id: DOCUMENT_ID,
      document_url_digest: DIGEST_A,
      is_top_frame: true,
    };
    const started = {
      kind: "M02_W11_FRAME_START_RESULT",
      protocolVersion: DYNAMIC_PROTOCOL_VERSION,
      requestId: "start-1",
      frame_context: frameContext,
      outcome: { status: "STARTED", snapshot: canonicalSnapshot() },
    };
    expect(parseDynamicFrameStartResult(started)).toEqual(started);
    expect(
      parseDynamicFrameStartResult({
        ...started,
        outcome: { status: "STARTED", snapshot: { fabricated: true } },
      }),
    ).toBeNull();
    const reconciled = {
      kind: "M02_W11_FRAME_RECONCILE_RESULT",
      protocolVersion: DYNAMIC_PROTOCOL_VERSION,
      requestId: "reconcile-1",
      frame_context: frameContext,
      outcome: {
        status: "RECONCILED",
        inventory: inventoryOf([inventoryItem({ suffix: "A" })], "NOT_READY"),
        snapshot: canonicalSnapshot(),
      },
    };
    expect(parseDynamicFrameReconcileResult(reconciled)).toEqual(reconciled);
    expect(
      parseDynamicFrameReconcileResult({
        ...reconciled,
        outcome: {
          status: "RECONCILED",
          inventory: inventoryOf(
            [inventoryItem({ suffix: "A", category: "NEEDS_REVIEW" })],
            "NOT_READY",
          ),
          snapshot: canonicalSnapshot(),
        },
      }),
    ).toBeNull();
  });
});

describe("semantic duplicate-authority key", () => {
  test("identical canonical inputs derive the identical key", async () => {
    const first = await deriveDuplicateAuthorityKey(
      "decision_0123456789ABCDEFGHJKMNPQRS",
      DIGEST_A,
      DIGEST_B,
      2,
      DOCUMENT_ID,
    );
    const second = await deriveDuplicateAuthorityKey(
      "decision_0123456789ABCDEFGHJKMNPQRS",
      DIGEST_A,
      DIGEST_B,
      2,
      DOCUMENT_ID,
    );
    expect(second).toBe(first);
    expect(first).toMatch(/^dupkey_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test("every canonical component changes the key", async () => {
    const base = await deriveDuplicateAuthorityKey(
      "decision_0123456789ABCDEFGHJKMNPQRS",
      DIGEST_A,
      DIGEST_B,
      2,
      DOCUMENT_ID,
    );
    const variants = await Promise.all([
      deriveDuplicateAuthorityKey(
        "decision_1123456789ABCDEFGHJKMNPQRS",
        DIGEST_A,
        DIGEST_B,
        2,
        DOCUMENT_ID,
      ),
      deriveDuplicateAuthorityKey(
        "decision_0123456789ABCDEFGHJKMNPQRS",
        DIGEST_B,
        DIGEST_B,
        2,
        DOCUMENT_ID,
      ),
      deriveDuplicateAuthorityKey(
        "decision_0123456789ABCDEFGHJKMNPQRS",
        DIGEST_A,
        DIGEST_A,
        2,
        DOCUMENT_ID,
      ),
      deriveDuplicateAuthorityKey(
        "decision_0123456789ABCDEFGHJKMNPQRS",
        DIGEST_A,
        DIGEST_B,
        3,
        DOCUMENT_ID,
      ),
      deriveDuplicateAuthorityKey(
        "decision_0123456789ABCDEFGHJKMNPQRS",
        DIGEST_A,
        DIGEST_B,
        2,
        "document_1123456789ABCDEFGHJKMNPQRS",
      ),
    ]);
    for (const variant of variants) {
      expect(variant).not.toBe(base);
    }
    expect(new Set(variants).size).toBe(variants.length);
  });
});
