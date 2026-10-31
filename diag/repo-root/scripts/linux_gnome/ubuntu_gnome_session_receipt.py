"""Prospective guest-only read-only session collector; no product/GUI actor.

Launch from an XDG autostart entry in the disposable guest's real GDM session.
Do not populate session variables from an SSH shell. Never invoke GNOME Eval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import stat
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_process import ChildCustody

OBSERVATION_SECONDS = 3
OBSERVATION_BYTES = 32768
PUBLIC_FILE_CAP = 65536
ENVIRONMENT_VALUE_CAP = 2048
SHELL_ARGV_CAP = 8192
SESSION_RECEIPT_CAP = 131072
X11_SOCKET_ROOT = Path("/tmp/.X11-unix")  # noqa: S108 - prescribed OS socket metadata, never a temporary file
PRIVATE_DIRECTORY_MODE = 0o700

ENVIRONMENT = (
    "XDG_SESSION_ID",
    "XDG_SESSION_TYPE",
    "XDG_CURRENT_DESKTOP",
    "XDG_SESSION_DESKTOP",
    "GDMSESSION",
    "GNOME_SHELL_SESSION_MODE",
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "XDG_RUNTIME_DIR",
)
PROPERTIES = (
    "Id",
    "User",
    "Type",
    "Desktop",
    "Class",
    "Service",
    "Seat",
    "Active",
    "State",
    "Remote",
    "Leader",
)
PACKAGES = (
    "ubuntu-desktop-minimal",
    "ubuntu-session",
    "ubuntu-settings",
    "gdm3",
    "gnome-session-bin",
    "gnome-shell",
    "gnome-settings-daemon",
    "mutter-common",
    "libgtk-3-0t64",
    "libwebkit2gtk-4.1-0",
    "gir1.2-atspi-2.0",
    "python3-gi",
    "libgl1-mesa-dri",
)


@dataclass
class ObservationState:
    directory: Path | None = None
    pending: list[ChildCustody] = field(default_factory=list)
    observed: list[ChildCustody] = field(default_factory=list)


_STATE = ObservationState()


def observation_group(custody: ChildCustody | None) -> str:
    if custody is None:
        return "NOT_STARTED"
    try:
        os.killpg(custody.pgid, 0)
    except ProcessLookupError:
        return "ABSENT"
    except PermissionError:
        return "INACCESSIBLE"
    return "EXISTS"


def command(argv: list[str]) -> dict[str, object]:
    if _STATE.directory is None:
        raise ValueError("Private observation directory is not initialized")
    started = time.monotonic()
    custody: ChildCustody | None = None
    error_type = None
    with (
        tempfile.TemporaryFile(dir=_STATE.directory) as stdout,
        tempfile.TemporaryFile(dir=_STATE.directory) as stderr,
    ):
        try:
            child = subprocess.Popen(  # noqa: S603 - fixed observation argv, no shell
                argv, stdout=stdout, stderr=stderr, start_new_session=True
            )
            custody = ChildCustody(child, child.pid)
            _STATE.pending.append(custody)
            _STATE.observed.append(custody)
            if os.getpgid(child.pid) != child.pid:
                raise ValueError("Observation child did not own fresh group")
            custody.group_verified = True
            while child.poll() is None:
                if (
                    time.monotonic() - started > OBSERVATION_SECONDS
                    or os.fstat(stdout.fileno()).st_size
                    + os.fstat(stderr.fileno()).st_size
                    > OBSERVATION_BYTES
                ):
                    raise TimeoutError("Observation timeout or output cap")
                time.sleep(0.01)
        except Exception as error:
            error_type = type(error).__name__
        finally:
            if custody is not None:
                try:
                    custody.terminate_unreaped()
                except BaseException as error:
                    error_type = error_type or type(error).__name__
                if custody.is_reaped():
                    _STATE.pending.remove(custody)
        group = observation_group(custody)
        size = os.fstat(stdout.fileno()).st_size + os.fstat(stderr.fileno()).st_size
        code = custody.child.returncode if custody else None
        common = {
            "argv": argv,
            "group_after_reap": group,
            "signals": custody.signals if custody else [],
            "direct_child_reaped": custody.is_reaped() if custody else False,
            "retained_unreaped_custody": custody in _STATE.pending
            if custody
            else False,
            "elapsed_seconds": time.monotonic() - started,
        }
        if error_type or size > OBSERVATION_BYTES or group != "ABSENT":
            return {
                **common,
                "error": error_type or "OUTPUT_OR_GROUP_CLOSURE_FAILED",
                "direct_child_exit_code": code,
            }
        stdout.seek(0)
        stderr.seek(0)
        return {
            **common,
            "exit_code": code,
            "stdout": stdout.read(OBSERVATION_BYTES + 1).decode(
                "utf-8", errors="replace"
            ),
            "stderr": stderr.read(OBSERVATION_BYTES + 1).decode(
                "utf-8", errors="replace"
            ),
        }


def drain_observations() -> dict[str, object]:
    errors = []
    for custody in list(_STATE.pending):
        try:
            custody.terminate_unreaped()
        except BaseException as error:
            errors.append({"pgid": custody.pgid, "error_type": type(error).__name__})
        if custody.is_reaped():
            _STATE.pending.remove(custody)
    groups = [
        {
            "pgid": custody.pgid,
            "direct_child_reaped": custody.is_reaped(),
            "group_after_reap": observation_group(custody),
        }
        for custody in _STATE.observed
    ]
    return {
        "closed": not _STATE.pending
        and all(
            row["direct_child_reaped"] and row["group_after_reap"] == "ABSENT"
            for row in groups
        ),
        "retained_unreaped_count": len(_STATE.pending),
        "groups": groups,
        "cleanup_errors": errors,
    }


def metadata(path: Path) -> dict[str, object]:
    try:
        value = path.lstat()
    except OSError as error:
        return {"path": str(path), "error": type(error).__name__}
    return {
        "path": str(path),
        "mode": stat.S_IMODE(value.st_mode),
        "uid": value.st_uid,
        "gid": value.st_gid,
        "device": value.st_dev,
        "inode": value.st_ino,
        "directory": stat.S_ISDIR(value.st_mode),
        "socket": stat.S_ISSOCK(value.st_mode),
        "symlink": stat.S_ISLNK(value.st_mode),
    }


def public_system_file(path: Path) -> dict[str, object]:
    result = metadata(path)
    if "error" in result:
        return result
    if not stat.S_ISREG(path.lstat().st_mode) or path.stat().st_size > PUBLIC_FILE_CAP:
        raise ValueError("Bounded regular public session file required")
    data = path.read_bytes()
    result.update(
        bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        text=data.decode("utf-8"),
    )
    return result


def secret_service_capability() -> dict[str, object]:
    """Observe only already-owned bus service/default-collection lock metadata.

    No activation, OpenSession, item listing, key operation, unlock or prompt.
    Its result is documentary and is not a prerequisite for M03 Session Ready.
    """
    owner = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            "org.freedesktop.DBus",
            "--object-path",
            "/org/freedesktop/DBus",
            "--method",
            "org.freedesktop.DBus.NameHasOwner",
            "org.freedesktop.secrets",
        ]
    )
    result: dict[str, object] = {
        "state": "UNAVAILABLE",
        "name_owner_observation": owner,
        "scope": "READ_ONLY_ALREADY_RUNNING_SERVICE_DEFAULT_COLLECTION_LOCK_METADATA",
    }
    if owner.get("exit_code") != 0 or str(owner.get("stdout", "")).strip() != "(true,)":
        return result
    binding = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            "org.freedesktop.DBus",
            "--object-path",
            "/org/freedesktop/DBus",
            "--method",
            "org.freedesktop.DBus.GetNameOwner",
            "org.freedesktop.secrets",
        ]
    )
    result["unique_owner_observation"] = binding
    unique = re.fullmatch(
        r"\('(:[0-9]+\.[0-9]+)',\)\s*", str(binding.get("stdout", ""))
    )
    if binding.get("exit_code") != 0 or unique is None:
        return result
    # A vanished unique owner fails without activating a replacement service.
    destination = unique.group(1)
    alias = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            destination,
            "--object-path",
            "/org/freedesktop/secrets",
            "--method",
            "org.freedesktop.Secret.Service.ReadAlias",
            "default",
        ]
    )
    result["default_alias_observation"] = alias
    match = re.fullmatch(
        r"\(objectpath '(/[A-Za-z0-9_/]*)',\)\s*", str(alias.get("stdout", ""))
    )
    if alias.get("exit_code") != 0 or match is None or match.group(1) == "/":
        return result
    locked = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            destination,
            "--object-path",
            match.group(1),
            "--method",
            "org.freedesktop.DBus.Properties.Get",
            "org.freedesktop.Secret.Collection",
            "Locked",
        ]
    )
    result["default_collection_locked_observation"] = locked
    if locked.get("exit_code") == 0:
        value = str(locked.get("stdout", "")).strip()
        if value == "(<true>,)":
            result["state"] = "LOCKED"
        elif value == "(<false>,)":
            result["state"] = "AVAILABLE"
    return result


def observe_shell() -> tuple[dict[str, object], dict[str, object]]:
    shell = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            "org.freedesktop.DBus",
            "--object-path",
            "/org/freedesktop/DBus",
            "--method",
            "org.freedesktop.DBus.GetConnectionUnixProcessID",
            "org.gnome.Shell",
        ]
    )
    shell_identity: dict[str, object] = {}
    match = re.fullmatch(r"\(uint32 ([0-9]+),\)\s*", str(shell.get("stdout", "")))
    if shell.get("exit_code") == 0 and match:
        pid = int(match.group(1))
        proc = Path("/proc") / str(pid)
        try:
            executable = str((proc / "exe").readlink())
            # Only GNOME Shell's command line is read; no unrelated application
            # argv or environment blocks are collected.
            if executable != "/usr/bin/gnome-shell":
                raise ValueError("Bus owner is not the packaged GNOME Shell")
            raw = (proc / "cmdline").read_bytes()
            if len(raw) > SHELL_ARGV_CAP:
                raise ValueError("Shell command line exceeds bound")
            fields = (proc / "stat").read_text().rsplit(") ", 1)[1].split()
            shell_identity = {
                "pid": pid,
                "executable": executable,
                "uid": proc.stat().st_uid,
                "starttime_ticks": int(fields[19]),
                "command_line": raw.decode().split("\0")[:-1],
                "headless_or_nested": any(
                    flag in raw.split(b"\0") for flag in (b"--headless", b"--nested")
                ),
            }
        except OSError as error:
            shell_identity = {"error": type(error).__name__}
    return shell, shell_identity


def session_identifier(
    inherited: str | None, observations: dict[str, dict[str, object]]
) -> str | None:
    if inherited:
        return inherited
    # GNOME starts autostart applications in a systemd user scope outside the
    # login session, without XDG_SESSION_ID (KI-0149). logind itself names the
    # user's graphical session; every session check below still applies.
    owner = command(
        [
            "/usr/bin/loginctl",
            "show-user",
            str(os.geteuid()),
            "--property=Display",
            "--value",
        ]
    )
    observations["logind_user_display_session"] = owner
    if owner.get("exit_code") != 0:
        return None
    return str(owner["stdout"]).strip()


def observe_session() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    output = arguments.output
    if (
        not output.is_absolute()
        or output.exists()
        or output.is_symlink()
        or output.name != "actual-gnome-session.json"
    ):
        raise ValueError("Fresh exact session receipt filename required")
    parent = metadata(output.parent)
    if (
        parent.get("uid") != os.geteuid()
        or parent.get("mode") != PRIVATE_DIRECTORY_MODE
        or parent.get("directory") is not True
        or parent.get("symlink")
    ):
        raise ValueError("Owned existing private evidence parent required")
    _STATE.directory = output.parent
    environment = {key: os.environ.get(key) for key in ENVIRONMENT}
    if any(
        value is not None and len(value) > ENVIRONMENT_VALUE_CAP
        for value in environment.values()
    ):
        raise ValueError("Session metadata exceeds bound")
    observations: dict[str, dict[str, object]] = {}
    properties: dict[str, str] = {}
    identifier = session_identifier(environment["XDG_SESSION_ID"], observations)
    if identifier and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", identifier):
        session = command(
            [
                "/usr/bin/loginctl",
                "show-session",
                identifier,
                *["--property=" + key for key in PROPERTIES],
            ]
        )
        observations["loginctl"] = session
        if session.get("exit_code") == 0:
            properties = dict(
                line.split("=", 1)
                for line in str(session["stdout"]).splitlines()
                if "=" in line
            )
    shell, shell_identity = observe_shell()
    observations["shell_bus_owner"] = shell
    observations["shell_identity"] = shell_identity
    observations["graphical_session_target"] = command(
        ["/usr/bin/systemctl", "--user", "is-active", "graphical-session.target"]
    )
    observations["package_versions"] = command(
        [
            "/usr/bin/dpkg-query",
            "-W",
            "-f=${Package}\t${Version}\t${Architecture}\n",
            *PACKAGES,
        ]
    )
    observations["display_state"] = command(
        [
            "/usr/bin/gdbus",
            "call",
            "--session",
            "--dest",
            "org.gnome.Mutter.DisplayConfig",
            "--object-path",
            "/org/gnome/Mutter/DisplayConfig",
            "--method",
            "org.gnome.Mutter.DisplayConfig.GetCurrentState",
        ]
    )
    os_release = Path("/etc/os-release").read_text()
    operating_system = dict(
        line.split("=", 1)
        for line in os_release.splitlines()
        if "=" in line and not line.startswith("#")
    )
    operating_system = {
        key: value.strip('"') for key, value in operating_system.items()
    }
    session_type = properties.get("Type")
    display: dict[str, object] = {}
    if session_type == "wayland":
        runtime, wayland = (
            environment["XDG_RUNTIME_DIR"],
            environment["WAYLAND_DISPLAY"],
        )
        if (
            runtime == f"/run/user/{os.geteuid()}"
            and wayland
            and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", wayland)
        ):
            display = metadata(Path(runtime) / wayland)
    elif session_type == "x11":
        match = re.fullmatch(r":([0-9]{1,4})(?:\.[0-9])?", environment["DISPLAY"] or "")
        if match:
            display = metadata(X11_SOCKET_ROOT / ("X" + match.group(1)))
    secret_service = secret_service_capability()
    custody = drain_observations()
    checks = {
        "observation_children_closed": custody["closed"] is True,
        "ubuntu_24_04_x64": operating_system.get("ID") == "ubuntu"
        and operating_system.get("VERSION_ID") == "24.04"
        and platform.machine() == "x86_64",
        "actual_user_graphical_GDM_session": properties.get("User") == str(os.geteuid())
        and properties.get("Class") == "user"
        and properties.get("Service") in {"gdm-autologin", "gdm-password"}
        and properties.get("Seat") == "seat0"
        and properties.get("Active") == "yes"
        and properties.get("State") == "active"
        and session_type in {"wayland", "x11"},
        "ubuntu_GNOME_session": environment["GDMSESSION"] in {"ubuntu", "ubuntu-xorg"}
        and "GNOME" in (environment["XDG_CURRENT_DESKTOP"] or "").split(":")
        and environment["GNOME_SHELL_SESSION_MODE"] == "ubuntu",
        "actual_shell_owner": shell_identity.get("uid") == os.geteuid()
        and shell_identity.get("executable") == "/usr/bin/gnome-shell"
        and shell_identity.get("headless_or_nested") is False,
        "actual_display_socket": display.get("socket") is True
        and display.get("symlink") is False,
        "actual_graphical_session_target": observations["graphical_session_target"].get(
            "exit_code"
        )
        == 0,
        "package_versions_observed": observations["package_versions"].get("exit_code")
        == 0,
        "actual_Mutter_display_observed": observations["display_state"].get("exit_code")
        == 0,
    }
    files = [
        "/usr/share/gnome-session/sessions/ubuntu.session",
        "/usr/share/wayland-sessions/ubuntu.desktop",
        "/usr/share/xsessions/ubuntu-xorg.desktop",
    ]
    receipt = {
        "scope": (
            "ACTUAL_DISPOSABLE_GDM_UBUNTU_GNOME_SESSION_OBSERVATION_"
            "NOT_PRODUCT_OR_GUI_PASS"
        ),
        "status": "SESSION_READY" if all(checks.values()) else "CAPABILITY_UNAVAILABLE",
        "checks": checks,
        "session_environment_allowlist": environment,
        "logind_properties": properties,
        "os_release": operating_system,
        "machine": platform.machine(),
        "kernel": platform.release(),
        "display_socket": display,
        "observations": observations,
        "secret_service": secret_service,
        "observation_custody": custody,
        "public_session_files": [public_system_file(Path(name)) for name in files],
        "requires_separate_host_QMP_frame": True,
        "product_launched": False,
    }
    data = (json.dumps(receipt, indent=2) + "\n").encode()
    if len(data) > SESSION_RECEIPT_CAP:
        raise ValueError("Session receipt exceeded bound")
    with output.open("xb") as stream:
        stream.write(data)
    return 0 if all(checks.values()) else 78


def main() -> int:
    require_linux()
    primary: BaseException | None = None
    code = 78
    try:
        code = observe_session()
    except BaseException as error:
        primary = error
    # Retry only retained, unreaped exact child custody on every unwind.
    # Reaped groups are observed for refusal, never signalled by this drain.
    closure = drain_observations()
    if _STATE.directory is not None:
        data = (json.dumps(closure, indent=2) + "\n").encode()
        if len(data) > SESSION_RECEIPT_CAP:
            raise ValueError("Observation closeout exceeded bound") from primary
        with (_STATE.directory / "observation-closeout.json").open("xb") as stream:
            stream.write(data)
    if primary is not None:
        raise primary
    return code if closure["closed"] is True else 78


if __name__ == "__main__":
    raise SystemExit(main())
