"""DIAGNOSTIC ONLY. Does the frozen Windows service need SystemRoot to start?

Launches the exact b74d867 packaged japp-orchestrator.exe (and the runner
CPython) with an empty environment versus SystemRoot only, feeds a synthetic
non-secret bootstrap, and records exit code, ACK and stderr per case.
"""

from __future__ import annotations

import json
import os
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path

TOKEN = "a" * 64  # synthetic test value, not a credential
BOOT = {
    "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
    "schema_version": "1.0.0",
    "bind_host": "127.0.0.1",
    "bind_port": 0,
    "session_token": TOKEN,
    "instance_id": "svc_00000000000000000000000001",
    "generation": 1,
}


def frame(value: dict[str, object]) -> bytes:
    body = json.dumps(value).encode()
    return struct.pack(">I", len(body)) + body


def python_case(label: str, code: str, env: dict[str, str]) -> None:
    done = subprocess.run(
        [sys.executable, "-I", "-c", code],
        env=env,
        capture_output=True,
        timeout=60,
        check=False,
    )
    print(f"== {label} exit={done.returncode}")
    print("stdout:", done.stdout.decode(errors="replace").strip())
    print("stderr:", done.stderr.decode(errors="replace").strip()[-1500:])


def service_case(label: str, exe: Path, env: dict[str, str]) -> None:
    start = time.monotonic()
    child = subprocess.Popen(
        [str(exe)],
        cwd=str(exe.parent),
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert child.stdin and child.stdout and child.stderr
    stderr: list[bytes] = []
    reader = threading.Thread(target=lambda: stderr.append(child.stderr.read()), daemon=True)
    reader.start()
    ack: list[bytes] = []

    def read_ack() -> None:
        head = child.stdout.read(4)
        if len(head) == 4:
            ack.append(child.stdout.read(struct.unpack(">I", head)[0]))

    try:
        child.stdin.write(frame(BOOT))
        child.stdin.flush()
    except OSError as error:
        print(f"bootstrap write failed: {error!r}")
    acker = threading.Thread(target=read_ack, daemon=True)
    acker.start()
    acker.join(30)
    ack_seconds = time.monotonic() - start
    try:
        child.stdin.close()  # lease EOF withdraws the service
    except OSError:
        pass
    try:
        code = child.wait(30)
    except subprocess.TimeoutExpired:
        child.kill()
        code = child.wait()
        print("service did not exit within 30 s after lease EOF; killed")
    reader.join(10)
    print(f"== {label} exit={code} ack_after={ack_seconds:.2f}s")
    print("ack:", ack[0].decode(errors="replace") if ack else None)
    text = b"".join(stderr).decode(errors="replace").strip()
    print("stderr:", text[-3000:] if text else "(empty)")


def main() -> None:
    exe = Path(sys.argv[1]).resolve(strict=True)
    root = os.environ["SystemRoot"]
    print("runner python", sys.version, "SystemRoot", root)
    python_case("py-environ-empty", "import os;print(sorted(os.environ))", {})
    python_case("py-socket-empty", "import socket;socket.socket();print('ok')", {})
    python_case(
        "py-socket-systemroot", "import socket;socket.socket();print('ok')", {"SystemRoot": root}
    )
    python_case("py-asyncio-empty", "import asyncio;print('ok')", {})
    service_case("service-empty", exe, {})
    service_case("service-systemroot", exe, {"SystemRoot": root})


if __name__ == "__main__":
    main()
