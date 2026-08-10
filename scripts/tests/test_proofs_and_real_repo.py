"""Discovery-proof logic and read-only checks against the real repository."""

from __future__ import annotations

import verify
from conftest import REPO_ROOT


def _ctx() -> verify.Context:
    return verify.Context(
        repo=REPO_ROOT,
        registry_path=REPO_ROOT / "scripts/verification-suites.json",
        status_path=REPO_ROOT / "docs/PROJECT_STATUS.md",
    )


def _suite_stub() -> verify.Suite:
    return verify.Suite(
        suite_id="stub",
        name="stub",
        owner="M00-W04",
        mandatory=True,
        activation=verify.Activation(kind="always_active"),
        commands=(("noop",),),
        proofs=(),
        discovery_globs=(),
        artifacts=(),
        explanation="",
    )


def test_workspace_package_enumeration_matches_scaffold() -> None:
    ctx = _ctx()
    with_test = verify.workspace_packages_with_script(ctx, "test")
    with_typecheck = verify.workspace_packages_with_script(ctx, "typecheck")
    assert len(with_test) == 13
    assert len(with_typecheck) == 13
    assert all(name.startswith("@japp/") for name in with_test)


def test_turbo_task_count_proof_detects_dropped_tasks() -> None:
    ctx = _ctx()
    proof = verify.Proof(kind="turbo_task_count", script="test")
    good = "Tasks:    13 successful, 13 total"
    bad = "Tasks:    12 successful, 12 total"
    assert verify.check_proof(ctx, _suite_stub(), proof, good) is None
    failure = verify.check_proof(ctx, _suite_stub(), proof, bad)
    assert failure is not None
    assert "13 workspace packages" in failure


def test_vitest_per_package_proof_requires_fresh_counts() -> None:
    ctx = _ctx()
    proof = verify.Proof(kind="vitest_per_package", script="test")
    fresh = "\n".join(["Tests  1 passed (1)"] * 13)
    cached = "\n".join(["Tests  1 passed (1)"] * 3)
    assert verify.check_proof(ctx, _suite_stub(), proof, fresh) is None
    failure = verify.check_proof(ctx, _suite_stub(), proof, cached)
    assert failure is not None
    assert "fresh execution required" in failure


def test_cargo_minimum_and_pytest_exact_inventory_proofs() -> None:
    ctx = _ctx()
    cargo = verify.Proof(kind="cargo_min_passed")
    assert (
        verify.check_proof(ctx, _suite_stub(), cargo, "test result: ok. 1 passed")
        is None
    )
    failure = verify.check_proof(ctx, _suite_stub(), cargo, "test result: ok. 0 passed")
    assert failure is not None
    ctx.python_expected_count = 12
    ctx.python_expected_digest = "expected"
    pytest_proof = verify.Proof(kind="pytest_exact_inventory")
    summary = "=========== 12 passed in 0.01s ==========="
    assert verify.check_proof(ctx, _suite_stub(), pytest_proof, summary) is None
    assert verify.check_proof(ctx, _suite_stub(), pytest_proof, "no tests") is not None
    echoed_title = "tests/test_x.py::test_5_passed_items PASSED"
    assert (
        verify.check_proof(ctx, _suite_stub(), pytest_proof, echoed_title) is not None
    )


def test_playwright_passed_proof_ignores_non_summary_lines() -> None:
    ctx = _ctx()
    proof = verify.Proof(kind="playwright_min_passed")
    summary = "Running 1 test using 1 worker\n  1 passed (556ms)"
    assert verify.check_proof(ctx, _suite_stub(), proof, summary) is None
    skipped_only = (
        "  -  1 [chromium] > probe > widget shows 5 passed items (12ms)\n  1 skipped"
    )
    assert verify.check_proof(ctx, _suite_stub(), proof, skipped_only) is not None


def test_real_repo_integrity_is_clean() -> None:
    ctx = _ctx()
    registry = verify.load_registry(ctx.registry_path)
    assert verify.check_integrity(ctx, registry) == []


def test_real_repo_toolchain_pins_are_readable() -> None:
    ctx = _ctx()
    pins = verify._read_pins(ctx)
    assert pins["node"] == "24.18.0"
    assert pins["pnpm"] == "11.17.0"
    assert pins["python"] == "3.12.13"
    assert pins["uv"] == "0.11.32"
    assert pins["rust"] == "1.97.1"
