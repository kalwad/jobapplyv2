"""Read-only committed wheel/source alignment before native package execution."""

from __future__ import annotations

import hashlib
import json
import stat
from pathlib import Path

import pytest
from native_package_pipeline import wheel_code


@pytest.mark.parametrize("role", ["contracts", "orchestrator"])
def test_committed_project_wheel_matches_current_source(role: str) -> None:
    root = Path(__file__).resolve().parents[2]
    manifest: object = json.loads(
        (root / "packaging/native-project-wheels.json").read_bytes()
    )
    assert isinstance(manifest, dict)
    row = manifest[role]
    assert isinstance(row, dict)
    if role == "contracts":
        relative = (
            "packaging/native-project-wheels/japp_contracts-0.0.1-py3-none-any.whl"
        )
        source = root / "packages/contracts/generated/python/src"
        namespace = "japp_contracts"
    else:
        relative = "packaging/native-project-wheels/orchestrator-0.0.1-py3-none-any.whl"
        source = root / "services/orchestrator/src"
        namespace = "orchestrator"
    assert row["path"] == relative
    wheel = root / relative
    assert stat.S_ISREG(wheel.lstat().st_mode)
    assert hashlib.sha256(wheel.read_bytes()).hexdigest() == row["sha256"]
    receipt = wheel_code(wheel, source, namespace)
    assert receipt["wheel_sha256"] == row["sha256"]
    assert receipt["source_package_files"] > 0
    assert receipt["all_package_file_bytes_equal"]
    assert receipt["installer_surface_restricted"]
