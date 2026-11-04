"""Mutation check of the Windows 11 rehearsal correction (run from the repository root).

Each mutant edits one source file in place, runs the two Windows 11 test files, and
restores the exact original bytes. A mutant is killed when the tests fail.
"""

import subprocess
import sys

FILES = {
    "o": "scripts/windows11/windows11_owned.cs",
    "b": "scripts/windows11/windows11_bootstrap.ps1",
    "c": "scripts/windows11/windows11_candidate.py",
}
TESTS = [
    "scripts/tests/test_windows11_guest_driver.py",
    "scripts/tests/test_windows11_host_runtime.py",
]
MUTANTS = {
    "keys-no-settle": ("o", "            SettleKeyboardFocus(hwnd);\n            if(GetForegroundWindow()!=hwnd) throw", "            if(GetForegroundWindow()!=hwnd) throw"),
    "shellkeys-no-settle": ("o", "            SettleKeyboardFocus(hwnd);\n            if(GetForegroundWindow()!=hwnd||", "            if(GetForegroundWindow()!=hwnd||"),
    "no-handoff": ("o", "try { SetFocus(window); }", "try { }"),
    "quiet-zero": ("o", "FocusQuietMilliseconds=250", "FocusQuietMilliseconds=0"),
    "accept-any-window": ("o", "} else held=IntPtr.Zero;", "} else return;"),
    "members-one-direction": ("o", "if(count!=assigned) throw new InvalidOperationException(", "if(count<assigned) throw new InvalidOperationException("),
    "waitempty-throws": ("o", "try { members=Members(); changing=null; } catch(InvalidOperationException error) { if(error is ObjectDisposedException) throw; changing=error; }", "members=Members();"),
    "waitempty-drops-counts": ("o", "            if(changing!=null) throw changing;\n", "\n"),
    "focuspid-from-hwnd": ("o", "focusThread=focus==IntPtr.Zero?0:GetWindowThreadProcessId(focus,out focusPid);", "focusThread=focus==IntPtr.Zero?0:GetWindowThreadProcessId(hwnd,out focusPid);"),
    "foreground-throws": ("o", 'if(GetForegroundWindow()!=hwnd) kind="foreground elsewhere";', 'if(GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Owned foreground changed before fixed key sequence");'),
    "nonmember-transient": ("o", 'else if(!new HashSet<uint>(Members()).Contains(focusPid)) throw new OwnedInvariantException("Owned keyboard focus window outside retained job");', 'else if(!new HashSet<uint>(Members()).Contains(focusPid)) kind="outside owned window";'),
    "handoff-unbounded": ("o", "if(!worker.Join(milliseconds)) throw", "worker.Join(); if(false) throw"),
    "handoff-after-deadline": ("o", 'if(left<=0) throw new InvalidOperationException("Owned WebView2 keyboard focus did not settle; last: "+kind);', "if(left<=0) left=1;"),
    "handoff-error-dropped": ("o", "if(failure!=null) throw failure;", "if(failure!=null) return;"),
    "foreground-owner-in-condition": ("o", "while(!(SetForegroundWindow(hwnd)&&GetForegroundWindow()==hwnd)) {", 'while(!(SetForegroundWindow(hwnd)&&GetForegroundWindow()==hwnd&&ForegroundOwner()!="")) {'),
    "fixture-before-firstlogon": ("b", None, None),
    "attestor-no-user-wait": ("b", "    while([string]::IsNullOrEmpty([string]$system.UserName) -and $userClock.Elapsed.TotalSeconds -lt 60) {", "    while($false -and $userClock.Elapsed.TotalSeconds -lt 60) {"),
    "attestor-waits-any-user": ("b", "    while([string]::IsNullOrEmpty([string]$system.UserName) -and $userClock.Elapsed.TotalSeconds -lt 60) {", "    while($system.UserName -cne ($env:COMPUTERNAME+'\\JappFixture') -and $userClock.Elapsed.TotalSeconds -lt 60) {"),
    "attestor-unbounded-user-wait": ("b", "-and $userClock.Elapsed.TotalSeconds -lt 60) {", "-and $userClock.Elapsed.TotalSeconds -lt 600) {"),
    "absent-default-true": ("c", 'source_checks.get("attestor_body_parsed") is not True', 'source_checks.get("attestor_body_parsed", True) is not True'),
}


def main() -> int:
    original = {key: open(path, encoding="utf-8").read() for key, path in FILES.items()}
    fixture = next(line for line in original["b"].splitlines(True) if "'JappFixture.cmd'" in line)
    killed = 0
    try:
        for name, (key, old, new) in MUTANTS.items():
            text = original[key]
            if name == "fixture-before-firstlogon":
                anchor = "$profileHive = 'HKU\\JappDefaultProfile'\n"
                rest = text.replace(fixture, "")
                assert rest.count(anchor) == 1
                mutated = rest.replace(anchor, fixture + anchor)
            else:
                assert text.count(old) == 1, name
                mutated = text.replace(old, new)
            with open(FILES[key], "w", encoding="utf-8") as handle:
                handle.write(mutated)
            run = subprocess.run(
                [sys.executable, "-I", "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", *TESTS],
                capture_output=True, text=True, check=False,
            )
            with open(FILES[key], "w", encoding="utf-8") as handle:
                handle.write(original[key])
            killed += run.returncode != 0
            print(f"{name:30} {'KILLED' if run.returncode else 'SURVIVED'} {run.stdout.strip().splitlines()[-1]}")
    finally:
        for key, path in FILES.items():
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(original[key])
    restored = all(open(path, encoding="utf-8").read() == original[key] for key, path in FILES.items())
    print(f"killed {killed} of {len(MUTANTS)}; sources restored: {restored}")
    return 0 if killed == len(MUTANTS) and restored else 1


if __name__ == "__main__":
    raise SystemExit(main())
