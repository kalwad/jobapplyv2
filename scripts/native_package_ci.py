"""Isolated native package CI coordinator on a dedicated runner.

Original source stays read-only.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.util
import json
import os
import platform
import re
import shutil
import stat
import sys
import time
import traceback
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, TypedDict, cast

if TYPE_CHECKING:
    from native_package_pipeline import Budget, FilePin, ProcessHelper, ToolPin

NAMES = ("japp_contracts-0.0.1-py3-none-any.whl", "orchestrator-0.0.1-py3-none-any.whl")
MSVC_DECLARATION_LIMIT = 128
ENV_KEYS = (
    "PATH",
    "HOME",
    "USERPROFILE",
    "SystemRoot",
    "WINDIR",
    "SystemDrive",
    "COMSPEC",
    "PATHEXT",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "LANG",
    "LC_ALL",
)


class SourceFile(TypedDict):
    sha256: str
    bytes: int
    mode: str


class SourceProjection(TypedDict):
    head: str
    tree: str
    files: dict[str, SourceFile]


@dataclass
class _CoordinatorState:
    trace: Path | None = None
    process: ProcessHelper | None = None
    deadlines: Budget | None = None
    sequence: int = 0


_STATE = _CoordinatorState()


def _context() -> tuple[Path, ProcessHelper, Budget]:
    if _STATE.trace is None or _STATE.process is None or _STATE.deadlines is None:
        raise ValueError("Native coordinator command context is not initialized")
    return _STATE.trace, _STATE.process, _STATE.deadlines


def _wheel_pins(value: object) -> dict[str, FilePin]:
    if not isinstance(value, dict):
        raise ValueError("Project wheel manifest must be an object")
    result: dict[str, FilePin] = {}
    for role in ("contracts", "orchestrator"):
        row = value.get(role)
        if not isinstance(row, dict):
            raise ValueError("Project wheel role must be an object")
        path, pin = row.get("path"), row.get("sha256")
        if not isinstance(path, str) or not isinstance(pin, str):
            raise ValueError("Project wheel role requires text path and digest")
        result[role] = {"path": path, "sha256": pin}
    return result


PROCESS_HELPER_SHA = "7371248344a87e537cb66cd8ef4650fb521440088be1bd75573dcf3ee5960b1d"


def load_process_helper() -> ProcessHelper:
    path = Path(__file__).with_name("_native_package_process.py")
    if sha(path) != PROCESS_HELPER_SHA:
        raise ValueError("Reviewed process helper changed before import")
    name = "_japp_native_package_ci_process"
    if name in sys.modules:
        raise ValueError("Native command helper module name occupied")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError("Native command helper unavailable")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    if sha(path) != PROCESS_HELPER_SHA:
        raise ValueError("Native command helper changed during import")
    for attribute in ("budget", "_validate_budget", "run"):
        if not callable(getattr(module, attribute, None)):
            raise ValueError("Pinned native process interface missing")
    return cast("ProcessHelper", module)


def sha(path: str | Path) -> str:
    path = Path(path)
    before = path.stat()
    value = hashlib.sha256()
    total = 0
    if not stat.S_ISREG(before.st_mode) or before.st_size > 512 * 1024 * 1024:
        raise ValueError("Bounded regular input required")
    with path.open("rb") as stream:
        while data := stream.read(65536):
            total += len(data)
            if total > before.st_size:
                raise ValueError("Input grew while hashing")
            value.update(data)
    after = path.stat()

    def identity(row: os.stat_result) -> tuple[int, int, int, int, int]:
        return (row.st_dev, row.st_ino, row.st_size, row.st_mtime_ns, row.st_mode)

    if identity(before) != identity(after) or total != before.st_size:
        raise ValueError("Input changed while hashing")
    return value.hexdigest()


def dump(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def declared_dumpbin(installation_output: bytes, proof: Path) -> Path:
    """Select the installed default, without guessing among sibling toolsets."""
    installations = installation_output.decode("utf-8").splitlines()
    installations = [line.strip() for line in installations if line.strip()]
    if len(installations) != 1 or not Path(installations[0]).is_absolute():
        raise ValueError("Unambiguous absolute MSVC installation required")
    installation = Path(installations[0])
    declaration = (
        installation / "VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt"
    )
    try:
        before = declaration.lstat()
        if (
            not stat.S_ISREG(before.st_mode)
            or not 0 < before.st_size <= MSVC_DECLARATION_LIMIT
        ):
            raise ValueError("Bounded regular MSVC default declaration required")
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0)
        flags |= getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(declaration, flags)
        try:
            opened = os.fstat(descriptor)
            body = os.read(descriptor, MSVC_DECLARATION_LIMIT + 1)
            after = os.fstat(descriptor)
        finally:
            os.close(descriptor)
    except OSError as error:
        raise ValueError("MSVC default declaration unavailable") from error
    identity = ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns")
    if (
        not stat.S_ISREG(opened.st_mode)
        or any(getattr(before, key) != getattr(after, key) for key in identity)
        or any(getattr(opened, key) != getattr(after, key) for key in identity)
        or len(body) != before.st_size
    ):
        raise ValueError("MSVC default declaration changed while reading")
    try:
        version = body.decode("utf-8-sig").strip()
    except UnicodeError as error:
        raise ValueError("Malformed MSVC default declaration") from error
    if re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version) is None:
        raise ValueError("Malformed MSVC default version")
    image = installation / f"VC/Tools/MSVC/{version}/bin/Hostx64/x64/dumpbin.exe"
    if not image.is_file():
        raise ValueError("Declared MSVC default inspection tool unavailable")
    (proof / "msvc-default-version.stdout").write_bytes(body)
    dump(
        proof / "msvc-default-selection.json",
        {
            "selection": "installed-declared-default",
            "installation": str(installation),
            "version": version,
            "declaration": str(declaration),
            "declaration_sha256": hashlib.sha256(body).hexdigest(),
            "image": str(image),
            "image_sha256": sha(image),
        },
    )
    return image


def tool(name: str) -> ToolPin:
    selected = shutil.which(name)
    if selected is None:
        raise ValueError("Required native tool absent: " + name)
    path = Path(selected).absolute()
    resolved = path.resolve(strict=True)
    return {"path": str(path), "resolved_path": str(resolved), "sha256": sha(resolved)}


def raw(
    argv: Sequence[str | Path],
    cwd: Path,
    env: Mapping[str, str],
    *,
    cleanup: bool = False,
) -> bytes:
    trace, process, budget = _context()
    _STATE.sequence += 1
    stem = "ci-command-" + str(_STATE.sequence).zfill(3)
    deadlines = budget.copy()
    if cleanup:
        # Read-only final projection may use the existing cleanup reserve. It
        # never creates new work authority or extends the whole deadline.
        deadlines["work_deadline"] = deadlines["cleanup_deadline"] - 5
    result = process.run(
        [str(x) for x in argv],
        cwd=Path(cwd),
        env=dict(env),
        stem=trace / stem,
        seconds=20 if cleanup else 120,
        deadlines=deadlines,
    )
    return result.stdout


def projection(
    source: Path,
    git: str,
    env: Mapping[str, str],
    require_clean: bool = True,
    *,
    cleanup: bool = False,
) -> SourceProjection:
    status = raw(
        [git, "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        source,
        env,
        cleanup=cleanup,
    )
    if require_clean and status:
        raise ValueError("Original source checkout is not clean")
    names = (
        raw([git, "ls-files", "-z"], source, env, cleanup=cleanup)
        .decode("utf-8")
        .split("\0")
    )
    files: dict[str, SourceFile] = {}
    for name in sorted(n for n in names if n):
        if time.monotonic() >= (
            _context()[2]["cleanup_deadline"] - 5
            if cleanup
            else _context()[2]["work_deadline"]
        ):
            raise TimeoutError("Source projection deadline")
        path = source / name
        info = path.lstat()
        if (
            not stat.S_ISREG(info.st_mode)
            or getattr(info, "st_file_attributes", 0) & 0x400
        ):
            raise ValueError("Regular source required")
        files[name] = {
            "sha256": sha(path),
            "bytes": info.st_size,
            "mode": oct(stat.S_IMODE(info.st_mode)),
        }
    return {
        "head": raw([git, "rev-parse", "HEAD"], source, env, cleanup=cleanup)
        .decode()
        .strip(),
        "tree": raw([git, "rev-parse", "HEAD^{tree}"], source, env, cleanup=cleanup)
        .decode()
        .strip(),
        "files": files,
    }


# Ordered setup/function/final-source closure share one explicit owner context.
# Preserve that chronology rather than split it for branch/statement counts.
def main() -> None:  # noqa: PLR0912, PLR0915
    p = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "work", "proof", "python"):
        p.add_argument("--" + name, type=Path, required=True)
    args = p.parse_args()
    source = args.source.resolve()
    work = args.work.resolve()
    proof = args.proof.resolve()
    if (
        source in work.parents
        or source in proof.parents
        or work.exists()
        or proof.exists()
    ):
        raise ValueError("Fresh outside native work/proof roots required")
    if args.python.resolve() != Path(sys.executable).resolve():
        raise ValueError("Pinned native Python must run coordinator")
    env = {key: os.environ[key] for key in ENV_KEYS if key in os.environ}
    if "PATH" not in env or not ("HOME" in env or "USERPROFILE" in env):
        raise ValueError("Curated native Git/tool environment required")
    proof.mkdir(parents=True)
    _STATE.trace = proof
    _STATE.process = load_process_helper()
    deadlines = _STATE.process.budget()
    _STATE.deadlines = deadlines
    shutil.copy2(
        Path(__file__).with_name("_native_package_process.py"),
        proof / "owned-command-helper.py",
    )
    dump(
        proof / "whole-pipeline-budget.json",
        {
            "deadlines": dict(deadlines),
            "work_seconds": 2700,
            "cleanup_seconds": 60,
            "job_minutes": 60,
            "setup_and_upload_outside_this_invocation": (
                "Job60min remains authoritative; setup/re"
                "tention have remaining time, not a new d"
                "eadline extension."
            ),
        },
    )
    git = tool("git")["path"]
    before = projection(source, git, env)
    dump(proof / "original-source-before.json", before)
    host = {
        "os": platform.platform(),
        "system": platform.system(),
        "machine": platform.machine(),
        "python": sys.version,
        "runner_image": {
            key: os.environ.get(key)
            for key in ("ImageOS", "ImageVersion", "RUNNER_OS", "RUNNER_ARCH")
        },
        "scope": (
            "Actual host version and selected tool pr"
            "ovenance; no whole interpreter/SDK/image"
            " hash lock or GUI certification"
        ),
        "sdk_closure_fully_content_locked": False,
        "windows11_desktop_observed": False,
        "default_gnome_observed": False,
    }
    dump(proof / "host.json", host)
    outcome: dict[str, object] = {
        "status": "PREPARATION_INCOMPLETE",
        "canonical_verification_waived": False,
        "gui_claim": False,
    }
    try:
        raw([git, "clone", "--no-hardlinks", source, work], source.parent, env)
        for name in before["files"]:
            destination = work / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / name, destination)
        clone = projection(work, git, env, require_clean=False)
        if clone != before:
            raise ValueError("Owned checkout differs from original immutable source")
        runtime = work / "apps/desktop/src-tauri/runtime-payload"
        if any(p.name != ".gitignore" for p in runtime.iterdir()):
            raise ValueError("Fresh runtime stage required")
        role_tools: dict[str, ToolPin] = {
            name: tool(name)
            for name in ("python", "uv", "node", "cargo", "rustc", "rustup", "git")
            if name != "python"
        }
        python = args.python.absolute()
        role_tools["python"] = {
            "path": str(python),
            "resolved_path": str(python.resolve()),
            "sha256": sha(python.resolve()),
        }
        node = Path(role_tools["node"]["path"]).resolve()
        candidates = [
            node.parent / "node_modules/corepack/dist/pnpm.js",
            node.parent.parent / "lib/node_modules/corepack/dist/pnpm.js",
        ]
        corepack = [path for path in candidates if path.is_file()]
        if len(corepack) != 1:
            raise ValueError("Pinned Corepack pnpm launcher unavailable")
        role_tools["pnpm_js"] = {
            "path": str(corepack[0]),
            "resolved_path": str(corepack[0].resolve()),
            "sha256": sha(corepack[0].resolve()),
        }
        role_tools["build_pnpm"] = tool("pnpm")
        for role in ("cargo", "rustc"):
            real = Path(
                raw([role_tools["rustup"]["path"], "which", role], work, env)
                .decode("utf-8")
                .strip()
            )
            role_tools[role + "_real"] = {
                "path": str(real),
                "resolved_path": str(real.resolve()),
                "sha256": sha(real.resolve()),
            }
        if platform.system() == "Windows":
            # Keep an activated PATH tool; otherwise use the installed declared
            # default. A VS installation may contain multiple MSVC versions.
            selected = shutil.which("dumpbin.exe")
            if selected is None:
                vswhere = (
                    Path(os.environ["PROGRAMFILES(X86)"])
                    / "Microsoft Visual Studio/Installer/vswhere.exe"
                )
                output = raw(
                    [
                        vswhere,
                        "-utf8",
                        "-latest",
                        "-products",
                        "*",
                        "-requires",
                        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                        "-property",
                        "installationPath",
                    ],
                    work,
                    env,
                )
                (proof / "vswhere-installation.stdout").write_bytes(output)
                dump(
                    proof / "vswhere-image.json",
                    {"path": str(vswhere), "sha256": sha(vswhere)},
                )
                selected = str(declared_dumpbin(output, proof))
            image = Path(selected).absolute()
            role_tools["dumpbin"] = {
                "path": str(image),
                "resolved_path": str(image.resolve()),
                "sha256": sha(image.resolve()),
            }
            target = "x86_64-pc-windows-msvc"
        else:
            role_tools["dpkg_deb"] = tool("dpkg-deb")
            target = "x86_64-unknown-linux-gnu"
        wheel_manifest = _wheel_pins(
            json.loads((work / "packaging/native-project-wheels.json").read_text())
        )
        wheels: dict[str, FilePin] = {}
        for role in ("contracts", "orchestrator"):
            row = wheel_manifest[role]
            path = work / row["path"]
            if path.name not in NAMES or sha(path) != row["sha256"]:
                raise ValueError("Frozen project wheel input changed")
            wheels[role] = {"path": str(path), "sha256": row["sha256"]}
        proposal = {
            name: sha(work / "scripts" / name)
            for name in (
                "native_package_pipeline.py",
                "wheel_only_runtime_lock.py",
                "package_validation.rs",
                "_native_package_process.py",
            )
        }
        preflight_proof = proof / "pipeline-preflight"
        preflight_proof.mkdir()
        spec = {
            "deadlines": dict(deadlines),
            "preflight_proof": str(preflight_proof),
            "canonical_root": str(source),
            "owned_checkout": str(work),
            "output": str(proof / "pipeline"),
            "target": target,
            "expected_git_head": before["head"],
            "source_projection": {n: r["sha256"] for n, r in before["files"].items()},
            "proposal_bindings": proposal,
            "tools": role_tools,
            "contracts_wheel": wheels["contracts"],
            "orchestrator_wheel": wheels["orchestrator"],
            "build_environment": env,
            "host_inventory_reference": {
                "path": str(proof / "host.json"),
                "sha256": sha(proof / "host.json"),
            },
        }
        dump(proof / "native-inputs.json", spec)
        # One owning Python coordinator executes only this pinned trusted
        # function; no nested unbounded pipeline process can abandon commands.
        pipeline_path = work / "scripts/native_package_pipeline.py"
        if sha(pipeline_path) != proposal["native_package_pipeline.py"]:
            raise ValueError("Pinned pipeline changed before import")
        pipeline_module_name = "_japp_native_package_owned_pipeline"
        if pipeline_module_name in sys.modules:
            raise ValueError("Native pipeline module name occupied")
        module_spec = importlib.util.spec_from_file_location(
            pipeline_module_name, pipeline_path
        )
        if module_spec is None or module_spec.loader is None:
            raise ValueError("Pinned pipeline unavailable")
        module = importlib.util.module_from_spec(module_spec)
        # Exact registered identity is required by postponed dataclass fields.
        # Retain a partial module on failure; it cannot be silently reused.
        sys.modules[pipeline_module_name] = module
        module_spec.loader.exec_module(module)
        if sha(pipeline_path) != proposal["native_package_pipeline.py"]:
            raise ValueError("Pinned pipeline changed during import")
        dump(
            proof / "pipeline.upfront.json",
            {
                "invocation_kind": "PINNED_IN_PROCESS_FUNCTION",
                "module": str(pipeline_path),
                "module_sha256": proposal["native_package_pipeline.py"],
                "function": "main",
                "spec": str(proof / "native-inputs.json"),
                "cwd": str(work),
                "environment_argument": dict(env),
                "deadlines": dict(deadlines),
                "native_runtime_inputs_locked": True,
                "host_sdk_and_image_whole_closure_locked": False,
            },
        )
        function_result: dict[str, object] = {
            "invocation_kind": "PINNED_IN_PROCESS_FUNCTION",
            "returned": False,
        }
        try:
            with (
                (proof / "pipeline.stdout").open("x") as stdout,
                (proof / "pipeline.stderr").open("x") as stderr,
            ):
                previous_cwd = Path.cwd()
                try:
                    # Preserve the former pipeline child's actual CWD for
                    # Windows PATH/current-directory resolver checks.
                    os.chdir(work)
                    with (
                        contextlib.redirect_stdout(stdout),
                        contextlib.redirect_stderr(stderr),
                    ):
                        try:
                            entry = getattr(module, "main", None)
                            if not callable(entry):
                                raise ValueError("Pinned pipeline entry point missing")
                            cast(Callable[[Path], None], entry)(
                                proof / "native-inputs.json"
                            )
                            function_result["returned"] = True
                        except BaseException:
                            traceback.print_exc(file=stderr)
                            raise
                finally:
                    os.chdir(previous_cwd)
        except BaseException as error:
            function_result["failure"] = {
                "type": type(error).__name__,
                "message": str(error),
            }
            raise
        finally:
            function_result.update(
                stdout_sha256=sha(proof / "pipeline.stdout"),
                stderr_sha256=sha(proof / "pipeline.stderr"),
            )
            dump(proof / "pipeline.result.json", function_result)
        outcome["status"] = "PACKAGE_PIPELINE_FUNCTION_RETURNED_GUI_UNOBSERVED"
    finally:
        prior_failure = sys.exc_info()[0] is not None
        try:
            after = projection(source, git, env, cleanup=True)
            dump(proof / "original-source-after.json", after)
            outcome["original_source_bytes_and_modes_equal"] = before == after
            outcome["original_source_clean"] = True
        except BaseException as error:
            outcome["original_source_bytes_and_modes_equal"] = False
            outcome["original_source_projection_failure"] = {
                "type": type(error).__name__,
                "message": str(error),
            }
        outcome["whole_deadlines"] = dict(deadlines)
        outcome["within_whole_cleanup_deadline"] = (
            time.monotonic() < deadlines["cleanup_deadline"]
        )
        dump(proof / "ci-result.json", outcome)
        if not prior_failure and (
            not outcome["original_source_bytes_and_modes_equal"]
            or not outcome["within_whole_cleanup_deadline"]
        ):
            raise RuntimeError("Original source or whole-budget closure failed")


if __name__ == "__main__":
    main()
