"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/form/reconciliation-inventory.v1.schema.json
Schema id: urn:japp:schema:form:reconciliation-inventory:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen

from japp_contracts._runtime import ContractModel
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

FormReconciliationInventoryV1ConfirmationState = Literal["CONFIRMED", "EXPIRED", "MISSING", "NOT_APPLICABLE", "REVOKED"]

class FormReconciliationInventoryV1InventoryCounts(ContractModel):
    "Deterministic page-level inventory from which final readiness is recomputed. Caller-supplied contradictory counts cannot be accepted semantically."

    total: CommonContractTextV1NonNegativeSafeInteger
    verified_filled: CommonContractTextV1NonNegativeSafeInteger
    needs_review: CommonContractTextV1NonNegativeSafeInteger
    blocked_sensitive: CommonContractTextV1NonNegativeSafeInteger
    unsupported_or_skipped: CommonContractTextV1NonNegativeSafeInteger
    required_unresolved: CommonContractTextV1NonNegativeSafeInteger
    page_changed_value: CommonContractTextV1NonNegativeSafeInteger
    stale_document: CommonContractTextV1NonNegativeSafeInteger
    unconfirmed_consequential: CommonContractTextV1NonNegativeSafeInteger
    mandatory_uncertain: CommonContractTextV1NonNegativeSafeInteger

FormReconciliationInventoryV1ReconciliationCategory = Literal["BLOCKED_SENSITIVE", "NEEDS_REVIEW", "PAGE_CHANGED_VALUE", "REQUIRED_UNRESOLVED", "UNSUPPORTED_OR_SKIPPED", "VERIFIED_FILLED"]

class FormReconciliationInventoryV1InventoryItem(ContractModel):
    "Deterministic page-level inventory from which final readiness is recomputed. Caller-supplied contradictory counts cannot be accepted semantically."

    item_id: CommonStableIdV1StableId
    field_id: CommonStableIdV1StableId
    field_address_digest: CommonProvenanceV1ContentDigest
    required: bool
    visible: bool
    enabled: bool
    category: FormReconciliationInventoryV1ReconciliationCategory
    document_state: Literal["CURRENT", "NOT_APPLICABLE", "STALE"]
    changed_value: bool
    confirmation_state: FormReconciliationInventoryV1ConfirmationState
    mandatory_uncertain: bool

class FormReconciliationInventoryV1(ContractModel):
    "Deterministic page-level inventory from which final readiness is recomputed. Caller-supplied contradictory counts cannot be accepted semantically."

    inventory_id: CommonStableIdV1StableId
    session_id: CommonStableIdV1StableId
    page_id: CommonStableIdV1StableId
    document_id: CommonStableIdV1StableId
    page_generation: CommonContractTextV1NonNegativeSafeInteger
    proof_generation: CommonContractTextV1NonNegativeSafeInteger
    items: Annotated[list[FormReconciliationInventoryV1InventoryItem], MinLen(0), MaxLen(512)]
    counts: FormReconciliationInventoryV1InventoryCounts
    readiness: Literal["NOT_READY", "READY"]
    evidence_digest: CommonProvenanceV1ContentDigest
    correlation_id: CommonCorrelationV1CorrelationId
