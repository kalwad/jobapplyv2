"""DIAGNOSTIC SCRATCH ONLY - never merge.

Host side of the GNOME session probe: the campaign's exact cloud image,
cloud-init shape, 9p input share and QEMU device set, under ACCEL (kvm or the
campaign's tcg), with a timeline of serial-log growth, SSH poll latency and
guest milestones.

usage: gnome_host_probe.py INPUTS IMAGE WORK OUT ACCEL SECONDS REPO VARIANT
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

inputs, image, work, out, accel, seconds, repo, variant = (
    Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5], float(sys.argv[6]), Path(sys.argv[7]), sys.argv[8],
)
work.mkdir(parents=True)
out.mkdir(parents=True)
payload = work / "input"
(payload / "guest-closure").mkdir(parents=True)
shutil.copytree(inputs / "guest-closure/debs", payload / "guest-closure/debs")
shutil.copyfile(inputs / "guest-closure/lock.json", payload / "guest-closure/lock.json")
(payload / "package").mkdir()
shutil.copyfile(inputs / "package/package.deb", payload / "package/package.deb")
(payload / "scripts").mkdir()
for name in ("gnome_guest_probe.py", "gnome_session_dump.py"):
    shutil.copyfile(Path(__file__).with_name(name), payload / "scripts" / name)
for name in ("ubuntu_gnome_session_receipt.py", "ubuntu_gnome_platform.py", "ubuntu_gnome_process.py"):
    shutil.copyfile(repo / "scripts/linux_gnome" / name, payload / "scripts" / name)
overlay = work / "guest.qcow2"
subprocess.run(["/usr/bin/qemu-img", "create", "-f", "qcow2", "-F", "qcow2", "-b", str(image), str(overlay), "24G"], check=True)
client, hostkey = work / "client_key", work / "guest_host_key"
for key in (client, hostkey):
    subprocess.run(["/usr/bin/ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(key)], check=True)
cloud = {
    "users": [{"name": "japp-ci", "lock_passwd": True, "shell": "/bin/bash", "ssh_authorized_keys": [client.with_suffix(".pub").read_text().strip()]}],
    "ssh_deletekeys": False,
    "ssh_genkeytypes": [],
    "write_files": [
        {"path": "/etc/ssh/ssh_host_ed25519_key", "permissions": "0600", "owner": "root:root", "content": hostkey.read_text()},
        {"path": "/etc/ssh/ssh_host_ed25519_key.pub", "permissions": "0644", "owner": "root:root", "content": hostkey.with_suffix(".pub").read_text()},
    ],
    "runcmd": [
        ["/usr/bin/systemctl", "restart", "ssh"],
        ["/usr/bin/mkdir", "-p", "/mnt/jappinput"],
        ["/usr/bin/mount", "-t", "9p", "-o", "trans=virtio,version=9p2000.L,ro", "jappinput", "/mnt/jappinput"],
        ["/usr/bin/python3", "/mnt/jappinput/scripts/gnome_guest_probe.py", variant],
    ],
}
(work / "user-data").write_text("#cloud-config\n" + json.dumps(cloud))
(work / "meta-data").write_text(json.dumps({"instance-id": "japp-diag-" + os.urandom(8).hex(), "local-hostname": "japp-gnome-ci"}))
subprocess.run(["/usr/bin/cloud-localds", str(work / "seed.img"), str(work / "user-data"), str(work / "meta-data")], check=True)
with socket.socket() as selection:
    selection.bind(("127.0.0.1", 0))
    port = selection.getsockname()[1]
known = work / "known_hosts"
known.write_text("[127.0.0.1]:" + str(port) + " " + hostkey.with_suffix(".pub").read_text())
accel_args = ["-accel", "kvm", "-cpu", "host"] if accel == "kvm" else ["-accel", "tcg,thread=multi", "-cpu", "max"]
serial_log = work / "guest-serial.log"
argv = [
    "/usr/bin/qemu-system-x86_64", "-machine", "q35", *accel_args, "-smp", "2", "-m", "4096",
    "-drive", "file=" + str(overlay) + ",if=virtio,format=qcow2", "-drive", "file=" + str(work / "seed.img") + ",if=virtio,format=raw,readonly=on",
    "-virtfs", "local,path=" + str(payload) + ",mount_tag=jappinput,security_model=none,readonly=on",
    "-netdev", "user,id=n0,restrict=on,hostfwd=tcp:127.0.0.1:" + str(port) + "-:22", "-device", "virtio-net-pci,netdev=n0",
    "-device", "virtio-vga", "-device", "qemu-xhci", "-device", "usb-tablet", "-display", "none",
    "-qmp", "unix:" + str(work / "qmp.sock") + ",server=on,wait=off", "-serial", "file:" + str(serial_log), "-serial", "file:" + str(out / "guest-com2.log"), "-no-reboot",
]
ssh = ["/usr/bin/ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
       "-o", "UserKnownHostsFile=" + str(known), "-o", "ConnectTimeout=3", "-i", str(client), "-p", str(port), "japp-ci@127.0.0.1"]
sys.path.insert(0, str(Path(__file__).parent))
from qmp_probe import QMP, ppm_to_png  # noqa: E402

start = time.monotonic()
vm = subprocess.Popen(argv, stdout=(out / "qemu.stdout").open("wb"), stderr=(out / "qemu.stderr").open("wb"), start_new_session=True)
qmp = QMP(work / "qmp.sock")
timeline: list[dict] = []
milestones: dict[str, float] = {}
frames = 0
next_frame = 0.0
done_at = None
while time.monotonic() - start < seconds and vm.poll() is None:
    now = time.monotonic() - start
    began = time.monotonic()
    try:
        poll = subprocess.run([*ssh, "cat /home/japp-ci/probe/guest-timeline.json 2>/dev/null; test -f /home/japp-ci/probe/collected"], capture_output=True, timeout=60, check=False)
        rc, body = poll.returncode, poll.stdout
    except subprocess.TimeoutExpired:
        rc, body = "TIMEOUT60", b""
    latency = round(time.monotonic() - began, 2)
    serial = serial_log.stat().st_size if serial_log.exists() else 0
    row = {"t": round(now, 1), "ssh_rc": rc, "ssh_seconds": latency, "serial_bytes": serial}
    if body:
        try:
            events = json.loads(body)
            row["guest_last"] = events[-1]["event"]
            for event in events:
                milestones.setdefault(event["event"], round(now, 1))
        except ValueError:
            pass
    if rc == 0 and done_at is None:
        done_at = now
    timeline.append(row)
    (out / "host-timeline.json").write_text(json.dumps({"milestones_first_seen_host_seconds": milestones, "rows": timeline}, indent=1))
    if now >= next_frame and frames < 90:
        try:
            qmp.call("screendump", {"filename": str(work / "frame.ppm")})
            ppm_to_png(work / "frame.ppm", out / f"frame-{int(now):05d}.png")
            frames += 1
        except Exception as error:  # noqa: BLE001
            timeline.append({"t": round(now, 1), "screendump_error": str(error)[:200]})
        try:
            usernet = qmp.call("human-monitor-command", {"command-line": "info usernet"})
            timeline.append({"t": round(now, 1), "info_usernet": str(usernet)[:3000]})
        except Exception as error:  # noqa: BLE001
            timeline.append({"t": round(now, 1), "usernet_error": str(error)[:200]})
        next_frame = now + (20 if now < 600 else 60)
    if done_at is not None:
        break
    time.sleep(5)
summary = {
    "accel": accel,
    "variant": variant,
    "end_seconds": round(time.monotonic() - start, 1),
    "collected_at_seconds": None if done_at is None else round(done_at, 1),
    "vm_exit": vm.poll(),
    "serial_bytes": serial_log.stat().st_size if serial_log.exists() else 0,
    "max_ssh_seconds": max((r["ssh_seconds"] for r in timeline if "ssh_seconds" in r), default=None),
    "ssh_polls_over_6s": sum(1 for r in timeline if r.get("ssh_seconds", 0) >= 6),
    "ssh_polls": sum(1 for r in timeline if "ssh_seconds" in r),
    "milestones_first_seen_host_seconds": milestones,
}
(out / "summary.json").write_text(json.dumps(summary, indent=1))
print(json.dumps(summary, indent=1))
if vm.poll() is None and done_at is not None:
    with (out / "probe.tar").open("wb") as tar:
        subprocess.run([*ssh, "tar -C /home/japp-ci -cf - probe"], stdout=tar, timeout=120, check=False)
try:
    qmp.call("screendump", {"filename": str(work / "frame.ppm")})
    ppm_to_png(work / "frame.ppm", out / "frame-final.png")
except Exception:  # noqa: BLE001
    pass
shutil.copyfile(serial_log, out / "guest-serial.log")
try:
    qmp.call("quit")
except Exception:  # noqa: BLE001
    pass
vm.wait(timeout=60)
