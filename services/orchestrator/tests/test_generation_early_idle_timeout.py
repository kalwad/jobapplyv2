"""Expired idle contexts refuse even while the sampled clock is before when()."""

from __future__ import annotations

# Exact task/request counts and intervals are independent refusal oracles.
# ruff: noqa: PLR2004
import asyncio
from collections.abc import Callable
from contextvars import Context

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
from orchestrator.generation.types import ByteStream


class _EarlyClock:
    """Deliver a real Timeout callback early, against a coarse projected sample."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.loop = asyncio.get_running_loop()
        self.now = self.loop.time()
        self.original_call_at = self.loop.call_at
        self.timers: list[asyncio.Timeout] = []
        monkeypatch.setattr(client_module, "_monotonic", self.read)
        monkeypatch.setattr(self.loop, "call_at", self.call_at)

    def read(self) -> float:
        return self.now

    def call_at(
        self,
        when: float,
        callback: Callable[..., object],
        *args: object,
        context: Context | None = None,
    ) -> asyncio.TimerHandle:
        owner = getattr(callback, "__self__", None)
        if isinstance(owner, asyncio.Timeout) and when < self.now + 1.0:
            self.timers.append(owner)
            return self.original_call_at(
                self.loop.time(), callback, *args, context=context
            )
        return self.original_call_at(when, callback, *args, context=context)

    def assert_expired_before_sampled_deadline(self) -> None:
        expired = [timer for timer in self.timers if timer.expired()]
        assert len(expired) == 1
        deadline = expired[0].when()
        assert deadline is not None
        assert self.read() < deadline


class _Probe:
    def __init__(
        self, stage: str, outcome: str, *, wait: bool = True, operation: str = ""
    ) -> None:
        self.stage = stage
        self.outcome = outcome
        self.wait = wait
        self.operation = operation
        self.client: GenerationClient | None = None
        self.swallowed = 0

    async def pause(self) -> None:
        if self.wait:
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                self.swallowed += 1
                if self.operation == "caller":
                    current = asyncio.current_task()
                    assert current is not None
                    current.cancel()
                elif self.operation:
                    assert self.client is not None
                    if self.operation == "cancel":
                        assert await self.client.cancel("request.one")
                    else:
                        assert self.operation == "disconnect"
                        await self.client.disconnect()
        if self.outcome == "error":
            raise OSError("synthetic adapter error")


class _EarlyStream(_Stream):
    def __init__(self, probe: _Probe) -> None:
        super().__init__((_frame(_DOCUMENT.model_dump_json()),))
        self.probe = probe
        self.reads = 0

    async def __anext__(self) -> bytes:
        self.reads += 1
        if (self.probe.stage == "read" and self.reads == 1) or (
            self.probe.stage == "eof" and self.reads == 2
        ):
            await self.probe.pause()
        return await super().__anext__()


class _EarlyTransport(_Transport):
    def __init__(self, stream: _EarlyStream, probe: _Probe) -> None:
        super().__init__(stream)
        self.probe = probe

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        if self.probe.stage == "open":
            try:
                await self.probe.pause()
            except OSError:
                # The adapter retains ownership until open actually returns.
                stream.close()
                raise
        return stream


@pytest.mark.parametrize("stage", ["open", "read", "eof"])
@pytest.mark.parametrize("outcome", ["value", "error"])
def test_early_expired_idle_context_refuses_value_eof_and_raw_error(
    stage: str, outcome: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe(stage, outcome)
        stream = _EarlyStream(probe)
        transport = _EarlyTransport(stream, probe)
        client = _client(transport)
        with pytest.raises(GenerationFailure) as caught:
            await client.generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert caught.value.audit is not None
        assert caught.value.audit.error is ErrorCode.TIMEOUT
        assert caught.value.audit.output_sha256 is None
        assert caught.value.audit.attempts == 1
        assert probe.swallowed == 1
        clock.assert_expired_before_sampled_deadline()
        current = asyncio.current_task()
        assert current is not None
        assert current.cancelling() == 0
        assert asyncio.all_tasks() == {current}
        assert len(transport.calls) == 1
        assert stream.closed
        assert not await client.cancel("request.one")

    asyncio.run(scenario())


@pytest.mark.parametrize("stage", ["open", "read", "eof"])
def test_unexpired_raw_error_preserves_transport_classification(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe(stage, "error", wait=False)
        stream = _EarlyStream(probe)
        transport = _EarlyTransport(stream, probe)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.code is ErrorCode.TRANSPORT
        assert caught.value.audit is not None
        assert caught.value.audit.output_sha256 is None
        assert not any(timer.expired() for timer in clock.timers)
        assert probe.swallowed == 0
        assert len(transport.calls) == 1
        assert stream.closed

    asyncio.run(scenario())


def test_scheduled_but_unexpired_idle_timers_allow_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe("none", "value")
        stream = _EarlyStream(probe)
        transport = _EarlyTransport(stream, probe)
        result = await _client(transport).generate(
            _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
        )
        assert result.candidates == _DOCUMENT
        assert not result.release_permitted
        assert result.audit.attempts == 1
        assert clock.timers
        assert not any(timer.expired() for timer in clock.timers)
        assert len(transport.calls) == 1
        assert stream.closed

    asyncio.run(scenario())


@pytest.mark.parametrize("stage", ["open", "read", "eof"])
@pytest.mark.parametrize("operation", ["cancel", "disconnect", "caller"])
def test_pending_cancellation_precedes_early_expired_idle_state(
    stage: str, operation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe(stage, "value", operation=operation)
        stream = _EarlyStream(probe)
        transport = _EarlyTransport(stream, probe)
        client = _client(transport)
        probe.client = client
        running = asyncio.create_task(
            client.generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        )
        # A timeout cancellation and the additional request have mixed provenance.
        # The client conservatively preserves the one remaining caller count.
        with pytest.raises(asyncio.CancelledError):
            await running
        assert running.cancelled()
        assert running.cancelling() == 1
        assert probe.swallowed == 1
        clock.assert_expired_before_sampled_deadline()
        assert stream.closed
        assert len(transport.calls) == 1
        assert not await client.cancel("request.one")
        current = asyncio.current_task()
        assert current is not None
        assert current.cancelling() == 0
        assert asyncio.all_tasks() == {current}

    asyncio.run(scenario())


class _CloseErrorStream(_EarlyStream):
    def close(self) -> None:
        super().close()
        raise OSError("synthetic synchronous close failure")


@pytest.mark.parametrize("stage", ["open", "read", "eof"])
@pytest.mark.parametrize("caller_pending", [False, True])
def test_close_error_preserves_early_timeout_or_pending_caller_cancellation(
    stage: str, caller_pending: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe(stage, "value", operation="caller" if caller_pending else "")
        stream = _CloseErrorStream(probe)
        transport = _EarlyTransport(stream, probe)
        client = _client(transport)
        request = _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
        if caller_pending:
            running = asyncio.create_task(client.generate(request))
            with pytest.raises(asyncio.CancelledError):
                await running
            assert running.cancelled()
            assert running.cancelling() == 1
        else:
            with pytest.raises(GenerationFailure) as caught:
                await client.generate(request)
            assert caught.value.code is ErrorCode.TIMEOUT
            assert caught.value.audit is not None
            assert caught.value.audit.error is ErrorCode.TIMEOUT
            assert caught.value.audit.output_sha256 is None
            assert caught.value.audit.attempts == 1
        clock.assert_expired_before_sampled_deadline()
        assert probe.swallowed == 1
        assert stream.closed
        assert len(transport.calls) == 1
        assert not await client.cancel("request.one")
        current = asyncio.current_task()
        assert current is not None
        assert current.cancelling() == 0
        assert asyncio.all_tasks() == {current}

    asyncio.run(scenario())


def test_unexpired_synchronous_close_error_remains_transport_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe("none", "value")
        stream = _CloseErrorStream(probe)
        transport = _EarlyTransport(stream, probe)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.code is ErrorCode.TRANSPORT
        assert caught.value.audit is not None
        assert caught.value.audit.output_sha256 is None
        assert not any(timer.expired() for timer in clock.timers)
        assert stream.closed
        assert len(transport.calls) == 1

    asyncio.run(scenario())


class _CancelledCloseStream(_EarlyStream):
    def close(self) -> None:
        super().close()
        raise asyncio.CancelledError("synthetic close cancellation")


@pytest.mark.parametrize("stage", ["open", "read", "eof"])
def test_close_cancellation_is_not_replaced_by_retained_idle_timeout(
    stage: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = _EarlyClock(monkeypatch)
        probe = _Probe(stage, "value")
        stream = _CancelledCloseStream(probe)
        transport = _EarlyTransport(stream, probe)
        with pytest.raises(asyncio.CancelledError) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=10.0, idle_seconds=0.5))
            )
        assert caught.value.args == ("synthetic close cancellation",)
        clock.assert_expired_before_sampled_deadline()
        current = asyncio.current_task()
        assert current is not None
        assert current.cancelling() == 0
        assert stream.closed
        assert len(transport.calls) == 1

    asyncio.run(scenario())
