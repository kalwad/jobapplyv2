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

## Deferred risks and parked ideas

### KI-0001 — No JS/TS `build` task exists in the M00-W02 scaffold (deliberate deferral)

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-07-26 during M00-W02
- Affects: M00-W02 (scaffold); resolved by M03-W01 / M17-W01 (first real build targets) and M00-W04 (aggregate verification semantics)
- Description: the owner's M00-W02 instructions list build configuration among the
  required configs. The TypeScript workspace intentionally defines no `build`
  task: every TypeScript package in the scaffold is a `noEmit` slot with no
  build output, so a Turborepo `build` task would report success over zero
  implementers — a mocked success state (spec §1.5) contrary to the
  "empty suites must fail" principle assigned to M00-W04. Build coverage
  exists today only where real compilation exists (the native-host crate via
  `cargo build`/`cargo test`). The Turborepo pipeline and per-package script
  slots are in place; the `build` task is added together with the first real
  build target (desktop shell M03-W01, extension M17-W01), and M00-W04's
  aggregate `pnpm verify` must fail on skipped mandatory suites.
- Reproduction: `turbo run build` — no such task is defined (by design, this
  errors rather than passing vacuously).
- Workaround: n/a (nothing exists to build yet).
- Resolution + evidence link: pending the packages above.

### KI-0002 — scripts/validate_status.py predates the strict Python gates (deliberate deferral)

- Severity: LOW
- State: DEFERRED
- Discovered: 2026-07-26 during M00-W04
- Affects: scripts/validate_status.py (M00-W01 deliverable); Python quality
  gates (M00-W03/M00-W04)
- Description: the strict Ruff/mypy coverage added in M00-W03/M00-W04 spans
  `services/`, `scripts/verify.py`, and `scripts/tests/`, but not
  `scripts/validate_status.py`, which was written stdlib-only in M00-W01
  before the strict gates existed (it lacks some return-type annotations
  and stricter-rule conformance). Its behavior is proven by the M00-W01
  negative-case evidence and it is executed (not imported) by the verify
  runner, so the gap is cosmetic, not functional. Annotating it and adding
  it to the strict gates is parked to avoid touching a verified M00-W01
  deliverable inside M00-W04's scope.
- Reproduction: add `scripts/validate_status.py` to `[tool.mypy] files` and
  the ruff command paths, run `uv run mypy` / `uv run ruff check` —
  annotation findings appear.
- Workaround: n/a (the script's own 4-negative-case evidence stands).
- Resolution + evidence link: fold into a later M00 hardening or
  housekeeping package with re-run of the M00-W01 negative cases.

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
  mechanical hardenings for a later M00/M25 hardening pass.
- Reproduction: see docs/TEST_EVIDENCE.md § M00-W04 (final review
  observations 3–5).
- Workaround: n/a (not currently exploitable; layered checks cover today's
  tree).
- Resolution + evidence link: pending a later hardening package.
