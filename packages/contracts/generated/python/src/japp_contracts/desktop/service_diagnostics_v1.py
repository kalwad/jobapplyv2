"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/desktop/service-diagnostics.v1.schema.json
Schema id: urn:japp:schema:desktop:service-diagnostics:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from japp_contracts._runtime import ContractModel
from japp_contracts.common.contract_text_v1 import CommonContractTextV1VersionText

class _DesktopServiceDiagnosticsV1Variant1(ContractModel):
    "Closed secret-free native observation. READY requires authenticated health/readiness/version on one proven native stream. Other states reflect actual native lifecycle or cancellation; browser preview never synthesizes READY. Standard envelope metadata carries native correlation and creation time."

    request_id: Annotated[str, StringConstraints(pattern="^req_[0-9A-HJKMNP-TV-Z]{26}$", min_length=30, max_length=30)]
    state: Literal["READY"]
    service_version: CommonContractTextV1VersionText
    api_version: CommonContractTextV1VersionText

class _DesktopServiceDiagnosticsV1Variant2(ContractModel):
    "Closed secret-free native observation. READY requires authenticated health/readiness/version on one proven native stream. Other states reflect actual native lifecycle or cancellation; browser preview never synthesizes READY. Standard envelope metadata carries native correlation and creation time."

    request_id: Annotated[str, StringConstraints(pattern="^req_[0-9A-HJKMNP-TV-Z]{26}$", min_length=30, max_length=30)]
    state: Literal["UNAVAILABLE", "STARTING", "STOPPING", "STOPPED", "FAILED", "CLEANUP_FAILED", "CANCELLED"]

DesktopServiceDiagnosticsV1 = Annotated[_DesktopServiceDiagnosticsV1Variant1 | _DesktopServiceDiagnosticsV1Variant2, Field(discriminator="state")]

"Closed secret-free native observation. READY requires authenticated health/readiness/version on one proven native stream. Other states reflect actual native lifecycle or cancellation; browser preview never synthesizes READY. Standard envelope metadata carries native correlation and creation time."
