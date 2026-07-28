"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/evidence-record.v1.schema.json
Schema id: urn:japp:schema:platform:evidence-record:v1

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
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1Architecture, PlatformVocabularyV1ArtifactIdentity, PlatformVocabularyV1BuildToken, PlatformVocabularyV1DiagnosticResult, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1EvidenceArtifactKind, PlatformVocabularyV1MachineClass, PlatformVocabularyV1OwnerDecisionState, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1ReviewState, PlatformVocabularyV1SignatureState

class PlatformEvidenceRecordV1(ContractModel):
    "One future per-platform evidence element for the Cross-Platform Core Gate bundle: operating-system build and architecture, machine class, package identity and signature state, browser and WebView versions, native-host registration, secret-store test, model profile, document matrix, backup/restore, update/rollback, and synthetic-safe log, screenshot, or trace references. Every artifact is a digest reference; raw secrets, unrestricted logs, raw local paths, complete environment dumps, registry exports, and machine-specific identity are structurally unrepresentable. M01-W07 creates no certification bundle and evaluates no gate."

    evidence_record_id: CommonStableIdV1StableId
    platform_id: PlatformVocabularyV1PlatformId
    architecture: PlatformVocabularyV1Architecture
    os_version: PlatformVocabularyV1ProductVersion | None = None
    os_build: PlatformVocabularyV1BuildToken | None = None
    machine_class: Annotated[PlatformVocabularyV1MachineClass, Field(description="Coarse machine class only. Hostnames, serial numbers, user names, and network identity are never represented.")]
    runner_image_token: Annotated[CommonContractTextV1BoundedToken, Field(description="Coarse hosted-runner image label. It identifies a hosted CI runner and nothing else, and a measured native run on a hosted runner must name it.")] | None = None
    artifact_kind: PlatformVocabularyV1EvidenceArtifactKind
    evaluation_method: Annotated[PlatformVocabularyV1EvaluationMethod, Field(description="How the artifact was produced. Independent of `machine_class`, which records where: any machine class may execute synthetic fixtures or static inspection, and only a non-synthetic machine may execute a measured native run.")]
    synthetic_only: Annotated[bool, Field(description="Always true: every committed platform evidence artifact contains synthetic data only.")]
    artifact_digest: CommonProvenanceV1ContentDigest
    package_artifact: PlatformVocabularyV1ArtifactIdentity | None = None
    signature_state: PlatformVocabularyV1SignatureState | None = None
    browser_version: PlatformVocabularyV1ProductVersion | None = None
    webview_version: PlatformVocabularyV1ProductVersion | None = None
    native_messaging_result_ref: CommonStableIdV1StableId | None = None
    secret_store_result_ref: CommonStableIdV1StableId | None = None
    model_profile_ref: CommonStableIdV1StableId | None = None
    installer_state_ref: CommonStableIdV1StableId | None = None
    update_state_ref: CommonStableIdV1StableId | None = None
    result: PlatformVocabularyV1DiagnosticResult
    reason_codes: Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)]
    reviewer_identity_ref: CommonStableIdV1StableId | None = None
    review_state: PlatformVocabularyV1ReviewState | None = None
    owner_decision_state: PlatformVocabularyV1OwnerDecisionState | None = None
    recorded_at: CommonTimestampUtcV1UtcTimestamp
    provenance: CommonProvenanceV1Provenance

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("os_version", "os_build", "runner_image_token", "package_artifact", "signature_state", "browser_version", "webview_version", "native_messaging_result_ref", "secret_store_result_ref", "model_profile_ref", "installer_state_ref", "update_state_ref", "reviewer_identity_ref", "review_state", "owner_decision_state",),
        )
