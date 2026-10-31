"""Portable development-folder staging; native execution is a separate proof."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import platform
import shutil
import stat
import struct
import time
from pathlib import Path

TARGET = "x86_64-pc-windows-msvc"
LIMIT = 512 * 1024 * 1024
MAX_FILES = 1024
MAX_NODES = 2048
MAX_DEPTH = 32
MAX_NAME = 1024
HASH_HEX_LENGTH = 64
DOS_HEADER = 64
PE_OFFSET_LIMIT = 4096
PE_HEADER = 94
PE_MACHINE_X64 = 0x8664
PE_OPTIONAL_MINIMUM = 70
PE_MAGIC_64 = 0x20B
CONTROL_BOUND = 32
DOS_STEM = 4


def regular(path: Path) -> None:
    value = path.lstat()
    if (
        not stat.S_ISREG(value.st_mode)
        or getattr(value, "st_file_attributes", 0) & 0x400
    ):
        raise ValueError("Nonregular or reparse input")


def digest(path: Path) -> str:
    regular(path)
    total = 0
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(16384):
            total += len(chunk)
            if total > LIMIT:
                raise ValueError("Input exceeds byte bound")
            value.update(chunk)
    return value.hexdigest()


def pe(path: Path, subsystem: int) -> None:
    regular(path)
    with path.open("rb") as stream:
        header = stream.read(DOS_HEADER)
        if len(header) != DOS_HEADER or header[:2] != b"MZ":
            raise ValueError("Invalid PE image")
        offset = struct.unpack_from("<I", header, 60)[0]
        if offset < DOS_HEADER or offset > PE_OFFSET_LIMIT:
            raise ValueError("Invalid PE offset")
        stream.seek(offset)
        header = stream.read(PE_HEADER)
    if (
        len(header) != PE_HEADER
        or header[:4] != b"PE\0\0"
        or struct.unpack_from("<H", header, 4)[0] != PE_MACHINE_X64
        or struct.unpack_from("<H", header, 20)[0] < PE_OPTIONAL_MINIMUM
        or struct.unpack_from("<H", header, 24)[0] != PE_MAGIC_64
        or struct.unpack_from("<H", header, 92)[0] != subsystem
    ):
        raise ValueError("Wrong PE architecture or subsystem")


def member(name: str) -> str:
    if not name or len(name) > MAX_NAME or not name.isascii() or "\\" in name:
        raise ValueError("Unsafe member name")
    for part in name.split("/"):
        stem = part.split(".", 1)[0].upper()
        if (
            not part
            or part in (".", "..")
            or part.endswith((".", " "))
            or any(ord(c) < CONTROL_BOUND or c in '<>:"|?*' for c in part)
            or stem in ("CON", "PRN", "AUX", "NUL")
            or (
                len(stem) == DOS_STEM
                and stem[:3] in ("COM", "LPT")
                and stem[-1] in "123456789"
            )
        ):
            raise ValueError("Unsafe member name")
    return name.lower()


def inventory(root: Path) -> dict[str, dict[str, object]]:
    initial = root.lstat()
    if (
        not stat.S_ISDIR(initial.st_mode)
        or getattr(initial, "st_file_attributes", 0) & 0x400
    ):
        raise ValueError("Invalid inventory root")
    result: dict[str, dict[str, object]] = {}
    aliases: set[str] = set()
    pending = [(root, 0)]
    total = nodes = 0
    while pending:
        directory, depth = pending.pop()
        if depth > MAX_DEPTH:
            raise ValueError("Inventory depth bound")
        for path in directory.iterdir():
            nodes += 1
            if nodes > MAX_NODES:
                raise ValueError("Inventory node bound")
            info = path.lstat()
            name = path.relative_to(root).as_posix()
            key = member(name)
            if (
                key in aliases
                or stat.S_ISLNK(info.st_mode)
                or getattr(info, "st_file_attributes", 0) & 0x400
            ):
                raise ValueError("Invalid inventory alias or reparse member")
            aliases.add(key)
            if stat.S_ISDIR(info.st_mode):
                pending.append((path, depth + 1))
                continue
            regular(path)
            total += info.st_size
            if total > LIMIT or len(result) >= MAX_FILES:
                raise ValueError("Inventory byte/file bound")
            result[name] = {"bytes": info.st_size, "sha256": digest(path)}
    return result


def unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate manifest field")
        result[key] = value
    return result


def read_json(path: Path) -> dict[str, object]:
    regular(path)
    if path.stat().st_size > 512 * 1024:
        raise ValueError("Manifest byte bound")
    value: object = json.loads(
        path.read_text(encoding="utf-8"), object_pairs_hook=unique
    )
    if not isinstance(value, dict):
        raise ValueError("Invalid manifest")
    return value


def runtime(root: Path, expected: str) -> dict[str, dict[str, object]]:
    manifest_path = root / "manifest.json"
    if digest(manifest_path) != expected:
        raise ValueError("Compile-bound manifest mismatch")
    manifest = read_json(manifest_path)
    if (
        set(manifest)
        != {"schema_version", "target", "entrypoint", "source_inputs", "files"}
        or manifest["schema_version"] != "1.0.0"
        or manifest["target"] != TARGET
        or manifest["entrypoint"] != "japp-orchestrator/japp-orchestrator.exe"
    ):
        raise ValueError("Invalid runtime manifest")
    sources = manifest["source_inputs"]
    if (
        not isinstance(sources, dict)
        or set(sources)
        != {
            "orchestrator_wheel_sha256",
            "contracts_wheel_sha256",
            "runtime_requirements_sha256",
            "build_requirements_sha256",
        }
        or not all(
            isinstance(h, str)
            and len(h) == HASH_HEX_LENGTH
            and all(c in "0123456789abcdef" for c in h)
            for h in sources.values()
        )
    ):
        raise ValueError("Invalid source manifest")
    files = manifest["files"]
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_FILES:
        raise ValueError("Invalid inventory manifest")
    declared: dict[str, dict[str, object]] = {}
    aliases: set[str] = set()
    for row in files:
        if (
            not isinstance(row, dict)
            or set(row) != {"path", "bytes", "sha256"}
            or not isinstance(row["path"], str)
            or type(row["bytes"]) is not int
            or not 0 <= row["bytes"] <= LIMIT
            or not isinstance(row["sha256"], str)
            or len(row["sha256"]) != HASH_HEX_LENGTH
            or any(c not in "0123456789abcdef" for c in row["sha256"])
        ):
            raise ValueError("Invalid inventory row")
        name = row["path"]
        key = member(name)
        if key in aliases or name == "manifest.json":
            raise ValueError("Invalid inventory duplicate")
        aliases.add(key)
        declared[name] = {"bytes": row["bytes"], "sha256": row["sha256"]}
    actual = inventory(root)
    actual.pop("manifest.json", None)
    if actual != declared:
        raise ValueError("Runtime inventory mismatch")
    pe(root / "japp-orchestrator/japp-orchestrator.exe", 3)
    return inventory(root)


def stage(
    application: Path, payload: Path, destination: Path, expected: str
) -> dict[str, object]:
    if (
        not all(p.is_absolute() for p in (application, payload, destination))
        or destination.exists()
        or destination.is_symlink()
    ):
        raise ValueError("Destination must be fresh and absolute")
    pe(application, 2)
    application_hash = digest(application)
    original = runtime(payload, expected)
    destination.mkdir(parents=True)
    shutil.copy2(application, destination / "desktop.exe")
    shutil.copytree(payload, destination / "runtime")
    if (
        digest(destination / "desktop.exe") != application_hash
        or runtime(destination / "runtime", expected) != original
    ):
        raise ValueError("Inputs changed during staging")
    result: dict[str, object] = {
        "schema_version": "1.0.0",
        "target": TARGET,
        "application": "desktop.exe",
        "runtime_manifest_sha256": expected,
        "files": inventory(destination),
    }
    (destination / "build-manifest.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    inspect(destination)
    return result


def inspect(root: Path) -> None:
    before = inventory(root)
    value = read_json(root / "build-manifest.json")
    if (
        set(value)
        != {
            "schema_version",
            "target",
            "application",
            "runtime_manifest_sha256",
            "files",
        }
        or value["schema_version"] != "1.0.0"
        or value["target"] != TARGET
        or value["application"] != "desktop.exe"
        or not isinstance(value["runtime_manifest_sha256"], str)
    ):
        raise ValueError("Invalid build manifest")
    expected = dict(before)
    expected.pop("build-manifest.json", None)
    if value["files"] != expected:
        raise ValueError("Build inventory mismatch")
    pe(root / "desktop.exe", 2)
    runtime(root / "runtime", value["runtime_manifest_sha256"])
    if inventory(root) != before:
        raise ValueError("Package changed during inspection")


def inspect_with_receipt(root: Path, receipt: Path) -> None:
    if (
        not receipt.is_absolute()
        or receipt.exists()
        or receipt.is_symlink()
        or receipt.resolve().is_relative_to(root.resolve())
    ):
        raise ValueError("Fresh inspection receipt outside package required")
    source_path = receipt.with_suffix(".inspector.py")
    if source_path.exists() or source_path.is_symlink():
        raise ValueError("Fresh inspector source copy required")
    source = Path(__file__).read_bytes()
    source_hash = hashlib.sha256(source).hexdigest()
    receipt.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_bytes(source)
    started = time.monotonic()
    result: dict[str, object] = {
        "result": "FAILED",
        "reason": "INVALID_BUILD",
        "source_sha256": source_hash,
        "started_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "native_lifecycle_or_signature_proof": False,
    }
    try:
        inspect(root)
        if Path(__file__).read_bytes() != source or source_path.read_bytes() != source:
            raise ValueError("Inspector source changed")
        result.update(result="PASS", reason="INVENTORY_VERIFIED")
    except (OSError, ValueError, RecursionError):
        raise ValueError("Build inventory inspection rejected") from None
    finally:
        result.update(
            finished_utc=datetime.datetime.now(datetime.UTC).isoformat(),
            elapsed_seconds=time.monotonic() - started,
        )
        receipt.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="operation", required=True)
    create = sub.add_parser("stage")
    for key in ("application", "runtime", "destination"):
        create.add_argument("--" + key, type=Path, required=True)
    create.add_argument("--runtime-manifest-sha256", required=True)
    check = sub.add_parser("inspect")
    check.add_argument("--root", type=Path, required=True)
    check.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    if platform.system() != "Windows" or platform.machine().lower() not in (
        "amd64",
        "x86_64",
    ):
        raise ValueError("Native Windows x64 host required")
    if args.operation == "stage":
        stage(
            args.application,
            args.runtime,
            args.destination,
            args.runtime_manifest_sha256,
        )
    else:
        inspect_with_receipt(args.root, args.receipt)


if __name__ == "__main__":
    main()
