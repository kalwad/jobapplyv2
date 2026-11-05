"""Pure request/API/provenance oracles; no network, git, packages, GI or VM."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import signal
import sys
from collections.abc import Callable
from copy import deepcopy
from enum import IntEnum
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

SOURCE = Path(__file__).parents[1] / "windows11"
sys.path.insert(0, str(SOURCE))


@pytest.fixture
def module() -> ModuleType:
    name = "windows11_request"
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


@pytest.fixture
def harness(tmp_path: Path, module: ModuleType) -> dict[str, Any]:
    control, origin = tmp_path / "control", tmp_path / "origin"
    control.mkdir()
    origin.mkdir()
    head, parent, source, workflow = (letter * 40 for letter in "abcd")
    event = {
        "repository": {"id": module.REPOSITORY_ID, "full_name": module.REPOSITORY},
        "action": "synchronize",
        "number": module.PR_NUMBER,
        "pull_request": {
            "state": "open",
            "head": {
                "sha": head,
                "ref": module.BRANCH,
                "repo": {"id": module.REPOSITORY_ID, "full_name": module.REPOSITORY},
            },
            "base": {
                "repo": {"id": module.REPOSITORY_ID, "full_name": module.REPOSITORY}
            },
        },
    }
    artifact = {
        "run_id": "123",
        "run_attempt": "1",
        "run_head_sha": source,
        "artifact_id": "456",
        "digest_sha256": "e" * 64,
        "package_manifest_sha256": "f" * 64,
    }
    request = {
        "schema": "japp-windows11-pr-request-v1",
        "enabled": True,
        "mode": module.DOWNLOAD,
        "repository": module.REPOSITORY,
        "repository_id": module.REPOSITORY_ID,
        "pull_request": module.PR_NUMBER,
        "head_branch": module.BRANCH,
        "request_id": "a" * 32,
        "expected_source_sha": source,
        "request_parent_sha": parent,
        "package_build_sha": "1" * 40,
        "source_tree_sha": "2" * 40,
        "artifact": artifact,
    }
    request_path = control / module.REQUESTS[module.DOWNLOAD]
    request_path.parent.mkdir(parents=True)
    request_path.write_text(json.dumps(request))
    protected: dict[str, bytes] = {}
    for name in module.PROTECTED:
        data = ("synthetic protected source: " + name).encode()
        protected[name] = data
        for root in (control, origin):
            (root / name).parent.mkdir(parents=True, exist_ok=True)
            (root / name).write_bytes(data)
    run = {
        "id": 123,
        "run_attempt": 1,
        "head_sha": source,
        "head_branch": module.BRANCH,
        "status": "completed",
        "conclusion": "success",
        "path": ".github/workflows/ci.yml",
        "event": "pull_request",
        "pull_requests": [
            {
                "number": module.PR_NUMBER,
                "head": {
                    "sha": source,
                    "ref": module.BRANCH,
                    "repo": {
                        "id": module.REPOSITORY_ID,
                        "url": "https://api.github.com/repos/" + module.REPOSITORY,
                    },
                },
                "base": {
                    "ref": "main",
                    "repo": {
                        "id": module.REPOSITORY_ID,
                        "url": "https://api.github.com/repos/" + module.REPOSITORY,
                    },
                },
            }
        ],
        "repository": event["repository"],
        "head_repository": event["repository"],
        "run_started_at": "2026-10-28T10:00:00Z",
        "updated_at": "2026-10-28T10:20:00Z",
    }
    metadata = {
        "id": 456,
        "name": "native-development-windows-2025-" + request["package_build_sha"],
        "expired": False,
        "digest": "sha256:" + artifact["digest_sha256"],
        "size_in_bytes": 1024,
        "created_at": "2026-10-28T10:10:00Z",
        "workflow_run": {
            "id": 123,
            "repository_id": module.REPOSITORY_ID,
            "head_repository_id": module.REPOSITORY_ID,
            "head_sha": source,
        },
    }
    calls: list[object] = []

    def git(root: Path, *args: str) -> bytes:
        calls.append((str(root), args))
        if args == ("rev-parse", "HEAD"):
            return ((head if root == control else workflow) + "\n").encode()
        if args == ("rev-list", "--parents", "-n", "1", "HEAD"):
            return (head + " " + parent + "\n").encode()
        if args[0] == "diff":
            return (str(module.REQUESTS[module.DOWNLOAD]) + "\0").encode()
        if args[0] == "merge-base":
            assert args[-2:] == (source, parent)
            return b""
        if args[0] == "show":
            if args[1].split(":", 1)[0] == head:
                return (control / args[1].split(":", 1)[1]).read_bytes()
            return protected[args[1].split(":", 1)[1]]
        raise AssertionError((root, args))

    def fetch(path: str) -> dict[str, Any]:
        calls.append(path)
        return run if "/runs/" in path else metadata

    context = module.Context(
        control, origin, "pull_request", workflow, "d" * 40, "1", module.DOWNLOAD
    )
    return {
        "context": context,
        "event": event,
        "request": request,
        "request_path": request_path,
        "run": run,
        "metadata": metadata,
        "git": git,
        "fetch": fetch,
        "calls": calls,
        "module": module,
    }


def test_download_only_binds_source_separate_from_authorization_head(
    harness: dict[str, Any],
) -> None:
    h = harness
    result = h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])
    assert result["enabled"] == "true"
    assert result["mode"] == "DOWNLOAD_ONLY"
    assert result["source_sha"] != result["proof"]["authorization_head_sha"]
    assert result["proof"]["workflow_sha"] == h["context"].workflow_sha
    assert result["proof"]["install_vm_product_actors"] == 0
    assert result["proof"]["root_authorship_cryptographically_proven"] is False
    assert "bundle_sha256" not in result


def test_request_path_rename_cannot_hide_an_unrelated_deleted_file(
    harness: dict[str, Any],
) -> None:
    h = harness
    original: Callable[..., bytes] = h["git"]

    def git(root: Path, *args: str) -> bytes:
        if args[0] == "diff":
            # Git's rename-aware name-only output can expose only the new name.
            paths = [h["module"].REQUESTS[h["module"].DOWNLOAD]]
            if "--no-renames" in args:
                paths.append("an-unrelated-deleted-file.json")
            return ("\0".join(paths) + "\0").encode()
        return original(root, *args)

    with pytest.raises(ValueError, match="change only exact request"):
        h["module"].decode(h["context"], h["event"], git, h["fetch"])
    assert not any(isinstance(call, str) for call in h["calls"])


@pytest.mark.parametrize("state", ["absent", "disabled", "stale"])
def test_no_current_optin_means_no_artifact_api(
    harness: dict[str, Any], state: str
) -> None:
    h = harness
    git = h["git"]
    if state == "absent":
        h["request_path"].unlink()
    elif state == "disabled":
        h["request_path"].write_text(
            json.dumps(
                {
                    "schema": "japp-windows11-pr-request-v1",
                    "mode": h["module"].DOWNLOAD,
                    "enabled": False,
                }
            )
        )
    else:
        original: Callable[..., bytes] = git

        def git(root: Path, *args: str) -> bytes:
            if args[0] == "rev-list":
                return ("a" * 40 + " " + "f" * 40).encode()
            return original(root, *args)

    def no_fetch(_path: str) -> dict[str, Any]:
        raise AssertionError("Disabled request must not query/download artifacts")

    result = h["module"].decode(h["context"], h["event"], git, no_fetch)
    assert result["enabled"] == "false"
    assert result["status"].startswith("SKIP_")


@pytest.mark.parametrize(
    "case", ["fork", "base", "branch", "event", "pr", "repository", "rerun"]
)
def test_foreign_or_replayed_trigger_is_refused(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    event = deepcopy(h["event"])
    context = h["context"]
    if case == "fork":
        event["pull_request"]["head"]["repo"]["id"] += 1
    elif case == "base":
        event["pull_request"]["base"]["repo"]["full_name"] = "other/repository"
    elif case == "branch":
        event["pull_request"]["head"]["ref"] = "other"
    elif case == "event":
        event["action"] = "reopened"
    elif case == "pr":
        event["number"] += 1
    elif case == "repository":
        event["repository"]["id"] += 1
    else:
        context = h["module"].Context(
            context.control,
            context.workflow_source,
            context.event_name,
            context.workflow_sha,
            context.event_sha,
            "2",
            context.mode,
        )
    with pytest.raises(ValueError, match=r"Exact|Only|Automatic"):
        h["module"].decode(context, event, h["git"], h["fetch"])


@pytest.mark.parametrize(
    "case",
    ["unknown", "vm_field", "boolean_id", "bad_sha", "newline", "source", "duplicate"],
)
def test_closed_root_request_refuses_ambiguous_authority(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    request = deepcopy(h["request"])
    if case == "unknown":
        request["other"] = True
    elif case == "vm_field":
        request["bundle_sha256"] = "a" * 64
    elif case == "boolean_id":
        request["repository_id"] = True
    elif case == "bad_sha":
        request["expected_source_sha"] = "main"
    elif case == "newline":
        request["artifact"]["run_id"] = "123\nenabled=true"
    elif case == "source":
        request["artifact"]["run_head_sha"] = "f" * 40
    raw = json.dumps(request)
    if case == "duplicate":
        raw = raw[:-1] + ', "enabled": true}'
    h["request_path"].write_text(raw)
    with pytest.raises(
        ValueError, match=r"Closed|Exact|Explicit|Duplicate|Original|Artifact creation"
    ):
        h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])


@pytest.mark.parametrize(
    "case", ["extra_diff", "workflow", "decoder", "process", "origin", "ancestry"]
)
def test_control_workflow_and_source_projection_are_bound(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    original: Callable[..., bytes] = h["git"]

    def git(root: Path, *args: str) -> bytes:
        if case == "extra_diff" and args[0] == "diff":
            return original(root, *args) + b"scripts/production.py\0"
        if (
            case == "origin"
            and root == h["context"].workflow_source
            and args[0] == "rev-parse"
        ):
            return b"wrong"
        if case == "ancestry" and args[0] == "merge-base":
            raise ValueError("Source is not an ancestor")
        return original(root, *args)

    names = {
        "workflow": ".github/workflows/windows11-native-prepare.yml",
        "decoder": "scripts/windows11/windows11_request.py",
        "process": "scripts/windows11/windows11_process.py",
    }
    if case in names:
        (h["context"].control / names[case]).write_bytes(b"changed")
    with pytest.raises(
        ValueError,
        match=r"Root authorization|Actual executing|Reviewed decoder|Source is",
    ):
        h["module"].decode(h["context"], h["event"], git, h["fetch"])


@pytest.mark.parametrize(
    "case",
    [
        "run_head",
        "attempt",
        "event",
        "workflow",
        "repository",
        "unfinished",
        "artifact",
        "expired",
        "digest",
        "owner",
        "time",
        "size",
        "artifact_name",
    ],
)
def test_api_run_artifact_attempt_and_digest_must_join(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    run, artifact = h["run"], h["metadata"]
    if case == "run_head":
        run["head_sha"] = "f" * 40
    elif case == "attempt":
        run["run_attempt"] = 2
    elif case == "event":
        run["event"] = "push"
    elif case == "workflow":
        run["path"] = ".github/workflows/other.yml"
    elif case == "repository":
        run["head_repository"] = {"id": 1, "full_name": "other/repository"}
    elif case == "unfinished":
        run["status"] = "in_progress"
    else:
        mutate_artifact_fixture(artifact, h["module"], case)
    with pytest.raises(
        ValueError, match=r"Closed|Exact|Explicit|Duplicate|Original|Artifact creation"
    ):
        h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])


@pytest.mark.parametrize(
    "case", ["multiple", "number", "head", "branch", "base", "head_repo", "base_repo"]
)
def test_original_ci_export_requires_exact_pr_subject(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    prs = h["run"]["pull_requests"]
    if case == "multiple":
        prs.append(deepcopy(prs[0]))
    elif case == "number":
        prs[0]["number"] = 2
    elif case == "head":
        prs[0]["head"]["sha"] = "f" * 40
    elif case == "branch":
        prs[0]["head"]["ref"] = "other"
    elif case == "base":
        prs[0]["base"]["ref"] = "other"
    else:
        side = "head" if case == "head_repo" else "base"
        prs[0][side]["repo"]["id"] = 1
    with pytest.raises(ValueError, match="exact same-repository PR"):
        h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])


def test_dispatch_requires_exact_committed_pins(harness: dict[str, Any]) -> None:
    h = harness
    request = h["request"]
    artifact = request["artifact"]
    event = {
        "inputs": {
            "expected-head": request["expected_source_sha"],
            "package-run-id": artifact["run_id"],
            "package-run-attempt": artifact["run_attempt"],
            "package-artifact-id": artifact["artifact_id"],
            "package-artifact-digest-sha256": artifact["digest_sha256"],
            "package-manifest-sha256": artifact["package_manifest_sha256"],
        }
    }
    h["module"].dispatch_inputs(event, request)
    event["inputs"]["package-run-id"] = "999"
    with pytest.raises(ValueError, match="exactly match"):
        h["module"].dispatch_inputs(event, request)


def test_vm_requires_actual_exact_release_receipt(harness: dict[str, Any]) -> None:
    h = harness
    request = deepcopy(h["request"])
    request["mode"] = h["module"].VM
    for key in h["module"].VM_HASHES | {"release_receipt_sha256"}:
        request[key] = "a" * 64
    with pytest.raises(ValueError, match="No reviewed VM release"):
        h["module"].release_receipt(h["context"], request)
    receipt = {
        key: request[key]
        for key in {
            "request_id",
            "request_parent_sha",
            "expected_source_sha",
            "package_build_sha",
            "source_tree_sha",
            "artifact",
            *h["module"].VM_HASHES,
        }
    }
    receipt.update(
        schema="japp-windows11-vm-release-v1",
        decision="RELEASE_ONE_BOUND_CAMPAIGN",
        review_evidence_sha256="b" * 64,
    )
    path = h["context"].control / h["module"].RELEASE
    path.parent.mkdir(parents=True)
    raw = json.dumps(receipt).encode()
    path.write_bytes(raw)
    request["release_receipt_sha256"] = hashlib.sha256(raw).hexdigest()
    assert h["module"].release_receipt(h["context"], request) == receipt
    receipt["expected_source_sha"] = "f" * 40
    raw = json.dumps(receipt).encode()
    path.write_bytes(raw)
    request["release_receipt_sha256"] = hashlib.sha256(raw).hexdigest()
    with pytest.raises(ValueError, match="subject differs"):
        h["module"].release_receipt(h["context"], request)


def mutate_artifact_fixture(
    artifact: dict[str, Any], module: ModuleType, case: str
) -> None:
    if case == "artifact":
        artifact["id"] += 1
    elif case == "expired":
        artifact["expired"] = True
    elif case == "digest":
        artifact["digest"] = "sha256:" + "0" * 64
    elif case == "owner":
        artifact["workflow_run"]["head_repository_id"] += 1
    elif case == "time":
        artifact["created_at"] = "2026-10-27T10:00:00Z"
    elif case == "size":
        artifact["size_in_bytes"] = module.ARTIFACT_CAP + 1
    elif case == "artifact_name":
        artifact["name"] = "latest"
    else:
        raise AssertionError(case)


def test_uncommitted_request_cannot_authorize_package_work(
    harness: dict[str, Any],
) -> None:
    h = harness
    committed: bytes = h["request_path"].read_bytes()
    request = h["request"]
    request["artifact"]["artifact_id"] = "999"
    h["request_path"].write_text(json.dumps(request))
    original: Callable[..., bytes] = h["git"]

    def git(root: Path, *args: str) -> bytes:
        if args[0] == "show" and args[1].endswith(
            h["module"].REQUESTS[h["module"].DOWNLOAD]
        ):
            return committed
        return original(root, *args)

    with pytest.raises(ValueError, match="committed authorization blob"):
        h["module"].decode(h["context"], h["event"], git, h["fetch"])


def test_metadata_output_fence_precedes_any_publication(
    tmp_path: Path, module: ModuleType
) -> None:
    output = tmp_path / "github-output"
    with pytest.raises(ValueError, match="Single-line"):
        module.emit_outputs(
            {"enabled": "true", "source_sha": "bad\nother=true"}, output
        )
    assert not output.exists()


def test_git_postspawn_observer_failure_reaps_exact_child(
    tmp_path: Path,
    module: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class GuestSignal(IntEnum):
        SIGKILL = 9

    if not hasattr(signal, "SIGKILL"):
        monkeypatch.setattr(signal, "SIGKILL", GuestSignal.SIGKILL, raising=False)

    class Child:
        pid = 1234567
        returncode: int | None = None

        def __init__(self) -> None:
            self.signals: list[object] = []

        def send_signal(self, value: object) -> None:
            self.signals.append(value)

        def wait(self, *, timeout: float) -> int:
            assert timeout == 2
            self.returncode = -15
            return -15

    child = Child()
    monkeypatch.setattr(module.subprocess, "Popen", lambda *_args, **_kwargs: child)

    def broken_group(_pid: int) -> int:
        raise RuntimeError("controlled metadata observer failure")

    monkeypatch.setattr(module.os, "getpgid", broken_group, raising=False)
    reader = module.GitReader(tmp_path)
    with pytest.raises(RuntimeError, match="controlled metadata observer"):
        reader(tmp_path, "rev-parse", "HEAD")
    assert child.returncode == -15
    assert reader.pending == []
    receipt = json.loads((tmp_path / "git-001.json").read_text())
    assert receipt["primary_error"] == "RuntimeError"
    assert receipt["direct_child_reaped"] is True
    assert receipt["retained_unreaped_custody"] is False
    assert len(child.signals) == 1


def vm_harness(h: dict[str, Any]) -> dict[str, Any]:
    module = h["module"]
    request = deepcopy(h["request"])
    request["mode"] = module.VM
    request["artifact"]["run_head_sha"] = "e" * 40
    for key in module.VM_HASHES:
        request[key] = "a" * 64
    receipt = {
        key: request[key]
        for key in {
            "request_id",
            "request_parent_sha",
            "expected_source_sha",
            "package_build_sha",
            "source_tree_sha",
            "artifact",
            *module.VM_HASHES,
        }
    }
    receipt.update(
        schema="japp-windows11-vm-release-v1",
        decision="RELEASE_ONE_BOUND_CAMPAIGN",
        review_evidence_sha256="b" * 64,
    )
    context = h["context"]
    h["context"] = module.Context(
        context.control,
        context.workflow_source,
        context.event_name,
        context.workflow_sha,
        context.event_sha,
        context.run_attempt,
        module.VM,
    )
    path = context.control / module.RELEASE
    path.parent.mkdir(parents=True)
    raw = json.dumps(receipt).encode()
    path.write_bytes(raw)
    request["release_receipt_sha256"] = hashlib.sha256(raw).hexdigest()
    h["request_path"] = context.control / module.REQUESTS[module.VM]
    h["request_path"].write_text(json.dumps(request))
    h["request"] = request
    h["release_path"] = path
    h["release"] = receipt
    h["run"].update(
        head_sha="e" * 40, event="pull_request", path=module.WORKFLOWS[module.DOWNLOAD]
    )
    h["metadata"]["workflow_run"]["head_sha"] = "e" * 40
    h["metadata"]["name"] = (
        "unreviewed-windows11-inputs-" + request["expected_source_sha"] + "-123"
    )
    original: Callable[..., bytes] = h["git"]

    def git(root: Path, *args: str) -> bytes:
        if args[0] == "diff":
            return (
                str(module.REQUESTS[module.VM]) + "\0" + str(module.RELEASE) + "\0"
            ).encode()
        return original(root, *args)

    h["git"] = git
    return h


def test_complete_vm_gate_binds_candidate_and_exact_release_without_starting_vm(
    harness: dict[str, Any],
) -> None:
    h = vm_harness(harness)
    result = h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])
    assert result["enabled"] == "true"
    assert result["mode"] == h["module"].VM
    assert result["proof"]["release_receipt_present"] is True
    assert result["proof"]["install_vm_product_actors"] == 0
    assert all(result[key] == h["request"][key] for key in h["module"].VM_HASHES)


@pytest.mark.parametrize(
    "case", ["missing", "digest", "decision", "subject", "extra", "uncommitted"]
)
def test_vm_gate_refuses_unreviewed_or_different_release(
    harness: dict[str, Any], case: str
) -> None:
    h = vm_harness(harness)
    git = h["git"]
    if case == "missing":
        h["release_path"].unlink()
    elif case == "digest":
        h["release_path"].write_bytes(b"changed")
    elif case == "uncommitted":
        original: Callable[..., bytes] = git

        def git(root: Path, *args: str) -> bytes:
            if args[0] == "show" and args[1].endswith(h["module"].RELEASE):
                return b"different committed receipt"
            return original(root, *args)

    else:
        receipt = h["release"]
        if case == "decision":
            receipt["decision"] = "DOWNLOAD_ONLY"
        elif case == "subject":
            receipt["bundle_sha256"] = "c" * 64
        else:
            receipt["install_anything"] = True
        raw = json.dumps(receipt).encode()
        h["release_path"].write_bytes(raw)
        h["request"]["release_receipt_sha256"] = hashlib.sha256(raw).hexdigest()
        h["request_path"].write_text(json.dumps(h["request"]))
    with pytest.raises(
        ValueError,
        match=(
            r"No reviewed|digest differs|release decision|subject differs"
            r"|Closed object|committed authorization"
        ),
    ):
        h["module"].decode(h["context"], h["event"], git, h["fetch"])


@pytest.mark.parametrize(
    "path",
    [
        "https://other.example/actions/runs/1",
        "/repos/other/repo/actions/runs/1/attempts/1",
        "/repos/kalwad/jobapplyv2/actions/../../other",
        "/repos/kalwad/jobapplyv2/actions/artifacts/1?latest=true",
    ],
)
def test_metadata_endpoint_rejected_before_token_or_open(
    module: ModuleType, path: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GH_TOKEN", raising=False)
    with pytest.raises(ValueError, match="Fixed same-repository"):
        module.fetch_api(path)
