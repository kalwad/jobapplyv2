"""Black-box tests for the v1.2-aware scripts/validate_status.py (M00-W05).

The validator is exercised exactly as production runs it (a subprocess with
``--repo``), against full temporary copies of the repository's project-memory
files. Positive cases prove the migrated repository passes; negative cases
prove every §12/§13.8-mandated rejection: invalid gate states, missing
Workday packages/requirements, stale v1.0 inventory, a second
canonical-looking specification, a missing Workday gate report, dropped
preserved revisions, gate-based readiness blocking for M03/M06/M21, and the
structural rules carried over from v1.0 (enums, single IN_PROGRESS,
dependencies, completeness).
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import pytest
from conftest import REPO_ROOT

VALIDATOR = REPO_ROOT / "scripts" / "validate_status.py"
GATES = (
    "AUTOFILL_FEASIBILITY",
    "RESUME_PAGEFIT_FEASIBILITY",
    "WORKDAY_GUIDED_PRE_SUBMIT",
)
FAKE_TREE = "tree " + "0" * 40


def run_validator(repo: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), "--repo", str(repo)],
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )


@pytest.fixture
def repo_copy(tmp_path: Path) -> Path:
    """Full temporary copy of the project-memory surface of the real repo."""
    repo = tmp_path / "repo"
    repo.mkdir()
    shutil.copy2(REPO_ROOT / "CLAUDE.md", repo / "CLAUDE.md")
    shutil.copytree(REPO_ROOT / "docs", repo / "docs")
    return repo


def status_path(repo: Path) -> Path:
    return repo / "docs" / "PROJECT_STATUS.md"


def edit(path: Path, old: str, new: str, *, count: int = 0) -> None:
    text = path.read_text(encoding="utf-8")
    assert old in text, f"fixture edit target not found in {path.name}: {old!r}"
    path.write_text(text.replace(old, new, count or -1), encoding="utf-8")


def set_pkg_state(repo: Path, pid: str, state: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^(\| `{pid}` \| )[A-Z_]+( \|)", flags=re.MULTILINE)
    assert pattern.search(text), f"no work-package row for {pid}"
    path.write_text(pattern.sub(rf"\g<1>{state}\g<2>", text), encoding="utf-8")


def set_ms_state(repo: Path, mid: str, state: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^(\| {mid} \| )[A-Z_]+( \|)", flags=re.MULTILINE)
    assert pattern.search(text), f"no milestone row for {mid}"
    path.write_text(pattern.sub(rf"\g<1>{state}\g<2>", text), encoding="utf-8")


def set_current_package(repo: Path, value: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^Current work package: .*$", flags=re.MULTILINE)
    assert pattern.search(text)
    path.write_text(
        pattern.sub(f"Current work package: {value}", text, count=1),
        encoding="utf-8",
    )


def set_next_ready(repo: Path, value: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^- ID: .*$", flags=re.MULTILINE)
    assert pattern.search(text)
    path.write_text(pattern.sub(f"- ID: {value}", text, count=1), encoding="utf-8")


def pkg_rows(repo: Path) -> list[str]:
    ids: list[str] = []
    for line in status_path(repo).read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\| `(M\d{2}-W\d{2})` \|", line)
        if match:
            ids.append(match.group(1))
    return ids


def promote(repo: Path, pid: str) -> None:
    """Mark a package ACCEPTED with a synthetic revision and evidence entry."""
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^\| `{pid}` \|[^\n]*$", flags=re.MULTILINE)
    assert pattern.search(text), f"no work-package row for {pid}"
    row = (
        f"| `{pid}` | ACCEPTED | {FAKE_TREE} | "
        f"docs/TEST_EVIDENCE.md § {pid} | promoted fixture |"
    )
    path.write_text(pattern.sub(row, text, count=1), encoding="utf-8")
    evidence = repo / "docs" / "TEST_EVIDENCE.md"
    with evidence.open("a", encoding="utf-8") as handle:
        handle.write(f"\n### {pid} — promoted fixture (synthetic)\n")


def promote_milestones(repo: Path, mids: list[str]) -> None:
    for pid in pkg_rows(repo):
        if pid[:3] in mids:
            promote(repo, pid)
    for mid in mids:
        set_ms_state(repo, mid, "ACCEPTED")


def set_status_gate_row(
    repo: Path, gate: str, state: str, *, filled: bool = False
) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^\| {gate} \|[^\n]*$", flags=re.MULTILINE)
    assert pattern.search(text), f"no critical-gates row for {gate}"
    if filled:
        row = (
            f"| {gate} | {state} | {FAKE_TREE} | sha256:{'0' * 12} | "
            f"clean-session fixture reviewer | docs/gates/{gate}_GATE.md |"
        )
    else:
        row = f"| {gate} | {state} | — | — | — | docs/gates/{gate}_GATE.md |"
    path.write_text(pattern.sub(row, text, count=1), encoding="utf-8")


def set_ledger_gate_state(repo: Path, gate: str, state: str) -> None:
    path = repo / "docs" / "CRITICAL_GATES.md"
    text = path.read_text(encoding="utf-8")
    sections = text.split("\n## ")
    for index, section in enumerate(sections):
        if section.startswith(gate):
            sections[index] = re.sub(
                r"^- State: [A-Z_]+$",
                f"- State: {state}",
                section,
                count=1,
                flags=re.MULTILINE,
            )
            break
    else:
        pytest.fail(f"no CRITICAL_GATES.md section for {gate}")
    path.write_text("\n## ".join(sections), encoding="utf-8")


def pass_gate(repo: Path, gate: str) -> None:
    """Flip a gate to PASS coherently across status, ledger, and report."""
    set_status_gate_row(repo, gate, "PASS", filled=True)
    set_ledger_gate_state(repo, gate, "PASS")
    report = repo / "docs" / "gates" / f"{gate}_GATE.md"
    with report.open("a", encoding="utf-8") as handle:
        handle.write(
            "\nOwner decision: PASS (synthetic fixture)\n"
            "Holdout result: valid (synthetic fixture)\n"
        )


# ---------------------------------------------------------------- positive


def test_migrated_repository_passes() -> None:
    result = run_validator(REPO_ROOT)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout


def test_gate_pass_unblocks_m03(repo_copy: Path) -> None:
    promote_milestones(repo_copy, ["M00", "M01", "M02"])
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M03", "READY")
    set_pkg_state(repo_copy, "M03-W01", "READY")
    set_next_ready(repo_copy, "`M03-W01`")
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


# ------------------------------------------------- structural rejections


def test_invalid_package_state_rejected(repo_copy: Path) -> None:
    edit(status_path(repo_copy), "| `M03-W02` | NOT_STARTED |", "| `M03-W02` | DONE |")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M03-W02" in result.stdout


def test_skipped_dependency_rejected(repo_copy: Path) -> None:
    # The canonical post-M00 baseline legitimately has M01-W01 READY. Revoke
    # the final M00 package and milestone acceptance to reconstruct the
    # forbidden skipped-dependency transition explicitly.
    set_pkg_state(repo_copy, "M00-W07", "NOT_STARTED")
    set_ms_state(repo_copy, "M00", "IN_PROGRESS")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "dependency milestone M00 has unfinished packages" in result.stdout


def test_m01_w01_requires_m00_milestone_acceptance_not_only_done_packages(
    repo_copy: Path,
) -> None:
    promote_milestones(repo_copy, ["M00"])
    set_ms_state(repo_copy, "M00", "VERIFIED")
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M01", "READY")
    set_pkg_state(repo_copy, "M01-W01", "READY")
    set_next_ready(repo_copy, "`M01-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "milestone M00 is 'VERIFIED' (ACCEPTED required)" in result.stdout


def test_m01_w01_becomes_ready_after_valid_m00_acceptance(repo_copy: Path) -> None:
    promote_milestones(repo_copy, ["M00"])
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M01", "READY")
    set_pkg_state(repo_copy, "M01-W01", "READY")
    set_next_ready(repo_copy, "`M01-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


def test_no_other_m01_package_becomes_prematurely_ready(repo_copy: Path) -> None:
    promote_milestones(repo_copy, ["M00"])
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M01", "READY")
    set_pkg_state(repo_copy, "M01-W01", "READY")
    set_pkg_state(repo_copy, "M01-W02", "READY")
    set_next_ready(repo_copy, "`M01-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "earlier package M01-W01 is 'READY'" in result.stdout


def test_two_in_progress_rejected(repo_copy: Path) -> None:
    set_pkg_state(repo_copy, "M01-W01", "IN_PROGRESS")
    set_pkg_state(repo_copy, "M01-W02", "IN_PROGRESS")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "more than one work package IN_PROGRESS" in result.stdout


def test_missing_package_row_rejected(repo_copy: Path) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^\| `M38-W07` \|[^\n]*\n", flags=re.MULTILINE)
    assert pattern.search(text)
    path.write_text(pattern.sub("", text, count=1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M38-W07" in result.stdout


def test_stale_v1_inventory_missing_workday_packages_rejected(
    repo_copy: Path,
) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^\| `M(?:19|20)-W\d{2}` \|[^\n]*\n", flags=re.MULTILINE)
    stripped, removed = pattern.subn("", text)
    assert removed == 22, f"expected 22 Workday rows, found {removed}"
    path.write_text(stripped, encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M19-W01" in result.stdout


# ------------------------------------------------------ spec-side checks


def test_missing_workday_requirement_rejected(repo_copy: Path) -> None:
    spec = repo_copy / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"
    text = spec.read_text(encoding="utf-8")
    pattern = re.compile(r"^- `REQ-WD-023`[^\n]*\n", flags=re.MULTILINE)
    assert pattern.search(text)
    spec.write_text(pattern.sub("", text, count=1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "expected 135" in result.stdout


def test_missing_milestone_section_rejected(repo_copy: Path) -> None:
    spec = repo_copy / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"
    text = spec.read_text(encoding="utf-8")
    marker = "## M38 —"
    assert marker in text
    spec.write_text(text.split(marker)[0], encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "expected 39" in result.stdout


def test_second_canonical_spec_rejected(repo_copy: Path) -> None:
    canonical = repo_copy / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"
    shutil.copy2(
        canonical,
        repo_copy / "docs" / "MASTER_IMPLEMENTATION_SPEC.v1.2.proposed.md",
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "MASTER_IMPLEMENTATION_SPEC.v1.2.proposed.md" in result.stdout


def test_renamed_canonical_lookalike_rejected(repo_copy: Path) -> None:
    lookalike = repo_copy / "docs" / "ARCHIVED_NOTES.md"
    lookalike.write_text(
        "# Old copy\n\n**Specification ID:** JAPP-MASTER-001\n",
        encoding="utf-8",
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "ARCHIVED_NOTES.md" in result.stdout


# ------------------------------------------------------------ gate checks


def test_invalid_gate_state_rejected(repo_copy: Path) -> None:
    set_status_gate_row(repo_copy, "AUTOFILL_FEASIBILITY", "GREEN")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "invalid gate state" in result.stdout


def test_missing_workday_gate_row_rejected(repo_copy: Path) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"^\| WORKDAY_GUIDED_PRE_SUBMIT \|[^\n]*\n", flags=re.MULTILINE
    )
    assert pattern.search(text)
    path.write_text(pattern.sub("", text, count=1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "WORKDAY_GUIDED_PRE_SUBMIT" in result.stdout


def test_missing_workday_gate_report_rejected(repo_copy: Path) -> None:
    (repo_copy / "docs" / "gates" / "WORKDAY_GUIDED_PRE_SUBMIT_GATE.md").unlink()
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "WORKDAY_GUIDED_PRE_SUBMIT_GATE.md" in result.stdout


def test_missing_critical_gates_ledger_rejected(repo_copy: Path) -> None:
    (repo_copy / "docs" / "CRITICAL_GATES.md").unlink()
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "CRITICAL_GATES.md" in result.stdout


def test_gate_pass_without_evidence_fields_rejected(repo_copy: Path) -> None:
    set_status_gate_row(repo_copy, "AUTOFILL_FEASIBILITY", "PASS", filled=False)
    set_ledger_gate_state(repo_copy, "AUTOFILL_FEASIBILITY", "PASS")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "AUTOFILL_FEASIBILITY is PASS but" in result.stdout


def test_gate_state_mismatch_between_files_rejected(repo_copy: Path) -> None:
    set_status_gate_row(repo_copy, "RESUME_PAGEFIT_FEASIBILITY", "IN_PROGRESS")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "mismatch" in result.stdout


def _edit_ledger_section(repo: Path, gate: str, edit_fn: Callable[[str], str]) -> None:
    path = repo / "docs" / "CRITICAL_GATES.md"
    sections = path.read_text(encoding="utf-8").split("\n## ")
    for index, section in enumerate(sections):
        if section.startswith(gate):
            sections[index] = edit_fn(section)
            break
    else:
        pytest.fail(f"no CRITICAL_GATES.md section for {gate}")
    path.write_text("\n## ".join(sections), encoding="utf-8")


def test_ledger_missing_state_line_rejected(repo_copy: Path) -> None:
    """M00-W05 audit finding: a gate section without its '- State:' line must fail."""
    _edit_ledger_section(
        repo_copy,
        "AUTOFILL_FEASIBILITY",
        lambda s: re.sub(r"^- State: [A-Z_]+\n", "", s, count=1, flags=re.MULTILINE),
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "no '- State:' line" in result.stdout
    assert "AUTOFILL_FEASIBILITY" in result.stdout


def test_ledger_duplicate_state_line_rejected(repo_copy: Path) -> None:
    _edit_ledger_section(
        repo_copy,
        "RESUME_PAGEFIT_FEASIBILITY",
        lambda s: re.sub(
            r"^(- State: [A-Z_]+\n)",
            r"\g<1>\g<1>",
            s,
            count=1,
            flags=re.MULTILINE,
        ),
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "exactly one required" in result.stdout
    assert "RESUME_PAGEFIT_FEASIBILITY" in result.stdout


def test_ledger_missing_gate_section_rejected(repo_copy: Path) -> None:
    """Removing a gate's whole ledger section must fail even though the gate
    name still appears in the summary table (name needles alone are not
    sufficient)."""
    path = repo_copy / "docs" / "CRITICAL_GATES.md"
    sections = path.read_text(encoding="utf-8").split("\n## ")
    kept = [s for s in sections if not s.startswith("WORKDAY_GUIDED_PRE_SUBMIT")]
    assert len(kept) == len(sections) - 1
    path.write_text("\n## ".join(kept), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "missing the '## WORKDAY_GUIDED_PRE_SUBMIT' section" in result.stdout


def test_ledger_unknown_gate_section_rejected(repo_copy: Path) -> None:
    path = repo_copy / "docs" / "CRITICAL_GATES.md"
    with path.open("a", encoding="utf-8") as handle:
        handle.write("\n## TOTALLY_FAKE_GATE\n\n- State: PASS\n")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "TOTALLY_FAKE_GATE" in result.stdout
    assert "unknown gate-like section" in result.stdout


def test_ledger_invalid_state_value_rejected(repo_copy: Path) -> None:
    _edit_ledger_section(
        repo_copy,
        "WORKDAY_GUIDED_PRE_SUBMIT",
        lambda s: s.replace("- State: NOT_EVALUATED", "- State: GREENISH", 1),
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "GREENISH" in result.stdout


# -------------------------------------------- gate-based readiness blocking


def test_m03_blocked_without_autofill_gate(repo_copy: Path) -> None:
    promote_milestones(repo_copy, ["M00", "M01", "M02"])
    set_ms_state(repo_copy, "M03", "READY")
    set_pkg_state(repo_copy, "M03-W01", "READY")
    set_next_ready(repo_copy, "`M03-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "AUTOFILL_FEASIBILITY" in result.stdout
    assert "PASS required" in result.stdout
    assert "dependency milestone" not in result.stdout


def test_m06_blocked_without_resume_pagefit_gate(repo_copy: Path) -> None:
    promote_milestones(repo_copy, ["M00", "M01", "M02", "M03", "M04", "M05"])
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    set_ms_state(repo_copy, "M06", "READY")
    set_pkg_state(repo_copy, "M06-W01", "READY")
    set_next_ready(repo_copy, "`M06-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "RESUME_PAGEFIT_FEASIBILITY" in result.stdout
    assert "PASS required" in result.stdout


def test_m21_blocked_without_workday_gate_and_accepted_m19_m20(
    repo_copy: Path,
) -> None:
    mids = [f"M{n:02d}" for n in range(21)]
    promote_milestones(repo_copy, mids)
    set_ms_state(repo_copy, "M19", "VERIFIED")
    set_ms_state(repo_copy, "M20", "VERIFIED")
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    pass_gate(repo_copy, "RESUME_PAGEFIT_FEASIBILITY")
    set_ms_state(repo_copy, "M21", "READY")
    set_pkg_state(repo_copy, "M21-W01", "READY")
    set_next_ready(repo_copy, "`M21-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "WORKDAY_GUIDED_PRE_SUBMIT" in result.stdout
    assert "PASS required" in result.stdout
    assert "ACCEPTED required" in result.stdout


# ------------------------------------------------- evidence preservation


def test_dropped_preserved_revision_rejected(repo_copy: Path) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    match = re.search(
        r"^\| `M00-W03` \| VERIFIED \| (tree [0-9a-f]{40})",
        text,
        flags=re.MULTILINE,
    )
    assert match, "M00-W03 row must carry its verified tree revision"
    path.write_text(text.replace(match.group(1), "—", 1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M00-W03" in result.stdout


def test_missing_evidence_heading_rejected(repo_copy: Path) -> None:
    evidence = repo_copy / "docs" / "TEST_EVIDENCE.md"
    text = evidence.read_text(encoding="utf-8")
    heading = "### M00-W02"
    assert heading in text
    evidence.write_text(text.replace(heading, "### removed"), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M00-W02" in result.stdout


def test_milestone_acceptance_allows_verified_package_rows(repo_copy: Path) -> None:
    set_pkg_state(repo_copy, "M00-W07", "VERIFIED")
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^\| `M00-W07` \|[^\n]*$", flags=re.MULTILINE)
    row = (
        f"| `M00-W07` | VERIFIED | {FAKE_TREE} | "
        "docs/TEST_EVIDENCE.md § M00-W07 | fixture |"
    )
    path.write_text(pattern.sub(row, text, count=1), encoding="utf-8")
    evidence = repo_copy / "docs" / "TEST_EVIDENCE.md"
    with evidence.open("a", encoding="utf-8") as handle:
        handle.write("\n### M00-W07 — verified fixture\n")
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M00", "ACCEPTED")
    set_next_ready(repo_copy, "NONE")
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr
