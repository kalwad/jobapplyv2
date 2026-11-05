"""Authenticated, connection-bound read-only health proof before bearer release."""

from __future__ import annotations

# Wire statuses/bounds and synthetic identities are independent protocol assertions.
# ruff: noqa: PLR2004
import hashlib
import hmac
import importlib
import json
import struct
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from fastapi.testclient import TestClient
from japp_contracts.common.envelope_v1 import CommonEnvelopeV1EnvelopedRecord
from japp_contracts.error.record_v1 import ErrorRecordV1

if TYPE_CHECKING:
    from collections.abc import Iterator

    from httpx2 import Response

VECTOR = json.loads(
    (Path(__file__).parent / "fixtures/health-proof.v1.json").read_text()
)
CONFIG: dict[str, object] = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 80,
    "session_token": VECTOR["token_hex"],
    "instance_id": VECTOR["context"]["instance_id"],
    "generation": 7,
}


def encoded(fields: list[str]) -> bytes:
    return b"".join(
        struct.pack(">I", len(value.encode("ascii"))) + value.encode("ascii")
        for value in fields
    )


def common(client_port: int = 40001) -> list[str]:
    return [
        str(CONFIG["instance_id"]),
        "7",
        "127.0.0.1",
        str(client_port),
        "127.0.0.1",
        "80",
    ]


def request_bytes(client_port: int = 40001) -> bytes:
    return encoded(
        [
            "JAPP_HTTP_AUTH_REQUEST_V1",
            "1.0.0",
            "GET",
            "/api/v1/health",
            hashlib.sha256(b"").hexdigest(),
            VECTOR["nonce"],
            VECTOR["correlation_id"],
            *common(client_port),
        ]
    )


def headers(client_port: int = 40001) -> dict[str, str]:
    mac = hmac.digest(
        bytes.fromhex(VECTOR["token_hex"]), request_bytes(client_port), "sha256"
    ).hex()
    return {
        "Authorization": "JAPP-HMAC-SHA256-V1 " + mac,
        "X-Japp-Auth-Version": "1.0.0",
        "X-Japp-Nonce": VECTOR["nonce"],
        "X-Correlation-Id": VECTOR["correlation_id"],
    }


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = importlib.import_module("orchestrator.app").create_app(CONFIG)
    with TestClient(
        app, base_url="http://127.0.0.1", client=("127.0.0.1", 40001)
    ) as managed:
        yield managed


def assert_proof(response: Response) -> None:
    assert response.headers["X-Japp-Auth-Version"] == "1.0.0"
    assert response.headers["X-Japp-Nonce"] == VECTOR["nonce"]
    transcript = encoded(
        [
            "JAPP_HTTP_AUTH_RESPONSE_V1",
            "1.0.0",
            hashlib.sha256(request_bytes()).hexdigest(),
            str(response.status_code),
            hashlib.sha256(response.content).hexdigest(),
            response.headers["X-Japp-Schema-Id"],
            response.headers["X-Japp-Schema-Version"],
            VECTOR["correlation_id"],
            *common(),
        ]
    )
    expected = hmac.digest(
        bytes.fromhex(VECTOR["token_hex"]), transcript, "sha256"
    ).hex()
    assert hmac.compare_digest(response.headers["X-Japp-Server-Proof"], expected)
    assert VECTOR["token_hex"] not in response.text


def test_health_proof_is_authenticated_canonical_and_connection_bound(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/health", headers=headers())
    assert response.status_code == 200
    assert_proof(response)
    record = CommonEnvelopeV1EnvelopedRecord.model_validate_json(response.content)
    assert record.envelope.schema_id == "urn:japp:schema:service:health:v1"
    assert record.envelope.correlation_id == VECTOR["correlation_id"]
    assert record.payload == {
        "status": "LIVE",
        "scope": "SERVICE_SKELETON",
        "instance_id": CONFIG["instance_id"],
        "generation": 7,
    }


def test_request_and_response_golden_vectors_are_byte_exact() -> None:
    module = importlib.import_module("orchestrator.proof_auth")
    context = module.ProofContext(**VECTOR["context"])
    request = module.request_transcript(
        context, VECTOR["nonce"], VECTOR["correlation_id"]
    )
    assert request.hex() == VECTOR["request_transcript_hex"]
    assert module.mac(VECTOR["token_hex"], request) == VECTOR["request_mac"]
    response = module.response_transcript(
        context,
        request,
        200,
        VECTOR["response_body_utf8"].encode(),
        "urn:japp:schema:service:health:v1",
        "1.0.0",
        VECTOR["correlation_id"],
    )
    assert response.hex() == VECTOR["response_transcript_hex"]
    assert module.mac(VECTOR["token_hex"], response) == VECTOR["response_mac"]


@pytest.mark.parametrize(
    "field", ["X-Japp-Auth-Version", "X-Japp-Nonce", "X-Correlation-Id"]
)
def test_missing_or_duplicate_proof_fields_are_rejected(
    client: TestClient, field: str
) -> None:
    valid = headers()
    missing = {key: value for key, value in valid.items() if key != field}
    duplicate = [*valid.items(), (field, valid[field])]
    for altered in (missing, duplicate):
        response = client.get("/api/v1/health", headers=altered)
        assert response.status_code == 401
        assert "X-Japp-Server-Proof" not in response.headers


@pytest.mark.parametrize(
    "altered",
    [
        {"X-Japp-Auth-Version": "2.0.0"},
        {"X-Japp-Nonce": "c" * 64},
        {"X-Japp-Nonce": "b" * 63},
        {"X-Japp-Nonce": "G" * 64},
        {"X-Correlation-Id": "corr_00000000000000000000000003"},
        {"X-Japp-Server-Proof": "b" * 64},
        {"X-Japp-Auth-Unknown": "unexpected"},
        {"Authorization": "JAPP-HMAC-SHA256-V1 " + "0" * 64},
        {"Authorization": "Bearer " + VECTOR["token_hex"]},
    ],
)
def test_tampered_or_mixed_auth_never_produces_proof(
    client: TestClient, altered: dict[str, str]
) -> None:
    response = client.get("/api/v1/health", headers={**headers(), **altered})
    assert response.status_code == 401
    assert "X-Japp-Server-Proof" not in response.headers


@pytest.mark.parametrize(
    "path", ["/api/v1/ready", "/api/v1/version", "/api/v1/health?extra=1", "/unknown"]
)
def test_proof_mode_cannot_authorize_other_operations(
    client: TestClient, path: str
) -> None:
    response = client.get(path, headers=headers())
    assert response.status_code == 401


def test_proof_mode_rejects_nonempty_body_and_unsupported_method(
    client: TestClient,
) -> None:
    for method, body in (("GET", b"private"), ("POST", b"")):
        response = client.request(
            method, "/api/v1/health", content=body, headers=headers()
        )
        assert response.status_code == 401
        assert "X-Japp-Server-Proof" not in response.headers


def test_relayed_request_from_a_different_tcp_tuple_is_rejected() -> None:
    app = importlib.import_module("orchestrator.app").create_app(CONFIG)
    with TestClient(
        app, base_url="http://127.0.0.1", client=("127.0.0.1", 40002)
    ) as relay:
        response = relay.get("/api/v1/health", headers=headers())
        assert response.status_code == 401
        assert "X-Japp-Server-Proof" not in response.headers


def test_valid_readonly_proof_does_not_claim_server_one_use_nonce_cache(
    client: TestClient,
) -> None:
    first = client.get("/api/v1/health", headers=headers())
    second = client.get("/api/v1/health", headers=headers())
    assert first.status_code == 200
    assert second.status_code == 200
    assert_proof(first)
    assert_proof(second)


def test_proof_auth_keeps_host_origin_and_proxy_protection(client: TestClient) -> None:
    for extra in (
        {"Host": "evil.invalid"},
        {"Origin": "null"},
        {"X-Forwarded-For": "127.0.0.1"},
    ):
        response = client.get("/api/v1/health", headers={**headers(), **extra})
        assert response.status_code == 403
        record = CommonEnvelopeV1EnvelopedRecord.model_validate_json(response.content)
        assert (
            ErrorRecordV1.model_validate(record.payload).code == "TRANSPORT_FORBIDDEN"
        )
