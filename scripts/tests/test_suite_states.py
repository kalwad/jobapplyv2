"""Suite-state derivation and honest NOT_YET_APPLICABLE reporting."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import verify
from conftest import (
    FAILING_CMD,
    REPO_ROOT,
    make_suite,
    write_registry,
    write_status,
)


def test_real_registry_loads_and_states_match_project_state(
    real_ctx: verify.Context,
) -> None:
    registry = verify.load_registry(real_ctx.registry_path)
    states = verify.parse_package_states(real_ctx.status_path)
    derived = {
        suite.suite_id: verify.derive_state(real_ctx, suite, states)
        for suite in registry.suites
    }
    assert derived["contract"] is verify.SuiteState.ACTIVE
    assert derived["visual"] is verify.SuiteState.NOT_YET_APPLICABLE
    active = {sid for sid, st in derived.items() if st is verify.SuiteState.ACTIVE}
    # contract-gen activated when M01-W02 began and its generator landed at
    # scripts/generate-contracts.*; it stays ACTIVE for every later state.
    assert active == {
        "toolchain",
        "format",
        "lint",
        "typecheck",
        "unit-ts",
        "contract-gen",
        "fixture-corpus",
        "contract",
        "e2e-browser",
        "python",
        "rust",
        "portability",
        "traceability",
        "status",
        "integrity",
    }


def test_started_contract_is_active_with_real_discovery(
    real_ctx: verify.Context,
) -> None:
    registry = verify.load_registry(real_ctx.registry_path)
    suite = next(suite for suite in registry.suites if suite.suite_id == "contract")
    states = verify.parse_package_states(real_ctx.status_path)
    assert verify.derive_state(real_ctx, suite, states) is verify.SuiteState.ACTIVE
    assert verify.discovery_matches(real_ctx, suite.discovery_globs)


def test_fixture_corpus_transitions_from_nya_to_active(
    real_ctx: verify.Context,
) -> None:
    registry = verify.load_registry(real_ctx.registry_path)
    suite = next(
        suite for suite in registry.suites if suite.suite_id == "fixture-corpus"
    )
    states = verify.parse_package_states(real_ctx.status_path)
    before_start = {**states, "M02-W01": "READY"}
    assert (
        verify.derive_state(real_ctx, suite, before_start)
        is verify.SuiteState.NOT_YET_APPLICABLE
    )
    assert verify.derive_state(real_ctx, suite, states) is verify.SuiteState.ACTIVE
    assert len(verify.discovery_matches(real_ctx, suite.discovery_globs)) == 8


def test_started_fixture_corpus_with_empty_discovery_is_required_missing(
    real_ctx: verify.Context, tmp_path: Path
) -> None:
    fake_registry = tmp_path / "registry.json"
    write_registry(
        fake_registry,
        [
            make_suite(
                id="fixture-corpus",
                owner="M02-W01",
                activation={
                    "type": "packages_started",
                    "packages": ["M02-W01"],
                },
                discovery_globs=["packages/test-fixtures/test/empty/**/*.test.ts"],
            )
        ],
    )
    ctx = verify.Context(
        repo=REPO_ROOT,
        registry_path=fake_registry,
        status_path=real_ctx.status_path,
    )
    outcomes, exit_code = verify.run_verification(ctx, ["fixture-corpus"])
    assert exit_code == 1
    assert outcomes[0].state is verify.SuiteState.REQUIRED_MISSING


def test_nya_visual_is_reported_honestly_not_as_pass(
    real_ctx: verify.Context,
) -> None:
    outcomes, exit_code = verify.run_verification(real_ctx, ["visual"])
    assert exit_code == 0
    (outcome,) = outcomes
    assert outcome.verdict is verify.Verdict.NOT_YET_APPLICABLE
    assert "no renderable product surface" in outcome.messages[0]


def test_activated_but_empty_contract_suite_fails(
    real_ctx: verify.Context, tmp_path: Path
) -> None:
    fake_status = tmp_path / "status.md"
    fake_registry = tmp_path / "registry.json"
    states = verify.parse_package_states(real_ctx.status_path)
    states["M01-W05"] = "IN_PROGRESS"
    write_status(fake_status, states)
    write_registry(
        fake_registry,
        [
            make_suite(
                id="contract",
                activation={
                    "type": "packages_started",
                    "packages": ["M01-W05"],
                },
                discovery_globs=["deliberately-empty/**/*.test.ts"],
            )
        ],
    )
    ctx = verify.Context(
        repo=REPO_ROOT,
        registry_path=fake_registry,
        status_path=fake_status,
    )
    outcomes, exit_code = verify.run_verification(ctx, ["contract"])
    assert exit_code == 1
    assert outcomes[0].verdict is verify.Verdict.REQUIRED_MISSING
    assert "REQUIRED" in outcomes[0].messages[0]


def test_activated_but_empty_visual_suite_fails(
    real_ctx: verify.Context, tmp_path: Path
) -> None:
    fake_status = tmp_path / "status.md"
    states = verify.parse_package_states(real_ctx.status_path)
    states["M10-W06"] = "IN_PROGRESS"
    write_status(fake_status, states)
    ctx = verify.Context(
        repo=REPO_ROOT, registry_path=real_ctx.registry_path, status_path=fake_status
    )
    outcomes, exit_code = verify.run_verification(ctx, ["visual"])
    assert exit_code == 1
    assert outcomes[0].verdict is verify.Verdict.REQUIRED_MISSING


def test_required_missing_when_activation_package_started_and_no_tests(
    fixture_repo: verify.Context,
) -> None:
    write_status(fixture_repo.status_path, {"M01-W05": "IN_PROGRESS"})
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="contract",
                activation={"type": "packages_started", "packages": ["M01-W05"]},
                discovery_globs=["nothing/**/*.test.ts"],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, ["contract"])
    assert exit_code == 1
    assert outcomes[0].state is verify.SuiteState.REQUIRED_MISSING


def test_blocked_activation_package_counts_as_begun(
    fixture_repo: verify.Context,
) -> None:
    write_status(fixture_repo.status_path, {"M01-W05": "BLOCKED"})
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="contract",
                activation={"type": "packages_started", "packages": ["M01-W05"]},
                discovery_globs=["nothing/**/*.test.ts"],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, ["contract"])
    assert exit_code == 1
    assert outcomes[0].state is verify.SuiteState.REQUIRED_MISSING


def test_unrecognized_state_token_fails_closed(
    fixture_repo: verify.Context,
) -> None:
    write_status(fixture_repo.status_path, {"M01-W05": "IN_PROGESS"})
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                activation={"type": "packages_started", "packages": ["M01-W05"]},
                discovery_globs=["x/**"],
            )
        ],
    )
    with pytest.raises(verify.RegistryError, match="unrecognized package state"):
        verify.run_verification(fixture_repo, None)


def test_required_missing_fails_even_for_non_mandatory_suite(
    fixture_repo: verify.Context,
) -> None:
    write_status(fixture_repo.status_path, {"M01-W05": "IN_PROGRESS"})
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="optional-missing",
                mandatory=False,
                activation={"type": "packages_started", "packages": ["M01-W05"]},
                discovery_globs=["nothing/**/*.test.ts"],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert outcomes[0].verdict is verify.Verdict.REQUIRED_MISSING


def test_non_mandatory_active_failure_does_not_fail_aggregate(
    fixture_repo: verify.Context,
) -> None:
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(id="good"),
            make_suite(id="optional-bad", mandatory=False, commands=[FAILING_CMD]),
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 0
    verdicts = {o.suite.suite_id: o.verdict for o in outcomes}
    assert verdicts["optional-bad"] is verify.Verdict.FAIL


def test_unknown_activation_package_fails_closed(
    fixture_repo: verify.Context,
) -> None:
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                activation={"type": "packages_started", "packages": ["M99-W99"]},
                discovery_globs=["x/**"],
            )
        ],
    )
    with pytest.raises(verify.RegistryError, match="fail closed"):
        verify.run_verification(fixture_repo, None)


def test_failing_child_command_fails_aggregate(
    fixture_repo: verify.Context,
) -> None:
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="good"), make_suite(id="bad", commands=[FAILING_CMD])],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    verdicts = {o.suite.suite_id: o.verdict for o in outcomes}
    assert verdicts["good"] is verify.Verdict.PASS
    assert verdicts["bad"] is verify.Verdict.FAIL


def test_exit_zero_only_when_all_active_pass_and_nya_valid(
    fixture_repo: verify.Context,
) -> None:
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(id="good"),
            make_suite(
                id="future",
                activation={"type": "packages_started", "packages": ["M01-W05"]},
                discovery_globs=["nothing/**/*.ts"],
                explanation="owned by a later milestone",
            ),
        ],
    )
    write_status(fixture_repo.status_path, {"M01-W05": "NOT_STARTED"})
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 0
    assert {o.verdict for o in outcomes} == {
        verify.Verdict.PASS,
        verify.Verdict.NOT_YET_APPLICABLE,
    }
    write_status(fixture_repo.status_path, {"M01-W05": "IN_PROGRESS"})
    _, exit_code_after = verify.run_verification(fixture_repo, None)
    assert exit_code_after == 1


def test_pytest_exit_five_is_reported_as_empty_suite_failure(
    fixture_repo: verify.Context,
) -> None:
    cmd = [sys.executable, "-c", "raise SystemExit(5)", "pytest"]
    write_registry(fixture_repo.registry_path, [make_suite(commands=[cmd])])
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert "zero tests" in outcomes[0].messages[0]


def test_empty_vitest_selection_fails_via_proof(
    fixture_repo: verify.Context,
) -> None:
    write_registry(
        fixture_repo.registry_path,
        [make_suite(proofs=[{"kind": "vitest_min_tests", "min": 1}])],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert "discovery proof failed" in outcomes[0].messages[0]


def test_vitest_exact_count_rejects_both_shortfall_and_surplus(
    fixture_repo: verify.Context,
) -> None:
    for reported in (49, 51):
        command = [
            sys.executable,
            "-c",
            f"print('Tests  {reported} passed')",
        ]
        write_registry(
            fixture_repo.registry_path,
            [
                make_suite(
                    commands=[command],
                    proofs=[{"kind": "vitest_exact_tests", "min": 50}],
                )
            ],
        )
        outcomes, exit_code = verify.run_verification(fixture_repo, None)
        assert exit_code == 1
        assert "need exactly 50" in outcomes[0].messages[0]


def test_vitest_exact_count_rejects_nonpassing_outcomes_even_with_exact_passes(
    fixture_repo: verify.Context,
) -> None:
    for label in ("skipped", "todo", "pending", "excluded"):
        command = [
            sys.executable,
            "-c",
            f"print('Tests  1 {label} | 50 passed (51)')",
        ]
        write_registry(
            fixture_repo.registry_path,
            [
                make_suite(
                    commands=[command],
                    proofs=[{"kind": "vitest_exact_tests", "min": 50}],
                )
            ],
        )
        outcomes, exit_code = verify.run_verification(fixture_repo, None)
        assert exit_code == 1
        assert f"1 {label}" in outcomes[0].messages[0]


def test_conditional_skip_plus_trivial_replacement_fails_both_controls(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            'test.skipIf(true)("substantive", () => { throw new Error(); });\n'
            'test("trivial replacement", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ())
    proof = verify.Proof(kind="vitest_exact_tests", min_count=50)
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    failure = verify.check_proof(
        fixture_repo,
        suite,
        proof,
        "Tests  1 skipped | 50 passed (51)",
    )
    assert failure is not None
    assert "non-passing" in failure


def test_empty_parameter_table_with_count_compensation_still_fails(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            'test.each([])("substantive %s", () => { throw new Error(); });\n'
            'test("compensating trivial pass", () => {});\n'
        ),
        encoding="utf-8",
    )
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="integrity",
                builtin="integrity",
                commands=[],
            ),
            make_suite(
                id="count-proof",
                commands=[
                    [
                        sys.executable,
                        "-c",
                        "print('Test Files  1 passed (1)\\nTests  50 passed (50)')",
                    ]
                ],
                proofs=[{"kind": "vitest_exact_tests", "min": 50}],
            ),
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert any(
        "empty test parameter table" in message
        or "empty test.each parameter table" in message
        for outcome in outcomes
        for message in outcome.messages
    )


def test_unknown_proof_kind_fails_closed(fixture_repo: verify.Context) -> None:
    write_registry(
        fixture_repo.registry_path,
        [make_suite(proofs=[{"kind": "mystery-proof"}])],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert "unknown proof kind" in outcomes[0].messages[0]


def test_registry_rejects_duplicate_ids_and_empty_argv(tmp_path: Path) -> None:
    registry_path = tmp_path / "registry.json"
    write_registry(registry_path, [make_suite(id="dup"), make_suite(id="dup")])
    with pytest.raises(verify.RegistryError, match="duplicate suite ids"):
        verify.load_registry(registry_path)
    write_registry(registry_path, [make_suite(commands=[[]])])
    with pytest.raises(verify.RegistryError, match="no-op"):
        verify.load_registry(registry_path)
