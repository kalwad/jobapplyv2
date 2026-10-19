"""Remove sdist approval from an actual uv --locked runtime export; no resolution."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tomllib
from pathlib import Path
from typing import TypedDict


class _LockedPackage(TypedDict):
    name: str
    version: str
    source: object
    dependencies: object
    wheels: object


type _Identity = tuple[str, str]
type _Selected = tuple[str, str, str, list[str]]


def _text_record(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("Locked package field must be an object")
    result: dict[str, str] = {}
    for name, item in value.items():
        if not isinstance(name, str) or not isinstance(item, str):
            raise ValueError("Locked package fields must be text")
        result[name] = item
    return result


def _records(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ValueError("Locked package field must be a list")
    return [_text_record(item) for item in value]


def _wheel_records(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ValueError("Locked wheel field must be a list")
    result: list[dict[str, str]] = []
    for row in value:
        if not isinstance(row, dict) or not isinstance(row.get("hash"), str):
            raise ValueError("Locked wheel hash must be text")
        # uv.lock wheel rows also carry URL and integer size metadata. They
        # are not hash-approval fields; preserve the original hash-only use.
        result.append({"hash": row["hash"]})
    return result


def _package(value: object) -> _LockedPackage:
    if not isinstance(value, dict):
        raise ValueError("Locked package must be an object")
    name, version = value.get("name"), value.get("version")
    if not isinstance(name, str) or not isinstance(version, str):
        raise ValueError("Locked package name and version must be text")
    return {
        "name": name,
        "version": version,
        "source": value.get("source"),
        "dependencies": value.get("dependencies", []),
        "wheels": value.get("wheels", []),
    }


def _locked_closure(
    lock: Path,
) -> tuple[dict[_Identity, _LockedPackage], set[_Identity]]:
    raw: object = tomllib.loads(lock.read_text(encoding="utf-8"))["package"]
    if not isinstance(raw, list):
        raise ValueError("Locked packages must be a list")
    resolved = [_package(item) for item in raw]
    packages = {
        (package["name"].lower().replace("_", "-"), package["version"]): package
        for package in resolved
    }
    by_name = {package["name"]: package for package in resolved}
    if len(by_name) != len(resolved):
        raise ValueError("Version-disambiguated runtime graph needs explicit review")
    pending = ["orchestrator", "japp-contracts"]
    visited: set[str] = set()
    closure: set[_Identity] = set()
    while pending:
        name = pending.pop()
        if name in visited:
            continue
        visited.add(name)
        package = by_name[name]
        if name not in {"orchestrator", "japp-contracts"}:
            if package["source"] != {"registry": "https://pypi.org/simple"}:
                raise ValueError("Unexpected runtime source")
            closure.add((name.lower().replace("_", "-"), package["version"]))
        for dependency in _records(package["dependencies"]):
            if set(dependency) != {"name"}:
                raise ValueError(
                    "Conditional or extra runtime graph needs explicit selection"
                )
            pending.append(dependency["name"])
    return packages, closure


def _selected_export(
    raw: str, packages: dict[_Identity, _LockedPackage]
) -> list[_Selected]:
    selected: list[_Selected] = []
    for line in raw.splitlines():
        value = line.strip()
        if not value or value.startswith(("#", "--hash=")):
            continue
        match = re.fullmatch(
            r"([A-Za-z0-9_.-]+)==([^ ;\\]+)(\s*;\s*[^\\]+)?\s*\\?", value
        )
        if match is None:
            raise ValueError("Non-exact requirement in locked runtime export")
        name, version, marker = match.groups()
        if marker is not None:
            raise ValueError("Unconditional runtime export cannot disable a dependency")
        identity = (name.lower().replace("_", "-"), version)
        if identity not in packages:
            raise ValueError("Export version is not locked")
        package = packages[identity]
        if package["source"] != {"registry": "https://pypi.org/simple"}:
            raise ValueError("Non-PyPI runtime dependency")
        hashes = sorted({wheel["hash"] for wheel in _wheel_records(package["wheels"])})
        if not hashes or any(
            re.fullmatch(r"sha256:[0-9a-f]{64}", pin) is None for pin in hashes
        ):
            raise ValueError("Exact runtime wheel hash unavailable")
        selected.append((name, version, "", hashes))
    if not selected or len(
        {(name.lower().replace("_", "-"), version) for name, version, _, _ in selected}
    ) != len(selected):
        raise ValueError("Empty or duplicated export")
    return selected


def make(lock: Path, exported: Path, destination: Path) -> dict[str, object]:
    if destination.exists():
        raise ValueError("Fresh output required")
    raw = exported.read_text(encoding="utf-8")
    packages, closure = _locked_closure(lock)
    selected = _selected_export(raw, packages)
    if {
        (name.lower().replace("_", "-"), version) for name, version, _, _ in selected
    } != closure:
        raise ValueError("Export differs from the exact locked runtime closure")
    lines = [
        "# Derived from actual uv --locked --no-dev --no-emit-workspace export.",
        "# Only uv.lock wheel hashes retained; no sdist is authorized.",
    ]
    for name, version, marker, hashes in selected:
        lines.append(name + "==" + version + marker + " \\")
        for index, value in enumerate(hashes):
            lines.append(
                "    --hash=" + value + (" \\" if index + 1 < len(hashes) else "")
            )
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {
        "uv_lock_sha256": hashlib.sha256(lock.read_bytes()).hexdigest(),
        "actual_export_sha256": hashlib.sha256(exported.read_bytes()).hexdigest(),
        "wheel_only_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "packages": [
            {"name": name, "version": version, "marker": marker, "wheel_hashes": hashes}
            for name, version, marker, hashes in selected
        ],
        "resolution_performed": False,
        "sdist_hashes_authorized": 0,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ("lock", "exported", "destination", "receipt"):
        parser.add_argument("--" + argument, type=Path, required=True)
    args = parser.parse_args()
    receipt = make(args.lock, args.exported, args.destination)
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
