#!/usr/bin/env python3
"""Ubuntu24.04 x64 build-only staging; never a shipping interpreter fallback."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import TypedDict

MAX_BYTES = 512 * 1024 * 1024
MAX_FILES = 1024


class PayloadFile(TypedDict):
    path: str
    bytes: int
    sha256: str


class PayloadManifest(TypedDict):
    schema_version: str
    target: str
    entrypoint: str
    source_inputs: dict[str, str]
    files: list[PayloadFile]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as stream:
        while chunk := stream.read(16384):
            total += len(chunk)
            if total > MAX_BYTES:
                raise ValueError("Build input exceeds size bound")
            digest.update(chunk)
    return digest.hexdigest()


def host_target() -> str:
    machine = platform.machine().lower()
    architecture = {
        "arm64": "aarch64",
        "aarch64": "aarch64",
        "x86_64": "x86_64",
        "amd64": "x86_64",
    }.get(machine)
    system = {
        "Darwin": "apple-darwin",
        "Linux": "unknown-linux-gnu",
        "Windows": "pc-windows-msvc",
    }.get(platform.system())
    if architecture is None or system is None:
        raise ValueError("Unsupported native build host")
    return architecture + "-" + system


def verify_wheel(path: Path, expected: str) -> None:
    if (
        not path.is_absolute()
        or path.is_symlink()
        or not path.is_file()
        or sha256(path) != expected
    ):
        raise ValueError("Frozen wheel identity mismatch")


def prepare_destination(path: Path) -> None:
    if not path.is_absolute() or path.is_symlink():
        raise ValueError("Staging destination must be an absolute owned directory")
    if path.exists() and (
        not path.is_dir()
        or any(
            child.name != ".gitignore" or not child.is_file() or child.is_symlink()
            for child in path.iterdir()
        )
    ):
        raise ValueError("Refusing to replace an existing runtime payload")


def system_default_path(work_dir: Path) -> str:
    entries = os.defpath.split(os.pathsep)
    working_directories = {Path.cwd().resolve(), work_dir.resolve()}
    for entry in entries:
        path = Path(entry)
        if not entry or not path.is_absolute() or path.resolve() in working_directories:
            raise ValueError(
                "System default PATH must contain absolute non-CWD directories only"
            )
    return os.defpath


def write_manifest(root: Path, target: str, sources: dict[str, str]) -> PayloadManifest:
    entries: list[PayloadFile] = []
    total = 0
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("Runtime symlinks are not accepted")
        if path.is_dir():
            continue
        if not stat.S_ISREG(path.stat().st_mode):
            raise ValueError("Runtime contains a nonregular file")
        size = path.stat().st_size
        total += size
        if total > MAX_BYTES or len(entries) >= MAX_FILES:
            raise ValueError("Runtime payload exceeds inventory bounds")
        entries.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": size,
                "sha256": sha256(path),
            }
        )
    entrypoint = "japp-orchestrator/japp-orchestrator" + (
        ".exe" if "windows" in target else ""
    )
    if not any(entry["path"] == entrypoint for entry in entries):
        raise ValueError("Native entrypoint is missing")
    manifest: PayloadManifest = {
        "schema_version": "1.0.0",
        "target": target,
        "entrypoint": entrypoint,
        "source_inputs": sources,
        "files": entries,
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def validate_host(
    target: str, system: str, machine: str, release: dict[str, str]
) -> None:
    if (
        target != "x86_64-unknown-linux-gnu"
        or system != "Linux"
        or machine.lower() not in {"x86_64", "amd64"}
        or release.get("ID") != "ubuntu"
        or release.get("VERSION_ID") != "24.04"
    ):
        raise ValueError("Native Ubuntu24.04 x64 build host is required")


def main() -> None:  # noqa: PLR0912, PLR0915 - ordered six-stage native build coordinator
    parser = argparse.ArgumentParser(description=__doc__)
    for name in [
        "contracts-wheel",
        "orchestrator-wheel",
        "runtime-requirements",
        "python",
        "uv",
        "work-dir",
        "destination",
    ]:
        parser.add_argument("--" + name, required=True, type=Path)
    for name in ["contracts-sha256", "orchestrator-sha256", "target"]:
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--runtime-requirements-sha256")
    args = parser.parse_args()
    validate_host(
        args.target,
        platform.system(),
        platform.machine(),
        platform.freedesktop_os_release(),
    )
    verify_wheel(args.contracts_wheel, args.contracts_sha256)
    verify_wheel(args.orchestrator_wheel, args.orchestrator_sha256)
    for tool in [args.python, args.uv]:
        if not tool.is_absolute() or not tool.is_file():
            raise ValueError("Build tools require explicit absolute paths")
    prepare_destination(args.destination)
    if not args.work_dir.is_absolute() or args.work_dir.exists():
        raise ValueError("Build work directory must be fresh and absolute")
    args.work_dir.mkdir(parents=True)
    builder_bytes = Path(__file__).read_bytes()
    builder_sha256 = hashlib.sha256(builder_bytes).hexdigest()
    (args.work_dir / "builder-executed.py").write_bytes(builder_bytes)
    inputs = args.work_dir / "inputs"
    inputs.mkdir()
    locked = Path(__file__).with_name("linux-service-build-tools.requirements.lock")
    copied = {}
    for name, path in [
        ("contracts_wheel", args.contracts_wheel),
        ("orchestrator_wheel", args.orchestrator_wheel),
        ("runtime_requirements", args.runtime_requirements),
        ("build_requirements", locked),
    ]:
        destination = inputs / path.name
        shutil.copy2(path, destination)
        copied[name] = destination
    sources = {name + "_sha256": sha256(path) for name, path in copied.items()}
    expected_copied = {
        "contracts_wheel_sha256": args.contracts_sha256,
        "orchestrator_wheel_sha256": args.orchestrator_sha256,
    }
    if args.runtime_requirements_sha256 is not None:
        expected_copied["runtime_requirements_sha256"] = (
            args.runtime_requirements_sha256
        )
    if any(sources[name] != value for name, value in expected_copied.items()):
        raise ValueError("Copied build input differs from expected identity")
    env = {
        "PATH": system_default_path(args.work_dir),
        "PYTHONNOUSERSITE": "1",
        "PYTHONHASHSEED": "0",
        "UV_CACHE_DIR": str(args.work_dir / "uv-cache"),
    }
    if os.name == "nt":
        for name in ["SystemRoot", "WINDIR", "TEMP", "TMP"]:
            if name in os.environ:
                env[name] = os.environ[name]
    commands: list[dict[str, object]] = []
    proof = args.work_dir / "build-proof.json"

    def run(label: str, argv: list[str]) -> None:
        tick = time.monotonic()
        record: dict[str, object] = {
            "label": label,
            "argv": argv,
            "cwd": str(args.work_dir),
            "environment": env,
            "start_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        }
        try:
            # Tool paths are explicit and validated; arguments never use a shell.
            result = subprocess.run(  # noqa: S603
                argv,
                cwd=args.work_dir,
                env=env,
                capture_output=True,
                timeout=300,
                check=False,
            )
            stdout, stderr = result.stdout, result.stderr
            record["exit_code"] = result.returncode
        except subprocess.TimeoutExpired as error:
            stdout, stderr = error.stdout or b"", error.stderr or b""
            record.update(exit_code=None, timeout_seconds=300)
        (args.work_dir / (label + ".stdout")).write_bytes(stdout)
        (args.work_dir / (label + ".stderr")).write_bytes(stderr)
        record.update(
            end_utc=datetime.datetime.now(datetime.UTC).isoformat(),
            seconds=time.monotonic() - tick,
            stdout_sha256=hashlib.sha256(stdout).hexdigest(),
            stderr_sha256=hashlib.sha256(stderr).hexdigest(),
        )
        commands.append(record)
        proof.write_text(
            json.dumps(
                {
                    "builder_script_sha256": builder_sha256,
                    "builder_source_copy": "builder-executed.py",
                    "source_inputs": sources,
                    "commands": commands,
                },
                indent=2,
            )
            + "\n"
        )
        if record["exit_code"] != 0:
            raise RuntimeError("Native build command failed: " + label)

    runtime = args.work_dir / "build-env"
    python = runtime / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    run("00-python-pin", [str(args.python), "--version"])
    if (
        args.work_dir / "00-python-pin.stdout"
    ).read_bytes().strip() != b"Python 3.12.13":
        raise RuntimeError("Python build pin mismatch")
    run("00-uv-pin", [str(args.uv), "--version"])
    if not (args.work_dir / "00-uv-pin.stdout").read_bytes().startswith(b"uv 0.11.32 "):
        raise RuntimeError("uv build pin mismatch")
    run("01-venv", [str(args.uv), "venv", "--python", str(args.python), str(runtime)])
    run(
        "02-runtime-install",
        [
            str(args.uv),
            "pip",
            "install",
            "--python",
            str(python),
            "--require-hashes",
            "-r",
            str(copied["runtime_requirements"]),
        ],
    )
    run(
        "03-build-install",
        [
            str(args.uv),
            "pip",
            "install",
            "--python",
            str(python),
            "--require-hashes",
            "-r",
            str(copied["build_requirements"]),
        ],
    )
    run(
        "04-wheels-install",
        [
            str(args.uv),
            "pip",
            "install",
            "--python",
            str(python),
            "--no-deps",
            str(copied["contracts_wheel"]),
            str(copied["orchestrator_wheel"]),
        ],
    )
    run("05-resolved-pins", [str(args.uv), "pip", "freeze", "--python", str(python)])
    entry = args.work_dir / "service_entry.py"
    entry.write_text("from orchestrator.runner import main\nraise SystemExit(main())\n")
    command = [
        str(python),
        "-m",
        "PyInstaller",
        "--onedir",
        "--console",
        "--noupx",
        "--clean",
        "--noconfirm",
        "--name",
        "japp-orchestrator",
        "--distpath",
        str(args.work_dir / "dist"),
        "--workpath",
        str(args.work_dir / "pyinstaller-work"),
        "--specpath",
        str(args.work_dir / "spec"),
        "--copy-metadata",
        "orchestrator",
        "--copy-metadata",
        "japp-contracts",
    ]
    run("06-native-build", [*command, str(entry)])
    stage = args.work_dir / "runtime-stage"
    stage.mkdir()
    shutil.copytree(
        args.work_dir / "dist/japp-orchestrator", stage / "japp-orchestrator"
    )
    (stage / ".gitignore").write_text("*\n!.gitignore\n")
    manifest = write_manifest(stage, args.target, sources)
    prepare_destination(args.destination)
    if args.destination.exists():
        for child in args.destination.iterdir():
            child.unlink()
        args.destination.rmdir()
    shutil.copytree(stage, args.destination)
    (args.work_dir / "staging-result.json").write_text(
        json.dumps(
            {
                "destination": str(args.destination),
                "manifest_sha256": sha256(args.destination / "manifest.json"),
                "entrypoint_sha256": sha256(args.destination / manifest["entrypoint"]),
                "files": len(manifest["files"]),
            },
            indent=2,
        )
        + "\n"
    )
    sys.stdout.write(
        json.dumps(
            {
                "staged": str(args.destination),
                "target": args.target,
                "manifest_sha256": sha256(args.destination / "manifest.json"),
            }
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
