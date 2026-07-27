# Gate C report — WORKDAY_GUIDED_PRE_SUBMIT

Gate report for the blocking Workday Production and Guided Pre-Submit Gate
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §2.3 Gate C, owned by milestones
`M19`–`M20`). This file records evaluation runs and the decision trail; the
authoritative state ledger is `docs/CRITICAL_GATES.md`, and the state must
agree with the `## Critical gates` table in `docs/PROJECT_STATUS.md`.

The v1.4 familiarity/provider governance migration does not change Gate C's
metrics or evaluate it. Familiar UI and any future external provider remain
subject to the same final-review stop, uncertainty, consent, and no-submit
boundaries.

## Identity

- Gate: WORKDAY_GUIDED_PRE_SUBMIT
- Owning milestones: M19 (field coverage) and M20 (guided pre-submit
  navigation and certification; decision package M20-W11)
- Blocks: M21 readiness and all later production ATS expansion until M19 and
  M20 are ACCEPTED and this gate is PASS (spec §9.1.6, §12); M22/M23 carry
  the same `WORKDAY_GUIDED_PRE_SUBMIT = PASS` dependency qualifier.
- State: NOT_EVALUATED (mirror of docs/CRITICAL_GATES.md; do not edit here
  without updating the ledger and status table in the same change)

## Blocking thresholds

The complete dimension/threshold table is normative in spec §2.3 Gate C and
is reproduced with measured results in docs/CRITICAL_GATES.md. Certified
flows must reach the final review boundary with zero automated final-submit
clicks and zero protected-boundary automation; no partial thresholds may be
waived (spec §1.4.6, §2.3 gate decision rules).

## Evaluation runs

None yet. Every run appended here must record (spec §8.4.2, §5.11.9.14):

- Git revision and clean-tree proof.
- Workday development-matrix, holdout, and certification-record hashes.
- Toolchain, browser, extension, adapter, and driver versions.
- Raw field/repeater/upload/validation/navigation/recovery result JSON.
- Public no-submit structural dry-run inventory (sanitized).
- Controlled end-to-review run inventory (no automated submission).
- Long-session and repeated-flow soak results.
- Same-input manual Simplify comparison worksheets.
- Independent review report reference.
- Manual inspection checklist reference.

## Holdout

Holdout result: pending
(Owner-controlled holdout per spec §5.13/§8.3.1 with unseen tenant/control/
page-sequence variants and at least one navigation/recovery fault path —
REQ-GATE-015. Executions are logged in docs/gates/HOLDOUT_EXECUTION_LOG.md.)

## Independent review

Independent reviewer: pending
(A separate clean Claude Max session or GPT-5.6 Ultra Codex worktree —
spec M20-W11; the implementation agent may not approve its own gate.)

## Decision

Owner decision: pending
(Allowed final decisions: PASS | REDESIGN_REQUIRED | BLOCKED, recorded with
date and the exact evidence-bundle hash. Thresholds may not be weakened to
obtain PASS.)

## History

| Date | Revision | Result | Notes |
|---|---|---|---|
| — | — | — | Gate created (template) during M00-W05 v1.2 adoption |
