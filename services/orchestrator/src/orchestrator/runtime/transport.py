"""Finite metadata requests sharing the reviewed generation HTTP framing."""

from __future__ import annotations

import asyncio
import json
import socket
from enum import StrEnum
from typing import Protocol

from orchestrator.generation.transport import _headers, _LocalStream
from orchestrator.generation.types import ErrorCode, GenerationFailure, Limits

_HOST = "127.0.0.1"
_MAX_PORT = 65535
_READER_LIMIT = 8193
_MAX_REQUEST_BYTES = 512


class Target(StrEnum):
    GEMMA12B = "gemma4:12b-mlx"
    QWEN14B = "qwen3:14b"


class Operation(StrEnum):
    VERSION = "/api/version"
    TAGS = "/api/tags"
    SHOW = "/api/show"


class MetadataTransport(Protocol):
    async def request(
        self, operation: Operation, target: Target, limits: Limits
    ) -> bytes: ...


def _valid_ids(operation: object, target: object) -> bool:
    return isinstance(operation, Operation) and isinstance(target, Target)


class LocalMetadataTransport:
    """No host, URL, proxy, cookie, credential, lifecycle or inference input."""

    def __init__(self, port: int = 11434) -> None:
        if type(port) is not int or not 1 <= port <= _MAX_PORT:
            raise GenerationFailure(ErrorCode.INVALID_REQUEST)
        self._port = port

    async def request(
        self, operation: Operation, target: Target, limits: Limits
    ) -> bytes:
        async with asyncio.timeout(min(limits.total_seconds, 15.0)):
            return await self._request(operation, target, limits)

    async def _request(
        self, operation: Operation, target: Target, limits: Limits
    ) -> bytes:
        if not _valid_ids(operation, target):
            raise GenerationFailure(ErrorCode.INVALID_REQUEST)
        payload = (
            json.dumps(
                {"model": target.value, "verbose": False}, separators=(",", ":")
            ).encode("ascii")
            if operation is Operation.SHOW
            else b""
        )
        if len(payload) > _MAX_REQUEST_BYTES:
            raise GenerationFailure(ErrorCode.LIMIT)
        writer: asyncio.StreamWriter | None = None
        stream: _LocalStream | None = None
        try:
            async with asyncio.timeout(limits.idle_seconds):
                reader, writer = await asyncio.open_connection(
                    _HOST,
                    self._port,
                    family=socket.AF_INET,
                    flags=socket.AI_NUMERICHOST,
                    limit=_READER_LIMIT,
                )
                method = "POST" if operation is Operation.SHOW else "GET"
                head = (
                    f"{method} {operation.value} HTTP/1.1\r\n"
                    f"Host: {_HOST}:{self._port}\r\n"
                    "Content-Type: application/json\r\n"
                    "Accept: application/json\r\n"
                    "Connection: close\r\n"
                    f"Content-Length: {len(payload)}\r\n\r\n"
                ).encode("ascii")
                writer.write(head + payload)
                await writer.drain()
                headers = await _headers(reader)
            if (
                headers.get("content-type", "").lower()
                not in {
                    "application/json",
                    "application/json; charset=utf-8",
                }
                or "content-encoding" in headers
            ):
                raise GenerationFailure(ErrorCode.PROTOCOL)
            stream = _LocalStream(reader, writer, headers, limits)
            chunks: list[bytes] = []
            while True:
                try:
                    async with asyncio.timeout(limits.idle_seconds):
                        chunk = await anext(stream)
                except StopAsyncIteration:
                    return b"".join(chunks)
                chunks.append(chunk)
        except TimeoutError:
            raise
        except (OSError, asyncio.IncompleteReadError) as error:
            raise GenerationFailure(ErrorCode.TRANSPORT) from error
        finally:
            if stream is not None:
                stream.close()
            elif writer is not None:
                writer.transport.abort()
