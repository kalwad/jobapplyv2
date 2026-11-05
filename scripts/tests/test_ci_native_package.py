"""The optional native-package recipe cannot weaken canonical CI policy."""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import TypeGuard

import check_portability
import pytest
from test_ci_workflow import load_ci


def _is_string_mapping(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict) and all(isinstance(key, str) for key in value)


def _mapping(value: object) -> dict[str, object]:
    assert _is_string_mapping(value)
    return value


def _is_step_list(value: object) -> TypeGuard[list[dict[str, object]]]:
    return isinstance(value, list) and all(_is_string_mapping(step) for step in value)


def _package_steps(job: Mapping[str, object]) -> list[dict[str, object]]:
    steps = job["steps"]
    assert _is_step_list(steps)
    return steps


def _sequence(value: object) -> list[object]:
    assert isinstance(value, list)
    return value


def _text(value: object) -> str:
    assert isinstance(value, str)
    return value


def package_job(workflow: Mapping[str, object]) -> dict[str, object]:
    jobs = _mapping(workflow["jobs"])
    return _mapping(jobs["native_package_development"])


def _mutate_package_header(case: str, job: dict[str, object]) -> None:
    if case == "needs":
        job["needs"] = []
    elif case == "runs_on":
        job["runs-on"] = "ubuntu-24.04"
    elif case == "timeout":
        job["timeout-minutes"] = 61
    elif case == "job_if":
        job["if"] = "false"
    elif case == "defaults":
        job["defaults"] = {"run": {"working-directory": "source"}}
    elif case == "permissions":
        job["permissions"] = {"contents": "write"}
    elif case == "continue_on_error":
        job["continue-on-error"] = True
    else:
        raise AssertionError(case)


def _mutate_package_strategy(case: str, job: dict[str, object]) -> None:
    strategy = _mapping(job["strategy"])
    matrix = _mapping(strategy["matrix"])
    if case == "latest":
        _sequence(matrix["os"])[1] = "ubuntu-latest"
    elif case == "fail_fast":
        strategy["fail-fast"] = True
    elif case == "extra_axis":
        matrix["mode"] = ["debug"]
    else:
        raise AssertionError(case)


def _mutate_package_structure(
    case: str, workflow: dict[str, object], steps: list[dict[str, object]]
) -> None:
    if case == "extra_job":
        _mapping(workflow["jobs"])["third"] = {
            "runs-on": "ubuntu-24.04",
            "steps": [],
        }
    elif case == "missing_step":
        steps.pop(1)
    elif case == "reorder":
        steps[1], steps[2] = steps[2], steps[1]
    elif case == "step_continue":
        steps[0]["continue-on-error"] = True
    else:
        raise AssertionError(case)


def _mutate_package_commands(
    case: str, build: dict[str, object], curator: dict[str, object]
) -> None:
    if case == "build_if":
        build["if"] = "runner.os != 'Windows'"
    elif case == "build_shell":
        build["shell"] = "bash"
    elif case == "build_command":
        build["run"] = _text(build["run"]).replace("--python $env:PACKAGE_PYTHON", "")
    elif case == "build_extra":
        build["run"] = _text(build["run"]) + "\nexit 0\n"
    elif case == "curator_if":
        curator["if"] = "success()"
    elif case == "curator_command":
        curator["run"] = _text(curator["run"]).replace(
            "'japp-development-package-proof'", "'other'"
        )
    else:
        raise AssertionError(case)


def _mutate_package_upload(case: str, upload: dict[str, object]) -> None:
    if case == "upload_if":
        upload["if"] = "success()"
    elif case == "upload_action":
        upload["uses"] = "actions/upload-artifact@main"
    elif case == "upload_path":
        _mapping(upload["with"])["path"] = "${{ runner.temp }}/"
    elif case == "upload_days":
        _mapping(upload["with"])["retention-days"] = 90
    elif case == "upload_missing":
        _mapping(upload["with"])["if-no-files-found"] = "ignore"
    else:
        raise AssertionError(case)


def test_package_job_has_exact_bounded_contract() -> None:
    workflow = load_ci()
    assert check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    required = check_portability._check_matrix(workflow, violations)
    assert required == ("verify", workflow["jobs"]["verify"])
    assert violations == []


@pytest.mark.parametrize(
    "case",
    [
        "needs",
        "runs_on",
        "latest",
        "fail_fast",
        "extra_axis",
        "timeout",
        "job_if",
        "defaults",
        "permissions",
        "continue_on_error",
        "extra_job",
        "missing_step",
        "reorder",
        "step_continue",
        "build_if",
        "build_shell",
        "build_command",
        "build_extra",
        "curator_if",
        "curator_command",
        "upload_if",
        "upload_action",
        "upload_path",
        "upload_days",
        "upload_missing",
    ],
)
def test_changed_package_contract_is_refused(case: str) -> None:
    workflow = deepcopy(load_ci())
    job = package_job(workflow)
    steps = _package_steps(job)
    build = steps[9]
    curator, upload = steps[-2:]
    if case in (
        "needs",
        "runs_on",
        "timeout",
        "job_if",
        "defaults",
        "permissions",
        "continue_on_error",
    ):
        _mutate_package_header(case, job)
    elif case in ("latest", "fail_fast", "extra_axis"):
        _mutate_package_strategy(case, job)
    elif case in ("extra_job", "missing_step", "reorder", "step_continue"):
        _mutate_package_structure(case, workflow, steps)
    elif case in (
        "build_if",
        "build_shell",
        "build_command",
        "build_extra",
        "curator_if",
        "curator_command",
    ):
        _mutate_package_commands(case, build, curator)
    elif case in (
        "upload_if",
        "upload_action",
        "upload_path",
        "upload_days",
        "upload_missing",
    ):
        _mutate_package_upload(case, upload)
    else:
        raise AssertionError(case)
    assert not check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_matrix(workflow, violations)
    assert any(item.rule == "PORT-CI-002" for item in violations)


def test_package_artifact_exception_is_named_exact_and_opt_in() -> None:
    workflow = load_ci()
    upload = _package_steps(package_job(workflow))[-1]
    named = [
        ("native_package_development:Retain finite native development evidence", upload)
    ]
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(named, violations)
    assert any(item.rule == "PORT-CI-017" for item in violations)
    approved: list[check_portability.Violation] = []
    check_portability._check_artifacts(named, approved, approved_package=True)
    assert approved == []
    wrong_name: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        [("verify:Retain finite native development evidence", upload)],
        wrong_name,
        approved_package=True,
    )
    assert any(item.rule == "PORT-CI-017" for item in wrong_name)


def test_package_exception_does_not_allow_always_browser_upload() -> None:
    workflow = deepcopy(load_ci())
    browser = next(
        step
        for step in workflow["jobs"]["verify"]["steps"]
        if str(step.get("uses", "")).startswith("actions/upload-artifact@")
    )
    browser["if"] = "always()"
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        [("verify:" + browser["name"], browser)], violations, approved_package=True
    )
    assert any(item.rule == "PORT-CI-017" for item in violations)


def test_package_exception_does_not_hide_changed_verify_matrix() -> None:
    workflow = deepcopy(load_ci())
    workflow["jobs"]["verify"]["strategy"]["matrix"]["os"].remove("windows-2025")
    assert check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_matrix(workflow, violations)
    assert any(item.rule == "PORT-CI-002" for item in violations)


# Independent exact fixture: these are the sealed CI export additions, not
# aliases of the checker constants that the mutations exercise.
def _package_export_pair() -> list[dict[str, object]]:
    return [
        {
            "name": (
                "Export exact inspected Ubuntu package for separately "
                "reviewed GNOME job"
            ),
            "if": "runner.os == 'Linux'",
            "shell": "bash",
            "run": "set -euo pipefail\n"
            '"$PACKAGE_PYTHON" -B '
            "scripts/linux_gnome/ubuntu_gnome_package_export.py \\\n"
            '  --proof "$RUNNER_TEMP/japp-development-package-proof" \\\n'
            '  --output "$RUNNER_TEMP/japp-gnome-package-export" \\\n'
            '  --expected-head "$GITHUB_SHA"\n',
        },
        {
            "name": (
                "Retain exact Ubuntu package export without GUI qualification claim"
            ),
            "if": "runner.os == 'Linux'",
            "uses": "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
            "with": {
                "name": "gnome-package-input-${{ github.sha }}",
                "path": "${{ runner.temp }}/japp-gnome-package-export/",
                "if-no-files-found": "error",
                "retention-days": 7,
            },
        },
    ]


def _package_export_workflow(include_export: bool = True) -> dict[str, object]:
    workflow = deepcopy(load_ci())
    steps = _package_steps(package_job(workflow))
    if len(steps) == len(check_portability.NATIVE_PACKAGE_STEPS) + 2:
        del steps[10:12]
    assert (
        tuple(step.get("name") for step in steps)
        == check_portability.NATIVE_PACKAGE_STEPS
    )
    if include_export:
        steps[10:10] = _package_export_pair()
    return workflow


@pytest.mark.parametrize("include_export", [False, True])
def test_exact_package_export_is_optional_bounded_extension(
    include_export: bool,
) -> None:
    workflow = _package_export_workflow(include_export)
    assert check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    assert check_portability._check_matrix(workflow, violations) is not None
    steps = check_portability._steps(workflow)
    check_portability._check_shell_policy(workflow, steps, violations)
    check_portability._check_windows_tokens(steps, violations)
    check_portability._check_masking(workflow, steps, violations)
    check_portability._check_artifacts(steps, violations, approved_package=True)
    assert violations == []


@pytest.mark.parametrize(
    ("target", "key", "value"),
    [
        pytest.param(0, "if", "always()", id="export-always"),
        pytest.param(0, "if", "success()", id="export-success"),
        pytest.param(0, "if", "runner.os != 'Windows'", id="export-macos"),
        pytest.param(0, "if", "runner.os == 'Windows'", id="export-windows"),
        pytest.param(
            0,
            "if",
            "runner.os == 'Linux' || runner.os == 'Windows'",
            id="export-composite",
        ),
        pytest.param(0, "shell", "pwsh", id="export-shell"),
        pytest.param(0, "name", "Other export", id="export-name"),
        pytest.param(0, "env", {"PACKAGE_PYTHON": "other"}, id="export-env"),
        pytest.param(0, "working-directory", "other", id="export-working-directory"),
        pytest.param(0, "timeout-minutes", 1, id="export-timeout"),
        pytest.param(0, "continue-on-error", False, id="export-continue"),
        pytest.param(0, "uses", "actions/checkout@main", id="export-extra-uses"),
        pytest.param(1, "if", "always()", id="upload-always"),
        pytest.param(1, "if", "success()", id="upload-success"),
        pytest.param(1, "if", "runner.os != 'Windows'", id="upload-macos"),
        pytest.param(1, "if", "runner.os == 'Windows'", id="upload-windows"),
        pytest.param(
            1,
            "if",
            "runner.os == 'Linux' || runner.os == 'Windows'",
            id="upload-composite",
        ),
        pytest.param(1, "name", "Other upload", id="upload-name"),
        pytest.param(1, "uses", "actions/upload-artifact@main", id="upload-unpinned"),
        pytest.param(
            1, "uses", "actions/upload-artifact@" + "f" * 40, id="upload-other-pin"
        ),
        pytest.param(1, "env", {"X": "other"}, id="upload-extra-env"),
        pytest.param(1, "timeout-minutes", 1, id="upload-extra-timeout"),
        pytest.param(1, "continue-on-error", False, id="upload-continue"),
        pytest.param(1, "run", "other", id="upload-extra-run"),
    ],
)
def test_changed_package_export_step_is_refused(
    target: int, key: str, value: object
) -> None:
    workflow = _package_export_workflow()
    _package_steps(package_job(workflow))[10 + target][key] = value
    assert not check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_matrix(workflow, violations)
    assert any(item.rule == "PORT-CI-002" for item in violations)


@pytest.mark.parametrize(
    ("target", "key"),
    [(0, "if"), (0, "shell"), (0, "run"), (1, "if"), (1, "uses"), (1, "with")],
)
def test_missing_package_export_key_is_refused(target: int, key: str) -> None:
    workflow = _package_export_workflow()
    del _package_steps(package_job(workflow))[10 + target][key]
    assert not check_portability._native_package_job_valid(workflow)


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ("set -euo pipefail\n", ""),
        ("$PACKAGE_PYTHON", "python3"),
        ("scripts/linux_gnome/ubuntu_gnome_package_export.py", "scripts/other.py"),
        ("japp-development-package-proof", "other-proof"),
        ("japp-gnome-package-export", "other-export"),
        ('--expected-head "$GITHUB_SHA"', ""),
        ("$GITHUB_SHA", "$GITHUB_HEAD_REF"),
        ("$GITHUB_SHA", "${{ github.event.pull_request.head.sha }}"),
    ],
)
def test_changed_package_export_command_is_refused(old: str, new: str) -> None:
    workflow = _package_export_workflow()
    export = _package_steps(package_job(workflow))[10]
    command = _text(export["run"])
    assert old in command
    export["run"] = command.replace(old, new)
    assert not check_portability._native_package_job_valid(workflow)


@pytest.mark.parametrize("suffix", ["\nexit 0\n", "\nother-command\n"])
def test_appended_package_export_command_is_refused(suffix: str) -> None:
    workflow = _package_export_workflow()
    export = _package_steps(package_job(workflow))[10]
    export["run"] = _text(export["run"]) + suffix
    assert not check_portability._native_package_job_valid(workflow)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("name", "other-${{ github.sha }}"),
        ("path", "${{ runner.temp }}/"),
        ("path", "${{ runner.temp }}/japp-gnome-package-export"),
        ("if-no-files-found", "ignore"),
        ("retention-days", 90),
        ("compression-level", 0),
    ],
)
def test_changed_package_export_upload_input_is_refused(
    key: str, value: object
) -> None:
    workflow = _package_export_workflow()
    upload = _package_steps(package_job(workflow))[11]
    _mapping(upload["with"])[key] = value
    assert not check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        [(check_portability.NATIVE_PACKAGE_JOB + ":" + _text(upload["name"]), upload)],
        violations,
        approved_package=True,
    )
    assert any(item.rule == "PORT-CI-017" for item in violations)


@pytest.mark.parametrize(
    "case",
    [
        "missing-export",
        "missing-upload",
        "reversed",
        "before-build",
        "after-curator",
        "split",
        "duplicate",
        "verify-copy",
    ],
)
def test_changed_package_export_slot_is_refused(case: str) -> None:
    workflow = _package_export_workflow()
    steps = _package_steps(package_job(workflow))
    if case == "missing-export":
        steps.pop(10)
    elif case == "missing-upload":
        steps.pop(11)
    elif case == "reversed":
        steps[10], steps[11] = steps[11], steps[10]
    elif case == "before-build":
        steps[9:12] = steps[10:12] + steps[9:10]
    elif case == "after-curator":
        steps[10:13] = steps[12:13] + steps[10:12]
    elif case == "split":
        steps[11], steps[12] = steps[12], steps[11]
    elif case == "duplicate":
        steps[12:12] = deepcopy(steps[10:12])
    elif case == "verify-copy":
        _package_steps(_mapping(_mapping(workflow["jobs"])["verify"])).append(
            deepcopy(steps[11])
        )
        del steps[10:12]
    else:
        raise AssertionError(case)
    if case == "verify-copy":
        # The legacy native recipe stays valid, but the copied upload does not
        # acquire the exact native-job exception.
        assert check_portability._native_package_job_valid(workflow)
        violations: list[check_portability.Violation] = []
        check_portability._check_artifacts(
            check_portability._steps(workflow), violations, approved_package=True
        )
        assert any(item.rule == "PORT-CI-017" for item in violations)
    else:
        assert not check_portability._native_package_job_valid(workflow)


@pytest.mark.parametrize("approved_package", [False, True])
@pytest.mark.parametrize("job_name", ["verify", "native_package_development"])
def test_package_export_artifact_exception_is_exact_and_opt_in(
    approved_package: bool, job_name: str
) -> None:
    upload = _package_export_pair()[1]
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        [(job_name + ":" + _text(upload["name"]), upload)],
        violations,
        approved_package=approved_package,
    )
    assert (violations == []) == (
        approved_package and job_name == "native_package_development"
    )


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("name", "Other upload"),
        ("if", "always()"),
        ("if", "runner.os != 'Windows'"),
        ("uses", "actions/upload-artifact@main"),
        ("env", {"X": "other"}),
        ("timeout-minutes", 1),
        ("run", "other"),
    ],
)
def test_export_artifact_exception_rejects_changed_complete_step(
    key: str, value: object
) -> None:
    upload = _package_export_pair()[1]
    where = check_portability.NATIVE_PACKAGE_JOB + ":" + _text(upload["name"])
    upload[key] = value
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        [(where, upload)], violations, approved_package=True
    )
    assert any(item.rule == "PORT-CI-017" for item in violations)


def test_export_extension_does_not_approve_changed_original_recipe() -> None:
    workflow = _package_export_workflow()
    steps = _package_steps(package_job(workflow))
    steps[-2]["if"] = "success()"
    assert not check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_artifacts(
        check_portability._steps(workflow),
        violations,
        approved_package=check_portability._native_package_job_valid(workflow),
    )
    assert any(
        "Retain exact Ubuntu package export" in item.location for item in violations
    )


def test_export_extension_does_not_hide_changed_verify_matrix() -> None:
    workflow = _package_export_workflow()
    verify_job = _mapping(_mapping(workflow["jobs"])["verify"])
    matrix = _mapping(_mapping(verify_job["strategy"])["matrix"])
    _sequence(matrix["os"]).remove("windows-2025")
    assert check_portability._native_package_job_valid(workflow)
    violations: list[check_portability.Violation] = []
    check_portability._check_matrix(workflow, violations)
    assert any(item.rule == "PORT-CI-002" for item in violations)
