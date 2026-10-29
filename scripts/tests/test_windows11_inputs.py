"""Pure boundaries only. No media download, native API, VM or product execution."""

from __future__ import annotations

import copy
import json
import stat
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import pytest

SOURCE = Path(__file__).parents[1] / "windows11"
sys.path.insert(0, str(SOURCE))
import windows11_deployment as deployment  # noqa: E402
import windows11_inputs as inputs  # noqa: E402

NONCE = "a" * 64
PACKAGE = "b" * 64
CPU = "Synthetic fixture supported CPU"


def environment() -> dict[str, Any]:
    return {
        "schema": "japp-win11-native-environment-v1",
        "nonce": NONCE,
        "caption": "Microsoft Windows 11 Enterprise Evaluation",
        "product_type": 1,
        "architecture": "X64",
        "build": 26300,
        "ubr": 9457,
        "secure_boot": True,
        "tpm_present": True,
        "tpm_ready": True,
        "tpm_spec": "2.0, 0, 1.59",
        "vcpus": 2,
        "ram_bytes": 6 * 1024**3,
        "disk_bytes": 79 * 1024**3,
        "cpu_name": CPU,
        "cpu_architecture": "X64",
        "cpu_max_mhz": 2500,
        "directx_version": "DirectX 12",
        "driver_model": "WDDM 1.3",
        "ddi_version": "11.2",
        "directx_major": 12,
        "wddm_major": 2,
        "display_width": 1280,
        "display_height": 800,
        "interactive": True,
        "elevated": False,
        "package_sha256": PACKAGE,
    }


def test_actual_native_environment_closed_positive() -> None:
    inputs.attest_guest(environment(), NONCE, CPU)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("schema", "linux"),
        ("nonce", "c" * 64),
        ("caption", "Microsoft Windows Server 2025"),
        ("product_type", True),
        ("product_type", 3),
        ("architecture", "ARM64"),
        ("build", 26100),
        ("ubr", 0),
        ("secure_boot", False),
        ("tpm_present", False),
        ("tpm_ready", False),
        ("tpm_spec", "1.2"),
        ("tpm_spec", 2),
        ("vcpus", 1),
        ("vcpus", True),
        ("ram_bytes", 4 * 1024**3 - 1),
        ("disk_bytes", 64 * 1024**3 - 1),
        ("cpu_name", "Different CPU"),
        ("cpu_architecture", "ARM64"),
        ("cpu_max_mhz", 999),
        ("driver_model", ""),
        ("directx_major", -1),
        ("display_width", 639),
        ("display_height", 479),
        ("interactive", False),
        ("elevated", True),
        ("package_sha256", "no"),
    ],
)
def test_native_environment_refuses_resource_os_session_and_identity_substitution(
    field: str, value: object
) -> None:
    candidate = environment()
    candidate[field] = value
    with pytest.raises(ValueError, match=r".+"):
        inputs.attest_guest(candidate, NONCE, CPU)


def test_environment_unknown_field_not_silently_accepted() -> None:
    candidate = environment()
    candidate["skip_tpm"] = True
    with pytest.raises(ValueError, match="Exact bound"):
        inputs.attest_guest(candidate, NONCE, CPU)


@pytest.mark.parametrize(
    "name",
    [
        "../escape",
        "/escape",
        "x\\escape",
        "C:escape",
        "x/../escape",
        "x//file",
        "x/./file",
        "CON",
        "aux.txt",
        "com1.file",
        "x. ",
        "x\nfile",
    ],
)
def test_archive_member_refusals(name: str) -> None:
    with pytest.raises(ValueError, match=r".+"):
        inputs.member(name)


def archive(path: Path, files: dict[str, bytes]) -> None:
    with zipfile.ZipFile(path, "w") as output:
        for name, data in files.items():
            output.writestr(name, data)


def test_extract_fresh_unicode_portable_and_exact_inventory(tmp_path: Path) -> None:
    path = tmp_path / "package.zip"
    archive(path, {"desktop.exe": b"fixture", "runtime/Ω file": b"other"})
    result = inputs.unpack(path, tmp_path / "owned space")
    assert set(result) == {"desktop.exe", "runtime/Ω file"}
    assert result["desktop.exe"]["sha256"] == inputs.digest(
        tmp_path / "owned space/desktop.exe"
    )
    with pytest.raises(ValueError, match="Fresh"):
        inputs.unpack(path, tmp_path / "owned space")


def test_extract_refuses_windows_alias_and_symlink(tmp_path: Path) -> None:
    path = tmp_path / "alias.zip"
    archive(path, {"File": b"one", "file": b"two"})
    with pytest.raises(ValueError, match="alias"):
        inputs.unpack(path, tmp_path / "alias")
    path = tmp_path / "link.zip"
    with zipfile.ZipFile(path, "w") as output:
        row = zipfile.ZipInfo("link")
        row.create_system = 3
        row.external_attr = (stat.S_IFLNK | 0o777) << 16
        output.writestr(row, "target")
    with pytest.raises(ValueError, match="links"):
        inputs.unpack(path, tmp_path / "link")


def test_document_duplicate_and_nonregular_refused(tmp_path: Path) -> None:
    path = tmp_path / "input.json"
    path.write_text('{"a":1,"a":2}')
    with pytest.raises(ValueError, match="Duplicate"):
        inputs.document(path)
    path.unlink()
    path.mkdir()
    with pytest.raises(ValueError, match="regular"):
        inputs.document(path)


@pytest.mark.parametrize(
    "url",
    [
        "http://support.microsoft.com/file",
        inputs.MEDIA + "?login=1",
        "https://software-static.download.prss.microsoft.com/other.iso",
        "https://untrusted.test/windows.iso",
        inputs.MEDIA + "#fragment",
    ],
)
def test_exact_official_origin_and_filename_only(url: str) -> None:
    with pytest.raises(ValueError, match=r".+"):
        inputs.official_url(url)


def test_publisher_requires_exact_language_edition_digest() -> None:
    text = (
        "Enterprise Eval x64 Eval EN-US DVD9 (SHA256)<p>" + inputs.MEDIA_SHA256.upper()
    )
    assert inputs.publisher_digest(text) == inputs.MEDIA_SHA256
    for wrong in (
        text.replace("EN-US", "EN-GB"),
        text.replace(inputs.MEDIA_SHA256.upper(), "0" * 64),
        text + text,
    ):
        with pytest.raises(ValueError, match=r".+"):
            inputs.publisher_digest(wrong)


def receipts() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = [
        {"phase": phase, "status": "PASS", "nonce": NONCE, "package_sha256": PACKAGE}
        for phase in inputs.REQUIRED_PHASES
    ]
    result[2]["statuses"] = [401] * 12
    result[-1]["remaining_owned_processes"] = 0
    for row in result:
        if row["phase"] == "keyboard":
            row.update(
                action="owned_foreground_focused_Check_again_Enter",
                checked_before="2026-10-29T00:00:00.000Z",
                checked_after="2026-10-29T00:00:01.000Z",
            )
        if row["phase"] == "accelerator":
            row.update(action="owned_foreground_Ctrl_Q", remaining_owned_processes=0)
    return result


def test_lifecycle_requires_all_ordered_observations_and_ordinary_auth_refusals() -> (
    None
):
    good = receipts()
    inputs.lifecycle(good, NONCE, PACKAGE)
    for bad in (good[:-1], good[::-1], [*good, good[-1]]):
        with pytest.raises(ValueError, match=r".+"):
            inputs.lifecycle(bad, NONCE, PACKAGE)
    for index, key, value in (
        (2, "statuses", [401] * 11),
        (2, "statuses", [401] * 11 + [200]),
        (len(inputs.REQUIRED_PHASES) - 1, "remaining_owned_processes", 1),
        (3, "checked_after", "2026-10-29T00:00:00.000Z"),
        (3, "checked_after", "2026-10-28T00:00:00.000Z"),
        (3, "action", "InvokePattern"),
        (10, "action", "InvokePattern"),
        (3, "nonce", "c" * 64),
        (7, "package_sha256", "c" * 64),
        (8, "status", "SKIP"),
    ):
        bad = copy.deepcopy(good)
        bad[index][key] = value
        with pytest.raises(ValueError, match=r".+"):
            inputs.lifecycle(bad, NONCE, PACKAGE)


def test_supported_unattend_uses_standard_fixture_without_bypasses() -> None:
    data = deployment.answer_file("aZ_9" * 10, "Windows 11 Enterprise Evaluation")
    root = ET.fromstring(data)  # noqa: S314 - our pure generator output, no external XML
    ns = {"u": deployment.NAMESPACE}
    assert root.find(".//u:LocalAccount/u:Name", ns).text == "JappFixture"  # type: ignore[union-attr]
    assert root.find(".//u:LocalAccount/u:Group", ns).text == "Users"  # type: ignore[union-attr]
    assert root.find(".//u:HideOnlineAccountScreens", ns).text == "true"  # type: ignore[union-attr]
    assert root.find(".//u:WillWipeDisk", ns).text == "true"  # type: ignore[union-attr]
    assert root.find(".//u:InstallTo/u:DiskID", ns).text == "0"  # type: ignore[union-attr]
    assert all(
        word not in data
        for word in (
            b"SkipMachineOOBE",
            b"BYPASSNRO",
            b"LabConfig",
            b"Administrators",
            b"ProductKey",
        )
    )
    assert root.find(".//u:FirstLogonCommands", ns) is None
    with pytest.raises(ValueError, match=r".+"):
        deployment.answer_file("weak", "Windows 11 Enterprise Evaluation")
    with pytest.raises(ValueError, match=r".+"):
        deployment.answer_file("aZ_9" * 10, "Windows Server")


def test_retention_excludes_iso_disks_and_synthetic_passwords(tmp_path: Path) -> None:
    work = tmp_path / "private-work"
    work.mkdir()
    (work / "Autounattend.xml").write_text("fixture password")
    (work / "os.qcow2").write_bytes(b"private disk")
    (tmp_path / "closure.json").write_text('{"status":"FAILED"}')
    inputs.retain(tmp_path)
    rows = json.loads((tmp_path / "retained/retention.json").read_text())["files"]
    assert set(rows) == {"closure.json"}
    assert not (tmp_path / "retained/private-work").exists()


def test_virtual_display_is_measured_without_physical_gpu_qualification() -> None:
    actual = environment()
    actual.update(
        directx_major=11, wddm_major=1, driver_model="WDDM 1.3", ddi_version="11.2"
    )
    inputs.attest_guest(actual, NONCE, CPU)


def seal_original(root: Path) -> str:
    rows = {
        str(p.relative_to(root)): {
            "bytes": p.stat().st_size,
            "sha256": inputs.digest(p),
            "original": "synthetic",
        }
        for p in root.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    }
    (root / "manifest.json").write_text(json.dumps({"files": rows}))
    return inputs.digest(root / "manifest.json")


def original_fixture(root: Path) -> str:
    (root / "worker").mkdir(parents=True)
    (root / "pipeline").mkdir()
    (root / "packages").mkdir()
    before = {
        "head": "c" * 40,
        "tree": "d" * 40,
        "files": {
            "scripts/windows_package.py": {
                "bytes": 1,
                "sha256": "e" * 64,
                "mode": "0o666",
            }
        },
    }
    records = {
        "worker/original-source-before.json": before,
        "worker/original-source-after.json": before,
        "worker/native-inputs.json": {
            "target": inputs.TARGET,
            "expected_git_head": "c" * 40,
            "source_projection": {"scripts/windows_package.py": "e" * 64},
        },
        "worker/ci-result.json": {
            "status": "PACKAGE_PIPELINE_FUNCTION_RETURNED_GUI_UNOBSERVED",
            "original_source_bytes_and_modes_equal": True,
            "original_source_clean": True,
            "gui_claim": False,
            "canonical_verification_waived": False,
        },
        "pipeline/closure.json": {
            "target": inputs.TARGET,
            "status": "BUILD_STATIC_AND_PACKAGE_SERVICE_ACTOR_PASS_GUI_PENDING",
            "package_service_actor_cases": 1,
            "app_gui_cases": 0,
            "native_platform_certified": False,
            "installed_package_evidence": False,
        },
        "pipeline/portable-inspection.json": {
            "result": "PASS",
            "reason": "INVENTORY_VERIFIED",
            "native_lifecycle_or_signature_proof": False,
            "source_sha256": "e" * 64,
        },
    }
    for name, value in records.items():
        (root / name).write_text(json.dumps(value))
    archive(
        root / "packages/windows-portable.zip", {"desktop.exe": b"synthetic not native"}
    )
    return seal_original(root)


def test_original_curated_artifact_requires_complete_actual_source_and_success(
    tmp_path: Path,
) -> None:
    pin = original_fixture(tmp_path)
    accepted = inputs.original_package(tmp_path, pin, "c" * 40, "d" * 40)
    assert accepted["portable_sha256"] == inputs.digest(
        tmp_path / "packages/windows-portable.zip"
    )
    with pytest.raises(ValueError, match="manifest"):
        inputs.original_package(tmp_path, "a" * 64, "c" * 40, "d" * 40)
    with pytest.raises(ValueError, match="tested merge"):
        inputs.original_package(tmp_path, pin, "a" * 40, "d" * 40)
    (tmp_path / "extra").write_text("unlisted")
    with pytest.raises(ValueError, match="member set"):
        inputs.original_package(tmp_path, pin, "c" * 40, "d" * 40)
    (tmp_path / "extra").unlink()
    worker = tmp_path / "worker/ci-result.json"
    value = json.loads(worker.read_text())
    value["status"] = "PREPARATION_INCOMPLETE"
    worker.write_text(json.dumps(value))
    with pytest.raises(ValueError, match="did not pass"):
        inputs.original_package(tmp_path, seal_original(tmp_path), "c" * 40, "d" * 40)
