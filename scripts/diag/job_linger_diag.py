"""Diagnostic only: run one command inside a fresh Windows Job, then report
which Job members outlive the direct command and for how long."""
import ctypes
import ctypes.wintypes as wt
import json
import os
import subprocess
import sys
import threading
import time

k = ctypes.WinDLL("kernel32", use_last_error=True)
k.CreateJobObjectW.restype = wt.HANDLE
k.GetCurrentProcess.restype = wt.HANDLE
k.OpenProcess.restype = wt.HANDLE
k.AssignProcessToJobObject.argtypes = [wt.HANDLE, wt.HANDLE]
k.QueryInformationJobObject.argtypes = [wt.HANDLE, ctypes.c_int, ctypes.c_void_p, wt.DWORD, ctypes.c_void_p]
k.QueryFullProcessImageNameW.argtypes = [wt.HANDLE, wt.DWORD, wt.LPWSTR, ctypes.POINTER(wt.DWORD)]


class Entry(ctypes.Structure):
    _fields_ = [("size", wt.DWORD), ("usage", wt.DWORD), ("pid", wt.DWORD), ("heap", ctypes.c_size_t),
                ("module", wt.DWORD), ("threads", wt.DWORD), ("parent", wt.DWORD), ("base", ctypes.c_long),
                ("flags", wt.DWORD), ("exe", ctypes.c_wchar * 260)]


k.CreateToolhelp32Snapshot.restype = wt.HANDLE
k.Process32FirstW.argtypes = [wt.HANDLE, ctypes.POINTER(Entry)]
k.Process32NextW.argtypes = [wt.HANDLE, ctypes.POINTER(Entry)]


nt = ctypes.WinDLL("ntdll")
nt.NtQueryInformationProcess.argtypes = [wt.HANDLE, ctypes.c_int, ctypes.c_void_p, wt.ULONG, ctypes.POINTER(wt.ULONG)]


def details(pid: int) -> tuple[str, str]:
    h = k.OpenProcess(0x1000, False, pid)
    if not h:
        return "<gone>", "<gone>"
    buf = ctypes.create_unicode_buffer(2048); n = wt.DWORD(2048)
    image = buf.value if k.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n)) else "<image?>"
    raw = ctypes.create_string_buffer(65536); got = wt.ULONG(0)
    line = "<cmdline?>"
    if nt.NtQueryInformationProcess(h, 60, raw, 65536, ctypes.byref(got)) == 0:
        length = int.from_bytes(raw.raw[0:2], "little")
        line = raw.raw[16:16 + length].decode("utf-16-le", "replace")
    k.CloseHandle(h)
    return image, line


def snapshot() -> dict[int, tuple[int, str]]:
    h = k.CreateToolhelp32Snapshot(2, 0)
    e = Entry(); e.size = ctypes.sizeof(Entry); out = {}
    ok = k.Process32FirstW(h, ctypes.byref(e))
    while ok:
        out[int(e.pid)] = (int(e.parent), e.exe)
        ok = k.Process32NextW(h, ctypes.byref(e))
    k.CloseHandle(h)
    return out


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

    trace: dict[int, tuple[int, str, float]] = {}
    full: dict[int, tuple[str, str]] = {}
    TOOLS = {"cl.exe", "lib.exe", "link.exe", "mt.exe", "rc.exe", "vctip.exe", "cvtres.exe"}
    done = threading.Event()
    start = time.monotonic()

    def tracer() -> None:
        while not done.is_set():
            live = set(members())
            snap = snapshot()
            for pid in live:
                if pid not in trace and pid in snap:
                    trace[pid] = (snap[pid][0], snap[pid][1], round(time.monotonic() - start, 2))
                    if snap[pid][1].lower() in TOOLS or snap[pid][1].lower() == "build-script-build.exe":
                        full[pid] = details(pid)
            time.sleep(0.03)

    thread = threading.Thread(target=tracer, daemon=True)
    thread.start()
    code = subprocess.run(command, check=False).returncode
    time.sleep(0.5)
    done.set(); thread.join()
    names: dict[str, int] = {}
    for pid, (parent, exe, t) in trace.items():
        names[exe.lower()] = names.get(exe.lower(), 0) + 1
    print(f"[{label}] traced image counts: {sorted(names.items())}", flush=True)
    for pid, (parent, exe, t) in sorted(trace.items(), key=lambda x: x[1][2]):
        if exe.lower() in TOOLS:
            print(f"[{label}] TOOL {exe} pid={pid} at {t}s cmd={full.get(pid, ('', ''))[1][:400]!r}", flush=True)
            print(f"[{label}]   parent {parent}: {full.get(parent, ('<untraced>', ''))[0]} cmd={full.get(parent, ('', ''))[1][:300]!r}", flush=True)
        if exe.lower() == "vctip.exe":
            p = trace.get(parent)
            print(f"[{label}] VCTIP pid={pid} at {t}s parent={parent} parent_image={p[1] if p else '<unobserved>'} grandparent_image={trace.get(p[0], (0, '<unobserved>'))[1] if p else '-'}", flush=True)
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
