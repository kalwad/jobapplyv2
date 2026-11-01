"""Candidate-only authenticated apt download preparation; no install/VM/product.

Run only in a disposable hosted Noble job after source review. Uses an empty
private dpkg status and private apt configuration so the candidate closure does
not silently depend on packages preinstalled on the build runner. Output stays
UNREVIEWED until a different review chooses its exact manifest SHA256.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from ubuntu_gnome_host import (
    ARCHIVE_CAP,
    MAX_FILES,
    MAX_TOTAL,
    local_only_apt,
    require_host,
    simulate_install,
)
from ubuntu_gnome_platform import require_linux
from ubuntu_gnome_signed_indexes import retain_signed_chain
from ubuntu_gnome_vm import (
    LOCK_PACKAGE_CAP,
    RUNNER_IMAGE_VERSION_ENV,
    TOOLS,
    Owner,
    bind_source,
    final_source_guard,
    sha,
    write,
)

GUEST_ROOTS = (
    "ubuntu-desktop-minimal",
    "ubuntu-session",
    "ubuntu-settings",
    "gdm3",
    "gnome-shell",
    "gir1.2-atspi-2.0",
    "python3-gi",
    "at-spi2-core",
    "openssh-server",
)
HOST_ROOTS = (
    "qemu-system-x86",
    "qemu-utils",
    "cloud-image-utils",
    "openssh-client",
    "gpgv",
    "dpkg",
    "ubuntu-cloudimage-keyring",
)
TOTAL_ARCHIVE_CAP = 6 * 1024**3


def apt_config(root: Path) -> Path:
    root.mkdir(mode=0o700)
    for name in ("lists/partial", "archives/partial", "log", "empty-parts"):
        (root / name).mkdir(parents=True)
    (root / "status").write_bytes(b"")
    keyring = root / "ubuntu-archive-keyring.gpg"
    shutil.copyfile("/usr/share/keyrings/ubuntu-archive-keyring.gpg", keyring)
    sources = root / "sources.list"
    repositories = (
        ("https://archive.ubuntu.com/ubuntu", "noble"),
        ("https://archive.ubuntu.com/ubuntu", "noble-updates"),
        ("https://security.ubuntu.com/ubuntu", "noble-security"),
    )
    sources.write_text(
        "".join(
            "deb [arch=amd64 signed-by="
            + str(keyring)
            + "] "
            + origin
            + " "
            + suite
            + " main restricted universe multiverse\n"
            for origin, suite in repositories
        )
    )
    paths = {
        "Dir::State::status": root / "status",
        "Dir::State::lists": root / "lists",
        "Dir::State::extended_states": root / "extended_states",
        "Dir::Cache::archives": root / "archives",
        "Dir::Cache::pkgcache": root / "pkgcache.bin",
        "Dir::Cache::srcpkgcache": root / "srcpkgcache.bin",
        "Dir::Etc::sourcelist": sources,
        "Dir::Etc::sourceparts": root / "empty-parts",
        "Dir::Etc::parts": root / "empty-parts",
        "Dir::Etc::main": root / "missing-main",
        "Dir::Log": root / "log",
    }
    config = root / "apt.conf"
    config.write_text(
        "".join(name + ' "' + str(path) + '";\n' for name, path in paths.items())
        + 'APT::Architecture "amd64";\nAPT::Architectures { "amd64"; };\n'
        + 'Acquire::Languages "none";\nAcquire::Check-Valid-Until "true";\n'
        + 'Acquire::GzipIndexes "false";\n'
        + 'Acquire::IndexTargets::deb::Packages::KeepCompressed "false";\n'
        + 'Acquire::AllowInsecureRepositories "false";\n'
        + 'Acquire::AllowDowngradeToInsecureRepositories "false";\n'
        + 'APT::Get::AllowUnauthenticated "false";\n'
        + 'APT::Sandbox::User "'
        + getpass.getuser()
        + '";\n'
    )
    return config


def fields(raw: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in raw.decode().split("\n\n", 1)[0].splitlines():
        if not line or line[0].isspace():
            continue
        key, value = line.split(":", 1)
        if key in result:
            raise ValueError("Duplicate Debian metadata field")
        result[key] = value.strip()
    return result


def resolve(
    owner: Owner, root: Path, destination: Path, roots: tuple[str, ...]
) -> dict[str, Any]:
    config = apt_config(root)
    # APT_CONFIG is read before the default configuration fragments; -c alone
    # would load host hooks before these private directory overrides.
    environment = ["/usr/bin/env", "APT_CONFIG=" + str(config)]
    apt = [*environment, "/usr/bin/apt-get", "-c", str(config), "-qq"]
    owner.command([*apt, "update"], seconds=180)
    owner.command(
        [
            *apt,
            "--download-only",
            "--reinstall",
            "--no-install-recommends",
            "-y",
            "install",
            *roots,
        ],
        seconds=900,
    )
    archives = sorted((root / "archives").glob("*.deb"))
    if not 1 <= len(archives) <= LOCK_PACKAGE_CAP:
        raise ValueError("Candidate closure exceeds finite archive cap")
    destination.mkdir(mode=0o700)
    debs = destination / "debs"
    debs.mkdir()
    rows = []
    total = 0
    for archive in archives:
        raw = owner.command(["/usr/bin/dpkg-deb", "-f", str(archive)], seconds=5)
        meta = fields(raw)
        package, version, architecture = (
            meta[name] for name in ("Package", "Version", "Architecture")
        )
        published = fields(
            owner.command(
                [
                    *environment,
                    "/usr/bin/apt-cache",
                    "-c",
                    str(config),
                    "show",
                    "--no-all-versions",
                    package + "=" + version,
                ],
                seconds=5,
            )
        )
        pin = sha(archive, ARCHIVE_CAP)
        size = archive.stat().st_size
        if (
            published["Package"] != package
            or published["Version"] != version
            or published["SHA256"] != pin
            or int(published["Size"]) != size
        ):
            raise ValueError(
                "Downloaded archive differs from authenticated apt metadata"
            )
        if (
            architecture not in {"all", "amd64"}
            or published["Architecture"] != architecture
        ):
            raise ValueError("Unexpected candidate archive architecture")
        total += size
        if total > TOTAL_ARCHIVE_CAP:
            raise ValueError("Candidate closure exceeds finite byte cap")
        shutil.copyfile(archive, debs / archive.name)
        rows.append(
            {
                "filename": archive.name,
                "package": package,
                "version": version,
                "architecture": architecture,
                "bytes": size,
                "sha256": pin,
            }
        )
    chain = retain_signed_chain(
        owner, root, config, destination / "signed-metadata", rows
    )
    result = {
        "schema": "japp-reviewed-noble-closure-v1",
        "architecture": "amd64",
        "review_state": "UNREVIEWED_CANDIDATE_NOT_AUTHORIZED_FOR_ACTOR",
        "signed_metadata": chain["releases"],
        "signed_index_chain": chain,
        "packages": rows,
        "roots": list(roots),
        "empty_status_resolution": True,
        "package_bytes": total,
    }
    write(destination / "lock.json", result)
    return result


def simulate_host_install(
    owner: Owner, closure: Path, packages: list[dict[str, Any]]
) -> None:
    """Retain the lifecycle host install plan, simulated on this same image.

    Unprivileged apt-get -s with the lifecycle's local-only options against the
    runner's actual dpkg status; a closure that would replace or remove any
    preinstalled runner package fails the candidate before review.
    """
    simulate_install(
        owner,
        [
            "/usr/bin/apt-get",
            *local_only_apt(owner.work),
            "--no-install-recommends",
            "-y",
        ],
        [str(closure / "debs" / row["filename"]) for row in packages],
        packages,
    )


def extract_host_tools(
    owner: Owner, host: Path, lock: dict[str, Any], output: Path
) -> None:
    extraction = owner.work / "host-extraction"
    extraction.mkdir()
    for row in lock["packages"]:
        owner.command(
            [
                "/usr/bin/dpkg-deb",
                "-x",
                str(host / "debs" / row["filename"]),
                str(extraction),
            ],
            seconds=10,
        )
    tools = {}
    for name, absolute in TOOLS.items():
        path = extraction / absolute.removeprefix("/")
        tools[name] = {"path": absolute, "sha256": sha(path)}
    key = extraction / "usr/share/keyrings/ubuntu-cloudimage-keyring.gpg"
    shutil.copyfile(key, output / "ubuntu-cloudimage-keyring.gpg")
    shutil.copytree(host / "debs", output / "host-debs")
    shutil.copytree(host / "signed-metadata", output / "host-signed-metadata")
    write(
        output / "host-tools-lock.json",
        {
            "runner_image_version": os.environ.get(RUNNER_IMAGE_VERSION_ENV),
            "tools": tools,
            "host_packages": lock["packages"],
            "signed_metadata": lock["signed_metadata"],
            "signed_index_chain": lock["signed_index_chain"],
            "signed_metadata_root": "host-signed-metadata",
            "review_state": "UNREVIEWED_CANDIDATE_NOT_AUTHORIZED_FOR_ACTOR",
        },
    )


def copy_package(package: Path, output: Path, export: dict[str, Any]) -> None:
    output.mkdir()
    for name in ["export.json", *export["files"]]:
        if Path(name).name != name:
            raise ValueError("Exact package export basenames required")
        source = package / name
        pin = sha(source, ARCHIVE_CAP)
        if name != "export.json" and pin != export["files"][name]["sha256"]:
            raise ValueError("Original finite package export member changed")
        shutil.copyfile(source, output / name)
        if sha(source, ARCHIVE_CAP) != pin or sha(output / name, ARCHIVE_CAP) != pin:
            raise ValueError("Exact package copy changed")


def candidate_manifest(output: Path) -> None:
    rows = {}
    total = 0
    for path in sorted(output.rglob("*")):
        if path.is_dir() and not path.is_symlink():
            continue
        rows[str(path.relative_to(output))] = {
            "bytes": path.lstat().st_size,
            "sha256": sha(path, ARCHIVE_CAP),
        }
        total += path.lstat().st_size
        if len(rows) > MAX_FILES or total > MAX_TOTAL:
            raise ValueError("Candidate input manifest exceeds finite reviewed cap")
    write(
        output / "reviewed-inputs.json",
        {
            "schema": "japp-reviewed-gnome-inputs-v1",
            "review_state": "UNREVIEWED_REQUIRES_DIFFERENT_REVIEW_AND_EXPLICIT_SHA",
            "files": rows,
        },
    )


def prepare_candidate(
    args: argparse.Namespace, owner: Owner, prepared: dict[str, Any]
) -> None:
    export = json.loads((args.package / "export.json").read_bytes())
    source_before, binding = bind_source(args, owner, export)
    prepared.update(source_before=source_before, git_binding=binding)
    for name in ("ubuntu_gnome_prepare.py", "ubuntu_gnome_host.py"):
        if (
            sha(Path(__file__).with_name(name))
            != source_before["scripts/linux_gnome/" + name]["sha256"]
        ):
            raise ValueError("Executing preparation source differs from checkout")
    package = args.package / "package.deb"
    if sha(package, ARCHIVE_CAP) != export["files"]["package.deb"]["sha256"]:
        raise ValueError("Inspected original archive differs")
    resolve(
        owner,
        owner.work / "guest-apt",
        args.inputs / "guest-closure",
        (*GUEST_ROOTS, str(package)),
    )
    host = args.output / "host-candidate"
    host_lock = resolve(owner, owner.work / "host-apt", host, HOST_ROOTS)
    simulate_host_install(owner, host, host_lock["packages"])
    extract_host_tools(owner, host, host_lock, args.inputs)
    copy_package(args.package, args.inputs / "package", export)


def finish_candidate(
    args: argparse.Namespace,
    owner: Owner,
    prepared: dict[str, Any] | None,
    result: dict[str, object],
) -> None:
    try:
        result["closure"] = owner.close()
        if prepared is not None:
            result["source_guard"] = final_source_guard(args, owner, prepared)
        if owner.pending_commands:
            raise ValueError("Unsettled owned command custody")
        shutil.rmtree(owner.work)
        if result["status"] == "UNREVIEWED_DOWNLOAD_ONLY_CANDIDATE_COMPLETE":
            candidate_manifest(args.inputs)
    except BaseException as error:
        result.update(status="FINALIZATION_FAILED", closure_error=type(error).__name__)
    write(owner.proof / "closure.json", result)


def main() -> int:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("package", "source", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--export-sha256", required=True)
    parser.add_argument("--expected-head", required=True)
    parser.add_argument("--package-build-head", required=True)
    parser.add_argument("--source-tree", required=True)
    args = parser.parse_args()
    require_host()
    if (
        not args.output.is_absolute()
        or args.output.exists()
        or args.output.is_symlink()
        or not args.package.is_absolute()
        or not args.source.is_absolute()
    ):
        raise ValueError("Absolute source/package and fresh absolute output required")
    if sha(args.package / "export.json") != args.export_sha256:
        raise ValueError("Explicit original package export differs")
    args.output.mkdir(mode=0o700)
    args.inputs = args.output / "inputs"
    args.inputs.mkdir(mode=0o700)
    args.proof = args.output / "preparation-proof"
    args.proof.mkdir()
    work = Path(tempfile.mkdtemp(prefix="japp-download-only-", dir=args.output.parent))
    owner = Owner(work, args.proof)
    owner.work_deadline = owner.started + 2400
    owner.cleanup_deadline = owner.work_deadline + 30
    result: dict[str, object] = {"status": "FAILED", "install_vm_product_actors": 0}
    prepared: dict[str, Any] = {}
    try:
        prepare_candidate(args, owner, prepared)
        result["status"] = "UNREVIEWED_DOWNLOAD_ONLY_CANDIDATE_COMPLETE"
    except Exception as error:
        result.update(error_type=type(error).__name__, message=str(error)[:512])
    finally:
        finish_candidate(args, owner, prepared or None, result)
    return 0 if result["status"] == "UNREVIEWED_DOWNLOAD_ONLY_CANDIDATE_COMPLETE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
