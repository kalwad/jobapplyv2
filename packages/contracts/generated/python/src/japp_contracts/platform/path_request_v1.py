"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/path-request.v1.schema.json
Schema id: urn:japp:schema:platform:path-request:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import Field

from japp_contracts._runtime import ContractModel
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1InstallationScope, PlatformVocabularyV1PathRole, PlatformVocabularyV1PathSegment, PlatformVocabularyV1RequestContext

class PlatformPathRequestV1(ContractModel):
    "A caller selects a logical role and bounded relative segments. An absolute path, traversal path, UNC or device path, registry path, shell expansion, environment expansion, executable lookup input, or arbitrary working directory is structurally unrepresentable."

    path_request_id: CommonStableIdV1StableId
    request_context: PlatformVocabularyV1RequestContext
    role: PlatformVocabularyV1PathRole
    scope: PlatformVocabularyV1InstallationScope
    relative_segments: Annotated[Annotated[list[PlatformVocabularyV1PathSegment], MinLen(0), MaxLen(8)], Field(description="Bounded normalized segments appended below the role root.")]
    create_if_missing: bool
