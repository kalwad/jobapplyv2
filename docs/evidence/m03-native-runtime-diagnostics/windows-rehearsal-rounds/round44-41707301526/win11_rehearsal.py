"""DIAGNOSTIC SCRATCH ONLY - never merge. No acceptance can come from this run.

Rehearse the Windows 11 campaign with the harness's own code: windows11_vm.seed(),
qemu_argv(), observe() (the real COM2 receipt/frame protocol), stop_after_pass()
and the post-PASS checks, on the pinned ISO and the real CI package, with the
guest controller files from diag/repo-root (the candidate correction plus
diagnostic instrumentation). It skips only what a scratch run cannot satisfy:
the reviewed bundle, release receipt, source binding, runner-image and CPU gates.

usage: win11_rehearsal.py REPO_SCRIPTS PACKAGE_ARTIFACT_DIR ISO OUT VARIANT
VARIANT: hv-a | hv-b | hv-nowhesvc | host-nowhesvc (round 44, all with console-host
delegation and a cold desktop launch): hv adds Hyper-V enlightenments; nowhesvc disables
the Windows Health and Optimized Experiences service at specialize.
A reboot after the environment receipt ends observation 240 s later, and the
disposable disk is then read read-only for its crash and boot records.
"""

import hashlib
import json
import secrets
import shutil
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path

scripts, artifact, iso, out, variant = (
    Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve(), Path(sys.argv[4]).resolve(), sys.argv[5])
sys.path.insert(0, str(scripts / "windows11"))
sys.path.insert(0, str(scripts / "linux_gnome"))
import windows11_vm as vm  # noqa: E402
from windows11_process import ChildCustody  # noqa: E402

MARKERS = ("# DIAG-SVCFIRST", "# DIAG-NODPS", "# DIAG-NODIAGTRACK", "# DIAG-NOWHESVC")
KEEP = {"hv-a": (), "hv-b": (), "hv-nowhesvc": ("# DIAG-NOWHESVC",), "host-nowhesvc": ("# DIAG-NOWHESVC",)}[variant]
DROP = tuple(m for m in MARKERS if m not in KEEP)
HV = "host,hv-relaxed,hv-vapic,hv-spinlocks=0x1fff,hv-vpindex,hv-runtime,hv-time,hv-synic,hv-stimer,hv-frequencies"
CPU = HV if variant.startswith("hv") else "host"
DIAG = Path(__file__).resolve().parent


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


out.mkdir(mode=0o700)
work = out / "private-work"
work.mkdir(mode=0o700)
owner = vm.Owner(work, out)
owner.work_deadline = owner.started + vm.WORK_SECONDS
owner.cleanup_deadline = owner.work_deadline + vm.POST_PASS_SECONDS
result = {"scope": "DIAGNOSTIC_REHEARSAL_ONLY_NOT_ACCEPTANCE", "variant": variant, "status": "FAILED"}
marks = []
marks_lock = threading.Lock()
stop_monitor = threading.Event()


def mark(name):
    with marks_lock:
        marks.append({"t": round(time.monotonic() - owner.started, 1), "mark": name})
        (out / "diag-host-marks.json").write_text(json.dumps(marks, indent=2) + "\n")


def reboot_monitor():
    # A boot after the environment frame means the guest controller is gone.
    baseline = None
    while not stop_monitor.wait(2):
        try:
            boots = (out / "firmware-console.raw").read_bytes().count(b"starting Boot0005")
        except OSError:
            continue
        if baseline is None:
            if (out / "frame-environment.json").exists():
                baseline = boots
                mark("monitor-environment-boots-" + str(boots))
            continue
        if boots > baseline:
            mark("guest-reboot-after-environment-boots-" + str(boots))
            if stop_monitor.wait(240):
                return
            mark("monitor-ends-observation")
            owner.work_deadline = time.monotonic()
            return


def forensics():
    disk = work / "os.qcow2"
    if not disk.is_file():
        return {"skipped": "no disk"}
    dest = out / "forensics"
    started = time.monotonic()
    run = subprocess.run(["sudo", "-n", "bash", str(DIAG / "forensics.sh"), str(disk), str(dest)], capture_output=True, timeout=900, check=False)
    report = {"returncode": run.returncode, "seconds": round(time.monotonic() - started, 1), "stderr": run.stderr.decode(errors="replace")[-2000:]}
    raw = dest / "raw"
    for dump in sorted(raw.glob("*.dmp")) if raw.is_dir() else []:
        parsed = subprocess.run([sys.executable, "-I", "-B", str(DIAG / "minidump_triage.py"), str(dump)], capture_output=True, timeout=120, check=False)
        (dest / (dump.stem + ".triage.json")).write_bytes(parsed.stdout or parsed.stderr)
    evtx_python = Path.home() / "evtx-venv/bin/python"
    for log in sorted(raw.glob("*.evtx")) if raw.is_dir() else []:
        if evtx_python.is_file():
            parsed = subprocess.run([str(evtx_python), "-I", "-B", str(DIAG / "evtx_events.py"), str(log)], capture_output=True, timeout=300, check=False)
            (dest / (log.stem + ".events.json")).write_bytes(parsed.stdout or parsed.stderr)
    return report


tpm = None
package = None
nonce = None
try:
    bundle = work / "bundle"
    (bundle / "guest-driver").mkdir(parents=True)
    shutil.copytree(artifact, bundle / "original-native-artifact")
    shutil.copyfile(scripts / "windows11" / "windows11_owned.cs", bundle / "guest-driver" / "windows11_owned.cs")
    for name in ("windows11_bootstrap.ps1", "windows11_guest.ps1"):
        text = (scripts / "windows11" / name).read_text(encoding="utf-8")
        kept = [line for line in text.splitlines(True) if not any(m in line for m in DROP)]
        (bundle / "guest-driver" / name).write_text("".join(kept), encoding="utf-8", newline="")
        shutil.copyfile(bundle / "guest-driver" / name, out / ("diag-" + name.split("_")[1]))
    vm.write(out / "diag-inputs.json", {
        "variant": variant,
        "dropped_markers": list(DROP),
        "guest_driver": {n: sha(bundle / "guest-driver" / n) for n in sorted(p.name for p in (bundle / "guest-driver").iterdir())},
        "package_manifest_sha256": sha(bundle / "original-native-artifact" / "manifest.json"),
        "iso_sha256_checked_by_workflow": "bc3f24086ebadc94489066b5ad78089e2cf5c3491e90e790bb81a2b199c10e38",
    })
    portable = bundle / "original-native-artifact/packages/windows-portable.zip"
    package = {"portable_sha256": sha(portable)}
    cpu = vm.host_cpu()
    vm.write(out / "host-cpu.json", {"observed": cpu, "gate": "NOT_APPLIED_DIAGNOSTIC"})
    vm.write(out / "kvm.json", vm.kvm(owner))
    nonce = secrets.token_hex(32)
    vm.write(out / "subject.json", {"nonce": nonce, "package_sha256": package["portable_sha256"], "scope": "DIAGNOSTIC"})
    seed_iso = vm.seed(bundle, package, owner, nonce)
    mark("seed")
    shutil.copyfile(vm.FIRMWARE["vars"], work / "vars.fd")
    owner.command([vm.TOOLS["qemu_img"], "create", "-f", "qcow2", str(work / "os.qcow2"), "80G"])
    with (work / "result.img").open("xb") as output:
        output.truncate(128 * 1024**2)
    owner.command([vm.TOOLS["mformat"], "-i", str(work / "result.img"), "-F", "-v", "JAPP-RESULT", "::"])
    state = work / "tpm-state"
    state.mkdir(mode=0o700)
    with (out / "swtpm.stdout").open("xb") as stdout, (out / "swtpm.stderr").open("xb") as stderr:
        child = subprocess.Popen(
            [vm.TOOLS["swtpm"], "socket", "--tpm2", "--tpmstate", "dir=" + str(state), "--ctrl", "type=unixio,path=" + str(work / "tpm.sock")],
            stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
        tpm = ChildCustody(child, child.pid)
    deadline = time.monotonic() + 5
    while not (work / "tpm.sock").exists():
        if tpm.child.poll() is not None or time.monotonic() >= deadline:
            raise ValueError("Owned TPM control socket unavailable")
        time.sleep(0.05)
    argv = vm.qemu_argv(work, iso, seed_iso)
    cpu_at = argv.index("-cpu") + 1
    if argv[cpu_at] != "host":
        raise ValueError("unexpected harness CPU argument")
    argv[cpu_at] = CPU
    vm.write(out / "qemu-argv.json", argv)
    with (out / "qemu.stdout").open("xb") as stdout, (out / "qemu.stderr").open("xb") as stderr:
        owner.child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
        owner.pgid = owner.child.pid
    mark("qemu-started")
    threading.Thread(target=reboot_monitor, daemon=True).start()
    observation = vm.observe(owner, nonce, package["portable_sha256"], cpu["model name"])
    mark("guest-pass")
    vm.write(out / "lifecycle.json", observation)
    result["guest_terminal"] = "PASS"
    result["guest_stop"] = vm.stop_after_pass(owner)
    destination = out / "guest-results"
    destination.mkdir()
    owner.command([vm.TOOLS["mcopy"], "-i", str(work / "result.img"), "-s", "::/proof", str(destination)], seconds=vm.COLLECT_SECONDS, cleanup=True)
    output = destination / "proof"
    native_shell = json.loads(vm.bounded(output / "native-shell.json").decode("utf-8-sig"))
    vm.validate_capture(native_shell, package["portable_sha256"], "WINDOWS_UIA")
    vm.verify_capture_images(output, native_shell)
    keyboard = next(row for row in observation["receipts"] if row["phase"] == "keyboard")
    if keyboard.get("native_shell") != native_shell:
        raise ValueError("Serial and retained native shell capture differ")
    attestation = vm.document(output / "environment.json")
    vm.attest_guest(attestation, nonce, cpu["model name"])
    cleanup = json.loads(vm.bounded(output / "owned-cleanup.json").decode("utf-8-sig"))
    if not isinstance(cleanup, list) or not cleanup or any(row.get("settled") is not True for row in cleanup):
        raise ValueError("Guest retained native custody remains unsettled")
    result["status"] = "DIAGNOSTIC_REHEARSAL_PASS_NOT_ACCEPTANCE"
    mark("post-pass-checks")
except Exception as error:  # noqa: BLE001
    result.update(error_type=type(error).__name__, message=str(error)[:2000])
    (out / "diag-driver-traceback.txt").write_text(traceback.format_exc())
    mark("error")
finally:
    if owner.child is not None and owner.child.returncode is None and owner.qmp is not None:
        if owner.qmp_unusable is None:
            try:
                result["failure_frame"] = vm.diagnostic_frame(owner, "win11-failure")
            except BaseException as error:  # noqa: BLE001
                result["failure_frame_error"] = type(error).__name__
            try:
                owner.qmp_call("system_powerdown")
            except BaseException as error:  # noqa: BLE001
                result["guest_powerdown_error"] = type(error).__name__
            try:
                owner.child.wait(timeout=60)  # a clean guest shutdown leaves a clean NTFS for forensics
            except BaseException:  # noqa: BLE001
                pass
    try:
        result["vm_closure"] = owner.close()
    except BaseException as error:  # noqa: BLE001
        result["vm_cleanup_error"] = type(error).__name__
    stop_monitor.set()
    try:
        result["forensics"] = forensics()
    except BaseException as error:  # noqa: BLE001
        result["forensics_error"] = type(error).__name__ + ": " + str(error)[:300]
    if tpm is not None:
        try:
            tpm.terminate_unreaped()
        except BaseException as error:  # noqa: BLE001
            result["tpm_cleanup_error"] = type(error).__name__
    try:
        destination = out / "guest-results"
        if (work / "result.img").is_file() and not (destination.is_dir() and any(destination.iterdir())):
            destination.mkdir(exist_ok=True)
            owner.command([vm.TOOLS["mcopy"], "-i", str(work / "result.img"), "-s", "::/proof", str(destination)], seconds=10, cleanup=True)
    except BaseException as error:  # noqa: BLE001
        result["failure_result_collection_error"] = type(error).__name__
    result["host_marks"] = marks
    vm.write(out / "closure.json", result)
    # The private work holds the synthetic answer file and the VM disk; never retained.
    shutil.rmtree(work, ignore_errors=True)
    print(json.dumps(result, indent=1)[:4000])
