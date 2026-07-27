/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/form/reconciliation-inventory.v1.schema.json
 * Schema id: urn:japp:schema:form:reconciliation-inventory:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Sensitive confirmation state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormReconciliationInventoryV1ConfirmationState = "CONFIRMED" | "EXPIRED" | "MISSING" | "NOT_APPLICABLE" | "REVOKED";

/**
 * Claimed reconciliation counts
 */
export interface FormReconciliationInventoryV1InventoryCounts {
  readonly total: CommonContractTextV1NonNegativeSafeInteger;
  readonly verified_filled: CommonContractTextV1NonNegativeSafeInteger;
  readonly needs_review: CommonContractTextV1NonNegativeSafeInteger;
  readonly blocked_sensitive: CommonContractTextV1NonNegativeSafeInteger;
  readonly unsupported_or_skipped: CommonContractTextV1NonNegativeSafeInteger;
  readonly required_unresolved: CommonContractTextV1NonNegativeSafeInteger;
  readonly page_changed_value: CommonContractTextV1NonNegativeSafeInteger;
  readonly stale_document: CommonContractTextV1NonNegativeSafeInteger;
  readonly unconfirmed_consequential: CommonContractTextV1NonNegativeSafeInteger;
  readonly mandatory_uncertain: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Reconciliation category
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormReconciliationInventoryV1ReconciliationCategory = "BLOCKED_SENSITIVE" | "NEEDS_REVIEW" | "PAGE_CHANGED_VALUE" | "REQUIRED_UNRESOLVED" | "UNSUPPORTED_OR_SKIPPED" | "VERIFIED_FILLED";

/**
 * One deterministic reconciliation item
 */
export interface FormReconciliationInventoryV1InventoryItem {
  readonly item_id: CommonStableIdV1StableId;
  readonly field_id: CommonStableIdV1StableId;
  readonly field_address_digest: CommonProvenanceV1ContentDigest;
  readonly required: boolean;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly category: FormReconciliationInventoryV1ReconciliationCategory;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly document_state: "CURRENT" | "NOT_APPLICABLE" | "STALE";
  readonly changed_value: boolean;
  readonly confirmation_state: FormReconciliationInventoryV1ConfirmationState;
  readonly mandatory_uncertain: boolean;
}

/**
 * Page reconciliation inventory
 *
 * Deterministic page-level inventory from which final readiness is recomputed. Caller-supplied contradictory counts cannot be accepted semantically.
 */
export interface FormReconciliationInventoryV1 {
  readonly inventory_id: CommonStableIdV1StableId;
  readonly session_id: CommonStableIdV1StableId;
  readonly page_id: CommonStableIdV1StableId;
  readonly document_id: CommonStableIdV1StableId;
  readonly page_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly proof_generation: CommonContractTextV1NonNegativeSafeInteger;
  /**
   * Minimum items: 0.
   * Maximum items: 512.
   */
  readonly items: readonly FormReconciliationInventoryV1InventoryItem[];
  readonly counts: FormReconciliationInventoryV1InventoryCounts;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly readiness: "NOT_READY" | "READY";
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
}
