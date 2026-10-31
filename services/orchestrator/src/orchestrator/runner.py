"""One owned loopback server; parent process orchestration belongs to M03-W03."""

from __future__ import annotations

import asyncio
import errno
import json
import os
import socket
import struct
import sys
from typing import TYPE_CHECKING

import uvicorn

from orchestrator.app import create_app
from orchestrator.bootstrap import (
    FRAME_LIMIT,
    ParentLease,
    prepare_private_stdio,
    read_bootstrap,
)

if TYPE_CHECKING:
    from fastapi import FastAPI

    from orchestrator.config import ServiceConfiguration

EXIT_CONFIGURATION = 64
EXIT_RUNTIME = 70
EXIT_BIND = 72
SHUTDOWN_TIMEOUT = 2

# The private stdout channel contains only framed ACKs. Framework diagnostics can
# carry arbitrary exception/request data, so the CLI uses a null logging sink.
LOG_CONFIG: dict[str, object] = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "loggers": {
        name: {"handlers": ["null"], "propagate": False}
        for name in ("uvicorn", "uvicorn.error", "uvicorn.access")
    },
}


def write_ack(descriptor: int, settings: ServiceConfiguration, port: int) -> None:
    payload = json.dumps(
        {
            "protocol": "JAPP_SERVICE_STATUS_V1",
            "schema_version": "1.0.0",
            "status": "READY",
            "bind_host": "127.0.0.1",
            "bind_port": port,
            "instance_id": settings.instance_id,
            "generation": settings.generation,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    if len(payload) > FRAME_LIMIT:
        raise ValueError("invalid status frame")
    frame = struct.pack(">I", len(payload)) + payload
    while frame:
        written = os.write(descriptor, frame)
        if written <= 0:
            raise OSError("private status channel closed")
        frame = frame[written:]


class AcknowledgedServer(uvicorn.Server):
    def __init__(
        self,
        config: uvicorn.Config,
        app: FastAPI,
        settings: ServiceConfiguration,
        lease: ParentLease,
        output_descriptor: int,
    ) -> None:
        super().__init__(config)
        self.application = app
        self.settings = settings
        self.lease = lease
        self.output_descriptor = output_descriptor
        self.ack_failed = False

    async def startup(self, sockets: list[socket.socket] | None = None) -> None:
        await super().startup(sockets=sockets)
        if self.lease.ended.is_set():
            self.should_exit = True
        if (
            self.started
            and not self.should_exit
            and self.application.state.lifecycle.ready
            and sockets is not None
            and len(sockets) == 1
        ):
            try:
                write_ack(
                    self.output_descriptor, self.settings, sockets[0].getsockname()[1]
                )
            except (OSError, ValueError):
                self.ack_failed = True
                self.should_exit = True


async def serve_owned(
    settings: ServiceConfiguration,
    owned: socket.socket,
    lease: ParentLease,
    output_descriptor: int,
) -> int:
    app = create_app(
        settings.model_dump(mode="python")
        | {"session_token": settings.session_token.get_secret_value()}
    )
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=owned.getsockname()[1],
        loop="asyncio",
        http="h11",
        ws="none",
        workers=1,
        reload=False,
        proxy_headers=False,
        access_log=False,
        log_config=LOG_CONFIG,
        lifespan="on",
        timeout_graceful_shutdown=SHUTDOWN_TIMEOUT,
        server_header=False,
    )
    server = AcknowledgedServer(config, app, settings, lease, output_descriptor)

    async def observe_lease() -> None:
        while not lease.ended.is_set():
            await asyncio.sleep(0.02)
        app.state.lifecycle.ready = False
        server.should_exit = True

    observer = asyncio.create_task(observe_lease())
    try:
        await server.serve(sockets=[owned])
    finally:
        observer.cancel()
        await asyncio.gather(observer, return_exceptions=True)
    if server.ack_failed:
        return EXIT_RUNTIME
    return EXIT_CONFIGURATION if lease.invalid.is_set() else 0


def own_socket(settings: ServiceConfiguration) -> socket.socket:
    owned = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # Windows requires explicit exclusivity to reject another process's
        # SO_REUSEADDR bind. POSIX retains the default exclusive bind behavior.
        exclusive = getattr(socket, "SO_EXCLUSIVEADDRUSE", None)
        if exclusive is not None:
            owned.setsockopt(socket.SOL_SOCKET, exclusive, 1)
        owned.bind((settings.bind_host, settings.bind_port))
        owned.setblocking(False)
    except BaseException:
        owned.close()
        raise
    return owned


def main() -> int:
    if len(sys.argv) != 1:
        return EXIT_CONFIGURATION
    try:
        input_descriptor = sys.stdin.fileno()
        output_descriptor = sys.stdout.fileno()
        prepare_private_stdio(input_descriptor, output_descriptor)
        settings = read_bootstrap(input_descriptor)
    except (ValueError, OSError):
        return EXIT_CONFIGURATION
    try:
        owned = own_socket(settings)
    except OSError as exception:
        return EXIT_BIND if exception.errno == errno.EADDRINUSE else EXIT_RUNTIME
    with owned:
        lease = ParentLease(input_descriptor)
        lease.start()
        try:
            return asyncio.run(serve_owned(settings, owned, lease, output_descriptor))
        except (Exception, SystemExit):
            return EXIT_RUNTIME
