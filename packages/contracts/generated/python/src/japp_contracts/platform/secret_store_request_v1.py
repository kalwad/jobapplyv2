"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/secret-store-request.v1.schema.json
Schema id: urn:japp:schema:platform:secret-store-request:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.redaction_v1 import CommonRedactionV1RedactionAnnotation
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1InstallationScope, PlatformVocabularyV1RequestContext, PlatformVocabularyV1SecretKeyRole, PlatformVocabularyV1SecretOperation, PlatformVocabularyV1SecretReference

class PlatformSecretStoreRequestV1(ContractModel):
    "A typed secret-store operation over a closed set of reviewed secret roles. No plaintext secret, passphrase, token, key material, keychain service or account, Windows registry location, D-Bus request, file path, or environment-variable fallback is representable. External-provider credentials are deliberately absent and remain future work; nothing here reads or writes an unrelated credential file."

    secret_request_id: CommonStableIdV1StableId
    request_context: PlatformVocabularyV1RequestContext
    operation: PlatformVocabularyV1SecretOperation
    key_role: PlatformVocabularyV1SecretKeyRole
    scope: PlatformVocabularyV1InstallationScope
    material_reference: Annotated[PlatformVocabularyV1SecretReference, Field(description="Opaque handle to secret material already held by the trusted local service. A PUT names material by reference; the bytes never cross this contract.")] | None = None
    material_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="Digest of the referenced material, used only to prove that a later read returned the same secret.")] | None = None
    redaction: CommonRedactionV1RedactionAnnotation | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("material_reference", "material_digest", "redaction",),
        )
