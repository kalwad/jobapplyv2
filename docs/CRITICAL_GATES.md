# Critical Gates

Authoritative narrative decision ledger for the three blocking critical
gates (`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1, §2.3, §12). For each gate
this file holds the metric table, zero-tolerance failures, holdout result,
independent review, owner decision, known limitations, and next permitted
action. The `## Critical gates` table in `docs/PROJECT_STATUS.md` and the
`- State:` line of each section below must always agree; the per-gate run
reports live in `docs/gates/`.

## Rules

- Allowed gate states: `NOT_EVALUATED | IN_PROGRESS | PASS |
  REDESIGN_REQUIRED | BLOCKED` (spec §1.4.7).
- A gate may claim `PASS` only with an evaluated revision, corpus/holdout
  hash, independent reviewer, holdout result, and owner decision recorded
  (spec §12); `python3 scripts/validate_status.py` enforces this.
- `REDESIGN_REQUIRED` or `BLOCKED` prevents downstream readiness; a failed
  gate produces reproducible regression cases and an ADR before iteration,
  and thresholds remain in force (spec §2.3 gate decision rules).
- The implementation agent may not be the sole approver of any gate
  (spec §1.5, REQ-GATE-011); independent review plus owner-controlled
  holdout evidence are mandatory.
- Any change to gate-relevant components triggers the complete affected
  gate regression (spec §1.5; REQ-WD-023 for Workday).

## Summary

| Gate | State | Owning milestones | Blocks | Report |
|---|---|---|---|---|
| AUTOFILL_FEASIBILITY | NOT_EVALUATED | M02 | M03 readiness (and M17/M18/M19 qualifiers) | docs/gates/AUTOFILL_FEASIBILITY_GATE.md |
| RESUME_PAGEFIT_FEASIBILITY | NOT_EVALUATED | M05 | M06 readiness | docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md |
| WORKDAY_GUIDED_PRE_SUBMIT | NOT_EVALUATED | M19–M20 | M21 readiness and later production ATS expansion (and M22/M23 qualifiers) | docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md |

## AUTOFILL_FEASIBILITY

- State: NOT_EVALUATED
- Evaluated revision: —
- Corpus/holdout hash: —
- Independent reviewer: —
- Owner decision: pending
- Report: docs/gates/AUTOFILL_FEASIBILITY_GATE.md
- Known limitations: none recorded (not yet evaluated).
- Next permitted action: build the M02 measurement system and feasibility
  engine (M02-W01 … M02-W14), then run the independent gate audit
  (M02-W15). M03 must not become READY before this gate is PASS.

### Metric table (spec §2.3 Gate A — measured results recorded at evaluation)

| Dimension | Blocking early result | Measured |
|---|---:|---|
| Ordinary attempted-fill precision on supported variants | >= 99.5% | — |
| Required ordinary-field recall on declared supported variants | >= 97% | — |
| Sensitive/prohibited false fills | 0 | — |
| Catastrophically wrong option selections | 0 | — |
| Honeypot fills | 0 | — |
| Visible required fields silently omitted | 0 | — |
| Unresolved required fields explicitly reported | 100% | — |
| Intended values retained after controlled rerender | >= 99.5% | — |
| Duplicate actions caused by rescans | 0 | — |
| Generic scan/fill p95, excluding AI | <= 1.5 s per page | — |
| Live employer submissions performed by gate automation | 0 | — |
| Workday challenge-set architecture failures hidden or waived | 0 | — |
| Greenhouse/Lever/Workday research comparison versus Simplify | non-inferior precision on the declared narrow set, within the declared recall margin, and safer or equal on uncertainty | — |
| Comparison versus CareerPulse/legacy JobApply | decisive measured improvement with no inherited unsafe fallback | — |

- Zero-tolerance failures observed: — (none recorded; gate not evaluated).
- Holdout result: pending.
- Independent review: pending.

## RESUME_PAGEFIT_FEASIBILITY

- State: NOT_EVALUATED
- Evaluated revision: —
- Corpus/holdout hash: —
- Independent reviewer: —
- Owner decision: pending
- Report: docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md
- Known limitations: none recorded (not yet evaluated).
- Next permitted action: after M02–M04, build the M05 model lock and
  resume/PageFit feasibility slice (M05-W01 … M05-W11), then run the
  independent gate audit (M05-W12). M06 must not become READY before this
  gate is PASS.

### Metric table (spec §2.3 Gate B — measured results recorded at evaluation)

| Dimension | Blocking early result | Measured |
|---|---:|---|
| Unsupported atomic factual claims | 0 | — |
| Unsupported keywords inserted as claimed skills | 0 | — |
| Skills without approved evidence links | 0 | — |
| Stale company/role/location leakage | 0 | — |
| Fact changes caused by shortening | 0 | — |
| Clipping, overlap, hidden text, or missing visible content | 0 | — |
| Expected extracted-text order | 100% for the feasibility template | — |
| Keyword/terminology improvement | positive only for supported requirements | — |
| Repetition and skills-section budget violations | 0 | — |
| Normalized utility retained when a one-page output is feasible | >= 95% | — |
| Correct two-page recommendation when floors would be violated | 100% of defined guardrail cases | — |
| Severe swap, sustained memory pressure, or system instability on M5/24 GB | 0 accepted benchmark runs | — |
| Blind preference versus one-shot and keyword-stuffing baselines | statistically meaningful win on the defined set | — |
| Simplify comparison | at least parity on overall usefulness, with superior or equal factuality and transparency; final release still requires a meaningful win | — |

- Zero-tolerance failures observed: — (none recorded; gate not evaluated).
- Holdout result: pending.
- Independent review: pending.

## WORKDAY_GUIDED_PRE_SUBMIT

- State: NOT_EVALUATED
- Evaluated revision: —
- Corpus/holdout hash: —
- Independent reviewer: —
- Owner decision: pending
- Report: docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md
- Known limitations: none recorded (not yet evaluated).
- Next permitted action: reach M19 (Workday production field coverage) and
  M20 (guided pre-submit navigation) through their listed packages; the
  decision is recorded by the independent Gate C audit (M20-W11) with owner
  approval. M21 and later production ATS expansion must not become READY
  before M19 and M20 are ACCEPTED and this gate is PASS.

### Metric table (spec §2.3 Gate C — measured results recorded at evaluation)

| Dimension | Blocking Workday result | Measured |
|---|---:|---|
| Ordinary attempted-fill precision on certified patterns | >= 99.5% | — |
| Required ordinary-field recall on certified patterns | >= 97% | — |
| Sensitive/prohibited false fills | 0 | — |
| Unresolved required fields explicitly reported | 100% | — |
| Catastrophically wrong option selections | 0 | — |
| Work/education/skill repeater duplicates caused by automation | 0 | — |
| Intended values retained after Workday rerender and page revisit | >= 99.5% | — |
| Exact selected document attached and verified | 100% | — |
| Page-readiness proofs completed before `Next` | 100% | — |
| Wrong, premature, repeated, or ambiguous `Next` clicks | 0 | — |
| Unconfirmed page transitions followed by another action | 0 | — |
| Certified flows reaching the correct final review boundary | 100% | — |
| Final submit controls activated by `GUIDED_PRE_SUBMIT` | 0 | — |
| Defined reload/back/service-worker/session-timeout recovery cases | 100% correctly resumed or explicitly paused | — |
| Login, account creation, MFA, email verification, CAPTCHA, and legal-consent boundaries bypassed | 0 | — |
| Ordinary Workday page fill/verify p95, excluding uploads and AI | <= 3.0 s | — |
| Long-session observer or memory leak | 0 confirmed monotonic leak in the defined soak | — |
| Manual corrections versus Simplify on the same certified matrix | non-inferior overall, with fewer or equal unsafe/wrong fills and better unresolved-field reporting | — |
| Live employer submissions performed by gate automation | 0 | — |

- Zero-tolerance failures observed: — (none recorded; gate not evaluated).
- Holdout result: pending.
- Independent review: pending.
