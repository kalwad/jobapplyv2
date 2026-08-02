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
import stat
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
    "scripts/python-test-inventory.v1.json",
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
PYTEST_LONG_DURATION_SECONDS = 60
PYTHON_TEST_INVENTORY_RELATIVE = "scripts/python-test-inventory.v1.json"
PYTHON_INVENTORY_SCHEMA_VERSION = 1
PYTHON_INVENTORY_NORMALIZATION_VERSION = 1
PYTHON_POSIX_ONLY_NODE_IDS = (
    (
        "scripts/tests/test_v14_migration.py::"
        "test_atomic_adoption_rejects_non_regular_source[fifo]"
    ),
    (
        "scripts/tests/test_v14_migration.py::"
        "test_atomic_adoption_rejects_non_regular_source[socket]"
    ),
)
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
PYTEST_ORDINARY_SUMMARY_RE = re.compile(
    r"^=+\s+(?P<passed>0|[1-9]\d*) passed in "
    r"(?P<seconds>0|[1-9]\d*)\.\d{2}s"
    r"(?P<clock> \([0-9]+:[0-5][0-9]:[0-5][0-9]\))?\s+=+$"
)
PYTEST_COLLECTION_SUMMARY_RE = re.compile(
    r"^(?:=+\s*)?(?P<count>0|[1-9]\d*) tests? collected in "
    r"(?P<seconds>0|[1-9]\d*)\.\d{2}s"
    r"(?P<clock> \([0-9]+:[0-5][0-9]:[0-5][0-9]\))?(?:\s*=+)?$"
)
PYTEST_OUTCOME_CANDIDATE_RE = re.compile(
    r"^=+\s+(?:(?:0|[1-9]\d*)\s+\S+|no tests ran\b|"
    r".*\b(?:passed|failed|errors?|skipped|xfailed|xpassed|deselected|"
    r"rerun|warnings?)\b)",
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
    python_expected_count: int | None = None
    python_expected_digest: str | None = None
    python_test_relatives: tuple[str, ...] = ()


@dataclass(frozen=True)
class PythonTestInventory:
    node_ids: tuple[str, ...]
    count: int
    sha256: str
    platform: str


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


def _workspace_manifest_paths_checked(  # noqa: PLR0911, PLR0912
    ctx: Context,
) -> tuple[list[Path], str | None]:
    """Strictly resolve package.json paths from the supported workspace YAML."""
    workspace_file = ctx.repo / "pnpm-workspace.yaml"
    globs: list[str] = []
    try:
        metadata = workspace_file.lstat()
        source = workspace_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return [], "pnpm workspace definition is missing or unreadable"
    if workspace_file.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        return [], "pnpm workspace definition must be a regular nonsymlink file"
    in_packages = False
    saw_packages = False
    for raw in source.splitlines():
        stripped = raw.strip()
        if not in_packages:
            if re.fullmatch(r"packages:\s*", raw):
                if saw_packages:
                    return [], "pnpm workspace has duplicate packages sections"
                saw_packages = True
                in_packages = True
            elif re.match(r"^packages\s*:", raw):
                return [], "pnpm workspace packages syntax is unsupported"
            continue
        if not stripped or stripped.startswith("#"):
            continue
        if not raw.startswith((" ", "\t")):
            in_packages = False
            continue
        item = re.fullmatch(
            r"\s+-\s+(?:\"([^\"]+)\"|'([^']+)'|([^\s#]+))\s*(?:#.*)?",
            raw,
        )
        if item is None:
            return [], "pnpm workspace packages list contains unsupported syntax"
        pattern = next(value for value in item.groups() if value is not None)
        if (
            not pattern
            or pattern.startswith(("/", "\\"))
            or ".." in Path(pattern).parts
        ):
            return [], "pnpm workspace package pattern is unsafe"
        globs.append(pattern)
    if not saw_packages or not globs:
        return [], "pnpm workspace packages list is empty or unsupported"
    paths: list[Path] = []
    for pattern in globs:
        matches = sorted(ctx.repo.glob(f"{pattern}/package.json"))
        if not matches:
            return [], "pnpm workspace package pattern resolves to no manifests"
        paths.extend(matches)
    ordered = sorted(set(paths))
    if not ordered:
        return [], "pnpm workspace resolves to no package manifests"
    return ordered, None


def _workspace_manifest_paths(ctx: Context) -> list[Path]:
    """package.json paths of every supported pnpm workspace member."""
    paths, _failure = _workspace_manifest_paths_checked(ctx)
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


def _pytest_terminal_pass_count(output: str) -> tuple[int | None, str | None]:
    """Parse one final, complete, ordinary-only pinned-pytest summary."""
    normalized = output.replace("\r\n", "\n")
    if "\r" in normalized:
        return None, "pytest output contains unsupported bare carriage returns"
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    summary_lines = [line for line in lines if PYTEST_OUTCOME_CANDIDATE_RE.match(line)]
    if len(summary_lines) != 1:
        return None, (
            "pytest output must contain exactly one terminal outcome summary; "
            f"found {len(summary_lines)}"
        )
    summary = summary_lines[0]
    if lines[-1] != summary:
        return None, "pytest outcome summary is not the final output line"
    match = PYTEST_ORDINARY_SUMMARY_RE.fullmatch(summary)
    if match is None:
        return None, "pytest terminal summary is not an ordinary-only pass result"
    duration_failure = _pytest_duration_clock_failure(match, "terminal summary")
    if duration_failure:
        return None, duration_failure
    return int(match.group("passed")), None


def _pytest_duration_clock_failure(match: re.Match[str], surface: str) -> str | None:
    """Require the pinned pytest clock exactly when the duration is long."""
    seconds = int(match.group("seconds"))
    clock = match.group("clock")
    if seconds < PYTEST_LONG_DURATION_SECONDS:
        return (
            f"pytest {surface} has an unexpected short-duration clock"
            if clock is not None
            else None
        )
    if clock is None:
        return f"pytest {surface} lacks the pinned long-duration clock"
    hours, remainder = divmod(seconds, 3600)
    minutes, remaining_seconds = divmod(remainder, 60)
    expected = f" ({hours}:{minutes:02d}:{remaining_seconds:02d})"
    return (
        f"pytest {surface} long-duration clock differs from elapsed seconds"
        if clock != expected
        else None
    )


def _proof_pytest_exact_inventory(
    ctx: Context, _suite: Suite, _proof: Proof, output: str
) -> str | None:
    if ctx.python_expected_count is None or ctx.python_expected_digest is None:
        return "pytest exact inventory expectation is unavailable (fail closed)"
    passed, failure = _pytest_terminal_pass_count(output)
    if failure:
        return failure
    if passed != ctx.python_expected_count:
        return (
            f"pytest reported {passed or 0} passed tests; exact platform "
            f"inventory requires {ctx.python_expected_count}"
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
    "pytest_exact_inventory": _proof_pytest_exact_inventory,
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


def _python_inventory_digest(node_ids: tuple[str, ...]) -> str:
    return hashlib.sha256(("\n".join(node_ids) + "\n").encode("utf-8")).hexdigest()


def _normalize_python_node_id(
    value: str, test_relatives: tuple[str, ...]
) -> str | None:
    path_text, separator, selector = value.partition("::")
    if (
        not separator
        or not selector
        or any(character.isspace() for character in path_text)
    ):
        return None
    normalized_path = path_text.replace("\\", "/")
    if normalized_path not in set(test_relatives):
        return None
    return f"{normalized_path}::{selector}"


def _load_python_test_inventory(  # noqa: PLR0911, PLR0912 - schema validation
    ctx: Context,
    test_relatives: tuple[str, ...],
    platform_name: str | None = None,
) -> tuple[PythonTestInventory | None, str | None]:
    path = ctx.repo / PYTHON_TEST_INVENTORY_RELATIVE
    try:
        metadata = path.lstat()
    except OSError:
        return None, "Python test inventory is missing or unreadable"
    if path.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        return None, "Python test inventory must be a regular nonsymlink file"
    try:
        raw_bytes = path.read_bytes()
        raw: object = json.loads(raw_bytes.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None, "Python test inventory is not canonical UTF-8 JSON"
    if not isinstance(raw, dict) or set(raw) != {
        "schema_version",
        "normalization_version",
        "common",
        "posix_only_node_ids",
    }:
        return None, "Python test inventory has an unsupported schema"
    if (
        raw.get("schema_version") != PYTHON_INVENTORY_SCHEMA_VERSION
        or isinstance(raw.get("schema_version"), bool)
        or raw.get("normalization_version") != PYTHON_INVENTORY_NORMALIZATION_VERSION
        or isinstance(raw.get("normalization_version"), bool)
    ):
        return None, "Python test inventory schema or normalization version differs"
    common = raw.get("common")
    posix_raw = raw.get("posix_only_node_ids")
    if (
        not isinstance(common, dict)
        or set(common) != {"count", "sha256", "node_ids"}
        or not isinstance(posix_raw, list)
        or not all(isinstance(item, str) for item in posix_raw)
    ):
        return None, "Python test inventory payload is malformed"
    common_raw = common.get("node_ids")
    count_raw = common.get("count")
    digest_raw = common.get("sha256")
    if (
        not isinstance(common_raw, list)
        or not all(isinstance(item, str) for item in common_raw)
        or not isinstance(count_raw, int)
        or isinstance(count_raw, bool)
        or not isinstance(digest_raw, str)
    ):
        return None, "Python test inventory common identity is malformed"
    common_ids = tuple(common_raw)
    posix_ids = tuple(posix_raw)
    if (
        common_ids != tuple(sorted(common_ids))
        or len(common_ids) != len(set(common_ids))
        or count_raw != len(common_ids)
        or digest_raw != _python_inventory_digest(common_ids)
    ):
        return None, "Python test inventory common identity is inconsistent"
    if posix_ids != PYTHON_POSIX_ONLY_NODE_IDS:
        return None, "Python test inventory POSIX delta is not the approved exact pair"
    for node_id in (*common_ids, *posix_ids):
        if _normalize_python_node_id(node_id, test_relatives) != node_id:
            return None, "Python test inventory contains a noncanonical node ID"
    if set(common_ids).intersection(posix_ids):
        return None, "Python test inventory common and POSIX identities overlap"
    canonical_payload = {
        "schema_version": PYTHON_INVENTORY_SCHEMA_VERSION,
        "normalization_version": PYTHON_INVENTORY_NORMALIZATION_VERSION,
        "common": {
            "count": len(common_ids),
            "sha256": _python_inventory_digest(common_ids),
            "node_ids": list(common_ids),
        },
        "posix_only_node_ids": list(PYTHON_POSIX_ONLY_NODE_IDS),
    }
    canonical_bytes = (
        json.dumps(canonical_payload, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    if raw_bytes != canonical_bytes:
        return None, "Python test inventory JSON serialization is not canonical"
    platform_value = sys.platform if platform_name is None else platform_name
    if platform_value in {"darwin", "linux"}:
        platform_ids = tuple(sorted((*common_ids, *posix_ids)))
        platform_label = "posix"
    elif platform_value == "win32":
        platform_ids = common_ids
        platform_label = "windows"
    else:
        return None, "Python test inventory does not support this host platform"
    return (
        PythonTestInventory(
            node_ids=platform_ids,
            count=len(platform_ids),
            sha256=_python_inventory_digest(platform_ids),
            platform=platform_label,
        ),
        None,
    )


def _parse_pytest_collection_output(  # noqa: PLR0911 - fail-closed parser exits
    output: str, test_relatives: tuple[str, ...]
) -> tuple[tuple[str, ...] | None, str | None]:
    normalized = output.replace("\r\n", "\n")
    if "\r" in normalized:
        return None, "pytest collection output contains a bare carriage return"
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    if not lines:
        return None, "pytest collection output is empty"
    summary = PYTEST_COLLECTION_SUMMARY_RE.fullmatch(lines[-1])
    if summary is None:
        return None, "pytest collection lacks one complete terminal summary"
    duration_failure = _pytest_duration_clock_failure(summary, "collection summary")
    if duration_failure:
        return None, duration_failure
    raw_node_ids = lines[:-1]
    normalized_node_ids: list[str] = []
    for raw_node_id in raw_node_ids:
        node_id = _normalize_python_node_id(raw_node_id, test_relatives)
        if node_id is None:
            return None, "pytest collection emitted a noncanonical or unknown node ID"
        normalized_node_ids.append(node_id)
    if int(summary.group("count")) != len(normalized_node_ids):
        return None, "pytest collection summary count differs from emitted node IDs"
    if len(normalized_node_ids) != len(set(normalized_node_ids)):
        return None, "pytest collection emitted duplicate node IDs"
    return tuple(sorted(normalized_node_ids)), None


def _canonical_pytest_command(
    test_relatives: tuple[str, ...], *, collect_only: bool
) -> tuple[str, ...]:
    collection_args = ("--collect-only", "-q") if collect_only else ()
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
        *collection_args,
        *test_relatives,
    )


def _canonical_python_suite_command(
    ctx: Context, argv: tuple[str, ...]
) -> tuple[str, ...]:
    if argv == ("uv", "run", "pytest"):
        relatives = ctx.python_test_relatives or tuple(
            path.relative_to(ctx.repo).as_posix()
            for path in _unskipped_test_paths(ctx, PY_TEST_FILE_GLOBS, ())
        )
        return _canonical_pytest_command(relatives, collect_only=False)
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
    ctx.python_expected_count = None
    ctx.python_expected_digest = None
    ctx.python_test_relatives = ()
    messages = [
        *_pytest_configuration_failures(ctx),
        *_python_test_policy_failures(ctx, registry.allowed_skips),
    ]
    output_parts: list[str] = []
    if messages:
        return messages, output_parts
    test_paths = _unskipped_test_paths(ctx, PY_TEST_FILE_GLOBS, registry.allowed_skips)
    test_relatives = tuple(path.relative_to(ctx.repo).as_posix() for path in test_paths)
    inventory, inventory_failure = _load_python_test_inventory(ctx, test_relatives)
    if inventory_failure or inventory is None:
        messages.append(inventory_failure or "Python test inventory is unavailable")
        return messages, output_parts
    collection_argv = _canonical_pytest_command(test_relatives, collect_only=True)
    collection_code, collection_output = run_command(ctx, collection_argv)
    output_parts.append(collection_output)
    if collection_code != 0:
        messages.append(
            f"pytest exact-inventory collection failed (exit {collection_code})"
        )
        return messages, output_parts
    collected, collection_failure = _parse_pytest_collection_output(
        collection_output, test_relatives
    )
    if collection_failure or collected is None:
        messages.append(collection_failure or "pytest collection is unavailable")
        return messages, output_parts
    collected_digest = _python_inventory_digest(collected)
    if (
        len(collected) != inventory.count
        or collected_digest != inventory.sha256
        or collected != inventory.node_ids
    ):
        messages.append(
            "pytest collection differs from the committed exact platform "
            f"inventory (collected {len(collected)}/{collected_digest}; "
            f"expected {inventory.count}/{inventory.sha256})"
        )
        return messages, output_parts
    ctx.python_expected_count = inventory.count
    ctx.python_expected_digest = inventory.sha256
    ctx.python_test_relatives = test_relatives
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
_VITEST_CONFIG_NAMES = tuple(
    f"{stem}.config.{suffix}"
    for stem in ("vitest", "vite")
    for suffix in ("ts", "mts", "cts", "js", "mjs", "cjs")
)
_REPORTER_PREFLIGHT_MAX_TOKENS = 256
_PNPM_TURBO_TEST_PREFIX_LENGTH = 5
_VITEST_SCRIPT_MIN_TOKENS = 2


@dataclass(frozen=True)
class _JavaScriptToken:
    kind: str
    value: str


def _argv_element_basename(element: str) -> str:
    return element.replace("\\", "/").rsplit("/", 1)[-1]


def _argv_vitest_invocation_kind(argv: tuple[str, ...]) -> str | None:
    """Classify only the bounded direct/Turbo Vitest command grammars."""
    names = [_argv_element_basename(element) for element in argv]
    if any(name in {"vitest", "vitest.cmd"} for name in names):
        index = 1
        if names[:1] not in (["pnpm"], ["pnpm.cmd"]):
            return "invalid"
        if argv[index : index + 1] in (("--filter",), ("-F",)):
            index += 2
        if (
            index + 2 < len(argv)
            and argv[index] == "exec"
            and names[index + 1] in {"vitest", "vitest.cmd"}
            and argv[index + 2] == "run"
            and names.count("vitest") + names.count("vitest.cmd") == 1
        ):
            return "vitest"
        return "invalid"
    turbo_test_surface = "turbo" in names and any(
        argument == "test" or argument.endswith("#test") for argument in argv
    )
    if turbo_test_surface:
        if (
            len(argv) >= _PNPM_TURBO_TEST_PREFIX_LENGTH
            and names[:3] in (["pnpm", "exec", "turbo"], ["pnpm.cmd", "exec", "turbo"])
            and argv[3:5] == ("run", "test")
            and names.count("turbo") == 1
            and argv.count("--") <= 1
            and argv[5 : argv.index("--") if "--" in argv else len(argv)]
            in ((), ("--force",))
        ):
            return "turbo"
        return "invalid"
    return None


def _javascript_string_token(
    source: str, start: int
) -> tuple[_JavaScriptToken | None, int, str | None]:
    quote = source[start]
    index = start + 1
    value: list[str] = []
    dynamic = False
    while index < len(source):
        character = source[index]
        if character == quote:
            kind = "dynamic" if dynamic else "string"
            return _JavaScriptToken(kind, "".join(value)), index + 1, None
        if quote == "`" and source.startswith("${", index):
            dynamic = True
            value.append("${}")
            index += 2
            continue
        if character in "\r\n\u2028\u2029" and quote != "`":
            return None, index, "unterminated JavaScript string"
        if character != "\\":
            value.append(character)
            index += 1
            continue
        index += 1
        if index >= len(source):
            return None, index, "unterminated JavaScript escape"
        escaped = source[index]
        if escaped in "\r\n\u2028\u2029":
            return None, index, "JavaScript string line continuations are forbidden"
        escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}
        if escaped in escapes:
            value.append(escapes[escaped])
            index += 1
            continue
        if escaped == "x" and re.fullmatch(
            r"[0-9a-fA-F]{2}", source[index + 1 : index + 3]
        ):
            value.append(chr(int(source[index + 1 : index + 3], 16)))
            index += 3
            continue
        if escaped == "u":
            braced = re.match(r"\{([0-9a-fA-F]{1,6})\}", source[index + 1 :])
            if braced:
                value.append(chr(int(braced.group(1), 16)))
                index += len(braced.group(0)) + 1
                continue
            fixed = source[index + 1 : index + 5]
            if re.fullmatch(r"[0-9a-fA-F]{4}", fixed):
                value.append(chr(int(fixed, 16)))
                index += 5
                continue
        value.append(escaped)
        index += 1
    return None, index, "unterminated JavaScript string"


def _tokenize_vitest_config(
    source: str,
) -> tuple[tuple[_JavaScriptToken, ...] | None, str | None]:
    tokens: list[_JavaScriptToken] = []
    index = 0
    while index < len(source):
        character = source[index]
        if character.isspace():
            index += 1
            continue
        if source.startswith("//", index):
            terminators = [
                position
                for character in ("\r", "\n", "\u2028", "\u2029")
                if (position := source.find(character, index + 2)) >= 0
            ]
            newline = min(terminators, default=-1)
            index = len(source) if newline < 0 else newline + 1
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end < 0:
                return None, "unterminated JavaScript comment"
            index = end + 2
            continue
        if character in {'"', "'", "`"}:
            token, index, failure = _javascript_string_token(source, index)
            if failure or token is None:
                return None, failure or "invalid JavaScript string"
            tokens.append(token)
            continue
        identifier = re.match(r"[$A-Za-z_][$0-9A-Za-z_]*", source[index:])
        if identifier:
            value = identifier.group(0)
            tokens.append(_JavaScriptToken("identifier", value))
            index += len(value)
            continue
        number = re.match(r"[0-9][0-9A-Za-z_.]*", source[index:])
        if number:
            value = number.group(0)
            tokens.append(_JavaScriptToken("number", value))
            index += len(value)
            continue
        if source.startswith("...", index):
            tokens.append(_JavaScriptToken("punctuation", "..."))
            index += 3
            continue
        if source.startswith("=>", index):
            tokens.append(_JavaScriptToken("punctuation", "=>"))
            index += 2
            continue
        tokens.append(_JavaScriptToken("punctuation", character))
        index += 1
    return tuple(tokens), None


def _computed_config_key(
    tokens: tuple[_JavaScriptToken, ...], start: int
) -> tuple[str | None, int | None]:
    if (
        start + 2 < len(tokens)
        and tokens[start].value == "["
        and tokens[start + 1].kind == "string"
        and tokens[start + 2].value == "]"
    ):
        return tokens[start + 1].value, start + 3
    return None, None


def _parse_vitest_static_value(  # noqa: PLR0911
    tokens: tuple[_JavaScriptToken, ...], start: int, surface: str
) -> tuple[int | None, str | None]:
    if start >= len(tokens):
        return None, f"Vitest {surface} configuration is truncated"
    token = tokens[start]
    if token.value == "{":
        return _parse_vitest_config_object(tokens, start, surface)
    if token.value == "[":
        index = start + 1
        while index < len(tokens):
            if tokens[index].value == "]":
                return index + 1, None
            end, failure = _parse_vitest_static_value(tokens, index, "nested")
            if failure or end is None:
                return None, failure or "Vitest static array is malformed"
            index = end
            if index < len(tokens) and tokens[index].value == ",":
                index += 1
                continue
            if index < len(tokens) and tokens[index].value == "]":
                continue
            return None, "Vitest static array is malformed"
        return None, "Vitest static array is truncated"
    if token.kind in {"string", "number"} or (
        token.kind == "identifier" and token.value in {"false", "null", "true"}
    ):
        return start + 1, None
    return None, f"Vitest {surface} configuration contains a dynamic value"


def _parse_vitest_config_object(  # noqa: PLR0911, PLR0912
    tokens: tuple[_JavaScriptToken, ...], start: int, surface: str
) -> tuple[int | None, str | None]:
    if start >= len(tokens) or tokens[start].value != "{":
        return None, f"Vitest {surface} configuration is not a static object"
    index = start + 1
    while index < len(tokens):
        if tokens[index].value == "}":
            return index + 1, None
        if tokens[index].value == "...":
            return None, f"Vitest {surface} configuration contains a spread"
        key: str | None
        after_key: int | None
        if tokens[index].value == "[":
            key, after_key = _computed_config_key(tokens, index)
            if key is None or after_key is None:
                return None, f"Vitest {surface} configuration has a dynamic key"
        elif tokens[index].kind in {"identifier", "string", "number"}:
            key = tokens[index].value
            after_key = index + 1
        else:
            return None, f"Vitest {surface} configuration is malformed"
        if after_key >= len(tokens):
            return None, f"Vitest {surface} configuration is truncated"
        if tokens[after_key].value != ":":
            return None, (
                f"Vitest {surface} configuration requires colon data properties"
            )
        if surface == "root" and key != "test":
            return None, "Vitest root configuration contains an unmodeled field"
        if surface in {"test", "benchmark"} and key in {
            "reporter",
            "reporters",
        }:
            return None, "repository Vitest reporter configuration is forbidden"
        if surface == "root":
            end, failure = _parse_vitest_config_object(tokens, after_key + 1, "test")
        else:
            child_surface = (
                "benchmark" if surface == "test" and key == "benchmark" else "nested"
            )
            end, failure = _parse_vitest_static_value(
                tokens, after_key + 1, child_surface
            )
        if failure or end is None:
            return None, failure or f"Vitest {surface} configuration is malformed"
        index = end
        if index < len(tokens) and tokens[index].value == ",":
            index += 1
            continue
        if index < len(tokens) and tokens[index].value == "}":
            continue
        return None, f"Vitest {surface} configuration is malformed"
    return None, f"Vitest {surface} configuration is truncated"


def _vitest_config_failure(path: Path) -> str | None:  # noqa: PLR0911, PLR0912
    try:
        metadata = path.lstat()
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return "recognized Vitest configuration is unreadable"
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        return "recognized Vitest configuration must be a regular nonsymlink file"
    tokens, token_failure = _tokenize_vitest_config(source)
    if token_failure or tokens is None:
        return token_failure or "recognized Vitest configuration is malformed"
    defaults = [
        index
        for index in range(len(tokens) - 1)
        if tokens[index].value == "export" and tokens[index + 1].value == "default"
    ]
    if len(defaults) != 1:
        return "recognized Vitest configuration must have one static default export"
    default_index = defaults[0]
    index = default_index + 2
    wrapped = index < len(tokens) and tokens[index].value == "defineConfig"
    if wrapped:
        prefix = tuple((token.kind, token.value) for token in tokens[:default_index])
        required_prefix = (
            ("identifier", "import"),
            ("punctuation", "{"),
            ("identifier", "defineConfig"),
            ("punctuation", "}"),
            ("identifier", "from"),
            ("string", "vitest/config"),
            ("punctuation", ";"),
        )
        if prefix != required_prefix:
            return "Vitest defineConfig must be the exact import from vitest/config"
        if index + 1 >= len(tokens) or tokens[index + 1].value != "(":
            return "recognized Vitest defineConfig call is malformed"
        index += 2
    elif default_index != 0:
        return "recognized Vitest configuration has executable prefix code"
    end, parse_failure = _parse_vitest_config_object(tokens, index, "root")
    if parse_failure or end is None:
        return parse_failure or "recognized Vitest configuration is malformed"
    index = end
    if wrapped:
        if index >= len(tokens) or tokens[index].value != ")":
            return "recognized Vitest defineConfig call is malformed"
        index += 1
    if index < len(tokens) and tokens[index].value == ";":
        index += 1
    if index != len(tokens):
        return "recognized Vitest configuration has a dynamic default export"
    return None


def _manifest_name_and_scripts(
    path: Path,
) -> tuple[str | None, dict[str, str] | None, str | None]:
    try:
        raw: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None, None, "reached package manifest is unreadable or malformed"
    if not isinstance(raw, dict):
        return None, None, "reached package manifest is not an object"
    name = raw.get("name")
    scripts_raw = raw.get("scripts")
    scripts = (
        {
            key: value
            for key, value in scripts_raw.items()
            if isinstance(key, str) and isinstance(value, str)
        }
        if isinstance(scripts_raw, dict)
        else {}
    )
    return name if isinstance(name, str) else None, scripts, None


def _vitest_cli_surface_failure(  # noqa: PLR0911 - explicit forbidden channels
    tokens: tuple[str, ...],
) -> str | None:
    if tokens.count("--") > 1:
        return "Vitest command contains multiple forwarded delimiters"
    for index, token in enumerate(tokens):
        if token in {"--filter", "-F"} and index != 1:
            return "repository-selected pnpm filter is outside the bounded prefix"
        if token.startswith("--filter="):
            return "repository-selected pnpm filter is outside the bounded prefix"
        if token == "--reporter" or token.startswith("--reporter="):  # noqa: S105
            return "repository Vitest reporter arguments are forbidden"
        if (
            token in {"--config", "-c"}
            or token.startswith("--config=")
            or (token.startswith("-c") and token != "-c")  # noqa: S105
        ):
            return "repository-selected Vitest configuration is forbidden"
        if (
            token in {"--root", "-r", "--dir", "-C", "--cwd", "--root-turbo-json"}
            or token.startswith(("--root=", "--dir=", "--cwd=", "--root-turbo-json="))
            or (token.startswith("-r") and token != "-r")  # noqa: S105
            or (token.startswith("-C") and token != "-C")  # noqa: S105
        ):
            return "repository-selected Vitest execution root is forbidden"
        if index > _REPORTER_PREFLIGHT_MAX_TOKENS:
            return "Vitest argument surface exceeds the bounded preflight"
    return None


def _script_tokens(  # noqa: PLR0911 - bounded grammar failure reasons
    value: str,
) -> tuple[tuple[str, ...] | None, str | None]:
    if re.search(r"[$;&|<>`*?\[\]{}()~^%!\\\r\n]", value) or re.search(
        r"(?:^|\s)[A-Za-z_][A-Za-z0-9_]*=", value
    ):
        return None, "reached package test script contains shell indirection"
    try:
        tokens = tuple(shlex.split(value, posix=True))
    except ValueError:
        return None, "reached package test script is malformed"
    if len(tokens) > _REPORTER_PREFLIGHT_MAX_TOKENS:
        return None, "reached package test script exceeds the bounded preflight"
    if not tokens or _argv_element_basename(tokens[0]) not in {
        "vitest",
        "vitest.cmd",
    }:
        return None, "reached package test script is not a direct Vitest invocation"
    if len(tokens) < _VITEST_SCRIPT_MIN_TOKENS or tokens[1] != "run":
        return None, "reached package test script is not canonical vitest run"
    if "--" in tokens:
        return None, "reached package test script contains a forwarded delimiter"
    return tokens, None


def _tokens_invoke_vitest(tokens: tuple[str, ...]) -> bool:
    return bool(tokens) and _argv_element_basename(tokens[0]) in {
        "vitest",
        "vitest.cmd",
    }


def _argv_filter_name(argv: tuple[str, ...]) -> str | None:
    if argv[1:2] in (("--filter",), ("-F",)):
        return argv[2] if len(argv) > 2 else ""  # noqa: PLR2004
    return None


def _workspace_vitest_roots(
    ctx: Context, filter_name: str | None
) -> tuple[list[Path], list[str]]:
    roots: list[Path] = []
    failures: list[str] = []
    manifests, workspace_failure = _workspace_manifest_paths_checked(ctx)
    if workspace_failure:
        return [], [workspace_failure]
    for manifest in manifests:
        name, scripts, failure = _manifest_name_and_scripts(manifest)
        if failure or scripts is None:
            failures.append(failure or "workspace package manifest is unavailable")
            continue
        if filter_name is not None and name != filter_name:
            continue
        script = scripts.get("test")
        if script is None:
            continue
        if "pretest" in scripts or "posttest" in scripts:
            failures.append("reached workspace test lifecycle hooks are forbidden")
            continue
        tokens, token_failure = _script_tokens(script)
        if token_failure or tokens is None:
            failures.append(token_failure or "workspace test script is unavailable")
            continue
        cli_failure = _vitest_cli_surface_failure(tokens)
        if cli_failure:
            failures.append(cli_failure)
            continue
        if not _tokens_invoke_vitest(tokens):
            failures.append(
                "reached workspace test script is not a bounded Vitest invocation"
            )
            continue
        roots.append(manifest.parent)
    if filter_name is not None and not roots and not failures:
        failures.append("Vitest workspace filter does not resolve to a test package")
    return roots, failures


def _workspace_roots_for_filter(
    ctx: Context, filter_name: str
) -> tuple[list[Path], list[str]]:
    roots: list[Path] = []
    failures: list[str] = []
    manifests, workspace_failure = _workspace_manifest_paths_checked(ctx)
    if workspace_failure:
        return [], [workspace_failure]
    for manifest in manifests:
        name, _scripts, failure = _manifest_name_and_scripts(manifest)
        if failure:
            failures.append(failure)
        elif name == filter_name:
            roots.append(manifest.parent)
    if not roots and not failures:
        failures.append("Vitest workspace filter does not resolve to a package")
    return roots, failures


def _root_script_vitest_surface(  # noqa: PLR0911, PLR0912 - bounded forms
    ctx: Context, argv: tuple[str, ...]
) -> tuple[list[Path], bool, list[str]]:
    if not argv or _argv_element_basename(argv[0]) not in {"pnpm", "pnpm.cmd"}:
        return [], False, []
    index = 1
    filter_name: str | None = None
    if argv[index : index + 1] in (("--filter",), ("-F",)):
        if index + 1 >= len(argv):
            return [], True, ["pnpm test filter is missing its exact package name"]
        filter_name = argv[index + 1]
        index += 2
    if argv[index : index + 1] == ("run",):
        index += 1
    if index >= len(argv) or argv[index].startswith("-"):
        if any(
            argument == "test" or argument.startswith("test:")
            for argument in argv[index:]
        ):
            return (
                [],
                True,
                ["pnpm script command shape is outside the bounded grammar"],
            )
        return [], False, []
    script_name = argv[index]
    if filter_name is not None:
        roots, failures = _workspace_roots_for_filter(ctx, filter_name)
        if failures:
            return [], True, failures
        if len(roots) != 1:
            return [], True, ["pnpm script filter does not resolve uniquely"]
        manifest = roots[0] / "package.json"
    else:
        manifest = ctx.repo / "package.json"
    _name, scripts, failure = _manifest_name_and_scripts(manifest)
    if failure or scripts is None:
        return [], True, [failure or "root package manifest is unavailable"]
    script = scripts.get(script_name)
    if script is None:
        return [], False, []
    vitest_surface = re.search(
        r"(?:^|\s)(?:[^\s/\\]+[/\\])*vitest(?:\.cmd)?(?:\s|$)", script
    )
    if vitest_surface is None and not (
        script_name == "test" or script_name.startswith("test:")
    ):
        return [], False, []
    if f"pre{script_name}" in scripts or f"post{script_name}" in scripts:
        return [], True, ["reached package script lifecycle hooks are forbidden"]
    tokens, token_failure = _script_tokens(script)
    if token_failure or tokens is None:
        return [], True, [token_failure or "reached package script is unavailable"]
    cli_failure = _vitest_cli_surface_failure(tokens)
    if cli_failure:
        return [], True, [cli_failure]
    if not _tokens_invoke_vitest(tokens):
        return [], True, ["reached package script is not a bounded Vitest invocation"]
    return [manifest.parent], True, []


def _turbo_reporter_graph_failures(ctx: Context, roots: list[Path]) -> list[str]:
    path = ctx.repo / "turbo.json"
    try:
        metadata = path.lstat()
        raw: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return ["Turbo test graph is missing, unreadable, or malformed"]
    if path.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        return ["Turbo test graph must be a regular nonsymlink file"]
    if not isinstance(raw, dict) or not isinstance(raw.get("tasks"), dict):
        return ["Turbo test graph lacks a static tasks object"]
    tasks = raw["tasks"]
    if tasks.get("test") != {} or any(
        not isinstance(name, str) or "#" in name or name.startswith("//")
        for name in tasks
    ):
        return ["Turbo test graph is not the bounded dependency-free test task"]
    for root in roots:
        package_config = root / "turbo.json"
        if package_config.exists() or package_config.is_symlink():
            return ["package-local Turbo configuration is forbidden for test"]
    return []


def _recognized_vitest_config_failures(roots: list[Path]) -> list[str]:
    failures: list[str] = []
    for root in sorted(set(roots)):
        for name in _VITEST_CONFIG_NAMES:
            path = root / name
            if not path.exists() and not path.is_symlink():
                continue
            failure = _vitest_config_failure(path)
            if failure:
                failures.append(failure)
    return failures


def _prepared_reporter_commands(  # noqa: PLR0912 - explicit command channels
    ctx: Context,
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
        roots: list[Path] = []
        script_backed = False
        command_failures: list[str] = []
        if kind == "invalid":
            command_failures.append(
                "Vitest command shape is outside the bounded grammar"
            )
        elif kind == "turbo":
            roots, command_failures = _workspace_vitest_roots(ctx, None)
        elif kind == "vitest":
            filter_name = _argv_filter_name(argv)
            if filter_name is None:
                roots = [ctx.repo]
            else:
                roots, command_failures = _workspace_roots_for_filter(ctx, filter_name)
        else:
            roots, script_backed, command_failures = _root_script_vitest_surface(
                ctx, argv
            )
        cli_failure = (
            _vitest_cli_surface_failure(argv)
            if kind is not None or script_backed
            else None
        )
        if cli_failure:
            command_failures.append(cli_failure)
        if kind == "turbo" and not command_failures:
            command_failures.extend(_turbo_reporter_graph_failures(ctx, roots))
        failures.extend(command_failures)
        failures.extend(_recognized_vitest_config_failures(roots))
        if command_failures:
            prepared.append(argv)
            continue
        if kind == "turbo":
            if "--" in argv:
                separator = argv.index("--")
                prepared.append(
                    (
                        *argv[: separator + 1],
                        _VITEST_DEFAULT_REPORTER_ARG,
                        *argv[separator + 1 :],
                    )
                )
            else:
                prepared.append((*argv, "--", _VITEST_DEFAULT_REPORTER_ARG))
        elif kind == "vitest":
            if "--" in argv:
                separator = argv.index("--")
                prepared.append(
                    (*argv[:separator], _VITEST_DEFAULT_REPORTER_ARG, *argv[separator:])
                )
            else:
                prepared.append((*argv, _VITEST_DEFAULT_REPORTER_ARG))
        elif script_backed:
            if "--" in argv:
                separator = argv.index("--")
                prepared.append(
                    (
                        *argv[: separator + 1],
                        _VITEST_DEFAULT_REPORTER_ARG,
                        *argv[separator + 1 :],
                    )
                )
            else:
                prepared.append((*argv, "--", _VITEST_DEFAULT_REPORTER_ARG))
        else:
            prepared.append(argv)
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
            reporter_failures, commands = _prepared_reporter_commands(
                ctx, suite.commands
            )
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
