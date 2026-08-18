"""Tests for scripts/portability.py and scripts/check_portability.py (M00-W09).

Windows executable-resolution semantics are exercised through injected
platform flavor, PATH entries, PATHEXT, and existence probes, so they run
identically on macOS, Windows, and Ubuntu hosts. Policy-checker negatives
mutate an isolated fixture repository built from the real workflow/config
files; nothing here touches the developer's machine or the real repository.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import check_portability
import portability
import pytest
import verify
import yaml
from conftest import REPO_ROOT, run_git

# ------------------------------------------------ executable resolution (§E)


def probe_for(existing: set[str]) -> Callable[[str], bool]:
    """Case-insensitive existence probe simulating a Windows filesystem."""
    folded = {path.casefold() for path in existing}

    def probe(candidate: str) -> bool:
        return candidate.casefold() in folded

    return probe


def test_windows_resolves_exe_via_pathext() -> None:
    resolved = portability.resolve_executable(
        "cargo",
        is_windows=True,
        path_entries=("C:\\Users\\dev\\.cargo\\bin",),
        pathext=(".COM", ".EXE", ".BAT", ".CMD"),
        probe=probe_for({"C:\\Users\\dev\\.cargo\\bin\\cargo.exe"}),
    )
    assert resolved is not None
    assert resolved.lower().endswith("\\cargo.exe")


def test_windows_resolves_cmd_shim_for_pnpm() -> None:
    node_dir = "C:\\hostedtoolcache\\windows\\node\\24.18.0\\x64"
    resolved = portability.resolve_executable(
        "pnpm",
        is_windows=True,
        path_entries=(node_dir,),
        pathext=(".COM", ".EXE", ".BAT", ".CMD"),
        probe=probe_for({node_dir + "\\pnpm.CMD"}),
    )
    assert resolved is not None
    assert resolved.lower().endswith("\\pnpm.cmd")


def test_windows_explicit_extension_is_probed_directly() -> None:
    resolved = portability.resolve_executable(
        "uv.exe",
        is_windows=True,
        path_entries=("C:\\Program Files (x86)\\pipx_bin",),
        pathext=(".COM", ".EXE"),
        probe=probe_for({"C:\\Program Files (x86)\\pipx_bin\\uv.exe"}),
    )
    assert resolved == "C:\\Program Files (x86)\\pipx_bin\\uv.exe"


def test_windows_pathext_extension_match_is_case_insensitive() -> None:
    # A command already carrying a PATHEXT extension (any case) is not
    # suffixed again.
    resolved = portability.resolve_executable(
        "PNPM.cmd",
        is_windows=True,
        path_entries=("C:\\tools",),
        pathext=(".CMD",),
        probe=probe_for({"C:\\tools\\pnpm.cmd"}),
    )
    assert resolved is not None
    assert resolved.lower() == "c:\\tools\\pnpm.cmd"


def test_windows_path_entries_with_spaces_and_unicode_resolve() -> None:
    entry = "C:\\Program Files\\Nodé München"
    resolved = portability.resolve_executable(
        "node",
        is_windows=True,
        path_entries=("C:\\empty", entry),
        pathext=(".EXE",),
        probe=probe_for({entry + "\\node.exe"}),
    )
    assert resolved is not None
    assert resolved.casefold() == (entry + "\\node.exe").casefold()


def test_windows_drive_letter_command_bypasses_path_search() -> None:
    calls: list[str] = []
    target = "D:\\tools\\rustup.exe"

    def probe(candidate: str) -> bool:
        calls.append(candidate)
        return candidate.casefold() == target.casefold()

    resolved = portability.resolve_executable(
        "D:\\tools\\rustup",
        is_windows=True,
        path_entries=("C:\\never-searched",),
        pathext=(".EXE",),
        probe=probe,
    )
    assert resolved is not None
    assert resolved.casefold() == target.casefold()
    assert all(candidate.startswith("D:\\tools\\") for candidate in calls)


def test_windows_forward_slash_paths_are_accepted() -> None:
    resolved = portability.resolve_executable(
        "C:/tools/uv",
        is_windows=True,
        path_entries=(),
        pathext=(".EXE",),
        probe=probe_for({"C:/tools/uv.EXE"}),
    )
    assert resolved == "C:/tools/uv.EXE"


def test_default_probes_apply_execute_bit_only_on_posix(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # One real file, both default probes. Windows semantics never require
    # an execute permission bit (existence is the criterion); POSIX
    # semantics do. The denied bit is simulated through os.access so the
    # differential holds on every test host, including Windows CI where a
    # real file cannot lose its X bit.
    tool = tmp_path / "tool.exe"
    tool.write_bytes(b"")
    monkeypatch.setattr(os, "access", lambda _path, _mode: False)
    windows_probe = portability._default_probe(True)
    posix_probe = portability._default_probe(False)
    assert windows_probe(str(tool)) is True
    assert posix_probe(str(tool)) is False


def test_posix_requires_execute_permission_bit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tool = tmp_path / "tool"
    tool.write_bytes(b"")
    # Deterministic on every host (including Windows CI, where os.access
    # cannot express a missing X bit): simulate the denied execute bit.
    monkeypatch.setattr(os, "access", lambda _path, _mode: False)
    assert (
        portability.resolve_executable(
            "tool", is_windows=False, path_entries=(str(tmp_path),)
        )
        is None
    )


def test_posix_first_match_wins_and_blank_entries_are_skipped() -> None:
    calls: list[str] = []

    def probe(candidate: str) -> bool:
        calls.append(candidate)
        return True

    resolved = portability.resolve_executable(
        "git",
        is_windows=False,
        path_entries=("", "  ", "/first/bin", "/second/bin"),
        probe=probe,
    )
    assert resolved == "/first/bin/git"
    assert calls == ["/first/bin/git"]


def test_host_resolution_finds_git_and_rejects_unknown_commands() -> None:
    assert portability.host_resolve_executable("git") is not None
    assert (
        portability.host_resolve_executable("definitely-not-a-real-command-m00w09")
        is None
    )


def test_verify_run_command_maps_python3_to_pinned_interpreter(
    tmp_path: Path,
) -> None:
    # The registry's literal "python3" must work even on hosts without a
    # python3 shim: it runs as the verification runner's own interpreter.
    ctx = verify.Context(
        repo=tmp_path,
        registry_path=tmp_path / "unused.json",
        status_path=tmp_path / "unused.md",
    )
    code, output = verify.run_command(
        ctx, ("python3", "-c", "import sys; print(sys.executable)")
    )
    assert code == 0
    assert output.strip().splitlines()[-1] == sys.executable


def test_verify_run_command_decodes_child_output_as_utf8(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, object] = {}

    def fake_run(*_args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        captured.update(kwargs)
        return subprocess.CompletedProcess("tool", 0, "portable \u019d\n", "")

    monkeypatch.setattr("verify.portability.host_resolve_executable", lambda _: "tool")
    monkeypatch.setattr("verify.subprocess.run", fake_run)
    ctx = verify.Context(
        repo=tmp_path,
        registry_path=tmp_path / "unused.json",
        status_path=tmp_path / "unused.md",
    )

    code, output = verify.run_command(ctx, ("tool",))

    assert code == 0
    assert output == "portable \u019d\n"
    assert captured["encoding"] == "utf-8"
    assert captured["errors"] == "strict"
    # The strict decode above is only sound if Python children are also told
    # to emit UTF-8; otherwise a Windows child falls back to the console code
    # page and the decode fails (M00-W11).
    child_env = captured["env"]
    assert isinstance(child_env, dict)
    assert child_env["PYTHONIOENCODING"] == "utf-8"


def test_verify_run_command_fails_closed_on_undecodable_child_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A stream dropped to None by a dead reader thread must fail legibly.

    Windows decodes captured output on reader threads, so a byte the strict
    UTF-8 decode rejects kills the thread and ``subprocess`` yields ``None``
    instead of raising. A zero return code must not then be reported as
    success, and the harness must not raise an opaque ``TypeError`` that
    would replace the command's real result (M00-W11).
    """

    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess("tool", 0, None, None)

    monkeypatch.setattr("verify.portability.host_resolve_executable", lambda _: "tool")
    monkeypatch.setattr("verify.subprocess.run", fake_run)
    ctx = verify.Context(
        repo=tmp_path,
        registry_path=tmp_path / "unused.json",
        status_path=tmp_path / "unused.md",
    )

    code, output = verify.run_command(ctx, ("tool",))

    assert code == 1
    assert "not decodable as UTF-8" in output


def test_verify_run_command_fails_closed_when_decode_raises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POSIX decodes in-thread, so the same corruption raises instead."""

    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        raise UnicodeDecodeError("utf-8", b"\xe9", 0, 1, "invalid continuation byte")

    monkeypatch.setattr("verify.portability.host_resolve_executable", lambda _: "tool")
    monkeypatch.setattr("verify.subprocess.run", fake_run)
    ctx = verify.Context(
        repo=tmp_path,
        registry_path=tmp_path / "unused.json",
        status_path=tmp_path / "unused.md",
    )

    code, output = verify.run_command(ctx, ("tool",))

    assert code == 1
    assert "not decodable as UTF-8" in output


def test_verify_configures_aggregate_output_as_utf8(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stdout = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
    stderr = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
    monkeypatch.setattr("verify.sys.stdout", stdout)
    monkeypatch.setattr("verify.sys.stderr", stderr)

    verify.configure_utf8_output()

    assert stdout.encoding == "utf-8"
    assert stdout.errors == "strict"
    assert stderr.encoding == "utf-8"
    assert stderr.errors == "strict"


# ------------------------------------------- policy checker fixtures (§H/§I)


def build_policy_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "policy-repo"
    (repo / ".github" / "workflows").mkdir(parents=True)
    (repo / "scripts").mkdir()
    shutil.copy2(
        REPO_ROOT / ".github" / "workflows" / "ci.yml",
        repo / ".github" / "workflows" / "ci.yml",
    )
    for rel in (".gitattributes", "package.json"):
        shutil.copy2(REPO_ROOT / rel, repo / rel)
    shutil.copy2(
        REPO_ROOT / "scripts" / "verification-suites.json",
        repo / "scripts" / "verification-suites.json",
    )
    run_git(repo, "init", "-q")
    run_git(repo, "add", "-A")
    run_git(repo, "commit", "-q", "-m", "policy fixture")
    return repo


@pytest.fixture
def policy_repo(tmp_path: Path) -> Path:
    return build_policy_repo(tmp_path)


def rules_of(repo: Path) -> set[str]:
    return {violation.rule for violation in check_portability.run_checks(repo)}


def load_workflow(repo: Path) -> dict[str, Any]:
    data = yaml.safe_load(
        (repo / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )
    assert isinstance(data, dict)
    return data


def dump_workflow(repo: Path, data: dict[str, Any]) -> None:
    # safe_dump drops comments; restore a version annotation on every
    # SHA-pinned uses line so only the intended rule difference fires.
    text = yaml.safe_dump(data, sort_keys=False, width=10_000)
    lines = [
        line + " # v0"
        if check_portability.SHA_PIN_RE.search(line.split(": ", 1)[-1])
        else line
        for line in text.splitlines()
    ]
    (repo / ".github" / "workflows" / "ci.yml").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def verify_job(data: dict[str, Any]) -> dict[str, Any]:
    return cast(dict[str, Any], data["jobs"]["verify"])


def step_by_run(data: dict[str, Any], body: str) -> dict[str, Any]:
    matches = [
        step
        for step in verify_job(data)["steps"]
        if str(step.get("run", "")).strip() == body
    ]
    assert len(matches) == 1
    return cast(dict[str, Any], matches[0])


def test_policy_baseline_fixture_is_clean(policy_repo: Path) -> None:
    assert rules_of(policy_repo) == set()


def test_real_repository_passes_the_policy(tmp_path: Path) -> None:
    del tmp_path
    assert check_portability.run_checks(REPO_ROOT) == []


@pytest.mark.parametrize("dropped", ["windows-2025", "macos-15", "ubuntu-24.04"])
def test_missing_required_platform_fails(policy_repo: Path, dropped: str) -> None:
    data = load_workflow(policy_repo)
    matrix = verify_job(data)["strategy"]["matrix"]
    matrix["os"] = [entry for entry in matrix["os"] if entry != dropped]
    dump_workflow(policy_repo, data)
    assert "PORT-CI-002" in rules_of(policy_repo)


def test_extra_matrix_runner_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["strategy"]["matrix"]["os"].append("macos-14")
    dump_workflow(policy_repo, data)
    assert "PORT-CI-002" in rules_of(policy_repo)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("exclude", [{"os": "windows-2025"}]),
        ("include", [{"os": "ubuntu-latest"}]),
        ("architecture", ["x64"]),
    ],
)
def test_matrix_cannot_filter_or_expand_exact_baseline(
    policy_repo: Path, key: str, value: object
) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["strategy"]["matrix"][key] = value
    dump_workflow(policy_repo, data)
    assert "PORT-CI-002" in rules_of(policy_repo)


@pytest.mark.parametrize("condition", ["${{ false }}", "failure()"])
def test_required_matrix_job_cannot_be_guarded(
    policy_repo: Path, condition: str
) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["if"] = condition
    dump_workflow(policy_repo, data)
    assert "PORT-CI-002" in rules_of(policy_repo)


def test_required_matrix_job_must_run_on_matrix_os(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["runs-on"] = "ubuntu-24.04"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-002" in rules_of(policy_repo)


def test_disconnected_dummy_matrix_cannot_satisfy_policy(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    command_job = verify_job(data)
    strategy = command_job.pop("strategy")
    command_job["runs-on"] = "ubuntu-24.04"
    data["jobs"]["dummy-matrix"] = {
        "strategy": strategy,
        "runs-on": "${{ matrix.os }}",
        "steps": [],
    }
    dump_workflow(policy_repo, data)
    rules = rules_of(policy_repo)
    assert "PORT-CI-003" in rules


@pytest.mark.parametrize("body", ["pnpm run doctor", "pnpm verify"])
def test_guarded_canonical_command_fails_as_weaker_windows_set(
    policy_repo: Path, body: str
) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, body)["if"] = "runner.os != 'Windows'"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-003" in rules_of(policy_repo)


@pytest.mark.parametrize(
    ("body", "weaker"),
    [
        ("pnpm run doctor", "pnpm doctor"),
        ("pnpm verify", "pnpm verify --filter @japp/platform"),
    ],
)
def test_weaker_canonical_command_variant_fails(
    policy_repo: Path, body: str, weaker: str
) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, body)["run"] = weaker
    dump_workflow(policy_repo, data)
    assert "PORT-CI-003" in rules_of(policy_repo)


def test_global_bash_default_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    data["defaults"] = {"run": {"shell": "bash"}}
    dump_workflow(policy_repo, data)
    assert "PORT-CI-004" in rules_of(policy_repo)


def test_unguarded_bash_step_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    posix_uv = next(
        step
        for step in verify_job(data)["steps"]
        if str(step.get("name", "")).startswith("Install pinned uv")
        and step.get("shell") == "bash"
    )
    del posix_uv["if"]
    dump_workflow(policy_repo, data)
    assert "PORT-CI-005" in rules_of(policy_repo)


def test_multiline_pwsh_step_without_strictness_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    steps = verify_job(data)["steps"]
    store = next(s for s in steps if s.get("name") == "Resolve pnpm store path")
    store["run"] = 'pnpm --version\n"path=$(pnpm store path)" >> $env:GITHUB_OUTPUT\n'
    dump_workflow(policy_repo, data)
    assert "PORT-CI-005" in rules_of(policy_repo)


def test_posix_only_command_reachable_on_windows_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2, {"name": "Make dir", "run": "mkdir -p artifacts"}
    )
    dump_workflow(policy_repo, data)
    assert "PORT-CI-006" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "condition",
    [
        "runner.os != 'Windows' || true",
        "runner.os == 'Linux' || runner.os == 'Windows'",
        "${{ runner.os == 'Linux' && false || runner.os == 'Windows' }}",
        "${{ runner.os != 'Windows'",
        "runner.os == 'Linux' }}",
    ],
)
def test_composite_condition_cannot_hide_windows_reachability(
    policy_repo: Path, condition: str
) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Composite guard bypass",
            "if": condition,
            "shell": "bash",
            "run": "mkdir -p artifacts",
        },
    )
    dump_workflow(policy_repo, data)
    rules = rules_of(policy_repo)
    assert "PORT-CI-005" in rules
    assert "PORT-CI-006" in rules


def test_wrapped_exact_non_windows_guard_is_permitted(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Wrapped exact guard",
            "if": "${{ runner.os != 'Windows' }}",
            "shell": "bash",
            "run": "mkdir -p artifacts",
        },
    )
    dump_workflow(policy_repo, data)
    assert rules_of(policy_repo) == set()


def test_equivalent_guarded_platform_specific_steps_are_permitted(
    policy_repo: Path,
) -> None:
    # POSIX behavior behind a non-Windows guard plus a pwsh Windows
    # equivalent is the approved isolation pattern.
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Make dir (POSIX)",
            "if": "runner.os != 'Windows'",
            "shell": "bash",
            "run": "mkdir -p artifacts\n",
        },
    )
    verify_job(data)["steps"].insert(
        3,
        {
            "name": "Make dir (Windows)",
            "if": "runner.os == 'Windows'",
            "shell": "pwsh",
            "run": "$ErrorActionPreference = 'Stop'\n"
            "$PSNativeCommandUseErrorActionPreference = $true\n"
            "New-Item -ItemType Directory -Force -Path artifacts | Out-Null\n",
        },
    )
    dump_workflow(policy_repo, data)
    assert rules_of(policy_repo) == set()


def test_continue_on_error_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, "pnpm verify")["continue-on-error"] = True
    dump_workflow(policy_repo, data)
    assert "PORT-CI-007" in rules_of(policy_repo)


def test_job_level_continue_on_error_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["continue-on-error"] = False
    dump_workflow(policy_repo, data)
    assert "PORT-CI-007" in rules_of(policy_repo)


def test_masked_child_failure_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    step = step_by_run(data, "pnpm run doctor")
    step["run"] = "pnpm run doctor || true"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-008" in rules_of(policy_repo)


def test_or_fallback_that_reports_success_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Masked fallback",
            "if": "runner.os != 'Windows'",
            "shell": "bash",
            "run": "failing-command || echo ignored",
        },
    )
    dump_workflow(policy_repo, data)
    assert "PORT-CI-008" in rules_of(policy_repo)


@pytest.mark.parametrize("success", ["true", ":", "exit 0"])
def test_trailing_unconditional_success_fails(policy_repo: Path, success: str) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Masked final status",
            "if": "runner.os != 'Windows'",
            "shell": "bash",
            "run": f"failing-command\n{success}\n",
        },
    )
    dump_workflow(policy_repo, data)
    assert "PORT-CI-008" in rules_of(policy_repo)


def test_swallowed_pwsh_catch_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Swallowed PowerShell error",
            "if": "runner.os == 'Windows'",
            "shell": "pwsh",
            "run": "$ErrorActionPreference = 'Stop'\n"
            "$PSNativeCommandUseErrorActionPreference = $true\n"
            "try { failing-command } catch { Write-Warning 'ignored' }\n",
        },
    )
    dump_workflow(policy_repo, data)
    assert "PORT-CI-008" in rules_of(policy_repo)


def test_rethrowing_pwsh_catch_is_permitted(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    verify_job(data)["steps"].insert(
        2,
        {
            "name": "Rethrown PowerShell error",
            "if": "runner.os == 'Windows'",
            "shell": "pwsh",
            "run": "$ErrorActionPreference = 'Stop'\n"
            "$PSNativeCommandUseErrorActionPreference = $true\n"
            "try { failing-command } catch { Write-Warning 'failed'; throw }\n",
        },
    )
    dump_workflow(policy_repo, data)
    assert rules_of(policy_repo) == set()


def test_unpinned_action_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    steps = verify_job(data)["steps"]
    checkout = next(
        s for s in steps if str(s.get("uses", "")).startswith("actions/checkout@")
    )
    checkout["uses"] = "actions/checkout@v7"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-009" in rules_of(policy_repo)


def test_widened_permissions_fail(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    data["permissions"] = {"contents": "write"}
    dump_workflow(policy_repo, data)
    assert "PORT-CI-010" in rules_of(policy_repo)


def test_missing_frozen_install_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, "pnpm install --frozen-lockfile")["run"] = "pnpm install"
    dump_workflow(policy_repo, data)
    path = policy_repo / ".github" / "workflows" / "ci.yml"
    path.write_text(
        "# docs only: pnpm install --frozen-lockfile\n"
        + path.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    assert "PORT-CI-012" in rules_of(policy_repo)


def test_missing_exact_toolchain_probe_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    steps = verify_job(data)["steps"]
    windows_rust = next(
        s
        for s in steps
        if "rustup toolchain install" in str(s.get("run", ""))
        and s.get("shell") == "pwsh"
    )
    windows_rust["run"] = str(windows_rust["run"]).replace(
        "$rustfmtVersion = rustfmt --version", "$rustfmtVersion = 'skipped'"
    )
    dump_workflow(policy_repo, data)
    assert "PORT-CI-013" in rules_of(policy_repo)


def test_cached_rustup_home_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    cargo_cache = next(
        s
        for s in verify_job(data)["steps"]
        if s.get("name") == "Cache cargo registry and git"
    )
    cargo_cache["with"]["path"] = "~/.cargo/registry\n~/.cargo/git\n~/.rustup\n"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-015" in rules_of(policy_repo)


def test_cache_of_user_or_profile_data_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    uv_cache = next(
        s
        for s in verify_job(data)["steps"]
        if s.get("name") == "Cache uv downloads and builds"
    )
    uv_cache["with"]["path"] = str(uv_cache["with"]["path"]) + "~/.config/Chrome\n"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-015" in rules_of(policy_repo)


def test_missing_windows_chromium_install_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    steps = verify_job(data)["steps"]
    steps[:] = [
        s
        for s in steps
        if s.get("name") != "Install pinned Playwright Chromium (Windows)"
    ]
    dump_workflow(policy_repo, data)
    assert "PORT-CI-016" in rules_of(policy_repo)


@pytest.mark.parametrize("operating_system", ["Linux", "macOS", "Windows"])
def test_composite_guard_cannot_satisfy_platform_chromium_install(
    policy_repo: Path, operating_system: str
) -> None:
    data = load_workflow(policy_repo)
    install = next(
        step
        for step in verify_job(data)["steps"]
        if "playwright install" in str(step.get("run", ""))
        and step.get("if") == f"runner.os == '{operating_system}'"
    )
    install["if"] = f"runner.os == '{operating_system}' && false"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-016" in rules_of(policy_repo)


def test_artifact_upload_outside_failure_scope_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    upload = next(
        s
        for s in verify_job(data)["steps"]
        if str(s.get("uses", "")).startswith("actions/upload-artifact@")
    )
    upload["if"] = "always()"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-017" in rules_of(policy_repo)


def test_unapproved_artifact_path_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    upload = next(
        s
        for s in verify_job(data)["steps"]
        if str(s.get("uses", "")).startswith("actions/upload-artifact@")
    )
    upload["with"]["path"] = "~/.config/"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-017" in rules_of(policy_repo)


def test_live_site_reference_in_run_step_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, "pnpm verify")["run"] = "pnpm verify https://example.invalid/jobs"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-018" in rules_of(policy_repo)


# ------------------------------------------------- shared-script negatives


def test_hardcoded_tmp_in_runtime_script_fails(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "cache_helper.py").write_text(
        'CACHE_DIR = "/tmp/japp-cache"\n', encoding="utf-8"
    )
    assert "PORT-SRC-001" in rules_of(policy_repo)


def test_embedded_hardcoded_tmp_in_runtime_literal_fails(
    policy_repo: Path,
) -> None:
    (policy_repo / "scripts" / "command_helper.py").write_text(
        'COMMAND = "copy input /tmp/output"\n', encoding="utf-8"
    )
    assert "PORT-SRC-001" in rules_of(policy_repo)


def test_shell_true_in_runtime_script_fails(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "runner_helper.py").write_text(
        "import subprocess\n\n"
        "def run(cmd: str) -> int:\n"
        "    return subprocess.run(cmd, shell=True, check=False).returncode\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-002" in rules_of(policy_repo)


def test_bash_wrapper_literal_in_runtime_script_fails(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "wrapper_helper.py").write_text(
        'WRAPPER = "bash -c ./verify-all"\n', encoding="utf-8"
    )
    assert "PORT-SRC-002" in rules_of(policy_repo)


def test_manual_separator_concatenation_fails(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "join_helper.py").write_text(
        'def join(base: str, name: str) -> str:\n    return base + "/" + name\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-003" in rules_of(policy_repo)


def test_separator_variable_concatenation_fails(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "join_helper.py").write_text(
        'SEPARATOR = "/"\n'
        "def join(base: str, name: str) -> str:\n"
        "    return base + SEPARATOR + name\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-003" in rules_of(policy_repo)


def test_execute_bit_dependence_outside_isolation_module_fails(
    policy_repo: Path,
) -> None:
    (policy_repo / "scripts" / "exec_helper.py").write_text(
        "import os\n\n"
        "def runnable(path: str) -> bool:\n"
        "    return os.access(path, os.X_OK)\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-004" in rules_of(policy_repo)


def test_execute_bit_inside_designated_isolation_module_is_permitted(
    policy_repo: Path,
) -> None:
    shutil.copy2(
        REPO_ROOT / "scripts" / "portability.py",
        policy_repo / "scripts" / "portability.py",
    )
    assert rules_of(policy_repo) == set()


def test_case_colliding_tracked_paths_fail(policy_repo: Path) -> None:
    target = policy_repo / "Case.txt"
    target.write_text("case\n", encoding="utf-8")
    run_git(policy_repo, "add", "Case.txt")
    blob = subprocess.run(
        ["git", "hash-object", "-w", "Case.txt"],
        cwd=policy_repo,
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    ).stdout.strip()
    # Register a second path differing only by case directly in the index —
    # a case-insensitive working tree cannot even materialize both.
    run_git(
        policy_repo,
        "update-index",
        "--add",
        "--cacheinfo",
        f"100644,{blob},case.TXT",
    )
    assert "PORT-SRC-005" in rules_of(policy_repo)


def test_missing_gitattributes_lf_rule_fails(policy_repo: Path) -> None:
    (policy_repo / ".gitattributes").write_text("*.png binary\n", encoding="utf-8")
    assert "PORT-SRC-006" in rules_of(policy_repo)


def test_hardcoded_tmp_in_ts_runtime_source_fails(policy_repo: Path) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "cache.ts").write_text(
        'import { readFileSync } from "node:fs";\n'
        'const CACHE_DIR = "/tmp/japp-cache";\n'
        "readFileSync(CACHE_DIR);\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_bash_wrapper_in_ts_runtime_source_fails(policy_repo: Path) -> None:
    source_dir = policy_repo / "packages" / "form-engine" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "runner.ts").write_text(
        'import { execSync } from "node:child_process";\n'
        'const WRAPPER = "bash -c ./verify-all";\n'
        "execSync(WRAPPER);\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_shell_true_spawn_in_ts_runtime_source_fails(policy_repo: Path) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        'export const run = () => spawnSync("pnpm build", { shell: true });\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize("quote", ['"', "'"])
def test_quoted_shell_true_spawn_in_ts_runtime_source_fails(
    policy_repo: Path, quote: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "quoted-helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        f"spawnSync('pnpm', [], {{ {quote}shell{quote}: true }});\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_multiline_shell_true_spawn_in_ts_runtime_source_fails(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "multiline-helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        "spawnSync('pnpm', [], { shell\n  :\n  true });\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_computed_shell_true_spawn_in_ts_runtime_source_fails(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "computed-helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        "spawnSync('pnpm', [], { ['shell']: true });\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_const_true_shorthand_shell_spawn_in_ts_runtime_source_fails(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "shorthand-helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        "const shell = true;\n"
        "spawnSync('pnpm', [], { shell });\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "source",
    [
        'spawnSync("node", ["--version"], { shell: !0 });\n',
        'spawnSync("node", ["--version"], { shell: !!1 });\n',
        (
            "const shellValue = !0;\n"
            'spawnSync("node", ["--version"], { shell: shellValue });\n'
        ),
        (
            'const shellKey = "shell";\n'
            'spawnSync("node", ["--version"], { [shellKey]: true });\n'
        ),
        (
            "const shellKey = `shell`;\n"
            'spawnSync("node", ["--version"], { [shellKey]: !0 });\n'
        ),
        (
            'const shellKey = "sh" + "ell";\n'
            "const enabled = false || !!2;\n"
            'spawnSync("node", ["--version"], { [shellKey]: enabled });\n'
        ),
        (
            "const enabled = (1 ? true : false) satisfies boolean;\n"
            "const shell = enabled;\n"
            'spawnSync("node", ["--version"], { shell });\n'
        ),
    ],
    ids=[
        "bang-zero",
        "double-bang-one",
        "const-value-alias",
        "const-computed-key",
        "template-computed-key",
        "logical-value-and-concatenated-key",
        "conditional-satisfies-shorthand",
    ],
)
def test_constant_equivalent_shell_true_spawn_fails(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "entrypoints"
    source_dir.mkdir(parents=True)
    (source_dir / "constant-shell-helper.ts").write_text(
        'import { spawnSync } from "node:child_process";\n' + source,
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { readFileSync } from "node:fs";\n'
            'const staging = "/" + "tmp/example";\n'
            "readFileSync(staging);\n"
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'const root = "/";\n'
            'const folder = "tmp";\n'
            'readFileSync(root + folder + "/example");\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'const root = "/";\n'
            "const folder = `tmp`;\n"
            "readFileSync(`${root}${folder}/example`);\n"
        ),
        (
            'import { execSync } from "node:child_process";\n'
            'const shellName = "ba" + "sh";\n'
            'const wrapper = `${shellName} ${"-c"} echo ready`;\n'
            "execSync(wrapper);\n"
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'const root = true ? "/" : "portable";\n'
            'const staging = root + "var/cache";\n'
            "readFileSync(staging);\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const operationalArgument = "copy input /tmp/output";\n'
            'spawnSync("tool", [operationalArgument]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const executable = "ba" + "sh";\n'
            'const executeFlag = `-${"c"}`;\n'
            'spawnSync(executable, [executeFlag, "echo ready"]);\n'
        ),
    ],
    ids=[
        "concatenated-path",
        "const-alias-path-in-filesystem-sink",
        "template-path-in-filesystem-sink",
        "constant-built-bash-wrapper",
        "conditional-path",
        "embedded-path-in-process-sink",
        "constant-built-shell-argv-tuple",
    ],
)
def test_constant_built_operational_typescript_values_fail(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "operational-value.ts").write_text(source, encoding="utf-8")
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    ("source", "expected_detail"),
    [
        (
            (
                'import { readFileSync } from "node:fs";\n'
                'const target = "/" + "tmp/reviewer";\n'
                "readFileSync(target);\n"
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'execSync("bash\\t   -c echo ready");\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { execFileSync } from "node:child_process";\n'
                'execFileSync("bash", ["-c", "echo ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { fork } from "node:child_process";\n'
                'const execArgv = ["--require=/tmp/hook.js"];\n'
                'fork("worker.js", [], { execArgv });\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
    ],
    ids=[
        "composed-assignment-rhs",
        "tab-multispace-wrapper",
        "exec-file-sync-shell-tuple",
        "shorthand-exec-argv-embedded-path",
    ],
)
def test_additional_operational_typescript_values_fail(
    policy_repo: Path, source: str, expected_detail: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "additional-operational-value.ts").write_text(
        source, encoding="utf-8"
    )
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008" and expected_detail in violation.message
        for violation in violations
    )


@pytest.mark.parametrize(
    ("source", "expected_detail"),
    [
        (
            (
                'import fs = require("node:fs");\n'
                'const sourcePath = "source=/tmp/reviewer";\n'
                "fs.readFileSync(sourcePath);\n"
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'const childProcess = require("node:child_process");\n'
                'childProcess.spawnSync("bash", ["-c", "echo ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
    ],
    ids=[
        "import-equals-filesystem-embedded-path",
        "require-child-process-shell-tuple",
    ],
)
def test_commonjs_typescript_operational_provenance_fails(
    policy_repo: Path, source: str, expected_detail: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "commonjs-operational.cts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008" and expected_detail in violation.message
        for violation in violations
    )


def test_commonjs_node_path_result_propagates_into_filesystem_sink(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "commonjs-path-result.cts").write_text(
        'const { readFileSync } = require("node:fs");\n'
        'const { join: combine } = require("node:path");\n'
        'readFileSync(combine("/", "tmp", "reviewer"));\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_hardcoded_tmp_in_tsx_runtime_source_fails(policy_repo: Path) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "profile.tsx").write_text(
        'import { readFileSync } from "node:fs";\n'
        'export const profile = <span>{readFileSync("/tmp/japp-profile")}</span>;\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize("suffix", [".mts", ".cts"])
def test_node_specific_typescript_runtime_extensions_are_scanned(
    policy_repo: Path, suffix: str
) -> None:
    source_dir = policy_repo / "scripts"
    (source_dir / f"profile{suffix}").write_text(
        'import { readFileSync } from "node:fs";\nreadFileSync("/tmp/japp-profile");\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_hardcoded_tmp_in_ts_node_tool_script_fails(policy_repo: Path) -> None:
    # Node-executed TypeScript tool scripts (apps/*/scripts, root
    # scripts/*.ts, package scripts/generator trees) are inside the
    # PORT-SRC-008 scan surface too.
    source_dir = policy_repo / "apps" / "mock-ats-lab" / "scripts"
    source_dir.mkdir(parents=True)
    (source_dir / "check-helper.ts").write_text(
        'import { readFileSync } from "node:fs";\n'
        'const STAGING_DIR = "/tmp/japp-catalog";\n'
        "readFileSync(STAGING_DIR);\n",
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_platform_neutral_ts_runtime_source_passes(policy_repo: Path) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "profile.ts").write_text(
        'import { tmpdir } from "node:os";\n'
        'import { join } from "node:path";\n'
        'export const profileRoot = () => join(tmpdir(), "japp-profile");\n',
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


def test_typescript_comments_documentation_and_innocent_strings_pass(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "portability-guidance.ts").write_text(
        "// Never use /tmp or shell: true.\n"
        "/** Avoid bash -c wrappers and /usr paths. */\n"
        "'Documentation-only /var example';\n"
        "('Parenthesized documentation-only /tmp example');\n"
        "('/usr documentation-only example' as const);\n"
        'export const literal = "shell: true is not an option object";\n'
        "export const options = { shell: false };\n",
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "source",
    [
        "// shell: true; /tmp/example; bash -c echo docs\nexport const value = 1;\n",
        (
            "/**\n"
            " * shell: true is forbidden; avoid /tmp and bash -c wrappers.\n"
            " */\n"
            "export const value = 1;\n"
        ),
        (
            'type RuntimeExamples = { shell: true; path: "/tmp/example" };\n'
            'export type WrapperExample = "bash -c echo docs";\n'
        ),
        '"Standalone documentation says to avoid /tmp and bash -c wrappers";\n',
        (
            "export const portabilityHelp =\n"
            '  "Documentation says to avoid /tmp and bash -c wrappers";\n'
        ),
        (
            "export const portabilityTemplate =\n"
            '  `Do not use ${"/tmp"} in examples or ${"bash -c"} wrappers`;\n'
        ),
        'export const shellDescription = "The shell guide is descriptive";\n',
        (
            'const optionKey = "portable";\n'
            "export const options = { [optionKey]: true };\n"
        ),
        ('declare const segment: string;\nexport const unresolved = "/" + segment;\n'),
        (
            'export const guidance = "Avoid " + "/tmp" +\n'
            '  " and bash -c in documentation";\n'
        ),
    ],
    ids=[
        "line-comment",
        "jsdoc",
        "type-only",
        "standalone-description",
        "exact-exported-verifier-reproduction",
        "exported-descriptive-template",
        "innocent-shell-word",
        "unrelated-computed-property",
        "dynamic-unknown",
        "innocent-constant-concatenation",
    ],
)
def test_typescript_nonoperational_documentation_and_unknown_values_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "nonoperational.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { writeFile } from "node:fs";\n'
            "const portabilityHelp =\n"
            '  "Documentation says to avoid /tmp and bash -c wrappers";\n'
            'writeFile("portability-help.txt", portabilityHelp, () => {});\n'
        ),
        (
            'import process from "node:process";\n'
            "process.stdout.write(\n"
            '  "Documentation says to avoid /tmp and bash -c wrappers",\n'
            ");\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("bash -client");\n'
        ),
    ],
    ids=[
        "write-file-payload-exact-help",
        "process-stdout-write-exact-help",
        "bash-client-lookalike",
    ],
)
def test_typescript_operational_payloads_and_wrapper_lookalikes_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "operational-payload.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", ["--version"], { shell: !+"0" });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            "options.shell = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            'const key = "shell";\n'
            "options[key] = !0;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "options.shell = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            'readFileSync(join("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import * as path from "node:path";\n'
            'const p = path.resolve("/", "tmp", "reviewer");\n'
            "readFileSync(p);\n"
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join as combine } from "node:path";\n'
            'readFileSync(combine("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            'const root = "/";\n'
            'const dir = "tmp";\n'
            'const p = join(root, dir, "reviewer");\n'
            "readFileSync(p);\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const executable = "ba" + "sh";\n'
            'const flag = "-" + "c";\n'
            'spawnSync(executable, [flag, "echo hi"]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const keyPart = "sh";\n'
            'const key = keyPart + "ell";\n'
            'const enabled = !+"0";\n'
            "const options = {};\n"
            "options[key] = enabled;\n"
            'spawnSync("node", [], options);\n'
        ),
    ],
    ids=[
        "t1-unary-numeric-shell",
        "t2-post-construction-shell",
        "t3-computed-post-construction-shell",
        "t4-overwrite-to-shell-true",
        "t5-direct-join-result-in-fs-sink",
        "t6-namespace-resolve-result-in-fs-sink",
        "t7-aliased-node-path-join",
        "t8-constant-composed-join-path",
        "t9-composed-bash-executable-and-flag",
        "t10-aliased-computed-shell-write",
    ],
)
def test_third_correction_required_typescript_violations_fail(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "third-correction-violation.ts").write_text(source, encoding="utf-8")
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "source",
    [
        (
            "export const example =\n"
            '  "/tmp/example is a prohibited portability example";\n'
        ),
        (
            "export const wrapperExample =\n"
            '  "bash -c is forbidden in runtime commands";\n'
        ),
        (
            'import { writeFileSync } from "node:fs";\n'
            'writeFileSync("portable.txt", "/tmp/example is documentation");\n'
        ),
        (
            'import process from "node:process";\n'
            'process.stdout.write("/tmp/example is documentation");\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            'readFileSync(join("fixtures", "reviewer"));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("bash", ["-client"]);\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            "function join(...parts: string[]): string {\n"
            '  return "/tmp/" + parts.join("/");\n'
            "}\n"
            'readFileSync(join("reviewer"));\n'
        ),
        (
            "function spawnSync(..._args: unknown[]): void {}\n"
            'spawnSync("bash", ["-c"], { shell: true });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            "options.shell = true;\n"
            "options.shell = false;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const enabled: boolean;\n"
            "const options = {};\n"
            "options.shell = enabled;\n"
            'spawnSync("node", [], options);\n'
        ),
    ],
    ids=[
        "c1-descriptive-leading-path",
        "c2-descriptive-leading-wrapper",
        "c3-write-file-data-position",
        "c4-process-stdout-data",
        "c5-relative-join-in-fs-sink",
        "c6-bash-client-lookalike",
        "c7-local-shadowed-join",
        "c8-local-shadowed-spawn-sync",
        "c9-final-shell-false",
        "c10-dynamic-unknown-shell-value",
    ],
)
def test_third_correction_required_typescript_controls_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "third-correction-control.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "expression",
    [
        "!+false",
        "!!+true",
        "!+null",
        '!+""',
        '!!+"1"',
        '!!+" 2 "',
        '!+"not-number"',
        '!!-"2"',
        "!!1e309",
    ],
    ids=[
        "to-number-false",
        "to-number-true",
        "to-number-null",
        "to-number-empty-string",
        "to-number-one-string",
        "to-number-whitespace-string",
        "to-number-nan-string",
        "unary-minus-string",
        "numeric-literal-infinity",
    ],
)
def test_third_correction_primitive_coercions_to_shell_true_fail(
    policy_repo: Path, expression: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "primitive-coercion.ts").write_text(
        'import { spawnSync } from "node:child_process";\n'
        f'spawnSync("node", [], {{ shell: {expression} }});\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true, shell: false };\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const condition: boolean;\n"
            "const options = {};\n"
            "if (condition) {\n"
            "  options.shell = true;\n"
            "  options.shell = false;\n"
            "}\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            "if (false) options.shell = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function mutate(value: object): void;\n"
            "const options = { shell: true };\n"
            "mutate(options);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "Object.assign(options, { shell: false });\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { join } from "node:path";\n'
            'const text = join("/", "tmp", "reviewer");\n'
            "void text;\n"
        ),
        (
            'import { writeFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            'writeFileSync("portable.txt", join("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const key: string;\n"
            "const options = {};\n"
            "options[key] = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { shell: !!+false });\n'
        ),
        ('const p = "/tmp/x";\nvoid p;\n'),
        ('const help = "/tmp/example";\nvoid help;\n'),
        ('console.log("/tmp/example is documentation");\n'),
        ('declare function consume(value: string): void;\nconsume("/tmp/reviewer");\n'),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { shell: ' + "(" * 65 + "!0" + ")" * 65 + " });\n"
        ),
    ],
    ids=[
        "literal-last-shell-false",
        "conditional-branch-final-false",
        "statically-unreachable-shell-write",
        "unknown-call-alias-escape",
        "object-assign-escape",
        "unused-trusted-path-result",
        "trusted-path-result-in-data-position",
        "unknown-computed-property-key",
        "primitive-coercion-final-false",
        "unused-direct-path-constant",
        "unused-help-path-value",
        "console-log-data",
        "generic-call-data",
        "over-depth-primitive-expression-is-unknown",
    ],
)
def test_third_correction_additional_semantic_controls_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "additional-semantic-control.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false, shell: true };\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const condition: boolean;\n"
            "const options = {};\n"
            "if (condition) options.shell = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            'const key = "sh" + "ell";\n'
            "options[key] = true;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            "const buildPath = join;\n"
            'readFileSync(buildPath("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { join } from "node:path";\n'
            'const nested = join("tmp", "nested");\n'
            'readFileSync(join("/", nested, "reviewer"));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'import { join } from "node:path";\n'
            "const options = {};\n"
            'options.cwd = join("/", "tmp", "reviewer");\n'
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const c1: boolean, c2: boolean, c3: boolean;\n"
            "declare const c4: boolean, c5: boolean, c6: boolean, c7: boolean;\n"
            "const options = { shell: true };\n"
            "if (c1) {}\nif (c2) {}\nif (c3) {}\nif (c4) {}\n"
            "if (c5) {}\nif (c6) {}\nif (c7) {}\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {}, configured = (options.shell = true);\n"
            "void configured;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "false && (options.shell = false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            'spawnSync("node", (options.shell = true, []), options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            'spawnSync("node", [], (options.shell = true, options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = {};\n"
            "for (options.shell = true; ; ) {\n"
            '  spawnSync("node", [], options);\n'
            "  break;\n"
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const condition: boolean;\n"
            "const options = { shell: false };\n"
            "condition ? (options.shell = true) : (options.shell = false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { posix } from "node:path";\n'
            'readFileSync(posix.join("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const options = { shell: true, cwd: "portable" };\n'
            "options.cwd = false && (options.shell = false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "do {\n"
            "  continue;\n"
            "  options.shell = false;\n"
            "} while (false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'options.shell = Boolean(spawnSync("node", [], options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const target: { value: number };\n"
            "const options = { shell: false };\n"
            "(options.shell = true, target).value = 0;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const branch: boolean;\n"
            "const options = {};\n"
            "for (options.shell = true; false; ) {\n"
            "  if (branch) break;\n"
            "}\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const value = {\n"
            "  before: false && (options.shell = false),\n"
            '  sink: spawnSync("node", [], options),\n'
            "};\n"
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const value = ({\n"
            "  before: false && (options.shell = false),\n"
            '  sink: spawnSync("node", [], options),\n'
            "}).sink;\n"
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function consume(...values: unknown[]): void;\n"
            "const options = { shell: true };\n"
            "consume(...[false && (options.shell = false)]);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function tag(parts: TemplateStringsArray, "
            "...values: unknown[]): unknown;\n"
            "const options = { shell: true };\n"
            "const value = tag`${false && (options.shell = false)}"
            '${spawnSync("node", [], options)}`;\n'
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function tag(parts: TemplateStringsArray, "
            "...values: unknown[]): unknown;\n"
            "const options = { shell: true };\n"
            "const value = tag`${false && (options.shell = false)}`;\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const invoke: ((value: unknown) => unknown) | null;\n"
            "const options = { shell: true };\n"
            'invoke?.(spawnSync("node", [], options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const target = null as { run(value: unknown): unknown } | null;\n"
            "target?.run(false && (options.shell = false));\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            '"live"?.[spawnSync("node", [], options) as unknown as string];\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const value = (null as Record<string, unknown> | null)?.[\n"
            "  false && (options.shell = false) as unknown as string\n"
            "];\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'const root = "live" as unknown as '
            "{ child?: (value: unknown) => unknown };\n"
            "root?.child?.(options.shell = false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'const root = "live" as unknown as '
            "{ child?: (value: unknown) => unknown };\n"
            "root?.child?.(options.shell = true);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'const root = "live" as unknown as { child?: Record<string, unknown> };\n'
            "root?.child?.[options.shell = false as unknown as string];\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'const root = "live" as unknown as { child?: Record<string, unknown> };\n'
            "root?.child?.[options.shell = true as unknown as string];\n"
            'spawnSync("node", [], options);\n'
        ),
    ],
    ids=[
        "literal-last-shell-true",
        "possible-branch-shell-true",
        "concatenated-computed-property-key",
        "const-path-callee-alias",
        "nested-path-composition",
        "post-construction-path-option",
        "state-merge-preserves-definite-shell-true",
        "same-declaration-post-construction-write",
        "unreachable-logical-overwrite-preserves-true",
        "earlier-sink-argument-write",
        "comma-wrapped-options-write",
        "for-initializer-write-before-in-loop-sink",
        "conditional-expression-possible-shell-true",
        "esm-posix-path-flavor",
        "nested-unreachable-overwrite-preserves-true",
        "continue-skips-shell-false-write",
        "sink-in-assignment-rhs-sees-prior-state",
        "assignment-lhs-base-write-is-visible",
        "loop-initializer-precedes-unreachable-ambiguous-body",
        "object-container-sink-preserves-unreachable-false-write",
        "property-wrapper-sink-preserves-unreachable-false-write",
        "spread-argument-skips-unreachable-false-write",
        "tagged-template-sink-preserves-unreachable-false-write",
        "tagged-template-before-sink-skips-unreachable-false-write",
        "optional-call-unknown-callee-may-reach-sink",
        "optional-method-null-base-skips-false-write-before-later-sink",
        "optional-element-live-base-reaches-sink",
        "optional-element-null-base-skips-false-write-before-later-sink",
        "multi-link-optional-call-unknown-intermediate-preserves-true",
        "multi-link-optional-call-unknown-intermediate-may-write-true",
        "multi-link-optional-element-unknown-intermediate-preserves-true",
        "multi-link-optional-element-unknown-intermediate-may-write-true",
    ],
)
def test_third_correction_additional_semantic_violations_fail(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "additional-semantic-violation.ts").write_text(
        source, encoding="utf-8"
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true }, configured = "
            "(options.shell = false);\n"
            "void configured;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "false && (options.shell = true);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "while (false) { options.shell = true; }\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "({ shell: options.shell } = { shell: false });\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "({ shell: options.shell } = { shell: true });\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true }, alias = options;\n"
            "alias.shell = false;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const deferred = () => { options.shell = false; };\n"
            "void deferred;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'readFileSync("bash -c is a filename");\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { cwd: "bash -c is a directory" });\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'import { win32 } from "node:path";\n'
            'readFileSync(win32.join("/", "tmp", "reviewer"));\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            "readFileSync(" + "(" * 65 + '"/tmp/reviewer"' + ")" * 65 + ");\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'false && spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'true || spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'false ? spawnSync("node", [], options) : undefined;\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const options = { shell: false, cwd: "portable" };\n'
            "options.cwd = false && (options.shell = true);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'const options = { shell: true, cwd: "portable" };\n'
            "({ shell: options.shell, cwd: options.cwd } =\n"
            '  { shell: false, cwd: "portable" });\n'
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "do {\n"
            "  continue;\n"
            "  options.shell = true;\n"
            "} while (false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "switch (1) {\n"
            "  case 0: options.shell = false; break;\n"
            '  case 1: spawnSync("node", [], options); break;\n'
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'options.shell = Boolean(spawnSync("node", [], options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function holder(value: object): { value: number };\n"
            "const options = { shell: true };\n"
            "holder(options).value = 0;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const value = {\n"
            "  before: false && (options.shell = true),\n"
            '  sink: spawnSync("node", [], options),\n'
            "};\n"
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const value = ({\n"
            "  before: false && (options.shell = true),\n"
            '  sink: spawnSync("node", [], options),\n'
            "}).sink;\n"
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function consume(...values: unknown[]): void;\n"
            "const options = { shell: false };\n"
            "consume(...[false && (options.shell = true)]);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function tag(parts: TemplateStringsArray, "
            "...values: unknown[]): unknown;\n"
            "const options = { shell: false };\n"
            "const value = tag`${false && (options.shell = true)}"
            '${spawnSync("node", [], options)}`;\n'
            "void value;\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare function tag(parts: TemplateStringsArray, "
            "...values: unknown[]): unknown;\n"
            "const options = { shell: false };\n"
            "const value = tag`${false && (options.shell = true)}`;\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "(null as ((value: unknown) => unknown) | null)?.(\n"
            '  spawnSync("node", [], options)\n'
            ");\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "(null as { run(value: unknown): unknown } | null)?.run(\n"
            '  spawnSync("node", [], options)\n'
            ");\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const target = null as { run(value: unknown): unknown } | null;\n"
            "target?.run(false && (options.shell = true));\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'const run = () => spawnSync("node", [], options);\n'
            "options.shell = false;\n"
            "run();\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'const run = () => spawnSync("node", [], options);\n'
            "options.shell = true;\n"
            "run();\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const runner = {\n"
            '  run() { spawnSync("node", [], options); },\n'
            "};\n"
            "options.shell = false;\n"
            "runner.run();\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "(null as Record<string, unknown> | null)?.[\n"
            '  spawnSync("node", [], options) as unknown as string\n'
            "];\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const value = (null as Record<string, unknown> | null)?.[\n"
            "  false && (options.shell = true) as unknown as string\n"
            "];\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const { value = (options.shell = false) } = {};\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const { value = (options.shell = true) } = {};\n"
            "void value;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "(null as { child?: { run(value: unknown): unknown } } | null)\n"
            '  ?.child?.run(spawnSync("node", [], options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const root = null as "
            "{ child?: { run(value: unknown): unknown } } | null;\n"
            "root?.child?.run(false && (options.shell = true));\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const root = null as { child?: (value: unknown) => unknown } | null;\n"
            'root?.child?.(spawnSync("node", [], options));\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const root = null as { child?: (value: unknown) => unknown } | null;\n"
            "root?.child?.(false && (options.shell = true));\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "const root = null as { child?: Record<string, unknown> } | null;\n"
            'root?.child?.[spawnSync("node", [], options) as unknown as string];\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "const root = null as { child?: Record<string, unknown> } | null;\n"
            "root?.child?.[false && (options.shell = true) as unknown as string];\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'const root = "live" as unknown as '
            "{ child?: (value: unknown) => unknown };\n"
            "root?.child?.(options.shell = false);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'const root = "live" as unknown as { child?: Record<string, unknown> };\n'
            "root?.child?.[(options.shell = false) as unknown as string];\n"
            'spawnSync("node", [], options);\n'
        ),
    ],
    ids=[
        "same-declaration-final-false",
        "unreachable-logical-shell-write",
        "statically-zero-iteration-loop",
        "unsupported-destructuring-invalidates-true",
        "unsupported-destructuring-invalidates-false",
        "same-declaration-alias-escape",
        "closure-capture-invalidates-state",
        "filesystem-path-does-not-use-wrapper-classifier",
        "cwd-path-does-not-use-wrapper-classifier",
        "esm-win32-path-flavor-is-unknown",
        "over-depth-operational-path-is-unknown",
        "unreachable-and-sink",
        "unreachable-or-sink",
        "unreachable-conditional-sink",
        "nested-unreachable-shell-write",
        "multi-property-destructuring-invalidates-all",
        "continue-skips-shell-true-write",
        "unsupported-switch-sink-is-unknown",
        "sink-in-assignment-rhs-does-not-see-later-write",
        "assignment-lhs-base-alias-escape",
        "object-container-sink-skips-unreachable-true-write",
        "property-wrapper-sink-skips-unreachable-true-write",
        "spread-argument-skips-unreachable-true-write",
        "tagged-template-sink-skips-unreachable-true-write",
        "tagged-template-before-sink-skips-unreachable-true-write",
        "optional-call-null-callee-skips-sink",
        "optional-method-null-base-skips-sink-argument",
        "optional-method-null-base-skips-true-write-before-later-sink",
        "captured-options-at-arrow-sink-are-unknown-after-false-write",
        "captured-options-at-arrow-sink-are-unknown-after-true-write",
        "captured-options-at-method-sink-are-unknown",
        "optional-element-null-base-skips-sink",
        "optional-element-null-base-skips-true-write-before-later-sink",
        "unsupported-binding-default-invalidates-true",
        "unsupported-binding-default-invalidates-false",
        "multi-link-optional-chain-null-root-skips-sink",
        "multi-link-optional-chain-null-root-skips-later-write",
        "multi-link-direct-optional-call-null-root-skips-sink",
        "multi-link-direct-optional-call-null-root-skips-later-write",
        "multi-link-direct-optional-element-null-root-skips-sink",
        "multi-link-direct-optional-element-null-root-skips-later-write",
        "multi-link-optional-call-unknown-intermediate-stays-false",
        "multi-link-optional-element-unknown-intermediate-stays-false",
    ],
)
def test_third_correction_reviewed_boundary_controls_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "reviewed-boundary-control.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


def test_third_correction_commonjs_posix_path_flavor_fails(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "posix-path-flavor.cts").write_text(
        'const { readFileSync } = require("node:fs");\n'
        'const { posix } = require("node:path");\n'
        'readFileSync(posix.resolve("/", "tmp", "reviewer"));\n',
        encoding="utf-8",
    )
    assert "PORT-SRC-008" in rules_of(policy_repo)


def test_third_correction_commonjs_win32_path_flavor_is_unknown(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "win32-path-flavor.cts").write_text(
        'const { readFileSync } = require("node:fs");\n'
        'const { win32 } = require("node:path");\n'
        'readFileSync(win32.resolve("/", "tmp", "reviewer"));\n',
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    ("source", "expected_detail"),
    [
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: true };\n"
                'spawnSync("node", [], true ? options : { shell: false });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const choose: boolean;\n"
                "const options = { shell: true };\n"
                'spawnSync("node", [], choose ? options : { shell: false });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "for (let i = 0; i < 2; i += 1) {\n"
                '  spawnSync("node", ["--version"], options);\n'
                "  options.shell = true;\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "for (let i = 0; i < 4; i += 1) {\n"
                '  spawnSync("node", ["--version"], options);\n'
                "  options.shell = true;\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("node", [], { shell: "bash" });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("bash", ["-c", "printf ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("/opt/homebrew/bin/bash", ["-c", "printf ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { default as path } from "node:path";\n'
                'import { readFileSync } from "node:fs";\n'
                'readFileSync(path.join("/", "tmp", "x"));\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            'import { default as fs } from "node:fs";\nfs.readFileSync("/tmp/x");\n',
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { default as childProcess } from "node:child_process";\n'
                'childProcess.spawnSync("node", [], { shell: true });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import fs, { realpathSync } from "node:fs";\n'
                'fs.realpathSync.native("/tmp/x");\n'
                'realpathSync.native("/tmp/y");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import fs from "node:fs";\n'
                'import fsp from "node:fs/promises";\n'
                'fs.mkdtempDisposableSync("/tmp/sync-");\n'
                'void fsp.mkdtempDisposable("/tmp/async-");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        # Additional semantic cases, distributed across all five abstractions.
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: true };\n"
                'spawnSync("node", [], (void 0, options));\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: true };\n"
                'spawnSync("node", [], true && options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: true };\n"
                "declare const empty: null;\n"
                'spawnSync("node", [], empty ?? options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: true };\n"
                "const selected = true ? options : { shell: false };\n"
                'spawnSync("node", [], selected);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "for (let i = 0; i < 2; options.shell = true, i += 1) {\n"
                '  spawnSync("node", [], options);\n'
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "for (let i = 0; i < 2; i += 1) {\n"
                '  spawnSync("node", [], options);\n'
                "  options.shell = true;\n"
                "  continue;\n"
                "  options.shell = false;\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            # The proved enabled reference is established FIRST and must
            # survive seventy later conditional merges; a widening or
            # reference cap that erases old references loses it.
            'import { spawnSync } from "node:child_process";\n'
            "declare const "
            + ", ".join(f"c{index}: boolean" for index in range(70))
            + ";\n"
            + "const options = { shell: true };\n"
            + "".join(f"if (c{index}) options.shell = false;\n" for index in range(70))
            + 'spawnSync("node", [], options);\n',
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("C:\\\\tools\\\\bash.exe", ["-lc", "printf ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -lc'",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'execSync("printf ready", { shell: false as unknown as string });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { default as process } from "node:process";\n'
                'process.report.writeReport("/tmp/report.json");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import fs from "node:fs";\n'
                'void fs.promises.mkdtempDisposable("/tmp/nested-");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { default as fsp } from "node:fs/promises";\n'
                'void fsp.realpath("/tmp/default-as");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                'for (const step of ["first", "second"]) {\n'
                '  spawnSync("node", [String(step)], options);\n'
                "  options.shell = true;\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "const record = { first: 1, second: 2 };\n"
                "for (const key in record) {\n"
                '  spawnSync("node", [key], options);\n'
                "  options.shell = true;\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "async function run(items: AsyncIterable<string>): Promise<void> {\n"
                "  const options = { shell: false };\n"
                "  for await (const item of items) {\n"
                '    spawnSync("node", [item], options);\n'
                "    options.shell = true;\n"
                "  }\n"
                "}\n"
                "void run;\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import process from "node:process";\n'
                'process.execve?.("bash", ["bash", "-c", "printf ready"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { execFile } from "node:child_process";\n'
                'execFile("printf hi", { shell: "/bin/bash" }, () => {});\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("sh", ["-lc", "printf ready"]);\n'
            ),
            "Bash-only wrapper literal 'sh -lc'",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'execSync("sh -lc ./run-all");\n'
            ),
            "Bash-only wrapper literal 'sh -lc'",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const rest: string[];\n"
                'spawnSync("bash", ["-c", "printf ok", ...rest]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const rest: string[];\n"
                'spawnSync("cp", ["/tmp/source", ...rest]);\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { exec } from "node:child_process";\n'
                'exec("printf ok", undefined, () => {});\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { exec } from "node:child_process";\n'
                'exec("printf ok", null, () => {});\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'execSync("printf ok", { shell: undefined });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { exec } from "node:child_process";\n'
                "export function run(\n"
                "  callback: (error: Error | null) => void,\n"
                "): void {\n"
                '  exec("printf ok", callback);\n'
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options = { shell: false };\n"
                "let redo = true;\n"
                "for (let i = 0; i < 1; i += 1) {\n"
                '  spawnSync("node", [], options);\n'
                "  options.shell = true;\n"
                "  if (redo) {\n"
                "    redo = false;\n"
                "    i -= 1;\n"
                "  }\n"
                "}\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'const options: { shell?: string } = { shell: "" };\n'
                "delete options.shell;\n"
                'execSync("printf ready", options);\n'
            ),
            "child-process shell mode",
        ),
        (
            'process.chdir("/tmp");\n',
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                "async function run(): Promise<void> {\n"
                '  const { execSync } = await import("node:child_process");\n'
                '  execSync("printf ok");\n'
                "}\n"
                "void run;\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                "async function run(): Promise<void> {\n"
                '  const cp = await import("node:child_process");\n'
                '  cp.spawnSync("node", [], { shell: true });\n'
                "}\n"
                "void run;\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import process from "node:process";\n'
                'process.getBuiltinModule("node:fs").rmSync("/tmp/x");\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
        (
            (
                'import { join } from "node:path/posix";\n'
                'import { rmSync } from "node:fs";\n'
                'rmSync(join("/", "tmp", "sub"));\n'
            ),
            "hard-coded POSIX system path '/tmp'",
        ),
    ],
    ids=[
        "p1-known-true-conditional-options",
        "p2-unknown-conditional-options",
        "p3-second-iteration",
        "p4-later-iteration",
        "p5-string-shell",
        "p6-bare-bash-c",
        "p7-absolute-bash-c",
        "p8-default-as-path",
        "p9-default-as-fs",
        "p10-default-as-child-process",
        "p11-realpath-sync-native",
        "p12-disposable-temp-surfaces",
        "extra-comma-options",
        "extra-logical-and-options",
        "extra-nullish-options",
        "extra-const-selector-alias",
        "extra-loop-incrementor-mutation",
        "extra-loop-continue-skips-reset",
        "extra-state-cap-preserves-violation",
        "extra-windows-bash-executable",
        "extra-exec-false-still-shell",
        "extra-process-report-path",
        "extra-fs-promises-namespace",
        "extra-default-as-fs-promises",
        "extra-forof-second-iteration",
        "extra-forin-second-iteration",
        "extra-forawait-second-iteration",
        "extra-execve-bash-wrapper",
        "extra-execfile-options-callback",
        "extra-sh-lc-tuple",
        "extra-sh-lc-string",
        "extra-spread-tail-wrapper",
        "extra-spread-tail-path",
        "extra-exec-undefined-options",
        "extra-exec-null-options",
        "extra-execsync-shell-undefined",
        "extra-exec-callback-parameter",
        "extra-exact-loop-body-mutation",
        "extra-delete-shell-exec-default",
        "extra-global-process-chdir",
        "extra-dynamic-import-destructure",
        "extra-dynamic-import-namespace",
        "extra-get-builtin-module",
        "extra-path-posix-submodule",
    ],
)
def test_fourth_correction_semantic_violations_fail(
    policy_repo: Path, source: str, expected_detail: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fourth-correction-violation.ts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008" and expected_detail in violation.message
        for violation in violations
    )


@pytest.mark.parametrize(
    "source",
    [
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            'spawnSync("node", [], false ? options : { shell: false });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "for (let i = 0; i < 3; i += 1) {\n"
            "  options.shell = false;\n"
            '  spawnSync("node", [], options);\n'
            "  options.shell = true;\n"
            "}\n"
        ),
        (
            'import { execFileSync } from "node:child_process";\n'
            'execFileSync("printf", ["bash -c is inert argv data"]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("printf", ["documentation mentions bash -lc"]);\n'
        ),
        (
            'import path from "node:path";\n'
            'import { readFileSync } from "node:fs";\n'
            "type Tools = { join(...segments: string[]): string };\n"
            "const augmentedPath = path as typeof path & { tools: Tools };\n"
            'augmentedPath.tools = { join: (...segments) => segments.join("/") };\n'
            'readFileSync(augmentedPath.tools.join("/", "tmp", "x"));\n'
        ),
        (
            'import * as path from "node:path";\n'
            'import { readFileSync } from "node:fs";\n'
            'const tools = { join: (...parts: string[]) => parts.join("/") };\n'
            'readFileSync(tools.join("/", "tmp", "x"));\n'
            "void path;\n"
        ),
        (
            'import { writeFileSync } from "node:fs";\n'
            'writeFileSync("portable.txt", "/tmp is payload data");\n'
        ),
        (
            'import { readFileSync } from "node:fs";\n'
            'readFileSync("fixtures/example.txt");\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { shell: false });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { shell: "" });\n'
        ),
        # Paired controls for the new loop/invocation/provenance boundaries.
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "for (let i = 0; i < 1; i += 1) {\n"
            '  spawnSync("node", [], options);\n'
            "  options.shell = true;\n"
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "for (let i = 0; i < 2; i += 1) {\n"
            "  if (true) continue;\n"
            "  options.shell = true;\n"
            '  spawnSync("node", [], options);\n'
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "for (let i = 0; i < 2; i += 1) {\n"
            '  spawnSync("node", [], options);\n'
            "  options.shell = true;\n"
            "  break;\n"
            "}\n"
        ),
        (
            'import { fork } from "node:child_process";\n'
            'fork("worker.js", [], { shell: true } as unknown as '
            "Parameters<typeof fork>[2]);\n"
        ),
        (
            'import { execSync } from "node:child_process";\n'
            'execSync("printf ready", { shell: "" });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const shell: boolean | string;\n"
            'spawnSync("node", [], { shell });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("/opt/homebrew/bin/bash", ["-client"]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'for (const step of ["first", "second"]) {\n'
            "  options.shell = false;\n"
            '  spawnSync("node", [String(step)], options);\n'
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            'for (const step of ["first", "second"]) {\n'
            '  spawnSync("node", [String(step)], options);\n'
            "  options.shell = true;\n"
            "  break;\n"
            "}\n"
        ),
        (
            'import process from "node:process";\n'
            'process.execve?.("printf", ["printf", "bash -c stays inert data"]);\n'
        ),
        ('import process from "node:process";\nprocess.execve?.("bash", ["-c"]);\n'),
        (
            'import path from "node:path";\n'
            'import { readFileSync } from "node:fs";\n'
            'declare module "path" {\n'
            "  interface PlatformPath {\n"
            "    tools?: { join(...parts: string[]): string };\n"
            "  }\n"
            "}\n"
            'readFileSync(path.tools!.join("/", "tmp", "x"));\n'
        ),
        (
            'import { execFile } from "node:child_process";\n'
            'execFile("printf", ["ready"], () => {});\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("sh", ["-client"]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const rest: string[];\n"
            'spawnSync("bash", [...rest]);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("node", [], { shell: undefined });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "let redo = true;\n"
            "for (let i = 0; i < 1; i += 1) {\n"
            "  options.shell = false;\n"
            '  spawnSync("node", [], options);\n'
            "  if (redo) {\n"
            "    redo = false;\n"
            "    i -= 1;\n"
            "  }\n"
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options: { shell?: boolean } = { shell: true };\n"
            "delete options.shell;\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: true };\n"
            "for (const step of []) {\n"
            '  spawnSync("node", [String(step)], options);\n'
            "}\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "const options = { shell: false };\n"
            "let counter = 0;\n"
            "for (let a = 0; a < 128; a += 1) {\n"
            "  for (let b = 0; b < 128; b += 1) {\n"
            "    for (let c = 0; c < 128; c += 1) {\n"
            "      for (let d = 0; d < 128; d += 1) {\n"
            "        counter += 1;\n"
            "      }\n"
            "    }\n"
            "  }\n"
            "}\n"
            'spawnSync("node", [String(counter)], options);\n'
        ),
        (
            "export {};\n"
            "const process = {\n"
            "  chdir(target: string): void {\n"
            "    void target;\n"
            "  },\n"
            "};\n"
            'process.chdir("/tmp");\n'
        ),
        (
            "async function run(): Promise<void> {\n"
            '  const os = await import("node:os");\n'
            "  void os.tmpdir();\n"
            "}\n"
            "void run;\n"
        ),
        (
            'import { join } from "node:path/win32";\n'
            'import { readFileSync } from "node:fs";\n'
            'readFileSync(join("/", "tmp", "x"));\n'
        ),
    ],
    ids=[
        "n1-known-false-conditional-options",
        "n2-reset-before-every-sink",
        "n3-exec-file-inert-argv",
        "n4-spawn-inert-prose",
        "n5-augmented-path-terminates-provenance",
        "n6-local-shadowed-member",
        "n7-payload-path-text",
        "n8-relative-fs-path",
        "n9-shell-false",
        "n10-empty-shell-selector",
        "extra-statically-one-iteration",
        "extra-continue-skips-violation",
        "extra-break-prevents-backedge",
        "extra-fork-forces-shell-off",
        "extra-exec-empty-selector",
        "extra-dynamic-shell-unknown",
        "extra-bash-client-lookalike",
        "extra-forof-reset-before-sink",
        "extra-forof-break-prevents-backedge",
        "extra-execve-inert-argv",
        "extra-execve-argv0-slot-only",
        "extra-augmented-module-member-terminates",
        "extra-execfile-args-callback",
        "extra-sh-client-lookalike",
        "extra-spread-only-dynamic",
        "extra-spawn-shell-undefined",
        "extra-exact-loop-reset-body-mutation",
        "extra-delete-shell-spawnsync",
        "extra-forof-empty-literal-dead",
        "extra-nested-exact-loop-budget",
        "extra-global-process-shadowed",
        "extra-dynamic-import-unknown-module",
        "extra-path-win32-submodule",
    ],
)
def test_fourth_correction_semantic_controls_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fourth-correction-control.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


def test_fourth_correction_namespace_default_member_semantics(
    policy_repo: Path, tmp_path: Path
) -> None:
    # At runtime the ESM namespace object exposes the module itself as
    # `default`, but the pinned compiler types no synthetic `default` member
    # for CJS builtins, so the surface is unreachable in compiling code
    # without a provenance-terminating cast. The checker still flags it as
    # defense-in-depth; both facts are pinned here, which is why this fixture
    # is not part of the compile-clean fixture batch.
    source = (
        'import * as cpns from "node:child_process";\n'
        'cpns.default.execSync("printf ok");\n'
    )
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "namespace-default.mts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008"
        and "child-process shell mode" in violation.message
        for violation in violations
    )
    fixture = tmp_path / "namespace-default.mts"
    fixture.write_text(source, encoding="utf-8")
    # Resolve pnpm through PATH/PATHEXT so the Windows .cmd shim spawns.
    pnpm_executable = portability.host_resolve_executable("pnpm")
    assert pnpm_executable is not None
    proc = subprocess.run(
        (
            pnpm_executable,
            "exec",
            "tsc",
            "--ignoreConfig",
            "--noEmit",
            "--target",
            "ES2024",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--types",
            "node",
            "--typeRoots",
            str(REPO_ROOT / "node_modules" / "@types"),
            "--esModuleInterop",
            str(fixture),
        ),
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode != 0
    assert "TS2339" in proc.stdout


def test_node24_operational_catalog_is_complete_against_pinned_declarations() -> None:
    proc = subprocess.run(
        (
            "node",
            str(REPO_ROOT / "scripts" / "check_typescript_portability.mjs"),
            "--verify-node-catalog",
        ),
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout)
    assert result == {
        "node": "24.18.0",
        "types_node": "24.13.3",
        "typescript": "6.0.3",
        "modules": [
            "child-process",
            "filesystem",
            "filesystem-promises",
            "path",
            "path-posix",
            "path-win32",
            "process",
        ],
    }


def test_fourth_correction_typescript_fixtures_compile(
    tmp_path: Path,
) -> None:
    violation_mark = next(
        mark
        for mark in cast(
            "Any", test_fourth_correction_semantic_violations_fail
        ).pytestmark
        if mark.name == "parametrize"
    )
    control_mark = next(
        mark
        for mark in cast(
            "Any", test_fourth_correction_semantic_controls_pass
        ).pytestmark
        if mark.name == "parametrize"
    )
    sources = [case[0] for case in violation_mark.args[1]] + list(control_mark.args[1])
    names = []
    for index, source in enumerate(sources):
        name = f"fourth-correction-{index}.ts"
        (tmp_path / name).write_text(source, encoding="utf-8")
        names.append(name)
    # Run the pinned tsc entry script through node with short relative names
    # from the fixture directory: no .cmd shim and no cmd.exe command-line
    # length limit on Windows.
    proc = subprocess.run(
        (
            "node",
            str(REPO_ROOT / "node_modules" / "typescript" / "bin" / "tsc"),
            "--ignoreConfig",
            "--noEmit",
            "--target",
            "ES2024",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--types",
            "node",
            "--typeRoots",
            str(REPO_ROOT / "node_modules" / "@types"),
            "--esModuleInterop",
            *names,
        ),
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


# ---------------------------------------------- fifth correction (KI-0058)

# Exact independent-verifier reproducer: the proved second-iteration
# shell:true violation must survive analysis-budget exhaustion.
FIFTH_CORRECTION_BUDGET_REPRODUCER = (
    'import { spawnSync } from "node:child_process";\n'
    "\n"
    "const options: { shell?: boolean } = { shell: false };\n"
    "\n"
    "for (let i = 0; i < 4; i += 1)\n"
    "  for (let j = 0; j < 4; j += 1)\n"
    "    for (let k = 0; k < 4; k += 1) {\n"
    '      spawnSync("node", ["-v"], options);\n'
    "      options.shell = true;\n"
    "    }\n"
)

FIFTH_BUDGET_DETAIL = "bounded TypeScript option-object analysis"
FIFTH_SHELL_DETAIL = "child-process shell mode"


def fifth_nested_shell_loop(bound: int, body_value: str = "true") -> str:
    return (
        'import { spawnSync } from "node:child_process";\n'
        "const options: { shell?: boolean } = { shell: false };\n"
        f"for (let i = 0; i < {bound}; i += 1)\n"
        f"  for (let j = 0; j < {bound}; j += 1)\n"
        f"    for (let k = 0; k < {bound}; k += 1) {{\n"
        '      spawnSync("node", ["-v"], options);\n'
        f"      options.shell = {body_value};\n"
        "    }\n"
    )


@pytest.mark.parametrize(
    ("source", "required_details", "absent_details"),
    [
        (
            FIFTH_CORRECTION_BUDGET_REPRODUCER,
            (FIFTH_SHELL_DETAIL, FIFTH_BUDGET_DETAIL),
            (),
        ),
        (
            fifth_nested_shell_loop(6),
            (FIFTH_SHELL_DETAIL, FIFTH_BUDGET_DETAIL),
            (),
        ),
        (
            fifth_nested_shell_loop(3),
            (FIFTH_SHELL_DETAIL,),
            (FIFTH_BUDGET_DETAIL,),
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "const options: { shell?: boolean } = { shell: false };\n"
                "for (let i = 0; i < 4; i += 1)\n"
                "  for (let j = 0; j < 4; j += 1)\n"
                "    for (let k = 0; k < 4; k += 1) {\n"
                "      options.shell = true;\n"
                "    }\n"
                'spawnSync("node", ["-v"], options);\n'
            ),
            (FIFTH_SHELL_DETAIL,),
            (FIFTH_BUDGET_DETAIL,),
        ),
        (
            fifth_nested_shell_loop(4, body_value="false"),
            (FIFTH_BUDGET_DETAIL,),
            (FIFTH_SHELL_DETAIL,),
        ),
    ],
    ids=[
        "a1-a7-exact-verifier-4x4x4-proved-violation-survives-exhaustion",
        "a2-6x6x6-beyond-threshold-no-fixture-specific-budget-raise",
        "a3-3x3x3-under-budget-concrete-finding-only",
        "a4-4x4x4-sink-after-loops-under-budget",
        "a6-overbudget-clean-explicit-bounded-result-not-silent-success",
    ],
)
def test_fifth_correction_budget_monotonicity_findings(
    policy_repo: Path,
    source: str,
    required_details: tuple[str, ...],
    absent_details: tuple[str, ...],
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fifth-correction-budget.ts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert {violation.rule for violation in violations} == {"PORT-SRC-008"}
    messages = [violation.message for violation in violations]
    for detail in required_details:
        assert any(detail in message for message in messages), detail
    for detail in absent_details:
        assert not any(detail in message for message in messages), detail


def test_fifth_correction_overbudget_analysis_is_deterministic(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fifth-correction-determinism.ts").write_text(
        FIFTH_CORRECTION_BUDGET_REPRODUCER, encoding="utf-8"
    )
    first = [
        (violation.rule, violation.location, violation.message)
        for violation in check_portability.run_checks(policy_repo)
    ]
    second = [
        (violation.rule, violation.location, violation.message)
        for violation in check_portability.run_checks(policy_repo)
    ]
    assert first
    assert first == second


@pytest.mark.parametrize(
    "source",
    [
        (
            'import fs from "node:fs";\n'
            "\n"
            "export const stream =\n"
            '  new fs.Utf8Stream({ dest: "/tmp/parkf-utf8" });\n'
        ),
        (
            'import * as fs from "node:fs";\n'
            'export const stream = new fs.Utf8Stream({ dest: "/tmp/x" });\n'
        ),
        (
            'import { Utf8Stream } from "node:fs";\n'
            'export const stream = new Utf8Stream({ dest: "/tmp/x" });\n'
        ),
        (
            'import { Utf8Stream as TextSink } from "node:fs";\n'
            'export const stream = new TextSink({ dest: "/tmp/x" });\n'
        ),
        (
            'import fs from "node:fs";\n'
            'const options = { dest: "/tmp/x" };\n'
            "export const stream = new fs.Utf8Stream(options);\n"
        ),
    ],
    ids=[
        "b1-exact-verifier-default-import-literal",
        "b2-namespace-import",
        "b3-named-import",
        "b4-renamed-named-import",
        "b5-tracked-const-options-object",
    ],
)
def test_fifth_correction_utf8stream_constructor_violations_fail(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fifth-correction-utf8stream.ts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008"
        and "hard-coded POSIX system path '/tmp'" in violation.message
        for violation in violations
    )


@pytest.mark.parametrize(
    ("source", "expected_detail"),
    [
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const again: boolean;\n"
                "const options = { shell: false };\n"
                "do {\n"
                '  spawnSync("node", [], options);\n'
                "  options.shell = true;\n"
                "} while (again);\n"
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                "declare const cond: boolean;\n"
                'const options: { shell?: string } = { shell: "" };\n'
                "if (cond) delete options.shell;\n"
                'execSync("printf ok", options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const guard: boolean;\n"
                "const options = { shell: true };\n"
                'guard && spawnSync("node", [], options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const guard: boolean;\n"
                "const options = { shell: true };\n"
                'guard || spawnSync("node", [], options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                "declare const stop: boolean;\n"
                "const options = { shell: false };\n"
                "while (true) {\n"
                "  options.shell = true;\n"
                "  if (stop) break;\n"
                "  options.shell = false;\n"
                "}\n"
                'spawnSync("node", [], options);\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { execSync } from "node:child_process";\n'
                'execSync("printf ok", { shell: "pwsh" });\n'
            ),
            "child-process shell mode",
        ),
        (
            (
                'import { spawnSync } from "node:child_process";\n'
                'spawnSync("C:\\\\tools\\\\BASH.EXE", ["-c", "printf ok"]);\n'
            ),
            "Bash-only wrapper literal 'bash -c'",
        ),
        (
            (
                'import process from "node:process";\n'
                'process.chdir("/var/lib/example");\n'
            ),
            "hard-coded POSIX system path '/var'",
        ),
        (
            # At the pinned runtime `new spawnSync(...)` still executes the
            # function body, so reviewed callables stay sinks under `new`
            # (reviewer-reproduced fifth-correction regression pin).
            (
                'import { spawnSync } from "node:child_process";\n'
                "export const result = new (spawnSync as unknown as new (\n"
                "  command: string,\n"
                "  argv: string[],\n"
                "  options: { shell: boolean },\n"
                ') => object)("node", ["-v"], { shell: true });\n'
            ),
            "child-process shell mode",
        ),
    ],
    ids=[
        "s1-dowhile-unknown-condition-second-iteration",
        "s2-conditional-delete-maybeabsent-exec-default",
        "s3-unknown-and-guarded-sink",
        "s3-unknown-or-guarded-sink",
        "s4-break-only-exit-state",
        "s5-exec-nonempty-string-selector",
        "s6-uppercase-exe-basename-folding",
        "s7-absolute-process-chdir",
        "new-of-operational-callable-stays-a-sink",
    ],
)
def test_fifth_correction_regression_pins_fail(
    policy_repo: Path, source: str, expected_detail: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fifth-correction-pin.ts").write_text(source, encoding="utf-8")
    violations = check_portability.run_checks(policy_repo)
    assert any(
        violation.rule == "PORT-SRC-008" and expected_detail in violation.message
        for violation in violations
    )


@pytest.mark.parametrize(
    "source",
    [
        fifth_nested_shell_loop(3, body_value="false"),
        (
            'import fs from "node:fs";\n'
            'export const stream = new fs.Utf8Stream({ dest: "portable.txt" });\n'
        ),
        (
            "export {};\n"
            "class Utf8Stream {\n"
            "  constructor(options: { dest: string }) {\n"
            "    void options;\n"
            "  }\n"
            "}\n"
            'void new Utf8Stream({ dest: "/tmp/x" });\n'
        ),
        (
            'import fs from "node:fs";\n'
            "const helpers = fs as typeof fs & {\n"
            "  Utf8Stream: new (options: { dest: string }) => object;\n"
            "};\n"
            'void new helpers.Utf8Stream({ dest: "/tmp/x" });\n'
        ),
        (
            'import fs, { type Utf8StreamOptions } from "node:fs";\n'
            "const options: Utf8StreamOptions & { note: string } = {\n"
            '  dest: "portable.txt",\n'
            '  note: "/tmp/example",\n'
            "};\n"
            "export const stream = new fs.Utf8Stream(options);\n"
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const again: boolean;\n"
            "const options = { shell: true };\n"
            "do {\n"
            "  options.shell = false;\n"
            "} while (again);\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            "declare const stop: boolean;\n"
            "const options = { shell: false };\n"
            "while (true) {\n"
            "  options.shell = true;\n"
            "  options.shell = false;\n"
            "  if (stop) break;\n"
            "}\n"
            'spawnSync("node", [], options);\n'
        ),
        (
            'import { execSync } from "node:child_process";\n'
            'const selector = "";\n'
            'execSync("printf ok", { shell: selector });\n'
        ),
        (
            'import { spawnSync } from "node:child_process";\n'
            'spawnSync("BASHX.EXE", ["-c", "printf ok"]);\n'
        ),
        ('import process from "node:process";\nprocess.chdir("workspace/subdir");\n'),
    ],
    ids=[
        "a5-clean-3x3x3-near-boundary",
        "c1-portable-dest",
        "c2-local-shadowed-utf8stream-class",
        "c3-augmented-untrusted-member",
        "c4-non-dest-data-field",
        "s1-dowhile-body-runs-at-least-once",
        "s4-break-after-reset-is-clean",
        "s5-exec-empty-string-selector-alias",
        "s6-basename-lookalike-not-wrapper",
        "s7-relative-process-chdir",
    ],
)
def test_fifth_correction_semantic_controls_pass(
    policy_repo: Path, source: str
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "fifth-correction-control.ts").write_text(source, encoding="utf-8")
    assert rules_of(policy_repo) == set()


def run_catalog_validation(catalog_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        (
            "node",
            str(REPO_ROOT / "scripts" / "check_typescript_portability.mjs"),
            "--validate-catalog",
            str(catalog_path),
        ),
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


def test_fifth_correction_real_catalog_passes_validation_mode() -> None:
    proc = run_catalog_validation(
        REPO_ROOT / "scripts" / "typescript-portability-node24-catalog.v1.json"
    )
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout == "catalog ok"


def fifth_utf8stream_member(catalog: dict[str, Any]) -> dict[str, Any]:
    member = catalog["modules"]["filesystem"]["nodes"]["root"]["members"]["Utf8Stream"]
    assert isinstance(member, dict)
    return cast("dict[str, Any]", member)


def fifth_mutate_unknown_token(catalog: dict[str, Any]) -> None:
    fifth_utf8stream_member(catalog)["constructible"] = "mystery-token"


def fifth_mutate_missing_option_paths(catalog: dict[str, Any]) -> None:
    fifth_utf8stream_member(catalog).pop("option_paths")


def fifth_mutate_callable_conflict(catalog: dict[str, Any]) -> None:
    member = fifth_utf8stream_member(catalog)
    member["callable"] = "non-operational"
    member["rationale"] = "conflicting classification"


def fifth_mutate_unknown_role(catalog: dict[str, Any]) -> None:
    fifth_utf8stream_member(catalog)["roles"] = {"options": [0], "extra": [1]}


def fifth_mutate_missing_rationale(catalog: dict[str, Any]) -> None:
    members = catalog["modules"]["child-process"]["nodes"]["root"]["members"]
    members["ChildProcess"].pop("rationale")


@pytest.mark.parametrize(
    ("mutate", "expected_error"),
    [
        (
            fifth_mutate_unknown_token,
            "unknown constructible classification at filesystem.root.Utf8Stream",
        ),
        (
            fifth_mutate_missing_option_paths,
            "malformed constructor semantics at filesystem.root.Utf8Stream",
        ),
        (
            fifth_mutate_callable_conflict,
            "malformed constructor semantics at filesystem.root.Utf8Stream",
        ),
        (
            fifth_mutate_unknown_role,
            "unknown constructor role extra at filesystem.root.Utf8Stream",
        ),
        (
            fifth_mutate_missing_rationale,
            "missing non-operational rationale at child-process.root.ChildProcess",
        ),
    ],
    ids=[
        "s8-unknown-constructible-token",
        "s8-operational-constructor-missing-option-paths",
        "s8-operational-constructor-callable-conflict",
        "s8-unknown-constructor-role",
        "s8-non-operational-constructible-missing-rationale",
    ],
)
def test_fifth_correction_malformed_constructible_catalog_fails_closed(
    tmp_path: Path,
    mutate: Callable[[dict[str, Any]], None],
    expected_error: str,
) -> None:
    catalog = json.loads(
        (
            REPO_ROOT / "scripts" / "typescript-portability-node24-catalog.v1.json"
        ).read_text(encoding="utf-8")
    )
    assert isinstance(catalog, dict)
    mutate(catalog)
    target = tmp_path / "mutated-catalog.json"
    target.write_text(json.dumps(catalog), encoding="utf-8")
    proc = run_catalog_validation(target)
    assert proc.returncode != 0
    assert expected_error in proc.stderr


def test_fifth_correction_typescript_fixtures_compile(tmp_path: Path) -> None:
    sources: list[str] = []
    for test in (
        test_fifth_correction_budget_monotonicity_findings,
        test_fifth_correction_utf8stream_constructor_violations_fail,
        test_fifth_correction_regression_pins_fail,
        test_fifth_correction_semantic_controls_pass,
    ):
        mark = next(
            mark for mark in cast("Any", test).pytestmark if mark.name == "parametrize"
        )
        for case in mark.args[1]:
            sources.append(case[0] if isinstance(case, tuple) else case)
    names = []
    for index, source in enumerate(sources):
        name = f"fifth-correction-{index}.ts"
        (tmp_path / name).write_text(source, encoding="utf-8")
        names.append(name)
    proc = subprocess.run(
        (
            "node",
            str(REPO_ROOT / "node_modules" / "typescript" / "bin" / "tsc"),
            "--ignoreConfig",
            "--noEmit",
            "--target",
            "ES2024",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--types",
            "node",
            "--typeRoots",
            str(REPO_ROOT / "node_modules" / "@types"),
            "--esModuleInterop",
            *names,
        ),
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_typescript_declaration_files_are_not_runtime_sources(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "ambient.d.ts").write_text(
        'declare const path: "/tmp/type-only";\n', encoding="utf-8"
    )
    assert rules_of(policy_repo) == set()


def test_unparseable_typescript_runtime_source_fails_closed(
    policy_repo: Path,
) -> None:
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    (source_dir / "malformed.ts").write_text(
        "export const broken = { shell: true;\n", encoding="utf-8"
    )
    with pytest.raises(check_portability.PolicyError, match="not parseable TypeScript"):
        rules_of(policy_repo)


def test_unloadable_typescript_runtime_source_fails_closed(
    policy_repo: Path,
) -> None:
    missing = policy_repo / "apps" / "extension" / "src" / "missing.ts"
    with pytest.raises(
        check_portability.PolicyError, match="TypeScript portability parser failed"
    ):
        check_portability._check_ts_runtime_sources(policy_repo, [missing], [])


@pytest.mark.parametrize(
    "outcome",
    [
        (1, "", "helper crashed", "TypeScript portability parser failed"),
        (0, "not-json", "", "returned invalid JSON"),
        (0, '{"unexpected":true}', "", "returned a non-list result"),
        (0, '[{"path":"bad"}]', "", "returned a malformed finding"),
        (
            0,
            (
                '[{"path":"apps/extension/src/helper.ts","line":true,'
                '"kind":"posix-path","detail":"/tmp"}]'
            ),
            "",
            "returned a malformed finding",
        ),
    ],
    ids=[
        "helper-crash",
        "invalid-json",
        "non-list-json",
        "malformed-finding",
        "boolean-line-is-malformed",
    ],
)
def test_typescript_portability_helper_failures_fail_closed(
    policy_repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    outcome: tuple[int, str, str, str],
) -> None:
    returncode, stdout, stderr, message = outcome
    source_dir = policy_repo / "apps" / "extension" / "src"
    source_dir.mkdir(parents=True)
    source = source_dir / "helper.ts"
    source.write_text("export const value = 1;\n", encoding="utf-8")

    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess("node", returncode, stdout, stderr)

    monkeypatch.setattr("check_portability.subprocess.run", fake_run)
    with pytest.raises(check_portability.PolicyError, match=message):
        check_portability._check_ts_runtime_sources(policy_repo, [source], [])


def test_empty_typescript_surface_still_validates_helper_infrastructure(
    policy_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess("node", 1, "", "catalog unavailable")

    monkeypatch.setattr("check_portability.subprocess.run", fake_run)
    with pytest.raises(
        check_portability.PolicyError,
        match="TypeScript portability parser failed: catalog unavailable",
    ):
        check_portability._check_ts_runtime_sources(policy_repo, [], [])


def test_bash_only_package_script_fails(policy_repo: Path) -> None:
    manifest_path = policy_repo / "package.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["scripts"]["deploy"] = "bash scripts/deploy.sh"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    assert "PORT-SRC-007" in rules_of(policy_repo)


def test_env_prefix_package_script_fails(policy_repo: Path) -> None:
    manifest_path = policy_repo / "package.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["scripts"]["test:ci"] = "CI=1 vitest run"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    assert "PORT-SRC-007" in rules_of(policy_repo)


def test_bash_wrapper_registry_command_fails(policy_repo: Path) -> None:
    registry_path = policy_repo / "scripts" / "verification-suites.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    registry["suites"][0]["commands"] = [["bash", "-c", "true"]]
    registry_path.write_text(json.dumps(registry), encoding="utf-8")
    assert "PORT-SRC-008" in rules_of(policy_repo)


# ------------------------------------------------- false-positive guards


def test_harmless_workflow_comments_never_trigger_policy(policy_repo: Path) -> None:
    path = policy_repo / ".github" / "workflows" / "ci.yml"
    text = path.read_text(encoding="utf-8")
    text = (
        "# Documentation only: continue-on-error, || true, /tmp, "
        "https://example.invalid\n" + text
    )
    text = text.replace(
        "$ErrorActionPreference = 'Stop'",
        "$ErrorActionPreference = 'Stop' "
        "# docs: continue-on-error || true /tmp https://example.invalid",
        1,
    )
    text = text.replace(
        'test ! -e "$RUSTUP_HOME"',
        "# docs: continue-on-error || true /tmp https://example.invalid\n"
        '          test ! -e "$RUSTUP_HOME"',
        1,
    )
    text = text.replace(
        "        run: pnpm verify\n",
        "        run: pnpm verify # docs: continue-on-error || true /tmp "
        "https://example.invalid\n",
        1,
    )
    path.write_text(text, encoding="utf-8")
    assert rules_of(policy_repo) == set()


def test_harmless_pwsh_block_comment_never_triggers_policy(
    policy_repo: Path,
) -> None:
    data = load_workflow(policy_repo)
    pwsh_step = next(
        step
        for step in verify_job(data)["steps"]
        if step.get("shell") == "pwsh" and "run" in step
    )
    pwsh_step["run"] = (
        str(pwsh_step["run"])
        + "\n<# Documentation only:\n"
        + "continue-on-error || true /tmp https://example.invalid\n#>\n"
    )
    dump_workflow(policy_repo, data)
    assert rules_of(policy_repo) == set()


def test_documentation_prose_never_triggers_policy(policy_repo: Path) -> None:
    docs = policy_repo / "docs"
    docs.mkdir()
    (docs / "NOTES.md").write_text(
        "Historical prose: `bash -c`, `set -o pipefail`, /tmp, /usr/bin, "
        "C:\\Windows, and `continue-on-error` examples are documentation "
        "only.\n",
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


def test_test_fixture_literals_never_trigger_policy(policy_repo: Path) -> None:
    tests_dir = policy_repo / "scripts" / "tests"
    tests_dir.mkdir()
    (tests_dir / "test_fixture.py").write_text(
        'BAD = "/tmp/fixture"\nWRAP = "bash -c true"\n', encoding="utf-8"
    )
    assert rules_of(policy_repo) == set()


def test_comments_in_runtime_scripts_never_trigger_policy(
    policy_repo: Path,
) -> None:
    (policy_repo / "scripts" / "commented_helper.py").write_text(
        '# Never hard-code /tmp, /bin/bash, bash -c, or base + "/" + name.\n'
        "VALUE = 1\n",
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


@pytest.mark.parametrize(
    "source",
    [
        '"""/tmp/example, bash -c, and base + "/" + name are docs."""\nVALUE = 1\n',
        (
            "class Helper:\n"
            '    """/tmp/example, bash -c, and base + "/" + name are docs."""\n'
            "    value = 1\n"
        ),
        (
            "def helper() -> int:\n"
            '    """/tmp/example, bash -c, and base + "/" + name are docs."""\n'
            "    return 1\n"
        ),
        (
            "async def helper() -> int:\n"
            '    """/tmp/example, bash -c, and base + "/" + name are docs."""\n'
            "    return 1\n"
        ),
    ],
)
def test_runtime_docstrings_never_trigger_policy(
    policy_repo: Path, source: str
) -> None:
    (policy_repo / "scripts" / "documented_helper.py").write_text(
        source, encoding="utf-8"
    )
    assert rules_of(policy_repo) == set()


def test_type_metadata_literals_never_trigger_runtime_policy(
    policy_repo: Path,
) -> None:
    (policy_repo / "scripts" / "typed_helper.py").write_text(
        "from typing import Literal\n\n"
        'type SystemPath = Literal["/tmp/example", "/usr/bin", "/"]\n'
        'PathKind = Literal["/tmp/cache", "/var/log"]\n'
        'def inspect(path: "/etc/hosts") -> Literal["/var/log"]:\n'
        "    return path\n",
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


def test_url_literals_never_trigger_the_path_rule(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "url_helper.py").write_text(
        'DOCS = "https://example.invalid/usr/guide#/tmp"\n', encoding="utf-8"
    )
    assert rules_of(policy_repo) == set()
