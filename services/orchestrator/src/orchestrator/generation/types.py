"""Internal candidate-generation types; no transport, tools, or release authority."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field

Identifier = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_.:-]{0,95}$")]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class ClosedModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)


class Provider(StrEnum):
    LOCAL_OLLAMA = "LOCAL_OLLAMA"
    FAKE_EXTERNAL = "FAKE_EXTERNAL"


class Task(StrEnum):
    RESUME_CANDIDATE = "RESUME_CANDIDATE"
    ANSWER_CANDIDATE = "ANSWER_CANDIDATE"


class DataClass(StrEnum):
    JOB_TEXT = "JOB_TEXT"
    APPROVED_EVIDENCE = "APPROVED_EVIDENCE"
    RESUME_BLOCK = "RESUME_BLOCK"
    ANSWER_CONTEXT = "ANSWER_CONTEXT"
    STYLE_PROFILE = "STYLE_PROFILE"
    COMPANY_ROLE = "COMPANY_ROLE"
    SENSITIVE = "SENSITIVE"
    ATTACHMENT = "ATTACHMENT"


class Limits(ClosedModel):
    """One total deadline; byte/frame ceilings bound each of at most two attempts."""

    total_seconds: Annotated[float, Field(ge=0.05, le=120.0)] = 30.0
    idle_seconds: Annotated[float, Field(ge=0.01, le=10.0)] = 5.0
    input_bytes: Annotated[int, Field(ge=1, le=65536)] = 32768
    output_bytes: Annotated[int, Field(ge=1, le=32768)] = 16384
    wire_bytes: Annotated[int, Field(ge=1, le=262144)] = 131072
    frame_bytes: Annotated[int, Field(ge=1, le=65536)] = 32768
    frames: Annotated[int, Field(ge=1, le=2048)] = 1024
    candidates: Annotated[int, Field(ge=1, le=16)] = 4
    candidate_characters: Annotated[int, Field(ge=1, le=4096)] = 2048
    candidate_words: Annotated[int, Field(ge=1, le=512)] = 256


class ModelProfile(ClosedModel):
    """Supplied allowlist record, not runtime discovery or model-lock approval."""

    profile_ref: Identifier
    provider: Provider
    model: Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_./:@-]{0,191}$")]
    expected_digest: Digest
    context_tokens: Annotated[int, Field(ge=256, le=131072)]
    max_input_bytes: Annotated[int, Field(ge=1, le=65536)]
    tasks: Annotated[tuple[Task, ...], Field(min_length=1, max_length=16)]
    # The future profile/qualification loader must establish this capability.
    # A true value is a configuration assertion, never runtime attestation.
    supports_thinking_off: Literal[True]


class PromptPolicy(ClosedModel):
    """Versioned prompt-registry input; task parameters are not global defaults."""

    prompt_ref: Identifier
    context_policy_ref: Identifier
    task: Task
    temperature: Annotated[float, Field(ge=0.0, le=0.7)]
    output_tokens: Annotated[int, Field(ge=1, le=8192)]


class ContextBlock(ClosedModel):
    block_ref: Identifier
    data_class: DataClass
    text: Annotated[str, Field(min_length=1, max_length=8192, repr=False)]
    synthetic: bool = False


class Request(ClosedModel):
    request_id: Identifier
    task: Task
    policy: PromptPolicy
    context: Annotated[tuple[ContextBlock, ...], Field(min_length=1, max_length=64)]
    evidence_refs: Annotated[tuple[Identifier, ...], Field(min_length=1, max_length=64)]
    limits: Limits = Field(default_factory=Limits)
    provider: Provider = Provider.LOCAL_OLLAMA
    profile_ref: Identifier | None = None


class Candidate(ClosedModel):
    candidate_ref: Identifier
    text: Annotated[str, Field(min_length=1, max_length=4096, repr=False)]
    evidence_refs: Annotated[tuple[Identifier, ...], Field(min_length=1, max_length=32)]


class CandidateDocument(ClosedModel):
    schema_version: Literal["GENERATION_CANDIDATES_V1"]
    candidates: Annotated[tuple[Candidate, ...], Field(min_length=1, max_length=16)]


class ErrorCode(StrEnum):
    INVALID_REQUEST = "INVALID_REQUEST"
    NO_MODEL = "NO_MODEL"
    UNSUPPORTED = "UNSUPPORTED"
    PROVIDER_DISABLED = "PROVIDER_DISABLED"
    BUSY = "BUSY"
    DISCONNECTED = "DISCONNECTED"
    CANCELLED = "CANCELLED"
    TIMEOUT = "TIMEOUT"
    TRANSPORT = "TRANSPORT"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    PROTOCOL = "PROTOCOL"
    LIMIT = "LIMIT"
    TRUNCATED = "TRUNCATED"
    MALFORMED_OUTPUT = "MALFORMED_OUTPUT"


@dataclass(frozen=True)
class Audit:
    request_id: str
    provider: Provider
    profile_ref: str
    model: str
    expected_model_digest: str
    runtime_digest_verified: Literal[False]
    task: Task
    prompt_ref: str
    context_policy_ref: str
    schema_version: Literal["GENERATION_CANDIDATES_V1"]
    data_classes: tuple[DataClass, ...]
    egress_policy: Literal["LOOPBACK_ONLY", "NONE_FAKE"]
    request_sha256: str
    attempt_request_sha256s: tuple[str, ...]
    output_sha256: str | None
    attempts: int
    latency_seconds: float
    prompt_tokens: int | None
    output_tokens: int | None
    quota_state: Literal["NOT_REPORTED"]
    error: ErrorCode | None


@dataclass(frozen=True)
class Result:
    candidates: CandidateDocument
    audit: Audit
    verification_state: Literal["PENDING_ATOMIC_CLAIM_VERIFICATION"] = (
        "PENDING_ATOMIC_CLAIM_VERIFICATION"
    )
    release_permitted: Literal[False] = False


@dataclass(frozen=True)
class ProviderCapability:
    provider: Provider
    enabled: bool
    default: bool
    internal_streaming: Literal[True] = True
    publishes_partial_output: Literal[False] = False
    output_schema: Literal["GENERATION_CANDIDATES_V1"] = "GENERATION_CANDIDATES_V1"
    thinking: Literal["OFF_ONLY"] = "OFF_ONLY"
    runtime_health: Literal["NOT_PROBED"] = "NOT_PROBED"
    release_authority: Literal[False] = False


class GenerationError(Exception):
    """Closed error vocabulary, with no raw prompt, response, or upstream message."""

    def __init__(self, code: ErrorCode, audit: Audit | None = None) -> None:
        super().__init__(code.value)
        self.code = code
        self.audit = audit


# Retain the existing boundary name for callers while the exception class follows
# the repository's required Error naming convention.
GenerationFailure = GenerationError


class ByteStream(Protocol):
    def __aiter__(self) -> ByteStream: ...

    async def __anext__(self) -> bytes: ...

    def close(self) -> None:
        """Synchronously relinquish local transport resources; idempotent."""
        ...


class Transport(Protocol):
    async def open(self, payload: bytes, limits: Limits) -> ByteStream: ...
