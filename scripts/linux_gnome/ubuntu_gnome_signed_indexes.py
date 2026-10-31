"""Retain APT's authenticated Release/index/archive chain for later review.

No actor runs on import. Existing bounded Owner.command performs the read-only
indextargets query and gpgv verification after APT's authenticated update.
Complete uncompressed Packages indexes remain in the finite input bundle.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import stat
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Protocol

INDEX_CAP = 256 * 1024 * 1024
TOTAL_INDEX_CAP = 1024 * 1024 * 1024
RELEASE_CAP = 2 * 1024 * 1024
STANZA_CAP = 1024 * 1024
# A deb822 field line may be as long as its stanza: noble universe's
# librust-winapi-dev Provides line alone is 70,841 bytes.
LINE_CAP = STANZA_CAP
MAX_INDEXES = 12
SUITES = {"noble", "noble-updates", "noble-security"}
SITES = {"https://archive.ubuntu.com/ubuntu", "https://security.ubuntu.com/ubuntu"}


@dataclass(frozen=True)
class IndexLocation:
    root: Path
    config: Path
    destination: Path


class CommandOwner(Protocol):
    def command(
        self, argv: list[str], seconds: float = 30, cap: int = 256 * 1024
    ) -> bytes: ...


def paragraphs(lines: Iterable[bytes]) -> Iterator[dict[str, str]]:
    row: dict[str, str] = {}
    last: str | None = None
    size = 0
    for raw in lines:
        size += len(raw)
        if len(raw) > LINE_CAP or size > STANZA_CAP:
            raise ValueError("Debian index line/stanza exceeds bound")
        line = raw.decode("utf-8").rstrip("\r\n")
        if not line:
            if row:
                yield row
            row, last, size = {}, None, 0
        elif line[0] in " \t":
            if last is None:
                raise ValueError("Debian continuation lacks a field")
            row[last] += "\n" + line[1:]
        else:
            name, value = line.split(":", 1)
            name = name.casefold()
            if re.fullmatch(r"[a-z0-9][a-z0-9-]*", name) is None or name in row:
                raise ValueError("Duplicate or invalid Debian index field")
            row[name] = value.strip()
            last = name
    if row:
        yield row


def bounded_lines(path: Path) -> Iterator[bytes]:
    with path.open("rb") as stream:
        while raw := stream.readline(LINE_CAP + 1):
            yield raw


def file_pin(path: Path, cap: int) -> dict[str, int | str]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or not 0 <= before.st_size <= cap:
        raise ValueError("Bounded regular signed-index input required")
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as stream:
        while raw := stream.read(1024 * 1024):
            total += len(raw)
            if total > cap:
                raise ValueError("Signed-index input grew beyond cap")
            digest.update(raw)
    after = path.lstat()
    if (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
    ) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_mode,
    ) or total != before.st_size:
        raise ValueError("Signed-index input changed while reading")
    return {"bytes": total, "sha256": digest.hexdigest()}


def copy_exact(source: Path, target: Path, cap: int) -> dict[str, int | str]:
    original = file_pin(source, cap)
    shutil.copyfile(source, target)
    if file_pin(source, cap) != original or file_pin(target, cap) != original:
        raise ValueError("Retained signed-index copy differs")
    return original


def release_entries(
    path: Path,
) -> tuple[dict[str, str], dict[str, dict[str, int | str]]]:
    records = list(paragraphs(bounded_lines(path)))
    if len(records) != 1:
        raise ValueError("One verified Release stanza required")
    release = records[0]
    if (
        release.get("origin") != "Ubuntu"
        or release.get("suite") not in SUITES
        or release.get("codename") != "noble"
    ):
        raise ValueError("Exact Ubuntu Noble signed Release identity required")
    entries: dict[str, dict[str, int | str]] = {}
    for line in release["sha256"].splitlines():
        if not line.strip():
            continue
        digest, size, name = line.split()
        relative = PurePosixPath(name)
        if (
            re.fullmatch(r"[a-f0-9]{64}", digest) is None
            or not size.isdecimal()
            or relative.is_absolute()
            or ".." in relative.parts
            or name in entries
        ):
            raise ValueError("Invalid or duplicate signed Release SHA256 entry")
        entries[name] = {"sha256": digest, "bytes": int(size)}
    if not entries:
        raise ValueError("Signed Release has no SHA256 index entries")
    return release, entries


def selected_package(row: dict[str, str]) -> dict[str, Any]:
    filename = row["filename"]
    relative = PurePosixPath(filename)
    size, digest = row["size"], row["sha256"]
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or not filename.startswith("pool/")
        or not size.isdecimal()
        or int(size) <= 0
        or re.fullmatch(r"[a-f0-9]{64}", digest) is None
    ):
        raise ValueError("Invalid signed package archive record")
    return {
        "package": row["package"],
        "version": row["version"],
        "architecture": row["architecture"],
        "pool_path": filename,
        "bytes": int(size),
        "sha256": digest,
    }


def retain_releases(
    owner: CommandOwner, root: Path, destination: Path
) -> list[dict[str, Any]]:
    releases = sorted((root / "lists").glob("*InRelease"))
    if not 1 <= len(releases) <= len(SUITES):
        raise ValueError("Finite authenticated signed repository metadata required")
    rows: list[dict[str, Any]] = []
    for number, item in enumerate(releases, 1):
        signed_name, plain_name = (
            f"release-{number:02d}.InRelease",
            f"release-{number:02d}.Release",
        )
        signed_pin = copy_exact(item, destination / signed_name, RELEASE_CAP)
        plain = destination / plain_name
        owner.command(
            [
                "/usr/bin/gpgv",
                "--keyring",
                str(root / "ubuntu-archive-keyring.gpg"),
                "--output",
                str(plain),
                str(destination / signed_name),
            ],
            seconds=30,
        )
        plain_pin = file_pin(plain, RELEASE_CAP)
        identity, entries = release_entries(plain)
        rows.append(
            {
                "filename": signed_name,
                **signed_pin,
                "release_filename": plain_name,
                "release_pin": plain_pin,
                "identity": {
                    key: identity[key]
                    for key in ("origin", "suite", "codename", "date", "valid-until")
                    if key in identity
                },
                "entries": entries,
            }
        )
    if len({row["identity"]["suite"] for row in rows}) != len(rows):
        raise ValueError("Duplicate signed Release suite")
    return rows


def target_index(row: dict[str, str], root: Path) -> tuple[Path, str]:
    source, metakey = Path(row["filename"]), row["metakey"]
    if (
        row.get("identifier") != "Packages"
        or row.get("trusted") != "yes"
        or row.get("suite") not in SUITES
        or row.get("site", "").rstrip("/") not in SITES
        or row.get("architecture") != "amd64"
        or source.parent != root / "lists"
        or re.fullmatch(
            r"(?:main|restricted|universe|multiverse)/binary-amd64/Packages", metakey
        )
        is None
    ):
        raise ValueError("Exact trusted private Ubuntu Packages target required")
    return source, metakey


def retain_indexes(
    owner: CommandOwner,
    location: IndexLocation,
    releases: list[dict[str, Any]],
    packages: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    root, config, destination = location.root, location.config, location.destination
    raw = owner.command(
        [
            "/usr/bin/env",
            "APT_CONFIG=" + str(config),
            "/usr/bin/apt-get",
            "-c",
            str(config),
            "indextargets",
            "Identifier: Packages",
        ],
        seconds=30,
    )
    targets = list(paragraphs(raw.splitlines(keepends=True)))
    if not 1 <= len(targets) <= MAX_INDEXES:
        raise ValueError("Finite authenticated Packages index set required")
    wanted = {
        (str(p["package"]), str(p["version"]), str(p["architecture"])): p
        for p in packages
    }
    if len(wanted) != len(packages):
        raise ValueError("Duplicate selected archive identity")
    matches: dict[tuple[str, str, str], list[dict[str, Any]]] = {
        key: [] for key in wanted
    }
    indexes, total, seen = [], 0, set()
    for number, target in enumerate(targets, 1):
        source, metakey = target_index(target, root)
        if source in seen:
            raise ValueError("Duplicate Packages target path")
        seen.add(source)
        filename = f"packages-{number:03d}"
        pin = copy_exact(source, destination / filename, INDEX_CAP)
        total += int(pin["bytes"])
        if total > TOTAL_INDEX_CAP:
            raise ValueError("Complete retained Packages indexes exceed finite cap")
        signed = [
            r
            for r in releases
            if r["identity"]["suite"] == target["suite"]
            and r["entries"].get(metakey) == pin
        ]
        if len(signed) != 1:
            raise ValueError(
                "Packages index differs from verified signed Release SHA256/size"
            )
        record = {
            "filename": filename,
            **pin,
            "metakey": metakey,
            "site": target["site"],
            "suite": target["suite"],
            "inrelease_filename": signed[0]["filename"],
            "release_filename": signed[0]["release_filename"],
        }
        indexes.append(record)
        for paragraph in paragraphs(bounded_lines(destination / filename)):
            key = tuple(
                paragraph.get(k, "") for k in ("package", "version", "architecture")
            )
            if key not in wanted:
                continue
            selected = selected_package(paragraph)
            expected = wanted[key]
            if (
                selected["sha256"] == expected["sha256"]
                and selected["bytes"] == expected["bytes"]
            ):
                matches[key].append({**selected, "index_filename": filename})
    joined = []
    for key, expected in wanted.items():
        if not matches[key]:
            raise ValueError(
                "Selected archive lacks exact signed Packages SHA256/size chain"
            )
        joined.append({**expected, "signed_index_records": matches[key]})
    return indexes, joined


def retain_signed_chain(
    owner: CommandOwner,
    root: Path,
    config: Path,
    destination: Path,
    packages: list[dict[str, Any]],
) -> dict[str, Any]:
    destination.mkdir(mode=0o700)
    keyring = copy_exact(
        root / "ubuntu-archive-keyring.gpg",
        destination / "ubuntu-archive-keyring.gpg",
        RELEASE_CAP,
    )
    copy_exact(root / "sources.list", destination / "sources.list", RELEASE_CAP)
    releases = retain_releases(owner, root, destination)
    indexes, joined = retain_indexes(
        owner, IndexLocation(root, config, destination), releases, packages
    )
    return {
        "schema": "japp-retained-signed-apt-index-chain-v1",
        "keyring": keyring,
        "releases": [
            {key: value for key, value in row.items() if key != "entries"}
            for row in releases
        ],
        "indexes": indexes,
        "packages": joined,
        "required_verification": "GPGV_EXIT_ZERO_THEN_RELEASE_INDEX_ARCHIVE_HASH_JOINS",
    }
