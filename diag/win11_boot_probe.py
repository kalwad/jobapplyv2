"""DIAGNOSTIC SCRATCH ONLY - never merge.

Boot the pinned Windows 11 Evaluation ISO under the campaign's exact q35/OVMF
secure-boot/swtpm/KVM/IDE/serial-socket QEMU configuration (no answer-file
seed contents) and record (a) every COM1 byte with its arrival time, read
the way the harness reads it (connect after QMP), and (b) a QMP screendump
every 0.5 s, so the firmware COM1 output and the cdboot 'Press any key'
window can be compared with the harness's single +8 s space key.

usage: win11_boot_probe.py WORK OUT ISO MODE SECONDS
MODE: single8 (harness behaviour) | none (no key at all)
"""

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from qmp_probe import QMP, ppm_to_png  # noqa: E402

work, out, iso, mode, seconds = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4], float(sys.argv[5])
work.mkdir(parents=True)
out.mkdir(parents=True)
frames = out / "frames"
frames.mkdir()
subprocess.run(["/usr/bin/qemu-img", "create", "-f", "qcow2", str(work / "os.qcow2"), "64G"], check=True)
(work / "vars.fd").write_bytes(Path("/usr/share/OVMF/OVMF_VARS_4M.ms.fd").read_bytes())
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
tpm_deadline = time.monotonic() + 10
while not (work / "tpm.sock").exists():
    if tpm.poll() is not None or time.monotonic() > tpm_deadline:
        raise SystemExit("swtpm did not create its control socket: " + (out / "swtpm.stderr").read_text()[-500:])
    time.sleep(0.05)
argv = [
    "/usr/bin/qemu-system-x86_64", "-name", "japp-owned-win11", "-machine", "q35,smm=on", "-accel", "kvm",
    "-cpu", "host", "-smp", "2", "-m", "6144", "-global", "driver=cfi.pflash01,property=secure,value=on",
    "-drive", "if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd",
    "-drive", "if=pflash,format=raw,unit=1,file=" + str(work / "vars.fd"),
    "-drive", "if=none,id=os,format=qcow2,file=" + str(work / "os.qcow2"), "-device", "ide-hd,drive=os,bus=ide.0",
    "-drive", "if=none,id=media,media=cdrom,readonly=on,file=" + str(iso), "-device", "ide-cd,drive=media,bus=ide.1",
    "-drive", "if=none,id=seed,media=cdrom,readonly=on,file=" + str(work / "seed.iso"), "-device", "ide-cd,drive=seed,bus=ide.2",
    "-drive", "if=none,id=result,format=raw,file=" + str(work / "result.img"), "-device", "qemu-xhci,id=usb",
    "-device", "usb-storage,drive=result,removable=on",
    "-chardev", "socket,id=tpm,path=" + str(work / "tpm.sock"), "-tpmdev", "emulator,id=tpm0,chardev=tpm", "-device", "tpm-crb,tpmdev=tpm0",
    "-device", "VGA,xres=1280,yres=800", "-display", "none", "-nic", "none", "-parallel", "none",
    "-chardev", "socket,id=proof,path=" + str(work / "serial.sock") + ",server=on,wait=off", "-device", "isa-serial,chardev=proof",
    "-qmp", "unix:" + str(work / "qmp.sock") + ",server=on,wait=off", "-boot", "once=d,menu=off",
]
(out / "qemu-argv.json").write_text(json.dumps(argv, indent=1))
start = time.monotonic()
vm = subprocess.Popen(argv, stdout=(out / "qemu.stdout").open("wb"), stderr=(out / "qemu.stderr").open("wb"), start_new_session=True)
qmp = QMP(work / "qmp.sock")
qmp_at = time.monotonic() - start
serial = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
serial.connect(str(work / "serial.sock"))
serial.setblocking(False)
serial_at = time.monotonic() - start
events: list[dict] = [{"t": round(qmp_at, 3), "event": "qmp"}, {"t": round(serial_at, 3), "event": "serial-connected"}]
chunks: list[dict] = []
raw = bytearray()
key_sent = False
next_frame = 0.0
last = None
index = 0
while time.monotonic() - start < seconds and vm.poll() is None:
    now = time.monotonic() - start
    try:
        data = serial.recv(65536)
        if data:
            raw.extend(data)
            chunks.append({"t": round(now, 3), "bytes": len(data), "head": data[:200].decode("latin-1")})
    except BlockingIOError:
        pass
    if mode == "single8" and not key_sent and now >= 8:
        qmp.key("spc")
        key_sent = True
        events.append({"t": round(now, 3), "event": "key spc"})
    if now >= next_frame:
        ppm = work / "frame.ppm"
        try:
            qmp.call("screendump", {"filename": str(ppm)})
            digest = ppm_to_png(ppm, frames / f"f{index:04d}.png")
            if digest != last:
                events.append({"t": round(now, 3), "event": "frame-changed", "file": f"f{index:04d}.png"})
                last = digest
                index += 1
            else:
                (frames / f"f{index:04d}.png").unlink()
        except Exception as error:  # noqa: BLE001
            events.append({"t": round(now, 3), "event": "screendump-error", "error": str(error)[:200]})
        next_frame = now + (0.5 if now < 90 else 5)
    time.sleep(0.02)
events.append({"t": round(time.monotonic() - start, 3), "event": "end", "vm_exit": vm.poll()})
(out / "serial.raw").write_bytes(bytes(raw))
(out / "serial-chunks.json").write_text(json.dumps(chunks, indent=1))
(out / "events.json").write_text(json.dumps(events, indent=1))
try:
    qmp.call("quit")
except Exception:  # noqa: BLE001
    pass
vm.wait(timeout=30)
tpm.terminate()
print(json.dumps({"mode": mode, "serial_bytes": len(raw), "serial_lines": raw.count(b"\n"), "unique_frames": index, "key_sent": key_sent}))
print("first serial bytes:", bytes(raw[:600]))
