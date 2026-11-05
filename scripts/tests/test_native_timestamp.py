"""UTC ordering controls against the exact prospective host timestamp parser."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest


@pytest.fixture
def inputs() -> ModuleType:
    path = Path(__file__).parents[2] / "scripts/windows11/windows11_inputs.py"
    spec = importlib.util.spec_from_file_location("native_timestamp_inputs", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "fraction",
    [
        "",
        ".1",
        ".12",
        ".123",
        ".1234",
        ".12345",
        ".123456",
        ".1234567",
        ".12345678",
        ".123456789",
    ],
)
def test_real_utc_timestamp_fraction_contract(
    inputs: ModuleType, fraction: str
) -> None:
    whole, part = inputs.timestamp_parts("2024-02-29T23:59:59" + fraction + "Z")
    assert whole > 0
    assert part == int(fraction.removeprefix(".").ljust(9, "0"))


@pytest.mark.parametrize(
    "value",
    [
        "2023-02-29T00:00:00Z",
        "2024-13-01T00:00:00Z",
        "2024-04-31T00:00:00Z",
        "2024-01-01T24:00:00Z",
        "2024-01-01T00:60:00Z",
        "2024-01-01T00:00:60Z",
        "0000-01-01T00:00:00Z",
        "2024-01-01T00:00:00.Z",
        "2024-01-01T00:00:00.1234567890Z",
        "2024-01-01T00:00:00+00:00",
        "2024-01-01T00:00:00z",
        "2024-01-01T00:00:00Z\n",
        "٢٠٢٤-01-01T00:00:00Z",
    ],
)
def test_invalid_calendar_time_or_noncanonical_wire_is_refused(
    inputs: ModuleType, value: str
) -> None:
    with pytest.raises(ValueError, match=r"UTC|year|month|day|hour|minute|second"):
        inputs.timestamp_parts(value)


@pytest.mark.parametrize(
    ("before", "after"),
    [
        ("2026-10-29T17:31:16.599582Z", "2026-10-29T17:31:34.830862Z"),
        ("2024-01-01T00:00:00.123456788Z", "2024-01-01T00:00:00.123456789Z"),
        ("2024-01-01T00:00:00.999999999Z", "2024-01-01T00:00:01Z"),
        ("2024-12-31T23:59:59.999999999Z", "2025-01-01T00:00:00Z"),
    ],
)
def test_strict_advance_retains_submicrosecond_and_calendar_boundary(
    inputs: ModuleType, before: str, after: str
) -> None:
    assert inputs.timestamp_parts(before) < inputs.timestamp_parts(after)
    assert not inputs.timestamp_parts(after) < inputs.timestamp_parts(before)


def test_changed_fraction_spelling_is_not_time_advancement(inputs: ModuleType) -> None:
    assert inputs.timestamp_parts("2024-01-01T00:00:00.1Z") == inputs.timestamp_parts(
        "2024-01-01T00:00:00.100000000Z"
    )


def lifecycle_rows(
    inputs: ModuleType, before: str, after: str
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = [
        {
            "phase": phase,
            "nonce": "a" * 64,
            "package_sha256": "b" * 64,
            "status": "PASS",
        }
        for phase in inputs.REQUIRED_PHASES
    ]
    rows[2]["statuses"] = [401] * 12
    keyboard = next(row for row in rows if row["phase"] == "keyboard")
    keyboard.update(
        action="owned_foreground_focused_Check_again_Enter",
        checked_before=before,
        checked_after=after,
    )
    accelerator = next(row for row in rows if row["phase"] == "accelerator")
    accelerator.update(action="owned_foreground_Ctrl_Q", remaining_owned_processes=0)
    rows[-1]["remaining_owned_processes"] = 0
    return rows


@pytest.mark.parametrize(
    ("before", "after"),
    [
        ("2024-01-01T00:00:00.123Z", "2024-01-01T00:00:00.124Z"),
        ("2026-10-29T17:31:16.599582Z", "2026-10-29T17:31:34.830862Z"),
        ("2024-01-01T00:00:00.123456788Z", "2024-01-01T00:00:00.123456789Z"),
    ],
)
def test_actual_lifecycle_accepts_three_six_and_nine_digit_strict_advances(
    inputs: ModuleType, before: str, after: str
) -> None:
    inputs.lifecycle(lifecycle_rows(inputs, before, after), "a" * 64, "b" * 64)


@pytest.mark.parametrize(
    ("before", "after"),
    [
        ("2024-01-01T00:00:00.1Z", "2024-01-01T00:00:00.100000000Z"),
        ("2024-01-01T00:00:00.123456789Z", "2024-01-01T00:00:00.123456788Z"),
        ("2024-02-30T00:00:00Z", "2024-02-31T00:00:00Z"),
        ("2024-01-01T24:00:00Z", "2024-01-01T24:00:01Z"),
    ],
)
def test_actual_lifecycle_refuses_equal_backward_and_invalid_utc(
    inputs: ModuleType, before: str, after: str
) -> None:
    with pytest.raises(ValueError, match=r"advancement|day|hour"):
        inputs.lifecycle(lifecycle_rows(inputs, before, after), "a" * 64, "b" * 64)
