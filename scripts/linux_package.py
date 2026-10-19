"""Bounded static Ubuntu Debian inspection. Never installs or launches payloads."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import io
import json
import re
import struct
import sys
import tarfile
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import TypedDict, cast

MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_NODES = 8192
MAX_FILES = 4096
MAX_DEPTH = 32
MAX_DYNAMIC = 4096
AR_HEADER_BYTES = 60
MAX_NAME = 1024
ELF_HEADER_BYTES = 64
ELF_MACHINE_X64 = 62
ELF_PROGRAM_BYTES = 56
MAX_ELF_PROGRAMS = 256
ELF_DYNAMIC_SEGMENT = 2
MAX_ELF_STRING_BYTES = 4096
MAX_VERSION_RECORDS = 256
ELF_VERSION_RECORD_BYTES = 16
RUNTIME = "usr/lib/Desktop App/runtime/"
MAIN = "usr/bin/japp-desktop"
DESKTOP = "usr/share/applications/Desktop App.desktop"
INSTALLED_MAIN = PurePosixPath("/").joinpath(MAIN).as_posix()


class FileRecord(TypedDict):
    path: str
    bytes: int
    sha256: str


class ArchiveFile(TypedDict):
    data: bytes
    mode: int


def shared_inspector() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "linux_shared_package", Path(__file__).with_name("macos_package.py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Canonical inventory inspector is required")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SHARED = shared_inspector()


def bounded_file(path: Path) -> bytes:
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError("Invalid package input")
    before = path.stat()
    if before.st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Package exceeds bound")
    with path.open("rb") as stream:
        raw = stream.read(MAX_ARCHIVE_BYTES + 1)
    after = path.stat()
    if len(raw) != before.st_size or (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
    ) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError("Package changed during inspection")
    return raw


def ar_members(raw: bytes) -> dict[str, bytes]:
    if not raw.startswith(b"!<arch>\n"):
        raise ValueError("Invalid Debian archive")
    offset = 8
    members = {}
    while offset < len(raw):
        header = raw[offset : offset + AR_HEADER_BYTES]
        if len(header) != AR_HEADER_BYTES or header[-2:] != b"`\n":
            raise ValueError("Invalid Debian member")
        name = header[:16].decode("ascii").strip().removesuffix("/")
        length = header[48:58].decode("ascii").strip()
        if (
            name not in {"debian-binary", "control.tar.gz", "data.tar.gz"}
            or name in members
            or not length.isdecimal()
        ):
            raise ValueError("Unexpected Debian member")
        size = int(length)
        start = offset + AR_HEADER_BYTES
        end = start + size
        if size > MAX_ARCHIVE_BYTES or end > len(raw):
            raise ValueError("Debian member exceeds bound")
        members[name] = raw[start:end]
        offset = end + size % 2
        if size % 2 and raw[end:offset] != b"\n":
            raise ValueError("Invalid Debian padding")
    if (
        set(members) != {"debian-binary", "control.tar.gz", "data.tar.gz"}
        or members["debian-binary"] != b"2.0\n"
    ):
        raise ValueError("Invalid Debian format")
    return members


def archive_path(name: str) -> str:
    name = name.removeprefix("./").removesuffix("/")
    name.encode("utf-8")
    if (
        not name
        or name.startswith("/")
        or len(name) > MAX_NAME
        or any(v in name for v in ["\\", ":", "\0"])
        or len(name.split("/")) > MAX_DEPTH
        or any(v in {"", ".", ".."} for v in name.split("/"))
    ):
        raise ValueError("Unsafe Debian path")
    return name


def tar_members(compressed: bytes) -> dict[str, ArchiveFile]:
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        expanded = stream.read(MAX_ARCHIVE_BYTES + 1)
    if len(expanded) > MAX_ARCHIVE_BYTES:
        raise ValueError("Expanded Debian archive exceeds bound")
    files: dict[str, ArchiveFile] = {}
    seen: set[str] = set()
    total = 0
    with tarfile.open(fileobj=io.BytesIO(expanded), mode="r:") as archive:
        for member in archive:
            name = archive_path(member.name)
            if (
                name in seen
                or len(seen) >= MAX_NODES
                or member.uid != 0
                or member.gid != 0
                or member.mode & 0o7022
            ):
                raise ValueError("Duplicate or unsafe Debian member")
            seen.add(name)
            if member.isdir():
                continue
            if not member.isfile() or member.size < 0 or len(files) >= MAX_FILES:
                raise ValueError("Nonregular Debian member")
            total += member.size
            if total > MAX_ARCHIVE_BYTES:
                raise ValueError("Debian payload exceeds bound")
            source = archive.extractfile(member)
            if source is None:
                raise ValueError("Missing Debian data")
            data = source.read(member.size + 1)
            if len(data) != member.size:
                raise ValueError("Truncated Debian member")
            files[name] = {"data": data, "mode": member.mode}
    return files


def fields(raw: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    names: set[str] = set()
    previous = ""
    for line in raw.decode("utf-8").splitlines():
        if line.startswith((" ", "\t")) and previous:
            result[previous] += " " + line.strip()
            continue
        if not line:
            continue
        name, marker, value = line.partition(":")
        if (
            not marker
            or not re.fullmatch(r"[A-Za-z][A-Za-z-]*", name)
            or name.lower() in names
        ):
            raise ValueError("Invalid Debian control")
        names.add(name.lower())
        result[name] = value.strip()
        previous = name
    return result


def required_dependencies(value: str) -> None:
    clauses: list[set[str]] = []
    for clause in value.split(","):
        names = set()
        for option in clause.split("|"):
            match = re.fullmatch(
                r"\s*([a-z0-9][a-z0-9+.-]*)(?:\s*\((?:<<|<=|=|>=|>>)\s*[A-Za-z0-9.+:~_-]+\))?\s*",
                option,
            )
            if match is None:
                raise ValueError("Unsupported Debian dependency")
            names.add(match.group(1))
        clauses.append(names)
    if not any(names <= {"libwebkit2gtk-4.1-0"} for names in clauses) or not any(
        names <= {"libgtk-3-0", "libgtk-3-0t64"} for names in clauses
    ):
        raise ValueError("Required WebKitGTK/GTK dependency is missing")


def elf_metadata(raw: bytes, name: str) -> dict[str, object]:  # noqa: PLR0912, PLR0915 - bounded ELF64 table walk
    if len(raw) < ELF_HEADER_BYTES or raw[:7] != b"\x7fELF\x02\x01\x01":
        raise ValueError("ELF64 little-endian x64 payload required")
    header = struct.unpack_from("<HHIQQQIHHHHHH", raw, 16)
    if (
        header[0] not in {2, 3}
        or header[1] != ELF_MACHINE_X64
        or header[2] != 1
        or header[7] != ELF_HEADER_BYTES
        or header[8] != ELF_PROGRAM_BYTES
        or not 0 < header[9] <= MAX_ELF_PROGRAMS
    ):
        raise ValueError("Invalid x64 ELF header")
    loads: list[tuple[int, ...]] = []
    dynamic = None
    for index in range(header[9]):
        position = header[4] + index * header[8]
        if position + 56 > len(raw):
            raise ValueError("ELF program table exceeds bound")
        row = struct.unpack_from("<IIQQQQQQ", raw, position)
        if row[2] + row[5] > len(raw):
            raise ValueError("ELF segment exceeds file")
        if row[0] == 1:
            loads.append(row)
        if row[0] == ELF_DYNAMIC_SEGMENT:
            if dynamic is not None or row[5] % 16 or row[5] // 16 > MAX_DYNAMIC:
                raise ValueError("Invalid ELF dynamic table")
            dynamic = row
    if dynamic is None:
        return {"needed": [], "runpaths": [], "glibc_versions": []}
    tags: dict[int, list[int]] = {}
    terminated = False
    for offset in range(dynamic[2], dynamic[2] + dynamic[5], 16):
        tag, value = struct.unpack_from("<QQ", raw, offset)
        if tag == 0:
            terminated = True
            break
        tags.setdefault(tag, []).append(value)
    if not terminated or len(tags.get(5, [])) != 1 or len(tags.get(10, [])) != 1:
        raise ValueError("Missing ELF strings")

    def address(value: int, size: int) -> int:
        if value + size > 1 << 64:
            raise ValueError("ELF address exceeds its 64-bit space")
        candidates = [
            row[2] + value - row[3]
            for row in loads
            if row[3] <= value and value + size <= row[3] + row[5]
        ]
        if len(candidates) != 1:
            raise ValueError("ELF address is not uniquely file-backed")
        return candidates[0]

    size = tags[10][0]
    start = address(tags[5][0], size)
    strings = raw[start : start + size]

    def string(offset: int) -> str:
        if offset >= len(strings):
            raise ValueError("ELF string exceeds table")
        end = strings.find(b"\0", offset)
        if end < 0 or end - offset > MAX_ELF_STRING_BYTES:
            raise ValueError("Invalid ELF string")
        return strings[offset:end].decode("utf-8")

    needed = [string(offset) for offset in tags.get(1, [])]
    if any(not v or "/" in v or "\\" in v for v in needed):
        raise ValueError("ELF dependency must be a library name")
    runpaths = [
        part
        for tag in [15, 29]
        for offset in tags.get(tag, [])
        for part in string(offset).split(":")
    ]
    for path in runpaths:
        if path != "$ORIGIN" and not path.startswith("$ORIGIN/"):
            raise ValueError("Build-host ELF load path is forbidden")
        parts = list(PurePosixPath(name).parent.parts)
        for component in path.removeprefix("$ORIGIN").split("/"):
            if component in {"", "."}:
                continue
            if component == "..":
                if not parts:
                    raise ValueError("ELF load path escapes package")
                parts.pop()
            else:
                parts.append(component)
        if not parts or parts[0] != "usr":
            raise ValueError("ELF load path reaches unowned filesystem root")
    versions = []
    if tags.get(0x6FFFFFFE) or tags.get(0x6FFFFFFF):
        if (
            len(tags.get(0x6FFFFFFE, [])) != 1
            or len(tags.get(0x6FFFFFFF, [])) != 1
            or not 1 <= tags[0x6FFFFFFF][0] <= MAX_VERSION_RECORDS
        ):
            raise ValueError("Invalid ELF version table")
        occupied: set[int] = set()

        def version_record(value: int) -> int:
            position = address(value, ELF_VERSION_RECORD_BYTES)
            if any(
                prior in occupied
                for prior in range(
                    position - ELF_VERSION_RECORD_BYTES + 1,
                    position + ELF_VERSION_RECORD_BYTES,
                )
            ):
                raise ValueError("ELF version records overlap")
            occupied.add(position)
            return position

        current = tags[0x6FFFFFFE][0]
        for index in range(tags[0x6FFFFFFF][0]):
            version, count, _file, auxiliary, following = struct.unpack_from(
                "<HHIII", raw, version_record(current)
            )
            if (
                version != 1
                or not 1 <= count <= MAX_DYNAMIC
                or auxiliary < ELF_VERSION_RECORD_BYTES
            ):
                raise ValueError("Invalid ELF version record")
            cursor = current + auxiliary
            for number in range(count):
                _hash, _flags, _other, version_name, next_aux = struct.unpack_from(
                    "<IHHII", raw, version_record(cursor)
                )
                text = string(version_name)
                if not text:
                    raise ValueError("Empty ELF auxiliary version name")
                if text.startswith("GLIBC_"):
                    match = re.fullmatch(r"GLIBC_(\d+)\.(\d+)", text)
                    if match is None or tuple(map(int, match.groups())) > (2, 39):
                        raise ValueError("ELF exceeds Ubuntu24.04 glibc contract")
                    versions.append(text)
                if number + 1 < count:
                    if next_aux < ELF_VERSION_RECORD_BYTES:
                        raise ValueError("Truncated or overlapping ELF auxiliary chain")
                elif next_aux:
                    raise ValueError("Unterminated ELF auxiliary chain")
                cursor += next_aux
            if index + 1 < tags[0x6FFFFFFF][0]:
                if following < ELF_VERSION_RECORD_BYTES:
                    raise ValueError("Truncated or overlapping ELF version chain")
            elif following:
                raise ValueError("Unterminated ELF version chain")
            current += following
    return {
        "needed": needed,
        "runpaths": runpaths,
        "glibc_versions": sorted(set(versions)),
    }


def records(files: dict[str, ArchiveFile], prefix: str = "") -> list[FileRecord]:
    return sorted(
        [
            {
                "path": name.removeprefix(prefix),
                "bytes": len(row["data"]),
                "sha256": hashlib.sha256(row["data"]).hexdigest(),
            }
            for name, row in files.items()
            if name.startswith(prefix)
        ],
        key=lambda row: row["path"],
    )


def unique_manifest(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate runtime manifest field")
        result[key] = value
    return result


def desktop_entry(raw: bytes) -> dict[str, str]:
    """Read the owned single-group template, never merge launch keys across groups."""
    entry: dict[str, str] = {}
    primary_seen = False
    for line in raw.decode("utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            if line != "[Desktop Entry]" or primary_seen:
                raise ValueError("Unexpected or duplicate desktop entry group")
            primary_seen = True
            continue
        if not primary_seen:
            raise ValueError("Desktop Entry group must precede its keys")
        key, marker, value = line.partition("=")
        if not marker or key in entry:
            raise ValueError("Invalid desktop entry")
        entry[key] = value
    if not primary_seen:
        raise ValueError("Desktop Entry group is missing")
    return entry


def inspect_deb(  # noqa: PLR0912 - ordered bounded package acceptance gates
    package: Path, staged: Path, manifest_sha256: str
) -> dict[str, object]:
    baseline_package = bounded_file(package)
    before_stage = cast(list[FileRecord], SHARED.inventory(staged))
    members = ar_members(baseline_package)
    control = tar_members(members["control.tar.gz"])
    if not {"control", "md5sums"} <= set(control) or set(control) - {
        "control",
        "md5sums",
    }:
        raise ValueError("Unexpected Debian maintainer/control file")
    metadata = fields(control["control"]["data"])
    if any(
        metadata.get(key) != value
        for key, value in [
            ("Package", "desktop-app"),
            ("Version", "0.0.1"),
            ("Architecture", "amd64"),
        ]
    ):
        raise ValueError("Debian identity differs")
    dependencies = metadata.get("Depends", "")
    required_dependencies(dependencies)
    files = tar_members(members["data.tar.gz"])
    for name in files:
        if (
            name not in {MAIN, DESKTOP}
            and not name.startswith(RUNTIME)
            and re.fullmatch(
                r"usr/share/icons/hicolor/[1-9]\d{0,3}x[1-9]\d{0,3}(?:@2)?/apps/japp-desktop\.png",
                name,
            )
            is None
        ):
            raise ValueError("Unowned Debian package file")
    runtime = records(files, RUNTIME)
    expected = next((row for row in runtime if row["path"] == "manifest.json"), None)
    if (
        expected is None
        or expected["sha256"] != manifest_sha256
        or runtime != before_stage
    ):
        raise ValueError("Compile-bound runtime differs")
    declared = cast(
        list[FileRecord], SHARED.declared_runtime_files(staged, manifest_sha256)
    )
    manifest_raw = files[RUNTIME + "manifest.json"]["data"]
    if len(manifest_raw) > 512 * 1024:
        raise ValueError("Runtime manifest exceeds bound")
    manifest = json.loads(manifest_raw, object_pairs_hook=unique_manifest)
    source_names = {
        "orchestrator_wheel_sha256",
        "contracts_wheel_sha256",
        "runtime_requirements_sha256",
        "build_requirements_sha256",
    }
    if (
        not isinstance(manifest, dict)
        or set(manifest)
        != {"schema_version", "target", "entrypoint", "source_inputs", "files"}
        or manifest["schema_version"] != "1.0.0"
        or manifest["target"] != "x86_64-unknown-linux-gnu"
        or manifest["entrypoint"] != "japp-orchestrator/japp-orchestrator"
        or not isinstance(manifest["source_inputs"], dict)
        or set(manifest["source_inputs"]) != source_names
        or not all(
            isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None
            for value in manifest["source_inputs"].values()
        )
    ):
        raise ValueError("Runtime manifest identity differs")
    if declared != [row for row in runtime if row["path"] != "manifest.json"]:
        raise ValueError("Declared runtime bytes differ")
    if (
        MAIN not in files
        or not files[MAIN]["mode"] & 0o111
        or not files.get(RUNTIME + "japp-orchestrator/japp-orchestrator", {"mode": 0})[
            "mode"
        ]
        & 0o111
    ):
        raise ValueError("Native executable permission is missing")
    desktop = files.get(DESKTOP)
    if desktop is None:
        raise ValueError("Desktop launch entry is missing")
    entry = desktop_entry(desktop["data"])
    if any(
        entry.get(key) != value
        for key, value in [
            ("Type", "Application"),
            ("Name", "Desktop App"),
            ("Exec", INSTALLED_MAIN),
            ("TryExec", INSTALLED_MAIN),
            ("Terminal", "false"),
        ]
    ):
        raise ValueError("Desktop entry depends on a shell or PATH")
    elf = {
        name: elf_metadata(row["data"], name)
        for name, row in files.items()
        if row["data"].startswith(b"\x7fELF")
    }
    if (
        MAIN not in elf
        or RUNTIME + "japp-orchestrator/japp-orchestrator" not in elf
        or not {"libwebkit2gtk-4.1.so.0", "libgtk-3.so.0"}
        <= set(cast(list[str], elf[MAIN]["needed"]))
    ):
        raise ValueError("Native WebKitGTK ELF linkage is missing")
    after_stage = cast(list[FileRecord], SHARED.inventory(staged))
    if before_stage != after_stage or bounded_file(package) != baseline_package:
        raise ValueError("Input changed during package inspection")
    return {
        "status": "ARCHIVE_BYTES_PASS_NATIVE_DEPENDENCIES_AND_LIFECYCLE_PENDING",
        "architecture": "amd64",
        "package_sha256": hashlib.sha256(baseline_package).hexdigest(),
        "runtime_manifest_sha256": manifest_sha256,
        "files": records(files),
        "control": metadata,
        "elf": elf,
        "default_gnome_certified": False,
        "pending": [
            "Actual Ubuntu24.04 apt/dpkg dependency resolution and install simulation",
            "Actual installed-file permissions/bytes and compiled descriptor binding",
            "Native default GNOME launch and authenticated health/version",
            "Native lifecycle and cleanup",
            "Wayland/X11 behavior and current host/image/tool provenance",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["package", "staged-runtime", "output"]:
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--compiled-manifest-sha256", required=True)
    args = parser.parse_args()
    if not args.output.is_absolute() or args.output.exists():
        raise ValueError("Proof output must be fresh and absolute")
    args.output.mkdir(parents=True)
    source = Path(__file__)
    executed = source.read_bytes()
    (args.output / "inspector-executed.py").write_bytes(executed)
    shared_file = SHARED.__file__
    if not isinstance(shared_file, str):
        raise ValueError("Shared inspector source is unavailable")
    shared_source = Path(shared_file)
    shared_executed = shared_source.read_bytes()
    (args.output / "shared-inspector-executed.py").write_bytes(shared_executed)
    result: dict[str, object] = {
        "status": "PACKAGE_STATIC_INSPECTION_FAILED",
        "failure": "STATIC_VALIDATION_REJECTED",
    }
    try:
        result = inspect_deb(
            args.package, args.staged_runtime, args.compiled_manifest_sha256
        )
        if (
            source.read_bytes() != executed
            or (args.output / "inspector-executed.py").read_bytes() != executed
            or shared_source.read_bytes() != shared_executed
            or (args.output / "shared-inspector-executed.py").read_bytes()
            != shared_executed
        ):
            raise ValueError("Inspector source changed")
    except (
        OSError,
        ValueError,
        UnicodeError,
        struct.error,
        tarfile.TarError,
        EOFError,
        RecursionError,
    ):
        result = {
            "status": "PACKAGE_STATIC_INSPECTION_FAILED",
            "failure": "STATIC_VALIDATION_REJECTED",
        }
    result["executed_inspector_sha256"] = hashlib.sha256(executed).hexdigest()
    result["executed_shared_inspector_sha256"] = hashlib.sha256(
        shared_executed
    ).hexdigest()
    (args.output / "inspection.json").write_text(json.dumps(result, indent=2) + "\n")
    if result["status"] == "PACKAGE_STATIC_INSPECTION_FAILED":
        raise SystemExit(1)
    sys.stdout.write(str(args.output / "inspection.json") + "\n")


if __name__ == "__main__":
    main()
