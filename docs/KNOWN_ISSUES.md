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
