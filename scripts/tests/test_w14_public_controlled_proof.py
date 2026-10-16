"""The opt-in public scope has an exact, synthetic-only canonical proof path."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

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
    registry = verify.load_registry(_ctx().registry_path)
    return next(s for s in registry.suites if s.suite_id == "w14-public-controlled")


def _proof() -> verify.Proof:
    return verify.Proof(kind="w14_public_controlled_exact", min_count=2)


def _listed(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
    assert argv == (*verify.W14_PUBLIC_CONTROLLED_COMMAND, "--list")
    return 0, "Listing tests:\nTotal: 2 tests in 1 file"


def test_w14_public_registration_is_exact_and_mandatory() -> None:
    suite = _suite()
    assert suite.owner == "M02-W14"
    assert suite.mandatory
    assert suite.activation == verify.Activation(
        kind="packages_started", packages=("M02-W14",)
    )
    assert suite.commands == verify.W14_PUBLIC_CONTROLLED_COMMANDS
    assert suite.proofs == (
        verify.Proof(kind="vitest_exact_tests", min_count=4),
        _proof(),
    )
    assert suite.discovery_globs == (
        "apps/extension/test/m02-w14/public-inspection/scope.test.ts",
        verify.W14_PUBLIC_CONTROLLED_TEST,
    )
    assert all(
        "run-inspection.ts" not in part for argv in suite.commands for part in argv
    )


def test_w14_public_opt_in_has_only_three_exact_command_shapes() -> None:
    allowed = (
        verify.W14_PUBLIC_BUILD_COMMAND,
        verify.W14_PUBLIC_CONTROLLED_COMMAND,
        (*verify.W14_PUBLIC_CONTROLLED_COMMAND, "--list"),
    )
    for argv in allowed:
        assert verify._w14_public_controlled_opt_in(argv)
    denied = (
        verify.W14_PUBLIC_PURE_COMMAND,
        verify.W14_PUBLIC_DEFAULT_BUILD_COMMAND,
        ("pnpm", "exec", "playwright", "test"),
        ("node", "e2e/extension/public-research/run-inspection.ts"),
        (*verify.W14_PUBLIC_CONTROLLED_COMMAND, "--grep", "scope"),
        (*verify.W14_PUBLIC_BUILD_COMMAND, "--mode", "development"),
    )
    for denied_argv in denied:
        assert not verify._w14_public_controlled_opt_in(denied_argv)


def test_w14_public_controlled_proof_accepts_exact_ordinary_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(verify, "run_command", _listed)
    output = "Tests 4 passed (4)\nRunning 2 tests using 1 worker\n  2 passed (1.2s)"
    assert verify.check_proof(_ctx(), _suite(), _proof(), output) is None


def test_w14_public_controlled_proof_rejects_nonordinary_summaries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected(_ctx: verify.Context, _argv: tuple[str, ...]) -> tuple[int, str]:
        pytest.fail("failed execution summaries must not invoke discovery")

    monkeypatch.setattr(verify, "run_command", unexpected)
    for output in (
        "no tests",
        "1 passed (1s)",
        "3 passed (1s)",
        "2 passed (1s)\n1 skipped",
        "2 passed (1s)\n1 flaky",
        "2 passed (1s)\n1 failed",
        "2 passed (1s)\n1 interrupted",
        "2 passed (1s)\n1 did not run",
        "2 passed (1s)\n2 passed (1s)",
    ):
        assert verify.check_proof(_ctx(), _suite(), _proof(), output) is not None


def test_w14_public_controlled_proof_rejects_missing_or_changed_discovery(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for result in (
        (1, "Total: 2 tests in 1 file"),
        (0, "no tests"),
        (0, "Total: 0 tests in 0 files"),
        (0, "Total: 3 tests in 1 file"),
        (0, "Total: 2 tests in 1 file\nTotal: 2 tests in 1 file"),
    ):

        def listed(
            _ctx: verify.Context,
            _argv: tuple[str, ...],
            result: tuple[int, str] = result,
        ) -> tuple[int, str]:
            return result

        monkeypatch.setattr(verify, "run_command", listed)
        assert (
            verify.check_proof(_ctx(), _suite(), _proof(), "2 passed (1s)") is not None
        )


def test_w14_public_controlled_proof_rejects_command_or_count_drift() -> None:
    suite = _suite()
    changed = replace(suite, commands=suite.commands[:-1])
    assert verify.check_proof(_ctx(), changed, _proof(), "2 passed (1s)") is not None
    weakened = verify.Proof(kind="w14_public_controlled_exact", min_count=1)
    assert verify.check_proof(_ctx(), suite, weakened, "2 passed (1s)") is not None


def test_w14_public_controlled_proof_refuses_expected_failures(tmp_path: Path) -> None:
    path = tmp_path / verify.W14_PUBLIC_CONTROLLED_TEST
    path.parent.mkdir(parents=True)
    path.write_text("test.fail();\n", encoding="utf-8")
    failure = verify.check_proof(_ctx(tmp_path), _suite(), _proof(), "2 passed (1s)")
    assert failure is not None
    assert "expected failures" in failure
    path.unlink()
    assert (
        verify.check_proof(_ctx(tmp_path), _suite(), _proof(), "2 passed (1s)")
        is not None
    )


def test_w14_controlled_proof_files_receive_static_no_skip_policy() -> None:
    assert "e2e/**/*.proof.ts" in verify.TS_TEST_GLOBS
