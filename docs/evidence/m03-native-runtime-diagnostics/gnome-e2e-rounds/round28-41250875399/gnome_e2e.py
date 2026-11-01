"""DIAGNOSTIC SCRATCH ONLY - never merge.

Round 12: run the GNOME harness's own VM functions end to end on a hosted
KVM runner: prepare_image (signed cloud image), prepare_guest (the working-tree
guest scripts), launch_vm, observe_session, run_lifecycle (the product actors
and native shell capture) and finalize, with the reviewed a5ec1e3 candidate's
package and guest closure. Only request authorization and the source/package
build binding (prepare_inputs, final_source_guard) are bypassed.

usage: gnome_e2e.py HARNESS_DIR INPUTS PROOF
"""

import argparse
import hashlib
import json
import sys
import tempfile
import traceback
from pathlib import Path

harness, inputs, proof = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
sys.path.insert(0, str(harness))
import ubuntu_gnome_vm as vm  # noqa: E402


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


proof.parent.mkdir(parents=True, exist_ok=True)
proof.mkdir(mode=0o700)
work = Path(tempfile.mkdtemp(prefix="japp-gnome-e2e-", dir=proof.parent))
work.chmod(0o700)
export = json.loads((inputs / "package/export.json").read_bytes())
args = argparse.Namespace(
    proof=proof,
    package=inputs / "package",
    guest_closure=inputs / "guest-closure",
    guest_closure_sha256=digest(inputs / "guest-closure/lock.json"),
    image_keyring=inputs / "ubuntu-cloudimage-keyring.gpg",
    image_keyring_sha256=digest(inputs / "ubuntu-cloudimage-keyring.gpg"),
    expected_head="diagnostic-round-12",
    package_build_head=export["expected_head"],
    source=None,
    source_tree="diagnostic-round-12",
)
owner = vm.Owner(work, proof)
result: dict = {"status": "PREPARATION_FAILED", "product_launched": False, "scope": "DIAGNOSTIC_ROUND_12_NOT_CAMPAIGN_EVIDENCE"}
try:
    lock = vm.validate_closure(args.guest_closure, args.guest_closure_sha256)
    vm.write(proof / "kvm.json", vm.kvm(owner))
    image = vm.prepare_image(args, owner)
    plan = vm.prepare_guest(args, owner, image, lock, export)
    vm.launch_vm(args, owner, plan)
    owner.ssh = plan.ssh
    session = vm.observe_session(args, owner, plan.ssh)
    vm.run_lifecycle(args, owner, session, export, result)
except Exception as error:  # noqa: BLE001
    result.update(status="FAILED_OR_CAPABILITY_UNAVAILABLE", error_type=type(error).__name__, message=str(error)[:2000], traceback=traceback.format_exc()[-6000:])
finally:
    vm.finalize(args, owner, None, result)
print(json.dumps({k: v for k, v in result.items() if k != "traceback"}, indent=1, default=str)[:20000])
print(result.get("traceback", ""))
