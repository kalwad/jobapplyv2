# Project Status

Spec version: 1.0
Repository revision: tree 323df745c419d8cc7809e88f10bbeca018fdfbb2 (commit aa6b3503405651f915d21027524b112bce11f2a2)
Last updated: 2026-07-26T01:24:19Z
Current phase: A — Project contract and platform
Current milestone: M00
Current work package: NONE
Overall release gate: NOT_READY

## Active work

- State: no work package is IN_PROGRESS. Last completed: M00-W03 (VERIFIED — evidence in docs/TEST_EVIDENCE.md § M00-W03; toolchain pins: Node 24.18.0 + pnpm 11.17.0/Corepack, Python 3.12.13 + uv 0.11.32, Rust 1.97.1, Playwright 1.62.0 + Chromium 151.0.7922.34).
- Objective: next up is M00-W04 — Create root verification commands (deterministic root commands for lint, typecheck, unit, contract, browser, visual, Rust, and aggregate verification; empty suites must fail until explicitly seeded with a smoke test).
- Dependencies verified: for M00-W04 — M00 has no dependency milestones; M00-W01, M00-W02, and M00-W03 are VERIFIED.
- Files expected to change: (set when M00-W04 starts)
- Required tests: (set when M00-W04 starts)
- Blockers: none.

## Milestone table

| Milestone | State | Verified revision | Notes |
|---|---|---|---|
| M00 | IN_PROGRESS | — | Phase A. Repository contract, persistent project memory, and reproducible scaffold (deps: none) |
| M01 | NOT_STARTED | — | Phase A. Shared contracts, identifiers, error model, and capability model (deps: M00) |
| M02 | NOT_STARTED | — | Phase A. Evaluation corpus, mock ATS lab, and frozen baselines (deps: M00, M01) |
| M03 | NOT_STARTED | — | Phase A. Desktop shell, local orchestrator lifecycle, and authenticated health path (deps: M00, M01) |
| M04 | NOT_STARTED | — | Phase A. Encrypted persistence, migrations, artifacts, backup, and restore (deps: M01, M03) |
| M05 | NOT_STARTED | — | Phase A. Local model runtime, exact model lock, and domain acceptance benchmark (deps: M02, M03, M04) |
| M06 | NOT_STARTED | — | Phase B. Canonical career evidence graph (deps: M01, M04) |
| M07 | NOT_STARTED | — | Phase B. Resume and document import with fact-review workflow (deps: M05, M06) |
| M08 | NOT_STARTED | — | Phase B. Complete profile, eligibility, preferences, onboarding, and voice samples (deps: M06, M07) |
| M09 | NOT_STARTED | — | Phase C. Semantic resume schema, editor, versions, branching, and diffs (deps: M06, M08) |
| M10 | NOT_STARTED | — | Phase C. Deterministic resume rendering, ATS-safe template, PDF/DOCX export (deps: M02, M09) |
| M11 | NOT_STARTED | — | Phase C. Job capture, snapshotting, normalization, and requirement extraction (deps: M05, M06) |
| M12 | NOT_STARTED | — | Phase C. Explainable eligibility, evidence coverage, terminology, parseability, and readability (deps: M09, M10, M11) |
| M13 | NOT_STARTED | — | Phase C. Grounded whole-document resume tailoring (deps: M05, M09, M11, M12) |
| M14 | NOT_STARTED | — | Phase C. One-page optimization and document quality optimizer (deps: M10, M12, M13) |
| M15 | NOT_STARTED | — | Phase C. Evidence-backed cover-letter system (deps: M05, M06, M11, M12) |
| M16 | NOT_STARTED | — | Phase C. Short-answer generation, semantic memory, voice adaptation, and batch review (deps: M05, M06, M08, M11) |
| M17 | NOT_STARTED | — | Phase D. Manifest V3 extension foundation and secure native transport (deps: M01, M03) |
| M18 | NOT_STARTED | — | Phase D. Field ontology, generic form scanner, resolver, fill primitives, and review panel (deps: M08, M16, M17) |
| M19 | NOT_STARTED | — | Phase D. Greenhouse adapter (deps: M11, M18) |
| M20 | NOT_STARTED | — | Phase D. Lever adapter (deps: M18, M19) |
| M21 | NOT_STARTED | — | Phase D. Ashby adapter (deps: M18, M19, M20) |
| M22 | NOT_STARTED | — | Phase D. Multipage flows, document/answer selection, dynamic forms, and complete application review (deps: M16, M18, M19, M20, M21) |
| M23 | NOT_STARTED | — | Phase E. Application tracker, exact snapshots, receipts, duplicates, filters, and analytics (deps: M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22) |
| M24 | NOT_STARTED | — | Phase E. Job-specific interview practice and evidence-aware feedback (deps: M06, M11, M16) |
| M25 | NOT_STARTED | — | Phase E. Security, privacy, prompt-injection, performance, accessibility, diagnostics, and packaging hardening (deps: M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24) |
| M26 | NOT_STARTED | — | Phase E. Core closed-alpha acceptance gate (deps: M00, M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24, M25) |
| M27 | NOT_STARTED | — | Phase F. Workday adapter (deps: M26) |
| M28 | NOT_STARTED | — | Phase F. iCIMS and SmartRecruiters adapters (deps: M26) |
| M29 | NOT_STARTED | — | Phase F. Taleo and SuccessFactors adapters (deps: M26) |
| M30 | NOT_STARTED | — | Phase F. Unsupported-site teaching, adapter maintenance, and compatibility operations (deps: M18, M26, M27, M28, M29) |
| M31 | NOT_STARTED | — | Phase G. Permitted public job-source registry, ingestion service, normalization, and freshness (deps: M26) |
| M32 | NOT_STARTED | — | Phase G. Job search, filters, explainable ranking, alerts inside the app, and saved lists (deps: M08, M12, M31) |
| M33 | NOT_STARTED | — | Phase G. Job review, application preparation, approval, and queue UI (deps: M13, M14, M15, M16, M23, M32) |
| M34 | NOT_STARTED | — | Phase H. Resumable automatic-application execution engine in dry-run and pre-submit modes (deps: M22, M23, M27, M28, M29, M30, M31, M32, M33) |
| M35 | NOT_STARTED | — | Phase H. Automatic submit for supported ATS flows, receipt enforcement, and safety controls (deps: M34) |
| M36 | NOT_STARTED | — | Phase H. Automatic-application resilience, real-world pilot, and queue quality validation (deps: M35) |
| M37 | NOT_STARTED | — | Phase I. Final product validation, cross-platform release candidate, and completion audit (deps: M00, M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30, M31, M32, M33, M34, M35, M36) |

## Work-package table

| Work package | State | Verified revision | Evidence link | Notes |
|---|---|---|---|---|
| `M00-W01` | VERIFIED | tree e1dd209417af97b3cab320b4ab01fbd702547136 | docs/TEST_EVIDENCE.md § M00-W01 | Create canonical project-memory files |
| `M00-W02` | VERIFIED | tree 15cc0edec64e4b4f986e7c1ee210d88a1e448140 | docs/TEST_EVIDENCE.md § M00-W02 | Scaffold the monorepo |
| `M00-W03` | VERIFIED | tree 323df745c419d8cc7809e88f10bbeca018fdfbb2 | docs/TEST_EVIDENCE.md § M00-W03 | Establish strict toolchain configuration |
| `M00-W04` | READY | — | — | Create root verification commands |
| `M00-W05` | NOT_STARTED | — | — | Create CI and local preflight |
| `M00-W06` | NOT_STARTED | — | — | Seed traceability and status |
| `M01-W01` | NOT_STARTED | — | — | Define JSON Schema conventions |
| `M01-W02` | NOT_STARTED | — | — | Generate TypeScript and Python contracts |
| `M01-W03` | NOT_STARTED | — | — | Define error taxonomy |
| `M01-W04` | NOT_STARTED | — | — | Define capability and command allowlists |
| `M01-W05` | NOT_STARTED | — | — | Build contract compatibility tests |
| `M02-W01` | NOT_STARTED | — | — | Create synthetic profile/job/resume fixtures |
| `M02-W02` | NOT_STARTED | — | — | Create question and answer fixtures |
| `M02-W03` | NOT_STARTED | — | — | Build mock ATS lab v1 |
| `M02-W04` | NOT_STARTED | — | — | Capture baseline algorithms |
| `M02-W05` | NOT_STARTED | — | — | Build evaluation runner |
| `M02-W06` | NOT_STARTED | — | — | Freeze v1 corpus |
| `M03-W01` | NOT_STARTED | — | — | Create Tauri desktop shell |
| `M03-W02` | NOT_STARTED | — | — | Create FastAPI service skeleton |
| `M03-W03` | NOT_STARTED | — | — | Implement sidecar lifecycle |
| `M03-W04` | NOT_STARTED | — | — | Implement authenticated API client |
| `M03-W05` | NOT_STARTED | — | — | Add crash/restart behavior |
| `M03-W06` | NOT_STARTED | — | — | Package development build |
| `M04-W01` | NOT_STARTED | — | — | Select and prove database encryption |
| `M04-W02` | NOT_STARTED | — | — | Create migration framework |
| `M04-W03` | NOT_STARTED | — | — | Create repository/data-access layer |
| `M04-W04` | NOT_STARTED | — | — | Create encrypted artifact store |
| `M04-W05` | NOT_STARTED | — | — | Implement backup/export/restore |
| `M04-W06` | NOT_STARTED | — | — | Implement deletion and retention |
| `M05-W01` | NOT_STARTED | — | — | Implement runtime adapter |
| `M05-W02` | NOT_STARTED | — | — | Create model lock |
| `M05-W03` | NOT_STARTED | — | — | Implement typed generation client |
| `M05-W04` | NOT_STARTED | — | — | Integrate embeddings |
| `M05-W05` | NOT_STARTED | — | — | Build domain benchmark |
| `M05-W06` | NOT_STARTED | — | — | Accept or propose replacement |
| `M06-W01` | NOT_STARTED | — | — | Implement evidence entities and repositories |
| `M06-W02` | NOT_STARTED | — | — | Implement fact lifecycle |
| `M06-W03` | NOT_STARTED | — | — | Implement conflict detection |
| `M06-W04` | NOT_STARTED | — | — | Implement evidence query service |
| `M06-W05` | NOT_STARTED | — | — | Build evidence UI |
| `M06-W06` | NOT_STARTED | — | — | Build evidence export |
| `M07-W01` | NOT_STARTED | — | — | Implement secure file ingestion |
| `M07-W02` | NOT_STARTED | — | — | Implement PDF/DOCX text and structure extraction |
| `M07-W03` | NOT_STARTED | — | — | Implement structured candidate extraction |
| `M07-W04` | NOT_STARTED | — | — | Implement import review UI |
| `M07-W05` | NOT_STARTED | — | — | Handle failure modes |
| `M07-W06` | NOT_STARTED | — | — | Benchmark import |
| `M08-W01` | NOT_STARTED | — | — | Build guided onboarding |
| `M08-W02` | NOT_STARTED | — | — | Build explicit eligibility records |
| `M08-W03` | NOT_STARTED | — | — | Build job preferences |
| `M08-W04` | NOT_STARTED | — | — | Build voluntary-demographic policy |
| `M08-W05` | NOT_STARTED | — | — | Build voice-sample workflow |
| `M08-W06` | NOT_STARTED | — | — | Profile completeness and freshness |
| `M09-W01` | NOT_STARTED | — | — | Define semantic resume schema |
| `M09-W02` | NOT_STARTED | — | — | Build resume-from-profile creation |
| `M09-W03` | NOT_STARTED | — | — | Build semantic editor |
| `M09-W04` | NOT_STARTED | — | — | Implement immutable versions and branches |
| `M09-W05` | NOT_STARTED | — | — | Implement semantic diffs |
| `M09-W06` | NOT_STARTED | — | — | Protect locked content |
| `M10-W01` | NOT_STARTED | — | — | Implement render intermediate representation |
| `M10-W02` | NOT_STARTED | — | — | Build first ATS-safe template |
| `M10-W03` | NOT_STARTED | — | — | Implement live preview |
| `M10-W04` | NOT_STARTED | — | — | Implement PDF export |
| `M10-W05` | NOT_STARTED | — | — | Implement DOCX export |
| `M10-W06` | NOT_STARTED | — | — | Build document validation |
| `M11-W01` | NOT_STARTED | — | — | Implement manual/paste capture |
| `M11-W02` | NOT_STARTED | — | — | Implement page capture contract |
| `M11-W03` | NOT_STARTED | — | — | Normalize job text |
| `M11-W04` | NOT_STARTED | — | — | Extract requirements |
| `M11-W05` | NOT_STARTED | — | — | Version and hash jobs |
| `M11-W06` | NOT_STARTED | — | — | Evaluate parser |
| `M12-W01` | NOT_STARTED | — | — | Implement eligibility evaluator |
| `M12-W02` | NOT_STARTED | — | — | Implement evidence matcher |
| `M12-W03` | NOT_STARTED | — | — | Implement terminology alignment |
| `M12-W04` | NOT_STARTED | — | — | Implement parseability checks |
| `M12-W05` | NOT_STARTED | — | — | Implement readability checks |
| `M12-W06` | NOT_STARTED | — | — | Build explainable UI |
| `M13-W01` | NOT_STARTED | — | — | Implement tailoring-plan schema |
| `M13-W02` | NOT_STARTED | — | — | Implement planner |
| `M13-W03` | NOT_STARTED | — | — | Implement candidate writer |
| `M13-W04` | NOT_STARTED | — | — | Implement atomic claim verifier |
| `M13-W05` | NOT_STARTED | — | — | Implement coherence and duplication lint |
| `M13-W06` | NOT_STARTED | — | — | Build review and accept UI |
| `M13-W07` | NOT_STARTED | — | — | Evaluate against baseline |
| `M14-W01` | NOT_STARTED | — | — | Implement measured layout model |
| `M14-W02` | NOT_STARTED | — | — | Implement content utility scoring |
| `M14-W03` | NOT_STARTED | — | — | Implement bounded shortening |
| `M14-W04` | NOT_STARTED | — | — | Implement optimization search |
| `M14-W05` | NOT_STARTED | — | — | Build change explanation and undo |
| `M14-W06` | NOT_STARTED | — | — | Evaluate PageFit |
| `M15-W01` | NOT_STARTED | — | — | Define cover-letter schema and versions |
| `M15-W02` | NOT_STARTED | — | — | Implement paragraph planner |
| `M15-W03` | NOT_STARTED | — | — | Implement writer and verifier |
| `M15-W04` | NOT_STARTED | — | — | Implement editor/templates/export |
| `M15-W05` | NOT_STARTED | — | — | Evaluate naturalness and specificity |
| `M16-W01` | NOT_STARTED | — | — | Implement question taxonomy and policy |
| `M16-W02` | NOT_STARTED | — | — | Implement evidence/context retrieval |
| `M16-W03` | NOT_STARTED | — | — | Implement plan/write/verify pipeline |
| `M16-W04` | NOT_STARTED | — | — | Implement semantic answer memory |
| `M16-W05` | NOT_STARTED | — | — | Implement voice profile |
| `M16-W06` | NOT_STARTED | — | — | Build answer UI |
| `M16-W07` | NOT_STARTED | — | — | Evaluate answers |
| `M17-W01` | NOT_STARTED | — | — | Scaffold WXT extension |
| `M17-W02` | NOT_STARTED | — | — | Implement permission strategy |
| `M17-W03` | NOT_STARTED | — | — | Implement message schemas and validators |
| `M17-W04` | NOT_STARTED | — | — | Implement Rust native host |
| `M17-W05` | NOT_STARTED | — | — | Implement extension status UI |
| `M17-W06` | NOT_STARTED | — | — | Build extension E2E harness |
| `M18-W01` | NOT_STARTED | — | — | Define field ontology |
| `M18-W02` | NOT_STARTED | — | — | Implement scanner |
| `M18-W03` | NOT_STARTED | — | — | Implement deterministic resolver |
| `M18-W04` | NOT_STARTED | — | — | Implement fill primitives |
| `M18-W05` | NOT_STARTED | — | — | Implement decision engine |
| `M18-W06` | NOT_STARTED | — | — | Build review panel |
| `M18-W07` | NOT_STARTED | — | — | Benchmark generic engine |
| `M19-W01` | NOT_STARTED | — | — | Create adapter detection and job metadata |
| `M19-W02` | NOT_STARTED | — | — | Implement field mapping |
| `M19-W03` | NOT_STARTED | — | — | Implement document upload |
| `M19-W04` | NOT_STARTED | — | — | Implement dynamic question handling |
| `M19-W05` | NOT_STARTED | — | — | Implement receipt detection |
| `M19-W06` | NOT_STARTED | — | — | Validate real public pages in dry-run |
| `M20-W01` | NOT_STARTED | — | — | Implement detection/job capture |
| `M20-W02` | NOT_STARTED | — | — | Implement fields and custom questions |
| `M20-W03` | NOT_STARTED | — | — | Implement validation and receipt |
| `M20-W04` | NOT_STARTED | — | — | Build fixture and real dry-run matrix |
| `M20-W05` | NOT_STARTED | — | — | Refactor only proven common abstractions |
| `M21-W01` | NOT_STARTED | — | — | Implement detection/job capture |
| `M21-W02` | NOT_STARTED | — | — | Implement form mapping |
| `M21-W03` | NOT_STARTED | — | — | Implement uploads and validation |
| `M21-W04` | NOT_STARTED | — | — | Implement receipt and duplicate detection |
| `M21-W05` | NOT_STARTED | — | — | Complete initial adapter matrix |
| `M22-W01` | NOT_STARTED | — | — | Implement application-page state machine |
| `M22-W02` | NOT_STARTED | — | — | Implement application context |
| `M22-W03` | NOT_STARTED | — | — | Implement page-level question inventory |
| `M22-W04` | NOT_STARTED | — | — | Implement document chooser |
| `M22-W05` | NOT_STARTED | — | — | Implement final review |
| `M22-W06` | NOT_STARTED | — | — | Implement manual submission handoff |
| `M23-W01` | NOT_STARTED | — | — | Implement event-sourced application model |
| `M23-W02` | NOT_STARTED | — | — | Implement exact snapshots |
| `M23-W03` | NOT_STARTED | — | — | Implement receipt vault |
| `M23-W04` | NOT_STARTED | — | — | Implement duplicate detection |
| `M23-W05` | NOT_STARTED | — | — | Build tracker UI |
| `M23-W06` | NOT_STARTED | — | — | Implement CSV import/export |
| `M23-W07` | NOT_STARTED | — | — | Implement honest analytics |
| `M24-W01` | NOT_STARTED | — | — | Generate question sets |
| `M24-W02` | NOT_STARTED | — | — | Capture responses |
| `M24-W03` | NOT_STARTED | — | — | Implement feedback rubric |
| `M24-W04` | NOT_STARTED | — | — | Implement improvement loop |
| `M24-W05` | NOT_STARTED | — | — | Evaluate feedback |
| `M25-W01` | NOT_STARTED | — | — | Threat-model review |
| `M25-W02` | NOT_STARTED | — | — | PII-safe logging and diagnostics |
| `M25-W03` | NOT_STARTED | — | — | Prompt-injection hardening |
| `M25-W04` | NOT_STARTED | — | — | Performance and memory |
| `M25-W05` | NOT_STARTED | — | — | Accessibility |
| `M25-W06` | NOT_STARTED | — | — | Crash recovery and data integrity |
| `M25-W07` | NOT_STARTED | — | — | macOS packaging |
| `M26-W01` | NOT_STARTED | — | — | Run frozen corpus |
| `M26-W02` | NOT_STARTED | — | — | Manual side-by-side evaluation |
| `M26-W03` | NOT_STARTED | — | — | External alpha pilot |
| `M26-W04` | NOT_STARTED | — | — | Defect burn-down |
| `M26-W05` | NOT_STARTED | — | — | Freeze core v1 interfaces |
| `M27-W01` | NOT_STARTED | — | — | Build tenant fixture taxonomy |
| `M27-W02` | NOT_STARTED | — | — | Implement detection and state machine |
| `M27-W03` | NOT_STARTED | — | — | Implement controls and uploads |
| `M27-W04` | NOT_STARTED | — | — | Implement receipt and recovery |
| `M27-W05` | NOT_STARTED | — | — | Performance hardening |
| `M27-W06` | NOT_STARTED | — | — | Compatibility publication |
| `M28-W01` | NOT_STARTED | — | — | iCIMS detection/capture |
| `M28-W02` | NOT_STARTED | — | — | iCIMS fill/upload/receipt |
| `M28-W03` | NOT_STARTED | — | — | SmartRecruiters detection/capture |
| `M28-W04` | NOT_STARTED | — | — | SmartRecruiters fill/upload/receipt |
| `M28-W05` | NOT_STARTED | — | — | Cross-adapter regression |
| `M29-W01` | NOT_STARTED | — | — | Taleo fixture taxonomy and adapter |
| `M29-W02` | NOT_STARTED | — | — | SuccessFactors fixture taxonomy and adapter |
| `M29-W03` | NOT_STARTED | — | — | Encoding and legacy-browser edge cases |
| `M29-W04` | NOT_STARTED | — | — | Compatibility and performance audit |
| `M30-W01` | NOT_STARTED | — | — | Implement teach-this-site mapping |
| `M30-W02` | NOT_STARTED | — | — | Implement safe selector strategies |
| `M30-W03` | NOT_STARTED | — | — | Implement fixture capture |
| `M30-W04` | NOT_STARTED | — | — | Implement compatibility dashboard |
| `M30-W05` | NOT_STARTED | — | — | Implement maintenance release process |
| `M31-W01` | NOT_STARTED | — | — | Define source policy and registry |
| `M31-W02` | NOT_STARTED | — | — | Implement official ATS collectors |
| `M31-W03` | NOT_STARTED | — | — | Implement public career-page collector |
| `M31-W04` | NOT_STARTED | — | — | Implement licensed-provider adapter |
| `M31-W05` | NOT_STARTED | — | — | Normalize and deduplicate |
| `M31-W06` | NOT_STARTED | — | — | Implement freshness/expiration |
| `M31-W07` | NOT_STARTED | — | — | Separate public cloud and private local data |
| `M32-W01` | NOT_STARTED | — | — | Implement local sync and search |
| `M32-W02` | NOT_STARTED | — | — | Implement eligibility prefilter |
| `M32-W03` | NOT_STARTED | — | — | Implement ranking |
| `M32-W04` | NOT_STARTED | — | — | Implement explainability |
| `M32-W05` | NOT_STARTED | — | — | Build saved/dismissed/list UI |
| `M32-W06` | NOT_STARTED | — | — | Evaluate ranking |
| `M33-W01` | NOT_STARTED | — | — | Build job review workspace |
| `M33-W02` | NOT_STARTED | — | — | Build application preparation |
| `M33-W03` | NOT_STARTED | — | — | Implement preflight |
| `M33-W04` | NOT_STARTED | — | — | Implement explicit approval |
| `M33-W05` | NOT_STARTED | — | — | Build queue UI |
| `M33-W06` | NOT_STARTED | — | — | Implement plan invalidation |
| `M34-W01` | NOT_STARTED | — | — | Define execution state machine |
| `M34-W02` | NOT_STARTED | — | — | Implement tab/session orchestration |
| `M34-W03` | NOT_STARTED | — | — | Implement idempotent step execution |
| `M34-W04` | NOT_STARTED | — | — | Implement interventions |
| `M34-W05` | NOT_STARTED | — | — | Implement dry-run mode |
| `M34-W06` | NOT_STARTED | — | — | Implement pre-submit mode |
| `M34-W07` | NOT_STARTED | — | — | Implement audit UI |
| `M35-W01` | NOT_STARTED | — | — | Define auto-submit certification |
| `M35-W02` | NOT_STARTED | — | — | Implement final readiness proof |
| `M35-W03` | NOT_STARTED | — | — | Implement bounded submit action |
| `M35-W04` | NOT_STARTED | — | — | Implement receipt enforcement |
| `M35-W05` | NOT_STARTED | — | — | Implement rate/concurrency policy |
| `M35-W06` | NOT_STARTED | — | — | Implement user controls and consent |
| `M35-W07` | NOT_STARTED | — | — | Roll out adapter by adapter |
| `M36-W01` | NOT_STARTED | — | — | Long-run synthetic soak |
| `M36-W02` | NOT_STARTED | — | — | Controlled real pre-submit pilot |
| `M36-W03` | NOT_STARTED | — | — | Controlled real auto-submit pilot |
| `M36-W04` | NOT_STARTED | — | — | Quality and spam safeguards |
| `M36-W05` | NOT_STARTED | — | — | Failure taxonomy burn-down |
| `M36-W06` | NOT_STARTED | — | — | Publish compatibility and limits |
| `M37-W01` | NOT_STARTED | — | — | Requirements traceability audit |
| `M37-W02` | NOT_STARTED | — | — | Full clean-clone verification |
| `M37-W03` | NOT_STARTED | — | — | Final frozen benchmark |
| `M37-W04` | NOT_STARTED | — | — | Final Simplify side-by-side study |
| `M37-W05` | NOT_STARTED | — | — | Independent review |
| `M37-W06` | NOT_STARTED | — | — | Release documentation |
| `M37-W07` | NOT_STARTED | — | — | Freeze release candidate |

## Next READY package

- ID: `M00-W04`
- Reason: M00-W01 through M00-W03 are VERIFIED; M00-W04 (Create root verification commands) is the next package in M00's listed order, and M00 has no dependency milestones.
- Required reading: CLAUDE.md; docs/MASTER_IMPLEMENTATION_SPEC.md §8.5 (required repository verification commands: pnpm lint/typecheck/test/test:e2e/test:visual/verify, uv ruff/mypy/pytest, cargo fmt/clippy/test — `pnpm verify` must aggregate all required non-live checks and fail on any skipped mandatory suite), §M00 (verification, exit gate); docs/PROJECT_STATUS.md; docs/DECISIONS.md; docs/TEST_EVIDENCE.md § M00-W03 (existing commands and empty-suite semantics to build on); docs/KNOWN_ISSUES.md (KI-0001 — build-task deferral interacts with the aggregate command design).

## Known release blockers

- All milestones M00–M37 are unaccepted; the release gate stays NOT_READY until every mandatory milestone is ACCEPTED and the Section 2 metrics pass (spec §2.2).
- Process (not a product defect, historical): M00-W01 was authored in a cloud environment without github.com egress and pushed by the owner afterwards. From M00-W02 onward, work runs on the owner's development machine (macOS, Apple silicon) with direct access to `origin` (verified via `git ls-remote` during M00-W02), so this blocker no longer applies to new work.

## Status conventions and update rules

- States: `NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED` — exactly one state per work package at all times (spec §1.1).
- No more than one work package is IN_PROGRESS at any time (spec §12).
- VERIFIED requires passing required tests plus recorded evidence in docs/TEST_EVIDENCE.md; ACCEPTED requires all milestone exit gates (spec §1.1).
- Dependency rules enforced by `scripts/validate_status.py`: (a) a package may be READY or started only when every dependency milestone listed in the spec for its milestone is fully VERIFIED/ACCEPTED; (b) within a milestone, packages proceed in listed order — a package may be READY or started only when all lower-numbered packages are VERIFIED/ACCEPTED. Convention (b) matches the spec's intra-milestone sequencing; relaxing it for a genuinely parallel pair requires an ADR in docs/DECISIONS.md.
- Revision anchoring: "Verified revision" records `tree <hash>` (content-only, `git rev-parse HEAD^{tree}`), optionally plus the containing commit. Tree hashes are machine-independent for identical content, so verification survives the owner re-committing the same files.
- Every edit to this file must be followed by a passing `python3 scripts/validate_status.py` run.

