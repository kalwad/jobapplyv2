"""Reviewed VM campaigns must read their bundle where the prepare upload put it.

upload-artifact roots a multi-path upload at the paths' least common ancestor,
so members keep that ancestor's relative layout (KI-0146: the Windows 11
artifact holds retained/inputs, not inputs, at its root).
"""

from __future__ import annotations

import posixpath
import re
from pathlib import Path
from typing import Any

import pytest
import yaml

WORKFLOWS = Path(__file__).parents[2] / ".github" / "workflows"
TEMP = "${{ runner.temp }}/"
CASES = {
    "windows11": (
        "windows11-native-prepare.yml",
        "unreviewed-windows11-inputs-",
        "japp-unreviewed-win11-candidate/retained/inputs",
        "windows11-native-lifecycle.yml",
        "scripts/windows11/windows11_vm.py",
    ),
    "gnome": (
        "ubuntu-gnome-prepare.yml",
        "unreviewed-gnome-inputs-",
        "japp-unreviewed-gnome-candidate/inputs",
        "ubuntu-gnome-lifecycle.yml",
        "scripts/linux_gnome/ubuntu_gnome_host.py",
    ),
}


def steps(name: str) -> list[dict[str, Any]]:
    document = yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))
    return [step for job in document["jobs"].values() for step in job["steps"]]


def upload_paths(name: str, artifact_prefix: str) -> list[str]:
    matches = [
        step["with"]
        for step in steps(name)
        if str(step.get("uses", "")).startswith("actions/upload-artifact@")
        and str(step["with"]["name"]).startswith(artifact_prefix)
    ]
    assert len(matches) == 1
    paths = [line.strip() for line in matches[0]["path"].splitlines() if line.strip()]
    assert paths
    assert all(path.startswith(TEMP) for path in paths)
    return [path.removeprefix(TEMP).rstrip("/") for path in paths]


def download_root(name: str) -> str:
    matches = [
        step["with"]["path"]
        for step in steps(name)
        if str(step.get("uses", "")).startswith("actions/download-artifact@")
    ]
    assert len(matches) == 1
    assert matches[0].startswith(TEMP)
    return str(matches[0]).removeprefix(TEMP).rstrip("/")


def bundle_argument(name: str, consumer: str) -> str:
    runs = [str(step.get("run", "")) for step in steps(name)]
    commands = [run for run in runs if consumer in run]
    assert len(commands) == 1
    found: list[str] = re.findall(r'--bundle "\$RUNNER_TEMP/([^"]+)"', commands[0])
    assert len(found) == 1
    return found[0]


@pytest.mark.parametrize("platform", sorted(CASES))
def test_campaign_bundle_path_matches_prepared_artifact_layout(platform: str) -> None:
    prepare, prefix, produced_bundle, lifecycle, consumer = CASES[platform]
    paths = upload_paths(prepare, prefix)
    root = posixpath.commonpath(paths)
    assert produced_bundle.startswith(root + "/")
    member = produced_bundle.removeprefix(root + "/")
    expected = download_root(lifecycle) + "/" + member
    assert bundle_argument(lifecycle, consumer) == expected


def test_windows11_multi_path_upload_keeps_the_retained_prefix() -> None:
    paths = upload_paths("windows11-native-prepare.yml", "unreviewed-windows11-inputs-")
    assert len(paths) == 2
    assert posixpath.commonpath(paths) == "japp-unreviewed-win11-candidate"
    assert bundle_argument(
        "windows11-native-lifecycle.yml", "scripts/windows11/windows11_vm.py"
    ).endswith("/retained/inputs")
