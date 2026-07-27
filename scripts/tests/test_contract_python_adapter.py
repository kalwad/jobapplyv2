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


def _field_address() -> dict[str, object]:
    return {
        "address_schema_version": "FIELD_ADDRESS_V1",
        "session_id": "ses_0123456789ABCDEFGHJKMNPQRS",
        "frame_id": "frm_0123456789ABCDEFGHJKMNPQRS",
        "document_id": "doc_0123456789ABCDEFGHJKMNPQRS",
        "ats_family": "WORKDAY",
        "route_signature": f"sha256:{'a' * 64}",
        "application_root_fingerprint": f"sha256:{'b' * 64}",
        "section_path": [],
        "repeater_path": [],
        "resolution_hints": [],
        "observed_dom_generation": 1,
    }


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


def test_real_python_adapter_runs_semantics_after_structural_validation(
    tmp_path: Path,
) -> None:
    field_address_ref = "urn:japp:schema:form:field-address:v1"
    envelope_ref = "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord"
    valid = _field_address()
    structural_invalid = {**valid, "observed_dom_generation": -1}
    semantic_invalid = {
        key: value
        for key, value in valid.items()
        if key != "application_root_fingerprint"
    }
    semantic_envelope = {
        "envelope": {
            "schema_id": field_address_ref,
            "schema_version": "1.0.0",
            "message_id": "msg_0123456789ABCDEFGHJKMNPQRS",
            "created_at": "2026-07-27T12:00:00Z",
        },
        "payload": semantic_invalid,
    }
    requests: list[dict[str, Any]] = [
        {
            "case_id": "semantic.round-trip-valid",
            "schema_ref": field_address_ref,
            "operation": "ROUND_TRIP",
            "input_bytes_base64": _encoded(valid),
        },
        {
            "case_id": "semantic.structural-invalid",
            "schema_ref": field_address_ref,
            "operation": "VALIDATE",
            "input_bytes_base64": _encoded(structural_invalid),
        },
        {
            "case_id": "semantic.validate-invalid",
            "schema_ref": field_address_ref,
            "operation": "VALIDATE",
            "input_bytes_base64": _encoded(semantic_invalid),
        },
        {
            "case_id": "semantic.version-invalid",
            "schema_ref": envelope_ref,
            "operation": "VERSION_CHECK",
            "input_bytes_base64": _encoded(semantic_envelope),
        },
    ]
    path = tmp_path / "semantic-request.json"
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
    assert results["semantic.round-trip-valid"] == {
        "case_id": "semantic.round-trip-valid",
        "canonical_json": json.dumps(
            valid,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ),
        "operation": "ROUND_TRIP",
        "validation_verdict": "VALID",
    }
    assert results["semantic.structural-invalid"] == {
        "case_id": "semantic.structural-invalid",
        "error_category": "SCHEMA_INVALID",
        "operation": "VALIDATE",
        "validation_verdict": "INVALID",
    }
    assert results["semantic.validate-invalid"] == {
        "case_id": "semantic.validate-invalid",
        "error_category": "SEMANTIC_INVALID",
        "error_code": "SITE_AMBIGUOUS_CONTROL",
        "operation": "VALIDATE",
        "validation_verdict": "INVALID",
    }
    assert results["semantic.version-invalid"] == {
        "case_id": "semantic.version-invalid",
        "error_category": "SEMANTIC_INVALID",
        "error_code": "SITE_AMBIGUOUS_CONTROL",
        "operation": "VERSION_CHECK",
        "validation_verdict": "INVALID",
        "version_outcome": "PAYLOAD_INVALID",
    }


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
