# a010835 hosted CI: verification PASS, Windows package FAIL, root cause established

Source `a010835140df3b766734c5c22b9cb4438f82714e` (tree `ca0ec13d0e0f38dcb8f96d28f66941404d02585d`), pull-request merge `8a2043f6617b0cc99edecee38117c6ae296e7d37`, run [40989502173](https://github.com/kalwad/jobapplyv2/actions/runs/40989502173) attempt 1: terminal **FAILURE**.

## What the run shows

| Job | Result | Detail |
|---|---|---|
| doctor + verify (macos-15) | PASS | 20 ACTIVE suites PASS; Python 2882 passed in 797.31 s |
| doctor + verify (ubuntu-24.04) | PASS | 20 ACTIVE suites PASS; Python 2882 passed in 605.38 s |
| doctor + verify (windows-2025) | PASS | 20 ACTIVE suites PASS; Python 2880 passed in 996.18 s |
| native development package (ubuntu-24.04) | PASS | steps 10–15 succeed; owned service actor prints `PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0` (`ubuntu-15-package-actor.stdout`) |
| native development package (windows-2025) | FAIL | `10-tauri-package`: `exit_code 0`, `terminated_job true`, `success false` (`windows-10-tauri-package.result.json`) |

Both package jobs pass the exact wheel/source gate that failed at cf9b60d, so KI-0140 is FIXED. Windows Server CI is a build host only; it is not Windows 11 desktop evidence.

Artifacts (expire 2026-11-06): Windows proof `12950094607` (sha256 `88004b46…`), Ubuntu proof `12951100409` (sha256 `a56f9fa9…`), GNOME package input `12951145108` (sha256 `9234d5b6…`).

## Root cause of the Windows failure (KI-0137)

The failed record shows the direct `tauri build` exited 0 but the held Job still had a member after the bounded 12 s natural drain, so strict cleanup terminated it and refused success. The record did not name the member, so the cause was investigated with throwaway Windows experiments on the scratch branch `diag/windows-job-linger` (never merged; `diagnostic/branch-commits.txt`). Each experiment runs one command inside a fresh Job and enumerates members that outlive it (`diagnostic/job_linger_diag.py`, final version; earlier rounds used subsets of its tracing).

| Round | Run | Observation |
|---|---|---|
| 1 | 41101101252 | `cargo build` of a hello crate with MSVC `link.exe` leaves `VCTIP.EXE` (MSVC 14.51.36231 Hostx64\x64) alive > 720 s; same with `strip=debuginfo`; no `mspdbsrv.exe`; with `rust-lld` the Job drains at +0.0 s; the full `japp-desktop` build leaves `VCTIP.EXE` > 300 s |
| 2 | 41103357965 | `VSCMD_SKIP_SENDTELEMETRY=1` does not stop it; `dumpbin` (`link /DUMP`) leaves nothing; the desktop build with `rust-lld` still leaves `VCTIP.EXE` |
| 3 | 41105253017 | lineage: with `link.exe` VCTIP's parent is `link.exe` under `rustc.exe`; with `rust-lld` its parent is `cl.exe` under a build script; the Visual Studio SQM `OptIn=0` registry opt-out does not stop it |
| 4–5 | 41106303366, 41107379915 | an explicit Windows SDK `rc.exe` does not help; the `cl.exe` is the `vswhom-sys` build script compiling `ext/vswhom.cpp` (embed-resource's build-time Visual Studio finder); `rc.exe` and `mt.exe` leave nothing |
| 6 | 41108392333, 41108437778 | `rust-lld` plus LLVM `clang-cl`/`llvm-lib` for build-time C/C++: the desktop build and its test-harness compile both drain naturally at +0.0 s, with or without an explicit `rc.exe`; the `rust-lld` executable keeps its x64 GUI subsystem, Common-Controls v6 manifest, version resource and PDB |

Exact observation lines are in `diagnostic/round1-observations.txt` and `diagnostic/rounds2-6-observations.txt`; the executed workflow of each round is `diagnostic/workflow-*.yml`.

## Correction (separate commit, not validated by this run)

`scripts/native_package_ci.py` pins the exact toolchain `rust-lld.exe` and PATH-resolved `clang-cl`/`llvm-lib`; `scripts/native_package_pipeline.py` (`windows_build_tools`) requires them and sets `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` plus `CC/CXX/AR_x86_64_pc_windows_msvc` for the Windows package build only. The strict zero-intervention cleanup policy and the pinned process helper are unchanged. Fresh hosted CI of that commit is required before any Windows package result is claimed; native Windows 11 launch evidence remains a separate W07 requirement.
