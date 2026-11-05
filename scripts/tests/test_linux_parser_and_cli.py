"""Synthetic archives and pure CLI seams; nothing is installed or executed."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import struct
import sys
import tarfile
from pathlib import Path

import pytest
from test_linux_package import (
    BUILDER,
    INSPECTOR,
    MAIN,
    ar_bytes,
    elf,
    fixture,
    write_package,
)


def test_required_library_alternative_cannot_authorize_unrelated_package(
    tmp_path: Path,
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    control["control"] = (
        control["control"][0].replace(
            b"libwebkit2gtk-4.1-0", b"libwebkit2gtk-4.1-0 | unrelated"
        ),
        0o644,
    )
    write_package(package, data, control)
    with pytest.raises(ValueError, match="dependency"):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_control_case_alias_cannot_override_checked_architecture() -> None:
    with pytest.raises(ValueError, match="control"):
        INSPECTOR.fields(b"Architecture: amd64\narchitecture: arm64\n")


def test_empty_version_need_record_is_rejected() -> None:
    raw = bytearray(elf(["libc.so.6"]))
    header = struct.unpack_from("<HHIQQQIHHHHHH", raw, 16)
    dynamic = struct.unpack_from("<IIQQQQQQ", raw, header[4] + header[8])
    for offset in range(dynamic[2], dynamic[2] + dynamic[5], 16):
        tag, value = struct.unpack_from("<QQ", raw, offset)
        if tag == 0x6FFFFFFE:
            version_offset = value - 0x400000
            struct.pack_into("<H", raw, version_offset + 2, 0)
            break
    else:
        raise AssertionError("version-need fixture did not reach declared record")
    with pytest.raises(ValueError, match="version"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


def test_origin_path_cannot_reach_unowned_filesystem_root() -> None:
    with pytest.raises(ValueError, match="load path"):
        INSPECTOR.elf_metadata(elf(["libc.so.6"], "$ORIGIN/../../tmp"), MAIN)


@pytest.mark.parametrize("mutation", ["retained-source", "shared-source"])
def test_cli_source_mutation_leaves_failed_bound_receipt(
    mutation: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package, stage, expected, _, _ = fixture(tmp_path)
    output = tmp_path / "proof"
    shared = tmp_path / "owned-shared-inspector.py"
    shared.write_bytes(Path(INSPECTOR.SHARED.__file__).read_bytes())
    monkeypatch.setattr(INSPECTOR.SHARED, "__file__", str(shared))
    original = INSPECTOR.inspect_deb

    def inspect(*arguments: object) -> object:
        result = original(*arguments)
        target = (
            output / "inspector-executed.py"
            if mutation == "retained-source"
            else shared
        )
        target.write_bytes(b"changed during the scoped pure inspection")
        return result

    monkeypatch.setattr(INSPECTOR, "inspect_deb", inspect)
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
    assert json.loads((output / "inspection.json").read_text())["status"] == (
        "PACKAGE_STATIC_INSPECTION_FAILED"
    )


def test_actual_sdk_mode_is_preserved_in_linux_descriptor() -> None:
    descriptor = (
        (
            Path(__file__).parents[2]
            / "apps/desktop/src-tauri/src/service/runtime_descriptor.rs"
        )
        .read_text()
        .split("#[cfg(test)]", 1)[0]
    )
    assert "path_for_mode(descriptor, !tauri::is_dev(), resource_root)" in descriptor
    assert 'cfg!(feature = "custom-protocol")' not in descriptor


def test_linux_builder_uses_validated_system_defaults() -> None:
    assert BUILDER.__file__ is not None
    source = Path(BUILDER.__file__).read_text()
    assert '"PATH": system_default_path(args.work_dir)' in source
    assert "os.defpath.split(os.pathsep)" in source


@pytest.mark.parametrize("mutation", ["target", "unowned-file"])
def test_package_cannot_authorize_wrong_runtime_target_or_unowned_files(
    mutation: str, tmp_path: Path
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    if mutation == "target":
        manifest = json.loads((stage / "manifest.json").read_text())
        manifest["target"] = "x86_64-pc-windows-msvc"
        raw = json.dumps(manifest).encode()
        (stage / "manifest.json").write_bytes(raw)
        expected = hashlib.sha256(raw).hexdigest()
        data["usr/lib/Desktop App/runtime/manifest.json"] = (raw, 0o644)
    else:
        data["etc/unrelated-configuration"] = (b"unowned", 0o644)
    write_package(package, data, control)
    with pytest.raises(ValueError, match=r"(?i)(manifest|unowned)"):
        INSPECTOR.inspect_deb(package, stage, expected)


@pytest.mark.parametrize("mutation", ["truncated", "duplicate", "padding"])
def test_malformed_ar_members_fail_before_tar_parsing(mutation: str) -> None:
    valid = ar_bytes(
        {"debian-binary": b"2.0\n", "control.tar.gz": b"a", "data.tar.gz": b"a"}
    )
    if mutation == "truncated":
        raw = valid[:-5]
    elif mutation == "duplicate":
        raw = valid + ar_bytes({"debian-binary": b"2.0\n"})[8:]
    else:
        raw = valid[:-1] + b"x"
    with pytest.raises(ValueError, match="Debian"):
        INSPECTOR.ar_members(raw)


def test_expanded_gzip_is_bounded_before_tar_parse(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(INSPECTOR, "MAX_ARCHIVE_BYTES", 16)
    with pytest.raises(ValueError, match="Expanded Debian"):
        INSPECTOR.tar_members(gzip.compress(b"x" * 32))


def test_duplicate_tar_name_is_rejected_without_extraction() -> None:
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w") as archive:
        for _ in range(2):
            row = tarfile.TarInfo("same")
            row.size = 1
            archive.addfile(row, io.BytesIO(b"x"))
    with pytest.raises(ValueError, match="Duplicate"):
        INSPECTOR.tar_members(gzip.compress(stream.getvalue()))


def test_linked_auxiliary_version_count_cannot_be_zero() -> None:
    raw = bytearray(elf(["libc.so.6"]))
    header = struct.unpack_from("<HHIQQQIHHHHHH", raw, 16)
    dynamic = struct.unpack_from("<IIQQQQQQ", raw, header[4] + header[8])
    for offset in range(dynamic[2], dynamic[2] + dynamic[5], 16):
        tag, _value = struct.unpack_from("<QQ", raw, offset)
        if tag == 0x6FFFFFFF:
            struct.pack_into("<Q", raw, offset + 8, 0)
            break
    else:
        raise AssertionError("version-need-count fixture missing")
    with pytest.raises(ValueError, match="version"):
        INSPECTOR.elf_metadata(bytes(raw), MAIN)


def test_duplicate_runtime_manifest_field_cannot_self_authorize(tmp_path: Path) -> None:
    package, stage, _expected, data, control = fixture(tmp_path)
    raw = (stage / "manifest.json").read_bytes()
    raw = raw.replace(b'{"schema_version"', b'{"target":"unowned","schema_version"', 1)
    (stage / "manifest.json").write_bytes(raw)
    data["usr/lib/Desktop App/runtime/manifest.json"] = (raw, 0o644)
    write_package(package, data, control)
    with pytest.raises(ValueError, match="manifest"):
        INSPECTOR.inspect_deb(package, stage, hashlib.sha256(raw).hexdigest())


@pytest.mark.parametrize("valid", [True, False])
def test_actual_cli_keeps_bound_receipt_and_no_native_certification(
    valid: bool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package, stage, expected, _, _ = fixture(tmp_path)
    if not valid:
        package.write_bytes(b"invalid actual archive fixture")
    output = tmp_path / "proof"
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
    if valid:
        INSPECTOR.main()
    else:
        with pytest.raises(SystemExit) as failure:
            INSPECTOR.main()
        assert failure.value.code == 1
    receipt = json.loads((output / "inspection.json").read_text())
    assert (
        receipt["executed_inspector_sha256"]
        == hashlib.sha256((output / "inspector-executed.py").read_bytes()).hexdigest()
    )
    assert (
        receipt["executed_shared_inspector_sha256"]
        == hashlib.sha256(
            (output / "shared-inspector-executed.py").read_bytes()
        ).hexdigest()
    )
    if valid:
        assert receipt["default_gnome_certified"] is False
        assert "PENDING" in receipt["status"]
    else:
        assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"


def test_cli_recursive_manifest_failure_is_still_a_failed_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package, stage, expected, _, _ = fixture(tmp_path)
    output = tmp_path / "proof"

    def reject(*_arguments: object) -> None:
        raise RecursionError("synthetic failure text must not be retained")

    monkeypatch.setattr(INSPECTOR, "inspect_deb", reject)
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
    raw = (output / "inspection.json").read_text()
    assert json.loads(raw)["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert "synthetic failure text" not in raw
