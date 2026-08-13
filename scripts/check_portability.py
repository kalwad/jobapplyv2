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
  paths differing only by case, an LF-enforcing ``.gitattributes``, no
  Bash-only package.json scripts or registry commands, and (PORT-SRC-008,
  since the first real TypeScript runtime surface landed in M02-W07;
  KI-0006) no hard-coded POSIX system paths, Bash wrappers, or
  ``shell: true`` spawns in TypeScript runtime sources.

Scope control (spec M00-W09 §H): only executable policy surfaces are
scanned — the workflow, runtime scripts (``scripts/*.py`` and
``services/*/src/**/*.py``), TypeScript runtime sources (extension
entrypoints, package ``src``/``scripts``/``generator`` trees, per-app
``scripts``, and root ``scripts/*.ts`` Node tools), package manifests, and
the verification-suite registry. Documentation, prose, and
``scripts/tests`` fixtures are never scanned; Python string constants are
read from the AST (comments and docstrings cannot false-positive) while
the TypeScript scan is
deliberately text-level (stricter: comments cannot smuggle guidance toward
banned constructs); this checker file itself is exempt from the literal
scan because the banned fragments are its rule vocabulary. Every violation
names the rule, the location, and the required fix.

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

REQUIRED_RUNNERS = ("macos-15", "windows-2025", "ubuntu-24.04")
MATRIX_RUNS_ON = "${{ matrix.os }}"
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

# Only these complete expressions prove that a step cannot execute on
# Windows. Any composite, malformed, or unfamiliar expression is treated as
# Windows-reachable so a substring such as ``runner.os == 'Linux'`` cannot
# hide an ``or runner.os == 'Windows'`` branch.
NON_WINDOWS_GUARD_RES = (
    re.compile(r"runner\.os\s*!=\s*(?P<quote>['\"])Windows(?P=quote)"),
    re.compile(r"runner\.os\s*==\s*(?P<quote>['\"])(?:Linux|macOS)(?P=quote)"),
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
    ("'||' fallback", re.compile(r"\|\|")),
    ("exit 0", re.compile(r"\bexit\s+0\b", flags=re.IGNORECASE)),
    (
        "trailing unconditional success",
        re.compile(
            r"(?:^|\n)\s*(?:true|:|\$true)\s*;?\s*$",
            flags=re.IGNORECASE,
        ),
    ),
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

BANNED_POSIX_PATH_RE = re.compile(r"(?<![\w:/#.-])/(?:tmp|bin|usr|etc|var)(?![\w.-])")
BANNED_SHELL_WRAPPER_FRAGMENTS = ("bash -c", "bash -lc", "sh -c")

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

# TypeScript runtime sources (PORT-SRC-008, added with M02-W07 per KI-0006:
# the first real TS runtime surface must carry an ecosystem source rule).
# Extension entrypoints/runtime modules, workspace-package runtime sources,
# and Node-executed TypeScript tool scripts (root scripts/*.ts, per-package
# scripts/, and generator sources) are scanned; test suites, fixture site
# pages, and generated output (dist/, .wxt/) live outside these globs by
# construction.
TS_RUNTIME_SOURCE_GLOBS = (
    "apps/*/entrypoints/**/*.ts",
    "apps/*/scripts/**/*.ts",
    "apps/*/src/**/*.ts",
    "packages/*/generator/**/*.ts",
    "packages/*/scripts/**/*.ts",
    "packages/*/src/**/*.ts",
    "scripts/*.ts",
)
TS_SHELL_TRUE_FRAGMENTS = ("shell: true", "shell:true")


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


def _condition_expression(step: dict[str, Any]) -> str | None:
    condition = str(step.get("if", "")).strip()
    if not condition:
        return None
    has_open_wrapper = condition.startswith("${{")
    has_close_wrapper = condition.endswith("}}")
    if has_open_wrapper != has_close_wrapper:
        return None
    if has_open_wrapper:
        condition = condition[3:-2].strip()
    return condition


def _step_has_exact_os_guard(step: dict[str, Any], operating_system: str) -> bool:
    condition = _condition_expression(step)
    if condition is None:
        return False
    pattern = re.compile(
        rf"runner\.os\s*==\s*(?P<quote>['\"]){re.escape(operating_system)}"
        r"(?P=quote)"
    )
    return pattern.fullmatch(condition) is not None


def _step_can_run_on_windows(step: dict[str, Any]) -> bool:
    condition = _condition_expression(step)
    if condition is None:
        return True
    return not any(pattern.fullmatch(condition) for pattern in NON_WINDOWS_GUARD_RES)


def _strip_pwsh_block_comments(body: str) -> str:
    """Remove PowerShell ``<# ... #>`` comments while preserving line shape."""

    stripped: list[str] = []
    quote = ""
    escaped = False
    block_depth = 0
    index = 0
    while index < len(body):
        if block_depth:
            if body.startswith("<#", index):
                block_depth += 1
                stripped.extend((" ", " "))
                index += 2
                continue
            if body.startswith("#>", index):
                block_depth -= 1
                stripped.extend((" ", " "))
                index += 2
                continue
            character = body[index]
            stripped.append("\n" if character == "\n" else " ")
            index += 1
            continue

        character = body[index]
        if escaped:
            stripped.append(character)
            escaped = False
            index += 1
            continue
        if character == "`" and quote != "'":
            stripped.append(character)
            escaped = True
            index += 1
            continue
        if quote:
            stripped.append(character)
            if character == quote:
                quote = ""
            index += 1
            continue
        if character in {"'", '"'}:
            quote = character
            stripped.append(character)
            index += 1
            continue
        if body.startswith("<#", index):
            block_depth = 1
            stripped.extend((" ", " "))
            index += 2
            continue
        stripped.append(character)
        index += 1
    return "".join(stripped)


def _strip_shell_comments(body: str, shell: str = "") -> str:
    """Remove Bash/pwsh ``#`` comments without altering quoted values.

    Workflow run blocks are executable shell values, so comments inside them
    are not removed by the YAML parser. A ``#`` starts a comment here only
    outside quotes and at a shell token boundary (start of line or following
    whitespace). That keeps quoted URL fragments and literal ``#`` arguments
    visible to the policy while harmless full-line and trailing comments
    cannot trigger banned-token, masking, or live-site findings.
    """

    if shell == PWSH_SHELL:
        body = _strip_pwsh_block_comments(body)

    stripped: list[str] = []
    for line in body.splitlines():
        quote = ""
        escaped = False
        comment_at: int | None = None
        for index, character in enumerate(line):
            if escaped:
                escaped = False
                continue
            if character in {"\\", "`"} and quote != "'":
                escaped = True
                continue
            if quote:
                if character == quote:
                    quote = ""
                continue
            if character in {"'", '"'}:
                quote = character
                continue
            if character == "#" and (index == 0 or line[index - 1].isspace()):
                comment_at = index
                break
        executable = line if comment_at is None else line[:comment_at]
        stripped.append(executable.rstrip())
    return "\n".join(stripped)


def _check_matrix(
    workflow: dict[str, Any], violations: list[Violation]
) -> tuple[str, dict[str, Any]] | None:
    jobs = workflow.get("jobs", {})
    matrix_jobs: list[tuple[str, dict[str, Any]]] = []
    for job_id, job in jobs.items():
        if not isinstance(job, dict):
            continue
        strategy = job.get("strategy", {})
        if isinstance(strategy, dict) and "matrix" in strategy:
            matrix_jobs.append((str(job_id), job))
    if len(matrix_jobs) != 1:
        violations.append(
            Violation(
                "PORT-CI-002",
                WORKFLOW_REL,
                "exactly one required matrix job must own the three-OS "
                f"baseline (found {len(matrix_jobs)})",
            )
        )
        return None

    job_id, job = matrix_jobs[0]
    strategy = job.get("strategy", {})
    matrix = strategy.get("matrix", {}) if isinstance(strategy, dict) else {}
    matrix_keys = set(matrix) if isinstance(matrix, dict) else set()
    if matrix_keys != {"os"}:
        violations.append(
            Violation(
                "PORT-CI-002",
                f"jobs.{job_id}.strategy.matrix",
                "required matrix must contain only the exact 'os' baseline "
                f"axis (found keys {sorted(str(key) for key in matrix_keys)})",
            )
        )
    os_list = matrix.get("os") if isinstance(matrix, dict) else None
    actual_runners = (
        tuple(str(entry) for entry in os_list) if isinstance(os_list, list) else ()
    )
    if actual_runners != REQUIRED_RUNNERS:
        violations.append(
            Violation(
                "PORT-CI-002",
                f"jobs.{job_id}.strategy.matrix.os",
                "required matrix must contain exactly "
                f"{list(REQUIRED_RUNNERS)} (found {list(actual_runners)})",
            )
        )
    if str(job.get("runs-on", "")).strip() != MATRIX_RUNS_ON:
        violations.append(
            Violation(
                "PORT-CI-002",
                f"jobs.{job_id}.runs-on",
                f"required matrix job must derive runs-on from {MATRIX_RUNS_ON!r}",
            )
        )
    if "if" in job:
        violations.append(
            Violation(
                "PORT-CI-002",
                f"jobs.{job_id}.if",
                "required matrix job must run unconditionally; job-level "
                "guards can silently skip the three-OS baseline",
            )
        )
    return job_id, job


def _check_canonical_commands(
    required_job: tuple[str, dict[str, Any]] | None,
    violations: list[Violation],
) -> None:
    if required_job is None:
        return
    job_id, job = required_job
    steps = [
        (f"{job_id}:{step.get('name', f'step[{index}]')}", step)
        for index, step in enumerate(job.get("steps", []))
        if isinstance(step, dict)
    ]
    for body in CANONICAL_RUN_BODIES:
        matches = [
            (where, step)
            for where, step in steps
            if _strip_shell_comments(
                str(step.get("run", "")), str(step.get("shell", ""))
            ).strip()
            == body
        ]
        if len(matches) != 1:
            violations.append(
                Violation(
                    "PORT-CI-003",
                    f"jobs.{job_id}",
                    f"required matrix job must contain exactly one canonical "
                    f"command step '{body}' (found {len(matches)})",
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
            executable = _strip_shell_comments(body, shell)
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
        shell = str(step.get("shell", ""))
        body = _strip_shell_comments(str(step["run"]), shell)
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


PWSH_CATCH_BLOCK_RE = re.compile(
    r"\bcatch(?:\s*\[[^\]\r\n]+\])?\s*\{(?P<body>[^{}]*)\}",
    flags=re.IGNORECASE | re.DOTALL,
)
PWSH_CATCH_TOKEN_RE = re.compile(r"\bcatch\b", flags=re.IGNORECASE)
PWSH_TERMINAL_FAILURE_RE = re.compile(
    r"(?:^|[;\n])\s*(?:throw(?:\s+[^;\n]+)?|exit\s+[1-9]\d*)\s*;?\s*$",
    flags=re.IGNORECASE,
)


def _pwsh_has_swallowed_catch(executable: str) -> bool:
    """Return true unless every simple catch block terminates with failure.

    Nested or otherwise unrecognizable catch blocks fail closed. This static
    policy intentionally accepts only a catch whose final statement is
    ``throw``/``throw <value>`` or an explicit non-zero ``exit``.
    """

    catch_tokens = list(PWSH_CATCH_TOKEN_RE.finditer(executable))
    if not catch_tokens:
        return False
    catch_blocks = list(PWSH_CATCH_BLOCK_RE.finditer(executable))
    if len(catch_blocks) != len(catch_tokens):
        return True
    return any(
        PWSH_TERMINAL_FAILURE_RE.search(match.group("body")) is None
        for match in catch_blocks
    )


def _check_masking(
    workflow: dict[str, Any],
    steps: list[tuple[str, dict[str, Any]]],
    violations: list[Violation],
) -> None:
    for job_id, job in workflow.get("jobs", {}).items():
        if isinstance(job, dict) and "continue-on-error" in job:
            violations.append(
                Violation(
                    "PORT-CI-007",
                    f"jobs.{job_id}",
                    "continue-on-error is prohibited on mandatory checks",
                )
            )
    for where, step in steps:
        if "continue-on-error" in step:
            violations.append(
                Violation(
                    "PORT-CI-007",
                    where,
                    "continue-on-error is prohibited on mandatory checks",
                )
            )
        if "run" not in step:
            continue
        shell = str(step.get("shell", ""))
        executable = _strip_shell_comments(str(step["run"]), shell)
        for label, pattern in MASKING_PATTERNS:
            if pattern.search(executable):
                violations.append(
                    Violation(
                        "PORT-CI-008",
                        where,
                        f"child-process failure masking ({label}) is prohibited",
                    )
                )
        if shell == PWSH_SHELL and _pwsh_has_swallowed_catch(executable):
            violations.append(
                Violation(
                    "PORT-CI-008",
                    where,
                    "PowerShell catch block can swallow a child-process "
                    "failure; terminate every catch with throw or a non-zero exit",
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
        if RUST_INSTALL_MARKER
        in _strip_shell_comments(str(step.get("run", "")), str(step.get("shell", "")))
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
        body = _strip_shell_comments(str(step["run"]), str(step.get("shell", "")))
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
        if "playwright install"
        in _strip_shell_comments(str(step.get("run", "")), str(step.get("shell", "")))
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
    linux = [s for _where, s in installs if _step_has_exact_os_guard(s, "Linux")]
    macos = [s for _where, s in installs if _step_has_exact_os_guard(s, "macOS")]
    windows = [s for _where, s in installs if _step_has_exact_os_guard(s, "Windows")]
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
        body = _strip_shell_comments(
            str(step.get("run", "")), str(step.get("shell", ""))
        )
        guarded_linux = _step_has_exact_os_guard(step, "Linux")
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
        body = _strip_shell_comments(
            str(step.get("run", "")), str(step.get("shell", ""))
        )
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


def _docstring_node_ids(tree: ast.AST) -> set[int]:
    """Return AST identities for module/class/function docstring constants."""

    identities: set[int] = set()
    docstring_owners = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    for owner in ast.walk(tree):
        if not isinstance(owner, docstring_owners) or not owner.body:
            continue
        first = owner.body[0]
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            identities.add(id(first.value))
    return identities


def _dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def _add_descendant_ids(node: ast.AST, identities: set[int]) -> None:
    identities.update(id(descendant) for descendant in ast.walk(node))


def _type_metadata_node_ids(tree: ast.AST) -> set[int]:
    """Return AST identities that describe types rather than runtime values."""

    identities: set[int] = set()
    for owner in ast.walk(tree):
        if isinstance(owner, ast.arg) and owner.annotation is not None:
            _add_descendant_ids(owner.annotation, identities)
        elif isinstance(owner, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if owner.returns is not None:
                _add_descendant_ids(owner.returns, identities)
        elif isinstance(owner, ast.AnnAssign):
            _add_descendant_ids(owner.annotation, identities)
        elif isinstance(owner, ast.TypeAlias):
            _add_descendant_ids(owner.value, identities)
        elif isinstance(owner, ast.Subscript) and _dotted_name(owner.value) in {
            "Literal",
            "typing.Literal",
        }:
            # ``Literal`` arguments are values syntactically, but their
            # strings are type vocabulary and must not be treated as runtime
            # filesystem literals.
            _add_descendant_ids(owner.slice, identities)
    return identities


def _iter_string_constants(tree: ast.AST) -> list[str]:
    excluded = _docstring_node_ids(tree) | _type_metadata_node_ids(tree)
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and id(node) not in excluded
    ]


def _separator_variable_names(tree: ast.AST) -> set[str]:
    """Resolve simple module/local aliases for literal slash separators."""

    assignments: list[tuple[str, ast.expr]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            assignments.extend(
                (target.id, node.value)
                for target in node.targets
                if isinstance(target, ast.Name)
            )
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and node.value is not None
        ):
            assignments.append((node.target.id, node.value))

    names: set[str] = set()
    changed = True
    while changed:
        changed = False
        for name, value in assignments:
            is_separator = (
                isinstance(value, ast.Constant) and value.value in {"/", "\\"}
            ) or (isinstance(value, ast.Name) and value.id in names)
            if is_separator and name not in names:
                names.add(name)
                changed = True
    return names


def _is_separator_operand(node: ast.expr, separator_names: set[str]) -> bool:
    return (isinstance(node, ast.Constant) and node.value in {"/", "\\"}) or (
        isinstance(node, ast.Name) and node.id in separator_names
    )


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
        banned_path = BANNED_POSIX_PATH_RE.search(literal)
        if banned_path is not None:
            violations.append(
                Violation(
                    "PORT-SRC-001",
                    rel,
                    f"hard-coded POSIX system path {banned_path.group()!r} "
                    f"in runtime literal {literal!r}; use "
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
    type_metadata = _type_metadata_node_ids(tree)
    separator_names = _separator_variable_names(tree)
    for node in ast.walk(tree):
        if not isinstance(node, ast.BinOp) or not isinstance(node.op, ast.Add):
            continue
        if id(node) in type_metadata:
            continue
        operands = (node.left, node.right)
        if any(_is_separator_operand(operand, separator_names) for operand in operands):
            violations.append(
                Violation(
                    "PORT-SRC-003",
                    f"{rel}:{node.lineno}",
                    "manual path-separator string concatenation; use pathlib joins",
                )
            )
            break


def _ts_runtime_sources(repo: Path) -> list[Path]:
    files: set[Path] = set()
    for pattern in TS_RUNTIME_SOURCE_GLOBS:
        files.update(path for path in repo.glob(pattern) if path.is_file())
    return sorted(files)


def _check_ts_runtime_source(
    repo: Path, path: Path, violations: list[Violation]
) -> None:
    """PORT-SRC-008: TypeScript runtime sources stay platform-neutral.

    Deliberately text-level (comments included): TypeScript has no stdlib
    AST available here, and runtime TS must not reference POSIX system
    paths, Bash wrappers, or ``shell: true`` spawns even in guidance text.
    """

    rel = path.relative_to(repo).as_posix()
    lines = path.read_text(encoding="utf-8").splitlines()
    for line_number, line in enumerate(lines, start=1):
        banned_path = BANNED_POSIX_PATH_RE.search(line)
        if banned_path is not None:
            violations.append(
                Violation(
                    "PORT-SRC-008",
                    f"{rel}:{line_number}",
                    f"hard-coded POSIX system path {banned_path.group()!r} "
                    "in TypeScript runtime source; use node:os tmpdir() and "
                    "node:path joins or isolate it in a platform-specific "
                    "module with a tested per-platform equivalent",
                )
            )
        for fragment in BANNED_SHELL_WRAPPER_FRAGMENTS:
            if fragment in line:
                violations.append(
                    Violation(
                        "PORT-SRC-008",
                        f"{rel}:{line_number}",
                        f"Bash-only wrapper literal {fragment!r} in "
                        "TypeScript runtime source",
                    )
                )
        for fragment in TS_SHELL_TRUE_FRAGMENTS:
            if fragment in line:
                violations.append(
                    Violation(
                        "PORT-SRC-008",
                        f"{rel}:{line_number}",
                        "child-process shell mode masks failures and "
                        "assumes a host shell; use argv arrays with "
                        "spawnSync/execFileSync",
                    )
                )
                break


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
    raw_bodies = "\n".join(
        _strip_shell_comments(str(step.get("run", "")), str(step.get("shell", "")))
        for _, step in steps
    )

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

    required_matrix_job = _check_matrix(workflow, violations)
    _check_canonical_commands(required_matrix_job, violations)
    _check_shell_policy(workflow, steps, violations)
    _check_windows_tokens(steps, violations)
    _check_masking(workflow, steps, violations)
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
    for source in _ts_runtime_sources(repo):
        _check_ts_runtime_source(repo, source, violations)
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
