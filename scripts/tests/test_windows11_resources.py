"""Pure controls: no real hosted cleanup, process, install, download or VM."""

from __future__ import annotations

import copy
import importlib.util
import shutil
import stat
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "windows11"))


@pytest.fixture
def resources() -> ModuleType:
    # Keep the Linux infrastructure in its separately checked source island.
    name = "windows11_resources"
    spec = importlib.util.spec_from_file_location(
        name, Path(__file__).parents[1] / "windows11" / (name + ".py")
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def rows(name: str) -> list[dict[str, Any]]:
    return [
        {
            "path": str(path),
            "resolved": str(path),
            "mode": stat.S_IFDIR | 0o755,
            "uid": 0,
            "device": 1,
            "inode": index + 1,
        }
        for index, path in enumerate((Path(name), *Path(name).parents))
    ]


@pytest.mark.parametrize("name", ["/usr/local/lib/android", "/usr/share/dotnet"])
def test_exact_root_and_complete_real_ancestors_admitted(
    name: str, resources: ModuleType
) -> None:
    resources.validate_root(name, rows(name))


@pytest.mark.parametrize(
    "mutation",
    ["unknown", "alias", "link", "file", "uid", "writable", "missing", "extra"],
)
def test_removal_metadata_refuses_noncanonical_or_unowned_roots(
    mutation: str, resources: ModuleType
) -> None:
    name = resources.SDK_ROOTS[0]
    data = rows(name)
    if mutation == "unknown":
        name = "/opt/hostedtoolcache"
    elif mutation == "alias":
        data[0]["resolved"] = "/elsewhere"
    elif mutation == "link":
        data[0]["mode"] = stat.S_IFLNK | 0o777
    elif mutation == "file":
        data[0]["mode"] = stat.S_IFREG | 0o644
    elif mutation == "uid":
        data[-2]["uid"] = 1001
    elif mutation == "writable":
        data[-2]["mode"] |= 0o020
    elif mutation == "missing":
        data.pop()
    else:
        data.append(copy.deepcopy(data[-1]))
    with pytest.raises(ValueError, match=r".+"):
        resources.validate_root(name, data)


@pytest.mark.parametrize(
    "scenario",
    ["enough", "cleanup", "insufficient", "drift", "command", "unsettled", "host"],
)
def test_capacity_cleanup_is_guarded_fixed_argv_and_fail_closed(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    scenario: str,
    resources: ModuleType,
) -> None:
    calls: list[list[str]] = []
    retained: list[dict[str, Any]] = []
    free = iter(
        [
            resources.MIN_FREE if scenario == "enough" else 1,
            1,
            1 if scenario == "insufficient" else resources.MIN_FREE,
            1 if scenario == "insufficient" else resources.MIN_FREE,
        ]
    )
    if scenario == "enough":
        free = iter([resources.MIN_FREE, resources.MIN_FREE])
    tools = iter(
        [{"fixed": "before"}, {"fixed": "changed" if scenario == "drift" else "before"}]
    )

    def host() -> None:
        if scenario == "host":
            raise ValueError("wrong host")

    def command(argv: list[str], **_kw: object) -> bytes:
        calls.append(argv)
        if scenario == "command":
            raise ValueError("cleanup failed")
        return b""

    monkeypatch.setattr(resources, "require_linux", lambda: None)
    monkeypatch.setattr(resources, "require_host", host)
    monkeypatch.setattr(resources, "tool_baseline", lambda: next(tools))
    monkeypatch.setattr(
        shutil, "disk_usage", lambda _path: SimpleNamespace(free=next(free))
    )
    monkeypatch.setattr(resources, "root_rows", rows)
    monkeypatch.setattr(resources, "absent", lambda _name: scenario != "unsettled")
    monkeypatch.setattr(
        resources, "write", lambda _path, row: retained.append(copy.deepcopy(row))
    )
    owner: Any = SimpleNamespace(work=tmp_path, proof=tmp_path, command=command)
    if scenario in {"enough", "cleanup"}:
        result = resources.ensure_capacity(owner)
        assert result["status"] == "CAPACITY_OBSERVED"
        assert result["tools_before"] == result["tools_after"]
    else:
        with pytest.raises(ValueError, match=r".+"):
            resources.ensure_capacity(owner)
    expected_calls = (
        0 if scenario in {"enough", "host"} else 2 if scenario == "insufficient" else 1
    )
    assert len(calls) == expected_calls
    for call in calls:
        assert call[:-1] == [
            "/usr/bin/sudo",
            "-n",
            "/usr/bin/rm",
            "-rf",
            "--one-file-system",
            "--",
        ]
        assert call[-1] in resources.SDK_ROOTS
    if scenario != "host":
        assert retained
        assert retained[-1]["status"] == (
            "CAPACITY_OBSERVED" if scenario in {"enough", "cleanup"} else "FAILED"
        )
