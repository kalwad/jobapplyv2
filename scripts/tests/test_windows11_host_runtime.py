"""Windows 11 host runtime contracts after a guest PASS, on failure, and at install.

Pure fakes, socket pairs and temporary files only: no QEMU, KVM, apt, sudo,
network or VM actor. QEMU's end of a QMP socket pair is a scripted peer thread.
The apt plan lines reuse the exact new-install format measured on a hosted
runner (diagnostic run 41157694334); replacement and removal lines follow
apt-get's own simulation format and are synthetic.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import select
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any, Protocol

import pytest
import yaml

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "linux_gnome"))
sys.path.insert(0, str(ROOT / "windows11"))

NONCE = "a" * 64
PACKAGE = "b" * 64
CPU_7763 = {
    "model name": "AMD EPYC 7763 64-Core Processor",
    "vendor_id": "AuthenticAMD",
    "cpu family": "25",
    "model": "1",
    "stepping": "1",
}
# Model name measured on a standard runner (run 41165269919); the family/model
# numbers are a synthetic Zen 4 identity for the fixture.
CPU_9V74 = {
    "model name": "AMD EPYC 9V74 80-Core Processor",
    "vendor_id": "AuthenticAMD",
    "cpu family": "25",
    "model": "17",
    "stepping": "1",
}
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
LOCKED = [
    {"package": "libfdt1", "version": "1.7.0-2build1"},
    {"package": "qemu-utils", "version": "1:8.2.2+ds-0ubuntu1.18"},
]
CLEAN_PLAN = (
    b"Reading package lists...\n"
    b"0 upgraded, 2 newly installed, 0 to remove and 0 not upgraded.\n"
    b"Inst libfdt1 (1.7.0-2build1 Ubuntu:24.04/noble, local-deb [amd64])\n"
    b"Inst qemu-utils (1:8.2.2+ds-0ubuntu1.18 Ubuntu:24.04/noble-updates,"
    b" local-deb [amd64])\n"
    b"Conf libfdt1 (1.7.0-2build1 Ubuntu:24.04/noble, local-deb [amd64])\n"
    b"Conf qemu-utils (1:8.2.2+ds-0ubuntu1.18 Ubuntu:24.04/noble-updates,"
    b" local-deb [amd64])\n"
)
REMOVING_PLAN = (
    b"1 upgraded, 0 newly installed, 2 to remove and 0 not upgraded.\n"
    b"Remv systemd-sysv [255.4-1ubuntu8.17]\n"
    b"Remv systemd [255.4-1ubuntu8.17]\n"
    b"Inst libsystemd0 [255.4-1ubuntu8.17] (255.4-1ubuntu8.18 local-deb [amd64])\n"
)


def load(name: str, folder: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, ROOT / folder / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def vm(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    # The Linux VM host module imports fcntl; give a Windows verify host an
    # inert stand-in so the pure contracts below run on every host.
    if "fcntl" not in sys.modules:
        try:
            import fcntl  # noqa: F401, PLC0415 - POSIX verify hosts only
        except ImportError:
            monkeypatch.setitem(sys.modules, "fcntl", ModuleType("fcntl"))
    return load("windows11_vm", "windows11")


@pytest.fixture
def host() -> ModuleType:
    return load("ubuntu_gnome_host", "linux_gnome")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ppm(path: Path, width: int = 4, height: int = 2) -> None:
    header = b"P6\n" + str(width).encode() + b" " + str(height).encode() + b"\n255\n"
    size = width * height * 3
    path.write_bytes(header + (bytes(range(256)) * (size // 256 + 1))[:size])


# Host install closure: simulate, refuse drift, then install with --no-remove.


def test_measured_new_install_plan_is_closed(host: ModuleType) -> None:
    plan = host.closed_install_plan(CLEAN_PLAN, LOCKED)
    assert plan["newly_installed"] == [
        "libfdt1=1.7.0-2build1",
        "qemu-utils=1:8.2.2+ds-0ubuntu1.18",
    ]
    assert (plan["upgraded"], plan["removed"]) == (0, 0)


@pytest.mark.parametrize(
    ("plan", "message"),
    [
        (REMOVING_PLAN, r"replace or remove runner packages: Remv systemd-sysv"),
        (
            (
                b"1 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n"
                b"Inst qemu-utils [1:8.2.2+ds-0ubuntu1.17]"
                b" (1:8.2.2+ds-0ubuntu1.18 local-deb [amd64])\n"
            ),
            r"replace or remove runner packages: Inst qemu-utils \[",
        ),
        (
            (
                b"0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.\n"
                b"Purg libc6-dev [2.39-0ubuntu8.8]\n"
            ),
            r"replace or remove runner packages: Purg libc6-dev",
        ),
        (
            (
                b"0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.\n"
                b"Inst qemu-utils (1:8.2.2+ds-0ubuntu1.19 local-deb [amd64])\n"
            ),
            r"runner packages: Inst qemu-utils \(1:8.2.2\+ds-0ubuntu1.19",
        ),
        (CLEAN_PLAN.replace(b"0 upgraded, 2 newly", b"0 upgraded, 3 newly"), "differs"),
        (CLEAN_PLAN.replace(b"0 to remove", b"1 to remove"), "differs"),
        # Exact adds only, yet the summary still counts an upgrade.
        (CLEAN_PLAN.replace(b"0 upgraded", b"1 upgraded"), "differs"),
        (
            CLEAN_PLAN.replace(b"0 upgraded, 2 newly installed, 0 to remove", b""),
            "Exactly one simulated host install summary",
        ),
    ],
    ids=[
        "removal",
        "replacement",
        "purge",
        "unlocked-version",
        "count-mismatch",
        "summary-removal",
        "summary-upgrade",
        "no-summary",
    ],
)
def test_host_plan_refuses_runner_drift(
    host: ModuleType, plan: bytes, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        host.closed_install_plan(plan, LOCKED)


def test_an_empty_apt_broken_list_is_still_an_exact_add(host: ModuleType) -> None:
    # apt 2.8.3 pkgSimulate (source, not measured) ends a step ' []' while a
    # dependency loop of new packages is half unpacked: the open member is
    # broken but already touched, so its list of untouched packages is empty.
    loop = CLEAN_PLAN.replace(
        b"local-deb [amd64])\nInst", b"local-deb [amd64]) []\nInst"
    )
    assert loop.count(b"[amd64]) []\n") == 1
    plan = host.closed_install_plan(loop, LOCKED)
    assert plan["newly_installed"] == [
        "libfdt1=1.7.0-2build1",
        "qemu-utils=1:8.2.2+ds-0ubuntu1.18",
    ]
    # A named list (an untouched runner package broken) or an unsatisfied
    # Pre-Depends pair stays refused.
    for suffix in (b" [systemd ]", b" [libfdt1 on libc6] []"):
        drift = CLEAN_PLAN.replace(
            b"local-deb [amd64])\nInst", b"local-deb [amd64])" + suffix + b"\nInst"
        )
        with pytest.raises(ValueError, match="runner packages: Inst libfdt1"):
            host.closed_install_plan(drift, LOCKED)


class AptOwner:
    """Fake owned command runner: apt-get -s answers with the given plan."""

    def __init__(self, tmp_path: Path, plan: bytes, query: bytes = b"") -> None:
        self.work, self.proof = tmp_path / "work", tmp_path / "proof"
        self.work.mkdir()
        self.proof.mkdir()
        self.plan, self.query = plan, query
        self.commands: list[list[str]] = []

    def command(self, argv: list[str], **_kwargs: object) -> bytes:
        self.commands.append(argv)
        if "-s" in argv:
            return self.plan
        if any(part.endswith("dpkg-query") for part in argv):
            return self.query
        return b""

    def apt(self) -> list[list[str]]:
        return [argv for argv in self.commands if "/usr/bin/apt-get" in argv]


def host_bundle(tmp_path: Path, packages_key: str, schema: dict[str, Any]) -> Path:
    bundle = tmp_path / "bundle"
    (bundle / "host-debs").mkdir(parents=True)
    rows = []
    for row in LOCKED:
        name = row["package"] + "_fixture_amd64.deb"
        archive = bundle / "host-debs" / name
        archive.write_bytes(b"synthetic inert archive " + name.encode())
        rows.append(
            {
                **row,
                "filename": name,
                "architecture": "amd64",
                "bytes": archive.stat().st_size,
                "sha256": sha256(archive),
            }
        )
    lock = {**schema, "runner_image_version": "fixture-image", packages_key: rows}
    (bundle / "host-tools-lock.json").write_text(json.dumps(lock))
    return bundle


QUERY = b"libfdt1\t1.7.0-2build1\tamd64\nqemu-utils\t1:8.2.2+ds-0ubuntu1.18\tamd64\n"


def windows_install(
    vm: ModuleType, owner: AptOwner, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ImageVersion", "fixture-image")
    monkeypatch.setattr(vm, "TOOLS", {})
    monkeypatch.setattr(vm, "FIRMWARE", {})
    bundle = host_bundle(
        tmp_path, "packages", {"schema": "japp-win11-host-tools-v1", "tools": {}}
    )
    vm.install_tools(bundle, owner, sha256(bundle / "host-tools-lock.json"))


def gnome_install(
    host: ModuleType,
    owner: AptOwner,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ImageVersion", "fixture-image")
    tool = tmp_path / "dpkg-query"
    tool.write_bytes(b"synthetic inert tool")
    monkeypatch.setattr(host, "TOOLS", {"dpkg_query": str(tool)})
    bundle = host_bundle(
        tmp_path,
        "host_packages",
        {"tools": {"dpkg_query": {"path": str(tool), "sha256": sha256(tool)}}},
    )
    host.install_tools(bundle, owner)


def assert_simulated_then_no_remove(owner: AptOwner) -> None:
    simulated, installed = owner.apt()
    prefix = simulated[: simulated.index("-s")]
    assert prefix[:3] == ["/usr/bin/sudo", "-n", "/usr/bin/apt-get"]
    assert "Dir::Etc::SourceList=/dev/null" in prefix
    assert simulated[len(prefix) :][:2] == ["-s", "install"]
    assert installed[: len(prefix)] == prefix
    assert installed[len(prefix) :][:2] == ["--no-remove", "install"]
    assert "-s" not in installed
    assert simulated[len(prefix) + 2 :] == installed[len(prefix) + 2 :]
    plan = json.loads((owner.proof / "host-install-plan.json").read_text())
    assert plan["newly_installed"] == [
        "libfdt1=1.7.0-2build1",
        "qemu-utils=1:8.2.2+ds-0ubuntu1.18",
    ]


def test_windows_host_install_simulates_first_then_installs_without_removal(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = AptOwner(tmp_path, CLEAN_PLAN, QUERY)
    windows_install(vm, owner, tmp_path, monkeypatch)
    assert_simulated_then_no_remove(owner)


def test_windows_host_drift_fails_before_any_install(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = AptOwner(tmp_path, REMOVING_PLAN, QUERY)
    with pytest.raises(ValueError, match="Remv systemd-sysv"):
        windows_install(vm, owner, tmp_path, monkeypatch)
    assert len(owner.apt()) == 1
    assert "-s" in owner.apt()[0]


def test_gnome_host_install_simulates_first_then_installs_without_removal(
    host: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = AptOwner(tmp_path, CLEAN_PLAN, QUERY)
    gnome_install(host, owner, tmp_path, monkeypatch)
    assert_simulated_then_no_remove(owner)


def test_gnome_host_drift_fails_before_any_install(
    host: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = AptOwner(tmp_path, REMOVING_PLAN, QUERY)
    with pytest.raises(ValueError, match="Inst libsystemd0"):
        gnome_install(host, owner, tmp_path, monkeypatch)
    assert len(owner.apt()) == 1
    assert "-s" in owner.apt()[0]


# Prepare time: the same plan is simulated, unprivileged, and retained.


def test_prepare_simulates_the_lifecycle_plan_unprivileged(tmp_path: Path) -> None:
    prepare = load("ubuntu_gnome_prepare", "linux_gnome")
    owner = AptOwner(tmp_path, CLEAN_PLAN)
    closure = tmp_path / "closure"
    rows = [{**row, "filename": row["package"] + ".deb"} for row in LOCKED]
    prepare.simulate_host_install(owner, closure, rows)
    (simulated,) = owner.apt()
    assert simulated[0] == "/usr/bin/apt-get"
    assert "/usr/bin/sudo" not in simulated
    assert "Dir::Etc::SourceList=/dev/null" in simulated
    assert simulated[-4:] == [
        "-s",
        "install",
        str(closure / "debs" / "libfdt1.deb"),
        str(closure / "debs" / "qemu-utils.deb"),
    ]
    retained = json.loads((owner.proof / "host-install-plan.json").read_text())
    assert retained["scope"].startswith("SIMULATED_LOCAL_ONLY_APT")


def test_gnome_candidate_fails_on_host_drift_before_extracting_tools(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepare = load("ubuntu_gnome_prepare", "linux_gnome")
    package = tmp_path / "package"
    package.mkdir()
    (package / "package.deb").write_bytes(b"synthetic inert package")
    (package / "export.json").write_text(
        json.dumps(
            {"files": {"package.deb": {"sha256": sha256(package / "package.deb")}}}
        )
    )
    scripts = ROOT / "linux_gnome"
    before = {
        "scripts/linux_gnome/" + name: {"sha256": sha256(scripts / name)}
        for name in ("ubuntu_gnome_prepare.py", "ubuntu_gnome_host.py")
    }
    monkeypatch.setattr(prepare, "bind_source", lambda *_args: (before, {}))
    locks = {
        "guest-closure": {"packages": []},
        "host-candidate": {
            "packages": [{**row, "filename": row["package"] + ".deb"} for row in LOCKED]
        },
    }
    monkeypatch.setattr(
        prepare,
        "resolve",
        lambda _owner, _root, destination, _roots: locks[destination.name],
    )
    extracted: list[object] = []
    monkeypatch.setattr(
        prepare, "extract_host_tools", lambda *args: extracted.append(args)
    )
    monkeypatch.setattr(prepare, "copy_package", lambda *_args: None)
    owner = AptOwner(tmp_path, REMOVING_PLAN)
    args = SimpleNamespace(
        package=package, inputs=tmp_path / "inputs", output=tmp_path / "output"
    )
    with pytest.raises(ValueError, match="replace or remove runner packages"):
        prepare.prepare_candidate(args, owner, {})
    assert extracted == []
    assert len(owner.apt()) == 1


class CandidateOwner:
    """Owned command fake for the download-only candidate; never a VM."""

    plan = CLEAN_PLAN

    def __init__(self, work: Path, proof: Path) -> None:
        self.work, self.proof = work, proof
        self.started = time.monotonic()
        self.work_deadline = self.started + 60
        self.cleanup_deadline = self.work_deadline + 30
        self.pending_commands: list[object] = []
        self.commands: list[list[str]] = []

    def command(self, argv: list[str], **_kwargs: object) -> bytes:
        self.commands.append(argv)
        return self.plan if "-s" in argv else b""

    def close(self) -> dict[str, object]:
        return {"vm_started": False, "pending_commands": []}


# A source-check receipt field the old source check never wrote.
ABSENT = object()


def run_candidate(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    plan: bytes,
    attestor_body_parsed: object = True,
) -> tuple[int, dict[str, Any], Path, list[Path]]:
    candidate = load("windows11_candidate", "windows11")
    artifact = tmp_path / "artifact"
    artifact.mkdir()
    (artifact / "fixture.txt").write_text("synthetic inert artifact\n")
    names = (
        "windows11_source_check.ps1",
        "windows11_bootstrap.ps1",
        "windows11_guest.ps1",
        "windows11_owned.cs",
    )
    source = ROOT / "windows11"
    checks = tmp_path / "source-check.json"
    receipt: dict[str, object] = {
        "schema": "japp-win11-target-source-check-v1",
        "status": "WINDOWS_POWERSHELL51_PARSE_AND_CS_COMPILE_PASS",
        "native_API_calls": 0,
        "VMs": 0,
        "product_launches": 0,
        "Windows11_acceptance": False,
        "attestor_body_parsed": attestor_body_parsed,
        "files": {
            name: {
                "bytes": (source / name).stat().st_size,
                "sha256": sha256(source / name),
            }
            for name in names
        },
    }
    if attestor_body_parsed is ABSENT:
        del receipt["attestor_body_parsed"]
    checks.write_text(json.dumps(receipt))

    retains: list[Path] = []

    def download(
        url: str, destination: Path, _cap: int, _deadline: float
    ) -> dict[str, Any]:
        destination.write_text("synthetic inert publisher page\n")
        return {"url": url, "bytes": 1, "sha256": candidate.MEDIA_SHA256}

    for name, value in {
        "require_linux": lambda: None,
        "require_host": lambda: None,
        "original_package": lambda *_args: {"portable_sha256": PACKAGE},
        "source_binding": lambda *_args, **_kwargs: {"git": ["fixture"]},
        "ensure_capacity": lambda _owner: {"fixture": True},
        "download": download,
        "publisher_digest": lambda _html: candidate.MEDIA_SHA256,
        "host_cpu": lambda: CPU_7763,
        "resolve": lambda *_args: {
            "packages": [{**row, "filename": row["package"] + ".deb"} for row in LOCKED]
        },
        "stage_host": lambda *_args: None,
        # Retention names members with POSIX separators (Linux-only by design).
        "retain": lambda proof, **_kwargs: retains.append(proof),
    }.items():
        monkeypatch.setattr(candidate, name, value)
    monkeypatch.setattr(CandidateOwner, "plan", plan)
    monkeypatch.setattr(candidate, "Owner", CandidateOwner)
    output = tmp_path / "output"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "windows11_candidate.py",
            "--source",
            str(tmp_path / "source"),
            "--artifact",
            str(artifact),
            "--output",
            str(output),
            "--guest-source-checks",
            str(checks),
            "--expected-head",
            "e" * 40,
            "--package-build-head",
            "p" * 40,
            "--source-tree",
            "t" * 40,
            "--manifest-sha256",
            "m" * 64,
        ],
    )
    code = candidate.main()
    closure = json.loads((output / "closure.json").read_text())
    return code, closure, output, retains


@pytest.mark.parametrize("plan", [CLEAN_PLAN, REMOVING_PLAN], ids=["clean", "drift"])
def test_windows_candidate_retains_or_refuses_the_host_plan(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, plan: bytes
) -> None:
    code, closure, output, retains = run_candidate(tmp_path, monkeypatch, plan)
    if plan is CLEAN_PLAN:
        assert (code, closure["status"]) == (
            0,
            "DOWNLOAD_ONLY_UNREVIEWED_CANDIDATE_COMPLETE",
        )
        retained = output / "host-install-plan.json"
        assert json.loads(retained.read_text())["upgraded"] == 0
        assert retains == [output]
    else:
        assert (code, closure["status"]) == (1, "CANDIDATE_FAILED")
        assert "Remv systemd-sysv" in closure["message"]
        assert not (output / "host-install-plan.json").exists()


@pytest.mark.parametrize(
    "parsed", [ABSENT, None, False, "true"], ids=["absent", "null", "false", "string"]
)
def test_windows_candidate_refuses_a_source_check_without_the_attestor_body(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, parsed: object
) -> None:
    # KI-0176: only a receipt whose hosted parse covered the attestor body is accepted.
    code, closure, output, _retains = run_candidate(
        tmp_path, monkeypatch, CLEAN_PLAN, parsed
    )
    assert (code, closure["status"]) == (1, "CANDIDATE_FAILED")
    assert (
        closure["message"]
        == "Actual target source-only parser/compiler receipt required"
    )
    assert not (output / "inputs" / "guest-source-check.json").exists()


# Hosted CPU: an explicit reviewed allow-list with a recorded support basis.


def test_reviewed_7763_has_official_windows11_support_basis(vm: ModuleType) -> None:
    inputs = sys.modules["windows11_inputs"]
    basis = inputs.host_cpu_support(CPU_7763)
    assert [row["entry"] for row in basis] == [
        "AMD EPYC 7763",
        "AMD EPYC 7003 Series",
    ]
    assert all(row["list"].startswith("https://learn.microsoft.com/") for row in basis)
    assert inputs.host_cpu_support({**CPU_7763, "stepping": "0"}) == basis
    assert vm.host_cpu_support is inputs.host_cpu_support


@pytest.mark.parametrize(
    "cpu",
    [CPU_9V74, {**CPU_7763, "vendor_id": "GenuineIntel"}, {**CPU_7763, "model": "17"}],
    ids=["epyc-9v74", "other-vendor", "other-model"],
)
def test_unreviewed_hosted_cpu_is_refused_naming_observed_and_allowed(
    vm: ModuleType, cpu: dict[str, str]
) -> None:
    inputs = sys.modules["windows11_inputs"]
    with pytest.raises(ValueError, match="no reviewed Windows 11 support") as raised:
        inputs.host_cpu_support(cpu)
    assert repr(cpu["model name"]) in str(raised.value)
    assert "'AMD EPYC 7763 64-Core Processor'" in str(raised.value)
    assert vm.host_cpu_support is inputs.host_cpu_support


def test_vm_cpu_is_the_host_with_hyper_v_enlightenments_only(
    vm: ModuleType, tmp_path: Path
) -> None:
    # KI-0181: without a virtual PMU, Windows' counter allocation bugchecked the
    # guest; the enlightenments keep the host CPU and its attested name unchanged.
    argv = vm.qemu_argv(tmp_path, tmp_path / "media.iso", tmp_path / "seed.iso")
    assert argv.count("-cpu") == 1
    cpu = argv[argv.index("-cpu") + 1].split(",")
    assert cpu[0] == "host"
    assert cpu[1:] == [
        "hv-relaxed",
        "hv-vapic",
        "hv-spinlocks=0x1fff",
        "hv-vpindex",
        "hv-runtime",
        "hv-time",
        "hv-synic",
        "hv-stimer",
        "hv-frequencies",
    ]
    # No model, vendor or hypervisor-identity override, and no passthrough set.
    assert not any(
        flag.split("=")[0]
        in ("model-id", "vendor", "hv-vendor-id", "hv-passthrough", "pmu", "hypervisor")
        or flag.startswith(("-", "+"))
        for flag in cpu[1:]
    )


def test_vm_has_no_acpi_sleep_or_hibernate_state(
    vm: ModuleType, tmp_path: Path
) -> None:
    argv = vm.qemu_argv(tmp_path, tmp_path / "media.iso", tmp_path / "seed.iso")
    globals_ = [argv[i + 1] for i, value in enumerate(argv) if value == "-global"]
    assert "ICH9-LPC.disable_s3=1" in globals_
    assert "ICH9-LPC.disable_s4=1" in globals_


# Guest protocol: frame acknowledgements and low-rate progress frames.


class Running:
    returncode = None

    def poll(self) -> None:
        return None


@pytest.fixture
def protocol(  # noqa: PLR0915 - one fake per protocol seam
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Callable[[bytes, float], SimpleNamespace]]:
    sockets: list[socket.socket] = []
    owners: list[Any] = []

    def start(serial: bytes, seconds: float) -> SimpleNamespace:
        proof, work = tmp_path / "proof", tmp_path / "work"
        proof.mkdir()
        work.mkdir()
        owner = vm.Owner(work, proof)
        owner.child = Running()
        owners.append(owner)
        owner.work_deadline = time.monotonic() + seconds
        pairs = {name: socket.socketpair() for name in ("qmp", "firmware", "serial")}
        for pair in pairs.values():
            sockets.extend(pair)
        pairs["qmp"][1].sendall(b'{"QMP": {"version": {}}}\n')
        pairs["firmware"][1].sendall(OBSERVED_CONSOLE)
        pairs["serial"][1].sendall(serial)
        guest = pairs["serial"][1]
        guest.setblocking(False)
        state = SimpleNamespace(owner=owner, calls=[], frames=[], received=b"")
        state.firmware, state.after_frame = pairs["firmware"][1], {}

        def drain() -> bytes:
            while True:
                try:
                    chunk = guest.recv(65536)
                except BlockingIOError:
                    return bytes(state.received)
                if not chunk:
                    return bytes(state.received)
                state.received += chunk

        def qmp_call(
            execute: str,
            arguments: dict[str, Any] | None = None,
            cleanup: bool = False,  # noqa: ARG001 - real signature
        ) -> object:
            state.calls.append(execute)
            if execute == "screendump":
                assert arguments is not None
                if state.screendump_error is not None:
                    raise state.screendump_error
                ppm(Path(arguments["filename"]))
            return {}

        def frame(name: str) -> dict[str, object]:
            state.frames.append((name, drain()))
            if name in state.after_frame:
                state.firmware.sendall(state.after_frame[name])
            return {"file": name + ".ppm", "width": 1280, "height": 800}

        def rest() -> bytes:
            # observe() closed its end: all it sent, then end of stream. A
            # Windows loopback socket pair need not have delivered it yet.
            guest.settimeout(10)
            while chunk := guest.recv(65536):
                state.received += chunk
            return bytes(state.received)

        state.screendump_error = None
        state.drain, state.rest = drain, rest
        # Poll fast so short fixture deadlines see several loop iterations.
        monkeypatch.setattr(
            vm,
            "select",
            SimpleNamespace(
                select=lambda r, w, x, t: select.select(r, w, x, min(t, 0.05))
            ),
        )
        monkeypatch.setattr(
            vm, "connect", lambda path, _owner: pairs[Path(path).name.split(".")[0]][0]
        )
        monkeypatch.setattr(owner, "qmp_call", qmp_call)
        monkeypatch.setattr(owner, "keys", lambda _codes: None)
        monkeypatch.setattr(owner, "frame", frame)
        monkeypatch.setattr(vm, "attest_guest", lambda *_args: None)
        return state

    yield start
    for owner in owners:
        if owner.qmp_stream is not None:
            owner.qmp_stream.close()
    for value in sockets:
        value.close()


def receipt(phase: str, **extra: object) -> bytes:
    row = {"phase": phase, "status": "PASS", "nonce": NONCE, "package_sha256": PACKAGE}
    return b"JAPP11 " + json.dumps({**row, **extra}).encode() + b"\r\n"


def test_each_framed_phase_is_acknowledged_after_its_frame(
    vm: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    protocol: Callable[[bytes, float], SimpleNamespace],
) -> None:
    monkeypatch.setattr(vm, "PROGRESS_FRAME_SECONDS", 0.2, raising=False)
    display = {"display_width": 1280, "display_height": 800, "package_sha256": PACKAGE}
    phases = vm.REQUIRED_PHASES[: vm.REQUIRED_PHASES.index("collision") + 1]
    serial = b"".join(
        receipt(phase, attestation=display)
        if phase == "environment"
        else receipt(phase)
        for phase in phases
    )
    state = protocol(serial, 2.5)
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    framed = ["ready", "keyboard", "restart", "relaunch", "collision"]
    expected = (
        b"JAPP11-ENV-ACCEPT "
        + NONCE.encode()
        + b"\n"
        + b"".join(
            b"JAPP11-FRAME-ACCEPT " + phase.encode() + b" " + NONCE.encode() + b"\n"
            for phase in framed
        )
    )
    assert state.rest() == expected
    assert [name for name, _seen in state.frames] == [
        "win11-environment",
        *("win11-" + phase for phase in framed),
    ]
    for (name, seen), phase in zip(state.frames[1:], framed, strict=True):
        assert name == "win11-" + phase
        assert b"FRAME-ACCEPT " + phase.encode() + b" " not in seen
    # Progress frames stop at the first receipt.
    assert "screendump" not in state.calls


def test_a_restart_after_the_first_receipt_fails_at_once(
    vm: ModuleType,
    protocol: Callable[[bytes, float], SimpleNamespace],
) -> None:
    # Both diagnostic round 39 VMs restarted after 'environment' and came back to
    # the lock screen; the host then waited out its whole work deadline.
    display = {"display_width": 1280, "display_height": 800, "package_sha256": PACKAGE}
    state = protocol(receipt("environment", attestation=display), 30.0)
    state.after_frame["win11-environment"] = OBSERVED_CONSOLE
    started = time.monotonic()
    with pytest.raises(ValueError, match="restarted after the guest started"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    assert time.monotonic() - started < 10
    assert [name for name, _seen in state.frames] == ["win11-environment"]


def test_firmware_text_without_a_boot_line_after_the_first_receipt_is_kept(
    vm: ModuleType,
    protocol: Callable[[bytes, float], SimpleNamespace],
) -> None:
    display = {"display_width": 1280, "display_height": 800, "package_sha256": PACKAGE}
    state = protocol(receipt("environment", attestation=display), 1.5)
    state.after_frame["win11-environment"] = b"\x1b[2J\x1b[01;01H"
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")


def test_setup_wait_keeps_bounded_low_rate_progress_frames(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    protocol: Callable[[bytes, float], SimpleNamespace],
) -> None:
    monkeypatch.setattr(vm, "PROGRESS_FRAME_SECONDS", 0.15, raising=False)
    monkeypatch.setattr(vm, "PROGRESS_FRAME_CAP", 3, raising=False)
    state = protocol(b"", 3.0)
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    assert state.calls.count("screendump") == 3
    for number in (1, 2, 3):
        name = "win11-progress-" + str(number)
        row = json.loads((tmp_path / "proof" / ("frame-" + name + ".json")).read_text())
        assert row["file"] == name + ".ppm"
        assert row["scope"] == "DIAGNOSTIC_FRAME_ONLY_NOT_PHASE_OR_ACCEPTANCE_EVIDENCE"
        assert row["sha256"] == sha256(tmp_path / "proof" / row["file"])
    assert not (tmp_path / "proof" / "frame-win11-progress-4.json").exists()


def test_a_failed_progress_frame_never_ends_the_campaign(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    protocol: Callable[[bytes, float], SimpleNamespace],
) -> None:
    monkeypatch.setattr(vm, "PROGRESS_FRAME_SECONDS", 0.15, raising=False)
    state = protocol(b"", 2.5)
    state.screendump_error = ValueError("QMP command failed")
    with pytest.raises(TimeoutError, match="setup/guest deadline expired"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    assert state.calls.count("screendump") == 1
    row = json.loads((tmp_path / "proof" / "frame-win11-progress-1.json").read_text())
    assert row == {"file": "win11-progress-1.ppm", "error_type": "ValueError"}


def test_diagnostic_frame_is_bounded(vm: ModuleType, tmp_path: Path) -> None:
    owner = SimpleNamespace(proof=tmp_path, late_frames=[])
    written: dict[str, Callable[[Path], object]] = {
        "win11-failure": lambda path: ppm(path, 2048, 2048),
        "win11-progress-1": lambda path: path.write_bytes(b"not a PPM frame\n"),
    }

    def qmp_call(
        _execute: str,
        arguments: dict[str, Any],
        cleanup: bool = False,  # noqa: ARG001 - real signature
    ) -> object:
        path = Path(arguments["filename"])
        written[path.stem](path)
        return {}

    owner.qmp_call = qmp_call
    with pytest.raises(ValueError, match="Diagnostic frame exceeded cap"):
        vm.diagnostic_frame(owner, "win11-failure")
    assert not (tmp_path / "win11-failure.ppm").exists()
    with pytest.raises(ValueError, match="Actual QMP RGB frame required"):
        vm.diagnostic_frame(owner, "win11-progress-1")
    assert not (tmp_path / "win11-progress-1.ppm").exists()
    with pytest.raises(ValueError, match="name exceeded allowance"):
        vm.diagnostic_frame(owner, "../win11-failure")


REJECTED_FRAMES = ("bad-header", "oversize", "blank")


def rejected_frame(shape: str) -> tuple[bytes, str]:
    """Frame bytes the phase bounds refuse, and the refusal they raise."""
    header = b"P6\n640 480\n255\n"
    if shape == "bad-header":
        grey = bytes(i % 251 for i in range(640 * 480))
        return b"P5\n640 480\n255\n" + grey, "Actual QMP RGB frame required"
    if shape == "oversize":
        return header + bytes(4 * 1024 * 1024), "Guest frame exceeded cap"
    return header + bytes(640 * 480 * 3), "blank/insufficient display evidence"


@pytest.mark.parametrize("shape", REJECTED_FRAMES)
def test_a_rejected_phase_frame_is_removed_before_its_refusal(
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, shape: str
) -> None:
    body, message = rejected_frame(shape)
    owner = vm.Owner(tmp_path / "work", tmp_path)

    def qmp_call(
        execute: str, arguments: dict[str, Any] | None = None, cleanup: bool = False
    ) -> object:
        assert (execute, cleanup) == ("screendump", False)
        assert arguments is not None
        Path(arguments["filename"]).write_bytes(body)
        return {}

    monkeypatch.setattr(owner, "qmp_call", qmp_call)
    with pytest.raises(ValueError, match=message):
        owner.frame("win11-environment")
    assert not (tmp_path / "win11-environment.ppm").exists()
    assert owner.frames == 1


# The real owner's QMP exchanges against QEMU's scripted end of a socket pair.

GREETING = b'{"QMP": {"version": {}, "capabilities": []}}\n'
CLOSE = -1.0


class QemuQmp:
    """QEMU's end of one QMP socket pair, served by a scripted peer thread.

    Like QEMU's monitor it answers requests in order. A screendump writes its
    frame first; an unrelated event precedes every reply, which follows the
    next scripted delay for that command. A CLOSE delay closes QMP instead.
    A scripted error is QEMU's error reply, with no frame written; a scripted
    split sends half of the reply line, then the rest after its delay.
    """

    def __init__(
        self,
        end: socket.socket,
        delays: dict[str, list[float]] | None = None,
        after: Callable[[dict[str, Any]], None] | None = None,
        errors: dict[str, list[bool]] | None = None,
        splits: dict[str, list[float]] | None = None,
    ) -> None:
        self.end = end
        self.delays = {key: list(value) for key, value in (delays or {}).items()}
        self.errors = {key: list(value) for key, value in (errors or {}).items()}
        self.splits = {key: list(value) for key, value in (splits or {}).items()}
        self.after = after
        self.requests: list[dict[str, Any]] = []
        self.split_sent = threading.Event()
        self.thread = threading.Thread(target=self.serve, daemon=True)
        self.thread.start()

    def serve(self) -> None:
        buffer = b""
        try:
            while chunk := self.end.recv(65536):
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    if not self.answer(json.loads(line)):
                        return
        except OSError:
            return

    def answer(self, request: dict[str, Any]) -> bool:
        self.requests.append(request)
        execute = request["execute"]
        pending = self.delays.get(execute)
        delay = pending.pop(0) if pending else 0.0
        if delay == CLOSE:
            self.end.close()
            return False
        failing = self.errors.get(execute)
        error = failing.pop(0) if failing else False
        if execute == "screendump" and not error:
            ppm(Path(request["arguments"]["filename"]), 640, 480)
        self.end.sendall(b'{"event": "RTC_CHANGE", "data": {"offset": 0}}\n')
        time.sleep(delay)
        reply: dict[str, Any] = {"return": {}, "id": request["id"]}
        if error:
            refusal = {"class": "GenericError", "desc": "synthetic refusal"}
            reply = {"error": refusal, "id": request["id"]}
        line = json.dumps(reply).encode() + b"\n"
        split = self.splits.get(execute)
        if split:
            seconds = split.pop(0)
            self.end.sendall(line[: len(line) // 2])
            time.sleep(seconds)
            self.end.sendall(line[len(line) // 2 :])
            self.split_sent.set()
        else:
            self.end.sendall(line)
        if self.after is not None:
            self.after(request)
        return True


@pytest.fixture
def qemu_qmp() -> Iterator[Callable[..., tuple[socket.socket, QemuQmp]]]:
    made: list[tuple[socket.socket, socket.socket, QemuQmp]] = []

    def start(**script: Any) -> tuple[socket.socket, QemuQmp]:  # noqa: ANN401
        client, end = socket.socketpair()
        # connect() leaves every owned socket with a 1 s timeout.
        client.settimeout(1)
        end.sendall(GREETING)
        peer = QemuQmp(end, **script)
        made.append((client, end, peer))
        return client, peer

    yield start
    for client, end, peer in made:
        client.close()
        peer.thread.join(10)
        end.close()


@pytest.fixture
def live(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    qemu_qmp: Callable[..., tuple[socket.socket, QemuQmp]],
) -> Iterator[Callable[..., SimpleNamespace]]:
    """observe() with the real owner's QMP calls, frames and boot key."""
    sockets: list[socket.socket] = []

    def start(
        seconds: float,
        delays: dict[str, list[float]],
        errors: dict[str, list[bool]] | None = None,
    ) -> SimpleNamespace:
        proof, work = tmp_path / "proof", tmp_path / "work"
        proof.mkdir()
        work.mkdir()
        owner = vm.Owner(work, proof)
        owner.child = Running()
        owner.work_deadline = time.monotonic() + seconds
        pairs = {name: socket.socketpair() for name in ("firmware", "serial")}
        for pair in pairs.values():
            sockets.extend(pair)
        pairs["firmware"][1].sendall(OBSERVED_CONSOLE)
        guest = pairs["serial"][1]
        display = {"display_width": 640, "display_height": 480}
        screendumps: list[str] = []

        def after(request: dict[str, Any]) -> None:
            # The guest reaches its environment phase only after the first
            # (progress) frame's reply, then fails right after its frame.
            if request["execute"] != "screendump":
                return
            screendumps.append(request["id"])
            if len(screendumps) == 1:
                guest.sendall(
                    receipt(
                        "environment",
                        attestation={**display, "package_sha256": PACKAGE},
                    )
                )
            elif len(screendumps) == 2:
                row = {"terminal": "FAIL", "nonce": NONCE, "package_sha256": PACKAGE}
                guest.sendall(b"JAPP11 " + json.dumps(row).encode() + b"\r\n")

        client, peer = qemu_qmp(delays=delays, after=after, errors=errors)
        sockets.append(client)

        def connect(path: Path, _owner: object) -> socket.socket:
            name = Path(path).name.split(".")[0]
            chosen = client if name == "qmp" else pairs[name][0]
            chosen.settimeout(1)  # as the real connect() leaves it
            return chosen

        monkeypatch.setattr(vm, "connect", connect)
        monkeypatch.setattr(vm, "attest_guest", lambda *_args: None)
        monkeypatch.setattr(vm, "PROGRESS_FRAME_SECONDS", 0.1)

        def received() -> bytes:
            # observe() closed its end: all it sent, then end of stream. A
            # Windows loopback socket pair need not have delivered it yet.
            guest.settimeout(10)
            data = b""
            while chunk := guest.recv(65536):
                data += chunk
            return data

        return SimpleNamespace(owner=owner, peer=peer, received=received)

    yield start
    for value in sockets:
        value.close()


def progress_row(tmp_path: Path) -> dict[str, Any]:
    path = tmp_path / "proof" / "frame-win11-progress-1.json"
    return dict(json.loads(path.read_text()))


@pytest.mark.parametrize(
    ("budget", "delay", "captured"),
    [(None, 1.5, True), (1.2, 2.0, False)],
    ids=["slower-than-the-socket-timeout", "past-its-own-budget"],
)
def test_a_slow_progress_frame_never_poisons_the_next_qmp_exchange(  # noqa: PLR0913, PLR0917
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    live: Callable[..., SimpleNamespace],
    budget: float | None,
    delay: float,
    captured: bool,
) -> None:
    if budget is not None:
        monkeypatch.setattr(vm, "QMP_SECONDS", budget, raising=False)
    state = live(20, {"screendump": [delay]})
    began = time.monotonic()
    # The environment frame is taken and accepted; the guest then fails.
    with pytest.raises(ValueError, match="environment or lifecycle failed"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    assert time.monotonic() - began < 15
    assert state.received() == b"JAPP11-ENV-ACCEPT " + NONCE.encode() + b"\n"
    environment = json.loads(
        (tmp_path / "proof" / "frame-environment.json").read_text()
    )
    assert (environment["width"], environment["height"]) == (640, 480)
    row = progress_row(tmp_path)
    if captured:
        assert row["sha256"] == sha256(tmp_path / "proof" / "win11-progress-1.ppm")
        assert state.owner.late_frames == []
    else:
        # The late reply was discarded by its id when it arrived.
        assert row == {"file": "win11-progress-1.ppm", "error_type": "TimeoutError"}
        assert state.owner.late_frames == [tmp_path / "proof" / "win11-progress-1.ppm"]
    assert state.owner.qmp_unusable is None
    ids = [request["id"] for request in state.peer.requests]
    assert len(set(ids)) == len(ids)


def test_an_unusable_qmp_stream_ends_the_campaign_at_once_with_its_cause(
    vm: ModuleType,
    tmp_path: Path,
    live: Callable[..., SimpleNamespace],
) -> None:
    state = live(10, {"screendump": [CLOSE]})
    began = time.monotonic()
    with pytest.raises(ValueError, match="Owned QMP unusable: CLOSED"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    # Well before the 10 s work deadline that would otherwise end it.
    assert time.monotonic() - began < 6
    assert progress_row(tmp_path) == {
        "file": "win11-progress-1.ppm",
        "error_type": "QmpClosedError",
    }
    sent = len(state.peer.requests)
    with pytest.raises(vm.QmpUnusableError, match="CLOSED"):
        state.owner.qmp_call("system_powerdown", cleanup=True)
    assert len(state.peer.requests) == sent
    assert state.received() == b""


def test_an_error_reply_to_a_progress_frame_never_poisons_qmp(
    vm: ModuleType,
    tmp_path: Path,
    live: Callable[..., SimpleNamespace],
) -> None:
    state = live(20, {}, errors={"screendump": [True]})
    # QEMU refuses the progress frame; the environment frame is then taken
    # and accepted, and the guest fails.
    with pytest.raises(ValueError, match="environment or lifecycle failed"):
        vm.observe(state.owner, NONCE, PACKAGE, "cpu")
    assert progress_row(tmp_path) == {
        "file": "win11-progress-1.ppm",
        "error_type": "ValueError",
    }
    assert state.owner.qmp_unusable is None
    environment = json.loads(
        (tmp_path / "proof" / "frame-environment.json").read_text()
    )
    assert (environment["width"], environment["height"]) == (640, 480)
    assert environment["sha256"] == sha256(tmp_path / "proof" / "win11-environment.ppm")
    assert state.received() == b"JAPP11-ENV-ACCEPT " + NONCE.encode() + b"\n"
    screendumps = [
        request for request in state.peer.requests if request["execute"] == "screendump"
    ]
    assert len(screendumps) == 2


def test_a_reply_split_across_its_budget_times_out_without_poisoning_qmp(
    vm: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    qemu_qmp: Callable[..., tuple[socket.socket, QemuQmp]],
) -> None:
    monkeypatch.setattr(vm, "QMP_SECONDS", 1.0)
    owner = vm.Owner(tmp_path / "work", tmp_path)
    client, peer = qemu_qmp(splits={"query-status": [2.0]})
    owner.qmp_open(client)
    began = time.monotonic()
    with pytest.raises(TimeoutError, match="Owned QMP response unavailable"):
        owner.qmp_call("query-status")
    assert time.monotonic() - began < 1.9
    # The first half of the reply line arrived inside the budget.
    assert owner.qmp_buffer.startswith(b'{"return": {}, "id')
    assert owner.qmp_unusable is None
    # The rest arrives after the budget; the next exchange discards the
    # completed stale reply by its id.
    assert peer.split_sent.wait(10)
    assert owner.qmp_call("query-kvm") == {}
    assert owner.qmp_unusable is None
    assert owner.qmp_buffer == b""
    assert [request["execute"] for request in peer.requests] == [
        "qmp_capabilities",
        "query-status",
        "query-kvm",
    ]


@pytest.mark.parametrize("line", [b"{not json\n", b"[1]\n"], ids=["malformed", "array"])
def test_a_malformed_qmp_reply_is_recorded_and_fails_fast(
    vm: ModuleType, tmp_path: Path, line: bytes
) -> None:
    owner = vm.Owner(tmp_path, tmp_path)
    client, end = socket.socketpair()
    with client, end:
        end.sendall(GREETING + line)
        with pytest.raises(vm.QmpUnusableError, match="MALFORMED"):
            owner.qmp_open(client)
        assert owner.qmp_unusable == "MALFORMED"
        with pytest.raises(vm.QmpUnusableError, match="MALFORMED"):
            owner.qmp_call("quit", cleanup=True)
        # Everything the owner sent, up to its end of the stream; a Windows
        # loopback socket pair need not have delivered it yet.
        client.shutdown(socket.SHUT_WR)
        end.settimeout(10)
        sent = b""
        while chunk := end.recv(65536):
            sent += chunk
        (request,) = sent.splitlines()
        assert json.loads(request)["execute"] == "qmp_capabilities"


def test_only_the_failure_frame_outlasts_the_vm_output_cap(
    vm: ModuleType,
    tmp_path: Path,
    qemu_qmp: Callable[..., tuple[socket.socket, QemuQmp]],
) -> None:
    owner = vm.Owner(tmp_path / "work", tmp_path)
    client, peer = qemu_qmp()
    owner.qmp_open(client)
    (tmp_path / "qemu.stderr").write_bytes(b"x" * (256 * 1024 + 1))
    with pytest.raises(ValueError, match="raw output cap exceeded"):
        vm.diagnostic_frame(owner, "win11-progress-1")
    frame = vm.diagnostic_frame(owner, "win11-failure")
    assert (frame["file"], frame["width"], frame["height"]) == (
        "win11-failure.ppm",
        640,
        480,
    )
    assert [request["execute"] for request in peer.requests] == [
        "qmp_capabilities",
        "screendump",
    ]


# Whole campaign bracket: post-PASS collection, failure evidence, CPU gate.

NATIVE = {"fixture": "synthetic native shell capture"}


class Owned(Protocol):
    work_deadline: float
    qmp: object
    qmp_unusable: str | None

    def frame(self, name: str) -> dict[str, object]: ...


class Clock:
    """time.monotonic with an offset that fakes advance instead of sleeping."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.offset = 0.0
        real = time.monotonic
        monkeypatch.setattr(time, "monotonic", lambda: real() + self.offset)

    def advance(self, seconds: float) -> None:
        self.offset += seconds


class VM:
    """Fake owned QEMU child; wait() never sleeps, it only reports state.

    Like Popen, an exit is seen only through poll() or wait(). A stop request
    takes effect during the next wait that lasts stop_seconds; with a fake
    clock, each wait advances it by the time it used.
    """

    def __init__(
        self,
        stops_on: tuple[str, ...],
        clock: Clock | None = None,
        stop_seconds: float = 0.0,
    ) -> None:
        self.stops_on = stops_on
        self.clock, self.stop_seconds = clock, stop_seconds
        self.stopping = False
        self.returncode: int | None = None
        self.pid = 4242
        self.waits: list[float | None] = []

    def poll(self) -> int | None:
        return self.returncode

    def used(self, seconds: float) -> None:
        if self.clock is not None:
            self.clock.advance(seconds)

    def wait(self, timeout: float | None = None) -> int:
        self.waits.append(timeout)
        if (
            self.returncode is None
            and self.stopping
            and self.stop_seconds <= (timeout or 0)
        ):
            self.used(self.stop_seconds)
            self.returncode = 0
        if self.returncode is None:
            self.used(timeout or 0)
            raise subprocess.TimeoutExpired("qemu", timeout or 0)
        return self.returncode

    def request(self, execute: str) -> None:
        if execute in self.stops_on:
            self.stopping = True


class Reaped:
    returncode = 0
    pid = 4343

    def poll(self) -> int:
        return 0


def guest_results(destination: Path) -> None:
    proof = destination / "proof"
    proof.mkdir(parents=True)
    (proof / "native-shell.json").write_text(json.dumps(NATIVE))
    (proof / "environment.json").write_text(json.dumps({"package_sha256": PACKAGE}))
    (proof / "owned-cleanup.json").write_text(json.dumps([{"settled": True}]))


@pytest.fixture
def campaign(  # noqa: PLR0915 - one fake per campaign seam
    vm: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Callable[..., SimpleNamespace]:
    def run(  # noqa: PLR0913, PLR0915 - one keyword per injected fault
        observe: Callable[[Owned], dict[str, Any]],
        *,
        stops_on: tuple[str, ...] = ("system_powerdown",),
        cpu: dict[str, str] = CPU_7763,
        recorded_cpu: dict[str, str] = CPU_7763,
        collect: Callable[[Path], None] = guest_results,
        screendump: Exception | None = None,
        on_qmp: Callable[[SimpleNamespace, str, dict[str, Any] | None], None]
        | None = None,
        on_close: Callable[[SimpleNamespace], None] | None = None,
        clock: Clock | None = None,
        stop_seconds: float = 0.0,
    ) -> SimpleNamespace:
        state = SimpleNamespace(
            vm=VM(stops_on, clock, stop_seconds),
            qmp=[],
            qmp_cleanup=[],
            commands=[],
            command_at=[],
            packages=0,
            owner=None,
            retains=[],
        )
        bundle, proof = tmp_path / "bundle", tmp_path / "proof"
        bundle.mkdir()
        (bundle / "media-lock.json").write_text(
            json.dumps(
                {
                    "media": {"url": vm.MEDIA, "sha256": vm.MEDIA_SHA256, "bytes": 5},
                    "iso_retained_in_artifact": False,
                    "host_cpu_requires_different_official_support_review": recorded_cpu,
                }
            )
        )
        (bundle / "guest-driver.json").write_text("{}\n")
        firmware = tmp_path / "firmware"
        firmware.mkdir()
        (firmware / "vars.fd").write_bytes(b"synthetic inert variables")

        real_owner = vm.Owner

        def make_owner(work: Path, proof: Path) -> Any:  # noqa: ANN401 - real Owner
            owner = real_owner(work, proof)
            state.owner = owner

            def command(
                argv: list[str],
                seconds: float = 30,
                cap: int = 0,  # noqa: ARG001 - real signature
                permit_failure: bool = False,  # noqa: ARG001 - real signature
                cleanup: bool = False,
            ) -> bytes:
                limit = owner.cleanup_deadline if cleanup else owner.work_deadline
                if time.monotonic() >= limit:
                    raise TimeoutError("Outer VM command authority expired")
                state.commands.append((Path(argv[0]).name, seconds, cleanup))
                state.command_at.append((Path(argv[0]).name, time.monotonic()))
                if argv[0] == vm.TOOLS["mcopy"]:
                    collect(Path(argv[-1]))
                return b""

            def qmp_call(
                execute: str,
                arguments: dict[str, Any] | None = None,
                cleanup: bool = False,
            ) -> object:
                if not cleanup and owner.vm_output_exceeded():
                    # As the real owner: refused locally, never sent to QEMU.
                    raise ValueError("Owned VM raw output cap exceeded")
                state.qmp.append(execute)
                state.qmp_cleanup.append((execute, cleanup))
                if on_qmp is not None:
                    on_qmp(state, execute, arguments)
                if execute == "screendump":
                    if screendump is not None:
                        raise screendump
                    assert arguments is not None
                    ppm(Path(arguments["filename"]), 64, 48)
                state.vm.request(execute)
                return {}

            def close() -> dict[str, object]:
                # The real closure quits QEMU, or kills its group after 10 s,
                # and reaps it either way; QEMU finishes queued work as it quits.
                if owner.child is not None and owner.child.returncode is None:
                    if on_close is not None:
                        on_close(state)
                    state.vm.request("quit")
                    state.vm.returncode = 0 if state.vm.stopping else -9
                return {
                    "vm_started": owner.child is not None,
                    "group_after_reap": "ABSENT",
                }

            owner.command, owner.qmp_call, owner.close = command, qmp_call, close
            return owner

        def popen(argv: list[str], **_kwargs: object) -> object:
            if argv[0] == vm.TOOLS["swtpm"]:
                Path(argv[-1].split("path=", 1)[1]).write_bytes(b"")
                return Reaped()
            return state.vm

        def original_package(*_args: object) -> dict[str, Any]:
            state.packages += 1
            return {"portable_sha256": PACKAGE}

        def observed(owner: Owned, *_args: object) -> dict[str, Any]:
            owner.qmp = object()
            return observe(owner)

        for name, value in {
            "require_linux": lambda: None,
            "require_host": lambda: None,
            "audit_bundle": lambda *_args: {
                "source_sha": "e" * 40,
                "package_build_sha": "p" * 40,
                "source_tree_sha": "t" * 40,
                "package_manifest_sha256": "m" * 64,
            },
            "original_package": original_package,
            "source_binding": lambda *_args, **_kwargs: {"git": ["fixture"]},
            "host_cpu": lambda: cpu,
            "ensure_capacity": lambda _owner: {"fixture": True},
            "capacity": lambda _work: {"eligible": True},
            "install_tools": lambda *_args: None,
            "kvm": lambda _owner: {"api_version": 12},
            "download": lambda *_args: {"sha256": vm.MEDIA_SHA256, "bytes": 5},
            "seed": lambda _bundle, _package, owner, _nonce: owner.work / "seed.iso",
            "FIRMWARE": {
                "code": str(firmware / "code.fd"),
                "vars": str(firmware / "vars.fd"),
            },
            "subprocess": SimpleNamespace(
                Popen=popen,
                DEVNULL=subprocess.DEVNULL,
                TimeoutExpired=subprocess.TimeoutExpired,
            ),
            "group_observation": lambda _pid: ("ABSENT", None),
            "Owner": make_owner,
            "observe": observed,
            "validate_capture": lambda *_args: None,
            "verify_capture_images": lambda *_args: None,
            "attest_guest": lambda *_args: None,
            # Retention names members with POSIX separators (Linux-only by design).
            "retain": state.retains.append,
        }.items():
            monkeypatch.setattr(vm, name, value)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "windows11_vm.py",
                "--source",
                str(tmp_path / "source"),
                "--bundle",
                str(bundle),
                "--proof",
                str(proof),
                "--expected-head",
                "e" * 40,
                "--package-build-head",
                "p" * 40,
                "--source-tree",
                "t" * 40,
                "--manifest-sha256",
                "m" * 64,
                "--bundle-sha256",
                "u" * 64,
                "--media-lock-sha256",
                sha256(bundle / "media-lock.json"),
                "--host-tools-sha256",
                "h" * 64,
                "--guest-driver-sha256",
                sha256(bundle / "guest-driver.json"),
            ],
        )
        state.code = vm.main()
        state.closure = json.loads((proof / "closure.json").read_text())
        state.proof = proof
        return state

    return run


def guest_pass(owner: Owned) -> dict[str, Any]:
    del owner
    return {
        "receipts": [{"phase": "keyboard", "native_shell": NATIVE}],
        "terminal": {"terminal": "PASS"},
    }


@pytest.mark.parametrize(
    ("stops_on", "graceful", "waits"),
    [
        (("system_powerdown",), True, [180]),
        (("quit",), False, [180, 10]),
    ],
    ids=["graceful", "slow-power-off"],
)
def test_a_slow_power_off_never_turns_a_validated_guest_pass_into_failed(
    vm: ModuleType,
    campaign: Callable[..., SimpleNamespace],
    stops_on: tuple[str, ...],
    graceful: bool,
    waits: list[int],
) -> None:
    state = campaign(guest_pass, stops_on=stops_on)
    assert (state.code, state.closure["status"]) == (
        0,
        "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS",
    )
    assert state.closure["actual_native_Windows11_acceptance"] is True
    assert state.closure["guest_terminal"] == "PASS"
    stop = state.closure["guest_stop"]
    assert (stop["graceful"], stop["forced_quit"], stop["exit_code"]) == (
        graceful,
        not graceful,
        0,
    )
    assert stop["bound_seconds"] == vm.POWERDOWN_SECONDS == 180
    assert state.vm.waits == waits
    collected = state.proof / "guest-results" / "proof"
    assert json.loads((collected / "native-shell.json").read_text()) == NATIVE
    assert state.retains == [state.proof]


def test_the_lifecycle_job_timeout_covers_the_campaign_authority(
    vm: ModuleType,
) -> None:
    # The job must outlast the owner's work and post-PASS authority, leaving
    # ten minutes for checkout, the reviewed input download and the always()
    # retention upload; otherwise a slow campaign loses its evidence.
    workflow = ROOT.parent / ".github" / "workflows" / "windows11-native-lifecycle.yml"
    jobs = yaml.safe_load(workflow.read_text(encoding="utf-8"))["jobs"]
    minutes = jobs["win11"]["timeout-minutes"]
    assert (vm.WORK_SECONDS, vm.POST_PASS_SECONDS) == (3300, 265)
    assert minutes * 60 - (vm.WORK_SECONDS + vm.POST_PASS_SECONDS) >= 600


def test_a_pass_accepted_at_the_work_deadline_is_still_collected(
    vm: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    campaign: Callable[..., SimpleNamespace],
) -> None:
    clock = Clock(monkeypatch)
    accepted: list[float] = []

    def late(owner: Owned) -> dict[str, Any]:
        # The guest PASS arrives exactly at the work deadline.
        clock.advance(owner.work_deadline - time.monotonic())
        accepted.append(time.monotonic())
        return guest_pass(owner)

    # The slow power-off uses its full bound; quit then uses all of its own.
    state = campaign(
        late, stops_on=("quit",), clock=clock, stop_seconds=vm.FORCED_STOP_SECONDS
    )
    assert (state.code, state.closure["status"]) == (
        0,
        "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS",
    )
    stop = state.closure["guest_stop"]
    assert (stop["graceful"], stop["forced_quit"], stop["exit_code"]) == (
        False,
        True,
        0,
    )
    assert state.vm.waits == [vm.POWERDOWN_SECONDS, vm.FORCED_STOP_SECONDS]
    owner = state.owner
    # The same addition main() performs; a subtraction would differ by an ulp
    # whenever the monotonic origin puts the sum across a power of two.
    assert owner.cleanup_deadline == owner.work_deadline + vm.POST_PASS_SECONDS
    # The result copy runs under cleanup authority after the whole 190 s stop,
    # with its own bound and the source endpoint replay still inside it.
    ((_name, at),) = [row for row in state.command_at if row[0] == "mcopy"]
    assert ("mcopy", vm.COLLECT_SECONDS, True) in state.commands
    assert at - accepted[0] >= vm.POWERDOWN_SECONDS + vm.FORCED_STOP_SECONDS - 1e-6
    assert owner.cleanup_deadline - at >= vm.COLLECT_SECONDS + 30
    assert (state.proof / "source-after.json").is_file()


def test_a_vm_output_cap_tripped_after_the_guest_pass_never_withholds_the_stop(
    vm: ModuleType, tmp_path: Path, campaign: Callable[..., SimpleNamespace]
) -> None:
    def pass_then_cap(owner: Owned) -> dict[str, Any]:
        # QEMU's raw output passes its cap only after the validated guest PASS.
        (tmp_path / "proof" / "qemu.stderr").write_bytes(b"x" * (256 * 1024 + 1))
        return guest_pass(owner)

    # A slow power-off, so both the power-off and the forced quit are needed.
    state = campaign(pass_then_cap, stops_on=("quit",))
    assert state.owner.vm_output_exceeded()
    assert state.qmp_cleanup == [("system_powerdown", True), ("quit", True)]
    stop = state.closure["guest_stop"]
    assert (stop["graceful"], stop["forced_quit"], stop["exit_code"]) == (
        False,
        True,
        0,
    )
    assert "powerdown_error" not in stop
    assert "quit_error" not in stop
    # The trip is visible in the PASS proof itself.
    assert stop["vm_output_cap_exceeded"] is True
    assert state.vm.waits == [vm.POWERDOWN_SECONDS, vm.FORCED_STOP_SECONDS]
    assert ("mcopy", vm.COLLECT_SECONDS, True) in state.commands
    assert (state.code, state.closure["status"]) == (
        0,
        "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS",
    )


def test_a_lost_power_off_reply_still_waits_for_the_power_off(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    def on_qmp(
        state: SimpleNamespace, execute: str, _arguments: dict[str, Any] | None
    ) -> None:
        if execute == "system_powerdown":
            state.vm.request(execute)  # the power button was pressed
            raise TimeoutError("Owned QMP response unavailable")

    state = campaign(guest_pass, on_qmp=on_qmp)
    assert state.closure["status"] == "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS"
    stop = state.closure["guest_stop"]
    assert (stop["graceful"], stop["forced_quit"], stop["exit_code"]) == (
        True,
        False,
        0,
    )
    assert stop["powerdown_error"] == "TimeoutError"
    assert state.vm.waits == [180]
    assert "quit" not in state.qmp


def test_qmp_closing_before_the_quit_reply_still_keeps_the_guest_pass(
    vm: ModuleType, campaign: Callable[..., SimpleNamespace]
) -> None:
    def on_qmp(
        state: SimpleNamespace, execute: str, _arguments: dict[str, Any] | None
    ) -> None:
        if execute == "quit":
            # QEMU exits 0 and closes QMP before its quit reply is read.
            state.vm.stopping = True
            raise vm.QmpClosedError("Owned QMP unusable: CLOSED")

    state = campaign(guest_pass, stops_on=(), on_qmp=on_qmp)
    assert (state.code, state.closure["status"]) == (
        0,
        "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS",
    )
    stop = state.closure["guest_stop"]
    assert (stop["graceful"], stop["forced_quit"], stop["exit_code"]) == (
        False,
        True,
        0,
    )
    assert stop["quit_reply"] == "QMP_CLOSED_BY_QUIT"
    assert "quit_error" not in stop
    assert state.vm.waits == [180, 10]


def test_an_empty_guest_results_folder_is_still_collected_on_failure(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    attempts: list[Path] = []

    def collect(destination: Path) -> None:
        attempts.append(destination)
        if len(attempts) == 1:
            raise RuntimeError("Owned command failed; original raw output retained")
        guest_results(destination)

    state = campaign(guest_pass, collect=collect)
    assert state.closure["status"] == "FAILED"
    assert len(attempts) == 2
    assert "failure_result_collection_error" not in state.closure
    collected = state.proof / "guest-results" / "proof"
    assert (collected / "owned-cleanup.json").is_file()


def test_a_timeout_keeps_one_failure_frame_before_power_down(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    def stalled(_owner: Owned) -> dict[str, Any]:
        raise TimeoutError(
            "Actual Windows setup/guest deadline expired; no login automation fallback"
        )

    state = campaign(stalled)
    assert state.closure["status"] == "FAILED"
    assert state.closure["message"].startswith("Actual Windows setup/guest deadline")
    assert state.qmp[:2] == ["screendump", "system_powerdown"]
    frame = state.closure["failure_frame"]
    assert frame["file"] == "win11-failure.ppm"
    assert (frame["width"], frame["height"]) == (64, 48)
    assert sha256(state.proof / "win11-failure.ppm") == frame["sha256"]
    assert state.retains == [state.proof]


def test_a_failed_failure_frame_never_masks_the_primary_error(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    def failed(_owner: Owned) -> dict[str, Any]:
        raise ValueError("Actual Windows guest environment or lifecycle failed")

    state = campaign(failed, screendump=ValueError("QMP command failed"))
    assert state.closure["message"] == (
        "Actual Windows guest environment or lifecycle failed"
    )
    assert state.closure["failure_frame_error"] == "ValueError"
    assert state.qmp[:2] == ["screendump", "system_powerdown"]
    assert state.closure["guest_powerdown_before_collection"] == 0


def test_a_lost_failure_path_power_off_reply_still_waits_for_the_power_off(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    def stalled(_owner: Owned) -> dict[str, Any]:
        raise TimeoutError("Actual Windows setup/guest deadline expired")

    def on_qmp(
        state: SimpleNamespace, execute: str, _arguments: dict[str, Any] | None
    ) -> None:
        if execute == "system_powerdown":
            state.vm.request(execute)  # the power button was pressed
            raise TimeoutError("Owned QMP response unavailable")

    state = campaign(stalled, on_qmp=on_qmp)
    assert state.closure["message"] == "Actual Windows setup/guest deadline expired"
    assert state.qmp == ["screendump", "system_powerdown"]
    assert state.closure["guest_powerdown_error"] == "TimeoutError"
    assert 20 in state.vm.waits
    assert state.closure["guest_powerdown_before_collection"] == 0


def test_an_unanswered_failure_frame_is_never_retained_unverified(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    def stalled(_owner: Owned) -> dict[str, Any]:
        raise TimeoutError("Actual Windows setup/guest deadline expired")

    def on_qmp(
        _state: SimpleNamespace, execute: str, arguments: dict[str, Any] | None
    ) -> None:
        if execute == "screendump":
            # QEMU writes an oversized frame only after the reply budget.
            assert arguments is not None
            ppm(Path(arguments["filename"]), 2048, 2048)
            raise TimeoutError("Owned QMP response unavailable")

    state = campaign(stalled, on_qmp=on_qmp)
    assert state.closure["message"] == "Actual Windows setup/guest deadline expired"
    assert state.closure["failure_frame_error"] == "TimeoutError"
    # The failure frame is a cleanup-scoped request; the power-off still runs.
    assert state.qmp_cleanup[:2] == [("screendump", True), ("system_powerdown", False)]
    assert state.closure["guest_powerdown_before_collection"] == 0
    assert not (state.proof / "win11-failure.ppm").exists()
    assert state.closure["unvalidated_frames_removed"] == ["win11-failure.ppm"]
    assert state.retains == [state.proof]


def test_a_phase_frame_finished_after_its_lost_reply_is_removed_after_closure(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    lost: list[Path] = []

    def environment(owner: Owned) -> dict[str, Any]:
        owner.frame("win11-environment")
        raise AssertionError("A lost screendump reply is never a frame")

    def on_qmp(
        _state: SimpleNamespace, execute: str, arguments: dict[str, Any] | None
    ) -> None:
        if execute == "screendump":
            assert arguments is not None
            path = Path(arguments["filename"])
            if path.name == "win11-environment.ppm":
                lost.append(path)
                raise TimeoutError("Owned QMP response unavailable")

    def on_close(_state: SimpleNamespace) -> None:
        # QEMU finishes the queued phase frame only as it quits, so only a
        # removal after closure can see it.
        if lost:
            ppm(lost[0], 640, 480)

    # QEMU ignores the failure-path power button, so closure must quit it.
    state = campaign(environment, stops_on=("quit",), on_qmp=on_qmp, on_close=on_close)
    assert (state.closure["status"], state.closure["error_type"]) == (
        "FAILED",
        "TimeoutError",
    )
    assert lost == [state.proof / "win11-environment.ppm"]
    assert not lost[0].exists()
    assert state.closure["unvalidated_frames_removed"] == ["win11-environment.ppm"]
    assert "late_frame_cleanup_error" not in state.closure
    # The failure frame was validated, so it is retained.
    assert state.closure["failure_frame"]["file"] == "win11-failure.ppm"
    assert (state.proof / "win11-failure.ppm").is_file()
    assert state.retains == [state.proof]


def test_an_unremovable_unvalidated_frame_never_leaves_a_guest_pass(
    vm: ModuleType, campaign: Callable[..., SimpleNamespace]
) -> None:
    def progress_then_pass(owner: Owned) -> dict[str, Any]:
        with pytest.raises(TimeoutError):
            vm.diagnostic_frame(owner, "win11-progress-1")
        return guest_pass(owner)

    def on_qmp(
        _state: SimpleNamespace, execute: str, arguments: dict[str, Any] | None
    ) -> None:
        if execute == "screendump":
            # What QEMU left after the lost reply cannot be removed: unlinking
            # a directory fails on every verify host.
            assert arguments is not None
            Path(arguments["filename"]).mkdir()
            raise TimeoutError("Owned QMP response unavailable")

    state = campaign(progress_then_pass, on_qmp=on_qmp)
    assert state.closure["guest_terminal"] == "PASS"
    assert (state.code, state.closure["status"]) == (
        1,
        "UNVALIDATED_FRAME_CLEANUP_FAILURE",
    )
    assert state.closure["actual_native_Windows11_acceptance"] is False
    assert state.closure["late_frame_cleanup_error"] in {
        "IsADirectoryError",
        "PermissionError",
    }
    assert "unvalidated_frames_removed" not in state.closure
    assert state.qmp.count("screendump") == 1


def test_an_unusable_qmp_stream_skips_every_further_qmp_request(
    vm: ModuleType, campaign: Callable[..., SimpleNamespace]
) -> None:
    def closed(owner: Owned) -> dict[str, Any]:
        owner.qmp_unusable = "CLOSED"
        raise vm.QmpUnusableError("Owned QMP unusable: CLOSED")

    state = campaign(closed)
    assert (state.closure["status"], state.closure["message"]) == (
        "FAILED",
        "Owned QMP unusable: CLOSED",
    )
    assert state.closure["qmp_unusable"] == "CLOSED"
    assert state.qmp == []
    assert "failure_frame" not in state.closure
    assert state.closure["tpm_closure"]["reaped"] is True


def test_an_unreviewed_hosted_cpu_fails_fast_and_is_recorded(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    state = campaign(guest_pass, cpu=CPU_9V74)
    assert (state.code, state.closure["status"]) == (1, "FAILED")
    assert "'AMD EPYC 9V74 80-Core Processor'" in state.closure["message"]
    assert "'AMD EPYC 7763 64-Core Processor'" in state.closure["message"]
    assert state.packages == 0
    recorded = json.loads((state.proof / "host-cpu.json").read_text())
    assert recorded == {"observed": CPU_9V74, "candidate_recorded": CPU_7763}
    assert state.vm.waits == []


def test_a_reviewed_runner_cpu_is_admitted_whatever_the_candidate_runner_was(
    campaign: Callable[..., SimpleNamespace],
) -> None:
    state = campaign(guest_pass, recorded_cpu=CPU_9V74)
    assert state.closure["status"] == "SCOPED_NATIVE_WINDOWS11_LIFECYCLE_PASS"
    recorded = json.loads((state.proof / "host-cpu.json").read_text())
    assert recorded["observed"] == CPU_7763
    assert recorded["candidate_recorded"] == CPU_9V74
    assert recorded["windows11_support_basis"][0]["entry"] == "AMD EPYC 7763"
