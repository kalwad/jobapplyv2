"""M01-W05 test-only strict Pydantic compatibility adapter.

The adapter imports the committed generated package, accepts one bounded batch
request, and emits only stable machine-readable outcomes. It is not a product
service and has no network or handwritten contract models.
"""

from __future__ import annotations

import base64
import binascii
import importlib
import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Final, cast

from pydantic import ConfigDict, TypeAdapter, ValidationError

CONTRACTS_ROOT: Final = Path(__file__).resolve().parents[3]
REPO_ROOT: Final = CONTRACTS_ROOT.parents[1]
GENERATED_ROOT: Final = CONTRACTS_ROOT / "generated"
GENERATED_PYTHON: Final = GENERATED_ROOT / "python" / "src"
sys.path.insert(0, str(GENERATED_PYTHON))

from japp_contracts import (  # noqa: E402
    AuthorizationRuntimeContextV1,
    CommonEnvelopeV1EnvelopedRecord,
    FixtureTestRecordV1,
    authorize_command_request_v1,
    require_error_catalog_entry_v1,
)
from japp_contracts._runtime import ContractModel  # noqa: E402

PROTOCOL_VERSION: Final = "JAPP_CONTRACT_ADAPTER_V1"
LANGUAGE: Final = "python"
MAX_CASES: Final = 256
MAX_PROTOCOL_BYTES: Final = 4 * 1024 * 1024
MAX_RAW_BYTES: Final = 1024 * 1024
MAX_DEPTH: Final = 64
MAX_SAFE_INTEGER: Final = 9_007_199_254_740_991
SURROGATE_MIN: Final = 0xD800
SURROGATE_MAX: Final = 0xDFFF
EXPECTED_ARG_COUNT: Final = 3
OPERATIONS: Final = frozenset({"AUTHORIZE", "ROUND_TRIP", "VALIDATE", "VERSION_CHECK"})
FORBIDDEN_KEYS: Final = frozenset({"__proto__", "constructor", "prototype"})
SEMVER_RE: Final = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
BASE64_RE: Final = re.compile(
    r"^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$"
)

JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
Result = dict[str, JsonValue]


class AdapterBoundaryError(Exception):
    """Stable raw/protocol boundary failure without hostile detail."""

    def __init__(self, category: str) -> None:
        super().__init__(category)
        self.category = category


def _object_pairs(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
    result: dict[str, JsonValue] = {}
    for key, value in pairs:
        if key in result:
            raise AdapterBoundaryError("DUPLICATE_KEY")
        if key in FORBIDDEN_KEYS:
            raise AdapterBoundaryError("FORBIDDEN_PROPERTY_NAME")
        result[key] = value
    return result


def _parse_int(token: str) -> int:
    value = int(token)
    if abs(value) > MAX_SAFE_INTEGER:
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    return value


def _parse_float(token: str) -> float:
    value = float(token)
    if not math.isfinite(value):
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    if value.is_integer() and abs(value) > MAX_SAFE_INTEGER:
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    return value


def _reject_constant(_token: str) -> float:
    raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")


def _has_lone_surrogate(value: str) -> bool:
    return any(SURROGATE_MIN <= ord(character) <= SURROGATE_MAX for character in value)


def _check_value(value: JsonValue, depth: int = 0) -> None:
    if depth > MAX_DEPTH:
        raise AdapterBoundaryError("MAX_DEPTH_EXCEEDED")
    if isinstance(value, str):
        if _has_lone_surrogate(value):
            raise AdapterBoundaryError("INVALID_UNICODE")
        return
    if value is None or isinstance(value, (bool, int, float)):
        return
    if isinstance(value, list):
        for item in value:
            _check_value(item, depth + 1)
        return
    for key, item in value.items():
        if key in FORBIDDEN_KEYS:
            raise AdapterBoundaryError("FORBIDDEN_PROPERTY_NAME")
        _check_value(item, depth + 1)


def _parse_json_bytes(
    raw: bytes,
    *,
    max_bytes: int,
) -> JsonValue:
    if len(raw) > max_bytes:
        raise AdapterBoundaryError("INPUT_TOO_LARGE")
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise AdapterBoundaryError("INVALID_UTF8") from error
    try:
        value = cast(
            "JsonValue",
            json.loads(
                text,
                object_pairs_hook=_object_pairs,
                parse_int=_parse_int,
                parse_float=_parse_float,
                parse_constant=_reject_constant,
            ),
        )
    except AdapterBoundaryError:
        raise
    except (json.JSONDecodeError, RecursionError, ValueError) as error:
        raise AdapterBoundaryError("MALFORMED_JSON") from error
    _check_value(value)
    return value


def _canonical(value: JsonValue) -> str:
    _check_value(value)
    if type(value) is int and abs(value) > MAX_SAFE_INTEGER:
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    if type(value) is float and not math.isfinite(value):
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    if isinstance(value, list):
        normalized: JsonValue = [_canonical_value(item) for item in value]
    elif isinstance(value, dict):
        normalized = {
            key: _canonical_value(value[key])
            for key in sorted(value, key=lambda item: item.encode("utf-8"))
        }
    else:
        normalized = value
    return json.dumps(
        normalized,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )


def _canonical_value(value: JsonValue) -> JsonValue:
    if isinstance(value, list):
        return [_canonical_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _canonical_value(value[key])
            for key in sorted(value, key=lambda item: item.encode("utf-8"))
        }
    if type(value) is int and abs(value) > MAX_SAFE_INTEGER:
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    if type(value) is float and not math.isfinite(value):
        raise AdapterBoundaryError("NUMBER_OUT_OF_RANGE")
    return value


def _decode_base64(value: object) -> bytes:
    if (
        not isinstance(value, str)
        or not value
        or len(value) % 4 != 0
        or BASE64_RE.fullmatch(value) is None
    ):
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as error:
        raise AdapterBoundaryError("PROTOCOL_REJECTED") from error


def _exact_keys(
    value: dict[str, JsonValue],
    required: set[str],
    optional: set[str] | None = None,
) -> bool:
    allowed = required | (optional or set())
    return required <= value.keys() and value.keys() <= allowed


def _manifest() -> dict[str, Any]:
    value: object = json.loads(
        (GENERATED_ROOT / "MANIFEST.json").read_text(encoding="utf-8")
    )
    if not isinstance(value, dict):
        raise AdapterBoundaryError("ADAPTER_CONFIGURATION_INVALID")
    return cast("dict[str, Any]", value)


MANIFEST: Final = _manifest()
TYPE_MAP: Final = cast("dict[str, Any]", MANIFEST["types"])
SUPPORTED_VERSIONS: Final = {
    cast("str", item["id"]): cast("str", item["schemaVersion"])
    for item in cast("list[dict[str, Any]]", MANIFEST["inputs"])
}


def _target_for(ref: str) -> object | None:
    metadata = TYPE_MAP.get(ref)
    if not isinstance(metadata, dict):
        return None
    python = metadata.get("python")
    if not isinstance(python, dict):
        return None
    module_name = python.get("module")
    symbol = python.get("symbol")
    if not isinstance(module_name, str) or not isinstance(symbol, str):
        return None
    module = importlib.import_module(module_name)
    return getattr(module, symbol, None)


def _validate(ref: str, value: JsonValue) -> tuple[bool, JsonValue | None]:
    target = _target_for(ref)
    if target is None:
        return False, None
    try:
        if isinstance(target, type) and issubclass(target, ContractModel):
            model = target.model_validate(value)
            wire = cast("JsonValue", model.wire_dict())
            # Revalidate the serialized wire form so already-created or
            # subsequently mutated instances never bypass compatibility use.
            fresh = target.model_validate(wire)
            return True, cast("JsonValue", fresh.wire_dict())
        adapter: TypeAdapter[object] = TypeAdapter(
            target,
            config=ConfigDict(strict=True),
        )
        return True, cast("JsonValue", adapter.validate_python(value))
    except (ValidationError, TypeError, ValueError):
        return False, None


def _invalid(request: dict[str, JsonValue], category: str) -> Result:
    return {
        "case_id": cast("str", request["case_id"]),
        "operation": cast("str", request["operation"]),
        "validation_verdict": "INVALID",
        "error_category": category,
    }


def _validate_or_round_trip(request: dict[str, JsonValue], value: JsonValue) -> Result:
    ref = cast("str", request["schema_ref"])
    if ref.startswith(("http:", "https:")):
        return _invalid(request, "REMOTE_SCHEMA_REFERENCE")
    if ref not in TYPE_MAP:
        return _invalid(request, "UNKNOWN_SCHEMA_REFERENCE")
    valid, wire = _validate(ref, value)
    if not valid or wire is None:
        return _invalid(request, "SCHEMA_INVALID")
    result: Result = {
        "case_id": cast("str", request["case_id"]),
        "operation": cast("str", request["operation"]),
        "validation_verdict": "VALID",
    }
    if request["operation"] == "ROUND_TRIP":
        result["canonical_json"] = _canonical(wire)
    return result


def _version_result(  # noqa: PLR0911 - explicit outcomes are the protocol contract
    request: dict[str, JsonValue], value: JsonValue
) -> Result:
    if not isinstance(value, dict):
        return {
            **_invalid(request, "SCHEMA_INVALID"),
            "version_outcome": "MALFORMED_VERSION",
        }
    envelope = value.get("envelope")
    if not isinstance(envelope, dict):
        return {
            **_invalid(request, "SCHEMA_INVALID"),
            "version_outcome": "MALFORMED_VERSION",
        }
    schema_id = envelope.get("schema_id")
    declared = envelope.get("schema_version")
    if not isinstance(declared, str) or SEMVER_RE.fullmatch(declared) is None:
        return {
            **_invalid(request, "SCHEMA_INVALID"),
            "version_outcome": "MALFORMED_VERSION",
        }
    if not isinstance(schema_id, str) or schema_id not in SUPPORTED_VERSIONS:
        return {
            **_invalid(request, "UNKNOWN_SCHEMA_REFERENCE"),
            "version_outcome": "UNKNOWN_SCHEMA_ID",
        }
    supported = SUPPORTED_VERSIONS[schema_id]
    declared_parts = tuple(int(part) for part in declared.split("."))
    supported_parts = tuple(int(part) for part in supported.split("."))
    if declared_parts[0] != supported_parts[0]:
        return {
            **_invalid(request, "VERSION_REJECTED"),
            "version_outcome": "UNKNOWN_MAJOR_VERSION",
        }
    if declared_parts[1] > supported_parts[1]:
        return {
            **_invalid(request, "VERSION_REJECTED"),
            "version_outcome": "UPGRADE_REQUIRED_NEWER_MINOR",
        }
    try:
        envelope_model = CommonEnvelopeV1EnvelopedRecord.model_validate(value)
        envelope_wire = envelope_model.wire_dict()
    except (ValidationError, TypeError, ValueError):
        return {
            **_invalid(request, "SCHEMA_INVALID"),
            "version_outcome": "MALFORMED_VERSION",
        }
    valid, _wire = _validate(schema_id, envelope_wire["payload"])
    if not valid:
        return {
            **_invalid(request, "SCHEMA_INVALID"),
            "version_outcome": "PAYLOAD_INVALID",
        }
    return {
        "case_id": cast("str", request["case_id"]),
        "operation": cast("str", request["operation"]),
        "validation_verdict": "VALID",
        "version_outcome": "COMPATIBLE",
        "canonical_json": _canonical(envelope_wire),
    }


def _runtime_context(value: JsonValue) -> AuthorizationRuntimeContextV1 | None:
    if not isinstance(value, dict):
        return None
    expected = {
        "receiving_principal",
        "authenticated_sender_principal",
        "authenticated_originating_principal",
        "active_profile",
        "observed_payload_size_bytes",
    }
    if value.keys() != expected:
        return None
    try:
        return AuthorizationRuntimeContextV1(**cast("dict[str, Any]", value))
    except TypeError:
        return None


def _authorization_result(request: dict[str, JsonValue], value: JsonValue) -> Result:
    context_encoded = request.get("trusted_context_bytes_base64")
    try:
        context_value = _parse_json_bytes(
            _decode_base64(context_encoded),
            max_bytes=MAX_RAW_BYTES,
        )
    except AdapterBoundaryError:
        context_value = None
    context = _runtime_context(context_value)
    valid, wire = _validate(cast("str", request["schema_ref"]), value)
    normalized = _canonical(wire) if valid and wire is not None else None
    outcome = authorize_command_request_v1(value, context)
    if not outcome.authorized:
        require_error_catalog_entry_v1(outcome.error_code)
        result: Result = {
            "case_id": cast("str", request["case_id"]),
            "operation": cast("str", request["operation"]),
            "validation_verdict": "VALID" if valid else "INVALID",
            "authorization_outcome": "DENY",
            "error_category": "AUTHORIZATION_DENIED",
            "error_code": outcome.error_code,
        }
        if normalized is not None:
            result["canonical_json"] = normalized
        return result
    result = {
        "case_id": cast("str", request["case_id"]),
        "operation": cast("str", request["operation"]),
        "validation_verdict": "VALID",
        "authorization_outcome": "ALLOW",
    }
    if normalized is not None:
        result["canonical_json"] = normalized
    return result


def _apply_scenario(
    request: dict[str, JsonValue], value: JsonValue
) -> tuple[JsonValue, Result | None]:
    scenario = request.get("scenario")
    if scenario is None:
        return value, None
    if scenario != "MUTATED_MODEL":
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    if not isinstance(value, dict):
        return value, _invalid(request, "SCHEMA_INVALID")
    try:
        model = FixtureTestRecordV1.model_validate(value)
        model.status = cast("Any", "MUTATED_AFTER_VALIDATION")
        dumped = cast(
            "JsonValue",
            FixtureTestRecordV1.model_dump(
                model,
                mode="python",
                exclude_unset=True,
                warnings="error",
            ),
        )
        FixtureTestRecordV1.model_validate(dumped)
    except (ValidationError, TypeError, ValueError):
        return value, _invalid(request, "SCHEMA_INVALID")
    raise AdapterBoundaryError("ADAPTER_INVARIANT_FAILED")


def _process(request: dict[str, JsonValue]) -> Result:
    try:
        value = _parse_json_bytes(
            _decode_base64(request["input_bytes_base64"]),
            max_bytes=MAX_RAW_BYTES,
        )
        value, scenario_result = _apply_scenario(request, value)
        if scenario_result is not None:
            return scenario_result
    except AdapterBoundaryError as error:
        result = _invalid(request, error.category)
        if request["operation"] == "AUTHORIZE":
            require_error_catalog_entry_v1("TRANSPORT_MALFORMED_MESSAGE")
            result["authorization_outcome"] = "DENY"
            result["error_code"] = "TRANSPORT_MALFORMED_MESSAGE"
        return result
    if request["operation"] == "AUTHORIZE":
        return _authorization_result(request, value)
    if request["operation"] == "VERSION_CHECK":
        return _version_result(request, value)
    return _validate_or_round_trip(request, value)


def _parse_request_file(path: Path) -> list[dict[str, JsonValue]]:
    parsed = _parse_json_bytes(path.read_bytes(), max_bytes=MAX_PROTOCOL_BYTES)
    if (
        not isinstance(parsed, dict)
        or not _exact_keys(parsed, {"protocol_version", "requests"})
        or parsed.get("protocol_version") != PROTOCOL_VERSION
        or not isinstance(parsed.get("requests"), list)
    ):
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    requests = cast("list[JsonValue]", parsed["requests"])
    if not requests or len(requests) > MAX_CASES:
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    result: list[dict[str, JsonValue]] = []
    seen: set[str] = set()
    previous = ""
    required = {"case_id", "schema_ref", "operation", "input_bytes_base64"}
    optional = {"scenario", "trusted_context_bytes_base64"}
    for candidate in requests:
        if (
            not isinstance(candidate, dict)
            or not _exact_keys(candidate, required, optional)
            or not isinstance(candidate.get("case_id"), str)
            or not candidate["case_id"]
            or cast("str", candidate["case_id"]) in seen
            or (previous and previous >= cast("str", candidate["case_id"]))
            or not isinstance(candidate.get("schema_ref"), str)
            or candidate.get("operation") not in OPERATIONS
            or not isinstance(candidate.get("input_bytes_base64"), str)
            or (
                "scenario" in candidate
                and not isinstance(candidate.get("scenario"), str)
            )
            or (
                "trusted_context_bytes_base64" in candidate
                and not isinstance(candidate.get("trusted_context_bytes_base64"), str)
            )
        ):
            raise AdapterBoundaryError("PROTOCOL_REJECTED")
        _decode_base64(candidate["input_bytes_base64"])
        context_encoded = candidate.get("trusted_context_bytes_base64")
        if context_encoded is not None:
            _decode_base64(context_encoded)
        case_id = cast("str", candidate["case_id"])
        seen.add(case_id)
        previous = case_id
        result.append(candidate)
    return result


def _request_path() -> Path:
    if len(sys.argv) != EXPECTED_ARG_COUNT or sys.argv[1] != "--request":
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    return Path(sys.argv[2])


def main() -> int:
    requests = _parse_request_file(_request_path())
    response: JsonValue = {
        "protocol_version": PROTOCOL_VERSION,
        "language": LANGUAGE,
        "results": [_process(request) for request in requests],
    }
    output = _canonical(response)
    if len(output.encode("utf-8")) > MAX_PROTOCOL_BYTES:
        raise AdapterBoundaryError("PROTOCOL_REJECTED")
    sys.stdout.write(f"{output}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AdapterBoundaryError, OSError, KeyError, TypeError, ValueError):
        raise SystemExit(2) from None
