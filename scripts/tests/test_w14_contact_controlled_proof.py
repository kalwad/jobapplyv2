"""Contact verification is closed, synthetic, exact and free of live-run flags."""

from __future__ import annotations

import copy
import json
import os
import subprocess
from dataclasses import replace
from pathlib import Path
from typing import Any

import portability
import pytest
import verify
from conftest import REPO_ROOT


def _ctx(repo: Path = REPO_ROOT) -> verify.Context:
    return verify.Context(
        repo=repo,
        registry_path=repo / "scripts/verification-suites.json",
        status_path=repo / "docs/PROJECT_STATUS.md",
    )


def _suite() -> verify.Suite:
    return next(
        suite
        for suite in verify.load_registry(_ctx().registry_path).suites
        if suite.suite_id == "w14-public-contact-controlled"
    )


def _proof() -> verify.Proof:
    return verify.Proof(kind="w14_public_controlled_exact", min_count=62)


def _report(*, executed: bool) -> dict[str, Any]:
    return {
        "errors": [],
        "stats": {
            "expected": 62 if executed else 0,
            "skipped": 0 if executed else 62,
            "unexpected": 0,
            "flaky": 0,
        },
        "suites": [
            {
                "specs": [
                    {
                        "id": f"test-{index}",
                        "title": f"ordinary-{index}",
                        "file": "controlled-contact.proof.ts",
                        "ok": True,
                        "tests": [
                            {
                                "projectId": "",
                                "expectedStatus": "passed",
                                "status": "expected" if executed else "skipped",
                                "results": [
                                    {"status": "passed", "retry": 0, "errors": []}
                                ]
                                if executed
                                else [],
                            }
                        ],
                    }
                    for index in range(62)
                ]
            }
        ],
    }


def _output(report: dict[str, Any] | None = None, *, executed: bool = True) -> str:
    prefix = (
        "Tests 2 passed (2)\n62 passed (1s)\n"
        if executed
        else "Listing tests:\nTotal: 62 tests in 1 file\n"
    )
    return prefix + json.dumps(
        _report(executed=executed) if report is None else report, indent=2
    )


def _listed(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
    assert argv == (*verify.W14_CONTACT_CONTROLLED_COMMAND, "--list")
    return 0, _output(executed=False)


def test_w14_contact_registration_has_its_own_exact_mandatory_inventory() -> None:
    suite = _suite()
    assert suite.owner == "M02-W14"
    assert suite.mandatory
    assert suite.activation == verify.Activation(
        kind="packages_started", packages=("M02-W14",)
    )
    assert suite.commands == verify.W14_CONTACT_CONTROLLED_COMMANDS
    assert suite.commands[1:4] == (
        verify.W14_PUBLIC_DEFAULT_BUILD_COMMAND,
        verify.W14_PUBLIC_BUILD_COMMAND,
        verify.W14_CONTACT_BUILD_COMMAND,
    )
    assert suite.proofs == (
        verify.Proof(kind="vitest_exact_tests", min_count=2),
        _proof(),
    )
    assert suite.discovery_globs == (
        "apps/extension/test/m02-w14/public-contact/protocol.test.ts",
        verify.W14_CONTACT_CONTROLLED_TEST,
    )
    assert all(
        "run-contact.ts" not in part and "run-inspection.ts" not in part
        for argv in suite.commands
        for part in argv
    )
    inspection = next(
        item
        for item in verify.W14_CONTROLLED_INVENTORIES
        if item.suite_id == "w14-public-controlled"
    )
    assert inspection.commands == verify.W14_PUBLIC_CONTROLLED_COMMANDS
    assert inspection.pure_count == 4
    assert inspection.browser_count == 2


def test_w14_contact_only_exact_build_run_and_list_receive_contact_opt_in() -> None:
    allowed: tuple[tuple[str, ...], ...] = (
        verify.W14_CONTACT_BUILD_COMMAND,
        verify.W14_CONTACT_CONTROLLED_COMMAND,
        (*verify.W14_CONTACT_CONTROLLED_COMMAND, "--list"),
    )
    for argv in allowed:
        assert verify._w14_public_contact_opt_in(argv)
    denied: tuple[tuple[str, ...], ...] = (
        verify.W14_CONTACT_PURE_COMMAND,
        (*verify.W14_CONTACT_PURE_COMMAND, "--reporter=default"),
        verify.W14_PUBLIC_DEFAULT_BUILD_COMMAND,
        verify.W14_PUBLIC_BUILD_COMMAND,
        verify.W14_PUBLIC_CONTROLLED_COMMAND,
        ("node", "e2e/extension/public-contact/run-contact.ts"),
        ("pnpm", "exec", "node", "e2e/extension/public-contact/run-contact.ts"),
        (*verify.W14_CONTACT_CONTROLLED_COMMAND, "--grep", "contact"),
        (*verify.W14_CONTACT_CONTROLLED_COMMAND, "--list", "--list"),
        (*verify.W14_CONTACT_BUILD_COMMAND, "--mode", "development"),
        ("pnpm.cmd", *verify.W14_CONTACT_CONTROLLED_COMMAND[1:]),
        tuple(
            part.replace("e2e/extension/", "./e2e/extension/")
            for part in verify.W14_CONTACT_CONTROLLED_COMMAND
        ),
        ("node", *verify.W14_CONTACT_CONTROLLED_COMMAND),
    )
    for argv in denied:
        assert not verify._w14_public_contact_opt_in(argv)
        assert not verify._w14_contact_inspection_opt_in(argv)


def test_w14_contact_child_environment_is_narrow_and_parent_flags_do_not_mutate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    flags = (
        "JAPP_W14_PUBLIC_INSPECTION",
        "JAPP_W14_PUBLIC_CONTACT_EVALUATION",
        "JAPP_W14_PUBLIC_CONTACT_RUN",
    )
    reporter_paths = (
        "PLAYWRIGHT_JSON_OUTPUT_NAME",
        "PLAYWRIGHT_JSON_OUTPUT_FILE",
        "PLAYWRIGHT_JSON_OUTPUT_DIR",
    )
    for name in (*flags, *reporter_paths):
        monkeypatch.setenv(name, "ambient-untrusted")
    observed: list[dict[str, str]] = []
    monkeypatch.setattr(
        portability, "host_resolve_executable", lambda _name: "resolved-tool"
    )

    def run(
        argv: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        environment = kwargs["env"]
        assert isinstance(environment, dict)
        assert kwargs.get("shell", False) is False
        observed.append(dict(environment))
        return subprocess.CompletedProcess(argv, 0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", run)
    inspection = {flags[0]: "1"}
    contact = {flags[1]: "1"}
    commands: tuple[tuple[tuple[str, ...], dict[str, str]], ...] = (
        (verify.W14_PUBLIC_BUILD_COMMAND, inspection),
        (verify.W14_PUBLIC_CONTROLLED_COMMAND, inspection),
        ((*verify.W14_PUBLIC_CONTROLLED_COMMAND, "--list"), inspection),
        (verify.W14_CONTACT_BUILD_COMMAND, contact),
        (verify.W14_CONTACT_CONTROLLED_COMMAND, {**inspection, **contact}),
        ((*verify.W14_CONTACT_CONTROLLED_COMMAND, "--list"), {**inspection, **contact}),
        (verify.W14_CONTACT_PURE_COMMAND, {}),
        ((*verify.W14_CONTACT_PURE_COMMAND, "--reporter=default"), {}),
        (verify.W14_PUBLIC_PURE_COMMAND, {}),
        (verify.W14_PUBLIC_DEFAULT_BUILD_COMMAND, {}),
        (("node", "e2e/extension/public-contact/run-contact.ts"), {}),
        (("node", "e2e/extension/public-research/run-inspection.ts"), {}),
        (("pnpm", "exec", "playwright", "test"), {}),
    )
    for argv, expected in commands:
        assert verify.run_command(_ctx(), argv)[0] == 0
        actual = {key: value for key, value in observed[-1].items() if key in flags}
        assert actual == expected
        if verify._w14_contact_inspection_opt_in(argv):
            assert all(key not in observed[-1] for key in reporter_paths)
            assert observed[-1]["FORCE_COLOR"] == "0"
            assert "NO_COLOR" not in observed[-1]
        assert all(
            os.environ[name] == "ambient-untrusted"
            for name in (*flags, *reporter_paths)
        )


def test_w14_contact_proof_accepts_matching_ordinary_execution_and_listing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(verify, "run_command", _listed)
    assert verify.check_proof(_ctx(), _suite(), _proof(), _output()) is None
    assert (
        verify.check_proof(
            _ctx(),
            _suite(),
            verify.Proof(kind="vitest_exact_tests", min_count=2),
            _output(),
        )
        is None
    )


def test_w14_contact_protocol_rejects_other_counts_and_nonpasses() -> None:
    proof = verify.Proof(kind="vitest_exact_tests", min_count=2)
    for output in (
        "Tests 4 passed (4)",
        "Tests 1 passed (1)",
        "Tests 2 passed | 1 skipped (3)",
        "Tests 1 passed | 1 expected fail (2)",
    ):
        assert verify.check_proof(_ctx(), _suite(), proof, output) is not None


def test_w14_contact_proof_rejects_nonordinary_terminal_channels(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected(_ctx: verify.Context, _argv: tuple[str, ...]) -> tuple[int, str]:
        pytest.fail("invalid executions must not invoke discovery")

    monkeypatch.setattr(verify, "run_command", unexpected)
    for prefix in (
        "61 passed (1s)",
        "63 passed (1s)",
        "62 passed (1s)\n1 skipped",
        "62 passed (1s)\n1 flaky",
        "62 passed (1s)\n1 failed",
        "62 passed (1s)\n1 interrupted",
        "62 passed (1s)\n1 did not run",
        "62 passed (1s)\n62 passed (1s)",
    ):
        assert (
            verify.check_proof(
                _ctx(),
                _suite(),
                _proof(),
                prefix + "\n" + json.dumps(_report(executed=True), indent=2),
            )
            is not None
        )
    assert (
        verify.check_proof(_ctx(), _suite(), _proof(), "62 passed (1s)\nno JSON")
        is not None
    )


def test_w14_contact_json_rejects_expected_failures_retries_and_drift() -> None:
    report = _report(executed=True)
    suites = report["suites"]
    assert isinstance(suites, list)
    spec = suites[0]["specs"][0]
    mutations: tuple[tuple[str, object], ...] = (
        ("expectedStatus", "failed"),
        ("expectedStatus", "skipped"),
        ("status", "unexpected"),
        ("results", []),
        ("results", [{"status": "failed", "retry": 0, "errors": []}]),
        ("results", [{"status": "passed", "retry": 1, "errors": []}]),
        ("results", [{"status": "passed", "retry": 0, "errors": ["error"]}]),
    )
    for key, value in mutations:
        changed = copy.deepcopy(report)
        changed["suites"][0]["specs"][0]["tests"][0][key] = value
        assert (
            verify._w14_contact_report_inventory(_output(changed), executed=True)[1]
            is not None
        )
    for key, value in (("id", "test-1"), ("file", "another.proof.ts"), ("ok", False)):
        changed = copy.deepcopy(report)
        changed["suites"][0]["specs"][0][key] = value
        assert (
            verify._w14_contact_report_inventory(_output(changed), executed=True)[1]
            is not None
        )
    assert spec["tests"][0]["expectedStatus"] == "passed"


def test_w14_contact_rejects_changed_discovery_and_test_identities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    changed = _report(executed=False)
    changed["suites"][0]["specs"][0]["title"] = "silently replaced test"
    results = (
        (1, _output(executed=False)),
        (0, "no listing"),
        (0, _output(executed=False).replace("Total: 62", "Total: 61")),
        (0, _output(executed=False).replace("Total: 62", "Total: 63")),
        (0, "Total: 62 tests in 1 file\n" + _output(executed=False)),
        (0, _output(changed, executed=False)),
    )
    for result in results:

        def listed(
            _ctx: verify.Context,
            _argv: tuple[str, ...],
            result: tuple[int, str] = result,
        ) -> tuple[int, str]:
            return result

        monkeypatch.setattr(verify, "run_command", listed)
        assert verify.check_proof(_ctx(), _suite(), _proof(), _output()) is not None


def test_w14_closed_inventories_reject_drift_before_any_subprocess(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected(_ctx: verify.Context, _argv: tuple[str, ...]) -> tuple[int, str]:
        pytest.fail("closed inventory drift must not start any subprocess")

    monkeypatch.setattr(verify, "run_command", unexpected)
    registry = verify.load_registry(_ctx().registry_path)
    for inventory in verify.W14_CONTROLLED_INVENTORIES:
        suite = next(
            item for item in registry.suites if item.suite_id == inventory.suite_id
        )
        changed = (
            replace(suite, commands=suite.commands[1:]),
            replace(
                suite, commands=((*suite.commands[0], "--extra"), *suite.commands[1:])
            ),
            replace(suite, commands=tuple(reversed(suite.commands))),
            replace(
                suite,
                commands=(
                    ("node", "e2e/extension/public-contact/run-contact.ts"),
                    *suite.commands,
                ),
            ),
            replace(
                suite,
                proofs=(
                    verify.Proof(kind="vitest_exact_tests", min_count=1),
                    suite.proofs[1],
                ),
            ),
            replace(
                suite,
                proofs=(
                    suite.proofs[0],
                    verify.Proof(kind="w14_public_controlled_exact", min_count=1),
                ),
            ),
            replace(suite, mandatory=False),
            replace(suite, activation=verify.Activation(kind="always_active")),
        )
        for altered in changed:
            outcome = verify.run_suite(
                _ctx(), altered, {"M02-W14": "IN_PROGRESS"}, registry
            )
            assert outcome.verdict is verify.Verdict.FAIL
            assert "closed" in outcome.messages[0]


def test_w14_contact_raw_inventory_is_valid_before_vitest_reporter_normalization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite = _suite()
    calls: list[tuple[str, ...]] = []

    def prepared(
        _ctx: verify.Context, commands: tuple[tuple[str, ...], ...]
    ) -> tuple[list[str], tuple[tuple[str, ...], ...]]:
        assert commands == verify.W14_CONTACT_CONTROLLED_COMMANDS
        return [], ((*commands[0], "--reporter=default"), *commands[1:])

    def run(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        calls.append(argv)
        if argv == (*verify.W14_CONTACT_CONTROLLED_COMMAND, "--list"):
            return _listed(_ctx, argv)
        if argv == verify.W14_CONTACT_CONTROLLED_COMMAND:
            return 0, _output()
        return 0, ""

    monkeypatch.setattr(verify, "_prepared_reporter_commands", prepared)
    monkeypatch.setattr(verify, "run_command", run)
    outcome = verify.run_suite(
        _ctx(),
        suite,
        {"M02-W14": "IN_PROGRESS"},
        verify.load_registry(_ctx().registry_path),
    )
    assert outcome.verdict is verify.Verdict.PASS
    assert calls[0] == (*verify.W14_CONTACT_PURE_COMMAND, "--reporter=default")
    assert calls[1:4] == [
        verify.W14_PUBLIC_DEFAULT_BUILD_COMMAND,
        verify.W14_PUBLIC_BUILD_COMMAND,
        verify.W14_CONTACT_BUILD_COMMAND,
    ]


def test_w14_contact_missing_source_and_direct_expected_failure_refuse(
    tmp_path: Path,
) -> None:
    source = tmp_path / verify.W14_CONTACT_CONTROLLED_TEST
    source.parent.mkdir(parents=True)
    assert verify.check_proof(_ctx(tmp_path), _suite(), _proof(), _output()) is not None
    source.write_text("test.fail();\n", encoding="utf-8")
    assert "expected failures" in (
        verify.check_proof(_ctx(tmp_path), _suite(), _proof(), _output()) or ""
    )
