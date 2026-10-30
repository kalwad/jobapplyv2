"""DIAGNOSTIC ONLY. Windows: can a plain bind reclaim a retired exclusive port?

A child process owns a 127.0.0.1 listener with SO_EXCLUSIVEADDRUSE (as the
service does), accepts one connection, and exits after a server-first or a
client-first close. The parent then retries a plain bind of that port (as the
package actor's Windows oracle does) and, separately, measures how a connect
to a closed port fails. Synthetic sockets only.
"""

from __future__ import annotations

import socket
import subprocess
import sys
import time

CHILD = r"""
import socket, sys
mode = sys.argv[1]
s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
s.bind(("127.0.0.1", 0))
s.listen(8)
print(s.getsockname()[1], flush=True)
if mode != "listener-only":
    c, _ = s.accept()
    c.recv(16)
    if mode == "server-first":
        c.close()
        sys.stdin.readline()
    else:
        sys.stdin.readline()
        c.close()
s.close()
"""


def netstat(port: int) -> str:
    out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True).stdout
    return " | ".join(" ".join(line.split()) for line in out.splitlines() if f":{port} " in line)


def bind_until(port: int, budget: float) -> str:
    start = time.monotonic()
    attempts = 0
    while True:
        attempts += 1
        probe = socket.socket()
        try:
            probe.bind(("127.0.0.1", port))
            probe.listen(1)
            return f"bind OK after {time.monotonic() - start:.3f}s ({attempts} attempts)"
        except OSError as error:
            last = repr(error)
        finally:
            probe.close()
        if time.monotonic() - start > budget:
            return f"bind FAILED for {budget}s ({attempts} attempts): {last}"
        time.sleep(0.01)


def case(mode: str) -> None:
    child = subprocess.Popen(
        [sys.executable, "-I", "-c", CHILD, mode], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True
    )
    assert child.stdin and child.stdout
    port = int(child.stdout.readline())
    client = None
    if mode != "listener-only":
        client = socket.create_connection(("127.0.0.1", port))
        client.sendall(b"hello")
        time.sleep(0.2)
        if mode == "client-first":
            client.close()
            client = None
            time.sleep(0.2)
    child.stdin.write("go\n")
    child.stdin.flush()
    child.wait(10)
    if client is not None:
        client.close()
    time.sleep(0.05)
    print(f"== {mode}: child exit {child.returncode}; port {port}")
    print("   netstat before bind:", netstat(port) or "(none)")
    print("   immediate single bind:", bind_until(port, 0.0))
    print("   bounded retry 1s:", bind_until(port, 1.0))
    print("   bounded retry 30s:", bind_until(port, 30.0))
    print("   netstat after:", netstat(port) or "(none)")
    for timeout in (0.25, 3.0):
        start = time.monotonic()
        try:
            socket.create_connection(("127.0.0.1", port), timeout=timeout).close()
            outcome = "CONNECTED"
        except OSError as error:
            outcome = repr(error)
        print(f"   connect timeout={timeout}s -> {outcome} after {time.monotonic() - start:.3f}s")


def main() -> None:
    print(sys.version, sys.platform)
    for mode in ("listener-only", "client-first", "server-first"):
        case(mode)


if __name__ == "__main__":
    main()
