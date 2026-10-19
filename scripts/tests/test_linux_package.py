from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
import struct
import tarfile
from pathlib import Path
from types import ModuleType

import pytest


def module(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        name.replace("-", "_"), Path(__file__).parents[1] / (name + ".py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Linux source is missing")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


INSPECTOR = module("linux_package")
BUILDER = module("build-linux-service-runtime")
RUNTIME = "usr/lib/Desktop App/runtime/"
MAIN = "usr/bin/japp-desktop"
DESKTOP = "usr/share/applications/Desktop App.desktop"
PACKAGE_REJECTION = (
    r"(?i)(runtime|path|debian|elf|dependency|desktop|native|package|bound)"
)


def elf(
    needed: list[str], runpath: str = "$ORIGIN", glibc: str = "GLIBC_2.39"
) -> bytes:
    strings = bytearray(b"\0")
    offsets = {}
    for text in [*needed, runpath, glibc]:
        offsets[text] = len(strings)
        strings.extend(text.encode() + b"\0")
    entries = len(needed) + 6
    dynamic_offset = 64 + 2 * 56
    string_offset = dynamic_offset + entries * 16
    version_offset = string_offset + len(strings)
    address = 0x400000
    dynamic = [(1, offsets[name]) for name in needed]
    dynamic += [
        (5, address + string_offset),
        (10, len(strings)),
        (29, offsets[runpath]),
        (0x6FFFFFFE, address + version_offset),
        (0x6FFFFFFF, 1),
        (0, 0),
    ]
    versions = struct.pack("<HHIII", 1, 1, offsets[needed[-1]], 16, 0) + struct.pack(
        "<IHHII", 0, 0, 2, offsets[glibc], 0
    )
    size = version_offset + len(versions)
    header = b"\x7fELF\x02\x01\x01" + b"\0" * 9
    header += struct.pack("<HHIQQQIHHHHHH", 3, 62, 1, 0, 64, 0, 0, 64, 56, 2, 0, 0, 0)
    headers = struct.pack("<IIQQQQQQ", 1, 5, 0, address, address, size, size, 4096)
    headers += struct.pack(
        "<IIQQQQQQ",
        2,
        6,
        dynamic_offset,
        address + dynamic_offset,
        0,
        entries * 16,
        entries * 16,
        8,
    )
    return (
        header
        + headers
        + b"".join(struct.pack("<QQ", *item) for item in dynamic)
        + strings
        + versions
    )


def tar_bytes(files: dict[str, tuple[bytes, int]], symlink: str | None = None) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.GNU_FORMAT) as archive:
        for name, (data, mode) in files.items():
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            entry.mode = mode
            archive.addfile(entry, io.BytesIO(data))
        if symlink:
            entry = tarfile.TarInfo(symlink)
            entry.type = tarfile.SYMTYPE
            entry.linkname = "/unowned"
            archive.addfile(entry)
    return gzip.compress(output.getvalue(), mtime=0)


def ar_bytes(members: dict[str, bytes]) -> bytes:
    result = bytearray(b"!<arch>\n")
    for name, data in members.items():
        result.extend(
            (
                f"{name + '/':<16}{0:<12}{0:<6}{0:<6}{0o100644:<8o}{len(data):<10}`\n"
            ).encode()
        )
        result.extend(data)
        if len(data) % 2:
            result.extend(b"\n")
    return bytes(result)


def fixture(
    tmp_path: Path,
) -> tuple[Path, Path, str, dict[str, tuple[bytes, int]], dict[str, tuple[bytes, int]]]:
    stage = tmp_path / "owned stage 空间"
    (stage / "japp-orchestrator/_internal").mkdir(parents=True)
    (stage / "japp-orchestrator/japp-orchestrator").write_bytes(elf(["libc.so.6"]))
    (stage / "japp-orchestrator/_internal/libnative.so").write_bytes(elf(["libc.so.6"]))
    manifest = {
        "schema_version": "1.0.0",
        "target": "x86_64-unknown-linux-gnu",
        "entrypoint": "japp-orchestrator/japp-orchestrator",
        "source_inputs": dict.fromkeys(
            [
                "orchestrator_wheel_sha256",
                "contracts_wheel_sha256",
                "runtime_requirements_sha256",
                "build_requirements_sha256",
            ],
            "a" * 64,
        ),
        "files": [
            {
                "path": path.relative_to(stage).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in sorted(stage.rglob("*"))
            if path.is_file()
        ],
    }
    (stage / "manifest.json").write_text(json.dumps(manifest))
    expected = hashlib.sha256((stage / "manifest.json").read_bytes()).hexdigest()
    data = {
        RUNTIME + path.relative_to(stage).as_posix(): (
            path.read_bytes(),
            0o755 if path.name == "japp-orchestrator" else 0o644,
        )
        for path in stage.rglob("*")
        if path.is_file()
    }
    data[MAIN] = (elf(["libwebkit2gtk-4.1.so.0", "libgtk-3.so.0", "libc.so.6"]), 0o755)
    data[DESKTOP] = (
        (
            b"[Desktop Entry]\nType=Application\nName=Desktop App\n"
            b"Exec=/usr/bin/japp-desktop\nTryExec=/usr/bin/japp-desktop\n"
            b"Terminal=false\n"
        ),
        0o644,
    )
    control = {
        "control": (
            (
                b"Package: desktop-app\nVersion: 0.0.1\nArchitecture: amd64\n"
                b"Depends: libwebkit2gtk-4.1-0, libgtk-3-0\n"
                b"Description: Synthetic inspector fixture\n"
            ),
            0o644,
        ),
        "md5sums": (b"non-authoritative fixture\n", 0o644),
    }
    package = tmp_path / "owned.deb"
    write_package(package, data, control)
    return package, stage, expected, data, control


def write_package(
    package: Path,
    data: dict[str, tuple[bytes, int]],
    control: dict[str, tuple[bytes, int]],
    symlink: str | None = None,
) -> None:
    package.write_bytes(
        ar_bytes(
            {
                "debian-binary": b"2.0\n",
                "control.tar.gz": tar_bytes(control),
                "data.tar.gz": tar_bytes(data, symlink),
            }
        )
    )


def test_valid_archive_binds_runtime_and_keeps_native_dependency_gnome_pending(
    tmp_path: Path,
) -> None:
    package, stage, expected, _, _ = fixture(tmp_path)
    result = INSPECTOR.inspect_deb(package, stage, expected)
    assert (
        result["status"]
        == "ARCHIVE_BYTES_PASS_NATIVE_DEPENDENCIES_AND_LIFECYCLE_PENDING"
    )
    assert result["architecture"] == "amd64"
    assert result["default_gnome_certified"] is False
    assert result["runtime_manifest_sha256"] == expected
    assert result["elf"][MAIN]["needed"] == [
        "libwebkit2gtk-4.1.so.0",
        "libgtk-3.so.0",
        "libc.so.6",
    ]


def test_sidecar_postprocessing_and_matching_stage_edits_cannot_self_authorize(
    tmp_path: Path,
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    name = "japp-orchestrator/_internal/libnative.so"
    (stage / name).write_bytes(b"postprocessed")
    data[RUNTIME + name] = (b"postprocessed", 0o644)
    write_package(package, data, control)
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)


@pytest.mark.parametrize(
    "bad",
    [
        "../outside",
        "/outside",
        "usr/lib/Desktop App/runtime/japp-orchestrator\\japp-orchestrator",
    ],
)
def test_archive_path_escape_and_literal_backslash_are_rejected(
    tmp_path: Path, bad: str
) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    data[bad] = (b"unowned", 0o644)
    write_package(package, data, control)
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_symlink_and_maintainer_script_are_rejected(tmp_path: Path) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    write_package(package, data, control, symlink="usr/lib/redirect")
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)
    control["postinst"] = (b"#!/bin/sh\nexit 0\n", 0o755)
    write_package(package, data, control)
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)


@pytest.mark.parametrize(
    "change",
    [
        "architecture",
        "dependency",
        "desktop",
        "mode",
        "elf",
        "runpath",
        "glibc",
        "extra",
    ],
)
def test_package_contract_mutations_fail_closed(tmp_path: Path, change: str) -> None:
    package, stage, expected, data, control = fixture(tmp_path)
    if change == "architecture":
        control["control"] = (control["control"][0].replace(b"amd64", b"arm64"), 0o644)
    elif change == "dependency":
        control["control"] = (
            control["control"][0].replace(b"libwebkit2gtk-4.1-0", b"unrelated"),
            0o644,
        )
    elif change == "desktop":
        data[DESKTOP] = (
            data[DESKTOP][0].replace(b"Terminal=false", b"Terminal=true"),
            0o644,
        )
    elif change == "mode":
        data[MAIN] = (data[MAIN][0], 0o4755)
    elif change == "elf":
        data[MAIN] = (b"not ELF", 0o755)
    elif change == "runpath":
        data[MAIN] = (
            elf(
                ["libwebkit2gtk-4.1.so.0", "libgtk-3.so.0", "libc.so.6"],
                "/build/private",
            ),
            0o755,
        )
    elif change == "glibc":
        data[MAIN] = (
            elf(
                ["libwebkit2gtk-4.1.so.0", "libgtk-3.so.0", "libc.so.6"],
                glibc="GLIBC_9.99",
            ),
            0o755,
        )
    else:
        data[RUNTIME + "undeclared"] = (b"extra", 0o644)
    write_package(package, data, control)
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_absent_or_oversized_package_and_wrong_manifest_fail(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package, stage, expected, _, _ = fixture(tmp_path)
    with pytest.raises(ValueError, match="Compile-bound runtime"):
        INSPECTOR.inspect_deb(package, stage, "0" * 64)
    monkeypatch.setattr(INSPECTOR, "MAX_ARCHIVE_BYTES", 32, raising=False)
    with pytest.raises(
        ValueError,
        match=PACKAGE_REJECTION,
    ):
        INSPECTOR.inspect_deb(package, stage, expected)


def test_ubuntu_builder_accepts_only_native_noble_x64() -> None:
    BUILDER.validate_host(
        "x86_64-unknown-linux-gnu",
        "Linux",
        "x86_64",
        {"ID": "ubuntu", "VERSION_ID": "24.04"},
    )
    for target, system, machine, release in [
        (
            "aarch64-unknown-linux-gnu",
            "Linux",
            "arm64",
            {"ID": "ubuntu", "VERSION_ID": "24.04"},
        ),
        ("x86_64-unknown-linux-gnu", "Darwin", "x86_64", {}),
        (
            "x86_64-unknown-linux-gnu",
            "Linux",
            "x86_64",
            {"ID": "ubuntu", "VERSION_ID": "22.04"},
        ),
        (
            "x86_64-unknown-linux-gnu",
            "Linux",
            "x86_64",
            {"ID": "debian", "VERSION_ID": "12"},
        ),
    ]:
        with pytest.raises(ValueError, match=r"Ubuntu24\.04 x64"):
            BUILDER.validate_host(target, system, machine, release)


def test_linux_runtime_branch_never_uses_sdk_environment_fallback() -> None:
    native = (
        Path(__file__).parents[2]
        / "apps/desktop/src-tauri/src/service/runtime_descriptor.rs"
    )
    source = native.read_text()
    linux = source.split('#[cfg(target_os = "linux")]', 1)[1].split(
        '#[cfg(not(target_os = "linux"))]', 1
    )[0]
    assert "linux_resources::resource_root" in linux
    assert "app.path()" not in linux
    helper = (
        native.with_name("linux_resources.rs").read_text().split("#[cfg(test)]", 1)[0]
    )
    assert "var_os" not in helper
    assert "std::env" not in helper
    assert "APPDIR" not in helper
    assert "APPIMAGE" not in helper
