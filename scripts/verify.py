#!/usr/bin/env python3
"""Fail-closed root verification runner (M00-W04, spec §8.5).

Executes the verification suites declared in scripts/verification-suites.json.
Suite state is derived from docs/PROJECT_STATUS.md at runtime:

- ACTIVE            the suite must run and pass, with discovery proofs.
- NOT_YET_APPLICABLE the owning work package has not begun; reported
                     honestly, never as a passing test suite.
- REQUIRED_MISSING  the owning package has begun but no tests exist at the
                     suite's discovery globs; always a hard failure.

The aggregate run (no --suite argument) is the canonical `pnpm verify`:
it validates toolchain pins, runs every suite in registry order, performs
repository-integrity checks, asserts status-neutrality (verification must
not change `git status --porcelain`), prints a per-suite summary, and exits
nonzero when any mandatory ACTIVE suite fails, any suite is
REQUIRED_MISSING, or any integrity check fails.

Exit codes: 0 all good; 1 verification failure; 2 usage/registry error.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tomllib
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import portability
import validate_status

VALID_PACKAGE_STATES = frozenset(
    {
        "NOT_STARTED",
        "READY",
        "IN_PROGRESS",
        "BLOCKED",
        "IMPLEMENTED",
        "VERIFIED",
        "ACCEPTED",
    }
)
# A BLOCKED package has begun (it started, then stalled) — its suites must
# not silently deactivate back to NOT_YET_APPLICABLE.
STARTED_STATES = frozenset(
    {"IN_PROGRESS", "BLOCKED", "IMPLEMENTED", "VERIFIED", "ACCEPTED"}
)
PYTEST_EXIT_NO_TESTS = 5
COMMAND_TIMEOUT_SECONDS = 1800
C0_CONTROL_LIMIT = 0x20
UNDECODABLE_OUTPUT = (
    "child output for %s was not decodable as UTF-8; "
    "the command result is unusable and is treated as a failure"
)


def configure_utf8_output() -> None:
    """Make aggregate diagnostics portable across host console code pages."""
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", errors="strict")


CANONICAL_ROOT_SCRIPTS = (
    "lint",
    "format:check",
    "typecheck",
    "test",
    "test:contract",
    "test:e2e",
    "test:visual",
    "test:python",
    "test:rust",
    "traceability:generate",
    "traceability:check",
    "verify",
    "doctor",
    "preflight",
)

MEMORY_FILES = (
    "CLAUDE.md",
    "docs/MASTER_IMPLEMENTATION_SPEC.md",
    "docs/PROJECT_STATUS.md",
    "docs/DECISIONS.md",
    "docs/TEST_EVIDENCE.md",
    "docs/KNOWN_ISSUES.md",
    "docs/COMPATIBILITY_MATRIX.md",
    "docs/UI_FAMILIARITY.md",
    "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md",
    "docs/ui/ANTI_BLOAT_CHECKLIST.md",
    "docs/EXPERIMENTAL_AI_PROVIDERS.md",
    "docs/PLATFORM_SUPPORT.md",
    "docs/REQUIREMENTS_TRACEABILITY.md",
    "docs/traceability.json",
    "docs/CRITICAL_GATES.md",
    "docs/gates/AUTOFILL_FEASIBILITY_GATE.md",
    "docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md",
    "docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md",
    "docs/gates/CROSS_PLATFORM_CORE_GATE.md",
    "docs/gates/HOLDOUT_EXECUTION_LOG.md",
    "docs/platform/CERTIFIED_MATRIX.md",
    "docs/platform/MODEL_RUNTIME_PROFILES.md",
    "docs/platform/NATIVE_MESSAGING_MATRIX.md",
    "docs/platform/PACKAGING_UPDATE_MATRIX.md",
)

LOCKFILES = (
    "pnpm-lock.yaml",
    "uv.lock",
    "services/native-host/Cargo.lock",
    "packages/contracts/test/contract/rust-harness/Cargo.lock",
)

REQUIRED_SCRIPT_FILES = (
    "scripts/validate_status.py",
    "scripts/traceability.py",
    "scripts/verify.py",
    "scripts/verification-suites.json",
)

NO_OP_SCRIPT_VALUES = frozenset({"", "true", ":", "exit 0"})

BYPASS_TOKENS = (
    "passWithNoTests",
    "--pass-with-no-tests",
    "suppress-no-test-exit-code",
)
BYPASS_SCAN_SUFFIXES = frozenset(
    {".json", ".ts", ".tsx", ".mjs", ".cjs", ".yaml", ".yml", ".toml"}
)
TEXT_SOURCE_SUFFIXES = frozenset(
    {
        ".cjs",
        ".js",
        ".json",
        ".md",
        ".mjs",
        ".py",
        ".toml",
        ".ts",
        ".tsx",
        ".yaml",
        ".yml",
    }
)
ALLOWED_TEXT_CONTROL_BYTES = frozenset({0x09, 0x0A, 0x0D})

TS_TEST_GLOBS = ("packages/*/test/**/*.test.ts", "e2e/**/*.spec.ts")
PY_TEST_GLOBS = (
    "services/orchestrator/tests/**/test_*.py",
    "services/orchestrator/tests/**/conftest.py",
    "scripts/tests/**/test_*.py",
    "scripts/tests/**/conftest.py",
)
TS_FOCUS_RE = re.compile(
    r"\b(?:test|it|describe|bench)\s*\.\s*(?:only|skip|fixme|todo)\b"
)
PY_SKIP_RE = re.compile(r"@pytest\s*\.\s*mark\s*\.\s*skip|pytest\s*\.\s*skip\s*\(")

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
PKG_ROW_RE = re.compile(r"^\|\s*`(M\d{2}-W\d{2})`\s*\|\s*([A-Z_]+)\s*\|")
TURBO_TASKS_RE = re.compile(r"Tasks:\s+(\d+) successful, (\d+) total")
VITEST_PASSED_RE = re.compile(r"Tests\s+(\d+) passed")
PLAYWRIGHT_LIST_RE = re.compile(r"Total:\s*(\d+) tests? in")
PLAYWRIGHT_PASSED_RE = re.compile(r"^\s*(\d+) passed", re.MULTILINE)
PYTEST_PASSED_RE = re.compile(r"=+.*?\b(\d+) passed\b.*?=+")
CARGO_PASSED_RE = re.compile(r"test result: ok\. (\d+) passed")


class SuiteState(Enum):
    ACTIVE = "ACTIVE"
    NOT_YET_APPLICABLE = "NOT_YET_APPLICABLE"
    REQUIRED_MISSING = "REQUIRED_MISSING"


class Verdict(Enum):
    PASS = "PASS"  # noqa: S105  (suite verdict label, not a credential)
    FAIL = "FAIL"
    NOT_YET_APPLICABLE = "NOT_YET_APPLICABLE"
    REQUIRED_MISSING = "REQUIRED_MISSING"


@dataclass(frozen=True)
class Activation:
    kind: str
    packages: tuple[str, ...] = ()


@dataclass(frozen=True)
class Proof:
    kind: str
    script: str = ""
    min_count: int = 1


@dataclass(frozen=True)
class Suite:
    suite_id: str
    name: str
    owner: str
    mandatory: bool
    activation: Activation
    commands: tuple[tuple[str, ...], ...]
    proofs: tuple[Proof, ...]
    discovery_globs: tuple[str, ...]
    artifacts: tuple[str, ...]
    explanation: str
    builtin: str = ""


@dataclass(frozen=True)
class Registry:
    suites: tuple[Suite, ...]
    allowed_skips: tuple[str, ...]


@dataclass
class Context:
    repo: Path
    registry_path: Path
    status_path: Path


@dataclass
class SuiteOutcome:
    suite: Suite
    state: SuiteState
    verdict: Verdict
    messages: list[str] = field(default_factory=list)


class RegistryError(Exception):
    """The suite registry is missing, unparseable, or schema-invalid."""


def _expect_str(value: object, where: str) -> str:
    if not isinstance(value, str):
        raise RegistryError(f"{where}: expected string, got {type(value).__name__}")
    return value


def _expect_bool(value: object, where: str) -> bool:
    if not isinstance(value, bool):
        raise RegistryError(f"{where}: expected bool, got {type(value).__name__}")
    return value


def _expect_list(value: object, where: str) -> list[object]:
    if not isinstance(value, list):
        raise RegistryError(f"{where}: expected list, got {type(value).__name__}")
    return value


def _parse_activation(raw: object, where: str) -> Activation:
    if not isinstance(raw, dict):
        raise RegistryError(f"{where}.activation: expected object")
    kind = _expect_str(raw.get("type"), f"{where}.activation.type")
    if kind == "always_active":
        return Activation(kind=kind)
    if kind == "packages_started":
        packages = tuple(
            _expect_str(p, f"{where}.activation.packages[]")
            for p in _expect_list(raw.get("packages"), f"{where}.activation.packages")
        )
        if not packages:
            raise RegistryError(f"{where}.activation.packages: must be non-empty")
        return Activation(kind=kind, packages=packages)
    raise RegistryError(f"{where}.activation.type: unknown kind '{kind}'")


def _parse_proof(raw: object, where: str) -> Proof:
    if not isinstance(raw, dict):
        raise RegistryError(f"{where}: expected object")
    kind = _expect_str(raw.get("kind"), f"{where}.kind")
    script = _expect_str(raw.get("script", ""), f"{where}.script")
    min_raw = raw.get("min", 1)
    if not isinstance(min_raw, int) or isinstance(min_raw, bool) or min_raw < 1:
        raise RegistryError(f"{where}.min: expected positive integer")
    return Proof(kind=kind, script=script, min_count=min_raw)


def _parse_suite(raw: object, index: int) -> Suite:
    where = f"suites[{index}]"
    if not isinstance(raw, dict):
        raise RegistryError(f"{where}: expected object")
    commands: list[tuple[str, ...]] = []
    for ci, cmd in enumerate(_expect_list(raw.get("commands"), f"{where}.commands")):
        argv = tuple(
            _expect_str(a, f"{where}.commands[{ci}][]")
            for a in _expect_list(cmd, f"{where}.commands[{ci}]")
        )
        if not argv:
            raise RegistryError(f"{where}.commands[{ci}]: empty argv is a no-op")
        commands.append(argv)
    suite = Suite(
        suite_id=_expect_str(raw.get("id"), f"{where}.id"),
        name=_expect_str(raw.get("name"), f"{where}.name"),
        owner=_expect_str(raw.get("owner"), f"{where}.owner"),
        mandatory=_expect_bool(raw.get("mandatory"), f"{where}.mandatory"),
        activation=_parse_activation(raw.get("activation"), where),
        commands=tuple(commands),
        proofs=tuple(
            _parse_proof(p, f"{where}.proofs[]")
            for p in _expect_list(raw.get("proofs"), f"{where}.proofs")
        ),
        discovery_globs=tuple(
            _expect_str(g, f"{where}.discovery_globs[]")
            for g in _expect_list(
                raw.get("discovery_globs"), f"{where}.discovery_globs"
            )
        ),
        artifacts=tuple(
            _expect_str(a, f"{where}.artifacts[]")
            for a in _expect_list(raw.get("artifacts"), f"{where}.artifacts")
        ),
        explanation=_expect_str(raw.get("explanation"), f"{where}.explanation"),
        builtin=_expect_str(raw.get("builtin", ""), f"{where}.builtin"),
    )
    if suite.builtin == "" and not suite.commands:
        raise RegistryError(
            f"{where}: non-builtin suite '{suite.suite_id}' has no commands"
        )
    return suite


def load_registry(path: Path) -> Registry:
    if not path.is_file():
        raise RegistryError(f"suite registry not found: {path}")
    try:
        data: object = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RegistryError(f"suite registry is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise RegistryError("suite registry root must be an object")
    suites = tuple(
        _parse_suite(raw, i)
        for i, raw in enumerate(_expect_list(data.get("suites"), "suites"))
    )
    if not suites:
        raise RegistryError("suite registry declares no suites")
    ids = [s.suite_id for s in suites]
    if len(ids) != len(set(ids)):
        raise RegistryError(f"duplicate suite ids in registry: {sorted(ids)}")
    allowed_skips = tuple(
        _expect_str(a, "allowed_skips[]")
        for a in _expect_list(data.get("allowed_skips", []), "allowed_skips")
    )
    return Registry(suites=suites, allowed_skips=allowed_skips)


def parse_package_states(status_path: Path) -> dict[str, str]:
    if not status_path.is_file():
        raise RegistryError(f"project status file not found: {status_path}")
    states: dict[str, str] = {}
    for line in status_path.read_text(encoding="utf-8").splitlines():
        match = PKG_ROW_RE.match(line.strip())
        if match:
            states[match.group(1)] = match.group(2)
    if not states:
        raise RegistryError(f"no work-package rows found in {status_path}")
    return states


def discovery_matches(ctx: Context, patterns: tuple[str, ...]) -> list[Path]:
    found: list[Path] = []
    for pattern in patterns:
        found.extend(p for p in ctx.repo.glob(pattern) if p.is_file())
    return sorted(set(found))


def derive_state(ctx: Context, suite: Suite, states: dict[str, str]) -> SuiteState:
    if suite.activation.kind == "always_active":
        return SuiteState.ACTIVE
    unknown = [p for p in suite.activation.packages if p not in states]
    if unknown:
        raise RegistryError(
            f"suite '{suite.suite_id}': activation packages missing from "
            f"project status: {unknown} (fail closed)"
        )
    invalid = {
        p: states[p]
        for p in suite.activation.packages
        if states[p] not in VALID_PACKAGE_STATES
    }
    if invalid:
        raise RegistryError(
            f"suite '{suite.suite_id}': unrecognized package state(s) "
            f"{invalid} in project status (fail closed)"
        )
    begun = any(states[p] in STARTED_STATES for p in suite.activation.packages)
    if not begun:
        return SuiteState.NOT_YET_APPLICABLE
    if discovery_matches(ctx, suite.discovery_globs):
        return SuiteState.ACTIVE
    return SuiteState.REQUIRED_MISSING


def run_command(ctx: Context, argv: tuple[str, ...]) -> tuple[int, str]:
    print(f"$ {' '.join(argv)}", flush=True)
    # Deterministic, parseable child output: disable color codes so
    # discovery-proof regexes match real counts (some tools ignore
    # NO_COLOR, so combined output is ANSI-stripped as well).
    # PYTHONIOENCODING completes the decoding contract below: child output is
    # read as strict UTF-8, so Python children must not fall back to the host
    # console code page. Without it a Windows child emits cp1252 (for example
    # a single 0xe9 for "é" inside a pytest traceback), the strict decode
    # fails inside subprocess's reader thread, and the real suite failure is
    # replaced by an unreadable crash (M00-W11).
    env = {
        **os.environ,
        "NO_COLOR": "1",
        "FORCE_COLOR": "0",
        "PYTHONIOENCODING": "utf-8",
    }
    # Registry commands stay platform-neutral (M00-W09, REQ-PLAT-025):
    # the literal interpreter name "python3" runs as this runner's own
    # pinned interpreter (identical semantics on hosts without a python3
    # shim), and every other bare name is resolved through PATH — with
    # PATHEXT on Windows, where CreateProcess would not find .cmd shims
    # such as pnpm — before spawning the absolute path.
    if argv[0] == "python3":
        head: str | None = sys.executable
    else:
        head = portability.host_resolve_executable(argv[0])
    if head is None:
        print(f"  command not found: {argv[0]}", flush=True)
        return 127, f"command not found: {argv[0]}"
    try:
        proc = subprocess.run(
            (head, *argv[1:]),
            cwd=ctx.repo,
            env=env,
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            timeout=COMMAND_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError:
        print(f"  command not found: {argv[0]}", flush=True)
        return 127, f"command not found: {argv[0]}"
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT after {COMMAND_TIMEOUT_SECONDS}s", flush=True)
        return 124, "timeout"
    except UnicodeDecodeError:
        # POSIX decodes in this thread, so the strict decode surfaces here.
        print(f"  {UNDECODABLE_OUTPUT % argv[0]}", flush=True)
        return 1, UNDECODABLE_OUTPUT % argv[0]
    # Windows decodes on reader threads instead, so a rejected byte kills the
    # thread and subprocess yields None rather than raising. The stubs type
    # both streams as non-optional str, so the runtime possibility is stated
    # explicitly rather than assumed away.
    stdout: str | None = proc.stdout
    stderr: str | None = proc.stderr
    if stdout is None or stderr is None:
        # Fail closed with a legible diagnostic instead of raising an opaque
        # TypeError that would hide the command's real result (M00-W11).
        print(f"  {UNDECODABLE_OUTPUT % argv[0]}", flush=True)
        return proc.returncode or 1, UNDECODABLE_OUTPUT % argv[0]
    combined = stdout + ("\n" + stderr if stderr else "")
    if combined.strip():
        print(combined.rstrip(), flush=True)
    return proc.returncode, ANSI_ESCAPE_RE.sub("", combined)


def _workspace_manifest_paths(ctx: Context) -> list[Path]:
    """package.json paths of every pnpm workspace member."""
    workspace_file = ctx.repo / "pnpm-workspace.yaml"
    globs: list[str] = []
    if workspace_file.is_file():
        in_packages = False
        for raw in workspace_file.read_text(encoding="utf-8").splitlines():
            if re.match(r"^packages:\s*$", raw):
                in_packages = True
                continue
            if in_packages:
                item = re.match(r'^\s+-\s+"?([^"#\s]+)"?\s*$', raw)
                if item:
                    globs.append(item.group(1))
                elif raw.strip() and not raw.startswith((" ", "\t", "#")):
                    in_packages = False
    paths: list[Path] = []
    for pattern in globs:
        paths.extend(sorted(ctx.repo.glob(f"{pattern}/package.json")))
    return paths


def workspace_packages_with_script(ctx: Context, script: str) -> list[str]:
    """Package names declaring `script`, from the pnpm workspace globs."""
    names: list[str] = []
    for manifest in _workspace_manifest_paths(ctx):
        try:
            data: object = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            scripts = data.get("scripts")
            name = data.get("name")
            if (
                isinstance(scripts, dict)
                and script in scripts
                and isinstance(name, str)
            ):
                names.append(name)
    return names


def _proof_turbo_task_count(
    ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    expected = len(workspace_packages_with_script(ctx, proof.script))
    if expected < 1:
        return f"no workspace package declares a '{proof.script}' script"
    matches = TURBO_TASKS_RE.findall(output)
    if not matches:
        return "could not find turbo 'Tasks: N successful, N total' summary"
    successful, total = matches[-1]
    if int(successful) != expected or int(total) != expected:
        return (
            f"turbo ran {successful}/{total} '{proof.script}' tasks but "
            f"{expected} workspace packages declare that script"
        )
    return None


def _proof_vitest_per_package(
    ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    expected = len(workspace_packages_with_script(ctx, proof.script))
    if expected < 1:
        return f"no workspace package declares a '{proof.script}' script"
    counts = [int(n) for n in VITEST_PASSED_RE.findall(output)]
    if len(counts) != expected:
        return (
            f"expected {expected} per-package Vitest 'Tests N passed' "
            f"reports, found {len(counts)} (fresh execution required)"
        )
    if any(c < 1 for c in counts):
        return "a package's Vitest run reported zero passing tests"
    return None


def _proof_vitest_min_tests(
    _ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    total = sum(int(n) for n in VITEST_PASSED_RE.findall(output))
    if total < proof.min_count:
        return f"Vitest reported {total} passing tests; need >= {proof.min_count}"
    return None


def _proof_playwright_list_min(
    ctx: Context, suite: Suite, proof: Proof, _output: str
) -> str | None:
    list_argv = (*suite.commands[0], "--list")
    code, list_out = run_command(ctx, list_argv)
    if code != 0:
        return f"playwright --list failed with exit {code}"
    match = PLAYWRIGHT_LIST_RE.search(list_out)
    if not match or int(match.group(1)) < proof.min_count:
        found = match.group(1) if match else "0"
        return (
            f"playwright discovered {found} tests; need >= {proof.min_count} "
            "(an empty browser suite must never pass)"
        )
    return None


def _proof_playwright_min_passed(
    _ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    match = PLAYWRIGHT_PASSED_RE.search(output)
    if not match or int(match.group(1)) < proof.min_count:
        return f"playwright did not report >= {proof.min_count} passed tests"
    return None


def _proof_pytest_min_passed(
    _ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    match = PYTEST_PASSED_RE.search(output)
    if not match or int(match.group(1)) < proof.min_count:
        return f"pytest did not report >= {proof.min_count} passed tests"
    return None


def _proof_cargo_min_passed(
    _ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    total = sum(int(n) for n in CARGO_PASSED_RE.findall(output))
    if total < proof.min_count:
        return f"cargo test reported {total} passing tests; need >= {proof.min_count}"
    return None


PROOF_CHECKS: dict[str, Callable[[Context, Suite, Proof, str], str | None]] = {
    "turbo_task_count": _proof_turbo_task_count,
    "vitest_per_package": _proof_vitest_per_package,
    "vitest_min_tests": _proof_vitest_min_tests,
    "playwright_list_min": _proof_playwright_list_min,
    "playwright_min_passed": _proof_playwright_min_passed,
    "pytest_min_passed": _proof_pytest_min_passed,
    "cargo_min_passed": _proof_cargo_min_passed,
}


def check_proof(ctx: Context, suite: Suite, proof: Proof, output: str) -> str | None:
    """Return a failure message, or None when the proof holds."""
    handler = PROOF_CHECKS.get(proof.kind)
    if handler is None:
        return f"unknown proof kind '{proof.kind}' (fail closed)"
    return handler(ctx, suite, proof, output)


def _read_pins(ctx: Context) -> dict[str, str]:
    pins: dict[str, str] = {}
    pins["node"] = (ctx.repo / ".nvmrc").read_text(encoding="utf-8").strip()
    pkg_raw: object = json.loads(
        (ctx.repo / "package.json").read_text(encoding="utf-8")
    )
    if isinstance(pkg_raw, dict):
        manager = pkg_raw.get("packageManager")
        if isinstance(manager, str) and manager.startswith("pnpm@"):
            pins["pnpm"] = manager.removeprefix("pnpm@")
    pins["python"] = (ctx.repo / ".python-version").read_text(encoding="utf-8").strip()
    with (ctx.repo / "pyproject.toml").open("rb") as fh:
        pyproject = tomllib.load(fh)
    required = pyproject.get("tool", {}).get("uv", {}).get("required-version", "")
    pins["uv"] = str(required).removeprefix("==")
    with (ctx.repo / "rust-toolchain.toml").open("rb") as fh:
        toolchain = tomllib.load(fh)
    pins["rust"] = str(toolchain.get("toolchain", {}).get("channel", ""))
    return pins


def _version_of(ctx: Context, argv: tuple[str, ...]) -> str:
    code, out = run_command(ctx, argv)
    return out.strip() if code == 0 else f"<exit {code}>"


def check_toolchain(ctx: Context) -> list[str]:
    failures: list[str] = []
    try:
        pins = _read_pins(ctx)
    except (OSError, tomllib.TOMLDecodeError, json.JSONDecodeError) as exc:
        return [f"cannot read toolchain pins: {exc}"]
    node = _version_of(ctx, ("node", "--version")).lstrip("v")
    if node != pins["node"]:
        failures.append(f"node {node} != pinned {pins['node']} (.nvmrc)")
    pnpm = _version_of(ctx, ("pnpm", "--version"))
    if pnpm != pins.get("pnpm", ""):
        failures.append(f"pnpm {pnpm} != pinned {pins.get('pnpm')} (packageManager)")
    py_out = _version_of(ctx, ("uv", "run", "python", "--version"))
    if not py_out.endswith(pins["python"]):
        failures.append(
            f"uv python '{py_out}' != pinned {pins['python']} (.python-version)"
        )
    uv_out = _version_of(ctx, ("uv", "--version"))
    if pins["uv"] and not uv_out.startswith(f"uv {pins['uv']}"):
        failures.append(f"uv '{uv_out}' != pinned {pins['uv']} (required-version)")
    rust_out = _version_of(ctx, ("rustup", "show", "active-toolchain"))
    if not rust_out.startswith(pins["rust"]):
        failures.append(
            f"rustup active toolchain '{rust_out}' != pinned {pins['rust']} "
            "(rust-toolchain.toml)"
        )
    cargo_out = _version_of(ctx, ("cargo", "--version"))
    if not cargo_out.startswith(f"cargo {pins['rust']}"):
        failures.append(
            f"cargo '{cargo_out}' != pinned {pins['rust']} — the cargo binary "
            "on PATH is not the rustup proxy honoring rust-toolchain.toml"
        )
    return failures


def git_tracked_files(ctx: Context) -> list[str]:
    code, out = run_command(ctx, ("git", "ls-files"))
    if code != 0:
        raise RegistryError("git ls-files failed (integrity checks need a git repo)")
    return [line for line in out.splitlines() if line.strip()]


def worktree_snapshot(ctx: Context) -> str:
    """Porcelain status plus a content digest of tracked-file changes.

    The porcelain part catches added/removed/newly-modified paths; the
    `git diff` digest additionally catches content changes to files that
    were ALREADY modified before verification started (their porcelain
    line would not change). Untracked files are compared by presence, not
    content — verification must never write inside the repository at all.
    """
    diff_proc = subprocess.run(
        ("git", "diff"),
        cwd=ctx.repo,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if diff_proc.returncode != 0:
        raise RegistryError("git diff failed (fail closed)")
    digest = hashlib.sha256(diff_proc.stdout.encode("utf-8")).hexdigest()
    return git_porcelain(ctx) + "@tracked-content-sha256:" + digest


def git_porcelain(ctx: Context) -> str:
    proc = subprocess.run(
        ("git", "status", "--porcelain"),
        cwd=ctx.repo,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        raise RegistryError("git status --porcelain failed (fail closed)")
    return proc.stdout


def _segment_is_noop(segment: str) -> bool:
    if segment in NO_OP_SCRIPT_VALUES:
        return True
    return segment == "echo" or segment.startswith("echo ")


def _script_is_noop(value: str) -> bool:
    """True when a script cannot perform real verification work.

    Shell comments are stripped and compound chains are decomposed, so
    'true && true' and 'exit 0 # done' are still no-ops, while any chain
    containing one real command is not.
    """
    stripped = value.split("#", 1)[0].strip()
    if not stripped:
        return True
    segments = [s.strip() for s in re.split(r"[;&|]+", stripped)]
    return all(_segment_is_noop(s) for s in segments)


def check_root_scripts(ctx: Context) -> list[str]:
    failures: list[str] = []
    raw: object = json.loads((ctx.repo / "package.json").read_text(encoding="utf-8"))
    scripts: dict[str, str] = {}
    if isinstance(raw, dict) and isinstance(raw.get("scripts"), dict):
        for key, value in raw["scripts"].items():
            if isinstance(key, str) and isinstance(value, str):
                scripts[key] = value
    for name in CANONICAL_ROOT_SCRIPTS:
        if name not in scripts:
            failures.append(f"required root script missing: '{name}'")
    for name, value in scripts.items():
        if _script_is_noop(value):
            failures.append(f"root script '{name}' is a no-op: '{value}'")
    failures.extend(_check_workspace_scripts(ctx))
    return failures


def _check_workspace_scripts(ctx: Context) -> list[str]:
    """No-op vetting for every workspace member's scripts."""
    failures: list[str] = []
    for manifest in _workspace_manifest_paths(ctx):
        try:
            data: object = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            failures.append(f"unparseable workspace manifest: {manifest}")
            continue
        if not isinstance(data, dict):
            continue
        pkg_name = data.get("name")
        label = pkg_name if isinstance(pkg_name, str) else str(manifest)
        member_scripts = data.get("scripts")
        if not isinstance(member_scripts, dict):
            continue
        for key, value in member_scripts.items():
            if (
                isinstance(key, str)
                and isinstance(value, str)
                and _script_is_noop(value)
            ):
                failures.append(
                    f"workspace script '{key}' in {label} is a no-op: '{value}'"
                )
    return failures


def check_bypass_tokens(ctx: Context, tracked: list[str]) -> list[str]:
    failures: list[str] = []
    for rel in tracked:
        if Path(rel).suffix not in BYPASS_SCAN_SUFFIXES:
            continue
        if rel == "scripts/verification-suites.json":
            continue
        try:
            text = (ctx.repo / rel).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for token in BYPASS_TOKENS:
            if token in text:
                failures.append(f"test-bypass token '{token}' found in {rel}")
    return failures


def check_focused_tests(ctx: Context, allowed_skips: tuple[str, ...]) -> list[str]:
    """Scan every on-disk test file (tracked or not) for focus/skip markers."""
    failures: list[str] = []
    for pattern in TS_TEST_GLOBS:
        for path in discovery_matches(ctx, (pattern,)):
            rel = path.relative_to(ctx.repo).as_posix()
            if rel in allowed_skips:
                continue
            if TS_FOCUS_RE.search(path.read_text(encoding="utf-8")):
                failures.append(f"focused/skipped test marker in {rel}")
    for pattern in PY_TEST_GLOBS:
        for path in discovery_matches(ctx, (pattern,)):
            rel = path.relative_to(ctx.repo).as_posix()
            if rel in allowed_skips:
                continue
            if PY_SKIP_RE.search(path.read_text(encoding="utf-8")):
                failures.append(f"skipped test marker in {rel}")
    return failures


def raw_control_bytes(data: bytes) -> set[int]:
    return {
        byte
        for byte in data
        if byte < C0_CONTROL_LIMIT and byte not in ALLOWED_TEXT_CONTROL_BYTES
    }


def check_raw_control_bytes(ctx: Context, tracked: list[str]) -> list[str]:
    failures: list[str] = []
    for rel in tracked:
        if Path(rel).suffix.casefold() not in TEXT_SOURCE_SUFFIXES:
            continue
        path = ctx.repo / rel
        try:
            data = path.read_bytes()
        except OSError as exc:
            failures.append(f"tracked text source cannot be read: {rel}: {exc}")
            continue
        controls = raw_control_bytes(data)
        if controls:
            rendered = ", ".join(f"0x{byte:02x}" for byte in sorted(controls))
            failures.append(f"raw C0 control byte(s) {rendered} found in {rel}")
    return failures


def check_integrity(  # noqa: PLR0912 - explicit independent integrity checks
    ctx: Context, registry: Registry
) -> list[str]:
    failures: list[str] = []
    for rel in MEMORY_FILES:
        if not (ctx.repo / rel).is_file():
            failures.append(f"canonical project-memory file missing: {rel}")
    spec = ctx.repo / "docs/MASTER_IMPLEMENTATION_SPEC.md"
    if spec.is_symlink() or not spec.is_file():
        failures.append("canonical specification must be a regular non-symlink file")
    elif "JAPP-MASTER-001" not in spec.read_text(encoding="utf-8"):
        failures.append("canonical specification lost its JAPP-MASTER-001 identity")
    for offender in validate_status.canonical_spec_offenders(ctx.repo):
        failures.append(f"second canonical-looking specification present: {offender}")
    for rel in LOCKFILES:
        if not (ctx.repo / rel).is_file():
            failures.append(f"lockfile missing for active ecosystem: {rel}")
    for rel in REQUIRED_SCRIPT_FILES:
        if not (ctx.repo / rel).is_file():
            failures.append(f"required script missing: {rel}")
    failures.extend(check_root_scripts(ctx))
    playwright_config = ctx.repo / "playwright.config.ts"
    if playwright_config.is_file():
        if "forbidOnly: true" not in playwright_config.read_text(encoding="utf-8"):
            failures.append("playwright.config.ts must keep 'forbidOnly: true'")
    else:
        failures.append("playwright.config.ts missing")
    try:
        tracked = git_tracked_files(ctx)
    except RegistryError as exc:
        return [*failures, str(exc)]
    failures.extend(check_bypass_tokens(ctx, tracked))
    failures.extend(check_focused_tests(ctx, registry.allowed_skips))
    failures.extend(check_raw_control_bytes(ctx, tracked))
    return failures


def run_suite(
    ctx: Context, suite: Suite, states: dict[str, str], registry: Registry
) -> SuiteOutcome:
    state = derive_state(ctx, suite, states)
    if state is SuiteState.NOT_YET_APPLICABLE:
        return SuiteOutcome(
            suite=suite,
            state=state,
            verdict=Verdict.NOT_YET_APPLICABLE,
            messages=[suite.explanation],
        )
    if state is SuiteState.REQUIRED_MISSING:
        return SuiteOutcome(
            suite=suite,
            state=state,
            verdict=Verdict.REQUIRED_MISSING,
            messages=[
                (
                    f"owning package {suite.owner} has begun but no tests match "
                    f"{list(suite.discovery_globs)} — this suite is REQUIRED "
                    "and missing"
                )
            ],
        )
    messages: list[str] = []
    if suite.builtin == "toolchain":
        messages = check_toolchain(ctx)
    elif suite.builtin == "integrity":
        messages = check_integrity(ctx, registry)
    else:
        output_parts: list[str] = []
        for argv in suite.commands:
            code, output = run_command(ctx, argv)
            output_parts.append(output)
            if code != 0:
                if code == PYTEST_EXIT_NO_TESTS and "pytest" in argv:
                    messages.append(
                        "pytest collected zero tests (exit 5) — an empty "
                        "mandatory suite is a failure, not a success"
                    )
                else:
                    messages.append(f"command failed (exit {code}): {' '.join(argv)}")
                break
        if not messages:
            combined = "\n".join(output_parts)
            for proof in suite.proofs:
                failure = check_proof(ctx, suite, proof, combined)
                if failure:
                    messages.append(f"discovery proof failed: {failure}")
    verdict = Verdict.PASS if not messages else Verdict.FAIL
    return SuiteOutcome(suite=suite, state=state, verdict=verdict, messages=messages)


def summarize(outcomes: list[SuiteOutcome]) -> str:
    lines = [
        "",
        "== verification summary ==",
        f"{'suite':<14} {'state':<20} {'result':<18} detail",
        "-" * 78,
    ]
    for outcome in outcomes:
        detail = ""
        if outcome.verdict is Verdict.NOT_YET_APPLICABLE:
            detail = f"not a passing suite — owned by {outcome.suite.owner}"
        elif outcome.messages:
            detail = outcome.messages[0][:90]
        lines.append(
            f"{outcome.suite.suite_id:<14} {outcome.state.value:<20} "
            f"{outcome.verdict.value:<18} {detail}"
        )
    return "\n".join(lines)


def run_verification(
    ctx: Context, suite_ids: list[str] | None
) -> tuple[list[SuiteOutcome], int]:
    registry = load_registry(ctx.registry_path)
    states = parse_package_states(ctx.status_path)
    selected = registry.suites
    if suite_ids:
        known = {s.suite_id for s in registry.suites}
        unknown = [s for s in suite_ids if s not in known]
        if unknown:
            raise RegistryError(
                f"unknown suite id(s): {unknown}; known: {sorted(known)}"
            )
        selected = tuple(s for s in registry.suites if s.suite_id in suite_ids)
    before = worktree_snapshot(ctx)
    outcomes = [run_suite(ctx, suite, states, registry) for suite in selected]
    after = worktree_snapshot(ctx)
    if before != after:
        outcomes.append(
            SuiteOutcome(
                suite=Suite(
                    suite_id="status-neutral",
                    name="Verification must not change the working tree",
                    owner="M00-W04",
                    mandatory=True,
                    activation=Activation(kind="always_active"),
                    commands=(),
                    proofs=(),
                    discovery_globs=(),
                    artifacts=(),
                    explanation="",
                    builtin="integrity",
                ),
                state=SuiteState.ACTIVE,
                verdict=Verdict.FAIL,
                messages=[
                    (
                        "git status --porcelain changed during verification:\n"
                        f"--- before ---\n{before}--- after ---\n{after}"
                    )
                ],
            )
        )
    failed = [
        o
        for o in outcomes
        if o.verdict is Verdict.REQUIRED_MISSING
        or (o.verdict is Verdict.FAIL and o.suite.mandatory)
    ]
    return outcomes, (1 if failed else 0)


def main(argv: list[str] | None = None) -> int:
    configure_utf8_output()
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--suite", action="append", help="run one suite by id")
    parser.add_argument("--repo", default=None, help="repository root override")
    parser.add_argument("--registry", default=None, help="registry path override")
    parser.add_argument("--status", default=None, help="project-status path override")
    parser.add_argument(
        "--list-suites", action="store_true", help="print suite ids and states"
    )
    args = parser.parse_args(argv)

    repo = (
        Path(args.repo).resolve()
        if args.repo
        else Path(__file__).resolve().parent.parent
    )
    ctx = Context(
        repo=repo,
        registry_path=Path(args.registry)
        if args.registry
        else repo / "scripts/verification-suites.json",
        status_path=Path(args.status)
        if args.status
        else repo / "docs/PROJECT_STATUS.md",
    )
    try:
        if args.list_suites:
            registry = load_registry(ctx.registry_path)
            states = parse_package_states(ctx.status_path)
            for suite in registry.suites:
                print(f"{suite.suite_id:<14} {derive_state(ctx, suite, states).value}")
            return 0
        outcomes, exit_code = run_verification(ctx, args.suite)
    except RegistryError as exc:
        print(f"verification error: {exc}", file=sys.stderr)
        return 2
    print(summarize(outcomes))
    for outcome in outcomes:
        if outcome.verdict is Verdict.NOT_YET_APPLICABLE:
            print(
                f"\nNOTE {outcome.suite.suite_id}: NOT_YET_APPLICABLE — "
                f"{outcome.messages[0]}"
            )
        elif outcome.messages:
            print(f"\nFAILURE {outcome.suite.suite_id}:")
            for message in outcome.messages:
                print(f"  - {message}")
    print(f"\nverification exit code: {exit_code}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
