"""DIAGNOSTIC SCRATCH ONLY - never merge. No acceptance can come from this run.

Rehearse the Windows 11 campaign with the harness's own code: windows11_vm.seed(),
qemu_argv(), observe() (the real COM2 receipt/frame protocol), stop_after_pass()
and the post-PASS checks, on the pinned ISO and the real CI package, with the
guest controller files from diag/repo-root (the candidate correction plus
diagnostic instrumentation). It skips only what a scratch run cannot satisfy:
the reviewed bundle, release receipt, source binding, runner-image and CPU gates.

usage: win11_rehearsal.py REPO_SCRIPTS PACKAGE_ARTIFACT_DIR ISO OUT VARIANT
VARIANT: both | lockonly | startonly (which first-logon Default-profile settings stay)
"""

import hashlib
import json
import secrets
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path

scripts, artifact, iso, out, variant = (
    Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve(), Path(sys.argv[4]).resolve(), sys.argv[5])
sys.path.insert(0, str(scripts / "windows11"))
sys.path.insert(0, str(scripts / "linux_gnome"))
import windows11_vm as vm  # noqa: E402
from windows11_process import ChildCustody  # noqa: E402

DROP = {"both": (), "lockonly": ("# DIAG-START",), "startonly": ("# DIAG-LOCK",)}[variant]


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


def mark(name):
    marks.append({"t": round(time.monotonic() - owner.started, 1), "mark": name})
    (out / "diag-host-marks.json").write_text(json.dumps(marks, indent=2) + "\n")


tpm = None
package = None
nonce = None
try:
    bundle = work / "bundle"
    (bundle / "guest-driver").mkdir(parents=True)
    shutil.copytree(artifact, bundle / "original-native-artifact")
    for name in ("windows11_guest.ps1", "windows11_owned.cs"):
        shutil.copyfile(scripts / "windows11" / name, bundle / "guest-driver" / name)
    text = (scripts / "windows11" / "windows11_bootstrap.ps1").read_text(encoding="utf-8")
    kept = [line for line in text.splitlines(True) if not any(m in line for m in DROP)]
    (bundle / "guest-driver" / "windows11_bootstrap.ps1").write_text("".join(kept), encoding="utf-8", newline="")
    shutil.copyfile(bundle / "guest-driver" / "windows11_bootstrap.ps1", out / "diag-bootstrap.ps1")
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
    vm.write(out / "qemu-argv.json", argv)
    with (out / "qemu.stdout").open("xb") as stdout, (out / "qemu.stderr").open("xb") as stderr:
        owner.child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
        owner.pgid = owner.child.pid
    mark("qemu-started")
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
                owner.child.wait(timeout=20)
            except BaseException:  # noqa: BLE001
                pass
    try:
        result["vm_closure"] = owner.close()
    except BaseException as error:  # noqa: BLE001
        result["vm_cleanup_error"] = type(error).__name__
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
