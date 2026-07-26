# CROSS_PLATFORM_CORE Gate Report

Append-only report for Gate D. The authoritative current state is mirrored in
`docs/CRITICAL_GATES.md` and `docs/PROJECT_STATUS.md`.

## Current evaluation

- State: NOT_EVALUATED
- Evaluated revision: —
- Corpus/evidence hash: —
- Independent reviewer: —
- Owner decision: pending
- Holdout result: pending
- Evidence bundle: —
- Next permitted action: Complete the owning M03–M05, M10, M17, and M27
  packages; Gate D does not authorize M28 while unevaluated.

## Required native evidence

The gate requires actual packaged execution on macOS 14+ arm64, Windows 11
x64, and Ubuntu 24.04 LTS x64. Compilation, cross-compilation, emulation,
containers, hosted CI alone, or evidence from one operating system cannot
substitute for native packages.

Required evidence includes:

- install, launch, first-run diagnostics, local-service lifecycle, crash
  recovery, and zero orphan processes;
- platform-native secure storage with no plaintext fallback;
- Chrome native-messaging registration, handshake, repair, and removal;
- deterministic core operation with unavailable/insufficient AI;
- at least one accepted full-AI profile for every certified operating system;
- controlled PDF/DOCX and font results;
- portable encrypted backup/restore;
- update, rollback, repair, uninstall, and user-data preservation;
- exact OS, architecture, browser, artifact, date, raw logs, independent
  review, and owner decision.

No such product evidence exists during M00-W08. Windows and Ubuntu full-AI
profiles are explicitly not accepted.

## Run history

No Gate D run has occurred.
