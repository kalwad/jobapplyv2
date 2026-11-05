"""DIAGNOSTIC ONLY: resolve the Windows 11 host-tool closure on a real hosted runner, both ways."""
import json
import shutil
import sys
import traceback
from pathlib import Path

scripts, out = Path(sys.argv[1]), Path(sys.argv[2])
sys.path[:0] = [str(scripts / "windows11"), str(scripts / "linux_gnome")]
from ubuntu_gnome_prepare import resolve, simulate_host_install  # noqa: E402
from ubuntu_gnome_vm import Owner  # noqa: E402
from windows11_candidate import HOST_ROOTS  # noqa: E402

out.mkdir(mode=0o700)
shutil.copyfile("/var/lib/dpkg/status", out / "runner-dpkg-status")
summary = {}
for mode, runner_status in (("empty-status", False), ("runner-status", True)):
    proof = out / mode
    proof.mkdir(mode=0o700)
    work = proof / "private-work"
    work.mkdir(mode=0o700)
    owner = Owner(work, proof)
    row = {}
    try:
        lock = resolve(owner, work / "apt", work / "host", HOST_ROOTS, runner_status=runner_status)
        row["downloaded"] = [[r["package"], r["version"]] for r in lock["packages"]]
        row["runner_provided"] = lock.get("runner_provided_packages")
        row["dpkg_status_sha256"] = lock.get("dpkg_status_sha256")
        shutil.copyfile(work / "host" / "lock.json", proof / "lock.json")
        simulate_host_install(owner, work / "host", lock["packages"])
        row["status"] = "SIMULATED_INSTALL_ACCEPTED"
    except Exception as error:  # noqa: BLE001 - diagnostic record
        row["status"] = "FAILED"
        row["error"] = type(error).__name__ + ": " + str(error)[:3000]
        row["traceback"] = traceback.format_exc()[-4000:]
    finally:
        row["closure"] = owner.close()
        shutil.rmtree(work, ignore_errors=True)
    summary[mode] = row
(out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
for mode, row in summary.items():
    print(mode, row["status"], row.get("error", ""))
    print("  downloaded", len(row.get("downloaded") or []), "runner_provided", len(row.get("runner_provided") or []))
