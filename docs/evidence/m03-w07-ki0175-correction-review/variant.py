"""Run a guest-driver test file against variant guest/bootstrap sources.

Usage: variant.py <repo> <workdir> <guest.ps1> <bootstrap.ps1> <test.py>
Prints one line per test outcome plus the summary.
"""

import shutil
import subprocess
import sys
from pathlib import Path

repo, work, guest, bootstrap, test = (Path(a) for a in sys.argv[1:6])
if work.exists():
    shutil.rmtree(work)
(work / "scripts" / "tests").mkdir(parents=True)
shutil.copytree(
    repo / "scripts" / "windows11",
    work / "scripts" / "windows11",
    ignore=shutil.ignore_patterns("__pycache__"),
)
shutil.copyfile(guest, work / "scripts" / "windows11" / "windows11_guest.ps1")
shutil.copyfile(bootstrap, work / "scripts" / "windows11" / "windows11_bootstrap.ps1")
(work / "scripts" / "linux_gnome").symlink_to(repo / "scripts" / "linux_gnome")
(work / "services" / "orchestrator" / "src").mkdir(parents=True)
(work / "services" / "orchestrator" / "src" / "orchestrator").symlink_to(
    repo / "services" / "orchestrator" / "src" / "orchestrator"
)
(work / "apps" / "desktop").mkdir(parents=True)
(work / "apps" / "desktop" / "src").symlink_to(repo / "apps" / "desktop" / "src")
shutil.copyfile(test, work / "scripts" / "tests" / "test_windows11_guest_driver.py")
(work / "pytest.ini").write_text("[pytest]\n")
result = subprocess.run(
    [
        str(repo / ".venv" / "bin" / "python"),
        "-I",
        "-B",
        "-m",
        "pytest",
        "-q",
        "-p",
        "no:cacheprovider",
        "-rA",
        "--rootdir",
        str(work),
        "-c",
        str(work / "pytest.ini"),
        str(work / "scripts" / "tests" / "test_windows11_guest_driver.py"),
    ],
    cwd=work,
    capture_output=True,
    text=True,
    env={"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"},
)
for line in result.stdout.splitlines():
    if line.startswith(("FAILED", "ERROR")) or " passed" in line or " failed" in line:
        print(line)
print("exit", result.returncode)
