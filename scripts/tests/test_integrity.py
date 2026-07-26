"""Repository-integrity checks: no-ops, bypasses, focus/skip markers."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import verify
from conftest import GOOD_SCRIPTS, REPO_ROOT, make_suite, run_git, write_registry


def _registry() -> verify.Registry:
    return verify.Registry(suites=(), allowed_skips=())


def test_noop_script_detector() -> None:
    noops = (
        "",
        "true",
        ":",
        "exit 0",
        "echo",
        "echo done",
        "echo ok && true",
        "true && true",
        "exit 0 # done",
        "true; :",
    )
    for value in noops:
        assert verify._script_is_noop(value), value
    for value in GOOD_SCRIPTS.values():
        assert not verify._script_is_noop(value), value


def test_missing_required_root_script_fails(fixture_repo: verify.Context) -> None:
    scripts = dict(GOOD_SCRIPTS)
    del scripts["verify"]
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("required root script missing: 'verify'" in f for f in failures)


def test_traceability_commands_and_source_are_repository_integrity_requirements(
    fixture_repo: verify.Context,
) -> None:
    scripts = dict(GOOD_SCRIPTS)
    del scripts["traceability:check"]
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any(
        "required root script missing: 'traceability:check'" in f for f in failures
    )
    assert "docs/traceability.json" in verify.MEMORY_FILES
    assert "docs/PLATFORM_SUPPORT.md" in verify.MEMORY_FILES
    assert "docs/gates/CROSS_PLATFORM_CORE_GATE.md" in verify.MEMORY_FILES
    assert "docs/platform/MODEL_RUNTIME_PROFILES.md" in verify.MEMORY_FILES
    assert "scripts/traceability.py" in verify.REQUIRED_SCRIPT_FILES


def test_echo_only_script_rejected(fixture_repo: verify.Context) -> None:
    scripts = dict(GOOD_SCRIPTS)
    scripts["lint"] = "echo lint passed"
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("no-op" in f and "'lint'" in f for f in failures)


def test_pass_with_no_tests_bypass_rejected(fixture_repo: verify.Context) -> None:
    config = fixture_repo.repo / "vitest.config.ts"
    config.write_text(
        "export default { test: { " + "passWithNoTests" + ": true } };\n",
        encoding="utf-8",
    )
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add bypass")
    tracked = verify.git_tracked_files(fixture_repo)
    failures = verify.check_bypass_tokens(fixture_repo, tracked)
    assert any("vitest.config.ts" in f for f in failures)


def test_focused_and_skipped_ts_tests_rejected(fixture_repo: verify.Context) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    focused = "test" + '.only("focused", () => {});\n'
    spec.write_text(focused, encoding="utf-8")
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add focused test")
    failures = verify.check_focused_tests(fixture_repo, ())
    assert any("probe.spec.ts" in f for f in failures)


def test_focus_regex_matches_markers_but_not_lookalikes() -> None:
    assert verify.TS_FOCUS_RE.search("test.only(")
    assert verify.TS_FOCUS_RE.search("describe.skip (")
    assert verify.TS_FOCUS_RE.search("it.fixme(")
    assert verify.TS_FOCUS_RE.search("it.only.each([1, 2])(")
    assert verify.TS_FOCUS_RE.search("test.todo(")
    assert verify.TS_FOCUS_RE.search("bench.only(")
    assert not verify.TS_FOCUS_RE.search("monopoly(")
    assert not verify.TS_FOCUS_RE.search("const only = f(x)")
    assert not verify.TS_FOCUS_RE.search("skipped = testResults.only")
    skip_marker = "@pytest" + ".mark.skip"
    assert verify.PY_SKIP_RE.search(skip_marker)
    assert not verify.PY_SKIP_RE.search("skipped = compute()")


def test_missing_lockfile_and_memory_file_fail(fixture_repo: verify.Context) -> None:
    failures = verify.check_integrity(fixture_repo, _registry())
    assert any("pnpm-lock.yaml" in f for f in failures)
    assert any("MASTER_IMPLEMENTATION_SPEC" in f for f in failures)


def test_modified_tracked_file_during_verification_detected(
    fixture_repo: verify.Context,
) -> None:
    tracked_file = fixture_repo.repo / "package.json"
    mutate = [
        sys.executable,
        "-c",
        (
            "from pathlib import Path; "
            f"p = Path({str(tracked_file)!r}); "
            "p.write_text(p.read_text() + '\\n')"
        ),
    ]
    write_registry(fixture_repo.registry_path, [make_suite(commands=[mutate])])
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    neutral = [o for o in outcomes if o.suite.suite_id == "status-neutral"]
    assert neutral
    assert neutral[0].verdict is verify.Verdict.FAIL
    assert "changed during verification" in neutral[0].messages[0]


def test_status_validator_failure_propagates_through_runner(
    fixture_repo: verify.Context, tmp_path: Path
) -> None:
    corrupt = tmp_path / "corrupt_status.md"
    real_status = (REPO_ROOT / "docs/PROJECT_STATUS.md").read_text(encoding="utf-8")
    corrupt.write_text(
        real_status.replace("| `M03-W02` | NOT_STARTED |", "| `M03-W02` | DONE |"),
        encoding="utf-8",
    )
    status_cmd = [
        sys.executable,
        str(REPO_ROOT / "scripts/validate_status.py"),
        "--repo",
        str(REPO_ROOT),
        "--status",
        str(corrupt),
        "--quiet",
    ]
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="status", commands=[status_cmd])],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert outcomes[0].verdict is verify.Verdict.FAIL


def test_python_skip_marker_rejected_end_to_end(
    fixture_repo: verify.Context,
) -> None:
    probe = fixture_repo.repo / "services" / "orchestrator" / "tests" / "test_probe.py"
    probe.parent.mkdir(parents=True)
    marker = "@pytest" + ".mark.skip"
    probe.write_text(f"{marker}\ndef test_probe() -> None: ...\n", encoding="utf-8")
    failures = verify.check_focused_tests(fixture_repo, ())
    assert any("test_probe.py" in f for f in failures)


def test_workspace_package_noop_script_rejected(
    fixture_repo: verify.Context,
) -> None:
    (fixture_repo.repo / "pnpm-workspace.yaml").write_text(
        'packages:\n  - "pkgs/*"\n', encoding="utf-8"
    )
    member = fixture_repo.repo / "pkgs" / "a"
    member.mkdir(parents=True)
    (member / "package.json").write_text(
        json.dumps({"name": "@fixture/a", "scripts": {"typecheck": "true"}}),
        encoding="utf-8",
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("@fixture/a" in f and "no-op" in f for f in failures)
