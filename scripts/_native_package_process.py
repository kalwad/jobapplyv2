"""Unexecuted native package command custody; standard library only.

Windows owns suspended-process/thread/Job handles; Ubuntu owns a fresh session
keeper and pidfds. Escaped Ubuntu sessions are explicitly outside observation.
No function dispatches at import. A nonzero/uncertain cleanup never becomes PASS.
"""

from __future__ import annotations

import argparse
import ctypes
import datetime
import hashlib
import importlib
import json
import math
import os
import signal
import subprocess
import sys
import threading
import time
import traceback
from collections.abc import Callable, Mapping, Sequence
from contextlib import suppress
from ctypes import wintypes
from pathlib import Path
from typing import NotRequired, Protocol, TypedDict, cast


class Budget(TypedDict):
    work_deadline: int | float
    cleanup_deadline: int | float


class ErrorRecord(TypedDict):
    type: str
    message: str


class ProcessIdentity(TypedDict):
    pid: int
    pgid: int
    sid: int
    birth: int


class SignalReceipt(TypedDict):
    identity: ProcessIdentity
    signal: str
    authority: str


class CaptureResult(TypedDict):
    captured_bytes: int
    discarded_bytes: int
    overflow: bool
    errors: list[ErrorRecord]
    readers_closed: bool


class Containment(TypedDict, total=False):
    signals: list[SignalReceipt]
    session_members_absent: bool
    escaped_sessions: str
    remaining: list[ProcessIdentity]
    held_job: bool
    terminated_job: bool
    job_active_processes: int
    direct_exit: int | None
    all_job_members_closed: bool
    no_process_created: bool
    assigned_before_resume: bool
    outside_job_descendants: str
    keeper_reaped: bool
    session_absent: bool
    launched_owner_retained: bool
    held_pidfd_owner_retained: bool


class SessionControl(TypedDict):
    argv: list[str]
    cwd: str
    environment: dict[str, str]
    deadline: int | float
    cleanup_deadline: int | float
    helper_sha256: str
    lease_fd: int
    stdout_fd: int
    stderr_fd: int
    launch: str
    result: str


class SessionResult(TypedDict):
    keeper: ProcessIdentity
    command: list[str]
    exit_code: int | None
    timed_out: bool
    parent_lease_closed: bool
    escaped_sessions: str
    owned_direct_child_pid: NotRequired[int]
    failure: NotRequired[ErrorRecord]
    traceback: NotRequired[str]
    cleanup: NotRequired[Containment]
    direct_child_reaped: NotRequired[bool]
    cleanup_error: NotRequired[ErrorRecord]


class CommandRecord(TypedDict):
    argv: list[str]
    cwd: str
    environment: dict[str, str]
    seconds: float
    work_deadline: int | float
    cleanup_deadline: int | float
    start_utc: str
    escaped_sessions_or_jobs: str
    exit_code: NotRequired[int | None]
    success: NotRequired[bool]
    failure: NotRequired[ErrorRecord | None]
    cleanup_error: NotRequired[ErrorRecord | None]
    containment: NotRequired[Containment]
    capture: NotRequired[CaptureResult]
    seconds_elapsed: NotRequired[float]
    end_utc: NotRequired[str]
    stdout_sha256: NotRequired[str]
    stderr_sha256: NotRequired[str]
    native_launch_failure: NotRequired[ErrorRecord | None]
    retained_inherited_handle_count: NotRequired[int]


class _CaptureSink(Protocol):
    def write(self, data: bytes, /) -> object: ...
    def close(self) -> None: ...


class _PidfdOS(Protocol):
    def pidfd_open(self, pid: int, flags: int = 0) -> int: ...


class _PidfdSignal(Protocol):
    def pidfd_send_signal(self, pidfd: int, sig: int) -> None: ...


class _WinFunction[**P, R](Protocol):
    argtypes: list[type[object]]
    restype: type[object] | None

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R: ...


class _Kernel32(Protocol):
    CreateJobObjectW: _WinFunction[[object, str | None], int | None]
    SetInformationJobObject: _WinFunction[[int | None, int, object, int], int]
    QueryInformationJobObject: _WinFunction[[int | None, int, object, int, object], int]
    TerminateJobObject: _WinFunction[[int | None, int], int]
    AssignProcessToJobObject: _WinFunction[[int | None, int | None], int]
    CloseHandle: _WinFunction[[int | None], int]
    GetCurrentProcess: _WinFunction[[], int | None]
    DuplicateHandle: _WinFunction[
        [int | None, int | None, int | None, object, int, bool, int], int
    ]
    InitializeProcThreadAttributeList: _WinFunction[[object, int, int, object], int]
    UpdateProcThreadAttribute: _WinFunction[
        [object, int, int, object, int, object, object], int
    ]
    DeleteProcThreadAttributeList: _WinFunction[[object], None]
    CreateProcessW: _WinFunction[
        [str, object, object, object, bool, int, object, str, object, object], int
    ]
    ResumeThread: _WinFunction[[int | None], int]
    TerminateProcess: _WinFunction[[int | None, int], int]
    WaitForSingleObject: _WinFunction[[int | None, int], int]
    GetExitCodeProcess: _WinFunction[[int | None, object], int]


class _WinDLLLoader(Protocol):
    def __call__(self, name: str, *, use_last_error: bool) -> _Kernel32: ...


class _WindowsCtypes(Protocol):
    WinDLL: _WinDLLLoader
    get_last_error: Callable[[], int]
    WinError: Callable[[int], OSError]


class _MSVCRT(Protocol):
    def get_osfhandle(self, fd: int) -> int: ...


class _WindowsLaunchFailure(TypedDict):
    type: str
    message: str


_WINDOWS_WAIT_TIMEOUT = 258


WORK_SECONDS = 2700
CLEANUP_SECONDS = 60
COMMAND_CLEANUP_SECONDS = 15
MAX_CAPTURE = 64 * 1024 * 1024
MAX_SESSION_MEMBERS = 512
MAX_PROC_STAT_BYTES = 16384
MAX_PROC_NAMES = 65536
_PENDING_WINDOWS_OWNERS: list[_WindowsJob] = []
_PENDING_LINUX_OWNERS: list[
    tuple[subprocess.Popen[bytes], int | None, ProcessIdentity | None]
] = []


def _load_json(path: Path) -> object:
    # json.loads is dynamically typed; no consumer receives it before checking
    # its closed record, scalar and nested-array shapes below.
    value: object = json.loads(path.read_text(encoding="utf-8"))
    return value


def _json_object(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("Native control/receipt must be a JSON object")
    row = cast(dict[object, object], value)
    if any(type(key) is not str for key in row):
        raise ValueError("Native JSON object keys must be strings")
    return {cast(str, key): item for key, item in row.items()}


def _json_int(value: object) -> int:
    if type(value) is not int:
        raise ValueError("Native JSON integer required")
    return value


def _json_number(value: object) -> int | float:
    if type(value) not in (int, float):
        raise ValueError("Native JSON number required")
    number = cast(int | float, value)
    if not math.isfinite(number):
        raise ValueError("Finite native JSON number required")
    return number


def _json_text(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Native JSON string required")
    return value


def _json_bool(value: object) -> bool:
    if type(value) is not bool:
        raise ValueError("Native JSON boolean required")
    return value


def _json_array(value: object) -> list[object]:
    if not isinstance(value, list):
        raise ValueError("Native JSON array required")
    return cast(list[object], value)


def _text_array(value: object) -> list[str]:
    return [_json_text(item) for item in _json_array(value)]


def _error_record(value: object) -> ErrorRecord:
    row = _json_object(value)
    if set(row) != {"type", "message"}:
        raise ValueError("Exact native error receipt required")
    return {"type": _json_text(row["type"]), "message": _json_text(row["message"])}


def _process_identity(value: object) -> ProcessIdentity:
    row = _json_object(value)
    if set(row) != {"pid", "pgid", "sid", "birth"}:
        raise ValueError("Exact native process identity required")
    return {
        "pid": _json_int(row["pid"]),
        "pgid": _json_int(row["pgid"]),
        "sid": _json_int(row["sid"]),
        "birth": _json_int(row["birth"]),
    }


def _signal_receipt(value: object) -> SignalReceipt:
    row = _json_object(value)
    if set(row) != {"identity", "signal", "authority"}:
        raise ValueError("Exact native signal receipt required")
    return {
        "identity": _process_identity(row["identity"]),
        "signal": _json_text(row["signal"]),
        "authority": _json_text(row["authority"]),
    }


def _containment(value: object) -> Containment:
    row = _json_object(value)
    booleans = {
        "session_members_absent",
        "held_job",
        "terminated_job",
        "all_job_members_closed",
        "no_process_created",
        "assigned_before_resume",
        "keeper_reaped",
        "session_absent",
        "launched_owner_retained",
        "held_pidfd_owner_retained",
    }
    texts = {"escaped_sessions", "outside_job_descendants"}
    allowed = (
        booleans
        | texts
        | {"signals", "remaining", "job_active_processes", "direct_exit"}
    )
    if set(row) - allowed:
        raise ValueError("Unexpected native containment receipt field")
    for name in booleans & row.keys():
        _json_bool(row[name])
    for name in texts & row.keys():
        _json_text(row[name])
    if "signals" in row:
        for item in _json_array(row["signals"]):
            _signal_receipt(item)
    if "remaining" in row:
        for item in _json_array(row["remaining"]):
            _process_identity(item)
    if "job_active_processes" in row:
        _json_int(row["job_active_processes"])
    if "direct_exit" in row and row["direct_exit"] is not None:
        _json_int(row["direct_exit"])
    # Every optional key and its complete nested shape was checked above.
    return cast(Containment, row)


def _session_control(value: object) -> SessionControl:
    row = _json_object(value)
    if set(row) != {
        "argv",
        "cwd",
        "environment",
        "deadline",
        "cleanup_deadline",
        "helper_sha256",
        "lease_fd",
        "stdout_fd",
        "stderr_fd",
        "launch",
        "result",
    }:
        raise ValueError("Exact native session control required")
    environment = _json_object(row["environment"])
    return {
        "argv": _text_array(row["argv"]),
        "cwd": _json_text(row["cwd"]),
        "environment": {key: _json_text(item) for key, item in environment.items()},
        "deadline": _json_number(row["deadline"]),
        "cleanup_deadline": _json_number(row["cleanup_deadline"]),
        "helper_sha256": _json_text(row["helper_sha256"]),
        "lease_fd": _json_int(row["lease_fd"]),
        "stdout_fd": _json_int(row["stdout_fd"]),
        "stderr_fd": _json_int(row["stderr_fd"]),
        "launch": _json_text(row["launch"]),
        "result": _json_text(row["result"]),
    }


def _session_result(value: object) -> SessionResult:
    row = _json_object(value)
    required = {
        "keeper",
        "command",
        "exit_code",
        "timed_out",
        "parent_lease_closed",
        "escaped_sessions",
    }
    optional = {
        "owned_direct_child_pid",
        "failure",
        "traceback",
        "cleanup",
        "direct_child_reaped",
        "cleanup_error",
    }
    if not required <= row.keys() or set(row) - required - optional:
        raise ValueError("Exact native session result receipt required")
    _process_identity(row["keeper"])
    _text_array(row["command"])
    if row["exit_code"] is not None:
        _json_int(row["exit_code"])
    _json_bool(row["timed_out"])
    _json_bool(row["parent_lease_closed"])
    _json_text(row["escaped_sessions"])
    if "owned_direct_child_pid" in row:
        _json_int(row["owned_direct_child_pid"])
    if "failure" in row:
        _error_record(row["failure"])
    if "traceback" in row:
        _json_text(row["traceback"])
    if "cleanup" in row:
        _containment(row["cleanup"])
    if "direct_child_reaped" in row:
        _json_bool(row["direct_child_reaped"])
    if "cleanup_error" in row:
        _error_record(row["cleanup_error"])
    # Required keys, every optional field and each nested shape are validated.
    return cast(SessionResult, row)


def _is_text(value: object) -> bool:
    return isinstance(value, str)


def _runtime_platform() -> str:
    return sys.platform


def _write(path: str | Path, value: object) -> None:
    with Path(path).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def _sha(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


_SOURCE_SHA = _sha(__file__)


def budget() -> Budget:
    now = time.monotonic()
    return {
        "work_deadline": now + WORK_SECONDS,
        "cleanup_deadline": now + WORK_SECONDS + CLEANUP_SECONDS,
    }


def _validate_budget(value: Budget) -> None:
    if set(value) != {"work_deadline", "cleanup_deadline"}:
        raise ValueError("Exact native work/cleanup budget required")
    work, close = value["work_deadline"], value["cleanup_deadline"]
    if not all(type(x) in (int, float) and math.isfinite(x) for x in (work, close)):
        raise ValueError("Finite native deadlines required")
    if (
        not 0 < close - work <= CLEANUP_SECONDS
        or close - time.monotonic() > WORK_SECONDS + CLEANUP_SECONDS
    ):
        raise ValueError("Native deadline policy exceeded")


class _Capture:
    def __init__(self, stdout_path: str | Path, stderr_path: str | Path) -> None:
        self.lock = threading.Lock()
        self.total = 0
        self.discarded = 0
        self.errors: list[ErrorRecord] = []
        self.overflow = threading.Event()
        self.threads: list[threading.Thread] = []
        self.readers: list[int] = []
        self.writers: list[int] = []
        for path in (stdout_path, stderr_path):
            read, write = os.pipe()
            self.readers.append(read)
            self.writers.append(write)
            sink = Path(path).open("xb", buffering=0)  # noqa: SIM115 -- drain owns/ closes sink
            thread = threading.Thread(
                target=self._drain, args=(read, sink), daemon=True
            )
            self.threads.append(thread)

    def _drain(self, descriptor: int, sink: _CaptureSink) -> None:
        try:
            while block := os.read(descriptor, 16384):
                with self.lock:
                    remaining = max(0, MAX_CAPTURE - self.total)
                    retained = block[:remaining]
                    if retained:
                        sink.write(retained)
                        self.total += len(retained)
                    self.discarded += len(block) - len(retained)
                    if len(retained) != len(block):
                        self.overflow.set()
        except BaseException as error:
            self.errors.append({"type": type(error).__name__, "message": str(error)})
            self.overflow.set()
        finally:
            sink.close()
            os.close(descriptor)

    def start(self) -> None:
        for thread in self.threads:
            thread.start()

    def close_parent_writers(self) -> None:
        while self.writers:
            os.close(self.writers.pop())

    def finish(self) -> CaptureResult:
        self.close_parent_writers()
        for thread in self.threads:
            thread.join(timeout=1)
        # A blocked daemon retains its own descriptor; do not race-close/reuse it.
        return {
            "captured_bytes": self.total,
            "discarded_bytes": self.discarded,
            "overflow": self.overflow.is_set(),
            "errors": self.errors,
            "readers_closed": not any(thread.is_alive() for thread in self.threads),
        }


def _proc(pid: int) -> ProcessIdentity | None:
    try:
        with (Path("/proc") / str(pid) / "stat").open("rb") as stream:
            body = stream.read(MAX_PROC_STAT_BYTES + 1)
        if len(body) > MAX_PROC_STAT_BYTES:
            raise ValueError("Bounded process identity required")
        left, right = body.rsplit(b") ", 1)
        fields = right.split()
        return {
            "pid": int(left.split(b" (", 1)[0]),
            "pgid": int(fields[2]),
            "sid": int(fields[3]),
            "birth": int(fields[19]),
        }
    except FileNotFoundError:
        return None


def _session_members(sid: int) -> list[ProcessIdentity]:
    result: list[ProcessIdentity] = []
    inspected = 0
    for name in os.listdir("/proc"):  # noqa: PTH208 -- bounded snapshot of proc names
        if not name.isdecimal():
            continue
        inspected += 1
        if inspected > MAX_PROC_NAMES:
            raise ValueError("Bounded /proc inventory required")
        row = _proc(int(name))
        if row is not None and row["sid"] == sid:
            result.append(row)
            if len(result) > MAX_SESSION_MEMBERS:
                raise ValueError("Owned session member bound exceeded")
    return result


def _pidfd(row: ProcessIdentity) -> int | None:
    try:
        descriptor = cast(_PidfdOS, os).pidfd_open(row["pid"])
    except ProcessLookupError:
        return None
    if _proc(row["pid"]) != row:
        os.close(descriptor)
        return None
    return descriptor


def _signal_session(
    saved_keeper: ProcessIdentity, sig: int, receipts: list[SignalReceipt]
) -> None:
    if _proc(saved_keeper["pid"]) != saved_keeper:
        raise ValueError("Owned live session witness changed")
    for row in _session_members(saved_keeper["sid"]):
        if row["pid"] == saved_keeper["pid"]:
            continue
        descriptor = _pidfd(row)
        if descriptor is None:
            continue
        try:
            cast(_PidfdSignal, signal).pidfd_send_signal(descriptor, sig)
            receipts.append(
                {
                    "identity": row,
                    "signal": signal.Signals(sig).name,
                    "authority": "held_pidfd_after_same_owned_session_identity",
                }
            )
        except ProcessLookupError:
            pass
        finally:
            os.close(descriptor)


def _settle_session(
    saved_keeper: ProcessIdentity,
    deadline: int | float,
    child: subprocess.Popen[bytes] | None = None,
) -> Containment:
    result: Containment = {
        "signals": [],
        "session_members_absent": False,
        "escaped_sessions": "UNOBSERVED",
    }
    for sig, grace in ((signal.SIGTERM, 3), (signal.SIGKILL, 3)):
        if child is not None:
            child.poll()
        if not [
            r
            for r in _session_members(saved_keeper["sid"])
            if r["pid"] != saved_keeper["pid"]
        ]:
            result["session_members_absent"] = True
            break
        _signal_session(saved_keeper, sig, result["signals"])
        until = min(deadline, time.monotonic() + grace)
        while time.monotonic() < until:
            if child is not None:
                child.poll()
            others = [
                r
                for r in _session_members(saved_keeper["sid"])
                if r["pid"] != saved_keeper["pid"]
            ]
            if not others:
                result["session_members_absent"] = True
                break
            time.sleep(0.02)
        if result["session_members_absent"]:
            break
    result["remaining"] = [
        r
        for r in _session_members(saved_keeper["sid"])
        if r["pid"] != saved_keeper["pid"]
    ]
    result["session_members_absent"] = not result["remaining"]
    return result


def _linux_worker(control: str | Path) -> int:
    c = _session_control(_load_json(Path(control)))
    if c["helper_sha256"] != _sha(__file__):
        raise ValueError("Owned keeper source changed before tool launch")
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        raise ValueError("Native Ubuntu pidfd capability required; no PID fallback")
    own = _proc(os.getpid())
    if own is None or own["pid"] != own["pgid"] or own["pid"] != own["sid"]:
        raise ValueError("Fresh owned session leader required")
    lease = c["lease_fd"]
    os.set_blocking(lease, False)
    child: subprocess.Popen[bytes] | None = None
    result: SessionResult = {
        "keeper": own,
        "command": c["argv"],
        "exit_code": None,
        "timed_out": False,
        "parent_lease_closed": False,
        "escaped_sessions": "UNOBSERVED",
    }
    try:
        _write(
            c["launch"],
            {"keeper": own, "command_argv": c["argv"], "utc_ns": time.time_ns()},
        )
        child = subprocess.Popen(  # noqa: S603 -- validated exact argv, no shell
            c["argv"],
            cwd=c["cwd"],
            env=c["environment"],
            stdin=subprocess.DEVNULL,
            stdout=c["stdout_fd"],
            stderr=c["stderr_fd"],
            shell=False,
            process_group=0,
        )
        os.close(c["stdout_fd"])
        os.close(c["stderr_fd"])
        result["owned_direct_child_pid"] = child.pid
        while child.poll() is None:
            try:
                if os.read(lease, 1) == b"":
                    result["parent_lease_closed"] = True
                    break
            except BlockingIOError:
                pass
            if time.monotonic() >= c["deadline"]:
                result["timed_out"] = True
                break
            time.sleep(0.02)
        result["exit_code"] = child.poll()
    except BaseException as error:
        result["failure"] = {"type": type(error).__name__, "message": str(error)}
        result["traceback"] = traceback.format_exc()
    finally:
        # Keep this live session witness until every observed same-session child
        # is closed. This includes service-created groups within the session.
        try:
            result["cleanup"] = _settle_session(own, c["cleanup_deadline"], child)
            if child is not None:
                try:
                    result["exit_code"] = child.wait(
                        timeout=max(
                            0.01, min(2, c["cleanup_deadline"] - time.monotonic())
                        )
                    )
                    result["direct_child_reaped"] = True
                except subprocess.TimeoutExpired:
                    result["direct_child_reaped"] = False
        except BaseException as error:
            result["cleanup_error"] = {
                "type": type(error).__name__,
                "message": str(error),
            }
        os.close(lease)
        _write(c["result"], result)
    return (
        0
        if (
            result.get("exit_code") == 0
            and not result.get("failure")
            and not result["timed_out"]
            and not result["parent_lease_closed"]
            and result.get("direct_child_reaped")
            and result.get("cleanup", Containment()).get("session_members_absent")
            and not result.get("cleanup", Containment()).get("signals")
        )
        else 1
    )


class _WindowsJob:
    """CreateProcessW owns hProcess/hThread; Popen thread ownership is not assumed."""

    # Preserve the native ownership acquisition/unwind in one ordered coordinator.
    def __init__(  # noqa: PLR0915
        self, argv: list[str], cwd: Path, env: dict[str, str], writers: list[int]
    ) -> None:
        # These three APIs exist only on Windows; the Protocol describes their
        # actual conditional platform surface, not a replacement implementation.
        self.native = cast(_WindowsCtypes, ctypes)
        msvcrt = cast(_MSVCRT, importlib.import_module("msvcrt"))
        self.k = self.native.WinDLL("kernel32", use_last_error=True)
        self.job: int | None = None
        self.process: int | None = None
        self.thread: int | None = None
        self.assigned = False
        self.inherited: list[int | None] = []
        self.attributes: ctypes.c_void_p | None = None
        self.attributes_initialized = False
        self.launch_failure: _WindowsLaunchFailure | None = None
        size_type = ctypes.c_size_t

        class BASIC(ctypes.Structure):
            flags: int
            _fields_ = [
                ("process_time", ctypes.c_int64),
                ("job_time", ctypes.c_int64),
                ("flags", wintypes.DWORD),
                ("min_ws", size_type),
                ("max_ws", size_type),
                ("active_limit", wintypes.DWORD),
                ("affinity", size_type),
                ("priority", wintypes.DWORD),
                ("scheduling", wintypes.DWORD),
            ]

        class IO(ctypes.Structure):
            _fields_ = [
                (name, ctypes.c_uint64)
                for name in (
                    "read_ops",
                    "write_ops",
                    "other_ops",
                    "read_bytes",
                    "write_bytes",
                    "other_bytes",
                )
            ]

        class LIMIT(ctypes.Structure):
            basic: BASIC
            _fields_ = [
                ("basic", BASIC),
                ("io", IO),
                ("process_memory", size_type),
                ("job_memory", size_type),
                ("peak_process", size_type),
                ("peak_job", size_type),
            ]

        class ACCOUNT(ctypes.Structure):
            active: int
            _fields_ = [
                (name, ctypes.c_int64)
                for name in ("user", "kernel", "period_user", "period_kernel")
            ] + [
                (name, wintypes.DWORD)
                for name in ("faults", "total", "active", "terminated")
            ]

        class START(ctypes.Structure):
            cb: int
            flags: int
            stdin: int | None
            stdout: int | None
            stderr: int | None
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("reserved", wintypes.LPWSTR),
                ("desktop", wintypes.LPWSTR),
                ("title", wintypes.LPWSTR),
                ("x", wintypes.DWORD),
                ("y", wintypes.DWORD),
                ("xsize", wintypes.DWORD),
                ("ysize", wintypes.DWORD),
                ("xchars", wintypes.DWORD),
                ("ychars", wintypes.DWORD),
                ("fill", wintypes.DWORD),
                ("flags", wintypes.DWORD),
                ("show", wintypes.WORD),
                ("reserved_bytes", wintypes.WORD),
                ("reserved_data", ctypes.c_void_p),
                ("stdin", wintypes.HANDLE),
                ("stdout", wintypes.HANDLE),
                ("stderr", wintypes.HANDLE),
            ]

        class STARTEX(ctypes.Structure):
            start: START
            attributes: ctypes.c_void_p | None
            _fields_ = [("start", START), ("attributes", ctypes.c_void_p)]

        class PROCESS(ctypes.Structure):
            process: int | None
            thread: int | None
            pid: int
            tid: int
            _fields_ = [
                ("process", wintypes.HANDLE),
                ("thread", wintypes.HANDLE),
                ("pid", wintypes.DWORD),
                ("tid", wintypes.DWORD),
            ]

        self.ACCOUNT = ACCOUNT
        signatures: dict[str, tuple[list[type[object]], type[object] | None]] = {
            "CreateJobObjectW": ([ctypes.c_void_p, wintypes.LPCWSTR], wintypes.HANDLE),
            "SetInformationJobObject": (
                [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD],
                wintypes.BOOL,
            ),
            "QueryInformationJobObject": (
                [
                    wintypes.HANDLE,
                    ctypes.c_int,
                    ctypes.c_void_p,
                    wintypes.DWORD,
                    ctypes.c_void_p,
                ],
                wintypes.BOOL,
            ),
            "TerminateJobObject": ([wintypes.HANDLE, wintypes.UINT], wintypes.BOOL),
            "AssignProcessToJobObject": (
                [wintypes.HANDLE, wintypes.HANDLE],
                wintypes.BOOL,
            ),
            "CloseHandle": ([wintypes.HANDLE], wintypes.BOOL),
            "GetCurrentProcess": ([], wintypes.HANDLE),
            "DuplicateHandle": (
                [
                    wintypes.HANDLE,
                    wintypes.HANDLE,
                    wintypes.HANDLE,
                    ctypes.POINTER(wintypes.HANDLE),
                    wintypes.DWORD,
                    wintypes.BOOL,
                    wintypes.DWORD,
                ],
                wintypes.BOOL,
            ),
            "InitializeProcThreadAttributeList": (
                [
                    ctypes.c_void_p,
                    wintypes.DWORD,
                    wintypes.DWORD,
                    ctypes.POINTER(size_type),
                ],
                wintypes.BOOL,
            ),
            "UpdateProcThreadAttribute": (
                [
                    ctypes.c_void_p,
                    wintypes.DWORD,
                    size_type,
                    ctypes.c_void_p,
                    size_type,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                ],
                wintypes.BOOL,
            ),
            "DeleteProcThreadAttributeList": ([ctypes.c_void_p], None),
            "CreateProcessW": (
                [
                    wintypes.LPCWSTR,
                    wintypes.LPWSTR,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    wintypes.BOOL,
                    wintypes.DWORD,
                    ctypes.c_void_p,
                    wintypes.LPCWSTR,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                ],
                wintypes.BOOL,
            ),
            "ResumeThread": ([wintypes.HANDLE], wintypes.DWORD),
            "TerminateProcess": ([wintypes.HANDLE, wintypes.UINT], wintypes.BOOL),
            "WaitForSingleObject": ([wintypes.HANDLE, wintypes.DWORD], wintypes.DWORD),
            "GetExitCodeProcess": (
                [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)],
                wintypes.BOOL,
            ),
        }
        initialize_attributes = self.k.InitializeProcThreadAttributeList
        functions: dict[str, _WinFunction[..., object]] = {
            "CreateJobObjectW": self.k.CreateJobObjectW,
            "SetInformationJobObject": self.k.SetInformationJobObject,
            "QueryInformationJobObject": self.k.QueryInformationJobObject,
            "TerminateJobObject": self.k.TerminateJobObject,
            "AssignProcessToJobObject": self.k.AssignProcessToJobObject,
            "CloseHandle": self.k.CloseHandle,
            "GetCurrentProcess": self.k.GetCurrentProcess,
            "DuplicateHandle": self.k.DuplicateHandle,
            "InitializeProcThreadAttributeList": initialize_attributes,
            "UpdateProcThreadAttribute": self.k.UpdateProcThreadAttribute,
            "DeleteProcThreadAttributeList": self.k.DeleteProcThreadAttributeList,
            "CreateProcessW": self.k.CreateProcessW,
            "ResumeThread": self.k.ResumeThread,
            "TerminateProcess": self.k.TerminateProcess,
            "WaitForSingleObject": self.k.WaitForSingleObject,
            "GetExitCodeProcess": self.k.GetExitCodeProcess,
        }
        for name, (args, result) in signatures.items():
            function = functions[name]
            function.argtypes = args
            function.restype = result
        try:
            self.job = self.k.CreateJobObjectW(None, None)
            if not self.job:
                raise self.native.WinError(self.native.get_last_error())
            limits = LIMIT()
            limits.basic.flags = 0x2000  # KILL_ON_JOB_CLOSE
            self._ok(
                self.k.SetInformationJobObject(
                    self.job, 9, ctypes.byref(limits), ctypes.sizeof(limits)
                )
            )
            with Path(os.devnull).open("rb", buffering=0) as null:
                raw = [
                    msvcrt.get_osfhandle(null.fileno()),
                    *(msvcrt.get_osfhandle(fd) for fd in writers),
                ]
                current = self.k.GetCurrentProcess()
                for handle in raw:
                    duplicate = wintypes.HANDLE()
                    self._ok(
                        self.k.DuplicateHandle(
                            current,
                            handle,
                            current,
                            ctypes.byref(duplicate),
                            0,
                            True,
                            2,
                        )
                    )
                    self.inherited.append(duplicate.value)
            size = size_type()
            self.k.InitializeProcThreadAttributeList(None, 1, 0, ctypes.byref(size))
            if not size.value:
                raise self.native.WinError(self.native.get_last_error())
            self.storage = ctypes.create_string_buffer(size.value)
            self.attributes = ctypes.cast(self.storage, ctypes.c_void_p)
            self._ok(
                self.k.InitializeProcThreadAttributeList(
                    self.attributes, 1, 0, ctypes.byref(size)
                )
            )
            self.attributes_initialized = True
            inherited = (wintypes.HANDLE * 3)(*self.inherited)
            self._ok(
                self.k.UpdateProcThreadAttribute(
                    self.attributes,
                    0,
                    0x20002,
                    ctypes.cast(inherited, ctypes.c_void_p),
                    ctypes.sizeof(inherited),
                    None,
                    None,
                )
            )
            startup = STARTEX()
            startup.start.cb = ctypes.sizeof(startup)
            startup.start.flags = 0x100
            startup.start.stdin, startup.start.stdout, startup.start.stderr = (
                self.inherited
            )
            startup.attributes = self.attributes
            command = ctypes.create_unicode_buffer(subprocess.list2cmdline(argv))
            environment = ctypes.create_unicode_buffer(
                "\0".join(
                    k + "=" + v
                    for k, v in sorted(env.items(), key=lambda item: item[0].casefold())
                )
                + "\0\0"
            )
            created = PROCESS()
            # Suspended: no command code runs before assignment to the held Job.
            self._ok(
                self.k.CreateProcessW(
                    argv[0],
                    command,
                    None,
                    None,
                    True,
                    0x4 | 0x80000 | 0x400,
                    environment,
                    str(cwd),
                    ctypes.byref(startup),
                    ctypes.byref(created),
                )
            )
            self.process, self.thread = created.process, created.thread
            self.pid, self.tid = int(created.pid), int(created.tid)
            self._ok(self.k.AssignProcessToJobObject(self.job, self.process))
            self.assigned = True
            if self.k.ResumeThread(self.thread) != 1:
                raise self.native.WinError(self.native.get_last_error())
            self._ok(self.k.CloseHandle(self.thread))
            self.thread = None
        except BaseException as error:
            self.launch_failure = {"type": type(error).__name__, "message": str(error)}
            if self.process:
                self.k.TerminateProcess(self.process, 125)
                self.k.WaitForSingleObject(self.process, 3000)
            if self.job:
                self.k.TerminateJobObject(self.job, 125)
            # The caller already retains this object before __init__. Even a
            # partial launch remains owned until its finally observes closure.
            raise
        finally:
            if self.attributes_initialized:
                self.k.DeleteProcThreadAttributeList(self.attributes)
                self.attributes = None
                self.attributes_initialized = False
            self.inherited = [
                handle for handle in self.inherited if not self.k.CloseHandle(handle)
            ]

    def _ok(self, value: int) -> None:
        if not value:
            raise self.native.WinError(self.native.get_last_error())

    def poll(self) -> int | None:
        observed = self.k.WaitForSingleObject(self.process, 0)
        if observed == _WINDOWS_WAIT_TIMEOUT:
            return None
        if observed != 0:
            raise self.native.WinError(self.native.get_last_error())
        code = wintypes.DWORD()
        self._ok(self.k.GetExitCodeProcess(self.process, ctypes.byref(code)))
        return int(code.value)

    def active(self) -> int:
        data = self.ACCOUNT()
        self._ok(
            self.k.QueryInformationJobObject(
                self.job, 1, ctypes.byref(data), ctypes.sizeof(data), None
            )
        )
        return int(data.active)

    def settle(self, deadline: float) -> Containment:
        if self.process is None:
            return {
                "held_job": bool(self.job),
                "terminated_job": False,
                "job_active_processes": 0,
                "direct_exit": None,
                "all_job_members_closed": True,
                "no_process_created": True,
            }
        active = self.active() if self.assigned else 0
        terminated = active != 0 or self.poll() is None
        if self.assigned and active:
            self._ok(self.k.TerminateJobObject(self.job, 125))
        if not self.assigned and self.poll() is None:
            self._ok(self.k.TerminateProcess(self.process, 125))
        while time.monotonic() < deadline and (
            self.poll() is None or (self.assigned and self.active())
        ):
            time.sleep(0.02)
        active = self.active() if self.assigned else 0
        return {
            "held_job": True,
            "assigned_before_resume": self.assigned,
            "terminated_job": terminated,
            "job_active_processes": active,
            "direct_exit": self.poll(),
            "all_job_members_closed": active == 0 and self.poll() is not None,
            "outside_job_descendants": "UNOBSERVED",
        }

    def close(self) -> None:
        self.inherited = [
            handle for handle in self.inherited if not self.k.CloseHandle(handle)
        ]
        for name in ("thread", "process", "job"):
            # The closed literal keyset names these exact typed owned fields.
            value = cast(int | None, getattr(self, name, None))
            if value:
                self._ok(self.k.CloseHandle(value))
                setattr(self, name, None)
        if self.inherited:
            raise RuntimeError("Owned inherited native handles remain unclosed")


def run(  # noqa: PLR0912, PLR0913, PLR0915 -- one ordered owner acquisition/unwind
    argv: Sequence[str | Path],
    *,
    cwd: Path,
    env: Mapping[str, str],
    stem: Path,
    seconds: float,
    deadlines: Budget,
) -> subprocess.CompletedProcess[bytes]:
    """One command; returncode is original only after zero-intervention closure."""
    _validate_budget(deadlines)
    if _PENDING_WINDOWS_OWNERS or _PENDING_LINUX_OWNERS:
        raise RuntimeError("Prior native command owner remains unresolved")
    if _sha(__file__) != _SOURCE_SHA:
        raise ValueError("Pinned command helper source changed")
    if not math.isfinite(seconds) or not 0 < seconds <= WORK_SECONDS:
        raise ValueError("Finite command budget required")
    command = [str(x) for x in argv]
    cwd = Path(cwd)
    stem = Path(stem)
    if (
        not command
        or not Path(command[0]).is_absolute()
        or not cwd.is_absolute()
        or not stem.is_absolute()
    ):
        raise ValueError("Explicit native argv/cwd/evidence required")
    if any("\0" in x for x in command) or any(
        not _is_text(v) or "\0" in k + v for k, v in env.items()
    ):
        raise ValueError("Native command contains invalid text")
    start = time.monotonic()
    until = min(deadlines["work_deadline"], start + seconds)
    if start >= until:
        raise TimeoutError("Whole native pipeline work deadline exhausted")
    close_until = min(deadlines["cleanup_deadline"], until + COMMAND_CLEANUP_SECONDS)
    record: CommandRecord = {
        "argv": command,
        "cwd": str(cwd),
        "environment": dict(env),
        "seconds": seconds,
        "work_deadline": until,
        "cleanup_deadline": close_until,
        "start_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "escaped_sessions_or_jobs": "UNOBSERVED",
    }
    _write(str(stem) + ".upfront.json", record)
    capture = _Capture(str(stem) + ".stdout", str(stem) + ".stderr")
    capture.start()
    child: subprocess.Popen[bytes] | None = None
    windows: _WindowsJob | None = None
    lease: int | None = None
    keeper: ProcessIdentity | None = None
    keeper_fd: int | None = None
    failure: ErrorRecord | None = None
    exit_code: int | None = None
    cleanup: Containment = {}
    try:
        if _runtime_platform() == "win32":
            # Retain the owner before __init__ so partially created suspended
            # hProcess/hThread handles remain reachable on every exception.
            windows = object.__new__(_WindowsJob)
            _WindowsJob.__init__(windows, command, cwd, dict(env), capture.writers)
            if windows.inherited:
                raise RuntimeError(
                    "Native inherited-handle cleanup failed after launch"
                )
            _write(
                str(stem) + ".launch.json",
                {
                    "kind": "SUSPENDED_THEN_ASSIGNED_JOB_AND_RESUMED",
                    "pid": windows.pid,
                    "primary_thread_id": windows.tid,
                    "handles_retained": True,
                },
            )
            capture.close_parent_writers()
            while (exit_code := windows.poll()) is None:
                if time.monotonic() >= until:
                    raise TimeoutError("Native command work deadline")
                if capture.overflow.is_set():
                    raise ValueError("Native command output cap")
                time.sleep(0.02)
            cleanup = windows.settle(
                min(close_until, time.monotonic() + COMMAND_CLEANUP_SECONDS)
            )
        elif _runtime_platform() == "linux":
            if not hasattr(os, "pidfd_open") or not hasattr(
                signal, "pidfd_send_signal"
            ):
                raise ValueError("Ubuntu pidfds required")
            read, lease = os.pipe()
            control: SessionControl = {
                "argv": command,
                "cwd": str(cwd),
                "environment": dict(env),
                "deadline": until,
                "cleanup_deadline": close_until,
                "helper_sha256": _SOURCE_SHA,
                "lease_fd": read,
                "stdout_fd": capture.writers[0],
                "stderr_fd": capture.writers[1],
                "launch": str(stem) + ".command-launch.json",
                "result": str(stem) + ".session-result.json",
            }
            _write(str(stem) + ".session-input.json", control)
            with (
                Path(str(stem) + ".keeper.stdout").open("xb") as stdout,
                Path(str(stem) + ".keeper.stderr").open("xb") as stderr,
            ):
                try:
                    child = subprocess.Popen(  # noqa: S603 -- pinned helper argv
                        [
                            sys.executable,
                            "-I",
                            "-S",
                            "-B",
                            str(Path(__file__).resolve()),
                            "--linux-worker",
                            str(stem) + ".session-input.json",
                        ],
                        cwd=cwd,
                        env={"PATH": os.defpath},
                        stdin=subprocess.DEVNULL,
                        stdout=stdout,
                        stderr=stderr,
                        start_new_session=True,
                        pass_fds=(read, *capture.writers),
                    )
                finally:
                    os.close(read)
                keeper = _proc(child.pid)
                if (
                    keeper is None
                    or keeper["sid"] != child.pid
                    or keeper["pgid"] != child.pid
                ):
                    raise ValueError("Owned keeper session unavailable")
                keeper_fd = _pidfd(keeper)
                if keeper_fd is None:
                    raise ValueError("Held keeper pidfd unavailable")
                _write(
                    str(stem) + ".launch.json",
                    {
                        "kind": "OWNED_NEW_SESSION_KEEPER",
                        "identity": keeper,
                        "keeper_argv": [
                            sys.executable,
                            "-I",
                            "-S",
                            "-B",
                            str(Path(__file__).resolve()),
                            "--linux-worker",
                            str(stem) + ".session-input.json",
                        ],
                    },
                )
                capture.close_parent_writers()
                while child.poll() is None:
                    if time.monotonic() >= until:
                        raise TimeoutError("Native command work deadline")
                    if capture.overflow.is_set():
                        raise ValueError("Native command output cap")
                    time.sleep(0.02)
                session = _session_result(
                    _load_json(Path(str(stem) + ".session-result.json"))
                )
                exit_code = session["exit_code"]
                cleanup = session.get("cleanup", Containment())
                if (
                    child.returncode != 0
                    or session.get("failure")
                    or session.get("timed_out")
                    or session.get("parent_lease_closed")
                    or not session.get("direct_child_reaped")
                ):
                    raise RuntimeError("Owned session command or cleanup failed")
        else:
            raise ValueError("Only native Windows and Ubuntu execution is supported")
        if time.monotonic() >= until:
            raise TimeoutError("Command completed after work deadline")
    except BaseException as error:
        failure = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        cleanup_error: ErrorRecord | None = None
        final_until = min(close_until, time.monotonic() + COMMAND_CLEANUP_SECONDS)
        try:
            if lease is not None:
                os.close(lease)
                lease = None
            if windows is not None and hasattr(windows, "job"):
                final = windows.settle(final_until)
                cleanup = {
                    **cleanup,
                    **final,
                    "terminated_job": cleanup.get("terminated_job", False)
                    or final["terminated_job"],
                }
                if final["all_job_members_closed"]:
                    windows.close()
                else:
                    _PENDING_WINDOWS_OWNERS.append(windows)
            if child is not None:
                while child.poll() is None and time.monotonic() < final_until:
                    time.sleep(0.02)
                if (
                    child.poll() is None
                    and keeper is not None
                    and keeper_fd is not None
                ):
                    cleanup = _settle_session(keeper, final_until)
                    cast(_PidfdSignal, signal).pidfd_send_signal(
                        keeper_fd, signal.SIGKILL
                    )
                with suppress(subprocess.TimeoutExpired):
                    child.wait(
                        timeout=max(0.01, min(2, final_until - time.monotonic()))
                    )
                cleanup["keeper_reaped"] = child.poll() is not None
                cleanup["session_absent"] = keeper is not None and not _session_members(
                    keeper["sid"]
                )
        except BaseException as error:
            cleanup_error = {"type": type(error).__name__, "message": str(error)}
            if (
                windows is not None
                and (
                    any(
                        getattr(windows, name, None)
                        for name in ("process", "job", "thread")
                    )
                    or getattr(windows, "inherited", [])
                )
                and windows not in _PENDING_WINDOWS_OWNERS
            ):
                _PENDING_WINDOWS_OWNERS.append(windows)
        finally:
            # Successful Popen transfers an owner even if the later identity
            # or pidfd acquisition fails. Keep that exact Popen and any partial
            # native identity/handle until closure is proved; no PID fallback.
            # Pre-pidfd refusal is quarantined even if the direct child exits:
            # it never established the required held native session authority.
            if child is not None and not (
                keeper_fd is not None
                and cleanup.get("keeper_reaped")
                and cleanup.get("session_absent")
            ):
                _PENDING_LINUX_OWNERS.append((child, keeper_fd, keeper))
                cleanup["launched_owner_retained"] = True
                cleanup["held_pidfd_owner_retained"] = keeper_fd is not None
            elif keeper_fd is not None:
                os.close(keeper_fd)
            captured = capture.finish()
            closed = (
                cleanup.get("all_job_members_closed")
                if _runtime_platform() == "win32"
                else cleanup.get("session_absent") and cleanup.get("keeper_reaped")
            )
            intervened = cleanup.get("terminated_job", False) or bool(
                cleanup.get("signals")
            )
            ok = (
                exit_code == 0
                and failure is None
                and cleanup_error is None
                and closed
                and not intervened
                and captured["readers_closed"]
                and not captured["overflow"]
                and not captured["errors"]
            )
            record.update(
                {
                    "exit_code": exit_code,
                    "success": bool(ok),
                    "failure": failure,
                    "cleanup_error": cleanup_error,
                    "containment": cleanup,
                    "capture": captured,
                    "seconds_elapsed": time.monotonic() - start,
                    "end_utc": datetime.datetime.now(datetime.UTC).isoformat(),
                    "stdout_sha256": _sha(str(stem) + ".stdout"),
                    "stderr_sha256": _sha(str(stem) + ".stderr"),
                }
            )
            if windows is not None:
                record["native_launch_failure"] = getattr(
                    windows, "launch_failure", None
                )
                record["retained_inherited_handle_count"] = len(
                    getattr(windows, "inherited", [])
                )
            _write(str(stem) + ".result.json", record)
    if not record["success"]:
        raise RuntimeError("Native command or contained cleanup failed: " + str(stem))
    return subprocess.CompletedProcess(
        command,
        cast(int, exit_code),
        Path(str(stem) + ".stdout").read_bytes(),
        Path(str(stem) + ".stderr").read_bytes(),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--linux-worker", required=True)
    raise SystemExit(_linux_worker(parser.parse_args().linux_worker))
