"""Pure build-coordinator tests; no supplied tool or runtime is executed."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "linux_builder_environment",
    Path(__file__).parents[1] / "build-linux-service-runtime.py",
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Native runtime builder source cannot be loaded")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def invoke_synthetic_build(
    root: Path, monkeypatch: pytest.MonkeyPatch, calls: list[dict[str, object]]
) -> None:
    inputs = root / "supplied-inputs"
    inputs.mkdir()
    paths = {}
    for name in ["contracts.whl", "orchestrator.whl", "runtime.lock", "python", "uv"]:
        path = inputs / name
        path.write_bytes(b"synthetic build input; never executable")
        paths[name] = path
    work = root / "work"

    def fake_run(  # noqa: PLR0913 - exact subprocess.run keyword seam
        argv: list[str],
        *,
        cwd: Path,
        env: dict[str, str],
        capture_output: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[bytes]:
        assert cwd == work
        assert capture_output is True
        assert timeout == 300
        assert check is False
        calls.append({"argv": argv, "environment": dict(env)})
        if "PyInstaller" in argv:
            payload = work / "dist/japp-orchestrator"
            payload.mkdir(parents=True)
            (payload / "japp-orchestrator").write_bytes(b"synthetic native fixture")
        stdout = b""
        if argv[-1] == "--version":
            stdout = (
                b"Python 3.12.13\n"
                if Path(argv[0]).name == "python"
                else b"uv 0.11.32 synthetic\n"
            )
        return subprocess.CompletedProcess(argv, 0, stdout=stdout, stderr=b"")

    arguments = [str(Path(__file__).parents[1] / "build-linux-service-runtime.py")]
    for name, value in {
        "contracts-wheel": paths["contracts.whl"],
        "orchestrator-wheel": paths["orchestrator.whl"],
        "runtime-requirements": paths["runtime.lock"],
        "python": paths["python"],
        "uv": paths["uv"],
        "work-dir": work,
        "destination": root / "destination",
        "contracts-sha256": BUILDER.sha256(paths["contracts.whl"]),
        "orchestrator-sha256": BUILDER.sha256(paths["orchestrator.whl"]),
        "target": "x86_64-unknown-linux-gnu",
    }.items():
        arguments.extend(["--" + name, str(value)])
    monkeypatch.setattr(sys, "argv", arguments)
    monkeypatch.setattr(BUILDER.platform, "system", lambda: "Linux")
    monkeypatch.setattr(BUILDER.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(
        BUILDER.platform,
        "freedesktop_os_release",
        lambda: {"ID": "ubuntu", "VERSION_ID": "24.04"},
    )
    monkeypatch.setattr(BUILDER.subprocess, "run", fake_run)
    BUILDER.main()


def test_all_six_stages_use_system_defaults_without_ambient_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    defaults = os.pathsep.join(
        str(tmp_path / name) for name in ["system-tools-a", "system-tools-b"]
    )
    monkeypatch.setattr(os, "defpath", defaults)
    monkeypatch.setenv("PATH", "hostile-ambient-command-directory")
    monkeypatch.setenv("PYTHONPATH", "hostile-ambient-module-directory")
    calls: list[dict[str, object]] = []
    invoke_synthetic_build(tmp_path, monkeypatch, calls)
    assert len(calls) == 8
    expected_env = {
        "PATH": defaults,
        "PYTHONNOUSERSITE": "1",
        "PYTHONHASHSEED": "0",
        "UV_CACHE_DIR": str(tmp_path / "work/uv-cache"),
    }
    if os.name == "nt":
        for name in ["SystemRoot", "WINDIR", "TEMP", "TMP"]:
            if name in os.environ:
                expected_env[name] = os.environ[name]
    assert all(call["environment"] == expected_env for call in calls)
    proof = json.loads((tmp_path / "work/build-proof.json").read_text())
    assert [record["label"] for record in proof["commands"]] == [
        "00-python-pin",
        "00-uv-pin",
        "01-venv",
        "02-runtime-install",
        "03-build-install",
        "04-wheels-install",
        "05-resolved-pins",
        "06-native-build",
    ]
    assert all(record["environment"] == expected_env for record in proof["commands"])


@pytest.mark.parametrize(
    "case",
    [
        "empty",
        "relative",
        "dot",
        "parent-relative",
        "leading-empty",
        "trailing-empty",
        "middle-empty",
        "absolute-cwd",
        "absolute-child-cwd",
    ],
)
def test_invalid_system_defaults_fail_before_any_build_command(
    case: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    absolute = str(tmp_path / "system-tools")
    invalid = {
        "empty": "",
        "relative": "relative-tools",
        "dot": ".",
        "parent-relative": "../tools",
        "leading-empty": os.pathsep + absolute,
        "trailing-empty": absolute + os.pathsep,
        "middle-empty": absolute + os.pathsep + os.pathsep + absolute,
        "absolute-cwd": str(Path.cwd()),
        "absolute-child-cwd": str(tmp_path / "work"),
    }[case]
    monkeypatch.setattr(os, "defpath", invalid)
    monkeypatch.setenv("PATH", absolute)
    calls: list[dict[str, object]] = []
    with pytest.raises(ValueError, match="System default PATH must contain"):
        invoke_synthetic_build(tmp_path, monkeypatch, calls)
    assert calls == []
