"""Finite HMAC health proof bound to the actual loopback TCP connection."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import re
import struct
from dataclasses import dataclass
from typing import TYPE_CHECKING

from starlette.types import ASGIApp, Message, Receive, Scope, Send

if TYPE_CHECKING:
    from orchestrator.config import ServiceConfiguration

AUTH_VERSION = "1.0.0"
AUTH_SCHEME = b"JAPP-HMAC-SHA256-V1 "
BODY_LIMIT = 16384
HEADER_LIMIT = 16384
HEADER_COUNT_LIMIT = 64
_MAX_PORT = 65535
_HEX = re.compile(r"[0-9a-f]{64}")
_EMPTY_HASH = hashlib.sha256(b"").hexdigest()


@dataclass(frozen=True)
class ProofContext:
    instance_id: str
    generation: int
    client_host: str
    client_port: int
    server_host: str
    server_port: int

    def fields(self) -> tuple[str, ...]:
        return (
            self.instance_id,
            str(self.generation),
            self.client_host,
            str(self.client_port),
            self.server_host,
            str(self.server_port),
        )


@dataclass(frozen=True)
class ProofRequest:
    context: ProofContext
    nonce: str
    correlation_id: str
    transcript: bytes


class ProofResponseError(Exception):
    """A finite response could not be safely signed; contains no request data."""


def framed(fields: tuple[str, ...]) -> bytes:
    return b"".join(
        struct.pack(">I", len(value.encode("ascii"))) + value.encode("ascii")
        for value in fields
    )


def request_transcript(context: ProofContext, nonce: str, correlation_id: str) -> bytes:
    return framed(
        (
            "JAPP_HTTP_AUTH_REQUEST_V1",
            AUTH_VERSION,
            "GET",
            "/api/v1/health",
            _EMPTY_HASH,
            nonce,
            correlation_id,
            *context.fields(),
        )
    )


# The wire transcript has seven explicit inputs; keeping them visible makes the
# Python/Rust golden-vector review direct rather than hiding data in dictionaries.
def response_transcript(  # noqa: PLR0913, PLR0917
    context: ProofContext,
    request: bytes,
    status: int,
    body: bytes,
    schema_id: str,
    schema_version: str,
    correlation_id: str,
) -> bytes:
    return framed(
        (
            "JAPP_HTTP_AUTH_RESPONSE_V1",
            AUTH_VERSION,
            hashlib.sha256(request).hexdigest(),
            str(status),
            hashlib.sha256(body).hexdigest(),
            schema_id,
            schema_version,
            correlation_id,
            *context.fields(),
        )
    )


def mac(token_hex: str, transcript: bytes) -> str:
    return hmac.digest(bytes.fromhex(token_hex), transcript, "sha256").hex()


def proof_headers_present(headers: list[tuple[bytes, bytes]]) -> bool:
    return any(
        name == b"x-japp-nonce"
        or name.startswith((b"x-japp-auth-", b"x-japp-proof-"))
        or name in {b"x-japp-server-proof", b"x-japp-request-proof"}
        for name, _ in headers
    )


def single(headers: list[tuple[bytes, bytes]], name: bytes) -> bytes | None:
    values = [value for key, value in headers if key == name]
    return values[0] if len(values) == 1 else None


# Independent fail-closed checks intentionally return at their rejection point.
def verify_health_proof(  # noqa: PLR0911
    scope: Scope,
    headers: list[tuple[bytes, bytes]],
    configuration: ServiceConfiguration,
    correlation_id: str,
) -> ProofRequest | None:
    if (
        scope["method"] != "GET"
        or scope["path"] != "/api/v1/health"
        or scope.get("raw_path") != b"/api/v1/health"
        or scope.get("query_string", b"")
        or len(headers) > HEADER_COUNT_LIMIT
        or sum(len(name) + len(value) for name, value in headers) > HEADER_LIMIT
        or any(name == b"transfer-encoding" for name, _ in headers)
        or any(name == b"content-encoding" for name, _ in headers)
    ):
        return None
    lengths = [value for name, value in headers if name == b"content-length"]
    if lengths and lengths != [b"0"]:
        return None
    allowed = {b"x-japp-auth-version", b"x-japp-nonce"}
    if any(
        proof_headers_present([(name, value)]) and name not in allowed
        for name, value in headers
    ):
        return None
    authorization = single(headers, b"authorization")
    nonce_bytes = single(headers, b"x-japp-nonce")
    if (
        authorization is None
        or not authorization.startswith(AUTH_SCHEME)
        or single(headers, b"x-japp-auth-version") != AUTH_VERSION.encode("ascii")
        or single(headers, b"x-correlation-id") != correlation_id.encode("ascii")
        or nonce_bytes is None
    ):
        return None
    try:
        nonce = nonce_bytes.decode("ascii")
        supplied = authorization[len(AUTH_SCHEME) :].decode("ascii")
    except UnicodeDecodeError:
        return None
    if _HEX.fullmatch(nonce) is None or _HEX.fullmatch(supplied) is None:
        return None
    client, server = scope.get("client"), scope.get("server")
    if (
        client is None
        or server is None
        or client[0] != "127.0.0.1"
        or server[0] != "127.0.0.1"
        or not 0 < client[1] <= _MAX_PORT
        or not 0 < server[1] <= _MAX_PORT
    ):
        return None
    context = ProofContext(
        configuration.instance_id,
        configuration.generation,
        client[0],
        client[1],
        server[0],
        server[1],
    )
    transcript = request_transcript(context, nonce, correlation_id)
    expected = mac(configuration.session_token.get_secret_value(), transcript)
    if not hmac.compare_digest(supplied, expected):
        return None
    return ProofRequest(context, nonce, correlation_id, transcript)


# ASGI's three arguments plus app/proof/key remain explicit at this transport seam.
async def send_signed_response(  # noqa: PLR0913, PLR0917
    app: ASGIApp,
    scope: Scope,
    receive: Receive,
    send: Send,
    proof: ProofRequest,
    token_hex: str,
) -> None:
    start: Message | None = None
    body = bytearray()
    complete = False

    async def capture(message: Message) -> None:
        nonlocal start, complete
        if message["type"] == "http.response.start" and start is None:
            start = message
        elif message["type"] == "http.response.body" and not complete:
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > BODY_LIMIT:
                raise ProofResponseError
            body.extend(chunk)
            complete = not message.get("more_body", False)
        else:
            raise ProofResponseError

    # Only a bounded read-only JSON route uses this capture, never streaming.
    async with asyncio.timeout(1.5):
        await app(scope, receive, capture)
    if start is None or not complete:
        raise ProofResponseError
    headers: list[tuple[bytes, bytes]] = list(start.get("headers", []))
    if (
        len(headers) > HEADER_COUNT_LIMIT
        or sum(len(name) + len(value) for name, value in headers) > HEADER_LIMIT
    ):
        raise ProofResponseError
    schema_id = single(headers, b"x-japp-schema-id")
    schema_version = single(headers, b"x-japp-schema-version")
    if (
        schema_id is None
        or schema_version is None
        or single(headers, b"x-correlation-id") != proof.correlation_id.encode("ascii")
        or single(headers, b"content-type") != b"application/json"
        or single(headers, b"content-length") != str(len(body)).encode("ascii")
        or proof_headers_present(headers)
    ):
        raise ProofResponseError
    try:
        transcript = response_transcript(
            proof.context,
            proof.transcript,
            start["status"],
            bytes(body),
            schema_id.decode("ascii"),
            schema_version.decode("ascii"),
            proof.correlation_id,
        )
    except UnicodeDecodeError:
        raise ProofResponseError from None
    headers.extend(
        [
            (b"x-japp-auth-version", AUTH_VERSION.encode("ascii")),
            (b"x-japp-nonce", proof.nonce.encode("ascii")),
            (b"x-japp-server-proof", mac(token_hex, transcript).encode("ascii")),
        ]
    )
    if (
        len(headers) > HEADER_COUNT_LIMIT
        or sum(len(name) + len(value) for name, value in headers) > HEADER_LIMIT
    ):
        raise ProofResponseError
    await send({**start, "headers": headers})
    await send({"type": "http.response.body", "body": bytes(body)})
