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

## Open defects

No CRITICAL/HIGH issue is OPEN or IN_PROGRESS. KI-0029 through KI-0032 are
FIXED by the final M01-W07 corrective content at tree
`51c81bedb909ae7b6d54569abc8b8fb13af1c590`. KI-0022, KI-0026, and KI-0027
remain DEFERRED with named owning packages. KI-0033 through KI-0038 are
FIXED by final M02-W01 content commit
`a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree
`c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`; none reopens M01.

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
- State: DEFERRED
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
  errors rather than passing vacuously).
- Workaround: n/a (nothing exists to build yet).
- Resolution + evidence link: pending the packages above.

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
- Resolution + evidence link: pending those first packages that add real
  TypeScript or Rust runtime logic; no vacuous source scan is added during
  M00-W10.

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
