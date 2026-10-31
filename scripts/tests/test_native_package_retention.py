"""Package evidence curation tool roles; synthetic files only, no native tool."""

from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

import pytest
from native_package_retention import _keep_tool_images, _Retention

SCRIPTS = Path(__file__).resolve().parents[1]


def _coordinator_roles() -> set[str]:
    """Every tool role native_package_ci.py can write into native-inputs.json."""
    tree = ast.parse((SCRIPTS / "native_package_ci.py").read_text(encoding="utf-8"))
    roles: set[str] = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Subscript)
            and isinstance(node.value, ast.Name)
            and node.value.id == "role_tools"
        ):
            key = node.slice
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                roles.add(key.value)
            elif (
                isinstance(key, ast.BinOp)
                and isinstance(key.right, ast.Constant)
                and key.right.value == "_real"
            ):
                roles.update({"cargo_real", "rustc_real"})
        if (
            isinstance(node, ast.AnnAssign | ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "role_tools"
                for target in (
                    node.targets if isinstance(node, ast.Assign) else [node.target]
                )
            )
            and isinstance(node.value, ast.DictComp)
        ):
            for generator in node.value.generators:
                if isinstance(generator.iter, ast.Tuple):
                    roles.update(
                        element.value
                        for element in generator.iter.elts
                        if isinstance(element, ast.Constant)
                        and isinstance(element.value, str)
                    )
    return roles


def _retention_allowlist() -> set[str]:
    tree = ast.parse(
        (SCRIPTS / "native_package_retention.py").read_text(encoding="utf-8")
    )
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "allowed"
                for target in node.targets
            )
            and isinstance(node.value, ast.Set)
        ):
            return {
                element.value
                for element in node.value.elts
                if isinstance(element, ast.Constant) and isinstance(element.value, str)
            }
    raise AssertionError("retention allowlist not found")


def test_every_coordinator_tool_role_is_retainable() -> None:
    roles = _coordinator_roles()
    assert {"python", "git", "rustc_real", "dumpbin", "rust_lld", "clang_cl"} <= roles
    assert roles <= _retention_allowlist()


def _pinned(tmp_path: Path, roles: dict[str, bytes]) -> Path:
    base = tmp_path / "proof"
    images = tmp_path / "images 应用"
    images.mkdir(parents=True)
    base.mkdir()
    tools: dict[str, dict[str, str]] = {}
    for role, body in roles.items():
        image = images / (role + ".exe")
        image.write_bytes(body)
        tools[role] = {
            "path": str(image),
            "resolved_path": str(image),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
    (base / "native-inputs.json").write_text(json.dumps({"tools": tools}))
    return base


def test_windows_build_tool_roles_are_retained_once_per_image(
    tmp_path: Path,
) -> None:
    base = _pinned(
        tmp_path,
        {
            "rust_lld": b"synthetic lld",
            "clang_cl": b"synthetic clang",
            "llvm_lib": b"synthetic clang",
            "dumpbin": b"synthetic dumpbin",
        },
    )
    retention = _Retention(tmp_path / "retained")
    roles = _keep_tool_images(base, retention)
    assert set(roles) == {"rust_lld", "clang_cl", "llvm_lib", "dumpbin"}
    assert roles["clang_cl"]["retained"] == roles["llvm_lib"]["retained"]
    assert len(retention.selected) == 3
    for row in roles.values():
        kept = tmp_path / "retained" / row["retained"]
        assert hashlib.sha256(kept.read_bytes()).hexdigest() == row["sha256"]


def test_unknown_tool_role_is_still_refused(tmp_path: Path) -> None:
    base = _pinned(tmp_path, {"cl_exe": b"unexpected compiler"})
    with pytest.raises(ValueError, match="Unexpected retained tool role"):
        _keep_tool_images(base, _Retention(tmp_path / "retained"))


def test_changed_tool_image_is_refused(tmp_path: Path) -> None:
    base = _pinned(tmp_path, {"rust_lld": b"synthetic lld"})
    (tmp_path / "images 应用/rust_lld.exe").write_bytes(b"replaced after pinning")
    with pytest.raises(ValueError, match="Pinned tool image changed"):
        _keep_tool_images(base, _Retention(tmp_path / "retained"))
