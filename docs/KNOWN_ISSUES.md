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

None recorded.

## M01-W03 review

M01-W03 introduced the machine-readable error taxonomy: the twelve-family
vocabulary and 80 stable codes (`schemas/error/taxonomy.v1.schema.json`),
the canonical validated per-code metadata catalog
(`catalog/error-catalog.v1.json` + `schemas/error/catalog.v1.schema.json`),
the strict code-only wire record (`schemas/error/record.v1.schema.json`),
narrow generator support for strict booleans and uniform arrays, and the
generated TypeScript/Pydantic catalog-data surfaces with fail-closed
unknown-code lookups. One reproducible defect was discovered and fixed
during package validation (KI-0019 below — a single recurrence of the
KI-0014…KI-0017 boundary-fixture premise-inheritance class, after which
the shared closeout helpers were generalized through the M01-W05
boundary). Deliberate, documented scope boundaries (not defects): the
catalog defines exactly the specification-derived near-term codes (no
speculative inventory, no generic UNKNOWN); tuple arrays, `uniqueItems`,
and `integer` remain fail-closed generator constructs; capability/command
allowlists are M01-W04; cross-language round-trip certification is
M01-W05. No CRITICAL or HIGH issue is open.

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
