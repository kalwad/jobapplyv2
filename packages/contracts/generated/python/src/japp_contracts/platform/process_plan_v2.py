"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/process-plan.v2.schema.json
Schema id: urn:japp:schema:platform:process-plan:v2

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.platform.vocabulary_v1 import PlatformVocabularyV1EnvironmentEntry, PlatformVocabularyV1LifecycleMode, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PathRole, PlatformVocabularyV1ProcessArgument, PlatformVocabularyV1ProcessProfileId, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RequestContext, PlatformVocabularyV1StdioMode, PlatformVocabularyV1TimeoutMilliseconds

class PlatformProcessPlanV2(ContractModel):
    "A typed spawn plan. It names an approved executable profile, never a command string, interpreter invocation, executable path, or script body. Arguments are an already-separated bounded array, the environment is a closed allowlist, and the working directory is a typed role. Shell interpolation, command chaining, redirection, metacharacter payloads, registry commands, privilege escalation, raw file descriptors, and raw signal values are structurally unrepresentable. This contract does not spawn anything."

    process_plan_id: CommonStableIdV1StableId
    request_context: PlatformVocabularyV1RequestContext
    profile: PlatformVocabularyV1ProcessProfileId
    profile_version: PlatformVocabularyV1ProductVersion | None = None
    executable_digest: Annotated[CommonProvenanceV1ContentDigest, Field(description="Digest of the exact approved executable the profile resolves to, so a supervisor can refuse a substituted binary.")] | None = None
    arguments: Annotated[Annotated[list[PlatformVocabularyV1ProcessArgument], MinLen(0), MaxLen(16)], Field(description="Already-separated argument array. It is never joined into a command line and never interpreted by a shell.")]
    environment_allowlist: Annotated[Annotated[list[PlatformVocabularyV1EnvironmentEntry], MinLen(0), MaxLen(8)], Field(description="Closed allowlist entries. An arbitrary environment dictionary cannot be expressed.")]
    inherit_parent_environment: Annotated[bool, Field(description="Always false in a reviewed plan: a packaged process must not inherit an interactive-shell environment.")]
    working_directory_role: PlatformVocabularyV1PathRole
    stdin_mode: PlatformVocabularyV1StdioMode
    stdout_mode: PlatformVocabularyV1StdioMode
    stderr_mode: PlatformVocabularyV1StdioMode
    lifecycle_mode: PlatformVocabularyV1LifecycleMode
    startup_timeout_ms: PlatformVocabularyV1TimeoutMilliseconds
    shutdown_timeout_ms: PlatformVocabularyV1TimeoutMilliseconds
    max_restart_attempts: Annotated[int, Ge(0), Le(8)]
    max_memory_mib: PlatformVocabularyV1MemoryMebibytes | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("profile_version", "executable_digest", "max_memory_mib",),
        )
