# Project Status

Spec version: 1.4
Repository revision: governance closeout of verified content commit e3a5859d0e30823ca81384cb7cfd53d1951afc64 / tree 63c2dd89c4f02b6ba929b52f8fb862e9e3880758
Last updated: 2026-08-07T16:05:00-04:00
Current phase: A — Contract, measurement, and early autofill proof
Current milestone: M02
Current work package: M02-W04
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

- State: M02-W04 (capture baseline algorithms) is IN_PROGRESS in the owner-selected Claude Fable 5 Max implementation session started 2026-08-07; no package is READY and M02 remains IN_PROGRESS. M02-W03 (mock ATS lab v1) remains VERIFIED at content commit `e3a5859d0e30823ca81384cb7cfd53d1951afc64` / tree `63c2dd89c4f02b6ba929b52f8fb862e9e3880758` (parent commit `b4e48101df78b89107aec2de6f1d1c877c3f5513`) after the independent fixed-scope Fable 5 Max verification returned FABLE_CLEAR_FOR_M02_W03_GOVERNANCE (2026-08-07). M02-W02 remains VERIFIED after the independent fixed-scope Fable 5 Max verification returned FABLE_CLEAR_FOR_M02_W02_GOVERNANCE (2026-08-05) for the exact content commit `0c52cab5987a6497e28db5a30186c82a053c88aa` / tree `ebe546966ed403f3155dcd04779984671e565d06` (parent commit `9da85bcc98c39b071e5047304b0101a2f8397f9d`). M02-W01 remains VERIFIED after the independent Fable 5 Max acceptance verification returned FABLE_CLEAR_FOR_GOVERNANCE_CLOSEOUT (2026-08-03) for the exact audited content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree `666987a702d274aabcee8bbfdfae5afd5d9c18e7` (parent correction commit `f1b727450c2a25bfb6f806a51bcde30b9fed156c`). M01-W07 remains VERIFIED and M01 remains ACCEPTED at corrective content tree `51c81bedb909ae7b6d54569abc8b8fb13af1c590` (commit `c24ccf989726a4870c152a22eec7b6f48e125be8`). M00-W01 through M00-W11 and M01-W01 through M01-W06 remain VERIFIED at their preserved content trees, and M00 remains ACCEPTED. The invalidated M02-W01 content anchor `a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` and stamp `5309909a881fef8fd00bc16c6203700683aa8fb5` are historical evidence only. Prior corrective base `4fb164ff3351fdedcee3542350a9fa565264d1fa` / tree `c21d246256d844bd839de08609a0694e52df2303` remains unaccepted execution evidence after the reconciled Opus/SOL verdict B.
- Exact boundary: the earlier fresh independent audit of commit `83d83ff1b805b57ca7fecf2797cf35e2036e0740` / tree `f9fddf739fa21d06517574f839625bfb931521ee` reported six bounded blockers (`AUD-PLAT-001` through `AUD-PLAT-003` and `AUD-VER-001` through `AUD-VER-003`); that exact tree remains failed audit evidence, and its three-OS run `30723624756` was genuinely green but later semantically invalidated by those six independently reproduced blockers. Parent-content run `30740481965` at `f1b7274` failed only on windows-2025 because a text-mode test helper emitted CRLF Python-inventory fixture bytes that the production canonicality rule correctly rejected; final commit `7523e09` writes those fixtures as explicit UTF-8/LF bytes and adds direct no-CRLF assertions. Hosted-green execution is evidence, not the sole reason for verification.
- Objective: implement M02-W04 (capture baseline algorithms) as the test-only workspace package packages/evaluation-baselines — a versioned EVALUATION_ONLY/NON_PRODUCTION baseline catalog with an exact original-untailored passthrough, a transparent keyword-overlap lexical matcher, an intentionally weak naive keyword-stuffing transform, one-shot résumé and short-answer generation through an injected exactly-once generateOnce boundary exercised by deterministic in-process fakes (no model runtime; real-model execution truthfully NOT_EXECUTED_NO_APPROVED_MODEL_LOCK), isolated CareerPulse/legacy-JobApply behavior-observation records without importing their code (CareerPulse UNAVAILABLE; kalwad/JobApply NOT_ATTEMPTED with a bounded metadata-only probe pinning head commit c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd and license NOASSERTION), and a truthful NOT_CAPTURED Simplify comparison slot owned by M02-W13/W14 and M05-W11. The baselines establish the reproducible comparison floor of spec §8.4; they carry no gate authority and no production behavior. M02-W01 through M02-W03 remain VERIFIED and are not reopened. M02 milestone acceptance and the Autofill Feasibility Gate remain future work (gate evaluation belongs to M02-W14 and the M02-W15 decision). No benchmark runner, corpus freeze, holdout content, extension behavior, product schema, autofill capability, production ATS support claim, or later-package artifact is authorized.
- Closeout verification: the fixed-scope Fable 5 Max verification session independently confirmed the complete finite M02-W03 contract matrix — catalog 1.0.0 / schema 1 with exactly 32 stable cases across exactly 16 routes and committed manifest digest `a1fb06f97b156785937b1b6251cf9cd96d330c39e6cab274aafd63f10ccf4c28`; test-side expected transitions covering the catalog exactly 1:1 with no expected value, sensitivity decision, or scanner ground truth in the served DOM; two consecutive clean builds byte-identical (41 files); direct real-browser proof of native, real React 19.2.8 and Vue 3.5.41 controlled behavior (framework events commit state; stale direct DOM writes never become accepted state; forced and fixed-delay rerenders preserve state; observable site-side rewrites), dynamic insertion/removal/dependent-required/delayed-insertion/node-replacement behavior, the full multipage flow (validation-blocked Next, Back persistence, complete review, deterministic 600 ms receipt `RCPT-MOCK-0001`, duplicate warning without a second receipt, deterministic reset, CAPTCHA pause that blocks until the labeled test-only manual action), same-origin iframe frame-local identity, open shadow-root validation, ARIA combobox/listbox keyboard interaction with exact option identity, genuine virtualization (480 semantic options, bounded mounted window, scroll re-windowing, offscreen selection, selection surviving rerender), deterministic date/phone normalization, local in-memory upload accept/reject/oversize/clear with exact metadata, custom/cross-field/delayed validation, the hidden optional honeypot rejecting populated submissions, and inert prompt-injection fixtures — with seven fixed mutations (catalog tamper, duplicate ID, DOM metadata leak, non-loopback fetch, innerHTML injection sink, Date.now receipt identity, virtualization removal) all rejected, mock-lab unit 32/32, Playwright 59/59 across 17 files (58 lab + preserved browser smoke), M02-W01 regression 108/108, M02-W02 regression 57/57, fixture package 166/166, unit TypeScript 2,645 (10/10 turbo tasks), focused contracts 662, Rust 1 plus 10, Python 977/977 POSIX items, and loopback-only network behavior (zero non-loopback requests; browser-level interception fails any non-loopback request).
- Dependencies and historical proof: M00 and M01 remain ACCEPTED. The canonical spec hash `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943` remains unchanged. The prior M02-W01 clean clones and three-OS run `30446331580` prove only that the invalidated bytes executed as recorded; they do not establish semantic correctness. Final M01 run `30423199771` remains the preserved hosted prerequisite.
- Critical-gate state: AUTOFILL_FEASIBILITY, RESUME_PAGEFIT_FEASIBILITY, WORKDAY_GUIDED_PRE_SUBMIT, and CROSS_PLATFORM_CORE remain NOT_EVALUATED. Package verification does not evaluate a critical gate.
- Evidence: content run `31129161772` at head SHA exactly `e3a5859d0e30823ca81384cb7cfd53d1951afc64` was a manual `workflow_dispatch` on `main` (the committed ci.yml supports workflow_dispatch), dispatched after no push-triggered run had appeared for the pushed content commit; it succeeded on ubuntu-24.04 (job `92713466366`), macos-15 (job `92713466380`), and windows-2025 (job `92713466359`) with exact-SHA checkout on every job, doctor 23 pass / 0 warning / 0 fail / 1 not-yet-applicable, 59/59 Playwright tests, 32/32 mock-lab unit tests, W01 108/108 and W02 57/57, platform-exact Python inventories (977/977 POSIX, 975/975 Windows), canonical verification exit 0 with every ACTIVE suite PASS and visual truthfully NOT_YET_APPLICABLE, a passing tracked-cleanliness assertion, and zero EPERM occurrences in the raw windows-2025 log. The initially missing push-triggered delivery is classified EXTERNAL_DELIVERY_GAP_NONBLOCKING; a late push-triggered run `31129599140` for the same exact SHA materialized about 21 minutes after the dispatch and also succeeded on all three jobs, confirming delayed rather than lost delivery. The M02-W02 anchor run `30932832896` (jobs `92071496949`, `92071496974`, `92071497000`) and the M02-W01 anchor run `30741379567` (jobs `91479336277`, `91479336288`, `91479336324`) remain the preserved hosted proofs of the verified foundation. The defect history that drove the M02-W01 corrective cycle remains preserved in docs/KNOWN_ISSUES.md (KI-0039 through KI-0045, FIXED) and in the historical docs/TEST_EVIDENCE.md entries. The governance closeout records are docs/TEST_EVIDENCE.md § M02-W03 — Governance closeout after independent Fable verification (2026-08-07), § M02-W02 — Governance closeout after independent Fable verification (2026-08-05), and § M02-W01 — Governance closeout after independent Fable acceptance verification (2026-08-03).
- Blockers: NONE. KI-0039 through KI-0045 are FIXED with closeout evidence in docs/KNOWN_ISSUES.md; the KI-0041 generic-Base64 hypothesis remains explicitly outside the accepted M02-W01 detector contract and nonblocking. KI-0022, KI-0026, and KI-0027 remain DEFERRED with their named future owners. KI-0033 through KI-0038 remain historically FIXED and do not reopen M01.

## Milestone table

| Milestone | State | Verified revision | Notes |
|---|---|---|---|
| M00 | ACCEPTED | tree 7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91 | Phase A. Re-accepted under v1.4 after the M00-W11 exact-byte adoption and hosted three-OS proof; v1.2/v1.3 acceptances remain historical evidence |
| M01 | ACCEPTED | tree 51c81bedb909ae7b6d54569abc8b8fb13af1c590 | Phase A. Re-accepted after KI-0029 through KI-0032 corrective executable proof; the invalidated acceptance at tree 211c4b72cae4404dc277d8b31df240e4abfc717c and prior acceptances remain historical evidence |
| M02 | IN_PROGRESS | — | Phase A. Evaluation corpus, mock ATS lab, frozen baselines, and Autofill Feasibility Gate (deps: M00, M01); M02-W01 VERIFIED at tree 666987a702d274aabcee8bbfdfae5afd5d9c18e7, M02-W02 VERIFIED at tree ebe546966ed403f3155dcd04779984671e565d06, M02-W03 VERIFIED at tree 63c2dd89c4f02b6ba929b52f8fb862e9e3880758, and M02-W04 IN_PROGRESS |
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
| `M01-W07` | VERIFIED | tree 51c81bedb909ae7b6d54569abc8b8fb13af1c590 | docs/TEST_EVIDENCE.md § M01-W07 | Corrected KI-0029 through KI-0032; all prior M01-W07 trees remain historical evidence |
| `M02-W01` | VERIFIED | tree 666987a702d274aabcee8bbfdfae5afd5d9c18e7 | docs/TEST_EVIDENCE.md § M02-W01 | Create synthetic profile/job/resume fixtures; corrected foundation verified after independent Fable acceptance (hosted run 30741379567) |
| `M02-W02` | VERIFIED | tree ebe546966ed403f3155dcd04779984671e565d06 | docs/TEST_EVIDENCE.md § M02-W02 | Create question and answer fixtures; verified after independent fixed-scope Fable verification (hosted run 30932832896) |
| `M02-W03` | VERIFIED | tree 63c2dd89c4f02b6ba929b52f8fb862e9e3880758 | docs/TEST_EVIDENCE.md § M02-W03 | Build mock ATS lab v1; verified after independent fixed-scope Fable verification (hosted run 31129161772) |
| `M02-W04` | IN_PROGRESS | — | — | Capture baseline algorithms; implementation in progress |
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
- Reason: M02-W04 is IN_PROGRESS (owner-selected Claude Fable 5 Max implementation session started 2026-08-07); no package may be READY while a package is IN_PROGRESS.
- Required reading: n/a while M02-W04 is IN_PROGRESS.

## Known release blockers

- NONE

## Status conventions and update rules

- States: `NOT_STARTED | READY | IN_PROGRESS | BLOCKED | IMPLEMENTED | VERIFIED | ACCEPTED` — exactly one state per work package at all times (spec §1.1).
- No more than one work package is IN_PROGRESS or READY at any time, and READY cannot coexist with IN_PROGRESS (spec §12).
- VERIFIED requires passing required tests plus recorded evidence in docs/TEST_EVIDENCE.md; ACCEPTED requires all milestone exit gates (spec §1.1).
- Dependency and readiness rules enforced by `scripts/validate_status.py`: (a) a package may be READY or started only when every dependency milestone listed in the spec is ACCEPTED; (b) packages follow the reviewed direct graph, including M00-W11 after M01-W06, M01-W07 after M00-W11, and M27-W01…W11 → W13 → W14 → W12; (c) M01-W07 requires M00-W11 VERIFIED and M00 ACCEPTED; (d) Gate A blocks M03 and its declared downstream qualifiers, Gate B blocks M06 without depending on final Windows/Ubuntu full-AI acceptance, Gate C blocks M21–M23, and Gate D at the final accepted M27 revision plus M27 acceptance blocks M28; (e) later auto-submit remains downstream of the accepted manual-review, exact-snapshot, duplicate-protection, and receipt milestones (spec §9.1, §12).
- Revision anchoring: "Verified revision" records `tree <hash>` (content-only, `git rev-parse HEAD^{tree}`), optionally plus the containing commit. Because a status edit cannot contain its own commit hash, the row of the package being closed out may carry the literal marker `stamp pending` between the content commit and the follow-up stamp commit; the validator accepts exactly that marker or a `tree <40-hex>` value for VERIFIED/ACCEPTED rows.
- Every edit to this file must be followed by a passing `python3 scripts/validate_status.py` run.
