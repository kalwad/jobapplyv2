"""Shared-parser checks and an owned ephemeral loopback metadata server."""

from __future__ import annotations

# Literal HTTP framing and call counts are independent transport oracles.
# ruff: noqa: PLR2004
import asyncio
import json
import socket
from typing import cast

import pytest

from orchestrator.generation.types import GenerationFailure, Limits
from orchestrator.runtime.metadata import ProbeLimits, RuntimeDiscovery, State
from orchestrator.runtime.transport import LocalMetadataTransport, Operation, Target


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


def _fake(
    response: bytes, monkeypatch: pytest.MonkeyPatch, *, eof: bool = True
) -> tuple[LocalMetadataTransport, _Writer]:
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
    return LocalMetadataTransport(), writer


@pytest.mark.parametrize("operation", list(Operation))
def test_finite_requests_never_include_provider_credentials_or_inference(
    operation: Operation, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        transport, writer = _fake(
            (
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                b"Content-Length: 2\r\n\r\n{}"
            ),
            monkeypatch,
        )
        assert await transport.request(operation, Target.GEMMA12B, Limits()) == b"{}"
        assert writer.transport.called
        request = bytes(writer.written)
        assert b"Authorization" not in request
        assert b"Cookie" not in request
        assert b"/api/chat" not in request
        assert b"/api/generate" not in request
        head, body = request.split(b"\r\n\r\n", 1)
        if operation is Operation.SHOW:
            assert head.startswith(b"POST /api/show HTTP/1.1")
            assert json.loads(body) == {"model": "gemma4:12b-mlx", "verbose": False}
        else:
            assert head.startswith(b"GET " + operation.value.encode() + b" HTTP/1.1")
            assert body == b""

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "response",
    [
        b"HTTP/1.1 302 Found\r\nLocation: https://example.invalid\r\n\r\n",
        b"HTTP/1.1 200 OK\r\nContent-Type: \x01application/json\r\n\r\n{}",
        b"HTTP/1.1 200 OK\r\nContent-Type: application/json\x0b\r\n\r\n{}",
        (
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Encoding: gzip\r\n\r\n{}"
        ),
        (
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n{}"
        ),
        (
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: 2\r\n\r\n{}extra"
        ),
    ],
)
def test_shared_http_parser_rejects_redirects_c0_and_ambiguous_framing(
    response: bytes, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        transport, writer = _fake(response, monkeypatch)
        with pytest.raises(GenerationFailure):
            await transport.request(Operation.TAGS, Target.GEMMA12B, Limits())
        assert writer.transport.called

    asyncio.run(scenario())


@pytest.mark.parametrize("phase", ["header", "body"])
def test_cancel_aborts_its_own_metadata_socket(
    phase: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        response = (
            b"HTTP/1.1 200 OK\r\n"
            if phase == "header"
            else (
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                b"Content-Length: 2\r\n\r\n"
            )
        )
        transport, writer = _fake(response, monkeypatch, eof=False)
        task = asyncio.create_task(
            transport.request(Operation.VERSION, Target.GEMMA12B, Limits())
        )
        await asyncio.sleep(0)
        task.cancel("caller")
        with pytest.raises(asyncio.CancelledError):
            await task
        assert writer.transport.called

    asyncio.run(scenario())


def _server_value(head: bytes, body: bytes) -> object:
    digest = "ded7a27350032202d9e9b2a6071e8aa89959ab156771b5228f30863c741c4970"
    if head.startswith(b"GET /api/version "):
        value: object = {"version": "0.40.2"}
    elif head.startswith(b"GET /api/tags "):
        value = {
            "models": [
                {
                    "name": "gemma4:12b-mlx",
                    "digest": digest,
                    "size": 7714091504,
                    "details": {"format": "safetensors", "runner": "mlx"},
                }
            ]
        }
    else:
        assert head.startswith(b"POST /api/show ")
        assert json.loads(body) == {
            "model": "gemma4:12b-mlx",
            "verbose": False,
        }
        value = {
            "details": {"format": "safetensors", "runner": "mlx"},
            "capabilities": ["completion", "thinking"],
            "thinking": {"values": [False, True], "default": True},
        }
    return value


def test_owned_loopback_server_is_ephemeral_metadata_only_and_fully_closed() -> None:
    async def scenario() -> None:
        requests: list[bytes] = []
        errors: list[BaseException] = []
        active: set[asyncio.Task[None]] = set()

        async def handle(
            reader: asyncio.StreamReader, writer: asyncio.StreamWriter
        ) -> None:
            current = asyncio.current_task()
            assert current is not None
            active.add(current)
            try:
                head = await reader.readuntil(b"\r\n\r\n")
                assert len(head) < 4096
                length = next(
                    int(row.split(b":", 1)[1])
                    for row in head.split(b"\r\n")
                    if row.lower().startswith(b"content-length:")
                )
                assert 0 <= length <= 512
                body = await reader.readexactly(length)
                requests.append(head + body)
                assert b"Authorization" not in head
                value = _server_value(head, body)
                data = json.dumps(value).encode()
                writer.write(
                    (
                        b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                        b"Content-Length: "
                    )
                    + str(len(data)).encode()
                    + b"\r\nConnection: close\r\n\r\n"
                    + data
                )
                await writer.drain()
            except BaseException as error:
                errors.append(error)
            finally:
                writer.close()
                await writer.wait_closed()
                active.discard(current)

        server = await asyncio.start_server(
            handle, "127.0.0.1", 0, family=socket.AF_INET
        )
        port = server.sockets[0].getsockname()[1]
        try:
            result = await RuntimeDiscovery(LocalMetadataTransport(port)).discover(
                Target.GEMMA12B, limits=ProbeLimits(total_seconds=5.0)
            )
            assert result.state is State.INSTALLED_UNQUALIFIED
            assert len(requests) == 3
            assert not result.runtime_digest_verified
        finally:
            server.close()
            await server.wait_closed()
            if active:
                await asyncio.gather(*tuple(active))
        assert errors == []
        assert active == set()
        assert not server.is_serving()

    asyncio.run(scenario())


@pytest.mark.parametrize("framing", ["fixed", "chunked", "eof"])
def test_json_metadata_reuses_all_three_closed_shared_body_framings(
    framing: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        head = b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
        tail = {
            "fixed": b"Content-Length: 2\r\n\r\n{}",
            "chunked": b"Transfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n",
            "eof": b"\r\n{}",
        }[framing]
        transport, writer = _fake(head + tail, monkeypatch)
        assert (
            await transport.request(Operation.TAGS, Target.QWEN14B, Limits()) == b"{}"
        )
        assert writer.transport.called

    asyncio.run(scenario())


@pytest.mark.parametrize("phase", ["header", "body"])
def test_idle_deadline_aborts_stalled_local_metadata_connection(
    phase: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        head = b"HTTP/1.1 200 OK\r\n"
        if phase == "body":
            head += b"Content-Type: application/json\r\nContent-Length: 2\r\n\r\n"
        transport, writer = _fake(head, monkeypatch, eof=False)
        with pytest.raises(TimeoutError):
            await transport.request(
                Operation.VERSION, Target.GEMMA12B, Limits(idle_seconds=0.01)
            )
        assert writer.transport.called

    asyncio.run(scenario())


@pytest.mark.parametrize("port", [0, 65536, True, "11434"])
def test_invalid_metadata_ports_cannot_open_a_connection(port: object) -> None:
    with pytest.raises(GenerationFailure):
        LocalMetadataTransport(cast(int, port))


def test_arbitrary_operation_is_rejected_before_any_socket(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        async def forbidden(*args: object, **kwargs: object) -> None:
            del args, kwargs
            raise AssertionError("unexpected socket")

        monkeypatch.setattr(asyncio, "open_connection", forbidden)
        with pytest.raises(GenerationFailure):
            await LocalMetadataTransport().request(
                cast(Operation, "/api/generate"), Target.GEMMA12B, Limits()
            )

    asyncio.run(scenario())
