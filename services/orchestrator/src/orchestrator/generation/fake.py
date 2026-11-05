"""Deterministic in-process external seam; no network or credential facility."""

from __future__ import annotations

import json

from orchestrator.generation.types import (
    ByteStream,
    CandidateDocument,
    ErrorCode,
    GenerationFailure,
    Limits,
)


class _FixtureStream:
    def __init__(self, body: bytes) -> None:
        self._body: bytes | None = body

    def __aiter__(self) -> _FixtureStream:
        return self

    async def __anext__(self) -> bytes:
        if self._body is None:
            raise StopAsyncIteration
        body, self._body = self._body, None
        return body

    def close(self) -> None:
        self._body = None


class FakeExternalTransport:
    """Explicit fixture only. The client separately requires opt-in/synthetic data."""

    def __init__(self, model: str, response: CandidateDocument) -> None:
        self._model = model
        self._response = response

    async def open(self, payload: bytes, limits: Limits) -> ByteStream:
        if len(payload) > limits.input_bytes:
            raise GenerationFailure(ErrorCode.LIMIT)
        body = (
            json.dumps(
                {
                    "model": self._model,
                    "message": {
                        "role": "assistant",
                        "content": self._response.model_dump_json(),
                    },
                    "done": True,
                    "done_reason": "stop",
                },
                separators=(",", ":"),
            ).encode("utf-8")
            + b"\n"
        )
        return _FixtureStream(body)
