# Decisions — Owner Decisions and Architecture Decision Records

Canonical registry of (a) owner decisions that override earlier plans and
(b) architecture decision records (ADRs). Governed by
`docs/MASTER_IMPLEMENTATION_SPEC.md` §0 and §1.4.

## Ownership and update rules

- The project owner is the only party who ACCEPTS or REJECTS a decision.
  Claude may only add entries with status `PROPOSED`.
- Claude must not silently alter the specification, the selected stack, trust
  boundaries, the model lock, or acceptance thresholds (spec §1.4).
- Lifecycle: `PROPOSED → ACCEPTED | REJECTED`; an accepted record may later be
  `SUPERSEDED` by a newer accepted record that names it.
- The current contract stays in force until the owner approves a change. After
  approval, the spec, traceability file, affected tests, and the decision
  status are updated in one change.
- IDs: `OD-###` for owner decisions, `ADR-####` for architecture decision
  records. IDs are never reused.

## Owner decisions (spec §0 — final unless the owner explicitly changes them)

| ID | Decision | Status | Source |
|---|---|---|---|
| OD-001 | Do not build Gmail integration, mailbox classification, recruiting-email synchronization, or AI email drafting. | ACCEPTED | Spec §0(1) |
| OD-002 | Do not build networking, contact graphs, referral discovery, referral-message generation, or LinkedIn connection-path features. | ACCEPTED | Spec §0(2) |
| OD-003 | Do not choose or discuss a product name; use neutral labels ("the product," "desktop app," "browser extension"). | ACCEPTED | Spec §0(3) |
| OD-004 | Keep the applicant-side capabilities enumerated in spec §0(4): structured profile, resume creation/tailoring, keyword/evidence matching, one-page optimization, cover letters, short answers, autofill, document upload, tracking, receipts, analytics, job discovery, interview practice, approved-queue automatic application. | ACCEPTED | Spec §0(4) |
| OD-005 | Job aggregation and automatic application are deliberately late-stage work and must not distract from trust-critical core systems. | ACCEPTED | Spec §0(5) |
| OD-006 | The final product must support an approved application queue that pauses rather than guesses on CAPTCHA, unsupported controls, unapproved sensitive questions, contradictions, or uncertainty. | ACCEPTED | Spec §0(6) |
| OD-007 | A two-sided recruiter marketplace is not part of the mandatory product. | ACCEPTED | Spec §0(7) |

## Architecture decision records

No ADRs exist yet. The initial stack (spec §5.2), trust boundaries (§5.4),
communication model (§5.5), and model lock (§6) are defined directly by the
canonical specification; an ADR is required only to change them.

| ID | Title | Status | Date | Spec sections affected |
|---|---|---|---|---|
| — | (none yet) | — | — | — |

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
- Test impact:
- Rollback plan:
- Proposed decision:
- Spec sections, requirements, milestones, schemas, and compatibility promises affected:
- Owner approval: <pending | name and date>
```
