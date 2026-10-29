"""Installed MSVC default selection with no native tool or process execution."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from native_package_ci import declared_dumpbin


def installed(tmp_path: Path) -> tuple[Path, Path, Path]:
    root = tmp_path / "Visual Studio 应用"
    declaration = root / "VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt"
    declaration.parent.mkdir(parents=True)
    declaration.write_bytes(b"14.44.35207\r\n")
    tool = root / "VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/dumpbin.exe"
    tool.parent.mkdir(parents=True)
    tool.write_bytes(b"synthetic inspection tool, never executed")
    proof = tmp_path / "proof"
    proof.mkdir()
    return root, declaration, proof


def test_declared_default_wins_over_other_installed_toolsets(tmp_path: Path) -> None:
    root, declaration, proof = installed(tmp_path)
    for version in ("14.29.30133", "14.51.36231"):
        other = root / f"VC/Tools/MSVC/{version}/bin/Hostx64/x64/dumpbin.exe"
        other.parent.mkdir(parents=True)
        other.write_bytes(b"unselected synthetic tool")
    chosen = declared_dumpbin((str(root) + "\r\n").encode(), proof)
    assert chosen == root / "VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/dumpbin.exe"
    receipt = json.loads((proof / "msvc-default-selection.json").read_text())
    assert receipt["version"] == "14.44.35207"
    assert (
        receipt["declaration_sha256"]
        == hashlib.sha256(declaration.read_bytes()).hexdigest()
    )
    assert receipt["image_sha256"] == hashlib.sha256(chosen.read_bytes()).hexdigest()
    assert (proof / "msvc-default-version.stdout").read_bytes() == b"14.44.35207\r\n"


@pytest.mark.parametrize("output", [b"", b"relative/installation\n", b"/one\n/two\n"])
def test_missing_relative_or_ambiguous_installation_refuses(
    tmp_path: Path, output: bytes
) -> None:
    with pytest.raises(ValueError, match="installation"):
        declared_dumpbin(output, tmp_path)


@pytest.mark.parametrize(
    "value",
    [b"", b"../14.44.35207", b"14.44.35207\n14.51.36231", b"14.x.1", b"1" * 129],
)
def test_malformed_default_does_not_guess_an_installed_version(
    tmp_path: Path, value: bytes
) -> None:
    root, declaration, proof = installed(tmp_path)
    declaration.write_bytes(value)
    with pytest.raises(ValueError, match="default"):
        declared_dumpbin(str(root).encode(), proof)


def test_missing_declaration_refuses_instead_of_using_the_only_tool(
    tmp_path: Path,
) -> None:
    root, declaration, proof = installed(tmp_path)
    declaration.unlink()
    with pytest.raises(ValueError, match="default"):
        declared_dumpbin(str(root).encode(), proof)


def test_missing_declared_tool_refuses_instead_of_selecting_another(
    tmp_path: Path,
) -> None:
    root, declaration, proof = installed(tmp_path)
    declaration.write_bytes(b"14.51.36231\r\n")
    with pytest.raises(ValueError, match="default"):
        declared_dumpbin(str(root).encode(), proof)


def test_nonregular_declaration_refuses_before_read(tmp_path: Path) -> None:
    root, declaration, proof = installed(tmp_path)
    declaration.unlink()
    declaration.mkdir()
    with pytest.raises(ValueError, match="default"):
        declared_dumpbin(str(root).encode(), proof)
