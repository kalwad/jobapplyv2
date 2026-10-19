"""Pure byte/temporary-file counterproofs; no ELF payload or package is run."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import pytest
from test_linux_package import DESKTOP, INSPECTOR, MAIN, elf, fixture, write_package

BASE_ADDRESS = 0x400000
RECORD_BYTES = 16


def version_layout(raw: bytes | bytearray) -> tuple[int, int]:
    header = struct.unpack_from("<HHIQQQIHHHHHH", raw, 16)
    dynamic = struct.unpack_from("<IIQQQQQQ", raw, header[4] + header[8])
    version_offset = None
    count_offset = None
    for offset in range(dynamic[2], dynamic[2] + dynamic[5], RECORD_BYTES):
        tag, value = struct.unpack_from("<QQ", raw, offset)
        if tag == 0x6FFFFFFE:
            version_offset = value - BASE_ADDRESS
        elif tag == 0x6FFFFFFF:
            count_offset = offset + 8
    assert version_offset is not None
    assert count_offset is not None
    return version_offset, count_offset


def file_backed_size(raw: bytearray, size: int) -> None:
    struct.pack_into("<Q", raw, 64 + 32, size)
    struct.pack_into("<Q", raw, 64 + 40, len(raw))


def two_auxiliary_records() -> bytearray:
    raw = bytearray(elf(["libc.so.6"]))
    version, _ = version_layout(raw)
    raw.extend(raw[version + RECORD_BYTES : version + 2 * RECORD_BYTES])
    struct.pack_into("<H", raw, version + 2, 2)
    struct.pack_into("<I", raw, version + RECORD_BYTES + 12, RECORD_BYTES)
    file_backed_size(raw, len(raw))
    return raw


def two_need_records(
    needed: list[str] | None = None, glibc: str = "GLIBC_2.39"
) -> bytearray:
    raw = bytearray(elf(needed or ["libc.so.6"], glibc=glibc))
    version, count_offset = version_layout(raw)
    raw.extend(raw[version : version + 2 * RECORD_BYTES])
    struct.pack_into("<I", raw, version + 12, 2 * RECORD_BYTES)
    struct.pack_into("<Q", raw, count_offset, 2)
    file_backed_size(raw, len(raw))
    return raw


@pytest.mark.parametrize("auxiliary", [0, 4, 8])
def test_need_auxiliary_cannot_alias_its_header_and_hide_glibc(
    auxiliary: int,
) -> None:
    raw = bytearray(elf(["libc.so.6"], glibc="GLIBC_9.99"))
    with pytest.raises(ValueError, match="glibc"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)
    version, _ = version_layout(raw)
    struct.pack_into("<I", raw, version + 8, auxiliary)
    with pytest.raises(ValueError, match=r"(?i)(ELF|version|file-backed)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


@pytest.mark.parametrize("following", [4, 8, 12])
def test_auxiliary_chain_records_cannot_overlap(following: int) -> None:
    raw = two_auxiliary_records()
    assert INSPECTOR.elf_metadata(bytes(raw), MAIN)["glibc_versions"] == ["GLIBC_2.39"]
    version, _ = version_layout(raw)
    struct.pack_into("<I", raw, version + RECORD_BYTES + 12, following)
    with pytest.raises(ValueError, match=r"(?i)(ELF|version|file-backed)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


@pytest.mark.parametrize("chain", ["first-auxiliary", "next-auxiliary", "next-need"])
def test_every_version_chain_transition_is_file_backed(chain: str) -> None:
    raw = (
        two_need_records()
        if chain == "next-need"
        else two_auxiliary_records()
        if chain == "next-auxiliary"
        else bytearray(elf(["libc.so.6"]))
    )
    assert INSPECTOR.elf_metadata(bytes(raw), MAIN)["glibc_versions"] == ["GLIBC_2.39"]
    version, _ = version_layout(raw)
    boundary = version + (
        RECORD_BYTES if chain == "first-auxiliary" else 2 * RECORD_BYTES
    )
    file_backed_size(raw, boundary)
    # Bytes still exist in the file, but the loader cannot map this next record.
    assert len(raw) >= boundary + RECORD_BYTES
    with pytest.raises(ValueError, match=r"(?i)(ELF|version|file-backed)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


def test_need_and_auxiliary_chains_cannot_share_a_record() -> None:
    raw = two_need_records(["GLIBC_2.39", "libc.so.6"], "GLIBC_9.99")
    version, _ = version_layout(raw)
    # The second need's legitimate auxiliary names the compatible version.
    struct.pack_into("<I", raw, version + 3 * RECORD_BYTES + 8, 1)
    with pytest.raises(ValueError, match="glibc"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)
    # Aliasing that need header must not hide the first, incompatible version.
    struct.pack_into("<I", raw, version + 8, 2 * RECORD_BYTES)
    with pytest.raises(ValueError, match=r"(?i)(ELF|version|file-backed)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


@pytest.mark.parametrize("chain", ["auxiliary", "need"])
def test_declared_last_version_record_must_terminate(chain: str) -> None:
    raw = bytearray(elf(["libc.so.6"]))
    version, _ = version_layout(raw)
    pointer = version + 12 + (RECORD_BYTES if chain == "auxiliary" else 0)
    struct.pack_into("<I", raw, pointer, RECORD_BYTES)
    with pytest.raises(ValueError, match=r"(?i)(ELF|version|chain)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


def test_empty_version_name_is_not_a_compatible_requirement() -> None:
    raw = bytearray(elf(["libc.so.6"]))
    version, _ = version_layout(raw)
    struct.pack_into("<I", raw, version + RECORD_BYTES + 8, 0)
    with pytest.raises(ValueError, match=r"(?i)(ELF|version)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


def test_version_transition_cannot_overflow_the_elf64_address_space() -> None:
    raw = bytearray(elf(["libc.so.6"]))
    header = struct.unpack_from("<HHIQQQIHHHHHH", raw, 16)
    dynamic = struct.unpack_from("<IIQQQQQQ", raw, header[4] + header[8])
    base = (1 << 64) - len(raw) + 8
    struct.pack_into("<Q", raw, 64 + 16, base)
    struct.pack_into("<Q", raw, 64 + 24, base)
    for offset in range(dynamic[2], dynamic[2] + dynamic[5], RECORD_BYTES):
        tag, value = struct.unpack_from("<QQ", raw, offset)
        if tag in {5, 0x6FFFFFFE}:
            struct.pack_into("<Q", raw, offset + 8, base + value - BASE_ADDRESS)
    # The first need and strings fit; its 16-byte auxiliary crosses 2**64.
    with pytest.raises(ValueError, match=r"(?i)(ELF|address)"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


@pytest.mark.parametrize("records", ["two-auxiliary", "two-need"])
def test_distinct_file_backed_version_chains_preserve_all_requirements(
    records: str,
) -> None:
    raw = two_auxiliary_records() if records == "two-auxiliary" else two_need_records()
    assert INSPECTOR.elf_metadata(bytes(raw), MAIN)["glibc_versions"] == ["GLIBC_2.39"]


@pytest.mark.parametrize(
    "mutation",
    ["unrelated-header", "missing-header", "exec-in-action", "tryexec-in-action"],
)
def test_launch_keys_must_belong_to_the_primary_desktop_entry(
    mutation: str, tmp_path: Path
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    assert "PENDING" in INSPECTOR.inspect_deb(package, stage, expected)["status"]
    raw = data[DESKTOP][0]
    if mutation == "unrelated-header":
        raw = raw.replace(b"[Desktop Entry]", b"[Unrelated]")
    elif mutation == "missing-header":
        raw = raw.replace(b"[Desktop Entry]\n", b"")
    else:
        key = b"Exec" if mutation == "exec-in-action" else b"TryExec"
        line = key + b"=/usr/bin/japp-desktop\n"
        raw = (
            b"".join(item for item in raw.splitlines(keepends=True) if item != line)
            + b"[Desktop Action unowned]\n"
            + line
        )
    data[DESKTOP] = (raw, 0o644)
    write_package(package, data, control)
    with pytest.raises(ValueError, match=r"(?i)desktop"):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_duplicate_primary_desktop_group_is_rejected(tmp_path: Path) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    data[DESKTOP] = (data[DESKTOP][0] + b"[Desktop Entry]\n", 0o644)
    write_package(package, data, control)
    with pytest.raises(ValueError, match=r"(?i)desktop"):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_pinned_desktop_template_and_comment_lines_remain_valid(tmp_path: Path) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    template = Path(__file__).parents[2] / "packaging/ubuntu.desktop"
    data[DESKTOP] = (b"# synthetic comment\n\n" + template.read_bytes(), 0o644)
    write_package(package, data, control)
    result = INSPECTOR.inspect_deb(package, stage, expected)
    assert "PENDING" in result["status"]
    assert result["default_gnome_certified"] is False


@pytest.mark.parametrize("mutation", ["elf-auxiliary", "desktop-group"])
def test_malformed_metadata_cli_retains_failed_receipt(
    mutation: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    if mutation == "elf-auxiliary":
        raw = bytearray(data[MAIN][0])
        version, _ = version_layout(raw)
        struct.pack_into("<I", raw, version + 8, 0)
        data[MAIN] = (bytes(raw), 0o755)
    else:
        data[DESKTOP] = (
            data[DESKTOP][0].replace(b"[Desktop Entry]", b"[Unrelated]"),
            0o644,
        )
    write_package(package, data, control)
    output = tmp_path / "owned-proof"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "inspector",
            "--package",
            str(package),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert receipt["failure"] == "STATIC_VALIDATION_REJECTED"
    assert receipt["executed_inspector_sha256"]
    assert receipt["executed_shared_inspector_sha256"]
