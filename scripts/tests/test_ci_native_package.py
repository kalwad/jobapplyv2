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
    build, curator, upload = steps[-3:]
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
