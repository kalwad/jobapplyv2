"""Finite safe regular-file curation; VM disks/keys/bootstrap stay excluded."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import stat
from pathlib import Path
from typing import TypedDict

FILE_CAP = 8 * 1024 * 1024
FRAME_CAP = 4 * 1024 * 1024
TOTAL_CAP = 128 * 1024 * 1024
MAX_FILES = 4096
SAFE_NAME = re.compile(r"[a-z0-9_-]+\.(?:json|stdout|stderr|ppm)\Z")


class ProofRecord(TypedDict):
    path: str
    bytes: int
    mode: int
    sha256: str


def record(path: Path) -> ProofRecord:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > FILE_CAP:
        raise ValueError("Finite regular proof file required")
    data = path.read_bytes()
    after = path.lstat()
    if (
        before.st_dev,
        before.st_ino,
        before.st_size,
        before.st_mtime_ns,
        before.st_mode,
        before.st_uid,
        before.st_gid,
    ) != (
        after.st_dev,
        after.st_ino,
        after.st_size,
        after.st_mtime_ns,
        after.st_mode,
        after.st_uid,
        after.st_gid,
    ) or len(data) != before.st_size:
        raise ValueError("Proof file changed while retaining")
    if b"-----BEGIN " in data and b"PRIVATE KEY-----" in data:
        raise ValueError("Private key material is never an evidence member")
    return {
        "path": path.name,
        "bytes": len(data),
        "mode": stat.S_IMODE(before.st_mode),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def inventory(proof: Path) -> list[ProofRecord]:
    paths = list(proof.iterdir())
    if len(paths) > MAX_FILES:
        raise ValueError("Proof file count exceeds cap")
    result = []
    total = 0
    for path in sorted(paths):
        if path.name == "retained":
            raise ValueError("Fresh retention directory required")
        if SAFE_NAME.fullmatch(path.name) is None:
            raise ValueError("Unknown proof filename is not retainable")
        row = record(path)
        size = row["bytes"]
        if path.suffix == ".ppm" and size > FRAME_CAP:
            raise ValueError("Frame exceeds retention cap")
        total += size
        if total > TOTAL_CAP:
            raise ValueError("Finite total proof cap exceeded")
        result.append(row)
    return result


def retain(proof: Path) -> dict[str, object]:
    rows = inventory(proof)
    destination = proof / "retained"
    destination.mkdir(mode=0o700)
    for row in rows:
        name = str(row["path"])
        source, target = proof / name, destination / name
        shutil.copy2(source, target)
        if record(source) != row or record(target) != row:
            raise ValueError("Evidence input changed during exact retention")
    total = sum(row["bytes"] for row in rows)
    manifest = {
        "scope": "FINITE_REGULAR_PROOF_ONLY_NO_DISKS_KEYS_SEED_OR_BOOTSTRAP",
        "files": rows,
        "bytes": total,
        "count": len(rows),
        "total_cap_bytes": TOTAL_CAP,
    }
    data = (json.dumps(manifest, indent=2) + "\n").encode()
    if len(data) + total > TOTAL_CAP:
        raise ValueError("Retention manifest would exceed finite proof cap")
    (destination / "retention-manifest.json").write_bytes(data)
    return {
        "status": "FINITE_RETENTION_PASS",
        "files": len(rows),
        "bytes": manifest["bytes"],
        "manifest_sha256": hashlib.sha256(data).hexdigest(),
    }
