"""M01-W02 generated Pydantic v2 model tests.

Proves the committed generated Python package (packages/contracts/generated/
python) imports, enforces the canonical schema semantics strictly, agrees
with the shared instance corpus that also drives the generated-TypeScript
suite, preserves the wire representation, and that the real generator CLI
check passes read-only against the committed tree. These are M01-W02
generator/model tests, not the M01-W05 cross-language compatibility corpus.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, cast

import japp_contracts
import portability
import pydantic
import pytest
from conftest import REPO_ROOT
from japp_contracts import FixtureTestRecordV1
from japp_contracts._runtime import ContractModel

GENERATED_ROOT = REPO_ROOT / "packages" / "contracts" / "generated"
CORPUS_PATH = (
    REPO_ROOT / "packages" / "contracts" / "test" / "fixtures" / "instance-corpus.json"
)
CLI_PATH = REPO_ROOT / "scripts" / "generate-contracts.ts"


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
