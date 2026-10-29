from __future__ import annotations

import importlib.util
import json
import ntpath
import os
import struct
import subprocess
import sys
from pathlib import Path
from typing import Protocol
from unittest.mock import patch

import pytest

spec = importlib.util.spec_from_file_location(
    "windows_builder", Path(__file__).parents[1] / "build-windows-runtime.py"
)
assert spec is not None
assert spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def args(target: str) -> list[str]:
    result = ["builder"]
    for name in [
        "contracts-wheel",
        "orchestrator-wheel",
        "runtime-requirements",
        "python",
        "uv",
        "work-dir",
        "destination",
    ]:
        result += ["--" + name, "/missing/" + name]
    return [
        *result,
        "--contracts-sha256",
        "a" * 64,
        "--orchestrator-sha256",
        "b" * 64,
        "--target",
        target,
    ]


def test_windows_builder_refuses_non_windows_target_before_filesystem(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sys, "argv", args("aarch64-apple-darwin"))
    monkeypatch.setattr(module, "host_target", lambda: "x86_64-pc-windows-msvc")
    with pytest.raises(ValueError, match="Windows x64 only"):
        module.main()


def test_windows_builder_refuses_actual_wrong_host_before_filesystem(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sys, "argv", args("x86_64-pc-windows-msvc"))
    monkeypatch.setattr(module, "host_target", lambda: "aarch64-apple-darwin")
    with pytest.raises(ValueError, match="actual build host"):
        module.main()


def test_windows_builder_preserves_six_stages_with_explicit_pins_and_no_shell(  # noqa: PLR0915 - one ordered synthetic build proof
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.syspath_prepend(str(Path(__file__).parents[1]))
    tools = tmp_path / "tools"
    tools.mkdir()
    python = tools / "python.exe"
    uv = tools / "uv.exe"
    python.write_bytes(b"synthetic tool")
    uv.write_bytes(b"synthetic tool")
    contracts = tmp_path / "contracts.whl"
    orchestrator = tmp_path / "orchestrator.whl"
    requirements = tmp_path / "runtime.lock"
    contracts.write_bytes(b"synthetic contracts")
    orchestrator.write_bytes(b"synthetic orchestrator")
    requirements.write_bytes(b"synthetic runtime requirements")
    work = tmp_path / "work"
    destination = tmp_path / "runtime"
    argv = ["builder"]
    for name, value in {
        "contracts-wheel": contracts,
        "orchestrator-wheel": orchestrator,
        "runtime-requirements": requirements,
        "python": python,
        "uv": uv,
        "work-dir": work,
        "destination": destination,
        "contracts-sha256": module.sha256(contracts),
        "orchestrator-sha256": module.sha256(orchestrator),
        "target": "x86_64-pc-windows-msvc",
    }.items():
        argv += ["--" + name, str(value)]
    monkeypatch.setattr(sys, "argv", argv)
    monkeypatch.setattr(module, "host_target", lambda: "x86_64-pc-windows-msvc")
    # The synthetic Windows build must not run the actual host platform probe:
    # Python on Windows may implement it through subprocess.check_output("ver").
    monkeypatch.setattr(module.platform, "system", lambda: "Windows")

    trusted_windows = str(tmp_path / "trusted-windows")

    class Buffer(Protocol):
        value: str

    class Kernel:
        @staticmethod
        def GetWindowsDirectoryW(buffer: Buffer, size: int) -> int:  # noqa: N802 - native API spelling
            del size
            buffer.value = trusted_windows
            return len(trusted_windows)

    monkeypatch.setattr(
        module.ctypes, "WinDLL", lambda *_a, **_k: Kernel(), raising=False
    )
    monkeypatch.setenv("SystemRoot", "/untrusted/parent")
    monkeypatch.setenv("JAPP_PRIVATE_TOKEN", "synthetic-parent-must-not-copy")
    for name in ["USERPROFILE", "APPDATA", "LOCALAPPDATA", "PYINSTALLER_CONFIG_DIR"]:
        monkeypatch.setenv(name, "hostile-parent-must-not-copy")
    calls: list[list[str]] = []

    def fake_run(
        command: list[str], **options: object
    ) -> subprocess.CompletedProcess[bytes]:
        calls.append(command)
        assert "shell" not in options
        assert options["cwd"] == work
        assert options["timeout"] == 300
        environment = options["env"]
        assert isinstance(environment, dict)
        assert environment["SystemRoot"] == trusted_windows
        assert environment["PATH"] == ""
        assert "JAPP_PRIVATE_TOKEN" not in environment
        # Windows Path.home uses the real stdlib ntpath expansion. A scrubbed
        # environment must still supply a usable private profile to PyInstaller.
        with patch.dict(os.environ, environment, clear=True):
            expanded = ntpath.expanduser("~")
        assert expanded == str(work / "build-home")
        assert Path(expanded).is_dir()
        assert environment["LOCALAPPDATA"] == str(work / "build-home/AppData/Local")
        assert environment["APPDATA"] == str(work / "build-home/AppData/Roaming")
        assert environment["PYINSTALLER_CONFIG_DIR"] == str(work / "pyinstaller-cache")
        for name in ["LOCALAPPDATA", "APPDATA", "PYINSTALLER_CONFIG_DIR"]:
            assert Path(environment[name]).is_dir()
        assert "HOME" not in environment
        assert "HOMEDRIVE" not in environment
        assert "HOMEPATH" not in environment
        assert set(environment) == {
            "PATH",
            "PYTHONNOUSERSITE",
            "PYTHONHASHSEED",
            "UV_CACHE_DIR",
            "SystemRoot",
            "WINDIR",
            "TEMP",
            "TMP",
            "USERPROFILE",
            "LOCALAPPDATA",
            "APPDATA",
            "PYINSTALLER_CONFIG_DIR",
        }
        output = b""
        if command == [str(python), "--version"]:
            output = b"Python 3.12.13\n"
        elif command == [str(uv), "--version"]:
            output = b"uv 0.11.32 synthetic\n"
        elif "venv" in command:
            target = Path(command[-1]) / "Scripts"
            target.mkdir(parents=True)
            (target / "python.exe").write_bytes(b"synthetic interpreter")
        elif "PyInstaller" in command:
            target = work / "dist/japp-orchestrator"
            target.mkdir(parents=True)
            raw = bytearray(256)
            raw[:2] = b"MZ"
            struct.pack_into("<I", raw, 60, 64)
            raw[64:68] = b"PE\0\0"
            struct.pack_into("<H", raw, 68, 0x8664)
            struct.pack_into("<H", raw, 84, 112)
            struct.pack_into("<H", raw, 88, 0x20B)
            struct.pack_into("<H", raw, 156, 3)
            (target / "japp-orchestrator.exe").write_bytes(raw)
            (target / "dependency.dll").write_bytes(b"synthetic dependency")
        return subprocess.CompletedProcess(command, 0, output, b"")

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    module.main()
    proof = json.loads((work / "build-proof.json").read_text())
    assert [row["label"] for row in proof["commands"]] == [
        "00-python-pin",
        "00-uv-pin",
        "01-venv",
        "02-runtime-install",
        "03-build-install",
        "04-wheels-install",
        "05-resolved-pins",
        "06-native-build",
    ]
    assert "--require-hashes" in calls[3]
    assert "--require-hashes" in calls[4]
    assert "--no-deps" in calls[5]
    final = calls[-1]
    for required in ["--onedir", "--console", "--noupx", "msvcrt"]:
        assert required in final
    assert "--windowed" not in final
    assert (destination / "japp-orchestrator/dependency.dll").is_file()
    assert module.__file__ is not None
    assert proof["builder_script_sha256"] == module.sha256(Path(module.__file__))
