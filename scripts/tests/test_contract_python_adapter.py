"""Focused execution tests for the real M01-W05 Pydantic adapter."""

from __future__ import annotations

import base64
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from conftest import REPO_ROOT

ADAPTER = (
    REPO_ROOT
    / "packages"
    / "contracts"
    / "test"
    / "contract"
    / "adapters"
    / "python_adapter.py"
)
VALUES = (
    REPO_ROOT
    / "packages"
    / "contracts"
    / "test"
    / "contract"
    / "corpus"
    / "values.v1.json"
)


def _encoded(value: object) -> str:
    wire = json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    return base64.b64encode(wire).decode("ascii")


def _run(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(ADAPTER), "--request", str(path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_real_python_adapter_is_strict_and_revalidates_mutated_models(
    tmp_path: Path,
) -> None:
    document = json.loads(VALUES.read_text(encoding="utf-8"))
    assert isinstance(document, dict)
    values = document["values"]
    assert isinstance(values, dict)
    fixture = values["fixture.full"]
    invalid = dict(fixture)
    invalid["unexpected"] = "forbidden"
    requests: list[dict[str, Any]] = [
        {
            "case_id": "python.extra-field",
            "schema_ref": "urn:japp:schema:fixture:test-record:v1",
            "operation": "VALIDATE",
            "input_bytes_base64": _encoded(invalid),
        },
        {
            "case_id": "python.mutated-model",
            "schema_ref": "urn:japp:schema:fixture:test-record:v1",
            "operation": "ROUND_TRIP",
            "input_bytes_base64": _encoded(fixture),
            "scenario": "MUTATED_MODEL",
        },
        {
            "case_id": "python.valid-round-trip",
            "schema_ref": "urn:japp:schema:fixture:test-record:v1",
            "operation": "ROUND_TRIP",
            "input_bytes_base64": _encoded(fixture),
        },
    ]
    path = tmp_path / "request.json"
    path.write_text(
        json.dumps(
            {
                "protocol_version": "JAPP_CONTRACT_ADAPTER_V1",
                "requests": requests,
            },
            separators=(",", ":"),
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    completed = _run(path)
    assert completed.returncode == 0
    assert completed.stderr == ""
    response = json.loads(completed.stdout)
    assert response["language"] == "python"
    results = {entry["case_id"]: entry for entry in response["results"]}
    assert results["python.extra-field"]["validation_verdict"] == "INVALID"
    assert results["python.mutated-model"] == {
        "case_id": "python.mutated-model",
        "error_category": "SCHEMA_INVALID",
        "operation": "ROUND_TRIP",
        "validation_verdict": "INVALID",
    }
    valid = results["python.valid-round-trip"]
    assert valid["validation_verdict"] == "VALID"
    assert json.loads(valid["canonical_json"]) == fixture


def test_real_python_adapter_rejects_duplicate_protocol_keys_without_echo(
    tmp_path: Path,
) -> None:
    path = tmp_path / "duplicate.json"
    path.write_bytes(
        b'{"protocol_version":"JAPP_CONTRACT_ADAPTER_V1",'
        b'"protocol_version":"hostile","requests":[]}'
    )
    completed = _run(path)
    assert completed.returncode == 2
    assert completed.stdout == ""
    assert completed.stderr == ""
