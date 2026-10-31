# a010835 hosted CI: verification PASS, Windows package FAIL, root cause established

Source `a010835140df3b766734c5c22b9cb4438f82714e` (tree `ca0ec13d0e0f38dcb8f96d28f66941404d02585d`), pull-request merge `8a2043f6617b0cc99edecee38117c6ae296e7d37`, run [40989502173](https://github.com/kalwad/jobapplyv2/actions/runs/40989502173) attempt 1: terminal **FAILURE**.

## What the run shows

| Job | Result | Detail |
|---|---|---|
| doctor + verify (macos-15) | PASS | 20 ACTIVE suites PASS; Python 2882 passed in 797.31 s |
| doctor + verify (ubuntu-24.04) | PASS | 20 ACTIVE suites PASS; Python 2882 passed in 605.38 s |
| doctor + verify (windows-2025) | PASS | 20 ACTIVE suites PASS; Python 2880 passed in 996.18 s |
| native development package (ubuntu-24.04) | PASS | steps 10–15 succeed; the owned service actor's test harness passes (`ubuntu-15-package-actor.stdout`) and it prints `PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0` (`ubuntu-15-package-actor.stderr`) |
| native development package (windows-2025) | FAIL | `10-tauri-package`: `exit_code 0`, `terminated_job true`, `success false` (`windows-10-tauri-package.result.json`) |

Both package jobs pass the exact wheel/source gate that failed at cf9b60d, so KI-0140 is FIXED. Windows Server CI is a build host only; it is not Windows 11 desktop evidence.

Artifacts (expire 2026-11-06): Windows proof `12950094607` (sha256 `88004b46…`), Ubuntu proof `12951100409` (sha256 `a56f9fa9…`), GNOME package input `12951145108` (sha256 `9234d5b6…`).

## Root cause of the Windows failure (KI-0137)

The failed record shows the direct `tauri build` exited 0 but the held Job still had a member after the bounded 12 s natural drain, so strict cleanup terminated it and refused success. The record did not name the member, so the cause was investigated with throwaway Windows experiments on scratch branches `diag/windows-job-linger` and, for round 6b only, `diag/windows-job-linger-norc` (never merged; `diagnostic/branch-commits.txt`). Each experiment runs one command inside a fresh Job and enumerates members that outlive it (`diagnostic/job_linger_diag.py`, final version; earlier rounds used subsets of its tracing). VCTIP behaves as a singleton (round 3 traced 52 `link.exe` but one `vctip.exe`), so an instance started before a probe can hide later starters; rounds 6, 6b and 7 run on runners where no earlier MSVC tool had run.

| Round | Run | Observation |
|---|---|---|
| 1 | 41101101252 | `cargo build` of a hello crate with MSVC `link.exe` leaves `VCTIP.EXE` (MSVC 14.51.36231 Hostx64\x64) alive > 720 s (observation window); same with `strip=debuginfo` (> 60 s window); no `mspdbsrv.exe`; with `rust-lld` the hello Job drains at +0.0 s; the full `japp-desktop` build with `link.exe` leaves `VCTIP.EXE` alive > 300 s (window) |
| 2 | 41103357965 | `VSCMD_SKIP_SENDTELEMETRY=1` does not stop it (> 90 s); the desktop build with `rust-lld` still leaves `VCTIP.EXE` (> 120 s). The round-2 `dumpbin` probe ran after an un-Jobbed MSVC build had already started VCTIP, so it is inconclusive (superseded by round 7) |
| 3 | 41105253017 | lineage: with `link.exe`, VCTIP's parent is `link.exe` under `rustc.exe`; with `rust-lld`, its parent is `cl.exe` under a build script; the Visual Studio SQM `OptIn=0` registry opt-out does not stop it (> 90 s) |
| 4–5 | 41106303366, 41107379915 | an explicit Windows SDK `rc.exe` does not remove VCTIP from the build; round 5 identifies the `cl.exe` as the `vswhom-sys` build script compiling `ext/vswhom.cpp` (embed-resource's build-time Visual Studio finder; `cc` also archives with `lib.exe`, which was never observed as VCTIP's parent). The test-harness compiles in these rounds ran `mt.exe` and drained, but a VCTIP may already have been running |
| 6, 6b | 41108392333, 41108437778 | on fresh runners, `rust-lld` plus LLVM `clang-cl`/`llvm-lib` for build-time C/C++: the desktop `cargo build` and its `cargo test --no-run` both drain naturally at +0.0 s, with (6) or without (6b) an explicit `rc.exe`; in round 6 `rc.exe` and `mt.exe` ran inside drained Jobs |
| 7 | 41112771730 | on a fresh runner with no earlier MSVC tool, `dumpbin /headers /dependents /imports` (which runs `LINK /DUMP`) drains naturally at +0.0 s; LLVM `llvm-readobj` also drains |

Exact observation lines are in `diagnostic/round1-observations.txt` and `diagnostic/rounds2-7-observations.txt`; the executed workflow of each round is `diagnostic/workflow-*.yml` (`workflow-80b0c14.yml` is round 7, `workflow-norc.yml` is round 6b). The PE properties of the `rust-lld`-linked executable are in `diagnostic/pe-observations.txt`: x64 machine, Windows GUI subsystem, imported DLLs and a 192 MB PDB from round 2, and the embedded Common-Controls v6 manifest and 0.0.1 version resource from round 6b. These experiments ran `cargo build`/`cargo test` directly, not the exact `tauri build` pipeline command, so they support but do not replace a hosted package run.

## Correction (separate commit, not validated by this run)

`scripts/native_package_ci.py` pins the exact toolchain `rust-lld.exe` and PATH-resolved `clang-cl`/`llvm-lib`; `scripts/native_package_pipeline.py` (`windows_build_tools`) requires them and sets `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` plus `CC/CXX/AR_x86_64_pc_windows_msvc` for the Windows package build only; `scripts/native_package_retention.py` retains the three new tool roles. The strict zero-intervention cleanup policy and the pinned process helper are unchanged. Fresh hosted CI of that commit is required before any Windows package result is claimed; native Windows 11 launch evidence remains a separate W07 requirement.

An independent separate-context review of the first correction commit (2a93a3c/ec4622e) found that the evidence curator's tool-role allowlist omitted the new roles, which would have failed every Windows package job, plus the evidence-wording issues corrected above. Those are fixed in the follow-up commit with a static drift guard and behavioural retention tests.
