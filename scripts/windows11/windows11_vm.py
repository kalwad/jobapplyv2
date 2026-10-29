"""One reviewed Windows11 VM on a disposable Ubuntu hosted KVM runner.

Importing is inert. A valid request/release, exact candidate bytes, host capacity,
KVM, firmware and actual guest hardware/session attestation precede the product.
No TCG, host block device, public network, account sign-in or capability fallback.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import secrets
import shutil
import socket
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from windows11_candidate import FIRMWARE, TOOLS, download, source_binding, tool_pin
from windows11_deployment import answer_file
from windows11_inputs import (
    MEDIA,
    MEDIA_CAP,
    MEDIA_SHA256,
    METADATA_CAP,
    REQUIRED_PHASES,
    attest_guest,
    bounded,
    digest,
    document,
    hex_pin,
    host_cpu,
    lifecycle,
    member,
    original_package,
    retain,
    unpack,
)
from windows11_platform import require_linux
from windows11_process import ChildCustody
from windows11_resources import ensure_capacity

sys.path.insert(0, str(Path(__file__).parents[1] / "linux_gnome"))
from ubuntu_gnome_host import require_host
from ubuntu_gnome_shell import validate_capture, verify_capture_images
from ubuntu_gnome_vm import Owner, group_exists, write

BUNDLE_MEMBERS = 6000
HOST_PACKAGE_CAP = 2048
KVM_API = 12
MIN_CPUS = 2
QMP_CAP = 65536
RESULT_MEMBER_CAP = 100
RUNNER_IMAGE_VERSION = "ImageVersion"
MIN_FREE = 48 * 1024**3
MIN_MEMORY = 8 * 1024**3


def audit_bundle(root: Path, pin: str) -> dict[str, Any]:
    if digest(root / "reviewed-inputs.json", METADATA_CAP) != hex_pin(pin):
        raise ValueError("Root-reviewed candidate manifest differs")
    value = document(root / "reviewed-inputs.json")
    if value.get("schema") != "japp-win11-reviewed-inputs-v1":
        raise ValueError("Exact reviewed candidate schema required")
    rows = value["files"]
    if not isinstance(rows, dict) or not 1 <= len(rows) <= BUNDLE_MEMBERS:
        raise ValueError("Finite complete bundle required")
    actual = {}
    total = 0
    for path in sorted(root.rglob("*")):
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            continue
        name = str(path.relative_to(root))
        member(name)
        if name == "reviewed-inputs.json":
            continue
        actual[name] = {"bytes": info.st_size, "sha256": digest(path)}
        total += info.st_size
        if total > 2 * 1024**3:
            raise ValueError("Bundle total exceeds cap")
    if actual != rows:
        raise ValueError("Reviewed bundle complete member binding differs")
    return value


def capacity(work: Path) -> dict[str, Any]:
    memory = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, text = line.split(":", 1)
        memory[key] = int(text.strip().split()[0]) * 1024
    free = shutil.disk_usage(work).free
    cpus = os.cpu_count() or 0
    row = {
        "physical_free_bytes": free,
        "available_memory_bytes": memory["MemAvailable"],
        "logical_cpus": cpus,
        "minimum_free_bytes": MIN_FREE,
        "minimum_memory_bytes": MIN_MEMORY,
    }
    row["eligible"] = (
        free >= MIN_FREE and memory["MemAvailable"] >= MIN_MEMORY and cpus >= MIN_CPUS
    )
    return row


def install_tools(bundle: Path, owner: Owner, expected: str) -> None:
    path = bundle / "host-tools-lock.json"
    if digest(path, METADATA_CAP) != hex_pin(expected):
        raise ValueError("Reviewed host tool lock differs")
    lock = document(path)
    if lock["schema"] != "japp-win11-host-tools-v1" or lock[
        "runner_image_version"
    ] != os.environ.get(RUNNER_IMAGE_VERSION):
        raise ValueError("Exact reviewed disposable runner image required")
    packages = lock["packages"]
    if not isinstance(packages, list) or not 1 <= len(packages) <= HOST_PACKAGE_CAP:
        raise ValueError("Finite host archive closure required")
    archives = []
    for row in packages:
        name = row["filename"]
        if Path(name).name != name or not name.endswith(".deb"):
            raise ValueError("Unsafe host archive name")
        archive = bundle / "host-debs" / name
        if archive.stat().st_size != row["bytes"] or digest(archive) != row["sha256"]:
            raise ValueError("Reviewed host archive differs")
        archives.append(str(archive))
    owner.command(
        [
            "/usr/bin/sudo",
            "-n",
            "/usr/bin/apt-get",
            "--no-download",
            "--no-install-recommends",
            "-y",
            "install",
            *archives,
        ],
        seconds=600,
    )
    for name, executable in {**TOOLS, **FIRMWARE}.items():
        pin = lock["tools"][name]
        if tool_pin(Path("/"), executable) != pin:
            raise ValueError("Installed tool/firmware bytes differ")
    queried = owner.command(
        [
            "/usr/bin/dpkg-query",
            "-W",
            "-f=${Package}\t${Version}\t${Architecture}\n",
            *sorted(row["package"] for row in packages),
        ]
    )
    actual = {}
    for line in queried.decode().splitlines():
        name, version, arch = line.split("\t")
        if name in actual:
            raise ValueError("Duplicate host package")
        actual[name] = (version, arch)
    expected_packages = {
        row["package"]: (row["version"], row["architecture"]) for row in packages
    }
    if actual != expected_packages or len(expected_packages) != len(packages):
        raise ValueError("Installed locked package versions differ")
    write(
        owner.proof / "host-tools.json",
        {
            "tools": lock["tools"],
            "packages": actual,
            "runner_image_version": os.environ.get(RUNNER_IMAGE_VERSION),
        },
    )


def kvm(owner: Owner) -> dict[str, Any]:
    path = Path("/dev/kvm")
    if not stat.S_ISCHR(path.lstat().st_mode):
        raise ValueError("Actual KVM character device required")
    # Current-runner UID ACL only after root release; never world writable.
    if not os.access(path, os.R_OK | os.W_OK):
        owner.command(
            [
                "/usr/bin/sudo",
                "-n",
                TOOLS["setfacl"],
                "-m",
                "u:" + str(os.getuid()) + ":rw",
                str(path),
            ]
        )
    with path.open("r+b", buffering=0) as stream:
        version = fcntl.ioctl(stream.fileno(), 0xAE00, 0)
    if version != KVM_API:
        raise ValueError("Actual KVM API12 required; no software emulation fallback")
    return {
        "device": str(path),
        "api_version": version,
        "acceleration": "KVM",
        "tcg_fallback": False,
    }


def group_observation(pid: int) -> tuple[str, str | None]:
    """An unexpected observer fault cannot bypass independent cleanup."""
    try:
        return ("EXISTS" if group_exists(pid) else "ABSENT", None)
    except BaseException as error:
        return ("UNKNOWN", type(error).__name__)


def connect(path: Path, owner: Owner) -> socket.socket:
    deadline = min(owner.work_deadline, time.monotonic() + 15)
    while time.monotonic() < deadline:
        if owner.child is not None and owner.child.poll() is not None:
            raise ValueError("Owned QEMU exited before control socket")
        client = socket.socket(socket.AF_UNIX)
        client.settimeout(1)
        try:
            client.connect(str(path))
            return client
        except (FileNotFoundError, ConnectionRefusedError):
            client.close()
            time.sleep(0.05)
    raise TimeoutError("Owned VM control socket unavailable")


def seed(bundle: Path, package: dict[str, Any], owner: Owner, nonce: str) -> Path:
    folder = owner.work / "seed"
    folder.mkdir(mode=0o700)
    portable = bundle / "original-native-artifact/packages/windows-portable.zip"
    files = unpack(portable, owner.work / "portable-inspection")
    required = {
        "desktop.exe",
        "build-manifest.json",
        "runtime/manifest.json",
        "runtime/japp-orchestrator/japp-orchestrator.exe",
    }
    if not required <= files.keys():
        raise ValueError("Original exact portable Windows layout required")
    # Replay only reviewed source's static inspector; no artifact executable is run.
    owner.command(
        [
            sys.executable,
            "-B",
            str(Path(__file__).parents[1] / "windows_package.py"),
            "inspect",
            "--root",
            str(owner.work / "portable-inspection"),
            "--receipt",
            str(owner.proof / "portable-inspection.json"),
        ]
    )
    shutil.copyfile(portable, folder / "windows-portable.zip")
    for name in (
        "windows11_guest.ps1",
        "windows11_owned.cs",
        "windows11_bootstrap.ps1",
    ):
        shutil.copyfile(bundle / "guest-driver" / name, folder / name)
    config = {
        "schema": "japp-win11-guest-config-v1",
        "nonce": nonce,
        "package_sha256": package["portable_sha256"],
        "portable_files": files,
    }
    write(folder / "guest-config.json", config)
    names = (
        "windows11_guest.ps1",
        "windows11_owned.cs",
        "windows-portable.zip",
        "guest-config.json",
    )
    write(
        folder / "seed-manifest.json",
        {
            "schema": "japp-win11-seed-v1",
            "nonce": nonce,
            "files": {
                name: {
                    "bytes": (folder / name).stat().st_size,
                    "sha256": digest(folder / name),
                }
                for name in names
            },
        },
    )
    # Fresh synthetic password stays in private scratch, excluded from proof.
    (folder / "Autounattend.xml").write_bytes(
        answer_file(secrets.token_urlsafe(40), "Windows 11 Enterprise Evaluation")
    )
    iso = owner.work / "seed.iso"
    owner.command(
        [
            TOOLS["xorriso"],
            "-as",
            "mkisofs",
            "-J",
            "-R",
            "-V",
            "JAPP-SEED",
            "-o",
            str(iso),
            str(folder),
        ]
    )
    return iso


def qemu_argv(work: Path, iso: Path, seed_iso: Path) -> list[str]:
    # Fresh private file-backed disks; no device passthrough or host shares.
    for path in (work, iso, seed_iso):
        if not path.is_absolute() or any(
            character in str(path) for character in (",", "\n", "\r")
        ):
            raise ValueError("Exact private QEMU file paths required")
    return [
        TOOLS["qemu"],
        "-name",
        "japp-owned-win11",
        "-machine",
        "q35,smm=on",
        "-accel",
        "kvm",
        "-cpu",
        "host",
        "-smp",
        "2",
        "-m",
        "6144",
        "-global",
        "driver=cfi.pflash01,property=secure,value=on",
        "-drive",
        "if=pflash,format=raw,unit=0,readonly=on,file=" + FIRMWARE["code"],
        "-drive",
        "if=pflash,format=raw,unit=1,file=" + str(work / "vars.fd"),
        "-drive",
        "if=none,id=os,format=qcow2,file=" + str(work / "os.qcow2"),
        "-device",
        "ide-hd,drive=os,bus=ide.0",
        "-drive",
        "if=none,id=media,media=cdrom,readonly=on,file=" + str(iso),
        "-device",
        "ide-cd,drive=media,bus=ide.1",
        "-drive",
        "if=none,id=seed,media=cdrom,readonly=on,file=" + str(seed_iso),
        "-device",
        "ide-cd,drive=seed,bus=ide.2",
        "-drive",
        "if=none,id=result,format=raw,file=" + str(work / "result.img"),
        "-device",
        "qemu-xhci,id=usb",
        "-device",
        "usb-storage,drive=result,removable=on",
        "-chardev",
        "socket,id=tpm,path=" + str(work / "tpm.sock"),
        "-tpmdev",
        "emulator,id=tpm0,chardev=tpm",
        "-device",
        "tpm-crb,tpmdev=tpm0",
        "-device",
        "VGA,xres=1280,yres=800",
        "-display",
        "none",
        "-nic",
        "none",
        "-parallel",
        "none",
        "-chardev",
        "socket,id=proof,path=" + str(work / "serial.sock") + ",server=on,wait=off",
        "-device",
        "isa-serial,chardev=proof",
        "-qmp",
        "unix:" + str(work / "qmp.sock") + ",server=on,wait=off",
        "-boot",
        "once=d,menu=off",
    ]


def observe(  # noqa: PLR0912, PLR0915 - bounded ordered receipt protocol
    owner: Owner, nonce: str, package_pin: str, expected_cpu: str
) -> dict[str, Any]:
    owner.qmp = connect(owner.work / "qmp.sock", owner)
    owner.qmp_stream = owner.qmp.makefile("rb")
    greeting = owner.qmp_stream.readline(65537)
    if len(greeting) > QMP_CAP or "QMP" not in json.loads(greeting):
        raise ValueError("Actual owned QMP greeting required")
    owner.qmp_call("qmp_capabilities")
    serial = connect(owner.work / "serial.sock", owner)
    serial.settimeout(1)
    receipts: list[dict[str, Any]] = []
    buffer = b""
    total = 0
    boot_key_at = time.monotonic() + 8
    key_sent = False
    with serial, (owner.proof / "guest-serial.raw").open("xb") as raw:
        while time.monotonic() < owner.work_deadline:
            if owner.child is None or owner.child.poll() is not None:
                raise ValueError(
                    "Owned Windows VM exited before complete guest receipt"
                )
            if not key_sent and time.monotonic() >= boot_key_at:
                # One owned-VM installation boot key; no OOBE/account interaction.
                owner.keys(["spc"])
                key_sent = True
            try:
                data = serial.recv(65536)
            except TimeoutError:
                continue
            if not data:
                raise ValueError("Owned guest serial channel closed")
            total += len(data)
            if total > 1024**2:
                raise ValueError("Owned guest serial output exceeds cap")
            raw.write(data)
            raw.flush()
            buffer += data
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if len(line) > QMP_CAP or not line.startswith(b"JAPP11 "):
                    raise ValueError("Closed bounded owned-guest protocol required")
                row = json.loads(line[7:].rstrip(b"\r"))
                if (
                    row.get("nonce") != nonce
                    or row.get("package_sha256") != package_pin
                ):
                    raise ValueError("Guest receipt identity differs")
                if "terminal" in row:
                    write(owner.proof / "guest-terminal.json", row)
                    if row["terminal"] != "PASS":
                        raise ValueError(
                            "Actual Windows guest environment or lifecycle failed"
                        )
                    lifecycle(receipts, nonce, package_pin)
                    keyboard = next(r for r in receipts if r["phase"] == "keyboard")
                    validate_capture(
                        keyboard.get("native_shell"), package_pin, "WINDOWS_UIA"
                    )
                    return {"receipts": receipts, "terminal": row}
                if (
                    row.get("status") != "PASS"
                    or len(receipts) >= len(REQUIRED_PHASES)
                    or row.get("phase") != REQUIRED_PHASES[len(receipts)]
                ):
                    raise ValueError("Complete ordered actual guest phase required")
                if row["phase"] == "environment":
                    attest_guest(row["attestation"], nonce, expected_cpu)
                    if row["attestation"]["package_sha256"] != package_pin:
                        raise ValueError("Actual environment package binding differs")
                receipts.append(row)
                if len(receipts) > len(REQUIRED_PHASES):
                    raise ValueError("Guest phase count exceeds bound")
                if row["phase"] in {
                    "environment",
                    "ready",
                    "keyboard",
                    "restart",
                    "relaunch",
                    "collision",
                }:
                    frame = owner.frame("win11-" + row["phase"])
                    write(owner.proof / ("frame-" + row["phase"] + ".json"), frame)
                    if row["phase"] == "environment":
                        if (frame["width"], frame["height"]) != (
                            row["attestation"]["display_width"],
                            row["attestation"]["display_height"],
                        ):
                            raise ValueError(
                                "Actual QMP frame and guest display dimensions differ"
                            )
                        serial.sendall(("JAPP11-ENV-ACCEPT " + nonce + "\n").encode())
    raise TimeoutError(
        "Actual Windows setup/guest deadline expired; no login automation fallback"
    )


def main() -> int:  # noqa: PLR0912, PLR0915 - one retained VM/TPM custody bracket
    require_linux()
    require_host()
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "bundle", "proof"):
        parser.add_argument("--" + name, required=True, type=Path)
    for name in (
        "expected-head",
        "package-build-head",
        "source-tree",
        "manifest-sha256",
        "bundle-sha256",
        "media-lock-sha256",
        "host-tools-sha256",
        "guest-driver-sha256",
    ):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    if (
        not all(path.is_absolute() for path in (args.source, args.bundle, args.proof))
        or args.proof.exists()
    ):
        raise ValueError("Absolute source/bundle and fresh proof required")
    args.proof.mkdir(mode=0o700)
    work = args.proof / "private-work"
    work.mkdir(mode=0o700)
    owner = Owner(work, args.proof)
    owner.work_deadline = owner.started + 3300
    owner.cleanup_deadline = owner.work_deadline + 60
    tpm: ChildCustody | None = None
    before = None
    package = None
    result: dict[str, Any] = {
        "status": "FAILED",
        "actual_native_Windows11_acceptance": False,
    }
    try:
        bundle = audit_bundle(args.bundle, args.bundle_sha256)
        for key, expected in {
            "source_sha": args.expected_head,
            "package_build_sha": args.package_build_head,
            "source_tree_sha": args.source_tree,
            "package_manifest_sha256": args.manifest_sha256,
        }.items():
            if bundle[key] != expected:
                raise ValueError("Reviewed bundle subject differs from root release")
        for name, pin in (
            ("media-lock.json", args.media_lock_sha256),
            ("guest-driver.json", args.guest_driver_sha256),
        ):
            if digest(args.bundle / name, METADATA_CAP) != hex_pin(pin):
                raise ValueError("Root-reviewed selected lock differs")
        media = document(args.bundle / "media-lock.json")
        if (
            media["media"]["url"] != MEDIA
            or media["media"]["sha256"] != MEDIA_SHA256
            or media["iso_retained_in_artifact"] is not False
        ):
            raise ValueError("Exact official publisher/media identity required")
        package = original_package(
            args.bundle / "original-native-artifact",
            args.manifest_sha256,
            args.package_build_head,
            args.source_tree,
        )
        before = source_binding(args.source, owner, args.expected_head, package)
        write(args.proof / "source-before.json", before)
        current_cpu = host_cpu()
        if current_cpu != media["host_cpu_requires_different_official_support_review"]:
            raise ValueError(
                "Hosted CPU differs from independently reviewed supported candidate CPU"
            )
        write(args.proof / "host-cpu.json", current_cpu)
        result["resource_preflight"] = ensure_capacity(owner)
        actual_capacity = capacity(work)
        write(args.proof / "host-capacity.json", actual_capacity)
        if not actual_capacity["eligible"]:
            raise ValueError(
                "Actual standard hosted runner resource capacity insufficient"
            )
        install_tools(args.bundle, owner, args.host_tools_sha256)
        write(args.proof / "kvm.json", kvm(owner))
        iso = work / "windows11.iso"
        media_receipt = download(MEDIA, iso, MEDIA_CAP, owner.work_deadline)
        write(args.proof / "media-download.json", media_receipt)
        if (
            media_receipt["sha256"] != MEDIA_SHA256
            or media_receipt["bytes"] != media["media"]["bytes"]
        ):
            raise ValueError(
                "Actual repeated ISO differs from reviewed publisher candidate"
            )
        nonce = secrets.token_hex(32)
        write(
            args.proof / "subject.json",
            {
                "nonce": nonce,
                "package_sha256": package["portable_sha256"],
                "source_sha": args.expected_head,
                "package_build_sha": args.package_build_head,
                "source_tree_sha": args.source_tree,
            },
        )
        seed_iso = seed(args.bundle, package, owner, nonce)
        shutil.copyfile(FIRMWARE["vars"], work / "vars.fd")
        owner.command(
            [TOOLS["qemu_img"], "create", "-f", "qcow2", str(work / "os.qcow2"), "80G"]
        )
        with (work / "result.img").open("xb") as output:
            output.truncate(128 * 1024**2)
        owner.command(
            [
                TOOLS["mformat"],
                "-i",
                str(work / "result.img"),
                "-F",
                "-v",
                "JAPP-RESULT",
                "::",
            ]
        )
        state = work / "tpm-state"
        state.mkdir(mode=0o700)
        with (
            (args.proof / "swtpm.stdout").open("xb") as stdout,
            (args.proof / "swtpm.stderr").open("xb") as stderr,
        ):
            child = subprocess.Popen(  # noqa: S603 - fixed reviewed swtpm argv, no shell
                [
                    TOOLS["swtpm"],
                    "socket",
                    "--tpm2",
                    "--tpmstate",
                    "dir=" + str(state),
                    "--ctrl",
                    "type=unixio,path=" + str(work / "tpm.sock"),
                ],
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                start_new_session=True,
            )
            tpm = ChildCustody(child, child.pid)
        tpm_deadline = min(owner.work_deadline, time.monotonic() + 5)
        while not (work / "tpm.sock").exists():
            if tpm.child.poll() is not None or time.monotonic() >= tpm_deadline:
                raise ValueError("Owned TPM control socket unavailable")
            time.sleep(0.05)
        # VM process creation is one operation; attach before fallible control work.
        argv = qemu_argv(work, iso, seed_iso)
        write(args.proof / "qemu-argv.json", argv)
        with (
            (args.proof / "qemu.stdout").open("xb") as stdout,
            (args.proof / "qemu.stderr").open("xb") as stderr,
        ):
            owner.child = subprocess.Popen(  # noqa: S603 - fixed reviewed QEMU argv, no shell
                argv,
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                start_new_session=True,
            )
            owner.pgid = owner.child.pid
        observation = observe(
            owner, nonce, package["portable_sha256"], current_cpu["model name"]
        )
        write(args.proof / "lifecycle.json", observation)
        owner.qmp_call("system_powerdown")
        owner.child.wait(timeout=30)
        if owner.child.returncode != 0:
            raise ValueError("Owned guest graceful shutdown failed")
        destination = args.proof / "guest-results"
        destination.mkdir()
        owner.command(
            [
                TOOLS["mcopy"],
                "-i",
                str(work / "result.img"),
                "-s",
                "::/proof",
                str(destination),
            ],
            seconds=15,
        )
        output = destination / "proof"
        files = list(output.rglob("*"))
        if (
            len(files) > RESULT_MEMBER_CAP
            or sum(p.stat().st_size for p in files if p.is_file()) > 64 * 1024**2
        ):
            raise ValueError("Guest result retention exceeds finite cap")
        native_shell = json.loads(
            bounded(output / "native-shell.json").decode("utf-8-sig")
        )
        validate_capture(native_shell, package["portable_sha256"], "WINDOWS_UIA")
        verify_capture_images(output, native_shell)
        keyboard = next(
            row for row in observation["receipts"] if row["phase"] == "keyboard"
        )
        if keyboard.get("native_shell") != native_shell:
            raise ValueError("Serial and retained native shell capture differ")
        attestation = document(output / "environment.json")
        attest_guest(attestation, nonce, current_cpu["model name"])
        if attestation["package_sha256"] != package["portable_sha256"]:
            raise ValueError("Actual guest package binding differs")
        cleanup = json.loads(bounded(output / "owned-cleanup.json").decode("utf-8-sig"))
        if (
            not isinstance(cleanup, list)
            or not cleanup
            or any(row.get("settled") is not True for row in cleanup)
        ):
            raise ValueError("Guest retained native custody remains unsettled")
        result.update(
            status="SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS",
            actual_native_Windows11_acceptance=True,
        )
    except Exception as error:
        result.update(error_type=type(error).__name__, message=str(error)[:512])
    finally:
        if (
            owner.child is not None
            and owner.child.returncode is None
            and owner.qmp is not None
        ):
            try:
                owner.qmp_call("system_powerdown")
                owner.child.wait(timeout=20)
                result["guest_powerdown_before_collection"] = owner.child.returncode
            except BaseException as error:
                result["guest_powerdown_error"] = type(error).__name__
        try:
            result["vm_closure"] = owner.close()
        except BaseException as error:
            result.update(
                status="OWNED_VM_CLEANUP_FAILURE", vm_cleanup_error=type(error).__name__
            )
            state, observer_error = (
                group_observation(owner.child.pid)
                if owner.child is not None
                else ("ABSENT", None)
            )
            result["vm_closure"] = {
                "vm_started": owner.child is not None,
                "direct_child_reaped": owner.child is None
                or owner.child.returncode is not None,
                "group_after_reap": state,
                "group_observer_error": observer_error,
                "error_type": type(error).__name__,
            }
        if tpm is not None and (
            owner.child is None or owner.child.returncode is not None
        ):
            try:
                tpm.terminate_unreaped()
            except BaseException as error:
                result["tpm_cleanup_error"] = type(error).__name__
            tpm_state, tpm_observer_error = group_observation(tpm.child.pid)
            result["tpm_closure"] = {
                "pid": tpm.child.pid,
                "reaped": tpm.child.returncode is not None,
                "signals": tpm.signals,
                "group_after_reap": tpm_state,
                "group_observer_error": tpm_observer_error,
            }
        # Guest data collection follows both independent native child cleanups.
        try:
            destination = args.proof / "guest-results"
            if (
                owner.child is not None
                and owner.child.returncode is not None
                and (work / "result.img").is_file()
                and not destination.exists()
            ):
                destination.mkdir()
                owner.command(
                    [
                        TOOLS["mcopy"],
                        "-i",
                        str(work / "result.img"),
                        "-s",
                        "::/proof",
                        str(destination),
                    ],
                    seconds=10,
                    cleanup=True,
                )
        except BaseException as error:
            result["failure_result_collection_error"] = type(error).__name__
        if before is not None and package is not None:
            try:
                after = source_binding(
                    args.source, owner, args.expected_head, package, cleanup=True
                )
                write(args.proof / "source-after.json", after)
                if before != after:
                    raise ValueError("Source endpoints changed")
                audit_bundle(args.bundle, args.bundle_sha256)
            except BaseException as error:
                result.update(
                    status="SOURCE_OR_INPUT_ENDPOINT_FAILURE",
                    endpoint_error=type(error).__name__,
                )
        unsettled = (
            owner.pending_commands
            or (owner.child is not None and owner.child.returncode is None)
            or (tpm is not None and tpm.child.returncode is None)
        )
        unsettled = (
            unsettled
            or result["vm_closure"].get("group_after_reap", "ABSENT") != "ABSENT"
            or result.get("tpm_closure", {}).get("group_after_reap", "ABSENT")
            != "ABSENT"
        )
        unsettled = (
            unsettled or "vm_cleanup_error" in result or "tpm_cleanup_error" in result
        )
        if unsettled:
            result["status"] = "UNSETTLED_OWN_CUSTODY"
        else:
            try:
                shutil.rmtree(work)
            except BaseException as error:
                result.update(
                    status="OWNED_WORK_CLEANUP_FAILURE",
                    work_cleanup_error=type(error).__name__,
                )
        if result["status"] != "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS":
            result["actual_native_Windows11_acceptance"] = False
        write(args.proof / "closure.json", result)
        try:
            retain(args.proof)
        except Exception as error:
            result.update(
                status="RETENTION_FAILED",
                actual_native_Windows11_acceptance=False,
                retention_error=type(error).__name__,
            )
            write(args.proof / "retention-failure.json", result)
    return 0 if result["status"] == "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
