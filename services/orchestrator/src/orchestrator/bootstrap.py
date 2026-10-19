"""Bounded private-pipe bootstrap, with no credential-bearing argv or environment."""

from __future__ import annotations

import importlib
import json
import os
import queue
import struct
import sys
import threading
from typing import NoReturn, Protocol, cast

from pydantic import ValidationError

from orchestrator.config import ServiceConfiguration

FRAME_LIMIT = 4096
BOOTSTRAP_TIMEOUT = 5.0


class BinaryModeAPI(Protocol):
    def setmode(self, descriptor: int, mode: int, /) -> int: ...


def prepare_private_stdio(input_descriptor: int, output_descriptor: int) -> None:
    # Windows CRT text translation can alter framing bytes (including CR/LF and
    # Ctrl-Z). This transport boundary requires raw binary pipes on every host.
    host: str = sys.platform
    if host == "win32":
        api = cast(BinaryModeAPI, importlib.import_module("msvcrt"))
        binary = getattr(os, "O_BINARY", None)
        if not isinstance(binary, int):
            raise OSError("binary private pipes unavailable")
        api.setmode(input_descriptor, binary)
        api.setmode(output_descriptor, binary)


def reject_constant(_value: str) -> NoReturn:
    raise ValueError("invalid private bootstrap")


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for name, value in pairs:
        if name in result:
            raise ValueError("invalid private bootstrap")
        result[name] = value
    return result


def decode_bootstrap(payload: bytes) -> ServiceConfiguration:
    if not payload or len(payload) > FRAME_LIMIT:
        raise ValueError("invalid private bootstrap")
    try:
        value: object = json.loads(
            payload.decode("utf-8"),
            object_pairs_hook=unique_object,
            parse_constant=reject_constant,
        )
        if not isinstance(value, dict):
            raise ValueError("invalid private bootstrap")
        return ServiceConfiguration.model_validate(value)
    except (UnicodeDecodeError, ValueError, ValidationError, RecursionError):
        # Never render Pydantic/JSON failures: they can contain private input.
        raise ValueError("invalid private bootstrap") from None


def read_exact(descriptor: int, length: int) -> bytes:
    result = bytearray()
    while len(result) < length:
        chunk = os.read(descriptor, length - len(result))
        if not chunk:
            raise ValueError("incomplete private bootstrap")
        result.extend(chunk)
    return bytes(result)


def read_bootstrap(descriptor: int) -> ServiceConfiguration:
    result: queue.Queue[bytes | Exception] = queue.Queue(maxsize=1)

    def read() -> None:
        try:
            length = struct.unpack(">I", read_exact(descriptor, 4))[0]
            if not 0 < length <= FRAME_LIMIT:
                raise ValueError("invalid private bootstrap")
            result.put(read_exact(descriptor, length))
        except Exception:
            result.put(ValueError("invalid private bootstrap"))

    # Raw descriptor reads avoid buffered stdin locks during interpreter exit.
    # A daemon permits finite failure even if a parent leaves a partial pipe open.
    threading.Thread(target=read, daemon=True).start()
    try:
        payload = result.get(timeout=BOOTSTRAP_TIMEOUT)
    except queue.Empty:
        raise ValueError("private bootstrap deadline") from None
    if isinstance(payload, Exception):
        raise payload
    return decode_bootstrap(payload)


class ParentLease:
    """The owned pipe stays open; EOF or unexpected bytes withdraw the service."""

    def __init__(self, descriptor: int) -> None:
        self.ended = threading.Event()
        self.invalid = threading.Event()
        self.descriptor = descriptor

    def start(self) -> None:
        def observe() -> None:
            try:
                if os.read(self.descriptor, 1):
                    self.invalid.set()
            except OSError:
                self.invalid.set()
            finally:
                self.ended.set()

        threading.Thread(target=observe, daemon=True).start()
