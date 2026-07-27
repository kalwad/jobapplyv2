"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/timestamp-utc.v1.schema.json
Schema id: urn:japp:schema:common:timestamp-utc:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import AfterValidator, StringConstraints

from japp_contracts._runtime import validate_utc_timestamp

CommonTimestampUtcV1UtcTimestamp = Annotated[str, StringConstraints(pattern="^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,9})?Z$"), AfterValidator(validate_utc_timestamp)]
