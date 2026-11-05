"""Cleanup-only custody for an exact newly spawned child, never a reaped PID.

No child is started by this module. Callers attach custody immediately after
Popen succeeds, before getpgid, observers or other fallible setup work.
"""

from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path


def local_only_apt(scratch: Path) -> list[str]:
    """apt-get options under which APT knows no repository at all.

    apt-get --no-download also refuses archives named as local files (apt 2.8,
    KI-0148). With an empty source list and empty package lists every archive
    must be a named local file, and an unprovided dependency is an unmet
    dependency failure, never a download of an unreviewed version.
    """
    sources = scratch / "apt-no-sources"
    lists = scratch / "apt-no-lists"
    sources.mkdir(mode=0o700)
    lists.mkdir(mode=0o700)
    (lists / "partial").mkdir(mode=0o700)
    return [
        "-o",
        "Dir::Etc::SourceList=/dev/null",
        "-o",
        "Dir::Etc::SourceParts=" + str(sources),
        "-o",
        "Dir::State::Lists=" + str(lists),
        "-o",
        "Dir::Cache::pkgcache=",
        "-o",
        "Dir::Cache::srcpkgcache=",
    ]


@dataclass
class ChildCustody:
    child: subprocess.Popen[bytes]
    pgid: int
    group_verified: bool = False
    signals: list[str] | None = None

    def is_reaped(self) -> bool:
        return self.child.returncode is not None

    def terminate_unreaped(self) -> None:
        if self.signals is None:
            self.signals = []
        if self.is_reaped():
            return
        for sig, seconds in ((signal.SIGTERM, 2), (signal.SIGKILL, 3)):
            if self.is_reaped():
                break
            try:
                if self.group_verified:
                    os.killpg(self.pgid, sig)
                else:
                    # An exception before getpgid confirmation leaves only
                    # exact direct-child authority, never guessed group power.
                    self.child.send_signal(sig)
                self.signals.append(sig.name)
            except ProcessLookupError:
                pass
            try:
                self.child.wait(timeout=seconds)
            except subprocess.TimeoutExpired:
                continue
        if self.child.returncode is None:
            raise TimeoutError("Owned child remains retained and unreaped")
