"""Tests for the environment doctor and preflight (M00-W06, M00-W09).

Negative environment cases inject fake command results through the doctor's
Runner seam instead of uninstalling or corrupting real local tools; repo-file
cases use temporary fixture copies. Platform identity and the redaction home
are injected too, so the macOS assertions stay deterministic when this suite
runs on the Windows/Ubuntu CI hosts and the Windows simulations run on any
host (M00-W09 §E/§I). The positive path runs the real doctor subprocess
against the real repository on whichever platform is executing the tests.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import doctor
import portability
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

# Windows-flavored healthy outputs: same pinned versions, Windows-native
# toolchain paths (drive letter, backslashes, .exe suffix, spaces in the
# profile directory).
WINDOWS_HOME = "C:\\Users\\Fixture User"
WINDOWS_OUTPUTS: dict[tuple[str, ...], tuple[int, str]] = {
    **BASE_OUTPUTS,
    ("rustup", "which", "cargo"): (
        0,
        WINDOWS_HOME
        + "\\.rustup\\toolchains\\1.97.1-x86_64-pc-windows-msvc\\bin\\cargo.exe",
    ),
}


def stub_runner(
    overrides: dict[tuple[str, ...], tuple[int, str]] | None = None,
    base: dict[tuple[str, ...], tuple[int, str]] | None = None,
) -> doctor.Runner:
    table = {**(base if base is not None else BASE_OUTPUTS), **(overrides or {})}

    def run(argv: tuple[str, ...]) -> tuple[int, str]:
        if argv in table:
            return table[argv]
        if argv and argv[0] == sys.executable:
            return (0, "PASS: all checks passed (fixture)")
        return (0, "")

    return run


def ctx_with(
    repo: Path,
    overrides: dict[tuple[str, ...], tuple[int, str]] | None = None,
    platform_id: str = portability.PLATFORM_MACOS,
) -> doctor.DoctorContext:
    """Context pinned to simulated macOS regardless of the test host."""
    return doctor.DoctorContext(
        repo=repo, run=stub_runner(overrides), platform_id=platform_id
    )


def windows_ctx_with(
    repo: Path,
    overrides: dict[tuple[str, ...], tuple[int, str]] | None = None,
) -> doctor.DoctorContext:
    """Context simulating a healthy Windows host from any platform."""
    return doctor.DoctorContext(
        repo=repo,
        run=stub_runner(overrides, base=WINDOWS_OUTPUTS),
        platform_id=portability.PLATFORM_WINDOWS,
        home=Path(WINDOWS_HOME),
    )


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
    contract_harness = (
        repo / "packages" / "contracts" / "test" / "contract" / "rust-harness"
    )
    contract_harness.mkdir(parents=True)
    shutil.copy2(
        REPO_ROOT
        / "packages"
        / "contracts"
        / "test"
        / "contract"
        / "rust-harness"
        / "Cargo.lock",
        contract_harness / "Cargo.lock",
    )
    contract_test = contract_harness.parent / "fixture.test.ts"
    contract_test.write_text("export {};\n", encoding="utf-8")
    for rel in (
        "validate_status.py",
        "traceability.py",
        "verify.py",
        "verification-suites.json",
        # The contract-gen suite discovers scripts/generate-contracts.*;
        # a healthy fixture repo must carry it now that M01-W02 activated
        # the suite (KI-0014/KI-0015/KI-0017 premise class).
        "generate-contracts.ts",
    ):
        shutil.copy2(REPO_ROOT / "scripts" / rel, repo / "scripts" / rel)
    playwright_manifest = repo / "node_modules" / "@playwright" / "test"
    playwright_manifest.mkdir(parents=True)
    shutil.copy2(
        REPO_ROOT / "node_modules" / "@playwright" / "test" / "package.json",
        playwright_manifest / "package.json",
    )
    return repo


def toolchain_results(
    overrides: dict[tuple[str, ...], tuple[int, str]],
) -> list[doctor.CheckResult]:
    pins = doctor.read_pins(REPO_ROOT)
    return doctor.check_toolchain(ctx_with(REPO_ROOT, overrides), pins)


def windows_toolchain_results(
    overrides: dict[tuple[str, ...], tuple[int, str]] | None = None,
) -> list[doctor.CheckResult]:
    pins = doctor.read_pins(REPO_ROOT)
    return doctor.check_toolchain(windows_ctx_with(REPO_ROOT, overrides), pins)


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


def test_missing_cross_platform_gate_report_fails(doctor_repo: Path) -> None:
    (doctor_repo / "docs" / "gates" / "CROSS_PLATFORM_CORE_GATE.md").unlink()
    pins = doctor.read_pins(doctor_repo)
    results = doctor.check_repository_files(ctx_with(doctor_repo), pins)
    gates = result_by_id(results, "critical-gate-files")
    assert gates.status == doctor.STATUS_FAIL
    assert "CROSS_PLATFORM_CORE_GATE.md" in gates.detail


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


# --------------------------------------------- simulated Windows (M00-W09 §E)


def test_simulated_healthy_windows_environment_succeeds(doctor_repo: Path) -> None:
    ctx = windows_ctx_with(doctor_repo)
    results = doctor.run_doctor(ctx)
    failures = [r for r in results if r.status == doctor.STATUS_FAIL]
    assert failures == [], [f"{r.check_id}: {r.detail}" for r in failures]
    platform_check = result_by_id(results, "platform")
    assert platform_check.status == doctor.STATUS_PASS
    assert "windows" in platform_check.detail
    proxy = result_by_id(results, "rust-proxy")
    assert proxy.status == doctor.STATUS_PASS
    # Windows-native toolchain path (drive letter, backslashes, .exe) is
    # accepted and the user profile is redacted from the detail.
    assert "cargo.exe" in proxy.detail
    assert WINDOWS_HOME not in proxy.detail
    assert proxy.detail.startswith("~")


def test_windows_wrong_node_version_fails_with_windows_remediation() -> None:
    results = windows_toolchain_results({("node", "--version"): (0, "v26.0.0")})
    node = result_by_id(results, "node")
    assert node.status == doctor.STATUS_FAIL
    assert "v26.0.0" in node.detail
    assert "winget" in node.remediation or "nvm-windows" in node.remediation
    assert "brew" not in node.remediation


def test_windows_missing_pnpm_fails() -> None:
    results = windows_toolchain_results(
        {
            ("pnpm", "--version"): (
                127,
                "'pnpm' is not recognized as an internal or external command",
            )
        }
    )
    pnpm = result_by_id(results, "pnpm")
    assert pnpm.status == doctor.STATUS_FAIL
    assert "corepack" in pnpm.remediation
    assert "PowerShell" in pnpm.remediation


def test_windows_missing_uv_fails() -> None:
    results = windows_toolchain_results(
        {("uv", "--version"): (127, "uv: command not found")}
    )
    uv = result_by_id(results, "uv")
    assert uv.status == doctor.STATUS_FAIL
    assert "winget install astral-sh.uv" in uv.remediation
    assert "brew" not in uv.remediation


def test_windows_wrong_python_patch_fails() -> None:
    results = windows_toolchain_results(
        {("uv", "run", "python", "-VV"): (0, "Python 3.12.14 (fixture)")}
    )
    python = result_by_id(results, "python")
    assert python.status == doctor.STATUS_FAIL
    assert "uv sync --locked" in python.remediation


def test_windows_missing_rustup_proxy_fails() -> None:
    results = windows_toolchain_results(
        {
            ("rustup", "which", "cargo"): (
                127,
                "'rustup' is not recognized as an internal or external command",
            )
        }
    )
    proxy = result_by_id(results, "rust-proxy")
    assert proxy.status == doctor.STATUS_FAIL
    assert "rustup-init.exe" in proxy.remediation
    assert "brew" not in proxy.remediation


def test_windows_wrong_rust_toolchain_fails() -> None:
    results = windows_toolchain_results(
        {
            ("rustup", "which", "cargo"): (
                0,
                WINDOWS_HOME
                + "\\.rustup\\toolchains\\1.96.0-x86_64-pc-windows-msvc"
                + "\\bin\\cargo.exe",
            )
        }
    )
    proxy = result_by_id(results, "rust-proxy")
    assert proxy.status == doctor.STATUS_FAIL
    assert "rust-toolchain.toml override not active" in proxy.detail


def test_windows_missing_rustfmt_and_clippy_fail() -> None:
    results = windows_toolchain_results(
        {
            ("cargo", "fmt", "--version"): (1, "error: no such command: fmt"),
            ("cargo", "clippy", "--version"): (1, "error: no such command: clippy"),
        }
    )
    assert result_by_id(results, "rustfmt").status == doctor.STATUS_FAIL
    assert "component add rustfmt" in result_by_id(results, "rustfmt").remediation
    assert result_by_id(results, "clippy").status == doctor.STATUS_FAIL
    assert "component add clippy" in result_by_id(results, "clippy").remediation


def test_windows_missing_chromium_fails() -> None:
    pins = doctor.read_pins(REPO_ROOT)
    overrides = {
        doctor.BROWSER_SMOKE_ARGV: (
            1,
            "browserType.launch: Executable doesn't exist at "
            + WINDOWS_HOME
            + "\\AppData\\Local\\ms-playwright\\chromium\\chrome.exe",
        )
    }
    results = doctor.check_playwright(windows_ctx_with(REPO_ROOT, overrides), pins)
    probe = result_by_id(results, "browser-probe")
    assert probe.status == doctor.STATUS_FAIL
    assert "playwright install chromium" in probe.remediation
    # The Windows user profile is redacted from the reported detail.
    assert WINDOWS_HOME not in probe.detail
    assert "~\\AppData\\Local\\ms-playwright" in probe.detail


def test_windows_remediation_never_references_homebrew() -> None:
    all_broken = {
        ("node", "--version"): (127, "not found"),
        ("pnpm", "--version"): (127, "not found"),
        ("uv", "--version"): (127, "not found"),
        ("uv", "run", "python", "-VV"): (127, "not found"),
        ("rustup", "which", "cargo"): (127, "not found"),
        ("cargo", "--version"): (127, "not found"),
        ("rustc", "--version"): (127, "not found"),
        ("cargo", "fmt", "--version"): (127, "not found"),
        ("cargo", "clippy", "--version"): (127, "not found"),
    }
    results = windows_toolchain_results(all_broken)
    assert results, "toolchain probes must report on a fully broken host"
    for result in results:
        assert result.status == doctor.STATUS_FAIL
        lowered = result.remediation.lower()
        assert "brew" not in lowered
        assert "homebrew" not in lowered
        assert "/opt/" not in lowered


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (
            "cargo at C:\\Users\\Tanish Ünïcode\\.cargo\\bin\\cargo.exe",
            "cargo at ~\\.cargo\\bin\\cargo.exe",
        ),
        (
            "runtime C:/Users/Tanish Ünïcode/.rustup/toolchains",
            "runtime ~/.rustup/toolchains",
        ),
        (
            "drive c:\\Users\\Tanish Ünïcode\\.cargo",
            "drive ~\\.cargo",
        ),
        (
            "directory C:\\uSeRs\\Tanish Ünïcode\\.cargo",
            "directory ~\\.cargo",
        ),
        (
            "username C:\\Users\\tANISH üNÏCODE\\.cargo",
            "username ~\\.cargo",
        ),
        (
            "mixed C:/uSeRs\\tANISH üNÏCODE/.rustup",
            "mixed ~/.rustup",
        ),
    ],
)
def test_scrub_redacts_windows_home_with_mixed_case_and_separators(
    text: str, expected: str
) -> None:
    home = Path("C:\\Users\\Tanish Ünïcode")
    assert doctor._scrub(text, home) == expected


@pytest.mark.parametrize(
    "text",
    [
        "C:\\Users\\Tanish Ünïcode-old\\.cargo",
        "C:/Users/Tanish Ünïcode.backup/.rustup",
        "C:\\Users\\Tanish Ünïcodes\\.cargo",
        "prefixC:\\Users\\Tanish Ünïcode\\.cargo",
    ],
)
def test_scrub_does_not_redact_unrelated_windows_path_prefixes(text: str) -> None:
    home = Path("C:\\Users\\Tanish Ünïcode")
    assert doctor._scrub(text, home) == text


def test_scrub_keeps_posix_case_sensitive_and_component_bounded() -> None:
    # A string preserves POSIX syntax when this test itself runs on Windows;
    # WindowsPath would otherwise rewrite the simulated leading slash.
    home = "/Users/Fixture User"
    text = (
        "/Users/Fixture User/.cargo "
        "/users/fixture user/.rustup "
        "/Users/Fixture User-old/.cache "
        "prefix/Users/Fixture User/.cache"
    )
    assert doctor._scrub(text, home) == (
        "~/.cargo /users/fixture user/.rustup /Users/Fixture User-old/.cache "
        "prefix/Users/Fixture User/.cache"
    )


def test_missing_repo_fatal_output_scrubs_windows_home(
    capsys: pytest.CaptureFixture[str],
) -> None:
    home = Path("C:\\Users\\Sensitive Owner")
    code = doctor.main(
        ["--repo", "C:\\Users\\Sensitive Owner\\missing-repo"],
        home=home,
    )
    captured = capsys.readouterr()
    assert code == 2
    assert "Sensitive Owner" not in captured.err
    assert "doctor: no package.json under ~\\missing-repo" in captured.err


def test_pin_read_fatal_output_scrubs_home(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    home = tmp_path / "Sensitive Owner"
    repo = home / "repo"
    repo.mkdir(parents=True)
    (repo / "package.json").write_text("{}", encoding="utf-8")
    code = doctor.main(["--repo", str(repo)], home=home)
    captured = capsys.readouterr()
    assert code == 2
    # FileNotFoundError renders a Windows filename with escaped backslashes;
    # normalize that exception-formatting detail before both assertions.
    normalized_err = captured.err.replace("\\\\", "\\")
    assert str(home) not in normalized_err
    expected_redacted = str(Path("~") / "repo" / "pyproject.toml")
    assert expected_redacted in normalized_err


def test_read_pins_accepts_crlf_pin_files(doctor_repo: Path) -> None:
    # Pin parsing must not assume LF-only files (M00-W09 §E/§I): a CRLF
    # checkout of .nvmrc/.python-version yields the same pins.
    (doctor_repo / ".nvmrc").write_bytes(b"24.18.0\r\n")
    (doctor_repo / ".python-version").write_bytes(b"3.12.13\r\n")
    pins = doctor.read_pins(doctor_repo)
    assert pins.node == "24.18.0"
    assert pins.python == "3.12.13"


def test_default_runner_reports_unresolvable_command(tmp_path: Path) -> None:
    run = doctor.default_runner(tmp_path)
    code, output = run(("definitely-not-a-real-command-m00w09",))
    assert code == 127
    assert "command not found" in output


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
