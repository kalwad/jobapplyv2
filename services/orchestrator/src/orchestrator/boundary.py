"""Authentication precedes routing and error dispatch for every HTTP request."""

from __future__ import annotations

import hmac
from typing import TYPE_CHECKING

from japp_contracts.common.correlation_v1 import CommonCorrelationV1CorrelationId
from pydantic import TypeAdapter, ValidationError
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from orchestrator.proof_auth import (
    proof_headers_present,
    send_signed_response,
    verify_health_proof,
)
from orchestrator.responses import failure_response, identifier

if TYPE_CHECKING:
    from orchestrator.config import ServiceConfiguration

_CORRELATION = TypeAdapter(CommonCorrelationV1CorrelationId)
_CORRELATION_LIMIT = 64
_HTTP_DEFAULT_PORT = 80


def request_correlation(headers: list[tuple[bytes, bytes]]) -> tuple[str, bool]:
    values = [value for name, value in headers if name == b"x-correlation-id"]
    if not values:
        return identifier("corr"), True
    if len(values) != 1 or len(values[0]) > _CORRELATION_LIMIT:
        return identifier("corr"), False
    try:
        return _CORRELATION.validate_python(
            values[0].decode("ascii"), strict=True
        ), True
    except (UnicodeDecodeError, ValidationError):
        return identifier("corr"), False


def safe_request_authority(scope: Scope, headers: list[tuple[bytes, bytes]]) -> bool:
    if any(
        name in {b"origin", b"forwarded"} or name.startswith(b"x-forwarded-")
        for name, _ in headers
    ):
        return False
    hosts = [value for name, value in headers if name == b"host"]
    server = scope.get("server")
    if len(hosts) != 1 or server is None or server[0] != "127.0.0.1":
        return False
    expected = b"127.0.0.1:" + str(server[1]).encode("ascii")
    return hosts[0] == expected or (
        server[1] == _HTTP_DEFAULT_PORT and hosts[0] == b"127.0.0.1"
    )


class AuthenticatedBoundary:
    """Close the HTTP boundary before FastAPI can expose framework routes/errors."""

    def __init__(self, app: ASGIApp, configuration: ServiceConfiguration) -> None:
        self.app = app
        self.configuration = configuration
        self.expected = (
            b"Bearer " + configuration.session_token.get_secret_value().encode("ascii")
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers: list[tuple[bytes, bytes]] = scope["headers"]
        correlation, valid_correlation = request_correlation(headers)
        scope.setdefault("state", {})["correlation_id"] = correlation
        credentials = [value for name, value in headers if name == b"authorization"]
        bearer = len(credentials) == 1 and hmac.compare_digest(
            credentials[0], self.expected
        )
        proof = (
            verify_health_proof(scope, headers, self.configuration, correlation)
            if valid_correlation and not bearer
            else None
        )
        if (bearer and proof_headers_present(headers)) or (
            not bearer and proof is None
        ):
            await failure_response("TRANSPORT_UNAUTHENTICATED", 401, correlation)(
                scope, receive, send
            )
            return
        if not safe_request_authority(scope, headers):
            await failure_response("TRANSPORT_FORBIDDEN", 403, correlation)(
                scope, receive, send
            )
            return
        if not valid_correlation:
            await failure_response("VALIDATION_CONSTRAINT_VIOLATION", 400, correlation)(
                scope, receive, send
            )
            return
        if proof is not None:
            first = await receive()
            if (
                first["type"] != "http.request"
                or first.get("body", b"")
                or first.get("more_body", False)
            ):
                await failure_response("TRANSPORT_UNAUTHENTICATED", 401, correlation)(
                    scope, receive, send
                )
                return
        response_started = False

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            if proof is None:
                await self.app(scope, receive, tracked_send)
            else:
                await send_signed_response(
                    self.app,
                    scope,
                    receive,
                    tracked_send,
                    proof,
                    self.configuration.session_token.get_secret_value(),
                )
        except Exception:
            # Framework debug/traceback output must never reach transport logs.
            # W02 routes return complete JSON responses; no streaming endpoints.
            if not response_started:
                await failure_response(
                    "TRANSPORT_SERVICE_UNAVAILABLE", 503, correlation
                )(scope, receive, send)
