# Requirements Traceability

Requirement → implementation → tests → release gate
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1 and §4).

## Update rules

- Every requirement in spec §4 must appear here with links to implementation
  modules, automated tests, manual test cases, and its release gate
  (spec §4 preamble).
- The full seed of all requirements and their milestone mapping is work
  package `M00-W07` ("Seed traceability and status", spec v1.2); rows are
  intentionally not seeded before that package executes.
- After seeding, a row is updated as part of the closeout of every work
  package that touches it. A requirement may not be marked `VERIFIED` without
  a `docs/TEST_EVIDENCE.md` entry, and no requirement may be dropped without
  an owner decision in `docs/DECISIONS.md`.
- Row status enum: `UNMAPPED | NOT_STARTED | IN_PROGRESS | IMPLEMENTED |
  VERIFIED | ACCEPTED` (`UNMAPPED` only before M00-W07 completes).
- The final audit that every requirement has implementation, tests, evidence,
  and no orphan code is `M38-W01`.

## Requirement families (spec v1.2 §4) — 135 requirements total

- `REQ-PROF-001` … `REQ-PROF-007` — profile and evidence (7)
- `REQ-RES-001` … `REQ-RES-018` — resume and documents (18)
- `REQ-JOB-001` … `REQ-JOB-007` — job and match (7)
- `REQ-ANS-001` … `REQ-ANS-010` — answers and cover letters (10)
- `REQ-FORM-001` … `REQ-FORM-026` — autofill and extension (26)
- `REQ-WD-001` … `REQ-WD-023` — Workday-specific (23)
- `REQ-TRACK-001` … `REQ-TRACK-006` — tracking (6)
- `REQ-DISC-001` … `REQ-DISC-004` — job discovery (4)
- `REQ-AUTO-001` … `REQ-AUTO-008` — approved-queue automation (8)
- `REQ-PLAT-001` … `REQ-PLAT-010` — platform, privacy, quality (10)
- `REQ-GATE-001` … `REQ-GATE-016` — critical-gate, benchmark, clean-room (16)

## Traceability table

To be seeded in `M00-W07` per spec v1.2. Format:

| Requirement | Milestones | Implementation modules | Automated tests | Manual test cases | Release gate | Status |
|---|---|---|---|---|---|---|
| (seeded in M00-W07) | — | — | — | — | — | — |
