"""Pure boundary checks only; no GI, subprocess, socket, VM or product actors."""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
import signal
import sys
import tarfile
from enum import IntEnum
from pathlib import Path
from types import ModuleType
from typing import NoReturn

import pytest

SOURCE = Path(__file__).parents[1] / "linux_gnome"
V2 = Path(__file__).parents[4] / "v2/after/scripts"
if V2.is_dir():
    sys.path.append(str(V2))
    sys.path.append(str(V2.parents[1] / "existing-inputs/scripts"))
sys.path.insert(0, str(SOURCE))
sys.path.insert(0, str(Path(__file__).parents[3] / "existing-inputs/scripts"))


def load(name: str) -> ModuleType:
    path = SOURCE / (name + ".py")
    if not path.exists():
        path = V2 / path.name
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(autouse=True)
def missing_posix_fixture_symbols(monkeypatch: pytest.MonkeyPatch) -> None:
    """Expose only missing Linux test symbols; no process/timer actor fallback."""

    class GuestSignals(IntEnum):
        SIGKILL = 9
        SIGALRM = 14
        ITIMER_REAL = 0

    def unexpected(*_args: object, **_kwargs: object) -> NoReturn:
        raise AssertionError("Pure fixture attempted an unmocked POSIX operation")

    for name in ("getpgid", "killpg"):
        if not hasattr(os, name):
            monkeypatch.setattr(os, name, unexpected, raising=False)
    for name in ("getitimer", "setitimer"):
        if not hasattr(signal, name):
            monkeypatch.setattr(signal, name, unexpected, raising=False)
    for name in ("SIGKILL", "SIGALRM", "ITIMER_REAL"):
        if not hasattr(signal, name):
            monkeypatch.setattr(signal, name, GuestSignals[name], raising=False)


@pytest.fixture
def guest() -> ModuleType:
    return load("ubuntu_gnome_guest")


def test_imports_do_not_load_platform_gi_or_spawn_actor(guest: ModuleType) -> None:
    assert "gi" not in sys.modules
    assert guest.OPERATIONS[-1] == "finish"
    assert "TAURI_WEBVIEW_AUTOMATION" not in guest.OPERATIONS


def test_frame_reassembles_partial_stream(guest: ModuleType) -> None:
    chunks = iter([b'{"oper', b'ation":"finish"}', b"\n"])

    class Stream:
        def recv(self, _count: int) -> bytes:
            return next(chunks)

    assert json.loads(guest.receive_line(Stream(), 1024)) == {"operation": "finish"}


@pytest.mark.parametrize("payload", [b"abcd\n", b"a\nb\n", b""])
def test_frame_rejects_overflow_multiple_or_truncated(
    guest: ModuleType, payload: bytes
) -> None:
    chunks = iter([payload, b""])

    class Stream:
        def recv(self, _count: int) -> bytes:
            return next(chunks)

    with pytest.raises(ValueError, match="frame"):
        guest.receive_line(Stream(), 4)


def test_stable_identity_ignores_scheduler_state_but_not_parent_or_starttime(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = {"pid": 101, "ppid": 100, "starttime_ticks": 999, "state": "S"}
    current = {**original, "state": "R"}
    monkeypatch.setattr(guest, "process_identity", lambda _pid: current)
    assert guest.same_process(original)
    current["ppid"] = 1
    assert not guest.same_process(original)
    current.update(ppid=100, starttime_ticks=1000)
    assert not guest.same_process(original)


def test_changed_process_before_pidfd_signal_is_refused_and_fd_closed(
    guest: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    events: list[object] = []
    monkeypatch.setattr(guest.os, "pidfd_open", lambda _pid, _flags: 17, raising=False)
    monkeypatch.setattr(guest, "same_process", lambda _identity: False)
    monkeypatch.setattr(
        guest.signal,
        "pidfd_send_signal",
        lambda *_args: events.append("signal"),
        raising=False,
    )
    monkeypatch.setattr(
        guest.os, "close", lambda descriptor: events.append(("closed", descriptor))
    )
    with pytest.raises(ValueError, match="binding changed"):
        guest.exact_kill({"pid": 101})
    assert events == [("closed", 17)]


@pytest.mark.parametrize(
    ("locked", "expected"), [(True, "LOCKED"), (False, "AVAILABLE")]
)
def test_secret_metadata_uses_only_existing_unique_owner(
    monkeypatch: pytest.MonkeyPatch, locked: bool, expected: str
) -> None:
    module = load("ubuntu_gnome_session_receipt")
    calls = []
    results = iter(
        [
            "(true,)\n",
            "(':1.42',)\n",
            "(objectpath '/org/freedesktop/secrets/collection/login',)\n",
            "(<" + str(locked).lower() + ">,)\n",
        ]
    )

    def command(argv: list[str]) -> dict[str, object]:
        calls.append(argv)
        return {"exit_code": 0, "stdout": next(results)}

    monkeypatch.setattr(module, "command", command)
    receipt = module.secret_service_capability()
    assert receipt["state"] == expected
    assert [argv[argv.index("--dest") + 1] for argv in calls] == [
        "org.freedesktop.DBus",
        "org.freedesktop.DBus",
        ":1.42",
        ":1.42",
    ]
    assert not any(
        "Unlock" in str(argv) or "OpenSession" in str(argv) or "GetSecrets" in str(argv)
        for argv in calls
    )


def test_unavailable_secret_service_never_activates_or_reads_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load("ubuntu_gnome_session_receipt")
    calls = []

    def command(argv: list[str]) -> dict[str, object]:
        calls.append(argv)
        return {"exit_code": 0, "stdout": "(false,)\n"}

    monkeypatch.setattr(module, "command", command)
    assert module.secret_service_capability()["state"] == "UNAVAILABLE"
    assert len(calls) == 1


def test_reaped_vm_never_receives_qmp_or_signal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = load("ubuntu_gnome_vm")
    owner = module.Owner(tmp_path, tmp_path)

    class Reaped:
        returncode = 0

        def poll(self) -> int:
            return 0

    owner.child, owner.pgid = Reaped(), 777
    events: list[object] = []
    monkeypatch.setattr(owner, "qmp_call", lambda *_args: events.append("qmp"))
    monkeypatch.setattr(module.os, "killpg", lambda *_args: events.append("signal"))
    monkeypatch.setattr(module, "group_exists", lambda _pgid: False)
    assert owner.close()["direct_child_reaped"] is True
    assert events == []


def test_reviewed_closure_rejects_changed_archive_bytes(tmp_path: Path) -> None:
    module = load("ubuntu_gnome_vm")
    (tmp_path / "debs").mkdir()
    archive = tmp_path / "debs/fixture.deb"
    archive.write_bytes(b"fixture")
    lock = {
        "schema": "japp-reviewed-noble-closure-v1",
        "architecture": "amd64",
        "signed_metadata": [{"scope": "pure-fixture-not-real-signed-metadata"}],
        "packages": [
            {
                "filename": archive.name,
                "sha256": hashlib.sha256(b"fixture").hexdigest(),
                "bytes": 7,
            }
        ],
    }
    raw = json.dumps(lock).encode()
    (tmp_path / "lock.json").write_bytes(raw)
    pin = hashlib.sha256(raw).hexdigest()
    assert module.validate_closure(tmp_path, pin) == lock
    archive.write_bytes(b"changed")
    with pytest.raises(ValueError, match="archive bytes differ"):
        module.validate_closure(tmp_path, pin)


def native_table(address: str, inode: str = "42") -> str:
    return "header\n0: " + address + ":1234 00000000:0000 0A 0 0 0 0 0 " + inode + "\n"


def test_ipv4_and_ipv6_loopback_observed_and_foreign_inodes_ignored(
    guest: ModuleType,
) -> None:
    values = guest.parse_owned_listeners(
        native_table("0100007F"),
        native_table("00000000000000000000000001000000"),
        {"42"},
    )
    assert [(r["family"], r["address"]) for r in values] == [
        ("IPv4", "127.0.0.1"),
        ("IPv6", "::1"),
    ]
    assert guest.port_from_listeners(values) == 0x1234
    assert (
        guest.parse_owned_listeners(native_table("00000000", "99"), "header\n", {"42"})
        == []
    )


@pytest.mark.parametrize(
    ("ipv4", "ipv6"),
    [
        ("00000000", None),
        ("0200007F", None),
        (None, "00000000000000000000000000000000"),
        (None, "0000000000000000FFFF00000100007F"),
    ],
)
def test_any_owned_nonliteral_ipv4_or_ipv6_listener_is_refused(
    guest: ModuleType, ipv4: str | None, ipv6: str | None
) -> None:
    with pytest.raises(ValueError, match="non-literal-loopback"):
        guest.parse_owned_listeners(
            native_table(ipv4) if ipv4 else "header\n",
            native_table(ipv6) if ipv6 else "header\n",
            {"42"},
        )


@pytest.mark.parametrize(
    "url",
    [
        "http://cloud-images.ubuntu.com/releases/noble/release-20261017/SHA256SUMS",
        "file:///etc/passwd",
        "https://cloud-images.ubuntu.com.evil.example/releases/noble/release-20261017/SHA256SUMS",
        "https://cloud-images.ubuntu.com/releases/noble/current/SHA256SUMS",
        "https://user@cloud-images.ubuntu.com/releases/noble/release-20261017/SHA256SUMS",
        "https://cloud-images.ubuntu.com/releases/noble/release-20261017/SHA256SUMS?alternate=1",
    ],
)
def test_unreviewed_download_origin_rejected_before_opener(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    module = load("ubuntu_gnome_vm")
    owner = module.Owner(tmp_path, tmp_path)
    calls = []
    monkeypatch.setattr(
        module.urllib.request, "build_opener", lambda *_args: calls.append("opened")
    )
    with pytest.raises(ValueError, match="exact dated official HTTPS"):
        owner.download(url, tmp_path / "download", 100, 1)
    assert calls == []
    assert not (tmp_path / "download").exists()


def test_invalid_redirect_refused_before_stdlib_delegate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load("ubuntu_gnome_vm")
    calls = []
    monkeypatch.setattr(
        module.urllib.request.HTTPRedirectHandler,
        "redirect_request",
        lambda *_args: calls.append("delegate"),
    )
    with pytest.raises(ValueError, match="exact dated official HTTPS"):
        module.OfficialRedirect().redirect_request(
            None, None, 302, "Found", None, "https://evil.example/image"
        )
    assert calls == []


@pytest.mark.parametrize("failure", ["getpgid", "watcher"])
def test_exception_after_popen_unwinds_and_retains_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    module = load("ubuntu_gnome_vm")
    owner = module.Owner(tmp_path, tmp_path)
    events: list[object] = []

    class Child:
        pid = 777
        returncode: int | None = None

        def poll(self) -> None:
            return None

        def send_signal(self, sig: int) -> None:
            events.append(("direct", sig))

        def wait(self, timeout: int) -> int:
            assert timeout in {2, 3}
            self.returncode = -15
            events.append("reaped")
            return -15

    child = Child()
    monkeypatch.setattr(module.subprocess, "Popen", lambda *_args, **_kwargs: child)
    monkeypatch.setattr(module, "group_exists", lambda _pgid: False)
    monkeypatch.setattr(
        module.os, "killpg", lambda _pgid, sig: events.append(("group", sig))
    )

    def fail(*_args: object) -> None:
        raise RuntimeError("controlled " + failure)

    if failure == "getpgid":
        monkeypatch.setattr(module.os, "getpgid", fail)
    else:
        monkeypatch.setattr(module.os, "getpgid", lambda _pid: 777)
        monkeypatch.setattr(owner, "vm_output_exceeded", fail)
    with pytest.raises(RuntimeError, match="controlled " + failure):
        owner.command(["/reviewed/fixture"])
    receipt = json.loads((tmp_path / "command-001.json").read_bytes())
    assert receipt["primary_error_type"] == "RuntimeError"
    assert receipt["direct_child_reaped"] is True
    assert receipt["retained_unreaped_custody"] is False
    assert owner.pending_commands == []
    assert events[-1] == "reaped"
    first = events[0]
    assert isinstance(first, tuple)
    assert first[0] == ("direct" if failure == "getpgid" else "group")


def _install_package_metadata_fixture(
    guest: ModuleType,
    prefix: Path,
    values: dict[str, bytes],
    monkeypatch: pytest.MonkeyPatch,
    host_flavor: str,
) -> dict[str, dict[str, int]]:
    # Inject only guest metadata; byte/hash/race checks still read real files.
    if host_flavor == "windows":
        monkeypatch.delattr(guest.os, "geteuid", raising=False)
        monkeypatch.delattr(guest.os, "getegid", raising=False)
    rows = {name: {"mode": 0o755, "uid": 1001, "gid": 1002} for name in values}
    actual_record = guest.file_record

    def fixture_record(path: Path) -> dict[str, object]:
        name = path.relative_to(prefix).as_posix()
        return {**actual_record(path), **rows[name]}

    monkeypatch.setattr(guest, "file_record", fixture_record)
    monkeypatch.setattr(guest.os, "geteuid", lambda: 1001, raising=False)
    monkeypatch.setattr(guest.os, "getegid", lambda: 1002, raising=False)
    return rows


def _assert_guest_owner_and_byte_refusals(
    guest: ModuleType,
    prefix: Path,
    rows: dict[str, dict[str, int]],
) -> None:
    controller = object.__new__(guest.Controller)
    rows[guest.MAIN]["uid"] = 1003
    with pytest.raises(ValueError, match="package owner differs"):
        controller.package_binding(prefix)
    rows[guest.MAIN]["uid"] = 1001
    rows[guest.MAIN]["gid"] = 1004
    with pytest.raises(ValueError, match="package owner differs"):
        controller.package_binding(prefix)
    rows[guest.MAIN]["gid"] = 1002
    (prefix / guest.MAIN).write_bytes(b"changed bytes")
    with pytest.raises(ValueError, match="package file differs"):
        controller.package_binding(prefix)


@pytest.mark.parametrize("host_flavor", ["posix", "windows"])
def test_archive_modes_join_export_and_guest_binding_without_gi(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, host_flavor: str
) -> None:
    exporter = load("ubuntu_gnome_package_export")
    guest = load("ubuntu_gnome_guest")
    pipeline = tmp_path / "pipeline"
    pipeline.mkdir()
    values = {guest.MAIN: b"synthetic app", guest.SERVICE: b"synthetic service"}
    compressed = io.BytesIO()
    with tarfile.open(fileobj=compressed, mode="w:gz") as archive:
        for name, data in values.items():
            member = tarfile.TarInfo(name)
            member.uid = member.gid = 0
            member.mode = 0o755
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))

    def ar_member(name: str, data: bytes) -> bytes:
        header = (
            name.ljust(16)
            + "0".ljust(12)
            + "0".ljust(6)
            + "0".ljust(6)
            + "100644".ljust(8)
            + str(len(data)).ljust(10)
            + "`\n"
        ).encode()
        return header + data + (b"\n" if len(data) % 2 else b"")

    package = tmp_path / "fixture.deb"
    empty_control = io.BytesIO()
    with tarfile.open(fileobj=empty_control, mode="w:gz"):
        pass
    package.write_bytes(
        b"!<arch>\n"
        + ar_member("debian-binary", b"2.0\n")
        + ar_member("control.tar.gz", empty_control.getvalue())
        + ar_member("data.tar.gz", compressed.getvalue())
    )
    inspection = {
        "files": [
            {
                "path": name,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
            for name, data in sorted(values.items())
        ]
    }
    descriptor = pipeline / "shipping-runtime-descriptor-0.rs"
    descriptor.write_bytes(b"synthetic descriptor only")
    descriptors = pipeline / "shipping-descriptors.json"
    descriptors.write_text(
        json.dumps(
            [
                {
                    "retained": str(descriptor),
                    "sha256": hashlib.sha256(descriptor.read_bytes()).hexdigest(),
                }
            ]
        )
    )
    bindings, _ = exporter.package_metadata(tmp_path, package, inspection, descriptors)
    assert all(row["mode"] == 0o755 for row in bindings)
    metadata = tmp_path / "metadata"
    metadata.mkdir()
    (metadata / "export.json").write_text(json.dumps({"installed_files": bindings}))
    prefix = tmp_path / "own prefix ü"
    for name, data in values.items():
        path = prefix / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    monkeypatch.setattr(guest, "INPUT", metadata)
    metadata_rows = _install_package_metadata_fixture(
        guest, prefix, values, monkeypatch, host_flavor
    )
    controller = object.__new__(guest.Controller)
    assert set(controller.package_binding(prefix)) == set(values)
    metadata_rows[guest.MAIN]["mode"] = 0o644
    with pytest.raises(ValueError, match="package file differs"):
        controller.package_binding(prefix)

    metadata_rows[guest.MAIN]["mode"] = 0o755
    _assert_guest_owner_and_byte_refusals(guest, prefix, metadata_rows)


def test_operation_deadline_refuses_late_result_and_restores_timer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load("ubuntu_gnome_guest")
    events: list[object] = []
    monkeypatch.setattr(module.signal, "getitimer", lambda _which: (0.0, 0.0))
    monkeypatch.setattr(
        module.signal,
        "signal",
        lambda _sig, handler: events.append(("handler", handler)),
    )
    monkeypatch.setattr(
        module.signal,
        "setitimer",
        lambda _which, seconds: events.append(("timer", seconds)),
    )

    class Late:
        work_deadline = float("inf")
        operation_deadline = 0.0
        calls = 0

        def fence(self) -> None:
            self.calls += 1
            if self.calls > 1:
                raise TimeoutError("controlled late publication")

        def operation(self, _operation: str) -> dict[str, object]:
            return {"unpublished": True}

    with pytest.raises(TimeoutError, match="late publication"):
        module.run_operation(Late(), "fixture")
    assert ("timer", 0) in events
    assert events[-1] == ("handler", None)


@pytest.mark.parametrize("interference", ["bytes", "extra", "symlink", "missing"])
def test_reviewed_bundle_refuses_unapproved_members(
    tmp_path: Path,
    interference: str,
) -> None:
    module = load("ubuntu_gnome_host")
    value = tmp_path / "input.json"
    value.write_bytes(b"synthetic non-executable input")
    manifest = tmp_path / "reviewed-inputs.json"
    manifest.write_text(
        json.dumps(
            {
                "schema": "japp-reviewed-gnome-inputs-v1",
                "files": {
                    "input.json": {
                        "bytes": value.stat().st_size,
                        "sha256": hashlib.sha256(value.read_bytes()).hexdigest(),
                    }
                },
            }
        )
    )
    expected = hashlib.sha256(manifest.read_bytes()).hexdigest()
    assert module.audit_bundle(tmp_path, expected)["files"]["input.json"]
    if interference == "bytes":
        value.write_bytes(b"changed")
    elif interference == "extra":
        (tmp_path / "unknown.json").write_bytes(b"unapproved")
    elif interference == "symlink":
        (tmp_path / "link.json").symlink_to(value)
    else:
        value.unlink()
    with pytest.raises(ValueError, match=r"input|Input|Reviewed|No input"):
        module.audit_bundle(tmp_path, expected)


def test_apt_candidate_parser_rejects_duplicate_authority_fields() -> None:
    module = load("ubuntu_gnome_prepare")
    assert (
        module.fields(b"Package: synthetic\nVersion: 1\n Description continuation\n")[
            "Version"
        ]
        == "1"
    )
    with pytest.raises(ValueError, match="Duplicate Debian metadata"):
        module.fields(b"Package: synthetic\nSHA256: first\nSHA256: second\n")


def test_retention_failure_marker_reaches_partial_curation(tmp_path: Path) -> None:
    module = load("ubuntu_gnome_vm")
    retained = tmp_path / "retained"
    retained.mkdir()
    module.retention_failure(tmp_path, ValueError("synthetic finite curation failure"))
    outside = json.loads((tmp_path / "retention-failure.json").read_text())
    inside = json.loads((retained / "retention-failure.json").read_text())
    assert inside == outside
    assert inside["status"] == "FINITE_RETENTION_FAILED"
    assert inside["error_type"] == "ValueError"


def test_qmp_observer_exception_still_reaps_owned_vm(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load("ubuntu_gnome_vm")
    owner = module.Owner(tmp_path, tmp_path)

    class Child:
        pid = 1234567
        returncode: int | None = None

        def wait(self, *, timeout: float) -> int:
            assert timeout == 10
            self.returncode = 0
            return 0

    owner.child = Child()
    owner.pgid = owner.child.pid
    owner.vm_group_verified = True
    monkeypatch.setattr(module, "group_exists", lambda _pgid: False)

    def broken_qmp(_execute: str) -> None:
        raise KeyError("synthetic observer framing defect")

    monkeypatch.setattr(owner, "qmp_call", broken_qmp)
    result = owner.close()
    assert result["qmp_quit_error_type"] == "KeyError"
    assert result["direct_child_reaped"] is True
    assert result["group_after_reap"] == "ABSENT"
    assert result["signals"] == []
