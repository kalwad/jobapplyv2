"""Root-only one-time provisioning of the disposable synthetic QEMU guest.

Consumes a separately resolved/reviewed exact Debian archive closure. Never
updates apt metadata or downloads/resolves replacement packages during install.
The image, closure and source pins are checked by the outer owner first.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_process import ChildCustody, local_only_apt

if TYPE_CHECKING:
    import pwd

LOCK_PACKAGE_CAP = 2048
PRIVATE_DIRECTORY_MODE = 0o700

INPUT = Path("/mnt/jappinput")
STATE = Path("/var/lib/japp-ci")
ACCOUNT_HOME = Path("/home/japp-ci")
PENDING: list[ChildCustody] = []
# Root-only STATE logs handed to the synthetic proof directory, each bounded to
# the locked install's own 2 MiB cap; the host reads them over SSH.
STATE_LOGS = (
    "locked-install.log",
    "locked-versions.log",
    "relocated-extract.log",
    "dconf.log",
    "default-target.log",
    "restart-gdm.log",
)
STATE_LOG_COPY_CAP = 2 * 1024 * 1024
FAILURE_LOG_TAIL = 8 * 1024
FAILURE_RECEIPT_CAP = 64 * 1024
SCRIPTS = (
    "ubuntu_gnome_guest.py",
    "ubuntu_gnome_session_receipt.py",
    "ubuntu_gnome_atspi.py",
    "ubuntu_gnome_process.py",
    "ubuntu_gnome_platform.py",
    "ubuntu_gnome_shell.py",
)


@dataclass
class Progress:
    """The provisioning step in progress, named in a failure receipt."""

    phase: str = "start"
    log: Path | None = None
    log_completed: bool = False


PROGRESS = Progress()


def sha(path: Path, cap: int) -> str:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > cap:
        raise ValueError("Bounded regular provision input required")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def run(argv: list[str], log: Path, seconds: float, cap: int = 256 * 1024) -> None:
    PROGRESS.phase, PROGRESS.log, PROGRESS.log_completed = log.stem, log, False
    started = time.monotonic()
    custody: ChildCustody | None = None
    primary: BaseException | None = None
    cleanup_error: BaseException | None = None
    with log.open("xb") as stream:
        try:
            child = subprocess.Popen(  # noqa: S603 - literal guest installer argv, no shell
                argv,
                stdin=subprocess.DEVNULL,
                stdout=stream,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                env={
                    "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
                    "DEBIAN_FRONTEND": "noninteractive",
                    # Ubuntu's needrestart apt hook otherwise restarts ssh and
                    # systemd-networkd after the locked install, and the
                    # guest's only host channel never returned (KI-0149).
                    "NEEDRESTART_SUSPEND": "1",
                },
            )
            custody = ChildCustody(child, child.pid)
            PENDING.append(custody)
            if os.getpgid(child.pid) != child.pid:
                raise ValueError("Guest installer did not own fresh group")
            custody.group_verified = True
            while child.poll() is None:
                if time.monotonic() - started >= seconds or stream.tell() > cap:
                    raise TimeoutError("Guest provision command exceeded bound")
                time.sleep(0.1)
        except BaseException as error:
            primary = error
        finally:
            if custody is not None:
                try:
                    custody.terminate_unreaped()
                except BaseException as error:
                    cleanup_error = error
                if custody.is_reaped():
                    PENDING.remove(custody)
        if primary is not None:
            raise primary
        if cleanup_error is not None:
            raise cleanup_error
        if custody is None:
            raise RuntimeError("Guest provision command did not start")
        if custody.child.returncode != 0 or stream.tell() > cap:
            raise RuntimeError("Guest provision command failed; preserve exact raw log")
    PROGRESS.log_completed = True


def private(path: Path, uid: int, gid: int) -> None:
    try:
        path.mkdir(mode=PRIVATE_DIRECTORY_MODE)
    except FileExistsError:
        value = path.lstat()
        if (
            not stat.S_ISDIR(value.st_mode)
            or value.st_uid != uid
            or stat.S_IMODE(value.st_mode) != PRIVATE_DIRECTORY_MODE
        ):
            raise ValueError(
                "Existing synthetic private directory differs; no chmod fallback"
            ) from None
    else:
        os.chown(path, uid, gid)


def copy_controller_inputs(destination: Path) -> None:
    destination.mkdir(mode=0o755)
    sources = {name: INPUT / "scripts" / name for name in SCRIPTS}
    sources.update(
        {
            name: INPUT / "package" / name
            for name in ("export.json", "deb-inspection.json")
        }
    )
    for name, source in sources.items():
        original = sha(source, 8 * 1024 * 1024)
        target = destination / name
        shutil.copyfile(source, target)
        target.chmod(0o444)
        if (
            sha(source, 8 * 1024 * 1024) != original
            or sha(target, 8 * 1024 * 1024) != original
        ):
            raise ValueError("Provisioned controller input bytes changed")


def initialize_desktop(package: Path) -> pwd.struct_passwd:
    import pwd  # noqa: PLC0415 - Linux-only guest account lookup, not needed on import

    identity = pwd.getpwnam("japp-ci")
    home = Path(identity.pw_dir)
    if home != Path("/home/japp-ci"):
        raise ValueError("Unexpected synthetic account root")
    for path in (home / "japp-proof", home / ".config", home / ".config/autostart"):
        private(path, identity.pw_uid, identity.pw_gid)
    destination = Path("/opt/japp-ci")
    copy_controller_inputs(destination)
    # Extract the same inspected package once into a complete own Unicode
    # prefix. Never relocate just the executable or use a system fallback.
    relocated = home / "Job Apply ünicode space"
    relocated.mkdir(mode=PRIVATE_DIRECTORY_MODE)
    run(
        ["/usr/bin/dpkg-deb", "--extract", str(package), str(relocated)],
        STATE / "relocated-extract.log",
        30,
    )
    for path in [relocated, *relocated.rglob("*")]:
        if path.is_symlink():
            raise ValueError("Product archive unexpectedly contained a symlink")
        os.chown(path, identity.pw_uid, identity.pw_gid)
    autostart = home / ".config/autostart/japp-ci.desktop"
    autostart.write_text(
        "[Desktop Entry]\nType=Application\nName=JobApply disposable session probe\n"
        "Exec=/usr/bin/python3 /opt/japp-ci/ubuntu_gnome_guest.py --serve\n"
        "X-GNOME-Autostart-enabled=true\nNoDisplay=true\n"
    )
    os.chown(autostart, identity.pw_uid, identity.pw_gid)
    # Explicit synthetic session configuration; no real-user desktop unlock,
    # GNOME Eval or compositor substitution. Wayland/Xorg selection is unforced.
    Path("/etc/gdm3/custom.conf").write_text(
        "[daemon]\nAutomaticLoginEnable=true\nAutomaticLogin=japp-ci\n[security]\n[xdmcp]\n[chooser]\n[debug]\n"
    )
    profiles = Path("/etc/dconf/profile")
    profiles.mkdir(exist_ok=True)
    (profiles / "user").write_text("user-db:user\nsystem-db:local\n")
    defaults = Path("/etc/dconf/db/local.d")
    defaults.mkdir(parents=True, exist_ok=True)
    (defaults / "00-japp-disposable").write_text(
        "[org/gnome/desktop/interface]\ntoolkit-accessibility=true\n"
        "[org/gnome/desktop/session]\nidle-delay=uint32 0\n"
        "[org/gnome/desktop/screensaver]\nlock-enabled=false\n"
    )
    run(["/usr/bin/dconf", "update"], STATE / "dconf.log", 10)
    return identity


def activate_configured_desktop() -> None:
    run(
        ["/usr/bin/systemctl", "set-default", "graphical.target"],
        STATE / "default-target.log",
        10,
    )
    # Installing gdm3 may already have started the daemon before custom.conf
    # and dconf were written. Restart the disposable guest's daemon so the
    # configured synthetic session is not dependent on an undocumented reload.
    run(["/usr/bin/systemctl", "restart", "gdm3"], STATE / "restart-gdm.log", 30)


def tail(path: Path, cap: int) -> tuple[int, bytes] | None:
    try:
        info = path.lstat()
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("Regular provision log required")
    with path.open("rb") as stream:
        stream.seek(max(0, info.st_size - cap))
        return info.st_size, stream.read(cap)


def publish(target: Path, data: bytes, identity: pwd.struct_passwd) -> None:
    # Exclusive creation never follows a planted name; fchown binds the open file.
    with target.open("xb") as stream:
        stream.write(data)
        os.fchown(stream.fileno(), identity.pw_uid, identity.pw_gid)


def failure_receipt(
    failure: BaseException, copied: list[str], copy_error: Exception | None
) -> bytes:
    observed = tail(PROGRESS.log, FAILURE_LOG_TAIL) if PROGRESS.log else None
    withheld = observed is not None and b"PRIVATE KEY" in observed[1]
    receipt = {
        "status": "PROVISION_FAILED",
        "phase": PROGRESS.phase,
        "log": PROGRESS.log.name if PROGRESS.log else None,
        "log_completed": PROGRESS.log_completed,
        "log_bytes": observed[0] if observed else None,
        "log_tail": None
        if observed is None or withheld
        else observed[1].decode("utf-8", "replace"),
        "log_tail_cap_bytes": FAILURE_LOG_TAIL,
        "log_tail_withheld_private_key_marker": withheld,
        "error_type": type(failure).__name__,
        "message": str(failure)[:512],
        "state_logs_copied": copied,
        "state_log_copy_error_type": type(copy_error).__name__ if copy_error else None,
    }
    data = (json.dumps(receipt, indent=2) + "\n").encode()
    if len(data) > FAILURE_RECEIPT_CAP:
        raise ValueError("Provision failure receipt exceeds bound")
    return data


def publish_evidence(failure: BaseException | None) -> None:
    """Hand bounded provisioning evidence to the synthetic proof directory.

    STATE stays root-only. The host reads japp-proof over SSH as japp-ci, so a
    failed step leaves its cause there and the host fails fast instead of
    waiting out its whole provisioning window.
    """
    import pwd  # noqa: PLC0415 - Linux-only guest account lookup, not needed on import

    identity = pwd.getpwnam("japp-ci")
    if Path(identity.pw_dir) != ACCOUNT_HOME:
        raise ValueError("Unexpected synthetic account root")
    proof = ACCOUNT_HOME / "japp-proof"
    private(proof, identity.pw_uid, identity.pw_gid)
    copied: list[str] = []
    copy_error: Exception | None = None
    try:
        for name in STATE_LOGS:
            observed = tail(STATE / name, STATE_LOG_COPY_CAP)
            # A log that looks like key material is never handed out.
            if observed is not None and b"PRIVATE KEY" not in observed[1]:
                publish(proof / ("provision-" + name), observed[1], identity)
                copied.append(name)
    except Exception as error:
        copy_error = error
    # Logs first: the failure receipt is the host's signal to collect them.
    if failure is not None:
        publish(
            proof / "provision-failure.json",
            failure_receipt(failure, copied, copy_error),
            identity,
        )
    if copy_error is not None:
        raise copy_error


def main() -> None:
    require_linux()
    if os.geteuid() != 0:
        raise ValueError("Only root inside prepared disposable guest may provision")
    failure: BaseException | None = None
    try:
        provision()
    except BaseException as error:
        failure = error
        raise
    finally:
        try:
            publish_evidence(failure)
        except Exception as secondary:
            if failure is None:
                raise
            failure.add_note(
                "Provision evidence publication failed: " + type(secondary).__name__
            )


def locked_closure() -> tuple[bytes, list[str], dict[str, tuple[str, str]]]:
    closure_raw = (INPUT / "guest-closure/lock.json").read_bytes()
    if len(closure_raw) > 2 * 1024 * 1024:
        raise ValueError("Guest closure cap exceeded")
    closure = json.loads(closure_raw)
    if (
        closure["schema"] != "japp-reviewed-noble-closure-v1"
        or closure["architecture"] != "amd64"
    ):
        raise ValueError("Exact reviewed Noble x64 closure required")
    packages = closure["packages"]
    if not isinstance(packages, list) or not 1 <= len(packages) <= LOCK_PACKAGE_CAP:
        raise ValueError("Finite explicit guest package closure required")
    archives = []
    expected = {}
    for row in packages:
        name = row["filename"]
        if (
            not isinstance(name, str)
            or Path(name).name != name
            or not name.endswith(".deb")
        ):
            raise ValueError("Unsafe locked archive name")
        path = INPUT / "guest-closure/debs" / name
        if (
            path.stat().st_size != row["bytes"]
            or sha(path, 256 * 1024 * 1024) != row["sha256"]
        ):
            raise ValueError("Locked package bytes differ")
        key = row["package"]
        if key in expected:
            raise ValueError("Duplicate locked binary package")
        expected[key] = (row["version"], row["architecture"])
        archives.append(str(path))
    required = {
        "ubuntu-desktop-minimal",
        "ubuntu-session",
        "ubuntu-settings",
        "gdm3",
        "gnome-shell",
        "gir1.2-atspi-2.0",
        "python3-gi",
        "at-spi2-core",
        "openssh-server",
    }
    if not required <= expected.keys():
        raise ValueError(
            "Reviewed full Ubuntu GNOME/accessibility closure is incomplete"
        )
    return closure_raw, archives, expected


def provision() -> None:
    PROGRESS.phase = "verify_inputs"
    # cloud-init runs this file from INPUT itself, so a failed mount never
    # reaches here; the VM owner's runcmd marker (input-mount-failure.json)
    # reports that case. This check stays as a guard for any other caller.
    if not INPUT.is_mount():
        raise ValueError("Only root inside prepared disposable guest may provision")
    STATE.mkdir(mode=PRIVATE_DIRECTORY_MODE)
    closure_raw, archives, expected = locked_closure()
    PROGRESS.phase = "verify_product"
    package = INPUT / "package/package.deb"
    export = json.loads((INPUT / "package/export.json").read_bytes())
    if sha(package, 512 * 1024 * 1024) != export["files"]["package.deb"]["sha256"]:
        raise ValueError("Actual product archive differs from inspected export")
    # Local filenames only: with no repository configured, any unprovided
    # dependency fails instead of fetching an unreviewed version (KI-0148).
    run(
        [
            "/usr/bin/apt-get",
            *local_only_apt(STATE),
            "--no-install-recommends",
            "-y",
            "install",
            *archives,
            str(package),
        ],
        STATE / "locked-install.log",
        1200,
        # The reviewed 808-archive closure logged 242,847 bytes (KI-0153).
        cap=2 * 1024 * 1024,
    )
    versions_log = STATE / "locked-versions.log"
    run(
        [
            "/usr/bin/dpkg-query",
            "-W",
            "-f=${Package}\t${Version}\t${Architecture}\n",
            *sorted(expected),
        ],
        versions_log,
        15,
    )
    queried = versions_log.read_text()
    installed = {}
    for line in queried.splitlines():
        name, version, architecture = line.split("\t")
        installed[name] = (version, architecture)
    if installed != expected:
        raise ValueError("Installed package closure versions differ")
    PROGRESS.phase = "initialize_desktop"
    identity = initialize_desktop(package)
    PROGRESS.phase = "write_receipt"
    home = Path(identity.pw_dir)
    receipt = {
        "status": "EXACT_LOCKED_INSTALL_COMPLETE_SESSION_AND_PRODUCT_NOT_YET_OBSERVED",
        "guest_closure_sha256": hashlib.sha256(closure_raw).hexdigest(),
        "installed_locked_versions": installed,
        "image_baseline_packages_pinned_by_image": True,
        "package_sha256": export["files"]["package.deb"]["sha256"],
        "synthetic_autologin": True,
        "synthetic_idle_lock_disabled": True,
        "accessibility_enabled": True,
        "backend_forced": False,
    }
    (STATE / "provision.json").write_text(json.dumps(receipt, indent=2) + "\n")
    shutil.copyfile(STATE / "provision.json", home / "japp-proof/provision.json")
    os.chown(home / "japp-proof/provision.json", identity.pw_uid, identity.pw_gid)
    activate_configured_desktop()


if __name__ == "__main__":
    main()
