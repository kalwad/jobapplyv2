# Gate A report — AUTOFILL_FEASIBILITY

Gate report for the blocking Autofill Feasibility Gate (spec §2.3; owner M02). Authoritative lifecycle state is docs/CRITICAL_GATES.md and docs/PROJECT_STATUS.md. This report records development observations and outstanding evidence; it is not a final decision.

## Identity

- Gate: AUTOFILL_FEASIBILITY
- Owning milestone: M02 (M02-W07 through M02-W15)
- Blocks: M03 readiness; M17/M18/M19 retain Gate A PASS qualifiers.
- State: IN_PROGRESS
- Evaluated revision: pending frozen W14/W15 evidence; current source is uncommitted and source-inventory scoped.
- Gate authority / independent decision: none yet.

## Blocking thresholds

The complete numerical and zero-tolerance table in spec §2.3 remains in force. OD-035 / ADR-0006 waives owner-controlled hidden holdout and per-package stopping only. Visible corpus, physical safety, accuracy, full-settlement performance, actual public/Simplify/legacy comparison and independent-review obligations remain individually reportable. No threshold is weakened to obtain PASS.

## Historical development evaluation runs

All four runs executed all 200 frozen W12 expansion recipes in real Chromium 151.0.7922.34 with the actual MV3 extension on Apple M5/24 GiB; AI/navigation/submission disabled; 75 ms settlement and 20 ms controlled rerender. They are labeled DEVELOPMENT / PARTIAL_GATE_EVIDENCE / NO_GATE_AUTHORITY. Native control count is 4060; authored logical controls 4020. The declared supported cohort is contact facts only.

| Historical campaign | Scored / executed | Logical controls scored | Ordinary precision | Required ordinary recall | Required reporting | Persistence | Full-settlement p95 (ms) | Command outcome |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Initial development | 140 / 200; 60 refused | 2634 | 880/910 | 740/850 | 540/540 | 910/910 | 1338.2853750000068 | exit 0; 1 test passed; no target-performance assertion |
| Corrected development | 200 / 200; 0 refused | 4020 | 1485/1485 | 1275/1275 | 770/770 | 1485/1485 | 1799.8664160000044 | exit 0; 1 test passed; no target-performance assertion |
| Sequential batched development | 200 / 200; 0 refused | 4020 | 1485/1485 | 1275/1275 | 770/770 | 1485/1485 | 2087.8410830000066 | exit 1; target assertion expected <=1500 ms |
| Sequential batched, trace disabled | 200 / 200; 0 refused | 4020 | 1485/1485 | 1275/1275 | 770/770 | 1485/1485 | 2009.8366249999963 | exit 1; target assertion expected <=1500 ms |

These are different source inventories, not repeated measurements of one frozen candidate. Initial timing cannot compensate for deficient initial accuracy/refusals. Corrected/batched numeric accuracy and safety observations remain partial evidence; the batched campaign explicitly fails target timing. Its raw observations, assessment, representative screenshot and stdout remain; the inspected failure trace was cleaned by the next run and is not separately retained.

| Campaign evidence directory | Source inventory SHA-256 | Compressed raw bundle SHA-256 | Built extension SHA-256 |
|---|---|---|---|
| docs/evidence/m02-w14-development | 273bdb73c68d0b0ade7f6791721a4f0a01bf4c0590a85f44bd62977f91b3e5e2 | f417920083d7ce55d78ebafc6e60efed6919302dbae242b3ff6f943721edfc02 | 4744daf3f7ecebdbba24fb8cc2d9ad0be9fb3837d6385362f5a29510f410dd8d |
| docs/evidence/m02-w14-corrected | 968c8d4bd5fd6c56ef5fefb3351f1727f26f1f1e328289b46103418900af98bb | 7796a5d32c14ac690c1b1bbf39923aea66ca00a9f85f63a834d9eba3129f175c | 4ba496fa95f74480ff6c562249ad92c8afb61472cd7e76af8488bbf1e2976883 |
| docs/evidence/m02-w14-batched | 4c022528a49a48037ac3426c0764e05a641e5af6f821035ca8e55d222ffcb4c3 | 1ae788b9f2ff539e41d01ce4f1987a24d0ec2f92c07e10780ce8dc7df7a54ba7 | 4ba496fa95f74480ff6c562249ad92c8afb61472cd7e76af8488bbf1e2976883 |
| docs/evidence/m02-w14-untraced | 97f86fb43cf25004991ed5802be85f7ed82322472d76eb6215d769ab72c45639 | ba5590b538956995f844ed9d0942106f17613b870191cd31428f59b680bdeb6d | 4ba496fa95f74480ff6c562249ad92c8afb61472cd7e76af8488bbf1e2976883 |

The batched and untraced runs additionally record source/build unchanged at both endpoints, 1485 raw/audited physical actions and zero orphan actions. Corrected/batched preservation is 90/90 with zero empty-abstention violations. All campaigns record zero measured sensitive/honeypot/catastrophic-option/duplicate/navigation/submission/paused-boundary events; this scope does not imply unexercised-driver safety.

The fourth trace-disabled full campaign completed all 200 cases with the same accuracy/safety observations, then failed at p95 2009.8366249999963 ms. Source/build were unchanged at both endpoints; the built extension matches run3. Tracing is not a sufficient explanation. Trace mode is confirmed by the explicit `--trace=off` invocation but is not yet committed in the saved run configuration. Full execution commands, focused historical outcomes and logs are recorded in docs/TEST_EVIDENCE.md § M02-W14. No final current canonical/clean-clone/hosted verification has been claimed.

## Corpus and feature scope

W12 matrix SHA-256 is `c160e7e006a3801443db43a0aa7926540d1949229cf5ffe11ae4649f6d01a878`; separate W06 development corpus SHA-256 is `93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8`. Original frozen inputs/registry remain unchanged. The 32-form W06 parent is not wholly executed by this contact campaign. Upload/repeater/date/checkbox/radio/custom-combobox operations, iframe/shadow DOM, page transitions, parser effects and long soak have no exercised-feature claim from these runs. W13 canonical abstention semantics remain unchanged; initial-value preservation is supplemental and does not credit automated fills or erase safety/reporting errors.

## Supplemental comparison and public preparation

- Supplemental actual legacy execution: `docs/evidence/m02-w14-external/capture-rerender.json` (SHA-256 `6ea6ec758d1a0976d9841bafdbf3943bc3a24ab20850262e59d995d936069385`) and `capture-summary.json` (SHA-256 `02fd904f1c4af21dac949c259a9b544f5e2253a9ff94e2cfba85fc52db271691`). Unchanged JobApply commit `c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd` extension and autofill-router components ran in an isolated synthetic wrapper with AI disabled, mode `COMPONENT_DETERMINISTIC_NO_AI`, authority NONE. Four grouped/en-US W13 same-input preimages each yielded eight input/change witnesses and eight controlled rerenders, seven exact ordinary final-value matches, a differently formatted phone, and empty country/region; zero observed navigation or submission. Phone expectations were not changed. UI claimed nine fills; eight event witnesses were observed. This is descriptive component evidence, not canonical Gate A rescoring or a full legacy product run; event meters do not exhaustively prove absence of eventless writes.
- JobApply's pinned attribution identifies `tcpsyn/CareerPulse` commit `629aa992f3e3c3d05575686f350a7173e8b5e108`. Their extension/app Git trees and MIT license blob match exactly. The one actual shared-component execution is not two independent full-product comparisons. Historical frozen registry statuses (`CareerPulse UNAVAILABLE`, `legacy NOT_ATTEMPTED`) remain untouched and are not a claim about this newer supplemental capture.
- Public inspection: `docs/evidence/m02-w14-external/public-current-matrix.json` (SHA-256 `9a9c933add2266977b9fe4f59996531719f27fbdefc44f423c09a410c6dec214`) selects 30 freshly inspected primary sources: Workday 10, Greenhouse 8, Lever 8, Ashby 4. Ten Workday pages stop at application-method choices; twenty other pages expose blank application controls. Fifty-four page observations, including stale/unsettled outcomes, are preserved in `public-structural-bundle.zip` (SHA-256 `4e35bb994a1b3ef5d60ec09a50572091e04590f1824e68c3f7a4b542cffb9be5`). **Public fill evaluations, scored controls and competitor comparisons are all zero.** Structural availability does not satisfy the Gate A public autofill requirement.
- Simplify: `docs/evidence/m02-w14-external/simplify-readiness.json` (SHA-256 `f5adb2e5d48406b185424c74e149161e211cc10962e2eab9f89c537e80dde138`) records official-source and normal-browser readiness inspection only. The official `/demo` is an inspected screenshot walkthrough, not an executable same-input form; the login route rendered a sign-in form. Actual comparison cases, autofill, profile writes, uploads, login actions, account creation and submissions are zero. An owner-prepared authenticated synthetic profile/session and installed Copilot version confirmation remain needed for the normal comparison route. Installed extension/token state is unknown: automatic approval review rejected `chrome://extensions/` because only HTTP(S) navigation is allowed; no workaround was attempted.

## Canonical foreground development run — 2026-10-16

All 200 W12 contact recipes now execute inside accepted W05 `runEvaluation` with real clock witnesses, replay-validated reports and raw/score manifest bindings. The declared foreground, trace-disabled configuration retains 75 ms settlement and 20 ms rerender; both endpoint visibility assertions pass. Target p95 is **864.5065410000025 ms**, below 1500 ms. Precision 1485/1485, required ordinary recall 1275/1275, reporting 770/770, persistence 1485/1485 and preservation 90/90; physical safety counters all zero. Source/build/declarations unchanged.

Source `sha256:6f98ddd6ea6fb40ccf769b6c977bc8d28830eeea5623dbde74451f22b1075350`, raw bundle `sha256:43a5395922029e67e2b436af085911911f3fa440d1508cbefe57f9243dcc6d2a`; artifacts and exact commands in docs/TEST_EVIDENCE.md § M02-W14 and docs/evidence/m02-w14-canonical-foreground. Canonical per-case PASS covers declared safety metrics; independent numeric assertions establish the contact-campaign rates. It is still partial Gate A evidence, with no final approval or whole-parent-corpus claim. Four historical runs above remain unchanged.

Actual inspect-only MV3 scan of all 30 dated public URLs reports Workday 10 and Ashby 4 UNRESOLVED, Greenhouse 8 and Lever 8 FOUND (552 descriptors), zero field transactions/fills/submissions. Source/Git/build are immutable; raw bundle and assessment live at docs/evidence/m02-w14-public-inspection. Public fill accuracy and comparisons are unexecuted.

## Holdout

Holdout result: WAIVED_BY_OWNER (OD-035 / accepted ADR-0006, owner instructions 2026-10-16). Original frozen manifests are preserved. No hidden holdout was executed or passed; the execution log remains historical.

## Independent review

Independent reviewer: pending. M02-W15 has not started. Implementation authorship, read-only assistance and supplemental capture do not constitute independent final Gate A approval.

## Decision

Owner decision: pending. Gate A remains IN_PROGRESS; M02-W14 remains IN_PROGRESS, M02-W15 NOT_STARTED, M02 unaccepted and M03 NOT_STARTED. Allowed final decisions remain PASS | REDESIGN_REQUIRED | BLOCKED, tied to exact evidence/frozen revision. Numerical/comparison/safety obligations cannot be satisfied by prose.

## History

| Date | Revision / scope | Result | Notes |
|---|---|---|---|
| Historical M00-W05 | Template | NOT_EVALUATED | Gate report created |
| 2026-10-16 | Four source-inventory-scoped uncommitted W14 campaigns | IN_PROGRESS | Initial accuracy/refusal limits; corrected/batched/untraced timing above target; focused correction pending |
| 2026-10-16 | OD-035 / ADR-0006 | Owner holdout WAIVED_BY_OWNER | Continuous eligible execution authorized; no fabricated execution/PASS |
