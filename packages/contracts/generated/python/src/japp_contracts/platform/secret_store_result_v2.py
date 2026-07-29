"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/secret-store-result.v2.schema.json
Schema id: urn:japp:schema:platform:secret-store-result:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1BoundedUserMessage, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1SecretKeyRole, PlatformVocabularyV1SecretOperation, PlatformVocabularyV1SecretReference, PlatformVocabularyV1SecretResultState

class PlatformSecretStoreResultV2(ContractModel):
    "The result of one typed secret-store operation plus the store's explicit availability and permission state. Secret bytes, passphrases, recovered values, and derived key material can never appear here, in diagnostics, or in an evidence bundle; a retrieval reports only an opaque reference and a digest. There is no plaintext, file, or environment-variable fallback state. Version 1.1.0 aligns STATUS with the STORE_AVAILABLE vocabulary token and the complete availability/reason truth table."

    secret_result_id: CommonStableIdV1StableId
    request_ref: CommonStableIdV1StableId
    operation: PlatformVocabularyV1SecretOperation
    key_role: PlatformVocabularyV1SecretKeyRole
    store_availability: Annotated[PlatformVocabularyV1CapabilityAvailability, Field(description="Explicit availability and permission state of the platform secure store itself.")]
    store_identity_token: Annotated[CommonContractTextV1BoundedToken, Field(description="Bounded identity of the native store family that answered, without naming a service, account, registry location, or bus address.")] | None = None
    result_state: PlatformVocabularyV1SecretResultState
    material_reference: Annotated[PlatformVocabularyV1SecretReference, Field(description="Opaque handle returned for a successful retrieval or storage. It is not the secret.")] | None = None
    material_digest: CommonProvenanceV1ContentDigest | None = None
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    remediation_message: PlatformVocabularyV1BoundedUserMessage | None = None
    completed_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("store_identity_token", "material_reference", "material_digest", "remediation_message",),
        )
