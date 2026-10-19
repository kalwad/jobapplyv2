"""Canonical contract envelopes and closed, text-free error records."""

import secrets
from datetime import UTC, datetime

from japp_contracts._runtime import ContractModel
from japp_contracts.common.envelope_v1 import CommonEnvelopeV1EnvelopedRecord
from japp_contracts.error.record_v1 import ErrorRecordV1
from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode
from starlette.responses import JSONResponse

API_VERSION = "1.0.0"
ERROR_SCHEMA = "urn:japp:schema:error:record:v1"
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def identifier(prefix: str) -> str:
    value = int.from_bytes(secrets.token_bytes(16), "big")
    encoded = ""
    for _ in range(26):
        encoded = _CROCKFORD[value & 31] + encoded
        value >>= 5
    return prefix + "_" + encoded


def timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def record_response(
    payload: ContractModel,
    schema_id: str,
    correlation_id: str,
    status_code: int = 200,
) -> JSONResponse:
    record = CommonEnvelopeV1EnvelopedRecord.model_validate(
        {
            "envelope": {
                "schema_id": schema_id,
                "schema_version": API_VERSION,
                "message_id": identifier("msg"),
                "created_at": timestamp(),
                "correlation_id": correlation_id,
            },
            "payload": payload.model_dump(mode="json", exclude_none=True),
        }
    )
    return JSONResponse(
        record.model_dump(mode="json", exclude_none=True),
        status_code=status_code,
        headers={
            "X-Japp-Schema-Id": schema_id,
            "X-Japp-Schema-Version": API_VERSION,
            "X-Correlation-Id": correlation_id,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


def failure_response(
    code: ErrorTaxonomyV1ErrorCode, status_code: int, correlation_id: str
) -> JSONResponse:
    error = ErrorRecordV1(
        error_id=identifier("err"),
        code=code,
        occurred_at=timestamp(),
        origin="ORCHESTRATOR",
        correlation_id=correlation_id,
    )
    return record_response(error, ERROR_SCHEMA, correlation_id, status_code)
