"""Boundary cancellation remains terminal even when an adapter suppresses it."""

from __future__ import annotations

# Exact request counts are independent cancellation and retry oracles.
# ruff: noqa: PLR2004
import asyncio

import pytest
from services.orchestrator.tests.test_generation_boundary import (
    _DOCUMENT,
    _client,
    _frame,
    _request,
    _Stream,
    _Transport,
)

import orchestrator.generation.client as client_module
from orchestrator.generation import (
    ErrorCode,
    GenerationClient,
    GenerationFailure,
    Limits,
)
from orchestrator.generation.types import Audit, ByteStream, CandidateDocument, Result


class _SwallowingStream(_Stream):
    def __init__(self, *, block: bool = False, close_error: bool = False) -> None:
        super().__init__(
            (_frame(_DOCUMENT.model_dump_json()),),
            asyncio.Event() if block else None,
        )
        self.swallowed = False
        self.close_error = close_error

    async def __anext__(self) -> bytes:
        try:
            return await super().__anext__()
        except asyncio.CancelledError:
            self.swallowed = True
            self.block = None
            return await super().__anext__()

    def close(self) -> None:
        super().close()
        if self.close_error:
            raise OSError("synthetic close failure")


class _SwallowingTransport(_Transport):
    def __init__(self, stream: _Stream, *, block: bool = False) -> None:
        super().__init__(stream)
        self.block = block
        self.entered = asyncio.Event()
        self.swallowed = False

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        if self.block:
            self.entered.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                self.swallowed = True
        return stream


async def _cancel(
    operation: str, client: GenerationClient, running: asyncio.Task[Result]
) -> None:
    if operation == "caller":
        running.cancel("caller-origin")
    elif operation == "cancel":
        assert await client.cancel("request.one")
    else:
        assert operation == "disconnect"
        await client.disconnect()


async def _refused(operation: str, running: asyncio.Task[Result]) -> None:
    if operation == "caller":
        with pytest.raises(asyncio.CancelledError):
            await running
        assert running.cancelling() >= 1
    else:
        with pytest.raises(GenerationFailure) as caught:
            await running
        assert caught.value.code is ErrorCode.CANCELLED
        assert caught.value.audit is not None
        assert caught.value.audit.error is ErrorCode.CANCELLED
        assert caught.value.audit.output_sha256 is None
        assert running.cancelling() == 0


@pytest.mark.parametrize("operation", ["cancel", "disconnect", "caller"])
@pytest.mark.parametrize("stage", ["open", "read"])
def test_swallowed_cancellation_cannot_construct_or_publish_a_result(
    operation: str, stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        constructed: list[bool] = []

        def observed_result(document: CandidateDocument, audit: Audit) -> Result:
            constructed.append(True)
            return Result(document, audit)

        monkeypatch.setattr(client_module, "Result", observed_result)
        stream = _SwallowingStream(block=stage == "read")
        transport = _SwallowingTransport(stream, block=stage == "open")
        client = _client(transport)
        running = asyncio.create_task(client.generate(_request()))
        await (transport.entered if stage == "open" else stream.entered).wait()
        await _cancel(operation, client, running)
        await _refused(operation, running)
        assert transport.swallowed if stage == "open" else stream.swallowed
        assert constructed == []
        assert stream.closed
        assert len(transport.calls) == 1
        assert not await client.cancel("request.one")

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["cancel", "disconnect"])
@pytest.mark.parametrize("order", ["caller_first", "provider_first"])
def test_swallowed_mixed_cancellation_preserves_caller_counts(
    operation: str, order: str
) -> None:
    async def scenario() -> None:
        stream = _SwallowingStream(block=True)
        client = _client(_SwallowingTransport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        if order == "caller_first":
            running.cancel("caller-origin")
        await _cancel(operation, client, running)
        if order == "provider_first":
            running.cancel("caller-origin")
        await _refused("caller", running)
        assert running.cancelling() == 2
        assert stream.swallowed
        assert stream.closed
        assert not await client.cancel("request.one")

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["cancel", "disconnect", "caller"])
def test_close_failure_cannot_replace_pending_cancellation(operation: str) -> None:
    async def scenario() -> None:
        stream = _SwallowingStream(block=True, close_error=True)
        client = _client(_SwallowingTransport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        await _cancel(operation, client, running)
        await _refused(operation, running)
        assert stream.swallowed
        assert stream.closed
        assert not await client.cancel("request.one")

    asyncio.run(scenario())


class _AmbiguousCancellationStream(_SwallowingStream):
    async def __anext__(self) -> bytes:
        try:
            return await _Stream.__anext__(self)
        except asyncio.CancelledError:
            raise asyncio.CancelledError("transport-replaced-cancellation") from None


def test_close_failure_preserves_the_original_ambiguous_cancel_marker() -> None:
    async def scenario() -> None:
        stream = _AmbiguousCancellationStream(block=True, close_error=True)
        client = _client(_SwallowingTransport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        await _cancel("cancel", client, running)
        with pytest.raises(asyncio.CancelledError) as caught:
            await running
        assert caught.value.args == ("transport-replaced-cancellation",)
        assert running.cancelling() == 1
        assert stream.closed

    asyncio.run(scenario())


class _Clock:
    def __init__(self) -> None:
        self.now = asyncio.get_running_loop().time()

    def read(self) -> float:
        return self.now

    def expire(self) -> None:
        self.now += 2.0


class _LateErrorStream(_Stream):
    def __init__(self, clock: _Clock, stage: str) -> None:
        super().__init__((_frame(_DOCUMENT.model_dump_json()),))
        self.clock = clock
        self.stage = stage

    def close(self) -> None:
        super().close()
        if self.stage == "close":
            self.clock.expire()
            raise OSError("synthetic late close failure")


class _LateErrorTransport(_Transport):
    def __init__(self, stream: _Stream, clock: _Clock, stage: str) -> None:
        super().__init__(stream)
        self.clock = clock
        self.stage = stage

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        if self.stage == "open":
            self.clock.expire()
            raise OSError("synthetic late open failure")
        return await super().open(payload, limits)


@pytest.mark.parametrize("stage", ["open", "close"])
def test_late_raw_transport_error_uses_the_expired_shared_deadline(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        stream = _LateErrorStream(clock, stage)
        transport = _LateErrorTransport(stream, clock, stage)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=1.0))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert caught.value.audit is not None
        assert caught.value.audit.error is ErrorCode.TIMEOUT
        assert caught.value.audit.output_sha256 is None
        assert stream.closed is (stage == "close")

    asyncio.run(scenario())


class _ReplacingErrorTransport(_SwallowingTransport):
    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        stream.close()
        raise OSError("synthetic error after swallowed cancellation")


@pytest.mark.parametrize("operation", ["cancel", "disconnect", "caller"])
def test_ordinary_error_after_swallowed_cancel_preserves_cancellation(
    operation: str,
) -> None:
    async def scenario() -> None:
        stream = _SwallowingStream()
        transport = _ReplacingErrorTransport(stream, block=True)
        client = _client(transport)
        running = asyncio.create_task(client.generate(_request()))
        await transport.entered.wait()
        await _cancel(operation, client, running)
        await _refused(operation, running)
        assert transport.swallowed
        assert stream.closed
        assert not await client.cancel("request.one")

    asyncio.run(scenario())
