"""GNOME campaign runtime contracts from the a5ec1e3 pre-flight audit.

The pinned product installs File > Quit with Ctrl+Q on Linux, so both are
exercised like the Windows quit and accelerator phases; the window and keyboard
focus recorded just before the chord is named by a failed Ctrl+Q close, and only
a record that proved the same app alive at its end lets one close count. AT-SPI
GLib.Error is a transient 'not yet' while expired operation authority always
propagates. Only the --serve controller writes controller-failure.json, and its
deadline and unready-session exits leave a bounded marker. A failed
provisioning step, or an input mount that never happened, leaves its own
receipt for the host, which fails fast on it, and a failed campaign keeps one
validated frame, a guest journal, every listed receipt and a scanned serial
tail. Pure fakes only; no GI, subprocess, socket, apt or VM.
"""

from __future__ import annotations

import ast
import hashlib
import importlib
import importlib.util
import json
import os
import shlex
import stat
import sys
import time
from collections.abc import Callable
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import IO, Any

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
sys.path.insert(0, str(SOURCE))
# Assembled at runtime: no key-shaped literal lives in this repository.
KEY_MARKER = b"-----BEGIN " + b"OPENSSH " + b"PRIVATE" + b" KEY-----"
READY_NAMES = (
    "Local service",
    "Service status",
    "Ready",
    "Service version",
    "0.0.1",
    "API version",
    "1.0.0",
    "Checked at",
)


def load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def guest() -> ModuleType:
    return load("ubuntu_gnome_guest")


@pytest.fixture
def vm(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    module = load("ubuntu_gnome_vm")
    monkeypatch.setattr(module.time, "sleep", lambda _seconds: None)
    return module


class GLibError(RuntimeError):
    """Shaped like PyGObject's GLib.Error: a RuntimeError, never an OSError."""


def controller(guest: ModuleType, seconds: float = 60) -> Any:  # noqa: ANN401 - Controller without GI
    value = object.__new__(guest.Controller)
    value.work_deadline = value.operation_deadline = time.monotonic() + seconds
    value.port, value.listeners = 43210, []
    value.native_error = GLibError
    value.app = {"pid": 4242, "starttime_ticks": 1}
    value.service = {"pid": 4343, "starttime_ticks": 2}
    value.checked_at = None
    value.accelerator_focus = None
    value.atspi = SimpleNamespace(
        StateType=SimpleNamespace(
            FOCUSED="focused", SHOWING="showing", VISIBLE="visible", ACTIVE="active"
        )
    )
    return value


def ready_rows() -> list[dict[str, Any]]:
    rows = [{"name": name, "text": ""} for name in READY_NAMES]
    return [*rows, {"name": "", "text": "2026-10-31T00:00:00Z"}]


def failing_then(
    failures: list[BaseException], value: object = None
) -> Callable[..., Any]:
    def step(*_args: object, **_kwargs: object) -> object:
        if failures:
            raise failures.pop(0)
        return value

    return step


def test_glib_error_in_readiness_poll_is_retried_within_the_deadline(
    guest: ModuleType,
) -> None:
    value = controller(guest)
    value.refresh = failing_then([GLibError("accessible destroyed in re-render")])
    value.tree = lambda: (ready_rows(), [])
    assert value.await_ready()["checked_at"] == "2026-10-31T00:00:00Z"


def test_expired_authority_inside_readiness_poll_propagates_at_once(
    guest: ModuleType,
) -> None:
    value = controller(guest, seconds=0.5)
    calls: list[int] = []

    def expired() -> None:
        calls.append(1)
        raise TimeoutError("Guest operation work authority expired")

    value.refresh = expired
    with pytest.raises(TimeoutError, match="work authority expired"):
        value.await_ready()
    assert calls == [1]


class Launcher:
    def launch(self, _files: list[object], _context: None) -> bool:
        return True


@pytest.mark.parametrize(
    ("failure", "expected"),
    [
        (GLibError("AT-SPI call timed out"), None),
        (TimeoutError("Guest operation work authority expired"), TimeoutError),
    ],
    ids=["glib-error", "expired-authority"],
)
def test_launch_retries_glib_error_but_not_expired_authority(
    guest: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    failure: BaseException,
    expected: type[BaseException] | None,
) -> None:
    monkeypatch.setattr(guest, "matching_processes", lambda _path: [])
    monkeypatch.setattr(guest.os, "environ", {"HOME": "/home/japp-ci"})
    value = controller(guest, seconds=0.5)
    value.gio = SimpleNamespace(
        DesktopAppInfo=SimpleNamespace(new_from_filename=lambda _name: Launcher())
    )
    value.refresh = lambda: None
    actions: list[tuple[str, str]] = []

    def action(name: str, role: str) -> None:
        actions.append((name, role))
        if len(actions) == 1:
            raise failure

    value.action = action
    value.await_ready = lambda: {"ready": True}
    if expected is None:
        assert value.launch() == {"ready": True}
        assert actions == [("Open Diagnostics", "link"), ("Open Diagnostics", "link")]
    else:
        with pytest.raises(expected, match="work authority expired"):
            value.launch()
        assert actions == [("Open Diagnostics", "link")]


def test_service_restart_retries_glib_error_until_replacement(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(guest, "exact_kill", lambda identity: {"killed": identity})
    value = controller(guest)
    old, new = dict(value.service), {"pid": 4444, "starttime_ticks": 3}
    refreshes: list[int] = []

    def refresh() -> None:
        refreshes.append(1)
        if len(refreshes) == 2:
            raise GLibError("accessible vanished while the panel re-rendered")
        value.service = old if len(refreshes) == 1 else new

    value.refresh = refresh
    pressed: list[tuple[str, str]] = []
    value.action = lambda name, role: pressed.append((name, role))
    value.await_ready = lambda fresh: {"fresh": fresh}
    result = value.restart_service()
    assert result == {
        "terminated_service": {"killed": old},
        "replacement": {"fresh": True},
    }
    assert pressed == [("Check again", "push button")]


class StateSet:
    def __init__(self, states: set[str]) -> None:
        self.states = states

    def contains(self, state: object) -> bool:
        return state in self.states


class Node:
    """Shaped like an Atspi.Accessible that is its own Action interface."""

    def __init__(
        self,
        name: str,
        role: str,
        log: list[str],
        actions: tuple[str, ...] = (),
        children: list[Node] | None = None,
    ) -> None:
        self.name, self.role, self.log, self.actions = name, role, log, actions
        self.children = children or []
        self.states: set[str] = set()
        self.on_action: Callable[[], None] = lambda: None

    def get_process_id(self) -> int:
        return 4242

    def clear_cache(self) -> None:
        self.log.append(self.name + ":cache-cleared")

    def get_name(self) -> str:
        return self.name

    def get_role_name(self) -> str:
        return self.role

    def get_text_iface(self) -> None:
        return None

    def get_state_set(self) -> StateSet:
        return StateSet(self.states)

    def get_action_iface(self) -> Node | None:
        return self if self.actions else None

    def get_n_actions(self) -> int:
        return len(self.actions)

    def get_action_name(self, index: int) -> str:
        return self.actions[index]

    def do_action(self, index: int) -> bool:
        self.log.append(self.name + ":" + self.actions[index])
        self.on_action()
        return True

    def get_child_count(self) -> int:
        return len(self.children)

    def get_child_at_index(self, index: int) -> Node:
        return self.children[index]


def menu_app(
    guest: ModuleType, exposed: bool, shown: bool, replies: bool = True
) -> tuple[Any, list[str]]:
    """The product's GTK menu bar: File (menu) holding Quit (menu item)."""
    log: list[str] = []
    item = Node("Quit", "menu item", log, ("click",))

    def dropped() -> None:
        raise GLibError("quitting app dropped its AT-SPI reply")

    if not replies:
        item.on_action = dropped
    menu = Node("File", "menu", log, ("click",))
    link = Node("Open Diagnostics", "link", log, ("jump",))

    def opened() -> None:
        if exposed:
            menu.children = [item]
        if shown:
            item.states = {"showing", "visible"}

    menu.on_action = opened
    bar = Node("", "menu bar", log, children=[menu])
    root = Node("Desktop App", "application", log, children=[bar, link])
    value = controller(guest)
    value.app_accessible = lambda: root
    value.refresh = lambda: None

    def closed() -> dict[str, object]:
        log.append("close-observed")
        return {"known_identities_absent": True}

    value.observe_close = closed
    return value, log


@pytest.mark.parametrize("shown", [True, False], ids=["menu-shown", "menu-unmapped"])
def test_file_menu_quit_is_activated_through_atspi_then_close_is_observed(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, shown: bool
) -> None:
    monkeypatch.setattr(guest, "MENU_SECONDS", 0.3, raising=False)
    value, log = menu_app(guest, exposed=True, shown=shown)
    result = value.operation("quit_menu")
    assert log == ["File:click", "Quit:click", "close-observed"]
    assert result == {
        "menu": "File",
        "menu_action": "click",
        "item": "Quit",
        "item_action": "click",
        "item_showing_before_activation": shown,
        "closure": {"known_identities_absent": True},
    }


def test_file_menu_quit_without_a_reply_is_decided_by_the_close_observation(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(guest, "MENU_SECONDS", 0.3, raising=False)
    value, log = menu_app(guest, exposed=True, shown=True, replies=False)
    result = value.operation("quit_menu")
    assert log == ["File:click", "Quit:click", "close-observed"]
    assert result["item_action"] == "NO_REPLY_GLibError"
    assert result["closure"] == {"known_identities_absent": True}


def test_file_menu_without_a_quit_item_fails_after_its_bounded_wait(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(guest, "MENU_SECONDS", 0.3, raising=False)
    value, log = menu_app(guest, exposed=False, shown=False)
    started = time.monotonic()
    with pytest.raises(ValueError, match="no actionable Quit item"):
        value.operation("quit_menu")
    assert time.monotonic() - started < 5
    assert log == ["File:click"]


class Clock:
    """The guest module's own clock, advanced only by the guest's sleeps."""

    def __init__(self) -> None:
        # An integer start keeps start + FOCUS_SECONDS exact in every binade.
        self.now = float(int(time.monotonic()))

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


@pytest.mark.parametrize("delay", [4, None], ids=["exposed-on-fourth-poll", "never"])
def test_file_menu_quit_waits_its_bounded_time_for_a_late_item(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, delay: int | None
) -> None:
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    value, log = menu_app(guest, exposed=False, shown=False)
    root: Node = value.app_accessible()
    menu = root.children[0].children[0]
    opened: list[int] = []
    polls: list[int] = []
    menu.on_action = lambda: opened.append(1)

    def accessible() -> Node:
        if opened:
            polls.append(1)
            if len(polls) == delay:
                item = Node("Quit", "menu item", log, ("click",))
                item.states = {"showing", "visible"}
                menu.children = [item]
        return root

    value.app_accessible = accessible
    started = clock.now
    if delay is None:
        with pytest.raises(ValueError, match="no actionable Quit item"):
            value.operation("quit_menu")
        assert clock.now - started >= guest.MENU_SECONDS
        assert log == ["File:click"]
        return
    result = value.operation("quit_menu")
    assert len(polls) == delay
    assert clock.now - started < guest.MENU_SECONDS
    assert log == ["File:click", "Quit:click", "close-observed"]
    assert result["item_showing_before_activation"] is True


def closed_menu(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> tuple[Any, list[str], Node, Node]:
    """menu_app on the guest's own clock; opening File exposes nothing yet."""
    monkeypatch.setattr(guest, "time", Clock())
    value, log = menu_app(guest, exposed=False, shown=False)
    bar: Node = value.app_accessible().children[0]
    return value, log, bar, bar.children[0]


def quit_item(log: list[str], node: type[Node] = Node) -> Node:
    item = node("Quit", "menu item", log, ("click",))
    item.states = {"showing", "visible"}
    return item


@pytest.mark.parametrize("place", ["other-menu", "menu-bar"])
def test_quit_outside_the_file_menu_is_never_activated(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, place: str
) -> None:
    value, log, bar, _menu = closed_menu(guest, monkeypatch)
    item = quit_item(log)
    if place == "other-menu":
        bar.children.append(Node("Edit", "menu", log, ("click",), children=[item]))
    else:
        bar.children.append(item)
    closes = counted_close(value)
    with pytest.raises(ValueError, match="no actionable Quit item"):
        value.operation("quit_menu")
    assert log == ["File:click"]
    assert closes == []


@pytest.mark.parametrize("moment", ["before-open", "on-open"])
def test_two_quit_items_under_the_file_menu_are_refused(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, moment: str
) -> None:
    value, log, _bar, menu = closed_menu(guest, monkeypatch)
    # The second Quit sits one submenu deeper, still under File.
    items = [
        quit_item(log),
        Node("Recent", "menu", log, ("click",), children=[quit_item(log)]),
    ]

    def opened() -> None:
        menu.children = items

    if moment == "before-open":
        opened()
    else:
        menu.on_action = opened
    closes = counted_close(value)
    with pytest.raises(guest.MenuInvariantError, match="One native Quit item"):
        value.operation("quit_menu")
    assert log == ([] if moment == "before-open" else ["File:click"])
    assert closes == []


def test_a_quit_item_duplicated_after_it_was_seen_is_refused_at_once(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    # KI-0168: the first poll after File opens sees one Quit (not yet showing);
    # the second sees two. The earlier observation never authorizes activation.
    value, log, _bar, menu = closed_menu(guest, monkeypatch)
    first = quit_item(log)
    first.states = set()
    root: Node = value.app_accessible()
    polls: list[int] = []

    def accessible() -> Node:
        if menu.children:
            polls.append(1)
            if len(polls) == 2:
                menu.children = [first, quit_item(log)]
        return root

    menu.on_action = lambda: setattr(menu, "children", [first])
    value.app_accessible = accessible
    closes = counted_close(value)
    with pytest.raises(guest.MenuInvariantError, match="One native Quit item"):
        value.operation("quit_menu")
    assert len(polls) == 2
    assert log == ["File:click"]
    assert closes == []


def test_two_actionable_file_menus_are_refused_before_any_click(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    value, log, bar, _menu = closed_menu(guest, monkeypatch)
    bar.children.append(Node("File", "menu", log, ("click",)))
    closes = counted_close(value)
    with pytest.raises(guest.MenuInvariantError, match="One actionable native File"):
        value.operation("quit_menu")
    assert log == []
    assert closes == []


def test_a_missing_quit_item_names_the_last_transient_refusal(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    value, log, _bar, menu = closed_menu(guest, monkeypatch)
    root: Node = value.app_accessible()
    opened: list[int] = []
    menu.on_action = lambda: opened.append(1)

    def accessible() -> Node:
        if opened:
            raise GLibError("AT-SPI call timed out")
        return root

    value.app_accessible = accessible
    with pytest.raises(ValueError, match="no actionable Quit item") as refused:
        value.operation("quit_menu")
    assert str(refused.value).endswith("; last: GLibError: AT-SPI call timed out")
    assert log == ["File:click"]


class Refusing(Node):
    """AT-SPI replied: do_action() returned False, the action was refused."""

    def do_action(self, index: int) -> bool:
        super().do_action(index)
        return False


def test_a_refused_quit_action_fails_and_is_never_a_dropped_reply(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    value, log, _bar, menu = closed_menu(guest, monkeypatch)
    item = quit_item(log, Refusing)

    def opened() -> None:
        menu.children = [item]

    menu.on_action = opened
    closes = counted_close(value)
    with pytest.raises(ValueError, match="native accessibility action failed"):
        value.operation("quit_menu")
    assert log == ["File:click", "Quit:click"]
    assert closes == []


@pytest.mark.parametrize("twin", ["file-menu", "quit-item"])
def test_file_menu_and_quit_item_are_controls_by_their_activating_action(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, twin: str
) -> None:
    # A same-name twin with only an unnamed action, as WebKitGTK gives most
    # nodes, is not a control: neither refused as a duplicate nor activated.
    value, log, bar, menu = closed_menu(guest, monkeypatch)
    item = quit_item(log)
    if twin == "file-menu":
        bar.children.append(Node("File", "menu", log, ("",)))
        children = [item]
    else:
        children = [Node("Quit", "menu item", log, ("",)), item]

    def opened() -> None:
        menu.children = children

    menu.on_action = opened
    result = value.operation("quit_menu")
    assert log == ["File:click", "Quit:click", "close-observed"]
    assert (result["menu_action"], result["item_action"]) == ("click", "click")


def focus_app(
    guest: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    active: bool,
    alive: bool = True,
) -> tuple[Any, list[str]]:
    """The relaunched window: one owned frame and its focused Home link."""
    monkeypatch.setattr(guest, "same_process", lambda _identity: alive)
    log: list[str] = []
    home = Node("Home", "link", log, ("jump",))
    home.states = {"focused", "showing", "visible"}
    frame = Node("Desktop App", "frame", log, children=[home])
    frame.states = {"showing", "visible", *(["active"] if active else [])}
    root = Node("Desktop App", "application", log, children=[frame])
    value = controller(guest)
    value.app_accessible = lambda: root
    return value, log


@pytest.mark.parametrize("active", [True, False], ids=["active", "not-active"])
def test_window_focus_is_recorded_before_the_ctrl_q_chord(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, active: bool
) -> None:
    value, log = focus_app(guest, monkeypatch, active)
    assert "accelerator_focus" in guest.OPERATIONS
    result = value.operation("accelerator_focus")
    assert log == ["Desktop App:cache-cleared"]
    assert result == {
        "focus_observed": True,
        "app": "4242:1",
        "owned_frame_active": active,
        "frame_count": 1,
        "frames": [
            {
                "name": "Desktop App",
                "role": "frame",
                "active": active,
                "visible": True,
                "showing": True,
            }
        ],
        "focused_count": 1,
        "focused": [{"name": "Home", "role": "link"}],
    }
    assert value.accelerator_focus == result


@pytest.mark.parametrize(
    "case", ["transient-once", "never-observed", "authority-expired", "app-gone"]
)
def test_focus_before_ctrl_q_needs_a_live_app_and_retries_only_transients(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    value, _log = focus_app(guest, monkeypatch, True, alive=case != "app-gone")
    value.accelerator_focus = {"app": "4242:1", "stale": True}
    observe = value.tree
    raised: dict[str, list[Exception]] = {
        "transient-once": [GLibError("accessible destroyed in re-render")],
        "never-observed": [GLibError("AT-SPI call timed out")] * 1000,
        "authority-expired": [TimeoutError("Guest operation work authority expired")],
        "app-gone": [],
    }
    failures = raised[case]
    trees: list[int] = []

    def tree() -> object:
        trees.append(1)
        if failures:
            raise failures.pop(0)
        return observe()

    value.tree = tree
    started = clock.now
    if case == "app-gone":
        with pytest.raises(ValueError, match="must be alive before Ctrl"):
            value.operation("accelerator_focus")
        assert trees == []
        assert value.accelerator_focus is None
        return
    if case == "authority-expired":
        with pytest.raises(TimeoutError, match="work authority expired"):
            value.operation("accelerator_focus")
        assert trees == [1]
        assert value.accelerator_focus is None
        return
    result = value.operation("accelerator_focus")
    if case == "transient-once":
        assert len(trees) == 2
        assert result["focus_observed"] is True
        assert value.accelerator_focus == result
        return
    # Unobserved focus is still a record: the app it proved alive at both ends.
    assert result == {
        "focus_observed": False,
        "app": "4242:1",
        "error_type": "GLibError",
    }
    assert clock.now - started >= guest.FOCUS_SECONDS
    assert value.accelerator_focus == result


def not_closed() -> dict[str, object]:
    raise TimeoutError("Known app/service/listener did not close")


@pytest.mark.parametrize("observed", [True, False], ids=["recorded", "not-observed"])
def test_ctrl_q_failure_names_the_focus_recorded_before_the_chord(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, observed: bool
) -> None:
    value, _log = focus_app(guest, monkeypatch, active=False)
    if not observed:
        monkeypatch.setattr(guest, "time", Clock())
        value.tree = failing_then([GLibError("AT-SPI call timed out")] * 1000)
    value.operation("accelerator_focus")
    value.observe_close = not_closed
    with pytest.raises(TimeoutError) as failure:
        value.operation("quit_accelerator")
    message = str(failure.value)
    assert message.startswith("Known app/service/listener did not close; ")
    if observed:
        assert "before Ctrl+Q: owned frame active=False" in message
        assert "focused=link 'Home'" in message
    else:
        assert message.endswith("focus before Ctrl+Q was not observed: GLibError")
    assert len(message) <= 512


def test_ctrl_q_operation_observes_the_same_close(guest: ModuleType) -> None:
    value, log = menu_app(guest, exposed=True, shown=True)
    value.accelerator_focus = {"focus_observed": False, "app": "4242:1"}
    assert value.operation("quit_accelerator") == {
        "accelerator": "Ctrl+Q",
        "closure": {"known_identities_absent": True},
    }
    assert log == ["close-observed"]
    assert value.accelerator_focus is None
    assert {"quit_menu", "quit_accelerator"} <= set(guest.OPERATIONS)
    assert guest.OPERATIONS[-1] == "finish"


def counted_close(value: Any) -> list[int]:  # noqa: ANN401 - Controller without GI
    """A close observation that would see every known identity gone."""
    closes: list[int] = []

    def gone() -> dict[str, object]:
        closes.append(1)
        return {"known_identities_absent": True}

    value.observe_close = gone
    return closes


class Mortal(Node):
    """Reading its cache or its states is the owned app's last act."""

    def __init__(
        self,
        name: str,
        role: str,
        log: list[str],
        alive: list[bool],
        children: list[Node],
    ) -> None:
        super().__init__(name, role, log, children=children)
        self.alive = alive

    def clear_cache(self) -> None:
        self.alive[0] = False
        super().clear_cache()

    def get_state_set(self) -> StateSet:
        self.alive[0] = False
        return super().get_state_set()


@pytest.mark.parametrize("moment", ["before-observation", "during-observation"])
def test_app_death_inside_the_focus_poll_fails_it_and_refuses_ctrl_q(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, moment: str
) -> None:
    monkeypatch.setattr(guest, "time", Clock())
    alive = [True]
    monkeypatch.setattr(guest, "same_process", lambda _identity: alive[0])
    log: list[str] = []
    home = Node("Home", "link", log, ("jump",))
    home.states = {"focused"}
    if moment == "before-observation":
        # Dies after the entry check: every poll then retries a dead app.
        frame = Node("Desktop App", "frame", log, children=[home])
        root: Node = Mortal("Desktop App", "application", log, alive, [frame])
    else:
        # Dies while the one successful observation reads its frame.
        frame = Mortal("Desktop App", "frame", log, alive, [home])
        root = Node("Desktop App", "application", log, children=[frame])
    value = controller(guest)
    value.accelerator_focus = {"app": "4242:1", "stale": True}
    # The actual app_accessible, whose dead-app ValueError the poll retries.
    value.atspi.get_desktop = lambda _index: Node("", "desktop", log, children=[root])
    with pytest.raises(ValueError, match="died during its focus poll"):
        value.operation("accelerator_focus")
    assert alive == [False]
    assert value.accelerator_focus is None
    closes = counted_close(value)
    with pytest.raises(ValueError, match="not recorded for this app"):
        value.operation("quit_accelerator")
    assert closes == []


@pytest.mark.parametrize(
    "case", ["not-recorded", "other-pid", "pid-reused", "already-used"]
)
def test_ctrl_q_is_refused_without_focus_recorded_for_this_app(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    value, _log = focus_app(guest, monkeypatch, active=True)
    if case != "not-recorded":
        assert value.operation("accelerator_focus")["app"] == "4242:1"
    closes = counted_close(value)
    if case == "already-used":
        value.operation("quit_accelerator")
    value.app = {
        "other-pid": {"pid": 5151, "starttime_ticks": 1},
        "pid-reused": {"pid": 4242, "starttime_ticks": 9},
    }.get(case, value.app)
    with pytest.raises(ValueError, match="refused: focus before") as refused:
        value.operation("quit_accelerator")
    assert str(refused.value) == (
        "Ctrl+Q refused: focus before Ctrl+Q was not recorded for this app"
    )
    assert closes == ([1] if case == "already-used" else [])
    assert value.accelerator_focus is None


@pytest.mark.parametrize("case", ["other-pid", "pid-reused"])
def test_an_unobserved_focus_record_is_still_bound_to_its_app(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    value, _log = focus_app(guest, monkeypatch, active=True)

    def tree() -> object:
        raise GLibError("AT-SPI call timed out")

    value.tree = tree
    assert value.operation("accelerator_focus")["focus_observed"] is False
    closes = counted_close(value)
    value.app = {
        "other-pid": {"pid": 5151, "starttime_ticks": 1},
        "pid-reused": {"pid": 4242, "starttime_ticks": 9},
    }[case]
    with pytest.raises(ValueError, match="not recorded for this app"):
        value.operation("quit_accelerator")
    assert closes == []


LONG = 200


def crowded_app(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, actives: tuple[bool, ...]
) -> Any:  # noqa: ANN401 - Controller without GI
    """Owned frames, ACTIVE as given, each holding one focused row; every
    frame name and focused name and role is longer than any cap."""
    monkeypatch.setattr(guest, "same_process", lambda _identity: True)
    log: list[str] = []
    frames = []
    for index, active in enumerate(actives):
        row = Node(f"row {index} " + "n" * LONG, "role " + "r" * LONG, log)
        row.states = {"focused"}
        frame = Node(f"frame {index} " + "f" * LONG, "frame", log, children=[row])
        frame.states = {"showing", "visible", *(["active"] if active else [])}
        frames.append(frame)
    root = Node("Desktop App", "application", log, children=frames)
    value = controller(guest)
    value.app_accessible = lambda: root
    return value


def test_focus_record_before_ctrl_q_is_bounded_on_a_crowded_tree(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    value = crowded_app(guest, monkeypatch, (True,) * 10)
    result = value.operation("accelerator_focus")
    assert (guest.FOCUS_ROWS, guest.FOCUS_TEXT_CAP) == (8, 128)
    assert len(result["frames"]) == len(result["focused"]) == 8
    assert result["frame_count"] == result["focused_count"] == 10
    assert result["owned_frame_active"] is False
    assert result["frames"] == [
        {
            "name": (f"frame {index} " + "f" * LONG)[:128],
            "role": "frame",
            "active": True,
            "visible": True,
            "showing": True,
        }
        for index in range(8)
    ]
    assert result["focused"] == [
        {
            "name": (f"row {index} " + "n" * LONG)[:128],
            "role": ("role " + "r" * LONG)[:128],
        }
        for index in range(8)
    ]
    names = [row["name"] for row in result["frames"] + result["focused"]]
    assert all(len(name) <= 128 for name in names)


def test_ctrl_q_failure_with_long_focused_rows_stays_within_512(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    value = crowded_app(guest, monkeypatch, (True,) * 10)
    value.operation("accelerator_focus")
    value.observe_close = not_closed
    with pytest.raises(TimeoutError) as failure:
        value.operation("quit_accelerator")
    message = str(failure.value)
    assert len(message) <= 512
    assert guest.FOCUS_MESSAGE_ROWS == 4
    assert message.count("'row ") == 4
    assert "owned frame active=False, frames=10, focused=role " in message


def test_ctrl_q_failure_caps_escaped_focus_names_within_512(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    # repr() turns each zero-width space into a 6-character escape.
    value = crowded_app(guest, monkeypatch, (True,) * 10)
    for frame in value.app_accessible().children:
        frame.children[0].name = "\u200b" * LONG
    value.operation("accelerator_focus")
    value.observe_close = not_closed
    with pytest.raises(TimeoutError) as failure:
        value.operation("quit_accelerator")
    message = str(failure.value)
    assert len(message) <= 512
    assert message.count("'\\u200b") == guest.FOCUS_MESSAGE_ROWS


def test_unobserved_focus_poll_before_ctrl_q_is_bounded(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    value, _log = focus_app(guest, monkeypatch, True)
    trees: list[int] = []

    def tree() -> object:
        trees.append(1)
        raise GLibError("AT-SPI call timed out")

    value.tree = tree
    started = clock.now
    assert value.operation("accelerator_focus")["focus_observed"] is False
    assert guest.FOCUS_SECONDS == 2
    assert 2 <= clock.now - started <= 2.2
    # One tree per 0.1 s poll, give or take the last float step.
    assert 20 <= len(trees) <= 21


@pytest.mark.parametrize(
    ("actives", "expected"),
    [((True,), True), ((False,), False), ((True, True), False), ((True, False), False)],
    ids=["one-active", "one-inactive", "two-active", "one-of-two-active"],
)
def test_owned_frame_active_means_one_frame_and_it_is_active(
    guest: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    actives: tuple[bool, ...],
    expected: bool,
) -> None:
    value = crowded_app(guest, monkeypatch, actives)
    result = value.operation("accelerator_focus")
    assert result["owned_frame_active"] is expected
    assert result["frame_count"] == len(actives)
    assert [frame["active"] for frame in result["frames"]] == list(actives)


def test_finish_no_longer_claims_quit_is_unavailable(guest: ModuleType) -> None:
    value = controller(guest)
    value.known = []
    value.before = value.relocated_before = {"usr/bin/japp-desktop": {"bytes": 1}}
    value.package_binding = lambda _root: {"usr/bin/japp-desktop": {"bytes": 1}}
    result = value.finish()
    assert "NOT_AVAILABLE" not in json.dumps(result)
    assert result["distinct_quit_measured_separately"] is True


def test_controller_lifetime_is_raised_and_stays_below_the_host_budget(
    guest: ModuleType, vm: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(guest, "load_native", lambda: (object(), object()))
    monkeypatch.setattr(guest, "native_error", lambda: GLibError, raising=False)
    monkeypatch.setattr(guest.Controller, "package_binding", lambda _self, _root: {})
    # Integer-start clocks: on Windows two real reads are often one 15.6 ms
    # tick, and (start + 1500) - start can round to 1499.9999999999998.
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    monkeypatch.setattr(vm, "time", Clock())
    value = guest.Controller()
    lifetime = value.work_deadline - clock.now
    assert guest.CONTROLLER_SECONDS == 1500
    assert lifetime == guest.CONTROLLER_SECONDS
    owner = vm.Owner(tmp_path, tmp_path)
    # Host work budget less its 900 s image download bound and the measured
    # 268 s KVM readiness (docs/evidence/m03-native-runtime-diagnostics).
    assert lifetime + 900 + 268 < owner.work_deadline - owner.started


def main_ready(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, proof: Path, argv: list[str]
) -> None:
    proof.mkdir(exist_ok=True)
    monkeypatch.setattr(guest, "require_linux", lambda: None)
    monkeypatch.setattr(guest.os, "geteuid", lambda: 1000, raising=False)
    monkeypatch.setattr(guest.Path, "home", lambda: guest.HOME)
    monkeypatch.setattr(guest, "PROOF", proof)
    monkeypatch.setattr(sys, "argv", ["ubuntu_gnome_guest.py", *argv])


def test_only_the_serving_controller_writes_a_failure_marker(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    proof = tmp_path / "proof"
    marker = proof / "controller-failure.json"
    main_ready(guest, monkeypatch, proof, ["--serve"])
    monkeypatch.setattr(
        guest, "serve", failing_then([RuntimeError("synthetic serve failure")])
    )
    with pytest.raises(RuntimeError, match="synthetic serve failure"):
        guest.main()
    assert json.loads(marker.read_text()) == {
        "status": "CONTROLLER_FAILED",
        "error_type": "RuntimeError",
        "message": "synthetic serve failure",
    }
    marker.unlink()
    main_ready(guest, monkeypatch, proof, ["--request", "finish"])
    monkeypatch.setattr(
        guest, "request", failing_then([FileNotFoundError("controller.sock")])
    )
    with pytest.raises(FileNotFoundError):
        guest.main()
    assert not marker.exists()
    tree = ast.parse((SOURCE / "ubuntu_gnome_guest.py").read_text(encoding="utf-8"))
    entry = [
        node
        for node in tree.body
        if isinstance(node, ast.If) and "__main__" in ast.unparse(node.test)
    ]
    assert [ast.unparse(node) for node in entry[0].body] == ["raise SystemExit(main())"]


class ProofDir:
    """The private proof directory, owned by the synthetic account."""

    def __init__(self, real: Path) -> None:
        self.real = real

    def lstat(self) -> SimpleNamespace:
        return SimpleNamespace(st_uid=1000, st_mode=stat.S_IFDIR | 0o700)

    def __truediv__(self, name: str) -> Path:
        return self.real / name


class SocketPath:
    def exists(self) -> bool:
        return False

    def is_symlink(self) -> bool:
        return False

    def chmod(self, _mode: int) -> None:
        return None

    def unlink(self, missing_ok: bool = False) -> None:
        assert missing_ok

    def __str__(self) -> str:
        return "controller.sock"


class Server:
    """Listens and never receives a request before the work deadline."""

    def __init__(self, *_args: object) -> None:
        return None

    def __enter__(self) -> Server:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def bind(self, _path: str) -> None:
        return None

    def listen(self, _backlog: int) -> None:
        return None

    def settimeout(self, _seconds: float) -> None:
        return None

    def accept(self) -> tuple[object, object]:
        time.sleep(0.02)
        raise TimeoutError


@pytest.mark.parametrize(
    ("session_code", "expected"),
    [
        (0, {"reason": "WORK_DEADLINE_EXPIRED", "last_sequence": 7, "exit_code": 1}),
        (78, {"reason": "SESSION_NOT_READY", "last_sequence": 0, "exit_code": 78}),
    ],
    ids=["work-deadline", "session-not-ready"],
)
def test_controller_exit_without_a_receipt_leaves_a_bounded_marker(
    guest: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    session_code: int,
    expected: dict[str, object],
) -> None:
    class Lifetime:
        def __init__(self) -> None:
            self.work_deadline = time.monotonic() + 0.2
            self.sequence = 7

    monkeypatch.setattr(guest, "PROOF", ProofDir(tmp_path))
    monkeypatch.setattr(guest, "SOCKET", SocketPath())
    monkeypatch.setattr(guest.os, "geteuid", lambda: 1000, raising=False)
    monkeypatch.setattr(guest, "session_main", lambda: session_code)
    monkeypatch.setattr(guest, "Controller", Lifetime)
    monkeypatch.setattr(
        guest, "socket", SimpleNamespace(socket=Server, AF_UNIX=1, SOCK_STREAM=1)
    )
    assert guest.serve() == expected["exit_code"]
    marker = tmp_path / "controller-exit.json"
    assert json.loads(marker.read_text()) == {"status": "CONTROLLER_EXITED", **expected}
    assert marker.stat().st_size < 1024


REQUIRED = (
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


class Child:
    pid = 4242

    def __init__(self, code: int) -> None:
        self.returncode = code

    def poll(self) -> int:
        return self.returncode


@pytest.fixture
def provision(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> ModuleType:
    if sys.platform == "win32":
        monkeypatch.setitem(sys.modules, "pwd", ModuleType("pwd"))
    module = load("ubuntu_gnome_provision")
    home = tmp_path / "home"
    home.mkdir()
    identity = SimpleNamespace(pw_dir=str(home), pw_uid=1000, pw_gid=1001)
    account = importlib.import_module("pwd")
    monkeypatch.setattr(account, "getpwnam", lambda _name: identity, raising=False)
    monkeypatch.setattr(module, "require_linux", lambda: None)
    monkeypatch.setattr(module, "ACCOUNT_HOME", home, raising=False)
    monkeypatch.setattr(module, "STATE", tmp_path / "state")
    monkeypatch.setattr(module, "INPUT", tmp_path / "input")
    monkeypatch.setattr(module.os, "geteuid", lambda: 0, raising=False)
    monkeypatch.setattr(module.os, "getpgid", lambda pid: pid, raising=False)
    monkeypatch.setattr(module.os, "chown", lambda *_args: None, raising=False)
    return module


def owned_files(
    monkeypatch: pytest.MonkeyPatch, module: ModuleType
) -> list[tuple[int, int, int]]:
    owners: list[tuple[int, int, int]] = []

    def fchown(descriptor: int, uid: int, gid: int) -> None:
        owners.append((os.fstat(descriptor).st_size, uid, gid))

    monkeypatch.setattr(module.os, "fchown", fchown, raising=False)
    return owners


def reviewed_inputs(root: Path) -> None:
    (root / "guest-closure/debs").mkdir(parents=True)
    (root / "package").mkdir()
    rows = []
    for name in REQUIRED:
        archive = root / "guest-closure/debs" / (name + "_1_amd64.deb")
        archive.write_bytes(("synthetic inert archive " + name).encode())
        rows.append(
            {
                "filename": archive.name,
                "bytes": archive.stat().st_size,
                "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                "package": name,
                "version": "1",
                "architecture": "amd64",
            }
        )
    (root / "guest-closure/lock.json").write_text(
        json.dumps(
            {
                "schema": "japp-reviewed-noble-closure-v1",
                "architecture": "amd64",
                "packages": rows,
            }
        )
    )
    package = root / "package/package.deb"
    package.write_bytes(b"synthetic inert product archive")
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    (root / "package/export.json").write_text(
        json.dumps({"files": {"package.deb": {"sha256": digest}}})
    )


def test_failed_install_step_leaves_its_receipt_and_logs_for_the_host(
    provision: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    reviewed_inputs(tmp_path / "input")
    monkeypatch.setattr(type(tmp_path), "is_mount", lambda _self: True)
    apt = b"Unpacking synthetic\nE: Sub-process /usr/bin/dpkg returned an error\n"

    def popen(_argv: list[str], *, stdout: IO[bytes], **_kwargs: object) -> Child:
        stdout.write(apt)
        return Child(100)

    monkeypatch.setattr(provision.subprocess, "Popen", popen)
    owners = owned_files(monkeypatch, provision)
    with pytest.raises(RuntimeError, match="preserve exact raw log"):
        provision.main()
    proof = tmp_path / "home/japp-proof"
    receipt = json.loads((proof / "provision-failure.json").read_text())
    assert receipt["status"] == "PROVISION_FAILED"
    assert receipt["phase"] == "locked-install"
    assert receipt["log"] == "locked-install.log"
    assert receipt["log_completed"] is False
    assert receipt["log_tail"] == apt.decode()
    assert receipt["error_type"] == "RuntimeError"
    assert receipt["state_logs_copied"] == ["locked-install.log"]
    assert (proof / "provision-locked-install.log").read_bytes() == apt
    assert {(uid, gid) for _size, uid, gid in owners} == {(1000, 1001)}
    assert len(owners) == 2
    assert len((proof / "provision-failure.json").read_bytes()) < 64 * 1024


def test_failed_step_log_with_key_material_is_withheld_from_the_receipt(
    provision: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    reviewed_inputs(tmp_path / "input")
    monkeypatch.setattr(type(tmp_path), "is_mount", lambda _self: True)
    output = b"Unpacking synthetic\n" + KEY_MARKER + b"\nE: synthetic failure\n"

    def popen(_argv: list[str], *, stdout: IO[bytes], **_kwargs: object) -> Child:
        stdout.write(output)
        return Child(100)

    monkeypatch.setattr(provision.subprocess, "Popen", popen)
    owners = owned_files(monkeypatch, provision)
    with pytest.raises(RuntimeError, match="preserve exact raw log"):
        provision.main()
    proof = tmp_path / "home/japp-proof"
    raw = (proof / "provision-failure.json").read_bytes()
    receipt = json.loads(raw)
    assert receipt["log"] == "locked-install.log"
    assert receipt["log_bytes"] == len(output)
    assert receipt["log_tail"] is None
    assert receipt["log_tail_withheld_private_key_marker"] is True
    assert receipt["state_logs_copied"] == []
    assert b"PRIVATE KEY" not in raw
    assert [path.name for path in proof.iterdir()] == ["provision-failure.json"]
    assert len(owners) == 1


def test_unmounted_input_is_reported_before_any_step_log(
    provision: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    owned_files(monkeypatch, provision)
    with pytest.raises(ValueError, match="prepared disposable guest"):
        provision.main()
    receipt = json.loads(
        (tmp_path / "home/japp-proof/provision-failure.json").read_text()
    )
    assert receipt["phase"] == "verify_inputs"
    assert receipt["log"] is None
    assert receipt["log_tail"] is None
    assert receipt["state_logs_copied"] == []


def test_successful_provision_hands_over_logs_but_never_key_material(
    provision: ModuleType, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    state = tmp_path / "state"
    state.mkdir()
    (state / "dconf.log").write_bytes(b"dconf updated\n")
    (state / "restart-gdm.log").write_bytes(b"x\n" + KEY_MARKER + b"\n")
    (state / "locked-install.log").write_bytes(b"0123456789" * 300_000)
    owned_files(monkeypatch, provision)
    provision.publish_evidence(None)
    proof = tmp_path / "home/japp-proof"
    assert sorted(path.name for path in proof.iterdir()) == [
        "provision-dconf.log",
        "provision-locked-install.log",
    ]
    copied = (proof / "provision-locked-install.log").read_bytes()
    assert copied == (b"0123456789" * 300_000)[-2 * 1024 * 1024 :]


class Remote:
    """Answers owned SSH commands and leaves the same command records."""

    def __init__(
        self,
        owner: Any,  # noqa: ANN401 - the loaded module's own Owner
        reply: Callable[[str], tuple[int, bytes]],
    ) -> None:
        self.owner, self.reply = owner, reply
        self.calls: list[dict[str, Any]] = []

    def command(
        self,
        argv: list[str],
        seconds: float = 30,
        cap: int = 256 * 1024,
        permit_failure: bool = False,
        cleanup: bool = False,
    ) -> bytes:
        self.owner.sequence += 1
        code, stdout = self.reply(argv[-1])
        self.calls.append(
            {"remote": argv[-1], "seconds": seconds, "cap": cap, "cleanup": cleanup}
        )
        stem = self.owner.proof / ("command-" + str(self.owner.sequence).zfill(3))
        stem.with_suffix(".stdout").write_bytes(stdout)
        stem.with_suffix(".json").write_text(json.dumps({"exit_code": code}))
        if code != 0 and not permit_failure:
            raise RuntimeError("Owned command failed; original raw output retained")
        return stdout


def owner_with(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    reply: Callable[[str], tuple[int, bytes]],
) -> tuple[Any, Remote]:
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    owner.ssh = ["/usr/bin/ssh"]
    remote = Remote(owner, reply)
    monkeypatch.setattr(owner, "command", remote.command)
    return owner, remote


@pytest.mark.parametrize(
    "case",
    [
        (b"PROVISION_FAILED\n", "provision-failure.json", "provisioning failed"),
        (b"CONTROLLER_ENDED\n", "controller-exit.json", "controller ended"),
    ],
    ids=["provision-failure", "controller-exit"],
)
def test_readiness_poll_fails_fast_on_a_guest_failure_receipt(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    case: tuple[bytes, str, str],
) -> None:
    token, name, message = case
    polls: list[str] = []
    receipt = {"status": "SYNTHETIC_GUEST_FAILURE", "phase": "locked-install"}

    def reply(remote: str) -> tuple[int, bytes]:
        if "controller.sock" in remote:
            polls.append(remote)
            if len(polls) > 2:
                raise AssertionError("Polled past a guest failure receipt")
            return 1, token
        if remote.endswith("/" + name):
            return 0, json.dumps(receipt).encode()
        return 1, b""

    owner, _remote = owner_with(vm, tmp_path, monkeypatch, reply)
    owner.child = SimpleNamespace(poll=lambda: None)
    with pytest.raises(RuntimeError, match=message):
        vm.observe_session(SimpleNamespace(proof=owner.proof), owner, owner.ssh)
    assert len(polls) == 1
    assert "provision-failure.json" in polls[0]
    assert json.loads((owner.proof / name).read_text()) == receipt


def cloud_config(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Any:  # noqa: ANN401 - parsed cloud-config document
    """The user-data prepare_guest writes, with every tool call faked."""
    work, package, closure = tmp_path / "work", tmp_path / "package", tmp_path / "lock"
    for path in (work, package, closure / "debs"):
        path.mkdir(parents=True)
    for name in ("export.json", "package.deb"):
        (package / name).write_bytes(b"synthetic inert " + name.encode())
    (closure / "lock.json").write_text('{"synthetic": true}\n')

    def command(argv: list[str]) -> bytes:
        if argv[0] == vm.TOOLS["keygen"]:
            Path(argv[-1]).write_text("SYNTHETIC INERT FIXTURE NOT A KEY\n")
            Path(argv[-1] + ".pub").write_text("SYNTHETIC INERT PUBLIC FIXTURE\n")
        return b""

    class PortSelection:
        def __enter__(self) -> PortSelection:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def bind(self, _address: tuple[str, int]) -> None:
            return None

        def getsockname(self) -> tuple[str, int]:
            return ("127.0.0.1", 12345)

    monkeypatch.setattr(vm.socket, "socket", PortSelection)
    vm.prepare_guest(
        SimpleNamespace(package=package, guest_closure=closure),
        SimpleNamespace(work=work, command=command),
        tmp_path / "inert-image",
        {"packages": []},
        {"files": ["package.deb"]},
    )
    user_data = (work / "user-data").read_text()
    return json.loads(user_data.removeprefix("#cloud-config\n"))


def test_unmounted_input_leaves_a_marker_written_as_the_synthetic_account(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runcmd = cloud_config(vm, tmp_path, monkeypatch)["runcmd"]
    mount = next(i for i, step in enumerate(runcmd) if step[0] == "/usr/bin/mount")
    assert runcmd[-1][0] == "/usr/bin/python3"
    # Exactly one step between the mount and provision.py, which cloud-init
    # runs from that same mount. A string item is run by cloud-init's sh.
    assert len(runcmd) == mount + 3
    step = runcmd[mount + 1]
    assert isinstance(step, str)
    words = list(shlex.shlex(step, posix=True, punctuation_chars=True))
    marker = json.loads(words[17])
    assert words[:17] + words[18:] == [
        "/usr/bin/mountpoint",
        "-q",
        "/mnt/jappinput",
        "||",
        "{",
        "/usr/sbin/runuser",
        "-u",
        "japp-ci",
        "--",
        "/usr/bin/mkdir",
        "-m",
        "0700",
        "-p",
        "/home/japp-ci/japp-proof",
        "&&",
        "/usr/bin/printf",
        "%s\\n",
        "|",
        "/usr/sbin/runuser",
        "-u",
        "japp-ci",
        "--",
        "/usr/bin/dd",
        "of=/home/japp-ci/japp-proof/input-mount-failure.json",
        "conv=excl",
        "status=none",
        ";",
        "}",
    ]
    assert marker == {
        "status": "PROVISION_FAILED",
        "phase": "mount_input",
        "reason": "INPUT_NOT_A_MOUNTPOINT",
        "writer": "CLOUD_INIT_RUNCMD",
    }
    assert len(words[17]) < 256
    assert "input-mount-failure.json" in vm.GUEST_JSON


def test_readiness_poll_fails_fast_on_the_unmounted_input_marker(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    polls: list[str] = []
    marker = {"status": "PROVISION_FAILED", "phase": "mount_input"}

    def reply(remote: str) -> tuple[int, bytes]:
        if "controller.sock" in remote:
            polls.append(remote)
            if len(polls) > 1:
                raise AssertionError("Polled past the unmounted input marker")
            # The guest's test -f succeeds only on the marker this poll names.
            seen = "/home/japp-ci/japp-proof/input-mount-failure.json" in remote
            return 1, b"PROVISION_FAILED\n" if seen else b""
        if remote.endswith("/input-mount-failure.json"):
            return 0, json.dumps(marker).encode()
        return 1, b""

    owner, _remote = owner_with(vm, tmp_path, monkeypatch, reply)
    owner.child = SimpleNamespace(poll=lambda: None)
    with pytest.raises(RuntimeError, match="provisioning failed"):
        vm.observe_session(SimpleNamespace(proof=owner.proof), owner, owner.ssh)
    assert len(polls) == 1
    assert json.loads((owner.proof / "input-mount-failure.json").read_text()) == marker
    retention = load("ubuntu_gnome_retention")
    assert "input-mount-failure.json" in {
        row["path"] for row in retention.inventory(owner.proof)
    }


def ppm(width: int, height: int, varied: bool) -> bytes:
    pixels = bytes(i % 251 for i in range(width * height * 3)) if varied else None
    body = pixels if pixels is not None else bytes(width * height * 3)
    return b"P6\n%d %d\n255\n" % (width, height) + body


def test_lifecycle_exercises_menu_quit_and_ctrl_q_within_the_frame_budget(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    events: list[tuple[str, str]] = []
    names: dict[str, str] = {}
    frame = ppm(640, 480, varied=True)

    def reply(remote: str) -> tuple[int, bytes]:
        if "--request" in remote:
            operation = shlex.split(remote)[-1]
            events.append(("request", operation))
            name = str(len(names) + 1).zfill(2) + "-" + operation + ".json"
            names[name] = operation
            return 0, json.dumps({"status": "PASS", "receipt": name}).encode()
        name = remote.rsplit("/", 1)[-1]
        body = {"status": "PASS", "operation": names[name], "result": {}}
        return 0, json.dumps(body).encode()

    owner, _remote = owner_with(vm, tmp_path, monkeypatch, reply)

    def qmp_call(
        execute: str, arguments: dict[str, Any] | None = None, cleanup: bool = False
    ) -> object:
        assert not cleanup
        assert arguments is not None
        if execute == "screendump":
            Path(arguments["filename"]).write_bytes(frame)
        elif arguments["events"][0]["data"]["down"]:
            keys = [event["data"]["key"]["data"] for event in arguments["events"]]
            events.append(("keys", "+".join(keys)))
        return {}

    def shell(_owner: object, operation: str) -> dict[str, object]:
        if operation.startswith("shell_route_"):
            slug = operation.removeprefix("shell_route_")
            return {"heading": dict(vm.ROUTES)[slug], "accessibility": []}
        return {"checked_before": "before", "checked_at": "after"}

    monkeypatch.setattr(owner, "qmp_call", qmp_call)
    monkeypatch.setattr(vm, "shell_request", shell)
    monkeypatch.setattr(vm, "validate_capture", lambda *_args: None)
    monkeypatch.setattr(vm, "verify_capture_images", lambda *_args: None)
    result: dict[str, object] = {"status": "PREPARATION_FAILED"}
    vm.run_lifecycle(
        SimpleNamespace(
            proof=owner.proof, guest_closure_sha256="1" * 64, expected_head="2" * 40
        ),
        owner,
        {"logind_properties": {"Type": "wayland"}},
        {"files": {"package.deb": {"sha256": "3" * 64}}},
        result,
    )
    requests = [value for kind, value in events if kind == "request"]
    assert requests == [
        "launch",
        "keyboard_before",
        "keyboard_after_tab",
        "keyboard_after_shift_tab",
        "keyboard_after_enter",
        "auth",
        "crash_service",
        "close_observe",
        "relaunch",
        "close_observe",
        "relaunch",
        "quit_menu",
        "relaunch",
        "accelerator_focus",
        "quit_accelerator",
        "relocated_launch",
        "force_parent",
        "finish",
    ]
    accelerator = events.index(("request", "quit_accelerator"))
    assert events[accelerator - 1] == ("keys", "ctrl+q")
    assert events[accelerator - 2] == ("request", "accelerator_focus")
    assert events.count(("keys", "ctrl+q")) == 1
    assert result["status"] == vm.SCOPED_RESULT
    assert result["distinct_quit"] != "NOT_AVAILABLE"
    frames = result["frames"]
    assert isinstance(frames, list)
    assert len(frames) == owner.frames == vm.FRAME_CAP == 20


LISTING = b"""drwx------ 4096 japp-proof
-rw------- 10 14-launch.json
-rw------- 10 15-quit_menu.json
srw------- 0 controller.sock
-rw-r--r-- 20 provision-failure.json
-rw-r--r-- 20 controller-exit.json
-rw-r--r-- 30 provision-locked-install.log
-rw------- 5 x y.json
-rw------- 5 evil;rm.json
"""


def closeout_reply(remote: str) -> tuple[int, bytes]:
    if remote.startswith("/usr/bin/find "):
        return 0, LISTING
    if remote.endswith(".json"):
        return 0, json.dumps({"guest": remote.rsplit("/", 1)[-1]}).encode()
    return 0, b"bounded synthetic guest text\n"


def test_closeout_runs_despite_the_vm_output_cap_and_fetches_listed_evidence(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner, remote = owner_with(vm, tmp_path, monkeypatch, closeout_reply)
    owner.child = SimpleNamespace(returncode=None)
    (owner.proof / "14-launch.json").write_text("{}\n")
    monkeypatch.setattr(owner, "vm_output_exceeded", lambda: True)
    vm.capture_guest_closeout(owner)
    assert [call["remote"] for call in remote.calls] == [
        "/usr/bin/find /home/japp-ci/japp-proof -maxdepth 1 -printf '%M %s %f\\n'",
        "/usr/bin/cat /home/japp-ci/japp-proof/provision-failure.json",
        "/usr/bin/cat /home/japp-ci/japp-proof/controller-exit.json",
        "/usr/bin/cat /home/japp-ci/japp-proof/15-quit_menu.json",
        "/usr/bin/journalctl --user -b --no-pager -n 400",
        "/usr/bin/cat /home/japp-ci/japp-proof/provision-locked-install.log",
    ]
    assert {call["seconds"] for call in remote.calls} == {10}
    assert all(call["cleanup"] for call in remote.calls)
    for name in ("provision-failure.json", "controller-exit.json", "15-quit_menu.json"):
        assert json.loads((owner.proof / name).read_text()) == {"guest": name}


def test_closeout_stops_when_the_guest_ssh_transport_is_gone(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner, remote = owner_with(vm, tmp_path, monkeypatch, lambda _remote: (255, b""))
    owner.child = SimpleNamespace(returncode=None)
    vm.capture_guest_closeout(owner)
    assert len(remote.calls) == 1


def test_every_receipt_name_the_guest_can_write_is_fetchable(
    guest: ModuleType, vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The guest names a receipt str(sequence).zfill(2) + "-" + operation, and a
    # full lifecycle runs past sequence 99.
    names = [
        str(sequence).zfill(2) + "-" + operation + ".json"
        for start in (1, 100)
        for sequence, operation in enumerate(guest.OPERATIONS, start)
    ]
    (tmp_path / "fetch").mkdir()
    owner, _fetches = owner_with(vm, tmp_path / "fetch", monkeypatch, closeout_reply)
    for name in names:
        assert vm.fetch_guest_json(owner, name) is True
        assert json.loads((owner.proof / name).read_text()) == {"guest": name}
    scale = sorted(
        name for name in names[: len(guest.OPERATIONS)] if "shell_scale_step" in name
    )
    assert len(scale) == 5
    listing = b"".join(b"-rw------- 10 " + name.encode() + b"\n" for name in scale)

    def reply(remote: str) -> tuple[int, bytes]:
        if remote.startswith("/usr/bin/find "):
            return 0, listing
        return closeout_reply(remote)

    (tmp_path / "closeout").mkdir()
    closeout, remote = owner_with(vm, tmp_path / "closeout", monkeypatch, reply)
    closeout.child = SimpleNamespace(returncode=None)
    vm.capture_guest_closeout(closeout)
    assert [call["remote"] for call in remote.calls[1:-1]] == [
        "/usr/bin/cat /home/japp-ci/japp-proof/" + name for name in scale
    ]
    for name in scale:
        assert json.loads((closeout.proof / name).read_text()) == {"guest": name}


class RunningVM:
    pid = 1234567

    def __init__(self) -> None:
        self.returncode: int | None = None

    def poll(self) -> int | None:
        return self.returncode

    def wait(self, timeout: float) -> int:
        assert timeout == 10
        self.returncode = 0
        return 0


def failed() -> dict[str, object]:
    return {"status": "FAILED_OR_CAPABILITY_UNAVAILABLE", "product_launched": False}


def test_failure_frame_is_outside_the_success_budget_and_retained(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    owner.child = RunningVM()
    owner.pgid = owner.child.pid
    owner.qmp = owner.qmp_stream = SimpleNamespace(close=lambda: None)
    owner.frames = vm.FRAME_CAP
    calls: list[tuple[str, bool]] = []

    def qmp_call(
        execute: str, arguments: dict[str, Any] | None = None, cleanup: bool = False
    ) -> object:
        calls.append((execute, cleanup))
        if execute == "screendump":
            assert arguments is not None
            Path(arguments["filename"]).write_bytes(ppm(640, 480, varied=False))
        return {}

    monkeypatch.setattr(owner, "qmp_call", qmp_call)
    monkeypatch.setattr(vm, "group_exists", lambda _pgid: False)
    result = failed()
    vm.finalize(SimpleNamespace(proof=proof), owner, None, result)
    assert calls == [("screendump", True), ("quit", False)]
    frame = result["failure_frame"]
    assert isinstance(frame, dict)
    assert frame["captured"] is True
    assert frame["distinct_byte_values"] == 1
    assert owner.frames == vm.FRAME_CAP
    retained = proof / "retained" / "failure-final.ppm"
    assert hashlib.sha256(retained.read_bytes()).hexdigest() == frame["sha256"]


class Qemu:
    """QMP answers for finalize(): one screendump fake and a quit hook."""

    def __init__(
        self,
        screendump: Callable[[Path], object],
        at_quit: Callable[[], object] = lambda: None,
    ) -> None:
        self.screendump, self.at_quit = screendump, at_quit
        self.calls: list[str] = []

    def qmp_call(
        self,
        execute: str,
        arguments: dict[str, Any] | None = None,
        cleanup: bool = False,
    ) -> object:
        self.calls.append(execute)
        if execute == "screendump":
            assert arguments is not None
            assert cleanup
            self.screendump(Path(arguments["filename"]))
        elif execute == "quit":
            self.at_quit()
        return {}


def finalized(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    result: dict[str, object],
    qemu: Qemu,
) -> Path:
    """finalize() on a running VM whose QMP answers through the given fake."""
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    owner.child = RunningVM()
    owner.pgid = owner.child.pid
    owner.qmp = owner.qmp_stream = SimpleNamespace(close=lambda: None)
    monkeypatch.setattr(owner, "qmp_call", qemu.qmp_call)
    monkeypatch.setattr(vm, "group_exists", lambda _pgid: False)
    vm.finalize(SimpleNamespace(proof=proof), owner, None, result)
    return proof


def retained_names(proof: Path) -> list[str]:
    return sorted(path.name for path in (proof / "retained").iterdir())


@pytest.mark.parametrize("shape", ["truncated", "over-cap"])
def test_unvalidated_failure_frame_is_deleted_and_never_retained(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, shape: str
) -> None:
    if shape == "truncated":
        frame = ppm(640, 480, varied=True)[:-1000]
    else:
        frame = ppm(1920, 1080, varied=False)
    assert (len(frame) > vm.FRAME_BYTES) is (shape == "over-cap")
    result = failed()
    qemu = Qemu(lambda path: path.write_bytes(frame))
    proof = finalized(vm, tmp_path, monkeypatch, result, qemu)
    assert qemu.calls == ["screendump", "quit"]
    assert result["failure_frame"] == {
        "captured": False,
        "bytes": len(frame),
        "reason": "NOT_BOUNDED_RGB_PPM",
    }
    assert not (proof / "failure-final.ppm").exists()
    retention = result["retention"]
    assert isinstance(retention, dict)
    assert retention["status"] == "FINITE_RETENTION_PASS"
    assert "failure-final.ppm" not in retained_names(proof)


def test_passing_campaign_takes_no_failure_frame(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    result: dict[str, object] = {"status": vm.SCOPED_RESULT, "product_launched": True}
    qemu = Qemu(lambda path: path.write_bytes(ppm(640, 480, varied=True)))
    proof = finalized(vm, tmp_path, monkeypatch, result, qemu)
    assert qemu.calls == ["quit"]
    assert "failure_frame" not in result
    assert result["status"] == vm.SCOPED_RESULT
    assert "failure-final.ppm" not in retained_names(proof)


def test_failure_frame_left_by_a_failed_screendump_reply_is_removed(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def partial(path: Path) -> None:
        # QEMU wrote part of the frame before its QMP reply was lost.
        path.write_bytes(ppm(640, 480, varied=True)[:4096])
        raise TimeoutError("Owned QMP response unavailable")

    result = failed()
    qemu = Qemu(partial)
    proof = finalized(vm, tmp_path, monkeypatch, result, qemu)
    assert qemu.calls == ["screendump", "quit"]
    assert not (proof / "failure-final.ppm").exists()
    assert "failure-final.ppm" not in retained_names(proof)
    assert result["failure_frame"] == {
        "captured": False,
        "error_type": "TimeoutError",
        "unvalidated_frame_removed": True,
    }


def test_failure_frame_finished_after_a_lost_reply_is_removed_after_quit(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    requested: list[Path] = []

    def lost(path: Path) -> None:
        requested.append(path)
        raise TimeoutError("Owned QMP response unavailable")

    def late() -> None:
        # QMP runs the queued screendump to completion before it quits.
        requested[0].write_bytes(ppm(1920, 1080, varied=False))

    result = failed()
    qemu = Qemu(lost, late)
    proof = finalized(vm, tmp_path, monkeypatch, result, qemu)
    assert qemu.calls == ["screendump", "quit"]
    assert not (proof / "failure-final.ppm").exists()
    retention = result["retention"]
    assert isinstance(retention, dict)
    assert retention["status"] == "FINITE_RETENTION_PASS"
    assert result["failure_frame"] == {
        "captured": False,
        "error_type": "TimeoutError",
        "unvalidated_frame_removed": False,
        "late_unvalidated_frame_removed": True,
    }


@pytest.mark.parametrize("content", ["clean", "marker", "host-key-line"])
def test_serial_tail_is_retained_only_without_private_key_material(
    vm: ModuleType, tmp_path: Path, content: str
) -> None:
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    body = b"c3ludGhldGljIGluZXJ0IGhvc3Qga2V5IGJvZHkgbGluZQ"
    (work / "guest_host_key").write_bytes(KEY_MARKER + b"\n" + body + b"\n")
    console = b"".join(b"[ %06d ] cloud-init line\n" % i for i in range(9000))
    if content == "marker":
        console += KEY_MARKER + b"\n"
    elif content == "host-key-line":
        console = body + b"\n" + console
    (work / "guest-serial.log").write_bytes(console)
    result = failed()
    vm.finalize(SimpleNamespace(proof=proof), vm.Owner(work, proof), None, result)
    serial = result["serial_stream"]
    assert isinstance(serial, dict)
    assert serial["full_stream_retained"] is False
    assert serial["bytes"] == len(console)
    tail = proof / "retained" / "guest-serial-tail.log"
    if content == "clean":
        assert serial["reason"] == "BOUNDED_TAIL_SCANNED_NO_PRIVATE_KEY_MATERIAL"
        assert tail.read_bytes() == console[-64 * 1024 :]
    else:
        assert serial["reason"] == "PRIVATE_KEY_MATERIAL_PRESENT"
        assert not tail.exists()
        assert not (proof / "guest-serial-tail.log").exists()


def test_retention_accepts_only_the_one_scanned_console_log_name(
    tmp_path: Path,
) -> None:
    retention = load("ubuntu_gnome_retention")
    (tmp_path / "guest-serial-tail.log").write_bytes(b"bounded console tail\n")
    assert [row["path"] for row in retention.inventory(tmp_path)] == [
        "guest-serial-tail.log"
    ]
    (tmp_path / "provision-locked-install.log").write_bytes(b"raw guest log\n")
    with pytest.raises(ValueError, match="not retainable"):
        retention.inventory(tmp_path)


def test_retention_scope_claim_names_the_scanned_console_tail(tmp_path: Path) -> None:
    retention = load("ubuntu_gnome_retention")
    (tmp_path / "closure.json").write_text("{}\n")
    (tmp_path / "guest-serial-tail.log").write_bytes(b"bounded console tail\n")
    retention.retain(tmp_path)
    manifest = json.loads(
        (tmp_path / "retained" / "retention-manifest.json").read_text()
    )
    assert manifest["scope"] == (
        "FINITE_REGULAR_PROOF_ONLY_NO_DISKS_KEYS_OR_SEED_BOUNDED_SCANNED_CONSOLE_TAIL"
    )
    assert [row["path"] for row in manifest["files"]] == [
        "closure.json",
        "guest-serial-tail.log",
    ]
    summary = (retention.__doc__ or "").lower()
    assert "bootstrap" not in summary
    assert "console" in summary


class WebNode(Node):
    """A WebKitGTK node: it can take native focus through its Component."""

    def get_component_iface(self) -> WebNode:
        return self

    def grab_focus(self) -> bool:
        self.log.append(self.name + ":" + self.role + ":focus")
        return True


def measured_diagnostics_page(guest: ModuleType) -> tuple[Any, list[str]]:
    """The Diagnostics route as diagnostic run 41248905032 measured it.

    WebKitGTK gives the focused route heading (and most other web nodes) one
    unnamed action; the navigation link has "jump", the button has "press".
    """
    log: list[str] = []
    heading = WebNode("Diagnostics", "heading", log, ("",))
    heading.states = {"focused"}
    page = WebNode(
        "Diagnostics · Desktop app",
        "document web",
        log,
        ("",),
        children=[
            WebNode("Skip to main content", "link", log, ("jump",)),
            WebNode("", "header", log, ("",), children=[heading]),
            WebNode("Check again", "push button", log, ("press",)),
            WebNode(
                "",
                "list item",
                log,
                ("select",),
                children=[
                    WebNode("Diagnostics", "link", log, ("jump",)),
                ],
            ),
        ],
    )
    root = Node("Desktop App", "application", log, children=[page])
    value = controller(guest)
    value.app_accessible = lambda: root
    value.shell_frame = lambda: ([0, 0, 1024, 768], "1")
    return value, log


def test_shell_focus_takes_the_route_link_never_the_unnamed_action_heading(
    guest: ModuleType,
) -> None:
    value, log = measured_diagnostics_page(guest)
    value.shell_focus("Diagnostics", "link")
    assert log == ["Diagnostics:link:focus"]
    rows, _objects = value.tree()
    assert guest.controls(rows, "Diagnostics", "heading") == []
    assert [row["role"] for row in rows if row["name"] == "Diagnostics"] == [
        "heading",
        "link",
    ]


def test_shell_focus_refusal_names_its_bounded_candidates(guest: ModuleType) -> None:
    value, log = measured_diagnostics_page(guest)
    with pytest.raises(ValueError, match="required: 0 actionable of") as raised:
        value.shell_focus("Diagnostics", "push button")
    message = str(raised.value)
    assert "('heading', [''], 'header')" in message
    assert "('link', ['jump'], 'list item')" in message
    assert len(message) < 1000
    assert log == []


def test_guest_controls_are_activated_by_exact_role_and_named_action(
    guest: ModuleType,
) -> None:
    value, log = measured_diagnostics_page(guest)
    value.action("Check again", "push button")
    value.action("Diagnostics", "link")
    assert log == ["Check again:press", "Diagnostics:jump"]
    with pytest.raises(ValueError, match="One actionable named native"):
        value.action("Diagnostics", "heading")
    assert log == ["Check again:press", "Diagnostics:jump"]


class VersionNode:
    """A WebKitGTK node in the Desktop versions card; only the region scrolls."""

    def __init__(self, log: list[str], roles: str = "") -> None:
        self.log, self.roles = log, roles

    def get_child_count(self) -> int:
        return 0

    def get_attributes(self) -> dict[str, str]:
        return {"xml-roles": self.roles} if self.roles else {}

    def get_component_iface(self) -> VersionNode:
        return self

    def scroll_to(self, _kind: object) -> bool:
        self.log.append("scroll:" + (self.roles or "leaf"))
        return True


def stacked_versions(guest: ModuleType, showing_after: int) -> tuple[Any, list[str]]:
    """The largest zoom step as diagnostic runs 41249463049 and 41249857437
    measured it: the version rows exist but are offscreen until the whole region
    is scrolled (scrolling one label shows only that label); then SHOWING
    arrives after `showing_after` cache clears."""
    log: list[str] = []
    value = controller(guest)
    value.atspi.ScrollType = SimpleNamespace(TOP_EDGE="top")
    rows = [
        {"id": 0, "name": "Desktop versions", "text": ""},
        {"id": 1, "name": "Desktop versions", "text": ""},
        {"id": 2, "name": "", "text": "App version"},
    ]
    objects = [VersionNode(log, "region"), VersionNode(log), VersionNode(log)]
    value.tree = lambda: (rows, objects)
    value.shell_version_rows = lambda found, _objects: found
    clears: list[int] = []

    class Root:
        def clear_cache(self) -> None:
            clears.append(1)
            log.append("clear")

    value.app_accessible = Root

    def shell_text(text: str, *, versions: bool) -> dict[str, Any]:
        assert versions
        log.append("text:" + text)
        if "scroll:region" not in log or len(clears) < showing_after:
            raise guest.OffscreenTextError("Actual Text leaf is hidden or offscreen")
        return {"text": text}

    value.shell_text = shell_text
    value.shell_frame = lambda: ([0, 0, 1214, 768], "1:1")
    value.shell_backing = lambda: {"kind": "MUTTER"}
    return value, log


def test_shell_measure_scrolls_the_versions_before_any_visibility_check(
    guest: ModuleType,
) -> None:
    value, log = stacked_versions(guest, showing_after=3)
    result = value.shell_measure("step4")
    assert log[0] == "scroll:region"
    assert result["anchors"] == [{"text": label} for label in guest.ANCHORS]
    assert log.count("clear") == 3
    assert log[-3:] == ["text:Tauri version", *("text:" + a for a in guest.ANCHORS)]


def test_shell_measure_still_refuses_rows_that_never_show(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = Clock()
    monkeypatch.setattr(guest, "time", clock)
    value, log = stacked_versions(guest, showing_after=10**6)
    started = clock.now
    with pytest.raises(guest.OffscreenTextError, match="hidden or offscreen"):
        value.shell_measure("step4")
    elapsed = clock.now - started
    # KI-0164: the version rows get at most 2 s to show after the scroll.
    assert guest.SHELL_SETTLE_SECONDS == 2
    assert guest.SHELL_SETTLE_SECONDS <= elapsed < guest.SHELL_SETTLE_SECONDS + 1
    # One cache clear per 0.1 s poll, give or take the last float step.
    assert 21 <= log.count("clear") <= 22
    assert log[0] == "scroll:region"


def test_shell_measure_never_retries_other_refusals(guest: ModuleType) -> None:
    value, log = stacked_versions(guest, showing_after=1)

    def wraps(text: str, *, versions: bool) -> dict[str, Any]:
        assert versions
        log.append("text:" + text)
        raise ValueError("Actual complete selected glyph range wraps or is unknown")

    value.shell_text = wraps
    with pytest.raises(ValueError, match="wraps"):
        value.shell_measure("step4")
    assert log == ["scroll:region", "clear", "text:Tauri version"]


class FocusableLink(WebNode):
    """A link that takes the focus; WebKitGTK then marks its ancestors too."""

    def __init__(self, name: str, log: list[str], ancestors: list[Node]) -> None:
        super().__init__(name, "link", log, ("jump",))
        self.ancestors = ancestors

    def grab_focus(self) -> bool:
        super().grab_focus()
        for node in [self, *self.ancestors]:
            node.states = {"focused"}
        return True


def measured_focus_page(guest: ModuleType) -> tuple[Any, list[str]]:
    """Diagnostic run 41250366992: after Home takes the focus, the scroll pane
    and the named document are FOCUSED too."""
    log: list[str] = []
    pane = WebNode("", "scroll pane", log, ("",))
    document = WebNode("Diagnostics · Desktop app", "document web", log, ("",))
    home = FocusableLink("Home", log, [pane, document])
    item = WebNode("", "list item", log, ("select",), children=[home])
    document.children = [item]
    pane.children = [document]
    root = Node("Desktop App", "application", log, children=[pane])
    value = controller(guest)
    value.app_accessible = lambda: root
    return value, log


def test_keyboard_origin_is_the_deepest_focused_node(guest: ModuleType) -> None:
    value, log = measured_focus_page(guest)
    result = value.keyboard("keyboard_before")
    assert log == ["Home:link:focus"]
    assert value.keyboard_origin == ("Home", "link")
    assert [row["role"] for row in result["focused"]] == [
        "scroll pane",
        "document web",
        "link",
    ]
    rows, _objects = value.tree()
    assert [row["name"] for row in guest.focus_leaves(rows)] == ["Home"]


def test_focus_leaves_keep_each_deepest_focus_and_refuse_cycles(
    guest: ModuleType,
) -> None:
    rows = [
        {"id": 0, "parent": None, "focused": True},
        {"id": 1, "parent": 0, "focused": True},
        {"id": 2, "parent": 1, "focused": False},
        {"id": 3, "parent": 0, "focused": True},
        {"id": 4, "parent": 2, "focused": True},
    ]
    assert [row["id"] for row in guest.focus_leaves(rows)] == [3, 4]
    cyclic = [
        {"id": 0, "parent": 1, "focused": True},
        {"id": 1, "parent": 0, "focused": False},
    ]
    with pytest.raises(ValueError, match="cyclic"):
        guest.focus_leaves(cyclic)
