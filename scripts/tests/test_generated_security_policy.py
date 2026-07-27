"""M01-W04 generated Python authorization-policy evidence.

This exercises the same canonical policy as the TypeScript suite without
activating the M01-W05 cross-language compatibility suite.
"""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError, asdict
from pathlib import Path
from typing import Any, cast

import pydantic
import pytest
from conftest import REPO_ROOT
from japp_contracts import (
    AUTHORIZATION_POLICY_V1,
    AUTHORIZATION_PROFILE_CATALOG_V1,
    AUTHORIZATION_PROFILES_V1,
    CAPABILITY_CATALOG_V1,
    CAPABILITY_IDS_V1,
    COMMAND_CATALOG_V1,
    COMMAND_IDS_V1,
    PRINCIPAL_CATALOG_V1,
    PRINCIPAL_IDS_V1,
    AuthorizationAllowedV1,
    AuthorizationDeniedV1,
    AuthorizationRuntimeContextV1,
    SecurityAuthorizationRequestV1,
    allowed_commands_for_v1,
    authorize_command_request_v1,
    is_capability_id_v1,
    is_command_id_v1,
    require_capability_entry_v1,
    require_command_entry_v1,
)

CATALOG_ROOT = REPO_ROOT / "packages" / "contracts" / "catalog"
BASE_REQUEST: dict[str, object] = {
    "request_version": "AUTHORIZATION_REQUEST_V1",
    "request_id": "req_0123456789ABCDEFGHJKMNPQRS",
    "occurred_at": "2026-07-27T08:00:00Z",
    "correlation_id": "wf_0123456789ABCDEFGHJKMNPQRS",
    "payload_size_bytes": 0,
}


def _load(path: Path) -> dict[str, Any]:
    value: object = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return cast("dict[str, Any]", value)


def _row_request(row: object) -> dict[str, object]:
    command_id = cast("Any", row).command_id
    command = COMMAND_CATALOG_V1[command_id]
    request: dict[str, object] = {
        **BASE_REQUEST,
        "command_id": command_id,
        "originating_principal": cast("Any", row).originating_principal,
        "immediate_sender": cast("Any", row).immediate_sender,
        "target_principal": cast("Any", row).target_principal,
        "authorization_profile": cast("Any", row).authorization_profile,
    }
    if command.idempotency_expectation == "IDEMPOTENCY_KEY_REQUIRED":
        request["idempotency_key"] = "idem_0123456789ABCDEFGHJKMNPQRS"
    return request


def _context(row: object) -> AuthorizationRuntimeContextV1:
    typed = cast("Any", row)
    return AuthorizationRuntimeContextV1(
        receiving_principal=typed.receiving_principal,
        authenticated_sender_principal=typed.immediate_sender,
        authenticated_originating_principal=typed.originating_principal,
        active_profile=typed.authorization_profile,
        observed_payload_size_bytes=0,
    )


def _as_canonical(entry: object) -> dict[str, object]:
    value = cast("dict[str, object]", asdict(cast("Any", entry)))
    for field in ("non_goals", "supported_profiles"):
        if field in value:
            value[field] = list(cast("tuple[object, ...]", value[field]))
    return value


def test_generated_python_catalogs_exactly_match_canonical_data() -> None:
    capabilities = _load(CATALOG_ROOT / "capability-catalog.v1.json")
    commands = _load(CATALOG_ROOT / "command-catalog.v1.json")
    policy = _load(CATALOG_ROOT / "authorization-policy.v1.json")

    assert [_as_canonical(entry) for entry in PRINCIPAL_CATALOG_V1.values()] == (
        capabilities["principals"]
    )
    assert [
        _as_canonical(entry) for entry in AUTHORIZATION_PROFILE_CATALOG_V1.values()
    ] == capabilities["profiles"]
    assert [_as_canonical(entry) for entry in CAPABILITY_CATALOG_V1.values()] == (
        capabilities["capabilities"]
    )
    assert [_as_canonical(entry) for entry in COMMAND_CATALOG_V1.values()] == (
        commands["commands"]
    )
    assert [_as_canonical(row) for row in AUTHORIZATION_POLICY_V1] == policy["allow"]


def test_generated_python_sorted_inventories_are_exact_and_closed() -> None:
    assert len(PRINCIPAL_IDS_V1) == 9
    assert tuple(sorted(PRINCIPAL_IDS_V1)) == PRINCIPAL_IDS_V1
    assert len(set(PRINCIPAL_IDS_V1)) == len(PRINCIPAL_IDS_V1)
    assert tuple(sorted(AUTHORIZATION_PROFILES_V1)) == AUTHORIZATION_PROFILES_V1
    assert len(set(AUTHORIZATION_PROFILES_V1)) == len(AUTHORIZATION_PROFILES_V1)
    assert tuple(sorted(CAPABILITY_IDS_V1)) == CAPABILITY_IDS_V1
    assert len(CAPABILITY_IDS_V1) == 18
    assert len(set(CAPABILITY_IDS_V1)) == len(CAPABILITY_IDS_V1)
    assert tuple(sorted(COMMAND_IDS_V1)) == COMMAND_IDS_V1
    assert len(COMMAND_IDS_V1) == 24
    assert len(set(COMMAND_IDS_V1)) == len(COMMAND_IDS_V1)
    assert AUTHORIZATION_PROFILES_V1 == (
        "FEASIBILITY",
        "GUIDED_PRE_SUBMIT",
        "PRODUCTION_NO_SUBMIT",
        "VERIFICATION",
    )
    assert "AUTO_SUBMIT" not in AUTHORIZATION_PROFILES_V1
    for hostile in (
        "PASSWORD_FILL",
        "ACCOUNT_CREATE",
        "EMAIL_VERIFY",
        "MFA_COMPLETE",
        "CAPTCHA_SOLVE",
        "LEGAL_CONSENT_ACCEPT",
        "RUN_COMMAND",
        "__proto__",
    ):
        assert not is_command_id_v1(hostile)
        assert not is_capability_id_v1(hostile)


def test_every_committed_positive_row_authorizes_in_python() -> None:
    for row in AUTHORIZATION_POLICY_V1:
        outcome = authorize_command_request_v1(_row_request(row), _context(row))
        assert isinstance(outcome, AuthorizationAllowedV1), row
        assert outcome.command_id == row.command_id
        assert (
            outcome.required_capability
            == COMMAND_CATALOG_V1[row.command_id].required_capability
        )


def test_explicit_feasibility_and_guided_page_routes_authorize_in_python() -> None:
    feasibility = [
        row
        for row in AUTHORIZATION_POLICY_V1
        if row.authorization_profile == "FEASIBILITY"
        and row.command_id == "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS"
        and row.originating_principal == "VERIFICATION_HARNESS"
    ]
    assert len(feasibility) == 4
    guided_commands = {
        "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "PAGE_VERIFY_FIELD_VALUES",
        "PAGE_NAVIGATE_NEXT",
        "PAGE_NAVIGATE_BACK",
    }
    guided = [
        row
        for row in AUTHORIZATION_POLICY_V1
        if row.authorization_profile == "GUIDED_PRE_SUBMIT"
        and row.command_id in guided_commands
    ]
    assert len(guided) == 12
    for row in [*feasibility, *guided]:
        assert isinstance(
            authorize_command_request_v1(_row_request(row), _context(row)),
            AuthorizationAllowedV1,
        )


def test_allowed_commands_requires_every_exact_route_dimension() -> None:
    assert allowed_commands_for_v1(
        "GUIDED_PRE_SUBMIT",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "NATIVE_HOST",
        "ORCHESTRATOR",
    ) == ("PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE")
    assert (
        allowed_commands_for_v1(
            "GUIDED_PRE_SUBMIT",
            "EXTENSION_CONTENT_SCRIPT",
            "EXTENSION_CONTENT_SCRIPT",
            "NATIVE_HOST",
            "ORCHESTRATOR",
        )
        == ()
    )


def test_python_mappings_entries_and_sequences_are_immutable() -> None:
    with pytest.raises(TypeError):
        cast("Any", CAPABILITY_CATALOG_V1)["NEW"] = object()
    with pytest.raises(FrozenInstanceError):
        cast(
            "Any", require_command_entry_v1("PAGE_REPORT_STATE")
        ).description = "mutated"
    assert isinstance(COMMAND_IDS_V1, tuple)
    assert isinstance(AUTHORIZATION_POLICY_V1, tuple)
    assert isinstance(require_capability_entry_v1("PAGE_INSPECT").non_goals, tuple)


@pytest.mark.parametrize(
    ("command_id", "target", "sender", "receiver"),
    [
        (
            "PRIVATE_DATA_READ_REQUEST",
            "ORCHESTRATOR",
            "EXTENSION_SERVICE_WORKER",
            "NATIVE_HOST",
        ),
        (
            "PRIVATE_DATA_READ_REQUEST",
            "ORCHESTRATOR",
            "NATIVE_HOST",
            "ORCHESTRATOR",
        ),
        (
            "MODEL_INFERENCE_REQUEST",
            "MODEL_RUNTIME",
            "EXTENSION_SERVICE_WORKER",
            "NATIVE_HOST",
        ),
        (
            "ARTIFACT_READ_REQUEST",
            "ORCHESTRATOR",
            "NATIVE_HOST",
            "ORCHESTRATOR",
        ),
        (
            "PLATFORM_SECRET_STORE_REQUEST",
            "PLATFORM_ADAPTER",
            "NATIVE_HOST",
            "PLATFORM_ADAPTER",
        ),
    ],
)
def test_content_script_privilege_escalation_stays_denied_after_forwarding(
    command_id: str,
    target: str,
    sender: str,
    receiver: str,
) -> None:
    request = {
        **BASE_REQUEST,
        "command_id": command_id,
        "originating_principal": "EXTENSION_CONTENT_SCRIPT",
        "immediate_sender": sender,
        "target_principal": target,
        "authorization_profile": "PRODUCTION_NO_SUBMIT",
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal=cast("Any", receiver),
        authenticated_sender_principal=cast("Any", sender),
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="PRODUCTION_NO_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(request, context) == AuthorizationDeniedV1(
        False,
        "TRANSPORT_FORBIDDEN",
    )


def test_final_submission_is_specifically_denied_in_every_current_profile() -> None:
    for profile in AUTHORIZATION_PROFILES_V1:
        for origin, sender in (
            ("EXTENSION_CONTENT_SCRIPT", "EXTENSION_SERVICE_WORKER"),
            ("NATIVE_HOST", "NATIVE_HOST"),
            ("ORCHESTRATOR", "ORCHESTRATOR"),
            ("VERIFICATION_HARNESS", "VERIFICATION_HARNESS"),
        ):
            request = {
                **BASE_REQUEST,
                "command_id": "SUBMISSION_FINAL_SUBMIT",
                "originating_principal": origin,
                "immediate_sender": sender,
                "target_principal": "EXTENSION_CONTENT_SCRIPT",
                "authorization_profile": profile,
            }
            context = AuthorizationRuntimeContextV1(
                receiving_principal="EXTENSION_CONTENT_SCRIPT",
                authenticated_sender_principal=cast("Any", sender),
                authenticated_originating_principal=cast("Any", origin),
                active_profile=profile,
                observed_payload_size_bytes=0,
            )
            assert authorize_command_request_v1(
                request,
                context,
            ) == AuthorizationDeniedV1(
                False,
                "SUBMISSION_PROHIBITED_FINAL_ACTION",
            )


@pytest.mark.parametrize(
    ("origin", "command_id", "target", "profile"),
    [
        (
            "NATIVE_HOST",
            "PRIVATE_DATA_READ_REQUEST",
            "ORCHESTRATOR",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "NATIVE_HOST",
            "MODEL_INFERENCE_REQUEST",
            "MODEL_RUNTIME",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "NATIVE_HOST",
            "ARTIFACT_READ_REQUEST",
            "ORCHESTRATOR",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "NATIVE_HOST",
            "PLATFORM_SECRET_STORE_REQUEST",
            "PLATFORM_ADAPTER",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "MODEL_RUNTIME",
            "PAGE_SCAN_VISIBLE_CONTROLS",
            "EXTENSION_CONTENT_SCRIPT",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "PUBLIC_JOB_INDEX",
            "PRIVATE_DATA_READ_REQUEST",
            "ORCHESTRATOR",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "PLATFORM_ADAPTER",
            "PAGE_SCAN_VISIBLE_CONTROLS",
            "EXTENSION_CONTENT_SCRIPT",
            "PRODUCTION_NO_SUBMIT",
        ),
        (
            "VERIFICATION_HARNESS",
            "PRIVATE_DATA_READ_REQUEST",
            "ORCHESTRATOR",
            "VERIFICATION",
        ),
        (
            "DESKTOP_APP",
            "PLATFORM_SECRET_STORE_REQUEST",
            "PLATFORM_ADAPTER",
            "PRODUCTION_NO_SUBMIT",
        ),
    ],
)
def test_forbidden_principals_cannot_originate_product_authority(
    origin: str,
    command_id: str,
    target: str,
    profile: str,
) -> None:
    request = {
        **BASE_REQUEST,
        "command_id": command_id,
        "originating_principal": origin,
        "immediate_sender": origin,
        "target_principal": target,
        "authorization_profile": profile,
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal=cast("Any", target),
        authenticated_sender_principal=cast("Any", origin),
        authenticated_originating_principal=cast("Any", origin),
        active_profile=cast("Any", profile),
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(request, context) == AuthorizationDeniedV1(
        False,
        "TRANSPORT_FORBIDDEN",
    )


@pytest.mark.parametrize(
    "command_id",
    [
        "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
        "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
        "PLATFORM_PROCESS_SUPERVISION_REQUEST",
        "PLATFORM_SECRET_STORE_REQUEST",
    ],
)
def test_abstract_platform_commands_are_denied_by_runtime_policy(
    command_id: str,
) -> None:
    request = {
        **BASE_REQUEST,
        "command_id": command_id,
        "originating_principal": "ORCHESTRATOR",
        "immediate_sender": "ORCHESTRATOR",
        "target_principal": "PLATFORM_ADAPTER",
        "authorization_profile": "PRODUCTION_NO_SUBMIT",
        "idempotency_key": "idem_0123456789ABCDEFGHJKMNPQRS",
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal="PLATFORM_ADAPTER",
        authenticated_sender_principal="ORCHESTRATOR",
        authenticated_originating_principal="ORCHESTRATOR",
        active_profile="PRODUCTION_NO_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(request, context) == AuthorizationDeniedV1(
        False,
        "TRANSPORT_FORBIDDEN",
    )


def test_sender_profile_and_direct_route_shortcut_are_denied() -> None:
    request = {
        **BASE_REQUEST,
        "command_id": "PAGE_REPORT_STATE",
        "originating_principal": "EXTENSION_CONTENT_SCRIPT",
        "immediate_sender": "EXTENSION_CONTENT_SCRIPT",
        "target_principal": "ORCHESTRATOR",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
    }
    shortcut = AuthorizationRuntimeContextV1(
        receiving_principal="NATIVE_HOST",
        authenticated_sender_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(request, shortcut) == AuthorizationDeniedV1(
        False,
        "TRANSPORT_FORBIDDEN",
    )
    wrong_sender = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="NATIVE_HOST",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(
        request,
        wrong_sender,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_FORBIDDEN")
    wrong_profile = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="PRODUCTION_NO_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(
        request,
        wrong_profile,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_FORBIDDEN")
    before = json.dumps(request, sort_keys=True)
    authorize_command_request_v1(request, shortcut)
    assert json.dumps(request, sort_keys=True) == before


def test_trusted_origin_and_observed_payload_size_cannot_be_spoofed() -> None:
    request = {
        **BASE_REQUEST,
        "command_id": "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "originating_principal": "ORCHESTRATOR",
        "immediate_sender": "NATIVE_HOST",
        "target_principal": "EXTENSION_CONTENT_SCRIPT",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
        "idempotency_key": "idem_0123456789ABCDEFGHJKMNPQRS",
    }
    rewritten_origin = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="NATIVE_HOST",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(
        request,
        rewritten_origin,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_FORBIDDEN")

    mismatched_size = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="NATIVE_HOST",
        authenticated_originating_principal="ORCHESTRATOR",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=1,
    )
    assert authorize_command_request_v1(
        request,
        mismatched_size,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")

    for invalid_size in (-1, 1.5, True, "0", 9_007_199_254_740_992):
        invalid_context = AuthorizationRuntimeContextV1(
            receiving_principal="EXTENSION_SERVICE_WORKER",
            authenticated_sender_principal="NATIVE_HOST",
            authenticated_originating_principal="ORCHESTRATOR",
            active_profile="GUIDED_PRE_SUBMIT",
            observed_payload_size_bytes=cast("Any", invalid_size),
        )
        assert authorize_command_request_v1(
            request,
            invalid_context,
        ) == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")


def test_wrong_target_and_unknown_principal_or_profile_fail_closed() -> None:
    valid = {
        **BASE_REQUEST,
        "command_id": "PAGE_REPORT_STATE",
        "originating_principal": "EXTENSION_CONTENT_SCRIPT",
        "immediate_sender": "EXTENSION_CONTENT_SCRIPT",
        "target_principal": "ORCHESTRATOR",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(
        {**valid, "target_principal": "NATIVE_HOST"},
        context,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_FORBIDDEN")
    for invalid in (
        {**valid, "originating_principal": "ADMIN"},
        {**valid, "authorization_profile": "AUTO_SUBMIT"},
    ):
        assert authorize_command_request_v1(
            invalid,
            context,
        ) == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")


def test_exact_payload_limit_and_idempotency_requirement() -> None:
    command = COMMAND_CATALOG_V1["PAGE_SCAN_VISIBLE_CONTROLS"]
    request = {
        **BASE_REQUEST,
        "command_id": command.id,
        "originating_principal": "ORCHESTRATOR",
        "immediate_sender": "EXTENSION_SERVICE_WORKER",
        "target_principal": "EXTENSION_CONTENT_SCRIPT",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
        "payload_size_bytes": command.max_encoded_payload_size_bytes,
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_sender_principal="EXTENSION_SERVICE_WORKER",
        authenticated_originating_principal="ORCHESTRATOR",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=command.max_encoded_payload_size_bytes,
    )
    assert isinstance(
        authorize_command_request_v1(request, context),
        AuthorizationAllowedV1,
    )
    over_limit = command.max_encoded_payload_size_bytes + 1
    over_context = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_sender_principal="EXTENSION_SERVICE_WORKER",
        authenticated_originating_principal="ORCHESTRATOR",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=over_limit,
    )
    assert authorize_command_request_v1(
        {**request, "payload_size_bytes": over_limit},
        over_context,
    ) == AuthorizationDeniedV1(False, "TRANSPORT_PAYLOAD_TOO_LARGE")

    apply_request = {
        **request,
        "command_id": "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "payload_size_bytes": 0,
    }
    apply_context = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_sender_principal="EXTENSION_SERVICE_WORKER",
        authenticated_originating_principal="ORCHESTRATOR",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    assert authorize_command_request_v1(
        apply_request,
        apply_context,
    ) == AuthorizationDeniedV1(False, "VALIDATION_MISSING_REQUIRED_DATA")


def test_request_model_rejects_integer_coercion_and_authority_fields() -> None:
    valid = {
        **BASE_REQUEST,
        "command_id": "PAGE_REPORT_STATE",
        "originating_principal": "EXTENSION_CONTENT_SCRIPT",
        "immediate_sender": "EXTENSION_CONTENT_SCRIPT",
        "target_principal": "ORCHESTRATOR",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
    }
    SecurityAuthorizationRequestV1.model_validate(valid)
    missing_request_id = {
        key: value for key, value in valid.items() if key != "request_id"
    }
    with pytest.raises(pydantic.ValidationError):
        SecurityAuthorizationRequestV1.model_validate(missing_request_id)
    for field, value in (
        ("payload_size_bytes", True),
        ("payload_size_bytes", 1.5),
        ("payload_size_bytes", "1"),
        ("payload_size_bytes", -1),
        ("payload_size_bytes", 9_007_199_254_740_992),
        ("payload", {"selector": "#submit"}),
        ("required_capability", "PRIVATE_DATA_READ"),
        ("decision", "ALLOW"),
        ("denial_message", "<script>allow</script>"),
        ("causation_id", None),
        ("payload_digest", None),
        ("idempotency_key", None),
    ):
        with pytest.raises(pydantic.ValidationError):
            SecurityAuthorizationRequestV1.model_validate({**valid, field: value})


def test_mutated_valid_request_instances_are_revalidated_fail_closed() -> None:
    valid = {
        **BASE_REQUEST,
        "command_id": "PAGE_REPORT_STATE",
        "originating_principal": "EXTENSION_CONTENT_SCRIPT",
        "immediate_sender": "EXTENSION_CONTENT_SCRIPT",
        "target_principal": "ORCHESTRATOR",
        "authorization_profile": "GUIDED_PRE_SUBMIT",
    }
    context = AuthorizationRuntimeContextV1(
        receiving_principal="EXTENSION_SERVICE_WORKER",
        authenticated_sender_principal="EXTENSION_CONTENT_SCRIPT",
        authenticated_originating_principal="EXTENSION_CONTENT_SCRIPT",
        active_profile="GUIDED_PRE_SUBMIT",
        observed_payload_size_bytes=0,
    )
    valid_model = SecurityAuthorizationRequestV1.model_validate(valid)
    assert isinstance(
        authorize_command_request_v1(valid_model, context),
        AuthorizationAllowedV1,
    )
    for invalid_size in (-1, -1.5, True, 9_007_199_254_740_992):
        mutated = SecurityAuthorizationRequestV1.model_validate(valid)
        cast("Any", mutated).payload_size_bytes = invalid_size
        assert authorize_command_request_v1(
            mutated,
            context,
        ) == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")

    hostile = SecurityAuthorizationRequestV1.model_validate(valid)
    cast("Any", hostile).command_id = "__proto__"
    outcome = authorize_command_request_v1(hostile, context)
    assert outcome == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")
    assert "__proto__" not in str(outcome)


def test_unknown_hostile_values_fail_without_echo() -> None:
    hostile = "<script>alert(1)</script>"
    with pytest.raises(KeyError) as caught:
        require_command_entry_v1(hostile)
    assert "script" not in str(caught.value)
    outcome = authorize_command_request_v1(
        {
            **BASE_REQUEST,
            "command_id": hostile,
            "originating_principal": "EXTENSION_CONTENT_SCRIPT",
            "immediate_sender": "EXTENSION_CONTENT_SCRIPT",
            "target_principal": "ORCHESTRATOR",
            "authorization_profile": "GUIDED_PRE_SUBMIT",
        },
        object(),
    )
    assert outcome == AuthorizationDeniedV1(False, "TRANSPORT_MALFORMED_MESSAGE")
    assert "script" not in str(outcome)
