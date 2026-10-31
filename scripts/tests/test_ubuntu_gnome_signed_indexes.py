"""Pure signed-index parser/copy/refusal oracles; synthetic bytes are not GPG proof."""

from __future__ import annotations

import hashlib
import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
sys.path.insert(0, str(SOURCE))


@pytest.fixture
def indexes() -> ModuleType:
    name = "ubuntu_gnome_signed_indexes"
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


@pytest.mark.parametrize(
    "payload",
    [
        b"Package: a\npackage: b\n",
        b" continuation\n",
        pytest.param(b"x" * (1024 * 1024 + 1), id="oversized-field"),
    ],
)
def test_duplicate_continuation_and_oversized_fields_refused(
    indexes: ModuleType, payload: bytes
) -> None:
    with pytest.raises(ValueError, match=r"Duplicate|continuation|exceeds bound"):
        list(indexes.paragraphs(payload.splitlines(keepends=True)))


def test_real_archive_line_length_is_accepted_within_the_stanza_bound(
    indexes: ModuleType,
) -> None:
    # Ubuntu noble universe librust-winapi-dev has a 70,841-byte Provides line.
    provides = b", ".join(
        b"librust-winapi+f%05d-dev (= 0.3.9-1)" % n for n in range(2000)
    )
    assert len(provides) > 65536
    stanza = b"Package: librust-winapi-dev\nProvides: " + provides + b"\n\n"
    rows = list(indexes.paragraphs(stanza.splitlines(keepends=True)))
    assert rows == [{"package": "librust-winapi-dev", "provides": provides.decode()}]
    assert indexes.LINE_CAP == indexes.STANZA_CAP == 1024 * 1024


def test_stanza_bound_still_refuses_many_lines_under_the_line_bound(
    indexes: ModuleType,
) -> None:
    line = b"X-Field-%d: " + b"y" * (300 * 1024) + b"\n"
    stanza = [b"Package: big\n", *(line % n for n in range(4))]
    assert all(len(row) <= indexes.LINE_CAP for row in stanza)
    with pytest.raises(ValueError, match="exceeds bound"):
        list(indexes.paragraphs(stanza))


def test_stanza_bound_resets_between_stanzas(indexes: ModuleType) -> None:
    body = b"Description: " + b"z" * (600 * 1024) + b"\n"
    lines = [b"Package: one\n", body, b"\n", b"Package: two\n", body]
    assert sum(map(len, lines)) > indexes.STANZA_CAP
    rows = list(indexes.paragraphs(lines))
    assert [row["package"] for row in rows] == ["one", "two"]


def test_deb822_casefold_continuations_and_multiple_paragraphs(
    indexes: ModuleType,
) -> None:
    raw = (
        b"SHA256:\n abcd 4 main/Packages\n\n"
        b"Package: value\nDescription: first\n second\n"
    )
    assert list(indexes.paragraphs(raw.splitlines(keepends=True))) == [
        {"sha256": "\nabcd 4 main/Packages"},
        {"package": "value", "description": "first\nsecond"},
    ]


@pytest.mark.parametrize(
    "change", ["suite", "origin", "digest", "size", "duplicate", "traversal"]
)
def test_signed_release_identity_and_hash_section_closed(
    tmp_path: Path, indexes: ModuleType, change: str
) -> None:
    digest, size, name = "a" * 64, "2", "main/binary-amd64/Packages"
    suite, origin = "noble", "Ubuntu"
    if change == "suite":
        suite = "other"
    elif change == "origin":
        origin = "other"
    elif change == "digest":
        digest = "invalid"
    elif change == "size":
        size = "-1"
    elif change == "traversal":
        name = "../Packages"
    row = f" {digest} {size} {name}\n"
    if change == "duplicate":
        row += row
    path = tmp_path / "Release"
    path.write_text(
        f"Origin: {origin}\nSuite: {suite}\nCodename: noble\nSHA256:\n" + row
    )
    with pytest.raises(ValueError, match=r"Release identity|SHA256 entry"):
        indexes.release_entries(path)


@pytest.mark.parametrize(
    "change", ["trusted", "site", "suite", "architecture", "metakey", "outside"]
)
def test_apt_targets_require_exact_trusted_private_linux_indexes(
    tmp_path: Path, indexes: ModuleType, change: str
) -> None:
    row = {
        "identifier": "Packages",
        "trusted": "yes",
        "site": "https://archive.ubuntu.com/ubuntu",
        "suite": "noble",
        "architecture": "amd64",
        "filename": str(tmp_path / "lists/Packages"),
        "metakey": "main/binary-amd64/Packages",
    }
    if change == "outside":
        row["filename"] = str(tmp_path / "elsewhere/Packages")
    else:
        row[change] = "invalid"
    with pytest.raises(ValueError, match="trusted private"):
        indexes.target_index(row, tmp_path)


@pytest.mark.parametrize(
    "change",
    [
        "index_hash",
        "index_size",
        "archive_hash",
        "archive_size",
        "missing_archive",
        "duplicate_target",
    ],
)
def test_release_index_archive_joins_refuse_each_mismatch(
    tmp_path: Path, indexes: ModuleType, change: str
) -> None:
    root, retained = tmp_path / "apt", tmp_path / "retained"
    (root / "lists").mkdir(parents=True)
    retained.mkdir()
    archive = {
        "package": "fixture",
        "version": "1",
        "architecture": "amd64",
        "bytes": 4,
        "sha256": "a" * 64,
        "filename": "fixture.deb",
    }
    package_hash, size, package = "a" * 64, "4", "fixture"
    if change == "archive_hash":
        package_hash = "b" * 64
    elif change == "archive_size":
        size = "5"
    elif change == "missing_archive":
        package = "other"
    raw = (
        f"Package: {package}\nVersion: 1\nArchitecture: amd64\n"
        f"Filename: pool/f/fixture.deb\nSize: {size}\nSHA256: {package_hash}\n\n"
    ).encode()
    source = root / "lists/index"
    source.write_bytes(raw)
    pin: dict[str, int | str] = {
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }
    if change == "index_hash":
        pin["sha256"] = "c" * 64
    elif change == "index_size":
        pin["bytes"] = len(raw) + 1
    releases = [
        {
            "filename": "signed.InRelease",
            "release_filename": "plain.Release",
            "identity": {"suite": "noble"},
            "entries": {"main/binary-amd64/Packages": pin},
        }
    ]
    target = (
        "Identifier: Packages\nTrusted: yes\nSuite: noble\nArchitecture: amd64\n"
        "Site: https://archive.ubuntu.com/ubuntu\n"
        "MetaKey: main/binary-amd64/Packages\nFilename: " + str(source) + "\n\n"
    ).encode()
    if change == "duplicate_target":
        target += target

    class Owner:
        def command(self, argv: list[str], **kwargs: object) -> bytes:
            assert argv[-2:] == ["indextargets", "Identifier: Packages"]
            assert kwargs == {"seconds": 30}
            return target

    with pytest.raises(
        ValueError, match=r"signed Release|archive lacks|Duplicate Packages"
    ):
        indexes.retain_indexes(
            Owner(),
            indexes.IndexLocation(root, root / "apt.conf", retained),
            releases,
            [archive],
        )


def test_signature_failure_stops_before_any_plain_release_can_be_accepted(
    tmp_path: Path, indexes: ModuleType
) -> None:
    (tmp_path / "lists").mkdir()
    (tmp_path / "lists/fixture_InRelease").write_bytes(b"synthetic invalid signature")
    destination = tmp_path / "retained"
    destination.mkdir()
    calls: list[list[str]] = []

    class Owner:
        def command(self, argv: list[str], **_kwargs: object) -> bytes:
            calls.append(argv)
            raise RuntimeError("synthetic verifier failure")

    with pytest.raises(RuntimeError, match="verifier failure"):
        indexes.retain_releases(Owner(), tmp_path, destination)
    assert len(calls) == 1
    assert calls[0][:3] == [
        "/usr/bin/gpgv",
        "--keyring",
        str(tmp_path / "ubuntu-archive-keyring.gpg"),
    ]
    assert calls[0][3:5] == ["--output", str(destination / "release-01.Release")]
    assert not (destination / "release-01.Release").exists()


def test_empty_packages_index_can_be_retained_exactly(
    tmp_path: Path, indexes: ModuleType
) -> None:
    source, destination = tmp_path / "empty", tmp_path / "retained"
    source.write_bytes(b"")
    assert indexes.copy_exact(source, destination, 1) == {
        "bytes": 0,
        "sha256": hashlib.sha256(b"").hexdigest(),
    }
    assert destination.read_bytes() == b""
