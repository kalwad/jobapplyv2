"""DIAGNOSTIC SCRATCH ONLY - never merge. Shared QMP/serial/frame helpers."""

import hashlib
import json
import socket
import struct
import time
import zlib
from pathlib import Path


class QMP:
    def __init__(self, path: Path) -> None:
        deadline = time.monotonic() + 30
        while not path.exists():
            if time.monotonic() > deadline:
                raise TimeoutError("no QMP socket")
            time.sleep(0.05)
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(10)
        self.sock.connect(str(path))
        self.stream = self.sock.makefile("rb")
        self.stream.readline()
        self.n = 0
        self.call("qmp_capabilities")

    def call(self, execute: str, arguments: dict | None = None) -> object:
        self.n += 1
        body = {"execute": execute, "id": self.n}
        if arguments:
            body["arguments"] = arguments
        self.sock.sendall(json.dumps(body).encode() + b"\n")
        while True:
            value = json.loads(self.stream.readline())
            if value.get("id") == self.n:
                if "error" in value:
                    raise RuntimeError(json.dumps(value["error"]))
                return value["return"]

    def key(self, code: str) -> None:
        for down in (True, False):
            self.call(
                "input-send-event",
                {"events": [{"type": "key", "data": {"down": down, "key": {"type": "qcode", "data": code}}}]},
            )
            time.sleep(0.1)


def ppm_to_png(source: Path, target: Path, scale: int = 2) -> str:
    data = source.read_bytes()
    parts = data.split(maxsplit=4)
    width, height = int(parts[1]), int(parts[2])
    pixels = parts[4] if len(parts) == 5 else b""
    pixels = data[len(data) - width * height * 3 :]
    digest = hashlib.sha256(pixels).hexdigest()
    w2, h2 = width // scale, height // scale
    rows = []
    for y in range(h2):
        row = pixels[(y * scale) * width * 3 : (y * scale + 1) * width * 3]
        rows.append(b"\x00" + b"".join(row[x * scale * 3 : x * scale * 3 + 3] for x in range(w2)))

    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w2, h2, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows), 6)) + chunk(b"IEND", b"")
    target.write_bytes(png)
    return digest
