"""Install only an externally reviewed tool bundle in a disposable hosted job.

No VM or product launch. The bundle digest is an explicit workflow input.
Source checkout and the user's local machine are never installation targets.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import tempfile
from pathlib import Path
from typing import Any

from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_process import (
    local_only_apt as local_only_apt,  # noqa: PLC0414 - explicit re-export for Windows 11
)
from ubuntu_gnome_vm import (
    LOCK_PACKAGE_CAP,
    RUNNER_IMAGE_VERSION_ENV,
    TOOLS,
    Owner,
    sha,
    write,
)

MAX_FILES = 5000
MAX_TOTAL = 8 * 1024**3
ARCHIVE_CAP = 512 * 1024**2
MANIFEST_CAP = 4 * 1024**2
PLAN_SECONDS = 60
# apt-get -s (C locale) prints one summary line and one action line per change:
# 'Inst name (version origin [arch])' adds a package (measured in diagnostic run
# 41157694334), while 'Inst name [installed] (...)' replaces and 'Remv'/'Purg'
# remove one already on the runner.
#
# apt 2.8.3's pkgSimulate (apt-pkg/algorithms.cc, read 2026-10-31; not
# measured) ends an action line with ' [' + each broken package it has not
# yet touched + ']' whenever its simulated cache is broken after that step,
# and also prints ' [X on Y]' for an unsatisfied Pre-Depends or a violated
# negative dependency. A clean add-only plan unpacks a dependency loop with
# one member's Depends still open: that member is broken but already touched,
# so the list is empty and the line ends ' []'. Untouched broken packages
# there could only be runner packages, so a named list stays refused.
PLAN_SUMMARY = re.compile(
    r"([0-9]+) upgraded, ([0-9]+) newly installed, "
    r"([0-9]+) to remove and [0-9]+ not upgraded\."
)
PLAN_ADD = re.compile(r"Inst ([^\s\[\]()]+) \(([^\s()]+) [^()]*\)(?: \[\])?")
PLAN_ACTIONS = ("Inst ", "Remv ", "Purg ")


def digest(value: str) -> str:
    if re.fullmatch(r"[a-f0-9]{64}", value) is None:
        raise ValueError("Exact SHA256 required")
    return value


def audit_bundle(bundle: Path, expected: str) -> dict[str, Any]:
    manifest = bundle / "reviewed-inputs.json"
    if sha(manifest, MANIFEST_CAP) != digest(expected):
        raise ValueError("Externally reviewed bundle manifest differs")
    value = json.loads(manifest.read_bytes())
    if (
        not isinstance(value, dict)
        or value.get("schema") != "japp-reviewed-gnome-inputs-v1"
    ):
        raise ValueError("Closed reviewed input schema required")
    rows = value.get("files")
    if not isinstance(rows, dict) or not 1 <= len(rows) <= MAX_FILES:
        raise ValueError("Finite complete input inventory required")
    observed: set[str] = set()
    total = 0
    for path in bundle.rglob("*"):
        relative = str(path.relative_to(bundle))
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            continue
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("No input links or special files allowed")
        if relative == "reviewed-inputs.json":
            continue
        observed.add(relative)
        row = rows.get(relative)
        if not isinstance(row, dict) or set(row) != {"bytes", "sha256"}:
            raise ValueError("Unknown or malformed input member")
        if info.st_size != row["bytes"] or sha(path, ARCHIVE_CAP) != row["sha256"]:
            raise ValueError("Reviewed input bytes differ")
        total += info.st_size
        if total > MAX_TOTAL or len(observed) > MAX_FILES:
            raise ValueError("Reviewed input bundle exceeds finite cap")
    if observed != rows.keys():
        raise ValueError("Input inventory missing or extra members")
    return value


def require_host() -> None:
    release = Path("/etc/os-release").read_text()
    if (
        os.uname().sysname != "Linux"
        or os.uname().machine != "x86_64"
        or os.geteuid() == 0
        or 'VERSION_ID="24.04"' not in release
        or os.environ.get("GITHUB_ACTIONS") != "true"
        or os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted"
    ):
        raise ValueError("Only disposable hosted Ubuntu24.04 x64 job allowed")


def closed_install_plan(plan: bytes, packages: list[dict[str, Any]]) -> dict[str, Any]:
    """A simulated local-only install may only add exact locked packages.

    The host lock is resolved against an empty dpkg status, so a locked version
    of a package the runner image already carries would replace it, and the
    runner packages that pin the old version would be removed. Either one is
    refused, naming the plan lines; the raw plan stays retained as command
    output.
    """
    locked = {(row["package"], row["version"]) for row in packages}
    added: list[str] = []
    refused: list[str] = []
    summaries = []
    for line in plan.decode("utf-8", "replace").splitlines():
        summary = PLAN_SUMMARY.fullmatch(line)
        if summary is not None:
            summaries.append(summary)
        if not line.startswith(PLAN_ACTIONS):
            continue
        match = PLAN_ADD.fullmatch(line)
        if match is None or (match[1].split(":", 1)[0], match[2]) not in locked:
            refused.append(line[:160])
        else:
            added.append(match[1] + "=" + match[2])
    if refused:
        raise ValueError(
            "Simulated host install would replace or remove runner packages: "
            + "; ".join(refused[:6])
        )
    if len(summaries) != 1:
        raise ValueError("Exactly one simulated host install summary required")
    upgraded, installed, removed = (int(summaries[0][i]) for i in (1, 2, 3))
    if upgraded or removed or installed != len(added):
        raise ValueError("Simulated host install summary differs from its actions")
    return {
        "schema": "japp-host-install-plan-v1",
        "newly_installed": added,
        "upgraded": 0,
        "removed": 0,
        "scope": "SIMULATED_LOCAL_ONLY_APT_AGAINST_ACTUAL_RUNNER_DPKG_STATUS",
    }


def simulate_install(
    owner: Owner, apt: list[str], archives: list[str], packages: list[dict[str, Any]]
) -> None:
    """Refuse host drift before any change: same options, apt-get -s first."""
    plan = owner.command([*apt, "-s", "install", *archives], seconds=PLAN_SECONDS)
    write(owner.proof / "host-install-plan.json", closed_install_plan(plan, packages))


def install_tools(bundle: Path, owner: Owner) -> None:
    lock = json.loads((bundle / "host-tools-lock.json").read_bytes())
    if lock["runner_image_version"] != os.environ.get(RUNNER_IMAGE_VERSION_ENV):
        raise ValueError("Reviewed host image version differs")
    packages = lock["host_packages"]
    if not isinstance(packages, list) or not 1 <= len(packages) <= LOCK_PACKAGE_CAP:
        raise ValueError("Finite locked host archive closure required")
    archives = []
    for row in packages:
        name = row["filename"]
        if Path(name).name != name or not name.endswith(".deb"):
            raise ValueError("Unsafe host archive name")
        path = bundle / "host-debs" / name
        if (
            path.stat().st_size != row["bytes"]
            or sha(path, ARCHIVE_CAP) != row["sha256"]
        ):
            raise ValueError("Reviewed host archive differs")
        archives.append(str(path))
    apt = [
        "/usr/bin/sudo",
        "-n",
        "/usr/bin/apt-get",
        *local_only_apt(owner.work),
        "--no-install-recommends",
        "-y",
    ]
    simulate_install(owner, apt, archives, packages)
    owner.command([*apt, "--no-remove", "install", *archives], seconds=600)
    for name, path in TOOLS.items():
        pin = lock["tools"][name]
        if pin["path"] != path or sha(Path(path)) != pin["sha256"]:
            raise ValueError("Actual installed tool differs from reviewed binary")
    queried = owner.command(
        [
            TOOLS["dpkg_query"],
            "-W",
            "-f=${Package}\t${Version}\t${Architecture}\n",
            *sorted(row["package"] for row in packages),
        ],
        seconds=15,
    )
    actual = {}
    for line in queried.decode().splitlines():
        package, version, architecture = line.split("\t")
        if package in actual:
            raise ValueError("Duplicate observed installed host package")
        actual[package] = (version, architecture)
    expected = {
        row["package"]: (row["version"], row["architecture"]) for row in packages
    }
    if actual != expected or len(expected) != len(packages):
        raise ValueError("Actual installed host closure versions differ")
    write(
        owner.proof / "host-tools.json",
        {
            "status": "EXACT_HOST_TOOL_BYTES_OBSERVED_NO_VM_OR_PRODUCT_ACTOR",
            "runner_image_version": os.environ.get(RUNNER_IMAGE_VERSION_ENV),
            "tools": lock["tools"],
        },
    )


def main() -> int:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--bundle-sha256", required=True)
    parser.add_argument("--proof", type=Path, required=True)
    args = parser.parse_args()
    require_host()
    if (
        not args.bundle.is_absolute()
        or not args.proof.is_absolute()
        or args.proof.exists()
    ):
        raise ValueError("Absolute existing bundle and fresh proof required")
    args.proof.mkdir(mode=0o700)
    work = Path(tempfile.mkdtemp(prefix="japp-host-tools-", dir=args.proof.parent))
    owner = Owner(work, args.proof)
    owner.work_deadline = owner.started + 660
    owner.cleanup_deadline = owner.work_deadline + 30
    result: dict[str, object] = {"status": "FAILED"}
    try:
        manifest = audit_bundle(args.bundle, args.bundle_sha256)
        write(
            args.proof / "input-binding.json",
            {
                "manifest_sha256": hashlib.sha256(
                    (args.bundle / "reviewed-inputs.json").read_bytes()
                ).hexdigest(),
                "members": len(manifest["files"]),
            },
        )
        install_tools(args.bundle, owner)
        audit_bundle(args.bundle, args.bundle_sha256)
        result["status"] = "REVIEWED_HOST_INSTALL_AND_EXACT_TOOL_BYTES_PASS"
    except Exception as error:
        result.update(error_type=type(error).__name__, message=str(error)[:512])
    finally:
        result["closure"] = owner.close()
        if owner.pending_commands:
            result["status"] = "UNSETTLED_OWN_CUSTODY"
        else:
            shutil.rmtree(work)
        write(args.proof / "closure.json", result)
    return (
        0
        if result["status"] == "REVIEWED_HOST_INSTALL_AND_EXACT_TOOL_BYTES_PASS"
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
