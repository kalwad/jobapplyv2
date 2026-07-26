"""Tests for the environment doctor and preflight (M00-W06).

Negative environment cases inject fake command results through the doctor's
Runner seam instead of uninstalling or corrupting real local tools; repo-file
cases use temporary fixture copies. The positive path runs the real doctor
subprocess against the real repository.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import doctor
import pytest
from conftest import REPO_ROOT

DOCTOR = REPO_ROOT / "scripts" / "doctor.py"

BASE_OUTPUTS: dict[tuple[str, ...], tuple[int, str]] = {
    ("node", "--version"): (0, "v24.18.0"),
    ("pnpm", "--version"): (0, "11.17.0"),
    ("uv", "--version"): (0, "uv 0.11.32 (fixture)"),
    ("uv", "run", "python", "-VV"): (0, "Python 3.12.13 (fixture)"),
    ("rustup", "which", "cargo"): (
        0,
        "/fixture/.rustup/toolchains/1.97.1-fixture/bin/cargo",
    ),
    ("cargo", "--version"): (0, "cargo 1.97.1 (fixture)"),
    ("rustc", "--version"): (0, "rustc 1.97.1 (fixture)"),
    ("cargo", "fmt", "--version"): (0, "rustfmt 1.9.0-stable (fixture)"),
    ("cargo", "clippy", "--version"): (0, "clippy 0.1.97 (fixture)"),
    ("git", "rev-parse", "--is-inside-work-tree"): (0, "true"),
    ("git", "branch", "--show-current"): (0, "main"),
    ("git", "status", "--porcelain"): (0, ""),
    doctor.BROWSER_SMOKE_ARGV: (0, "1 passed"),
}


def stub_runner(
    overrides: dict[tuple[str, ...], tuple[int, str]] | None = None,
) -> doctor.Runner:
    table = {**BASE_OUTPUTS, **(overrides or {})}

    def run(argv: tuple[str, ...]) -> tuple[int, str]:
        if argv in table:
            return table[argv]
        if argv and argv[0] == sys.executable:
            return (0, "PASS: all checks passed (fixture)")
        return (0, "")

    return run


def ctx_with(
    repo: Path, overrides: dict[tuple[str, ...], tuple[int, str]] | None = None
) -> doctor.DoctorContext:
    return doctor.DoctorContext(repo=repo, run=stub_runner(overrides))


def result_by_id(
    results: list[doctor.CheckResult], check_id: str
) -> doctor.CheckResult:
    matches = [r for r in results if r.check_id == check_id]
    assert matches, f"no check result with id {check_id!r}"
    return matches[0]


@pytest.fixture
def doctor_repo(tmp_path: Path) -> Path:
    """Fixture repo with everything the doctor's file checks read."""
    repo = tmp_path / "repo"
    (repo / "scripts").mkdir(parents=True)
    shutil.copytree(REPO_ROOT / "docs", repo / "docs")
    for rel in (
        "CLAUDE.md",
        "package.json",
        "pyproject.toml",
        "rust-toolchain.toml",
        ".nvmrc",
        ".python-version",
        "pnpm-lock.yaml",
        "uv.lock",
    ):
        shutil.copy2(REPO_ROOT / rel, repo / rel)
    (repo / "services" / "native-host").mkdir(parents=True)
    shutil.copy2(
        REPO_ROOT / "services" / "native-host" / "Cargo.lock",
        repo / "services" / "native-host" / "Cargo.lock",
    )
    for rel in ("validate_status.py", "verify.py", "verification-suites.json"):
        shutil.copy2(REPO_ROOT / "scripts" / rel, repo / "scripts" / rel)
    return repo


def toolchain_results(
    overrides: dict[tuple[str, ...], tuple[int, str]],
) -> list[doctor.CheckResult]:
    pins = doctor.read_pins(REPO_ROOT)
    return doctor.check_toolchain(ctx_with(REPO_ROOT, overrides), pins)


# ------------------------------------------------------------ positive path


def test_real_environment_doctor_succeeds() -> None:
    result = subprocess.run(
        [sys.executable, str(DOCTOR)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "environment doctor" in result.stdout
    assert "0 fail" in result.stdout


def test_doctor_json_valid_and_stable() -> None:
    runs = [
        subprocess.run(
            [sys.executable, str(DOCTOR), "--json"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=300,
        )
        for _ in range(2)
    ]
    for run in runs:
        assert run.returncode == 0, run.stdout + run.stderr
    payloads = [json.loads(run.stdout) for run in runs]
    assert payloads[0] == payloads[1], "doctor JSON output is not stable"
    payload = payloads[0]
    assert payload["doctor_format_version"] == 1
    assert isinstance(payload["ok"], bool)
    assert payload["summary"]["FAIL"] == 0
    for check in payload["checks"]:
        assert set(check) == {"id", "name", "status", "detail", "remediation"}
        assert check["status"] in {"PASS", "WARNING", "FAIL", "NOT_YET_APPLICABLE"}


def test_doctor_does_not_modify_tracked_files() -> None:
    def porcelain() -> str:
        return subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        ).stdout

    before = porcelain()
    subprocess.run(
        [sys.executable, str(DOCTOR)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )
    assert porcelain() == before


# ------------------------------------------------ injected toolchain failures


def test_wrong_node_version_fails() -> None:
    results = toolchain_results({("node", "--version"): (0, "v26.0.0")})
    node = result_by_id(results, "node")
    assert node.status == doctor.STATUS_FAIL
    assert "v26.0.0" in node.detail
    assert "node@24" in node.remediation


def test_wrong_pnpm_version_fails() -> None:
    results = toolchain_results({("pnpm", "--version"): (0, "10.2.0")})
    pnpm = result_by_id(results, "pnpm")
    assert pnpm.status == doctor.STATUS_FAIL
    assert "corepack" in pnpm.remediation


def test_missing_uv_fails() -> None:
    results = toolchain_results({("uv", "--version"): (127, "uv: command not found")})
    uv = result_by_id(results, "uv")
    assert uv.status == doctor.STATUS_FAIL
    assert "brew install uv" in uv.remediation


def test_wrong_python_patch_fails() -> None:
    results = toolchain_results(
        {("uv", "run", "python", "-VV"): (0, "Python 3.12.14 (fixture)")}
    )
    python = result_by_id(results, "python")
    assert python.status == doctor.STATUS_FAIL
    assert "uv sync --locked" in python.remediation


def test_missing_cargo_fails() -> None:
    results = toolchain_results(
        {("cargo", "--version"): (127, "cargo: command not found")}
    )
    cargo = result_by_id(results, "cargo")
    assert cargo.status == doctor.STATUS_FAIL
    assert "rustup" in cargo.remediation


def test_cargo_not_resolving_through_pinned_toolchain_fails() -> None:
    results = toolchain_results(
        {("rustup", "which", "cargo"): (0, "/opt/homebrew/opt/rust/bin/cargo")}
    )
    proxy = result_by_id(results, "rust-proxy")
    assert proxy.status == doctor.STATUS_FAIL
    assert "rust-toolchain.toml override not active" in proxy.detail


def test_missing_rustfmt_fails() -> None:
    results = toolchain_results(
        {("cargo", "fmt", "--version"): (1, "error: no such command: fmt")}
    )
    rustfmt = result_by_id(results, "rustfmt")
    assert rustfmt.status == doctor.STATUS_FAIL
    assert "component add rustfmt" in rustfmt.remediation


def test_missing_clippy_fails() -> None:
    results = toolchain_results(
        {("cargo", "clippy", "--version"): (1, "error: no such command: clippy")}
    )
    clippy = result_by_id(results, "clippy")
    assert clippy.status == doctor.STATUS_FAIL
    assert "component add clippy" in clippy.remediation


def test_missing_playwright_browser_fails() -> None:
    pins = doctor.read_pins(REPO_ROOT)
    overrides = {
        doctor.BROWSER_SMOKE_ARGV: (
            1,
            "browserType.launch: Executable doesn't exist at .../chrome",
        )
    }
    results = doctor.check_playwright(ctx_with(REPO_ROOT, overrides), pins)
    probe = result_by_id(results, "browser-probe")
    assert probe.status == doctor.STATUS_FAIL
    assert "playwright install chromium" in probe.remediation


# --------------------------------------------------- repository-file failures


def test_missing_memory_file_fails(doctor_repo: Path) -> None:
    (doctor_repo / "docs" / "KNOWN_ISSUES.md").unlink()
    pins = doctor.read_pins(doctor_repo)
    results = doctor.check_repository_files(ctx_with(doctor_repo), pins)
    memory = result_by_id(results, "memory-files")
    assert memory.status == doctor.STATUS_FAIL
    assert "KNOWN_ISSUES.md" in memory.detail
    assert memory.remediation


def test_missing_gate_report_fails(doctor_repo: Path) -> None:
    (doctor_repo / "docs" / "gates" / "WORKDAY_GUIDED_PRE_SUBMIT_GATE.md").unlink()
    pins = doctor.read_pins(doctor_repo)
    results = doctor.check_repository_files(ctx_with(doctor_repo), pins)
    gates = result_by_id(results, "critical-gate-files")
    assert gates.status == doctor.STATUS_FAIL
    assert "WORKDAY_GUIDED_PRE_SUBMIT_GATE.md" in gates.detail


def test_invalid_project_status_fails(doctor_repo: Path) -> None:
    status = doctor_repo / "docs" / "PROJECT_STATUS.md"
    status.write_text(
        status.read_text(encoding="utf-8").replace(
            "| `M03-W02` | NOT_STARTED |", "| `M03-W02` | DONE |"
        ),
        encoding="utf-8",
    )
    pins = doctor.read_pins(doctor_repo)
    ctx = doctor.DoctorContext(repo=doctor_repo, run=doctor.default_runner(doctor_repo))
    results = doctor.check_status_validator(ctx, pins)
    validator = result_by_id(results, "status-validator")
    assert validator.status == doctor.STATUS_FAIL


def test_human_output_contains_actionable_remediation() -> None:
    results = toolchain_results({("node", "--version"): (0, "v26.0.0")})
    rendered = doctor.render_human(results)
    assert "fix →" in rendered
    assert "node@24" in rendered


# ------------------------------------------------------------------ preflight


def test_preflight_propagates_doctor_failure(tmp_path: Path) -> None:
    failing = [doctor.CheckResult("node", "Node", doctor.STATUS_FAIL, "wrong", "fix")]
    ctx = doctor.DoctorContext(repo=tmp_path, run=stub_runner())
    marker = tmp_path / "verify-ran"
    code = doctor.run_preflight(
        ctx,
        failing,
        verify_argv=(sys.executable, "-c", f"open({str(marker)!r}, 'w')"),
    )
    assert code == 1
    assert not marker.exists(), "preflight ran verify despite doctor failure"


def test_preflight_propagates_verify_failure(tmp_path: Path) -> None:
    passing = [doctor.CheckResult("node", "Node", doctor.STATUS_PASS, "v24.18.0")]
    ctx = doctor.DoctorContext(repo=tmp_path, run=stub_runner())
    code = doctor.run_preflight(
        ctx, passing, verify_argv=(sys.executable, "-c", "raise SystemExit(3)")
    )
    assert code == 3


def test_preflight_runs_canonical_verify_command() -> None:
    assert doctor.PREFLIGHT_VERIFY_ARGV == ("pnpm", "verify")
