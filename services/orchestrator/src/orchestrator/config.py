"""Explicit, strict private-bootstrap configuration; never read credentials from env."""

import re
from typing import Annotated, Literal

from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class ServiceConfiguration(BaseModel):
    """Configuration received exclusively over the parent's private pipe."""

    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)

    protocol: Literal["JAPP_SERVICE_BOOTSTRAP_V1"]
    schema_version: Literal["1.0.0"]
    bind_host: Literal["127.0.0.1"]
    bind_port: Annotated[int, Field(ge=0, le=65535)]
    session_token: SecretStr
    instance_id: CommonStableIdV1StableId
    generation: Annotated[int, Field(ge=0, le=2147483647)]

    @field_validator("session_token")
    @classmethod
    def require_random_token_shape(cls, value: SecretStr) -> SecretStr:
        if re.fullmatch(r"[0-9a-f]{64}", value.get_secret_value()) is None:
            raise ValueError("invalid session credential shape")
        return value

    @field_validator("instance_id")
    @classmethod
    def require_service_identity(cls, value: str) -> str:
        if not value.startswith("svc_"):
            raise ValueError("invalid service identity prefix")
        return value
