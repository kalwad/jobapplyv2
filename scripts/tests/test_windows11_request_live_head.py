"""Mutable API PR subject remains bound to exact validated authorization context."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from test_windows11_request import harness, module

__all__ = ["harness", "module"]


def test_live_pr_head_matches_validated_authorization_commit(
    harness: dict[str, Any],
) -> None:
    h = harness
    head = h["event"]["pull_request"]["head"]["sha"]
    h["run"]["pull_requests"][0]["head"]["sha"] = head
    result = h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])
    assert result["enabled"] == "true"
    assert result["source_sha"] == h["request"]["expected_source_sha"]
    assert result["proof"]["authorization_head_sha"] == head
    metadata = result["proof"]["artifact_metadata"]
    assert metadata["head_sha"] == h["request"]["artifact"]["run_head_sha"]
    assert metadata["pull_requests"][0]["head"]["sha"] == head
    assert metadata["artifact_id"] == int(h["request"]["artifact"]["artifact_id"])
    assert result["proof"]["install_vm_product_actors"] == 0


def test_pure_metadata_without_context_keeps_original_source_only_rule(
    harness: dict[str, Any],
) -> None:
    h = harness
    h["module"].artifact_metadata(h["request"], h["fetch"])
    h["run"]["pull_requests"][0]["head"]["sha"] = h["event"]["pull_request"]["head"][
        "sha"
    ]
    with pytest.raises(ValueError, match="exact same-repository PR"):
        h["module"].artifact_metadata(h["request"], h["fetch"])


@pytest.mark.parametrize(
    "case", ["run_head", "artifact_owner", "digest", "attempt", "unrelated_live_head"]
)
def test_validated_live_head_does_not_relax_immutable_pins(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    h["run"]["pull_requests"][0]["head"]["sha"] = h["event"]["pull_request"]["head"][
        "sha"
    ]
    if case == "run_head":
        h["run"]["head_sha"] = "f" * 40
    elif case == "artifact_owner":
        h["metadata"]["workflow_run"]["head_sha"] = "f" * 40
    elif case == "digest":
        h["metadata"]["digest"] = "sha256:" + "0" * 64
    elif case == "attempt":
        h["run"]["run_attempt"] = 2
    else:
        h["run"]["pull_requests"][0]["head"]["sha"] = "f" * 40
    with pytest.raises(ValueError, match=r"Exact|Original"):
        h["module"].decode(h["context"], h["event"], h["git"], h["fetch"])


@pytest.mark.parametrize("case", ["extra_diff", "ancestry", "protected", "checkout"])
def test_live_head_allowance_follows_all_git_authorization_guards(
    harness: dict[str, Any], case: str
) -> None:
    h = harness
    h["run"]["pull_requests"][0]["head"]["sha"] = h["event"]["pull_request"]["head"][
        "sha"
    ]
    original: Callable[..., bytes] = h["git"]

    def git(root: Path, *args: str) -> bytes:
        if case == "extra_diff" and args[0] == "diff":
            return original(root, *args) + b"unrelated-production.py\0"
        if case == "ancestry" and args[0] == "merge-base":
            raise ValueError("Source is not an ancestor")
        if (
            case == "checkout"
            and root == h["context"].control
            and args == ("rev-parse", "HEAD")
        ):
            return b"wrong"
        return original(root, *args)

    if case == "protected":
        (h["context"].control / h["module"].PROTECTED[2]).write_bytes(b"changed")
    with pytest.raises(
        ValueError,
        match=r"Root authorization|Source is|Reviewed decoder|Actual control",
    ):
        h["module"].decode(h["context"], h["event"], git, h["fetch"])
    assert not any(isinstance(call, str) for call in h["calls"])


@pytest.mark.parametrize("head", ["main", "A" * 40, "f" * 39, [], True])
def test_explicit_metadata_context_head_must_be_exact_hex(
    harness: dict[str, Any], head: object
) -> None:
    h = harness
    with pytest.raises(ValueError, match="Exact lowercase hexadecimal"):
        h["module"].artifact_metadata(h["request"], h["fetch"], authorization_head=head)
    assert not any(isinstance(call, str) for call in h["calls"])
