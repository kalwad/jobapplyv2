"""Actual owned loopback HTTP; every response and input is synthetic model data."""

from __future__ import annotations

# Exact framing and token counts are independent adapter oracles.
# ruff: noqa: PLR2004
import asyncio
import json
import socket
from collections.abc import AsyncIterator, Callable, Coroutine
from contextlib import asynccontextmanager

import pytest
from services.orchestrator.tests.test_generation_boundary import (
    _DOCUMENT,
    _MODEL,
    _PROFILE,
    _frame,
    _request,
)

from orchestrator.generation import ErrorCode, GenerationClient, GenerationFailure
from orchestrator.generation.transport import LocalOllamaTransport

_Handler = Callable[
    [asyncio.StreamReader, asyncio.StreamWriter], Coroutine[object, object, None]
]
_HEAD = b"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\n"


@asynccontextmanager
async def _server(handler: _Handler) -> AsyncIterator[int]:
    async with asyncio.TaskGroup() as group:

        def accept(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
            group.create_task(handler(reader, writer))

        server = await asyncio.start_server(
            accept,
            "127.0.0.1",
            0,
            family=socket.AF_INET,
            flags=socket.AI_NUMERICHOST,
            limit=8192,
        )
        try:
            address = server.sockets[0].getsockname()
            assert address[0] == "127.0.0.1"
            assert type(address[1]) is int
            yield address[1]
        finally:
            server.close()
            await server.wait_closed()


async def _incoming(
    reader: asyncio.StreamReader,
) -> tuple[dict[str, str], dict[str, object]]:
    head = await reader.readuntil(b"\r\n\r\n")
    lines = head.decode("ascii").split("\r\n")
    assert lines[0] == "POST /api/chat HTTP/1.1"
    headers = dict(line.split(": ", 1) for line in lines[1:] if line)
    assert headers["Connection"] == "close"
    assert "Authorization" not in headers
    assert "Cookie" not in headers
    length = int(headers["Content-Length"])
    assert 1 <= length <= 32768
    payload: object = json.loads(await reader.readexactly(length))
    assert isinstance(payload, dict)
    assert payload["model"] == _MODEL
    assert payload["think"] is False
    assert payload["stream"] is True
    return headers, payload


def _client(port: int) -> GenerationClient:
    return GenerationClient(
        (_PROFILE,),
        default_local_profile=_PROFILE.profile_ref,
        local_transport=LocalOllamaTransport(port),
    )


@pytest.mark.parametrize("framing", ["fixed", "chunked", "eof"])
def test_actual_loopback_http_returns_only_unverified_candidates(framing: str) -> None:
    async def scenario() -> None:
        observed: list[dict[str, str]] = []

        async def handle(
            reader: asyncio.StreamReader, writer: asyncio.StreamWriter
        ) -> None:
            try:
                headers, _ = await _incoming(reader)
                observed.append(headers)
                body = _frame(_DOCUMENT.model_dump_json())
                if framing == "fixed":
                    response = (
                        _HEAD
                        + f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
                        + body
                    )
                elif framing == "chunked":
                    pieces = (body[: len(body) // 2], body[len(body) // 2 :])
                    response = (
                        _HEAD
                        + b"Transfer-Encoding: chunked\r\n\r\n"
                        + b"".join(
                            f"{len(piece):x}\r\n".encode("ascii") + piece + b"\r\n"
                            for piece in pieces
                        )
                        + b"0\r\n\r\n"
                    )
                else:
                    assert framing == "eof"
                    response = _HEAD + b"\r\n" + body
                writer.write(response)
                await writer.drain()
            finally:
                writer.close()
                try:
                    await writer.wait_closed()
                except ConnectionResetError:
                    assert writer.is_closing()

        async with asyncio.timeout(3.0), _server(handle) as port:
            result = await _client(port).generate(_request())
            assert len(observed) == 1
            assert observed[0]["Host"] == f"127.0.0.1:{port}"
            assert result.candidates == _DOCUMENT
            assert result.audit.egress_policy == "LOOPBACK_ONLY"
            assert result.audit.prompt_tokens == 7
            assert result.audit.output_tokens == 11
            assert not result.audit.runtime_digest_verified
            assert not result.release_permitted
            assert result.verification_state == "PENDING_ATOMIC_CLAIM_VERIFICATION"

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["cancel", "disconnect"])
def test_actual_loopback_cancellation_aborts_the_owned_connection(
    operation: str,
) -> None:
    async def scenario() -> None:
        ready = asyncio.Event()
        peer_closed = asyncio.Event()

        async def handle(
            reader: asyncio.StreamReader, writer: asyncio.StreamWriter
        ) -> None:
            try:
                await _incoming(reader)
                writer.write(_HEAD + b"Transfer-Encoding: chunked\r\n\r\n")
                await writer.drain()
                ready.set()
                try:
                    assert await reader.read(1) == b""
                except ConnectionResetError:
                    # TCP abort may surface as reset rather than graceful EOF.
                    assert reader.exception() is not None
                peer_closed.set()
            finally:
                writer.close()
                try:
                    await writer.wait_closed()
                except ConnectionResetError:
                    assert writer.is_closing()

        async with asyncio.timeout(3.0), _server(handle) as port:
            client = _client(port)
            running = asyncio.create_task(client.generate(_request()))
            await ready.wait()
            if operation == "cancel":
                assert await client.cancel("request.one")
            else:
                await client.disconnect()
            with pytest.raises(GenerationFailure) as caught:
                await running
            assert caught.value.code is ErrorCode.CANCELLED
            assert caught.value.audit is not None
            assert caught.value.audit.output_sha256 is None
            assert running.cancelling() == 0
            await peer_closed.wait()
            assert not await client.cancel("request.one")

    asyncio.run(scenario())
