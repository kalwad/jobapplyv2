# Windows 11 rehearsal correction: separate reviews and mutation evidence

This packet covers the source correction that came out of the Windows 11 campaign rehearsal rounds 38 to 50 (docs/evidence/m03-native-runtime-diagnostics, windows-rehearsal-rounds). It addresses KI-0176 to KI-0187.

The changed sources are:
- scripts/windows11/windows11_vm.py: Hyper-V enlightenments in the QEMU CPU flags, and a host-side restart check.
- scripts/windows11/windows11_bootstrap.ps1: the first-logon Default-profile state, the classic console host and the display timeout, all applied before the guest's startup entry; and the attestor's bounded wait for the console user.
- scripts/windows11/windows11_guest.ps1: the COM2 write bound.
- scripts/windows11/windows11_owned.cs:
  - bounded foreground requests that name the foreground's holder on refusal;
  - bare dxdiag tokens;
  - the WebView2 keyboard-focus settle;
  - the job-list 'not yet' state.
- scripts/windows11/windows11_source_check.ps1 and windows11_candidate.py: the attestor-body parse.
- apps/desktop/src-tauri/src/service/{supervisor.rs,restart.rs,quit_tests.rs}: the desktop app's first-start bound.

The tests, the WINDOWS11_NATIVE_PINS in scripts/check_portability.py and the exact Python test inventory changed with them.

## Reviews

Both reviews are separate-context workflows that the implementing session launched, so neither is an owner-independent review.

### Review 1: `wf_14f24cc1-da9` (`review-1-workflow-result.json`)

The review used 72 agents:
- **Lenses:** seven, covering
  - the keyboard-focus settle;
  - the rest of the owned helper;
  - the PowerShell sources;
  - the host harness;
  - the desktop supervisor;
  - the truth of the evidence and records;
  - test quality.
- **Verification:** two refuting verifiers for each finding.
- **Critic:** one completeness critic.

Thirty findings survived verification, four of them blocking, and the critic added two, one of them blocking. Most concerned the records; each is corrected:
- **Records:**
  - KI-0176 was left OPEN.
  - KI-0181 miscounted the VMs and framed the crash split by console host rather than by runner CPU vendor.
  - KI-0182 overstated the measured timings.
  - KI-0183 miscounted the VMs and had no frame evidence.
  - KI-0180 misdescribed the dxdiag probes.
  - KI-0184 left out rounds 43 and 44.
  - The retention manifest was stale.
  - Comments overstated the COM2 write time.
- **Undisclosed device-encryption change (critic, blocking):** the diagnostic bootstraps of rounds 42 to 47 prevented device encryption, a target-OS change. It is now disclosed in the evidence README, and rounds 48 to 50 ran without it.
- **Code:**
  - The race's own brief foreground change now counts as 'not yet'.
  - A non-member focus window is an owned invariant.
  - The focus handoff runs on a bounded worker thread.
  - The first-logon steps precede the startup entry.
  - The job list's 'not yet' state covers either direction.
- **Tests:** a missing-key receipt case, the focus pid derivation, and a restart-owner relaunch.

### Review 2: `wf_7bf4ba4b-061` (`review-2-workflow-result.json`)

The second review covered only the changes made after review 1, plus a check of every review 1 disposition. It used 34 agents: five lenses, two refuting verifiers per finding and a completeness critic. Of 14 findings, verifiers refuted one; 13 survived, three of them blocking:
- `WaitEmpty` discarded the job-list values that KI-0185 claimed a recurrence records.
- KI-0179's budget arithmetic left out dxdiag after the attestation mark (two findings).

The critic added three more about recorded numbers and claims: KI-0186's attestor timings, KI-0179's dxdiag VM count, and the scope of KI-0187's diagnostic.

All of them are corrected:
- `WaitEmpty` now refuses with the values when the list is still changing at its deadline.
- The focus handoff never starts after its bound.
- The budget sentence now adds the measured dxdiag times.
- The round 48 attestor traces are retained.
- The wording in KI-0181, KI-0184, KI-0186 and KI-0187, the supervisor comment and the README is corrected.

## Mutation

`mutants.py`, run from the repository root against the final sources, applies 20 mutants: the KI-0184 settle and handoff, the KI-0185 job list, the KI-0186 user wait, the KI-0187 diagnostic, the bootstrap order and the KI-0176 receipt check. For each, it runs scripts/tests/test_windows11_guest_driver.py and test_windows11_host_runtime.py, then restores the exact source bytes. `mutants-result.txt` is its output: 20 of 20 killed, sources restored. The Rust relaunch-bound mutant (the restart owner's relaunch moved to the first-start bound) was checked separately with `cargo test --lib -q service::restart::tests::first_start_and_relaunch` and fails as expected.

## Limits

- The C# is compiled only by Windows PowerShell 5.1. The hosted source-check jobs of rounds 48 to 50 compiled each version as it then stood.
- KI-0187's cause is unknown; the correction only records the foreground's holder at a refused request.
- None of this is campaign evidence.
