"""Reviewed local archive installs leave APT no repository (KI-0148).

apt-get --no-download refuses even archives named as local files on apt 2.8,
so the host and guest installers instead give APT an empty source list and
empty package lists. These are pure argument oracles; the behavior was
observed on disposable ubuntu-24.04 runners (diagnostic run 41157825709).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "scripts" / "linux_gnome"
INSTALLERS = (
    "scripts/linux_gnome/ubuntu_gnome_host.py",
    "scripts/linux_gnome/ubuntu_gnome_provision.py",
    "scripts/windows11/windows11_vm.py",
)


@pytest.fixture
def process() -> ModuleType:
    name = "ubuntu_gnome_process"
    sys.path.insert(0, str(SOURCE))
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_local_only_apt_configures_no_repository(
    process: ModuleType, tmp_path: Path
) -> None:
    options = process.local_only_apt(tmp_path)
    sources = tmp_path / "apt-no-sources"
    lists = tmp_path / "apt-no-lists"
    assert options == [
        "-o",
        "Dir::Etc::SourceList=/dev/null",
        "-o",
        f"Dir::Etc::SourceParts={sources}",
        "-o",
        f"Dir::State::Lists={lists}",
        "-o",
        "Dir::Cache::pkgcache=",
        "-o",
        "Dir::Cache::srcpkgcache=",
    ]
    assert list(sources.iterdir()) == []
    assert [path.name for path in lists.iterdir()] == ["partial"]
    assert list((lists / "partial").iterdir()) == []


def test_local_only_apt_requests_private_directories(
    process: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The installers run on Linux only; record the requested mode so the
    # private-state contract is checked on every verify host.
    requested: list[tuple[Path, int, bool, bool]] = []
    original = Path.mkdir

    def record(
        self: Path, mode: int = 0o777, parents: bool = False, exist_ok: bool = False
    ) -> None:
        requested.append((self, mode, parents, exist_ok))
        original(self, mode, parents, exist_ok)

    monkeypatch.setattr(Path, "mkdir", record)
    process.local_only_apt(tmp_path)
    lists = tmp_path / "apt-no-lists"
    assert requested == [
        (tmp_path / "apt-no-sources", 0o700, False, False),
        (lists, 0o700, False, False),
        (lists / "partial", 0o700, False, False),
    ]


def test_local_only_apt_never_reuses_existing_state(
    process: ModuleType, tmp_path: Path
) -> None:
    process.local_only_apt(tmp_path)
    with pytest.raises(FileExistsError):
        process.local_only_apt(tmp_path)


@pytest.mark.parametrize("installer", INSTALLERS)
def test_every_reviewed_installer_uses_local_only_apt(installer: str) -> None:
    source = (ROOT / installer).read_text(encoding="utf-8")
    assert '"--no-download"' not in source
    assert source.count('"/usr/bin/apt-get",\n') == 1
    assert source.count("*local_only_apt(") == 1
    call = source.index('"/usr/bin/apt-get",\n')
    assert source.index("*local_only_apt(", call) - call < 60
