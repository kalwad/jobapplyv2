"""Actual owned loopback socket and private child-pipe lifecycle tests."""

from __future__ import annotations

# Test children use this interpreter and argv-only invocation, never a shell.
# Literal protocol lengths, statuses and exit codes are independent assertions.
# ruff: noqa: S603, PLR2004
import importlib
import json
import os
import queue
import socket
import struct
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from http.client import HTTPConnection
from types import SimpleNamespace
from typing import TYPE_CHECKING, Protocol

import pytest
from japp_contracts.common.envelope_v1 import CommonEnvelopeV1EnvelopedRecord
from japp_contracts.service.ready_v1 import ServiceReadyV1

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

TOKEN = "a" * 64
INSTANCE = "svc_00000000000000000000000001"
CONFIG: dict[str, object] = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 0,
    "session_token": TOKEN,
    "instance_id": INSTANCE,
    "generation": 7,
}


def frame(value: object) -> bytes:
    payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return struct.pack(">I", len(payload)) + payload


class Readable(Protocol):
    def read(self, length: int = -1, /) -> bytes: ...


def bounded_read(stream: Readable, length: int, timeout: float = 8.0) -> bytes:
    result: queue.Queue[bytes] = queue.Queue(maxsize=1)

    def read() -> None:
        result.put(stream.read(length))

    threading.Thread(target=read, daemon=True).start()
    return result.get(timeout=timeout)


@contextmanager
def child(directory: Path, *arguments: str) -> Iterator[subprocess.Popen[bytes]]:
    # Explicit clean synthetic environment: no inherited token, PYTHONPATH or SDK.
    process = subprocess.Popen(
        [sys.executable, "-m", "orchestrator", *arguments],
        cwd=directory,
        env={"SYSTEMROOT": os.environ["SYSTEMROOT"]}
        if "SYSTEMROOT" in os.environ
        else {},
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        yield process
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)
        for stream in (process.stdin, process.stdout, process.stderr):
            if stream is not None:
                stream.close()


def submit(process: subprocess.Popen[bytes], payload: bytes) -> None:
    assert process.stdin is not None
    process.stdin.write(payload)
    process.stdin.flush()


def acknowledgement(process: subprocess.Popen[bytes]) -> dict[str, object]:
    assert process.stdout is not None
    prefix = bounded_read(process.stdout, 4)
    assert len(prefix) == 4, "child must own the socket and finish startup before ACK"
    length = struct.unpack(">I", prefix)[0]
    assert 0 < length <= 4096
    payload = bounded_read(process.stdout, length)
    assert len(payload) == length
    result: object = json.loads(payload)
    assert isinstance(result, dict)
    assert set(result) == {
        "protocol",
        "schema_version",
        "status",
        "bind_host",
        "bind_port",
        "instance_id",
        "generation",
    }
    assert result["protocol"] == "JAPP_SERVICE_STATUS_V1"
    assert result["schema_version"] == "1.0.0"
    assert result["status"] == "READY"
    assert result["bind_host"] == "127.0.0.1"
    assert result["instance_id"] == INSTANCE
    assert result["generation"] == 7
    assert TOKEN.encode() not in payload
    return result


def clean_exit_output(process: subprocess.Popen[bytes], expected: int) -> None:
    assert process.wait(timeout=8) == expected
    assert process.stdout is not None
    assert process.stderr is not None
    assert process.stdout.read() == b""
    diagnostic = process.stderr.read()
    assert len(diagnostic) <= 256
    assert TOKEN.encode() not in diagnostic
    assert b"Traceback" not in diagnostic


def test_actual_service_owns_acknowledged_port_and_stops_on_parent_eof(
    tmp_path: Path,
) -> None:
    with child(tmp_path) as process:
        submit(process, frame(CONFIG))
        ack = acknowledgement(process)
        port = ack["bind_port"]
        assert isinstance(port, int)
        assert 0 < port <= 65535
        # The pipe identity ACK establishes ownership before sending the secret.
        connection = HTTPConnection("127.0.0.1", port, timeout=3)
        try:
            connection.request(
                "GET", "/api/v1/ready", headers={"Authorization": "Bearer " + TOKEN}
            )
            response = connection.getresponse()
            assert response.status == 200
            envelope = CommonEnvelopeV1EnvelopedRecord.model_validate_json(
                response.read()
            )
            payload = ServiceReadyV1.model_validate(envelope.payload)
            assert payload.instance_id == INSTANCE
            assert payload.generation == 7
            assert envelope.envelope.schema_id == "urn:japp:schema:service:ready:v1"
            connection.request("GET", "/api/v1/health")
            response = connection.getresponse()
            assert response.status == 401
            response.read()
        finally:
            connection.close()
        assert process.stdin is not None
        process.stdin.close()
        clean_exit_output(process, 0)
        with pytest.raises(ConnectionRefusedError):
            socket.create_connection(("127.0.0.1", port), timeout=0.2)


def test_bind_collision_exits_72_without_ack_or_disturbing_owner(
    tmp_path: Path,
) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as owner:
        owner.bind(("127.0.0.1", 0))
        owner.listen(1)
        port = owner.getsockname()[1]
        with child(tmp_path) as process:
            submit(process, frame({**CONFIG, "bind_port": port}))
            clean_exit_output(process, 72)
        with socket.create_connection(("127.0.0.1", port), timeout=1) as probe:
            owner.settimeout(1)
            accepted, _address = owner.accept()
            accepted.close()
            assert probe.getpeername()[1] == port


@pytest.mark.parametrize(
    "payload",
    [
        struct.pack(">I", 4097),
        struct.pack(">I", 0),
        struct.pack(">I", 2) + b"\xff\xff",
        struct.pack(">I", 2) + b"[]",
        struct.pack(">I", 1) + b"{",
        frame({**CONFIG, "bind_host": "localhost"}),
        frame({**CONFIG, "session_token": ""}),
        frame({**CONFIG, "extra": "unexpected"}),
        struct.pack(">I", 13) + b'{"a":1,"a":2}',
    ],
    ids=[
        "oversize",
        "empty",
        "utf8",
        "array",
        "json",
        "host",
        "token",
        "extra",
        "duplicate",
    ],
)
def test_invalid_private_bootstrap_exits_safely(tmp_path: Path, payload: bytes) -> None:
    with child(tmp_path) as process:
        submit(process, payload)
        clean_exit_output(process, 64)


@pytest.mark.parametrize(
    "payload",
    [b"", b"\x00\x00", struct.pack(">I", 100) + b"{}"],
    ids=["empty", "header", "payload"],
)
def test_truncated_bootstrap_eof_exits_without_listener(
    tmp_path: Path, payload: bytes
) -> None:
    with child(tmp_path) as process:
        submit(process, payload)
        assert process.stdin is not None
        process.stdin.close()
        clean_exit_output(process, 64)


def test_bootstrap_deadline_is_finite_without_parent_input(tmp_path: Path) -> None:
    started = time.monotonic()
    with child(tmp_path) as process:
        clean_exit_output(process, 64)
    assert time.monotonic() - started < 7


def test_command_line_never_accepts_credentials_or_bind_overrides(
    tmp_path: Path,
) -> None:
    with child(tmp_path, "--token", TOKEN, "--host", "127.0.0.1") as process:
        clean_exit_output(process, 64)


def test_extra_private_pipe_data_withdraws_service(tmp_path: Path) -> None:
    with child(tmp_path) as process:
        submit(process, frame(CONFIG))
        acknowledgement(process)
        submit(process, b"unexpected")
        clean_exit_output(process, 64)


def test_bootstrap_decoder_rejects_duplicate_canonical_fields() -> None:
    duplicate = json.dumps(CONFIG)[:-1] + ', "bind_host":"127.0.0.1"}'
    module = importlib.import_module("orchestrator.bootstrap")
    with pytest.raises(ValueError, match="invalid private bootstrap"):
        module.decode_bootstrap(duplicate.encode("utf-8"))


def test_windows_private_pipe_descriptors_disable_text_translation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = importlib.import_module("orchestrator.bootstrap")
    configured: list[tuple[int, int]] = []

    def binary_mode(descriptor: int, mode: int) -> None:
        configured.append((descriptor, mode))

    monkeypatch.setattr(module, "sys", SimpleNamespace(platform="win32"), raising=False)
    monkeypatch.setattr(module, "os", SimpleNamespace(O_BINARY=32768))
    monkeypatch.setitem(sys.modules, "msvcrt", SimpleNamespace(setmode=binary_mode))
    module.prepare_private_stdio(17, 19)
    assert configured == [(17, 32768), (19, 32768)]
