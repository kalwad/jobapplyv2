"""Each open/read keeps its original idle deadline even without timer delivery."""

from __future__ import annotations

# Projected elapsed intervals and request counts are independent test oracles.
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
from services.orchestrator.tests.test_generation_sticky_cancellation import (
    _cancel,
    _refused,
    _SwallowingStream,
    _SwallowingTransport,
)

import orchestrator.generation.client as client_module
from orchestrator.generation import ErrorCode, GenerationFailure, Limits
from orchestrator.generation.types import ByteStream


class _Clock:
    def __init__(self) -> None:
        self.now = asyncio.get_running_loop().time()

    def read(self) -> float:
        return self.now

    def advance(self, seconds: float = 0.75) -> None:
        self.now += seconds


class _ProjectionStream(_Stream):
    def __init__(self, clock: _Clock, stage: str, *, error: bool = False) -> None:
        super().__init__((_frame(_DOCUMENT.model_dump_json()),))
        self.clock = clock
        self.stage = stage
        self.error = error

    async def __anext__(self) -> bytes:
        chunk = await super().__anext__()
        if self.stage == "read":
            self.clock.advance()
            if self.error:
                raise OSError("synthetic late read failure")
        return chunk


class _ProjectionTransport(_Transport):
    def __init__(
        self, stream: _Stream, clock: _Clock, stage: str, *, error: bool = False
    ) -> None:
        super().__init__(stream)
        self.clock = clock
        self.stage = stage
        self.error = error

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        if self.stage == "open":
            self.clock.advance()
            if self.error:
                stream.close()
                raise OSError("synthetic late open failure")
        return stream


@pytest.mark.parametrize("stage", ["open", "read"])
def test_ready_open_or_read_cannot_overrun_its_original_idle_deadline(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        stream = _ProjectionStream(clock, stage)
        transport = _ProjectionTransport(stream, clock, stage)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert caught.value.audit is not None
        assert caught.value.audit.output_sha256 is None
        assert len(transport.calls) == 1
        assert stream.closed

    asyncio.run(scenario())


@pytest.mark.parametrize("stage", ["open", "read"])
def test_suppressed_idle_timer_cancellation_still_refuses_success(stage: str) -> None:
    async def scenario() -> None:
        stream = _SwallowingStream(block=stage == "read")
        transport = _SwallowingTransport(stream, block=stage == "open")
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=1.0, idle_seconds=0.02))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert caught.value.audit is not None
        assert caught.value.audit.output_sha256 is None
        assert transport.swallowed if stage == "open" else stream.swallowed
        task = asyncio.current_task()
        assert task is not None
        assert task.cancelling() == 0
        assert stream.closed

    asyncio.run(scenario())


@pytest.mark.parametrize("stage", ["open", "read"])
def test_late_raw_error_uses_the_expired_idle_deadline(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        stream = _ProjectionStream(clock, stage, error=True)
        transport = _ProjectionTransport(stream, clock, stage, error=True)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert caught.value.audit is not None
        assert caught.value.audit.error is ErrorCode.TIMEOUT
        assert caught.value.audit.output_sha256 is None
        assert stream.closed

    asyncio.run(scenario())


class _CancelledIdleOverrunStream(_SwallowingStream):
    def __init__(self, clock: _Clock) -> None:
        super().__init__(block=True)
        self.clock = clock

    async def __anext__(self) -> bytes:
        chunk = await super().__anext__()
        self.clock.advance()
        return chunk


@pytest.mark.parametrize("operation", ["cancel", "disconnect", "caller"])
def test_pending_cancellation_precedes_a_simultaneously_expired_idle_interval(
    operation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        stream = _CancelledIdleOverrunStream(clock)
        client = _client(_SwallowingTransport(stream))
        running = asyncio.create_task(
            client.generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        )
        await stream.entered.wait()
        await _cancel(operation, client, running)
        await _refused(operation, running)
        assert stream.swallowed
        assert stream.closed

    asyncio.run(scenario())


class _ProgressingStream(_Stream):
    def __init__(self, clock: _Clock) -> None:
        body = _frame(_DOCUMENT.model_dump_json())
        super().__init__((body[: len(body) // 2], body[len(body) // 2 :]))
        self.clock = clock

    async def __anext__(self) -> bytes:
        chunk = await super().__anext__()
        self.clock.advance(0.4)
        return chunk


def test_each_new_read_gets_an_idle_interval_within_the_original_total_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        stream = _ProgressingStream(clock)
        result = await _client(_Transport(stream)).generate(
            _request(limits=Limits(total_seconds=3.0, idle_seconds=0.5))
        )
        assert result.candidates == _DOCUMENT
        assert result.audit.attempts == 1
        assert not result.release_permitted
        assert stream.closed

    asyncio.run(scenario())
