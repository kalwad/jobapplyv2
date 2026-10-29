"""Pure synthetic receipt controls; no native API or percentage is fabricated."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

ROOT = Path(__file__).parents[2]


@pytest.fixture
def oracle() -> ModuleType:
    name = "native_shell_receipt_oracle"
    spec = importlib.util.spec_from_file_location(
        name, ROOT / "scripts/linux_gnome/ubuntu_gnome_shell.py"
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def capture(oracle: ModuleType, platform: str = "WINDOWS_UIA") -> dict[str, Any]:
    backing = (
        {"kind": "WIN32_OWNED_HWND", "dpi": 96, "awareness": 2}
        if platform == "WINDOWS_UIA"
        else {
            "kind": "MUTTER_SINGLE_PRIMARY_CURRENT_MODE",
            "serial": 7,
            "connector": "Virtual-1",
            "width": 1120,
            "height": 760,
            "scale": 1.0,
            "transform": 0,
            "layout_mode": 1,
        }
    )
    measurements = []
    for index, stage in enumerate(oracle.STAGES):
        ratio = 1 if stage == "reset" else 1 + index * 0.2
        measurements.append(
            {
                "stage": stage,
                "window_id": "synthetic-owned-window",
                "app_pid": 123,
                "frame": [0, 0, 1120, 760],
                "backing": copy.deepcopy(backing),
                "anchors": [
                    {
                        "text": label,
                        "rect": [40, 100 + i * 50, 90 * ratio, 20 * ratio],
                        "single_line": True,
                        "visible": True,
                        "showing": True,
                    }
                    for i, label in enumerate(oracle.ANCHORS)
                ],
            }
        )
    return {
        "schema": "japp-native-shell-capture-v1",
        "policy_sha256": oracle.POLICY_SHA256,
        "subject_sha256": "a" * 64,
        "platform": platform,
        "measurements": measurements,
        "routes": [
            {
                "scale": scale,
                "route": slug,
                "heading": label,
                "checked_before": "2024-01-01T00:00:00.123456788Z"
                if slug == "diagnostics"
                else None,
                "checked_after": "2024-01-01T00:00:00.123456789Z"
                if slug == "diagnostics"
                else None,
                "frame": [0, 0, 1120, 760],
                "backing": copy.deepcopy(backing),
                "window_id": "synthetic-owned-window",
                "app_pid": 123,
                "glyph": {
                    "text": label[:4],
                    "rect": [
                        40,
                        300,
                        40 * (1 if scale == "baseline" else 1.86),
                        20 * (1 if scale == "baseline" else 1.92),
                    ],
                    "single_line": True,
                    "visible": True,
                    "showing": True,
                },
                "heading_unique": True,
                "heading_focused": True,
                "navigation_unique": True,
                "tab_shift_tab": True,
                "skip_main": True,
                "image_sha256": "b" * 64,
                "image_width": 1120,
                "image_height": 760,
            }
            for scale in ("baseline", "enlarged")
            for slug, label in oracle.ROUTES
        ],
        "reset_image": "c" * 64,
        "reader_output": "NOT_COLLECTED",
    }


@pytest.mark.parametrize("platform", ["WINDOWS_UIA", "GNOME_ATSPI"])
def test_exact_two_glyph_measurements_and_seven_routes_admit(
    oracle: ModuleType, platform: str
) -> None:
    # Proportional heading glyphs are visibility evidence, never a linear zoom ruler.
    # The two mono version runs alone supply quantitative scale. No real guest claim.
    oracle.validate_capture(capture(oracle, platform), "a" * 64, platform)


MUTATION_REASONS = {
    "route_glyph_missing": "Finite native geometry required",
    "route_backing_changed": "Route changed",
    "same_bounds": "near two",
    "only_one_anchor_scales": "near two",
    "width_only": "near two",
    "at_175_percent": "near two",
    "wrong_reset": "near one",
    "changed_dpi": "changed",
    "changed_frame": "changed",
    "changed_process": "changed",
    "wrapped": "single-line",
    "hidden": "single-line",
    "clipped": "clipped",
    "missing_increment": "Baseline",
    "duplicated_route": "Exact unique",
    "missing_route": "All seven",
    "wrong_heading": "Exact unique",
    "no_keyboard_focus": "Exact unique",
    "duplicate_nav": "Exact unique",
    "wrong_subject": "source-bound",
    "reader_inference": "source-bound",
    "unknown_field": "fields",
    "nan": "Finite",
}


@pytest.mark.parametrize(
    "mutation",
    [
        "same_bounds",
        "route_glyph_missing",
        "route_backing_changed",
        "only_one_anchor_scales",
        "width_only",
        "at_175_percent",
        "wrong_reset",
        "changed_dpi",
        "changed_frame",
        "changed_process",
        "wrapped",
        "hidden",
        "clipped",
        "missing_increment",
        "duplicated_route",
        "missing_route",
        "wrong_heading",
        "no_keyboard_focus",
        "duplicate_nav",
        "wrong_subject",
        "reader_inference",
        "unknown_field",
        "nan",
    ],
)
def test_measured_oracle_refuses_concrete_unknown_or_substituted_claims(  # noqa: PLR0912 - one finite independent negative-control table
    oracle: ModuleType, mutation: str
) -> None:
    value = capture(oracle)
    enlarged = value["measurements"][-2]
    if mutation == "route_glyph_missing":
        value["routes"][7]["glyph"]["rect"][2] = 0
    elif mutation == "route_backing_changed":
        value["routes"][3]["backing"]["dpi"] = 192
    elif mutation == "same_bounds":
        enlarged["anchors"] = copy.deepcopy(value["measurements"][0]["anchors"])
    elif mutation == "only_one_anchor_scales":
        enlarged["anchors"][1] = copy.deepcopy(value["measurements"][0]["anchors"][1])
    elif mutation == "width_only":
        for anchor in enlarged["anchors"]:
            anchor["rect"][3] = 20
    elif mutation == "at_175_percent":
        for anchor in enlarged["anchors"]:
            anchor["rect"][2:] = [90 * 1.75, 20 * 1.75]
    elif mutation == "wrong_reset":
        value["measurements"][-1]["anchors"] = copy.deepcopy(enlarged["anchors"])
    elif mutation == "changed_dpi":
        enlarged["backing"]["dpi"] = 192
    elif mutation == "changed_frame":
        enlarged["frame"][2] += 1
    elif mutation == "changed_process":
        enlarged["app_pid"] += 1
    elif mutation == "wrapped":
        enlarged["anchors"][0]["single_line"] = False
    elif mutation == "hidden":
        enlarged["anchors"][0]["showing"] = False
    elif mutation == "clipped":
        enlarged["anchors"][0]["rect"][0] = 1100
    elif mutation == "missing_increment":
        value["measurements"].pop(2)
    elif mutation == "duplicated_route":
        value["routes"][3] = copy.deepcopy(value["routes"][2])
    elif mutation == "missing_route":
        value["routes"].pop()
    elif mutation == "wrong_heading":
        value["routes"][3]["heading"] = "Documents"
    elif mutation == "no_keyboard_focus":
        value["routes"][0]["heading_focused"] = False
    elif mutation == "duplicate_nav":
        value["routes"][0]["navigation_unique"] = False
    elif mutation == "wrong_subject":
        value["subject_sha256"] = "d" * 64
    elif mutation == "reader_inference":
        value["reader_output"] = "NARRATOR_PASSED_FROM_UIA_TREE"
    elif mutation == "unknown_field":
        value["native_zoom_percentage"] = 200
    else:
        enlarged["anchors"][0]["rect"][2] = float("nan")
    with pytest.raises(ValueError, match=MUTATION_REASONS[mutation]):
        oracle.validate_capture(value, "a" * 64, "WINDOWS_UIA")


def test_rounding_tolerance_is_predeclared_and_rejects_beyond_boundary(
    oracle: ModuleType,
) -> None:
    value = capture(oracle)
    for anchor in value["measurements"][-2]["anchors"]:
        anchor["rect"][2] += 8.9  # 5% of180 is9: fixed threshold, no observed tuning.
        anchor["rect"][3] += 1.9  # 5% of40 is2.
    oracle.validate_capture(value, "a" * 64, "WINDOWS_UIA")
    value["measurements"][-2]["anchors"][0]["rect"][3] += 0.2
    with pytest.raises(ValueError, match="near two"):
        oracle.validate_capture(value, "a" * 64, "WINDOWS_UIA")


@pytest.mark.parametrize(
    ("field", "value"), [("scale", 2), ("transform", 1), ("width", 1280)]
)
def test_mutter_state_and_qmp_dimensions_are_not_inferred(
    oracle: ModuleType, field: str, value: int
) -> None:
    document = capture(oracle, "GNOME_ATSPI")
    for measurement in document["measurements"]:
        measurement["backing"][field] = value
    for row in document["routes"]:
        row["backing"][field] = value
    with pytest.raises(ValueError, match=r"scale-one|QMP"):
        oracle.validate_capture(document, "a" * 64, "GNOME_ATSPI")


def mutter_reply() -> list[Any]:
    spec = ("Virtual-1", "QEMU", "Standard", "owned-fixture")
    mode = ("1120x760", 1120, 760, 60.0, 1.0, [1.0, 2.0], {"is-current": True})
    return [
        7,
        [(spec, [mode], {})],
        [(0, 0, 1.0, 0, True, [spec], {})],
        {"layout-mode": 1},
    ]


def test_mutter_current_mode_is_bound_to_exact_single_logical_monitor(
    oracle: ModuleType,
) -> None:
    result = oracle.mutter_backing(mutter_reply())
    assert result == capture(oracle, "GNOME_ATSPI")["measurements"][0]["backing"]


@pytest.mark.parametrize(
    "mutation",
    [
        "extra_physical",
        "extra_logical",
        "mirrored",
        "not_primary",
        "offset",
        "scale",
        "transform",
        "no_current",
        "two_current",
        "unknown_layout",
        "bool_scale",
        "bool_transform",
    ],
)
def test_mutter_ambiguous_or_changed_display_contract_refuses(
    oracle: ModuleType, mutation: str
) -> None:
    reply = mutter_reply()
    if mutation == "extra_physical":
        reply[1].append(copy.deepcopy(reply[1][0]))
    elif mutation == "extra_logical":
        reply[2].append(copy.deepcopy(reply[2][0]))
    elif mutation == "mirrored":
        reply[2][0][5].append(reply[1][0][0])
    elif mutation == "no_current":
        reply[1][0][1][0][6]["is-current"] = False
    elif mutation == "two_current":
        reply[1][0][1].append(copy.deepcopy(reply[1][0][1][0]))
    elif mutation == "unknown_layout":
        reply[3].pop("layout-mode")
    else:
        logical = list(reply[2][0])
        index, value = {
            "not_primary": (4, False),
            "offset": (0, 1),
            "scale": (2, 2.0),
            "transform": (3, 1),
            "bool_scale": (2, True),
            "bool_transform": (3, False),
        }[mutation]
        logical[index] = value
        reply[2][0] = tuple(logical)
    with pytest.raises(ValueError, match=r"actual|Exact|current|scale-one"):
        oracle.mutter_backing(reply)


def synthetic_image_files(root: Path, document: dict[str, Any]) -> None:
    # Header-only PNG fixtures validate byte/dimension joins, not real pixels.
    image = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        + (1120).to_bytes(4, "big")
        + (760).to_bytes(4, "big")
        + b"\0" * 12
    )
    pin = hashlib.sha256(image).hexdigest()
    for row in document["routes"]:
        path = root / ("shell-" + row["scale"] + "-" + row["route"] + ".png")
        path.write_bytes(image)
        row["image_sha256"] = pin
    (root / "shell-reset.png").write_bytes(image)
    document["reset_image"] = pin


def test_image_bytes_and_dimensions_are_joined_separately_from_scale(
    oracle: ModuleType, tmp_path: Path
) -> None:
    document = capture(oracle)
    synthetic_image_files(tmp_path, document)
    oracle.verify_capture_images(tmp_path, document)


@pytest.mark.parametrize(
    "mutation", ["body", "dimension", "directory", "unsafe_route", "header"]
)
def test_image_substitution_or_unsafe_name_refuses(
    oracle: ModuleType, tmp_path: Path, mutation: str
) -> None:
    document = capture(oracle)
    synthetic_image_files(tmp_path, document)
    path = tmp_path / "shell-baseline-home.png"
    if mutation == "body":
        path.write_bytes(path.read_bytes() + b"changed")
    elif mutation == "directory":
        path.unlink()
        path.mkdir()
    elif mutation == "unsafe_route":
        document["routes"][0]["route"] = "../../outside"
    else:
        image = bytearray(path.read_bytes())
        if mutation == "dimension":
            image[16:20] = (1280).to_bytes(4, "big")
        else:
            image[0] ^= 1
        path.write_bytes(image)
        document["routes"][0]["image_sha256"] = hashlib.sha256(image).hexdigest()
    with pytest.raises(ValueError, match=r"image|PNG|unique native route"):
        oracle.verify_capture_images(tmp_path, document)
