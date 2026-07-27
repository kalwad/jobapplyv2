"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/enum-token.v1.schema.json
Schema id: urn:japp:schema:common:enum-token:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import StringConstraints

CommonEnumTokenV1EnumToken = Annotated[str, StringConstraints(pattern="^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$", max_length=64)]
