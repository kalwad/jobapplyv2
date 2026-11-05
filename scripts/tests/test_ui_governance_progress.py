"""Stage-aware UI governance uses real repository evidence, never invented approval."""

from __future__ import annotations

import hashlib
import shutil
import struct
import zlib
from pathlib import Path

import pytest
import validate_status
from conftest import REPO_ROOT, write_status

FAMILIARITY = "docs/UI_FAMILIARITY.md"
BASELINE = "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md"
OBSERVATION = "docs/ui/reference-observation.md"
CAPTURE = "docs/evidence/desktop/capture.png"


def set_cell(repo: Path, relative: str, surface: str, index: int, value: str) -> None:
    path = repo / relative
    lines = path.read_text(encoding="utf-8").splitlines()
    for number, line in enumerate(lines):
        if line.startswith(f"| `{surface}` |"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            cells[index] = value
            lines[number] = "| " + " | ".join(cells) + " |"
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return
    raise AssertionError(f"missing surface: {surface}")


@pytest.fixture
def governance_repo(tmp_path: Path) -> Path:
    for relative in (
        FAMILIARITY,
        BASELINE,
        "docs/ui/ANTI_BLOAT_CHECKLIST.md",
        "docs/EXPERIMENTAL_AI_PROVIDERS.md",
    ):
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPO_ROOT / relative, destination)
    # Every test begins at the exact migration scaffold, even after root progresses.
    for surface in validate_status.UI_SURFACE_IDS:
        for index, value in (
            (3, "`NOT_YET_APPLICABLE`"),
            (4, "—"),
            (5, "—"),
            (6, "—"),
            (7, "`NOT_APPROVED`"),
        ):
            set_cell(tmp_path, FAMILIARITY, surface, index, value)
        for index in range(2, 12):
            value = (
                "`NOT_YET_APPLICABLE`"
                if index == 2
                else "`NOT_APPROVED`"
                if index == 10
                else "—"
            )
            set_cell(tmp_path, BASELINE, surface, index, value)
    return tmp_path


def errors(repo: Path, state: str = "NOT_STARTED") -> list[str]:
    spec = validate_status.parse_spec(REPO_ROOT / validate_status.CANONICAL_SPEC_REL)
    report = validate_status.Report()
    states = dict.fromkeys(spec.package_ids(), "NOT_STARTED")
    states["M00-W11"] = "VERIFIED"
    states["M03-W01"] = state
    write_status(repo / "docs/PROJECT_STATUS.md", states)
    validate_status.check_v14_governance_memory(repo, spec, report)
    return report.errors


def observation(repo: Path, state: str = "IN_PROGRESS") -> None:
    path = repo / OBSERVATION
    path.write_text(
        "# M03-W01 public reference observation\n"
        "Observed 2026-10-18 by test observer; "
        "synthetic public provenance fixture.\n",
        encoding="utf-8",
    )
    for index, value in (
        (3, f"`{state}`"),
        (4, "Public primary help documentation"),
        (5, OBSERVATION),
        (6, "Pending actual capture/review"),
    ):
        set_cell(repo, FAMILIARITY, "DESKTOP_SHELL", index, value)


def png() -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload))
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00\xff"))
        + chunk(b"IEND", b"")
    )


def capture(repo: Path) -> None:
    path = repo / CAPTURE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png())
    values = {
        2: "`CAPTURED`",
        3: CAPTURE,
        4: "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest(),
        5: "1x1",
        6: "100%",
        7: "light",
        8: "0.1.0",
        12: "M03-W01 capture; tree " + "a" * 40 + "; synthetic fixture only",
    }
    for index, value in values.items():
        set_cell(repo, BASELINE, "DESKTOP_SHELL", index, value)


def test_ui_migration_scaffold_remains_valid(governance_repo: Path) -> None:
    assert errors(governance_repo) == []


@pytest.mark.parametrize(
    "state", ["IN_PROGRESS", "BLOCKED", "IMPLEMENTED", "VERIFIED", "ACCEPTED"]
)
def test_started_surface_can_record_unapproved_observations(
    governance_repo: Path, state: str
) -> None:
    observation(governance_repo)
    assert errors(governance_repo, state) == []


def test_evidence_ready_requires_real_comparison_record(governance_repo: Path) -> None:
    observation(governance_repo, "EVIDENCE_READY")
    assert errors(governance_repo, "IN_PROGRESS")
    set_cell(governance_repo, FAMILIARITY, "DESKTOP_SHELL", 6, OBSERVATION)
    assert errors(governance_repo, "IN_PROGRESS") == []


@pytest.mark.parametrize("state", ["NOT_STARTED", "READY"])
def test_unstarted_surface_cannot_record_observations(
    governance_repo: Path, state: str
) -> None:
    observation(governance_repo)
    assert any(
        "must remain NOT_YET_APPLICABLE" in error
        for error in errors(governance_repo, state)
    )


@pytest.mark.parametrize(
    "path",
    [
        "—",
        "docs/ui/missing.md",
        "../outside.md",
        "/outside.md",
        "https://example.invalid/evidence",
    ],
)
def test_observation_paths_are_real_local_evidence(
    governance_repo: Path, path: str
) -> None:
    observation(governance_repo)
    set_cell(governance_repo, FAMILIARITY, "DESKTOP_SHELL", 5, path)
    assert errors(governance_repo, "IN_PROGRESS")


def test_observation_symlinks_and_empty_records_are_rejected(
    governance_repo: Path,
) -> None:
    observation(governance_repo)
    path = governance_repo / OBSERVATION
    path.write_bytes(b"")
    assert errors(governance_repo, "IN_PROGRESS")
    path.unlink()
    path.symlink_to(governance_repo / "docs/EXPERIMENTAL_AI_PROVIDERS.md")
    assert errors(governance_repo, "IN_PROGRESS")


@pytest.mark.parametrize(
    ("index", "value"), [(3, "`OWNER_APPROVED`"), (3, "`MAGIC`"), (7, "`APPROVED`")]
)
def test_observation_progress_cannot_invent_approval_or_states(
    governance_repo: Path, index: int, value: str
) -> None:
    observation(governance_repo)
    set_cell(governance_repo, FAMILIARITY, "DESKTOP_SHELL", index, value)
    assert errors(governance_repo, "IN_PROGRESS")


def test_unstarted_surface_cannot_borrow_another_started_owner(
    governance_repo: Path,
) -> None:
    observation(governance_repo)
    set_cell(governance_repo, FAMILIARITY, "JOBS", 2, "`M03-W01`")
    assert any(
        "invalid owners" in error for error in errors(governance_repo, "IN_PROGRESS")
    )


def test_started_capture_is_not_baseline_approval(governance_repo: Path) -> None:
    capture(governance_repo)
    assert errors(governance_repo, "IN_PROGRESS") == []


@pytest.mark.parametrize("state", ["NOT_STARTED", "READY"])
def test_unstarted_capture_remains_prohibited(
    governance_repo: Path, state: str
) -> None:
    capture(governance_repo)
    assert any(
        "must remain NOT_YET_APPLICABLE" in error
        for error in errors(governance_repo, state)
    )


@pytest.mark.parametrize(
    "mutation", ["missing", "stale-hash", "fake-png", "dimensions"]
)
def test_capture_requires_actual_png_and_matching_metadata(
    governance_repo: Path, mutation: str
) -> None:
    capture(governance_repo)
    path = governance_repo / CAPTURE
    if mutation == "missing":
        path.unlink()
    elif mutation == "stale-hash":
        path.write_bytes(path.read_bytes() + b"changed")
    elif mutation == "fake-png":
        path.write_bytes(b"not a PNG")
        set_cell(
            governance_repo,
            BASELINE,
            "DESKTOP_SHELL",
            4,
            "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest(),
        )
    else:
        set_cell(governance_repo, BASELINE, "DESKTOP_SHELL", 5, "2x2")
    assert errors(governance_repo, "IN_PROGRESS")


@pytest.mark.parametrize(
    ("index", "value"),
    [
        (5, "—"),
        (6, "—"),
        (7, "—"),
        (8, "—"),
        (9, "2026-10-18"),
        (10, "`APPROVED`"),
        (11, "owner-approved exception"),
        (12, "capture complete"),
    ],
)
def test_capture_cannot_omit_params_or_invent_decision(
    governance_repo: Path, index: int, value: str
) -> None:
    capture(governance_repo)
    set_cell(governance_repo, BASELINE, "DESKTOP_SHELL", index, value)
    assert errors(governance_repo, "IN_PROGRESS")


def test_captured_state_cannot_claim_approved(governance_repo: Path) -> None:
    capture(governance_repo)
    set_cell(governance_repo, BASELINE, "DESKTOP_SHELL", 2, "`APPROVED`")
    assert errors(governance_repo, "IN_PROGRESS")


def test_incomplete_migration_cannot_enable_started_surface(
    governance_repo: Path,
) -> None:
    observation(governance_repo)
    spec = validate_status.parse_spec(REPO_ROOT / validate_status.CANONICAL_SPEC_REL)
    states = dict.fromkeys(spec.package_ids(), "NOT_STARTED")
    states.update({"M00-W11": "IN_PROGRESS", "M03-W01": "IN_PROGRESS"})
    write_status(governance_repo / "docs/PROJECT_STATUS.md", states)
    report = validate_status.Report()
    validate_status.check_v14_governance_memory(governance_repo, spec, report)
    assert any("must remain NOT_YET_APPLICABLE" in error for error in report.errors)
