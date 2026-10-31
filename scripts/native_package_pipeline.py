"""UNEXECUTED future native development-package coordinator; separate owned checkout.

It accepts already provisioned native tools and exact source-matched pure wheels.
It does not provision runners, install system packages, install a desktop app,
dispatch a workflow, publish, sign, or certify a GUI.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import re
import shutil
import stat
import subprocess
import sys
import zipfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Protocol, TypedDict, Unpack, cast


class Budget(TypedDict):
    work_deadline: int | float
    cleanup_deadline: int | float


class FilePin(TypedDict):
    path: str
    sha256: str


class ToolPin(FilePin):
    resolved_path: str


class WheelCodeReceipt(TypedDict):
    wheel_sha256: str
    source_package_files: int
    source_python_files: int
    all_package_file_bytes_equal: bool
    installer_surface_restricted: bool


class _RunOptions(TypedDict):
    cwd: Path
    env: Mapping[str, str]
    stem: Path
    seconds: float
    deadlines: Budget


class ProcessHelper(Protocol):
    def budget(self) -> Budget: ...

    def _validate_budget(self, value: Budget) -> None: ...

    def run(
        self, argv: Sequence[str | Path], **options: Unpack[_RunOptions]
    ) -> subprocess.CompletedProcess[bytes]: ...


class PipelineSpec(TypedDict):
    deadlines: Budget
    preflight_proof: str
    canonical_root: str
    owned_checkout: str
    output: str
    target: str
    expected_git_head: str
    source_projection: dict[str, str]
    proposal_bindings: dict[str, str]
    tools: dict[str, ToolPin]
    contracts_wheel: FilePin
    orchestrator_wheel: FilePin
    build_environment: dict[str, str]
    host_inventory_reference: FilePin


def _record(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("Native record must be an object")
    result: dict[str, object] = {}
    for name, item in value.items():
        if not isinstance(name, str):
            raise ValueError("Native record names must be text")
        result[name] = item
    return result


def _text(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Native record field must be text")
    return value


def _text_record(value: object) -> dict[str, str]:
    return {name: _text(item) for name, item in _record(value).items()}


def _file_pin(value: object) -> FilePin:
    row = _text_record(value)
    if set(row) != {"path", "sha256"}:
        raise ValueError("Exact file pin required")
    return {"path": row["path"], "sha256": row["sha256"]}


def _tool_pin(value: object) -> ToolPin:
    row = _text_record(value)
    if set(row) != {"path", "resolved_path", "sha256"}:
        raise ValueError("Exact invocation and physical tool pin required")
    return {
        "path": row["path"],
        "resolved_path": row["resolved_path"],
        "sha256": row["sha256"],
    }


def _budget(value: object) -> Budget:
    row = _record(value)
    if set(row) != {"work_deadline", "cleanup_deadline"}:
        raise ValueError("Exact native work/cleanup budget required")
    work, cleanup = row["work_deadline"], row["cleanup_deadline"]
    if not isinstance(work, (int, float)) or not isinstance(cleanup, (int, float)):
        raise ValueError("Native deadlines must be numeric")
    return {"work_deadline": work, "cleanup_deadline": cleanup}


def _pipeline_spec(value: object) -> PipelineSpec:
    row = _record(value)
    return {
        "deadlines": _budget(row["deadlines"]),
        "preflight_proof": _text(row["preflight_proof"]),
        "canonical_root": _text(row["canonical_root"]),
        "owned_checkout": _text(row["owned_checkout"]),
        "output": _text(row["output"]),
        "target": _text(row["target"]),
        "expected_git_head": _text(row["expected_git_head"]),
        "source_projection": _text_record(row["source_projection"]),
        "proposal_bindings": _text_record(row["proposal_bindings"]),
        "tools": {
            name: _tool_pin(item) for name, item in _record(row["tools"]).items()
        },
        "contracts_wheel": _file_pin(row["contracts_wheel"]),
        "orchestrator_wheel": _file_pin(row["orchestrator_wheel"]),
        "build_environment": _text_record(row["build_environment"]),
        "host_inventory_reference": _file_pin(row["host_inventory_reference"]),
    }


def _process_interface(value: object) -> ProcessHelper:
    for name in ("budget", "_validate_budget", "run"):
        if not callable(getattr(value, name, None)):
            raise ValueError("Pinned native process interface missing")
    # Source is authenticated before and after loading; this is its declared
    # callable interface, not permission to load an unpinned implementation.
    return cast(ProcessHelper, value)


BOUND = 512 * 1024 * 1024
MAX_WHEEL_NODES = 2048
ENV_KEYS = {
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
    "CC",
    "CXX",
    "AR",
    "PKG_CONFIG_PATH",
}


def sha(path: Path) -> str:
    value = hashlib.sha256()
    total = 0
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise ValueError("Regular non-reparse file required")
    with path.open("rb") as stream:
        while data := stream.read(65536):
            total += len(data)
            if total > BOUND:
                raise ValueError("File bound")
            value.update(data)
    return value.hexdigest()


def dump(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def bind(row: FilePin) -> Path:
    if set(row) != {"path", "sha256"}:
        raise ValueError("Exact file pin required")
    path = Path(row["path"])
    if not path.is_absolute() or sha(path) != row["sha256"]:
        raise ValueError("File pin mismatch")
    return path


def bind_tool(row: ToolPin) -> Path:
    if set(row) != {"path", "resolved_path", "sha256"}:
        raise ValueError("Exact invocation and physical tool pin required")
    invocation = Path(row["path"])
    resolved = invocation.resolve(strict=True)
    if (
        not invocation.is_absolute()
        or str(resolved) != row["resolved_path"]
        or sha(resolved) != row["sha256"]
    ):
        raise ValueError("Native tool alias or image changed")
    return invocation


def windows_build_tools(tools: Mapping[str, Path]) -> dict[str, str]:
    """Keep MSVC cl.exe/lib.exe/link.exe out of the Windows package build.

    Each starts VCTIP.EXE, which outlives the build inside the held Job and
    forces strict cleanup failure (KI-0137). Link with the exact toolchain's
    own lld-link and compile build-time C/C++ (vswhom-sys under
    embed-resource) with one LLVM installation's clang-cl and llvm-lib.
    """
    linker = tools.get("rust_lld")
    rustc = tools.get("rustc_real")
    if (
        linker is None
        or rustc is None
        or linker.name.lower() != "rust-lld.exe"
        or not linker.resolve().is_relative_to(rustc.resolve().parents[1])
    ):
        raise ValueError("Pinned toolchain rust-lld required")
    compiler = tools.get("clang_cl")
    archiver = tools.get("llvm_lib")
    if (
        compiler is None
        or archiver is None
        or compiler.name.lower() != "clang-cl.exe"
        or archiver.name.lower() != "llvm-lib.exe"
        or compiler.resolve().parent != archiver.resolve().parent
    ):
        raise ValueError("Pinned LLVM clang-cl and llvm-lib required")
    return {
        "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER": str(linker),
        "CC_x86_64_pc_windows_msvc": str(compiler),
        "CXX_x86_64_pc_windows_msvc": str(compiler),
        "AR_x86_64_pc_windows_msvc": str(archiver),
    }


def pinned_lock_helper(
    expected: str,
) -> Callable[[Path, Path, Path], dict[str, object]]:
    path = Path(__file__).with_name("wheel_only_runtime_lock.py")
    if sha(path) != expected:
        raise ValueError("Reviewed lock helper changed before import")
    spec = importlib.util.spec_from_file_location("_japp_reviewed_runtime_lock", path)
    if spec is None or spec.loader is None:
        raise ValueError("Pinned helper unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if sha(path) != expected:
        raise ValueError("Reviewed lock helper changed during import")
    make = getattr(module, "make", None)
    if not callable(make):
        raise ValueError("Pinned lock interface missing")
    return cast(Callable[[Path, Path, Path], dict[str, object]], make)


def contained(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


@dataclass(frozen=True)
class _ProjectionRequest:
    checkout: Path
    rows: Mapping[str, str]
    git: Path
    env: Mapping[str, str]
    expected_head: str
    process: ProcessHelper
    deadlines: Budget
    proof: Path
    label: str


def source_projection(request: _ProjectionRequest) -> None:
    checkout, rows, git, env = request.checkout, request.rows, request.git, request.env
    expected_head, process = request.expected_head, request.process
    deadlines, proof, label = request.deadlines, request.proof, request.label
    observed = (
        process.run(
            [str(git), "rev-parse", "HEAD"],
            cwd=checkout,
            env=env,
            stem=proof / (label + "-head"),
            seconds=20,
            deadlines=deadlines,
        )
        .stdout.decode()
        .strip()
    )
    if observed != expected_head:
        raise ValueError("Owned base revision changed")
    status = process.run(
        [str(git), "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        cwd=checkout,
        env=env,
        stem=proof / (label + "-status"),
        seconds=20,
        deadlines=deadlines,
    ).stdout
    for entry in status.split(b"\0"):
        if entry and (
            b"R" in entry[:2]
            or b"C" in entry[:2]
            or entry[3:].decode("utf-8") not in rows
        ):
            raise ValueError("Unbound change outside the selected source overlay")
    for name, expected in rows.items():
        part = PurePosixPath(name)
        if part.is_absolute() or ".." in part.parts or sha(checkout / name) != expected:
            raise ValueError("Reviewed source projection changed: " + name)


def _checked_wheel_name(member: zipfile.ZipInfo, names: set[str]) -> str:
    name = member.filename
    part = PurePosixPath(name)
    if name in names or part.is_absolute() or ".." in part.parts or "\\" in name:
        raise ValueError("Unsafe wheel member")
    names.add(name)
    return name


def wheel_code(wheel: Path, source: Path, namespace: str) -> WheelCodeReceipt:
    expected = {}
    for path in (source / namespace).rglob("*"):
        if "__pycache__" in path.parts or path.suffix == ".pyc" or path.is_dir():
            continue
        if path.is_symlink() or not stat.S_ISREG(path.lstat().st_mode):
            raise ValueError("Package source must be regular")
        expected[path.relative_to(source).as_posix()] = path.read_bytes()
    actual = {}
    names: set[str] = set()
    total = 0
    metadata_prefix = namespace + "-0.0.1.dist-info/"
    metadata_names = {
        metadata_prefix + name for name in ("METADATA", "WHEEL", "RECORD")
    }
    metadata_seen = set()
    with zipfile.ZipFile(wheel) as archive:
        if len(archive.infolist()) > MAX_WHEEL_NODES:
            raise ValueError("Wheel node bound")
        for member in archive.infolist():
            name = _checked_wheel_name(member, names)
            total += member.file_size
            if total > 64 * 1024 * 1024 or member.file_size > 8 * 1024 * 1024:
                raise ValueError("Wheel byte bound")
            mode = member.external_attr >> 16
            if member.is_dir() or stat.S_IFMT(mode) not in {0, stat.S_IFREG}:
                raise ValueError("Wheel member must be a regular file")
            if name.endswith((".so", ".pyd", ".dll", ".dylib")):
                raise ValueError("Pure code input required")
            member_parts = PurePosixPath(name).parts
            if len(member_parts) > 1 and member_parts[0] == namespace:
                actual[name] = archive.read(member)
            elif name in metadata_names:
                metadata_seen.add(name)
            elif not (
                name.startswith(metadata_prefix + "licenses/")
                and name.endswith((".txt", ".md"))
            ):
                raise ValueError("Undeclared wheel install surface")
    if not expected or actual != expected or metadata_seen != metadata_names:
        raise ValueError("Wheel package files differ from exact current source")
    return {
        "wheel_sha256": sha(wheel),
        "source_package_files": len(expected),
        "source_python_files": sum(n.endswith(".py") for n in expected),
        "all_package_file_bytes_equal": True,
        "installer_surface_restricted": True,
    }


COMMAND_SECONDS = {
    "01-python": 20,
    "02-uv": 20,
    "03-node": 20,
    "04-pnpm": 30,
    "05-cargo": 20,
    "06-rustc": 20,
    "06-resolved-cargo": 20,
    "06-resolved-rustc": 20,
    "07-js-install": 300,
    "07-tauri": 30,
    "08-runtime-export": 60,
    "09-native-runtime": 900,
    "10-tauri-package": 900,
    "11-package-stage": 120,
    "11-package-inspect": 120,
    "12-package-inspect": 60,
    "12-pe-app": 20,
    "12-pe-service": 20,
    "12-package-extract": 60,
    "13-package-actor-compile": 660,
    "14-package-actor-catalog": 20,
    "15-package-actor": 45,
}


def pinned_process_helper(expected: str, canonical_root: str) -> ProcessHelper:
    path = Path(__file__).with_name("_native_package_process.py")
    if sha(path) != expected:
        raise ValueError("Native process helper changed before import")
    existing = sys.modules.get("_japp_native_package_ci_process")
    if existing is not None:
        original_path = existing.__file__
        if original_path is None:
            raise ValueError("Pinned native process interface has no source")
        actual = Path(original_path).resolve()
        allowed = Path(canonical_root).resolve() / "scripts/_native_package_process.py"
        if actual != allowed or sha(actual) != expected:
            raise ValueError(
                "CI command owner module differs from pinned original source"
            )
        # One registry/owner for both coordinator and pipeline. A pending native
        # owner cannot be escaped by importing a sibling helper module.
        return _process_interface(existing)
    name = "_japp_native_package_pipeline_process"
    if name in sys.modules:
        raise ValueError("Native process helper module name occupied")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError("Native process helper unavailable")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    if sha(path) != expected:
        raise ValueError("Native process helper changed during import")
    return _process_interface(module)


# Keep the ordered package phases and fail-closed guards in one local ownership
# context. Splitting only to satisfy statement/branch counts obscures that order.
def main(spec_path: Path | None = None) -> None:  # noqa: PLR0912, PLR0915
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", type=Path, required=True)
    if spec_path is None:
        supplied = parser.parse_args().spec
        if not isinstance(supplied, Path):
            raise ValueError("Native spec path is not a Path")
        spec_path = supplied
    spec_path = Path(spec_path)
    spec = _pipeline_spec(json.loads(spec_path.read_text(encoding="utf-8")))
    for name in (
        "native_package_pipeline.py",
        "wheel_only_runtime_lock.py",
        "package_validation.rs",
        "_native_package_process.py",
    ):
        if sha(Path(__file__).with_name(name)) != spec["proposal_bindings"][name]:
            raise ValueError("Reviewed proposal source changed")
    make = pinned_lock_helper(spec["proposal_bindings"]["wheel_only_runtime_lock.py"])
    process = pinned_process_helper(
        spec["proposal_bindings"]["_native_package_process.py"], spec["canonical_root"]
    )
    deadlines = spec["deadlines"]
    process._validate_budget(deadlines)
    canonical = Path(spec["canonical_root"]).resolve()
    checkout = Path(spec["owned_checkout"]).resolve()
    output = Path(spec["output"]).resolve()
    if (
        contained(checkout, canonical)
        or contained(canonical, checkout)
        or contained(output, canonical)
        or contained(output, checkout)
    ):
        raise ValueError(
            "Use a separate disposable checkout and outside proof directory"
        )
    if not checkout.is_dir() or output.exists():
        raise ValueError("Owned checkout/fresh output required")
    preflight_proof = Path(spec["preflight_proof"])
    if (
        not preflight_proof.is_absolute()
        or not preflight_proof.is_dir()
        or contained(preflight_proof, canonical)
        or contained(preflight_proof, checkout)
    ):
        raise ValueError("Owned outside preflight proof required")
    target = spec["target"]
    if target == "x86_64-pc-windows-msvc":
        if platform.system() != "Windows" or platform.machine().lower() not in {
            "amd64",
            "x86_64",
        }:
            raise ValueError("Native Windows x64 required")
        builder = "build-windows-runtime.py"
        overlay = "windows-local.config.json"
    elif target == "x86_64-unknown-linux-gnu":
        release = platform.freedesktop_os_release()
        if (
            platform.system() != "Linux"
            or platform.machine().lower() != "x86_64"
            or release.get("ID") != "ubuntu"
            or release.get("VERSION_ID") != "24.04"
        ):
            raise ValueError("Native Ubuntu24.04 x64 required")
        builder = "build-linux-service-runtime.py"
        overlay = "ubuntu-local.config.json"
    else:
        raise ValueError("Unsupported target")
    tools = {name: bind_tool(row) for name, row in spec["tools"].items()}
    if Path(sys.executable).resolve() != tools["python"].resolve():
        raise ValueError("Coordinator interpreter differs from its native tool pin")
    if not {
        "python",
        "uv",
        "node",
        "pnpm_js",
        "build_pnpm",
        "cargo",
        "rustc",
        "cargo_real",
        "rustc_real",
        "rustup",
        "git",
    } <= set(tools):
        raise ValueError("Exact native tool pins required")
    if target.endswith("windows-msvc") and "dumpbin" not in tools:
        raise ValueError("Pinned native PE inspection tool required")
    windows_tools = (
        windows_build_tools(tools) if target.endswith("windows-msvc") else {}
    )
    if target.endswith("linux-gnu") and "dpkg_deb" not in tools:
        raise ValueError("Pinned native Debian extraction tool required")
    env = dict(spec["build_environment"])
    if (
        set(env) - ENV_KEYS
        or "PATH" not in env
        or not ("HOME" in env or "USERPROFILE" in env)
    ):
        raise ValueError(
            "Curated build environment including Git home context required"
        )
    hook = shutil.which("pnpm", path=env["PATH"])
    if hook is None or Path(hook).resolve() != tools["build_pnpm"].resolve():
        raise ValueError("Tauri hook pnpm resolver differs from pinned wrapper")
    for name in ("node", "cargo", "rustc", "rustup"):
        actual = shutil.which(name, path=env["PATH"])
        if actual is None or Path(actual).resolve() != tools[name].resolve():
            raise ValueError("Native child PATH resolver differs: " + name)
    if platform.system() == "Windows":
        sibling = Path(hook).parent / "node.exe"
        if sibling.exists() and sibling.resolve() != tools["node"].resolve():
            raise ValueError("pnpm wrapper sibling Node differs")
    source_projection(
        _ProjectionRequest(
            checkout,
            spec["source_projection"],
            tools["git"],
            env,
            spec["expected_git_head"],
            process,
            deadlines,
            Path(spec["preflight_proof"]),
            "initial",
        )
    )
    bind(spec["host_inventory_reference"])
    contracts = bind(spec["contracts_wheel"])
    service = bind(spec["orchestrator_wheel"])
    wheels = {
        "contracts": wheel_code(
            contracts,
            checkout / "packages/contracts/generated/python/src",
            "japp_contracts",
        ),
        "orchestrator": wheel_code(
            service, checkout / "services/orchestrator/src", "orchestrator"
        ),
    }
    output.mkdir()
    (output / "temp").mkdir()
    shutil.copy2(
        Path(__file__).with_name("_native_package_process.py"),
        output / "owned-command-helper.py",
    )
    env.update(
        TMPDIR=str(output / "temp"),
        TEMP=str(output / "temp"),
        TMP=str(output / "temp"),
        CARGO_BUILD_JOBS="2",
        CARGO_TARGET_DIR=str(output / "target"),
        RUSTC=str(tools["rustc_real"]),
    )
    env.update(windows_tools)
    dump(
        output / "upfront.json",
        {
            "scope": (
                "Development package plus package-extract"
                "ed service experiment; no GUI certificat"
                "ion"
            ),
            "coordinator_sha256": sha(Path(__file__)),
            "spec_sha256": sha(spec_path),
            "source_projection": spec["source_projection"],
            "target": target,
            "tools": spec["tools"],
            "environment": env,
            "wheel_code": wheels,
            "host": {
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
            },
            "host_inventory_reference": spec["host_inventory_reference"],
            "gui_claim": False,
        },
    )
    records: list[dict[str, object]] = []

    def run(
        label: str,
        argv: Sequence[str | Path],
        cwd: Path = checkout,
        extra_env: Mapping[str, str] | None = None,
    ) -> bytes:
        for role in tools:
            bind_tool(spec["tools"][role])
        selected = {**env, **(extra_env or {})}
        try:
            child = process.run(
                [str(x) for x in argv],
                cwd=cwd,
                env=selected,
                stem=output / label,
                seconds=COMMAND_SECONDS[label],
                deadlines=deadlines,
            )
        finally:
            result_path = output / (label + ".result.json")
            if result_path.exists():
                row = _record(json.loads(result_path.read_text()))
                row.update(label=label, seconds=row["seconds_elapsed"])
                records.append(row)
                dump(output / "commands.json", records)
            for role in tools:
                bind_tool(spec["tools"][role])
        return child.stdout

    python, uv, node, cargo, rustc = [
        tools[n] for n in ("python", "uv", "node", "cargo", "rustc")
    ]
    pnpm: list[str | Path] = [node, tools["pnpm_js"]]
    if run("01-python", [python, "--version"]).strip() != b"Python 3.12.13":
        raise ValueError("Python pin")
    if not run("02-uv", [uv, "--version"]).startswith(b"uv 0.11.32 "):
        raise ValueError("uv pin")
    if run("03-node", [node, "--version"]).strip() != b"v24.18.0":
        raise ValueError("Node pin")
    if run("04-pnpm", [*pnpm, "--version"]).strip() != b"11.17.0":
        raise ValueError("pnpm pin")
    if not run("05-cargo", [cargo, "--version"]).startswith(b"cargo 1.97.1 "):
        raise ValueError("Cargo pin")
    if not run("06-rustc", [rustc, "--version"]).startswith(b"rustc 1.97.1 "):
        raise ValueError("rustc pin")
    for role in ("cargo", "rustc"):
        selected = (
            run("06-resolved-" + role, [tools["rustup"], "which", role])
            .decode("utf-8")
            .strip()
        )
        if Path(selected).resolve() != tools[role + "_real"].resolve():
            raise ValueError("Active Rust toolchain image differs")
    run("07-js-install", [*pnpm, "install", "--frozen-lockfile"])
    if (
        run(
            "07-tauri",
            [*pnpm, "--filter", "@japp/desktop", "exec", "tauri", "--version"],
        ).strip()
        != b"tauri-cli 2.12.3"
    ):
        raise ValueError("Tauri CLI pin")
    exported = output / "runtime-export.txt"
    run(
        "08-runtime-export",
        [
            uv,
            "export",
            "--locked",
            "--no-dev",
            "--no-emit-workspace",
            "--format",
            "requirements-txt",
            "--output-file",
            exported,
        ],
    )
    runtime_lock = output / "runtime-wheels.requirements.lock"
    dump(
        output / "runtime-lock-receipt.json",
        make(checkout / "uv.lock", exported, runtime_lock),
    )
    runtime = checkout / "apps/desktop/src-tauri/runtime-payload"
    command: list[str | Path] = [
        python,
        checkout / "scripts" / builder,
        "--contracts-wheel",
        contracts,
        "--contracts-sha256",
        sha(contracts),
        "--orchestrator-wheel",
        service,
        "--orchestrator-sha256",
        sha(service),
        "--runtime-requirements",
        runtime_lock,
        "--runtime-requirements-sha256",
        sha(runtime_lock),
        "--python",
        python,
        "--uv",
        uv,
        "--work-dir",
        output / "runtime-build",
        "--destination",
        runtime,
        "--target",
        target,
    ]
    run("09-native-runtime", command)
    # The separately proposed builder patch verifies copied input pins
    # before any command.
    copied = output / "runtime-build/inputs"
    for source in (contracts, service, runtime_lock):
        if sha(source) != sha(copied / source.name):
            raise ValueError("Retained builder input changed")
    manifest_pin = sha(runtime / "manifest.json")
    build: list[str | Path] = [
        *pnpm,
        "--filter",
        "@japp/desktop",
        "exec",
        "tauri",
        "build",
        "--debug",
        "--config",
        checkout / "packaging" / overlay,
        "--ci",
    ]
    if target.endswith("linux-gnu"):
        build += ["--bundles", "deb"]
    run("10-tauri-package", [*build, "--", "--locked"])
    descriptors = list(
        (output / "target/debug/build").glob("japp-desktop-*/out/runtime_descriptor.rs")
    )
    if not descriptors:
        raise ValueError("Actual compile-bound descriptor missing")
    descriptor_records = []
    for index, path in enumerate(descriptors):
        text = path.read_text(encoding="utf-8")
        for field, value in [
            ("manifest_sha256", manifest_pin),
            (
                "executable_sha256",
                sha(
                    runtime
                    / (
                        "japp-orchestrator/japp-orchestrator.exe"
                        if target.endswith("windows-msvc")
                        else "japp-orchestrator/japp-orchestrator"
                    )
                ),
            ),
        ]:
            match = re.search(field + r":\s*\[([^\]]+)\]", text)
            if (
                match is None
                or bytes(
                    int(part.strip())
                    for part in match.group(1).split(",")
                    if part.strip()
                ).hex()
                != value
            ):
                raise ValueError(
                    "Generated shipping descriptor differs from staged runtime"
                )
        retained = output / ("shipping-runtime-descriptor-" + str(index) + ".rs")
        shutil.copy2(path, retained)
        descriptor_records.append(
            {"original": str(path), "retained": str(retained), "sha256": sha(retained)}
        )
    dump(output / "shipping-descriptors.json", descriptor_records)
    if target.endswith("windows-msvc"):
        portable = output / "portable"
        run(
            "11-package-stage",
            [
                python,
                checkout / "scripts/windows_package.py",
                "stage",
                "--application",
                output / "target/debug/japp-desktop.exe",
                "--runtime",
                runtime,
                "--destination",
                portable,
                "--runtime-manifest-sha256",
                manifest_pin,
            ],
        )
        run(
            "12-package-inspect",
            [
                python,
                checkout / "scripts/windows_package.py",
                "inspect",
                "--root",
                portable,
                "--receipt",
                output / "portable-inspection.json",
            ],
        )
        for role, image in [
            ("app", portable / "desktop.exe"),
            ("service", portable / "runtime/japp-orchestrator/japp-orchestrator.exe"),
        ]:
            run(
                "12-pe-" + role,
                [tools["dumpbin"], "/headers", "/dependents", "/imports", image],
            )
        packaged_runtime = portable / "runtime"
        package = portable
    else:
        packages = list((output / "target/debug/bundle/deb").glob("*.deb"))
        if len(packages) != 1:
            raise ValueError("Exactly one fresh Debian package required")
        package = packages[0]
        run(
            "11-package-inspect",
            [
                python,
                checkout / "scripts/linux_package.py",
                "--package",
                package,
                "--staged-runtime",
                runtime,
                "--compiled-manifest-sha256",
                manifest_pin,
                "--output",
                output / "deb-inspection",
            ],
        )
        # No dpkg installation or host filesystem changes: inspect before extraction.
        run(
            "12-package-extract",
            [tools["dpkg_deb"], "--extract", package, output / "extracted"],
        )
        packaged_runtime = output / "extracted/usr/lib/Desktop App/runtime"
    entry = packaged_runtime / (
        "japp-orchestrator/japp-orchestrator.exe"
        if target.endswith("windows-msvc")
        else "japp-orchestrator/japp-orchestrator"
    )
    pins = output / "package-probe-input.json"
    dump(
        pins,
        {
            "target": target,
            "runtime_root": str(packaged_runtime.resolve()),
            "manifest_sha256": manifest_pin,
            "entrypoint_sha256": sha(entry),
        },
    )
    source_projection(
        _ProjectionRequest(
            checkout,
            spec["source_projection"],
            tools["git"],
            env,
            spec["expected_git_head"],
            process,
            deadlines,
            output,
            "shipping",
        )
    )
    # This additive cfg(test) derivative is applied only AFTER
    # the shipping package build.
    module = checkout / "apps/desktop/src-tauri/src/service/mod.rs"
    module.write_bytes(
        module.read_bytes() + b"\n#[cfg(test)]\nmod package_validation;\n"
    )
    actor = Path(__file__).with_name("package_validation.rs")
    destination = module.with_name("package_validation.rs")
    if destination.exists():
        raise ValueError("Existing package actor source")
    shutil.copy2(actor, destination)
    dump(
        output / "actor-derivative.json",
        {
            "shipping_source_projection": spec["source_projection"],
            "added_source_sha256": sha(destination),
            "module_after_sha256": sha(module),
            "module_before_sha256": spec["source_projection"][
                "apps/desktop/src-tauri/src/service/mod.rs"
            ],
            "production_test_bodies_changed": 0,
            "shipping_build_precedes_test_derivative": True,
        },
    )
    exact = (
        "service::package_validation::packaged_runtime_health_auth_and_owned_cleanup"
    )
    run(
        "13-package-actor-compile",
        [
            cargo,
            "test",
            "--locked",
            "--manifest-path",
            checkout / "apps/desktop/src-tauri/Cargo.toml",
            "--lib",
            "--features",
            "custom-protocol",
            "--no-run",
            "--message-format=json",
        ],
        extra_env={"JAPP_PACKAGE_PROBE_INPUT": str(pins)},
    )
    messages = [
        _record(json.loads(line))
        for line in (output / "13-package-actor-compile.stdout")
        .read_text()
        .splitlines()
        if line.startswith("{")
    ]
    executables: list[Path] = []
    for message in messages:
        target_record = message.get("target", {})
        if (
            message.get("reason") == "compiler-artifact"
            and message.get("executable")
            and _record(target_record).get("name") == "japp_desktop"
        ):
            executables.append(Path(_text(message["executable"])))
    if len(executables) != 1:
        raise ValueError("Exact compiled actor image required")
    helper = executables[0]
    dump(
        output / "actor-image.json",
        {
            "path": str(helper),
            "sha256": sha(helper),
            "source_sha256": sha(actor),
            "package_runtime_manifest": manifest_pin,
        },
    )
    catalog = run("14-package-actor-catalog", [helper, "--list"])
    if catalog.decode("utf-8").splitlines().count(exact + ": test") != 1:
        raise ValueError(
            "Exact package actor absent or duplicated in actual compiled catalog"
        )
    execution = run(
        "15-package-actor",
        [helper, exact, "--exact", "--nocapture", "--test-threads=1"],
        extra_env={"JAPP_PACKAGE_PROBE_INPUT": str(pins)},
    )
    if not re.search(rb"^running 1 test$", execution, re.MULTILINE) or not re.search(
        (
            b"^test result: ok\\. 1 passed; 0 failed; 0"
            b" ignored; 0 measured; [0-9]+ filtered ou"
            b"t;"
        ),
        execution,
        re.MULTILINE,
    ):
        raise ValueError("Exactly one ordinary selected actor result required")
    actor_stderr = (output / "15-package-actor.stderr").read_text()
    if (
        "PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1" not in actor_stderr
        or "PACKAGE_OWNED_CLEANUP success=true" not in actor_stderr
        or "PACKAGE_OWNED_CLEANUP_FAILURE" in actor_stderr
    ):
        raise ValueError("Actual same-owner cleanup and actor markers required")
    image_record = _record(json.loads((output / "actor-image.json").read_text()))
    if sha(helper) != _text(image_record["sha256"]):
        raise ValueError("Actor image changed")
    derivative = {
        **spec["source_projection"],
        "apps/desktop/src-tauri/src/service/mod.rs": sha(module),
        "apps/desktop/src-tauri/src/service/package_validation.rs": sha(destination),
    }
    source_projection(
        _ProjectionRequest(
            checkout,
            derivative,
            tools["git"],
            env,
            spec["expected_git_head"],
            process,
            deadlines,
            output,
            "derivative",
        )
    )
    dump(
        output / "closure.json",
        {
            "status": "BUILD_STATIC_AND_PACKAGE_SERVICE_ACTOR_PASS_GUI_PENDING",
            "target": target,
            "runtime_manifest_sha256": manifest_pin,
            "package": str(package),
            "package_sha256": sha(package) if package.is_file() else None,
            "commands": len(records),
            "command_ledger_scope": (
                "Recipe commands only; six source-project"
                "ion Git commands have separate bounded r"
                "eceipts"
            ),
            "owned_process_helper_sha256": spec["proposal_bindings"][
                "_native_package_process.py"
            ],
            "whole_deadlines": dict(deadlines),
            "package_service_actor_cases": 1,
            "app_gui_cases": 0,
            "native_platform_certified": False,
            "installed_package_evidence": False,
            "windows_installer_produced": False,
            "no_owner_approval_gate_added": True,
        },
    )


if __name__ == "__main__":
    main()
