"""GNOME VM runtime contracts: KVM only, bounded slow readiness polls, a
bounded closeout, and only validated frames retained.

Hosted diagnostic run 41165269919 measured the reviewed guest under the
harness's former TCG argv: the locked install took about 1000 s and SSH
readiness polls exceeded their 6 s bound 18 times, while KVM reached the GDM
desktop in about 195 s with every poll within 3.01 s. Pure fakes only; no
subprocess, KVM device, QMP socket or VM actor.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import time
from collections.abc import Callable
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import IO, Any

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
sys.path.insert(0, str(SOURCE))


@pytest.fixture
def vm() -> ModuleType:
    name = "ubuntu_gnome_vm"
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class PlanOwner:
    """Records reviewed commands and makes the two ed25519 key pairs."""

    def __init__(self, work: Path) -> None:
        self.work = work
        self.commands: list[list[str]] = []

    def command(self, argv: list[str], **_kwargs: object) -> bytes:
        self.commands.append(argv)
        if argv[0].endswith("ssh-keygen"):
            key = Path(argv[-1])
            key.write_text("synthetic private key\n")
            key.with_suffix(".pub").write_text("ssh-ed25519 AAAAsynthetic fixture\n")
        return b""


def test_gnome_vm_plan_uses_kvm_with_no_software_fallback(
    vm: ModuleType, tmp_path: Path
) -> None:
    work, package, closure = tmp_path / "work", tmp_path / "pkg", tmp_path / "lock"
    work.mkdir()
    package.mkdir()
    (package / "export.json").write_text("{}\n")
    (closure / "debs").mkdir(parents=True)
    (closure / "lock.json").write_text('{"packages": []}\n')
    args = SimpleNamespace(package=package, guest_closure=closure)
    plan = vm.prepare_guest(
        args, PlanOwner(work), tmp_path / "image", {"packages": []}, {"files": {}}
    )
    accel = plan.argv.index("-accel")
    assert plan.argv[accel : accel + 4] == ["-accel", "kvm", "-cpu", "host"]
    assert plan.argv.count("-accel") == 1
    assert not any("tcg" in value for value in plan.argv)


class FakeFcntl:
    def __init__(self, version: int) -> None:
        self.version = version
        self.calls: list[int] = []

    def ioctl(self, _descriptor: int, request: int, _arg: int) -> int:
        self.calls.append(request)
        return self.version


def test_kvm_capability_requires_a_character_device(
    vm: ModuleType, tmp_path: Path
) -> None:
    device = tmp_path / "kvm"
    device.write_bytes(b"")
    with pytest.raises(ValueError, match="KVM character device required"):
        vm.kvm(PlanOwner(tmp_path), device)


def test_kvm_refuses_a_non_device_before_any_linux_only_import(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A host without fcntl (Windows) still gets the device refusal.
    monkeypatch.setitem(sys.modules, "fcntl", None)
    device = tmp_path / "kvm"
    device.write_bytes(b"")
    owner = PlanOwner(tmp_path)
    with pytest.raises(ValueError, match="KVM character device required"):
        vm.kvm(owner, device)
    assert owner.commands == []


@pytest.mark.parametrize("version", [12, 11])
def test_kvm_capability_grants_only_the_runner_uid_and_requires_api_12(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, version: int
) -> None:
    device = tmp_path / "kvm"
    device.write_bytes(b"")
    fake = FakeFcntl(version)
    monkeypatch.setitem(sys.modules, "fcntl", fake)
    monkeypatch.setattr(vm.stat, "S_ISCHR", lambda _mode: True)
    monkeypatch.setattr(vm.os, "access", lambda _path, _mode: False)
    monkeypatch.setattr(vm.os, "getuid", lambda: 1001, raising=False)
    owner = PlanOwner(tmp_path)
    if version != 12:
        with pytest.raises(ValueError, match="no software emulation fallback"):
            vm.kvm(owner, device)
    else:
        assert vm.kvm(owner, device) == {
            "device": str(device),
            "api_version": 12,
            "acceleration": "KVM",
            "tcg_fallback": False,
        }
    assert owner.commands == [
        ["/usr/bin/sudo", "-n", "/usr/bin/setfacl", "-m", "u:1001:rw", str(device)]
    ]
    assert fake.calls == [0xAE00]


def test_setfacl_is_a_reviewed_host_tool(vm: ModuleType) -> None:
    # The tool loop pins each binary to the reviewed acl archive's bytes.
    assert vm.TOOLS["setfacl"] == "/usr/bin/setfacl"


@pytest.mark.parametrize(
    ("answer", "accepted"),
    [
        ({"enabled": True, "present": True}, True),
        ({"enabled": False, "present": True}, False),
        ({"enabled": False, "present": False}, False),
    ],
)
def test_vm_launch_requires_qemus_own_kvm_answer(
    vm: ModuleType, answer: dict[str, bool], accepted: bool
) -> None:
    calls: list[str] = []

    def qmp_call(execute: str) -> dict[str, bool]:
        calls.append(execute)
        return answer

    owner = SimpleNamespace(qmp_call=qmp_call)
    if accepted:
        vm.require_kvm_acceleration(owner)
    else:
        with pytest.raises(ValueError, match="not KVM accelerated"):
            vm.require_kvm_acceleration(owner)
    assert calls == ["query-kvm"]


class Qmp:
    """QEMU's QMP socket: its greeting, then one reply per request."""

    def __init__(self, kvm: dict[str, bool]) -> None:
        self.kvm = kvm
        self.lines = [b'{"QMP": {"version": {}, "capabilities": []}}\n']
        self.requests: list[str] = []
        self.connected: list[str] = []

    def settimeout(self, _seconds: float) -> None:
        return None

    def connect(self, path: str) -> None:
        self.connected.append(path)

    def makefile(self, _mode: str) -> Qmp:
        return self

    def sendall(self, data: bytes) -> None:
        execute = json.loads(data)["execute"]
        self.requests.append(execute)
        answer = self.kvm if execute == "query-kvm" else {}
        self.lines.append(json.dumps({"return": answer, "id": execute}).encode())

    def readline(self, _limit: int) -> bytes:
        return self.lines.pop(0)


@pytest.mark.parametrize(
    "answer",
    [{"enabled": True, "present": True}, {"enabled": False, "present": True}],
    ids=["kvm", "unaccelerated"],
)
def test_vm_launch_itself_refuses_an_unaccelerated_qemu(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    answer: dict[str, bool],
) -> None:
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    qmp = Qmp(answer)
    started: list[list[str]] = []

    def popen(argv: list[str], **kwargs: object) -> Child:
        assert kwargs["start_new_session"] is True
        started.append(argv)
        return Child()

    def unix_socket(family: str, kind: str) -> Qmp:
        assert (family, kind) == ("AF_UNIX", "SOCK_STREAM")
        return qmp

    # No AF_UNIX on Windows: the module's own socket name is replaced instead.
    sockets = SimpleNamespace(
        AF_UNIX="AF_UNIX", SOCK_STREAM="SOCK_STREAM", socket=unix_socket
    )
    monkeypatch.setattr(vm, "socket", sockets)
    monkeypatch.setattr(vm.subprocess, "Popen", popen)
    monkeypatch.setattr(vm.os, "getpgid", lambda pid: pid, raising=False)
    plan = vm.VMPlan(["/usr/bin/qemu-system-x86_64"], work / "qmp.sock", ["ssh"])
    plan.qmp_path.write_bytes(b"")
    owner = vm.Owner(work, proof)
    if answer["enabled"]:
        vm.launch_vm(SimpleNamespace(proof=proof), owner, plan)
    else:
        with pytest.raises(ValueError, match="not KVM accelerated"):
            vm.launch_vm(SimpleNamespace(proof=proof), owner, plan)
    assert started == [plan.argv]
    assert qmp.connected == [str(plan.qmp_path)]
    assert qmp.requests == ["qmp_capabilities", "query-kvm"]


def reviewed_host(tmp_path: Path, vm: ModuleType) -> dict[str, str]:
    """Synthetic host tools pinned by a synthetic host lock; returns TOOLS."""
    tools = {}
    for name in vm.TOOLS:
        path = tmp_path / "tools" / name
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(b"synthetic inert host tool " + name.encode())
        tools[name] = str(path)
    (tmp_path / "host-lock.json").write_text(
        json.dumps(
            {
                "runner_image_version": "synthetic-image-1",
                "tools": {
                    name: {"path": path, "sha256": vm.sha(Path(path))}
                    for name, path in tools.items()
                },
            }
        )
    )
    return tools


def reviewed_closure(root: Path) -> None:
    (root / "debs").mkdir(parents=True)
    archive = root / "debs/fixture_1_amd64.deb"
    archive.write_bytes(b"synthetic inert archive")
    (root / "lock.json").write_text(
        json.dumps(
            {
                "schema": "japp-reviewed-noble-closure-v1",
                "architecture": "amd64",
                "signed_metadata": {"synthetic": True},
                "packages": [
                    {
                        "filename": archive.name,
                        "bytes": archive.stat().st_size,
                        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                    }
                ],
            }
        )
    )


@pytest.mark.parametrize("version", [12, 11])
def test_input_preparation_runs_the_kvm_check_and_retains_its_receipt(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, version: int
) -> None:
    proof, work, package = tmp_path / "proof", tmp_path / "work", tmp_path / "pkg"
    for path in (proof, work, package):
        path.mkdir()
    (package / "export.json").write_text("{}\n")
    reviewed_closure(tmp_path / "closure")
    monkeypatch.setattr(vm, "TOOLS", reviewed_host(tmp_path, vm))
    monkeypatch.setenv(vm.RUNNER_IMAGE_VERSION_ENV, "synthetic-image-1")
    meminfo = tmp_path / "meminfo"
    meminfo.write_text("MemTotal: 16000000 kB\nMemAvailable: 12000000 kB\n")

    def host_path(value: str | Path) -> Path:
        return meminfo if str(value) == "/proc/meminfo" else Path(value)

    monkeypatch.setattr(vm, "Path", host_path)
    free = SimpleNamespace(free=64 * 1024**3)
    monkeypatch.setattr(vm, "shutil", SimpleNamespace(disk_usage=lambda _p: free))
    # The real kvm() runs on a synthetic device in place of /dev/kvm.
    device = tmp_path / "kvm"
    device.write_bytes(b"")
    monkeypatch.setattr(vm.kvm, "__defaults__", (device,))
    fake = FakeFcntl(version)
    monkeypatch.setitem(sys.modules, "fcntl", fake)
    monkeypatch.setattr(vm.stat, "S_ISCHR", lambda _mode: True)
    monkeypatch.setattr(vm.os, "access", lambda _path, _mode: True)
    owner = PlanOwner(work)
    args = SimpleNamespace(
        proof=proof,
        package=package,
        package_export_sha256="0" * 64,
        guest_closure=tmp_path / "closure",
        guest_closure_sha256=vm.sha(tmp_path / "closure/lock.json"),
        host_tools_lock=tmp_path / "host-lock.json",
        host_tools_lock_sha256=vm.sha(tmp_path / "host-lock.json"),
    )
    # The deliberately unreviewed export ends preparation right after KVM.
    refusal = "Reviewed exact package export differs" if version == 12 else "API12"
    with pytest.raises(ValueError, match=refusal):
        vm.prepare_inputs(args, owner)
    assert fake.calls == [0xAE00]
    assert owner.commands == []
    preflight = json.loads((proof / "resource-preflight.json").read_text())
    assert preflight["acceleration"] == "KVM_NO_SOFTWARE_FALLBACK"
    if version == 12:
        assert json.loads((proof / "kvm.json").read_text()) == {
            "device": str(device),
            "api_version": 12,
            "acceleration": "KVM",
            "tcg_fallback": False,
        }
    else:
        assert not (proof / "kvm.json").exists()


class Child:
    pid = 4242

    def __init__(self) -> None:
        self.returncode: int | None = None

    def poll(self) -> int | None:
        return self.returncode


class Custody:
    """Reaps the fake child without any real signal on any verify host."""

    def __init__(self, child: Child, pgid: int) -> None:
        self.child, self.pgid = child, pgid
        self.group_verified = False
        self.signals = ["SIGTERM"]

    def terminate_unreaped(self) -> None:
        self.child.returncode = -15


def owned(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, group: bool
) -> Any:  # noqa: ANN401 - the loaded module's own Owner
    monkeypatch.setattr(vm.subprocess, "Popen", lambda *_args, **_kwargs: Child())
    monkeypatch.setattr(vm, "ChildCustody", Custody)
    monkeypatch.setattr(vm.os, "getpgid", lambda pid: pid, raising=False)
    monkeypatch.setattr(vm, "group_exists", lambda _pgid: group)
    monkeypatch.setattr(vm.time, "sleep", lambda _seconds: None)
    return vm.Owner(tmp_path, tmp_path)


def test_own_command_bound_is_a_distinct_reaped_deadline(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = owned(vm, tmp_path, monkeypatch, group=False)
    with pytest.raises(vm.CommandDeadlineError):
        owner.command(["/reviewed/fixture"], seconds=0, permit_failure=True)
    record = json.loads((tmp_path / "command-001.json").read_bytes())
    assert record["primary_error_type"] == "CommandDeadlineError"
    assert record["direct_child_reaped"] is True
    assert record["group_after_reap"] == "ABSENT"
    assert owner.pending_commands == []


def test_deadline_with_surviving_group_is_not_a_tolerable_slow_poll(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = owned(vm, tmp_path, monkeypatch, group=True)
    with pytest.raises(RuntimeError, match="left owned process state"):
        owner.command(["/reviewed/fixture"], seconds=0, permit_failure=True)


def test_output_cap_and_outer_authority_remain_fatal_timeouts(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = owned(vm, tmp_path, monkeypatch, group=False)
    monkeypatch.setattr(owner, "vm_output_exceeded", lambda: True)
    with pytest.raises(TimeoutError) as raised:
        owner.command(["/reviewed/fixture"], seconds=60, permit_failure=True)
    assert not isinstance(raised.value, vm.CommandDeadlineError)
    owner.work_deadline = time.monotonic() - 1
    with pytest.raises(TimeoutError) as expired:
        owner.command(["/reviewed/fixture"], seconds=60, permit_failure=True)
    assert not isinstance(expired.value, vm.CommandDeadlineError)


@pytest.mark.parametrize("written", [16, 17], ids=["at-cap", "past-cap"])
def test_output_past_its_cap_during_the_reap_stays_fatal(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, written: int
) -> None:
    owner = owned(vm, tmp_path, monkeypatch, group=False)
    streams: list[IO[bytes]] = []

    def popen(_argv: list[str], *, stdout: IO[bytes], **_kwargs: object) -> Child:
        streams.append(stdout)
        return Child()

    class Loud(Custody):
        """The slow child writes its output while it is being reaped."""

        def terminate_unreaped(self) -> None:
            streams[0].write(b"x" * written)
            super().terminate_unreaped()

    monkeypatch.setattr(vm.subprocess, "Popen", popen)
    monkeypatch.setattr(vm, "ChildCustody", Loud)
    if written <= 16:
        with pytest.raises(vm.CommandDeadlineError):
            owner.command(["/reviewed/fixture"], seconds=0, cap=16, permit_failure=True)
    else:
        # The existing fatal path, never the tolerated slow-poll deadline.
        with pytest.raises(RuntimeError, match="raw output retained"):
            owner.command(["/reviewed/fixture"], seconds=0, cap=16, permit_failure=True)
    record = json.loads((tmp_path / "command-001.json").read_bytes())
    assert record["primary_error_type"] == "CommandDeadlineError"
    assert record["raw_bytes"] == written
    assert record["output_cap_exceeded"] is (written > 16)
    assert record["direct_child_reaped"] is True
    assert owner.pending_commands == []


class Clock:
    """The VM module's own clock, advanced only by owned commands' bounds."""

    def __init__(self) -> None:
        # An integer start keeps every deadline sum exact in every binade.
        self.now = 1000.0

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


class Guest:
    """Answers owned SSH reads; each read takes its whole own bound."""

    def __init__(
        self,
        owner: Any,  # noqa: ANN401 - the loaded module's own Owner
        clock: Clock,
        listing: bytes,
    ) -> None:
        self.owner, self.clock, self.listing = owner, clock, listing
        self.remotes: list[str] = []
        self.seconds: set[float] = set()

    def command(
        self,
        argv: list[str],
        seconds: float = 30,
        cap: int = 256 * 1024,
        permit_failure: bool = False,
        cleanup: bool = False,
    ) -> bytes:
        assert (permit_failure, cleanup, cap > 0) == (True, True, True)
        self.owner.sequence += 1
        self.clock.now += seconds
        self.seconds.add(seconds)
        remote = argv[-1]
        self.remotes.append(remote)
        if remote.startswith("/usr/bin/find "):
            stdout = self.listing
        elif remote.endswith(".json"):
            stdout = json.dumps({"guest": remote.rsplit("/", 1)[-1]}).encode()
        else:
            stdout = b"bounded synthetic guest text\n"
        stem = self.owner.proof / ("command-" + str(self.owner.sequence).zfill(3))
        stem.with_suffix(".stdout").write_bytes(stdout)
        stem.with_suffix(".json").write_text(json.dumps({"exit_code": 0}))
        return stdout


def closeout_guest(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, listing: bytes
) -> tuple[Any, Guest, Clock]:
    clock = Clock()
    monkeypatch.setattr(vm, "time", clock)
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    owner.ssh = ["/usr/bin/ssh"]
    owner.child = SimpleNamespace(returncode=None)
    guest = Guest(owner, clock, listing)
    monkeypatch.setattr(owner, "command", guest.command)
    return owner, guest, clock


FIND = "/usr/bin/find /home/japp-ci/japp-proof -maxdepth 1 -printf '%M %s %f\\n'"
CAT = "/usr/bin/cat /home/japp-ci/japp-proof/"
JOURNAL = "/usr/bin/journalctl --user -b --no-pager -n 400"


@pytest.mark.parametrize(
    ("budget", "reads"),
    [
        (9, []),
        (10, [FIND]),
        (20, [FIND, CAT + "provision-failure.json"]),
        (30, [FIND, CAT + "provision-failure.json", CAT + "controller-exit.json"]),
        (
            40,
            [
                FIND,
                CAT + "provision-failure.json",
                CAT + "controller-exit.json",
                JOURNAL,
            ],
        ),
        (
            50,
            [
                FIND,
                CAT + "provision-failure.json",
                CAT + "controller-exit.json",
                JOURNAL,
                CAT + "provision-locked-install.log",
            ],
        ),
    ],
    ids=["9s", "10s", "20s", "30s", "40s", "50s"],
)
def test_closeout_starts_no_read_that_could_reach_the_final_reserve(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    budget: int,
    reads: list[str],
) -> None:
    listing = (
        b"-rw------- 20 provision-failure.json\n"
        b"-rw------- 20 controller-exit.json\n"
        b"-rw------- 30 provision-locked-install.log\n"
    )
    owner, guest, clock = closeout_guest(vm, tmp_path, monkeypatch, listing)
    # 30 s stay reserved for the VM quit and the final source guard; every read
    # may take its whole 10 s bound, so one starts only if it ends by then.
    owner.cleanup_deadline = clock.now + 30 + budget
    vm.capture_guest_closeout(owner)
    assert guest.remotes == reads
    assert guest.seconds <= {10}
    assert clock.now <= owner.cleanup_deadline - 30


def test_closeout_reads_only_regular_files_from_the_guest_listing(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Names the synthetic account could plant as a link, directory or FIFO.
    listing = (
        b"lrwxrwxrwx 10 provision-failure.json\n"
        b"drwx------ 4096 15-quit_menu.json\n"
        b"prw------- 0 provision-dconf.log\n"
        b"srw------- 0 controller.sock\n"
        b"-rw------- 20 controller-exit.json\n"
    )
    assert vm.guest_proof_files(listing) == {"controller-exit.json"}
    owner, guest, _clock = closeout_guest(vm, tmp_path, monkeypatch, listing)
    vm.capture_guest_closeout(owner)
    assert guest.remotes == [FIND, CAT + "controller-exit.json", JOURNAL]
    assert sorted(path.name for path in owner.proof.glob("*-*.json")) == [
        "command-001.json",
        "command-002.json",
        "command-003.json",
        "controller-exit.json",
    ]


@pytest.mark.parametrize(
    "name",
    [
        "",
        "../provision.json",
        "provision.json.bak",
        "x y.json",
        "evil;rm.json",
        "1-launch.json",
        "1000-launch.json",
        "15-Quit.json",
        "15-quit_menu.json/../../../etc/shadow",
        "provision-locked-install.log",
        "15-../provision.json",
        "15-a/b.json",
    ],
    ids=[
        "empty",
        "parent-escape",
        "suffixed",
        "space",
        "shell-separator",
        "one-digit-sequence",
        "four-digit-sequence",
        "uppercase",
        "path-after-receipt",
        "log-not-json",
        "sequence-then-parent-escape",
        "sequence-then-subfolder",
    ],
)
def test_guest_receipt_fetch_takes_only_closed_names(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    owner, guest, _clock = closeout_guest(vm, tmp_path, monkeypatch, b"")
    with pytest.raises(ValueError, match="Closed guest receipt name required"):
        vm.fetch_guest_json(owner, name)
    assert guest.remotes == []
    for allowed in (
        "provision.json",
        "15-quit_menu.json",
        "105-shell_scale_step1.json",
    ):
        assert vm.fetch_guest_json(owner, allowed) is True
    owner.ssh = None
    with pytest.raises(ValueError, match="Closed guest receipt name required"):
        vm.fetch_guest_json(owner, "provision-failure.json")
    assert guest.remotes == [
        CAT + "provision.json",
        CAT + "15-quit_menu.json",
        CAT + "105-shell_scale_step1.json",
    ]


def test_serial_tail_scans_at_most_sixteen_mib_of_console(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    serial = work / "guest-serial.log"
    with serial.open("wb") as stream:
        stream.truncate(16 * 1024 * 1024 + 1)

    def unbounded(*_args: object) -> object:
        raise AssertionError("An over-cap console is never read into memory")

    with monkeypatch.context() as scope:
        scope.setattr(Path, "read_bytes", unbounded)
        scope.setattr(vm, "private_key_material", unbounded)
        over = vm.serial_tail(owner, serial)
    assert (over["tail_retained"], over["reason"]) == (False, "EXCEEDS_SCAN_CAP")
    assert over["bytes"] == 16 * 1024 * 1024 + 1
    assert not (proof / vm.SERIAL_TAIL).exists()
    with serial.open("r+b") as shorter:
        shorter.truncate(16 * 1024 * 1024)
    at = vm.serial_tail(owner, serial)
    assert at["tail_retained"] is True
    assert at["tail_bytes"] == 64 * 1024
    assert (proof / vm.SERIAL_TAIL).read_bytes() == bytes(64 * 1024)


class SessionOwner:
    """Replays readiness polls: each entry is an exit code or an exception."""

    def __init__(
        self, proof: Path, polls: list[object], session: dict[str, object]
    ) -> None:
        self.proof, self.polls, self.session = proof, polls, session
        self.sequence = 0
        self.child = SimpleNamespace(poll=lambda: None)
        self.work_deadline = time.monotonic() + 3600

    def vm_output_exceeded(self) -> bool:
        return False

    def command(self, argv: list[str], **_kwargs: object) -> bytes:
        self.sequence += 1
        stem = self.proof / ("command-" + str(self.sequence).zfill(3))
        if argv[-1].endswith("actual-gnome-session.json"):
            stem.with_suffix(".stdout").write_text(json.dumps(self.session))
            return stem.with_suffix(".stdout").read_bytes()
        outcome = self.polls.pop(0)
        code = None if isinstance(outcome, BaseException) else outcome
        stem.with_suffix(".stdout").write_bytes(b"PROVISIONED\n")
        stem.with_suffix(".json").write_text(json.dumps({"exit_code": code}))
        if isinstance(outcome, BaseException):
            raise outcome
        return b"PROVISIONED\n"


def test_slow_readiness_poll_is_recorded_not_fatal(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(vm.time, "sleep", lambda _seconds: None)
    session = {"status": "SESSION_READY", "synthetic": True}
    owner = SessionOwner(
        tmp_path,
        [vm.CommandDeadlineError("slow"), 1, vm.CommandDeadlineError("slow"), 0],
        session,
    )
    args = SimpleNamespace(proof=tmp_path)
    assert vm.observe_session(args, owner, ["/usr/bin/ssh"]) == session
    assert owner.polls == []
    assert json.loads((tmp_path / "actual-gnome-session.json").read_text()) == session


@pytest.mark.parametrize(
    "failure", [TimeoutError("outer authority"), RuntimeError("left owned state")]
)
def test_other_readiness_poll_failures_still_end_observation(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: BaseException,
) -> None:
    monkeypatch.setattr(vm.time, "sleep", lambda _seconds: None)
    owner = SessionOwner(tmp_path, [failure, 0], {"status": "SESSION_READY"})
    with pytest.raises(type(failure)):
        vm.observe_session(SimpleNamespace(proof=tmp_path), owner, ["/usr/bin/ssh"])
    assert not (tmp_path / "actual-gnome-session.json").exists()


# Frames: only a validated frame is ever retained.

REMOVAL_ERRORS = {"IsADirectoryError", "PermissionError"}


def frame_bytes(width: int, height: int, varied: bool = True) -> bytes:
    size = width * height * 3
    pixels = bytes(i % 251 for i in range(size)) if varied else bytes(size)
    return b"P6\n%d %d\n255\n" % (width, height) + pixels


def rejected_frame(shape: str) -> tuple[bytes, str]:
    """Frame bytes the phase bounds refuse, and the refusal they raise."""
    if shape == "bad-header":
        grey = bytes(i % 251 for i in range(640 * 480))
        return b"P5\n640 480\n255\n" + grey, "Actual QMP RGB frame required"
    if shape == "oversize":
        oversize = b"P6\n640 480\n255\n" + bytes(4 * 1024 * 1024)
        return oversize, "Guest frame exceeded cap"
    return frame_bytes(640, 480, varied=False), "blank/insufficient display"


def screendump_writing(body: bytes) -> Callable[..., object]:
    """A QMP fake whose screendump writes the given frame bytes."""

    def qmp_call(
        execute: str, arguments: dict[str, Any] | None = None, cleanup: bool = False
    ) -> object:
        assert (execute, cleanup) == ("screendump", False)
        assert arguments is not None
        Path(arguments["filename"]).write_bytes(body)
        return {}

    return qmp_call


@pytest.mark.parametrize("shape", ["bad-header", "oversize", "blank"])
def test_a_rejected_phase_frame_is_removed_before_its_refusal(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, shape: str
) -> None:
    body, message = rejected_frame(shape)
    owner = vm.Owner(tmp_path / "work", tmp_path)
    monkeypatch.setattr(owner, "qmp_call", screendump_writing(body))
    with pytest.raises(ValueError, match=message):
        owner.frame("session-before-product")
    assert not (tmp_path / "session-before-product.ppm").exists()
    assert owner.frames == 1


def test_a_refused_frame_that_cannot_be_removed_surfaces_and_stays_registered(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = vm.Owner(tmp_path / "work", tmp_path)
    monkeypatch.setattr(owner, "qmp_call", screendump_writing(b"not a PPM frame\n"))

    def unlink(_path: Path, missing_ok: bool = False) -> None:
        del missing_ok
        raise PermissionError("synthetic removal refusal")

    monkeypatch.setattr(Path, "unlink", unlink)
    with pytest.raises(PermissionError, match="synthetic removal refusal") as raised:
        owner.frame("session-before-product")
    assert isinstance(raised.value.__context__, ValueError)
    # The late removal after closure retries it and records a second failure.
    assert owner.late_frames == [tmp_path / "session-before-product.ppm"]


class QuittingVM(Child):
    """A running QEMU that exits on the quit closure sends."""

    def wait(self, timeout: float) -> int:
        assert timeout == 10
        self.returncode = 0
        return 0


class Qemu:
    """QMP for finalize(): the failure frame's screendump and late phase frames.

    A phase frame's reply is always lost; at quit QEMU finishes it first, as
    QMP runs a queued screendump to completion before the quit.
    """

    def __init__(
        self,
        failure: Callable[[Path], object],
        late: Callable[[Path], object] = lambda _path: None,
    ) -> None:
        self.failure, self.late = failure, late
        self.lost: list[Path] = []
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
            path = Path(arguments["filename"])
            if path.name != "failure-final.ppm":
                assert not cleanup
                self.lost.append(path)
                raise TimeoutError("Owned QMP response unavailable")
            assert cleanup
            self.failure(path)
        elif execute == "quit":
            for path in self.lost:
                self.late(path)
        return {}


def finalized(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    qemu: Qemu,
    phase: str | None = None,
) -> tuple[Path, dict[str, object]]:
    """A failed campaign's finalize() on a running VM, after an optional
    phase frame whose screendump reply was lost."""
    work, proof = tmp_path / "work", tmp_path / "proof"
    work.mkdir()
    proof.mkdir()
    owner = vm.Owner(work, proof)
    owner.child = QuittingVM()
    owner.pgid = owner.child.pid
    owner.qmp = owner.qmp_stream = SimpleNamespace(close=lambda: None)
    monkeypatch.setattr(owner, "qmp_call", qemu.qmp_call)
    monkeypatch.setattr(vm, "group_exists", lambda _pgid: False)
    if phase is not None:
        with pytest.raises(TimeoutError):
            owner.frame(phase)
    result: dict[str, object] = {
        "status": "FAILED_OR_CAPABILITY_UNAVAILABLE",
        "product_launched": False,
    }
    vm.finalize(SimpleNamespace(proof=proof), owner, None, result)
    return proof, result


def write_frame(path: Path) -> None:
    path.write_bytes(frame_bytes(640, 480))


def closure_status(proof: Path) -> str:
    return str(json.loads((proof / "closure.json").read_text())["status"])


def retention_status(result: dict[str, object]) -> object:
    retention = result["retention"]
    assert isinstance(retention, dict)
    return retention["status"]


def test_a_phase_frame_finished_after_its_lost_reply_is_removed_after_quit(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    qemu = Qemu(write_frame, write_frame)
    proof, result = finalized(
        vm, tmp_path, monkeypatch, qemu, phase="session-before-product"
    )
    assert qemu.calls == ["screendump", "screendump", "quit"]
    assert qemu.lost == [proof / "session-before-product.ppm"]
    assert not qemu.lost[0].exists()
    assert result["unvalidated_frames_removed"] == ["session-before-product.ppm"]
    assert result["finalization_errors"] == []
    assert retention_status(result) == "FINITE_RETENTION_PASS"
    retained = sorted(path.name for path in (proof / "retained").iterdir())
    assert "session-before-product.ppm" not in retained
    # The validated failure frame is retained.
    assert "failure-final.ppm" in retained


def test_an_unremovable_late_phase_frame_is_a_finalization_failure(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Unlinking a directory fails on every verify host.
    qemu = Qemu(write_frame, lambda path: path.mkdir())
    proof, result = finalized(
        vm, tmp_path, monkeypatch, qemu, phase="session-before-product"
    )
    errors = result["finalization_errors"]
    assert isinstance(errors, list)
    assert [row["stage"] for row in errors] == ["late_frame_discard"]
    assert errors[0]["error_type"] in REMOVAL_ERRORS
    assert "unvalidated_frames_removed" not in result
    assert closure_status(proof) == "FINALIZATION_FAILED"
    # Retention then refuses what could not be removed.
    assert result["status"] == "FINITE_RETENTION_FAILED"
    assert not (proof / "retained").exists()


def test_an_unremovable_failure_frame_is_a_finalization_failure(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unremovable(path: Path) -> None:
        path.mkdir()  # unlinking a directory fails on every verify host
        raise TimeoutError("Owned QMP response unavailable")

    qemu = Qemu(unremovable)
    proof, result = finalized(vm, tmp_path, monkeypatch, qemu)
    assert qemu.calls == ["screendump", "quit"]
    frame = result["failure_frame"]
    assert isinstance(frame, dict)
    assert (frame["captured"], frame["error_type"]) == (False, "TimeoutError")
    assert frame["unvalidated_frame_cleanup_error_type"] in REMOVAL_ERRORS
    errors = result["finalization_errors"]
    assert isinstance(errors, list)
    assert [row["stage"] for row in errors] == ["failure_frame_discard"]
    assert errors[0]["error_type"] in REMOVAL_ERRORS
    assert closure_status(proof) == "FINALIZATION_FAILED"
    # Retention then refuses what could not be removed.
    assert result["status"] == "FINITE_RETENTION_FAILED"
    assert not (proof / "retained").exists()


def test_a_dangling_failure_frame_symlink_is_removed(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def dangling(path: Path) -> None:
        path.symlink_to(path.with_name("absent-frame.ppm"))
        raise TimeoutError("Owned QMP response unavailable")

    proof, result = finalized(vm, tmp_path, monkeypatch, Qemu(dangling))
    path = proof / "failure-final.ppm"
    assert not path.exists()
    assert not path.is_symlink()
    assert result["failure_frame"] == {
        "captured": False,
        "error_type": "TimeoutError",
        "unvalidated_frame_removed": True,
    }
    assert result["finalization_errors"] == []
    assert closure_status(proof) == "FAILED_OR_CAPABILITY_UNAVAILABLE"
    assert retention_status(result) == "FINITE_RETENTION_PASS"


def test_a_dangling_late_phase_frame_symlink_is_removed(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def dangling(path: Path) -> None:
        path.symlink_to(path.with_name("absent-frame.ppm"))

    qemu = Qemu(write_frame, dangling)
    proof, result = finalized(
        vm, tmp_path, monkeypatch, qemu, phase="session-before-product"
    )
    path = proof / "session-before-product.ppm"
    assert not path.exists()
    assert not path.is_symlink()
    assert result["unvalidated_frames_removed"] == ["session-before-product.ppm"]
    assert result["finalization_errors"] == []
    assert retention_status(result) == "FINITE_RETENTION_PASS"
