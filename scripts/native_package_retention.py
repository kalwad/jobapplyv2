"""UNEXECUTED finite artifact curation. No project imports or payload execution."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import stat
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import TypedDict

MAX_TOTAL = 1024 * 1024 * 1024
MAX_FILE = 512 * 1024 * 1024
MAX_FILES = 4096
MAX_PACKAGES = 4
MAX_PORTABLE_NODES = 2048
MAX_PORTABLE_BYTES = 512 * 1024 * 1024


class RetainedFile(TypedDict):
    bytes: int
    sha256: str
    original: str


class ToolRole(TypedDict):
    invocation: str
    resolved_path: str
    sha256: str
    retained: str


def _record(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("Retention record must be an object")
    result: dict[str, object] = {}
    for name, item in value.items():
        if not isinstance(name, str):
            raise ValueError("Retention record names must be text")
        result[name] = item
    return result


def _text(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Retention field must be text")
    return value


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while data := stream.read(65536):
            value.update(data)
    return value.hexdigest()


@dataclass
class _Retention:
    output: Path
    selected: dict[str, RetainedFile] = field(default_factory=dict)
    total: int = 0

    def keep(self, source: Path, relative: str) -> None:
        info = source.lstat()
        if (
            not stat.S_ISREG(info.st_mode)
            or getattr(info, "st_file_attributes", 0) & 0x400
        ):
            raise ValueError("Regular evidence only")
        if (
            info.st_size > MAX_FILE
            or self.total + info.st_size > MAX_TOTAL
            or len(self.selected) >= MAX_FILES
        ):
            raise ValueError("Finite retention bound exceeded")
        path = self.output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, path)
        pin = digest(source)
        if digest(path) != pin:
            raise ValueError("Retention copy changed")
        self.selected[relative] = {
            "bytes": info.st_size,
            "sha256": pin,
            "original": str(source),
        }
        self.total += info.st_size


def _keep_worker(base: Path, retention: _Retention) -> None:
    # Top-level worker receipts/raw output; no environment/cache/target inventory.
    for path in sorted(base.iterdir()):
        if path.is_file() and (
            path.suffix in {".json", ".stdout", ".stderr"}
            or path.name == "owned-command-helper.py"
        ):
            retention.keep(path, "worker/" + path.name)
    preflight = base / "pipeline-preflight"
    if preflight.is_dir():
        for path in sorted(preflight.iterdir()):
            if path.is_file() and path.suffix in {".json", ".stdout", ".stderr"}:
                retention.keep(path, "pipeline-preflight/" + path.name)


def _keep_tool_images(base: Path, retention: _Retention) -> dict[str, ToolRole]:
    tool_roles: dict[str, ToolRole] = {}
    tool_images: dict[str, str] = {}
    pins = base / "native-inputs.json"
    if not pins.is_file():
        return tool_roles
    spec = _record(json.loads(pins.read_text()))
    tools = _record(spec["tools"])
    allowed = {
        "python",
        "uv",
        "node",
        "pnpm_js",
        "build_pnpm",
        "cargo",
        "rustc",
        "cargo_real",
        "rustc_real",
        "rustup",
        "git",
        "dumpbin",
        "rust_lld",
        "clang_cl",
        "llvm_lib",
        "dpkg_deb",
    }
    if set(tools) - allowed:
        raise ValueError("Unexpected retained tool role")
    for role, value in tools.items():
        row = _record(value)
        pin = _text(row["sha256"])
        resolved = _text(row["resolved_path"])
        source = Path(resolved)
        if not source.is_absolute() or digest(source) != pin:
            raise ValueError("Pinned tool image changed before retention")
        if pin not in tool_images:
            relative = "tool-images/" + pin + "-" + source.name
            retention.keep(source, relative)
            tool_images[pin] = relative
        tool_roles[role] = {
            "invocation": _text(row["path"]),
            "resolved_path": resolved,
            "sha256": pin,
            "retained": tool_images[pin],
        }
    return tool_roles


def _keep_runtime_build(pipeline: Path, retention: _Retention) -> None:
    runtime = pipeline / "runtime-build"
    if runtime.is_dir():
        for path in sorted(runtime.iterdir()):
            if path.is_file() and path.suffix in {".json", ".stdout", ".stderr", ".py"}:
                retention.keep(path, "runtime-build/" + path.name)
        inputs = runtime / "inputs"
        if inputs.is_dir():
            for path in sorted(inputs.iterdir()):
                if path.is_file():
                    retention.keep(path, "runtime-build/inputs/" + path.name)
    inspection = pipeline / "deb-inspection"
    if inspection.is_dir():
        for path in sorted(inspection.iterdir()):
            if path.is_file():
                retention.keep(path, "deb-inspection/" + path.name)


def _keep_portable(base: Path, pipeline: Path, retention: _Retention) -> None:
    portable = pipeline / "portable"
    if not portable.is_dir():
        return
    # Retain the actual complete delivered folder once, not build caches.
    archive = base / "windows-portable.zip"
    nodes = 0
    size = 0
    with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as target:
        for path in sorted(portable.rglob("*")):
            info = path.lstat()
            nodes += 1
            if nodes > MAX_PORTABLE_NODES:
                raise ValueError("Portable node bound")
            if path.is_symlink() or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Portable reparse member")
            if path.is_dir():
                continue
            if not stat.S_ISREG(info.st_mode):
                raise ValueError("Portable regular member required")
            size += info.st_size
            if size > MAX_PORTABLE_BYTES:
                raise ValueError("Portable byte bound")
            target.write(path, path.relative_to(portable).as_posix())
    retention.keep(archive, "packages/windows-portable.zip")


def _keep_actor(pipeline: Path, retention: _Retention) -> None:
    image = pipeline / "actor-image.json"
    if image.is_file():
        row = _record(json.loads(image.read_text()))
        path = Path(_text(row["path"])).resolve()
        target = (pipeline / "target").resolve()
        if target not in path.parents or digest(path) != _text(row["sha256"]):
            raise ValueError("Actor image reference escaped or changed")
        retention.keep(path, "native-helper/" + path.name)


def _keep_pipeline(base: Path, retention: _Retention) -> None:
    pipeline = base / "pipeline"
    if not pipeline.is_dir():
        return
    for path in sorted(pipeline.iterdir()):
        if path.is_file() and path.suffix in {
            ".json",
            ".stdout",
            ".stderr",
            ".rs",
            ".txt",
            ".lock",
            ".py",
        }:
            retention.keep(path, "pipeline/" + path.name)
    _keep_runtime_build(pipeline, retention)
    packages = list((pipeline / "target/debug/bundle/deb").glob("*.deb"))
    if len(packages) > MAX_PACKAGES:
        raise ValueError("Unexpected package count")
    for path in packages:
        retention.keep(path, "packages/" + path.name)
    _keep_portable(base, pipeline, retention)
    _keep_actor(pipeline, retention)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proof", type=Path, required=True)
    parser.add_argument("--sdk", type=Path, required=True)
    args = parser.parse_args()
    base = args.proof.resolve()
    sdk = args.sdk.resolve()
    output = base / "retained"
    if not base.is_absolute() or output.exists():
        raise ValueError("Fresh finite retention directory required")
    base.mkdir(exist_ok=True)
    output.mkdir()
    retention = _Retention(output)
    _keep_worker(base, retention)
    tool_roles = _keep_tool_images(base, retention)
    _keep_pipeline(base, retention)
    if sdk.is_dir():
        for path in sorted(sdk.iterdir()):
            if path.is_file():
                retention.keep(path, "sdk/" + path.name)
    manifest = {
        "scope": (
            "Finite selected raw/build/package/helper evidence; "
            "no whole TEMP, target, cache or interpreter image"
        ),
        "files": retention.selected,
        "file_count": len(retention.selected),
        "bytes": retention.total,
        "subject_execution": False,
        "selected_tool_image_roles": tool_roles,
        "whole_tool_shared_library_or_SDK_closure_claimed": False,
        "curator": {
            "path": str(Path(__file__)),
            "sha256": digest(Path(__file__)),
            "python": sys.executable,
            "version": sys.version,
        },
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
