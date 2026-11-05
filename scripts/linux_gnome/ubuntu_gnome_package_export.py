"""Export one already-inspected development .deb and finite source receipts.

No package install, payload execution, import, rebuild or source mutation.
The separate GUI job verifies these bytes before installation in its guest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import sys
from pathlib import Path

from ubuntu_gnome_platform import require_linux

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from linux_package import ar_members, bounded_file, tar_members
from linux_package import records as archive_records

MAX_DESCRIPTORS = 8


def bounded(path: Path, cap: int) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > cap:
        raise ValueError("Bounded non-symlink regular input required")
    with path.open("rb") as stream:
        data = stream.read(cap + 1)
    after = path.lstat()
    if (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
    ) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_mode,
    ) or len(data) != before.st_size:
        raise ValueError("Export input changed")
    return data


def record(path: Path, cap: int) -> dict[str, object]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > cap:
        raise ValueError("Bounded regular export input required")
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            total += len(block)
            if total > cap:
                raise ValueError("Export input grew beyond cap")
            digest.update(block)
    after = path.lstat()
    if (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
    ) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_mode,
    ) or total != before.st_size:
        raise ValueError("Export input changed")
    return {
        "bytes": total,
        "sha256": digest.hexdigest(),
        "mode": stat.S_IMODE(before.st_mode),
    }


def document(path: Path) -> dict[str, object]:
    value = json.loads(bounded(path, 8 * 1024 * 1024))
    if not isinstance(value, dict):
        raise ValueError("Object receipt required")
    return value


def original_build_binding(
    inputs: dict[str, object],
    before: dict[str, object],
    after: dict[str, object],
    head: str,
) -> dict[str, object]:
    if (
        before != after
        or before.get("head") != head
        or inputs.get("expected_git_head") != head
        or not isinstance(before.get("tree"), str)
        or re.fullmatch(r"[a-f0-9]{40}", str(before["tree"])) is None
    ):
        raise ValueError("Original build head/tree or endpoint receipts differ")
    files = before.get("files")
    if not isinstance(files, dict) or not files:
        raise ValueError("Original complete source receipt is missing")
    if inputs.get("source_projection") != {
        name: row["sha256"] for name, row in files.items()
    }:
        raise ValueError("Original source receipt and shipping hashes differ")
    return {"head": head, "tree": before["tree"]}


def source_receipts(
    proof: Path, inputs: dict[str, object], head: str
) -> tuple[dict[str, object], dict[str, Path]]:
    paths = {
        name: proof / name
        for name in ("original-source-before.json", "original-source-after.json")
    }
    binding = original_build_binding(
        inputs,
        document(paths["original-source-before.json"]),
        document(paths["original-source-after.json"]),
        head,
    )
    return binding, paths


def package_metadata(
    proof: Path, package: Path, inspection: dict[str, object], descriptors_path: Path
) -> tuple[list[dict[str, object]], dict[str, Path]]:
    archive_files = tar_members(ar_members(bounded_file(package))["data.tar.gz"])
    if archive_records(archive_files) != inspection.get("files"):
        raise ValueError("Archive file bytes differ from original inspection")
    installed_files = [
        {
            "path": name,
            "bytes": len(row["data"]),
            "sha256": hashlib.sha256(row["data"]).hexdigest(),
            "mode": row["mode"],
        }
        for name, row in sorted(archive_files.items())
    ]
    descriptors = json.loads(bounded(descriptors_path, 1024 * 1024))
    if (
        not isinstance(descriptors, list)
        or not 1 <= len(descriptors) <= MAX_DESCRIPTORS
    ):
        raise ValueError("Finite compile-bound descriptor list required")
    descriptor_paths = {}
    for row in descriptors:
        retained = Path(row["retained"])
        if (
            retained.parent != proof / "pipeline"
            or re.fullmatch(r"shipping-runtime-descriptor-[0-9]+\.rs", retained.name)
            is None
            or record(retained, 65536)["sha256"] != row["sha256"]
        ):
            raise ValueError("Actual compile-bound descriptor source differs")
        descriptor_paths[retained.name] = retained
    return installed_files, descriptor_paths


def main() -> None:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proof", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-head", required=True)
    arguments = parser.parse_args()
    proof, output = arguments.proof, arguments.output
    if (
        not proof.is_absolute()
        or not output.is_absolute()
        or output.exists()
        or output.is_symlink()
    ):
        raise ValueError("Existing absolute proof and fresh absolute export required")
    if output == proof or proof in output.parents or output in proof.parents:
        raise ValueError("Export and original proof must be separate")
    inputs_path = proof / "native-inputs.json"
    closure_path = proof / "pipeline/closure.json"
    inspection_path = proof / "pipeline/deb-inspection/inspection.json"
    descriptors_path = proof / "pipeline/shipping-descriptors.json"
    inputs, closure, inspection = (
        document(path) for path in (inputs_path, closure_path, inspection_path)
    )
    build, build_receipts = source_receipts(proof, inputs, arguments.expected_head)
    if inputs.get("expected_git_head") != arguments.expected_head:
        raise ValueError("Export source revision differs")
    if (
        inputs.get("target") != "x86_64-unknown-linux-gnu"
        or closure.get("target") != inputs["target"]
    ):
        raise ValueError("Actual Ubuntu x64 package proof required")
    if (
        closure.get("status")
        != "BUILD_STATIC_AND_PACKAGE_SERVICE_ACTOR_PASS_GUI_PENDING"
    ):
        raise ValueError(
            "Original package/static/service proof did not close successfully"
        )
    if (
        inspection.get("status")
        != "ARCHIVE_BYTES_PASS_NATIVE_DEPENDENCIES_AND_LIFECYCLE_PENDING"
    ):
        raise ValueError("Original Debian archive inspection did not pass")
    packages = list((proof / "pipeline/target/debug/bundle/deb").glob("*.deb"))
    if len(packages) != 1:
        raise ValueError("Exactly one original development Debian archive required")
    package = packages[0]
    pin = record(package, 512 * 1024 * 1024)
    if (
        inspection.get("package_sha256") != pin["sha256"]
        or Path(str(closure.get("package"))) != package
    ):
        raise ValueError("Archive/inspection/closure bindings differ")
    if closure.get("runtime_manifest_sha256") != inspection.get(
        "runtime_manifest_sha256"
    ):
        raise ValueError("Compiled runtime manifest join differs")
    installed_files, descriptor_paths = package_metadata(
        proof, package, inspection, descriptors_path
    )
    projection = inputs.get("source_projection")
    if not isinstance(projection, dict) or not projection:
        raise ValueError("Complete shipping source projection required")
    output.mkdir(mode=0o700)
    names = {
        "package.deb": package,
        "native-inputs.json": inputs_path,
        "package-closure.json": closure_path,
        "deb-inspection.json": inspection_path,
        "shipping-descriptors.json": descriptors_path,
        **build_receipts,
        **descriptor_paths,
    }
    records: dict[str, dict[str, object]] = {}
    for name, source in names.items():
        cap = 512 * 1024 * 1024 if name == "package.deb" else 8 * 1024 * 1024
        before = record(source, cap)
        destination = output / name
        shutil.copy2(source, destination)
        if before != record(source, cap) or before != record(destination, cap):
            raise ValueError("Export changed input bytes or modes")
        records[name] = before
    manifest = {
        "scope": "EXACT_EXISTING_INSPECTED_PACKAGE_EXPORT_NOT_GUI_EXECUTION",
        "expected_head": arguments.expected_head,
        "build_git_binding": build,
        "target": inputs["target"],
        "runtime_manifest_sha256": closure["runtime_manifest_sha256"],
        "shipping_source_projection": projection,
        "installed_files": installed_files,
        "archive_modes_from_existing_bounded_parser": True,
        "files": records,
        "original_proof_preserved": True,
        "payload_executed": False,
    }
    (output / "export.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
