#!/usr/bin/env python3
"""Deterministic platform-portability policy validation (M00-W09).

Fail-closed static checks that keep the repository's CI and shared tooling
executable on all three certified CI platforms (macos-15, windows-2025,
ubuntu-24.04; spec §M00 W09 row, §5.14.4, REQ-PLAT-013, REQ-PLAT-016,
REQ-PLAT-025). Two rule families:

- ``PORT-CI-*``: the GitHub Actions workflow must require all three
  operating-system families, run the identical canonical commands on each,
  keep actions SHA-pinned/official/read-only, never mask child failures,
  never apply Bash-only steps to Windows, keep frozen/locked installs and
  exact toolchain probes, isolate (and never cache) RUSTUP_HOME, restrict
  caches to an allowlisted dependency set, and upload only failure-scoped
  Playwright artifacts.
- ``PORT-SRC-*``: shared runtime scripts and canonical commands must stay
  platform-neutral — no hard-coded /tmp, /bin/, /usr/ system paths, no
  ``shell=True``/``bash -c`` wrappers, no manual ``+ "/" +`` separator
  concatenation, no executable-permission-bit or chmod dependence outside
  the designated ``scripts/portability.py`` isolation module, no tracked
  paths differing only by case, an LF-enforcing ``.gitattributes``, and no
  Bash-only package.json scripts or registry commands.

Scope control (spec M00-W09 §H): only executable policy surfaces are
scanned — the workflow, runtime scripts (``scripts/*.py`` and
``services/*/src/**/*.py``), package manifests, and the verification-suite
registry. Documentation, prose, and ``scripts/tests`` fixtures are never
scanned, string constants are read from the AST (comments and docstrings
cannot false-positive), and this checker file itself is exempt from the
literal scan because the banned fragments are its rule vocabulary. Every
violation names the rule, the location, and the required fix.

Exit codes: 0 = compliant, 1 = at least one violation, 2 = usage/internal
error (including an unreadable workflow). Requires PyYAML — run through
``uv run`` or ``pnpm verify`` (the registry maps ``python3`` onto the
pinned interpreter).
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import yaml
except ModuleNotFoundError as exc:  # pragma: no cover - environment guard
    print(
        f"check_portability: PyYAML unavailable ({exc}); run through "
        "'uv run python scripts/check_portability.py' or 'pnpm verify'",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc

WORKFLOW_REL = ".github/workflows/ci.yml"
REGISTRY_REL = "scripts/verification-suites.json"
CHECKER_REL = "scripts/check_portability.py"
PORTABILITY_MODULE_REL = "scripts/portability.py"

REQUIRED_WINDOWS_RUNNER = "windows-2025"
MACOS_RUNNER_RE = re.compile(r"^macos-\d+$")
UBUNTU_RUNNER_RE = re.compile(r"^ubuntu-\d+\.\d+$")
SHA_PIN_RE = re.compile(r"^(?P<action>[\w.-]+/[\w.-]+)@(?P<sha>[0-9a-f]{40})$")

CANONICAL_RUN_BODIES = ("pnpm run doctor", "pnpm verify")

# Shells: multi-line steps must pick one of these explicitly. Windows
# PowerShell 5.1 ("powershell") and cmd are rejected; pwsh is the one
# supported Windows scripting shell and exists on every hosted runner.
POSIX_SHELLS = frozenset({"bash", "sh"})
PWSH_SHELL = "pwsh"
REJECTED_SHELLS = frozenset({"powershell", "cmd", "python"})

PWSH_STRICTNESS = (
    "$ErrorActionPreference = 'Stop'",
    "$PSNativeCommandUseErrorActionPreference = $true",
)

# Tokens that only a POSIX shell interprets (or that assume a POSIX
# filesystem layout); they must not appear in a step that can execute on
# Windows. pwsh legitimately uses "$(" subexpressions, so the shell-less
# list is stricter than the pwsh list.
POSIX_ONLY_TOKENS_ANY_WINDOWS_STEP = (
    "set -o pipefail",
    "set -e",
    "command -v",
    "mkdir -p",
    "export ",
    "chmod ",
    "[[",
    "/bin/",
    "/usr/",
    "/tmp",
)
SHELL_SYNTAX_TOKENS_FOR_SHELLLESS_STEPS = ("&&", "||", "|", ";", ">", "<", "$(", "`")

MASKING_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("set +e", re.compile(r"set \+e\b")),
    ("|| true / || :", re.compile(r"\|\|\s*(?:true|:)(?:\s|$)")),
    ("terminal 'exit 0'", re.compile(r"(?:^|[;&])\s*exit\s+0(?:\s|$)")),
    (
        "$ErrorActionPreference downgrade",
        re.compile(r"\$ErrorActionPreference\s*=\s*['\"]?(?:SilentlyContinue|Ignore)"),
    ),
    (
        "-ErrorAction downgrade",
        re.compile(r"-ErrorAction\s+(?:SilentlyContinue|Ignore)\b"),
    ),
    ("2>/dev/null", re.compile(r"2>\s*/dev/null")),
)

CACHE_PATH_ALLOWLIST = frozenset(
    {
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
)
FORBIDDEN_CACHE_FRAGMENTS = (
    "rustup",
    ".cargo/bin",
    "runner.temp",
    "target",
    "profile",
    "appdata/roaming",
    "application support",
    ".ssh",
    ".gnupg",
    "resume",
    "secret",
)

RUST_INSTALL_MARKER = "rustup toolchain install"
REQUIRED_RUST_PROBES = (
    "rustup show active-toolchain",
    "rustup which cargo",
    "rustup which rustc",
    "cargo --version",
    "rustc --version",
    "rustfmt --version",
    "cargo clippy --version",
)

BANNED_PATH_PREFIXES = ("/tmp", "/bin/", "/usr/", "/etc/", "/var/")
BANNED_PATH_EXACT = ("/bin", "/usr", "/etc", "/var")
BANNED_SHELL_WRAPPER_FRAGMENTS = ("bash -c", "bash -lc", "sh -c")
SEPARATOR_CONCAT_RE = re.compile(r"\+\s*(?:\"/\"|'/'|\"\\\\\"|'\\\\')\s*\+")

# package.json script bodies must stay executable under cmd.exe (pnpm's
# Windows script shell) as well as POSIX shells: no Bash/sh wrappers, no
# POSIX command substitution, no env-prefix assignments.
SCRIPT_BODY_BANNED_FRAGMENTS = ("bash ", "sh -c", "$(", "${", "/bin/", "/usr/")
SCRIPT_ENV_PREFIX_RE = re.compile(r"^[A-Z_][A-Z0-9_]*=\S+\s")

REGISTRY_ARGV0_ALLOWLIST = frozenset({"pnpm", "uv", "cargo", "python3", "git", "node"})

# (file, literal) pairs that are deliberately platform-specific and
# documented as such. Empty today: macOS-only remediation text lives under
# /opt (not a banned prefix) and all runtime paths go through pathlib.
AST_LITERAL_ALLOWLIST: frozenset[tuple[str, str]] = frozenset()


@dataclass(frozen=True)
class Violation:
    rule: str
    location: str
    message: str

    def render(self) -> str:
        return f"{self.rule} [{self.location}]: {self.message}"


class PolicyError(Exception):
    """The policy inputs are missing or unparseable (exit 2, fail closed)."""


class _UniqueKeyLoader(yaml.SafeLoader):
    """SafeLoader that rejects duplicate mapping keys instead of clobbering."""


def _construct_mapping(
    loader: _UniqueKeyLoader, node: yaml.MappingNode, deep: bool = False
) -> dict[object, object]:
    seen: set[object] = set()
    for key_node, _value in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in seen:
            raise yaml.YAMLError(f"duplicate mapping key: {key!r}")
        seen.add(key)
    return yaml.SafeLoader.construct_mapping(loader, node, deep)


_UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


def _load_workflow(repo: Path) -> tuple[dict[str, Any], str]:
    path = repo / WORKFLOW_REL
    if not path.is_file():
        raise PolicyError(f"required workflow missing: {WORKFLOW_REL}")
    raw = path.read_text(encoding="utf-8")
    try:
        # S506 false positive: _UniqueKeyLoader subclasses yaml.SafeLoader
        # and only adds duplicate-key rejection.
        data = yaml.load(raw, Loader=_UniqueKeyLoader)  # noqa: S506
    except yaml.YAMLError as exc:
        raise PolicyError(f"{WORKFLOW_REL} is not parseable YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise PolicyError(f"{WORKFLOW_REL} root must be a mapping")
    return data, raw


def _steps(workflow: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    located: list[tuple[str, dict[str, Any]]] = []
    jobs = workflow.get("jobs")
    if not isinstance(jobs, dict):
        raise PolicyError("workflow has no jobs mapping")
    for job_id, job in jobs.items():
        if not isinstance(job, dict):
            raise PolicyError(f"job {job_id!r} must be a mapping")
        for index, step in enumerate(job.get("steps", [])):
            if not isinstance(step, dict):
                raise PolicyError(f"job {job_id!r} step {index} must be a mapping")
            name = str(step.get("name", f"step[{index}]"))
            located.append((f"{job_id}:{name}", step))
    return located


def _step_can_run_on_windows(step: dict[str, Any]) -> bool:
    condition = str(step.get("if", "")).strip()
    if not condition:
        return True
    non_windows_guards = (
        "runner.os != 'Windows'",
        'runner.os != "Windows"',
        "runner.os == 'Linux'",
        "runner.os == 'macOS'",
    )
    return not any(guard in condition for guard in non_windows_guards)


def _strip_comment_lines(body: str) -> str:
    return "\n".join(
        line for line in body.splitlines() if not line.lstrip().startswith("#")
    )


def _check_matrix(workflow: dict[str, Any], violations: list[Violation]) -> None:
    jobs = workflow.get("jobs", {})
    matrix_lists: list[list[str]] = []
    for job in jobs.values():
        matrix = job.get("strategy", {}).get("matrix", {})
        os_list = matrix.get("os")
        if isinstance(os_list, list):
            matrix_lists.append([str(entry) for entry in os_list])
    if not matrix_lists:
        violations.append(
            Violation(
                "PORT-CI-002",
                WORKFLOW_REL,
                "no job declares a matrix.os list; required CI must run "
                "macos-15, windows-2025, and ubuntu-24.04",
            )
        )
        return
    for os_list in matrix_lists:
        if REQUIRED_WINDOWS_RUNNER not in os_list:
            violations.append(
                Violation(
                    "PORT-CI-002",
                    WORKFLOW_REL,
                    f"required CI is missing the Windows baseline runner "
                    f"'{REQUIRED_WINDOWS_RUNNER}' (found {os_list})",
                )
            )
        if not any(MACOS_RUNNER_RE.match(entry) for entry in os_list):
            violations.append(
                Violation(
                    "PORT-CI-002",
                    WORKFLOW_REL,
                    f"required CI is missing a pinned macOS runner (found {os_list})",
                )
            )
        if not any(UBUNTU_RUNNER_RE.match(entry) for entry in os_list):
            violations.append(
                Violation(
                    "PORT-CI-002",
                    WORKFLOW_REL,
                    f"required CI is missing a pinned Ubuntu runner (found {os_list})",
                )
            )
        for entry in os_list:
            if "latest" in entry:
                violations.append(
                    Violation(
                        "PORT-CI-002",
                        WORKFLOW_REL,
                        f"runner label '{entry}' is not an explicit version pin",
                    )
                )


def _check_canonical_commands(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for body in CANONICAL_RUN_BODIES:
        matches = [
            (where, step)
            for where, step in steps
            if str(step.get("run", "")).strip() == body
        ]
        if not matches:
            violations.append(
                Violation(
                    "PORT-CI-003",
                    WORKFLOW_REL,
                    f"canonical command step '{body}' is missing",
                )
            )
            continue
        for where, step in matches:
            if "if" in step:
                violations.append(
                    Violation(
                        "PORT-CI-003",
                        where,
                        f"canonical command '{body}' must run unconditionally "
                        "on every matrix platform (remove the 'if' guard; a "
                        "guarded or weaker Windows command set is prohibited)",
                    )
                )


def _check_shell_policy(
    workflow: dict[str, Any],
    steps: list[tuple[str, dict[str, Any]]],
    violations: list[Violation],
) -> None:
    global_shell = str(workflow.get("defaults", {}).get("run", {}).get("shell", ""))
    if global_shell in POSIX_SHELLS:
        violations.append(
            Violation(
                "PORT-CI-004",
                WORKFLOW_REL,
                "workflow-global bash/sh default shell would apply POSIX "
                "assumptions to Windows steps; declare shells per step",
            )
        )
    for job_id, job in workflow.get("jobs", {}).items():
        job_shell = str(job.get("defaults", {}).get("run", {}).get("shell", ""))
        if job_shell in POSIX_SHELLS:
            violations.append(
                Violation(
                    "PORT-CI-004",
                    f"jobs.{job_id}",
                    "job-level bash/sh default shell would apply POSIX "
                    "assumptions to Windows steps; declare shells per step",
                )
            )
    for where, step in steps:
        if "run" not in step:
            continue
        body = str(step["run"])
        shell = str(step.get("shell", ""))
        windows_reachable = _step_can_run_on_windows(step)
        if shell in REJECTED_SHELLS:
            violations.append(
                Violation(
                    "PORT-CI-005",
                    where,
                    f"shell '{shell}' is not permitted; use pwsh for Windows "
                    "scripting and bash only on non-Windows-guarded steps",
                )
            )
        if shell in POSIX_SHELLS and windows_reachable:
            violations.append(
                Violation(
                    "PORT-CI-005",
                    where,
                    "bash/sh step is reachable on Windows; guard it with "
                    "runner.os or rewrite it for pwsh",
                )
            )
        if not shell and "\n" in body.strip():
            violations.append(
                Violation(
                    "PORT-CI-005",
                    where,
                    "multi-line run step must declare its shell explicitly "
                    "(the per-OS default shells differ)",
                )
            )
        if shell == PWSH_SHELL and "\n" in body.strip():
            executable = _strip_comment_lines(body)
            for prelude in PWSH_STRICTNESS:
                if prelude not in executable:
                    violations.append(
                        Violation(
                            "PORT-CI-005",
                            where,
                            f"multi-line pwsh step must set {prelude!r} so "
                            "native-command failures stop the step",
                        )
                    )


def _check_windows_tokens(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for where, step in steps:
        if "run" not in step or not _step_can_run_on_windows(step):
            continue
        body = _strip_comment_lines(str(step["run"]))
        shell = str(step.get("shell", ""))
        for token in POSIX_ONLY_TOKENS_ANY_WINDOWS_STEP:
            if token in body:
                violations.append(
                    Violation(
                        "PORT-CI-006",
                        where,
                        f"POSIX-only token {token!r} appears in a step that "
                        "can execute on Windows; guard the step off Windows "
                        "or provide the pwsh equivalent",
                    )
                )
        if not shell:
            for token in SHELL_SYNTAX_TOKENS_FOR_SHELLLESS_STEPS:
                if token in body:
                    violations.append(
                        Violation(
                            "PORT-CI-006",
                            where,
                            f"shell syntax {token!r} in a shell-less step; "
                            "single-command steps only, or declare pwsh/bash "
                            "explicitly with a platform guard",
                        )
                    )


def _check_masking(
    raw: str, steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    if "continue-on-error" in raw:
        violations.append(
            Violation(
                "PORT-CI-007",
                WORKFLOW_REL,
                "continue-on-error is prohibited on mandatory checks",
            )
        )
    for where, step in steps:
        if "run" not in step:
            continue
        executable = _strip_comment_lines(str(step["run"]))
        for label, pattern in MASKING_PATTERNS:
            if pattern.search(executable):
                violations.append(
                    Violation(
                        "PORT-CI-008",
                        where,
                        f"child-process failure masking ({label}) is prohibited",
                    )
                )


def _check_actions(
    raw: str, steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    raw_lines = raw.splitlines()
    for where, step in steps:
        uses = step.get("uses")
        if uses is None:
            continue
        ref = str(uses)
        match = SHA_PIN_RE.match(ref)
        if not match:
            violations.append(
                Violation(
                    "PORT-CI-009",
                    where,
                    f"action '{ref}' is not pinned to a 40-hex commit SHA",
                )
            )
            continue
        if not match.group("action").startswith("actions/"):
            violations.append(
                Violation(
                    "PORT-CI-009",
                    where,
                    f"third-party action '{ref}' is not permitted; use "
                    "official actions or repository commands",
                )
            )
        if not any(ref in line and re.search(r"#\s*v\d", line) for line in raw_lines):
            violations.append(
                Violation(
                    "PORT-CI-009",
                    where,
                    f"SHA pin '{ref}' is missing its human-readable version comment",
                )
            )


def _check_permissions(workflow: dict[str, Any], violations: list[Violation]) -> None:
    if workflow.get("permissions") != {"contents": "read"}:
        violations.append(
            Violation(
                "PORT-CI-010",
                WORKFLOW_REL,
                "workflow permissions must be exactly {contents: read}",
            )
        )
    for job_id, job in workflow.get("jobs", {}).items():
        if "permissions" in job:
            violations.append(
                Violation(
                    "PORT-CI-010",
                    f"jobs.{job_id}",
                    "jobs must not widen the read-only workflow permissions",
                )
            )


def _check_checkout(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for where, step in steps:
        if str(step.get("uses", "")).startswith("actions/checkout@") and (
            step.get("with", {}).get("persist-credentials") is not False
        ):
            violations.append(
                Violation(
                    "PORT-CI-011",
                    where,
                    "checkout must set persist-credentials: false",
                )
            )


def _check_installs(raw_bodies: str, violations: list[Violation]) -> None:
    required = (
        "pnpm install --frozen-lockfile",
        "uv sync --locked",
        "cargo fetch --locked",
    )
    for command in required:
        if command not in raw_bodies:
            violations.append(
                Violation(
                    "PORT-CI-012",
                    WORKFLOW_REL,
                    f"required frozen/locked install '{command}' is missing",
                )
            )
    if "pipx install" in raw_bodies and 'pipx install "uv==' not in raw_bodies:
        violations.append(
            Violation(
                "PORT-CI-012",
                WORKFLOW_REL,
                "pipx installs must pin the exact repository uv version "
                '(pipx install "uv==<pin>")',
            )
        )


def _check_rust_steps(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    rust_steps = [
        (where, step)
        for where, step in steps
        if RUST_INSTALL_MARKER in str(step.get("run", ""))
    ]
    if not rust_steps:
        violations.append(
            Violation(
                "PORT-CI-013",
                WORKFLOW_REL,
                "no step installs the pinned Rust toolchain",
            )
        )
        return
    windows_variants = [
        where for where, step in rust_steps if _step_can_run_on_windows(step)
    ]
    if not windows_variants:
        violations.append(
            Violation(
                "PORT-CI-013",
                WORKFLOW_REL,
                "no Rust toolchain install step is reachable on Windows",
            )
        )
    for where, step in rust_steps:
        body = str(step["run"])
        for probe in REQUIRED_RUST_PROBES:
            if probe not in body:
                violations.append(
                    Violation(
                        "PORT-CI-013",
                        where,
                        f"Rust install step is missing the exact toolchain "
                        f"probe '{probe}'",
                    )
                )
        if "--profile minimal" not in body:
            violations.append(
                Violation(
                    "PORT-CI-013",
                    where,
                    "Rust install must use the minimal profile with explicit "
                    "rustfmt/clippy components",
                )
            )
        rustup_home = str(step.get("env", {}).get("RUSTUP_HOME", ""))
        if not rustup_home.startswith("${{ runner.temp }}"):
            violations.append(
                Violation(
                    "PORT-CI-014",
                    where,
                    "RUSTUP_HOME must be isolated beneath runner.temp for "
                    "every platform's Rust install step",
                )
            )
        if "GITHUB_ENV" not in body:
            violations.append(
                Violation(
                    "PORT-CI-014",
                    where,
                    "the isolated RUSTUP_HOME must be persisted through "
                    "GITHUB_ENV for later probes",
                )
            )


def _check_caches(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for where, step in steps:
        if not str(step.get("uses", "")).startswith("actions/cache@"):
            continue
        with_block = step.get("with", {})
        if "restore-keys" in with_block:
            violations.append(
                Violation(
                    "PORT-CI-015",
                    where,
                    "restore-keys would silently reuse incompatible platform "
                    "state; exact keys only",
                )
            )
        key = str(with_block.get("key", ""))
        for required in ("${{ runner.os }}", "${{ runner.arch }}", "hashFiles("):
            if required not in key:
                violations.append(
                    Violation(
                        "PORT-CI-015",
                        where,
                        f"cache key must include {required} (found '{key}')",
                    )
                )
        for line in str(with_block.get("path", "")).splitlines():
            entry = line.strip()
            if not entry:
                continue
            lowered = entry.lower()
            for fragment in FORBIDDEN_CACHE_FRAGMENTS:
                if fragment in lowered:
                    violations.append(
                        Violation(
                            "PORT-CI-015",
                            where,
                            f"cache path '{entry}' contains forbidden "
                            f"fragment '{fragment}' (toolchain state, build "
                            "output, profiles, or private data must not be "
                            "cached)",
                        )
                    )
            if entry not in CACHE_PATH_ALLOWLIST:
                violations.append(
                    Violation(
                        "PORT-CI-015",
                        where,
                        f"cache path '{entry}' is outside the reproducible "
                        "dependency-cache allowlist",
                    )
                )


def _check_chromium(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    installs = [
        (where, step)
        for where, step in steps
        if "playwright install" in str(step.get("run", ""))
    ]
    if not installs:
        violations.append(
            Violation(
                "PORT-CI-016",
                WORKFLOW_REL,
                "no step installs the pinned Playwright Chromium",
            )
        )
        return
    linux = [
        s for where, s in installs if "runner.os == 'Linux'" in str(s.get("if", ""))
    ]
    macos = [
        s for where, s in installs if "runner.os == 'macOS'" in str(s.get("if", ""))
    ]
    windows = [
        s for where, s in installs if "runner.os == 'Windows'" in str(s.get("if", ""))
    ]
    if not (linux and macos and windows):
        violations.append(
            Violation(
                "PORT-CI-016",
                WORKFLOW_REL,
                "Chromium must be installed on all three platforms "
                "(Linux, macOS, and Windows steps)",
            )
        )
    for where, step in installs:
        body = str(step.get("run", ""))
        guarded_linux = "runner.os == 'Linux'" in str(step.get("if", ""))
        if "--with-deps" in body and not guarded_linux:
            violations.append(
                Violation(
                    "PORT-CI-016",
                    where,
                    "--with-deps is supported only on the Linux install path",
                )
            )
        if guarded_linux and "--with-deps" not in body:
            violations.append(
                Violation(
                    "PORT-CI-016",
                    where,
                    "the Linux Chromium install must include --with-deps for "
                    "the pinned browser's system dependencies",
                )
            )


def _check_artifacts(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for where, step in steps:
        if not str(step.get("uses", "")).startswith("actions/upload-artifact@"):
            continue
        if str(step.get("if", "")).strip() != "failure()":
            violations.append(
                Violation(
                    "PORT-CI-017",
                    where,
                    "artifact upload must be failure-scoped (if: failure())",
                )
            )
        path = str(step.get("with", {}).get("path", "")).strip().rstrip("/")
        if path != "test-results":
            violations.append(
                Violation(
                    "PORT-CI-017",
                    where,
                    f"artifact path '{path}' is not the approved Playwright "
                    "failure-artifact directory test-results/",
                )
            )


def _check_no_live_sites(
    steps: list[tuple[str, dict[str, Any]]], violations: list[Violation]
) -> None:
    for where, step in steps:
        body = str(step.get("run", ""))
        if "http://" in body or "https://" in body:
            violations.append(
                Violation(
                    "PORT-CI-018",
                    where,
                    "run steps must not reference live sites or remote download URLs",
                )
            )


def _runtime_scripts(repo: Path) -> list[Path]:
    scripts = sorted(
        path
        for path in (repo / "scripts").glob("*.py")
        if path.name != Path(CHECKER_REL).name
    )
    services = sorted((repo / "services").glob("*/src/**/*.py"))
    return [*scripts, *services]


def _iter_string_constants(tree: ast.AST) -> list[str]:
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]


def _check_runtime_script(repo: Path, path: Path, violations: list[Violation]) -> None:
    rel = path.relative_to(repo).as_posix()
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise PolicyError(f"{rel} is not parseable Python: {exc}") from exc
    for literal in _iter_string_constants(tree):
        if (rel, literal) in AST_LITERAL_ALLOWLIST:
            continue
        if literal in BANNED_PATH_EXACT or any(
            literal.startswith(prefix) for prefix in BANNED_PATH_PREFIXES
        ):
            violations.append(
                Violation(
                    "PORT-SRC-001",
                    rel,
                    f"hard-coded POSIX system path {literal!r}; use "
                    "tempfile/pathlib or isolate it in a platform-specific "
                    "module with a tested per-platform equivalent",
                )
            )
        if any(fragment in literal for fragment in BANNED_SHELL_WRAPPER_FRAGMENTS):
            violations.append(
                Violation(
                    "PORT-SRC-002",
                    rel,
                    f"Bash-only wrapper literal {literal!r} in shared runtime logic",
                )
            )
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.keyword)
            and node.arg == "shell"
            and isinstance(node.value, ast.Constant)
            and node.value.value is True
        ):
            violations.append(
                Violation(
                    "PORT-SRC-002",
                    f"{rel}:{node.value.lineno}",
                    "subprocess shell=True masks failures and assumes a "
                    "POSIX shell; use argv arrays",
                )
            )
        if (
            isinstance(node, ast.Attribute)
            and node.attr == "X_OK"
            and rel != PORTABILITY_MODULE_REL
        ):
            violations.append(
                Violation(
                    "PORT-SRC-004",
                    f"{rel}:{node.lineno}",
                    "executable-permission-bit checks are Windows-hostile; "
                    "only scripts/portability.py may apply them (POSIX "
                    "branch only)",
                )
            )
        if (
            isinstance(node, ast.Attribute)
            and node.attr == "chmod"
            and rel != PORTABILITY_MODULE_REL
        ):
            violations.append(
                Violation(
                    "PORT-SRC-004",
                    f"{rel}:{node.lineno}",
                    "chmod calls assume POSIX permission bits; only "
                    "scripts/portability.py may isolate them",
                )
            )
    if SEPARATOR_CONCAT_RE.search(source):
        violations.append(
            Violation(
                "PORT-SRC-003",
                rel,
                "manual path-separator string concatenation; use pathlib joins",
            )
        )


def _check_case_collisions(repo: Path, violations: list[Violation]) -> None:
    proc = subprocess.run(
        ("git", "ls-files"),
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if proc.returncode != 0:
        raise PolicyError("git ls-files failed; cannot verify case safety")
    seen: dict[str, str] = {}
    for tracked in proc.stdout.splitlines():
        if not tracked.strip():
            continue
        folded = tracked.casefold()
        if folded in seen and seen[folded] != tracked:
            violations.append(
                Violation(
                    "PORT-SRC-005",
                    tracked,
                    f"tracked paths '{seen[folded]}' and '{tracked}' differ "
                    "only by case and cannot coexist on case-insensitive "
                    "filesystems",
                )
            )
        else:
            seen[folded] = tracked


def _check_gitattributes(repo: Path, violations: list[Violation]) -> None:
    path = repo / ".gitattributes"
    if not path.is_file():
        violations.append(
            Violation(
                "PORT-SRC-006",
                ".gitattributes",
                "missing; text files must be forced to LF (`* text=auto "
                "eol=lf`) so checkouts are byte-identical on Windows",
            )
        )
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        tokens = line.split()
        if tokens and "text=auto" in tokens and "eol=lf" in tokens:
            return
    violations.append(
        Violation(
            "PORT-SRC-006",
            ".gitattributes",
            "must contain a `* text=auto eol=lf` rule so text checkouts are "
            "LF on every platform",
        )
    )


def _package_manifests(repo: Path) -> list[Path]:
    manifests = [repo / "package.json"]
    workspace = repo / "pnpm-workspace.yaml"
    if workspace.is_file():
        in_packages = False
        for raw_line in workspace.read_text(encoding="utf-8").splitlines():
            if re.match(r"^packages:\s*$", raw_line):
                in_packages = True
                continue
            if in_packages:
                item = re.match(r'^\s+-\s+"?([^"#\s]+)"?\s*$', raw_line)
                if item:
                    manifests.extend(sorted(repo.glob(f"{item.group(1)}/package.json")))
                elif raw_line.strip() and not raw_line.startswith((" ", "\t", "#")):
                    in_packages = False
    return [manifest for manifest in manifests if manifest.is_file()]


def _check_package_scripts(repo: Path, violations: list[Violation]) -> None:
    for manifest in _package_manifests(repo):
        rel = manifest.relative_to(repo).as_posix()
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise PolicyError(f"{rel} is not parseable JSON: {exc}") from exc
        scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
        if not isinstance(scripts, dict):
            continue
        for name, value in scripts.items():
            if not isinstance(value, str):
                continue
            for fragment in SCRIPT_BODY_BANNED_FRAGMENTS:
                if fragment in value:
                    violations.append(
                        Violation(
                            "PORT-SRC-007",
                            f"{rel}#scripts.{name}",
                            f"script body uses POSIX-only construct "
                            f"{fragment!r}; canonical commands must run from "
                            "PowerShell and cmd.exe as well",
                        )
                    )
            if SCRIPT_ENV_PREFIX_RE.match(value):
                violations.append(
                    Violation(
                        "PORT-SRC-007",
                        f"{rel}#scripts.{name}",
                        "VAR=value command prefixes are POSIX-only; use "
                        "cross-platform tooling flags instead",
                    )
                )


def _check_registry_commands(repo: Path, violations: list[Violation]) -> None:
    path = repo / REGISTRY_REL
    if not path.is_file():
        raise PolicyError(f"required registry missing: {REGISTRY_REL}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise PolicyError(f"{REGISTRY_REL} is not parseable JSON: {exc}") from exc
    for suite in data.get("suites", []):
        if not isinstance(suite, dict):
            continue
        suite_id = str(suite.get("id", "?"))
        for command in suite.get("commands", []):
            if not isinstance(command, list) or not command:
                continue
            head = str(command[0])
            if head not in REGISTRY_ARGV0_ALLOWLIST:
                violations.append(
                    Violation(
                        "PORT-SRC-008",
                        f"{REGISTRY_REL}#suites.{suite_id}",
                        f"canonical command head '{head}' is not a "
                        "cross-platform tool; Bash-only wrappers are "
                        "prohibited in registry commands",
                    )
                )


def run_checks(repo: Path) -> list[Violation]:
    violations: list[Violation] = []
    workflow, raw = _load_workflow(repo)
    steps = _steps(workflow)
    raw_bodies = "\n".join(str(step.get("run", "")) for _, step in steps)

    workflows_dir = repo / ".github" / "workflows"
    extra = sorted(
        p.name
        for p in [*workflows_dir.glob("*.yml"), *workflows_dir.glob("*.yaml")]
        if p.name != "ci.yml"
    )
    if extra:
        violations.append(
            Violation(
                "PORT-CI-001",
                ".github/workflows",
                f"unexpected workflow files {extra}; ci.yml is the only "
                "approved workflow (no deployment/release workflows in M00)",
            )
        )

    _check_matrix(workflow, violations)
    _check_canonical_commands(steps, violations)
    _check_shell_policy(workflow, steps, violations)
    _check_windows_tokens(steps, violations)
    _check_masking(raw, steps, violations)
    _check_actions(raw, steps, violations)
    _check_permissions(workflow, violations)
    _check_checkout(steps, violations)
    _check_installs(raw_bodies, violations)
    _check_rust_steps(steps, violations)
    _check_caches(steps, violations)
    _check_chromium(steps, violations)
    _check_artifacts(steps, violations)
    _check_no_live_sites(steps, violations)

    for script in _runtime_scripts(repo):
        _check_runtime_script(repo, script, violations)
    _check_case_collisions(repo, violations)
    _check_gitattributes(repo, violations)
    _check_package_scripts(repo, violations)
    _check_registry_commands(repo, violations)
    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--repo", default=None, help="repository root override")
    parser.add_argument(
        "--quiet", action="store_true", help="print only failures and the verdict"
    )
    args = parser.parse_args(argv)
    repo = (
        Path(args.repo).resolve()
        if args.repo
        else Path(__file__).resolve().parent.parent
    )
    try:
        violations = run_checks(repo)
    except PolicyError as exc:
        print(f"check_portability: {exc}", file=sys.stderr)
        return 2
    if violations:
        for violation in sorted(violations, key=lambda v: (v.rule, v.location)):
            print(f"FAIL: {violation.render()}")
        print(f"FAIL: portability policy found {len(violations)} violation(s)")
        return 1
    if not args.quiet:
        print(
            "PASS: portability policy validated (three-OS CI, shell and "
            "masking rules, pinned actions, cache allowlist, and "
            "platform-neutral shared scripts)"
        )
    else:
        print("PASS: portability policy validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
