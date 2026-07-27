"""M01-W02 generated Pydantic v2 model tests.

Proves the committed generated Python package (packages/contracts/generated/
python) imports, enforces the canonical schema semantics strictly, agrees
with the shared instance corpus that also drives the generated-TypeScript
suite, preserves the wire representation, and that the real generator CLI
check passes read-only against the committed tree. These are M01-W02
generator/model tests, not the M01-W05 cross-language compatibility corpus.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, cast

import japp_contracts
import portability
import pydantic
import pytest
from conftest import REPO_ROOT
from japp_contracts import (
    ERROR_CATALOG_V1,
    ERROR_CODES_V1,
    ErrorRecordV1,
    FixtureTestRecordV1,
    error_default_message_v1,
    is_error_code_v1,
    require_error_catalog_entry_v1,
)
from japp_contracts._runtime import ContractModel

GENERATED_ROOT = REPO_ROOT / "packages" / "contracts" / "generated"
CORPUS_PATH = (
    REPO_ROOT / "packages" / "contracts" / "test" / "fixtures" / "instance-corpus.json"
)
CLI_PATH = REPO_ROOT / "scripts" / "generate-contracts.ts"
ERROR_CATALOG_PATH = (
    REPO_ROOT / "packages" / "contracts" / "catalog" / "error-catalog.v1.json"
)
MODEL_RESULT_PRESERVATION = (
    "All accepted deterministic results remain usable and unchanged."
)


def _load_json(path: Path) -> dict[str, Any]:
    raw: object = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(raw, dict)
    return cast("dict[str, Any]", raw)


MANIFEST = _load_json(GENERATED_ROOT / "MANIFEST.json")
CORPUS = cast("list[dict[str, Any]]", _load_json(CORPUS_PATH)["cases"])


def _python_symbol(ref: str) -> object:
    types = cast("dict[str, Any]", MANIFEST["types"])
    assert ref in types, f"corpus ref {ref} missing from MANIFEST.json"
    symbol = cast("str", types[ref]["python"]["symbol"])
    resolved: object = getattr(japp_contracts, symbol)
    return resolved


def _validate(ref: str, instance: object) -> None:
    """Validate `instance` against the generated symbol for `ref` strictly."""
    target = _python_symbol(ref)
    if isinstance(target, type) and issubclass(target, ContractModel):
        target.model_validate(instance)
    else:
        adapter: pydantic.TypeAdapter[object] = pydantic.TypeAdapter(
            target,
            config=pydantic.ConfigDict(strict=True),
        )
        adapter.validate_python(instance)


@pytest.mark.parametrize(
    "case",
    CORPUS,
    ids=[cast("str", case["label"]) for case in CORPUS],
)
def test_corpus_case_matches_expected_verdict(case: dict[str, Any]) -> None:
    instance = case["instance"]
    before = json.dumps(instance, sort_keys=True)
    if case["valid"]:
        _validate(cast("str", case["ref"]), instance)
    else:
        with pytest.raises(pydantic.ValidationError):
            _validate(cast("str", case["ref"]), instance)
    assert json.dumps(instance, sort_keys=True) == before, "validation mutated input"


VALID_RECORD: dict[str, Any] = {
    "record_id": "rec_0123456789ABCDEFGHJKMNPQRS",
    "captured_at": "2026-07-27T04:00:00Z",
    "effective_date": "2026-07-27",
    "budget": {"amount": "1250.50", "currency": "USD"},
    "location": {"country": "US", "region": "California"},
    "provenance": {
        "source_kind": "USER_INPUT",
        "source_id": "doc_0123456789ABCDEFGHJKMNPQRS",
        "observed_at": "2026-07-27T04:00:00Z",
    },
    "match_confidence": 1,
    "redaction": {"sensitivity": "PERSONAL", "policy": "REDACT_VALUE"},
    "status": "ACTIVE",
    "superseded_by": None,
}


def test_wire_round_trip_preserves_canonical_representation() -> None:
    model = FixtureTestRecordV1.model_validate(VALID_RECORD)
    wire = model.wire_dict()
    assert wire == VALID_RECORD
    # JSON integer confidence stays an integer; floats stay floats.
    assert isinstance(wire["match_confidence"], int)
    fractional = FixtureTestRecordV1.model_validate(
        {**VALID_RECORD, "match_confidence": 0.25},
    ).wire_dict()
    assert isinstance(fractional["match_confidence"], float)
    # Decimal money amounts keep the exact string form.
    budget = cast("dict[str, Any]", wire["budget"])
    assert budget["amount"] == "1250.50"


def test_absent_optionals_stay_absent_and_null_successor_survives() -> None:
    model = FixtureTestRecordV1.model_validate(VALID_RECORD)
    wire = model.wire_dict()
    assert "note" not in wire
    assert "legacy_tag" not in wire
    assert wire["superseded_by"] is None
    provided = FixtureTestRecordV1.model_validate(
        {**VALID_RECORD, "note": "synthetic"},
    ).wire_dict()
    assert provided["note"] == "synthetic"


def test_missing_and_explicit_null_are_distinct() -> None:
    without_successor = {
        key: value for key, value in VALID_RECORD.items() if key != "superseded_by"
    }
    with pytest.raises(pydantic.ValidationError):
        FixtureTestRecordV1.model_validate(without_successor)
    with pytest.raises(pydantic.ValidationError):
        FixtureTestRecordV1.model_validate({**VALID_RECORD, "note": None})
    with pytest.raises(pydantic.ValidationError):
        FixtureTestRecordV1(**{**VALID_RECORD, "note": None})


def test_extra_members_and_coercion_are_rejected() -> None:
    with pytest.raises(pydantic.ValidationError):
        FixtureTestRecordV1.model_validate({**VALID_RECORD, "surprise": 1})
    for field_name, wrong in (
        ("match_confidence", "0.5"),
        ("match_confidence", True),
        ("captured_at", 1753588800),
        ("status", 1),
        ("superseded_by", 7),
    ):
        with pytest.raises(pydantic.ValidationError):
            FixtureTestRecordV1.model_validate({**VALID_RECORD, field_name: wrong})


def test_field_declaration_order_matches_schema_property_order() -> None:
    assert list(FixtureTestRecordV1.model_fields) == [
        "record_id",
        "captured_at",
        "effective_date",
        "budget",
        "location",
        "provenance",
        "match_confidence",
        "redaction",
        "status",
        "superseded_by",
        "note",
        "legacy_tag",
    ]


def test_export_surface_is_sorted_and_importable() -> None:
    exported = japp_contracts.__all__
    assert exported == sorted(exported)
    for name in exported:
        assert getattr(japp_contracts, name) is not None
    assert (GENERATED_ROOT / "python" / "src" / "japp_contracts" / "py.typed").is_file()


def test_every_committed_generated_python_module_compiles() -> None:
    sources = sorted((GENERATED_ROOT / "python").rglob("*.py"))
    assert sources, "generated python tree is missing"
    for source in sources:
        if "__pycache__" in source.parts:
            continue
        compile(source.read_text(encoding="utf-8"), str(source), "exec")


def test_generated_headers_forbid_manual_edits() -> None:
    for source in sorted((GENERATED_ROOT / "python").rglob("*.py")):
        if "__pycache__" in source.parts:
            continue
        text = source.read_text(encoding="utf-8")
        assert "GENERATED FILE - DO NOT EDIT BY HAND." in text, source
        assert "pnpm generate:contracts" in text, source


def _run_cli_check() -> subprocess.CompletedProcess[str]:
    node = portability.host_resolve_executable("node")
    assert node is not None, "pinned node is required on PATH for the generator"
    return subprocess.run(
        [node, str(CLI_PATH), "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )


def _porcelain_status() -> str:
    return subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    ).stdout


def test_cli_check_passes_on_committed_tree_and_is_read_only() -> None:
    before = _porcelain_status()
    result = _run_cli_check()
    assert result.returncode == 0, result.stdout + result.stderr
    assert "byte-identical" in result.stdout
    assert _porcelain_status() == before


# ------------------------------------------------------- M01-W03 error layer

ERROR_TAXONOMY_REF = "urn:japp:schema:error:taxonomy:v1"
ERROR_FAMILIES = (
    "VALIDATION",
    "CONFLICT",
    "UNSUPPORTED",
    "SENSITIVE",
    "MODEL",
    "STORAGE",
    "TRANSPORT",
    "RENDERING",
    "SITE",
    "BENCHMARK",
    "GATE",
    "SUBMISSION",
)


def _taxonomy_schema() -> dict[str, Any]:
    path = (
        REPO_ROOT
        / "packages"
        / "contracts"
        / "schemas"
        / "error"
        / "taxonomy.v1.schema.json"
    )
    return _load_json(path)


def test_error_catalog_covers_every_family_and_code_exactly_once() -> None:

    assert len(ERROR_CODES_V1) == 80
    assert list(ERROR_CODES_V1) == sorted(ERROR_CODES_V1)
    assert len(set(ERROR_CODES_V1)) == len(ERROR_CODES_V1)
    families = {entry.family for entry in ERROR_CATALOG_V1.values()}
    assert families == set(ERROR_FAMILIES)
    declared = _taxonomy_schema()["$defs"]["errorCode"]["enum"]
    assert list(ERROR_CODES_V1) == sorted(declared)
    for code, entry in ERROR_CATALOG_V1.items():
        assert entry.code == code
        assert code.startswith(entry.family + "_")
        family_lower = entry.family.lower()
        remainder = code[len(entry.family) + 1 :].lower()
        assert entry.message_key == f"error.{family_lower}.{remainder}"


def test_error_catalog_messages_are_user_safe() -> None:

    forbidden = re.compile(r"[{}<>%$\\`]|://|https?|Traceback", re.IGNORECASE)
    keys: set[str] = set()
    for entry in ERROR_CATALOG_V1.values():
        assert entry.message_key not in keys
        keys.add(entry.message_key)
        texts = [entry.default_message]
        if entry.remediation is not None:
            texts.append(entry.remediation)
        for text in texts:
            assert 0 < len(text) <= 200, entry.code
            assert forbidden.search(text) is None, (entry.code, text)
            assert all(0x20 <= ord(char) < 0x7F for char in text), entry.code


def test_generated_python_error_catalog_exactly_matches_canonical_data() -> None:

    catalog_document = _load_json(ERROR_CATALOG_PATH)
    canonical_entries = cast("list[dict[str, Any]]", catalog_document["entries"])
    assert list(ERROR_CODES_V1) == [entry["code"] for entry in canonical_entries]
    for canonical_entry in canonical_entries:
        code = cast("str", canonical_entry["code"])
        assert (
            require_error_catalog_entry_v1(code).model_dump(
                mode="json", exclude_none=True
            )
            == canonical_entry
        )


def test_transient_conditions_are_exactly_safe_retry_conditions_in_python() -> None:

    for entry in ERROR_CATALOG_V1.values():
        assert entry.transient == (entry.retry_disposition == "SAFE_RETRY"), entry.code


def test_error_family_invariants_hold_in_python_surface() -> None:

    for entry in ERROR_CATALOG_V1.values():
        if entry.retry_disposition in ("PAUSE_FOR_USER", "NO_RETRY_PROHIBITED"):
            assert entry.user_action_required, entry.code
        if entry.family == "SENSITIVE":
            assert entry.user_action_required, entry.code
            assert entry.retry_disposition in (
                "PAUSE_FOR_USER",
                "NO_RETRY_PROHIBITED",
            ), entry.code
        if entry.family == "SITE":
            assert entry.retry_disposition == "PAUSE_FOR_USER", entry.code
        if entry.family in (
            "UNSUPPORTED",
            "SENSITIVE",
            "GATE",
            "BENCHMARK",
            "SUBMISSION",
        ):
            assert entry.retry_disposition != "SAFE_RETRY", entry.code
        if entry.family in ("GATE", "BENCHMARK"):
            assert not entry.transient, entry.code


def test_reviewed_model_semantics_and_deterministic_results_are_preserved() -> None:

    model_entries = [
        entry for entry in ERROR_CATALOG_V1.values() if entry.family == "MODEL"
    ]
    assert len(model_entries) == 6
    for entry in model_entries:
        assert MODEL_RESULT_PRESERVATION in entry.default_message, entry.code

    malformed = ERROR_CATALOG_V1["MODEL_MALFORMED_OUTPUT"]
    assert malformed.retry_disposition == "SAFE_RETRY"
    assert malformed.transient
    assert not malformed.user_action_required

    validation = ERROR_CATALOG_V1["MODEL_VALIDATION_FAILED"]
    assert validation.retry_disposition == "RETRY_AFTER_REMEDIATION"
    assert not validation.transient
    assert not validation.user_action_required
    assert validation.remediation == (
        "Correct the source evidence or generation request before trying again."
    )


def test_error_lookups_are_deterministic_and_fail_closed() -> None:

    first = require_error_catalog_entry_v1("SITE_CAPTCHA_BOUNDARY")
    second = require_error_catalog_entry_v1("SITE_CAPTCHA_BOUNDARY")
    assert first is second
    assert error_default_message_v1("SITE_CAPTCHA_BOUNDARY") == (first.default_message)
    assert is_error_code_v1("MODEL_TIMEOUT")
    assert not is_error_code_v1("MODEL_TIME_TRAVEL")
    assert not is_error_code_v1(None)
    assert not is_error_code_v1(80)
    hostile = "SITE_<script>alert(1)</script>"
    with pytest.raises(KeyError) as caught:
        require_error_catalog_entry_v1(hostile)
    assert "script" not in str(caught.value)


def test_error_record_serializes_code_only_and_rejects_metadata() -> None:

    record = ErrorRecordV1.model_validate(
        {
            "error_id": "err_0123456789ABCDEFGHJKMNPQRS",
            "code": "SUBMISSION_RECEIPT_MISSING",
            "occurred_at": "2026-07-27T06:00:00Z",
            "origin": "EXTENSION_SERVICE_WORKER",
            "correlation_id": "wf_0123456789ABCDEFGHJKMNPQRS",
        }
    )
    wire = record.wire_dict()
    assert set(wire) == {
        "error_id",
        "code",
        "occurred_at",
        "origin",
        "correlation_id",
    }
    metadata = require_error_catalog_entry_v1(record.code)
    assert metadata.retry_disposition == "PAUSE_FOR_USER"
    assert metadata.user_action_required
    for extra_field in ("severity", "family", "retry_disposition", "message"):
        with pytest.raises(pydantic.ValidationError):
            ErrorRecordV1.model_validate({**wire, extra_field: "ERROR"})


def test_generated_data_manifest_provenance_matches_all_committed_catalogs() -> None:
    data_inputs = cast("list[dict[str, Any]]", MANIFEST["dataInputs"])
    expected = {
        "packages/contracts/catalog/authorization-policy.v1.json": (
            "urn:japp:schema:security:authorization-policy:v1",
            "policy_version",
        ),
        "packages/contracts/catalog/capability-catalog.v1.json": (
            "urn:japp:schema:security:capability-taxonomy:v1",
            "catalog_version",
        ),
        "packages/contracts/catalog/command-catalog.v1.json": (
            "urn:japp:schema:security:command-taxonomy:v1",
            "catalog_version",
        ),
        "packages/contracts/catalog/error-catalog.v1.json": (
            "urn:japp:schema:error:catalog:v1",
            "catalog_version",
        ),
    }
    assert [entry["path"] for entry in data_inputs] == sorted(expected)
    for entry in data_inputs:
        path = cast("str", entry["path"])
        schema_id, version_field = expected[path]
        assert entry["validatedAgainst"] == schema_id
        committed = (REPO_ROOT / path).read_bytes()
        assert hashlib.sha256(committed).hexdigest() == entry["sha256"]
        document = _load_json(REPO_ROOT / path)
        assert document[version_field] == entry["version"]

    catalog_document = _load_json(ERROR_CATALOG_PATH)
    assert len(cast("list[Any]", catalog_document["entries"])) == 80
