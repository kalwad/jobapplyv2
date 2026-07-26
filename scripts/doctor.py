#!/usr/bin/env python3
"""Local environment doctor and preflight entry point (M00-W06/M00-W09, spec §M00).

Read-only diagnosis of the developer/CI environment against the repository's
own pins (.nvmrc, package.json, .python-version, pyproject.toml,
rust-toolchain.toml). The doctor never installs software, never modifies
tracked files, never alters PATH or shell configuration, and defaults to
offline checks (the browser probe launches the locally installed pinned
Chromium against inline content only).

The doctor is platform-neutral (M00-W09, REQ-PLAT-025): it runs on macOS,
Windows, and Ubuntu. Child commands are resolved through
scripts/portability.py (PATHEXT/.exe/.cmd semantics on Windows, executable
bit on POSIX), no POSIX filesystem layout (/tmp, /bin, /usr, Homebrew) is
assumed outside macOS-specific remediation text, and every failing check
carries remediation for the detected platform. Platform identity, command
results, and the home directory used for path redaction are injectable so
Windows behavior is testable from any host.

Modes
  python3 scripts/doctor.py             human-readable summary
  python3 scripts/doctor.py --json      deterministic machine-readable JSON
  python3 scripts/doctor.py --preflight doctor, then the canonical
                                        `pnpm verify` aggregate — the same
                                        two commands CI runs, in the same
                                        order, sharing the same
                                        implementations (no duplicated
                                        verification logic).

Statuses
  PASS                requirement satisfied
  WARNING             non-fatal observation (does not affect the exit code)
  FAIL                mandatory requirement violated (exit 1)
  NOT_YET_APPLICABLE  suite honestly inactive per the M00-W04 state model
                      (owner package has not begun) — never counted as a pass

Exit codes: 0 = no failing check, 1 = at least one failing check (or a
preflight child failure), 2 = usage/internal error.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import portability
import validate_status
import verify

Runner = Callable[[tuple[str, ...]], tuple[int, str]]

COMMAND_TIMEOUT_SECONDS = 240
PREFLIGHT_VERIFY_ARGV: tuple[str, ...] = ("pnpm", "verify")
BROWSER_SMOKE_ARGV: tuple[str, ...] = (
    "pnpm",
    "exec",
    "playwright",
    "test",
    "e2e/browser-smoke.spec.ts",
)

STATUS_PASS = "PASS"
STATUS_WARNING = "WARNING"
STATUS_FAIL = "FAIL"
STATUS_NOT_YET_APPLICABLE = "NOT_YET_APPLICABLE"

ACTIVATION_README = "see README.md 'Activation on this machine'"
WINDOWS_README = "see README.md 'Windows setup (PowerShell)'"


@dataclass(frozen=True)
class CheckResult:
    check_id: str
    name: str
    status: str
    detail: str
    remediation: str = ""


@dataclass(frozen=True)
class Pins:
    node: str
    pnpm: str
    python: str
    uv: str
    rust: str
    playwright: str


@dataclass
class DoctorContext:
    repo: Path
    run: Runner
    # Injectable platform identity and redaction root: tests simulate
    # Windows (or any platform) from any host instead of depending on the
    # machine actually running the tests (M00-W09 §E).
    platform_id: str = field(default_factory=portability.detect_platform_id)
    home: Path = field(default_factory=Path.home)


def default_runner(repo: Path) -> Runner:
    def run(argv: tuple[str, ...]) -> tuple[int, str]:
        # Resolve through PATH (and PATHEXT on Windows) before spawning:
        # Windows CreateProcess would not find .cmd shims such as pnpm, and
        # an unresolvable command must diagnose cleanly on every platform.
        resolved = portability.host_resolve_executable(argv[0])
        if resolved is None:
            return 127, f"{argv[0]}: command not found"
        try:
            proc = subprocess.run(
                (resolved, *argv[1:]),
                cwd=repo,
                capture_output=True,
                text=True,
                timeout=COMMAND_TIMEOUT_SECONDS,
                check=False,
            )
        except OSError as exc:
            return 126, f"{argv[0]}: cannot execute ({exc})"
        except subprocess.TimeoutExpired:
            return 124, f"{' '.join(argv)}: timed out"
        return proc.returncode, (proc.stdout + proc.stderr).strip()

    return run


def _scrub(text: str, home: Path | None = None) -> str:
    """Replace the home-directory prefix so output stays path-minimal.

    Both native and forward-slash spellings are redacted: Windows tools mix
    ``C:\\Users\\name`` and ``C:/Users/name`` in their output.
    """
    root = str(home if home is not None else Path.home())
    if not root or root == "/":
        return text
    scrubbed = text.replace(root, "~")
    alt = root.replace("\\", "/")
    if alt != root:
        scrubbed = scrubbed.replace(alt, "~")
    return scrubbed


def read_pins(repo: Path) -> Pins:
    package = json.loads((repo / "package.json").read_text(encoding="utf-8"))
    pyproject = tomllib.loads((repo / "pyproject.toml").read_text(encoding="utf-8"))
    rust = tomllib.loads((repo / "rust-toolchain.toml").read_text(encoding="utf-8"))
    package_manager = str(package.get("packageManager", ""))
    if not package_manager.startswith("pnpm@"):
        raise ValueError(f"unexpected packageManager pin: {package_manager!r}")
    uv_required = str(pyproject["tool"]["uv"]["required-version"])
    return Pins(
        node=(repo / ".nvmrc").read_text(encoding="utf-8").strip(),
        pnpm=package_manager.removeprefix("pnpm@"),
        python=(repo / ".python-version").read_text(encoding="utf-8").strip(),
        uv=uv_required.removeprefix("=="),
        rust=str(rust["toolchain"]["channel"]),
        playwright=str(package["devDependencies"]["@playwright/test"]),
    )


@dataclass(frozen=True)
class VersionProbe:
    check_id: str
    name: str
    argv: tuple[str, ...]
    expected_fragment: str
    remediation: str


def _version_check(ctx: DoctorContext, probe: VersionProbe) -> CheckResult:
    code, output = ctx.run(probe.argv)
    first_line = output.splitlines()[0] if output else ""
    if code != 0:
        return CheckResult(
            probe.check_id,
            probe.name,
            STATUS_FAIL,
            _scrub(output or f"exit {code}", ctx.home),
            probe.remediation,
        )
    if probe.expected_fragment not in first_line:
        return CheckResult(
            probe.check_id,
            probe.name,
            STATUS_FAIL,
            f"got '{_scrub(first_line, ctx.home)}', "
            f"expected '{probe.expected_fragment}'",
            probe.remediation,
        )
    return CheckResult(
        probe.check_id, probe.name, STATUS_PASS, _scrub(first_line, ctx.home)
    )


def check_repository_files(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    results: list[CheckResult] = []
    missing_memory = [
        rel
        for rel, _needles in validate_status.MEMORY_FILES
        if not (ctx.repo / rel).is_file()
    ]
    gate_reports = sorted(validate_status.GATE_REPORTS.values())
    missing_gates = [rel for rel in gate_reports if not (ctx.repo / rel).is_file()]
    results.append(
        CheckResult(
            "memory-files",
            "Canonical project-memory files",
            STATUS_FAIL if missing_memory else STATUS_PASS,
            (
                f"missing: {missing_memory}"
                if missing_memory
                else f"{len(validate_status.MEMORY_FILES)} files present"
            ),
            "restore from git: git checkout -- <path>" if missing_memory else "",
        )
    )
    results.append(
        CheckResult(
            "critical-gate-files",
            "Critical-gate ledger and reports",
            STATUS_FAIL if missing_gates else STATUS_PASS,
            (
                f"missing: {missing_gates}"
                if missing_gates
                else "ledger + 4 gate reports + holdout log present"
            ),
            "restore from git: git checkout -- docs/gates docs/CRITICAL_GATES.md"
            if missing_gates
            else "",
        )
    )
    missing_locks = [rel for rel in verify.LOCKFILES if not (ctx.repo / rel).is_file()]
    results.append(
        CheckResult(
            "lockfiles",
            "Lockfiles for active ecosystems",
            STATUS_FAIL if missing_locks else STATUS_PASS,
            f"missing: {missing_locks}"
            if missing_locks
            else ", ".join(verify.LOCKFILES),
            "restore from git: git checkout -- <lockfile>" if missing_locks else "",
        )
    )
    try:
        package = json.loads((ctx.repo / "package.json").read_text(encoding="utf-8"))
        scripts = package.get("scripts", {})
        missing_scripts = [
            name for name in verify.CANONICAL_ROOT_SCRIPTS if name not in scripts
        ]
    except (OSError, json.JSONDecodeError) as exc:
        missing_scripts = [f"package.json unreadable: {exc}"]
    results.append(
        CheckResult(
            "root-scripts",
            "Required root scripts",
            STATUS_FAIL if missing_scripts else STATUS_PASS,
            (
                f"missing: {missing_scripts}"
                if missing_scripts
                else f"{len(verify.CANONICAL_ROOT_SCRIPTS)} canonical scripts present"
            ),
            "restore package.json from git" if missing_scripts else "",
        )
    )
    return results


def check_platform(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    known = ctx.platform_id in portability.PLATFORM_IDS
    return [
        CheckResult(
            "platform",
            "Host platform",
            STATUS_PASS if known else STATUS_WARNING,
            f"{ctx.platform_id}; repository commands are platform-neutral "
            "(REQ-PLAT-025). Development-host support only — packaged "
            "product certification is later native work "
            "(docs/PLATFORM_SUPPORT.md)",
            ""
            if known
            else "unrecognized platform; certified development "
            "hosts are macOS, Windows, and Ubuntu",
        )
    ]


def check_git_state(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    code, inside = ctx.run(("git", "rev-parse", "--is-inside-work-tree"))
    if code != 0 or inside.strip() != "true":
        return [
            CheckResult(
                "git-worktree",
                "Git repository",
                STATUS_FAIL,
                _scrub(inside, ctx.home),
                "run the doctor from a checkout of the repository",
            )
        ]
    _, branch = ctx.run(("git", "branch", "--show-current"))
    code, porcelain = ctx.run(("git", "status", "--porcelain"))
    dirty = bool(porcelain.strip()) or code != 0
    return [
        CheckResult(
            "git-worktree",
            "Git repository",
            STATUS_PASS,
            f"branch '{branch.strip() or '(detached)'}'",
        ),
        CheckResult(
            "git-clean",
            "Working tree state",
            STATUS_WARNING if dirty else STATUS_PASS,
            "uncommitted changes present" if dirty else "clean",
            "commit or stash before relying on verification snapshots" if dirty else "",
        ),
    ]


def _toolchain_remediation(platform_id: str, pins: Pins) -> dict[str, str]:
    """Actionable per-platform remediation for the toolchain probes.

    macOS keeps the Homebrew keg activation guidance; Windows guidance uses
    winget/rustup-init/PowerShell terms and never references Homebrew,
    /opt, or POSIX shell profiles; Linux guidance is distribution-neutral.
    """
    if platform_id == portability.PLATFORM_WINDOWS:
        return {
            "node": f"install Node {pins.node} (for example "
            "winget install OpenJS.NodeJS.LTS, or nvm-windows) and ensure "
            f"that exact version is first on PATH; {WINDOWS_README}",
            "pnpm": "corepack enable pnpm from a PowerShell session where "
            f"the pinned Node {pins.node} is first on PATH; {WINDOWS_README}",
            "uv": f"install uv {pins.uv} (for example "
            f"winget install astral-sh.uv, or pipx install uv=={pins.uv}); "
            f"{WINDOWS_README}",
            "python": "uv sync --locked (uv fetches the pinned CPython automatically)",
            "rust": "install rustup with rustup-init.exe from rustup.rs, "
            f"then: rustup toolchain install {pins.rust}; {WINDOWS_README}",
        }
    if platform_id == portability.PLATFORM_LINUX:
        return {
            "node": f"install Node {pins.node} (for example via nvm or a "
            "NodeSource package) and ensure that exact version is first "
            "on PATH",
            "pnpm": "corepack enable pnpm from a shell where the pinned "
            f"Node {pins.node} is first on PATH",
            "uv": f"pipx install uv=={pins.uv} (or the official installer "
            f"pinned to {pins.uv}; the repository enforces =={pins.uv})",
            "python": "uv sync --locked (uv fetches the pinned CPython automatically)",
            "rust": "install rustup from your distribution or rustup.rs, "
            f"then: rustup toolchain install {pins.rust}",
        }
    activation = (
        'export PATH="/opt/homebrew/opt/node@24/bin:'
        f'/opt/homebrew/opt/rustup/bin:$PATH" ({ACTIVATION_README})'
    )
    return {
        "node": f"brew install node@24, then {activation}",
        "pnpm": "corepack enable pnpm from a shell where the node@24 keg is "
        f"first on PATH; {activation}",
        "uv": f"brew install uv (repository pins =={pins.uv} via pyproject.toml)",
        "python": "uv sync --locked (uv fetches the pinned CPython automatically)",
        "rust": f"brew install rustup; rustup toolchain install {pins.rust}; "
        f"{activation}",
    }


def check_toolchain(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    remediation = _toolchain_remediation(ctx.platform_id, pins)
    probes = [
        VersionProbe(
            "node",
            f"Node {pins.node}",
            ("node", "--version"),
            f"v{pins.node}",
            remediation["node"],
        ),
        VersionProbe(
            "pnpm",
            f"pnpm {pins.pnpm}",
            ("pnpm", "--version"),
            pins.pnpm,
            remediation["pnpm"],
        ),
        VersionProbe(
            "uv",
            f"uv {pins.uv}",
            ("uv", "--version"),
            f"uv {pins.uv}",
            remediation["uv"],
        ),
        VersionProbe(
            "python",
            f"Python {pins.python} (uv-managed)",
            ("uv", "run", "python", "-VV"),
            f"Python {pins.python}",
            remediation["python"],
        ),
    ]
    results = [_version_check(ctx, probe) for probe in probes]
    rust_remediation = remediation["rust"]
    code, toolchain_path = ctx.run(("rustup", "which", "cargo"))
    if code != 0:
        results.append(
            CheckResult(
                "rust-proxy",
                f"Cargo via pinned rustup toolchain {pins.rust}",
                STATUS_FAIL,
                _scrub(toolchain_path, ctx.home),
                rust_remediation,
            )
        )
    elif pins.rust not in toolchain_path:
        results.append(
            CheckResult(
                "rust-proxy",
                f"Cargo via pinned rustup toolchain {pins.rust}",
                STATUS_FAIL,
                f"cargo resolves to {_scrub(toolchain_path.strip(), ctx.home)}, "
                f"not the {pins.rust} toolchain "
                "(rust-toolchain.toml override not active)",
                rust_remediation,
            )
        )
    else:
        results.append(
            CheckResult(
                "rust-proxy",
                f"Cargo via pinned rustup toolchain {pins.rust}",
                STATUS_PASS,
                _scrub(toolchain_path.strip(), ctx.home),
            )
        )
    rust_probes = [
        VersionProbe(
            "cargo",
            f"cargo {pins.rust}",
            ("cargo", "--version"),
            pins.rust,
            rust_remediation,
        ),
        VersionProbe(
            "rustc",
            f"rustc {pins.rust}",
            ("rustc", "--version"),
            pins.rust,
            rust_remediation,
        ),
        VersionProbe(
            "rustfmt",
            "rustfmt component",
            ("cargo", "fmt", "--version"),
            "rustfmt",
            f"rustup component add rustfmt --toolchain {pins.rust}",
        ),
        VersionProbe(
            "clippy",
            "Clippy component",
            ("cargo", "clippy", "--version"),
            "clippy",
            f"rustup component add clippy --toolchain {pins.rust}",
        ),
    ]
    results.extend(_version_check(ctx, probe) for probe in rust_probes)
    return results


def check_writable_dirs(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    problems: list[str] = []
    try:
        # tempfile.gettempdir() honors each platform's convention (TMPDIR,
        # TEMP/TMP + the Windows user temp) — never a hard-coded /tmp.
        with tempfile.NamedTemporaryFile(prefix="japp-doctor-") as handle:
            handle.write(b"probe")
    except OSError as exc:
        problems.append(f"system temp not writable: {exc}")
    try:
        with tempfile.NamedTemporaryFile(prefix=".japp-doctor-", dir=ctx.repo):
            pass
    except OSError as exc:
        problems.append(f"repository root not writable: {exc}")
    return [
        CheckResult(
            "writable-dirs",
            "Writable temporary and artifact locations",
            STATUS_FAIL if problems else STATUS_PASS,
            _scrub("; ".join(problems), ctx.home)
            if problems
            else "system temp + repository root writable",
            "fix directory permissions" if problems else "",
        )
    ]


def check_playwright(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    results: list[CheckResult] = []
    manifest = ctx.repo / "node_modules" / "@playwright" / "test" / "package.json"
    if not manifest.is_file():
        results.append(
            CheckResult(
                "playwright-package",
                f"@playwright/test {pins.playwright}",
                STATUS_FAIL,
                "node_modules/@playwright/test is not installed",
                "pnpm install --frozen-lockfile",
            )
        )
    else:
        installed = str(
            json.loads(manifest.read_text(encoding="utf-8")).get("version", "?")
        )
        results.append(
            CheckResult(
                "playwright-package",
                f"@playwright/test {pins.playwright}",
                STATUS_PASS if installed == pins.playwright else STATUS_FAIL,
                f"installed {installed}",
                ""
                if installed == pins.playwright
                else "pnpm install --frozen-lockfile",
            )
        )
    code, output = ctx.run(BROWSER_SMOKE_ARGV)
    if code == 0:
        results.append(
            CheckResult(
                "browser-probe",
                "Pinned Chromium launch (controlled smoke test)",
                STATUS_PASS,
                "e2e/browser-smoke.spec.ts passed against inline content",
            )
        )
    else:
        detail = _scrub(output[-400:], ctx.home) if output else f"exit {code}"
        results.append(
            CheckResult(
                "browser-probe",
                "Pinned Chromium launch (controlled smoke test)",
                STATUS_FAIL,
                detail,
                "pnpm exec playwright install chromium (downloads the pinned "
                "browser; requires network once), then rerun the doctor",
            )
        )
    return results


def check_status_validator(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    code, output = ctx.run((sys.executable, "scripts/validate_status.py", "--quiet"))
    tail = output.splitlines()[-1] if output else f"exit {code}"
    return [
        CheckResult(
            "status-validator",
            "Project-status validation",
            STATUS_PASS if code == 0 else STATUS_FAIL,
            _scrub(tail, ctx.home),
            "" if code == 0 else "fix docs/PROJECT_STATUS.md per the errors above",
        )
    ]


def check_suite_states(ctx: DoctorContext, pins: Pins) -> list[CheckResult]:
    del pins
    results: list[CheckResult] = []
    verify_ctx = verify.Context(
        repo=ctx.repo,
        registry_path=ctx.repo / "scripts" / "verification-suites.json",
        status_path=ctx.repo / "docs" / "PROJECT_STATUS.md",
    )
    try:
        registry = verify.load_registry(verify_ctx.registry_path)
        states = verify.parse_package_states(verify_ctx.status_path)
    except verify.RegistryError as exc:
        return [
            CheckResult(
                "suite-states",
                "Verification-suite state model",
                STATUS_FAIL,
                _scrub(str(exc), ctx.home),
                "restore scripts/verification-suites.json and "
                "docs/PROJECT_STATUS.md from git",
            )
        ]
    for suite in registry.suites:
        if suite.activation.kind == "always_active":
            continue
        try:
            state = verify.derive_state(verify_ctx, suite, states)
        except verify.RegistryError as exc:
            results.append(
                CheckResult(
                    f"suite-{suite.suite_id}",
                    f"Suite state: {suite.suite_id}",
                    STATUS_FAIL,
                    _scrub(str(exc), ctx.home),
                    "align the registry activation packages with "
                    "docs/PROJECT_STATUS.md",
                )
            )
            continue
        if state is verify.SuiteState.NOT_YET_APPLICABLE:
            results.append(
                CheckResult(
                    f"suite-{suite.suite_id}",
                    f"Suite state: {suite.suite_id}",
                    STATUS_NOT_YET_APPLICABLE,
                    f"owned by {suite.owner}; not a passing suite — becomes "
                    "REQUIRED_MISSING when the owner package begins",
                )
            )
        elif state is verify.SuiteState.REQUIRED_MISSING:
            results.append(
                CheckResult(
                    f"suite-{suite.suite_id}",
                    f"Suite state: {suite.suite_id}",
                    STATUS_FAIL,
                    f"owner {suite.owner} has begun but no artifacts match "
                    f"{list(suite.discovery_globs)}",
                    "implement the suite's artifacts in the owning package "
                    "(REQUIRED_MISSING is always fatal in pnpm verify)",
                )
            )
        else:
            results.append(
                CheckResult(
                    f"suite-{suite.suite_id}",
                    f"Suite state: {suite.suite_id}",
                    STATUS_PASS,
                    "ACTIVE (runs inside pnpm verify)",
                )
            )
    return results


CHECKS: tuple[Callable[[DoctorContext, Pins], list[CheckResult]], ...] = (
    check_platform,
    check_repository_files,
    check_git_state,
    check_toolchain,
    check_writable_dirs,
    check_playwright,
    check_status_validator,
    check_suite_states,
)


def run_doctor(ctx: DoctorContext) -> list[CheckResult]:
    pins = read_pins(ctx.repo)
    results: list[CheckResult] = []
    for check in CHECKS:
        results.extend(check(ctx, pins))
    return results


def summarize(results: list[CheckResult]) -> dict[str, int]:
    summary = {
        STATUS_PASS: 0,
        STATUS_WARNING: 0,
        STATUS_FAIL: 0,
        STATUS_NOT_YET_APPLICABLE: 0,
    }
    for result in results:
        summary[result.status] += 1
    return summary


def render_human(results: list[CheckResult]) -> str:
    width = max(len(result.name) for result in results)
    lines = ["== environment doctor =="]
    for result in results:
        lines.append(f"{result.name:<{width}}  {result.status:<18} {result.detail}")
        if result.remediation and result.status in {STATUS_FAIL, STATUS_WARNING}:
            lines.append(f"{'':<{width}}  fix → {result.remediation}")
    summary = summarize(results)
    lines.append(
        f"summary: {summary[STATUS_PASS]} pass, "
        f"{summary[STATUS_WARNING]} warning, {summary[STATUS_FAIL]} fail, "
        f"{summary[STATUS_NOT_YET_APPLICABLE]} not-yet-applicable"
    )
    return "\n".join(lines)


def render_json(results: list[CheckResult]) -> str:
    payload = {
        "doctor_format_version": 1,
        "checks": [
            {
                "id": result.check_id,
                "name": result.name,
                "status": result.status,
                "detail": result.detail,
                "remediation": result.remediation,
            }
            for result in results
        ],
        "summary": summarize(results),
        "ok": summarize(results)[STATUS_FAIL] == 0,
    }
    return json.dumps(payload, indent=2, sort_keys=False)


def run_preflight(
    ctx: DoctorContext,
    results: list[CheckResult],
    verify_argv: tuple[str, ...] = PREFLIGHT_VERIFY_ARGV,
) -> int:
    if summarize(results)[STATUS_FAIL]:
        print(
            "preflight: environment doctor failed — canonical verification "
            "was not started",
            file=sys.stderr,
        )
        return 1
    print(f"\npreflight: doctor ok — running {' '.join(verify_argv)}", flush=True)
    resolved = portability.host_resolve_executable(verify_argv[0])
    if resolved is None:
        print(f"preflight: command not found: {verify_argv[0]}", file=sys.stderr)
        return 1
    completed = subprocess.run((resolved, *verify_argv[1:]), cwd=ctx.repo, check=False)
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only environment doctor and preflight (M00-W06)."
    )
    parser.add_argument("--repo", default=None, help="repository root override")
    parser.add_argument(
        "--json", action="store_true", help="deterministic machine-readable output"
    )
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="run the doctor, then the canonical aggregate verification",
    )
    args = parser.parse_args()
    if args.json and args.preflight:
        print("--json and --preflight are mutually exclusive", file=sys.stderr)
        return 2

    repo = Path(args.repo) if args.repo else Path(__file__).resolve().parent.parent
    if not (repo / "package.json").is_file():
        print(f"doctor: no package.json under {repo}", file=sys.stderr)
        return 2
    ctx = DoctorContext(repo=repo, run=default_runner(repo))
    try:
        results = run_doctor(ctx)
    except (OSError, ValueError, KeyError, tomllib.TOMLDecodeError) as exc:
        print(f"doctor: cannot read repository pins: {exc}", file=sys.stderr)
        return 2

    print(render_json(results) if args.json else render_human(results))
    if args.preflight:
        return run_preflight(ctx, results)
    return 1 if summarize(results)[STATUS_FAIL] else 0


if __name__ == "__main__":
    sys.exit(main())
