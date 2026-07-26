# Master Implementation Specification: Local-First Job Application Platform

**Specification ID:** JAPP-MASTER-001  
**Version:** 1.3  
**Revision:** Cross-platform production, packaging, and runtime rebaseline  
**Research and architecture snapshot:** July 26, 2026  
**Canonical repository path:** `docs/MASTER_IMPLEMENTATION_SPEC.md`  
**Implementation-agent policy:** Owner-selected per package. The currently selected agent remains active until the owner explicitly changes it; the specification must not automatically route work between Claude, Codex, or reasoning modes.  
**Primary development machine:** Apple-silicon laptop with an M5 chip and 24 GB unified memory  
**Certified first-release operating-system targets:** macOS 14+ arm64, Windows 11 x64, and Ubuntu 24.04 LTS x64  
**Document authority:** This is the canonical product, architecture, implementation, validation, platform-support, and completion contract for the project.

> **Fresh repository:** copy this file directly to `docs/MASTER_IMPLEMENTATION_SPEC.md` and begin with `M00-W01`.  
> **Existing v1.2 repository with `M00-W07` in progress:** finish that package under v1.2, verify, commit, push, and restore a clean tree. Do not introduce v1.3 into the active package.  
> **Existing v1.2 repository that has completed through `M00-W07`:** keep this owner-approved file outside the repository at an immutable path and verify its SHA-256. The v1.2 fail-closed validator deliberately rejects any second canonical-looking specification under `docs/`, so do not place a proposed copy in the active tree. Execute `M00-W08` to import these exact bytes directly into the canonical path, `M00-W09` to add the Windows/platform-portability baseline, and `M00-W10` to regenerate traceability and re-accept M00. Git history remains the archive of v1.2.  
> **Unadopted earlier drafts:** do not add v1.1 or another duplicate master specification to the repository.  
> Claude or Codex must reread the canonical specification at the start of every implementation session together with the project-memory files defined below. Do not rename the product or invent branding while following this specification.

### Version 1.3 change summary

Version 1.3 preserves the complete v1.2 Workday-first product scope, every existing requirement, all three existing critical gates, and all completed M00 evidence. It corrects a remaining architectural risk: v1.2 mentions later Windows support and macOS/Linux CI, but does not make full Windows, Linux, and macOS behavior a sufficiently early, explicit, blocking contract. This revision therefore:

- Defines three certified first-release targets: **macOS 14+ on Apple Silicon arm64**, **Windows 11 x64**, and **Ubuntu 24.04 LTS x64**, using current Google Chrome stable on each platform.
- Adds a fourth blocking **Cross-Platform Core Gate** that must pass before the core closed alpha in `M28`.
- Adds typed platform abstractions for secure secret storage, paths, process supervision, native-messaging registration, browser/runtime discovery, model-runtime selection, diagnostics, installers, and updates.
- Adds required Windows CI during M00 and preserves the existing macOS and Ubuntu jobs; canonical repository commands must work without Bash-only or POSIX-only assumptions.
- Requires packaged desktop lifecycle proof on all three operating systems rather than deferring Windows/Linux discovery to the final release.
- Requires macOS Keychain, Windows Credential Manager/DPAPI, and Linux Secret Service implementations with no plaintext fallback.
- Requires platform-specific Chrome native-messaging installation and removal, including Windows registry registration and binary-mode protocol verification.
- Replaces the single Apple-MLX runtime assumption with a staged platform-profile model lock: accept the primary Apple-Silicon profile and prove Windows/Ubuntu capability detection and safe no-model behavior in `M05`; complete native Windows/Ubuntu full-AI certification before the Cross-Platform Core Gate in `M27`.
- Requires deterministic cross-platform PDF/DOCX behavior using controlled fonts and renderer versions, plus portable encrypted backups across certified platforms.
- Requires signed/notarized or appropriately verified platform installers, update, rollback, repair, and uninstall behavior before the cross-platform gate can pass.
- Keeps the current Codex-authored v1.2 traceability work useful: v1.3 extends and regenerates it through `M00-W10` rather than discarding it.
- Makes implementation-agent selection **owner-controlled and model-agnostic**. The active owner-selected agent continues across clean package boundaries until the owner explicitly changes it; the repository contract must not automatically switch between Claude, Codex, or reasoning modes. Independent audits still use a separate clean session or worktree.
- Expands M00 from seven to ten work packages while preserving every verified v1.2 revision and evidence record.


---

## 0. Owner decisions that override earlier plans

The following decisions are final unless the owner explicitly changes them later:

1. **Do not build Gmail integration, mailbox classification, recruiting-email synchronization, or AI email drafting.**
2. **Do not build networking, contact graphs, referral discovery, referral-message generation, or LinkedIn connection-path features.**
3. **Do not choose or discuss a product name in this project specification.** Use neutral labels such as “the product,” “desktop app,” and “browser extension.”
4. Keep the remaining applicant-side capabilities: structured profile, resume creation, resume tailoring, keyword/evidence matching, one-page optimization, cover letters, short-answer generation, autofill, document upload, application tracking, submission receipts, analytics, job discovery, interview practice, and approved-queue automatic application.
5. **Job aggregation and unattended automatic application remain late-stage work.** They must not distract from making profile, document, AI, autofill, Workday navigation, cross-platform runtime, and validation systems trustworthy first.
6. The final product must support an **approved application queue**. The user reviews and approves jobs in a simple UI; the product then applies to approved jobs automatically only when every required field can be answered safely and confidently. It pauses rather than guesses when it encounters a CAPTCHA, unsupported control, unapproved sensitive question, contradiction, login challenge, changed job, or uncertain answer.
7. A two-sided recruiter marketplace is not part of the mandatory product. It would be a separate business and infrastructure decision after this specification is complete.
8. **The two dominant product promises are accurate browser autofill and superior evidence-grounded resume tailoring with intelligent one-page optimization.** Other features are valuable only after those promises are proven.
9. **Workday is the first production ATS priority.** The product must reach measured Workday parity or superiority on supported tenant patterns before Greenhouse, Lever, or Ashby production expansion begins.
10. **Autofill feasibility must be proven early.** `M02` must load a real Manifest V3 extension in real Playwright Chromium, fill realistic controls, verify persisted and site-accepted values, report every unresolved required field, stress Workday-like controls and flows, and pass a blocking benchmark before `M03` becomes eligible.
11. **Resume tailoring and PageFit feasibility must be proven early.** `M05` must produce factual, coherent, job-aligned, measured one-page outputs on the frozen corpus and pass a blocking benchmark before `M06` becomes eligible.
12. **Workday production and guided pre-submit must pass a dedicated third gate.** `M19` and `M20` must prove production-grade Workday field coverage, page-state recognition, repeaters, uploads, rerender persistence, validation, automatic safe navigation, recovery, performance, and final-review stopping before `M21` becomes eligible.
13. **Certified Workday guided completion must minimize user effort.** When the user is already in an authenticated or guest application session and the current tenant pattern is certified, the user opens the form; if `AUTO_START_ON_OPEN` was explicitly enabled beforehand, the flow begins automatically, otherwise the user starts the current `GUIDED_PRE_SUBMIT` run; the product fills and verifies each page, clicks `Next` safely, proceeds through subsequent pages, and stops at the final review page. The user then reviews the complete application and clicks `Submit`.
14. `GUIDED_PRE_SUBMIT` must never automate login credentials, password entry, account creation, email verification, MFA, CAPTCHA solving, acceptance of unexpected legal terms, unapproved consequential answers, or final submission. It must pause with an exact reason and resume safely after the user resolves the boundary.
15. A failed critical gate does not permit compensating scope growth. The next action is focused defect iteration or an owner-approved redesign ADR; unrelated product milestones remain blocked.
16. The previous CareerPulse and `kalwad/JobApply` repositories are **legacy comparison baselines, not implementation foundations**. Production code must not be copied from them without an explicit license review, a file-level provenance record, and an approved ADR showing that the code meets this specification. Their observed failures must become adversarial regression cases.
17. The same implementation agent must not be the sole author of the implementation, expected benchmark answers, holdout cases, and final acceptance decision for a critical gate.
18. Compatibility claims must be limited to measured ATS families, Workday tenant/layout patterns, browser versions, adapter versions, locales, session modes, operating systems, architectures, hardware profiles, and last-tested dates. Never claim universal support for “every ATS,” “all Workday tenants,” “all Linux distributions,” or untested operating-system versions.
19. The project is governed by evidence, not milestone count. Completing many packages is not success if autofill, Workday guided completion, resume/PageFit, or certified-platform behavior remains unreliable.
20. **Certified first-release operating-system support is mandatory:** macOS 14+ on Apple Silicon arm64, Windows 11 x64, and Ubuntu 24.04 LTS x64. The core deterministic product must work on all three; full local-AI features require a certified hardware/runtime profile.
21. Windows 10, Intel macOS, Windows ARM64, Linux distributions other than Ubuntu 24.04 LTS, Firefox, Safari, and mobile applications are not certified first-release targets. They may be investigated later through an approved compatibility expansion package.
22. Platform-specific behavior must be isolated behind typed interfaces. Business logic, evidence, resume, ATS, and application state machines must not accumulate scattered OS-condition branches.
23. Secrets and database encryption keys must use macOS Keychain, Windows Credential Manager/DPAPI, or Linux Secret Service. Missing secure storage blocks startup of private-data features; plaintext fallback is prohibited.
24. Canonical build, test, doctor, and migration commands must be platform-neutral. Bash-only, POSIX-only, case-sensitive-filesystem-only, or shell-profile-dependent behavior is prohibited unless it is isolated to a platform-specific package with a tested equivalent on every certified platform.
25. **Cross-platform support must pass a fourth critical gate before the core closed alpha.** Packaged install, launch, local-service lifecycle, encrypted storage, native messaging, Chrome extension connection, backup/restore, document rendering, model-runtime capability detection, update/rollback, and uninstall must be proven on all three certified targets.
26. **Implementation-agent choice is controlled by the owner, not by this specification.** Continue using the currently owner-selected implementation agent until the owner explicitly changes it. Do not infer a switch from rate limits, elapsed time, package type, or model availability. Any capable agent may implement a package after reconstructing repository state and obeying the same tests and evidence contract; independent critical-gate audits must use a separate clean session or worktree from the implementation session.
27. Only one implementation agent may modify a working tree at a time. Agent changes occur at clean package boundaries whenever possible; a separate worktree is used for independent audits.

---

## 1. How implementation agents must use this specification

### 1.1 Canonical project-memory files

Milestone `M00` must create and maintain these files:

```text
CLAUDE.md

docs/MASTER_IMPLEMENTATION_SPEC.md   # this file; do not silently rewrite
docs/PROJECT_STATUS.md               # current milestone, work package, blockers, next action
docs/DECISIONS.md                    # accepted architecture decision records and owner decisions
docs/TEST_EVIDENCE.md                # exact verification commands and summarized results
docs/KNOWN_ISSUES.md                  # reproducible defects and deferred risks
docs/COMPATIBILITY_MATRIX.md          # ATS/browser/OS support and measured pass rates
docs/PLATFORM_SUPPORT.md              # certified OS/architecture/runtime/installer matrix and limitations
docs/REQUIREMENTS_TRACEABILITY.md     # generated/validated human-readable traceability view
docs/traceability.json                # reviewed machine-readable requirement/package mapping created by v1.2 M00-W07
docs/CRITICAL_GATES.md                # autofill, resume/PageFit, Workday, and cross-platform gate state/evidence
```

`PROJECT_STATUS.md` must always contain exactly one state for every work package:

```text
NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED
```

A work package is not `VERIFIED` merely because code exists. Its required tests must pass and its evidence must be recorded. It is not `ACCEPTED` until all milestone exit gates pass.

### 1.2 Mandatory session bootstrap

At the beginning of every new prompt or resumed session, Claude or Codex must:

1. Read `CLAUDE.md`.
2. Read this specification.
3. Read `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/TEST_EVIDENCE.md`, `docs/KNOWN_ISSUES.md`, and—after `M00-W05`—`docs/CRITICAL_GATES.md`.
4. Inspect the repository state and relevant tests instead of trusting an earlier conversational summary.
5. State the exact work-package ID it is executing.
6. Confirm the package dependencies are `VERIFIED` or `ACCEPTED`.
7. Work on one work package at a time unless the owner explicitly authorizes a larger batch.

### 1.3 Work-package execution protocol

For every work package, the implementation agent must follow this sequence:

1. **Restate the contract:** objective, affected components, non-goals, and acceptance evidence.
2. **Inspect before editing:** identify existing implementations, schemas, tests, migrations, and adjacent risks.
3. **Write or update tests first** whenever the behavior is testable before implementation.
4. **Implement the smallest coherent vertical slice** that satisfies the package.
5. **Run focused tests**, then the relevant package test suite, then the repository verification command.
6. **Inspect the actual UI or browser behavior** for UI/extension work; passing unit tests alone is insufficient.
7. **Record exact commands and results** in `docs/TEST_EVIDENCE.md`.
8. **For critical-gate work, run a separate independent review and the owner-controlled holdout evaluation; the implementation agent's own fixtures are not sufficient.**
9. **Update traceability, status, compatibility, and critical-gate files.**
10. **Report changed files, behavior, test results, remaining risks, and the next `READY` work package.**

### 1.4 Change-control rules

An implementation agent must not silently alter this specification, the selected stack, trust boundaries, model lock, acceptance thresholds, critical-gate status, or compatibility claims. When a change is necessary:

1. Create a proposed architecture decision record in `docs/DECISIONS.md`.
2. Explain the observed constraint, reproducible evidence, alternatives, tradeoffs, migration impact, security/privacy impact, benchmark impact, rollback plan, and proposed decision.
3. Keep the current contract in force until the owner approves the change.
4. After approval, update this specification, the traceability file, affected tests, project status, critical-gate status, compatibility promises, and the decision status in one coherent change.
5. Preserve the previous canonical version through Git history. Do not keep multiple files that can each be mistaken for the canonical specification after adoption.
6. A threshold may be strengthened without reducing safety, but it may not be weakened merely because current code fails.
7. A critical gate can transition only through:

```text
NOT_EVALUATED -> IN_PROGRESS -> PASS
                           -> REDESIGN_REQUIRED
                           -> BLOCKED
```

8. `REDESIGN_REQUIRED` blocks downstream readiness. A redesign must be represented by an approved ADR, new or amended work packages, new regression cases, and a complete rerun of the gate.
9. An interrupted agent session is not a specification change. Resume from repository state; never reset or discard unexplained work solely to obtain a clean start.

#### 1.4.1 Version 1.3 adoption protocol after an in-flight or completed v1.2 `M00-W07`

For the current repository:

1. Finish `M00-W07` completely under v1.2. Preserve the in-flight Codex traceability implementation, run its full tests, commit, push, and stop before `M01-W01` implementation.
2. If v1.2 marks M00 `ACCEPTED` and `M01-W01` `READY`, treat those states as historical v1.2 evidence. Do not begin M01 until v1.3 adoption and the expanded M00 exit gate finish.
3. Keep this complete owner-approved file outside the repository at an immutable absolute path, record its SHA-256, and leave `docs/MASTER_IMPLEMENTATION_SPEC.md` unchanged until M00-W08 performs the atomic replacement. Do not place a second canonical-looking specification under `docs/`; the v1.2 fail-closed validator correctly rejects that state.
4. Execute `M00-W08` as the owner-approved v1.3 migration. After a clean v1.2 preflight, it reads and hashes the external owner-approved file, copies those exact bytes directly over the canonical path without ever creating a second canonical-looking file in the repository, records the ADR, adds the fourth gate and platform memory files, migrates status and validators, preserves all completed v1.2 revisions/evidence, and reopens M00 as `IN_PROGRESS` with `M01-W01` no longer ready. Because the v1.2 traceability check is already mandatory, M00-W08 must also perform a mechanical exact-inventory extension of `docs/traceability.json` and its validator for the 22 new requirements and 26 new packages, marking every new future item honestly `NOT_STARTED`/`NOT_YET_APPLICABLE`; M00-W10 performs the full reviewed mapping and acceptance audit.
5. Execute `M00-W09` to add Windows CI, Windows-aware doctor/preflight behavior, platform-portability static checks, and initial support-matrix enforcement. No product features are implemented in this package.
6. Execute `M00-W10` to extend—not discard—the v1.2 `docs/traceability.json`, `scripts/traceability.py`, generated Markdown view, and validation tests to the exact v1.3 inventory, rerun the complete M00 fresh-clone matrix, re-accept M00, and make `M01-W01` ready again.
7. Git history preserves v1.2. The external owner-approved source is not committed; after adoption the repository still contains exactly one canonical master specification.
8. Do not modify the canonical specification or traceability inventory in the active v1.2 `M00-W07` working tree.

### 1.5 Non-negotiable engineering behavior

Every implementation agent must obey all of the following:

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
- Do not add placeholders, fake integrations, mocked “success” states, or dead buttons in a milestone marked complete.
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
- Do not automatically select or switch implementation models. Use the owner-selected agent for the active package, preserve clean handoffs at package boundaries, and use a separate clean session or worktree for independent audits when required.

- Do not claim a platform supported from compilation alone. Certified support requires packaged execution on the actual operating-system family and architecture.
- Do not put platform checks throughout business logic. Platform selection must occur through typed interfaces and capability records.
- Do not use plaintext secret, database-key, token, or credential fallback when a platform secret store is unavailable.
- Do not hard-code `/`, `\`, drive letters, home directories, executable suffixes, line endings, case sensitivity, shell initialization, or process signals in shared logic.
- Do not rely on a GUI process inheriting interactive-shell `PATH`; packaged runtime discovery must be explicit and tested.
- Do not mark a cross-platform test passed when it ran only in a Linux container or through cross-compilation. The defined native platform evidence is mandatory.
- Do not use a single MLX-only model artifact as the universal runtime. Model family, artifact, accelerator, memory limits, and benchmark results are platform-profile data.
- Do not publish an installer or update without install, repair, upgrade, rollback, uninstall, native-host cleanup, and user-data-preservation evidence for that platform.
- Do not make core deterministic autofill depend on local-model availability. Unsupported hardware disables or degrades AI writing features visibly while preserving safe profile, matching, tracking, and ordinary form behavior.

### 1.6 Definition of a valid completion report

Every package completion report must include:

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

A vague statement such as “implemented and tested” is not acceptable.

---

## 2. Product mission and measurable definition of “better”

### 2.1 Mission

Build a local-first applicant application that is faster and more convenient than manual job applications while being measurably more accurate, truthful, transparent, controllable, and useful than Simplify on the workflows included in this specification.

The product has four non-negotiable promises:

1. **Autofill:** identify, resolve, fill, and verify ordinary fields accurately and quickly across measured major ATS patterns while refusing unsafe guesses and reporting every unresolved required field.
2. **Workday complete-to-review:** on certified Workday tenant patterns, after the user opens the application under an active prior opt-in or starts the current run, complete every safe page with no manual data entry, advance through pages automatically, and stop at the final review boundary for the user to inspect and submit.
3. **Resume tailoring and PageFit:** create a stronger job-specific resume that uses only supported experience, avoids keyword stuffing and incoherence, and fits to one readable page when doing so is genuinely beneficial.
4. **Certified cross-platform reliability:** provide the same trustworthy core workflows on macOS arm64, Windows x64, and Ubuntu Linux x64, with platform-native security, installers, extension/native-host integration, and explicit local-AI capability profiles.

No secondary feature can compensate for failure of any promise.

The central design is a **canonical career-evidence system** shared by every feature:

- User-approved facts are stored once with provenance.
- Generated claims link internally to supporting evidence records.
- Unsupported keywords are shown as gaps instead of being hidden in a skills section.
- Application answers are scoped by intent, company, role, jurisdiction, and time.
- Sensitive answers come from explicit user records and confirmation policies, never inference.
- Every application records the exact documents, answers, field decisions, navigation decisions, and submission evidence used.
- User edits improve style and preference memory without changing underlying facts.

Project success is measured as a sequence of increasingly difficult proofs, not as completion of a long checklist:

```text
reproducible repository
    -> typed contracts and frozen evaluation system
    -> early generic + Workday-stress autofill feasibility PASS
    -> secure local platform abstraction, Windows CI, and accepted local-model profiles
    -> early resume/PageFit feasibility PASS
    -> complete evidence/profile/document product
    -> production extension and generic form engine
    -> Workday production adapter PASS
    -> Workday guided pre-submit PASS
    -> Greenhouse, Lever, Ashby, and cross-ATS manual workflow
    -> packaged macOS/Windows/Ubuntu core and CROSS_PLATFORM_CORE PASS
    -> hardened closed alpha
    -> broader measured ATS coverage
    -> approved queue and certified automatic application
    -> final independent release audit
```

### 2.2 Product completion standard

The project is complete only when all mandatory milestones are `ACCEPTED` and the final validation gate demonstrates the following on a frozen benchmark corpus:

| Dimension | Required release result |
|---|---:|
| Ordinary autofill field precision | **>= 99.5%** |
| Ordinary autofill recall on supported ATS fixtures | **>= 97%** |
| Sensitive/prohibited false-fill rate | **0** |
| Required visible field silently skipped on supported fixtures | **0** |
| Workday certified-flow wrong-page or wrong-button navigation | **0** |
| Workday `GUIDED_PRE_SUBMIT` final-submit clicks | **0** |
| Workday certified flows reaching the correct final review boundary | **100%** in the release fixture matrix |
| Workday duplicate repeater records caused by automation | **0** |
| Workday exact resume/document attachment verification | **100%** on certified fixtures |
| Workday page transition confirmed before next action | **100%** |
| Unsupported factual claims in released resume/Q&A corpus | **0** |
| Stale-company or stale-role leakage | **0** |
| Duplicate application submitted | **0** |
| Unapproved job submitted | **0** |
| Submission marked successful without receipt or explicit confirmation | **0** |
| PDF text extraction order pass rate | **100%** for supported templates |
| PDF clipping/overflow defects | **0** in release render matrix |
| Resume and answer human preference vs. frozen baseline | **statistically meaningful win** on the defined evaluation set |
| Median accepted-answer edit distance over repeated use | **decreases over time** in longitudinal test |
| Generic autofill latency, excluding AI generation | **p95 <= 1.5 s per page** on target hardware |
| Workday ordinary-page fill and verification, excluding upload/model generation | **p95 <= 3.0 s per page** on target hardware |
| Short-answer generation, typical prompt | **p95 <= 20 s** on target hardware |
| Tailored one-page resume generation | **p95 <= 90 s** on target hardware |
| Extension crash-free test sessions | **>= 99.5%** |
| Main desktop workflow accessible by keyboard | **100% of required controls** |
| Certified platform clean install and first launch | **100%** on macOS arm64, Windows x64, and Ubuntu x64 release fixtures |
| Packaged desktop/local-service lifecycle matrix | **100%** on all certified platforms |
| Extension-to-native-host authenticated connection | **100%** on all certified platforms |
| Platform secret-store plaintext fallbacks | **0** |
| Encrypted backup restore across certified source/target combinations | **100%** for the defined compatibility matrix |
| PDF/DOCX semantic extraction parity | **100% expected text order** on every certified platform |
| Platform-specific local-model structured-output/factuality gate | **PASS** for at least one full-AI profile per certified OS |
| Update/rollback/uninstall data-loss defects | **0** in the platform release matrix |
| Critical security findings at release | **0 open** |

“Better than Simplify” must not be asserted from opinion alone. The final gate includes manual, terms-compliant side-by-side evaluation on the same forms and content examples, with a dedicated Workday comparison. The benchmark must compare accuracy, omissions, manual corrections, page progression, factuality, quality, explainability, performance, and recovery behavior. No automated extraction of Simplify’s private APIs or code is permitted.

### 2.3 Critical-risk progression contract

#### Gate A — Autofill Feasibility Gate (`M02`)

Before `M03` becomes `READY`, `M02` must demonstrate on the frozen development corpus, owner-controlled holdout, and public no-submit matrix:

| Dimension | Blocking early result |
|---|---:|
| Ordinary attempted-fill precision on supported variants | **>= 99.5%** |
| Required ordinary-field recall on declared supported variants | **>= 97%** |
| Sensitive/prohibited false fills | **0** |
| Catastrophically wrong option selections | **0** |
| Honeypot fills | **0** |
| Visible required fields silently omitted | **0** |
| Unresolved required fields explicitly reported | **100%** |
| Intended values retained after controlled rerender | **>= 99.5%** |
| Duplicate actions caused by rescans | **0** |
| Generic scan/fill p95, excluding AI | **<= 1.5 s per page** on the target Mac |
| Live employer submissions performed by gate automation | **0** |
| Workday challenge-set architecture failures hidden or waived | **0** |
| Greenhouse/Lever/Workday research comparison versus Simplify | **non-inferior precision on the declared narrow set, within the declared recall margin, and safer or equal on uncertainty** |
| Comparison versus CareerPulse/legacy JobApply | **decisive measured improvement with no inherited unsafe fallback** |

The side-by-side comparison uses the same synthetic profile, same public form, same expected values, same browser family where practical, and field-by-field manual scoring. Workday is not yet a production claim in `M02`; however, the Workday challenge set must prove that semantic identity, control drivers, rerender verification, repeaters, bounded observers, and page-state architecture are viable. Fundamental Workday failures produce `REDESIGN_REQUIRED`, not a deferral to `M19`.

#### Gate B — Resume Tailoring and PageFit Feasibility Gate (`M05`)

Before `M06` becomes `READY`, `M05` must demonstrate:

| Dimension | Blocking early result |
|---|---:|
| Unsupported atomic factual claims | **0** |
| Unsupported keywords inserted as claimed skills | **0** |
| Skills without approved evidence links | **0** |
| Stale company/role/location leakage | **0** |
| Fact changes caused by shortening | **0** |
| Clipping, overlap, hidden text, or missing visible content | **0** |
| Expected extracted-text order | **100%** for the feasibility template |
| Keyword/terminology improvement | **positive only for supported requirements** |
| Repetition and skills-section budget violations | **0** |
| Normalized utility retained when a one-page output is feasible | **>= 95%** |
| Correct two-page recommendation when floors would be violated | **100% of defined guardrail cases** |
| Severe swap, sustained memory pressure, or system instability on M5/24 GB | **0 accepted benchmark runs** |
| Blind preference versus one-shot and keyword-stuffing baselines | **statistically meaningful win on the defined set** |
| Simplify comparison | **at least parity on overall usefulness, with superior or equal factuality and transparency; final release still requires a meaningful win** |

#### Gate C — Workday Production and Guided Pre-Submit Gate (`M19`–`M20`)

Before `M21` becomes `READY`, the production Workday adapter and `GUIDED_PRE_SUBMIT` workflow must demonstrate on the versioned development matrix, owner-controlled holdout, controlled end-to-review runs, and public no-submit matrix:

| Dimension | Blocking Workday result |
|---|---:|
| Ordinary attempted-fill precision on certified patterns | **>= 99.5%** |
| Required ordinary-field recall on certified patterns | **>= 97%** |
| Sensitive/prohibited false fills | **0** |
| Unresolved required fields explicitly reported | **100%** |
| Catastrophically wrong option selections | **0** |
| Work/education/skill repeater duplicates caused by automation | **0** |
| Intended values retained after Workday rerender and page revisit | **>= 99.5%** |
| Exact selected document attached and verified | **100%** |
| Page-readiness proofs completed before `Next` | **100%** |
| Wrong, premature, repeated, or ambiguous `Next` clicks | **0** |
| Unconfirmed page transitions followed by another action | **0** |
| Certified flows reaching the correct final review boundary | **100%** |
| Final submit controls activated by `GUIDED_PRE_SUBMIT` | **0** |
| Defined reload/back/service-worker/session-timeout recovery cases | **100% correctly resumed or explicitly paused** |
| Login, account creation, MFA, email verification, CAPTCHA, and legal-consent boundaries bypassed | **0** |
| Ordinary Workday page fill/verify p95, excluding uploads and AI | **<= 3.0 s** on the target Mac |
| Long-session observer or memory leak | **0 confirmed monotonic leak in the defined soak** |
| Manual corrections versus Simplify on the same certified matrix | **non-inferior overall, with fewer or equal unsafe/wrong fills and better unresolved-field reporting** |
| Live employer submissions performed by gate automation | **0** |

A certified Workday flow begins only after the user opens the application and either explicitly starts the current run or has an active, revocable `AUTO_START_ON_OPEN` consent recorded for certified Workday patterns. The mode may proceed without manual data entry only when the user has an active permitted session, all required answers are approved or safely derivable, and the tenant pattern is certified. Any boundary or uncertainty pauses the flow. The mode always stops at final review and leaves submission to the user.

#### Gate D — Cross-Platform Core Gate (`M03`–`M05`, `M10`, `M17`, `M27`)

Before `M28` becomes `READY`, the product must demonstrate the following on packaged native builds for macOS 14+ arm64, Windows 11 x64, and Ubuntu 24.04 LTS x64:

| Dimension | Blocking cross-platform result |
|---|---:|
| Clean install, launch, and first-run diagnostics | **100%** on every certified platform |
| Local orchestrator start/auth/stop and forced-crash recovery | **100%** on every certified platform |
| Orphan processes after normal or forced exit | **0** |
| Secret-store plaintext or insecure fallback | **0** |
| Encrypted database unreadable without platform-protected key | **100%** |
| Chrome extension to registered native host handshake | **100%** on every certified platform |
| Native-host registration removed on uninstall | **100%** while user data is preserved unless deletion is requested |
| Core deterministic workflow blocked by unavailable AI model | **0** |
| At least one full-AI model/runtime profile passes factuality and structured-output gates | **1 or more per certified OS** |
| Controlled PDF/DOCX text order, clipping, and font matrix | **100% text-order pass; 0 clipping/hidden-content defects** |
| Cross-platform encrypted backup restore cases | **100%** on the defined source/target matrix |
| Install path with spaces and Unicode | **100%** |
| Case-sensitivity, path separator, line-ending, locked-file, and atomic-replace cases | **100% correct or safely blocked** |
| Update, rollback, repair, and uninstall scenario completion | **100%** on the certified release matrix |
| Required Chrome stable extension/browser E2E | **PASS** on all certified platforms |
| Critical or high platform-specific defects | **0 open** |
| Platform claim not backed by a dated compatibility row and artifact | **0** |

The gate requires native packaged evidence, not only compilation, emulation, containers, or cross-compilation. A separate high-capability session audits each platform evidence bundle, and the owner records the gate decision.

#### Gate decision rules

- `PASS`: all zero-tolerance metrics pass, every quantitative threshold passes, holdout results are valid, and the independent reviewer confirms the architecture can scale.
- `REDESIGN_REQUIRED`: a fundamental design assumption fails—for example brittle field identity, nondeterministic state management, unsafe option selection, inability to verify postconditions, unreliable Workday step recognition, unsafe navigation, keyword-stuffing pressure, or a PageFit method that destroys utility.
- `BLOCKED`: evidence cannot be completed because a required environment, manual comparison, controlled Workday session, or owner-controlled holdout run is unavailable.
- No downstream package may be marked `READY` merely because the gate is “close.”
- A gate failure must create reproducible cases and an ADR before iteration. Thresholds remain in force.
- `M21` and later production ATS expansion remain blocked unless `WORKDAY_GUIDED_PRE_SUBMIT = PASS`.
- `M28` and later closed-alpha expansion remain blocked unless `CROSS_PLATFORM_CORE = PASS`.

### 2.4 Explicit non-goals

The following are not part of the mandatory project:

- Gmail or any other mailbox integration.
- AI-generated recruiting email, follow-up, thank-you, negotiation, or referral messages.
- Networking graphs, contact imports, connection paths, or referral discovery.
- LinkedIn session automation, authenticated scraping, or private API use.
- Product naming, logo, brand system, or marketing-site design.
- Employer-side applicant tracking or recruiting software.
- A recruiter marketplace or priority recruiter introductions.
- CAPTCHA solving or anti-bot evasion.
- Fully autonomous generation of legally consequential answers.
- Mobile apps before desktop and browser workflows are complete.
- First-release certification for Windows 10, Intel Macs, Windows ARM64, non-Ubuntu Linux distributions, Firefox, Safari, or ChromeOS.
- Claiming that a CPU-only model profile meets the same latency target as a certified GPU/Apple-Silicon profile unless the benchmark proves it.
- Unsupported claims that the product can predict an employer’s private ATS ranking or hiring decision.

---

## 3. Mandatory user-facing capability set

### 3.1 Profile and evidence

The user can create or import a complete profile containing identity, contact details, links, education, employment, projects, achievements, skills, certifications, preferences, eligibility, authorization, location, compensation constraints, and reusable application facts. Every factual item can be traced to its source and explicitly approved, corrected, superseded, or revoked.

### 3.2 Resume creation and management

The user can:

- Import PDF and DOCX resumes.
- Review extracted facts before approval.
- Create resumes from profile evidence.
- Maintain multiple immutable role-specific variants.
- Edit semantic sections and bullets.
- Reorder, hide, restore, branch, compare, and roll back versions.
- Use a high-quality ATS-safe template initially, followed by additional validated templates.
- Export PDF and DOCX.
- Validate extraction order, page count, clipping, and document consistency.

### 3.3 Job analysis and match explanation

The product can capture a job from a URL, browser page, pasted text, or later the internal job index. It parses must-have and preferred requirements, responsibilities, skills, tools, seniority, location, compensation, work authorization, and other constraints. It shows separate, explainable dimensions for eligibility, evidence coverage, terminology alignment, document parseability, and readability rather than one unexplained “ATS score.”

### 3.4 Grounded resume tailoring

The product can tailor an entire resume, a section, or selected bullets. It must plan changes at the whole-document level, link every factual claim to evidence, enforce keyword and repetition budgets, preserve chronology, avoid fake metrics, and present a side-by-side diff. Unsupported requirements must remain visible gaps.

### 3.5 One-page optimization

The product can fit a resume to one page by prioritizing high-value content and removing or shortening low-value material before compressing typography. It must show exactly what changed and preserve readable limits.

### 3.6 Cover letters

The product can generate, edit, version, and export job-specific cover letters using only approved evidence and verified job/company context. Generic praise, invented company facts, and stale company names are prohibited.

### 3.7 Application short answers

The browser extension detects written application questions. The user can generate one answer or a reviewed batch. Answers must respect exact limits, use the user’s evidence and learned voice, avoid generic AI phrasing, and reuse prior answers semantically only when context and sensitivity rules permit it.

### 3.8 Safe autofill

The extension fills ordinary profile fields, employment, education, links, eligibility, documents, and supported custom fields. It shows what was filled, skipped, sensitive, or uncertain; exposes provenance; supports undo; and performs post-fill reconciliation. Consequential fields follow explicit policies.

### 3.9 Workday complete-to-review

For certified Workday tenant patterns, the user opens an application. With prior revocable `AUTO_START_ON_OPEN` consent, this page open triggers `GUIDED_PRE_SUBMIT`; otherwise the user starts the run from the extension. The product detects the current step, fills and verifies every safe field, resolves repeaters and uploads, reconciles validation, clicks `Next` exactly once when the page-readiness proof passes, and continues until the certified final review page. It pauses for login/account/MFA/CAPTCHA boundaries, unexpected sensitive questions, ambiguity, validation failure, unsupported controls, or session changes. It never clicks the final submit control in this mode. The user reviews the complete cross-page summary and submits manually.

### 3.10 Application tracker and analytics

The product records saved, approved, queued, applying, applied, screen, interview, offer, rejection, withdrawn, failed, and archived states. It stores exact document/answer snapshots and submission receipts. It provides filters, views, favorites, archive, CSV import/export, and honest funnel analytics without email integration.

### 3.11 Interview practice

The user can practice job-specific questions, record or type answers, receive evidence-aware feedback, identify missing examples, and improve structure without inventing experience.

### 3.12 Job discovery

After the core product is validated, the product maintains or syncs a constantly refreshed index of public jobs from permitted sources. The user can search, filter, save, dismiss, and rank jobs with explainable reasons and freshness/provenance indicators.

### 3.13 Approved-queue automatic application

The user can approve jobs and add them to a queue. The product prepares a per-job application plan, selects or generates verified documents and answers, executes supported applications, pauses on uncertainty, records every step, and submits only when all required preconditions are satisfied.

### 3.14 Certified cross-platform desktop and extension

The user can install and run the product on a certified macOS, Windows, or Ubuntu machine without using a terminal. The desktop app starts and authenticates the local service, accesses the platform-native secret store, connects the Chrome extension to the native host, reports local-model capability, exports equivalent documents, preserves encrypted backups across platforms, updates and rolls back safely, and uninstalls without deleting user data unless explicitly requested. Unsupported operating systems, architectures, browsers, or hardware profiles are shown honestly rather than silently attempted.

---

## 4. Requirements catalog

Every requirement below must appear in `docs/REQUIREMENTS_TRACEABILITY.md` with links to implementation modules, automated tests, manual test cases, and its release gate.

### 4.1 Profile and evidence requirements

- `REQ-PROF-001`: Store canonical profile facts separately from generated text.
- `REQ-PROF-002`: Record provenance, confidence, approval state, timestamps, and supersession history for every fact.
- `REQ-PROF-003`: Support employment, education, projects, achievements, skills, certifications, links, eligibility, preferences, and reusable application facts.
- `REQ-PROF-004`: Prevent generated content from silently mutating canonical evidence.
- `REQ-PROF-005`: Support import review, conflict resolution, and duplicate consolidation.
- `REQ-PROF-006`: Support explicit sensitive-answer records with scope and last-confirmed dates.
- `REQ-PROF-007`: Support export and deletion of all user-owned data.

### 4.2 Resume and document requirements

- `REQ-RES-001`: Use a semantic, versioned resume schema independent of visual templates.
- `REQ-RES-002`: Import PDF and DOCX with reviewable extraction confidence.
- `REQ-RES-003`: Create, branch, diff, restore, and compare resume variants.
- `REQ-RES-004`: Render deterministic PDF and DOCX outputs.
- `REQ-RES-005`: Validate extraction order, clipping, overflow, missing glyphs, and page count.
- `REQ-RES-006`: Tailor at document level with evidence-linked claims.
- `REQ-RES-007`: Enforce keyword, repetition, length, and chronology constraints.
- `REQ-RES-008`: Show unsupported requirements honestly.
- `REQ-RES-009`: Fit to one page using content utility before typography compression.
- `REQ-RES-010`: Preserve user-controlled locked sections, bullets, wording, and facts.
- `REQ-RES-011`: Prove the core tailoring and PageFit architecture on the frozen corpus in `M05` before the full resume product proceeds.
- `REQ-RES-012`: Allocate each important supported job requirement to its strongest evidence location and enforce a whole-document mention budget.
- `REQ-RES-013`: Treat the skills section as an evidence-linked index; no skill may be added solely for keyword overlap.
- `REQ-RES-014`: Decompose and re-verify every generated or shortened sentence into atomic claims before it can enter an accepted document.
- `REQ-RES-015`: Preserve locked content and report every PageFit removal, shortening operation, utility change, typography change, and reason.
- `REQ-RES-016`: Benchmark against the untailored original, simple keyword stuffing, a one-shot local-model baseline, and manually captured Simplify output on identical user-owned examples.
- `REQ-RES-017`: Prevent downstream resume milestones from becoming ready while the resume/PageFit gate is not `PASS`.
- `REQ-RES-018`: Reuse and productionize the accepted feasibility planner, verifier, renderer, and measurement artifacts rather than replacing them with an unmeasured rewrite.

### 4.3 Job and match requirements

- `REQ-JOB-001`: Capture jobs from page DOM, URL, pasted text, and internal index.
- `REQ-JOB-002`: Version job descriptions and retain the source snapshot/hash.
- `REQ-JOB-003`: Parse requirements, importance, evidence type, seniority, location, compensation, and eligibility constraints.
- `REQ-JOB-004`: Separate eligibility, evidence coverage, terminology alignment, parseability, and readability.
- `REQ-JOB-005`: Explain every match and gap with source spans.
- `REQ-JOB-006`: Never present a speculative score as an employer’s actual ATS result.
- `REQ-JOB-007`: Detect duplicate or materially identical postings.

### 4.4 Answer and cover-letter requirements

- `REQ-ANS-001`: Classify question intent and sensitivity before generation or reuse.
- `REQ-ANS-002`: Retrieve only relevant, approved evidence.
- `REQ-ANS-003`: Enforce word, character, and formatting constraints exactly.
- `REQ-ANS-004`: Verify every factual claim and reject unsupported output.
- `REQ-ANS-005`: Maintain semantic answer memory with company, role, location, jurisdiction, and freshness scopes.
- `REQ-ANS-006`: Learn style from user samples and accepted edits without altering facts.
- `REQ-ANS-007`: Detect stale company/role/location references and contradictions.
- `REQ-ANS-008`: Batch-generate questions only with per-answer review state and confidence.
- `REQ-ANS-009`: Generate evidence-backed cover letters with immutable versions.
- `REQ-ANS-010`: Never auto-answer a prohibited or unconfirmed sensitive question.

### 4.5 Autofill and extension requirements

- `REQ-FORM-001`: Use a typed field ontology and adapter-first architecture.
- `REQ-FORM-002`: Resolve controls from labels, names, IDs, autocomplete, ARIA, nearby text, options, and section context.
- `REQ-FORM-003`: Handle native and framework-controlled inputs, selects, radios, checkboxes, dates, comboboxes, custom controls, iframes, and supported shadow DOM.
- `REQ-FORM-004`: Support dynamic and multipage applications.
- `REQ-FORM-005`: Support resume and cover-letter uploads with exact version selection.
- `REQ-FORM-006`: Show filled, uncertain, sensitive, skipped, and unsupported fields.
- `REQ-FORM-007`: Preserve provenance and allow undo before submission.
- `REQ-FORM-008`: Reconcile required visible fields after every fill pass.
- `REQ-FORM-009`: Achieve zero false fills on sensitive/prohibited test fields.
- `REQ-FORM-010`: Provide a safe “teach this site” mechanism for unsupported controls.
- `REQ-FORM-011`: Use optional host permissions or explicit site grants where practical.
- `REQ-FORM-012`: Never expose privileged native operations directly to page content.
- `REQ-FORM-013`: Represent field identity with a versioned semantic/structural address; a raw selector or DOM index is only a disposable resolution hint.
- `REQ-FORM-014`: Re-resolve the current control immediately before every fill action and pause when resolution is no longer unique.
- `REQ-FORM-015`: Use control-specific transactional drivers with explicit preconditions, execution, postconditions, rollback/undo, and diagnostics.
- `REQ-FORM-016`: Count a fill as successful only when the intended value is observed, persists after framework rerender, and is accepted by the page validation state.
- `REQ-FORM-017`: Preserve successful deterministic decisions when optional AI classification fails, times out, or returns malformed output.
- `REQ-FORM-018`: Use bounded, incremental mutation observation scoped to application roots and affected subtrees; measure callback count, scan time, CPU, and memory.
- `REQ-FORM-019`: Run independent content-script agents inside each permitted frame and aggregate typed results through the service worker rather than traversing cross-origin frames from the parent.
- `REQ-FORM-020`: Test critical behavior through the real built Manifest V3 extension in bundled Playwright Chromium with a persistent context and actual service worker.
- `REQ-FORM-021`: Publish support only by ATS family, tenant pattern, adapter version, browser version, metric result, known limitations, and last-tested date.
- `REQ-FORM-022`: Pass the blocking early autofill feasibility gate before desktop/product expansion proceeds.
- `REQ-FORM-023`: Never select an unrelated option merely because it is the only option currently rendered.
- `REQ-FORM-024`: Never report readiness while a visible enabled required control remains unresolved or while a page script has changed an intended value.
- `REQ-FORM-025`: Perform no live employer submission during feasibility, CI, or unattended compatibility testing.
- `REQ-FORM-026`: Reuse and productionize the accepted feasibility scanner, resolver, field address, drivers, benchmark fixtures, and reconciliation rules in later extension milestones.

### 4.6 Workday-specific requirements

- `REQ-WD-001`: Treat Workday as the first production ATS and block Greenhouse, Lever, and Ashby readiness until the Workday production/guided gate is `PASS`.
- `REQ-WD-002`: Maintain a versioned Workday tenant-pattern taxonomy covering hostname family, locale, candidate-session mode, route family, page sequence, control families, and last-tested evidence.
- `REQ-WD-003`: Detect the current Workday application step from multiple independent signals; a single URL fragment, heading, selector, or `data-automation-id` value is insufficient.
- `REQ-WD-004`: Model guest, authenticated, returning-candidate, login, account-creation, email-verification, MFA, CAPTCHA, expired-session, and duplicate-application boundaries explicitly.
- `REQ-WD-005`: Never automate passwords, login credentials, account creation, email verification, MFA, CAPTCHA, or acceptance of unexpected legal terms; pause with resumable state.
- `REQ-WD-006`: Implement stable repeater identities and idempotent add/edit/delete behavior for work experience, education, skills, languages, certifications, websites, and other tenant-defined repeaters.
- `REQ-WD-007`: Prevent duplicate repeater entries across resume parsing, profile insertion, reload, back navigation, retry, and service-worker restart.
- `REQ-WD-008`: Treat resume upload and Workday resume parsing as a transactional workflow: verify the exact artifact, wait for parsing, compare parsed values, preserve approved user data, and reconcile duplicates or omissions before navigation.
- `REQ-WD-009`: Support Workday-specific prompt, combobox, listbox, date, phone, address, country/region, questionnaire, consent, disclosure, and validation patterns through measured drivers rather than one generic fill function.
- `REQ-WD-010`: Maintain a versioned Workday application state machine with route/document/page generation, step history, intended decisions, observed values, conditional fields, validation, and navigation state.
- `REQ-WD-011`: Create a deterministic page-readiness proof before every automatic `Next` action; it must show zero unresolved visible required fields, zero page validation rejection, persisted intended values, resolved documents, satisfied sensitive policy, and a uniquely identified enabled navigation control.
- `REQ-WD-012`: Click `Next` at most once for a page generation, attach an idempotency key, and never retry after timeout until the state machine proves whether a transition occurred.
- `REQ-WD-013`: Confirm a Workday page transition from route/document/step evidence before executing any action on the next page.
- `REQ-WD-014`: Support back, reload, service-worker suspension, local-service restart, browser restart where feasible, session timeout, and user pause/resume without repeating destructive actions.
- `REQ-WD-015`: Provide an explicit `GUIDED_PRE_SUBMIT` mode with `MANUAL_START` and revocable `AUTO_START_ON_OPEN` triggers; auto-start is allowed only after prior user consent and on a certified pattern, and the mode performs safe fill-and-next progression and stops on the certified final review page without activating submit.
- `REQ-WD-016`: `AUTO_START_ON_OPEN` requires explicit prior opt-in, a certified tenant pattern, a ready profile/document/answer state, a visible cancelable start indication, and immediate disable controls; opening an uncertified, stale, or protected-boundary page must not trigger fill or navigation.
- `REQ-WD-017`: In `GUIDED_PRE_SUBMIT`, require no manual data entry on certified flows when the session is ready and all facts/answers/policies are already approved; otherwise pause with exact required intervention.
- `REQ-WD-018`: Build a final cross-page review inventory containing every field decision, answer, document, sensitive confirmation, unresolved item, page transition, and source/provenance before the user submits.
- `REQ-WD-019`: Allow the user to pause, cancel, disable auto-next, inspect the current step, undo within supported boundaries, and return to manual mode at any time.
- `REQ-WD-020`: Publish Workday compatibility only for measured tenant/layout/locale/session patterns with raw counts, precision, recall, progression rate, manual corrections, known limitations, adapter/browser versions, and last-tested date.
- `REQ-WD-021`: Compare certified Workday behavior with Simplify on the same synthetic profile and forms; require non-inferior accuracy and materially better or equal uncertainty reporting before other production ATS work begins.
- `REQ-WD-022`: Preserve the accepted Workday state machine and navigation guard for later approved-queue automation; later auto-submit logic must not bypass the human-review `GUIDED_PRE_SUBMIT` mode.
- `REQ-WD-023`: Require the complete Workday gate regression after any change to tenant detection, step classification, repeaters, uploads, validation, navigation, service-worker recovery, browser version, or relevant profile/answer contracts.

### 4.7 Tracking requirements

- `REQ-TRACK-001`: Use an event-sourced or append-only application history.
- `REQ-TRACK-002`: Store exact resume, cover letter, answers, and field-decision snapshots.
- `REQ-TRACK-003`: Mark submission successful only from a recognized receipt or explicit user confirmation.
- `REQ-TRACK-004`: Detect duplicates before fill and before submit.
- `REQ-TRACK-005`: Support manual status changes, filters, views, archive, favorites, CSV import/export, and analytics.
- `REQ-TRACK-006`: Preserve failure evidence and resumable state.

### 4.8 Job discovery and autopilot requirements

- `REQ-DISC-001`: Ingest only permitted public or licensed job sources with provenance and terms metadata.
- `REQ-DISC-002`: Maintain freshness, expiration, deduplication, and source-health signals.
- `REQ-DISC-003`: Rank jobs using explicit user preferences, eligibility, evidence fit, freshness, and explainable weights.
- `REQ-DISC-004`: Never hide hard eligibility conflicts inside a recommendation score.
- `REQ-AUTO-001`: Apply only to jobs explicitly approved by the user.
- `REQ-AUTO-002`: Create a versioned application plan before execution.
- `REQ-AUTO-003`: Use a resumable, idempotent state machine with per-step audit records.
- `REQ-AUTO-004`: Pause on CAPTCHA, unsupported pages, unexpected sensitive questions, conflicts, low confidence, or missing evidence.
- `REQ-AUTO-005`: Enforce duplicate guards, rate limits, concurrency limits, and user stop/pause controls.
- `REQ-AUTO-006`: Never use stealth, CAPTCHA bypass, access-control bypass, or private employer APIs.
- `REQ-AUTO-007`: Require submission evidence and store a receipt.
- `REQ-AUTO-008`: Support dry-run and pre-submit-only modes before auto-submit can be enabled.

### 4.9 Platform, privacy, and quality requirements

- `REQ-PLAT-001`: Keep private profile/application data local by default.
- `REQ-PLAT-002`: Encrypt private data at rest and protect secrets in the operating-system keychain or credential store.
- `REQ-PLAT-003`: Bind local services to loopback and authenticate every client.
- `REQ-PLAT-004`: Redact PII and secrets from logs and diagnostics.
- `REQ-PLAT-005`: Version schemas, prompts, model configuration, platform profiles, and migrations.
- `REQ-PLAT-006`: Provide export, deletion, backup, and restore.
- `REQ-PLAT-007`: Meet defined performance and crash-free thresholds on the certified hardware profiles, including the M5/24 GB primary target.
- `REQ-PLAT-008`: Meet keyboard and screen-reader requirements for critical workflows.
- `REQ-PLAT-009`: Treat model, browser, extension, operating-system, installer, and platform-adapter updates as regression-sensitive changes.
- `REQ-PLAT-010`: Keep public job-index data architecturally separate from private user data.
- `REQ-PLAT-011`: Define and publish the certified first-release platform matrix: macOS 14+ arm64, Windows 11 x64, Ubuntu 24.04 LTS x64, and Chrome stable.
- `REQ-PLAT-012`: Isolate operating-system behavior behind typed platform interfaces; shared business logic must not depend on scattered OS-condition branches.
- `REQ-PLAT-013`: Run mandatory CI and repository verification on pinned macOS, Windows, and Ubuntu runner images.
- `REQ-PLAT-014`: Use macOS Keychain, Windows Credential Manager/DPAPI, and Linux Secret Service for secrets and encryption keys with no plaintext production fallback.
- `REQ-PLAT-015`: Implement and test equivalent process supervision, loopback lifecycle, crash recovery, cancellation, and orphan-process cleanup on all certified platforms.
- `REQ-PLAT-016`: Normalize and test path separators, Unicode/spaces, case sensitivity, line endings, executable suffixes/permissions, file locks, atomic replacement, temporary directories, and reserved-name behavior.
- `REQ-PLAT-017`: Install, validate, repair, and remove Chrome native-messaging registration using platform-correct manifest paths or Windows registry keys and protocol behavior.
- `REQ-PLAT-018`: Maintain versioned platform-specific local-model runtime profiles with exact artifact, accelerator, context, memory, license, and benchmark metadata; validate capability and safe fallback early, and complete full-AI certification for every certified OS before the Cross-Platform Core Gate.
- `REQ-PLAT-019`: Keep deterministic core workflows usable when the local model is unavailable or the machine lacks a full-AI hardware profile; show explicit capability state and remediation.
- `REQ-PLAT-020`: Use controlled fonts, Chromium, layout tokens, and extraction/visual checks to produce equivalent ATS-safe PDF/DOCX behavior across certified platforms.
- `REQ-PLAT-021`: Produce appropriately signed or verified installers for macOS, Windows, and Ubuntu, including native-host registration and clean uninstall behavior.
- `REQ-PLAT-022`: Implement signed platform-aware updates, repair, rollback, and failed-update recovery without private-data loss.
- `REQ-PLAT-023`: Use an OS-neutral encrypted backup format and prove restore across the certified source/target platform matrix.
- `REQ-PLAT-024`: Run the built Chrome extension, service worker, frame agents, and real native host through platform-native E2E on all certified platforms.
- `REQ-PLAT-025`: Ensure canonical commands and packaged runtime discovery do not depend on interactive shell profiles or Bash/POSIX-only behavior.
- `REQ-PLAT-026`: Publish exact operating-system, architecture, browser, model-profile, installer, and last-tested compatibility with known limitations.

### 4.10 Critical-gate, benchmark, and clean-room requirements

- `REQ-GATE-001`: Maintain `docs/CRITICAL_GATES.md` with gate state, revision, corpus hash, benchmark artifact, independent reviewer, owner decision, and downstream readiness effect.
- `REQ-GATE-002`: Partition evaluation data into development, public/manual validation, and owner-controlled holdout sets; holdout expected outputs must remain unavailable to the implementation agent before execution.
- `REQ-GATE-003`: Require an independent model/session to reproduce critical positive and negative paths before a gate can pass.
- `REQ-GATE-004`: Compare competing products and baselines on the same profile, page/content example, expected values, and scoring rubric.
- `REQ-GATE-005`: Block unrelated downstream work when a critical gate is `REDESIGN_REQUIRED`, `BLOCKED`, or not yet evaluated at its required point.
- `REQ-GATE-006`: Record code revision, browser/runtime versions, fixture and corpus hashes, model digest, prompt version, timing, memory, artifacts, and manual scorer identity for every gate run.
- `REQ-GATE-007`: Treat CareerPulse and legacy JobApply as isolated behavioral baselines; copying code requires license/provenance review and an approved ADR.
- `REQ-GATE-008`: Convert every observed unsafe legacy behavior into a reproducible regression case where legally and technically possible.
- `REQ-GATE-009`: Require a redesign ADR when a failure reveals an architectural flaw rather than a local defect.
- `REQ-GATE-010`: Never modify frozen expected results merely to match current implementation; corrections require review, rationale, versioning, and preservation of prior results.
- `REQ-GATE-011`: Prevent the same agent from being the sole creator of the implementation, holdout labels, and acceptance decision.
- `REQ-GATE-012`: Restrict claims of superiority or compatibility to the measured scope and confidence supported by the benchmark.
- `REQ-GATE-013`: Maintain a third `WORKDAY_GUIDED_PRE_SUBMIT` gate with raw field, repeater, upload, validation, navigation, recovery, performance, and final-review results.
- `REQ-GATE-014`: Prevent `M21` and later production ATS adapters from becoming ready unless `M20` is accepted and `WORKDAY_GUIDED_PRE_SUBMIT = PASS`.
- `REQ-GATE-015`: Require an owner-controlled Workday holdout containing unseen tenant/control/page-sequence variants and at least one navigation/recovery fault path.
- `REQ-GATE-016`: Require a same-input Workday comparison with Simplify and an independent clean-session audit before the Workday gate can pass.
- `REQ-GATE-017`: Maintain `CROSS_PLATFORM_CORE` in the critical-gate ledger with per-platform package, browser, runtime, installer, backup, and update evidence.
- `REQ-GATE-018`: Prevent `M28` and later closed-alpha work from becoming ready until `CROSS_PLATFORM_CORE = PASS`.
- `REQ-GATE-019`: Require actual packaged execution on every certified platform; compilation, cross-compilation, containers, or one operating system cannot substitute for native evidence.
- `REQ-GATE-020`: Require a separate independent audit and owner decision for the Cross-Platform Core Gate.
- `REQ-GATE-021`: Require complete cross-platform gate regression after changes to platform abstractions, secure storage, native messaging, model runtime, renderer/fonts, installers, updater, Chrome, or certified OS versions.
- `REQ-GATE-022`: Restrict platform support claims to the exact certified matrix and evidence bundle; experimental targets must be labeled explicitly.

---

## 5. System architecture

### 5.1 Repository structure

The target monorepo is:

```text
/
├── CLAUDE.md
├── docs/
│   ├── MASTER_IMPLEMENTATION_SPEC.md
│   ├── PROJECT_STATUS.md
│   ├── DECISIONS.md
│   ├── TEST_EVIDENCE.md
│   ├── KNOWN_ISSUES.md
│   ├── COMPATIBILITY_MATRIX.md
│   ├── PLATFORM_SUPPORT.md
│   ├── REQUIREMENTS_TRACEABILITY.md
│   ├── traceability.json
│   ├── CRITICAL_GATES.md
│   ├── gates/
│       ├── AUTOFILL_FEASIBILITY_GATE.md
│       ├── RESUME_PAGEFIT_FEASIBILITY_GATE.md
│       ├── WORKDAY_GUIDED_PRE_SUBMIT_GATE.md
│       ├── CROSS_PLATFORM_CORE_GATE.md
│       └── HOLDOUT_EXECUTION_LOG.md
│   └── platform/
│       ├── CERTIFIED_MATRIX.md
│       ├── MODEL_RUNTIME_PROFILES.md
│       ├── NATIVE_MESSAGING_MATRIX.md
│       └── PACKAGING_UPDATE_MATRIX.md
├── apps/
│   ├── desktop/                 # Tauri 2 + React + TypeScript
│   ├── extension/               # WXT + React + TypeScript, real MV3 feasibility in M02; productionized in M17
│   └── mock-ats-lab/            # deterministic local ATS fixture web app
├── services/
│   ├── orchestrator/            # Python 3.12 + FastAPI + Pydantic v2
│   ├── native-host/             # Rust native-messaging bridge/sidecar
│   ├── job-index-api/           # late-stage public-job service
│   └── job-ingestion-worker/    # late-stage permitted-source collectors
├── packages/
│   ├── contracts/               # JSON Schema, generated TS and Python models
│   ├── domain/                  # shared pure domain logic
│   ├── ui/                      # shared UI components and accessibility helpers
│   ├── platform/                # typed OS capabilities, paths, process, key store, installer interfaces
│   ├── resume-schema/           # feasibility subset in M05; complete semantic document model later
│   ├── form-engine/             # early M02 field identity/scanner/resolver/drivers; productionized later
│   ├── ats-adapters/            # M02 research adapters; Workday-first production in M19-M20; others later
│   ├── security/                # redaction, validation, capability checks
│   └── test-fixtures/           # synthetic documents, jobs, forms, expected results
├── benchmarks/
│   ├── autofill/
│   │   ├── development/
│   │   ├── public-dry-run/
│   │   ├── result-schema/
│   │   └── reports/
│   ├── resume-pagefit/
│   │   ├── development/
│   │   ├── result-schema/
│   │   └── reports/
│   └── holdout-manifests/       # hashes/metadata only; owner-controlled cases remain outside agent workspace
├── prompts/
│   ├── registry.yaml
│   ├── resume/
│   ├── answers/
│   ├── cover_letters/
│   └── verification/
├── model/
│   ├── model-lock.json
│   ├── platform-profiles/
│   ├── eval-cases/
│   └── eval-results/
├── scripts/
│   ├── verify-work-package.*
│   ├── verify-milestone.*
│   ├── generate-contracts.*
│   ├── redact-fixture.*
│   ├── benchmark-model.*
│   ├── traceability.py
│   ├── benchmark-autofill.*
│   └── benchmark-resume-pagefit.*
├── pnpm-workspace.yaml
├── turbo.json
├── pyproject.toml
└── package.json
```

The owner-controlled hidden holdout cases must not be committed to the implementation branch or attached to the implementation-agent conversation. Commit only a manifest containing case IDs, schema versions, counts, and cryptographic hashes. The actual synthetic holdout bundle may live in an owner-controlled local directory such as `~/.jobapplyv2-eval/holdout-v1/` and must contain no real third-party PII.

### 5.2 Selected stack

| Layer | Required choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Desktop | Tauri 2, React, TypeScript, Vite |
| Browser extension | WXT, React, TypeScript, Manifest V3 |
| Local API/orchestration | Python 3.12, FastAPI, Pydantic v2 |
| Native bridge | Rust binary registered as a Chrome native-messaging host |
| Database | SQLite with SQLCipher or an approved equivalent full-database encryption design |
| Secret storage | macOS Keychain; Windows Credential Manager/DPAPI; Linux Secret Service/libsecret-compatible provider behind one interface |
| Local files | Encrypted application-data directory with content-addressed artifacts |
| Contracts | JSON Schema as source of truth; generated TypeScript and Pydantic models |
| TypeScript tests | Vitest |
| Python tests | Pytest + Hypothesis where useful |
| Browser/E2E tests | Playwright with real extension loading |
| Rust tests | Cargo test, Clippy, rustfmt |
| PDF import | PyMuPDF first, pdfplumber fallback; no OCR unless explicitly required |
| DOCX import/export | python-docx or an approved deterministic DOCX library |
| PDF rendering | Pinned Playwright Chromium using semantic HTML/CSS |
| Local model runtime | Versioned provider profiles: Ollama MLX on Apple Silicon and benchmarked Ollama GGUF accelerator/CPU profiles on Windows/Linux |
| Search | SQLite FTS5 + local embeddings initially; PostgreSQL FTS/pgvector for public job index |
| Cloud job index | Containerized ingestion workers + PostgreSQL; no private user profile data stored there |
| Certified desktop platforms | macOS 14+ arm64; Windows 11 x64; Ubuntu 24.04 LTS x64 |
| Certified browser | Current Google Chrome stable on each certified platform |
| Packaging | macOS app/DMG; Windows signed NSIS or MSI decision; Ubuntu `.deb` plus AppImage convenience artifact |
| Updates | Signed Tauri updater artifacts with platform/architecture targets and rollback policy |

### 5.3 Component responsibilities

#### Desktop app

- Owns user-visible profile, resume, job, tracker, settings, queue, model, and diagnostics UI.
- Starts, monitors, and stops the local orchestrator and native host.
- Manages model download/status through the runtime adapter.
- Never reads raw database files directly; it uses typed local APIs.

#### Local orchestrator

- Owns canonical data, migrations, encryption, document processing, matching, AI pipelines, validation, tracker events, and application plans.
- Exposes versioned loopback APIs.
- Contains no browser DOM logic.
- Never performs a submission itself; it issues typed execution plans to the extension/native host.

#### Browser extension

- Detects supported ATS/page type.
- Scans and normalizes visible form controls.
- Executes typed fill operations.
- Displays field status, provenance, and review state.
- Reports page transitions, validation messages, and submission evidence.
- Cannot directly access the database or model runtime.

#### Native-messaging host

- Authenticates the extension installation and proxies bounded, typed messages to the local service.
- Enforces capability allowlists and maximum message sizes.
- Rejects malformed, unauthenticated, or privileged requests from content scripts.

#### Public job index, later

- Collects public job metadata from permitted or licensed sources.
- Stores no private profile, resume, answers, or application data.
- Provides normalized search and incremental sync to the local app.

#### Platform service and adapters

- Exposes typed `PlatformCapabilities`, `PlatformPaths`, `SecretStore`, `ProcessSupervisor`, `NativeMessagingRegistrar`, `BrowserLocator`, `ModelRuntimeProvider`, `InstallerState`, `UpdaterProvider`, and `PlatformDiagnostics` interfaces.
- Owns operating-system-specific implementations; shared domain code cannot call platform APIs directly.
- Detects certified, experimental, and unsupported targets and reports capability without claiming support.
- Ensures GUI-launched processes find bundled/configured runtimes without relying on interactive-shell `PATH`.
- Provides test seams so platform negative cases do not require corrupting the real machine.

### 5.4 Trust boundaries

1. **Untrusted web boundary:** all page DOM, scripts, text, options, and navigation state.
2. **Extension content-script boundary:** capable of reading/writing page controls but not privileged native operations.
3. **Extension service-worker boundary:** validates content-script messages and controls native messaging.
4. **Native-host boundary:** validates extension identity, message schema, capability, and session token.
5. **Local-service boundary:** owns private data and AI orchestration.
6. **Model boundary:** model output is untrusted data, never executable authority.
7. **Platform-adapter boundary:** operating-system services, registries, credential stores, process APIs, installers, and updaters expose bounded typed capabilities.
8. **Public job-index boundary:** public metadata only; results require validation and provenance.

Chrome’s extension security guidance explicitly treats content scripts as less trustworthy than the service worker. The implementation must reflect that boundary rather than treating extension messages as inherently safe.

### 5.5 Communication model

Production extension communication:

```text
content script
  -> validated extension message
service worker
  -> Chrome native messaging
native host
  -> authenticated loopback request
local orchestrator
```

Development may support an explicitly flagged loopback WebSocket/HTTP transport, but production must use native messaging unless an approved ADR demonstrates a safer or equally safe alternative.

### 5.6 Domain-event model

State transitions must produce append-only events such as:

```text
ProfileFactImported
ProfileFactApproved
ProfileFactSuperseded
JobCaptured
JobVersionCreated
RequirementsParsed
ResumeVariantCreated
TailoringPlanCreated
GeneratedClaimRejected
ResumeRendered
QuestionDetected
AnswerGenerated
AnswerAccepted
FormScanned
FieldDecisionCreated
FieldFilled
FieldSkipped
ApplicationApproved
ApplicationQueued
ApplicationStarted
ApplicationPaused
ApplicationSubmitted
SubmissionReceiptCaptured
ApplicationFailed
```

Events contain stable IDs, schema version, timestamp, actor, source, correlation ID, and redacted metadata. They must not contain unrestricted page HTML or secret values.

### 5.7 Core data model

The minimum entities are:

```text
Profile
CareerFact
EvidenceArtifact
EvidenceSpan
Skill
SkillEvidence
EligibilityRecord
Preference
VoiceSample
VoiceProfile

JobPosting
JobVersion
JobSource
JobRequirement
RequirementEvidenceMatch
MatchEvaluation

ResumeDocument
ResumeVariant
ResumeSection
ResumeBlock
TailoringPlan
TailoringDecision
GeneratedClaim
RenderArtifact

QuestionIntent
DetectedQuestion
AnswerMemory
AnswerDraft
AnswerValidation
CoverLetter

Application
ApplicationPlan
ApplicationEvent
FieldDecision
DocumentSnapshot
AnswerSnapshot
SubmissionReceipt

QueueItem
ExecutionRun
ExecutionStep
ExecutionIntervention

JobSourceCursor
JobIngestionRun
JobSourceHealth
```

### 5.8 Canonical fact and generated claim separation

A generated claim must have a shape equivalent to:

```json
{
  "claim_id": "clm_...",
  "text": "Reduced manual reporting time by 30% through an automated Python pipeline.",
  "atomic_claims": [
    {"type": "action", "value": "automated reporting with Python"},
    {"type": "metric", "value": "30%"}
  ],
  "evidence_ids": ["ev_...", "ev_..."],
  "verification_status": "SUPPORTED",
  "prompt_version": "resume-writer-1.2.0",
  "model_digest": "..."
}
```

Allowed verification states:

```text
SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | CONTRADICTED | NEEDS_USER_INPUT
```

Only `SUPPORTED` claims can enter an auto-generated final document or an auto-submitted answer. `PARTIALLY_SUPPORTED` requires user editing and approval. All other states are blocked.

### 5.9 Field-decision contract

Every fill decision must include:

```json
{
  "field_id": "fld_...",
  "field_concept": "work_authorization.us",
  "classification_confidence": 0.998,
  "value_source_type": "eligibility_record",
  "value_source_id": "elig_...",
  "value_confidence": 1.0,
  "sensitivity": "CONSEQUENTIAL",
  "policy": "REQUIRE_APPLICATION_SCOPE_CONFIRMATION",
  "decision": "PAUSE_FOR_CONFIRMATION",
  "reason_codes": ["SENSITIVE_FIELD", "CONFIRMATION_EXPIRED"]
}
```

Allowed decisions:

```text
FILL | PROPOSE | PAUSE_FOR_CONFIRMATION | SKIP_OPTIONAL | BLOCK_UNSUPPORTED
```

### 5.10 Application-plan contract

Before automatic execution, the system must freeze a plan containing:

- Job and job-version IDs.
- User approval timestamp and approval UI version.
- Selected resume and cover-letter artifacts with hashes.
- Expected question intents and answer sources.
- Sensitive-answer policy snapshot.
- Salary, location, relocation, travel, schedule, and authorization constraints.
- Allowed submission mode: `DRY_RUN`, `PRE_SUBMIT`, or `AUTO_SUBMIT`.
- Adapter version and compatibility result.
- Expiration time after which the plan must be revalidated.
- Idempotency key and duplicate-check result.


### 5.11 Autofill feasibility and production architecture

The feasibility implementation in `M02` and the production implementation in `M17`–`M24` must share the same core contracts and code. The feasibility gate is not a disposable demo.

#### 5.11.1 Field address and descriptor

A field's durable identity is semantic and structural. A selector is only one short-lived hint.

```ts
interface FieldAddress {
  addressVersion: string;
  sessionId: string;
  frameId: number;
  documentId: string;
  atsFamily: string;
  tenantPattern: string | null;
  routeSignature: string;
  applicationRootFingerprint: string;
  sectionPath: string[];
  repeaterPath: Array<{ concept: string; stableItemKey: string }>;
  accessibleNameFingerprint: string;
  attributeFingerprint: string;
  optionFingerprint: string | null;
  resolutionHints: Array<{
    kind: "id" | "name" | "role" | "label" | "relative" | "selector";
    value: string;
    stability: "HIGH" | "MEDIUM" | "LOW";
  }>;
  observedDomGeneration: number;
}

interface FieldDescriptor {
  fieldId: string;
  address: FieldAddress;
  controlKind: string;
  visible: boolean;
  enabled: boolean;
  required: boolean;
  sensitiveCandidate: boolean;
  labelText: string;
  descriptionText: string | null;
  sectionContext: string[];
  optionSemantics: Array<{ value: string; label: string; disabled: boolean }>;
  currentValue: unknown;
  validationState: unknown;
}
```

Immediately before any action, the engine re-resolves the current control. If the address resolves to zero or multiple plausible controls, the action becomes `NEEDS_REVIEW` or `BLOCK_UNSUPPORTED`; it does not guess.

#### 5.11.2 Per-frame agents

Each permitted frame runs its own content-script agent and scans only its own DOM. It reports typed, bounded descriptors to the service-worker coordinator with `frameId`, `documentId`, route, and generation. The parent frame must not depend on traversing a cross-origin child document.

```text
top-frame content agent ──────┐
child-frame content agent ────┼── validated service-worker coordinator
child-frame content agent ────┘
```

#### 5.11.3 Scanner and mutation policy

- Detect the application root and scan that root first.
- Build an index from labels, ARIA relationships, names, IDs, autocomplete, headings, option sets, and nearby text.
- Batch mutations and process only affected subtrees.
- Track route/page state explicitly.
- Debounce and cap reconciliation passes.
- Stop or reduce observation when the page is idle.
- Instrument scan duration, nodes visited, mutation callbacks, driver attempts, CPU, and memory.
- A long Workday research session must not trigger unbounded full-document rescans.

#### 5.11.4 Deterministic resolution and monotonic AI fallback

The resolver performs deterministic classification first. Optional local-model assistance may propose an intent only for unresolved fields and may never directly choose a DOM target or execute a fill.

```text
deterministic accepted mappings
+ reviewed/proven AI proposals for unresolved fields
= final proposal set
```

An AI timeout, malformed response, or unavailable runtime must leave deterministic results intact.

#### 5.11.5 Control-specific transactions

Do not implement one monolithic `fillField()` function. Use drivers with explicit contracts:

```ts
interface ControlDriver {
  readonly driverId: string;
  detect(field: FieldDescriptor): DriverMatch;
  checkPreconditions(context: FillContext): PreconditionResult;
  execute(context: FillContext): Promise<ActionResult>;
  verify(context: FillContext): Promise<PostconditionResult>;
  undo(context: FillContext): Promise<UndoResult>;
  diagnostics(context: FillContext): DiagnosticRecord;
}
```

Minimum drivers:

```text
NativeTextDriver
FrameworkControlledTextDriver
NativeSelectDriver
RadioGroupDriver
CheckboxDriver
AriaComboboxDriver
VirtualizedListboxDriver
DateControlDriver
RepeaterDriver
FileUploadDriver
RichTextDriver
WorkdayPromptDriver (research in M02; production certification later)
```

No fallback may select a value that fails semantic matching merely because it is convenient or uniquely visible.

#### 5.11.6 Verified fill result

```ts
interface VerifiedFillResult {
  fieldId: string;
  addressVersion: string;
  driverId: string;
  elementResolvedUniquely: boolean;
  intendedValue: unknown;
  observedValueImmediately: unknown;
  observedValueAfterRerender: unknown;
  siteAcceptedValue: boolean;
  validationMessages: string[];
  conditionalFieldsDiscovered: string[];
  actionCount: number;
  durationMs: number;
  outcome:
    | "VERIFIED"
    | "NEEDS_REVIEW"
    | "BLOCKED_SENSITIVE"
    | "UNSUPPORTED"
    | "FAILED";
  reasonCodes: string[];
}
```

A `VERIFIED` outcome requires unique resolution, semantic value agreement, persistence after the defined settle/rerender window, and no site validation rejection.

#### 5.11.7 Real extension acceptance environment

Critical extension tests must build and load the actual extension into bundled Playwright Chromium using a persistent context. Tests must observe the actual Manifest V3 service worker, content scripts, frame agents, extension messaging, and browser event behavior. jsdom/unit tests remain useful for pure helpers but cannot satisfy browser acceptance.

#### 5.11.8 Reconciliation

Every page-level pass ends with a complete reconciliation inventory:

```text
VERIFIED_FILLED
NEEDS_REVIEW
BLOCKED_SENSITIVE
UNSUPPORTED_OR_SKIPPED
REQUIRED_UNRESOLVED
PAGE_CHANGED_VALUE
```

“Ready” is blocked while any enabled visible required field is unresolved, any intended value has changed, any required document is stale, or any consequential decision lacks its policy confirmation.

### 5.11.9 Workday production and guided pre-submit architecture

Workday is not implemented as a collection of global selectors. It is implemented as a measured family of tenant patterns on top of the accepted generic form engine. The Workday layer owns application-step semantics, Workday-specific controls, repeaters, upload/parser behavior, navigation safety, recovery, and compatibility certification.

#### 5.11.9.1 Workday tenant and session fingerprint

Every Workday run begins with a bounded fingerprint:

```ts
interface WorkdayTenantFingerprint {
  fingerprintVersion: string;
  hostFamily: string;
  tenantKeyHash: string;
  locale: string;
  countryContext: string | null;
  candidateSessionMode:
    | "GUEST"
    | "AUTHENTICATED"
    | "RETURNING_CANDIDATE"
    | "UNKNOWN";
  routeFamily: string;
  shellFingerprint: string;
  controlFamilyFingerprint: string;
  observedStepSequence: string[];
  adapterVersion: string;
  browserVersion: string;
  lastCertifiedMatrixId: string | null;
}
```

The fingerprint must not contain credentials, unrestricted page HTML, real applicant values, or employer-private data. It must distinguish measured patterns without pretending that one employer or hostname represents all Workday tenants.

#### 5.11.9.2 Workday boundary and step taxonomy

The state machine must represent at least:

```text
JOB_DETAIL
START_APPLICATION
SIGN_IN
CREATE_ACCOUNT
EMAIL_VERIFICATION
MFA
PRIVACY_OR_TERMS
MY_INFORMATION
MY_EXPERIENCE
EDUCATION
WORK_EXPERIENCE
SKILLS_OR_LANGUAGES
APPLICATION_QUESTIONS
VOLUNTARY_DISCLOSURES
SELF_IDENTIFICATION
DOCUMENTS
REVIEW
SUBMIT_BOUNDARY
CONFIRMATION
SESSION_EXPIRED
DUPLICATE_APPLICATION
CAPTCHA_OR_BOT_CHALLENGE
UNKNOWN_STEP
```

Tenant-specific pages may combine, omit, repeat, or reorder these states. Step classification must use multiple independent signals such as route/document identity, application progress indicator, accessible headings, stable semantic markers, visible control concepts, navigation controls, and prior transition history. A single selector, URL substring, heading, or `data-automation-id` value is evidence but not sufficient identity.

```ts
interface WorkdayStepClassification {
  classificationVersion: string;
  step: string;
  confidence: number;
  supportingSignals: Array<{
    type: string;
    normalizedValue: string;
    stability: "HIGH" | "MEDIUM" | "LOW";
  }>;
  contradictorySignals: string[];
  documentId: string;
  pageGeneration: number;
  safeToOperate: boolean;
}
```

Low-confidence or contradictory classification pauses the workflow.

#### 5.11.9.3 Candidate-session boundaries

The product may operate only after the page is in a permitted application session. It may detect and explain login, account creation, email verification, MFA, CAPTCHA, privacy/terms, session expiration, and duplicate-application boundaries, but it must not bypass or automate them.

Allowed behavior:

- Preserve the Workday run and application context.
- Highlight the boundary.
- Explain the exact user action required.
- Let the browser or password manager handle credentials outside the product.
- Resume only after a new document/page generation is classified and the user explicitly permits continuation when required.
- Invalidate stale decisions when the session, job version, tenant fingerprint, or application identity changes.

Prohibited behavior:

- Reading or storing passwords.
- Creating accounts automatically.
- Reading one-time codes from email or messages.
- Automating MFA.
- Solving CAPTCHAs.
- Clicking unexpected consent or legal acceptance.
- Replaying authenticated requests or using private Workday APIs.

#### 5.11.9.4 Workday application-session state

```ts
interface WorkdayApplicationSession {
  sessionId: string;
  jobId: string;
  jobVersionId: string;
  tenantFingerprint: WorkdayTenantFingerprint;
  mode: "MANUAL_ASSIST" | "GUIDED_PRE_SUBMIT";
  lifecycle:
    | "DETECTED"
    | "READY"
    | "FILLING"
    | "VERIFYING"
    | "NAVIGATING"
    | "PAUSED"
    | "AT_FINAL_REVIEW"
    | "USER_SUBMITTED"
    | "CONFIRMED"
    | "FAILED"
    | "CANCELLED";
  currentDocumentId: string;
  currentPageGeneration: number;
  currentStep: string;
  stepHistory: WorkdayStepRecord[];
  appliedDecisionIds: string[];
  unresolvedDecisionIds: string[];
  attachmentHashes: string[];
  navigationLedger: WorkdayNavigationRecord[];
  lastCheckpointHash: string;
}
```

The desktop/local service owns durable run state. Content scripts own only bounded page observations and typed actions for their frame/document generation.

#### 5.11.9.5 Resume upload and Workday parser reconciliation

Workday may alter or prepopulate application data after a resume upload. The product must choose and record one strategy for the certified tenant pattern:

```text
PROFILE_FIRST
UPLOAD_FIRST_AND_RECONCILE
UPLOAD_WITHOUT_PARSER_DEPENDENCE
USER_SELECTED_STRATEGY
```

The transaction is:

1. Select one exact versioned artifact by hash.
2. Resolve the current file control uniquely.
3. Attach the artifact.
4. Verify displayed filename and browser/file-control state.
5. Wait for upload completion and any documented parsing-settle condition.
6. Rescan every affected section.
7. Compare parser-created values/repeaters against approved profile facts.
8. Merge only exact or reviewed matches.
9. Prevent duplicate employment, education, skill, language, or link entries.
10. Surface conflicting or unsupported parsed values.
11. Record the final attachment and reconciliation result.
12. Block navigation while upload or reconciliation remains ambiguous.

A successful file attachment is not proof that Workday parsed the document correctly.

#### 5.11.9.6 Stable repeater controller

Workday repeaters require an explicit controller rather than generic button clicking.

```ts
interface WorkdayRepeaterItem {
  repeaterConcept: string;
  stableItemKey: string;
  sourceFactIds: string[];
  observedSectionFingerprint: string;
  currentValuesHash: string;
  desiredValuesHash: string;
  operation: "NO_CHANGE" | "ADD" | "EDIT" | "REMOVE" | "NEEDS_REVIEW";
}

interface WorkdayRepeaterPlan {
  repeaterId: string;
  pageGeneration: number;
  existingItems: WorkdayRepeaterItem[];
  plannedItems: WorkdayRepeaterItem[];
  duplicateCandidates: Array<{ leftKey: string; rightKey: string; reason: string }>;
  destructiveOperationsRequireReview: boolean;
}
```

The controller must:

- Reconcile existing page items before adding anything.
- Use semantic keys based on approved evidence, not DOM order.
- Fill one item transactionally and verify it before creating another.
- Detect Workday rerender/reordering after add or edit.
- Never create a second item because the first temporarily disappeared.
- Avoid deleting an existing user-entered item automatically unless the exact run policy and evidence permit it.
- Preserve partial user edits.
- Reconcile again after back navigation, reload, parser activity, or retry.

#### 5.11.9.7 Workday-specific control drivers

The production adapter must measure and implement distinct drivers where generic drivers are insufficient:

```text
WorkdayTextDriver
WorkdayPromptDriver
WorkdayListboxDriver
WorkdayMultiSelectDriver
WorkdayDateDriver
WorkdayPhoneDriver
WorkdayAddressDriver
WorkdayCountryRegionDriver
WorkdayQuestionnaireDriver
WorkdayConsentDriver
WorkdayDisclosureDriver
WorkdayRepeaterDriver
WorkdayFileUploadDriver
WorkdayValidationReader
WorkdayProgressIndicatorReader
WorkdayNavigationDriver
WorkdayFinalReviewReader
```

`data-automation-id` and similar attributes may be used as versioned hints, never as the sole semantic identity or sole compatibility claim. Every driver must implement preconditions, execution, post-rerender verification, site-validation reading, diagnostics, and supported undo behavior.

#### 5.11.9.8 Page-readiness proof

Automatic navigation is allowed only after producing a machine-readable proof:

```ts
interface WorkdayPageReadinessProof {
  proofVersion: string;
  sessionId: string;
  documentId: string;
  pageGeneration: number;
  step: string;
  tenantFingerprintHash: string;
  visibleRequiredFieldCount: number;
  verifiedRequiredFieldCount: number;
  unresolvedRequiredFieldIds: string[];
  pageChangedValueIds: string[];
  validationErrors: string[];
  pendingConditionalScan: boolean;
  pendingUploadOrParse: boolean;
  pendingSensitiveConfirmations: string[];
  duplicateRepeaterCandidates: string[];
  navigationControlId: string | null;
  navigationControlUnique: boolean;
  navigationControlEnabled: boolean;
  safeToNavigate: boolean;
  reasons: string[];
  proofHash: string;
}
```

`safeToNavigate` is true only when:

- The current document and page generation still match.
- Step classification is sufficiently confident.
- Every enabled visible required field is verified or deliberately blocked with user resolution completed.
- No intended value changed after the settle window.
- No site validation error remains.
- Conditional-field discovery is settled.
- Upload/parser reconciliation is complete.
- Sensitive policies are satisfied.
- No duplicate or conflicting repeater remains.
- The `Next` control is uniquely resolved, enabled, and belongs to the expected step.
- The proof has not expired.

#### 5.11.9.9 Idempotent navigation transaction

```ts
interface WorkdayNavigationRecord {
  navigationId: string;
  sessionId: string;
  fromDocumentId: string;
  fromPageGeneration: number;
  fromStep: string;
  readinessProofHash: string;
  controlAddressHash: string;
  action: "NEXT" | "BACK";
  clickAttemptCount: number;
  startedAt: string;
  outcome:
    | "TRANSITION_CONFIRMED"
    | "VALIDATION_REJECTED"
    | "NO_TRANSITION"
    | "AMBIGUOUS"
    | "SESSION_BOUNDARY"
    | "FAILED";
  toDocumentId: string | null;
  toPageGeneration: number | null;
  toStep: string | null;
  reasonCodes: string[];
}
```

Rules:

1. One navigation action maximum per page generation and readiness-proof hash.
2. Re-resolve the control immediately before action.
3. Verify it is not the final submit control.
4. Click once.
5. Enter `NAVIGATING`; no field actions may run concurrently.
6. Wait for document, route, progress, heading/control-set, or page-generation transition evidence.
7. Confirm the new step before further action.
8. If validation rejects navigation, return to the current step and reconcile.
9. If the outcome is ambiguous or times out, pause. Do not click again merely because no response arrived.
10. A retry requires a new page observation, a new readiness proof, and evidence that no transition occurred.

#### 5.11.9.10 `GUIDED_PRE_SUBMIT` user flow

The certified target experience is:

```text
user opens Workday application
    -> user signs in or resolves account boundary when required
    -> extension detects certified tenant pattern
    -> user selects the intended job/profile/documents and starts GUIDED_PRE_SUBMIT
    -> scan current page
    -> resolve and fill safe fields
    -> verify values, validation, uploads, repeaters, and sensitive policy
    -> produce page-readiness proof
    -> click Next once
    -> confirm next Workday step
    -> repeat
    -> detect certified final review page
    -> produce complete cross-page review inventory
    -> stop automation
    -> user reviews
    -> user clicks Submit
    -> product observes receipt/failure without claiming success from the click alone
```

On a certified flow with a ready session and complete approved information, the flow requires no manual data entry between start and final review. Any unsupported, ambiguous, consequential, or changed condition pauses with an exact intervention. The user can pause, cancel, disable auto-next, or switch to manual assist at any time.

#### 5.11.9.11 Final-review boundary

Final review must be detected independently from the submit button. The final-review reader must compare:

- Step/progress semantics.
- Presence and structure of a review summary.
- Absence of ordinary editable page sections or explicit review mode.
- Navigation controls.
- Submit-control semantics.
- Expected prior step sequence.
- Tenant-pattern certification.

The guided mode must:

- Never focus, press, or click the submit control automatically.
- Create a cross-page summary of facts, answers, documents, sensitive decisions, unresolved warnings, and navigation history.
- Reconcile the visible review values against the frozen application plan.
- Warn when Workday’s review view omits a value that cannot be independently verified.
- Require the user to click submit.
- Observe confirmation or failure afterward only when the user has submitted.

#### 5.11.9.12 Recovery and checkpointing

Create a checkpoint after every verified page and confirmed transition. Recovery must handle:

```text
content-script reinjection
service-worker suspension
local-service restart
tab reload
back navigation
browser restart where supported
Workday session timeout
unexpected route transition
job/application identity change
tenant fingerprint drift
```

A checkpoint is resumable only when the job, application identity, tenant fingerprint, current document/step, profile facts, selected artifacts, answers, and policy versions remain compatible. Otherwise the run pauses and requires revalidation.

#### 5.11.9.13 Workday compatibility certification

A certification record is scoped to a tenant/layout/locale/session pattern, not the Workday brand:

```ts
interface WorkdayCertificationRecord {
  certificationId: string;
  tenantPatternId: string;
  localeSet: string[];
  sessionModes: string[];
  stepSequences: string[][];
  controlDriverVersions: Record<string, string>;
  browserVersion: string;
  adapterVersion: string;
  fixtureMatrixHash: string;
  holdoutHash: string;
  publicDryRunEvidenceIds: string[];
  controlledEndToReviewEvidenceIds: string[];
  precision: number;
  recall: number;
  manualCorrectionCount: number;
  navigationFailureCount: number;
  finalReviewReachRate: number;
  knownLimitations: string[];
  lastTestedAt: string;
  state: "CERTIFIED" | "RESTRICTED" | "SUSPENDED";
}
```

A browser, Workday structure, adapter, driver, resolver, or navigation change can suspend certification until the affected regression passes.

#### 5.11.9.14 Workday evidence matrix

Before Gate C can pass, the repository must include at least:

- 40 deterministic synthetic Workday tenant/layout variants.
- 3,000 scored Workday controls across the development matrix.
- Multiple locales and country/address/date/phone formats.
- Guest, authenticated, returning-candidate, login-boundary, expired-session, and duplicate-application cases.
- Resume-parser-created repeaters and profile-first cases.
- Work, education, skills, languages, websites, certifications, and tenant-defined repeater cases.
- Conditional questionnaires, disclosures, voluntary demographic pages, and exact document uploads.
- At least 24 public no-submit structural dry-runs across at least 12 employers and at least four locale/country configurations where available.
- At least 12 owner-controlled end-to-review runs on permitted applications or equivalent controlled environments, without automated submission.
- At least 20% owner-controlled hidden holdout variants.
- Reload, back, service-worker restart, local-service restart, timeout, validation rejection, and changed-page fault injection.
- A 45-minute long-session soak with bounded observer and memory behavior.
- Same-input manual Simplify comparison cases sufficient to support the Gate C non-inferiority claim.

Public availability or account boundaries may make some exact targets temporarily unavailable; that results in `BLOCKED`, not fabricated evidence or a reduced threshold without an approved ADR.

### 5.12 Resume tailoring and PageFit feasibility architecture

The `M05` feasibility implementation must create production-intended core modules that later milestones extend.

#### 5.12.1 Feasibility semantic input

Use a typed subset of the future semantic resume model containing:

- Immutable evidence records and source IDs from synthetic fixtures.
- Resume sections, blocks, ordering, locks, and display metadata.
- Job requirements with importance, source spans, and support states.
- A render intermediate representation with measured block dimensions.

The subset must have versioning and a documented migration path into the full `M09` schema.

#### 5.12.2 Whole-document allocation

For each important requirement:

1. Retrieve and rank supporting evidence.
2. Classify support as `DIRECT`, `STRONG_RELATED`, `PARTIAL`, `USER_ASSERTED`, `UNSUPPORTED`, or `CONTRADICTED`.
3. Assign the requirement to one strongest location unless a second mention has explicit communicative value.
4. Set document, section, bullet, keyword, and repetition budgets.
5. Preserve chronology and locked content.
6. Leave unsupported requirements as visible gaps.

#### 5.12.3 Candidate generation and verification

The model writes only bounded candidates requested by the plan. Each candidate includes evidence IDs. Deterministic and model-assisted verification decomposes names, dates, organizations, tools, actions, metrics, scope, and outcomes into atomic claims. Only fully `SUPPORTED` candidates may enter the accepted output.

#### 5.12.4 PageFit search

The feasibility optimizer must use the final mandated operation order and a measured renderer. It evaluates a candidate state by:

```text
job relevance
+ evidence strength
+ recency
+ quantified impact
+ differentiation
- redundancy
- unsupported-risk penalty
- length/layout cost
```

The exact formula is versioned and benchmarked. Any generated shortening is re-verified at the atomic-claim level. The optimizer must recommend two pages when the one-page readability floors would be violated.

#### 5.12.5 Semantic diff and utility report

Every benchmark case records:

- Requirements emphasized and their evidence.
- Requirements left as gaps.
- Added, removed, shortened, reordered, or clarified blocks.
- Keyword and repetition counts.
- Utility before and after.
- Typography/layout changes.
- Extracted text and page count.
- Every verifier decision.

### 5.13 Critical benchmark, holdout, and clean-room architecture

#### Development set

Committed, visible, versioned fixtures used for implementation and regression.

#### Public no-submit set

Low-volume, terms-compliant checks on public application pages. Use only synthetic or owner-controlled values, never click submit, and store only sanitized structural observations. Public pages can disappear; record URL hash, ATS family, tenant pattern, browser version, timestamp, and sanitized fixture derivation.

#### Owner-controlled holdout

At least 20% of gate variants or cases must remain outside the implementation workspace. The repository stores only hashes and metadata. A separate evaluation session runs the bundle and writes signed/hashed result artifacts without revealing expected answers before execution.

#### Legacy baseline isolation

CareerPulse and legacy JobApply may be run in an isolated checkout or manually observed on the same fixtures to establish a behavioral baseline. They must not be imported as dependencies or copied into the production tree without an approved clean-room/provenance decision.

#### Simplify comparison

Use the publicly available product through normal user interaction only. No reverse engineering of private APIs, no automated scraping of authenticated data, and no code extraction. Record field-level outcomes and manually captured document outputs for identical user-owned examples.

#### Independent acceptance

A critical gate requires:

1. Implementation-agent report.
2. Independent code/specification review by a separate high-capability session.
3. Owner-controlled holdout execution.
4. Manual browser or document inspection.
5. Owner decision recorded in `docs/CRITICAL_GATES.md`.
---

### 5.14 Cross-platform architecture and certification

#### 5.14.1 Certified matrix and support tiers

First-release certification is intentionally narrow:

| Target ID | Operating system | Architecture | Browser | Support tier |
|---|---|---|---|---|
| `macos-arm64` | macOS 14 or later | Apple Silicon arm64 | Chrome stable | `CERTIFIED_FULL` on accepted local-AI profile; `CERTIFIED_CORE` otherwise |
| `windows-x64` | Supported Windows 11 release | x86-64 | Chrome stable | `CERTIFIED_FULL` on accepted local-AI profile; `CERTIFIED_CORE` otherwise |
| `ubuntu-x64` | Ubuntu 24.04 LTS, default supported GNOME desktop session | x86-64 | Chrome stable | `CERTIFIED_FULL` on accepted local-AI profile; `CERTIFIED_CORE` otherwise |

Support states:

```text
CERTIFIED_FULL       # complete core plus accepted local-AI profile and performance evidence
CERTIFIED_CORE       # deterministic/profile/document/extension/tracker workflows; AI unavailable or below performance tier
EXPERIMENTAL         # tested informally but no support promise
UNSUPPORTED          # blocked with explanation
```

Windows 10 is not certified because general support ended in October 2025. Intel macOS, Windows ARM64, other Linux distributions, Firefox, Safari, and ChromeOS require later compatibility packages.

#### 5.14.2 Platform interface contract

Shared code depends on interfaces rather than operating-system APIs:

```ts
interface PlatformCapabilities {
  platformId: "macos-arm64" | "windows-x64" | "ubuntu-x64" | "unsupported";
  supportTier: "CERTIFIED_FULL" | "CERTIFIED_CORE" | "EXPERIMENTAL" | "UNSUPPORTED";
  secureStore: CapabilityState;
  nativeMessaging: CapabilityState;
  localModelProfiles: ModelProfileCapability[];
  packagingChannel: string | null;
  diagnostics: DiagnosticReason[];
}

interface PlatformPaths { appData(): Path; cache(): Path; temp(): Path; artifacts(): Path; }
interface SecretStore { put(key: SecretKey, value: SecretBytes): Result; get(key: SecretKey): Result; delete(key: SecretKey): Result; }
interface ProcessSupervisor { spawn(plan: SpawnPlan): ProcessHandle; terminate(handle: ProcessHandle): Result; inspect(handle: ProcessHandle): ProcessState; }
interface NativeMessagingRegistrar { install(plan: HostRegistration): Result; verify(plan: HostRegistration): Result; remove(plan: HostRegistration): Result; }
interface ModelRuntimeProvider { detect(): RuntimeCapability; ensureProfile(profileId: string): Result; invoke(request: TypedGenerationRequest): Result; }
```

No shared domain package may import Keychain, Windows registry, DPAPI, D-Bus Secret Service, Unix signals, Win32 process APIs, or installer APIs directly.

#### 5.14.3 Secret storage

- macOS: Keychain.
- Windows: Credential Manager and/or DPAPI-protected key material behind one reviewed adapter.
- Ubuntu: Secret Service through a libsecret-compatible provider.
- CI: test-only injected fake store with synthetic keys; never a production fallback.
- If the production secure store is unavailable, private-data initialization pauses with actionable remediation. It does not write a key to a file or environment variable.

#### 5.14.4 Filesystem and process semantics

Tests must cover separators, spaces, Unicode, case sensitivity, CRLF/LF, Windows reserved names, executable suffixes and permissions, long paths, file locking, atomic replace, temporary cleanup, spawn quoting, signal/termination semantics, parent death, and orphan detection. Shared commands use Python/TypeScript/Rust entry points and argument arrays rather than shell interpolation.

Packaged GUI applications must discover bundled or configured runtimes explicitly because macOS and Linux GUI processes do not reliably inherit interactive-shell profiles, and Windows executable discovery differs from POSIX systems.

#### 5.14.5 Native messaging

- macOS and Linux install an absolute-path host manifest in the browser-appropriate user or system location.
- Windows installs the manifest path through the required Chrome native-messaging registry key.
- The Windows native host uses binary stdin/stdout semantics so newline translation cannot corrupt length-prefixed messages.
- Install, verify, repair, update, and uninstall are idempotent and retain user data unless explicit deletion is requested.
- The extension ID allowlist and message-size/capability limits remain mandatory on every platform.

#### 5.14.6 Model runtime profiles

The model family is selected by domain quality; the artifact/runtime is platform-profile data:

```text
macos-arm64-mlx          # Apple Silicon; primary M5/24 GB development profile
windows-x64-nvidia       # GGUF/CUDA profile selected by M05 benchmark
windows-x64-cpu          # functional compatibility fallback; no latency promise until measured
ubuntu-x64-nvidia        # GGUF/CUDA profile selected by M05 benchmark
ubuntu-x64-cpu           # functional compatibility fallback; no latency promise until measured
```

A profile includes exact artifact digest, runtime version, accelerator/driver bounds, context, quantization, RAM/VRAM requirement, license, structured-output score, factuality score, latency, memory, and fallback behavior. The deterministic autofill engine cannot depend on a profile being available.

#### 5.14.7 Documents and fonts

Resume rendering uses controlled, legally distributable font assets or an approved deterministic font policy. The semantic resume and render intermediate representation remain platform-neutral. Every certified platform runs PDF/DOCX text extraction, page count, clipping, Unicode, long-name, and visual-difference checks. Semantic parity is mandatory even when platform PDF bytes differ.

#### 5.14.8 Packaging and updates

- macOS: signed application bundle/DMG and notarization-ready flow.
- Windows: signed NSIS or MSI installer selected through an ADR; per-user install is preferred initially unless native-host/enterprise requirements justify otherwise.
- Ubuntu: `.deb` is the certified package; AppImage is an additional convenience artifact when its runtime assumptions pass.
- Signed update metadata and assets are platform/architecture specific.
- Each platform must pass install, first launch, upgrade, rollback, interrupted update, repair, uninstall, native-host cleanup, and user-data preservation.

#### 5.14.9 Cross-platform evidence bundle

Each platform gate bundle records OS build, architecture, runner or physical-machine identity, package hash/signature, browser/version, webview version, native-host registration evidence, secret-store test, runtime/model profile, document matrix, backup/restore result, update/rollback result, diagnostics, raw logs, screenshots/traces containing synthetic data only, independent reviewer, and owner decision.

## 6. Local AI model family and certified platform runtime profiles

### 6.1 Required initial macOS development candidate

The exact initial candidate for the primary M5/24 GB macOS development profile is:

```text
Ollama model tag: gemma4:12b-mlx
Runtime: Ollama MLX engine on Apple Silicon
Role: resume planning and rewriting, short-answer drafting, cover-letter drafting,
      structured requirement extraction when deterministic parsing is insufficient,
      claim decomposition, contradiction checks, and interview feedback
```

This is the best practical default for the stated machine because:

- Google describes Gemma 4 12B as laptop-ready and small enough for 16 GB of VRAM or unified memory.
- Ollama publishes an MLX build of the 12B model at roughly 7.6 GB, leaving necessary memory for macOS, the browser, Claude, the desktop app, document rendering, embeddings, and KV cache.
- Ollama’s 2026 MLX engine is optimized for Apple Silicon and specifically advertises acceleration on M5-family chips.
- A Qwen3.6 27B Q4 build is about 17 GB and a Qwen3.6 35B default build is about 24 GB. Those may run in isolation, but they leave too little reliable headroom on a 24 GB unified-memory laptop for this product’s normal workload and are therefore not the production default.

The model selection is a **versioned initial candidate, not an article of faith**, and the MLX artifact is not a universal cross-platform artifact. Milestone `M05` must benchmark it on the project’s own resume, answer, extraction, factuality, and PageFit corpus on the actual M5/24 GB machine. The benchmark must also include at least one feasible independent 12B–14B alternative supported by the approved runtime—initially `Qwen/Qwen3-14B` or a newer owner-approved equivalent available at execution time—so the product does not lock itself to a convenient model without comparative evidence. The exact winner becomes the production model lock only after `M05-W06`; any replacement requires an approved ADR and must beat the candidate on overall domain quality while meeting memory, latency, reliability, licensing, and packaging gates.

The model is not the autofill engine. Ordinary field identity, option matching, sensitive policy, fill execution, and DOM reconciliation remain deterministic even when the model is unavailable.

### 6.2 Staged Windows and Linux profile selection

`M05` must define the same versioned model-profile contract for Windows and Ubuntu, prove native runtime/capability detection, validate explicit no-model and insufficient-hardware behavior, and exercise at least one feasible candidate artifact path on each operating system when suitable native hardware is available. Lack of a qualifying Windows or Ubuntu full-AI machine during `M05` does not block the resume/PageFit feasibility architecture or `M06`.

The same semantic tasks, prompt versions, evidence inputs, and verifier thresholds apply whenever a Windows or Ubuntu candidate is benchmarked. Candidate results are recorded without lowering factuality, unsupported-claim, or structured-output standards. Final acceptance of at least one `CERTIFIED_FULL` Windows profile and one `CERTIFIED_FULL` Ubuntu profile is deferred to `M27-W10` and remains mandatory before `CROSS_PLATFORM_CORE` can pass. `CERTIFIED_CORE` and safe no-model behavior must remain usable throughout development.

### 6.3 Model runtime limits


Initial runtime policy:

```text
Main-model concurrency: 1
Default context: 8,192 tokens
Resume-tailoring context ceiling: 16,384 tokens
Hard production context ceiling on this laptop: 24,576 tokens unless benchmarked otherwise
Idle unload: configurable; default 10 minutes
Prompt caching: allowed only with bounded memory and no cross-user leakage
Vision/audio: disabled for ordinary text workflows
Model digest: pinned in model/model-lock.json
Runtime version: pinned and recorded in every evaluation result
```

Do not use the advertised 256K context merely because it exists. Retrieval and structured context construction must keep ordinary requests small and reproducible.

### 6.4 Task-specific generation policy

| Task | Thinking | Temperature | Output |
|---|---:|---:|---|
| Field/question classification | off/lowest | 0.0 | strict JSON |
| Requirement extraction | low | 0.0–0.1 | strict JSON |
| Evidence retrieval query expansion | off | 0.0 | JSON/string list |
| Resume content plan | moderate | 0.1–0.25 | strict JSON |
| Resume bullet writing | low | 0.45–0.65 | candidate strings + evidence IDs |
| Short-answer planning | moderate | 0.1–0.25 | strict JSON |
| Short-answer writing | low | 0.5–0.7 | bounded text |
| Claim decomposition/verification | off/low | 0.0 | strict JSON |
| Contradiction check | low | 0.0 | strict JSON |
| Cover-letter writing | low | 0.5–0.7 | structured paragraphs |
| Interview feedback | moderate | 0.2–0.4 | structured feedback |

Exact parameter names depend on the pinned Ollama/model version and must be stored in the prompt registry rather than scattered through code.

### 6.5 Helper models and deterministic tools

Recommended retrieval helpers:

```text
Embedding model: Qwen/Qwen3-Embedding-0.6B
Optional reranker after benchmark: Qwen/Qwen3-Reranker-0.6B
```

The first release may use FTS5 + embeddings without a reranker if the evaluation proves sufficient. Main-model and embedding workloads should be sequential when memory pressure requires it.

Use deterministic code instead of the LLM for:

- Exact dates, phone numbers, emails, URLs, salaries, and yes/no records.
- Field-option matching.
- Word and character limits.
- Chronology validation.
- Duplicate detection.
- Page measurement.
- Keyword counts and repetition budgets.
- File hashes and versioning.
- Sensitive-field policies.
- Submission-state transitions.

### 6.6 AI pipeline contract

No production workflow may be a one-shot “paste everything and return final text” prompt. The standard pattern is:

```text
classify task and sensitivity
    -> build bounded context
    -> retrieve evidence
    -> create structured plan
    -> generate candidate text
    -> split into atomic claims
    -> verify against canonical evidence
    -> run contradiction and stale-context checks
    -> run style, repetition, and length checks
    -> at most one bounded repair pass
    -> require review or release according to policy
```

### 6.7 Model-output safety

- Job text must be delimited as untrusted data.
- Instructions found inside job text or page content must never override system rules.
- Model output must be parsed with strict schemas; unparseable output is an error, not permission to guess.
- The model receives no database credentials, browser tool, submission tool, filesystem shell, or secret tokens.
- Prompt and response logs are disabled by default; test logs use synthetic redacted data.
- Model upgrades require full regression evaluation and an explicit model-lock change.

---

## 7. Resume, answer, match, and autofill design rules

### 7.1 Whole-document tailoring

Tailoring must reserve each important requirement for the strongest evidence location. The same keyword must not be injected into several jobs merely to increase overlap. The planner must:

1. Rank requirements by importance.
2. Retrieve supporting evidence and calculate evidence strength.
3. Assign each supported requirement to one best section/bullet unless repetition is genuinely useful.
4. Identify unsupported requirements as gaps.
5. Establish section word budgets and a global page budget.
6. Preserve locked content and chronology.
7. Generate candidates, verify claims, and compare against the original.
8. Present categorized diffs: terminology clarification, evidence emphasis, shortening, removal, reordering, and user-input request.

The skills section is an index of demonstrated skills. Every listed skill must link to evidence.

### 7.2 Explainable matching

The UI must show separate dimensions:

```text
Eligibility
Evidence coverage
Terminology alignment
Document parseability
Human readability
```

Eligibility conflicts are gates, not small score deductions. Evidence matches have types:

```text
DIRECT | STRONG_RELATED | PARTIAL | USER_ASSERTED | UNSUPPORTED | CONTRADICTED
```

Only `DIRECT`, `STRONG_RELATED`, and approved `USER_ASSERTED` evidence count toward supported coverage, with different weights. Every result links to job and evidence spans.

### 7.3 One-page optimization

Calculate content utility using a versioned formula based on relevance, evidence strength, recency, impact, differentiation, redundancy, risk, and length cost. Optimize in this order:

1. Remove accidental whitespace.
2. Shorten wording without changing facts.
3. Remove redundant clauses.
4. Consolidate duplicate skills.
5. Remove low-utility bullets.
6. Reduce section spacing within limits.
7. Reduce line height within limits.
8. Reduce margins within limits.
9. Reduce font size only to the configured floor.
10. Recommend two pages if one page would become materially unreadable.

Initial guardrails:

```text
Body font floor: 10.5 pt
Heading floor: 11.5 pt
Line-height floor: 1.05
Page margins floor: 0.45 in
No clipping, hidden overflow, negative tracking, or overlapping elements
```

### 7.4 Short-answer generation

Question taxonomy must include at least:

```text
motivation_company
motivation_role
experience_example
project_example
leadership
conflict
failure_learning
strength
career_goal
availability
salary
location_relocation
work_authorization
sponsorship
export_control
legal_compliance
demographic_voluntary
portfolio_link
other_factual
other_narrative
```

Each intent has an automation policy. Narrative answers may be generated; consequential factual intents use explicit records and confirmation rules. Semantic answer reuse requires intent match plus context and freshness validation. Company-specific answers must never be reused verbatim across companies without regeneration.

### 7.5 Voice adaptation

The product maintains a style profile from user-provided samples and accepted edits. It can learn:

- Formality.
- Contraction preference.
- Sentence and paragraph length.
- Directness.
- Preferred vocabulary.
- Phrases to avoid.
- First-person style.
- Degree of enthusiasm.

It must not learn or preserve factual errors. Quality should be evaluated by edit distance, human preference, specificity, and cliché frequency—not by trying to evade AI detectors.

### 7.6 Sensitive-field policy

At minimum, these concepts are sensitive or consequential:

```text
work authorization
visa sponsorship
export-control citizenship/residency
criminal/legal disclosures
disability
veteran status
race/ethnicity
gender/sex
age/date of birth
salary expectations and units
relocation commitments
conflict-of-interest disclosures
noncompete or prior-employment restrictions
security clearance
employee IDs or internal applicant identifiers
```

The product must support per-concept policies:

```text
NEVER_AUTOFILL
FILL_FROM_EXPLICIT_RECORD
CONFIRM_ONCE_PER_JOB
CONFIRM_IF_RECORD_EXPIRED
VOLUNTARY_PREFER_NOT_TO_ANSWER
BLOCK_AND_EXPLAIN
```

### 7.7 Post-fill reconciliation

After every fill pass:

1. Rescan visible enabled controls.
2. Identify required fields, browser/site validation messages, and empty supported fields.
3. Compare actual DOM values to intended decisions.
4. Detect controls changed by page scripts after fill.
5. Show four explicit groups: filled, needs review, sensitive, unsupported/skipped.
6. Block “ready to submit” while any unresolved required field remains.

---

## 8. Test and validation architecture

### 8.1 Test layers

1. **Pure unit tests:** parsing, matching, scoring, policy, schemas, state machines.
2. **Property-based tests:** date normalization, field resolution invariants, versioning, idempotency, duplicate detection.
3. **Contract tests:** JSON Schema parity between TypeScript, Python, and Rust.
4. **Golden tests:** resume parsing, job parsing, generated plans, claim verification, rendered document text.
5. **Component tests:** desktop and extension UI states.
6. **Browser fixture tests:** supported ATS pages, dynamic changes, uploads, validation, multipage flows.
7. **Visual regression tests:** desktop views, extension panels, resume PDFs.
8. **Performance tests:** scan/fill latency, memory, model latency, render time, queue throughput.
9. **Security tests:** prompt injection, message forgery, capability abuse, PII redaction, malformed documents, path traversal.
10. **Platform-native package tests:** install, launch, process lifecycle, secret store, native messaging, update/rollback, backup portability, and uninstall on macOS, Windows, and Ubuntu.
11. **Manual real-site validation:** terms-compliant, low-volume, controlled checks on public application pages.

### 8.2 Mock ATS lab

`apps/mock-ats-lab` must provide deterministic fixtures for:

- Native controls.
- React/Vue-style controlled inputs.
- Dynamic insertion/removal.
- Multipage navigation.
- Iframes.
- Shadow DOM where feasible.
- Custom comboboxes and listboxes.
- Date and phone widgets.
- File uploads.
- Required/optional/sensitive fields.
- Hidden honeypots that must not be filled.
- Validation errors.
- Confirmation pages.
- CAPTCHA placeholder requiring pause.
- Delayed post-submit receipt.
- Duplicate application warning.
- Prompt-injection text embedded in labels and job descriptions.

No automated test may submit to a live employer.

### 8.3 Evaluation corpora

All corpora are synthetic or explicitly user-consented and redacted. Every case has a stable ID, schema version, expected-result provenance, author/reviewer metadata, and immutable historical hash.

#### 8.3.1 Evaluation partitions

Every critical corpus is partitioned into:

1. **Development set:** visible to implementation agents; used for tests and iteration.
2. **Public/manual validation set:** public no-submit forms or manually captured same-input product comparisons.
3. **Owner-controlled holdout:** at least 20% of gate variants/cases, stored outside the implementation working tree with only a hash manifest committed.
4. **Regression expansion set:** every confirmed defect becomes a permanent case without rewriting prior expected results.

The same implementation agent must not author all expected outputs and then certify its own result.

#### Resume corpus

At least:

- 40 synthetic profiles across software, data, business, operations, healthcare, education, sales, finance, and entry-level roles.
- 120 job descriptions with must-have and preferred requirements.
- 200 validated tailoring cases.
- Explicit unsupported-keyword and contradiction adversarial cases.
- One-page and two-page render cases.
- At least 50 cases where naive keyword insertion would bloat the skills section or repeat the same skill across jobs.
- At least 50 PageFit cases where content removal is preferable to typography compression.
- At least 25 cases where the correct result is a two-page recommendation.
- Blind human-review subsets comparing untailored, one-shot, keyword-stuffing, Simplify, and product outputs.

#### Answer corpus

At least:

- 250 question prompts across the taxonomy.
- 75 semantically equivalent paraphrase clusters.
- 50 stale-company/context traps.
- 50 sensitive-field cases.
- 75 exact word/character-limit cases.
- 50 intentionally insufficient-evidence cases.

#### Autofill corpus — early `M02` gate

Before the Autofill Feasibility Gate can pass:

- At least 200 deterministic synthetic form variants.
- At least 2,500 scored controls.
- Native inputs, React-controlled inputs, Vue-style controls, custom comboboxes, virtualized listboxes, dates, radios, checkboxes, repeaters, uploads, iframes, supported shadow DOM, conditional questions, validation messages, delayed state updates, rerenders, and page-state transitions.
- At least 100 sensitive/prohibited controls and at least 50 honeypots.
- Workday is the largest ATS-specific challenge slice: at least 50 Workday-like synthetic variants covering prompt controls, repeaters, upload/parser effects, validation, route changes, page generations, and long-session observation.
- Multiple Greenhouse, Lever, and Ashby structural variants remain required so the generic core is not overfit to Workday.
- At least 30 public no-submit application variants where available and permitted: target 10 Workday research cases, 8 Greenhouse, 8 Lever, and 4 Ashby.
- At least 20% owner-controlled hidden holdout variants, including unseen Workday control and rerender patterns.
- Negative cases reproducing legacy CareerPulse/JobApply failure classes: stale selectors, unrelated single-option fallback, deterministic mapping loss after AI failure, full-document rescan pressure, immediate-value-only success, and jsdom/browser mismatch.
- Negative Workday architecture cases: duplicate repeater creation, resume-parser duplication, stale page generation, ambiguous step classification, unexpected login/session boundary, validation-blocked navigation, and repeated-next risk.
- No automatic final submission and no credential/MFA/CAPTCHA automation.

#### Workday corpus — production `M19`–`M20` gate

Before `WORKDAY_GUIDED_PRE_SUBMIT` can pass:

- At least 40 deterministic synthetic Workday tenant/layout variants.
- At least 3,000 scored Workday controls.
- At least 500 scored repeater item operations and duplicate-prevention decisions.
- At least 100 Workday validation and conditional-question transitions.
- At least 100 navigation transactions with expected readiness proof and transition result.
- Multiple locale, country/address/date/phone, guest/authenticated/returning-candidate, account/login boundary, resume parser, questionnaire, disclosure, voluntary demographic, upload, review, and session-expiration cases.
- At least 24 public no-submit structural dry-runs across at least 12 employers and four locale/country configurations where available.
- At least 12 owner-controlled end-to-review runs in permitted or controlled environments, with no automated submission.
- At least 20% hidden holdout variants.
- Fault injection for reload, back, service-worker suspension, local-service restart, delayed rerender, upload failure, validation rejection, no-transition timeout, page identity drift, and session expiration.
- A 45-minute long-session soak and a repeated 20-flow progression soak.
- Same-input manual Simplify comparisons with raw field, navigation, correction, timing, and unresolved-state outcomes.

#### Autofill corpus — final release

At least:

- 600 form fixtures by final release, including the complete Workday production matrix.
- Every supported ATS adapter represented by multiple tenants/layout variants.
- At least 150 sensitive/prohibited controls; increase the set whenever a new sensitive concept or adapter is added.
- Dynamic and multipage cases.
- Upload, parser-reconciliation, guided navigation, review-boundary, and receipt cases.
- Long-session and browser/service-worker restart cases.
- A public compatibility matrix with measured counts and last-tested dates.

#### Holdout handling

- No real PII or employer-private data.
- Holdout expected results are unavailable to the implementation agent before the run.
- The committed manifest records case count, schema version, content hash, evaluator version, and required runner version.
- Holdout results are append-only and tied to a Git revision.
- A failed holdout is not repaired by editing the holdout answer; it creates a defect or reviewed expectation-correction record.

#### Cross-platform corpus

Before `CROSS_PLATFORM_CORE` can pass:

- At least one packaged release-candidate build for each certified target.
- Clean and dirty upgrade fixtures, install paths with spaces/Unicode, locked-file and interrupted-update cases.
- Secure-store availability/denial/corruption fixtures for each platform adapter.
- Native-messaging install/repair/uninstall fixtures for Chrome stable.
- Backup/restore fixtures covering every required source/target platform combination.
- Document render/extraction and bundled-font matrix on every certified platform.
- At least one full-AI profile per operating system plus explicit no-model/insufficient-hardware behavior.
- Physical or native hosted evidence; containers and cross-compilation are supplemental only.

### 8.4 Quality baseline and side-by-side comparison

Freeze baselines before optimizing. They include:

- Untailored original resume.
- Simple keyword-overlap matcher.
- Naive keyword-stuffing resume transformation.
- One-shot local-model resume and answer generator.
- Legacy CareerPulse/JobApply autofill behavior, measured in isolation where runnable and legally permitted.
- Manually captured Simplify behavior/output for the same synthetic profile, public form, and user-owned content examples.

Blind human raters compare factuality, relevance, specificity, naturalness, coherence, readability, information retention, and usefulness. Evaluation data must be synthetic or user-consented and redacted.

For autofill, the field-level comparison schema must include:

```text
case ID
ATS family and tenant pattern
locale and candidate-session mode
application step and page generation
field semantic concept
expected value or expected abstention
our intended value
our observed immediate value
our observed post-rerender value
site validation result
Simplify observed value/result
legacy baseline observed value/result
manual correction required
unresolved state reported
sensitivity/policy result
per-field duration
page-readiness proof result where applicable
navigation action/result where applicable
final-review boundary result where applicable
notes and artifact references
```

For resumes, the comparison schema must include:

```text
case ID
job requirement set and source spans
source evidence IDs
unsupported gaps
original output
one-shot output
keyword-stuffing output
Simplify output where captured
product output
atomic-claim audit
keyword/repetition audit
render/extraction audit
PageFit utility report
blind ratings and rater confidence
```

#### 8.4.1 Statistical and scope rules

- Report raw counts and rates; do not hide small samples behind a single percentage.
- Include confidence intervals or exact uncertainty notes when making non-inferiority or superiority claims.
- Precision and recall must be reported together; an engine cannot game precision by filling nothing.
- Zero-tolerance failures are reported as counts, not rounded percentages.
- A Simplify comparison is limited to the observed product version, date, account tier, browser, forms, and examples.
- A compatibility claim is limited to measured tenant patterns, not the ATS brand as a whole.
- The early gate may establish parity on a narrow set; the final release requires the broader statistically meaningful win defined in Section 2.

#### 8.4.2 Gate evidence bundle

Each gate produces a content-addressed bundle containing:

- Git revision and clean-tree proof.
- Corpus and holdout manifest hashes.
- Toolchain, browser, extension, adapter, model, prompt, and renderer versions.
- Raw result JSON.
- Aggregate report.
- Failure traces/screenshots with synthetic data only.
- Performance and memory results.
- Independent review report.
- Manual inspection checklist.
- Gate decision and owner approval.

### 8.5 Required repository verification commands

Milestone `M00` may adjust exact commands, but the root must expose equivalents of:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:visual
pnpm verify

uv run ruff check services
uv run ruff format --check services
uv run mypy services
uv run pytest

cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

`pnpm verify` must aggregate all required non-live checks and fail on any skipped mandatory suite. Canonical commands must run from PowerShell/Windows process invocation as well as POSIX shells; OS-specific wrappers may not diverge from the shared implementation.

### 8.6 Test-evidence standard

`docs/TEST_EVIDENCE.md` records:

- Work-package ID.
- Git commit or working-tree hash.
- Operating system and relevant runtime versions.
- Commands.
- Exit status.
- Test counts.
- Benchmark summary.
- Screenshots/trace paths where applicable.
- Known flaky behavior; mandatory tests may not be labeled flaky to avoid fixing them.

---

## 9. Milestone execution map

Milestone numbers remain stable. Cross-platform behavior is implemented progressively in the milestones that own lifecycle, storage, model runtime, rendering, native messaging, and packaging; the fourth gate prevents closed-alpha expansion until those pieces work together natively.

| Phase | Milestones | Result |
|---|---|---|
| A — Contract, measurement, and early autofill proof | M00–M02 | Reproducible three-OS CI baseline, typed contracts, frozen corpora, real extension feasibility engine, and accepted Autofill Feasibility Gate |
| B — Secure local platform, model profiles, and early resume proof | M03–M05 | Cross-platform lifecycle/storage foundations, accepted local-model profiles, and accepted Resume Tailoring/PageFit Gate |
| C — Canonical user knowledge | M06–M08 | Evidence graph, imports, profile, eligibility, preferences, and voice data |
| D — Resume and application intelligence | M09–M16 | Complete document system and cross-platform renderer matrix, job analysis, production tailoring, PageFit, cover letters, and answers |
| E — Production browser autofill | M17–M24 | Cross-platform native transport, production form engine, Workday gate, initial ATS adapters, and manual application workflow |
| F — Tracking, platform hardening, and closed alpha | M25–M28 | Receipts/analytics/interview practice, packaged three-OS core, Cross-Platform Core Gate, and closed-alpha acceptance |
| G — Broader ATS coverage | M29–M31 | iCIMS, SmartRecruiters, Taleo, SuccessFactors, and safe unsupported-site mapping |
| H — Job discovery and approval | M32–M34 | Constantly refreshed public job index, explainable ranking, and approved queue UI |
| I — Automatic application | M35–M37 | Resumable safe execution, certified auto-submit, intervention/recovery, and sustained pilot |
| J — Final release | M38 | Full cross-feature and cross-platform independent validation and release candidate |

### 9.1 Blocking readiness rules

1. `M03` must not become `READY` until `M02` is `ACCEPTED` and `AUTOFILL_FEASIBILITY` is `PASS`.
2. `M06` must not become `READY` until `M05` is `ACCEPTED` and `RESUME_PAGEFIT_FEASIBILITY` is `PASS`.
3. `M17` and `M18` must reuse the accepted `M02` extension, scanner, resolver, driver, benchmark, and reconciliation artifacts; replacing them requires an ADR and a complete Gate A rerun.
4. `M09`, `M10`, `M13`, and `M14` must preserve and extend the accepted `M05` planner, verifier, renderer, and PageFit artifacts; replacing them requires an ADR and a complete Gate B rerun.
5. `M19` is the first production ATS adapter. Its field-coverage acceptance is required before guided navigation begins.
6. `M21` must not become `READY` until `M20` is `ACCEPTED` and `WORKDAY_GUIDED_PRE_SUBMIT` is `PASS`.
7. Greenhouse, Lever, Ashby, later adapters, and generic automation must not degrade the accepted M02 or Workday gate results. Any regression changes the affected gate state from `PASS` to `BLOCKED` until the complete regression is restored.
8. Workday compatibility claims are limited to measured tenant/layout/locale/session patterns. Universal Workday support is prohibited.
9. Automatic submission remains blocked until manual application review, exact snapshots, duplicate prevention, and receipt behavior are accepted. Workday guided pre-submit does not grant submit authority.
10. The status validator must enforce all four critical-gate prerequisites and downstream readiness rules after `M00-W08`.
11. `M01-W01` cannot be ready after v1.3 adoption until `M00-W10` re-accepts M00.
12. `M28` cannot be ready or later unless `M27` is accepted and `CROSS_PLATFORM_CORE = PASS`.

---

## M00 — Repository contract, persistent project memory, and reproducible scaffold

**Dependencies:** None  
**Goal:** Create the repository foundation and persistent workflow that allows Fable 5 to continue accurately across many prompts without losing scope, state, verification evidence, or critical-gate governance.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M00-W01` | Create canonical project-memory files | Place the then-current specification at its canonical path. Create CLAUDE.md and the project-status documents with templates, enums, ownership, and update rules. Mark only M00-W01 IN_PROGRESS. |
| `M00-W02` | Scaffold the monorepo | Create pnpm/Turborepo layout, Python workspace, Rust native-host crate, desktop, extension, mock ATS lab, packages, prompts, model, scripts, and docs directories. No fake feature implementations. |
| `M00-W03` | Establish strict toolchain configuration | Pin Node, pnpm, Python, Rust, browser, and package-manager versions. Enable TypeScript strict mode, Ruff, mypy, pytest, Vitest, Playwright, rustfmt, and Clippy. |
| `M00-W04` | Create root verification commands | Implement deterministic root commands for lint, typecheck, unit, contract, browser, visual, Python, Rust, integrity, and aggregate verification. Empty active suites must fail; not-yet-applicable suites require an explicit machine-readable state. |
| `M00-W05` | Adopt and migrate the v1.2 Workday-first critical-risk rebaseline | For the existing v1.0 repository, compare the proposed v1.2 and canonical specs, record owner approval in an accepted ADR, replace the canonical file atomically, migrate the 39-milestone/260-work-package/135-requirement inventory, add the three critical-gate records, update validators/readiness rules, preserve verified revisions, remove the proposed copy, and prove repository consistency. This remains historical completed work under v1.3 and its evidence must be preserved. |
| `M00-W06` | Create CI and local preflight | Add CI for macOS and Linux initially, dependency caching, generated-contract checks, root verification, and artifact retention for Playwright traces. Add a local environment doctor command. Under v1.3 this remains historical completed work; its macOS/Ubuntu CI, doctor/preflight, cache, generated-contract, and hosted evidence must be preserved. |
| `M00-W07` | Seed traceability and status | Enter every v1.2 requirement and work package into traceability/status files, assign dependencies and critical-gate effects, validate counts, and identify the next READY package. Finish this in-flight v1.2 package first and preserve its machine-readable source, generator/validator, exact 135/260 inventory, M00 audit, and evidence for extension by M00-W10. |
| `M00-W08` | Adopt and migrate the v1.3 cross-platform rebaseline | Compare canonical v1.2 with the immutable owner-approved external v1.3 file, record owner approval and the source hash in an accepted ADR, atomically copy those exact bytes into the canonical path without introducing a second canonical-looking repository file, add platform memory and the fourth gate, migrate status/validators and mechanically extend the existing traceability source to the exact 39-milestone/286-work-package/157-requirement inventory with honest future states, preserve W01–W07 evidence, reopen M00, and prove consistency. Detailed reviewed platform mappings remain owned by M00-W10. |
| `M00-W09` | Add Windows CI and platform-portability baseline | Extend CI/doctor/preflight to windows-2025 x64; create the empty `packages/platform` scaffold if absent; validate platform-neutral scripts, path/line-ending/case assumptions, PowerShell execution, exact toolchains, Chrome/Playwright, Rust/Python/Node, and generated-contract lifecycle. Add no product behavior. |
| `M00-W10` | Extend traceability and re-accept M00 under v1.3 | Extend and regenerate the existing `docs/traceability.json` through `scripts/traceability.py` for the exact v1.3 inventory, map all new platform requirements/packages/gate effects, preserve the existing human-readable view and tests, rerun three-OS fresh-clone evidence, mark M00 accepted only when the expanded exit gate passes, and make M01-W01 ready. |

The `windows-2025` hosted job is a repository portability baseline, not proof of Windows 11 desktop certification. Gate D still requires the native packaged Windows 11 evidence defined in M03, M04, M05, M17, and M27.

### Required verification

- Fresh clones install with documented locked commands on macOS, Windows, and Ubuntu CI.
- All scaffold smoke tests pass and generated/dirty repository checks fail correctly.
- Status validation rejects invalid states, multiple `IN_PROGRESS` packages, stale inventories, missing platform memory, and critical-gate readiness violations.
- Historical v1.2 M00-W01 through M00-W07 revisions and evidence remain byte-for-byte or semantically preserved according to the recorded anchors.
- v1.3 adoption produces exactly one canonical specification, four gate records, 39 milestones, 286 work packages, and 157 requirements.
- `M03`, `M06`, `M21`, and `M28` readiness is blocked by the correct critical-gate and accepted-milestone prerequisites.
- Windows, macOS, and Ubuntu CI run the same canonical doctor/preflight/verify implementation.
- Windows negative tests reject POSIX-only scripts, shell masking, case/path/line-ending assumptions, and missing platform dependencies.
- Traceability generation/check is deterministic for the expanded inventory and preserves completed evidence.

### Milestone exit gate

A fresh clone on each certified CI operating-system family can install with locked dependencies, run doctor/preflight/aggregate verification, reconstruct the next task solely from repository files, and enforce all four critical-gate readiness rules. M00-W01 through W07 evidence remains unchanged, the exact v1.3 traceability inventory validates, and M01-W01 is ready only after M00-W10 re-accepts M00.

### Prohibited shortcut

Do not implement profile, AI, resume, autofill, desktop platform adapters, secure stores, model profiles, native-host installers, or other product behavior in M00. M00 establishes contracts, CI portability, project memory, migration integrity, and traceability only.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md`, `KNOWN_ISSUES.md`, and approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M01 — Shared contracts, identifiers, error model, capability model, and critical-risk evaluation contracts

**Dependencies:** M00  
**Goal:** Make cross-language communication typed, versioned, and safe before components begin exchanging user data or the early autofill feasibility extension executes actions.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M01-W01` | Define JSON Schema conventions | Define schema versioning, stable IDs, timestamps, enums, money/date/location types, provenance, confidence, redaction annotations, and forward-compatible envelopes. |
| `M01-W02` | Generate TypeScript and Python contracts | Generate strict TS types/validators and Pydantic v2 models from one schema source. Prevent hand-maintained divergent copies. |
| `M01-W03` | Define error taxonomy | Create machine-readable validation, conflict, unsupported, sensitive, model, storage, transport, rendering, site, benchmark, gate, and submission error families with user-safe messages. |
| `M01-W04` | Define capability and command allowlists | Specify which component may request each operation. Content scripts cannot request database, model, filesystem, or submission capabilities directly. Feasibility mode has no submit capability. |
| `M01-W05` | Build contract compatibility tests | Round-trip representative messages through TS, Python, and Rust. Test unknown fields, older minor versions, invalid enums, oversized payloads, malicious values, and capability escalation. |
| `M01-W06` | Define feasibility and benchmark contracts | Define FieldAddress, FieldDescriptor, FieldDecision, driver result, reconciliation inventory, ATS variant, WorkdayTenantFingerprint, WorkdayStepIdentity, PageReadinessProof, NavigationRecord, ApplicationSession, GuidedRunMode, Workday certification record, benchmark case/result, gate evidence bundle, holdout manifest, resume plan, atomic claim, layout measurement, and gate decision schemas. Generate and round-trip them. |
| `M01-W07` | Define cross-platform capability and platform-service contracts | Define certified platform IDs/support tiers, platform capabilities, paths, secure store, process supervisor, native-messaging registrar, browser locator, model-runtime profile, installer/updater state, diagnostics, and platform evidence schemas. Generate TypeScript/Python/Rust-compatible contracts and forbid arbitrary OS-command payloads. |

### Required verification

- Schema generation is reproducible.
- Cross-language round-trip corpus passes.
- Invalid privileged messages are rejected.
- Breaking schema changes are detected.
- Feasibility mode cannot express or request a submit action.
- `GUIDED_PRE_SUBMIT` can express only certified fill, validation, navigation, pause, review, and cancellation operations; it cannot express final submit or protected authentication actions.
- Navigation contracts require page generation, readiness-proof hash, unique control identity, transition postconditions, and idempotency key.
- Field addresses reject raw-selector-only identity.
- Benchmark and gate result schemas require revision/corpus/runtime metadata.

- Platform capability and support-tier contracts round-trip across languages.
- Platform operations use typed allowlists; no arbitrary command, registry, path, or shell payload crosses a trust boundary.

### Milestone exit gate

All inter-component and critical-feasibility messages used by `M02`, plus the Workday production and guided-navigation messages required by `M19`–`M20`, have a versioned schema and pass cross-language compatibility tests.

### Prohibited shortcut

No untyped dictionaries/any payloads across trust boundaries, and no browser action represented only as an arbitrary selector/value pair.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md`, `KNOWN_ISSUES.md`, and approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M02 — Evaluation corpus, mock ATS lab, frozen baselines, and Autofill Feasibility Gate

**Dependencies:** M00, M01  
**Goal:** Build the measurement system and prove the production-intended autofill architecture on real browser behavior before surrounding product development proceeds.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M02-W01` | Create synthetic profile/job/resume fixtures | Seed diverse, internally consistent profiles, evidence artifacts, resumes, jobs, expected requirements, supported claims, explicit gaps, and field-value policies. |
| `M02-W02` | Create question and answer fixtures | Build taxonomy-balanced prompts, paraphrase clusters, stale-context traps, sensitive questions, length limits, and insufficient-evidence cases. |
| `M02-W03` | Build mock ATS lab v1 | Implement deterministic native, React/Vue-controlled, custom, virtualized, dynamic, multipage, iframe, supported-shadow, file-upload, validation, receipt, honeypot, CAPTCHA-pause, rerender, and prompt-injection forms. |
| `M02-W04` | Capture baseline algorithms | Implement simple keyword overlap and one-shot generation baselines strictly for evaluation; label them non-production. Define isolated legacy CareerPulse/JobApply behavior capture without importing their code. |
| `M02-W05` | Build evaluation runner | Create versioned result JSON, aggregate metrics, regression thresholds, raw-count reports, confidence/uncertainty reporting, and HTML/Markdown output. Include code/browser/runtime/prompt/corpus digests. |
| `M02-W06` | Freeze v1 corpus and holdout manifest | Hash the development corpus, create the owner-controlled holdout manifest, record change policy, and preserve historical expected results. |
| `M02-W07` | Scaffold the real MV3 feasibility extension | Build the minimal WXT Manifest V3 extension required for scanning/filling tests. Load the built extension in bundled Playwright Chromium with a persistent context and actual service worker. Include no product UI, native host, local database, or submit capability. |
| `M02-W08` | Implement semantic field identity and per-frame scanner | Implement FieldAddress/FieldDescriptor, application-root detection, frame-local agents, label/ARIA/section/option extraction, visibility/enabled/required semantics, bounded subtree scanning, and re-resolution. |
| `M02-W09` | Implement deterministic ontology, resolver, and safety policy | Implement concept rules, aliases, negative patterns, option semantics, section context, sensitivity classes, confidence calibration, abstention, and monotonic optional AI-proposal boundary with deterministic-results preservation. |
| `M02-W10` | Implement transactional control drivers | Implement native/framework text, select, radio, checkbox, date, ARIA combobox, virtualized listbox, repeater, file upload, and research Workday prompt/navigation-identification drivers with preconditions, exact semantic matching, execution, rerender wait, validation postconditions, undo, and diagnostics. |
| `M02-W11` | Implement dynamic state, reconciliation, and performance instrumentation | Implement route/page generations, batched mutation handling, conditional-field discovery, duplicate-action prevention, complete required-field reconciliation, page-changed-value detection, and CPU/memory/scan instrumentation. |
| `M02-W12` | Build ATS research variant matrix | Create sanitized fixtures and research-only adapters for Workday first, followed by Greenhouse, Lever, and Ashby. Workday must be the largest and most adversarial slice, covering tenant/layout/locale/session boundaries, multipage step classification, repeaters, upload/parser behavior, validation, navigation-control identification, and long-session performance. This remains research evidence, not production support. |
| `M02-W13` | Build autofill benchmark and clean-room baseline harness | Score field-by-field expected values/abstentions, run fresh extension tests, support owner holdout execution, isolate legacy baselines, and produce same-page comparison worksheets for Simplify. |
| `M02-W14` | Execute synthetic, holdout, public no-submit, and side-by-side evaluation | Run the complete development corpus, owner-controlled holdout, at least the target public no-submit matrix where available, CareerPulse/legacy comparison, and manual Simplify comparison using the same synthetic profile. Record all raw outcomes and artifacts. |
| `M02-W15` | Independent Autofill Feasibility Gate audit and decision | A separate high-capability session re-reads the specification, audits every changed file, reproduces key positive/negative cases, validates holdout integrity, checks performance and safety, and records PASS, REDESIGN_REQUIRED, or BLOCKED with owner approval. |

### Required verification

- Fixture consistency validator and no-real-PII/secrets scan.
- Mock ATS deterministic replay.
- Real built extension loads in Playwright Chromium and exposes its actual MV3 service worker.
- Multiple frame agents report isolated descriptors without cross-origin parent traversal.
- Raw-selector-only identity is rejected.
- Stale resolution pauses instead of filling a replacement control.
- Framework-controlled values persist after rerender.
- Site validation acceptance is checked.
- Unrelated single-option fallback is rejected.
- AI timeout/malformed output leaves deterministic mappings intact.
- Bounded mutation tests show no repeated full-document scan loop.
- Hidden honeypots are never filled.
- Sensitive/prohibited false fills are zero.
- Required unresolved fields are always reported.
- Duplicate actions from rescans are zero.
- Upload selection is exact and no live submit occurs.
- Greenhouse/Lever/Ashby regression matrix.
- Research Workday tenant/locale/session, repeater, upload/parser, multipage step-classification, navigation-identification, long-form, and memory cases.
- Workday constitutes the largest early ATS challenge slice and any fundamental Workday architecture failure can force `REDESIGN_REQUIRED` even if simpler ATS fixtures pass.
- Owner-controlled holdout result.
- Manual same-input Simplify comparison and isolated legacy comparison.
- Independent audit.

### Milestone exit gate

`AUTOFILL_FEASIBILITY` is `PASS` only when all Section 2.3 Gate A thresholds pass, the independent reviewer confirms the architecture is productionizable, the owner-controlled holdout is valid, and the owner records approval. Only then may `M03` become `READY`.

If the gate is `REDESIGN_REQUIRED`, no later milestone becomes ready. Create an ADR, add the failing cases permanently, redesign within M02-owned modules, and rerun the complete gate.

### Prohibited shortcut

- Do not submit a live application.
- Do not claim production ATS support from research fixtures.
- Do not replace real extension tests with jsdom.
- Do not use an LLM for ordinary field execution.
- Do not copy the legacy repository as a starting point.
- Do not tune expected results to current code.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md`, all applicable gate reports, `KNOWN_ISSUES.md`, and approved ADRs. It must run clean-clone verification and record the exact benchmark bundle hash.

---

## M03 — Desktop shell, local orchestrator lifecycle, and authenticated health path

**Dependencies:** M00, M01, M02 with `AUTOFILL_FEASIBILITY = PASS`  
**Goal:** Prove the desktop application can securely start, monitor, communicate with, and stop the local service through a typed platform abstraction on macOS, Windows, and Ubuntu.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M03-W01` | Create Tauri desktop shell | Implement navigation shell, error boundary, loading states, keyboard foundation, and development diagnostics page. |
| `M03-W02` | Create FastAPI service skeleton | Add versioned /health, /ready, /version endpoints, structured errors, lifespan management, and no external network binding. |
| `M03-W03` | Implement sidecar lifecycle | Tauri selects a random loopback port, generates an ephemeral session token, starts the service, waits for readiness, and shuts it down cleanly. |
| `M03-W04` | Implement authenticated API client | Desktop requests include bounded timeouts, token auth, correlation IDs, cancellation, retries only for idempotent operations, and user-safe errors. |
| `M03-W05` | Add crash/restart behavior | Detect service death, preserve unsaved UI state where possible, show diagnostics, and perform bounded restart without spawning duplicates. |
| `M03-W06` | Package development build | Produce a signed-development or local macOS build that launches without terminal interaction. Under v1.3 this is the macOS arm64 development package and must prove the common lifecycle contract before the Windows and Ubuntu packages extend it. |
| `M03-W07` | Package Windows x64 development build | Produce a Windows 11 x64 development installer/build that launches without a terminal window, starts the local service, authenticates, handles spaces/Unicode paths, and exits without orphan processes. |
| `M03-W08` | Package Ubuntu x64 development build | Produce an Ubuntu 24.04 x64 development package that validates WebKitGTK/system dependencies, launches without shell-profile dependence, starts/authenticates the service, and exits cleanly. |
| `M03-W09` | Implement platform lifecycle, path, and process adapters | Move spawn, executable discovery, app-data/cache/temp paths, termination, cancellation, and diagnostics behind typed adapters. Cover Windows process groups/file locks and POSIX signals without leaking OS logic into shared code. |
| `M03-W10` | Run cross-platform desktop lifecycle matrix | Execute packaged launch, port collision, unauthorized request, crash/restart, update-neutral relaunch, Unicode/spaces path, and orphan-process tests on all certified platforms; publish capability rows without yet passing Gate D. |

### Required verification

- Lifecycle unit tests, port collision, unauthorized request rejection, and bounded crash/restart.
- No non-loopback listener and no orphan process after normal or forced exit.
- Desktop keyboard smoke test.
- Packaged lifecycle E2E on macOS arm64, Windows x64, and Ubuntu x64.
- Ubuntu package tests cover the supported default GNOME session and record Wayland/X11 behavior where available; untested desktop environments are not implied supported.
- Platform path/process adapter contracts and no shared-domain direct OS API imports.
- GUI launch and runtime discovery work without interactive-shell `PATH` inheritance.
- Spaces, Unicode, quoting, cancellation, locked-file, and platform termination cases.

### Milestone exit gate

All three development packages launch the authenticated local service, display health/version, survive a forced service crash, handle platform path/process semantics, and exit without orphan processes.

### Prohibited shortcut

Do not expose unauthenticated localhost endpoints.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M04 — Encrypted persistence, migrations, artifacts, backup, and restore

**Dependencies:** M01, M03  
**Goal:** Create durable encrypted private-data storage with platform-native key protection and portable backup/restore before real resumes or profile data are accepted.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M04-W01` | Select and prove database encryption | Implement SQLCipher or approved equivalent. Store the key in macOS Keychain for the initial target while defining the typed SecretStore boundary used by the Windows and Ubuntu adapters. Database keys remain independent of platform storage, and no plaintext fallback is allowed. |
| `M04-W02` | Create migration framework | Version migrations, transactional upgrades, rollback/recovery policy, schema checksum, and test against multiple historical fixtures. |
| `M04-W03` | Create repository/data-access layer | Prevent UI and extension from raw SQL. Add transaction boundaries, optimistic concurrency, and stable IDs. |
| `M04-W04` | Create encrypted artifact store | Content-address imported documents, rendered outputs, and snapshots; encrypt sensitive files; maintain reference counts and integrity hashes. |
| `M04-W05` | Implement backup/export/restore | Create encrypted backup bundle, manifest, integrity verification, restore preview, and conflict-safe import. |
| `M04-W06` | Implement deletion and retention | Delete selected categories or all user data, remove unreferenced artifacts, and verify secrets/logs are excluded. |
| `M04-W07` | Implement macOS Keychain secret-store adapter | Store/retrieve/delete database keys and service secrets through Keychain; test denied access, missing item, migration, reinstall, and uninstall/user-data choices. |
| `M04-W08` | Implement Windows Credential Manager and DPAPI adapter | Use Credential Manager and/or DPAPI-protected key material through the common interface; test user scope, registry/install paths, locked files, reinstall, repair, and no plaintext fallback. |
| `M04-W09` | Implement Ubuntu Secret Service adapter | Use Secret Service/libsecret-compatible storage; detect unavailable or locked services, provide remediation, use a test-only injected store in CI, and never fall back to a file secret. |
| `M04-W10` | Prove portable encrypted backup and filesystem semantics | Use an OS-neutral backup manifest/artifact format and test source-to-target restore across the certified matrix, spaces/Unicode, case collisions, locked files, atomic replacement, and interrupted operations. |

### Required verification

- Database unreadable without its key and no plaintext key fallback.
- Migration forward tests and interrupted migration recovery.
- Artifact tamper detection, backup round trip, and deletion verification.
- Key-store allow/deny/missing/corruption cases on macOS, Windows, and Ubuntu.
- Credential/key reinstall, repair, and user-data preservation behavior.
- Cross-platform backup/restore matrix, path/case/locked-file/atomic-replace cases.

### Milestone exit gate

Synthetic private data is encrypted and recoverable on every certified platform, portable through the approved backup format, unreadable without the platform-protected key, and fully deletable with automated proof.

### Prohibited shortcut

No plaintext fallback for production private data.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M05 — Local model runtime, exact model lock, domain benchmark, and Resume Tailoring/PageFit Feasibility Gate

**Dependencies:** M02, M03, M04  
**Goal:** Select and integrate evidence-grounded local-model profiles for the primary Mac and certified Windows/Linux hardware tiers, and prove the resume/PageFit architecture.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M05-W01` | Implement runtime adapter | Detect Ollama, start/check runtime, list/pull models, report progress, health, memory errors, and model digest through the desktop UI. |
| `M05-W02` | Create candidate model lock | Pin the initial `gemma4:12b-mlx` candidate, Ollama version range, runtime engine, context limits, default parameters, license/source metadata, and candidate-comparison policy in model-lock.json. |
| `M05-W03` | Implement typed generation client | Support cancellation, streaming, schema validation, timeouts, one retry for malformed structured output, bounded thinking, and no raw prompt logging. |
| `M05-W04` | Integrate embeddings | Add the pinned embedding model, bounded vector storage, deterministic normalization, and FTS fallback. |
| `M05-W05` | Build comparative domain model benchmark | Evaluate the candidate and at least one feasible 12B–14B alternative on extraction, planning, writing, claim decomposition, contradiction detection, exact limits, JSON validity, latency, memory pressure, swap behavior, and user preference. |
| `M05-W06` | Select and lock the exact production model | Record comparative results. Lock the winner only if all hardware and quality gates pass; otherwise propose an ADR with feasible alternatives. Update the exact digest and runtime policy. |
| `M05-W07` | Define the resume/PageFit feasibility vertical slice | Implement the versioned feasibility semantic resume subset, job requirements, evidence records, support states, locks, render intermediate representation, measurement schema, baseline cases, and migration path into later production schemas. |
| `M05-W08` | Implement whole-document requirement/evidence planner | Rank requirements, retrieve synthetic approved evidence, allocate each supported requirement to the strongest location, expose gaps, set section/bullet/keyword/repetition/page budgets, and preserve chronology and locks. |
| `M05-W09` | Implement bounded writer and atomic claim verifier | Generate only planned candidate changes with evidence IDs; decompose names, dates, organizations, tools, actions, metrics, scope, and outcomes; block partial/unsupported/contradicted output; lint duplication, skills bloat, stale context, and coherence. |
| `M05-W10` | Implement controlled ATS-safe render and measured PageFit prototype | Build one production-intended single-column template, deterministic render/extraction validation, block measurement, content-utility scoring, fact-preserving shortening, mandated optimization order, typography floors, explanation, and correct two-page recommendation. |
| `M05-W11` | Execute blind and side-by-side resume benchmark | Compare original, keyword-stuffing, one-shot local-model, Simplify where manually captured, and product outputs. Run atomic-claim audit, keyword/repetition audit, render/extraction audit, PageFit utility retention, latency/memory tests, and blind human review. |
| `M05-W12` | Independent Resume Tailoring/PageFit Gate audit and decision | A separate high-capability session reproduces key cases, runs the owner-controlled holdout, audits model selection and every changed module, validates no unsupported claims or fact-changing compression, and records PASS, REDESIGN_REQUIRED, or BLOCKED with owner approval. |
| `M05-W13` | Define versioned platform model-runtime profiles | Add exact profile schema for OS/architecture/artifact/runtime/accelerator/driver/context/quantization/RAM/VRAM/license/digest/quality/latency/fallback metadata. Preserve the accepted Mac candidate as one profile, not a universal lock. |
| `M05-W14` | Validate Windows model-runtime capability and core fallback | On Windows 11 x64, prove profile-schema compatibility, runtime and accelerator detection, unsupported-hardware handling, explicit no-model behavior, and at least one feasible candidate GGUF smoke/structured-output run when suitable native hardware is available. Record candidates for later full certification; absence of a qualifying full-AI machine does not block Gate B. |
| `M05-W15` | Validate Ubuntu model-runtime capability and core fallback | On Ubuntu 24.04 x64, prove profile-schema compatibility, runtime and accelerator detection, unsupported-hardware handling, explicit no-model behavior, and at least one feasible candidate GGUF smoke/structured-output run when suitable native hardware is available. Record candidates for later full certification; absence of a qualifying full-AI machine does not block Gate B. |
| `M05-W16` | Implement cross-platform model capability UX and graceful degradation | Detect profile capability, memory/accelerator/runtime state, present exact remediation, prevent unsupported downloads, and keep deterministic core workflows usable when AI is unavailable. |

### Required verification

- Runtime unavailable UX, interrupted model download recovery, schema repair, injection cases, and no cross-request leakage.
- Comparative model quality, factuality, structured-output, memory, latency, and swap benchmarks on the primary Mac.
- Native Windows and Ubuntu capability/no-model artifacts and any available candidate-profile benchmark results using the same schemas and factuality thresholds; final full-AI acceptance remains owned by `M27-W10`.
- Explicit no-model and insufficient-hardware behavior leaves deterministic core workflows operational.
- Deterministic plan schema, requirement allocation, zero unsupported claims/skills, locks, chronology, and no keyword bloat.
- Render extraction order, clipping/overlap/missing glyph, PageFit fact preservation, utility retention, and correct two-page recommendations.
- Blind baseline/Simplify comparison, owner-controlled holdout, and independent audit.

### Milestone exit gate

The primary Mac model family and exact Mac profile are selected through comparative evidence and run alongside the desktop/browser on the M5/24 GB target. Windows and Ubuntu must already have the common profile contract, native capability detection, explicit no-model/insufficient-hardware behavior, and recorded candidate paths, but their final `CERTIFIED_FULL` profiles are not prerequisites for Gate B. `RESUME_PAGEFIT_FEASIBILITY` is `PASS` only when every resume/PageFit threshold, holdout, and independent review passes on the primary accepted profile. Only then may M06 become ready. At least one full-AI Windows profile and one full-AI Ubuntu profile remain mandatory before `CROSS_PLATFORM_CORE` can pass in `M27`.

### Prohibited shortcut

- Do not switch to a larger model merely because it can technically load.
- Do not use a one-shot “rewrite this resume” production path.
- Do not accept elegant prose with unverifiable claims.
- Do not shrink typography before content-level optimization.
- Do not tune expected results to the selected model.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md`, the resume gate report, model lock, `KNOWN_ISSUES.md`, and approved ADRs. It must record the exact gate bundle hash and run clean-clone verification.

---

## M06 — Canonical career evidence graph

**Dependencies:** M04, M01, M05 with `RESUME_PAGEFIT_FEASIBILITY = PASS`  
**Goal:** Implement the single source of truth that prevents hallucination and inconsistent applications.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M06-W01` | Implement evidence entities and repositories | Career facts, artifacts, spans, skills, skill evidence, relationships, provenance, approval, confidence, and supersession. |
| `M06-W02` | Implement fact lifecycle | Draft, approve, reject, correct, supersede, revoke, merge duplicates, and preserve audit history. |
| `M06-W03` | Implement conflict detection | Detect date overlaps, inconsistent titles, conflicting metrics, duplicate skills, and contradictory eligibility records. |
| `M06-W04` | Implement evidence query service | Typed filters and hybrid retrieval by entity, date, skill, job relevance, source, and approval state. |
| `M06-W05` | Build evidence UI | Create accessible list/detail/edit/review views, provenance display, conflict resolution, and bulk approval with safeguards. |
| `M06-W06` | Build evidence export | Export a human-readable evidence report and machine-readable archive. |

### Required verification

- Lifecycle/state tests.
- Conflict fixtures.
- Retrieval precision cases.
- Generated data cannot mutate facts.
- Audit history persistence.
- Accessibility tests.

### Milestone exit gate

A user can create, review, correct, approve, supersede, retrieve, export, and delete facts with complete provenance and no generated-content mutation path.

### Prohibited shortcut

Do not store resume bullets as unqualified canonical truth.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M07 — Resume and document import with fact-review workflow

**Dependencies:** M05, M06  
**Goal:** Turn existing resumes into reviewable candidate facts without silently trusting parsing or model inference.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M07-W01` | Implement secure file ingestion | Validate type, size, extension/content agreement, path handling, malware-risk boundaries, hashes, and encrypted storage. |
| `M07-W02` | Implement PDF/DOCX text and structure extraction | Extract pages, paragraphs, tables where safe, headings, links, and reading order; retain source spans. |
| `M07-W03` | Implement structured candidate extraction | Use deterministic parsing first and the local model for bounded schema extraction. Produce candidate facts with confidence and source spans. |
| `M07-W04` | Implement import review UI | Side-by-side source preview and extracted facts, confidence filters, conflict warnings, edit, approve, reject, and merge. |
| `M07-W05` | Handle failure modes | Scanned/garbled PDFs, unsupported fonts, encrypted files, duplicate uploads, malformed DOCX, and partial extraction. |
| `M07-W06` | Benchmark import | Measure extraction completeness and factual precision on the frozen corpus; add regression goldens. |

### Required verification

- Malicious/path traversal files.
- PDF/DOCX goldens.
- Source-span accuracy.
- Duplicate import idempotency.
- No auto-approval.
- Malformed file UX.

### Milestone exit gate

Imported documents produce reviewable candidate facts with accurate source spans; nothing becomes approved evidence without explicit approval.

### Prohibited shortcut

No OCR dependency or opaque cloud upload in the default path.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M08 — Complete profile, eligibility, preferences, onboarding, and voice samples

**Dependencies:** M06, M07  
**Goal:** Provide a comprehensive profile that supports resumes, matching, answers, autofill, and later job ranking.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M08-W01` | Build guided onboarding | Identity/contact, links, employment, education, projects, skills, certifications, and initial resume import without forcing every field. |
| `M08-W02` | Build explicit eligibility records | Authorization, sponsorship, location, relocation, travel, schedule, clearance, compensation units/ranges, and last-confirmed dates. |
| `M08-W03` | Build job preferences | Roles, levels, industries, locations, remote/hybrid/on-site, compensation, company constraints, technologies, and exclusions. |
| `M08-W04` | Build voluntary-demographic policy | Allow prefer-not-to-answer/default policies and application-scoped review. Never infer demographics. |
| `M08-W05` | Build voice-sample workflow | Collect user writing samples, accepted answers, style preferences, and banned phrases with deletion controls. |
| `M08-W06` | Profile completeness and freshness | Show actionable missing/expired records without coercive magic scores. |

### Required verification

- Sensitive record policy tests.
- Salary unit/currency tests.
- Expired confirmation behavior.
- No demographic inference.
- Onboarding resume/restart.
- Keyboard/screen-reader flow.

### Milestone exit gate

A new user can create a complete, auditable profile and explicit application policies without entering a terminal or exposing private data externally.

### Prohibited shortcut

Do not collapse all eligibility questions into one global yes/no.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M09 — Semantic resume schema, editor, versions, branching, and diffs

**Dependencies:** M05, M06, M08  
**Goal:** Productionize and extend the accepted M05 feasibility semantic model into a complete document model that remains factual and editable independent of visual layout.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M09-W01` | Productionize semantic resume schema | Migrate the accepted M05 feasibility subset without semantic regression; add header, summary, experience, education, projects, skills, certifications, custom sections, blocks, locks, evidence links, and display metadata. |
| `M09-W02` | Build resume-from-profile creation | Select approved evidence, preserve chronology, and create a draft with explicit user review. |
| `M09-W03` | Build semantic editor | Add/edit/reorder/hide/restore sections and bullets, evidence panel, unsupported-claim warnings, keyboard operations, and autosave. |
| `M09-W04` | Implement immutable versions and branches | Create variants, parent lineage, labels, compare, restore, and rollback without destructive overwrite. |
| `M09-W05` | Implement semantic diffs | Classify factual, wording, ordering, formatting, evidence, addition, and removal changes. |
| `M09-W06` | Protect locked content | User can lock facts, bullets, sections, wording, and order against AI or PageFit changes. |

### Required verification

- Schema invariants.
- Version lineage.
- Concurrent edit conflict.
- Diff goldens.
- Lock enforcement.
- Undo/redo and keyboard tests.

### Milestone exit gate

The user can construct and safely manage multiple evidence-linked resumes with immutable history and accurate semantic diffs.

### Prohibited shortcut

Do not make the rendered HTML the source of truth.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M10 — Deterministic resume rendering, ATS-safe template, PDF/DOCX export

**Dependencies:** M05, M09, M02  
**Goal:** Productionize the accepted M05 feasibility renderer and produce clean, reliable documents whose visible appearance and extracted text are both validated.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M10-W01` | Implement render intermediate representation | Convert semantic resume data to a stable layout model with typography tokens and deterministic ordering. |
| `M10-W02` | Productionize first ATS-safe template | Preserve the accepted M05 template behavior and add complete single-column sections, standard headings, readable typography, no hidden text, no icon-only contact data, and deterministic page breaks. |
| `M10-W03` | Implement live preview | Accurate page count, zoom, print dimensions, overflow indicators, and no mismatch between preview and export. |
| `M10-W04` | Implement PDF export | Pinned Chromium, deterministic CSS, font policy, metadata, and artifact hashing. |
| `M10-W05` | Implement DOCX export | Semantic headings/lists, stable text order, and acceptable visual parity. |
| `M10-W06` | Build document validation | Extract exported text, compare order/content, detect clipping/overflow/missing glyphs, and create visual regression snapshots. |
| `M10-W07` | Validate cross-platform rendering and bundled-font policy | Run PDF/DOCX semantic extraction and visual matrices on macOS, Windows, and Ubuntu using controlled fonts and pinned Chromium; test Unicode, long names/URLs, page breaks, fallback prevention, and platform-difference thresholds. |

### Required verification

- PDF/DOCX golden exports, round-trip extraction, page-size matrix, long URL/name cases, and visual regression.
- Controlled font/license manifest and explicit missing-font failure behavior.
- Cross-platform semantic extraction and visual parity on macOS, Windows, and Ubuntu.
- No platform-specific clipping, hidden text, missing glyph, or reading-order regression.

### Milestone exit gate

The supported template exports semantically equivalent PDF and DOCX files across all certified platforms with 100% expected text extraction order and zero clipping in the release matrix.

### Prohibited shortcut

Do not add more templates until the first template passes all gates.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M11 — Job capture, snapshotting, normalization, and requirement extraction

**Dependencies:** M05, M06; page capture is implemented as a contract and fixture input until M17 connects the browser extension  
**Goal:** Create trustworthy, versioned job records that all later matching and generation can depend on.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M11-W01` | Implement manual/paste capture | Capture text, URL, company/title/location metadata, source timestamp, and user corrections. |
| `M11-W02` | Implement page capture contract | Define sanitized DOM/text snapshot messages for the future extension; strip scripts, secrets, and unrelated page data. |
| `M11-W03` | Normalize job text | Remove navigation/boilerplate, preserve headings and source spans, normalize lists, compensation, locations, and workplace type. |
| `M11-W04` | Extract requirements | Must/preferred, skill/tool, years, education, certification, responsibility, location, compensation, authorization, schedule, and seniority with importance and spans. |
| `M11-W05` | Version and hash jobs | Create immutable job versions, detect changed descriptions, canonicalize URLs, and retain source provenance. |
| `M11-W06` | Evaluate parser | Precision/recall by requirement type, insufficient-evidence behavior, and prompt-injection adversarial cases. |

### Required verification

- HTML/text normalization goldens.
- Requirement extraction corpus.
- Compensation/location parsing.
- Version/hash behavior.
- Injection text ignored as instruction.
- Malformed page data.

### Milestone exit gate

Jobs are versioned, source-linked, and parsed into reviewable requirements with measured accuracy and no execution authority from page text.

### Prohibited shortcut

Do not treat all capitalized terms as required skills.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M12 — Explainable eligibility, evidence coverage, terminology, parseability, and readability

**Dependencies:** M09, M10, M11  
**Goal:** Replace opaque keyword scoring with dimensions the user can understand and act on.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M12-W01` | Implement eligibility evaluator | Hard conflicts, unknowns, confirmation-needed states, and evidence links for authorization, location, level, degree/certification, schedule, and compensation. |
| `M12-W02` | Implement evidence matcher | Hybrid exact/normalized/embedding retrieval with typed match strength and requirement importance weighting. |
| `M12-W03` | Implement terminology alignment | Count supported exact/normalized terminology without rewarding unsupported keyword stuffing. |
| `M12-W04` | Implement parseability checks | Section recognition, extraction order, contact visibility, date consistency, file type, and ATS-hostile layout patterns. |
| `M12-W05` | Implement readability checks | Density, repetition, vague claims, overly long bullets, inconsistent tense, and weak evidence. |
| `M12-W06` | Build explainable UI | Requirement-by-requirement evidence, gaps, uncertainty, suggested actions, and no false employer-score language. |

### Required verification

- Eligibility gate cases.
- Match precision corpus.
- Unsupported keyword no-credit test.
- Score monotonicity/invariants.
- Explainability links.
- Accessibility.

### Milestone exit gate

Every score and gap is traceable to job and evidence spans, hard conflicts are not hidden, and unsupported terms cannot improve evidence coverage.

### Prohibited shortcut

Do not label the summary as the employer’s ATS score.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M13 — Grounded whole-document resume tailoring

**Dependencies:** M05, M09, M11, M12  
**Goal:** Productionize and extend the accepted M05 whole-document planner/writer/verifier to generate stronger role-specific resumes without keyword stuffing, bloat, contradiction, or fabrication.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M13-W01` | Implement tailoring-plan schema | Requirement allocation, evidence IDs, target section, intended change, word budget, keyword budget, locks, and unresolved gaps. |
| `M13-W02` | Productionize planner | Reuse and extend the accepted M05 planner with full profile/job entities, whole-document assignment, strongest-evidence selection, repetition budget, chronology constraints, and page budget. |
| `M13-W03` | Implement candidate writer | Generate bounded candidates only for planned blocks and include evidence IDs. |
| `M13-W04` | Implement atomic claim verifier | Decompose names, dates, tools, actions, metrics, scope, and outcomes; block unsupported or contradicted claims. |
| `M13-W05` | Implement coherence and duplication lint | Repeated skills, inconsistent tense/title, conflicting metrics, bloated skills, generic language, and chronology errors. |
| `M13-W06` | Build review and accept UI | Side-by-side semantic diff, reason, evidence, confidence, accept/reject per change, accept all safe changes, and branch creation. |
| `M13-W07` | Evaluate against baseline | Blind factuality/relevance/coherence evaluation, unsupported-claim audit, and keyword-stuffing adversarial tests. |

### Required verification

- Zero unsupported claim corpus.
- Lock preservation.
- No append-only bloat.
- Duplicate keyword budget.
- Stale data/contradiction cases.
- Deterministic plan schema.

### Milestone exit gate

Release corpus has zero unsupported claims, no unjustified repeated insertion, preserved page/word budgets, and a human-preference win over the frozen baseline.

### Prohibited shortcut

Do not repair unsupported claims by inventing softer wording.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M14 — One-page optimization and document quality optimizer

**Dependencies:** M05, M10, M12, M13  
**Goal:** Productionize and extend the accepted M05 measured PageFit architecture while preserving readability, evidence, and user control.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M14-W01` | Implement measured layout model | Capture block heights, page breaks, overflow, orphan headings, and layout constraints from the renderer. |
| `M14-W02` | Productionize content utility scoring | Preserve and recalibrate the accepted M05 formula using full relevance, evidence, impact, recency, differentiation, redundancy, risk, and length cost data. |
| `M14-W03` | Implement bounded shortening | Fact-preserving clause and bullet shortening with claim re-verification. |
| `M14-W04` | Implement optimization search | Apply content and layout operations in mandated order, preserve locks, and stop at readability floors. |
| `M14-W05` | Build change explanation and undo | Show removed/shortened content, utility reason, readability changes, and restore options. |
| `M14-W06` | Evaluate PageFit | One-page success, readability, information retention, extraction, and visual defects across the corpus. |

### Required verification

- Guardrail invariants.
- Locked content.
- Fact preservation after shortening.
- No clipping/overlap.
- Two-page recommendation cases.
- Visual regression.

### Milestone exit gate

One-page outputs meet layout floors, preserve all remaining facts, have zero clipping, and outperform naive font/spacing compression in blind readability review.

### Prohibited shortcut

No hidden text, negative margins, or font below the configured floor.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M15 — Evidence-backed cover-letter system

**Dependencies:** M05, M06, M11, M12  
**Goal:** Generate specific, natural cover letters without fabricated company facts or generic filler.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M15-W01` | Define cover-letter schema and versions | Paragraph roles, evidence links, job/company sources, locks, length, and immutable lineage. |
| `M15-W02` | Implement paragraph planner | Opening rationale, two evidence-backed fit paragraphs, optional values/context paragraph, and closing. |
| `M15-W03` | Implement writer and verifier | Use only approved evidence and job/company source text; verify every factual statement and stale-context reference. |
| `M15-W04` | Implement editor/templates/export | Structural templates, semantic editing, PDF/DOCX/text export, and document selection for applications. |
| `M15-W05` | Evaluate naturalness and specificity | Cliché lint, stale-company traps, factuality, length, and blind preference. |

### Required verification

- Wrong company/location traps.
- Unsupported company claim block.
- Evidence links.
- Versioning/export.
- Exact length.
- Preference evaluation.

### Milestone exit gate

Cover letters have zero stale-company leakage and unsupported claims and beat the generic baseline on blind specificity/naturalness review.

### Prohibited shortcut

Do not browse or invent company facts without a verified source stored with the job.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M16 — Short-answer generation, semantic memory, voice adaptation, and batch review

**Dependencies:** M05, M06, M08, M11  
**Goal:** Produce high-quality, non-generic application answers while preventing unsafe reuse and factual errors.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M16-W01` | Implement question taxonomy and policy | Intent, sensitivity, jurisdiction, answer type, automation policy, expected evidence, and exact constraints. |
| `M16-W02` | Implement evidence/context retrieval | Retrieve approved evidence, current job/company/role context, relevant accepted answers, and contradiction candidates. |
| `M16-W03` | Implement plan/write/verify pipeline | Structured plan, natural draft, claim verification, stale-context check, contradiction check, cliché/style lint, and exact-length validator. |
| `M16-W04` | Implement semantic answer memory | Embeddings, intent clusters, context fingerprint, freshness, accepted/user-edited variants, and safe reuse/regeneration rules. |
| `M16-W05` | Implement voice profile | Infer bounded style attributes from samples/edits, expose controls, and prevent factual carryover. |
| `M16-W06` | Build answer UI | Generate one, batch inventory, per-answer confidence/status, compare variants, edit, accept, insert, and save memory. |
| `M16-W07` | Evaluate answers | Paraphrase retrieval, stale context, sensitive blocks, exact limits, unsupported claims, longitudinal edit distance, and blind preference. |

### Required verification

- Question intent corpus.
- Sensitive policy.
- Semantic paraphrase clusters.
- Stale company/role/location.
- Exact length property tests.
- Zero unsupported claims.
- Voice deletion.

### Milestone exit gate

Answer corpus has zero stale-context leakage and unsupported facts, exact limits pass, sensitive questions obey policy, and blind preference beats one-shot baseline.

### Prohibited shortcut

Do not optimize for AI-detector evasion.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M17 — Production Manifest V3 extension foundation and secure native transport

**Dependencies:** M01, M02 with `AUTOFILL_FEASIBILITY = PASS`, M03  
**Goal:** Productionize the accepted M02 extension and connect it securely to the local app through platform-correct native messaging on macOS, Windows, and Ubuntu.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M17-W01` | Productionize WXT extension | Migrate the accepted M02 feasibility extension into the production build; add side panel/popup foundation, release configuration, strict CSP, no remotely hosted code, and preserve the real Playwright harness. |
| `M17-W02` | Implement permission strategy | Use activeTab/optional host permissions where feasible, explain grants, support per-site disable, and preserve feasibility dry-run permissions separately from production grants. |
| `M17-W03` | Implement message schemas and validators | Content-script to service-worker and service-worker to native-host contracts with size/capability limits; preserve per-frame identity and deny submit capability to content scripts. |
| `M17-W04` | Implement Rust native host | Registration, extension allowlist, session handshake, loopback proxy, redaction, timeouts, bounded reconnect, and no selector/value arbitrary command channel. |
| `M17-W05` | Implement extension status UI | Desktop connection, site support, measured tenant pattern, profile/model readiness, permissions, diagnostics, and no private data shown unnecessarily. |
| `M17-W06` | Extend real extension E2E harness | Load the packaged extension in Playwright, retrieve extension ID, test service worker, frame agents, document IDs, content script, side panel, native-host mock, sleep/restart, and rerun the complete accepted M02 autofill gate regression including the Workday challenge slice. |
| `M17-W07` | Implement macOS native-host registration lifecycle | Install/verify/repair/remove the absolute-path host manifest in supported Chrome locations; test extension allowlist, permissions, updates, uninstall, and synthetic packaged E2E. |
| `M17-W08` | Implement Windows native-host registration and binary protocol | Register the host manifest through the correct HKCU/HKLM policy decision, verify extension origin, use binary stdin/stdout length framing, handle install paths with spaces, and test repair/update/uninstall. |
| `M17-W09` | Implement Ubuntu native-host registration lifecycle | Install/verify/repair/remove the absolute-path user/system manifest according to the package mode; validate executable permission, Chrome location, update, and uninstall. |
| `M17-W10` | Run cross-platform real extension/native-host E2E | On all certified platforms load the built MV3 extension in Chrome/Chromium test harness, connect the real platform host, exercise service-worker restart and typed health messages, and prove no privileged content-script path. |

### Required verification

- All accepted M02 feasibility cases remain green.
- Forged/wrong-extension/oversized messages are rejected; no remote code or content-script privileged/submit capability.
- Service-worker sleep/restart, permission grant/revoke, frame identity, and Workday session/document identity recovery.
- Platform-native host registration, verify, repair, update, and uninstall tests.
- Windows registry and binary-mode length-framing behavior.
- Real extension-to-native-host E2E on macOS, Windows, and Ubuntu.

### Milestone exit gate

The packaged extension securely exchanges typed requests with the correct local native host on all certified platforms, survives service-worker suspension, preserves the accepted autofill core, and leaves no stale registration after uninstall.

### Prohibited shortcut

No broad permanent host access without documented necessity, and no replacement of accepted M02 core modules without an approved ADR and complete gate rerun.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md` if regression status changes, `KNOWN_ISSUES.md`, and approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M18 — Production field ontology, form engine, resolver, transactional drivers, and review panel

**Dependencies:** M02 with `AUTOFILL_FEASIBILITY = PASS`, M08, M16, M17  
**Goal:** Integrate the accepted M02 scanner/resolver/driver architecture with real profile, evidence, answer, document, policy, and extension systems before production ATS adapters, with Workday as the first production stress case.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M18-W01` | Productionize field ontology and contracts | Preserve accepted M02 concepts, FieldAddress, descriptors, driver/result schemas, and add complete identity, address, links, employment, education, eligibility, demographics, salary, documents, narrative, unknown, and prohibited concepts. |
| `M18-W02` | Productionize scanner and field re-resolution | Integrate accepted frame-local bounded scanning with real extension sessions, application context, route generations, required/visible/enabled semantics, iframe/shadow metadata, and stable diagnostics. |
| `M18-W03` | Productionize deterministic resolver | Integrate real profile/evidence sources, rules, aliases, negative patterns, option semantics, section context, confidence calibration, and reviewed model fallback only for unresolved cases; deterministic results remain monotonic. |
| `M18-W04` | Productionize transactional control drivers | Extend accepted native/framework text, selects, radios, checkboxes, dates, comboboxes, virtualized lists, repeaters, textareas, uploads, and the research Workday control primitives; verify persistence and site acceptance, implement undo, and prevent unrelated-option fallback. |
| `M18-W05` | Implement production decision engine | Bind canonical profile source, sensitivity policy, confirmation freshness, confidence thresholds, propose/pause/skip/block, provenance, and exact artifact selection. |
| `M18-W06` | Build review panel | Filled, review, sensitive, unsupported, required unresolved, page-changed value, undo, highlight field, apply proposal, and complete post-fill reconciliation. |
| `M18-W07` | Benchmark production generic engine | Rerun the entire M02 development and holdout gate, add real profile/policy cases, enforce precision/recall/safety/performance, and prevent regression before adapters proceed. |

### Required verification

- Entire accepted M02 autofill corpus and hidden holdout regression.
- Ontology/resolver corpus.
- Framework input events and post-rerender persistence.
- Honeypot never filled.
- Sensitive false-fill zero.
- Undo.
- Required-field reconciliation.
- Deterministic-result preservation under model failure.
- Bounded mutation/performance budgets.
- p95 scan/fill latency.
- Workday challenge regression, including repeaters, upload/parser interaction, step classification, and bounded observation.

### Milestone exit gate

The production generic engine meets >=99.5% precision, >=97% required recall on supported fixtures, zero sensitive/prohibited false fills, no honeypot fills, no silent required omissions, and no regression against the accepted M02 gate. It is ready for Workday productionization in `M19`; Greenhouse/Lever/Ashby are not yet eligible.

### Prohibited shortcut

Do not call the main model for every ordinary field, do not replace semantic identity with selectors, and do not weaken the M02 gate to accommodate production integration.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md` if regression status changes, `KNOWN_ISSUES.md`, and approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M19 — Workday production adapter foundation, tenant taxonomy, and complete field coverage

**Dependencies:** M02 with `AUTOFILL_FEASIBILITY = PASS`, M11, M16, M18  
**Goal:** Productionize Workday as the first supported ATS, proving accurate field coverage, repeaters, uploads, validation, session boundaries, and performance before automatic page navigation or any other production ATS adapter begins.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M19-W01` | Productionize the Workday tenant-pattern taxonomy | Convert M02 research evidence into versioned tenant/layout/locale/session patterns. Record host family, route family, step sequence, control families, account boundaries, browser/adapter versions, public evidence, known limitations, and certification state. |
| `M19-W02` | Implement Workday detection and candidate-session boundaries | Detect job/application identity, guest/authenticated/returning-candidate modes, login, create-account, email-verification, MFA, CAPTCHA, privacy/terms, session-expired, and duplicate-application boundaries. Preserve state and pause; never automate protected boundaries. |
| `M19-W03` | Implement multi-signal Workday step classification and state machine | Classify application steps from route/document identity, progress, accessible headings, control concepts, navigation semantics, tenant pattern, and transition history. Track document/page generation and pause on ambiguous or contradictory state. |
| `M19-W04` | Implement core information and locale-aware controls | Identity, contact, address, country/region, phone, dates, links, availability, location, compensation, and tenant-specific ordinary fields across measured locale patterns. Reuse generic drivers only where postconditions prove equivalence. |
| `M19-W05` | Implement Workday repeater controller | Work experience, education, skills, languages, certifications, websites, and tenant-defined repeaters with stable semantic item keys, add/edit reconciliation, duplicate prevention, parser interaction, rerender handling, and safe preservation of existing user entries. |
| `M19-W06` | Implement exact document upload and resume-parser reconciliation | Attach the exact versioned resume/cover letter artifact, verify the displayed file, wait for upload/parser settlement, compare parser-created data to approved facts, resolve duplicates/conflicts, and block progression while reconciliation is incomplete. |
| `M19-W07` | Implement questions, eligibility, consent, and disclosures | Screening, authorization, sponsorship, export-control, salary, relocation, schedule, custom narrative, consent, voluntary demographic, self-identification, and jurisdiction-sensitive controls with explicit policies and zero inference for consequential answers. |
| `M19-W08` | Implement conditional discovery, validation reading, and page reconciliation | Handle controls added after answers, Workday validation summaries and inline errors, page-changed values, stale resolution, required-field inventory, exact answer/document state, and complete manual-assist readiness reporting. |
| `M19-W09` | Implement Workday diagnostics, performance, and recovery foundation | Bounded observers, nodes/scan/action metrics, long-session memory instrumentation, content-script reinjection, service-worker restart, local-service restart, reload, back navigation, session timeout, and drift detection without duplicate actions. |
| `M19-W10` | Execute Workday field-coverage matrix | Run the complete M02 Workday challenge regression plus the production synthetic matrix, owner-controlled holdout, public no-submit structural dry-runs, upload/parser cases, repeaters, locales, validation, and fault injection. Record raw counts and artifacts. |
| `M19-W11` | Independent Workday field-coverage audit | A separate clean session or Codex worktree audits every Workday file, reproduces field/repeater/upload/session positive and negative cases, inspects real browser behavior, validates compatibility claims, and confirms readiness for guided navigation or records defects/redesign. |

### Required verification

- At least 40 synthetic Workday tenant/layout variants and 3,000 scored controls.
- Real built Manifest V3 extension in bundled Playwright Chromium with actual service worker and frame agents.
- Multi-signal tenant/session/step classification; raw-selector-only and single-signal classifiers rejected.
- Guest/authenticated/returning-candidate and protected-boundary cases.
- Exact document attachment and resume-parser reconciliation.
- Work, education, skill, language, certification, website, and tenant-defined repeater cases.
- Zero automation-created duplicate repeater items.
- Framework and Workday values persist after rerender and page revisit.
- Conditional questions and validation rejection.
- Sensitive/prohibited false-fill count zero.
- Required unresolved fields reported 100%.
- Reload, back, service-worker, local-service, and session-timeout recovery.
- Long-session observer/memory soak with no confirmed monotonic leak.
- Owner-controlled holdout and independent audit.
- No automated `Next` or submit action in M19 acceptance tests except isolated navigation-driver fixtures that cannot reach live submission.

### Milestone exit gate

Workday manual-assist field coverage meets at least 99.5% attempted-fill precision and 97% required ordinary-field recall on declared patterns, with zero sensitive false fills, zero duplicate repeaters, exact document verification, no silent required omissions, bounded performance, valid holdout evidence, and independent approval that the field/state architecture is ready for `M20`.

`WORKDAY_GUIDED_PRE_SUBMIT` remains `IN_PROGRESS` or `NOT_EVALUATED`; M19 alone does not authorize automatic page progression or other production ATS expansion.

### Prohibited shortcut

- Do not claim all Workday tenants are supported.
- Do not automate credentials, account creation, email verification, MFA, CAPTCHA, or unexpected legal acceptance.
- Do not hide parser-created duplicates or overwrite existing user data to improve recall.
- Do not implement automatic page progression before M20's page-readiness and navigation contracts.
- Do not begin Greenhouse, Lever, or Ashby production work.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md`, the Workday gate report, `KNOWN_ISSUES.md`, and approved ADRs. It must run the complete M02 autofill regression, clean Workday field matrix, holdout, and independent audit and record the exact evidence-bundle hash.

---

## M20 — Workday guided pre-submit navigation, end-to-review automation, and production certification

**Dependencies:** M19 accepted; M16, M18  
**Goal:** Deliver the requested Workday experience: after the user opens a certified application, either auto-start under prior revocable consent or start the current run, then automatically fill and verify every safe page, click `Next` safely through the application, stop at the correct final review page, and require the user to review and click submit.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M20-W01` | Define `GUIDED_PRE_SUBMIT` contracts and user consent | Define `MANUAL_START` and revocable `AUTO_START_ON_OPEN` triggers, consent scope/expiry, visible countdown/cancel, application/session binding, plan hash, permitted actions, intervention classes, cancellation, manual-mode fallback, no-submit capability boundary, and user-facing explanation. |
| `M20-W02` | Implement Workday page-readiness proof | Produce a typed proof for the current document/page generation covering step confidence, every visible required field, rerender persistence, validation, conditional-settle state, upload/parser status, repeaters, sensitive confirmations, and unique enabled `Next` control. |
| `M20-W03` | Implement idempotent Workday navigation driver | Re-resolve the navigation control, reject final submit, click once per page generation/proof hash, block concurrent actions, confirm transition from independent signals, classify validation/no-transition/ambiguous outcomes, and never blind-retry. |
| `M20-W04` | Implement complete fill-verify-next loop | Scan, resolve, fill, verify, reconcile, prove readiness, navigate, confirm the next step, checkpoint, and repeat until pause, failure, cancellation, or certified final review. Prevent stale actions across document/page generations. |
| `M20-W05` | Implement intervention and resume workflow | Pause for login, account creation, email verification, MFA, CAPTCHA, unexpected terms, new sensitive questions, missing evidence, ambiguity, unsupported controls, validation rejection, session timeout, or tenant drift. Preserve state and resume only after reclassification and revalidation. |
| `M20-W06` | Implement final-review detection and cross-page audit | Detect review independently of the submit control, reconcile displayed review values against the frozen plan, show every fact/answer/document/sensitive decision/navigation step, flag values Workday does not expose, and stop before submission. |
| `M20-W07` | Implement user controls and safe handoff | Pause, resume, cancel, disable auto-next, switch to manual assist, inspect current step/readiness proof, return to a prior page where safe, and let only the user activate final submit. Observe receipt/failure afterward without treating the click as success. |
| `M20-W08` | Implement checkpointing and fault recovery | Checkpoint after each verified page/confirmed transition; recover from content-script reinjection, service-worker suspension, local-service restart, reload, back, browser restart where supported, delayed transitions, validation loops, and session expiration without repeated destructive action. |
| `M20-W09` | Build Workday guided-flow fixture, holdout, and soak matrix | Add manual-start, consent expiry/revocation, auto-start-on-open, cancel countdown, uncertified-page no-start, navigation, final-review, login/boundary, validation, no-transition timeout, ambiguous button, duplicate prevention, upload/parser, multi-locale, and fault-injection flows. Run at least 100 navigation transactions, 20 repeated full flows, and the defined long-session soak. |
| `M20-W10` | Execute controlled end-to-review and Simplify comparison | Run at least the defined owner-controlled end-to-review set without automated submission, public no-submit structural checks, hidden holdout, and same-input manual Simplify comparison. Record manual corrections, progression, pauses, timings, and raw field/navigation outcomes. |
| `M20-W11` | Independent Workday Gate C audit and owner decision | A separate clean Claude Max session or GPT-5.6 Ultra Codex worktree re-reads the specification, audits every changed file, reruns fresh positive/negative paths and holdout, manually inspects browser traces and final review, validates the Simplify comparison, and records `PASS`, `REDESIGN_REQUIRED`, or `BLOCKED` with owner approval. |

### Required verification

- Correct trigger and job/application/session binding: either one-time `MANUAL_START` or valid prior `AUTO_START_ON_OPEN` consent.
- Auto-start never runs on an uncertified, stale, protected-boundary, or not-ready page; the visible cancel window and immediate disable control work.
- No guided run on an uncertified tenant pattern or stale plan.
- Page-readiness proof rejects every unresolved, changed, invalid, uploading, ambiguous, or unconfirmed state.
- Exactly one `Next` action per page generation/readiness proof.
- Final submit controls are never mistaken for `Next`.
- No repeated click after timeout or ambiguous transition.
- Transition confirmation precedes all next-page actions.
- Conditional pages, validation loops, optional skipped pages, and locale-specific sequences.
- Login/account/MFA/email/CAPTCHA/terms boundaries pause and never bypass.
- Final review reached on every certified fixture flow.
- Cross-page review inventory matches the frozen application plan.
- `GUIDED_PRE_SUBMIT` activates zero final submit controls.
- User pause/cancel/manual-mode switch works at every defined safe point.
- Reload, back, service-worker/local-service restart, delayed navigation, browser restart where supported, and session timeout recovery.
- Zero automation-created duplicate repeater items.
- Exact document attachment preserved across progression.
- At least 24 public structural dry-runs, 12 controlled end-to-review runs, 20% hidden holdout, 100 navigation transactions, repeated full-flow soak, and 45-minute long-session soak as defined.
- Same-input Simplify comparison.
- Complete M02 and M19 regression remains green.
- Independent audit and owner decision.

### Milestone exit gate

`WORKDAY_GUIDED_PRE_SUBMIT = PASS` only when every Section 2.3 Gate C threshold passes, the Workday field matrix remains green, the hidden holdout is valid, certified flows reach final review without manual data entry except documented protected/uncertain boundaries, final submit is never automated, Simplify comparison is non-inferior on accuracy with equal or better uncertainty reporting, and the independent reviewer plus owner approve the evidence.

Only then may `M21` become `READY`.

### Prohibited shortcut

- Do not click `Next` based only on visibility or enabled state.
- Do not infer success from a click, URL change alone, or one DOM value.
- Do not repeat navigation blindly.
- Do not automate protected authentication or CAPTCHA boundaries.
- Do not click final submit in guided mode.
- Do not reduce the Workday matrix or gate thresholds to start other ATS work.
- Do not claim universal Workday support.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md`, `CRITICAL_GATES.md`, `docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md`, `KNOWN_ISSUES.md`, and approved ADRs. It must record the complete Gate C evidence bundle, independent review, holdout hash, Simplify comparison, owner decision, and next permitted action.

---

## M21 — Greenhouse adapter

**Dependencies:** M02, M11, M18, M20 with `WORKDAY_GUIDED_PRE_SUBMIT = PASS`  
**Goal:** Deliver the first non-Workday production ATS integration after the Workday gate, proving that the adapter architecture generalizes without degrading Workday or the accepted generic autofill core.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M21-W01` | Create adapter detection and job metadata | Detect Greenhouse-hosted/embedded variants, canonical job ID/URL, title/company/location, and job text. |
| `M21-W02` | Implement field mapping | Profile, employment, education, links, eligibility, demographic, custom questions, and validation errors across fixture variants. |
| `M21-W03` | Implement document upload | Select exact artifact version, replace safely, verify filename/attachment state, and avoid stale resume uploads. |
| `M21-W04` | Implement dynamic question handling | Rescan after selections, handle conditional fields, and integrate answer generation/review. |
| `M21-W05` | Implement receipt detection | Recognize confirmation states/text/URL, capture evidence, and distinguish validation failure. |
| `M21-W06` | Validate real public pages in dry-run | Low-volume, no-submit checks with synthetic data on varied public pages; sanitize fixtures derived from structure. |

### Required verification

- Multiple tenant layouts.
- Conditional fields.
- File upload.
- Validation messages.
- Receipt/failed submit distinction.
- No live submission in CI.
- Complete Workday/M02 regression remains green.

### Milestone exit gate

Greenhouse compatibility meets release precision/recall targets across measured fixtures and documented real dry-runs, and the complete Workday/M02 regression remains green.

### Prohibited shortcut

Do not use employer/private Greenhouse credentials or APIs.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M22 — Lever adapter

**Dependencies:** M02, M18, M20 with `WORKDAY_GUIDED_PRE_SUBMIT = PASS`, M21 patterns  
**Goal:** Add Lever after certified Workday and Greenhouse, proving that the adapter abstraction generalizes across another independent ATS family without degrading either accepted integration.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M22-W01` | Implement detection/job capture | Lever hosted/embedded variants, canonical posting ID, job snapshot, and metadata. |
| `M22-W02` | Implement fields and custom questions | Profile, links, work history, uploads, consent, eligibility, narrative, and dynamic custom controls. |
| `M22-W03` | Implement validation and receipt | Page errors, attachment verification, success/duplicate states, and exact tracker events. |
| `M22-W04` | Build fixture and real dry-run matrix | Tenant variants, mobile-width behavior if relevant, and failure cases. |
| `M22-W05` | Refactor only proven common abstractions | Remove duplication proven across Workday, Greenhouse, and Lever without forcing incompatible site behavior into generic code. |

### Required verification

- Lever fixture matrix.
- Custom questions.
- Uploads.
- Duplicate/receipt.
- Adapter isolation.
- Regression against Workday and Greenhouse.

### Milestone exit gate

Lever meets the same precision, omission, upload, and receipt gates without degrading Workday or Greenhouse.

### Prohibited shortcut

No premature generic abstraction that hides site-specific failure behavior.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M23 — Ashby adapter

**Dependencies:** M02, M18, M20 with `WORKDAY_GUIDED_PRE_SUBMIT = PASS`, M21, M22  
**Goal:** Add Ashby after Workday, Greenhouse, and Lever; complete the initial cross-ATS production matrix and validate embedded/custom form handling without regressing earlier adapters.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M23-W01` | Implement detection/job capture | Ashby-hosted and embedded variants, posting ID, compensation metadata where public, and job snapshot. |
| `M23-W02` | Implement form mapping | Core fields, custom questions, structured selects, consent, demographic controls, and conditional logic. |
| `M23-W03` | Implement uploads and validation | Exact artifacts, upload state, client-side errors, and final reconciliation. |
| `M23-W04` | Implement receipt and duplicate detection | Confirmation evidence and job/application identifiers. |
| `M23-W05` | Complete initial adapter matrix | Publish measured coverage, known limitations, and unsupported variants rather than claiming universal support. |

### Required verification

- Ashby fixture matrix.
- Embedded form.
- Conditional questions.
- Uploads.
- Receipt.
- Regression Workday and all initial non-Workday adapters.

### Milestone exit gate

Workday remains green, and Greenhouse, Lever, and Ashby all satisfy their supported-pattern gates with honest compatibility documentation.

### Prohibited shortcut

Do not mark an untested tenant variant supported.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M24 — Multipage flows, document/answer selection, dynamic forms, and complete application review

**Dependencies:** M16, M18–M23  
**Goal:** Turn page-level autofill into a reliable end-to-end manual application assistant across all accepted ATS adapters while preserving the certified Workday guided pre-submit path.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M24-W01` | Implement application-page state machine | Route/page identity, scan/fill/reconcile/review states, navigation, reload, back, and resume after service-worker restart. |
| `M24-W02` | Implement application context | Bind current job version, selected resume/cover letter, answer set, and user policy to a tab/session. |
| `M24-W03` | Implement page-level question inventory | Detect all narrative questions, generate selected/all, show exact limits, and insert accepted answers. |
| `M24-W04` | Implement document chooser | Default selection rules, job-specific variants, attachment verification, and stale-artifact warnings. |
| `M24-W05` | Implement final review | Cross-page summary of fields, sensitive confirmations, answers, documents, unresolved required fields, and duplicate status. |
| `M24-W06` | Implement manual submission handoff | For this milestone the user clicks submit; capture resulting receipt/failure and tracker event. |

### Required verification

- Multipage reload/back.
- Service-worker suspension.
- Context isolation across tabs.
- Wrong-document prevention.
- Cross-page unresolved field.
- Manual receipt capture.
- Workday guided-pre-submit regression and final-review boundary remain green.

### Milestone exit gate

A user can complete supported applications end-to-end with full review, correct artifacts/answers, no silent omissions, and receipt capture while retaining manual submit control; Workday can additionally reach final review through its certified guided flow without automating submit.

### Prohibited shortcut

Auto-submit is not enabled in this milestone.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M25 — Application tracker, exact snapshots, receipts, duplicates, filters, and analytics

**Dependencies:** M09–M24  
**Goal:** Create a trustworthy application history independent of email access.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M25-W01` | Implement event-sourced application model | Saved, approved, queued, applying, applied, screen, interview, offer, rejection, withdrawn, failed, archived, with legal transitions. |
| `M25-W02` | Implement exact snapshots | Resume, cover letter, answers, field decisions, job version, adapter version, and policy snapshot with hashes. |
| `M25-W03` | Implement receipt vault | Confirmation text/URL/IDs/timestamp/screenshot metadata where user permits, and confidence/source. |
| `M25-W04` | Implement duplicate detection | Company, requisition/ATS ID, canonical URL, title/location, description hash, and prior receipt. |
| `M25-W05` | Build tracker UI | List/board views, filters, saved filters, favorites, archive, detail timeline, manual status changes, and document/answer links. |
| `M25-W06` | Implement CSV import/export | Mapping preview, dedupe, validation, export manifest, and no silent data loss. |
| `M25-W07` | Implement honest analytics | Funnel, response rate, time-to-stage, resume variant, source, cohort/date filters, sample-size warnings, and no causal claims. |

### Required verification

- State transition invariants.
- Snapshot immutability.
- Receipt confidence.
- Duplicate corpus.
- CSV round trip.
- Analytics calculations.
- Deletion/export.

### Milestone exit gate

Every supported manual application has a complete, immutable, inspectable history and cannot be marked submitted without evidence or explicit confirmation.

### Prohibited shortcut

Do not infer rejection/interview from email because email integration is excluded.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M26 — Job-specific interview practice and evidence-aware feedback

**Dependencies:** M06, M11, M16  
**Goal:** Provide interview practice that improves structure and evidence use without inventing experience.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M26-W01` | Generate question sets | Behavioral, role-specific, technical/conceptual, motivation, gap, and follow-up questions from the current job and evidence. |
| `M26-W02` | Capture responses | Typed response first; optional local audio transcription only through an approved later sub-feature. |
| `M26-W03` | Implement feedback rubric | Relevance, evidence, specificity, structure, concision, missing context, unsupported claim, and suggested follow-up. |
| `M26-W04` | Implement improvement loop | User revises answer, compares versions, saves approved examples, and never promotes invented feedback to evidence. |
| `M26-W05` | Evaluate feedback | Expert-authored rubric cases, hallucination traps, and usefulness preference tests. |

### Required verification

- Question relevance.
- Unsupported claim detection.
- Feedback schema.
- Version comparison.
- No evidence mutation.
- Accessibility.

### Milestone exit gate

Interview feedback is job-specific, evidence-linked, and never encourages unsupported claims in the evaluation corpus.

### Prohibited shortcut

Do not score personality or protected traits.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M27 — Security, privacy, prompt-injection, performance, accessibility, diagnostics, and packaging hardening

**Dependencies:** M03–M26  
**Goal:** Harden security, privacy, performance, accessibility, diagnostics, platform packaging, and updates; pass the Cross-Platform Core Gate before closed alpha.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M27-W01` | Threat-model review | Update data-flow and attack trees for extension compromise, malicious page, model injection, document parser, native host, local API, artifact store, and update chain. |
| `M27-W02` | PII-safe logging and diagnostics | Structured redaction, user-previewed diagnostic bundle, opt-in support export, and secret/PII scanners. |
| `M27-W03` | Prompt-injection hardening | Adversarial jobs/forms/documents, system/data delimiters, no tool authority, and deterministic policy enforcement. |
| `M27-W04` | Performance and memory | Profile desktop, extension, model, renderer, and long sessions on M5/24 GB; enforce budgets and observer cleanup. |
| `M27-W05` | Accessibility | Keyboard, focus, labels, contrast, zoom, screen-reader smoke, reduced motion, error announcement, and extension panel usability. |
| `M27-W06` | Crash recovery and data integrity | Forced termination during edit, model generation, upload, fill, migration, and receipt capture. |
| `M27-W07` | macOS packaging | Preserve the original signed/notarization-ready macOS packaging scope and complete the macOS arm64 release candidate: app/DMG, bundled runtime resources, Keychain/native-host setup, install/upgrade/rollback/uninstall tests, and synthetic data-preservation evidence. |
| `M27-W08` | Package, sign, and validate Windows x64 release candidate | Build signed NSIS or MSI artifact according to ADR, install WebView2/runtime prerequisites safely, register native host, integrate Credential Manager/DPAPI, and test install/repair/upgrade/rollback/uninstall without data loss. |
| `M27-W09` | Package and validate Ubuntu x64 release candidate | Build certified `.deb` and optional AppImage, validate WebKitGTK/Secret Service/Chrome dependencies, native-host manifest and permissions, and install/upgrade/rollback/uninstall behavior. |
| `M27-W10` | Finalize full-AI platform profiles, diagnostics, and support publication | On native Windows 11 x64 and Ubuntu 24.04 x64 hardware, benchmark and accept at least one full-AI model/runtime profile per operating system using the frozen factuality and structured-output corpus; retain certified-core/no-model fallbacks. Expose certified/experimental/unsupported OS, architecture, Chrome, webview, secret store, native host, model profile, installer, update, and known-limitation status; never infer support from compilation. |
| `M27-W11` | Implement signed cross-platform update and rollback | Use platform/architecture-targeted signed update metadata, interrupted-update recovery, rollback, version/schema compatibility checks, and native-host/extension coordination on all certified platforms. |
| `M27-W12` | Independent Cross-Platform Core Gate audit and decision | A separate session audits native packages and evidence on all certified targets, reruns required install/lifecycle/security/native-host/model/document/backup/update cases, validates support claims, and records PASS, REDESIGN_REQUIRED, or BLOCKED with owner approval. |

### Required verification

- Security, PII leak, injection, memory/observer, Workday long-session, crash-recovery, and accessibility suites.
- Native packaged install/launch matrix on macOS arm64, Windows x64, and Ubuntu x64.
- Secret-store, native-host, document/font, backup/restore, model capability, accepted full-AI Windows/Ubuntu profiles, installer, update, rollback, repair, and uninstall evidence.
- Signed/verified artifact and update metadata checks.
- Independent `CROSS_PLATFORM_CORE` audit and owner decision.

### Milestone exit gate

No critical or high defect remains; all core workflows work in native packages on every certified target; at least one full-AI model/runtime profile is accepted for each certified operating system while certified-core/no-model behavior remains safe; private data is absent from diagnostics by default; performance/accessibility budgets pass; and `CROSS_PLATFORM_CORE = PASS`.

### Prohibited shortcut

Do not add private-content telemetry or mark Gate D passed from CI compilation, cross-compilation, containers, emulation, or one operating system. Native packaged evidence for all three targets is required.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M28 — Core closed-alpha acceptance gate

**Dependencies:** M00–M27 with `CROSS_PLATFORM_CORE = PASS`  
**Goal:** Prove the complete non-autopilot product is genuinely usable and superior on its core trust dimensions before broad ATS and job-index work.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M28-W01` | Run frozen corpus | Execute all resume, answer, match, render, extension, tracker, security, performance, accessibility, and all four critical-gate regression suites from clean clones and packaged platform fixtures, including owner-controlled holdouts. |
| `M28-W02` | Manual side-by-side evaluation | Terms-compliant same-input comparison on user-owned examples against current Simplify behavior and the frozen legacy baseline; record field/document methodology, raw outcomes, and blinded ratings. |
| `M28-W03` | External alpha pilot | Small consented cohort using synthetic or their own data; collect structured defect reports and user edits without private telemetry. |
| `M28-W04` | Defect burn-down | Fix all critical/high defects and all release-gate failures; rerun complete verification. |
| `M28-W05` | Freeze core v1 interfaces | Version API/contracts, adapter interface, document schema, event schema, and model lock before expansion. |

### Required verification

- Full clean-room verification.
- Alpha scenario checklist.
- No critical/high open defect.
- Regression report.
- Backup/restore on packaged build.

### Milestone exit gate

Core product meets all applicable Section 2 metrics, all four critical gates remain PASS, and the product is accepted before M29 becomes READY.

### Prohibited shortcut

Do not waive failed gates to start job aggregation early.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M29 — iCIMS and SmartRecruiters adapters

**Dependencies:** M28, adapter interfaces frozen  
**Goal:** Expand coverage to two additional ATS families with independent fixture matrices and honest support boundaries.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M29-W01` | iCIMS detection/capture | Job metadata, page routes, form boundaries, login/session states, and sanitized fixtures. |
| `M29-W02` | iCIMS fill/upload/receipt | Controls, questions, documents, validation, dynamic behavior, and receipt. |
| `M29-W03` | SmartRecruiters detection/capture | Job metadata, embedded/hosted variants, and fixtures. |
| `M29-W04` | SmartRecruiters fill/upload/receipt | Controls, questions, documents, validation, and receipt. |
| `M29-W05` | Cross-adapter regression | Run every previous adapter and measure bundle/performance impact. |

### Required verification

- Separate tenant matrices.
- Uploads.
- Dynamic fields.
- Receipts.
- Session interruptions.
- All-adapter regression including Workday guided pre-submit.

### Milestone exit gate

Each adapter independently meets supported-variant metrics; unsupported patterns are visible and pause safely.

### Prohibited shortcut

Do not merge adapters merely because visual controls look similar.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M30 — Taleo and SuccessFactors adapters

**Dependencies:** M28  
**Goal:** Cover older enterprise ATS workflows while maintaining strict compatibility limits.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M30-W01` | Taleo fixture taxonomy and adapter | Detection, legacy multipage forms, repeaters, documents, validation, and receipt. |
| `M30-W02` | SuccessFactors fixture taxonomy and adapter | Detection, dynamic controls, login/session boundaries, documents, validation, and receipt. |
| `M30-W03` | Encoding and legacy-browser edge cases | Character encoding, unusual date/phone fields, popup flows, and long sessions. |
| `M30-W04` | Compatibility and performance audit | Publish supported patterns and run all-adapter regression. |

### Required verification

- Legacy form fixtures.
- Encoding.
- Multipage state.
- Uploads.
- Receipt.
- All-adapter regression including Workday guided pre-submit.

### Milestone exit gate

Supported variants pass the same trust gates; unsupported variants pause with actionable reasons.

### Prohibited shortcut

No unsafe DOM heuristics to inflate coverage numbers.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M31 — Unsupported-site teaching, adapter maintenance, and compatibility operations

**Dependencies:** M18, M28–M30  
**Goal:** Provide a controlled way to handle uncommon forms and maintain adapters without shipping fragile remote code.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M31-W01` | Implement teach-this-site mapping | User maps a detected control to a concept, chooses scope, previews value, and stores a local structural fingerprint. |
| `M31-W02` | Implement safe selector strategies | Prefer label/role/attribute fingerprints over brittle absolute selectors; detect drift and invalidate low-confidence mappings. |
| `M31-W03` | Implement fixture capture | Create user-previewed, PII-redacted structural fixtures for bug reports and adapter tests. |
| `M31-W04` | Implement compatibility dashboard | Adapter version, tenant pattern, last tested, pass rate, known issues, and per-site disable. |
| `M31-W05` | Implement maintenance release process | Adapter changes require fixtures, regression, manifest review, and extension release; no remotely hosted executable logic. |

### Required verification

- Mapping drift.
- PII redaction.
- Selector resilience.
- Malicious user mapping.
- Compatibility status.
- No remote code.

### Milestone exit gate

Users can safely teach common unsupported controls, mappings invalidate on structural drift, and support diagnostics contain no private values by default.

### Prohibited shortcut

Do not download executable selectors/scripts from a server into the extension.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M32 — Permitted public job-source registry, ingestion service, normalization, and freshness

**Dependencies:** M28; preferably M29–M31 complete before large-scale use  
**Goal:** Create a constantly refreshed public job index without scraping private platforms or mixing public data with user-private data.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M32-W01` | Define source policy and registry | Source type, permission/legal basis, endpoints, company slug/token, rate limits, attribution, terms review date, freshness target, and disable switch. |
| `M32-W02` | Implement official ATS collectors | Greenhouse Job Board API, Lever Postings API, and Ashby public Job Postings API using company registries and incremental/full reconciliation. |
| `M32-W03` | Implement public career-page collector | Schema.org JobPosting, public sitemaps/feeds, robots/terms-aware rate limits, and no authenticated/private pages. |
| `M32-W04` | Implement licensed-provider adapter | Optional paid aggregate source behind a replaceable interface; document redistribution and retention rights. |
| `M32-W05` | Normalize and deduplicate | Canonical company, title, locations, remote type, compensation, description, source IDs, hashes, and cross-source duplicate clusters. |
| `M32-W06` | Implement freshness/expiration | Incremental cursors, last-seen, closed detection, tombstones, stale warnings, source health, retries, and reconciliation jobs. |
| `M32-W07` | Separate public cloud and private local data | Public index service contains no profile/resume/application data; local app syncs public records and performs private matching locally. |

### Required verification

- Collector contract fixtures.
- Rate-limit/backoff.
- Duplicate clusters.
- Closed-job expiration.
- Source outage recovery.
- No private-data schema in public service.
- Terms disable switch.

### Milestone exit gate

The job index refreshes permitted sources on schedule, exposes provenance/freshness, removes closed jobs, and has no private user data path.

### Prohibited shortcut

No LinkedIn/Indeed authenticated scraping, private API replay, CAPTCHA bypass, or undisclosed redistribution.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M33 — Job search, filters, explainable ranking, alerts inside the app, and saved lists

**Dependencies:** M08, M12, M32  
**Goal:** Help users find high-fit current jobs without hiding eligibility conflicts or creating an opaque recommendation feed.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M33-W01` | Implement local sync and search | Incremental job sync, local cache, FTS, structured filters, pagination, offline behavior, and source/freshness display. |
| `M33-W02` | Implement eligibility prefilter | Hard conflict, unknown, and compatible states using explicit profile records. |
| `M33-W03` | Implement ranking | Evidence fit, preference fit, terminology, freshness, compensation, location, seniority, source quality, and user-adjustable weights. |
| `M33-W04` | Implement explainability | Why recommended, strongest matches, gaps, hard conflicts, freshness, and source provenance. |
| `M33-W05` | Build saved/dismissed/list UI | Save, favorite, dismiss with reason, hide company, saved searches, local in-app alerts, and no Gmail/email dependency. |
| `M33-W06` | Evaluate ranking | Offline labeled set, NDCG/precision at K, hard-conflict leakage, diversity, freshness, and user preference study. |

### Required verification

- Search/filter correctness.
- Ranking determinism.
- Hard conflict never hidden.
- Freshness sorting.
- Dismissal persistence.
- Offline sync.
- Accessibility.

### Milestone exit gate

Users can find and understand current jobs, hard conflicts are explicit, and ranking beats chronological/keyword baselines on the labeled corpus.

### Prohibited shortcut

Do not infer protected traits or rank using demographic data.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M34 — Job review, application preparation, approval, and queue UI

**Dependencies:** M13–M16, M25, M33  
**Goal:** Create the user-controlled boundary between job discovery and automatic application.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M34-W01` | Build job review workspace | Job snapshot, eligibility, match, gaps, company/source/freshness, prior application, and duplicate status. |
| `M34-W02` | Build application preparation | Select/generate verified resume, cover letter, expected answers, sensitive policy, and unresolved evidence requests. |
| `M34-W03` | Implement preflight | Adapter support, job still open, document validity, answer/sensitive readiness, duplicate check, plan expiration, and expected interventions. |
| `M34-W04` | Implement explicit approval | User reviews plan summary and chooses DRY_RUN, PRE_SUBMIT, or eligible AUTO_SUBMIT. Store approval timestamp and plan hash. |
| `M34-W05` | Build queue UI | Order, priority, status, pause/resume/cancel, retry policy, reason for block, estimated required intervention, and global stop. |
| `M34-W06` | Implement plan invalidation | Job changed/closed, profile fact changed, document changed, policy expired, adapter changed, or duplicate discovered. |

### Required verification

- No queue without approval.
- Plan hash/invalidation.
- Duplicate block.
- Closed-job block.
- Sensitive readiness.
- Mode permissions.
- Global stop.

### Milestone exit gate

Only fully reviewed jobs enter the queue, every queue item has an immutable valid plan, and changes invalidate approval safely.

### Prohibited shortcut

No implicit approval from saving, viewing, matching, or clicking apply.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M35 — Resumable automatic-application execution engine in dry-run and pre-submit modes

**Dependencies:** M20, M24, M25, M28–M34  
**Goal:** Execute approved plans through the extension with strict state, audit, pause, and idempotency controls before allowing automatic submit, reusing the certified Workday guided-navigation architecture rather than creating a second navigation engine.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M35-W01` | Define execution state machine | QUEUED, PREFLIGHT, OPENING, SCANNING, FILLING, GENERATING, REVIEWING, READY_TO_SUBMIT, PAUSED, FAILED, CANCELLED, SUBMITTING, SUBMITTED. |
| `M35-W02` | Implement tab/session orchestration | Bounded concurrency initially one, dedicated tab, route tracking, session token, timeouts, and cleanup. |
| `M35-W03` | Implement idempotent step execution | Every fill/upload/navigation/generation step has input hash, result, retry class, and no repeated destructive action. |
| `M35-W04` | Implement interventions | CAPTCHA, login, unsupported control, unexpected sensitive question, ambiguity, validation error, site block, and changed job. |
| `M35-W05` | Implement dry-run mode | Scan, resolve, prepare, and report all intended operations without changing page values where feasible. |
| `M35-W06` | Implement pre-submit mode | Fill all safe values and stop on the final review/submit boundary; user inspects and submits. |
| `M35-W07` | Implement audit UI | Live step timeline, reason codes, source/provenance, pause/resume/cancel, and no hidden background behavior. |

### Required verification

- State transition property tests.
- Crash/restart resume.
- Idempotent retry.
- Two queue items isolation.
- CAPTCHA pause.
- Unexpected sensitive pause.
- Dry-run no mutation.
- Pre-submit no click.
- Workday guided-pre-submit regression remains green and uses the same navigation/readiness contracts.

### Milestone exit gate

Approved jobs can execute reliably to dry-run/pre-submit completion, survive interruption, and never submit or guess under uncertainty.

### Prohibited shortcut

AUTO_SUBMIT remains disabled.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M36 — Automatic submit for supported ATS flows, receipt enforcement, and safety controls

**Dependencies:** M35 accepted; adapter-specific auto-submit certification  
**Goal:** Enable the exact feature requested: automatically apply to approved jobs, but only on certified flows with all policies satisfied.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M36-W01` | Define auto-submit certification | Per adapter/tenant-pattern checklist for fields, review, validation, submit control, confirmation, duplicate, CAPTCHA, and failure behavior. |
| `M36-W02` | Implement final readiness proof | Immediately before click, rescan required fields, compare intended vs actual values, verify documents/answers, duplicate status, plan validity, and no new sensitive controls. |
| `M36-W03` | Implement bounded submit action | One certified submit action with idempotency marker, no repeated click on timeout, and state transition to SUBMITTING. |
| `M36-W04` | Implement receipt enforcement | Wait for recognized confirmation/ATS ID/URL; classify validation or network failure; never mark success from the click alone. |
| `M36-W05` | Implement rate/concurrency policy | Default one active application, per-domain cooldown, daily user-configured cap, backoff, and immediate global stop. |
| `M36-W06` | Implement user controls and consent | Auto-submit off by default, explicit enablement, supported-site list, dry-run preview, per-item mode, and clear consequences. |
| `M36-W07` | Roll out adapter by adapter | Certify one low-variance supported pattern at a time. Preserve Workday `GUIDED_PRE_SUBMIT` as the default Workday mode; Workday auto-submit may be considered only through a separate tenant-pattern certification proving the final submit control, receipt, duplicate, timeout, and recovery behavior without weakening Gate C. |

### Required verification

- Final rescan detects mutation.
- Single-click/idempotency.
- Timeout does not repeat submit.
- Receipt required.
- Validation failure.
- Duplicate guard.
- Global stop.
- Per-adapter certification suite.
- Workday guided mode remains available and never becomes submit-capable merely because another mode is certified.

### Milestone exit gate

Certified flows submit approved applications with zero unapproved/duplicate submissions and 100% receipt or explicit failure classification in the release test set.

### Prohibited shortcut

No auto-submit on uncertified, CAPTCHA-protected, ambiguous, or unsupported flows.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M37 — Automatic-application resilience, real-world pilot, and queue quality validation

**Dependencies:** M36  
**Goal:** Prove the approved queue works over sustained real use and fails safely rather than merely passing synthetic happy paths.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M37-W01` | Long-run synthetic soak | Hundreds of queued applications across fixtures with random navigation delays, service restarts, model timeouts, validation errors, and source changes. |
| `M37-W02` | Controlled real pre-submit pilot | Diverse supported public applications using user-owned data, manually audited before submit; capture structural defects without private telemetry. |
| `M37-W03` | Controlled real auto-submit pilot | Small explicit cohort, low daily caps, certified ATS only, immediate stop, post-run audit, and user confirmation of every receipt. |
| `M37-W04` | Quality and spam safeguards | Eligibility/gap visibility, user-approved jobs only, company/role duplicate caps, and no indiscriminate blanket applying. |
| `M37-W05` | Failure taxonomy burn-down | Fix or explicitly block every observed unsafe failure class and rerun soak/pilot. |
| `M37-W06` | Publish compatibility and limits | Measured success/pause/failure rates by adapter and reason; no marketing claim beyond evidence. |

### Required verification

- Queue soak.
- Randomized fault injection.
- Audit completeness.
- No unapproved/duplicate submit.
- Receipt reconciliation.
- Pause reason accuracy.
- Daily cap/global stop.

### Milestone exit gate

Real pilot demonstrates safe, resumable approved-queue execution with zero critical submission errors and published measured support boundaries.

### Prohibited shortcut

Do not increase volume to hide a low success rate.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---

## M38 — Final product validation, cross-platform release candidate, and completion audit

**Dependencies:** M00–M37  
**Goal:** Produce a fully tested, validated release candidate that meets the complete product and superiority contract.

### Work packages

| ID | Package | Required implementation and proof |
|---|---|---|
| `M38-W01` | Requirements traceability audit | Every REQ has implementation, automated/manual tests, evidence, owner status, and no orphan code or unverified claim. |
| `M38-W02` | Full clean-clone verification | Preserve the original clean-clone verification scope and execute it on macOS arm64, Windows x64, and Ubuntu x64, including all suites, migrations, secure stores, backup/restore, model profiles, extension/native-host installation, package install/upgrade/rollback/uninstall, and recovery. |
| `M38-W03` | Final frozen benchmark | Autofill, resume, answers, match, render, tracker, job index, queue, autopilot, security, performance, and accessibility metrics. |
| `M38-W04` | Final Simplify side-by-side study | Manual terms-compliant evaluation on identical user-owned examples, blinded scoring, defect counts, and transparent limitations. |
| `M38-W05` | Independent review | Security/privacy review and external usability/quality review; resolve all critical/high issues. |
| `M38-W06` | Release documentation | Install, model requirements, privacy, supported sites, job sources, auto-submit consent, troubleshooting, data export/delete, backup/restore, and known limitations. |
| `M38-W07` | Freeze release candidate | Version all components, schemas, prompts, model lock, compatibility matrix, source policy, migration path, and signed artifacts. |

### Required verification

- All Section 2 release metrics.
- No critical/high issues.
- Native macOS/Windows/Ubuntu install, upgrade, rollback, repair, and uninstall.
- CROSS_PLATFORM_CORE final regression and current platform compatibility evidence.
- Full requirements audit.
- Reproducible benchmark.
- Signed artifact verification.

### Milestone exit gate

All mandatory milestones are ACCEPTED, all release metrics and all four critical gates pass, no critical/high defect remains, and the side-by-side evidence supports the claim that the product is more accurate, truthful, transparent, and controllable on included workflows.

### Prohibited shortcut

Do not call the product complete because the UI looks finished or because one happy-path application succeeds.

### Closeout record

Before marking this milestone `ACCEPTED`, the implementation agent must update `PROJECT_STATUS.md`, `TEST_EVIDENCE.md`, `REQUIREMENTS_TRACEABILITY.md`, `COMPATIBILITY_MATRIX.md` where applicable, `CRITICAL_GATES.md` when the milestone affects a critical capability or regression status, `KNOWN_ISSUES.md`, and any approved ADRs. It must run the milestone verification command from a clean working state and record the exact result.

---
## 10. Cross-cutting acceptance rules for every feature

### 10.1 No feature is complete without all of these

- Typed contract.
- Migration/data model where needed.
- Unit and integration tests.
- Error and empty states.
- Loading and cancellation behavior.
- Accessibility behavior.
- Security/privacy review.
- PII-safe logging.
- Manual validation of the actual UI.
- Traceability entry.
- User-facing documentation where behavior is not self-evident.
- No critical/high known defect.

### 10.2 AI feature completion checklist

- Prompt is versioned in the registry.
- Model/runtime/digest recorded.
- Input context is bounded and source-labeled.
- Output schema is strict.
- Factual claims have evidence IDs.
- Unsupported/contradicted output is blocked.
- Stale context is tested.
- Prompt injection is tested.
- Exact length and formatting are deterministic.
- One bounded repair pass maximum unless an ADR approves otherwise.
- Regression corpus and latency/memory results pass.

### 10.3 Browser automation completion checklist

- Adapter/tenant detection is explicit and compatibility-scoped.
- Field scanner and resolver output can be inspected.
- Durable field identity is semantic/structural, not raw-selector-only.
- Each permitted frame has an independent agent and typed frame/document identity.
- The current element is re-resolved immediately before action.
- A control-specific driver reports preconditions, action, postconditions, and diagnostics.
- Sensitive policy is applied before fill.
- Actual DOM value is verified immediately and after the defined rerender/settle window.
- Site validation acceptance is checked.
- AI failure cannot erase deterministic decisions.
- Mutation observation is bounded and performance-instrumented.
- Required-field reconciliation passes.
- Unresolved required fields and page-changed values block readiness.
- Documents and answers are exact versioned artifacts.
- Page changes and service-worker suspension are handled.
- CAPTCHA/unsupported states pause.
- Duplicate guard passes.
- Submission click is idempotent and certified.
- Receipt is required for success.
- Full audit event chain exists.
- Real Manifest V3 Playwright tests pass; jsdom-only evidence is insufficient.
- The affected critical-gate regression remains `PASS`.
- Platform-native extension/native-host behavior passes for every certified platform affected by the change.
- For Workday, tenant/session/step identity is multi-signal and versioned.
- Every automatic `Next` action has a current page-readiness proof, page-generation binding, unique re-resolved control, idempotency key, and independently confirmed transition.
- A timeout or ambiguous transition never causes a blind repeat click.
- Login, account creation, email verification, MFA, CAPTCHA, unexpected terms, and unsupported boundaries pause without bypass.
- Workday final review is detected independently of button text and reconciled against the frozen application plan.
- `GUIDED_PRE_SUBMIT` never activates the final submit control; only the user may submit in that mode.

### 10.4 Platform feature completion checklist

- Shared logic uses typed platform capabilities rather than scattered OS branches.
- Native packaged behavior runs on every affected certified platform.
- Secret-store, path/process, native-host, model capability, document, backup, and update behavior is tested as applicable.
- Platform compatibility rows record exact OS build, architecture, browser, artifact, and date.
- Unsupported platforms and insufficient hardware fail visibly and safely.
- No shell-profile, Bash-only, path-separator, case-sensitivity, or line-ending assumption remains in canonical flows.
- Cross-platform gate regression remains valid.

### 10.5 Data migration checklist

- Forward migration tested from every supported schema version.
- Interrupted migration recovery tested.
- Backup before destructive migration.
- Artifact references and hashes preserved.
- Rollback or recovery path documented.
- No silent data truncation.

---

## 11. Risk register

| Risk | Consequence | Mandatory mitigation |
|---|---|---|
| Local model hallucinates | False resume/application claims | Evidence IDs, atomic claim verification, block unsupported output |
| Exact saved answer reused in wrong context | Wrong company/location/legal response | Intent + context fingerprint + freshness + sensitivity policy |
| Keyword optimization creates incoherent resume | Lower quality and credibility | Whole-document planner, evidence allocation, repetition budget |
| One-page fit makes document unreadable | Poor human/ATS outcome | Content-first optimization and hard typography floors |
| Extension misclassifies a field | Wrong application data | Typed ontology, confidence calibration, sensitive zero-tolerance, review panel |
| Dynamic page changes after fill | Values disappear or wrong fields appear | Mutation-aware rescan and post-fill reconciliation |
| Service worker sleeps | Lost state | Desktop-owned state machine and resumable extension sessions |
| Submit click times out | Duplicate application | Idempotency marker; never repeat submit without confirmed state |
| Confirmation page not recognized | False tracker success or retry | Receipt enforcement and explicit unknown/failure state |
| Large local model causes swap | Unusable app | Gemma 4 12B MLX, context/concurrency limits, memory benchmark, idle unload |
| Public job source disappears or changes terms | Stale/illegal index | Source registry, terms review date, disable switch, licensed fallback |
| Job aggregation contains duplicates/stale jobs | Bad recommendations and duplicate applies | Cross-source IDs/hashes, freshness, tombstones, reconciliation |
| Autopilot becomes mass-spam | User harm/site blocks | Approved jobs only, caps, eligibility display, concurrency one, no stealth |
| Private data leaks through diagnostics | Severe privacy breach | Local-first, redaction, user-previewed bundles, no content telemetry |
| Claude loses context across sessions | Architectural drift | Canonical spec/status/ADR/test files and one-package protocol |
| Tests become ceremonial | False confidence | Frozen corpora, clean-clone gates, manual UI validation, independent review |
| Core autofill risk is validated too late | Months of surrounding work around a broken extension | Blocking M02 real-extension feasibility gate before M03 |
| Core resume/PageFit risk is validated too late | Complete UI/data system around weak generation | Blocking M05 feasibility gate before M06 |
| CSS selector or DOM index becomes field identity | Stale/wrong target after rerender | Semantic/structural FieldAddress, re-resolution, ambiguity pause |
| DOM write is mistaken for successful fill | Page discards or rejects value | Post-rerender observation and site-validation postconditions |
| Only visible option is selected despite semantic mismatch | Catastrophic wrong consequential answer | Exact/normalized option semantics and mandatory abstention |
| AI fallback failure erases deterministic mappings | Detected fields are not filled | Monotonic deterministic result set; AI only adds reviewed proposals |
| Mutation observer scans entire page repeatedly | Slow/inconsistent Workday behavior and memory pressure | Bounded application-root observation, subtree index, instrumentation, soak tests |
| jsdom tests diverge from real extension behavior | False browser confidence | Built MV3 extension in persistent Playwright Chromium with actual service worker |
| Agent overfits visible fixtures | Gate passes without generalization | Owner-controlled hidden holdout and independent evaluator |
| Legacy repository contaminates new architecture | Reintroduces known unsafe behavior | Clean-room baseline only; provenance/license ADR for any reuse |
| Compatibility claim exceeds measured scope | Users trust unsupported forms | Tenant-pattern matrix, exact versions, last-tested date, raw counts |
| Critical gate failure is ignored to maintain momentum | Feature-rich but unreliable product | Downstream readiness blocked by status validator and owner gate decision |
| Platform support is added only at release | Architectural rewrites and unusable Windows/Linux builds | Early platform contracts, Windows CI, staged native packages, blocking Gate D |
| macOS Keychain logic leaks into shared storage | Windows/Linux insecure or broken persistence | Typed SecretStore with three native adapters and no plaintext fallback |
| GUI process depends on shell PATH | Packaged app cannot find Python/Ollama/native host | Explicit runtime locator and bundled/configured paths tested per OS |
| POSIX paths/signals assumed | Windows failures and data corruption | PlatformPaths/ProcessSupervisor plus Windows CI and native tests |
| Windows native messaging uses text mode | Corrupted length-prefixed messages | Binary-mode protocol test and registry-based installer |
| Linux support claim covers untested distributions | Unsupportable compatibility surface | Ubuntu 24.04 certified; all others experimental until gated |
| MLX artifact treated as universal | Windows/Linux AI features cannot run | Versioned model family with platform-specific runtime/artifact profiles |
| Platform fonts differ | Resume clipping or extraction drift | Controlled font policy and three-OS render/extraction matrix |
| Installer/update deletes user data | Severe irreversible loss | Signed packages, backup, update/rollback/repair/uninstall matrix and Gate D |
| Workday step is misclassified | Wrong answers, wrong page behavior, or unsafe navigation | Multi-signal tenant/session/step identity, confidence threshold, ambiguity pause, fixture/holdout matrix |
| Workday `Next` is clicked before the page settles | Validation loss, skipped questions, or stale values | Typed page-readiness proof covering required fields, rerender, validation, parser, repeaters, sensitive policy, and unique navigation target |
| Workday transition times out and is clicked again | Duplicate or corrupted navigation/action | One action per generation/proof hash, transition postconditions, no blind retry, checkpointed recovery |
| Resume parser duplicates or mutates Workday repeaters | Incorrect experience/education data | Exact upload verification, parser-settle wait, semantic repeater reconciliation, stable item keys, duplicate block |
| Workday final submit is mistaken for `Next` | Unreviewed live submission | Independent final-review classification, explicit no-submit capability, user-only final click, submit-control negative tests |
| Workday protected boundary is automated | Account/security harm or anti-bot violation | Pause on credentials, account creation, email verification, MFA, CAPTCHA, unexpected legal acceptance, and session challenges |
| Workday support is claimed from one tenant | False parity claim | Pattern-level certification, raw counts, locale/session coverage, public/no-submit evidence, holdout, last-tested date |
| Workday implementation is postponed behind easier ATSs | Product misses its defining use case | M19–M20 precede Greenhouse/Lever/Ashby; M21 readiness blocked by Workday Gate C |

---

## 12. Required project-status format

`docs/PROJECT_STATUS.md` must follow this shape:

```markdown
# Project Status

Spec version: 1.3
Repository revision: <hash>
Last updated: <ISO timestamp>
Current phase: <phase>
Current milestone: <Mxx>
Current work package: <Mxx-Wyy or NONE>
Overall release gate: NOT_READY

## Critical gates
| Gate | State | Evaluated revision | Corpus/holdout hash | Independent reviewer | Report |
| AUTOFILL_FEASIBILITY | NOT_EVALUATED | — | — | — | docs/gates/AUTOFILL_FEASIBILITY_GATE.md |
| RESUME_PAGEFIT_FEASIBILITY | NOT_EVALUATED | — | — | — | docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md |
| WORKDAY_GUIDED_PRE_SUBMIT | NOT_EVALUATED | — | — | — | docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md |
| CROSS_PLATFORM_CORE | NOT_EVALUATED | — | — | — | docs/gates/CROSS_PLATFORM_CORE_GATE.md |

Allowed gate states:
NOT_EVALUATED | IN_PROGRESS | PASS | REDESIGN_REQUIRED | BLOCKED

## Active work
- State:
- Objective:
- Dependencies verified:
- Critical-gate prerequisites:
- Files expected to change:
- Required tests:
- Required manual/holdout evidence:
- Blockers:

## Milestone table
| Milestone | State | Verified revision | Notes |

## Work-package table
| Work package | State | Verified revision | Evidence link | Notes |

## Next READY package
- ID:
- Reason:
- Required reading:

## Known release blockers
- ...
```

The validation system must ensure:

- Status enums are valid.
- Dependencies are not skipped.
- No more than one package is `IN_PROGRESS`.
- Every work package in the canonical v1.3 specification appears exactly once, with exactly 39 milestones, 286 work packages, and 157 requirements.
- Completed v1.0 revisions remain attached to their unchanged package IDs after migration.
- `M03` cannot be `READY` or later unless `AUTOFILL_FEASIBILITY = PASS`.
- `M06` cannot be `READY` or later unless `RESUME_PAGEFIT_FEASIBILITY = PASS`.
- `M21` cannot be `READY` or later unless M19 and M20 are `ACCEPTED` and `WORKDAY_GUIDED_PRE_SUBMIT = PASS`.
- A gate report, corpus hash, revision, independent reviewer, holdout result, and owner decision are present before `PASS`.
- `REDESIGN_REQUIRED` or `BLOCKED` prevents downstream readiness.
- Exactly one canonical specification exists after `M00-W08`.
- M00 cannot return to `ACCEPTED` and M01-W01 cannot become ready after migration until M00-W10 verifies the v1.3 inventory and three-OS baseline.

`docs/CRITICAL_GATES.md` is the authoritative narrative decision ledger for all four gates and must contain the metric table, zero-tolerance failures, holdout result, independent review, owner decision, known limitations, and next permitted action for each of the four gates.

---

## 13. Reusable prompts for Claude and Codex

### 13.1 Start or continue one work package

```text
Read CLAUDE.md, docs/MASTER_IMPLEMENTATION_SPEC.md, docs/PROJECT_STATUS.md,
docs/DECISIONS.md, docs/TEST_EVIDENCE.md, docs/KNOWN_ISSUES.md,
docs/CRITICAL_GATES.md, and the relevant traceability entries. Execute only work
package <ID>.

Before editing, restate its objective, dependencies, critical-gate prerequisites,
affected trust boundaries, non-goals, required tests, required manual/holdout evidence,
and exit evidence. Inspect the current repository and existing implementation. Add or
update tests, implement the smallest complete vertical slice, run focused and aggregate
verification, inspect the actual UI/browser/document behavior when applicable, and
update all required project-memory files.

Do not weaken tests, invent facts, add unrelated features, expose hidden holdout labels,
or mark the package verified without command evidence. Finish with the required
completion report.
```

### 13.2 Audit a completed milestone

```text
Audit milestone <Mxx> against docs/MASTER_IMPLEMENTATION_SPEC.md without assuming
its status is correct. Trace every work package and requirement to code and tests,
run the milestone verification command from the current repository state, inspect
manual/UI evidence, validate any critical-gate dependencies, identify missing behavior
or false completion claims, and update status only when every exit gate is proven.
Fix only defects within this milestone unless a dependency defect makes that impossible.
```

### 13.3 Resume after context loss or usage interruption

```text
Reconstruct the project solely from repository files. Read the canonical spec, status,
decisions, test evidence, known issues, compatibility matrix, critical gates, and
traceability. Inspect git status, untracked files, staged files, recent commits, and the
complete current diff before changing anything. Identify the single correct READY or
IN_PROGRESS work package and explain why.

If the prior session left intentional uncommitted work, preserve it. Do not reset,
discard, regenerate, or overwrite it merely to obtain a clean tree. Validate each
partial file against the package contract, continue the same package, run all required
positive and negative tests, update project memory, commit and push only after genuine
verification, and stop at the package boundary. Do not rely on conversational memory.
```

### 13.4 Investigate a defect

```text
Create a minimal reproducible failing test for defect <description>. Identify the
violated requirement, gate, and work package; inspect trust/security implications; fix
the root cause without broad refactoring; run all affected adapter/feature and critical-
gate regressions; and record the defect, cause, fix, and verification evidence. Do not
close the issue because one manual example passes.
```

### 13.5 Propose an architecture change

```text
Do not implement the change yet. Add a proposed ADR with observed evidence,
constraints, alternatives, security/privacy impact, data migration impact, benchmark
and gate impact, test impact, rollback plan, and recommendation. Identify every
specification section, requirement, milestone, schema, gate, and compatibility promise
that would change. Wait for owner approval before changing the canonical contract.
```

### 13.6 Execute a critical feasibility package

```text
Execute only <critical work-package ID>. Read the canonical spec and gate report first.
Treat the acceptance threshold as fixed. Separate implementation fixtures from the
owner-controlled holdout. Build real artifacts, not mocks of success. Run real browser
or renderer behavior, record raw outcomes and failures, and preserve every zero-tolerance
failure as a regression case. Do not mark the gate PASS; only the independent gate-audit
package and owner decision may do that.
```

### 13.7 Independently audit a critical gate

```text
You are the independent gate verifier, not the implementation agent. Reconstruct the
repository from disk, re-read the entire relevant specification, inspect every changed
file and benchmark schema, and distrust completion claims until reproduced. Run fresh
positive and negative paths with cache bypass where relevant. Execute the owner-provided
holdout bundle without exposing its expected labels to the implementation branch.
Manually inspect real browser/document artifacts. Compare raw results against every
threshold and zero-tolerance metric. Record confirmed defects, rejected findings,
benchmark limitations, and one decision: PASS, REDESIGN_REQUIRED, or BLOCKED. Do not
weaken thresholds or repair expected results to obtain PASS.
```

### 13.8 Adopt v1.3 after completing v1.2 M00-W07

```text
The owner approves JAPP-MASTER-001 v1.3 as the new canonical specification. Execute only M00-W08.

First verify that v1.2 M00-W07 finished, all completed evidence is pushed, the working tree is clean, and no M01 implementation began. Read the current canonical v1.2 specification and the complete owner-approved v1.3 file from its external immutable path; verify the owner-provided SHA-256 before editing. Read the traceability source/generator, status, decisions, tests, gates, compatibility files, validator, doctor, CI, and Git history. Do not place the v1.3 file under `docs/` before adoption because the v1.2 validator correctly rejects a second canonical-looking specification.

Record an accepted ADR including the external source path and verified hash, atomically copy the approved v1.3 bytes directly into the canonical path, add PLATFORM_SUPPORT.md and CROSS_PLATFORM_CORE gate/report, migrate exactly 39 milestones, 286 work packages, and 157 requirements; preserve every M00-W01 through W07 revision/evidence and the v1.2 `docs/traceability.json` / `scripts/traceability.py` implementation. Mechanically extend the traceability source, generator, and checks so every new ID exists with honest NOT_STARTED/NOT_YET_APPLICABLE state and `pnpm verify` remains fail-closed; do not pretend the full reviewed platform mapping is complete, because M00-W10 owns that audit. Reopen M00, set M00-W09 READY, block M01-W01 until M00-W10, run migration and negative tests, pnpm verify, status validation, and stop. Do not implement Windows CI or product platform adapters in M00-W08.
```

### 13.9 Clean-room compare a legacy implementation

```text
Evaluate the legacy CareerPulse or JobApply implementation only as an isolated behavioral
baseline. Do not add it as a production dependency and do not copy files. Record repository
URL, commit, license status, runtime, browser, fixture/profile, exact observed field outcomes,
performance, and failures. Convert confirmed failure classes into independently authored
synthetic regression cases. If code reuse is proposed, stop and create a provenance/license/
architecture ADR before touching production code.
```

---

## 14. Commands for introducing this specification

### 14.1 Fresh repository

```text
Read docs/MASTER_IMPLEMENTATION_SPEC.md in full. This file is the canonical contract. Begin with M00-W01 only, create and validate persistent project memory, and stop.
```

### 14.2 Current repository while v1.2 M00-W07 is running

Do not copy or attach v1.3 to the active working tree. Let Codex finish v1.2 M00-W07, validate, commit, push, observe CI, and stop before M01-W01. Preserve its traceability implementation.

### 14.3 Existing repository after v1.2 M00-W07

Keep this file outside the repository at an immutable owner-controlled path, for example:

```text
/Users/<owner>/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.3_final.md
```

Verify and record its SHA-256. The v1.2 validator intentionally rejects any second canonical-looking specification under `docs/`, so the pre-adoption working tree must remain clean. Execute the exact `13.8` adoption prompt with the owner-selected implementation agent. M00-W08 reads the external file, verifies its hash, and copies its exact bytes directly into `docs/MASTER_IMPLEMENTATION_SPEC.md` as part of the same controlled migration; M00-W09 adds Windows/portability CI, and M00-W10 extends traceability and re-accepts M00. Do not begin M01 until all three finish and an independent M00 audit passes.

### 14.4 Agent policy

```text
Implementation agent   selected explicitly by the owner per package or run
Active selection       remains in force until the owner explicitly changes it
Automatic switching    prohibited; do not infer from limits, timing, or package type
Independent audit      separate clean session or worktree from implementation
```

One agent writes to a working tree at a time. Any capable agent must obey the same repository reconstruction, test, evidence, and package-boundary rules.

---

## 15. Research references supporting time-sensitive technical decisions

These references are included so future model or architecture changes can be checked against the July 26, 2026 snapshot:

- Google DeepMind, “Gemma 4” model overview and performance page.
- Google, “Introducing Gemma 4 12B: a unified, encoder-free multimodal model,” June 3, 2026.
- Google AI for Developers, “Gemma 4 model overview.”
- Ollama model library, `gemma4:12b-mlx` size/context listing.
- Ollama, “Ollama is now powered by MLX on Apple Silicon in preview,” March 30, 2026.
- Ollama, “Ollama’s highest performance on Apple Silicon yet with MLX,” June 11, 2026.
- Qwen official model card, Qwen3.6-27B, and Ollama’s Q4 size listing.
- Chrome for Developers, Manifest V3 content scripts, per-frame execution, isolated worlds, service workers, messaging, permissions, and native messaging documentation.
- Tauri 2 official documentation.
- FastAPI official testing documentation.
- Greenhouse official Job Board API documentation.
- Lever official Postings API documentation.
- Ashby official public Job Postings API documentation.
- Workday official Candidate Experience and Recruiting product documentation, used only for public workflow context—not private implementation details.
- Chrome for Developers documentation for content-script messaging, service-worker trust boundaries, `webNavigation` frame/document identifiers, scripting, and Manifest V3 extension security.
- Playwright official extension-testing guidance for persistent Chromium contexts and actual Manifest V3 service workers.
- Tauri 2 prerequisites, platform-specific configuration, Windows installer, macOS bundle/DMG, Linux Debian/AppImage, updater, signing, and distribution documentation.
- Chrome native-messaging documentation for Windows registry registration, macOS/Linux manifest locations, absolute paths, length framing, and Windows binary I/O.
- GitHub Actions hosted-runner documentation and runner-images matrix for macOS 15 arm64, Windows 2025 x64, and Ubuntu 24.04 x64.
- Microsoft lifecycle documentation confirming general Windows 10 support ended on October 14, 2025.
- Freedesktop Secret Service specification and platform credential-store documentation.
- Ollama installation and hardware-acceleration documentation for macOS, Windows, and Linux.

When a dependency, model, browser API, ATS API, or source policy changes materially, create an ADR and rerun the affected acceptance benchmarks before updating this snapshot.

---

## 16. Final completion statement

This specification is intentionally stricter than a normal MVP plan. Its purpose is not merely to produce a working demo. Its purpose is to produce a trustworthy application system whose convenience does not come from guessing, fabricating, hiding uncertainty, or silently submitting bad data.

The project is finished only when the user can:

1. Build a complete evidence-backed profile.
2. Create and manage reliable resumes.
3. Understand job fit and honest gaps.
4. Generate superior, factual tailored documents and short answers locally.
5. Autofill supported applications accurately with visible provenance and review.
6. Open a certified Workday application and, under prior revocable auto-start consent or a one-time start action, let the product fill and verify every safe page and advance automatically, review the complete final application, and personally click submit without having manually entered application data except at documented protected or uncertain boundaries.
7. Track exactly what was submitted and prove submission.
8. Discover current jobs from permitted sources.
9. Approve a queue of jobs.
10. Let the product apply to those approved jobs automatically on separately certified flows.
11. Trust that the product pauses instead of guessing whenever the situation is uncertain or consequential.
12. Install, update, use, back up, restore, and uninstall the complete certified product on macOS 14+ arm64, Windows 11 x64, and Ubuntu 24.04 LTS x64 with accurate platform capability reporting and no plaintext-secret fallback.

No individual milestone, model benchmark, UI screenshot, successful application, test-count claim, or agent completion report is sufficient by itself. Completion is the aggregate, reproducible evidence from every gate in this document, with all four critical gates remaining green through the final release revision.
