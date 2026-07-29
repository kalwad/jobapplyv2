"""Shell-free subprocess execution with finite time and retained-output bounds.

This helper is test infrastructure. It preserves ordinary child exit codes and
captured diagnostics, while timeouts, undecodable output, and output overflow
become explicit nonzero results. Reader threads drain both pipes concurrently,
so a noisy child cannot deadlock on one stream while the other is inspected.
"""

from __future__ import annotations

import math
import subprocess
import threading
import time
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO

DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024
OUTPUT_LIMIT_RETURN_CODE = 125
TIMEOUT_RETURN_CODE = 124
UNDECODABLE_OUTPUT_RETURN_CODE = 126
_READ_CHUNK_BYTES = 16 * 1024
_POLL_SECONDS = 0.01
_TERMINATE_GRACE_SECONDS = 0.5


@dataclass
class _CaptureState:
    max_bytes: int
    stdout_chunks: list[bytes] = field(default_factory=list)
    stderr_chunks: list[bytes] = field(default_factory=list)
    retained_bytes: int = 0
    overflow: threading.Event = field(default_factory=threading.Event)
    lock: threading.Lock = field(default_factory=threading.Lock)


def _drain(
    stream: BinaryIO,
    sink: list[bytes],
    state: _CaptureState,
) -> None:
    while True:
        chunk = stream.read(_READ_CHUNK_BYTES)
        if not chunk:
            return
        with state.lock:
            remaining = state.max_bytes - state.retained_bytes
            if remaining > 0:
                retained = chunk[:remaining]
                sink.append(retained)
                state.retained_bytes += len(retained)
            if len(chunk) > remaining:
                state.overflow.set()
                return


def _stop_child(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=_TERMINATE_GRACE_SECONDS)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=_TERMINATE_GRACE_SECONDS)


def _decode_output(
    stdout_bytes: bytes,
    stderr_bytes: bytes,
    *,
    args: Sequence[str],
) -> subprocess.CompletedProcess[str] | tuple[str, str]:
    try:
        return (
            stdout_bytes.decode("utf-8", errors="strict"),
            stderr_bytes.decode("utf-8", errors="strict"),
        )
    except UnicodeDecodeError:
        return subprocess.CompletedProcess(
            args=list(args),
            returncode=UNDECODABLE_OUTPUT_RETURN_CODE,
            stdout="",
            stderr=(
                "bounded-process: child output was not strict UTF-8; "
                "captured content withheld\n"
            ),
        )


def _validate_request(
    args: Sequence[str],
    *,
    timeout_seconds: float,
    label: str,
    max_output_bytes: int,
) -> None:
    if not args or any(arg == "" for arg in args):
        raise ValueError("args must be a nonempty sequence of nonempty strings")
    if (
        not math.isfinite(timeout_seconds)
        or timeout_seconds <= 0
        or timeout_seconds > 300
    ):
        raise ValueError("timeout_seconds must be finite and in (0, 300]")
    if max_output_bytes < 1 or max_output_bytes > DEFAULT_MAX_OUTPUT_BYTES:
        raise ValueError(f"max_output_bytes must be in [1, {DEFAULT_MAX_OUTPUT_BYTES}]")
    if not label or len(label) > 80:
        raise ValueError("label must contain 1..80 characters")


def run_bounded_process(
    args: Sequence[str],
    *,
    cwd: Path,
    timeout_seconds: float,
    label: str,
    max_output_bytes: int = DEFAULT_MAX_OUTPUT_BYTES,
) -> subprocess.CompletedProcess[str]:
    """Run one argv-only child with a deadline and combined output ceiling."""

    _validate_request(
        args,
        timeout_seconds=timeout_seconds,
        label=label,
        max_output_bytes=max_output_bytes,
    )

    argv = list(args)
    try:
        process = subprocess.Popen(
            argv,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
        )
    except OSError:
        return subprocess.CompletedProcess(
            args=argv,
            returncode=127,
            stdout="",
            stderr=f"bounded-process: {label} could not be started\n",
        )

    stdout_pipe = process.stdout
    stderr_pipe = process.stderr
    if stdout_pipe is None or stderr_pipe is None:
        _stop_child(process)
        return subprocess.CompletedProcess(
            args=argv,
            returncode=127,
            stdout="",
            stderr=f"bounded-process: {label} capture pipes were unavailable\n",
        )

    state = _CaptureState(max_bytes=max_output_bytes)
    stdout_thread = threading.Thread(
        target=_drain,
        args=(stdout_pipe, state.stdout_chunks, state),
        daemon=True,
        name="bounded-stdout",
    )
    stderr_thread = threading.Thread(
        target=_drain,
        args=(stderr_pipe, state.stderr_chunks, state),
        daemon=True,
        name="bounded-stderr",
    )
    stdout_thread.start()
    stderr_thread.start()

    deadline = time.monotonic() + timeout_seconds
    terminal_reason: str | None = None
    while process.poll() is None:
        if state.overflow.is_set():
            terminal_reason = "output"
            break
        if time.monotonic() >= deadline:
            terminal_reason = "timeout"
            break
        state.overflow.wait(_POLL_SECONDS)

    if terminal_reason is not None:
        _stop_child(process)
    else:
        process.wait()

    stdout_thread.join(timeout=_TERMINATE_GRACE_SECONDS)
    stderr_thread.join(timeout=_TERMINATE_GRACE_SECONDS)
    stdout_pipe.close()
    stderr_pipe.close()
    if stdout_thread.is_alive() or stderr_thread.is_alive():
        terminal_reason = terminal_reason or "output"
    if state.overflow.is_set():
        terminal_reason = "output"

    stdout_bytes = b"".join(state.stdout_chunks)
    stderr_bytes = b"".join(state.stderr_chunks)
    decoded = _decode_output(stdout_bytes, stderr_bytes, args=argv)
    if isinstance(decoded, subprocess.CompletedProcess):
        return decoded
    stdout, stderr = decoded

    if terminal_reason == "timeout":
        return subprocess.CompletedProcess(
            args=argv,
            returncode=TIMEOUT_RETURN_CODE,
            stdout=stdout,
            stderr=(
                stderr
                + f"bounded-process: {label} timed out after "
                + f"{timeout_seconds:g}s\n"
            ),
        )
    if terminal_reason == "output":
        return subprocess.CompletedProcess(
            args=argv,
            returncode=OUTPUT_LIMIT_RETURN_CODE,
            stdout=stdout,
            stderr=(
                stderr
                + f"bounded-process: {label} exceeded the combined "
                + f"{max_output_bytes}-byte output ceiling; child output "
                + "was truncated\n"
            ),
        )

    return subprocess.CompletedProcess(
        args=argv,
        returncode=process.returncode,
        stdout=stdout,
        stderr=stderr,
    )
