# Critical Gates

Authoritative narrative decision ledger for the four blocking critical
gates (`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1, §2.3, §12). For each gate
this file holds the metric table, zero-tolerance failures, holdout result,
independent review, owner decision, known limitations, and next permitted
action. The `## Critical gates` table in `docs/PROJECT_STATUS.md` and the
`- State:` line of each section below must always agree; the per-gate run
reports live in `docs/gates/`.

## Rules

- Allowed gate states: `NOT_EVALUATED | IN_PROGRESS | PASS |
  REDESIGN_REQUIRED | BLOCKED` (spec §1.4.7).
- A gate may claim `PASS` only with a full `tree <40-hex>` evaluated
  revision, complete SHA-256 corpus/holdout hash, independent reviewer,
  passing holdout result, and owner decision `PASS` recorded consistently in
  the status table, this ledger, and the gate report (spec §12);
  `python3 scripts/validate_status.py` enforces this. The report-table path and
  report state must agree even before evaluation.
- `REDESIGN_REQUIRED` or `BLOCKED` prevents downstream readiness; a failed
  gate produces reproducible regression cases and an ADR before iteration,
  and thresholds remain in force (spec §2.3 gate decision rules).
- The implementation agent may not be the sole approver of any gate
  (spec §1.5, REQ-GATE-011); independent review plus owner-controlled
  holdout evidence are mandatory.
- Any change to gate-relevant components triggers the complete affected
  gate regression (spec §1.5; REQ-WD-023 for Workday).
- Gate B must evaluate the provider-neutral M05-W03 path. M05-W17 reruns every
  affected benchmark/negative path and re-anchors the decision to the final
  accepted M05 content revision; stale M05-W12 evidence cannot satisfy M05
  acceptance.
- Gate D requires actual native packaged evidence on all three certified
  targets. Compilation, cross-compilation, containers, emulation, or one
  operating system cannot substitute for that evidence.
- A future Gate D `PASS` must fill every measured Gate D row, record zero
  zero-tolerance failures, and cite scoped repository evidence for its
  bundle, accepted full-AI profiles, certified targets, platform-support
  claims, native messaging, and packaging/update lifecycle. Approved
  locations are `docs/TEST_EVIDENCE.md` under the relevant owning-package
  heading, `docs/gates/HOLDOUT_EXECUTION_LOG.md` under a Gate D heading, or a
  dedicated file below `docs/gates/evidence/`. References may use a Markdown
  link or `path § heading` / `path#heading` when the file and heading exist.
  URLs, arbitrary repository files, irrelevant package headings, absolute
  paths, traversal, symlink escapes, duplicate platform rows, missing
  files/headings, and placeholders such as `pending` or `TBD` do not count.
  M00-W10 added fail-closed validation for this contract; it did not create or
  imply any native product evidence.
- Gate D's evaluated revision must equal the final accepted M27/M27-W12
  content tree unless an explicit independent gate-neutral re-anchoring is
  accepted. M27-W12 executes after M27-W13 and M27-W14 and audits provider
  isolation, SecretStore, dependencies/SBOM, native networking, packaging,
  and core no-provider behavior. `DISABLED_BY_POLICY` is a valid provider
  outcome and does not waive any Gate D evidence.
- Familiarity/originality is a separate blocking M28/M38 acceptance
  obligation, not a fifth critical gate. M00-W11 records no visual pass or
  study result.

## Summary

| Gate | State | Owning milestones | Blocks | Report |
|---|---|---|---|---|
| AUTOFILL_FEASIBILITY | NOT_EVALUATED | M02 | M03 readiness (and M17/M18/M19 qualifiers) | docs/gates/AUTOFILL_FEASIBILITY_GATE.md |
| RESUME_PAGEFIT_FEASIBILITY | NOT_EVALUATED | M05 | M06 readiness | docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md |
| WORKDAY_GUIDED_PRE_SUBMIT | NOT_EVALUATED | M19–M20 | M21 readiness and later production ATS expansion (and M22/M23 qualifiers) | docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md |
| CROSS_PLATFORM_CORE | NOT_EVALUATED | M03–M05, M10, M17, M27 | M28 readiness (requires M27 ACCEPTED) | docs/gates/CROSS_PLATFORM_CORE_GATE.md |

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

## CROSS_PLATFORM_CORE

- State: NOT_EVALUATED
- Evaluated revision: —
- Corpus/holdout hash: —
- Independent reviewer: —
- Owner decision: pending
- Report: docs/gates/CROSS_PLATFORM_CORE_GATE.md
- Known limitations: no product platform implementation or certification has
  occurred. Windows and Ubuntu full-AI profiles are not accepted.
- Governance note (M01-W07, no state change): the typed contract shape a
  future Gate D evidence bundle and certification decision must carry now
  exists as canonical schema
  (`urn:japp:schema:platform:evidence-record:v1` and
  `urn:japp:schema:platform:certification-input:v1`; see
  `packages/contracts/M01-W07.md`). Those contracts require synthetic-only
  artifacts, digest references, an operating-system build for any measured
  native run, a completed independent review before an owner decision, and a
  complete evidence inventory before any certified proposal. M01-W07 created
  no evidence bundle, ran no platform check, certified no target, and left
  this gate `NOT_EVALUATED`.
- Next permitted action: complete the staged M03–M05, M10, M17, and M27
  platform work. The independent Gate D audit is M27-W12. M28 must not become
  READY before M27 is ACCEPTED and this gate is PASS.

### Metric table (spec §2.3 Gate D — measured results recorded at evaluation)

| Dimension | Blocking cross-platform result | Measured |
|---|---:|---|
| Clean install, launch, and first-run diagnostics | 100% on every certified platform | — |
| Local-service lifecycle and forced-crash recovery | 100% on every certified platform | — |
| Orphan processes | 0 | — |
| Secret-store plaintext/insecure fallback | 0 | — |
| Encrypted database unreadable without protected key | 100% | — |
| Chrome extension/native-host handshake | 100% on every certified platform | — |
| Native-host registration removed on uninstall | 100% | — |
| Deterministic core blocked by unavailable AI | 0 | — |
| Accepted full-AI profile | at least one per certified OS | — |
| Controlled PDF/DOCX text order and clipping | 100% text order; 0 clipping/hidden content | — |
| Cross-platform encrypted backup restore | 100% on defined matrix | — |
| Spaces/Unicode install paths | 100% | — |
| Filesystem/process edge cases | 100% correct or safely blocked | — |
| Update, rollback, repair, and uninstall | 100% on certified matrix | — |
| Chrome stable platform-native E2E | PASS on every certified platform | — |
| Critical/high platform-specific defects | 0 open | — |
| Unsupported platform claim without dated evidence | 0 | — |

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
