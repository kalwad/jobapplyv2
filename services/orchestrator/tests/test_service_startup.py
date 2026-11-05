"""ACK is gated on actual Uvicorn/lifespan completion, never just socket binding."""

from __future__ import annotations

import asyncio
import importlib
import json
import os
import struct
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

CONFIG: dict[str, object] = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 0,
    "session_token": "a" * 64,
    "instance_id": "svc_00000000000000000000000001",
    "generation": 7,
}
EXPECTED_RUNTIME_EXIT = 70


def test_ack_waits_for_lifespan_and_ready_withdraws_on_lease(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = importlib.import_module("orchestrator.runner")
    factory = importlib.import_module("orchestrator.app").create_app
    settings = importlib.import_module(
        "orchestrator.config"
    ).ServiceConfiguration.model_validate(CONFIG)

    async def scenario() -> None:
        acquired = asyncio.Event()
        allow_startup = asyncio.Event()
        acknowledged = asyncio.Event()
        released = asyncio.Event()
        observations: list[tuple[bool, int]] = []

        @asynccontextmanager
        async def resource() -> AsyncIterator[None]:
            acquired.set()
            await allow_startup.wait()
            try:
                yield
            finally:
                assert not app.state.lifecycle.ready
                released.set()

        app = factory(CONFIG, resource_factory=resource)

        def application(_mapping: object) -> object:
            return app

        def ack(_descriptor: int, _settings: object, port: int) -> None:
            observations.append((app.state.lifecycle.ready, port))
            acknowledged.set()

        monkeypatch.setattr(runner, "create_app", application)
        monkeypatch.setattr(runner, "write_ack", ack)
        lease = runner.ParentLease(-1)
        with runner.own_socket(settings) as owned:
            selected_port = owned.getsockname()[1]
            task = asyncio.create_task(runner.serve_owned(settings, owned, lease, -1))
            try:
                await asyncio.wait_for(acquired.wait(), timeout=3)
                assert observations == []
                assert not app.state.lifecycle.ready
                allow_startup.set()
                await asyncio.wait_for(acknowledged.wait(), timeout=3)
                assert observations == [(True, selected_port)]
                lease.ended.set()
                assert await asyncio.wait_for(task, timeout=4) == 0
                assert released.is_set()
                assert not app.state.lifecycle.ready
            finally:
                allow_startup.set()
                lease.ended.set()
                if not task.done():
                    await asyncio.wait_for(task, timeout=4)

    asyncio.run(scenario())


def test_cli_failed_lifespan_exits_70_without_ack_or_exception_output(
    monkeypatch: pytest.MonkeyPatch, capfd: pytest.CaptureFixture[str]
) -> None:
    runner = importlib.import_module("orchestrator.runner")
    factory = importlib.import_module("orchestrator.app").create_app
    events: list[str] = []

    @asynccontextmanager
    async def resource() -> AsyncIterator[None]:
        def fail() -> None:
            raise RuntimeError("synthetic-private-" + str(CONFIG["session_token"]))

        try:
            events.append("acquire")
            fail()
            yield
        finally:
            events.append("release")

    app = factory(CONFIG, resource_factory=resource)
    monkeypatch.setattr(runner, "create_app", lambda _mapping: app)
    read_input, write_input = os.pipe()
    read_output, write_output = os.pipe()
    try:
        payload = json.dumps(CONFIG).encode("utf-8")
        os.write(write_input, struct.pack(">I", len(payload)) + payload)
        with monkeypatch.context() as context:
            context.setattr(runner.sys, "argv", ["owned-test-entrypoint"])
            context.setattr(
                runner.sys, "stdin", SimpleNamespace(fileno=lambda: read_input)
            )
            context.setattr(
                runner.sys, "stdout", SimpleNamespace(fileno=lambda: write_output)
            )
            assert runner.main() == EXPECTED_RUNTIME_EXIT
        os.close(write_output)
        write_output = -1
        assert os.read(read_output, 1) == b""
        assert events == ["acquire", "release"]
        assert not app.state.lifecycle.ready
        output = capfd.readouterr()
        assert output.out == ""
        assert output.err == ""
    finally:
        os.close(write_input)
        os.close(read_input)
        os.close(read_output)
        if write_output != -1:
            os.close(write_output)


def test_parent_eof_during_startup_prevents_ready_ack(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = importlib.import_module("orchestrator.runner")
    factory = importlib.import_module("orchestrator.app").create_app
    settings = importlib.import_module(
        "orchestrator.config"
    ).ServiceConfiguration.model_validate(CONFIG)

    async def scenario() -> None:
        acquired = asyncio.Event()
        release_startup = asyncio.Event()
        acknowledgements: list[int] = []

        @asynccontextmanager
        async def resource() -> AsyncIterator[None]:
            acquired.set()
            await release_startup.wait()
            yield

        app = factory(CONFIG, resource_factory=resource)
        monkeypatch.setattr(runner, "create_app", lambda _mapping: app)
        monkeypatch.setattr(
            runner,
            "write_ack",
            lambda _descriptor, _settings, port: acknowledgements.append(port),
        )
        lease = runner.ParentLease(-1)
        with runner.own_socket(settings) as owned:
            task = asyncio.create_task(runner.serve_owned(settings, owned, lease, -1))
            try:
                await asyncio.wait_for(acquired.wait(), timeout=3)
                lease.ended.set()
                release_startup.set()
                assert await asyncio.wait_for(task, timeout=4) == 0
                assert acknowledgements == []
                assert not app.state.lifecycle.ready
            finally:
                release_startup.set()
                lease.ended.set()
                if not task.done():
                    await asyncio.wait_for(task, timeout=4)

    asyncio.run(scenario())
