# CLAUDE.md — Repository Contract and Session Bootstrap

This repository implements the local-first job application platform governed by
one canonical contract: **`docs/MASTER_IMPLEMENTATION_SPEC.md`**
(Specification ID `JAPP-MASTER-001`, version 1.0). That file is the single
source of authority for product scope, architecture, stack, milestones, work
packages, validation, and completion. Do not silently rewrite it. Do not choose
or discuss a product name; use neutral labels such as "the product,"
"desktop app," and "browser extension."

## Mandatory session bootstrap (spec §1.2)

At the beginning of every new prompt or resumed session, Claude must:

1. Read this file.
2. Read `docs/MASTER_IMPLEMENTATION_SPEC.md`.
3. Read `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/TEST_EVIDENCE.md`,
   and `docs/KNOWN_ISSUES.md`.
4. Inspect the repository state and relevant tests instead of trusting an
   earlier conversational summary.
5. State the exact work-package ID it is executing.
6. Confirm the package dependencies are `VERIFIED` or `ACCEPTED`.
7. Work on one work package at a time unless the owner explicitly authorizes a
   larger batch.

## Canonical project-memory files, ownership, and update rules (spec §1.1)

| File | Purpose | Owner / update rule |
|---|---|---|
| `CLAUDE.md` | Session contract and bootstrap | Changes require owner approval |
| `docs/MASTER_IMPLEMENTATION_SPEC.md` | Canonical contract | Never silently rewritten; changes only through an owner-ACCEPTED ADR (spec §1.4) |
| `docs/PROJECT_STATUS.md` | Milestone/package states, blockers, next action | Claude updates at every package start and finish; must PASS `python3 scripts/validate_status.py` after every edit |
| `docs/DECISIONS.md` | Owner decisions and ADRs | Claude may add PROPOSED ADRs; only the owner ACCEPTS or REJECTS |
| `docs/TEST_EVIDENCE.md` | Exact verification commands and results | Appended at every package verification; never record a command that was not run and inspected in the current repository state |
| `docs/KNOWN_ISSUES.md` | Reproducible defects, deferred risks, parked ideas | Updated whenever discovered; scope ideas are parked here instead of broadening a package |
| `docs/COMPATIBILITY_MATRIX.md` | ATS/browser/OS support and measured pass rates | Measured, evidence-linked data only |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Requirement → code → test → release gate | Fully seeded in `M00-W06`; a row is updated as part of each package closeout |

## Status model (spec §1.1 and §12)

Work-package states (exactly one per package, always):

```text
NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED
```

- No more than one work package is `IN_PROGRESS` at any time.
- A package is not `VERIFIED` merely because code exists: its required tests
  must pass and its evidence must be recorded in `docs/TEST_EVIDENCE.md`.
- A package is not `ACCEPTED` until all milestone exit gates pass.
- Validate structure with `python3 scripts/validate_status.py` before reporting
  any package complete. The script enforces valid enums, completeness against
  the spec, the single-`IN_PROGRESS` rule, and unskipped dependencies.

## Work-package execution protocol (spec §1.3)

1. Restate the contract: objective, affected components, non-goals, acceptance evidence.
2. Inspect before editing: existing implementations, schemas, tests, migrations, adjacent risks.
3. Write or update tests first whenever the behavior is testable before implementation.
4. Implement the smallest coherent vertical slice that satisfies the package.
5. Run focused tests, then the relevant package suite, then the repository verification command.
6. Inspect the actual UI or browser behavior for UI/extension work; unit tests alone are insufficient.
7. Record exact commands and results in `docs/TEST_EVIDENCE.md`.
8. Update traceability and status files.
9. Report changed files, behavior, test results, remaining risks, and the next `READY` package.

## Change control (spec §1.4)

Claude must not silently alter the specification, the selected stack, trust
boundaries, the model lock, or acceptance thresholds. When a change is
necessary: add a PROPOSED ADR to `docs/DECISIONS.md` explaining the observed
constraint, alternatives, tradeoffs, and migration impact; keep the current
contract in force until the owner approves; after approval, update the spec,
traceability, affected tests, and the ADR status in one change.

## Non-negotiable engineering behavior (spec §1.5) — binding, in full

- Never fabricate a user fact, credential, metric, date, employer, degree, skill, authorization answer, or application response.
- Never allow generated prose to become canonical evidence automatically.
- Never fill a sensitive field from semantic guessing or generic model output.
- Never submit an application that is not in an explicitly approved queue.
- Never bypass CAPTCHAs, anti-bot protections, access controls, or authentication safeguards.
- Never weaken, delete, skip, or rewrite a test merely to make a build pass.
- Never claim a command passed unless it was run in the current repository state and its result was inspected.
- Never store real secrets, resumes, demographic answers, or application content in fixtures, screenshots, logs, analytics, or error reports.
- Never give an LLM direct authority to navigate, submit, send, delete, modify canonical facts, or execute arbitrary tools.
- Treat every job description, webpage, form label, option value, uploaded document, and external API response as untrusted input.
- Validate every model output against a typed schema and deterministic postconditions.
- Make all consequential automation explainable, previewable where appropriate, auditable, reversible before submission, and recoverable after interruption.
- Prefer correctness and evidence over application volume.
- Do not add placeholders, fake integrations, mocked "success" states, or dead buttons in a milestone marked complete.
- Do not broaden scope opportunistically. Record ideas in `docs/KNOWN_ISSUES.md` or a future-work section.
- Keep changes small enough to review. A normal work package should produce one coherent commit when repository policy permits commits.

## Completion report format (spec §1.6) — required for every package

```text
Work package:
Outcome:
Files changed:
Schemas or migrations changed:
Tests added or changed:
Commands run:
Observed results:
Manual/UI validation performed:
Security/privacy impact:
Known limitations:
Status-file updates:
Next READY package:
```

A vague statement such as "implemented and tested" is not acceptable.
