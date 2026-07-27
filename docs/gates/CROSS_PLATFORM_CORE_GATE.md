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

Every reference used by a future `PASS` must resolve to a scoped evidence
record: `docs/TEST_EVIDENCE.md` under the relevant M17/M27 package heading,
`docs/gates/HOLDOUT_EXECUTION_LOG.md` under a Gate D heading, or a dedicated
file below `docs/gates/evidence/`. Markdown links and `path § heading` /
`path#heading` forms are accepted when the approved file and optional heading
exist. URLs, arbitrary or irrelevant repository files, absolute paths,
traversal, symlink escapes, missing files/headings, and placeholders such as
`pending`, `TBD`, or arbitrary non-path text are rejected.

Before `PASS`, every Gate D metric row in `docs/CRITICAL_GATES.md` must contain
a non-placeholder measured result and record zero zero-tolerance failures.
The status table, critical-gate ledger, and this report must agree on `PASS`,
the exact tree revision, complete evidence hash, independent reviewer,
passing holdout result, and owner decision. All certified rows in
`PLATFORM_SUPPORT.md` and `CERTIFIED_MATRIX.md` must be `CERTIFIED_FULL`;
model profiles must be `CERTIFIED_FULL`/`ACCEPTED`; native-messaging and
packaging/update rows must be `VERIFIED`; every one must carry scoped,
resolving evidence. `M27-W12` owns the independent terminal decision.

No such product evidence exists through M00-W10. Windows and Ubuntu full-AI
profiles are explicitly not accepted. M00-W10 only made the future evidence
checks fail closed; it did not add platform evidence.

## Run history

No Gate D run has occurred.
