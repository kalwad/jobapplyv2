# Decisions — Owner Decisions and Architecture Decision Records

Canonical registry of (a) owner decisions that override earlier plans and
(b) architecture decision records (ADRs). Governed by
`docs/MASTER_IMPLEMENTATION_SPEC.md` §0 and §1.4.

## Ownership and update rules

- The project owner is the only party who ACCEPTS or REJECTS a decision.
  Claude may only add entries with status `PROPOSED`; an ADR may be recorded
  as ACCEPTED directly only when it documents a decision the owner has
  already made and communicated (the approval source is then cited in the
  record).
- Claude must not silently alter the specification, the selected stack, trust
  boundaries, the model lock, acceptance thresholds, critical-gate status, or
  compatibility claims (spec §1.4).
- Lifecycle: `PROPOSED → ACCEPTED | REJECTED`; an accepted record may later be
  `SUPERSEDED` by a newer accepted record that names it.
- The current contract stays in force until the owner approves a change. After
  approval, the spec, traceability file, affected tests, project status,
  critical-gate status, compatibility promises, and the decision status are
  updated in one coherent change.
- IDs: `OD-###` for owner decisions, `ADR-####` for architecture decision
  records. IDs are never reused.

## Owner decisions (spec §0 — final unless the owner explicitly changes them)

| ID | Decision | Status | Source |
|---|---|---|---|
| OD-001 | Do not build Gmail integration, mailbox classification, recruiting-email synchronization, or AI email drafting. | ACCEPTED | Spec v1.2 §0(1) |
| OD-002 | Do not build networking, contact graphs, referral discovery, referral-message generation, or LinkedIn connection-path features. | ACCEPTED | Spec v1.2 §0(2) |
| OD-003 | Do not choose or discuss a product name; use neutral labels ("the product," "desktop app," "browser extension"). | ACCEPTED | Spec v1.2 §0(3) |
| OD-004 | Keep the applicant-side capabilities enumerated in spec §0(4): structured profile, resume creation/tailoring, keyword/evidence matching, one-page optimization, cover letters, short answers, autofill, document upload, tracking, receipts, analytics, job discovery, interview practice, approved-queue automatic application. | ACCEPTED | Spec v1.2 §0(4) |
| OD-005 | Job aggregation and unattended automatic application remain late-stage work; they must not distract from making profile, document, AI, autofill, Workday navigation, and validation systems trustworthy first. | ACCEPTED | Spec v1.2 §0(5) |
| OD-006 | The final product must support an approved application queue that pauses rather than guesses on CAPTCHA, unsupported controls, unapproved sensitive questions, contradictions, login challenges, changed jobs, or uncertainty. | ACCEPTED | Spec v1.2 §0(6) |
| OD-007 | A two-sided recruiter marketplace is not part of the mandatory product. | ACCEPTED | Spec v1.2 §0(7) |
| OD-008 | The two dominant product promises are accurate browser autofill and superior evidence-grounded resume tailoring with intelligent one-page optimization; other features are valuable only after those promises are proven. | ACCEPTED | Spec v1.2 §0(8) |
| OD-009 | Workday is the first production ATS priority: measured Workday parity or superiority on supported tenant patterns is required before Greenhouse, Lever, or Ashby production expansion begins. | ACCEPTED | Spec v1.2 §0(9) |
| OD-010 | Autofill feasibility must be proven early: M02 loads a real Manifest V3 extension in real Playwright Chromium, stresses Workday-like controls, and passes a blocking benchmark before M03 becomes eligible. | ACCEPTED | Spec v1.2 §0(10) |
| OD-011 | Resume tailoring and PageFit feasibility must be proven early: M05 must pass a blocking benchmark on the frozen corpus before M06 becomes eligible. | ACCEPTED | Spec v1.2 §0(11) |
| OD-012 | Workday production and guided pre-submit must pass a dedicated third gate spanning M19–M20 before M21 becomes eligible. | ACCEPTED | Spec v1.2 §0(12) |
| OD-013 | Certified Workday guided completion must minimize user effort: fill and verify each page, click Next safely, and stop at the final review page for the user to review and submit. | ACCEPTED | Spec v1.2 §0(13) |
| OD-014 | GUIDED_PRE_SUBMIT must never automate login credentials, password entry, account creation, email verification, MFA, CAPTCHA solving, acceptance of unexpected legal terms, unapproved consequential answers, or final submission; it pauses with an exact reason. | ACCEPTED | Spec v1.2 §0(14) |
| OD-015 | A failed critical gate does not permit compensating scope growth; the next action is focused defect iteration or an owner-approved redesign ADR. | ACCEPTED | Spec v1.2 §0(15) |
| OD-016 | The legacy CareerPulse and kalwad/JobApply repositories are comparison baselines, not implementation foundations; reuse requires license review, provenance records, and an approved ADR. | ACCEPTED | Spec v1.2 §0(16) |
| OD-017 | The same implementation agent must not be the sole author of the implementation, expected benchmark answers, holdout cases, and final acceptance decision for a critical gate. | ACCEPTED | Spec v1.2 §0(17) |
| OD-018 | Compatibility claims are limited to measured ATS families, Workday tenant/layout patterns, browser versions, adapter versions, locales, session modes, and last-tested dates; never claim universal support. | ACCEPTED | Spec v1.2 §0(18) |
| OD-019 | The project is governed by evidence, not milestone count. | ACCEPTED | Spec v1.2 §0(19) |
| OD-020 | Claude implementation sessions use Fable 5 Max; broad Ultra Code workflow orchestration is not the operating plan. Independent review happens after a coherent implementation pass in a separate clean Claude Max session or GPT-5.6 Ultra Codex worktree. | ACCEPTED | Spec v1.2 §0(20) |

## Architecture decision records

| ID | Title | Status | Date | Spec sections affected |
|---|---|---|---|---|
| ADR-0001 | Adopt JAPP-MASTER-001 v1.2 (Workday-first critical-risk rebaseline) as the canonical specification | ACCEPTED | 2026-07-26 | Entire specification (v1.0 → v1.2); §0–§16 |

### ADR-0001 — Adopt JAPP-MASTER-001 v1.2 (Workday-first critical-risk rebaseline) as the canonical specification

- Status: ACCEPTED
- Date proposed / date decided: 2026-07-26 / 2026-07-26
- Observed constraint (with evidence): the owner identified Workday parity or
  superiority as a defining product requirement (spec v1.2 §0(9), change
  summary). Under v1.0, Workday was the last production adapter (v1.0 M27),
  sequenced after Greenhouse/Lever/Ashby; there were no blocking early
  feasibility gates, no Workday guided pre-submit mode, and the two
  highest-risk systems (real-browser autofill, resume/PageFit generation)
  would not be validated until after months of surrounding platform work.
- Comparison of canonical v1.0 and proposed v1.2 (mechanically extracted from
  both files during M00-W05):
  - Inventory: 38 → 39 milestones (final release becomes M38), 227 → 260
    work packages, 74 → 135 requirement IDs.
  - New requirement families: `REQ-WD-001…023` (Workday-specific) and
    `REQ-GATE-001…016` (critical-gate/benchmark/clean-room); `REQ-RES` grows
    10 → 18 and `REQ-FORM` 12 → 26; all other families are unchanged.
  - Three blocking critical gates are introduced: `AUTOFILL_FEASIBILITY`
    (M02, blocks M03), `RESUME_PAGEFIT_FEASIBILITY` (M05, blocks M06), and
    `WORKDAY_GUIDED_PRE_SUBMIT` (M19–M20, blocks M21 and later production
    ATS expansion).
  - M02 grows from a fixtures/corpus milestone (6 packages) to the real-MV3
    feasibility engine and gate (15 packages); M05 grows from model lock
    (6 packages) to model lock plus the resume/PageFit feasibility slice and
    gate (12 packages).
  - Production Workday (M19 field coverage, M20 guided pre-submit, 11
    packages each) moves ahead of Greenhouse (M21), Lever (M22), and Ashby
    (M23); later phases renumber accordingly (tracker M25, closed alpha M28,
    broader ATS M29–M31, discovery M32–M34, automatic application M35–M37,
    release M38).
  - A certified `GUIDED_PRE_SUBMIT` Workday mode is specified (§5.11.9) with
    `MANUAL_START`/revocable `AUTO_START_ON_OPEN` triggers, page-readiness
    proofs, idempotent navigation, final-review stop, and hard prohibitions
    on automating credentials, account creation, email verification, MFA,
    CAPTCHA, unexpected legal terms, and final submission.
  - M00-W05 is reassigned to this adoption/migration step; CI and
    traceability seeding become M00-W06 and M00-W07.
  - Implementation standardizes on Claude Fable 5 Max with independent
    review in a separate clean session or Codex worktree instead of Ultra
    Code workflow fan-out (§0(20), §1.5).
  - All v1.0 product scope is preserved (change summary: v1.2 "preserves the
    complete v1.0 product scope"; no capability from v1.0 §3 is dropped, and
    v1.0 §0 owner decisions 1–7 carry over verbatim or strengthened).
- Alternatives considered: (a) remain on v1.0 — rejected by the owner: it
  postpones the defining Workday requirement and validates the highest-risk
  systems too late; (b) adopt the v1.1 draft — explicitly superseded by v1.2
  before adoption and never added to the repository (spec v1.2 header).
- Tradeoffs: +33 work packages and three blocking gates slow nominal feature
  progress and can hard-stop the plan on gate failure; in exchange the
  riskiest architecture is proven on real browser behavior before dependent
  product layers are built, and Workday becomes the first production proof
  rather than a late port.
- Security/privacy impact: strengthened — explicit prohibitions on
  credential/MFA/CAPTCHA/legal-consent automation and on final-submit
  automation in guided mode; owner-controlled holdout isolation; clean-room
  rules for legacy code; compatibility claims restricted to measured scope.
- Data-migration impact: none — no product or user data exists yet; the
  migration touches project-memory documents, the status validator, and
  verification wiring only. Completed-package evidence (M00-W01…W04 tree
  revisions and TEST_EVIDENCE entries) is preserved unchanged.
- Test impact: `scripts/validate_status.py` is rewritten for the v1.2
  inventory, critical-gates table, gate-based readiness blocking,
  ACCEPTED-milestone prerequisites, evidence preservation, and the
  single-canonical-spec rule, and is brought under the strict Ruff/mypy/
  pytest gates (closing KI-0002); a new negative-path pytest suite
  (`scripts/tests/test_validate_status.py`) covers the §13.8 rejection
  matrix. The M00-W04 verification runner and its 35-test suite are
  unchanged except for registry command paths and the CRITICAL_GATES.md
  memory-file entry.
- Rollback plan: `git revert` of the adoption commit restores the complete
  v1.0 contract, status, and validator; Git history is the archive of v1.0
  (spec §1.4.5 — no parallel canonical-looking files are kept).
- Proposed decision: replace `docs/MASTER_IMPLEMENTATION_SPEC.md` (v1.0)
  atomically with the owner-supplied v1.2 revision, remove the proposed
  copy, migrate all status/validator inventories, and add the three
  critical-gate records and gate report templates.
- Spec sections, requirements, milestones, schemas, and compatibility
  promises affected: the entire canonical specification (v1.0 §0–§14
  superseded by v1.2 §0–§16); milestone inventory M00–M38; requirement
  catalog §4 (135 IDs); no code schemas exist yet to migrate.
- Owner approval: recorded 2026-07-26 — the owner supplied
  `docs/MASTER_IMPLEMENTATION_SPEC.v1.2.proposed.md` (whose §13.8 adoption
  prompt states "The owner approves JAPP-MASTER-001 v1.2 as the new
  canonical specification") and instructed in-session: "Execute M00-W05 —
  Adopt and migrate the v1.2 Workday-first critical-risk rebaseline — and
  only M00-W05 using Claude Fable 5 Max."

## ADR template

```markdown
### ADR-NNNN — <title>
- Status: PROPOSED | ACCEPTED | REJECTED | SUPERSEDED (by ADR-NNNN)
- Date proposed / date decided:
- Observed constraint (with evidence):
- Alternatives considered:
- Tradeoffs:
- Security/privacy impact:
- Data-migration impact:
- Benchmark and gate impact:
- Test impact:
- Rollback plan:
- Proposed decision:
- Spec sections, requirements, milestones, schemas, gates, and compatibility promises affected:
- Owner approval: <pending | source and date>
```
