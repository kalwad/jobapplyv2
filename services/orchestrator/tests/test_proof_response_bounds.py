"""The server proof cannot buffer unbounded or malformed application output."""

from __future__ import annotations

# Literal response limits/statuses are independent safety assertions.
# ruff: noqa: PLR2004
import importlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.types import Receive, Scope, Send

VECTOR = json.loads(
    (Path(__file__).parent / "fixtures/health-proof.v1.json").read_text()
)


@pytest.mark.parametrize(
    "mutation", ["body", "headers", "content_length", "signed_header_count"]
)
def test_invalid_application_output_never_becomes_a_signed_response(
    mutation: str,
) -> None:
    boundary = importlib.import_module("orchestrator.boundary").AuthenticatedBoundary
    config = importlib.import_module(
        "orchestrator.config"
    ).ServiceConfiguration.model_validate(
        {
            "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
            "schema_version": "1.0.0",
            "bind_host": "127.0.0.1",
            "bind_port": 80,
            "session_token": VECTOR["token_hex"],
            "instance_id": VECTOR["context"]["instance_id"],
            "generation": 7,
        }
    )
    body = b"x" * 16385 if mutation == "body" else b"{}"
    headers = [
        (b"content-type", b"application/json"),
        (
            b"content-length",
            b"100" if mutation == "content_length" else str(len(body)).encode(),
        ),
        (b"x-japp-schema-id", b"urn:japp:schema:service:health:v1"),
        (b"x-japp-schema-version", b"1.0.0"),
        (b"x-correlation-id", VECTOR["correlation_id"].encode()),
    ]
    if mutation == "signed_header_count":
        headers.extend((b"x-overflow", b"x") for _ in range(57))
    if mutation == "headers":
        headers.extend((b"x-overflow", b"x") for _ in range(65))

    async def excessive(_scope: Scope, _receive: Receive, send: Send) -> None:
        await send({"type": "http.response.start", "status": 200, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    client = TestClient(
        boundary(excessive, config),
        base_url="http://127.0.0.1",
        client=("127.0.0.1", 40001),
    )
    try:
        response = client.get(
            "/api/v1/health",
            headers={
                "Authorization": "JAPP-HMAC-SHA256-V1 " + VECTOR["request_mac"],
                "X-Japp-Auth-Version": "1.0.0",
                "X-Japp-Nonce": VECTOR["nonce"],
                "X-Correlation-Id": VECTOR["correlation_id"],
            },
        )
        assert response.status_code == 503
        assert "X-Japp-Server-Proof" not in response.headers
        assert len(response.content) < 16384
        assert VECTOR["token_hex"] not in response.text
    finally:
        client.close()
