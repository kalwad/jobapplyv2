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
import ast
import hashlib
import io
import json
import os
import re
import shlex
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
    "scripts/check-ts-test-policy.mjs",
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

_VITEST_TEST_SUFFIXES = (
    "js",
    "jsx",
    "ts",
    "tsx",
    "cjs",
    "cjsx",
    "mjs",
    "mjsx",
    "cts",
    "ctsx",
    "mts",
    "mtsx",
)
TS_TEST_GLOBS = tuple(
    f"{root}/**/*.{kind}.{suffix}"
    for root in ("packages/*", "apps/*", "e2e")
    for kind in ("test", "spec")
    for suffix in _VITEST_TEST_SUFFIXES
)
PY_TEST_FILE_GLOBS = (
    "services/orchestrator/tests/**/test_*.py",
    "scripts/tests/**/test_*.py",
)
PY_TEST_GLOBS = (
    *PY_TEST_FILE_GLOBS,
    "services/orchestrator/tests/**/conftest.py",
    "scripts/tests/**/conftest.py",
)
PYTEST_ALTERNATE_CONFIGS = (
    "pytest.toml",
    ".pytest.toml",
    "pytest.ini",
    ".pytest.ini",
    "tox.ini",
    "setup.cfg",
)
PYTEST_CANONICAL_ADDOPTS = ("-ra", "--strict-markers", "--strict-config")
TS_FOCUS_RE = re.compile(
    r"\b(?:test|it|describe|suite|bench)\s*\.\s*(?:only|skip|fixme|todo)\b"
)
# Retained as a narrow compatibility probe for focused unit tests. Enforcement
# uses the bounded Python AST policy below; text matching is not authoritative.
PY_SKIP_RE = re.compile(
    r"@pytest\s*\.\s*mark\s*\.\s*skip|pytest\s*\.\s*(?:importorskip|skip)\s*\("
)

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
PKG_ROW_RE = re.compile(r"^\|\s*`(M\d{2}-W\d{2})`\s*\|\s*([A-Z_]+)\s*\|")
TURBO_TASKS_RE = re.compile(r"Tasks:\s+(\d+) successful, (\d+) total")
VITEST_PASSED_RE = re.compile(r"Tests\s+(\d+) passed")
VITEST_SUMMARY_RE = re.compile(r"^\s*(?:Test Files|Tests)\s+(.+)$", re.MULTILINE)
VITEST_NONPASSING_RE = re.compile(
    r"\b([1-9]\d*)\s+(skipped|todo|pending|excluded|expected fail)\b",
    re.IGNORECASE,
)
VITEST_ORDINARY_PASS_RE = re.compile(
    r"^(?P<passed>\d+)\s+passed(?:\s+\((?P<total>\d+)\))?$"
)
PLAYWRIGHT_LIST_RE = re.compile(r"Total:\s*(\d+) tests? in")
PLAYWRIGHT_PASSED_RE = re.compile(r"^\s*(\d+) passed", re.MULTILINE)
PYTEST_PASSED_RE = re.compile(r"=+.*?\b(\d+) passed\b.*?=+")
PYTEST_SUMMARY_RE = re.compile(r"^=+\s*(.*?)\s*=+$")
PYTEST_NONPASSING_RE = re.compile(
    r"\b([1-9]\d*)\s+"
    r"(failed|errors?|skipped|xfailed|xpassed|deselected|rerun)\b",
    re.IGNORECASE,
)
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
        # Pytest's entry-point and environment plugin surfaces are host state,
        # not repository state. Clear both explicit injection variables and
        # disable entry-point autoload for every verifier child. The canonical
        # Python-suite argv repeats this boundary as a defense in depth.
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
    }
    for external_python_setting in ("PYTEST_ADDOPTS", "PYTEST_PLUGINS", "MYPYPATH"):
        env.pop(external_python_setting, None)
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
    nonpassing = _vitest_nonpassing_failure(output)
    if nonpassing:
        return nonpassing
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
    nonpassing = _vitest_nonpassing_failure(output)
    if nonpassing:
        return nonpassing
    total = sum(int(n) for n in VITEST_PASSED_RE.findall(output))
    if total < proof.min_count:
        return f"Vitest reported {total} passing tests; need >= {proof.min_count}"
    return None


def _proof_vitest_exact_tests(
    _ctx: Context, _suite: Suite, proof: Proof, output: str
) -> str | None:
    nonpassing = _vitest_nonpassing_failure(output)
    if nonpassing:
        return nonpassing
    total = sum(int(n) for n in VITEST_PASSED_RE.findall(output))
    if total != proof.min_count:
        return f"Vitest reported {total} passing tests; need exactly {proof.min_count}"
    return None


def _vitest_nonpassing_failure(output: str) -> str | None:
    """Accept only ordinary-pass Vitest summary grammar.

    Vitest's standard JSON reporter flattens intended expected failures into
    passed assertions. The pinned default reporter preserves the distinction,
    so every summary line must consist solely of an ordinary passed count,
    with an optional matching parenthesized total.
    """
    for summary in VITEST_SUMMARY_RE.findall(output):
        ordinary = VITEST_ORDINARY_PASS_RE.fullmatch(summary.strip())
        if ordinary:
            total = ordinary.group("total")
            if total is None or int(total) == int(ordinary.group("passed")):
                continue
        match = VITEST_NONPASSING_RE.search(summary)
        if match:
            return (
                "Vitest reported a non-passing outcome: "
                f"{match.group(1)} {match.group(2).lower()}"
            )
        return "Vitest reported a result other than ordinary passed tests"
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
    nonpassing = _pytest_nonpassing_failure(output)
    if nonpassing:
        return nonpassing
    match = PYTEST_PASSED_RE.search(output)
    if not match or int(match.group(1)) < proof.min_count:
        return f"pytest did not report >= {proof.min_count} passed tests"
    return None


def _pytest_nonpassing_failure(output: str) -> str | None:
    """Reject every positive nonordinary pytest result in summary lines."""
    for line in output.splitlines():
        summary = PYTEST_SUMMARY_RE.fullmatch(line.strip())
        if summary is None:
            continue
        match = PYTEST_NONPASSING_RE.search(summary.group(1))
        if match:
            return (
                "pytest reported a non-passing outcome: "
                f"{match.group(1)} {match.group(2).lower()}"
            )
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
    "vitest_exact_tests": _proof_vitest_exact_tests,
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


def _unskipped_test_paths(
    ctx: Context, patterns: tuple[str, ...], allowed_skips: tuple[str, ...]
) -> list[Path]:
    paths: list[Path] = []
    for pattern in patterns:
        for path in discovery_matches(ctx, (pattern,)):
            rel = path.relative_to(ctx.repo).as_posix()
            if any(
                part in {".git", ".turbo", "node_modules"}
                for part in path.relative_to(ctx.repo).parts
            ):
                continue
            if rel in allowed_skips:
                continue
            paths.append(path)
    return sorted(set(paths))


def _typescript_test_policy_failures(ctx: Context, paths: list[Path]) -> list[str]:
    if not paths:
        return []
    scanner = Path(__file__).resolve().with_name("check-ts-test-policy.mjs")
    if not scanner.is_file():
        return ["TypeScript test-policy AST scanner is missing"]
    node = portability.host_resolve_executable("node")
    if node is None:
        return ["node not found for TypeScript test-policy AST scan"]
    try:
        proc = subprocess.run(
            (node, str(scanner), *(str(path) for path in paths)),
            cwd=ctx.repo,
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired, UnicodeDecodeError) as exc:
        return [f"TypeScript test-policy AST scan failed: {exc}"]
    if proc.returncode == 0:
        return []
    detail = (proc.stderr or proc.stdout).strip()
    return [
        (
            "focused/conditional/skipped TypeScript test marker: "
            f"{detail or f'scanner exit {proc.returncode}'}"
        )
    ]


_PYTEST_FORBIDDEN_REFERENCES = frozenset(
    {
        ("pytest", "importorskip"),
        ("pytest", "skip"),
        ("pytest", "xfail"),
        ("pytest", "mark", "skip"),
        ("pytest", "mark", "skipif"),
        ("pytest", "mark", "xfail"),
    }
)
_PYTEST_COLLECTION_HOOKS = frozenset(
    {
        "pytest_collect_file",
        "pytest_collection",
        "pytest_collection_modifyitems",
        "pytest_configure",
        "pytest_generate_tests",
        "pytest_ignore_collect",
        "pytest_pycollect_makeitem",
    }
)
# Hooks that run after ordinary collection but can still drop already
# collected items before execution (session.items mutation). They are named
# individually in diagnostics so a count-preserving removal names its vector.
_PYTEST_EXECUTION_STAGE_HOOKS = frozenset(
    {"pytest_collection_finish", "pytest_runtestloop"}
)
_PYTEST_COLLECTION_ASSIGNMENTS = frozenset(
    {"collect_ignore", "collect_ignore_glob", "pytest_plugins"}
)
_GETATTR_MIN_ARGS = 2
_SETATTR_MIN_ARGS = 2
_SYS_MODULES_GET_MAX_ARGS = 2
_PYTHON_POLICY_MAX_DEPTH = 12
_PYTHON_POLICY_MAX_LITERAL = 128
_PYTHON_POLICY_BUILTINS = frozenset(
    {"dict", "getattr", "globals", "locals", "setattr", "vars"}
)
_PYTHON_BUILTIN_REFERENCE = ("__python_builtin__",)
_PYTHON_CURRENT_MODULE_REFERENCE = ("__python_current_module__",)
_PYTHON_MODULE_NAMESPACE_REFERENCE = ("__python_module_namespace__",)
_PYTHON_OPERATOR_SETITEM_REFERENCE = ("operator", "setitem")
_PYTHON_OPERATOR_IOR_REFERENCE = ("operator", "ior")
_PYTHON_OPERATOR_ATTRGETTER_REFERENCE = ("operator", "attrgetter")
_PYTHON_PYTEST_PLUGIN_MANAGER_REFERENCE = ("__pytest_plugin_manager__",)
_PYTHON_MODULE_NAMESPACE_MUTATORS = frozenset(
    {"__ior__", "__setitem__", "setdefault", "update"}
)
_PYTEST_PLUGIN_MANAGER_LOADERS = frozenset(
    {
        "consider_env",
        "consider_module",
        "consider_preparse",
        "import_plugin",
        "load_setuptools_entrypoints",
    }
)


@dataclass
class _PythonPolicyScope:
    parent: _PythonPolicyScope | None
    shadows: set[str]
    values: dict[str, tuple[str, ...] | str] = field(default_factory=dict)
    kind: str = "module"
    global_names: set[str] = field(default_factory=set)
    function_name: str | None = None


def _python_policy_lookup(
    scope: _PythonPolicyScope, name: str
) -> tuple[str, ...] | str | None:
    current: _PythonPolicyScope | None = scope
    while current is not None:
        if name in current.values:
            return current.values[name]
        if name in current.shadows:
            return None
        current = current.parent
    if name == "pytest":
        return ("pytest",)
    if name in _PYTHON_POLICY_BUILTINS:
        return (*_PYTHON_BUILTIN_REFERENCE, name)
    return None


def _python_policy_name_is_unshadowed(scope: _PythonPolicyScope, name: str) -> bool:
    current: _PythonPolicyScope | None = scope
    while current is not None:
        if name in current.values or name in current.shadows:
            return False
        current = current.parent
    return True


def _python_policy_static_string(  # noqa: PLR0911
    node: ast.AST, scope: _PythonPolicyScope, depth: int = 0
) -> str | None:
    if depth > _PYTHON_POLICY_MAX_DEPTH:
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value if len(node.value) <= _PYTHON_POLICY_MAX_LITERAL else None
    if isinstance(node, ast.Name):
        bound_value = _python_policy_lookup(scope, node.id)
        return bound_value if isinstance(bound_value, str) else None
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = _python_policy_static_string(node.left, scope, depth + 1)
        right = _python_policy_static_string(node.right, scope, depth + 1)
        if left is None or right is None:
            return None
        combined = left + right
        return combined if len(combined) <= _PYTHON_POLICY_MAX_LITERAL else None
    if isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for part_node in node.values:
            if not isinstance(part_node, ast.Constant) or not isinstance(
                part_node.value, str
            ):
                return None
            parts.append(part_node.value)
        combined = "".join(parts)
        return combined if len(combined) <= _PYTHON_POLICY_MAX_LITERAL else None
    return None


def _pytest_reference(  # noqa: PLR0911
    node: ast.AST, scope: _PythonPolicyScope, depth: int = 0
) -> tuple[str, ...] | None:
    if depth > _PYTHON_POLICY_MAX_DEPTH:
        return None
    if isinstance(node, ast.Name):
        value = _python_policy_lookup(scope, node.id)
        return value if isinstance(value, tuple) else None
    if isinstance(node, ast.Attribute):
        base = _pytest_reference(node.value, scope, depth + 1)
        return None if base is None else (*base, node.attr)
    if isinstance(node, ast.Subscript):
        base = _pytest_reference(node.value, scope, depth + 1)
        member = _python_policy_static_string(node.slice, scope, depth + 1)
        return None if base is None or member is None else (*base, member)
    if isinstance(node, ast.Call):
        callee = _pytest_reference(node.func, scope, depth + 1)
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "globals"),
                ("builtins", "globals"),
            }
            and not node.args
            and not node.keywords
        ):
            return _PYTHON_MODULE_NAMESPACE_REFERENCE
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "locals"),
                ("builtins", "locals"),
            }
            and scope.kind == "module"
            and not node.args
            and not node.keywords
        ):
            return _PYTHON_MODULE_NAMESPACE_REFERENCE
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "vars"),
                ("builtins", "vars"),
            }
            and not node.keywords
            and (
                (scope.kind == "module" and not node.args)
                or (
                    len(node.args) == 1
                    and _python_policy_is_current_module(node.args[0], scope)
                )
            )
        ):
            return _PYTHON_MODULE_NAMESPACE_REFERENCE
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "getattr"),
                ("builtins", "getattr"),
            }
            and len(node.args) >= _GETATTR_MIN_ARGS
        ):
            base = _pytest_reference(node.args[0], scope, depth + 1)
            member = _python_policy_static_string(node.args[1], scope, depth + 1)
            return None if base is None or member is None else (*base, member)
        if (
            isinstance(node.func, ast.Call)
            and _pytest_reference(node.func.func, scope, depth + 1)
            == _PYTHON_OPERATOR_ATTRGETTER_REFERENCE
            and len(node.func.args) == 1
            and not node.func.keywords
            and len(node.args) == 1
            and not node.keywords
        ):
            base = _pytest_reference(node.args[0], scope, depth + 1)
            member = _python_policy_static_string(node.func.args[0], scope, depth + 1)
            if base is None or member is None or "." in member:
                return None
            return (*base, member)
    return None


def _python_policy_is_current_module(node: ast.AST, scope: _PythonPolicyScope) -> bool:
    reference = _pytest_reference(node, scope)
    if reference == _PYTHON_CURRENT_MODULE_REFERENCE:
        return True
    if isinstance(node, ast.Call):
        return (
            _pytest_reference(node.func, scope) == ("sys", "modules", "get")
            and 1 <= len(node.args) <= _SYS_MODULES_GET_MAX_ARGS
            and not node.keywords
            and isinstance(node.args[0], ast.Name)
            and node.args[0].id == "__name__"
            and _python_policy_name_is_unshadowed(scope, "__name__")
        )
    return (
        isinstance(node, ast.Subscript)
        and _pytest_reference(node.value, scope) == ("sys", "modules")
        and isinstance(node.slice, ast.Name)
        and node.slice.id == "__name__"
        and _python_policy_name_is_unshadowed(scope, "__name__")
    )


def _python_policy_is_module_namespace(
    node: ast.AST, scope: _PythonPolicyScope
) -> bool:
    reference = _pytest_reference(node, scope)
    if reference == _PYTHON_MODULE_NAMESPACE_REFERENCE:
        return True
    if isinstance(node, ast.Call):
        callee = _pytest_reference(node.func, scope)
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "globals"),
                ("builtins", "globals"),
            }
            and not node.args
            and not node.keywords
        ):
            return True
        if callee in {
            (*_PYTHON_BUILTIN_REFERENCE, "locals"),
            ("builtins", "locals"),
        }:
            return scope.kind == "module" and not node.args and not node.keywords
        if (
            callee
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "vars"),
                ("builtins", "vars"),
            }
            and not node.keywords
        ):
            return (scope.kind == "module" and not node.args) or (
                len(node.args) == 1
                and _python_policy_is_current_module(node.args[0], scope)
            )
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "__dict__"
        and _python_policy_is_current_module(node.value, scope)
    )


def _python_policy_is_module_namespace_mutator(
    node: ast.AST, scope: _PythonPolicyScope
) -> bool:
    reference = _pytest_reference(node, scope)
    return (
        reference is not None
        and reference[:-1] == _PYTHON_MODULE_NAMESPACE_REFERENCE
        and reference[-1] in _PYTHON_MODULE_NAMESPACE_MUTATORS
    )


def _python_policy_is_builtin_dict_member(
    reference: tuple[str, ...] | None, member: str
) -> bool:
    return reference in {
        (*_PYTHON_BUILTIN_REFERENCE, "dict", member),
        ("builtins", "dict", member),
    }


def _normalized_pytest_reference(
    reference: tuple[str, ...] | None,
) -> tuple[str, ...] | None:
    if reference is None:
        return None
    return tuple(part for part in reference if part != "__dict__")


class _PythonLocalNameCollector(ast.NodeVisitor):
    def __init__(self) -> None:
        self.names: set[str] = set()
        self.global_names: set[str] = set()

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.names.add(node.id)

    def visit_arg(self, node: ast.arg) -> None:
        self.names.add(node.arg)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.names.add(alias.asname or alias.name.partition(".")[0])

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            if alias.name != "*":
                self.names.add(alias.asname or alias.name)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.names.add(node.name)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.names.add(node.name)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.names.add(node.name)

    def visit_Global(self, node: ast.Global) -> None:
        self.global_names.update(node.names)

    def visit_MatchAs(self, node: ast.MatchAs) -> None:
        if node.pattern is not None:
            self.visit(node.pattern)
        if node.name is not None:
            self.names.add(node.name)

    def visit_MatchStar(self, node: ast.MatchStar) -> None:
        if node.name is not None:
            self.names.add(node.name)

    def visit_MatchMapping(self, node: ast.MatchMapping) -> None:
        for pattern in node.patterns:
            self.visit(pattern)
        if node.rest is not None:
            self.names.add(node.rest)

    def visit_Lambda(self, _node: ast.Lambda) -> None:
        return

    def _visit_comprehension(
        self,
        generators: list[ast.comprehension],
        values: tuple[ast.AST, ...],
    ) -> None:
        # Comprehension iteration targets have their own scope. Assignment
        # expressions inside the comprehension instead bind the containing
        # scope, so traverse every expression but deliberately omit targets.
        for generator in generators:
            self.visit(generator.iter)
            for condition in generator.ifs:
                self.visit(condition)
        for value in values:
            self.visit(value)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self._visit_comprehension(node.generators, (node.key, node.value))

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))


def _python_function_local_names(
    node: ast.FunctionDef | ast.AsyncFunctionDef | ast.Lambda,
) -> tuple[set[str], set[str]]:
    collector = _PythonLocalNameCollector()
    for argument in (
        *node.args.posonlyargs,
        *node.args.args,
        *node.args.kwonlyargs,
    ):
        collector.visit(argument)
    if node.args.vararg is not None:
        collector.visit(node.args.vararg)
    if node.args.kwarg is not None:
        collector.visit(node.args.kwarg)
    body: list[ast.stmt] = node.body if not isinstance(node, ast.Lambda) else []
    for statement in body:
        collector.visit(statement)
    return collector.names - collector.global_names, collector.global_names


class _PythonPytestPolicyVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.scope = _PythonPolicyScope(parent=None, shadows=set())
        self.reason: str | None = None

    def _forbid(self, reason: str) -> None:
        if self.reason is None:
            self.reason = reason

    def _reference_is_forbidden(self, node: ast.AST) -> bool:
        reference = _normalized_pytest_reference(_pytest_reference(node, self.scope))
        return reference in _PYTEST_FORBIDDEN_REFERENCES

    def _visit_statements(self, statements: list[ast.stmt]) -> None:
        for statement in statements:
            if self.reason is not None:
                return
            self.visit(statement)

    def _forbid_collection_name(self, name: str) -> None:
        if name in _PYTEST_EXECUTION_STAGE_HOOKS:
            self._forbid(
                f"pytest collection/execution-stage inventory hook {name} is forbidden"
            )
        elif name in _PYTEST_COLLECTION_HOOKS:
            self._forbid("pytest collection inventory hook is forbidden")
        elif name in _PYTEST_COLLECTION_ASSIGNMENTS:
            self._forbid("pytest collection inventory mutation is forbidden")

    def _forbid_module_collection_binding(
        self, name: str, scope: _PythonPolicyScope | None = None
    ) -> None:
        target_scope = self.scope if scope is None else scope
        if target_scope.kind == "module":
            self._forbid_collection_name(name)

    @staticmethod
    def _binding_scope(name: str, scope: _PythonPolicyScope) -> _PythonPolicyScope:
        target_scope = scope
        if name in target_scope.global_names:
            while target_scope.parent is not None:
                target_scope = target_scope.parent
        return target_scope

    def _inside_pytest_hook(self) -> bool:
        scope: _PythonPolicyScope | None = self.scope
        while scope is not None:
            if scope.kind == "function":
                return bool(
                    scope.function_name is not None
                    and scope.function_name.startswith("pytest_")
                )
            scope = scope.parent
        return False

    def _is_plugin_manager(self, node: ast.AST) -> bool:
        reference = _pytest_reference(node, self.scope)
        if reference == _PYTHON_PYTEST_PLUGIN_MANAGER_REFERENCE:
            return True
        return (isinstance(node, ast.Name) and node.id == "pluginmanager") or (
            isinstance(node, ast.Attribute) and node.attr == "pluginmanager"
        )

    def _contains_module_namespace_capability(
        self, node: ast.AST, depth: int = 0
    ) -> bool:
        if depth > _PYTHON_POLICY_MAX_DEPTH:
            return True
        value = self._static_binding(node)
        if isinstance(value, tuple) and (
            value
            in {
                _PYTHON_CURRENT_MODULE_REFERENCE,
                _PYTHON_MODULE_NAMESPACE_REFERENCE,
            }
            or (
                value[:-1] == _PYTHON_MODULE_NAMESPACE_REFERENCE
                and value[-1] in _PYTHON_MODULE_NAMESPACE_MUTATORS
            )
        ):
            return True
        if isinstance(node, (ast.List, ast.Set, ast.Tuple)):
            return any(
                self._contains_module_namespace_capability(element, depth + 1)
                for element in node.elts
            )
        if isinstance(node, ast.Dict):
            return any(
                child is not None
                and self._contains_module_namespace_capability(child, depth + 1)
                for child in (*node.keys, *node.values)
            )
        if isinstance(node, ast.Starred):
            return self._contains_module_namespace_capability(node.value, depth + 1)
        return False

    def _bind(
        self,
        name: str,
        value: tuple[str, ...] | str | None,
        scope: _PythonPolicyScope | None = None,
    ) -> None:
        target_scope = self.scope if scope is None else scope
        target_scope = self._binding_scope(name, target_scope)
        self._forbid_module_collection_binding(name, target_scope)
        target_scope.shadows.add(name)
        if value is None:
            target_scope.values.pop(name, None)
        else:
            target_scope.values[name] = value

    def _static_binding(self, node: ast.AST) -> tuple[str, ...] | str | None:
        if self._is_plugin_manager(node):
            return _PYTHON_PYTEST_PLUGIN_MANAGER_REFERENCE
        if isinstance(node, ast.Attribute) and self._is_plugin_manager(node.value):
            return (*_PYTHON_PYTEST_PLUGIN_MANAGER_REFERENCE, node.attr)
        if _python_policy_is_current_module(node, self.scope):
            return _PYTHON_CURRENT_MODULE_REFERENCE
        if _python_policy_is_module_namespace(node, self.scope):
            return _PYTHON_MODULE_NAMESPACE_REFERENCE
        reference = _pytest_reference(node, self.scope)
        if reference is not None:
            return reference
        return _python_policy_static_string(node, self.scope)

    def _bind_target(
        self,
        target: ast.AST,
        value: tuple[str, ...] | str | None,
        scope: _PythonPolicyScope | None = None,
    ) -> None:
        if isinstance(target, ast.Name):
            self._bind(target.id, value, scope)
        elif isinstance(target, (ast.Tuple, ast.List)):
            for element in target.elts:
                self._bind_target(element, None, scope)
        else:
            self.visit(target)

    def _forbid_module_namespace_member(
        self, namespace: ast.AST, member: ast.AST
    ) -> None:
        if not _python_policy_is_module_namespace(namespace, self.scope):
            return
        self._forbid_namespace_member(member)

    def _forbid_namespace_member(self, member: ast.AST) -> None:
        name = _python_policy_static_string(member, self.scope)
        if name is None:
            self._forbid("dynamic pytest collection hook registration is forbidden")
            return
        self._forbid_collection_name(name)

    def _forbid_current_module_member(self, module: ast.AST, member: ast.AST) -> None:
        if not _python_policy_is_current_module(module, self.scope):
            return
        name = _python_policy_static_string(member, self.scope)
        if name is None:
            self._forbid("dynamic pytest collection hook registration is forbidden")
            return
        self._forbid_collection_name(name)

    def _forbid_namespace_mapping_keys(self, mapping: ast.AST) -> None:
        if not isinstance(mapping, ast.Dict):
            self._forbid("dynamic pytest collection hook registration is forbidden")
            return
        for key in mapping.keys:
            if key is None:
                self._forbid("dynamic pytest collection hook registration is forbidden")
                continue
            name = _python_policy_static_string(key, self.scope)
            if name is None:
                self._forbid("dynamic pytest collection hook registration is forbidden")
            else:
                self._forbid_collection_name(name)

    def _forbid_module_namespace_update(
        self,
        namespace: ast.AST,
        node: ast.Call,
        argument_offset: int = 0,
    ) -> None:
        if not _python_policy_is_module_namespace(namespace, self.scope):
            return
        self._forbid_namespace_update(node, argument_offset)

    def _forbid_namespace_update(
        self,
        node: ast.Call,
        argument_offset: int = 0,
    ) -> None:
        arguments = node.args[argument_offset:]
        if len(arguments) > 1:
            self._forbid("dynamic pytest collection hook registration is forbidden")
        elif arguments:
            self._forbid_namespace_mapping_keys(arguments[0])
        for keyword in node.keywords:
            if keyword.arg is None:
                self._forbid("dynamic pytest collection hook registration is forbidden")
            else:
                self._forbid_collection_name(keyword.arg)

    def _visit_comprehension(
        self,
        generators: list[ast.comprehension],
        values: tuple[ast.AST, ...],
    ) -> None:
        if not generators:
            for value in values:
                self.visit(value)
            return

        first, *remaining = generators
        # The leading iterable is evaluated in the containing scope.
        self.visit(first.iter)
        previous = self.scope
        self.scope = _PythonPolicyScope(
            parent=previous,
            shadows=set(),
            kind="comprehension",
        )
        self._bind_target(first.target, None)
        for condition in first.ifs:
            self.visit(condition)
        for generator in remaining:
            self.visit(generator.iter)
            self._bind_target(generator.target, None)
            for condition in generator.ifs:
                self.visit(condition)
        for value in values:
            self.visit(value)
        self.scope = previous

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            local = alias.asname or alias.name.partition(".")[0]
            reference = None
            if alias.name == "pytest":
                reference = ("pytest",)
            elif alias.name == "sys":
                reference = ("sys",)
            elif alias.name == "builtins":
                reference = ("builtins",)
            elif alias.name == "operator":
                reference = ("operator",)
            self._bind(local, reference)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            if alias.name == "*":
                if node.module == "pytest":
                    self._forbid("pytest wildcard import is forbidden")
                continue
            local = alias.asname or alias.name
            reference = None
            if node.module == "pytest":
                reference = ("pytest", alias.name)
            elif node.module == "sys":
                reference = ("sys", alias.name)
            elif node.module == "builtins" and alias.name in _PYTHON_POLICY_BUILTINS:
                reference = (*_PYTHON_BUILTIN_REFERENCE, alias.name)
            elif node.module == "operator":
                reference = ("operator", alias.name)
            if (
                reference is not None
                and _normalized_pytest_reference(reference)
                in _PYTEST_FORBIDDEN_REFERENCES
            ):
                self._forbid("pytest skip/expected-failure policy surface is forbidden")
            self._bind(local, reference)

    def visit_Assign(self, node: ast.Assign) -> None:
        self.visit(node.value)
        value = self._static_binding(node.value)
        for target in node.targets:
            self._bind_target(target, value)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if node.value is not None:
            self.visit(node.value)
        self.visit(node.annotation)
        value = None if node.value is None else self._static_binding(node.value)
        self._bind_target(node.target, value)

    def visit_NamedExpr(self, node: ast.NamedExpr) -> None:
        self.visit(node.value)
        target_scope = self.scope
        while target_scope.kind == "comprehension" and target_scope.parent is not None:
            target_scope = target_scope.parent
        self._bind_target(
            node.target,
            self._static_binding(node.value),
            target_scope,
        )

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        namespace_binding = (
            _PYTHON_MODULE_NAMESPACE_REFERENCE
            if (
                isinstance(node.op, ast.BitOr)
                and _python_policy_is_module_namespace(node.target, self.scope)
            )
            else None
        )
        if namespace_binding is not None:
            self._forbid_namespace_mapping_keys(node.value)
        self.visit(node.target)
        self.visit(node.value)
        self._bind_target(node.target, namespace_binding)

    def visit_Delete(self, node: ast.Delete) -> None:
        for target in node.targets:
            self._bind_target(target, None)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        if self.scope.kind == "module":
            self._forbid_collection_name(node.name)
        for decorator in node.decorator_list:
            self.visit(decorator)
        for default in (*node.args.defaults, *node.args.kw_defaults):
            if default is not None:
                if self._contains_module_namespace_capability(default):
                    self._forbid(
                        "dynamic pytest collection hook registration is forbidden"
                    )
                self.visit(default)
        if node.returns is not None:
            self.visit(node.returns)
        self._bind(node.name, None)
        parent = self.scope.parent if self.scope.kind == "class" else self.scope
        local_names, global_names = _python_function_local_names(node)
        child = _PythonPolicyScope(
            parent=parent,
            shadows=local_names,
            kind="function",
            global_names=global_names,
            function_name=node.name,
        )
        previous = self.scope
        self.scope = child
        self._visit_statements(node.body)
        self.scope = previous

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        for default in (*node.args.defaults, *node.args.kw_defaults):
            if default is not None:
                if self._contains_module_namespace_capability(default):
                    self._forbid(
                        "dynamic pytest collection hook registration is forbidden"
                    )
                self.visit(default)
        local_names, global_names = _python_function_local_names(node)
        previous = self.scope
        self.scope = _PythonPolicyScope(
            parent=previous,
            shadows=local_names,
            kind="function",
            global_names=global_names,
        )
        self.visit(node.body)
        self.scope = previous

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        for decorator in node.decorator_list:
            self.visit(decorator)
        for base in node.bases:
            self.visit(base)
        for keyword in node.keywords:
            self.visit(keyword.value)
        self._bind(node.name, None)
        previous = self.scope
        self.scope = _PythonPolicyScope(
            parent=previous,
            shadows=set(),
            kind="class",
        )
        self._visit_statements(node.body)
        self.scope = previous

    def _visit_container(self, node: ast.List | ast.Set | ast.Tuple | ast.Dict) -> None:
        if self._contains_module_namespace_capability(node):
            self._forbid("dynamic pytest collection hook registration is forbidden")
        self.generic_visit(node)

    def visit_List(self, node: ast.List) -> None:
        self._visit_container(node)

    def visit_Set(self, node: ast.Set) -> None:
        self._visit_container(node)

    def visit_Tuple(self, node: ast.Tuple) -> None:
        self._visit_container(node)

    def visit_Dict(self, node: ast.Dict) -> None:
        self._visit_container(node)

    def visit_Match(self, node: ast.Match) -> None:
        if self._contains_module_namespace_capability(node.subject):
            self._forbid("dynamic pytest collection hook registration is forbidden")
        self.generic_visit(node)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self._visit_comprehension(node.generators, (node.key, node.value))

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self._visit_comprehension(node.generators, (node.elt,))

    def visit_MatchAs(self, node: ast.MatchAs) -> None:
        if node.pattern is not None:
            self.visit(node.pattern)
        if node.name is not None:
            self._bind(node.name, None)

    def visit_MatchStar(self, node: ast.MatchStar) -> None:
        if node.name is not None:
            self._bind(node.name, None)

    def visit_MatchMapping(self, node: ast.MatchMapping) -> None:
        for key in node.keys:
            self.visit(key)
        for pattern in node.patterns:
            self.visit(pattern)
        if node.rest is not None:
            self._bind(node.rest, None)

    def visit_Call(self, node: ast.Call) -> None:  # noqa: PLR0912, PLR0915
        if self._reference_is_forbidden(node.func):
            self._forbid("pytest skip/expected-failure policy surface is forbidden")
        callee_reference = _pytest_reference(node.func, self.scope)
        modeled_namespace_arguments: set[int] = set()
        getattr_base = (
            _pytest_reference(node.args[0], self.scope)
            if (
                callee_reference
                in {
                    (*_PYTHON_BUILTIN_REFERENCE, "getattr"),
                    ("builtins", "getattr"),
                }
                and len(node.args) >= _GETATTR_MIN_ARGS
            )
            else None
        )
        if (
            getattr_base is not None
            and getattr_base[0] == "pytest"
            and _python_policy_static_string(node.args[1], self.scope) is None
        ):
            self._forbid("dynamic pytest member access is forbidden")
        if (
            callee_reference
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "getattr"),
                ("builtins", "getattr"),
            }
            and len(node.args) >= _GETATTR_MIN_ARGS
            and _python_policy_is_module_namespace(node.args[0], self.scope)
        ):
            modeled_namespace_arguments.add(0)
            if _python_policy_static_string(node.args[1], self.scope) is None:
                self._forbid("dynamic pytest collection hook registration is forbidden")
        if (
            callee_reference
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "setattr"),
                ("builtins", "setattr"),
            }
            and len(node.args) >= _SETATTR_MIN_ARGS
        ):
            if _python_policy_is_current_module(node.args[0], self.scope):
                modeled_namespace_arguments.add(0)
            self._forbid_current_module_member(node.args[0], node.args[1])
        if (
            callee_reference
            in {
                (*_PYTHON_BUILTIN_REFERENCE, "vars"),
                ("builtins", "vars"),
            }
            and len(node.args) == 1
            and not node.keywords
            and _python_policy_is_current_module(node.args[0], self.scope)
        ):
            modeled_namespace_arguments.add(0)
        if (
            callee_reference == _PYTHON_OPERATOR_SETITEM_REFERENCE
            and len(node.args) >= _SETATTR_MIN_ARGS
        ):
            modeled_namespace_arguments.add(0)
            self._forbid_module_namespace_member(node.args[0], node.args[1])
        if callee_reference == _PYTHON_OPERATOR_IOR_REFERENCE and node.args:
            modeled_namespace_arguments.add(0)
            self._forbid_module_namespace_update(node.args[0], node, argument_offset=1)
        if (
            _python_policy_is_builtin_dict_member(callee_reference, "__setitem__")
            or _python_policy_is_builtin_dict_member(callee_reference, "setdefault")
        ) and len(node.args) >= _SETATTR_MIN_ARGS:
            modeled_namespace_arguments.add(0)
            self._forbid_module_namespace_member(node.args[0], node.args[1])
        if (
            _python_policy_is_builtin_dict_member(callee_reference, "update")
            or _python_policy_is_builtin_dict_member(callee_reference, "__ior__")
        ) and node.args:
            modeled_namespace_arguments.add(0)
            self._forbid_module_namespace_update(node.args[0], node, argument_offset=1)
        namespace_member = (
            callee_reference[-1]
            if (
                callee_reference is not None
                and callee_reference[:-1] == _PYTHON_MODULE_NAMESPACE_REFERENCE
            )
            else None
        )
        if namespace_member in {"__setitem__", "setdefault"} and node.args:
            self._forbid_namespace_member(node.args[0])
        if namespace_member in {"update", "__ior__"}:
            self._forbid_namespace_update(node)
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr == "__setitem__"
            and node.args
        ):
            self._forbid_module_namespace_member(node.func.value, node.args[0])
        if isinstance(node.func, ast.Attribute) and node.func.attr in {
            "update",
            "__ior__",
        }:
            self._forbid_module_namespace_update(node.func.value, node)
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr == "setdefault"
            and node.args
        ):
            self._forbid_module_namespace_member(node.func.value, node.args[0])
        if (
            self._inside_pytest_hook()
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "register"
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == "pluginmanager"
        ):
            self._forbid("dynamic pytest collection plugin registration is forbidden")
        member = node.func.attr if isinstance(node.func, ast.Attribute) else None
        plugin_manager_member = (
            callee_reference[-1]
            if (
                callee_reference is not None
                and callee_reference[:-1] == _PYTHON_PYTEST_PLUGIN_MANAGER_REFERENCE
            )
            else (
                member
                if (
                    isinstance(node.func, ast.Attribute)
                    and self._is_plugin_manager(node.func.value)
                )
                else None
            )
        )
        if (
            self._inside_pytest_hook()
            and plugin_manager_member in _PYTEST_PLUGIN_MANAGER_LOADERS
        ):
            self._forbid("dynamic pytest collection plugin registration is forbidden")
        if member == "add_marker" and node.args:
            marker = node.args[0]
            marker_name = _python_policy_static_string(marker, self.scope)
            if self._reference_is_forbidden(marker) or (
                marker_name is not None
                and marker_name.casefold() in {"skip", "skipif", "xfail"}
            ):
                self._forbid("pytest collection-time skip marker is forbidden")
        for index, argument in enumerate(node.args):
            if index in modeled_namespace_arguments:
                continue
            if self._contains_module_namespace_capability(argument):
                self._forbid("dynamic pytest collection hook registration is forbidden")
            if self._inside_pytest_hook() and self._is_plugin_manager(argument):
                self._forbid(
                    "dynamic pytest collection plugin registration is forbidden"
                )
        for keyword in node.keywords:
            if self._contains_module_namespace_capability(keyword.value):
                self._forbid("dynamic pytest collection hook registration is forbidden")
            if self._inside_pytest_hook() and self._is_plugin_manager(keyword.value):
                self._forbid(
                    "dynamic pytest collection plugin registration is forbidden"
                )
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, ast.Store):
            target_scope = self._binding_scope(node.id, self.scope)
            self._forbid_module_collection_binding(node.id, target_scope)
        elif isinstance(node.ctx, ast.Load) and self._reference_is_forbidden(node):
            self._forbid("pytest skip/expected-failure policy surface is forbidden")

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self._forbid_current_module_member(node.value, ast.Constant(node.attr))
        if self._reference_is_forbidden(node):
            self._forbid("pytest skip/expected-failure policy surface is forbidden")
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        base = _pytest_reference(node.value, self.scope)
        if (
            base is not None
            and base[0] == "pytest"
            and _python_policy_static_string(node.slice, self.scope) is None
        ):
            self._forbid("dynamic pytest member access is forbidden")
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self._forbid_module_namespace_member(node.value, node.slice)
        if self._reference_is_forbidden(node):
            self._forbid("pytest skip/expected-failure policy surface is forbidden")
        self.generic_visit(node)


def _python_pytest_policy_reason(text: str) -> str | None:
    try:
        tree = ast.parse(text)
    except (SyntaxError, ValueError):
        return "Python test source does not parse"
    visitor = _PythonPytestPolicyVisitor()
    visitor.visit(tree)
    return visitor.reason


def _python_skip_marker_failures(ctx: Context, paths: list[Path]) -> list[str]:
    failures: list[str] = []
    for path in paths:
        relative = path.relative_to(ctx.repo).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            failures.append(f"Python test policy could not read {relative}")
            continue
        reason = _python_pytest_policy_reason(text)
        if reason:
            failures.append(f"{reason} in {relative}")
    return failures


def _pytest_loaded_conftest_paths(ctx: Context, test_paths: list[Path]) -> list[Path]:
    """Return every repository conftest on each configured test's ancestor path."""
    conftests: set[Path] = set()
    for test_path in test_paths:
        current = test_path.parent
        while current == ctx.repo or ctx.repo in current.parents:
            candidate = current / "conftest.py"
            if candidate.is_file():
                conftests.add(candidate)
            if current == ctx.repo:
                break
            current = current.parent
    return sorted(conftests)


def _python_test_policy_paths(
    ctx: Context, allowed_skips: tuple[str, ...]
) -> list[Path]:
    test_paths = _unskipped_test_paths(ctx, PY_TEST_FILE_GLOBS, allowed_skips)
    local_policy_paths = _unskipped_test_paths(ctx, PY_TEST_GLOBS, allowed_skips)
    return sorted(
        {
            *local_policy_paths,
            *_pytest_loaded_conftest_paths(ctx, test_paths),
        }
    )


def _python_test_policy_failures(
    ctx: Context, allowed_skips: tuple[str, ...]
) -> list[str]:
    return _python_skip_marker_failures(
        ctx, _python_test_policy_paths(ctx, allowed_skips)
    )


def _alternate_pytest_config_is_effective(path: Path) -> bool:
    if path.name in {"pytest.toml", ".pytest.toml", "pytest.ini", ".pytest.ini"}:
        return True
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return True
    section = "pytest" if path.name == "tox.ini" else "tool:pytest"
    return (
        re.search(rf"^\s*\[{re.escape(section)}\]\s*$", text, re.MULTILINE) is not None
    )


def _pytest_addopts_tokens(value: object) -> tuple[str, ...] | None:
    if isinstance(value, str):
        try:
            return tuple(shlex.split(value, posix=True))
        except ValueError:
            return None
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        tokens: list[str] = []
        try:
            for item in value:
                tokens.extend(shlex.split(item, posix=True))
        except ValueError:
            return None
        return tuple(tokens)
    return None


def _pytest_configuration_failures(ctx: Context) -> list[str]:
    """Reject repository configuration that could replace canonical collection."""
    failures: list[str] = []
    for name in PYTEST_ALTERNATE_CONFIGS:
        path = ctx.repo / name
        if path.is_file() and _alternate_pytest_config_is_effective(path):
            failures.append(
                f"pytest configuration must use canonical pyproject.toml, not {name}"
            )

    pyproject = ctx.repo / "pyproject.toml"
    if not pyproject.is_file():
        return failures
    try:
        with pyproject.open("rb") as handle:
            raw: object = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        failures.append(f"pytest configuration could not read pyproject.toml: {exc}")
        return failures
    if not isinstance(raw, dict):
        return failures
    tool = raw.get("tool")
    pytest_options: object = None
    if isinstance(tool, dict):
        pytest_table = tool.get("pytest")
        if isinstance(pytest_table, dict):
            pytest_options = pytest_table.get("ini_options")
    if pytest_options is None:
        return failures
    if not isinstance(pytest_options, dict):
        failures.append("pytest configuration ini_options must be a table")
        return failures

    if "addopts" in pytest_options:
        tokens = _pytest_addopts_tokens(pytest_options["addopts"])
        if tokens != PYTEST_CANONICAL_ADDOPTS:
            failures.append(
                "pytest configuration addopts must contain only the canonical "
                "-ra, --strict-markers, and --strict-config options"
            )
    required_plugins = pytest_options.get("required_plugins")
    if required_plugins not in (None, "", []):
        failures.append("pytest configuration required_plugins is forbidden")
    return failures


def _python_conftest_quality_commands(
    ctx: Context, paths: list[Path]
) -> tuple[tuple[str, ...], ...]:
    """Build pinned quality checks for conftests outside static registry roots."""
    relatives = tuple(sorted({path.relative_to(ctx.repo).as_posix() for path in paths}))
    if not relatives:
        return ()
    return (
        (
            "uv",
            "run",
            "ruff",
            "check",
            "--config",
            "pyproject.toml",
            *relatives,
        ),
        (
            "uv",
            "run",
            "ruff",
            "format",
            "--check",
            "--config",
            "pyproject.toml",
            *relatives,
        ),
        (
            "uv",
            "run",
            "mypy",
            "--config-file",
            "pyproject.toml",
            *relatives,
        ),
    )


def _canonical_python_suite_command(
    ctx: Context, argv: tuple[str, ...]
) -> tuple[str, ...]:
    if argv == ("uv", "run", "pytest"):
        test_paths = _unskipped_test_paths(ctx, PY_TEST_FILE_GLOBS, ())
        relatives = tuple(path.relative_to(ctx.repo).as_posix() for path in test_paths)
        return (
            "uv",
            "run",
            "pytest",
            "-c",
            "pyproject.toml",
            "--rootdir=.",
            "--confcutdir=.",
            "-o",
            "addopts=",
            *PYTEST_CANONICAL_ADDOPTS,
            "--disable-plugin-autoload",
            *relatives,
        )
    if (
        argv[:4]
        in {
            ("uv", "run", "ruff", "check"),
            ("uv", "run", "ruff", "format"),
        }
        and "--config" not in argv
    ):
        return (*argv[:4], "--config", "pyproject.toml", *argv[4:])
    if argv[:3] == ("uv", "run", "mypy") and "--config-file" not in argv:
        return (*argv[:3], "--config-file", "pyproject.toml", *argv[3:])
    return argv


def _run_python_suite_preflight(
    ctx: Context, registry: Registry
) -> tuple[list[str], list[str]]:
    messages = [
        *_pytest_configuration_failures(ctx),
        *_python_test_policy_failures(ctx, registry.allowed_skips),
    ]
    output_parts: list[str] = []
    if messages:
        return messages, output_parts
    test_paths = _unskipped_test_paths(ctx, PY_TEST_FILE_GLOBS, registry.allowed_skips)
    conftests = _pytest_loaded_conftest_paths(ctx, test_paths)
    for quality_argv in _python_conftest_quality_commands(ctx, conftests):
        code, output = run_command(ctx, quality_argv)
        output_parts.append(output)
        if code != 0:
            messages.append(f"command failed (exit {code}): {' '.join(quality_argv)}")
            break
    return messages, output_parts


def check_focused_tests(ctx: Context, allowed_skips: tuple[str, ...]) -> list[str]:
    """AST-scan every on-disk TypeScript and Python test-policy surface."""
    ts_paths = _unskipped_test_paths(ctx, TS_TEST_GLOBS, allowed_skips)
    return [
        *_typescript_test_policy_failures(ctx, ts_paths),
        *_python_test_policy_failures(ctx, allowed_skips),
    ]


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
    failures.extend(_pytest_configuration_failures(ctx))
    failures.extend(check_focused_tests(ctx, registry.allowed_skips))
    failures.extend(check_raw_control_bytes(ctx, tracked))
    return failures


_VITEST_DEFAULT_REPORTER_ARG = "--reporter=default"
# Turbo tasks whose underlying workspace scripts are Vitest invocations; the
# canonical reporter is forwarded to them through turbo's `--` pass-through.
_TURBO_VITEST_TASKS = frozenset({"test"})


def _argv_element_basename(element: str) -> str:
    return element.replace("\\", "/").rsplit("/", 1)[-1]


def _argv_vitest_invocation_kind(argv: tuple[str, ...]) -> str | None:
    """'vitest' for direct Vitest argv, 'turbo' for turbo-run Vitest tasks."""
    names = [_argv_element_basename(element) for element in argv]
    if "vitest" in names:
        return "vitest"
    if "turbo" in names:
        rest = argv[names.index("turbo") + 1 :]
        if rest[:1] == ("run",) and any(
            task in _TURBO_VITEST_TASKS for task in rest[1:2]
        ):
            return "turbo"
    return None


def _prepared_reporter_commands(
    commands: tuple[tuple[str, ...], ...],
) -> tuple[list[str], tuple[tuple[str, ...], ...]]:
    """Force the canonical Vitest reporter channel onto suite commands.

    Verification owns its result channel: a registry command may not select
    its own Vitest reporter (a repository reporter module could print a
    forged ordinary-pass summary), and every Vitest-backed command has the
    pinned default reporter appended so a vitest.config reporter cannot
    replace the summary grammar either.
    """
    failures: list[str] = []
    prepared: list[tuple[str, ...]] = []
    for argv in commands:
        kind = _argv_vitest_invocation_kind(argv)
        if kind is None:
            prepared.append(argv)
            continue
        if any(
            element == "--reporter" or element.startswith("--reporter=")
            for element in argv
        ):
            failures.append(
                "suite command declares its own Vitest reporter; the "
                "verifier owns the canonical reporter channel: "
                f"{' '.join(argv)}"
            )
        elif kind == "turbo" and "--" in argv:
            failures.append(
                "turbo Vitest command already forwards arguments; the "
                "verifier owns the canonical reporter channel: "
                f"{' '.join(argv)}"
            )
        elif kind == "turbo":
            prepared.append((*argv, "--", _VITEST_DEFAULT_REPORTER_ARG))
        else:
            prepared.append((*argv, _VITEST_DEFAULT_REPORTER_ARG))
    return failures, tuple(prepared)


def run_suite(  # noqa: PLR0912 - explicit independent suite outcomes
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
        if suite.suite_id == "python":
            messages, output_parts = _run_python_suite_preflight(ctx, registry)
            commands: tuple[tuple[str, ...], ...] = tuple(
                _canonical_python_suite_command(ctx, argv) for argv in suite.commands
            )
        else:
            reporter_failures, commands = _prepared_reporter_commands(suite.commands)
            messages.extend(reporter_failures)
        for argv in commands if not messages else ():
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
