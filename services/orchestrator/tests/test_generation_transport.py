"""In-memory HTTP framing counterexamples; no live Ollama or socket is used."""

from __future__ import annotations

# Literal HTTP framing bytes and counts are independent safety assertions.
# ruff: noqa: PLR2004
import asyncio
import socket

import pytest

from orchestrator.generation.transport import LocalOllamaTransport
from orchestrator.generation.types import ErrorCode, GenerationFailure, Limits

_PAYLOAD = b'{"synthetic":true}'
_NDJSON = b'{"synthetic":"body"}\n'
_HEAD = b"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\n"


class _Abort:
    def __init__(self) -> None:
        self.called = False

    def abort(self) -> None:
        self.called = True


class _Writer:
    def __init__(self) -> None:
        self.transport = _Abort()
        self.written = bytearray()

    def write(self, value: bytes) -> None:
        self.written.extend(value)

    async def drain(self) -> None:
        return


def _transport(
    response: bytes, monkeypatch: pytest.MonkeyPatch, *, eof: bool = True
) -> tuple[LocalOllamaTransport, _Writer]:
    reader = asyncio.StreamReader(limit=8193)
    reader.feed_data(response)
    if eof:
        reader.feed_eof()
    writer = _Writer()

    async def open_connection(
        host: str, port: int, **options: object
    ) -> tuple[asyncio.StreamReader, _Writer]:
        assert host == "127.0.0.1"
        assert port == 11434
        assert options == {
            "family": socket.AF_INET,
            "flags": socket.AI_NUMERICHOST,
            "limit": 8193,
        }
        return reader, writer

    monkeypatch.setattr(asyncio, "open_connection", open_connection)
    return LocalOllamaTransport(), writer


async def _body(transport: LocalOllamaTransport, limits: Limits | None = None) -> bytes:
    stream = await transport.open(_PAYLOAD, limits if limits is not None else Limits())
    try:
        return b"".join([chunk async for chunk in stream])
    finally:
        stream.close()


@pytest.mark.parametrize(
    "response",
    [
        _HEAD
        + b"Content-Length: "
        + str(len(_NDJSON)).encode("ascii")
        + b"\r\n\r\n"
        + _NDJSON,
        _HEAD
        + b"Transfer-Encoding: chunked\r\n\r\n"
        + f"{len(_NDJSON):x}".encode("ascii")
        + b"\r\n"
        + _NDJSON
        + b"\r\n0\r\n\r\n",
        _HEAD + b"\r\n" + _NDJSON,
    ],
)
def test_closed_bounded_http_framings_and_exact_local_request(
    response: bytes,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        transport, writer = _transport(response, monkeypatch)
        assert await _body(transport) == _NDJSON
        assert writer.transport.called
        head, body = bytes(writer.written).split(b"\r\n\r\n", 1)
        assert head.startswith(b"POST /api/chat HTTP/1.1\r\nHost: 127.0.0.1:11434\r\n")
        assert b"Connection: close" in head
        assert b"Authorization" not in head
        assert b"Cookie" not in head
        assert b"User-Agent" not in head
        assert body == _PAYLOAD

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "response",
    [
        b"HTTP/1.1 302 Found\r\nLocation: https://example.invalid\r\n\r\n",
        b"HTTP/1.1 200 OK\nContent-Type: application/x-ndjson\n\n",
        _HEAD + b"Content-Type: application/x-ndjson\r\n\r\n",
        _HEAD + b"Content-Encoding: gzip\r\n\r\n",
        _HEAD + b"Transfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n",
        _HEAD + b"Transfer-Encoding: gzip, chunked\r\n\r\n",
        _HEAD + b"Content-Length: -1\r\n\r\n",
        _HEAD + b"Content-Length: 1\r\n\r\nxtrailing",
        _HEAD + b"Content-Length: 100\r\n\r\nshort",
        _HEAD + b"Transfer-Encoding: chunked\r\n\r\n1;extension\r\nx\r\n0\r\n\r\n",
        _HEAD + b"Transfer-Encoding: chunked\r\n\r\n1\r\nx!!0\r\n\r\n",
        _HEAD + b"Transfer-Encoding: chunked\r\n\r\n0\r\nTrailer: value\r\n\r\n",
        _HEAD + b"Transfer-Encoding: chunked\r\n\r\n0\r\n\r\ntrailing",
        _HEAD + b"Too-Long: " + b"x" * 8192 + b"\r\n\r\n",
    ],
)
def test_malformed_http_closes_without_redirect_or_recovery(
    response: bytes,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        transport, writer = _transport(response, monkeypatch)
        with pytest.raises(GenerationFailure) as caught:
            await _body(transport)
        assert caught.value.code in {
            ErrorCode.PROTOCOL,
            ErrorCode.PROVIDER_ERROR,
            ErrorCode.TRANSPORT,
        }
        assert writer.transport.called

    asyncio.run(scenario())


def test_headers_and_body_cancellation_abort_the_local_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        transport, header_writer = _transport(
            b"HTTP/1.1 200 OK\r\n", monkeypatch, eof=False
        )
        async with asyncio.timeout(0.05):
            opening = asyncio.create_task(transport.open(_PAYLOAD, Limits()))
            await asyncio.sleep(0)
            opening.cancel()
            with pytest.raises(asyncio.CancelledError):
                await opening
        assert header_writer.transport.called
        transport, body_writer = _transport(_HEAD + b"\r\n", monkeypatch, eof=False)
        stream = await transport.open(_PAYLOAD, Limits())
        reading = asyncio.create_task(anext(stream))
        await asyncio.sleep(0)
        reading.cancel()
        try:
            with pytest.raises(asyncio.CancelledError):
                await reading
        finally:
            stream.close()
        assert body_writer.transport.called

    asyncio.run(scenario())


def test_wire_and_http_chunk_count_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        transport, writer = _transport(
            _HEAD + b"Content-Length: 999\r\n\r\n", monkeypatch
        )
        with pytest.raises(GenerationFailure) as oversized:
            await _body(transport, Limits(wire_bytes=5))
        assert oversized.value.code is ErrorCode.LIMIT
        assert writer.transport.called
        transport, writer = _transport(
            _HEAD + b"Transfer-Encoding: chunked\r\n\r\n1\r\nx\r\n1\r\ny\r\n0\r\n\r\n",
            monkeypatch,
        )
        with pytest.raises(GenerationFailure) as many_chunks:
            await _body(transport, Limits(frames=1))
        assert many_chunks.value.code is ErrorCode.LIMIT
        assert writer.transport.called

    asyncio.run(scenario())


@pytest.mark.parametrize("port", [0, -1, 65536, True])
def test_transport_has_no_url_or_nonlocal_host_input(port: int) -> None:
    with pytest.raises(GenerationFailure) as caught:
        LocalOllamaTransport(port=port)
    assert caught.value.code is ErrorCode.INVALID_REQUEST
