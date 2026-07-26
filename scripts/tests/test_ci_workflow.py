"""Static validation of the GitHub Actions CI definition (M00-W06).

Parses .github/workflows/*.yml with a duplicate-key-rejecting loader and
asserts the security, determinism, and no-divergence properties the package
contract requires: read-only permissions, SHA-pinned official actions,
macOS+Linux matrix, frozen/locked installs, doctor + canonical verification
(not a hand-written subset), failure-scoped artifact upload, cache keys tied
to platform/tool/lockfile identity, and honest generated-contract ownership.
"""

from __future__ import annotations

import json
import re
from typing import Any

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


def test_matrix_includes_macos_and_linux() -> None:
    data = load_ci()
    jobs = data["jobs"]
    assert len(jobs) == 1
    matrix_os = next(iter(jobs.values()))["strategy"]["matrix"]["os"]
    assert any(os_name.startswith("macos-") for os_name in matrix_os)
    assert any(os_name.startswith("ubuntu-") for os_name in matrix_os)
    for os_name in matrix_os:
        assert "latest" not in os_name, "runner labels must be explicit versions"


def test_job_has_timeout_and_bash_default() -> None:
    data = load_ci()
    assert data["defaults"]["run"]["shell"] == "bash"
    for job in data["jobs"].values():
        assert job["timeout-minutes"] <= 60


def test_no_continue_on_error_anywhere() -> None:
    raw = CI_PATH.read_text(encoding="utf-8")
    assert "continue-on-error" not in raw
    for step in ci_steps():
        assert "continue-on-error" not in step


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
    caches = [
        step
        for step in ci_steps()
        if str(step.get("uses", "")).startswith("actions/cache@")
    ]
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


def test_no_network_tests_or_live_sites_in_run_steps() -> None:
    bodies = "\n".join(run_bodies())
    assert "http://" not in bodies
    assert "https://" not in bodies


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
    assert states["M01-W02"] == "NOT_STARTED"
    derived = verify.derive_state(ctx, registry_suite("contract-gen"), states)
    assert derived is verify.SuiteState.NOT_YET_APPLICABLE


def test_contract_gen_required_missing_once_owner_begins() -> None:
    ctx = verify.Context(
        repo=REPO_ROOT,
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


def test_contract_gen_explanation_documents_drift_vs_compat() -> None:
    suite = registry_suite("contract-gen")
    assert "M01-W05" in suite.explanation
    assert "stale" in suite.explanation
    assert "No placeholder generator" in suite.explanation
