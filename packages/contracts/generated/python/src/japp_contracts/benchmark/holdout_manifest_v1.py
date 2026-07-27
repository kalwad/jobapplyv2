"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json
Schema id: urn:japp:schema:benchmark:holdout-manifest:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import MaxLen, MinLen
from pydantic import model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1PositiveSafeInteger, CommonContractTextV1SchemaReference, CommonContractTextV1VersionText
from japp_contracts.common.enum_token_v1 import CommonEnumTokenV1EnumToken
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId

class BenchmarkHoldoutManifestV1CategoryCount(ContractModel):
    "Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable."

    category: CommonEnumTokenV1EnumToken
    count: CommonContractTextV1NonNegativeSafeInteger

class BenchmarkHoldoutManifestV1EncryptedBundleMetadata(ContractModel):
    "Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable."

    bundle_ref: CommonStableIdV1StableId
    cipher_suite: CommonEnumTokenV1EnumToken
    bundle_digest: CommonProvenanceV1ContentDigest

class BenchmarkHoldoutManifestV1FileCommitment(ContractModel):
    "Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable."

    file_id: CommonStableIdV1StableId
    content_digest: CommonProvenanceV1ContentDigest
    byte_count: CommonContractTextV1NonNegativeSafeInteger
    case_count: CommonContractTextV1NonNegativeSafeInteger

class BenchmarkHoldoutManifestV1SchemaVersionEntry(ContractModel):
    "Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable."

    schema_ref: CommonContractTextV1SchemaReference
    schema_version: CommonContractTextV1VersionText

class BenchmarkHoldoutManifestV1(ContractModel):
    "Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable."

    manifest_id: CommonStableIdV1StableId
    holdout_format_version: CommonContractTextV1VersionText
    case_ids: Annotated[list[CommonStableIdV1StableId], MinLen(1), MaxLen(4096)]
    schema_versions: Annotated[list[BenchmarkHoldoutManifestV1SchemaVersionEntry], MinLen(1), MaxLen(128)]
    case_count: CommonContractTextV1PositiveSafeInteger
    category_counts: Annotated[list[BenchmarkHoldoutManifestV1CategoryCount], MinLen(1), MaxLen(128)]
    files: Annotated[list[BenchmarkHoldoutManifestV1FileCommitment], MinLen(1), MaxLen(128)]
    synthetic_only: bool
    storage_policy: Literal["ENCRYPTED_BUNDLE_REFERENCE", "OWNER_CONTROLLED_EXTERNAL"]
    visibility_class: Literal["OWNER_ONLY", "OWNER_REVIEWER", "REVIEWER_ONLY"]
    creation_provenance: CommonProvenanceV1Provenance
    review_provenance: CommonProvenanceV1Provenance
    encrypted_bundle: BenchmarkHoldoutManifestV1EncryptedBundleMetadata | None = None
    manifest_digest: CommonProvenanceV1ContentDigest

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("encrypted_bundle",),
        )
