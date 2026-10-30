"""Diagnostic only: run one command inside a fresh Windows Job, then report
which Job members outlive the direct command and for how long."""
import ctypes
import ctypes.wintypes as wt
import json
import os
import subprocess
import sys
import time

k = ctypes.WinDLL("kernel32", use_last_error=True)
k.CreateJobObjectW.restype = wt.HANDLE
k.GetCurrentProcess.restype = wt.HANDLE
k.OpenProcess.restype = wt.HANDLE
k.AssignProcessToJobObject.argtypes = [wt.HANDLE, wt.HANDLE]
k.QueryInformationJobObject.argtypes = [wt.HANDLE, ctypes.c_int, ctypes.c_void_p, wt.DWORD, ctypes.c_void_p]
k.QueryFullProcessImageNameW.argtypes = [wt.HANDLE, wt.DWORD, wt.LPWSTR, ctypes.POINTER(wt.DWORD)]


class IdList(ctypes.Structure):
    _fields_ = [("assigned", wt.DWORD), ("listed", wt.DWORD), ("ids", ctypes.c_size_t * 1024)]


def main() -> int:
    label, poll, stop = sys.argv[1], float(sys.argv[2]), sys.argv[3] == "stop"
    command = sys.argv[sys.argv.index("--") + 1 :]
    job = k.CreateJobObjectW(None, None)
    assert job, ctypes.get_last_error()
    assert k.AssignProcessToJobObject(job, k.GetCurrentProcess()), ctypes.get_last_error()
    me = os.getpid()

    def members() -> list[int]:
        data = IdList()
        assert k.QueryInformationJobObject(job, 3, ctypes.byref(data), ctypes.sizeof(data), None), ctypes.get_last_error()
        return [int(data.ids[i]) for i in range(data.listed) if int(data.ids[i]) != me]

    def image(pid: int) -> str:
        h = k.OpenProcess(0x1000, False, pid)
        if not h:
            return f"<open failed {ctypes.get_last_error()}>"
        buf = ctypes.create_unicode_buffer(2048)
        n = wt.DWORD(2048)
        ok = k.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n))
        k.CloseHandle(h)
        return buf.value if ok else f"<image failed {ctypes.get_last_error()}>"

    start = time.monotonic()
    code = subprocess.run(command, check=False).returncode
    exited = time.monotonic()
    print(f"[{label}] direct exit {code} after {exited - start:.1f}s", flush=True)
    seen: dict[int, str] = {}
    timeline = []
    stopped = False
    while True:
        now = time.monotonic() - exited
        live = members()
        for pid in live:
            if pid not in seen:
                seen[pid] = image(pid)
                print(f"[{label}] +{now:.1f}s member pid={pid} image={seen[pid]}", flush=True)
        timeline.append({"t": round(now, 1), "pids": live})
        if not live:
            print(f"[{label}] job drained naturally at +{now:.1f}s", flush=True)
            break
        if stop and not stopped and now > 3:
            stopped = True
            for pid in live:
                if seen[pid].lower().endswith("mspdbsrv.exe"):
                    r = subprocess.run([seen[pid], "-stop"], check=False, capture_output=True)
                    print(f"[{label}] mspdbsrv -stop exit {r.returncode} out={r.stdout[:300]!r} err={r.stderr[:300]!r}", flush=True)
        if now > poll:
            print(f"[{label}] still live after {poll}s: {[(p, seen[p]) for p in live]}", flush=True)
            for pid in live:
                q = subprocess.run(["powershell", "-NoProfile", "-Command", f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"], check=False, capture_output=True, text=True)
                print(f"[{label}] cmdline pid={pid}: {q.stdout.strip()[:600]}", flush=True)
            break
        time.sleep(1.0)
    print(json.dumps({"label": label, "exit": code, "build_seconds": round(exited - start, 1), "members_seen": seen}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
