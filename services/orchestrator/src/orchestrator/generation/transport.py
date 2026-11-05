"""Bounded native HTTP/1.1 transport to a literal local Ollama address only."""

from __future__ import annotations

import asyncio
import re
import socket
from collections.abc import AsyncIterator

from orchestrator.generation.types import (
    ByteStream,
    ErrorCode,
    GenerationFailure,
    Limits,
)

_HOST = "127.0.0.1"
_PATH = "/api/chat"
_HEADER_LINE_BYTES = 8192
_HEADER_BYTES = 16384
_HEADER_COUNT = 32
_CHUNK_LINE_BYTES = 32
_READ_BYTES = 4096
_MAX_PORT = 65535
_SUCCESS = 200
_STATUS_PARTS = 3
_ASCII_CONTROL_BOUNDARY = 32
_ASCII_DELETE = 127


async def _line(reader: asyncio.StreamReader) -> bytes:
    try:
        line = await reader.readline()
    except (ValueError, asyncio.LimitOverrunError) as error:
        raise GenerationFailure(ErrorCode.PROTOCOL) from error
    if not line.endswith(b"\r\n") or len(line) > _HEADER_LINE_BYTES:
        raise GenerationFailure(ErrorCode.PROTOCOL)
    return line[:-2]


async def _headers(reader: asyncio.StreamReader) -> dict[str, str]:
    status = await _line(reader)
    parts = status.split(b" ", 2)
    if (
        len(parts) != _STATUS_PARTS
        or parts[0] != b"HTTP/1.1"
        or re.fullmatch(rb"[0-9]{3}", parts[1]) is None
    ):
        raise GenerationFailure(ErrorCode.PROTOCOL)
    if int(parts[1]) != _SUCCESS:
        # Upstream body and status text never enter exception messages or logs.
        raise GenerationFailure(ErrorCode.PROVIDER_ERROR)
    headers: dict[str, str] = {}
    total = len(status)
    for _ in range(_HEADER_COUNT):
        line = await _line(reader)
        total += len(line) + 2
        if total > _HEADER_BYTES:
            raise GenerationFailure(ErrorCode.PROTOCOL)
        if not line:
            return headers
        key, separator, value = line.partition(b":")
        if not separator or re.fullmatch(rb"[A-Za-z0-9-]+", key) is None:
            raise GenerationFailure(ErrorCode.PROTOCOL)
        try:
            name = key.decode("ascii").lower()
            text = value.decode("ascii").strip(" \t")
        except UnicodeError as error:
            raise GenerationFailure(ErrorCode.PROTOCOL) from error
        if name in headers or any(
            ord(character) < _ASCII_CONTROL_BOUNDARY or ord(character) == _ASCII_DELETE
            for character in text
        ):
            raise GenerationFailure(ErrorCode.PROTOCOL)
        headers[name] = text
    raise GenerationFailure(ErrorCode.PROTOCOL)


def _content_length(value: str | None, limit: int) -> int | None:
    if value is None:
        return None
    if re.fullmatch(r"[0-9]{1,9}", value) is None:
        raise GenerationFailure(ErrorCode.PROTOCOL)
    length = int(value)
    if length > limit:
        raise GenerationFailure(ErrorCode.LIMIT)
    return length


class _LocalStream:
    def __init__(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        headers: dict[str, str],
        limits: Limits,
    ) -> None:
        self._reader = reader
        self._writer = writer
        self._headers = headers
        self._limits = limits
        self._closed = False
        self._body = self._chunks()

    def __aiter__(self) -> _LocalStream:
        return self

    async def __anext__(self) -> bytes:
        if self._closed:
            raise StopAsyncIteration
        try:
            return await anext(self._body)
        except (OSError, asyncio.IncompleteReadError) as error:
            raise GenerationFailure(ErrorCode.TRANSPORT) from error

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            # No awaited flush, worker thread, or shielded cleanup task can outlive
            # cancellation. This closes our socket; server inference shutdown is
            # not attested by transport closure.
            self._writer.transport.abort()

    async def _chunks(self) -> AsyncIterator[bytes]:
        encoding = self._headers.get("transfer-encoding")
        length = self._headers.get("content-length")
        if encoding is not None and length is not None:
            raise GenerationFailure(ErrorCode.PROTOCOL)
        if encoding is not None:
            if encoding.lower() != "chunked":
                raise GenerationFailure(ErrorCode.PROTOCOL)
            async for chunk in self._chunked():
                yield chunk
            return
        remaining = _content_length(length, self._limits.wire_bytes)
        total = 0
        while remaining is None or remaining > 0:
            size = _READ_BYTES if remaining is None else min(_READ_BYTES, remaining)
            chunk = await self._reader.read(size)
            if not chunk:
                if remaining is not None and remaining != 0:
                    raise GenerationFailure(ErrorCode.PROTOCOL)
                return
            total += len(chunk)
            if total > self._limits.wire_bytes:
                raise GenerationFailure(ErrorCode.LIMIT)
            if remaining is not None:
                remaining -= len(chunk)
            yield chunk
        if await self._reader.read(1):
            raise GenerationFailure(ErrorCode.PROTOCOL)

    async def _chunked(self) -> AsyncIterator[bytes]:
        total = 0
        for _ in range(self._limits.frames):
            line = await _line(self._reader)
            if (
                len(line) > _CHUNK_LINE_BYTES
                or re.fullmatch(rb"[0-9A-Fa-f]{1,8}", line) is None
            ):
                raise GenerationFailure(ErrorCode.PROTOCOL)
            remaining = int(line, 16)
            if remaining == 0:
                # Trailers/extensions are outside this intentionally closed subset.
                if await self._reader.readexactly(2) != b"\r\n":
                    raise GenerationFailure(ErrorCode.PROTOCOL)
                if await self._reader.read(1):
                    raise GenerationFailure(ErrorCode.PROTOCOL)
                return
            total += remaining
            if total > self._limits.wire_bytes:
                raise GenerationFailure(ErrorCode.LIMIT)
            while remaining:
                chunk = await self._reader.readexactly(min(_READ_BYTES, remaining))
                remaining -= len(chunk)
                yield chunk
            if await self._reader.readexactly(2) != b"\r\n":
                raise GenerationFailure(ErrorCode.PROTOCOL)
        raise GenerationFailure(ErrorCode.LIMIT)


class LocalOllamaTransport:
    """No URL input, DNS, proxy/env handling, redirects, cookies, or credentials."""

    def __init__(self, port: int = 11434) -> None:
        if type(port) is not int or not 1 <= port <= _MAX_PORT:
            raise GenerationFailure(ErrorCode.INVALID_REQUEST)
        self._port = port

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        if type(payload) is not bytes or len(payload) > limits.input_bytes:
            raise GenerationFailure(ErrorCode.LIMIT)
        writer: asyncio.StreamWriter | None = None
        try:
            reader, writer = await asyncio.open_connection(
                _HOST,
                self._port,
                family=socket.AF_INET,
                flags=socket.AI_NUMERICHOST,
                limit=_HEADER_LINE_BYTES + 1,
            )
            head = (
                f"POST {_PATH} HTTP/1.1\r\n"
                f"Host: {_HOST}:{self._port}\r\n"
                "Content-Type: application/json\r\n"
                "Accept: application/x-ndjson\r\n"
                "Connection: close\r\n"
                f"Content-Length: {len(payload)}\r\n\r\n"
            ).encode("ascii")
            writer.write(head + payload)
            await writer.drain()
            headers = await _headers(reader)
            if (
                headers.get("content-type", "").lower()
                not in {
                    "application/x-ndjson",
                    "application/x-ndjson; charset=utf-8",
                }
                or "content-encoding" in headers
            ):
                raise GenerationFailure(ErrorCode.PROTOCOL)
            return _LocalStream(reader, writer, headers, limits)
        except (OSError, asyncio.IncompleteReadError) as error:
            if writer is not None:
                writer.transport.abort()
            raise GenerationFailure(ErrorCode.TRANSPORT) from error
        except BaseException:
            # Includes cancellation while connecting/sending/reading headers.
            if writer is not None:
                writer.transport.abort()
            raise
