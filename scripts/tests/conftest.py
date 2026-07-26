"""Shared fixtures for the verification-runner tests (M00-W04).

Every negative-path test operates on an isolated temporary fixture
repository (its own git repo under tmp_path) or on read-only views of the
real repository; nothing here mutates tracked files of the real repo.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import verify  # noqa: E402  (path bootstrap must precede the import)

PASSING_CMD = [sys.executable, "-c", "print('child ok')"]
FAILING_CMD = [sys.executable, "-c", "raise SystemExit(3)"]

GOOD_SCRIPTS = {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "uv run python scripts/verify.py --suite format",
    "typecheck": "uv run python scripts/verify.py --suite typecheck",
    "test": "uv run python scripts/verify.py --suite unit-ts",
    "test:contract": "uv run python scripts/verify.py --suite contract",
    "test:e2e": "uv run python scripts/verify.py --suite e2e-browser",
    "test:visual": "uv run python scripts/verify.py --suite visual",
    "test:python": "uv run python scripts/verify.py --suite python",
    "test:rust": "uv run python scripts/verify.py --suite rust",
    "verify": "uv run python scripts/verify.py",
    "doctor": "python3 scripts/doctor.py",
    "preflight": "python3 scripts/doctor.py --preflight",
}


def run_git(cwd: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.email=t@example.invalid", "-c", "user.name=t", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )


def write_status(path: Path, states: dict[str, str]) -> None:
    rows = "\n".join(
        f"| `{pkg}` | {state} | — | — | fixture |" for pkg, state in states.items()
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "# Project Status\n\n## Work-package table\n\n"
        "| Work package | State | Verified revision | Evidence link | Notes |\n"
        "|---|---|---|---|---|\n" + rows + "\n",
        encoding="utf-8",
    )


def make_suite(**overrides: Any) -> dict[str, Any]:  # noqa: ANN401
    suite: dict[str, Any] = {
        "id": "fixture-suite",
        "name": "Fixture suite",
        "owner": "M00-W04",
        "mandatory": True,
        "activation": {"type": "always_active"},
        "commands": [PASSING_CMD],
        "proofs": [],
        "discovery_globs": [],
        "artifacts": [],
        "explanation": "fixture",
    }
    suite.update(overrides)
    return suite


def write_registry(path: Path, suites: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schema_version": 1, "allowed_skips": [], "suites": suites}
    path.write_text(json.dumps(payload), encoding="utf-8")


@pytest.fixture
def fixture_repo(tmp_path: Path) -> verify.Context:
    """A minimal isolated git repository with valid status and registry."""
    repo = tmp_path / "repo"
    repo.mkdir()
    write_status(repo / "docs/PROJECT_STATUS.md", {"M01-W05": "NOT_STARTED"})
    write_registry(repo / "scripts/verification-suites.json", [make_suite()])
    (repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": GOOD_SCRIPTS}), encoding="utf-8"
    )
    run_git(repo, "init", "-q")
    run_git(repo, "add", "-A")
    run_git(repo, "commit", "-q", "-m", "fixture")
    return verify.Context(
        repo=repo,
        registry_path=repo / "scripts/verification-suites.json",
        status_path=repo / "docs/PROJECT_STATUS.md",
    )


@pytest.fixture
def real_ctx() -> verify.Context:
    """Read-only context over the actual repository."""
    return verify.Context(
        repo=REPO_ROOT,
        registry_path=REPO_ROOT / "scripts/verification-suites.json",
        status_path=REPO_ROOT / "docs/PROJECT_STATUS.md",
    )
