"""DIAGNOSTIC SCRATCH ONLY - never merge.

Round 3: boot the pinned Evaluation ISO with the proposed harness's own
qemu_argv() (COM1 firmware console socket, COM2 protocol socket) and its own
installation_media_started() trigger plus BOOT_KEY_DELAY single key, and
record whether Windows Setup is reached and whether COM2 stays silent.

usage: win11_boot3.py REPO WORK OUT ISO SECONDS
"""

import json
import select
import socket
import subprocess
import sys
import time
from pathlib import Path

repo, work, out, iso, seconds = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]), float(sys.argv[5])
sys.path.insert(0, str(repo / "scripts/linux_gnome"))
sys.path.insert(0, str(repo / "scripts/windows11"))
sys.path.insert(0, str(Path(__file__).parent))
from qmp_probe import QMP, ppm_to_png  # noqa: E402
from windows11_candidate import FIRMWARE  # noqa: E402
from windows11_vm import BOOT_KEY_DELAY, installation_media_started, qemu_argv  # noqa: E402

work.mkdir(parents=True)
out.mkdir(parents=True)
frames = out / "frames"
frames.mkdir()
subprocess.run(["/usr/bin/qemu-img", "create", "-q", "-f", "qcow2", str(work / "os.qcow2"), "64G"], check=True)
(work / "vars.fd").write_bytes(Path(FIRMWARE["vars"]).read_bytes())
with (work / "result.img").open("xb") as handle:
    handle.truncate(128 * 1024**2)
subprocess.run(["/usr/bin/mformat", "-i", str(work / "result.img"), "-F", "-v", "JAPP-RESULT", "::"], check=True)
(work / "seed").mkdir()
(work / "seed" / "README.txt").write_text("diagnostic empty seed\n")
subprocess.run(["/usr/bin/xorriso", "-as", "mkisofs", "-J", "-R", "-V", "JAPP-SEED", "-o", str(work / "seed.iso"), str(work / "seed")], check=True, capture_output=True)
(work / "tpm-state").mkdir(mode=0o700)
tpm = subprocess.Popen(
    ["/usr/bin/swtpm", "socket", "--tpm2", "--tpmstate", "dir=" + str(work / "tpm-state"), "--ctrl", "type=unixio,path=" + str(work / "tpm.sock")],
    stdout=(out / "swtpm.stdout").open("wb"), stderr=(out / "swtpm.stderr").open("wb"), start_new_session=True,
)
deadline = time.monotonic() + 10
while not (work / "tpm.sock").exists():
    if tpm.poll() is not None or time.monotonic() > deadline:
        raise SystemExit("swtpm failed: " + (out / "swtpm.stderr").read_text()[-500:])
    time.sleep(0.05)
argv = qemu_argv(work, iso, work / "seed.iso")
(out / "qemu-argv.json").write_text(json.dumps(argv, indent=1))
start = time.monotonic()
vm = subprocess.Popen(argv, stdout=(out / "qemu.stdout").open("wb"), stderr=(out / "qemu.stderr").open("wb"), start_new_session=True)
qmp = QMP(work / "qmp.sock")


def connect(path: Path) -> socket.socket:
    limit = time.monotonic() + 15
    while True:
        client = socket.socket(socket.AF_UNIX)
        try:
            client.connect(str(path))
            return client
        except (FileNotFoundError, ConnectionRefusedError):
            client.close()
            if time.monotonic() > limit:
                raise
            time.sleep(0.05)


firmware = connect(work / "firmware.sock")
serial = connect(work / "serial.sock")
events: list[dict] = [{"t": round(time.monotonic() - start, 3), "event": "connected"}]
console = b""
com2 = b""
chunks: list[dict] = []
media_at = None
key_at = None
next_frame = 0.0
last = None
index = 0
while time.monotonic() - start < seconds and vm.poll() is None:
    now = time.monotonic() - start
    if media_at is None and installation_media_started(console):
        media_at = now
        events.append({"t": round(now, 3), "event": "media-started-line"})
    if media_at is not None and key_at is None and now - media_at >= BOOT_KEY_DELAY:
        qmp.key("spc")
        key_at = now
        events.append({"t": round(now, 3), "event": "key spc"})
    readable, _, _ = select.select([firmware, serial], [], [], 0.05)
    if firmware in readable:
        data = firmware.recv(65536)
        console += data
        chunks.append({"t": round(now, 3), "port": "COM1", "bytes": len(data), "head": data[:160].decode("latin-1")})
    if serial in readable:
        data = serial.recv(65536)
        com2 += data
        chunks.append({"t": round(now, 3), "port": "COM2", "bytes": len(data), "head": data[:160].decode("latin-1")})
    if now >= next_frame:
        try:
            qmp.call("screendump", {"filename": str(work / "frame.ppm")})
            digest = ppm_to_png(work / "frame.ppm", frames / f"f{index:04d}.png", scale=4)
            if digest != last:
                events.append({"t": round(now, 3), "event": "frame-changed", "file": f"f{index:04d}.png"})
                last = digest
                index += 1
            else:
                (frames / f"f{index:04d}.png").unlink()
        except Exception as error:  # noqa: BLE001
            events.append({"t": round(now, 3), "event": "screendump-error", "error": str(error)[:200]})
        next_frame = now + (1 if now < 60 else 5)
try:
    qmp.call("screendump", {"filename": str(work / "frame.ppm")})
    ppm_to_png(work / "frame.ppm", out / "final.png", scale=1)
except Exception:  # noqa: BLE001
    pass
events.append({"t": round(time.monotonic() - start, 3), "event": "end", "vm_exit": vm.poll()})
(out / "com1-console.raw").write_bytes(console)
(out / "com2-protocol.raw").write_bytes(com2)
(out / "chunks.json").write_text(json.dumps(chunks, indent=1))
(out / "events.json").write_text(json.dumps(events, indent=1))
summary = {"media_started_at": media_at, "key_at": key_at, "com1_bytes": len(console), "com2_bytes": len(com2), "unique_frames": index, "vm_exit": vm.poll()}
(out / "summary.json").write_text(json.dumps(summary, indent=1))
print(json.dumps(summary, indent=1))
try:
    qmp.call("quit")
except Exception:  # noqa: BLE001
    pass
vm.wait(timeout=30)
tpm.terminate()
