"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/desktop/service-request.v1.schema.json
Schema id: urn:japp:schema:desktop:service-request:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import StringConstraints

from japp_contracts._runtime import ContractModel

class DesktopServiceRequestV1(ContractModel):
    "Closed desktop command payload. Its opaque identifier correlates cancellation; it conveys no service URL, token, port, executable path or arbitrary operation."

    request_id: Annotated[str, StringConstraints(pattern="^req_[0-9A-HJKMNP-TV-Z]{26}$", min_length=30, max_length=30)]
