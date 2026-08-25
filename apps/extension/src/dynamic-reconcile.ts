// M02-W11 pure reconciliation classifier (REQ-FORM-024 feasibility portion).
//
// Deterministic, DOM-free mapping from bounded per-field evidence summaries
// onto the canonical generated reconciliation-inventory categories and the
// canonical RECONCILIATION_READINESS recompute rule
// (packages/contracts/generator/semantic-rules.ts). The canonical rule pins
// two structural constraints this module must never violate:
//
//   1. `changed_value` is true exactly when the category is
//      PAGE_CHANGED_VALUE; and
//   2. a required + visible + enabled item may only be VERIFIED_FILLED,
//      REQUIRED_UNRESOLVED, or BLOCKED_SENSITIVE.
//
// A required field whose page value changed after verification therefore
// classifies as REQUIRED_UNRESOLVED (its canonical equivalent under spec
// §5.11 reconciliation semantics: it no longer holds a currently valid
// verified result); PAGE_CHANGED_VALUE is the canonical category for the
// non-required changed field. The frame engine surfaces the changed-value
// detection count separately so neither case is silent.
//
// No Date.now, randomness, or map-iteration accident participates in
// classification; ordering is canonical over (field_address_digest,
// field_id).
import type {
  FormFieldDecisionV1,
  FormReconciliationInventoryV1,
  FormReconciliationInventoryV1ConfirmationState,
  FormReconciliationInventoryV1InventoryCounts,
  FormReconciliationInventoryV1InventoryItem,
  FormReconciliationInventoryV1ReconciliationCategory,
} from "@japp/contracts/generated";

/** Current-page observation of a previously executed transaction's field. */
export type CurrentValueComparison =
  "MATCHES_SETTLED" | "DIFFERS" | "UNRESOLVED" | "AMBIGUOUS" | "NOT_CHECKED";

/** Bounded evidence summary for one currently inventoried field. */
export interface ReconcileFieldEvidence {
  readonly fieldId: string;
  readonly fieldAddressDigest: string;
  readonly required: boolean;
  readonly visible: boolean;
  readonly enabled: boolean;
  /** Current descriptor validation state is REJECTED. */
  readonly validationRejected: boolean;
  readonly transaction?: {
    /** Canonical driver outcome of the recorded transaction. */
    readonly outcome:
      | "BLOCKED_SENSITIVE"
      | "FAILED"
      | "NEEDS_REVIEW"
      | "UNSUPPORTED"
      | "VERIFIED";
    /** Confirmation state of the authorizing/refused decision. */
    readonly decisionConfirmation: FormFieldDecisionV1["confirmation_state"];
    /** Recorded at the current page generation of this frame. */
    readonly generationCurrent: boolean;
    /** Fresh current-document comparison against settled evidence. */
    readonly currentValue: CurrentValueComparison;
  };
}

export interface ClassifiedField {
  readonly category: FormReconciliationInventoryV1ReconciliationCategory;
  readonly document_state: "CURRENT" | "NOT_APPLICABLE" | "STALE";
  readonly changed_value: boolean;
  readonly confirmation_state: FormReconciliationInventoryV1ConfirmationState;
  readonly mandatory_uncertain: boolean;
  /** True when a page-changed intended value was detected on this field. */
  readonly pageChangedDetected: boolean;
}

function confirmationOf(
  decisionConfirmation: FormFieldDecisionV1["confirmation_state"],
): FormReconciliationInventoryV1ConfirmationState {
  switch (decisionConfirmation) {
    case "VALID":
      return "CONFIRMED";
    case "EXPIRED":
      return "EXPIRED";
    case "MISSING":
      return "MISSING";
    case "REVOKED":
      return "REVOKED";
    case "NOT_REQUIRED":
      return "NOT_APPLICABLE";
  }
}

function requiredFallback(
  required: boolean,
  optionalCategory: FormReconciliationInventoryV1ReconciliationCategory,
): FormReconciliationInventoryV1ReconciliationCategory {
  return required ? "REQUIRED_UNRESOLVED" : optionalCategory;
}

/** Total deterministic classification of one inventoried field. */
export function classifyField(
  evidence: ReconcileFieldEvidence,
): ClassifiedField {
  if (!evidence.visible || !evidence.enabled) {
    // A concealed or disabled control is never actionable and never counts
    // as an unresolved requirement; honeypot safety lives here.
    return {
      category: "UNSUPPORTED_OR_SKIPPED",
      document_state: "NOT_APPLICABLE",
      changed_value: false,
      confirmation_state: "NOT_APPLICABLE",
      mandatory_uncertain: false,
      pageChangedDetected: false,
    };
  }
  const transaction = evidence.transaction;
  if (transaction === undefined) {
    return {
      category: requiredFallback(evidence.required, "UNSUPPORTED_OR_SKIPPED"),
      document_state: "NOT_APPLICABLE",
      changed_value: false,
      confirmation_state: "NOT_APPLICABLE",
      mandatory_uncertain: false,
      pageChangedDetected: false,
    };
  }
  const confirmation = confirmationOf(transaction.decisionConfirmation);
  if (!transaction.generationCurrent) {
    // Older-generation evidence never carries authority forward.
    return {
      category: requiredFallback(evidence.required, "NEEDS_REVIEW"),
      document_state: "STALE",
      changed_value: false,
      confirmation_state: confirmation,
      mandatory_uncertain: false,
      pageChangedDetected: false,
    };
  }
  switch (transaction.outcome) {
    case "BLOCKED_SENSITIVE":
      return {
        category: "BLOCKED_SENSITIVE",
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: false,
      };
    case "UNSUPPORTED":
      return {
        category: requiredFallback(evidence.required, "UNSUPPORTED_OR_SKIPPED"),
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: false,
      };
    case "FAILED":
    case "NEEDS_REVIEW":
      return {
        category: requiredFallback(evidence.required, "NEEDS_REVIEW"),
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: false,
      };
    case "VERIFIED":
      break;
  }
  switch (transaction.currentValue) {
    case "MATCHES_SETTLED":
      if (evidence.validationRejected) {
        // Site rejection after a verified fill removes the clean state.
        return {
          category: requiredFallback(evidence.required, "NEEDS_REVIEW"),
          document_state: "CURRENT",
          changed_value: false,
          confirmation_state: confirmation,
          mandatory_uncertain: false,
          pageChangedDetected: false,
        };
      }
      return {
        category: "VERIFIED_FILLED",
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: false,
      };
    case "DIFFERS":
      return {
        category: evidence.required
          ? "REQUIRED_UNRESOLVED"
          : "PAGE_CHANGED_VALUE",
        document_state: "CURRENT",
        changed_value: !evidence.required,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: true,
      };
    case "AMBIGUOUS":
      return {
        category: requiredFallback(evidence.required, "NEEDS_REVIEW"),
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: evidence.required,
        pageChangedDetected: false,
      };
    case "UNRESOLVED":
    case "NOT_CHECKED":
      return {
        category: requiredFallback(evidence.required, "NEEDS_REVIEW"),
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: confirmation,
        mandatory_uncertain: false,
        pageChangedDetected: false,
      };
  }
}

/** Canonical stable ordering for inventory items. */
export function canonicalEvidenceOrder(
  left: ReconcileFieldEvidence,
  right: ReconcileFieldEvidence,
): number {
  if (left.fieldAddressDigest !== right.fieldAddressDigest) {
    return left.fieldAddressDigest < right.fieldAddressDigest ? -1 : 1;
  }
  if (left.fieldId !== right.fieldId) {
    return left.fieldId < right.fieldId ? -1 : 1;
  }
  return 0;
}

/** Recompute canonical counts exactly as RECONCILIATION_READINESS does. */
export function computeInventoryCounts(
  items: readonly FormReconciliationInventoryV1InventoryItem[],
): FormReconciliationInventoryV1InventoryCounts {
  const byCategory = (
    category: FormReconciliationInventoryV1ReconciliationCategory,
  ): number => items.filter((item) => item.category === category).length;
  return {
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
  };
}

/**
 * Canonical readiness recompute: READY exactly when the proof generation is
 * the page generation and every blocking count is zero. This is the
 * feasibility floor of REQ-FORM-024 — an unresolved visible enabled
 * required control or a page-changed intended value always yields
 * NOT_READY — plus the stricter canonical zero rules for stale documents,
 * unconfirmed consequential confirmations, and mandatory uncertainty.
 */
export function computeReadiness(
  counts: FormReconciliationInventoryV1InventoryCounts,
  pageGeneration: number,
  proofGeneration: number,
): FormReconciliationInventoryV1["readiness"] {
  const blocked =
    counts.required_unresolved > 0 ||
    counts.blocked_sensitive > 0 ||
    counts.page_changed_value > 0 ||
    counts.stale_document > 0 ||
    counts.unconfirmed_consequential > 0 ||
    counts.mandatory_uncertain > 0;
  return !blocked && pageGeneration === proofGeneration ? "READY" : "NOT_READY";
}
