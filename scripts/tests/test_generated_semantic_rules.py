"""Focused evidence for generated M01-W06 Python semantic rules."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, cast

from conftest import REPO_ROOT
from japp_contracts import SEMANTIC_RULES_V1, validate_semantic_contract_v1

SEMANTIC_CATALOG = (
    REPO_ROOT / "packages" / "contracts" / "catalog" / "semantic-rules.v1.json"
)
FIELD_ADDRESS_REF = "urn:japp:schema:form:field-address:v1"
CORPUS_VALUES = (
    REPO_ROOT
    / "packages"
    / "contracts"
    / "test"
    / "contract"
    / "corpus"
    / "values.v1.json"
)


def _catalog() -> dict[str, Any]:
    value: object = json.loads(SEMANTIC_CATALOG.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return cast("dict[str, Any]", value)


def _corpus_value(name: str) -> dict[str, Any]:
    document: object = json.loads(CORPUS_VALUES.read_text(encoding="utf-8"))
    assert isinstance(document, dict)
    values = document["values"]
    assert isinstance(values, dict)
    value = values[name]
    assert isinstance(value, dict)
    return cast("dict[str, Any]", deepcopy(value))


def test_generated_python_semantic_bindings_match_canonical_data() -> None:
    document = _catalog()
    assert document["catalog_version"] == "1.0.0"
    assert len(SEMANTIC_RULES_V1) == 42
    assert [entry._asdict() for entry in SEMANTIC_RULES_V1] == document["entries"]
    rule_ids = [entry.rule_id for entry in SEMANTIC_RULES_V1]
    assert rule_ids == sorted(rule_ids)
    assert len(set(rule_ids)) == len(rule_ids)


def test_generated_python_semantics_return_the_first_canonical_error() -> None:
    valid = {
        "route_signature": f"sha256:{'a' * 64}",
        "application_root_fingerprint": f"sha256:{'b' * 64}",
        "section_path": [],
        "repeater_path": [],
    }
    assert validate_semantic_contract_v1(FIELD_ADDRESS_REF, valid) == (
        True,
        (),
    )
    invalid = {
        key: value
        for key, value in valid.items()
        if key != "application_root_fingerprint"
    }
    outcome = validate_semantic_contract_v1(FIELD_ADDRESS_REF, invalid)
    assert not outcome.valid
    assert outcome.issues[0] == (
        "FIELD_ADDRESS_IDENTITY",
        "FIELD_ADDRESS_IDENTITY",
        "SITE_AMBIGUOUS_CONTROL",
    )
    assert validate_semantic_contract_v1(
        "urn:japp:schema:fixture:test-record:v1",
        {},
    ) == (True, ())


def test_generated_python_semantics_enforce_audited_evidence_invariants() -> None:
    holdout = _corpus_value("w06.holdout-manifest")
    holdout["schema_versions"] = [
        {
            "schema_ref": "urn:japp:schema:benchmark:result:v1",
            "schema_version": "1.0.0",
        },
        {
            "schema_ref": "urn:japp:schema:benchmark:case:v1",
            "schema_version": "1.0.0",
        },
    ]
    assert not validate_semantic_contract_v1(
        "urn:japp:schema:benchmark:holdout-manifest:v1",
        holdout,
    ).valid
    holdout["schema_versions"] = sorted(
        holdout["schema_versions"],
        key=lambda item: item["schema_ref"],
    )
    assert validate_semantic_contract_v1(
        "urn:japp:schema:benchmark:holdout-manifest:v1",
        holdout,
    ).valid

    unsupported_fail = _corpus_value("w06.benchmark-result")
    unsupported_fail["overall_outcome"] = "FAIL"
    assert not validate_semantic_contract_v1(
        "urn:japp:schema:benchmark:result:v1",
        unsupported_fail,
    ).valid
    unsupported_fail["metric_results"] = [
        {
            "measured_value": 0,
            "metric_id": "VERDICT_AGREEMENT",
            "passed": False,
            "threshold_digest": f"sha256:{'1' * 64}",
            "unit": "RATIO",
        },
    ]
    assert validate_semantic_contract_v1(
        "urn:japp:schema:benchmark:result:v1",
        unsupported_fail,
    ).valid

    renderer_failure = _corpus_value("w06.layout-measurement")
    renderer_failure["page_count"] = 0
    renderer_failure["page_content_bounds"] = []
    renderer_failure["renderer_succeeded"] = False
    renderer_failure["layout_result"] = "RENDER_FAILED"
    renderer_failure["error_reason_codes"] = ["RENDERING_FAILURE"]
    assert validate_semantic_contract_v1(
        "urn:japp:schema:rendering:layout-measurement:v1",
        renderer_failure,
    ).valid
    renderer_failure["renderer_succeeded"] = True
    renderer_failure["layout_result"] = "ACCEPTED"
    renderer_failure["error_reason_codes"] = []
    assert not validate_semantic_contract_v1(
        "urn:japp:schema:rendering:layout-measurement:v1",
        renderer_failure,
    ).valid
