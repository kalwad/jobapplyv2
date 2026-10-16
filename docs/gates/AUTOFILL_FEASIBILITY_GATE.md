# Gate A report — AUTOFILL_FEASIBILITY

Gate report for the blocking Autofill Feasibility Gate (spec §2.3; owner M02). Authoritative lifecycle state is docs/CRITICAL_GATES.md and docs/PROJECT_STATUS.md. This report records development observations and outstanding evidence; it is not a final decision.

## Identity

- Gate: AUTOFILL_FEASIBILITY
- Owning milestone: M02 (M02-W07 through M02-W15)
- Blocks: M03 readiness; M17/M18/M19 retain Gate A PASS qualifiers.
- State: IN_PROGRESS
- Evaluated revision: pending final frozen W14/W15 acceptance. Latest closed clean fc48930 aggregate fails native128 performance; a later focused metadata correction passes its separate target20 run. Neither is final approval; revision7 comparison and older scopes remain historical.
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

## Later integrated checkpoint and actual comparison — 2026-10-16

The committed runtime 15c7e33 contact campaign scores 200/200 with the same1485/1485 precision/persistence,1275/1275 required recall,770/770 reporting and90/90 preservation, zero measured safety events and full-settlement p95 857.1561660000007ms. Separate unchanged target 20 native128 p95 is1333.9919169999994ms. Individual source/build/declarations are unchanged. The surrounding aggregate is NOT a pass:223 browser passes/five contradictory shadow-status assertions,1452 Python passes/two failures, and neutrality failures caused by root edits. Stronger collision assertions pass 35/35; the healthy doctor artifact fixture passes 50/50. Fresh frozen aggregate is pending. Earlier failures remain retained.

Actual public attempt records all 30 original URLs with 18 network-closure and12 form/oracle refusals,0 action requests and no scored public accuracy. An initial one-page incomplete attempt is separately retained. The pending-request guard remains strict; a read-only diagnostic still has pending requests after 1s. No oracle or URL is replaced to obtain passing coverage.

Original four-case peer remains32/40 versus 28/40 exact,32/40 versus 32/40 with phone equivalence. Separately declared revision6 paired actors actually complete4+4 under lock sha256:47b6fe33c9e68d8aed9815f2cd35887e289a0e93fbf27045a059e467d35fe6fb:40/40 versus 28/40 exact,40/40 versus 32/40 phone equivalent. Eight state/country controls explain the difference beyond formatting. Both actors use the same 11 installed native-observer surfaces: candidate unexpected native mutations 0; legacy 4 succeeded `country-code` ACTIVATION witnesses, one per case; both nonordinary final changes and navigation/submission event witnesses 0. The earlier both-zero prose was a historical reporting error: revision6 raw observations and worksheet already retain all four activations and remain unchanged (KI-0092). Source stability, normal context cleanup and owned direct-child exits are verified; descendant processes are UNOBSERVED. Revision5's worker-config setup failure is retained and did not produce an observation; its metadata/config are byte-preserved before revision6. This is one shared legacy component on four related synthetic examples, with no broad product/statistical/timing or two-product claim.

Evidence: docs/TEST_EVIDENCE.md § M02-W14; docs/evidence/m02-w14-integrated-checkpoint, m02-w14-public-actual and m02-w14-comparisons-actual. Simplify remains0 actual cases, public scored coverage remains incomplete, W15 independent decision remains pending, holdout remains WAIVED_BY_OWNER and Gate A remains IN_PROGRESS. M03 is not eligible.


## Frozen local closeout and latest public campaign — 2026-10-16

At clean b8b1423 the complete frozen `pnpm verify` passes all 19 active suites: 3,859 TypeScript units, 228 default browser tests, 61 then-required controlled contact proofs and 1,454 Python tests. Source/build/declarations and Git status are unchanged. The same 200 contact recipes retain all exact accuracy/reporting/persistence/preservation pairs and zero measured physical safety events; full-settlement p95 is 865.8358330000192 ms. Separate unchanged native128 target 20 p95 is 1480.3922500000008 ms, below 1,500 ms; that is still a zero-settle lower bound. Raw proof: docs/evidence/m02-w14-frozen-b8b1423, archive SHA-256 1c6f71f5e809c8a05129c17c93d59611bceabd3de2875b4ce5a9a028bca966c2.

The later observation correction at 8ae96f0 preserves exact native visible labels and records alternative ARIA channels. A fixed read-only 5-second acquisition observation precedes the unchanged strict network closure; held requests/races and protected boundaries still refuse. All original 61 controlled contact cases plus the new ownership/literal-label proof pass (62 total), with 19 verifier guards and static checks. No product driver, oracle or measured legacy runtime input changes.

The actual clean-source 30-row rerun records 17 network-closure refusals, 7 form/protected-surface refusals and 6 interference outcomes. There are zero action requests/executions/scored rows and null public accuracy/site acceptance. Native labels now match the frozen capture; CAPTCHA/dialog, method-choice and transport conditions still prevent eligible actions. Raw proof: docs/evidence/m02-w14-public-observation-correction, archive SHA-256 ab26ba7132dcdbce367341c12dc62e1cb8e16e012b6e8cdf5393318e8eb8fb4b. Prior runs remain historical and unchanged.

KI-0077 through KI-0088 are FIXED locally. KI-0089 records the missing public scored evidence, normal-user Simplify comparison (zero actual cases) and final independent W15 review/decision. Review agents hit the account usage limit; no review verdict is inferred. The normal signed-in synthetic Simplify session request remains pending; credentials are neither requested nor automated. Owner-controlled holdout remains waived and is not a blocker. Gate A remains IN_PROGRESS, M02-W14 IN_PROGRESS, W15 NOT_STARTED, M02 unaccepted, M03 ineligible and release NOT_READY. Passing development/CI checks does not satisfy the missing gate observations.


## Subsequent Windows verification finding — 2026-10-16

The b8b1423 run was cancelled by the next push after Ubuntu/macOS succeeded. Its released Windows log contains a negative compiler-probe timeout and cleanup EPERM (2,523/2,524 contracts passed); it is not a complete three-OS PASS. KI-0090 remains IN_PROGRESS. Resolving the pinned compiler from the repository and directly invoking it adds a real valid-compilation positive while preserving invalid-source rejection, timing bounds and mandatory cleanup. Local 8/8 focused, 2,524/2,524 contracts, typecheck/static and 201 ledger cases pass; native Windows confirmation is pending. The executed paired runtime binding remains exact (355 files), and no product driver changes. Complete clean-c67 Python verification separately passes 1,454 tests. Raw evidence and exact source patch: docs/evidence/m02-w14-windows-compiler, archive SHA-256 7b25aed2f140a93c72a48e3682454d6ff658a771022a650acfcea809eadd6fc2. Gate A remains IN_PROGRESS and all external evidence limitations remain.


## Subsequent native-validity publication finding — 2026-10-16

The exact frozen d99c checkpoint passes all 19 active suites (3859 units/228 default browser/62 controlled contact/1454 Python), native128 target20 p95 1446.918709000005 ms and full-settlement contact200 p95 873.0006670000148 ms, with unchanged Git/source/build/declarations. Raw proof: docs/evidence/m02-w14-frozen-d99c592. Fresh independent six-case probes at that same source subsequently confirm KI-0091: late native setCustomValidity can publish stale accepted execute/undo/W11 verification without any value/DOM mutation. A separate two-file primitive-validity fence passes the six unchanged probes, six clean integration cases, 29 existing adjacent cases and static checks independently. RED/GREEN source/build/probe bindings and original failures are retained under docs/evidence/m02-w14-native-validity. Root integrated only after frozen verification ended; complete affected regression and renewed comparison binding are pending. KI-0091 remains IN_PROGRESS, so the earlier standard-suite pass is not final safety/gate approval. Reviewer capacity resumed; formal W15 still has not started, public/Simplify scores remain absent and owner holdout remains waived.


## Corrected native-validity checkpoint and reporting correction — 2026-10-16

Clean0dd88ce completes all19 active suites with3859units/234default browsers/62controlled proofs/1454Python tests; Git and tracked source hashes stay unchanged. Contact200 retains the exact measured accuracy/reporting/persistence/preservation pairs and all7 physical safety counters0; full-settlement p95 is871.8325829999521ms. Separate native128 target20 p95 is1489.9990840000028ms, below1500ms and still a zero-settle lower bound. Original W13 scoring retains90 incorrect abstentions; preservation90 is a separate observation, not erased scorer output or fill credit. Canonical safety PASS is not whole-gate PASS. All67 mapped W03 clauses have separately passed fixture names. KI-0091's corrected six native-validity cases now pass in the full root regression, closing that local defect. Full source-bound proof: docs/evidence/m02-w14-frozen-0dd88ce, archive6b9ab884d4c6990da2af98229f0bf7f78837a16bbeac63b82bb9832c8b6d5edb.

New actual revision7 candidate4/legacy4 binds the reviewed corrected355-file runtime under locke5b9a8dd...:40/40 versus28/40 exact,40/40 versus32/40 phone equivalent. Candidate unexpected installed native calls0; legacy4 country-code ACTIVATIONs; both final nonordinary changes/nav/submission witnesses0. The same four legacy calls already exist in raw revision6. KI-0092 corrects the earlier both-zero prose while preserving every original raw archive/worksheet byte and both source locks. Complete proof/audit: docs/evidence/m02-w14-revision7-actual, archive1f4e05a9f86d94832cbfde33b1d7b38d73255f42efd00337954e2ccfaf3a2018. Scope remains one shared component/four related synthetic cases, not two independent products or broad superiority.

The corrected-runtime actual public run at clean0dd88ce retains all30original sources:17network-closure refusals,7form/protected refusals,6interference outcomes,0actions/scored rows and null natural accuracy/acceptance. Independent24-check audit reconciles source/build/oracle endpoints and journals; partial/unknown event coverage and unobserved OS descendants remain explicit. Proof: docs/evidence/m02-w14-public-0dd88ce, archive05e01c8c5bd808393c15ae512557fce23b765f074060b30d6f2676f16abe5948. Neither safe refusals nor completed local verification supplies missing public/Simplify observations.

KI-0089 remains OPEN. Normal-user Simplify cases0; public scored coverage and formal eligible W15/owner decision are missing. Supplemental independent reviews are complete at their recorded scopes, not formal final approval. The accepted holdout waiver is honored. Gate A remains IN_PROGRESS, W14 IN_PROGRESS, W15 NOT_STARTED, M02 unaccepted, M03 ineligible and release NOT_READY; no downstream package currently satisfies its prerequisites.


## Terminal prior-source Windows fixture finding — 2026-10-16

Prior-source run38962597205 completes Ubuntu/macOS SUCCESS and Windows FAILURE. Tested PR mergecb58e4a has tree616f54ca... exactly equald99c592; it does not execute corrected0dd. Native Windows infrastructure8 passes twice and fullcontracts2524PASS close KI-0090 at its correction scope. The only aggregate failure isPython:5waiver-fixture encoding failures/1447passes, tracked-clean assertion SKIPPED. KI-0093 IN_PROGRESS requires explicitUTF8 fixture I/O, unchanged assertions and fresh native validation. Original complete logs and merge/tree provenance are retained under docs/evidence/m02-w14-d99-ci. Local corrected0dd all19 PASS remains source-scoped; no complete three-OS or Gate A approval is inferred.


## Subsequent focus-value and native capacity findings — 2026-10-16

The latest918 hosted run tests merge3781e31a/treebd9eb473 exactly equal to918. Ubuntu/macOS pass all19 active suites; Windows passes compiler/contracts and visible browser/controlled scopes, then exhausts fixture storage. Its final Python summary is absent,18 setup errors are observed, and tracked-clean is SKIPPED. A separate contact environment-guard F has no retained stack and remains causally unresolved. Five old waiver cases map to passing progress symbols only; KI-0093 still requires complete fresh native validation. Full raw/source/API/independent proof is retained in docs/evidence/m02-w14-918-ci. This is not a three-OS aggregate PASS.

New independent actual-MV3 focus probes reproduce KI-0094 at918: four unchanged positives pass, four text/date execute/undo focus-value negatives fail and lose the newer page edit. The exact reviewed two-file correction passes unchanged GREEN8 and23 existing adjacent cases, including real partial-write recovery, with immutable source/probe/build bindings. Newer focus values are preserved with zero additional setter/input/change events and no VERIFIED/execute-undo authority. Complete original and corrected evidence: docs/evidence/m02-w14-focus-value-red and m02-w14-focus-value-green. Root integrated the exact patch and permanent eight cases; full root validation remains pending. The asynchronous descriptor-pause concern was not reproduced and its draft is excluded.

Reviewed revision8 separately binds corrected runtime355/8c61ebee under lock0f22812d; all frozen comparison data, actors, observer and revision7 history remain exact. No actor has run under revision8 yet; revision7 results remain historical. The corrected fixture-only KI-0095 patch9426e72a uses try/yield/finally around every complete isolated function-scoped copy and strict owned-subtree cleanup; it preserves inputs/assertions/thresholds. Initial finalizer-only patch186b6a45 was rejected by Ruff PT021 and remains historical. Independent48 source checks and targeted lint/format pass; proof is retained in docs/evidence/m02-w14-fixture-lifecycle-yield. Fresh local and native verification remain pending. No prior performance/contact/comparison result is rebound to the changed source.

Public scored coverage and actual normal-user Simplify cases remain0; formal W15 review/owner decision remain incomplete. Owner holdout is waived. Gate A and W14 stay IN_PROGRESS, W15/M03 NOT_STARTED and release NOT_READY.

## Current native128 performance corrective state — 2026-10-16

Clean fc48930 ends23:01:46Z with18 active suites PASS/one FAIL: native128 target20 p95 1527.9433329999993ms exceeds unchanged1500ms. The other241 default browser cases include all8 permanent focus probes; local Python1454PASS in299.26s and controlled contact62PASS remain separate passing scopes. Contact200 full-settlement p95 is871.287416999985ms with unchanged raw accuracy/safety pairs. Root independently retains unchanged head/status/all1478 tracked blobs; contact-campaign source/build/declaration endpoints are separately retained and unchanged. Complete failed aggregate proof: docs/evidence/m02-w14-frozen-fc48930/proof.tar.gz, SHA-256 28e1132c7762c3327f0943bad8973625e74e8a14ff556d9ad0c12efacc564a0a,5089970bytes/48members; archive review21 checks. This supersedes then-pending fc execution prose without rewriting prior successes or the failed threshold.

Revision8 coordinator is source-reviewed but NEVER INVOKED, UNEXECUTED and UNRELEASED because that aggregate failed, with candidate0/legacy0. No executed guard-refusal proof is claimed. Its proof is docs/evidence/m02-w14-revision8-coordinator/proof.tar.gz, SHA-256 9be801fefecb570931ad717d978cc5c058a2090db7045fae335f723c097fc3ff,28025bytes/14members; archive review16 checks. Revision7 actual40/40 versus28/40 component results remain historical. KI-0094 stays IN_PROGRESS pending complete changed-source regression/comparison; KI-0093/KI-0095 retain fresh native Windows obligations despite corrected local1454PASS. The separate contact environment F remains unresolved and is not attributed to fixture capacity.

KI-0096 is HIGH/IN_PROGRESS. The reviewed one-file correction joins the same seven immutable result hashes with original-order rejection unwrapping and leaves all current DOM/validation/recovery/publication checks intact. The separate21 actual-MV3 guards pass24.1s, and unchanged native128 target20 passes p95 1473.5945839999986ms at23:11:06Z. Runtime355 now binds3b6c0e0c0950b03e3bb9e1f12b27bb8d385174c36fb4b68ef3345597aa8b3502; complete affected frozen regression remains pending. Optimization proof: docs/evidence/m02-w14-build-result-concurrency/proof.tar.gz, SHA-256 2620c4c3706a78f4895c5dc9e67450f0924b45d2f5d5ab5bd6fe94d5e09628ef,4275812bytes/95members; independent archive peer review passes24 checks, distinct from the retained40-check actual-evidence audit. Revision9 source-only preparation proof: docs/evidence/m02-w14-paired-revision9/proof.tar.gz, SHA-256 a46bbb17864f625138a44a49270776e13c519103e6deb5f7f8949c04c75b7d8c,403370bytes/87members; independent source peer review passes28 checks and separate archive peer review passes19 checks; scope is PRE-EXECUTION only. Root applies revision9 and its read-only loadCampaign preflight passes4 cases under the new72a68 lock; no actor, build or final gate result is inferred.

Public scored cases and actual normal-user Simplify cases remain0.31packages remain VERIFIED; W14/Gate A IN_PROGRESS, W15/M03 NOT_STARTED, release NOT_READY and accepted holdout waiver remain unchanged. Focused target PASS is not a complete aggregate, native-platform, comparison or W15/Gate A approval.
