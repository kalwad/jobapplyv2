"""Narrow typed view of the exact GI APIs used by the disposable guest.

These Protocols describe the documented GIO/AT-SPI2 call boundary. They are
source typing, not a mock implementation or proof that GI exists on a host.
The real platform modules load only when an actual guest controller starts.
"""

from __future__ import annotations

import importlib
from typing import Protocol, cast

from ubuntu_gnome_platform import require_linux


class Rect(Protocol):
    x: int
    y: int
    width: int
    height: int


class TextRange(Protocol):
    start_offset: int
    end_offset: int


class Text(Protocol):
    def get_character_count(self) -> int: ...
    def get_text(self, start: int, end: int) -> str: ...
    def get_character_extents(self, offset: int, coordinates: object) -> Rect: ...
    def get_string_at_offset(self, offset: int, granularity: object) -> TextRange: ...


class Action(Protocol):
    # PyGObject returns the Accessible itself as its Action interface, so the
    # Action name is get_action_name; get_name(index) is Accessible.get_name.
    def get_n_actions(self) -> int: ...
    def get_action_name(self, index: int) -> str: ...
    def do_action(self, index: int) -> bool: ...


class Component(Protocol):
    def grab_focus(self) -> bool: ...
    def get_extents(self, coordinates: object) -> Rect: ...
    def scroll_to(self, placement: object) -> bool: ...


class StateSet(Protocol):
    def contains(self, state: object) -> bool: ...


class Accessible(Protocol):
    def clear_cache(self) -> None: ...
    def get_attributes(self) -> dict[str, str]: ...
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
    ACTIVE: object
    VISIBLE: object
    SHOWING: object


class Coordinates(Protocol):
    SCREEN: object


class Granularity(Protocol):
    LINE: object


class Scroll(Protocol):
    TOP_EDGE: object


class Atspi(Protocol):
    CoordType: Coordinates
    TextGranularity: Granularity
    ScrollType: Scroll
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


class BusTypes(Protocol):
    SESSION: object


class BusFlags(Protocol):
    NO_AUTO_START: object


class Variant(Protocol):
    def unpack(self) -> object: ...


class Connection(Protocol):
    def call_sync(  # noqa: PLR0913, PLR0917 - exact documented GIO foreign API
        self,
        bus: str,
        path: str,
        interface: str,
        method: str,
        parameters: None,
        reply_type: None,
        flags: object,
        timeout: int,
        cancellable: None,
    ) -> Variant: ...


class Gio(Protocol):
    BusType: BusTypes
    DBusCallFlags: BusFlags

    def bus_get_sync(self, bus_type: object, cancellable: None) -> Connection: ...

    AppInfo: AppInfoFactory
    DesktopAppInfo: DesktopInfoFactory
    AppInfoCreateFlags: Flags


class GLib(Protocol):
    Error: object


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


def native_error() -> type[Exception]:
    """gi's GLib.Error, which a failed AT-SPI or D-Bus call raises."""
    require_linux()
    gi = cast(RequireVersion, importlib.import_module("gi"))
    gi.require_version("GLib", "2.0")
    glib = cast(GLib, importlib.import_module("gi.repository.GLib"))
    error: object = glib.Error
    # PyGObject defines GLib.Error as a RuntimeError subclass, so it is never
    # mistaken for the TimeoutError of expired operation authority.
    if not isinstance(error, type) or not issubclass(error, RuntimeError):
        raise TypeError("PyGObject GLib.Error must be a RuntimeError subclass")
    return error
