from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import plistlib
import stat
import subprocess
import sys
from pathlib import Path, PurePath, PureWindowsPath
from types import ModuleType

import pytest


def module() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "macos_package", Path(__file__).parents[1] / "macos_package.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Package inspector source is missing")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


INSPECTOR = module()


# Synthetic Darwin mode metadata is restricted to owned fixture main files.
_OWNED_MAIN: dict[Path, tuple[int, int, int, int]] = {}
_NATIVE_MAIN_MODE = INSPECTOR.main_executable_mode


def manifest_path(path: PurePath, root: PurePath) -> str:
    return path.relative_to(root).as_posix()


def fixture_main_mode(path: Path, *, native_execute_bits: bool = True) -> int:
    value = path.stat()
    if (
        value.st_dev,
        value.st_ino,
        value.st_size,
        value.st_mtime_ns,
    ) != _OWNED_MAIN.get(path):
        raise ValueError("Unowned or changed synthetic Darwin main")
    if not stat.S_ISREG(value.st_mode) or path.is_symlink():
        raise ValueError("Unowned or changed synthetic Darwin main")
    native_mode = value.st_mode
    if not native_execute_bits:
        native_mode &= ~0o111
    return (native_mode & ~0o777) | 0o700


@pytest.fixture(autouse=True)
def owned_inspection_dependencies(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _OWNED_MAIN.clear()
    monkeypatch.setattr(INSPECTOR, "main_executable_mode", fixture_main_mode)
    tool_dir = tmp_path / "synthetic-system-tools"
    monkeypatch.setattr(INSPECTOR.os, "defpath", str(tool_dir))

    def synthetic_which(_command: str, *, path: str) -> str:
        assert path == str(tool_dir)
        return str(tool_dir / "codesign")

    monkeypatch.setattr(INSPECTOR.shutil, "which", synthetic_which)


def fixture(tmp_path: Path) -> tuple[Path, Path, str]:
    app = tmp_path / "Desktop App.app"
    resources = app / "Contents/Resources/runtime"
    staged = tmp_path / "owned-stage"
    for root in [resources, staged]:
        (root / "japp-orchestrator").mkdir(parents=True)
        (root / "japp-orchestrator/japp-orchestrator").write_bytes(b"signed-sidecar")
        (root / "dependency").write_bytes(b"signed-library")
        records = [
            {
                "path": manifest_path(path, root),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in sorted(root.rglob("*"))
            if path.is_file()
        ]
        (root / "manifest.json").write_text(json.dumps({"files": records}))
    (app / "Contents/MacOS").mkdir()
    executable = app / "Contents/MacOS/japp-desktop"
    executable.write_bytes(b"owned-main-app")
    metadata = executable.stat()
    if len(_OWNED_MAIN) >= 8:
        raise ValueError("Synthetic Darwin fixture bound exceeded")
    _OWNED_MAIN[executable] = (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
    )
    (app / "Contents/Info.plist").write_bytes(
        plistlib.dumps(
            {
                "CFBundleExecutable": "japp-desktop",
                "CFBundleIdentifier": "dev.jobapply.desktop",
                "CFBundleShortVersionString": "0.0.1",
                "LSMinimumSystemVersion": "14.0",
            }
        )
    )
    return (
        app,
        staged,
        hashlib.sha256((staged / "manifest.json").read_bytes()).hexdigest(),
    )


def test_exact_post_signing_runtime_is_retained_for_inspection(tmp_path: Path) -> None:
    app, stage, expected = fixture(tmp_path)
    result = INSPECTOR.inspect_package(app, stage, expected)
    assert result["runtime_manifest_sha256"] == expected
    assert result["status"] == "STATIC_BYTES_PASS_SIGNATURE_AND_LIFECYCLE_PENDING"


def test_post_signing_sidecar_mutation_is_rejected(tmp_path: Path) -> None:
    app, stage, expected = fixture(tmp_path)
    (
        app / "Contents/Resources/runtime/japp-orchestrator/japp-orchestrator"
    ).write_bytes(b"resigned-change")
    with pytest.raises(ValueError, match="Runtime bytes differ"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_rewritten_bundle_manifest_cannot_self_authorize(tmp_path: Path) -> None:
    app, stage, expected = fixture(tmp_path)
    (app / "Contents/Resources/runtime/manifest.json").write_text("{}")
    with pytest.raises(ValueError, match="Compile-bound manifest mismatch"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_extra_or_missing_resource_is_rejected(tmp_path: Path) -> None:
    app, stage, expected = fixture(tmp_path)
    (app / "Contents/Resources/runtime/extra").write_bytes(b"injected")
    with pytest.raises(ValueError, match="Runtime inventory differs"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_escaped_main_executable_is_rejected(tmp_path: Path) -> None:
    app, stage, expected = fixture(tmp_path)
    path = app / "Contents/Info.plist"
    info = plistlib.loads(path.read_bytes())
    info["CFBundleExecutable"] = "../outside"
    path.write_bytes(plistlib.dumps(info))
    with pytest.raises(ValueError, match="Invalid main executable"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_mutation_after_semantic_check_cannot_enter_later_baseline(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    output = tmp_path / "inspection-output"
    original = INSPECTOR.inventory
    calls = 0
    changed = False

    def mutate_before_fourth_snapshot(root: Path) -> object:
        nonlocal calls, changed
        calls += 1
        if calls == 4:
            (app / "Contents/Resources/runtime/dependency").write_bytes(
                b"changed-after-semantic-comparison"
            )
            changed = True
        return original(root)

    def synthetic_codesign(
        *_args: object, **_kwargs: object
    ) -> subprocess.CompletedProcess[bytes]:
        return subprocess.CompletedProcess(["synthetic-only"], 0, b"", b"")

    monkeypatch.setattr(INSPECTOR, "inventory", mutate_before_fourth_snapshot)
    monkeypatch.setattr(INSPECTOR.subprocess, "run", synthetic_codesign)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "macos_package.py",
            "--app",
            str(app),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    assert changed, "the original reviewer's fourth-snapshot mutation must occur"
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert receipt["bytes_unchanged_during_signature_inspection"] is False


def test_semantic_failure_retains_finite_failed_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    output = tmp_path / "rejected-inspection"
    (app / "Contents/Resources/runtime/dependency").write_bytes(b"tampered")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "macos_package.py",
            "--app",
            str(app),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert (output / "inspector-executed.py").is_file()


def test_matching_changed_stage_and_bundle_do_not_override_compiled_manifest(
    tmp_path: Path,
) -> None:
    app, stage, expected = fixture(tmp_path)
    for root in [stage, app / "Contents/Resources/runtime"]:
        (root / "dependency").write_bytes(b"matching-unmanifested-changes")
    with pytest.raises(ValueError, match="Declared runtime files differ"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_changed_inspector_source_cannot_receive_success_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    output = tmp_path / "changed-source-inspection"
    source_name = INSPECTOR.__file__
    assert source_name is not None
    source = Path(source_name)
    original = Path.read_bytes
    source_reads = 0

    def changed_source(path: Path) -> bytes:
        nonlocal source_reads
        raw = original(path)
        if path == source:
            source_reads += 1
            if source_reads == 2:
                return raw + b"\n# synthetic source mutation\n"
        return raw

    def synthetic_codesign(
        *_args: object, **_kwargs: object
    ) -> subprocess.CompletedProcess[bytes]:
        return subprocess.CompletedProcess(["synthetic-only"], 0, b"", b"")

    monkeypatch.setattr(Path, "read_bytes", changed_source)
    monkeypatch.setattr(INSPECTOR.subprocess, "run", synthetic_codesign)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "macos_package.py",
            "--app",
            str(app),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    assert source_reads == 2, "both source consistency observations must execute"
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert receipt["bytes_unchanged_during_signature_inspection"] is False


def test_signature_timeout_retains_partial_raw_outputs_and_failed_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    output = tmp_path / "timed-out-inspection"

    def timeout_codesign(*_args: object, **_kwargs: object) -> object:
        raise subprocess.TimeoutExpired(
            ["synthetic-only"], 20, output=b"partial-out", stderr=b"partial-err"
        )

    monkeypatch.setattr(INSPECTOR.subprocess, "run", timeout_codesign)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "macos_package.py",
            "--app",
            str(app),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert receipt["signature_inspection"]["timeout"] is True
    assert receipt["signature_inspection"]["exit_code"] is None
    assert (output / "codesign.stdout").read_bytes() == b"partial-out"
    assert (output / "codesign.stderr").read_bytes() == b"partial-err"


@pytest.mark.parametrize("metadata", [["array-root"], "scalar-root", 42])
def test_nondictionary_plist_retains_finite_failed_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, metadata: list[str] | str | int
) -> None:
    app, stage, expected = fixture(tmp_path)
    output = tmp_path / "invalid-metadata-inspection"
    (app / "Contents/Info.plist").write_bytes(plistlib.dumps(metadata))
    assert not isinstance(
        plistlib.loads((app / "Contents/Info.plist").read_bytes()), dict
    ), "the plist root must be validly parsed but not a dictionary"

    def no_signature_actor(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("Malformed metadata must fail before any signature tool")

    monkeypatch.setattr(INSPECTOR.subprocess, "run", no_signature_actor)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "macos_package.py",
            "--app",
            str(app),
            "--staged-runtime",
            str(stage),
            "--compiled-manifest-sha256",
            expected,
            "--output",
            str(output),
        ],
    )
    with pytest.raises(SystemExit) as failure:
        INSPECTOR.main()
    assert failure.value.code == 1
    receipt = json.loads((output / "inspection.json").read_text())
    assert receipt["status"] == "PACKAGE_STATIC_INSPECTION_FAILED"
    assert receipt["failure"] == "STATIC_VALIDATION_REJECTED"
    assert receipt["bytes_unchanged_during_signature_inspection"] is False
    assert (output / "inspector-executed.py").is_file()


def test_windows_manifest_path_uses_the_actual_fixture_helper() -> None:
    root = PureWindowsPath(r"C:\owned fixture")
    child = root / "japp-orchestrator" / "japp-orchestrator"
    assert manifest_path(child, root) == "japp-orchestrator/japp-orchestrator"


def test_fixture_darwin_mode_does_not_require_native_execute_bits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    monkeypatch.setattr(
        INSPECTOR,
        "main_executable_mode",
        lambda path: fixture_main_mode(path, native_execute_bits=False),
    )
    result = INSPECTOR.inspect_package(app, stage, expected)
    assert result["status"] == "STATIC_BYTES_PASS_SIGNATURE_AND_LIFECYCLE_PENDING"


def test_signature_uses_only_validated_system_default_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = str(tmp_path / "synthetic-system-tools")
    monkeypatch.setenv("PATH", str(tmp_path / "untrusted-ambient"))
    captured: list[tuple[object, dict[str, object]]] = []

    def capture(argv: object, **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        captured.append((argv, kwargs))
        return subprocess.CompletedProcess(["synthetic-only"], 0, b"", b"")

    monkeypatch.setattr(INSPECTOR.subprocess, "run", capture)
    result = INSPECTOR.signature_inspection(tmp_path / "owned.app", tmp_path)
    assert captured
    assert result["argv"][0] == str(Path(expected) / "codesign")
    assert captured[0][1]["env"] == {"PATH": expected}
    assert captured[0][1]["timeout"] == 20
    assert captured[0][1]["check"] is False
    assert result["exit_code"] == 0


@pytest.mark.parametrize(
    "invalid",
    [
        "",
        ".",
        "relative",
        "trailing-empty",
        "current",
        "dot-component",
        "parent-component",
    ],
)
def test_invalid_system_default_search_is_rejected_before_any_tool(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, invalid: str
) -> None:
    trusted = str(tmp_path / "system")
    bad = {
        "": "",
        ".": ".",
        "relative": "relative",
        "trailing-empty": trusted + os.pathsep,
        "current": str(Path.cwd()),
        "dot-component": trusted + os.sep + ".",
        "parent-component": trusted + os.sep + "..",
    }[invalid]
    monkeypatch.setattr(INSPECTOR.os, "defpath", bad)

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("Invalid search must fail before tool discovery/command")

    monkeypatch.setattr(INSPECTOR.shutil, "which", forbidden)
    monkeypatch.setattr(INSPECTOR.subprocess, "run", forbidden)
    with pytest.raises(ValueError, match="Invalid system inspector"):
        INSPECTOR.signature_inspection(tmp_path / "owned.app", tmp_path)


@pytest.mark.parametrize("resolved", [None, "relative-codesign", "outside", "current"])
def test_invalid_tool_result_never_reaches_subprocess(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, resolved: str | None
) -> None:
    selected = {
        None: None,
        "relative-codesign": "codesign",
        "outside": str(tmp_path / "foreign" / "codesign"),
        "current": str(Path.cwd() / "codesign"),
    }[resolved]
    monkeypatch.setattr(INSPECTOR.shutil, "which", lambda *_args, **_kwargs: selected)

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("Untrusted result must fail before command")

    monkeypatch.setattr(INSPECTOR.subprocess, "run", forbidden)
    with pytest.raises(ValueError, match="Invalid system inspector"):
        INSPECTOR.signature_inspection(tmp_path / "owned.app", tmp_path)


def test_default_main_metadata_interface_reads_actual_owned_file(
    tmp_path: Path,
) -> None:
    executable = tmp_path / "owned-native-metadata"
    executable.write_bytes(b"owned")
    assert _NATIVE_MAIN_MODE(executable) == executable.stat().st_mode


def test_production_main_guard_still_rejects_nonexecutable_metadata(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, stage, expected = fixture(tmp_path)
    monkeypatch.setattr(
        INSPECTOR, "main_executable_mode", lambda _path: stat.S_IFREG | 0o600
    )
    with pytest.raises(ValueError, match="Invalid main executable"):
        INSPECTOR.inspect_package(app, stage, expected)


def test_fixture_mode_rejects_unowned_and_changed_file(tmp_path: Path) -> None:
    unknown = tmp_path / "unregistered"
    unknown.write_bytes(b"unregistered")
    with pytest.raises(ValueError, match="Unowned or changed"):
        fixture_main_mode(unknown)
    app, _stage, _expected = fixture(tmp_path)
    executable = app / "Contents/MacOS/japp-desktop"
    executable.write_bytes(b"changed-owned-main")
    with pytest.raises(ValueError, match="Unowned or changed"):
        fixture_main_mode(executable)
