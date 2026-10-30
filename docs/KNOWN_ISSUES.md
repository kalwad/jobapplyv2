# Known Issues

Reproducible defects and deferred risks (`docs/MASTER_IMPLEMENTATION_SPEC.md`
§1.1). This file is also where out-of-scope ideas are parked instead of
broadening a work package (spec §1.5).

## Update rules

- IDs: `KI-####`, never reused.
- Severity: `CRITICAL | HIGH | MEDIUM | LOW`.
- State: `OPEN | IN_PROGRESS | FIXED | DEFERRED | WONT_FIX` (`WONT_FIX`
  requires an owner decision recorded in `docs/DECISIONS.md`).
- Every defect entry must include reproduction steps and the affected work
  package and/or requirement ID.
- A defect is closed only with verification evidence recorded in
  `docs/TEST_EVIDENCE.md`; one passing manual example is not sufficient.
- No `CRITICAL` or `HIGH` issue may remain `OPEN` in a milestone marked
  complete (spec §10.1).
- Mandatory tests may not be labeled flaky to avoid fixing them (spec §8.6).

## Entry template

```markdown
### KI-#### — <title>
- Severity: CRITICAL | HIGH | MEDIUM | LOW
- State: OPEN | IN_PROGRESS | FIXED | DEFERRED | WONT_FIX
- Discovered: <date> during <Mxx-Wyy>
- Affects: <work package(s) / requirement ID(s) / component(s)>
- Description:
- Reproduction:
- Workaround:
- Resolution + evidence link:
```

## Latest W07/W11 validation scope (2026-10-29UTC)

Current cf9local full/three-host verification now PASS with separate stale-wheel packageFAIL/zero eligibleexports; bounded M04v6 headless debug-profile actual53.427s remains outside currentGUI/default/wholemilestone acceptance. Exact docs/evidence/m03-w07-full-cf9b60d, docs/evidence/m03-w07-ci-cf9b60d-terminal and docs/evidence/m04-frozen-debug-sha2-profile. KI-0139 closes only its source invariant; KI-0140 remainsIN_PROGRESS until corrected actual packages. Older pending statements below retain their historical revision scope.

Latest closed437local fullPASS and originalf3 three-host verifyPASS/Ubuntu packagePASS/Windows packageFAIL are docs/evidence/m03-w07-full-4378627 and docs/evidence/m03-w07-ci-f3-terminal. RequestRc930 fails at GNOME metadata before any package/VM actor. Narrow authorizer and WindowsJob corrections have different CLEAR reviews and guarded8path/62catalog root adoption, but a stale package-loader helper pin and canonical focus remain pending;  KI-0135 closes only its source invariant, KI-0136/0137/0138 retain their pending actual validation. Earlier observations below keep historical scope; no currentR/newfix full or native acceptance is inferred.

Clean bd4 is a preserved19PASS/onePythonFAIL aggregate; the narrow cache fixture correction and native zoom source now pass216focused/full2627collection/registeredRust and different2576 data joins. Earlier revision-scoped observations below remain historical; no corrected full/native acceptance is inferred. Exact docs/evidence/m03-w07-full-bd4-failure and docs/evidence/m03-native-zoom-and-cache-correction.

Current scoped correction supersedes the pending source/focus statements: all ten canonical checks pass with693Python/2704collection, different2573joins CLEAR, exact docs/evidence/m03-ci-path-and-bytecode-correction. Actual native Mac zoom/reset/routes/keyboard now passes the prospective policy and different1354data+590pixel checks, exact docs/evidence/m03-w11-macos-native-zoom-v6. Hosted bd4 remains failed with no curated package exports, exact docs/evidence/m03-w07-hosted-bd4-terminal. Fresh corrected full/hosted and native foreign-platform/reader evidence remain pending.

The reviewed guest/COM/parser composition now passes441canonical Python tests/2788exact collection/strict33+10/portability/integrity, with different4251source+2591actual joins CLEAR at docs/evidence/m03-native-guest-composition. Its earlier invalid managed UIA property and composer failures remain preserved; the corrected exact native COM body has separate scoped compilation review. No actual target COM/provider/PowerShell or Windows11/defaultGNOME result is transferred. These current-source corrections still await clean full/hosted validation and native platform campaigns.

### KI-0140 — Committed pure orchestrator wheel lags the corrected client source

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual cf9 CI native-package jobs123840589484/123840589553,2026-10-30UTC.
- Affects: M03-W07 native package source closure; packaging/native-project-wheels/orchestrator-0.0.1-py3-none-any.whl and packaging/native-project-wheels.json.
- Description: exact wheel/source validation refuses the committed07ab9ea… wheel because its generation/client.py is old66132868…, while tested source has corrected977e0759…. All18paths,17other orchestrator bodies and110contracts bodies match. The strict guard correctly prevents installing the obsolete client.
- Reproduction: both actual Windows/Ubuntu package jobs fail native_package_pipeline.py:352 with the same ValueError before pipeline output/native service actor; PREPARATION_INCOMPLETE and zero eligible curated exports. Independent inert member hashing binds the sole difference to immutable cf9source and both retained native-input wheel hashes.
- Workaround: none; preserve exact full package/resource equality, restricted installer surface and every existing limit; do not waive the guard or reuse old exports.
- Resolution + evidence link: docs/evidence/m03-w07-ci-cf9b60d-terminal, different16874joins/f71b7cef… and exact preserved failedCI/source/member records. Separate frozen source correction SOURCE76103d8f… now supplies exact32666B wheel21fdd2c…/one manifestSHA/two read-only alignment cases/two additive IDs; all23oldtests+2newPASS and samefinaloldwheel1PASS1FAIL preserve the unchanged strict guard. Different2528joins/34e9b0f4… CLEAR and officialHatchling1.32.4 privatebuild provenance are retained in the same packet. Rootguardedadoption/focus and fresh corrected actual hosted package results remain required; derived2882collection is not actualfullcollection. No future package/native/gatePASS is inferred.

### KI-0139 — Strict Turbo tasks lose the CI-installed Rust toolchain home

- Severity: MEDIUM
- State: FIXED
- Discovered: actual D7f7902f Mac CI unit-ts subprocess failures,2026-10-29UTC; source-only controlled environment-loss reproduction,2026-10-30UTC.
- Affects: M03-W07 hosted contract/parity verification; turbo.json and packages/contracts/test/contract/support process boundary.
- Description: the workflow installs/exports its pinned compiler under fresh RUSTUP_HOME, while default strict Turbo tasks omit that selector. Actual D's four suite hooks fail cargo build and its infrastructure setup fails rustup which rustc; suppressed stderr prevents asserting this reproduced source mechanism as the sole historical error cause. Direct later contract/Rust suites pass.
- Reproduction: installedTurbo2.10.7 executes seven tiny Node-only tasks; original default/explicitstrict config loses the synthetic home, exact globalEnv:[RUSTUP_HOME] preserves it, and unrelated synthetic environment data stays filtered. No compiler/network/model actor is used.
- Workaround: preserve strict filtering and all original tests/limits; do not loosen environment mode, invent a Rust diagnostic or relabel CI.
- Resolution + evidence link: independently reviewed one-variable correction f090c098…/fullmode33188 over edb1a6db… includes the selector in cache identity. Sourcepeer809joinsCLEAR; all17explicit qualification/format childowners close/reap/groupsABSENT/no signals/timeouts and all failed observer/format histories remain. Exact docs/evidence/m03-ci-turbo-rustup-home. Existing2878common+2POSIX IDs/digest remain unchanged; no new canonical test. Fresh corrected hosted CI remains required before closure.


- Current scoped verification: corrected cf9 hosted Mac/Windows/Ubuntu each pass all20ACTIVE suites with Python2880/2878/2880PASS. Different16874joins CLEAR_AS_RECORDED_FAILURE at docs/evidence/m03-w07-ci-cf9b60d-terminal validates these successful verification jobs while preserving both stale-wheel package failures as KI-0140. This closes only the reproduced strict-Turbo compiler-home source invariant; the suppressed historical D Rust stderr/exclusive cause remains UNKNOWN. Original C/D failures are unchanged.
### KI-0138 — Mutable PR head metadata rejects an otherwise validated authorization request

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual GNOME requestRc930 METADATA_GATE_FAILED/ValueError,2026-10-29UTC.
- Affects: M03-W07/W08 authorizer metadata; scripts/linux_gnome/ubuntu_gnome_request.py and scripts/windows11/windows11_request.py.
- Description: immutable run.head_sha remains sourceSf3, while a run API's nested PRhead can advance to validated requestR. The old metadata guard requires onlySf3 and rejectsR. The actual job retained no complete exception/API response, so this reproduced defect is not asserted as the sole historical ValueError cause; no actual Windows occurrence is observed.
- Reproduction: retained live Ubuntu run changes only nested PRheadSf3→Rc930. Original authorizer decode controls give2FAIL/30deselected at that guard; final156pure cases preserve124old+32new. No-context and blanket-check-removal mutants fail2 and6 meaningful cases respectively.
- Workaround: preserve immutable source/artifact identity and protected-byte enforcement; do not bypass the guard or reuse old artifacts after authorizer changes.
- Resolution + evidence link: outside SOURCEac4a86cba1c29ea604d31a09f323c75c7d7865ed61a55db6ecb19c47a000fd67 at /Users/tanishkalwad/jobapplyv2-evidence/resume-20261028/authorizer-live-pr-head-correction/v1 admits only an exact validated current head after the unchanged request/ancestry/protected-byte/release checks; standalone default remains source-only strict. Recorded156pure/strict/collection pass, with Windows synthetic only. Different review688ac7c… is CLEAR and root guarded the four authorizer paths as part of eight combined paths/888joins. Canonical343focused/2880collection and strict checks now pass, with original index-stage integrity refusal and separate corrected integrity/diff preserved; different6012actual joins CLEAR at docs/evidence/m03-package-and-authorizer-corrections. A fresh source/package build and corrected actual request remain required; requestR stays failed and its active authorization is withdrawn with exact retained bytes/fullmode.

### KI-0137 — Windows package helper forces Job cleanup before bounded natural drain

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: originalf3 Windows native-package job123763607069 strict failure,2026-10-29UTC; bounded fake reproduction and separate v1 late-completion review.
- Affects: M03-W07 native package process custody; scripts/_native_package_process.py.
- Description: after direct exit, a nonzero held Job active count immediately selects contained termination and strict failure. Actual10-tauri-package records directexit0/terminated_jobtrue/successfalse with final closure; lingering helpers versus delayed accounting is UNKNOWN. This is distinct from the prospective v1 finding that a slow query can return after its cleanup bound and falsely grant success.
- Reproduction: an exact-original delayed-accounting fake forces the Job and fails the natural-drain control. Separate immutable v1 then admits false success when active() returns zero at16s after its15s fence; exact final v2 negative retains that RED. Historical receipts do not establish either fake mechanism as the actual Windows cause.
- Workaround: preserve strict forced/unsettled cleanup failure and all work/cleanup/output limits; do not call successful compilation a packagePASS.
- Resolution + evidence link: historical actual failure is docs/evidence/m03-w07-ci-f3-terminal. Outside v2 SOURCEc38ee31b9d401cc9db4057b2d37bce7790d9be753e129afb64e22386f6ad5793 at /Users/tanishkalwad/jobapplyv2-evidence/resume-20261028/windows-package-job-drain-preparation/v2 retains bounded natural drain only for an exited owned direct process, the original first cleanup fence through observations/handle/capture completion, and strict forced-cleanup refusal. Final37fakePASS preserves7old+20v1+10v2; host/fixture strict checks pass without native Win32 calls or broad whole-helper Win32PASS. V1/HOLD and actual failure stay immutable. Different reviewe7a25f9f… is CLEAR and root guarded v2 with the combined8paths/888joins. The separate coordinator constant now pins19bf1a…; one permanent actual sibling-loader regression gives oldpinRED/fixedPASS, with independent686951ea… CLEAR. Root343focused/2880collection/strict checks and separate poststage integrity/diff pass, with original unstaged-deletion refusal preserved and different6012actual joins CLEAR at docs/evidence/m03-package-and-authorizer-corrections. A fresh actual Windows package campaign remains required; no fake drain result proves its historical cause.

### KI-0136 — Suppressed early idle cancellation discards expired timer state

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual hosted374 Windows Python failures,2026-10-29UTC.
- Affects: M03-W07 portability validation and the prepared M05 generation boundary; services/orchestrator/src/orchestrator/generation/client.py.
- Description: an adapter can suppress an idle timer's cancellation and return while a sampled clock is still before its deadline. Deadline sampling alone can then admit success. Historical Windows callback/clock values were not captured; the early-timer mechanism is independently reproduced, not attributed to unobserved historical timestamps.
- Reproduction: original Windows test_generation_idle_deadline.py suppressed open/read cancellation cases both fail DID NOT RAISE. New deterministic real asyncio.Timeout callbacks reproduce six early open/read/EOF value/error failures before correction. Exact-final old source gives9FAIL156PASS; removing only expired admission gives the same result. Removing raw-error admission or TIMEOUT precedence over ordinary close errors each gives3FAIL162PASS with final tests unchanged.
- Workaround: none; preserve original cancellation ownership, all limits/deadlines and existing oracles.
- Resolution + evidence link: retain the exact open/read timeout owner; unchanged active/caller and deadline checks run first, followed by expired-state refusal. Returned streams still close, pending caller cancellation wins, and ordinary cleanup errors cannot replace a detected TIMEOUT. All136old cases remain;29new cases pass. Different1265source/data checks plus fresh165 and12admission-order controls per child CLEAR the source. Guarded canonical adoption changes only client/catalog plus one new test;2346unselected sources/runtime40 remain. Ten actual checks pass165Python0.24s/2817collection/default-platform services35+explicitWin32generation13/format/portability/integrity/diff; different4832actual joins CLEAR. Exact docs/evidence/m03-generation-idle-timeout-correction. At that focused close, new clean full and actual Windows execution were required; the earlier f3 full predates this correction. The corrected437 local full now passes all20ACTIVE/Python2817PASS488.63s with different4865joins at docs/evidence/m03-w07-full-4378627. Actual corrected-client Windows validation remains required; originalf3 Windows verification used olderclient6613 and does not cover the29new cases.

### KI-0135 — GNOME shell commands follow the required terminal finish operation

- Severity: MEDIUM
- State: FIXED
- Discovered: actual clean374b6fe/treea77820bb aggregate,2026-10-29UTC.
- Affects: M03-W07/W08/W11 guest capture harness; scripts/linux_gnome/ubuntu_gnome_guest.py.
- Description: the new shell operation list is appended after finish, violating the unchanged existing protocol boundary test.
- Reproduction: original full2787PASS/oneFAIL444.92s; original unchanged boundary suite independently reproduces1FAIL35PASS. The exact failing node is test_imports_do_not_load_platform_gi_or_spawn_actor.
- Workaround: none; preserve the terminal-operation invariant and every old operation/test.
- Resolution + evidence link: one reviewed tuple composition inserts39shell operations before finish; all52unique operations/old relative orders and every function/class/test remain. Actual ten canonical checks pass564Python/2788collection, strict37+14/portability/integrity; different419source+2451actual joins CLEAR. Exact docs/evidence/m03-gnome-terminal-order-correction. At that focused close, fresh corrected clean full/hosted/packages remained required; the original failed record is docs/evidence/m03-w07-full-374-failure. Subsequent cleanf3 all20ACTIVE/Python2788PASS and different4833joins are recorded at docs/evidence/m03-w07-full-f3a1c6f; Subsequent originalf3 three-host verification all20PASS/Python2788/2788/2786 and Ubuntu package/exportPASS are now recorded at docs/evidence/m03-w07-ci-f3-terminal; newer437 local all20PASS/2817Python488.63s and different4865joins are docs/evidence/m03-w07-full-4378627. These close the finish-last source invariant only. Actual Windows11/defaultGNOME native campaigns remain separate pending requirements; original374 failures are unchanged.

### KI-0134 — General issue-ledger rules are parsed as fields of the preceding issue

- Severity: LOW
- State: FIXED
- Discovered: actual status validation after the current documentary update,2026-10-29UTC.
- Affects: docs/KNOWN_ISSUES.md arrangement; project-memory validation.
- Description: general Update rules were located between actual KI-0131 and the next numeric issue. The strict unchanged issue parser correctly rejects duplicate Severity/State labels in that section.
- Reproduction: retained current validator exit1/four field violations; the affected issue-ledger beforeimage is byte identical to a7. No old metadata PASS is transferred to this document arrangement.
- Workaround: none; keep strict duplicate-field refusal.
- Resolution + evidence link: move the unchanged general rules/template before the first actual issue; retain every issue and parser/test body. Subsequent actual status/metadata results are recorded in docs/TEST_EVIDENCE.md; the original refusal stays retained in the current evidence packet.
- Exact original/current validator records and line-preservation proof: docs/evidence/m03-known-issue-ledger-layout, proof12c350b2078bf4101a8d2596f53654bfb8a8dbe45b9eb4335ec962ce8e3839a5.

### KI-0133 — Raw marshal serialization differs for the same compiled code

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual integrated portability refusal and controlled CPython3.12.13 serialization,2026-10-29UTC.
- Affects: M03-W07; scripts/check_portability.py exact-source Linux/Windows bytecode checks.
- Description: reference-count/intern bookkeeping changes raw marshal output without changing the trusted compiled object. Raw byte equality can reject an otherwise exact local source cache. A first value-only parser proposal separately failed to preserve constant alias identity and was never adopted.
- Reproduction: retained controlled same-object serialization difference, failed earlier canonical focus, and v1 independent alias counterexample/HOLD. Exact docs/evidence/m03-ci-path-and-bytecode-correction.
- Workaround: none; do not unmarshal unknown caches, discard caches, ignore headers or erase semantic identity.
- Resolution + evidence link: independently reviewed bounded inert occurrence graph preserves all code fields, alias topology and meaningful interning. All75 new cases and81 old isolation cases pass in the retained source phase; current canonical693focused/2704collection/strict/portability/integrity pass. Independent2573actual joins validate19cache bodies and five retained stale originals; genuine stale headers/code remain refused. Fresh corrected clean full/hosted validation is pending.

### KI-0132 — Windows package inventory emits host-specific member separators

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual bd4 Windows canonical job,2026-10-29UTC.
- Affects: M03-W07; scripts/windows11/windows11_inputs.py and test_windows11_inputs.py.
- Description: str(relative_path) emits backslashes on Windows, while the unchanged canonical archive-member validator requires POSIX names. The fixture writer has the same host-specific mistake.
- Reproduction: retained hosted Windows2620PASS2FAIL and focused old1FAIL56PASS; exact docs/evidence/m03-w07-hosted-bd4-terminal and docs/evidence/m03-ci-path-and-bytecode-correction.
- Workaround: none; do not admit backslash archive members.
- Resolution + evidence link: use relative_path.as_posix() only at the two member writers; preserve all14 old test bodies and strict member validation. Two additive controls cover PureWindowsPath and refusal. Source57PASS plus15 independent probes and current canonical693focused/strict/2704collection pass. Fresh corrected hosted Windows execution remains pending.

### KI-0130 — Source-island fixture relocates generated bytecode

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual bd4 full Python execution,2026-10-29UTC.
- Affects: M03-W07; scripts/tests/test_windows11_isolation.py and exact Python inventory.
- Description: recursive source projection copies legitimate origin __pycache__ whose embedded co_filename differs from the temporary destination. The unchanged strict production checker deliberately refuses that relocated cache; one fixture fails while2623other cases pass.
- Reproduction: actual bd4 full1FAIL/2623PASS414.65s, plus outside exact RED1FAIL13PASS with six retained origin caches; docs/evidence/m03-w07-full-bd4-failure and docs/evidence/m03-native-zoom-and-cache-correction.
- Workaround: none; do not clear canonical caches, relax cache checks, remove assertions or skip cases.
- Resolution + evidence link: fixture copy omits only __pycache__; original whole module AST otherwise identical after removing the additive import/test. Three new controls preserve valid exact-cache acceptance and relocated/payload/flags refusal. Outside17PASS and canonical216focused/2627collection/strict/portability/integrity PASS, different2738source+2576data joins CLEAR. Remains IN_PROGRESS until fresh corrected full/hosted validation; original bd4 remains failed.

### KI-0131 — Native keyboard page zoom needs source enablement and actual validation

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual historical Mac content Cmdplus remains visually unchanged and pinned framework flag defaults false,2026-10-29UTC.
- Affects: M03-W11 native zoom/reflow/accessibility; apps/desktop/src-tauri config/capability/resolved-ACL tests.
- Description: current browser zoom fixtures do not establish native page zoom. The old native configuration lacks zoomHotkeysEnabled and the required macOS/Linux core permission.
- Reproduction: exact seven-route native AX/JPEG observations and different169-join review at docs/evidence/m03-w11-macos-ax-observations; pinned SDK/source review in docs/evidence/m03-native-zoom-and-cache-correction.
- Workaround: none; window screenshot dimensions, key counts, mock dispatch or visually unchanged captures must not be labeled200percent.
- Resolution + evidence link: explicit native flag and one local-main built-in permission are guarded-adopted; actual resolved allow/remote/othercaller/unlisted tests pass all3native modes,342same IDs each plus separate1/10. Fresh package/actual measured200percent/reset/readable seven routes/keyboard and reader evidence remain pending. No baseline or W11 acceptance follows from mock ACL success.
- Current resolution: held fresh a7 app now has50 original prospective-policy captures, four near2×/exact1× reset witnesses, all7routes at three scales with scroll views and keyboard refresh/Skip observations. Different1354data/590pixel checks CLEAR; selected22/40/43 endpoints agree within the original600s interval. Exact docs/evidence/m03-w11-macos-native-zoom-v6. No VoiceOver, new orphan check, foreign native scale or final baseline acceptance is inferred; those requirements remain pending.

## Current W07 package validation (2026-10-29UTC)

Clean2ea actual doctor28/all20 ACTIVE PASS, including2477Python, with different7020 data joins CLEAR: docs/evidence/m03-w07-clean-aggregate-2ea. Hosted40898412173 at80e68 is terminal FAILURE despite all three canonical jobs passing all20; both native-package jobs fail at later, separate stages. Exact original raw/API/source/review: docs/evidence/m03-w07-ci-80e68ac-failure. KI-0121 discovery, KI-0122 static inspection and KI-0123 SDK path policy are now FIXED at their stated scopes. New KI-0125/0126 record actual package failures and reviewed corrections; corrected native hosted execution remains pending. KI-0124 still awaits the fixed fixture's hosted run. Guarded three-file adoption and actual26selected/strict/portability/integrity PASS: docs/evidence/m03-w07-native-package-corrections. No native Windows11/default GNOME actor has run. W07 sole IN_PROGRESS/39of300 VERIFIED/M03 IN_PROGRESS/release NOT_READY.

## Current W06 closeout observation (2026-10-28)

Clean9872 actual doctor28/all20PASS includes2120Python and preserves every committed collection identity; KI-0119’s metadata preflight defect is closed by this full validation plus unchanged fixture/negative oracle. Original204bc full/CI failures remain failures in their exact retained packets. Historical pending statement superseded: KI-0120 and KI-0118 are now FIXED at their regression scopes by exact9872 Windows/Mac canonicalfullpasses; bothnativepackagefailures remain separate. Fresh MacGUI is now observed and independently reviewed after owner unlock; lock-related pending prose below is historical. Delegated W06 decision and limitations: docs/TEST_EVIDENCE.md § M03-W06 and docs/evidence/m03-w06-delegated-readiness. W07soleIN_PROGRESS/39of300VERIFIED/M03IN_PROGRESS/releaseNOT_READY. Foreign desktop certification and later storage/native-key activation remain pending.

## Current fixture compatibility validation (2026-10-29UTC)

### KI-0129 — Oversized pytest parameter ID exceeds Windows environment limit

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: actual Windows Server2025 canonical job123589894788/run40914184628 atf5a,2026-10-29UTC.
- Affects: M03-W07 cross-platform validation; scripts/tests/test_ubuntu_gnome_signed_indexes.py and exact Python test catalog.
- Description: pytest derives a65646-character node ID from the synthetic b"x"*65537 oversized-field input. Windows rejects its PYTEST_CURRENT_TEST environment assignment before the case body; setup and teardown each error. Python reports2474passed/two errors from2475collected. This is a fixture identifier problem, not evidence that the oversized-input parser body failed or passed.
- Reproduction: actual raw traceback through _update_current_test_var/os.environ to32767-character ValueError and different7863/109 reviews in docs/evidence/m03-w07-ci-f5a-failure. Dependent native packages SKIPPED/zero exports.
- Workaround: none; no skip, input reduction, parser limit relaxation or assertion removal.
- Resolution + evidence link: explicit id="oversized-field" for only that same input; all test bodies, assertions and payload expressions AST-identical, other IDs unchanged. Old/new24collections map exactly one ID65646→124, corrected24tests/strict3checks PASS, six children reaped/groupsABSENT. Different59 joins CLEAR; fresh corrected Windows execution remains pending. The147-case Windows11 addition requires explicit catalog composition preserving all added IDs and original2POSIX metadata.

### KI-0128 — Windows debug package source selects console subsystem

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: source review of the pinned native packaging path and Rust entry attribute,2026-10-29UTC.
- Affects: M03-W07; apps/desktop/src-tauri/src/main.rs.
- Description: native packaging invokes TauriCLI2.12.3 build--debug, but the old GUI subsystem attribute applies only without debug assertions. The unchanged inspector requires appPE GUI2 and rejects console3. This is a source-derived gap; no current hosted PE failure is claimed and future ambient runner Cargo configuration is not inventoried.
- Reproduction: pinned CLI source, project profiles/build/env and primary Rust/Cargo references in docs/evidence/m03-native-desktop-entry. Existing meaningful PE refusal oracle remains unchanged.
- Workaround: none; do not weaken PE inspection or conceal a terminal window after launch.
- Resolution + evidence link: explicit Windows-only normal-build GUI selection excluding cfg(test). Different source review CLEAR, guarded exact main.rs adoption and actual five canonical checks PASS with native342same IDs each3modes plus separate1/10; all2255source/runtime40 bytes/full modes/status/HEAD/tree endpoints neutral. Actual corrected Windows PE/native launch is pending. Exact docs/evidence/m03-native-desktop-entry.

### KI-0127 — Windows and Ubuntu lack an explicit native Quit entry

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: pinned Tauri2.12.4 menu installation source review,2026-10-29UTC.
- Affects: M03-W07/W08/W10; apps/desktop/src-tauri/src/lib.rs.
- Description: Tauri automatically installs its default menu only on macOS; the project did not install a Windows/Ubuntu native File→Quit action. Close/ExitRequested callbacks alone do not prove native Quit or its accelerator.
- Reproduction: exact pinned framework/project references and different source review in docs/evidence/m03-native-desktop-entry. No native Windows/Ubuntu missing-control actor is invented.
- Workaround: none; do not alias window Close to the required Quit action or use an OS Quit that bypasses the common owner.
- Resolution + evidence link: explicit ordinary native File→Quit/Ctrl+Q item routes the existing ManagedService.request_shutdown owner. macOS retains its native default menu. No renderer authority/schema/dependency/deadline change. Different review CLEAR and guarded lib.rs adoption; combined actual five canonical checks PASS, native342same IDs each3modes plus separate1/10. Corrected real Windows11/defaultGNOME native menu, accelerator and cleanup remain pending. Exact docs/evidence/m03-native-desktop-entry.

### KI-0126 — Unix package cleanup test conflates listener release with immediate address reuse

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: Ubuntu native-package job123566716778/run40898412173 at80e68ac, 2026-10-29UTC.
- Affects: M03-W07/W08; scripts/package_validation.rs packaged service actor.
- Description: actual packaged health/authentication and owned cleanup succeed; the next plain TcpListener bind fails AddrInUse/OS98. The original TIME_WAIT, collision or residual-owner cause is UNOBSERVED. Immediate plain-bind success measures more than whether the retired listener accepts connections.
- Reproduction: original pipeline15 actor exit101/4.267067s, zeroPASS/oneFAIL, cleanup success221ms/bound6000ms, keeper reaped and observed group/session absent. Exact original logs/artifact/API/source and different5720 review: docs/evidence/m03-w07-ci-80e68ac-failure.
- Workaround: none; no retry, sleep, deadline extension, socket-policy relaxation or fabricated Linux cause.
- Resolution + evidence link: retain Windows bind/drop and all original actor health/auth/version/cleanup oracles. Unix single250ms connection must refuse specifically ConnectionRefused; successful connection/timeout/other error fails. Add a live/retired owned connected-listener control with prior reuse=false. Production socket exclusivity unchanged. Separate fresh offline compilation binds different old/fixed Mac executables; same five controls PASS each, strict checks PASS. V1 shared-target HOLD remains immutable; different v2 source/data4796 joins CLEAR. Canonical source adoption,26Python/strict/portability/integrity checks PASS. Exact docs/evidence/m03-w07-native-package-corrections. Corrected Linux inline control and real package actor await fresh hosted execution.

### KI-0125 — Scrubbed Windows package builder omits PyInstaller's required home

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: Windows native-package job123566716686/run40898412173 at80e68ac, 2026-10-29UTC.
- Affects: M03-W07; scripts/build-windows-runtime.py.
- Description: PyInstaller6.22.3 import calls Path.home().resolve; the intentionally scrubbed eight-key environment supplies no home and fails with RuntimeError: Could not determine home directory. App build and native service actor are not reached.
- Reproduction: exact runtime-build06-native-build stderr2573B SHA256469cfbe3050b4c3461f597efc6e7e87803513fa88c919b4aef3be2eac3b00bfb, original artifact12911338406 and different5720 failure review: docs/evidence/m03-w07-ci-80e68ac-failure.
- Workaround: none; do not inherit user profiles, caches, tokens or broader PATH authority.
- Resolution + evidence link: fresh owned work/build-home/AppData/Local and Roaming plus private PyInstaller cache; pass USERPROFILE/LOCALAPPDATA/APPDATA/PYINSTALLER_CONFIG_DIR explicitly. All original three IDs/eighteen assertions remain. Real Windows stdlib expansion under exact child environment fails old builder (twoPASS/oneFAIL), passes corrected three cases plus strict checks. Different34 source/data joins CLEAR; actual canonical26selected/strict/portability/integrity PASS. Exact docs/evidence/m03-w07-native-package-corrections. Corrected native Windows package execution remains pending.

### KI-0124 — Rollback fixture can rerender before asynchronous driver write

- Severity: MEDIUM
- State: FIXED
- Discovered: originalhosted40803470877/Mac277browserPASS1FAIL and controlledlocalordering proof, 2026-10-29UTC.
- Affects: M03-W07 crossplatform regression; existing FW3negativeReact browserfixture.
- Description: pre-armed20msrerender can occur before asynchronous decision/hash preparation and extensionmessage/write. Then the blockedReactevents never commitstate but the DOMwrite persists through the unchanged125mswindow, so the fixture's FAILED assertion receivesVERIFIED without its intended postwrite rollback.
- Reproduction: actualrealownedChromium with identical100mspreparationlatency logs click→input→change/stateempty/DOMTransient only/VERIFIED and fails the unchangedoracle. This establishes the controlledlocal defect, not the originalhosted eventorder. Oldreferencedtrace/PNG/context are absent from actualMacartifact; specificnonpersistence cause staysUNOBSERVED after27join source/datareview.
- Workaround: none; no flaky label, retry, skip, deadline increase or assertion weakening.
- Resolution + evidence link: firstactualinput/change armsone20msrerender; addrender2/emptyReactstateassertions. Samecontrolledcase logs input→change→click/DOMempty/FAILED and alloriginaloraclesPASS. Canonical13drivercases and3strictchecksPASS; different35source/datajoinsCLEAR. Exact raw/actualcontrolledfailuretrace/initialharnessfailures/endpoints/reviews: docs/evidence/m03-w07-browser-rollback-order. Fresh fixedcleanb28 nowactuallypassesall20/Python2141 withdifferent6801joinsCLEAR andneutral2202source/runtime40/HEAD-tree endpoints: docs/evidence/m03-w07-clean-aggregate-b28. Clean2ea expanded2477Python/all20 full now PASS with different7020 joins CLEAR (docs/evidence/m03-w07-clean-aggregate-2ea). Fixed-fixture hosted execution remains pending; state IN_PROGRESS for that scope.
- Later validation: actual f5a browser278/2/62/17 passes on Mac,Ubuntu and Windows Server2025; different7863 terminal/109 case joins retain exact source/observations in docs/evidence/m03-w07-ci-f5a-failure. This closes the hosted rollback-fixture scope; the separate Windows Python parameter-ID failure and skipped native packages remain failures. Prior pending statements above are historical.

### KI-0123 — Windows SDK f-string fragment violates the existing portability policy

- Severity: MEDIUM
- State: FIXED
- Discovered: clean07eb77b full aggregate, 2026-10-29UTC.
- Affects: M03-W07; scripts/native_package_ci.py path construction.
- Description: the new interpolated Windows SDK path contains a literal /bin/Hostx64/x64/dumpbin.exe fragment. The existing conservative PORT-SRC-001 policy refuses it, causing the real-repository Python oracle and standalone portability suite to fail.
- Reproduction: exact07eb77b doctor28PASS/aggregate18PASS2FAIL, Python2140PASS1FAIL391.89s and raw CLI violation in docs/evidence/m03-w07-portable-sdk-path-correction. Different2269joins confirm the recorded failure and immutable source.
- Workaround: none; do not relax or bypass the policy.
- Resolution + evidence link: compose the same path from individual pathlib segments. Existing13focused cases, strict3checks and correct offline-uv CLI pass; different65source/datajoinsCLEAR. Initial wrong-isolated-interpreter CLI2/PyYAML observer error is retained separately. No checker/test/inventory changes. Corrected clean80e68ac full now actually passes all20 suites/Python2141 with unchanged source/runtime/modes/status/HEAD-tree endpoints and different2275joinsCLEAR: docs/evidence/m03-w07-closed-validation. Prior40803470877 remains FAILURE. Actual40898412173 at80e68 now passes this portability policy in all three all20 canonical jobs, including2139Windows/2141POSIX Python; different5720 joins CLEAR_AS_RECORDED_FAILURE for its separate later package failures. Exact docs/evidence/m03-w07-ci-80e68ac-failure. State FIXED at the SDK path-policy scope; no package or GUI certification follows.

### KI-0121 — Installed sibling MSVC toolsets make package inspection discovery ambiguous

- Severity: MEDIUM
- State: FIXED
- Discovered: Windowsnativepackagejob123208496933/run40795147477, tested9872.
- Affects: M03-W07; scripts/native_package_ci.py.
- Description: absentPATHdumpbin triggers latestVS -find, which actually returns3installedversions; len==1 refuses before payloadbuild.
- Reproduction: exactvswhere rawchoices/commands/source/API in docs/evidence/m03-w07-ci-9872aca-failure.
- Workaround: none; no guessedfirst/highesttool or fabricatedpin.
- Resolution + evidence link: selectMicrosoft's declareddefault via oneinstallation/default-version file, forcedUTF8, boundedheldregularread and exactdeclaration/toolhashes. New12cases and all134affectedcases/strict/integrity pass; different14source/38data reviewCLEAR. Actual80e68 Windows native-package job123566716686 passes the corrected declared-default discovery and reaches PyInstaller, then fails separately at missing home (KI-0125). All20Windows canonical suites PASS; different5720 data joins clear the recorded failure. FIXED at discovery scope, without a later dumpbin/static-inspection or native desktop pass. See docs/evidence/m03-w07-packaging-corrections and docs/evidence/m03-w07-ci-80e68ac-failure.

### KI-0122 — Static Linux inspector rejects legacy three-component GLIBC versions

- Severity: MEDIUM
- State: FIXED
- Discovered: DATAONLY replay of UbuntuDeb from nativepackagejob123208496922/run40795147477.
- Affects: M03-W07/W08; scripts/linux_package.py ELF minimum-version screen.
- Description: actual mainELF declaresGLIBC_2.2.5; oldtwo-componentregex refuses it despite targetceiling2.39.0. Actualhostfailure is genericstaticreject; the exactcriterion is reproduced onMac using package-derived runtime, not originalstage.
- Reproduction: unchangedDeb24bf9661/oldinspector0036afde metadata/rawreplay and3FAIL6PASS test-first result in docs/evidence/m03-w07-packaging-corrections.
- Workaround: none; no ignoredELF/version/chain guard or newerGLIBC acceptance.
- Resolution + evidence link: optionalnumericpatch/normalized3tuple withunchanged2.39.0ceiling; newer/malformed/unknown cases refuse. ActualLinux70affectedcases and finalcombined134/strict/integrity pass, finalsource95ad static package-derived replayPASS. This does not prove exactsymbolavailability, originalstageequality or nativeexecution. Different source/data reviews CLEAR. Actual80e68 Ubuntu job123566716778 completes runtime/app build, catalog and static inspection before its separate service-actor listener assertion fails (KI-0126). All20Ubuntu canonical suites PASS; different5720 joins clear the recorded failure. FIXED at static-inspection scope, without native GUI or overall package acceptance. Exact docs/evidence/m03-w07-ci-80e68ac-failure.

### KI-0119 — Deep malformed-JSON Python fixture trips collection policy

- Severity: MEDIUM
- State: FIXED
- Discovered: clean204bc06 full verification; Python and integrity refuse before Python execution.
- Affects: M03-W06; new runtime metadata test fixture, not production metadata behavior.
- Description: the existing conservative verifier treats Python literal nesting beyond its bounded capability traversal as a potential dynamic collection hook. One18-level malformed-JSON fixture passes that literal through `_json`, causing the observed refusal.
- Reproduction: exact204bc06 raw18PASS/2FAIL full and independent2097-join review in docs/evidence/m03-w06-aggregate-204bc06-failure.
- Workaround: none; verifier/test inventory protections stay intact.
- Resolution + evidence link: root-reviewed byte-identical66-byte wire literal preserves all2120 IDs and negative assertions. Corrected current canonical105PASS and integrityPASS; outside same105/preflight/integrity/Ruff pass. Corrected clean9872 full now actually passes all20 suites including2120Python; different2173-join reviewCLEAR at docs/evidence/m03-w06-clean-aggregate-9872aca. See docs/evidence/m03-w06-fixture-portability-corrections.

### KI-0120 — Native owner fixture assumes POSIX absolute roots on Windows

- Severity: MEDIUM
- State: FIXED
- Discovered: run40790930093/Windows job123175708107 at204bc06.
- Affects: M03-W06/W09; shared native path-owner/Quit test fixture.
- Description: three fake `/data/app`, `/cache/app`, `/temp` roots are not absolute on Windows; all16 failed native tests stop at the same TrustedBases Invalid setup, before their lifecycle oracle. Rust default300PASS16FAIL; later modes unexecuted.
- Reproduction: retained exact official raw lines6575–6724 and whole-log pin in docs/evidence/m03-w06-fixture-portability-corrections; separate live CI collector retains official run/source/artifacts.
- Workaround: none; no guard/assertion/deadline is relaxed.
- Resolution + evidence link: test-only cfg Windows roots are local absolute C-drive values; exact previous POSIX values remain. All test bodies/assertions/budgets unchanged. Outside Mac owner12/Quit15, catalog342, fmt/compile/strictClippy pass with neutral endpoints. Actual corrected Windows and complete aggregate pending. See docs/evidence/m03-w06-fixture-portability-corrections.

## Current hosted unit-TS validation (2026-10-28)

Current scoped resolution: exact9872 hosted canonicaljobs all20PASS; Windows2118Python/316nativeeach3 and Mac2120Python/342nativeeach3. Originalfailure stays failed. NewpackageFAILURES are separateKI-0121/0122. Evidence docs/evidence/m03-w07-ci-9872aca-failure.

### KI-0118 — Hosted TypeScript tests exceed retained wall-clock budgets

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-28 during M03-W06; run40782097996/macOS job123146069723
- Affects: M03-W06 / REQ-PLAT-013; canonical unit-ts verification harness
- Description: immutable run head35b/treef078 records one explicit5000ms holdout-boundary test timeout and two evaluation-runner failed labels at5713/5294ms without final failure diagnostics before Turbo abort. macOS finishes19PASS/unit-tsFAIL; Windows/Ubuntu20PASS. CPU/I/O contention is a scheduling hypothesis, not an established product defect or causal finding.
- Reproduction: retained official macOS canonical-step raw log and terminal run/job/source metadata under docs/evidence/m03-w06-unit-ts-concurrency. The original hosted result remains failed; native package matrixSKIPPED.
- Workaround: none; no deadline, assertion, sampled domain, discovery proof or performance threshold is relaxed.
- Resolution + evidence link: reviewed --force/--concurrency=2 command and exact bounded grammar admission preserve all existing TS inputs. Actual local15fresh tasks/4006PASS88.918566s, frozen2065source/runtime40 size/hash/mode/status endpoints and different172-check data review pass. Retained19focused Python passes and full2120-ID collection have their explicit narrower receipt scopes. Fresh corrected hosted CI and clean aggregate remain pending; this issue is not closed by the local pass. See docs/evidence/m03-w06-unit-ts-concurrency and docs/TEST_EVIDENCE.md.

## Immutable35b local full verification (2026-10-28)

Clean35b46287/tree f0789de7 runs doctor28PASS7.642s and all20ACTIVE suitesPASS1170.553932s: TypeScript4006/Python1860PASS391.37s/native234each3/browser262+2+62+3. All1998tracked file blobs/sizes/executablebits match immutableGit; fullpermissionmodes equal between endpoints; runtime40byte/mode endpoints equal; both outer children reaped/groupsABSENT/zero cleanup signals. Independent source/data review CLEAR; exact raw proof docs/evidence/m03-w06-local-full-35b. This validates35b only: the subsequent source-known FIFO correction and freshCI40782097996 are pending separately. Earlier failed runs remain failed and separately retained. No escaped-descendant, clean-environment, newGUI/foreignpackage/certification or milestone acceptance claim is added. W06IN_PROGRESS;38/300VERIFIED;M03IN_PROGRESS;releaseNOT_READY.

## Current native macOS development package (2026-10-28)

Source434/d093 plus exactly two reviewed test afterimages builds a43-file80,134,001B local ad-hoc signed arm64 debug app; moved spaces/Unicode path equals the built package and40-file29,902,565B runtime equals stage bytes/current modes. Actual native GUI Ready/keyboard refresh, service928→1009 restart, Close/relaunch/six401/Quit and app3293-only forced exit pass for observed identities/groups/listeners. Forced-parent observed closure is0.33389675s. Independent source/data review is CLEAR for this scope. Exact raw/AX/PNG/static/codesign/build/process evidence: docs/evidence/m03-w06-macos-native-package. No controlled app PATH experiment, raw LaunchServices invocation, escaped-descendant, notarization, foreign desktop or certification claim is added. Source closure predates later documentary adoption; product projection stays exact. W06 remainsIN_PROGRESS and releaseNOT_READY pending current clean full/hosted validation.

## Current hosted Windows failures (resumed2026-10-28)

Current scoped resolution: exact9872 hosted canonicaljobs all20PASS; Windows2118Python/316nativeeach3 and Mac2120Python/342nativeeach3. Originalfailure stays failed. NewpackageFAILURES are separateKI-0121/0122. Evidence docs/evidence/m03-w07-ci-9872aca-failure.

### KI-0116 — Synthetic Windows builder test intercepts Python's host probe

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: 2026-10-28 while retaining terminal2026-10-19 run39213957984,Windows job117933391097
- Affects: M03-W06 / REQ-PLAT-013; scripts/tests/test_windows_builder.py
- Description: platform.system calls Python's Windows version probe through subprocess.check_output("ver",shell=True). The test's shared subprocess.run fake intercepts this unrelated host probe and correctly rejects shell use, before the final synthetic builder stage. Actual1857PASS/1FAIL999.33s; no production builder shell call is inferred.
- Reproduction: exact434/d093 testedmerge38a4f211; official Windows raw failure lines8510–8594, retained API/source/log packet.
- Workaround: none; original hosted Windows FAIL remains failed.
- Resolution + evidence link: root-reviewed explicit synthetic platform.system Windows seam preserves all18 assertions,8command labels and3test identities. Actual local3PASS, unchanged1988source-content inventory and separate24-check data review. Fresh corrected-head nativeWindows confirmation remains pending. See docs/evidence/m03-w06-resumed-ci-corrections and docs/TEST_EVIDENCE.md.

### KI-0117 — Replacement-listener test assumes immediate reuse after child reap

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: 2026-10-28 while retaining terminal2026-10-19 run39213957984,Windows job117933391097
- Affects: M03-W06 / REQ-PLAT-013; api_client/tests/python_runtime.rs
- Description: after killing/reaping the actual Python service, the all-features test's immediate same-port replacement bind returnsWSA10048/AddrInUse. Exact kernel/process cause isUNOBSERVED. Default220PASS/all-features219PASS1FAIL; the protected request/bearer assertions are unexecuted in that failing case.
- Reproduction: exact434/d093 testedmerge38a4f211; official Windows raw lines9686–9698 and source line167.
- Workaround: none; no forced socket reuse, different port, ignored error or production timeout change.
- Resolution + evidence link: root-reviewed private fixture helper admits only actual same-port binding, retries onlyAddrInUse within1s and preserves final failure. Two actual-listener cases prove held-port refusal and success after actual release. Actual local six runtime casesPASS/228filtered, including original no-bearer case; all original assertions reconstruct exactly. Fresh corrected-head nativeWindows confirmation remains pending. See docs/evidence/m03-w06-resumed-ci-corrections and docs/TEST_EVIDENCE.md.

### KI-0114 — Windows builder mock supplies a non-absolute system directory

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC in hosted run39207973986,Windows job117914852791
- Affects: M03 native package tests / REQ-PLAT-013; scripts/tests/test_windows_builder.py
- Description: mocked GetWindowsDirectoryW returns /trusted/windows. On native Windows this lacks a drive and Path(...).is_absolute() refuses before the synthetic six-stage proof. Actual Python1798PASS/1FAIL652.50s; no real native builder or application failure is inferred from this fixture.
- Reproduction: exact660f/be68 testedmergef1a558ee; official Windows log8267–8429 and API/source bindings are retained.
- Workaround: none used; original canonical Windows failure stays failed.
- Resolution + evidence link: reviewed test-only tmp_path-derived absolute directory replaces three fake API/count/expected-env sites, preserving every stage, CLI argument and assertion. Actual local fixture3PASS and canonical715focus/1860collection remain separately bound. Direct native434Windows execution passes the absolute-directory guard and all seven preceding stage environment checks before the distinct platform-probe fixture failureKI-0116. This closes only the original non-absolute mock defect; no complete builder-test/native package PASS is inferred. See additionally docs/evidence/m03-w06-resumed-ci-corrections. See docs/evidence/m03-w06-shared-native-packaging and docs/TEST_EVIDENCE.md.

### KI-0115 — Tauri ACL tests send a nonlocal origin on Windows

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC in hosted run39207973986,Windows job117914852791
- Affects: M03 native diagnostics transport tests / REQ-PLAT-013; src/diagnostics/tests/tauri.rs
- Description: six test requests hardcode tauri://localhost. Pinned Tauri2.12.4 uses http://tauri.localhost on Windows/Android; its actual local-only ACL rejects the hardcoded URL. Two default-library assertions fail: allowed-command unwrap gets ACL refusal and malformed-message assertion sees Null. Actual218PASS/2FAILof220; no production permission broadening is warranted.
- Reproduction: exact660f/be68 testedmergef1a558ee Windows default cargo test, official log9070–9085. Later all-features/SDK/finalbuild are unexecuted.
- Workaround: none; no ACL/CSP/command change or ignored assertion is used.
- Resolution + evidence link: test-only local_app_origin matches the exact pinned framework's official test example; six argument adapters preserve all four tests/assertions and secondary-window/remote denial. Actual localMac Rust15commands/232cases each3/finalbuildPASS; actual434Windows default and all-features runs each pass all four unchanged Tauri ACL/command tests. This closes the exact origin defect; the separate same-port setup failureKI-0117 leaves the aggregate failed and the later custom-protocol mode/finalbuild unexecuted. See additionally docs/evidence/m03-w06-resumed-ci-corrections. See docs/evidence/m03-w06-shared-native-packaging and docs/TEST_EVIDENCE.md.

### KI-0111 — Windows executable link duplicates RT_MANIFEST

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC during M03-W06 hosted run39201246849
- Affects: M03 native build/test infrastructure / REQ-PLAT-013; Windows desktop bin-test link
- Description: Tauri's resource.lib embeds its default manifest while the candidate also passes general /MANIFEST:EMBED and /MANIFESTINPUT. CVTRES rejects duplicate name1/language0x0409; LINK returns LNK1123 before a successful new executable launch.
- Reproduction: immutablec4f7d9c/treeb7b7bbcf Windows job117894478955, default desktop cargo test exit101; official raw link command and diagnostic are retained.
- Workaround: none used; originalc4f linkFAIL remains unchanged. The later660f canonical Rust suite still fails on two test-origin assertions, separately tracked by KI-0115.
- Resolution + evidence link: FIXED for the duplicate-manifest link defect by exact660f Windows evidence: default test executables link and library220 cases actually execute; two retained PE files and mt-extracted manifests contain CommonControls6. No duplicate CVT1100/LNK1123 occurs. Static diagnostic itself claims no causal loader verdict, and later native modes/finalbuild remain unexecuted; this does not close historicalKI-0109 or certify the normal app. See docs/evidence/m03-w06-shared-native-packaging and preserved m03-w06-windows-manifest-correction.

### KI-0112 — Windows typecheck exits without a captured compiler diagnostic

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: 2026-10-19UTC during M03-W06 hosted run39201246849
- Affects: M03 canonical typecheck validation / REQ-PLAT-013
- Description: pnpm exec turbo run typecheck exits1; complete captured aggregate output contains package-group discovery and telemetry but no compiler diagnostic or task footer. The source cause is UNOBSERVED.
- Reproduction: immutablec4f7d9c/treeb7b7bbcf Windows job117894478955 typecheck block; no guessed TypeScript error, timeout or flaky classification is used.
- Workaround: none used; originalc4f typecheckFAIL is preserved with causeUNOBSERVED, without guessed TypeScript error, timeout or flaky classification.
- Resolution + evidence link: bounded15fixed-path existing Turbo logs now actually retain446B in successful660f Windows diagnostic; current canonical typecheckPASS. Current successful logs do not establish the olderc4f failure cause, so this historical investigation remains IN_PROGRESS. See docs/evidence/m03-w06-shared-native-packaging and preserved m03-w06-windows-manifest-correction.

### KI-0113 — Windows failure diagnostic joins multiple Git executable paths

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC during M03-W06 hosted run39201246849 step26
- Affects: M03 Windows native failure diagnostics / REQ-PLAT-013
- Description: Get-Command returns multiple ApplicationInfo records; array-to-text coercion makes Get-Item receive one joined invalid path. Diagnostic fails before checkout/image/tool inspection.
- Reproduction: retained step26 log and DIAGNOSTIC_INCOMPLETE/source null/images empty/tools empty artifact from exactc4f run.
- Workaround: none; the original incompletec4f artifact/zero-image/zero-tool result remains preserved.
- Resolution + evidence link: FIXED for joined Git-path resolution by actual660f Windows step26SUCCESS: one first-Application image resolves, checkout/tree145source records bind,14static commands exit0,4tools and2PE/CommonControls6manifests are retained, and artifact upload succeeds. The five historical PowerShell source fixtures remain unexecuted; real native resolver execution supplies the direct outcome. This is static diagnostic success, not a causal loader or full Rust/app verdict. See docs/evidence/m03-w06-shared-native-packaging.

## Current package-test collection correction (2026-10-19UTC)

### KI-0110 — macOS package fixture violates static collection policy

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC during M03-W06 clean e0a501b full verification
- Affects: M03-W06 / REQ-PLAT-013; scripts/tests/test_macos_package.py and mandatory Python/integrity preflight
- Description: a synthetic-mode fixture passes its current module namespace into monkeypatch.setattr. The unchanged fail-closed collection-policy visitor rejects this unmodeled namespace escape. The full reports18PASS/2FAIL before pytest collection/execution; affected tests passing alone did not establish canonical preflight validity.
- Reproduction: clean e0a501b/treebbf94 pnpm verify exits1; static-policy reproduction also exits1 with dynamic pytest collection hook registration is forbidden. Original failure evidence remains unchanged.
- Workaround: none; no verifier bypass, skip, allowlist or weakened policy is used.
- Resolution + evidence link: explicit fixture-helper keyword avoids module-namespace mutation while preserving owned-file checks, all19 test names/args/decorators and36 assertions. Actual six-command check passes, including affected30 and mandatory1801Python/no skips plus integrity; source1951/runtime40 remain unchanged with owned groups reaped/GONE. Different source8 and actual-data12 reviews CLEAR. See docs/evidence/m03-w06-collection-correction and docs/TEST_EVIDENCE.md. A new clean all20 and W06 GUI/package acceptance remain pending separately.

## Current Windows native validation finding (2026-10-19UTC)

### KI-0109 — Desktop unit-test executable fails before startup on Windows

- Severity: MEDIUM
- State: IN_PROGRESS
- Discovered: 2026-10-19UTC in hosted run39194489970,Windows job117874182536
- Affects: M03 native test/build infrastructure / REQ-PLAT-013; Windows desktop library test executable
- Description: default cargo test links then exits0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND before any library test summary. Windows aggregate is19PASS/RustFAIL; later all-features/SDK test modes and final desktop build are unexecuted. Three strict Clippy commands cover three workspaces, only one desktop. No failed-PE import, actual missing DLL/export or production-app failure is observed.
- Reproduction: immutable2a327/tree4ce9, actual PRmerge bdeb5ddae0ade030b5d0be2aa95dd3a8288fc03b; `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml` launches japp_desktop-d259cde1f90c873d.exe and returns3221225785. Official logs ZIP72304ac2157ecb71b9a2192dab7ce9e228786d1b06a70867861ccb26f21d0e42 and exact raw lines are retained. The downloadable artifact has10visualPNGs, no native PE/DLL/trace.
- Workaround: none used; canonical failure remains failed, Windows step26SKIPPED. Mac/local results grant no Windows startup PASS.
- Resolution + evidence link: target-scoped Common Controls v6 manifest candidate and bounded failure-only diagnostics are now integrated with separate source reviews and actual Mac affected checks (544Python/183native each3). Actual Windows PE/resource/unchanged native tests are next; cause/fix and normal-app resource merging remain unvalidated. Canonical failure handling is unchanged. See docs/evidence/m03-w06-windows-loader-correction, docs/evidence/m03-w04-hosted-ci and docs/TEST_EVIDENCE.md; current work continues in W06.

## Current browser validation regression (2026-10-19UTC)

### KI-0108 — Windows owned browser-context and profile cleanup fails; failure artifact unavailable

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC in required hosted run39188122249, Windows job117854768223
- Affects: M03 verification infrastructure / REQ-PLAT-013; e2e/extension/support/extension-test.ts
- Description: the observed-boundary research case reports1.7s and fails during fixture teardown, which reports EXTENSION_CONTEXT_CLEANUP_FAILED: browserContext.close returns Target page, context or browser has been closed, and recursive owned-profile removal returns EPERM despite the existing10 retries/100ms delay. The default browser suite reports255PASS/1FAIL;19 other suites pass, including all required native modes. No timeout or flaky classification is inferred.
- Reproduction: exact6d3 source, actual PR merge0d3/tree34, official complete logs.zip SHA25617c2114afd39c71c15686e3a966f7f001775e2216cefdf2f35caba7782e1aa7d; Windows research spec:585. The upload step reports no files and the official artifact API returns total_count0; printed trace/error-context paths do not supply retained artifact bytes.
- Workaround: none used; Windows aggregate remains FAIL and its separate tracked-change stepSKIPPED. W03 package-scoped verification is separately justified by its actual required behavior/source evidence, while this repository regression and global CI requirements remain open.
- Resolution + evidence link: repair owned lifecycle/profile cleanup and preserve failure outputs across later suites, retaining every original assertion, strict failure policy and bounded budgets. Revalidate before closing. See docs/evidence/m03-w03-closeout/ci-6d3-terminal.tar.gz and terminal-ci-independent-review.

- Implemented correction (2026-10-19UTC): captured owned-Browser retirement and awaited async profile removal retain all Context.close errors and original budgets; sibling output roots preserve actual failed trace bytes. Actual10-case RED/44GREEN,355 Python checks, one local WD replay and real retained failure trace pass separate review465e8e22. Root strict typecheck initially fails on one local test annotation; the exact annotation fix and complete PASS are retained. Canonical full and actual native Windows validation remain pending; no prior failed job is relabeled. See docs/evidence/m03-w04-browser-cleanup.

- Closure (2026-10-19UTC): actual source-bound run39194489970 browser262+2+62+3 passes on Windows, Ubuntu and macOS; current local W05 all20 also passes, with preserved source/counterproof and separate CI documentary74/74 review. This closes the cleanup/failure-artifact correction scope, while the new Windows Rust loader failure is KI-0109. Old255PASS/1FAIL and missing trace remain unchanged. See docs/evidence/m03-w04-hosted-ci and docs/evidence/m03-w05-closeout.

## M03-W03 validation findings (2026-10-18)

### KI-0107 — Windows deny-warnings compilation exposes unused backend scaffolding

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-19UTC while inspecting terminal hosted run39164520190
- Affects: M03-W03; strict Windows desktop Rust compilation
- Description: actual Windows1648 Python tests pass, but strict Clippy rejects currently unused Bootstrap/ReadyFrame imports, bounded stream helpers and the common CleanupPending variant without a Windows production constructor. macOS and Ubuntu complete successfully.
- Reproduction: official logs.zip SHA256bf47756e7f9027a6ad7e77278c53cc5f1221261b6d8fcdcded194035e18c4a07, full Windows Rust output. Actual PR merge checkout ab2d8a5 has the exact cac56/tree7d7afc0 source content.
- Workaround: none used; the Windows job remains failed.
- Resolution + evidence link: independently reviewed four-file compiler-scope patch b7d49f4b preserves every runtime method body, common typed contract, strict warning policy and all77 tests/assertions. Ten isolated Mac commands and53 independent source checks pass. Fresh root/full/native and actual Windows confirmation remain required. W07 integration must restore actual Windows stream consumers and remove the variant-only expectation. See docs/TEST_EVIDENCE.md and docs/evidence/m03-w03-lifecycle/windows-clippy-manifest.json.

- Closure (2026-10-19UTC): current6d3 clean canonical full validation and independently audited actual three-host native modes/strict compilation pass; exact local/native historical applicability and scoped limits are retained in docs/evidence/m03-w03-closeout. This does not relabel the unrelated Windows browser failure as PASS.

### KI-0106 — Windows post-exit refusal observation used a 0.2-second budget

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18 during hosted validation of M03-W02
- Affects: M03-W02 / M03-W03; service lifecycle test observation
- Description: Windows CI completed READY, authenticated canonical responses, parent EOF and service exit0, then timed out in the single post-exit socket probe. The observed failure was at the refusal check, not startup or shutdown.
- Reproduction: GitHub Actions run39158999648, Windows verify log, test_service_cli.py line167; actual1624PASS/1FAIL. Raw official logs are retained separately.
- Workaround: none used; this CI run remains failed.
- Resolution + evidence link: proposed Windows-only3s refusal observation keeps the same required ConnectionRefusedError, single attempt, timeout failure,3s HTTP and8s exit bounds. Eight modeled tests exercise refusal, timeout, other errors and accepted-connection cleanup. Independent review and actual new Windows CI remain required; docs/TEST_EVIDENCE.md § M03-W03 validation corrections.

- Closure (2026-10-19UTC): current6d3 clean canonical full validation and independently audited actual three-host native modes/strict compilation pass; exact local/native historical applicability and scoped limits are retained in docs/evidence/m03-w03-closeout. This does not relabel the unrelated Windows browser failure as PASS.

### KI-0105 — Runtime builder contained a platform-specific PATH literal

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18 during M03-W03 clean full validation
- Affects: M03-W03; runtime builder portability policy
- Description: the unchanged PORT-SRC-001 checker rejects the builder's literal system PATH. Both failing suites in the complete run report this same defect.
- Reproduction: commit4244afb full validation exits1 with18/20 suites PASS and1631PythonPASS/1FAIL; portability also fails. Failed results remain retained.
- Workaround: none used; policy and allowlist remain unchanged.
- Resolution + evidence link: use validated absolute system defaults from os.defpath/os.pathsep while rejecting empty, relative and current-directory entries before any build command. Fifteen builder tests, unchanged policy check, strict statics, exact1642 inventory and a fresh six-stage real runtime build pass. Independent source/integration review clears the correction; fresh complete validation remains required; docs/TEST_EVIDENCE.md § M03-W03 validation corrections.

- Closure (2026-10-19UTC): current6d3 clean canonical full validation and independently audited actual three-host native modes/strict compilation pass; exact local/native historical applicability and scoped limits are retained in docs/evidence/m03-w03-closeout. This does not relabel the unrelated Windows browser failure as PASS.

### KI-0104 — Packaged runtime selection used an application feature alias

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18 during M03-W03 actual packaged app observation
- Affects: M03-W03; compile-bound runtime selection
- Description: the CLI enables tauri/custom-protocol directly; the application's custom-protocol alias can remain false. The packaged debug app therefore selected the development-stage executable despite having a bound bundled runtime.
- Reproduction: actual4244afb app launch reports the service executable under root runtime-payload instead of bundled Resources/runtime. The observer baseline fails; this is not a passing Close case. Root GUI Quit cleans the exact observed app/service/group/listener.
- Workaround: none used; the failed actor remains preserved.
- Resolution + evidence link: choose mode through SDK tauri::is_dev(), preserving manifest/hash/absolute-path/no-fallback guards. Two new shipping-selector tests reproduce the direct-dependency feature mode;77 tests in each of three mandatory modes and strict Clippy/fmt pass. Windows-native fixture paths preserve production guards. Independent review clears source integration; fresh actual bundled lifecycle and full validation remain required; docs/TEST_EVIDENCE.md § M03-W03 validation corrections.

- Closure (2026-10-19UTC): current6d3 clean canonical full validation and independently audited actual three-host native modes/strict compilation pass; exact local/native historical applicability and scoped limits are retained in docs/evidence/m03-w03-closeout. This does not relabel the unrelated Windows browser failure as PASS.

## M03-W02 corrected verification fixtures (2026-10-18)

### KI-0103 — Status mutation fixtures inherited obsolete progress

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18 during M03-W02 full verification
- Affects: M03-W02; Python verification and copied status fixtures
- Description: one runner test replaced W02 NOT_STARTED after W02 became IN_PROGRESS, leaving the supposedly invalid status unchanged. A related negative test inherited an inconsistent current-package header before its invalid-enum mutation.
- Reproduction: frozen28ba full verification is source-neutral but FAIL with1626Python PASS/1FAIL; two added premise checks independently reproduce the obsolete literal and invalid baseline.
- Workaround: none used; the failed complete run is preserved and does not verify W02.
- Resolution + evidence link: use the stable historical M00-W01 VERIFIED row with exact occurrence/change assertions for the runner mutation; establish a coherent copied W01 boundary and require baseline validator PASS before the unchanged invalid-enum mutation. All original test identities and assertions remain. Affected tests and the complete integrity module pass; fresh complete validation remains required. See docs/TEST_EVIDENCE.md § M03-W02 and docs/evidence/m03-w02-service/failed-verification-28ba-manifest.json.

## M03-W02 corrected dependency privacy default (2026-10-18)

### KI-0102 — Framework telemetry defaults could observe sensitive synthetic input

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-18 during outside M03-W02 dependency/API review
- Affects: M03-W02; local service privacy boundary
- Description: FastAPI0.146.0 core telemetry defaults could acquire ambient providers and observe exception/validation input. The insecure proposal was never accepted or used with real user data.
- Reproduction: retained configuration RED observes an enabled switch before any sensitive capture assertion; later hostile-provider factory regression exercises actual construction, requests, validation and exception paths.
- Workaround: none used; no provider/SDK/exporter success is inferred.
- Resolution + evidence link: all five switches (tracing, metrics, logs, operation_spans, auto_configure) explicitly false; focused/socket/wheel/clean full tests and independent review PASS; docs/TEST_EVIDENCE.md § M03-W02 and docs/evidence/m03-w02-service.

## M03-W01 corrected native boundary (2026-10-18)

### KI-0101 — Debug-packaged shell accepted the development origin

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18 during M03-W01 independent review (SHELL-001)
- Affects: M03-W01; native shell navigation policy
- Description: cfg!(debug_assertions) treated a debug-packaged custom-protocol app as development and permitted http://127.0.0.1:1420.
- Reproduction: actual custom-protocol test calling the shipping callback failed before the fix; original RED is retained.
- Workaround: none used.
- Resolution + evidence link: shipping callback uses tauri::is_dev(); six tests in each protocol mode pass, independent review closed SHELL-001 and the final rebuilt GUI actually denied development-origin navigation. Clean source-bound full20-suite validation passes; docs/TEST_EVIDENCE.md § M03-W01 and docs/evidence/m03-w01-shell.

## M02-W14 current development findings (2026-10-16)

These entries supersede the older W13 sections' then-current readiness/gate posture without rewriting historical evidence. W14 is VERIFIED, Gate A IN_PROGRESS, W15 READY and release NOT_READY. ADR-0006 waives owner-controlled holdout; accepted ADR-0007 additionally waives direct Simplify comparison and executed public-form evidence. Neither waiver supplies execution or PASS. Scoped legacy baselines, all nonwaived measurement and independent review remain required. Spec §5.9 permits an isolated relevant legacy behavior baseline on the same fixtures; a full legacy scheduler/database deployment is not an added requirement.

### KI-0077 — Corrected full-settlement campaign exceeds the target timing threshold

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14
- Affects: M02-W14; generic scan/fill Gate A performance; real-MV3 full-settlement evaluation
- Description: the corrected 200-case campaign reports p95 1799.8664160000044 ms; the subsequent sequential batched campaign reports 2087.8410830000066 ms and fails its explicit <=1500 ms assertion. Earlier 1338.2853750000068 ms belongs to a different source with 60 refused cases and deficient precision/recall, so it cannot establish a passing corrected candidate. Timings cover one execution per different W12 page with 75 ms settlement and 20 ms rerender, excluding setup/reporting; repeated 128-control proof remains separate.
- Reproduction: run the exact batched command in docs/TEST_EVIDENCE.md § M02-W14, retaining source/build/configuration commitments and all physical counters. The fourth trace-disabled run completed and also failed at 2009.8366249999963 ms; no passing current timing is assumed.
- Workaround: none accepted. Do not round down, omit settlement, reuse earlier source timings or drop difficult cases.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Historical full-settlement misses remain retained. The a744ff2 contact cohort passes p95 874.831582999992ms, but its separate native128 target 20 fails1535.096375000001ms. The pure SHA byte-preserving optimization is now integrated; root target 20 passes 1432.5265840000002ms with unchanged waits/thresholds and exact128/512/768 action-resolution-descriptor counts. Frozen combined-source validation is pending; no final gate result is inherited from an earlier source. See docs/evidence/m02-w14-a744ff2-aggregate and m02-w14-integrated-preflight.

### KI-0078 — Localized address evidence needs exact recognition and other-party guards

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 full visible matrix evaluation
- Affects: M02-W14; packages/form-engine evidence normalization, ontology and field classifier
- Description: frozen W12 address labels including Street/Strasse/Adresse/Postleitzahl/Code postal were not all recognized; adding aliases also required subtype and employer/recruiter-context negatives so applicant address facts could not populate other-party fields.
- Reproduction: retained locale before log reports 9 failures/2 passes; the later section-negative checkpoint reports 2 failures/14 passes. Permanent tests cover sharp-S normalization, unrelated spelling, subtype/substring rejection and other-party label/section conflicts.
- Workaround: unresolved/abstained results must remain visible; never change frozen expected answers to match candidate behavior.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: local corrections are present; the inspected final form-engine log reports 93/93 tests across 8 files. Corrected/batched campaigns record ordinary precision 1485/1485 and required ordinary recall 1275/1275 on the declared contact cohort. Final W14 frozen/canonical verification remains pending, so this draft does not mark the issue FIXED. See docs/TEST_EVIDENCE.md § M02-W14 and docs/evidence/m02-w14-validation.

Current scope limits: the preservation model is supplemental and does not rewrite W13 canonical abstention metrics. Rendered upload/repeater/radio controls do not count as exercised drivers. Thirty public sources are structurally inspected, but public fill cases/scored controls are zero. Actual shared legacy component capture is not full-product comparison; frozen registry statuses remain historical. Simplify requires the normal owner-prepared authenticated synthetic comparison route; installed extension/session state is unknown after the browser-policy rejection. Independent W15 decision is pending.

### KI-0079 — Changed ownership description can retain a stale fill approval

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 independent adversarial review
- Affects: M02-W14; scanner description evidence, W09 approval binding, W10 action preflight and W11 reconciliation
- Description: an approved First name control can retain its durable address when its referenced description changes from Your contact to Employer. Fresh W09 classification rejects the new ownership context, but executing the earlier approval can still write the applicant value. The defect is reproduced in both the document and an open shadow root.
- Reproduction: the two description-only ownership mutation probes retain the old W09 approval, change only the referenced description text, establish that the new W09 decision does not permit filling, then execute the old approval and measure physical events and the final value. Both before-fix executions wrote the value. Raw failure records are being retained with the shadow implementation evidence.
- Workaround: do not integrate or claim the shadow candidate safe while this stale approval remains executable.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Bounded ownership, settled undo and final publication guards are integrated. The retained96 and29 probes, expanded72 MV3 cases and twelve unchanged native-observed independent probes pass against their cited source inventories. The integrated aggregate retained223 browser passes and five shadow-status assertion mismatches; their corrected stronger assertions pass 35/35, and fresh frozen validation is pending. Earlier stale-approval and undo failures remain preserved under docs/evidence/m02-w14-shadow-guards, m02-w14-selected-semantics and m02-w14-independent-review.

### KI-0080 — Event-only action meter cannot exclude eventless writes and restoration

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 independent scoring review
- Affects: M02-W14; physical-action observation and supplemental initial-value preservation evidence
- Description: the inherited W13 page meter observes input/change events rather than native setter calls. An eventless write followed by an eventless restore can leave both the event list and final value unchanged. The preservation scorer correctly evaluates its supplied audit, but that meter alone cannot substantiate exhaustive zero-write claims. No eventless production violation has been observed.
- Reproduction: inspect the event listeners in e2e/extension/support/autofill-benchmark.ts and the zero-action/unchanged-value preservation predicate. An independent real-MV3 setter-to-restore regression is being added before claiming that this observation gap is closed.
- Workaround: treat historical action counts as event witnesses; do not infer absence of unobserved native property writes from the absence of events.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: The independent W14 native observer is integrated and records supported setters/activations in the actual extension realm, separately from site events/rerenders. Four real-MV3 observation probes and a744ff2 full200-case1485 raw/audited actions pass with zero orphans and all declared installed surfaces. Retained references, other realms and uninstalled surfaces remain explicit limits; W13 historical event metrics remain unchanged. Frozen combined-source validation is pending. See docs/evidence/m02-w14-a744ff2-aggregate.

### KI-0081 — Changed selected-option semantics retain stale authority

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 fresh independent worktree review
- Affects: M02-W14; native-select, radio and ARIA option approval, settlement and W11 retained verification
- Description: an approved Country option can retain its raw value while its label changes to a placeholder or Canada. Fresh W09 policy refuses the changed semantics, but the earlier transaction can still select it and publish VERIFIED/READY; an earlier verified selection can also remain READY after relabelling. The existing unrelated-option preservation fallback discards the whole option fingerprint without retaining the selected option's semantic binding.
- Reproduction: the independent native-six campaign uses both literal US and opaque 17 values. Before-write relabelling produces one native SELECT_VALUE write and VERIFIED despite fresh NO_SEMANTIC_MATCH; after-verification relabelling preserves READY. The unchanged selected option with an appended Mexico option remains a required positive regression. Original setup failures and corrected native proofs are retained separately under /tmp/japp-w14-independent-probes pending archival.
- Workaround: no Gate A claim or current-source freeze while stale option authority remains. Do not fix this by rejecting all unrelated option-window changes.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Selected value/label/disabled binding is integrated across native selects, radios and ARIA widgets, with bounded original option snapshots and synchronous publication witnesses. All72 focused MV3 cases and twelve unchanged independent probes pass; unrelated Mexico append and virtualized-list positives remain supported, stale semantics perform zero writes. Before/after failures and exact source commitments are archived under docs/evidence/m02-w14-selected-semantics and m02-w14-independent-review. Combined-source focused checks pass; frozen aggregate is pending.

### KI-0082 — Public report snapshot accounting omits inserted controls

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 fresh independent scoring review
- Affects: M02-W14; network-closed public DOM evaluation report and precision eligibility
- Description: changes are currently computed by iterating only the before snapshot. A final-only control disappears from identity/change coverage, permitting apparently complete value metrics despite unmatched final topology. This is a reproducible report defect; no saved live public row or production sensitive fill is claimed.
- Reproduction: replay the exact accounting logic with an initially empty First name control and final First name=Synthetic plus a newly inserted Social Security Number=Synthetic. It reports precision 1, unexpected nonpositive changes 0 and unmeasurable controls 0 while the snapshot lengths are 1 and 2.
- Workaround: treat unmatched/new/missing/duplicate snapshot identities as unmeasurable. A new control's unknown initial value cannot establish that the extension wrote it.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Union accounting and explicit topology/precision eligibility are integrated. Final-only, missing, duplicate and unmatched controls remain unmeasurable, complete precision is null, and matched-subset metrics stay separately scoped. All61 a744ff2 controlled proofs pass, including the six new pure union regressions; no actual public contact run is inferred. Frozen controlled verification is pending.

### KI-0083 — Native property drift escapes final verification publication

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 fresh independent worktree review
- Affects: M02-W14; execute/undo final verification and W11 current-value observation
- Description: MutationObserver evidence revisions do not observe ordinary value-property assignments. A site can change input.value while the final result metadata hash is awaited, leaving the semantic index current while the result publishes an earlier VERIFIED value.
- Reproduction: actual native-observed EXECUTE and UNDO probes pause the final idempotency hash, assign Changed by site without dispatching events, confirm MutationObserver.takeRecords().length is zero, then release. Both report VERIFIED despite the changed current value. Extension native mutations remain one for execute and two total for execute plus undo; the site assignment is outside that extension-realm witness scope.
- Workaround: no final source verification claim from an index/DOM-revision fence alone. Do not add another asynchronous hash followed by the same unchecked gap.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Bounded synchronous native-property witnesses are integrated on execute, undo and W11 after the last awaited metadata operation. The original actual eventless EXECUTE/UNDO races and new W11 property race now refuse stale verification while preserving unchanged positives. All twelve original independent probes pass at the recorded source binding. Combined-source aggregate is running; see docs/evidence/m02-w14-independent-review.

### KI-0084 — Additive gate semantics changed a frozen evaluator preimage

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 integrated aggregate at a744ff2
- Affects: M02-W14; contract generation, W06 source preservation and compatibility
- Description: the v2 waiver integration added 7920 bytes to the semantic evaluator source frozen in the W06 manifest. The other 102 source artifacts and all expected answers remain exact, but corpus validation correctly refuses the changed evaluator preimage. Original Python V1 catalog checks also require the original 1.1/110 layer.
- Reproduction: the full aggregate at a744ff2 fails the ATS source-byte assertion (331227 versus 323307 bytes) and corpus:check with CORPUS_DRIFT. The frozen generator digest is d69b85650c220435e06a69186f099e89aa857834354394e47f86966fa821bc02.
- Workaround: preserve frozen manifests and tests; never rebaseline expected source bytes to the changed implementation.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: The exact reviewed24-file versioned repair is integrated. All103 frozen W06 artifacts are restored byte-for-byte, original V1 semantics remain1.1/110, and explicit V2 modules retain reviewed1.2/114 semantics with strict inherited provenance. All81 schemas, original511/new79 cases and both baselines remain unchanged. Outside sealed2524 contracts/173 generated Python/10 Rust pass; root3859-unit and frozen-corpus stages pass. Remaining combined aggregate is running. See docs/evidence/m02-w14-versioned-semantics.

### KI-0085 — Field identity collisions are misreported as root ambiguity

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 integrated browser regression
- Affects: M02-W14; W11 reconciliation inventory and unresolved required reporting
- Description: an intentional duplicate control shares a durable field ID with its peer while the application root remains uniquely FOUND. The action correctly refuses, but reconciliation reports ROOT_AMBIGUOUS instead of retaining both physical controls as unresolved observation evidence.
- Reproduction: the existing research ambiguity case at a744ff2 expects RECONCILED and receives ROOT_AMBIGUOUS; the trace retains root_status FOUND and two required controls with field_45D1MFTFZHA73GSAHCKK2E99QQ. No prohibited write occurs.
- Workaround: never remove the collision refusal while allowing the field-ID map to overwrite one control.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: Observation-only physical collision entries are integrated, with distinct report item IDs, required unresolved uncertainty and canonical RECONCILED/NOT_READY. No DOM occurrence/report ID grants action authority. The strengthened original P8 actual regression and classifier units pass, retaining every collision member and recovery after removal of one duplicate. All35 affected shadow/P8 cases pass after replacing only contradictory new field/root-status expectations with two unresolved items, unique report IDs, zero verified credit and NOT_READY. Original no-write assertions and P8 are unchanged; frozen aggregate is pending. See docs/evidence/m02-w14-functional-corrections.

### KI-0086 — Mounted confirmation approval becomes stale after cross-field validation

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 mounted W06 regression
- Affects: M02-W14; fresh W08/W09 approval and composite validation clearing in W10/W11/undo
- Description: filling primary email in MAL-VAL-001 changes the confirmation control's description. The mounted helper reuses its initial descriptor, so the ownership guard correctly refuses the stale approval and verifies 42 of the expected 43 contact fields. A fresh approval must also prove that only the observed validation error clears while stable help remains unchanged.
- Reproduction: the a744ff2 W06 attachment records val-email-confirm empty with zero physical actions, its description/address digest changed by Confirm the email address, and the unchanged 43-field assertion fails on 42.
- Workaround: do not relax description authority or lower the expected count. Do not treat arbitrary description shrinkage as validation clearing.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: The existing bounded W08 re-resolution endpoint supplies fresh same-frame/document/field evidence before each W09 decision. Exact component-level clearing permits only observed rejected error text to become empty, retaining stable help/ownership/references through W11 and undo. Outside actual W06 passes 32 cases and43/43 controls with unchanged source/build; P8 and six composite cases pass. All35 affected shadow/P8 cases pass after replacing only contradictory new field/root-status expectations with two unresolved items, unique report IDs, zero verified credit and NOT_READY. Original no-write assertions and P8 are unchanged; frozen aggregate is pending. See docs/evidence/m02-w14-functional-corrections.

### KI-0087 — Healthy doctor fixture omits active W14 public artifacts

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 integrated Python validation
- Affects: M02-W14; scripts/tests/test_doctor.py healthy Windows simulation
- Description: the healthy fixture copies the current M02-W14 status and suite registry but omits the two new required public suites' discovery artifacts. The doctor correctly reports REQUIRED_MISSING, contradicting the fixture's healthy premise.
- Reproduction: integrated Python collects1454 and reports1452 passes/two failures. The Windows simulation reports missing public-inspection/public-contact paths. The other neutrality failure came from root edits during validation and is retained separately.
- Workaround: preserve the required-suite checks and all original assertions; never mark the suites not applicable to make a healthy fixture pass.
- Resolution + evidence link: FIXED by the frozen b8b1423 aggregate (all 19 active suites PASS); see the local defect closeout below and docs/evidence/m02-w14-frozen-b8b1423. The following earlier checkpoints remain historical: copy the four actual committed discovery artifacts into the simulated repo. All50 doctor tests pass, including the unchanged healthy-Windows and tracked-file neutrality assertions; Ruff lint/format pass. Full frozen validation remains pending. Exact logs are retained under docs/evidence/m02-w14-integrated-checkpoint.

### KI-0088 — Public observation chooses a different label channel from the frozen capture

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 actual public evaluation
- Affects: M02-W14; independent literal-control observation and startup readiness
- Description: Greenhouse's visible First Name*/Last Name*/Email*/Phone* labels still match the frozen oracle, but the observer prefers ARIA labels without the required marker and falsely reports oracle drift. Closure also may be attempted during ordinary startup traffic.
- Reproduction: retained read-only label-channel diagnostic reads no values and confirms the associated labels exactly, separately from ARIA. A read-only Lever diagnostic naturally drains pending requests to0 around2s and the unchanged closure guard succeeds.
- Workaround: never strip markers, change the oracle, bypass protected boundaries or weaken transport closure to obtain a score.
- Resolution + evidence link: associated literal label text is observed first and every alternative channel is retained separately. A bounded read-only5000ms/50ms/max100-poll startup observation precedes the same strict closure check; it grants no action authority. A new controlled regression verifies the literal required marker while conflicting employer ownership still refuses. The held-request test retains refusal/no-write assertions and verifies natural completion separately. All62 mandatory controlled proofs (all61 retained plus one new case),19 verifier guards, static checks and unchanged1454-node Python preflight pass. The actual30-source rerun has17 transport refusals,7 form/protected refusals and6 interference rows,0 action requests and no scored public accuracy. Evidence: docs/evidence/m02-w14-public-observation-correction.

### KI-0089 — External public-form and direct Simplify evidence prerequisites waived by owner

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 final evidence reconciliation
- Affects: M02-W14; M02-W15; M02 acceptance and Autofill Feasibility Gate
- Description: accepted OD-036 / ADR-0007 removes only the direct Simplify comparison and executed public-form evidence prerequisites behind this finding. Actual cases remain0 and their assessment is WAIVED_BY_OWNER_ADR_0007, never PASS. W14 now has reviewed scoped package evidence and successful clean-clone full verification at commit6384d98156ae198cd93d7b35d1bb28b501ed475e/treed2c1fd5e50bbbd31a926cbf251d6140d11b9b9c4. Formal eligible W15/source-bound owner Gate A decision remains required as the next planned package and is not claimed complete.
- Reproduction: inspect the exact accepted ADR/source-aware machine authority, paired ledger/report waiver fields, retained W14 candidate index/manual synthetic checklist and the clean-clone closeout proof. Historical attempts, zero counts, old limitations and findings remain retained below.
- Workaround: the owner-authorized waiver is the resolution for only those two external prerequisites. It removes no controlled/absolute numeric, physical-safety, other-baseline, native, usability/accessibility/visual, independent-review or owner-decision requirement.
- Resolution + evidence link: FIXED at the waived external scope and completed W14 package closeout, documented in docs/TEST_EVIDENCE.md § M02-W14 and docs/evidence/m02-w14-candidate-handoff. Formal W15 audit is READY and Gate A remains IN_PROGRESS; no owner gate verdict or M02 acceptance is inferred. The earlier pending-W15 work is retained as package work rather than a circular HIGH blocker preventing its own readiness.
- Historical finding before the 2026-10-17 waiver:

- Description: the latest declared public campaign records all 30 pages but scores none: 17 strict network-closure refusals, 7 form/protected-surface refusals and 6 interference outcomes. The normal-user Simplify comparison has zero cases. Final independent W15 review and the source-bound gate decision have not occurred. Passing local tests cannot supply these missing observations.
- Reproduction: inspect the latest actual clean0dd88ce campaign binding, action journal and assessment in docs/evidence/m02-w14-public-0dd88ce; the earlier8ae96f0 records remain unchanged in docs/evidence/m02-w14-public-observation-correction, the Simplify readiness record, and the Gate A review/decision sections. All owned evaluation browsers were closed normally. Review agents initially returned the account usage-limit error; capacity subsequently resumed and fresh supplemental reports are retained. Neither condition constitutes the formal W15 verdict.
- Workaround: none accepted. Preserve CAPTCHA, authentication, legal-consent, dialog and transport boundaries. The owner-controlled holdout is already waived by ADR-0006 and is not part of this blocker. The pending request identifies the normal signed-in synthetic Simplify session without requesting credentials.
- Resolution + evidence link: OPEN. Suitable normal-user public evaluation conditions, an authenticated synthetic Simplify session and final independent W15 review/decision are required. Supplemental reviewers confirmed KI-0091; its complete corrected root regression and new source-bound legacy comparison now pass. They separately validate the latest public evidence but grant no formal W15/Gate A decision. See docs/gates/AUTOFILL_FEASIBILITY_GATE.md and docs/TEST_EVIDENCE.md § M02-W14. No downstream readiness or final PASS is granted.

### KI-0090 — Windows negative compiler probe times out behind a Rust proxy

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 from the cancelled b8b1423 Windows CI job log
- Affects: M02-W14; three-OS repository verification; contract infrastructure tests
- Description: the noncompiling Rust fixture invokes the rustup proxy from a temporary working directory. The Windows job records a 30-second probe and EPERM during mandatory directory cleanup; 2,523 of 2,524 contract tests passed. The run was subsequently cancelled by the newer push, so this is an observed individual test failure, not a completed aggregate result. The installed/default toolchain is already the correct 1.97.1; a version mismatch is not established. A proxy/compiler lifetime issue is the working diagnosis.
- Reproduction: job 117159565827 in run 38955928003, infrastructure.test.ts negative Rust compiler case. Raw cancelled-job stdout is retained under docs/evidence/m02-w14-windows-compiler. Linux/macOS passed that checkpoint and do not prove this Windows case.
- Workaround: no skipped assertion, longer timeout, swallowed cleanup error or speculative green result. Retain the original failure.
- Resolution + evidence link: correction resolves the pinned compiler with bounded rustup which rustc inside the repository and invokes the returned absolute compiler directly. The same executable and temporary output directory must first compile valid source; invalid source must still produce ADAPTER_EXIT_NONZERO. The original 30-second negative bound, 45-second case bound and mandatory bounded cleanup remain unchanged. All eight focused and all 2,524 contract cases pass locally, along with typecheck/static checks, 201 ledger cases and the two unchanged boundary probes. Native Windows job117181432489 now passes both exact infrastructure8 runs (2419ms/2609ms) and all2524 contracts on tested PR mergecb58e4a85d51fe47cf4c77dd232cb867af9f652c, whose tree616f54ca25ac97db7de6ac6eea204a140610364c equalsd99c592. This confirms the direct-compiler correction locally and natively. The surrounding Windows aggregate fails only five unrelated waiver-fixture encoding tests (KI-0093), so no complete three-OS PASS is claimed. Terminal logs and source/tree records are retained under docs/evidence/m02-w14-d99-ci. See docs/TEST_EVIDENCE.md § M02-W14.

### KI-0091 — Late native validity changes can publish stale accepted verification

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during fresh author-independent W14 safety review
- Affects: M02-W14; execute/undo publication and W11 retained verification
- Description: native setCustomValidity can reject a field without changing its value or generating a DOM mutation. Acceptance is read before asynchronous result/evidence hashing; the final native-property fence originally captures values/checked/files/options but omits the native validity inputs. EXECUTE/UNDO can publish VERIFIED/ACCEPTED and W11 READY despite current rejection. This is a newly confirmed gap beyond KI-0083's corrected value-property race.
- Reproduction: at exact d99c592, six actual-MV3 probes preserve three unchanged positives and fail all three late-rejection safety negatives. Values stay unchanged; MutationObserver records are zero. EXECUTE incorrectly grants undo; W11 initially reports READY while a fresh reconcile reports NOT_READY. A second identical red run binds all 355 runtime sources, probe, build, HEAD/status, tools/env before and after with exact equality. Original failures and sealed bindings are retained unchanged under docs/evidence/m02-w14-native-validity.
- Workaround: no acceptance credit from unchanged values or DOM revisions alone; no test/threshold weakening and no new await after the final fence.
- Resolution + evidence link: the exact two-file patch snapshots primitive willValidate, validity.valid and validationMessage, including native driver acceptanceElements, and compares synchronously alongside all prior value/option/DOM fences. The unchanged six probes pass independently; 29 adjacent existing regressions pass. The integration copy only removes four lint findings without changing assertions/seeds. The exact patch and lint-clean permanent six-case copy are integrated in root; the complete clean0dd88ce root regression now passes all19 active suites,3859 units,234 default browser tests including the six permanent cases,62 controlled proofs and1454 Python tests. The independently reviewed revision7 candidate4/legacy4 execution also completes with unchanged corrected-runtime binding. Full proof: docs/evidence/m02-w14-frozen-0dd88ce/proof.tar.gz (SHA-256 6b9ab884d4c6990da2af98229f0bf7f78837a16bbeac63b82bb9832c8b6d5edb). This closes the local publication defect, not the external Gate A evidence gap. The original raw probe/expectations and all derivation hunks remain retained. Evidence archive SHA-256 c10dec4ebfe565dde09425a73a38c647f9e8e51105e15163ae96eb4cb602596f (115 safe regular members). See docs/TEST_EVIDENCE.md § M02-W14; source patch SHA-256 56382908665d5fd4c8543df701b67498b3f222bafc768164a15607755b0d21e8.

### KI-0092 — Revision6 comparison prose omitted recorded legacy native activations

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during independent read-only audit of actual M02-W14 revision7 comparison evidence
- Affects: M02-W14 comparison reporting in TEST_EVIDENCE.md and AUTOFILL_FEASIBILITY_GATE.md; no functional defect or actor-code change
- Description: historical prose incorrectly reported zero unexpected native mutations for both actors. The revision6 legacy raw observations and worksheet already record four succeeded country-code ACTIVATION witnesses, one per case at sequence53; candidate unexpected native mutations are0. Nonordinary final-value changes and navigation/submission event witnesses are0 for both. The four complete legacy native witness arrays are identical between revision6 and revision7, so this is a reporting error rather than newly observed behavioral nondeterminism.
- Reproduction: inspect legacy_unexpected_native_mutations in all four cases of docs/evidence/m02-w14-comparisons-actual/paired-comparison.json (SHA-256 a1162c802c512ec741e7c500f68ed6bcfc8e971eef870afdaec6271cc1e424c8) and unexpected_native_mutations in legacy-r6/paired-options-legacy.json inside its proof.tar.gz (raw member SHA-256 1ac239a7b8c9c94344066b944d4e08b32d0120048eed9db440f29f19259d0e74). Both bind revision6 lock47b6fe33c9e68d8aed9815f2cd35887e289a0e93fbf27045a059e467d35fe6fb and retain one succeeded ACTIVATION on nonordinary country-code per row. Independent read-only raw-field/witness recomputation at revision7 confirms candidate0/legacy4 unexpected native mutations,40/40 versus28/40 exact values and40/40 versus32/40 phone equivalent; it starts no browser, build or actor.
- Workaround: distinguish attempted installed native calls from final value changes and use the retained raw arrays; never erase or relabel a nonzero observation to match prose.
- Resolution + evidence link: FIXED by correcting both false historical sentences and explicitly disclosing the prose error. Original revision6 archive and worksheet bytes remain unchanged; no runtime behavior, control assertion, test case, package state, gate state or threshold changes. The existing synthetic historical/current issue lists now include KI-0092 so historical isolation removes the later finding and the current boundary preserves it. Independent revision7 audit/report.md and audit/summary.json are retained in docs/evidence/m02-w14-revision7-actual/proof.tar.gz (SHA-256 1f4e05a9f86d94832cbfde33b1d7b38d73255f42efd00337954e2ccfaf3a2018;25 safe regular members), with retention-manifest.json plus report.md/summary.json copies alongside. The audit verifies raw joins, native witness counts, source/build/lock commitments and the identical revision6/revision7 legacy witness arrays. See docs/TEST_EVIDENCE.md § M02-W14. Formal W15/Gate A approval remains unexecuted.

### KI-0093 — Waiver test fixtures use platform-default text encoding

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 from completed Windows CI job117181432489 in run38962597205
- Affects: M02-W14; status-validator waiver fixtures; three-OS repository validation
- Description: new waiver fixtures read and rewrite UTF-8 decision Markdown without an explicit encoding. The pinned Windows Python locale decodes the em-dash heading differently from its UTF-8 literal. Three unaccepted-ADR variants fail splitting the heading; changed-record replacement becomes a no-op; an unrelated later-ADR write corrupts UTF-8 text. The production authority helper already reads UTF-8 and is unchanged.
- Reproduction: exact tested mergecb58e4a85d51fe47cf4c77dd232cb867af9f652c/tree616f54ca25ac97db7de6ac6eea204a140610364c (tree equalsd99c592); Windows final Python result5failed/1447passed in1118.28s. Failures are test_gate_v2_waiver_refuses_unaccepted_adr[PROPOSED/REJECTED/SUPERSEDED], test_gate_v2_waiver_refuses_changed_own_record_preimage and test_gate_v2_waiver_ignores_unrelated_later_adr. Original stack traces and raw logs are retained under docs/evidence/m02-w14-d99-ci; Ubuntu/macOS aggregates pass their respective same-source-tree runs.
- Workaround: no skipped fixture, altered authority assertion, locale-wide environment override or production parser weakening. Preserve original native failures.
- Resolution + evidence link: FIXED at the explicitUTF8 fixture/native-platform scope. Native run38979349323 completes all19 active suites on Ubuntu/macOS/Windows at headfc48930/tested merge34477f17c8b97e2caf04fb4d716d352d7e7a8a32/treecb787f46afec1281c87074a82fd31e23b37c865a. Windows passes all201 status IDs and1452 Python cases in673.22s; Ubuntu/macOS pass1454. The two platform cohort differences are the declared FIFO/Unix-socket parametrizations, with no unexplained missing IDs. Tracked-clean succeeds on all three. Native proof: docs/evidence/m02-w14-fc48930-ci/proof.tar.gz, SHA-256 5f416858c4585067fbf656e350152475fc1bf342ec799aa1fbb03dfcf18f9434,814341bytes/85 safe regular members; independent retained archive/API/log/source review is clear. This does not assert native validation of later730 or the next final head, and does not attribute the old stackless contact F.
- Historical correction checkpoints: IN_PROGRESS. The exact reviewed patch115be0ee440433d0d70db984433889ca7fea3290da12b1dba29e6e2cad437864 is integrated: eight fixture calls explicitly useUTF8, with every assertion/test identity unchanged. Independent review verifies all315 assertions/173function bodies/128test identities after removing only eight encoding keywords and threeKI93 constants. The retained cp1252 contrast supports the localized encoding diagnosis but is not a native locale print or Windows execution. Root ledger now passes201/201 in114.40s after exact integration; Ruff lint/format, strict typing, formatting, status and exhaustive retained-archive checks pass. The later clean fc48930 full Python suite passes1454/1454 in299.26s; this is local evidence only. Fresh complete native Windows confirmation remains pending. Source/proposal/diagnostic proof: docs/evidence/m02-w14-windows-fixture-utf8. KI-0090's native compiler proof is separate and passes; this failure is not attributed to the compiler or corrected native-validity runtime. See docs/TEST_EVIDENCE.md § M02-W14.


### KI-0094 — Focus handlers can cause text/date lost updates during execute and undo

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during supplemental independent W14 runtime review
- Affects: M02-W14; native text/date execute and undo; pre-write value preservation
- Description: a page focus handler can change a native value without a DOM mutation. The driver rechecks ownership and actionability after focus but originally omits the value. Execute overwrites the newer value and grants undo; undo overwrites it with the captured prior value. Both can report VERIFIED/ACCEPTED.
- Reproduction: the sealed eight-case actual-MV3 probe at exact918 runtime355/c375 has four unchanged positives PASS and four focus-preservation negatives FAIL in13.9s. Each negative records zero DOM mutation records for the page edit and one additional extension setter. All13 source/probe/build/tool bindings are unchanged. An earlier missing-await setup failure and two unreachable digest-pause cases remain explicitly separate from the confirmed focus defect. Complete original proof: docs/evidence/m02-w14-focus-value-red/proof.tar.gz, SHA-256 aebfb3fba84ce7c689bcb69234310cdccc87f4390ee116933631adeedaeef829,4793116bytes/459 safe regular members.
- Workaround: do not overwrite a newer page-owned focus value or grant recovery/undo authority for a refused pre-write action. The source-only asynchronous re-resolution concern is unconfirmed and its draft is not integrated.
- Resolution + evidence link: FIXED at the reviewed focus-preservation correction and complete affected local regression/comparison scope. Clean730c641a9855fc3e95620636314a28d0eee8439a/tree7402873a081286dbddce5b93ed4db997fea4f24d passes all19 active suites, including all8 permanent focus cases and242 default-browser cases, with unchanged1504 tracked-file closure. Actual revision9 then completes candidate4/legacy4 under lock72a68/runtime355-3b6c with all7 source/tool/build checks stable and corrected independent audit200/200. Complete frozen proof: docs/evidence/m02-w14-frozen-730c641/proof.tar.gz, SHA-256 0584744b75a3940f88d35fa842fd9386c66b9a9a8d12c5de278d957d0deb8c58,6867546bytes/88 safe regular members; independent full-data audit79/79 and separate archive peer review24/24. Actual comparison proof: docs/evidence/m02-w14-revision9-actual/proof.tar.gz, SHA-256 72bf11df63cad7b036d1c08e005430d6c8a87b757e0868336087cd14adb817b8,1058673bytes/102 safe regular members; corrected independent actual-data audit200/200 and separate archive peer review26/26. Revision8 was never invoked; revision7 remains historical. This closes neither public/Simplify evidence nor formal W15/Gate A.
- Historical correction checkpoints: IN_PROGRESS. Root integrated the exact independently reviewed two-file patch3adbcf83e27327c1fe2293cc197c80ce22286cca50a1c7c665a1e1b1f6950177. Text/date snapshot the value immediately before focus and refuse drift before their sole setter. Execute suppresses recovery/undo only for the typed marker from those exact trusted drivers; generic and partial-write recovery remain unchanged. The unchanged eight-case independent GREEN passes11.2s with all four newer values preserved, zero additional setters/input/change events, no VERIFIED result and execute undo=false. All23 existing adjacent browser regressions pass54.7s, including actual partial-widget rollback; all13 bindings match. GREEN proof: docs/evidence/m02-w14-focus-value-green/proof.tar.gz, SHA-256 cd8fd90b9a4d2dcb7e196404e5ff791fd23b0e2325b2f5d069523c1916c2e447,9803118bytes/456 members. Corrected355-file runtime is8c61ebee8af7823f2812c514fb2bbb5eb0ca44c95b919a5ac3919eb9b5fec9cc. Clean fc48930 executes the permanent eight focus cases successfully, but its full aggregate fails the native128 target20 threshold (KI-0096), so it does not close the complete regression obligation. Revision8 coordinator is source-reviewed but NEVER INVOKED, UNEXECUTED and UNRELEASED because the full run failed; candidate/legacy actor counts are0. The reviewed guard would refuse that failed full run, but no coordinator invocation or guard-refusal execution is claimed. Its proof is docs/evidence/m02-w14-revision8-coordinator/proof.tar.gz, SHA-256 9be801fefecb570931ad717d978cc5c058a2090db7045fae335f723c097fc3ff,28025bytes/14members. The later pure metadata correction changes the runtime again; complete frozen regression and a newly source-bound comparison remain pending. No Gate A approval is inferred.

### KI-0095 — Function-scoped repository copies exhaust native Windows test storage

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 from terminal Windows CI job117206260868 in run38970154103
- Affects: M02-W14; full Python verification fixture lifecycle and hosted Windows capacity
- Description: full-docs fixture copies accumulate until session cleanup. The918 docs payload and255 declared fixture users imply about30.80GiB of logical copied docs. The actual Windows run reaches18 setup errors while copying docs, and the runner explicitly reports insufficient disk space. That failed918 run has no complete Python or aggregate PASS.
- Reproduction: actual tested merge3781e31a17013ae361f14f371502196a7f516245 has treebd9eb473719dba61ed842c266c553e334c893538, exactly918. The first recorded setup error is test_gate_v2_waiver_refuses_invalid_owner_decision_row[missing] at full docs copytree. Original Windows raw SHA-256 e866fd0df169e7ce4227f336a3b5bb6e7123c0bed94ad3d221ad61ba76ecc3ec,962594bytes. Complete three-OS proof is retained in docs/evidence/m02-w14-918-ci; Ubuntu/macOS pass19 active suites. Windows compiler8 twice/contracts2524 pass; its final Python summary is absent and tracked-clean is SKIPPED. A separate contact child-environment test has an F progress symbol and no retained stack; its cause remains unresolved and is not assigned to disk exhaustion.
- Workaround: preserve every full input, assertion and isolated copy. Do not omit archives, share mutable hardlinks, ignore cleanup failures or increase CI budgets to conceal the capacity failure.
- Resolution + evidence link: FIXED at the complete-copy fixture lifecycle and native verification scope. The reviewed try/yield/finally correction remains unchanged. Fresh native fc48930 run38979349323 passes all19 active suites on all three platforms, including Windows1452 Python in673.22s,201 status IDs,11 contact-proof IDs and tracked-clean; Ubuntu/macOS pass1454. Native proof: docs/evidence/m02-w14-fc48930-ci/proof.tar.gz, SHA-256 5f416858c4585067fbf656e350152475fc1bf342ec799aa1fbb03dfcf18f9434,814341bytes/85 safe regular members; independent retained archive/API/log/source review is clear. Later clean730 local full Python1454/1454 passes305.66s within the full19-suite PASS. The old918 stackless contact F has no retained cause: UNPROVEN remains explicit despite fresh success. No capacity explanation is assigned to it, and no later final-head native CI result is claimed.
- Historical correction checkpoints: IN_PROGRESS. Ruff rejects the initial finalizer-only proposal186b6a45 under PT021; its source/proof05a84f35 remain unchanged history. Root now integrates exact corrected patch9426e72a384533f86459a49db48e45aa2b89ddf821f2a86851995d1dcba2fcc4: each fixture uses Iterator[Path], preserves all original full-copy setup inside try, yields the same owned Path, and strictly removes only its tmp_path/repo in finally. Setup-copy exceptions also unwind through cleanup. Independent48 checks preserve all569 assertions,218 test functions and six finding-list literals; targeted Ruff lint/format pass without policy changes. Complete corrected proposal/review and original failed/corrected static records: docs/evidence/m02-w14-fixture-lifecycle-yield/proof.tar.gz, SHA-25699523db9cd272a483b147097d6b955b4015b19574ed64b6abc05cce3580b3a2b,90240bytes/22 members. Production/environment guards and thresholds remain untouched. Clean fc48930 now passes all1454 local Python tests in299.26s with complete tracked-source neutrality; proof is docs/evidence/m02-w14-frozen-fc48930/proof.tar.gz, SHA-256 28e1132c7762c3327f0943bad8973625e74e8a14ff556d9ad0c12efacc564a0a,5089970bytes/48members. Fresh complete native Windows verification remains pending, so this issue stays IN_PROGRESS; the separate contact-environment F stays causally unresolved.

### KI-0096 — Frozen native128 target timing exceeds the unchanged threshold

- Severity: HIGH
- State: FIXED
- Discovered: 2026-10-16 during M02-W14 frozen validation at fc48930
- Affects: current M02-W15 final-candidate validation; Gate A generic scan/fill performance; historical M02-W14 failures
- Description: clean fc48930 completes18 active suites PASS and one FAIL. The only default-browser failure is the native128 target20 p95,1527.9433329999993ms against unchanged <=1500ms;241 other browser cases and all1454 local Python tests pass. Four live resolutions per field,128 physical fills,512 resolutions and768 descriptors remain measured; the failed threshold cannot be replaced by other passing scopes.
- Reproduction: run the exact frozen outer Python-wrapper command recorded in docs/TEST_EVIDENCE.md § M02-W14; the wrapper records its `pnpm verify` child argv and target20 environment. The complete failed run, raw rows, source/command endpoints and independent1478-Git-blob closure remain retained in docs/evidence/m02-w14-frozen-fc48930/proof.tar.gz, SHA-256 28e1132c7762c3327f0943bad8973625e74e8a14ff556d9ad0c12efacc564a0a,5089970bytes/48members; archive peer review passes21 checks. This is failed historical-source evidence, not current-runtime or gate approval.
- Workaround: none accepted. Do not round down, omit slow samples, change thresholds/waits/cache budgets or bypass live identity/validation/recovery checks.
- Historical resolution + evidence link: FIXED at the earlier unchanged native128 target20 regression scope. Complete clean730 local verification now passes all19 active suites, with native128 nearest-rank p95(rank19)1447.4198340000003ms below unchanged1500ms; all20 samples retain128 physical actions/512 re-resolutions/768 descriptors. The same bounded seven-hash correction and all live authority checks remain. Full proof: docs/evidence/m02-w14-frozen-730c641/proof.tar.gz, SHA-256 0584744b75a3940f88d35fa842fd9386c66b9a9a8d12c5de278d957d0deb8c58,6867546bytes/88 safe regular members; independent full-data audit79/79 and separate archive peer review24/24. Actual revision9 is independently reconciled200/200 under the same runtime and lock; docs/evidence/m02-w14-revision9-actual/proof.tar.gz, SHA-256 72bf11df63cad7b036d1c08e005430d6c8a87b757e0868336087cd14adb817b8,1058673bytes/102 safe regular members; corrected independent actual-data audit200/200 and separate archive peer review26/26. This is the existing zero-settle/no-async-rerender lower-bound harness, not final full-settlement Gate A performance proof. Earlier fc1527.9433329999993ms failure and separate focused1473.5945839999986ms pass remain retained; no isolated causal hash-cost claim, threshold waiver or final Gate A PASS is inferred.
- Historical correction checkpoints: IN_PROGRESS. The reviewed one-file correction issues the same seven immutable result metadata computations concurrently, waits with Promise.allSettled and unwraps in original order, preserving eventual raw rejection identity, exact seed/output bytes, field order and all posthash authority witnesses. Final driver-engine SHA-25622071b77f7610b315dc58f51275d3703f895c92f5f6c919f2efbbd275a312557; corrected355-file runtime3b6c0e0c0950b03e3bb9e1f12b27bb8d385174c36fb4b68ef3345597aa8b3502. The pure metadata differential passes3 success/7 single-rejection/21 pair/all-seven profiles; it is not canonical/browser proof. All21 affected actual-MV3 guards pass24.1s. The separate unchanged native128 target20 run passes p95 1473.5945839999986ms, closing2026-10-16T23:11:06Z with source/status/head unchanged. Focused proof: docs/evidence/m02-w14-build-result-concurrency/proof.tar.gz, SHA-256 2620c4c3706a78f4895c5dc9e67450f0924b45d2f5d5ab5bd6fe94d5e09628ef,4275812bytes/95members; independent archive peer review passes24 checks, distinct from the retained40-check actual-evidence audit. Complete affected frozen regression remains pending; no measured hash-cost attribution or final Gate A PASS is inferred.

- Reopened2026-10-17: exact clean507a/tree235bc696fb37e887b5efa817039276a775a18e2e completes18/19 ACTIVE suites PASS and native128 FAIL at p951662.986499999999ms (rank19/20;7/20 above1500ms), preserving128 actions/512 live resolutions/768 descriptors per sample. All1587 tracked files, HEAD/tree/status and355-file runtime3b6c remain exact. Cause is UNPROVEN. Separate actual phase diagnostic also FAILS1644.6497500000005ms; it identifies the execution phase as dominant without attributing a causal percentage. The one-line preventScroll focus proposal is independently source-clear; meaningful real-focus/viewport RED/GREEN and unchanged regressions are pending, with no performance fix or current PASS inferred. Closed raw507a result, independent81/87 failure-aware full audit,336/336 mounted/10/10 resolver audits and actual synthetic image inspection: docs/evidence/m02-w15-failed-507a/proof.tar.gz SHA2567bc9ac8e69969c98aaf2030d2ab04a1285ff8a9189c932a3ecb0201f749f55a5,6717941bytes/39outerregularmembers, including the unchanged96member independent failed-component archive. Original failure trace/screenshot remain lost; no diagnostic replacement claim.
- Current corrective source (2026-10-18UTC): distinct TEXT/TEXTAREA-only987/c46 proposal is root-integrated after actual RED4 intended viewport failures/GREEN28PASS and independent source clearance; original date49b failure and eaf invalidtextarea/W09refusals remain unchanged. Complete root241extension units/type/lint/format/status/trace and R10pure42 PASS. Candidate355runtime/harness inventory4f5a/3372811 and newR10lock0b7c are frozen, future releaseNULL/0actors. Performance target20/finalfull/native/currentbaseline/keyreview pending; no measured benefit/currentPASS or causeclaim. Complete exact source/focused/history/review/root evidence: docs/evidence/m02-w15-corrections-integration/proof.tar.gz SHA25687a507c911329262572c159537a4ee7bffb5ad3a7db40b00f1e126fbf6278481.
- Latest actual246 canonicaltarget20: oneoriginal120000ms whole-testtimeout, childexit1, no W13aggregate/p95 (null). Eighteen complete native128 iterations preserve allrequiredcounts/VERIFIEDvalues;19th firstbatch pendingonly~2.641ms beforeteardown,20thnotstarted. Source1642/cleanhead/tree/runtime3554f5a unchanged; all6nativeartifacts/trace retainedimmediately. Cumulativebudgetexhaustion isobserved; rootcause/visibility/timereffectUNPROVEN, notone120-secondRPCstall. Exactraw/source/independentclosedtrace proof: docs/evidence/m02-w15-canonical-246-timeout/proof.tar.gz SHA256b2fc20e5d81d3f3258d156ecaff55dcb2cbe2470e8647ad5793a5855fa633840. Foregrounddiagnostic onlysource-prepared; no rerun/deadlinewaiver/performancefix or newfullPASS.

- Current foreground-method correction (2026-10-18UTC): Foreground measurement correction: independently reviewed patch17e9e2800095838469e1752944df4e5bb2ec3b6c86a4a87c364748cfa06a1474 is integrated as benchmarkc1864e71bd22d8c8df596bdec77bc39bce6b11b69171893cb0d9cd3cb1df48e2. It declares the actual target Chrome tab active and visible before original timing and checks both after each synchronously retained completed row. Original timed span6b066, assertions, row values,20samples,1500ms,120000ms and zero settlement remain exact; complete355/3372811/runtime4f5a is unchanged. Root e2e TypeScript/lint/format/status45/trace193-300/diff PASS. Actual separate V3 diagnostic completes22rows/20native128, p95842.6034590000017ms; all original/before/after DOM visibility/focus values stay visible/true, while only active-tab IDs transition to target. This proves no timer/root cause and supplies no canonical acceptance. Optional command-line metadata remains UNAVAILABLE once with0actualargv; normal successful retention produces only.last-run.json, no trace. Canonical246 timeout,507a failure and V2 zero-sample query failure remain preserved. Exact source/raw/derived corrections/root checks and nested58member independent source/raw review: docs/evidence/m02-w15-foreground-method/proof.tar.gz, SHA2561255fdcc4bd31191098f9a486a98c52782de98bf0f264fb4bbf82ad0925195b1,664265bytes/103outerregularmembers, exhaustivecomparisonPASS. Fresh frozen full/current nativeCI/R10/key14 and source-bound owner decision remain pending; W15/GateA stay IN_PROGRESS.
- Current resolution (2026-10-18UTC): Actual frozen95f5 strict full99 and separate canonical20 pass unchanged1500ms at846.236875/847.323333ms; currentR10comparison204 and freshkey14 close. Foreground measurement is declared outside original timed work, with20samples/120000ms/settle0 unchanged. This fixes the current accepted regression scope, not a causal explanation or historical PASS. Source-bound proof and independent PASS recommendation: docs/evidence/m02-w15-review-95f5; owner Gate A decision remains pending.

### KI-0097 — Evaluation harness acquisition and rejected-close paths can skip owned cleanup

W15 independent source inspection at507a additionally confirmed the inherited test-only e2e/extension/support/extension-test.ts close-before-remove and unguarded listener paths. The distinct independently source-clear correction7346d2cddf53ea3261e1d74fd8a4c6c36419dcd6d4ab5201aa669274d9ffc8a9 is now root-integrated: guarded acquisition/use/isolation and cleanup that always attempts owned close/removal with explicit primary/secondary errors. Same28fake cases yield original16FAIL/12PASS and candidate28PASS; combined outside cleanup family46PASS. Root complete extension241units, complete typecheck/lint/format/status/trace and newR10pure42 now pass; final clean-candidate validation remains pending. Sealed R9 remains unchanged; newR10 initial-writer correction is separately prepared/unreleased. No actual historical run leak or whole-family FIXED claim is asserted.

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-17 by the independent230-path source closure review at frozen6384d98156ae198cd93d7b35d1bb28b501ed475e/tree d2c1fd5e50bbbd31a926cbf251d6140d11b9b9c4, finding SRC-CLEANUP-01
- Affects: opt-in public contact/inspection evaluation harness error paths; separate future corrected legacy campaign acquisition
- Description: contact-harness.ts creates its owned temporary profile, then awaits context launch, HTTP route and WebSocket route before entering the cleanup try. Those acquisition/setup rejections can bypass cleanup. Both contact and inspection await context.close before profile removal without a finally, so a close rejection can skip the removal attempt. Inspection launch itself is guarded correctly. This is one source-control-flow cleanup family, not an observed run leak, numeric/scoring contradiction, unauthorized public write, shipped-runtime defect or fundamental Gate A architecture failure.
- Reproduction: inspect frozen6384 e2e/extension/public-contact/contact-harness.ts:310–374 and494–504, and e2e/extension/public-research/inspection-harness.ts:151–162 close/removal paths. Meaningful injected launch/HTTP-route/WebSocket-route/later-setup/rejected-close/rejected-removal/ownership-transfer cases are separate corrective verification; the source review itself ran none.
- Workaround: retain the original error and honest cleanup outcome; do not relabel rejection as cleanup success or weaken caller assertions. The existing successful6384 measurements retain their actual source and observation scope.
- Resolution + evidence link: OPEN, MEDIUM M02 corrective work before the final W15 decision. The final separate three-file correction98d6e14cd31514623bf5d93550ecd73dc65a0347fb81f3baf12d134319e2dcb8 has independent source clearance and actual focused author evidence: the same18 fake-context cases yield13 original failures/5 passes and18 candidate passes in355ms. Sparse outside type/lint/format/policy checks pass. Exact sources, logs and review are retained in docs/evidence/m02-w14-harness-cleanup/proof.tar.gz (SHA256a885cd4d29f950fbf067d60f4a8fc7b48753c308891f6938b5c284e82db891b9). The exact patch is now root-integrated with213 complete extension units, complete repository typecheck/static checks and status/traceability passing; proof is docs/evidence/m02-w15-cleanup-integration. Controlled-browser and final clean-candidate/key-case validation remain pending; unmodified6384 is not claimed fixed. W14 may close at actually tested6384 with this finding disclosed, and W15 may begin; integrate the reviewed correction and run a full clean final candidate plus key independent reproductions before any Gate A decision.
- Sealed R9 boundary: legacy-browser.mjs creates its owned profile before the initial evidence-write/finalize operation outside its try, so initial writer rejection can leave an empty owned profile. Its normal cleanup separately attempts close and removal. The original R9 actor and all65 locked campaign files stay byte-exact; record the initial-writer cleanup repair as a precondition of any future corrected campaign before a new invocation. Do not mutate sealed R9, rerun it to rewrite history or transfer its outcomes to corrected source. No actual historical R9 leak is asserted.
- Current resolution (2026-10-18UTC): Reviewed contact/inspection/inherited-fixture/R10 initial-writer corrections now close actual frozen95f5 local19 and native3host full PASS, freshkey14 and currentonce-executed4+4comparison204. Fake acquisition/rejected-close proofs remain retained. Normalownedcleanup is observed; OS descendants and unexercised failures remain outside that observation. No historical leak is asserted. Source-bound proof and independent PASS recommendation: docs/evidence/m02-w15-review-95f5; owner Gate A decision remains pending.

### KI-0098 — Controlled Playwright invocations erase default-suite failure artifacts

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-17 during final507a failed native128 evidence closure
- Affects: M02-W15 browser evidence retention; controlled contact/inspection Playwright output configuration
- Description: all three configs use the pinned Playwright1.62 nearest-package default test-results directory. Ordinary controlled-suite startup clears it after default-suite failure, erasing the original native128 trace/screenshot. Raw aggregate/log and all22 timing rows survive; the original native failure artifacts remain unavailable. A later separate diagnostic trace is not their recovery.
- Reproduction: pinned actual CLI fixture reproduces deletion with original configs, then preserves a real failure trace.zip and marker byte-for-byte after both controlled invocations with distinct descendant output directories. Exact three-file patch177181da420e4852f5ac18ccb00758f03f06e8ea78db01e8221c601127f99793 and actual61focused checks/discovery2+62 have independent source/raw clearance; root integration now passes41existing CI tests plus Ruff/format/mypy/config lint/format/diff, with exact afterimages and unchanged policy bindings. Final-candidate validation remains pending.
- Workaround: copy closed native failure artifacts before a subsequent invocation; do not infer original trace closure from later diagnostics.
- Resolution + evidence link: IN_PROGRESS. Failed507a retained source/observation and independent review: docs/evidence/m02-w15-failed-507a. Exact root integration and pinned author evidence: docs/evidence/m02-w15-retention-integration/proof.tar.gz SHA256946a85efbb9984d5b3c6796f0f1fc4f90678308acb9b950b55720baafa34ec9c. The correction preserves existing41CI test identities, Python inventory, retries0, trace policies and recursive CI artifact upload. No historical artifact recovery or current full PASS is asserted.

- Current resolution (2026-10-18UTC): Distinct controlled output directories and immediate native retention are validated by retained actual marker/traceRED-GREEN, unchanged41CI tests and complete current95f5local/native verification. Current successful default run correctly retains only.last-run; old507a trace/screenshot remain unavailable and are not recovered by later proof. Source-bound proof and independent PASS recommendation: docs/evidence/m02-w15-review-95f5; owner Gate A decision remains pending.

## M02-W14 local defect closeout — 2026-10-16

KI-0077 through KI-0087 are FIXED at the code scopes recorded above and frozen checkpoint b8b1423: all19 active suites pass,3859 TypeScript units,228 default browser tests,61 then-required controlled tests and1454 Python tests. Source/build/declarations and Git status remain unchanged. The later observation correction adds a mandatory62nd controlled proof and preserves all originals. This closes local defects only; public scored coverage, normal-user Simplify comparison and independent W15/Gate A acceptance remain incomplete. No later package is started.

## M02-W13 final closeout and retained limits (2026-10-01)

KI-0070 through KI-0076 are FIXED at verified content4745149f4b5da7190b5b0c68753f8ec07bed572d /tree a953274ef14a7534c39201a09738c26b8f085332. Earlier local/blocked lifecycle statements below are historical checkpoints; final governance makes W13 VERIFIED and W14 sole READY. Exact-SHA target 20 p95 is1391.5025000000005ms. Final A–N internal review has no residual PACKAGE_BLOCKER or DIRECT_REGRESSION. Evidence: docs/TEST_EVIDENCE.md § M02-W13 verified harness and docs/evidence/m02-w13-closeout/final-verifier.json.

DOCUMENTED_LIMITATION: generic precision counts all attempted fields. W14 must predeclare its supported cohort and derive ordinary attempted precision from immutable field class, attempted flag and primary score; it must not directly map generic PRECISION to that Gate A dimension. The target timing is a zero-settle development lower bound, while the four-family harness separately exercises75ms settlement/20ms rerender. Full-settlement/frozen partitions and actual authorized holdout/public/Simplify/legacy comparison are FUTURE_OWNER W14; independent Gate A decision is W15. The bounded1024-entry/512KiB pure SHA memo retains memory without target authority; historical raw timing source hashes remain historical. None is final Gate A evidence; all gates NOT_EVALUATED, release NOT_READY.

## M02-W13 finite evidence corrections

### KI-0073 — Canonical replay metrics could contradict independently verified raw scores

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 internal verifier families C/E
- Affects: M02-W13; packages/evaluation-runner/src/autofill-manifest.ts
- Description: raw re-scoring and canonical replay were individually valid, but a coherent rewritten witness could publish different metrics while retaining the correct score digest. Classification: PACKAGE_BLOCKER.
- Reproduction: retained `manifest rejects a coherent replay whose metrics contradict its committed raw score` changes correct_fills to zero then derives a coherent FAIL execution; before the fix the manifest accepted it. Raw failing log: docs/evidence/m02-w13-harness-development/manifest-drift-reproduction.log.
- Workaround: n/a.
- Resolution + evidence link: shared pure score-to-observation projection, normalized through accepted W05 validation, compares the complete witness observation including metrics/exact proportions, paired counts, artifact commitments, status, errors and participation. Full runner335/335 passes; affected MV31/1 and finite exact-snapshot re-review CLEAR. docs/TEST_EVIDENCE.md § M02-W13.

### KI-0074 — Worksheet observation timestamps were paired with a different case

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 internal verifier family I
- Affects: M02-W13; e2e/extension/extension-autofill-harness.spec.ts
- Description: authored family order differed from canonical case-ID-sorted replay order; positional timestamp joining mislabeled each worksheet. Classification: DIRECT_REGRESSION.
- Reproduction: permanent actual-MV3 worksheet assertion matches case_id independently; the original run failed with different observed_at instants. Raw log: docs/evidence/m02-w13-harness-development/worksheet-drift-reproduction.log.
- Workaround: n/a.
- Resolution + evidence link: join replay windows by canonical case_id before selecting ended_at; affected MV31/1 and finite exact-snapshot re-review CLEAR. docs/TEST_EVIDENCE.md § M02-W13.

### KI-0075 — Scorer accepted inconsistent local artifact schema and family metadata

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 internal verifier families A/C/S16
- Affects: M02-W13; packages/evaluation-runner/src/autofill.ts
- Description: canonical schema validity alone allowed an unsupported oracle schema reference or unrelated benchmark family. Classification: PACKAGE_BLOCKER.
- Reproduction: four permanent S16 metadata negatives substitute oracle/input v999, CONTRACT_COMPATIBILITY family, or a different input digest; all four originally scored successfully. Raw log: docs/evidence/m02-w13-harness-development/case-binding-reproduction.log.
- Workaround: n/a.
- Resolution + evidence link: require AUTOFILL_FEASIBILITY, exactly one supported local oracle artifact with its immutable digest, and one supported input artifact matching the oracle profile digest; adapter independently verifies the input preimage. Local refs do not change canonical schemas. Full runner335/335 passes; affected MV31/1 and finite exact-snapshot re-review CLEAR. docs/TEST_EVIDENCE.md § M02-W13.

### KI-0076 — Corpus verification proof did not include the new interface tests

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 frozen canonical PASS1
- Affects: M02-W13; scripts/verification-suites.json evaluation-corpus registration
- Description: the focused corpus command runs218 passing tests, but its accepted exact-count guard still requires207 and discovery lists only W06. Classification: DIRECT_REGRESSION in verification metadata.
- Reproduction: full `pnpm verify` at invalidated tree86e72fbb80683d3e90d1ab0be992339714410978 fails only evaluation-corpus proof, reporting218 rather than207. All other active suites pass, including134 browser,1390 Python and retained Rust checks. Raw log: docs/evidence/m02-w13-closeout/invalidated-pass1-verify.log.
- Workaround: n/a.
- Resolution + evidence link: retain all 207 W06 tests unchanged, discover the11 W13 interface stand-ins and require exact218 with unchanged no-skip proof/commands. `pnpm verify --suite evaluation-corpus` passes 218/218 and the discovery proof. No test exclusion or lower count. Freeze invalidated; BOTH full canonical passes restart on the updated bytes. docs/TEST_EVIDENCE.md § M02-W13.

## M02-W13 bounded-stop findings

### KI-0070 — Total current-root re-resolution exceeds the target Mac budget

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 finite family L development checks
- Affects: M02-W13; M02 measurement viability; apps/extension/src/field-scanner.ts
- Description: the actual W08/W09/W10/W11 path performs four fresh full-root identity resolutions per filled control. At128 controls, the final zero-settle lower-bound run still examined65792 candidates across512 re-resolutions, took3914.29ms wall time and2509ms scanner time, while W11 reported only5ms. The target Mac is Apple M5, Mac17,2,24GiB; main-page CDP task duration increased3.064421s. This is PACKAGE_BLOCKER; it is not a final p95 estimate or Gate A verdict.
- Reproduction: run `pnpm exec playwright test e2e/extension/extension-benchmark.spec.ts --grep 'total scan'` with the real built MV3 extension. Inspect total scanner work and independent physical action counts for8/32/128 controls; do not use W11 scan time as total cost. Exact measured bytes, build hashes and raw log are in docs/evidence/m02-w13-blocked/manifest.json.
- Workaround: none. Do not raise the1500ms budget, skip fresh safety resolutions, lower coverage or represent this development run as final gate evidence.
- Resolution + evidence link: FIXED locally under the owner's 2026-09-30 authorization and ACCEPTED ADR-0005. Rescue round 1 replaces repeated semantic DOM matching with a bounded current identity index and fresh selected-target descriptors. The unchanged 128-control case retains all 128 verified fills and 512 live re-resolutions; 20-sample target-Mac p95 is 1,468.28 ms. Three candidate enumerations/one index build replace repeated root matching. Raw evidence: docs/evidence/m02-w13-performance-rescue; contract/workflow: docs/M02_W13_AUTOFILL_BENCHMARK.md. The original four-round stop and bytes remain preserved. This closes the local scaling defect only: W13 is IN_PROGRESS, W14 remains NOT_STARTED, and Gate A remains NOT_EVALUATED.

### KI-0071 — Concurrent delayed repeater operations can duplicate a physical click

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-30 during M02-W13 family J development regression
- Affects: M02-W13; apps/extension/src/dynamic-engine.ts in-flight action deduplication
- Description: equivalent requests arriving before the first delayed repeater operation entered the ledger both clicked ADD. The minimized real-MV3 fixture independently measured two physical clicks.
- Reproduction: the retained permanent `W13 J: overlapping delayed repeater operations perform one physical click` submits equivalent concurrent transactions against a30ms delayed synthetic repeater. Its original run measured2 instead of1.
- Workaround: n/a.
- Resolution + evidence link: atomic in-flight reservation by existing semantic action identity before the driver awaits, released in finally; duplicates receive local IN_FLIGHT_SUPPRESSED without fabricated canonical execution results. Independent meters now observe exactly1 click and1 input event in the two J regressions. All70 browser tests passed before the late K recovery fix; final affected suite34/34 passes. This closes the local defect only, not W13 verification. docs/TEST_EVIDENCE.md § M02-W13 blocked development attempt; docs/evidence/m02-w13-blocked/browser-regressions.log.

### KI-0072 — A temporary capacity refusal can leave a falsely complete empty inventory

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-30 during late M02-W13 family K review
- Affects: M02-W13; apps/extension/src/dynamic-engine.ts root/subtree recovery
- Description: the draft local capacity refusal returned no descriptors but did not latch the incomplete root/subtree scan. Start observation at 513 controls, remove one optional control inside a single section, then reconcile: the minimized regression reported total0 instead of512, omitting the remaining required control.
- Reproduction: permanent `W13 K: observation beginning over capacity requires a complete recovery scan`; the original run failed expected512/received0. Its second phase also inserts and removes a transient513th control between reconciliation passes while the observer drains each batch.
- Workaround: n/a.
- Resolution + evidence link: latch every observed root/subtree capacity refusal, clear inventory, and reset only after a complete current root scan; carry refusal from actual candidate capture and recheck the bound after async scans and all inventory hashing immediately before canonical publication. Both recovery phases now prove total512, required_unresolved1 and NOT_READY; initial513 reports CAPACITY_EXCEEDED with no canonical inventory. The bound512 and canonical schemas are unchanged. Final affected browser suite34/34 passes; docs/TEST_EVIDENCE.md § M02-W13 blocked development attempt.

## M02-W12 finite internal verification corrections

### KI-0069 — Retained exhaustive calendar test exceeded hosted deadline under file contention

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 hosted CI correction2
- Affects: M02-W12 retained-suite portability; packages/evaluation-runner/package.json
- Description: after the W12 matrix tests passed65/65 on Ubuntu, the unchanged M02-W05 whole-domain UTC reference test took6047ms against its default5000ms deadline. Windows also timed out the unchanged paired-count rejection case at 5078ms in the same file (job101557017782, same run). Other runner cases took up to4690ms during concurrent file initialization. This is TEST_PORTABILITY, not a calendar assertion mismatch.
- Reproduction: Ubuntu job101557017908 of run34059370913 at 268d954ef5bf6bb1ea3d0b630b47dab9178659e5; complete raw log4168 lines/478894bytes, SHA-2569b7a53a3c27b27f458ddaad4fd7cb1c87e63ccd9b0d21e7858a6e5fae2f78f71.
- Workaround: n/a.
- Resolution + evidence link: apply the existing single-worker/no-file-parallelism Vitest convention only to evaluation-runner's test command. Every test source byte, all 10000 years/reference assertions, test count290 and default deadlines remain unchanged. Concurrent focused suites601 PASS; integrity, finite replay, two new frozen canonical passes and exact forward-SHA hosted proof are required before governance. docs/TEST_EVIDENCE.md § M02-W12.

### KI-0068 — Batched matrix-integrity negatives exceeded one hosted test deadline

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 hosted CI round1
- Affects: M02-W12; packages/ats-adapters/test/matrix.test.ts and package.json
- Description: nine full matrix revalidations shared one default5000ms test; Ubuntu measured5561ms under concurrent workspace tests. A retained runner test also crossed5000ms during the same burst. Classified TEST_PORTABILITY; no semantic assertion failure observed.
- Reproduction: Ubuntu job101549006289 of run34056407698 at 475dcb69e5f31caa8ea941980396d2c250d6c2c5; complete raw log preserved in the W12 evidence directory.
- Workaround: n/a.
- Resolution + evidence link: register all nine negative cases independently under unchanged per-test deadlines, and bound the ATS test package to one worker/no file parallelism. All65 ATS tests pass; no old test, fixture, manifest, core or global timeout change. Retained and hosted proof required in the forward correction; docs/TEST_EVIDENCE.md § M02-W12.

### KI-0067 — Imported test tables failed canonical test-integrity proof

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 canonical pass 1
- Affects: M02-W12; packages/ats-adapters/test/research-adapter.test.ts
- Description: three `it.each` tables imported runtime enums; the repository policy could not statically prove them safe/nonempty. All57 ATS tests and125 browser tests passed, but aggregate integrity and its real-repository Python oracle correctly failed. Classified DIRECT_REGRESSION in correction round2.
- Reproduction: `pnpm verify --suite integrity` at invalidated content tree 2da677733fa79e66d80360d7298994b6ae5c9af6 reports three unprovable parameter tables.
- Workaround: n/a.
- Resolution + evidence link: explicit closed literal tables preserve all 12 session,11 step and4 family cases and every assertion, independent of runtime enum availability;57 tests and canonical integrity pass. No runner/policy/implementation change or test skip. Both frozen canonical passes restarted; docs/TEST_EVIDENCE.md § M02-W12.

### KI-0066 — Writer status edit matched a gate-description sentence

- Severity: LOW
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 internal verification
- Affects: M02-W12; docs/PROJECT_STATUS.md
- Description: a broad string replacement targeted a prose mention of `- State:` before the Active work section, leaving stale W11 active prose and damaging the section boundary. Classified DIRECT_REGRESSION.
- Reproduction: inspect initial candidate d548c559d32a9f57fc98eeee94b0e04b7a81f401 Active work boundary and compare current package prose with its work-package table.
- Workaround: n/a.
- Resolution + evidence link: restored gate description and exact Active work heading, replaced current paragraph with truthful W12 state, retained historical W11 evidence link. Status validator45 groups and original verifier replay PASS; docs/TEST_EVIDENCE.md § M02-W12.

### KI-0065 — Canonical research DOM collection omitted protected overlays

- Severity: HIGH
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 internal verification P13
- Affects: M02-W12; e2e/extension/extension-research.spec.ts research evidence collector
- Description: stale GUEST metadata could hide a later canonical `data-session-boundary=MFA` overlay from the collector. Pure classifier already failed closed when supplied the boundary; collection omitted it. Classified PACKAGE_BLOCKER.
- Reproduction: in initial candidate d548c559d32a9f57fc98eeee94b0e04b7a81f401, append MFA boundary marker to guest research form; collected evidence incorrectly yields eligible posture.
- Workaround: n/a.
- Resolution + evidence link: collect all canonical session-boundary markers, which dominate safe metadata; permanent actual-DOM tests cover all nine protected/unknown overlays. Original P13 using the corrected collector verbatim returns PAUSE/SESSION_BOUNDARY; docs/TEST_EVIDENCE.md § M02-W12.

### KI-0064 — Matrix repeaters lacked complete canonical operation coverage

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-09-06 during M02-W12 internal verification P8
- Affects: M02-W12; packages/ats-adapters/research/fixture-html.ts and matrix.ts
- Description: initial actual matrix rows omitted the complete accepted W10 controller/ADD affordance and education/language repeaters; a separate generic example did not establish operations on the actual matrix. Classified PACKAGE_BLOCKER.
- Reproduction: inspect materialized work-experience, education and skills/languages variants at initial candidate d548c559d32a9f57fc98eeee94b0e04b7a81f401; attempt accepted existing/new/reordered repeater operations.
- Workaround: n/a.
- Resolution + evidence link: actual synthetic matrix supplies canonical controller, stable semantic labels, item values and ADD affordance across all three classes. Permanent minimized unit regression plus real-MV312-family/class matrix proves existing/new/parser/reorder/rerender/ambiguous/duplicate behavior. Generic core unchanged; original P8 PASS; docs/TEST_EVIDENCE.md § M02-W12.

## M02-W07 final-verification correction

KI-0058 through KI-0062 are FIXED by exact independently cleared W07 content
commit `ce74ef49e142bb7c2cab608cd0c800d312bd2217` / tree
`9412c5b71437ee562534a1fb92e80ab50ffc333d` after verdict
`SOL_CLEAR_FINAL_M02_W07_NINTH_CORRECTION_CONTENT` and hosted run
`32522233170`. The later governance-enablement commit
`5d2cc2322e215b2de9e363da996cf625afdb7424` / tree
`77c1bec24ce694b879ec5f580146f7a1ad40f9b4` changes only historical W06
lifecycle-fixture isolation and does not alter the product, analyzer, validator,
or W07 semantics that fixed these issues. The blocked-verifier and correction
history below remains preserved as reproduction evidence.

### KI-0062 — M02-W07 protocol closure allowed unreviewed command-shaped expansion

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-13 during fresh final M02-W07 independent verification
- Affects: M02-W07; exact blocked content
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` / tree
  `ddb6df168684ab5f534ac1125f14bb85067e613c`; feasibility probe/ACK
  protocol and real background worker
- Description: the canonical parser rejected its fixed malformed corpus, but
  the permanent suite did not prove that the runtime message surface was
  finite. A second accepted product-shaped request could be added without any
  canonical test observing the expansion.
- Reproduction: in a disposable no-hardlink clone of the affected content,
  add a second `parseFeasibilityProbe` success branch for
  `{ command: "fill" }`; all 40 extension tests and all ten W07 real-extension
  E2E tests still pass. The independent verdict was
  `SOL_BLOCKED_FINAL_M02_W07_VERIFICATION`.
- Workaround: none accepted. W07 cannot expose a product command bus, and
  banning one command word would leave the equivalent protocol expansion.
- Resolution + evidence link: FIXED. The permanent parser matrix covers
  command/kind/payload/data/nested and extra-operation families, while a
  bundled-Chromium test sends the literal canonical probe plus hostile shapes
  to the actual built worker and admits only the literal canonical ACK. Fresh
  independent verification cleared exact content commit `ce74ef49` / tree
  `9412c5b7`; evidence: docs/TEST_EVIDENCE.md § M02-W07.

### KI-0061 — M02-W07 WXT page-visible bootstrap artifact contradicted marker-only evidence

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-13 during fresh final M02-W07 independent verification
- Affects: M02-W07; exact blocked content
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` / tree
  `ddb6df168684ab5f534ac1125f14bb85067e613c`; WXT 0.20.27 content-script
  bootstrap, E2E, traceability, compatibility, and evidence wording
- Description: W07 evidence claimed page observability was limited to the
  readiness marker, while WXT 0.20.27 also dispatches a page-observable
  document CustomEvent named
  `<extension-id>:feasibility:wxt:content-script-started`. Its detail contains
  only the fixed content-script name and a random injection id, but the E2E
  suite listened only for `window.message` and therefore did not prove or bound
  the event it claimed to assert.
- Reproduction: load the affected built extension in two fresh Chromium
  profiles and install an exact-name document listener before navigation; each
  document observes the WXT lifecycle CustomEvent while the page-world message
  collector remains empty. The independent verdict was
  `SOL_BLOCKED_FINAL_M02_W07_VERIFICATION`.
- Workaround: no supported narrow suppression exists in installed WXT 0.20.27.
  `noScriptStartedPostMessage` suppresses only its postMessage, and changing to
  the MAIN world would weaken the reviewed extension architecture.
- Resolution + evidence link: FIXED. The corrected real-browser proof observes
  the exact event type/detail and zero window messages; a Chrome trace begun
  before navigation detects every DOM event dispatch whose stack originates
  in the extension and admits only that exact lifecycle event. Source and
  shipped-byte tests provide defense in depth, and documentation models the
  event as a bounded non-sensitive framework lifecycle artifact. Fresh
  independent verification cleared exact content commit `ce74ef49` / tree
  `9412c5b7`; evidence: docs/TEST_EVIDENCE.md § M02-W07.

### KI-0060 — M02-W07 inertness proof omitted live select and validation state

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-13 during fresh final M02-W07 independent verification
- Affects: M02-W07; exact blocked content
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` / tree
  `ddb6df168684ab5f534ac1125f14bb85067e613c`; native-form
  real-extension inertness E2E
- Description: the native-form snapshot listed `nat-disclosure`, an actual
  `HTMLSelectElement`, among checked inputs, so it collapsed to `false` and its
  value/selection was absent. Validation state was also omitted, and the
  nominal before-activation snapshot occurred after content-script injection.
- Reproduction: in a disposable no-hardlink clone of the affected content,
  make the actual production content script set `nat-disclosure` to the real
  non-default `not-veteran` option after ACK; all 40 extension tests and the
  three inertness E2E tests pass. The independent verdict was
  `SOL_BLOCKED_FINAL_M02_W07_VERIFICATION`.
- Workaround: none accepted. Moving one ID between hand-maintained arrays would
  retain silent gaps and would not supply a pristine pre-extension baseline.
- Resolution + evidence link: FIXED. The test compares an ordinary no-extension
  page with extension state after ACK and reload, generically serializing every
  form-listed control, select/checked/default state,
  disabled/required/read-only state, complete native validity, status/error
  regions, honeypot, storage, and route/history state. Fresh independent
  verification cleared exact content commit `ce74ef49` / tree `9412c5b7`;
  evidence: docs/TEST_EVIDENCE.md § M02-W07.

### KI-0059 — M02-W07 readiness marker lacked real ACK-causality proof

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-13 during fresh final M02-W07 independent verification
- Affects: M02-W07; exact blocked content
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` / tree
  `ddb6df168684ab5f534ac1125f14bb85067e613c`; built content-script and
  background-worker readiness proof
- Description: the clean implementation correctly gated the marker on a valid
  real-worker ACK, but the permanent suite proved only that a worker and marker
  both existed. It did not prove that the ACK caused the actual content
  entrypoint to set the marker.
- Reproduction: in a disposable no-hardlink clone of the affected content,
  make the production content script set readiness unconditionally and make
  the production worker return an invalid ACK; all 40 extension tests and all
  ten W07 real-extension E2E tests pass. The independent verdict was
  `SOL_BLOCKED_FINAL_M02_W07_VERIFICATION`.
- Workaround: none accepted. A pure helper or a second content implementation
  would not close a bypass in the built entrypoint.
- Resolution + evidence link: FIXED. A test-only WXT variant re-exports the
  actual production content entrypoint and substitutes only an isolated worker
  that records the canonical probe and returns an invalid ACK; real Chromium
  requires the probe and absence of the marker. It adds no product hook,
  permission, command, or manifest authority. Fresh independent verification
  cleared exact content commit `ce74ef49` / tree `9412c5b7`; evidence:
  docs/TEST_EVIDENCE.md § M02-W07.

### KI-0058 — PORT-SRC-008 TypeScript portability bypasses

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-13 during fresh final M02-W07 independent verification;
  the first and second corrections were independently re-blocked on
  2026-08-14, the third correction was subsequently independently re-blocked
  (verdict `SOL_BLOCKED_FINAL_M02_W07_THIRD_CORRECTION_VERIFICATION`), and
  the fourth correction was independently re-blocked on 2026-08-17 (verdict
  `FABLE_BLOCKED_FINAL_M02_W07_FOURTH_CORRECTION_VERIFICATION`), and the
  sixth correction was independently re-blocked on 2026-08-21 after its
  alias/shorthand surfaces cleared (verdict
  `SOL_BLOCKED_FINAL_M02_W07_SIXTH_CORRECTION_VERIFICATION`), the seventh
  correction was independently re-blocked after its hoisted-function surface
  cleared (verdict
  `SOL_BLOCKED_FINAL_M02_W07_SEVENTH_CORRECTION_VERIFICATION`), and the eighth
  correction was independently re-blocked after its direct local closure
  surface cleared (verdict
  `SOL_BLOCKED_FINAL_M02_W07_EIGHTH_CORRECTION_VERIFICATION`)
- Affects: M02-W07; initial blocked content
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` / tree
  `ddb6df168684ab5f534ac1125f14bb85067e613c`; insufficient first correction
  `f4ee49e6f056f2cc15257a6d8a0cbc43de7b1941` / tree
  `04721b7ea4fd0c2eec2506e507ea3e37c743e2ba`; insufficient second correction
  `2b85c9b1e1f80cd41334752e14b259dc61151058` / tree
  `7c97431ef520b3ebefe0c0a0a81c147c830d7351`; insufficient third correction
  `8c8ef32952516123343fdec3bc035ab569ab2d3d` / tree
  `adb3257b3990cc7ab5e2d47a861f038513055f22`; insufficient fourth correction
  `094d4ea5ff6adbfc829898e899e36d0a93401d5b` / tree
  `a650f4054aff5f47a9274dc588cfc13b8f75fe4e`; PORT-SRC-008 and the TypeScript
  surface of KI-0006
- Description: the initial checker missed TypeScript-family suffixes and used
  raw, line-local spellings. The first AST correction closed those syntax holes
  but still conflated constant evaluation with policy relevance and was blocked
  on unary/aliased truth, computed keys, composed operational values, and prose
  false positives. The second correction added a bounded evaluator and reviewed
  sink/provenance tables, but its semantic model stopped at object literals,
  inspected `node:path` arguments rather than composed results, implemented
  unary numeric operators without JavaScript primitive coercion, and retained a
  broad complete-value root that treated arbitrary runtime data as operational.
- Reproduction: on the exact first-correction content, `shell: !0`,
  `const shellKey = "shell"; { [shellKey]: true }`, and
  `const path = "/" + "tmp/reviewer-a"` survive PORT-SRC-008, while
  `export const portabilityHelp = "Documentation says to avoid /tmp and bash -c wrappers"`
  fails. Its focused portability suite still reports 105/105. The completely
  fresh verdict was `SOL_BLOCKED_FINAL_M02_W07_CORRECTED_VERIFICATION`.
  On the exact second-correction content, post-construction `options.shell =
  true`, a computed post-construction `options[key] = !0`, `join("/", "tmp",
  ...)` or `resolve("/", "tmp", ...)` flowing to `readFileSync`, and `shell:
  !+"0"` all pass, while exported descriptive values beginning `/tmp` or
  `bash -c` fail. Its focused suite still reports 145/145. The fresh verdict
  was `SOL_BLOCKED_FINAL_M02_W07_KI0058_VERIFICATION`.
  On the exact third-correction content, a reachable conditional option
  expression (`true ? options : { shell: false }`), loop-carried state that
  first proves `shell=true` on the second iteration, a known enabled string
  selector (`shell: "bash"`), a known Bash executable path plus `-c` argv,
  and `import { default as … }` provenance all survive PORT-SRC-008, while
  inert `execFileSync` argv text is falsely wrapper-classified, arbitrary
  augmented member chains retain trusted provenance, and the pinned fs
  inventory omits nested `.native` and disposable-temp surfaces. Its focused
  suite still reports 266/266. The fresh verdict was
  `SOL_BLOCKED_FINAL_M02_W07_THIRD_CORRECTION_VERIFICATION`.
  On the exact fourth-correction content (`094d4ea` / tree `a650f405…`), the
  completely fresh verifier independently cleared nearly the entire
  correction and reproduced exactly two substantive implementation blockers:
  (1) a `{ shell: false }` option object mutated to `shell = true` after a
  `spawnSync` sink inside a 4×4×4 nested exact loop returns zero findings
  (exit 0) while the 3×3×3 form and the 4×4×4 sink-after-loop form are both
  detected — the shared bounded object-analysis step budget is exhausted
  during supported nested exact-loop analysis and the post-exhaustion
  event/state handling invalidates the already-proved reachable violation;
  and (2) `new fs.Utf8Stream({ dest: "/tmp/parkf-utf8" })` passes because
  the catalog falsely classified the constructor non-operational
  ("factory path is reviewed") even though pinned @types/node 24.13.3
  declares the constructor with a filesystem-destination `dest` option, no
  `createUtf8*` factory exists, and pinned Node 24.18.0 actually creates the
  destination file. The verifier additionally identified eight
  correct-but-weakly-pinned surfaces (S1–S8: do/while exit edges,
  mayBeAbsent exec-default propagation, unknown-guarded logical RHS sinks,
  break-only exits, exec string selectors, uppercase/`.EXE` basename
  folding, `process.chdir` path behavior, and fail-closed constructible
  catalog classification) as regression-test hardening, not implementation
  defects. The verdict was
  `FABLE_BLOCKED_FINAL_M02_W07_FOURTH_CORRECTION_VERIFICATION`.
- Workaround: none accepted. Adding literal regex variants, scanning every
  runtime string, trusting arbitrary imports/requires, or treating every
  argument of every Node API as operational would preserve bypasses or false
  positives.
- Resolution + evidence link: FIXED after the ninth correction and fresh
  independent verification. The complete correction history is retained
  below; checkpoint statements are historical, not the current issue state.
  The fourth correction was begun by GPT-5.6 Sol Ultra, which
  produced substantial uncommitted implementation, catalog, and test work;
  after its usage limit the owner explicitly reassigned the same dirty writer
  worktree to Claude Fable 5 Ultracode, which recovered and verified the
  inherited bytes and completed the pass. That transition is implementation
  provenance only, not independent verification. The correction replaces
  scattered hand-maintained maps with one reviewed pinned Node operational
  catalog (`scripts/typescript-portability-node24-catalog.v1.json`, bound to
  Node 24.18.0 / TypeScript 6.0.3 / @types/node 24.13.3 with fail-closed pin
  and field validation) and closes the fourth-round semantic families:
  expression-resolved option state (conditional/logical/comma/alias forms
  with reachability-aware unions), real loop back-edge fixed points across
  `while`/`do`/`for`/`for-in`/`for-of`/`for await` (zero/one/second/later
  iterations, continue/break/incrementor semantics, body-mutation-guarded
  exact counts, a shared exact-replay budget, provably-empty iterables,
  modeled `delete`-to-absent), empirically verified pinned `shell` truth
  (`exec`-family default shell with the empty-selector exception;
  truthy-selector spawn/execFile family; forced-disabled fork), role-exact
  executable/argv/module-path/options dispatch mirroring Node's
  `Array.isArray` overload dispatch (inert argv stays inert; options bags in
  the argv slot, provably nullish options, `shell: undefined`, and typed
  callback parameters are handled; constant argv prefixes survive spread
  tails), executable-basename wrapper tuples with `sh -lc` parity and
  `process.execve` argv0-convention coverage, closed module/member provenance
  (default and `default as`, namespaces and their `default` member,
  renamed/type-only imports, `.cts` require forms, the ambient global
  `process`, direct `await import()` and `process.getBuiltinModule`
  re-entry, official `path/posix` and `path/win32` submodules,
  augmented-member termination), and a strengthened declaration oracle whose
  nested-surface rule makes pin drift on unreferenced callable members fail
  review.

  The fail-closed contract is preserved: unsupported program semantics stay
  UNKNOWN and never prove a violation, while analyzer infrastructure
  failures — malformed TypeScript, helper nonzero/invalid output, catalog
  pin, field, or completeness violations — refuse to pass. Reviewed
  suppressive-direction boundaries stay pinned by permanent controls
  (switch/try/labeled statement sinks, spread of tracked objects, win32 path
  flavor, closure-captured sinks, `bash -client`/`sh -client`, exact-token
  wrapper flags). Parked future-hardening families, all
  provenance-terminating or suppressive-direction only: shell short-option
  clusters (`-ec`, `-cl`, leading options) pending an owner-reviewed
  empirical truth matrix; `env(1)` trampolines (`env bash -c …` shapes);
  `createRequire` module re-entry; `globalThis.process` chains; compound
  logical-assignment enables (`options.shell ||= true`); and oracle scanning
  of constructible static surfaces and uncatalogued data members. Three
  writer-side reviewer lenses (control flow/loops, child-process semantics,
  provenance/catalog) were run against the candidate; every substantive
  finding was reproduced by the writer and either fixed with paired
  permanent violation/control regressions or parked above, and a 32-family
  mutation campaign in disposable no-hardlink clones killed every family
  through the permanent suite. Permanent and mutation evidence is recorded
  in docs/TEST_EVIDENCE.md § M02-W07.

  The fifth narrow correction (Claude Fable 5 Ultracode writer pass begun on
  the exact blocked fourth-correction content `094d4ea5…` / tree
  `a650f405…`) fixes only the two independently reproduced blockers and adds
  the S1–S8 permanent pins, without reopening independently cleared
  families. Blocker 1 is fixed as an invariant, not a budget raise:
  `MAX_OBJECT_ANALYSIS_STEPS` is unchanged and the analysis stays bounded.
  Intermediate statements that never reference the tracked symbol or its
  aliases are skipped (they cannot change tracked state, and an
  already-escaped state is already bottom), exhaustion of the shared step
  budget is recorded on the budget itself, the sink-argument refinement runs
  on clones, and an exhausted analysis returns the union of refined and
  pre-refinement at-sink states so a proved reachable violation is never
  erased. An exhausted sink analysis additionally emits an explicit
  `analysis-budget` finding (a documented bounded outcome that fails closed)
  instead of silently reporting a completed clean analysis; under-budget
  analyses are unaffected, and the clean 128⁴ unrelated-loop control remains
  green through the statement skip. Blocker 2 is fixed through the
  declarative catalog: a new operational-constructor classification
  (`constructible: "filesystem-path-options"` with reviewed `option_paths`
  and `roles.options`, validated fail-closed with unknown tokens rejected)
  reclassifies `fs.Utf8Stream` with `dest` as its reviewed path-bearing
  option; `new`-expression sinks resolve only through trusted catalog
  provenance, so local/shadowed or augmented `Utf8Stream` members stay
  clean, and a validation-only `--validate-catalog` mode exercises the exact
  loader against mutated catalogs. S1–S8 are recorded as permanent
  regression pins of verified-correct current behavior, not as
  implementation defects. Writer-side Reviewer B reproduced one real
  regression introduced by the first fifth-correction construct gate —
  `new` of a reviewed operational callable (for example
  `new spawnSync(..., { shell: true })`) stopped resolving as a sink even
  though the pinned runtime still executes the function body under `new` —
  and the gate was corrected to fall through to the callable classification
  with a permanent pin (`new-of-operational-callable-stays-a-sink`). Two
  reviewer observations are recorded as reviewed boundaries rather than
  blockers: the completeness oracle anchors callable/constructible
  membership but not per-member semantic fields (`option_paths`, `roles`,
  classification values), whose drift is caught by the permanent behavioral
  pins rather than the oracle; and spread forms of reviewed option objects
  (`{ ...base }` or spread arguments) remain the pre-existing
  suppressive-direction tracked-object boundary, which applies to the
  constructor sink exactly as it always has to child-process options.

  Writer-side Reviewer A confirmed the budget-monotonicity mechanism sound
  (no finding against the fifth-correction diff; every behavioral anchor
  reproduced, and the statement skip proved behavior-neutral against the
  pre-correction checker) and reproduced four pre-existing tracked-object
  defects that are byte-identical in behavior at blocked fourth-correction
  content `094d4ea` and are therefore outside this correction's two-blocker
  scope; they are recorded here honestly rather than fixed, because the
  independent verifier cleared these option-expression families apart from
  budget exhaustion and this pass must not broaden scope. (a) An alias
  minted through a runtime-no-op cast (`const alias = options as {…}`,
  `satisfies`, `options || {…}`, `cond ? options : options`, `options ??
  {…}`) is accepted by `isSupportedOptionAliasRead` without being registered
  by `collectTrackedAliases`, so mutations through the alias are invisible
  and the sink keeps a falsely proved clean state (`alias.shell = true`
  before `spawnSync(..., options)` reports nothing) — an unsound proof, not
  the documented conservative UNKNOWN. (b) A shorthand-property escape
  (`const box = { options }`) is invisible to the event scan because the
  shorthand name resolves to the property symbol, producing both a false
  negative (`box.options.shell = true` unseen) and a demonstrated false
  positive (`box.options.shell = ""` before `execSync` still reports the
  default-shell finding from the falsely-proved absent state); the longhand
  `{ opts: options }` escape behaves as designed. (c)/(d) Sinks inside
  `try`/`switch`/labeled statements observe an empty state set and labeled
  `break`/`continue` degrade to unknown state — these remain the reviewed
  suppressive-direction boundaries pinned since the fourth correction,
  now noting Reviewer A's demonstration that labeled variants of the S1/S4
  shapes are silently clean while the unlabeled shapes are flagged. Families
  (a) and (b) are fail-open in specific shapes and are the first
  reviewer-demonstrated exceptions to the earlier "suppressive-direction
  only" parked framing; they await the next fresh independent verifier and
  owner disposition. KI-0006 remains DEFERRED for its untouched
  Rust/native surface. At that historical fifth-correction checkpoint,
  KI-0058 remained HIGH / IN_PROGRESS pending fresh independent verification.

  Sixth narrow correction (Claude Fable 5 Ultracode writer pass,
  2026-08-18): begun on the exact hosted-green fifth-correction content
  `142f6fb5c759464dc8116d0b41a2ed13304543e2` / tree
  `75449acb80cc50ec5a4829660a182935f4903807` (hosted content run
  32154509246 SUCCESS on ubuntu-24.04, macos-15, and windows-2025) after
  writer terminal
  `FABLE_M02_W07_KI0058_FIFTH_CORRECTION_READY_FOR_INDEPENDENT_VERIFICATION`.
  Scope was exactly the two pre-existing fail-open tracked-object families
  (a) and (b) above — discovered and documented by the fifth writer's own
  bounded Reviewer A, byte-identical in behavior at the blocked
  fourth-correction base, and therefore not introduced by the fifth
  correction. Both were re-reproduced on the exact base before any edit.
  The fix is one shared alias abstraction in
  `scripts/check_typescript_portability.mjs`: a strict same-object proof
  (`provedSameTrackedObject`) registers a definite alias for every
  runtime-no-op alias form the event scan accepts (wrapper expressions,
  proved-taken `||`/`&&`/`??` operands, comma results, same-object and
  known-truth conditionals), with unresolvable branches failing the proof
  instead of being dropped, so mutations through registered aliases are
  exactly as visible as mutations through the tracked identifier;
  ambiguous initializers whose resolved option targets include the tracked
  object register as may-aliases whose writes, deletes, and escapes only
  degrade certainty to UNKNOWN; the event scan treats an alias-value read
  as harmless only when its declaration is registered (a
  transparent-position walk, `supportedAliasDeclarationFor`, that also
  accepts the mutation-free condition slot), and a supported-looking read
  whose binding is unregistered escapes conservatively — closing family
  (a) as an invariant rather than per-syntax patches. Shorthand-property
  stores escape by value symbol (`getShorthandAssignmentValueSymbol`)
  exactly like their longhand equivalent at the store's evaluation point,
  and the statement skip sees shorthand value symbols and may-alias
  references — closing family (b) including its demonstrated exec-default
  false positive. 25 permanent focused tests (10 violation, 14 control,
  1 pinned-tsc compile batch; suite 384 → 409) cover A1–A10, B1–B7, and
  the reviewer-confirmed boundaries below; the fifth correction's
  budget-monotonicity and Utf8Stream pins were not reopened and stay
  green. A targeted eight-family mutation campaign (cast, wrapper, and
  conditional registration removal; stale ambiguous-alias state;
  shorthand-escape removal; statement-skip shorthand blindness;
  effects-after-sink ordering; over-broad symbol-agnostic escape) ran
  twice in disposable `git clone --no-local --no-hardlinks` candidates
  provisioned with `pnpm install --frozen-lockfile --offline` — once at
  the pre-boundary-pin candidate and once at the exact final content
  bytes — with a full-suite clean control in every clone (406/406 then
  409/409) and every mutant killed by exactly its intended tests with
  zero unexpected partition drift. Writer-side bounded Reviewer A
  (restricted to alias registration/invalidation, shorthand escape, and
  their evaluation ordering) ran twice: the first pass (65 adversarial
  fixtures, pre/post-diff differentials) confirmed both invariants and
  reported two strictly conservative detection regressions introduced
  with the sound invariant, of which the condition-slot read inside an
  alias initializer was fixed in-pass (the truthiness slot cannot escape
  or mutate the object; the true exec-default finding is restored and
  pinned by `a7-condition-slot-read-keeps-exec-default-proof`) while
  destructuring reads and inert may-alias reads remain deliberately
  conservative (pinned by `a1-destructuring-read-conservative-unknown`
  and `a7-inert-may-alias-read-conservative-unknown`: they degrade to
  UNKNOWN although no mutation can occur through them, losing only
  exec-default absent proofs and never manufacturing certainty; the
  pre-correction behavior rested on the same unsound blanket
  supported-read this pass closes and was itself fail-open for
  nested-object destructures, so precise scalar-aware destructuring
  semantics are parked as future hardening, not silently restored); the
  second pass on the exact final bytes (73 adversarial fixtures) returned
  NO_DEFECT_FOUND on all three surfaces with all 37 fifth-correction pins
  and the full 409-test suite green, noting only the documented
  conservative boundaries (inert reads of a definite alias suppress by
  escape exactly as `void options` always has — the alias abstraction is
  symmetric with the tracked identifier — and a template-span read at the
  comma-left of an alias initializer now escapes where the old blanket
  harmlessness accidentally kept a true finding). One pre-existing
  out-of-scope blindspot is parked here for a future package: a hoisted
  function declared after the sink but called before it keeps stale
  option-state proofs (byte-identical before and after this correction
  and reproducible without any alias, so it belongs to the generic
  statement-range/hoisting model, not to the two corrected surfaces).
  The try/switch/labeled-statement and spread boundaries recorded above
  remain untouched. At that historical sixth-writer checkpoint, KI-0058
  remained HIGH / IN_PROGRESS pending fresh independent verification.

  Seventh narrow correction (GPT-5.6 Sol Ultra writer pass, 2026-08-21):
  begun on the exact independently blocked sixth-correction commit
  `05bbcb340bd98e856367b5349d51be028669d3f7` / tree
  `156417979f7e103ad7a7b5050dc7cd4eacd596d5` / parent
  `142f6fb5c759464dc8116d0b41a2ed13304543e2` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_SIXTH_CORRECTION_VERIFICATION`. That verifier
  cleared the sixth correction's alias registration/invalidation and
  shorthand-escape semantics and preserved the fifth-correction locks; its
  sole blocker was the parked pre-existing hoisted-function blindspot. On
  the exact base, H1 (`{ shell:false }`; call a hoisted function that writes
  `true`; spawn sink; declaration text after the sink) returned no finding,
  while H2 (absent shell; call a hoisted function that writes `""`; exec
  sink; declaration after the sink) returned a false default-shell finding.
  The direct-write equivalents were correct, and placing the H2 declaration
  before the call merely erased certainty at declaration time, proving the
  source-order artifact. The root cause was the tracked-state statement
  filter: it followed statements only from the object declaration to the
  sink and skipped a call identifier with no syntactic tracked-object
  reference, while a declaration encountered before the sink was treated as
  unsupported deferred capture rather than as a no-op.

  The seventh correction resolves only direct local function declarations
  through TypeScript symbol identity, keeps declaration statements inert,
  and applies a deliberately small exact summary at the call site:
  zero-parameter straight-line assignments of constant values to known
  tracked properties and known-key deletes, including `options.shell =
  true/false/""`, `delete options.shell`, and `options["shell"] = true`.
  Runtime parameter/default-initializer captures are included in relevance
  discovery but fall back to UNKNOWN; so do dynamic reassignment, direct or
  mutual recursion, unsupported control flow/calls, and separately declared
  captured arrow/function-expression calls. Symbol-active cycle detection
  and a depth-16 capture/summary limit bound both cyclic and deep acyclic
  chains before another callable is followed. Permanent H1–H18 tests plus
  three reviewer regressions cover declaration parity, never-called and
  post-sink timing, opposite declaration/call ordering, delete/computed
  writes, local and lexical shadowing, known/unknown branches, stale-state
  recursion and unsupported fallback, default parameters, captured-arrow
  calls, a 1,024-function chain, determinism, and pinned-tsc compilation
  (22 new nodes; focused suite 409 → 431). The fifth and sixth correction
  regression lock passes 84/84.

  Exactly six disposable `git clone --no-local --no-hardlinks` mutation
  families were run and stopped at M6: exclude later declarations (M1, two
  failures), no-op direct calls (M2, two), execute declarations as bodies
  (M3, two), replay effects in declaration rather than call order (M4, two),
  contaminate symbol identity with same-name matching (M5, one), and retain
  stale state for recursion/unsupported fallback (M6, three). One bounded
  reviewer, with no subdelegation, found three candidate blockers; the lead
  independently reproduced each on the live checker before acting: a
  default-parameter stale proof, an unsupported captured-arrow call falsely
  summarized as exact, and a 1,024-function acyclic capture-discovery stack
  overflow. All three are corrected and permanently pinned. The canonical
  inventory is now 1,325 common/Windows nodes at SHA-256
  `286a079115b8330e153d297e0afc295c80029f0d8b1f8d86d560235f9b4fc7d6`
  and 1,327 POSIX nodes at SHA-256
  `6d155b719af06d642549622489d5ac34f3893a2a9eb37c6d1818f6d61909c8c1`.
  No catalog, wrapper, extension, browser, W06, contract, generated, gate,
  dependency, lockfile, CI, model, prompt, or owner-evidence surface changed.
  At that historical seventh-writer checkpoint, KI-0058 remained HIGH /
  IN_PROGRESS pending fresh independent verification.

  Eighth narrow correction (GPT-5.6 Sol Ultra writer pass, 2026-08-21):
  begun on the exact independently blocked seventh-correction commit
  `3133a9348193a03759140dc2a32c35223be9717d` / tree
  `f4da4024b5b30c89bf06d1df66499f4d3082a660` / parent
  `05bbcb340bd98e856367b5349d51be028669d3f7` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_SEVENTH_CORRECTION_VERIFICATION`. That verifier
  cleared the seventh correction's hoisted `FunctionDeclaration` semantics
  and found one remaining pre-existing direct-call hole. On the exact base,
  H1 (arrow before tracked object; write `true`; spawn sink) returned `[]`,
  while H2 (arrow/function-expression equivalent; write `""`; exec sink)
  retained absent/default-shell state and returned a false violation. Moving
  the callable declaration across the tracked object changed analysis because
  its deferred body was visible at declaration time but its direct call was
  excluded from ordinary tracked relevance.

  The eighth correction replaces the split declaration/deferred target paths
  with one TypeScript-symbol-resolved direct local callable abstraction.
  Direct function declarations retain their existing semantics. A unique
  local `const` initialized directly to an arrow or function expression,
  initialized before the call and having zero parameters, no async/generator
  marker, and a body in the existing straight-line tracked-write/delete
  subset receives the same exact call-time summary. Block and concise
  assignment bodies reuse the existing property evaluator; no second shell
  model exists. Closure creation is inert, so never-called and post-sink calls
  cannot act retroactively. Calls are relevant through their resolved target
  even when callable text precedes the tracked object. Parameters/defaults,
  async/generator forms, mutable or later-assigned bindings, callable aliases,
  recursion/cycles, over-depth chains, unsupported calls/control flow,
  captured nested closures, and directly invoked nested closures fall back to
  UNKNOWN at the call site when they may touch tracked state. The existing
  active-symbol cycle set and `MAX_LOCAL_FUNCTION_SUMMARY_DEPTH = 16` remain.

  The permanent eighth slice has 46 nodes covering H1–H26, exact
  true/false/empty/delete/computed writes, multiple ordered writes, anonymous
  and named function expressions, concise arrows, declaration parity,
  never-called/post-sink timing, opposite call order, per-sink timing,
  symbol shadowing, unsupported parameters/defaults/async/generators/control
  flow/nested calls, mutable and aliased callables, direct/named recursion,
  short/near/over-depth and mixed chains, an unrelated-call non-invalidation
  control, pinned-tsc compilation, and four reviewer IIFE regressions. The
  fifth-through-eighth lock passes 130/130 and the complete portability module
  passes 477/477.

  Two bounded no-delegation reviewers used separate disposable
  `git clone --no-local --no-hardlinks` candidates. Reviewer A returned CLEAR
  after the 46-node slice and an independent 11-case target/order/timing/
  identity/form matrix. Reviewer B found that the first deferred-node prune
  also hid executed nested IIFEs in runtime defaults/bodies; the lead
  reproduced all four failing forms under pinned Node 24 before changing code.
  IIFEs now enter the same call-target relevance path as conservative local
  callables, and the reviewer's original five-case file passes 5/5.

  Exactly six disposable mutation families were run and stopped at M6: reject
  pre-object closure declarations (M1, 2 failures / 2 controls), make direct
  closures no-op (M2, 4 / 1), execute closure bodies at declaration time (M3,
  2 / 1), contaminate symbol identity by textual-name collisions (M4, 2 / 1),
  preserve stale state for parameterized/default closures (M5, 2 / 1), and
  drop function-expression targets (M6, 2 / 2). The canonical inventory is
  1,371 common/Windows nodes at SHA-256
  `54c2af8705db487eb4d77622e4ae30e632aac9074233d58f9bb032240648e875`
  and 1,373 POSIX nodes at SHA-256
  `e87520b6f1fa8ce777a09999fa326ba41c5690d5258fd40a5dff6e31e894e099`.
  No catalog, wrapper, extension, browser, W06, contract, generated, gate,
  dependency, lockfile, CI, model, prompt, W08, or owner-evidence surface
  changed. At that historical eighth-writer checkpoint, KI-0058 remained
  HIGH / IN_PROGRESS pending fresh independent verification.

  Ninth narrow correction (GPT-5.6 Sol Ultra writer pass, 2026-08-21): begun
  on the exact independently blocked eighth-correction commit
  `1a63145846e44f60903e48402c0c812d02581dd5` / tree
  `ce945ff89af363e8da2bd28ba60113b5e6d2a75d` / parent
  `3133a9348193a03759140dc2a32c35223be9717d` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_EIGHTH_CORRECTION_VERIFICATION`. That verifier
  cleared the eighth correction's direct arrow/function-expression call
  support and reproduced one remaining stale-certainty hole: with
  `shell=true`, both branches of an immediately called conditional arrow
  expression writing `shell=false`, the checker still emitted the original
  `shell=true` finding. The exact starting analyzer walked the conditional
  callee, correctly treated each merely created closure body as inert, then
  found no direct identifier target; `applyDirectLocalCallableCall` returned
  the incoming state. `referencesTrackedSymbol` had the matching hole, so the
  entire pre-sink IIFE statement could also be skipped.

  The correction adds one result-only, structurally bounded
  `immediateCalleeResultReferencesTrackedState` helper used only when the
  existing exact direct-local target resolver returns null. It recognizes
  immediate arrow/function leaves and existing local callable leaves, unwraps
  parentheses/`as`/`satisfies`/type assertions/non-null, honors a statically
  known conditional branch and conservatively checks either branch when
  unknown, takes only the result side of binary/CommaList comma expressions,
  and applies the same bounded result rule to `&&`, `||`, and `??`. Normal
  callee-prefix and argument effects remain ordered in
  `processTrackedExpression`; a possible selected tracked capture invalidates
  to UNKNOWN only at the reached call site. The same predicate makes the
  statement relevance filter retain that call. Merely assigning a conditional
  closure value remains inert, unrelated immediate callables preserve tracked
  certainty, and the exact direct identifier summary path is unchanged.

  Sixteen permanent ninth-correction nodes cover the exact conditional-IIFE
  reproducer, inverse stale-clean and absent/default-shell guards, one-sided
  capture, known-true/known-false selection, unrelated branches, uncalled and
  post-sink timing, direct arrow/function IIFEs, comma-prefix ordering, every
  ordinary wrapper kind in one nested fixture, bounded logical-result forms,
  unrelated non-direct calls, and pinned TypeScript compilation. The ninth
  slice passes 16/16; the eighth slice remains 46/46; the fifth-through-ninth
  lock passes 146/146; and the complete portability module passes 493/493.
  Canonical inventory regeneration added exactly those 16 IDs and removed
  none: 1,387 common/Windows nodes at SHA-256
  `72f8d4f65f625e569d7959c026c2280ea2ee275ed5e873304f9d8e6591d4cc8c`
  and 1,389 POSIX nodes at SHA-256
  `1b3cfe8786cc8f5dc3e255d2ac7999ea1fac9fea5a819281dc2f6d7e66552908`.

  The single bounded no-delegation reviewer confirmed the starting root cause
  and returned CLEAR twice on the final design/compaction, including a 62-node
  eighth+ninth lock. Exactly five mutation families were run in disposable
  `git clone --no-local --no-hardlinks` candidates against the final analyzer
  and test bytes, then stopped at M5: restore conditional-IIFE blindness (M1,
  7 failures / 9 controls), execute uncalled conditional closure values (M2,
  1 / 15), drop direct arrow/function IIFEs (M3, 2 / 14), drop typed-wrapper
  and comma-result relevance (M4, 2 / 14), and return incoming stale state
  instead of UNKNOWN for unsupported immediate callees (M5, 9 / 7). All
  clones were removed after inspection. No catalog, wrapper, extension,
  browser, W06, contract, generated, gate, dependency, lockfile, CI, model,
  prompt, W08, or owner-evidence surface changed, and no excluded private
  owner-evidence path was accessed. Fresh independent verification then
  cleared exact ninth-correction content commit
  `ce74ef49e142bb7c2cab608cd0c800d312bd2217` / tree
  `9412c5b71437ee562534a1fb92e80ab50ffc333d` with verdict
  `SOL_CLEAR_FINAL_M02_W07_NINTH_CORRECTION_CONTENT`; hosted content run
  `32522233170` succeeded. KI-0058 is FIXED. The later correction at
  `5d2cc2322e215b2de9e363da996cf625afdb7424` is governance-fixture isolation
  only and does not alter the analyzer semantics that received the clear
  verdict. Final closeout evidence: docs/TEST_EVIDENCE.md § M02-W07.

## M02-W06 owner-holdout corrective review

### KI-0057 — M02-W06 reviewed-manifest integration hard-coded pending verification state

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-08-12 during fresh final M02-W06 independent verification
- Affects: M02-W06; exact integration content
  `b4d8137b51df15bb1492b998d01aa031ade933ca` / tree
  `76d98c7e1f3459ae0739419cef6f7908026eab96`;
  `packages/evaluation-corpus/test/m02-w06/artifact-preimage-correction.test.ts`
  test 30k; `benchmarks/holdout-manifests/status.v1.json`;
  `scripts/validate_status.py`
- Description: test 30k unconditionally required
  `PENDING_FINAL_INDEPENDENT_VERIFICATION`. Final W06 governance necessarily
  needs a distinct final-clear package-verification state, but no canonical
  final token or alternate lifecycle branch existed, and governance was
  correctly forbidden from altering implementation or test bytes. The fresh
  final verifier therefore returned `SOL_BLOCKED_FINAL_M02_W06_VERIFICATION`
  before governance. No hidden owner case, expected truth, mapping, artifact
  preimage, or reviewed-manifest defect was implicated.
- Reproduction: at the affected exact content, the checked-in pending state
  passes test 30k. In a disposable exact-content clone, changing only
  `m02_w06_package_verification_state` to
  `FINAL_INDEPENDENT_VERIFICATION_CLEAR` makes test 30k fail because lines
  774–776 still expect the pending token. A full-history search finds neither
  that final token nor another lifecycle branch, so the integration cannot
  transition from W06 `IN_PROGRESS` / W07 `NOT_STARTED` to W06 `VERIFIED` /
  W07 `READY` while preserving the active test suite.
- Workaround: none accepted. Do not perform final governance by weakening or
  changing tests in the governance session, and do not conflate package
  verification with Gate A or M02 acceptance.
- Resolution + evidence link: FIXED. This correction introduces one
  explicit final token, `FINAL_INDEPENDENT_VERIFICATION_CLEAR`, and binds the
  two-state package-verification lifecycle to the canonical W06/W07 rows in
  `docs/PROJECT_STATUS.md` in both test 30k and the central status validator.
  The token means: "The exact integrated M02-W06 content and preserved
  owner-controlled source bundle have received the required fresh independent
  final package verification." It does not mean M02 accepted, Gate A
  evaluated or passed, the holdout benchmark executed, product Autofill
  Feasibility passed, or M02-W14/M02-W15 completed. Final-clear additionally
  requires the owner manifest to remain available, owner review to remain
  clear, and the tooling correction to remain clear. Cross-wired, unknown,
  and missing states fail closed. Exact corrected content commit
  `f4ffcf7064fe0f077b948690cebbee385fe190fb` / tree
  `6fd4219460a7659b21576f2ca20b19b744f3bbf9` received
  `SOL_CLEAR_FINAL_M02_W06_CONTENT` from a completely fresh final verifier;
  the current VERIFIED/READY/final-clear governance state passed the complete
  W06 suite and central validators without implementation or test edits. See
  docs/TEST_EVIDENCE.md § M02-W06.

### KI-0056 — M02-W06 mapping-v2 correction tightened historical v1 runtime IDs

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-08-11 during fresh independent Sol verification of the
  KI-0055 correction
- Affects: M02-W06; exact content
  `4bf08f8ddf8bd4452d6a7575fc3fd04f22540084` / tree
  `ff63971ac29e0b187c582d1d4df822a70aa4f7e7`;
  `packages/evaluation-corpus/src/owner-holdout.ts`
- Description: the mapping-v2 correction reused its strict exact-prefix ID
  predicate in `validateOwnerMappingV1`. That accidentally narrowed the
  historical v1 runtime accepted language. For example, historical content
  `3d8b18ccc86109a2b6a3bb3cc3ae6d16f5ced9f9` accepted
  `manifest_acme_00000000000000000000000001`, while the v1 runtime at the
  affected content rejected it. The historical runtime required the whole-ID
  grammar `^[a-z][a-z0-9_]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$` plus a separate
  `value.startsWith(prefix + "_")` check; the shared mapping-v2 predicate
  instead required the text after the exact prefix separator to be precisely
  one 26-character body. Manifest, case, file, creation-source, and
  review-source IDs were all affected.
- Reproduction: two fresh no-hardlink disposable clones at `3d8b18c` and
  `4bf08f8` executed complete synthetic v1 mappings directly through the
  historical `validateOwnerMapping` and affected `validateOwnerMappingV1`.
  Canonical IDs passed both. Bounded extended lowercase/digit/underscore
  stems (including empty and repeated-underscore extensions and the 24-byte
  maximum stem) passed the historical runtime across all five roles but
  failed at `4bf08f8`; overlong stems, wrong prefixes, and invalid or
  non-26-character Crockford bodies failed both.
- Workaround: none accepted. Do not broaden mapping v2 or treat a v1-only
  owner root as executable final evidence.
- Resolution + evidence link: FIXED. The writer correction restores a
  literal historical v1 whole-ID predicate and keeps an intentionally
  separate strict mapping-v2 predicate, including strict artifact IDs and
  strict sanitized-manifest validation. The pre-existing v1 schema/runtime
  distinction is explicit: `owner-mapping.v1.schema.json` was already
  stricter, rejects the runtime-only example, and remains byte-identical
  (SHA-256
  `04361a9abecded3b6a1545df144149f796ea52790b3f65fb872ad09a3b5b8d4b`).
  Permanent differential controls cover each v1 role, whole mappings,
  accepted and rejected boundaries, v1 schema distinction, v1-only execution
  refusal, and v2 runtime/schema agreement. This is historical-runtime
  preservation, not a live mapping-v2 security relaxation. Exact corrected
  tooling content `b317705f1ca9f0db699162e97b37c5ca55527e62` / tree
  `8da3a523b0876d55370e3450f874a7b840e23aff` subsequently received
  `SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS`; fresh external v2 authoring and
  independent owner review then completed with
  `OWNER_HOLDOUT_V2_REVIEW_CLEAR`. The reviewed sanitized manifest is now in
  the integration working tree. A completely fresh final verifier reproduced
  the historical v1 differential, mapping-v2 schema/runtime agreement, full
  207-test W06 suite, and preserved owner-source binding at exact corrected
  content commit `f4ffcf7064fe0f077b948690cebbee385fe190fb` / tree
  `6fd4219460a7659b21576f2ca20b19b744f3bbf9`, then returned
  `SOL_CLEAR_FINAL_M02_W06_CONTENT`. See docs/TEST_EVIDENCE.md § M02-W06.

### KI-0055 — M02-W06 owner holdout verification lacked input-artifact preimage binding

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-10 during fresh independent owner-controlled M02-W06
  holdout review
- Affects: M02-W06; REQ-GATE-002; REQ-GATE-010; REQ-GATE-011;
  `packages/evaluation-corpus` owner-external mapping, verification, receipt,
  and sanitized-manifest export
- Description: exact reviewed content
  `3d8b18ccc86109a2b6a3bb3cc3ae6d16f5ced9f9` / tree
  `383fdd61fbebc61ec346734b02a7dba62af1e8b2` used owner mapping v1, whose
  closed inventory represented only hidden case-container files. It did not
  represent the preimage bytes committed by
  `BenchmarkCaseV1.input_artifacts[].artifact_digest`. The fresh independent
  review therefore returned `OWNER_HOLDOUT_REVIEW_BLOCKED` with exact reason
  `INPUT_ARTIFACT_PREIMAGE_UNAVAILABLE`; all 11/11 cases in the rejected
  owner draft were affected. The reviewer did not disclose hidden values,
  mutate the repository, or modify the external draft.
- Reproduction: a disposable synthetic owner root containing
  `mapping.v1.json` and one valid hidden `BenchmarkCaseV1` container, but no
  artifact preimage anywhere in its closed inventory, was accepted by the
  prior `verifyOwnerHoldout`. The case declared a valid generic artifact ref
  and SHA-256 digest that did not resolve to any inventoried bytes; acceptance
  still produced a sanitized manifest and receipt. This exact synthetic
  reproducer uses no genuine owner data.
- Consequences: the source input could not be independently inspected; digest
  authenticity could not be established from bytes; expected-truth
  independence could not be completed; category review could not be
  completed; and meaningful duplication review could not be completed.
- Workaround: none accepted. The failed owner draft remains preserved
  externally and must not be treated as evidence or retrofitted in place.
  No owner manifest may be exported until corrected tooling is independently
  accepted and a fresh author builds a complete v2 executable root.
- Resolution + evidence link: FIXED. The writer correction preserves
  owner-mapping v1 byte-for-byte and introduces private `owner-mapping:v2`
  with a closed `artifacts` inventory, exact ref-set equality, opaque-byte
  SHA-256 recomputation, digest/schema-consistent reuse, finite safe error
  codes, v2 case-file/artifact receipt accounting, v1-only execution refusal,
  and unchanged public `benchmark/holdout-manifest:v1` output. Permanent
  synthetic regression coverage is separate from the historical 15-class
  campaign in
  `packages/evaluation-corpus/test/m02-w06/artifact-preimage-correction.test.ts`.
  Exact corrected tooling content subsequently received
  `SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS`. A fresh author created a new v2
  executable bundle with all declared artifact preimages, and a separate
  independent owner reviewer returned `OWNER_HOLDOUT_V2_REVIEW_CLEAR`. The
  integration writer independently reproduced the reviewed 14-case / 4-case-
  container / 14-artifact closed inventory and exact byte/digest bindings,
  then exported only the schema-valid sanitized repository manifest. See
  docs/TEST_EVIDENCE.md § M02-W06. A completely fresh final verifier and a
  separate independent owner-source reviewer then recomputed the complete
  14-case / four-container / 14-artifact trust chain, reproduced manifest
  digest `sha256:a10ecd8f5eb4f930b056e6ed375627ef42055fece1c5ffb86ef198b1cebe5a79`
  and receipt digest
  `sha256:ae7aea1d4f8c7da588f6ca648de02680af507eba42858b75b3c71f4020192948`,
  and found the genuine owner roots byte- and metadata-unchanged. Exact
  corrected content commit `f4ffcf7064fe0f077b948690cebbee385fe190fb` /
  tree `6fd4219460a7659b21576f2ca20b19b744f3bbf9` received
  `SOL_CLEAR_FINAL_M02_W06_CONTENT`; no hidden body entered Git. See
  docs/TEST_EVIDENCE.md § M02-W06.

## M02-W05 fresh acceptance defect history (second verification)

KI-0053 and KI-0054 were reported by the fresh independent Fable 5 acceptance
verifier on 2026-08-09 against exact corrected M02-W05 content commit
`fdf7bdaa0488179bff1d0aa9d78e7c1787d25090` / tree
`554bdc075967a2667cc37379465f06e931af1b21`; the verifier returned
`FABLE_BLOCKED_M02_W05_GOVERNANCE`. The same verification independently
closed the five KI-0048 through KI-0052 defect classes and explicitly
accepted the documented leap-table-free leap-second projection, but found the
low-year UTC projection acceptance-blocking and a separate W05-caused
test-governance dilution. A second corrective Fable 5 writer pass reproduced
both findings on the exact corrected content, corrected them, and recorded
permanent regression coverage in final correction commit
`b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
`40bbe111a4f80702c1fdd98b576534f1284873fc`. A separate genuinely fresh
independent Fable 5 Ultra Code acceptance session then independently closed
both defect classes on the exact final content and returned
`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE` (2026-08-10, hosted content run
`31355141330`); both issues are FIXED, and all three W05 content generations
remain below as immutable defect/reproduction history.

### KI-0053 — Low-year UTC projection violated canonical proleptic-Gregorian time

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-09 during fresh independent Fable 5 M02-W05 acceptance
  verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` timestamp
  projection (`src/time.ts`), duration derivation, execution records,
  canonical result issuance, and report replay
- Description: at corrected content `fdf7bda` / tree `554bdc0`, the canonical
  timestamp contract correctly accepts proleptic-Gregorian years 0000–0099
  (year 0000 is leap; ajv-formats full-mode calendar validation), but
  `utcInstantEpochMilliseconds` projected numeric fields through JavaScript
  `Date.UTC`, which remaps numeric years 0–99 onto 1900–1999. Contract-valid
  low-year instants therefore projected into the wrong century: the
  nonexistent 1900-02-29 rolled forward, so the contract-valid 36-hour window
  `0000-02-29T00:00:00Z -> 0000-03-01T12:00:00Z` (truly 129600000 ms)
  derived `duration_ms` 43200000 and bypassed the W05
  `duration <= 86400000` boundary end to end (accepted by `runEvaluation`,
  issued as a canonical `BenchmarkResultV1`, built, replayed, and rendered),
  while the contract-valid 1000 ms window
  `0099-12-31T23:59:59Z -> 0100-01-01T00:00:00Z` was spuriously rejected
  (`RUNNER_CLOCK_DURATION`) because 0099 projected into 1999 against a
  correctly projected 0100.
- Reproduction: at exact corrected commit
  `fdf7bdaa0488179bff1d0aa9d78e7c1787d25090`, (1) run any case with a clock
  returning `0000-02-29T00:00:00Z` then `0000-03-01T12:00:00Z`: the runner
  accepted `duration_ms` 43200000 (canonical result included) and the report
  validated and rendered; (2) run `0099-12-31T23:59:59Z` then
  `0100-01-01T00:00:00Z`: rejected `RUNNER_CLOCK_DURATION` although the true
  duration is exactly 1000 ms; (3) projection evidence: `0000-01-01T00:00:00Z`
  projected to -2208988800000 (1900-01-01) instead of -62167219200000.
  An independent no-Date-API integer reference confirmed the true values.
- Workaround: none accepted. The canonical timestamp contract owns validity;
  bounding accepted years or weakening the schema to fit JavaScript Date was
  rejected.
- Resolution + evidence link: FIXED. The correction replaces the
  Date-based numeric projection in `src/time.ts` with deterministic
  proleptic-Gregorian integer arithmetic over the whole 0000–9999 contract
  domain: canonical contract validation first, positive day-ordinal counting
  from year zero (no negative integer division), subtraction of the fixed
  1970 ordinal, BigInt combination of day/hour/minute/second/fraction, and
  conversion to Number only after a proven safe-integer bound. Year 0000 and
  0400 are leap; 0100 and 1900 are common; the accepted leap-table-free
  Unix-style leap-second projection (`23:59:60Z` to the next minute
  boundary) and deterministic fractional truncation are preserved
  byte-identically; execution and replay continue to share the single
  `time.ts`/`derive.ts` authority. The 36-hour year-zero window now rejects
  from its true 129600000 ms duration, and the 0099->0100 window derives
  exactly 1000 ms. A static governance rule now forbids `Date.UTC` and
  `Date.parse` in runner source, and permanent regression coverage (literal
  reviewed anchors, an independent iterative reference over the complete
  0000–9999 domain, calendar-boundary durations, end-to-end rejection,
  replay equality, fraction truncation, and leap-second preservation) lives
  in `packages/evaluation-runner/test/m02-w05/measurement-boundaries.test.ts`
  and `packages/evaluation-runner/test/m02-w05/governance-layering.test.ts`.
  See docs/TEST_EVIDENCE.md § M02-W05 (proleptic-UTC corrective writer pass,
  2026-08-09). Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

### KI-0054 — W05 weakened the M02-W01 NON_PRODUCTION fixture-consumer assertion

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-08-09 during fresh independent Fable 5 M02-W05 acceptance
  verification
- Affects: M02-W05; M02-W01 test governance
  (`packages/test-fixtures/test/m02-w01/governance-discovery.test.ts`);
  `packages/evaluation-runner/package.json` classification
- Description: at governance parent `5f8af91`, the M02-W01 fixture-consumer
  invariant required the single reviewed consumer
  (`@japp/evaluation-baselines`) to be `private: true` with a description
  containing the exact token `NON_PRODUCTION`. When W05 legitimately added
  `@japp/evaluation-runner` as a second reviewed consumer, the original W05
  content weakened the shared assertion to
  `description.toLowerCase()` containing the generic word `"evaluation"` for
  both consumers. That is weaker than the pre-existing explicit
  NON_PRODUCTION invariant and violated the spec §1.5 no-test-weakening
  rule, even though the actual package layering remained
  evaluation-only/private throughout.
- Reproduction: compare
  `packages/test-fixtures/test/m02-w01/governance-discovery.test.ts` at
  `5f8af91` (`expect(consumerManifest.description).toContain("NON_PRODUCTION")`)
  with `383ae57`/`fdf7bda`
  (`expect(consumerManifest.description?.toLowerCase()).toContain("evaluation")`);
  at `fdf7bda` the runner manifest description contained no `NON_PRODUCTION`
  token, so restoring the parent assertion verbatim fails against the runner
  consumer.
- Workaround: none accepted. A generic lowercase word is not a
  non-production classification proof.
- Resolution + evidence link: FIXED. The correction restores the exact
  `NON_PRODUCTION` token assertion for BOTH reviewed consumers (name,
  `private === true`, description containing exact `NON_PRODUCTION`, plus
  the retained evaluation wording check) without undoing W05's legitimate
  second consumer, and updates
  `packages/evaluation-runner/package.json` to truthfully declare
  `EVALUATION_ONLY`, `NON_PRODUCTION`, and no critical-gate authority (no
  version or dependency change; no lockfile change). W05's own
  `governance-layering.test.ts` now independently asserts the runner
  manifest's private/NON_PRODUCTION/EVALUATION_ONLY classification. M02-W01
  fixture bodies and fixture truth are untouched. See docs/TEST_EVIDENCE.md
  § M02-W05 (proleptic-UTC corrective writer pass, 2026-08-09). Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

## M02-W05 acceptance defect history

KI-0048 through KI-0052 were reported by the independent GPT-5.6 Sol Ultra
acceptance verifier on 2026-08-08 against exact blocked M02-W05 content
commit `383ae578512910b17d98aee30e1f24531fa746c8` / tree
`a5544b13da96d1d6bc9ce0db50ab5b2d23c454ce`; the verifier returned
`SOL_BLOCKED_M02_W05_GOVERNANCE`. A corrective Fable 5 writer pass reproduced
all five defects on the exact blocked content, corrected them, and recorded
permanent regression coverage; the fresh independent Fable 5 verification of
2026-08-09 (`FABLE_BLOCKED_M02_W05_GOVERNANCE` at `fdf7bda`) independently
closed all five defect classes. The final genuinely fresh independent
Fable 5 Ultra Code acceptance session re-reproduced all five defect-class
controls on the complete corrected revision
`b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
`40bbe111a4f80702c1fdd98b576534f1284873fc` and returned
`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE` (2026-08-10, hosted content run
`31355141330`); all five issues are FIXED, and the blocked revisions remain
immutable defect/reproduction history.

### KI-0048 — Report replay lacked authoritative source binding

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-08 during independent M02-W05 acceptance verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` report
  validation, execution identity derivation, and serialized report replay
- Description: at blocked content `383ae578` / tree `a5544b1`, a serialized
  `RunReportV1` could be made internally self-consistent after changing
  derived execution truth because report replay lacked the original
  canonical request and raw observation material needed to reconstruct the
  relevant commitments. `validateRunReport` recomputed aggregates and
  per-case consistency only from mutually confirming serialized
  projections, so coordinated edits that retained the old request digest,
  observation digest, record ID, result ID, and execution ID validated and
  rendered.
- Reproduction: at exact blocked commit
  `383ae578512910b17d98aee30e1f24531fa746c8`, (1) build a genuine complete
  comparable report whose threshold outcome is FAIL (measured 0.7 against
  AT_LEAST 0.8), then set measured/passed/outcome/aggregate to PASS while
  keeping every old identity — the coordinated mutant validates and
  renders; (2) relabel an `UNAVAILABLE` caller-supplied holdout report to
  `VALID`/comparable/PASS — accepted; (3) replace repository/runtime
  provenance coordinately (recomputing only `runtime_commitment_digest`)
  while keeping the old execution identity — accepted; (4) change raw
  paired-count observation truth (TP 2 to 200) under the old
  `observation_digest` — accepted with derived precision from the forged
  counts.
- Workaround: none accepted. Serialized-projection cross-checks cannot
  substitute for reconstructible source truth.
- Resolution + evidence link: FIXED. The correction introduces
  `ExecutionReplayWitnessV1` (canonical validated `ExecutionRequestV1` plus
  each case's actual start/end instants and canonical normalized
  `AdapterObservationV1`), embeds it in the execution and the report JSON,
  and refactors execution and replay onto one shared pure derivation
  (`src/derive.ts`) so request digest, observation digests, provenance,
  holdout, limitations, all identities, and the aggregate are independently
  recomputed from source during `validateRunReport`; all four
  reproductions now reject (`RUNNER_REPORT_REPLAY_MISMATCH` /
  `RUNNER_REPORT_SOURCE_BINDING` / `RUNNER_REPORT_IDENTITY`), a legitimate
  semantic source change yields new identities, and permanent regression
  coverage lives in
  `packages/evaluation-runner/test/m02-w05/replay-source.test.ts`. See
  docs/TEST_EVIDENCE.md § M02-W05 (corrective writer pass, 2026-08-09).
  Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

### KI-0049 — Serialized regression comparisons lacked authenticated candidate/reference compatibility

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-08 during independent M02-W05 acceptance verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` regression
  comparison model, comparison validation, and report embedding
- Description: at blocked content `383ae578`, a report-embedded
  `RegressionComparisonV1` carried only digests and projections, so a
  passing serialized comparison whose `candidate_run_digest` did not belong
  to the embedding execution was accepted, and a genuine `CORPUS_MISMATCH`
  comparison relabeled `comparable=true` / `incomparable_reasons=[]` /
  `passed=true` was accepted by both the standalone comparison validator
  and the report validator because the projection remained internally
  consistent.
- Reproduction: at exact blocked commit `383ae578`, (1) attach a passing
  comparison with foreign `candidate_run_digest`
  `sha256:ff…ff` to a fresh execution's report — accepted; (2) build a
  genuine CORPUS_MISMATCH comparison, then serialize it with
  `comparable=true`, `incomparable_reasons=[]`, `passed=true` — accepted
  standalone and inside a report.
- Workaround: none accepted. Two mutable projections agreeing with each
  other is not authentication.
- Resolution + evidence link: FIXED. The correction makes a
  report-embedded comparison carry its complete immutable source — the
  full reviewed reference (digest recomputed from the embedded payload)
  plus a versioned candidate selector (`CASE_THRESHOLD_METRIC`,
  `AGGREGATE_PASS_RATE`, `AGGREGATE_POOLED_PROPORTION`,
  `AGGREGATE_PRECISION`, `AGGREGATE_RECALL`) — and resolves the candidate
  side exclusively from the embedding execution's canonical truth,
  requiring `candidate_run_digest` to equal the current execution content
  digest and re-deriving compatibility, reasons, comparability, deltas,
  and pass/null during report replay. Foreign executions, forged values or
  raw counts, relabeled compatibility states, tampered references, and
  sourceless or unresolvable selectors now reject
  (`RUNNER_REGRESSION_SOURCE_REQUIRED` /
  `RUNNER_REGRESSION_SOURCE_MISMATCH` /
  `RUNNER_REGRESSION_REFERENCE_TAMPER` /
  `RUNNER_REGRESSION_CANDIDATE_SOURCE`); permanent coverage lives in
  `packages/evaluation-runner/test/m02-w05/regression-source.test.ts`. See
  docs/TEST_EVIDENCE.md § M02-W05 (corrective writer pass, 2026-08-09).
  Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

### KI-0050 — FAILED_SETUP admitted paired measurement statistics

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-08 during independent M02-W05 acceptance verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` adapter
  observation boundary, aggregation, and report replay
- Description: at blocked content `383ae578`, the raw observation boundary
  rejected metrics and artifact observations for `FAILED_SETUP` but not
  `paired_counts`, so a setup failure that occurred before measurement
  could still contribute TP/FP/FN statistics, and aggregation derived
  precision/recall from them.
- Reproduction: at exact blocked commit `383ae578`, return a
  `FAILED_SETUP` observation with paired counts TP=7, FP=1, FN=2: the
  runner accepted it and the report derived precision 7/8 (0.875) and
  recall 7/9 despite setup failure preceding measurement.
- Workaround: none accepted. Measurement-derived statistics cannot come
  from a run that never measured.
- Resolution + evidence link: FIXED. The correction rejects
  `FAILED_SETUP` observations carrying paired counts at the raw boundary
  with the stable diagnostic `RUNNER_SETUP_PAIRED_COUNT_PAYLOAD` (metrics
  and artifact observations were already rejected; the visible setup error
  code is retained), independently rejects failed-setup paired statistics
  during aggregation (`RUNNER_AGGREGATE_SETUP_PAIRED_COUNTS`) and during
  report replay, and still issues no canonical benchmark result for failed
  setup; permanent coverage lives in
  `packages/evaluation-runner/test/m02-w05/measurement-boundaries.test.ts`.
  See docs/TEST_EVIDENCE.md § M02-W05 (corrective writer pass, 2026-08-09).
  Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

### KI-0051 — Execution records admitted nonexistent UTC calendar dates

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-08 during independent M02-W05 acceptance verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` clock
  boundary, duration derivation, and report replay timestamp validation
- Description: at blocked content `383ae578`, execution and replay
  validated timestamps with a shape regex plus `Date.parse`, which rolls
  nonexistent calendar dates forward, so `2026-02-30T00:00:00Z` and
  `2026-02-30T00:00:01Z` were accepted as real instants and derived a
  1000 ms duration; the canonical common timestamp contract, which owns
  calendar validity, was never consulted.
- Reproduction: at exact blocked commit `383ae578`, run any case with a
  clock returning `2026-02-30T00:00:00Z` then `2026-02-30T00:00:01Z`
  (`Date.parse` maps both onto 2026-03-02): the failed-setup record was
  accepted with `duration_ms` 1000 and the report validated.
- Workaround: none accepted. A regex plus `Date.parse` is not calendar
  validation.
- Resolution + evidence link: FIXED. The correction adds one shared
  W05 timestamp authority (`src/time.ts`) built on the generated contract
  validator `validateCommonTimestampUtcV1UtcTimestamp`, used identically
  by execution and replay for COMPLETE, PARTIAL, and FAILED_SETUP;
  duration now derives deterministically from contract-valid instants
  (leap-second control `2026-06-30T23:59:60Z` and fractional forms
  accepted by the contract corpus remain accepted; February 30, invalid
  common-year leap days, invalid months/days/hours, lowercase `z`, and
  offsets reject with `RUNNER_CLOCK_TIMESTAMP`); permanent coverage lives
  in
  `packages/evaluation-runner/test/m02-w05/measurement-boundaries.test.ts`.
  See docs/TEST_EVIDENCE.md § M02-W05 (corrective writer pass, 2026-08-09).
  Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

### KI-0052 — Maximum valid limitation request could not build a report

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-08-08 during independent M02-W05 acceptance verification
- Affects: M02-W05; REQ-GATE-006; `packages/evaluation-runner` output
  policy validation and report limitation bounds
- Description: at blocked content `383ae578`, the request boundary
  accepted up to 32 user limitations while the report boundary rejected
  more than 34 limitation entries; because the runner prepends 3 fixed
  limitations (two always plus one pre-W06 development notice), a
  legitimate maximal 32-user-limitation request produced a 35-entry report
  that its own validator rejected (`RUNNER_REPORT_STRUCTURE`).
- Reproduction: at exact blocked commit `383ae578`, validate a request
  with exactly 32 user limitations (accepted), run it, and call
  `buildRunReport`: report validation rejected the 35-entry limitation
  array.
- Workaround: none accepted. Silently dropping or truncating limitations
  would hide honest scope statements.
- Resolution + evidence link: FIXED. The correction replaces the
  duplicated numeric limits with shared constants
  (`MAX_USER_LIMITATIONS = 32`, `MAX_FIXED_REPORT_LIMITATIONS = 3`,
  `MAX_REPORT_LIMITATIONS = 35`); a 32-user request now builds, renders,
  and replays a 35-entry report, a 33-user request rejects
  (`RUNNER_LIMITATION_COUNT`), and replay recomputes the exact limitation
  array from the canonical witnessed request so fixed limitations cannot
  be removed, replaced, reordered, or invented; permanent coverage lives
  in
  `packages/evaluation-runner/test/m02-w05/measurement-boundaries.test.ts`.
  See docs/TEST_EVIDENCE.md § M02-W05 (corrective writer pass, 2026-08-09).
  Closed by the final genuinely fresh independent Fable 5 Ultra Code
  acceptance verification of exact content
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`
  (`FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, 2026-08-10, hosted
  content run `31355141330`); see docs/TEST_EVIDENCE.md § M02-W05 —
  Governance closeout after final independent Fable verification
  (2026-08-10). M02-W05 is VERIFIED, not ACCEPTED.

## M02-W04 acceptance defect history

KI-0046 and KI-0047 are FIXED by independently accepted M02-W04 content commit
`5ed2768c895bc2ce3c236d089745556c7e563d5f` / tree
`656c61d87d0615b6a9b96319888856057686223b` and exact-SHA three-OS content run
`31225740045`. The independent GPT-5.6 Sol Ultra verifier first reported both
against original implementation `7fcdfa34797c29289737f558a7826cd12fb42fc0`
and returned `SOL_BLOCKED_M02_W04_GOVERNANCE`. First correction
`a5aa43602e67a66c5319fa7b24aa8b6b32bfd71f` closed those reproductions, but a
fresh independent verifier found the residual KI-0046 classifier mismatch and
returned `SOL_BLOCKED_CORRECTED_M02_W04_GOVERNANCE`. A final genuinely fresh
GPT-5.6 Sol Ultra session reproduced the full history, completed the finite
audit, and returned `SOL_CLEAR_FOR_FINAL_M02_W04_GOVERNANCE` for `5ed2768`.
All three generations remain below as immutable defect/reproduction history.

### KI-0046 — Legacy observation records did not fail closed

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-07 during independent M02-W04 acceptance verification
- Affects: M02-W04; REQ-GATE-007; REQ-GATE-008;
  `packages/evaluation-baselines` legacy-observation validation and clean-room
  provenance contract
- Description: at `7fcdfa3`, the validator parsed then discarded
  `safety_observations`, so non-CAPTURED records could carry fabricated
  safety-behavior claims. It also accepted mutable or short `source_revision`
  values for CAPTURED records and its bounded snippet rules admitted ordinary
  copied code such as `const copied = 1;`. First correction `a5aa436` closed
  those fail-open paths, but its new unanchored declaration-keyword heuristic
  incorrectly treated ordinary English such as `The interface displayed…`
  and `The type field…` as source while failing to reject a simple source-
  shaped arithmetic statement such as `value + 1;`. Both generations
  contradicted the advertised immutable-provenance, no-payload, clean-room
  observation contract.
- Reproduction: at exact blocked content commit
  `7fcdfa34797c29289737f558a7826cd12fb42fc0` / tree
  `616a1a8048f5d91ed67cae899b60ea0f3a882481`, call
  `validateLegacyObservationFile` on (1) an `UNAVAILABLE` record with
  `safety_observations: ["Fabricated safety behavior claim"]`, (2) a complete
  synthetic `CAPTURED` record with `source_revision: "main"`, and (3) the same
  CAPTURED record with `structured_observations: ["const copied = 1;"]`.
  All three returned successfully instead of failing closed. At exact first
  correction `a5aa43602e67a66c5319fa7b24aa8b6b32bfd71f` / tree
  `9f49c0c388f4905b8b9eb4e9d8e0e0cee4470c97`, reproduce the fresh residual:
  `"The interface displayed three ordinary fields."` and
  `"The type field remained empty."` both reject with
  `LEGACY_OBSERVATION_SOURCE_SNIPPET`; `"value + 1;"` incorrectly accepts;
  and `"Filled three ordinary fields..."` correctly accepts.
- Workaround: none accepted. Manual review cannot replace the executable
  record boundary, and no CAPTURED observation may be fabricated.
- Resolution + evidence link: FIXED. First correction `a5aa436` retains
  and checks safety observations, rejects all five payload fields for every
  non-CAPTURED status, requires a repository URL plus full lowercase 40-hex
  Git commit for CAPTURED source coordinates, and rejects bounded source
  shapes in both observation arrays. The narrow second correction replaces
  its keyword-substring declaration rule with anchored, line-oriented syntax-
  shaped predicates for declarations, imports/modules, assignments,
  arithmetic expressions, calls, controls, returns/throws, and unambiguous
  source delimiters. Twelve ordinary-prose positives, 36 source-shaped
  negatives, three multiline controls, and two finite mutation witnesses are
  direct executable truth; all pass locally. The original auditor examples
  still fail with
  `LEGACY_OBSERVATION_UNCAPTURED_SAFETY`,
  `LEGACY_OBSERVATION_SOURCE_REVISION`, and
  `LEGACY_OBSERVATION_SOURCE_SNIPPET`; the two residual prose examples now
  accept, `value + 1;` rejects, and the original prose positive still accepts.
  Final content `5ed2768c895bc2ce3c236d089745556c7e563d5f` passed the
  complete independent 12-prose/28-source/LF-and-CRLF matrix in both payload
  arrays, the standalone 29/29 reference program, all fifteen independent
  mutations, the complete local inventory, and exact-SHA three-OS run
  `31225740045`; the final verifier returned
  `SOL_CLEAR_FOR_FINAL_M02_W04_GOVERNANCE`. See docs/TEST_EVIDENCE.md §
  M02-W04 — Governance closeout after final independent Sol verification
  (2026-08-07). M02-W04 is VERIFIED, not ACCEPTED.

### KI-0047 — Keyword stuffing asserted an unsupported candidate skill

- Severity: HIGH
- State: FIXED
- Discovered: 2026-08-07 during independent M02-W04 acceptance verification
- Affects: M02-W04; `packages/evaluation-baselines` naive keyword-stuffing
  transformation, catalog, README, literal oracle, manifest, and truth tests
- Description: for original `Analyst with Excel experience.` and target
  `SQL`, the supposedly ungrounded baseline emitted a claim-bearing
  `Skills: sql` line while also reporting `grounded_in_evidence=false`. A
  reasonable reader could interpret the target-only token as a candidate
  skill, contradicting the W04 promise not to invent tool or experience
  claims.
- Reproduction: at exact blocked content commit
  `7fcdfa34797c29289737f558a7826cd12fb42fc0` / tree
  `616a1a8048f5d91ed67cae899b60ea0f3a882481`, run
  `naiveKeywordStuffing("Analyst with Excel experience.", "SQL")`; the exact
  transformed text is
  `Analyst with Excel experience.\n\nSkills: sql`, `inserted_terms` is
  `["sql"]`, and `grounded_in_evidence` is false.
- Workaround: none accepted. A label stored only in side metadata does not
  remove the claim-bearing heading from the transformed artifact.
- Resolution + evidence link: FIXED. The corrected transform preserves
  target-only terms in deterministic order only inside
  `[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: …]`,
  keeps original input separately, remains UNVERIFIED/EVALUATION_ONLY/
  NON_PRODUCTION and ungrounded, and retains byte-identical no-op and
  idempotence. Direct truth tests cover the exact audit example and a fixed
  mutation proves that restoring `Skills:` is rejected.
  Final content `5ed2768c895bc2ce3c236d089745556c7e563d5f` reproduced the
  exact required non-claiming output, passed the standalone reference and
  semantic probes, rejected the independent CLAIM_BEARING_STUFFING mutation,
  and completed exact-SHA three-OS run `31225740045`; the final verifier
  returned `SOL_CLEAR_FOR_FINAL_M02_W04_GOVERNANCE`. See
  docs/TEST_EVIDENCE.md § M02-W04 — Governance closeout after final
  independent Sol verification (2026-08-07). M02-W04 is VERIFIED, not
  ACCEPTED.

KI-0039 through KI-0045 are FIXED as of the 2026-08-03 governance closeout
that followed the independent Fable 5 Max acceptance verification
(FABLE_CLEAR_FOR_GOVERNANCE_CLOSEOUT) of exact content commit
`7523e096b51c1c3a0490924235879d4d6d386b81` / tree
`666987a702d274aabcee8bbfdfae5afd5d9c18e7` with final hosted three-OS run
`30741379567` green. Their entries below preserve the complete defect and
reproduction history, including every invalidated revision. KI-0033 through
KI-0038 remain historically FIXED; the closeout does not reopen their
preserved scope or any accepted M00/M01 milestone, does not evaluate any
critical gate, and does not accept M02.

### KI-0039 — Stale credential evidence was released as current truth

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 fixture truth, credential validity, schemas, model,
  generator, development data, consistency validation, and truth oracle
- Description: an expired 2020 healthcare license was described in the
  present tense and released as DIRECT evidence for a current-license
  requirement evaluated in 2026. Generic effective periods had no
  category-specific meaning, and policy freshness used review metadata
  instead of the scenario evaluation date.
- Reproduction: at invalidated content commit
  `a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`, load evidence 41, resume 07,
  requirement 41, claim 35, and scenario 20. The original loader and
  consistency validator accept DIRECT / USE_SUPPORTED_EVIDENCE /
  PROCEED_WITH_GAPS with zero issues. Moving a policy-linked scenario beyond
  its source expiry is also accepted because review metadata is used as the
  semantic clock.
- Workaround: none accepted. Extending the expired date would hide rather
  than repair the defect.
- Resolution + evidence link: FIXED. The correction preserved the expired
  adversarial record, migrated temporal semantics, and added
  current/non-expiring positives and an independent date oracle; the required
  corrected content, clean clones, fresh three-OS CI, and genuinely fresh
  read-only audit have all completed. Closed by the 2026-08-03 governance
  closeout: the independent Fable 5 Max acceptance verification of exact
  content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7` confirmed the temporal boundary
  and credential-validity tests green within the focused M02-W01 suite
  (108/108) and the complete fixture package (109/109), with final hosted
  three-OS run `30741379567` green; see docs/TEST_EVIDENCE.md § M02-W01 —
  Governance closeout after independent Fable acceptance verification
  (2026-08-03). Package verification does not evaluate a critical gate; the
  invalidated revisions above remain preserved historical evidence.

### KI-0040 — Fully re-signed semantic contradictions bypass consistency checks

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 semantic consistency, loader/validator matrices, and
  fully re-signed mutation tests
- Description: hashes prove byte identity but were effectively trusted across
  missing domain checks. Status/boolean, eligibility/source shape,
  sensitivity/consequence, nested-ID, and anchored-source meaning
  contradictions all survived valid re-signing.
- Reproduction: in isolated corpus copies, recompute every changed entity
  hash, collection byte hash/count, corpus digest, and manifest hash after
  each of five mutations: sponsorship status with a false boolean; work
  authorization eligibility with a relocation requirement; downgraded salary
  sensitivity/consequence; duplicate resume fact ID; and unrelated source
  prose with updated hashes. The invalidated loader and validator accept all
  five with zero issues.
- Workaround: none accepted; re-signing cannot authorize incoherent meaning.
- Resolution + evidence link: FIXED. The correction added exhaustive coupling
  and structured-source matrices, nested-ID uniqueness, and fully re-signed
  negatives; corrected content, clean clones, fresh three-OS CI, and the
  genuinely fresh audit have all completed. Closed by the 2026-08-03
  governance closeout: the independent Fable 5 Max acceptance verification of
  exact content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7` confirmed the fully re-signed
  contradiction suite green (resigned-contradictions.test.ts, 7/7, within the
  108/108 focused M02-W01 run), with final hosted three-OS run `30741379567`
  green; see docs/TEST_EVIDENCE.md § M02-W01 — Governance closeout after
  independent Fable acceptance verification (2026-08-03). Package
  verification does not evaluate a critical gate; the invalidated revisions
  above remain preserved historical evidence.

### KI-0041 — Privacy scanning misses dangerous inputs and leaks raw diagnostics

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 privacy scanning, strict JSON, loader/platform/consistency
  diagnostics, and adversarial tests
- Description: international/compact phones, common addresses, semantic
  credential fields, equivalent prompt injections, dangerous nested keys,
  traversal, percent encodings, and escaped tokens passed. Ordinary Basic
  prose and route paths falsely failed. Token-shaped filenames and duplicate
  JSON keys were echoed in reports/errors.
- Reproduction: the audit's independently authored positive/negative table
  reproduces every listed miss and false alarm. A token-shaped `.json`
  filename appears verbatim in `PrivacyIssue.file`; a duplicate token-shaped
  key appears in the strict-JSON pointer and loader exception.
- Workaround: none accepted. Manual inspection is not a deterministic privacy
  boundary.
- Resolution + evidence link: FIXED for the scoped M02-W01 defect. The
  correction added bounded normalization, semantic/context checks, traversal
  and dangerous-key detection, centrally redacted diagnostic locations, and
  exact non-disclosure tests; clean clones, fresh three-OS CI, and the
  genuinely fresh audit have all completed. Closed by the 2026-08-03
  governance closeout: the independent Fable 5 Max acceptance verification of
  exact content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7` confirmed the privacy and
  non-disclosure tests green (privacy-security.test.ts within the 108/108
  focused suite; committed-producer privacy scan of 25 files and 26,179
  scalar fields clean), with final hosted three-OS run `30741379567` green;
  see docs/TEST_EVIDENCE.md § M02-W01 — Governance closeout after independent
  Fable acceptance verification (2026-08-03). The generic Base64 hypothesis
  recorded below remains explicitly outside the accepted M02-W01 detector
  contract and nonblocking: generic Base64 scanning was not implemented, and
  the privacy/diagnostic boundary is not weakened by this closeout. Package
  verification does not evaluate a critical gate; the invalidated revisions
  above remain preserved historical evidence.
  Nonblocking follow-up hypothesis (2026-07-30): generic Base64 text encoding
  a synthetic email, SSN, phone, or address passes the current scan. The
  bounded normalization contract implemented to date covers escaped literals,
  percent encoding, concatenation, and explicitly prefixed Basic credentials,
  but does not define generic Base64 decoding or its false-positive boundary.
  That possible extension is INCONCLUSIVE for this correction and is
  deliberately excluded pending a separate bounded detector contract.

### KI-0042 — ADR-0004 new-producer guard accepts constructed v1 references

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 ADR-0004 new-producer platform-version guard and tests
- Description: the direct-URN regex misses deprecated schema filenames and
  paths, JSON alias/major objects, TypeScript concatenation, escaped literals,
  and malformed TypeScript. Filename diagnostics also expose raw input.
- Reproduction: each requested representation using the deprecated
  `evidence-record:v1` family passes the invalidated guard, while a direct URN
  fails and corrected v2 passes. The canonical inventory still contains the
  exact fifteen reviewed v1/v2 pairs. Revised-audit validation on 2026-07-30
  additionally reproduced JSON alias/major, encoded text, nested static
  TypeScript construction, per-expression unresolved-value suppression, and
  statically visible `Array.prototype.join` override bypasses. The direct and
  `Object.defineProperty` prototype-override regressions both remained valid
  at the exact starting tree. The final bounded matrix also covered canonical
  schema selectors, split JSON/text representations, current-value aliases,
  schema destinations/sinks, intrinsic shadowing and statement order, with
  separate historical-read and benign-v2 controls.
  The next independent audit of exact commit
  `83d83ff1b805b57ca7fecf2797cf35e2036e0740` / tree
  `f9fddf739fa21d06517574f839625bfb931521ee` found three further bounded
  failures: invoked join-mutator aliases, alias chains, `.call`, and `.apply`
  were not modeled (`AUD-PLAT-001`); platform v1 filenames, aliases, majors,
  and URNs were matched inconsistently by case (`AUD-PLAT-002`); and
  unresolved object spreads or computed selector keys could enter schema
  destinations without a fail-closed verdict (`AUD-PLAT-003`). Disposable
  exact-start probes reproduced all three while canonical controls retained
  their prior behavior.
- Workaround: none accepted; new producers must select corrected v2
  semantics.
- Resolution + evidence link: FIXED. Preserved exact pair discovery, parsed
  JSON aliases and pinned-TypeScript AST constants, failed closed on producer
  parse/type errors and statically visible intrinsic overrides, evaluated
  unresolved schema-like expressions independently, and redacted diagnostics.
  Bounded corrective execution is recorded in `docs/TEST_EVIDENCE.md`. The
  final candidate added bounded point-in-time callable execution, explicit
  ASCII folding, ordered selector/spread resolution, mutation/escape checks,
  and schema-sink coverage. The exact hosted three-OS proof (run
  `30741379567` at commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7`) and the genuinely fresh
  independent audit (Fable 5 Max, FABLE_CLEAR_FOR_GOVERNANCE_CLOSEOUT,
  confirming AUD-PLAT-001 through AUD-PLAT-003 CLEAR with the guard deriving
  15 deprecated v1/v2 sibling pairs over 25 producer files, never executing
  producer source) have now completed, closing the issue on 2026-08-03; see
  docs/TEST_EVIDENCE.md § M02-W01 — Governance closeout after independent
  Fable acceptance verification (2026-08-03). Package verification does not
  evaluate a critical gate; the invalidated revisions above remain preserved
  historical evidence.

### KI-0043 — Fixture seed check mode mutates missing roots

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 deterministic seed check behavior and filesystem tests
- Description: `fixtures:seed:check` creates `data/development` before
  comparing output, so a read-only verification command changes the
  filesystem on failure.
- Reproduction: run check mode in an isolated package copy with no data
  directory. It exits nonzero for missing fixtures but creates both missing
  directories and changes the parent metadata.
- Workaround: none accepted; verification must be status-neutral.
- Resolution + evidence link: FIXED. All mutators are isolated in explicit
  write mode and byte/mode/time-neutral check behavior is proven across every
  reviewed starting state (generator-check-mode.test.ts zero-mutation suite,
  6/6, within the 108/108 focused M02-W01 run). Closed by the 2026-08-03
  governance closeout: the independent Fable 5 Max acceptance verification of
  exact content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7` ran `fixtures:seed:check` with
  exit 0 and zero tracked-byte drift locally and on all three hosted jobs of
  run `30741379567`; see docs/TEST_EVIDENCE.md § M02-W01 — Governance
  closeout after independent Fable acceptance verification (2026-08-03).
  Package verification does not evaluate a critical gate.

### KI-0044 — Shared expected truth and conditional skips invalidate closeout proof

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 truth oracle and closeout verification;
  `scripts/verify.py` and its focused tests
- Description: generator, loader, validator, and positive tests share count
  and decision premises. No test independently enumerates all scenario
  outcomes. The verifier detects direct skip/focus markers but accepts
  `skipIf/runIf` and treats 50 passed plus one skipped as exact 50 proof.
- Reproduction: replace one substantive fixture test with
  `test.skipIf(true)` and add a trivial pass. Pinned Vitest reports 50 passed
  and one skipped with exit zero; the original static and exact-count proofs
  also accept. Shared count imports and non-enumerating positive tests are
  visible in the invalidated tree. Revised-audit validation on 2026-07-30
  separately reproduced three count-preserving green bypasses: a definitely
  invoked IIFE emptied a parameter table, concat modeled a scalar string as
  three slots instead of one, and a knowingly false `test.fails` assertion
  was reported as `105 passed | 1 expected fail (106)`. A Ruff-clean Python
  mutation also skipped a substantive test through an aliased pytest callable
  while a filler preserved the pass threshold; machine-readable pytest
  reported 695 passed / 1 skipped and the Python verifier remained green. A
  second Ruff- and mypy-clean exact-start mutation loaded a collection plugin
  through `pytest_plugins`, removed one substantive item, and added a filler;
  focused JUnit exposed only one ordinary pass while both integrity and the
  complete Python verifier remained green. Recovery validation on 2026-08-01
  confirmed three further already-represented residual families: cross-file
  `test.fails` laundering through statically resolvable dynamic `import()`
  helpers; a registry-declared custom Vitest reporter forging the
  ordinary-pass summary; and Ruff- and mypy-clean `pytest_collection_finish`
  / `pytest_runtestloop` conftest hooks removing collected items after
  collection while a filler preserved the ordinary pass count.
  The next independent audit of exact commit
  `83d83ff1b805b57ca7fecf2797cf35e2036e0740` / tree
  `f9fddf739fa21d06517574f839625bfb931521ee` reproduced three further
  verifier failures. Repository Vitest reporter sources in workspace scripts
  or recognized config could coexist with the appended default reporter and
  forge the proof channel (`AUD-VER-001`). The pytest terminal parser accepted
  unknown categories, trailing text, duplicate summaries, and malformed
  duration forms (`AUD-VER-002`). A minimum pass threshold also did not bind
  execution to one exact cross-platform Python node-ID inventory, so
  count-preserving platform-conditioned definitions and empty parameter
  tables remained green (`AUD-VER-003`).
- Workaround: none accepted. Metadata author/reviewer inequality is
  provenance hygiene, not independent certification.
- Resolution + evidence link: FIXED. Added a literal test-only oracle with
  every count/scenario/evaluation/credential decision, coherent-drift tests,
  sound definitely-executed table mutation and concat semantics,
  TypeScript-AST conditional-skip/expected-fail detection, static
  dynamic-import closure resolution that fails closed on unresolved
  specifiers, a verifier-owned Vitest reporter channel, lexical Python AST
  skip/collection policy with named execution-stage session hooks, and strict
  cross-platform non-pass summary parsing. The final candidate rejects
  repository-controlled reporter channels before every child process, parses
  one exact final ordinary pytest summary, and compares collection and pass
  counts against the canonical common-plus-POSIX node-ID inventory. Bounded
  corrective execution is recorded in `docs/TEST_EVIDENCE.md`. The exact
  hosted three-OS proof (run `30741379567` at commit
  `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7`) and the genuinely fresh
  independent audit (Fable 5 Max, FABLE_CLEAR_FOR_GOVERNANCE_CLOSEOUT,
  confirming AUD-VER-001 through AUD-VER-003 CLEAR: 294/294 verifier
  suite-state tests, exact inventories of 975 common/Windows node IDs at
  SHA-256 `091078f72fe887c21980f601f95e2996190b2fccf7b5bf32e9567897f0a62f36`
  and 977 POSIX node IDs at SHA-256
  `196a4cfd4c08bc56a7b96eb5be7454ec50d479a39a313c127729b34fd078f55f` with the
  FIFO and Unix-domain-socket cases as the only POSIX delta, and three real
  count-preserving mutations all rejected by the identity proof) have now
  completed, closing the issue on 2026-08-03; see docs/TEST_EVIDENCE.md §
  M02-W01 — Governance closeout after independent Fable acceptance
  verification (2026-08-03). Package verification does not evaluate a
  critical gate; the invalidated revisions above remain preserved historical
  evidence.

### KI-0045 — Fixture topology and consequential-policy coverage are shallow

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the post-acceptance M02-W01 independent audit
- Affects: M02-W01 fixture diversity, scenario reasoning, and policy coverage
- Description: all profiles share one six-record topology, all resumes have
  five facts, 22 of 24 jobs share one requirement shape, every claim cites
  one artifact, only relocation policies are exercised, ten blocking
  policies are dead, and no scenario yields BLOCK_FIELD_POLICY.
- Reproduction: independent corpus projections produce the exact shallow
  distributions recorded in the audit, including zero BLOCK_AND_EXPLAIN
  actions and zero BLOCK_FIELD_POLICY outcomes.
- Workaround: none accepted; relabeling or count inflation is not meaningful
  diversity.
- Resolution + evidence link: FIXED. The committed corpus now measures five
  distinct evidence topologies, resume fact counts of 4/5/6, twenty-two
  structured job shapes, thirty-one scenario signatures, eighteen
  multi-evidence claims (sixteen with three or more evidence references),
  twenty BLOCK_FIELD_POLICY scenarios, sixty-nine policy evaluations, and all
  four expected actions including BLOCK_AND_EXPLAIN (corpus-positive.test.ts
  diversity measurement), all above the recorded thresholds and without
  claiming final corpus or gate minima. Closed by the 2026-08-03 governance
  closeout: the independent Fable 5 Max acceptance verification of exact
  content commit `7523e096b51c1c3a0490924235879d4d6d386b81` / tree
  `666987a702d274aabcee8bbfdfae5afd5d9c18e7` confirmed those measurements
  green within the 108/108 focused suite, with final hosted three-OS run
  `30741379567` green; see docs/TEST_EVIDENCE.md § M02-W01 — Governance
  closeout after independent Fable acceptance verification (2026-08-03).
  Package verification does not evaluate a critical gate.

### KI-0033 — Future Gate D guidance named deprecated platform roots

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the owner-directed final M01 audit follow-up
- Affects: M02-W01; `docs/CRITICAL_GATES.md`;
  `scripts/validate_status.py`
- Description: the future `CROSS_PLATFORM_CORE` guidance still named
  `platform:evidence-record:v1` and `platform:certification-input:v1` after
  M01-W07 published corrected v2 roots and deprecated those v1 roots. The
  gate remained honestly `NOT_EVALUATED`, but a future producer following the
  prose could have selected historical compatibility semantics.
- Reproduction: at starting revision `0c8efc9212162bcb4fa846e453007d9404d97429`,
  inspect the Gate D governance note in `docs/CRITICAL_GATES.md`; then mutate
  either reference to v999 or retain v1 and run the pre-M02 status validator.
  The original validator did not reject either drift.
- Workaround: none for new producers. Historical v1 data remains readable,
  but ADR-0004 requires v2 for every new write.
- Resolution + evidence link: guidance now names the two v2 roots and status
  governance resolves their schema files, IDs, majors, and nondeprecated
  state. Four independent temporary-copy mutations cover v1 and v999 for both
  families. Final content tree `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`
  passed both exact clean clones and three-OS run `30446331580`; see
  `docs/TEST_EVIDENCE.md` § M02-W01.

### KI-0034 — Generated-contract CLI check retained unbounded child output

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the owner-directed final M01 audit follow-up
- Affects: M02-W01 nonblocking follow-up;
  `scripts/tests/test_generated_contracts.py::_run_cli_check`
- Description: `_run_cli_check` had a finite 300-second operation deadline and
  no shell, but `subprocess.run(capture_output=True)` could retain unbounded
  stdout/stderr in memory. A noisy or failed generator could therefore exceed
  the test boundary before its otherwise useful diagnostic was returned.
- Reproduction: replace the child in an isolated test with one that writes
  more than 1 MiB. The starting helper retained the complete output.
- Workaround: none accepted; no timeout increase is permitted.
- Resolution + evidence link: the wrapper now uses a shared shell-free,
  concurrently drained 1-MiB boundary while preserving the existing
  300-second deadline and ordinary nonzero exits. Synthetic overflow,
  timeout-prefix, and nonzero-output regression tests are present. Final
  content tree `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` passed both exact
  clean clones and three-OS run `30446331580`; see
  `docs/TEST_EVIDENCE.md` § M02-W01.

### KI-0035 — Python contract-adapter test retained unbounded child output

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the owner-directed final M01 audit follow-up
- Affects: M02-W01 nonblocking follow-up;
  `scripts/tests/test_contract_python_adapter.py::_run`
- Description: the focused Python adapter wrapper had a finite 30-second
  operation deadline and no shell, but its captured stdout/stderr had no hard
  ceiling. A malformed or noisy adapter could consume unbounded test-process
  memory.
- Reproduction: run the wrapper boundary against a synthetic child that emits
  more than 1 MiB; the starting implementation retained the complete output.
- Workaround: none accepted; no package, test, CI, or global timeout increase
  is permitted.
- Resolution + evidence link: `_run` now shares the same concurrent 1-MiB
  retained-output boundary, keeps its 30-second deadline, preserves ordinary
  exit diagnostics, and fails closed on overflow or timeout. Final content
  tree `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` passed both exact clean
  clones and three-OS run `30446331580`; see `docs/TEST_EVIDENCE.md`
  § M02-W01.

### KI-0036 — Parallel contract files raced one shared Rust harness build

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during M02-W01 hosted corrective verification
- Affects: M02-W01 closeout proof; M01-W05/M01-W07 test infrastructure;
  `packages/contracts/vitest.config.ts`
- Description: independent contract matrix files each load a process-local
  `rustHarnessBuilt` flag, but their isolated Vitest workers build and execute
  the same test-only Rust binary under one shared target directory. Hosted
  Windows contention can therefore make otherwise valid concurrent
  `cargo build --locked --offline` calls return nonzero. This changes no
  contract verdict, and the accepted 183-file generated contract tree remains
  byte-identical.
- Reproduction: hosted run `30440572546`, Windows job `90538645686`, ran the
  fixture package successfully (6/6 files, 51/51 tests) and then reported
  `ADAPTER_EXIT_NONZERO` from both
  `w07-platform-rule-matrix.test.ts` and
  `w07-secret-store-truth-table.test.ts` at `buildRustHarness`; 2,438 sibling
  contract assertions passed. The prior run `30439385146` reproduced the same
  class once on Ubuntu.
- Workaround: none accepted. A retry would not correct the shared-path race,
  and no timeout may be increased or failure waived.
- Resolution + evidence link: the existing contracts Vitest configuration now
  sets `fileParallelism: false`, making all shared Rust-harness build and
  execution boundaries deterministic while retaining the existing 30-second
  test timeout and every assertion. Final content tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` passed all 20 contract
  files / 2,440 tests, both exact clean clones, and three-OS run
  `30446331580`; see `docs/TEST_EVIDENCE.md` § M02-W01.

### KI-0037 — Historical status fixtures inherited a later READY package

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during the first M02-W01 governance-stamp
  verification
- Affects: M02-W01 closeout proof;
  `scripts/tests/test_validate_status.py`
- Description: two validator tests constructed historical M01/M02 boundary
  states by changing the package under test but did not reset a later READY
  package inherited from the live project ledger. Once the authorized
  M02-W01 closeout made M02-W02 the sole READY package, those fixtures
  accidentally contained two READY rows and stopped testing their intended
  premises.
- Reproduction: on the uncommitted five-file M02-W01 governance stamp over
  content tree `d39a94483dd93146727bec15dc7a31d7484190ef`, run `pnpm verify`.
  Python verification reports 675 passes and exactly two failures:
  `test_m00_may_remain_accepted_while_m01_blockers_are_live` and
  `test_fixed_ledger_and_none_sentinel_allow_later_readiness`. Both fail
  because M02-W02 remains READY when the test constructs an earlier state.
- Workaround: none accepted. The stamp was not committed and all five
  governance files were restored to the valid M02-W01 IN_PROGRESS state.
- Resolution + evidence link: both boundary setups now use the existing
  `reset_downstream` helper, and each regression explicitly seeds M02-W02 as
  READY before proving that the intended older state validates. The two
  focused tests, all 148 status-validator tests, and full verification pass.
  Final content tree `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`
  passed both exact clean clones and three-OS run `30446331580`; see
  `docs/TEST_EVIDENCE.md` § M02-W01.

### KI-0038 — Cargo negative-test descendant outlived Windows cleanup

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-29 during required Windows CI for the KI-0037
  corrective content
- Affects: M02-W01 closeout proof; M01-W05/M01-W07 test infrastructure;
  `packages/contracts/test/contract/infrastructure.test.ts`
- Description: the Rust non-compilation boundary test used `cargo build` for
  an invalid temporary crate. Under the first workspace-wide Windows test
  pass, that coordinator consumed the unchanged 30-second child boundary and
  left a descendant holding the temporary target directory beyond Node's
  bounded cleanup retries. The cleanup `EPERM` masked the stable negative
  boundary result. The test passed later in the same job after toolchain
  warm-up, so this is test-process lifetime behavior, not a schema, semantic,
  fixture, or generated-contract verdict.
- Reproduction: run `30444571597` at content commit
  `b0669a4c702d34ba2f6db254d190438bdb258a84` passed macOS job
  `90551671445` and Ubuntu job `90551671488`; Windows job `90551671515`
  failed only
  `a Rust adapter that does not compile fails the subprocess boundary` at
  `rmSync`. The first unit pass took 30,018 ms and reported 19/20 files and
  2,439/2,440 tests; the later focused contract suite passed the same test
  within its 8/8 infrastructure tests and passed 662/662 contract tests.
- Workaround: none accepted. The run is historical failed evidence; no retry,
  timeout increase, skipped assertion, or cleanup waiver is permitted.
- Resolution + evidence link: the test now invokes pinned `rustc` directly on
  the invalid Rust source with `--emit=metadata`. This preserves the exact
  non-compilation-to-`ADAPTER_EXIT_NONZERO` assertion, unchanged 30-second
  child boundary, unchanged 128-KiB output bound, and mandatory cleanup while
  removing Cargo's unrelated coordinator/descendant lifetime. Ten repeated
  8/8 focused runs, all 20 files / 2,440 contract tests, and full canonical
  verification pass locally. Final content tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` passed both exact clean
  clones and three-OS run `30446331580`; the complete Windows log proves the
  corrected first-pass behavior and clean-tree closeout. See
  `docs/TEST_EVIDENCE.md` § M02-W01.

### KI-0029 — Accepted status contradicted its live blocker ledger

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 by independent post-acceptance M01-W07 audit
- Affects: M01-W07 and M01; `docs/PROJECT_STATUS.md`;
  `scripts/validate_status.py`
- Description: the accepted status header, milestone/package tables, and next
  READY row said M01-W07 was VERIFIED, M01 was ACCEPTED, and M02-W01 was READY,
  while the live `Known release blockers` section in the same file still
  listed KI-0024 and KI-0025 as HIGH/IN_PROGRESS and said M01 through M38 were
  unaccepted. The issue ledger correctly marked KI-0024/KI-0025 FIXED, but the
  validator required only the blocker heading and never parsed or reconciled
  its entries.
- Reproduction: at `93541b755dfcd2708c955ada4fdef943b0afaa09`, inspect the
  accepted rows and the live blocker section, then run
  `python3 scripts/validate_status.py`; all 43 groups incorrectly pass.
- Workaround: none was accepted. M01-W07 and M01 remained reopened with no
  READY package throughout executable correction and content proof.
- Resolution + evidence link: `scripts/validate_status.py` now machine-parses
  and reconciles every live blocker against the issue ledger, affected
  milestones, package state, and next readiness. Permanent negative fixtures
  include the exact prior contradiction. Final content commit
  `c24ccf989726a4870c152a22eec7b6f48e125be8` / tree
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590` passed two exact-commit clean
  clones and three-OS run 30423199771; see `docs/TEST_EVIDENCE.md` § M01-W07.

### KI-0030 — Platform semantic matrices admit cross-axis contradictions

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 by independent post-acceptance M01-W07 audit
- Affects: M01-W07 platform schemas, semantic rules, generated TypeScript and
  Python bindings, and the representative Rust compatibility harness
- Description: structurally valid records are semantically accepted when an
  interrupted terminal install/update claims completed recovery, RUNNING
  carries a termination request, TERMINATED carries an independent exit code,
  a certified input self-declares a singleton complete evidence policy, browser
  availability contradicts evaluation method, a GET/NOT_FOUND result claims an
  unavailable store, a nonexistent runtime retains identity, or package states
  fall through without state-specific version fields. The mandatory final
  same-class sweep additionally found that a certified claim could name
  evidence references unrelated to its otherwise complete reviewed inventory.
  The same failures occur in TypeScript, Python, and Rust.
- Reproduction: the bounded audit witnesses for SEM-01 through SEM-07 all
  return structural VALID and semantic VALID at
  `93541b755dfcd2708c955ada4fdef943b0afaa09`; the required verdict is semantic
  INVALID under the corrected contract.
- Workaround: the affected deprecated v1 semantics remain
  compatibility-only; corrected consumers select the reviewed v2 roots.
- Resolution + evidence link: corrected v2 semantics, the 13 direct witnesses,
  and real-adapter parity for all 538 platform/policy plus 288 secret-store
  cells are recorded in `docs/TEST_EVIDENCE.md`. Final content commit
  `c24ccf989726a4870c152a22eec7b6f48e125be8` / tree
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590` passed both exact-commit clean
  clones and run 30423199771 on macos-15, windows-2025, and ubuntu-24.04.

### KI-0031 — Same-major semantic changes escaped compatibility classification

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 by independent post-acceptance M01-W07 audit
- Affects: M01-W07 and M01-W05 compatibility infrastructure;
  `packages/contracts/test/contract/breaking/`
- Description: published v1 semantic behavior changed while schema and rule
  majors stayed at v1/1.0.0. The compatibility signature fingerprints schema
  structure, rule metadata, and only current expected-valid corpus cases, so it
  omitted executable negative behavior and missed old-valid payloads whose
  expectation later became negative. Exact replay distinguishes three scopes:
  the 229 source-positive historical inputs have 2 removals / 17
  additions at 448→0659; their union with the current-v1 platform corpus has
  26/17; and the current major migration has 39 explicitly paired
  deprecated-v1-valid/corrected-v2-invalid cases. The 13 direct SEM-01…SEM-07
  v2 negatives (including the v2-only final-sweep inventory cross-binding
  witness) are new reproductions, not published-v1 semantic additions. This finding
  invalidates the same-major compatibility conclusions recorded historically
  in KI-0023, KI-0024, and KI-0025 without erasing their revision-specific
  repair evidence.
- Reproduction: at invalidated content anchor `0659c13` (and stamped
  `93541b7`), the macOS/CUDA model-profile payload is semantically valid under
  the `44827ae` v1 evaluator and invalid under the then-current v1 evaluator,
  while `pnpm contracts:compatibility:check` reports
  `{"compatible":true,"findings":[]}`.
- Workaround: baseline updates remain forbidden until retained old-major and
  corrected new-major executable behavior is independently classified.
- Resolution + evidence link: the deprecated v1 accepted-set union preserves
  all 229 canonical historical-positive witnesses; 15 corrected v2 roots and
  30 v2 bindings carry the intentional tightening; compatibility format 2.1
  binds 572 executable semantic witnesses and fails closed on same-major
  semantic removals. The named baseline update followed recorded additive
  classification and two empty read-only rechecks. Final content
  `c24ccf989726a4870c152a22eec7b6f48e125be8` /
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590` passed two clean clones and
  three-OS run 30423199771; see `docs/TEST_EVIDENCE.md` § M01-W07.

### KI-0032 — Child-process and compatibility evidence bounds were incomplete

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-28 by independent post-acceptance M01-W07 audit
- Affects: M01-W07/M01-W05 test infrastructure and contract documentation
- Description: at invalidated anchor `93541b7`, three synchronous
  external-child test sites relied on the package-wide 30-second Vitest timeout
  rather than an explicit child timeout. Documentation also said every
  language ran all 444 cases and described the structural/metadata signature as
  exhaustive semantic proof, despite language applicability of TypeScript 443,
  Python 439, and Rust 438 and the reproduced executable-semantic blind spot.
- Reproduction: at `93541b755dfcd2708c955ada4fdef943b0afaa09`, inspect the
  synchronous child calls in generated-contract, error-taxonomy, and
  security-policy tests; each lacks an explicit timeout. Compare the locked
  manifest applicability counts with the cited evidence prose.
- Workaround: no timeout increase was used; all external children continue to
  fail closed within their explicit operation-specific bounds.
- Resolution + evidence link: the three generated-test child sites now share
  a shell-free 15-second/1-MiB boundary with deterministic timeout, output,
  execution, and nonzero-exit behavior; Rust build/adapters and semantic
  batches use explicit 300/120/30-second bounds. Documentation now records
  exact language applicability and executable-witness scope. Final content
  commit `c24ccf989726a4870c152a22eec7b6f48e125be8` / tree
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590` passed local verification, both
  clean clones, and three-OS run 30423199771; see `docs/TEST_EVIDENCE.md`
  § M01-W07.

### KI-0022 — M28 familiarity study depends on post-M28 job-board and queue UI

- Severity: MEDIUM
- State: DEFERRED
- Discovered: 2026-07-27 during M00-W11
- Affects: `M28-W06`, `M33-W07`, `M34-W07`, `REQ-UX-007`,
  `REQ-UX-010`, `REQ-UX-014`, `REQ-UX-015`, `REQ-UX-016`,
  `REQ-UX-018`
- Description: the owner-approved v1.4 contract makes the M28-W06
  Simplify-experienced-user study a blocking M28 obligation and includes
  actual job search/save and queue-approval tasks, while the dedicated
  job-board/matches and review-to-queue UI packages are M33-W07 and M34-W07,
  which are sequenced after M28.
- Reproduction: read canonical specification §5.15.9 and the M28-W06 package
  row, then compare the M33-W07 and M34-W07 package rows and the §9 milestone
  dependency order. The required study tasks cannot all be exercised in the
  stated milestone order without an owner-approved sequencing decision.
- Workaround: none that may be silently applied. Do not fabricate M28 study
  evidence, weaken `REQ-UX-018`, or implement M33/M34 product behavior during
  M00-W11. Before M28 acceptance, obtain an owner-approved ADR/spec revision
  that supplies the required product surfaces or changes their sequencing
  while preserving the familiarity/originality acceptance standard.
- Resolution + evidence link: deferred to future planning before M28; the
  exact conflict and M00-W11 non-workaround are recorded in ADR-0003 and
  docs/TEST_EVIDENCE.md § M00-W11.

## M01-W04 review

M01-W04 introduced the canonical capability, command, and authorization
policy catalogs; strict authorization-request metadata; bounded safe-integer
generator support; and generated TypeScript/Python policy lookups and
fail-closed authorization. KI-0021 below was reproduced and fixed during
independent package validation: both language authorizers had trusted live
validated objects in ways that could let values change between validation
and policy use. The TypeScript surface now authorizes only a frozen
descriptor snapshot of plain own data, and Python serializes model input to a
fresh record and strictly revalidates it. No product dispatcher or M01-W05
contract suite was added. No CRITICAL or HIGH issue remains open.

## M01-W03 review

M01-W03 introduced the machine-readable error taxonomy: the twelve-family
vocabulary and 80 stable codes (`schemas/error/taxonomy.v1.schema.json`),
the canonical validated per-code metadata catalog
(`catalog/error-catalog.v1.json` + `schemas/error/catalog.v1.schema.json`),
the strict code-only wire record (`schemas/error/record.v1.schema.json`),
narrow generator support for strict booleans and uniform arrays, and the
generated TypeScript/Pydantic catalog-data surfaces with fail-closed
unknown-code lookups. KI-0019 below was discovered and fixed during
package validation (a single recurrence of the KI-0014…KI-0017
boundary-fixture premise-inheritance class, after which the shared
closeout helpers were generalized through the M01-W05 boundary).
Post-verification review then found KI-0020: the claimed
`transient`/`SAFE_RETRY` equivalence was enforced in only one direction,
and two committed MODEL entries contradicted it; the focused correction is
fixed and hosted-verified below. Deliberate, documented scope boundaries (not
defects): the catalog defines exactly the specification-derived near-term
codes (no speculative inventory, no generic UNKNOWN); tuple arrays, `uniqueItems`,
and unbounded, unsafe, or otherwise unsupported `integer` variants remain
fail-closed generator constructs (M01-W04 deliberately added only bounded
safe integers); capability/command allowlists are M01-W04; cross-language
round-trip certification is M01-W05. No CRITICAL or HIGH issue is open.

## M01-W02 review

M01-W02 introduced the deterministic contract generator
(`scripts/generate-contracts.ts` + `packages/contracts/generator/`), the
committed generated TypeScript/Pydantic trees under
`packages/contracts/generated/`, and the ACTIVE contract-gen drift suite.
One reproducible defect class was discovered and fixed during package
validation (KI-0017 below — the same boundary-fixture premise-inheritance
class as KI-0014/KI-0015/KI-0016), and a focused corrective closeout then
fixed KI-0018 below (non-rollback-safe generated-tree replacement plus
literal control bytes in tracked test source) without changing generated
output bytes. Deliberate, documented scope boundaries
(not defects): the generator supports exactly the construct set committed by
M01-W01 and fails closed on everything else (arrays, general combinators,
exclusive bounds, non-date formats — see packages/contracts/README.md §10a);
array support arrives with the first package that commits an array-bearing
schema. Cross-language round-trip certification remains owned by M01-W05.
The generated Python package is wired through pytest/mypy path
configuration rather than an installable distribution; a packaging decision
belongs to the milestone that first consumes it from product code. No
CRITICAL or HIGH issue is open.

## M01-W01 review

M01-W01 introduced the JSON Schema convention layer in `packages/contracts`
(schemas, strict offline validation, convention tests, and the normative
README). One reproducible fixture defect was discovered and fixed during
package validation (KI-0015 below). The syntactic-only currency/country
checks are documented policy in `packages/contracts/README.md` §3, not
defects. No CRITICAL or HIGH issue is open.

## M00-W10 independent review

M00-W10 independently re-read the canonical v1.3 specification, the full
project-memory and platform/gate records, the W08/W09 diffs, implementation
and tests, and both prior three-operating-system hosted runs. The review
closed KI-0007 through KI-0014 below. No CRITICAL or HIGH M00 issue remains
open.
KI-0001, KI-0003, and KI-0006 remain honest `LOW` deferred boundaries owned
by future packages; none represents implemented product behavior or accepted
platform evidence.

## M00-W09 portability review

M00-W09 added the required `windows-2025` hosted job, Windows-aware
doctor/resolution behavior (`scripts/portability.py`), the deterministic
portability policy suite (`scripts/check_portability.py`), the
`packages/platform` ownership scaffold, and `.gitattributes` LF
enforcement. No new open defect was found. The Windows job is a
repository/toolchain portability baseline only: no Windows product,
secure-store, native-messaging, model-runtime, installer, or update claim
exists, and all four critical gates remain `NOT_EVALUATED`. KI-0006 parks
the one deliberate scope boundary observed during implementation.

## M00-W08 migration review

The earlier M00-W07 audit found no new open product defect. M00 is now
reopened for v1.3. No product surface, ATS adapter, compatibility result,
benchmark result, installer, secure-store adapter, platform model profile,
or critical-gate result exists yet, so none is claimed.
The two existing LOW deferred risks (KI-0001 and KI-0003) remain assigned to
their stated future owners and do not weaken an M00 verification or exit
criterion. All four critical gates remain `NOT_EVALUATED`.

The initially supplied in-repository v1.3 proposal transport was rejected
before editing because the v1.2 fail-closed validator correctly prohibited a
second canonical-looking specification under `docs/`. The owner replaced it
with an exact-hash external transport. ADR-0002 records the resolution; no
validator exception or weakening was introduced.

## Fixed defects

### KI-0025 — Platform semantic rules refuse coherent outcomes and admit incoherent ones

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 during the KI-0024 corrective repair of M01-W07, by an
  independent completeness audit that swept every platform rule for the
  KI-0024 defect class rather than only the reported instance; extended on
  2026-07-28 by the owner-authorized exhaustive final audit, which reproduced
  eight further defects of the same reachability, state-coherence, and
  orthogonal-axis-coupling class
- Affects: M01-W07; `packages/contracts/generator/semantic-rules.ts`
  `platformPackageStateEvidence`, `platformEvidenceIntegrity`,
  `platformRuntimeCapabilityFallback`, `platformPathResolutionSafety`,
  `platformProcessStatusIntegrity`, `platformNativeRegistrationResult`,
  `platformNativeRegistrationBinding`, `platformProcessPlanSafety`,
  `platformCapabilityReportIntegrity`, `platformModelProfileEvidence`,
  `platformBrowserRecordScope`, `platformDiagnosticIntegrity`,
  `platformCertificationInputScope`; the generated TypeScript/Python evaluators
  and the representative Rust harness that mirror them; the M01-W07 platform
  rule matrix and corpus; `packages/contracts/M01-W07.md`
- Description: KI-0024 repaired one unreachable positive branch. A systematic
  sweep of all eighteen platform rule kinds found five more of the same class,
  each a structurally representable and operationally ordinary outcome that no
  payload can express.
  (F1) `platformPackageStateEvidence` makes `recovery_completed = true`
  unsatisfiable with every package success state: recovery implies
  `interrupted = true`, interruption requires the `INTERRUPTED` reason, and a
  success state requires zero reasons and `interrupted = false`. A recovered
  interrupted install or update — an outcome specification §5.14.8 explicitly
  requires each platform to pass — cannot be reported as a success.
  (F2) `platformEvidenceIntegrity` forces `evaluation_method =
  STATIC_INSPECTION` whenever `machine_class` is `HOSTED_CI_RUNNER` or
  `PHYSICAL_DEVELOPMENT_MACHINE`, fusing two orthogonal axes. Synthetic
  fixtures executed on a hosted CI runner — the exact shape of this
  repository's own three-OS evidence — are unrepresentable.
  (F3) `platformRuntimeCapabilityFallback` collapses `DEGRADED_LIMITED` onto
  `UNAVAILABLE` by forcing empty available and accepted profile lists for
  every non-`AVAILABLE` runtime, although the sibling helper
  `platformCapabilityStateSound` already treats `DEGRADED_LIMITED` as
  meaningfully distinct and specification §5.14.1 describes `CERTIFIED_CORE`
  as "AI unavailable or below performance tier".
  (F4) `platformPathResolutionSafety` forces `exists = false` and
  `writable = false` for every non-`RESOLVED` state, so a `DENIED_PERMISSION`
  resolution of a path that does exist must report a false observation.
  (F5) `platformProcessStatusIntegrity` requires zero reasons for `EXITED`, so
  a non-zero exit code is structurally representable but can never be
  explained; `EXITED` is the only terminal process state that forbids reasons.

  The owner-authorized exhaustive final audit then reproduced eight further
  defects of the same class. Six are fail-open: the contract admits a payload
  that asserts something untrue.
  (F6) `platformNativeRegistrationResult` binds `observed_state =
  PRESENT_VALID` to a zero-reason success claim, so a removal that fails and
  leaves the existing registration intact is unrepresentable. `observed_state`
  is the post-operation registration state, not an operation outcome; the
  KI-0024 matrix recorded `REMOVE`/`PRESENT_VALID` as the one cell "no
  representative can rescue" only because its representative model keyed
  reasons by observed state and therefore never offered an operation-level
  failure reason.
  (F7) `platformProcessPlanSafety` refuses only bare lowercase interpreter base
  names, so the Windows executable-suffix form defeats the guard; it accepts
  privilege-escalation launchers as plan arguments; it lets `JAPP_PATH_ROLE`
  carry any bounded token, including the `NATIVE_HOST_REGISTRATION` value the
  same rule refuses on `working_directory_role`; it accepts `0`, `007`, and
  `99999` as `JAPP_SERVICE_PORT`; and it leaves `JAPP_SERVICE_BIND_HOST`
  wholly unconstrained, so a reviewed spawn plan may bind the local service to
  a non-loopback address contrary to `REQ-PLAT-003`.
  `packages/contracts/M01-W07.md` states that the rule "additionally refuses
  interpreter tokens even when each token satisfies the grammar", which the
  committed rule does not do — the same documentation-overstatement class as
  KI-0024 (D).
  (F8) `platformNativeRegistrationBinding` does not require
  `max_message_bytes`, although specification §5.14.5 makes the extension
  allowlist and message-size limits mandatory on every platform.
  (F9) `platformCapabilityReportIntegrity` admits a `CERTIFIED_FULL` report in
  which every mandatory core capability is `AVAILABLE` through
  `SYNTHETIC_FIXTURE` or `DECLARED_PLAN`, so a certification claim can carry
  zero measured native evidence. The sibling `platformTargetSupportClaim`
  already requires `MEASURED_NATIVE_RUN` for the identical `support_claim`
  record.
  (F10) `platformModelProfileEvidence` binds `APPLE_SILICON_GPU` to
  `MACOS_ARM64` but not the converse, so an `ACCEPTED`, evidence-complete
  `MACOS_ARM64` profile may claim `NVIDIA_CUDA` — a full-AI certification
  claim for hardware that cannot exist on the certified Apple Silicon target
  (specification §5.14.1 and the §5.14.6 profile list). It also forbids
  `minimum_vram_mib` on `CPU_ONLY` while admitting `minimum_driver_version`.
  `packages/contracts/M01-W07.md` already asserts "Accelerator, runtime family,
  and target must agree."
  (F11) `platformBrowserRecordScope` admits `presence = AVAILABLE` with
  `detection_method = NOT_EVALUATED`, and admits a `detected_version` on a
  `NOT_INSTALLED`, `NOT_EVALUATED`, or `UNSUPPORTED_TARGET` presence.
  (F12) `platformDiagnosticIntegrity` forces `blocking = true` for a `BLOCKED`
  result but leaves its severity unconstrained, so a capability-blocking
  diagnostic may be filed at `INFO`.
  (F13) `platformCertificationInputScope` derives completeness from the
  record's own `required_evidence_kinds`, so a `CERTIFIED_FULL` proposal may
  declare that set empty and still report `inventory_complete = true`.
- Reproduction: at the KI-0024 corrective content revision, load the canonical
  schema catalog and the generated TypeScript semantic evaluator, then mutate
  the committed representatives.
  (F1) `w07.installer-state` with `state = INSTALLED`, `installed_version =
  package_version`, `signature_state = SIGNATURE_VALID`, `interrupted = true`,
  `recovery_completed = true`, `reason_codes = ["INTERRUPTED"]`,
  `user_data_preservation = PRESERVED`, `native_host_cleanup = NOT_APPLICABLE`
  and one evidence reference — structural accept, semantic reject; the same
  record without the interruption and recovery accepts. The equivalent
  `w07.update-state` record with `state = UPDATE_INSTALLED` behaves the same.
  (F2) `w07.evidence-record` with `machine_class = HOSTED_CI_RUNNER` and
  `evaluation_method` of `SYNTHETIC_FIXTURE`, `DECLARED_PLAN`, or
  `NOT_EVALUATED` — structural accept, semantic reject in all three; the same
  record with `STATIC_INSPECTION` accepts.
  (F3) `w07.runtime-capability` with `runtime_availability =
  DEGRADED_LIMITED`, `detection_method = MEASURED_NATIVE_RUN`, one available
  profile reference, no accepted profile references,
  `core_capability_behavior = CORE_PRESERVED_AI_DEGRADED`, a finite reason,
  and runtime family/version/accelerator present — structural accept, semantic
  reject.
  (F4) `w07.path-resolution` with `resolution_state = DENIED_PERMISSION`, no
  sanitized path or digest, `exists = true`, `writable = false`, and
  `reason_codes = ["PERMISSION_DENIED"]` — structural accept, semantic reject;
  the same record with `exists = false` accepts.
  (F5) `w07.process-status` with `state = EXITED`, `exit_code = 1`, an
  `ended_at`, and `reason_codes = ["ADAPTER_ERROR"]` — structural accept,
  semantic reject; the same record with no reasons accepts. The same record
  with `exit_code = 1` and no reasons also accepts, so an unexplained failure
  passes while an explained one fails.
  (F6) `w07.native-messaging-result` with `operation = REMOVE`,
  `observed_state = PRESENT_VALID`, `changed = false`,
  `idempotent_repeat_safe = false`, `reason_codes = ["PERMISSION_DENIED"]`, and
  the observed manifest digest and host version present — structural accept,
  semantic reject.
  (F7) `w07.process-plan` with `arguments = ["cmd.exe"]`, `["powershell.exe"]`,
  `["bash.exe"]`, `["sudo"]`, `["pkexec"]`, `["doas"]`, or `["runas"]` — all
  accept, while the bare `["cmd"]` and `["sh"]` forms are refused. The same
  root with `environment_allowlist = [{"variable": "JAPP_PATH_ROLE", "value":
  "NATIVE_HOST_REGISTRATION"}]`, with `JAPP_SERVICE_PORT` of `0`, `007`, or
  `99999`, or with `JAPP_SERVICE_BIND_HOST = "0.0.0.0"` — all accept.
  (F8) `w07.native-messaging-registration` with `max_message_bytes` removed —
  structural and semantic both accept.
  (F9) `w07.capability-report` with `reviewed_tier = CERTIFIED_FULL`, one model
  profile reference, and every capability set to `AVAILABLE` with
  `evaluation_method = SYNTHETIC_FIXTURE` — structural and semantic both
  accept.
  (F10) `w07.model-runtime-profile` with `platform_id = MACOS_ARM64`,
  `runtime_family = OLLAMA_GGUF`, `accelerator = NVIDIA_CUDA`,
  `minimum_vram_mib`, `minimum_driver_version`, `availability = AVAILABLE`,
  `acceptance_state = ACCEPTED`, `core_capability_behavior =
  FULL_AI_AVAILABLE`, zero reasons, and the four measured evidence references —
  structural and semantic both accept, while the mirror-image
  `WINDOWS_X64`/`APPLE_SILICON_GPU` record is correctly rejected. The same root
  with `accelerator = CPU_ONLY` and `minimum_driver_version` present also
  accepts.
  (F11) `w07.browser-record` with `detection_method = NOT_EVALUATED`, and the
  same root with `presence = NOT_INSTALLED` and the fixture `detected_version`
  retained — both accept.
  (F12) `w07.diagnostic-report` with `result = BLOCKED`, `blocking = true`,
  `severity = INFO`, and one reason — structural and semantic both accept.
  (F13) `w07.certification-input` with a complete `CERTIFIED_FULL`
  `support_claim`, `required_evidence_kinds = []`, `present_evidence_kinds =
  []`, one evidence record reference, `inventory_complete = true`, and a
  recorded owner decision — structural and semantic both accept.
- Workaround: none accepted. Consumers must not treat package recovery
  evidence, hosted-CI evidence records, degraded runtime capability, denied
  path resolution, process exit diagnostics, or a failed native-registration
  removal as contract-expressible, and must not rely on the interpreter,
  environment, message-size, certification-evidence, accelerator/target,
  browser-presence, diagnostic-severity, or evidence-inventory invariants that
  the contract documentation currently claims, until these rules are repaired.
- Resolution + evidence link: FIXED. F1 through F5 were reproduced
  independently in TypeScript and Python at
  `44827ae73a04d4ef63ccb40cd93fd14b7e304010` before any edit, and the Rust
  harness was inspected and confirmed to mirror each of them; F6 through F13
  were reproduced the same way in the same session. The canonical generator
  was repaired first and the TypeScript and Python evaluators follow only from
  regeneration, with the Rust harness mirroring them intentionally; thirteen of
  the eighteen platform rule kinds now carry reviewed truth tables. Seven
  schemas took a description-only PATCH bump to `1.0.1` recording the field
  semantics the repair decided; no shape, `required` array, enum token, rule
  binding, `rule_version`, or generator format changed. The corpus grew
  additively 402 → 444; at that anchor, applicable cases agreed across
  TypeScript 443, Python 439, and Rust 438 (438 shared, five TypeScript-only,
  one Python-only). Before the baseline was written the compatibility checker
  reported
  `"compatible": true`, zero breaking findings, and exactly ten
  `SUPPORTED_WIRE_CASE_ADDED` positives. Re-running every reproduction against
  the repaired evaluators shows each unreachable positive admitted and each
  fail-open payload refused, while the zero-reason `REMOVE`/`PRESENT_VALID`
  false-success claim stays refused. First content commit
  `860b6e1e27a790668b7dec4fe8014c9f764106be` / tree
  `3d608cd0d9d933869f9dc9ecaa7854a77ca727d1` passed two clean clones and
  hosted run 30381703907 on macos-15 and ubuntu-24.04, but its windows-2025
  job exposed KI-0028. The final content commit
  `0659c13ff046c921ca648c50b40e71330abf2e75` / tree
  `211c4b72cae4404dc277d8b31df240e4abfc717c` passed both clean clones again —
  one of them under a path containing spaces and non-ASCII characters — and
  hosted run 30383429134 on macos-15 job 90356653908, ubuntu-24.04 job
  90356653981, and windows-2025 job 90356653998. KI-0026 and KI-0027 record
  the two questions deliberately left to M05-W13 and M03-W09. KI-0031 later
  invalidated the same-major compatibility conclusion, not these
  revision-specific test results. Evidence: docs/TEST_EVIDENCE.md § M01-W07
  corrective repair — KI-0025.

### KI-0024 — Native-registration removal was an unreachable positive branch, and platform stdio/architecture invariants were incomplete

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 during independent post-closeout assurance review of
  M01-W07
- Affects: M01-W07; `packages/contracts/generator/semantic-rules.ts`
  `platformNativeRegistrationResult`, `platformProcessPlanSafety`,
  `platformCertificationInputScope`, `platformEvidenceIntegrity`,
  `platformPackageStateEvidence`; generated TypeScript/Python semantic
  evaluators; representative Rust harness; native-messaging-result,
  process-plan, certification-input, evidence-record, installer-state and
  update-state corpus coverage; `packages/contracts/M01-W07.md`
- Description: four independent defects survived the KI-0023 corrective
  closeout and hosted three-OS CI.
  (A) `platformNativeRegistrationResult` rejects every zero-reason result
  whose observed state is not `PRESENT_VALID`, so the later
  `REMOVE -> ABSENT` success arm can never execute. A successful uninstall —
  the exact outcome specification §5.14.5 requires to be idempotent — is
  structurally representable but semantically unrepresentable. This is the
  same positive-branch reachability class as KI-0023.
  (B) `platformProcessPlanSafety` builds its native-messaging framing check
  from `stdin_mode` and `stdout_mode` only, while the process-plan schema
  requires `stderr_mode`. A `LOCAL_ORCHESTRATOR` or `MODEL_RUNTIME_HOST` plan
  can therefore declare `stderr_mode = BINARY_LENGTH_PREFIXED` and pass,
  silently turning a diagnostic channel into an unreviewed native-message
  protocol stream on a profile that is forbidden from using that framing at
  all.
  (C) Of the five M01-W07 roots that carry both `platform_id` and
  `architecture`, only `target-identity` binds them. `certification-input`,
  `evidence-record`, `installer-state`, and `update-state` accept
  certification, measured-native-evidence, packaging, and update claims whose
  architecture contradicts the certified target matrix in specification
  §5.14.1.
  (D) `packages/contracts/M01-W07.md` states that the KI-0023 cases "complete
  the secret-store STATUS/GET/PUT/DELETE truth table" although the committed
  matrix covers 11 of the 32 `secretOperation` x `secretResultState` cells,
  and `PLATFORM_RULE_TOKEN_CLOSURE` asserts token closure for 2 of the 18
  platform semantic rule kinds. Both claims overstate the delivered coverage.
- Reproduction: at starting revision
  `12f3c35be9cff1ca40541212ae83a3e79888a234`, load the canonical schema
  catalog and the generated TypeScript and Python semantic evaluators, then:
  (A) build `urn:japp:schema:platform:native-messaging-result:v1` with
  `operation = REMOVE`, `observed_state = ABSENT`, `browser_family = CHROME`,
  `idempotent_repeat_safe = true`, `reason_codes = []`, no
  `observed_manifest_digest`, and no `observed_host_version` — structural
  validation accepts and the semantic evaluator rejects for both
  `changed = true` and `changed = false`; the generated Python and the
  representative Rust harness carry the identical control flow.
  (B) build `urn:japp:schema:platform:process-plan:v1` with
  `profile = LOCAL_ORCHESTRATOR`, `stdin_mode = PIPE_BOUNDED`,
  `stdout_mode = PIPE_BOUNDED`, and `stderr_mode = BINARY_LENGTH_PREFIXED` —
  structural and semantic validation both incorrectly accept; the same holds
  for `MODEL_RUNTIME_HOST`, and a `NATIVE_MESSAGING_HOST` plan with
  `stderr_mode = BINARY_LENGTH_PREFIXED` also accepts.
  (C) set `platform_id = MACOS_ARM64` with `architecture = X86_64` on
  `certification-input`, `evidence-record`, `installer-state`, and
  `update-state` — all four accept structurally and semantically, while the
  identical contradiction on `target-identity` is rejected.
  (D) enumerate the `TRUTH_TABLE` entries in
  `packages/contracts/test/schema/w07-secret-store-truth-table.test.ts` and
  project them onto the 4 x 8 operation/state grid — 11 cells are covered and
  21 are not; enumerate `PLATFORM_RULE_TOKEN_CLOSURE` and compare it with the
  18 `PLATFORM_*` rule kinds in
  `packages/contracts/catalog/semantic-rules.v1.json`.
- Workaround: none accepted. Consumers must not treat a native-registration
  removal outcome, a platform stdio profile, or an architecture-bearing
  certification, packaging, or update claim as contract-validated until the
  corrective revision lands.
- Resolution + evidence link: FIXED. The executable repair landed in content
  commit `44827ae73a04d4ef63ccb40cd93fd14b7e304010` / tree
  `7fcd961fbde2770378248ca68e65526b4480a970`, which passed two clean clones
  and hosted run 30341428902 on macos-15, ubuntu-24.04, and windows-2025. That
  revision was deliberately held open rather than stamped, because the same
  completeness sweep that produced it had already reproduced KI-0025. The
  combined closeout is anchored at the final KI-0025 content revision
  `0659c13ff046c921ca648c50b40e71330abf2e75` / tree
  `211c4b72cae4404dc277d8b31df240e4abfc717c` (hosted run 30383429134, all
  three operating systems), which additionally proves the KI-0024 repair has
  not regressed: every KI-0024 branch and corpus case is preserved and passing
  there. KI-0031 later invalidated the same-major compatibility conclusion,
  not this revision-specific branch repair. Evidence: docs/TEST_EVIDENCE.md
  § M01-W07 corrective repair — KI-0024 and § M01-W07 corrective repair —
  KI-0025.

### KI-0028 — Temporary-directory cleanup after an external child was not Windows-correct

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 by required `windows-2025` CI on the KI-0025
  corrective content revision
- Affects: M01-W05/M01-W07 test infrastructure;
  `packages/contracts/test/contract/infrastructure.test.ts` (two sites),
  `packages/contracts/test/generated/error-taxonomy.test.ts`,
  `packages/contracts/test/generated/generator.test.ts`; required Windows CI
- Description: four tests spawn an external child process into a temporary
  directory and then remove that directory with
  `rmSync(root, { recursive: true, force: true })` in a `finally` block.
  Windows releases the file handles a just-exited child held asynchronously, so
  an immediate recursive remove can still fail with `EPERM` or `EBUSY` even
  though `force: true` is set — `force` suppresses "missing path" errors, not
  "still locked" errors. The failure is in cleanup, not in the assertion the
  test makes, so a passing test can still fail its file. This is a latent
  portability defect that predates the KI-0025 repair; the `cargo build` site
  is the heaviest external writer and is the one that fired.
- Reproduction: run 30381703907 at
  `860b6e1e27a790668b7dec4fe8014c9f764106be` failed `windows-2025` job
  90350860361 while `macos-15` job 90350860390 and `ubuntu-24.04` job
  90350860310 both passed. The inspected Windows log shows
  `test/contract/infrastructure.test.ts > a Rust adapter that does not compile
  fails the subprocess boundary` reporting
  `Error: EPERM, Permission denied: ...\Temp\japp-rust-negative-qqSFs0` raised
  at `infrastructure.test.ts:157`, which is the `rmSync` line inside `finally`
  — the `toThrow(ADAPTER_EXIT_NONZERO)` assertion two lines above had already
  passed. `Tests 1 failed | 1469 passed (1470)`.
- Workaround: none accepted. The test was not labelled flaky, no assertion was
  weakened, and no timeout was raised: the 30016 ms the step reported is the
  real `cargo build` duration inside a 45 s budget, not a timeout.
- Resolution + evidence link: all four cleanup sites now pass Node's
  documented `maxRetries: 10, retryDelay: 100` options, which exist precisely
  to retry `EBUSY`/`EMFILE`/`ENFILE`/`ENOTEMPTY`/`EPERM` on a recursive remove
  with linear backoff. The removal must still succeed, so the fail-closed
  behaviour is unchanged. The three sites that did not fire were repaired
  together with the one that did, because they are the same latent defect and
  fixing only the reported instance is the mistake KI-0024 and KI-0025 were
  about. Evidence: docs/TEST_EVIDENCE.md § M01-W07 corrective repair —
  KI-0025.

### KI-0023 — Secret-store STATUS structural/semantic truth table was incomplete

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-28 during independent post-closeout review of M01-W07
- Affects: M01-W07; `packages/contracts/schemas/platform/vocabulary.v1.schema.json`
  `$defs.secretResultState`; `packages/contracts/generator/semantic-rules.ts`
  `platformSecretResultIntegrity`; generated TypeScript/Python semantic
  evaluators; representative Rust harness; secret-store-result corpus coverage
- Description: despite green cross-language CI at the first M01-W07 content
  revision, the secret-store STATUS contract was incoherent. The semantic
  evaluator's successful STATUS branch required `result_state ==
  STORE_AVAILABLE`, but that token was absent from the structural
  `secretResultState` enum, so a valid availability probe was structurally
  impossible. The same STATUS early-return also accepted contradictory
  `STORE_UNAVAILABLE` and `DENIED_PERMISSION` results with
  `store_availability == AVAILABLE` and empty reasons, bypassing the
  stricter general DENIED_PERMISSION availability/reason binding.
- Reproduction: at starting revision
  `83f3f0d8add1579b041fe96d9259afc673b7da1a`, construct three STATUS results
  over `urn:japp:schema:platform:secret-store-result:v1`:
  (A) `STORE_AVAILABLE` + `AVAILABLE` + identity + no material/reasons —
  structural validation rejects the missing enum token while the direct
  semantic evaluator accepts; (B) `STORE_UNAVAILABLE` + `AVAILABLE` + empty
  reasons — structural and semantic both incorrectly accept; (C)
  `DENIED_PERMISSION` + `AVAILABLE` + empty reasons — structural and
  semantic both incorrectly accept. Confirmed in TypeScript and Python;
  Rust mirrors the same STATUS early-return.
- Workaround: none accepted; consumers must not infer store availability
  from an incomplete STATUS truth table.
- Resolution + evidence link: added structural `STORE_AVAILABLE`, MINOR-bumped
  vocabulary and secret-store-result to `1.1.0`, repaired the three reproduced
  STATUS branches across TS/Python/Rust, extended the corpus 363→382, and added
  focused STATUS truth-table/token checks. KI-0024 subsequently completed the
  full STATUS/GET/PUT/DELETE table and platform token-closure coverage; KI-0031
  later invalidated the same-major compatibility conclusion, not these
  revision-specific repairs.
  Corrective content commit `12e4062896c8c5b92d5affaf8b0583be0090fb39` /
  tree `3fec30f644090aa81b1ce81bd800e92c1628b3c5` passed two clean clones and
  hosted run 30326330566 (macos-15 90172431543, ubuntu-24.04 90172431557,
  windows-2025 90172431467). Subsequent stamp final-HEAD Windows Vitest
  timeout follow-ups were repaired without changing assertions; the final
  hosted-green content revision is `dd0cd4b65976bf2795ccd806d021db8f9c265823`
  / tree `f7b5bdf4596459f7c9797d124401375bb0df7341` (run 30329608764).
  Evidence: docs/TEST_EVIDENCE.md § M01-W07.

### KI-0021 — Authorization trusted live validated objects across policy use

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-27 during M01-W04 independent package validation
- Affects: M01-W04; generated TypeScript/Python security-policy
  authorizers; the strict canonical Ajv validator
- Description: the initial TypeScript authorizer validated the caller's
  object and then read from that same live object during policy evaluation.
  An enumerable accessor or adversarial Proxy could therefore return safe
  metadata while Ajv validated it and different metadata during later
  command/row lookup, creating time-of-check/time-of-use authorization
  drift; descriptor traps could also escape as exceptions. The initial
  Python authorizer passed an already-created Pydantic request instance
  directly back to `model_validate`; Pydantic may accept an instance without
  revalidating fields mutated after construction, so the nominal model type
  was not proof that its current data still satisfied the wire contract.
- Reproduction: against the pre-fix M01-W04 working tree, create an
  otherwise valid `PAGE_REPORT_STATE` request whose enumerable `command_id`
  getter returns the safe command for its early reads and
  `PRIVATE_DATA_READ_REQUEST` on a later read, or wrap the request in a Proxy
  whose descriptor enumeration traps; call `authorizeCommandRequestV1` and
  observe that validation and policy use consult the adversarial live
  object. In Python, construct a valid
  `SecurityAuthorizationRequestV1`, mutate `payload_size_bytes` to `-1`,
  `-1.5`, `True`, or an unsafe integer (or mutate `command_id` to
  `__proto__`), then pass the instance to `authorize_command_request_v1`;
  the initial implementation did not force a fresh strict validation of
  the mutated values.
- Workaround: none accepted; authorization boundaries must not rely on
  caller discipline or mutable nominal types.
- Resolution + evidence link: TypeScript now rejects non-plain objects and
  takes one frozen null-prototype snapshot using own enumerable data
  descriptors before schema validation or policy use; accessors, symbols,
  non-enumerable members, inherited metadata, and trapping Proxies fail
  closed as `TRANSPORT_MALFORMED_MESSAGE`. Ajv additionally uses
  `ownProperties: true`. Python dumps model input to a fresh canonical
  Python record with `exclude_unset=True` and `warnings="error"`, then
  strictly revalidates that record before policy use. Regression tests cover
  the original accessor/Proxy case, inherited/hostile properties, a valid
  model, each mutated-model case, no hostile-value echo, and TypeScript/
  Python outcome parity. The focused suites, full verifier, and clean-clone
  simulation pass. Evidence: docs/TEST_EVIDENCE.md § M01-W04.

### KI-0020 — Retry/transience equivalence was enforced in only one direction

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-27 during the M01-W03 post-verification review
- Affects: M01-W03; `packages/contracts/generator/error-catalog.ts`;
  `packages/contracts/catalog/error-catalog.v1.json`; generated TypeScript
  and Python error catalogs; error-taxonomy regression tests
- Description: the taxonomy defines `SAFE_RETRY` as a transient condition
  whose same operation may be repeated without user involvement, and the
  M01-W03 evidence claimed `transient` if and only if `SAFE_RETRY`.
  The canonical catalog validator and both language-surface tests enforced
  only `transient=true` implies `SAFE_RETRY`. Consequently,
  `MODEL_MALFORMED_OUTPUT` and `MODEL_VALIDATION_FAILED` were committed as
  `SAFE_RETRY` with `transient=false`, contradicting the documented
  semantics.
- Reproduction: at starting revision
  `b21c098e306b89da4ac4d503882a42b8be83c6e0`, compare every canonical
  entry's `transient` value with
  `(retry_disposition == "SAFE_RETRY")`; exactly the two MODEL entries above
  differ. Before repair, tampering a non-`SAFE_RETRY` entry to
  `transient=true` was rejected, but tampering any `SAFE_RETRY` entry to
  `transient=false` passed the incomplete family-invariant branch.
- Workaround: none accepted; consumers must not infer retry policy from an
  internally contradictory catalog.
- Resolution + evidence link: the validator now enforces the exact
  bidirectional equality with distinct fail-closed violations.
  `MODEL_MALFORMED_OUTPUT` is intentionally `SAFE_RETRY`/transient;
  `MODEL_VALIDATION_FAILED` is non-transient
  `RETRY_AFTER_REMEDIATION`; every MODEL message explicitly preserves
  accepted deterministic results. Both generated catalogs and MANIFEST were
  regenerated, and tests cover each invalid direction, canonical/generated
  equality, reviewed semantics, preservation wording, repeatability,
  read-only check mode, KI-0018 rollback, and control bytes. Local
  verification, the clean-clone simulation, and repair run 30246548320
  passed; the actual Windows log was inspected. Evidence:
  docs/TEST_EVIDENCE.md § M01-W03, corrective-closeout subsection.

### KI-0019 — Status exactness negative inherited the pre-M01-W03 premise

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-27 during M01-W03 package validation
- Affects: M01-W03; `scripts/tests/test_validate_status.py`
  (`test_current_work_package_must_be_exact_none_or_blocked_id`);
  `pnpm verify`
- Description: the exactness negative reset M00-W10, M01-W01, and M01-W02
  before injecting a malformed current-package value, but did not reset
  M01-W03; once M01-W03 legitimately became IN_PROGRESS, the inherited row
  diverted the validator to the current-package-mismatch error instead of
  the asserted exactness error. A single recurrence of the
  KI-0014/KI-0015/KI-0016/KI-0017 premise-inheritance class.
- Reproduction: mark M01-W03 IN_PROGRESS and run
  `uv run pytest scripts/tests`; exactly this fixture assertion failed
  (491 passed) while the real validators correctly passed.
- Workaround: none accepted; boundary fixtures must establish their own
  complete premise in every legitimate live repository state.
- Resolution + evidence link: the negative now resets every M01 row
  through M01-W04, and both M00-closeout boundary helpers
  (`prepare_m00_closeout`, `prepare_valid_m00_closeout`) were generalized
  to reset every M01 row through M01-W05 so the upcoming M01-W03/M01-W04
  stamp boundaries cannot re-trigger the class. The scripts suite passes
  492/492 in the M01-W03 IN_PROGRESS state. Evidence:
  docs/TEST_EVIDENCE.md § M01-W03.

### KI-0018 — Generated-tree replacement was not rollback-safe; tracked source carried literal control bytes

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-27 during the M01-W02 post-verification review
- Affects: M01-W02; `packages/contracts/generator/fsops.ts`
  (`installGeneratedTree`), `packages/contracts/generator/cli.ts`,
  `packages/contracts/README.md` §10a wording,
  `packages/contracts/test/generated/generator.test.ts`
- Description: two distinct defects. (1) Write-mode installation deleted
  the existing `generated/` tree before renaming the staging tree into
  place; a rename failure after that deletion (Windows file lock,
  permission failure, interruption) would leave NO usable generated tree,
  and the cleanup block then removed staging as well. Documentation also
  overstated the guarantee as a single atomic rename. (2) The tracked
  generator test module contained literal control bytes — a raw NUL used
  as a join separator, plus a raw BEL and an invisible U+2028 inside an
  adversarial fixture string — weakening source reviewability (invisible
  bytes in review diffs) even though the runtime values were legitimate
  test inputs.
- Reproduction: (1) inject a failure into the staging→generatedRoot rename
  after the old tree was removed (deterministically reproduced through the
  new InstallFsOps seam): the previous implementation ended with no
  generated tree on disk. (2) `python3` byte-scan of
  `packages/contracts/test/generated/generator.test.ts` at
  `efd41b22b311d12055e072814bf647057fbca440` reports a 0x00 byte on line
  132 and a 0x07 byte on line 453.
- Workaround: none accepted; regeneration after a failed install would
  rebuild the tree, but a failure window with no valid tree (and possibly
  no working generator environment) is not an acceptable resting state.
- Resolution + evidence link: `installGeneratedTree` now performs a
  transactional, rollback-safe replacement — the new tree is materialized
  and byte-verified in a unique sibling staging directory before the
  existing tree is touched; the existing tree is renamed to a unique
  sibling backup (never deleted first); the verified staging tree is
  renamed into place; the backup is removed only after success; an
  installation failure automatically restores the backup; a rollback
  failure deletes nothing and reports every surviving directory plus the
  manual recovery action; documentation now states the guarantee honestly
  (transactional/rollback-safe, not atomic). Eleven deterministic
  failure-injection tests cover every protocol step through the
  injectable `InstallFsOps` seam
  (`packages/contracts/test/generated/fsops-install.test.ts`). The
  control bytes are replaced with escaped source representations
  (`\u0000` join separator; `\u0007`/`\u2028` in the adversarial
  fixture — identical runtime values), `pythonStringLiteral` additionally
  escapes U+2028/U+2029 in emitted Python, and regression sweeps ban raw
  C0 bytes (except tab/LF/CR) across every tracked
  TypeScript/Python/JSON/Markdown/TOML/YAML/JavaScript file while
  explicitly allowing escaped representations
  (`scripts/tests/test_integrity.py`). Generated outputs remain
  byte-identical (35 files). Evidence: docs/TEST_EVIDENCE.md § M01-W02
  (corrective closeout subsection).

### KI-0017 — Boundary fixtures inherited the pre-M01-W02 premises

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-27 during M01-W02 package validation (four fixtures)
  and the M01-W02 revision-stamp validation (the two M00-closeout helpers)
- Affects: M01-W02; `scripts/tests/test_suite_states.py`
  (`test_real_registry_loads_and_states_match_project_state`),
  `scripts/tests/test_ci_workflow.py`
  (`test_contract_gen_required_missing_once_owner_begins`,
  `test_contract_gen_explanation_documents_drift_vs_compat`),
  `scripts/tests/test_doctor.py` (`doctor_repo` fixture),
  `scripts/tests/test_validate_status.py`
  (`test_current_work_package_must_be_exact_none_or_blocked_id`,
  `prepare_m00_closeout`), `scripts/tests/test_traceability.py`
  (`prepare_valid_m00_closeout`); `pnpm verify`
- Description: once M01-W02 legitimately became IN_PROGRESS and the real
  generator landed at `scripts/generate-contracts.ts`, four fixtures that
  had inherited the pre-M01-W02 premise failed: the live-registry test
  asserted an ACTIVE suite set without contract-gen; the REQUIRED_MISSING
  negative derived discovery against the real repository, which now
  contains the generator; the explanation assertion pinned the retired
  NOT_YET_APPLICABLE wording; the doctor's healthy fixture repo lacked the
  generator file, so its simulated environment reported
  suite-contract-gen REQUIRED_MISSING; and the status exactness negative
  left the inherited M01-W02 IN_PROGRESS row in place. When the stamp then
  legitimately marked M01-W02 VERIFIED and M01-W03 READY, the two
  M00-closeout boundary helpers (which reset only M01-W01/M01-W02)
  additionally inherited the live M01-W03 READY row, breaking seven
  closeout-boundary assertions. Same premise-inheritance class as
  KI-0014/KI-0015/KI-0016.
- Reproduction: mark M01-W02 IN_PROGRESS with the generator present and run
  `uv run pytest`; 4 fixture assertions failed (448 passed) while the real
  validators and suites correctly passed. Then mark M01-W02 VERIFIED with
  M01-W03 READY and run `uv run pytest scripts/tests`; 7 closeout-boundary
  assertions failed (445 passed).
- Workaround: none accepted; boundary fixtures must establish their own
  complete premise in every legitimate live repository state.
- Resolution + evidence link: the live-registry expectation now includes
  the permanently ACTIVE contract-gen suite; the REQUIRED_MISSING negative
  isolates an empty fixture repo (and a new positive proves ACTIVE
  derivation with the real generator across started states); the
  explanation assertions track the accurate ACTIVE-state wording; the
  doctor fixture carries `scripts/generate-contracts.ts`; the exactness
  negative resets M01-W02 alongside the other rows; and both M00-closeout
  helpers now reset every advanceable M01 row (M01-W01 through M01-W03) so
  their boundary premises stay isolated at future package boundaries. The
  scripts suite passes 452/452 in the stamped state and complete
  `pnpm verify` passes with contract-gen ACTIVE and PASS. Evidence:
  docs/TEST_EVIDENCE.md § M01-W02.

### KI-0016 — M00-closeout fixture helpers inherited pre-M01 boundary rows

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during the M01-W01 revision-stamp validation
- Affects: M01-W01; `scripts/tests/test_validate_status.py`
  (`prepare_m00_closeout`), `scripts/tests/test_traceability.py`
  (`prepare_valid_m00_closeout`), `scripts/tests/test_ci_workflow.py`
  (`test_contract_gen_not_yet_applicable_before_owner_begins`); `pnpm verify`
- Description: the M00-closeout boundary helpers were written while the live
  repository sat exactly at that boundary. After the M01-W01 closeout
  legitimately marked M01-W01 VERIFIED and M01-W02 READY, the helpers
  inherited those rows: fixtures asserting "M01-W01 is the only READY
  package" saw a second READY row, negatives expecting "no READY row" found
  one, and one CI test asserted the live M01-W02 row was literally
  NOT_STARTED. Eight tests failed; same premise-inheritance class as
  KI-0014/KI-0015.
- Reproduction: mark M01-W01 VERIFIED and M01-W02 READY in
  docs/PROJECT_STATUS.md and docs/traceability.json, then run
  `uv run pytest scripts/tests`; 8 fixture assertions failed while the real
  validators correctly passed.
- Workaround: none accepted; boundary fixtures must establish their own
  complete premise in every legitimate live repository state.
- Resolution + evidence link: both closeout helpers now explicitly reset
  M01-W02 to NOT_STARTED alongside the flagged M01-W01 state, and the
  contract-gen suite test derives its state for both not-begun premises
  (NOT_STARTED and READY) instead of asserting the live row. The scripts
  suite passes 359/359 and complete `pnpm verify` passes in the stamped
  M01-W01 VERIFIED / M01-W02 READY state. Evidence:
  docs/TEST_EVIDENCE.md § M01-W01.

### KI-0015 — Current-package exactness negative inherited the pre-M01 idle state

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during M01-W01 package validation
- Affects: M01-W01; `scripts/tests/test_validate_status.py`; `pnpm verify`
- Description: `test_current_work_package_must_be_exact_none_or_blocked_id`
  assumed no work package was IN_PROGRESS in the repository state it copied.
  Once M01-W01 was validly marked IN_PROGRESS, the fixture set M00-W10 to
  NOT_STARTED and `Current work package: garbage` but left the inherited
  M01-W01 IN_PROGRESS row, so the validator correctly reported the
  current-package-mismatch error instead of the asserted
  "must be NONE or a BLOCKED package" exactness error. Same class as
  KI-0014: a negative test premise inherited from live repository state.
- Reproduction: with M01-W01 IN_PROGRESS in docs/PROJECT_STATUS.md, run
  `uv run pytest scripts/tests/test_validate_status.py`; only this fixture
  assertion failed (359/360 passed).
- Workaround: none accepted; the negative must establish its own complete
  premise and pass in both the idle and the package-in-progress repository
  states.
- Resolution + evidence link: the test now explicitly sets M01-W01 to
  NOT_STARTED alongside M00-W10 before injecting the malformed current
  package, so no IN_PROGRESS row survives in the fixture regardless of live
  state. The status suite passes 90/90 and complete `pnpm verify` passes in
  the M01-W01 IN_PROGRESS state. Evidence: docs/TEST_EVIDENCE.md § M01-W01.

### KI-0014 — One status negative inherited the post-M00 READY row

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during M00-W10 acceptance-only closeout validation
- Affects: M00-W10; `scripts/tests/test_validate_status.py`;
  `pnpm verify`
- Description: `test_next_ready_none_must_be_exact` assumed the repository's
  pre-closeout state. After M00 was validly accepted and M01-W01 became the
  sole READY row, the test changed M00-W10 to NOT_STARTED and injected
  malformed `NONE nonsense` but did not remove M01-W01 readiness. The
  asserted no-READY premise was no longer isolated.
- Reproduction: apply the valid accepted-M00 closeout state and run
  `pnpm verify`; status validation itself passes, but the Python suite reports
  only this fixture assertion failed (357/358 passed).
- Workaround: none accepted; the negative must establish its own complete
  premise and pass in both pre-closeout and post-closeout repository states.
- Resolution + evidence link: the test now uses
  `prepare_m00_closeout(..., m01_ready=False)` before injecting the malformed
  next-ready value. The status suite passes 90/90 and complete local
  `pnpm verify` passes 358/358 Python tests in the accepted-M00 state.
  Content repair run 30231197511 passed Ubuntu job 89870307756, Windows job
  89870307759, and macOS job 89870307817; the inspected Windows log confirms
  exact commit `ef830d91e7a6bffe3c74825b98405ce379cc7187`, aggregate verification
  exit 0, and no tracked changes. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0013 — Doctor redaction tests encoded host-specific path rendering

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-26 during M00-W10 hosted content verification
- Affects: M00-W10; `scripts/doctor.py`; `scripts/tests/test_doctor.py`;
  required `windows-2025` CI
- Description: the redaction implementation passed its Windows native,
  forward-slash, mixed-case, UNC, and boundary cases, but two new tests
  encoded the test host's separator semantics. On Windows,
  `Path("/Users/Fixture User")` becomes a Windows-style path and therefore
  no longer represents the simulated POSIX input; a fatal-path assertion
  likewise required `/` even though the correctly redacted Windows
  diagnostic used `\`. The first repair derived the native separator but
  did not account for `FileNotFoundError` escaping that separator when it
  renders the missing filename.
- Reproduction: M00-W10 content run 30229993787, Windows job 89866914158,
  collected 358 Python tests and failed only
  `test_scrub_keeps_posix_case_sensitive_and_component_bounded` and
  `test_pin_read_fatal_output_scrubs_home`; macOS job 89866914146 and Ubuntu
  job 89866914187 passed. Repair run 30230286865 then passed macOS job
  89867742632 and Ubuntu job 89867742629, but Windows job 89867742638
  reported 357/358 Python tests passed: the remaining failure was solely the
  escaped-backslash rendering in `test_pin_read_fatal_output_scrubs_home`.
- Workaround: none accepted; required tests had to be host-neutral and pass
  on the actual Windows runner before M00 acceptance.
- Resolution + evidence link: `_scrub` accepts an explicit path string for
  syntax-preserving simulation, the POSIX test uses that form, and the
  fatal-path expectation derives the host-native separator with `Path` and
  normalizes only duplicated backslashes in the exception-rendered text
  before asserting both that the redacted path remains and that the sensitive
  home is absent. Content run 30230657314 passed macOS job 89869050876,
  Windows job 89869050915, and Ubuntu job 89869050931. The inspected Windows
  log confirms exact revision `a26f9a8f58ab2d63a377cd8f1839a83495f00272`,
  358/358 Python tests, canonical verification exit 0, and no tracked changes.
  Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0007 — Provisional v1.3 traceability could be self-rehashed after mapping drift

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W10; `docs/traceability.json`;
  `scripts/traceability.py`; REQ-PLAT-011; REQ-GATE-017; REQ-GATE-022
- Description: the W08 migration deliberately left 22 requirements and 26
  packages in `PROVISIONAL_PENDING_M00_W10`. Its validator recomputed the
  expanded hashes from the same mutable JSON and compared them only with hash
  values stored in that JSON. An editor could change a new mapping or
  dependency and refresh its companion hash without an independently pinned
  final review baseline. Several future-package proof plans were also generic
  rather than package-specific, and REQ-PLAT-013 understated the already
  verified W09 three-OS infrastructure.
- Reproduction: in an isolated W08/W09 fixture, change a new requirement
  owner or new package dependency and update the corresponding JSON hash; the
  provisional validator accepted the internally consistent edit.
- Workaround: none accepted; review labels or self-declared hashes are not
  evidence.
- Resolution + evidence link: M00-W10 audited every new record against the
  canonical specification and repository, assigned `REVIEWED_V1_3`, retained
  all legacy `REVIEWED_V1_2` records and hashes, pinned independent final
  expanded hashes in the validator, and made proof plans package-specific.
  The expanded requirement hash covers the reviewed mapping plus the audited
  implementation/verification state, completed code/test paths, current
  evidence, and honesty notes. The expanded package hash covers dependencies,
  primary deliverables, and required automated/manual proof plans while
  deliberately excluding live state, revision, and current evidence. Isolated
  self-rehash tests reject mapping, dependency, proof-plan, and completed
  governance-evidence substitutions; deterministic JSON/Markdown agreement
  tests remain mandatory. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0008 — v1.3 migration generalized historical governance facts

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W10; `CLAUDE.md`; ADR-0001; OD-020; `pyproject.toml`
- Description: generic bootstrap sentences named Claude instead of the
  implementation agent; the v1.3 migration had generalized parts of
  ADR-0001/OD-020 that were historical v1.2 facts; and the PyYAML dependency
  comment still said it was used only by `test_ci_workflow.py` after
  `scripts/check_portability.py` became a production consumer.
- Reproduction: compare `CLAUDE.md`, ADR-0001, OD-020, and the PyYAML comment
  at the W09 head with pre-v1.3 revision
  `0f8059c97d1167d6bb34413bae5c1c3c44b1ae37`.
- Workaround: reconstructing the distinction from Git history is possible
  but is not acceptable project memory.
- Resolution + evidence link: M00-W10 made generic workflow wording
  agent-neutral, restored the exact historical v1.2 ADR/owner-decision facts,
  kept ADR-0002/OD-026 as the explicit prospective supersession, and
  corrected the PyYAML production-dependency comment. Tests lock the
  historical and prospective wording. Evidence: docs/TEST_EVIDENCE.md §
  M00-W10.

### KI-0009 — Windows home redaction was case-sensitive and separator-specific

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W09/M00-W10; `scripts/doctor.py`; REQ-PLAT-013
- Description: diagnostic redaction recognized the configured Windows home
  spelling but did not reliably redact native and forward-slash variants
  when drive, directory, or username casing differed. That could leak a home
  path in otherwise sanitized diagnostics. It also lacked a leading boundary,
  so unrelated text immediately prefixed to a path could be over-redacted,
  and the missing-repository/pin-read fatal paths printed unsanitized values.
- Reproduction: configure `C:\Users\ExampleUser` and scrub diagnostic text
  containing `c:/users/exampleuser/...` or mixed-case component variants;
  the W09 implementation did not replace every equivalent Windows spelling.
- Workaround: none accepted for emitted diagnostics.
- Resolution + evidence link: M00-W10 added Windows-aware,
  separator-flexible, case-insensitive leading/trailing component-boundary
  matching while retaining case-sensitive POSIX behavior. Early fatal
  repository and pin-read output is scrubbed through the same implementation.
  Direct mixed-case, slash-form, UNC, boundary, unrelated-prefix, fatal-path,
  and negative tests pass. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0010 — Portability policy accepted disconnected CI matrices and scanned inert prose

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W09/M00-W10; `scripts/check_portability.py`;
  `.github/workflows/ci.yml`; REQ-PLAT-013; REQ-PLAT-025
- Description: matrix-runner and canonical-command checks were not fully
  relational, so a dummy supported matrix in one job and commands in another
  could satisfy separate predicates. Runtime source docstrings and harmless
  workflow comments could also trigger banned-runtime, masking,
  `continue-on-error`, or live-site findings even though they were inert.
  Adversarial review also found that matrix exclusions/extra axes/job guards,
  composite Windows conditions, several child-failure masking forms,
  PowerShell block comments, embedded runtime POSIX paths, and separator
  aliases were not handled fail-closed.
- Reproduction: in isolated fixtures, split the required matrix from the job
  containing `pnpm run doctor` / `pnpm verify`, guard the Windows command, or
  add banned wording only to a Python docstring or YAML comment. The prior
  policy either accepted the disconnected executable structure or rejected
  inert prose.
- Workaround: manual workflow inspection was required and was not
  fail-closed.
- Resolution + evidence link: M00-W10 requires exactly one canonical job
  whose matrix is exactly `macos-15`, `windows-2025`, and `ubuntu-24.04`,
  whose `runs-on` derives from `matrix.os`, and whose unguarded executable
  steps contain both exact canonical commands. The matrix forbids
  include/exclude, extra axes, and a job guard; Windows reachability uses an
  exact fail-closed condition policy; `||` fallback, trailing unconditional
  success, and swallowed PowerShell catches fail. Parsed YAML and executable
  shell values remain enforced, including embedded runtime paths and
  separator aliases, while module/class/function docstrings, type metadata,
  YAML comments, and PowerShell block comments are excluded. Positive and
  negative relational, comment, docstring/type, masking, banned-token, and
  guarded-command tests pass; the valid workflow itself did not need to
  change. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0011 — Gate D accepted nonempty placeholder evidence

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W10; `scripts/validate_status.py`; CROSS_PLATFORM_CORE;
  REQ-GATE-020; REQ-GATE-022
- Description: future Gate D `PASS` checks required nonempty profile,
  certified-matrix, and report fields, but arbitrary placeholder prose could
  satisfy those presence checks without any repository evidence record or
  file. A real but irrelevant repository document, duplicate contradictory
  platform row, stale `NOT_YET_IMPLEMENTED` support register, rejected owner
  decision, failed holdout, placeholder metric, or PASS record with
  inconsistent report/ledger metadata could also evade the earlier presence
  checks.
- Reproduction: in an isolated future-state fixture, enter unrelated
  nonempty text in the Gate D evidence bundle, all model-profile evidence
  cells, and all matrix native-evidence cells; the prior validator treated
  the fields as present.
- Workaround: independent human inspection was required and was not
  fail-closed.
- Resolution + evidence link: M00-W10 permits only scoped references to the
  relevant package heading in `docs/TEST_EVIDENCE.md`, a Gate D holdout-log
  heading, or dedicated `docs/gates/evidence/` artifacts. It rejects
  placeholders, irrelevant/arbitrary files, URLs, absolute paths, traversal,
  symlink escape, missing files/headings, and duplicate rows. Gate D PASS also
  requires M27-W12 to own the terminal decision; exact three-way PASS
  revision/hash/reviewer/decision/holdout agreement; non-placeholder measured
  rows with zero zero-tolerance failures; `CERTIFIED_FULL` platform/profile
  rows; and `VERIFIED` native-messaging plus packaging/update rows with scoped
  evidence. Gate D still remains `NOT_EVALUATED`, and no fake product evidence
  was added. Direct positive and negative reference, relevance, metadata,
  state, duplicate-row, metric, and decision-owner tests pass. Evidence:
  docs/TEST_EVIDENCE.md § M00-W10.

### KI-0012 — M00 closeout and next-work status checks admitted inconsistent states

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-26 during M00-W10
- Affects: M00-W10; `scripts/validate_status.py`; M00/M01 readiness;
  REQ-GATE-017; REQ-GATE-018; REQ-GATE-022
- Description: milestone M00 could be marked accepted without requiring each
  M00-W01…W10 row to be exactly `VERIFIED`; `Next READY package: NONE` could
  coexist with a READY row; arbitrary overall-release values were not
  rejected; and a gate could enter evaluation while M00 remained unfinished.
  M00 could also be accepted while every M01 package stayed NOT_STARTED;
  arbitrary current/next/milestone header text, wrong gate-report cells,
  report/ledger state disagreement, premature evaluation packages, and
  rewritable W08/W09 revision anchors were not all rejected.
- Reproduction: mutate isolated status fixtures to use `ACCEPTED` for an M00
  package, leave W10 not verified, declare NONE while M01-W01 is READY, set
  an unknown release state, or start a gate before M00 acceptance. The prior
  validator did not reject every case.
- Workaround: manual ledger comparison was required and was not
  fail-closed.
- Resolution + evidence link: M00-W10 requires all ten M00 packages to be
  exactly `VERIFIED` before M00 acceptance, requires W10 verification and
  M00 acceptance before M01-W01 readiness, and requires a valid closeout to
  make M01/M01-W01 READY with M01-W01 as the sole READY package. It derives
  exact `NONE` from an empty READY set, ties Current milestone/work package to
  actual current/next work, locks the pre-release value to `NOT_READY`,
  preserves exact W01…W09 revisions/evidence, checks canonical gate-report
  paths and report/ledger/status state agreement, keeps every gate
  `NOT_EVALUATED` through the closeout boundary, and ties later IN_PROGRESS or
  terminal gate states to their evaluation/decision packages. Direct
  closeout, anchor, header, state-agreement, sequencing, and false-next-work
  tests pass. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

### KI-0005 — Reused GitHub macOS rustup state conflicts while installing Clippy

- Severity: HIGH
- State: FIXED
- Discovered: 2026-07-26 during the current-HEAD hosted verification of
  M00-W06
- Affects: M00-W06 (`.github/workflows/ci.yml`; required macOS hosted CI)
- Description: GitHub Actions run 30217235083 at
  f9ec7926d3ff04e0cc427481a5c0a965f0578f4e failed required macOS job
  89833453976 in `Install pinned Rust toolchain`. rustup explicitly reported
  `recovering from a partially installed toolchain`, rolled back, and failed
  with `failed to install component:
  'clippy-preview-aarch64-apple-darwin', detected conflict:
  'bin/cargo-clippy'`. The workflow inherited the hosted runner's default
  rustup state, so installation was not hermetic even though Rust itself was
  exactly pinned. Linux job 89833453996 succeeded; the local verification
  suite also passed.
- Reproduction: `gh run view 30217235083 --job 89833453976 --log-failed`
  shows the partial-install recovery followed by the exact `cargo-clippy`
  conflict and exit 1.
- Workaround: none accepted. Retrying the same contaminated toolchain state
  does not correct the deterministic state conflict, so unconditional retries
  were rejected.
- Resolution + evidence link: M00-W06 repair commit
  124418f3a34389c4c56dced60a9fff9a5947adc4 isolates each matrix job's
  `RUSTUP_HOME` under that job's `runner.temp`, persists the same clean home
  for later Rust checks, leaves Cargo dependency caches separate, and adds
  static regressions. Hosted run 30218333122 passed macOS job 89836260053
  and Linux job 89836260044; the macOS log confirms the isolated
  `/Users/runner/work/_temp/rustup-home`, exact Rust 1.97.1 toolchain, rustfmt,
  Clippy, trusted rustup proxies, and canonical verification. The conventional
  stamp-commit HEAD must also pass both hosted jobs before M00-W07 begins.
  Evidence: docs/TEST_EVIDENCE.md § M00-W06.

## Deferred risks and parked ideas

### KI-0063 — Pages with more than 512 supported controls truncate the descriptor inventory without an overflow marker

W13 follow-up,2026-09-30: reproduced and treated as PACKAGE_BLOCKER for measurement completeness. The uncommitted W13 draft adds explicit local CAPACITY_EXCEEDED refusal and no canonical inventory, including recovery proof in KI-0072. Production scaling/pagination remains deferred; this historical entry and its original W11 classification are preserved. The later owner-authorized rescue closes KI-0070 locally; W13 remains IN_PROGRESS pending full closeout.

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-08-24 during the M02-W11 same-package internal adversarial
  gauntlet (verifier family G/K byte audit)
- Affects: `apps/extension/src/field-scanner.ts` (`MAX_DESCRIPTORS_PER_FRAME`
  slice), `apps/extension/src/scanner-protocol.ts` (`MAX_DESCRIPTORS_PER_FRAME
  = 512`), `packages/contracts/schemas/form/reconciliation-inventory.v1.schema.json`
  (`items` `maxItems: 512`), `apps/extension/src/dynamic-engine.ts`
  (`MAX_INVENTORY_ITEMS`); future owners **M18-W02** (productionize scanner
  and field re-resolution) and **M18-W05** (production decision engine)
- Description: the accepted M02-W08 scanner caps every frame report at 512
  descriptors and the canonical reconciliation-inventory contract carries the
  same 512-item bound, so the M02-W11 dynamic inventory can never observe a
  control the W08 scan never surfaced. On a synthetic page with more than 512
  supported controls, a visible enabled required control beyond the cap would
  be absent from the reconciliation inventory with no explicit overflow
  marker, weakening the "no silent required field" guarantee at that extreme.
  No M02 feasibility fixture approaches the bound (the largest is the 480-row
  virtualized listbox, whose rows are options, not controls), so no current
  contract or test is affected.
- Reproduction: construct a fixture page whose application root contains 513
  labelled required text inputs; the W08 frame report and every W11
  reconciliation inventory contain exactly 512 items and the 513th control is
  not represented.
- Workaround: none needed for M02 feasibility; every fixture stays far below
  the bound.
- Resolution + evidence link: deferred to the production scanner/decision
  engine, which must either raise/paginate the bound or add an explicit
  truncation marker that fails readiness closed. Recorded from
  docs/TEST_EVIDENCE.md § M02-W11 (internal verifier finding, classified
  DOCUMENTED_LIMITATION; the W08 cap itself is accepted prior behavior).

### KI-0026 — Whether an accepted model profile may sit below the performance tier is undecided

- Severity: MEDIUM
- State: DEFERRED
- Discovered: 2026-07-28 during the KI-0025 exhaustive final audit of M01-W07
- Affects: `packages/contracts/generator/semantic-rules.ts`
  `platformModelProfileEvidence` and `platformRuntimeCapabilityFallback`;
  `REQ-PLAT-011`; future owner **M05-W13** (define versioned platform
  model-runtime profiles)
- Description: the committed contract couples acceptance to full AI in two
  places. `platformModelProfileEvidence` requires
  `core_capability_behavior = FULL_AI_AVAILABLE` for any `ACCEPTED` profile,
  and `platformRuntimeCapabilityFallback` requires a non-empty
  `accepted_profile_refs` exactly when the runtime reports
  `FULL_AI_AVAILABLE`. Specification §5.14.6 nevertheless names
  `windows-x64-cpu` and `ubuntu-x64-cpu` as a "functional compatibility
  fallback; no latency promise until measured", and §5.14.1 defines
  `CERTIFIED_CORE` as "AI unavailable **or below performance tier**". Read
  together, those sentences describe a profile that is reviewed and accepted
  yet does not deliver full AI on a given machine — an outcome the current
  coupling cannot express.
- Reproduction: at `44827ae73a04d4ef63ccb40cd93fd14b7e304010`, build
  `w07.model-runtime-profile` with `platform_id = WINDOWS_X64`,
  `profile_token = windows-x64-cpu`, `runtime_family = OLLAMA_GGUF`,
  `accelerator = CPU_ONLY`, `availability = AVAILABLE`,
  `acceptance_state = ACCEPTED`, zero reasons, the four measured evidence
  references, and `core_capability_behavior = CORE_PRESERVED_AI_DEGRADED` —
  structural accept, semantic reject.
- Workaround: none needed today. No profile is accepted on any target, the
  model lock is unchanged, and `CERTIFIED_CORE` deliberately imposes no
  `MODEL_RUNTIME` requirement, so no current or planned evidence depends on
  the distinction.
- Resolution + evidence link: deliberately **not** decided inside the KI-0025
  repair. Answering it is a model-runtime acceptance-policy decision, not a
  contract-shape correction: it changes what "accepted" means for a profile
  and therefore what `CERTIFIED_FULL` promises. M05-W13 owns versioned
  platform model-runtime profiles and must either accept the current coupling
  explicitly or carry an ADR that relaxes it, before any profile is accepted.
  The KI-0025 revision preserves the existing reviewed behavior unchanged.

### KI-0027 — `UNAVAILABLE` process status forbids a start timestamp the supervisor may already hold

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-07-28 during the KI-0025 exhaustive final audit of M01-W07
- Affects: `packages/contracts/generator/semantic-rules.ts`
  `platformProcessStatusIntegrity`; `REQ-PLAT-015`; future owner **M03-W09**
  (implement platform lifecycle, path, and process adapters)
- Description: `processState.UNAVAILABLE` is documented as "the supervisor
  itself could not observe the process", and the rule reads that fail-closed:
  an `UNAVAILABLE` status may carry no `started_at`, `ended_at`, or
  `exit_code`. A supervisor that successfully spawned a child, recorded its
  start, and then lost the handle therefore cannot report the loss while
  retaining the start it did observe; it must either discard a true
  observation or use `FAILED`.
- Reproduction: at `44827ae73a04d4ef63ccb40cd93fd14b7e304010`, build
  `w07.process-status` with `state = UNAVAILABLE`, the fixture `started_at`
  retained, no `ended_at`, no `exit_code`, and one reason — structural accept,
  semantic reject. This is the behaviour asserted by the committed negative
  `x-w07.process-status-unavailable-with-timestamps`.
- Workaround: report the loss as `FAILED` with `started_at` and a finite
  reason, which the KI-0025 truth table admits, or omit the start timestamp.
  Neither loses safety; both lose a little fidelity.
- Resolution + evidence link: deliberately **not** changed inside the KI-0025
  repair. The narrow reading is the fail-closed one, a reviewed corpus
  negative already asserts it, and no reproduced defect requires relaxing it,
  so widening it here would be an unreviewed weakening rather than a
  correction. M03-W09 builds the first real supervisor and must confirm the
  reading against measured `parent death` and `orphan detection` behaviour
  (spec §5.14.4) before the process contract is consumed.

### KI-0001 — No JS/TS `build` task exists in the M00-W02 scaffold (deliberate deferral)

- Severity: LOW
- State: FIXED
- Discovered: 2026-07-26 during M00-W02
- Affects: M00-W02 (scaffold); resolved by the first real build targets —
  under spec v1.2 (adopted in M00-W05) that is M02-W07 (real MV3 feasibility
  extension) and M03-W01 (desktop shell) — and M00-W04 (aggregate
  verification semantics)
- Description: the owner's M00-W02 instructions list build configuration among the
  required configs. The TypeScript workspace intentionally defines no `build`
  task: every TypeScript package in the scaffold is a `noEmit` slot with no
  build output, so a Turborepo `build` task would report success over zero
  implementers — a mocked success state (spec §1.5) contrary to the
  "empty suites must fail" principle assigned to M00-W04. Build coverage
  exists today only where real compilation exists (the native-host crate via
  `cargo build`/`cargo test`). The Turborepo pipeline and per-package script
  slots are in place; the `build` task is added together with the first real
  build target (v1.2: feasibility extension M02-W07, desktop shell M03-W01),
  and M00-W04's aggregate `pnpm verify` must fail on skipped mandatory
  suites.
- Reproduction: `turbo run build` — no such task is defined (by design, this
  errors rather than passing vacuously). No longer reproducible after
  M02-W07.
- Workaround: n/a (nothing exists to build yet).
- Resolution + evidence link: M02-W07 landed the first real JS/TS build
  target, closing the deferral non-vacuously: `turbo.json` defines the
  `build` task, `@japp/extension` implements it with the real WXT Manifest
  V3 build (and `@japp/mock-ats-lab` already declared a real `build`
  script), and the new ACTIVE `build` verification suite runs
  `pnpm exec turbo run build --force` inside `pnpm verify` with a
  `turbo_task_count` proof so a dropped or vacuous build target fails the
  aggregate. The Playwright global setup additionally rebuilds the
  extension before every browser run. Evidence:
  docs/TEST_EVIDENCE.md § M02-W07. The M03-W01 desktop shell later adds its
  own build implementer to the same task without changing these semantics.

### KI-0002 — scripts/validate_status.py predates the strict Python gates (fixed in M00-W05)

- Severity: LOW
- State: FIXED
- Discovered: 2026-07-26 during M00-W04
- Affects: scripts/validate_status.py (M00-W01 deliverable); Python quality
  gates (M00-W03/M00-W04)
- Description: the strict Ruff/mypy coverage added in M00-W03/M00-W04 spanned
  `services/`, `scripts/verify.py`, and `scripts/tests/`, but not
  `scripts/validate_status.py`, which was written stdlib-only in M00-W01
  before the strict gates existed. The gap was parked to avoid touching a
  verified M00-W01 deliverable inside M00-W04's scope.
- Reproduction: (historical) add `scripts/validate_status.py` to
  `[tool.mypy] files` and the ruff command paths — annotation findings
  appeared.
- Workaround: n/a.
- Resolution + evidence link: M00-W05 rewrote the validator for the v1.2
  contract and brought it under the strict gates: it is now listed in
  `[tool.mypy] files`, the Ruff check/format command paths
  (scripts/verification-suites.json, package.json `format`), and is covered
  by the automated pytest suite `scripts/tests/test_validate_status.py`,
  which re-runs the M00-W01 negative-case matrix (invalid enum, two
  IN_PROGRESS, skipped dependency, missing package row) plus the new v1.2
  negative cases. Evidence: docs/TEST_EVIDENCE.md § M00-W05.

### KI-0004 — Ledger gate section without a `- State:` line evaded the agreement check (fixed in M00-W06)

- Severity: LOW
- State: FIXED
- Discovered: 2026-07-26 during the independent M00-W05 audit (AUDIT_PASS
  with this one confirmed LOW defense-in-depth finding)
- Affects: scripts/validate_status.py critical-gate ledger validation
  (M00-W05 deliverable)
- Description: `_parse_ledger_states` returned a partial map, and the
  status/ledger agreement check examined only parsed entries — deleting the
  `- State:` line from one gate section of docs/CRITICAL_GATES.md (while
  keeping the gate name elsewhere in the file) was not rejected. Readiness
  computation was unaffected (gate states used for readiness come from the
  enum-validated PROJECT_STATUS table), so the audit classified it LOW.
- Reproduction: (historical) copy docs/, remove the
  `- State: NOT_EVALUATED` line under `## AUTOFILL_FEASIBILITY`, run
  `python3 scripts/validate_status.py --repo <copy>` → previously exit 0.
- Workaround: n/a.
- Resolution + evidence link: M00-W06 replaced the parser with
  `_parse_ledger_sections` + `_check_ledger_agreement`: every required gate
  must have exactly one `## <GATE>` ledger section containing exactly one
  valid `- State:` line that agrees with the PROJECT_STATUS gates table;
  missing sections, missing state lines, duplicate state lines, invalid
  values, and unknown gate-like sections are all rejected. Regression
  tests: test_ledger_missing_state_line_rejected,
  test_ledger_duplicate_state_line_rejected,
  test_ledger_missing_gate_section_rejected,
  test_ledger_unknown_gate_section_rejected,
  test_ledger_invalid_state_value_rejected in
  scripts/tests/test_validate_status.py. Evidence:
  docs/TEST_EVIDENCE.md § M00-W06.

### KI-0006 — Portability source rules cover Python runtime scripts only (deliberate M00-W09 boundary)

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-07-26 during M00-W09
- Affects: scripts/check_portability.py (PORT-SRC rule family)
- Description: the AST-level portability rules (hard-coded POSIX system
  paths, `shell=True`/Bash wrappers, separator concatenation,
  executable-bit dependence) scan the Python runtime scripts
  (`scripts/*.py`, `services/*/src/**/*.py`) plus package manifests, the
  suite registry, and the workflow — the only executable shared logic that
  exists in M00. TypeScript workspace packages and the Rust crate are
  scaffolds with no runtime logic yet, so equivalent TS/Rust source rules
  would today assert over nothing (a mocked success, spec §1.5). When
  M02+/M17+ introduce real TS/Rust runtime behavior, extend the PORT-SRC
  family (or add eslint/clippy lint equivalents) to those ecosystems
  instead of assuming the Python-only scan is sufficient.
- Future ownership: M02-W07…W11 owns the first real TypeScript autofill
  runtime surface; M03-W09 owns platform lifecycle/discovery adapters; and
  M17-W04 plus M17-W07…W10 own the Rust/native-host runtime and native
  registration/E2E surface. The first affected package must add the
  corresponding ecosystem rule or lint coverage before verification.
- Reproduction: n/a (scope boundary, not a defect).
- Workaround: n/a.
- Resolution + evidence link: the TypeScript rule surface is implemented and
  independently verified in M02-W07; the associated KI-0058 is FIXED. This KI
  remains LOW / DEFERRED for the untouched Rust/native-host surface.
  PORT-SRC-008 discovers executable
  `.ts`, `.tsx`, `.mts`, and `.cts` under the established application/package/
  root-tool runtime globs, excluding declarations and tests, and invokes the
  repository-pinned TypeScript compiler without executing repository source.
  Its bounded primitive evaluator implements the supported JavaScript
  coercions/operators over null, booleans, numbers, and strings; unsupported
  types and expressions remain UNKNOWN. Trusted `node:path.join`/`resolve`
  expressions produce lexical abstract path facts which propagate through const
  aliases into reviewed operational positions. A bounded intra-procedural
  object model tracks the five reviewed child-process option fields from local
  object literals through ordered direct/computed writes and supported control
  flow; possible proved violations remain visible, while alias escape and
  unsupported mutation invalidate state to UNKNOWN.

  Findings require a closed operational sink and proved non-type ESM or bounded
  non-shadowed `.cts` CommonJS provenance. Child-process executable/static argv
  and reviewed option fields, allowlisted filesystem path operands, and the
  closed process path positions are operational; filesystem payload/data/
  encoding/callback positions, `process.stdout.write`, arbitrary calls,
  exports, and unused values/results are not. Exact token boundaries distinguish
  `bash -c`/`bash -lc`/`sh -c` from lookalikes. Comments, JSDoc, type-only
  syntax, descriptive data, unrelated properties, and UNKNOWN dynamics do not
  violate without a proved operational fact; malformed input and helper/
  protocol failures fail closed. Permanent positive, negative, provenance,
  state-ordering, control-flow, token-boundary, and fail-closed coverage is in
  `scripts/tests/test_portability.py`, with evidence in docs/TEST_EVIDENCE.md §
  M02-W07. M17-W04 and M17-W07…W10 still own equivalent Rust/native enforcement
  when real Rust runtime logic lands.

### KI-0003 — Verification-runner hardening backlog (residual, non-blocking)

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-07-26 during M00-W04 (final independent review observations)
- Affects: scripts/verify.py, scripts/verification-suites.json (M00-W04)
- Description: three residual, currently-unexploitable gaps noted by the
  M00-W04 final compliance review, parked instead of scope-creeping the
  package: (a) the bypass-token scan exempts the whole registry file
  (needed because the integrity suite's explanation text legitimately
  mentions the banned token); a future edit could hide a bypass flag inside
  a registry command argv — discovery proofs and the pytest-exit-5 rule
  still backstop this; scope the exemption to explanation fields later.
  (b) `TS_FOCUS_RE` does not cover vitest's `xit`/`xdescribe`/`xtest`
  aliases (skips via those would appear only as skipped counts).
  (c) `BYPASS_SCAN_SUFFIXES` omits `.js` (no tracked `.js` config exists
  today). None is reachable in the current tree; all three are cheap,
  mechanical hardenings for a later M00 or security-hardening pass
  (v1.2: M27).
- Reproduction: see docs/TEST_EVIDENCE.md § M00-W04 (final review
  observations 3–5).
- Workaround: n/a (not currently exploitable; layered checks cover today's
  tree).
- Resolution + evidence link: pending a later hardening package.

### KI-0099 — Node-only R10 tests enter default Playwright discovery

- Severity: MEDIUM
- State: FIXED
- Discovered: 2026-10-18UTC, actual strict clean3c79bd0/tree8c8c095 full validation.
- Affects: default browser test discovery before any browser cases execute; test harness only.
- Description: Playwright default matching imports .test.mjs. The new R10 legacy cleanup Node test imports experimental SourceTextModule and requires a separately bound Node runner, so default discovery throws before W13/default browser execution. This is a test-location/discovery regression; current p95 is null and no new runtime performance conclusion follows.
- Correction: reviewed patch820a340c6a29bdc4819461a3d0d0c1013219065c5a81d53159b4b7602bbaa3c2 adds only a narrow testIgnore for four R10 Node-only modules. All54specfiles/5customproofs/9customconfigs,36R10graph and originalR9 bytes remain unchanged. Proper Node runner executes42PASS/0fail/cancelled/skipped/todo; browser --list discovers all246cases, without execution. Root type/lint/format/diff pass.
- Resolution + evidence link: IN_PROGRESS pending a fresh frozen full validation. docs/evidence/m02-w15-discovery-correction/proof.tar.gz SHA256ef870ded9945f3c8653d85879c571dbe1f3e6a2435ecd00ad6270c952039693b. The failed3c79 run, full source/tool/build endpoints and independent review remain retained. No browser test is removed, rewritten or marked skipped to obtain a pass.
- Current resolution (2026-10-18UTC): Corrected95f5 runs all246 default browser cases in the full local and every native host;19ACTIVE PASS. All54specfiles and4Node-onlyR10source tests remain preserved; properNode42 focused proof remains separate. Original3c79 discovery failure stays historical. Source-bound proof and independent PASS recommendation: docs/evidence/m02-w15-review-95f5; owner Gate A decision remains pending.


### KI-0100 — Temporary-directory aliases suppress the offline comparison CLI entry point

- Severity: MEDIUM
- State: OPEN
- Discovered: 2026-10-18UTC, current R10 reporting after both actors completed once.
- Affects: M02-W15 external comparison coordinator reuse; test/evidence tooling only.
- Description: frozen compare-paired.mjs compares lexical resolve(argv1) with physical import.meta.url. On macOS /tmp aliases /private/tmp, so the coordinator's offline invocation exits0 without running main or creating a worksheet; its required-file check then fails closed. Original pipeline exit1/FileNotFound and all7 neutral source/tool/build endpoints remain retained.
- Reproduction: actual Node24 pure resolver probe gives unequal original entry paths and equal physical entry; current candidate4/legacy4 raw artifacts remain unchanged. No product actor was repeated.
- Workaround: invoke the identical frozen comparator through its physical source path with the same lock/release/inputs and fresh separate output. This actual pure join passes, yields40/40vs28/40exact, and closes independent204raw+5postflight checks.
- Resolution + evidence link: OPEN as a future coordinator reuse precondition: normalize that CLI entry path in any newly reviewed coordinator before another campaign. Current Gate A comparison evidence is independently complete through the separately reviewed join. Do not mutate sealed R9/R10 history or relabel the original pipelinePASS. docs/evidence/m02-w15-review-95f5 preserves the complete failure, separate join and independent scope decision.


## M02 delegated acceptance — 2026-10-18

Gate A PASS and M02 ACCEPTED under OD-037 / ADR-0008 after actual independent validation. Earlier pending-approval prose is historical. KI-0100 remains MEDIUM/OPEN for future harness reuse; original comparison evidence remains complete.
