"""Windows 11 firmware console and installation boot key contracts.

Diagnostic run 41171253889 booted the pinned Evaluation ISO under the
harness's exact QEMU argv: OVMF wrote ANSI control sequences and BdsDxe lines
to COM1 within 1.2 s, which the strict JAPP11 protocol parser refuses, and the
media loader's 'Press any key to boot from CD or DVD' prompt ran from about
2.3 s to its 5.5 s time-out, before the former fixed +8 s key. Run
41172293108 then booted the corrected argv to Windows Setup with the
firmware-triggered key and showed OVMF writing the identical console bytes to
COM2 as well. Pure socket pairs and fakes only; no QEMU, KVM, QMP server or VM
actor.
"""

from __future__ import annotations

import importlib.util
import json
import re
import select
import socket
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "linux_gnome"))
sys.path.insert(0, str(ROOT / "windows11"))

# Exact bytes OVMF wrote to COM1 in diagnostic run 41171253889.
OBSERVED_CONSOLE = (
    b"\x1b[2J\x1b[01;01H\x1b[=3h\x1b[2J\x1b[01;01H"
    b'BdsDxe: failed to load Boot0001 "UEFI QEMU QEMU USB HARDDRIVE 1-0000:00:01.0-1"'
    b" from PciRoot(0x0)/Pci(0x1,0x0)/USB(0x0,0x0): Not Found\r\n"
    b'BdsDxe: loading Boot0002 "UEFI QEMU DVD-ROM QM00003 " from'
    b" PciRoot(0x0)/Pci(0x1F,0x2)/Sata(0x1,0xFFFF,0x0)\r\n"
    b'BdsDxe: starting Boot0002 "UEFI QEMU DVD-ROM QM00003 " from'
    b" PciRoot(0x0)/Pci(0x1F,0x2)/Sata(0x1,0xFFFF,0x0)\r\n"
)
SEED_STARTED = (
    b'BdsDxe: starting Boot0003 "UEFI QEMU DVD-ROM QM00005 " from'
    b" PciRoot(0x0)/Pci(0x1F,0x2)/Sata(0x2,0xFFFF,0x0)\r\n"
)


@pytest.fixture
def vm(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    # The Linux VM host module imports fcntl; give a Windows verify host an
    # inert stand-in so the pure contracts below run on every host.
    if "fcntl" not in sys.modules:
        try:
            import fcntl  # noqa: F401, PLC0415 - POSIX verify hosts only
        except ImportError:
            monkeypatch.setitem(sys.modules, "fcntl", ModuleType("fcntl"))
    name = "windows11_vm"
    spec = importlib.util.spec_from_file_location(
        name, ROOT / "windows11" / (name + ".py")
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_firmware_console_is_com1_and_the_guest_protocol_is_com2_alone(
    vm: ModuleType, tmp_path: Path
) -> None:
    argv = vm.qemu_argv(tmp_path, tmp_path / "media.iso", tmp_path / "seed.iso")
    serial = [argv[i + 1] for i, value in enumerate(argv) if value == "-device"]
    assert [d for d in serial if d.startswith("isa-serial")] == [
        "isa-serial,chardev=firmware,index=0",
        "isa-serial,chardev=proof,index=1",
    ]
    chardevs = [argv[i + 1] for i, value in enumerate(argv) if value == "-chardev"]
    assert (
        "socket,id=firmware,path="
        + str(tmp_path / "firmware.sock")
        + (",server=on,wait=off")
        in chardevs
    )
    assert (
        "socket,id=proof,path="
        + str(tmp_path / "serial.sock")
        + (",server=on,wait=off")
        in chardevs
    )
    assert "-serial" not in argv


def test_guest_writes_its_protocol_to_com2_only() -> None:
    source = (ROOT / "windows11" / "windows11_guest.ps1").read_text()
    assert re.findall(r"COM[0-9]+", source) == ["COM2"]


@pytest.mark.parametrize(
    ("console", "started"),
    [
        (OBSERVED_CONSOLE, True),
        (OBSERVED_CONSOLE.rsplit(b"\r\n", 2)[0] + b"\r\n", False),
        (OBSERVED_CONSOLE[:-2], False),
        (SEED_STARTED, False),
        (b"", False),
    ],
    ids=["media-started", "media-loading", "partial-line", "seed-media", "empty"],
)
def test_only_ovmfs_own_reviewed_media_start_line_triggers_the_key(
    vm: ModuleType, console: bytes, started: bool
) -> None:
    assert vm.installation_media_started(console) is started


class Child:
    returncode = None

    def poll(self) -> None:
        return None


Started = tuple[object, list[tuple[float, list[str]]], float]


@pytest.fixture
def harness(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Callable[[bytes, bytes, float], Started]]:
    sockets: list[socket.socket] = []
    owners: list[Any] = []

    def start(console: bytes, serial: bytes, seconds: float) -> Started:
        proof, work = tmp_path / "proof", tmp_path / "work"
        proof.mkdir()
        work.mkdir()
        owner = vm.Owner(work, proof)
        owner.child = Child()
        owners.append(owner)
        owner.work_deadline = time.monotonic() + seconds
        pairs = {name: socket.socketpair() for name in ("qmp", "firmware", "serial")}
        for pair in pairs.values():
            sockets.extend(pair)
        pairs["qmp"][1].sendall(b'{"QMP": {"version": {}}}\n')
        pairs["firmware"][1].sendall(console)
        pairs["serial"][1].sendall(serial)
        monkeypatch.setattr(
            vm, "connect", lambda path, _owner: pairs[Path(path).name.split(".")[0]][0]
        )
        keys: list[tuple[float, list[str]]] = []
        monkeypatch.setattr(owner, "qmp_call", lambda *_args: {})
        monkeypatch.setattr(
            owner, "keys", lambda codes: keys.append((time.monotonic(), codes))
        )
        return owner, keys, time.monotonic()

    yield start
    for owner in owners:
        if owner.qmp_stream is not None:
            owner.qmp_stream.close()
    for value in sockets:
        value.close()


def test_one_boot_key_answers_the_media_prompt_and_console_is_retained(
    vm: ModuleType, tmp_path: Path, harness: Callable[[bytes, bytes, float], Started]
) -> None:
    owner, keys, began = harness(OBSERVED_CONSOLE, b"", 2.5)
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")
    assert [codes for _at, codes in keys] == [["spc"]]
    assert keys[0][0] - began >= vm.BOOT_KEY_DELAY
    retained = tmp_path / "proof" / "firmware-console.raw"
    assert retained.read_bytes() == OBSERVED_CONSOLE
    assert (tmp_path / "proof" / "guest-serial.raw").read_bytes() == b""


def test_firmware_never_starting_the_media_fails_fast_without_a_key(
    vm: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    harness: Callable[[bytes, bytes, float], Started],
) -> None:
    monkeypatch.setattr(vm, "BOOT_MEDIA_SECONDS", 0.3)
    owner, keys, _began = harness(SEED_STARTED, b"", 30)
    with pytest.raises(TimeoutError, match="never started the reviewed"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")
    assert keys == []


def test_exact_firmware_mirror_on_the_protocol_port_is_accepted(
    vm: ModuleType, tmp_path: Path, harness: Callable[[bytes, bytes, float], Started]
) -> None:
    owner, keys, _began = harness(OBSERVED_CONSOLE, OBSERVED_CONSOLE, 2.5)
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")
    assert [codes for _at, codes in keys] == [["spc"]]
    raw = (tmp_path / "proof" / "guest-serial.raw").read_bytes()
    assert raw == OBSERVED_CONSOLE


@pytest.mark.parametrize(
    "serial",
    [
        OBSERVED_CONSOLE.replace(b"QM00003", b"QM00004"),
        b"guest text that OVMF never wrote\r\n",
        b"".join(reversed(OBSERVED_CONSOLE.splitlines(keepends=True))),
    ],
    ids=["altered-mirror", "unmirrored-text", "reordered-mirror"],
)
def test_protocol_port_text_that_is_not_the_exact_firmware_mirror_is_refused(
    vm: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    harness: Callable[[bytes, bytes, float], Started],
    serial: bytes,
) -> None:
    monkeypatch.setattr(vm, "MIRROR_SECONDS", 0.2)
    owner, _keys, _began = harness(OBSERVED_CONSOLE, serial, 5)
    with pytest.raises(ValueError, match="Closed bounded owned-guest protocol"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")


UNMIRRORED = b"guest text that OVMF never wrote\r\n"


class Clock:
    """The VM module's own clock, advanced only by a select that times out."""

    def __init__(self) -> None:
        # An integer start keeps start + whole seconds exact in every binade.
        self.now = float(int(time.monotonic()))

    def monotonic(self) -> float:
        return self.now


def retained_bytes(path: Path) -> int:
    # Read, never stat: Windows may report a stale size for a file still open.
    return len(path.read_bytes()) if path.is_file() else 0


@pytest.fixture
def paced(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Callable[[bytes, float], SimpleNamespace]]:
    """observe() on a fake clock that only an idle select advances, by its wait.

    COM2 is sent only once observe() retained all of COM1, so OVMF's lines
    precede their mirror; while sent bytes are unread, a select waits for
    them in real time instead of advancing the clock. Real time never
    decides an outcome here.
    """
    sockets: list[socket.socket] = []

    def start(serial: bytes, seconds: float) -> SimpleNamespace:
        clock = Clock()
        monkeypatch.setattr(vm, "time", clock)
        proof, work = tmp_path / "proof", tmp_path / "work"
        proof.mkdir()
        work.mkdir()
        owner = vm.Owner(work, proof)
        owner.child = Child()
        owner.work_deadline = clock.now + seconds
        pairs = {name: socket.socketpair() for name in ("firmware", "serial")}
        for pair in pairs.values():
            sockets.extend(pair)
        pairs["firmware"][1].sendall(OBSERVED_CONSOLE)
        console, retained = proof / "firmware-console.raw", proof / "guest-serial.raw"
        state = SimpleNamespace(
            clock=clock,
            owner=owner,
            sent_at=None,
            read_at=None,
            lifecycles=[],
            pairs=pairs,
        )

        def paced_select(
            read: list[Any], write: list[Any], error: list[Any], timeout: float
        ) -> tuple[list[Any], list[Any], list[Any]]:
            if state.sent_at is None and retained_bytes(console) == len(
                OBSERVED_CONSOLE
            ):
                pairs["serial"][1].sendall(serial)
                state.sent_at = clock.now
            if state.read_at is None and retained_bytes(retained) == len(serial):
                # Nothing advanced the clock since observe() read the last line.
                state.read_at = clock.now
            unread = retained_bytes(console) < len(OBSERVED_CONSOLE) or (
                state.sent_at is not None and retained_bytes(retained) < len(serial)
            )
            ready = select.select(read, write, error, 10 if unread else 0.02)
            if not any(ready):
                clock.now += timeout
            return ready

        def lifecycle(receipts: list[dict[str, Any]], *_args: object) -> None:
            state.lifecycles.append([row["phase"] for row in receipts])

        monkeypatch.setattr(vm, "select", SimpleNamespace(select=paced_select))
        monkeypatch.setattr(
            vm,
            "connect",
            lambda path, _owner: pairs.get(Path(path).name.split(".")[0], (None,))[0],
        )
        monkeypatch.setattr(owner, "qmp_open", lambda _client: None)
        monkeypatch.setattr(owner, "keys", lambda _codes: None)
        monkeypatch.setattr(
            owner,
            "frame",
            lambda name: {"file": name + ".ppm", "width": 1280, "height": 800},
        )
        monkeypatch.setattr(vm, "attest_guest", lambda *_args: None)
        monkeypatch.setattr(vm, "lifecycle", lifecycle)
        monkeypatch.setattr(vm, "validate_capture", lambda *_args: None)
        return state

    yield start
    for value in sockets:
        value.close()


def test_unmirrored_text_after_the_firmware_lines_is_refused_after_its_window(
    vm: ModuleType, paced: Callable[[bytes, float], SimpleNamespace]
) -> None:
    # The exact mirror uses up OVMF's three lines; the next COM2 line has no
    # firmware line left to equal and no terminal row follows it.
    state = paced(OBSERVED_CONSOLE + UNMIRRORED, 60)
    with pytest.raises(ValueError, match="Closed bounded owned-guest protocol"):
        vm.observe(state.owner, "a" * 64, "b" * 64, "cpu")
    assert state.read_at is not None
    waited = state.clock.now - state.read_at
    assert vm.MIRROR_SECONDS < waited < vm.MIRROR_SECONDS + 1.5
    assert state.clock.now < state.owner.work_deadline


@pytest.mark.parametrize(
    ("before_terminal", "accepted"),
    [(b"", True), (UNMIRRORED, False)],
    ids=["mirror-only", "unmirrored-text"],
)
def test_unmirrored_text_just_before_a_terminal_pass_is_never_part_of_it(
    vm: ModuleType,
    paced: Callable[[bytes, float], SimpleNamespace],
    before_terminal: bytes,
    accepted: bool,
) -> None:
    nonce, package = "a" * 64, "b" * 64
    display = {"display_width": 1280, "display_height": 800, "package_sha256": package}

    def line(row: dict[str, object]) -> bytes:
        bound = {**row, "nonce": nonce, "package_sha256": package}
        return b"JAPP11 " + json.dumps(bound).encode() + b"\r\n"

    receipts = b"".join(
        line({"phase": phase, "status": "PASS", "attestation": display})
        if phase == "environment"
        else line({"phase": phase, "status": "PASS"})
        for phase in vm.REQUIRED_PHASES
    )
    serial = OBSERVED_CONSOLE + receipts + before_terminal + line({"terminal": "PASS"})
    state = paced(serial, 60)
    if accepted:
        observed = vm.observe(state.owner, nonce, package, "cpu")
        assert observed["terminal"]["terminal"] == "PASS"
        assert state.lifecycles == [list(vm.REQUIRED_PHASES)]
        return
    with pytest.raises(ValueError, match="Closed bounded owned-guest protocol"):
        vm.observe(state.owner, nonce, package, "cpu")
    # Refused by the terminal row itself, well inside the mirror window, and
    # never validated as a PASS.
    assert state.clock.now - state.sent_at < vm.MIRROR_SECONDS
    assert state.lifecycles == []


class OneChunk:
    """The guest's serial end, delivering everything it was sent in one recv."""

    def __init__(self, end: socket.socket, size: int) -> None:
        self.end, self.size = end, size

    def __enter__(self) -> OneChunk:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.end.close()

    def fileno(self) -> int:
        return self.end.fileno()

    def sendall(self, data: bytes) -> None:
        self.end.sendall(data)

    def recv(self, _limit: int) -> bytes:
        data = b""
        self.end.settimeout(10)
        while len(data) < self.size:
            data += self.end.recv(65536)
        return data


def test_bytes_received_with_the_terminal_row_are_refused(
    vm: ModuleType,
    paced: Callable[[bytes, float], SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # The guest closes COM2 after its terminal row; anything read with that
    # row is outside the closed protocol and never part of a PASS.
    nonce, package = "a" * 64, "b" * 64
    display = {"display_width": 1280, "display_height": 800, "package_sha256": package}

    def line(row: dict[str, object]) -> bytes:
        bound = {**row, "nonce": nonce, "package_sha256": package}
        return b"JAPP11 " + json.dumps(bound).encode() + b"\r\n"

    receipts = b"".join(
        line({"phase": phase, "status": "PASS", "attestation": display})
        if phase == "environment"
        else line({"phase": phase, "status": "PASS"})
        for phase in vm.REQUIRED_PHASES
    )
    serial = receipts + line({"terminal": "PASS"}) + b"text after the terminal row"
    state = paced(OBSERVED_CONSOLE + serial, 60)
    connect = vm.connect
    whole = len(OBSERVED_CONSOLE + serial)
    monkeypatch.setattr(
        vm,
        "connect",
        lambda path, owner: (
            OneChunk(state.pairs["serial"][0], whole)
            if Path(path).name == "serial.sock"
            else connect(path, owner)
        ),
    )
    with pytest.raises(ValueError, match="Closed bounded owned-guest protocol"):
        vm.observe(state.owner, nonce, package, "cpu")
    assert state.lifecycles == []


def test_firmware_console_output_is_bounded(
    vm: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    harness: Callable[[bytes, bytes, float], Started],
) -> None:
    monkeypatch.setattr(vm, "FIRMWARE_CONSOLE_CAP", len(OBSERVED_CONSOLE) - 1)
    owner, _keys, _began = harness(OBSERVED_CONSOLE, b"", 5)
    with pytest.raises(ValueError, match="firmware console output exceeds cap"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")


def test_protocol_receipts_on_com2_still_reach_the_ordered_parser(
    vm: ModuleType, tmp_path: Path, harness: Callable[[bytes, bytes, float], Started]
) -> None:
    row = {"phase": "unexpected", "status": "PASS", "nonce": "a" * 64}
    row["package_sha256"] = "b" * 64
    line = b"JAPP11 " + json.dumps(row).encode() + b"\r\n"
    owner, _keys, _began = harness(OBSERVED_CONSOLE, OBSERVED_CONSOLE + line, 5)
    with pytest.raises(ValueError, match="Complete ordered actual guest phase"):
        vm.observe(owner, "a" * 64, "b" * 64, "cpu")
    raw = (tmp_path / "proof" / "guest-serial.raw").read_bytes()
    assert raw == OBSERVED_CONSOLE + line


def test_no_fixed_time_boot_key_remains(vm: ModuleType) -> None:
    source = (ROOT / "windows11" / "windows11_vm.py").read_text()
    assert "boot_key_at" not in source
    assert vm.BOOT_KEY_DELAY < 3
