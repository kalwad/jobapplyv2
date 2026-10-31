"""Disposable Ubuntu guest controller, inherited from actual GDM autostart.

No shipping IPC, dev server, WebDriver flag, GNOME Eval, token or user-file read.
Only the synthetic guest account and exact installed/relocated package are used.
"""

from __future__ import annotations

import argparse
import errno
import hashlib
import http.client
import ipaddress
import json
import os
import re
import select
import shlex
import signal
import socket
import stat
import sys
import time
from pathlib import Path
from types import FrameType
from typing import Any

from ubuntu_gnome_atspi import Accessible, load_native, native_error
from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_session_receipt import main as session_main
from ubuntu_gnome_shell import ANCHORS, ROUTES, STAGES, mutter_backing

AX_NODE_CAP = 4096
AX_TEXT_CAP = 4096
MAX_SERVICE_DESCRIPTORS = 4096
HTTP_BODY_CAP = 4096
MIB = 1024 * 1024
AX_SNAPSHOT_BYTES = 1024 * 1024
MAX_AX_ACTIONS = 16
# The pinned product installs File > Quit (Ctrl+Q) on every non-macOS target
# (apps/desktop/src-tauri/src/lib.rs install_shell_quit_menu).
QUIT_MENU = ("File", "menu")
QUIT_ITEM = ("Quit", "menu item")
MENU_SECONDS = 3
# The pre-chord focus record stays small enough to name in a 512-character
# failure message; it is a diagnosis, never a gate.
FOCUS_SECONDS = 2
FOCUS_ROWS = 8
FOCUS_TEXT_CAP = 128
FOCUS_MESSAGE_ROWS = 4
FOCUS_MESSAGE_TEXT = 40
# The former 600 s lifetime was set for about 110 operations before any
# product actor ran. 1500 s stays below the host's 3300 s work deadline less
# its 900 s image download bound and the measured 268 s KVM readiness
# (docs/evidence/m03-native-runtime-diagnostics); per-operation 30 s limits
# are unchanged.
CONTROLLER_SECONDS = 1500
SOCKET_TABLE_CAP = 262144
PRIVATE_DIRECTORY_MODE = 0o700
REQUEST_CAP = 1024
RESPONSE_CAP = 2048
UNAUTHORIZED = 401
SOCKET_COLUMN_COUNT = 10

HOME = Path("/home/japp-ci")
PROOF = HOME / "japp-proof"
SOCKET = PROOF / "controller.sock"
INPUT = Path("/opt/japp-ci")
INSTALLED = Path("/")
RELOCATED = HOME / "Job Apply ünicode space"
MAIN = "usr/bin/japp-desktop"
SERVICE = "usr/lib/Desktop App/runtime/japp-orchestrator/japp-orchestrator"
ENTRY = Path("/usr/share/applications/Desktop App.desktop")
OPERATIONS: tuple[str, ...] = (
    "launch",
    "diagnostics",
    "keyboard_before",
    "keyboard_after_tab",
    "keyboard_after_shift_tab",
    "keyboard_after_enter",
    "auth",
    "crash_service",
    "close_observe",
    "relaunch",
    "quit_menu",
    "accelerator_focus",
    "quit_accelerator",
    "relocated_launch",
    "force_parent",
    "finish",
)

SHELL_OPERATIONS = (
    tuple(
        "shell_" + action + "_" + slug
        for action in ("focus", "tab", "back", "route")
        for slug, _label in ROUTES
    )
    + tuple("shell_scale_" + stage for stage in STAGES)
    + (
        "shell_skip_focus",
        "shell_skip_observe",
        "shell_check_focus",
        "shell_check_observe",
    )
)
OPERATIONS = OPERATIONS[:-1] + SHELL_OPERATIONS + OPERATIONS[-1:]


def document(path: Path, cap: int = MIB) -> dict[str, Any]:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > cap:
        raise ValueError("Bounded regular owned input required")
    result = json.loads(path.read_bytes())
    if not isinstance(result, dict):
        raise ValueError("Object receipt required")
    return result


def receive_line(connection: socket.socket, cap: int) -> bytes:
    data = bytearray()
    while not data.endswith(b"\n"):
        block = connection.recv(min(REQUEST_CAP, cap + 1 - len(data)))
        if not block or len(data) + len(block) > cap:
            raise ValueError("Controller frame incomplete or exceeds cap")
        data.extend(block)
    if b"\n" in data[:-1]:
        raise ValueError("Exactly one controller frame required")
    return bytes(data[:-1])


def file_record(path: Path) -> dict[str, object]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > 512 * MIB:
        raise ValueError("Regular bounded package member required")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(MIB):
            digest.update(block)
    after = path.lstat()
    before_identity = (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
        before.st_uid,
        before.st_gid,
    )
    after_identity = (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_mode,
        after.st_uid,
        after.st_gid,
    )
    if before_identity != after_identity:
        raise ValueError("Package member changed")
    return {
        "bytes": before.st_size,
        "mode": stat.S_IMODE(before.st_mode),
        "uid": before.st_uid,
        "gid": before.st_gid,
        "sha256": digest.hexdigest(),
    }


def process_identity(pid: int) -> dict[str, Any]:
    proc = Path("/proc") / str(pid)
    before = (proc / "stat").read_text().rsplit(") ", 1)[1].split()
    executable = str((proc / "exe").readlink())
    image = (proc / "exe").stat()
    owner = proc.stat().st_uid
    after = (proc / "stat").read_text().rsplit(") ", 1)[1].split()
    if before[19] != after[19] or owner != os.geteuid():
        raise ValueError("Process identity changed or foreign owner")
    return {
        "pid": pid,
        "ppid": int(after[1]),
        "starttime_ticks": int(after[19]),
        "state": after[0],
        "uid": owner,
        "executable": executable,
        "device": image.st_dev,
        "inode": image.st_ino,
    }


def matching_processes(path: Path) -> list[dict[str, Any]]:
    image = path.stat()
    found = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            # Never read candidate arguments, environment or private file contents.
            if entry.stat().st_uid != os.geteuid() or str(
                (entry / "exe").readlink()
            ) != str(path):
                continue
            identity = process_identity(int(entry.name))
            if (identity["device"], identity["inode"]) == (image.st_dev, image.st_ino):
                found.append(identity)
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
    return found


def same_process(identity: dict[str, Any]) -> bool:
    try:
        current = process_identity(identity["pid"])
        return all(
            current[key] == value for key, value in identity.items() if key != "state"
        )
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        return False


def identity_present(identity: dict[str, Any]) -> bool:
    """A zombie still has the original PID and does not count as absent."""
    try:
        fields = (
            (Path("/proc") / str(identity["pid"]) / "stat")
            .read_text()
            .rsplit(") ", 1)[1]
            .split()
        )
        return int(fields[19]) == int(identity["starttime_ticks"])
    except (FileNotFoundError, ProcessLookupError):
        return False


def exact_kill(identity: dict[str, Any]) -> dict[str, object]:
    descriptor = os.pidfd_open(identity["pid"], 0)
    try:
        if not same_process(identity):
            raise ValueError("Owned process binding changed before signal")
        signal.pidfd_send_signal(descriptor, signal.SIGKILL)
        ready, _, _ = select.select([descriptor], [], [], 3)
        if not ready:
            raise TimeoutError("Signalled exact process did not terminate")
        return {"signal": "SIGKILL", "pidfd_exit_observed": True, "identity": identity}
    finally:
        os.close(descriptor)


def parse_owned_listeners(
    tcp: str, tcp6: str, inodes: set[str]
) -> list[dict[str, str | int]]:
    listeners: list[dict[str, str | int]] = []
    for family, table in (("IPv4", tcp), ("IPv6", tcp6)):
        for line in table.splitlines()[1:]:
            columns = line.split()
            if len(columns) < SOCKET_COLUMN_COUNT:
                raise ValueError("Malformed native socket table")
            if columns[3] != "0A" or columns[9] not in inodes:
                continue
            encoded, port = columns[1].split(":")
            raw = bytes.fromhex(encoded)
            if family == "IPv4":
                address = str(ipaddress.IPv4Address(raw[::-1]))
                expected = "127.0.0.1"
            else:
                address = str(
                    ipaddress.IPv6Address(
                        b"".join(raw[i : i + 4][::-1] for i in range(0, 16, 4))
                    )
                )
                expected = "::1"
            if address != expected:
                raise ValueError("Service owns a non-literal-loopback listener")
            listeners.append(
                {
                    "family": family,
                    "address": address,
                    "port": int(port, 16),
                    "inode": columns[9],
                }
            )
    return listeners


def owned_listeners(identity: dict[str, Any]) -> list[dict[str, str | int]]:
    if not same_process(identity):
        raise ValueError("Service process changed before socket observation")
    descriptors = Path("/proc") / str(identity["pid"]) / "fd"
    inodes = set()
    entries = list(descriptors.iterdir())
    if len(entries) > MAX_SERVICE_DESCRIPTORS:
        raise ValueError("Service descriptor inventory exceeds bound")
    for entry in entries:
        try:
            match = re.fullmatch(r"socket:\[([0-9]+)\]", str(entry.readlink()))
            if match:
                inodes.add(match.group(1))
        except FileNotFoundError:
            continue
    tables = []
    for name in ("tcp", "tcp6"):
        with (Path("/proc") / str(identity["pid"]) / "net" / name).open("rb") as stream:
            raw = stream.read(SOCKET_TABLE_CAP + 1)
        if len(raw) > SOCKET_TABLE_CAP:
            raise ValueError("Native socket table exceeds bound")
        tables.append(raw.decode("ascii"))
    result = parse_owned_listeners(tables[0], tables[1], inodes)
    if not same_process(identity):
        raise ValueError("Service process changed during socket observation")
    return result


def port_from_listeners(listeners: list[dict[str, str | int]]) -> int:
    ipv4 = [row for row in listeners if row["family"] == "IPv4"]
    if len(ipv4) != 1 or len({row["port"] for row in listeners}) != 1:
        raise ValueError("One literal IPv4 endpoint and no other service port required")
    return int(ipv4[0]["port"])


def port_excluded(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as stream:
        try:
            stream.bind(("127.0.0.1", port))
        except OSError as error:
            if error.errno == errno.EADDRINUSE:
                return True
            raise
    return False


class Controller:
    def __init__(self) -> None:
        self.atspi, self.gio = load_native()
        self.native_error = native_error()
        self.root = INSTALLED
        self.app: dict[str, Any] | None = None
        self.service: dict[str, Any] | None = None
        self.port: int | None = None
        self.listeners: list[dict[str, str | int]] = []
        self.checked_at: str | None = None
        self.sequence = 0
        self.work_deadline = time.monotonic() + CONTROLLER_SECONDS
        self.operation_deadline = self.work_deadline
        self.before = self.package_binding(INSTALLED)
        self.relocated_before = self.package_binding(RELOCATED)
        self.known: list[dict[str, Any]] = []
        self.keyboard_origin: tuple[str, str] | None = None
        self.accelerator_focus: dict[str, Any] | None = None

    def package_binding(self, root: Path) -> dict[str, object]:
        inspection = document(INPUT / "export.json", 8 * MIB)
        pins = inspection["installed_files"]
        if not isinstance(pins, list):
            raise ValueError("Original archive file/mode list required")
        result: dict[str, object] = {}
        for row in pins:
            path = row["path"]
            if (
                not isinstance(path, str)
                or path.startswith("/")
                or ".." in Path(path).parts
            ):
                raise ValueError("Unsafe package member")
            actual = file_record(root / path)
            expected = {key: row[key] for key in ("bytes", "mode", "sha256")}
            if {key: actual[key] for key in expected} != expected:
                raise ValueError("Installed/relocated exact package file differs")
            expected_owner = (
                (0, 0) if root == INSTALLED else (os.geteuid(), os.getegid())
            )
            if (actual["uid"], actual["gid"]) != expected_owner:
                raise ValueError("Installed or own relocated package owner differs")
            result[path] = actual
        if MAIN not in result or SERVICE not in result:
            raise ValueError("Native application/service bindings missing")
        return result

    def fence(self) -> None:
        if time.monotonic() >= min(self.work_deadline, self.operation_deadline):
            raise TimeoutError("Guest operation work authority expired")

    def transient(self, error: Exception) -> bool:
        """A 'not yet' observation, retried within the operation's deadline.

        fence() and the SIGALRM handler raise TimeoutError, itself an OSError:
        expired authority always propagates. gi's GLib.Error (a RuntimeError)
        is a failed AT-SPI/D-Bus call, such as an accessible WebKit destroyed
        during a re-render or an 800 ms AT-SPI call timeout.
        """
        if isinstance(error, TimeoutError):
            return False
        return isinstance(error, (ValueError, OSError, self.native_error))

    def refresh(self) -> None:
        self.fence()
        apps = matching_processes(self.root / MAIN)
        services = matching_processes(self.root / SERVICE)
        if (
            len(apps) != 1
            or len(services) != 1
            or services[0]["ppid"] != apps[0]["pid"]
        ):
            raise ValueError(
                "Exact single app and direct owned packaged service required"
            )
        self.app, self.service = apps[0], services[0]
        self.listeners = owned_listeners(self.service)
        self.port = port_from_listeners(self.listeners)
        for identity in (self.app, self.service):
            if not any(
                row["pid"] == identity["pid"]
                and row["starttime_ticks"] == identity["starttime_ticks"]
                for row in self.known
            ):
                self.known.append(identity)

    def app_accessible(self) -> Accessible:
        if self.app is None or not same_process(self.app):
            raise ValueError("Actual app must be alive for accessibility query")
        desktop = self.atspi.get_desktop(0)
        found = []
        for index in range(min(desktop.get_child_count(), 128)):
            candidate = desktop.get_child_at_index(index)
            if candidate.get_process_id() == self.app["pid"]:
                found.append(candidate)
        if len(found) != 1:
            raise ValueError("One actual AT-SPI application identity required")
        return found[0]

    def validate_accessible_pid(self, pid: int) -> None:
        if self.app is None:
            raise ValueError("Observed application identity required")
        if pid in {0, self.app["pid"]}:
            return
        identity = process_identity(pid)
        if Path(identity["executable"]).name not in {
            "WebKitWebProcess",
            "WebKitNetworkProcess",
        }:
            raise ValueError("Foreign process inside application accessibility tree")
        for _ in range(8):
            self.fence()
            if identity["ppid"] == self.app["pid"]:
                return
            identity = process_identity(identity["ppid"])
        raise ValueError("WebKit accessibility process is not owned app descendant")

    def accessible_text(self, node: Accessible) -> str:
        self.fence()
        try:
            interface = node.get_text_iface()
            if interface is None:
                return ""
            count = interface.get_character_count()
            if not 0 <= count <= AX_TEXT_CAP:
                raise ValueError("Accessibility text exceeds bound")
            text = interface.get_text(0, count)
        except NotImplementedError:
            return ""
        self.fence()
        return text

    def accessible_actions(self, node: Accessible) -> list[str]:
        self.fence()
        try:
            interface = node.get_action_iface()
            if interface is None:
                return []
            count = interface.get_n_actions()
            if not 0 <= count <= MAX_AX_ACTIONS:
                raise ValueError("Accessibility action count exceeds bound")
            actions = [interface.get_action_name(i) for i in range(count)]
        except NotImplementedError:
            return []
        self.fence()
        return actions

    def tree(self) -> tuple[list[dict[str, Any]], list[Accessible]]:
        pending: list[tuple[Accessible, int | None]] = [(self.app_accessible(), None)]
        rows: list[dict[str, Any]] = []
        objects: list[Accessible] = []
        size = 2
        while pending:
            self.fence()
            node, parent = pending.pop(0)
            if len(rows) >= AX_NODE_CAP:
                raise ValueError("Accessibility traversal exceeded bound")
            pid = node.get_process_id()
            self.validate_accessible_pid(pid)
            name = node.get_name() or ""
            if len(name) > AX_TEXT_CAP:
                raise ValueError("Accessibility name exceeds bound")
            row = {
                "id": len(rows),
                "parent": parent,
                "name": name,
                "text": self.accessible_text(node),
                "role": node.get_role_name(),
                "pid": pid,
                "focused": node.get_state_set().contains(self.atspi.StateType.FOCUSED),
                "actions": self.accessible_actions(node),
            }
            size += len(json.dumps(row).encode()) + 2
            if size > AX_SNAPSHOT_BYTES:
                raise ValueError("Accessibility snapshot exceeds byte bound")
            rows.append(row)
            objects.append(node)
            count = node.get_child_count()
            if count < 0 or len(rows) + len(pending) + count > AX_NODE_CAP:
                raise ValueError("Accessibility tree exceeds bound")
            pending.extend(
                (node.get_child_at_index(i), len(rows) - 1) for i in range(count)
            )
        self.fence()
        return rows, objects

    def action(self, name: str) -> None:
        rows, objects = self.tree()
        found = [row for row in rows if row["name"] == name and row["actions"]]
        # Link text may be exposed both by a parent link and static text. Require
        # the one actionable node, never click by guessed coordinates.
        if len(found) != 1:
            raise ValueError("One actionable named native accessibility node required")
        self.activate(objects[found[0]["id"]], found[0]["actions"])

    def activate(self, node: Accessible, actions: list[str]) -> str:
        interface = node.get_action_iface()
        if interface is None:
            raise ValueError("Observed actionable node lost its action interface")
        indices = [
            i
            for i, action in enumerate(actions)
            if action in {"click", "press", "activate", "jump"}
        ]
        if len(indices) != 1 or not interface.do_action(indices[0]):
            raise ValueError("Actual supported native accessibility action failed")
        return actions[indices[0]]

    def await_ready(self, fresh: bool = False) -> dict[str, Any]:
        deadline = min(self.work_deadline, time.monotonic() + 20)
        last: str | None = None
        while time.monotonic() < deadline:
            try:
                self.refresh()
                rows, _ = self.tree()
                values = [
                    value
                    for row in rows
                    for value in (row["name"], row["text"])
                    if value
                ]
                joined = "\n".join(values)
                timestamps = set(
                    re.findall(
                        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", joined
                    )
                )
                required = {
                    "Local service",
                    "Service status",
                    "Ready",
                    "Service version",
                    "0.0.1",
                    "API version",
                    "1.0.0",
                    "Checked at",
                }
                if required <= set(values) and len(timestamps) == 1:
                    timestamp = next(iter(timestamps))
                    if not fresh or timestamp != self.checked_at:
                        self.checked_at = timestamp
                        return {
                            "app": self.app,
                            "service": self.service,
                            "port": self.port,
                            "checked_at": timestamp,
                            "listeners": self.listeners,
                            "accessibility": rows,
                        }
            except Exception as error:
                if not self.transient(error):
                    raise
                last = type(error).__name__
            time.sleep(0.1)
        raise TimeoutError("Actual native Diagnostics Ready unavailable: " + str(last))

    def launch(self, relocated: bool = False) -> dict[str, Any]:
        self.root = RELOCATED if relocated else INSTALLED
        if matching_processes(INSTALLED / MAIN) or matching_processes(RELOCATED / MAIN):
            raise ValueError("Prior known application still alive")
        if "TAURI_WEBVIEW_AUTOMATION" in os.environ or "GDK_BACKEND" in os.environ:
            raise ValueError(
                "Initial actual desktop backend/automation must be unforced"
            )
        allowed = {
            "HOME",
            "USER",
            "LOGNAME",
            "LANG",
            "LC_ALL",
            "DISPLAY",
            "WAYLAND_DISPLAY",
            "XAUTHORITY",
            "XDG_RUNTIME_DIR",
            "DBUS_SESSION_BUS_ADDRESS",
            "XDG_CURRENT_DESKTOP",
            "XDG_SESSION_TYPE",
            "GNOME_SHELL_SESSION_MODE",
            "XDG_DATA_DIRS",
            "XDG_CONFIG_DIRS",
            "GTK_MODULES",
            "AT_SPI_BUS_ADDRESS",
        }
        inherited = {key: value for key, value in os.environ.items() if key in allowed}
        os.environ.clear()
        os.environ.update(inherited, PATH="/usr/sbin:/usr/bin:/sbin:/bin")
        if relocated:
            app = self.gio.AppInfo.create_from_commandline(
                shlex.quote(str(self.root / MAIN)),
                "Desktop App",
                self.gio.AppInfoCreateFlags.NONE,
            )
        else:
            app = self.gio.DesktopAppInfo.new_from_filename(str(ENTRY))
        if app is None or not app.launch([], None):
            raise ValueError("Actual GIO desktop launch failed")
        deadline = min(self.work_deadline, time.monotonic() + 20)
        while time.monotonic() < deadline:
            try:
                self.refresh()
                self.action("Open Diagnostics")
                return self.await_ready()
            except Exception as error:
                if not self.transient(error):
                    raise
                time.sleep(0.1)
        raise TimeoutError("Actual package launch/accessibility unavailable")

    def observe_close(self) -> dict[str, Any]:
        if self.app is None or self.service is None or self.port is None:
            raise ValueError("Known actual app/service required")
        old_app, old_service, old_port = self.app, self.service, self.port
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if (
                not identity_present(old_app)
                and not identity_present(old_service)
                and not port_excluded(old_port)
            ):
                return {
                    "app": old_app,
                    "service": old_service,
                    "port": old_port,
                    "known_identities_absent": True,
                    "exclusive_bind_release": True,
                    "elapsed_seconds": 5 - (deadline - time.monotonic()),
                    "universal_escaped_descendant_absence_claimed": False,
                }
            time.sleep(0.05)
        raise TimeoutError("Known app/service/listener did not close")

    def keyboard(self, operation: str) -> dict[str, Any]:
        if operation == "keyboard_before":
            rows, objects = self.tree()
            candidates = [
                row for row in rows if row["name"] == "Home" and row["actions"]
            ]
            if len(candidates) != 1:
                raise ValueError("One actual Home link required")
            component = objects[candidates[0]["id"]].get_component_iface()
            if component is None or not component.grab_focus():
                raise ValueError("Actual Home link could not receive native focus")
            time.sleep(0.1)
        rows, _ = self.tree()
        focused = [row for row in rows if row["focused"]]
        semantic_focus = {(row["name"], row["role"]) for row in focused if row["name"]}
        if operation == "keyboard_before":
            if len(semantic_focus) != 1 or next(iter(semantic_focus))[0] != "Home":
                raise ValueError("Actual keyboard origin is not Home link")
            self.keyboard_origin = next(iter(semantic_focus))
        elif operation == "keyboard_after_tab":
            if not semantic_focus or self.keyboard_origin in semantic_focus:
                raise ValueError("Native Tab did not move actual focus")
        elif operation == "keyboard_after_shift_tab":
            if semantic_focus != {self.keyboard_origin}:
                raise ValueError("Native Shift+Tab did not return actual Home focus")
        elif operation == "keyboard_after_enter":
            if not any(
                row["role"] == "heading" and row["name"] == "Home" for row in rows
            ):
                raise ValueError("Native Enter did not navigate to Home heading")
            self.action("Open Diagnostics")
            self.await_ready(fresh=True)
        return {"accessibility": rows, "focused": focused}

    def authentication(self) -> dict[str, Any]:
        self.refresh()
        if self.port is None:
            raise ValueError("Observed service listener required")
        responses = []
        for route in ("health", "ready", "version"):
            for wrong in (False, True):
                connection = http.client.HTTPConnection(
                    "127.0.0.1", self.port, timeout=2
                )
                try:
                    headers = (
                        {"Authorization": "Bearer japp-ci-deliberately-wrong"}
                        if wrong
                        else {}
                    )
                    connection.request("GET", "/api/v1/" + route, headers=headers)
                    response = connection.getresponse()
                    body = response.read(4097)
                    if response.status != UNAUTHORIZED or len(body) > HTTP_BODY_CAP:
                        raise ValueError(
                            "Unauthenticated boundary did not return bounded401"
                        )
                    responses.append(
                        {
                            "route": route,
                            "wrong_token": wrong,
                            "status": response.status,
                            "body_bytes": len(body),
                        }
                    )
                finally:
                    connection.close()
        if not port_excluded(self.port):
            raise ValueError("Actual active service port was not exclusive")
        return {
            "responses": responses,
            "active_port_exclusion": True,
            "forced_startup_collision_recovery_claimed": False,
        }

    def restart_service(self) -> dict[str, Any]:
        self.refresh()
        if self.service is None:
            raise ValueError("Observed service identity required")
        old = self.service
        result = exact_kill(old)
        deadline = time.monotonic() + SOCKET_COLUMN_COUNT
        while time.monotonic() < deadline:
            try:
                self.refresh()
                if self.service != old:
                    self.action("Check again")
                    return {
                        "terminated_service": result,
                        "replacement": self.await_ready(fresh=True),
                    }
            except Exception as error:
                if not self.transient(error):
                    raise
            time.sleep(0.1)
        raise TimeoutError("Production service replacement unavailable")

    def menu_rows(
        self,
    ) -> tuple[list[Accessible], dict[str, Any], dict[str, Any] | None]:
        rows, objects = self.tree()
        menus = [
            row
            for row in rows
            if (row["name"], row["role"]) == QUIT_MENU and row["actions"]
        ]
        if len(menus) != 1:
            raise ValueError("One actionable native File menu required")
        items = []
        for row in rows:
            if (row["name"], row["role"]) != QUIT_ITEM or not row["actions"]:
                continue
            parent = row["parent"]
            for _ in range(len(rows)):
                if parent is None or parent == menus[0]["id"]:
                    break
                parent = rows[parent]["parent"]
            if parent == menus[0]["id"]:
                items.append(row)
        if len(items) > 1:
            raise ValueError("One native Quit item under the File menu required")
        return objects, menus[0], items[0] if items else None

    def quit_menu(self) -> dict[str, Any]:
        """The product's own File > Quit, activated through its AT-SPI actions.

        Mirrors the Windows quit phase: open File, wait a bounded time for its
        Quit item, activate it, then observe the same close as a window close.
        """
        self.refresh()
        objects, menu, _item = self.menu_rows()
        opened = self.activate(objects[menu["id"]], menu["actions"])
        deadline = min(self.work_deadline, time.monotonic() + MENU_SECONDS)
        item: dict[str, Any] | None = None
        showing = False
        while True:
            try:
                objects, _menu, item = self.menu_rows()
                if item is not None:
                    state = objects[item["id"]].get_state_set()
                    showing = state.contains(
                        self.atspi.StateType.SHOWING
                    ) and state.contains(self.atspi.StateType.VISIBLE)
            except Exception as error:
                if not self.transient(error):
                    raise
            if showing or time.monotonic() >= deadline:
                break
            time.sleep(0.1)
        if item is None:
            raise ValueError("Native File menu exposed no actionable Quit item")
        # GTK activates a menu item it has not mapped; whether the menu was
        # observed open is recorded, never assumed.
        try:
            activated = self.activate(objects[item["id"]], item["actions"])
        except self.native_error as error:
            # The quitting app may drop its AT-SPI reply. Only the close
            # observation below decides, and the missing reply is recorded.
            activated = "NO_REPLY_" + type(error).__name__
        return {
            "menu": QUIT_MENU[0],
            "menu_action": opened,
            "item": QUIT_ITEM[0],
            "item_action": activated,
            "item_showing_before_activation": showing,
            "closure": self.observe_close(),
        }

    def focus_before_chord(self) -> dict[str, Any]:
        """Window and keyboard focus just before the host sends Ctrl+Q.

        The relaunched app must be alive, or the close after the chord proves
        nothing. Focus itself is an observation, not a gate: the close decides,
        and a failed close names what this recorded. The Windows accelerator
        phase records its keyboard focus owner the same way.
        """
        if self.app is None or not same_process(self.app):
            raise ValueError("Relaunched application must be alive before Ctrl+Q")
        self.accelerator_focus = None
        deadline = min(self.work_deadline, time.monotonic() + FOCUS_SECONDS)
        last: str | None = None
        while time.monotonic() < deadline:
            try:
                self.accelerator_focus = self.window_focus()
            except Exception as error:
                if not self.transient(error):
                    raise
                last = type(error).__name__
            else:
                return self.accelerator_focus
            time.sleep(0.1)
        return {"focus_observed": False, "error_type": last}

    def window_focus(self) -> dict[str, Any]:
        if self.app is None:
            raise ValueError("Relaunched application identity required")
        self.app_accessible().clear_cache()
        rows, objects = self.tree()
        types = self.atspi.StateType
        frames = []
        for row in rows:
            if row["role"] not in {"frame", "window"}:
                continue
            state = objects[row["id"]].get_state_set()
            frames.append(
                {
                    "name": row["name"][:FOCUS_TEXT_CAP],
                    "role": row["role"],
                    "active": state.contains(types.ACTIVE),
                    "visible": state.contains(types.VISIBLE),
                    "showing": state.contains(types.SHOWING),
                }
            )
        focused = [
            {
                "name": row["name"][:FOCUS_TEXT_CAP],
                "role": row["role"][:FOCUS_TEXT_CAP],
            }
            for row in rows
            if row["focused"]
        ]
        return {
            "focus_observed": True,
            "app": f"{self.app['pid']}:{self.app['starttime_ticks']}",
            "owned_frame_active": len(frames) == 1 and frames[0]["active"],
            "frame_count": len(frames),
            "frames": frames[:FOCUS_ROWS],
            "focused_count": len(focused),
            "focused": focused[:FOCUS_ROWS],
        }

    def focus_summary(self) -> str:
        record = self.accelerator_focus
        if (
            record is None
            or self.app is None
            or record["app"] != f"{self.app['pid']}:{self.app['starttime_ticks']}"
        ):
            return "focus before Ctrl+Q was not recorded for this app"
        focused = ", ".join(
            row["role"][:FOCUS_MESSAGE_TEXT]
            + " "
            + repr(row["name"][:FOCUS_MESSAGE_TEXT])
            for row in record["focused"][:FOCUS_MESSAGE_ROWS]
        )
        return (
            "before Ctrl+Q: owned frame active="
            + str(record["owned_frame_active"])
            + ", frames="
            + str(record["frame_count"])
            + ", focused="
            + (focused or "none")
        )

    def quit_accelerator(self) -> dict[str, Any]:
        # The host sent Ctrl+Q through QMP right after accelerator_focus.
        try:
            closure = self.observe_close()
        except TimeoutError as error:
            raise TimeoutError(str(error) + "; " + self.focus_summary()) from error
        return {"accelerator": "Ctrl+Q", "closure": closure}

    def force_parent(self) -> dict[str, Any]:
        self.refresh()
        if self.app is None:
            raise ValueError("Observed application identity required")
        result = exact_kill(self.app)
        return {"terminated_app": result, "closure": self.observe_close()}

    def finish(self) -> dict[str, Any]:
        if any(identity_present(identity) for identity in self.known):
            raise ValueError("A known application/service identity remains alive")
        if self.before != self.package_binding(
            INSTALLED
        ) or self.relocated_before != self.package_binding(RELOCATED):
            raise ValueError("Package inputs changed during lifecycle")
        return {
            "package_bytes_modes_unchanged": True,
            "known_processes_absent": True,
            "distinct_quit_measured_separately": True,
            "normal_close_measured_separately": True,
        }

    def diagnostics(self) -> dict[str, Any]:
        self.action("Check again")
        return self.await_ready(fresh=True)

    def shell_frame(self) -> tuple[list[int], str]:
        rows, objects = self.tree()
        frames = [row for row in rows if row["role"] in {"frame", "window"}]
        if len(frames) != 1 or self.app is None:
            raise ValueError("One actual owned top-level native frame required")
        node = objects[frames[0]["id"]]
        state = node.get_state_set()
        if not all(
            state.contains(s)
            for s in (
                self.atspi.StateType.ACTIVE,
                self.atspi.StateType.VISIBLE,
                self.atspi.StateType.SHOWING,
            )
        ):
            raise ValueError("Actual owned active visible native frame required")
        component = node.get_component_iface()
        if component is None:
            raise ValueError("Actual owned frame bounds unavailable")
        rect = component.get_extents(self.atspi.CoordType.SCREEN)
        return [
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        ], f"{self.app['pid']}:{self.app['starttime_ticks']}"

    def shell_backing(self) -> dict[str, Any]:
        self.fence()
        connection = self.gio.bus_get_sync(self.gio.BusType.SESSION, None)
        reply = connection.call_sync(
            "org.gnome.Mutter.DisplayConfig",
            "/org/gnome/Mutter/DisplayConfig",
            "org.gnome.Mutter.DisplayConfig",
            "GetCurrentState",
            None,
            None,
            self.gio.DBusCallFlags.NO_AUTO_START,
            800,
            None,
        ).unpack()
        self.fence()
        return mutter_backing(reply)

    def shell_version_rows(
        self, rows: list[dict[str, Any]], objects: list[Accessible]
    ) -> list[dict[str, Any]]:
        regions = [
            row
            for row in rows
            if row["name"] == "Desktop versions"
            and objects[row["id"]].get_attributes().get("xml-roles") == "region"
        ]
        if len(regions) != 1:
            raise ValueError("One source-bound Desktop versions native region required")
        region = regions[0]["id"]
        selected = []
        for row in rows:
            current = row["id"]
            for _ in range(len(rows)):
                if current == region:
                    selected.append(row)
                    break
                current = rows[current]["parent"]
                if current is None:
                    break
            else:
                raise ValueError("Native version region ancestry is cyclic")
        return selected

    def shell_text(
        self, text: str, prefix: int | None = None, *, versions: bool = False
    ) -> dict[str, Any]:
        rows, objects = self.tree()
        if versions:
            rows = self.shell_version_rows(rows, objects)
        candidates = [
            row
            for row in rows
            if row["text"] == text and not objects[row["id"]].get_child_count()
        ]
        if len(candidates) != 1:
            raise ValueError("One exact native Text leaf required")
        node = objects[candidates[0]["id"]]
        state = node.get_state_set()
        if not state.contains(self.atspi.StateType.VISIBLE) or not state.contains(
            self.atspi.StateType.SHOWING
        ):
            raise ValueError("Actual Text leaf is hidden or offscreen")
        interface = node.get_text_iface()
        if interface is None:
            raise ValueError("Actual native Text bounds unavailable")
        count = len(text) if prefix is None else prefix
        line = interface.get_string_at_offset(0, self.atspi.TextGranularity.LINE)
        if (
            line.start_offset != 0
            or line.end_offset < count
            or (prefix is None and line.end_offset != len(text))
        ):
            raise ValueError("Actual complete selected glyph range wraps or is unknown")
        boxes = [
            interface.get_character_extents(i, self.atspi.CoordType.SCREEN)
            for i in range(count)
        ]
        if any(box.width <= 0 or box.height <= 0 for box in boxes):
            raise ValueError("Actual selected glyph is not visible")
        x, y = min(box.x for box in boxes), min(box.y for box in boxes)
        width = max(box.x + box.width for box in boxes) - x
        height = max(box.y + box.height for box in boxes) - y
        self.fence()
        return {
            "text": text[:count],
            "rect": [x, y, width, height],
            "single_line": True,
            "visible": True,
            "showing": True,
        }

    def shell_focus(self, name: str) -> None:
        rows, objects = self.tree()
        found = [row for row in rows if row["name"] == name and row["actions"]]
        if len(found) != 1:
            raise ValueError("One exact native actionable shell target required")
        component = objects[found[0]["id"]].get_component_iface()
        if component is None or not component.grab_focus():
            raise ValueError("Actual native shell focus unavailable")
        self.shell_frame()
        self.fence()

    def shell_focused(self, name: str, role: str | None = None) -> bool:
        rows, _ = self.tree()
        found = [
            row
            for row in rows
            if row["name"] == name and (role is None or row["role"] == role)
        ]
        return len(found) == 1 and found[0]["focused"]

    def shell_measure(self, stage: str) -> dict[str, Any]:
        rows, objects = self.tree()
        rows = self.shell_version_rows(rows, objects)
        self.shell_text("Tauri version", versions=True)
        found = [
            row
            for row in rows
            if row["text"] == "App version" and not objects[row["id"]].get_child_count()
        ]
        if len(found) != 1:
            raise ValueError("One exact native version label required")
        component = objects[found[0]["id"]].get_component_iface()
        if component is None or not component.scroll_to(self.atspi.ScrollType.TOP_EDGE):
            raise ValueError("Actual version labels could not scroll into view")
        frame, window = self.shell_frame()
        if self.app is None:
            raise ValueError("Actual owned app identity unavailable")
        return {
            "stage": stage,
            "window_id": window,
            "app_pid": self.app["pid"],
            "frame": frame,
            "backing": self.shell_backing(),
            "anchors": [self.shell_text(label, versions=True) for label in ANCHORS],
        }

    def shell_operation(self, operation: str) -> dict[str, Any]:
        self.app_accessible().clear_cache()
        if operation.startswith("shell_scale_"):
            return self.shell_measure(operation.removeprefix("shell_scale_"))
        if operation == "shell_skip_focus":
            self.shell_focus("Skip to main content")
            return {"focused": True}
        if operation == "shell_skip_observe":
            rows, objects = self.tree()
            found = [
                row
                for row in rows
                if row["role"] == "landmark"
                and row["focused"]
                and objects[row["id"]].get_attributes().get("xml-roles") == "main"
            ]
            if len(found) != 1:
                raise ValueError("Actual skip link did not focus the main landmark")
            return {"skip_main": True, "accessibility": rows}
        if operation == "shell_check_focus":
            self.await_ready()
            self.shell_focus("Check again")
            return {"checked_before": self.checked_at}
        if operation == "shell_check_observe":
            return self.await_ready(fresh=True)
        return self.shell_route_operation(operation)

    def shell_route_operation(self, operation: str) -> dict[str, Any]:
        action, slug = operation.removeprefix("shell_").split("_", 1)
        label = dict(ROUTES)[slug]
        if action == "focus":
            self.shell_focus(label)
            return {"focused": True}
        if action == "tab":
            focused, _ = self.tree()
            if not any(row["focused"] for row in focused) or self.shell_focused(
                label, "link"
            ):
                raise ValueError("Actual native Tab did not leave the route link")
            return {"tab_moved": True}
        if action == "back":
            if not self.shell_focused(label, "link"):
                raise ValueError("Actual native Shift+Tab did not restore route focus")
            return {"back_returned": True}
        if action != "route":
            raise ValueError("Unknown closed shell operation")
        rows, _ = self.tree()
        headings = [
            row for row in rows if row["role"] == "heading" and row["name"] == label
        ]
        links = [
            row
            for row in rows
            if row["role"] == "link" and row["name"] == label and row["actions"]
        ]
        if (
            len(headings) != 1
            or not headings[0]["focused"]
            or len(links) != 1
            or self.app is None
        ):
            raise ValueError(
                "Exact unique native route and keyboard heading focus required"
            )
        frame, window = self.shell_frame()
        return {
            "heading": label,
            "heading_unique": True,
            "heading_focused": True,
            "navigation_unique": True,
            "glyph": self.shell_text(label, 4),
            "frame": frame,
            "backing": self.shell_backing(),
            "window_id": window,
            "app_pid": self.app["pid"],
            "accessibility": rows,
        }

    def operation(self, operation: str) -> dict[str, Any]:
        self.fence()
        if operation in SHELL_OPERATIONS:
            return self.shell_operation(operation)
        if operation in {"launch", "relaunch", "relocated_launch"}:
            return self.launch(operation == "relocated_launch")
        if operation.startswith("keyboard_"):
            return self.keyboard(operation)
        handlers = {
            "diagnostics": self.diagnostics,
            "auth": self.authentication,
            "crash_service": self.restart_service,
            "close_observe": self.observe_close,
            "quit_menu": self.quit_menu,
            "accelerator_focus": self.focus_before_chord,
            "quit_accelerator": self.quit_accelerator,
            "force_parent": self.force_parent,
            "finish": self.finish,
        }
        handler = handlers.get(operation)
        if handler is None:
            raise ValueError("Unknown fixed operation")
        return handler()


def operation_timeout(_signum: int, _frame: FrameType | None) -> None:
    raise TimeoutError("Guest operation wall allowance expired")


def run_operation(controller: Controller, operation: str) -> dict[str, Any]:
    if signal.getitimer(signal.ITIMER_REAL) != (0.0, 0.0):
        raise ValueError("Controller may not replace another timer owner")
    controller.operation_deadline = min(controller.work_deadline, time.monotonic() + 30)
    controller.fence()
    previous = signal.signal(signal.SIGALRM, operation_timeout)
    try:
        signal.setitimer(
            signal.ITIMER_REAL,
            max(0.001, controller.operation_deadline - time.monotonic()),
        )
        result = controller.operation(operation)
        controller.fence()
        return result
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def handle_connection(controller: Controller, connection: socket.socket) -> int | None:
    raw = receive_line(connection, REQUEST_CAP)
    request = json.loads(raw)
    if (
        len(raw) > REQUEST_CAP
        or not isinstance(request, dict)
        or set(request) != {"operation"}
        or request["operation"] not in OPERATIONS
    ):
        raise ValueError("Fixed bounded operation request required")
    operation = request["operation"]
    controller.sequence += 1
    started = time.monotonic()
    try:
        result = run_operation(controller, operation)
        receipt = {
            "status": "PASS",
            "operation": operation,
            "result": result,
        }
    except Exception as error:
        receipt = {
            "status": "FAIL",
            "operation": operation,
            "error_type": type(error).__name__,
            "message": str(error)[:512],
        }
    receipt["elapsed_seconds"] = time.monotonic() - started
    data = (json.dumps(receipt, indent=2) + "\n").encode()
    if len(data) > MIB:
        raise ValueError("Operation receipt exceeds cap")
    path = PROOF / (str(controller.sequence).zfill(2) + "-" + operation + ".json")
    with path.open("xb") as stream:
        stream.write(data)
    connection.sendall(
        (
            json.dumps({"status": receipt["status"], "receipt": path.name}) + "\n"
        ).encode()
    )
    if receipt["status"] != "PASS" or operation == "finish":
        return 0 if receipt["status"] == "PASS" else 1
    return None


def controller_exit(reason: str, sequence: int, code: int) -> None:
    """Bounded terminal marker for an exit that leaves no operation receipt."""
    with (PROOF / "controller-exit.json").open("x", encoding="utf-8") as stream:
        json.dump(
            {
                "status": "CONTROLLER_EXITED",
                "reason": reason,
                "last_sequence": sequence,
                "exit_code": code,
            },
            stream,
        )


def controller_failure(error: Exception) -> None:
    """The --serve controller's own failure marker; never a request client's."""
    if not PROOF.is_dir() or PROOF.is_symlink():
        return
    try:
        with (PROOF / "controller-failure.json").open("x", encoding="utf-8") as stream:
            json.dump(
                {
                    "status": "CONTROLLER_FAILED",
                    "error_type": type(error).__name__,
                    "message": str(error)[:512],
                },
                stream,
            )
    except FileExistsError:
        error.add_note("controller-failure.json already existed; it was kept")


def serve() -> int:

    info = PROOF.lstat()
    if (
        info.st_uid != os.geteuid()
        or stat.S_IMODE(info.st_mode) != PRIVATE_DIRECTORY_MODE
        or not stat.S_ISDIR(info.st_mode)
    ):
        raise ValueError("Exact synthetic private proof directory required")
    if SOCKET.exists() or SOCKET.is_symlink():
        raise ValueError("Fresh controller socket required")
    saved = sys.argv
    try:
        sys.argv = [saved[0], "--output", str(PROOF / "actual-gnome-session.json")]
        code = session_main()
    finally:
        sys.argv = saved
    if code != 0:
        controller_exit("SESSION_NOT_READY", 0, code)
        return code
    controller = Controller()
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
        server.bind(str(SOCKET))
        SOCKET.chmod(0o600)
        server.listen(1)
        server.settimeout(2)
        try:
            while time.monotonic() < controller.work_deadline:
                try:
                    connection, _ = server.accept()
                except TimeoutError:
                    continue
                with connection:
                    connection.settimeout(2)
                    terminal = handle_connection(controller, connection)
                    if terminal is not None:
                        return terminal
            controller_exit("WORK_DEADLINE_EXPIRED", controller.sequence, 1)
        finally:
            SOCKET.unlink(missing_ok=True)
    return 1


def request(operation: str) -> int:
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(35)
        client.connect(str(SOCKET))
        client.sendall((json.dumps({"operation": operation}) + "\n").encode())
        raw = receive_line(client, RESPONSE_CAP)
        if len(raw) > RESPONSE_CAP:
            raise ValueError("Controller response cap exceeded")
        response = json.loads(raw)
        sys.stdout.write(json.dumps(response) + "\n")
        return 0 if response["status"] == "PASS" else 1


def main() -> int:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--serve", action="store_true")
    group.add_argument("--request", choices=OPERATIONS)
    arguments = parser.parse_args()
    if os.geteuid() == 0 or Path.home() != HOME:
        raise ValueError("Only synthetic non-root guest account may operate controller")
    if not arguments.serve:
        # A request client reports its own failure on stderr only.
        return request(arguments.request)
    try:
        return serve()
    except Exception as error:
        controller_failure(error)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
