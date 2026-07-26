# CLAUDE.md — Repository Contract and Session Bootstrap

This repository implements the local-first job application platform governed by
one canonical contract: **`docs/MASTER_IMPLEMENTATION_SPEC.md`**
(Specification ID `JAPP-MASTER-001`, version 1.2 — the Workday-first
production and guided pre-submit rebaseline, adopted by ADR-0001). That file
is the single source of authority for product scope, architecture, stack,
milestones, work packages, critical gates, validation, and completion. Do not
silently rewrite it. Do not choose or discuss a product name; use neutral
labels such as "the product," "desktop app," and "browser extension."
Implementation sessions use Claude Fable 5 Max; independent review happens in
a separate clean session or Codex worktree, not via broad workflow fan-out
(spec §0(20)).

## Mandatory session bootstrap (spec §1.2)

At the beginning of every new prompt or resumed session, Claude must:

1. Read this file.
2. Read `docs/MASTER_IMPLEMENTATION_SPEC.md`.
3. Read `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/TEST_EVIDENCE.md`,
   `docs/KNOWN_ISSUES.md`, `docs/COMPATIBILITY_MATRIX.md`,
   `docs/traceability.json`, `docs/REQUIREMENTS_TRACEABILITY.md`, and
   `docs/CRITICAL_GATES.md`.
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
| `docs/PROJECT_STATUS.md` | Milestone/package states, critical-gate states, blockers, next action | Claude updates at every package start and finish; must PASS `python3 scripts/validate_status.py` after every edit |
| `docs/DECISIONS.md` | Owner decisions and ADRs | Claude may add PROPOSED ADRs; only the owner ACCEPTS or REJECTS |
| `docs/TEST_EVIDENCE.md` | Exact verification commands and results | Appended at every package verification; never record a command that was not run and inspected in the current repository state |
| `docs/KNOWN_ISSUES.md` | Reproducible defects, deferred risks, parked ideas | Updated whenever discovered; scope ideas are parked here instead of broadening a package |
| `docs/COMPATIBILITY_MATRIX.md` | ATS/browser/OS support and measured pass rates | Measured, evidence-linked data only |
| `docs/traceability.json` | Canonical reviewed machine-readable requirement/package mappings, dependencies, planned verification/evidence, and honest current states | Fully seeded in `M00-W07`; update with each affected package, refresh reviewed hashes, then regenerate/check the Markdown view |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Generated requirement and work-package traceability/readiness view | Never edit by hand; regenerate with `pnpm traceability:generate` and require `pnpm traceability:check` |
| `docs/CRITICAL_GATES.md` | Autofill, resume/PageFit, and Workday gate state, corpus hash, reviewer, decision | Gate states change only with recorded evidence; PASS additionally requires independent review and the owner decision (spec §12) |
| `docs/gates/` | Per-gate run reports and the holdout execution log | Append-only run records; states mirror `docs/CRITICAL_GATES.md` |

## Status model (spec §1.1 and §12)

Work-package states (exactly one per package, always):

```text
NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED
```

Critical-gate states:

```text
NOT_EVALUATED | IN_PROGRESS | PASS | REDESIGN_REQUIRED | BLOCKED
```

- No more than one work package is `IN_PROGRESS` at any time.
- A package is not `VERIFIED` merely because code exists: its required tests
  must pass and its evidence must be recorded in `docs/TEST_EVIDENCE.md`.
- A package is not `ACCEPTED` until all milestone exit gates pass.
- Readiness blocking (spec §9.1, §12): `M03` requires `AUTOFILL_FEASIBILITY =
  PASS` and `M02` ACCEPTED; `M06` requires `RESUME_PAGEFIT_FEASIBILITY = PASS`
  and `M05` ACCEPTED; `M21` (and later production ATS expansion) requires
  `M19` and `M20` ACCEPTED and `WORKDAY_GUIDED_PRE_SUBMIT = PASS`.
  `REDESIGN_REQUIRED` or `BLOCKED` on a gate prevents downstream readiness.
- Validate structure with `python3 scripts/validate_status.py` and
  `pnpm traceability:check` before
  reporting any package complete. The script enforces valid enums, the exact
  v1.2 inventory (39 milestones, 260 work packages, 135 requirements), the
  single-`IN_PROGRESS` rule, unskipped dependencies, acceptance of every
  dependency milestone, gate-based readiness blocking, verified-evidence
  preservation, deterministic next-work selection, and that exactly one
  canonical specification exists. The traceability check additionally
  enforces reviewed mappings, exact dependency graphs, honest future states,
  real completed code/test/evidence links, and generated-view agreement.

## Work-package execution protocol (spec §1.3)

1. Restate the contract: objective, affected components, non-goals, and acceptance evidence.
2. Inspect before editing: existing implementations, schemas, tests, migrations, adjacent risks.
3. Write or update tests first whenever the behavior is testable before implementation.
4. Implement the smallest coherent vertical slice that satisfies the package.
5. Run focused tests, then the relevant package suite, then the repository verification command.
6. Inspect the actual UI or browser behavior for UI/extension work; unit tests alone are insufficient.
7. Record exact commands and results in `docs/TEST_EVIDENCE.md`.
8. For critical-gate work, run a separate independent review and the owner-controlled holdout evaluation; the implementation agent's own fixtures are not sufficient.
9. Update traceability, status, compatibility, and critical-gate files.
10. Report changed files, behavior, test results, remaining risks, and the next `READY` package.

## Change control (spec §1.4)

Claude must not silently alter the specification, the selected stack, trust
boundaries, the model lock, acceptance thresholds, critical-gate status, or
compatibility claims. When a change is necessary: add a PROPOSED ADR to
`docs/DECISIONS.md` explaining the observed constraint, alternatives,
tradeoffs, migration impact, security/privacy impact, benchmark impact,
rollback plan, and proposed decision; keep the current contract in force
until the owner approves; after approval, update the spec, traceability,
affected tests, project status, critical-gate status, compatibility promises,
and the ADR status in one change. Preserve the previous canonical version
through Git history — never keep multiple files that can be mistaken for the
canonical specification. A threshold may be strengthened without reducing
safety, but never weakened merely because current code fails. An interrupted
agent session is not a specification change: resume from repository state and
never reset or discard unexplained work solely to obtain a clean start.

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
- Do not count a field as filled because a DOM property changed once. Success requires a re-resolved control, the intended observed value, persistence after framework rerender, and acceptance by the site's validation state.
- Do not use a raw CSS selector, DOM index, or `nth-of-type` path as the durable identity of an application field.
- Do not choose an option merely because it is the only visible option when it does not semantically match the approved value.
- Do not discard successful deterministic field mappings because an AI request fails, times out, or returns malformed output.
- Do not rescan the complete document after every mutation. Observe bounded application roots and process affected subtrees through a measured state machine.
- Do not use jsdom-only tests as proof that an extension works. Critical extension behavior must run through the real built Manifest V3 extension in bundled Playwright Chromium with a persistent context and actual service worker.
- Do not mark an ATS tenant pattern supported without a measured compatibility entry, fixture or public dry-run evidence, browser version, adapter version, and last-tested date.
- Do not let the implementation agent alone approve a critical gate. Independent review and owner-controlled holdout evidence are mandatory.
- Do not expose hidden holdout expected results to the implementation agent before the gate run.
- Do not continue broad feature implementation while a critical gate is `REDESIGN_REQUIRED`, `BLOCKED`, or overdue for regression.
- Do not copy the legacy CareerPulse/JobApply implementation into production as a shortcut. Treat it as an isolated behavioral baseline and source of negative regression cases.
- Do not allow a model upgrade, browser upgrade, control-driver change, field-resolver change, template change, or PageFit change to bypass the complete affected gate regression.
- Do not allow a Workday adapter, step classifier, navigation guard, repeater controller, upload strategy, or guided-mode change to bypass the complete Workday gate regression.
- Do not click `Next` because a button appears enabled. A navigation action requires a page-readiness proof, unique action identity, zero unresolved required controls, no validation rejection, and an idempotency guard for the current page generation.
- Do not repeat a Workday navigation click after a timeout unless the state machine proves that no transition occurred and issues a new reviewed action.
- Do not click the Workday final submit control in `GUIDED_PRE_SUBMIT`; the mode must stop on the certified review boundary.
- Do not automate credentials, account creation, MFA, email verification, CAPTCHA, or legal-consent boundaries. Pause and preserve resumable state.
- Do not permit production Greenhouse, Lever, or Ashby work to become ready while the Workday production gate is not `PASS`.
- Do not use Ultra Code workflow fan-out as the default implementation process. Complete one coherent package with Fable 5 Max, then use a separate independent audit when required.

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
