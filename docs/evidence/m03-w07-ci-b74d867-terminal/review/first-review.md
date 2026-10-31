# First independent review of the KI-0142 correction (separate context, read-only)

Reviewer: a general-purpose subagent with no access to the implementer's conclusions, given the diff and evidence paths only; 2026-10-30UTC. Verbatim final report follows.

No blocking findings. The environment block, the `GetSystemWindowsDirectoryW` call and the security intent are all correct. The gaps are in test coverage, in claims the evidence packet does not retain, and in latent environment-dependent behaviour that the elevated CI runner would hide.

The working tree changed after the session snapshot: `docs/TEST_EVIDENCE.md` is also modified (lines 12432–12445), and I reviewed it too. I re-ran `cargo test --locked windows_policy` (24 passed), `cargo test service_environment` (2 passed), `cargo check --locked --features windows-source-check` (clean) and `python3 scripts/validate_status.py` (PASS). The retention-manifest hashes and sizes match all 14 files. The committed stdout/stderr files match the `stdout_sha256`/`stderr_sha256` values in `windows-15-package-actor.result.json`. I edited nothing; the working tree is unchanged.

**1. Environment block format and lifetime — no finding**
- `windows_policy.rs:30-33` builds `SystemRoot=<root>` followed by two NULs: one ends the entry, one ends the block. With CREATE_UNICODE_ENVIRONMENT (`windows_policy.rs:4`, 0x400) that is a valid one-entry block, and the sorting rule doesn't matter with one entry.
- Lifetime: `environment` is created at `windows_native.rs:661` and borrowed inside the closure at `:709`. It outlives the synchronous `CreateProcessW` call, which copies the block.
- Casing doesn't matter: Windows lookups and `ExpandEnvironmentStrings` ignore case, and Python upper-cases keys. The old `[0,0]` was a valid empty block, so the bug was missing content, not a bad format.

**2. `GetSystemWindowsDirectoryW` — no finding**
- `windows_native.rs:644-652`: with a 261-unit buffer, success returns at most 260, a too-small buffer returns at least 262 (size includes the NUL), and failure returns 0. The check `length == 0 || length >= 261` separates all three cases.
- The binding matches windows-sys 0.61.2 (`(PWSTR, u32) -> u32`). Choosing the System variant over `GetWindowsDirectoryW` is right, because it ignores the per-user Terminal Services directory.
- NOTE: `GetLastError` is discarded. That matches the module's opaque error style. Calling it on every spawn costs almost nothing, so there is no need to cache it.

**3. `service_environment` validation and tests**
- Sound, and it won't refuse a real Windows directory: drive-absolute, no trailing backslash per the API contract, Unicode allowed. The `=` refusal is stricter than needed but harmless.
- It cannot panic: the slices at `:21` and `:24` are only reached after bytes 0–2 are proven ASCII.
- NON-BLOCKING: the refusal tests (`:187-211`) don't cover every rule. These mutants would survive:
  - deleting `c == "."` (only `..` is tested, at `:198`);
  - deleting `!bytes[0].is_ascii_alphabetic()` (nothing tests something like `1:\Windows`);
  - removing any of `< > " / | ? *` from the reserved set (`C:/Windows` at `:194` is refused by the `:\` prefix check, not by the reserved-character set);
  - changing `> 260` to `>= 260` (only a 261-unit path is tested, at `:210`; an exactly-260 path is never accepted).

  So "Policy tests pin … the refusals" (`KNOWN_ISSUES.md:64`) is a little stronger than the tests. The five recorded mutants (`TEST_EVIDENCE.md:12442`) are plausibly killed.
- NOTE: the exact-block test (`:178-185`) pins the format and casing. Whether `spawn()` actually uses the OS value is only provable on hosted Windows CI, and the docs say so.

**4. Running with SystemRoot only on Windows 11 versus Server CI**
- **Evidence-backed:**
  - The probe reaches READY on windows-2025.
  - Two earlier pieces of evidence aren't cited: `services/orchestrator/tests/test_service_cli.py:69` already runs the service from source with only `SYSTEMROOT` in the Windows verify jobs, and `api_client/tests/python_runtime.rs:63-71` already notes that Windows Python needs it.
  - The current service source uses no `tempfile`, sqlite, `Path.home`/`expanduser`, `os.environ`, `getpass`, `platform` or `subprocess`.
  - Outbound connections use the literal 127.0.0.1, so asyncio skips name resolution.
  - The build is onedir (`build-windows-runtime.py:333`), so nothing is extracted to a temp folder.
  - `os.urandom` uses BCrypt, which needs no environment variables.
  - Nothing evidenced fails today.
- **NOTE, a latent trap that CI would hide:**
  - Python's `tempfile` falls back to `%SYSTEMROOT%\Temp`, the machine-wide `C:\Windows\Temp`. I confirmed this from CPython 3.12's `_candidate_tempdir_list`.
  - The native `GetTempPathW`, which SQLite uses on Windows, falls back to the Windows directory itself, `C:\Windows\`. The CI user (`runneradmin`, elevated) can write there; a standard non-elevated Windows 11 user cannot.
  - `expanduser('~')` stays as a relative `~`.
  - Once the service gains SQLite storage or file uploads, it will pass CI and fail on desktops. Suggestion: pass explicit data and temp directories over the bootstrap, or point TEMP/TMP at a private directory the supervisor owns. Record this in `KNOWN_ISSUES.md`.
- **NOTE, speculative:**
  - Third-party Winsock layered or namespace providers registered with other variables (e.g. `%ProgramFiles%`) could still fail with error 10106 on consumer desktops. A clean evaluation VM won't exercise this.
  - The probe used Python `Popen`: all inheritable handles, piped stderr, no Job, not suspended. That differs from the adapter's handle list, Job, suspended start, no-window flag and stderr to `NUL`. The probe proves an empty environment is enough to fail, not that SystemRoot is enough under the adapter, so a second failure may be hidden behind this one. The docs already require fresh hosted results.

**5. Security and privacy — no finding**
- The value comes from the kernel-provided system root, not from the parent's environment. A tampered parent `%SystemRoot%` can no longer redirect Winsock DLL loads, which is stronger than the test helper at `python_runtime.rs:69` (test-only).
- Refusing NUL, control characters and `=` blocks injecting a second variable.
- With no PATH, the DLL search is narrower.
- No credential is passed. The "inherits nothing" comment at `windows_policy.rs:11` remains accurate.

**6. Evidence honesty**
- **Verified:**
  - `10-tauri-package` took 197.188 s.
  - The actor exited 101 after 2.42 s, with `terminated_job false` and 0 Job members.
  - Every probe exit code, the 0.88 s READY, the payload and the empty stderr match `probe-observations.txt`.
  - The Ubuntu cleanup took 242 ms.
- **NON-BLOCKING, step claims not retained:** `README.md:11,17`, `summary.json:29-37`, `KNOWN_ISSUES.md:37,76` and `PROJECT_STATUS.md:33` say steps 01–14 (including 11-package-stage, 12-package-inspect and both 12-pe-* steps) succeeded with `terminated_job false` and zero Job members. The packet keeps result files only for steps 10, 13, 14 and 15; the f30f023 packet did keep the 11/12 results. Copy them in or narrow the claim.
- **NON-BLOCKING, "pinned entrypoint" not retained:** `README.md:23`, `KNOWN_ISSUES.md:62` and `TEST_EVIDENCE.md:12436` say the hash "equals the pinned entrypoint". The packet only holds the computed hash (`probe-observations.txt:14`). `workflow-2aecfea.yml:25` just prints `Get-FileHash` and compares nothing, and no retained file contains the pinned value.
- **NOTE:**
  - The Python test counts and timings (`README.md:7-9`) come from logs that weren't retained; the README says so at line 13.
  - `→ import _overlapped` (`README.md:29`, `KNOWN_ISSUES.md:62`) is inferred. The frozen traceback (`probe-observations.txt:61`) shows only "windows_events.py, line 8" with no source text; the runner CPython traceback (`:40-41`) shows that line.
  - `KNOWN_ISSUES.md:61` says "the child exits 1". The CI child's exit code was never observed (stderr went to `NUL`; the supervisor reports only `ChildExited`). Exit 1 comes from the probe.
  - `README.md:21` presents `terminated_job`/Job members as part of the owned cleanup. Those fields belong to the pipeline's held Job around the test binary, not to `PACKAGE_OWNED_CLEANUP`. Both are true; they are different layers.
  - KI-0142 doesn't mention that the SystemRoot dependency was already handled in `python_runtime.rs` and `test_service_cli.py`. Citing them strengthens the root cause and records the missed cross-check.
  - The comment at `windows_policy.rs:13-14` says "cannot bind", but the service fails earlier, at `import asyncio` (`runner.py:5`).
  - "First actual Windows launch" agrees with the cf9b60d, a010835 and f30f023 records. I didn't audit every earlier run.
