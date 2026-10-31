"""Download-only Windows11 candidate; no host install, VM or payload execution."""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import sys
import time
import urllib.request
from http.client import HTTPMessage
from pathlib import Path
from typing import IO, Any

from windows11_inputs import (
    MEDIA,
    MEDIA_CAP,
    MEDIA_SHA256,
    PUBLISHER,
    digest,
    document,
    host_cpu,
    official_url,
    original_package,
    publisher_digest,
    retain,
)
from windows11_platform import require_linux
from windows11_resources import ensure_capacity

sys.path.insert(0, str(Path(__file__).parents[1] / "linux_gnome"))
from ubuntu_gnome_host import require_host
from ubuntu_gnome_prepare import resolve
from ubuntu_gnome_vm import Owner, write

HTTP_OK = 200
BUNDLE_MEMBERS = 6000
RUNNER_IMAGE_VERSION = "ImageVersion"
HOST_ROOTS = (
    "qemu-system-x86",
    "qemu-utils",
    "ovmf",
    "swtpm",
    "swtpm-tools",
    "xorriso",
    "mtools",
    "wimtools",
    "acl",
    "python3",
)
TOOLS = {
    "qemu": "/usr/bin/qemu-system-x86_64",
    "qemu_img": "/usr/bin/qemu-img",
    "swtpm": "/usr/bin/swtpm",
    "xorriso": "/usr/bin/xorriso",
    "mformat": "/usr/bin/mformat",
    "mcopy": "/usr/bin/mcopy",
    "wimlib": "/usr/bin/wimlib-imagex",
    "setfacl": "/usr/bin/setfacl",
}
FIRMWARE = {
    "code": "/usr/share/OVMF/OVMF_CODE_4M.secboot.fd",
    "vars": "/usr/share/OVMF/OVMF_VARS_4M.ms.fd",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        _req: urllib.request.Request,
        _fp: IO[bytes],
        _code: int,
        _msg: str,
        _headers: HTTPMessage,
        _newurl: str,
    ) -> None:
        raise ValueError("Media metadata/login/origin redirect refused")


def download(url: str, destination: Path, cap: int, deadline: float) -> dict[str, Any]:
    official_url(url)
    start = time.monotonic()
    if start >= deadline:
        raise TimeoutError("Publisher download authority expired")
    h = hashlib.sha256()
    total = 0
    opener = urllib.request.build_opener(NoRedirect())
    with opener.open(url, timeout=15) as response, destination.open("xb") as output:
        if response.geturl() != url or response.status != HTTP_OK:
            raise ValueError("Exact public publisher response required; no login")
        declared = response.headers.get("Content-Length")
        if declared is not None and (not declared.isdecimal() or int(declared) > cap):
            raise ValueError("Publisher input content length exceeds cap")
        while block := response.read(1024 * 1024):
            if time.monotonic() >= deadline:
                raise TimeoutError("Bounded publisher download expired")
            total += len(block)
            if total > cap:
                raise ValueError("Publisher input exceeds cap")
            h.update(block)
            output.write(block)
    if declared is not None and total != int(declared):
        raise ValueError("Publisher input length changed")
    return {
        "url": url,
        "bytes": total,
        "sha256": h.hexdigest(),
        "seconds": time.monotonic() - start,
        "authenticated_account_used": False,
    }


def source_binding(
    source: Path,
    owner: Owner,
    expected: str,
    package: dict[str, Any],
    *,
    cleanup: bool = False,
) -> dict[str, Any]:
    values = (
        owner.command(
            ["/usr/bin/git", "-C", str(source), "rev-parse", "HEAD", "HEAD^{tree}"],
            cleanup=cleanup,
        )
        .decode()
        .splitlines()
    )
    if values != [expected, package["source"]["tree"]] or owner.command(
        [
            "/usr/bin/git",
            "-C",
            str(source),
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ],
        cleanup=cleanup,
    ):
        raise ValueError(
            "Reviewed source S must be clean and have original tested tree T"
        )
    names = (
        owner.command(
            ["/usr/bin/git", "-C", str(source), "ls-files", "-z"],
            cap=1024 * 1024,
            cleanup=cleanup,
        )
        .decode()
        .rstrip("\0")
        .split("\0")
    )
    if set(names) != set(package["source"]["files"]):
        raise ValueError("Complete tested source inventory differs")
    rows = {}
    for name in names:
        path = source / name
        expected_row = package["source"]["files"][name]
        if (
            digest(path) != expected_row["sha256"]
            or path.stat().st_size != expected_row["bytes"]
        ):
            raise ValueError("Original tested source body differs")
        rows[name] = {
            "bytes": path.stat().st_size,
            "sha256": digest(path),
            "mode": oct(path.stat().st_mode),
        }
    return {"git": values, "files": rows}


def tool_pin(root: Path, name: str) -> dict[str, Any]:
    path = root / name.removeprefix("/")
    link = None
    target = name
    if path.is_symlink():
        link = str(path.readlink())
        if name not in ("/usr/bin/mformat", "/usr/bin/mcopy") or link != "mtools":
            raise ValueError("Only exact reviewed mtools aliases are accepted")
        target = "/usr/bin/mtools"
    actual = root / target.removeprefix("/")
    if actual.resolve(strict=True) != actual.absolute():
        raise ValueError(
            "Host tool target must remain an unaliased contained regular file"
        )
    return {"path": name, "link": link, "target": target, "sha256": digest(actual)}


def stage_host(owner: Owner, closure: Path, lock: dict[str, Any], output: Path) -> None:
    extracted = owner.work / "host-extracted"
    extracted.mkdir()
    for row in lock["packages"]:
        owner.command(
            [
                "/usr/bin/dpkg-deb",
                "-x",
                str(closure / "debs" / row["filename"]),
                str(extracted),
            ],
            seconds=15,
        )
    tools = {
        name: tool_pin(extracted, path) for name, path in {**TOOLS, **FIRMWARE}.items()
    }
    shutil.copytree(closure / "debs", output / "host-debs")
    shutil.copytree(closure / "signed-metadata", output / "host-signed-metadata")
    write(
        output / "host-tools-lock.json",
        {
            "schema": "japp-win11-host-tools-v1",
            "review_state": "UNREVIEWED",
            "runner_image_version": os.environ.get(RUNNER_IMAGE_VERSION),
            "tools": tools,
            "packages": lock["packages"],
            "signed_index_chain": lock["signed_index_chain"],
        },
    )


def main() -> int:  # noqa: PLR0912, PLR0915 - one custody/endpoint bracket
    require_linux()
    require_host()
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "artifact", "output", "guest-source-checks"):
        parser.add_argument("--" + name, required=True, type=Path)
    for name in (
        "expected-head",
        "package-build-head",
        "source-tree",
        "manifest-sha256",
    ):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    if (
        not all(p.is_absolute() for p in (args.source, args.artifact, args.output))
        or args.output.exists()
    ):
        raise ValueError("Absolute reviewed source/artifact and fresh output required")
    args.output.mkdir(mode=0o700)
    inputs = args.output / "inputs"
    inputs.mkdir()
    work = args.output / "private-work"
    work.mkdir(mode=0o700)
    owner = Owner(work, args.output)
    owner.work_deadline = owner.started + 2100
    owner.cleanup_deadline = owner.work_deadline + 45
    result: dict[str, Any] = {
        "status": "CANDIDATE_FAILED",
        "install_vm_product_actors": 0,
    }
    before: dict[str, Any] | None = None
    package: dict[str, Any] | None = None
    try:
        package = original_package(
            args.artifact,
            args.manifest_sha256,
            args.package_build_head,
            args.source_tree,
        )
        source_checks = document(args.guest_source_checks)
        expected_names = {
            "windows11_source_check.ps1",
            "windows11_bootstrap.ps1",
            "windows11_guest.ps1",
            "windows11_owned.cs",
        }
        if (
            source_checks["schema"] != "japp-win11-target-source-check-v1"
            or source_checks["status"]
            != "WINDOWS_POWERSHELL51_PARSE_AND_CS_COMPILE_PASS"
            or source_checks["native_API_calls"] != 0
            or source_checks["VMs"] != 0
            or source_checks["product_launches"] != 0
            or source_checks["Windows11_acceptance"] is not False
            or set(source_checks["files"]) != expected_names
        ):
            raise ValueError(
                "Actual target source-only parser/compiler receipt required"
            )
        for name in expected_names:
            original = Path(__file__).with_name(name)
            if source_checks["files"][name] != {
                "bytes": original.stat().st_size,
                "sha256": digest(original),
            }:
                raise ValueError("Target source-check body binding differs")
        shutil.copyfile(args.guest_source_checks, inputs / "guest-source-check.json")
        before = source_binding(args.source, owner, args.expected_head, package)
        write(args.output / "source-before.json", before)
        publisher = work / "publisher.html"
        result["resource_preflight"] = ensure_capacity(owner)
        publisher_receipt = download(
            PUBLISHER, publisher, 2 * 1024**2, owner.work_deadline
        )
        publisher_digest(publisher.read_text())
        shutil.copyfile(publisher, inputs / "publisher.html")
        iso = work / "windows11.iso"
        actual_media = download(MEDIA, iso, MEDIA_CAP, owner.work_deadline)
        write(args.output / "media-download.json", actual_media)
        if actual_media["sha256"] != MEDIA_SHA256:
            raise ValueError("Actual ISO differs from official publisher digest")
        write(
            inputs / "media-lock.json",
            {
                "schema": "japp-win11-media-lock-v1",
                "review_state": "UNREVIEWED",
                "publisher": publisher_receipt,
                "host_cpu_requires_different_official_support_review": host_cpu(),
                "media": actual_media,
                "iso_retained_in_artifact": False,
                "subsequent_campaign_must_redownload_identical_digest": True,
                "installation_and_native_OS_not_observed": True,
            },
        )
        host = work / "host-candidate"
        lock = resolve(owner, work / "apt", host, HOST_ROOTS)
        stage_host(owner, host, lock, inputs)
        shutil.copytree(args.artifact, inputs / "original-native-artifact")
        driver = inputs / "guest-driver"
        driver.mkdir()
        for name in (
            "windows11_guest.ps1",
            "windows11_owned.cs",
            "windows11_bootstrap.ps1",
        ):
            shutil.copyfile(Path(__file__).with_name(name), driver / name)
        write(
            inputs / "guest-driver.json",
            {
                "schema": "japp-win11-guest-driver-v1",
                "files": {
                    name: {
                        "bytes": (driver / name).stat().st_size,
                        "sha256": digest(driver / name),
                    }
                    for name in (
                        "windows11_guest.ps1",
                        "windows11_owned.cs",
                        "windows11_bootstrap.ps1",
                    )
                },
            },
        )
        after = source_binding(args.source, owner, args.expected_head, package)
        if before != after:
            raise ValueError("Source changed during download preparation")
        write(args.output / "source-after.json", after)
        rows = {
            str(p.relative_to(inputs)): {"bytes": p.stat().st_size, "sha256": digest(p)}
            for p in sorted(inputs.rglob("*"))
            if p.is_file()
        }
        if (
            len(rows) > BUNDLE_MEMBERS
            or sum(r["bytes"] for r in rows.values()) > 2 * 1024**3
        ):
            raise ValueError("Finite candidate retained input cap exceeded")
        write(
            inputs / "reviewed-inputs.json",
            {
                "schema": "japp-win11-reviewed-inputs-v1",
                "review_state": "UNREVIEWED_REQUIRES_DIFFERENT_REVIEW_AND_ROOT_RELEASE",
                "source_sha": args.expected_head,
                "package_build_sha": args.package_build_head,
                "source_tree_sha": args.source_tree,
                "package_manifest_sha256": args.manifest_sha256,
                "files": rows,
            },
        )
        result["status"] = "DOWNLOAD_ONLY_UNREVIEWED_CANDIDATE_COMPLETE"
    except Exception as error:
        result.update(error_type=type(error).__name__, message=str(error)[:512])
    finally:
        if before is not None and package is not None:
            try:
                endpoint = source_binding(
                    args.source, owner, args.expected_head, package, cleanup=True
                )
                write(args.output / "source-finally.json", endpoint)
                if endpoint != before:
                    raise ValueError("Source changed during candidate preparation")
            except BaseException as error:
                result.update(
                    status="SOURCE_ENDPOINT_FAILURE",
                    endpoint_error=type(error).__name__,
                )
        try:
            result["closure"] = owner.close()
        except BaseException as error:
            result.update(
                status="OWNED_COMMAND_CLEANUP_FAILURE",
                cleanup_error=type(error).__name__,
            )
        if owner.pending_commands or "cleanup_error" in result:
            result["status"] = "UNSETTLED_OWN_COMMAND_CUSTODY"
        else:
            try:
                shutil.rmtree(work)
            except BaseException as error:
                result.update(
                    status="OWNED_WORK_CLEANUP_FAILURE",
                    work_cleanup_error=type(error).__name__,
                )
        write(args.output / "closure.json", result)
        try:
            retain(args.output, inputs=True)
        except Exception as error:
            result.update(
                status="RETENTION_FAILED", retention_error=type(error).__name__
            )
            write(args.output / "retention-failure.json", result)
    return 0 if result["status"] == "DOWNLOAD_ONLY_UNREVIEWED_CANDIDATE_COMPLETE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
