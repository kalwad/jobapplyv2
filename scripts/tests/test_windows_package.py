from __future__ import annotations

import importlib.util
import json
import struct
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "windows_package", Path(__file__).parents[1] / "windows_package.py"
)
assert spec is not None
assert spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def image(path: Path, subsystem: int, machine: int = 0x8664) -> None:
    raw = bytearray(256)
    raw[:2] = b"MZ"
    struct.pack_into("<I", raw, 60, 64)
    raw[64:68] = b"PE\0\0"
    struct.pack_into("<H", raw, 68, machine)
    struct.pack_into("<H", raw, 84, 112)
    struct.pack_into("<H", raw, 88, 0x20B)
    struct.pack_into("<H", raw, 156, subsystem)
    path.write_bytes(raw)


def fixture(tmp: Path) -> tuple[Path, Path, str]:
    gui = tmp / "app.exe"
    image(gui, 2)
    root = tmp / "payload"
    (root / "japp-orchestrator").mkdir(parents=True)
    exe = root / "japp-orchestrator/japp-orchestrator.exe"
    image(exe, 3)
    value = {
        "schema_version": "1.0.0",
        "target": module.TARGET,
        "entrypoint": "japp-orchestrator/japp-orchestrator.exe",
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
                "path": "japp-orchestrator/japp-orchestrator.exe",
                "bytes": exe.stat().st_size,
                "sha256": module.digest(exe),
            }
        ],
    }
    (root / "manifest.json").write_text(json.dumps(value))
    return gui, root, module.digest(root / "manifest.json")


def test_console_gui_or_wrong_architecture_is_rejected(tmp_path: Path) -> None:
    for machine, subsystem in [(0x14C, 2), (0x8664, 3)]:
        p = tmp_path / "bad.exe"
        image(p, subsystem, machine)
        with pytest.raises(ValueError, match="PE"):
            module.pe(p, 2)


def test_wrong_compile_bound_manifest_hash_is_rejected(tmp_path: Path) -> None:
    _, root, _ = fixture(tmp_path)
    with pytest.raises(ValueError, match="manifest"):
        module.runtime(root, "b" * 64)


def test_extra_or_changed_payload_cannot_enter_portable_build(tmp_path: Path) -> None:
    _, root, expected = fixture(tmp_path)
    (root / "extra.dll").write_bytes(b"undeclared")
    with pytest.raises(ValueError, match="inventory"):
        module.runtime(root, expected)


def test_existing_unrelated_destination_is_preserved(tmp_path: Path) -> None:
    gui, root, expected = fixture(tmp_path)
    dest = tmp_path / "owned"
    dest.mkdir()
    keep = dest / "keep"
    keep.write_bytes(b"unrelated")
    with pytest.raises(ValueError, match="fresh"):
        module.stage(gui, root, dest, expected)
    assert keep.read_bytes() == b"unrelated"


def test_alias_ads_and_reserved_payload_names_are_rejected() -> None:
    for p in ["a/x:secret", "A/CON.dll", "a/x.", "a/../x", "a/Ω.dll", "a/x\\y"]:
        with pytest.raises(ValueError, match="member"):
            module.member(p)
    assert module.member("A/X.dll") == module.member("a/x.DLL")


def test_staged_gui_mutation_cannot_pass_inspection(tmp_path: Path) -> None:
    gui, root, expected = fixture(tmp_path)
    dest = tmp_path / "out"
    module.stage(gui, root, dest, expected)
    (dest / "desktop.exe").write_bytes(b"mutant")
    with pytest.raises(ValueError, match="inventory"):
        module.inspect(dest)


def test_valid_synthetic_folder_retains_full_payload_and_inventory(
    tmp_path: Path,
) -> None:
    gui, root, expected = fixture(tmp_path)
    dest = tmp_path / "Build Test Ω漢字"
    result = module.stage(gui, root, dest, expected)
    module.inspect(dest)
    assert result["runtime_manifest_sha256"] == expected
    assert (dest / "runtime/japp-orchestrator/japp-orchestrator.exe").read_bytes() == (
        root / "japp-orchestrator/japp-orchestrator.exe"
    ).read_bytes()


def test_failed_semantics_leave_finite_bound_inspection_receipt(tmp_path: Path) -> None:
    gui, root, expected = fixture(tmp_path)
    dest = tmp_path / "out"
    module.stage(gui, root, dest, expected)
    (dest / "desktop.exe").write_bytes(b"mutant")
    receipt = tmp_path / "receipt.json"
    with pytest.raises(ValueError, match="inventory"):
        module.inspect_with_receipt(dest, receipt)
    value = json.loads(receipt.read_text())
    assert value["result"] == "FAILED"
    assert value["reason"] == "INVALID_BUILD"
    assert module.__file__ is not None
    assert value["source_sha256"] == module.digest(Path(module.__file__))
    assert (tmp_path / "receipt.inspector.py").read_bytes() == Path(
        module.__file__
    ).read_bytes()
