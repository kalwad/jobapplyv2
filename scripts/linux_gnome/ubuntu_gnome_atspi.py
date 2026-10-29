"""Narrow typed view of the exact GI APIs used by the disposable guest.

These Protocols describe the documented GIO/AT-SPI2 call boundary. They are
source typing, not a mock implementation or proof that GI exists on a host.
The real platform modules load only when an actual guest controller starts.
"""

from __future__ import annotations

import importlib
from typing import Protocol, cast

from ubuntu_gnome_platform import require_linux


class Text(Protocol):
    def get_character_count(self) -> int: ...
    def get_text(self, start: int, end: int) -> str: ...


class Action(Protocol):
    def get_n_actions(self) -> int: ...
    def get_name(self, index: int) -> str: ...
    def do_action(self, index: int) -> bool: ...


class Component(Protocol):
    def grab_focus(self) -> bool: ...


class StateSet(Protocol):
    def contains(self, state: object) -> bool: ...


class Accessible(Protocol):
    def get_child_count(self) -> int: ...
    def get_child_at_index(self, index: int) -> Accessible: ...
    def get_process_id(self) -> int: ...
    def get_name(self) -> str: ...
    def get_role_name(self) -> str: ...
    def get_text_iface(self) -> Text | None: ...
    def get_action_iface(self) -> Action | None: ...
    def get_component_iface(self) -> Component | None: ...
    def get_state_set(self) -> StateSet: ...


class States(Protocol):
    FOCUSED: object


class Atspi(Protocol):
    StateType: States

    def set_timeout(self, normal_ms: int, startup_ms: int) -> None: ...
    def get_desktop(self, index: int) -> Accessible: ...


class LaunchInfo(Protocol):
    def launch(self, files: list[object], context: None) -> bool: ...


class AppInfoFactory(Protocol):
    def create_from_commandline(
        self, commandline: str, name: str, flags: object
    ) -> LaunchInfo | None: ...


class DesktopInfoFactory(Protocol):
    def new_from_filename(self, filename: str) -> LaunchInfo | None: ...


class Flags(Protocol):
    NONE: object


class Gio(Protocol):
    AppInfo: AppInfoFactory
    DesktopAppInfo: DesktopInfoFactory
    AppInfoCreateFlags: Flags


class RequireVersion(Protocol):
    def require_version(self, namespace: str, version: str) -> None: ...


def load_native() -> tuple[Atspi, Gio]:
    require_linux()
    gi = cast(RequireVersion, importlib.import_module("gi"))
    gi.require_version("Atspi", "2.0")
    gi.require_version("Gio", "2.0")
    atspi = cast(Atspi, importlib.import_module("gi.repository.Atspi"))
    gio = cast(Gio, importlib.import_module("gi.repository.Gio"))
    atspi.set_timeout(800, 5000)
    return atspi, gio
