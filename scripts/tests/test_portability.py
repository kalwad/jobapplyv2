"""Tests for scripts/portability.py and scripts/check_portability.py (M00-W09).

Windows executable-resolution semantics are exercised through injected
platform flavor, PATH entries, PATHEXT, and existence probes, so they run
identically on macOS, Windows, and Ubuntu hosts. Policy-checker negatives
mutate an isolated fixture repository built from the real workflow/config
files; nothing here touches the developer's machine or the real repository.
"""

from __future__ import annotations

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


def test_guarded_canonical_verify_fails_as_weaker_windows_set(
    policy_repo: Path,
) -> None:
    data = load_workflow(policy_repo)
    step_by_run(data, "pnpm verify")["if"] = "runner.os != 'Windows'"
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


def test_masked_child_failure_fails(policy_repo: Path) -> None:
    data = load_workflow(policy_repo)
    step = step_by_run(data, "pnpm run doctor")
    step["run"] = "pnpm run doctor || true"
    dump_workflow(policy_repo, data)
    assert "PORT-CI-008" in rules_of(policy_repo)


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
        "# The doctor never hard-codes /tmp, /bin/bash, or bash -c wrappers.\n"
        "VALUE = 1\n",
        encoding="utf-8",
    )
    assert rules_of(policy_repo) == set()


def test_url_literals_never_trigger_the_path_rule(policy_repo: Path) -> None:
    (policy_repo / "scripts" / "url_helper.py").write_text(
        'DOCS = "https://example.invalid/usr/guide#/tmp"\n', encoding="utf-8"
    )
    assert rules_of(policy_repo) == set()
