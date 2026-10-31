"""DIAGNOSTIC SCRATCH ONLY - never merge. Started by the XDG autostart entry
in the real GDM autologin session; records what an autostarted app actually
receives (environment, cgroup, logind views), runs the repository's own
session receipt collector unchanged, and probes the AT-SPI Action naming that
ubuntu_gnome_guest.py relies on."""

import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

OUT = Path("/home/japp-ci/probe/session")
OUT.mkdir(parents=True, exist_ok=True)
start = time.monotonic()
result: dict = {"uptime": Path("/proc/uptime").read_text().split()[0]}
keys = sorted(k for k in os.environ if k.startswith(("XDG_", "GDM", "GNOME_", "DESKTOP_", "INVOCATION", "SYSTEMD_", "JOURNAL", "MANAGERPID", "WAYLAND", "DISPLAY", "DBUS", "SESSION", "AT_SPI", "NO_AT_BRIDGE")))
result["env"] = {k: os.environ[k] for k in keys}
result["env_keys_all"] = sorted(os.environ)
result["cgroup"] = Path("/proc/self/cgroup").read_text()


def run(name: str, argv: list[str]) -> None:
    try:
        done = subprocess.run(argv, capture_output=True, text=True, timeout=20, check=False)
        result[name] = {"rc": done.returncode, "out": done.stdout[-6000:], "err": done.stderr[-2000:]}
    except Exception as error:  # noqa: BLE001
        result[name] = {"exception": repr(error)}


uid = str(os.getuid())
run("list_sessions", ["/usr/bin/loginctl", "list-sessions", "--no-legend"])
run("show_user", ["/usr/bin/loginctl", "show-user", uid])
run("show_session_noid", ["/usr/bin/loginctl", "show-session"])
run("show_session_self", ["/usr/bin/loginctl", "show-session", "self"])
run("show_session_auto", ["/usr/bin/loginctl", "show-session", "auto"])
display = subprocess.run(["/usr/bin/loginctl", "show-user", uid, "-p", "Display", "--value"], capture_output=True, text=True, timeout=20, check=False).stdout.strip()
result["user_display_session"] = display
if display:
    run("show_session_display", ["/usr/bin/loginctl", "show-session", display])
run("systemctl_user_environment", ["/usr/bin/systemctl", "--user", "show-environment"])
run("graphical_session_target", ["/usr/bin/systemctl", "--user", "is-active", "graphical-session.target"])
receipt_dir = Path("/home/japp-ci/probe/receipt")
run(
    "repository_session_receipt",
    [sys.executable, "/mnt/jappinput/scripts/ubuntu_gnome_session_receipt.py", "--output", str(receipt_dir / "actual-gnome-session.json")],
)
atspi: dict = {}
try:
    import gi

    gi.require_version("Atspi", "2.0")
    from gi.repository import Atspi

    atspi["Accessible_has_get_action_name"] = hasattr(Atspi.Accessible, "get_action_name")
    atspi["Action_get_name_doc"] = str(getattr(Atspi.Action, "get_name", None).__doc__)[:300]
    atspi["Accessible_get_name_doc"] = str(Atspi.Accessible.get_name.__doc__)[:300]
    desktop = Atspi.get_desktop(0)
    stack = [desktop]
    seen = 0
    found = None
    while stack and seen < 4000 and time.monotonic() - start < 60:
        node = stack.pop()
        seen += 1
        try:
            iface = node.get_action_iface()
            if iface is not None and iface.get_n_actions() > 0:
                found = (node, iface)
                break
        except Exception:  # noqa: BLE001
            pass
        try:
            stack.extend(node.get_child_at_index(i) for i in range(min(node.get_child_count(), 200)))
        except Exception:  # noqa: BLE001
            pass
    atspi["nodes_walked"] = seen
    if found is not None:
        node, iface = found
        atspi["node_role"] = node.get_role_name()
        atspi["iface_type"] = type(iface).__module__ + "." + type(iface).__qualname__
        atspi["iface_mro"] = [c.__qualname__ for c in type(iface).__mro__][:12]
        try:
            atspi["harness_call_iface_get_name_0"] = repr(iface.get_name(0))
        except Exception as error:  # noqa: BLE001
            atspi["harness_call_iface_get_name_0"] = "RAISED " + repr(error)
        try:
            atspi["iface_get_action_name_0"] = repr(iface.get_action_name(0))
        except Exception as error:  # noqa: BLE001
            atspi["iface_get_action_name_0"] = "RAISED " + repr(error)
        try:
            atspi["Atspi_Action_get_name_iface_0"] = repr(Atspi.Action.get_name(iface, 0))
        except Exception as error:  # noqa: BLE001
            atspi["Atspi_Action_get_name_iface_0"] = "RAISED " + repr(error)
except Exception:  # noqa: BLE001
    atspi["error"] = traceback.format_exc()[-3000:]
result["atspi"] = atspi
# Round 3: does graphical-session.target become active, and when does the
# repository's (fixed) receipt reach SESSION_READY?
targets: list[dict] = []
last_state = None
for second in range(0, 122, 2):
    target_at = time.monotonic() - start
    state = subprocess.run(["/usr/bin/systemctl", "--user", "is-active", "graphical-session.target"], capture_output=True, text=True, timeout=10, check=False).stdout.strip()
    if state != last_state:
        targets.append({"t": round(target_at, 1), "uptime": Path("/proc/uptime").read_text().split()[0], "state": state})
        last_state = state
    if second in (0, 30, 60, 120):
        run("targets_" + str(second), ["/usr/bin/systemctl", "--user", "list-units", "--type=target", "--all", "--no-legend", "--no-pager"])
        run("gnome_session_units_" + str(second), ["/usr/bin/systemctl", "--user", "list-units", "gnome-session*", "--all", "--no-legend", "--no-pager"])
    if second in (60, 120):
        run(
            "repository_session_receipt_" + str(second),
            [sys.executable, "/mnt/jappinput/scripts/ubuntu_gnome_session_receipt.py", "--output", "/home/japp-ci/probe/receipt-" + str(second) + "/actual-gnome-session.json"],
        )
    time.sleep(2)
result["graphical_session_target_timeline"] = targets
result["seconds"] = round(time.monotonic() - start, 2)
(OUT / "session.json").write_text(json.dumps(result, indent=1))
(OUT / "done").write_text("1\n")
