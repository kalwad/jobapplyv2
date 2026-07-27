"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/stable-id.v1.schema.json
Schema id: urn:japp:schema:common:stable-id:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import StringConstraints

CommonStableIdV1IdPrefix = Annotated[str, StringConstraints(pattern="^[a-z][a-z0-9]{1,23}$")]
"Lowercase alphanumeric type prefix starting with a letter; 2-24 characters. The prefix names the entity kind and is assigned by the owning contract."

CommonStableIdV1StableId = Annotated[str, StringConstraints(pattern="^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$")]
"Complete identifier: <prefix>_<26-character Crockford base32 body>."
