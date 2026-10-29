"""Pure S/API-head, M/build-head and T/tree joins; no Git or package actors."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from argparse import Namespace
from copy import deepcopy
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
V2 = Path(__file__).parents[4] / "v2/after/scripts"
sys.path.insert(0, str(SOURCE))
if V2.is_dir():
    sys.path.append(str(V2))
    sys.path.append(str(V2.parents[1] / "existing-inputs/scripts"))


def load(name: str, root: Path = SOURCE) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, root / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


@pytest.fixture
def binding(tmp_path: Path) -> dict[str, Any]:
    vm = load("ubuntu_gnome_vm")
    root, proof = tmp_path / "source", tmp_path / "proof"
    (root / "scripts/linux_gnome").mkdir(parents=True)
    proof.mkdir()
    projection = {}
    for name in ("ubuntu_gnome_vm.py", "ubuntu_gnome_retention.py", *vm.SCRIPTS):
        path = SOURCE / name
        if not path.exists():
            path = V2 / name
        raw = path.read_bytes()
        (root / "scripts/linux_gnome" / name).write_bytes(raw)
        projection["scripts/linux_gnome/" + name] = hashlib.sha256(raw).hexdigest()
    vm = load("ubuntu_gnome_vm", root / "scripts/linux_gnome")
    args = Namespace(
        source=root,
        proof=proof,
        expected_head="a" * 40,
        package_build_head="b" * 40,
        source_tree="c" * 40,
    )
    export = {
        "expected_head": args.package_build_head,
        "build_git_binding": {
            "head": args.package_build_head,
            "tree": args.source_tree,
        },
        "shipping_source_projection": projection,
    }

    class Owner:
        head: str = "a" * 40
        tree: str = "c" * 40
        status: bytes = b""

        def command(self, argv: list[str]) -> bytes:
            if "rev-parse" in argv:
                return (self.head + "\n" + self.tree + "\n").encode()
            assert "status" in argv
            return self.status

    return {"vm": vm, "args": args, "export": export, "owner": Owner()}


def test_distinct_source_and_original_merge_preserve_full_hash_projection(
    binding: dict[str, Any],
) -> None:
    h = binding
    rows, git = h["vm"].bind_source(h["args"], h["owner"], h["export"])
    assert git == ["a" * 40, "c" * 40]
    assert {name: row["sha256"] for name, row in rows.items()} == h["export"][
        "shipping_source_projection"
    ]
    subject = json.loads((h["args"].proof / "source-build-binding.json").read_text())
    assert subject == {
        "checked_out_source_sha": "a" * 40,
        "checked_out_source_tree": "c" * 40,
        "original_package_build_sha": "b" * 40,
        "original_package_build_tree": "c" * 40,
    }


@pytest.mark.parametrize(
    "case", ["actual_head", "actual_tree", "build_head", "build_tree", "dirty", "hash"]
)
def test_different_merge_tree_or_original_shipping_input_is_refused(
    binding: dict[str, Any], case: str
) -> None:
    h = binding
    if case == "actual_head":
        h["owner"].head = "d" * 40
    elif case == "actual_tree":
        h["owner"].tree = "d" * 40
    elif case == "build_head":
        h["export"]["build_git_binding"]["head"] = "d" * 40
    elif case == "build_tree":
        h["export"]["build_git_binding"]["tree"] = "d" * 40
    elif case == "dirty":
        h["owner"].status = b" M scripts/linux_gnome/ubuntu_gnome_vm.py\0"
    else:
        (h["args"].source / "scripts/linux_gnome/ubuntu_gnome_guest.py").write_bytes(
            b"changed"
        )
    with pytest.raises(
        ValueError, match=r"checkout revision|S/tree T|must be clean|source differs"
    ):
        h["vm"].bind_source(h["args"], h["owner"], h["export"])


@pytest.mark.parametrize(
    "case", ["exact", "after", "head", "tree", "projection", "empty"]
)
def test_export_original_before_after_receipts_bind_actual_build(
    case: str,
) -> None:
    exporter = load("ubuntu_gnome_package_export")
    before = {
        "head": "b" * 40,
        "tree": "c" * 40,
        "files": {"source": {"sha256": "d" * 64}},
    }
    after = deepcopy(before)
    inputs = {"expected_git_head": "b" * 40, "source_projection": {"source": "d" * 64}}
    if case == "after":
        after["head"] = "e" * 40
    elif case == "head":
        inputs["expected_git_head"] = "e" * 40
    elif case == "tree":
        before["tree"] = after["tree"] = "invalid"
    elif case == "projection":
        inputs["source_projection"] = {"source": "e" * 64}
    elif case == "empty":
        before["files"] = after["files"] = {}
    if case == "exact":
        assert exporter.original_build_binding(inputs, before, after, "b" * 40) == {
            "head": "b" * 40,
            "tree": "c" * 40,
        }
    else:
        with pytest.raises(ValueError, match=r"Original build|source receipt"):
            exporter.original_build_binding(inputs, before, after, "b" * 40)
