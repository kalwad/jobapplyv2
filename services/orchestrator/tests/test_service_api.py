"""Authenticated versioned service boundary, exercised without external networking."""

# Literal HTTP statuses and generation values are independent wire assertions.
# ruff: noqa: PLR2004

from __future__ import annotations

import importlib
import json
from contextlib import asynccontextmanager
from importlib.metadata import version
from typing import TYPE_CHECKING, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from japp_contracts.common.envelope_v1 import CommonEnvelopeV1EnvelopedRecord
from japp_contracts.error.record_v1 import ErrorRecordV1
from japp_contracts.service.health_v1 import ServiceHealthV1
from japp_contracts.service.ready_v1 import ServiceReadyV1
from japp_contracts.service.version_v1 import ServiceVersionV1

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator

    from httpx2 import Response

TOKEN = "a" * 64
INSTANCE = "svc_00000000000000000000000001"
CORRELATION = "corr_00000000000000000000000002"
CONFIG: dict[str, object] = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 0,
    "session_token": TOKEN,
    "instance_id": INSTANCE,
    "generation": 7,
}
AUTH = {"Authorization": "Bearer " + TOKEN}


def application(**kwargs: object) -> FastAPI:
    module = importlib.import_module("orchestrator.app")
    app: FastAPI = module.create_app(dict(CONFIG), **kwargs)
    return app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(
        application(), base_url="http://127.0.0.1", raise_server_exceptions=False
    ) as managed:
        yield managed


def error_record(response: Response, expected: str) -> ErrorRecordV1:
    # HTTPX is kept at the transport edge; validation uses shipping contracts.
    raw = json.dumps(response.json())
    envelope = CommonEnvelopeV1EnvelopedRecord.model_validate_json(raw)
    assert envelope.envelope.schema_id == "urn:japp:schema:error:record:v1"
    assert envelope.envelope.schema_version == "1.0.0"
    error = ErrorRecordV1.model_validate(envelope.payload)
    assert error.code == expected
    assert error.origin == "ORCHESTRATOR"
    assert error.correlation_id == envelope.envelope.correlation_id
    assert response.headers["X-Japp-Schema-Id"] == "urn:japp:schema:error:record:v1"
    assert response.headers["X-Japp-Schema-Version"] == "1.0.0"
    assert response.headers["X-Correlation-Id"] == error.correlation_id
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert TOKEN not in raw
    assert set(response.json()) == {"envelope", "payload"}
    return error


@pytest.mark.parametrize(
    "route", ["health", "ready", "version", "unknown", "../docs", "../openapi.json"]
)
@pytest.mark.parametrize(
    "authorization", [None, "Bearer wrong", "Basic abc", "Bearer "]
)
def test_every_route_requires_session_auth(
    client: TestClient, route: str, authorization: str | None
) -> None:
    headers = {} if authorization is None else {"Authorization": authorization}
    response = client.get("/api/v1/" + route, headers=headers)
    assert response.status_code == 401
    error_record(response, "TRANSPORT_UNAUTHENTICATED")


@pytest.mark.parametrize("route", ["health", "ready", "version"])
def test_success_is_canonical_and_bound_to_this_service(
    client: TestClient, route: str
) -> None:
    response = client.get(
        "/api/v1/" + route, headers={**AUTH, "X-Correlation-Id": CORRELATION}
    )
    assert response.status_code == 200
    envelope = CommonEnvelopeV1EnvelopedRecord.model_validate_json(response.content)
    assert envelope.envelope.schema_id == f"urn:japp:schema:service:{route}:v1"
    assert envelope.envelope.schema_version == "1.0.0"
    assert envelope.envelope.correlation_id == CORRELATION
    assert response.headers["X-Japp-Schema-Id"] == envelope.envelope.schema_id
    assert response.headers["X-Japp-Schema-Version"] == "1.0.0"
    assert response.headers["X-Correlation-Id"] == CORRELATION
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Content-Type"] == "application/json"
    payload = envelope.payload
    assert isinstance(payload, dict)
    assert payload["instance_id"] == INSTANCE
    assert payload["generation"] == 7
    if route == "health":
        assert ServiceHealthV1.model_validate(payload).status == "LIVE"
    elif route == "ready":
        assert ServiceReadyV1.model_validate(payload).status == "READY"
    else:
        result = ServiceVersionV1.model_validate(payload)
        assert result.service_version == version("orchestrator")
        assert result.api_version == "1.0.0"


@pytest.mark.parametrize(
    "headers",
    [
        {**AUTH, "Host": "evil.example"},
        {**AUTH, "Origin": "https://evil.example"},
        {**AUTH, "Origin": "null"},
        {**AUTH, "X-Forwarded-For": "127.0.0.1"},
        {**AUTH, "X-Forwarded-Host": "127.0.0.1"},
        {**AUTH, "Forwarded": "for=127.0.0.1"},
    ],
)
def test_browser_rebinding_and_proxy_headers_are_rejected(
    client: TestClient, headers: dict[str, str]
) -> None:
    response = client.get("/api/v1/health", headers=headers)
    assert response.status_code == 403
    error_record(response, "TRANSPORT_FORBIDDEN")
    assert "access-control-allow-origin" not in response.headers


def test_duplicate_auth_and_correlation_headers_fail_closed(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers=[*AUTH.items(), *AUTH.items()])
    assert response.status_code == 401
    error_record(response, "TRANSPORT_UNAUTHENTICATED")
    response = client.get(
        "/api/v1/health",
        headers=[
            *AUTH.items(),
            ("X-Correlation-Id", CORRELATION),
            ("X-Correlation-Id", CORRELATION),
        ],
    )
    assert response.status_code == 400
    error_record(response, "VALIDATION_CONSTRAINT_VIOLATION")


@pytest.mark.parametrize("method", ["post", "options", "head"])
def test_unsupported_methods_remain_authenticated_and_structured(
    client: TestClient, method: str
) -> None:
    rejected = client.request(method, "/api/v1/health")
    assert rejected.status_code == 401
    response = client.request(method, "/api/v1/health", headers=AUTH)
    assert response.status_code == 405
    if method != "head":
        error_record(response, "TRANSPORT_PROTOCOL_MISMATCH")


@pytest.mark.parametrize(
    "route", ["/health", "/docs", "/redoc", "/openapi.json", "/api/v2/health"]
)
def test_unversioned_docs_and_other_api_major_are_not_public(
    client: TestClient, route: str
) -> None:
    response = client.get(route, headers=AUTH)
    assert response.status_code == 404
    error_record(response, "TRANSPORT_PROTOCOL_MISMATCH")


def test_hostile_correlation_and_exception_text_never_become_output(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    hostile = "private@example.invalid/" + TOKEN
    response = client.get(
        "/api/v1/health", headers={**AUTH, "X-Correlation-Id": hostile}
    )
    assert response.status_code == 400
    error_record(response, "VALIDATION_CONSTRAINT_VIOLATION")
    assert hostile not in response.text

    def fault() -> None:
        raise RuntimeError(hostile)

    cast(FastAPI, client.app).add_api_route("/fault", fault)
    response = client.get("/fault", headers=AUTH)
    assert response.status_code == 503
    error_record(response, "TRANSPORT_SERVICE_UNAVAILABLE")
    assert hostile not in response.text
    assert hostile not in caplog.text


def test_validation_errors_do_not_echo_the_request(client: TestClient) -> None:
    def query(number: int) -> dict[str, int]:
        return {"number": number}

    cast(FastAPI, client.app).add_api_route("/query", query)
    hostile = "private@example.invalid/" + TOKEN
    response = client.get("/query", params={"number": hostile}, headers=AUTH)
    assert response.status_code == 400
    error_record(response, "VALIDATION_CONSTRAINT_VIOLATION")
    assert hostile not in response.text


def test_lifespan_owns_resources_and_withdraws_readiness_before_release() -> None:
    events: list[str] = []
    app: FastAPI

    @asynccontextmanager
    async def resource() -> AsyncIterator[None]:
        events.append("acquire")
        try:
            yield
        finally:
            assert not app.state.lifecycle.ready
            events.append("release")

    app = application(resource_factory=resource)
    assert not app.state.lifecycle.ready
    with TestClient(app, base_url="http://127.0.0.1") as managed:
        assert managed.get("/api/v1/ready", headers=AUTH).status_code == 200
        assert events == ["acquire"]
    assert events == ["acquire", "release"]
    assert not app.state.lifecycle.ready


def test_startup_failure_does_not_claim_readiness_and_releases_partial_resource() -> (
    None
):
    events: list[str] = []

    @asynccontextmanager
    async def resource() -> AsyncIterator[None]:
        def fail_startup() -> None:
            raise RuntimeError("synthetic startup failure")

        try:
            events.append("acquire")
            fail_startup()
            yield
        finally:
            events.append("release")

    app = application(resource_factory=resource)
    with pytest.raises(RuntimeError), TestClient(app, base_url="http://127.0.0.1"):
        pytest.fail("startup failure must prevent serving")
    assert events == ["acquire", "release"]
    assert not app.state.lifecycle.ready


def test_app_instances_do_not_share_auth_or_readiness() -> None:
    first = application()
    module = importlib.import_module("orchestrator.app")
    second = module.create_app({**CONFIG, "session_token": "b" * 64})
    with TestClient(first, base_url="http://127.0.0.1") as first_client:
        assert first_client.get("/api/v1/health", headers=AUTH).status_code == 200
        with TestClient(second, base_url="http://127.0.0.1") as second_client:
            assert second_client.get("/api/v1/health", headers=AUTH).status_code == 401
        assert first.state.lifecycle.ready
    assert not first.state.lifecycle.ready


def test_request_route_does_not_interpret_secret_in_query_or_cookie(
    client: TestClient,
) -> None:
    client.cookies.set("token", TOKEN)
    response = client.get("/api/v1/health", params={"token": TOKEN})
    assert response.status_code == 401
    error_record(response, "TRANSPORT_UNAUTHENTICATED")


def test_ambient_telemetry_cannot_capture_request_or_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FASTAPI_OTEL_AUTO_CONFIGURE", "true")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://example.invalid")

    # Fail if the shipping no-op path tries to acquire even an ambient provider.
    def forbidden_provider(*_args: object, **_kwargs: object) -> None:
        pytest.fail("disabled telemetry must not acquire ambient providers")

    monkeypatch.setattr("opentelemetry.trace.get_tracer_provider", forbidden_provider)
    monkeypatch.setattr("opentelemetry.metrics.get_meter_provider", forbidden_provider)
    monkeypatch.setattr("opentelemetry._logs.get_logger_provider", forbidden_provider)
    app = application()
    configuration = app._telemetry
    for switch in ("tracing", "metrics", "logs", "operation_spans", "auto_configure"):
        assert configuration[switch] is False

    def fault() -> None:
        raise RuntimeError("synthetic-private-" + TOKEN)

    def query(number: int) -> dict[str, int]:
        return {"number": number}

    app.add_api_route("/fault", fault)
    app.add_api_route("/query", query)
    with TestClient(app, base_url="http://127.0.0.1") as managed:
        assert managed.get("/api/v1/health", headers=AUTH).status_code == 200
        assert managed.get("/fault", headers=AUTH).status_code == 503
        assert managed.get("/query?number=private", headers=AUTH).status_code == 400


@pytest.mark.parametrize("route", ["health", "ready"])
def test_before_startup_service_does_not_claim_liveness_or_readiness(
    route: str,
) -> None:
    app = application()
    managed = TestClient(app, base_url="http://127.0.0.1")
    try:
        response = managed.get("/api/v1/" + route, headers=AUTH)
        assert response.status_code == 503
        error_record(response, "TRANSPORT_SERVICE_UNAVAILABLE")
    finally:
        managed.close()


def test_duplicate_host_and_wrong_loopback_port_fail_closed(client: TestClient) -> None:
    for hosts in (
        [("Host", "127.0.0.1"), ("Host", "127.0.0.1")],
        [("Host", "127.0.0.1:9000")],
    ):
        response = client.get("/api/v1/health", headers=[*AUTH.items(), *hosts])
        assert response.status_code == 403
        error_record(response, "TRANSPORT_FORBIDDEN")
