"""Actual held-Job cleanup control flow with fake Win32 handles; no native API."""

from __future__ import annotations

import importlib.util
import json
import subprocess
from collections.abc import Callable, Sequence
from contextlib import suppress
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import cast

import pytest

HELPER = Path(__file__).resolve().parents[1] / "_native_package_process.py"


class Clock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        assert 0 < seconds <= 0.02
        self.sleeps.append(seconds)
        self.now += seconds


class HeldJob:
    def __init__(self, clock: Clock, *, release_at: float | None = 0.06) -> None:
        self.clock = clock
        self.release_at = release_at
        self.process: int | None = 701
        self.job = 702
        self.assigned = True
        self.direct_exit: int | None = 0
        self.forced = False
        self.force_success = True
        self.force_at: list[float] = []
        self.query_error: OSError | None = None
        self.poll_error: OSError | None = None
        self.k = SimpleNamespace(
            TerminateJobObject=self.terminate,
            TerminateProcess=self.terminate,
        )

    def poll(self) -> int | None:
        if self.poll_error is not None:
            raise self.poll_error
        return 125 if self.forced and self.direct_exit is None else self.direct_exit

    def active(self) -> int:
        if self.query_error is not None:
            raise self.query_error
        return int(
            not self.forced
            and (self.release_at is None or self.clock.now < self.release_at)
        )

    def terminate(self, handle: int, code: int) -> int:
        assert handle in {self.job, self.process}
        assert code == 125
        self.force_at.append(self.clock.now)
        self.forced = self.force_success
        return int(self.force_success)

    def _ok(self, value: int) -> None:
        if not value:
            raise OSError("fake owned termination refused")


@pytest.fixture
def helper(monkeypatch: pytest.MonkeyPatch) -> tuple[ModuleType, Clock]:
    spec = importlib.util.spec_from_file_location("_job_drain_control", HELPER)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    clock = Clock()
    monkeypatch.setattr(
        module, "time", SimpleNamespace(monotonic=clock.monotonic, sleep=clock.sleep)
    )
    return module, clock


def settle(module: ModuleType, job: HeldJob, deadline: float) -> dict[str, object]:
    method = cast(
        Callable[[HeldJob, float], dict[str, object]],
        module._WindowsJob.settle,
    )
    return method(job, deadline)


def test_direct_exit_allows_delayed_owned_job_drain(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    result = settle(module, job, 15)
    assert result["all_job_members_closed"] is True
    assert result["direct_exit"] == 0
    assert result["terminated_job"] is False
    assert not job.force_at
    assert clock.sleeps
    assert 0.06 <= clock.now < 12


def test_already_empty_job_needs_no_wait_or_termination(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock, release_at=0)
    result = settle(module, job, 15)
    assert result["all_job_members_closed"] is True
    assert result["terminated_job"] is False
    assert not clock.sleeps
    assert not job.force_at


@pytest.mark.parametrize("release_at", [None, 12.01, 15.0])
def test_stubborn_or_late_job_keeps_force_as_failure(
    helper: tuple[ModuleType, Clock], release_at: float | None
) -> None:
    module, clock = helper
    job = HeldJob(clock, release_at=release_at)
    result = settle(module, job, 15)
    assert result["all_job_members_closed"] is True
    assert result["terminated_job"] is True
    assert len(job.force_at) == 1
    assert 12 <= job.force_at[0] <= 12.02
    assert clock.now < 15


def test_live_direct_process_never_receives_natural_drain(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    job.direct_exit = None
    result = settle(module, job, 15)
    assert result["terminated_job"] is True
    assert result["direct_exit"] == 125
    assert job.force_at == [0]
    assert not clock.sleeps


def test_unassigned_live_process_keeps_immediate_owned_termination(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    job.direct_exit = None
    job.assigned = False
    result = settle(module, job, 15)
    assert result["terminated_job"] is True
    assert result["all_job_members_closed"] is True
    assert job.force_at == [0]
    assert not clock.sleeps


@pytest.mark.parametrize("deadline", [0.0, 2.0, 3.0])
def test_no_reserve_remaining_keeps_immediate_force(
    helper: tuple[ModuleType, Clock], deadline: float
) -> None:
    module, clock = helper
    job = HeldJob(clock, release_at=None)
    result = settle(module, job, deadline)
    assert result["terminated_job"] is True
    assert job.force_at == [0]
    assert not clock.sleeps


def test_failed_command_cleanup_explicitly_disallows_natural_drain(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    method = cast(Callable[..., dict[str, object]], module._WindowsJob.settle)
    result = method(job, 15, allow_natural_drain=False)
    assert result["terminated_job"] is True
    assert job.force_at == [0]
    assert not clock.sleeps


@pytest.mark.parametrize("observation", ["active", "poll"])
def test_observation_fault_is_not_closed_or_silent_success(
    helper: tuple[ModuleType, Clock], observation: str
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    error = OSError("fake held observer failed")
    if observation == "active":
        job.query_error = error
    else:
        job.poll_error = error
    with pytest.raises(OSError, match="fake") as caught:
        settle(module, job, 15)
    assert caught.value is error
    assert not job.force_at


def test_refused_owned_termination_stays_error(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock, release_at=None)
    job.force_success = False
    with pytest.raises(OSError, match="fake owned termination refused"):
        settle(module, job, 15)
    assert len(job.force_at) == 1
    assert 12 <= job.force_at[0] <= 12.02


def test_no_process_created_does_not_invent_native_authority(
    helper: tuple[ModuleType, Clock],
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    job.process = None
    job.query_error = OSError("must not query")
    job.poll_error = OSError("must not poll")
    result = settle(module, job, 15)
    assert result["no_process_created"] is True
    assert result["all_job_members_closed"] is True
    assert result["terminated_job"] is False
    assert not job.force_at
    assert not clock.sleeps


def test_fault_during_natural_drain_preserves_observation_error(
    helper: tuple[ModuleType, Clock], monkeypatch: pytest.MonkeyPatch
) -> None:
    module, clock = helper
    job = HeldJob(clock)
    original = job.active
    error = OSError("fake accounting query after first sample")

    def observe() -> int:
        if clock.now > 0:
            raise error
        return original()

    monkeypatch.setattr(job, "active", observe)
    with pytest.raises(OSError, match="fake") as caught:
        settle(module, job, 15)
    assert caught.value is error
    assert not job.force_at
    assert clock.sleeps


class Capture:
    def __init__(self, stdout: str | Path, stderr: str | Path) -> None:
        Path(stdout).write_bytes(b"")
        Path(stderr).write_bytes(b"")
        self.writers: list[int] = [1, 2]  # Fake handles; never passed to native APIs.
        self.overflow = SimpleNamespace(is_set=lambda: False)

    def start(self) -> None:
        pass

    def close_parent_writers(self) -> None:
        self.writers.clear()

    def finish(self) -> dict[str, object]:
        return {
            "captured_bytes": 0,
            "discarded_bytes": 0,
            "overflow": False,
            "errors": [],
            "readers_closed": True,
        }


@pytest.mark.parametrize("stubborn", [False, True])
@pytest.mark.parametrize("work_deadline", [0.05, 100.0])
def test_actual_run_admission_keeps_forced_job_failure(
    helper: tuple[ModuleType, Clock],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    stubborn: bool,
    work_deadline: float,
) -> None:
    module, clock = helper
    forced = stubborn or work_deadline < 3
    method = cast(
        Callable[..., dict[str, object]],
        module._WindowsJob.settle,
    )
    closed: list[int] = []

    class RunJob(HeldJob):
        def __init__(
            self,
            argv: Sequence[str],
            cwd: Path,
            env: dict[str, str],
            writers: list[int],
        ) -> None:
            assert argv == [str(tmp_path / "not-executed")]
            assert cwd == tmp_path
            assert not env
            assert writers == [1, 2]
            super().__init__(clock, release_at=None if stubborn else 0.06)
            self.inherited: list[int] = []
            self.pid = 701
            self.tid = 703

        def settle(
            self, deadline: float, *, allow_natural_drain: bool = True
        ) -> dict[str, object]:
            return method(self, deadline, allow_natural_drain=allow_natural_drain)

        def close(self) -> None:
            closed.append(self.job)
            self.process = None
            self.job = 0

    monkeypatch.setattr(module, "_WindowsJob", RunJob)
    monkeypatch.setattr(module, "_Capture", Capture)
    monkeypatch.setattr(module, "_runtime_platform", lambda: "win32")
    run = cast(Callable[..., subprocess.CompletedProcess[bytes]], module.run)
    kwargs = {
        "cwd": tmp_path,
        "env": {},
        "stem": tmp_path / "command",
        "seconds": 100.0,
        "deadlines": {
            "work_deadline": work_deadline,
            "cleanup_deadline": work_deadline + 15,
        },
    }
    if forced:
        with pytest.raises(
            RuntimeError, match="Native command or contained cleanup failed"
        ):
            run([str(tmp_path / "not-executed")], **kwargs)
    else:
        result = run([str(tmp_path / "not-executed")], **kwargs)
        assert result.returncode == 0
    record = json.loads((tmp_path / "command.result.json").read_text())
    assert record["success"] is (not forced)
    assert record["containment"]["terminated_job"] is forced
    assert record["containment"]["all_job_members_closed"] is True
    assert record["exit_code"] == 0
    assert record["cleanup_error"] is None
    assert record["failure"] is None
    assert closed == [702]


@pytest.mark.parametrize("delay", [0.1, 16.0])
@pytest.mark.parametrize("stage", ["query", "final-poll", "close", "capture"])
def test_slow_observation_cannot_extend_original_cleanup_admission(
    helper: tuple[ModuleType, Clock],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    delay: float,
    stage: str,
) -> None:
    module, clock = helper
    method = cast(Callable[..., dict[str, object]], module._WindowsJob.settle)
    closed: list[int] = []

    class SlowJob(HeldJob):
        def __init__(
            self,
            argv: Sequence[str],
            cwd: Path,
            env: dict[str, str],
            writers: list[int],
        ) -> None:
            assert argv == [str(tmp_path / "not-executed")]
            assert cwd == tmp_path
            assert not env
            assert writers == [1, 2]
            super().__init__(clock, release_at=0.06 if stage == "query" else 0)
            self.inherited: list[int] = []
            self.pid = 701
            self.tid = 703
            self.queries = 0
            self.polls = 0

        def active(self) -> int:
            self.queries += 1
            if stage == "query" and self.queries == 2:
                clock.now = delay
                return 0
            return super().active()

        def poll(self) -> int | None:
            self.polls += 1
            if stage == "final-poll" and self.polls == 3:
                clock.now = delay
            return super().poll()

        def settle(
            self, deadline: float, *, allow_natural_drain: bool = True
        ) -> dict[str, object]:
            return method(self, deadline, allow_natural_drain=allow_natural_drain)

        def close(self) -> None:
            if stage == "close":
                clock.now = delay
            closed.append(self.job)
            self.process = None
            self.job = 0

    class SlowCapture(Capture):
        def finish(self) -> dict[str, object]:
            if stage == "capture":
                clock.now = delay
            return super().finish()

    monkeypatch.setattr(module, "_WindowsJob", SlowJob)
    monkeypatch.setattr(module, "_Capture", SlowCapture)
    monkeypatch.setattr(module, "_runtime_platform", lambda: "win32")
    run = cast(Callable[..., subprocess.CompletedProcess[bytes]], module.run)
    completed = None
    with suppress(TimeoutError, RuntimeError):
        completed = run(
            [str(tmp_path / "not-executed")],
            cwd=tmp_path,
            env={},
            stem=tmp_path / "slow",
            seconds=100,
            deadlines={"work_deadline": 100, "cleanup_deadline": 115},
        )
    late = delay >= 15
    assert (completed is None) is late
    record = json.loads((tmp_path / "slow.result.json").read_text())
    assert record["success"] is (not late)
    assert record["containment"]["job_cleanup_deadline_met"] is (not late)
    assert record["containment"]["terminated_job"] is False
    assert record["containment"]["all_job_members_closed"] is True
    assert record["exit_code"] == 0
    assert closed == [702]
    assert not module._PENDING_WINDOWS_OWNERS


@pytest.mark.parametrize("delay", [0.1, 16.0])
def test_slow_force_retains_intervention_and_deadline_facts(
    helper: tuple[ModuleType, Clock], delay: float
) -> None:
    module, clock = helper
    job = HeldJob(clock, release_at=None)
    original = job.terminate

    def terminate(handle: int, code: int) -> int:
        result = original(handle, code)
        clock.now += delay
        return result

    job.k.TerminateJobObject = terminate
    result = settle(module, job, 15)
    assert result["terminated_job"] is True
    assert result["all_job_members_closed"] is True
    assert result["job_cleanup_deadline_met"] is (delay < 3)
    assert len(job.force_at) == 1
