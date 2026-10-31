"""Pure modeled observation tests; no service, socket, sleep or process runs."""

from __future__ import annotations

import errno
import importlib.util
import json
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import cast

import pytest

SPEC = importlib.util.spec_from_file_location(
    "service_cli_observation_subject", Path(__file__).with_name("test_service_cli.py")
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Service CLI test subject cannot be loaded")
SUBJECT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUBJECT)
ACK_PORT = 49152
CHILD_PID = 27182
HTTP_TIMEOUT = 3
MODELED_ELAPSED = 3.0
WINDOWS_ACCESS_DENIED = 10013


def modeled_observation(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    *,
    platform: str,
    result: str,
    refusal_delay: float,
) -> tuple[list[tuple[str, object]], SimpleNamespace]:
    events: list[tuple[str, object]] = []
    stdin = SimpleNamespace(closed=False)

    def close_input() -> None:
        stdin.closed = True
        events.append(("parent_eof", None))

    stdin.close = close_input
    process = cast(
        subprocess.Popen[bytes],
        SimpleNamespace(
            pid=CHILD_PID,
            returncode=0,
            stdin=stdin,
            stdout=SimpleNamespace(closed=False),
            stderr=SimpleNamespace(closed=False),
        ),
    )

    @contextmanager
    def child(_directory: Path) -> Iterator[subprocess.Popen[bytes]]:
        yield process

    def clean_exit(actual: subprocess.Popen[bytes], expected: int) -> None:
        assert actual is process
        assert expected == 0
        assert stdin.closed
        events.append(("clean_exit", actual.returncode))

    class Connection:
        def __init__(self, host: str, port: int, timeout: float) -> None:
            assert host == "127.0.0.1"
            assert port == ACK_PORT
            assert timeout == HTTP_TIMEOUT
            self.status = 200

        def request(
            self, method: str, path: str, headers: dict[str, str] | None = None
        ) -> None:
            assert method == "GET"
            if path == "/api/v1/ready":
                assert headers == {"Authorization": "Bearer " + SUBJECT.TOKEN}
                self.status = 200
            else:
                assert path == "/api/v1/health"
                assert headers is None
                self.status = 401
            events.append(("http", self.status))

        def getresponse(self) -> SimpleNamespace:
            return SimpleNamespace(status=self.status, read=lambda: b"{}")

        def close(self) -> None:
            events.append(("http_close", None))

    accepted = SimpleNamespace(closed=False)

    class ModeledPermissionError(PermissionError):
        winerror = WINDOWS_ACCESS_DENIED

    class Accepted:
        def close(self) -> None:
            accepted.closed = True

        def __enter__(self) -> Accepted:
            return self

        def __exit__(self, *_arguments: object) -> None:
            self.close()

    def connect(address: tuple[str, int], timeout: float) -> Accepted:
        assert address == ("127.0.0.1", ACK_PORT)
        assert events[-1] == ("clean_exit", 0)
        events.append(("probe_timeout", timeout))
        if result == "accepted":
            return Accepted()
        if result == "permission":
            raise ModeledPermissionError(
                errno.EACCES, "synthetic-private-" + SUBJECT.TOKEN
            )
        if result == "timeout" or timeout < refusal_delay:
            raise TimeoutError("synthetic-private-" + SUBJECT.TOKEN)
        raise ConnectionRefusedError(errno.ECONNREFUSED, "modeled refusal")

    monkeypatch.setattr(SUBJECT, "sys", SimpleNamespace(platform=platform))
    clock = iter([10.0, 10.0 + min(refusal_delay, 3.0)])
    monkeypatch.setattr(SUBJECT, "time", SimpleNamespace(monotonic=lambda: next(clock)))
    monkeypatch.setattr(SUBJECT, "child", child)
    monkeypatch.setattr(SUBJECT, "submit", lambda _process, _frame: None)
    monkeypatch.setattr(
        SUBJECT, "acknowledgement", lambda _process: {"bind_port": ACK_PORT}
    )
    monkeypatch.setattr(SUBJECT, "HTTPConnection", Connection)
    monkeypatch.setattr(SUBJECT, "clean_exit_output", clean_exit)
    monkeypatch.setattr(SUBJECT, "socket", SimpleNamespace(create_connection=connect))
    envelope = SimpleNamespace(
        payload={},
        envelope=SimpleNamespace(schema_id="urn:japp:schema:service:ready:v1"),
    )
    monkeypatch.setattr(
        SUBJECT,
        "CommonEnvelopeV1EnvelopedRecord",
        SimpleNamespace(model_validate_json=lambda _data: envelope),
    )
    monkeypatch.setattr(
        SUBJECT,
        "ServiceReadyV1",
        SimpleNamespace(
            model_validate=lambda _data: SimpleNamespace(
                instance_id=SUBJECT.INSTANCE, generation=7
            )
        ),
    )
    accepted.events = events
    accepted.invoke = lambda: (
        SUBJECT.test_actual_service_owns_acknowledged_port_and_stops_on_parent_eof(
            tmp_path
        )
    )
    return events, accepted


@pytest.mark.parametrize(
    ("platform", "delay", "budget"),
    [("win32", 0.5, 3.0), ("darwin", 0.01, 0.2), ("linux", 0.01, 0.2)],
)
def test_refusal_observation_is_one_attempt_after_validated_exit_with_scoped_budget(
    platform: str,
    delay: float,
    budget: float,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events, subject = modeled_observation(
        monkeypatch, tmp_path, platform=platform, result="refused", refusal_delay=delay
    )
    subject.invoke()
    assert events == [
        ("http", 200),
        ("http", 401),
        ("http_close", None),
        ("parent_eof", None),
        ("clean_exit", 0),
        ("probe_timeout", budget),
    ]


@pytest.mark.parametrize("platform", ["win32", "darwin", "linux"])
def test_timeout_still_fails_with_safe_owned_probe_diagnostic(
    platform: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    events, subject = modeled_observation(
        monkeypatch, tmp_path, platform=platform, result="timeout", refusal_delay=4.0
    )
    with pytest.raises(TimeoutError) as failure:
        subject.invoke()
    notes = getattr(failure.value, "__notes__", [])
    assert len(notes) == 1
    diagnostic = json.loads(notes[0])
    assert diagnostic["phase"] == "POST_EXIT_REFUSAL_OBSERVATION"
    assert diagnostic["child_exit_code"] == 0
    assert diagnostic["owned_child_pid"] == CHILD_PID
    assert diagnostic["acknowledged_port"] == ACK_PORT
    assert diagnostic["parent_pipe_closed"] is True
    assert diagnostic["error_kind"] == "TIMEOUT"
    assert diagnostic["errno"] is None
    assert diagnostic["winerror"] is None
    assert diagnostic["observation_budget_seconds"] == events[-1][1]
    assert diagnostic["elapsed_seconds"] == MODELED_ELAPSED
    assert SUBJECT.TOKEN not in notes[0]
    assert "synthetic-private" not in notes[0]
    assert [name for name, _value in events].count("probe_timeout") == 1


def test_accepted_connection_fails_and_owned_probe_is_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _events, subject = modeled_observation(
        monkeypatch, tmp_path, platform="win32", result="accepted", refusal_delay=0.5
    )
    with pytest.raises(pytest.fail.Exception) as failure:
        subject.invoke()
    assert subject.closed
    notes = getattr(failure.value, "__notes__", [])
    assert len(notes) == 1
    assert json.loads(notes[0])["error_kind"] == "REFUSAL_NOT_OBSERVED"


def test_other_os_error_still_fails_with_numeric_codes_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _events, subject = modeled_observation(
        monkeypatch, tmp_path, platform="win32", result="permission", refusal_delay=0.1
    )
    with pytest.raises(PermissionError) as failure:
        subject.invoke()
    notes = getattr(failure.value, "__notes__", [])
    assert len(notes) == 1
    diagnostic = json.loads(notes[0])
    assert diagnostic["error_kind"] == "OS_ERROR"
    assert diagnostic["errno"] == errno.EACCES
    assert diagnostic["winerror"] == WINDOWS_ACCESS_DENIED
    assert SUBJECT.TOKEN not in notes[0]
    assert "synthetic-private" not in notes[0]
