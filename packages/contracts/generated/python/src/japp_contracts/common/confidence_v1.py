"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/confidence.v1.schema.json
Schema id: urn:japp:schema:common:confidence:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le

CommonConfidenceV1Confidence = Annotated[int, Ge(0), Le(1)] | Annotated[float, Ge(0), Le(1)]
