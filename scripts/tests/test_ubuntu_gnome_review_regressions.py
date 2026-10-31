"""Synthetic filesystem and observer contracts; no native/package/network actor."""

from __future__ import annotations

import ast
import hashlib
import importlib
import importlib.util
import json
import os
import shutil
import stat
import sys
from importlib.machinery import PathFinder
from pathlib import Path, PurePath, PurePosixPath, PureWindowsPath
from types import ModuleType, SimpleNamespace

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
SUBJECT = Path(os.environ.get("JAPP_GNOME_REVIEW_SUBJECT", str(SOURCE)))
sys.path.insert(0, str(SUBJECT))


def guest_fixture_path[GuestPath: PurePath](
    sandbox: GuestPath, value: str | PurePath
) -> GuestPath:
    """Contain a Linux guest path lexically inside the host's own fixture."""
    selected = PurePosixPath(str(value))
    if (
        not sandbox.is_absolute()
        or selected.anchor != "/"
        or ".." in selected.parts
        or PureWindowsPath(str(value)).drive
        or "\\" in str(value)
    ):
        raise ValueError("Only absolute contained POSIX guest fixture paths allowed")
    converted = sandbox.joinpath(*selected.parts[1:])
    if not converted.is_relative_to(sandbox):
        raise ValueError("Guest fixture path escaped its own sandbox")
    return converted


@pytest.mark.parametrize("flavor", [PurePosixPath, PureWindowsPath])
def test_guest_fixture_path_contains_posix_paths_on_both_host_models(
    flavor: type[PurePosixPath] | type[PureWindowsPath],
) -> None:
    sandbox = flavor(
        "/owned/fixture" if flavor is PurePosixPath else "C:/owned/fixture"
    )
    for value in ("/home/japp-ci", "/opt/japp-ci", "/etc/gdm3/custom.conf"):
        result = guest_fixture_path(sandbox, value)
        assert result.is_relative_to(sandbox)
        assert (
            result.parts[-len(PurePosixPath(value).parts[1:]) :]
            == PurePosixPath(value).parts[1:]
        )
    for invalid in ("relative", "/../outside", "C:/outside", "//server/share"):
        with pytest.raises(ValueError, match="POSIX guest fixture"):
            guest_fixture_path(sandbox, invalid)


def test_generated_guest_payload_reaches_provision_and_installed_imports(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    vm, provision = load("ubuntu_gnome_vm"), load("ubuntu_gnome_provision")
    work, package, closure = (
        tmp_path / "work",
        tmp_path / "package",
        tmp_path / "closure",
    )
    work.mkdir()
    package.mkdir()
    (closure / "debs").mkdir(parents=True)
    for name in ("export.json", "deb-inspection.json", "package.deb"):
        (package / name).write_bytes(("synthetic inert " + name).encode())
    (closure / "lock.json").write_text('{"synthetic": true}\n')
    (closure / "debs/fixture.deb").write_bytes(b"synthetic inert archive")
    commands = []

    class Owner:
        def __init__(self) -> None:
            self.work = work

        def command(self, argv: list[str]) -> bytes:
            commands.append(argv)
            if argv[0] == vm.TOOLS["keygen"]:
                key = Path(argv[-1])
                key.write_text("SYNTHETIC INERT FIXTURE NOT A KEY\n")
                key.with_suffix(".pub").write_text("SYNTHETIC INERT PUBLIC FIXTURE\n")
            elif argv[0] not in (vm.TOOLS["qemu_img"], vm.TOOLS["seed"]):
                raise AssertionError(
                    "No executable tool is authorized by this pure fixture"
                )
            return b""

    class PortSelection:
        def __enter__(self) -> PortSelection:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def bind(self, address: tuple[str, int]) -> None:
            assert address == ("127.0.0.1", 0)

        def getsockname(self) -> tuple[str, int]:
            return ("127.0.0.1", 12345)

    monkeypatch.setattr(vm.socket, "socket", PortSelection)
    vm.prepare_guest(
        SimpleNamespace(package=package, guest_closure=closure),
        Owner(),
        tmp_path / "inert-image",
        {"packages": [{"filename": "fixture.deb"}]},
        {"files": ["deb-inspection.json", "package.deb"]},
    )
    cloud = json.loads((work / "user-data").read_text().removeprefix("#cloud-config\n"))
    invocation = cloud["runcmd"][-1]
    assert invocation[0] == "/usr/bin/python3"
    consumer = PurePosixPath(invocation[1]).relative_to("/mnt/jappinput")
    payload = work / "input"
    target = payload.joinpath(*consumer.parts)
    assert target.is_file(), (
        "Generated guest consumer must resolve an actual copied helper"
    )
    assert target.read_bytes() == (SUBJECT / "ubuntu_gnome_provision.py").read_bytes()
    assert len(commands) == 4
    for name in vm.SCRIPTS:
        assert (payload / "scripts" / name).read_bytes() == (
            SUBJECT / name
        ).read_bytes()
    monkeypatch.setattr(provision, "INPUT", payload)
    installed = tmp_path / "installed-controller"
    provision.copy_controller_inputs(installed)
    for name in (*provision.SCRIPTS, "export.json", "deb-inspection.json"):
        expected = (
            payload / ("scripts" if name in provision.SCRIPTS else "package") / name
        )
        assert (installed / name).read_bytes() == expected.read_bytes()
    for directory, names in (
        (payload / "scripts", vm.SCRIPTS),
        (installed, provision.SCRIPTS),
    ):
        for name in names:
            tree = ast.parse((directory / name).read_text())
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.ImportFrom)
                    and node.module
                    and node.module.startswith("ubuntu_gnome_")
                ):
                    resolved = PathFinder.find_spec(node.module, [str(directory)])
                    assert resolved is not None
                    assert resolved.origin is not None
                    assert Path(resolved.origin).parent == directory
                    assert (
                        Path(resolved.origin).read_bytes()
                        == (SUBJECT / (node.module + ".py")).read_bytes()
                    )


def load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, SUBJECT / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def test_actual_provision_writer_supplies_exact_controller_export(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if sys.platform == "win32":
        monkeypatch.setitem(sys.modules, "pwd", ModuleType("pwd"))
    provision, guest = load("ubuntu_gnome_provision"), load("ubuntu_gnome_guest")
    sandbox, inputs = tmp_path / "guest", tmp_path / "inputs"
    for name in ("opt", "etc/gdm3", "etc/dconf", "home/japp-ci"):
        (sandbox / name).mkdir(parents=True)
    (inputs / "scripts").mkdir(parents=True)
    (inputs / "package").mkdir()
    for name in provision.SCRIPTS:
        (inputs / "scripts" / name).write_bytes(
            ("synthetic inert fixture " + name).encode()
        )
    installed = tmp_path / "installed"
    rows = []
    for name in (guest.MAIN, guest.SERVICE):
        path = installed / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(("synthetic nonexecutable fixture " + name).encode())
        rows.append(
            {
                "path": name,
                "bytes": path.stat().st_size,
                "mode": stat.S_IMODE(path.stat().st_mode),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
    exported = (json.dumps({"installed_files": rows}) + "\n").encode()
    (inputs / "package/export.json").write_bytes(exported)
    (inputs / "package/deb-inspection.json").write_text('{"fixture": true}\n')
    uid, gid = installed.stat().st_uid, installed.stat().st_gid
    identity = SimpleNamespace(pw_dir="/home/japp-ci", pw_uid=uid, pw_gid=gid)
    if not hasattr(provision, "pwd"):
        account = importlib.import_module("pwd")
    else:
        account = provision.pwd
    monkeypatch.setattr(account, "getpwnam", lambda _name: identity, raising=False)
    monkeypatch.setattr(provision.os, "chown", lambda *_args: None, raising=False)
    monkeypatch.setattr(guest.os, "geteuid", lambda: uid, raising=False)
    monkeypatch.setattr(guest.os, "getegid", lambda: gid, raising=False)

    def sandbox_path(value: str | Path) -> Path:
        return guest_fixture_path(sandbox, value)

    def command(argv: list[str], _log: Path, _seconds: float) -> None:
        if argv[0] == "/usr/bin/dpkg-deb":
            relocated = Path(argv[-1])
            for row in rows:
                source = installed / str(row["path"])
                target = relocated / str(row["path"])
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

    monkeypatch.setattr(provision, "Path", sandbox_path)
    monkeypatch.setattr(provision, "INPUT", inputs)
    monkeypatch.setattr(provision, "STATE", tmp_path)
    monkeypatch.setattr(provision, "run", command)
    provision.initialize_desktop(inputs / "package/package.deb")
    copied = sandbox / "opt/japp-ci"
    monkeypatch.setattr(guest, "INPUT", copied)
    assert (copied / "export.json").read_bytes() == exported
    controller = guest.Controller.__new__(guest.Controller)
    result = controller.package_binding(
        sandbox / "home/japp-ci/Job Apply ünicode space"
    )
    assert set(result) == {guest.MAIN, guest.SERVICE}


def test_resolve_retains_replayable_signed_index_archive_chain(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepare = load("ubuntu_gnome_prepare")
    root, destination = tmp_path / "apt", tmp_path / "retained"
    payload = b"synthetic inert package bytes"
    pin = hashlib.sha256(payload).hexdigest()
    index = (
        "Package: fixturepkg\nVersion: 1\nArchitecture: amd64\n"
        "Filename: pool/f/fixturepkg.deb\n"
        f"Size: {len(payload)}\nSHA256: {pin}\n\n"
    ).encode()
    release = (
        "Origin: Ubuntu\nSuite: noble\nCodename: noble\nSHA256:\n "
        + hashlib.sha256(index).hexdigest()
        + " "
        + str(len(index))
        + " main/binary-amd64/Packages\n"
    ).encode()

    def config(selected: Path) -> Path:
        (selected / "archives").mkdir(parents=True)
        (selected / "lists").mkdir()
        (selected / "archives/fixturepkg.deb").write_bytes(payload)
        (selected / "lists/fixture_InRelease").write_bytes(b"SYNTHETIC NOT A SIGNATURE")
        (selected / "lists/index-from-apt").write_bytes(index)
        (selected / "ubuntu-archive-keyring.gpg").write_bytes(b"SYNTHETIC NOT A KEY")
        (selected / "sources.list").write_text("synthetic fixture sources\n")
        path = selected / "apt.conf"
        path.write_text("synthetic fixture configuration\n")
        return path

    class Owner:
        def command(self, argv: list[str], **_kwargs: object) -> bytes:
            if "/usr/bin/dpkg-deb" in argv or "/usr/bin/apt-cache" in argv:
                return index
            if "indextargets" in argv:
                return (
                    "Identifier: Packages\nMetaKey: main/binary-amd64/Packages\n"
                    "Filename: "
                    + str(root / "lists/index-from-apt")
                    + "\nTrusted: yes\nSuite: noble\nArchitecture: amd64\n"
                    + "Site: https://archive.ubuntu.com/ubuntu\n\n"
                ).encode()
            if "/usr/bin/gpgv" in argv and "--output" in argv:
                Path(argv[argv.index("--output") + 1]).write_bytes(release)
            return b""

    monkeypatch.setattr(prepare, "apt_config", config)
    result = prepare.resolve(Owner(), root, destination, ("fixturepkg",))
    assert "signed_index_chain" in result
    chain = result["signed_index_chain"]
    assert chain["packages"][0]["sha256"] == pin
    retained = destination / "signed-metadata" / chain["indexes"][0]["filename"]
    assert retained.read_bytes() == index
    assert chain["indexes"][0]["sha256"] == hashlib.sha256(index).hexdigest()
    assert chain["indexes"][0]["bytes"] == len(index)


def session_model(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[ModuleType, Path]:
    session = load("ubuntu_gnome_session_receipt")
    # This pure model injects a Linux guest host together with its fake session
    # observations. Independent boundary cases exercise the real host guard.
    monkeypatch.setattr(session, "require_linux", lambda: None, raising=False)
    uid = tmp_path.stat().st_uid
    output = tmp_path / "actual-gnome-session.json"
    os_release = tmp_path / "os-release"
    os_release.write_text('ID=ubuntu\nVERSION_ID="24.04"\n')
    monkeypatch.setattr(session.os, "geteuid", lambda: uid, raising=False)
    monkeypatch.setattr(session.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(session.platform, "release", lambda: "synthetic fixture")
    for key, value in {
        "XDG_SESSION_ID": "fixture",
        "XDG_SESSION_TYPE": "wayland",
        "GDMSESSION": "ubuntu",
        "XDG_CURRENT_DESKTOP": "GNOME",
        "GNOME_SHELL_SESSION_MODE": "ubuntu",
        "XDG_RUNTIME_DIR": f"/run/user/{uid}",
        "WAYLAND_DISPLAY": "wayland-0",
    }.items():
        monkeypatch.setenv(key, value)
    original_metadata = session.metadata

    def metadata(path: Path) -> dict[str, object]:
        if path == tmp_path:
            # Project the synthetic Linux guest's private mode on either host;
            # byte/hash filesystem observations remain real own-fixture reads.
            return {**original_metadata(path), "mode": 0o700}
        if path.name == "wayland-0":
            return {"socket": True, "symlink": False}
        result: dict[str, object] = original_metadata(path)
        return result

    def path(value: str | Path) -> Path:
        return os_release if str(value) == "/etc/os-release" else Path(value)

    def command(_argv: list[str]) -> dict[str, object]:
        properties = {
            "User": str(uid),
            "Class": "user",
            "Service": "gdm-autologin",
            "Seat": "seat0",
            "Active": "yes",
            "State": "active",
            "Type": "wayland",
        }
        return {
            "exit_code": 0,
            "stdout": "\n".join(k + "=" + v for k, v in properties.items()),
        }

    monkeypatch.setattr(session, "Path", path)
    monkeypatch.setattr(session, "metadata", metadata)
    monkeypatch.setattr(session, "command", command)
    monkeypatch.setattr(
        session,
        "observe_shell",
        lambda: (
            {},
            {
                "uid": uid,
                "executable": "/usr/bin/gnome-shell",
                "headless_or_nested": False,
            },
        ),
    )
    monkeypatch.setattr(
        session, "public_system_file", lambda _path: {"synthetic": True}
    )
    return session, output


@pytest.mark.parametrize(
    "outcome", ["retained", "observer_raises", "reaped_group", "unavailable"]
)
def test_late_optional_observer_custody_refuses_session_ready_and_is_retried(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, outcome: str
) -> None:
    session, output = session_model(tmp_path, monkeypatch)

    class Custody:
        pgid = 7654321
        signals: tuple[str, ...] = ()
        child = SimpleNamespace(returncode=0 if outcome == "reaped_group" else None)
        attempts = 0

        def terminate_unreaped(self) -> None:
            self.attempts += 1
            raise TimeoutError("synthetic retained child; no actual signal")

        def is_reaped(self) -> bool:
            return self.child.returncode is not None

    custody = Custody()

    def secret() -> dict[str, object]:
        if outcome == "reaped_group":
            session._STATE.observed.append(custody)
        elif outcome != "unavailable":
            session._STATE.pending.append(custody)
        if outcome == "observer_raises":
            raise RuntimeError("synthetic late observer failure")
        return {"state": "UNAVAILABLE", "synthetic": True}

    monkeypatch.setattr(session, "secret_service_capability", secret)
    monkeypatch.setattr(
        session, "public_system_file", lambda _path: {"synthetic": True}
    )
    monkeypatch.setattr(session, "observation_group", lambda _custody: "EXISTS")
    monkeypatch.setattr(
        session.sys if hasattr(session, "sys") else sys,
        "argv",
        ["fixture", "--output", str(output)],
    )
    if outcome == "observer_raises":
        with pytest.raises(RuntimeError, match="late observer failure"):
            session.main()
        assert not output.exists()
        assert custody.attempts >= 1
        closeout = json.loads((tmp_path / "observation-closeout.json").read_text())
        assert closeout["closed"] is False
        assert closeout["retained_unreaped_count"] == 1
        return
    code = session.main()
    receipt = json.loads(output.read_text())
    if outcome == "unavailable":
        assert code == 0
        assert receipt["status"] == "SESSION_READY"
        assert receipt["secret_service"]["state"] == "UNAVAILABLE"
        return
    assert code == 78
    assert receipt["status"] != "SESSION_READY"
    assert receipt["checks"]["observation_children_closed"] is False
    if outcome == "reaped_group":
        assert custody.attempts == 0
        assert session._STATE.pending == []
    else:
        assert custody.attempts >= 1
        assert session._STATE.pending == [custody]


@pytest.mark.parametrize("corrupt", ["export.json", "ubuntu_gnome_guest.py"])
def test_controller_input_copy_refuses_corrupted_receipt_or_script(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, corrupt: str
) -> None:
    provision = load("ubuntu_gnome_provision")
    inputs = tmp_path / "inputs"
    for directory in ("scripts", "package"):
        (inputs / directory).mkdir(parents=True)
    for name in provision.SCRIPTS:
        (inputs / "scripts" / name).write_bytes(b"synthetic inert script")
    for name in ("export.json", "deb-inspection.json"):
        (inputs / "package" / name).write_bytes(b"synthetic inert receipt")
    original = provision.shutil.copyfile

    def corrupted(source: Path, target: Path) -> Path:
        original(source, target)
        if target.name == corrupt:
            target.write_bytes(b"changed copy")
        return target

    monkeypatch.setattr(provision, "INPUT", inputs)
    monkeypatch.setattr(provision.shutil, "copyfile", corrupted)
    with pytest.raises(ValueError, match="input bytes changed"):
        provision.copy_controller_inputs(tmp_path / "controller")
