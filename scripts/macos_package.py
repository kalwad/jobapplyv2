"""Static macOS package inspection; never launches the app or service."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import plistlib
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import TypedDict

MAX_BYTES = 512 * 1024 * 1024
MAX_FILES = 4096
MAX_NODES = 8192
MAX_DEPTH = 32
MAX_SECONDS = 30
MAX_PATH_BYTES = 1024
HASH_HEX_LENGTH = 64
MAX_SYSTEM_TOOL_ENTRIES = 16


class FileRecord(TypedDict):
    path: str
    bytes: int
    sha256: str


def inventory(root: Path) -> list[FileRecord]:
    if not root.is_absolute() or root.is_symlink() or not root.is_dir():
        raise ValueError("Invalid package inventory root")
    deadline = time.monotonic() + MAX_SECONDS
    pending = [(root, 0)]
    records: list[FileRecord] = []
    total = 0
    nodes = 0
    while pending:
        directory, depth = pending.pop()
        if depth > MAX_DEPTH:
            raise ValueError("Package directory depth exceeds bound")
        for path in directory.iterdir():
            nodes += 1
            if nodes > MAX_NODES or time.monotonic() >= deadline:
                raise ValueError("Package inventory exceeds bound")
            metadata = path.lstat()
            if path.is_symlink():
                raise ValueError("Symlinked package path")
            if stat.S_ISDIR(metadata.st_mode):
                pending.append((path, depth + 1))
                continue
            if not stat.S_ISREG(metadata.st_mode):
                raise ValueError("Nonregular package file")
            total += metadata.st_size
            if total > MAX_BYTES or len(records) >= MAX_FILES:
                raise ValueError("Package inventory exceeds bound")
            digest = hash_checked(path, metadata, deadline)
            records.append(
                {
                    "path": path.relative_to(root).as_posix(),
                    "bytes": metadata.st_size,
                    "sha256": digest,
                }
            )
    return sorted(records, key=lambda record: record["path"])


def hash_checked(path: Path, metadata: os.stat_result, deadline: float) -> str:
    digest = hashlib.sha256()
    read = 0
    with path.open("rb") as source:
        opened = os.fstat(source.fileno())
        if (opened.st_dev, opened.st_ino) != (metadata.st_dev, metadata.st_ino):
            raise ValueError("Changed package file")
        while chunk := source.read(min(16384, metadata.st_size + 1 - read)):
            read += len(chunk)
            if read > metadata.st_size or time.monotonic() >= deadline:
                raise ValueError("Growing package file or deadline exceeded")
            digest.update(chunk)
        for final in [os.fstat(source.fileno()), path.lstat()]:
            if (read, final.st_size, final.st_mtime_ns, final.st_dev, final.st_ino) != (
                metadata.st_size,
                metadata.st_size,
                metadata.st_mtime_ns,
                metadata.st_dev,
                metadata.st_ino,
            ) or not stat.S_ISREG(final.st_mode):
                raise ValueError("Changed package file")
    return digest.hexdigest()


def declared_runtime_files(staged: Path, expected_hash: str) -> list[FileRecord]:
    path = staged / "manifest.json"
    before = path.lstat()
    maximum = 512 * 1024
    if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
        raise ValueError("Compile-bound manifest mismatch")
    with path.open("rb") as source:
        raw = source.read(maximum + 1)
    after = path.lstat()
    if (
        len(raw) > maximum
        or hashlib.sha256(raw).hexdigest() != expected_hash
        or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
        != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
        or not stat.S_ISREG(after.st_mode)
    ):
        raise ValueError("Compile-bound manifest mismatch")
    payload = json.loads(raw)
    if not isinstance(payload, dict) or not isinstance(payload.get("files"), list):
        raise ValueError("Declared runtime files differ")
    records: list[FileRecord] = []
    names: set[str] = set()
    for row in payload["files"]:
        if not isinstance(row, dict) or set(row) != {"path", "bytes", "sha256"}:
            raise ValueError("Declared runtime files differ")
        name, length, digest = row["path"], row["bytes"], row["sha256"]
        if (
            not isinstance(name, str)
            or not name
            or len(name) > MAX_PATH_BYTES
            or any(part in name for part in ["\\", ":"])
            or any(part in {"", ".", ".."} for part in name.split("/"))
            or name == "manifest.json"
            or name in names
            or type(length) is not int
            or length < 0
            or length > MAX_BYTES
            or not isinstance(digest, str)
            or len(digest) != HASH_HEX_LENGTH
            or any(character not in "0123456789abcdef" for character in digest)
            or len(records) >= MAX_FILES
        ):
            raise ValueError("Declared runtime files differ")
        names.add(name)
        records.append({"path": name, "bytes": length, "sha256": digest})
    return sorted(records, key=lambda record: record["path"])


def main_executable_mode(path: Path) -> int:
    """Default inspection uses actual native metadata, including execute bits."""
    return path.stat().st_mode


def inspect_package(app: Path, staged: Path, manifest_sha256: str) -> dict[str, object]:
    app_files = inventory(app)
    stage_files = inventory(staged)
    runtime = app / "Contents/Resources/runtime"
    bundled_files = inventory(runtime)
    expected = next(
        (row for row in stage_files if row["path"] == "manifest.json"), None
    )
    observed = next(
        (row for row in bundled_files if row["path"] == "manifest.json"), None
    )
    if (
        expected is None
        or observed is None
        or expected["sha256"] != manifest_sha256
        or observed["sha256"] != manifest_sha256
    ):
        raise ValueError("Compile-bound manifest mismatch")
    if {row["path"] for row in stage_files} != {row["path"] for row in bundled_files}:
        raise ValueError("Runtime inventory differs")
    if stage_files != bundled_files:
        raise ValueError("Runtime bytes differ")
    declared = declared_runtime_files(staged, manifest_sha256)
    if declared != [row for row in stage_files if row["path"] != "manifest.json"]:
        raise ValueError("Declared runtime files differ")
    raw_info = app / "Contents/Info.plist"
    if raw_info.stat().st_size > 512 * 1024:
        raise ValueError("Invalid bundle metadata")
    info = plistlib.loads(raw_info.read_bytes())
    if not isinstance(info, dict):
        raise ValueError("Invalid bundle metadata")
    name = info.get("CFBundleExecutable")
    if (
        not isinstance(name, str)
        or not name
        or name in {".", ".."}
        or any(part in name for part in ["/", "\\", ":"])
    ):
        raise ValueError("Invalid main executable")
    main = app / "Contents/MacOS" / name
    if (
        not main.is_file()
        or main.is_symlink()
        or not main_executable_mode(main) & 0o111
    ):
        raise ValueError("Invalid main executable")
    if (
        info.get("CFBundleIdentifier") != "dev.jobapply.desktop"
        or info.get("LSMinimumSystemVersion") != "14.0"
    ):
        raise ValueError("Bundle platform identity differs")
    return {
        "status": "STATIC_BYTES_PASS_SIGNATURE_AND_LIFECYCLE_PENDING",
        "app": str(app),
        "runtime_manifest_sha256": manifest_sha256,
        "main_executable": str(main),
        "files": app_files,
        "runtime_files": bundled_files,
        "stage_files": stage_files,
    }


def ensure_snapshot(
    result: dict[str, object],
    app_files: list[FileRecord],
    stage_files: list[FileRecord],
) -> None:
    if (
        result["files"] != app_files
        or result["stage_files"] != stage_files
        or result["runtime_files"] != stage_files
    ):
        raise ValueError("Package changed during semantic inspection")


def absolute_inspector_path(value: str, current: Path) -> Path:
    normalized = value.replace(os.altsep, os.sep) if os.altsep else value
    candidate = Path(value)
    if (
        not value
        or len(os.fsencode(value)) > 32 * 1024
        or not candidate.is_absolute()
        or any(part in {".", ".."} for part in normalized.split(os.sep))  # noqa: PTH206 - reject raw dot components before pathlib normalizes them.
    ):
        raise ValueError("Invalid system inspector search")
    resolved = candidate.resolve()
    if resolved == current:
        raise ValueError("Invalid system inspector search")
    return resolved


def system_signature_tool() -> tuple[str, dict[str, str]]:
    """Resolve only absolute OS-default locations, never ambient PATH or CWD."""
    entries = os.defpath.split(os.pathsep)
    if not entries or len(entries) > MAX_SYSTEM_TOOL_ENTRIES:
        raise ValueError("Invalid system inspector search")
    current = Path.cwd().resolve()
    # Validate the entire list before any lookup, including later bad entries.
    directories = [absolute_inspector_path(entry, current) for entry in entries]
    search = os.pathsep.join(str(directory) for directory in directories)
    for directory in directories:
        # An absolute command avoids shutil.which's Windows CWD-prepend rules.
        found = shutil.which(str(directory / "codesign"), path=search)
        if found is None:
            continue
        selected = absolute_inspector_path(found, current)
        if selected.parent != directory or selected.name != "codesign":
            raise ValueError("Invalid system inspector result")
        return str(selected), {"PATH": search}
    raise ValueError("Invalid system inspector unavailable")


def signature_inspection(app: Path, output: Path) -> dict[str, object]:
    executable, environment = system_signature_tool()
    argv = [executable, "--verify", "--deep", "--strict", str(app)]
    started = datetime.datetime.now(datetime.UTC).isoformat()
    tick = time.monotonic()
    exit_code: int | None = None
    timeout = False
    try:
        command = subprocess.run(  # noqa: S603 - validated system inspector, argv only; no app execution.
            argv,
            capture_output=True,
            timeout=20,
            check=False,
            env=environment,
            cwd=output,
        )
        stdout, stderr = command.stdout, command.stderr
        exit_code = command.returncode
    except subprocess.TimeoutExpired as error:
        stdout, stderr = error.stdout or b"", error.stderr or b""
        timeout = True
    except OSError:
        stdout, stderr = b"", b""
    (output / "codesign.stdout").write_bytes(stdout)
    (output / "codesign.stderr").write_bytes(stderr)
    return {
        "argv": argv,
        "start_utc": started,
        "end_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "seconds": time.monotonic() - tick,
        "exit_code": exit_code,
        "timeout": timeout,
        "stdout_sha256": hashlib.sha256(stdout).hexdigest(),
        "stderr_sha256": hashlib.sha256(stderr).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["app", "staged-runtime", "output"]:
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--compiled-manifest-sha256", required=True)
    args = parser.parse_args()
    if not args.output.is_absolute() or args.output.exists():
        raise ValueError("Inspection output must be fresh and absolute")
    args.output.mkdir(parents=True)
    source = Path(__file__)
    script = source.read_bytes()
    (args.output / "inspector-executed.py").write_bytes(script)
    result: dict[str, object] = {
        "status": "PACKAGE_STATIC_INSPECTION_FAILED",
        "executed_inspector_sha256": hashlib.sha256(script).hexdigest(),
        "bytes_unchanged_during_signature_inspection": False,
    }
    try:
        # Establish immutable comparison baselines before any semantic acceptance.
        before_app = inventory(args.app)
        before_stage = inventory(args.staged_runtime)
        result["baseline_app_files"] = before_app
        result["baseline_stage_files"] = before_stage
        inspected = inspect_package(
            args.app, args.staged_runtime, args.compiled_manifest_sha256
        )
        ensure_snapshot(inspected, before_app, before_stage)
        result.update(inspected)
        result["status"] = "PACKAGE_STATIC_INSPECTION_FAILED"
        command = signature_inspection(args.app, args.output)
        result["signature_inspection"] = command
        # Recheck semantics and all stage/app bytes against the original baselines.
        final = inspect_package(
            args.app, args.staged_runtime, args.compiled_manifest_sha256
        )
        ensure_snapshot(final, before_app, before_stage)
        if source.read_bytes() != script:
            raise ValueError("Inspector source changed during inspection")
        result["files"] = final["files"]
        result["runtime_files"] = final["runtime_files"]
        result["stage_files"] = final["stage_files"]
        result["bytes_unchanged_during_signature_inspection"] = True
        if command["exit_code"] == 0:
            result["status"] = "PACKAGE_STATIC_INSPECTION_PASS_LIFECYCLE_PENDING"
    except (OSError, ValueError, plistlib.InvalidFileException):
        result["status"] = "PACKAGE_STATIC_INSPECTION_FAILED"
        result["bytes_unchanged_during_signature_inspection"] = False
        result["failure"] = "STATIC_VALIDATION_REJECTED"
    (args.output / "inspection.json").write_text(json.dumps(result, indent=2) + "\n")
    sys.stdout.write(str(args.output / "inspection.json") + "\n")
    if result["status"] == "PACKAGE_STATIC_INSPECTION_FAILED":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
