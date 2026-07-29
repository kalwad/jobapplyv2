"""Regression tests for finite Python child output and timeout handling."""

from __future__ import annotations

import sys
from pathlib import Path

from _bounded_process import (
    DEFAULT_MAX_OUTPUT_BYTES,
    OUTPUT_LIMIT_RETURN_CODE,
    TIMEOUT_RETURN_CODE,
    run_bounded_process,
)


def test_over_one_mib_child_is_stopped_and_retained_output_is_bounded(
    tmp_path: Path,
) -> None:
    result = run_bounded_process(
        [
            sys.executable,
            "-c",
            "import sys; sys.stdout.write('x' * (1024 * 1024 + 65536))",
        ],
        cwd=tmp_path,
        timeout_seconds=5,
        label="synthetic noisy child",
    )
    assert result.returncode == OUTPUT_LIMIT_RETURN_CODE
    assert "exceeded the combined 1048576-byte output ceiling" in result.stderr
    assert len(result.stdout.encode()) <= DEFAULT_MAX_OUTPUT_BYTES
    assert "truncated" in result.stderr


def test_timeout_retains_prefix_and_reports_operation_deadline(tmp_path: Path) -> None:
    result = run_bounded_process(
        [
            sys.executable,
            "-c",
            "import time; print('useful-prefix', flush=True); time.sleep(2)",
        ],
        cwd=tmp_path,
        timeout_seconds=0.1,
        label="synthetic slow child",
    )
    assert result.returncode == TIMEOUT_RETURN_CODE
    assert result.stdout == "useful-prefix\n"
    assert "synthetic slow child timed out after 0.1s" in result.stderr


def test_ordinary_nonzero_exit_preserves_stdout_and_stderr(tmp_path: Path) -> None:
    result = run_bounded_process(
        [
            sys.executable,
            "-c",
            (
                "import sys; "
                "sys.stdout.buffer.write(b'ordinary-out\\r\\n'); "
                "sys.stderr.buffer.write(b'ordinary-error\\r\\n'); "
                "raise SystemExit(7)"
            ),
        ],
        cwd=tmp_path,
        timeout_seconds=5,
        label="synthetic nonzero child",
    )
    assert result.returncode == 7
    assert result.stdout == "ordinary-out\n"
    assert result.stderr == "ordinary-error\n"
