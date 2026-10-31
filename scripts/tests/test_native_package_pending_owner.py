"""UNEXECUTED mock counterproofs; no native child is allowed to launch.

Future invocation requires its own resource release. This exercises the actual
run() failure/finally path with a held fake Popen. It is not Ubuntu native proof.
"""

from __future__ import annotations

import hashlib
import importlib.util
import subprocess
import tempfile
import unittest
from collections.abc import Mapping, Sequence
from pathlib import Path
from subprocess import CompletedProcess
from types import ModuleType
from typing import Protocol, TypedDict, Unpack, runtime_checkable
from unittest import mock

import pytest

HELPER = Path(__file__).resolve().parents[1] / "_native_package_process.py"
HELPER_SHA256 = "19bf1ae0eec2f1511703f3ff9e97de14b289a1f67d64c36a2e5bf52e616b86b2"


class _ProcessIdentity(TypedDict):
    pid: int
    pgid: int
    sid: int
    birth: int


class _Deadlines(TypedDict):
    work_deadline: float
    cleanup_deadline: float


class _CaptureResult(TypedDict):
    captured_bytes: int
    discarded_bytes: int
    overflow: bool
    errors: list[dict[str, str]]
    readers_closed: bool


class _OwnedChild(Protocol):
    pid: int

    def poll(self) -> int | None: ...

    def wait(self, timeout: float) -> int: ...


class _RunOptions(TypedDict):
    cwd: Path
    env: Mapping[str, str]
    stem: Path
    seconds: float
    deadlines: _Deadlines


class _Interventions(TypedDict, total=False):
    pidfd: int | None
    proc_error: OSError | None
    pidfd_error: OSError | None
    launch_error: OSError | None
    reaped: bool


@runtime_checkable
class _ProcessHelper(Protocol):
    sys: ModuleType
    subprocess: ModuleType
    os: ModuleType
    signal: ModuleType
    time: ModuleType
    _PENDING_LINUX_OWNERS: list[tuple[_OwnedChild, int | None, _ProcessIdentity | None]]

    def run(
        self, argv: Sequence[str], **options: Unpack[_RunOptions]
    ) -> CompletedProcess[bytes]: ...


class _Clock:
    value: int = 100

    def monotonic(self) -> int:
        self.value += 1
        return self.value


class _HeldChild:
    pid: int = 43210

    def __init__(self, reaped: bool = False) -> None:
        self.reaped = reaped

    def poll(self) -> int | None:
        return 0 if self.reaped else None

    def wait(self, timeout: float) -> int:
        if self.reaped:
            return 0
        raise subprocess.TimeoutExpired("mock held keeper", timeout)


class _Capture:
    def __init__(self, stdout: str | Path, stderr: str | Path) -> None:
        Path(stdout).write_bytes(b"")
        Path(stderr).write_bytes(b"")
        self.writers: list[int] = [
            1,
            2,
        ]  # Passed only to mocked Popen; never closed here.
        self.overflow: mock.Mock = mock.Mock()
        self.overflow.is_set.return_value = False

    def start(self) -> None:
        pass

    def close_parent_writers(self) -> None:
        self.writers.clear()

    def finish(self) -> _CaptureResult:
        self.close_parent_writers()
        return {
            "captured_bytes": 0,
            "discarded_bytes": 0,
            "overflow": False,
            "errors": [],
            "readers_closed": True,
        }


class PendingBeforePidfd(unittest.TestCase):
    helper: _ProcessHelper
    owned: tempfile.TemporaryDirectory[str]
    root: Path

    def setUp(self) -> None:
        assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == HELPER_SHA256
        spec = importlib.util.spec_from_file_location(
            "_owned_pending_counterproof", HELPER
        )
        assert spec is not None
        assert spec.loader is not None
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)  # Future only; no dispatch at import.
        assert isinstance(helper, _ProcessHelper)
        self.helper = helper
        self.owned = tempfile.TemporaryDirectory(prefix="japp-pending-owner-mock-")
        self.addCleanup(self.owned.cleanup)
        self.root = Path(self.owned.name).resolve()

    def exercise(
        self,
        *,
        identity: _ProcessIdentity | None,
        **options: Unpack[_Interventions],
    ) -> None:
        if set(options) - {
            "pidfd",
            "proc_error",
            "pidfd_error",
            "launch_error",
            "reaped",
        }:
            raise TypeError("Unexpected counterproof intervention")
        pidfd = options.get("pidfd")
        proc_error = options.get("proc_error")
        pidfd_error = options.get("pidfd_error")
        launch_error = options.get("launch_error")
        reaped = options.get("reaped", False)
        h = self.helper
        child = _HeldChild(reaped)
        clock = _Clock()
        opened = mock.Mock(return_value=child, side_effect=launch_error)
        read_proc = mock.Mock(return_value=identity, side_effect=proc_error)
        acquire = mock.Mock(return_value=pidfd, side_effect=pidfd_error)
        deadlines: _Deadlines = {"work_deadline": 1000, "cleanup_deadline": 1060}
        with (
            mock.patch.object(h.sys, "platform", "linux"),
            mock.patch.object(h, "_Capture", _Capture),
            mock.patch.object(h.subprocess, "Popen", opened),
            mock.patch.object(h, "_proc", read_proc),
            mock.patch.object(h, "_pidfd", acquire),
            mock.patch.object(h, "_session_members", return_value=[]),
            mock.patch.object(
                h, "_settle_session", side_effect=AssertionError("No acquired pidfd")
            ) as settle,
            mock.patch.object(h.os, "pidfd_open", create=True),
            mock.patch.object(
                h.signal, "pidfd_send_signal", create=True
            ) as native_signal,
            mock.patch.object(h.time, "monotonic", clock.monotonic),
            mock.patch.object(h.time, "sleep"),
        ):
            with pytest.raises((ValueError, OSError)) as original:
                h.run(
                    [str(self.root / "not-launched")],
                    cwd=self.root,
                    env={},
                    stem=self.root / "first",
                    seconds=1,
                    deadlines=deadlines,
                )
            assert opened.call_count == 1
            native_signal.assert_not_called()
            settle.assert_not_called()
            if launch_error is not None:
                assert original.value is launch_error
                assert h._PENDING_LINUX_OWNERS == []
                return
            if proc_error is not None:
                assert original.value is proc_error
            if pidfd_error is not None:
                assert original.value is pidfd_error
            assert len(h._PENDING_LINUX_OWNERS) == 1
            saved_child, saved_fd, saved_identity = h._PENDING_LINUX_OWNERS[0]
            assert saved_child is child
            assert saved_fd is None
            assert saved_identity == (identity if proc_error is None else None)
            with pytest.raises(
                RuntimeError, match="Prior native command owner remains unresolved"
            ):
                h.run(
                    [str(self.root / "still-not-launched")],
                    cwd=self.root,
                    env={},
                    stem=self.root / "second",
                    seconds=1,
                    deadlines=deadlines,
                )
            assert opened.call_count == 1
            native_signal.assert_not_called()
            assert h._PENDING_LINUX_OWNERS[0][0] is child

    def test_missing_identity_retains_exact_launched_popen(self) -> None:
        self.exercise(identity=None)

    def test_mismatched_session_retains_exact_launched_popen(self) -> None:
        self.exercise(identity={"pid": 43210, "pgid": 43210, "sid": 999, "birth": 7})

    def test_identity_read_error_retains_exact_launched_popen(self) -> None:
        self.exercise(identity=None, proc_error=OSError("mock identity unavailable"))

    def test_missing_pidfd_retains_exact_launched_popen(self) -> None:
        self.exercise(identity={"pid": 43210, "pgid": 43210, "sid": 43210, "birth": 7})

    def test_pidfd_acquisition_error_retains_exact_launched_popen(self) -> None:
        self.exercise(
            identity={"pid": 43210, "pgid": 43210, "sid": 43210, "birth": 7},
            pidfd_error=OSError("mock pidfd unavailable"),
        )

    def test_reaped_child_with_unvalidated_session_stays_quarantined(self) -> None:
        self.exercise(
            identity={"pid": 43210, "pgid": 43210, "sid": 999, "birth": 7}, reaped=True
        )

    def test_failed_popen_does_not_invent_a_launched_owner(self) -> None:
        self.exercise(identity=None, launch_error=OSError("mock create failure"))


if __name__ == "__main__":
    unittest.main()
