"""Fail-closed service configuration with no ambient credentials."""

from __future__ import annotations

import importlib

import pytest
from pydantic import ValidationError

CONFIG: dict[str, object] = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 0,
    "session_token": "a" * 64,
    "instance_id": "svc_00000000000000000000000001",
    "generation": 7,
}


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("bind_host", "0.0.0.0"),  # noqa: S104 - explicitly rejected input
        ("bind_host", "localhost"),
        ("bind_host", "::1"),
        ("bind_port", -1),
        ("bind_port", 65536),
        ("bind_port", True),
        ("bind_port", "1234"),
        ("generation", -1),
        ("generation", 2147483648),
        ("generation", True),
        ("session_token", ""),
        ("session_token", "a" * 63),
        ("session_token", "A" * 64),
        ("session_token", "g" * 64),
        ("instance_id", "job_00000000000000000000000001"),
        ("instance_id", "svc_invalid"),
        ("protocol", "JAPP_SERVICE_BOOTSTRAP_V2"),
        ("schema_version", "2.0.0"),
        ("extra", "unexpected"),
    ],
)
def test_unsafe_configuration_is_rejected(key: str, value: object) -> None:
    config = importlib.import_module("orchestrator.config").ServiceConfiguration
    with pytest.raises(ValidationError):
        config.model_validate({**CONFIG, key: value})


def test_token_is_required_even_when_environment_contains_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("JAPP_SESSION_TOKEN", str(CONFIG["session_token"]))
    config = importlib.import_module("orchestrator.config").ServiceConfiguration
    without_token = {
        key: value for key, value in CONFIG.items() if key != "session_token"
    }
    with pytest.raises(ValidationError):
        config.model_validate(without_token)
    validated = config.model_validate(CONFIG)
    assert str(CONFIG["session_token"]) not in repr(validated)
