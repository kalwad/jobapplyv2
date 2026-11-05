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
VARIANT = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--collect" and sys.argv[1] != "--netwatch" else "base"
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


NETWATCH = [
    ("addr", ["/usr/sbin/ip", "-br", "addr"]),
    ("link", ["/usr/sbin/ip", "-br", "link"]),
    ("route", ["/usr/sbin/ip", "route"]),
    ("networkctl", ["/usr/bin/networkctl", "list", "--no-legend", "--no-pager"]),
    ("active", ["/usr/bin/systemctl", "is-active", "NetworkManager", "systemd-networkd", "ssh.socket", "ssh.service", "gdm", "wpa_supplicant"]),
    ("nmcli", ["/usr/bin/nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "dev"]),
    ("listen", ["/usr/bin/ss", "-ltnH"]),
    ("sessions", ["/usr/bin/loginctl", "list-sessions", "--no-legend"]),
    ("load", ["/usr/bin/cat", "/proc/loadavg"]),
    ("mem", ["/usr/bin/free", "-m"]),
]
DEEP = [
    ("networkctl-status", ["/usr/bin/networkctl", "status", "enp0s2", "--no-pager", "-n", "60"]),
    ("nm-print-config", ["/usr/sbin/NetworkManager", "--print-config"]),
    ("nm-conf-dirs", ["/usr/bin/sh", "-c", "ls -la /run/NetworkManager/conf.d /etc/NetworkManager/conf.d /usr/lib/NetworkManager/conf.d /etc/netplan /run/systemd/network 2>&1; for f in /run/NetworkManager/conf.d/* /etc/NetworkManager/conf.d/* /usr/lib/NetworkManager/conf.d/* /etc/netplan/* /run/systemd/network/*; do echo \"== $f\"; cat \"$f\" 2>&1; done"]),
    ("nmcli-con", ["/usr/bin/nmcli", "-t", "con", "show"]),
    ("journal-net", ["/usr/bin/journalctl", "-b", "--no-pager", "-o", "short-monotonic", "-u", "systemd-networkd", "-u", "NetworkManager", "-u", "ssh.service", "-u", "ssh.socket", "-u", "gdm", "-u", "systemd-networkd-wait-online", "-n", "400"]),
    ("journal-kernel", ["/usr/bin/journalctl", "-b", "-k", "--no-pager", "-o", "short-monotonic", "-n", "120"]),
    ("journal-needrestart", ["/usr/bin/sh", "-c", "journalctl -b --no-pager -o short-monotonic -n 4000 | grep -i -E 'needrestart|restart|NetworkManager|enp0s2|dhcp|carrier' | tail -200"]),
    ("needrestart-conf", ["/usr/bin/sh", "-c", "ls -la /etc/needrestart/conf.d 2>&1; dpkg -l needrestart network-manager netplan.io systemd 2>&1 | tail -5"]),
    ("apt-log", ["/usr/bin/sh", "-c", "ls -la /var/lib/japp-probe/; tail -c 6000 /var/lib/japp-probe/locked-install.log"]),
]


def netwatch() -> None:
    """Root transient unit: periodic network/session snapshots to COM2 (ttyS1),
    which survives the loss of the SSH channel."""
    began = time.monotonic()
    deep_done: set[int] = set()
    sent_session = False
    with open("/dev/ttyS1", "wb", buffering=0) as tty:
        def emit(title: str, argv: list[str]) -> None:
            try:
                done = subprocess.run(argv, capture_output=True, timeout=20, check=False)
                body = done.stdout[-20000:] + (b"\n[stderr] " + done.stderr[-2000:] if done.stderr else b"")
            except Exception as error:  # noqa: BLE001
                body = repr(error).encode()
            tty.write(("\n## " + title + "\n").encode() + body)

        while time.monotonic() - began < 4200:
            uptime = Path("/proc/uptime").read_text().split()[0]
            tty.write(("\n\n#### SNAPSHOT uptime=" + uptime + "\n").encode())
            for title, argv in NETWATCH:
                emit(title, argv)
            try:
                tty.write(b"\n## timeline\n" + (PROBE / "guest-timeline.json").read_bytes()[-3000:])
            except OSError:
                pass
            minute = int(float(uptime) // 60)
            if minute in (2, 4, 6, 9, 14, 20) and minute not in deep_done:
                deep_done.add(minute)
                tty.write(("\n#### DEEP uptime=" + uptime + "\n").encode())
                for title, argv in DEEP:
                    emit(title, argv)
            dump = PROBE / "session" / "session.json"
            if not sent_session and dump.exists() and (PROBE / "session" / "done").exists():
                sent_session = True
                tty.write(b"\n#### SESSION-DUMP\n" + dump.read_bytes() + b"\n#### END-SESSION-DUMP\n")
                receipt = PROBE / "receipt" / "actual-gnome-session.json"
                if receipt.exists():
                    tty.write(b"\n#### RECEIPT\n" + receipt.read_bytes() + b"\n#### END-RECEIPT\n")
            time.sleep(10)


def main() -> None:
    STATE.mkdir(mode=0o700)
    PROBE.mkdir(mode=0o755)
    os.chown(PROBE, UID, GID)
    mark("probe-start", variant=VARIANT)
    subprocess.run(["/usr/bin/systemd-run", "--unit", "japp-netwatch", "/usr/bin/python3", __file__, "--netwatch"], check=True, timeout=30)
    if VARIANT == "nmmask":
        subprocess.run(["/usr/bin/systemctl", "mask", "NetworkManager.service"], check=True, timeout=30)
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
            env={"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "DEBIAN_FRONTEND": "noninteractive", **({"NEEDRESTART_SUSPEND": "1"} if VARIANT == "nrsuspend" else {})},
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
    elif sys.argv[1:] == ["--netwatch"]:
        netwatch()
    else:
        try:
            main()
        except BaseException as error:
            mark("probe-error", error=repr(error)[:500])
            raise
