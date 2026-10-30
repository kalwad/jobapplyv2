# b4b5b96 hosted CI: first fully successful run; Windows packaged service actor passes

Source `b4b5b96cf9014474ea71442581491e9f87f6a6c0` (tree `6a40b7905199c98655dc357a5170829e07e10c83`), pull-request merge `f4854e2f33757f9f367d18820d44911b44182061` (same tree; `run-metadata.json`), run [41139850970](https://github.com/kalwad/jobapplyv2/actions/runs/41139850970) attempt 1: terminal **SUCCESS**.

| Job | Result | Detail |
|---|---|---|
| doctor + verify (macos-15) | PASS | 20 ACTIVE suites PASS; Python 2899 passed in 917.05 s |
| doctor + verify (ubuntu-24.04) | PASS | 20 ACTIVE suites PASS; Python 2899 passed in 716.43 s |
| doctor + verify (windows-2025) | PASS | 20 ACTIVE suites PASS; Python 2897 passed in 1195.82 s; the Windows-only `os_windows_directory_forms_the_service_environment` test passes in each of the three desktop test runs |
| native development package (ubuntu-24.04) | PASS | owned service actor PASS, cleanup 221 ms (`ubuntu-15-package-actor.stderr`) |
| native development package (windows-2025) | PASS | steps 10–15 exit 0 with `success true`, `terminated_job false` and zero active Job members (`windows-1[0-5]-*.result.json`); owned service actor: `PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0`, cleanup 277 ms (`windows-15-package-actor.stderr`) |

Counts come from the raw job logs (`verify-log-extracts.txt`). The Windows package actor launched the packaged service through the corrected adapter with `SystemRoot` as its only environment variable and reached READY, authenticated health/ready/version requests, owned shutdown, authority withdrawal and listener release, so KI-0142 is fixed on the hosted Windows build host. The actor's Windows listener-release oracle passed unchanged, as the b74d867 diagnostic predicted.

`windows-artifact-manifest.json` is the Windows artifact's root `manifest.json`, the file a Windows 11 request binds by SHA-256. The artifact's raw bytes (CRLF) hash to `2170b8b8b8d5156ac38a46db3b3d6ce68b87cb717f1f80e670fbfbdee22a893c`; this committed copy is LF-normalized, so its own hash differs. `windows-package-probe-input.json` holds the runtime pins the actor used.

Windows Server 2025 CI is a build host, not Windows 11 desktop evidence, and Ubuntu CI is not a default GNOME desktop: M03-W07 still requires the native Windows 11 x64 package campaign. Artifacts (expire 2026-11-06): Windows proof `13020593172` (sha256 `d205b30e…`), Ubuntu proof `13021481393` (sha256 `fef70129…`), GNOME package input `13021446265` (sha256 `a4408aa4…`).
