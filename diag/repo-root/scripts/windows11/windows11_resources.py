"""Finite unused-SDK cleanup on a disposable hosted runner, before media only."""

from __future__ import annotations

import shutil
import stat
import sys
from pathlib import Path
from typing import Any

from windows11_inputs import digest
from windows11_platform import require_linux

sys.path.insert(0, str(Path(__file__).parents[1] / "linux_gnome"))
from ubuntu_gnome_host import require_host
from ubuntu_gnome_vm import Owner, write

MIN_FREE = 48 * 1024**3
SDK_ROOTS = ("/usr/local/lib/android", "/usr/share/dotnet")
BASE_TOOLS = (
    "/usr/bin/git",
    "/usr/bin/apt-get",
    "/usr/bin/dpkg-deb",
    "/usr/bin/dpkg-query",
    "/usr/bin/sudo",
    "/usr/bin/rm",
    "/usr/bin/python3",
)


def validate_root(name: str, rows: list[dict[str, Any]]) -> None:
    """Reject links, noncanonical or non-root-owned ancestors without traversal."""
    if name not in SDK_ROOTS:
        raise ValueError("Only the two reviewed unused SDK roots are removable")
    expected = [str(path) for path in (Path(name), *Path(name).parents)]
    if [row["path"] for row in rows] != expected:
        raise ValueError("Exact complete root/ancestor metadata required")
    for row in rows:
        if not stat.S_ISDIR(row["mode"]) or row["uid"] != 0 or row["mode"] & 0o022:
            raise ValueError("Root-owned non-writable real directories required")
        if row["resolved"] != row["path"]:
            raise ValueError("Canonical SDK root and ancestors required")


def root_rows(name: str) -> list[dict[str, Any]]:
    root = Path(name)
    result = []
    for path in (root, *root.parents):
        info = path.lstat()
        result.append(
            {
                "path": str(path),
                "resolved": str(path.resolve(strict=True)),
                "mode": info.st_mode,
                "uid": info.st_uid,
                "device": info.st_dev,
                "inode": info.st_ino,
            }
        )
    validate_root(name, result)
    return result


def tool_baseline() -> dict[str, Any]:
    result = {}
    # Symlinked executable aliases are recorded as aliases and exact final bytes.
    for name in (*BASE_TOOLS, sys.executable):
        path = Path(name)
        target = path.resolve(strict=True)
        result[name] = {
            "target": str(target),
            "sha256": digest(target),
            "link": str(path.readlink()) if path.is_symlink() else None,
        }
    return result


def absent(name: str) -> bool:
    try:
        Path(name).lstat()
    except FileNotFoundError:
        return True
    return False


def ensure_capacity(owner: Owner) -> dict[str, Any]:
    require_linux()
    require_host()
    row: dict[str, Any] = {
        "schema": "japp-win11-host-capacity-v1",
        "minimum_free_bytes": MIN_FREE,
        "removed": [],
        "roots_before": {},
        "roots_after": {},
        "status": "FAILED",
    }
    try:
        row["tools_before"] = tool_baseline()
        row["free_before"] = shutil.disk_usage(owner.work).free
        if row["free_before"] < MIN_FREE:
            for name in SDK_ROOTS:
                if shutil.disk_usage(owner.work).free >= MIN_FREE:
                    break
                path = Path(name)
                try:
                    rows = root_rows(name)
                except FileNotFoundError:
                    # lstat distinguishes a genuinely absent root from a dangling link.
                    if not absent(name):
                        raise ValueError("Unresolved SDK root refused") from None
                    row["roots_before"][name] = {"absent": True}
                    continue
                if any(
                    path == owned or path in owned.parents
                    for owned in (
                        owner.work.resolve(strict=True),
                        owner.proof.resolve(strict=True),
                    )
                ):
                    raise ValueError("SDK root contains owned campaign data")
                row["roots_before"][name] = rows
                # Fixed allowlist only, no shell/glob, never a caller-supplied target.
                owner.command(
                    [
                        "/usr/bin/sudo",
                        "-n",
                        "/usr/bin/rm",
                        "-rf",
                        "--one-file-system",
                        "--",
                        name,
                    ],
                    seconds=120,
                )
                if not absent(name):
                    raise ValueError("Unused SDK root was not completely removed")
                row["removed"].append(name)
                row["roots_after"][name] = {"absent": True}
        row["free_after"] = shutil.disk_usage(owner.work).free
        row["tools_after"] = tool_baseline()
        if row["tools_before"] != row["tools_after"]:
            raise ValueError("Required host tool baseline drifted during cleanup")
        if row["free_after"] < MIN_FREE:
            raise ValueError(
                "Actual physical free space remains below 48GiB before media"
            )
        row["status"] = "CAPACITY_OBSERVED"
        return row
    except BaseException as error:
        row["error_type"] = type(error).__name__
        raise
    finally:
        write(owner.proof / "host-resource-cleanup.json", row)
