"""Bounded untrusted runtime observations, never model qualification."""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from orchestrator.generation.client import _strict_json
from orchestrator.generation.types import (
    ClosedModel,
    ErrorCode,
    GenerationFailure,
    Limits,
)
from orchestrator.runtime.transport import (
    LocalMetadataTransport,
    MetadataTransport,
    Operation,
    Target,
)

_SUPPORTED_VERSION = "0.40.2"
_MAX_DEPTH = 16
_DIGEST = re.compile(r"^(?:sha256:)?([0-9a-f]{64})$")
_VERSION = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
_BODY_BYTES = 262144
_MODEL_ROWS = 256
_CAPABILITIES = 32
_MANIFESTS = 16
_THINKING_VALUES = 16

Token = Annotated[
    str, Field(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9_.:-]+$")
]
FullDigest = Annotated[str, Field(pattern=r"^(?:sha256:)?[0-9a-f]{64}$")]
Version = Annotated[str, Field(max_length=32, pattern=_VERSION.pattern)]
ThinkingValue = bool | Token


class State(StrEnum):
    INSTALLED_UNQUALIFIED = "INSTALLED_UNQUALIFIED"
    NO_MODEL = "NO_MODEL"
    UNAVAILABLE = "UNAVAILABLE"
    MALFORMED = "MALFORMED"
    UNSUPPORTED = "UNSUPPORTED"
    BUSY = "BUSY"


class Reason(StrEnum):
    EVALUATION_NOT_RUN = "EVALUATION_NOT_RUN"
    MODEL_NOT_INSTALLED = "MODEL_NOT_INSTALLED"
    RUNTIME_UNAVAILABLE = "RUNTIME_UNAVAILABLE"
    INCOMPATIBLE_VERSION = "INCOMPATIBLE_VERSION"
    INVALID_METADATA = "INVALID_METADATA"
    UNSUPPORTED_CAPABILITY = "UNSUPPORTED_CAPABILITY"
    ARTIFACT_DIGEST_MISMATCH = "ARTIFACT_DIGEST_MISMATCH"
    TIMEOUT = "TIMEOUT"
    REQUEST_ACTIVE = "REQUEST_ACTIVE"


class ProbeLimits(ClosedModel):
    total_seconds: Annotated[float, Field(ge=0.05, le=15.0)] = 5.0
    idle_seconds: Annotated[float, Field(ge=0.01, le=3.0)] = 1.0
    body_bytes: Annotated[int, Field(ge=1, le=_BODY_BYTES)] = _BODY_BYTES


class _Upstream(BaseModel):
    # Unknown upstream fields are discarded within the finite raw envelope.
    model_config = ConfigDict(strict=True, extra="ignore", frozen=True)


class _Version(_Upstream):
    version: Version


class _Details(_Upstream):
    format: Token | None = None
    family: Token | None = None
    parameter_size: Token | None = None
    quantization_level: Token | None = None
    runner: Literal["mlx", "ggml", "llamacpp"] | None = None

    @field_validator("family", "parameter_size", "quantization_level", mode="before")
    @classmethod
    def empty_description_is_unknown(cls, value: object) -> object:
        # Pinned Ollama emits empty descriptions for safetensors. Empty is not a
        # model fact; required format, runner, capabilities and digests stay strict.
        return None if value == "" else value


class _Tag(_Upstream):
    name: Annotated[str, Field(min_length=1, max_length=192)]
    digest: FullDigest
    size: Annotated[int, Field(ge=0, le=2**41)]
    details: _Details


class _Tags(_Upstream):
    models: Annotated[list[_Tag], Field(max_length=_MODEL_ROWS)]


class _Thinking(_Upstream):
    values: Annotated[
        list[ThinkingValue], Field(min_length=1, max_length=_THINKING_VALUES)
    ]
    default: ThinkingValue


class _Manifest(_Upstream):
    digest: FullDigest
    runner: Literal["mlx", "ggml", "llamacpp"]
    format: Literal["safetensors", "gguf"]
    selected: bool = False


class _Show(_Upstream):
    details: _Details
    capabilities: Annotated[list[Token], Field(max_length=_CAPABILITIES)]
    thinking: _Thinking | None = None
    manifests: Annotated[list[_Manifest], Field(max_length=_MANIFESTS)] = Field(
        default_factory=list
    )
    requires: Version | None = None
    remote_host: Annotated[str, Field(max_length=512)] = ""
    remote_model: Annotated[str, Field(max_length=192)] = ""


class RuntimeReceipt(ClosedModel):
    version: Version
    endpoint: Literal["IPV4_LOOPBACK_FIXED_PORT"] = "IPV4_LOOPBACK_FIXED_PORT"
    native_identity_verified: Literal[False] = False


class ManifestReceipt(ClosedModel):
    digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    runner: Literal["mlx", "ggml", "llamacpp"]
    format: Literal["safetensors", "gguf"]


class ModelReceipt(ClosedModel):
    target: Target
    reported_tag_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    reported_bytes: Annotated[int, Field(ge=0, le=2**41)]
    format: Token | None
    tag_runner: Literal["mlx", "ggml", "llamacpp"] | None
    show_runner: Literal["mlx", "ggml", "llamacpp"] | None
    selected_manifest: ManifestReceipt | None
    declared_requires: Version | None
    advertised_capabilities: tuple[Token, ...]
    advertised_thinking_values: tuple[ThinkingValue, ...]
    advertised_thinking_default: ThinkingValue | None
    runtime_digest_verified: Literal[False] = False
    qualification: Literal["NOT_EVALUATED"] = "NOT_EVALUATED"


class Observation(ClosedModel):
    state: State
    reason: Reason
    runtime: RuntimeReceipt | None = None
    model: ModelReceipt | None = None
    requests_completed: Annotated[int, Field(ge=0, le=3)] = 0
    qualified_full: Literal[False] = False
    runtime_digest_verified: Literal[False] = False
    deterministic_core: Literal["PRESERVED"] = "PRESERVED"
    release_permitted: Literal[False] = False


def _monotonic() -> float:
    return asyncio.get_running_loop().time()


def _caller_live() -> None:
    task = asyncio.current_task()
    if task is not None and task.cancelling() != 0:
        # Never consume caller cancellation, even when an adapter suppresses it.
        raise asyncio.CancelledError


def _admit(deadline: float) -> None:
    _caller_live()
    if _monotonic() >= deadline:
        raise TimeoutError


def _depth(value: object, level: int = 0) -> None:
    if level > _MAX_DEPTH:
        raise ValueError("METADATA_DEPTH")
    if isinstance(value, dict):
        for item in value.values():
            _depth(item, level + 1)
    elif isinstance(value, list):
        for item in value:
            _depth(item, level + 1)


def _decode(payload: bytes, limit: int) -> object:
    if type(payload) is not bytes or len(payload) > limit:
        raise ValueError("METADATA_SIZE")
    result = _strict_json(payload)
    _depth(result)
    return result


def _version(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("."))


def _digest(value: str) -> str:
    if type(value) is not str:
        raise ValueError("INVALID_DIGEST")
    match = _DIGEST.fullmatch(value)
    if match is None:
        raise ValueError("INVALID_DIGEST")
    return match[1]


def _receipt(target: Target, tag: _Tag, show: _Show) -> ModelReceipt:
    selected = [entry for entry in show.manifests if entry.selected]
    if show.manifests and len(selected) != 1:
        raise ValueError("AMBIGUOUS_MANIFEST")
    child = selected[0] if selected else None
    return ModelReceipt(
        target=target,
        reported_tag_digest=_digest(tag.digest),
        reported_bytes=tag.size,
        format=show.details.format,
        tag_runner=tag.details.runner,
        show_runner=show.details.runner,
        selected_manifest=(
            None
            if child is None
            else ManifestReceipt(
                digest=_digest(child.digest), runner=child.runner, format=child.format
            )
        ),
        declared_requires=show.requires,
        advertised_capabilities=tuple(show.capabilities),
        advertised_thinking_values=(
            () if show.thinking is None else tuple(show.thinking.values)
        ),
        advertised_thinking_default=(
            None if show.thinking is None else show.thinking.default
        ),
    )


def _supported(target: Target, runtime: RuntimeReceipt, tag: _Tag, show: _Show) -> bool:
    expected_format = "safetensors" if target is Target.GEMMA12B else "gguf"
    if (
        show.remote_host
        or show.remote_model
        or show.details.format != expected_format
        or tag.details.format != expected_format
        or "completion" not in show.capabilities
        or show.thinking is None
        or not any(value is False for value in show.thinking.values)
        or show.thinking.default not in show.thinking.values
    ):
        return False
    if show.requires is not None and _version(show.requires) > _version(
        runtime.version
    ):
        return False
    expected_runners = {"mlx"} if target is Target.GEMMA12B else {"ggml", "llamacpp"}
    if (
        show.details.runner is not None and show.details.runner not in expected_runners
    ) or (
        tag.details.runner is not None and tag.details.runner not in expected_runners
    ):
        return False
    return all(
        entry.runner in expected_runners and entry.format == expected_format
        for entry in show.manifests
        if entry.selected
    )


@dataclass
class _Probe:
    target: Target
    expected: str | None
    wire: Limits
    deadline: float
    runtime: RuntimeReceipt | None = None
    completed: int = 0

    async def read(self, transport: MetadataTransport, operation: Operation) -> object:
        _admit(self.deadline)
        payload = await transport.request(operation, self.target, self.wire)
        self.completed += 1
        _admit(self.deadline)
        result = _decode(payload, self.wire.wire_bytes)
        _admit(self.deadline)
        return result

    def failure(self, state: State, reason: Reason) -> Observation:
        return Observation(
            state=state,
            reason=reason,
            runtime=self.runtime,
            requests_completed=self.completed,
        )


class RuntimeDiscovery:
    """Single event loop and one trusted-adapter operation; cancellation propagates."""

    def __init__(self, transport: MetadataTransport | None = None) -> None:
        self._transport = LocalMetadataTransport() if transport is None else transport
        self._active = False

    async def discover(
        self,
        target: Target,
        *,
        expected_digest: str | None = None,
        limits: ProbeLimits | None = None,
    ) -> Observation:
        started = _monotonic()
        _caller_live()
        if self._active:
            return Observation(state=State.BUSY, reason=Reason.REQUEST_ACTIVE)
        self._active = True
        probe: _Probe | None = None
        try:
            if not isinstance(target, Target):
                raise ValueError("INVALID_TARGET")
            expected = None if expected_digest is None else _digest(expected_digest)
            selected = ProbeLimits() if limits is None else limits
            wire = Limits(
                total_seconds=selected.total_seconds,
                idle_seconds=selected.idle_seconds,
                wire_bytes=selected.body_bytes,
            )
            probe = _Probe(target, expected, wire, started + selected.total_seconds)
            _admit(probe.deadline)
            async with asyncio.timeout_at(probe.deadline):
                version = _Version.model_validate(
                    await probe.read(self._transport, Operation.VERSION)
                )
                probe.runtime = RuntimeReceipt(version=version.version)
                result = (
                    probe.failure(State.UNSUPPORTED, Reason.INCOMPATIBLE_VERSION)
                    if version.version != _SUPPORTED_VERSION
                    else await self._model(probe)
                )
                _admit(probe.deadline)
                return result
        except TimeoutError:
            _caller_live()
            return _failure(probe, State.UNAVAILABLE, Reason.TIMEOUT)
        except GenerationFailure as error:
            _caller_live()
            malformed = error.code in {ErrorCode.PROTOCOL, ErrorCode.LIMIT}
            return _failure(
                probe,
                State.MALFORMED if malformed else State.UNAVAILABLE,
                Reason.INVALID_METADATA if malformed else Reason.RUNTIME_UNAVAILABLE,
            )
        except (ValueError, RecursionError):
            _caller_live()
            return _failure(probe, State.MALFORMED, Reason.INVALID_METADATA)
        finally:
            self._active = False

    async def _model(self, probe: _Probe) -> Observation:
        tags = _Tags.model_validate(await probe.read(self._transport, Operation.TAGS))
        matching = [row for row in tags.models if row.name == probe.target.value]
        if len(matching) > 1:
            raise ValueError("DUPLICATE_TARGET")
        if not matching:
            return probe.failure(State.NO_MODEL, Reason.MODEL_NOT_INSTALLED)
        show = _Show.model_validate(await probe.read(self._transport, Operation.SHOW))
        receipt = _receipt(probe.target, matching[0], show)
        mismatch = (
            probe.expected is not None and probe.expected != receipt.reported_tag_digest
        )
        if probe.runtime is None:
            raise ValueError("MISSING_RUNTIME")
        supported = _supported(probe.target, probe.runtime, matching[0], show)
        result = Observation(
            state=(
                State.UNSUPPORTED
                if mismatch or not supported
                else State.INSTALLED_UNQUALIFIED
            ),
            reason=(
                Reason.ARTIFACT_DIGEST_MISMATCH
                if mismatch
                else Reason.UNSUPPORTED_CAPABILITY
                if not supported
                else Reason.EVALUATION_NOT_RUN
            ),
            runtime=probe.runtime,
            model=receipt,
            requests_completed=probe.completed,
        )
        _admit(probe.deadline)
        return result


def _failure(probe: _Probe | None, state: State, reason: Reason) -> Observation:
    return (
        Observation(state=state, reason=reason)
        if probe is None
        else probe.failure(state, reason)
    )
