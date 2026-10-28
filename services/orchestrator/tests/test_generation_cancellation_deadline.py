"""Unexecuted counterexamples for the two v1 independent source findings."""

from __future__ import annotations

# Literal operation counts and projected budgets are independent test oracles.
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
from orchestrator.generation import ErrorCode, GenerationFailure, Limits
from orchestrator.generation.types import (
    Audit,
    ByteStream,
    CandidateDocument,
    Request,
    Result,
)


@pytest.mark.parametrize("operation", ["cancel", "disconnect"])
@pytest.mark.parametrize("order", ["caller_first", "provider_first"])
def test_caller_cancellation_survives_both_provider_overlap_orders(
    operation: str,
    order: str,
) -> None:
    async def scenario() -> None:
        stream = _Stream((), asyncio.Event())
        client = _client(_Transport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        if order == "caller_first":
            running.cancel("caller-origin")
        if operation == "cancel":
            assert await client.cancel("request.one")
            assert await client.cancel("request.one")
        else:
            await client.disconnect()
            await client.disconnect()
        if order == "provider_first":
            running.cancel("caller-origin")
        with pytest.raises(asyncio.CancelledError):
            await running
        assert running.cancelling() >= 1
        assert stream.closed
        assert not await client.cancel("request.one")

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["cancel", "disconnect"])
def test_sole_provider_cancellation_is_idempotent_and_consumes_only_its_own_count(
    operation: str,
) -> None:
    async def scenario() -> None:
        stream = _Stream((), asyncio.Event())
        client = _client(_Transport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        if operation == "cancel":
            assert await client.cancel("request.one")
            assert await client.cancel("request.one")
        else:
            await client.disconnect()
            await client.disconnect()
        assert running.cancelling() == 1
        with pytest.raises(GenerationFailure) as caught:
            await running
        assert caught.value.code is ErrorCode.CANCELLED
        assert running.cancelling() == 0
        assert stream.closed

    asyncio.run(scenario())


class _ReplacedCancellationStream(_Stream):
    async def __anext__(self) -> bytes:
        try:
            return await super().__anext__()
        except asyncio.CancelledError:
            raise asyncio.CancelledError("transport-replaced-cancellation") from None


def test_ambiguous_replaced_cancel_marker_is_never_consumed() -> None:
    async def scenario() -> None:
        stream = _ReplacedCancellationStream((), asyncio.Event())
        client = _client(_Transport(stream))
        running = asyncio.create_task(client.generate(_request()))
        await stream.entered.wait()
        assert await client.cancel("request.one")
        with pytest.raises(asyncio.CancelledError):
            await running
        assert running.cancelling() == 1
        assert stream.closed

    asyncio.run(scenario())


class _Clock:
    def __init__(self) -> None:
        self.now = asyncio.get_running_loop().time()

    def read(self) -> float:
        return self.now

    def advance(self, seconds: float = 2.0) -> None:
        self.now += seconds


class _ProjectionStream(_Stream):
    def __init__(self, body: bytes, clock: _Clock, stage: str) -> None:
        super().__init__((body,))
        self.clock = clock
        self.stage = stage

    async def __anext__(self) -> bytes:
        value = await super().__anext__()
        if self.stage == "read":
            self.clock.advance()
        return value

    def close(self) -> None:
        super().close()
        if self.stage == "close":
            self.clock.advance()


class _ProjectionTransport(_Transport):
    def __init__(self, stream: _Stream, clock: _Clock, stage: str) -> None:
        super().__init__(stream)
        self.clock = clock
        self.stage = stage

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        if self.stage == "open":
            self.clock.advance()
        return stream


@pytest.mark.parametrize(
    "stage", ["open", "read", "close", "parse", "result", "malformed"]
)
def test_ready_stream_overruns_refuse_at_original_deadline_without_a_timer_yield(
    stage: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        original_parse = client_module._candidate_document

        def projected_parse(content: str, request: Request) -> CandidateDocument:
            if stage == "malformed":
                clock.advance()
            document = original_parse(content, request)
            if stage == "parse":
                clock.advance()
            return document

        def projected_result(document: CandidateDocument, audit: Audit) -> Result:
            result = Result(document, audit)
            if stage == "result":
                clock.advance()
            return result

        monkeypatch.setattr(client_module, "_candidate_document", projected_parse)
        monkeypatch.setattr(client_module, "Result", projected_result)
        content = "broken" if stage == "malformed" else _DOCUMENT.model_dump_json()
        stream = _ProjectionStream(_frame(content), clock, stage)
        transport = _ProjectionTransport(stream, clock, stage)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=1.0))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert len(transport.calls) == 1
        assert stream.closed
        assert caught.value.audit is not None
        assert caught.value.audit.output_sha256 is None

    asyncio.run(scenario())


class _RetryProjectionTransport(_Transport):
    def __init__(self, clock: _Clock, *streams: _Stream) -> None:
        super().__init__(*streams)
        self.clock = clock

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        stream = await super().open(payload, limits)
        self.clock.advance(0.75 if len(self.calls) == 1 else 0.5)
        return stream


def test_malformed_repair_never_renews_the_original_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        first = _Stream((_frame("broken"),))
        second = _Stream((_frame(_DOCUMENT.model_dump_json()),))
        transport = _RetryProjectionTransport(clock, first, second)
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=1.0))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert len(transport.calls) == 2
        assert first.closed
        assert second.closed
        assert caught.value.audit is not None
        assert caught.value.audit.attempts == 2

    asyncio.run(scenario())


def test_preflight_normalization_consumes_the_same_entry_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = _Clock()
        monkeypatch.setattr(client_module, "_monotonic", clock.read)
        original_normalize = client_module._normalize

        def projected_normalize(request: Request) -> Request:
            normalized = original_normalize(request)
            clock.advance()
            return normalized

        monkeypatch.setattr(client_module, "_normalize", projected_normalize)
        transport = _Transport()
        with pytest.raises(GenerationFailure) as caught:
            await _client(transport).generate(
                _request(limits=Limits(total_seconds=1.0))
            )
        assert caught.value.code is ErrorCode.TIMEOUT
        assert transport.calls == []

    asyncio.run(scenario())
