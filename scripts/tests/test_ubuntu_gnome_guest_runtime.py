"""Guest facts measured in the real GDM session (diagnostic run 41171253889).

PyGObject returns the Accessible itself as its Action interface, so
iface.get_name(0) raised TypeError and get_action_name(0) answered 'activate'
(KI-0151). Ubuntu's needrestart apt hook restarted ssh and systemd-networkd
after the locked install and the host channel never returned (KI-0149), and
the reviewed closure's install log reached 242,847 bytes (KI-0153). Pure
fakes only; no GI, subprocess, apt or VM actor.
"""

from __future__ import annotations

import ast
import importlib
import importlib.util
import json
import sys
import time
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import IO

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
sys.path.insert(0, str(SOURCE))


def load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class Accessible:
    """Shaped like gi.repository.Atspi.Accessible, its own Action interface."""

    def get_name(self) -> str:
        return "Quit"

    def get_action_iface(self) -> Accessible:
        return self

    def get_n_actions(self) -> int:
        return 2

    def get_action_name(self, index: int) -> str:
        return ("activate", "press")[index]


def test_action_names_use_the_action_interface_not_accessible_get_name() -> None:
    guest = load("ubuntu_gnome_guest")
    controller = object.__new__(guest.Controller)
    controller.work_deadline = controller.operation_deadline = time.monotonic() + 60
    assert controller.accessible_actions(Accessible()) == ["activate", "press"]


class TextAccessible:
    """Shaped like Atspi.Accessible: its own Text interface, and a deprecated
    get_text() alias (atspi_accessible_get_text) that shadows Text.get_text."""

    value = "Ready"

    def get_text_iface(self) -> TextAccessible:
        return self

    def get_text(self) -> TextAccessible:
        return self

    def get_character_count(self) -> int:
        return len(self.value)


def test_accessible_text_reads_through_the_text_interface_class() -> None:
    # Measured in the real GDM session (diagnostic run 41233236511, KI-0162):
    # interface.get_text(0, count) raised "Atspi.Accessible.get_text() takes
    # exactly 1 argument (3 given)" on the first launch.
    guest = load("ubuntu_gnome_guest")
    controller = object.__new__(guest.Controller)
    controller.work_deadline = controller.operation_deadline = time.monotonic() + 60
    calls: list[tuple[object, int, int]] = []

    def get_text(interface: TextAccessible, start: int, end: int) -> str:
        calls.append((interface, start, end))
        return interface.value[start:end]

    controller.atspi = SimpleNamespace(Text=SimpleNamespace(get_text=get_text))
    node = TextAccessible()
    assert controller.accessible_text(node) == "Ready"
    assert calls == [(node, 0, 5)]


class Child:
    pid = 4242
    returncode = 0

    def poll(self) -> int:
        return 0


@pytest.fixture
def provision(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    if sys.platform == "win32":
        monkeypatch.setitem(sys.modules, "pwd", ModuleType("pwd"))
    module = load("ubuntu_gnome_provision")
    monkeypatch.setattr(module.os, "getpgid", lambda pid: pid, raising=False)
    return module


def fake_installer(
    module: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    environments: list[dict[str, str]],
    size: int,
) -> None:
    def popen(_argv: list[str], *, stdout: IO[bytes], **kwargs: object) -> Child:
        environment = kwargs["env"]
        assert isinstance(environment, dict)
        environments.append(environment)
        stdout.write(b"x" * size)
        return Child()

    monkeypatch.setattr(module.subprocess, "Popen", popen)


def test_guest_installs_suspend_the_needrestart_apt_hook(
    provision: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    environments: list[dict[str, str]] = []
    fake_installer(provision, monkeypatch, environments, 10)
    provision.run(["/usr/bin/apt-get", "install"], tmp_path / "install.log", 5)
    assert environments == [
        {
            "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
            "DEBIAN_FRONTEND": "noninteractive",
            "NEEDRESTART_SUSPEND": "1",
        }
    ]
    assert provision.PENDING == []


def test_measured_install_log_fits_its_own_cap_but_not_the_default(
    provision: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_installer(provision, monkeypatch, [], 300_000)
    provision.run(["/usr/bin/apt-get"], tmp_path / "a.log", 5, cap=2 * 1024 * 1024)
    with pytest.raises(RuntimeError, match="preserve exact raw log"):
        provision.run(["/usr/bin/apt-get"], tmp_path / "b.log", 5)


def test_locked_install_alone_receives_the_larger_log_cap() -> None:
    tree = ast.parse((SOURCE / "ubuntu_gnome_provision.py").read_text())
    caps = {
        ast.unparse(node.args[1]): next(
            (ast.unparse(k.value) for k in node.keywords if k.arg == "cap"), None
        )
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "run"
    }
    assert caps.pop("STATE / 'locked-install.log'") == "2 * 1024 * 1024"
    assert caps
    assert set(caps.values()) == {None}


@pytest.mark.parametrize(
    ("planted", "link"),
    [
        ("provision-dconf.log", False),
        ("provision-failure.json", False),
        ("provision-dconf.log", True),
    ],
    ids=["dconf-log", "failure-receipt", "dangling-symlink"],
)
def test_root_never_replaces_a_name_the_synthetic_account_planted(
    provision: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    planted: str,
    link: bool,
) -> None:
    home, state = tmp_path / "home", tmp_path / "state"
    home.mkdir()
    state.mkdir()
    (state / "dconf.log").write_bytes(b"dconf updated\n")
    identity = SimpleNamespace(pw_dir=str(home), pw_uid=1000, pw_gid=1001)
    account = importlib.import_module("pwd")
    monkeypatch.setattr(account, "getpwnam", lambda _name: identity, raising=False)
    monkeypatch.setattr(provision, "ACCOUNT_HOME", home)
    monkeypatch.setattr(provision, "STATE", state)
    name = home / "japp-proof" / planted
    planted_bytes = b"planted by the synthetic account\n"

    outside = tmp_path / "outside"

    def chown(path: Path, _uid: int, _gid: int) -> None:
        # Once the proof directory is the account's, it can create names there.
        assert path == home / "japp-proof"
        if link:
            # A dangling link to a path root could otherwise create.
            name.symlink_to(outside)
        else:
            name.write_bytes(planted_bytes)

    published: list[int] = []
    monkeypatch.setattr(provision.os, "chown", chown, raising=False)
    monkeypatch.setattr(
        provision.os, "fchown", lambda fd, *_ids: published.append(fd), raising=False
    )
    failure = RuntimeError("synthetic step failure") if "failure" in planted else None
    with pytest.raises(FileExistsError):
        provision.publish_evidence(failure)
    if link:
        assert name.is_symlink()
        assert not outside.exists()
    else:
        assert name.read_bytes() == planted_bytes
    assert len(published) == (1 if failure else 0)


def test_failure_receipt_keeps_only_the_last_eight_kib_of_the_step_log(
    provision: ModuleType, tmp_path: Path
) -> None:
    log = tmp_path / "locked-install.log"
    data = b"".join(b"%07d\n" % line for line in range(3000))
    log.write_bytes(data)
    provision.PROGRESS.phase, provision.PROGRESS.log = "locked-install", log
    receipt = json.loads(provision.failure_receipt(RuntimeError("x"), [], None))
    assert receipt["log_bytes"] == len(data) == 24000
    assert receipt["log_tail_cap_bytes"] == 8 * 1024
    assert receipt["log_tail"] == data[-8 * 1024 :].decode()
