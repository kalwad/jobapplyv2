"""Black-box tests for the v1.3-aware scripts/validate_status.py (M00-W10).

The validator is exercised exactly as production runs it (a subprocess with
``--repo``), against full temporary copies of the repository's project-memory
files. Positive cases prove the migrated repository passes; negative cases
prove every §12/§13.8-mandated rejection: invalid gate states, missing
platform packages/requirements, stale inventory, a second
canonical-looking specification, a missing Workday gate report, dropped
preserved revisions, gate-based readiness blocking for M03/M06/M21, and the
structural rules carried over from v1.2 (enums, single IN_PROGRESS,
dependencies, completeness). M00-W10 adds exact closeout/readiness checks and
fail-closed Gate D repository-evidence resolution.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import pytest
import validate_status
from conftest import REPO_ROOT

VALIDATOR = REPO_ROOT / "scripts" / "validate_status.py"
GATES = (
    "AUTOFILL_FEASIBILITY",
    "RESUME_PAGEFIT_FEASIBILITY",
    "WORKDAY_GUIDED_PRE_SUBMIT",
    "CROSS_PLATFORM_CORE",
)
FAKE_TREE = "tree " + "0" * 40
GATE_D_EVIDENCE_REL = "docs/gates/evidence/SYNTHETIC_GATE_D_EVIDENCE.md"
FAKE_EVIDENCE_HASH = "sha256:" + "0" * 64
FAKE_REVIEWER = "clean-session fixture reviewer"


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
    match = re.fullmatch(r"M\d{2}-W\d{2}", value)
    if match:
        set_current_milestone(repo, value[:3])


def set_current_milestone(repo: Path, value: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^Current milestone: .*$", flags=re.MULTILINE)
    assert pattern.search(text)
    path.write_text(
        pattern.sub(f"Current milestone: {value}", text, count=1),
        encoding="utf-8",
    )


def set_next_ready(repo: Path, value: str) -> None:
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^- ID: .*$", flags=re.MULTILINE)
    assert pattern.search(text)
    path.write_text(pattern.sub(f"- ID: {value}", text, count=1), encoding="utf-8")
    match = re.fullmatch(r"`?(M\d{2}-W\d{2})`?", value)
    if match:
        set_current_milestone(repo, match.group(1)[:3])


def pkg_rows(repo: Path) -> list[str]:
    ids: list[str] = []
    for line in status_path(repo).read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\| `(M\d{2}-W\d{2})` \|", line)
        if match:
            ids.append(match.group(1))
    return ids


def promote(repo: Path, pid: str) -> None:
    """Mark a package done with a synthetic revision and evidence entry.

    M00's acceptance contract is intentionally stricter than later
    milestones: all ten direct packages must remain exactly VERIFIED.
    """
    if pid in validate_status.PRESERVED_M00_REVISIONS:
        return
    path = status_path(repo)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^\| `{pid}` \|[^\n]*$", flags=re.MULTILINE)
    assert pattern.search(text), f"no work-package row for {pid}"
    state = "VERIFIED" if pid.startswith("M00-") else "ACCEPTED"
    row = (
        f"| `{pid}` | {state} | {FAKE_TREE} | "
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
            f"| {gate} | {state} | {FAKE_TREE} | {FAKE_EVIDENCE_HASH} | "
            f"{FAKE_REVIEWER} | docs/gates/{gate}_GATE.md |"
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


def set_ledger_gate_pass_evidence(repo: Path, gate: str) -> None:
    path = repo / "docs" / "CRITICAL_GATES.md"
    text = path.read_text(encoding="utf-8")
    sections = text.split("\n## ")
    replacements = {
        "State": "PASS",
        "Evaluated revision": FAKE_TREE,
        "Corpus/holdout hash": FAKE_EVIDENCE_HASH,
        "Independent reviewer": FAKE_REVIEWER,
        "Owner decision": "PASS",
        "Holdout result": "PASS",
    }
    for index, section_text in enumerate(sections):
        if not section_text.startswith(gate):
            continue
        updated_section = section_text
        for label, value in replacements.items():
            updated_section, count = re.subn(
                rf"^- {re.escape(label)}:.*$",
                f"- {label}: {value}",
                updated_section,
                count=1,
                flags=re.MULTILINE,
            )
            assert count == 1, f"{gate} ledger has no {label} field"
        lines = updated_section.splitlines()
        in_metric_table = False
        for line_index, line in enumerate(lines):
            if line == "### Metric table" or line.startswith("### Metric table "):
                in_metric_table = True
                continue
            if line.startswith("- Zero-tolerance failures observed:"):
                in_metric_table = False
                lines[line_index] = "- Zero-tolerance failures observed: 0"
                continue
            if not in_metric_table or not line.startswith("|"):
                continue
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if (
                len(cells) >= 3
                and cells[0] != "Dimension"
                and not set(cells[0]) <= {"-", ":"}
            ):
                cells[-1] = "PASS"
                lines[line_index] = "| " + " | ".join(cells) + " |"
        sections[index] = "\n".join(lines)
        break
    else:
        pytest.fail(f"no CRITICAL_GATES.md section for {gate}")
    path.write_text("\n## ".join(sections), encoding="utf-8")


def _write_gate_d_evidence(repo: Path) -> None:
    path = repo / GATE_D_EVIDENCE_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        """# Synthetic Gate D evidence

## Gate D evidence bundle

Fixture-only bundle.

## macos-arm64 full-AI profile

Fixture-only profile evidence.

## windows-x64 full-AI profile

Fixture-only profile evidence.

## ubuntu-x64 full-AI profile

Fixture-only profile evidence.

## macos-arm64 native platform evidence

Fixture-only native evidence.

## windows-x64 native platform evidence

Fixture-only native evidence.

## ubuntu-x64 native platform evidence

Fixture-only native evidence.

## macos-arm64 native-messaging evidence

Fixture-only native-messaging evidence.

## windows-x64 native-messaging evidence

Fixture-only native-messaging evidence.

## ubuntu-x64 native-messaging evidence

Fixture-only native-messaging evidence.

## macos-arm64 packaging/update evidence

Fixture-only packaging/update evidence.

## windows-x64 packaging/update evidence

Fixture-only packaging/update evidence.

## ubuntu-x64 packaging/update evidence

Fixture-only packaging/update evidence.
""",
        encoding="utf-8",
    )


def pass_gate(repo: Path, gate: str) -> None:
    """Flip a gate to PASS coherently across status, ledger, and report."""
    set_status_gate_row(repo, gate, "PASS", filled=True)
    set_ledger_gate_pass_evidence(repo, gate)
    report = repo / "docs" / "gates" / f"{gate}_GATE.md"
    gate_d_bundle = ""
    if gate == "CROSS_PLATFORM_CORE":
        _write_gate_d_evidence(repo)
        gate_d_bundle = (
            f"Evidence bundle: {GATE_D_EVIDENCE_REL} § Gate D evidence bundle\n"
        )
    with report.open("a", encoding="utf-8") as handle:
        handle.write(
            "\n- State: PASS\n"
            f"- Evaluated revision: {FAKE_TREE}\n"
            f"- Corpus/holdout hash: {FAKE_EVIDENCE_HASH}\n"
            f"- Independent reviewer: {FAKE_REVIEWER}\n"
            "- Owner decision: PASS (synthetic fixture)\n"
            "- Holdout result: PASS (synthetic fixture)\n"
            f"{gate_d_bundle}"
        )


def _set_markdown_table_cell(
    path: Path, row_key: str, cell_index: int, value: str
) -> None:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^\| `{re.escape(row_key)}` \|[^\n]*$", re.MULTILINE)
    match = pattern.search(text)
    assert match, f"no Markdown table row for {row_key}"
    cells = [cell.strip() for cell in match.group(0).strip("|").split("|")]
    assert len(cells) > cell_index
    cells[cell_index] = value
    replacement = "| " + " | ".join(cells) + " |"
    path.write_text(
        text[: match.start()] + replacement + text[match.end() :],
        encoding="utf-8",
    )


def accept_full_ai_profiles(repo: Path) -> None:
    _write_gate_d_evidence(repo)
    path = repo / "docs" / "platform" / "MODEL_RUNTIME_PROFILES.md"
    for platform in ("macos-arm64", "windows-x64", "ubuntu-x64"):
        _set_markdown_table_cell(path, platform, 1, "`CERTIFIED_FULL`")
        _set_markdown_table_cell(path, platform, 2, "`ACCEPTED`")
        _set_markdown_table_cell(
            path,
            platform,
            3,
            (f"{GATE_D_EVIDENCE_REL} § {platform} full-AI profile"),
        )
    matrix = repo / "docs" / "platform" / "CERTIFIED_MATRIX.md"
    for platform in ("macos-arm64", "windows-x64", "ubuntu-x64"):
        _set_markdown_table_cell(matrix, platform, 4, "`CERTIFIED_FULL`")
        _set_markdown_table_cell(
            matrix,
            platform,
            5,
            (f"{GATE_D_EVIDENCE_REL} § {platform} native platform evidence"),
        )
    support = repo / "docs" / "PLATFORM_SUPPORT.md"
    for platform in ("macos-arm64", "windows-x64", "ubuntu-x64"):
        _set_markdown_table_cell(support, platform, 5, "`CERTIFIED_FULL`")
        _set_markdown_table_cell(
            support,
            platform,
            6,
            f"{GATE_D_EVIDENCE_REL} § {platform} native platform evidence",
        )
    native_messaging = repo / "docs" / "platform" / "NATIVE_MESSAGING_MATRIX.md"
    for platform in ("macos-arm64", "windows-x64", "ubuntu-x64"):
        _set_markdown_table_cell(native_messaging, platform, 3, "`VERIFIED`")
        _set_markdown_table_cell(
            native_messaging,
            platform,
            4,
            f"{GATE_D_EVIDENCE_REL} § {platform} native-messaging evidence",
        )
    packaging = repo / "docs" / "platform" / "PACKAGING_UPDATE_MATRIX.md"
    for platform in ("macos-arm64", "windows-x64", "ubuntu-x64"):
        _set_markdown_table_cell(packaging, platform, 4, "`VERIFIED`")
        _set_markdown_table_cell(
            packaging,
            platform,
            5,
            f"{GATE_D_EVIDENCE_REL} § {platform} packaging/update evidence",
        )


def prepare_m00_closeout(repo: Path, *, m01_ready: bool) -> None:
    """Create either the accepted-M00 boundary or its exact next-ready state.

    The fixture establishes its own complete premise instead of inheriting
    live repository state: once M01 work begins (M01-W01 VERIFIED, M01-W02
    READY, milestone M01 IN_PROGRESS), the inherited rows would otherwise
    break the boundary invariants these tests assert (KI-0014/KI-0015 class).
    """
    promote_milestones(repo, ["M00"])
    set_current_package(repo, "NONE")
    set_pkg_state(repo, "M01-W01", "READY" if m01_ready else "NOT_STARTED")
    set_pkg_state(repo, "M01-W02", "NOT_STARTED")
    set_ms_state(repo, "M01", "READY" if m01_ready else "NOT_STARTED")
    set_next_ready(repo, "`M01-W01`" if m01_ready else "NONE")


def prepare_gate_d_pass(repo: Path) -> None:
    promote_milestones(repo, [f"M{number:02d}" for number in range(27)])
    for number in range(1, 12):
        promote(repo, f"M27-W{number:02d}")
    set_ms_state(repo, "M27", "IN_PROGRESS")
    set_pkg_state(repo, "M27-W12", "IN_PROGRESS")
    set_current_package(repo, "M27-W12")
    set_next_ready(repo, "NONE")
    for gate in GATES:
        pass_gate(repo, gate)
    accept_full_ai_profiles(repo)


# ---------------------------------------------------------------- positive


def test_migrated_repository_passes() -> None:
    result = run_validator(REPO_ROOT)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout


def test_owner_approved_hash_and_exact_v13_inventory() -> None:
    spec_path = REPO_ROOT / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"
    assert hashlib.sha256(spec_path.read_bytes()).hexdigest() == (
        "fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867"
    )
    spec = validate_status.parse_spec(spec_path)
    assert list(spec.milestones) == [f"M{number:02d}" for number in range(39)]
    assert len(spec.package_ids()) == len(set(spec.package_ids())) == 286
    assert len(spec.requirement_ids) == 157
    assert [pid for pid, _ in spec.milestones["M00"].packages] == [
        f"M00-W{number:02d}" for number in range(1, 11)
    ]


def test_owner_controlled_agent_and_staged_ai_policy_are_present() -> None:
    text = (REPO_ROOT / "docs" / "MASTER_IMPLEMENTATION_SPEC.md").read_text(
        encoding="utf-8"
    )
    assert "**Implementation-agent policy:** Owner-selected per package." in text
    assert "must not automatically route work between Claude, Codex" in text
    assert "does not block the resume/PageFit feasibility architecture or `M06`" in text
    assert (
        "Final acceptance of at least one `CERTIFIED_FULL` Windows profile "
        "and one `CERTIFIED_FULL` Ubuntu profile is deferred to `M27-W10`"
    ) in text
    assert "Implementation sessions use Claude Fable 5 Max" not in (
        REPO_ROOT / "CLAUDE.md"
    ).read_text(encoding="utf-8")


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
    promote_milestones(repo_copy, ["M00"])
    set_pkg_state(repo_copy, "M00-W10", "NOT_STARTED")
    set_ms_state(repo_copy, "M00", "IN_PROGRESS")
    set_pkg_state(repo_copy, "M01-W01", "READY")
    set_current_package(repo_copy, "NONE")
    set_next_ready(repo_copy, "`M01-W01`")
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
    prepare_m00_closeout(repo_copy, m01_ready=True)
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


def test_valid_m00_closeout_makes_only_m01_w01_ready(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    parsed = validate_status.parse_status(status_path(repo_copy))
    ready = [cells[0] for cells in parsed.package_rows if cells[1] == "READY"]
    assert ready == ["M01-W01"]
    assert all(cells[1] == "NOT_EVALUATED" for cells in parsed.gate_rows)
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


def test_accepted_m00_cannot_leave_every_m01_package_not_started(
    repo_copy: Path,
) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=False)
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "accepted M00 closeout must make M01-W01" in result.stdout


def test_post_m00_closeout_keeps_every_gate_not_evaluated(
    repo_copy: Path,
) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "post-M00 closeout boundary" in result.stdout
    assert "AUTOFILL_FEASIBILITY" in result.stdout


def test_m00_acceptance_requires_every_direct_package_exactly_verified(
    repo_copy: Path,
) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=False)
    set_pkg_state(repo_copy, "M00-W09", "ACCEPTED")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M00 cannot be ACCEPTED" in result.stdout
    assert "'M00-W09': 'ACCEPTED'" in result.stdout


def test_m01_w01_rejects_accepted_instead_of_verified_m00_w10(
    repo_copy: Path,
) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    set_pkg_state(repo_copy, "M00-W10", "ACCEPTED")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "M00-W10 is exactly VERIFIED" in result.stdout


def test_next_ready_none_rejected_when_ready_row_exists(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    set_next_ready(repo_copy, "NONE")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "Next READY package is NONE but READY row(s) exist" in result.stdout


def test_named_next_ready_rejected_when_no_ready_row_exists(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=False)
    set_next_ready(repo_copy, "`M01-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "no work-package row is READY" in result.stdout


def test_current_work_package_must_be_exact_none_or_blocked_id(
    repo_copy: Path,
) -> None:
    # Establish the complete premise (no IN_PROGRESS row) regardless of the
    # live repository state: M01-W01 became IN_PROGRESS during M01, and an
    # inherited IN_PROGRESS row would divert the validator to the
    # current-package-mismatch error instead of the exactness error.
    set_pkg_state(repo_copy, "M00-W10", "NOT_STARTED")
    set_pkg_state(repo_copy, "M01-W01", "NOT_STARTED")
    set_current_package(repo_copy, "garbage")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "must be NONE or a BLOCKED package" in result.stdout


def test_next_ready_none_must_be_exact(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=False)
    set_next_ready(repo_copy, "NONE nonsense")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "no work-package row is READY" in result.stdout


def test_current_milestone_must_match_exact_next_work(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    set_current_milestone(repo_copy, "M38")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "Current milestone" in result.stdout
    assert "expected 'M01'" in result.stdout


def test_overall_release_gate_must_remain_canonical_not_ready(
    repo_copy: Path,
) -> None:
    edit(
        status_path(repo_copy),
        "Overall release gate: NOT_READY",
        "Overall release gate: READY",
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "canonical current value must be NOT_READY" in result.stdout


def test_all_gates_remain_not_evaluated_while_m00_is_unfinished(
    repo_copy: Path,
) -> None:
    set_ms_state(repo_copy, "M00", "IN_PROGRESS")
    set_pkg_state(repo_copy, "M00-W10", "IN_PROGRESS")
    set_current_package(repo_copy, "M00-W10")
    set_ms_state(repo_copy, "M01", "NOT_STARTED")
    set_pkg_state(repo_copy, "M01-W01", "NOT_STARTED")
    set_next_ready(repo_copy, "NONE")
    set_status_gate_row(repo_copy, "AUTOFILL_FEASIBILITY", "IN_PROGRESS")
    set_ledger_gate_state(repo_copy, "AUTOFILL_FEASIBILITY", "IN_PROGRESS")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "all four critical gates must remain NOT_EVALUATED" in result.stdout


def test_no_other_m01_package_becomes_prematurely_ready(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=True)
    set_pkg_state(repo_copy, "M01-W02", "READY")
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
    assert "expected 157" in result.stdout


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
        repo_copy / "docs" / "MASTER_IMPLEMENTATION_SPEC.v1.3.proposed.md",
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "MASTER_IMPLEMENTATION_SPEC.v1.3.proposed.md" in result.stdout


def test_final_tree_has_no_proposed_specification() -> None:
    assert not (
        REPO_ROOT / "docs" / "MASTER_IMPLEMENTATION_SPEC.v1.3.proposed.md"
    ).exists()


@pytest.mark.parametrize(
    "relative",
    [
        "docs/PLATFORM_SUPPORT.md",
        "docs/platform/CERTIFIED_MATRIX.md",
        "docs/platform/MODEL_RUNTIME_PROFILES.md",
        "docs/platform/NATIVE_MESSAGING_MATRIX.md",
        "docs/platform/PACKAGING_UPDATE_MATRIX.md",
    ],
)
def test_missing_platform_governance_file_rejected(
    repo_copy: Path, relative: str
) -> None:
    (repo_copy / relative).unlink()
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert relative in result.stdout


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


def test_missing_cross_platform_gate_report_rejected(repo_copy: Path) -> None:
    (repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md").unlink()
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "CROSS_PLATFORM_CORE_GATE.md" in result.stdout


def test_duplicate_cross_platform_gate_row_rejected(repo_copy: Path) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    row = next(
        line for line in text.splitlines() if line.startswith("| CROSS_PLATFORM_CORE |")
    )
    path.write_text(text.replace(row, f"{row}\n{row}", 1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "duplicate critical-gates row: CROSS_PLATFORM_CORE" in result.stdout


def test_gate_report_cell_must_name_canonical_report(repo_copy: Path) -> None:
    edit(
        status_path(repo_copy),
        "docs/gates/CROSS_PLATFORM_CORE_GATE.md |",
        "docs/gates/WRONG.md |",
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "CROSS_PLATFORM_CORE report cell" in result.stdout


def test_report_state_must_agree_even_while_not_evaluated(
    repo_copy: Path,
) -> None:
    report = repo_copy / "docs" / "gates" / "AUTOFILL_FEASIBILITY_GATE.md"
    edit(report, "- State: NOT_EVALUATED", "- State: PASS", count=1)
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "AUTOFILL_FEASIBILITY_GATE.md says 'PASS'" in result.stdout


def test_gate_cannot_start_before_its_evaluation_package(repo_copy: Path) -> None:
    prepare_m00_closeout(repo_copy, m01_ready=False)
    set_status_gate_row(repo_copy, "AUTOFILL_FEASIBILITY", "IN_PROGRESS")
    set_ledger_gate_state(repo_copy, "AUTOFILL_FEASIBILITY", "IN_PROGRESS")
    report = repo_copy / "docs" / "gates" / "AUTOFILL_FEASIBILITY_GATE.md"
    edit(report, "- State: NOT_EVALUATED", "- State: IN_PROGRESS", count=1)
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "before evaluation package M02-W14 is started" in result.stdout


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


def test_cross_platform_gate_pass_requires_full_ai_profiles(
    repo_copy: Path,
) -> None:
    pass_gate(repo_copy, "CROSS_PLATFORM_CORE")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "windows-x64 lacks CERTIFIED_FULL/ACCEPTED" in result.stdout
    assert "ubuntu-x64 lacks CERTIFIED_FULL/ACCEPTED" in result.stdout


def test_cross_platform_gate_pass_accepts_only_resolved_repository_evidence(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


def test_cross_platform_gate_rejects_real_but_irrelevant_evidence_record(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    gate_report = repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md"
    edit(
        gate_report,
        f"{GATE_D_EVIDENCE_REL} § Gate D evidence bundle",
        "docs/TEST_EVIDENCE.md § M00-W01",
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "not scoped to the required Gate D evidence owner" in result.stdout


def test_cross_platform_gate_rejects_package_id_buried_in_unowned_heading(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    evidence = repo_copy / "docs" / "TEST_EVIDENCE.md"
    with evidence.open("a", encoding="utf-8") as handle:
        handle.write("\n### Fake note mentioning M27-W12\n\nNot package evidence.\n")
    gate_report = repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md"
    edit(
        gate_report,
        f"{GATE_D_EVIDENCE_REL} § Gate D evidence bundle",
        "docs/TEST_EVIDENCE.md § Fake note mentioning M27-W12",
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "not scoped to the required Gate D evidence owner" in result.stdout


@pytest.mark.parametrize(
    ("reference", "reason"),
    [
        ("https://example.invalid/gate-d", "must not be a URL"),
        ("/etc/hosts", "must be repository-relative"),
        (r"C:\Users\runner\evidence.md", "must be repository-relative"),
        ("../outside.md", "must not contain path traversal"),
        ("placeholder evidence", "is a placeholder"),
        ("docs/gates/DOES_NOT_EXIST.md", "does not resolve"),
        (
            "docs/MASTER_IMPLEMENTATION_SPEC.md",
            "is not an approved repository evidence record/file",
        ),
        (
            f"{GATE_D_EVIDENCE_REL} § nonexistent heading",
            "heading that does not exist",
        ),
    ],
)
def test_cross_platform_gate_rejects_unsafe_or_unresolved_bundle_reference(
    repo_copy: Path, reference: str, reason: str
) -> None:
    prepare_gate_d_pass(repo_copy)
    gate_report = repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md"
    edit(
        gate_report,
        f"{GATE_D_EVIDENCE_REL} § Gate D evidence bundle",
        reference,
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "gate report Evidence bundle reference" in result.stdout
    assert reason in result.stdout


def test_cross_platform_gate_rejects_unresolved_profile_evidence(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    profiles = repo_copy / "docs" / "platform" / "MODEL_RUNTIME_PROFILES.md"
    _set_markdown_table_cell(
        profiles,
        "windows-x64",
        3,
        f"{GATE_D_EVIDENCE_REL} § nonexistent Windows profile",
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "windows-x64 profile evidence reference" in result.stdout
    assert "heading that does not exist" in result.stdout


def test_cross_platform_gate_rejects_placeholder_platform_matrix_evidence(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    matrix = repo_copy / "docs" / "platform" / "CERTIFIED_MATRIX.md"
    _set_markdown_table_cell(matrix, "ubuntu-x64", 5, "pending evidence")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "ubuntu-x64 platform-matrix evidence reference" in result.stdout
    assert "is a placeholder" in result.stdout


def test_cross_platform_gate_rejects_symlink_escape(repo_copy: Path) -> None:
    prepare_gate_d_pass(repo_copy)
    outside = repo_copy.parent / "outside-evidence.md"
    outside.write_text("# Outside\n", encoding="utf-8")
    link = repo_copy / "docs" / "gates" / "evidence" / "escaped.md"
    link.symlink_to(outside)
    gate_report = repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md"
    edit(
        gate_report,
        f"{GATE_D_EVIDENCE_REL} § Gate D evidence bundle",
        "docs/gates/evidence/escaped.md",
        count=1,
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "resolves outside the repository" in result.stdout


def test_cross_platform_gate_rejects_duplicate_platform_rows(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    matrix = repo_copy / "docs" / "platform" / "CERTIFIED_MATRIX.md"
    text = matrix.read_text(encoding="utf-8")
    row = next(
        line for line in text.splitlines() if line.startswith("| `windows-x64` |")
    )
    matrix.write_text(text.replace(row, f"{row}\n{row}", 1), encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "windows-x64 must have exactly one certified-platform matrix row" in (
        result.stdout
    )


def test_cross_platform_gate_requires_certified_full_matrix_state(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    matrix = repo_copy / "docs" / "platform" / "CERTIFIED_MATRIX.md"
    _set_markdown_table_cell(matrix, "windows-x64", 4, "`NOT_YET_IMPLEMENTED`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "windows-x64 certified-platform current product state" in result.stdout


@pytest.mark.parametrize(
    "case",
    [
        (
            "docs/PLATFORM_SUPPORT.md",
            "windows-x64",
            5,
            "`NOT_YET_IMPLEMENTED`",
            "windows-x64 platform-support state",
        ),
        (
            "docs/platform/NATIVE_MESSAGING_MATRIX.md",
            "windows-x64",
            3,
            "`NOT_YET_IMPLEMENTED`",
            "windows-x64 native-messaging state",
        ),
        (
            "docs/platform/PACKAGING_UPDATE_MATRIX.md",
            "windows-x64",
            4,
            "`NOT_YET_IMPLEMENTED`",
            "windows-x64 packaging/update state",
        ),
    ],
)
def test_cross_platform_gate_rejects_stale_support_registers(
    repo_copy: Path,
    case: tuple[str, str, int, str, str],
) -> None:
    relative_path, platform, state_index, replacement, message = case
    prepare_gate_d_pass(repo_copy)
    _set_markdown_table_cell(
        repo_copy / relative_path, platform, state_index, replacement
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert message in result.stdout


def test_cross_platform_gate_rejects_placeholder_measured_result(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    ledger = repo_copy / "docs" / "CRITICAL_GATES.md"
    text = ledger.read_text(encoding="utf-8")
    section_start = text.index("\n## CROSS_PLATFORM_CORE\n")
    prefix, section = text[:section_start], text[section_start:]
    next_section = section.index("\n## RESUME_PAGEFIT_FEASIBILITY\n")
    gate_d_section, remainder = section[:next_section], section[next_section:]
    assert "| PASS |" in gate_d_section
    gate_d_section = gate_d_section.replace("| PASS |", "| — |", 1)
    section = gate_d_section + remainder
    ledger.write_text(prefix + section, encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "placeholder Gate D measured results" in result.stdout


def test_cross_platform_gate_requires_m27_w12_decision_owner(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    set_pkg_state(repo_copy, "M27-W12", "NOT_STARTED")
    set_current_package(repo_copy, "NONE")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "before decision package M27-W12 is started" in result.stdout
    assert "independent Gate D decision owner" in result.stdout


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        (
            "- Owner decision: PASS (synthetic fixture)",
            "- Owner decision: REJECTED",
            "owner decision is not PASS",
        ),
        (
            "- Holdout result: PASS (synthetic fixture)",
            "- Holdout result: FAILED",
            "holdout result is not a passing result",
        ),
        (
            "- State: PASS\n- Evaluated revision:",
            "- State: NOT_EVALUATED\n- Evaluated revision:",
            "gate report state is 'NOT_EVALUATED', not PASS",
        ),
    ],
)
def test_cross_platform_gate_rejects_contradictory_report_records(
    repo_copy: Path, old: str, new: str, message: str
) -> None:
    prepare_gate_d_pass(repo_copy)
    report = repo_copy / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md"
    edit(report, old, new, count=1)
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert message in result.stdout


def test_cross_platform_gate_rejects_ledger_evidence_disagreement(
    repo_copy: Path,
) -> None:
    prepare_gate_d_pass(repo_copy)
    ledger = repo_copy / "docs" / "CRITICAL_GATES.md"
    text = ledger.read_text(encoding="utf-8")
    section_start = text.index("\n## CROSS_PLATFORM_CORE\n")
    prefix, section = text[:section_start], text[section_start:]
    section = section.replace(
        f"- Evaluated revision: {FAKE_TREE}",
        f"- Evaluated revision: tree {'f' * 40}",
        1,
    )
    ledger.write_text(prefix + section, encoding="utf-8")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "critical-gate ledger evaluated revision" in result.stdout


def test_safe_evidence_resolver_requires_requested_heading(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    evidence = repo / "docs" / "gates" / "evidence" / "EVIDENCE.md"
    evidence.parent.mkdir(parents=True)
    evidence.write_text(
        "# Evidence\n\n## Recorded result\n\nResolved fixture.\n",
        encoding="utf-8",
    )
    assert (
        validate_status._evidence_reference_error(
            repo, "docs/gates/evidence/EVIDENCE.md § Recorded result"
        )
        is None
    )
    assert (
        validate_status._evidence_reference_error(
            repo, "docs/gates/evidence/EVIDENCE.md#recorded-result"
        )
        is None
    )
    assert (
        validate_status._evidence_reference_error(
            repo, "[artifact](docs/gates/evidence/EVIDENCE.md)"
        )
        is None
    )
    error = validate_status._evidence_reference_error(
        repo, "docs/gates/evidence/EVIDENCE.md § Missing result"
    )
    assert error is not None
    assert "does not exist" in error


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


def test_m03_requires_m02_accepted_even_when_autofill_gate_passes(
    repo_copy: Path,
) -> None:
    promote_milestones(repo_copy, ["M00", "M01", "M02"])
    set_ms_state(repo_copy, "M02", "VERIFIED")
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M03", "READY")
    set_pkg_state(repo_copy, "M03-W01", "READY")
    set_next_ready(repo_copy, "`M03-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "milestone M02" in result.stdout
    assert "ACCEPTED required" in result.stdout


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


def test_m06_requires_m05_accepted_even_when_pagefit_gate_passes(
    repo_copy: Path,
) -> None:
    promote_milestones(repo_copy, ["M00", "M01", "M02", "M03", "M04", "M05"])
    set_ms_state(repo_copy, "M05", "VERIFIED")
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    pass_gate(repo_copy, "RESUME_PAGEFIT_FEASIBILITY")
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M06", "READY")
    set_pkg_state(repo_copy, "M06-W01", "READY")
    set_next_ready(repo_copy, "`M06-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "milestone M05" in result.stdout
    assert "ACCEPTED required" in result.stdout


def test_m06_is_not_blocked_by_missing_windows_ubuntu_full_ai(
    repo_copy: Path,
) -> None:
    promote_milestones(repo_copy, [f"M{number:02d}" for number in range(6)])
    pass_gate(repo_copy, "AUTOFILL_FEASIBILITY")
    pass_gate(repo_copy, "RESUME_PAGEFIT_FEASIBILITY")
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M06", "READY")
    set_pkg_state(repo_copy, "M06-W01", "READY")
    set_next_ready(repo_copy, "`M06-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr


def test_m28_blocked_without_cross_platform_gate(repo_copy: Path) -> None:
    promote_milestones(repo_copy, [f"M{number:02d}" for number in range(28)])
    for gate in GATES[:3]:
        pass_gate(repo_copy, gate)
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M28", "READY")
    set_pkg_state(repo_copy, "M28-W01", "READY")
    set_next_ready(repo_copy, "`M28-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "CROSS_PLATFORM_CORE" in result.stdout
    assert "PASS required" in result.stdout


def test_m28_blocked_without_m27_acceptance_even_when_gate_d_passes(
    repo_copy: Path,
) -> None:
    promote_milestones(repo_copy, [f"M{number:02d}" for number in range(27)])
    for gate in GATES:
        pass_gate(repo_copy, gate)
    accept_full_ai_profiles(repo_copy)
    set_current_package(repo_copy, "NONE")
    set_ms_state(repo_copy, "M28", "READY")
    set_pkg_state(repo_copy, "M28-W01", "READY")
    set_next_ready(repo_copy, "`M28-W01`")
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert "milestone M27" in result.stdout
    assert "ACCEPTED required" in result.stdout


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


@pytest.mark.parametrize("package_id", ["M00-W03", "M00-W08", "M00-W09"])
def test_dropped_preserved_revision_rejected(repo_copy: Path, package_id: str) -> None:
    path = status_path(repo_copy)
    text = path.read_text(encoding="utf-8")
    match = re.search(
        rf"^\| `{package_id}` \| VERIFIED \| (tree [0-9a-f]{{40}})",
        text,
        flags=re.MULTILINE,
    )
    assert match, f"{package_id} row must carry its verified tree revision"
    path.write_text(
        text[: match.start(1)] + "—" + text[match.end(1) :],
        encoding="utf-8",
    )
    result = run_validator(repo_copy)
    assert result.returncode == 1
    assert package_id in result.stdout


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
    prepare_m00_closeout(repo_copy, m01_ready=True)
    parsed = validate_status.parse_status(status_path(repo_copy))
    m00_rows = [row for row in parsed.package_rows if row[0].startswith("M00-")]
    assert all(row[1] == "VERIFIED" for row in m00_rows)
    result = run_validator(repo_copy)
    assert result.returncode == 0, result.stdout + result.stderr
