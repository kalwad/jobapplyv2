"""Suite-state derivation and honest NOT_YET_APPLICABLE reporting."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from collections.abc import Callable
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

POSIX_ONLY_NODE_IDS = (
    (
        "scripts/tests/test_v14_migration.py::"
        "test_atomic_adoption_rejects_non_regular_source[fifo]"
    ),
    (
        "scripts/tests/test_v14_migration.py::"
        "test_atomic_adoption_rejects_non_regular_source[socket]"
    ),
)
MINIMAL_PYTHON_COMMON_NODE_IDS = (
    "scripts/tests/test_probe.py::test_mandatory_probe",
    *(
        "scripts/tests/test_v14_migration.py::"
        f"test_atomic_adoption_rejects_non_regular_source[{kind}]"
        for kind in ("missing", "directory", "symlink", "device")
    ),
)


def write_vitest_workspace(
    ctx: verify.Context,
    *,
    test_script: str = "vitest run --no-file-parallelism --maxWorkers=1",
) -> Path:
    (ctx.repo / "pnpm-workspace.yaml").write_text(
        'packages:\n  - "packages/*"\n', encoding="utf-8"
    )
    (ctx.repo / "turbo.json").write_text(
        json.dumps({"tasks": {"test": {}}}), encoding="utf-8"
    )
    package_root = ctx.repo / "packages/probe"
    package_root.mkdir(parents=True)
    (package_root / "package.json").write_text(
        json.dumps(
            {
                "name": "@japp/probe",
                "private": True,
                "scripts": {"test": test_script},
            }
        ),
        encoding="utf-8",
    )
    return package_root


def write_python_inventory(
    ctx: verify.Context,
    common_node_ids: list[str],
) -> Path:
    ordered = sorted(common_node_ids)
    digest = hashlib.sha256(("\n".join(ordered) + "\n").encode()).hexdigest()
    payload = {
        "schema_version": 1,
        "normalization_version": 1,
        "common": {
            "count": len(ordered),
            "sha256": digest,
            "node_ids": ordered,
        },
        "posix_only_node_ids": list(POSIX_ONLY_NODE_IDS),
    }
    path = ctx.repo / "scripts/python-test-inventory.v1.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return path


def write_minimal_python_surface(ctx: verify.Context) -> None:
    (ctx.repo / "pyproject.toml").write_text(
        "[tool.pytest.ini_options]\n"
        'addopts = ["-ra", "--strict-markers", "--strict-config"]\n',
        encoding="utf-8",
    )
    tests = ctx.repo / "scripts/tests"
    tests.mkdir(parents=True, exist_ok=True)
    (tests / "test_probe.py").write_text(
        "def test_mandatory_probe() -> None:\n    assert True\n", encoding="utf-8"
    )
    (tests / "test_v14_migration.py").write_text(
        "import os\nimport socket\nimport pytest\n\n"
        "KINDS = [\n"
        "    'missing', 'directory', 'symlink', 'device',\n"
        "    *(['fifo'] if hasattr(os, 'mkfifo') else []),\n"
        "    *(['socket'] if hasattr(socket, 'AF_UNIX') else []),\n"
        "]\n\n"
        "@pytest.mark.parametrize('kind', KINDS)\n"
        "def test_atomic_adoption_rejects_non_regular_source(kind: str) -> None:\n"
        "    assert kind\n",
        encoding="utf-8",
    )


def platform_inventory_ids(common_node_ids: list[str]) -> list[str]:
    additions = [] if sys.platform == "win32" else list(POSIX_ONLY_NODE_IDS)
    return sorted([*common_node_ids, *additions])


def pytest_collection_output(node_ids: list[str], ending: str = "\n") -> str:
    return ending.join([*node_ids, "", f"{len(node_ids)} tests collected in 0.01s"])


def record_successfully(
    observed: list[tuple[str, ...]],
) -> Callable[[verify.Context, tuple[str, ...]], tuple[int, str]]:
    def runner(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, ""

    return runner


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
    for label in ("skipped", "todo", "pending", "excluded", "expected fail"):
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


@pytest.mark.parametrize(
    "summary",
    [
        "Tests  1 expected fail (1)",
        "Tests  50 passed | 1 expected fail (51)",
        "Tests  1 skipped | 50 passed (51)",
        "Tests  50 passed | 1 future-category (51)",
        "Tests  49 passed (50)",
    ],
)
def test_vitest_proof_accepts_only_ordinary_pass_summaries(
    fixture_repo: verify.Context,
    summary: str,
) -> None:
    proof = verify.Proof(kind="vitest_exact_tests", min_count=50)
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    assert verify.check_proof(fixture_repo, suite, proof, summary) is not None
    assert (
        verify.check_proof(
            fixture_repo,
            suite,
            proof,
            "Test Files  1 passed (1)\nTests  50 passed (50)",
        )
        is None
    )


@pytest.mark.parametrize(
    "command",
    [
        [
            "pnpm",
            "--filter",
            "@japp/probe",
            "exec",
            "vitest",
            "run",
            "--reporter=custom",
        ],
        [
            "pnpm",
            "--filter",
            "@japp/probe",
            "exec",
            "vitest",
            "run",
            "--reporter",
            "custom",
        ],
        [
            "pnpm",
            "exec",
            "turbo",
            "run",
            "test",
            "--",
            "--reporter=custom",
        ],
        [
            "pnpm",
            "exec",
            "turbo",
            "run",
            "test",
            "--",
            "--reporter",
            "custom",
        ],
    ],
)
def test_vitest_suite_rejects_repository_custom_reporter_spoof(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    command: list[str],
) -> None:
    write_vitest_workspace(fixture_repo)
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="fixture-corpus",
                commands=[command],
                proofs=[{"kind": "vitest_exact_tests", "min": 105}],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def forged_report(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, "Test Files  1 passed (1)\nTests  105 passed (105)\n"

    monkeypatch.setattr(verify, "run_command", forged_report)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("reporter" in message for message in outcome.messages)
    assert observed == []


@pytest.mark.parametrize(
    "test_script",
    [
        "vitest run --reporter=./spoof-reporter.mjs",
        "vitest run --reporter ./spoof-reporter.mjs",
    ],
)
def test_turbo_workspace_reporter_is_rejected_before_any_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    test_script: str,
) -> None:
    package_root = write_vitest_workspace(fixture_repo, test_script=test_script)
    marker = package_root / "reporter-loaded.marker"
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="unit-ts",
                commands=[["pnpm", "exec", "turbo", "run", "test", "--force"]],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def would_execute(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        marker.write_text("executed\n", encoding="utf-8")
        return 0, ""

    monkeypatch.setattr(verify, "run_command", would_execute)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("reporter" in message for message in outcome.messages)
    assert observed == []
    assert not marker.exists()


@pytest.mark.parametrize(
    "config_source",
    [
        pytest.param(
            'export default { test: { reporter: "custom" } };\n',
            id="singular-reporter",
        ),
        pytest.param(
            'import ForgedReporter from "./forged-reporter.mjs";\n'
            "const forged = new ForgedReporter();\n"
            "export default { test: { reporters: [forged] } };\n",
            id="imported-instantiated-reporters",
        ),
        pytest.param(
            'export default { test: { ["reporter"]: "custom" } };\n',
            id="static-computed-reporter",
        ),
        pytest.param(
            "declare const dynamic: object; export default { test: { ...dynamic } };\n",
            id="spread-test-config",
        ),
        pytest.param(
            "export default (() => ({ test: {} }))();\n",
            id="dynamic-default-export",
        ),
        pytest.param(
            "export default { test: {\n",
            id="malformed-config",
        ),
        pytest.param(
            "export default { test: { get reporters() { return []; } } };\n",
            id="reporters-getter",
        ),
        pytest.param(
            "export default { get test() { return { reporters: [] }; } };\n",
            id="test-getter",
        ),
        pytest.param(
            "export default { test: { async reporters() { return []; } } };\n",
            id="reporters-method",
        ),
        pytest.param(
            "const defineConfig = (value: object) => ({ ...value, "
            "test: { reporters: ['custom'] } });\n"
            "export default defineConfig({ test: {} });\n",
            id="local-define-config",
        ),
        pytest.param(
            'import { defineConfig } from "./malicious";\n'
            "export default defineConfig({ test: {} });\n",
            id="untrusted-define-config-import",
        ),
        pytest.param(
            "export default { plugins: [], test: {} };\n",
            id="unmodeled-root-plugin",
        ),
        pytest.param(
            "".join(
                [
                    'export default { test: { "repo',
                    "\\",
                    '\nrter": "custom" } };\n',
                ]
            ),
            id="escaped-line-continuation-reporter",
        ),
        pytest.param(
            "export default { test: { benchmark: { reporters: ['custom'] } } };\n",
            id="benchmark-reporters",
        ),
        pytest.param(
            "export default { test: { safe: true // hidden\r, "
            "reporters: ['./evil.mjs']\n} };\n",
            id="comment-bare-cr-reporter",
        ),
        pytest.param(
            "export default { test: { safe: true // hidden\u2028, "
            "reporters: ['./evil.mjs']\n} };\n",
            id="comment-line-separator-reporter",
        ),
        pytest.param(
            "export default { test: { safe: true // hidden\u2029, "
            "reporters: ['./evil.mjs']\n} };\n",
            id="comment-paragraph-separator-reporter",
        ),
        pytest.param(
            "export default { test: { 'repo\\\u2028rter': './evil.mjs' } };\n",
            id="line-separator-string-continuation",
        ),
        pytest.param(
            "export default { test: { 'repo\\\u2029rter': './evil.mjs' } };\n",
            id="paragraph-separator-string-continuation",
        ),
    ],
)
def test_vitest_config_reporter_surface_is_rejected_before_any_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    config_source: str,
) -> None:
    package_root = write_vitest_workspace(fixture_repo)
    (package_root / "vitest.config.ts").write_text(config_source, encoding="utf-8")
    marker = package_root / "config-loaded.marker"
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="fixture-corpus",
                commands=[
                    [
                        "pnpm",
                        "--filter",
                        "@japp/probe",
                        "exec",
                        "vitest",
                        "run",
                    ]
                ],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def would_execute(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        marker.write_text("executed\n", encoding="utf-8")
        return 0, ""

    monkeypatch.setattr(verify, "run_command", would_execute)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []
    assert not marker.exists()


@pytest.mark.parametrize(
    "config_source",
    [
        (
            'import { defineConfig } from "vitest/config";\n'
            "// reporter is an ordinary English word in this comment.\n"
            "export default defineConfig({\n"
            "  test: { coverage: { reporter: ['text'] },\n"
            "    description: 'reporter documentation', testTimeout: 1_000 },\n"
            "});\n"
        ),
        "export default { test: { fileParallelism: false } };\n",
    ],
)
def test_vitest_config_preflight_allows_static_nonreporter_controls(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    config_source: str,
) -> None:
    package_root = write_vitest_workspace(fixture_repo)
    (package_root / "vitest.config.ts").write_text(config_source, encoding="utf-8")
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="fixture-corpus",
                commands=[
                    [
                        "pnpm",
                        "--filter",
                        "@japp/probe",
                        "exec",
                        "vitest",
                        "run",
                    ]
                ],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def record_command(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, ""

    monkeypatch.setattr(verify, "run_command", record_command)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    assert len(observed) == 1
    assert "--reporter=default" in observed[0]


def test_reached_root_vitest_reporter_is_rejected_before_any_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    package = json.loads(
        (fixture_repo.repo / "package.json").read_text(encoding="utf-8")
    )
    package["scripts"]["test"] = "vitest run --reporter=./spoof-reporter.mjs"
    (fixture_repo.repo / "package.json").write_text(
        json.dumps(package), encoding="utf-8"
    )
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[["pnpm", "test"]])],
    )
    marker = fixture_repo.repo / "root-reporter-loaded.marker"
    observed: list[tuple[str, ...]] = []

    def would_execute(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        marker.write_text("executed\n", encoding="utf-8")
        return 0, ""

    monkeypatch.setattr(verify, "run_command", would_execute)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []
    assert not marker.exists()


@pytest.mark.parametrize(
    "command",
    [
        pytest.param(
            ["pnpm", "test", "--reporter=./spoof-reporter.mjs"],
            id="root-reporter-equals",
        ),
        pytest.param(
            ["pnpm", "test", "--reporter", "./spoof-reporter.mjs"],
            id="root-reporter-split",
        ),
        pytest.param(
            ["pnpm", "test", "--", "--config=./unscanned.config.ts"],
            id="root-forwarded-config",
        ),
        pytest.param(
            ["pnpm", "test", "--", "--root=./unscanned"],
            id="root-forwarded-root",
        ),
        pytest.param(
            [
                "pnpm",
                "--filter",
                "@japp/probe",
                "exec",
                "vitest",
                "run",
                "-cfoo",
            ],
            id="direct-attached-config",
        ),
        pytest.param(
            [
                "pnpm",
                "--filter",
                "@japp/probe",
                "exec",
                "vitest",
                "run",
                "-rfoo",
            ],
            id="direct-attached-root",
        ),
        pytest.param(
            ["pnpm", "-C", "unscanned", "exec", "vitest", "run"],
            id="pnpm-directory-override",
        ),
        pytest.param(
            ["pnpm", "run", "--filter", "@japp/probe", "test"],
            id="run-option-before-test",
        ),
        pytest.param(
            ["pnpm", "run", "--if-present", "test"],
            id="run-if-present",
        ),
        pytest.param(
            ["pnpm", "--recursive", "exec", "vitest", "run"],
            id="recursive-direct",
        ),
        pytest.param(
            ["pnpm", "--filter-prod", "@japp/probe", "exec", "vitest", "run"],
            id="filter-prod-direct",
        ),
        pytest.param(
            [
                "pnpm",
                "--filter",
                "@japp/probe",
                "--filter",
                "@japp/contracts",
                "exec",
                "vitest",
                "run",
            ],
            id="repeated-filter-direct",
        ),
        pytest.param(
            [
                "pnpm",
                "--filter",
                "@japp/probe",
                "--workspace-root",
                "exec",
                "vitest",
                "run",
            ],
            id="workspace-root-direct",
        ),
        pytest.param(
            ["pnpm", "exec", "turbo", "run", "--force", "test"],
            id="turbo-option-before-task",
        ),
        pytest.param(
            ["pnpm", "exec", "turbo", "run", "typecheck", "test"],
            id="turbo-multiple-tasks",
        ),
        pytest.param(
            ["pnpm", "exec", "turbo", "run", "test", "--cwd=unscanned"],
            id="turbo-cwd-override",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "turbo",
                "run",
                "test",
                "--root-turbo-json=unscanned.json",
            ],
            id="turbo-root-config-override",
        ),
        pytest.param(
            ["pnpm", "exec", "--", "vitest", "run"],
            id="outer-delimiter-direct",
        ),
        pytest.param(
            ["pnpm", "exec", "--", "turbo", "run", "test"],
            id="outer-delimiter-turbo",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "vitest.cmd",
                "run",
                "--reporter=./evil.mjs",
            ],
            id="direct-vitest-cmd-reporter",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "turbo",
                "run",
                "@japp/probe#test",
                "--",
                "--reporter=./evil.mjs",
            ],
            id="turbo-qualified-test-task",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "turbo",
                "run",
                "//#test",
                "--",
                "--reporter=./evil.mjs",
            ],
            id="turbo-root-qualified-test-task",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "vitest",
                "run",
                "--",
                "--filter",
                "@japp/probe",
            ],
            id="forwarded-filter-does-not-select-config-root",
        ),
        pytest.param(
            [
                "pnpm",
                "exec",
                "turbo",
                "run",
                "test",
                "--",
                "--pool=threads",
                "--",
            ],
            id="turbo-multiple-forwarded-delimiters",
        ),
    ],
)
def test_vitest_outer_forwarding_and_execution_root_overrides_are_zero_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    command: list[str],
) -> None:
    package = json.loads(
        (fixture_repo.repo / "package.json").read_text(encoding="utf-8")
    )
    package["scripts"]["test"] = "vitest run"
    (fixture_repo.repo / "package.json").write_text(
        json.dumps(package), encoding="utf-8"
    )
    if "@japp/probe" in command:
        write_vitest_workspace(fixture_repo)
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[command])],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []


@pytest.mark.parametrize(
    "test_script",
    [
        pytest.param(
            "FLAG=--reporter=./evil.mjs; vitest run $FLAG",
            id="shell-indirection",
        ),
        pytest.param("node ./vitest-wrapper.mjs", id="wrapped-invocation"),
        pytest.param("vitest run --repo* ./evil.mjs", id="posix-glob-expansion"),
        pytest.param("vitest run --rep^orter=./evil.mjs", id="windows-caret-expansion"),
        pytest.param("vitest run --", id="embedded-forwarded-delimiter"),
    ],
)
def test_dynamic_or_wrapped_root_test_script_is_zero_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    test_script: str,
) -> None:
    package = json.loads(
        (fixture_repo.repo / "package.json").read_text(encoding="utf-8")
    )
    package["scripts"]["test"] = test_script
    (fixture_repo.repo / "package.json").write_text(
        json.dumps(package), encoding="utf-8"
    )
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[["pnpm", "test"]])],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []


def test_named_vitest_script_reporter_is_rejected_before_any_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest = fixture_repo.repo / "package.json"
    package = json.loads(manifest.read_text(encoding="utf-8"))
    package["scripts"]["test:custom"] = "vitest run --reporter=./evil.mjs"
    manifest.write_text(json.dumps(package), encoding="utf-8")
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="unit-ts",
                commands=[["pnpm", "run", "test:custom"]],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(verify, "run_command", record_successfully(observed))
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []


@pytest.mark.parametrize("surface", ["root-pretest", "workspace-posttest"])
def test_reached_test_lifecycle_hooks_are_zero_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    surface: str,
) -> None:
    if surface == "root-pretest":
        manifest = fixture_repo.repo / "package.json"
        package = json.loads(manifest.read_text(encoding="utf-8"))
        package["scripts"]["test"] = "vitest run"
        package["scripts"]["pretest"] = "vitest run --reporter=./evil.mjs"
        manifest.write_text(json.dumps(package), encoding="utf-8")
        command = ["pnpm", "test"]
    else:
        package_root = write_vitest_workspace(fixture_repo)
        manifest = package_root / "package.json"
        package = json.loads(manifest.read_text(encoding="utf-8"))
        package["scripts"]["posttest"] = "vitest run --reporter=./evil.mjs"
        manifest.write_text(json.dumps(package), encoding="utf-8")
        command = ["pnpm", "exec", "turbo", "run", "test"]
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[command])],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []


@pytest.mark.parametrize("mutation", ["dependency", "package-config"])
def test_turbo_reporter_graph_expansion_is_zero_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    mutation: str,
) -> None:
    package_root = write_vitest_workspace(fixture_repo)
    if mutation == "dependency":
        (fixture_repo.repo / "turbo.json").write_text(
            json.dumps(
                {
                    "tasks": {
                        "test": {"dependsOn": ["//#test"]},
                        "//#test": {},
                    }
                }
            ),
            encoding="utf-8",
        )
    else:
        (package_root / "turbo.json").write_text(
            json.dumps({"tasks": {"test": {}}}), encoding="utf-8"
        )
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="unit-ts",
                commands=[["pnpm", "exec", "turbo", "run", "test"]],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert observed == []


def test_workspace_single_quotes_are_supported_but_flow_syntax_fails_closed(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_vitest_workspace(fixture_repo)
    workspace = fixture_repo.repo / "pnpm-workspace.yaml"
    command = ["pnpm", "exec", "turbo", "run", "test"]
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[command])],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)

    workspace.write_text("packages:\n  - 'packages/*'\n", encoding="utf-8")
    accepted = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert accepted.verdict is verify.Verdict.PASS
    assert len(observed) == 1

    observed.clear()
    workspace.write_text("packages: ['packages/*']\n", encoding="utf-8")
    rejected = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert rejected.verdict is verify.Verdict.FAIL
    assert observed == []


def test_root_vitest_script_reuses_existing_forward_separator(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    package = json.loads(
        (fixture_repo.repo / "package.json").read_text(encoding="utf-8")
    )
    package["scripts"]["test"] = "vitest run"
    (fixture_repo.repo / "package.json").write_text(
        json.dumps(package), encoding="utf-8"
    )
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="unit-ts",
                commands=[["pnpm", "test", "--", "--pool=threads"]],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []
    monkeypatch.setattr(
        verify,
        "run_command",
        record_successfully(observed),
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    assert observed[0].count("--") == 1
    assert observed[0][-2:] == ("--reporter=default", "--pool=threads")


def test_vitest_suite_forces_default_reporter_and_rejects_expected_fail_filler(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_vitest_workspace(fixture_repo)
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="fixture-corpus",
                commands=[
                    [
                        "pnpm",
                        "--filter",
                        "@japp/probe",
                        "exec",
                        "vitest",
                        "run",
                        "test/m02-w01",
                    ]
                ],
                proofs=[{"kind": "vitest_exact_tests", "min": 105}],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def expected_fail_report(
        _ctx: verify.Context, argv: tuple[str, ...]
    ) -> tuple[int, str]:
        observed.append(argv)
        return (
            0,
            "Test Files  1 passed (1)\nTests  105 passed | 1 expected fail (106)\n",
        )

    monkeypatch.setattr(verify, "run_command", expected_fail_report)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert "--reporter=default" in observed[0]
    assert any("expected fail" in message for message in outcome.messages)


def test_turbo_vitest_suite_forces_default_reporter(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_vitest_workspace(fixture_repo)
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="unit-ts",
                commands=[["pnpm", "exec", "turbo", "run", "test", "--force"]],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def record_command(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, ""

    monkeypatch.setattr(verify, "run_command", record_command)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    assert observed[0][-2:] == ("--", "--reporter=default")


def test_turbo_vitest_suite_preserves_safe_forwarded_arguments(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_vitest_workspace(fixture_repo)
    command = [
        "pnpm",
        "exec",
        "turbo",
        "run",
        "test",
        "--force",
        "--",
        "--pool=threads",
    ]
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="unit-ts", commands=[command])],
    )
    observed: list[tuple[str, ...]] = []

    def record_command(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, ""

    monkeypatch.setattr(verify, "run_command", record_command)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    assert observed[0][-3:] == (
        "--",
        "--reporter=default",
        "--pool=threads",
    )


@pytest.mark.parametrize(
    "summary",
    [
        "10 passed, 1 skipped in 0.10s",
        "10 passed, 1 xfailed in 0.10s",
        "10 passed, 1 xpassed in 0.10s",
        "10 passed, 1 deselected in 0.10s",
        "10 passed, 1 failed in 0.10s",
        "10 passed, 1 error in 0.10s",
        "10 passed, 1 rerun in 0.10s",
        "10 passed, 1 mystery in 0.10s",
        "10 passed nonsense",
        "ten passed in 0.10s",
        "10 passed in yesterday",
        "10 passed in 0s",
        "10 passed in 0.1s",
        "10 passed in 60.00s",
        "10 passed in 0.10s (0:00:00)",
        "10 passed in 61.00s (0:01:00)",
    ],
)
@pytest.mark.parametrize("line_ending", ["\n", "\r\n"])
def test_pytest_proof_rejects_every_nonordinary_or_unknown_summary(
    fixture_repo: verify.Context,
    summary: str,
    line_ending: str,
) -> None:
    fixture_repo.python_expected_count = 10
    fixture_repo.python_expected_digest = "expected"
    proof = verify.Proof(kind="pytest_exact_inventory")
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    output = f"================ {summary} ================{line_ending}"
    assert verify.check_proof(fixture_repo, suite, proof, output) is not None


@pytest.mark.parametrize("line_ending", ["\n", "\r\n"])
@pytest.mark.parametrize("duration", ["0.10s", "110.39s (0:01:50)"])
def test_pytest_proof_accepts_one_final_exact_ordinary_summary(
    fixture_repo: verify.Context,
    line_ending: str,
    duration: str,
) -> None:
    fixture_repo.python_expected_count = 10
    fixture_repo.python_expected_digest = "expected"
    proof = verify.Proof(kind="pytest_exact_inventory")
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    assert (
        verify.check_proof(
            fixture_repo,
            suite,
            proof,
            "10 tests collected in 0.01s"
            f"{line_ending}================ 10 passed in {duration} "
            f"================{line_ending}",
        )
        is None
    )


@pytest.mark.parametrize(
    "output",
    [
        "ordinary output without a terminal summary\n",
        (
            "================ 10 passed in 0.10s ================\n"
            "================ 10 passed in 0.11s ================\n"
        ),
        "================ 10 passed in 0.10s ================\ntrailing text\n",
        "================ 10 passed in 0.10s ================\r",
        "================ 9 passed in 0.10s ================\n",
    ],
)
def test_pytest_proof_rejects_missing_ambiguous_nonfinal_or_wrong_count(
    fixture_repo: verify.Context,
    output: str,
) -> None:
    fixture_repo.python_expected_count = 10
    fixture_repo.python_expected_digest = "expected"
    proof = verify.Proof(kind="pytest_exact_inventory")
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    assert verify.check_proof(fixture_repo, suite, proof, output) is not None


@pytest.mark.parametrize("category", ["mystery", "warning"])
def test_pytest_proof_rejects_competing_unknown_only_summary(
    fixture_repo: verify.Context,
    category: str,
) -> None:
    fixture_repo.python_expected_count = 10
    fixture_repo.python_expected_digest = "expected"
    proof = verify.Proof(kind="pytest_exact_inventory")
    suite = verify.load_registry(fixture_repo.registry_path).suites[0]
    output = (
        f"================ 1 {category} in 0.01s ================\n"
        "================ 10 passed in 0.10s ================\n"
    )
    assert verify.check_proof(fixture_repo, suite, proof, output) is not None


def test_python_inventory_loads_exact_windows_and_posix_identities(
    fixture_repo: verify.Context,
) -> None:
    write_minimal_python_surface(fixture_repo)
    common = [
        "scripts/tests/test_probe.py::test_mandatory_probe",
        (
            "scripts/tests/test_v14_migration.py::"
            "test_atomic_adoption_rejects_non_regular_source"
        ),
    ]
    write_python_inventory(fixture_repo, common)
    test_relatives = (
        "scripts/tests/test_probe.py",
        "scripts/tests/test_v14_migration.py",
    )
    windows, windows_failure = verify._load_python_test_inventory(
        fixture_repo, test_relatives, "win32"
    )
    posix, posix_failure = verify._load_python_test_inventory(
        fixture_repo, test_relatives, "linux"
    )
    assert windows_failure is None
    assert posix_failure is None
    assert windows is not None
    assert posix is not None
    assert windows.node_ids == tuple(sorted(common))
    assert posix.node_ids == tuple(sorted([*common, *POSIX_ONLY_NODE_IDS]))
    assert posix.count == windows.count + 2
    assert set(posix.node_ids).difference(windows.node_ids) == set(POSIX_ONLY_NODE_IDS)
    assert windows.sha256 != posix.sha256
    unsupported, unsupported_failure = verify._load_python_test_inventory(
        fixture_repo, test_relatives, "unsupported"
    )
    assert unsupported is None
    assert unsupported_failure is not None


@pytest.mark.parametrize(
    "mutation",
    ["malformed", "duplicate", "unsorted", "noncanonical", "wrong_delta"],
)
def test_python_inventory_rejects_malformed_duplicate_or_unsorted_identity(
    fixture_repo: verify.Context,
    mutation: str,
) -> None:
    write_minimal_python_surface(fixture_repo)
    path = write_python_inventory(
        fixture_repo,
        [
            "scripts/tests/test_probe.py::test_mandatory_probe",
            (
                "scripts/tests/test_v14_migration.py::"
                "test_atomic_adoption_rejects_non_regular_source"
            ),
        ],
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    if mutation == "malformed":
        path.write_text("{}\n", encoding="utf-8")
    elif mutation == "duplicate":
        payload["common"]["node_ids"].append(payload["common"]["node_ids"][0])
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    elif mutation == "unsorted":
        payload["common"]["node_ids"].reverse()
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    elif mutation == "noncanonical":
        path.write_text(json.dumps(payload), encoding="utf-8")
    else:
        payload["posix_only_node_ids"].append(
            "scripts/tests/test_probe.py::test_third_platform_delta"
        )
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    inventory, failure = verify._load_python_test_inventory(
        fixture_repo,
        (
            "scripts/tests/test_probe.py",
            "scripts/tests/test_v14_migration.py",
        ),
    )
    assert inventory is None
    assert failure is not None


@pytest.mark.parametrize("kind", ["directory", "symlink"])
def test_python_inventory_rejects_nonregular_or_symlink_path(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    kind: str,
) -> None:
    write_minimal_python_surface(fixture_repo)
    path = write_python_inventory(
        fixture_repo, ["scripts/tests/test_probe.py::test_mandatory_probe"]
    )
    if kind == "directory":
        path.unlink()
        path.mkdir()
    else:
        original_is_symlink = Path.is_symlink
        monkeypatch.setattr(
            Path,
            "is_symlink",
            lambda candidate: candidate == path or original_is_symlink(candidate),
        )
    inventory, failure = verify._load_python_test_inventory(
        fixture_repo,
        ("scripts/tests/test_probe.py", "scripts/tests/test_v14_migration.py"),
    )
    assert inventory is None
    assert failure is not None


@pytest.mark.parametrize(
    "output",
    [
        (
            "scripts/tests/test_probe.py::test_probe\n"
            "scripts/tests/test_probe.py::test_probe\n\n"
            "2 tests collected in 0.01s\n"
        ),
        "scripts/tests/test_unknown.py::test_probe\n\n1 test collected in 0.01s\n",
        "scripts/tests/test_probe.py::test_probe\n\n2 tests collected in 0.01s\n",
        "scripts/tests/test_probe.py::test_probe\n\ncollection complete\n",
        "scripts/tests/test_probe.py::test_probe\r1 test collected in 0.01s\r",
        (
            "scripts/tests/test_probe.py::test_probe\n\n"
            "1 test collected in 0.01s (0:00:00)\n"
        ),
        (
            "scripts/tests/test_probe.py::test_probe\n\n"
            "1 test collected in 61.00s (0:01:00)\n"
        ),
    ],
)
def test_python_collection_parser_rejects_duplicate_unknown_or_malformed_ids(
    output: str,
) -> None:
    node_ids, failure = verify._parse_pytest_collection_output(
        output, ("scripts/tests/test_probe.py",)
    )
    assert node_ids is None
    assert failure is not None


def test_python_collection_parser_normalizes_only_the_node_path() -> None:
    selector = r"test_probe[value\with\meaningful\backslashes]"
    output = (
        f"scripts\\tests\\test_probe.py::{selector}\r\n\r\n"
        "1 test collected in 0.01s\r\n"
    )
    node_ids, failure = verify._parse_pytest_collection_output(
        output, ("scripts/tests/test_probe.py",)
    )
    assert failure is None
    assert node_ids == (f"scripts/tests/test_probe.py::{selector}",)


def test_python_collection_parser_accepts_pinned_long_duration() -> None:
    output = (
        "scripts/tests/test_probe.py::test_probe\n\n"
        "1 test collected in 61.00s (0:01:01)\n"
    )
    node_ids, failure = verify._parse_pytest_collection_output(
        output, ("scripts/tests/test_probe.py",)
    )
    assert failure is None
    assert node_ids == ("scripts/tests/test_probe.py::test_probe",)


def test_python_suite_requires_inventory_before_any_child(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_minimal_python_surface(fixture_repo)
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[["uv", "run", "pytest"]],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def should_not_run(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        return 0, ""

    monkeypatch.setattr(verify, "run_command", should_not_run)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("inventory" in message.lower() for message in outcome.messages)
    assert observed == []


@pytest.mark.parametrize(
    ("mutation", "source", "replacement_ids"),
    [
        pytest.param(
            "platform-conditioned definition",
            (
                "import sys\n"
                "if sys.platform == 'unsupported':\n"
                "    def test_mandatory() -> None:\n"
                "        assert True\n"
                "def test_platform_filler() -> None:\n"
                "    assert True\n"
            ),
            ["scripts/tests/test_inventory.py::test_platform_filler"],
            id="platform-definition",
        ),
        pytest.param(
            "conditionally empty parameter table",
            (
                "import pytest\n"
                "rows: list[str] = []\n"
                "if rows:\n"
                "    @pytest.mark.parametrize('row', rows)\n"
                "    def test_parameterized(row: str) -> None:\n"
                "        assert row\n"
                "def test_filler_one() -> None:\n    assert True\n"
                "def test_filler_two() -> None:\n    assert True\n"
                "def test_filler_three() -> None:\n    assert True\n"
            ),
            [
                "scripts/tests/test_inventory.py::test_filler_one",
                "scripts/tests/test_inventory.py::test_filler_two",
                "scripts/tests/test_inventory.py::test_filler_three",
            ],
            id="empty-parameter-definition",
        ),
        pytest.param(
            "unknown replacement",
            "def test_unknown_replacement() -> None:\n    assert True\n",
            ["scripts/tests/test_inventory.py::test_unknown_replacement"],
            id="unknown-replacement",
        ),
    ],
)
def test_python_inventory_rejects_count_preserving_identity_replacements(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    mutation: str,
    source: str,
    replacement_ids: list[str],
) -> None:
    write_minimal_python_surface(fixture_repo)
    attack = fixture_repo.repo / "scripts/tests/test_inventory.py"
    attack.write_text(source, encoding="utf-8")
    stable = "scripts/tests/test_probe.py::test_mandatory_probe"
    expected_attack_ids = [
        f"scripts/tests/test_inventory.py::test_expected_{index}"
        for index in range(len(replacement_ids))
    ]
    common = [stable, *expected_attack_ids]
    write_python_inventory(fixture_repo, common)
    collected = platform_inventory_ids([stable, *replacement_ids])
    assert len(collected) == len(platform_inventory_ids(common)), mutation
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[["uv", "run", "pytest"]],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def collection_only(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        if "--collect-only" in argv:
            return 0, pytest_collection_output(collected)
        return 0, (
            f"================ {len(collected)} passed in 0.10s ================\n"
        )

    monkeypatch.setattr(verify, "run_command", collection_only)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("inventory" in message.lower() for message in outcome.messages)
    assert len(observed) == 1
    assert "--collect-only" in observed[0]


@pytest.mark.parametrize(
    ("source", "expected_count"),
    [
        pytest.param(
            "".join(
                [
                    "import sys\n",
                    "if sys.platform == 'unsupported':\n",
                    "    def test_mandatory() -> None:\n",
                    "        assert True\n",
                    "def test_platform_filler() -> None:\n",
                    "    assert True\n",
                ]
            ),
            1,
            id="platform-definition",
        ),
        pytest.param(
            "".join(
                [
                    "import pytest\n",
                    "rows: list[str] = []\n",
                    "if rows:\n",
                    "    @pytest.mark.parametrize('row', rows)\n",
                    "    def test_parameterized(row: str) -> None:\n",
                    "        assert row\n",
                    "def test_filler_one() -> None:\n    assert True\n",
                    "def test_filler_two() -> None:\n    assert True\n",
                    "def test_filler_three() -> None:\n    assert True\n",
                ]
            ),
            3,
            id="empty-parameter-definition",
        ),
        pytest.param(
            "def test_unknown_replacement() -> None:\n    assert True\n",
            1,
            id="unknown-replacement",
        ),
    ],
)
def test_python_inventory_mutations_are_real_count_preserving_collections(
    tmp_path: Path,
    source: str,
    expected_count: int,
) -> None:
    config = tmp_path / "pytest.ini"
    config.write_text("[pytest]\n", encoding="utf-8")
    test_file = tmp_path / "test_inventory.py"
    expected_source = "".join(
        f"def test_expected_{index}() -> None:\n    assert True\n"
        for index in range(expected_count)
    )
    environment = dict(os.environ)
    environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"

    def collect(candidate_source: str) -> tuple[str, ...]:
        test_file.write_text(candidate_source, encoding="utf-8")
        completed = subprocess.run(
            (
                sys.executable,
                "-m",
                "pytest",
                "-c",
                str(config),
                "--rootdir=.",
                "--confcutdir=.",
                "--collect-only",
                "-q",
                "test_inventory.py",
            ),
            cwd=tmp_path,
            env=environment,
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            check=False,
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr
        node_ids, failure = verify._parse_pytest_collection_output(
            completed.stdout + completed.stderr, ("test_inventory.py",)
        )
        assert failure is None
        assert node_ids is not None
        return node_ids

    expected_ids = collect(expected_source)
    mutated_ids = collect(source)
    assert len(expected_ids) == len(mutated_ids) == expected_count
    assert expected_ids != mutated_ids

    completed = subprocess.run(
        (
            sys.executable,
            "-m",
            "pytest",
            "-c",
            str(config),
            "--rootdir=.",
            "--confcutdir=.",
            "-ra",
            "--strict-markers",
            "--strict-config",
            "test_inventory.py",
        ),
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        encoding="utf-8",
        errors="strict",
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    passed, failure = verify._pytest_terminal_pass_count(
        completed.stdout + completed.stderr
    )
    assert failure is None
    assert passed == expected_count


@pytest.mark.parametrize(
    "source",
    [
        "pytest_collection_modifyitems = remove_substantive\n",
        "pytest_collection_finish = remove_substantive\n",
        "from helpers import run as pytest_runtestloop\n",
        "pytest_collection_modifyitems = lambda items: items.clear()\n",
        'pytest_plugins = ["inventory_plugin"]\n',
        (
            "pytest_collection_modifyitems, ordinary = "
            "(lambda items: items.clear(), None)\n"
        ),
        "pytest_collection_modifyitems: object = lambda items: items.clear()\n",
        "(pytest_collection_modifyitems := lambda items: items.clear())\n",
        "from helpers import remove as pytest_collection_modifyitems\n",
        (
            "for pytest_collection_modifyitems in "
            "[lambda items: items.clear()]:\n"
            "    pass\n"
        ),
        (
            "from contextlib import nullcontext\n"
            "with nullcontext(lambda items: items.clear()) "
            "as pytest_collection_modifyitems:\n"
            "    pass\n"
        ),
        (
            "match (lambda items: items.clear()):\n"
            "    case pytest_collection_modifyitems:\n"
            "        pass\n"
        ),
        ('match ["test_probe.py"]:\n    case [*collect_ignore]:\n        pass\n'),
        (
            'match {"hook": lambda items: items.clear()}:\n'
            "    case {**pytest_collection_modifyitems}:\n"
            "        pass\n"
        ),
        ('globals()["pytest_collection_modifyitems"] = lambda items: items.clear()\n'),
        ('locals()["pytest_collection_modifyitems"] = lambda items: items.clear()\n'),
        ('vars()["pytest_collection_modifyitems"] = lambda items: items.clear()\n'),
        (
            "import sys\n"
            'vars(sys.modules[__name__])["pytest_collection_modifyitems"] = '
            "lambda items: items.clear()\n"
        ),
        (
            "import sys\n"
            'sys.modules[__name__].__dict__["pytest_collection_modifyitems"] = '
            "lambda items: items.clear()\n"
        ),
        (
            "import sys\n"
            "setattr(\n"
            "    sys.modules[__name__],\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "namespace = globals()\n"
            'hook = "pytest_collection_" + "modifyitems"\n'
            "namespace[hook] = lambda items: items.clear()\n"
        ),
        (
            "namespace = globals()\n"
            "namespace.__setitem__(\n"
            '    "pytest_collection_modifyitems", lambda items: items.clear()\n'
            ")\n"
        ),
        (
            "from operator import setitem\n"
            "setitem(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "import operator as op\n"
            "op.setitem(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "from operator import setitem as install\n"
            "reflect = install\n"
            "hook = 'pytest_collection_' + 'modifyitems'\n"
            "reflect(globals(), hook, lambda items: items.clear())\n"
        ),
        (
            "import operator\n"
            "getattr(operator, 'setitem')(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "import operator\n"
            "from operator import attrgetter\n"
            "attrgetter('setitem')(operator)(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "from operator import ior\n"
            "ior(\n"
            "    globals(),\n"
            '    {"pytest_collection_modifyitems": lambda items: items.clear()},\n'
            ")\n"
        ),
        (
            "dict.__setitem__(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "dict.update(\n"
            "    globals(),\n"
            '    {"pytest_collection_modifyitems": lambda items: items.clear()},\n'
            ")\n"
        ),
        (
            "dict.setdefault(\n"
            "    globals(),\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "updater = dict.update\n"
            "updater(\n"
            "    globals(),\n"
            '    {"pytest_collection_modifyitems": lambda items: items.clear()},\n'
            ")\n"
        ),
        (
            "getattr(dict, 'up' + 'date')(\n"
            "    globals(),\n"
            '    {"pytest_collection_modifyitems": lambda items: items.clear()},\n'
            ")\n"
        ),
        (
            "getattr(globals(), '__set' + 'item__')(\n"
            '    "pytest_collection_modifyitems",\n'
            "    lambda items: items.clear(),\n"
            ")\n"
        ),
        (
            "from operator import setitem\n"
            "setitem(globals(), input(), lambda items: items.clear())\n"
        ),
        (
            "def install_hook(namespace: dict[str, object]) -> None:\n"
            '    namespace["pytest_collection_modifyitems"] = object()\n'
            "install_hook(globals())\n"
        ),
        (
            "def install_hook(mutate: object) -> None:\n"
            "    return None\n"
            "install_hook(globals().__setitem__)\n"
        ),
        (
            "def install_hook(mutate: object) -> None:\n"
            "    return None\n"
            "mutate = getattr(globals(), '__set' + 'item__')\n"
            "install_hook(mutate)\n"
        ),
        (
            "def install(\n"
            "    namespace: dict[str, object] = globals(),\n"
            ") -> None:\n"
            '    namespace["pytest_collection_modifyitems"] = object()\n'
            "install()\n"
        ),
        (
            "from collections.abc import MutableMapping\n"
            "_DEFAULT_NAMESPACE: MutableMapping[str, object] = globals()\n"
            "def install(\n"
            "    namespace: MutableMapping[str, object] = _DEFAULT_NAMESPACE,\n"
            ") -> None:\n"
            '    namespace["pytest_collection_modifyitems"] = object()\n'
            "install()\n"
        ),
        (
            "container = [globals()]\n"
            'container[0]["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "from _pytest.nodes import Item\n"
            'TARGET = "test_real_registry_loads_and_states_match_project_state"\n'
            "def _remove(items: list[Item]) -> None:\n"
            "    items[:] = [item for item in items if item.name != TARGET]\n"
            "_NAMESPACES: list[dict[str, object]] = [globals()]\n"
            '_NAMESPACES[0]["pytest_collection_modifyitems"] = _remove\n'
        ),
        (
            "container = {'namespace': globals()}\n"
            'container["namespace"]["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "match globals():\n"
            "    case namespace:\n"
            '        namespace["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "import sys\n"
            "module = sys.modules.get(__name__)\n"
            "if module is not None:\n"
            '    vars(module)["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "def pytest_addoption(pluginmanager: object) -> None:\n"
            '    pluginmanager.import_plugin("inventory_plugin")\n'
        ),
        (
            "from _pytest.main import Session\n"
            "def pytest_sessionstart(session: Session) -> None:\n"
            '    session.config.pluginmanager.import_plugin("inventory_plugin")\n'
        ),
        (
            "def pytest_sessionstart(session: object) -> None:\n"
            "    manager = session.config.pluginmanager\n"
            "    load = manager.import_plugin\n"
            '    load("inventory_plugin")\n'
        ),
        (
            "def pytest_sessionstart(session: object) -> None:\n"
            "    session.config.pluginmanager.load_setuptools_entrypoints(\n"
            '        "pytest11"\n'
            "    )\n"
        ),
        (
            "def pytest_load_initial_conftests(early_config: object) -> None:\n"
            "    early_config.pluginmanager.consider_module(inventory_plugin)\n"
        ),
        (
            "def pytest_load_initial_conftests(early_config: object) -> None:\n"
            "    early_config.pluginmanager.consider_env()\n"
        ),
        (
            "def pytest_load_initial_conftests(early_config: object) -> None:\n"
            "    early_config.pluginmanager.consider_preparse(\n"
            '        ["-p", "inventory_plugin"]\n'
            "    )\n"
        ),
        ("hook = input()\nglobals()[hook] = lambda items: items.clear()\n"),
        (
            "import sys\n"
            "hook = input()\n"
            "setattr(sys.modules[__name__], hook, lambda items: items.clear())\n"
        ),
        (
            "def install() -> None:\n"
            '    globals()["pytest_collection_modifyitems"] = '
            "lambda items: items.clear()\n"
            "install()\n"
        ),
        (
            "import sys\n"
            "def install() -> None:\n"
            "    namespace = vars(sys.modules[__name__])\n"
            '    namespace["pytest_collection_modifyitems"] = '
            "lambda items: items.clear()\n"
            "install()\n"
        ),
        (
            "import sys\n"
            "def install() -> None:\n"
            "    setattr(\n"
            "        sys.modules[__name__],\n"
            '        "pytest_collection_modifyitems",\n'
            "        lambda items: items.clear(),\n"
            "    )\n"
            "install()\n"
        ),
        (
            "namespace_factory = globals\n"
            'namespace_factory()["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "import sys\n"
            "reflect = setattr\n"
            "reflect(\n"
            "    sys.modules[__name__],\n"
            '    "pytest_collection_modifyitems",\n'
            "    object(),\n"
            ")\n"
        ),
        (
            "import builtins\n"
            "import sys\n"
            "builtins.setattr(\n"
            "    sys.modules[__name__],\n"
            '    "pytest_collection_modifyitems",\n'
            "    object(),\n"
            ")\n"
        ),
        (
            "def install() -> None:\n"
            "    global pytest_collection_modifyitems\n"
            "    pytest_collection_modifyitems = lambda items: items.clear()\n"
            "install()\n"
        ),
        (
            "globals().update(\n"
            '    {"pytest_collection_modifyitems": lambda items: items.clear()}\n'
            ")\n"
        ),
        (
            "globals().update(\n"
            "    pytest_collection_modifyitems=lambda items: items.clear()\n"
            ")\n"
        ),
        (
            "namespace = globals()\n"
            "namespace |= {\n"
            '    "pytest_collection_modifyitems": lambda items: items.clear()\n'
            "}\n"
        ),
        (
            "globals().setdefault(\n"
            '    "pytest_collection_modifyitems", lambda items: items.clear()\n'
            ")\n"
        ),
        (
            "def pytest_configure(config: object) -> None:\n"
            "    config.pluginmanager.register(inventory_plugin)\n"
        ),
        (
            "pytest_configure = "
            "lambda config: config.pluginmanager.register(inventory_plugin)\n"
        ),
        (
            "def configure(config: object) -> None:\n"
            "    config.pluginmanager.register(inventory_plugin)\n"
            "pytest_configure = configure\n"
        ),
        (
            "values = [\n"
            "    (pytest_collection_modifyitems := value)\n"
            "    for value in [lambda items: items.clear()]\n"
            "]\n"
        ),
    ],
)
def test_python_policy_rejects_module_collection_hook_bindings(
    source: str,
) -> None:
    reason = verify._python_pytest_policy_reason(source)
    assert reason is not None, source
    assert "collection" in reason


@pytest.mark.parametrize(
    "source",
    [
        (
            "values = [\n"
            "    pytest_collection_modifyitems\n"
            "    for pytest_collection_modifyitems in [1]\n"
            "]\n"
        ),
        (
            "values = {\n"
            "    pytest_collection_modifyitems\n"
            "    for pytest_collection_modifyitems in [1]\n"
            "}\n"
        ),
        (
            "values = {\n"
            "    pytest_collection_modifyitems: pytest_collection_modifyitems\n"
            "    for pytest_collection_modifyitems in [1]\n"
            "}\n"
        ),
        (
            "values = (\n"
            "    pytest_collection_modifyitems\n"
            "    for pytest_collection_modifyitems in [1]\n"
            ")\n"
        ),
        (
            "import pytest\n"
            "reporters = [object()]\n"
            "values = [pytest.skip() for pytest in reporters]\n"
        ),
        (
            "def helper(value: object) -> object:\n"
            "    pytest_collection_modifyitems = value\n"
            "    return pytest_collection_modifyitems\n"
        ),
        (
            "def helper(value: object) -> object:\n"
            "    match value:\n"
            "        case pytest_collection_modifyitems:\n"
            "            return pytest_collection_modifyitems\n"
        ),
        (
            "def helper() -> list[object]:\n"
            "    return [\n"
            "        (pytest_collection_modifyitems := value)\n"
            "        for value in [object()]\n"
            "    ]\n"
        ),
        ("class PluginExample:\n    pytest_collection_modifyitems = object()\n"),
        (
            "def globals() -> dict[str, object]:\n"
            "    return {}\n"
            "globals()['pytest_collection_modifyitems'] = object()\n"
        ),
        (
            "def locals() -> dict[str, object]:\n"
            "    return {}\n"
            "locals()['pytest_collection_modifyitems'] = object()\n"
        ),
        (
            "def vars() -> dict[str, object]:\n"
            "    return {}\n"
            "vars()['pytest_collection_modifyitems'] = object()\n"
        ),
        (
            "def setattr(target: object, name: str, value: object) -> None:\n"
            "    return None\n"
            "setattr(object(), 'pytest_collection_modifyitems', object())\n"
        ),
        (
            "import sys\n"
            'globals()["ordinary_helper"] = object()\n'
            'locals()["ordinary_helper"] = object()\n'
            'vars()["ordinary_helper"] = object()\n'
            'vars(sys.modules[__name__])["ordinary_helper"] = object()\n'
            "setattr(sys.modules[__name__], 'ordinary_helper', object())\n"
        ),
        (
            "def local_namespace_only() -> None:\n"
            "    locals()['pytest_collection_modifyitems'] = object()\n"
            "    vars()['pytest_collection_modifyitems'] = object()\n"
            "    locals().update(pytest_collection_modifyitems=object())\n"
        ),
        (
            "namespace = globals()\n"
            'namespace.update({"ordinary_helper": object()})\n'
            "namespace.update(ordinary_helper=object())\n"
            'namespace.setdefault("ordinary_helper", object())\n'
            'namespace |= {"another_ordinary_helper": object()}\n'
        ),
        (
            "from operator import setitem\n"
            "setitem({}, 'pytest_collection_modifyitems', object())\n"
            "setitem(globals(), 'ordinary_helper', object())\n"
        ),
        (
            "from operator import setitem\n"
            "def helper() -> None:\n"
            "    setitem(locals(), 'pytest_collection_modifyitems', object())\n"
        ),
        (
            "def setitem(target: object, name: str, value: object) -> None:\n"
            "    return None\n"
            "setitem({}, 'pytest_collection_modifyitems', object())\n"
        ),
        (
            "import operator\n"
            "from operator import attrgetter\n"
            "attrgetter('setitem')(operator)({}, 'ordinary_helper', object())\n"
        ),
        (
            "from operator import ior, setitem\n"
            "setitem(globals(), 'ordinary_helper', object())\n"
            "ior(globals(), {'another_ordinary_helper': object()})\n"
            "dict.__setitem__(globals(), 'third_ordinary_helper', object())\n"
            "dict.update(globals(), {'fourth_ordinary_helper': object()})\n"
            "dict.setdefault(globals(), 'fifth_ordinary_helper', object())\n"
        ),
        (
            "from operator import ior, setitem\n"
            "local: dict[str, object] = {}\n"
            "setitem(local, 'pytest_collection_modifyitems', object())\n"
            "ior(local, {'pytest_collection_modifyitems': object()})\n"
            "dict.__setitem__(local, 'pytest_collection_modifyitems', object())\n"
            "dict.update(local, {'pytest_collection_modifyitems': object()})\n"
            "dict.setdefault(local, 'pytest_collection_modifyitems', object())\n"
        ),
        (
            "def install_hook(namespace: dict[str, object]) -> None:\n"
            '    namespace["pytest_collection_modifyitems"] = object()\n'
            "install_hook({})\n"
        ),
        (
            "def consume(value: object) -> None:\n"
            "    return None\n"
            "consume(globals().get('ordinary_helper'))\n"
            "getter = globals().get\n"
            "consume(getter)\n"
            "consume(getattr(globals(), 'ordinary_helper', None))\n"
        ),
        (
            "def install(\n"
            "    namespace: dict[str, object] = {},\n"
            ") -> None:\n"
            '    namespace["pytest_collection_modifyitems"] = object()\n'
            "install()\n"
        ),
        (
            "containers = [\n"
            "    [dict[str, object]()],\n"
            "    {'namespace': dict[str, object]()},\n"
            "]\n"
            'containers[0][0]["pytest_collection_modifyitems"] = object()\n'
            'containers[1]["namespace"]["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "match dict[str, object]():\n"
            "    case namespace:\n"
            '        namespace["pytest_collection_modifyitems"] = object()\n'
        ),
        (
            "class OrdinaryLoader:\n"
            "    def import_plugin(self, name: str) -> None:\n"
            "        return None\n"
            "    def consider_module(self, module: object) -> None:\n"
            "        return None\n"
            "loader = OrdinaryLoader()\n"
            'loader.import_plugin("ordinary")\n'
            "loader.consider_module(object())\n"
        ),
        (
            "class OrdinaryConfig:\n"
            "    loader: object\n"
            "def helper(config: OrdinaryConfig) -> None:\n"
            '    config.loader.import_plugin("ordinary")\n'
            "    config.loader.consider_env()\n"
        ),
        (
            "def pytest_sessionstart(session: object) -> None:\n"
            '    session.config.pluginmanager.has_plugin("ordinary")\n'
            '    session.config.pluginmanager.get_plugin("ordinary")\n'
            "    session.config.pluginmanager.list_name_plugin()\n"
        ),
        (
            "def helper(config: object) -> None:\n"
            '    config.pluginmanager.import_plugin("ordinary")\n'
        ),
        (
            "def helper(config: object) -> None:\n"
            "    config.pluginmanager.register(ordinary_plugin)\n"
        ),
        (
            "def helper() -> object:\n"
            "    pytest_configure = object()\n"
            "    return pytest_configure\n"
        ),
    ],
)
def test_python_policy_allows_legitimate_scoped_bindings_and_reflection(
    source: str,
) -> None:
    assert verify._python_pytest_policy_reason(source) is None, source


@pytest.mark.parametrize(
    ("test_path", "conftest_path"),
    [
        ("scripts/tests/test_probe.py", "conftest.py"),
        ("scripts/tests/test_probe.py", "scripts/conftest.py"),
        (
            "services/orchestrator/tests/test_probe.py",
            "services/conftest.py",
        ),
        (
            "services/orchestrator/tests/test_probe.py",
            "services/orchestrator/conftest.py",
        ),
    ],
)
def test_python_policy_scans_every_pytest_ancestor_conftest(
    fixture_repo: verify.Context,
    test_path: str,
    conftest_path: str,
) -> None:
    test_file = fixture_repo.repo / test_path
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text("def test_substantive() -> None:\n    assert True\n")
    conftest = fixture_repo.repo / conftest_path
    conftest.parent.mkdir(parents=True, exist_ok=True)
    conftest.write_text(
        (
            "def pytest_collection_modifyitems(items: list[object]) -> None:\n"
            "    items.clear()\n"
        ),
        encoding="utf-8",
    )
    failures = verify.check_focused_tests(fixture_repo, ())
    assert any(conftest_path in failure for failure in failures)


def test_python_policy_allows_legitimate_root_conftest(
    fixture_repo: verify.Context,
) -> None:
    test_file = fixture_repo.repo / "scripts/tests/test_probe.py"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text("def test_substantive() -> None:\n    assert True\n")
    (fixture_repo.repo / "conftest.py").write_text(
        (
            "def pytest_sessionstart(session: object) -> None:\n"
            "    session.config.pluginmanager.has_plugin('ordinary')\n"
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        (
            "pyproject.toml",
            ('[tool.pytest.ini_options]\naddopts = ["-p", "inventory_plugin"]\n'),
        ),
        ("pytest.toml", 'addopts = ["-p", "inventory_plugin"]\n'),
        (".pytest.toml", 'addopts = ["-p", "inventory_plugin"]\n'),
        ("pytest.ini", "[pytest]\naddopts = -p inventory_plugin\n"),
        (".pytest.ini", "[pytest]\naddopts = -p inventory_plugin\n"),
        ("tox.ini", "[pytest]\naddopts = -p inventory_plugin\n"),
        ("setup.cfg", "[tool:pytest]\naddopts = -p inventory_plugin\n"),
    ],
)
def test_python_suite_rejects_pytest_plugin_or_alternate_config_injection(
    fixture_repo: verify.Context,
    filename: str,
    content: str,
) -> None:
    (fixture_repo.repo / filename).write_text(content, encoding="utf-8")
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="python")],
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("pytest configuration" in message for message in outcome.messages)


@pytest.mark.parametrize(
    "addopts",
    [
        '["-p", "inventory_plugin"]',
        '["-k", "compensating_filler"]',
        '["--ignore", "scripts/tests/test_substantive.py"]',
        '["--deselect", "scripts/tests/test_probe.py::test_substantive"]',
        '["-c", "alternate.ini"]',
    ],
)
def test_python_suite_rejects_collection_narrowing_addopts(
    fixture_repo: verify.Context,
    addopts: str,
) -> None:
    (fixture_repo.repo / "pyproject.toml").write_text(
        f"[tool.pytest.ini_options]\naddopts = {addopts}\n",
        encoding="utf-8",
    )
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="python")],
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("pytest configuration" in message for message in outcome.messages)


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("tox.ini", "[tox]\nenvlist = py312\n"),
        ("setup.cfg", "[metadata]\nname = ordinary\n"),
    ],
)
def test_python_suite_allows_nonpytest_tool_configuration(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
    filename: str,
    content: str,
) -> None:
    (fixture_repo.repo / filename).write_text(content, encoding="utf-8")
    write_minimal_python_surface(fixture_repo)
    write_python_inventory(fixture_repo, list(MINIMAL_PYTHON_COMMON_NODE_IDS))
    expected_ids = platform_inventory_ids(list(MINIMAL_PYTHON_COMMON_NODE_IDS))

    def successful_command(
        _ctx: verify.Context, argv: tuple[str, ...]
    ) -> tuple[int, str]:
        return (
            (0, pytest_collection_output(expected_ids))
            if "--collect-only" in argv
            else (0, "child ok\n")
        )

    monkeypatch.setattr(verify, "run_command", successful_command)
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="python")],
    )
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS


def _write_count_preserving_pytest_attack(
    fixture_repo: verify.Context,
) -> tuple[Path, tuple[str, ...]]:
    test_file = fixture_repo.repo / "scripts/tests/test_inventory.py"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text(
        (
            "def test_substantive() -> None:\n"
            "    raise AssertionError('must remain collected')\n\n"
            "def test_compensating_filler() -> None:\n"
            "    assert True\n"
        ),
        encoding="utf-8",
    )
    command = (
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "-p",
        "no:cacheprovider",
        test_file.relative_to(fixture_repo.repo).as_posix(),
    )
    return test_file, command


def test_python_suite_rejects_root_conftest_count_preserving_bypass(
    fixture_repo: verify.Context,
) -> None:
    _test_file, command = _write_count_preserving_pytest_attack(fixture_repo)
    (fixture_repo.repo / "conftest.py").write_text(
        (
            "def pytest_collection_modifyitems(items: list[object]) -> None:\n"
            "    items[:] = [item for item in items "
            "if item.name != 'test_substantive']\n"
        ),
        encoding="utf-8",
    )
    runtime_code, runtime_output = verify.run_command(fixture_repo, command)
    assert runtime_code == 0
    assert "1 passed" in runtime_output

    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[list(command)],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, ["python"])
    assert exit_code == 1
    (outcome,) = outcomes
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("conftest.py" in message for message in outcome.messages)


@pytest.mark.parametrize(
    "hook_name",
    ["pytest_collection_finish", "pytest_runtestloop"],
)
def test_python_suite_rejects_execution_stage_hook_count_preserving_bypass(
    fixture_repo: verify.Context,
    hook_name: str,
) -> None:
    _test_file, command = _write_count_preserving_pytest_attack(fixture_repo)
    conftest = fixture_repo.repo / "conftest.py"
    conftest.write_text(
        (
            "import pytest\n\n\n"
            f"def {hook_name}(session: pytest.Session) -> None:\n"
            "    session.items[:] = [\n"
            "        item for item in session.items"
            ' if item.name != "test_substantive"\n'
            "    ]\n"
        ),
        encoding="utf-8",
    )
    project = REPO_ROOT.as_posix()
    relative = conftest.as_posix()
    quality_commands = (
        (
            "uv",
            "run",
            "--project",
            project,
            "ruff",
            "check",
            "--config",
            f"{project}/pyproject.toml",
            relative,
        ),
        (
            "uv",
            "run",
            "--project",
            project,
            "ruff",
            "format",
            "--check",
            "--config",
            f"{project}/pyproject.toml",
            relative,
        ),
        (
            "uv",
            "run",
            "--project",
            project,
            "mypy",
            "--config-file",
            f"{project}/pyproject.toml",
            relative,
        ),
    )
    for quality_command in quality_commands:
        quality_code, quality_output = verify.run_command(fixture_repo, quality_command)
        assert quality_code == 0, quality_output

    runtime_code, runtime_output = verify.run_command(fixture_repo, command)
    assert runtime_code == 0
    assert "1 passed" in runtime_output

    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[list(command)],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, ["python"])
    assert exit_code == 1
    (outcome,) = outcomes
    assert outcome.verdict is verify.Verdict.FAIL
    assert any(hook_name in message for message in outcome.messages)


def test_python_suite_rejects_pyproject_plugin_count_preserving_bypass(
    fixture_repo: verify.Context,
) -> None:
    _test_file, command = _write_count_preserving_pytest_attack(fixture_repo)
    (fixture_repo.repo / "inventory_plugin.py").write_text(
        (
            "def pytest_collection_modifyitems(items: list[object]) -> None:\n"
            "    items[:] = [item for item in items "
            "if item.name != 'test_substantive']\n"
        ),
        encoding="utf-8",
    )
    (fixture_repo.repo / "pyproject.toml").write_text(
        ('[tool.pytest.ini_options]\naddopts = ["-p", "inventory_plugin"]\n'),
        encoding="utf-8",
    )
    runtime_code, runtime_output = verify.run_command(fixture_repo, command)
    assert runtime_code == 0
    assert "1 passed" in runtime_output

    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[list(command)],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, ["python"])
    assert exit_code == 1
    (outcome,) = outcomes
    assert outcome.verdict is verify.Verdict.FAIL
    assert any("pytest configuration" in message for message in outcome.messages)


def test_verifier_neutralizes_external_pytest_plugin_injection(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "0")
    monkeypatch.setenv("PYTEST_ADDOPTS", "-p inventory_plugin")
    monkeypatch.setenv("PYTEST_PLUGINS", "inventory_plugin")
    monkeypatch.setenv("MYPYPATH", str(fixture_repo.repo / "host-injected-stubs"))
    command = (
        sys.executable,
        "-c",
        (
            "import os; print('|'.join(("
            "os.environ.get('PYTEST_DISABLE_PLUGIN_AUTOLOAD', ''), "
            "os.environ.get('PYTEST_ADDOPTS', ''), "
            "os.environ.get('PYTEST_PLUGINS', ''), "
            "os.environ.get('MYPYPATH', ''))))"
        ),
    )
    code, output = verify.run_command(fixture_repo, command)
    assert code == 0
    assert output.strip() == "1|||"


def test_python_conftest_quality_commands_cover_every_loaded_ancestor(
    fixture_repo: verify.Context,
) -> None:
    paths = [
        fixture_repo.repo / "conftest.py",
        fixture_repo.repo / "scripts/conftest.py",
        fixture_repo.repo / "scripts/tests/conftest.py",
    ]
    commands = verify._python_conftest_quality_commands(fixture_repo, paths)
    rendered = [" ".join(command) for command in commands]
    assert len(commands) == 3
    for path in paths:
        relative = path.relative_to(fixture_repo.repo).as_posix()
        assert all(relative in command for command in rendered)
    assert any("ruff check" in command for command in rendered)
    assert any("ruff format --check" in command for command in rendered)
    assert any("mypy" in command for command in rendered)
    assert all("--config pyproject.toml" in command for command in rendered[:2])
    assert "--config-file pyproject.toml" in rendered[2]


def test_python_suite_uses_explicit_hermetic_pytest_argv(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_minimal_python_surface(fixture_repo)
    write_python_inventory(fixture_repo, list(MINIMAL_PYTHON_COMMON_NODE_IDS))
    expected_ids = platform_inventory_ids(list(MINIMAL_PYTHON_COMMON_NODE_IDS))
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[["uv", "run", "pytest"]],
                proofs=[{"kind": "pytest_exact_inventory"}],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def record_command(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        if "--collect-only" in argv:
            return 0, pytest_collection_output(expected_ids)
        return 0, (
            f"================ {len(expected_ids)} passed in 0.10s ================\n"
        )

    monkeypatch.setattr(verify, "run_command", record_command)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    collection_argv, pytest_argv = observed
    assert "--collect-only" in collection_argv
    assert pytest_argv[:3] == ("uv", "run", "pytest")
    assert pytest_argv[3:5] == ("-c", "pyproject.toml")
    assert "--rootdir=." in pytest_argv
    assert "--confcutdir=." in pytest_argv
    assert "--disable-plugin-autoload" in pytest_argv
    assert pytest_argv.count("-o") == 1
    assert "addopts=" in pytest_argv
    assert "scripts/tests/test_probe.py" in pytest_argv
    assert "scripts/tests/test_v14_migration.py" in pytest_argv


def test_python_suite_pins_every_quality_tool_configuration(
    fixture_repo: verify.Context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    write_minimal_python_surface(fixture_repo)
    write_python_inventory(fixture_repo, list(MINIMAL_PYTHON_COMMON_NODE_IDS))
    expected_ids = platform_inventory_ids(list(MINIMAL_PYTHON_COMMON_NODE_IDS))
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(
                id="python",
                commands=[
                    ["uv", "run", "ruff", "check", "scripts"],
                    ["uv", "run", "ruff", "format", "--check", "scripts"],
                    ["uv", "run", "mypy", "scripts"],
                ],
            )
        ],
    )
    observed: list[tuple[str, ...]] = []

    def record_command(_ctx: verify.Context, argv: tuple[str, ...]) -> tuple[int, str]:
        observed.append(argv)
        if "--collect-only" in argv:
            return 0, pytest_collection_output(expected_ids)
        return 0, ""

    monkeypatch.setattr(verify, "run_command", record_command)
    registry = verify.load_registry(fixture_repo.registry_path)
    states = verify.parse_package_states(fixture_repo.status_path)
    outcome = verify.run_suite(fixture_repo, registry.suites[0], states, registry)
    assert outcome.verdict is verify.Verdict.PASS
    assert "--collect-only" in observed[0]
    assert observed[1:] == [
        (
            "uv",
            "run",
            "ruff",
            "check",
            "--config",
            "pyproject.toml",
            "scripts",
        ),
        (
            "uv",
            "run",
            "ruff",
            "format",
            "--config",
            "pyproject.toml",
            "--check",
            "scripts",
        ),
        (
            "uv",
            "run",
            "mypy",
            "--config-file",
            "pyproject.toml",
            "scripts",
        ),
    ]


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


def test_array_from_empty_table_with_count_compensation_still_fails(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "test.each(Array.from([]))"
            '("substantive %s", () => { throw new Error(); });\n'
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
    outcomes_by_id = {outcome.suite.suite_id: outcome for outcome in outcomes}
    assert exit_code == 1
    assert outcomes_by_id["count-proof"].verdict is verify.Verdict.PASS
    assert outcomes_by_id["integrity"].verdict is verify.Verdict.FAIL
    assert any(
        "empty test parameter table" in message
        or "empty test.each parameter table" in message
        for outcome in outcomes
        for message in outcome.messages
    )


def test_runtime_emptied_const_table_with_count_compensation_still_fails(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "const rows = [[1]];\n"
            "const alias = rows;\n"
            "alias.pop();\n"
            'test.each(rows)("substantive %s", () => { throw new Error(); });\n'
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
    outcomes_by_id = {outcome.suite.suite_id: outcome for outcome in outcomes}
    assert exit_code == 1
    assert outcomes_by_id["count-proof"].verdict is verify.Verdict.PASS
    assert outcomes_by_id["integrity"].verdict is verify.Verdict.FAIL
    assert any(
        "test.each parameter table" in message
        for outcome in outcomes
        for message in outcome.messages
    )


def test_iife_emptied_table_with_count_compensation_still_fails(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "const rows = [[1]];\n"
            "((): void => { rows.length = 0; })();\n"
            'test.each(rows)("substantive %s", () => { throw new Error(); });\n'
            'test("compensating trivial pass", () => {});\n'
        ),
        encoding="utf-8",
    )
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(id="integrity", builtin="integrity", commands=[]),
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
    outcomes_by_id = {outcome.suite.suite_id: outcome for outcome in outcomes}
    assert exit_code == 1
    assert outcomes_by_id["count-proof"].verdict is verify.Verdict.PASS
    assert outcomes_by_id["integrity"].verdict is verify.Verdict.FAIL
    assert any(
        "test.each parameter table" in message
        for outcome in outcomes
        for message in outcome.messages
    )


def test_concat_emptied_table_with_count_compensation_still_fails(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            'const rows = ([] as unknown[]).concat("abc");\n'
            "rows.splice(0, 1);\n"
            'test.each(rows)("substantive %s", () => { throw new Error(); });\n'
            'test("compensating trivial pass", () => {});\n'
        ),
        encoding="utf-8",
    )
    write_registry(
        fixture_repo.registry_path,
        [
            make_suite(id="integrity", builtin="integrity", commands=[]),
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
    outcomes_by_id = {outcome.suite.suite_id: outcome for outcome in outcomes}
    assert exit_code == 1
    assert outcomes_by_id["count-proof"].verdict is verify.Verdict.PASS
    assert outcomes_by_id["integrity"].verdict is verify.Verdict.FAIL
    assert any(
        "empty test.each parameter table" in message
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
