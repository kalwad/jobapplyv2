"""Pure policy/metadata probes for Linux evidence tooling, never native actors."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import stat
import sys
from pathlib import Path
from types import ModuleType

import check_portability
import pytest
from _bounded_process import run_bounded_process

REPO = Path(__file__).parents[2]
SOURCE = REPO / "scripts/linux_gnome"


def _load(name: str) -> ModuleType:
    sys.path.insert(0, str(SOURCE))
    spec = importlib.util.spec_from_file_location(name, SOURCE / f"{name}.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def isolated(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    directory = root / "scripts/linux_gnome"
    directory.mkdir(parents=True)
    for name in check_portability.LINUX_INFRASTRUCTURE_MODULES:
        shutil.copyfile(SOURCE / name, directory / name)
    for name in ("pyproject.toml", "package.json", "scripts/verification-suites.json"):
        destination = root / name
        destination.parent.mkdir(exist_ok=True, parents=True)
        destination.write_bytes((REPO / name).read_bytes())
    return root


def _findings(root: Path) -> list[check_portability.Violation]:
    rows: list[check_portability.Violation] = []
    check_portability._check_linux_infrastructure(root, rows)
    return rows


def test_explicit_linux_inventory_and_quality_coverage_pass(isolated: Path) -> None:
    assert _findings(isolated) == []
    assert not check_portability.AST_LITERAL_ALLOWLIST


@pytest.mark.parametrize("host", ["win32", "darwin", "freebsd14", "linux2", ""])
def test_unsupported_cli_hosts_refused_before_inputs_or_actors(
    monkeypatch: pytest.MonkeyPatch, host: str
) -> None:
    boundary = _load("ubuntu_gnome_platform")
    for name in sorted(
        check_portability.LINUX_INFRASTRUCTURE_ENTRYPOINTS | {"ubuntu_gnome_atspi.py"}
    ):
        module = _load(Path(name).stem)
        with monkeypatch.context() as scoped:
            scoped.setattr(boundary.sys, "platform", host)
            execute = (
                module.load_native if name == "ubuntu_gnome_atspi.py" else module.main
            )
            with pytest.raises(RuntimeError, match="requires Linux"):
                execute()


def test_linux_host_boundary_only_does_pure_host_selection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    boundary = _load("ubuntu_gnome_platform")
    monkeypatch.setattr(boundary.sys, "platform", "linux")
    assert boundary.require_linux() is None


@pytest.mark.parametrize("entry", ["unknown.py", "unknown.txt", ".hidden.py", "nested"])
def test_unregistered_isolated_entry_is_refused(isolated: Path, entry: str) -> None:
    path = isolated / check_portability.LINUX_INFRASTRUCTURE_REL / entry
    if entry == "nested":
        path.mkdir()
    else:
        path.write_text("value = 1\n", encoding="utf-8")
    assert any("inventory" in row.message for row in _findings(isolated))


@pytest.mark.parametrize("name", sorted(check_portability.LINUX_INFRASTRUCTURE_MODULES))
def test_every_registered_module_is_required(isolated: Path, name: str) -> None:
    (isolated / check_portability.LINUX_INFRASTRUCTURE_REL / name).unlink()
    assert any("inventory" in row.message for row in _findings(isolated))


@pytest.mark.parametrize(
    "mutation",
    [
        "remove",
        "late",
        "shadow",
        "alias-shadow",
        "unknown-import",
        "unknown-library",
        "relative-import",
    ],
)
def test_guard_or_import_boundary_bypass_is_refused(
    isolated: Path, mutation: str
) -> None:
    path = isolated / "scripts/linux_gnome/ubuntu_gnome_request.py"
    source = path.read_text(encoding="utf-8")
    if mutation == "remove":
        source = source.replace("    require_linux()\n", "")
    elif mutation == "late":
        source = source.replace(
            "    require_linux()\n", "    value = 1\n    require_linux()\n"
        )
    elif mutation == "shadow":
        source += "\nrequire_linux = lambda: None\n"
    elif mutation == "alias-shadow":
        source += "\nfrom os import getpid as require_linux\n"
    elif mutation == "unknown-library":
        source += "\nfrom unknown_dependency import value\n"
    elif mutation == "relative-import":
        source += "\nfrom . import ubuntu_gnome_process\n"
    else:
        source += "\nfrom ubuntu_gnome_unknown import value\n"
    path.write_text(source, encoding="utf-8")
    assert any(row.rule == "PORT-SRC-009" for row in _findings(isolated))


def test_modified_linux_guard_body_is_refused(isolated: Path) -> None:
    path = isolated / "scripts/linux_gnome/ubuntu_gnome_platform.py"
    path.write_text("def require_linux() -> None:\n    pass\n", encoding="utf-8")
    assert any("boundary body" in row.message for row in _findings(isolated))


@pytest.mark.parametrize(
    "statement",
    [
        "import ubuntu_gnome_vm\n",
        "from scripts.linux_gnome import ubuntu_gnome_vm\n",
        'import importlib\nmodule = importlib.import_module("ubuntu_gnome_vm")\n',
        'import runpy\nrunpy.run_path("scripts/linux_gnome/ubuntu_gnome_vm.py")\n',
    ],
)
def test_shared_runtime_cannot_import_or_execute_linux_infrastructure(
    isolated: Path, statement: str
) -> None:
    (isolated / "scripts/shared_probe.py").write_text(statement, encoding="utf-8")
    assert any("shared runtime" in row.message for row in _findings(isolated))


def test_same_linux_literals_and_chmod_still_fail_in_shared_runtime(
    isolated: Path,
) -> None:
    path = isolated / "scripts/shared_probe.py"
    path.write_text(
        'from pathlib import Path\nPath("/usr/bin/example").chmod(0o755)\n',
        encoding="utf-8",
    )
    rows: list[check_portability.Violation] = []
    check_portability._check_runtime_script(isolated, path, rows)
    assert {row.rule for row in rows} == {"PORT-SRC-001", "PORT-SRC-004"}


@pytest.mark.parametrize(
    ("statement", "rule"),
    [
        ('import subprocess\nsubprocess.run(["tool"], shell=True)\n', "PORT-SRC-002"),
        ('part = "name"\nvalue = part + "/" + part\n', "PORT-SRC-003"),
    ],
)
def test_generic_shell_and_separator_guards_still_apply_inside_linux_boundary(
    isolated: Path, statement: str, rule: str
) -> None:
    path = isolated / "scripts/linux_gnome/ubuntu_gnome_retention.py"
    with path.open("a", encoding="utf-8") as stream:
        stream.write("\n" + statement)
    assert any(row.rule == rule for row in _findings(isolated))


@pytest.mark.parametrize("suite", ["format", "typecheck", "python"])
def test_quality_registry_omission_is_refused(isolated: Path, suite: str) -> None:
    path = isolated / "scripts/verification-suites.json"
    registry = json.loads(path.read_bytes())
    selected = next(row for row in registry["suites"] if row["id"] == suite)
    selected["commands"] = [
        [part for part in command if part != check_portability.LINUX_INFRASTRUCTURE_REL]
        for command in selected["commands"]
    ]
    path.write_text(json.dumps(registry), encoding="utf-8")
    assert any(row.rule == "PORT-SRC-009" for row in _findings(isolated))


def test_changing_shared_mypy_to_linux_is_refused(isolated: Path) -> None:
    path = isolated / "scripts/verification-suites.json"
    registry = json.loads(path.read_bytes())
    for suite in registry["suites"]:
        if suite["id"] == "python":
            for command in suite["commands"]:
                if command[:3] == ["uv", "run", "mypy"] and "services" in command:
                    command[3:3] = ["--platform", "linux"]
    path.write_text(json.dumps(registry), encoding="utf-8")
    assert any("shared mypy" in row.message for row in _findings(isolated))


@pytest.mark.parametrize("subject", ["package-format", "mypy-import-path"])
def test_other_quality_registration_omission_is_refused(
    isolated: Path, subject: str
) -> None:
    if subject == "package-format":
        path = isolated / "package.json"
        value = json.loads(path.read_bytes())
        value["scripts"]["format"] = value["scripts"]["format"].replace(
            "scripts/linux_gnome ", ""
        )
        path.write_text(json.dumps(value), encoding="utf-8")
    else:
        path = isolated / "pyproject.toml"
        path.write_text(
            path.read_text(encoding="utf-8").replace(
                '    "scripts/linux_gnome",\n', ""
            ),
            encoding="utf-8",
        )
    assert any(row.rule == "PORT-SRC-009" for row in _findings(isolated))


def test_missing_entire_surface_with_auxiliary_workflow_is_refused(
    isolated: Path,
) -> None:
    shutil.rmtree(isolated / "scripts/linux_gnome")
    workflows = isolated / ".github/workflows"
    workflows.mkdir(parents=True)
    (workflows / "ubuntu-gnome-prepare.yml").write_text("name: fixture\n")
    assert any(row.rule == "PORT-SRC-009" for row in _findings(isolated))


@pytest.mark.parametrize("mode", [stat.S_IFLNK, stat.S_IFDIR, stat.S_IFIFO])
def test_nonregular_source_metadata_is_refused_without_host_symlink_privileges(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
    mode: int,
) -> None:
    target = isolated / "scripts/linux_gnome/ubuntu_gnome_guest.py"
    original = Path.lstat

    def metadata(path: Path) -> os.stat_result:
        value = original(path)
        if path == target:
            fields = list(value)
            fields[0] = mode | 0o644
            return os.stat_result(fields)
        return value

    monkeypatch.setattr(Path, "lstat", metadata)
    assert any("regular Linux source" in row.message for row in _findings(isolated))


def test_exporter_uses_the_exact_parent_source_parser() -> None:
    exporter = _load("ubuntu_gnome_package_export")
    parser = sys.modules["linux_package"]
    assert parser.__file__ is not None
    assert (
        Path(parser.__file__).resolve() == (REPO / "scripts/linux_package.py").resolve()
    )
    assert exporter.ar_members is parser.ar_members
    assert exporter.tar_members is parser.tar_members


def _normal_guard_cache(root: Path) -> Path:
    directory = root / "scripts/linux_gnome"
    program = (
        "import sys; sys.dont_write_bytecode = False; "
        "sys.path.insert(0, sys.argv[1]); import ubuntu_gnome_platform; "
        "assert sys.dont_write_bytecode is False"
    )
    result = run_bounded_process(
        [sys.executable, "-c", program, str(directory)],
        cwd=root,
        timeout_seconds=5,
        label="pure-guard-bytecode",
        max_output_bytes=4096,
    )
    assert result.returncode == 0, result.stderr
    path = directory / "__pycache__/ubuntu_gnome_platform.cpython-312.pyc"
    assert path.is_file()
    return path


def test_normal_owned_guard_import_bytecode_is_accepted(isolated: Path) -> None:
    _normal_guard_cache(isolated)
    assert _findings(isolated) == []


@pytest.mark.parametrize(
    "mutation",
    [
        "unknown",
        "tag",
        "opt",
        "source",
        "directory",
        "payload",
        "flags",
        "source-changed",
    ],
)
def test_unknown_or_mutated_generated_cache_is_refused(
    isolated: Path,
    mutation: str,
) -> None:
    path = _normal_guard_cache(isolated)
    if mutation == "unknown":
        path.rename(path.with_name("unknown.cpython-312.pyc"))
    elif mutation == "tag":
        path.rename(path.with_name("ubuntu_gnome_platform.cpython-313.pyc"))
    elif mutation == "opt":
        path.rename(path.with_name("ubuntu_gnome_platform.cpython-312.opt-1.pyc"))
    elif mutation == "source":
        path.with_name("hidden.py").write_text("value = 1\n", encoding="utf-8")
    elif mutation == "directory":
        path.with_name("nested").mkdir()
    elif mutation == "source-changed":
        source = path.parents[1] / "ubuntu_gnome_platform.py"
        source.write_bytes(source.read_bytes() + b"# changed cache subject\n")
    else:
        raw = bytearray(path.read_bytes())
        raw[-1 if mutation == "payload" else 4] ^= 1
        path.write_bytes(raw)
    assert any("cache" in row.message for row in _findings(isolated))


@pytest.mark.parametrize("entry", ["directory", "file"])
@pytest.mark.parametrize("mode", [stat.S_IFLNK, stat.S_IFIFO])
def test_nonregular_cache_metadata_is_refused_without_symlink_privileges(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
    entry: str,
    mode: int,
) -> None:
    target = _normal_guard_cache(isolated)
    if entry == "directory":
        target = target.parent
    original = Path.lstat

    def metadata(path: Path) -> os.stat_result:
        value = original(path)
        if path == target:
            fields = list(value)
            fields[0] = mode | 0o644
            return os.stat_result(fields)
        return value

    monkeypatch.setattr(Path, "lstat", metadata)
    assert any(
        "regular Linux bytecode cache" in row.message for row in _findings(isolated)
    )


def test_bytecode_from_a_different_source_location_is_refused(
    isolated: Path,
    tmp_path: Path,
) -> None:
    _normal_guard_cache(isolated)
    relocated = tmp_path / "different-source-location"
    shutil.copytree(isolated, relocated)
    assert any("cache differs" in row.message for row in _findings(relocated))
