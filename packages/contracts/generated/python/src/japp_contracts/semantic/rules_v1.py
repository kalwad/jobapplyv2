"""GENERATED FILE - DO NOT EDIT BY HAND.

Regenerate with: pnpm generate:contracts

Finite semantic-contract evaluators derived from the reviewed
packages/contracts/catalog/semantic-rules.v1.json data source.

Structural validation must succeed first. Catalog content is inert and no
expression, path, operator, or code is interpreted.
"""

import re
from collections.abc import Callable
from typing import Final, NamedTuple, cast


class SemanticRuleEntryV1(NamedTuple):
    """One immutable reviewed semantic-rule binding."""

    rule_id: str
    rule_version: str
    schema_ref: str
    rule_kind: str
    failure_error_code: str


SEMANTIC_RULES_V1: Final[tuple[SemanticRuleEntryV1, ...]] = (
    SemanticRuleEntryV1(
        rule_id="APPLICATION_SESSION_CONSISTENCY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:application-session:v1",
        rule_kind="APPLICATION_SESSION_CONSISTENCY",
        failure_error_code="VALIDATION_CONSTRAINT_VIOLATION",
    ),
    SemanticRuleEntryV1(
        rule_id="APPLICATION_SESSION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:application-session:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="ATOMIC_CLAIM_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:resume:atomic-claim:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="ATOMIC_CLAIM_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:resume:atomic-claim:v1",
        rule_kind="ATOMIC_CLAIM_INTEGRITY",
        failure_error_code="MODEL_VALIDATION_FAILED",
    ),
    SemanticRuleEntryV1(
        rule_id="ATS_VARIANT_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:ats:variant-identity:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="ATS_VARIANT_SCOPE",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:ats:variant-identity:v1",
        rule_kind="ATS_VARIANT_SCOPE",
        failure_error_code="UNSUPPORTED_SITE_PATTERN",
    ),
    SemanticRuleEntryV1(
        rule_id="BENCHMARK_CASE_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:case:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="BENCHMARK_CASE_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:case:v1",
        rule_kind="BENCHMARK_CASE_INTEGRITY",
        failure_error_code="BENCHMARK_INVALID_CORPUS",
    ),
    SemanticRuleEntryV1(
        rule_id="BENCHMARK_RESULT_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:result:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="BENCHMARK_RESULT_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:result:v1",
        rule_kind="BENCHMARK_RESULT_INTEGRITY",
        failure_error_code="BENCHMARK_THRESHOLD_FAILED",
    ),
    SemanticRuleEntryV1(
        rule_id="DRIVER_RESULT_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:driver-result:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="DRIVER_VERIFIED_EVIDENCE",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:driver-result:v1",
        rule_kind="DRIVER_VERIFIED_EVIDENCE",
        failure_error_code="SITE_VALIDATION_REJECTED",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_ADDRESS_IDENTITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-address:v1",
        rule_kind="FIELD_ADDRESS_IDENTITY",
        failure_error_code="SITE_AMBIGUOUS_CONTROL",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_ADDRESS_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-address:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_DECISION_AUTHORITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-decision:v1",
        rule_kind="FIELD_DECISION_AUTHORITY",
        failure_error_code="SENSITIVE_CONFIRMATION_REQUIRED",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_DECISION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-decision:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_DESCRIPTOR_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-descriptor:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="FIELD_DESCRIPTOR_OBSERVATION",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:field-descriptor:v1",
        rule_kind="FIELD_DESCRIPTOR_OBSERVATION",
        failure_error_code="VALIDATION_CONSTRAINT_VIOLATION",
    ),
    SemanticRuleEntryV1(
        rule_id="GATE_DECISION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:gate:decision:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="GATE_DECISION_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:gate:decision:v1",
        rule_kind="GATE_DECISION_INTEGRITY",
        failure_error_code="GATE_THRESHOLD_FAILED",
    ),
    SemanticRuleEntryV1(
        rule_id="GATE_EVIDENCE_COMPLETENESS",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:gate:evidence-bundle:v1",
        rule_kind="GATE_EVIDENCE_COMPLETENESS",
        failure_error_code="GATE_EVIDENCE_MISSING",
    ),
    SemanticRuleEntryV1(
        rule_id="GATE_EVIDENCE_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:gate:evidence-bundle:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="GUIDED_RUN_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:guided-run-mode:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="GUIDED_RUN_SAFETY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:guided-run-mode:v1",
        rule_kind="GUIDED_RUN_SAFETY",
        failure_error_code="SENSITIVE_AUTOMATION_PROHIBITED",
    ),
    SemanticRuleEntryV1(
        rule_id="HOLDOUT_MANIFEST_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:holdout-manifest:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="HOLDOUT_MANIFEST_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:benchmark:holdout-manifest:v1",
        rule_kind="HOLDOUT_MANIFEST_INTEGRITY",
        failure_error_code="BENCHMARK_INVALID_HOLDOUT_STATE",
    ),
    SemanticRuleEntryV1(
        rule_id="LAYOUT_MEASUREMENT_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:rendering:layout-measurement:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="LAYOUT_MEASUREMENT_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:rendering:layout-measurement:v1",
        rule_kind="LAYOUT_MEASUREMENT_INTEGRITY",
        failure_error_code="RENDERING_FAILURE",
    ),
    SemanticRuleEntryV1(
        rule_id="NAVIGATION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:navigation-record:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="NAVIGATION_SAFETY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:navigation-record:v1",
        rule_kind="NAVIGATION_SAFETY",
        failure_error_code="SITE_UNCERTAIN_TRANSITION",
    ),
    SemanticRuleEntryV1(
        rule_id="PAGE_READINESS_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:page-readiness-proof:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="PAGE_READINESS_INTEGRITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:session:page-readiness-proof:v1",
        rule_kind="PAGE_READINESS_INTEGRITY",
        failure_error_code="SITE_VALIDATION_REJECTED",
    ),
    SemanticRuleEntryV1(
        rule_id="RECONCILIATION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:reconciliation-inventory:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="RECONCILIATION_READINESS",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:form:reconciliation-inventory:v1",
        rule_kind="RECONCILIATION_READINESS",
        failure_error_code="VALIDATION_CONSTRAINT_VIOLATION",
    ),
    SemanticRuleEntryV1(
        rule_id="RESUME_PLAN_EVIDENCE",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:resume:plan:v1",
        rule_kind="RESUME_PLAN_EVIDENCE",
        failure_error_code="MODEL_VALIDATION_FAILED",
    ),
    SemanticRuleEntryV1(
        rule_id="RESUME_PLAN_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:resume:plan:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_CERTIFICATION_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:certification-record:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_CERTIFICATION_SCOPE",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:certification-record:v1",
        rule_kind="WORKDAY_CERTIFICATION_SCOPE",
        failure_error_code="BENCHMARK_INVALID_COMPARISON_EVIDENCE",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_STEP_BOUNDARY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:step-identity:v1",
        rule_kind="WORKDAY_STEP_BOUNDARY",
        failure_error_code="SENSITIVE_AUTOMATION_PROHIBITED",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_STEP_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:step-identity:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_TENANT_IDENTITY",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:tenant-fingerprint:v1",
        rule_kind="WORKDAY_TENANT_IDENTITY",
        failure_error_code="SITE_UNSUPPORTED_STRUCTURE",
    ),
    SemanticRuleEntryV1(
        rule_id="WORKDAY_TENANT_INERT_TEXT",
        rule_version="1.0.0",
        schema_ref="urn:japp:schema:workday:tenant-fingerprint:v1",
        rule_kind="INERT_TEXT_SAFETY",
        failure_error_code="TRANSPORT_MALFORMED_MESSAGE",
    ),
)
"""Immutable reviewed semantic-rule bindings, sorted by rule_id."""

def _record(value: object) -> dict[str, object] | None:
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return cast("dict[str, object]", value)
    return None


def _member(value: object, name: str) -> object | None:
    record = _record(value)
    return None if record is None else record.get(name)


def _text(value: object, name: str) -> str | None:
    candidate = _member(value, name)
    return candidate if isinstance(candidate, str) else None


def _number(value: object, name: str) -> int | float | None:
    candidate = _member(value, name)
    if type(candidate) is int:
        return candidate
    if type(candidate) is float:
        return candidate
    return None


def _flag(value: object, name: str) -> bool | None:
    candidate = _member(value, name)
    return candidate if type(candidate) is bool else None


def _items(value: object, name: str) -> list[object]:
    candidate = _member(value, name)
    return cast("list[object]", candidate) if isinstance(candidate, list) else []


def _object_member(value: object, name: str) -> dict[str, object] | None:
    return _record(_member(value, name))


def _unique_strings(values: list[object]) -> bool:
    return all(isinstance(value, str) for value in values) and len(
        cast("set[str]", set(values))
    ) == len(values)


def _unique_field(values: list[object], name: str) -> bool:
    selected: list[object] = [_text(value, name) for value in values]
    return all(value is not None for value in selected) and _unique_strings(selected)


def _strictly_sorted_strings(values: list[object]) -> bool:
    return all(isinstance(value, str) for value in values) and all(
        cast("str", values[index - 1]) < cast("str", values[index])
        for index in range(1, len(values))
    )


def _strictly_sorted_field(values: list[object], name: str) -> bool:
    selected: list[object] = [_text(value, name) for value in values]
    return _strictly_sorted_strings(selected)


def _unique_number_field(values: list[object], name: str) -> bool:
    selected = [_number(value, name) for value in values]
    return all(value is not None for value in selected) and len(
        set(cast("list[int | float]", selected))
    ) == len(selected)


def _all_flags(value: object, names: tuple[str, ...]) -> bool:
    return all(_flag(value, name) is True for name in names)


def _utc_timestamp_key(value: object, name: str) -> str | None:
    candidate = _text(value, name)
    if candidate is None:
        return None
    match = re.fullmatch(
        r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z",
        candidate,
    )
    if match is None:
        return None
    return match.group(1) + "." + (match.group(2) or "").ljust(9, "0")


def _timestamp_not_before(
    value: object,
    later_name: str,
    earlier_name: str,
) -> bool:
    later = _utc_timestamp_key(value, later_name)
    earlier = _utc_timestamp_key(value, earlier_name)
    return later is not None and earlier is not None and later >= earlier


def _inert_text_safe(value: object, depth: int = 0) -> bool:
    if depth > 64:
        return False
    if isinstance(value, str):
        lower = value.lower()
        return not (
            value.startswith("/")
            or re.match(r"^[A-Za-z]:[\\/]", value) is not None
            or "<script" in lower
            or "javascript:" in lower
            or "xpath:" in lower
            or "document." in lower
            or "window." in lower
            or "onload=" in lower
            or "onclick=" in lower
            or "password=" in lower
            or "credential=" in lower
            or "token=" in lower
            or "begin private key" in lower
            or "$(" in value
            or "=>" in value
            or "../" in value
            or "..\\" in value
        )
    if isinstance(value, list):
        return all(_inert_text_safe(item, depth + 1) for item in value)
    record = _record(value)
    return record is None or all(
        _inert_text_safe(item, depth + 1) for item in record.values()
    )


def _field_address_identity(value: object) -> bool:
    signals: list[object] = [
        _text(value, "route_signature"),
        _text(value, "application_root_fingerprint"),
        _text(value, "accessible_name_fingerprint"),
        _text(value, "attribute_fingerprint"),
        _text(value, "option_fingerprint"),
        "SECTION_PATH" if _items(value, "section_path") else None,
        "REPEATER_PATH" if _items(value, "repeater_path") else None,
    ]
    return len([signal for signal in signals if signal is not None]) >= 2 and (
        _unique_field(_items(value, "repeater_path"), "stable_item_key")
    )


def _field_descriptor_observation(value: object) -> bool:
    address = _object_member(value, "address")
    label = _object_member(value, "label")
    description = _object_member(value, "description")
    options = _items(value, "options")
    return (
        address is not None
        and _field_address_identity(address)
        and _number(value, "observed_dom_generation")
        == _number(address, "observed_dom_generation")
        and _flag(label, "untrusted") is True
        and (description is None or _flag(description, "untrusted") is True)
        and _unique_field(options, "value_digest")
        and all(
            _flag(_object_member(option, "label"), "untrusted") is True
            for option in options
        )
    )


def _field_decision_authority(value: object) -> bool:
    final_decision = _text(value, "final_decision")
    source = _text(value, "value_source_type")
    policy = _text(value, "policy_decision")
    sensitivity = _text(value, "sensitivity_class")
    confirmation = _text(value, "confirmation_state")
    classification = _number(value, "classification_confidence") or 0
    confidence = _number(value, "value_confidence") or 0
    reasons = _items(value, "reason_codes")
    confirmation_required = (
        policy == "REQUIRE_CONFIRMATION"
        or sensitivity in {"SENSITIVE", "SECRET"}
    )
    confirmation_valid = confirmation == "VALID" and isinstance(
        _member(value, "user_confirmation_ref"), str
    )
    fill_sources = {
        "ANSWER_POLICY",
        "APPROVED_DOCUMENT",
        "DETERMINISTIC_DERIVATION",
        "USER_CONFIRMATION",
        "USER_RECORD",
    }
    proposal_sources = fill_sources | {"MODEL_PROPOSAL"}
    if not _unique_strings(reasons):
        return False
    if confirmation == "VALID" and not confirmation_valid:
        return False
    if policy in {"DENY", "UNSUPPORTED"} and final_decision in {"FILL", "PROPOSE"}:
        return False
    if source in {"MODEL_PROPOSAL", "NONE"} and final_decision == "FILL":
        return False
    if confirmation in {"EXPIRED", "MISSING", "REVOKED"}:
        return final_decision == "PAUSE_FOR_CONFIRMATION"
    if classification < 0.5 and "LOW_CLASSIFICATION_CONFIDENCE" not in reasons:
        return False
    if confidence < 0.5 and "LOW_VALUE_CONFIDENCE" not in reasons:
        return False
    if final_decision == "PROPOSE":
        return source in proposal_sources and isinstance(
            _member(value, "value_source_ref"), str
        )
    if final_decision != "FILL":
        return True
    return (
        source in fill_sources
        and isinstance(_member(value, "value_source_ref"), str)
        and classification >= 0.75
        and confidence >= 0.75
        and (
            policy == "PERMIT"
            or (policy == "REQUIRE_CONFIRMATION" and confirmation_valid)
        )
        and (not confirmation_required or confirmation_valid)
    )


def _driver_verified_evidence(value: object) -> bool:
    address = _object_member(value, "field_address")
    preconditions = _object_member(value, "preconditions")
    intended = _object_member(value, "intended_value")
    immediate = _object_member(value, "observed_value_immediate")
    settled = _object_member(value, "observed_value_settled")
    if (
        address is None
        or not _field_address_identity(address)
        or preconditions is None
        or intended is None
        or immediate is None
        or settled is None
        or _text(value, "session_id") != _text(address, "session_id")
        or _number(value, "starting_dom_generation")
        != _number(address, "observed_dom_generation")
        or not _unique_strings(_items(value, "conditional_field_ids"))
    ):
        return False
    uncertain = (
        _text(value, "resolution_result") != "UNIQUE"
        or _text(value, "site_acceptance") == "UNKNOWN"
    )
    if uncertain and _flag(value, "safe_retry_allowed") is True:
        return False
    if _text(value, "outcome") != "VERIFIED":
        return True
    return (
        _text(value, "resolution_result") == "UNIQUE"
        and _all_flags(
            preconditions,
            ("visible", "enabled", "generation_matched", "policy_permitted"),
        )
        and _text(intended, "semantic_digest")
        == _text(immediate, "semantic_digest")
        == _text(settled, "semantic_digest")
        and _text(intended, "presence")
        == _text(immediate, "presence")
        == _text(settled, "presence")
        and _flag(value, "persistence_verified") is True
        and _text(value, "site_acceptance") == "ACCEPTED"
        and _number(value, "starting_dom_generation")
        == _number(value, "settled_dom_generation")
        and not _items(value, "validation_message_digests")
    )


def _reconciliation_readiness(value: object) -> bool:
    inventory = _items(value, "items")
    counts = _object_member(value, "counts")
    if (
        counts is None
        or not _unique_field(inventory, "item_id")
        or _number(counts, "total") != len(inventory)
    ):
        return False
    categories = {
        "verified_filled": "VERIFIED_FILLED",
        "needs_review": "NEEDS_REVIEW",
        "blocked_sensitive": "BLOCKED_SENSITIVE",
        "unsupported_or_skipped": "UNSUPPORTED_OR_SKIPPED",
        "required_unresolved": "REQUIRED_UNRESOLVED",
        "page_changed_value": "PAGE_CHANGED_VALUE",
    }
    for count_name, category in categories.items():
        if _number(counts, count_name) != len(
            [item for item in inventory if _text(item, "category") == category]
        ):
            return False
    stale = len(
        [item for item in inventory if _text(item, "document_state") == "STALE"]
    )
    unconfirmed = len(
        [
            item
            for item in inventory
            if _text(item, "confirmation_state") in {"EXPIRED", "MISSING", "REVOKED"}
        ]
    )
    uncertain = len(
        [item for item in inventory if _flag(item, "mandatory_uncertain") is True]
    )
    changed = len(
        [item for item in inventory if _flag(item, "changed_value") is True]
    )
    if (
        _number(counts, "page_changed_value") != changed
        or _number(counts, "stale_document") != stale
        or _number(counts, "unconfirmed_consequential") != unconfirmed
        or _number(counts, "mandatory_uncertain") != uncertain
    ):
        return False
    for item in inventory:
        if (
            (_flag(item, "changed_value") is True)
            != (_text(item, "category") == "PAGE_CHANGED_VALUE")
        ):
            return False
        if (
            _flag(item, "required") is True
            and _flag(item, "visible") is True
            and _flag(item, "enabled") is True
            and _text(item, "category")
            not in {
                "VERIFIED_FILLED",
                "REQUIRED_UNRESOLVED",
                "BLOCKED_SENSITIVE",
            }
        ):
            return False
    if _text(value, "readiness") != "READY":
        return True
    return (
        _number(value, "page_generation") == _number(value, "proof_generation")
        and all(
            _number(counts, name) == 0
            for name in (
                "required_unresolved",
                "blocked_sensitive",
                "page_changed_value",
                "stale_document",
                "unconfirmed_consequential",
                "mandatory_uncertain",
            )
        )
    )


def _ats_variant_scope(value: object) -> bool:
    return (
        _text(value, "ats_family") != "UNKNOWN"
        and _text(value, "session_mode") != "UNKNOWN"
        and _text(value, "route_page_family") not in {"ALL", "UNIVERSAL", "UNKNOWN"}
    )


def _workday_tenant_identity(value: object) -> bool:
    controls = _items(value, "control_family_inventory")
    return (
        bool(controls)
        and _unique_strings(controls)
        and _text(value, "hostname_family") != "UNKNOWN"
        and _text(value, "candidate_session_mode") != "UNKNOWN"
        and _text(value, "route_family") not in {"ALL", "UNIVERSAL", "UNKNOWN"}
        and _text(value, "page_sequence_family")
        not in {"ALL", "UNIVERSAL", "UNKNOWN"}
    )


def _workday_step_boundary(value: object) -> bool:
    signals = _items(value, "recognition_signals")
    if (
        len(signals) < 2
        or not _unique_field(signals, "kind")
        or len({_text(signal, "kind") for signal in signals}) < 2
    ):
        return False
    expected = {
        "GUEST_APPLICATION": "ORDINARY_APPLICATION",
        "AUTHENTICATED_APPLICATION": "ORDINARY_APPLICATION",
        "LOGIN": "PROTECTED_AUTHENTICATION",
        "ACCOUNT_CREATION": "PROTECTED_AUTHENTICATION",
        "EMAIL_VERIFICATION": "PROTECTED_AUTHENTICATION",
        "MFA": "PROTECTED_AUTHENTICATION",
        "EXPIRED_SESSION": "PROTECTED_AUTHENTICATION",
        "CAPTCHA": "PROTECTED_HUMAN_VERIFICATION",
        "LEGAL_CONSENT_BOUNDARY": "PROTECTED_LEGAL_OR_CONSENT",
        "FINAL_REVIEW": "FINAL_REVIEW_BOUNDARY",
        "DUPLICATE_APPLICATION": "UNKNOWN_OR_UNSUPPORTED",
        "UNKNOWN_UNSUPPORTED": "UNKNOWN_OR_UNSUPPORTED",
    }
    step_family = _text(value, "step_family")
    return (
        step_family is not None
        and expected.get(step_family) == _text(value, "boundary_class")
    )


def _page_readiness_integrity(value: object) -> bool:
    step = _object_member(value, "step_identity")
    counts = _object_member(value, "blocking_counts")
    if (
        step is None
        or counts is None
        or not _workday_step_boundary(step)
        or _text(value, "session_id") != _text(step, "session_id")
        or _number(value, "page_generation")
        != _number(step, "observed_dom_generation")
    ):
        return False
    if _text(value, "readiness") != "READY":
        return True
    next_control = _object_member(value, "next_control")
    return (
        _text(step, "step_family") != "UNKNOWN_UNSUPPORTED"
        and _text(step, "boundary_class") == "ORDINARY_APPLICATION"
        and _text(value, "site_validation_status") == "ACCEPTED"
        and all(
            _number(counts, name) == 0
            for name in (
                "unresolved_count",
                "changed_value_count",
                "stale_document_count",
                "sensitive_confirmation_count",
                "mandatory_uncertain_count",
            )
        )
        and next_control is not None
        and _text(next_control, "resolution") == "UNIQUE"
    )


def _navigation_safety(value: object) -> bool:
    source = _object_member(value, "source_step_identity")
    control = _object_member(value, "navigation_control")
    postconditions = _object_member(value, "postconditions")
    destination = _object_member(value, "observed_destination_identity")
    allowed = _items(value, "allowed_destination_families")
    if (
        source is None
        or control is None
        or postconditions is None
        or not _workday_step_boundary(source)
        or _text(value, "session_id") != _text(source, "session_id")
        or _number(value, "source_page_generation")
        != _number(source, "observed_dom_generation")
        or _text(control, "resolution") != "UNIQUE"
        or not _unique_strings(allowed)
    ):
        return False
    expected = _text(value, "expected_destination_family")
    if expected is not None and expected not in allowed:
        return False
    outcome = _text(value, "outcome")
    if outcome in {"UNCERTAIN_TRANSITION", "PAUSED_BOUNDARY"} and (
        _flag(value, "safe_retry_allowed") is True
    ):
        return False
    if destination is not None and (
        not _workday_step_boundary(destination)
        or _text(value, "session_id") != _text(destination, "session_id")
    ):
        return False
    if outcome == "PAUSED_BOUNDARY" and (
        destination is None
        or _text(destination, "boundary_class") == "ORDINARY_APPLICATION"
    ):
        return False
    if (
        destination is not None
        and _text(destination, "boundary_class") != "ORDINARY_APPLICATION"
    ):
        return outcome == "PAUSED_BOUNDARY"
    if outcome != "VERIFIED_TRANSITION":
        return True
    return (
        destination is not None
        and _text(source, "boundary_class") == "ORDINARY_APPLICATION"
        and _text(destination, "step_family") in allowed
        and (
            expected is None
            or expected == _text(destination, "step_family")
        )
        and _number(value, "observed_resulting_generation") is not None
        and _number(value, "observed_resulting_generation")
        == _number(destination, "observed_dom_generation")
        and _number(value, "observed_resulting_generation")
        != _number(value, "source_page_generation")
        and _all_flags(
            postconditions,
            (
                "source_generation_changed",
                "destination_recognized",
                "source_control_absent_or_inactive",
            ),
        )
    )


def _guided_run_safety(value: object) -> bool:
    snapshots = _object_member(value, "snapshot_readiness")
    if snapshots is None:
        return False
    allowed = (
        _text(value, "page_eligibility") == "CERTIFIED_APPLICATION_PAGE"
        and all(
            _text(snapshots, name) == "READY"
            for name in ("profile", "document", "answer_policy")
        )
        and _flag(value, "visible_cancel_control") is True
        and _text(value, "revocation_state") == "ACTIVE"
    )
    if _text(value, "start_permission") == "START_ALLOWED" and not allowed:
        return False
    if (
        _text(value, "revocation_state") != "ACTIVE"
        and _text(value, "start_permission") != "START_BLOCKED"
    ):
        return False
    if _text(value, "start_policy") != "AUTO_START_ON_OPEN":
        return True
    return (
        _text(value, "run_kind") == "GUIDED_PRE_SUBMIT"
        and isinstance(_member(value, "prior_opt_in_ref"), str)
        and isinstance(_member(value, "certified_pattern_ref"), str)
        and isinstance(_member(value, "cancelable_start_ref"), str)
        and allowed
    )


def _application_session_consistency(value: object) -> bool:
    step = _object_member(value, "current_step")
    ats = _object_member(value, "ats_variant")
    mode = _object_member(value, "guided_run_mode")
    tenant = _object_member(value, "workday_tenant_fingerprint")
    if (
        step is None
        or ats is None
        or mode is None
        or not _ats_variant_scope(ats)
        or not _guided_run_safety(mode)
        or not _workday_step_boundary(step)
        or (tenant is not None and not _workday_tenant_identity(tenant))
        or _text(value, "session_id") != _text(step, "session_id")
        or _number(value, "current_page_generation")
        != _number(step, "observed_dom_generation")
        or (tenant is not None and _text(ats, "ats_family") != "WORKDAY")
        or not _timestamp_not_before(value, "updated_at", "created_at")
    ):
        return False
    lifecycle = _text(value, "lifecycle_state")
    if lifecycle in {"PAUSED", "CANCELED"} and not isinstance(
        _member(value, "pause_or_cancel_reason"), str
    ):
        return False
    return not (
        _text(mode, "start_permission") == "START_ALLOWED"
        and (
            lifecycle != "ACTIVE"
            or _text(value, "revalidation_state") != "CURRENT"
        )
    )


def _workday_certification_scope(value: object) -> bool:
    tenant = _object_member(value, "tenant_fingerprint")
    metrics = _object_member(value, "metrics")
    routes = _items(value, "route_page_sequence")
    controls = _items(value, "control_families")
    if (
        tenant is None
        or metrics is None
        or not _workday_tenant_identity(tenant)
        or not _unique_strings(routes)
        or not _unique_strings(controls)
        or _text(value, "locale") != _text(tenant, "locale")
        or _text(value, "session_mode") != _text(tenant, "candidate_session_mode")
        or _text(value, "adapter_version") != _text(tenant, "adapter_version")
        or not all(
            control in _items(tenant, "control_family_inventory")
            for control in controls
        )
        or any(str(route) in {"ALL", "UNIVERSAL"} for route in routes)
    ):
        return False
    if _text(value, "certification_state") != "CERTIFIED":
        return True
    return (
        _text(value, "measured_scope_digest")
        == _text(value, "certified_scope_digest")
        and _text(tenant, "hostname_family") != "UNKNOWN"
        and _text(tenant, "candidate_session_mode") != "UNKNOWN"
        and (_number(metrics, "case_count") or 0) > 0
        and bool(_items(value, "evidence_report_refs"))
    )


def _benchmark_case_integrity(value: object) -> bool:
    return (
        _unique_field(_items(value, "thresholds"), "metric_id")
        and _unique_field(_items(value, "input_artifacts"), "artifact_ref")
        and _unique_field(_items(value, "input_artifacts"), "artifact_digest")
        and _unique_strings(_items(value, "applicable_platform_profiles"))
    )


def _benchmark_result_integrity(value: object) -> bool:
    metrics = _items(value, "metric_results")
    failure_errors = _items(value, "failure_error_codes")
    completeness = _text(value, "completeness_state")
    environment = _text(value, "environment_match_state")
    hashes = _text(value, "hash_state")
    holdout = _text(value, "holdout_state")
    if (
        not _unique_field(metrics, "metric_id")
        or _text(value, "case_threshold_set_digest")
        != _text(value, "evaluated_threshold_set_digest")
        or not all(
            _text(metric, "threshold_digest")
            == _text(value, "case_threshold_set_digest")
            for metric in metrics
        )
        or not _timestamp_not_before(value, "ended_at", "started_at")
    ):
        return False
    comparable = (
        completeness == "COMPLETE"
        and environment == "MATCH"
        and hashes == "MATCH"
        and holdout in {"VALID", "NOT_APPLICABLE"}
    )
    if _flag(value, "comparable") is not comparable:
        return False
    outcome = _text(value, "overall_outcome")
    if outcome == "PASS":
        return (
            comparable
            and not failure_errors
            and all(_flag(metric, "passed") is True for metric in metrics)
        )
    if outcome == "FAIL":
        return (
            not comparable
            or bool(failure_errors)
            or any(_flag(metric, "passed") is False for metric in metrics)
        )
    return True


def _holdout_manifest_integrity(value: object) -> bool:
    case_ids = _items(value, "case_ids")
    schema_versions = _items(value, "schema_versions")
    categories = _items(value, "category_counts")
    files = _items(value, "files")
    category_counts = [_number(item, "count") for item in categories]
    file_counts = [_number(item, "case_count") for item in files]
    if any(count is None for count in category_counts + file_counts):
        return False
    category_total = sum(cast("list[int | float]", category_counts))
    file_total = sum(cast("list[int | float]", file_counts))
    return (
        _strictly_sorted_strings(case_ids)
        and _strictly_sorted_field(schema_versions, "schema_ref")
        and _strictly_sorted_field(categories, "category")
        and _strictly_sorted_field(files, "file_id")
        and _unique_field(files, "content_digest")
        and _number(value, "case_count") == len(case_ids)
        and category_total == len(case_ids)
        and file_total == len(case_ids)
        and _flag(value, "synthetic_only") is True
        and (
            _text(value, "storage_policy") == "ENCRYPTED_BUNDLE_REFERENCE"
        )
        is (_object_member(value, "encrypted_bundle") is not None)
    )


def _gate_evidence_completeness(value: object) -> bool:
    inventory = _object_member(value, "completeness_inventory")
    results = _items(value, "benchmark_result_refs")
    if (
        inventory is None
        or not _unique_strings(results)
        or not _unique_strings(_items(value, "raw_artifact_report_digests"))
        or not _unique_strings(_items(value, "manual_inspection_evidence_refs"))
        or _number(inventory, "present_benchmark_count") != len(results)
    ):
        return False
    if _text(value, "bundle_state") != "COMPLETE":
        return True
    return (
        _number(inventory, "required_benchmark_count") == len(results)
        and _all_flags(
            inventory,
            (
                "corpus_valid",
                "holdout_valid",
                "raw_artifacts_complete",
                "manual_inspection_complete",
                "independent_review_complete",
                "owner_decision_complete",
            ),
        )
        and (
            _text(inventory, "owner_decision_requirement") == "REQUIRED"
        )
        is isinstance(_member(value, "owner_decision_ref"), str)
    )


def _gate_decision_integrity(value: object) -> bool:
    summary = _object_member(value, "threshold_evidence_summary")
    if (
        summary is None
        or not _unique_strings(_items(value, "reason_codes"))
        or not _unique_strings(_items(value, "error_codes"))
    ):
        return False
    if _text(value, "decision") == "REDESIGN_REQUIRED" and not isinstance(
        _member(value, "redesign_adr_ref"), str
    ):
        return False
    if _text(value, "decision") != "PASS":
        return True
    return (
        _all_flags(
            summary,
            (
                "evidence_complete",
                "required_benchmark_results_complete",
                "thresholds_passed",
                "corpus_valid",
                "holdout_valid",
            ),
        )
        and _text(value, "independent_review_state") == "COMPLETE"
        and _text(value, "owner_decision_state") in {"COMPLETE", "NOT_REQUIRED"}
        and not _items(value, "error_codes")
    )


def _resume_plan_evidence(value: object) -> bool:
    requirements = _items(value, "ordered_requirements")
    assignments = _items(value, "evidence_assignments")
    gaps = _items(value, "unsupported_gap_refs")
    budget = _object_member(value, "budget")
    if (
        budget is None
        or not _unique_field(requirements, "requirement_ref")
        or not _unique_number_field(requirements, "priority")
        or not _unique_field(assignments, "requirement_ref")
        or not _unique_strings(gaps)
        or not _unique_strings(_items(value, "locked_content_refs"))
        or (_number(budget, "section_word_budget") or 0)
        > (_number(budget, "global_word_budget") or 0)
    ):
        return False
    by_id = {
        requirement_ref: item
        for item in requirements
        if (requirement_ref := _text(item, "requirement_ref")) is not None
    }
    assigned_requirement_refs = {
        assignment_ref
        for assignment in assignments
        if (assignment_ref := _text(assignment, "requirement_ref")) is not None
    }
    gap_requirement_refs = {
        gap for gap in gaps if isinstance(gap, str)
    }
    for assignment in assignments:
        assignment_ref = _text(assignment, "requirement_ref")
        requirement = (
            None if assignment_ref is None else by_id.get(assignment_ref)
        )
        if (
            requirement is None
            or _flag(requirement, "supported") is not True
            or not _unique_strings(_items(assignment, "evidence_refs"))
        ):
            return False
    for requirement in requirements:
        requirement_ref = _text(requirement, "requirement_ref")
        supported = _flag(requirement, "supported")
        if (
            requirement_ref is None
            or supported is None
            or (requirement_ref in assigned_requirement_refs) is not supported
            or (requirement_ref in gap_requirement_refs) is supported
        ):
            return False
    return all(
        by_id.get(str(gap)) is not None
        and _flag(by_id[str(gap)], "supported") is False
        for gap in gaps
    )


def _atomic_claim_integrity(value: object) -> bool:
    status = _text(value, "verification_status")
    eligible = _flag(value, "release_eligible")
    if (
        not _unique_strings(_items(value, "evidence_refs"))
        or not _unique_strings(_items(value, "rejection_error_codes"))
        or _flag(value, "canonical_evidence_mutation") is not False
        or (eligible is True and status != "SUPPORTED")
    ):
        return False
    if status == "SUPPORTED":
        return bool(_items(value, "evidence_refs")) and _text(
            value, "user_action"
        ) == "NONE"
    if status == "PARTIALLY_SUPPORTED":
        return eligible is False and _text(value, "user_action") == "EDIT_AND_APPROVE"
    return eligible is False and _text(value, "user_action") != "NONE"


def _layout_measurement_integrity(value: object) -> bool:
    bounds = _items(value, "page_content_bounds")
    fonts = _items(value, "controlled_fonts")
    missing = _items(value, "missing_font_families")
    dimensions = _object_member(value, "page_dimensions")
    page_count = _number(value, "page_count")
    if (
        dimensions is None
        or page_count is None
        or len(bounds) != page_count
        or not _unique_number_field(bounds, "page_number")
        or not all(
            _number(bound, "page_number") == index
            for index, bound in enumerate(bounds, start=1)
        )
        or not _unique_field(fonts, "font_family")
        or not _unique_strings(missing)
    ):
        return False
    page_width = _number(dimensions, "width_points")
    page_height = _number(dimensions, "height_points")
    bounds_within_page = (
        page_width is not None
        and page_height is not None
        and all(
            (x := _number(bound, "x")) is not None
            and (y := _number(bound, "y")) is not None
            and (width := _number(bound, "width")) is not None
            and (height := _number(bound, "height")) is not None
            and x + width <= page_width
            and y + height <= page_height
            for bound in bounds
        )
    )
    accepted = (
        _flag(value, "renderer_succeeded") is True
        and (page_count or 0) >= 1
        and _flag(value, "overflow_detected") is False
        and _flag(value, "clipping_detected") is False
        and _text(value, "extraction_order_result") == "MATCH"
        and bounds_within_page
        and not missing
        and not _items(value, "error_reason_codes")
    )
    result = _text(value, "layout_result")
    if result == "ACCEPTED":
        return accepted
    if result == "RENDER_FAILED":
        return (
            _flag(value, "renderer_succeeded") is False
            and bool(_items(value, "error_reason_codes"))
        )
    return (page_count or 0) >= 1 and _flag(value, "renderer_succeeded") is True


RuleEvaluator = Callable[[object], bool]
RULE_EVALUATORS: Final[dict[str, RuleEvaluator]] = {
    "APPLICATION_SESSION_CONSISTENCY": _application_session_consistency,
    "ATOMIC_CLAIM_INTEGRITY": _atomic_claim_integrity,
    "ATS_VARIANT_SCOPE": _ats_variant_scope,
    "BENCHMARK_CASE_INTEGRITY": _benchmark_case_integrity,
    "BENCHMARK_RESULT_INTEGRITY": _benchmark_result_integrity,
    "DRIVER_VERIFIED_EVIDENCE": _driver_verified_evidence,
    "FIELD_ADDRESS_IDENTITY": _field_address_identity,
    "FIELD_DECISION_AUTHORITY": _field_decision_authority,
    "FIELD_DESCRIPTOR_OBSERVATION": _field_descriptor_observation,
    "GATE_DECISION_INTEGRITY": _gate_decision_integrity,
    "GATE_EVIDENCE_COMPLETENESS": _gate_evidence_completeness,
    "GUIDED_RUN_SAFETY": _guided_run_safety,
    "HOLDOUT_MANIFEST_INTEGRITY": _holdout_manifest_integrity,
    "INERT_TEXT_SAFETY": _inert_text_safe,
    "LAYOUT_MEASUREMENT_INTEGRITY": _layout_measurement_integrity,
    "NAVIGATION_SAFETY": _navigation_safety,
    "PAGE_READINESS_INTEGRITY": _page_readiness_integrity,
    "RECONCILIATION_READINESS": _reconciliation_readiness,
    "RESUME_PLAN_EVIDENCE": _resume_plan_evidence,
    "WORKDAY_CERTIFICATION_SCOPE": _workday_certification_scope,
    "WORKDAY_STEP_BOUNDARY": _workday_step_boundary,
    "WORKDAY_TENANT_IDENTITY": _workday_tenant_identity,
}


class SemanticValidationIssueV1(NamedTuple):
    """One deterministic semantic-rule failure."""

    rule_id: str
    rule_kind: str
    error_code: str


class SemanticValidationOutcomeV1(NamedTuple):
    """Ordered semantic result after structural validation."""

    valid: bool
    issues: tuple[SemanticValidationIssueV1, ...]


def validate_semantic_contract_v1(
    schema_ref: str, value: object
) -> SemanticValidationOutcomeV1:
    """Evaluate finite reviewed rules bound to a structurally valid root."""
    issues = tuple(
        SemanticValidationIssueV1(
            rule_id=entry.rule_id,
            rule_kind=entry.rule_kind,
            error_code=entry.failure_error_code,
        )
        for entry in SEMANTIC_RULES_V1
        if entry.schema_ref == schema_ref and not RULE_EVALUATORS[entry.rule_kind](value)
    )
    return SemanticValidationOutcomeV1(valid=not issues, issues=issues)
