"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/redaction.v1.schema.json
Schema id: urn:japp:schema:common:redaction:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Literal

from japp_contracts._runtime import ContractModel

CommonRedactionV1RedactionPolicy = Literal["NONE", "REDACT_VALUE", "HASH_ONLY", "FORBID_CAPTURE"]
"NONE: value may appear verbatim in diagnostics. REDACT_VALUE: value must be replaced by a fixed placeholder. HASH_ONLY: only a digest of the value may appear. FORBID_CAPTURE: the value must never be captured into diagnostics, logs, analytics, or error reports at all."

CommonRedactionV1SensitivityClass = Literal["PUBLIC", "INTERNAL", "PERSONAL", "SENSITIVE", "SECRET"]

class CommonRedactionV1RedactionAnnotation(ContractModel):
    "Defined namespaced vocabulary for data sensitivity and redaction handling. Two closed token sets are normative: sensitivityClass (how private a value is) and redactionPolicy (how diagnostics, logs, and exports must treat the value). The same vocabulary backs the x-japp-sensitivity and x-japp-redaction schema annotation keywords, which are the ONLY schema-level redaction annotations permitted — arbitrary or ad-hoc redaction keywords are rejected by the strict validator. Instance-level redaction metadata uses the redactionAnnotation object."

    sensitivity: CommonRedactionV1SensitivityClass
    policy: CommonRedactionV1RedactionPolicy
