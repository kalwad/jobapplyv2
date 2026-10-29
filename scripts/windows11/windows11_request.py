"""Decode one explicit root request; metadata access never installs or starts a VM.

Same-repository routing is an opt-in under the trusted root/repository process,
not cryptographic proof of authorship. PR workflow and source commit identities
are bound separately. Imports do not start processes or access the network.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from http.client import HTTPMessage
from pathlib import Path
from typing import IO, Any

from windows11_platform import require_linux
from windows11_process import ChildCustody

REPOSITORY = "kalwad/jobapplyv2"
REPOSITORY_ID = 1312360079
BRANCH = "codex/autofill-evaluation-hardening"
PR_NUMBER = 1
DOWNLOAD = "DOWNLOAD_ONLY"
VM = "ONE_REVIEWED_VM"
MODES = {"download-only": DOWNLOAD, "vm": VM}
REQUESTS = {
    DOWNLOAD: ".github/windows11/requests/download-only.json",
    VM: ".github/windows11/requests/vm-campaign.json",
}
RELEASE = ".github/windows11/releases/vm-campaign.json"
WORKFLOWS = {
    DOWNLOAD: ".github/workflows/windows11-native-prepare.yml",
    VM: ".github/workflows/windows11-native-lifecycle.yml",
}
PROTECTED = (
    *WORKFLOWS.values(),
    "scripts/windows11/windows11_request.py",
    "scripts/windows11/windows11_process.py",
    "scripts/windows11/windows11_platform.py",
    "scripts/windows11/windows11_inputs.py",
    "scripts/windows11/windows11_resources.py",
    "scripts/windows11/windows11_candidate.py",
    "scripts/windows11/windows11_vm.py",
    "scripts/windows11/windows11_deployment.py",
    "scripts/windows11/windows11_guest.ps1",
    "scripts/windows11/windows11_bootstrap.ps1",
    "scripts/windows11/windows11_source_check.ps1",
    "scripts/windows11/windows11_owned.cs",
    "scripts/linux_gnome/ubuntu_gnome_prepare.py",
    "scripts/linux_gnome/ubuntu_gnome_host.py",
    "scripts/linux_gnome/ubuntu_gnome_signed_indexes.py",
    "scripts/linux_gnome/ubuntu_gnome_vm.py",
    "scripts/linux_gnome/ubuntu_gnome_process.py",
    "scripts/linux_gnome/ubuntu_gnome_platform.py",
    "scripts/linux_gnome/ubuntu_gnome_retention.py",
    "scripts/windows_package.py",
)

DOCUMENT_CAP = 2 * 1024 * 1024
REQUEST_CAP = 65536
ARTIFACT_CAP = 2 * 1024**3
COMMON = {
    "schema",
    "enabled",
    "mode",
    "repository",
    "repository_id",
    "pull_request",
    "head_branch",
    "request_id",
    "expected_source_sha",
    "request_parent_sha",
    "package_build_sha",
    "source_tree_sha",
    "artifact",
}
ARTIFACT_FIELDS = {
    "run_id",
    "run_attempt",
    "run_head_sha",
    "artifact_id",
    "digest_sha256",
    "package_manifest_sha256",
}
VM_HASHES = {
    "bundle_sha256",
    "media_lock_sha256",
    "host_tools_sha256",
    "guest_driver_sha256",
}
FETCH = Callable[[str], dict[str, Any]]
READ_GIT = Callable[..., bytes]


def exact_object(value: object, keys: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ValueError("Closed object schema required")
    return value


def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def bounded(path: Path, cap: int = DOCUMENT_CAP) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > cap:
        raise ValueError("Bounded regular metadata file required")
    data = path.read_bytes()
    after = path.lstat()
    if (before.st_ino, before.st_dev, before.st_size, before.st_mtime_ns) != (
        after.st_ino,
        after.st_dev,
        after.st_size,
        after.st_mtime_ns,
    ) or len(data) != before.st_size:
        raise ValueError("Metadata file changed while reading")
    return data


def document(path: Path, cap: int = DOCUMENT_CAP) -> dict[str, Any]:
    value = json.loads(bounded(path, cap), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValueError("Object metadata required")
    return value


def hexadecimal(value: object, length: int = 64) -> str:
    if (
        not isinstance(value, str)
        or re.fullmatch(r"[a-f0-9]{" + str(length) + "}", value) is None
    ):
        raise ValueError("Exact lowercase hexadecimal pin required")
    return value


def identifier(value: object) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[1-9][0-9]{0,19}", value) is None:
        raise ValueError("Exact positive decimal identifier required")
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        _req: urllib.request.Request,
        _fp: IO[bytes],
        _code: int,
        _msg: str,
        _headers: HTTPMessage,
        _newurl: str,
    ) -> None:
        raise ValueError("GitHub metadata redirects are not authorized")


def fetch_api(path: str) -> dict[str, Any]:
    prefix = "/repos/" + REPOSITORY + "/actions/"
    endpoint = (
        r"(?:runs/[1-9][0-9]{0,19}/attempts/[1-9][0-9]{0,19}"
        r"|artifacts/[1-9][0-9]{0,19})"
    )
    if (
        not path.startswith(prefix)
        or re.fullmatch(endpoint, path.removeprefix(prefix)) is None
    ):
        raise ValueError("Fixed same-repository metadata endpoint required")
    token = os.environ.get("GH_TOKEN")
    if not token:
        raise ValueError("Ephemeral Actions-read token required")
    request = urllib.request.Request(
        "https://api.github.com" + path,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2026-03-10",
        },
    )
    with urllib.request.build_opener(NoRedirect()).open(
        request, timeout=10
    ) as response:
        if response.geturl() != request.full_url:
            raise ValueError("GitHub metadata origin changed")
        raw = response.read(DOCUMENT_CAP + 1)
    if len(raw) > DOCUMENT_CAP:
        raise ValueError("GitHub metadata exceeds cap")
    value = json.loads(raw, object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValueError("Object GitHub metadata required")
    return value


@dataclass
class GitReader:
    proof: Path
    sequence: int = 0
    pending: list[ChildCustody] = field(default_factory=list)

    def __call__(self, root: Path, *args: str) -> bytes:
        self.sequence += 1
        stem = self.proof / ("git-" + str(self.sequence).zfill(3))
        argv = [
            "/usr/bin/git",
            "--no-pager",
            "--no-optional-locks",
            "-c",
            "core.fsmonitor=false",
            "-C",
            str(root),
            *args,
        ]
        primary: BaseException | None = None
        cleanup: BaseException | None = None
        with (
            stem.with_suffix(".stdout").open("xb") as stdout,
            stem.with_suffix(".stderr").open("xb") as stderr,
        ):
            child = subprocess.Popen(  # noqa: S603 - fixed local read-only git builtins
                argv,
                stdout=stdout,
                stderr=stderr,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
                env={
                    "PATH": "/usr/bin:/bin",
                    "LC_ALL": "C.UTF-8",
                    "GIT_CONFIG_NOSYSTEM": "1",
                    "GIT_CONFIG_GLOBAL": "/dev/null",
                },
            )
            custody = ChildCustody(child, child.pid)
            self.pending.append(custody)
            try:
                if os.getpgid(child.pid) != child.pid:
                    raise ValueError("Fresh metadata command group required")
                custody.group_verified = True
                deadline = time.monotonic() + 5
                while child.poll() is None:
                    if (
                        time.monotonic() >= deadline
                        or stdout.tell() + stderr.tell() > DOCUMENT_CAP
                    ):
                        raise TimeoutError("Metadata command bound exceeded")
                    time.sleep(0.01)
            except BaseException as error:
                primary = error
            finally:
                try:
                    custody.terminate_unreaped()
                except BaseException as error:
                    cleanup = error
                if custody.is_reaped():
                    self.pending.remove(custody)
        raw = stem.with_suffix(".stdout").read_bytes()
        size = len(raw) + stem.with_suffix(".stderr").stat().st_size
        receipt = {
            "argv": argv,
            "exit_code": child.returncode,
            "direct_child_reaped": custody.is_reaped(),
            "signals": custody.signals,
            "primary_error": type(primary).__name__ if primary else None,
            "cleanup_error": type(cleanup).__name__ if cleanup else None,
            "raw_bytes": size,
            "retained_unreaped_custody": custody in self.pending,
        }
        stem.with_suffix(".json").write_text(json.dumps(receipt, indent=2) + "\n")
        if primary is not None:
            raise primary
        if cleanup is not None:
            raise cleanup
        if child.returncode != 0 or size > DOCUMENT_CAP:
            raise ValueError("Read-only metadata command failed")
        return raw

    def close(self) -> list[dict[str, object]]:
        rows: list[dict[str, object]] = []
        for custody in list(self.pending):
            error_type = None
            try:
                custody.terminate_unreaped()
            except BaseException as error:
                error_type = type(error).__name__
            if custody.is_reaped():
                self.pending.remove(custody)
            rows.append(
                {
                    "pid": custody.child.pid,
                    "reaped": custody.is_reaped(),
                    "signals": custody.signals,
                    "error_type": error_type,
                }
            )
        return rows


@dataclass(frozen=True)
class Context:
    control: Path
    workflow_source: Path
    event_name: str
    workflow_sha: str
    event_sha: str
    run_attempt: str
    mode: str


def identity(event: dict[str, Any], context: Context) -> str:
    if context.run_attempt != "1":
        raise ValueError("Automatic or manual rerun requires a new root request")
    repository = event["repository"]
    if repository["id"] != REPOSITORY_ID or repository["full_name"] != REPOSITORY:
        raise ValueError("Exact repository identity required")
    if context.event_name == "pull_request":
        pr = event["pull_request"]
        if (
            event["action"] != "synchronize"
            or event["number"] != PR_NUMBER
            or pr["state"] != "open"
            or pr["head"]["ref"] != BRANCH
            or any(
                pr[side]["repo"]["id"] != REPOSITORY_ID
                or pr[side]["repo"]["full_name"] != REPOSITORY
                for side in ("head", "base")
            )
        ):
            raise ValueError("Only the exact same-repository PR update is allowed")
        return hexadecimal(pr["head"]["sha"], 40)
    if context.event_name != "workflow_dispatch":
        raise ValueError("Unsupported trigger")
    return hexadecimal(context.event_sha, 40)


def parse_request(value: dict[str, Any], mode: str) -> dict[str, Any] | None:
    if value.get("enabled") is False:
        exact_object(value, {"schema", "enabled", "mode"})
        if value["schema"] != "japp-windows11-pr-request-v1" or value["mode"] != mode:
            raise ValueError("Disabled request schema differs")
        return None
    fields = COMMON | ({"release_receipt_sha256"} | VM_HASHES if mode == VM else set())
    exact_object(value, fields)
    if (
        value["schema"] != "japp-windows11-pr-request-v1"
        or value["enabled"] is not True
        or value["mode"] != mode
        or value["repository"] != REPOSITORY
        or type(value["repository_id"]) is not int
        or value["repository_id"] != REPOSITORY_ID
        or type(value["pull_request"]) is not int
        or value["pull_request"] != PR_NUMBER
        or value["head_branch"] != BRANCH
    ):
        raise ValueError("Explicit root request identity differs")
    hexadecimal(value["request_id"], 32)
    for key in (
        "expected_source_sha",
        "request_parent_sha",
        "package_build_sha",
        "source_tree_sha",
    ):
        hexadecimal(value[key], 40)
    artifact = exact_object(value["artifact"], ARTIFACT_FIELDS)
    for key in ("run_id", "run_attempt", "artifact_id"):
        identifier(artifact[key])
    hexadecimal(artifact["run_head_sha"], 40)
    for key in ("digest_sha256", "package_manifest_sha256"):
        hexadecimal(artifact[key])
    if mode == DOWNLOAD and artifact["run_head_sha"] != value["expected_source_sha"]:
        raise ValueError("Original package run must bind the exact source commit")
    if mode == VM:
        for key in VM_HASHES | {"release_receipt_sha256"}:
            hexadecimal(value[key])
    return value


def dispatch_inputs(event: dict[str, Any], request: dict[str, Any]) -> None:
    artifact = request["artifact"]
    expected = {
        "expected-head": request["expected_source_sha"],
        "package-manifest-sha256": artifact["package_manifest_sha256"],
    }
    if request["mode"] == DOWNLOAD:
        expected.update(
            {
                "package-run-id": artifact["run_id"],
                "package-run-attempt": artifact["run_attempt"],
                "package-artifact-id": artifact["artifact_id"],
                "package-artifact-digest-sha256": artifact["digest_sha256"],
            }
        )
    else:
        expected.update(
            {
                "inputs-run-id": artifact["run_id"],
                "inputs-run-attempt": artifact["run_attempt"],
                "inputs-artifact-id": artifact["artifact_id"],
                "inputs-artifact-digest-sha256": artifact["digest_sha256"],
                "bundle-manifest-sha256": request["bundle_sha256"],
                "media-lock-sha256": request["media_lock_sha256"],
                "host-tools-lock-sha256": request["host_tools_sha256"],
                "guest-driver-sha256": request["guest_driver_sha256"],
            }
        )
    if event.get("inputs") != expected:
        raise ValueError("Dispatch inputs must exactly match committed root request")


def protected_sources(context: Context, source: str, git: READ_GIT) -> dict[str, str]:
    if (
        git(context.workflow_source, "rev-parse", "HEAD").decode().strip()
        != context.workflow_sha
    ):
        raise ValueError("Actual executing workflow commit differs")
    pins = {}
    for path in PROTECTED:
        expected = git(context.control, "show", source + ":" + path)
        if (
            bounded(context.control / path) != expected
            or bounded(context.workflow_source / path) != expected
        ):
            raise ValueError("Reviewed decoder/workflow source changed")
        pins[path] = hashlib.sha256(expected).hexdigest()
    return pins


def release_receipt(context: Context, request: dict[str, Any]) -> dict[str, Any]:
    path = context.control / RELEASE
    if not path.exists():
        raise ValueError("No reviewed VM release receipt; VM remains disabled")
    raw = bounded(path, REQUEST_CAP)
    if hashlib.sha256(raw).hexdigest() != request["release_receipt_sha256"]:
        raise ValueError("Reviewed release receipt digest differs")
    value = exact_object(
        json.loads(raw, object_pairs_hook=pairs),
        {
            "schema",
            "decision",
            "request_id",
            "request_parent_sha",
            "expected_source_sha",
            "package_build_sha",
            "source_tree_sha",
            "artifact",
            "review_evidence_sha256",
            *VM_HASHES,
        },
    )
    if (
        value["schema"] != "japp-windows11-vm-release-v1"
        or value["decision"] != "RELEASE_ONE_BOUND_CAMPAIGN"
    ):
        raise ValueError("Explicit reviewed VM release decision required")
    hexadecimal(value["review_evidence_sha256"])
    for key in {
        "request_id",
        "request_parent_sha",
        "expected_source_sha",
        "package_build_sha",
        "source_tree_sha",
        "artifact",
        *VM_HASHES,
    }:
        if value[key] != request[key]:
            raise ValueError("VM release subject differs from request")
    return value


def artifact_metadata(
    request: dict[str, Any], fetch: FETCH, *, authorization_head: str | None = None
) -> dict[str, Any]:
    # Only decode supplies a head after all current authorization checks pass.
    # Standalone metadata callers retain the original source-only requirement.
    allowed_pr_heads = {request["expected_source_sha"]}
    if authorization_head is not None:
        allowed_pr_heads.add(hexadecimal(authorization_head, 40))
    pin = request["artifact"]
    prefix = "/repos/" + REPOSITORY + "/actions/"
    run = fetch(prefix + "runs/" + pin["run_id"] + "/attempts/" + pin["run_attempt"])
    artifact = fetch(prefix + "artifacts/" + pin["artifact_id"])
    workflow = (
        ".github/workflows/ci.yml"
        if request["mode"] == DOWNLOAD
        else WORKFLOWS[DOWNLOAD]
    )
    expected_name = (
        "native-development-windows-2025-" + request["package_build_sha"]
        if request["mode"] == DOWNLOAD
        else "unreviewed-windows11-inputs-"
        + request["expected_source_sha"]
        + "-"
        + pin["run_id"]
    )
    if (
        run["id"] != int(pin["run_id"])
        or run["run_attempt"] != int(pin["run_attempt"])
        or run["head_sha"] != pin["run_head_sha"]
        or run["head_branch"] != BRANCH
        or run["status"] != "completed"
        or run["conclusion"] != "success"
        or run["path"] != workflow
        or any(
            run[key]["id"] != REPOSITORY_ID or run[key]["full_name"] != REPOSITORY
            for key in ("repository", "head_repository")
        )
        or (request["mode"] == DOWNLOAD and run["event"] != "pull_request")
        or (
            request["mode"] == VM
            and run["event"] not in {"pull_request", "workflow_dispatch"}
        )
    ):
        raise ValueError("Exact original workflow run/attempt/source join failed")
    if request["mode"] == DOWNLOAD:
        prs = run["pull_requests"]
        if (
            not isinstance(prs, list)
            or len(prs) != 1
            or prs[0]["number"] != PR_NUMBER
            or prs[0]["head"]["sha"] not in allowed_pr_heads
            or prs[0]["head"]["ref"] != BRANCH
            or prs[0]["base"]["ref"] != "main"
            or any(
                prs[0][side]["repo"]["id"] != REPOSITORY_ID
                or prs[0][side]["repo"]["url"]
                != "https://api.github.com/repos/" + REPOSITORY
                for side in ("head", "base")
            )
        ):
            raise ValueError("Original package must bind exact same-repository PR")
    owner = artifact["workflow_run"]
    if (
        artifact["id"] != int(pin["artifact_id"])
        or artifact["name"] != expected_name
        or artifact["expired"] is not False
        or artifact["digest"] != "sha256:" + pin["digest_sha256"]
        or type(artifact["size_in_bytes"]) is not int
        or not 0 < artifact["size_in_bytes"] <= ARTIFACT_CAP
        or owner["id"] != run["id"]
        or owner["head_sha"] != pin["run_head_sha"]
        or owner["repository_id"] != REPOSITORY_ID
        or owner["head_repository_id"] != REPOSITORY_ID
    ):
        raise ValueError("Exact immutable artifact/run/digest join failed")
    dates = [
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        for value in (run["run_started_at"], artifact["created_at"], run["updated_at"])
    ]
    if (
        any(value.tzinfo is None for value in dates)
        or not dates[0] <= dates[1] <= dates[2]
    ):
        raise ValueError("Artifact creation does not bind the selected run attempt")
    return {
        "run_id": run["id"],
        "run_attempt": run["run_attempt"],
        "conclusion": run["conclusion"],
        "head_sha": run["head_sha"],
        "artifact_id": artifact["id"],
        "digest": artifact["digest"],
        "size_in_bytes": artifact["size_in_bytes"],
        "api_event": run["event"],
        "package_build_sha": request["package_build_sha"],
        "source_tree_sha": request["source_tree_sha"],
        "pull_requests": run.get("pull_requests", []),
        "package_export_and_actual_source_tree_join_pending": True,
    }


def decode(
    context: Context, event: dict[str, Any], git: READ_GIT, fetch: FETCH
) -> dict[str, Any]:
    head = identity(event, context)
    if git(context.control, "rev-parse", "HEAD").decode().strip() != head:
        raise ValueError("Actual control checkout differs from event head")
    request_path = context.control / REQUESTS[context.mode]
    if not request_path.exists():
        return {"enabled": "false", "status": "SKIP_NO_ROOT_REQUEST"}
    raw = bounded(request_path, REQUEST_CAP)
    if git(context.control, "show", head + ":" + REQUESTS[context.mode]) != raw:
        raise ValueError("Root request differs from committed authorization blob")
    request = parse_request(json.loads(raw, object_pairs_hook=pairs), context.mode)
    if request is None:
        return {"enabled": "false", "status": "SKIP_DISABLED_ROOT_REQUEST"}
    if context.event_name == "workflow_dispatch":
        dispatch_inputs(event, request)
    parents = (
        git(context.control, "rev-list", "--parents", "-n", "1", "HEAD")
        .decode()
        .split()
    )
    if parents != [head, request["request_parent_sha"]]:
        return {"enabled": "false", "status": "SKIP_STALE_ROOT_REQUEST_PARENT"}
    allowed = {REQUESTS[context.mode]} | ({RELEASE} if context.mode == VM else set())
    changed = set(
        git(
            context.control,
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-renames",
            "--name-only",
            "-z",
            request["request_parent_sha"],
            head,
        )
        .decode()
        .rstrip("\0")
        .split("\0")
    )
    if changed != allowed:
        raise ValueError(
            "Root authorization commit must change only exact request/receipt"
        )
    git(
        context.control,
        "merge-base",
        "--is-ancestor",
        request["expected_source_sha"],
        request["request_parent_sha"],
    )
    pins = protected_sources(context, request["expected_source_sha"], git)
    release = release_receipt(context, request) if context.mode == VM else None
    if context.mode == VM and git(
        context.control, "show", head + ":" + RELEASE
    ) != bounded(context.control / RELEASE, REQUEST_CAP):
        raise ValueError("Root release differs from committed authorization blob")
    metadata = artifact_metadata(request, fetch, authorization_head=head)
    outputs = {
        "enabled": "true",
        "mode": context.mode,
        "status": "EXPLICIT_ROOT_REQUEST_BOUND",
        "source_sha": request["expected_source_sha"],
        "artifact_run_id": request["artifact"]["run_id"],
        "artifact_id": request["artifact"]["artifact_id"],
        "package_manifest_sha256": request["artifact"]["package_manifest_sha256"],
        "request_id": request["request_id"],
        "package_build_sha": request["package_build_sha"],
        "source_tree_sha": request["source_tree_sha"],
    }
    if context.mode == VM:
        outputs.update({key: request[key] for key in VM_HASHES})
    return {
        **outputs,
        "proof": {
            "route": context.event_name,
            "event_sha": context.event_sha,
            "workflow_sha": context.workflow_sha,
            "authorization_head_sha": head,
            "request_sha256": hashlib.sha256(raw).hexdigest(),
            "protected_sources": pins,
            "artifact_metadata": metadata,
            "release_receipt_present": release is not None,
            "root_authorship_cryptographically_proven": False,
            "install_vm_product_actors": 0,
        },
    }


def emit_outputs(result: dict[str, Any], path: Path) -> None:
    values = {key: value for key, value in result.items() if key != "proof"}
    if any(
        not isinstance(value, str) or "\n" in value or "\r" in value
        for value in values.values()
    ):
        raise ValueError("Single-line fixed metadata outputs required")
    with path.open("a", encoding="utf-8") as output:
        for key, value in values.items():
            output.write(key + "=" + value + "\n")


def main() -> int:
    require_linux()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=MODES, required=True)
    for name in ("control", "workflow-source", "proof"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    if args.proof.exists() or not args.proof.is_absolute():
        raise ValueError("Fresh absolute metadata proof required")
    args.proof.mkdir(mode=0o700)
    reader = GitReader(args.proof)
    result: dict[str, Any] = {"enabled": "false", "status": "METADATA_GATE_FAILED"}
    code = 1
    try:
        context = Context(
            args.control,
            args.workflow_source,
            os.environ["GITHUB_EVENT_NAME"],
            hexadecimal(os.environ["GITHUB_WORKFLOW_SHA"], 40),
            hexadecimal(os.environ["GITHUB_SHA"], 40),
            os.environ["GITHUB_RUN_ATTEMPT"],
            MODES[args.mode],
        )
        result = decode(
            context, document(Path(os.environ["GITHUB_EVENT_PATH"])), reader, fetch_api
        )
        code = 0
    except Exception as error:
        result["error_type"] = type(error).__name__
    finally:
        closure = reader.close()
        if reader.pending:
            result.update(enabled="false", status="METADATA_CUSTODY_UNSETTLED")
            code = 1
        (args.proof / "closure.json").write_text(
            json.dumps(
                {
                    "pending": len(reader.pending),
                    "commands": closure,
                    "install_vm_product_actors": 0,
                },
                indent=2,
            )
            + "\n"
        )
        (args.proof / "request.json").write_text(json.dumps(result, indent=2) + "\n")
    if code == 0:
        emit_outputs(result, Path(os.environ["GITHUB_OUTPUT"]))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
