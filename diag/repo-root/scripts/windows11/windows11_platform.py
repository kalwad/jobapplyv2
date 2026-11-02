"""Host boundary for disposable Linux evidence infrastructure only.

Imports and pure helper tests are host neutral. Executable CLI/native entry
points must refuse every other host before parsing inputs or starting actors.
"""

from __future__ import annotations

import sys


def require_linux() -> None:
    if sys.platform != "linux":
        raise RuntimeError(
            "Windows11 hosted validation evidence infrastructure requires Linux"
        )
