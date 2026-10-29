"""Narrow policy regression oracles for the isolated inactive Windows11 gate."""

from __future__ import annotations

import importlib.util
import os
import shutil
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

AFTER = Path(__file__).parents[2]
# Only existing inert infrastructure bodies are copied as fixture data.
REFERENCE = Path(os.environ.get("JAPP_WIN11_REFERENCE_ROOT", str(AFTER)))


@pytest.fixture
def checker() -> ModuleType:
    name = "windows11_isolation_checker"
    spec = importlib.util.spec_from_file_location(
        name, AFTER / "scripts/check_portability.py"
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def island(tmp_path: Path) -> Path:
    shutil.copytree(AFTER / "scripts/windows11", tmp_path / "scripts/windows11")
    shutil.copytree(AFTER / ".github/workflows", tmp_path / ".github/workflows")
    for name in ("ci.yml", "ubuntu-gnome-prepare.yml", "ubuntu-gnome-lifecycle.yml"):
        shutil.copyfile(
            REFERENCE / ".github/workflows" / name,
            tmp_path / ".github/workflows" / name,
        )
    for name in ("pyproject.toml", "package.json", "scripts/verification-suites.json"):
        shutil.copyfile(AFTER / name, tmp_path / name)
    return tmp_path


def test_exact_windows11_island_and_inactive_workflows(
    checker: ModuleType, island: Path
) -> None:
    violations: list[Any] = []
    checker._check_windows11_infrastructure(island, violations)
    checker._check_workflow_files(island, violations)
    assert not violations


@pytest.mark.parametrize(
    "mutation", ["extra", "nonregular", "platform", "native", "guard", "import"]
)
def test_island_refuses_unknown_or_substituted_source(
    checker: ModuleType, island: Path, mutation: str
) -> None:
    folder = island / "scripts/windows11"
    if mutation == "extra":
        (folder / "new.py").write_text("pass\n")
    elif mutation == "nonregular":
        path = folder / "windows11_inputs.py"
        path.unlink()
        path.mkdir()
    elif mutation == "platform":
        with (folder / "windows11_platform.py").open("a") as stream:
            stream.write("\n# changed exact host boundary\n")
    elif mutation == "native":
        with (folder / "windows11_guest.ps1").open("a") as stream:
            stream.write("\n# changed reviewed native guest source\n")
    elif mutation == "guard":
        path = folder / "windows11_vm.py"
        path.write_text(
            path.read_text().replace("    require_linux()\n", "    pass\n", 1)
        )
    else:
        with (folder / "windows11_inputs.py").open("a") as stream:
            stream.write("\nimport an_unreviewed_provider\n")
    violations: list[Any] = []
    checker._check_windows11_infrastructure(island, violations)
    assert any(v.rule == "PORT-SRC-009" for v in violations)


@pytest.mark.parametrize(
    "text",
    [
        "import windows11_vm",
        "from windows11_inputs import host_cpu",
        "candidate = 'scripts/windows11/windows11_vm.py'",
    ],
)
def test_shared_runtime_refuses_isolated_host_infrastructure(
    checker: ModuleType, island: Path, text: str
) -> None:
    (island / "scripts/shared.py").write_text(text + "\n")
    violations: list[Any] = []
    checker._check_linux_shared_imports(island, violations)
    assert any(v.rule == "PORT-SRC-009" for v in violations)


def test_windows11_preserves_isolated_and_shared_mypy_targets(
    checker: ModuleType, island: Path
) -> None:
    assert not checker._linux_quality_failures(island)
    assert not checker._linux_quality_failures(island, "scripts/windows11")
    path = island / "scripts/verification-suites.json"
    data = path.read_text()
    path.write_text(
        data.replace(
            '["uv", "run", "mypy", "--platform", "linux", "scripts/windows11"]',
            '["uv", "run", "mypy", "--platform", "win32", "scripts/windows11"]',
        )
    )
    assert checker._linux_quality_failures(island)
    assert checker._linux_quality_failures(island, "scripts/windows11")


def test_unknown_auxiliary_or_changed_exact_workflow_is_refused(
    checker: ModuleType, island: Path
) -> None:
    path = island / ".github/workflows/windows11-native-prepare.yml"
    path.write_text(path.read_text() + "\n# changed\n")
    violations: list[Any] = []
    checker._check_workflow_files(island, violations)
    assert violations


def test_legacy_gnome_only_policy_and_workflow_forms_remain_valid(
    checker: ModuleType, island: Path
) -> None:
    shutil.rmtree(island / "scripts/windows11")
    for name in ("windows11-native-prepare.yml", "windows11-native-lifecycle.yml"):
        (island / ".github/workflows" / name).unlink()
    assert not checker._linux_quality_failures(island)
    violations: list[Any] = []
    checker._check_workflow_files(island, violations)
    assert not violations


def test_native_metadata_label_does_not_reference_executable_infrastructure(
    checker: ModuleType,
) -> None:
    assert not checker._linux_reference("windows11_desktop_observed")
    for value in (
        "windows11_vm",
        "windows11_inputs.host_cpu",
        "windows11_guest.ps1",
        "python scripts/windows11/windows11_vm.py",
    ):
        assert checker._linux_reference(value)
