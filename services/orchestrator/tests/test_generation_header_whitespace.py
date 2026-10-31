"""HTTP optional whitespace cannot erase forbidden control bytes in a value."""

from __future__ import annotations

import asyncio

import pytest
from services.orchestrator.tests.test_generation_transport import (
    _NDJSON,
    _body,
    _transport,
)

from orchestrator.generation import ErrorCode, GenerationFailure

_STATUS = b"HTTP/1.1 200 OK\r\nContent-Type:"


@pytest.mark.parametrize(
    "control", [b"\x0b", b"\x0c", b"\x1c", b"\x1d", b"\x1e", b"\x1f"]
)
@pytest.mark.parametrize("edge", ["leading", "trailing"])
def test_http_value_rejects_controls_that_general_string_trimming_would_erase(
    control: bytes, edge: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        value = (
            control + b"application/x-ndjson"
            if edge == "leading"
            else b"application/x-ndjson" + control
        )
        transport, writer = _transport(
            _STATUS + value + b"\r\n\r\n" + _NDJSON, monkeypatch
        )
        with pytest.raises(GenerationFailure) as caught:
            await _body(transport)
        assert caught.value.code is ErrorCode.PROTOCOL
        assert writer.transport.called

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "value",
    [
        b" application/x-ndjson ",
        b"\tapplication/x-ndjson\t",
        b" \tapplication/x-ndjson\t ",
    ],
)
def test_http_value_accepts_only_space_and_horizontal_tab_as_optional_whitespace(
    value: bytes, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        transport, writer = _transport(
            _STATUS + value + b"\r\n\r\n" + _NDJSON, monkeypatch
        )
        assert await _body(transport) == _NDJSON
        assert writer.transport.called

    asyncio.run(scenario())
