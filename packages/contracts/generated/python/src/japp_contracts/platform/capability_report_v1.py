"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/capability-report.v1.schema.json
Schema id: urn:japp:schema:platform:capability-report:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field

from japp_contracts._runtime import ContractModel
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1CapabilityState, PlatformVocabularyV1DistributionChannel, PlatformVocabularyV1PlatformId, PlatformVocabularyV1SupportClaim

class PlatformCapabilityReportV1(ContractModel):
    "The typed PlatformCapabilities record of specification §5.14.2. It reports one explicit state for every specification-owned platform capability family and never treats an unevaluated capability as success. A missing local-AI profile degrades AI features only; it cannot reduce deterministic core capability below the reviewed core tier."

    capability_report_id: CommonStableIdV1StableId
    platform_id: PlatformVocabularyV1PlatformId
    support_claim: PlatformVocabularyV1SupportClaim
    capabilities: Annotated[Annotated[list[PlatformVocabularyV1CapabilityState], MinLen(8), MaxLen(8)], Field(description="Exactly one state per specification-owned capability family, with no duplicates.")]
    packaging_channel: PlatformVocabularyV1DistributionChannel
    model_profile_refs: Annotated[Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(16)], Field(description="References to platform model-runtime profile records. An empty list is honest; it never downgrades the deterministic core tier.")]
    diagnostic_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(32)]
    reported_at: CommonTimestampUtcV1UtcTimestamp
    correlation_id: CommonCorrelationV1CorrelationId
    provenance: CommonProvenanceV1Provenance
