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

### KI-0013 — Doctor redaction tests encoded host-specific path rendering

- Severity: HIGH
- State: IN_PROGRESS
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
- Workaround: none accepted; required tests must be host-neutral and pass on
  the actual Windows runner.
- Resolution + evidence link: `_scrub` now accepts an explicit path string
  for syntax-preserving simulation, the POSIX test uses that form, and the
  fatal-path expectation derives the host-native separator with `Path` and
  normalizes only duplicated backslashes in the exception-rendered text
  before asserting both that the redacted path remains and that the sensitive
  home is absent. Local focused and aggregate verification pass; state
  remains IN_PROGRESS until a new exact-head Windows job verifies the
  repair. Evidence: docs/TEST_EVIDENCE.md § M00-W10.

## M00-W10 independent review

M00-W10 independently re-read the canonical v1.3 specification, the full
project-memory and platform/gate records, the W08/W09 diffs, implementation
and tests, and both prior three-operating-system hosted runs. The review
closed KI-0007 through KI-0012 below. KI-0013 is the isolated hosted-test
finding above and remains IN_PROGRESS pending exact-head Windows proof.
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
