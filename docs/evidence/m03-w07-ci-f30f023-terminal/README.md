# f30f023 hosted CI: KI-0137 fixed; new Windows .gitignore newline failure

Source `f30f023a7b9d5150b1a3a95d64bc350fa2dd3df1` (tree `4d75c708bc67e396ee392cdf96f2b20d591f312c`), pull-request merge `cec2692ad28e8e99a94db1c822c9a23b714a5314` (same tree, since `origin/main` is an ancestor), run [41114369378](https://github.com/kalwad/jobapplyv2/actions/runs/41114369378) attempt 1: terminal **FAILURE**.

| Job | Result | Detail |
|---|---|---|
| doctor + verify (macos-15) | PASS | 20 ACTIVE suites PASS; Python 2897 passed in 1022.01 s |
| doctor + verify (ubuntu-24.04) | PASS | 20 ACTIVE suites PASS; Python 2897 passed in 468.13 s |
| doctor + verify (windows-2025) | PASS | 20 ACTIVE suites PASS; Python 2895 passed in 1168.04 s |
| native development package (ubuntu-24.04) | PASS | owned service actor: `PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0`, cleanup 242 ms (`ubuntu-15-package-actor.stderr`) |
| native development package (windows-2025) | FAIL | steps 01–12 succeed; the post-build source projection check refuses `apps/desktop/src-tauri/runtime-payload/.gitignore` (`windows-failure-traceback.txt`, `windows-shipping-status.txt`) |

## KI-0137 is fixed on the hosted Windows build host

With the correction from 2a93a3c/f30f023, `10-tauri-package` builds the desktop with the pinned toolchain `rust-lld` and LLVM `clang-cl`/`llvm-lib` (`windows-10-tauri-package.upfront.json`), exits 0 after 228.0 s and is strictly successful: `terminated_job false`, `job_active_processes 0`. The later `11-package-stage`, `12-package-inspect` and both `12-pe-*` `dumpbin` steps are also strictly successful with no intervention (`windows-*.result.json`). Evidence curation, which would have failed without the retention allowlist fix, succeeds.

## New failure (KI-0141)

`scripts/build-windows-runtime.py` restaged `runtime-payload/.gitignore` with `Path.write_text("*\n!.gitignore\n")`. On Windows text mode writes CRLF, so the owned checkout shows ` M apps/desktop/src-tauri/runtime-payload/.gitignore` and the strict projection check refuses before the native service actor runs. The repository pins LF line endings (`.gitattributes`), and Linux does not translate newlines, which is why Ubuntu passes. The correction writes the exact tracked bytes; its regression test emulates Windows text-mode translation and fails against the old code.

No Windows package was exported and no service actor ran on Windows; Windows Server CI is a build host, not Windows 11 desktop evidence. Artifacts (expire 2026-11-06): Windows proof `13009845076` (sha256 `b57dd4b4…`), Ubuntu proof `13008389238` (sha256 `5fa6d651…`), GNOME package input `13008793013` (sha256 `dafe3da8…`).
