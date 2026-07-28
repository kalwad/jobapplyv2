# Project Status

Spec version: 1.4
Repository revision: tree 7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91 (commit bde8ad49c31e63a7e09b50ad7cdf9af51416c182)
Last updated: 2026-07-28T00:54:00Z
Current phase: A — Contract, measurement, and early autofill proof
Current milestone: M01
Current work package: M01-W07
Overall release gate: NOT_READY

## Critical gates

| Gate | State | Evaluated revision | Corpus/holdout hash | Independent reviewer | Report |
|---|---|---|---|---|---|
| AUTOFILL_FEASIBILITY | NOT_EVALUATED | — | — | — | docs/gates/AUTOFILL_FEASIBILITY_GATE.md |
| RESUME_PAGEFIT_FEASIBILITY | NOT_EVALUATED | — | — | — | docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md |
| WORKDAY_GUIDED_PRE_SUBMIT | NOT_EVALUATED | — | — | — | docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md |
| CROSS_PLATFORM_CORE | NOT_EVALUATED | — | — | — | docs/gates/CROSS_PLATFORM_CORE_GATE.md |

Allowed gate states: NOT_EVALUATED | IN_PROGRESS | PASS | REDESIGN_REQUIRED | BLOCKED.
This table must always agree with the per-gate `- State:` lines in
docs/CRITICAL_GATES.md (enforced by `python3 scripts/validate_status.py`).

## Active work

- State: M01-W07 is the sole IN_PROGRESS package. M00-W11 remains VERIFIED at content tree `7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91` (commit `bde8ad49c31e63a7e09b50ad7cdf9af51416c182`); M00-W01 through M00-W10 and M01-W01 through M01-W06 remain VERIFIED at their exact preserved content trees and commits; M00 remains re-ACCEPTED under v1.4 and M01 remains IN_PROGRESS.
- Objective: define only the strict cross-platform capability and platform-service contracts owned by M01-W07 — certified platform identity/support tiers, capability and capability-state reporting, typed logical paths, secret-store, process-supervisor, native-messaging registrar, browser locator, model-runtime profile and runtime capability, installer/updater state, platform diagnostics, and cross-platform evidence/certification-input records — generate the deterministic TypeScript/Python surfaces, extend the representative cross-language compatibility proof, and stop before M02-W01. No operating-system implementation, adapter, secret store, process spawn, registration, browser detection, model runtime, installer, updater, UI, or provider behavior is in scope.
- Dependencies and hosted proof: M00-W11 and M01-W01 through M01-W06 are VERIFIED and M00 is ACCEPTED. Final M00-W11 run 30316803920 at `08749ca4d0334fcb38ba0828ec1ea193c06ce825` passed macos-15 job 90143959215, windows-2025 job 90143959244, and ubuntu-24.04 job 90143959299; the preceding content run 30316263598 at `bde8ad49c31e63a7e09b50ad7cdf9af51416c182` passed macos-15 job 90142343725, ubuntu-24.04 job 90142343632, and windows-2025 job 90142343630. The inspected Windows log proves the exact checkout, locked dependency fetches, 43 status check groups, doctor 22 pass / 0 warning / 0 fail, 112 byte-identical generated contracts, 637 package tests, 287 focused contract tests (TypeScript 198 / Python 194 / Rust 193, Rust locked/offline), 621 Python tests, 1 native-host and 8 contract-harness Rust tests, visual NOT_YET_APPLICABLE, verification exit 0, and no tracked changes.
- Critical-gate prerequisites: none for M01-W07. AUTOFILL_FEASIBILITY, RESUME_PAGEFIT_FEASIBILITY, WORKDAY_GUIDED_PRE_SUBMIT, and CROSS_PLATFORM_CORE remain NOT_EVALUATED. M01-W07 defines contract shape only; it certifies no platform, produces no evidence bundle, and evaluates no gate.
- Evidence: docs/TEST_EVIDENCE.md § M01-W07 records the in-progress platform contract inventory, the extended finite semantic-rule architecture, the expanded cross-language corpus, the generated TypeScript/Python surfaces, and the private representative Rust proof. Final local, clean-clone, and hosted evidence is pending. No UI, native-platform, secret-store, packaging, model-runtime, holdout, or certification evidence applies.
- Blockers: none for M01-W07. M02 and later milestones remain dependency-blocked; M03 also requires M02 ACCEPTED and Gate A PASS, M06 requires M05 ACCEPTED and Gate B PASS, M21 through its declared expansion boundary require Gate C PASS, and M28 requires M27 ACCEPTED and Gate D PASS at the final accepted M27 content tree.

## Milestone table

| Milestone | State | Verified revision | Notes |
|---|---|---|---|
| M00 | ACCEPTED | tree 7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91 | Phase A. Re-accepted under v1.4 after the M00-W11 exact-byte adoption and hosted three-OS proof; v1.2/v1.3 acceptances remain historical evidence |
| M01 | IN_PROGRESS | — | Phase A. M01-W01 through M01-W06 VERIFIED with hosted three-OS evidence; M01-W07 is the sole IN_PROGRESS package |
| M02 | NOT_STARTED | — | Phase A. Evaluation corpus, mock ATS lab, frozen baselines, and Autofill Feasibility Gate (deps: M00, M01) |
| M03 | NOT_STARTED | — | Phase B. Desktop shell, local orchestrator lifecycle, and authenticated health path (deps: M00, M01, M02; requires AUTOFILL_FEASIBILITY = PASS, M02 ACCEPTED) |
| M04 | NOT_STARTED | — | Phase B. Encrypted persistence, migrations, artifacts, backup, and restore (deps: M01, M03) |
| M05 | NOT_STARTED | — | Phase B. Local model runtime, exact model lock, domain benchmark, and Resume Tailoring/PageFit Feasibility Gate (deps: M02, M03, M04) |
| M06 | NOT_STARTED | — | Phase C. Canonical career evidence graph (deps: M01, M04, M05; requires RESUME_PAGEFIT_FEASIBILITY = PASS, M05 ACCEPTED) |
| M07 | NOT_STARTED | — | Phase C. Resume and document import with fact-review workflow (deps: M05, M06) |
| M08 | NOT_STARTED | — | Phase C. Complete profile, eligibility, preferences, onboarding, and voice samples (deps: M06, M07) |
| M09 | NOT_STARTED | — | Phase D. Semantic resume schema, editor, versions, branching, and diffs (deps: M05, M06, M08) |
| M10 | NOT_STARTED | — | Phase D. Deterministic resume rendering, ATS-safe template, PDF/DOCX export (deps: M02, M05, M09) |
| M11 | NOT_STARTED | — | Phase D. Job capture, snapshotting, normalization, and requirement extraction (deps: M05, M06) |
| M12 | NOT_STARTED | — | Phase D. Explainable eligibility, evidence coverage, terminology, parseability, and readability (deps: M09, M10, M11) |
| M13 | NOT_STARTED | — | Phase D. Grounded whole-document resume tailoring (deps: M05, M09, M11, M12) |
| M14 | NOT_STARTED | — | Phase D. One-page optimization and document quality optimizer (deps: M05, M10, M12, M13) |
| M15 | NOT_STARTED | — | Phase D. Evidence-backed cover-letter system (deps: M05, M06, M11, M12) |
| M16 | NOT_STARTED | — | Phase D. Short-answer generation, semantic memory, voice adaptation, and batch review (deps: M05, M06, M08, M11) |
| M17 | NOT_STARTED | — | Phase E. Production Manifest V3 extension foundation and secure native transport (deps: M01, M02, M03; requires AUTOFILL_FEASIBILITY = PASS) |
| M18 | NOT_STARTED | — | Phase E. Production field ontology, form engine, resolver, transactional drivers, and review panel (deps: M02, M08, M16, M17; requires AUTOFILL_FEASIBILITY = PASS) |
| M19 | NOT_STARTED | — | Phase E. Workday production adapter foundation, tenant taxonomy, and complete field coverage (deps: M02, M11, M16, M18; requires AUTOFILL_FEASIBILITY = PASS) |
| M20 | NOT_STARTED | — | Phase E. Workday guided pre-submit navigation, end-to-review automation, and production certification (deps: M16, M18, M19; requires M19 ACCEPTED) |
| M21 | NOT_STARTED | — | Phase F. Greenhouse adapter (deps: M02, M11, M18, M20; requires WORKDAY_GUIDED_PRE_SUBMIT = PASS, M19 ACCEPTED, M20 ACCEPTED) |
| M22 | NOT_STARTED | — | Phase F. Lever adapter (deps: M02, M18, M20, M21; requires WORKDAY_GUIDED_PRE_SUBMIT = PASS) |
| M23 | NOT_STARTED | — | Phase F. Ashby adapter (deps: M02, M18, M20, M21, M22; requires WORKDAY_GUIDED_PRE_SUBMIT = PASS) |
| M24 | NOT_STARTED | — | Phase F. Multipage flows, document/answer selection, dynamic forms, and complete application review (deps: M16, M18, M19, M20, M21, M22, M23) |
| M25 | NOT_STARTED | — | Phase G. Application tracker, exact snapshots, receipts, duplicates, filters, and analytics (deps: M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24) |
| M26 | NOT_STARTED | — | Phase G. Job-specific interview practice and evidence-aware feedback (deps: M06, M11, M16) |
| M27 | NOT_STARTED | — | Phase G. Security, privacy, prompt-injection, performance, accessibility, diagnostics, and packaging hardening (deps: M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24, M25, M26) |
| M28 | NOT_STARTED | — | Phase G. Core closed-alpha acceptance gate (deps: M00–M27; requires M27 ACCEPTED and CROSS_PLATFORM_CORE = PASS) |
| M29 | NOT_STARTED | — | Phase H. iCIMS and SmartRecruiters adapters (deps: M28) |
| M30 | NOT_STARTED | — | Phase H. Taleo and SuccessFactors adapters (deps: M28) |
| M31 | NOT_STARTED | — | Phase H. Unsupported-site teaching, adapter maintenance, and compatibility operations (deps: M18, M28, M29, M30) |
| M32 | NOT_STARTED | — | Phase I. Permitted public job-source registry, ingestion service, normalization, and freshness (deps: M28) |
| M33 | NOT_STARTED | — | Phase I. Job search, filters, explainable ranking, alerts inside the app, and saved lists (deps: M08, M12, M32) |
| M34 | NOT_STARTED | — | Phase I. Job review, application preparation, approval, and queue UI (deps: M13, M14, M15, M16, M25, M33) |
| M35 | NOT_STARTED | — | Phase J. Resumable automatic-application execution engine in dry-run and pre-submit modes (deps: M20, M24, M25, M28, M29, M30, M31, M32, M33, M34) |
| M36 | NOT_STARTED | — | Phase J. Automatic submit for supported ATS flows, receipt enforcement, and safety controls (deps: M35; requires M35 ACCEPTED) |
| M37 | NOT_STARTED | — | Phase J. Automatic-application resilience, real-world pilot, and queue quality validation (deps: M36) |
| M38 | NOT_STARTED | — | Phase K. Final product validation, cross-platform release candidate, and completion audit (deps: M00, M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30, M31, M32, M33, M34, M35, M36, M37) |

## Work-package table

| Work package | State | Verified revision | Evidence link | Notes |
|---|---|---|---|---|
| `M00-W01` | VERIFIED | tree e1dd209417af97b3cab320b4ab01fbd702547136 | docs/TEST_EVIDENCE.md § M00-W01 | Create canonical project-memory files |
| `M00-W02` | VERIFIED | tree 15cc0edec64e4b4f986e7c1ee210d88a1e448140 | docs/TEST_EVIDENCE.md § M00-W02 | Scaffold the monorepo |
| `M00-W03` | VERIFIED | tree 323df745c419d8cc7809e88f10bbeca018fdfbb2 | docs/TEST_EVIDENCE.md § M00-W03 | Establish strict toolchain configuration |
| `M00-W04` | VERIFIED | tree 6c798abfd76824fd43c09c72615a3a976406f081 | docs/TEST_EVIDENCE.md § M00-W04 | Create root verification commands |
| `M00-W05` | VERIFIED | tree 0c6fe779cc56755983d39951cabcdf201867bae2 | docs/TEST_EVIDENCE.md § M00-W05 | Adopt and migrate the v1.2 Workday-first critical-risk rebaseline |
| `M00-W06` | VERIFIED | tree 9f9adc79cea15cb2f3a855b2b66463467822b5bf | docs/TEST_EVIDENCE.md § M00-W06 | Create CI and local preflight; repair current-HEAD macOS CI with job-scoped rustup state |
| `M00-W07` | VERIFIED | tree fee2902010eb90704c05e584fb6ff7964327cb0b | docs/TEST_EVIDENCE.md § M00-W07 | Seed traceability and status |
| `M00-W08` | VERIFIED | tree e05dbf9bdf9c190e8cd6b022d9611d65805740b7 | docs/TEST_EVIDENCE.md § M00-W08 | Adopt and migrate the v1.3 cross-platform rebaseline |
| `M00-W09` | VERIFIED | tree ae69a908cc31e0f1282c136c25fb7f92752680dd | docs/TEST_EVIDENCE.md § M00-W09 | Add Windows CI and platform-portability baseline |
| `M00-W10` | VERIFIED | tree 30c575dcc142a8276f0aed754cac50ed1fc3ab75 | docs/TEST_EVIDENCE.md § M00-W10 | Extend traceability and re-accept M00 under v1.3 |
| `M00-W11` | VERIFIED | tree 7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91 | docs/TEST_EVIDENCE.md § M00-W11 | Adopt and migrate the v1.4 familiarity-first UI and experimental-provider rebaseline |
| `M01-W01` | VERIFIED | tree 20c25e66d5792506870531aa4a8cd01971b362c9 | docs/TEST_EVIDENCE.md § M01-W01 | Define JSON Schema conventions |
| `M01-W02` | VERIFIED | tree 8a081776719d02ee7aeceb99bfe731f5663883c4 | docs/TEST_EVIDENCE.md § M01-W02 | Generate TypeScript and Python contracts; KI-0018 corrective closeout |
| `M01-W03` | VERIFIED | tree 2a56ed518797e811f8a0506e7834401c50eda166 | docs/TEST_EVIDENCE.md § M01-W03 | Define error taxonomy; KI-0020 corrective closeout |
| `M01-W04` | VERIFIED | tree 9ec01d8f8a734c703a943ea08012a10df023bf67 | docs/TEST_EVIDENCE.md § M01-W04 | Define capability and command allowlists |
| `M01-W05` | VERIFIED | tree 77fb23c61482ff87643db30f10ed27263254a7b2 | docs/TEST_EVIDENCE.md § M01-W05 | Build contract compatibility tests |
| `M01-W06` | VERIFIED | tree 6ed03405b8e252a583f6f89709722e1bd680d8de | docs/TEST_EVIDENCE.md § M01-W06 | Define feasibility and benchmark contracts |
| `M01-W07` | IN_PROGRESS | — | docs/TEST_EVIDENCE.md § M01-W07 | Define cross-platform capability and platform-service contracts; sole active package |
| `M02-W01` | NOT_STARTED | — | — | Create synthetic profile/job/resume fixtures |
| `M02-W02` | NOT_STARTED | — | — | Create question and answer fixtures |
| `M02-W03` | NOT_STARTED | — | — | Build mock ATS lab v1 |
| `M02-W04` | NOT_STARTED | — | — | Capture baseline algorithms |
| `M02-W05` | NOT_STARTED | — | — | Build evaluation runner |
| `M02-W06` | NOT_STARTED | — | — | Freeze v1 corpus and holdout manifest |
| `M02-W07` | NOT_STARTED | — | — | Scaffold the real MV3 feasibility extension |
| `M02-W08` | NOT_STARTED | — | — | Implement semantic field identity and per-frame scanner |
| `M02-W09` | NOT_STARTED | — | — | Implement deterministic ontology, resolver, and safety policy |
| `M02-W10` | NOT_STARTED | — | — | Implement transactional control drivers |
| `M02-W11` | NOT_STARTED | — | — | Implement dynamic state, reconciliation, and performance instrumentation |
| `M02-W12` | NOT_STARTED | — | — | Build ATS research variant matrix |
| `M02-W13` | NOT_STARTED | — | — | Build autofill benchmark and clean-room baseline harness |
| `M02-W14` | NOT_STARTED | — | — | Execute synthetic, holdout, public no-submit, and side-by-side evaluation |
| `M02-W15` | NOT_STARTED | — | — | Independent Autofill Feasibility Gate audit and decision |
| `M03-W01` | NOT_STARTED | — | — | Create Tauri desktop shell and initial design foundation |
| `M03-W02` | NOT_STARTED | — | — | Create FastAPI service skeleton |
| `M03-W03` | NOT_STARTED | — | — | Implement sidecar lifecycle |
| `M03-W04` | NOT_STARTED | — | — | Implement authenticated API client |
| `M03-W05` | NOT_STARTED | — | — | Add crash/restart behavior |
| `M03-W06` | NOT_STARTED | — | — | Package development build |
| `M03-W07` | NOT_STARTED | — | — | Package Windows x64 development build |
| `M03-W08` | NOT_STARTED | — | — | Package Ubuntu x64 development build |
| `M03-W09` | NOT_STARTED | — | — | Implement platform lifecycle, path, and process adapters |
| `M03-W10` | NOT_STARTED | — | — | Run cross-platform desktop lifecycle matrix |
| `M03-W11` | NOT_STARTED | — | — | Finalize and certify familiarity-first design system and desktop shell baseline |
| `M04-W01` | NOT_STARTED | — | — | Select and prove database encryption |
| `M04-W02` | NOT_STARTED | — | — | Create migration framework |
| `M04-W03` | NOT_STARTED | — | — | Create repository/data-access layer |
| `M04-W04` | NOT_STARTED | — | — | Create encrypted artifact store |
| `M04-W05` | NOT_STARTED | — | — | Implement backup/export/restore |
| `M04-W06` | NOT_STARTED | — | — | Implement deletion and retention |
| `M04-W07` | NOT_STARTED | — | — | Implement macOS Keychain secret-store adapter |
| `M04-W08` | NOT_STARTED | — | — | Implement Windows Credential Manager and DPAPI adapter |
| `M04-W09` | NOT_STARTED | — | — | Implement Ubuntu Secret Service adapter |
| `M04-W10` | NOT_STARTED | — | — | Prove portable encrypted backup and filesystem semantics |
| `M05-W01` | NOT_STARTED | — | — | Implement runtime adapter |
| `M05-W02` | NOT_STARTED | — | — | Create candidate model lock |
| `M05-W03` | NOT_STARTED | — | — | Implement provider-neutral typed generation client and local adapter |
| `M05-W04` | NOT_STARTED | — | — | Integrate embeddings |
| `M05-W05` | NOT_STARTED | — | — | Build comparative domain model benchmark |
| `M05-W06` | NOT_STARTED | — | — | Select and lock the exact production model |
| `M05-W07` | NOT_STARTED | — | — | Define the resume/PageFit feasibility vertical slice |
| `M05-W08` | NOT_STARTED | — | — | Implement whole-document requirement/evidence planner |
| `M05-W09` | NOT_STARTED | — | — | Implement bounded writer and atomic claim verifier |
| `M05-W10` | NOT_STARTED | — | — | Implement controlled ATS-safe render and measured PageFit prototype |
| `M05-W11` | NOT_STARTED | — | — | Execute blind and side-by-side resume benchmark |
| `M05-W12` | NOT_STARTED | — | — | Independent Resume Tailoring/PageFit Gate audit and decision |
| `M05-W13` | NOT_STARTED | — | — | Define versioned platform model-runtime profiles |
| `M05-W14` | NOT_STARTED | — | — | Validate Windows model-runtime capability and core fallback |
| `M05-W15` | NOT_STARTED | — | — | Validate Ubuntu model-runtime capability and core fallback |
| `M05-W16` | NOT_STARTED | — | — | Implement cross-platform model capability UX and graceful degradation |
| `M05-W17` | NOT_STARTED | — | — | Finalize provider boundary, selection UX, and Gate B re-anchoring |
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
| `M08-W07` | NOT_STARTED | — | — | Build familiarity-first onboarding/profile workspace and migration |
| `M09-W01` | NOT_STARTED | — | — | Productionize semantic resume schema |
| `M09-W02` | NOT_STARTED | — | — | Build resume-from-profile creation |
| `M09-W03` | NOT_STARTED | — | — | Build semantic editor |
| `M09-W04` | NOT_STARTED | — | — | Implement immutable versions and branches |
| `M09-W05` | NOT_STARTED | — | — | Implement semantic diffs |
| `M09-W06` | NOT_STARTED | — | — | Protect locked content |
| `M09-W07` | NOT_STARTED | — | — | Build familiarity-first resume workspace shell |
| `M10-W01` | NOT_STARTED | — | — | Implement render intermediate representation |
| `M10-W02` | NOT_STARTED | — | — | Productionize first ATS-safe template |
| `M10-W03` | NOT_STARTED | — | — | Implement live preview |
| `M10-W04` | NOT_STARTED | — | — | Implement PDF export |
| `M10-W05` | NOT_STARTED | — | — | Implement DOCX export |
| `M10-W06` | NOT_STARTED | — | — | Build document validation |
| `M10-W07` | NOT_STARTED | — | — | Validate cross-platform rendering and bundled-font policy |
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
| `M12-W07` | NOT_STARTED | — | — | Build familiar match and keyword-analysis panel |
| `M13-W01` | NOT_STARTED | — | — | Implement tailoring-plan schema |
| `M13-W02` | NOT_STARTED | — | — | Productionize planner |
| `M13-W03` | NOT_STARTED | — | — | Implement candidate writer |
| `M13-W04` | NOT_STARTED | — | — | Implement atomic claim verifier |
| `M13-W05` | NOT_STARTED | — | — | Implement coherence and duplication lint |
| `M13-W06` | NOT_STARTED | — | — | Build review and accept UI |
| `M13-W07` | NOT_STARTED | — | — | Evaluate against baseline |
| `M14-W01` | NOT_STARTED | — | — | Implement measured layout model |
| `M14-W02` | NOT_STARTED | — | — | Productionize content utility scoring |
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
| `M17-W01` | NOT_STARTED | — | — | Productionize WXT extension and stable panel architecture |
| `M17-W02` | NOT_STARTED | — | — | Implement permission strategy |
| `M17-W03` | NOT_STARTED | — | — | Implement message schemas and validators |
| `M17-W04` | NOT_STARTED | — | — | Implement Rust native host |
| `M17-W05` | NOT_STARTED | — | — | Implement extension status states inside the stable shell |
| `M17-W06` | NOT_STARTED | — | — | Extend real extension E2E harness |
| `M17-W07` | NOT_STARTED | — | — | Implement macOS native-host registration lifecycle |
| `M17-W08` | NOT_STARTED | — | — | Implement Windows native-host registration and binary protocol |
| `M17-W09` | NOT_STARTED | — | — | Implement Ubuntu native-host registration lifecycle |
| `M17-W10` | NOT_STARTED | — | — | Run cross-platform real extension/native-host E2E |
| `M17-W11` | NOT_STARTED | — | — | Complete, polish, and certify familiarity-first extension experience |
| `M18-W01` | NOT_STARTED | — | — | Productionize field ontology and contracts |
| `M18-W02` | NOT_STARTED | — | — | Productionize scanner and field re-resolution |
| `M18-W03` | NOT_STARTED | — | — | Productionize deterministic resolver |
| `M18-W04` | NOT_STARTED | — | — | Productionize transactional control drivers |
| `M18-W05` | NOT_STARTED | — | — | Implement production decision engine |
| `M18-W06` | NOT_STARTED | — | — | Build review panel |
| `M18-W07` | NOT_STARTED | — | — | Benchmark production generic engine |
| `M19-W01` | NOT_STARTED | — | — | Productionize the Workday tenant-pattern taxonomy |
| `M19-W02` | NOT_STARTED | — | — | Implement Workday detection and candidate-session boundaries |
| `M19-W03` | NOT_STARTED | — | — | Implement multi-signal Workday step classification and state machine |
| `M19-W04` | NOT_STARTED | — | — | Implement core information and locale-aware controls |
| `M19-W05` | NOT_STARTED | — | — | Implement Workday repeater controller |
| `M19-W06` | NOT_STARTED | — | — | Implement exact document upload and resume-parser reconciliation |
| `M19-W07` | NOT_STARTED | — | — | Implement questions, eligibility, consent, and disclosures |
| `M19-W08` | NOT_STARTED | — | — | Implement conditional discovery, validation reading, and page reconciliation |
| `M19-W09` | NOT_STARTED | — | — | Implement Workday diagnostics, performance, and recovery foundation |
| `M19-W10` | NOT_STARTED | — | — | Execute Workday field-coverage matrix |
| `M19-W11` | NOT_STARTED | — | — | Independent Workday field-coverage audit |
| `M20-W01` | NOT_STARTED | — | — | Define `GUIDED_PRE_SUBMIT` contracts and user consent |
| `M20-W02` | NOT_STARTED | — | — | Implement Workday page-readiness proof |
| `M20-W03` | NOT_STARTED | — | — | Implement idempotent Workday navigation driver |
| `M20-W04` | NOT_STARTED | — | — | Implement complete fill-verify-next loop |
| `M20-W05` | NOT_STARTED | — | — | Implement intervention and resume workflow |
| `M20-W06` | NOT_STARTED | — | — | Implement final-review detection and cross-page audit |
| `M20-W07` | NOT_STARTED | — | — | Implement user controls and safe handoff |
| `M20-W08` | NOT_STARTED | — | — | Implement checkpointing and fault recovery |
| `M20-W09` | NOT_STARTED | — | — | Build Workday guided-flow fixture, holdout, and soak matrix |
| `M20-W10` | NOT_STARTED | — | — | Execute controlled end-to-review and Simplify comparison |
| `M20-W11` | NOT_STARTED | — | — | Independent Workday Gate C audit and owner decision |
| `M21-W01` | NOT_STARTED | — | — | Create adapter detection and job metadata |
| `M21-W02` | NOT_STARTED | — | — | Implement field mapping |
| `M21-W03` | NOT_STARTED | — | — | Implement document upload |
| `M21-W04` | NOT_STARTED | — | — | Implement dynamic question handling |
| `M21-W05` | NOT_STARTED | — | — | Implement receipt detection |
| `M21-W06` | NOT_STARTED | — | — | Validate real public pages in dry-run |
| `M22-W01` | NOT_STARTED | — | — | Implement detection/job capture |
| `M22-W02` | NOT_STARTED | — | — | Implement fields and custom questions |
| `M22-W03` | NOT_STARTED | — | — | Implement validation and receipt |
| `M22-W04` | NOT_STARTED | — | — | Build fixture and real dry-run matrix |
| `M22-W05` | NOT_STARTED | — | — | Refactor only proven common abstractions |
| `M23-W01` | NOT_STARTED | — | — | Implement detection/job capture |
| `M23-W02` | NOT_STARTED | — | — | Implement form mapping |
| `M23-W03` | NOT_STARTED | — | — | Implement uploads and validation |
| `M23-W04` | NOT_STARTED | — | — | Implement receipt and duplicate detection |
| `M23-W05` | NOT_STARTED | — | — | Complete initial adapter matrix |
| `M24-W01` | NOT_STARTED | — | — | Implement application-page state machine |
| `M24-W02` | NOT_STARTED | — | — | Implement application context |
| `M24-W03` | NOT_STARTED | — | — | Implement page-level question inventory |
| `M24-W04` | NOT_STARTED | — | — | Implement document chooser |
| `M24-W05` | NOT_STARTED | — | — | Implement final review |
| `M24-W06` | NOT_STARTED | — | — | Implement manual submission handoff |
| `M25-W01` | NOT_STARTED | — | — | Implement event-sourced application model |
| `M25-W02` | NOT_STARTED | — | — | Implement exact snapshots |
| `M25-W03` | NOT_STARTED | — | — | Implement receipt vault |
| `M25-W04` | NOT_STARTED | — | — | Implement duplicate detection |
| `M25-W05` | NOT_STARTED | — | — | Build tracker UI |
| `M25-W06` | NOT_STARTED | — | — | Implement CSV import/export |
| `M25-W07` | NOT_STARTED | — | — | Implement honest analytics |
| `M25-W08` | NOT_STARTED | — | — | Build familiarity-first tracker views and migration |
| `M26-W01` | NOT_STARTED | — | — | Generate question sets |
| `M26-W02` | NOT_STARTED | — | — | Capture responses |
| `M26-W03` | NOT_STARTED | — | — | Implement feedback rubric |
| `M26-W04` | NOT_STARTED | — | — | Implement improvement loop |
| `M26-W05` | NOT_STARTED | — | — | Evaluate feedback |
| `M27-W01` | NOT_STARTED | — | — | Threat-model review |
| `M27-W02` | NOT_STARTED | — | — | PII-safe logging and diagnostics |
| `M27-W03` | NOT_STARTED | — | — | Prompt-injection hardening |
| `M27-W04` | NOT_STARTED | — | — | Performance and memory |
| `M27-W05` | NOT_STARTED | — | — | Accessibility |
| `M27-W06` | NOT_STARTED | — | — | Crash recovery and data integrity |
| `M27-W07` | NOT_STARTED | — | — | macOS packaging |
| `M27-W08` | NOT_STARTED | — | — | Package, sign, and validate Windows x64 release candidate |
| `M27-W09` | NOT_STARTED | — | — | Package and validate Ubuntu x64 release candidate |
| `M27-W10` | NOT_STARTED | — | — | Finalize full-AI platform profiles, diagnostics, and support publication |
| `M27-W11` | NOT_STARTED | — | — | Implement signed cross-platform update and rollback |
| `M27-W12` | NOT_STARTED | — | — | Independent Cross-Platform Core Gate audit and decision |
| `M27-W13` | NOT_STARTED | — | — | Prototype isolated experimental ChatGPT-account OAuth provider |
| `M27-W14` | NOT_STARTED | — | — | Independent external-provider terms, security, compatibility, and ship decision |
| `M28-W01` | NOT_STARTED | — | — | Run frozen corpus |
| `M28-W02` | NOT_STARTED | — | — | Manual side-by-side evaluation |
| `M28-W03` | NOT_STARTED | — | — | External alpha pilot |
| `M28-W04` | NOT_STARTED | — | — | Defect burn-down |
| `M28-W05` | NOT_STARTED | — | — | Freeze core v1 interfaces |
| `M28-W06` | NOT_STARTED | — | — | Run Simplify-user migration familiarity and originality study |
| `M29-W01` | NOT_STARTED | — | — | iCIMS detection/capture |
| `M29-W02` | NOT_STARTED | — | — | iCIMS fill/upload/receipt |
| `M29-W03` | NOT_STARTED | — | — | SmartRecruiters detection/capture |
| `M29-W04` | NOT_STARTED | — | — | SmartRecruiters fill/upload/receipt |
| `M29-W05` | NOT_STARTED | — | — | Cross-adapter regression |
| `M30-W01` | NOT_STARTED | — | — | Taleo fixture taxonomy and adapter |
| `M30-W02` | NOT_STARTED | — | — | SuccessFactors fixture taxonomy and adapter |
| `M30-W03` | NOT_STARTED | — | — | Encoding and legacy-browser edge cases |
| `M30-W04` | NOT_STARTED | — | — | Compatibility and performance audit |
| `M31-W01` | NOT_STARTED | — | — | Implement teach-this-site mapping |
| `M31-W02` | NOT_STARTED | — | — | Implement safe selector strategies |
| `M31-W03` | NOT_STARTED | — | — | Implement fixture capture |
| `M31-W04` | NOT_STARTED | — | — | Implement compatibility dashboard |
| `M31-W05` | NOT_STARTED | — | — | Implement maintenance release process |
| `M32-W01` | NOT_STARTED | — | — | Define source policy and registry |
| `M32-W02` | NOT_STARTED | — | — | Implement official ATS collectors |
| `M32-W03` | NOT_STARTED | — | — | Implement public career-page collector |
| `M32-W04` | NOT_STARTED | — | — | Implement licensed-provider adapter |
| `M32-W05` | NOT_STARTED | — | — | Normalize and deduplicate |
| `M32-W06` | NOT_STARTED | — | — | Implement freshness/expiration |
| `M32-W07` | NOT_STARTED | — | — | Separate public cloud and private local data |
| `M33-W01` | NOT_STARTED | — | — | Implement local sync and search |
| `M33-W02` | NOT_STARTED | — | — | Implement eligibility prefilter |
| `M33-W03` | NOT_STARTED | — | — | Implement ranking |
| `M33-W04` | NOT_STARTED | — | — | Implement explainability |
| `M33-W05` | NOT_STARTED | — | — | Build saved/dismissed/list UI |
| `M33-W06` | NOT_STARTED | — | — | Evaluate ranking |
| `M33-W07` | NOT_STARTED | — | — | Build familiarity-first job-board and matches workspace |
| `M34-W01` | NOT_STARTED | — | — | Build job review workspace |
| `M34-W02` | NOT_STARTED | — | — | Build application preparation |
| `M34-W03` | NOT_STARTED | — | — | Implement preflight |
| `M34-W04` | NOT_STARTED | — | — | Implement explicit approval |
| `M34-W05` | NOT_STARTED | — | — | Build queue UI |
| `M34-W06` | NOT_STARTED | — | — | Implement plan invalidation |
| `M34-W07` | NOT_STARTED | — | — | Build familiar job-review-to-queue transition |
| `M35-W01` | NOT_STARTED | — | — | Define execution state machine |
| `M35-W02` | NOT_STARTED | — | — | Implement tab/session orchestration |
| `M35-W03` | NOT_STARTED | — | — | Implement idempotent step execution |
| `M35-W04` | NOT_STARTED | — | — | Implement interventions |
| `M35-W05` | NOT_STARTED | — | — | Implement dry-run mode |
| `M35-W06` | NOT_STARTED | — | — | Implement pre-submit mode |
| `M35-W07` | NOT_STARTED | — | — | Implement audit UI |
| `M36-W01` | NOT_STARTED | — | — | Define auto-submit certification |
| `M36-W02` | NOT_STARTED | — | — | Implement final readiness proof |
| `M36-W03` | NOT_STARTED | — | — | Implement bounded submit action |
| `M36-W04` | NOT_STARTED | — | — | Implement receipt enforcement |
| `M36-W05` | NOT_STARTED | — | — | Implement rate/concurrency policy |
| `M36-W06` | NOT_STARTED | — | — | Implement user controls and consent |
| `M36-W07` | NOT_STARTED | — | — | Roll out adapter by adapter |
| `M37-W01` | NOT_STARTED | — | — | Long-run synthetic soak |
| `M37-W02` | NOT_STARTED | — | — | Controlled real pre-submit pilot |
| `M37-W03` | NOT_STARTED | — | — | Controlled real auto-submit pilot |
| `M37-W04` | NOT_STARTED | — | — | Quality and spam safeguards |
| `M37-W05` | NOT_STARTED | — | — | Failure taxonomy burn-down |
| `M37-W06` | NOT_STARTED | — | — | Publish compatibility and limits |
| `M38-W01` | NOT_STARTED | — | — | Requirements traceability audit |
| `M38-W02` | NOT_STARTED | — | — | Full clean-clone verification |
| `M38-W03` | NOT_STARTED | — | — | Final frozen benchmark |
| `M38-W04` | NOT_STARTED | — | — | Final Simplify side-by-side study |
| `M38-W05` | NOT_STARTED | — | — | Independent review |
| `M38-W06` | NOT_STARTED | — | — | Release documentation |
| `M38-W07` | NOT_STARTED | — | — | Freeze release candidate |
| `M38-W08` | NOT_STARTED | — | — | Final familiarity, originality, and experimental-provider audit |

## Next READY package

- ID: NONE
- Reason: M01-W07 is the sole IN_PROGRESS package; no package may be READY concurrently.
- Required reading: `CLAUDE.md`; docs/MASTER_IMPLEMENTATION_SPEC.md §1, §5.2–§5.5, §8.5, §9 M01 (especially M01-W07), and §12; packages/contracts/README.md; packages/contracts/generated/README.md; packages/contracts/test/contract/README.md; docs/PROJECT_STATUS.md; docs/DECISIONS.md; docs/TEST_EVIDENCE.md; docs/KNOWN_ISSUES.md; docs/PLATFORM_SUPPORT.md; docs/REQUIREMENTS_TRACEABILITY.md.

## Known release blockers

- No M00 blocker remains. M00-W11 is VERIFIED with hosted three-OS evidence and M00 is re-ACCEPTED under v1.4; M01-W01 through M01-W06 remain VERIFIED and the mandatory contract and contract-gen suites remain ACTIVE/PASS. M01-W07 is the sole IN_PROGRESS package.
- Milestones M01–M38 are unaccepted; the release gate stays NOT_READY until every mandatory milestone is ACCEPTED, the Section 2 metrics pass, and all four critical gates are PASS at the final release revision (spec §2.2, §16).
- CROSS_PLATFORM_CORE is NOT_EVALUATED. M28 remains blocked until M27 is ACCEPTED, native Gate D evidence exists on all three certified targets, full-AI Windows and Ubuntu profiles are accepted by M27-W10, and Gate D is PASS at the final accepted M27 content tree (or an explicit accepted independent gate-neutral re-anchoring).
- M00-W07 activation guard satisfied: final M00-W06 stamp-commit run 30218521997 passed required macOS and Linux CI at starting HEAD `6946c5929037b475f61ee25bf3e8adb9c7c0e9a9`.
- Historical v1.2 closeout remains preserved: M00-W07 content run 30220428453 and final run 30220655705 passed required macOS/Ubuntu jobs. That historical acceptance does not satisfy the expanded v1.3 M00 exit gate.
- Process (not a product defect, historical): M00-W01 was authored in a cloud environment without github.com egress and pushed by the owner afterwards. From M00-W02 onward, work runs on the owner's development machine (macOS, Apple silicon) with direct access to `origin`, so this blocker no longer applies to new work.

## Status conventions and update rules

- States: `NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED` — exactly one state per work package at all times (spec §1.1).
- No more than one work package is IN_PROGRESS or READY at any time, and READY cannot coexist with IN_PROGRESS (spec §12).
- VERIFIED requires passing required tests plus recorded evidence in docs/TEST_EVIDENCE.md; ACCEPTED requires all milestone exit gates (spec §1.1).
- Dependency and readiness rules enforced by `scripts/validate_status.py`: (a) a package may be READY or started only when every dependency milestone listed in the spec is ACCEPTED; (b) packages follow the reviewed direct graph, including M00-W11 after M01-W06, M01-W07 after M00-W11, and M27-W01…W11 → W13 → W14 → W12; (c) M01-W07 requires M00-W11 VERIFIED and M00 ACCEPTED; (d) Gate A blocks M03 and its declared downstream qualifiers, Gate B blocks M06 without depending on final Windows/Ubuntu full-AI acceptance, Gate C blocks M21–M23, and Gate D at the final accepted M27 revision plus M27 acceptance blocks M28; (e) later auto-submit remains downstream of the accepted manual-review, exact-snapshot, duplicate-protection, and receipt milestones (spec §9.1, §12).
- Revision anchoring: "Verified revision" records `tree <hash>` (content-only, `git rev-parse HEAD^{tree}`), optionally plus the containing commit. Because a status edit cannot contain its own commit hash, the row of the package being closed out may carry the literal marker `stamp pending` between the content commit and the follow-up stamp commit; the validator accepts exactly that marker or a `tree <40-hex>` value for VERIFIED/ACCEPTED rows.
- Every edit to this file must be followed by a passing `python3 scripts/validate_status.py` run.
