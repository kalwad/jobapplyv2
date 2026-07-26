#!/usr/bin/env python3
"""Shared cross-platform execution helpers (M00-W09, spec §5.14.4, REQ-PLAT-025).

This is the single module in the repository scripts that is allowed to
contain platform-conditional PATH/executable semantics. The environment
doctor, the verification runner, and the portability policy checker resolve
child executables through :func:`resolve_executable` instead of assuming
POSIX behavior:

- Windows resolves bare command names through ``PATHEXT`` (``pnpm`` ->
  ``pnpm.CMD``, ``cargo`` -> ``cargo.exe``), accepts ``\\`` and ``/``
  separators plus drive letters, matches names case-insensitively on its
  case-insensitive filesystems, and has no executable permission bit.
- POSIX resolves the exact name only and requires the execute bit.

Every input is injectable (platform flavor, PATH entries, PATHEXT, and the
file-existence probe) so Windows semantics are testable from any host
without modifying the host machine (M00-W09 §E/§I). Runtime callers use the
``host_*`` helpers, which feed the real process environment into the same
pure logic and then execute the resolved absolute path — deliberately never
the current working directory, so a repository-local file can not shadow a
toolchain command.
"""

from __future__ import annotations

import ntpath
import os
import posixpath
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

PLATFORM_MACOS = "macos"
PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"
PLATFORM_IDS = (PLATFORM_MACOS, PLATFORM_WINDOWS, PLATFORM_LINUX)

# CreateProcess/cmd.exe default when PATHEXT is unset. Script hosts
# (.JS/.WSF/...) are deliberately excluded: repository tooling only ever
# expects native executables and the Node/Python launcher shims.
WINDOWS_DEFAULT_PATHEXT = (".COM", ".EXE", ".BAT", ".CMD")


def is_windows_host() -> bool:
    """True when the current interpreter runs on Windows."""
    return os.name == "nt"


def detect_platform_id() -> str:
    """Map the current host to the doctor's platform vocabulary."""
    if is_windows_host():
        return PLATFORM_WINDOWS
    # Widen deliberately: mypy specializes sys.platform to the analysis
    # host, but this function must describe every supported host.
    host: str = sys.platform
    if host == "darwin":
        return PLATFORM_MACOS
    return PLATFORM_LINUX


def _default_probe(is_windows: bool) -> Callable[[str], bool]:
    if is_windows:

        def probe(candidate: str) -> bool:
            # Windows has no executable permission bit; existence of the
            # (PATHEXT-derived) file is the execution criterion.
            return Path(candidate).is_file()

    else:

        def probe(candidate: str) -> bool:
            return Path(candidate).is_file() and os.access(candidate, os.X_OK)

    return probe


def resolve_executable(
    command: str,
    *,
    is_windows: bool,
    path_entries: Sequence[str],
    pathext: Sequence[str] = (),
    probe: Callable[[str], bool] | None = None,
) -> str | None:
    """Resolve ``command`` the way the target platform's loader would.

    Pure lexical logic: Windows candidates are built with ``ntpath`` and
    POSIX candidates with ``posixpath``, so Windows resolution (drive
    letters, backslashes, ``PATHEXT`` suffixes, case-insensitive extension
    matching) is exercised identically on every host. Returns the first
    candidate accepted by ``probe`` (host filesystem semantics by default),
    or ``None`` when nothing resolves — never a guess.
    """
    pathmod = ntpath if is_windows else posixpath
    active_probe = probe if probe is not None else _default_probe(is_windows)

    def candidates_for(base: str) -> tuple[str, ...]:
        if not is_windows:
            return (base,)
        extensions = tuple(ext for ext in (pathext or WINDOWS_DEFAULT_PATHEXT) if ext)
        if any(base.lower().endswith(ext.lower()) for ext in extensions):
            return (base,)
        return tuple(base + ext for ext in extensions)

    if pathmod.dirname(command):
        # Explicit paths (absolute, drive-qualified, or with any directory
        # component) are probed directly and never searched on PATH.
        bases: tuple[str, ...] = (command,)
    else:
        bases = tuple(
            pathmod.join(entry, command) for entry in path_entries if entry.strip()
        )

    for base in bases:
        for candidate in candidates_for(base):
            if active_probe(candidate):
                return candidate
    return None


def host_path_entries() -> tuple[str, ...]:
    """The current process PATH, split with the host separator."""
    return tuple(os.environ.get("PATH", "").split(os.pathsep))


def host_pathext() -> tuple[str, ...]:
    """The effective PATHEXT list on Windows; empty elsewhere."""
    if not is_windows_host():
        return ()
    raw = os.environ.get("PATHEXT", "")
    entries = tuple(ext for ext in raw.split(";") if ext)
    return entries or WINDOWS_DEFAULT_PATHEXT


def host_resolve_executable(command: str) -> str | None:
    """Resolve ``command`` against the real host PATH/PATHEXT."""
    return resolve_executable(
        command,
        is_windows=is_windows_host(),
        path_entries=host_path_entries(),
        pathext=host_pathext(),
    )
