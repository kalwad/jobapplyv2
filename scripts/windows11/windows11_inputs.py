"""Closed Windows11 inputs, publisher metadata and actual-guest attestations.

Importing this module neither starts a process nor accesses the network.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import stat
import urllib.parse
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

MEDIA = "https://software-static.download.prss.microsoft.com/dbazure/26300.9457.260913-1737.26h2_ge_release_svc_refresh_CLIENTENTERPRISEEVAL_OEMRET_x64FRE_en-us.iso"
MEDIA_SHA256 = "bc3f24086ebadc94489066b5ad78089e2cf5c3491e90e790bb81a2b199c10e38"
PUBLISHER = "https://support.microsoft.com/en-us/servicing/os/windows/docs/2026/09/verify-the-authenticity-of-a-windows-11-enterprise-evaluation-iso-file"
MEDIA_CAP = 9 * 1024**3
FILE_CAP = 512 * 1024**2
METADATA_CAP = 8 * 1024**2
ARCHIVE_MEMBERS = 5000
ARTIFACT_MEMBERS = 4096
EVIDENCE_MEMBERS = 6500
ARTIFACT_NODES = 8192
DISPLAY_TEXT_CAP = 128
MIN_PRINTABLE = 32
BUILD = 26300
UPDATE_BUILD_REVISION = 9457
TARGET = "x86_64-pc-windows-msvc"
REQUIRED_PHASES = (
    "environment",
    "ready",
    "unauthorized12",
    "keyboard",
    "crash",
    "restart",
    "close",
    "relaunch",
    "collision",
    "quit",
    "accelerator",
    "forced-parent",
    "cleanup",
)


def digest(path: Path, cap: int = FILE_CAP) -> str:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > cap:
        raise ValueError("Bounded regular file required")
    h = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            h.update(block)
    after = path.lstat()
    if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
    ):
        raise ValueError("Input changed while hashing")
    return h.hexdigest()


def pairs(rows: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in rows:
        if key in value:
            raise ValueError("Duplicate JSON key")
        value[key] = item
    return value


def bounded(path: Path, cap: int = METADATA_CAP) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > cap:
        raise ValueError("Bounded regular input required")
    data = path.read_bytes()
    after = path.lstat()
    if len(data) != before.st_size or (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
    ) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode):
        raise ValueError("Input changed while reading")
    return data


def document(path: Path) -> dict[str, Any]:
    value = json.loads(bounded(path), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValueError("Object metadata required")
    return value


def hex_pin(value: object, count: int = 64) -> str:
    if (
        not isinstance(value, str)
        or re.fullmatch("[0-9a-f]{" + str(count) + "}", value) is None
    ):
        raise ValueError("Exact lowercase hexadecimal pin required")
    return value


def member(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if (
        not name
        or "\\" in name
        or ":" in name
        or path.is_absolute()
        or ".." in path.parts
        or "." in path.parts
        or any(ord(c) < MIN_PRINTABLE for c in name)
        or str(path) != name
        or any(part.endswith((".", " ")) for part in path.parts)
        or any(
            part.split(".")[0].upper()
            in {
                "CON",
                "PRN",
                "AUX",
                "NUL",
                *{"COM" + str(i) for i in range(1, 10)},
                *{"LPT" + str(i) for i in range(1, 10)},
            }
            for part in path.parts
        )
    ):
        raise ValueError("Safe portable relative member required")
    return path


def unpack(archive: Path, output: Path, cap: int = FILE_CAP) -> dict[str, Any]:
    if output.exists() or output.is_symlink() or not output.is_absolute():
        raise ValueError("Fresh absolute extraction required")
    digest(archive, cap)
    rows: dict[str, Any] = {}
    aliases: set[str] = set()
    total = 0
    with zipfile.ZipFile(archive) as source:
        if len(source.infolist()) > ARCHIVE_MEMBERS:
            raise ValueError("Archive member count cap exceeded")
        for info in source.infolist():
            path = member(info.filename.rstrip("/"))
            if stat.S_IFMT(info.external_attr >> 16) not in (
                0,
                stat.S_IFREG,
                stat.S_IFDIR,
            ):
                raise ValueError("Archive links and special nodes refused")
            alias = str(path).casefold()
            if alias in aliases:
                raise ValueError("Duplicate or Windows alias archive path")
            aliases.add(alias)
            if info.is_dir():
                continue
            total += info.file_size
            if info.file_size > FILE_CAP or total > 1024**3:
                raise ValueError("Expanded archive byte cap exceeded")
            target = output / str(path)
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(info) as reader, target.open("xb") as writer:
                count = 0
                while block := reader.read(1024 * 1024):
                    count += len(block)
                    if count > info.file_size:
                        raise ValueError("Archive expanded size changed")
                    writer.write(block)
            if count != info.file_size:
                raise ValueError("Truncated archive member")
            rows[str(path)] = {"bytes": count, "sha256": digest(target)}
    if not rows:
        raise ValueError("Empty archive refused")
    return rows


def publisher_digest(html: str) -> str:
    matches = re.findall(
        r"Enterprise\s+Eval\s+x64\s+Eval\s+EN-US\s+DVD9\s*\(SHA256\)(?:\s|<[^>]+>)*([0-9A-Fa-f]{64})",
        html,
    )
    if len(matches) != 1 or matches[0].lower() != MEDIA_SHA256:
        raise ValueError("Official publisher exact edition/language digest unavailable")
    pin = matches[0]
    if not isinstance(pin, str):
        raise ValueError("Single publisher digest text required")
    return pin.lower()


def official_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if (
        value not in {MEDIA, PUBLISHER}
        or parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Only exact reviewed official HTTPS input allowed")
    return value


def original_package(  # noqa: PLR0912 - one complete source/artifact join
    root: Path, expected_manifest: str, merge: str, tree: str
) -> dict[str, Any]:
    if digest(root / "manifest.json", METADATA_CAP) != hex_pin(expected_manifest):
        raise ValueError("Exact original native artifact manifest required")
    retained = document(root / "manifest.json")
    rows = retained["files"]
    if not isinstance(rows, dict) or not 1 <= len(rows) <= ARTIFACT_MEMBERS:
        raise ValueError("Bounded original retention inventory required")
    actual = set()
    nodes = list(root.rglob("*"))
    if len(nodes) > ARTIFACT_NODES:
        raise ValueError("Bounded original artifact node inventory required")
    for node in nodes:
        info = node.lstat()
        if stat.S_ISREG(info.st_mode):
            actual.add(str(node.relative_to(root)))
        elif not stat.S_ISDIR(info.st_mode):
            raise ValueError("Original artifact links/special nodes refused")
    if actual != set(rows) | {"manifest.json"}:
        raise ValueError("Exact original artifact member set required")
    for name, row in rows.items():
        member(name)
        path = root / name
        if (
            not isinstance(row, dict)
            or set(row) != {"bytes", "sha256", "original"}
            or type(row["bytes"]) is not int
            or row["bytes"] < 0
        ):
            raise ValueError("Closed original retained-file row required")
        hex_pin(row["sha256"])
        if path.stat().st_size != row["bytes"] or digest(path) != row["sha256"]:
            raise ValueError("Original native artifact member differs")
    before = document(root / "worker/original-source-before.json")
    after = document(root / "worker/original-source-after.json")
    if (
        before != after
        or before["head"] != hex_pin(merge, 40)
        or before["tree"] != hex_pin(tree, 40)
    ):
        raise ValueError("Original actual tested merge/tree/source endpoints differ")
    inputs = document(root / "worker/native-inputs.json")
    worker = document(root / "worker/ci-result.json")
    closure = document(root / "pipeline/closure.json")
    inspection = document(root / "pipeline/portable-inspection.json")
    if (
        worker["status"] != "PACKAGE_PIPELINE_FUNCTION_RETURNED_GUI_UNOBSERVED"
        or inputs["target"] != TARGET
        or inputs["expected_git_head"] != merge
        or closure["target"] != TARGET
        or closure["package_service_actor_cases"] != 1
        or closure["app_gui_cases"] != 0
        or closure["native_platform_certified"] is not False
        or closure["installed_package_evidence"] is not False
        or closure["status"]
        != "BUILD_STATIC_AND_PACKAGE_SERVICE_ACTOR_PASS_GUI_PENDING"
        or not worker["original_source_bytes_and_modes_equal"]
        or not worker["original_source_clean"]
        or worker["gui_claim"]
        or worker["canonical_verification_waived"]
        or inspection["result"] != "PASS"
        or inspection["reason"] != "INVENTORY_VERIFIED"
        or inspection["native_lifecycle_or_signature_proof"]
    ):
        raise ValueError("Original Windows package preparation did not pass")
    if inputs["source_projection"] != {
        name: row["sha256"] for name, row in before["files"].items()
    }:
        raise ValueError("Complete original source projection differs")
    portable = root / "packages/windows-portable.zip"
    if rows["packages/windows-portable.zip"]["sha256"] != digest(portable):
        raise ValueError("Original portable ZIP missing or changed")
    if (
        inspection["source_sha256"]
        != before["files"]["scripts/windows_package.py"]["sha256"]
    ):
        raise ValueError("Exact original inspector source binding differs")
    return {
        "source": before,
        "inputs": inputs,
        "closure": closure,
        "portable_sha256": digest(portable),
        "manifest_sha256": expected_manifest,
    }


def attest_guest(value: dict[str, Any], nonce: str, expected_cpu: str) -> None:
    fields = {
        "cpu_name",
        "cpu_architecture",
        "cpu_max_mhz",
        "directx_version",
        "driver_model",
        "ddi_version",
        "display_width",
        "display_height",
        "schema",
        "nonce",
        "caption",
        "product_type",
        "architecture",
        "build",
        "ubr",
        "secure_boot",
        "tpm_present",
        "tpm_ready",
        "tpm_spec",
        "vcpus",
        "ram_bytes",
        "disk_bytes",
        "directx_major",
        "wddm_major",
        "interactive",
        "elevated",
        "package_sha256",
    }
    if (
        set(value) != fields
        or value["schema"] != "japp-win11-native-environment-v1"
        or value["nonce"] != hex_pin(nonce)
    ):
        raise ValueError("Exact bound actual guest attestation required")
    if (
        re.fullmatch(r"Microsoft Windows 11 Enterprise Evaluation", value["caption"])
        is None
        or type(value["product_type"]) is not int
        or value["product_type"] != 1
        or value["architecture"] != "X64"
        or type(value["build"]) is not int
        or value["build"] != BUILD
        or type(value["ubr"]) is not int
        or value["ubr"] != UPDATE_BUILD_REVISION
        or value["secure_boot"] is not True
        or value["tpm_present"] is not True
        or value["tpm_ready"] is not True
        or (
            not isinstance(value["tpm_spec"], str)
            or re.match(r"2\.0(?:,|$)", value["tpm_spec"]) is None
        )
        or value["interactive"] is not True
        or value["elevated"] is not False
        or any(
            type(value[n]) is not int or value[n] < limit
            for n, limit in {
                "vcpus": 2,
                "ram_bytes": 4 * 1024**3,
                "disk_bytes": 64 * 1024**3,
                "cpu_max_mhz": 1000,
                "display_width": 640,
                "display_height": 480,
            }.items()
        )
    ):
        raise ValueError("Actual native Windows11 hardware/session requirements unmet")
    if (
        value["cpu_architecture"] != "X64"
        or not isinstance(value["cpu_name"], str)
        or " ".join(value["cpu_name"].split()) != " ".join(expected_cpu.split())
    ):
        raise ValueError(
            "Actual guest CPU differs from independently reviewed supported host CPU"
        )
    for key in ("directx_version", "driver_model", "ddi_version"):
        if (
            not isinstance(value[key], str)
            or not 1 <= len(value[key]) <= DISPLAY_TEXT_CAP
        ):
            raise ValueError("Bounded actual virtual display measurements required")
    for key in ("directx_major", "wddm_major"):
        if type(value[key]) is not int or value[key] < 0:
            raise ValueError("Actual virtual graphics version measurement required")
    hex_pin(value["package_sha256"])


def lifecycle(receipts: list[dict[str, Any]], nonce: str, package: str) -> None:
    if [r.get("phase") for r in receipts] != list(REQUIRED_PHASES):
        raise ValueError("Complete ordered native lifecycle receipts required")
    for row in receipts:
        if (
            row.get("nonce") != nonce
            or row.get("package_sha256") != package
            or row.get("status") != "PASS"
        ):
            raise ValueError("Actual native lifecycle step failed or binding differs")
    if receipts[2].get("statuses") != [401] * 12:
        raise ValueError("All twelve ordinary unauthorized responses required")
    keyboard = next(row for row in receipts if row["phase"] == "keyboard")
    before = keyboard.get("checked_before")
    after = keyboard.get("checked_after")
    stamp = r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"
    if (
        keyboard.get("action") != "owned_foreground_focused_Check_again_Enter"
        or not isinstance(before, str)
        or not isinstance(after, str)
        or re.fullmatch(stamp, before) is None
        or re.fullmatch(stamp, after) is None
        or after <= before
    ):
        raise ValueError("Actual owned keyboard timestamp advancement required")
    accelerator = next(row for row in receipts if row["phase"] == "accelerator")
    if (
        accelerator.get("action") != "owned_foreground_Ctrl_Q"
        or accelerator.get("remaining_owned_processes") != 0
    ):
        raise ValueError("Actual owned native accelerator and drain required")
    if receipts[-1].get("remaining_owned_processes") != 0:
        raise ValueError("Owned process cleanup remains incomplete")


def retain(proof: Path, *, inputs: bool = False) -> None:
    """Retain bounded proof; exclude private ISO, disks and password scratch."""
    selected: dict[str, dict[str, Any]] = {}
    total = 0
    for path in sorted(proof.rglob("*")):
        relative = path.relative_to(proof)
        if relative.parts[0] in {"private-work", "retained"}:
            continue
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            continue
        name = str(relative)
        member(name)
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Evidence links and special nodes refused")
        total += info.st_size
        if len(selected) >= EVIDENCE_MEMBERS or total > (
            2 * 1024**3 if inputs else 256 * 1024**2
        ):
            raise ValueError("Finite evidence retention cap exceeded")
        selected[name] = {"bytes": info.st_size, "sha256": digest(path)}
    destination = proof / "retained"
    destination.mkdir(mode=0o700)
    for name, row in selected.items():
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(proof / name, path)
        if digest(path) != row["sha256"]:
            raise ValueError("Evidence retention copy differs")
    (destination / "retention.json").write_text(
        json.dumps(
            {
                "schema": "japp-win11-retention-v1",
                "files": selected,
                "private_ISO_disks_passwords_excluded": True,
            },
            indent=2,
        )
        + "\n"
    )


def host_cpu() -> dict[str, str]:
    """Actual hosted CPU identity for different primary support-list review."""
    text = Path("/proc/cpuinfo").read_text()[:65536].split("\n\n", 1)[0]
    fields = dict(line.split(":", 1) for line in text.splitlines() if ":" in line)
    fields = {key.strip(): value.strip() for key, value in fields.items()}
    names = ("model name", "vendor_id", "cpu family", "model", "stepping")
    if not all(fields.get(key) for key in names):
        raise ValueError("Actual host CPU identity unavailable")
    return {key: fields[key] for key in names}
