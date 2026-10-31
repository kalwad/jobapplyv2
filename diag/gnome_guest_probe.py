"""DIAGNOSTIC SCRATCH ONLY - never merge. Runs as root from cloud-init runcmd,
mirroring ubuntu_gnome_provision.py's work (per-archive hashing, one local-only
apt install of the reviewed closure plus package.deb, the same GDM autologin,
dconf and XDG autostart configuration, gdm3 restart) with timestamps, and an
autostart entry that records what the real session gives an autostarted app.
"""

import hashlib
import json
import os
import pwd
import shutil
import subprocess
import sys
import time
from pathlib import Path

INPUT = Path("/mnt/jappinput")
HOME = Path("/home/japp-ci")
PROBE = HOME / "probe"
STATE = Path("/var/lib/japp-probe")
T0 = time.monotonic()
UID, GID = pwd.getpwnam("japp-ci").pw_uid, pwd.getpwnam("japp-ci").pw_gid
timeline: list[dict] = []


def mark(event: str, **extra: object) -> None:
    timeline.append({"t": round(time.monotonic() - T0, 1), "uptime": Path("/proc/uptime").read_text().split()[0], "event": event, **extra})
    (PROBE / "guest-timeline.json").write_text(json.dumps(timeline, indent=1))
    os.chown(PROBE / "guest-timeline.json", UID, GID)


def collect() -> None:
    """Separate transient unit: wait for the autostart dump, then copy logs."""
    deadline = time.monotonic() + 1500
    while time.monotonic() < deadline and not (PROBE / "session" / "done").exists():
        time.sleep(5)
    for name, argv in {
        "journal-tail.txt": ["/usr/bin/journalctl", "-b", "--no-pager", "-n", "4000"],
        "loginctl-sessions.txt": ["/usr/bin/loginctl", "list-sessions", "--no-legend"],
        "systemd-analyze-blame.txt": ["/usr/bin/systemd-analyze", "blame"],
        "cloud-init-status.txt": ["/usr/bin/cloud-init", "status", "--long"],
        "gdm-status.txt": ["/usr/bin/systemctl", "status", "gdm3", "--no-pager"],
        "ps.txt": ["/usr/bin/ps", "-eo", "pid,user,etimes,cgroup:80,args", "--sort=start_time"],
    }.items():
        result = subprocess.run(argv, capture_output=True, timeout=60, check=False)
        (PROBE / name).write_bytes(result.stdout[-2_000_000:] + b"\n--stderr--\n" + result.stderr[-20000:])
        os.chown(PROBE / name, UID, GID)
    for path in STATE.glob("*.log"):
        shutil.copyfile(path, PROBE / path.name)
        os.chown(PROBE / path.name, UID, GID)
    (PROBE / "collected").write_text("1\n")
    os.chown(PROBE / "collected", UID, GID)


def main() -> None:
    STATE.mkdir(mode=0o700)
    PROBE.mkdir(mode=0o755)
    os.chown(PROBE, UID, GID)
    mark("probe-start")
    lock = json.loads((INPUT / "guest-closure/lock.json").read_bytes())
    archives = []
    for row in lock["packages"]:
        path = INPUT / "guest-closure/debs" / row["filename"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError("bytes differ " + row["filename"])
        archives.append(str(path))
    package = INPUT / "package/package.deb"
    hashlib.sha256(package.read_bytes()).hexdigest()
    mark("hashed", archives=len(archives))
    sources, lists = STATE / "apt-no-sources", STATE / "apt-no-lists"
    sources.mkdir(mode=0o700)
    (lists / "partial").mkdir(mode=0o700, parents=True)
    with (STATE / "locked-install.log").open("wb") as log:
        result = subprocess.run(
            ["/usr/bin/apt-get", "-o", "Dir::Etc::SourceList=/dev/null", "-o", "Dir::Etc::SourceParts=" + str(sources),
             "-o", "Dir::State::Lists=" + str(lists), "-o", "Dir::Cache::pkgcache=", "-o", "Dir::Cache::srcpkgcache=",
             "--no-install-recommends", "-y", "install", *archives, str(package)],
            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=3600, check=False,
        )
    size = (STATE / "locked-install.log").stat().st_size
    mark("installed", exit_code=result.returncode, log_bytes=size)
    shutil.copyfile(STATE / "locked-install.log", PROBE / "locked-install.log")
    os.chown(PROBE / "locked-install.log", UID, GID)
    if result.returncode != 0:
        return
    for path in (HOME / ".config", HOME / ".config/autostart"):
        path.mkdir(mode=0o700, exist_ok=True)
        os.chown(path, UID, GID)
    (PROBE / "receipt").mkdir(mode=0o700)
    os.chown(PROBE / "receipt", UID, GID)
    autostart = HOME / ".config/autostart/japp-ci.desktop"
    autostart.write_text(
        "[Desktop Entry]\nType=Application\nName=JobApply disposable session probe\n"
        "Exec=/usr/bin/python3 /mnt/jappinput/scripts/gnome_session_dump.py\n"
        "X-GNOME-Autostart-enabled=true\nNoDisplay=true\n"
    )
    os.chown(autostart, UID, GID)
    Path("/etc/gdm3/custom.conf").write_text(
        "[daemon]\nAutomaticLoginEnable=true\nAutomaticLogin=japp-ci\n[security]\n[xdmcp]\n[chooser]\n[debug]\n"
    )
    Path("/etc/dconf/profile").mkdir(exist_ok=True)
    Path("/etc/dconf/profile/user").write_text("user-db:user\nsystem-db:local\n")
    Path("/etc/dconf/db/local.d").mkdir(parents=True, exist_ok=True)
    Path("/etc/dconf/db/local.d/00-japp-disposable").write_text(
        "[org/gnome/desktop/interface]\ntoolkit-accessibility=true\n"
        "[org/gnome/desktop/session]\nidle-delay=uint32 0\n"
        "[org/gnome/desktop/screensaver]\nlock-enabled=false\n"
    )
    subprocess.run(["/usr/bin/dconf", "update"], check=True, timeout=60)
    mark("configured")
    subprocess.run(["/usr/bin/systemd-run", "--unit", "japp-probe-collect", "/usr/bin/python3", __file__, "--collect"], check=True, timeout=30)
    subprocess.run(["/usr/bin/systemctl", "set-default", "graphical.target"], check=True, timeout=30)
    started = time.monotonic()
    restart = subprocess.run(["/usr/bin/systemctl", "restart", "gdm3"], capture_output=True, timeout=300, check=False)
    mark("gdm-restarted", exit_code=restart.returncode, seconds=round(time.monotonic() - started, 1))


if __name__ == "__main__":
    if sys.argv[1:] == ["--collect"]:
        collect()
    else:
        try:
            main()
        except BaseException as error:
            mark("probe-error", error=repr(error)[:500])
            raise
