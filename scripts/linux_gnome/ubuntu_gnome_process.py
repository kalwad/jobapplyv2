"""Cleanup-only custody for an exact newly spawned child, never a reaped PID.

No child is started by this module. Callers attach custody immediately after
Popen succeeds, before getpgid, observers or other fallible setup work.
"""

from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass


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
