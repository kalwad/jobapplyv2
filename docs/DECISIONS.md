# Decisions — Owner Decisions and Architecture Decision Records

Canonical registry of (a) owner decisions that override earlier plans and
(b) architecture decision records (ADRs). Governed by
`docs/MASTER_IMPLEMENTATION_SPEC.md` §0 and §1.4.

## Ownership and update rules

- The project owner is the only party who ACCEPTS or REJECTS a decision.
  The implementation agent may only add entries with status `PROPOSED`; an
  ADR may be recorded as ACCEPTED directly only when it documents a decision
  the owner has already made and communicated (the approval source is then
  cited in the record).
- The implementation agent must not silently alter the specification, the
  selected stack, trust boundaries, the model lock, acceptance thresholds,
  critical-gate status, or compatibility claims (spec §1.4).
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
| OD-020 | Claude implementation sessions use Fable 5 Max; broad Ultra Code workflow orchestration is not the operating plan. Independent review happens after a coherent implementation pass in a separate clean Claude Max session or GPT-5.6 Ultra Codex worktree. Prospectively superseded by OD-026/ADR-0002 for v1.3 and later; retained verbatim as the policy that governed completed v1.2 work. | SUPERSEDED | Spec v1.2 §0(20); ADR-0002 / Spec v1.3 §0(26–27) |
| OD-021 | Certify first-release product behavior only for macOS 14+ arm64, Windows 11 x64, and Ubuntu 24.04 LTS x64 with Chrome stable; all other targets remain unsupported or explicitly experimental until reviewed evidence exists. | ACCEPTED | Spec v1.3 §0(20–21) |
| OD-022 | Add `CROSS_PLATFORM_CORE` as the fourth blocking critical gate; M28 cannot become ready unless M27 is accepted and Gate D is PASS from native packaged evidence. | ACCEPTED | Spec v1.3 §0(25), §2.3, §9.1 |
| OD-023 | Isolate platform behavior behind typed contracts and require platform-native secure storage, platform-correct Chrome native-messaging registration, and native installer/update evidence with no plaintext-secret fallback. | ACCEPTED | Spec v1.3 §0(22–25), §5.14 |
| OD-024 | Stage local-AI certification: accept the primary Mac profile and Windows/Ubuntu capability plus safe fallback in M05; defer required full-AI Windows and Ubuntu acceptance to M27-W10 before Gate D. | ACCEPTED | Spec v1.3 §6.2, M05, M27-W10 |
| OD-025 | Preserve and mechanically extend the v1.2 traceability architecture and historical evidence; M00-W10 owns the complete reviewed platform mapping and M00 re-acceptance. | ACCEPTED | Spec v1.3 §1.4.1, M00-W08…W10 |
| OD-026 | The owner selects the implementation agent. The active selection persists until the owner explicitly changes it; the repository must not automatically route between Claude, Codex, or reasoning modes. Independent audits use a separate clean session or worktree. | ACCEPTED | Spec v1.3 §0(26–27) |
| OD-027 | The user experience must be cohesive, accessible, original, and migration-familiar to experienced Simplify users through publicly observable task patterns, without copying protected expression or implying affiliation. | ACCEPTED | Spec v1.4 §0(28–29) |
| OD-028 | The accepted local Ollama profile remains the mandatory/default AI path and release baseline; every deterministic and accepted local workflow remains operable without an external provider. | ACCEPTED | Spec v1.4 §0(30) |
| OD-029 | A ChatGPT-account provider is experimental, local, single-user, non-core, and disabled by default; it is not a promised API entitlement or a critical-gate dependency. | ACCEPTED | Spec v1.4 §0(31) |
| OD-030 | External-account credentials are password-equivalent secrets held only through platform-native `SecretStore`; plaintext files, logs, cloud-index synchronization, and production use of unrelated `~/.codex/auth.json` are prohibited. | ACCEPTED | Spec v1.4 §0(32) |
| OD-031 | Provider/model selection, data classes leaving the device, retention caveats, and fallback policy require explicit user control; provider switching and cloud egress may not be silent. | ACCEPTED | Spec v1.4 §0(33) |
| OD-032 | The experimental provider ships enabled only after an independent terms/security/privacy/compatibility/account-risk review; an accepted `DISABLED_BY_POLICY` outcome satisfies the experimental package without weakening core scope. | ACCEPTED | Spec v1.4 §0(34) |
| OD-033 | External AI output remains untrusted candidate data under the same schemas, evidence, verifier, sensitive-field, review, and no-submit boundaries as local output. | ACCEPTED | Spec v1.4 §0(35) |
| OD-034 | Only one implementation agent may modify a working tree at a time; independent audits and agent handoffs use clean package boundaries or separate worktrees. | ACCEPTED | Spec v1.4 §0(27), §1.5 |

## Architecture decision records

| ID | Title | Status | Date | Spec sections affected |
|---|---|---|---|---|
| ADR-0001 | Adopt JAPP-MASTER-001 v1.2 (Workday-first critical-risk rebaseline) as the canonical specification | ACCEPTED | 2026-07-26 | Entire specification (v1.0 → v1.2); §0–§16 |
| ADR-0002 | Adopt JAPP-MASTER-001 v1.3 cross-platform rebaseline through external exact-byte transport | ACCEPTED | 2026-07-26 | Entire specification (v1.2 → v1.3); platform governance; Gate D; M00 readiness |
| ADR-0003 | Adopt JAPP-MASTER-001 v1.4 familiarity and provider rebaseline through external exact-byte transport | ACCEPTED | 2026-07-27 | Entire specification (v1.3 → v1.4); familiarity/provider governance; M00/M01/M27/M28 readiness |

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
  - Historical note: ADR-0002/OD-026 prospectively supersedes that
    implementation-routing detail for v1.3 and later while preserving the
    separate clean-session/worktree audit requirement.
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

### ADR-0002 — Adopt JAPP-MASTER-001 v1.3 cross-platform rebaseline through external exact-byte transport

- Status: ACCEPTED
- Date proposed / date decided: 2026-07-26 / 2026-07-26
- Owner-approved external source:
  `/Users/tanishkalwad/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.3_final.md`
- Verified external source SHA-256:
  `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`
- Observed constraint (with evidence): v1.2 correctly enforced one canonical
  specification. Its fail-closed validator rejected any second
  `MASTER_IMPLEMENTATION_SPEC*` file under `docs/`, including the earlier
  in-repository v1.3 transport proposal. The owner corrected the transport:
  keep the approved v1.3 bytes outside the repository, verify the immutable
  hash, and copy those exact bytes directly over the canonical path only after
  a clean v1.2 preflight.
- External transport rationale: it allowed the owner-approved specification
  to be reviewed and hashed without creating an intermediate repository state
  that falsely contained two canonical-looking specifications. No validator
  exception, ignore rule, temporary bypass, or weakening was introduced.
- Mechanical comparison: 39 milestones remain in exact M00–M38 order; the
  package inventory expands from 260 to 286 and the requirements catalog from
  135 to 157; all 260 existing package IDs/titles and all 135 existing
  requirement IDs remain. Exactly 26 packages and 22 requirements are added.
- Decision: adopt JAPP-MASTER-001 v1.3; certify only macOS 14+ arm64, Windows
  11 x64, and Ubuntu 24.04 LTS x64; add typed platform abstractions and
  `CROSS_PLATFORM_CORE`; assign Windows CI to M00-W09; require later native
  packaged evidence, OS-native secure stores, platform-correct Chrome native
  messaging, and signed/verified platform packaging/update behavior.
- Model-profile sequencing: M05 fully accepts the primary Mac profile and
  validates the common profile contract plus native Windows/Ubuntu capability
  and safe fallback. Missing full-AI Windows/Ubuntu hardware does not block
  M06. M27-W10 owns final full-AI Windows and Ubuntu acceptance, which remains
  mandatory before Gate D can pass.
- Traceability impact: preserve the M00-W07 JSON/generator/view architecture
  and its reviewed v1.2 mapping/dependency hashes. M00-W08 mechanically adds
  the 22/26 inventory with an explicit provisional migration state. M00-W10
  subsequently reviews every new record, promotes exactly those records to
  `REVIEWED_V1_3`, and locks the final expanded mapping and dependency hashes
  before M00 re-acceptance.
- Status impact: preserve M00-W01 through M00-W07 as VERIFIED with their
  existing tree/evidence anchors, reopen M00, revoke the historical v1.2
  readiness of M01-W01, and allow only M00-W09 to become READY after M00-W08
  verifies.
- Agent policy: implementation-agent selection is owner-controlled and
  model-agnostic. The current selection persists until the owner explicitly
  changes it; no repository rule automatically switches agents or reasoning
  modes. Independent gate audits still use a separate clean session or
  worktree.
- Security/privacy impact: strengthened through explicit native secret-store,
  process/path, native-messaging, model capability, packaging/update, and
  diagnostics boundaries. This migration creates planning/governance records
  only and introduces no product data, secrets, telemetry, or compatibility
  claims.
- Data-migration impact: no product/user data exists. Git history preserves
  v1.2; no duplicate v1.2 master file is retained.
- Benchmark and gate impact: the three existing gates and thresholds remain
  intact. Gate D is added as NOT_EVALUATED and cannot pass without native
  packaged evidence plus accepted full-AI profiles for all three certified
  operating systems.
- Test impact: status, traceability, doctor/integrity, and migration negative
  tests expand to the exact 39/286/157/4 inventory, platform-memory
  requirements, Gate D evidence, M28/M01 readiness, legacy-evidence
  preservation, provisional mappings, and deterministic regeneration. Windows
  CI remains out of scope until M00-W09.
- Rollback plan: revert the M00-W08 content and revision-stamp commits. Git
  history restores the complete v1.2 canonical bytes and project-memory
  state. Never keep a duplicate specification as a rollback artifact.
- Spec sections, requirements, milestones, schemas, gates, and compatibility
  promises affected: all of JAPP-MASTER-001; `REQ-PLAT-011…026`;
  `REQ-GATE-017…022`; 26 added packages; Gate D; first-release platform
  targets; M00/M01/M28 readiness.
- Owner approval: the owner supplied the external file and exact hash and
  explicitly directed M00-W08 to proceed using the corrected external
  adoption protocol on 2026-07-26.

### ADR-0003 — Adopt JAPP-MASTER-001 v1.4 familiarity and provider rebaseline through external exact-byte transport

- Status: ACCEPTED
- Date proposed / date decided: 2026-07-27 / 2026-07-27
- Owner-approved external source:
  `/Users/tanishkalwad/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.4_owner_approved.md`
- Verified external source SHA-256:
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
- Starting repository stamp revision:
  `211c02e1b9a1f7032a8c0ad387516fc46d9cead4`
- Previous canonical version and SHA-256: JAPP-MASTER-001 v1.3,
  `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`.
- Observed constraint: the owner approved the exact external v1.4 bytes and
  directed execution of only M00-W11 after M01-W06 and its final three-OS
  hosted proof. The single-canonical rule prohibited staging a second proposed
  master specification under `docs/`.
- Exact-byte transport: immediately before mutation the external regular,
  non-symlink file rehashed to the approved digest. Its 367,893 bytes were
  copied to a hidden same-filesystem temporary file, rehashed and compared,
  then atomically replaced `docs/MASTER_IMPLEMENTATION_SPEC.md`. The installed
  file was rehashed and byte-compared to the source. No normalization,
  formatting, punctuation, date, or line-ending rewrite occurred; no duplicate
  specification was retained. Because the approved bytes contain intentional
  Markdown hard-break spaces, `.gitattributes` disables Git patch-whitespace
  diagnostics only for this canonical path while retaining LF checkout;
  `git diff --check` continues to enforce every other path.
- Reviewed comparison:
  - milestone order remains exactly M00–M38 and the critical-gate set remains
    exactly the existing four;
  - packages expand 286 → 300 by exactly `M00-W11`, `M03-W11`, `M05-W17`,
    `M08-W07`, `M09-W07`, `M12-W07`, `M17-W11`, `M25-W08`, `M27-W13`,
    `M27-W14`, `M28-W06`, `M33-W07`, `M34-W07`, and `M38-W08`;
  - requirements expand 157 → 193 by exactly `REQ-UX-001…018` and
    `REQ-AI-001…018`; every prior requirement ID/statement pair remains exact
    and in the same order;
  - exactly eight prior future package rows intentionally change:
    `M03-W01`, `M05-W03`, `M05-W12`, `M17-W01`, `M17-W05`, `M19-W11`,
    `M20-W11`, and `M27-W12`;
  - M27 executes W01…W11 → W13 → W14 → W12, and M28 binds Gate D to
    the final accepted M27 content revision unless an explicit accepted
    independent gate-neutral re-anchoring exists.
- Decision: adopt JAPP-MASTER-001 v1.4 and add the required UI familiarity,
  owner-approved visual-baseline, anti-bloat, and experimental-provider
  memories. Every new ledger begins honestly unapproved/unevaluated and
  contains no fabricated reference observation, capture, result, endpoint,
  credential, token, model, or compatibility claim.
- Traceability impact: retain the v1.2 and post-M01-W06 v1.3 reviewed hash
  lineage as immutable historical layers and add a separately named v1.4
  reviewed projection. Only the 36/14 v1.4 additions use `REVIEWED_V1_4`;
  existing records retain their historical review provenance.
- Status impact: preserve M00-W01…W10 and M01-W01…W06 as VERIFIED at exact
  content trees/commits/evidence headings. Reopen only M00-W11, keep M01
  IN_PROGRESS, temporarily return M01-W07 to NOT_STARTED, and keep all gates
  NOT_EVALUATED. Re-acceptance and restored sole readiness require the exact
  M00-W11 content tree to pass local, clean-clone, and hosted three-OS proof.
- Security/privacy impact: strengthened through original/non-affiliated UI
  rules, native secret storage, explicit provider/egress consent, no silent
  fallback, default-off isolation, dependency/SBOM review, and a valid
  `DISABLED_BY_POLICY` outcome. M00-W11 adds no UI, OAuth, provider networking,
  model routing, browser, native, or other product behavior.
- Data-migration impact: none. No product schema or user data changes. Git
  history remains the v1.3 archive.
- Benchmark and gate impact: no gate is evaluated and no threshold changes.
  Familiarity/originality is a separate M28/M38 obligation, not a fifth gate.
  Gate B later uses and re-anchors the provider-neutral M05 path; Gate D later
  audits final M27 isolation whether the external provider is enabled or
  disabled.
- Test impact: inventories, explicit dependency order, historical anchors,
  memory semantics, canonical uniqueness, provider support state, M28 revision
  binding, raw-byte integrity, atomic migration failures, deterministic
  generation, doctor, portability, clean clones, and hosted CI are expanded.
- Known specification sequencing risk: M28-W06 requires actual job-board and
  queue tasks while dedicated UI packages are M33-W07/M34-W07. This migration
  records rather than silently weakens the approved contract; it must be
  resolved before M28 acceptance.
- Alternatives considered: retain v1.3; stage a repository proposal; normalize
  or hand-edit v1.4; or implement future UI/provider behavior during migration.
  All conflict with the owner's exact-byte, single-canonical, M00-W11-only
  instruction.
- Rollback plan: revert the M00-W11 content and closeout commits. Git history
  restores the complete v1.3 bytes, status, traceability, and validators; never
  create a rollback copy beside the canonical file.
- Spec sections, requirements, milestones, schemas, gates, and compatibility
  promises affected: all of JAPP-MASTER-001; new `REQ-UX-001…018` and
  `REQ-AI-001…018`; fourteen new packages; M27 ordering; M28 revision binding;
  project-memory and release-evidence rules.
- Owner approval: the owner supplied the exact external path and SHA-256 in
  the M00-W11 execution package and approved that immutable file as
  JAPP-MASTER-001 v1.4 on 2026-07-27.

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
