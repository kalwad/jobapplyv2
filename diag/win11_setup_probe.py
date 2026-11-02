"""DIAGNOSTIC SCRATCH ONLY - never merge.

Boot the pinned Windows 11 Enterprise Evaluation ISO with the harness's own
qemu_argv() and answer_file() (scripts copied into diag/repo-root at the
reviewed source), a seed CD built like seed() but with a no-op bootstrap,
and the same 128 MiB JAPP-RESULT USB disk. Send the boot key on OVMF's
media-start line, then save a QMP frame every minute. Variant 'noletter'
removes <Letter>C</Letter> from the answer file; nothing else differs.

usage: win11_setup_probe.py REPO_SCRIPTS ISO WORK OUT VARIANT MINUTES
"""

import json
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

scripts, iso, work, out, variant, minutes = (
    Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5], int(sys.argv[6]))
sys.path.insert(0, str(scripts / "windows11"))
sys.path.insert(0, str(scripts / "linux_gnome"))
import windows11_vm as vm  # noqa: E402
from windows11_deployment import answer_file  # noqa: E402

work.mkdir(parents=True)
out.mkdir(parents=True, exist_ok=True)
log = []
def note(key, value=None):
    log.append({"t": round(time.monotonic() - t0, 1), "key": key, "value": value})
    (out / "probe.json").write_text(json.dumps(log, indent=1))
t0 = time.monotonic()

xml = answer_file(secrets.token_urlsafe(40), "Windows 11 Enterprise Evaluation")
if variant == "noletter":
    before = xml.count(b"<Letter>")
    xml = re.sub(rb"\s*<Letter>C</Letter>", b"", xml)
    note("removed_letters", before - xml.count(b"<Letter>"))
seed_dir = work / "seed"
seed_dir.mkdir()
(seed_dir / "Autounattend.xml").write_bytes(xml)
(seed_dir / "windows11_bootstrap.ps1").write_text("exit 0\r\n")
(out / "answer-file-structure.txt").write_text(
    re.sub(rb"<Value>[^<]*</Value>|<Password>.*?</Password>", b"<redacted/>", xml, flags=re.S).decode())
subprocess.run(["xorriso", "-as", "mkisofs", "-J", "-R", "-V", "JAPP-SEED", "-o", str(work / "seed.iso"), str(seed_dir)], check=True, capture_output=True)
shutil.copyfile(vm.FIRMWARE["vars"], work / "vars.fd")
subprocess.run(["qemu-img", "create", "-f", "qcow2", str(work / "os.qcow2"), "80G"], check=True, capture_output=True)
with (work / "result.img").open("xb") as f:
    f.truncate(128 * 1024**2)
subprocess.run(["mformat", "-i", str(work / "result.img"), "-F", "-v", "JAPP-RESULT", "::"], check=True, capture_output=True)
(work / "tpm-state").mkdir()
tpm = subprocess.Popen(["swtpm", "socket", "--tpm2", "--tpmstate", "dir=" + str(work / "tpm-state"), "--ctrl", "type=unixio,path=" + str(work / "tpm.sock")], start_new_session=True)
while not (work / "tpm.sock").exists():
    time.sleep(0.05)
argv = vm.qemu_argv(work, iso, work / "seed.iso")
note("argv", argv)
qemu = subprocess.Popen(argv, stdout=(out / "qemu.stdout").open("wb"), stderr=(out / "qemu.stderr").open("wb"), start_new_session=True)
def unix(path):
    for _ in range(200):
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); s.connect(str(path)); return s
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("socket " + str(path))
firmware, serial, qmp = unix(work / "firmware.sock"), unix(work / "serial.sock"), unix(work / "qmp.sock")
qbuf = b""
def qmp_call(execute, arguments=None):
    global qbuf
    qmp.sendall(json.dumps({"execute": execute, **({"arguments": arguments} if arguments else {})}).encode() + b"\n")
    qmp.settimeout(30)
    while True:
        while b"\n" not in qbuf:
            qbuf += qmp.recv(65536)
        line, qbuf = qbuf.split(b"\n", 1)
        msg = json.loads(line)
        if "return" in msg or "error" in msg:
            return msg
qmp.settimeout(10)
while b"\n" not in qbuf:
    qbuf += qmp.recv(65536)
qbuf = qbuf.split(b"\n", 1)[1]
qmp_call("qmp_capabilities")
console = b""
firmware.settimeout(0.2)
deadline = time.monotonic() + 60
while time.monotonic() < deadline and not vm.installation_media_started(console):
    try:
        console += firmware.recv(65536)
    except socket.timeout:
        pass
note("media_started", vm.installation_media_started(console))
time.sleep(vm.BOOT_KEY_DELAY)
note("boot_key", qmp_call("send-key", {"keys": [{"type": "qcode", "data": "spc"}]}))
for socket_ in (firmware, serial):
    socket_.setblocking(False)
for minute in range(1, minutes + 1):
    end = time.monotonic() + 60
    while time.monotonic() < end:
        for socket_ in (firmware, serial):
            try:
                socket_.recv(65536)
            except (BlockingIOError, socket.timeout):
                pass
        if qemu.poll() is not None:
            break
        time.sleep(0.5)
    if qemu.poll() is not None:
        note("qemu_exited", qemu.returncode)
        break
    frame = out / f"frame-{minute:02d}.ppm"
    note("frame", {"minute": minute, "reply": qmp_call("screendump", {"filename": str(frame)})})
    time.sleep(1)
    if frame.exists():
        subprocess.run([sys.executable, "-I", "-B", str(Path(__file__).parent / "ppm2png.py"), str(frame), str(frame.with_suffix(".png"))], capture_output=True)
        frame.unlink()
try:
    qmp_call("quit")
except Exception as error:  # noqa: BLE001
    note("quit_error", type(error).__name__)
qemu.wait(timeout=30)
tpm.terminate()
note("end")
