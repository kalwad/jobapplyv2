# b74d867 hosted CI: KI-0141 fixed; Windows packaged service exits with an empty environment

Source `b74d867e544741d5de9736f72e79981a253c9ea2` (tree `fa1cbf24587a37cb800ccf58797c0912b8446a81`), pull-request merge `af74040c1371eab07d9671f2464d909a60ad626d` (same tree), run [41124431600](https://github.com/kalwad/jobapplyv2/actions/runs/41124431600) attempt 1: terminal **FAILURE**.

| Job | Result | Detail |
|---|---|---|
| doctor + verify (macos-15) | PASS | 20 ACTIVE suites PASS; Python 2899 passed in 1089.83 s |
| doctor + verify (ubuntu-24.04) | PASS | 20 ACTIVE suites PASS; Python 2899 passed in 721.16 s |
| doctor + verify (windows-2025) | PASS | 20 ACTIVE suites PASS; Python 2897 passed in 946.44 s |
| native development package (ubuntu-24.04) | PASS | owned service actor: `PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0`, cleanup 242 ms (`ubuntu-15-package-actor.stderr`) |
| native development package (windows-2025) | FAIL | the pipeline reaches `15-package-actor`, which exits 101 because the packaged service child exits before its READY acknowledgement (`windows-15-package-actor.stderr`, `windows-failure-traceback.txt`) |

The verify counts and timings come from the raw job logs (`gh api repos/kalwad/jobapplyv2/actions/jobs/<id>/logs`); `verify-log-extracts.txt` keeps each job's final pytest line and 20-row suite table (`gh run view --log` truncated those logs inside the verify step). `run-metadata.json` keeps the run, job and artifact IDs, conclusions and digests and the merge commit's tree and parents from the GitHub API.

## KI-0141 is fixed on the hosted Windows build host

The pipeline stops at its first failing step, so reaching step 15 means the post-build source projection check that refused the CRLF `runtime-payload/.gitignore` on f30f023 now passes. The retained results for `10-tauri-package` (197.2 s), `11-package-stage`, `12-package-inspect`, both `12-pe-*` `dumpbin` steps, `13-package-actor-compile` and `14-package-actor-catalog` all exit 0 with `success true`, `terminated_job false` and zero active Job members (`windows-1[0-4]-*.result.json`), so KI-0137 stays fixed as well.

## New failure (KI-0142): the Windows service gets an empty environment block

For the first time the Windows package actor ran. The test binary panicked with `Actual packaged service must acknowledge and prove health: ChildExited` after 2.4 s and reported `PACKAGE_OWNED_CLEANUP success=true` for the service it owns; separately, the pipeline's held Job around the test binary closed naturally (`terminated_job false`, zero active Job members). The native Windows adapter launched the service with an empty Unicode environment block and sends the child's stderr to `NUL`, so the CI record shows neither the child's exit code nor its error.

A diagnostic run ([41133099895](https://github.com/kalwad/jobapplyv2/actions/runs/41133099895), scratch branch `diag/windows-service-env` at `2aecfea`, never merged; `diagnostic/`) downloaded this run's Windows artifact by name and printed the SHA-256 of the extracted `japp-orchestrator.exe`: `CA4D4198…CAC1`, which is the `entrypoint_sha256` the CI package actor was pinned to (`windows-package-probe-input.json`). It then launched that executable with a synthetic non-secret bootstrap:

| Case | Result |
|---|---|
| runner CPython 3.12.10, empty environment | `os.environ` is empty; `socket.socket()` and `import asyncio` both fail with `OSError: [WinError 10106] The requested service provider could not be loaded or initialized`; the `import asyncio` traceback shows `import _overlapped` in `asyncio\windows_events.py` line 8 |
| runner CPython, `SystemRoot` only | `socket.socket()` succeeds |
| packaged service (frozen from CPython 3.12.13), empty environment | exit 1; the frozen traceback ends at `asyncio\windows_events.py` line 8 with WinError 10106 (`[PYI-2996:ERROR] Failed to execute script 'service_entry'`); the frozen traceback carries no source text, so `import _overlapped` is inferred from the runner's 3.12.10 source |
| packaged service, `SystemRoot` only | READY acknowledgement after 0.88 s (`bind_host 127.0.0.1`, the bootstrap identity and generation); exit 0 on lease EOF; empty stderr |

Winsock resolves its provider DLLs through `%SystemRoot%`, so with no environment the service fails while it imports `asyncio`, before it reads the bootstrap. Linux has no such dependency, which is why the Ubuntu actor passes with a cleared environment. The repository's own Windows test launchers already pass `SystemRoot` for this reason (`apps/desktop/src-tauri/src/api_client/tests/python_runtime.rs`, `services/orchestrator/tests/test_service_cli.py`); the production adapter did not. The correction gives the service exactly one variable, `SystemRoot`, taken from `GetSystemWindowsDirectoryW` rather than the inherited environment, so nothing from the parent environment and no credential reaches the child.

The probe used Python `subprocess` (inherited handles, piped stderr, no Job, not suspended), not the adapter's launch, so it proves that the empty environment is sufficient to fail, not that `SystemRoot` alone is sufficient under the adapter. The corrected adapter's hosted Windows package actor is the required proof.

## Next-step check: Windows listener-release oracle

Review predicted that, once READY works, the actor's Windows listener-release check (a single plain bind of the retired port, `scripts/package_validation.rs`) could fail because the service listener uses `SO_EXCLUSIVEADDRUSE` and uvicorn closes connections first. A second scratch-branch probe ([41137888774](https://github.com/kalwad/jobapplyv2/actions/runs/41137888774), `7dc7d35`; `diagnostic/tcp_release_probe.py`, `diagnostic/tcp-probe-observations.txt`) on windows-2025 refutes that: after a listener-only, client-first or server-first close, with a server-side `TIME_WAIT` entry still listed for that port in the server-first case, an immediate single plain bind of the port succeeds. It also shows why the Windows branch cannot reuse the Unix connection-refusal oracle: a connect to the closed local port times out at 0.25 s and is refused only after about 2.0 s. The oracle is unchanged.

## Local records and review

- `local-python-suite-failure.txt`: the local full Python suite on the uncommitted correction tree failed 16 status-validator tests because copied fixtures inherited the new live HIGH blocker (KI-0144); the extract lists every failure and the distinct validator errors.
- `local-mutation-run.txt`: one single-pass 28-mutant run over the final `windows_policy.rs` (27 killed; the survivor is equivalent, see KI-0142).
- `review/first-review.md`: the first separate-context review (no blocking findings), verbatim.
- `review/verification-workflow-result.json`: the multi-lens adversarial verification (launch, tests, evidence lenses, two refuters per finding, completeness critic); no blocking findings.
- `review/fixture-review.md`: the separate review of the KI-0144 status-fixture change (CLEAR_WITH_NOTES), verbatim.

Windows Server CI is a build host, not Windows 11 desktop evidence. Artifacts (expire 2026-11-06): Windows proof `13014200693` (sha256 `9c8f67a7…`), Ubuntu proof `13014140795` (sha256 `eda7cff6…`), GNOME package input `13012999851` (sha256 `fad8b4dd…`).
