"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/desktop/service-cancellation.v1.schema.json
Schema id: urn:japp:schema:desktop:service-cancellation:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import StringConstraints

from japp_contracts._runtime import ContractModel

class DesktopServiceCancellationV1(ContractModel):
    "Native acknowledges a cancellation request, including a cancellation arriving before read registration. It never claims a completed cancellation merely because a command was delivered."

    request_id: Annotated[str, StringConstraints(pattern="^req_[0-9A-HJKMNP-TV-Z]{26}$", min_length=30, max_length=30)]
    outcome: Literal["CANCELLATION_REQUESTED", "ALREADY_FINISHED"]
