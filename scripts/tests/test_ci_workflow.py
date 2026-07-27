"""Static validation of the GitHub Actions CI definition (M00-W06, M00-W09).

Parses .github/workflows/*.yml with a duplicate-key-rejecting loader and
asserts the security, determinism, and no-divergence properties the package
contract requires: read-only permissions, SHA-pinned official actions, the
exact macos-15 + windows-2025 + ubuntu-24.04 matrix, frozen/locked installs,
doctor + canonical verification on every platform (not a hand-written or
weaker Windows subset), Windows-valid shell discipline (no global bash, pwsh
for Windows scripting, single-command steps otherwise), per-platform Rust
isolation, failure-scoped artifact upload, cache keys tied to
platform/tool/lockfile identity, and honest generated-contract ownership.
"""

from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path
from typing import Any

import check_portability
import validate_status
import verify
import yaml
from conftest import REPO_ROOT

WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
CI_PATH = WORKFLOWS_DIR / "ci.yml"

ALLOWED_ACTION_ORGS = ("actions/",)
SHA_PIN_RE = re.compile(r"^(?P<action>[\w.-]+/[\w.-]+)@(?P<sha>[0-9a-f]{40})$")
ALLOWED_PNPM_COMMANDS = (
    "pnpm --version",
    "pnpm store path",
    "pnpm install --frozen-lockfile",
    "pnpm exec playwright install --with-deps chromium",
    "pnpm exec playwright install chromium",
    "pnpm run doctor",
    "pnpm verify",
)


class UniqueKeyLoader(yaml.SafeLoader):
    """SafeLoader that rejects duplicate mapping keys instead of clobbering."""


def _construct_mapping(
    loader: UniqueKeyLoader, node: yaml.MappingNode, deep: bool = False
) -> dict[object, object]:
    seen: set[object] = set()
    for key_node, _value in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in seen:
            raise yaml.YAMLError(f"duplicate mapping key: {key!r}")
        seen.add(key)
    return yaml.SafeLoader.construct_mapping(loader, node, deep)


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


def load_ci() -> dict[str, Any]:
    # S506 false positive: UniqueKeyLoader subclasses yaml.SafeLoader and only
    # adds duplicate-key rejection; no arbitrary-object construction exists.
    data = yaml.load(
        CI_PATH.read_text(encoding="utf-8"),
        Loader=UniqueKeyLoader,  # noqa: S506
    )
    assert isinstance(data, dict)
    return data


def ci_steps() -> list[dict[str, Any]]:
    data = load_ci()
    steps: list[dict[str, Any]] = []
    for job in data["jobs"].values():
        steps.extend(job["steps"])
    return steps


def run_bodies() -> list[str]:
    return [step["run"] for step in ci_steps() if "run" in step]


def matrix_jobs() -> list[dict[str, Any]]:
    return [
        job for job in load_ci()["jobs"].values() if "matrix" in job.get("strategy", {})
    ]


def cache_steps() -> list[dict[str, Any]]:
    return [
        step
        for step in ci_steps()
        if str(step.get("uses", "")).startswith("actions/cache@")
    ]


def step_named(name: str) -> dict[str, Any]:
    matches = [step for step in ci_steps() if step.get("name") == name]
    assert len(matches) == 1, f"expected exactly one CI step named {name!r}"
    return matches[0]


def test_workflows_dir_contains_only_ci() -> None:
    files = sorted(p.name for p in WORKFLOWS_DIR.glob("*.yml")) + sorted(
        p.name for p in WORKFLOWS_DIR.glob("*.yaml")
    )
    assert files == ["ci.yml"], f"unexpected workflow files: {files}"


def test_workflow_parses_without_duplicate_keys() -> None:
    data = load_ci()
    assert data["name"] == "ci"
    assert "jobs" in data


def test_permissions_are_read_only() -> None:
    data = load_ci()
    assert data["permissions"] == {"contents": "read"}
    for job in data["jobs"].values():
        assert "permissions" not in job, "jobs must not widen permissions"


def test_concurrency_cancels_superseded_runs() -> None:
    concurrency = load_ci()["concurrency"]
    assert "github.ref" in concurrency["group"]
    assert "cancel-in-progress" in concurrency


def test_matrix_requires_exactly_the_three_certified_ci_platforms() -> None:
    data = load_ci()
    jobs = data["jobs"]
    assert len(jobs) == 1
    matrix_os = next(iter(jobs.values()))["strategy"]["matrix"]["os"]
    assert matrix_os == ["macos-15", "windows-2025", "ubuntu-24.04"], (
        "required CI must run exactly the certified hosted baselines: macos-15, "
        f"windows-2025, ubuntu-24.04 (found {matrix_os})"
    )
    assert next(iter(jobs.values()))["runs-on"] == "${{ matrix.os }}", (
        "the required job must derive runs-on from its exact matrix.os; a "
        "disconnected matrix does not execute on all three baselines"
    )
    for os_name in matrix_os:
        assert "latest" not in os_name, "runner labels must be explicit versions"


def test_windows_runner_is_exactly_the_certified_hosted_baseline() -> None:
    matrix_os = next(iter(load_ci()["jobs"].values()))["strategy"]["matrix"]["os"]
    assert "windows-2025" in matrix_os
    assert not any(
        entry.startswith("windows-") and entry != "windows-2025" for entry in matrix_os
    )


def _rust_install_steps(job: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    return [
        (index, step)
        for index, step in enumerate(job["steps"])
        if "rustup toolchain install" in str(step.get("run", ""))
    ]


def test_every_matrix_job_initializes_fresh_job_scoped_rustup_home() -> None:
    data = load_ci()
    assert "RUSTUP_HOME" not in data.get("env", {}), (
        "workflow-global rustup state would be broader than the matrix job"
    )
    jobs = matrix_jobs()
    assert jobs, "workflow must retain a matrix job"
    for job in jobs:
        # GitHub does not expose the runner context in jobs.<job_id>.env.
        # Set it on the per-platform Rust steps, then persist the exact
        # runner.temp value through GITHUB_ENV for all later steps.
        assert "RUSTUP_HOME" not in job.get("env", {})
        matches = _rust_install_steps(job)
        assert len(matches) == 2, (
            "expected exactly one POSIX and one Windows Rust install step"
        )
        for _index, install_step in matches:
            rustup_home = str(install_step.get("env", {}).get("RUSTUP_HOME", ""))
            assert rustup_home.startswith("${{ runner.temp }}"), (
                "every platform's Rust install must isolate RUSTUP_HOME "
                "beneath runner.temp"
            )
            assert "GITHUB_ENV" in str(install_step["run"])
        first_install_index = min(index for index, _step in matches)
        earlier_runs = "\n".join(
            str(step.get("run", "")) for step in job["steps"][:first_install_index]
        )
        assert not re.search(
            r"(?m)^\s*(?:rustup|cargo|rustc|rustfmt)(?:\s|$)", earlier_runs
        )


def test_posix_rust_step_asserts_fresh_home_before_install() -> None:
    install_step = step_named("Install pinned Rust toolchain (rust-toolchain.toml)")
    assert install_step["shell"] == "bash"
    assert install_step["if"] == "runner.os != 'Windows'"
    lines = [
        line.strip() for line in str(install_step["run"]).splitlines() if line.strip()
    ]
    fresh_index = lines.index('test ! -e "$RUSTUP_HOME"')
    create_index = lines.index('mkdir -p "$RUSTUP_HOME"')
    persist_index = lines.index(
        'printf \'RUSTUP_HOME=%s\\n\' "$RUSTUP_HOME" >> "$GITHUB_ENV"'
    )
    rustup_index = next(
        index
        for index, line in enumerate(lines)
        if line.startswith("rustup toolchain install ")
    )
    assert fresh_index < create_index < persist_index < rustup_index


def test_windows_rust_step_asserts_fresh_home_before_install() -> None:
    install_step = step_named(
        "Install pinned Rust toolchain (rust-toolchain.toml, Windows)"
    )
    assert install_step["shell"] == "pwsh"
    assert install_step["if"] == "runner.os == 'Windows'"
    body = str(install_step["run"])
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    fresh_index = next(
        index
        for index, line in enumerate(lines)
        if line.startswith("if (Test-Path -LiteralPath $env:RUSTUP_HOME)")
    )
    create_index = next(
        index
        for index, line in enumerate(lines)
        if line.startswith("New-Item -ItemType Directory")
    )
    persist_index = next(
        index for index, line in enumerate(lines) if "GITHUB_ENV" in line
    )
    rustup_index = next(
        index
        for index, line in enumerate(lines)
        if line.startswith("rustup toolchain install ")
    )
    assert fresh_index < create_index < persist_index < rustup_index


def test_job_has_timeout_and_no_global_shell_default() -> None:
    data = load_ci()
    # A workflow-global bash default would apply POSIX assumptions to the
    # Windows job (M00-W09 §B); shells are declared per step instead.
    assert "defaults" not in data
    for job in data["jobs"].values():
        assert "defaults" not in job
        assert job["timeout-minutes"] <= 60


def test_no_continue_on_error_anywhere() -> None:
    for job in load_ci()["jobs"].values():
        assert "continue-on-error" not in job
    for step in ci_steps():
        assert "continue-on-error" not in step


def test_run_steps_do_not_mask_failures() -> None:
    for body in run_bodies():
        executable = check_portability._strip_shell_comments(body)
        assert "set +e" not in executable
        assert not re.search(r"\|\|\s*(?:true|:)(?:\s|$)", executable)
        assert not re.search(r"(?:^|[;&])\s*exit\s+0(?:\s|$)", executable)


def test_every_action_is_sha_pinned_official_and_annotated() -> None:
    raw_lines = CI_PATH.read_text(encoding="utf-8").splitlines()
    uses = [(step["uses"]) for step in ci_steps() if "uses" in step]
    assert uses, "workflow must use at least the checkout action"
    for ref in uses:
        match = SHA_PIN_RE.match(ref)
        assert match, f"action not pinned to a 40-hex commit SHA: {ref}"
        assert match.group("action").startswith(ALLOWED_ACTION_ORGS), (
            f"only official actions are allowed: {ref}"
        )
        annotated = [
            line for line in raw_lines if ref in line and re.search(r"#\s*v\d", line)
        ]
        assert annotated, f"SHA pin missing a human-readable version comment: {ref}"


def test_checkout_does_not_persist_credentials() -> None:
    checkout = [
        s for s in ci_steps() if str(s.get("uses", "")).startswith("actions/checkout@")
    ]
    assert checkout
    assert checkout[0]["with"]["persist-credentials"] is False


def test_installs_are_frozen_or_locked() -> None:
    bodies = "\n".join(run_bodies())
    assert "pnpm install --frozen-lockfile" in bodies
    assert "uv sync --locked" in bodies
    assert "cargo fetch --locked" in bodies


def test_rust_install_uses_exact_pin_minimal_profile_and_components() -> None:
    toolchain = tomllib.loads(
        (REPO_ROOT / "rust-toolchain.toml").read_text(encoding="utf-8")
    )["toolchain"]
    assert toolchain["channel"] == "1.97.1"
    assert toolchain["components"] == ["rustfmt", "clippy"]

    install = step_named("Install pinned Rust toolchain (rust-toolchain.toml)")["run"]
    assert 'Path("rust-toolchain.toml")' in install
    assert 'rustup toolchain install "${RUST_PIN}"' in install
    assert "--profile minimal" in install
    assert "--component rustfmt" in install
    assert "--component clippy" in install


def test_rust_install_verifies_pinned_toolchain_proxies_and_versions() -> None:
    install = step_named("Install pinned Rust toolchain (rust-toolchain.toml)")["run"]
    required_probes = (
        "rustup show active-toolchain",
        "command -v cargo",
        "command -v rustc",
        "rustup which cargo",
        "rustup which rustc",
        "cargo --version",
        "rustc --version",
        "rustfmt --version",
        "cargo clippy --version",
    )
    for probe in required_probes:
        assert probe in install, f"missing post-install Rust probe: {probe}"
    assert "rust-toolchain.toml" in install
    assert '"${RUST_PIN}-"' in install
    # The +toolchain selector is interpreted by rustup proxies, not ordinary
    # cargo/rustc binaries, so these are direct PATH-proxy assertions.
    assert 'cargo "+${RUST_PIN}" --version' in install
    assert 'rustc "+${RUST_PIN}" --version' in install


def test_windows_rust_install_mirrors_the_posix_probe_set() -> None:
    install = step_named(
        "Install pinned Rust toolchain (rust-toolchain.toml, Windows)"
    )["run"]
    required_probes = (
        "rustup show active-toolchain",
        "Get-Command cargo",
        "Get-Command rustc",
        "rustup which cargo",
        "rustup which rustc",
        "cargo --version",
        "rustc --version",
        "rustfmt --version",
        "cargo clippy --version",
    )
    for probe in required_probes:
        assert probe in install, f"missing Windows post-install Rust probe: {probe}"
    assert "rust-toolchain.toml" in install
    assert "--profile minimal" in install
    assert "--component rustfmt" in install
    assert "--component clippy" in install
    assert '"$rustPin-*"' in install
    # Same trusted-proxy proofs as the POSIX variant.
    assert 'cargo "+$rustPin" --version' in install
    assert 'rustc "+$rustPin" --version' in install
    # pwsh strictness: native-command failures must stop the step.
    assert "$ErrorActionPreference = 'Stop'" in install
    assert "$PSNativeCommandUseErrorActionPreference = $true" in install


def test_ci_runs_doctor_and_canonical_verification_only() -> None:
    pnpm_invocations = [
        line.strip()
        for body in run_bodies()
        for line in body.splitlines()
        if line.strip().startswith("pnpm ") or "$(pnpm " in line
    ]
    for invocation in pnpm_invocations:
        cleaned = invocation.removeprefix('echo "path=$(').removesuffix(
            ')" >> "$GITHUB_OUTPUT"'
        )
        assert any(allowed in cleaned for allowed in ALLOWED_PNPM_COMMANDS), (
            f"unexpected pnpm invocation in CI: {invocation}"
        )
    bodies = "\n".join(run_bodies())
    # `pnpm run doctor`, not bare `pnpm doctor`: pnpm's unrelated built-in
    # doctor command shadows same-named scripts in the bare form.
    assert "pnpm run doctor" in bodies
    assert "pnpm doctor" not in bodies.replace("pnpm run doctor", "")
    assert "pnpm verify" in bodies
    for divergent in ("pnpm lint", "pnpm typecheck", "pnpm test", "pnpm format"):
        assert divergent not in bodies, (
            f"CI must run the canonical aggregate, not a hand-written subset: "
            f"{divergent}"
        )


def test_ci_pnpm_scripts_exist_in_package_json() -> None:
    scripts = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))[
        "scripts"
    ]
    for name in ("doctor", "verify"):
        assert name in scripts


def test_ci_aggregate_includes_mandatory_traceability_validation() -> None:
    suite = registry_suite("traceability")
    assert suite.owner == "M00-W07"
    assert suite.mandatory is True
    assert suite.activation.kind == "always_active"
    assert suite.commands == (
        ("python3", "scripts/traceability.py", "check", "--quiet"),
    )
    assert "pnpm verify" in "\n".join(run_bodies())


def test_artifact_upload_is_failure_scoped_and_playwright_only() -> None:
    uploads = [
        step
        for step in ci_steps()
        if str(step.get("uses", "")).startswith("actions/upload-artifact@")
    ]
    assert len(uploads) == 1
    upload = uploads[0]
    assert upload["if"] == "failure()"
    assert upload["with"]["path"].rstrip("/") == "test-results"
    assert upload["with"]["if-no-files-found"] == "ignore"
    assert "retention-days" in upload["with"]


def test_artifact_path_matches_playwright_output_config() -> None:
    config = (REPO_ROOT / "playwright.config.ts").read_text(encoding="utf-8")
    # Playwright's default outputDir is test-results/; the config must not
    # redirect it somewhere the CI artifact step does not upload.
    assert "outputDir" not in config
    assert 'trace: "retain-on-failure"' in config
    assert 'screenshot: "only-on-failure"' in config


def test_cache_keys_carry_platform_tool_and_lockfile_identity() -> None:
    caches = cache_steps()
    assert len(caches) == 4, "expected pnpm/uv/cargo/playwright caches"
    lockfile_sources = (
        "pnpm-lock.yaml",
        "uv.lock",
        "Cargo.lock",
        ".nvmrc",
        "pyproject.toml",
        "rust-toolchain.toml",
    )
    for cache in caches:
        key = cache["with"]["key"]
        assert "${{ runner.os }}" in key
        assert "${{ runner.arch }}" in key
        assert "hashFiles(" in key
        assert any(source in key for source in lockfile_sources), key
        assert "restore-keys" not in cache["with"], (
            "restore-keys would allow stale cross-lockfile cache reuse"
        )


def test_rustup_home_and_toolchain_state_are_never_cached() -> None:
    for cache in cache_steps():
        path = str(cache["with"]["path"]).lower()
        for forbidden in (
            "rustup_home",
            "rustup-home",
            ".rustup",
            "~/.cargo/bin",
            "runner.temp",
        ):
            assert forbidden not in path, (
                f"toolchain/proxy state must not be cached: {cache['name']}"
            )


def test_dependency_cache_paths_are_narrow_allowlisted() -> None:
    allowed = {
        "${{ steps.pnpm-store.outputs.path }}",
        "~/.cache/uv",
        "~/Library/Caches/uv",
        "~/AppData/Local/uv/cache",
        "~/.cargo/registry",
        "~/.cargo/git",
        "~/Library/Caches/ms-playwright",
        "~/.cache/ms-playwright",
        "~/AppData/Local/ms-playwright",
    }
    actual = {
        line.strip()
        for cache in cache_steps()
        for line in str(cache["with"]["path"]).splitlines()
        if line.strip()
    }
    assert actual == allowed


def test_cargo_dependency_caches_remain_narrow_and_allowed() -> None:
    cargo = [
        step for step in cache_steps() if step["name"] == "Cache cargo registry and git"
    ]
    assert len(cargo) == 1
    paths = {
        line.strip()
        for line in str(cargo[0]["with"]["path"]).splitlines()
        if line.strip()
    }
    assert paths == {"~/.cargo/registry", "~/.cargo/git"}


def test_no_network_tests_or_live_sites_in_run_steps() -> None:
    bodies = "\n".join(
        check_portability._strip_shell_comments(body) for body in run_bodies()
    )
    assert "http://" not in bodies
    assert "https://" not in bodies


# --------------------------------------- M00-W09 cross-platform workflow


def _windows_reachable(step: dict[str, Any]) -> bool:
    return check_portability._step_can_run_on_windows(step)


def test_canonical_doctor_and_verify_steps_run_on_every_platform() -> None:
    for body in ("pnpm run doctor", "pnpm verify"):
        matches = [
            step for step in ci_steps() if str(step.get("run", "")).strip() == body
        ]
        assert len(matches) == 1, f"expected exactly one '{body}' step"
        assert "if" not in matches[0], (
            f"'{body}' must run unconditionally on macOS, Windows, and "
            "Ubuntu — a guarded or weaker Windows command set is prohibited"
        )
        assert "shell" not in matches[0], (
            "canonical single-command steps use each OS's native default "
            "shell for exit-code propagation"
        )


def test_shell_discipline_bash_never_reaches_windows() -> None:
    for step in ci_steps():
        if "run" not in step:
            continue
        shell = str(step.get("shell", ""))
        body = str(step["run"])
        if shell in {"bash", "sh"}:
            assert not _windows_reachable(step), (
                f"bash step {step.get('name')!r} is reachable on Windows"
            )
        if shell in {"powershell", "cmd"}:
            raise AssertionError(
                f"step {step.get('name')!r} uses legacy shell {shell!r}; "
                "Windows scripting must use pwsh"
            )
        if not shell:
            assert "\n" not in body.strip(), (
                f"multi-line step {step.get('name')!r} must declare its "
                "shell explicitly (per-OS default shells differ)"
            )
        if shell == "pwsh" and "\n" in body.strip():
            assert "$ErrorActionPreference = 'Stop'" in body
            assert "$PSNativeCommandUseErrorActionPreference = $true" in body


def test_chromium_installed_on_all_three_platforms() -> None:
    installs = [
        step for step in ci_steps() if "playwright install" in str(step.get("run", ""))
    ]
    assert len(installs) == 3, "expected one Chromium install step per OS"
    by_guard = {str(step.get("if", "")): step for step in installs}
    assert "runner.os == 'Linux'" in by_guard
    assert "runner.os == 'macOS'" in by_guard
    assert "runner.os == 'Windows'" in by_guard
    for guard, step in by_guard.items():
        body = str(step["run"])
        if guard == "runner.os == 'Linux'":
            assert "--with-deps" in body, (
                "Linux must install the pinned browser's system dependencies"
            )
        else:
            assert "--with-deps" not in body, (
                "--with-deps is supported only on the Linux install path"
            )
        assert body.strip().endswith("chromium")


def test_uv_install_has_posix_and_windows_variants_with_same_pin_source() -> None:
    posix = step_named(
        "Install pinned uv (PyPI wheel, exact version from pyproject.toml)"
    )
    windows = step_named(
        "Install pinned uv (PyPI wheel, exact version from pyproject.toml, Windows)"
    )
    assert posix["if"] == "runner.os != 'Windows'"
    assert posix["shell"] == "bash"
    assert windows["if"] == "runner.os == 'Windows'"
    assert windows["shell"] == "pwsh"
    for step in (posix, windows):
        body = str(step["run"])
        assert "pyproject.toml" in body
        assert "required-version" in body
        assert 'pipx install "uv==' in body
        assert "uv --version" in body


def test_artifact_upload_name_is_per_matrix_platform() -> None:
    uploads = [
        step
        for step in ci_steps()
        if str(step.get("uses", "")).startswith("actions/upload-artifact@")
    ]
    assert len(uploads) == 1
    assert "${{ matrix.os }}" in str(uploads[0]["with"]["name"]), (
        "matrix legs must not collide on one artifact name"
    )


def test_tracked_changes_assertion_runs_on_every_platform() -> None:
    matches = [
        step
        for step in ci_steps()
        if "git status --porcelain" in str(step.get("run", ""))
    ]
    assert len(matches) == 1
    step = matches[0]
    assert "if" not in step, "the no-tracked-changes gate must run on every OS"
    assert step["shell"] == "pwsh", (
        "one pwsh implementation runs identically on all three platforms"
    )
    assert "throw" in str(step["run"])


def test_portability_suite_is_mandatory_and_always_active() -> None:
    suite = registry_suite("portability")
    assert suite.owner == "M00-W09"
    assert suite.mandatory is True
    assert suite.activation.kind == "always_active"
    assert suite.commands == (("python3", "scripts/check_portability.py", "--quiet"),)
    # The canonical aggregate (and therefore every CI platform) runs it.
    assert "pnpm verify" in "\n".join(run_bodies())


def test_gitattributes_enforces_lf_checkouts_everywhere() -> None:
    attributes = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert any(
        "text=auto" in line.split() and "eol=lf" in line.split()
        for line in attributes.splitlines()
    ), "text files must check out as LF on Windows as well"


# ------------------------------------------- generated-contract lifecycle


def registry_suite(suite_id: str) -> verify.Suite:
    registry = verify.load_registry(REPO_ROOT / "scripts" / "verification-suites.json")
    matches = [s for s in registry.suites if s.suite_id == suite_id]
    assert matches, f"suite {suite_id!r} not in registry"
    return matches[0]


def test_contract_gen_suite_owned_by_valid_generator_package() -> None:
    suite = registry_suite("contract-gen")
    assert suite.owner == "M01-W02"
    assert suite.activation.packages == ("M01-W02",)
    spec = validate_status.parse_spec(
        REPO_ROOT / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"
    )
    assert "M01-W02" in dict(spec.milestones["M01"].packages)
    compat = registry_suite("contract")
    assert compat.owner == "M01-W05", (
        "contract compatibility tests must stay owned by M01-W05, distinct "
        "from generation drift (M01-W02)"
    )


def test_contract_gen_not_yet_applicable_before_owner_begins() -> None:
    ctx = verify.Context(
        repo=REPO_ROOT,
        registry_path=REPO_ROOT / "scripts" / "verification-suites.json",
        status_path=REPO_ROOT / "docs" / "PROJECT_STATUS.md",
    )
    states = verify.parse_package_states(ctx.status_path)
    # Establish the premise for both not-begun states instead of asserting
    # the live row (which legitimately moved from NOT_STARTED to READY at the
    # M01-W01 closeout; KI-0014/KI-0015 class).
    for idle_state in ("NOT_STARTED", "READY"):
        states["M01-W02"] = idle_state
        derived = verify.derive_state(ctx, registry_suite("contract-gen"), states)
        assert derived is verify.SuiteState.NOT_YET_APPLICABLE, idle_state


def test_contract_gen_required_missing_once_owner_begins(
    tmp_path: Path,
) -> None:
    # Premise isolation (KI-0014/KI-0015/KI-0017 class): the live repository
    # now legitimately contains the real generator at
    # scripts/generate-contracts.ts, so the "no generator exists" negative
    # must derive discovery against an isolated repo without it.
    empty_repo = tmp_path / "repo"
    empty_repo.mkdir()
    ctx = verify.Context(
        repo=empty_repo,
        registry_path=REPO_ROOT / "scripts" / "verification-suites.json",
        status_path=REPO_ROOT / "docs" / "PROJECT_STATUS.md",
    )
    states = verify.parse_package_states(ctx.status_path)
    states["M01-W02"] = "IN_PROGRESS"
    derived = verify.derive_state(ctx, registry_suite("contract-gen"), states)
    assert derived is verify.SuiteState.REQUIRED_MISSING, (
        "without a real generator at scripts/generate-contracts.*, an active "
        "contract-gen suite must be REQUIRED_MISSING (fail-closed)"
    )


def test_contract_gen_becomes_active_with_real_generator() -> None:
    ctx = verify.Context(
        repo=REPO_ROOT,
        registry_path=REPO_ROOT / "scripts" / "verification-suites.json",
        status_path=REPO_ROOT / "docs" / "PROJECT_STATUS.md",
    )
    states = verify.parse_package_states(ctx.status_path)
    assert (REPO_ROOT / "scripts" / "generate-contracts.ts").is_file()
    for started_state in ("IN_PROGRESS", "IMPLEMENTED", "VERIFIED"):
        states["M01-W02"] = started_state
        derived = verify.derive_state(ctx, registry_suite("contract-gen"), states)
        assert derived is verify.SuiteState.ACTIVE, started_state


def test_contract_gen_explanation_documents_drift_vs_compat() -> None:
    suite = registry_suite("contract-gen")
    assert "M01-W05" in suite.explanation
    assert "stale" in suite.explanation
    assert "byte-compare" in suite.explanation
    assert "No hand-maintained generated files" in suite.explanation
