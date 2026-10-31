"""Prospective bounded Ubuntu GNOME VM owner. No actor runs on import.

Requires a root-reviewed exact package export, guest apt closure and host-tool
lock. A missing reviewed closure is an explicit preparation gap, never latest
apt, Xvfb, another compositor, or a source/payload fallback.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shlex
import shutil
import socket
import stat
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.client import HTTPMessage
from pathlib import Path
from typing import IO, Any, BinaryIO

from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_process import ChildCustody
from ubuntu_gnome_retention import retain
from ubuntu_gnome_shell import (
    POLICY_SHA256,
    ROUTES,
    validate_capture,
    verify_capture_images,
)

QMP_CAP = 65536
KVM_API = 12
DOCUMENT_CAP = 8 * 1024 * 1024
RUNNER_IMAGE_VERSION_ENV = "ImageVersion"
GIT_BINDING_LINES = 2
FRAME_CAP = 20
FRAME_MIN_WIDTH = 640
FRAME_MAX_WIDTH = 1920
FRAME_MIN_HEIGHT = 480
FRAME_MAX_HEIGHT = 1200
FRAME_MIN_COLOR_VALUES = 8
FRAME_BYTES = 4 * 1024 * 1024
FAILURE_FRAME = "failure-final.ppm"
LOCK_PACKAGE_CAP = 2048
SCOPED_RESULT = "ACTUAL_GDM_UBUNTU_GNOME_PACKAGE_LIFECYCLE_SCOPED_PASS"
# Closeout reads run under cleanup authority. 10 s per read is over three
# times the slowest measured KVM SSH poll (3.01 s); 30 s stays reserved for
# the VM quit and the final source guard after them.
CLOSEOUT_SECONDS = 10
CLOSEOUT_RESERVE = 30
CLOSEOUT_FETCHES = 32
GUEST_PROOF = "/home/japp-ci/japp-proof/"
# cloud-init runs provision.py from the 9p mount itself, so a failed mount can
# never leave provision-failure.json. One fixed runcmd step has the synthetic
# account create this tiny marker instead; the readiness poll treats it as
# PROVISION_FAILED.
INPUT_UNMOUNTED = "input-mount-failure.json"
INPUT_UNMOUNTED_MARKER = {
    "status": "PROVISION_FAILED",
    "phase": "mount_input",
    "reason": "INPUT_NOT_A_MOUNTPOINT",
    "writer": "CLOUD_INIT_RUNCMD",
}
GUEST_JSON = (
    "provision-failure.json",
    INPUT_UNMOUNTED,
    "provision.json",
    "actual-gnome-session.json",
    "observation-closeout.json",
    "controller-exit.json",
    "controller-failure.json",
)
GUEST_ENDED = {
    b"PROVISION_FAILED\n": "Guest provisioning failed",
    b"CONTROLLER_ENDED\n": "Guest controller ended before readiness",
}
# Operation names carry digits (shell_scale_step1..5), as shell_request allows.
GUEST_RECEIPT = re.compile(r"[0-9]{2,3}-[a-z0-9_]+\.json")
GUEST_LOG = re.compile(r"provision-[a-z-]+\.log")
LISTING_FIELDS = 3
CLOSEOUT_LOGS = 8
SSH_TRANSPORT_FAILURE = 255
KEY_LINE_MIN = 16
SERIAL_TAIL = "guest-serial-tail.log"
SERIAL_TAIL_BYTES = 64 * 1024
SERIAL_SCAN_CAP = 16 * 1024 * 1024

IMAGE = "https://cloud-images.ubuntu.com/releases/noble/release-20261017/ubuntu-24.04-server-cloudimg-amd64.img"
IMAGE_SHA = "04e8f2461a16a44e78a370284471f29616cdd9baf1893df25807b71f985b6c94"
FINGERPRINT = "D2EB44626FDDC30B513D5BB71A5D6C4C7DB87C81"
TOOLS = {
    "qemu": "/usr/bin/qemu-system-x86_64",
    "qemu_img": "/usr/bin/qemu-img",
    "seed": "/usr/bin/cloud-localds",
    "ssh": "/usr/bin/ssh",
    "scp": "/usr/bin/scp",
    "keygen": "/usr/bin/ssh-keygen",
    "gpgv": "/usr/bin/gpgv",
    "dpkg_query": "/usr/bin/dpkg-query",
    "setfacl": "/usr/bin/setfacl",
}
SCRIPTS = (
    "ubuntu_gnome_guest.py",
    "ubuntu_gnome_session_receipt.py",
    "ubuntu_gnome_provision.py",
    "ubuntu_gnome_atspi.py",
    "ubuntu_gnome_process.py",
    "ubuntu_gnome_platform.py",
    "ubuntu_gnome_shell.py",
)


def sha(path: Path, cap: int = 1024 * 1024 * 1024) -> str:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > cap:
        raise ValueError("Bounded regular input required")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def write(path: Path, value: object) -> None:
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def group_exists(pgid: int) -> bool:
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def official_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    allowed = {"ubuntu-24.04-server-cloudimg-amd64.img", "SHA256SUMS", "SHA256SUMS.gpg"}
    prefix = "/releases/noble/release-20261017/"
    if (
        parts.scheme != "https"
        or parts.hostname != "cloud-images.ubuntu.com"
        or parts.port not in {None, 443}
        or parts.username is not None
        or parts.password is not None
        or parts.query
        or parts.fragment
        or not parts.path.startswith(prefix)
        or parts.path.removeprefix(prefix) not in allowed
    ):
        raise ValueError("Only exact dated official HTTPS image inputs allowed")
    return url


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(  # noqa: PLR0913, PLR0917 - stdlib override signature
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> urllib.request.Request | None:
        official_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class CommandDeadlineError(TimeoutError):
    """One owned command outlived its own bound and was fully reaped."""


class Owner:
    def __init__(self, work: Path, proof: Path) -> None:
        self.work, self.proof = work, proof
        self.sequence = 0
        self.child: subprocess.Popen[bytes] | None = None
        self.pgid: int | None = None
        self.qmp: socket.socket | None = None
        self.qmp_stream: BinaryIO | None = None
        self.pending_commands: list[ChildCustody] = []
        self.signals: list[str] = []
        self.vm_group_verified = False
        self.ssh: list[str] | None = None
        self.started = time.monotonic()
        self.work_deadline = self.started + 3300
        self.cleanup_deadline = self.work_deadline + 60
        self.frames = 0
        self.failure_framed = False

    def vm_output_exceeded(self) -> bool:
        paths = (
            self.proof / "qemu.stdout",
            self.proof / "qemu.stderr",
            self.work / "guest-serial.log",
        )
        return any(path.exists() and path.stat().st_size > 256 * 1024 for path in paths)

    def bound(
        self,
        started: float,
        seconds: float,
        limit: float,
        cleanup: bool,
        over_cap: bool,
    ) -> None:
        if (
            time.monotonic() >= limit
            or (not cleanup and self.vm_output_exceeded())
            or over_cap
        ):
            raise TimeoutError("Owned command timeout or raw output cap")
        if time.monotonic() - started >= seconds:
            raise CommandDeadlineError("Owned command exceeded its own bound")

    def command(
        self,
        argv: list[str],
        seconds: float = 30,
        cap: int = 256 * 1024,
        permit_failure: bool = False,
        cleanup: bool = False,
    ) -> bytes:
        limit = self.cleanup_deadline if cleanup else self.work_deadline
        if time.monotonic() >= limit:
            raise TimeoutError("Outer VM command authority expired")
        self.sequence += 1
        stem = self.proof / ("command-" + str(self.sequence).zfill(3))
        started = time.monotonic()
        custody: ChildCustody | None = None
        primary: BaseException | None = None
        cleanup_error: BaseException | None = None
        with (
            stem.with_suffix(".stdout").open("xb") as stdout,
            stem.with_suffix(".stderr").open("xb") as stderr,
        ):
            try:
                child = subprocess.Popen(  # noqa: S603 - reviewed argv, no shell
                    argv,
                    stdin=subprocess.DEVNULL,
                    stdout=stdout,
                    stderr=stderr,
                    start_new_session=True,
                    env={
                        "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
                        "HOME": str(self.work),
                        "LC_ALL": "C.UTF-8",
                    },
                )
                # Own the actual Popen immediately, before getpgid or any
                # watcher can fail. Retain it until a successful wait/reap.
                custody = ChildCustody(child, child.pid)
                self.pending_commands.append(custody)
                observed = os.getpgid(child.pid)
                if observed != child.pid:
                    raise ValueError("Fresh command group ownership failed")
                custody.group_verified = True
                while child.poll() is None:
                    self.bound(
                        started,
                        seconds,
                        limit,
                        cleanup,
                        stdout.tell() + stderr.tell() > cap,
                    )
                    time.sleep(0.02)
            except BaseException as error:
                primary = error
            finally:
                if custody is not None:
                    try:
                        custody.terminate_unreaped()
                    except BaseException as error:
                        cleanup_error = error
                    if custody.child.returncode is not None:
                        self.pending_commands.remove(custody)
        size = (
            stem.with_suffix(".stdout").stat().st_size
            + stem.with_suffix(".stderr").stat().st_size
        )
        present = group_exists(custody.pgid) if custody is not None else False
        code = custody.child.returncode if custody is not None else None
        write(
            stem.with_suffix(".json"),
            {
                "argv": argv,
                "exit_code": code,
                "signals": custody.signals if custody else [],
                "elapsed_seconds": time.monotonic() - started,
                "direct_child_reaped": custody is not None and code is not None,
                "group_authority_verified": custody.group_verified
                if custody
                else False,
                "group_after_reap": "EXISTS" if present else "ABSENT",
                "raw_bytes": size,
                "output_cap_bytes": cap,
                "output_cap_exceeded": size > cap,
                "primary_error_type": type(primary).__name__ if primary else None,
                "cleanup_error_type": type(cleanup_error).__name__
                if cleanup_error
                else None,
                "retained_unreaped_custody": custody in self.pending_commands
                if custody
                else False,
                "scope": "EXACT_OWN_CHILD_NO_SIGNAL_AFTER_REAP",
            },
        )
        if primary is not None:
            if isinstance(primary, CommandDeadlineError) and (
                present or code is None or cleanup_error is not None
            ):
                raise RuntimeError("Timed-out command left owned process state")
            raise primary
        if cleanup_error is not None:
            raise cleanup_error
        if present or size > cap or (code != 0 and not permit_failure):
            raise RuntimeError("Owned command failed; original raw output retained")
        return stem.with_suffix(".stdout").read_bytes()

    def download(self, url: str, path: Path, cap: int, seconds: float) -> None:
        started = time.monotonic()
        total = 0
        official_url(url)
        opener = urllib.request.build_opener(OfficialRedirect())
        with opener.open(url, timeout=10) as response, path.open("xb") as stream:
            official_url(response.geturl())
            while block := response.read(1024 * 1024):
                total += len(block)
                if (
                    total > cap
                    or time.monotonic() - started > seconds
                    or time.monotonic() >= self.work_deadline
                ):
                    raise TimeoutError(
                        "Bounded official image download exceeded allowance"
                    )
                stream.write(block)

    def qmp_call(
        self,
        execute: str,
        arguments: dict[str, object] | None = None,
        cleanup: bool = False,
    ) -> object:
        if self.qmp is None or self.qmp_stream is None:
            raise ValueError("Owned QMP connection required")
        request: dict[str, object] = {"execute": execute, "id": execute}
        if arguments is not None:
            request["arguments"] = arguments
        if not cleanup and self.vm_output_exceeded():
            raise ValueError("Owned VM raw output cap exceeded")
        self.qmp.sendall((json.dumps(request) + "\n").encode())
        deadline = time.monotonic() + 5
        for _ in range(128):
            if time.monotonic() >= deadline:
                break
            raw = self.qmp_stream.readline(65537)
            if len(raw) > QMP_CAP or not raw:
                raise ValueError("QMP response exceeded cap or closed")
            value = json.loads(raw)
            if value.get("id") == execute:
                if "error" in value:
                    raise ValueError("QMP command failed")
                return value["return"]
        raise TimeoutError("Owned QMP response unavailable")

    def keys(self, codes: list[str]) -> None:
        events = [
            {
                "type": "key",
                "data": {"down": True, "key": {"type": "qcode", "data": code}},
            }
            for code in codes
        ]
        self.qmp_call("input-send-event", {"events": events})
        time.sleep(0.1)
        events = [
            {
                "type": "key",
                "data": {"down": False, "key": {"type": "qcode", "data": code}},
            }
            for code in reversed(codes)
        ]
        self.qmp_call("input-send-event", {"events": events})
        time.sleep(0.2)

    def frame(self, name: str) -> dict[str, object]:
        if self.frames >= FRAME_CAP or not re.fullmatch(r"[a-z0-9-]+", name):
            raise ValueError("Frame count/name exceeded allowance")
        self.frames += 1
        path = self.proof / (name + ".ppm")
        self.qmp_call("screendump", {"filename": str(path)})
        if path.stat().st_size > FRAME_BYTES:
            raise ValueError("Guest frame exceeded cap")
        data = path.read_bytes()
        header = re.match(rb"P6\s+([0-9]+)\s+([0-9]+)\s+255\s", data)
        if header is None:
            raise ValueError("Actual QMP RGB frame required")
        width, height = int(header.group(1)), int(header.group(2))
        pixels = data[header.end() :]
        if (
            not FRAME_MIN_WIDTH <= width <= FRAME_MAX_WIDTH
            or not FRAME_MIN_HEIGHT <= height <= FRAME_MAX_HEIGHT
            or len(pixels) != width * height * 3
        ):
            raise ValueError("Actual guest display size is invalid")
        if len(set(pixels)) < FRAME_MIN_COLOR_VALUES:
            raise ValueError(
                "Actual guest frame is blank/insufficient display evidence"
            )
        return {
            "file": path.name,
            "width": width,
            "height": height,
            "sha256": sha(path),
            "nonblank": True,
            "scope": "ACTUAL_VIRTUAL_GPU_FRAME_SEMANTICS_JOINED_TO_SESSION_AND_AX",
        }

    def failure_frame(self) -> dict[str, object]:
        """One frame of a failed campaign's screen, outside the success budget.

        A black or console screen is itself the observation, so it is never
        refused as blank; only its size and RGB shape bound what is retained.
        """
        if self.failure_framed:
            raise ValueError("One failure frame only")
        self.failure_framed = True
        path = self.proof / FAILURE_FRAME
        self.qmp_call("screendump", {"filename": str(path)}, cleanup=True)
        size = path.stat().st_size
        data = path.read_bytes() if size <= FRAME_BYTES else b""
        header = re.match(rb"P6\s+([0-9]+)\s+([0-9]+)\s+255\s", data)
        width, height = (
            (int(header.group(1)), int(header.group(2))) if header else (0, 0)
        )
        if header is None or len(data) - header.end() != width * height * 3:
            path.unlink()
            return {"captured": False, "bytes": size, "reason": "NOT_BOUNDED_RGB_PPM"}
        return {
            "captured": True,
            "file": path.name,
            "width": width,
            "height": height,
            "sha256": sha(path),
            "distinct_byte_values": len(set(data[header.end() :])),
            "scope": "FAILURE_DIAGNOSTIC_FRAME_NOT_PHASE_EVIDENCE",
        }

    def close(self) -> dict[str, object]:
        pending_results = []
        for custody in list(self.pending_commands):
            error_type = None
            try:
                custody.terminate_unreaped()
            except BaseException as error:
                error_type = type(error).__name__
            if custody.child.returncode is not None:
                self.pending_commands.remove(custody)
            pending_results.append(
                {
                    "pid": custody.child.pid,
                    "direct_child_reaped": custody.child.returncode is not None,
                    "error_type": error_type,
                }
            )
        child = self.child
        if child is None:
            return {"vm_started": False, "pending_commands": pending_results}
        custody = ChildCustody(
            child, self.pgid or child.pid, self.vm_group_verified, self.signals
        )
        qmp_error = None
        if child.returncode is None:
            try:
                self.qmp_call("quit")
            except BaseException as error:
                qmp_error = type(error).__name__
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                custody.terminate_unreaped()
        if self.qmp_stream is not None:
            self.qmp_stream.close()
        if self.qmp is not None:
            self.qmp.close()
        return {
            "vm_started": True,
            "direct_child_reaped": child.returncode is not None,
            "exit_code": child.returncode,
            "signals": custody.signals,
            "group_authority_verified": custody.group_verified,
            "group_after_reap": "EXISTS" if group_exists(custody.pgid) else "ABSENT",
            "qmp_quit_error_type": qmp_error,
            "pending_commands": pending_results,
            "universal_escaped_descendant_absence_claimed": False,
        }


def validate_closure(path: Path, expected: str) -> dict[str, Any]:
    lock = path / "lock.json"
    if sha(lock, 2 * 1024 * 1024) != expected:
        raise ValueError("Reviewed closure lock SHA256 differs")
    result = json.loads(lock.read_bytes())
    if not isinstance(result, dict):
        raise ValueError("Object closure required")
    if (
        result.get("schema") != "japp-reviewed-noble-closure-v1"
        or result.get("architecture") != "amd64"
    ):
        raise ValueError("Reviewed Noble x64 closure required")
    if not result.get("signed_metadata"):
        raise ValueError("Reviewed signed metadata provenance is missing")
    packages = result.get("packages")
    if not isinstance(packages, list) or not 1 <= len(packages) <= LOCK_PACKAGE_CAP:
        raise ValueError("Explicit finite reviewed Debian closure required")
    for row in packages:
        name = row["filename"]
        if Path(name).name != name or not name.endswith(".deb"):
            raise ValueError("Unsafe locked archive name")
        archive = path / "debs" / name
        if (
            archive.stat().st_size != row["bytes"]
            or sha(archive, 256 * 1024 * 1024) != row["sha256"]
        ):
            raise ValueError("Reviewed archive bytes differ")
    return result


def package_source_binding(
    export: dict[str, Any],
    source_head: str,
    source_tree: str,
    package_head: str,
    expected_tree: str,
) -> dict[str, str]:
    values = (source_head, source_tree, package_head, expected_tree)
    if any(re.fullmatch(r"[a-f0-9]{40}", value) is None for value in values):
        raise ValueError("Exact source/build/tree identities required")
    if (
        export["expected_head"] != package_head
        or export["build_git_binding"] != {"head": package_head, "tree": expected_tree}
        or source_tree != expected_tree
    ):
        raise ValueError("Source S/tree T differs from original package M/tree T")
    return {
        "checked_out_source_sha": source_head,
        "checked_out_source_tree": source_tree,
        "original_package_build_sha": package_head,
        "original_package_build_tree": expected_tree,
    }


def bind_source(
    args: argparse.Namespace, owner: Owner, export: dict[str, Any]
) -> tuple[dict[str, dict[str, object]], list[str]]:
    git_binding = (
        owner.command(
            [
                "/usr/bin/git",
                "-C",
                str(args.source),
                "rev-parse",
                "HEAD",
                "HEAD^{tree}",
            ]
        )
        .decode()
        .splitlines()
    )
    if len(git_binding) != GIT_BINDING_LINES or git_binding[0] != args.expected_head:
        raise ValueError("Actual clean checkout revision differs")
    source_build = package_source_binding(
        export,
        git_binding[0],
        git_binding[1],
        args.package_build_head,
        args.source_tree,
    )
    if owner.command(
        [
            "/usr/bin/git",
            "-C",
            str(args.source),
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ]
    ):
        raise ValueError("Actual shipping/harness checkout must be clean")
    source_before: dict[str, dict[str, object]] = {}
    for name, expected in export["shipping_source_projection"].items():
        if (
            Path(name).is_absolute()
            or ".." in Path(name).parts
            or sha(args.source / name) != expected
        ):
            raise ValueError(
                "Actual immutable shipping source differs from built package"
            )
        info = (args.source / name).lstat()
        source_before[name] = {
            "sha256": expected,
            "bytes": info.st_size,
            "mode": stat.S_IMODE(info.st_mode),
        }
    write(
        args.proof / "source-before.json",
        {"head": git_binding[0], "tree": git_binding[1], "files": source_before},
    )
    write(args.proof / "source-build-binding.json", source_build)
    for name in (Path(__file__).name, "ubuntu_gnome_retention.py", *SCRIPTS):
        relative = "scripts/linux_gnome/" + name
        if (
            relative not in source_before
            or sha(Path(__file__).with_name(name)) != source_before[relative]["sha256"]
        ):
            raise ValueError(
                "Actual executing harness source differs from package checkout"
            )
    return source_before, git_binding


def kvm(owner: Owner, device: Path = Path("/dev/kvm")) -> dict[str, Any]:
    """Hardware acceleration or nothing: TCG missed the session budgets (KI-0152)."""
    import fcntl  # noqa: PLC0415 - Linux VM host only; module stays importable

    if not stat.S_ISCHR(device.lstat().st_mode):
        raise ValueError("Actual KVM character device required")
    # Current-runner UID ACL only after root release; never world writable.
    if not os.access(device, os.R_OK | os.W_OK):
        owner.command(
            [
                "/usr/bin/sudo",
                "-n",
                TOOLS["setfacl"],
                "-m",
                "u:" + str(os.getuid()) + ":rw",
                str(device),
            ]
        )
    with device.open("r+b", buffering=0) as stream:
        version = fcntl.ioctl(stream.fileno(), 0xAE00, 0)
    if version != KVM_API:
        raise ValueError("Actual KVM API12 required; no software emulation fallback")
    return {
        "device": str(device),
        "api_version": version,
        "acceleration": "KVM",
        "tcg_fallback": False,
    }


def prepare_inputs(args: argparse.Namespace, owner: Owner) -> dict[str, Any]:
    work = owner.work
    lock = validate_closure(args.guest_closure, args.guest_closure_sha256)
    if sha(args.host_tools_lock, 2 * 1024 * 1024) != args.host_tools_lock_sha256:
        raise ValueError("Reviewed host tool lock differs")
    host_lock = json.loads(args.host_tools_lock.read_bytes())
    if host_lock["runner_image_version"] != os.environ.get(RUNNER_IMAGE_VERSION_ENV):
        raise ValueError("Actual hosted runner image differs from reviewed host lock")
    for name, path in TOOLS.items():
        expected = host_lock["tools"][name]
        if expected["path"] != path or sha(Path(path)) != expected["sha256"]:
            raise ValueError("Actual host native tool differs from reviewed lock")
    memory = dict(
        line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines()
    )
    total = int(memory["MemTotal"].split()[0]) * 1024
    available = int(memory["MemAvailable"].split()[0]) * 1024
    free = shutil.disk_usage(work).free
    write(
        args.proof / "resource-preflight.json",
        {
            "ram_bytes": total,
            "available_ram_bytes": available,
            "free_disk_bytes": free,
            "runner_image_version": os.environ.get(RUNNER_IMAGE_VERSION_ENV),
            "acceleration": "KVM_NO_SOFTWARE_FALLBACK",
            "guest_ram_MiB": 4096,
            "guest_vcpus": 2,
        },
    )
    if total < 6 * 1024**3 or available < 5 * 1024**3 or free < 10 * 1024**3:
        raise ValueError("Hosted resource capability is insufficient for reviewed VM")
    write(args.proof / "kvm.json", kvm(owner))
    if sha(args.package / "export.json", DOCUMENT_CAP) != args.package_export_sha256:
        raise ValueError("Reviewed exact package export differs")
    export = json.loads((args.package / "export.json").read_bytes())
    if (
        export["expected_head"] != args.package_build_head
        or export["target"] != "x86_64-unknown-linux-gnu"
    ):
        raise ValueError("Actual inspected package source/target differs")
    for name, pin in export["files"].items():
        if Path(name).name != name or sha(args.package / name) != pin["sha256"]:
            raise ValueError("Exact package export input changed")
    source_before, git_binding = bind_source(args, owner, export)
    if sha(args.image_keyring, 1024 * 1024) != args.image_keyring_sha256:
        raise ValueError("Reviewed UEC image keyring differs")
    return {
        "lock": lock,
        "export": export,
        "source_before": source_before,
        "git_binding": git_binding,
    }


def prepare_image(args: argparse.Namespace, owner: Owner) -> Path:
    work = owner.work
    image = work / "ubuntu-cloud.img"
    sums, signature = work / "SHA256SUMS", work / "SHA256SUMS.gpg"
    base = IMAGE.rsplit("/", 1)[0]
    owner.download(base + "/SHA256SUMS", sums, 1024 * 1024, 30)
    owner.download(base + "/SHA256SUMS.gpg", signature, QMP_CAP, 30)
    verified = owner.command(
        [
            TOOLS["gpgv"],
            "--status-fd",
            "1",
            "--keyring",
            str(args.image_keyring),
            str(signature),
            str(sums),
        ]
    )
    if not any(
        line.startswith("[GNUPG:] VALIDSIG " + FINGERPRINT + " ")
        for line in verified.decode().splitlines()
    ):
        raise ValueError("Actual detached signature has wrong UEC signing fingerprint")
    expected_line = IMAGE_SHA + " *" + IMAGE.rsplit("/", 1)[1]
    if expected_line not in sums.read_text().splitlines():
        raise ValueError("Official signed dated image checksum differs")
    owner.download(IMAGE, image, 1024 * 1024 * 1024, 900)
    if sha(image) != IMAGE_SHA:
        raise ValueError("Actual official image digest differs")
    write(
        args.proof / "image-receipt.json",
        {
            "url": IMAGE,
            "sha256": IMAGE_SHA,
            "bytes": image.stat().st_size,
            "checksum_sha256": sha(sums),
            "signature_sha256": sha(signature),
            "signing_fingerprint": FINGERPRINT,
        },
    )
    return image


@dataclass(frozen=True, repr=False)
class VMPlan:
    argv: list[str]
    qmp_path: Path
    ssh: list[str]


def prepare_guest(
    args: argparse.Namespace,
    owner: Owner,
    image: Path,
    lock: dict[str, Any],
    export: dict[str, Any],
) -> VMPlan:
    work = owner.work
    payload = work / "input"
    payload.mkdir(mode=0o700)
    (payload / "package").mkdir()
    for name in ["export.json", *export["files"]]:
        shutil.copyfile(args.package / name, payload / "package" / name)
    (payload / "guest-closure/debs").mkdir(parents=True)
    shutil.copyfile(
        args.guest_closure / "lock.json", payload / "guest-closure/lock.json"
    )
    for row in lock["packages"]:
        shutil.copyfile(
            args.guest_closure / "debs" / row["filename"],
            payload / "guest-closure/debs" / row["filename"],
        )
    scripts = payload / "scripts"
    scripts.mkdir()
    for name in SCRIPTS:
        shutil.copyfile(Path(__file__).with_name(name), scripts / name)
    overlay = work / "guest.qcow2"
    owner.command(
        [
            TOOLS["qemu_img"],
            "create",
            "-f",
            "qcow2",
            "-F",
            "qcow2",
            "-b",
            str(image),
            str(overlay),
            "24G",
        ]
    )
    client_key, host_key = work / "client_key", work / "guest_host_key"
    for key_path in (client_key, host_key):
        owner.command(
            [TOOLS["keygen"], "-q", "-t", "ed25519", "-N", "", "-f", str(key_path)]
        )
    cloud = {
        "users": [
            {
                "name": "japp-ci",
                "lock_passwd": True,
                "shell": "/bin/bash",
                "ssh_authorized_keys": [
                    client_key.with_suffix(".pub").read_text().strip()
                ],
            }
        ],
        "ssh_deletekeys": False,
        "ssh_genkeytypes": [],
        "write_files": [
            {
                "path": "/etc/ssh/ssh_host_ed25519_key",
                "permissions": "0600",
                "owner": "root:root",
                "content": host_key.read_text(),
            },
            {
                "path": "/etc/ssh/ssh_host_ed25519_key.pub",
                "permissions": "0644",
                "owner": "root:root",
                "content": host_key.with_suffix(".pub").read_text(),
            },
        ],
        "runcmd": [
            ["/usr/bin/systemctl", "restart", "ssh"],
            ["/usr/bin/mkdir", "-p", "/mnt/jappinput"],
            [
                "/usr/bin/mount",
                "-t",
                "9p",
                "-o",
                "trans=virtio,version=9p2000.L,ro",
                "jappinput",
                "/mnt/jappinput",
            ],
            unmounted_input_step(),
            [
                "/usr/bin/python3",
                "/mnt/jappinput/scripts/ubuntu_gnome_provision.py",
            ],
        ],
    }
    user_data, metadata = work / "user-data", work / "meta-data"
    user_data.write_text("#cloud-config\n" + json.dumps(cloud))
    metadata.write_text(
        json.dumps(
            {
                "instance-id": "japp-disposable-" + os.urandom(16).hex(),
                "local-hostname": "japp-gnome-ci",
            }
        )
    )
    seed = work / "seed.img"
    owner.command([TOOLS["seed"], str(seed), str(user_data), str(metadata)])
    with socket.socket() as selection:
        selection.bind(("127.0.0.1", 0))
        port = selection.getsockname()[1]
    known = work / "known_hosts"
    known.write_text(
        "[127.0.0.1]:" + str(port) + " " + host_key.with_suffix(".pub").read_text()
    )
    qmp_path = work / "qmp.sock"
    argv = [
        TOOLS["qemu"],
        "-machine",
        "q35",
        "-accel",
        "kvm",
        "-cpu",
        "host",
        "-smp",
        "2",
        "-m",
        "4096",
        "-drive",
        "file=" + str(overlay) + ",if=virtio,format=qcow2",
        "-drive",
        "file=" + str(seed) + ",if=virtio,format=raw,readonly=on",
        "-virtfs",
        "local,path="
        + str(payload)
        + ",mount_tag=jappinput,security_model=none,readonly=on",
        "-netdev",
        "user,id=n0,restrict=on,hostfwd=tcp:127.0.0.1:" + str(port) + "-:22",
        "-device",
        "virtio-net-pci,netdev=n0",
        "-device",
        "virtio-vga",
        "-device",
        "qemu-xhci",
        "-device",
        "usb-tablet",
        "-display",
        "none",
        "-qmp",
        "unix:" + str(qmp_path) + ",server=on,wait=off",
        "-serial",
        "file:" + str(work / "guest-serial.log"),
        "-no-reboot",
    ]
    ssh = [
        TOOLS["ssh"],
        "-F",
        "/dev/null",
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "UserKnownHostsFile=" + str(known),
        "-o",
        "ConnectTimeout=3",
        "-i",
        str(client_key),
        "-p",
        str(port),
        "japp-ci@127.0.0.1",
    ]
    return VMPlan(argv, qmp_path, ssh)


def unmounted_input_step() -> str:
    """Root checks the mount; only the synthetic account creates the marker.

    cloud-init runs a string runcmd item with sh. The private directory and
    the marker are created as japp-ci, the marker exclusively (dd conv=excl
    never follows or replaces an existing name), from fixed bytes only.
    """
    return (
        "/usr/bin/mountpoint -q /mnt/jappinput || "
        "{ /usr/sbin/runuser -u japp-ci -- /usr/bin/mkdir -m 0700 -p "
        + GUEST_PROOF.rstrip("/")
        + " && /usr/bin/printf '%s\\n' "
        + shlex.quote(json.dumps(INPUT_UNMOUNTED_MARKER, separators=(",", ":")))
        + " | /usr/sbin/runuser -u japp-ci -- /usr/bin/dd of="
        + GUEST_PROOF
        + INPUT_UNMOUNTED
        + " conv=excl status=none; }"
    )


def require_kvm_acceleration(owner: Owner) -> None:
    """QEMU's own answer, so a silently unaccelerated VM cannot proceed."""
    if owner.qmp_call("query-kvm") != {"enabled": True, "present": True}:
        raise ValueError("Owned VM is not KVM accelerated")


def launch_vm(args: argparse.Namespace, owner: Owner, plan: VMPlan) -> None:
    with (
        (args.proof / "qemu.stdout").open("xb") as stdout,
        (args.proof / "qemu.stderr").open("xb") as stderr,
    ):
        owner.child = subprocess.Popen(  # noqa: S603 - pinned QEMU and reviewed fixed device/owned-path argv
            plan.argv,
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            start_new_session=True,
        )
        owner.pgid = owner.child.pid
        observed_group = os.getpgid(owner.child.pid)
        if observed_group != owner.child.pid:
            raise ValueError("VM did not own fresh process group")
        owner.vm_group_verified = True
        deadline = time.monotonic() + 30
        while not plan.qmp_path.exists():
            if owner.child.poll() is not None or time.monotonic() >= deadline:
                raise TimeoutError("Owned QEMU failed before QMP readiness")
            time.sleep(0.1)
        owner.qmp = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        owner.qmp.settimeout(5)
        owner.qmp.connect(str(plan.qmp_path))
        owner.qmp_stream = owner.qmp.makefile("rb")
        greeting = owner.qmp_stream.readline(65537)
        if len(greeting) > QMP_CAP or "QMP" not in json.loads(greeting):
            raise ValueError("Owned QMP greeting invalid")
        owner.qmp_call("qmp_capabilities")
        require_kvm_acceleration(owner)


def observe_session(
    args: argparse.Namespace, owner: Owner, ssh: list[str]
) -> dict[str, Any]:
    if owner.child is None:
        raise ValueError("Owned VM required before session observation")
    deadline = min(owner.work_deadline, time.monotonic() + 1800)
    session_deadline: float | None = None
    while time.monotonic() < deadline:
        if owner.child.poll() is not None:
            raise RuntimeError("VM exited before actual session readiness")
        # A slow readiness poll is not readiness. Its reaped record is retained
        # and the provision/session deadlines still bound the observation.
        with contextlib.suppress(CommandDeadlineError):
            owner.command(
                [
                    *ssh,
                    (
                        "if /usr/bin/test -f "
                        "/home/japp-ci/japp-proof/provision-failure.json || "
                        "/usr/bin/test -f "
                        "/home/japp-ci/japp-proof/input-mount-failure.json; "
                        "then /usr/bin/printf 'PROVISION_FAILED\\n'; "
                        "elif /usr/bin/test -f "
                        "/home/japp-ci/japp-proof/controller-exit.json || "
                        "/usr/bin/test -f "
                        "/home/japp-ci/japp-proof/controller-failure.json; "
                        "then /usr/bin/printf 'CONTROLLER_ENDED\\n'; "
                        "elif /usr/bin/test -f "
                        "/home/japp-ci/japp-proof/provision.json; "
                        "then /usr/bin/printf 'PROVISIONED\\n'; fi; "
                        "/usr/bin/test -S /home/japp-ci/japp-proof/controller.sock"
                    ),
                ],
                seconds=6,
                permit_failure=True,
            )
        latest = json.loads(
            (
                args.proof / ("command-" + str(owner.sequence).zfill(3) + ".json")
            ).read_bytes()
        )
        output = (
            args.proof / ("command-" + str(owner.sequence).zfill(3) + ".stdout")
        ).read_bytes()
        if output in GUEST_ENDED:
            # The guest's own failure receipt, not a 1800 s timeout, is the cause.
            for name in GUEST_JSON:
                with contextlib.suppress(OSError, ValueError, RuntimeError):
                    fetch_guest_json(owner, name, cleanup=False)
            raise RuntimeError(GUEST_ENDED[output] + "; guest receipt retained")
        if output == b"PROVISIONED\n" and session_deadline is None:
            session_deadline = min(deadline, time.monotonic() + 120)
        if latest["exit_code"] == 0:
            break
        if owner.vm_output_exceeded():
            raise ValueError("Guest serial output cap exceeded")
        if session_deadline is not None and time.monotonic() >= session_deadline:
            raise TimeoutError("Actual GDM/GNOME session unavailable after provision")
        time.sleep(5)
    else:
        raise TimeoutError("Actual GDM/GNOME controller capability unavailable")
    owner.command(
        [
            *ssh,
            "/usr/bin/cat /home/japp-ci/japp-proof/actual-gnome-session.json",
        ],
        cap=131072,
    )
    session: object = json.loads(
        (
            args.proof / ("command-" + str(owner.sequence).zfill(3) + ".stdout")
        ).read_bytes()
    )
    if not isinstance(session, dict) or session.get("status") != "SESSION_READY":
        raise ValueError("Actual session receipt is not ready")
    write(args.proof / "actual-gnome-session.json", session)
    return session


def shell_request(owner: Owner, operation: str) -> dict[str, Any]:
    if owner.ssh is None:
        raise ValueError("Owned guest SSH endpoint required")
    response = json.loads(
        owner.command(
            [
                *owner.ssh,
                "/usr/bin/python3 /opt/japp-ci/ubuntu_gnome_guest.py --request "
                + shlex.quote(operation),
            ],
            seconds=40,
            permit_failure=True,
        )
    )
    name = response["receipt"]
    if re.fullmatch(r"[0-9]{2,3}-shell_[a-z0-9_]+\.json", name) is None:
        raise ValueError("Exact finite shell receipt filename required")
    raw = owner.command(
        [*owner.ssh, "/usr/bin/cat /home/japp-ci/japp-proof/" + shlex.quote(name)],
        cap=1024 * 1024,
    )
    receipt = json.loads(raw)
    write(owner.proof / name, receipt)
    if (
        response["status"] != "PASS"
        or receipt["status"] != "PASS"
        or receipt["operation"] != operation
    ):
        raise ValueError(
            "Actual shell operation failed; retained first raw observation"
        )
    result = receipt["result"]
    if not isinstance(result, dict):
        raise ValueError("Object native operation result required")
    return result


def capture_native_shell(
    owner: Owner, subject: str, frames: list[dict[str, object]]
) -> dict[str, Any]:
    routes: list[dict[str, Any]] = []
    measures: list[dict[str, Any]] = []
    shell_request(owner, "shell_focus_diagnostics")
    owner.keys(["ret"])
    owner.keys(["ctrl", "0"])
    for scale in ("baseline", "enlarged"):
        if scale == "enlarged":
            measures.append(shell_request(owner, "shell_scale_baseline"))
            for increment in range(1, 6):
                owner.keys(["ctrl", "shift", "equal"])
                measures.append(
                    shell_request(owner, "shell_scale_step" + str(increment))
                )
        for slug, label in ROUTES:
            shell_request(owner, "shell_focus_" + slug)
            owner.keys(["tab"])
            shell_request(owner, "shell_tab_" + slug)
            owner.keys(["shift", "tab"])
            shell_request(owner, "shell_back_" + slug)
            owner.keys(["ret"])
            observed = shell_request(owner, "shell_route_" + slug)
            frame = owner.frame("shell-" + scale + "-" + slug)
            frames.append(frame)
            if observed["heading"] != label:
                raise ValueError("Source-bound exact native route label differs")
            observed.pop(
                "accessibility"
            )  # Full tree remains in its separately retained raw receipt.
            observed["checked_before"] = None
            observed["checked_after"] = None
            if slug == "diagnostics":
                before = shell_request(owner, "shell_check_focus")
                owner.keys(["ret"])
                after = shell_request(owner, "shell_check_observe")
                observed["checked_before"] = before["checked_before"]
                observed["checked_after"] = after["checked_at"]
            shell_request(owner, "shell_skip_focus")
            owner.keys(["ret"])
            shell_request(owner, "shell_skip_observe")
            routes.append(
                {
                    **observed,
                    "scale": scale,
                    "route": slug,
                    "tab_shift_tab": True,
                    "skip_main": True,
                    "image_sha256": frame["sha256"],
                    "image_width": frame["width"],
                    "image_height": frame["height"],
                }
            )
    owner.keys(["ctrl", "0"])
    measures.append(shell_request(owner, "shell_scale_reset"))
    # The unchanged keyboard-after-enter lifecycle frame supplies the reset image
    # after another actual glyph/backing recheck. No 21st frame/cap increase.
    return {
        "schema": "japp-native-shell-capture-v1",
        "policy_sha256": POLICY_SHA256,
        "subject_sha256": subject,
        "platform": "GNOME_ATSPI",
        "measurements": measures,
        "routes": routes,
        "reset_image": None,
        "reader_output": "NOT_COLLECTED",
    }


def run_lifecycle(
    args: argparse.Namespace,
    owner: Owner,
    session: dict[str, Any],
    export: dict[str, Any],
    result: dict[str, object],
) -> None:
    ssh = owner.ssh
    if ssh is None:
        raise ValueError("Owned SSH endpoint required")
    frames = [owner.frame("session-before-product")]
    receipts = []
    native_shell: dict[str, Any] | None = None
    # (operation, QMP keys sent first, success frame). The frame set is
    # unchanged, so FRAME_CAP stays exactly 20; the launches added only to
    # reach the two quit paths, and the focus record taken right before the
    # Ctrl+Q chord, take no frame.
    sequence: list[tuple[str, list[str] | None, bool]] = [
        ("launch", None, True),
        ("keyboard_before", None, False),
        ("keyboard_after_tab", ["tab"], False),
        ("keyboard_after_shift_tab", ["shift", "tab"], False),
        ("keyboard_after_enter", ["ret"], True),
        ("auth", None, False),
        ("crash_service", None, True),
        ("close_observe", ["alt", "f4"], False),
        ("relaunch", None, True),
        ("close_observe", ["alt", "f4"], False),
        # The pinned product's own File > Quit and its Ctrl+Q accelerator,
        # as in the Windows quit and accelerator phases.
        ("relaunch", None, False),
        ("quit_menu", None, False),
        ("relaunch", None, False),
        ("accelerator_focus", None, False),
        ("quit_accelerator", ["ctrl", "q"], False),
        ("relocated_launch", None, True),
        ("force_parent", None, False),
        ("finish", None, False),
    ]
    for index, (operation, keys, framed) in enumerate(sequence, 1):
        if keys:
            owner.keys(keys)
        response = json.loads(
            owner.command(
                [
                    *ssh,
                    ("/usr/bin/python3 /opt/japp-ci/ubuntu_gnome_guest.py --request ")
                    + shlex.quote(operation),
                ],
                seconds=40,
                permit_failure=True,
            )
        )
        name = response["receipt"]
        if not re.fullmatch(r"[0-9]{2,3}-[a-z_]+\.json", name):
            raise ValueError("Guest returned unsafe receipt name")
        raw = owner.command(
            [
                *ssh,
                "/usr/bin/cat /home/japp-ci/japp-proof/" + shlex.quote(name),
            ],
            cap=1024 * 1024,
        )
        receipt = json.loads(raw)
        write(args.proof / name, receipt)
        receipts.append(
            {
                "file": name,
                "sha256": sha(args.proof / name),
                "operation": operation,
            }
        )
        if response["status"] != "PASS" or receipt["status"] != "PASS":
            raise ValueError(
                "Actual guest operation failed; first raw receipt preserved"
            )
        if operation == "launch":
            result["product_launched"] = True
        if framed:
            frames.append(
                owner.frame(str(index).zfill(2) + "-" + operation.replace("_", "-"))
            )
        if operation == "launch":
            native_shell = capture_native_shell(
                owner, export["files"]["package.deb"]["sha256"], frames
            )
        if operation == "keyboard_after_enter":
            if native_shell is None:
                raise ValueError("Complete native shell route capture required")
            native_shell["measurements"][-1] = shell_request(owner, "shell_scale_reset")
            native_shell["reset_image"] = frames[-1]["sha256"]
            validate_capture(
                native_shell, export["files"]["package.deb"]["sha256"], "GNOME_ATSPI"
            )
            verify_capture_images(args.proof, native_shell)
            write(args.proof / "native-shell.json", native_shell)
    result.update(
        status=SCOPED_RESULT,
        frames=frames,
        receipts=receipts,
        guest_closure_sha256=args.guest_closure_sha256,
        package_sha256=export["files"]["package.deb"]["sha256"],
        source_head=args.expected_head,
        default_session_type=session["logind_properties"]["Type"],
        distinct_quit="ATSPI_FILE_MENU_QUIT_AND_QMP_CTRL_Q_OBSERVED",
        universal_escaped_descendant_absence_claimed=False,
        forced_startup_collision_recovery_claimed=False,
        platform_certification_claimed=False,
    )


def final_source_guard(
    args: argparse.Namespace, owner: Owner, prepared: dict[str, Any]
) -> dict[str, object]:
    before = prepared["source_before"]
    after = {}
    for name in before:
        if time.monotonic() >= owner.cleanup_deadline:
            raise TimeoutError("Final source projection cleanup allowance expired")
        path = args.source / name
        info = path.lstat()
        after[name] = {
            "sha256": sha(path),
            "bytes": info.st_size,
            "mode": stat.S_IMODE(info.st_mode),
        }
    binding = (
        owner.command(
            [
                "/usr/bin/git",
                "-C",
                str(args.source),
                "rev-parse",
                "HEAD",
                "HEAD^{tree}",
            ],
            seconds=5,
            cleanup=True,
        )
        .decode()
        .splitlines()
    )
    status = owner.command(
        [
            "/usr/bin/git",
            "-C",
            str(args.source),
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ],
        seconds=5,
        cleanup=True,
    )
    unchanged = before == after and binding == prepared["git_binding"] and status == b""
    write(
        args.proof / "source-after.json",
        {
            "files": after,
            "head_tree": binding,
            "status_hex": status.hex(),
            "unchanged": unchanged,
        },
    )
    if not unchanged:
        raise ValueError("Shipping source bytes/modes or Git binding changed")
    return {
        "source_files": len(after),
        "bytes_modes_head_tree_status_unchanged": True,
        "ignored_runtime_or_whole_filesystem_neutrality_claimed": False,
    }


def fetch_guest_json(owner: Owner, name: str, cleanup: bool = True) -> bool:
    """Retain one bounded guest JSON receipt under its own name, if present."""
    if owner.ssh is None or (
        name not in GUEST_JSON and GUEST_RECEIPT.fullmatch(name) is None
    ):
        raise ValueError("Closed guest receipt name required")
    if (owner.proof / name).exists():
        return False
    raw = owner.command(
        [*owner.ssh, "/usr/bin/cat " + GUEST_PROOF + shlex.quote(name)],
        seconds=CLOSEOUT_SECONDS,
        cap=1024 * 1024,
        permit_failure=True,
        cleanup=cleanup,
    )
    if not raw:
        return False
    write(owner.proof / name, json.loads(raw))
    return True


def guest_proof_files(listing: bytes) -> set[str]:
    """Regular-file names from the closeout listing ('%M %s %f' per line)."""
    names = set()
    for line in listing.decode("utf-8", "replace").splitlines()[:4096]:
        fields = line.split(" ")
        if (
            len(fields) == LISTING_FIELDS
            and fields[0].startswith("-")
            and fields[1].isdecimal()
        ):
            names.add(fields[2])
    return names


def capture_guest_closeout(owner: Owner) -> None:
    # Every read is bounded by cleanup authority and its own cap, so a raw VM
    # output cap no longer suppresses the guest's own failure evidence.
    if owner.ssh is None or owner.child is None or owner.child.returncode is not None:
        return
    ssh = owner.ssh
    reserve = owner.cleanup_deadline - CLOSEOUT_RESERVE
    unreadable = (OSError, ValueError, RuntimeError)

    def read(remote: str, cap: int) -> bytes | None:
        if time.monotonic() + CLOSEOUT_SECONDS > reserve:
            return None
        return owner.command(
            [*ssh, remote],
            seconds=CLOSEOUT_SECONDS,
            cap=cap,
            permit_failure=True,
            cleanup=True,
        )

    try:
        listing = read(
            "/usr/bin/find /home/japp-ci/japp-proof -maxdepth 1 -printf '%M %s %f\\n'",
            65536,
        )
        record = owner.proof / ("command-" + str(owner.sequence).zfill(3) + ".json")
        if listing is None or (
            json.loads(record.read_bytes())["exit_code"] == SSH_TRANSPORT_FAILURE
        ):
            return
    except unreadable:
        return
    present = guest_proof_files(listing)
    receipts = sorted(name for name in present if GUEST_RECEIPT.fullmatch(name))
    # Usually only the receipts a failed request never returned are missing.
    wanted = [
        name
        for name in (*GUEST_JSON, *receipts)
        if name in present and not (owner.proof / name).exists()
    ]
    for name in wanted[:CLOSEOUT_FETCHES]:
        if time.monotonic() + CLOSEOUT_SECONDS > reserve:
            return
        with contextlib.suppress(*unreadable):
            fetch_guest_json(owner, name)
    logs = sorted(name for name in present if GUEST_LOG.fullmatch(name))
    for remote, cap in (
        ("/usr/bin/journalctl --user -b --no-pager -n 400", 256 * 1024),
        *(
            ("/usr/bin/cat " + GUEST_PROOF + shlex.quote(name), 2 * 1024 * 1024)
            for name in logs[:CLOSEOUT_LOGS]
        ),
    ):
        # Raw output stays retained as its own bounded command-NNN.stdout.
        with contextlib.suppress(*unreadable):
            read(remote, cap)


def retention_failure(proof: Path, error: BaseException) -> None:
    marker = {
        "status": "FINITE_RETENTION_FAILED",
        "error_type": type(error).__name__,
    }
    write(proof / "retention-failure.json", marker)
    retained = proof / "retained"
    if retained.is_dir() and not retained.is_symlink():
        write(retained / "retention-failure.json", marker)


def private_key_material(data: bytes, work: Path) -> bool:
    """Key markers, or any body line of this run's own two private keys."""
    if b"PRIVATE KEY" in data:
        return True
    for name in ("client_key", "guest_host_key"):
        key = work / name
        if key.is_file():
            for line in key.read_bytes().splitlines():
                body = line.strip()
                if (
                    len(body) >= KEY_LINE_MIN
                    and not body.startswith(b"-----")
                    and body in data
                ):
                    return True
    return False


def serial_tail(owner: Owner, serial: Path) -> dict[str, object]:
    """A bounded tail of the guest console, never any private key material."""
    observed: dict[str, object] = {
        "bytes": serial.stat().st_size,
        "sha256": sha(serial),
        "full_stream_retained": False,
        "tail_cap_bytes": SERIAL_TAIL_BYTES,
    }
    if serial.stat().st_size > SERIAL_SCAN_CAP:
        return {**observed, "tail_retained": False, "reason": "EXCEEDS_SCAN_CAP"}
    data = serial.read_bytes()
    if private_key_material(data, owner.work):
        return {
            **observed,
            "tail_retained": False,
            "reason": "PRIVATE_KEY_MATERIAL_PRESENT",
        }
    tail = data[-SERIAL_TAIL_BYTES:]
    with (owner.proof / SERIAL_TAIL).open("xb") as stream:
        stream.write(tail)
    return {
        **observed,
        "tail_retained": True,
        "tail_file": SERIAL_TAIL,
        "tail_bytes": len(tail),
        "tail_sha256": hashlib.sha256(tail).hexdigest(),
        "reason": "BOUNDED_TAIL_SCANNED_NO_PRIVATE_KEY_MATERIAL",
    }


def discard_failure_frame(owner: Owner) -> bool:
    """Remove a failure frame that was never validated; True if one existed."""
    path = owner.proof / FAILURE_FRAME
    if not path.exists() and not path.is_symlink():
        return False
    path.unlink()
    return True


def failure_frame(owner: Owner, status: object) -> dict[str, object]:
    """A failed campaign's last screen, before closeout and VM quit."""
    if status == SCOPED_RESULT:
        return {}
    if owner.child is None or owner.child.poll() is not None or owner.qmp is None:
        return {"failure_frame": {"captured": False, "reason": "VM_NOT_RUNNING"}}
    try:
        return {"failure_frame": owner.failure_frame()}
    except Exception as error:
        observed: dict[str, object] = {
            "captured": False,
            "error_type": type(error).__name__,
        }
        # QEMU may have written part or all of the file before the reply failed.
        try:
            observed["unvalidated_frame_removed"] = discard_failure_frame(owner)
        except OSError as cleanup:
            observed["unvalidated_frame_cleanup_error_type"] = type(cleanup).__name__
        return {"failure_frame": observed}


def settle_failure_frame(
    owner: Owner, result: dict[str, object], errors: list[dict[str, str]]
) -> None:
    """After the VM quit, drop a failure frame QEMU finished after a lost reply.

    QMP runs a queued screendump to completion before the quit, so only a
    validated failure frame is ever retained.
    """
    frame = result.get("failure_frame")
    if not isinstance(frame, dict) or frame.get("captured") is not False:
        return
    try:
        if discard_failure_frame(owner):
            frame["late_unvalidated_frame_removed"] = True
    except OSError as error:
        errors.append(
            {"stage": "failure_frame_discard", "error_type": type(error).__name__}
        )


def finalize(
    args: argparse.Namespace,
    owner: Owner,
    prepared: dict[str, Any] | None,
    result: dict[str, object],
) -> None:
    errors: list[dict[str, str]] = []
    result.update(failure_frame(owner, result["status"]))
    try:
        capture_guest_closeout(owner)
    except BaseException as error:
        errors.append(
            {"stage": "guest_closeout_observation", "error_type": type(error).__name__}
        )
    try:
        closure = owner.close()
        result["outer_closure"] = closure
        if closure.get("group_after_reap") == "EXISTS" or owner.pending_commands:
            errors.append(
                {"stage": "owned_process_closure", "error_type": "ClosureUnsettled"}
            )
    except BaseException as error:
        errors.append(
            {"stage": "owned_process_closure", "error_type": type(error).__name__}
        )
    settle_failure_frame(owner, result, errors)
    if prepared is not None:
        try:
            result["source_guard"] = final_source_guard(args, owner, prepared)
        except BaseException as error:
            errors.append(
                {"stage": "final_source_guard", "error_type": type(error).__name__}
            )
    serial = owner.work / "guest-serial.log"
    try:
        if serial.exists():
            result["serial_stream"] = serial_tail(owner, serial)
    except BaseException as error:
        errors.append(
            {"stage": "serial_bounded_tail", "error_type": type(error).__name__}
        )
    reaped = owner.child is None or owner.child.returncode is not None
    if (
        reaped
        and not owner.pending_commands
        and not any(row["stage"] == "owned_process_closure" for row in errors)
    ):
        try:
            shutil.rmtree(owner.work)
        except BaseException as error:
            errors.append(
                {"stage": "own_workspace_removal", "error_type": type(error).__name__}
            )
    else:
        errors.append(
            {
                "stage": "own_workspace_removal",
                "error_type": "UnsettledCustodyRetainedPrivately",
            }
        )
    result["campaign_status_before_finalization"] = result["status"]
    result["finalization_errors"] = errors
    if errors:
        result["status"] = "FINALIZATION_FAILED"
    result["elapsed_seconds"] = time.monotonic() - owner.started
    write(args.proof / "closure.json", result)
    try:
        result["retention"] = retain(args.proof)
    except BaseException as error:
        result["status"] = "FINITE_RETENTION_FAILED"
        # The original closure remains an immutable campaign observation. A
        # separate terminal marker prevents incomplete curation becoming PASS.
        retention_failure(args.proof, error)


def main() -> int:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    for name in (
        "source",
        "package",
        "guest-closure",
        "host-tools-lock",
        "image-keyring",
        "proof",
    ):
        parser.add_argument("--" + name, type=Path, required=True)
    for name in (
        "package-export-sha256",
        "guest-closure-sha256",
        "host-tools-lock-sha256",
        "image-keyring-sha256",
        "expected-head",
        "package-build-head",
        "source-tree",
    ):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    if (
        os.uname().sysname != "Linux"
        or os.uname().machine != "x86_64"
        or os.geteuid() == 0
    ):
        raise ValueError(
            "Only disposable unprivileged hosted Ubuntu x64 runner may own VM"
        )
    if any(
        not value.is_absolute() or "," in str(value) or "\n" in str(value)
        for value in (
            args.source,
            args.package,
            args.guest_closure,
            args.host_tools_lock,
            args.image_keyring,
            args.proof,
        )
    ):
        raise ValueError("Explicit absolute reviewed input/output paths required")
    if args.proof.exists() or args.proof.is_symlink():
        raise ValueError("Fresh proof path required")
    args.proof.mkdir(mode=0o700)
    work = Path(tempfile.mkdtemp(prefix="japp-gnome-owned-", dir=args.proof.parent))
    work.chmod(0o700)
    owner = Owner(work, args.proof)
    result: dict[str, object] = {
        "status": "PREPARATION_FAILED",
        "product_launched": False,
    }
    prepared: dict[str, Any] | None = None
    try:
        prepared = prepare_inputs(args, owner)
        lock, export = prepared["lock"], prepared["export"]
        image = prepare_image(args, owner)
        plan = prepare_guest(args, owner, image, lock, export)
        launch_vm(args, owner, plan)
        owner.ssh = plan.ssh
        session = observe_session(args, owner, plan.ssh)
        run_lifecycle(args, owner, session, export, result)
    except Exception as error:
        result.update(
            status="FAILED_OR_CAPABILITY_UNAVAILABLE",
            error_type=type(error).__name__,
            message=str(error)[:512],
        )
    finally:
        finalize(args, owner, prepared, result)
    return 0 if result["status"] == SCOPED_RESULT else 1


if __name__ == "__main__":
    raise SystemExit(main())
