"""Focused evidence for the generated M01-W07 Python platform contracts.

These tests prove the strict Pydantic v2 surface and the finite platform
semantic rules behave exactly like their TypeScript and Rust counterparts.
They implement no platform behavior: nothing here reads a keychain, spawns a
process, touches a registry, locates a browser, runs a model, or installs.
"""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, cast

import pytest
from conftest import REPO_ROOT
from japp_contracts import (
    PlatformCapabilityReportV1,
    PlatformPathRequestV1,
    PlatformProcessPlanV1,
    PlatformSecretStoreRequestV1,
    PlatformTargetIdentityV1,
    validate_semantic_contract_v1,
)
from pydantic import ValidationError

CORPUS_VALUES = (
    REPO_ROOT
    / "packages"
    / "contracts"
    / "test"
    / "contract"
    / "corpus"
    / "values.v1.json"
)

PLATFORM_ROOTS: tuple[tuple[str, str], ...] = (
    (
        "urn:japp:schema:platform:browser-discovery-request:v1",
        "w07.browser-discovery-request",
    ),
    ("urn:japp:schema:platform:browser-record:v1", "w07.browser-record"),
    ("urn:japp:schema:platform:capability-report:v1", "w07.capability-report"),
    ("urn:japp:schema:platform:certification-input:v1", "w07.certification-input"),
    ("urn:japp:schema:platform:diagnostic-report:v1", "w07.diagnostic-report"),
    ("urn:japp:schema:platform:evidence-record:v1", "w07.evidence-record"),
    ("urn:japp:schema:platform:installer-state:v1", "w07.installer-state"),
    (
        "urn:japp:schema:platform:model-runtime-profile:v1",
        "w07.model-runtime-profile",
    ),
    (
        "urn:japp:schema:platform:native-messaging-registration:v1",
        "w07.native-messaging-registration",
    ),
    (
        "urn:japp:schema:platform:native-messaging-result:v1",
        "w07.native-messaging-result",
    ),
    ("urn:japp:schema:platform:path-request:v1", "w07.path-request"),
    ("urn:japp:schema:platform:path-resolution:v1", "w07.path-resolution"),
    ("urn:japp:schema:platform:process-plan:v1", "w07.process-plan"),
    ("urn:japp:schema:platform:process-status:v1", "w07.process-status"),
    ("urn:japp:schema:platform:runtime-capability:v1", "w07.runtime-capability"),
    (
        "urn:japp:schema:platform:secret-store-request:v1",
        "w07.secret-store-request",
    ),
    ("urn:japp:schema:platform:secret-store-result:v1", "w07.secret-store-result"),
    ("urn:japp:schema:platform:target-identity:v1", "w07.target-identity"),
    ("urn:japp:schema:platform:update-state:v1", "w07.update-state"),
)


def _corpus_value(name: str) -> dict[str, Any]:
    document: object = json.loads(CORPUS_VALUES.read_text(encoding="utf-8"))
    assert isinstance(document, dict)
    values = document["values"]
    assert isinstance(values, dict)
    value = values[name]
    assert isinstance(value, dict)
    return cast("dict[str, Any]", deepcopy(value))


@pytest.mark.parametrize(("schema_ref", "value_ref"), PLATFORM_ROOTS)
def test_every_platform_root_validates_semantically(
    schema_ref: str, value_ref: str
) -> None:
    outcome = validate_semantic_contract_v1(schema_ref, _corpus_value(value_ref))
    assert outcome.valid, outcome.issues


def test_generated_models_preserve_the_exact_wire_form() -> None:
    for model, value_ref in (
        (PlatformTargetIdentityV1, "w07.target-identity"),
        (PlatformCapabilityReportV1, "w07.capability-report"),
        (PlatformPathRequestV1, "w07.path-request"),
        (PlatformProcessPlanV1, "w07.process-plan"),
        (PlatformSecretStoreRequestV1, "w07.secret-store-request"),
    ):
        value = _corpus_value(value_ref)
        assert model.model_validate(value).wire_dict() == value


def test_generated_models_forbid_unknown_and_coerced_members() -> None:
    plan = _corpus_value("w07.process-plan")
    with pytest.raises(ValidationError):
        PlatformProcessPlanV1.model_validate({**plan, "executable_path": "/bin/sh"})
    with pytest.raises(ValidationError):
        PlatformProcessPlanV1.model_validate(
            {**plan, "startup_timeout_ms": "30000"},
        )
    with pytest.raises(ValidationError):
        PlatformProcessPlanV1.model_validate(
            {**plan, "inherit_parent_environment": "false"},
        )
    with pytest.raises(ValidationError):
        PlatformProcessPlanV1.model_validate({**plan, "arguments": ["sh -c ls"]})


def test_missing_and_null_stay_distinct_on_the_platform_surface() -> None:
    request = _corpus_value("w07.secret-store-request")
    assert "material_reference" not in request
    assert PlatformSecretStoreRequestV1.model_validate(request).wire_dict() == request
    with pytest.raises(ValidationError):
        PlatformSecretStoreRequestV1.model_validate(
            {**request, "material_reference": None},
        )


def test_platform_authority_is_unreachable_from_the_page_world() -> None:
    for schema_ref, value_ref in (
        ("urn:japp:schema:platform:path-request:v1", "w07.path-request"),
        (
            "urn:japp:schema:platform:secret-store-request:v1",
            "w07.secret-store-request",
        ),
        ("urn:japp:schema:platform:process-plan:v1", "w07.process-plan"),
    ):
        for principal in ("EXTENSION_CONTENT_SCRIPT", "MODEL_RUNTIME", "DESKTOP_APP"):
            value = _corpus_value(value_ref)
            value["request_context"]["requesting_principal"] = principal
            assert not validate_semantic_contract_v1(schema_ref, value).valid
        for profile in ("FEASIBILITY", "GUIDED_PRE_SUBMIT"):
            value = _corpus_value(value_ref)
            value["request_context"]["authorization_profile"] = profile
            assert not validate_semantic_contract_v1(schema_ref, value).valid


def test_core_tier_survives_an_unavailable_local_model_runtime() -> None:
    schema_ref = "urn:japp:schema:platform:capability-report:v1"
    report = _corpus_value("w07.capability-report")
    assert report["model_profile_refs"] == []
    assert validate_semantic_contract_v1(schema_ref, report).valid

    claiming_full = deepcopy(report)
    claiming_full["support_claim"]["reviewed_tier"] = "CERTIFIED_FULL"
    assert not validate_semantic_contract_v1(schema_ref, claiming_full).valid

    without_secure_store = deepcopy(report)
    for state in without_secure_store["capabilities"]:
        if state["capability"] == "SECURE_STORE":
            state["availability"] = "UNAVAILABLE"
            state["reason_codes"] = ["SERVICE_UNAVAILABLE"]
    assert not validate_semantic_contract_v1(schema_ref, without_secure_store).valid


def test_no_platform_may_self_assert_certification() -> None:
    schema_ref = "urn:japp:schema:platform:target-identity:v1"
    identity = _corpus_value("w07.target-identity")
    assert identity["support_claim"]["reviewed_tier"] == "UNSUPPORTED"
    assert validate_semantic_contract_v1(schema_ref, identity).valid

    self_asserted = deepcopy(identity)
    self_asserted["support_claim"]["reviewed_tier"] = "CERTIFIED_CORE"
    assert not validate_semantic_contract_v1(schema_ref, self_asserted).valid

    unsupported = deepcopy(identity)
    unsupported["platform_id"] = "UNSUPPORTED_TARGET"
    unsupported["architecture"] = "UNKNOWN_ARCHITECTURE"
    unsupported["support_claim"]["reviewed_tier"] = "CERTIFIED_FULL"
    assert not validate_semantic_contract_v1(schema_ref, unsupported).valid


def test_platform_models_reject_post_validation_mutation_drift() -> None:
    request = _corpus_value("w07.path-request")
    model = PlatformPathRequestV1.model_validate(request)
    # A validated model is revalidated from its own serialized wire state, so a
    # later mutation cannot create time-of-check/time-of-use drift.
    with pytest.raises(ValidationError):
        PlatformPathRequestV1.model_validate(
            {**model.wire_dict(), "relative_segments": ["../escape"]},
        )
