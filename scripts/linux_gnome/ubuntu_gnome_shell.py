"""Pure receipt oracle for bounded native shell capture, never a zoom API.

Geometry is an estimate for two exact glyph ranges at an observed fixed backing
scale. It is neither a WebView zoom percentage property nor a screen reader.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import stat
from pathlib import Path
from typing import Any

DPI_PER_MONITOR_AWARE = 2
MUTTER_MODE_FIELDS = 7

ROUTES = (
    ("home", "Home"),
    ("jobs", "Jobs"),
    ("tracker", "Tracker"),
    ("documents", "Documents / Resumes"),
    ("profile", "Profile"),
    ("settings", "Settings"),
    ("diagnostics", "Diagnostics"),
)
ANCHORS = ("0.0.1", "2.12.4")
STAGES = ("baseline", "step1", "step2", "step3", "step4", "step5", "reset")
POLICY = {
    "schema": "japp-native-shell-geometry-policy-v1",
    "anchors": ANCHORS,
    "target": 2,
    "relative_tolerance": 0.05,
    "rounding_pixels": 1,
    "increments": 5,
    "routes": ROUTES,
    "heading_prefix_characters": 4,
    "heading_geometry": "VISIBLE_SINGLE_LINE_IN_OWNED_FRAME_NOT_LINEAR_SCALE",
    "anchor_typography": "desktop-version .8125rem ui-monospace",
    "anchor_scope": "Desktop versions region with App version and Tauri version labels",
    "fixed_frame_tolerance": 0,
    "reader_output": "NOT_COLLECTED",
}
POLICY_SHA256 = hashlib.sha256(
    json.dumps(POLICY, sort_keys=True, separators=(",", ":")).encode()
).hexdigest()


def _object(value: object, keys: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ValueError("Exact native observation fields required")
    return value


def _number(value: object, lower: float, upper: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Finite native geometry required")
    if not lower <= value <= upper:
        raise ValueError("Finite native geometry required")
    return float(value)


def _rect(value: object) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:  # noqa: PLR2004
        raise ValueError("Four-coordinate actual rectangle required")
    x, y = (_number(v, -32768, 32768) for v in value[:2])
    width, height = (_number(v, 1, 8192) for v in value[2:])
    return x, y, width, height


def _pin(value: object) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError("Exact observation digest required")
    return value


def _anchor(value: object, label: str) -> tuple[float, float, float, float]:
    row = _object(value, {"text", "rect", "single_line", "visible", "showing"})
    if (
        row["text"] != label
        or row["single_line"] is not True
        or row["visible"] is not True
        or row["showing"] is not True
    ):
        raise ValueError("Exact unique visible whole single-line glyph range required")
    return _rect(row["rect"])


def measurement(value: object) -> dict[str, Any]:
    row = _object(
        value, {"stage", "window_id", "app_pid", "frame", "backing", "anchors"}
    )
    if (
        row["stage"] not in STAGES
        or not isinstance(row["window_id"], str)
        or not 1 <= len(row["window_id"]) <= 128  # noqa: PLR2004
        or type(row["app_pid"]) is not int
        or row["app_pid"] <= 0
        or not isinstance(row["backing"], dict)
        or not isinstance(row["anchors"], list)
        or len(row["anchors"]) != len(ANCHORS)
    ):
        raise ValueError("Complete held native measurement required")
    frame = _rect(row["frame"])
    for anchor, label in zip(row["anchors"], ANCHORS, strict=True):
        x, y, width, height = _anchor(anchor, label)
        if (
            x < frame[0]
            or y < frame[1]
            or x + width > frame[0] + frame[2]
            or y + height > frame[1] + frame[3]
        ):
            raise ValueError("Glyph range is clipped or outside owned window")
    return row


def _backing(value: object, platform: str) -> None:
    if platform == "WINDOWS_UIA":
        row = _object(value, {"kind", "dpi", "awareness"})
        if (
            row["kind"] != "WIN32_OWNED_HWND"
            or type(row["dpi"]) is not int
            or not 96 <= row["dpi"] <= 768  # noqa: PLR2004
            or row["awareness"] != DPI_PER_MONITOR_AWARE
        ):
            raise ValueError("Actual per-monitor owned-window DPI required")
    elif platform == "GNOME_ATSPI":
        row = _object(
            value,
            {
                "kind",
                "serial",
                "connector",
                "width",
                "height",
                "scale",
                "transform",
                "layout_mode",
            },
        )
        if (
            row["kind"] != "MUTTER_SINGLE_PRIMARY_CURRENT_MODE"
            or type(row["serial"]) is not int
            or row["serial"] < 0
            or not isinstance(row["connector"], str)
            or not 1 <= len(row["connector"]) <= 128  # noqa: PLR2004
            or type(row["scale"]) not in {int, float}
            or row["scale"] != 1
            or type(row["transform"]) is not int
            or row["transform"] != 0
            or type(row["layout_mode"]) is not int
            or row["layout_mode"] not in {1, 2}
        ):
            raise ValueError(
                "Actual untransformed single-monitor scale-one state required"
            )
        _number(row["width"], 640, 1920)
        _number(row["height"], 480, 1200)
    else:
        raise ValueError("Closed native platform required")


def _near(actual: float, baseline: float, target: float) -> bool:
    return abs(actual - target * baseline) <= max(1, 0.05 * target * baseline)


def validate_measurements(values: object, platform: str) -> list[dict[str, Any]]:
    if not isinstance(values, list) or len(values) != len(STAGES):
        raise ValueError("Baseline, five measured increments and reset required")
    rows = [measurement(value) for value in values]
    if [row["stage"] for row in rows] != list(STAGES):
        raise ValueError("Exact ordered native scale measurements required")
    baseline = rows[0]
    _backing(baseline["backing"], platform)
    for row in rows:
        if any(
            row[key] != baseline[key]
            for key in ("window_id", "app_pid", "frame", "backing")
        ):
            raise ValueError("Owned window, physical frame or backing scale changed")
    for index in range(len(ANCHORS)):
        base = _rect(baseline["anchors"][index]["rect"])
        enlarged = _rect(rows[-2]["anchors"][index]["rect"])
        reset = _rect(rows[-1]["anchors"][index]["rect"])
        for dimension in (2, 3):
            if not _near(enlarged[dimension], base[dimension], 2):
                raise ValueError("Actual glyph scale is not measured near two")
            if not _near(reset[dimension], base[dimension], 1):
                raise ValueError("Actual reset glyph scale did not return near one")
    return rows


def utc_parts(value: object) -> tuple[int, int]:
    if not isinstance(value, str):
        raise ValueError("Actual UTC timestamp required")
    match = re.fullmatch(
        r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?Z",
        value,
    )
    if match is None:
        raise ValueError("Actual UTC timestamp required")
    year, month, day, hour, minute, second = (int(match[i]) for i in range(1, 7))
    whole = datetime.datetime(
        year, month, day, hour, minute, second, tzinfo=datetime.UTC
    )
    return whole.toordinal() * 86400 + hour * 3600 + minute * 60 + second, int(
        (match[7] or "").ljust(9, "0")
    )


def validate_capture(value: object, subject: str, platform: str) -> None:
    row = _object(
        value,
        {
            "schema",
            "policy_sha256",
            "subject_sha256",
            "platform",
            "measurements",
            "routes",
            "reset_image",
            "reader_output",
        },
    )
    if (
        row["schema"] != "japp-native-shell-capture-v1"
        or row["policy_sha256"] != POLICY_SHA256
        or row["subject_sha256"] != _pin(subject)
        or row["platform"] != platform
        or row["reader_output"] != "NOT_COLLECTED"
    ):
        raise ValueError("Exact source-bound native capture scope required")
    rows = validate_measurements(row["measurements"], platform)
    routes = row["routes"]
    if not isinstance(routes, list) or len(routes) != len(ROUTES) * 2:
        raise ValueError(
            "All seven native routes at baseline and enlarged scale required"
        )
    expected = [
        (scale, slug, label)
        for scale in ("baseline", "enlarged")
        for slug, label in ROUTES
    ]
    for capture, (scale, slug, label) in zip(routes, expected, strict=True):
        item = _object(
            capture,
            {
                "scale",
                "route",
                "heading",
                "heading_unique",
                "heading_focused",
                "navigation_unique",
                "image_sha256",
                "image_width",
                "image_height",
                "tab_shift_tab",
                "skip_main",
                "glyph",
                "frame",
                "backing",
                "window_id",
                "app_pid",
                "checked_before",
                "checked_after",
            },
        )
        if (item["scale"], item["route"], item["heading"]) != (
            scale,
            slug,
            label,
        ) or any(
            item[key] is not True
            for key in (
                "heading_unique",
                "heading_focused",
                "navigation_unique",
                "tab_shift_tab",
                "skip_main",
            )
        ):
            raise ValueError(
                "Exact unique native route and keyboard heading focus required"
            )
        if any(
            item[key] != rows[0][key]
            for key in ("frame", "backing", "window_id", "app_pid")
        ):
            raise ValueError(
                "Route changed actual window frame, identity or backing scale"
            )
        glyph = _anchor(item["glyph"], label[:4])
        frame = _rect(item["frame"])
        if (
            glyph[0] < frame[0]
            or glyph[1] < frame[1]
            or glyph[0] + glyph[2] > frame[0] + frame[2]
            or glyph[1] + glyph[3] > frame[1] + frame[3]
        ):
            raise ValueError("Actual route prefix is clipped or outside owned window")
        if slug == "diagnostics":
            if utc_parts(item["checked_after"]) <= utc_parts(item["checked_before"]):
                raise ValueError(
                    "Actual native Enter Check again did not strictly advance time"
                )
        elif item["checked_before"] is not None or item["checked_after"] is not None:
            raise ValueError("Only Diagnostics supplies the service timestamp")
        _pin(item["image_sha256"])
        _number(item["image_width"], 640, 1920)
        _number(item["image_height"], 480, 1200)
        if platform == "GNOME_ATSPI" and (
            item["image_width"] != rows[0]["backing"]["width"]
            or item["image_height"] != rows[0]["backing"]["height"]
        ):
            raise ValueError("Actual monitor mode and owned QMP frame differ")
    _pin(row["reset_image"])


def mutter_backing(value: object) -> dict[str, Any]:
    """Parse the documented read-only GetCurrentState reply; no configuration."""
    if not isinstance(value, (list, tuple)) or len(value) != 4:  # noqa: PLR2004
        raise ValueError("Exact Mutter current-state reply required")
    serial, monitors, logical, properties = value
    if (
        type(serial) is not int
        or not isinstance(monitors, (list, tuple))
        or len(monitors) != 1
        or not isinstance(logical, (list, tuple))
        or len(logical) != 1
        or not isinstance(properties, dict)
    ):
        raise ValueError("One actual physical and logical monitor required")
    monitor, layout = monitors[0], logical[0]
    if (
        not isinstance(monitor, (list, tuple))
        or len(monitor) != 3  # noqa: PLR2004
        or not isinstance(layout, (list, tuple))
        or len(layout) != 7  # noqa: PLR2004
        or not isinstance(monitor[0], (list, tuple))
        or len(monitor[0]) != 4  # noqa: PLR2004
        or not isinstance(monitor[1], (list, tuple))
        or not 1 <= len(monitor[1]) <= 128  # noqa: PLR2004
        or list(layout[:2]) != [0, 0]
        or layout[4] is not True
        or list(layout[5]) != [monitor[0]]
    ):
        raise ValueError("Exact single primary unmirrored mode binding required")
    modes = []
    for mode in monitor[1]:
        if (
            not isinstance(mode, (list, tuple))
            or len(mode) != MUTTER_MODE_FIELDS
            or not isinstance(mode[6], dict)
        ):
            raise ValueError("Documented finite native mode record required")
        if mode[6].get("is-current") is True:
            modes.append(mode)
    if len(modes) != 1:
        raise ValueError("One actual current physical mode required")
    result = {
        "kind": "MUTTER_SINGLE_PRIMARY_CURRENT_MODE",
        "serial": serial,
        "connector": monitor[0][0],
        "width": modes[0][1],
        "height": modes[0][2],
        "scale": layout[2],
        "transform": layout[3],
        "layout_mode": properties.get("layout-mode"),
    }
    _backing(result, "GNOME_ATSPI")
    return result


def _image_identity(info: os.stat_result) -> tuple[int, ...]:
    return (
        info.st_dev,
        info.st_ino,
        info.st_size,
        info.st_mtime_ns,
        info.st_ctime_ns,
        info.st_mode,
    )


def verify_capture_images(root: Path, capture: dict[str, Any]) -> None:
    """Join exact owned files to observations; visual readability stays separate."""
    validate_capture(capture, capture["subject_sha256"], capture["platform"])
    platform = capture["platform"]
    suffix = ".png" if platform == "WINDOWS_UIA" else ".ppm"
    files = [
        (
            "shell-" + row["scale"] + "-" + row["route"] + suffix,
            row["image_sha256"],
            (row["image_width"], row["image_height"]),
        )
        for row in capture["routes"]
    ]
    reset_name = (
        "shell-reset.png"
        if platform == "WINDOWS_UIA"
        else "05-keyboard-after-enter.ppm"
    )
    reset = capture["measurements"][-1]
    dimensions = (
        tuple(reset["frame"][2:])
        if platform == "WINDOWS_UIA"
        else (reset["backing"]["width"], reset["backing"]["height"])
    )
    files.append((reset_name, capture["reset_image"], dimensions))
    for name, pin, expected in files:
        path = root / name
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode) or not 32 <= before.st_size <= 4 * 1024**2:  # noqa: PLR2004
            raise ValueError("Bounded regular owned shell image required")
        data = path.read_bytes()
        after = path.lstat()
        if (
            _image_identity(before) != _image_identity(after)
            or len(data) != before.st_size
            or hashlib.sha256(data).hexdigest() != pin
        ):
            raise ValueError("Actual owned shell image changed or binding differs")
        if suffix == ".png":
            if data[:8] != b"\x89PNG\r\n\x1a\n" or data[8:16] != b"\x00\x00\x00\rIHDR":
                raise ValueError("Actual owned PNG header unavailable")
            dimensions = (
                int.from_bytes(data[16:20], "big"),
                int.from_bytes(data[20:24], "big"),
            )
        else:
            header = re.match(rb"P6\s+([0-9]+)\s+([0-9]+)\s+255\s", data)
            if header is None:
                raise ValueError("Actual owned RGB QMP frame unavailable")
            dimensions = (int(header[1]), int(header[2]))
            if len(data) != header.end() + dimensions[0] * dimensions[1] * 3:
                raise ValueError("Actual QMP frame pixel length differs")
        if dimensions != expected:
            raise ValueError(
                "Actual shell image dimensions differ from native observation"
            )
